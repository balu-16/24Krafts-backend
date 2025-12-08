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
import { FileInterceptor } from '@nestjs/platform-express';
import { PostsService } from './posts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentProfile } from '../auth/decorators/current-user.decorator';
import { CreatePostDto, UpdatePostDto, CreateCommentDto, ApplyToProjectDto, UpdateApplicationStatusDto } from './dto/post.dto';

@Controller('posts')
@UseGuards(JwtAuthGuard)
export class PostsController {
  private readonly logger = new Logger(PostsController.name);
  
  constructor(private readonly postsService: PostsService) {}

  @Get()
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
  async createPost(
    @Body() createPostDto: CreatePostDto,
    @CurrentProfile() profile: any,
  ) {
    return this.postsService.createPost(profile?.profileId, createPostDto, createPostDto.image);
  }

  @Put(':id')
  async updatePost(
    @Param('id') id: string,
    @Body() updatePostDto: UpdatePostDto,
    @CurrentProfile() profile: any,
  ) {
    return this.postsService.updatePost(id, profile?.profileId, updatePostDto);
  }

  @Delete(':id')
  async deletePost(
    @Param('id') id: string,
    @CurrentProfile() profile: any,
  ) {
    return this.postsService.deletePost(id, profile?.profileId);
  }

  @Post(':id/like')
  async toggleLike(@Param('id') postId: string, @CurrentProfile() profile: any) {
    return this.postsService.toggleLike(postId, profile?.profileId);
  }

  @Post(':id/comment')
  async addComment(
    @Param('id') postId: string,
    @Body() createCommentDto: CreateCommentDto,
    @CurrentProfile() profile: any,
  ) {
    return this.postsService.addComment(postId, profile?.profileId, createCommentDto.content);
  }

  @Get(':id/comments')
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
  async applyToProject(
    @Param('id') projectId: string,
    @Body() applyDto: ApplyToProjectDto,
    @CurrentProfile() profile: any,
  ) {
    this.logger.log(`🌐 POST /posts/${projectId}/apply - artistProfileId: ${profile?.profileId}`);
    return this.postsService.applyToProject(projectId, profile?.profileId, applyDto);
  }

  @Get(':id/applications')
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
  async checkApplicationStatus(
    @Param('id') projectId: string,
    @CurrentProfile() profile: any,
  ) {
    this.logger.log(`🌐 GET /posts/${projectId}/application-status - artistProfileId: ${profile?.profileId}`);
    return this.postsService.checkApplicationStatus(projectId, profile?.profileId);
  }

  @Put('applications/:applicationId/status')
  async updateApplicationStatus(
    @Param('applicationId') applicationId: string,
    @Body() updateDto: UpdateApplicationStatusDto,
    @CurrentProfile() profile: any,
  ) {
    return this.postsService.updateApplicationStatus(applicationId, profile?.profileId, updateDto);
  }

  @Delete('applications/:applicationId')
  async removeApplication(
    @Param('applicationId') applicationId: string,
    @CurrentProfile() profile: any,
  ) {
    // Check if user is recruiter
    const isRecruiter = profile?.role === 'recruiter';
    return this.postsService.removeApplication(applicationId, profile?.profileId, isRecruiter);
  }
}

