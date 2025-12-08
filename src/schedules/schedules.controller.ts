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

@Controller('schedules')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Get()
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
  async getSchedule(@Param('id') id: string) {
    return this.schedulesService.getScheduleById(id);
  }

  @Post()
  @Roles('recruiter', 'admin')
  async createSchedule(
    @Body() createScheduleDto: CreateScheduleDto,
    @CurrentProfile() profile: any,
  ) {
    return this.schedulesService.createSchedule(profile?.profileId, createScheduleDto);
  }

  @Post(':id/members')
  @Roles('recruiter', 'admin')
  async addMember(
    @Param('id') scheduleId: string,
    @Body() addMemberDto: AddScheduleMemberDto,
  ) {
    return this.schedulesService.addMember(scheduleId, addMemberDto);
  }

  @Put(':scheduleId/members/:profileId/status')
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
  async getMembers(@Param('id') scheduleId: string) {
    return this.schedulesService.getScheduleMembers(scheduleId);
  }

  @Get('recruiter/projects')
  @Roles('recruiter', 'admin')
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

