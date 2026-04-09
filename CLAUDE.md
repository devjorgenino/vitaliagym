# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VitaliaGym is a Next.js 16 gym management application with offline-first capabilities, PWA support, and Supabase backend. It uses JavaScript (not TypeScript) with the App Router.

## Common Commands

```bash
pnpm dev          # Start development server on localhost:3000
pnpm build        # Production build
pnpm start        # Start production server
pnpm lint         # Run ESLint
pnpm lint:fix     # Fix ESLint auto-fixable issues
pnpm type-check   # Run TypeScript type checking
pnpm test         # Run tests in watch mode
pnpm test:run     # Run tests once (CI mode)
```

## Running a Single Test

```bash
npx vitest run src/__tests__/useFormValidation.test.js
npx vitest run -t "validators"  # Filter by test name
```

## Architecture

### Tech Stack
- **Framework**: Next.js 16 with App Router
- **Language**: JavaScript (not TypeScript)
- **Database**: Supabase (PostgreSQL)
- **UI**: Radix UI primitives, Tailwind CSS 4, Lucide icons
- **Offline**: IndexedDB via `idb` library, service workers
- **PDF**: jsPDF with autotable
- **Charts**: Recharts
- **Testing**: Vitest with React Testing Library

### Core Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── (private)/          # Authenticated routes (dashboard, clientes, etc.)
│   ├── auth/               # Authentication pages (login, registro, reset-password)
│   └── api/                # API routes
├── components/
│   ├── ui/                 # shadcn/ui components (Button, Dialog, Table, etc.)
│   ├── context/            # React Context providers
│   │   ├── AuthProvider.js      # Authentication state management
│   │   ├── PermissionsProvider.js  # RBAC with role-based permissions
│   │   └── OfflineSyncProvider.js  # Offline data sync with IndexedDB
│   └── */                  # Feature components (admin, clients, payments, etc.)
├── hooks/                  # Custom React hooks (useAuth, usePayments, etc.)
├── lib/
│   ├── supabase.js         # Supabase client configuration
│   ├── data-sync.js        # Offline sync logic
│   ├── offline-db.js       # IndexedDB operations
│   └── utils.js            # Utility functions (cn, formatDate, etc.)
├── api/
│   └── client.js           # API client functions
└── __tests__/              # Test files
```

### Authentication & Permissions

- **AuthProvider** (`src/components/context/AuthProvider.js`): Manages user session via Supabase Auth, handles login/logout, supports offline profile updates
- **PermissionsProvider** (`src/components/context/PermissionsProvider.js`): Implements RBAC with role-based permissions loaded from database tables (`user_roles`, `role_permissions`, `permissions`)
- Use `useAuth` hook to access user state
- Use `usePermissions` hook to check permissions: `hasPermission()`, `hasRole()`, `isAdmin()`

### Offline Functionality

- IndexedDB stores mutations when offline via `OfflineSyncProvider`
- `executeWithSync()` in `data-sync.js` handles online/offline database operations
- `offline-db.js` provides CRUD operations for offline storage

### Database

Supabase database with tables in `database/` folder:
- `users`, `profiles` - User data
- `clients` - Gym clients
- `plans` - Membership plans
- `payments` - Payment records
- `attendance` - Check-in/check-out records
- `roles`, `permissions`, `user_roles`, `role_permissions` - RBAC tables
- `expenses` - Administrative expenses

## Key Patterns

### Component Variants with cva
```javascript
import { cva } from "class-variance-authority";

const buttonVariants = cva("base-classes", {
  variants: {
    variant: { default: "...", destructive: "..." },
    size: { default: "...", sm: "..." },
  },
});
```

### Using Context
```javascript
import useAuth from "@/hooks/useAuth";
import usePermissions from "@/hooks/usePermissions";

const { user } = useAuth();
const { hasPermission } = usePermissions();

if (!hasPermission('clients.view')) return <AccessDenied />;
```

### Offline-Safe Data Operations
```javascript
import { executeWithSync } from "@/lib/data-sync";

const { data, error } = await executeWithSync({
  table: 'clients',
  type: 'INSERT',
  data: clientData
});
```

## Important Notes

- Uses **pnpm** as package manager (not npm/yarn)
- Spanish for user-facing strings (error messages, UI labels)
- English for code comments
- Database changes may require Supabase migrations in `supabase/migrations/`
- PWA configured in `next.config.mjs` with offline support