import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { NoDbService } from './no-db.service';
import { NoDbAuthGuard } from './no-db-auth.guard';
import { UserType } from '../users/entities/user.entity';

@Controller('auth')
export class NoDbAuthController {
  constructor(private readonly service: NoDbService) {}

  @Post('login')
  login(@Body() body: { identifier?: string; mobile?: string; password: string }) {
    return this.service.login(body.identifier ?? body.mobile ?? '', body.password);
  }
}

@Controller('users')
@UseGuards(NoDbAuthGuard)
export class NoDbUsersController {
  constructor(private readonly service: NoDbService) {}

  @Get()
  list(@Req() request: Request & { user: any }, @Query('type') type?: UserType) {
    return this.service.list(request.user, type);
  }

  @Get('agents')
  agents(@Req() request: Request & { user: any }) {
    return this.service.agents(request.user);
  }

  @Post('create')
  create(@Body() body: { name: string; mobile: string; type?: UserType; agentId?: string }, @Req() request: Request & { user: any }) {
    return this.service.create(body, request.user);
  }

  @Post('get-by-id')
  getById(@Body('id') id: number, @Req() request: Request & { user: any }) {
    return this.service.getById(+id, request.user);
  }
}
