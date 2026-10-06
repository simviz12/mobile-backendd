import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AckCommandUseCase } from './ack-command.usecase.js';
import { CommandRepository } from '../domain/command.repository.js';
import { Command, CommandStatus, CommandType } from '../domain/command.entity.js';

describe('AckCommandUseCase (Unit Tests)', () => {
  let commandRepo: CommandRepository;
  let useCase: AckCommandUseCase;

  beforeEach(() => {
    commandRepo = {
      findById: vi.fn(),
      findAllByDeviceId: vi.fn(),
      findExpiredPendingOrSent: vi.fn(),
      create: vi.fn(),
      save: vi.fn().mockImplementation(async (c) => c),
    };
    useCase = new AckCommandUseCase(commandRepo);
  });

  it('should acknowledge DELIVERED from target device', async () => {
    const cmd = Command.create({
      id: 'cmd-1',
      deviceId: 'dev-1',
      issuedById: 'u1',
      type: CommandType.RING,
      status: CommandStatus.SENT,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60000),
    });
    vi.mocked(commandRepo.findById).mockResolvedValue(cmd);

    const res = await useCase.execute({
      commandId: 'cmd-1',
      authenticatingDeviceId: 'dev-1',
      status: 'DELIVERED',
    });

    expect(res.status).toBe(CommandStatus.DELIVERED);
    expect(res.deliveredAt).toBeDefined();
    expect(commandRepo.save).toHaveBeenCalled();
  });

  it('should reject with 403 FORBIDDEN if another device tries to ack', async () => {
    const cmd = Command.create({
      id: 'cmd-1',
      deviceId: 'dev-target',
      issuedById: 'u1',
      type: CommandType.RING,
      status: CommandStatus.SENT,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60000),
    });
    vi.mocked(commandRepo.findById).mockResolvedValue(cmd);

    await expect(
      useCase.execute({
        commandId: 'cmd-1',
        authenticatingDeviceId: 'dev-attacker',
        status: 'EXECUTED',
      }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      statusCode: 403,
    });
  });
});
