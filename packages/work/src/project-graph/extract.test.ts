import { describe, expect, it } from 'vitest';
import { blankNonCode, extractImports } from './extract.ts';

const specs = (src: string) => extractImports(src).imports.map((i) => `${i.kind}:${i.specifier}`).sort();

describe('extractImports', () => {
  it('reads plain, default, namespace and side-effect imports', () => {
    expect(specs(`import a from './a.ts';\nimport * as b from "./b.ts";\nimport './c.css';\nimport d, { e } from './d.ts';`)).toEqual([
      'import:./a.ts',
      'import:./b.ts',
      'import:./c.css',
      'import:./d.ts',
    ]);
  });

  it('catches MULTI-LINE imports and reports the line of the statement', () => {
    const src = `import {\n  a,\n  b as c,\n  type D,\n} from './multi.ts';\n\nexport {\n  x,\n  y,\n} from './re.ts';\n`;
    const r = extractImports(src).imports;
    expect(r).toContainEqual({ specifier: './multi.ts', kind: 'import', line: 1 });
    expect(r).toContainEqual({ specifier: './re.ts', kind: 'reexport', line: 7 });
  });

  it('classifies import type vs inline type specifiers', () => {
    expect(specs(`import type { A } from './t.ts';\nimport { type B } from './v.ts';`)).toEqual(['import:./v.ts', 'type:./t.ts']);
  });

  it('classifies export … from, export *, export type', () => {
    expect(specs(`export * from './a.ts';\nexport * as ns from './b.ts';\nexport { x } from './c.ts';\nexport type { T } from './d.ts';`)).toEqual([
      'reexport:./a.ts',
      'reexport:./b.ts',
      'reexport:./c.ts',
      'reexport:./d.ts',
    ]);
  });

  it('does not let a semicolon-less file merge two statements', () => {
    const src = `export const a = 1\nimport { b } from './b.ts'\nexport const c = 2\nexport { d } from './d.ts'\n`;
    expect(specs(src)).toEqual(['import:./b.ts', 'reexport:./d.ts']);
  });

  it('reads constant dynamic import, require and vi.mock; counts non-constant dynamic as unresolved', () => {
    const src = `const m = await import('./lazy.ts');\nconst r = require("./cjs.cjs");\nvi.mock('./mocked.ts', () => ({}));\nawait import(name);\nawait import(\`./x/\${n}.ts\`);`;
    const r = extractImports(src);
    expect(r.imports.map((i) => `${i.kind}:${i.specifier}`).sort()).toEqual(['dynamic:./lazy.ts', 'mock:./mocked.ts', 'require:./cjs.cjs']);
    expect(r.unresolvedDynamic).toBe(2);
  });

  it('ignores imports inside comments and template literals', () => {
    const src = `// import a from './no1.ts';\n/* import b from './no2.ts'; */\nconst t = \`import c from './no3.ts'\`;\nimport ok from './yes.ts';`;
    expect(specs(src)).toEqual(['import:./yes.ts']);
  });

  it('keeps line numbers when blanking', () => {
    const src = `/* a\nb\nc */\nimport z from './z.ts';`;
    expect(blankNonCode(src).split('\n').length).toBe(4);
    expect(extractImports(src).imports[0]?.line).toBe(4);
  });
});
