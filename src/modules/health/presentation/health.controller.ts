import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CheckHealthUseCase } from '../application/check-health.usecase.js';
import { HealthResponseDto } from './health.dto.js';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly checkHealthUseCase: CheckHealthUseCase) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check API service and database health status' })
  @ApiResponse({
    status: 200,
    description: 'Health status response',
    type: HealthResponseDto,
  })
  async getHealth(): Promise<HealthResponseDto> {
    return this.checkHealthUseCase.execute();
  }
}
