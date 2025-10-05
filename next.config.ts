/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*',
        port: '',
        pathname: '/**',
      },
    ],
  },
  // Asegurar que los archivos estáticos se sirvan correctamente
  trailingSlash: false,
  // swcMinify ya es el comportamiento por defecto en Next.js 15, no es necesario especificarlo
}

export default nextConfig
