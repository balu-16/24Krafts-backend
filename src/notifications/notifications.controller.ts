import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SaveTokenDto } from './dto/save-token.dto';
import { RevokeTokenDto } from './dto/revoke-token.dto';
import { SendPushDto } from './dto/send.dto';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('save-token')
  async saveToken(@CurrentUser() user: any, @Body() dto: SaveTokenDto) {
    return this.notificationsService.saveToken(user.userId || user.id, dto);
  }

  @Post('revoke-token')
  async revokeToken(@CurrentUser() user: any, @Body() dto: RevokeTokenDto) {
    return this.notificationsService.revokeToken(user.userId || user.id, dto);
  }

  @Get('my-devices')
  async myDevices(@CurrentUser() user: any) {
    return this.notificationsService.listDevices(user.userId || user.id);
  }

  @Post('send')
  @UseGuards(RolesGuard)
  @Roles('admin', 'superadmin')
  async send(@Body() dto: SendPushDto) {
    return this.notificationsService.send(dto);
  }
}