export type Language = 'en' | 'sch';
export type Theme = 'dark' | 'light';
export type DocSourceType = 'sheets_url' | 'text';

export type JobStatus =
  | 'queued'
  | 'analyzing'
  | 'ai_processing'
  | 'pending_figma'
  | 'rendering'
  | 'complete'
  | 'failed';

export interface Settings {
  backendUrl: string;
  apiKey: string;
}

export interface GenerateRequest {
  document: { type: DocSourceType; value: string; sheet?: string };
  language: Language;
  theme: Theme;
  figma_file_key?: string;
  figma_page?: string;
}

export interface GenerateResponse {
  job_id: string;
  status: JobStatus;
}

export interface LayoutPage {
  id: string;
  type: string;
  title?: string;
}

export interface LayoutPlan {
  meta?: Record<string, unknown>;
  assets?: Record<string, unknown>;
  pages: LayoutPage[];
}

export interface Job {
  id: string;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  error: string | null;
  layoutPlan?: LayoutPlan;
}

export interface Asset {
  id: string;
  name: string;
  type: string;
  ext: string;
  bgRemoved: boolean;
  original_url: string;
  transparent_url: string;
}
