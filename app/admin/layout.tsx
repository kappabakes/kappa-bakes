import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Kappa Bakes - Admin Portal" },
  // Keep the admin out of search results entirely, whatever its URL.
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/*
        The shop's header and footer are rendered by the root layout, above
        this one, so they can't simply be left out here. Hiding them by CSS
        works wherever the admin is served from — including the secret path,
        where the URL doesn't say "admin" at all.
      */}
      <style>{`[data-site-chrome]{display:none!important}`}</style>
      {children}
    </>
  );
}
