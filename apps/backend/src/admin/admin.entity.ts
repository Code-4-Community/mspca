import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('admin_users')
export class AdminUser {
  @PrimaryGeneratedColumn({ name: 'admin_id' })
  adminId!: number;

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

  @Column({ type: 'boolean' })
  active!: boolean;
}
