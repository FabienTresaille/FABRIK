/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  images: {
    domains: ['fabrik.alsek.fr'],
  },
};

module.exports = nextConfig;
