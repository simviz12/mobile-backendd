/**
 * Acceptance Script for Part 8: Theft Mode
 */
async function main() {
  const baseUrl = 'http://localhost:3000';

  console.log('=== Step 1: Register and login owner ===');
  const userRes = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `demo.theft.${Date.now()}@example.com`,
      password: 'SafePassword123!',
      displayName: 'Theft Mode Demo Owner',
    }),
  });
  const userData = await userRes.json();
  const token = userData.accessToken;
  console.log('Registered User Token:', token ? 'OK' : 'FAIL');

  console.log('\n=== Step 2: Link protected device ===');
  const linkRes = await fetch(`${baseUrl}/devices`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      installId: `install-theft-demo-${Date.now()}`,
      name: 'Owner Locked Device',
      platform: 'android',
      mode: 'PROTECTED',
      fcmToken: 'fcm-theft-demo-token',
    }),
  });
  const linkData = await linkRes.json();
  const deviceId = linkData.device.id;
  const deviceToken = linkData.deviceToken;
  console.log(`Device Linked: ${deviceId}, adminEnabled: ${linkData.device.adminEnabled}`);

  console.log('\n=== Step 3: Attempt activate theft mode with lock=true (before adminEnabled) ===');
  const rejectRes = await fetch(`${baseUrl}/devices/${deviceId}/theft-mode`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      message: 'Devolver teléfono a la oficina central.',
      contactPhone: '+573009998877',
      locationIntervalSeconds: 60,
      alarm: true,
      lock: true,
    }),
  });
  console.log(`Lock capability rejection status: ${rejectRes.status}`);
  console.log(await rejectRes.json());

  console.log('\n=== Step 4: Device reports adminEnabled=true ===');
  const capRes = await fetch(`${baseUrl}/devices/${deviceId}/capabilities`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Device ${deviceToken}`,
    },
    body: JSON.stringify({ adminEnabled: true }),
  });
  const capData = await capRes.json();
  console.log(`Device capabilities updated. adminEnabled: ${capData.device.adminEnabled}`);

  console.log('\n=== Step 5: Activate theft mode successfully ===');
  const actRes = await fetch(`${baseUrl}/devices/${deviceId}/theft-mode`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      message: 'Devolver teléfono a la oficina central.',
      contactPhone: '+573009998877',
      locationIntervalSeconds: 60,
      alarm: true,
      lock: true,
    }),
  });
  console.log(`Activation status: ${actRes.status}`);
  const actData = await actRes.json();
  console.log(JSON.stringify(actData, null, 2));

  console.log('\n=== Step 6: Verify Device has theftModeActive: true ===');
  const devRes = await fetch(`${baseUrl}/devices/${deviceId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const devData = await devRes.json();
  console.log(`Device theftModeActive: ${devData.theftModeActive}`);

  console.log('\n=== Step 7: Attempt duplicate activation (should return 409) ===');
  const dupRes = await fetch(`${baseUrl}/devices/${deviceId}/theft-mode`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      message: 'Segundo intento duplicado.',
      locationIntervalSeconds: 120,
      alarm: false,
      lock: true,
    }),
  });
  console.log(`Duplicate activation status: ${dupRes.status}`);
  console.log(await dupRes.json());

  console.log('\n=== Step 8: GET /devices/:id/theft-mode and /history ===');
  const getActRes = await fetch(`${baseUrl}/devices/${deviceId}/theft-mode`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log('Active theft mode:', await getActRes.json());

  const getHistRes = await fetch(`${baseUrl}/devices/${deviceId}/theft-mode/history`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log('History count:', (await getHistRes.json()).length);

  console.log('\n=== Step 9: Attempt deactivation with incorrect password ===');
  const badPassRes = await fetch(`${baseUrl}/devices/${deviceId}/theft-mode`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ password: 'BadPasswordWrong!' }),
  });
  console.log(`Wrong password rejection status: ${badPassRes.status}`);
  console.log(await badPassRes.json());

  console.log('\n=== Step 10: Force deactivate with correct password ===');
  const deactRes = await fetch(`${baseUrl}/devices/${deviceId}/theft-mode?force=true`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ password: 'SafePassword123!' }),
  });
  console.log(`Deactivation status: ${deactRes.status}`);
  console.log(await deactRes.json());

  console.log('\n=== Step 11: Confirm active theft mode is now 404 ===');
  const checkClosedRes = await fetch(`${baseUrl}/devices/${deviceId}/theft-mode`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log(`Active theft mode query after deactivation: ${checkClosedRes.status}`);
  console.log(await checkClosedRes.json());

  console.log('\n=== Demo Completed Successfully ===');
}

main().catch(console.error);
