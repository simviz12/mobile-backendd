import { Command } from './command.entity.js';

export interface FindDeviceCommandsFilter {
  status?: string;
  type?: string;
  limit?: number;
  cursor?: string;
}

export interface CommandRepository {
  findById(id: string): Promise<Command | null>;
  findAllByDeviceId(
    deviceId: string,
    filter?: FindDeviceCommandsFilter,
  ): Promise<{ items: Command[]; nextCursor: string | null }>;
  findExpiredPendingOrSent(now: Date): Promise<Command[]>;
  create(command: Command): Promise<Command>;
  save(command: Command): Promise<Command>;
}

export const COMMAND_REPOSITORY = Symbol('COMMAND_REPOSITORY');
