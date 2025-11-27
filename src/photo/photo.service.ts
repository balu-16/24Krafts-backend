import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import sharp from 'sharp';

/**
 * Unified PhotoService for all image uploads across the application
 * Uses Supabase Storage with the 'photos' bucket
 * 
 * File path conventions:
 * - Profiles: profiles/{userId}/{timestamp}_{filename}
 * - Posts: posts/{postId}/{timestamp}_{filename}
 * - Projects: projects/{projectId}/{timestamp}_{filename}
 * - Chat: chats/{chatId}/{timestamp}_{filename}
 */
@Injectable()
export class PhotoService {
  private readonly logger = new Logger(PhotoService.name);
  private readonly BUCKET = 'photos';
  private readonly MAX_SIZE_MB = 6;
  private readonly MAX_SIZE_BYTES = this.MAX_SIZE_MB * 1024 * 1024;

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Upload a buffer to Supabase Storage
   * @param buffer - Image buffer
   * @param destPath - Destination path within the bucket (e.g., 'posts/123/image.jpg')
   * @param contentType - MIME type
   * @returns Public URL of the uploaded image
   */
  async uploadBufferToBucket(
    buffer: Buffer,
    destPath: string,
    contentType: string,
  ): Promise<string> {
    if (buffer.length > this.MAX_SIZE_BYTES) {
      throw new BadRequestException(
        `Image size exceeds ${this.MAX_SIZE_MB}MB limit`,
      );
    }

    const supabase = this.supabaseService.getAdminClient();

    this.logger.log(
      `📤 Uploading to bucket: ${this.BUCKET}/${destPath} (${(buffer.length / 1024).toFixed(2)} KB)`,
    );

    const { data, error } = await supabase.storage
      .from(this.BUCKET)
      .upload(destPath, buffer, {
        contentType,
        upsert: true,
      });

    if (error) {
      this.logger.error(`❌ Upload failed: ${error.message}`, error);
      throw new BadRequestException(`Failed to upload image: ${error.message}`);
    }

    const { data: publicData } = supabase.storage
      .from(this.BUCKET)
      .getPublicUrl(destPath);

    const publicUrl = publicData.publicUrl;
    this.logger.log(`✅ Upload successful: ${publicUrl}`);

    return publicUrl;
  }

  /**
   * Process and upload an image (resize, optimize, upload)
   * @param file - Multer file object
   * @param destPath - Destination path within the bucket
   * @returns Public URL of the uploaded image
   */
  async processAndUploadImage(
    file: Express.Multer.File,
    destPath: string,
  ): Promise<string> {
    // Validate file type
    const allowedMimes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
    ];
    if (!allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.',
      );
    }

    // Process image: resize and optimize
    const processedBuffer = await sharp(file.buffer)
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();

    return this.uploadBufferToBucket(
      processedBuffer,
      destPath,
      'image/jpeg',
    );
  }

  /**
   * Upload profile photo
   */
  async uploadProfilePhoto(
    file: Express.Multer.File,
    userId: string,
  ): Promise<string> {
    const timestamp = Date.now();
    const filename = `${timestamp}_${file.originalname}`;
    const destPath = `profiles/${userId}/${filename}`;
    return this.processAndUploadImage(file, destPath);
  }

  /**
   * Upload post image
   */
  async uploadPostImage(
    file: Express.Multer.File,
    postId: string,
  ): Promise<string> {
    const timestamp = Date.now();
    const filename = `${timestamp}_${file.originalname}`;
    const destPath = `posts/${postId}/${filename}`;
    return this.processAndUploadImage(file, destPath);
  }

  /**
   * Upload post image from base64 string
   */
  async uploadPostImageFromBase64(
    base64Data: string,
    postId: string,
  ): Promise<string> {
    try {
      // Remove data URI prefix if present
      const normalized = base64Data
        .trim()
        .replace(/^data:image\/[a-z]+;base64,/, '')
        .replace(/\s+/g, '');

      const buffer = Buffer.from(normalized, 'base64');

      // Process and optimize
      const processedBuffer = await sharp(buffer)
        .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();

      const timestamp = Date.now();
      const destPath = `posts/${postId}/${timestamp}.jpg`;

      return this.uploadBufferToBucket(processedBuffer, destPath, 'image/jpeg');
    } catch (error) {
      this.logger.error('Failed to process base64 image', error);
      throw new BadRequestException('Invalid base64 image data');
    }
  }

  /**
   * Upload project image
   */
  async uploadProjectImage(
    file: Express.Multer.File,
    projectId: string,
  ): Promise<string> {
    const timestamp = Date.now();
    const filename = `${timestamp}_${file.originalname}`;
    const destPath = `projects/${projectId}/${filename}`;
    return this.processAndUploadImage(file, destPath);
  }

  /**
   * Upload chat attachment
   */
  async uploadChatAttachment(
    file: Express.Multer.File,
    chatId: string,
  ): Promise<string> {
    const timestamp = Date.now();
    const filename = `${timestamp}_${file.originalname}`;
    const destPath = `chats/${chatId}/${filename}`;
    return this.processAndUploadImage(file, destPath);
  }

  /**
   * Upload artist profile picture
   */
  async uploadArtistProfilePic(
    file: Express.Multer.File,
    userId: string,
  ): Promise<string> {
    const timestamp = Date.now();
    const filename = `${timestamp}_${file.originalname}`;
    const destPath = `artist_profiles/${userId}/${filename}`;
    return this.processAndUploadImage(file, destPath);
  }

  /**
   * Upload recruiter profile picture
   */
  async uploadRecruiterProfilePic(
    file: Express.Multer.File,
    userId: string,
  ): Promise<string> {
    const timestamp = Date.now();
    const filename = `${timestamp}_${file.originalname}`;
    const destPath = `recruiter_profiles/${userId}/${filename}`;
    return this.processAndUploadImage(file, destPath);
  }

  /**
   * Upload profile picture from base64 (for artist)
   */
  async uploadArtistProfilePicFromBase64(
    base64Data: string,
    userId: string,
  ): Promise<string> {
    try {
      const normalized = base64Data
        .trim()
        .replace(/^data:image\/[a-z]+;base64,/, '')
        .replace(/\s+/g, '');

      const buffer = Buffer.from(normalized, 'base64');
      const processedBuffer = await sharp(buffer)
        .resize(400, 400, { fit: 'cover' })
        .jpeg({ quality: 90 })
        .toBuffer();

      const timestamp = Date.now();
      const destPath = `artist_profiles/${userId}/${timestamp}.jpg`;

      return this.uploadBufferToBucket(processedBuffer, destPath, 'image/jpeg');
    } catch (error) {
      this.logger.error('Failed to process base64 profile image', error);
      throw new BadRequestException('Invalid base64 image data');
    }
  }

  /**
   * Upload profile picture from base64 (for recruiter)
   */
  async uploadRecruiterProfilePicFromBase64(
    base64Data: string,
    userId: string,
  ): Promise<string> {
    try {
      const normalized = base64Data
        .trim()
        .replace(/^data:image\/[a-z]+;base64,/, '')
        .replace(/\s+/g, '');

      const buffer = Buffer.from(normalized, 'base64');
      const processedBuffer = await sharp(buffer)
        .resize(400, 400, { fit: 'cover' })
        .jpeg({ quality: 90 })
        .toBuffer();

      const timestamp = Date.now();
      const destPath = `recruiter_profiles/${userId}/${timestamp}.jpg`;

      return this.uploadBufferToBucket(processedBuffer, destPath, 'image/jpeg');
    } catch (error) {
      this.logger.error('Failed to process base64 profile image', error);
      throw new BadRequestException('Invalid base64 image data');
    }
  }

  /**
   * Delete an image from storage
   */
  async deleteImage(path: string): Promise<void> {
    const supabase = this.supabaseService.getAdminClient();

    const { error } = await supabase.storage.from(this.BUCKET).remove([path]);

    if (error) {
      this.logger.error(`Failed to delete image: ${path}`, error);
      throw new BadRequestException(`Failed to delete image: ${error.message}`);
    }

    this.logger.log(`🗑️  Deleted image: ${path}`);
  }
}
