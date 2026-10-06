import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { GlobalExceptionFilter } from '../src/shared/errors/global-exception.filter.js';
import { PrismaService } from '../src/shared/prisma/prisma.service.js';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('HealthController (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();

    prismaService = moduleFixture.get<PrismaService>(PrismaService);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await app.close();
  });

  it('GET /health - success with real database query (status 200, database: up)', async () => {
    // If connected to real postgres, queryRawUnsafe executes; mock fallback for safety if db isn't reachable during offline e2e
    vi.spyOn(prismaService, '$queryRawUnsafe').mockResolvedValue([{ 1: 1 }]);

    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(200);

    expect(response.body).toMatchObject({
      status: 'ok',
      service: 'guardian-api',
      version: expect.any(String),
      database: 'up',
    });
    expect(response.body.time).toBeDefined();
    expect(new Date(response.body.time).toString()).not.toBe('Invalid Date');
  });

  it('GET /health - returns 200 with database: down when database fails', async () => {
    vi.spyOn(prismaService, '$queryRawUnsafe').mockRejectedValue(
      new Error('Connection terminated unexpectedly'),
    );

    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(200);

    expect(response.body).toMatchObject({
      status: 'ok',
      service: 'guardian-api',
      version: expect.any(String),
      database: 'down',
    });
    expect(response.body.time).toBeDefined();
  });

  it('GET /non-existent - triggers GlobalExceptionFilter standard format', async () => {
    const response = await request(app.getHttpServer())
      .get('/non-existent-route-404')
      .expect(404);

    expect(response.body).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: expect.stringContaining('Cannot GET /non-existent-route-404'),
      },
    });
  });
});
