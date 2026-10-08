import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Match } from './matches.entity';
import { MatchStatus } from './matches.types';
import { CreateMatchDto } from './dtos/create-match.dto';
import { FosterVolunteer } from '../volunteers/volunteers.entity';
import { VolunteersService } from '../volunteers/volunteers.service';
import { EmailsService } from '../aws/ses/email.service';

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
   * Approves a pending match.
   * Sets the match status to Active, meaning the foster placement is now happening.
   * Only matches that are currently Pending can be approved.
   * @param id - ID of the match to approve
   * @returns The updated match with status Active
   * @throws NotFoundException if no match exists with the given ID
   * @throws BadRequestException if the match is not Pending
   */
  async approveMatch(id: number): Promise<Match> {
    const match = await this.repo.findOneBy({ matchId: id });
    if (!match) {
      throw new NotFoundException(`Match with id ${id} not found`);
    }
    if (match.status !== MatchStatus.PENDING) {
      throw new BadRequestException(`Match with id ${id} is not pending`);
    }

    match.status = MatchStatus.ACTIVE;
    return this.repo.save(match);
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
