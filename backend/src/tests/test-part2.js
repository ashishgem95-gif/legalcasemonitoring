const http = require('http');

const BASE = 'http://localhost:5000/api';
let adminToken = null;
let nrToken = null;

function request(method, path, body = null, tokenOverride = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        ...((tokenOverride || adminToken) ? { Authorization: `Bearer ${tokenOverride || adminToken}` } : {}),
      },
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  let passed = 0;
  let failed = 0;

  const test = async (name, fn) => {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.log(`  ✗ ${name} — ${err.message}`);
      failed++;
    }
  };

  const assert = (condition, msg) => {
    if (!condition) throw new Error(msg || 'Assertion failed');
  };

  console.log('\n═══ Setup: Login ═══');
  await test('Admin login', async () => {
    const res = await request('POST', '/auth/login', { email: 'admin', password: 'abcd1234' });
    assert(res.status === 200);
    adminToken = res.body.token;
  });

  await test('Non-admin login', async () => {
    const res = await request('POST', '/auth/login', { email: 'usernr', password: 'usernr' });
    assert(res.status === 200);
    nrToken = res.body.token;
  });

  console.log('\n═══ Group 5: Analytics ═══');
  await test('GET /api/analytics/dashboard — has all KPI keys', async () => {
    const res = await request('GET', '/analytics/dashboard');
    assert(res.status === 200);
    assert(typeof res.body.total === 'number', 'Missing total');
    assert(typeof res.body.active === 'number', 'Missing active');
    assert(typeof res.body.disposed === 'number', 'Missing disposed');
    assert(typeof res.body.pendingReplies === 'number', 'Missing pendingReplies');
  });

  await test('GET /api/analytics/charts?range=30 — returns 4 data arrays', async () => {
    const res = await request('GET', '/analytics/charts?range=30');
    assert(res.status === 200);
    assert(Array.isArray(res.body.statusDistribution));
    assert(Array.isArray(res.body.hearingsPerWeek));
    assert(Array.isArray(res.body.disposalsTrend));
    assert(Array.isArray(res.body.casesByRailway));
  });

  await test('GET /api/analytics/charts?range=365 — longer range', async () => {
    const res = await request('GET', '/analytics/charts?range=365');
    assert(res.status === 200);
    assert(res.body.disposalsTrend.length >= 0);
  });

  await test('GET /api/analytics/health — system health', async () => {
    const res = await request('GET', '/analytics/health');
    assert(res.status === 200);
    assert(typeof res.body.database === 'object');
  });

  console.log('\n═══ Group 6: AI Affidavit Drafter ═══');
  await test('POST /api/ai/draft-reply — missing uploadedText returns 400', async () => {
    const res = await request('POST', '/ai/draft-reply', { precedents: [{ id: 5, case_ref_no: 'TEST' }] });
    assert(res.status === 400);
  });

  await test('POST /api/ai/draft-reply — missing precedents returns 400', async () => {
    const res = await request('POST', '/ai/draft-reply', { uploadedText: 'Some affidavit text here', caseType: 'OA' });
    assert(res.status === 400);
  });

  await test('POST /api/ai/draft-reply — non-admin returns 403', async () => {
    const res = await request('POST', '/ai/draft-reply', { uploadedText: 'test', precedents: [{ id: 5 }] }, nrToken);
    assert(res.status === 403);
  });

  console.log('\n═══ Group 7: File Activity Alerts ═══');
  await test('GET /api/admin/file-activity as admin', async () => {
    const res = await request('GET', '/admin/file-activity');
    assert(res.status === 200);
    assert(Array.isArray(res.body));
  });

  await test('POST /api/admin/file-activity/seen as admin', async () => {
    const res = await request('POST', '/admin/file-activity/seen');
    assert(res.status === 200);
    assert(res.body.success);
  });

  await test('GET /api/admin/file-activity as non-admin returns 403', async () => {
    const res = await request('GET', '/admin/file-activity', null, nrToken);
    assert(res.status === 403);
  });

  console.log('\n═══ Group 8: Sync & Re-sync ═══');
  await test('GET /api/sync/status returns state', async () => {
    const res = await request('GET', '/sync/status');
    assert(res.status === 200);
    assert('running' in res.body);
  });

  await test('POST /api/sync/case/:id — re-sync single case', async () => {
    const cases = (await request('GET', '/cases')).body;
    const catCase = cases.find(c => c.forum && c.forum.toUpperCase().startsWith('CAT'));
    if (catCase) {
      const res = await request('POST', `/sync/case/${catCase.id}`);
      assert(res.status === 200 || res.status === 409 || res.status === 429, `Expected 200/409/429, got ${res.status}`);
      if (res.status === 200) assert(typeof res.body.hearingsAdded === 'number');
    }
  });

  await test('Non-admin gets 403 on sync endpoints', async () => {
    const res = await request('POST', '/sync/smart', null, nrToken);
    assert(res.status === 403 || res.status === 429, `Expected 403 or 429, got ${res.status}`);
  });

  console.log(`\n═══════════════════`);
  console.log(`Part 2 Results: ${passed} passed, ${failed} failed out of ${passed + failed}`);
  console.log(`═══════════════════\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => { console.error('Runner error:', err); process.exit(1); });
