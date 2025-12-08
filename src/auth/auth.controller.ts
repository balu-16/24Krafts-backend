import { Controller, Post, Body, Get, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SendOtpDto, VerifyOtpDto, SignupDto } from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

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
}

