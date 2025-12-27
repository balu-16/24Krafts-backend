import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { PostsService } from './posts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentProfile } from '../auth/decorators/current-user.decorator';
import { CreatePostDto, UpdatePostDto, CreateCommentDto, ApplyToProjectDto, UpdateApplicationStatusDto } from './dto/post.dto';

@ApiTags('Posts')
@ApiBearerAuth('JWT-auth')
@Controller('posts')
@UseGuards(JwtAuthGuard)
export class PostsController {
  private readonly logger = new Logger(PostsController.name);
  
  constructor(private readonly postsService: PostsService) {}

  @Get()
  @ApiOperation({ summary: 'List posts', description: 'Get paginated list of posts/projects with optional filtering' })
  @ApiQuery({ name: 'cursor', required: false, description: 'Pagination cursor' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of results per page', example: 20 })
  @ApiQuery({ name: 'profileId', required: false, description: 'Filter by author profile ID' })
  @ApiQuery({ name: 'role', required: false, description: 'Filter by role' })
  @ApiQuery({ name: 'department', required: false, description: 'Filter by department' })
  @ApiResponse({ status: 200, description: 'List of posts returned successfully' })
  async listPosts(
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('profileId') profileId?: string,
    @Query('role') role?: string,
    @Query('department') department?: string,
  ) {
    this.logger.log(`🌐 GET /posts - cursor: ${cursor || 'none'}, limit: ${limit || '20'}, profileId: ${profileId || 'none'}, role: ${role || 'none'}, department: ${department || 'none'}`);
    return this.postsService.listPosts({
      cursor,
      limit: limit ? parseInt(limit, 10) : 20,
      profileId,
      role,
      department,
    });
  }

  // Specific routes MUST come before dynamic :id routes
  @Get('applications/my-applications')
  @ApiOperation({ summary: 'Get my applications', description: 'Get all project applications submitted by the current user' })
  @ApiQuery({ name: 'cursor', required: false, description: 'Pagination cursor' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of results per page', example: 20 })
  @ApiQuery({ name: 'status', required: false, enum: ['pending', 'accepted', 'rejected', 'withdrawn'], description: 'Filter by application status' })
  @ApiResponse({ status: 200, description: 'List of applications returned successfully' })
  async getMyApplications(
    @CurrentProfile() profile: any,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    this.logger.log(`🌐 GET /posts/applications/my-applications - profileId: ${profile?.profileId}, status: ${status || 'all'}`);
    return this.postsService.listApplications({
      artistProfileId: profile?.profileId,
      cursor,
      limit: limit ? parseInt(limit, 10) : 20,
      status,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get post by ID', description: 'Get detailed post/project information' })
  @ApiParam({ name: 'id', description: 'Post UUID' })
  @ApiResponse({ status: 200, description: 'Post details returned successfully' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  async getPost(@Param('id') id: string) {
    this.logger.log(`========================================`);
    this.logger.log(`🌐 GET /posts/${id} - Fetching post details`);
    this.logger.log(`📊 Param ID: ${id}, type: ${typeof id}, length: ${id?.length}`);
    this.logger.log(`========================================`);
    
    try {
      const result = await this.postsService.getPostById(id);
      this.logger.log(`✅ Post found and returned successfully`);
      return result;
    } catch (error) {
      this.logger.error(`❌ Error in getPost controller:`, error);
      throw error;
    }
  }

  @Post()
  @ApiOperation({ summary: 'Create post', description: 'Create a new post or project listing' })
  @ApiResponse({ status: 201, description: 'Post created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - Validation error' })
  async createPost(
    @Body() createPostDto: CreatePostDto,
    @CurrentProfile() profile: any,
  ) {
    return this.postsService.createPost(profile?.profileId, createPostDto, createPostDto.image);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update post', description: 'Update your own post' })
  @ApiParam({ name: 'id', description: 'Post UUID' })
  @ApiResponse({ status: 200, description: 'Post updated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Cannot update other user\'s post' })
  async updatePost(
    @Param('id') id: string,
    @Body() updatePostDto: UpdatePostDto,
    @CurrentProfile() profile: any,
  ) {
    return this.postsService.updatePost(id, profile?.profileId, updatePostDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete post', description: 'Delete your own post' })
  @ApiParam({ name: 'id', description: 'Post UUID' })
  @ApiResponse({ status: 200, description: 'Post deleted successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Cannot delete other user\'s post' })
  async deletePost(
    @Param('id') id: string,
    @CurrentProfile() profile: any,
  ) {
    return this.postsService.deletePost(id, profile?.profileId);
  }

  @Post(':id/like')
  @ApiOperation({ summary: 'Toggle like', description: 'Like or unlike a post' })
  @ApiParam({ name: 'id', description: 'Post UUID' })
  @ApiResponse({ status: 200, description: 'Like toggled successfully' })
  async toggleLike(@Param('id') postId: string, @CurrentProfile() profile: any) {
    return this.postsService.toggleLike(postId, profile?.profileId);
  }

  @Post(':id/comment')
  @ApiOperation({ summary: 'Add comment', description: 'Add a comment to a post' })
  @ApiParam({ name: 'id', description: 'Post UUID' })
  @ApiResponse({ status: 201, description: 'Comment added successfully' })
  async addComment(
    @Param('id') postId: string,
    @Body() createCommentDto: CreateCommentDto,
    @CurrentProfile() profile: any,
  ) {
    return this.postsService.addComment(postId, profile?.profileId, createCommentDto.content);
  }

  @Get(':id/comments')
  @ApiOperation({ summary: 'Get comments', description: 'Get all comments on a post' })
  @ApiParam({ name: 'id', description: 'Post UUID' })
  @ApiQuery({ name: 'cursor', required: false, description: 'Pagination cursor' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of results per page', example: 20 })
  @ApiResponse({ status: 200, description: 'List of comments returned successfully' })
  async getComments(
    @Param('id') postId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.postsService.getComments(postId, {
      cursor,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  // Project Application Endpoints

  @Post(':id/apply')
  @ApiOperation({ summary: 'Apply to project', description: 'Submit an application to a project posting' })
  @ApiParam({ name: 'id', description: 'Project post UUID' })
  @ApiResponse({ status: 201, description: 'Application submitted successfully' })
  async applyToProject(
    @Param('id') projectId: string,
    @Body() applyDto: ApplyToProjectDto,
    @CurrentProfile() profile: any,
  ) {
    this.logger.log(`🌐 POST /posts/${projectId}/apply - artistProfileId: ${profile?.profileId}`);
    return this.postsService.applyToProject(projectId, profile?.profileId, applyDto);
  }

  @Get(':id/applications')
  @ApiOperation({ summary: 'Get project applications', description: 'Get all applications for a project (recruiter view)' })
  @ApiParam({ name: 'id', description: 'Project post UUID' })
  @ApiQuery({ name: 'cursor', required: false, description: 'Pagination cursor' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of results per page', example: 20 })
  @ApiQuery({ name: 'status', required: false, enum: ['pending', 'accepted', 'rejected', 'withdrawn'], description: 'Filter by application status' })
  @ApiResponse({ status: 200, description: 'List of applications returned successfully' })
  async getProjectApplications(
    @Param('id') projectId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    this.logger.log(`🌐 GET /posts/${projectId}/applications - status: ${status || 'all'}`);
    return this.postsService.listApplications({
      projectId,
      cursor,
      limit: limit ? parseInt(limit, 10) : 20,
      status,
    });
  }

  @Get(':id/application-status')
  @ApiOperation({ summary: 'Check application status', description: 'Check if you have applied to this project and get application status' })
  @ApiParam({ name: 'id', description: 'Project post UUID' })
  @ApiResponse({ status: 200, description: 'Application status returned successfully' })
  async checkApplicationStatus(
    @Param('id') projectId: string,
    @CurrentProfile() profile: any,
  ) {
    this.logger.log(`🌐 GET /posts/${projectId}/application-status - artistProfileId: ${profile?.profileId}`);
    return this.postsService.checkApplicationStatus(projectId, profile?.profileId);
  }

  @Put('applications/:applicationId/status')
  @ApiOperation({ summary: 'Update application status', description: 'Accept or reject an application (recruiter only)' })
  @ApiParam({ name: 'applicationId', description: 'Application UUID' })
  @ApiResponse({ status: 200, description: 'Application status updated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Recruiters only' })
  async updateApplicationStatus(
    @Param('applicationId') applicationId: string,
    @Body() updateDto: UpdateApplicationStatusDto,
    @CurrentProfile() profile: any,
  ) {
    return this.postsService.updateApplicationStatus(applicationId, profile?.profileId, updateDto);
  }

  @Delete('applications/:applicationId')
  @ApiOperation({ summary: 'Remove application', description: 'Withdraw your application or remove as recruiter' })
  @ApiParam({ name: 'applicationId', description: 'Application UUID' })
  @ApiResponse({ status: 200, description: 'Application removed successfully' })
  async removeApplication(
    @Param('applicationId') applicationId: string,
    @CurrentProfile() profile: any,
  ) {
    // Check if user is recruiter
    const isRecruiter = profile?.role === 'recruiter';
    return this.postsService.removeApplication(applicationId, profile?.profileId, isRecruiter);
  }
}

