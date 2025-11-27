import { IsString, IsOptional, IsUUID } from 'class-validator';

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
  @IsString()
  companyName: string;

  @IsOptional()
  @IsString()
  companyPhone?: string;

  @IsOptional()
  @IsString()
  companyEmail?: string;

  @IsOptional()
  @IsString()
  companyLogo?: string;
}

export class UpgradePremiumDto {
  @IsString()
  planType: string; // 'monthly' | 'yearly'

  @IsOptional()
  @IsString()
  paymentId?: string;
}

export interface ListProfilesQuery {
  cursor?: string;
  limit?: number;
  role?: string;
}

