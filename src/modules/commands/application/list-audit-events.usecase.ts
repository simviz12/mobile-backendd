import { AuditEventRepository } from '../domain/audit-event.repository.js';
import { AuditEvent } from '../domain/audit-event.entity.js';

export class ListAuditEventsUseCase {
  constructor(private readonly auditEventRepository: AuditEventRepository) {}

  async execute(
    userId: string,
    options?: { deviceId?: string; limit?: number },
  ): Promise<AuditEvent[]> {
    return this.auditEventRepository.findByUserId(userId, options);
  }
}
