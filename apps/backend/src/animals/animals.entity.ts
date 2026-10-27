import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { Homebase } from '../types';
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
  @Column({ type: 'int' })
  age!: number;

  // Remaining months of age, e.g. 5 for "4Y5M"
  @Column({ type: 'int', default: 0 })
  months!: number;

  @Column({ type: 'varchar', length: 10 })
  sex!: string;

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
