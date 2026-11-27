import { EmailContent, escapeHtml } from '../../utils/emails.utils';
import { FosterCoordinator } from '../../coordinators/coordinators.entity';

/**
 * Builds the email telling a staff member which foster coordinators were just
 * assigned to them.
 *
 * @param firstName - The staff member's first name.
 * @param coordinators - The newly assigned coordinators.
 * @returns The email's subject and HTML body.
 */
export function staffAssignedCoordinatorsEmail(
  firstName: string,
  coordinators: FosterCoordinator[],
): EmailContent {
  const names = coordinators
    .map((c) => escapeHtml(`${c.firstName} ${c.lastName}`))
    .join(', ');
  return {
    subject: 'New foster coordinator assigned to you',
    bodyHtml: `
      <p>Hi ${escapeHtml(firstName)},</p>
      <p>You have been assigned the following foster coordinators: ${names}.</p>
    `,
  };
}
