import { createJob, getJob, updateJob, JOB_STATES } from '../src/services/jobManager.js';

test('createJob returns job with queued status and unique id', () => {
  const job = createJob({ document: { type: 'text', value: 'hello' }, language: 'en' });
  expect(job.id).toBeDefined();
  expect(job.status).toBe(JOB_STATES.QUEUED);
  expect(job.input.language).toBe('en');
  expect(job.createdAt).toBeDefined();
});

test('getJob returns null for unknown id', () => {
  expect(getJob('nonexistent')).toBeNull();
});

test('getJob returns job after creation', () => {
  const job = createJob({ document: { type: 'text', value: 'test' }, language: 'en' });
  expect(getJob(job.id)).toEqual(job);
});

test('updateJob changes status and merges result', () => {
  const job = createJob({ document: { type: 'text', value: 'test' }, language: 'en' });
  updateJob(job.id, JOB_STATES.COMPLETE, { layoutPlan: { pages: [] } });
  const updated = getJob(job.id);
  expect(updated.status).toBe(JOB_STATES.COMPLETE);
  expect(updated.result.layoutPlan.pages).toEqual([]);
});

test('updateJob sets error on failed status', () => {
  const job = createJob({ document: { type: 'text', value: 'test' }, language: 'en' });
  updateJob(job.id, JOB_STATES.FAILED, null, 'Something went wrong');
  const updated = getJob(job.id);
  expect(updated.status).toBe(JOB_STATES.FAILED);
  expect(updated.error).toBe('Something went wrong');
});
