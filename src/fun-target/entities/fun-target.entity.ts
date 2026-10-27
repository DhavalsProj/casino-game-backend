import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

export enum ResultMode {
  MANUAL = "MANUAL",
  RANDOM = "RANDOM",
}
export enum RoundStatus {
  UPCOMING = "UPCOMING",
  OPEN = "OPEN",
  CLOSED = "CLOSED",
  COMPLETED = "COMPLETED",
}

@Entity("fun_target_config")
export class FunTargetConfig {
  @PrimaryGeneratedColumn() id: number;
  @Column({ name: "game_name", default: "Fun Target" }) gameName: string;
  @Column({
    name: "min_bet",
    type: "decimal",
    precision: 15,
    scale: 2,
    default: "1.00",
  })
  minBet: string;
  @Column({
    name: "max_bet",
    type: "decimal",
    precision: 15,
    scale: 2,
    default: "5000.00",
  })
  maxBet: string;
  @Column({
    name: "denominations",
    type: "jsonb",
    default: () => "'[1,5,10,50,100,500,1000,5000]'",
  })
  denominations: number[];
  @Column({ name: "denomination_restrictions", default: true })
  denominationRestrictions: boolean;
  @Column({ name: "result_mode", type: "varchar", default: ResultMode.MANUAL })
  resultMode: ResultMode;
  @Column({ name: "joker_enabled", default: false }) jokerEnabled: boolean;
  @Column({ name: "joker_multiplier", type: "integer", default: 2 })
  jokerMultiplier: number;
  @Column({ name: "joker_frequency", type: "integer", default: 5 })
  jokerFrequency: number;
  @Column({
    name: "admin_share_percent",
    type: "decimal",
    precision: 5,
    scale: 2,
    default: "60.00",
  })
  adminSharePercent: string;
  @Column({
    name: "winning_allocation_percent",
    type: "decimal",
    precision: 5,
    scale: 2,
    default: "40.00",
  })
  winningAllocationPercent: string;
  @Column({ default: true }) active: boolean;
  @Column({ name: "created_by", type: "integer", nullable: true }) createdBy:
    number | null;
  @Column({ name: "updated_by", type: "integer", nullable: true }) updatedBy:
    number | null;
  @CreateDateColumn({ name: "created_at" }) createdAt: Date;
  @UpdateDateColumn({ name: "updated_at" }) updatedAt: Date;
}

@Entity("fun_target_rounds")
@Index("uq_fun_target_round_schedule", ["scheduledAt"], { unique: true })
export class FunTargetRound {
  @PrimaryGeneratedColumn() id: number;
  @Column({
    name: "round_number",
    type: "integer",
    unique: true,
    default: () => "nextval('fun_target_round_number_seq')",
  })
  roundNumber: number;
  @Column({ type: "varchar", default: RoundStatus.UPCOMING })
  status: RoundStatus;
  @Column({ name: "scheduled_at", type: "timestamptz" }) scheduledAt: Date;
  @Column({ name: "opened_at", type: "timestamptz", nullable: true })
  openedAt: Date | null;
  @Column({ name: "closed_at", type: "timestamptz", nullable: true })
  closedAt: Date | null;
  @Column({ name: "result_mode", type: "varchar" }) resultMode: ResultMode;
  @Column({ name: "joker_enabled", default: false }) jokerEnabled: boolean;
  @Column({ name: "joker_multiplier", type: "integer", default: 1 })
  jokerMultiplier: number;
  @Column({ name: "winning_number", type: "integer", nullable: true })
  winningNumber: number | null;
  @Column({ name: "result_generated_by", type: "integer", nullable: true })
  resultGeneratedBy: number | null;
  @Column({ name: "result_generated_at", type: "timestamptz", nullable: true })
  resultGeneratedAt: Date | null;
  @Column({ name: "finalized_by", type: "integer", nullable: true })
  finalizedBy: number | null;
  @Column({ name: "finalized_at", type: "timestamptz", nullable: true })
  finalizedAt: Date | null;
  @Column({ name: "created_by", type: "integer", nullable: true }) createdBy:
    number | null;
  @CreateDateColumn({ name: "created_at" }) createdAt: Date;
}

@Entity("fun_target_bets")
@Index("uq_fun_target_bet_idempotency", ["userId", "idempotencyKey"], {
  unique: true,
})
export class FunTargetBet {
  @PrimaryGeneratedColumn() id: number;
  @Column({ name: "round_id", type: "integer" }) roundId: number;
  @Column({ name: "user_id", type: "integer" }) userId: number;
  @Column({ name: "number", type: "integer" }) number: number;
  @Column({ type: "decimal", precision: 15, scale: 2 }) amount: string;
  @Column({ name: "idempotency_key", type: "varchar", length: 100 })
  idempotencyKey: string;
  @CreateDateColumn({ name: "created_at" }) createdAt: Date;
}

@Entity("fun_target_joker_schedules")
@Index("uq_fun_target_joker_round", ["roundId"], { unique: true })
export class FunTargetJokerSchedule {
  @PrimaryGeneratedColumn() id: number;
  @Column({ name: "round_id", type: "integer" }) roundId: number;
  @Column({ type: "integer" }) multiplier: number;
  @Column({ default: true }) active: boolean;
  @Column({ name: "created_by", type: "integer", nullable: true }) createdBy:
    number | null;
  @CreateDateColumn({ name: "created_at" }) createdAt: Date;
}

@Entity("fun_target_result_audit")
export class FunTargetResultAudit {
  @PrimaryGeneratedColumn() id: number;
  @Column({ name: "round_id", type: "integer" }) roundId: number;
  @Column({ name: "actor_id", type: "integer" }) actorId: number;
  @Column({ type: "varchar", length: 30 }) action: string;
  @Column({ name: "winning_number", type: "integer", nullable: true })
  winningNumber: number | null;
  @CreateDateColumn({ name: "created_at" }) createdAt: Date;
}
