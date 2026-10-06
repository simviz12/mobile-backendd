import { AuditEvent } from './audit-event.entity.js';

export interface AuditEventRepository {
  create(event: AuditEvent): Promise<AuditEvent>;
}

export const AUDIT_EVENT_REPOSITORY = Symbol('AUDIT_EVENT_REPOSITORY');
