import { InitialSchemas1789354568323 } from '../migrations/1789354568323-InitialSchemas';
import { AddFosterVolunteerCoordinatorAssignmentRelation1790820106597 } from '../migrations/1790820106597-AddFosterVolunteerCoordinatorAssignmentRelation';
import { AddCognitoSubToCoordinators1791234567890 } from '../migrations/1791234567890-AddCognitoSubToCoordinators';
import { ReplaceVolunteerActiveWithStatus1790998545137 } from '../migrations/1790998545137-ReplaceVolunteerActiveWithStatus';
import { AddVolunteerCognitoSub1791000000000 } from '../migrations/1791000000000-AddVolunteerCognitoSub';
import { AddVolunteerFosterTypePreferences1791800000000 } from '../migrations/1791800000000-AddVolunteerFosterTypePreferences';
import { AddVolunteerAnimalPreferences1791778598934 } from '../migrations/1791778598934-AddVolunteerAnimalPreferences';

const schemaMigrations = [
  InitialSchemas1789354568323,
  AddFosterVolunteerCoordinatorAssignmentRelation1790820106597,
  ReplaceVolunteerActiveWithStatus1790998545137,
  AddVolunteerCognitoSub1791000000000,
  AddCognitoSubToCoordinators1791234567890,
  AddVolunteerAnimalPreferences1791778598934,
  AddVolunteerFosterTypePreferences1791800000000,
];

export default schemaMigrations;
