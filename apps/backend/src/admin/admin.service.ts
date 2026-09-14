import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminUser } from './admin.entity';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(AdminUser)
    private repo: Repository<AdminUser>,
  ) {}
}
