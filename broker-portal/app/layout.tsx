import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import { AuthProvider } from '@/components/providers/AuthProvider';

// Microsoft Clarity project ID — set via Vercel environment variables for production.
// When the env var is absent (local dev, preview), the Clarity script is not rendered.
const clarityProjectId = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Magic Audit - Broker Portal',
  description: 'Review and approve real estate transaction audits',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {clarityProjectId && (
          <Script
            id="microsoft-clarity"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                (function(c,l,a,r,i,t,y){
                  c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                  t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                  y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
                })(window, document, "clarity", "script", "${clarityProjectId}");
              `,
            }}
          />
        )}
      </head>
      <body className={inter.className}>
        <AuthProvider>
          <main className="min-h-screen">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
