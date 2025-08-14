import type {
	TSArrayType,
	TSTypeParameterInstantiation,
	TSUnionType,
} from "@typescript-eslint/types/dist/generated/ast-spec";
import type { Rule } from "eslint";
import type { ArrayExpression, CallExpression, Literal } from "estree";

interface CallExpressionWithTS {
	typeArguments?: TSTypeParameterInstantiation;
	typeParameters?: TSTypeParameterInstantiation;
	callee: CallExpression["callee"];
	arguments: CallExpression["arguments"];
}

const rule: Rule.RuleModule = {
	meta: {
		type: "suggestion",
		docs: {
			description: "Remove redundant type annotations in useState hooks",
			category: "Best Practices",
			recommended: true,
		},
		fixable: "code",
		schema: [],
		messages: {
			redundantSimpleType:
				"Redundant type annotation for useState. The type '{{type}}' can be inferred from the initial value.",
			redundantUndefinedUnion:
				"Redundant '| undefined' in useState type. Use useState<{{baseType}}>() instead of useState<{{baseType}} | undefined>(undefined).",
			preferUndefinedOverNull:
				"Prefer undefined over null in useState. Use useState<{{baseType}}>() instead of useState<{{baseType}} | null>(null).",
		},
	},
	create(context) {
		const sourceCode = context.sourceCode ?? context.getSourceCode();

		return {
			CallExpression(node: CallExpression) {
				const nodeWithTS = node as CallExpressionWithTS;
				// Check if this is a useState call
				if (
					nodeWithTS.callee.type !== "Identifier"
					|| nodeWithTS.callee.name !== "useState"
				) {
					return;
				}

				// Check if it has type arguments
				const typeArguments =
					nodeWithTS.typeArguments || nodeWithTS.typeParameters;
				if (!typeArguments || typeArguments.params.length === 0) {
					return;
				}

				const typeParam = typeArguments.params[0] as any;
				const argument = nodeWithTS.arguments[0];

				// Case 1: Simple types with matching initial values
				// e.g., useState<boolean>(false), useState<string>("")
				if (argument) {
					const typeText = sourceCode.getText(typeParam);
					let isRedundant = false;

					// Check for simple type redundancy
					if (typeText === "boolean" && argument.type === "Literal") {
						const literal = argument as Literal;
						if (literal.value === true || literal.value === false) {
							isRedundant = true;
						}
					} else if (
						typeText === "string"
						&& argument.type === "Literal"
						&& typeof (argument as Literal).value === "string"
					) {
						isRedundant = true;
					} else if (
						typeText === "number"
						&& argument.type === "Literal"
						&& typeof (argument as Literal).value === "number"
					) {
						isRedundant = true;
					} else if (
						typeText === "null"
						&& argument.type === "Literal"
						&& (argument as Literal).value === null
					) {
						isRedundant = true;
					} else if (
						typeText === "undefined"
						&& argument.type === "Identifier"
						&& argument.name === "undefined"
					) {
						isRedundant = true;
					} else if (
						// Handle arrays
						typeParam.type === "TSArrayType"
						&& argument.type === "ArrayExpression"
						&& (argument as ArrayExpression).elements.length === 0
					) {
						// Check if it's a simple type array like string[], number[], etc.
						const arrayType = typeParam as TSArrayType;
						const elementType = arrayType.elementType;
						if (
							elementType.type === "TSStringKeyword"
							|| elementType.type === "TSNumberKeyword"
							|| elementType.type === "TSBooleanKeyword"
						) {
							isRedundant = true;
						}
					}

					if (isRedundant) {
						context.report({
							node: typeArguments as any,
							messageId: "redundantSimpleType",
							data: {
								type: typeText,
							},
							fix(fixer) {
								// Remove the type argument entirely
								const tokenBefore = sourceCode.getTokenBefore(
									typeArguments as any,
								);
								const tokenAfter = sourceCode.getTokenAfter(
									typeArguments as any,
								);
								return fixer.removeRange([
									tokenBefore!.range![1],
									tokenAfter!.range![0],
								]);
							},
						});
						return;
					}
				}

				// Case 2: Type | undefined with undefined initial value
				// e.g., useState<number | undefined>(undefined) -> useState<number>()
				if (
					typeParam.type === "TSUnionType"
					&& argument
					&& argument.type === "Identifier"
					&& argument.name === "undefined"
				) {
					const unionType = typeParam as TSUnionType;
					// Check if one of the union types is undefined
					const hasUndefined = unionType.types.some(
						(t: any) => t.type === "TSUndefinedKeyword",
					);

					if (hasUndefined && unionType.types.length === 2) {
						// Get the non-undefined type
						const baseType = unionType.types.find(
							(t: any) => t.type !== "TSUndefinedKeyword",
						);

						if (baseType) {
							const baseTypeText = sourceCode.getText(baseType as any);

							context.report({
								node: nodeWithTS as any,
								messageId: "redundantUndefinedUnion",
								data: {
									baseType: baseTypeText,
								},
								fix(fixer) {
									const fixes: Rule.Fix[] = [];

									// Replace the type parameter with just the base type
									fixes.push(
										fixer.replaceText(typeParam, baseTypeText),
									);

									// Remove the undefined argument
									if (nodeWithTS.arguments.length === 1) {
										// Remove the entire argument list including parentheses
										const openParen = sourceCode.getTokenAfter(
											typeArguments as any,
										);
										const closeParen =
											sourceCode.getTokenAfter(argument);
										fixes.push(
											fixer.replaceTextRange(
												[
													openParen!.range![0],
													closeParen!.range![1],
												],
												"()",
											),
										);
									}

									return fixes;
								},
							});
						}
					}
				}

				// Case 3: Type | null with null initial value
				// e.g., useState<string | null>(null) -> useState<string>()
				if (
					typeParam.type === "TSUnionType"
					&& argument
					&& argument.type === "Literal"
					&& (argument as Literal).value === null
				) {
					const unionType = typeParam as TSUnionType;
					// Check if one of the union types is null
					const hasNull = unionType.types.some(
						(t: any) => t.type === "TSNullKeyword",
					);

					if (hasNull && unionType.types.length === 2) {
						// Get the non-null type
						const baseType = unionType.types.find(
							(t: any) => t.type !== "TSNullKeyword",
						);

						if (baseType) {
							const baseTypeText = sourceCode.getText(baseType as any);

							context.report({
								node: nodeWithTS as any,
								messageId: "preferUndefinedOverNull",
								data: {
									baseType: baseTypeText,
								},
								fix(fixer) {
									const fixes: Rule.Fix[] = [];

									// Replace the type parameter with just the base type
									fixes.push(
										fixer.replaceText(typeParam, baseTypeText),
									);

									// Remove the null argument
									if (nodeWithTS.arguments.length === 1) {
										// Remove the entire argument list including parentheses
										const openParen = sourceCode.getTokenAfter(
											typeArguments as any,
										);
										const closeParen =
											sourceCode.getTokenAfter(argument);
										fixes.push(
											fixer.replaceTextRange(
												[
													openParen!.range![0],
													closeParen!.range![1],
												],
												"()",
											),
										);
									}

									return fixes;
								},
							});
						}
					}
				}

				// Case 4: Just undefined type with no argument
				// e.g., useState<undefined>() - though this is rare
				if (
					typeParam.type === "TSUndefinedKeyword"
					&& nodeWithTS.arguments.length === 0
				) {
					context.report({
						node: typeArguments as any,
						messageId: "redundantSimpleType",
						data: {
							type: "undefined",
						},
						fix(fixer) {
							// Remove the type argument entirely
							const tokenBefore = sourceCode.getTokenBefore(
								typeArguments as any,
							);
							const tokenAfter = sourceCode.getTokenAfter(
								typeArguments as any,
							);
							return fixer.removeRange([
								tokenBefore!.range![1],
								tokenAfter!.range![0],
							]);
						},
					});
				}
			},
		};
	},
};

export default rule;
