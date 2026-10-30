import { EmailContent, escapeHtml } from '../../utils/emails.utils';
import { FosterVolunteer } from '../../volunteers/volunteers.entity';
import { Match } from '../matches.entity';

// Placeholder copy - TODO: put real template here later.

/**
 * Builds the email telling coordinators a match was created for their volunteer.
 *
 * @param match - The match that was just created.
 * @param volunteer - The matched Volunteer.
 * @returns The email's subject and HTML body.
 */
export function matchCreatedEmail(
  match: Match,
  volunteer: FosterVolunteer,
): EmailContent {
  const name = escapeHtml(`${volunteer.firstName} ${volunteer.lastName}`);
  return {
    subject: 'New foster match created',
    bodyHtml: `<p>A match has been created for ${name} (volunteer ${volunteer.volunteerId}) and Chameleon animal ${match.chameleonAnimalId}.</p>`,
  };
}
