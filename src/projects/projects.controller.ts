import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentProfile } from '../auth/decorators/current-user.decorator';
import { CreateProjectDto, AddProjectMemberDto } from './dto/project.dto';

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  async listProjects(
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('profileId') profileId?: string,
  ) {
    return this.projectsService.listProjects({
      cursor,
      limit: limit ? parseInt(limit, 10) : 20,
      profileId,
    });
  }

  @Get(':id')
  async getProject(@Param('id') id: string) {
    return this.projectsService.getProjectById(id);
  }

  @Post()
  @Roles('recruiter', 'admin')
  @UseGuards(RolesGuard)
  async createProject(
    @Body() createProjectDto: CreateProjectDto,
    @CurrentProfile() profile: any,
  ) {
    return this.projectsService.createProject(profile?.profileId, createProjectDto);
  }

  @Post(':id/members')
  @Roles('recruiter', 'admin')
  @UseGuards(RolesGuard)
  async addMember(
    @Param('id') projectId: string,
    @Body() addMemberDto: AddProjectMemberDto,
  ) {
    return this.projectsService.addMember(projectId, addMemberDto);
  }

  @Get(':id/members')
  async getMembers(@Param('id') projectId: string) {
    return this.projectsService.getProjectMembers(projectId);
  }
}

