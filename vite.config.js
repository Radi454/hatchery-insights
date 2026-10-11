import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const base = env.VITE_BASE_PATH || (process.env.GITHUB_ACTIONS === 'true' ? '/hatchery-insights/' : '/');
  return { base };
});
