import test from 'node:test';
import assert from 'node:assert/strict';
import { filterRows, aggregateDashboard, durationMinutes } from '../src/dashboard-data.js';

const rows = [
  { id: 'r1', date: '2026-09-01', bird_count: 1000, status: 'accepted', customer_code: 'A-DK', customer: 'Alfa', region: 'Dakahlia', products: [{ id: 'v1', name: 'Product A', is_competitor: false, ampoule_count: 2 }, { id: 'v2', name: 'Product B', is_competitor: false, ampoule_count: 1 }, { id: 'v3', name: 'Competitor X', is_competitor: true, ampoule_count: null }] },
  { id: 'r2', date: '2026-09-14', bird_count: 1200, status: 'accepted', customer_code: 'A-SH', customer: 'Alfa', region: 'Sharqia', products: [{ id: 'v1', name: 'Product A', is_competitor: false, ampoule_count: 3 }] },
  { id: 'r3', date: '2026-08-03', bird_count: 800, status: 'needs_review', customer_code: 'B-DK', customer: 'Beta', region: 'Dakahlia', products: [{ id: 'v2', name: 'Product B', is_competitor: false, ampoule_count: 2 }] }
];

test('overall birds count each report once when it contains multiple products', () => {
  const result = aggregateDashboard(filterRows(rows, { status: ['accepted'] }));
  assert.equal(result.birds, 2200);
  assert.equal(result.batches, 2);
  assert.equal(result.productBirds, 3200);
});

test('customer identity follows separate regional customer codes', () => {
  const result = aggregateDashboard(filterRows(rows, { status: ['accepted'] }));
  assert.equal(result.customers, 2);
  assert.equal(result.customerByCode.get('A-DK').batches, 1);
  assert.equal(result.customerByCode.get('A-SH').batches, 1);
});

test('region, customer, product and status filters compose', () => {
  const filtered = filterRows(rows, { status: ['accepted'], region: 'Dakahlia', customerCode: 'A-DK', productId: 'v2' });
  assert.deepEqual(filtered.map(row => row.id), ['r1']);
  assert.equal(filterRows(rows, { status: ['needs_review'] }).length, 1);
});

test('product slicers use OR within each group and AND across groups', () => {
  const slicerRows = [
    { id: 'both-a', status: 'accepted', products: [{ id: 'own-a', is_competitor: false }, { id: 'comp-x', is_competitor: true }] },
    { id: 'both-b', status: 'accepted', products: [{ id: 'own-b', is_competitor: false }, { id: 'comp-y', is_competitor: true }] },
    { id: 'own-only', status: 'accepted', products: [{ id: 'own-a', is_competitor: false }] },
    { id: 'competitor-only', status: 'accepted', products: [{ id: 'comp-x', is_competitor: true }] },
  ];

  assert.deepEqual(filterRows(slicerRows, { productIds: ['own-a', 'own-b'] }).map(row => row.id), ['both-a', 'both-b', 'own-only']);
  assert.deepEqual(filterRows(slicerRows, { competitorProductIds: ['comp-x', 'comp-y'] }).map(row => row.id), ['both-a', 'both-b', 'competitor-only']);
  assert.deepEqual(filterRows(slicerRows, { productIds: ['own-a', 'own-b'], competitorProductIds: ['comp-x', 'comp-y'] }).map(row => row.id), ['both-a', 'both-b']);
  assert.deepEqual(filterRows(slicerRows, { productIds: ['own-a'], competitorProductIds: ['comp-y'] }), []);
  assert.deepEqual(filterRows(slicerRows, { productIds: [], competitorProductIds: [] }).map(row => row.id), slicerRows.map(row => row.id));
});

test('date filters include selected boundaries', () => {
  const filtered = filterRows(rows, { status: ['accepted'], dateFrom: '2026-09-14', dateTo: '2026-09-14' });
  assert.deepEqual(filtered.map(row => row.id), ['r2']);
});

test('duration handles overnight start/end values without AM/PM inference', () => {
  assert.equal(durationMinutes('22:30', '01:15'), 165);
  assert.equal(durationMinutes('09:00', '11:30'), 150);
  assert.equal(durationMinutes('9 PM', '1 AM'), null);
});

test('unknown customer codes are excluded from customer counts and rankings', () => {
  const unknown = { id: 'r4', date: '2026-09-20', bird_count: 500, status: 'accepted', customer_code: 'unknown:r4', customer: 'غير محدد', customer_known: false, region: null, products: [{ id: 'v1', name: 'Product A', is_competitor: false, ampoule_count: 1 }] };
  const result = aggregateDashboard([...rows.slice(0, 2), unknown]);
  assert.equal(result.customers, 2);
  assert.equal(result.productById.get('v1::zoetis').customers.size, 2);
  assert.deepEqual([...result.competitorNames], ['Competitor X']);
});

test('clearing all status selections returns no rows', () => {
  assert.equal(filterRows(rows, { status: [] }).length, 0);
});

test('repeated rows for one product add recorded ampoules but count batch birds once', () => {
  const row = {...rows[0], products: [
    { id: 'v1', name: 'Product A', is_competitor: false, ampoule_count: 2 },
    { id: 'v1', name: 'Product A', is_competitor: false, ampoule_count: 3 },
  ]};
  const product = aggregateDashboard([row]).productById.get('v1::zoetis');
  assert.equal(product.birds, 1000);
  assert.equal(product.batches, 1);
  assert.equal(product.ampoules, 5);
});

test('two separate report IDs remain separate batches on the same date', () => {
  const result = aggregateDashboard([rows[0], {...rows[0], id:'another-batch'}]);
  assert.equal(result.batches, 2);
  assert.equal(result.birds, 2000);
});

test('customer labels preserve saved single and regional identities without adding suffixes', async () => {
  const { customerLabel } = await import('../src/dashboard-data.js');
  const known = { customer_known: true, customer_code: 'single', customer: 'Single customer', region: 'Monofia' };
  assert.equal(customerLabel(known), 'Single customer');
  assert.equal(customerLabel({ ...known, customer_code: 'split:East', customer: 'Split customer (East)', region: 'East' }), 'Split customer (East)');
  assert.equal(customerLabel({ ...known, region: null }), 'Single customer');
  assert.equal(customerLabel({ customer_known: false, customer_code: 'unknown:1', customer: 'غير محدد' }), 'عميل غير محدد');
});
