// Minimal JSON Schema (2020-12 subset) validator, so the CLI checks data against
// the same schema/*.json files the docs publish, with zero dependencies.
// Supported: $ref (#/$defs/...), type, enum, const, required, properties,
// additionalProperties, propertyNames, items, minItems, minLength, maxLength,
// pattern, minimum, maximum, allOf, anyOf, oneOf, not, if/then/else.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
// Repo checkout: <repo>/schema. Packed npm module: <pkg>/schema (copied by prepack).
const SCHEMA_DIRS = [path.resolve(here, '../../schema'), path.resolve(here, '../schema')];
const cache = new Map();

export function loadSchema(name) {
  if (cache.has(name)) return cache.get(name);
  for (const dir of SCHEMA_DIRS) {
    const file = path.join(dir, `${name}.schema.json`);
    if (fs.existsSync(file)) {
      const schema = JSON.parse(fs.readFileSync(file, 'utf8'));
      cache.set(name, schema);
      return schema;
    }
  }
  throw new Error(`schema not found: ${name}`);
}

function typeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number';
  return typeof v;
}

function typeMatches(v, t) {
  const actual = typeOf(v);
  return actual === t || (t === 'number' && actual === 'integer');
}

function resolveRef(root, ref) {
  if (!ref.startsWith('#/')) throw new Error(`unsupported $ref: ${ref}`);
  return ref.slice(2).split('/').reduce((node, key) => node[key], root);
}

function check(root, schema, v, at, errors) {
  if (schema === true || schema === undefined) return;
  if (schema === false) { errors.push(`${at}: not allowed`); return; }
  if (schema.$ref) check(root, resolveRef(root, schema.$ref), v, at, errors);
  if (schema.type) {
    const types = [].concat(schema.type);
    if (!types.some((t) => typeMatches(v, t))) { errors.push(`${at}: expected ${types.join('|')}`); return; }
  }
  if (schema.enum && !schema.enum.some((e) => e === v)) errors.push(`${at}: must be one of ${schema.enum.join(', ')}`);
  if ('const' in schema && schema.const !== v) errors.push(`${at}: must be ${JSON.stringify(schema.const)}`);
  const t = typeOf(v);
  if (t === 'string') {
    if (schema.minLength !== undefined && v.length < schema.minLength) errors.push(`${at}: too short`);
    if (schema.maxLength !== undefined && v.length > schema.maxLength) errors.push(`${at}: longer than ${schema.maxLength}`);
    if (schema.pattern && !new RegExp(schema.pattern).test(v)) errors.push(`${at}: does not match ${schema.pattern}`);
  }
  if (t === 'integer' || t === 'number') {
    if (schema.minimum !== undefined && v < schema.minimum) errors.push(`${at}: below ${schema.minimum}`);
    if (schema.maximum !== undefined && v > schema.maximum) errors.push(`${at}: above ${schema.maximum}`);
  }
  if (t === 'array') {
    if (schema.minItems !== undefined && v.length < schema.minItems) errors.push(`${at}: needs at least ${schema.minItems}`);
    if (schema.items) v.forEach((x, i) => check(root, schema.items, x, `${at}[${i}]`, errors));
  }
  if (t === 'object') {
    for (const k of schema.required || []) if (!(k in v)) errors.push(`${at}: missing ${k}`);
    const props = schema.properties || {};
    for (const [k, x] of Object.entries(v)) {
      if (schema.propertyNames) check(root, schema.propertyNames, k, `${at}{${k}}`, errors);
      if (k in props) check(root, props[k], x, `${at}.${k}`, errors);
      else if (schema.additionalProperties !== undefined) check(root, schema.additionalProperties, x, `${at}.${k}`, errors);
    }
  }
  for (const s of schema.allOf || []) check(root, s, v, at, errors);
  const passes = (s) => { const e = []; check(root, s, v, at, e); return e.length === 0; };
  if (schema.anyOf && !schema.anyOf.some(passes)) errors.push(`${at}: matches none of anyOf`);
  if (schema.oneOf && schema.oneOf.filter(passes).length !== 1) errors.push(`${at}: must match exactly one of oneOf`);
  if (schema.not && passes(schema.not)) errors.push(`${at}: matches a forbidden shape`);
  if (schema.if) {
    if (passes(schema.if)) { if (schema.then) check(root, schema.then, v, at, errors); }
    else if (schema.else) check(root, schema.else, v, at, errors);
  }
}

// Returns a list of "path: message" strings; empty means valid.
export function validate(name, value) {
  const schema = loadSchema(name);
  const errors = [];
  check(schema, schema, value, '$', errors);
  return errors;
}
