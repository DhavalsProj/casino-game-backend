import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { AuthUser } from "../auth/auth-user";
import { RolesGuard } from "../auth/guards/roles.guard";
import { UserType } from "../users/entities/user.entity";
import { FunTargetBetController, FunTargetController } from "./fun-target.controller";

describe("FunTargetController authorization", () => {
  const guard = new RolesGuard(new Reflector());
  const managementHandlers = [
    FunTargetController.prototype.config,
    FunTargetController.prototype.updateConfig,
    FunTargetController.prototype.rounds,
    FunTargetController.prototype.createRound,
    FunTargetController.prototype.round,
    FunTargetController.prototype.open,
    FunTargetController.prototype.close,
    FunTargetController.prototype.result,
    FunTargetController.prototype.finalize,
    FunTargetController.prototype.publish,
    FunTargetController.prototype.resultHistory,
    FunTargetController.prototype.summary,
    FunTargetController.prototype.joker,
    FunTargetController.prototype.updateJoker,
    FunTargetController.prototype.schedule,
    FunTargetController.prototype.schedules,
    FunTargetController.prototype.cancel,
  ];

  function executionContext(handler: Function, type: AuthUser["type"]): ExecutionContext {
    return {
      getHandler: () => handler,
      getClass: () => FunTargetController,
      switchToHttp: () => ({
        getRequest: () => ({ user: { id: 1, type } }),
      }),
    } as Pick<ExecutionContext, "getHandler" | "getClass" | "switchToHttp"> as ExecutionContext;
  }

  it("allows only superadmins on the management API", () => {
    for (const handler of managementHandlers) {
      expect(guard.canActivate(executionContext(handler, "superadmin"))).toBe(true);
      for (const role of ["admin", UserType.AGENT, UserType.USER]) {
        expect(() => guard.canActivate(executionContext(handler, role))).toThrow(
          ForbiddenException,
        );
      }
    }
  });

  it("keeps the player bet endpoint restricted to users", () => {
    const handler = FunTargetBetController.prototype.place;
    expect(guard.canActivate(executionContext(handler, UserType.USER))).toBe(true);
    expect(() => guard.canActivate(executionContext(handler, UserType.AGENT))).toThrow(
      ForbiddenException,
    );
  });
});
