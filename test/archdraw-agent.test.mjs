import assert from 'node:assert/strict';
import test from 'node:test';
import { setup } from '../bin/archdraw-agent.mjs';

test('setup selects installed agents in auto mode', () => {
  const seen = [];
  const originalLog = console.log;
  console.log = (message) => seen.push(message);
  try {
    setup(['--dry-run'], { commandAvailable: (command) => command === 'codex' });
  } finally {
    console.log = originalLog;
  }
  assert.ok(seen.some((message) => message.includes('codex: would install skill')));
  assert.ok(seen.some((message) => message.includes('codex: would connect')));
  assert.ok(!seen.some((message) => message.includes('claude: would install skill')));
});

test('setup rejects unsupported agents', () => {
  assert.throws(() => setup(['--agent', 'cursor']), /Unsupported agent/);
});
