import type { Rule } from "eslint";
import type { Identifier, ImportDeclaration, ImportSpecifier } from "estree";

const rule: Rule.RuleModule = {
	meta: {
		type: "problem",
		docs: {
			description: "Enforce Icon suffix for lucide-react imports",
			category: "Best Practices",
			recommended: true,
		},
		fixable: "code",
		schema: [],
		messages: {
			missingIconSuffix:
				"Import '{{imported}}' from lucide-react must use the Icon suffix: '{{suggested}}'",
		},
	},
	create(context) {
		return {
			ImportDeclaration(node: ImportDeclaration) {
				if (node.source.value !== "lucide-react") {
					return;
				}

				node.specifiers.forEach((specifier) => {
					if (specifier.type === "ImportSpecifier") {
						const importSpecifier = specifier as ImportSpecifier;
						const importedName = (importSpecifier.imported as Identifier)
							.name;

						// Check if the imported name ends with Icon
						if (!importedName.endsWith("Icon")) {
							const suggestedName = `${importedName}Icon`;

							context.report({
								node: specifier,
								messageId: "missingIconSuffix",
								data: {
									imported: importedName,
									suggested: suggestedName,
								},
								fix(fixer) {
									const fixes: Rule.Fix[] = [];

									// Fix the import
									fixes.push(
										fixer.replaceText(
											importSpecifier.imported,
											suggestedName,
										),
									);

									// If it's not aliased, try to fix references using getDeclaredVariables
									if (
										(importSpecifier.imported as Identifier).name
										=== importSpecifier.local.name
									) {
										try {
											const sourceCode =
												context.sourceCode
												?? context.getSourceCode();
											const declaredVariables =
												sourceCode.getDeclaredVariables(node);

											declaredVariables.forEach((variable) => {
												if (
													variable.name
													=== importSpecifier.local.name
												) {
													variable.references.forEach(
														(ref) => {
															// Skip the import itself
															if (
																ref.identifier
																!== importSpecifier.local
															) {
																fixes.push(
																	fixer.replaceText(
																		ref.identifier,
																		suggestedName,
																	),
																);
															}
														},
													);
												}
											});
										} catch {
											// If this approach doesn't work, just fix the import
										}
									}

									return fixes;
								},
							});
						}
					}
				});
			},
		};
	},
};

export default rule;
