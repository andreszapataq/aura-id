/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    domains: ['localhost'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*',
      },
    ],
  },
  // Asegurar que los archivos estáticos se sirvan correctamente
  trailingSlash: false,
  // Optimizaciones para Vercel
  swcMinify: true,
}

export default nextConfig
