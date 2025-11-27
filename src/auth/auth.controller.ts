import { Controller, Post, Body, Get, UseGuards, Request, Headers } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SendOtpDto, VerifyOtpDto, SignupDto } from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { SessionGuard } from './guards/session.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Send OTP to phone number
   * POST /auth/send-otp
   */
  @Post('send-otp')
  async sendOtp(@Body() sendOtpDto: SendOtpDto) {
    return this.authService.sendOtp(sendOtpDto.phone);
  }

  /**
   * Verify OTP for login (existing users)
   * POST /auth/verify-otp
   * Returns isNewUser: true if user needs to signup
   */
  @Post('verify-otp')
  async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    return this.authService.verifyOtp(verifyOtpDto.phone, verifyOtpDto.otp);
  }

  /**
   * Complete signup with all user details
   * POST /auth/signup
   * Verifies OTP and creates user account
   */
  @Post('signup')
  async signup(@Body() signupDto: SignupDto) {
    return this.authService.signup(signupDto);
  }

  /**
   * Get current user profile
   * GET /auth/profile
   * Requires authentication
   */
  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Request() req: any) {
    return this.authService.getProfile(req.user.id);
  }

  /**
   * Cleanup expired OTPs
   * POST /auth/cleanup-otps
   * Should be called periodically or via cron job
   */
  @Post('cleanup-otps')
  async cleanupOtps() {
    return this.authService.cleanupExpiredOtps();
  }

  /**
   * Session-based login: verify OTP, create a persistent session
   * POST /auth/session/login
   */
  @Post('session/login')
  async sessionLogin(@Body() body: { phone: string; otp: string; deviceInfo?: string }) {
    const { phone, otp, deviceInfo } = body;
    return this.authService.loginWithOtp(phone, otp, deviceInfo);
  }

  /**
   * Session validate: validates Authorization: Session <id> via SessionGuard
   * GET /auth/session/validate
   */
  @Get('session/validate')
  @UseGuards(SessionGuard)
  async validateSession(@Request() req: any) {
    // If guard passed, request.user is attached; return role and basic user info
    return {
      valid: true,
      user: req.user,
      role: req.user?.role,
    };
  }

  /**
   * Session logout: invalidate the session id
   * POST /auth/session/logout
   */
  @Post('session/logout')
  async sessionLogout(@Headers('authorization') authHeader?: string) {
    if (!authHeader || !authHeader.startsWith('Session ')) {
      return { success: true }; // Idempotent: nothing to invalidate
    }
    const sessionId = authHeader.substring('Session '.length).trim();
    return this.authService.invalidateSession(sessionId);
  }
}

