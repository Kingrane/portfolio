import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Unbounded } from "next/font/google";
import { asset } from "@/lib/asset";
import "./globals.css";

/**
 * Три шрифта, у всех есть кириллица (проверено в сгенерированном CSS):
 * - Unbounded — заголовки: геометричный, широкий, «станционный»
 * - Inter — текст и интерфейс: нейтральный, читаемый
 * - JetBrains Mono — HUD-лейблы, теги, счётчики, ASCII
 * next/font сам хостит woff2, внешних запросов в рантайме нет.
 */
const display = Unbounded({
  subsets: ["latin", "cyrillic"],
  variable: "--font-unbounded",
  display: "swap",
  preload: true,
});

const sans = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin", "cyrillic"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  // Абсолютные ссылки для OG. Если сайт переедет на свой домен — правится здесь.
  metadataBase: new URL("https://kingrane.github.io/portfolio/"),
  title: "Kingrane — full-stack vibe developer",
  description:
    "Портфолио Kingrane: веб, 3D, AI. Терминал космической станции, который встретил сад.",
  applicationName: "Kingrane",
  authors: [{ name: "Kingrane" }],
  openGraph: {
    title: "Kingrane — full-stack vibe developer",
    description: "Веб, 3D, AI. 17 проектов, одна чёрная дыра и немного ирисов.",
    type: "website",
    locale: "ru_RU",
    images: [
      {
        url: asset("/og.png"),
        width: 1200,
        height: 630,
        alt: "Чёрная дыра с аккреционным диском за заголовком Kingrane",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Kingrane — full-stack vibe developer",
    description: "Веб, 3D, AI. 17 проектов, одна чёрная дыра и немного ирисов.",
    images: [asset("/og.png")],
  },
  icons: {
    icon: [{ url: asset("/favicon.svg"), type: "image/svg+xml" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#07070a",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru"
      className={`${display.variable} ${sans.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="relative min-h-full bg-void">{children}</body>
    </html>
  );
}
