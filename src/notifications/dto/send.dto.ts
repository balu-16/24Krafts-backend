import { IsArray, IsOptional, IsString, ArrayNotEmpty, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class MessageDataDto {
  @ApiPropertyOptional({ description: 'Navigation route', example: '/posts/123' })
  @IsOptional()
  @IsString()
  route?: string;

  @ApiPropertyOptional({ description: 'Resource ID', example: 'uuid-here' })
  @IsOptional()
  @IsString()
  id?: string;
}

export class SendPushDto {
  @ApiProperty({ description: 'Array of push notification tokens', type: [String], example: ['token1', 'token2'] })
  @IsArray()
  @ArrayNotEmpty()
  tokens: string[];

  @ApiProperty({ description: 'Notification title', example: 'New Project Available' })
  @IsString()
  title: string;

  @ApiProperty({ description: 'Notification body', example: 'A new project has been posted' })
  @IsString()
  body: string;

  @ApiPropertyOptional({ description: 'Additional data payload', type: MessageDataDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => MessageDataDto)
  data?: MessageDataDto;
}