import { describe, it, expect, vi } from 'vitest';
import { CheckHealthUseCase } from './check-health.usecase.js';
import { DatabaseHealthPort } from '../domain/database-health.port.js';

describe('CheckHealthUseCase', () => {
  const config = {
    serviceName: 'guardian-api',
    version: '0.0.1',
  };

  it('should return database "up" when database port reports healthy', async () => {
    const mockDbPort: DatabaseHealthPort = {
      isHealthy: vi.fn().mockResolvedValue(true),
    };

    const useCase = new CheckHealthUseCase(mockDbPort, config);
    const result = await useCase.execute();

    expect(result.status).toBe('ok');
    expect(result.service).toBe('guardian-api');
    expect(result.version).toBe('0.0.1');
    expect(result.database).toBe('up');
    expect(new Date(result.time).toString()).not.toBe('Invalid Date');
    expect(mockDbPort.isHealthy).toHaveBeenCalledTimes(1);
  });

  it('should return database "down" when database port reports unhealthy', async () => {
    const mockDbPort: DatabaseHealthPort = {
      isHealthy: vi.fn().mockResolvedValue(false),
    };

    const useCase = new CheckHealthUseCase(mockDbPort, config);
    const result = await useCase.execute();

    expect(result.status).toBe('ok');
    expect(result.service).toBe('guardian-api');
    expect(result.version).toBe('0.0.1');
    expect(result.database).toBe('down');
    expect(new Date(result.time).toString()).not.toBe('Invalid Date');
    expect(mockDbPort.isHealthy).toHaveBeenCalledTimes(1);
  });
});
