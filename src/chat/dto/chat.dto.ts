import { IsString, IsOptional, IsNotEmpty, IsArray, IsBoolean, IsUUID } from 'class-validator';

export class CreateConversationDto {
  @IsOptional()
  @IsBoolean()
  is_group?: boolean;

  @IsOptional()
  @IsString()
  name?: string;

  @IsNotEmpty()
  @IsArray()
  @IsUUID('4', { each: true })
  member_ids: string[];
}

export class SendMessageDto {
  @IsNotEmpty()
  @IsString()
  content: string;

  @IsOptional()
  metadata?: any;

  @IsOptional()
  @IsString()
  client_msg_id?: string;
}

export class UpdateTypingDto {
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

