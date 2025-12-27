import { Module } from '@nestjs/common';
import { PhotoService } from './photo.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  providers: [PhotoService],
  exports: [PhotoService],
})
export class PhotoModule {}
