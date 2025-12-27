import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  @Get('stats')
  @Roles('admin', 'superadmin')
  getAdminStats(@CurrentUser() user: any) {
    // Example protected payload; replace with real logic as needed
    return {
      message: 'Admin stats accessible',
      user,
      metrics: {
        users: 1234,
        posts: 5678,
        projects: 42,
      },
    };
  }
}