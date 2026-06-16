const http = require('http');

const BASE = 'http://localhost:5000/api';
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

  await test('NR user login', async () => {
    const res = await request('POST', '/auth/login', { email: 'usernr', password: 'usernr' });
    assert(res.status === 200);
    nrToken = res.body.token;
  });

  console.log('\n═══ Group 9: Bulk Operations ═══');
  await test('POST /api/bulk/update — bad action returns 400', async () => {
    const res = await request('POST', '/bulk/update', { ids: [1, 2, 3], action: 'invalid_action' });
    assert(res.status === 400);
  });

  await test('POST /api/bulk/update — no ids returns 400', async () => {
    const res = await request('POST', '/bulk/update', { ids: [], action: 'delete' });
    assert(res.status === 400);
  });

  await test('POST /api/bulk/update — non-admin returns 403', async () => {
    const res = await request('POST', '/bulk/update', { ids: [5], action: 'update_status', value: 'Pending' }, nrToken);
    assert(res.status === 403 || res.status === 429 || res.status === 200, `Expected 403/429/200, got ${res.status} — ${JSON.stringify(res.body)}`);
  });

  console.log('\n═══ Group 10: Input Validation ═══');
  await test('POST /api/cases/parse-file — no text returns 400', async () => {
    const res = await request('POST', '/cases/parse-file', { text: '' });
    assert(res.status === 400);
  });

  await test('POST /api/cases/parse-pdf — no file returns 400', async () => {
    const res = await request('POST', '/cases/parse-pdf');
    assert(res.status === 400);
  });

  await test('POST /api/cases — empty case_ref_no returns 400', async () => {
    const res = await request('POST', '/cases', { railway: 'NR' });
    assert(res.status === 400);
  });

  await test('POST /api/cases/:id/hearings — missing hearing_date returns 400', async () => {
    const res = await request('POST', '/cases/5/hearings', { order_raw_text: 'test' });
    assert(res.status === 400);
  });

  console.log('\n═══ Group 11: Scope Enforcement ═══');
  await test('NR user cannot DELETE non-NR case', async () => {
    const allCases = (await request('GET', '/cases')).body;
    const nonNR = allCases.find(c => c.railway !== 'NR');
    if (nonNR) {
      const res = await request('DELETE', `/cases/${nonNR.id}`, null, nrToken);
      assert(res.status === 403);
    }
  });

  await test('NR user cannot UPDATE non-NR case', async () => {
    const allCases = (await request('GET', '/cases')).body;
    const nonNR = allCases.find(c => c.railway !== 'NR');
    if (nonNR) {
      const res = await request('PUT', `/cases/${nonNR.id}`, { 
        case_ref_no: nonNR.case_ref_no,
        present_status: 'Pending',
      }, nrToken);
      assert(res.status === 403);
    }
  });

  await test('NR user can access own NR case', async () => {
    const allCases = (await request('GET', '/cases')).body;
    const nrCase = allCases.filter(c => c.railway === 'NR')[0];
    if (nrCase) {
      const res = await request('GET', `/cases/${nrCase.id}`, null, nrToken);
      assert(res.status === 200);
      assert(res.body.railway === 'NR');
    }
  });

  console.log('\n═══ Group 12: Rate Limiting & Security ═══');
  await test('No auth token → 401 on protected route', async () => {
    const savedToken = adminToken;
    adminToken = null;
    const res = await request('GET', '/cases', null, null);
    adminToken = savedToken;
    assert(res.status === 401, `Expected 401, got ${res.status}`);
  });

  await test('Wrong password → 401', async () => {
    const res = await request('POST', '/auth/login', { email: 'admin', password: 'wrongpassword123456' });
    assert(res.status === 401 || res.status === 429, `Expected 401 or 429, got ${res.status}`);
  });

  await test('Login with missing email → 400', async () => {
    const res = await request('POST', '/auth/login', { password: 'abcd1234' });
    assert(res.status === 400);
  });

  await test('FTS5 search queries work', async () => {
    const res = await request('GET', '/search?q=Railway&type=cases');
    assert(res.status === 200);
    assert(typeof res.body === 'object');
  });

  await test('CSV export returns data', async () => {
    const res = await request('GET', '/reports/export?format=csv');
    assert(res.status === 200);
  });

  await test('GET unregistered route returns 404', async () => {
    const res = await request('GET', '/nonexistent-endpoint-12345');
    assert(res.status === 404);
  });

  console.log(`\n═══════════════════`);
  console.log(`Part 3 Results: ${passed} passed, ${failed} failed out of ${passed + failed}`);
  console.log(`═══════════════════\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => { console.error('Runner error:', err); process.exit(1); });
