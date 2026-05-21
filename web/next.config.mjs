/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['../src/engines', '../src/shared', '../src/report', '../src/ingestion', '../src/export', '../src/validation'],
  experimental: {
    serverExternalPackages: ['@napi-rs/canvas', '@napi-rs/canvas-win32-x64-msvc', 'pdfjs-dist', 'pdf-to-img', '@react-pdf/renderer', '@react-pdf/reconciler'],
  },
  // Skip failing static generation for API routes that require a database connection
  output: undefined,
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config) => {
    // Allow .js imports to resolve to .ts files (root src/ uses .js extensions in imports)
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    };
    return config;
  },
};

export default nextConfig;
