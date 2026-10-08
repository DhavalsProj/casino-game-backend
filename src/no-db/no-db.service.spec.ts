import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { NoDbService } from './no-db.service';
import { PasswordService } from '../auth/password.service';
import { UserType } from '../users/entities/user.entity';

describe('NoDbService account creation', () => {
  it('uses the shared password behavior for admin-created agents and agent-created users', async () => {
    const service = new NoDbService({} as JwtService, new PasswordService());
    await service.onModuleInit();

    const agentResult = await service.create(
      { name: 'Created Agent', mobile: '9876543212', type: UserType.AGENT },
      { type: 'superadmin' } as any,
    );
    const agent = (service as any).users.find((item: any) => item.uniqueId === agentResult.user.uniqueId);
    expect(agent.password).toBe(agentResult.credentials.password);
    await expect(bcrypt.compare(agent.password, agent.passwordHash)).resolves.toBe(true);

    const userResult = await service.create(
      { name: 'Created User', mobile: '9876543213', type: UserType.AGENT, agentId: 'OTHER' },
      { id: agent.id, type: UserType.AGENT, uniqueId: agent.uniqueId, agentId: agent.uniqueId } as any,
    );
    const user = (service as any).users.find((item: any) => item.uniqueId === userResult.user.uniqueId);
    expect(user).toMatchObject({ type: UserType.USER, agentId: agent.uniqueId });
    expect(user.password).toBe(userResult.credentials.password);
    await expect(bcrypt.compare(user.password, user.passwordHash)).resolves.toBe(true);
    expect(userResult).not.toHaveProperty('passwordHash');
    expect(userResult).not.toHaveProperty('user.password');
  });
});
