import { Module } from '@nestjs/common';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { PhotoModule } from '../photo/photo.module';

@Module({
  imports: [SupabaseModule, PhotoModule],
  controllers: [UploadsController],
  providers: [UploadsService],
  exports: [UploadsService],
})
export class UploadsModule {}
