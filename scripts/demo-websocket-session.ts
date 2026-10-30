import { io, Socket } from 'socket.io-client';
import http from 'http';

function post(path: string, body: any, headers: Record<string, string> = {}): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 3000,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          ...headers,
        },
      },
      (res) => {
        let b = '';
        res.on('data', (d) => (b += d));
        res.on('end', () => resolve({ status: res.statusCode ?? 500, body: b ? JSON.parse(b) : null }));
      },
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function run() {
  console.log('=== REALTIME WEBSOCKET DEMONSTRATION ===\n');

  // 1. Register test user
  const reg = await post('/auth/register', {
    email: `ws_demo_${Date.now()}@example.com`,
    password: 'Password123!',
    displayName: 'WS Demo User',
  });
  const token = reg.body.accessToken;
  const userId = reg.body.user.id;
  console.log(`[1] Registered User: ${userId}`);

  // 2. Connect socket.io client to /realtime namespace
  console.log('[2] Connecting Socket.IO client to http://127.0.0.1:3000/realtime ...');
  const socket: Socket = io('http://127.0.0.1:3000/realtime', {
    transports: ['websocket'],
    auth: { token },
  });

  await new Promise<void>((resolve, reject) => {
    socket.on('connect', () => {
      console.log(`[Socket.IO] Connected successfully with socket id: ${socket.id}`);
      resolve();
    });
    socket.on('connect_error', (err) => reject(err));
    setTimeout(() => reject(new Error('Connection timed out')), 4000);
  });

  // Attach event listeners
  socket.on('device.linked', (payload) => {
    console.log('\n[EVENT RECEIVED: device.linked]');
    console.log(JSON.stringify(payload, null, 2));
  });

  socket.on('device.status', (payload) => {
    console.log('\n[EVENT RECEIVED: device.status]');
    console.log(JSON.stringify(payload, null, 2));
  });

  socket.on('location.updated', (payload) => {
    console.log('\n[EVENT RECEIVED: location.updated]');
    console.log(JSON.stringify(payload, null, 2));
  });

  socket.on('command.updated', (payload) => {
    console.log('\n[EVENT RECEIVED: command.updated]');
    console.log(JSON.stringify(payload, null, 2));
  });

  // 3. Link device via REST
  console.log('\n[3] Calling POST /devices ...');
  const link = await post(
    '/devices',
    {
      installId: `ws_dev_${Date.now()}`,
      name: 'Pixel Realtime Test',
      platform: 'android',
      mode: 'PROTECTED',
      fcmToken: 'mock_ws_fcm_token',
    },
    { Authorization: `Bearer ${token}` },
  );
  const deviceId = link.body.device.id;
  const deviceToken = link.body.deviceToken;
  console.log(`Linked device: ${deviceId}`);

  await new Promise((r) => setTimeout(r, 600));

  // 4. Report status heartbeat via POST /devices/:id/status
  console.log('\n[4] Calling POST /devices/:id/status ...');
  await post(
    `/devices/${deviceId}/status`,
    {
      batteryLevel: 91,
      isCharging: true,
      networkType: 'wifi',
    },
    { Authorization: `Device ${deviceToken}` },
  );

  await new Promise((r) => setTimeout(r, 600));

  // 5. Post location via POST /devices/:id/locations
  console.log('\n[5] Calling POST /devices/:id/locations ...');
  await post(
    `/devices/${deviceId}/locations`,
    {
      latitude: 4.60971,
      longitude: -74.08175,
      accuracyMeters: 4.2,
      recordedAt: new Date().toISOString(),
      source: 'PERIODIC',
    },
    { Authorization: `Device ${deviceToken}` },
  );

  await new Promise((r) => setTimeout(r, 600));

  console.log('\n=== WEBSOCKET DEMO COMPLETED SUCCESSFULLY ===');
  socket.close();
  process.exit(0);
}

run().catch((err) => {
  console.error('Demo error:', err);
  process.exit(1);
});
