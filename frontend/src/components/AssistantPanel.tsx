import type { Job } from '../types';

export interface FeedMessage {
  id: number;
  kind: 'status' | 'error' | 'ok';
  text: string;
  ts: string;
}

interface Props {
  feed: FeedMessage[];
  job: Job | null;
}

const STATUS_LABEL: Record<string, string> = {
  queued: 'Queued',
  analyzing: 'Reading document',
  ai_processing: 'Analyzing with AI',
  pending_figma: 'Ready for Figma',
  rendering: 'Rendering in Figma',
  complete: 'Complete',
  failed: 'Failed',
};

export default function AssistantPanel({ feed, job }: Props) {
  const dotClass =
    job?.status === 'complete' || job?.status === 'pending_figma'
      ? 'done'
      : job?.status === 'failed'
      ? 'err'
      : job
      ? 'active'
      : '';

  const planTypes = job?.layoutPlan?.pages?.map((p) => p.type) ?? [];
  const typeCounts = planTypes.reduce<Record<string, number>>((acc, t) => {
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="panel">
      <div className="panel-title">Assistant</div>
      <div className="panel-scroll">
        {job && (
          <div className="statusline">
            <span className={`dot ${dotClass}`} />
            <strong>{STATUS_LABEL[job.status] || job.status}</strong>
          </div>
        )}

        {job?.layoutPlan && (
          <div className="plan-summary">
            <div className="muted" style={{ marginBottom: 6 }}>
              {job.layoutPlan.pages.length} pages
            </div>
            {Object.entries(typeCounts).map(([t, n]) => (
              <span className="chip" key={t}>{t} ×{n}</span>
            ))}
          </div>
        )}

        <div className="feed" style={{ marginTop: 14 }}>
          {feed.length === 0 ? (
            <div className="empty">
              Upload your symbols, paste a document, and press Generate.
            </div>
          ) : (
            feed.map((m) => (
              <div className={`msg ${m.kind}`} key={m.id}>
                {m.text}
                <span className="ts">{m.ts}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
