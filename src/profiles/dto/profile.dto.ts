import { IsString, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  first_name?: string;

  @IsOptional()
  @IsString()
  last_name?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  alt_phone?: string;

  @IsOptional()
  @IsString()
  maa_associative_number?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsString()
  profile_photo_url?: string;

  @IsOptional()
  @IsUUID()
  company_id?: string;
}

export class BecomeRecruiterDto {
  @ApiProperty({ description: 'Company name', example: 'ABC Productions' })
  @IsString()
  companyName: string;

  @ApiPropertyOptional({ description: 'Company phone number', example: '022-12345678' })
  @IsOptional()
  @IsString()
  companyPhone?: string;

  @ApiPropertyOptional({ description: 'Company email', example: 'contact@abcproductions.com' })
  @IsOptional()
  @IsString()
  companyEmail?: string;

  @ApiPropertyOptional({ description: 'Company logo URL', example: 'https://example.com/logo.jpg' })
  @IsOptional()
  @IsString()
  companyLogo?: string;
}

export class UpgradePremiumDto {
  @ApiProperty({ description: 'Premium plan type', enum: ['monthly', 'yearly'], example: 'monthly' })
  @IsString()
  planType: string; // 'monthly' | 'yearly'

  @ApiPropertyOptional({ description: 'Payment transaction ID', example: 'pay_1234567890' })
  @IsOptional()
  @IsString()
  paymentId?: string;
}

export interface ListProfilesQuery {
  cursor?: string;
  limit?: number;
  role?: string;
}

