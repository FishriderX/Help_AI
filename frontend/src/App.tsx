import { useCallback, useEffect, useRef, useState } from 'react';
import SettingsBar from './components/SettingsBar';
import AssistantPanel, { type FeedMessage } from './components/AssistantPanel';
import DocumentPanel, { type GenerateParams } from './components/DocumentPanel';
import AssetPanel from './components/AssetPanel';
import { loadSettings, saveSettings } from './settings';
import { generate, getJob, cancelJob, listAssets, uploadAsset, deleteAsset } from './api/client';
import type { Settings, Job, Asset } from './types';

export default function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings());
  const [feed, setFeed] = useState<FeedMessage[]>([]);
  const [job, setJob] = useState<Job | null>(null);
  const [busy, setBusy] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [uploading, setUploading] = useState(false);
  const pollRef = useRef<number | null>(null);
  const currentJobId = useRef<string | null>(null);
  const feedId = useRef(0);

  const addFeed = useCallback((kind: FeedMessage['kind'], text: string) => {
    feedId.current += 1;
    setFeed((f) => [
      ...f,
      { id: feedId.current, kind, text, ts: new Date().toLocaleTimeString() },
    ]);
  }, []);

  const refreshAssets = useCallback(async () => {
    try {
      setAssets(await listAssets(settings));
    } catch (e) {
      addFeed('error', `Could not load assets: ${(e as Error).message}`);
    }
  }, [settings, addFeed]);

  useEffect(() => {
    refreshAssets();
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [refreshAssets]);

  function updateSettings(s: Settings) {
    setSettings(s);
    saveSettings(s);
    addFeed('status', 'Settings saved.');
  }

  function stopPolling() {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  async function handleGenerate(p: GenerateParams) {
    stopPolling();
    setBusy(true);
    setJob(null);
    addFeed('status', `Submitting ${p.sourceType === 'sheets_url' ? 'Google Sheet' : 'pasted text'}…`);

    try {
      const res = await generate(settings, {
        document: { type: p.sourceType, value: p.value, sheet: p.sheetTab || undefined },
        language: p.language,
        theme: p.theme,
        figma_file_key: p.figmaFileKey || undefined,
      });
      currentJobId.current = res.job_id;
      addFeed('status', `Job ${res.job_id.slice(0, 8)} queued. Working…`);
      pollRef.current = window.setInterval(() => pollJob(res.job_id), 2000);
    } catch (e) {
      addFeed('error', `Generate failed: ${(e as Error).message}`);
      setBusy(false);
    }
  }

  async function handleCancel() {
    stopPolling();
    setBusy(false);
    const id = currentJobId.current;
    currentJobId.current = null;
    addFeed('status', 'Generation stopped.');
    if (id) {
      try {
        await cancelJob(settings, id);
      } catch {
        // best-effort: the UI is already free regardless
      }
    }
  }

  async function pollJob(id: string) {
    try {
      const j = await getJob(settings, id);
      setJob(j);
      if (j.status === 'pending_figma') {
        stopPolling();
        setBusy(false);
        addFeed('ok', `Layout ready — ${j.layoutPlan?.pages.length ?? 0} pages. Open the Figma Bridge plugin and press Start Polling to render.`);
      } else if (j.status === 'complete') {
        stopPolling();
        setBusy(false);
        addFeed('ok', 'Rendered in Figma. Done!');
      } else if (j.status === 'failed') {
        stopPolling();
        setBusy(false);
        addFeed('error', `Job failed: ${j.error || 'unknown error'}`);
      }
    } catch (e) {
      stopPolling();
      setBusy(false);
      addFeed('error', `Polling error: ${(e as Error).message}`);
    }
  }

  async function handleUpload(file: File, name: string, type: string) {
    setUploading(true);
    try {
      await uploadAsset(settings, file, name, type);
      addFeed('status', `Uploaded ${name}.`);
      await refreshAssets();
    } catch (e) {
      addFeed('error', `Upload failed: ${(e as Error).message}`);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteAsset(settings, id);
      await refreshAssets();
    } catch (e) {
      addFeed('error', `Delete failed: ${(e as Error).message}`);
    }
  }

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">
          <span className="accent">AutoHelp</span>
          <span className="ver">4.0 — Web Workspace</span>
        </div>
        <SettingsBar settings={settings} onSave={updateSettings} />
      </div>
      <div className="workspace">
        <AssistantPanel feed={feed} job={job} />
        <DocumentPanel busy={busy} onGenerate={handleGenerate} onCancel={handleCancel} />
        <AssetPanel
          assets={assets}
          uploading={uploading}
          onUpload={handleUpload}
          onDelete={handleDelete}
        />
      </div>
    </div>
  );
}
