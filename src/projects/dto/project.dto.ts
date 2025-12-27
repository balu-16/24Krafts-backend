import { IsString, IsOptional, IsNotEmpty, IsUUID, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProjectDto {
  @ApiProperty({ description: 'Project title', example: 'Feature Film Production' })
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiPropertyOptional({ description: 'Project description', example: 'A feature film about...' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Project image URL', example: 'https://example.com/project.jpg' })
  @IsOptional()
  @IsString()
  image?: string;

  @ApiPropertyOptional({ description: 'Project start date', format: 'date', example: '2024-01-01' })
  @IsOptional()
  @IsDateString()
  start_date?: string;

  @ApiPropertyOptional({ description: 'Project end date', format: 'date', example: '2024-12-31' })
  @IsOptional()
  @IsDateString()
  end_date?: string;
}

export class AddProjectMemberDto {
  @ApiProperty({ description: 'Profile UUID of the member to add', example: 'uuid-here' })
  @IsNotEmpty()
  @IsUUID()
  profile_id: string;

  @ApiPropertyOptional({ description: 'Role in the project', example: 'Lead Actor' })
  @IsOptional()
  @IsString()
  role_in_project?: string;
}

export interface ListProjectsQuery {
  cursor?: string;
  limit?: number;
  profileId?: string;
}

