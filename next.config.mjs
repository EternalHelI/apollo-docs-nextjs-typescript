/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      { source: '/', destination: '/homepage', permanent: false },
      { source: '/index.html', destination: '/homepage', permanent: false },
      { source: '/trash.html', destination: '/archive', permanent: false },
      { source: '/editor.html', destination: '/editor', permanent: false },
      { source: '/changelogs.html', destination: '/changelogs', permanent: false }
    ];
  }
};

export default nextConfig;
