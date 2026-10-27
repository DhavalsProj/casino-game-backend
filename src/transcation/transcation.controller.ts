import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthUser } from "../auth/auth-user";
import { TranscationService } from "./transcation.service";
import type { TransactionHistoryQuery } from "./transaction-history";

@Controller(["transcation", "transactions"])
export class TranscationController {
  constructor(private readonly transcationService: TranscationService) {}

  @Get("agent/:agentId")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("superadmin", "admin")
  getTransactionsByAgentId(
    @Param("agentId", ParseIntPipe) agentId: number,
    @CurrentUser() currentUser: AuthUser,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("search") search?: string,
    @Query("type") type?: string,
  ) {
    return this.transcationService.getTransactionsByAgentId(
      agentId,
      currentUser,
      this.paginationQuery(page, limit, search, type),
    );
  }

  @Get(":userId")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("superadmin", "admin", "agent", "user")
  getTransactionsByUserId(
    @Param("userId") userId: string,
    @CurrentUser() currentUser: AuthUser,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("search") search?: string,
    @Query("type") type?: string,
  ) {
    return this.transcationService.getTransactionsByAccountIdentifier(
      userId,
      currentUser,
      this.paginationQuery(page, limit, search, type),
    );
  }

  private paginationQuery(
    pageRaw?: string,
    limitRaw?: string,
    searchRaw?: string,
    typeRaw?: string,
  ): TransactionHistoryQuery | undefined {
    if (
      pageRaw === undefined &&
      limitRaw === undefined &&
      searchRaw === undefined &&
      typeRaw === undefined
    ) {
      return undefined;
    }

    const page = this.parsePositiveInteger(pageRaw, "page", 1);
    const requestedLimit = this.parsePositiveInteger(limitRaw, "limit", 10);
    const limit = Math.min(requestedLimit, 100);
    if (
      !Number.isSafeInteger((page - 1) * limit) ||
      !Number.isSafeInteger(page * limit)
    ) {
      throw new BadRequestException("Page offset is too large");
    }

    const search = searchRaw?.trim();
    if (search && search.length > 100) {
      throw new BadRequestException(
        "Search text must be 100 characters or fewer",
      );
    }

    const normalizedType = typeRaw?.toUpperCase();
    if (
      normalizedType !== undefined &&
      normalizedType !== "CREDIT" &&
      normalizedType !== "DEBIT"
    ) {
      throw new BadRequestException("Transaction type must be CREDIT or DEBIT");
    }

    return {
      page,
      limit,
      ...(search ? { search } : {}),
      ...(normalizedType ? { type: normalizedType } : {}),
    };
  }

  private parsePositiveInteger(
    value: string | undefined,
    name: string,
    fallback: number,
  ): number {
    if (value === undefined) return fallback;
    if (!/^\d+$/.test(value)) {
      throw new BadRequestException(`${name} must be a positive integer`);
    }
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < 1) {
      throw new BadRequestException(`${name} must be a positive integer`);
    }
    return parsed;
  }
}
