import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserType } from './entities/user.entity';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('create')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('superadmin', 'admin', 'agent')
  create(@Body() createUserDto: CreateUserDto, @CurrentUser() currentUser: any) {
    return this.usersService.create(createUserDto, currentUser);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('superadmin', 'admin', 'agent', 'user')
  findAll(@CurrentUser() currentUser: any, @Query('type') type?: UserType) {
    return this.usersService.findAll(currentUser, type);
  }

  @Get('agents')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('superadmin', 'admin')
  findAgents(@CurrentUser() currentUser: any) {
    return this.usersService.findAgents(currentUser);
  }

  @Post('get-by-id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('superadmin', 'admin', 'agent', 'user')
  findOne(@Body('id') id: number, @CurrentUser() currentUser: any) {
    return this.usersService.findOne(+id, currentUser);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('superadmin', 'admin')
  update(@Param('id') id: string, @Body() changes: UpdateUserDto, @CurrentUser() currentUser: any) {
    return this.usersService.update(+id, changes, currentUser);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('superadmin', 'admin')
  remove(@Param('id') id: string, @CurrentUser() currentUser: any) {
    return this.usersService.remove(+id, currentUser);
  }
}