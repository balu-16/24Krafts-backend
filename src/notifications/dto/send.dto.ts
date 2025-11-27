import { IsArray, IsOptional, IsString, ArrayNotEmpty, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class MessageDataDto {
  @IsOptional()
  @IsString()
  route?: string;

  @IsOptional()
  @IsString()
  id?: string;
}

export class SendPushDto {
  @IsArray()
  @ArrayNotEmpty()
  tokens: string[];

  @IsString()
  title: string;

  @IsString()
  body: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => MessageDataDto)
  data?: MessageDataDto;
}