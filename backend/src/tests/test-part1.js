const http = require('http');

const BASE = 'http://localhost:5000/api';
let authToken = null;
let adminToken = null;
let nrToken = null;
let testCaseId = null;

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
        ...((tokenOverride || authToken) ? { Authorization: `Bearer ${tokenOverride || authToken}` } : {}),
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
    assert(res.body.token);
    adminToken = res.body.token;
    authToken = res.body.token;
  });

  await test('user1 login (All scope)', async () => {
    const res = await request('POST', '/auth/login', { email: 'user1', password: 'user1' });
    assert(res.status === 200);
    assert(res.body.user.railwayScope === 'All');
  });

  await test('usernr login (NR scope)', async () => {
    const res = await request('POST', '/auth/login', { email: 'usernr', password: 'usernr' });
    assert(res.status === 200);
    assert(res.body.user.railwayScope === 'NR');
    nrToken = res.body.token;
  });

  console.log('\n═══ Group 1: Data Integrity & Edge Cases ═══');
  await test('GET /api/cases/:id — non-existent case returns 404', async () => {
    const res = await request('GET', '/cases/99999');
    assert(res.status === 404);
  });

  await test('GET hearing timeline for case with hearings', async () => {
    const cases = (await request('GET', '/cases')).body;
    if (cases.length > 0) {
      const res = await request('GET', `/cases/${cases[0].id}/hearings`);
      assert(res.status === 200);
      assert(Array.isArray(res.body));
    }
  });

  await test('PATCH /api/cases/:id/status — empty status returns 400', async () => {
    const cases = (await request('GET', '/cases')).body;
    if (cases.length > 0) {
      const res = await request('PATCH', `/cases/${cases[0].id}/status`, { status: '' });
      assert(res.status === 400);
    }
  });

  await test('PATCH /api/cases/:id/next-hearing — missing date returns 400', async () => {
    const cases = (await request('GET', '/cases')).body;
    if (cases.length > 0) {
      const res = await request('PATCH', `/cases/${cases[0].id}/next-hearing`, { nextHearingDate: '' });
      assert(res.status === 400);
    }
  });

  console.log('\n═══ Group 2: Role-Based Access Control ═══');
  await test('usernr sees only NR cases', async () => {
    const res = await request('GET', '/cases', null, nrToken);
    assert(res.status === 200);
    const allNR = res.body.every(c => c.railway === 'NR');
    assert(allNR, 'Non-NR cases leaked to NR user');
  });

  await test('usernr gets 403 on admin file-activity', async () => {
    const res = await request('GET', '/admin/file-activity', null, nrToken);
    assert(res.status === 403);
  });

  await test('usernr gets 403 on AI draft endpoint', async () => {
    const res = await request('POST', '/ai/draft-reply', { uploadedText: 'test', precedents: [] }, nrToken);
    assert(res.status === 403);
  });

  await test('usernr gets 403 on sync endpoints', async () => {
    const res = await request('POST', '/sync/smart', null, nrToken);
    assert(res.status === 403 || res.status === 429, `Expected 403 or 429, got ${res.status}`);
  });

  console.log('\n═══ Group 3: Kanban Board APIs ═══');
  await test('GET /api/cases — returns cases with next_hearing_date field', async () => {
    const res = await request('GET', '/cases');
    assert(res.status === 200);
    if (res.body.length > 0) {
      assert('next_hearing_date' in res.body[0], 'Missing next_hearing_date field');
    }
  });

  await test('PATCH /api/cases/:id/status — valid update', async () => {
    const cases = (await request('GET', '/cases')).body;
    if (cases.length > 0) {
      const res = await request('PATCH', `/cases/${cases[0].id}/status`, { status: 'Active' });
      assert(res.status === 200);
      assert(res.body.success);
      assert(res.body.newStatus === 'Active');
    }
  });

  await test('PATCH /api/cases/:id/next-hearing — valid date update', async () => {
    const cases = (await request('GET', '/cases')).body;
    if (cases.length > 0) {
      const res = await request('PATCH', `/cases/${cases[0].id}/next-hearing`, { nextHearingDate: '2026-12-25' });
      assert(res.status === 200);
      assert(res.body.nextHearingDate === '2026-12-25');
    }
  });

  console.log('\n═══ Group 4: Calendar View ═══');
  await test('GET /api/reports/hearing-calendar returns data', async () => {
    const res = await request('GET', '/reports/hearing-calendar');
    assert(res.status === 200);
    assert(Array.isArray(res.body));
  });

  await test('GET /api/cases — filter by forum', async () => {
    const res = await request('GET', '/cases?case_type=OA');
    assert(res.status === 200);
    assert(Array.isArray(res.body));
  });

  await test('GET /api/cases — filter by status', async () => {
    const res = await request('GET', '/cases?status=Pending');
    assert(res.status === 200);
    assert(Array.isArray(res.body));
  });

  console.log(`\n═══════════════════`);
  console.log(`Part 1 Results: ${passed} passed, ${failed} failed out of ${passed + failed}`);
  console.log(`═══════════════════\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => { console.error('Runner error:', err); process.exit(1); });
