import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import morgan from 'morgan';
import helmet from 'helmet';
import { validateEnvironmentVariables } from './utils/config-validation';
import { RedisIoAdapter } from './ws/redis-io.adapter';
import { Request, Response, NextFunction } from 'express';

async function bootstrap() {
  // Validate environment variables before starting the application
  validateEnvironmentVariables();
  const app = await NestFactory.create(AppModule);

  // Disable ETag to prevent 304 Not Modified on dynamic API responses
  try {
    const expressApp = (app as any).getHttpAdapter?.().getInstance?.();
    expressApp?.disable?.('etag');
  } catch {
    // ignore if adapter methods differ
  }

  // Force no-store caching for API endpoints to avoid stale 304 behavior on clients
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  });

  // Security headers with Helmet.js (allow Swagger UI assets)
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", "https:"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false, // Disable for mobile app compatibility
  }));

  // Enable CORS with security
  const allowedOrigins = process.env.CORS_ORIGIN 
    ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
    : ['http://localhost:19006', 'http://localhost:8081'];
    
  // In production, don't allow wildcard origins
  const isProduction = process.env.NODE_ENV === 'production';
  
  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, etc.) only in development
      if (!origin && !isProduction) {
        callback(null, true);
      } else if (origin && (allowedOrigins.includes(origin) || (!isProduction && allowedOrigins.includes('*')))) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // HTTP request logging
  app.use(morgan('combined'));

  // Global prefix
  app.setGlobalPrefix('api');

  // Swagger API Documentation
  const config = new DocumentBuilder()
    .setTitle('24Krafts API')
    .setDescription(`
## 24Krafts Backend API Documentation

### Authentication Flow

#### For New Users (Signup):
1. **POST /api/auth/send-otp** - Send OTP to phone number
2. **POST /api/auth/verify-otp** - Verify OTP (returns \`access_token\` with \`isNewUser: true\`)
3. **POST /api/auth/signup** - Complete registration using the \`access_token\` from step 2

#### For Existing Users (Login):
1. **POST /api/auth/send-otp** - Send OTP to phone number
2. **POST /api/auth/verify-otp** - Verify OTP (returns \`access_token\` with \`isNewUser: false\`)

### Authorization
All protected endpoints require a JWT token in the Authorization header:
\`\`\`
Authorization: Bearer <access_token>
\`\`\`
    `)
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('Auth', 'Authentication endpoints - OTP, Login, Signup')
    .addTag('Users', 'User management')
    .addTag('Profiles', 'User profile management')
    .addTag('Posts', 'Posts and project applications')
    .addTag('Projects', 'Project management')
    .addTag('Chat', 'Conversations and messaging')
    .addTag('Schedules', 'Schedule management for projects')
    .addTag('Uploads', 'File uploads')
    .addTag('Notifications', 'Push notification management')
    .addTag('Admin', 'Admin endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
    customSiteTitle: '24Krafts API Documentation',
  });

  // Use Socket.IO with Redis adapter for WebSocket scaling
  const redisAdapter = new RedisIoAdapter(app);
  await redisAdapter.connectToRedis(process.env.REDIS_URL);
  app.useWebSocketAdapter(redisAdapter);

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 Application is running on: http://localhost:${port}/api`);
  console.log(`📚 Swagger documentation available at: http://localhost:${port}/api/docs`);
}
bootstrap();

