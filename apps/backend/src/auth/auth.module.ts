import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { CognitoModule } from '../aws/cognito/cognito.module';
import { VolunteersModule } from '../volunteers/volunteers.module';
import { CoordinatorsModule } from '../coordinators/coordinators.module';
import { OwnersModule } from '../owners/owners.module';

@Module({
  imports: [CognitoModule, VolunteersModule, CoordinatorsModule, OwnersModule],
  controllers: [AuthController],
})
export class AuthModule {}
