import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { Match } from './matches.entity';
import { MatchStatus } from './matches.types';
import { CreateMatchDto } from './dtos/create-match.dto';
import { FosterVolunteer } from '../volunteers/volunteers.entity';
import { VolunteersService } from '../volunteers/volunteers.service';
import { EmailsService } from '../aws/ses/email.service';
import { matchCanceledEmail } from '../emails/matchCanceled';

@Injectable()
export class MatchesService {
  private readonly logger = new Logger(MatchesService.name);

  constructor(
    @InjectRepository(Match)
    private repo: Repository<Match>,
    @Inject(forwardRef(() => VolunteersService))
    private volunteersService: VolunteersService,
    private emailsService: EmailsService,
  ) {}

  /**
   * Creates a PENDING match between a volunteer and a Chameleon animal, then
   * notifies the volunteer's assigned foster coordinator by email.
   *
   * The email is best-effort: the match is already committed when it is sent,
   * so a send failure is logged rather than surfaced to the caller. Volunteers
   * with no assigned coordinator still get a match; no email goes out.
   *
   * @param dto the volunteer and Chameleon animal to match
   * @returns the created match
   * @throws NotFoundException if the volunteer does not exist
   * @throws BadRequestException if the volunteer is not active
   */
  async create(dto: CreateMatchDto): Promise<Match> {
    const volunteer = await this.volunteersService.findActiveOrFail(
      dto.volunteerId,
    );

    const match = await this.repo.save(
      this.repo.create({
        volunteerId: dto.volunteerId,
        chameleonAnimalId: dto.chameleonAnimalId,
        status: MatchStatus.PENDING,
        deniedReason: null,
      }),
    );

    await this.notifyCoordinator(match, volunteer);

    return match;
  }

  /**
   * Withdraws a match by setting its status to WITHDRAWN. The record is kept so
   * volunteers can still see their withdrawn applications.
   *
   * Only PENDING matches can be withdrawn - once a coordinator has acted on an
   * application, taking it back is their call, not the volunteer's.
   *
   * @param matchId the match to withdraw
   * @returns the updated match
   * @throws NotFoundException if the match does not exist
   * @throws BadRequestException if the match is not PENDING
   */
  async withdraw(matchId: number): Promise<Match> {
    const match = await this.repo.findOneBy({ matchId });

    if (!match) {
      throw new NotFoundException('Match not found');
    }

    if (match.status !== MatchStatus.PENDING) {
      throw new BadRequestException(
        `Only pending matches can be withdrawn; match ${matchId} is ${match.status}`,
      );
    }

    match.status = MatchStatus.WITHDRAWN;

    return this.repo.save(match);
  }

  /**
   * Emails the volunteer's assigned foster coordinator about a new match.
   *
   * Never throws: the match is already committed by the time this runs, so a
   * missing coordinator is logged as a warning and a failed send as an error
   * rather than failing the request.
   *
   * @param match the match that was just created
   * @param volunteer the matched volunteer, with assignedCoordinator loaded
   */
  private async notifyCoordinator(
    match: Match,
    volunteer: FosterVolunteer,
  ): Promise<void> {
    const coordinator = volunteer.assignedCoordinator;

    if (!coordinator) {
      this.logger.warn(
        `Volunteer ${volunteer.volunteerId} has no assigned coordinator; no match email sent for match ${match.matchId}.`,
      );
      return;
    }

    // Placeholder copy - TODO: put real template here later.
    try {
      await this.emailsService.sendEmail({
        toEmail: coordinator.email,
        subject: 'New foster match created',
        bodyHtml: `<p>A match has been created for ${volunteer.firstName} ${volunteer.lastName} (volunteer ${volunteer.volunteerId}) and Chameleon animal ${match.chameleonAnimalId}.</p>`,
      });
    } catch (error) {
      this.logger.error(
        `Failed to send match creation email for match ${match.matchId}.`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * Fetches all Matches for a Volunteer.
   *
   * Returns Matches of every status, not just active ones.
   * Does not check that the Volunteer exists, so an unknown ID yields an
   * empty array; callers that need a 404 should check the Volunteer first.
   *
   * @param volunteerId - The Volunteer's ID.
   * @returns The Volunteer's Matches, or an empty array if they have none.
   */
  findByVolunteerId(volunteerId: number): Promise<Match[]> {
    return this.repo.find({ where: { volunteerId } });
  }

  /**
   * Approves a pending match and cancels other pending matches for the same animal.
   * Sends cancellation emails to affected applicants in batches of up to 50.
   * Email failures are logged without affecting the committed match statuses.
   *
   * @param id - ID of the match to approve
   * @returns The updated match with status Active
   * @throws NotFoundException if no match exists with the given ID
   * @throws BadRequestException if the match is not Pending
   */
  async approveMatch(id: number): Promise<Match> {
    const { approvedMatch, applicantEmails } =
      await this.repo.manager.transaction(async (manager) => {
        const matchRepo = manager.getRepository(Match);

        const match = await matchRepo.findOneBy({ matchId: id });

        if (!match) {
          throw new NotFoundException(`Match with id ${id} not found`);
        }

        if (match.status !== MatchStatus.PENDING) {
          throw new BadRequestException(`Match with id ${id} is not pending`);
        }

        const otherMatches = await matchRepo.find({
          where: {
            chameleonAnimalId: match.chameleonAnimalId,
            status: MatchStatus.PENDING,
            matchId: Not(id),
          },
          relations: ['volunteer'],
        });

        match.status = MatchStatus.ACTIVE;
        const approvedMatch = await matchRepo.save(match);

        if (otherMatches.length === 0) {
          return { approvedMatch, applicantEmails: [] };
        }

        for (const otherMatch of otherMatches) {
          otherMatch.status = MatchStatus.CANCELED;
        }

        await matchRepo.save(otherMatches);

        const applicantEmails = [
          ...new Set(
            otherMatches.map((otherMatch) => otherMatch.volunteer.email),
          ),
        ];

        return { approvedMatch, applicantEmails };
      });

    if (applicantEmails.length > 0) {
      const senderEmail = process.env.AWS_SES_SENDER_EMAIL;

      if (!senderEmail) {
        this.logger.error(
          `Failed to send match cancellation emails for approved match ${approvedMatch.matchId}: AWS_SES_SENDER_EMAIL is not configured`,
        );
      } else {
        const batchSize = 50;

        for (let i = 0; i < applicantEmails.length; i += batchSize) {
          const batch = applicantEmails.slice(i, i + batchSize);

          try {
            await this.emailsService.sendEmail({
              toEmail: senderEmail,
              bccEmails: batch,
              ...matchCanceledEmail(),
            });
          } catch (error) {
            this.logger.error(
              `Failed to send match cancellation email batch ${
                Math.floor(i / batchSize) + 1
              }.`,
              error,
            );
          }
        }
      }
    }

    return approvedMatch;
  }

  /**
   * Denies a pending match with a reason.
   * Sets the match status to Denied and stores the reason on the match.
   * Only matches that are currently Pending can be denied.
   * @param id - ID of the match to deny
   * @param deniedReason - Why the match was denied
   * @returns The updated match with status Denied and the reason saved
   * @throws NotFoundException if no match exists with the given ID
   * @throws BadRequestException if the match is not Pending
   */
  async denyMatch(id: number, deniedReason: string): Promise<Match> {
    const match = await this.repo.findOneBy({ matchId: id });

    if (!match) {
      throw new NotFoundException(`Match with id ${id} not found`);
    }

    if (match.status !== MatchStatus.PENDING) {
      throw new BadRequestException(`Match with id ${id} is not pending`);
    }

    match.status = MatchStatus.DENIED;
    match.deniedReason = deniedReason;

    return this.repo.save(match);
  }
}
