import express from 'express';
import cors from 'cors';
import { generateRoute } from './routes/generate.js';
import { jobsRoute } from './routes/jobs.js';
import { bridgeRoute } from './routes/bridge.js';
import { assetsRoute } from './routes/assets.js';
import { getStorageDir } from './services/assetStore.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Public asset images (no auth — the Figma Bridge fetches these directly)
app.use('/static/assets', express.static(getStorageDir()));

// Auth middleware
app.use((req, res, next) => {
  if (req.path === '/health') return next();
  const key = req.headers['x-api-key'];
  if (key !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  next();
});

app.get('/health', (req, res) => res.json({ status: 'ok', version: '4.0.0' }));
app.use('/api/v1/generate', generateRoute);
app.use('/api/v1/jobs', jobsRoute);
app.use('/api/v1/bridge', bridgeRoute);
app.use('/api/v1/assets', assetsRoute);

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// Only start listening when run directly (not imported by tests)
if (process.argv[1] && new URL(import.meta.url).pathname === new URL(process.argv[1], import.meta.url).pathname) {
  app.listen(PORT, () => console.log(`AutoHelp 4.0 backend running on port ${PORT}`));
}

export { app };
