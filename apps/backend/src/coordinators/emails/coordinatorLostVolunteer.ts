import { Homebase } from '../../types';
import { EmailContent, escapeHtml } from '../../utils/emails.utils';
import { FosterVolunteer } from '../../volunteers/volunteers.entity';

// Placeholder copy - TODO: put real template here later.

/**
 * Builds the email telling a coordinator a volunteer is no longer assigned to them.
 *
 * @param volunteer - The Volunteer who moved.
 * @param newHomebase - The homebase the Volunteer moved to.
 * @returns The email's subject and HTML body.
 */
export function coordinatorLostVolunteerEmail(
  volunteer: FosterVolunteer,
  newHomebase: Homebase,
): EmailContent {
  const name = escapeHtml(`${volunteer.firstName} ${volunteer.lastName}`);
  return {
    subject: 'Volunteer moved to another homebase',
    bodyHtml: `<p>${name} (volunteer ${volunteer.volunteerId}) has moved to the ${newHomebase} homebase and is no longer assigned to you.</p>`,
  };
}
