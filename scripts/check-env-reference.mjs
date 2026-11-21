import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ENV_NAME = /\bONNI_[A-Z0-9_]+\b/g;

function namesIn(text) {
  return new Set(text.match(ENV_NAME) ?? []);
}

function referenceTable(markdown) {
  const heading = 'Useful environment variables:';
  const start = markdown.indexOf(heading);
  if (start === -1) throw new Error(`Could not find "${heading}" in the reference.`);

  const afterHeading = markdown.slice(start + heading.length);
  const table = afterHeading.match(/(?:^\|.*\r?\n?)+/m)?.[0];
  if (!table) throw new Error('Could not find the environment-variable table in the reference.');
  return table;
}

export function missingEnvironmentReferenceNames(example, reference) {
  const documented = namesIn(referenceTable(reference));
  return [...namesIn(example)].filter((name) => !documented.has(name)).sort();
}

function pathsFromArgs(args) {
  const scriptDirectory = dirname(fileURLToPath(import.meta.url));
  const defaults = {
    example: resolve(scriptDirectory, '..', '.env.example'),
    reference: resolve(scriptDirectory, '..', 'docs', 'reference.md'),
  };

  for (let index = 0; index < args.length; index += 2) {
    const option = args[index];
    const value = args[index + 1];
    if (!value || !['--env-example', '--reference'].includes(option)) {
      throw new Error('Usage: node scripts/check-env-reference.mjs [--env-example <path> --reference <path>]');
    }
    defaults[option === '--env-example' ? 'example' : 'reference'] = resolve(value);
  }

  return defaults;
}

export function checkEnvironmentReference(example, reference) {
  return missingEnvironmentReferenceNames(
    readFileSync(example, 'utf8'),
    readFileSync(reference, 'utf8'),
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { example, reference } = pathsFromArgs(process.argv.slice(2));
  const missing = checkEnvironmentReference(example, reference);

  if (missing.length === 0) {
    console.log('All ONNI_* names in .env.example appear in the reference environment table.');
  } else {
    console.log('ONNI_* names in .env.example missing from the reference environment table:');
    for (const name of missing) console.log(`- ${name}`);
    process.exitCode = 1;
  }
}
