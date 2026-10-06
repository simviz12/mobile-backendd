import { CommandRepository } from '../domain/command.repository.js';
import { DeviceRepository } from '../../devices/domain/device.repository.js';
import { Command } from '../domain/command.entity.js';
import { AppError } from '../../../shared/errors/app-error.js';

export class GetCommandUseCase {
  constructor(
    private readonly commandRepository: CommandRepository,
    private readonly deviceRepository: DeviceRepository,
  ) {}

  async execute(commandId: string, callerUserId: string): Promise<Command> {
    const command = await this.commandRepository.findById(commandId);
    if (!command) {
      throw new AppError('COMMAND_NOT_FOUND', 'Command not found', 404);
    }

    const device = await this.deviceRepository.findById(command.deviceId);
    const isIssuer = command.issuedById === callerUserId;
    const isDeviceOwner = device ? device.belongsTo(callerUserId) : false;

    if (!isIssuer && !isDeviceOwner) {
      throw new AppError('COMMAND_NOT_FOUND', 'Command not found', 404);
    }

    return command;
  }
}
