import { Homebase } from '../../types';
import { FosterVolunteer } from '../../volunteers/volunteers.entity';
import { coordinatorGainedVolunteerEmail } from './coordinatorGainedVolunteer';

describe('coordinatorGainedVolunteerEmail', () => {
  const volunteer = {
    volunteerId: 12,
    firstName: 'Ada',
    lastName: 'Lovelace',
    homebase: Homebase.SALEM,
  } as FosterVolunteer;

  it('names the volunteer and their new homebase', () => {
    const email = coordinatorGainedVolunteerEmail(volunteer);

    expect(email.subject).toBe('New volunteer assigned to you');
    expect(email.bodyHtml).toContain('Ada Lovelace');
    expect(email.bodyHtml).toContain('volunteer 12');
    expect(email.bodyHtml).toContain(Homebase.SALEM);
    expect(email.bodyHtml).toContain('now assigned to you');
  });

  it('escapes HTML in the volunteer name', () => {
    const email = coordinatorGainedVolunteerEmail({
      ...volunteer,
      firstName: '<script>alert("x")</script>',
      lastName: "O'Brien & Co",
    } as FosterVolunteer);

    expect(email.bodyHtml).not.toContain('<script>');
    expect(email.bodyHtml).toContain(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;',
    );
    expect(email.bodyHtml).toContain('O&#39;Brien &amp; Co');
  });
});
