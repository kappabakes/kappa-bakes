/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
  images: {
    // Menu photos uploaded through the admin live on Vercel Blob storage.
    remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }],
  },
};
