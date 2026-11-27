import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FosterStaff } from './staff.entity';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';
import { CognitoModule } from '../aws/cognito/cognito.module';
import { CoordinatorsModule } from '../coordinators/coordinators.module';
import { AWSSESModule } from '../aws/ses/email.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([FosterStaff]),
    CognitoModule,
    CoordinatorsModule,
    AWSSESModule,
  ],
  controllers: [StaffController],
  providers: [StaffService],
  exports: [StaffService],
})
export class StaffModule {}
