import { IsString, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SaveTokenDto {
  @ApiProperty({ description: 'Push notification token', example: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]' })
  @IsString()
  token: string;

  @ApiProperty({ description: 'Device platform', enum: ['ios', 'android'], example: 'android' })
  @IsString()
  @IsIn(['ios', 'android'])
  platform: 'ios' | 'android';

  @ApiPropertyOptional({ description: 'Device name', example: 'Pixel 6' })
  @IsOptional()
  @IsString()
  device_name?: string;

  @ApiPropertyOptional({ description: 'App version', example: '1.0.0' })
  @IsOptional()
  @IsString()
  app_version?: string;

  @ApiPropertyOptional({ description: 'OS version', example: 'Android 13' })
  @IsOptional()
  @IsString()
  os_version?: string;

  @ApiPropertyOptional({ description: 'Device timezone', example: 'Asia/Kolkata' })
  @IsOptional()
  @IsString()
  timezone?: string;
}