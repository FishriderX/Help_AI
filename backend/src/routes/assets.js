import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { addAsset, setTransparent, listAssets, getAsset, deleteAsset } from '../services/assetStore.js';
import { removeBackground } from '../services/bgRemover.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

export const assetsRoute = Router();

function toDto(r) {
  const base = process.env.PUBLIC_BASE_URL || 'http://localhost:3001';
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    ext: r.ext,
    bgRemoved: r.bgRemoved,
    original_url: `${base}/static/assets/original/${r.id}.${r.ext}`,
    transparent_url: r.hasTransparent
      ? `${base}/static/assets/transparent/${r.id}.${r.ext}`
      : `${base}/static/assets/original/${r.id}.${r.ext}`,
  };
}

assetsRoute.post('/upload', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'file is required (multipart field "file")' });
    }
    const originalName = req.file.originalname || 'asset.png';
    const ext = (path.extname(originalName).replace('.', '') || 'png').toLowerCase();
    const name = (req.body.name || '').trim() || path.basename(originalName, path.extname(originalName));
    const type = req.body.type || 'symbol';

    const record = await addAsset({ name, type, ext, buffer: req.file.buffer });

    try {
      const { buffer: outBuf, bgRemoved } = await removeBackground(req.file.buffer, ext);
      await setTransparent(record.id, outBuf, bgRemoved);
    } catch (e) {
      await setTransparent(record.id, req.file.buffer, false);
    }

    const updated = await getAsset(record.id);
    res.status(201).json(toDto(updated));
  } catch (err) {
    next(err);
  }
});

assetsRoute.get('/', async (req, res, next) => {
  try {
    const all = await listAssets();
    res.json({ assets: all.map(toDto) });
  } catch (err) {
    next(err);
  }
});

assetsRoute.delete('/:id', async (req, res, next) => {
  try {
    const ok = await deleteAsset(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Asset not found' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
