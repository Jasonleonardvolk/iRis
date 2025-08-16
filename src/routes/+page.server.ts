import { redirect } from '@sveltejs/kit';

export const load = () => {
  // iRis-first landing
  throw redirect(307, '/renderer');
};