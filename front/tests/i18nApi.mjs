// Isolated API fixtures for the language-switching browser check.
export function createI18nApi() {
  // Keep fixture listings valid throughout a browser check.
  const LIST_CACHE_TTL_MS = 60 * 60 * 1000;
  const now = new Date().toISOString();
  const cache = { fetchedAt: now, expiresAt: new Date(Date.now() + LIST_CACHE_TTL_MS).toISOString(), hit: false };
  const connection = {
    id: 'sample-storage', name: 'Research storage', endpoint: 'https://storage.example.invalid',
    region: 'us-east-1', accessKeyIdMasked: '••••', forcePathStyle: true, listObjectsVersion: 'v2',
    capabilities: { list: true, preview: true, download: true, archive: true, audioInfo: true,
      audioSpectrogram: true, readmeRead: true, readmeWrite: true },
    scanEnabled: true, listCacheTtlSec: 86400, createdAt: now, updatedAt: now, isDefault: true,
    pricing: {
      provider: 'onprem', providerExplicit: false, region: null, storageClass: null,
      storageClassLabel: null, ratesResolved: true, readMbps: 300, writeMbps: 300, parallelism: 16,
      requestOverheadMs: 20, instability: 0.5, capacityBytes: null, storagePerGbMonth: null,
      egressPerGb: null, putPer1000: null, getPer1000: null,
      effective: { storagePerGbMonth: null, egressPerGb: null, putPer1000: 0, getPer1000: 0,
        retrievalPerGb: 0, minDurationDays: 0, minBillableBytes: 0, perObjectOverheadBytes: 0,
        storageRateSource: 'none' },
    },
  };
  const state = { loggedIn: true, calls: [] };
  const user = {
    id: '00000000-0000-4000-8000-000000000001', username: 'sample-user', email: null,
    displayName: 'Sample user', signatureName: 'Sample user', roles: ['admin'],
    permissions: ['users:manage', 'service_accounts:manage', 'audit:read'], mustChangePassword: false,
  };
  async function route(route) {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    state.calls.push({ method: request.method(), path });
    const reply = (payload, status = 200) => route.fulfill({ status,
      contentType: 'application/json', body: JSON.stringify(payload) });
    if (path === '/api/auth/config') return reply({ localEnabled: true, oidc: { enabled: false } });
    if (path === '/api/auth/me') return state.loggedIn ? reply({ user }) : reply({ error: 'unauthorized' }, 401);
    if (path === '/api/internal/connections') return reply([connection]);
    if (path === '/api/internal/connections/default') return reply(connection);
    if (path === '/api/internal/settings') return reply({ tags_enabled: 'false' });
    if (path === '/api/internal/notes/home') return reply({ exists: false });
    if (path.endsWith('/buckets')) return reply({ buckets: [{ name: 'training-data', creationDate: now }], cache });
    if (path.endsWith('/favorites')) return reply([]);
    if (path.endsWith('/list')) return reply({ directories: ['datasets/', 'models/'], files: [
      { key: 'manifest.json', size: 24576, lastModified: now },
      { key: '日本語の説明.txt', size: 1024, lastModified: now },
    ], nextContinuation: null, nextStartAfter: null, cache });
    if (path.endsWith('/readme')) return reply({ exists: false });
    if (path.endsWith('/tags')) return reply(path === '/api/internal/tags' ? [] : {});
    if (path.endsWith('/registry-status')) return reply({ linked: false });
    return reply({ error: `Unexpected browser-test API: ${path}` }, 404);
  }
  return { route, state, connection };
}
