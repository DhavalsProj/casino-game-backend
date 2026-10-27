import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthUser } from "../auth/auth-user";
import {
  CreateBetDto,
  CreateRoundDto,
  JokerScheduleDto,
  ManualResultDto,
  UpdateFunTargetConfigDto,
} from "./dto/fun-target.dto";
import { FunTargetService } from "./fun-target.service";
import { RoundStatus } from "./entities/fun-target.entity";

@Controller("admin/games/fun-target")
@UseGuards(JwtAuthGuard, RolesGuard)
export class FunTargetController {
  constructor(private readonly service: FunTargetService) {}
  @Get("config") @Roles("superadmin") config() {
    return this.service.config();
  }
  @Patch("config") @Roles("superadmin") updateConfig(
    @Body() dto: UpdateFunTargetConfigDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.updateConfig(dto, user);
  }
  @Get("rounds") @Roles("superadmin") rounds(
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query("limit", new DefaultValuePipe(20), ParseIntPipe) limit = 20,
    @Query("status", new ParseEnumPipe(RoundStatus, { optional: true }))
    status?: RoundStatus,
  ) {
    return this.service.listRounds(
      Math.max(1, page),
      Math.max(1, limit),
      status,
    );
  }
  @Post("rounds") @Roles("superadmin") createRound(
    @Body() dto: CreateRoundDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.createRound(dto, user);
  }
  @Get("rounds/:id") @Roles("superadmin") round(
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.service.round(id);
  }
  @Post("rounds/:id/open") @Roles("superadmin") open(
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.service.open(id);
  }
  @Post("rounds/:id/close") @Roles("superadmin") close(
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.service.close(id);
  }
  @Post("rounds/:id/result") @Roles("superadmin") result(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ManualResultDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.generate(id, dto, user);
  }
  @Post("rounds/:id/finalize") @Roles("superadmin") finalize(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.finalize(id, user);
  }
  @Post("rounds/:id/publish") @Roles("superadmin") publish(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ManualResultDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.publish(id, dto, user);
  }
  @Get("rounds/:id/result")
  @Roles("superadmin")
  resultHistory(@Param("id", ParseIntPipe) id: number) {
    return this.service.result(id);
  }
  @Get("rounds/:id/bets/summary")
  @Roles("superadmin")
  summary(@Param("id", ParseIntPipe) id: number) {
    return this.service.summary(id);
  }
  @Get("joker") @Roles("superadmin") joker() {
    return this.service.config();
  }
  @Patch("joker") @Roles("superadmin") updateJoker(
    @Body() dto: UpdateFunTargetConfigDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.updateConfig(dto, user);
  }
  @Post("joker/schedules") @Roles("superadmin") schedule(
    @Body() dto: JokerScheduleDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.scheduleJoker(dto, user);
  }
  @Get("joker/schedules") @Roles("superadmin") schedules() {
    return this.service.jokerSchedules();
  }
  @Post("joker/schedules/:id/cancel") @Roles("superadmin") cancel(
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.service.cancelSchedule(id);
  }
}

@Controller("fun-target/bets")
@UseGuards(JwtAuthGuard, RolesGuard)
export class FunTargetBetController {
  constructor(private readonly service: FunTargetService) {}
  @Post() @Roles("user") place(
    @Body() dto: CreateBetDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.placeBet(dto, user);
  }
}
