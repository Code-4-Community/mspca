import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { FosterVolunteer } from '../volunteers/volunteers.entity';
import { MatchStatus } from './matches.types';

@Entity('matches')
export class Match {
  @PrimaryGeneratedColumn({ name: 'match_id' })
  matchId!: number;

  @ManyToOne(() => FosterVolunteer, { nullable: false })
  @JoinColumn({ name: 'volunteer_id' })
  volunteer!: FosterVolunteer;

  @Column({ name: 'volunteer_id' })
  volunteerId!: number;

  @Column({ name: 'chameleon_animal_id', type: 'int' })
  chameleonAnimalId!: number;

  @Column({ type: 'enum', enum: MatchStatus })
  status!: MatchStatus;

  @Column({ name: 'denied_reason', type: 'text', nullable: true })
  deniedReason!: string | null;
}
