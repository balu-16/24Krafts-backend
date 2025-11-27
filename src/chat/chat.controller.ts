import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Headers,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentProfile } from '../auth/decorators/current-user.decorator';
import {
  CreateConversationDto,
  SendMessageDto,
  UpdateTypingDto,
} from './dto/chat.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  // Conversations
  @Get('conversations')
  async listConversations(
    @Query('profileId') profileId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Headers('authorization') authHeader?: string,
  ) {
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.substring('Bearer '.length)
      : undefined;
    return this.chatService.listConversations(
      {
        profileId,
        cursor,
        limit: limit ? parseInt(limit, 10) : 20,
      },
      token,
    );
  }

  @Get('conversations/:id')
  async getConversation(@Param('id') id: string, @Headers('authorization') authHeader?: string) {
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.substring('Bearer '.length)
      : undefined;
    return this.chatService.getConversationById(id, token);
  }

  @Post('conversations')
  async createConversation(
    @Body() createConversationDto: CreateConversationDto,
    @CurrentProfile() profile: any,
    @Headers('authorization') authHeader?: string,
  ) {
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.substring('Bearer '.length)
      : undefined;
    return this.chatService.createConversation(profile?.profileId, createConversationDto, token);
  }

  // Messages
  @Get('conversations/:id/messages')
  async getMessages(
    @Param('id') conversationId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Headers('authorization') authHeader?: string,
  ) {
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.substring('Bearer '.length)
      : undefined;
    return this.chatService.getMessages(
      conversationId,
      {
        cursor,
        limit: limit ? parseInt(limit, 10) : 40,
      },
      token,
    );
  }

  @Post('conversations/:id/messages')
  @Throttle({ default: { limit: 10, ttl: 1000 } }) // 10 messages per second
  async sendMessage(
    @Param('id') conversationId: string,
    @Body() sendMessageDto: SendMessageDto,
    @CurrentProfile() profile: any,
  ) {
    return this.chatService.sendMessage(conversationId, profile?.profileId, sendMessageDto);
  }

  // Typing indicator
  @Post('conversations/:id/typing')
  async updateTyping(
    @Param('id') conversationId: string,
    @Body() updateTypingDto: UpdateTypingDto,
    @CurrentProfile() profile: any,
    @Headers('authorization') authHeader?: string,
  ) {
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.substring('Bearer '.length)
      : undefined;
    return this.chatService.updateTyping(
      conversationId,
      profile?.profileId,
      updateTypingDto.is_typing,
      token,
    );
  }

  // Presence
  @Post('conversations/:id/presence')
  async updatePresence(
    @Param('id') conversationId: string,
    @CurrentProfile() profile: any,
    @Headers('authorization') authHeader?: string,
  ) {
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.substring('Bearer '.length)
      : undefined;
    return this.chatService.updatePresence(conversationId, profile?.profileId, token);
  }
}
