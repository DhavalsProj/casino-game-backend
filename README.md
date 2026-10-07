<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

NestJS API for the casino game Angular frontend. It provides user creation, login, JWT authentication, and protected user lookup endpoints.

## Configuration

Copy `.env.example` to `.env` and set the PostgreSQL credentials and a strong `JWT_SECRET`. In pgAdmin 4, connect to your PostgreSQL server and use the existing `CasinoGameDB` database. For a fresh database, execute [`database/schema.sql`](database/schema.sql) to create all application, wallet, request, and transaction tables. For an existing database, run [`database/migrate-postgres-identifiers.sql`](database/migrate-postgres-identifiers.sql) if it still has the previous PostgreSQL column names, then run [`database/migrate-wallet-entity.sql`](database/migrate-wallet-entity.sql) if wallet audit columns are missing, and finally run [`database/migrate-wallet-api.sql`](database/migrate-wallet-api.sql) to create or update the wallet request and transaction tables and decimal amount columns. Set `DB_ENABLED=true` and the matching connection values in `.env` before starting the API. The default PostgreSQL port is `5432`. The Angular development server is allowed by default at `http://localhost:4200`; change `FRONTEND_URL` for another frontend origin.

The PostgreSQL schema script creates the application tables and indexes. `DB_SYNCHRONIZE` is disabled by default, so apply future schema changes explicitly. The script does not copy existing records from SQL Server; SQL Server data must be migrated separately before switching production traffic. [`database/schema.sql.bak`](database/schema.sql.bak) and [`database/create-app-login.sql`](database/create-app-login.sql) are legacy SQL Server artifacts and are not used by the PostgreSQL app. For an existing database, run [`database/migrate-superadmin-user.sql`](database/migrate-superadmin-user.sql) to allow a superadmin user to have a null `unique_id`; fresh databases get this from the schema script.

Set `SUPERADMIN_IDENTIFIER`, `SUPERADMIN_MOBILE`, and a strong `SUPERADMIN_PASSWORD` in `.env`. On first database-backed startup, the API hashes the password with bcrypt and inserts it into `SystemCredentials`; it does not overwrite an existing credential. Alternatively, run `npm run seed:superadmin` to create or update the superadmin row in `"Users"` and its credential in `"SystemCredentials"`. The seed command leaves `agent_id` and the legacy plaintext `password` field null; the database generates the ID and timestamps. Remove `SUPERADMIN_PASSWORD` from `.env` after the credential has been initialized; superadmin login uses only the database hash. Keep `.env` private. Regular user and agent passwords are bcrypt-hashed in `Users.password_hash`, with the generated plaintext returned once at account creation.

## API

Protected endpoints require bearer authentication in the Authorization header.

`POST /auth/login` accepts `{ "mobile": "...", "password": "..." }` or `{ "identifier": "...", "password": "..." }` and returns `{ "accessToken": "...", "user": { ... } }`.

### Users

- `POST /users/create` — `{ "name": "...", "mobile": "...", "type": "agent" | "user", "agentId": "..." }`. `agentId` is required for users and ignored for agents. The response includes generated credentials once.
- `GET /users?type=user&agentId=GK0012345` — lists users visible to the caller; admins can filter by type and agent, while agents always see only their own assigned users.
- `GET /users/agents` — admin/superadmin agent list.
- `POST /users/get-by-id` — `{ "id": 123 }`.
- `PATCH /users/:id` — `{ "name": "...", "mobile": "..." }`.
- `DELETE /users/:id`.

Credentials are not returned by user listing or lookup. User IDs in routes and payloads are numeric database IDs; `agentId` is the agent's `uniqueId`.

### Wallets and transactions

Both `/wallet/...` and `/wallets/...` paths are supported.

- `POST /wallets/create` — `{ "userId": 123, "points": "25.50" }`; adds the amount to the wallet and records a credit transaction.
- `GET /wallets/:userId` — returns the wallet, or `null` if it has not been created.
- `POST /wallets/request` — `{ "userId": 123, "amount": "10.25", "type": "ADD_POINTS" | "WITHDRAW" }`. Type defaults to `ADD_POINTS`; amounts support up to two decimal places.
- `GET /wallets/requests/:userId` — lists that user's requests.
- `PATCH /wallets/requests/:requestId/accept` and `PATCH /wallets/requests/:requestId/reject` — process a pending request. Withdrawals are rejected if the wallet balance is insufficient.
- `GET /wallets/:userId/transactions` or `GET /transactions/:userId` — lists transactions newest first. `/transcation/:userId` remains available as a legacy spelling.

Wallet and transaction reads are limited to admins/superadmins, the wallet owner, or the agent assigned to that user. In no-database mode (`DB_ENABLED` is not `true`), wallet and transaction routes are not available.

`GET /` is an unauthenticated health check.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Observability

In production applications, observability is essential for understanding how your system behaves, detecting issues early, and maintaining reliable performance.

[NestJS Observe](https://observe.nestjs.com) automatically instruments your NestJS application, giving you deep visibility into your system with minimal setup:

- **Distributed tracing:** Follow requests across services and understand how they flow through your system.
- **Waterfall analysis:** Visualize request execution and identify slow operations, bottlenecks, and unexpected delays.
- **Performance analysis:** Analyze application performance in real time and quickly pinpoint areas that need optimization.
- **Metrics:** Track key application and infrastructure metrics to understand system health and performance trends.
- **Logging:** Centralize and correlate logs with traces and other telemetry to make debugging easier.
- **Error tracking:** Detect errors quickly and investigate their root causes with the surrounding context.
- **SLA monitoring:** Track service-level objectives and identify when your application is approaching or exceeding defined thresholds.
- **Alarms and alerts:** Set up alerts for critical errors, performance degradation, SLA violations, and other anomalies so your team can react quickly.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Auto-instrument your application with [NestJS Observer](https://observer.nestjs.com). Distributed tracing, metrics, and logging made easy. Error tracking and performance monitoring for your NestJS applications.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
