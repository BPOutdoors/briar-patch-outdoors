import type { NextConfig } from "next";

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL === 'https://placeholder.supabase.co') {
  throw new Error('BUILD FAILED: NEXT_PUBLIC_SUPABASE_URL is missing or still placeholder. Value: ' + process.env.NEXT_PUBLIC_SUPABASE_URL)
}

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
