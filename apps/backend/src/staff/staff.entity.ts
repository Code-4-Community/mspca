import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToMany,
  JoinTable,
  Unique,
} from 'typeorm';
import { Homebase } from '../types';
import { FosterTraining, FosterType } from '../volunteers/volunteers.types';
import { FosterCoordinator } from '../coordinators/coordinators.entity';
import { Match } from '../matches/matches.entity';

@Entity('foster_staff')
@Unique('UQ_foster_staff_email', ['email'])
export class FosterStaff {
  @PrimaryGeneratedColumn({ name: 'staff_id' })
  staffId!: number;

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

  @Column({ name: 'resident_animals', type: 'text' })
  residentAnimals!: string;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'foster_type', type: 'enum', enum: FosterType, array: true })
  fosterType!: FosterType[];

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
    name: 'foster_type_preferences',
    type: 'enum',
    enum: FosterType,
    enumName: 'foster_type_enum',
    array: true,
    default: () => "'{}'",
  })
  fosterTypePreferences!: FosterType[];

  @Column({ type: 'boolean' })
  active!: boolean;

  @Column({ name: 'cognito_sub', type: 'varchar', length: 255, default: '' })
  cognitoSub!: string;

  @ManyToMany(() => FosterCoordinator, { onDelete: 'CASCADE' })
  @JoinTable({
    name: 'staff_coordinator_assignments',
    joinColumn: { name: 'staff_id', referencedColumnName: 'staffId' },
    inverseJoinColumn: {
      name: 'coordinator_id',
      referencedColumnName: 'coordinatorId',
    },
  })
  assignedCoordinators!: FosterCoordinator[];

  @OneToMany(() => Match, (match) => match.staff)
  matches?: Match[];
}
