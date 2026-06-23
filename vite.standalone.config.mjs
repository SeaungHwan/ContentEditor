import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
import { resolve } from 'path';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'next/dynamic': resolve(__dirname, 'standalone/shims/next-dynamic.jsx'),
      'next/link': resolve(__dirname, 'standalone/shims/next-link.jsx'),
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  css: {
    modules: {
      generateScopedName: 'te_[local]',
    },
  },
  publicDir: false,
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    cssCodeSplit: false,
    assetsInlineLimit: 102400,
    lib: {
      entry: resolve(__dirname, 'standalone/entry.jsx'),
      formats: ['iife'],
      name: 'TableEditorApp',
      fileName: () => 'table-editor.js',
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        assetFileNames: (info) =>
          info.name?.endsWith('.css') ? 'table-editor.css' : (info.name || 'asset'),
      },
    },
  },
});
