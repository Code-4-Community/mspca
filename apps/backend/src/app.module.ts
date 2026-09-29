import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import typeorm from './config/typeorm';
import { CognitoModule } from './aws/cognito/cognito.module';
import { MatchesModule } from './matches/matches.module';
import { CoordinatorsModule } from './coordinators/coordinators.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [typeorm],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        configService.getOrThrow('typeorm'),
    }),
    CognitoModule,
    MatchesModule,
    CoordinatorsModule,
  ],
})
export class AppModule {}
