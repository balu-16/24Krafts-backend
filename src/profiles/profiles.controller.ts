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
import { ProfilesService } from './profiles.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UpdateProfileDto, BecomeRecruiterDto, UpgradePremiumDto } from './dto/profile.dto';

@Controller('profiles')
@UseGuards(JwtAuthGuard)
export class ProfilesController {
  private readonly logger = new Logger(ProfilesController.name);
  
  constructor(private readonly profilesService: ProfilesService) {}

  @Get()
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
  async getProfile(@Param('id') id: string) {
    this.logger.log(`🌐 GET /profiles/${id}`);
    return this.profilesService.getProfileById(id);
  }

  @Put(':id')
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

