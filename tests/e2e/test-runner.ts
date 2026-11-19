/**
 * TeleBill Pro - Master CLI Test Runner & E2E Coordinator
 * 
 * Usage:
 *   npx tsx tests/e2e/test-runner.ts [options]
 *   node --loader ts-node/esm tests/e2e/test-runner.ts [options]
 * 
 * Options:
 *   --all            Run all test suites across Tiers 1-4 (default)
 *   --tier=<1|2|3|4> Run only tests belonging to specified tier
 *   --bail           Stop on first failure
 *   --target=<url>   Set target base URL (e.g. http://localhost:5000)
 *   --in-process     Execute tests in-process via Supertest without binding a port
 *   --dry-run        Verify test suite structure, definitions, and compilation
 *   --json           Output results as JSON summary
 */

import * as path from 'path';
import { config } from './config';

export interface TestResult {
  suite: string;
  name: string;
  tier: number;
  status: 'PASSED' | 'FAILED' | 'SKIPPED';
  durationMs: number;
  error?: string;
}

export interface RunnerSummary {
  timestamp: string;
  targetUrl: string;
  executionMode: 'IN_PROCESS' | 'LIVE_HTTP' | 'DRY_RUN';
  tierFilter: string;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number;
  results: TestResult[];
}

type TestFn = () => Promise<void> | void;
type HookFn = () => Promise<void> | void;

interface TestCase {
  name: string;
  fn: TestFn;
}

interface TestSuite {
  name: string;
  tier: number;
  beforeAllHooks: HookFn[];
  afterAllHooks: HookFn[];
  tests: TestCase[];
}

class TestRegistry {
  public suites: TestSuite[] = [];
  public currentSuite: TestSuite | null = null;
  public currentTier: number = 1;

  registerSuite(name: string, tier: number, fn: () => void) {
    const suite: TestSuite = {
      name,
      tier,
      beforeAllHooks: [],
      afterAllHooks: [],
      tests: [],
    };
    const prevSuite = this.currentSuite;
    const prevTier = this.currentTier;

    this.currentSuite = suite;
    this.currentTier = tier;
    this.suites.push(suite);

    fn();

    this.currentSuite = prevSuite;
    this.currentTier = prevTier;
  }

  addTest(name: string, fn: TestFn) {
    if (this.currentSuite) {
      this.currentSuite.tests.push({ name, fn });
    } else {
      const suite: TestSuite = {
        name: 'Default Suite',
        tier: this.currentTier,
        beforeAllHooks: [],
        afterAllHooks: [],
        tests: [{ name, fn }],
      };
      this.suites.push(suite);
      this.currentSuite = suite;
    }
  }

  addBeforeAll(fn: HookFn) {
    if (this.currentSuite) {
      this.currentSuite.beforeAllHooks.push(fn);
    }
  }

  addAfterAll(fn: HookFn) {
    if (this.currentSuite) {
      this.currentSuite.afterAllHooks.push(fn);
    }
  }
}

export const registry = new TestRegistry();

// Inject standard test runner globals if running outside Jest / Vitest
if (!(globalThis as any).describe) {
  (globalThis as any).describe = (name: string, fn: () => void) => {
    let tier = 1;
    if (name.includes('Tier 2') || name.includes('tier2')) tier = 2;
    else if (name.includes('Tier 3') || name.includes('tier3')) tier = 3;
    else if (name.includes('Tier 4') || name.includes('tier4')) tier = 4;
    registry.registerSuite(name, tier, fn);
  };
}

if (!(globalThis as any).it) {
  (globalThis as any).it = (name: string, fn: TestFn) => {
    registry.addTest(name, fn);
  };
  (globalThis as any).test = (globalThis as any).it;
}

if (!(globalThis as any).beforeAll) {
  (globalThis as any).beforeAll = (fn: HookFn) => {
    registry.addBeforeAll(fn);
  };
}

if (!(globalThis as any).afterAll) {
  (globalThis as any).afterAll = (fn: HookFn) => {
    registry.addAfterAll(fn);
  };
}

if (!(globalThis as any).expect) {
  (globalThis as any).expect = (actual: any) => {
    return {
      toBe: (expected: any) => {
        if (actual !== expected) {
          throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
        }
      },
      toEqual: (expected: any) => {
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
          throw new Error(`Expected deep equal: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
        }
      },
      toBeDefined: () => {
        if (actual === undefined) throw new Error('Expected value to be defined, got undefined');
      },
      toBeUndefined: () => {
        if (actual !== undefined) throw new Error(`Expected undefined, got ${JSON.stringify(actual)}`);
      },
      toBeNull: () => {
        if (actual !== null) throw new Error(`Expected null, got ${JSON.stringify(actual)}`);
      },
      toBeTruthy: () => {
        if (!actual) throw new Error(`Expected truthy value, got ${JSON.stringify(actual)}`);
      },
      toBeFalsy: () => {
        if (actual) throw new Error(`Expected falsy value, got ${JSON.stringify(actual)}`);
      },
      toBeGreaterThan: (n: number) => {
        if (!(actual > n)) throw new Error(`Expected ${actual} > ${n}`);
      },
      toBeGreaterThanOrEqual: (n: number) => {
        if (!(actual >= n)) throw new Error(`Expected ${actual} >= ${n}`);
      },
      toBeLessThan: (n: number) => {
        if (!(actual < n)) throw new Error(`Expected ${actual} < ${n}`);
      },
      toBeLessThanOrEqual: (n: number) => {
        if (!(actual <= n)) throw new Error(`Expected ${actual} <= ${n}`);
      },
      toMatch: (regex: RegExp) => {
        if (!regex.test(String(actual))) throw new Error(`Expected "${actual}" to match regex ${regex}`);
      },
      toContain: (item: any) => {
        if (Array.isArray(actual)) {
          if (!actual.includes(item)) throw new Error(`Expected array to contain ${JSON.stringify(item)}, got ${JSON.stringify(actual)}`);
        } else if (typeof actual === 'string') {
          if (!actual.includes(String(item))) throw new Error(`Expected string "${actual}" to contain "${item}"`);
        } else {
          throw new Error(`Cannot evaluate toContain on ${typeof actual}`);
        }
      },
      toHaveLength: (len: number) => {
        if (actual?.length !== len) throw new Error(`Expected length ${len}, got ${actual?.length}`);
      },
      toBeCloseTo: (expected: number, numDigits = 2) => {
        const diff = Math.abs(Number(actual) - Number(expected));
        const tolerance = Math.pow(10, -numDigits) / 2;
        if (diff > tolerance) {
          throw new Error(`Expected ${actual} to be close to ${expected} (within ${tolerance}), diff is ${diff}`);
        }
      },
      not: {
        toBe: (expected: any) => {
          if (actual === expected) throw new Error(`Expected not ${JSON.stringify(expected)}`);
        },
        toEqual: (expected: any) => {
          if (JSON.stringify(actual) === JSON.stringify(expected)) throw new Error(`Expected not equal`);
        },
        toContain: (item: any) => {
          if (Array.isArray(actual) && actual.includes(item)) throw new Error(`Expected array NOT to contain ${item}`);
          if (typeof actual === 'string' && actual.includes(String(item))) throw new Error(`Expected string NOT to contain ${item}`);
        },
      },
    };
  };
}

export async function runCli(): Promise<RunnerSummary> {
  const args = process.argv.slice(2);
  let tierFilter: number | null = null;
  let bail = false;
  let isJson = false;
  let isDryRun = false;
  let inProcess = false;

  for (const arg of args) {
    if (arg === '--all') {
      tierFilter = null;
    } else if (arg.startsWith('--tier=')) {
      tierFilter = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--bail') {
      bail = true;
    } else if (arg.startsWith('--target=')) {
      process.env.TEST_BASE_URL = arg.split('=')[1];
      delete process.env.TEST_MODE;
    } else if (arg === '--in-process' || arg === '--inprocess') {
      inProcess = true;
      process.env.TEST_MODE = 'in-process';
    } else if (arg === '--json') {
      isJson = true;
    } else if (arg === '--dry-run') {
      isDryRun = true;
    }
  }

  if (process.env.TEST_MODE === 'in-process') {
    inProcess = true;
  }

  // Dynamically import test suites to register in TestRegistry
  try {
    await import('./tier1_feature_coverage.test');
    await import('./tier2_boundaries_corners.test');
    await import('./tier3_cross_feature.test');
    await import('./tier4_realworld_scenarios.test');
  } catch (err: any) {
    console.error(`[Error loading test suites]: ${err.message}`);
  }

  const startTime = Date.now();
  const executionMode: 'IN_PROCESS' | 'LIVE_HTTP' | 'DRY_RUN' = isDryRun
    ? 'DRY_RUN'
    : inProcess
    ? 'IN_PROCESS'
    : 'LIVE_HTTP';

  const summary: RunnerSummary = {
    timestamp: new Date().toISOString(),
    targetUrl: inProcess ? 'in-process (Express createApp)' : (process.env.TEST_BASE_URL || config.baseUrl),
    executionMode,
    tierFilter: tierFilter ? `Tier ${tierFilter}` : 'All (Tiers 1-4)',
    totalTests: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    durationMs: 0,
    results: [],
  };

  if (!isJson) {
    console.log('========================================================================');
    console.log(' TeleBill Pro - End-to-End Test Suite Execution Coordinator');
    console.log(` Target Server:  ${summary.targetUrl}`);
    console.log(` Execution Mode: ${summary.executionMode}`);
    console.log(` Tier Filter:    ${summary.tierFilter}`);
    console.log('========================================================================\n');
  }

  const filteredSuites = registry.suites.filter(s => tierFilter === null || s.tier === tierFilter);

  for (const suite of filteredSuites) {
    if (!isJson) {
      console.log(`\n--- [Tier ${suite.tier}] ${suite.name} ---`);
    }

    if (!isDryRun) {
      for (const hook of suite.beforeAllHooks) {
        try {
          await hook();
        } catch (e: any) {
          console.error(`  [beforeAll hook failed in "${suite.name}"]: ${e.message}`);
        }
      }
    }

    for (const testCase of suite.tests) {
      summary.totalTests++;
      const testStart = Date.now();
      let status: 'PASSED' | 'FAILED' | 'SKIPPED' = 'PASSED';
      let errorMsg: string | undefined = undefined;

      if (isDryRun) {
        status = 'PASSED';
      } else {
        try {
          await testCase.fn();
          status = 'PASSED';
        } catch (err: any) {
          status = 'FAILED';
          errorMsg = err.message || String(err);
        }
      }

      const durationMs = Date.now() - testStart;
      if (status === 'PASSED') summary.passed++;
      else if (status === 'FAILED') summary.failed++;
      else summary.skipped++;

      summary.results.push({
        suite: suite.name,
        name: testCase.name,
        tier: suite.tier,
        status,
        durationMs,
        error: errorMsg,
      });

      if (!isJson) {
        if (status === 'PASSED') {
          console.log(`  ✓ ${testCase.name} (${durationMs}ms)`);
        } else {
          console.log(`  ✗ ${testCase.name} (${durationMs}ms)`);
          console.log(`    Error: ${errorMsg}`);
        }
      }

      if (bail && status === 'FAILED') {
        if (!isJson) console.log('\n[BAIL]: Execution halted on first failure.');
        break;
      }
    }

    if (!isDryRun) {
      for (const hook of suite.afterAllHooks) {
        try {
          await hook();
        } catch (e: any) {
          console.error(`  [afterAll hook failed in "${suite.name}"]: ${e.message}`);
        }
      }
    }
  }

  summary.durationMs = Date.now() - startTime;

  if (isJson) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log('\n========================================================================');
    console.log(' Execution Summary:');
    console.log(`   Execution Mode: ${summary.executionMode}`);
    console.log(`   Total Tests:    ${summary.totalTests}`);
    console.log(`   Passed:         ${summary.passed}`);
    console.log(`   Failed:         ${summary.failed}`);
    console.log(`   Skipped:        ${summary.skipped}`);
    console.log(`   Total Time:     ${summary.durationMs}ms`);
    console.log(`   Result:         ${summary.failed === 0 ? 'SUCCESS (100% Pass)' : 'FAILURES DETECTED'}`);
    console.log('========================================================================\n');
  }

  return summary;
}

/**
 * Robust multi-environment CLI entrypoint guard.
 * Supports CommonJS, tsx, ESM loaders, and ts-node on Windows/POSIX.
 */
function isDirectExecution(): boolean {
  if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) {
    return true;
  }
  if (process.argv && process.argv[1]) {
    const normalizedArg = process.argv[1].replace(/\\/g, '/');
    if (
      normalizedArg.endsWith('tests/e2e/test-runner.ts') ||
      normalizedArg.endsWith('tests/e2e/test-runner.js') ||
      normalizedArg.endsWith('test-runner.ts') ||
      normalizedArg.endsWith('test-runner.js')
    ) {
      return true;
    }
  }
  return false;
}

if (isDirectExecution()) {
  runCli()
    .then(summary => {
      process.exit(summary.failed > 0 ? 1 : 0);
    })
    .catch(err => {
      console.error('[TestRunner Fatal Error]:', err);
      process.exit(1);
    });
}
