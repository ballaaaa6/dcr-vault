import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const require = (await import('node:module')).createRequire(import.meta.url);
const tsPath = process.env.TYPESCRIPT_PATH;
const ts = tsPath ? require(path.resolve(tsPath)) : require('typescript');
const sourceRoot = path.resolve(process.argv[2] ?? '');

if (!sourceRoot || !fs.statSync(sourceRoot).isDirectory()) {
  throw new Error('Pass the extracted tcgdex/cards-database repository directory.');
}

function sourceFiles(root) {
  const found = [];
  function visit(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile() && entry.name.endsWith('.ts')) found.push(absolute);
    }
  }
  visit(root);
  return found.sort();
}

function propName(node) {
  if (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node)) return node.text;
  throw new Error(`Unsupported object property name: ${node.getText()}`);
}

function literal(node, file) {
  if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) {
    return literal(node.expression, file);
  }
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text.replaceAll('_', ''));
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isPrefixUnaryExpression(node) && (node.operator === ts.SyntaxKind.MinusToken || node.operator === ts.SyntaxKind.PlusToken)) {
    const value = literal(node.operand, file);
    return node.operator === ts.SyntaxKind.MinusToken ? -value : value;
  }
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    return literal(node.left, file) + literal(node.right, file);
  }
  if (ts.isArrayLiteralExpression(node)) return node.elements.map((item) => literal(item, file));
  if (ts.isObjectLiteralExpression(node)) {
    const result = {};
    for (const member of node.properties) {
      if (!ts.isPropertyAssignment(member)) {
        if (ts.isShorthandPropertyAssignment(member) && member.name.text === 'undefined') continue;
        throw new Error(`Unsupported object member in ${file}: ${member.getText()}`);
      }
      const key = propName(member.name);
      // These are local module references; their records are stored separately and linked by IDs.
      if ((key === 'set' && ts.isIdentifier(member.initializer) && member.initializer.text === 'Set') ||
          (key === 'serie' && ts.isIdentifier(member.initializer) && member.initializer.text === 'serie')) continue;
      if (ts.isIdentifier(member.initializer) && member.initializer.text === 'undefined') continue;
      result[key] = literal(member.initializer, file);
    }
    return result;
  }
  if (ts.isIdentifier(node) && node.text === 'undefined') return null;
  throw new Error(`Unsupported data expression in ${file}: ${node.getText().slice(0, 160)}`);
}

function objectFromFile(file, expectedName) {
  const text = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  if (sf.parseDiagnostics.length) {
    throw new Error(`TypeScript parse error in ${file}: ${sf.parseDiagnostics[0].messageText}`);
  }
  let fallback;
  for (const statement of sf.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!declaration.initializer || !ts.isObjectLiteralExpression(declaration.initializer)) continue;
      if (!fallback) fallback = declaration.initializer;
      if (ts.isIdentifier(declaration.name) && declaration.name.text === expectedName) return literal(declaration.initializer, file);
    }
  }
  if (fallback) return literal(fallback, file);
  throw new Error(`Could not find ${expectedName} object in ${file}`);
}

const roots = ['data', 'data-asia']
  .map((name) => ({ name, absolute: path.join(sourceRoot, name) }))
  .filter((root) => fs.existsSync(root.absolute));
const files = roots.flatMap((root) => sourceFiles(root.absolute).map((absolute) => {
  const nativeRelative = path.relative(root.absolute, absolute);
  const relative = nativeRelative.split(path.sep).join('/');
  const depth = nativeRelative.split(path.sep).length;
  const kind = depth === 1 ? 'serie' : depth === 2 ? 'set' : depth === 3 ? 'card' : null;
  return { scope: root.name, absolute, relative, kind, sourcePath: `${root.name}/${relative}` };
}));

const unsupported = files.filter((file) => !file.kind);
if (unsupported.length) throw new Error(`Unexpected source layout at ${unsupported[0].sourcePath}`);

for (const file of files.filter((item) => item.kind === 'serie')) {
  const raw = objectFromFile(file.absolute, 'serie');
  process.stdout.write(`${JSON.stringify({ kind: 'serie', source_path: file.sourcePath, raw })}\n`);
}

const setsByPath = new Map();
for (const file of files.filter((item) => item.kind === 'set')) {
  const raw = objectFromFile(file.absolute, 'set');
  const seriesPath = `${file.scope}/${path.posix.basename(path.posix.dirname(file.relative))}.ts`;
  setsByPath.set(file.sourcePath, raw.id);
  process.stdout.write(`${JSON.stringify({ kind: 'set', source_path: file.sourcePath, series_path: seriesPath, raw })}\n`);
}

for (const file of files.filter((item) => item.kind === 'card')) {
  const raw = objectFromFile(file.absolute, 'card');
  const parent = path.posix.dirname(file.relative);
  const setPath = `${file.scope}/${parent}.ts`;
  const setId = setsByPath.get(setPath);
  if (!setId) throw new Error(`Missing set metadata for ${file.sourcePath} (expected ${setPath})`);
  const localId = path.posix.basename(file.relative, '.ts');
  process.stdout.write(`${JSON.stringify({ kind: 'card', source_path: file.sourcePath, set_path: setPath, set_id: setId, local_id: localId, scope: file.scope, raw })}\n`);
}
