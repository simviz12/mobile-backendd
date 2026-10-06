import { describe, it, expect } from 'vitest';
import {
  Command,
  CommandStatus,
  CommandType,
  DomainError,
} from './command.entity.js';

describe('Command State Machine (Unit Tests)', () => {
  const createPendingCommand = () => {
    return Command.create({
      id: 'cmd-1',
      deviceId: 'dev-1',
      issuedById: 'usr-1',
      type: CommandType.RING,
      payload: { durationSeconds: 30 },
      status: CommandStatus.PENDING,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 120000),
    });
  };

  it('should transition PENDING -> SENT -> DELIVERED -> EXECUTED successfully', () => {
    const cmd = createPendingCommand();

    expect(cmd.status).toBe(CommandStatus.PENDING);
    expect(cmd.sentAt).toBeUndefined();

    cmd.markSent();
    expect(cmd.status).toBe(CommandStatus.SENT);
    expect(cmd.sentAt).toBeDefined();

    cmd.markDelivered();
    expect(cmd.status).toBe(CommandStatus.DELIVERED);
    expect(cmd.deliveredAt).toBeDefined();

    cmd.markExecuted();
    expect(cmd.status).toBe(CommandStatus.EXECUTED);
    expect(cmd.executedAt).toBeDefined();
    expect(cmd.isFinal()).toBe(true);
  });

  it('should allow idempotent acknowledgements for DELIVERED and EXECUTED without error', () => {
    const cmd = createPendingCommand();
    cmd.markSent();
    cmd.markDelivered();

    // Repeated delivery ack
    cmd.markDelivered();
    expect(cmd.status).toBe(CommandStatus.DELIVERED);

    cmd.markExecuted();
    // Repeated execution ack
    cmd.markExecuted();
    expect(cmd.status).toBe(CommandStatus.EXECUTED);
  });

  it('should transition any non-final state to FAILED or EXPIRED', () => {
    const cmd1 = createPendingCommand();
    cmd1.markFailed('DEVICE_OFFLINE');
    expect(cmd1.status).toBe(CommandStatus.FAILED);
    expect(cmd1.failureReason).toBe('DEVICE_OFFLINE');
    expect(cmd1.isFinal()).toBe(true);

    const cmd2 = createPendingCommand();
    cmd2.markSent();
    cmd2.markExpired();
    expect(cmd2.status).toBe(CommandStatus.EXPIRED);
    expect(cmd2.isFinal()).toBe(true);
  });

  it('should throw DomainError when attempting invalid state transitions', () => {
    const cmd = createPendingCommand();
    // Cannot jump PENDING -> DELIVERED directly
    expect(() => cmd.markDelivered()).toThrow(DomainError);

    cmd.markSent();
    cmd.markDelivered();
    cmd.markExecuted(); // Now final!

    // Cannot transition final EXECUTED state to FAILED or EXPIRED
    expect(() => cmd.markFailed('ERROR')).toThrow(DomainError);
    expect(() => cmd.markExpired()).toThrow(DomainError);
  });
});
