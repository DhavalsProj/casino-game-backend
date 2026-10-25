import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { randomInt } from 'node:crypto';
import { AuthUser } from '../auth/auth-user';
import { Wallet } from '../wallet/entities/wallet.entity';
import { Transaction, WalletTransactionSource, WalletTransactionType } from '../transcation/entities/transcation.entity';
import { CreateBetDto, CreateRoundDto, JokerScheduleDto, ManualResultDto, UpdateFunTargetConfigDto } from './dto/fun-target.dto';
import { FunTargetBet, FunTargetConfig, FunTargetJokerSchedule, FunTargetResultAudit, FunTargetRound, ResultMode, RoundStatus } from './entities/fun-target.entity';

@Injectable()
export class FunTargetService {
  constructor(private readonly db: DataSource,
    @InjectRepository(FunTargetConfig) private readonly configs: Repository<FunTargetConfig>,
    @InjectRepository(FunTargetRound) private readonly rounds: Repository<FunTargetRound>,
    @InjectRepository(FunTargetBet) private readonly bets: Repository<FunTargetBet>,
    @InjectRepository(FunTargetJokerSchedule) private readonly schedules: Repository<FunTargetJokerSchedule>) {}

  async config() {
    let config = await this.configs.findOne({ where: { id: 1 } });
    if (!config) config = await this.configs.save(this.configs.create({ id: 1 }));
    return config;
  }
  async updateConfig(dto: UpdateFunTargetConfigDto, actor: AuthUser) {
    const c = await this.config();
    Object.assign(c, dto, { updatedBy: actor.id });
    if (Number(c.minBet) > Number(c.maxBet)) throw new BadRequestException('Minimum bet cannot exceed maximum bet');
    if (Number(c.adminSharePercent) + Number(c.winningAllocationPercent) !== 100) throw new BadRequestException('Admin and winning allocation percentages must total 100');
    return this.configs.save(c);
  }
  async createRound(dto: CreateRoundDto, actor: AuthUser) {
    const c = await this.config();
    const scheduledAt = new Date(dto.scheduledAt);
    if (scheduledAt <= new Date()) throw new BadRequestException('Round schedule must be in the future');
    return this.rounds.save(this.rounds.create({ scheduledAt, status: RoundStatus.UPCOMING, resultMode: c.resultMode, jokerEnabled: false, jokerMultiplier: 1, createdBy: actor.id }));
  }
  async listRounds(page = 1, limit = 20, status?: RoundStatus) {
    const [data, total] = await this.rounds.findAndCount({ where: status ? { status } : {}, order: { scheduledAt: 'DESC' }, skip: (page - 1) * limit, take: Math.min(limit, 100) });
    return { data, total, page, limit: Math.min(limit, 100) };
  }
  async round(id: number) {
    const round = await this.rounds.findOne({ where: { id } }); if (!round) throw new NotFoundException('Round not found');
    const summary = await this.summary(id); return { ...round, summary };
  }
  async open(id: number) {
    return this.db.transaction(async m => { const r = await m.getRepository(FunTargetRound).findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!r) throw new NotFoundException('Round not found'); if (r.status !== RoundStatus.UPCOMING) throw new ConflictException('Only upcoming rounds can be opened');
      if (r.scheduledAt > new Date()) throw new BadRequestException('Round is scheduled for the future');
      const s = await m.getRepository(FunTargetJokerSchedule).findOne({ where: { roundId: id, active: true } });
      const c = await m.getRepository(FunTargetConfig).findOne({ where: { id: 1 } });
      r.jokerEnabled = !!(c?.jokerEnabled && (s || (c.jokerFrequency > 0 && id % c.jokerFrequency === 0)));
      if (r.jokerEnabled) r.jokerMultiplier = s?.multiplier ?? c!.jokerMultiplier;
      r.status = RoundStatus.OPEN; r.openedAt = new Date(); return m.getRepository(FunTargetRound).save(r); });
  }
  async close(id: number) { const r = await this.rounds.findOne({ where: { id } }); if (!r) throw new NotFoundException('Round not found'); if (r.status !== RoundStatus.OPEN) throw new ConflictException('Only open rounds can be closed'); r.status = RoundStatus.CLOSED; r.closedAt = new Date(); return this.rounds.save(r); }
  async generate(id: number, dto: ManualResultDto | undefined, actor: AuthUser) {
    return this.db.transaction(async m => { const repo = m.getRepository(FunTargetRound); const r = await repo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!r) throw new NotFoundException('Round not found'); if (r.status !== RoundStatus.CLOSED) throw new ConflictException('Close betting before generating a result');
      if (r.winningNumber !== null) throw new ConflictException('Result has already been generated');
      const manualNumber = dto?.winningNumber;
      if (r.resultMode === ResultMode.MANUAL && (manualNumber === undefined || manualNumber < 1 || manualNumber > 9)) throw new BadRequestException('Manual result must be from 1 to 9');
      if (r.resultMode === ResultMode.RANDOM && dto) throw new BadRequestException('Do not submit a number in random mode');
      r.winningNumber = r.resultMode === ResultMode.RANDOM ? randomInt(1, 10) : manualNumber!; r.resultGeneratedBy = actor.id; r.resultGeneratedAt = new Date();
      await m.getRepository(FunTargetResultAudit).save({ roundId: id, actorId: actor.id, action: 'GENERATED', winningNumber: r.winningNumber }); return repo.save(r); });
  }
  async finalize(id: number, actor: AuthUser) {
    return this.db.transaction(async m => { const repo = m.getRepository(FunTargetRound); const r = await repo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!r) throw new NotFoundException('Round not found'); if (r.status !== RoundStatus.CLOSED || r.winningNumber === null) throw new ConflictException('A closed round with a generated result is required');
      if (r.finalizedAt) throw new ConflictException('Round is already finalized'); r.status = RoundStatus.COMPLETED; r.finalizedBy = actor.id; r.finalizedAt = new Date();
      await m.getRepository(FunTargetResultAudit).save({ roundId: id, actorId: actor.id, action: 'FINALIZED', winningNumber: r.winningNumber }); return repo.save(r); });
  }
  async result(id: number) { const r = await this.rounds.findOne({ where: { id, status: RoundStatus.COMPLETED } }); if (!r) throw new NotFoundException('Finalized result not found'); return r; }
  async summary(id: number) {
    const rows = await this.bets.createQueryBuilder('b').select('b.number', 'number').addSelect('SUM(b.amount)', 'amount').addSelect('COUNT(*)', 'count').where('b.round_id = :id', { id }).groupBy('b.number').getRawMany();
    const perNumber = Array.from({ length: 9 }, (_, i) => { const row = rows.find(x => Number(x.number) === i + 1); return { number: i + 1, total: row?.amount ?? '0.00', bets: Number(row?.count ?? 0) }; });
    const totalCents = perNumber.reduce((sum, x) => sum + Math.round(Number(x.total) * 100), 0); const c = await this.config(); const r = await this.rounds.findOne({ where: { id } });
    return { perNumber, total: (totalCents / 100).toFixed(2), adminReportingShare: (totalCents * Number(c.adminSharePercent) / 10000).toFixed(2), winningAllocationReporting: (totalCents * Number(c.winningAllocationPercent) / 10000).toFixed(2), payout: null, payoutNote: 'No player payout formula is defined; allocation is reporting metadata only.', joker: { enabled: r?.jokerEnabled ?? false, multiplier: r?.jokerMultiplier ?? 1 } };
  }
  async scheduleJoker(dto: JokerScheduleDto, actor: AuthUser) { const r = await this.rounds.findOne({ where: { id: dto.roundId } }); if (!r || r.status !== RoundStatus.UPCOMING) throw new BadRequestException('Joker can only be scheduled for an upcoming round'); return this.schedules.save(this.schedules.create({ ...dto, active: true, createdBy: actor.id })); }
  async jokerSchedules() { return this.schedules.find({ where: { active: true }, order: { roundId: 'ASC' } }); }
  async cancelSchedule(id: number) { const s = await this.schedules.findOne({ where: { id } }); if (!s) throw new NotFoundException('Schedule not found'); const r = await this.rounds.findOne({ where: { id: s.roundId } }); if (!r || r.status !== RoundStatus.UPCOMING) throw new ConflictException('Only schedules for upcoming rounds can be cancelled'); s.active = false; return this.schedules.save(s); }
  async placeBet(dto: CreateBetDto, actor: AuthUser) {
    const cents = Math.round(dto.amount * 100); if (!Number.isSafeInteger(cents) || cents <= 0) throw new BadRequestException('Invalid amount');
    return this.db.transaction(async m => { const existing = await m.getRepository(FunTargetBet).findOne({ where: { userId: actor.id, idempotencyKey: dto.idempotencyKey } }); if (existing) return existing;
      const r = await m.getRepository(FunTargetRound).findOne({ where: { id: dto.roundId }, lock: { mode: 'pessimistic_write' } }); if (!r || r.status !== RoundStatus.OPEN) throw new ConflictException('Bets are accepted only on open rounds');
      const c = await m.getRepository(FunTargetConfig).findOne({ where: { id: 1 } }); if (!c || dto.amount < Number(c.minBet) || dto.amount > Number(c.maxBet)) throw new BadRequestException('Bet amount is outside configured limits');
      if (c.denominationRestrictions && !c.denominations.includes(dto.amount)) throw new BadRequestException('Bet must match an allowed denomination');
      const wallet = await m.getRepository(Wallet).findOne({ where: { userId: actor.id }, lock: { mode: 'pessimistic_write' } }); if (!wallet) throw new BadRequestException('Wallet not found');
      const before = Math.round(Number(wallet.balance) * 100); if (before < cents) throw new BadRequestException('Insufficient wallet balance'); wallet.balance = ((before - cents) / 100).toFixed(2); await m.getRepository(Wallet).save(wallet);
      await m.getRepository(Transaction).save({ walletId: wallet.id, userId: actor.id, requestId: null, type: WalletTransactionType.DEBIT, source: WalletTransactionSource.GAME_ENTRY, amount: (cents / 100).toFixed(2), balanceBefore: (before / 100).toFixed(2), balanceAfter: wallet.balance, description: `Fun Target round ${dto.roundId}; idempotency ${dto.idempotencyKey}` });
      return m.getRepository(FunTargetBet).save({ ...dto, userId: actor.id, amount: (cents / 100).toFixed(2) }); });
  }
}
