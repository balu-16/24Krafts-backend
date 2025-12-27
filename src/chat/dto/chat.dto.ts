import { IsString, IsOptional, IsNotEmpty, IsArray, IsBoolean, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateConversationDto {
  @ApiPropertyOptional({ description: 'Whether this is a group conversation', example: false, default: false })
  @IsOptional()
  @IsBoolean()
  is_group?: boolean;

  @ApiPropertyOptional({ description: 'Group name (required for group conversations)', example: 'Project Team Chat' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ description: 'Array of profile UUIDs to include in conversation', type: [String], example: ['uuid1', 'uuid2'] })
  @IsNotEmpty()
  @IsArray()
  @IsUUID('4', { each: true })
  member_ids: string[];
}

export class SendMessageDto {
  @ApiProperty({ description: 'Message content', example: 'Hello!' })
  @IsNotEmpty()
  @IsString()
  content: string;

  @ApiPropertyOptional({ description: 'Additional metadata', type: 'object' })
  @IsOptional()
  metadata?: any;

  @ApiPropertyOptional({ description: 'Client message ID for deduplication', example: 'client-msg-123' })
  @IsOptional()
  @IsString()
  client_msg_id?: string;
}

export class UpdateTypingDto {
  @ApiProperty({ description: 'Whether user is currently typing', example: true })
  @IsNotEmpty()
  @IsBoolean()
  is_typing: boolean;
}

export interface ListConversationsQuery {
  profileId: string;
  cursor?: string;
  limit?: number;
}

export interface ListMessagesQuery {
  cursor?: string;
  limit?: number;
}

