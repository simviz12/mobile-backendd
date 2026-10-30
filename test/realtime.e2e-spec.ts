import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { io, Socket } from 'socket.io-client';
import { AppModule } from '../src/app.module.js';
import { GlobalExceptionFilter } from '../src/shared/errors/global-exception.filter.js';
import { PrismaService } from '../src/shared/prisma/prisma.service.js';
import { DeviceHeartbeatJob } from '../src/modules/devices/infrastructure/device-heartbeat.job.js';
import { describe, it, expect, afterAll, beforeAll } from 'vitest';

describe('Realtime WebSocket Flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let heartbeatJob: DeviceHeartbeatJob;
  let baseUrl: string;

  let tokenUserA: string;
  let userAId: string;
  let tokenUserB: string;

  let deviceAId: string;
  let deviceAToken: string;

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
    await app.listen(0); // dynamic port

    const server = app.getHttpServer();
    const address = server.address();
    const port = typeof address === 'string' ? 3000 : address.port;
    baseUrl = `http://127.0.0.1:${port}`;

    prisma = moduleFixture.get<PrismaService>(PrismaService);
    heartbeatJob = moduleFixture.get<DeviceHeartbeatJob>(DeviceHeartbeatJob);

    // Register User A
    const regA = await request(server)
      .post('/auth/register')
      .send({
        email: `realtime_a_${Date.now()}@example.com`,
        password: 'Password123!',
        displayName: 'User A',
      });
    tokenUserA = regA.body.accessToken;
    userAId = regA.body.user.id;

    // Register User B
    const regB = await request(server)
      .post('/auth/register')
      .send({
        email: `realtime_b_${Date.now()}@example.com`,
        password: 'Password123!',
        displayName: 'User B',
      });
    tokenUserB = regB.body.accessToken;
  });

  afterAll(async () => {
    await prisma.command.deleteMany({});
    await prisma.location.deleteMany({});
    await prisma.device.deleteMany({});
    await prisma.refreshToken.deleteMany({});
    await prisma.user.deleteMany({});
    await app.close();
  });

  it('rejects connection without token or with invalid token', async () => {
    const socket = io(`${baseUrl}/realtime`, {
      transports: ['websocket'],
      auth: { token: 'invalid_jwt_token' },
      reconnection: false,
    });

    const disconnected = await new Promise<boolean>((resolve) => {
      socket.on('disconnect', () => resolve(true));
      socket.on('connect_error', () => resolve(true));
      setTimeout(() => resolve(false), 2000);
    });

    socket.close();
    expect(disconnected).toBe(true);
  });

  it('authenticates with valid user JWT and receives device.linked, device.status, location.updated, and command.updated events', async () => {
    // Connect client A
    const clientA: Socket = io(`${baseUrl}/realtime`, {
      transports: ['websocket'],
      auth: { token: tokenUserA },
      reconnection: false,
    });

    // Connect client B
    const clientB: Socket = io(`${baseUrl}/realtime`, {
      transports: ['websocket'],
      auth: { token: tokenUserB },
      reconnection: false,
    });

    await new Promise<void>((resolve, reject) => {
      let count = 0;
      const check = () => {
        count++;
        if (count === 2) resolve();
      };
      clientA.on('connect', check);
      clientB.on('connect', check);
      setTimeout(() => reject(new Error('Clients failed to connect')), 3000);
    });

    const receivedEventsA: { event: string; data: any }[] = [];
    const receivedEventsB: { event: string; data: any }[] = [];

    clientA.on('device.linked', (d) => receivedEventsA.push({ event: 'device.linked', data: d }));
    clientA.on('device.status', (d) => receivedEventsA.push({ event: 'device.status', data: d }));
    clientA.on('command.updated', (d) => receivedEventsA.push({ event: 'command.updated', data: d }));
    clientA.on('location.updated', (d) => receivedEventsA.push({ event: 'location.updated', data: d }));

    clientB.on('device.linked', (d) => receivedEventsB.push({ event: 'device.linked', data: d }));
    clientB.on('device.status', (d) => receivedEventsB.push({ event: 'device.status', data: d }));
    clientB.on('command.updated', (d) => receivedEventsB.push({ event: 'command.updated', data: d }));
    clientB.on('location.updated', (d) => receivedEventsB.push({ event: 'location.updated', data: d }));

    // 1. Link a device for User A -> Should emit device.linked to client A only
    const linkRes = await request(app.getHttpServer())
      .post('/devices')
      .set('Authorization', `Bearer ${tokenUserA}`)
      .send({
        installId: `ws-install-${Date.now()}`,
        name: 'Realtime Protected Phone',
        platform: 'android',
        mode: 'PROTECTED',
        fcmToken: 'fcm-ws-token',
      })
      .expect(201);

    deviceAId = linkRes.body.device.id;
    deviceAToken = linkRes.body.deviceToken;

    // Wait 200ms for websocket delivery
    await new Promise((r) => setTimeout(r, 200));

    expect(receivedEventsA.some((e) => e.event === 'device.linked' && e.data.deviceId === deviceAId)).toBe(true);
    // User B must NOT receive User A's events (room isolation)
    expect(receivedEventsB.length).toBe(0);

    // 2. Device posts status heartbeat -> Should emit device.status to client A only
    await request(app.getHttpServer())
      .post(`/devices/${deviceAId}/status`)
      .set('Authorization', `Device ${deviceAToken}`)
      .send({
        batteryLevel: 88,
        isCharging: false,
        networkType: 'wifi',
      })
      .expect(204);

    await new Promise((r) => setTimeout(r, 200));

    const statusEvent = receivedEventsA.find((e) => e.event === 'device.status' && e.data.deviceId === deviceAId);
    expect(statusEvent).toBeDefined();
    expect(statusEvent?.data.batteryLevel).toBe(88);
    expect(statusEvent?.data.networkType).toBe('wifi');
    expect(statusEvent?.data.isOnline).toBe(true);
    expect(receivedEventsB.length).toBe(0);

    // 3. Device posts location -> Should emit location.updated to client A only
    await request(app.getHttpServer())
      .post(`/devices/${deviceAId}/locations`)
      .set('Authorization', `Device ${deviceAToken}`)
      .send({
        latitude: 4.6097,
        longitude: -74.0817,
        accuracyMeters: 5.5,
        recordedAt: new Date().toISOString(),
        source: 'PERIODIC',
      })
      .expect(201);

    await new Promise((r) => setTimeout(r, 200));

    const locationEvent = receivedEventsA.find((e) => e.event === 'location.updated' && e.data.deviceId === deviceAId);
    expect(locationEvent).toBeDefined();
    expect(locationEvent?.data.location.latitude).toBe(4.6097);
    expect(receivedEventsB.length).toBe(0);

    // 4. Create command and ack it -> Should emit command.updated to client A only
    const cmd = await prisma.command.create({
      data: {
        id: `cmd-ws-${Date.now()}`,
        deviceId: deviceAId,
        issuedById: userAId,
        type: 'RING',
        status: 'SENT',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 60000),
      },
    });

    await request(app.getHttpServer())
      .post(`/commands/${cmd.id}/ack`)
      .set('Authorization', `Device ${deviceAToken}`)
      .send({ status: 'EXECUTED' })
      .expect(200);

    await new Promise((r) => setTimeout(r, 200));

    const cmdEvent = receivedEventsA.find((e) => e.event === 'command.updated' && e.data.commandId === cmd.id);
    expect(cmdEvent).toBeDefined();
    expect(cmdEvent?.data.status).toBe('EXECUTED');
    expect(receivedEventsB.length).toBe(0);

    // 5. Test offline transition via heartbeat job with controlled clock (500s later)
    receivedEventsA.length = 0;
    const futureTime = new Date(Date.now() + 500 * 1000);
    await heartbeatJob.checkHeartbeats(futureTime);

    await new Promise((r) => setTimeout(r, 200));

    const offlineEvent = receivedEventsA.find((e) => e.event === 'device.status' && e.data.deviceId === deviceAId && e.data.isOnline === false);
    expect(offlineEvent).toBeDefined();

    clientA.close();
    clientB.close();
  });
});
