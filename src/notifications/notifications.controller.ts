import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SaveTokenDto } from './dto/save-token.dto';
import { RevokeTokenDto } from './dto/revoke-token.dto';
import { SendPushDto } from './dto/send.dto';

@ApiTags('Notifications')
@ApiBearerAuth('JWT-auth')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('save-token')
  @ApiOperation({ summary: 'Save push token', description: 'Register device for push notifications' })
  @ApiResponse({ status: 200, description: 'Token saved successfully' })
  async saveToken(@CurrentUser() user: any, @Body() dto: SaveTokenDto) {
    return this.notificationsService.saveToken(user.userId || user.id, dto);
  }

  @Post('revoke-token')
  @ApiOperation({ summary: 'Revoke push token', description: 'Unregister device from push notifications' })
  @ApiResponse({ status: 200, description: 'Token revoked successfully' })
  async revokeToken(@CurrentUser() user: any, @Body() dto: RevokeTokenDto) {
    return this.notificationsService.revokeToken(user.userId || user.id, dto);
  }

  @Get('my-devices')
  @ApiOperation({ summary: 'List my devices', description: 'Get all registered devices for push notifications' })
  @ApiResponse({ status: 200, description: 'List of devices returned successfully' })
  async myDevices(@CurrentUser() user: any) {
    return this.notificationsService.listDevices(user.userId || user.id);
  }

  @Post('send')
  @UseGuards(RolesGuard)
  @Roles('admin', 'superadmin')
  @ApiOperation({ summary: 'Send push notification', description: 'Send push notification to devices. Admin and superadmin only.' })
  @ApiResponse({ status: 200, description: 'Notification sent successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin and superadmin only' })
  async send(@Body() dto: SendPushDto) {
    return this.notificationsService.send(dto);
  }
}