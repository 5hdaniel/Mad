/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable React strict mode for better development
  reactStrictMode: true,

  // Transpile shared types from parent directory
  transpilePackages: ['@shared'],
};

export default nextConfig;
