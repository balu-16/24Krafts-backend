import { IsString, IsOptional, IsNotEmpty, IsEnum, IsDateString, IsArray } from 'class-validator';

export class CreatePostDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsNotEmpty()
  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  requirements?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  department?: string;

  // Optional array of departments (preferred going forward)
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  departments?: string[];

  @IsOptional()
  @IsDateString()
  deadline?: string;

  @IsOptional()
  @IsString()
  image?: string; // base64 encoded image

  @IsOptional()
  @IsString()
  caption?: string;

  @IsOptional()
  @IsEnum(['open', 'closed', 'in_progress', 'completed'])
  status?: string;
}

export class UpdatePostDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  requirements?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  departments?: string[];

  @IsOptional()
  @IsDateString()
  deadline?: string;

  
  @IsOptional()
  @IsEnum(['open', 'closed', 'in_progress', 'completed'])
  status?: string;
}

export class CreateCommentDto {
  @IsNotEmpty()
  @IsString()
  content: string;
}

export class ApplyToProjectDto {
  @IsOptional()
  @IsString()
  cover_letter?: string;

  @IsOptional()
  @IsString()
  portfolio_link?: string;
}

export class UpdateApplicationStatusDto {
  @IsNotEmpty()
  @IsEnum(['pending', 'accepted', 'rejected', 'withdrawn'])
  status: string;
}

export interface ListPostsQuery {
  cursor?: string;
  limit?: number;
  profileId?: string;
  role?: string; // To filter posts by author role
  department?: string; // To filter posts by department (string or array)
}

export interface ListCommentsQuery {
  cursor?: string;
  limit?: number;
}

export interface ListApplicationsQuery {
  cursor?: string;
  limit?: number;
  projectId?: string;
  artistProfileId?: string;
  status?: string;
}

