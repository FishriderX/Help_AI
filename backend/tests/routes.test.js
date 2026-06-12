process.env.API_KEY = 'dev-key-12345';

import request from 'supertest';
import { app } from '../src/index.js';

const HEADERS = { 'x-api-key': 'dev-key-12345' };

test('GET /health returns ok', async () => {
  const res = await request(app).get('/health');
  expect(res.status).toBe(200);
  expect(res.body.status).toBe('ok');
});

test('POST /api/v1/generate without API key returns 401', async () => {
  const res = await request(app).post('/api/v1/generate').send({});
  expect(res.status).toBe(401);
});

test('POST /api/v1/generate with missing document returns 400', async () => {
  const res = await request(app)
    .post('/api/v1/generate')
    .set(HEADERS)
    .send({ language: 'en' });
  expect(res.status).toBe(400);
  expect(res.body.error).toContain('document');
});

test('POST /api/v1/generate with valid input returns job_id', async () => {
  const res = await request(app)
    .post('/api/v1/generate')
    .set(HEADERS)
    .send({
      document: { type: 'text', value: 'PAGE 1\tPAYTABLE\tTest rule' },
      language: 'en',
      theme: 'dark',
    });
  expect(res.status).toBe(202);
  expect(res.body.job_id).toBeDefined();
  expect(res.body.status).toBe('queued');
});

test('GET /api/v1/jobs/:id returns 404 for unknown job', async () => {
  const res = await request(app)
    .get('/api/v1/jobs/nonexistent')
    .set(HEADERS);
  expect(res.status).toBe(404);
});

test('GET /api/v1/jobs/:id returns job after creation', async () => {
  const createRes = await request(app)
    .post('/api/v1/generate')
    .set(HEADERS)
    .send({
      document: { type: 'text', value: 'PAGE 1\tGAME RULES\tMalfunction voids all pays' },
      language: 'en',
    });
  const { job_id } = createRes.body;
  const res = await request(app).get(`/api/v1/jobs/${job_id}`).set(HEADERS);
  expect(res.status).toBe(200);
  expect(res.body.id).toBe(job_id);
});
