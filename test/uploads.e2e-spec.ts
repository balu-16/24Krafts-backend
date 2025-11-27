import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Uploads (e2e)', () => {
  let app: INestApplication;
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Get auth token (assumes you have a test user)
    // This is a simplified version - adjust based on your auth flow
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
      userId = verifyResponse.body.user.id;
    }
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/uploads (POST)', () => {
    it('should upload an image file', async () => {
      const testImageBuffer = Buffer.from(
        '/9j/4AAQSkZJRgABAQEAAAAAAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AL+AD//Z',
        'base64',
      ); // Minimal valid JPEG

      const response = await request(app.getHttpServer())
        .post('/uploads')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', testImageBuffer, 'test.jpg')
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('publicUrl');
      expect(response.body.publicUrl).toContain('https://');
      expect(response.body.publicUrl).toContain('.supabase.co');
    });

    it('should reject non-image files', async () => {
      const textBuffer = Buffer.from('This is not an image');

      await request(app.getHttpServer())
        .post('/uploads')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', textBuffer, 'test.txt')
        .expect(400);
    });

    it('should reject files larger than 6MB', async () => {
      const largeBuffer = Buffer.alloc(7 * 1024 * 1024); // 7MB

      await request(app.getHttpServer())
        .post('/uploads')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', largeBuffer, 'large.jpg')
        .expect(400);
    });

    it('should require authentication', async () => {
      const testImageBuffer = Buffer.from('fake', 'base64');

      await request(app.getHttpServer())
        .post('/uploads')
        .attach('file', testImageBuffer, 'test.jpg')
        .expect(401);
    });
  });
});
