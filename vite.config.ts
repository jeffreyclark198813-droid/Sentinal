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
api_key: 'hf-free-example',
},
ai21: {
api_key: 'ai21-free-example',
},
};

// Parse VITE_ env variables into nested structure, supporting deep merging and type inference
function parseNestedEnv(env) {
const result = {};
Object.entries(env).forEach(([key, val]) => {
if (!key.startsWith('VITE_')) return;

const pathParts = key.replace(/^VITE_/, '').toLowerCase().split('_');  
let current = result;  
pathParts.forEach((part, idx) => {  
  if (idx === pathParts.length - 1) {  
    try {  
      current[part] = JSON.parse(val);  
    } catch {  
      current[part] = val;  
    }  
  } else {  
    if (!current[part] || typeof current[part] !== 'object') current[part] = {};  
    current = current[part];  
  }  
});

});
return result;
}

// Deep merge utility
function deepMerge(target, source) {
for (const key of Object.keys(source)) {
if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
if (!target[key] || typeof target[key] !== 'object') target[key] = {};
deepMerge(target[key], source[key]);
} else {
target[key] = source[key];
}
}
return target;
}

export default defineConfig(({ mode }) => {
const env = loadEnv(mode, process.cwd(), '');

const parsedEnv = parseNestedEnv(env);

const hardcodedEnv = Object.fromEntries(
Object.entries(HARD_CODED_KEYS).map(([service, obj]) => [
service,
Object.fromEntries(
Object.entries(obj).map(([k, v]) => [k, JSON.stringify(v)])
),
])
);

const nestedEnv = deepMerge(parsedEnv, hardcodedEnv);

return {
server: {
port: 3000,
host: '0.0.0.0',
strictPort: true,
fs: { allow: [path.resolve(__dirname, '.')] },
},
plugins: [react()],
define: nestedEnv,
resolve: {
alias: {
'@': path.resolve(__dirname, '.'),
},
},
build: {
target: 'esnext',
sourcemap: true,
chunkSizeWarningLimit: 2000,
},
optimizeDeps: {
include: ['react', 'react-dom'],
esbuildOptions: {
logLevel: 'warning',
},
},
};
});
