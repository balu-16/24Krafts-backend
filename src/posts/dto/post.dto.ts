import { IsString, IsOptional, IsNotEmpty, IsEnum, IsDateString, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePostDto {
  @ApiProperty({ description: 'Post title', example: 'Looking for actors' })
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiProperty({ description: 'Post description', example: 'We need talented actors for our upcoming project' })
  @IsNotEmpty()
  @IsString()
  description: string;

  @ApiPropertyOptional({ description: 'Job requirements', example: 'Minimum 2 years experience' })
  @IsOptional()
  @IsString()
  requirements?: string;

  @ApiPropertyOptional({ description: 'Job location', example: 'Mumbai' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ description: 'Department', example: 'Acting' })
  @IsOptional()
  @IsString()
  department?: string;

  // Optional array of departments (preferred going forward)
  @ApiPropertyOptional({ description: 'Array of departments', type: [String], example: ['Acting', 'Dancing'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  departments?: string[];

  @ApiPropertyOptional({ description: 'Application deadline', format: 'date-time', example: '2024-12-31T23:59:59Z' })
  @IsOptional()
  @IsDateString()
  deadline?: string;

  @ApiPropertyOptional({ description: 'Base64 encoded image', example: 'data:image/jpeg;base64,...' })
  @IsOptional()
  @IsString()
  image?: string; // base64 encoded image

  @ApiPropertyOptional({ description: 'Image caption', example: 'Project poster' })
  @IsOptional()
  @IsString()
  caption?: string;

  @ApiPropertyOptional({ description: 'Post status', enum: ['open', 'closed', 'in_progress', 'completed'], example: 'open' })
  @IsOptional()
  @IsEnum(['open', 'closed', 'in_progress', 'completed'])
  status?: string;
}

export class UpdatePostDto {
  @ApiPropertyOptional({ description: 'Post title' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Post description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Job requirements' })
  @IsOptional()
  @IsString()
  requirements?: string;

  @ApiPropertyOptional({ description: 'Job location' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ description: 'Department' })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional({ description: 'Array of departments', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  departments?: string[];

  @ApiPropertyOptional({ description: 'Application deadline', format: 'date-time' })
  @IsOptional()
  @IsDateString()
  deadline?: string;

  @ApiPropertyOptional({ description: 'Post status', enum: ['open', 'closed', 'in_progress', 'completed'] })
  @IsOptional()
  @IsEnum(['open', 'closed', 'in_progress', 'completed'])
  status?: string;
}

export class CreateCommentDto {
  @ApiProperty({ description: 'Comment content', example: 'Great opportunity!' })
  @IsNotEmpty()
  @IsString()
  content: string;
}

export class ApplyToProjectDto {
  @ApiPropertyOptional({ description: 'Cover letter', example: 'I am interested in this role...' })
  @IsOptional()
  @IsString()
  cover_letter?: string;

  @ApiPropertyOptional({ description: 'Portfolio link', example: 'https://myportfolio.com' })
  @IsOptional()
  @IsString()
  portfolio_link?: string;
}

export class UpdateApplicationStatusDto {
  @ApiProperty({ description: 'Application status', enum: ['pending', 'accepted', 'rejected', 'withdrawn'], example: 'accepted' })
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

