import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") || requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") || "https";
  const metadataBase = host ? new URL(`${protocol}://${host}`) : undefined;

  return {
    metadataBase,
    title: "Estúdio Fluxo — Projetos e finanças",
    description:
      "Gestão local-first de projetos, fluxo financeiro mensal e backups portáteis para estúdios criativos.",
    applicationName: "Estúdio Fluxo",
    icons: {
      icon: [{ url: "/favicon-dashupboard.svg", type: "image/svg+xml" }],
      shortcut: "/favicon-dashupboard.svg",
    },
    manifest: "/manifest.webmanifest",
    openGraph: {
      title: "Estúdio Fluxo",
      description: "Projetos e finanças no mesmo ritmo.",
      images: [
        {
          url: "/og.png",
          width: 1664,
          height: 936,
          alt: "Estúdio Fluxo — painel de projetos e finanças",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "Estúdio Fluxo",
      description: "Projetos e finanças no mesmo ritmo.",
      images: ["/og.png"],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
