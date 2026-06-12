import { Router } from 'express';
import { getJob, updateJob, JOB_STATES } from '../services/jobManager.js';

export const jobsRoute = Router();

// Cancel an in-progress job: abort its Claude call and mark it failed.
jobsRoute.post('/:id/cancel', (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  if (job._controller) {
    try { job._controller.abort(); } catch (e) { /* already settled */ }
  }
  // Only mark cancelled if it hasn't already reached a terminal/ready state.
  const done = [JOB_STATES.PENDING_FIGMA, JOB_STATES.RENDERING, JOB_STATES.COMPLETE, JOB_STATES.FAILED];
  if (!done.includes(job.status)) {
    updateJob(job.id, JOB_STATES.FAILED, null, 'Cancelled by user');
  }
  res.json({ ok: true, status: getJob(job.id).status });
});

jobsRoute.get('/:id', (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  const response = {
    id: job.id,
    status: job.status,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    error: job.error,
  };

  if (job.result) {
    response.layoutPlan = job.result.layoutPlan;
  }

  res.json(response);
});
