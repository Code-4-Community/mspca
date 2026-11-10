import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import typeorm from './config/typeorm';
import { CognitoModule } from './aws/cognito/cognito.module';
import { RecommendationsModule } from './recommendations/recommendations.module';
import { MatchesModule } from './matches/matches.module';
import { CoordinatorsModule } from './coordinators/coordinators.module';
import { VolunteersModule } from './volunteers/volunteers.module';
import { AnimalsModule } from './animals/animals.module';
import { ThrottlerModule, minutes } from '@nestjs/throttler';

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
    RecommendationsModule,
    MatchesModule,
    CoordinatorsModule,
    VolunteersModule,
    AnimalsModule,
    ThrottlerModule.forRoot([{ ttl: minutes(1), limit: 10 }]),
  ],
})
export class AppModule {}
