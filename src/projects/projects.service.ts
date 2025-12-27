import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import {
  CreateProjectDto,
  AddProjectMemberDto,
  ListProjectsQuery,
} from './dto/project.dto';
import { encodeCursor, decodeCursor, PaginatedResponse } from '../utils/cursor.util';

// Type for project data from Supabase
export interface ProjectData {
  id: string;
  title: string;
  description?: string;
  poster_url?: string;
  start_date?: string;
  end_date?: string;
  created_by: string;
  created_at: string;
  profiles?: { id: string; first_name: string; last_name: string; profile_photo_url?: string };
}

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(private readonly supabaseService: SupabaseService) { }

  async listProjects(query: ListProjectsQuery): Promise<PaginatedResponse<ProjectData>> {
    const { cursor, limit = 20, profileId } = query;
    const supabase = this.supabaseService.getAdminClient();

    let queryBuilder = supabase
      .from('projects')
      .select(`
        *,
        profiles!created_by(id, first_name, last_name, profile_photo_url)
      `)
      .order('created_at', { ascending: false })
      .limit(limit + 1);

    // Filter by profile if provided (projects created by or member of)
    if (profileId) {
      // This will need a more complex query to include both created and member projects
      // For simplicity, we'll filter by created_by for now
      queryBuilder = queryBuilder.eq('created_by', profileId);
    }

    // Apply cursor if provided
    if (cursor) {
      const decoded = decodeCursor(cursor);
      if (decoded) {
        queryBuilder = queryBuilder.lt('created_at', decoded.timestamp);
      }
    }

    const { data, error } = await queryBuilder;

    if (error) {
      throw new Error('Failed to fetch projects');
    }

    const hasMore = data.length > limit;
    // poster_url is a text column, so no normalization needed - it's already a URL string
    const projectsRaw = hasMore ? data.slice(0, limit) : data;
    const projects = projectsRaw;
    const nextCursor = hasMore
      ? encodeCursor(data[limit - 1].created_at, data[limit - 1].id)
      : null;

    return {
      data: projects,
      nextCursor,
    };
  }

  async getProjectById(id: string) {
    const supabase = this.supabaseService.getAdminClient();

    const { data, error } = await supabase
      .from('projects')
      .select(`
        *,
        profiles!created_by(id, first_name, last_name, profile_photo_url)
      `)
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new NotFoundException('Project not found');
    }

    // poster_url is a text column (URL string), no normalization needed
    return data;
  }

  async createProject(createdBy: string, createProjectDto: CreateProjectDto) {
    const supabase = this.supabaseService.getAdminClient();

    // Map DTO fields to database schema
    // Database has: title, description, poster_url (not image), start_date, end_date, created_by
    const { image, ...rest } = createProjectDto;

    const insertData: any = {
      title: rest.title, // Database uses 'title' directly
      description: rest.description,
      created_by: createdBy,
    };

    // Map 'image' from DTO to 'poster_url' in database (text column, not bytea)
    if (image) {
      // If it's a data URI, keep it as is. If it's a URL, use it directly.
      // The database column is 'poster_url' (text), so we store it as a string
      insertData.poster_url = image;
    }

    // Add optional date fields if provided
    if (rest.start_date) {
      insertData.start_date = rest.start_date;
    }
    if (rest.end_date) {
      insertData.end_date = rest.end_date;
    }

    const { data, error } = await supabase
      .from('projects')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      this.logger.error('Project creation error:', error);
      throw new BadRequestException(`Failed to create project: ${error.message || 'Unknown error'}`);
    }

    return data;
  }

  async addMember(projectId: string, addMemberDto: AddProjectMemberDto) {
    const supabase = this.supabaseService.getAdminClient();

    const { data, error } = await supabase
      .from('project_members')
      .insert({
        project_id: projectId,
        profile_id: addMemberDto.profile_id,
        role_in_project: addMemberDto.role_in_project,
      })
      .select()
      .single();

    if (error) {
      throw new Error('Failed to add project member');
    }

    return data;
  }

  async getProjectMembers(projectId: string) {
    const supabase = this.supabaseService.getAdminClient();

    const { data, error } = await supabase
      .from('project_members')
      .select(`
        *,
        profiles(id, first_name, last_name, profile_photo_url, department)
      `)
      .eq('project_id', projectId);

    if (error) {
      throw new Error('Failed to fetch project members');
    }

    return data;
  }
}

