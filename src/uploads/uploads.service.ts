import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { PhotoService } from '../photo/photo.service';
import sharp from 'sharp';

@Injectable()
export class UploadsService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly photoService: PhotoService,
  ) {}

  /**
   * Upload file to Supabase Storage
   * @deprecated Use PhotoService directly for better organization
   */
  async uploadFile(file: Express.Multer.File, userId: string) {
    // Upload using PhotoService
    const publicUrl = await this.photoService.uploadProfilePhoto(file, userId);

    return {
      success: true,
      publicUrl,
      url: publicUrl,
    };
  }

  /**
   * Process image and return base64 (for backward compatibility)
   * @deprecated Use PhotoService for direct uploads instead
   */
  async processImageToBase64(file: Express.Multer.File) {
    const processedBuffer = await sharp(file.buffer)
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();

    const base64Image = processedBuffer.toString('base64');

    return {
      success: true,
      image: base64Image,
      buffer: processedBuffer,
    };
  }
}

