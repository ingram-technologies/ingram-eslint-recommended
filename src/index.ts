import type { ESLint } from 'eslint';
import lucideIconSuffix from './rules/lucide-icon-suffix';
import supabaseNoDirectImports from './rules/supabase-no-direct-imports';
import supabaseNoInsertWithId from './rules/supabase-no-insert-with-id';
import reactNoRedundantUseStateTypes from './rules/react-no-redundant-usestate-types';
import nextNoRedirectOnlyPages from './rules/next-no-redirect-only-pages';
import nextjsPagePattern from './rules/nextjs-page-pattern';

const plugin: ESLint.Plugin = {
	rules: {
		'lucide-icon-suffix': lucideIconSuffix,
		'supabase-no-direct-imports': supabaseNoDirectImports,
		'supabase-no-insert-with-id': supabaseNoInsertWithId,
		'react-no-redundant-usestate-types': reactNoRedundantUseStateTypes,
		'next-no-redirect-only-pages': nextNoRedirectOnlyPages,
		'nextjs-page-pattern': nextjsPagePattern,
	},
};

export = plugin;