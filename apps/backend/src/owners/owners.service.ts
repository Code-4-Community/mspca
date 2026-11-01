import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Owner } from './owners.entity';

@Injectable()
export class OwnersService {
  constructor(
    @InjectRepository(Owner)
    private repo: Repository<Owner>,
  ) {}
}
