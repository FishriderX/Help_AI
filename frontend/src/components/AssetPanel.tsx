import { useRef, useState } from 'react';
import type { Asset } from '../types';

interface Props {
  assets: Asset[];
  uploading: boolean;
  onUpload: (file: File, name: string, type: string) => void;
  onDelete: (id: string) => void;
}

export default function AssetPanel({ assets, uploading, onUpload, onDelete }: Props) {
  const [drag, setDrag] = useState(false);
  const [type, setType] = useState('symbol');
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFiles(files: FileList | null) {
    if (!files) return;
    for (const file of Array.from(files)) {
      const name = file.name.replace(/\.[^.]+$/, '');
      onUpload(file, name, type);
    }
  }

  return (
    <div className="panel">
      <div className="panel-title">Assets ({assets.length})</div>

      <div className="seg" style={{ marginBottom: 10 }}>
        {['symbol', 'ui', 'reference'].map((t) => (
          <button key={t} className={type === t ? 'active' : ''} onClick={() => setType(t)}>
            {t}
          </button>
        ))}
      </div>

      <div
        className={`dropzone ${drag ? 'drag' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? 'Uploading…' : `Drop images here or click to upload (${type})`}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      <div className="panel-scroll">
        {assets.length === 0 ? (
          <div className="empty">No assets yet.<br />Upload your symbol images.</div>
        ) : (
          <div className="asset-grid">
            {assets.map((a) => (
              <div className="asset-card" key={a.id}>
                <button className="asset-del" onClick={() => onDelete(a.id)} title="Delete">×</button>
                <span className={`badge ${a.bgRemoved ? '' : 'passthrough'}`}>
                  {a.bgRemoved ? 'BG✓' : 'raw'}
                </span>
                <img className="asset-thumb" src={a.transparent_url} alt={a.name} />
                <div className="asset-name">{a.name}</div>
                <div className="asset-meta">{a.type}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
