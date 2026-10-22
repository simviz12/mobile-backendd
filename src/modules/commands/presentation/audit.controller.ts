import { Controller, Get, HttpCode, HttpStatus, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/presentation/jwt-auth.guard.js';
import { CurrentUser } from '../../auth/presentation/current-user.decorator.js';
import type { JwtValidatedUser } from '../../auth/infrastructure/jwt.strategy.js';
import { ListAuditEventsUseCase } from '../application/list-audit-events.usecase.js';
import { AuditEvent } from '../domain/audit-event.entity.js';

@ApiTags('Audit')
@Controller('audit')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AuditController {
  constructor(private readonly listAuditEventsUseCase: ListAuditEventsUseCase) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List audit trail events for authenticated user' })
  @ApiQuery({ name: 'deviceId', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'List of audit events' })
  async listAuditEvents(
    @CurrentUser() user: JwtValidatedUser,
    @Query('deviceId') deviceId?: string,
    @Query('limit') limitStr?: string,
  ): Promise<any[]> {
    const limit = limitStr ? Math.min(Math.max(parseInt(limitStr, 10) || 50, 1), 100) : 50;
    const events = await this.listAuditEventsUseCase.execute(user.userId, {
      deviceId,
      limit,
    });
    return events.map((event: AuditEvent) => ({
      id: event.id,
      userId: event.userId,
      deviceId: event.deviceId,
      action: event.action,
      metadata: event.metadata,
      createdAt: event.createdAt.toISOString(),
    }));
  }
}
