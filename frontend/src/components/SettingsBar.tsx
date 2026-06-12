import { useState } from 'react';
import type { Settings } from '../types';

interface Props {
  settings: Settings;
  onSave: (s: Settings) => void;
}

export default function SettingsBar({ settings, onSave }: Props) {
  const [open, setOpen] = useState(false);
  const [backendUrl, setBackendUrl] = useState(settings.backendUrl);
  const [apiKey, setApiKey] = useState(settings.apiKey);

  function save() {
    onSave({ backendUrl: backendUrl.trim().replace(/\/$/, ''), apiKey: apiKey.trim() });
    setOpen(false);
  }

  return (
    <div>
      <button className="btn btn-sm" onClick={() => setOpen((o) => !o)}>
        ⚙ Settings
      </button>
      {open && (
        <div className="settings-pop">
          <div className="field">
            <label>Backend URL</label>
            <input value={backendUrl} onChange={(e) => setBackendUrl(e.target.value)} />
          </div>
          <div className="field">
            <label>API Key</label>
            <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} type="password" />
          </div>
          <button className="btn btn-primary" onClick={save}>Save</button>
        </div>
      )}
    </div>
  );
}
