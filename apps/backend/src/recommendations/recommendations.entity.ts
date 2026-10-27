import { Entity, Column, ManyToOne, JoinColumn, PrimaryColumn } from 'typeorm';
import { FosterVolunteer } from '../volunteers/volunteers.entity';
import { Animal } from '../animals/animals.entity';

@Entity('recommendations')
export class Recommendation {
  @ManyToOne(() => FosterVolunteer, { nullable: false })
  @JoinColumn({ name: 'volunteer_id' })
  volunteer!: FosterVolunteer;

  @PrimaryColumn({ name: 'volunteer_id' })
  volunteerId!: number;

  @ManyToOne(() => Animal, { nullable: false })
  @JoinColumn({
    name: 'chameleon_animal_id',
    referencedColumnName: 'chameleonAnimalId',
  })
  animal!: Animal;

  @PrimaryColumn({ name: 'chameleon_animal_id', type: 'varchar', length: 255 })
  chameleonAnimalId!: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;
}
