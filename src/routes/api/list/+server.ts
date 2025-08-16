import { json } from '@sveltejs/kit';
import { fetchWithTimeout } from '$lib/server/safeFetch';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const EXTRACTOR_BASE_URL = process.env.EXTRACTOR_BASE_URL; // e.g. http://localhost:8001
const LOCAL_UPLOAD_DIR = process.env.LOCAL_UPLOAD_DIR || 'var/uploads';

async function listLocalUploads() {
  await fs.mkdir(LOCAL_UPLOAD_DIR, { recursive: true });
  const entries = await fs.readdir(LOCAL_UPLOAD_DIR, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile())
    .map((e) => ({ key: e.name, href: `/uploads/${encodeURIComponent(e.name)}` }));
}

export const GET = async () => {
  if (EXTRACTOR_BASE_URL) {
    try {
      const r = await fetchWithTimeout(`${EXTRACTOR_BASE_URL}/list`, 1500);
      if (r.ok) {
        const text = await r.text();
        return new Response(text, {
          status: 200,
          headers: { 'content-type': r.headers.get('content-type') || 'application/json' }
        });
      }
      console.warn('Extractor /list returned', r.status);
    } catch (err) {
      console.warn('Extractor /list failed; using local fallback', err);
    }
  }
  const items = await listLocalUploads();
  return json({ source: 'local', items });
};