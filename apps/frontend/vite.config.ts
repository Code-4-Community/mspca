/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import path from 'path';

// Assumes this file is in /apps/frontend/vite.config.ts and env variables are set in /.env
const workspaceRoot = path.resolve(__dirname, '../..');

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, workspaceRoot, '');
  process.env.VITE_COGNITO_USER_POOL_ID = env.COGNITO_USER_POOL_ID ?? '';
  process.env.VITE_COGNITO_USER_POOL_CLIENT_ID = env.COGNITO_CLIENT_ID ?? '';
  process.env.VITE_COGNITO_REGION = env.COGNITO_REGION ?? '';

  return {
    root: __dirname,
    cacheDir: '../../node_modules/.vite/frontend',
    envDir: workspaceRoot,

    server: {
      port: 4200,
      host: 'localhost',
    },

    preview: {
      port: 4300,
      host: 'localhost',
    },

    plugins: [react(), nxViteTsPaths()],

    // Uncomment this if you are using workers.
    // worker: {
    //  plugins: [ nxViteTsPaths() ],
    // },

    test: {
      globals: true,
      cache: {
        dir: '../../node_modules/.vitest',
      },
      environment: 'jsdom',
      include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    },

    resolve: {
      alias: {
        '@api': path.resolve(__dirname, './src/api'),
        '@components': path.resolve(__dirname, './src/components'),
        '@containers': path.resolve(__dirname, './src/containers'),
        '@pages': path.resolve(__dirname, './src/pages'),
        '@public': path.resolve(__dirname, './public'),
        '@shared': path.resolve(__dirname, '../../shared'),
        '@utils': path.resolve(__dirname, './src/utils'),
      },
    },
  };
});
