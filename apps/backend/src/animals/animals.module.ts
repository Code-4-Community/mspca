import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Animal } from './animals.entity';
import { AnimalsService } from './animals.service';

@Module({
  imports: [TypeOrmModule.forFeature([Animal])],
  providers: [AnimalsService],
  exports: [AnimalsService],
})
export class AnimalsModule {}
