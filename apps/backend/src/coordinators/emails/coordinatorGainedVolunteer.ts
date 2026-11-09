import { Homebase } from '../../types';
import { EmailContent, escapeHtml } from '../../utils/emails.utils';
import { FosterVolunteer } from '../../volunteers/volunteers.entity';

// Placeholder copy - TODO: put real template here later.

/**
 * Builds the email telling a coordinator a volunteer has been assigned to them.
 *
 * @param volunteer - The Volunteer, already updated to their new homebase.
 * @param previousHomebase - The homebase the Volunteer moved from.
 * @returns The email's subject and HTML body.
 */
export function coordinatorGainedVolunteerEmail(
  volunteer: FosterVolunteer,
  previousHomebase: Homebase,
): EmailContent {
  const name = escapeHtml(`${volunteer.firstName} ${volunteer.lastName}`);
  return {
    subject: 'New volunteer assigned to you',
    bodyHtml: `<p>${name} (volunteer ${volunteer.volunteerId}) has moved from the ${previousHomebase} homebase to the ${volunteer.homebase} homebase and is now assigned to you.</p>`,
  };
}
