const NON_LATIN_SCRIPT = /[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]/u;

export function hasNonLatinScript(value) {
  return NON_LATIN_SCRIPT.test(String(value ?? ''));
}
