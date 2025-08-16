import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/kit/vite';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: { 
    adapter: adapter({
      out: 'build'            // Node server output (server+client)
    })
  },
  preprocess: vitePreprocess()
};

export default config;
