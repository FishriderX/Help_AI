process.env.API_KEY = 'dev-key-12345';

const request = (await import('supertest')).default;
const { app } = await import('../src/index.js');
const { createJob, updateJob, getJob, JOB_STATES } = await import('../src/services/jobManager.js');

const HEADERS = { 'x-api-key': 'dev-key-12345' };

test('GET /bridge/pending returns the plan and preserves the result when marking rendering', async () => {
  const job = createJob({ document: { type: 'text', value: 'x' }, language: 'en' });
  updateJob(job.id, JOB_STATES.PENDING_FIGMA, {
    layoutPlan: { pages: [{ id: 'PAGE_1', type: 'feature_text' }] },
  });

  const res = await request(app).get('/api/v1/bridge/pending').set(HEADERS);
  expect(res.status).toBe(200);
  expect(res.body.job_id).toBe(job.id);
  expect(res.body.plan.pages).toHaveLength(1);

  const after = getJob(job.id);
  expect(after.status).toBe(JOB_STATES.RENDERING);
  // Regression: the layout plan must NOT be wiped when moving to rendering
  expect(after.result.layoutPlan.pages).toHaveLength(1);
});

test('POST /bridge/complete marks the job complete and keeps the plan', async () => {
  const job = createJob({ document: { type: 'text', value: 'y' }, language: 'en' });
  updateJob(job.id, JOB_STATES.PENDING_FIGMA, { layoutPlan: { pages: [] } });

  const res = await request(app)
    .post('/api/v1/bridge/complete')
    .set(HEADERS)
    .send({ job_id: job.id, status: 'complete' });

  expect(res.status).toBe(200);
  const after = getJob(job.id);
  expect(after.status).toBe(JOB_STATES.COMPLETE);
  expect(after.result).not.toBeNull();
});
