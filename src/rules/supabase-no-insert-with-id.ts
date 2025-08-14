import type { Rule } from "eslint";
import type {
	ArrayExpression,
	CallExpression,
	Identifier,
	ObjectExpression,
	Property,
} from "estree";

const rule: Rule.RuleModule = {
	meta: {
		type: "problem",
		docs: {
			description:
				"Disallow specifying 'id' when inserting into database tables. Let the database auto-generate IDs.",
			category: "Best Practices",
			recommended: false,
		},
		fixable: undefined,
		schema: [],
		messages: {
			noInsertWithId:
				"Do not specify 'id' when inserting into database tables. Let the database auto-generate the ID.",
		},
	},
	create(context) {
		return {
			CallExpression(node: CallExpression) {
				// Check if this is a .insert() call
				if (
					node.callee.type === "MemberExpression"
					&& node.callee.property.type === "Identifier"
					&& node.callee.property.name === "insert"
					&& node.arguments.length > 0
				) {
					const arg = node.arguments[0];

					// Check if the argument is an object literal
					if (arg.type === "ObjectExpression") {
						const objectExpr = arg as ObjectExpression;
						// Check if any property is named 'id'
						const hasId = objectExpr.properties.some(
							(prop): boolean =>
								prop.type === "Property"
								&& ((prop as Property).key as Identifier).name === "id",
						);

						if (hasId) {
							context.report({
								node: arg,
								messageId: "noInsertWithId",
							});
						}
					}

					// Also check for array of objects (batch insert)
					if (arg.type === "ArrayExpression") {
						const arrayExpr = arg as ArrayExpression;
						if (arrayExpr.elements.length > 0) {
							arrayExpr.elements.forEach((element) => {
								if (element && element.type === "ObjectExpression") {
									const objectExpr = element as ObjectExpression;
									const hasId = objectExpr.properties.some(
										(prop): boolean =>
											prop.type === "Property"
											&& ((prop as Property).key as Identifier)
												.name === "id",
									);

									if (hasId) {
										context.report({
											node: element,
											messageId: "noInsertWithId",
										});
									}
								}
							});
						}
					}
				}
			},
		};
	},
};

export default rule;
