import { IsString, IsOptional, IsNotEmpty, IsUUID, IsDateString } from 'class-validator';

export class CreateProjectDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsDateString()
  end_date?: string;
}

export class AddProjectMemberDto {
  @IsNotEmpty()
  @IsUUID()
  profile_id: string;

  @IsOptional()
  @IsString()
  role_in_project?: string;
}

export interface ListProjectsQuery {
  cursor?: string;
  limit?: number;
  profileId?: string;
}

