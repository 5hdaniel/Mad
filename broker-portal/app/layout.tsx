import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/components/providers/AuthProvider';
import { ImpersonationProvider } from '@/components/providers/ImpersonationProvider';
import { getImpersonationSession } from '@/lib/impersonation';
import ClarityAnalytics from '@/components/analytics/ClarityAnalytics';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Keepr - Broker Portal',
  description: 'Review and approve real estate transaction audits',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const impersonationSession = await getImpersonationSession();

  return (
    <html lang="en">
      <body className={inter.className}>
        {process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID && (
          <ClarityAnalytics projectId={process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID} />
        )}
        <AuthProvider>
          <ImpersonationProvider session={impersonationSession}>
            <main className="min-h-screen">{children}</main>
          </ImpersonationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
