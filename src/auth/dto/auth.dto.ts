import { IsString, IsNotEmpty, Length, Matches, IsEmail, IsOptional, IsEnum, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SendOtpDto {
  @ApiProperty({
    description: 'Phone number to send OTP to',
    example: '9876543210',
  })
  @IsString()
  @IsNotEmpty()
  phone: string;
}

export class VerifyOtpDto {
  @ApiProperty({
    description: 'Phone number that received the OTP',
    example: '9876543210',
  })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({
    description: '6-digit OTP code',
    example: '123456',
    minLength: 6,
    maxLength: 6,
  })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6, { message: 'OTP must be 6 digits' })
  otp: string;
}

export class SignupDto {
  @ApiProperty({
    description: 'First name of the user',
    example: 'John',
  })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiPropertyOptional({
    description: 'Last name of the user',
    example: 'Doe',
  })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiProperty({
    description: 'Email address',
    example: 'john@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiPropertyOptional({
    description: 'Alternative phone number',
    example: '9876543211',
  })
  @IsString()
  @IsOptional()
  alternativePhone?: string;

  @ApiPropertyOptional({
    description: 'MAA Associative Number',
    example: 'MAA12345',
  })
  @IsString()
  @IsOptional()
  maaAssociativeNumber?: string;

  @ApiProperty({
    description: 'Gender of the user',
    example: 'Male',
    enum: ['Male', 'Female', 'Non-binary', 'Prefer not to say'],
  })
  @IsString()
  @IsNotEmpty()
  @IsEnum(['Male', 'Female', 'Non-binary', 'Prefer not to say'])
  gender: string;

  @ApiProperty({
    description: 'Department/Category of work',
    example: 'Acting',
  })
  @IsString()
  @IsNotEmpty()
  department: string;

  @ApiProperty({
    description: 'State of residence',
    example: 'Maharashtra',
  })
  @IsString()
  @IsNotEmpty()
  state: string;

  @ApiProperty({
    description: 'City of residence',
    example: 'Mumbai',
  })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiPropertyOptional({
    description: 'Profile photo URL or base64 encoded image',
    example: 'https://example.com/photo.jpg',
  })
  @IsString()
  @IsOptional()
  profilePhoto?: string;

  @ApiProperty({
    description: 'User role',
    example: 'artist',
    enum: ['artist', 'recruiter'],
  })
  @IsString()
  @IsNotEmpty()
  @IsEnum(['artist', 'recruiter'])
  role: string;

  @ApiPropertyOptional({
    description: 'Company name (for recruiters)',
    example: 'ABC Productions',
  })
  @IsString()
  @IsOptional()
  companyName?: string;

  @ApiPropertyOptional({
    description: 'Company phone number (for recruiters)',
    example: '022-12345678',
  })
  @IsString()
  @IsOptional()
  companyPhone?: string;

  @ApiPropertyOptional({
    description: 'Company email (for recruiters)',
    example: 'contact@abcproductions.com',
  })
  @IsString()
  @IsOptional()
  companyEmail?: string;

  @ApiPropertyOptional({
    description: 'Company logo URL (for recruiters)',
    example: 'https://example.com/logo.jpg',
  })
  @IsString()
  @IsOptional()
  companyLogo?: string;

  @ApiPropertyOptional({
    description: 'Personal/Company website URL',
    example: 'https://myportfolio.com',
  })
  @IsString()
  @IsOptional()
  website?: string;

  @ApiPropertyOptional({
    description: 'Facebook profile URL',
    example: 'https://facebook.com/johndoe',
  })
  @IsString()
  @IsOptional()
  facebook?: string;

  @ApiPropertyOptional({
    description: 'Twitter/X profile URL',
    example: 'https://twitter.com/johndoe',
  })
  @IsString()
  @IsOptional()
  twitter?: string;

  @ApiPropertyOptional({
    description: 'Instagram profile URL',
    example: 'https://instagram.com/johndoe',
  })
  @IsString()
  @IsOptional()
  instagram?: string;

  @ApiPropertyOptional({
    description: 'YouTube channel URL',
    example: 'https://youtube.com/@johndoe',
  })
  @IsString()
  @IsOptional()
  youtube?: string;

  @ApiPropertyOptional({
    description: 'Array of custom link URLs',
    example: ['https://imdb.com/name/johndoe', 'https://linkedin.com/in/johndoe'],
    type: [String],
  })
  @IsArray()
  @IsOptional()
  customLinks?: string[];

  @ApiProperty({
    description: 'Aadhar number (16 digits)',
    example: '1234567890123456',
    minLength: 16,
    maxLength: 16,
  })
  @IsString()
  @IsNotEmpty()
  @Length(16, 16, { message: 'Aadhar number must be 16 digits' })
  @Matches(/^\d{16}$/)
  aadharNumber: string;

  @ApiPropertyOptional({
    description: 'Bio or description about the user',
    example: 'Experienced actor with 10 years in the industry.',
  })
  @IsString()
  @IsOptional()
  bio?: string;
}

