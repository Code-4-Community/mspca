import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Match } from './matches.entity';
import { MatchStatus } from './matches.types';
import { CreateMatchDto } from './dtos/create-match.dto';
import { FosterVolunteer } from '../volunteers/volunteers.entity';
import { EmailsService } from '../aws/ses/email.service';

@Injectable()
export class MatchesService {
  private readonly logger = new Logger(MatchesService.name);

  constructor(
    @InjectRepository(Match)
    private repo: Repository<Match>,
    @InjectRepository(FosterVolunteer)
    private volunteerRepo: Repository<FosterVolunteer>,
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
   */
  async create(dto: CreateMatchDto): Promise<Match> {
    const volunteer = await this.volunteerRepo.findOne({
      where: { volunteerId: dto.volunteerId },
      relations: ['assignedCoordinator'],
    });

    if (!volunteer) {
      throw new NotFoundException('Volunteer not found');
    }

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
   * @param matchId the match to withdraw
   * @returns the updated match
   * @throws NotFoundException if the match does not exist
   */
  async withdraw(matchId: number): Promise<Match> {
    const match = await this.repo.findOneBy({ matchId });

    if (!match) {
      throw new NotFoundException('Match not found');
    }

    match.status = MatchStatus.WITHDRAWN;

    return this.repo.save(match);
  }

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
}
