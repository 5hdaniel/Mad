/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable React strict mode for better development
  reactStrictMode: true,

  // Transpile shared types from parent directory
  transpilePackages: ['@shared'],

  async headers() {
    // CSP directives - production removes unsafe-eval, dev needs it for HMR
    const isDev = process.env.NODE_ENV === 'development';

    const cspDirectives = [
      "default-src 'self'",
      // Development needs unsafe-eval for HMR/Fast Refresh; production does not
      isDev
        ? "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.clarity.ms"
        : "script-src 'self' 'unsafe-inline' https://www.clarity.ms",
      "style-src 'self' 'unsafe-inline'",
      // blob: required for HEIC image conversion (AttachmentViewerModal, AttachmentList)
      "img-src 'self' data: blob: https:",
      // next/font/google downloads at build time and self-hosts - no external font CDN needed
      "font-src 'self'",
      // Supabase API and Realtime WebSocket connections
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.clarity.ms",
      // PDF preview uses iframes with signed Supabase storage URLs
      "frame-src 'self' https://*.supabase.co",
      // Video preview uses <video src={signedUrl}> from Supabase storage
      "media-src 'self' https://*.supabase.co",
      // Prevent clickjacking
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ');

    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: cspDirectives,
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
