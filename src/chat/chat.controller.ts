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
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentProfile } from '../auth/decorators/current-user.decorator';
import {
  CreateConversationDto,
  SendMessageDto,
  UpdateTypingDto,
} from './dto/chat.dto';

@ApiTags('Chat')
@ApiBearerAuth('JWT-auth')
@Controller()
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  // Conversations
  @Get('conversations')
  @ApiOperation({ summary: 'List conversations', description: 'Get all conversations for a profile' })
  @ApiQuery({ name: 'profileId', required: true, description: 'Profile ID' })
  @ApiQuery({ name: 'cursor', required: false, description: 'Pagination cursor' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of results per page', example: 20 })
  @ApiResponse({ status: 200, description: 'List of conversations returned successfully' })
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
  @ApiOperation({ summary: 'Get conversation by ID', description: 'Get conversation details' })
  @ApiParam({ name: 'id', description: 'Conversation UUID' })
  @ApiResponse({ status: 200, description: 'Conversation details returned successfully' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async getConversation(@Param('id') id: string, @Headers('authorization') authHeader?: string) {
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.substring('Bearer '.length)
      : undefined;
    return this.chatService.getConversationById(id, token);
  }

  @Post('conversations')
  @ApiOperation({ summary: 'Create conversation', description: 'Start a new conversation with one or more users' })
  @ApiResponse({ status: 201, description: 'Conversation created successfully' })
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
  @ApiOperation({ summary: 'Get messages', description: 'Get messages in a conversation' })
  @ApiParam({ name: 'id', description: 'Conversation UUID' })
  @ApiQuery({ name: 'cursor', required: false, description: 'Pagination cursor' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of results per page', example: 40 })
  @ApiResponse({ status: 200, description: 'List of messages returned successfully' })
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
  @ApiOperation({ summary: 'Send message', description: 'Send a message in a conversation (rate limited: 10 messages per second)' })
  @ApiParam({ name: 'id', description: 'Conversation UUID' })
  @ApiResponse({ status: 201, description: 'Message sent successfully' })
  async sendMessage(
    @Param('id') conversationId: string,
    @Body() sendMessageDto: SendMessageDto,
    @CurrentProfile() profile: any,
  ) {
    return this.chatService.sendMessage(conversationId, profile?.profileId, sendMessageDto);
  }

  // Typing indicator
  @Post('conversations/:id/typing')
  @ApiOperation({ summary: 'Update typing status', description: 'Indicate typing status in a conversation' })
  @ApiParam({ name: 'id', description: 'Conversation UUID' })
  @ApiResponse({ status: 200, description: 'Typing status updated successfully' })
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
  @ApiOperation({ summary: 'Update presence', description: 'Update online presence in a conversation' })
  @ApiParam({ name: 'id', description: 'Conversation UUID' })
  @ApiResponse({ status: 200, description: 'Presence updated successfully' })
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
