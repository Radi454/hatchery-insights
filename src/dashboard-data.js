export const isKnownCustomer = row => Boolean(row.customer_known !== false && row.customer_code && !String(row.customer_code).startsWith('unknown:') && row.customer !== 'غير محدد');

// Regional suffixes belong to reviewed database identities, not presentation.
export const customerLabel = row => isKnownCustomer(row) ? String(row.customer).trim() : 'عميل غير محدد';

export function filterRows(rows, filters = {}) {
  const statuses = Array.isArray(filters.status) ? new Set(filters.status) : null;
  return rows.filter(row => {
    if (statuses && !statuses.has(row.status)) return false;
    if (filters.dateFrom && row.date < filters.dateFrom) return false;
    if (filters.dateTo && row.date > filters.dateTo) return false;
    if (filters.region && filters.region !== 'all') {
      const unassigned = filters.region === '__unassigned__';
      if (unassigned ? row.region != null : row.region !== filters.region) return false;
    }
    if (filters.customerCode && row.customer_code !== filters.customerCode) return false;
    const ownProductIds = filters.productIds ?? (filters.productId ? [filters.productId] : []);
    const competitorProductIds = filters.competitorProductIds ?? (filters.competitorProductId ? [filters.competitorProductId] : []);
    const yearIds = Array.isArray(filters.yearIds) ? filters.yearIds : [];
    if (yearIds.length && !yearIds.includes(String(row.date || '').slice(0, 4))) return false;
    if (ownProductIds.length && !row.products?.some(product => ownProductIds.includes(product.id) && !product.is_competitor)) return false;
    if (competitorProductIds.length && !row.products?.some(product => competitorProductIds.includes(product.id) && product.is_competitor)) return false;
    return true;
  });
}

export function aggregateDashboard(rows) {
  const uniqueRows = [...new Map(rows.map(row => [row.id, row])).values()];
  const customerByCode = new Map();
  const productById = new Map();
  const regionByName = new Map();
  const competitorNames = new Set();
  let birds = 0;

  for (const row of uniqueRows) {
    const birdCount = Number(row.bird_count) || 0;
    birds += birdCount;
    const customerKey = row.customer_code || `unassigned:${row.id}`;
    const knownCustomer = isKnownCustomer(row);
    const customer = customerByCode.get(customerKey) ?? {
      code: customerKey,
      name: row.customer || 'عميل غير محدد',
      batches: 0,
      birds: 0,
      regions: new Set(),
    };
    if (knownCustomer) {
      customer.batches += 1;
      customer.birds += birdCount;
      if (row.region) customer.regions.add(row.region);
      customerByCode.set(customerKey, customer);
    }

    const regionKey = row.region || '__unassigned__';
    const region = regionByName.get(regionKey) ?? { name: row.region, status: row.region_status, batches: 0, birds: 0 };
    region.batches += 1;
    region.birds += birdCount;
    regionByName.set(regionKey, region);

    const seenProducts = new Set();
    for (const item of row.products ?? []) {
      if (!item.name) continue;
      if (item.is_competitor) { competitorNames.add(item.name); continue; }
      const key = `${item.id || item.name}::${item.is_competitor ? 'competitor' : 'zoetis'}`;
      const firstInReport = !seenProducts.has(key);
      seenProducts.add(key);
      const product = productById.get(key) ?? {
        id: item.id || item.name,
        name: item.name,
        isCompetitor: false,
        category: item.category ?? null,
        batches: 0,
        birds: 0,
        ampoules: 0,
        ampoulesKnown: 0,
        customers: new Set(),
        regions: new Map(),
      };
      if (firstInReport) { product.batches += 1; product.birds += birdCount; }
      if (!item.is_competitor) {
        if (item.ampoule_count == null) product.ampoulesIncomplete = true;
        else {
          product.ampoules += Number(item.ampoule_count) || 0;
          product.ampoulesKnown += 1;
        }
      }
      if (knownCustomer) product.customers.add(customerKey);
      const productRegion = product.regions.get(regionKey) ?? { name: row.region, batches: 0, birds: 0 };
      if (firstInReport) { productRegion.batches += 1; productRegion.birds += birdCount; }
      product.regions.set(regionKey, productRegion);
      productById.set(key, product);
    }
  }

  return {
    birds,
    batches: uniqueRows.length,
    customers: customerByCode.size,
    productBirds: [...productById.values()].reduce((sum, product) => sum + product.birds, 0),
    customerByCode,
    productById,
    competitorNames,
    regionByName,
  };
}

export function durationMinutes(start, end) {
  const parse = value => {
    if (typeof value !== 'string' || !/^\d{2}:\d{2}(:\d{2})?$/.test(value)) return null;
    const [hour, minute, second = '0'] = value.split(':').map(Number);
    if (hour > 23 || minute > 59 || second > 59) return null;
    return hour * 60 + minute + Math.floor(second / 60);
  };
  const startMinute = parse(start);
  const endMinute = parse(end);
  if (startMinute == null || endMinute == null) return null;
  const delta = endMinute - startMinute;
  return delta < 0 ? delta + 24 * 60 : delta;
}

export function getReportProducts(row) {
  return (row.products ?? []).map(product => ({
    name: product.name,
    competitor: Boolean(product.is_competitor),
    ampoules: product.is_competitor ? null : product.ampoule_count,
    batchLot: product.is_competitor ? null : (product.batch_lot ?? null),
  }));
}
