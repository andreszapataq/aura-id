/** @type {import('next').NextConfig} */
const nextConfig = {
  trailingSlash: false,
  images: {
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
}

export default nextConfig
