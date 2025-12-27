import {
  Controller,
  Get,
  Put,
  Post,
  Param,
  Body,
  UseGuards,
  Query,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { ProfilesService } from './profiles.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UpdateProfileDto, BecomeRecruiterDto, UpgradePremiumDto } from './dto/profile.dto';

@ApiTags('Profiles')
@ApiBearerAuth('JWT-auth')
@Controller('profiles')
@UseGuards(JwtAuthGuard)
export class ProfilesController {
  private readonly logger = new Logger(ProfilesController.name);
  
  constructor(private readonly profilesService: ProfilesService) {}

  @Get()
  @ApiOperation({ summary: 'List all profiles', description: 'Get paginated list of user profiles with optional filtering by role' })
  @ApiQuery({ name: 'cursor', required: false, description: 'Pagination cursor' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of results per page', example: 20 })
  @ApiQuery({ name: 'role', required: false, enum: ['artist', 'recruiter'], description: 'Filter by user role' })
  @ApiResponse({ status: 200, description: 'List of profiles returned successfully' })
  async listProfiles(
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('role') role?: string,
  ) {
    this.logger.log(`🌐 GET /profiles - role: ${role || 'all'}, limit: ${limit || '20'}`);
    return this.profilesService.listProfiles({
      cursor,
      limit: limit ? parseInt(limit, 10) : 20,
      role,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get profile by ID', description: 'Get detailed profile information by profile ID' })
  @ApiParam({ name: 'id', description: 'Profile UUID' })
  @ApiResponse({ status: 200, description: 'Profile details returned successfully' })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  async getProfile(@Param('id') id: string) {
    this.logger.log(`🌐 GET /profiles/${id}`);
    return this.profilesService.getProfileById(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update profile', description: 'Update your own profile. You can only update your own profile.' })
  @ApiParam({ name: 'id', description: 'Profile UUID' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Cannot update other user\'s profile' })
  async updateProfile(
    @Param('id') id: string,
    @Body() updateProfileDto: UpdateProfileDto,
    @CurrentUser() currentUser: any,
  ) {
    this.logger.log(`🌐 PUT /profiles/${id} - currentUser.profileId: ${currentUser?.profileId}`);
    // Ensure user can only update their own profile
    if (!currentUser || !currentUser.profileId) {
      this.logger.warn(`⚠️  Unauthorized update attempt: no currentUser or profileId`);
      throw new UnauthorizedException('Authentication required');
    }
    if (currentUser.profileId !== id) {
      this.logger.warn(`⚠️  User ${currentUser.profileId} tried to update profile ${id}`);
      throw new UnauthorizedException('You can only update your own profile');
    }
    this.logger.log(`✅ Authorization passed, proceeding with update`);
    return this.profilesService.updateProfile(id, updateProfileDto);
  }

  @Post(':id/become-recruiter')
  @ApiOperation({ summary: 'Become a recruiter', description: 'Upgrade from artist to recruiter role. Requires company details.' })
  @ApiParam({ name: 'id', description: 'Profile UUID' })
  @ApiResponse({ status: 200, description: 'Successfully upgraded to recruiter' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Cannot upgrade other user\'s profile' })
  async becomeRecruiter(
    @Param('id') id: string,
    @Body() becomeRecruiterDto: BecomeRecruiterDto,
    @CurrentUser() currentUser: any,
  ) {
    // Ensure user can only upgrade their own profile
    if (!currentUser || currentUser.profileId !== id) {
      throw new UnauthorizedException('You can only upgrade your own profile');
    }
    return this.profilesService.becomeRecruiter(id, becomeRecruiterDto);
  }

  @Post(':id/upgrade-premium')
  @ApiOperation({ summary: 'Upgrade to premium', description: 'Upgrade account to premium subscription' })
  @ApiParam({ name: 'id', description: 'Profile UUID' })
  @ApiResponse({ status: 200, description: 'Successfully upgraded to premium' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Cannot upgrade other user\'s profile' })
  async upgradePremium(
    @Param('id') id: string,
    @Body() upgradePremiumDto: UpgradePremiumDto,
    @CurrentUser() currentUser: any,
  ) {
    // Ensure user can only upgrade their own profile
    if (!currentUser || currentUser.profileId !== id) {
      throw new UnauthorizedException('You can only upgrade your own profile');
    }
    return this.profilesService.upgradePremium(id, upgradePremiumDto);
  }
}

