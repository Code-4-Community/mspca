import { Entity, PrimaryGeneratedColumn, Column, ManyToMany } from 'typeorm';
import { Homebase } from '../types';
import { FosterVolunteer } from '../volunteers/volunteers.entity';

@Entity('foster_coordinators')
export class FosterCoordinator {
  @PrimaryGeneratedColumn({ name: 'coordinator_id' })
  coordinatorId!: number;

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

  @Column({ type: 'enum', enum: Homebase })
  homebase!: Homebase;

  @Column({ type: 'boolean' })
  active!: boolean;

  @ManyToMany(
    () => FosterVolunteer,
    (volunteer) => volunteer.assignedCoordinators,
    // Matches the migration: a coordinator with assigned volunteers can't be deleted.
    { onDelete: 'RESTRICT' },
  )
  assignedVolunteers!: FosterVolunteer[];
}
