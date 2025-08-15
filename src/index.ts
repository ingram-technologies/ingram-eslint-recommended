import type { ESLint } from "eslint";
import lucideIconSuffix from "./rules/lucide-icon-suffix";
import nextNoRedirectOnlyPages from "./rules/next-no-redirect-only-pages";
import nextjsPagePattern from "./rules/nextjs-page-pattern";
import reactNoRedundantUseStateTypes from "./rules/react-no-redundant-usestate-types";
import supabaseNoDirectImports from "./rules/supabase-no-direct-imports";
import supabaseNoInsertWithId from "./rules/supabase-no-insert-with-id";

const rules = {
	"lucide-icon-suffix": lucideIconSuffix,
	"supabase-no-direct-imports": supabaseNoDirectImports,
	"supabase-no-insert-with-id": supabaseNoInsertWithId,
	"react-no-redundant-usestate-types": reactNoRedundantUseStateTypes,
	"next-no-redirect-only-pages": nextNoRedirectOnlyPages,
	"nextjs-page-pattern": nextjsPagePattern,
};

const plugin: ESLint.Plugin = {
	rules,
	configs: {},
};

// Export flat configs as properties
const configs = {
	recommended: {
		plugins: {
			"@ingram-tech/recommended": plugin,
		},
		rules: {
			// Custom plugin rules
			"@ingram-tech/recommended/lucide-icon-suffix": "error",
			"@ingram-tech/recommended/nextjs-page-pattern": "error",
			"@ingram-tech/recommended/supabase-no-direct-imports": "error",
			"@ingram-tech/recommended/supabase-no-insert-with-id": "error",
			"@ingram-tech/recommended/next-no-redirect-only-pages": "warn",
			"@ingram-tech/recommended/react-no-redundant-usestate-types": "error",

			// TypeScript ESLint rule overrides
			"@typescript-eslint/no-confusing-void-expression": "off",
			"@typescript-eslint/no-misused-promises": "off",
			"@typescript-eslint/no-non-null-assertion": "off",
			"@typescript-eslint/no-unnecessary-condition": "off",
			"@typescript-eslint/no-unsafe-argument": "off",
			"@typescript-eslint/no-unsafe-assignment": "off",
			"@typescript-eslint/no-unsafe-member-access": "off",
			"@typescript-eslint/no-unsafe-return": "off",
			"@typescript-eslint/restrict-template-expressions": "off",

			// React rule overrides
			"react/no-unescaped-entities": "off",
		},
	},
	test: {
		rules: {
			"@typescript-eslint/no-explicit-any": "off",
			"@typescript-eslint/unbound-method": "off",
			"@typescript-eslint/require-await": "off",
			"@typescript-eslint/no-unsafe-call": "off",
		},
	},
};

module.exports = plugin;
module.exports.configs = configs;
