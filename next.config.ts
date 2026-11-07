import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 원고 MD 파일을 서버 함수 번들에 포함시킵니다.
  outputFileTracingIncludes: { "/**": ["./content/**/*"] },
};

export default nextConfig;
