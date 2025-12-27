import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Admin')
@ApiBearerAuth('JWT-auth')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  @Get('stats')
  @Roles('admin', 'superadmin')
  @ApiOperation({ summary: 'Get admin stats', description: 'Get platform statistics. Admin and superadmin only.' })
  @ApiResponse({
    status: 200,
    description: 'Admin statistics returned successfully',
    schema: {
      example: {
        message: 'Admin stats accessible',
        user: {},
        metrics: {
          users: 1234,
          posts: 5678,
          projects: 42,
        },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin and superadmin only' })
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