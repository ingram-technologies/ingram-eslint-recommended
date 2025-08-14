import type { Rule } from "eslint";
import type {
	ExportDefaultDeclaration,
	ExportNamedDeclaration,
	FunctionDeclaration,
	FunctionExpression,
	Identifier,
	ImportDeclaration,
	ImportSpecifier,
	Node,
	Pattern,
	VariableDeclaration,
} from "estree";

interface IdentifierWithType extends Identifier {
	typeAnnotation?: any;
}

interface PatternWithType {
	typeAnnotation?: any;
	type: Pattern["type"];
}

interface VariableDeclarationWithParent extends VariableDeclaration {
	parent: Node;
}

const rule: Rule.RuleModule = {
	meta: {
		type: "problem",
		docs: {
			description: "Enforce Next.js page component patterns",
			category: "Best Practices",
			recommended: true,
		},
		fixable: "code",
		schema: [],
		messages: {
			noExportDefaultFunction:
				"Page components should be const arrow functions with NextPage type, not export default function",
			noDirectExport:
				"Page components should not be exported directly. Use 'export default ComponentName' at the end",
			badComponentName:
				"Page component should have a descriptive name ending with 'Page', not '{{name}}'",
			missingNextPageType:
				"Page components must be typed as NextPage or NextPage<Props>",
			notArrowFunction: "Page components should be arrow functions",
			notConst: "Page components should be declared with const",
			wrongExportPattern: "Page must use separate export default statement",
		},
	},
	create(context) {
		const sourceCode = context.sourceCode ?? context.getSourceCode();
		const filename = context.filename ?? context.getFilename();

		// Only apply to page.tsx files
		if (!filename.endsWith("/page.tsx")) {
			return {};
		}

		let hasNextPageImport = false;
		let defaultExport: ExportDefaultDeclaration | null = null;
		const exportedComponents: string[] = [];

		/**
		 * Generate a page name from the filename
		 */
		function generatePageName(filename: string): string {
			// Try to infer from path
			const pathParts = filename.split("/");
			const parentDir = pathParts[pathParts.length - 2];

			if (!parentDir || parentDir === "app" || parentDir.startsWith("(")) {
				// Handle group folders like (marketing)
				for (let i = pathParts.length - 3; i >= 0; i--) {
					const part = pathParts[i];
					if (
						part
						&& !part.startsWith("(")
						&& part !== "app"
						&& part !== "src"
					) {
						const segments = part.split("-");
						const capitalized = segments.map(
							(p) => p.charAt(0).toUpperCase() + p.slice(1),
						);
						const joined = capitalized.join("");
						return joined + "Page";
					}
				}
				return "DefaultPage";
			}

			// Convert kebab-case to PascalCase
			const segments = parentDir.split("-");
			const capitalized = segments.map(
				(part) => part.charAt(0).toUpperCase() + part.slice(1),
			);
			const joined = capitalized.join("");
			return joined + "Page";
		}

		return {
			ImportDeclaration(node: ImportDeclaration) {
				if (node.source.value === "next") {
					const hasNextPage = node.specifiers.some(
						(spec): boolean =>
							spec.type === "ImportSpecifier"
							&& ((spec as ImportSpecifier).imported as Identifier).name
								=== "NextPage",
					);
					if (hasNextPage) {
						hasNextPageImport = true;
					}
				}
			},

			ExportDefaultDeclaration(node: ExportDefaultDeclaration) {
				defaultExport = node;

				// Check for export default function
				if (node.declaration.type === "FunctionDeclaration") {
					const funcNode = node.declaration as FunctionDeclaration;
					const componentName = funcNode.id ? funcNode.id.name : "Page";

					// Generate a better name if needed
					let suggestedName = componentName;
					if (componentName === "Page" || !componentName.endsWith("Page")) {
						suggestedName = generatePageName(filename);
					}

					context.report({
						node,
						messageId: "noExportDefaultFunction",
						fix(fixer) {
							const fixes: Rule.Fix[] = [];

							// Add NextPage import if missing
							if (!hasNextPageImport) {
								const firstImport = sourceCode.ast.body.find(
									(n): n is ImportDeclaration =>
										n.type === "ImportDeclaration",
								);
								if (firstImport) {
									fixes.push(
										fixer.insertTextBefore(
											firstImport,
											'import type { NextPage } from "next";\n',
										),
									);
								} else {
									// No imports, add at the beginning
									fixes.push(
										fixer.insertTextBeforeRange(
											[0, 0],
											'import type { NextPage } from "next";\n\n',
										),
									);
								}
							}

							// Extract function body and params
							const params = funcNode.params
								.map((p) => sourceCode.getText(p))
								.join(", ");
							const body = sourceCode.getText(funcNode.body);
							const isAsync = funcNode.async;

							// Extract props type if exists
							let propsType = "";
							if (
								funcNode.params.length > 0
								&& (funcNode.params[0] as PatternWithType)
									.typeAnnotation
							) {
								const paramType = sourceCode.getText(
									(funcNode.params[0] as PatternWithType)
										.typeAnnotation,
								);
								// Remove the leading colon
								propsType = paramType.startsWith(":")
									? paramType.slice(1).trim()
									: paramType;
							}

							// Build the new component
							let newComponent = `const ${suggestedName}: NextPage`;
							if (propsType) {
								newComponent += `<${propsType}>`;
							}
							newComponent += " = ";
							if (isAsync) newComponent += "async ";
							newComponent += `(${params}) => ${body};\n\nexport default ${suggestedName};`;

							fixes.push(fixer.replaceText(node, newComponent));

							return fixes;
						},
					});
				}
				// Check for export default identifier
				else if (node.declaration.type === "Identifier") {
					// This is good - separate export default
				}
			},

			ExportNamedDeclaration(node: ExportNamedDeclaration) {
				// Check for exported const
				if (
					node.declaration
					&& node.declaration.type === "VariableDeclaration"
				) {
					const varDecl = node.declaration as VariableDeclaration;
					const decl = varDecl.declarations[0];
					if (decl && decl.id.type === "Identifier" && decl.init) {
						const componentName = (decl.id as Identifier).name;

						// Check if this looks like a page component
						if (
							componentName.endsWith("Page")
							&& (decl.init.type === "ArrowFunctionExpression"
								|| decl.init.type === "FunctionExpression")
						) {
							exportedComponents.push(componentName);

							context.report({
								node,
								messageId: "noDirectExport",
								fix(fixer) {
									const fixes: Rule.Fix[] = [];

									// Remove the export keyword
									if (node.declaration) {
										const varDeclaration = sourceCode.getText(
											node.declaration,
										);
										fixes.push(
											fixer.replaceText(node, varDeclaration),
										);
									}

									// Add export default at the end if not present
									if (!defaultExport) {
										const lastNode =
											sourceCode.ast.body[
												sourceCode.ast.body.length - 1
											];
										if (lastNode) {
											fixes.push(
												fixer.insertTextAfter(
													lastNode,
													`\n\nexport default ${componentName};`,
												),
											);
										}
									}

									return fixes;
								},
							});
						}
					}
				}
			},

			VariableDeclaration(node: VariableDeclaration) {
				const nodeWithParent = node as VariableDeclarationWithParent;
				// Check non-exported const declarations
				if (
					nodeWithParent.kind === "const"
					&& nodeWithParent.parent?.type !== "ExportNamedDeclaration"
				) {
					for (const decl of node.declarations) {
						if (decl.id.type === "Identifier" && decl.init) {
							const componentName = (decl.id as Identifier).name;

							// Check if it looks like a page component based on name
							if (componentName.endsWith("Page")) {
								// Check component name
								if (componentName === "Page") {
									const suggestedName = generatePageName(filename);
									context.report({
										node: decl.id,
										messageId: "badComponentName",
										data: { name: componentName },
										fix(fixer) {
											const fixes: Rule.Fix[] = [];

											// Replace all occurrences of the old name
											fixes.push(
												fixer.replaceText(
													decl.id,
													suggestedName,
												),
											);

											// Also fix the export default if it exists
											if (
												defaultExport
												&& defaultExport.declaration.type
													=== "Identifier"
												&& (
													defaultExport.declaration as Identifier
												).name === componentName
											) {
												fixes.push(
													fixer.replaceText(
														defaultExport.declaration,
														suggestedName,
													),
												);
											}

											return fixes;
										},
									});
								}

								const idWithType = decl.id as IdentifierWithType;
								// Check for NextPage type
								if (
									!idWithType.typeAnnotation
									|| !sourceCode
										.getText(idWithType.typeAnnotation)
										.includes("NextPage")
								) {
									// Extract props type from function params if available
									let propsType = "";
									if (
										decl.init
										&& decl.init.type === "ArrowFunctionExpression"
										&& decl.init.params.length > 0
										&& (decl.init.params[0] as PatternWithType)
											.typeAnnotation
									) {
										const paramType = sourceCode.getText(
											(decl.init.params[0] as PatternWithType)
												.typeAnnotation,
										);
										propsType = paramType.startsWith(":")
											? paramType.slice(1).trim()
											: paramType;
									}

									context.report({
										node: decl.id,
										messageId: "missingNextPageType",
										fix(fixer) {
											const fixes: Rule.Fix[] = [];

											// Add NextPage import if missing
											if (!hasNextPageImport) {
												const firstImport =
													sourceCode.ast.body.find(
														(n): n is ImportDeclaration =>
															n.type
															=== "ImportDeclaration",
													);
												if (firstImport) {
													fixes.push(
														fixer.insertTextBefore(
															firstImport,
															'import type { NextPage } from "next";\n',
														),
													);
												} else {
													// No imports, add at the beginning
													fixes.push(
														fixer.insertTextBeforeRange(
															[0, 0],
															'import type { NextPage } from "next";\n\n',
														),
													);
												}
											}

											// Build the type annotation
											let typeAnnotation = ": NextPage";
											if (propsType) {
												typeAnnotation = `: NextPage<${propsType}>`;
											}

											// Add or replace type annotation
											if (idWithType.typeAnnotation) {
												// Replace existing type
												fixes.push(
													fixer.replaceText(
														idWithType.typeAnnotation,
														typeAnnotation,
													),
												);
											} else {
												// Add type annotation
												fixes.push(
													fixer.insertTextAfter(
														decl.id,
														typeAnnotation,
													),
												);
											}

											return fixes;
										},
									});
								}

								// Check for arrow function
								if (
									decl.init
									&& decl.init.type !== "ArrowFunctionExpression"
								) {
									context.report({
										node: decl.init,
										messageId: "notArrowFunction",
										fix(fixer) {
											if (
												decl.init?.type === "FunctionExpression"
											) {
												const funcNode =
													decl.init as FunctionExpression;
												const params = funcNode.params
													.map((p) => sourceCode.getText(p))
													.join(", ");
												const body = sourceCode.getText(
													funcNode.body,
												);
												const isAsync = funcNode.async;

												let arrowFunc = isAsync ? "async " : "";
												arrowFunc += `(${params}) => ${body}`;

												return fixer.replaceText(
													funcNode,
													arrowFunc,
												);
											}
											return null;
										},
									});
								}
							}
						}
					}
				}

				// Check for let or var
				if (
					(nodeWithParent.kind === "let" || nodeWithParent.kind === "var")
					&& nodeWithParent.parent?.type !== "ExportNamedDeclaration"
				) {
					for (const decl of node.declarations) {
						if (decl.id.type === "Identifier" && decl.init) {
							const componentName = (decl.id as Identifier).name;

							if (componentName.endsWith("Page")) {
								context.report({
									node,
									messageId: "notConst",
									fix(fixer) {
										const text = sourceCode.getText(node);
										const newText = text.replace(
											/^(let|var)/,
											"const",
										);
										return fixer.replaceText(node, newText);
									},
								});
							}
						}
					}
				}
			},
		};
	},
};

export default rule;
