import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('owners')
export class Owner {
  @PrimaryGeneratedColumn({ name: 'owner_id' })
  ownerId!: number;

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

  @Column({ type: 'boolean' })
  active!: boolean;

  @Column({
    name: 'cognito_sub',
    type: 'varchar',
    length: 255,
    default: '',
  })
  cognitoSub!: string;
}
