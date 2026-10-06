import { CommandRepository } from '../domain/command.repository.js';
import { Command } from '../domain/command.entity.js';
import { AppError } from '../../../shared/errors/app-error.js';

export interface AckCommandInput {
  commandId: string;
  authenticatingDeviceId: string;
  status: 'DELIVERED' | 'EXECUTED' | 'FAILED';
  reason?: string;
}

export class AckCommandUseCase {
  constructor(private readonly commandRepository: CommandRepository) {}

  async execute(input: AckCommandInput): Promise<Command> {
    const command = await this.commandRepository.findById(input.commandId);
    if (!command) {
      throw new AppError('COMMAND_NOT_FOUND', 'Command not found', 404);
    }

    // Device token must belong to the command's device
    if (command.deviceId !== input.authenticatingDeviceId) {
      throw new AppError(
        'FORBIDDEN',
        'Device is not the target of this command',
        403,
      );
    }

    // Idempotent transitions
    const now = new Date();
    switch (input.status) {
      case 'DELIVERED':
        command.markDelivered(now);
        break;
      case 'EXECUTED':
        command.markExecuted(now);
        break;
      case 'FAILED':
        command.markFailed(input.reason || 'DEVICE_EXECUTION_FAILED');
        break;
    }

    await this.commandRepository.save(command);
    return command;
  }
}
