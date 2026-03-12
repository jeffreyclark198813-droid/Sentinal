import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Hardcoded free AI model API keys (replace with your own)
const HARD_CODED_KEYS = {
  openai: {
    api_key: 'sk-free-openai-example',
  },
  huggingface: {
    api_key: 'hf-free-example',
  },
  cohere: {
    api_key: 'cohere-free-example',
  },
};

// Parse VITE_ env variables into nested structure
function parseNestedEnv(env) {
  const result = {};
  Object.entries(env).forEach(([key, val]) => {
    if (!key.startsWith('VITE_')) return;

    const pathParts = key.replace(/^VITE_/, '').toLowerCase().split('_');
    let current = result;
    pathParts.forEach((part, idx) => {
      if (idx === pathParts.length - 1) {
        current[part] = JSON.stringify(val);
      } else {
        if (!current[part]) current[part] = {};
        current = current[part];
      }
    });
  });
  return result;
}

export default defineConfig(({ mode }) => {
  // Load .env variables for the current mode
  const env = loadEnv(mode, process.cwd(), '');

  // Merge hardcoded keys with parsed VITE_ environment variables
  const nestedEnv = {
    ...parseNestedEnv(env),
    ...Object.fromEntries(
      Object.entries(HARD_CODED_KEYS).map(([service, obj]) => [
        service,
        Object.fromEntries(
          Object.entries(obj).map(([k, v]) => [k, JSON.stringify(v)])
        ),
      ])
    ),
  };

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react()],
    define: nestedEnv,
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
