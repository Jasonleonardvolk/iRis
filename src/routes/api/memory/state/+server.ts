import { json } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { requireApiKey } from '$lib/server/auth';

export const GET = async ({ request }) => {
  const unauthorized = requireApiKey(request);
  if (unauthorized) return unauthorized;

  const useMocks = dev || process.env.IRIS_USE_MOCKS === '1';
  if (useMocks) {
    return json({ ok: true, state: { personas: [], metrics: {} }, mock: true });
  }

  // TODO: implement real state
  return new Response('Not configured', { status: 503 });
};