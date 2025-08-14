import type { Rule } from "eslint";
import type {
	ArrowFunctionExpression,
	BlockStatement,
	CallExpression,
	FunctionExpression,
	Identifier,
	TemplateLiteral,
	VariableDeclarator,
} from "estree";

const rule: Rule.RuleModule = {
	meta: {
		type: "suggestion",
		docs: {
			description: "Prefer next.config.ts redirects over redirect-only pages",
			category: "Best Practices",
			recommended: true,
		},
		messages: {
			useConfigRedirect:
				"This page only performs a redirect. Consider using next.config.ts redirects instead for better performance.",
			showExample:
				"Example for next.config.ts:\n```\n{\n  source: '{{source}}',\n  destination: '{{destination}}',\n  permanent: {{permanent}},\n}\n```",
		},
		schema: [],
	},
	create(context) {
		const sourceCode = context.sourceCode ?? context.getSourceCode();
		const filename = context.filename ?? context.getFilename();

		// Only apply to page.tsx files
		if (!filename.endsWith("/page.tsx")) {
			return {};
		}

		let hasRedirectCall = false;
		let redirectDestination: string | null = null;
		let isSimpleRedirect = true;
		let redirectNode: CallExpression | null = null;

		/**
		 * Extract path from filename
		 */
		function getSourcePath(filename: string): string | null {
			// Extract path from src/app/... to create the route
			const match = filename.match(/src\/app(.*)\/page\.tsx$/);
			if (!match) return null;

			let path = match[1];

			// Remove route groups (parentheses)
			path = path.replace(/\/\([^)]+\)/g, "");

			// Handle root path
			if (!path || path === "") return "/";

			// Handle dynamic segments
			path = path.replace(/\[([^\]]+)\]/g, ":$1");

			return path;
		}

		/**
		 * Check if a function body only contains a redirect
		 */
		function isOnlyRedirect(
			body: BlockStatement | CallExpression | undefined,
		): boolean {
			if (!body) return false;

			if (body.type === "BlockStatement") {
				// Check block statements
				const statements = body.body.filter(
					(stmt) => stmt.type !== "EmptyStatement",
				);

				if (statements.length === 0) return false;
				if (statements.length > 2) return false; // Allow for variable + redirect

				// Check if it's just redirect or variable + redirect
				for (const stmt of statements) {
					if (stmt.type === "ExpressionStatement") {
						const expr = stmt.expression;
						if (
							expr.type === "CallExpression"
							&& expr.callee.type === "Identifier"
							&& expr.callee.name === "redirect"
						) {
							continue;
						}
						return false;
					} else if (stmt.type === "VariableDeclaration") {
						// Allow variable declarations for dynamic redirects
						continue;
					} else if (stmt.type === "ReturnStatement") {
						// Allow early returns before redirect
						continue;
					} else {
						return false;
					}
				}
				return true;
			} else if (body.type === "CallExpression") {
				// Arrow function with direct expression
				return (
					body.callee.type === "Identifier" && body.callee.name === "redirect"
				);
			}

			return false;
		}

		/**
		 * Extract redirect destination from the call
		 */
		function extractDestination(node: CallExpression): string | null {
			if (!node.arguments || node.arguments.length === 0) return null;

			const firstArg = node.arguments[0];

			// Handle string literal
			if (firstArg.type === "Literal" && typeof firstArg.value === "string") {
				return firstArg.value;
			}

			// Handle template literal without expressions
			if (
				firstArg.type === "TemplateLiteral"
				&& firstArg.expressions.length === 0
				&& firstArg.quasis.length === 1
			) {
				return firstArg.quasis[0].value.raw;
			}

			// Handle simple template literals with identifiers (dynamic segments)
			if (firstArg.type === "TemplateLiteral") {
				const templateLit = firstArg as TemplateLiteral;
				let result = "";
				for (let i = 0; i < templateLit.quasis.length; i++) {
					result += templateLit.quasis[i].value.raw;
					if (i < templateLit.expressions.length) {
						const expr = templateLit.expressions[i];
						if (expr.type === "Identifier") {
							// This is a dynamic segment
							result += `:${(expr as Identifier).name}`;
						} else if (
							expr.type === "AwaitExpression"
							&& (expr as any).argument?.type === "CallExpression"
						) {
							// Handle await getIdFromUrlParams(params) pattern
							result += `:id`;
						} else {
							// Complex expression, not a simple redirect
							return null;
						}
					}
				}
				return result;
			}

			return null;
		}

		return {
			VariableDeclarator(node: VariableDeclarator) {
				// Track the component name
				if (
					node.id.type === "Identifier"
					&& node.id.name.endsWith("Page")
					&& node.init
					&& (node.init.type === "ArrowFunctionExpression"
						|| node.init.type === "FunctionExpression")
				) {
					// Check if the function body only contains redirect
					const funcExpr = node.init as
						| ArrowFunctionExpression
						| FunctionExpression;
					const body = funcExpr.body as
						| BlockStatement
						| CallExpression
						| undefined;
					if (!isOnlyRedirect(body)) {
						isSimpleRedirect = false;
					}
				}
			},

			CallExpression(node: CallExpression) {
				// Check for redirect calls
				if (
					node.callee.type === "Identifier"
					&& node.callee.name === "redirect"
				) {
					hasRedirectCall = true;
					redirectNode = node;
					redirectDestination = extractDestination(node);
				}
			},

			"Program:exit"() {
				// Only report if:
				// 1. Has a redirect call
				// 2. Is a simple redirect (no complex logic)
				// 3. Has a extractable destination
				if (
					hasRedirectCall
					&& isSimpleRedirect
					&& redirectDestination
					&& redirectNode
				) {
					const sourcePath = getSourcePath(filename);

					if (sourcePath) {
						context.report({
							node: redirectNode,
							messageId: "useConfigRedirect",
							data: {
								source: sourcePath,
								destination: redirectDestination,
								permanent: "false",
							},
						});

						// Also report with the example
						context.report({
							node: redirectNode,
							messageId: "showExample",
							data: {
								source: sourcePath,
								destination: redirectDestination,
								permanent: "false",
							},
						});
					}
				}
			},
		};
	},
};

export default rule;
