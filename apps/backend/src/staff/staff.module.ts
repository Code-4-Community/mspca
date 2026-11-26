import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FosterStaff } from './staff.entity';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';
import { CognitoModule } from '../aws/cognito/cognito.module';

@Module({
  imports: [TypeOrmModule.forFeature([FosterStaff]), CognitoModule],
  controllers: [StaffController],
  providers: [StaffService],
  exports: [StaffService],
})
export class StaffModule {}
