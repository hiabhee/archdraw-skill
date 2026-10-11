import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  API_BASE_URL,
  MCP_PACKAGE,
  REMOTE_MCP_URL,
  applyOpenCodeConfig,
  isMainModule,
  mcpAddCommand,
  mcpRemoveCommands,
  parseMajorVersion,
  setup,
} from '../bin/archdraw-agent.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const binPath = join(root, 'bin', 'archdraw-agent.mjs');
const packageVersion = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;

function captureLogs(fn) {
  const seen = [];
  const originalLog = console.log;
  console.log = (message) => seen.push(String(message));
  try {
    fn();
  } finally {
    console.log = originalLog;
  }
  return seen;
}

test('setup selects installed agents in auto mode', () => {
  const seen = captureLogs(() => setup(['--dry-run'], { commandAvailable: (command) => command === 'codex' }));
  assert.ok(seen.some((message) => message.includes('codex: would install skill')));
  assert.ok(seen.some((message) => message.includes('codex: would run: codex mcp add')));
  assert.ok(!seen.some((message) => message.includes('claude:')));
});

test('setup rejects unsupported agents', () => {
  assert.throws(() => setup(['--agent', 'cursor']), /Unsupported agent/);
});

test('codex runs the pinned local server with API_BASE_URL', () => {
  const [command, args] = mcpAddCommand('codex');
  assert.equal(command, 'codex');
  assert.deepEqual(args, ['mcp', 'add', 'archdraw', '--env', `API_BASE_URL=${API_BASE_URL}`, '--', 'npx', '-y', MCP_PACKAGE]);
  assert.match(MCP_PACKAGE, /^@hiabhee\/archdraw-mcp-server@\d+\.\d+\.\d+$/);
});

test('claude connects to the hosted endpoint in user scope', () => {
  const [command, args] = mcpAddCommand('claude');
  assert.equal(command, 'claude');
  assert.deepEqual(args, ['mcp', 'add', '--scope', 'user', '--transport', 'http', 'archdraw', REMOTE_MCP_URL]);
  assert.equal(REMOTE_MCP_URL, 'https://archdraw.hiabhee.online/api/mcp');
});

test('--force removes old claude entries from both scopes', () => {
  const scopes = mcpRemoveCommands('claude').map(([, args]) => args[args.indexOf('--scope') + 1]);
  assert.deepEqual(scopes, ['local', 'user']);
});

test('opencode v1 puts the server directly under mcp', () => {
  const next = applyOpenCodeConfig({ mcp: { other: { type: 'local', command: ['x'] } } }, 1);
  assert.deepEqual(next.mcp.archdraw, { type: 'remote', url: REMOTE_MCP_URL, enabled: true });
  assert.ok(next.mcp.other, 'keeps unrelated servers');
  assert.equal(next.mcp.servers, undefined);
});

test('opencode v1 repairs the v2-shaped entry written by 0.1.x', () => {
  const broken = { mcp: { servers: { archdraw: { type: 'local', command: ['npx', '-y', '@hiabhee/archdraw-mcp-server'] } } } };
  const next = applyOpenCodeConfig(broken, 1);
  assert.equal(next.mcp.servers, undefined);
  assert.equal(next.mcp.archdraw.url, REMOTE_MCP_URL);
});

test('opencode v2 nests the server under mcp.servers', () => {
  const next = applyOpenCodeConfig({ mcp: { servers: { other: { type: 'remote', url: 'https://x' } } } }, 2);
  assert.deepEqual(next.mcp.servers.archdraw, { type: 'remote', url: REMOTE_MCP_URL });
  assert.ok(next.mcp.servers.other, 'keeps unrelated servers');
});

test('opencode leaves an existing entry unless --force', () => {
  const existing = { mcp: { archdraw: { type: 'remote', url: 'https://self-hosted.example/api/mcp', enabled: true } } };
  assert.equal(applyOpenCodeConfig(existing, 1), undefined);
  assert.equal(applyOpenCodeConfig(existing, 1, { force: true }).mcp.archdraw.url, REMOTE_MCP_URL);
});

test('parses the OpenCode major version', () => {
  assert.equal(parseMajorVersion('2.0.3\n'), 2);
  assert.equal(parseMajorVersion('opencode 1.14.2'), 1);
  assert.equal(parseMajorVersion(''), undefined);
});

test('runs when npx invokes the bin through a symlink', () => {
  const link = join(mkdtempSync(join(tmpdir(), 'archdraw-agent-')), 'archdraw-agent');
  symlinkSync(binPath, link);
  assert.equal(isMainModule(link), true);
  assert.equal(isMainModule(join(root, 'package.json')), false);
  assert.equal(isMainModule(undefined), false);
});

test('SKILL.md and README use the same pins as the installer', () => {
  for (const file of ['skills/archdraw-diagram/SKILL.md', 'README.md']) {
    const text = readFileSync(join(root, file), 'utf8');
    const mcpPins = new Set(text.match(/@hiabhee\/archdraw-mcp-server@[\d.]+/g));
    assert.deepEqual([...mcpPins], [MCP_PACKAGE], `${file} MCP pin`);
    const agentPins = new Set(text.match(/archdraw-agent@[\d.]+/g) ?? []);
    for (const pin of agentPins) assert.equal(pin, `archdraw-agent@${packageVersion}`, `${file} installer pin`);
    assert.ok(!/npx -y @hiabhee\/archdraw-mcp-server(?!@)/.test(text), `${file} has an unpinned npx command`);
    assert.ok(!/"@hiabhee\/archdraw-mcp-server"/.test(text), `${file} has an unpinned args entry`);
  }
});

test('every local-server command in SKILL.md sets API_BASE_URL', () => {
  const text = readFileSync(join(root, 'skills/archdraw-diagram/SKILL.md'), 'utf8');
  for (const line of text.split('\n').filter((l) => l.includes('npx -y @hiabhee/archdraw-mcp-server'))) {
    assert.match(line, /API_BASE_URL/, line);
  }
});
