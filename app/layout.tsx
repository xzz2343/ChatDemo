import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import I18nProvider from "./i18n/I18nProvider";
import "./globals.css";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Chat Demo — AI Chat with Tool Use",
  description:
    "A live AI chat demo powered by Claude. Watch the model reason, call tools, and stream responses in real time — see exactly how LLM tool use works under the hood.",
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    title: "Chat Demo — AI Chat with Tool Use",
    description:
      "A live AI chat demo powered by Claude. Watch the model reason, call tools, and stream responses in real time.",
    siteName: "Chat Demo",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Chat Demo — AI Chat with Tool Use",
    description:
      "Watch Claude reason and call tools in real time. See exactly how LLM tool use works.",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Chat Demo",
  applicationCategory: "DeveloperApplication",
  description:
    "An interactive AI chat demo showing real-time LLM tool use with streaming responses.",
  operatingSystem: "Web",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={jetbrainsMono.variable}>
      <head>
        {/* Apply saved/OS theme before first paint to prevent flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var s=localStorage.getItem('theme');var d=window.matchMedia('(prefers-color-scheme: dark)').matches;if(s==='dark'||(s==null&&d)){document.documentElement.classList.add('dark');}})();`,
          }}
        />
        <Script
          id="json-ld"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-terminal-green focus:text-terminal-bg focus:rounded focus:outline-none"
        >
          Skip to main content
        </a>
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
