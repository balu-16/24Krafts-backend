import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsUUID,
  IsDateString,
  IsIn,
} from 'class-validator';

export class CreateScheduleDto {
  @IsNotEmpty()
  @IsUUID()
  project_id: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNotEmpty()
  @IsDateString()
  date: string;

  @IsOptional()
  @IsString()
  start_time?: string;

  @IsOptional()
  @IsString()
  end_time?: string;

  @IsOptional()
  @IsString()
  location?: string;
}

export class AddScheduleMemberDto {
  @IsNotEmpty()
  @IsUUID()
  profile_id: string;
}

export class UpdateScheduleMemberStatusDto {
  @IsNotEmpty()
  @IsString()
  @IsIn(['accepted', 'declined', 'pending'])
  status: string;
}

export interface ListSchedulesQuery {
  cursor?: string;
  limit?: number;
  profileId?: string;
  projectId?: string;
}

