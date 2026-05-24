import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Enable React strict mode for development
  reactStrictMode: true,

  // Output standalone build for Docker deployment
  output: 'standalone',

  // Environment variables available to the client
  env: {
    PPP_BACKEND_URL: process.env.PPP_BACKEND_URL || 'http://localhost:4000',
    PRESENTON_BACKEND_URL: process.env.PRESENTON_BACKEND_URL || 'http://localhost:8000',
  },
}

export default nextConfig
