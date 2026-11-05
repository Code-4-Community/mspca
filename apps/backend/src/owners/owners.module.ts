import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Owner } from './owners.entity';
import { OwnersController } from './owners.controller';
import { OwnersService } from './owners.service';
import { CognitoModule } from '../aws/cognito/cognito.module';

@Module({
  imports: [TypeOrmModule.forFeature([Owner]), CognitoModule],
  controllers: [OwnersController],
  providers: [OwnersService],
  exports: [OwnersService],
})
export class OwnersModule {}
