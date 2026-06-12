import { Router } from 'express';
import { getJob, updateJob, getJobsInternal, JOB_STATES } from '../services/jobManager.js';

export const bridgeRoute = Router();

// Figma Bridge Plugin polls this to get the next pending job
bridgeRoute.get('/pending', (req, res, next) => {
  try {
    const { jobs } = getJobsInternal();
    const pending = jobs.find((j) => j.status === JOB_STATES.PENDING_FIGMA);
    if (!pending) return res.status(404).json({ message: 'No pending jobs' });

    const plan = pending.result && pending.result.layoutPlan;
    // Preserve the result so the layout plan survives the status change.
    updateJob(pending.id, JOB_STATES.RENDERING, pending.result);
    res.json({ job_id: pending.id, plan });
  } catch (err) {
    next(err);
  }
});

// Figma Bridge Plugin reports completion
bridgeRoute.post('/complete', (req, res) => {
  const { job_id, status } = req.body;
  if (!job_id) return res.status(400).json({ error: 'job_id required' });
  const existing = getJob(job_id);
  if (!existing) return res.status(404).json({ error: `Job ${job_id} not found` });
  updateJob(
    job_id,
    status === 'complete' ? JOB_STATES.COMPLETE : JOB_STATES.FAILED,
    existing.result
  );
  res.json({ ok: true });
});
