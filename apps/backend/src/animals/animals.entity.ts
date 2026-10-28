import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { Homebase } from '../types';
import { FosterType } from '../volunteers/volunteers.types';
import { Restriction } from './animals.types';

@Entity('animals')
export class Animal {
  @PrimaryGeneratedColumn({ name: 'animal_id' })
  animalId!: number;

  @Column({
    name: 'chameleon_animal_id',
    type: 'varchar',
    length: 255,
    unique: true,
  })
  chameleonAnimalId!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  // Whole years of age, e.g. 4 for "4Y5M"
  @Column({ name: 'age_year', type: 'int', default: 0 })
  ageYear!: number;

  // Remaining months of age, e.g. 5 for "4Y5M"
  @Column({ name: 'age_month', type: 'int', default: 0 })
  ageMonth!: number;

  @Column({ type: 'varchar', length: 10 })
  sex!: string;

  @Column({ type: 'enum', enum: FosterType, enumName: 'foster_type_enum' })
  species!: FosterType;

  // TODO: change to an enum once the breed values are known
  @Column({ type: 'text', array: true, default: () => "'{}'" })
  breed!: string[];

  @Column({ type: 'float' })
  weight!: number;

  @Column({ type: 'enum', enum: Homebase, enumName: 'homebase_enum' })
  location!: Homebase;

  @Column({ type: 'text', array: true })
  pictures!: string[];

  @Column({ name: 'foster_bio_memo', type: 'text' })
  fosterBioMemo!: string;

  @Column({
    type: 'enum',
    enum: Restriction,
    enumName: 'animal_restriction_enum',
    array: true,
    default: () => "'{}'",
  })
  restrictions!: Restriction[];
}
