import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { io as ioClient, Socket } from 'socket.io-client';

describe('Chat (e2e)', () => {
  let app: INestApplication;
  let authToken: string;
  let profileId: string;
  let conversationId: string;
  let socketClient: Socket;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    await app.listen(3001); // Use different port for testing

    // Get auth token
    const authResponse = await request(app.getHttpServer())
      .post('/auth/phone/send-otp')
      .send({ phone: '+1234567890' })
      .expect(201);

    if (authResponse.body.otp) {
      const verifyResponse = await request(app.getHttpServer())
        .post('/auth/phone/verify-otp')
        .send({
          phone: '+1234567890',
          otp: authResponse.body.otp,
        })
        .expect(201);

      authToken = verifyResponse.body.token;
      profileId = verifyResponse.body.profile?.id;
    }
  });

  afterAll(async () => {
    if (socketClient) {
      socketClient.disconnect();
    }
    await app.close();
  });

  describe('REST API', () => {
    describe('/conversations (POST)', () => {
      it('should create a conversation', async () => {
        const response = await request(app.getHttpServer())
          .post('/conversations')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            is_group: false,
            member_ids: [profileId, 'other-profile-id'],
          })
          .expect(201);

        expect(response.body).toHaveProperty('id');
        expect(response.body).toHaveProperty('is_group', false);
        conversationId = response.body.id;
      });

      it('should require authentication', async () => {
        await request(app.getHttpServer())
          .post('/conversations')
          .send({
            is_group: false,
            member_ids: ['id1', 'id2'],
          })
          .expect(401);
      });
    });

    describe('/conversations (GET)', () => {
      it('should list conversations', async () => {
        const response = await request(app.getHttpServer())
          .get('/conversations')
          .query({ profileId })
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('data');
        expect(Array.isArray(response.body.data)).toBe(true);
      });

      it('should support pagination', async () => {
        const response = await request(app.getHttpServer())
          .get('/conversations')
          .query({ profileId, limit: 10 })
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('nextCursor');
      });
    });

    describe('/conversations/:id/messages (POST)', () => {
      it('should send a message', async () => {
        if (!conversationId) {
          // Create a conversation first
          const convResponse = await request(app.getHttpServer())
            .post('/conversations')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              is_group: false,
              member_ids: [profileId],
            });
          conversationId = convResponse.body.id;
        }

        const response = await request(app.getHttpServer())
          .post(`/conversations/${conversationId}/messages`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            content: 'Hello, this is a test message',
          })
          .expect(201);

        expect(response.body).toHaveProperty('id');
        expect(response.body).toHaveProperty('content', 'Hello, this is a test message');
        expect(response.body).toHaveProperty('conversation_id', conversationId);
      });

      it('should enforce rate limiting', async () => {
        const promises = [];
        for (let i = 0; i < 15; i++) {
          promises.push(
            request(app.getHttpServer())
              .post(`/conversations/${conversationId}/messages`)
              .set('Authorization', `Bearer ${authToken}`)
              .send({ content: `Message ${i}` }),
          );
        }

        const results = await Promise.all(promises);
        const tooManyRequests = results.filter((r) => r.status === 429);
        expect(tooManyRequests.length).toBeGreaterThan(0);
      });
    });

    describe('/conversations/:id/messages (GET)', () => {
      it('should get messages', async () => {
        const response = await request(app.getHttpServer())
          .get(`/conversations/${conversationId}/messages`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('data');
        expect(Array.isArray(response.body.data)).toBe(true);
      });
    });

    describe('/conversations/:id/typing (POST)', () => {
      it('should update typing status', async () => {
        await request(app.getHttpServer())
          .post(`/conversations/${conversationId}/typing`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ is_typing: true })
          .expect(201);
      });
    });

    describe('/conversations/:id/presence (POST)', () => {
      it('should update presence', async () => {
        await request(app.getHttpServer())
          .post(`/conversations/${conversationId}/presence`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(201);
      });
    });
  });

  describe('WebSocket', () => {
    beforeAll((done) => {
      socketClient = ioClient('http://localhost:3001/chat', {
        auth: { token: authToken },
        transports: ['websocket'],
      });

      socketClient.on('connect', () => {
        done();
      });

      socketClient.on('error', (error: any) => {
        console.error('Socket error:', error);
      });
    });

    it('should connect with valid token', (done) => {
      expect(socketClient.connected).toBe(true);
      done();
    });

    it('should join a conversation', (done) => {
      socketClient.emit('join_conversation', {
        conversationId,
      });

      setTimeout(() => {
        done();
      }, 100);
    });

    it('should send and receive messages', (done) => {
      const clientMsgId = `test-${Date.now()}`;
      const testMessage = 'WebSocket test message';

      socketClient.once('message', (data: any) => {
        expect(data).toHaveProperty('content', testMessage);
        expect(data).toHaveProperty('conversationId', conversationId);
        done();
      });

      socketClient.emit('send_message', {
        conversationId,
        clientMsgId,
        content: testMessage,
      });
    });

    it('should emit typing events', (done) => {
      socketClient.once('user_typing', (data: any) => {
        expect(data).toHaveProperty('conversationId', conversationId);
        expect(data).toHaveProperty('isTyping');
        done();
      });

      socketClient.emit('typing', {
        conversationId,
        isTyping: true,
      });
    });

    it('should handle leave conversation', (done) => {
      socketClient.emit('leave_conversation', {
        conversationId,
      });

      setTimeout(() => {
        done();
      }, 100);
    });
  });
});
