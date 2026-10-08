import { InitialSchemas1789354568323 } from '../migrations/1789354568323-InitialSchemas';
import { AddFosterVolunteerCoordinatorAssignmentRelation1790820106597 } from '../migrations/1790820106597-AddFosterVolunteerCoordinatorAssignmentRelation';
import { AddCognitoSubToCoordinators1791234567890 } from '../migrations/1791234567890-AddCognitoSubToCoordinators';

const schemaMigrations = [
  InitialSchemas1789354568323,
  AddFosterVolunteerCoordinatorAssignmentRelation1790820106597,
  AddCognitoSubToCoordinators1791234567890,
];

export default schemaMigrations;
