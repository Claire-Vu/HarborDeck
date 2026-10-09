// Shell-like tokenizer for batch lines, and a tiny flag parser shared by
// argv and batch mode.

export function tokenize(line) {
  const out = [];
  let cur = '';
  let has = false;
  let i = 0;
  while (i < line.length) {
    const c = line[i];
    if (c === "'") {
      const end = line.indexOf("'", i + 1);
      if (end < 0) throw new Error('unclosed single quote');
      cur += line.slice(i + 1, end); has = true; i = end + 1;
    } else if (c === '"') {
      i++;
      for (;;) {
        if (i >= line.length) throw new Error('unclosed double quote');
        const d = line[i];
        if (d === '"') { i++; break; }
        if (d === '\\' && i + 1 < line.length) {
          const n = line[i + 1];
          cur += n === 'n' ? '\n' : n === 't' ? '\t' : n;
          i += 2;
        } else { cur += d; i++; }
      }
      has = true;
    } else if (c === '\\' && i + 1 < line.length) {
      cur += line[i + 1]; has = true; i += 2;
    } else if (/\s/.test(c)) {
      if (has) { out.push(cur); cur = ''; has = false; }
      i++;
    } else { cur += c; has = true; i++; }
  }
  if (has) out.push(cur);
  return out;
}

// spec: { name: { alias?: string, multi?: bool, bool?: bool } }
// Returns { pos: [...], flags: { name: value | [values] | true } }.
export function parseFlags(argv, spec) {
  const pos = [];
  const flags = {};
  const byAlias = {};
  for (const [name, s] of Object.entries(spec)) if (s.alias) byAlias[s.alias] = name;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--') { pos.push(...argv.slice(i + 1)); break; }
    let name = null;
    let val;
    if (a.startsWith('--') && a.length > 2) {
      const eq = a.indexOf('=');
      name = eq > 0 ? a.slice(2, eq) : a.slice(2);
      if (eq > 0) val = a.slice(eq + 1);
    } else if (/^-[a-zA-Z]$/.test(a)) {
      name = byAlias[a[1]];
      if (!name) throw new Error(`unknown flag ${a}`);
    } else { pos.push(a); continue; }
    const s = spec[name];
    if (!s) throw new Error(`unknown flag --${name}`);
    if (s.bool) {
      if (val !== undefined) throw new Error(`--${name} takes no value`);
      flags[name] = true;
      continue;
    }
    if (val === undefined) {
      if (i + 1 >= argv.length) throw new Error(`--${name} needs a value`);
      val = argv[++i];
    }
    if (s.multi) (flags[name] ||= []).push(val);
    else flags[name] = val;
  }
  return { pos, flags };
}

// `hd <command> --help` (or -h, before any `--`) asks for the help instead of running the command.
export function wantsHelp(argv) {
  const end = argv.indexOf('--');
  return (end < 0 ? argv : argv.slice(0, end)).some((a) => a === '--help' || a === '-h');
}
