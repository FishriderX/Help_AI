import { Router } from 'express';
import { createJob, getJob, updateJob, JOB_STATES } from '../services/jobManager.js';
import { parseDocument } from '../services/documentParser.js';
import { analyzeDocument } from '../services/claudeAnalyzer.js';
import { injectAssets } from '../services/assetInjector.js';

export const generateRoute = Router();

generateRoute.post('/', async (req, res) => {
  const { document, language = 'en', theme = 'dark', figma_file_key, figma_page } = req.body;

  if (!document || !document.type || document.value === undefined) {
    return res.status(400).json({ error: 'document.type and document.value are required' });
  }

  const job = createJob({ document, language, theme, figma_file_key, figma_page });
  res.status(202).json({ job_id: job.id, status: job.status });

  // Process asynchronously
  processJob(job.id, { document, language, theme }).catch(err => {
    console.error(`Job ${job.id} failed:`, err.message);
  });
});

async function processJob(jobId, { document, language, theme }) {
  // Track an AbortController on the job so a cancel request can stop the
  // in-flight Claude call (the jobs route never serialises _controller).
  const controller = new AbortController();
  const job = getJob(jobId);
  if (job) job._controller = controller;

  try {
    updateJob(jobId, JOB_STATES.ANALYZING);
    const parsed = await parseDocument(document);

    updateJob(jobId, JOB_STATES.AI_PROCESSING);
    const layoutPlan = await analyzeDocument(parsed, language, controller.signal);
    layoutPlan.meta = { job_id: jobId, language, theme };
    await injectAssets(layoutPlan);

    updateJob(jobId, JOB_STATES.PENDING_FIGMA, { layoutPlan });
  } catch (err) {
    const msg = controller.signal.aborted ? 'Cancelled by user' : err.message;
    updateJob(jobId, JOB_STATES.FAILED, null, msg);
  }
}
