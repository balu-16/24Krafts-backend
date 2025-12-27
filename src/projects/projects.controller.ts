import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentProfile } from '../auth/decorators/current-user.decorator';
import { CreateProjectDto, AddProjectMemberDto } from './dto/project.dto';

@ApiTags('Projects')
@ApiBearerAuth('JWT-auth')
@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  @ApiOperation({ summary: 'List projects', description: 'Get paginated list of projects' })
  @ApiQuery({ name: 'cursor', required: false, description: 'Pagination cursor' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of results per page', example: 20 })
  @ApiQuery({ name: 'profileId', required: false, description: 'Filter by profile ID' })
  @ApiResponse({ status: 200, description: 'List of projects returned successfully' })
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
  @ApiOperation({ summary: 'Get project by ID', description: 'Get detailed project information' })
  @ApiParam({ name: 'id', description: 'Project UUID' })
  @ApiResponse({ status: 200, description: 'Project details returned successfully' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async getProject(@Param('id') id: string) {
    return this.projectsService.getProjectById(id);
  }

  @Post()
  @Roles('recruiter', 'admin')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Create project', description: 'Create a new project. Recruiters and admins only.' })
  @ApiResponse({ status: 201, description: 'Project created successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Recruiters and admins only' })
  async createProject(
    @Body() createProjectDto: CreateProjectDto,
    @CurrentProfile() profile: any,
  ) {
    return this.projectsService.createProject(profile?.profileId, createProjectDto);
  }

  @Post(':id/members')
  @Roles('recruiter', 'admin')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Add project member', description: 'Add a member to a project. Recruiters and admins only.' })
  @ApiParam({ name: 'id', description: 'Project UUID' })
  @ApiResponse({ status: 201, description: 'Member added successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Recruiters and admins only' })
  async addMember(
    @Param('id') projectId: string,
    @Body() addMemberDto: AddProjectMemberDto,
  ) {
    return this.projectsService.addMember(projectId, addMemberDto);
  }

  @Get(':id/members')
  @ApiOperation({ summary: 'Get project members', description: 'Get all members of a project' })
  @ApiParam({ name: 'id', description: 'Project UUID' })
  @ApiResponse({ status: 200, description: 'List of project members returned successfully' })
  async getMembers(@Param('id') projectId: string) {
    return this.projectsService.getProjectMembers(projectId);
  }
}

