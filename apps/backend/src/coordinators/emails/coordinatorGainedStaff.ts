import { EmailContent, escapeHtml } from '../../utils/emails.utils';
import { FosterStaff } from '../../staff/staff.entity';

/**
 * Builds the email telling coordinators a staff member has been assigned to them.
 *
 * @param staff - The staff member who was assigned.
 * @returns The email's subject and HTML body.
 */
export function coordinatorGainedStaffEmail(staff: FosterStaff): EmailContent {
  const name = escapeHtml(`${staff.firstName} ${staff.lastName}`);
  return {
    subject: 'New staff member assigned to you',
    bodyHtml: `<p>${name} (staff member ${staff.staffId}) is now assigned to you.</p>`,
  };
}
