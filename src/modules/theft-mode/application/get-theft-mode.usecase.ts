import { DeviceRepository } from '../../devices/domain/device.repository.js';
import { TheftModeRepository } from '../domain/theft-mode.repository.js';
import { TheftMode } from '../domain/theft-mode.entity.js';
import { AppError } from '../../../shared/errors/app-error.js';

export class GetTheftModeUseCase {
  constructor(
    private readonly deviceRepository: DeviceRepository,
    private readonly theftModeRepository: TheftModeRepository,
  ) {}

  async getActive(deviceId: string, callerUserId: string): Promise<TheftMode> {
    const device = await this.deviceRepository.findById(deviceId);
    if (!device || !device.belongsTo(callerUserId)) {
      throw new AppError('DEVICE_NOT_FOUND', 'Device not found', 404);
    }

    const activeTheftMode = await this.theftModeRepository.findActiveByDeviceId(deviceId);
    if (!activeTheftMode) {
      throw new AppError(
        'THEFT_MODE_NOT_ACTIVE',
        'Theft mode is not active on this device',
        404,
      );
    }

    return activeTheftMode;
  }

  async getHistory(deviceId: string, callerUserId: string): Promise<TheftMode[]> {
    const device = await this.deviceRepository.findById(deviceId);
    if (!device || !device.belongsTo(callerUserId)) {
      throw new AppError('DEVICE_NOT_FOUND', 'Device not found', 404);
    }

    return this.theftModeRepository.findHistoryByDeviceId(deviceId);
  }
}
