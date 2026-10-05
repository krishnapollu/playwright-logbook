import ts from 'typescript';

/** Resolve the Playwright test call enclosing the editor cursor. */
export function testTitleAtCursor(file: string, source: string, offset: number): string | null {
  const kind = /\.[cm]?jsx?$/.test(file) ? ts.ScriptKind.JS : ts.ScriptKind.TS;
  const document = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind);
  const match: { title: string | null; span: number } = { title: null, span: Number.POSITIVE_INFINITY };
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && node.getStart(document) <= offset && offset <= node.getEnd()) {
      const callee = node.expression;
      const name = ts.isIdentifier(callee) && callee.text === 'test'
        || ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression) && callee.expression.text === 'test'
          && ['only', 'skip', 'fixme', 'fail'].includes(callee.name.text);
      const title = node.arguments[0];
      if (name && title && (ts.isStringLiteral(title) || ts.isNoSubstitutionTemplateLiteral(title))) {
        const span = node.getWidth(document);
        if (span < match.span) { match.title = title.text; match.span = span; }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(document);
  return match.title;
}
