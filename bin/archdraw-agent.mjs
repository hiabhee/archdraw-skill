#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const skillSource = join(root, 'skills', 'archdraw-diagram');
const AGENTS = ['codex', 'claude', 'opencode'];

const agentConfig = {
  codex: { skillDir: join(homedir(), '.codex', 'skills', 'archdraw-diagram'), command: 'codex' },
  claude: { skillDir: join(homedir(), '.claude', 'skills', 'archdraw-diagram'), command: 'claude' },
  opencode: { skillDir: join(homedir(), '.config', 'opencode', 'skills', 'archdraw-diagram'), command: 'opencode' },
};

function run(command, args, { dryRun = false } = {}) {
  if (dryRun) return { status: 0, stdout: '', stderr: '' };
  return spawnSync(command, args, { encoding: 'utf8' });
}

function commandAvailable(command) {
  const result = spawnSync(command, ['--version'], { encoding: 'utf8' });
  return result.status === 0;
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
    console.log(`${agent}: skill already present at ${destination}; left unchanged.`);
    return;
  }
  if (options.dryRun) {
    console.log(`${agent}: would install skill at ${destination}.`);
    return;
  }
  mkdirSync(dirname(destination), { recursive: true });
  cpSync(skillSource, destination, { recursive: true, force: options.force });
  console.log(`${agent}: installed skill at ${destination}.`);
}

function addCodexMcp(options) {
  if (options.dryRun) {
    console.log('codex: would connect the ArchDraw MCP server.');
    return;
  }
  const result = run('codex', ['mcp', 'add', 'archdraw', '--', 'npx', '-y', 'archdraw-mcp-server'], options);
  if (result.status === 0) console.log('codex: ArchDraw MCP connected.');
  else console.log(`codex: MCP connection needs attention. Run: codex mcp add archdraw -- npx -y archdraw-mcp-server\n${result.stderr || result.stdout}`);
}

function addClaudeMcp(options) {
  if (options.dryRun) {
    console.log('claude: would connect the ArchDraw MCP server.');
    return;
  }
  const result = run('claude', ['mcp', 'add', 'archdraw', '--', 'npx', '-y', 'archdraw-mcp-server'], options);
  if (result.status === 0) console.log('claude: ArchDraw MCP connected.');
  else console.log(`claude: MCP connection needs attention. Run: claude mcp add archdraw -- npx -y archdraw-mcp-server\n${result.stderr || result.stdout}`);
}

function addOpenCodeMcp(options) {
  const configPath = join(homedir(), '.config', 'opencode', 'opencode.json');
  if (options.dryRun) {
    console.log(`opencode: would add ArchDraw to ${configPath}.`);
    return;
  }
  let config = { $schema: 'https://opencode.ai/config.json' };
  if (existsSync(configPath)) {
    try {
      config = JSON.parse(readFileSync(configPath, 'utf8'));
    } catch {
      console.log(`opencode: could not safely edit ${configPath}. Add the ArchDraw local MCP entry manually.`);
      return;
    }
  }
  config.mcp ??= {};
  config.mcp.servers ??= {};
  if (config.mcp.servers.archdraw) {
    console.log('opencode: ArchDraw MCP is already configured.');
    return;
  }
  config.mcp.servers.archdraw = { type: 'local', command: ['npx', '-y', 'archdraw-mcp-server'] };
  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
  console.log('opencode: ArchDraw MCP connected.');
}

function setupAgent(agent, options) {
  installSkill(agent, options);
  if (agent === 'codex') addCodexMcp(options);
  else if (agent === 'claude') addClaudeMcp(options);
  else addOpenCodeMcp(options);
}

function printHelp() {
  console.log(`Usage: archdraw-agent setup [--agent codex|claude|opencode|auto] [--dry-run] [--force]

Installs the ArchDraw skill and connects the local ArchDraw MCP server.
With no --agent flag, it configures every supported agent found on PATH.`);
}

export function setup(args, dependencies = { commandAvailable }) {
  const options = parseArgs(args);
  if (options.help) return printHelp();
  const agents = options.agent === 'auto'
    ? AGENTS.filter((agent) => dependencies.commandAvailable(agentConfig[agent].command))
    : [options.agent];
  if (agents.length === 0) throw new Error('No supported coding agent was found. Install Codex, Claude Code, or OpenCode, then run this command again with --agent.');
  for (const agent of agents) setupAgent(agent, options);
  console.log('Ready. Ask your coding agent to map the architecture of the current repository with ArchDraw.');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv[2] !== 'setup') throw new Error('Expected the setup command. Run: archdraw-agent setup --help');
    setup(process.argv.slice(3));
  } catch (error) {
    console.error(`ArchDraw setup failed: ${error.message}`);
    process.exitCode = 1;
  }
}
