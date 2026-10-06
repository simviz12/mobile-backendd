import { CommandRepository } from '../domain/command.repository.js';
import { DeviceRepository } from '../../devices/domain/device.repository.js';
import { Command } from '../domain/command.entity.js';
import { AppError } from '../../../shared/errors/app-error.js';

export class ListDeviceCommandsUseCase {
  constructor(
    private readonly commandRepository: CommandRepository,
    private readonly deviceRepository: DeviceRepository,
  ) {}

  async execute(
    deviceId: string,
    callerUserId: string,
    limit: number = 20,
  ): Promise<Command[]> {
    const device = await this.deviceRepository.findById(deviceId);
    if (!device || !device.belongsTo(callerUserId)) {
      throw new AppError('DEVICE_NOT_FOUND', 'Device not found', 404);
    }

    return this.commandRepository.findAllByDeviceId(deviceId, limit);
  }
}
