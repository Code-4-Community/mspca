import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { Homebase } from '../types';
import { StaffType } from './staff.types';
import { FosterCoordinator } from '../coordinators/coordinators.entity';
import { Match } from '../matches/matches.entity';

@Entity('foster_staff')
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

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'most_recent_waiver_signed', type: 'boolean' })
  mostRecentWaiverSigned!: boolean;

  @Column({ name: 'staff_type', type: 'enum', enum: StaffType })
  staffType!: StaffType;

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
