import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/print/print_retur.php',
        destination: '/print/retur',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
