import { Module } from '@nestjs/common';
import { ProfilesController } from './profiles.controller';
import { ProfilesService } from './profiles.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { PhotoModule } from '../photo/photo.module';

@Module({
  imports: [SupabaseModule, PhotoModule],
  controllers: [ProfilesController],
  providers: [ProfilesService],
  exports: [ProfilesService],
})
export class ProfilesModule {}

