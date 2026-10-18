const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // frontend/ is a standalone npm project, but the repo root also has a
  // package-lock.json (for backend/root tooling) — without this, Turbopack
  // guesses the repo root as the workspace root instead of frontend/.
  turbopack: {
    root: path.join(__dirname),
  },
};

module.exports = nextConfig;
