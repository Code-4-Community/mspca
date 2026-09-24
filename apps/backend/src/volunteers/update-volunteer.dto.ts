import { FosterCoordinator as number } from '../coordinators/coordinators.entity';
import { Homebase } from '../types';
import { FosterType } from './volunteers.types';
import { IsOptional, IsString, IsNumber, IsBoolean, IsEnum } from 'class-validator';


export class UpdateVolunteerDto {

@IsOptional()
@IsNumber()
volunteerId?: number;
@IsOptional()
@IsString()
firstName?: string;
@IsOptional()
@IsString()
lastName?: string;
@IsOptional()
@IsString()
phone?: string;
@IsOptional()
@IsString()
secondaryPhone?: string;
@IsOptional()
@IsString()
email?: string;
@IsOptional()
@IsString()
address?: string;
@IsOptional()
@IsString()
city?: string;
@IsOptional()
@IsString()
zipcode?: string;
@IsOptional()
@IsEnum(Homebase)
homebase?: Homebase;
@IsOptional()
@IsString()
residentAnimals?: string;
@IsOptional()
@IsString()
notes?: string;
@IsOptional()
@IsEnum(FosterType)
fosterType?: FosterType;
@IsOptional()
@IsBoolean()
completedCanineTraining?: boolean;
@IsOptional()
@IsBoolean()
mostRecentWaiverSigned?: boolean;
@IsOptional()
@IsBoolean()
active?: boolean;
@IsOptional()
@IsNumber()
assignedCoordinatorId?: number;

}