/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { serverComponentsExternalPackages: ["pdf-parse", "tesseract.js"] }
};
module.exports = nextConfig;
