import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

const keyPath = path.resolve(__dirname, '.cert/localhost.key')
const certPath = path.resolve(__dirname, '.cert/localhost.crt')
const hasHttpsCerts = fs.existsSync(keyPath) && fs.existsSync(certPath)

export default defineConfig(({ mode }) => ({
  base: '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  build: {
    sourcemap: mode !== 'production', // Hidden in production
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'react-vendor';
            }
            if (id.includes('katex')) {
              return 'katex-vendor';
            }
            if (id.includes('xlsx')) {
              return 'xlsx-vendor';
            }
            if (id.includes('lucide-react')) {
              return 'lucide-vendor';
            }
          }
          if (id.includes('imported_jee_mocks_questions.json')) {
            return 'jee-mocks-questions';
          }
          if (id.includes('imported_jee_mocks_answers.json')) {
            return 'jee-mocks-answers';
          }
          if (id.includes('imported_jee_mocks_solutions.json')) {
            return 'jee-mocks-solutions';
          }
          if (id.includes('imported_syllabus_topics.json') || id.includes('syllabus_chapters.json')) {
            return 'syllabus-data';
          }
        },
      },
    },
  },
  server: {
    port: 5173,
    https: hasHttpsCerts
      ? {
          key: fs.readFileSync(keyPath),
          cert: fs.readFileSync(certPath),
        }
      : undefined,
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob: https:; connect-src 'self' https: ws: wss:;",
    },
  },
  preview: {
    port: 5173,
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob: https:; connect-src 'self' https: ws: wss:;",
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    },
  },
}))

