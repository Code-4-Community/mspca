import { registerAs } from '@nestjs/config';
import { PluralNamingStrategy } from '../strategies/plural-naming.strategy';
import { DataSource, DataSourceOptions } from 'typeorm';
import schemaMigrations from './migrations';
import 'pg';

const config = {
  type: 'postgres',
  host: `${process.env.NX_DB_HOST}`,
  port: parseInt(`${process.env.NX_DB_PORT}`, 10),
  database: `${process.env.NX_DB_DATABASE}`,
  username: `${process.env.NX_DB_USERNAME}`,
  password: `${process.env.NX_DB_PASSWORD}`,
  autoLoadEntities: true,
  synchronize: false,
  namingStrategy: new PluralNamingStrategy(),
  migrations: [...schemaMigrations],
  ssl:
    process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false,
};

export default registerAs('typeorm', () => config);
export const connectionSource = new DataSource(config as DataSourceOptions);
