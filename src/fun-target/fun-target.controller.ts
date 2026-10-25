import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthUser } from '../auth/auth-user';
import { CreateBetDto, CreateRoundDto, JokerScheduleDto, ManualResultDto, UpdateFunTargetConfigDto } from './dto/fun-target.dto';
import { FunTargetService } from './fun-target.service';
import { RoundStatus } from './entities/fun-target.entity';

@Controller('admin/games/fun-target')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FunTargetController {
  constructor(private readonly service: FunTargetService) {}
  @Get('config') @Roles('superadmin', 'admin') config() { return this.service.config(); }
  @Patch('config') @Roles('superadmin', 'admin') updateConfig(@Body() dto: UpdateFunTargetConfigDto, @CurrentUser() user: AuthUser) { return this.service.updateConfig(dto, user); }
  @Get('rounds') @Roles('superadmin', 'admin', 'agent') rounds(@Query('page') page = '1', @Query('limit') limit = '20', @Query('status') status?: RoundStatus) { return this.service.listRounds(Math.max(1, +page), Math.max(1, +limit), status); }
  @Post('rounds') @Roles('superadmin', 'admin') createRound(@Body() dto: CreateRoundDto, @CurrentUser() user: AuthUser) { return this.service.createRound(dto, user); }
  @Get('rounds/:id') @Roles('superadmin', 'admin', 'agent') round(@Param('id', ParseIntPipe) id: number) { return this.service.round(id); }
  @Post('rounds/:id/open') @Roles('superadmin', 'admin') open(@Param('id', ParseIntPipe) id: number) { return this.service.open(id); }
  @Post('rounds/:id/close') @Roles('superadmin', 'admin') close(@Param('id', ParseIntPipe) id: number) { return this.service.close(id); }
  @Post('rounds/:id/result') @Roles('superadmin', 'admin') result(@Param('id', ParseIntPipe) id: number, @Body() dto: ManualResultDto, @CurrentUser() user: AuthUser) { return this.service.generate(id, dto, user); }
  @Post('rounds/:id/finalize') @Roles('superadmin', 'admin') finalize(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) { return this.service.finalize(id, user); }
  @Get('rounds/:id/result') @Roles('superadmin', 'admin', 'agent', 'user') resultHistory(@Param('id', ParseIntPipe) id: number) { return this.service.result(id); }
  @Get('rounds/:id/bets/summary') @Roles('superadmin', 'admin', 'agent') summary(@Param('id', ParseIntPipe) id: number) { return this.service.summary(id); }
  @Get('joker') @Roles('superadmin', 'admin', 'agent') joker() { return this.service.config(); }
  @Patch('joker') @Roles('superadmin', 'admin') updateJoker(@Body() dto: UpdateFunTargetConfigDto, @CurrentUser() user: AuthUser) { return this.service.updateConfig(dto, user); }
  @Post('joker/schedules') @Roles('superadmin', 'admin') schedule(@Body() dto: JokerScheduleDto, @CurrentUser() user: AuthUser) { return this.service.scheduleJoker(dto, user); }
  @Get('joker/schedules') @Roles('superadmin', 'admin', 'agent') schedules() { return this.service.jokerSchedules(); }
  @Post('joker/schedules/:id/cancel') @Roles('superadmin', 'admin') cancel(@Param('id', ParseIntPipe) id: number) { return this.service.cancelSchedule(id); }
}

@Controller('fun-target/bets')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FunTargetBetController {
  constructor(private readonly service: FunTargetService) {}
  @Post() @Roles('user') place(@Body() dto: CreateBetDto, @CurrentUser() user: AuthUser) { return this.service.placeBet(dto, user); }
}
