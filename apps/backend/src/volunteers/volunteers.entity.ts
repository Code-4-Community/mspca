import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToMany,
  OneToMany,
  JoinTable,
  Unique,
  Check,
} from 'typeorm';
import { Homebase } from '../types';
import {
  FosterTraining,
  FosterType,
  VolunteerStatus,
} from './volunteers.types';
import { FosterCoordinator } from '../coordinators/coordinators.entity';
import { Pet } from '../pets/pets.entity';

@Entity('foster_volunteers')
@Unique('UQ_foster_volunteers_email', ['email'])
@Check(
  'CHK_foster_volunteers_children_ages',
  '("has_children" AND cardinality("children_ages") > 0) OR (NOT "has_children" AND cardinality("children_ages") = 0)',
)
@Check(
  'CHK_foster_volunteers_children_ages_nonnegative',
  '0 <= ALL ("children_ages")',
)
export class FosterVolunteer {
  @PrimaryGeneratedColumn({ name: 'volunteer_id' })
  volunteerId!: number;

  @Column({ name: 'first_name', type: 'varchar', length: 255 })
  firstName!: string;

  @Column({ name: 'last_name', type: 'varchar', length: 255 })
  lastName!: string;

  @Column({ type: 'varchar', length: 20 })
  phone!: string;

  @Column({
    name: 'secondary_phone',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  secondaryPhone!: string | null;

  @Column({ type: 'varchar', length: 255, unique: true })
  email!: string;

  @Column({ type: 'varchar', length: 255 })
  address!: string;

  @Column({ type: 'varchar', length: 255 })
  city!: string;

  @Column({ type: 'varchar', length: 10 })
  zipcode!: string;

  @Column({ type: 'enum', enum: Homebase })
  homebase!: Homebase;

  @Column({ name: 'has_children', type: 'boolean' })
  hasChildren!: boolean;

  @Column({
    name: 'children_ages',
    type: 'int',
    array: true,
    default: () => "'{}'",
  })
  childrenAges!: number[];

  @Column({ name: 'has_separate_foster_room', type: 'boolean' })
  hasSeparateFosterRoom!: boolean;

  @OneToMany(() => Pet, (pet) => pet.volunteer, { cascade: true })
  pets!: Pet[];

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'coordinator_notes', type: 'text', nullable: true })
  coordinatorNotes?: string | null;

  @Column({ name: 'foster_type', type: 'enum', enum: FosterType, array: true })
  fosterType!: FosterType[];

  @Column({ name: 'animal_updates', type: 'boolean', default: true })
  animalUpdates!: boolean;

  @Column({
    name: 'completed_trainings',
    type: 'enum',
    enum: FosterTraining,
    enumName: 'foster_training_enum',
    array: true,
    default: () => "'{}'",
  })
  completedTrainings!: FosterTraining[];

  @Column({ name: 'most_recent_waiver_signed', type: 'boolean' })
  mostRecentWaiverSigned!: boolean;

  @Column({
    type: 'enum',
    enum: VolunteerStatus,
    default: VolunteerStatus.PENDING,
  })
  status!: VolunteerStatus;

  @Column({ name: 'cognito_sub', type: 'varchar', length: 255, default: '' })
  cognitoSub!: string;

  @Column({
    name: 'animal_preferences',
    type: 'text',
    array: true,
    default: () => "'{}'",
  })
  animalPreferences!: string[];

  @ManyToMany(
    () => FosterCoordinator,
    (coordinator) => coordinator.assignedVolunteers,
    { onDelete: 'CASCADE' },
  )
  @JoinTable({
    name: 'volunteer_coordinator_assignments',
    joinColumn: { name: 'volunteer_id', referencedColumnName: 'volunteerId' },
    inverseJoinColumn: {
      name: 'coordinator_id',
      referencedColumnName: 'coordinatorId',
    },
  })
  assignedCoordinators!: FosterCoordinator[];
}
