import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsUUID,
  IsDateString,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateScheduleDto {
  @ApiProperty({ description: 'Project UUID', example: 'uuid-here' })
  @IsNotEmpty()
  @IsUUID()
  project_id: string;

  @ApiPropertyOptional({ description: 'Schedule title', example: 'Script Reading Session' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Schedule description', example: 'First script reading with cast' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Schedule date', format: 'date', example: '2024-12-01' })
  @IsNotEmpty()
  @IsDateString()
  date: string;

  @ApiPropertyOptional({ description: 'Start time', example: '09:00' })
  @IsOptional()
  @IsString()
  start_time?: string;

  @ApiPropertyOptional({ description: 'End time', example: '17:00' })
  @IsOptional()
  @IsString()
  end_time?: string;

  @ApiPropertyOptional({ description: 'Location', example: 'Studio A, Mumbai' })
  @IsOptional()
  @IsString()
  location?: string;
}

export class AddScheduleMemberDto {
  @ApiProperty({ description: 'Profile UUID of the member to add', example: 'uuid-here' })
  @IsNotEmpty()
  @IsUUID()
  profile_id: string;
}

export class UpdateScheduleMemberStatusDto {
  @ApiProperty({ description: 'Member status', enum: ['accepted', 'declined', 'pending'], example: 'accepted' })
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

