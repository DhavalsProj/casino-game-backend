import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginUserDto } from './dto/login-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import type { AuthUser } from './auth-user';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Post('login')
    login(@Body() loginUserDto: LoginUserDto, @Req() request: Request) {
        return this.authService.login(loginUserDto, request);
    }

    @Post('change-password')
    @UseGuards(JwtAuthGuard)
    changePassword(@CurrentUser() currentUser: AuthUser, @Body() dto: ChangePasswordDto) {
        return this.authService.changePassword(currentUser, dto);
    }
}
