import { Homebase } from '../types';
import { FosterVolunteer } from './volunteers.entity';
import {
  coordinatorGainedVolunteerEmail,
  coordinatorLostVolunteerEmail,
} from './volunteers.emails';

const volunteer = {
  volunteerId: 12,
  firstName: 'Ada',
  lastName: 'Lovelace',
  homebase: Homebase.SALEM,
} as FosterVolunteer;

describe('volunteer emails', () => {
  describe('coordinatorGainedVolunteerEmail', () => {
    it('names the volunteer and their new homebase', () => {
      const email = coordinatorGainedVolunteerEmail(volunteer);

      expect(email.subject).toBe('New volunteer assigned to you');
      expect(email.bodyHtml).toContain('Ada Lovelace');
      expect(email.bodyHtml).toContain('volunteer 12');
      expect(email.bodyHtml).toContain(Homebase.SALEM);
    });
  });

  describe('coordinatorLostVolunteerEmail', () => {
    it('names the volunteer and the homebase they moved to', () => {
      const email = coordinatorLostVolunteerEmail(volunteer, Homebase.SALEM);

      expect(email.subject).toBe('Volunteer moved to another homebase');
      expect(email.bodyHtml).toContain('Ada Lovelace');
      expect(email.bodyHtml).toContain('volunteer 12');
      expect(email.bodyHtml).toContain(Homebase.SALEM);
      expect(email.bodyHtml).toContain('no longer assigned to you');
    });
  });

  it('escapes HTML in the volunteer name', () => {
    const hostile = {
      ...volunteer,
      firstName: '<script>alert("x")</script>',
      lastName: "O'Brien & Co",
    } as FosterVolunteer;

    for (const email of [
      coordinatorGainedVolunteerEmail(hostile),
      coordinatorLostVolunteerEmail(hostile, Homebase.BOSTON),
    ]) {
      expect(email.bodyHtml).not.toContain('<script>');
      expect(email.bodyHtml).toContain(
        '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;',
      );
      expect(email.bodyHtml).toContain('O&#39;Brien &amp; Co');
    }
  });
});
