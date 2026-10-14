import { escapeHtml } from '../../utils/emails.utils';

/**
 * The subject and HTML body of an email.
 */
export interface EmailContent {
  subject: string;
  bodyHtml: string;
}

/**
 * Builds the email sent to a Volunteer once a coordinator approves their account.
 *
 * @param firstName - The Volunteer's first name.
 * @returns The email's subject and HTML body.
 */
export function volunteerApprovedEmail(firstName: string): EmailContent {
  return {
    subject: 'Your MSPCA foster volunteer account has been approved',
    bodyHtml: `
      <p>Hi ${escapeHtml(firstName)},</p>
      <p> Your MSPCA foster volunteer account has been approved by a foster coordinator.</p>
    `,
  };
}
