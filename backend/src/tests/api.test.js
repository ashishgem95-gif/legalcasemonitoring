const http = require('http');

const BASE = 'http://localhost:5000/api';
let authToken = null;

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
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

  console.log('\n═══ Auth Tests ═══');
  await test('Login with valid credentials', async () => {
    const res = await request('POST', '/auth/login', { email: 'admin', password: 'abcd1234' });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body.token, 'No token returned');
    assert(res.body.user.id === 'admin', 'Wrong user id');
    authToken = res.body.token;
  });

  await test('Login with wrong password fails', async () => {
    const res = await request('POST', '/auth/login', { email: 'admin', password: 'wrong' });
    assert(res.status === 401, `Expected 401, got ${res.status}`);
  });

  await test('Login with missing fields fails', async () => {
    const res = await request('POST', '/auth/login', { email: 'admin' });
    assert(res.status === 400, `Expected 400, got ${res.status}`);
  });

  console.log('\n═══ Case CRUD Tests ═══');
  let testCaseId = null;

  await test('List cases', async () => {
    const res = await request('GET', '/cases');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.body), 'Response is not an array');
    if (res.body.length > 0) {
      assert(res.body[0].case_ref_no, 'Missing case_ref_no');
    }
  });

  await test('Create a case with validation', async () => {
    const res = await request('POST', '/cases', {
      case_ref_no: `TEST/WP/${Date.now()}/2026`,
      railway: 'NR',
      applicant: 'Test Petitioner',
      respondent: 'Union of India',
      case_type: 'WP',
      case_number: `${Date.now()}`,
      case_year: 2026,
      forum: 'HC',
      synopsis: 'Test case for integration testing.',
      present_status: 'Pending',
    });
    assert(res.status === 201, `Expected 201, got ${res.status} — ${JSON.stringify(res.body)}`);
    testCaseId = res.body.id;
  });

  await test('Create case without case_ref_no fails validation', async () => {
    const res = await request('POST', '/cases', { railway: 'NR' });
    assert(res.status === 400, `Expected 400, got ${res.status}`);
  });

  await test('Get case by ID', async () => {
    const res = await request('GET', `/cases/${testCaseId}`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body.id === testCaseId, 'Wrong case returned');
  });

  await test('Update case', async () => {
    const res = await request('PUT', `/cases/${testCaseId}`, {
      case_ref_no: `TEST/WP/${Date.now()}/2026`,
      railway: 'WR',
      present_status: 'Stay Granted',
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body.railway === 'WR', 'Railway not updated');
  });

  await test('Delete case', async () => {
    const res = await request('DELETE', `/cases/${testCaseId}`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  await test('Get deleted case returns 404', async () => {
    const res = await request('GET', `/cases/${testCaseId}`);
    assert(res.status === 404, `Expected 404, got ${res.status}`);
  });

  console.log('\n═══ New Endpoint Tests ═══');
  await test('FTS5 search', async () => {
    const res = await request('GET', '/search?q=Union+of+India&type=cases');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  await test('Analytics dashboard', async () => {
    const res = await request('GET', '/analytics/dashboard');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(typeof res.body.total === 'number', 'Missing total');
  });

  await test('System health', async () => {
    const res = await request('GET', '/analytics/health');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  await test('Export CSV', async () => {
    const res = await request('GET', '/reports/export?format=csv');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  await test('Hearing calendar', async () => {
    const res = await request('GET', '/reports/hearing-calendar');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  await test('Zone distribution', async () => {
    const res = await request('GET', '/reports/zone-distribution');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  await test('View presets', async () => {
    const listRes = await request('GET', '/view-presets');
    assert(listRes.status === 200, `Expected 200, got ${listRes.status}`);
  });

  await test('Audit log', async () => {
    const res = await request('GET', '/audit-log?limit=10');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  console.log(`\n═══════════════════`);
  console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
  console.log(`═══════════════════\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
