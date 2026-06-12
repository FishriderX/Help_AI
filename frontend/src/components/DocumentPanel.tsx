import { useState } from 'react';
import type { DocSourceType, Language, Theme } from '../types';

export interface GenerateParams {
  sourceType: DocSourceType;
  value: string;
  sheetTab: string;
  language: Language;
  theme: Theme;
  figmaFileKey: string;
}

interface Props {
  busy: boolean;
  onGenerate: (p: GenerateParams) => void;
  onCancel: () => void;
}

export default function DocumentPanel({ busy, onGenerate, onCancel }: Props) {
  const [sourceType, setSourceType] = useState<DocSourceType>('sheets_url');
  const [value, setValue] = useState('');
  const [language, setLanguage] = useState<Language>('en');
  const [theme, setTheme] = useState<Theme>('dark');
  const [figmaFileKey, setFigmaFileKey] = useState('');
  const [sheetTab, setSheetTab] = useState('');

  const canGenerate = value.trim().length > 0 && !busy;

  return (
    <div className="panel">
      <div className="panel-title">Document</div>
      <div className="panel-scroll">
        <div className="field">
          <label>Source</label>
          <div className="seg">
            <button className={sourceType === 'sheets_url' ? 'active' : ''} onClick={() => setSourceType('sheets_url')}>
              Google Sheet URL
            </button>
            <button className={sourceType === 'text' ? 'active' : ''} onClick={() => setSourceType('text')}>
              Paste text
            </button>
          </div>
        </div>

        <div className="field">
          {sourceType === 'sheets_url' ? (
            <input
              placeholder="https://docs.google.com/spreadsheets/d/..."
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          ) : (
            <textarea
              placeholder="Paste tab-separated rows here…"
              value={value}
              rows={8}
              onChange={(e) => setValue(e.target.value)}
            />
          )}
        </div>

        {sourceType === 'sheets_url' && (
          <div className="field">
            <label>Sheet tab — paste a URL with #gid=… or enter the gid number</label>
            <input
              placeholder="e.g. 427686762 (the tab's gid) — blank = first tab"
              value={sheetTab}
              onChange={(e) => setSheetTab(e.target.value)}
            />
          </div>
        )}

        <div className="row-2">
          <div className="field">
            <label>Language</label>
            <select value={language} onChange={(e) => setLanguage(e.target.value as Language)}>
              <option value="en">English</option>
              <option value="sch">中文 (SCH)</option>
            </select>
          </div>
          <div className="field">
            <label>Theme</label>
            <select value={theme} onChange={(e) => setTheme(e.target.value as Theme)}>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </div>
        </div>

        <div className="field">
          <label>Figma File Key (optional)</label>
          <input placeholder="abc123…" value={figmaFileKey} onChange={(e) => setFigmaFileKey(e.target.value)} />
        </div>

        {busy ? (
          <button className="btn-primary" onClick={onCancel}>
            ⏹ Stop
          </button>
        ) : (
          <button
            className="btn-primary"
            disabled={!canGenerate}
            onClick={() => onGenerate({ sourceType, value: value.trim(), sheetTab: sheetTab.trim(), language, theme, figmaFileKey: figmaFileKey.trim() })}
          >
            ⚡ Generate
          </button>
        )}
      </div>
    </div>
  );
}
