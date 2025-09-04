/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Enable experimental features if needed
  },
  // Enable strict mode for React
  reactStrictMode: true,
  // Disable powered-by header for security
  poweredByHeader: false,
  // Temporarily ignore ESLint during production builds (Vercel)
  eslint: {
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig
