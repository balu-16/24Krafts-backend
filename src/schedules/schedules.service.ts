import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import {
  CreateScheduleDto,
  AddScheduleMemberDto,
  ListSchedulesQuery,
} from './dto/schedule.dto';
import { encodeCursor, decodeCursor, PaginatedResponse } from '../utils/cursor.util';

@Injectable()
export class SchedulesService {
  constructor(private readonly supabaseService: SupabaseService) { }

  async listSchedules(query: ListSchedulesQuery): Promise<PaginatedResponse<any>> {
    const { cursor, limit = 20, profileId, projectId } = query;
    const supabase = this.supabaseService.getAdminClient();

    // If profileId is provided, get schedules they're assigned to
    if (profileId && !projectId) {
      // Get schedules where user is a member
      // First get the schedule IDs for this profile
      const { data: memberScheduleIds, error: memberIdsError } = await supabase
        .from('schedule_members')
        .select('schedule_id, status')
        .eq('profile_id', profileId);

      if (memberIdsError) {
        throw new BadRequestException(`Failed to fetch schedule members: ${memberIdsError.message}`);
      }

      if (!memberScheduleIds || memberScheduleIds.length === 0) {
        return { data: [], nextCursor: null };
      }

      const scheduleIds = memberScheduleIds.map(m => m.schedule_id);
      const statusMap = new Map(memberScheduleIds.map(m => [m.schedule_id, m.status]));

      // Now get the schedules
      let queryBuilder = supabase
        .from('schedules')
        .select(`
          *,
          profiles!created_by(id, first_name, last_name, profile_photo_url),
          projects(id, title)
        `)
        .in('id', scheduleIds)
        .order('date', { ascending: true })
        .limit(limit + 1);

      if (cursor) {
        const decoded = decodeCursor(cursor);
        if (decoded) {
          queryBuilder = queryBuilder.gt('date', decoded.timestamp);
        }
      }

      const { data: schedulesData, error: schedulesError } = await queryBuilder;

      if (schedulesError) {
        throw new BadRequestException(`Failed to fetch schedules: ${schedulesError.message}`);
      }

      const hasMore = schedulesData.length > limit;
      const schedules = hasMore ? schedulesData.slice(0, limit) : schedulesData;

      let nextCursor = null;
      if (hasMore && schedules.length > 0) {
        const lastSchedule = schedules[schedules.length - 1];
        if (lastSchedule && lastSchedule.date) {
          nextCursor = encodeCursor(lastSchedule.date, lastSchedule.id);
        }
      }

      return {
        data: schedules.map(schedule => ({
          ...schedule,
          member_status: statusMap.get(schedule.id) || 'pending'
        })),
        nextCursor,
      };
    }

    // Default query for recruiters or filtered by project
    let queryBuilder = supabase
      .from('schedules')
      .select(`
        *,
        profiles!created_by(id, first_name, last_name, profile_photo_url),
        projects(id, title)
      `)
      .order('date', { ascending: true })
      .limit(limit + 1);

    // Filter by project if provided
    if (projectId) {
      queryBuilder = queryBuilder.eq('project_id', projectId);
    }

    // Apply cursor if provided
    if (cursor) {
      const decoded = decodeCursor(cursor);
      if (decoded) {
        queryBuilder = queryBuilder.gt('date', decoded.timestamp);
      }
    }

    const { data, error } = await queryBuilder;

    if (error) {
      throw new BadRequestException(`Failed to fetch schedules: ${error.message}`);
    }

    const hasMore = data.length > limit;
    const schedules = hasMore ? data.slice(0, limit) : data;
    const nextCursor = hasMore
      ? encodeCursor(data[limit - 1].date, data[limit - 1].id)
      : null;

    return {
      data: schedules,
      nextCursor,
    };
  }

  async getScheduleById(id: string) {
    const supabase = this.supabaseService.getAdminClient();

    const { data, error } = await supabase
      .from('schedules')
      .select(`
        *,
        profiles!created_by(id, first_name, last_name, profile_photo_url),
        projects(id, title)
      `)
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new NotFoundException('Schedule not found');
    }

    return data;
  }

  async createSchedule(createdBy: string, createScheduleDto: CreateScheduleDto) {
    const supabase = this.supabaseService.getAdminClient();

    // Verify the project exists and belongs to the recruiter
    // Schedules reference the 'projects' table, not 'posts'
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('created_by')
      .eq('id', createScheduleDto.project_id)
      .single();

    if (projectError || !project) {
      throw new NotFoundException('Project not found');
    }

    if (project.created_by !== createdBy) {
      throw new BadRequestException('You can only create schedules for your own projects');
    }

    const { data, error } = await supabase
      .from('schedules')
      .insert({
        ...createScheduleDto,
        created_by: createdBy,
      })
      .select()
      .single();

    if (error) {
      throw new BadRequestException(`Failed to create schedule: ${error.message}`);
    }

    // Automatically add project members as schedule members
    // Note: project_applications references posts (project postings), not projects
    // So we add project_members instead, who are part of the actual project
    if (data) {
      await this.addProjectMembersToSchedule(data.id, createScheduleDto.project_id);
    }

    return data;
  }

  private async addProjectMembersToSchedule(scheduleId: string, projectId: string) {
    const supabase = this.supabaseService.getAdminClient();

    // Get all members of the project (from project_members table)
    // This is correct because project_members.project_id references projects.id
    const { data: projectMembers, error } = await supabase
      .from('project_members')
      .select('profile_id')
      .eq('project_id', projectId);

    if (error) {
      // Log error but don't fail schedule creation
      console.warn(`Failed to fetch project members for schedule: ${error.message}`);
      return;
    }

    if (projectMembers && projectMembers.length > 0) {
      const scheduleMembers = projectMembers.map(member => ({
        schedule_id: scheduleId,
        profile_id: member.profile_id,
        status: 'pending',
      }));

      const { error: insertError } = await supabase
        .from('schedule_members')
        .insert(scheduleMembers);

      if (insertError) {
        // Log error but don't fail schedule creation
        console.warn(`Failed to add project members to schedule: ${insertError.message}`);
      }
    }
  }

  async getRecruiterProjects(recruiterProfileId: string) {
    const supabase = this.supabaseService.getAdminClient();

    // Get projects from the 'projects' table, not 'posts'
    const { data, error } = await supabase
      .from('projects')
      .select('id, title, description, start_date, end_date, created_at')
      .eq('created_by', recruiterProfileId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new BadRequestException(`Failed to fetch recruiter projects: ${error.message}`);
    }

    return data || [];
  }

  async addMember(scheduleId: string, addMemberDto: AddScheduleMemberDto) {
    const supabase = this.supabaseService.getAdminClient();

    const { data, error } = await supabase
      .from('schedule_members')
      .insert({
        schedule_id: scheduleId,
        profile_id: addMemberDto.profile_id,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      throw new BadRequestException(`Failed to add schedule member: ${error.message}`);
    }

    return data;
  }

  async updateMemberStatus(
    scheduleId: string,
    profileId: string,
    status: string,
  ) {
    const supabase = this.supabaseService.getAdminClient();

    const { data, error } = await supabase
      .from('schedule_members')
      .update({ status })
      .eq('schedule_id', scheduleId)
      .eq('profile_id', profileId)
      .select()
      .single();

    if (error) {
      throw new BadRequestException(`Failed to update member status: ${error.message}`);
    }

    return data;
  }

  async getScheduleMembers(scheduleId: string) {
    const supabase = this.supabaseService.getAdminClient();

    const { data, error } = await supabase
      .from('schedule_members')
      .select(`
        *,
        profiles(
          id,
          first_name,
          last_name,
          profile_photo_url,
          role,
          artist_profiles(department),
          recruiter_profiles(department)
        )
      `)
      .eq('schedule_id', scheduleId);

    if (error) {
      throw new BadRequestException(`Failed to fetch schedule members: ${error.message}`);
    }

    // Flatten role-specific department into profiles.department for frontend compatibility
    const transformed = (data || []).map((m: any) => {
      const p = m.profiles;
      const artist = Array.isArray(p?.artist_profiles) ? (p.artist_profiles[0] || {}) : (p?.artist_profiles || {});
      const recruiter = Array.isArray(p?.recruiter_profiles) ? (p.recruiter_profiles[0] || {}) : (p?.recruiter_profiles || {});
      const department = artist?.department ?? recruiter?.department ?? null;

      return {
        ...m,
        profiles: {
          ...p,
          department,
          artist_profiles: undefined,
          recruiter_profiles: undefined,
        },
      };
    });

    return transformed;
  }
}

