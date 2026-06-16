import type { Metadata, Viewport } from "next";
import "./globals.css";
import ToastProvider from "@/components/ui/Toast";
import Script from "next/script";
import { I18nProvider } from "@/lib/i18n";
import PageTextTranslator from "@/components/ui/PageTextTranslator";
import { AppDialogProvider } from "@/components/ui/AppDialogProvider";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#FF5722",
};

export const metadata: Metadata = {
  title: "ReManage — Society Management Platform",
  description:
    "ReManage is a complete society management platform — billing, security, maintenance, and community. By Buzyhub.in",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ReManage",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/logo.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta id="theme-color-meta" name="theme-color" content="#FF5722" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                try {
                  var path = location.pathname;
                  if (path === '/SmartSocietyHub' || path === '/SmartSocietyHub/') {
                    location.replace('/');
                    return;
                  }
                  var stored = localStorage.getItem('theme');
                  var dark = stored === 'dark';
                  document.documentElement.classList.toggle('dark', dark);
                  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
                  var meta = document.querySelector('meta[name="theme-color"]');
                  if (meta) meta.setAttribute('content', dark ? '#0B1220' : '#FF5722');
                } catch (_) {}
              })();
            `,
          }}
        />
      </head>
      <body className="antialiased">
        <ToastProvider />
        <I18nProvider>
          <AppDialogProvider>
            <PageTextTranslator />
            {children}
          </AppDialogProvider>
        </I18nProvider>
        <Script id="sw-register" strategy="lazyOnload">{`
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').catch(()=>{});
          }
        `}</Script>
      </body>
    </html>
  );
}
