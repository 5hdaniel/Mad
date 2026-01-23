# BACKLOG-396: Portal - Next.js Setup + Vercel Deploy

**Priority:** P0 (Critical)
**Category:** infrastructure / portal
**Created:** 2026-01-22
**Status:** Completed
**Sprint:** SPRINT-050
**Estimated Tokens:** ~25K

---

## Summary

Create the Next.js 14 (App Router) project for the Broker Portal in a `broker-portal/` subdirectory, configure it for Vercel deployment, and ensure it's isolated from the Electron build.

---

## Problem Statement

The B2B broker portal needs:
1. A separate web application for brokers to review submissions
2. Deployed to Vercel (user preference)
3. Isolated from the Electron desktop app build
4. Shared TypeScript types with the desktop app
5. Basic project structure for subsequent development

---

## Proposed Solution

### Project Structure

```
Mad/
├── broker-portal/           # NEW: Next.js web app
│   ├── app/
│   │   ├── layout.tsx       # Root layout
│   │   ├── page.tsx         # Landing/redirect
│   │   ├── globals.css      # Tailwind styles
│   │   ├── login/
│   │   │   └── page.tsx     # OAuth login
│   │   └── dashboard/
│   │       ├── layout.tsx   # Dashboard shell
│   │       ├── page.tsx     # Overview
│   │       └── submissions/
│   │           ├── page.tsx # List
│   │           └── [id]/
│   │               └── page.tsx # Detail
│   ├── components/          # React components
│   │   └── ui/              # shadcn/ui components
│   ├── lib/
│   │   ├── supabase.ts      # Supabase client
│   │   └── utils.ts         # Utilities
│   ├── middleware.ts        # Auth protection
│   ├── tailwind.config.ts   # Tailwind config
│   ├── next.config.mjs      # Next.js config
│   ├── package.json         # Separate dependencies
│   ├── tsconfig.json        # TypeScript config
│   └── .env.local.example   # Environment template
├── shared/                  # NEW: Shared types
│   └── types/
│       └── submissions.ts   # Shared interfaces
├── electron/                # Unchanged
├── src/                     # Unchanged
└── package.json             # Root workspace config
```

### Next.js Project Setup

```bash
cd Mad
npx create-next-app@latest broker-portal \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir=false \
  --import-alias="@/*"
```

### Root package.json Workspace

Add workspace configuration to root `package.json`:

```json
{
  "workspaces": [
    "broker-portal"
  ],
  "scripts": {
    "portal:dev": "npm run dev -w broker-portal",
    "portal:build": "npm run build -w broker-portal",
    "portal:lint": "npm run lint -w broker-portal"
  }
}
```

### broker-portal/package.json

```json
{
  "name": "magic-audit-broker-portal",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "14.x",
    "react": "18.x",
    "react-dom": "18.x",
    "@supabase/supabase-js": "^2.x",
    "@supabase/ssr": "^0.x",
    "tailwindcss": "^3.x",
    "lucide-react": "^0.x"
  },
  "devDependencies": {
    "@types/node": "^20.x",
    "@types/react": "^18.x",
    "@types/react-dom": "^18.x",
    "typescript": "^5.x",
    "autoprefixer": "^10.x",
    "postcss": "^8.x"
  }
}
```

### Vercel Configuration

Create `broker-portal/vercel.json`:

```json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "devCommand": "npm run dev",
  "installCommand": "npm install"
}
```

### Environment Variables

Create `broker-portal/.env.local.example`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Shared Types

Create `shared/types/submissions.ts`:

```typescript
// Shared between desktop app and broker portal

export type SubmissionStatus = 
  | 'submitted'
  | 'under_review'
  | 'needs_changes'
  | 'resubmitted'
  | 'approved'
  | 'rejected';

export interface TransactionSubmission {
  id: string;
  organization_id: string;
  submitted_by: string;
  local_transaction_id: string;
  property_address: string;
  property_city: string | null;
  property_state: string | null;
  property_zip: string | null;
  transaction_type: 'purchase' | 'sale' | 'other';
  listing_price: number | null;
  sale_price: number | null;
  started_at: string | null;
  closed_at: string | null;
  status: SubmissionStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  version: number;
  parent_submission_id: string | null;
  message_count: number;
  attachment_count: number;
  created_at: string;
  updated_at: string;
}

export interface SubmissionMessage {
  id: string;
  submission_id: string;
  local_message_id: string | null;
  channel: 'email' | 'sms' | 'imessage';
  direction: 'inbound' | 'outbound';
  subject: string | null;
  body_text: string | null;
  participants: {
    from?: string;
    to?: string[];
    cc?: string[];
    bcc?: string[];
  };
  sent_at: string | null;
  thread_id: string | null;
  has_attachments: boolean;
  attachment_count: number;
  created_at: string;
}

export interface SubmissionAttachment {
  id: string;
  submission_id: string;
  message_id: string | null;
  filename: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  storage_path: string;
  document_type: string | null;
  created_at: string;
}
```

### Basic App Layout

Create `broker-portal/app/layout.tsx`:

```tsx
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Magic Audit - Broker Portal',
  description: 'Review and approve transaction audits',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
      </body>
    </html>
  )
}
```

### Landing Page

Create `broker-portal/app/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function Home() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  
  if (session) {
    redirect('/dashboard')
  } else {
    redirect('/login')
  }
}
```

---

## Files to Create/Modify

| File | Change |
|------|--------|
| `broker-portal/*` | New Next.js project |
| `shared/types/submissions.ts` | Shared TypeScript types |
| `package.json` (root) | Add workspaces config |
| `.gitignore` | Add `broker-portal/.next/` |
| `electron-builder.yml` | Verify isolation (should already exclude) |

---

## Dependencies

- BACKLOG-388: RLS policies (portal queries will use them)

---

## Acceptance Criteria

- [ ] Next.js project created in `broker-portal/`
- [ ] `npm run portal:dev` starts development server
- [ ] `npm run portal:build` builds successfully
- [ ] Tailwind CSS configured and working
- [ ] Supabase client configured
- [ ] Shared types accessible from both projects
- [ ] Electron build excludes `broker-portal/`
- [ ] Vercel deployment works (preview deploy)
- [ ] Environment variables documented

---

## Technical Notes

### Build Isolation

The `electron-builder.yml` already only bundles specific directories. Verify it doesn't include `broker-portal/`:

```yaml
files:
  - "electron/**/*"
  - "dist/**/*"
  - "node_modules/**/*"
  - "package.json"
  # broker-portal/ is NOT listed = excluded
```

### Path Aliases

In `broker-portal/tsconfig.json`:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"],
      "@shared/*": ["../shared/*"]
    }
  }
}
```

### Supabase Client Setup

Create `broker-portal/lib/supabase/client.ts`:

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

Create `broker-portal/lib/supabase/server.ts`:

```typescript
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
  const cookieStore = cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: '', ...options })
        },
      },
    }
  )
}
```

### Vercel Deployment

1. Connect GitHub repo to Vercel
2. Set root directory to `broker-portal`
3. Add environment variables in Vercel dashboard
4. Enable preview deployments for PRs

---

## Testing Plan

1. Run `npm run portal:dev`, verify starts on localhost:3000
2. Run `npm run portal:build`, verify builds without errors
3. Verify Tailwind styles apply
4. Verify landing page redirects appropriately
5. Test Vercel preview deployment
6. Verify Electron build still works (`npm run build`)
7. Verify shared types import correctly

---

## Related Items

- BACKLOG-388: RLS Policies (portal needs these)
- BACKLOG-397: Supabase Auth (next task)
- BACKLOG-398: Dashboard + List (uses this structure)
- SPRINT-050: B2B Broker Portal Demo
