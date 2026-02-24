import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign in - Keepr',
  description: 'Sign in to Keepr desktop application',
};

export default function DesktopAuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
