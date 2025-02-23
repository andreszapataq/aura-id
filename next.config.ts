/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    domains: ['localhost'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*',
      },
    ],
  },
}

module.exports = nextConfig
