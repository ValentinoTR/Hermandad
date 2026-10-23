import type { NextConfig } from "next";
import path from 'node:path';

const nextConfig: NextConfig = {
  outputFileTracingIncludes:{'/api/*':['./public/hsmi-emblema.png']},
  turbopack:{root:path.resolve('.')},
};

export default nextConfig;
