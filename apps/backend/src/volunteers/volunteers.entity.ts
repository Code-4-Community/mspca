import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Homebase } from '../types';
import { FosterType } from './volunteers.types';
import { FosterCoordinator } from '../coordinators/coordinators.entity';

@Entity('foster_volunteers')
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

  @Column({ type: 'varchar', length: 255 })
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

  @Column({ name: 'foster_type', type: 'enum', enum: FosterType })
  fosterType!: FosterType;

  @Column({
    name: 'completed_canine_training',
    type: 'boolean',
    nullable: true,
  })
  completedCanineTraining!: boolean | null;

  @Column({ name: 'most_recent_waiver_signed', type: 'boolean' })
  mostRecentWaiverSigned!: boolean;

  @Column({ type: 'boolean' })
  active!: boolean;

  @ManyToOne(
    () => FosterCoordinator,
    (coordinator) => coordinator.assignedVolunteers,
    { nullable: true },
  )
  @JoinColumn({ name: 'assigned_coordinator_id' })
  assignedCoordinator!: FosterCoordinator | null;
}
