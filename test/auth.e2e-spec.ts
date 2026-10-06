import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { GlobalExceptionFilter } from '../src/shared/errors/global-exception.filter.js';
import { PrismaService } from '../src/shared/prisma/prisma.service.js';
import { describe, it, expect, afterAll, beforeAll } from 'vitest';

describe('Auth Flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
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

    prisma = moduleFixture.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    // Clean test data
    await prisma.refreshToken.deleteMany({});
    await prisma.user.deleteMany({});
    await app.close();
  });

  const testUser = {
    email: 'guardian.e2e@example.com',
    password: 'SafePassword123!',
    displayName: 'Guardian Tester',
  };

  let accessToken: string;
  let refreshToken: string;

  it('POST /auth/register - validation errors when password has no digits or is short', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'invalid-email',
        password: 'short',
        displayName: '',
      })
      .expect(400);

    expect(response.body.error).toBeDefined();
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(response.body.error.details)).toBe(true);
  });

  it('POST /auth/register - 201 Created with valid payload', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send(testUser)
      .expect(201);

    expect(response.body.user).toMatchObject({
      email: testUser.email,
      displayName: testUser.displayName,
    });
    expect(response.body.accessToken).toBeDefined();
    expect(response.body.refreshToken).toBeDefined();
    expect(response.body.expiresIn).toBeGreaterThan(0);

    accessToken = response.body.accessToken;
    refreshToken = response.body.refreshToken;
  });

  it('POST /auth/register - 409 EMAIL_ALREADY_REGISTERED for duplicate email', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send(testUser)
      .expect(409);

    expect(response.body.error.code).toBe('EMAIL_ALREADY_REGISTERED');
  });

  it('POST /auth/login - 401 INVALID_CREDENTIALS for wrong password', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: testUser.email,
        password: 'WrongPassword999',
      })
      .expect(401);

    expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('POST /auth/login - 401 INVALID_CREDENTIALS for non-existent email', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'nonexistent@example.com',
        password: 'SomePassword123',
      })
      .expect(401);

    expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('POST /auth/login - 200 OK with correct credentials', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password,
      })
      .expect(200);

    expect(response.body.accessToken).toBeDefined();
    expect(response.body.refreshToken).toBeDefined();

    accessToken = response.body.accessToken;
    refreshToken = response.body.refreshToken;
  });

  it('GET /auth/me - 401 UNAUTHORIZED when Authorization header is missing', async () => {
    const response = await request(app.getHttpServer())
      .get('/auth/me')
      .expect(401);

    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('GET /auth/me - 200 OK when valid Bearer token is provided', async () => {
    const response = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.email).toBe(testUser.email);
    expect(response.body.displayName).toBe(testUser.displayName);
    expect(response.body.id).toBeDefined();
    expect(response.body.createdAt).toBeDefined();
  });

  it('POST /auth/refresh - 200 OK with token rotation', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(200);

    expect(response.body.accessToken).toBeDefined();
    expect(response.body.refreshToken).toBeDefined();
    expect(response.body.refreshToken).not.toBe(refreshToken);

    const oldToken = refreshToken;
    refreshToken = response.body.refreshToken;
    accessToken = response.body.accessToken;

    // Refresh reuse detection: using oldToken now MUST trigger 401 REFRESH_TOKEN_REUSED
    const reuseResponse = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: oldToken })
      .expect(401);

    expect(reuseResponse.body.error.code).toBe('REFRESH_TOKEN_REUSED');
  });

  it('POST /auth/logout - 204 No Content revokes session', async () => {
    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken })
      .expect(204);

    // Refreshing with the logged out token should now fail
    const response = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(401);

    // Revoked token reuse detection
    expect(response.body.error.code).toBe('REFRESH_TOKEN_REUSED');
  });
});
