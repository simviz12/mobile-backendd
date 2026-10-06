import { Command } from './command.entity.js';

export interface CommandRepository {
  findById(id: string): Promise<Command | null>;
  findAllByDeviceId(deviceId: string, limit?: number): Promise<Command[]>;
  findExpiredPendingOrSent(now: Date): Promise<Command[]>;
  create(command: Command): Promise<Command>;
  save(command: Command): Promise<Command>;
}

export const COMMAND_REPOSITORY = Symbol('COMMAND_REPOSITORY');
