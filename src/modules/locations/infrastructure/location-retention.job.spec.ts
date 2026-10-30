import { describe, it, expect, vi } from 'vitest';
import { LocationRetentionJob } from './location-retention.job.js';
import { LocationRepository } from '../domain/location.repository.js';
import { ConfigService } from '@nestjs/config';

describe('LocationRetentionJob (Unit Tests)', () => {
  it('calls deleteOlderThan with cutoff date calculated from retention days', async () => {
    const mockRepo: LocationRepository = {
      create: vi.fn(),
      createMany: vi.fn(),
      findLatestByDeviceId: vi.fn(),
      findAllByDeviceId: vi.fn(),
      deleteOlderThan: vi.fn().mockResolvedValue(42),
    };

    const mockConfig = {
      get: vi.fn().mockReturnValue(30),
    } as unknown as ConfigService;

    const job = new LocationRetentionJob(mockRepo, mockConfig);
    const deletedCount = await job.handleRetention();

    expect(deletedCount).toBe(42);
    expect(mockRepo.deleteOlderThan).toHaveBeenCalledWith(expect.any(Date));

    // Verify cutoff date is roughly 30 days ago
    const callArg = vi.mocked(mockRepo.deleteOlderThan).mock.calls[0][0];
    const diffDays = Math.round((Date.now() - callArg.getTime()) / (24 * 60 * 60 * 1000));
    expect(diffDays).toBe(30);
  });
});
