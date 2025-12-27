import { Controller, Post, Body, Get, UseGuards, Request, Headers, UnauthorizedException, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { SendOtpDto, VerifyOtpDto, SignupDto } from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Post('send-otp')
  @ApiOperation({
    summary: 'Send OTP to phone number',
    description: 'Sends a 6-digit OTP to the provided phone number. Returns whether the user already exists.',
  })
  @ApiResponse({
    status: 200,
    description: 'OTP sent successfully',
    schema: {
      example: {
        success: true,
        message: 'OTP sent successfully',
        userExists: false,
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request - Invalid phone number' })
  async sendOtp(@Body() sendOtpDto: SendOtpDto) {
    return this.authService.sendOtp(sendOtpDto.phone);
  }

  @Post('verify-otp')
  @ApiOperation({
    summary: 'Verify OTP',
    description: `Verifies the OTP sent to the phone number.
    
**For existing users:** Returns \`access_token\` for authenticated API calls with \`isNewUser: false\`

**For new users:** Returns \`access_token\` (valid for 10 minutes) to be used in the signup endpoint with \`isNewUser: true\``,
  })
  @ApiResponse({
    status: 200,
    description: 'OTP verified successfully',
    schema: {
      oneOf: [
        {
          example: {
            success: true,
            isNewUser: true,
            message: 'OTP verified. Please complete signup using the provided access_token.',
            access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          },
        },
        {
          example: {
            success: true,
            isNewUser: false,
            message: 'Login successful',
            user: {
              id: 'uuid',
              phone: '9876543210',
              email: 'john@example.com',
              role: 'artist',
              firstName: 'John',
              lastName: 'Doe',
            },
            profile: {},
            access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          },
        },
      ],
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or expired OTP' })
  async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    return this.authService.verifyOtp(verifyOtpDto.phone, verifyOtpDto.otp);
  }

  @Post('signup')
  @HttpCode(201)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Complete user registration',
    description: `Complete user registration with all required details.

**Requires:** \`Authorization: Bearer <access_token>\` header

The \`access_token\` must be the one received from \`/auth/verify-otp\` endpoint (for new users).
The phone number is extracted from the token - do not include it in the request body.

**Token validity:** 10 minutes from OTP verification`,
  })
  @ApiResponse({
    status: 201,
    description: 'Signup successful',
    schema: {
      example: {
        success: true,
        message: 'Signup successful',
        user: {
          id: 'uuid',
          phone: '9876543210',
          email: 'john@example.com',
          role: 'artist',
          firstName: 'John',
          lastName: 'Doe',
        },
        profile: {},
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or expired signup token' })
  @ApiResponse({ status: 400, description: 'Bad request - User already exists or validation error' })
  async signup(@Body() signupDto: SignupDto, @Headers('authorization') authHeader?: string) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Authorization header with Bearer token is required. Please verify OTP first.');
    }

    const token = authHeader.substring('Bearer '.length).trim();
    if (!token) {
      throw new UnauthorizedException('Invalid authorization token');
    }

    return this.authService.signup(signupDto, token);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get current user profile',
    description: 'Returns the profile of the currently authenticated user.',
  })
  @ApiResponse({
    status: 200,
    description: 'Profile retrieved successfully',
    schema: {
      example: {
        success: true,
        user: {
          id: 'uuid',
          phone: '9876543210',
          email: 'john@example.com',
        },
        profile: {
          id: 'uuid',
          role: 'artist',
          first_name: 'John',
          last_name: 'Doe',
        },
        socialLinks: [],
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or expired token' })
  async getProfile(@Request() req: any) {
    return this.authService.getProfile(req.user.id);
  }

  @Post('cleanup-otps')
  @ApiOperation({
    summary: 'Cleanup expired OTPs',
    description: 'Removes expired OTP records from the database. Should be called periodically via cron job.',
  })
  @ApiResponse({
    status: 200,
    description: 'Cleanup completed',
    schema: {
      example: {
        success: true,
        message: 'Expired OTPs cleaned up',
        count: 5,
      },
    },
  })
  async cleanupOtps() {
    return this.authService.cleanupExpiredOtps();
  }
}

