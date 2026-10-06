import { CommandRepository } from '../domain/command.repository.js';
import { DeviceRepository } from '../../devices/domain/device.repository.js';
import { Command } from '../domain/command.entity.js';
import { AppError } from '../../../shared/errors/app-error.js';

export interface ListDeviceCommandsInput {
  deviceId: string;
  callerUserId: string;
  limit?: number;
  cursor?: string;
  status?: string;
  type?: string;
}

export class ListDeviceCommandsUseCase {
  constructor(
    private readonly commandRepository: CommandRepository,
    private readonly deviceRepository: DeviceRepository,
  ) {}

  async execute(input: ListDeviceCommandsInput): Promise<{ items: Command[]; nextCursor: string | null }> {
    const device = await this.deviceRepository.findById(input.deviceId);
    if (!device || !device.belongsTo(input.callerUserId)) {
      throw new AppError('DEVICE_NOT_FOUND', 'Device not found', 404);
    }

    return this.commandRepository.findAllByDeviceId(input.deviceId, {
      limit: input.limit,
      cursor: input.cursor,
      status: input.status,
      type: input.type,
    });
  }
}
