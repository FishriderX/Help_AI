import type {
  Settings,
  GenerateRequest,
  GenerateResponse,
  Job,
  Asset,
} from '../types';

async function parseError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return body.error || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

export async function generate(
  config: Settings,
  body: GenerateRequest
): Promise<GenerateResponse> {
  const res = await fetch(`${config.backendUrl}/api/v1/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': config.apiKey },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function getJob(config: Settings, id: string): Promise<Job> {
  const res = await fetch(`${config.backendUrl}/api/v1/jobs/${id}`, {
    headers: { 'x-api-key': config.apiKey },
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function cancelJob(config: Settings, id: string): Promise<void> {
  const res = await fetch(`${config.backendUrl}/api/v1/jobs/${id}/cancel`, {
    method: 'POST',
    headers: { 'x-api-key': config.apiKey },
  });
  if (!res.ok) throw new Error(await parseError(res));
}

export async function listAssets(config: Settings): Promise<Asset[]> {
  const res = await fetch(`${config.backendUrl}/api/v1/assets`, {
    headers: { 'x-api-key': config.apiKey },
  });
  if (!res.ok) throw new Error(await parseError(res));
  const body = await res.json();
  return body.assets as Asset[];
}

export async function uploadAsset(
  config: Settings,
  file: File,
  name: string,
  type: string
): Promise<Asset> {
  const form = new FormData();
  form.append('file', file);
  form.append('name', name);
  form.append('type', type);
  const res = await fetch(`${config.backendUrl}/api/v1/assets/upload`, {
    method: 'POST',
    headers: { 'x-api-key': config.apiKey },
    body: form,
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function deleteAsset(config: Settings, id: string): Promise<void> {
  const res = await fetch(`${config.backendUrl}/api/v1/assets/${id}`, {
    method: 'DELETE',
    headers: { 'x-api-key': config.apiKey },
  });
  if (!res.ok) throw new Error(await parseError(res));
}
