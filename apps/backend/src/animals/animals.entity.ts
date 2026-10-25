import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('animals')
export class Animal {
  @PrimaryGeneratedColumn({ name: 'animal_id' })
  animalId!: number;

  @Column({ name: 'chameleon_animal_id', type: 'int', unique: true })
  chameleonAnimalId!: number;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  // Age in years
  @Column({ type: 'int' })
  age!: number;

  @Column({ type: 'varchar', length: 50 })
  sex!: string;

  // TODO: change to an enum once the breed values are known
  @Column({ type: 'text', array: true, default: () => "'{}'" })
  breed!: string[];

  @Column({ type: 'float' })
  weight!: number;

  @Column({ type: 'varchar', length: 255 })
  location!: string;

  @Column({ type: 'varchar', length: 2048, nullable: true })
  picture!: string | null;

  @Column({ name: 'foster_bio_memo', type: 'text', nullable: true })
  fosterBioMemo!: string | null;
}
