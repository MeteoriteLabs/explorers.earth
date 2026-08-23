import ts from "typescript";

const STABLE_CODE = /^[A-Z][A-Z0-9_]{2,}$/;
const CODE_CONTEXT = /(?:^|_)(?:CODE|CODES|DIAGNOSTICS|RESULTS?|STATUSES|REASONS?)(?:$|_)/i;
const CODE_PROPERTY = new Set(["code", "reasonCode", "recoveryEvidenceCode"]);
const CODE_FUNCTION = /(?:code|reason|status|result)$/i;

function textName(node) {
  if (ts.isIdentifier(node) || ts.isStringLiteral(node)) return node.text;
  if (ts.isPropertyAccessExpression(node)) return node.name.text;
  return "";
}

function stableStrings(node, output) {
  if (ts.isStringLiteralLike(node)) {
    const code = node.text.match(/^([A-Z][A-Z0-9_]{2,})(?=:|$)/)?.[1];
    if (code && STABLE_CODE.test(code)) output.add(code);
  }
  ts.forEachChild(node, (child) => stableStrings(child, output));
}

export function discoverStableProducerCodes(source, filename = "producer.mjs") {
  const root = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const output = new Set();
  function visit(node, returnCodeContext = false) {
    let childReturnContext = returnCodeContext;
    if (ts.isFunctionDeclaration(node)) childReturnContext = CODE_FUNCTION.test(textName(node.name));
    if ((ts.isArrowFunction(node) || ts.isFunctionExpression(node)) && ts.isVariableDeclaration(node.parent)) {
      childReturnContext = CODE_FUNCTION.test(textName(node.parent.name));
      if (childReturnContext && ts.isArrowFunction(node) && !ts.isBlock(node.body)) stableStrings(node.body, output);
    }
    if (ts.isReturnStatement(node) && returnCodeContext && node.expression) stableStrings(node.expression, output);
    if (ts.isPropertyAssignment(node) && CODE_PROPERTY.has(textName(node.name))) stableStrings(node.initializer, output);
    if (ts.isShorthandPropertyAssignment(node) && CODE_PROPERTY.has(node.name.text)) {
      // The value is discovered at its declaration/assignment site.
    }
    if (ts.isVariableDeclaration(node) && CODE_CONTEXT.test(textName(node.name)) && node.initializer) stableStrings(node.initializer, output);
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken && CODE_PROPERTY.has(textName(node.left))) {
      stableStrings(node.right, output);
    }
    if (ts.isNewExpression(node) && textName(node.expression) === "Error") {
      for (const argument of node.arguments ?? []) stableStrings(argument, output);
    }
    ts.forEachChild(node, (child) => visit(child, childReturnContext));
  }
  visit(root);
  return output;
}
