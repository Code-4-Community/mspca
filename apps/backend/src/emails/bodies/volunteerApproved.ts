import { escapeHtml } from '../emails.utils';

/**
 * Builds the email sent to a Volunteer once a coordinator approves their account.
 *
 * @param firstName - The Volunteer's first name.
 * @returns The email's subject and HTML body.
 */
export function volunteerApprovedEmail(firstName: string): {
  subject: string;
  bodyHtml: string;
} {
  return {
    subject: 'Your MSPCA foster volunteer account has been approved',
    bodyHtml: `
      <p>Hi ${escapeHtml(firstName)},</p>
      <p> Your MSPCA foster volunteer account has been approved by a foster coordinator.</p>
    `,
  };
}
