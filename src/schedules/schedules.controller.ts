import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { SchedulesService } from './schedules.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentProfile } from '../auth/decorators/current-user.decorator';
import {
  CreateScheduleDto,
  AddScheduleMemberDto,
  UpdateScheduleMemberStatusDto,
} from './dto/schedule.dto';

@ApiTags('Schedules')
@ApiBearerAuth('JWT-auth')
@Controller('schedules')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Get()
  @ApiOperation({ summary: 'List schedules', description: 'Get paginated list of schedules with optional filtering' })
  @ApiQuery({ name: 'cursor', required: false, description: 'Pagination cursor' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of results per page', example: 20 })
  @ApiQuery({ name: 'profileId', required: false, description: 'Filter by profile ID' })
  @ApiQuery({ name: 'projectId', required: false, description: 'Filter by project ID' })
  @ApiResponse({ status: 200, description: 'List of schedules returned successfully' })
  async listSchedules(
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('profileId') profileId?: string,
    @Query('projectId') projectId?: string,
  ) {
    return this.schedulesService.listSchedules({
      cursor,
      limit: limit ? parseInt(limit, 10) : 20,
      profileId,
      projectId,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get schedule by ID', description: 'Get detailed schedule information' })
  @ApiParam({ name: 'id', description: 'Schedule UUID' })
  @ApiResponse({ status: 200, description: 'Schedule details returned successfully' })
  @ApiResponse({ status: 404, description: 'Schedule not found' })
  async getSchedule(@Param('id') id: string) {
    return this.schedulesService.getScheduleById(id);
  }

  @Post()
  @Roles('recruiter', 'admin')
  @ApiOperation({ summary: 'Create schedule', description: 'Create a new schedule for a project. Recruiters and admins only.' })
  @ApiResponse({ status: 201, description: 'Schedule created successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Recruiters and admins only' })
  async createSchedule(
    @Body() createScheduleDto: CreateScheduleDto,
    @CurrentProfile() profile: any,
  ) {
    return this.schedulesService.createSchedule(profile?.profileId, createScheduleDto);
  }

  @Post(':id/members')
  @Roles('recruiter', 'admin')
  @ApiOperation({ summary: 'Add schedule member', description: 'Add a member to a schedule. Recruiters and admins only.' })
  @ApiParam({ name: 'id', description: 'Schedule UUID' })
  @ApiResponse({ status: 201, description: 'Member added successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Recruiters and admins only' })
  async addMember(
    @Param('id') scheduleId: string,
    @Body() addMemberDto: AddScheduleMemberDto,
  ) {
    return this.schedulesService.addMember(scheduleId, addMemberDto);
  }

  @Put(':scheduleId/members/:profileId/status')
  @ApiOperation({ summary: 'Update member status', description: 'Update your own status for a schedule (accept/decline)' })
  @ApiParam({ name: 'scheduleId', description: 'Schedule UUID' })
  @ApiParam({ name: 'profileId', description: 'Profile UUID' })
  @ApiResponse({ status: 200, description: 'Status updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Cannot update other user\'s status' })
  async updateMemberStatus(
    @Param('scheduleId') scheduleId: string,
    @Param('profileId') profileId: string,
    @Body() updateStatusDto: UpdateScheduleMemberStatusDto,
    @CurrentProfile() currentProfile: any,
  ) {
    // Ensure user can only update their own status
    if (currentProfile?.profileId !== profileId) {
      throw new Error('Unauthorized');
    }
    return this.schedulesService.updateMemberStatus(
      scheduleId,
      profileId,
      updateStatusDto.status,
    );
  }

  @Get(':id/members')
  @ApiOperation({ summary: 'Get schedule members', description: 'List all members of a schedule' })
  @ApiParam({ name: 'id', description: 'Schedule UUID' })
  @ApiResponse({ status: 200, description: 'List of members returned successfully' })
  async getMembers(@Param('id') scheduleId: string) {
    return this.schedulesService.getScheduleMembers(scheduleId);
  }

  @Get('recruiter/projects')
  @Roles('recruiter', 'admin')
  @ApiOperation({ summary: 'Get recruiter projects', description: 'Get projects owned by the current recruiter. Recruiters and admins only.' })
  @ApiResponse({ status: 200, description: 'List of projects returned successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Recruiters and admins only' })
  async getRecruiterProjects(@CurrentProfile() profile: any) {
    // RolesGuard already checks role, so if we reach here, user is recruiter/admin
    if (!profile) {
      throw new ForbiddenException('Profile not found');
    }
    // The CurrentProfile decorator returns request.user which has profileId
    const profileId = profile?.profileId;
    if (!profileId) {
      throw new ForbiddenException('Profile ID not found');
    }
    // This will only return projects where author_profile_id matches the recruiter's profile ID
    return this.schedulesService.getRecruiterProjects(profileId);
  }
}

