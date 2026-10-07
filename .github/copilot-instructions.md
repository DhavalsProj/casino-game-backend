# Copilot instructions

## Build, test, and lint

- `npm run build` — compile with the Nest CLI.
- `npm run lint` — lint `src/` and `test/` with Oxlint.
- `npm test -- --runInBand` — run all unit tests.
- `npm test -- --runInBand src/wallet/wallet.service.spec.ts` — run one unit-test file.
- `npm test -- --runInBand src/wallet/wallet.service.spec.ts -t "records a credit transaction"` — run a matching test by name.
- `npm run test:e2e -- --runInBand` — run end-to-end tests.
- `npm run test:e2e -- --runInBand --runTestsByPath test/app.e2e-spec.ts` — run one end-to-end test file.
- `npm run test:cov` — run unit tests with coverage.

## Architecture

- This is a NestJS HTTP API. `src/main.ts` configures CORS and the global `ValidationPipe`; `src/app.module.ts` chooses which feature modules are active.
- Runtime mode is selected by the exact environment value `DB_ENABLED=true`. In this mode, TypeORM connects to PostgreSQL and loads the users, auth, wallet, and transaction modules. Otherwise, `NoDbModule` provides in-memory login and user endpoints; wallet and transaction endpoints are not part of that mode.
- Feature modules group controllers, services, and TypeORM entities. Controllers expose routes and delegate business rules to services; services use injected repositories and coordinate across related domains where needed. Wallet requests, wallet balances, request-action history, and transactions are connected across the wallet and transaction modules.
- Authentication lives in `src/auth/`: login issues JWTs, `JwtAuthGuard` populates the request identity, `RolesGuard` enforces route role metadata, and `@CurrentUser()` exposes the authenticated `AuthUser`. Role checks alone do not establish access to a particular user's data; services enforce owner/agent relationships as well.
- `database/schema.sql` defines the PostgreSQL schema. `DB_SYNCHRONIZE` defaults to false, so database changes should be reflected in the schema and applicable migration scripts rather than relying on TypeORM to alter production tables.

## Repository-specific conventions

- Request DTOs use `class-validator` (and `class-transformer` where conversion is needed). The global validation pipe strips properties not declared by a DTO and transforms inputs; preserve this boundary for new request fields.
- Keep public user responses routed through `toUserResponse` in `src/users/user-response.ts`. Password columns are excluded from ordinary entity selection, and raw hashes or generated plaintext credentials must not be included in general lookup/list responses. Account creation returns its generated plaintext password once.
- User `id` values are numeric database IDs; `uniqueId` is the separate login/business identifier, while `agentId` refers to an agent's `uniqueId`. Preserve this distinction in route inputs, JWT claims, and access checks.
- Wallet API amounts are decimal strings with up to two fractional digits. Keep arithmetic in integer cents via the helpers in `WalletService` and persist/return normalized two-decimal strings; do not use floating-point arithmetic for balances.
- Wallet balance changes and their corresponding transaction records/request status and action history form one business operation. Keep those records consistent when modifying wallet flows, and retain the existing authorization checks for the target user.
- The established route aliases `/wallet` and `/wallets` and the legacy `/transcation` spelling are compatibility surfaces; account for them when changing wallet or transaction routes.
- Follow the existing feature layout: DTOs and entities live under their feature directory, and Jest unit tests are colocated as `*.spec.ts`; end-to-end tests use `test/*.e2e-spec.ts`.
