import { Entity, Column, ManyToOne, JoinColumn, PrimaryColumn } from 'typeorm';
import { FosterVolunteer } from '../volunteers/volunteers.entity';

@Entity('recommendations')
export class Recommendation {
  @ManyToOne(() => FosterVolunteer, { nullable: false })
  @JoinColumn({ name: 'volunteer_id' })
  volunteer!: FosterVolunteer;

  @PrimaryColumn({ name: 'volunteer_id' })
  volunteerId!: number;

  @PrimaryColumn({ name: 'chameleon_animal_id', type: 'int' })
  chameleonAnimalId!: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;
}
