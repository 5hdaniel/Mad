import { redirect } from 'next/navigation';

// Force dynamic rendering (can't prerender with auth check)
export const dynamic = 'force-dynamic';

export default async function Home() {
  // For build time, just redirect to login
  // At runtime, middleware handles the auth check
  redirect('/login');
}
