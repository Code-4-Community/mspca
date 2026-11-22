import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { FosterVolunteer } from '../volunteers/volunteers.entity';
import { FosterStaff } from '../staff/staff.entity';
import { Animal } from '../animals/animals.entity';
import { MatchStatus } from './matches.types';

@Entity('matches')
export class Match {
  @PrimaryGeneratedColumn({ name: 'match_id' })
  matchId!: number;

  @ManyToOne(() => FosterVolunteer, (volunteer) => volunteer.matches, {
    nullable: true,
  })
  @JoinColumn({ name: 'volunteer_id' })
  volunteer!: FosterVolunteer | null;

  @Column({ name: 'volunteer_id', nullable: true })
  volunteerId!: number | null;

  @ManyToOne(() => FosterStaff, (staff) => staff.matches, {
    nullable: true,
  })
  @JoinColumn({ name: 'staff_id' })
  staff!: FosterStaff | null;

  @Column({ name: 'staff_id', nullable: true })
  staffId!: number | null;

  @ManyToOne(() => Animal, { nullable: false })
  @JoinColumn({
    name: 'chameleon_animal_id',
    referencedColumnName: 'chameleonAnimalId',
  })
  animal!: Animal;

  @Column({ name: 'chameleon_animal_id', type: 'varchar', length: 255 })
  chameleonAnimalId!: string;

  @Column({ type: 'enum', enum: MatchStatus })
  status!: MatchStatus;

  @Column({ name: 'denied_reason', type: 'text', nullable: true })
  deniedReason!: string | null;
}
