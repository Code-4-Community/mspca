import { EmailContent, escapeHtml } from '../../utils/emails.utils';
import { FosterCoordinator } from '../../coordinators/coordinators.entity';

/**
 * Builds the email telling a staff member which foster coordinator was just
 * assigned to them. Uses plural wording only when more than one was assigned.
 *
 * @param firstName - The staff member's first name.
 * @param coordinators - The newly assigned coordinator, usually just one.
 * @returns The email's subject and HTML body.
 */
export function staffAssignedCoordinatorsEmail(
  firstName: string,
  coordinators: FosterCoordinator[],
): EmailContent {
  const names = coordinators
    .map((c) => escapeHtml(`${c.firstName} ${c.lastName}`))
    .join(', ');
  const noun =
    coordinators.length > 1 ? 'foster coordinators' : 'foster coordinator';
  return {
    subject: `New ${noun} assigned to you`,
    bodyHtml: `
      <p>Hi ${escapeHtml(firstName)},</p>
      <p>You have been assigned the following ${noun}: ${names}.</p>
    `,
  };
}
