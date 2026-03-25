import type { NextConfig } from "next";

const isGithubPages = process.env.GITHUB_PAGES === "true";

const nextConfig: NextConfig = {
  output: "export",
  basePath: isGithubPages ? "/IFP" : "",
  assetPrefix: isGithubPages ? "/IFP/" : "",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
