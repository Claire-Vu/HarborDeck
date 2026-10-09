// Tiny stdio MCP server (newline-delimited JSON-RPC 2.0) exposing the CLI verbs
// for agents that prefer tools over a shell. Each tool call runs the same code
// path as the CLI and returns its terse output.
import readline from 'node:readline';
import { run, VERSION } from './main.js';

const TOOLS = [
  {
    name: 'harbordeck_batch',
    description: 'Write HarborDeck items. One command per line, same syntax as the hd CLI without "hd": '
      + 'decision|answer|review|todo <id> "<title>" [-s "<one line>"] [-b <path>] [--opt key+] [--why key="<line>"] [--opt-art key=<path|url>] [-a type:<path|url>] [-p 1-4] [-d +2d] [-t <topic>] [--rel <id>,<id>] [-w <blocked worker>,<id>]; '
      + 'reply <id> "<text>"; resolve <id>; waiting <id> [<worker>...]; note <id|topic:slug> "<text>" [-a <path|url>]; gap "<what did not fit>". Nothing is written if any line is invalid.',
    inputSchema: {
      type: 'object',
      properties: { lines: { type: 'string', description: 'Commands, one per line.' } },
      required: ['lines'],
    },
  },
  {
    name: 'harbordeck_answers',
    description: "Read the user's new answers (JSONL) since this cursor's last read, and advance the cursor.",
    inputSchema: {
      type: 'object',
      properties: {
        cursor: { type: 'string', description: 'Cursor name (default "mcp").' },
        peek: { type: 'boolean', description: 'Do not advance the cursor.' },
      },
    },
  },
  {
    name: 'harbordeck_gap',
    description: 'Log a response that did not fit any HarborDeck item kind, so HarborDeck can be improved.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: "What didn't fit and why." },
        sample: { type: 'string', description: 'Path or URL of an example.' },
        item: { type: 'string', description: 'Item id it was squeezed into, if any.' },
      },
      required: ['text'],
    },
  },
  {
    name: 'harbordeck_topic',
    description: 'Without slug: list topics (open/items, notes, last activity, related). With slug: that topic\'s timeline of items, stamps, replies and notes, oldest first.',
    inputSchema: {
      type: 'object',
      properties: { slug: { type: 'string', description: 'Topic slug.' } },
    },
  },
];

async function callTool(name, args, ctx) {
  const lines = [];
  const io = { out: (s) => lines.push(s), err: (s) => lines.push(s), cwd: ctx.cwd, env: ctx.env, readStdin: () => null };
  let code;
  if (name === 'harbordeck_batch') {
    code = await run(['batch'], { ...io, readStdin: () => String(args.lines ?? '') });
  } else if (name === 'harbordeck_answers') {
    const argv = ['answers', '--cursor', String(args.cursor || 'mcp')];
    if (args.peek) argv.push('--peek');
    code = await run(argv, io);
  } else if (name === 'harbordeck_gap') {
    const argv = ['gap', String(args.text ?? '')];
    if (args.sample) argv.push('--sample', String(args.sample));
    if (args.item) argv.push('--item', String(args.item));
    code = await run(argv, io);
  } else if (name === 'harbordeck_topic') {
    code = await run(args.slug ? ['topic', String(args.slug)] : ['topics'], io);
  } else {
    return { content: [{ type: 'text', text: `unknown tool ${name}` }], isError: true };
  }
  return { content: [{ type: 'text', text: lines.join('\n') || '(none)' }], isError: code !== 0 };
}

export function serveMcp(ctx, input = process.stdin, output = process.stdout) {
  const send = (msg) => output.write(`${JSON.stringify(msg)}\n`);
  const rl = readline.createInterface({ input });
  rl.on('line', async (line) => {
    if (!line.trim()) return;
    let msg;
    try { msg = JSON.parse(line); } catch { send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } }); return; }
    const { id, method, params } = msg;
    if (id === undefined) return; // notification
    try {
      let result;
      if (method === 'initialize') {
        result = {
          protocolVersion: params?.protocolVersion || '2025-06-18',
          capabilities: { tools: {} },
          serverInfo: { name: 'harbordeck', version: VERSION },
        };
      } else if (method === 'ping') result = {};
      else if (method === 'tools/list') result = { tools: TOOLS };
      else if (method === 'tools/call') result = await callTool(params?.name, params?.arguments || {}, ctx);
      else { send({ jsonrpc: '2.0', id, error: { code: -32601, message: `method not found: ${method}` } }); return; }
      send({ jsonrpc: '2.0', id, result });
    } catch (e) {
      send({ jsonrpc: '2.0', id, error: { code: -32603, message: e.message } });
    }
  });
  return new Promise((resolve) => rl.on('close', resolve));
}
