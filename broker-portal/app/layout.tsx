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

  // Strip server-side-only fields before passing to the client component.
  // admin_user_id and target_user_id must never appear in the RSC payload.
  const clientSession = impersonationSession
    ? (() => {
        const { admin_user_id: _a, target_user_id: _t, ...rest } = impersonationSession;
        return rest;
      })()
    : null;

  return (
    <html lang="en">
      <body className={inter.className}>
        {process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID && (
          <ClarityAnalytics projectId={process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID} />
        )}
        <AuthProvider>
          <ImpersonationProvider session={clientSession}>
            <main className="min-h-screen">{children}</main>
          </ImpersonationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
