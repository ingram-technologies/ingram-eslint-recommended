import type { Rule } from "eslint";
import type { ImportDeclaration } from "estree";

const rule: Rule.RuleModule = {
	meta: {
		type: "problem",
		docs: {
			description:
				"Disallow direct imports from @supabase packages. Use wrapper clients instead.",
			category: "Best Practices",
			recommended: false,
		},
		fixable: "code",
		schema: [],
		messages: {
			noDirectSupabaseImport:
				"Direct import from '{{source}}' is not allowed. Use '{{replacement}}' instead.",
			noDirectSSRImport:
				"Direct import of createServerClient from @supabase/ssr should use 'src/lib/supabase/server.ts' instead.",
		},
	},
	create(context) {
		const replacements: Record<string, Record<string, string>> = {
			"@supabase/supabase-js": {
				createClient: "@/integrations/supabase/client",
			},
		};

		return {
			ImportDeclaration(node: ImportDeclaration) {
				const source = node.source.value as string;

				// Check for @supabase/supabase-js imports
				if (source === "@supabase/supabase-js") {
					// Exception for files in src/integrations/supabase/
					const filename = context.filename ?? context.getFilename();
					if (filename.includes("src/integrations/supabase/")) {
						return;
					}

					// Exception for Supabase Edge Functions
					if (filename.includes("supabase/functions/")) {
						return;
					}

					const importedNames = node.specifiers
						.filter((spec): spec is any => spec.type === "ImportSpecifier")
						.map((spec) => spec.imported.name);

					if (importedNames.includes("createClient")) {
						context.report({
							node,
							messageId: "noDirectSupabaseImport",
							data: {
								source,
								replacement: replacements[source].createClient,
							},
							fix(fixer) {
								return fixer.replaceText(
									node.source,
									`"${replacements[source].createClient}"`,
								);
							},
						});
					}
				}

				// Check for createServerClient from @supabase/ssr
				if (source === "@supabase/ssr") {
					const filename = context.filename ?? context.getFilename();
					// Exception for src/lib/supabase/ files
					if (filename.includes("src/lib/supabase/")) {
						return;
					}

					const importedNames = node.specifiers
						.filter((spec): spec is any => spec.type === "ImportSpecifier")
						.map((spec) => spec.imported.name);

					if (importedNames.includes("createServerClient")) {
						context.report({
							node,
							messageId: "noDirectSSRImport",
							data: {
								source,
							},
						});
					}
				}
			},
		};
	},
};

export default rule;
