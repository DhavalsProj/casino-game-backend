import {
  BadRequestException,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthUser } from '../auth/auth-user';
import { ApiLogService } from './api-log.service';

@Controller('admin/api-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ApiLogsController {
  constructor(private readonly apiLogService: ApiLogService) {}

  @Get()
  @Roles('superadmin', 'admin')
  list(
    @CurrentUser() _user: AuthUser,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) requestedLimit = 50,
    @Query('statusCode') statusCode?: string,
    @Query('method') method?: string,
    @Query('userId') userId?: string,
    @Query('search') search?: string,
  ) {
    const parsedPage = this.positiveInteger(page, 'page');
    const limit = Math.min(this.positiveInteger(requestedLimit, 'limit'), 100);
    const parsedStatus = statusCode === undefined
      ? undefined
      : this.positiveInteger(statusCode, 'statusCode');
    if (parsedStatus !== undefined && (parsedStatus < 100 || parsedStatus > 599)) {
      throw new BadRequestException('statusCode must be between 100 and 599');
    }
    const parsedUserId = userId === undefined
      ? undefined
      : this.positiveInteger(userId, 'userId');
    const normalizedMethod = method?.trim().toUpperCase();
    if (normalizedMethod && !/^[A-Z]{3,10}$/.test(normalizedMethod)) {
      throw new BadRequestException('method must be a valid HTTP method');
    }
    const normalizedSearch = search?.trim();
    if (normalizedSearch && normalizedSearch.length > 100) {
      throw new BadRequestException('search must be 100 characters or fewer');
    }

    return this.apiLogService.list({
      page: parsedPage,
      limit,
      ...(parsedStatus !== undefined ? { statusCode: parsedStatus } : {}),
      ...(normalizedMethod ? { method: normalizedMethod } : {}),
      ...(parsedUserId !== undefined ? { userId: parsedUserId } : {}),
      ...(normalizedSearch ? { search: normalizedSearch } : {}),
    });
  }

  @Get(':id')
  @Roles('superadmin', 'admin')
  getById(@CurrentUser() _user: AuthUser, @Param('id') id: string) {
    if (!/^\d+$/.test(id)) throw new BadRequestException('id must be a positive integer');
    return this.apiLogService.getById(id);
  }

  private positiveInteger(value: string | number, name: string): number {
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < 1) {
      throw new BadRequestException(`${name} must be a positive integer`);
    }
    return parsed;
  }
}
