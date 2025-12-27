import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RevokeTokenDto {
  @ApiProperty({ description: 'Push notification token to revoke', example: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]' })
  @IsString()
  token: string;
}