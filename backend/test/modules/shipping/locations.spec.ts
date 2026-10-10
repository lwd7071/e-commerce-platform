import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../../../src/platform/http/app.ts';

describe('administrative location catalog API', () => {
  it('serves all 34 provinces and the 3,321 official-code wards from local versioned data', async () => {
    const app = createApp({ rateLimiter: false });
    const provinceResponse = await request(app).get('/api/v1/locations/provinces').expect(200);
    const provinces = provinceResponse.body.data as Array<{ code: string; name: string }>;
    assert.equal(provinces.length, 34);
    assert.equal(provinces.find(province => province.name === 'Hồ Chí Minh')?.code, '79');

    let wardCount = 0;
    for (const province of provinces) {
      const response = await request(app).get(`/api/v1/locations/provinces/${province.code}/wards`).expect(200);
      wardCount += (response.body.data as Array<{ code: string }>).length;
    }
    assert.equal(wardCount, 3321);
  });

  it('rejects an unknown province code', async () => {
    const app = createApp({ rateLimiter: false });
    await request(app).get('/api/v1/locations/provinces/unknown/wards').expect(422);
  });
});
