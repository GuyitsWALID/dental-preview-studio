import type { NextConfig } from 'next';
const config: NextConfig = {
  serverExternalPackages: ['sharp', 'exceljs'],
  outputFileTracingExcludes: {
    '/*': ['./.cache/**/*','./.local-studio/**/*','./tests/**/*','./test-results/**/*','./playwright-report/**/*']
  },
  outputFileTracingIncludes: {
    '/api/studio': ['./lib/site/*.mjs', './public/studio-fonts/*', './public/assets/oli-facebook-cover.jpg'],
    '/api/template/*': ['./public/studio-fonts/*']
  },
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' }
    ] }];
  }
};
export default config;
