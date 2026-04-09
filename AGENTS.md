# AGENTS.md - VitaliaGym Development Guide

## Project Overview
VitaliaGym is a Next.js 16 gym management application with offline-first capabilities, PWA support, and Supabase backend. The app is written in JavaScript (not TypeScript) and uses the App Router.

## Build Commands

### Development
```bash
pnpm dev       # Start development server on localhost:3000
pnpm build     # Production build
pnpm start     # Start production server
```

### Linting & Type Checking
```bash
pnpm lint        # Run ESLint
pnpm lint:fix    # Fix ESLint auto-fixable issues
pnpm type-check # Run TypeScript type checking (tsc --noEmit)
```

### Testing
```bash
pnpm test           # Run tests in watch mode
pnpm test:run       # Run tests once (CI mode)
pnpm test:coverage  # Run tests with coverage report
```

#### Running a Single Test
```bash
# Option 1: Using vitest directly with file pattern
npx vitest run src/__tests__/useFormValidation.test.js

# Option 2: Using grep to filter tests
npx vitest run -t "validators"

# Option 3: Watch mode for specific file
npx vitest src/__tests__/useFormValidation.test.js
```

### Database Scripts
```bash
pnpm db:recalculate-dates       # Recalculate payment dates in DB
pnpm db:recalculate-dates:dry    # Dry run of recalculation
```

---

## Code Style Guidelines

### Language
- **JavaScript** (not TypeScript) - Avoid adding TypeScript unless explicitly requested
- **Spanish** for user-facing strings (error messages, UI labels, validation messages)
- **English** for code comments and internal logic explanations

### Project Structure
```
src/
├── app/              # Next.js App Router pages
├── components/       # React components
│   ├── ui/           # shadcn/ui components
│   ├── context/      # React Context providers
│   └── */            # Feature-specific components
├── hooks/            # Custom React hooks
├── lib/              # Utility functions and helpers
├── __tests__/        # Test files
└── api/              # API client functions
```

### Import Conventions
```javascript
// Use @/ alias for absolute imports (configured in tsconfig/jsconfig)
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

// External libraries
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
```

### Naming Conventions
- **Components**: PascalCase (e.g., `UsersTable`, `DashboardView`)
- **Hooks**: camelCase with `use` prefix (e.g., `useAuth`, `usePayments`)
- **Utils/functions**: camelCase (e.g., `cn`, `calculatePayment`)
- **Files**: kebab-case for non-component files (e.g., `payment-calculations.js`)
- **React components**: PascalCase file names (e.g., `button.jsx`, `UsersTable.jsx`)

### Component Patterns

#### UI Components (shadcn/ui style)
```javascript
import * as React from "react";
import { cn } from "@/lib/utils";

const ComponentName = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn("base-styles", className)}
      {...props}
    />
  );
});
ComponentName.displayName = "ComponentName";

export { ComponentName };
```

#### Component Variants (cva)
```javascript
import { cva } from "class-variance-authority";

const componentVariants = cva("base-classes", {
  variants: {
    variant: {
      default: "variant-default-classes",
      destructive: "destructive-classes",
    },
    size: {
      default: "size-default",
      sm: "size-sm",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});
```

### Error Handling
- Use Spanish error messages for user-facing validation
- Throw descriptive errors in hooks (e.g., `"useAuth debe usarse dentro de un AuthProvider"`)
- Use try/catch for async operations with user-friendly error messages
- Use Sonner toasts (`sonner.success()`, `sonner.error()`) for user feedback

### Testing Guidelines
- Test files: `src/__tests__/*.test.js` or `*.test.jsx`
- Use Vitest with React Testing Library
- Use `describe`/`it` blocks with Spanish descriptions
- Include both happy path and edge case tests
- Use `it.skip` for known failing tests with TODO comments

### Tailwind CSS
- Use Tailwind CSS 4 with CSS variables
- Use `cn()` utility for conditional classes
- Follow shadcn/ui patterns for component styling

### Accessibility
- Include `aria-*` attributes when needed
- Use `sr-only` for screen reader text
- Include focus states (`focus-visible:ring-*`)
- Use semantic HTML elements

---

## Configuration Files

| File | Purpose |
|------|---------|
| `eslint.config.mjs` | ESLint configuration (extends next/core-web-vitals) |
| `tsconfig.json` | TypeScript/JS config with `@/` path alias |
| `vitest.config.js` | Vitest testing configuration |
| `components.json` | shadcn/ui component registry |
| `next.config.mjs` | Next.js configuration |

---

## Dependencies

### Key Libraries
- **UI**: Radix UI primitives, Tailwind CSS 4, Lucide icons
- **State**: React Context, custom hooks
- **Backend**: Supabase (auth, database)
- **Offline**: IndexedDB (idb), service workers
- **PDF**: jsPDF with autotable
- **Charts**: Recharts
- **Animation**: GSAP
- **Testing**: Vitest, Testing Library

---

## Notes for Agents

1. **Do NOT convert to TypeScript** unless explicitly requested
2. **Use pnpm** as the package manager (not npm/yarn)
3. **Run lint before committing** - fix any ESLint errors
4. **Run type-check** before submitting changes
5. **Test new features** - add tests in `src/__tests__/`
6. **Use existing patterns** - follow the conventions in existing code
7. **Database changes** may require Supabase migrations (check `supabase/` and `database/` folders)
