#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Keep these in sync with SKILL.md and README.md (test/archdraw-agent.test.mjs checks it)
// and with the pin in hiabhee/ArchDraw plugins/archdraw/mcp.json.
export const MCP_PACKAGE = '@hiabhee/archdraw-mcp-server@1.0.5';
export const API_BASE_URL = 'https://archdraw.hiabhee.online';
export const REMOTE_MCP_URL = `${API_BASE_URL}/api/mcp`;

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const skillSource = join(root, 'skills', 'archdraw-diagram');
const AGENTS = ['codex', 'claude', 'opencode'];
const isWindows = process.platform === 'win32';

const agentConfig = {
  codex: { skillDir: join(homedir(), '.codex', 'skills', 'archdraw-diagram'), command: 'codex' },
  claude: { skillDir: join(homedir(), '.claude', 'skills', 'archdraw-diagram'), command: 'claude' },
  opencode: { skillDir: join(homedir(), '.config', 'opencode', 'skills', 'archdraw-diagram'), command: 'opencode' },
};

/**
 * MCP registration commands. Claude Code connects to the hosted endpoint (no Node needed);
 * Codex runs the pinned stdio server, which must get API_BASE_URL or generation fails.
 */
export function mcpAddCommand(agent) {
  if (agent === 'claude') return ['claude', ['mcp', 'add', '--scope', 'user', '--transport', 'http', 'archdraw', REMOTE_MCP_URL]];
  if (agent === 'codex') return ['codex', ['mcp', 'add', 'archdraw', '--env', `API_BASE_URL=${API_BASE_URL}`, '--', 'npx', '-y', MCP_PACKAGE]];
  throw new Error(`No MCP command for ${agent}`);
}

/** Installer 0.1.x registered Claude in the default (local) scope, so --force clears both. */
export function mcpRemoveCommands(agent) {
  if (agent === 'claude') {
    return [
      ['claude', ['mcp', 'remove', '--scope', 'local', 'archdraw']],
      ['claude', ['mcp', 'remove', '--scope', 'user', 'archdraw']],
    ];
  }
  return [['codex', ['mcp', 'remove', 'archdraw']]];
}

export function formatCommand([command, args]) {
  return [command, ...args].join(' ');
}

/** OpenCode v1 keys servers directly under `mcp`; v2 nests them under `mcp.servers`. */
export function openCodeEntry(major) {
  return major >= 2 ? { type: 'remote', url: REMOTE_MCP_URL } : { type: 'remote', url: REMOTE_MCP_URL, enabled: true };
}

export function parseMajorVersion(text) {
  const match = /(\d+)\.\d+/.exec(text ?? '');
  return match ? Number(match[1]) : undefined;
}

/**
 * Returns the updated OpenCode config, or `undefined` when ArchDraw is already present and
 * `force` is off. Also removes the v2-shaped `mcp.servers.archdraw` entry that installer
 * 0.1.x wrote into v1 configs, where OpenCode reads `servers` as a server name.
 */
export function applyOpenCodeConfig(config, major, { force = false } = {}) {
  const next = structuredClone(config);
  next.$schema ??= 'https://opencode.ai/config.json';
  next.mcp ??= {};

  if (major >= 2) {
    next.mcp.servers ??= {};
    if (next.mcp.servers.archdraw && !force) return undefined;
    next.mcp.servers.archdraw = openCodeEntry(major);
    return next;
  }

  const legacy = next.mcp.servers;
  const legacyOnlyArchDraw = legacy && typeof legacy === 'object' && Object.keys(legacy).length === 1 && legacy.archdraw;
  if (legacyOnlyArchDraw) delete next.mcp.servers;
  else if (next.mcp.archdraw && !force) return undefined;
  next.mcp.archdraw = openCodeEntry(major);
  return next;
}

function run(command, args) {
  return spawnSync(command, args, { encoding: 'utf8', shell: isWindows });
}

function commandAvailable(command) {
  return run(command, ['--version']).status === 0;
}

function detectOpenCodeMajor() {
  return parseMajorVersion(run('opencode', ['--version']).stdout) ?? 1;
}

function parseArgs(args) {
  const result = { agent: 'auto', dryRun: false, force: false };
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === '--agent') result.agent = args[++index];
    else if (value === '--dry-run') result.dryRun = true;
    else if (value === '--force') result.force = true;
    else if (value === '--help' || value === '-h') result.help = true;
    else throw new Error(`Unknown option: ${value}`);
  }
  if (result.agent !== 'auto' && !AGENTS.includes(result.agent)) {
    throw new Error(`Unsupported agent: ${result.agent}. Choose codex, claude, opencode, or auto.`);
  }
  return result;
}

function installSkill(agent, options) {
  const destination = agentConfig[agent].skillDir;
  if (existsSync(destination) && !options.force) {
    console.log(`${agent}: skill already present at ${destination}; left unchanged (use --force to replace it).`);
    return;
  }
  if (options.dryRun) {
    console.log(`${agent}: would install skill at ${destination}.`);
    return;
  }
  if (existsSync(destination)) rmSync(destination, { recursive: true, force: true });
  mkdirSync(dirname(destination), { recursive: true });
  cpSync(skillSource, destination, { recursive: true });
  console.log(`${agent}: installed skill at ${destination}.`);
}

function addCliMcp(agent, options) {
  const add = mcpAddCommand(agent);
  if (options.dryRun) {
    if (options.force) for (const remove of mcpRemoveCommands(agent)) console.log(`${agent}: would run: ${formatCommand(remove)}`);
    console.log(`${agent}: would run: ${formatCommand(add)}`);
    return true;
  }
  if (options.force) for (const remove of mcpRemoveCommands(agent)) run(...remove);
  const result = run(...add);
  if (result.status === 0) {
    console.log(`${agent}: ArchDraw MCP connected.`);
    return true;
  }
  const output = `${result.stderr ?? ''}${result.stdout ?? ''}`.trim();
  if (/already exists/i.test(output)) {
    console.log(`${agent}: an "archdraw" MCP server already exists; left unchanged. Run again with --force to replace it.`);
    return true;
  }
  console.log(`${agent}: MCP connection failed. Run this command yourself:\n  ${formatCommand(add)}${output ? `\n${output}` : ''}`);
  return false;
}

function addOpenCodeMcp(options) {
  const configPath = join(homedir(), '.config', 'opencode', 'opencode.json');
  const major = detectOpenCodeMajor();
  let config = {};
  if (existsSync(configPath)) {
    try {
      config = JSON.parse(readFileSync(configPath, 'utf8'));
    } catch {
      console.log(`opencode: could not parse ${configPath}; left unchanged. Add this entry under ${major >= 2 ? 'mcp.servers' : 'mcp'} yourself:\n  "archdraw": ${JSON.stringify(openCodeEntry(major))}`);
      return false;
    }
  }
  const next = applyOpenCodeConfig(config, major, options);
  if (!next) {
    console.log('opencode: ArchDraw MCP is already configured; left unchanged (use --force to replace it).');
    return true;
  }
  if (options.dryRun) {
    console.log(`opencode: would add ArchDraw (OpenCode v${major} format) to ${configPath}.`);
    return true;
  }
  mkdirSync(dirname(configPath), { recursive: true });
  const hadConfig = existsSync(configPath);
  if (hadConfig) copyFileSync(configPath, `${configPath}.bak`);
  writeFileSync(configPath, `${JSON.stringify(next, null, 2)}\n`);
  console.log(`opencode: ArchDraw MCP connected (OpenCode v${major} format).${hadConfig ? ` Backup: ${configPath}.bak` : ''}`);
  return true;
}

function setupAgent(agent, options) {
  installSkill(agent, options);
  return agent === 'opencode' ? addOpenCodeMcp(options) : addCliMcp(agent, options);
}

function printHelp() {
  console.log(`Usage: archdraw-agent setup [--agent codex|claude|opencode|auto] [--dry-run] [--force]

Installs the ArchDraw skill and connects the ArchDraw MCP server.
With no --agent flag, it configures every supported agent found on PATH.

  --dry-run  Show what would change. Change nothing.
  --force    Replace an existing ArchDraw skill and MCP entry. Use it to repair
             an install made with archdraw-agent 0.1.3 or earlier.`);
}

export function setup(args, dependencies = { commandAvailable }) {
  const options = parseArgs(args);
  if (options.help) return printHelp();
  const agents = options.agent === 'auto'
    ? AGENTS.filter((agent) => dependencies.commandAvailable(agentConfig[agent].command))
    : [options.agent];
  if (agents.length === 0) throw new Error('No supported coding agent was found. Install Codex, Claude Code, or OpenCode, then run this command again with --agent.');
  const results = agents.map((agent) => setupAgent(agent, options));
  if (results.some((ok) => !ok)) {
    process.exitCode = 1;
    console.log('Setup is not complete. Do the steps above, then restart your coding agent.');
    return;
  }
  console.log(options.dryRun
    ? 'Dry run complete. Nothing was changed.'
    : 'Ready. Restart your coding agent, then ask it to map the architecture of the current repository with ArchDraw.');
}

/** npx runs this file through a `.bin` symlink, so compare real paths. */
export function isMainModule(argvPath, moduleUrl = import.meta.url) {
  if (!argvPath) return false;
  try {
    return realpathSync(argvPath) === realpathSync(fileURLToPath(moduleUrl));
  } catch {
    return false;
  }
}

if (isMainModule(process.argv[1])) {
  try {
    if (process.argv[2] !== 'setup') throw new Error('Expected the setup command. Run: archdraw-agent setup --help');
    setup(process.argv.slice(3));
  } catch (error) {
    console.error(`ArchDraw setup failed: ${error.message}`);
    process.exitCode = 1;
  }
}
