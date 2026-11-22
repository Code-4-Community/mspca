import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Check,
} from 'typeorm';
import { FosterVolunteer } from '../volunteers/volunteers.entity';
import { FosterType } from '../volunteers/volunteers.types';

@Entity('pets')
@Check('CHK_pets_age_year', '"age_year" >= 0')
@Check('CHK_pets_age_month', '"age_month" BETWEEN 0 AND 11')
export class Pet {
  @PrimaryGeneratedColumn({ name: 'pet_id' })
  petId!: number;

  @ManyToOne(() => FosterVolunteer, (volunteer) => volunteer.pets, {
    nullable: false,
    onDelete: 'CASCADE',
    orphanedRowAction: 'delete',
  })
  @JoinColumn({ name: 'volunteer_id' })
  volunteer!: FosterVolunteer;

  @Column({ name: 'volunteer_id' })
  volunteerId!: number;

  @Column({ name: 'age_year', type: 'int' })
  ageYear!: number;

  @Column({ name: 'age_month', type: 'int' })
  ageMonth!: number;

  @Column({ type: 'enum', enum: FosterType, enumName: 'foster_type_enum' })
  species!: FosterType;

  @Column({ type: 'varchar', length: 255 })
  breed!: string;
}
