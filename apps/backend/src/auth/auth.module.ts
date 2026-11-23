import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { CognitoModule } from '../aws/cognito/cognito.module';
import { VolunteersModule } from '../volunteers/volunteers.module';
import { StaffModule } from '../staff/staff.module';
import { CoordinatorsModule } from '../coordinators/coordinators.module';
import { OwnersModule } from '../owners/owners.module';

@Module({
  imports: [
    CognitoModule,
    VolunteersModule,
    StaffModule,
    CoordinatorsModule,
    OwnersModule,
  ],
  controllers: [AuthController],
})
export class AuthModule {}
