import { Homebase } from '../types';
import { FosterVolunteer } from './volunteers.entity';

export interface CoordinatorEmail {
  subject: string;
  bodyHtml: string;
}

// Volunteer names come from signup input, so escape them before putting them in HTML.
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function describeVolunteer(volunteer: FosterVolunteer): string {
  const name = escapeHtml(`${volunteer.firstName} ${volunteer.lastName}`);
  return `${name} (volunteer ${volunteer.volunteerId})`;
}

// Placeholder copy - TODO: put real templates here later.

/**
 * Builds the email telling a coordinator a volunteer has been assigned to them.
 *
 * @param volunteer the volunteer, already updated to their new homebase
 */
export function coordinatorGainedVolunteerEmail(
  volunteer: FosterVolunteer,
): CoordinatorEmail {
  return {
    subject: 'New volunteer assigned to you',
    bodyHtml: `<p>${describeVolunteer(volunteer)} has moved to the ${
      volunteer.homebase
    } homebase and is now assigned to you.</p>`,
  };
}

/**
 * Builds the email telling a coordinator a volunteer is no longer assigned to them.
 *
 * @param volunteer the volunteer who moved
 * @param newHomebase the homebase the volunteer moved to
 */
export function coordinatorLostVolunteerEmail(
  volunteer: FosterVolunteer,
  newHomebase: Homebase,
): CoordinatorEmail {
  return {
    subject: 'Volunteer moved to another homebase',
    bodyHtml: `<p>${describeVolunteer(
      volunteer,
    )} has moved to the ${newHomebase} homebase and is no longer assigned to you.</p>`,
  };
}
