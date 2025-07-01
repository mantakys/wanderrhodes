import path from 'node:path';
import react from '@vitejs/plugin-react';
import { createLogger, defineConfig } from 'vite';

const configHorizonsViteErrorHandler = `
  /* …your Vite overlay handler here… */
`;
const configHorizonsRuntimeErrorHandler = `
  /* …your runtime error handler here… */
`;
const configHorizonsConsoleErrroHandler = `
  /* …your console.error handler here… */
`;
const configWindowFetchMonkeyPatch = `
  /* …your fetch monkey-patch here… */
`;

const addTransformIndexHtml = {
  name: 'add-transform-index-html',
  transformIndexHtml(html) {
    return {
      html,
      tags: [
        {
          tag: 'script',
          attrs: { type: 'module' },
          children: configHorizonsRuntimeErrorHandler,
          injectTo: 'head',
        },
        {
          tag: 'script',
          attrs: { type: 'module' },
          children: configHorizonsViteErrorHandler,
          injectTo: 'head',
        },
        {
          tag: 'script',
          attrs: { type: 'module' },
          children: configHorizonsConsoleErrroHandler,
          injectTo: 'head',
        },
        {
          tag: 'script',
          attrs: { type: 'module' },
          children: configWindowFetchMonkeyPatch,
          injectTo: 'head',
        },
      ],
    };
  },
};

// Suppress warnings for specific PostCSS errors
console.warn = () => {};

const logger = createLogger();
const originalLoggerError = logger.error;
logger.error = (msg, options) => {
  if (options?.error?.toString().includes('CssSyntaxError: [postcss]')) {
    return;
  }
  originalLoggerError(msg, options);
};

export default defineConfig({
  customLogger: logger,
  plugins: [
    react(),
    addTransformIndexHtml
  ],
  server: {
    cors: true,
    headers: {
      'Cross-Origin-Embedder-Policy': 'credentialless'
    },
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:4242',
        changeOrigin: true,
        secure: false
      }
    }
  },
  resolve: {
    extensions: ['.jsx', '.js', '.tsx', '.ts', '.json'],
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});