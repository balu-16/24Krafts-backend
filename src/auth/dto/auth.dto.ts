import { IsString, IsNotEmpty, Length, Matches, IsEmail, IsOptional, IsEnum, IsArray } from 'class-validator';

export class SendOtpDto {
  @IsString()
  @IsNotEmpty()
  phone: string;
}

export class VerifyOtpDto {
  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsNotEmpty()
  @Length(6, 6, { message: 'OTP must be 6 digits' })
  otp: string;
}

export class SignupDto {
  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsNotEmpty()
  @Length(6, 6, { message: 'OTP must be 6 digits' })
  otp: string;

  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsOptional()
  alternativePhone?: string;

  @IsString()
  @IsOptional()
  maaAssociativeNumber?: string;

  @IsString()
  @IsNotEmpty()
  @IsEnum(['Male', 'Female', 'Non-binary', 'Prefer not to say'])
  gender: string;

  @IsString()
  @IsNotEmpty()
  department: string;

  @IsString()
  @IsNotEmpty()
  state: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsString()
  @IsOptional()
  profilePhoto?: string;

  // Role: 'artist' or 'recruiter'
  @IsString()
  @IsNotEmpty()
  @IsEnum(['artist', 'recruiter'])
  role: string;

  // Recruiter-specific fields
  @IsString()
  @IsOptional()
  companyName?: string;

  @IsString()
  @IsOptional()
  companyPhone?: string;

  @IsString()
  @IsOptional()
  companyEmail?: string;

  @IsString()
  @IsOptional()
  companyLogo?: string;

  // Social links
  @IsString()
  @IsOptional()
  website?: string;

  @IsString()
  @IsOptional()
  facebook?: string;

  @IsString()
  @IsOptional()
  twitter?: string;

  @IsString()
  @IsOptional()
  instagram?: string;

  @IsString()
  @IsOptional()
  youtube?: string;

  @IsArray()
  @IsOptional()
  customLinks?: string[];

  // Aadhar number
  @IsString()
  @IsNotEmpty()
  @Length(16, 16, { message: 'Aadhar number must be 16 digits' })
  @Matches(/^\d{16}$/)
  aadharNumber: string;

  // Bio/description
  @IsString()
  @IsOptional()
  bio?: string;
}

