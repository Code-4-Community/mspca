import { InitialSchemas1789354568323 } from '../migrations/1789354568323-InitialSchemas';
import { AddFosterVolunteerCoordinatorAssignmentRelation1790820106597 } from '../migrations/1790820106597-AddFosterVolunteerCoordinatorAssignmentRelation';
import { AddCognitoSubToCoordinators1791234567890 } from '../migrations/1791234567890-AddCognitoSubToCoordinators';
import { ReplaceVolunteerActiveWithStatus1790998545137 } from '../migrations/1790998545137-ReplaceVolunteerActiveWithStatus';
import { AddVolunteerCognitoSub1791000000000 } from '../migrations/1791000000000-AddVolunteerCognitoSub';
import { AddVolunteerAnimalPreferences1791778598934 } from '../migrations/1791778598934-AddVolunteerAnimalPreferences';
import { ReplaceAssignedCoordinatorWithJoinTable1791799999999 } from '../migrations/1791799999999-ReplaceAssignedCoordinatorWithJoinTable';
import { CreateAnimals1792897315518 } from '../migrations/1792897315518-CreateAnimals';
import { AddVolunteerCoordinatorNotes1793055981679 } from '../migrations/1793055981679-AddVolunteerCoordinatorNotes';
import { ReplaceCanineTrainingWithCompletedTrainings1793150103842 } from '../migrations/1793150103842-ReplaceCanineTrainingWithCompletedTrainings';
import { AddAnimalUpdatesAndFosterTypeArray1793163582751 } from '../migrations/1793163582751-AddAnimalUpdatesAndFosterTypeArray';
import { AddFarmAnimalsToFosterType1793476100199 } from '../migrations/1793476100199-AddFarmAnimalsToFosterType';
import { AddFosterTypePreferences1793600000000 } from '../migrations/1793600000000-AddFosterTypePreferences';

const schemaMigrations = [
  InitialSchemas1789354568323,
  AddFosterVolunteerCoordinatorAssignmentRelation1790820106597,
  ReplaceVolunteerActiveWithStatus1790998545137,
  AddVolunteerCognitoSub1791000000000,
  AddCognitoSubToCoordinators1791234567890,
  AddVolunteerAnimalPreferences1791778598934,
  ReplaceAssignedCoordinatorWithJoinTable1791799999999,
  CreateAnimals1792897315518,
  AddVolunteerCoordinatorNotes1793055981679,
  ReplaceCanineTrainingWithCompletedTrainings1793150103842,
  AddAnimalUpdatesAndFosterTypeArray1793163582751,
  AddFarmAnimalsToFosterType1793476100199,
  AddFosterTypePreferences1793600000000,
];

export default schemaMigrations;
