import { BadRequestException, ConflictException } from "@nestjs/common";
import { jest } from "@jest/globals";
import { DataSource, EntityManager, Repository } from "typeorm";
import { AuthUser } from "../auth/auth-user";
import {
  FunTargetBet,
  FunTargetConfig,
  FunTargetJokerSchedule,
  FunTargetResultAudit,
  FunTargetRound,
  RoundStatus,
} from "./entities/fun-target.entity";
import { Wallet } from "../wallet/entities/wallet.entity";
import { Transaction, WalletBalanceBucket } from "../transcation/entities/transcation.entity";
import { FunTargetService } from "./fun-target.service";

describe("FunTargetService Joker scheduling", () => {
  const actor = { id: 8 } as AuthUser;
  let service: FunTargetService;
  let roundRepository: Partial<Repository<FunTargetRound>>;
  let configRepository: Partial<Repository<FunTargetConfig>>;
  let scheduleRepository: Partial<Repository<FunTargetJokerSchedule>>;
  let transaction: jest.Mock;

  beforeEach(() => {
    roundRepository = {
      findOne: jest
        .fn()
        .mockResolvedValue({ id: 4, status: RoundStatus.UPCOMING }),
    };
    configRepository = {
      findOne: jest.fn().mockResolvedValue(null),
    };
    scheduleRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((value) => value),
      save: jest.fn((value) => Promise.resolve(value)),
    };
    transaction = jest.fn((work: (manager: EntityManager) => unknown) =>
      work({
        getRepository: (
          entity:
            | typeof FunTargetRound
            | typeof FunTargetJokerSchedule
            | typeof FunTargetConfig,
        ) =>
          entity === FunTargetRound
            ? roundRepository
            : entity === FunTargetJokerSchedule
              ? scheduleRepository
              : configRepository,
      } as EntityManager),
    );

    service = new FunTargetService(
      { transaction } as unknown as DataSource,
      configRepository as Repository<FunTargetConfig>,
      roundRepository as Repository<FunTargetRound>,
      {} as Repository<never>,
      scheduleRepository as Repository<FunTargetJokerSchedule>,
    );
  });

  it("creates a schedule while holding the target round lock", async () => {
    await expect(
      service.scheduleJoker({ roundId: 4, multiplier: 3 }, actor),
    ).resolves.toEqual({
      roundId: 4,
      multiplier: 3,
      active: true,
      createdBy: actor.id,
    });

    expect(roundRepository.findOne).toHaveBeenCalledWith({
      where: { id: 4 },
      lock: { mode: "pessimistic_write" },
    });
    expect(scheduleRepository.save).toHaveBeenCalledTimes(1);
  });

  it("reactivates a cancelled schedule instead of violating the unique round constraint", async () => {
    const cancelledSchedule = {
      id: 12,
      roundId: 4,
      multiplier: 2,
      active: false,
      createdBy: 3,
    };
    (scheduleRepository.findOne as jest.Mock).mockResolvedValue(
      cancelledSchedule,
    );

    await service.scheduleJoker({ roundId: 4, multiplier: 5 }, actor);

    expect(cancelledSchedule).toMatchObject({
      multiplier: 5,
      active: true,
      createdBy: actor.id,
    });
    expect(scheduleRepository.create).not.toHaveBeenCalled();
    expect(scheduleRepository.save).toHaveBeenCalledWith(cancelledSchedule);
  });

  it("rejects a duplicate active schedule", async () => {
    (scheduleRepository.findOne as jest.Mock).mockResolvedValue({
      active: true,
    });

    await expect(
      service.scheduleJoker({ roundId: 4, multiplier: 2 }, actor),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(scheduleRepository.save).not.toHaveBeenCalled();
  });

  it("rejects scheduling for a round that is no longer upcoming", async () => {
    (roundRepository.findOne as jest.Mock).mockResolvedValue({
      id: 4,
      status: RoundStatus.OPEN,
    });

    await expect(
      service.scheduleJoker({ roundId: 4, multiplier: 2 }, actor),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(scheduleRepository.findOne).not.toHaveBeenCalled();
  });

  it("uses the stable round number, not the database ID, for automatic Joker frequency", async () => {
    const round = {
      id: 11,
      roundNumber: 10,
      status: RoundStatus.UPCOMING,
      scheduledAt: new Date(Date.now() - 60_000),
    } as FunTargetRound;
    const saveRound = jest.fn().mockImplementation(async (value) => value);
    roundRepository = {
      findOne: jest.fn().mockResolvedValue(round),
      save: saveRound,
    };
    (configRepository.findOne as jest.Mock).mockResolvedValue({
      id: 1,
      jokerEnabled: true,
      jokerFrequency: 5,
      jokerMultiplier: 4,
    });

    await service.open(round.id);

    expect(round.jokerEnabled).toBe(true);
    expect(round.jokerMultiplier).toBe(4);
    expect(saveRound).toHaveBeenCalledWith(round);
  });
});

describe("FunTargetService payouts", () => {
  it("distributes the configured pool proportionally and credits temporary winnings atomically", async () => {
    const round = {
      id: 15,
      roundNumber: 4,
      status: RoundStatus.CLOSED,
      winningNumber: 7,
      jokerEnabled: false,
      jokerMultiplier: 1,
      finalizedAt: null,
    } as FunTargetRound;
    const wallets = new Map<number, Wallet>([
      [2, { id: 22, userId: 2, balance: "80.00", temporaryWinningBalance: "2.00" } as Wallet],
      [3, { id: 33, userId: 3, balance: "90.00", temporaryWinningBalance: "3.00" } as Wallet],
    ]);
    const walletRepository = {
      findOne: jest.fn(async ({ where }: { where: { userId: number } }) => wallets.get(where.userId) ?? null),
      save: jest.fn(async (wallet: Wallet) => wallet),
    };
    const betQuery = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([
        { userId: 2, amount: "10.00" },
        { userId: 3, amount: "30.00" },
      ]),
      getRawOne: jest.fn().mockResolvedValue({ amount: "100.00" }),
    };
    const betRepository = { createQueryBuilder: jest.fn(() => betQuery) };
    const transactionEntries: Partial<Transaction>[] = [];
    const transactionRepository = {
      save: jest.fn(async (entry: Partial<Transaction>) => {
        transactionEntries.push(entry);
        return entry;
      }),
    };
    const roundRepository = {
      findOne: jest.fn().mockResolvedValue(round),
      save: jest.fn(async (value: FunTargetRound) => value),
    };
    const configRepository = {
      findOne: jest.fn().mockResolvedValue({ winningAllocationPercent: "50.00" }),
    };
    const auditRepository = { save: jest.fn(async (entry: unknown) => entry) };
    const manager = {
      getRepository: (entity: unknown) => {
        if (entity === FunTargetRound) return roundRepository;
        if (entity === FunTargetBet) return betRepository;
        if (entity === FunTargetConfig) return configRepository;
        if (entity === FunTargetResultAudit) return auditRepository;
        if (entity === Wallet) return walletRepository;
        if (entity === Transaction) return transactionRepository;
        throw new Error("Unexpected repository");
      },
    } as EntityManager;
    const transaction = jest.fn((work: (manager: EntityManager) => unknown) => work(manager));
    const service = new FunTargetService(
      { transaction } as unknown as DataSource,
      configRepository as Repository<FunTargetConfig>,
      roundRepository as Repository<FunTargetRound>,
      betRepository as unknown as Repository<FunTargetBet>,
      {} as Repository<FunTargetJokerSchedule>,
    );

    await service.finalize(15, { id: 8 } as AuthUser);

    expect(wallets.get(2)?.temporaryWinningBalance).toBe("14.50");
    expect(wallets.get(3)?.temporaryWinningBalance).toBe("40.50");
    expect(transactionEntries.map((entry) => entry.amount)).toEqual(["12.50", "37.50"]);
    expect(transactionEntries.every((entry) => entry.balanceBucket === WalletBalanceBucket.TEMPORARY_WINNING)).toBe(true);
    expect(round.status).toBe(RoundStatus.COMPLETED);
  });
});
