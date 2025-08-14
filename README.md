# @ingram-tech/eslint-plugin-recommended

ESLint plugin with recommended rules for Ingram Tech projects.

## Installation

```bash
npm install --save-dev @ingram-tech/eslint-plugin-recommended
# or
yarn add -D @ingram-tech/eslint-plugin-recommended
# or
bun add -D @ingram-tech/eslint-plugin-recommended
```

## Usage

Add the plugin to your ESLint configuration:

```javascript
// eslint.config.mjs
import ingramRecommended from '@ingram-tech/eslint-plugin-recommended';

export default [
  {
    plugins: {
      '@ingram-tech/recommended': ingramRecommended,
    },
    rules: {
      '@ingram-tech/recommended/lucide-icon-suffix': 'error',
      '@ingram-tech/recommended/supabase-no-direct-imports': 'error',
      '@ingram-tech/recommended/supabase-no-insert-with-id': 'error',
      '@ingram-tech/recommended/react-no-redundant-usestate-types': 'warn',
      '@ingram-tech/recommended/next-no-redirect-only-pages': 'warn',
      '@ingram-tech/recommended/nextjs-page-pattern': 'error',
    },
  },
];
```

## Available Rules

### `lucide-icon-suffix`
Enforces that all lucide-react icon imports use the "Icon" suffix.

### `supabase-no-direct-imports`
Prevents direct imports from @supabase packages. Use wrapper clients instead.

### `supabase-no-insert-with-id`
Disallows specifying 'id' when inserting into database tables. Let the database auto-generate IDs.

### `react-no-redundant-usestate-types`
Removes redundant type annotations in useState hooks that can be inferred.

### `next-no-redirect-only-pages`
Suggests using next.config.ts redirects instead of pages that only perform redirects.

### `nextjs-page-pattern`
Enforces consistent Next.js page component patterns (const arrow functions with NextPage type).

## License

MIT