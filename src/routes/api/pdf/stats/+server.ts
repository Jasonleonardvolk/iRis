import { json } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { requireApiKey } from '$lib/server/auth';

export const GET = async ({ request }) => {
  const unauthorized = requireApiKey(request);
  if (unauthorized) return unauthorized;

  const useMocks = dev || process.env.IRIS_USE_MOCKS === '1';
  if (useMocks) {
    return json({ ok: true, stats: { pages: 0, docs: 0, updated: Date.now() }, mock: true });
  }

  // TODO: implement real stats
  return new Response('Not configured', { status: 503 });
};