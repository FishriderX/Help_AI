import { v4 as uuidv4 } from 'uuid';

export const JOB_STATES = {
  QUEUED: 'queued',
  ANALYZING: 'analyzing',
  AI_PROCESSING: 'ai_processing',
  PENDING_FIGMA: 'pending_figma',
  RENDERING: 'rendering',
  COMPLETE: 'complete',
  FAILED: 'failed',
};

const jobs = new Map();

export function createJob(input) {
  const job = {
    id: uuidv4(),
    status: JOB_STATES.QUEUED,
    input,
    result: null,
    error: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  jobs.set(job.id, job);
  return job;
}

export function getJob(id) {
  return jobs.get(id) || null;
}

export function updateJob(id, status, result = null, error = null) {
  const job = jobs.get(id);
  if (!job) throw new Error(`Job ${id} not found`);
  job.status = status;
  job.result = result;
  job.error = error;
  job.updatedAt = new Date().toISOString();
  return job;
}

// Internal: allows bridge route to scan all jobs
export function getJobsInternal() {
  return { jobs: Array.from(jobs.values()) };
}
