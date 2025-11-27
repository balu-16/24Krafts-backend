import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { UploadsService } from './uploads.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentProfile } from '../auth/decorators/current-user.decorator';

@Controller('uploads')
@UseGuards(JwtAuthGuard)
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post()
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 uploads per minute
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @CurrentProfile() profile: any,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Validate file size (max 6MB)
    const maxSize = 6 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new BadRequestException('File size exceeds 6MB limit');
    }

    // Validate file type (images only for now)
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Invalid file type. Only images are allowed.');
    }

    const result = await this.uploadsService.uploadFile(file, profile.id);
    
    // Return public URL from Storage
    return {
      success: result.success,
      publicUrl: result.publicUrl,
      url: result.url,
    };
  }
}

