import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign in - Magic Audit',
  description: 'Sign in to Magic Audit desktop application',
};

export default function DesktopAuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
