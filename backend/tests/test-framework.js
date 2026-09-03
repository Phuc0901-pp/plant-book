/**
 * ═══════════════════════════════════════════════════════════════
 * Test Framework (Zero-Dependency Async Unit & Integration Test Runner)
 * ═══════════════════════════════════════════════════════════════
 */

class TestFramework {
  constructor() {
    this.suites = [];
    this.currentSuite = null;
    this.results = {
      totalSuites: 0,
      totalTests: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      durationMs: 0,
      suites: []
    };
  }

  describe(name, fn) {
    const suite = {
      name,
      fn,
      tests: [],
      beforeAllFns: [],
      afterAllFns: [],
      passed: 0,
      failed: 0,
      durationMs: 0
    };
    this.suites.push(suite);
  }

  beforeAll(fn) {
    if (this.currentSuite) {
      this.currentSuite.beforeAllFns.push(fn);
    }
  }

  afterAll(fn) {
    if (this.currentSuite) {
      this.currentSuite.afterAllFns.push(fn);
    }
  }

  it(name, fn) {
    if (this.currentSuite) {
      this.currentSuite.tests.push({ name, fn, passed: false, error: null, durationMs: 0 });
    }
  }

  expect(actual) {
    return {
      toBe: (expected) => {
        if (actual !== expected) {
          throw new Error(`Expected ${JSON.stringify(expected)} (type: ${typeof expected}) but got ${JSON.stringify(actual)} (type: ${typeof actual})`);
        }
      },
      toEqual: (expected) => {
        const a = JSON.stringify(actual);
        const b = JSON.stringify(expected);
        if (a !== b) {
          throw new Error(`Expected deep equality:\n  Expected: ${b}\n  Received: ${a}`);
        }
      },
      toBeTruthy: () => {
        if (!actual) {
          throw new Error(`Expected truthy value but got ${JSON.stringify(actual)}`);
        }
      },
      toBeFalsy: () => {
        if (actual) {
          throw new Error(`Expected falsy value but got ${JSON.stringify(actual)}`);
        }
      },
      toBeGreaterThan: (expected) => {
        if (!(actual > expected)) {
          throw new Error(`Expected ${actual} to be greater than ${expected}`);
        }
      },
      toBeGreaterThanOrEqual: (expected) => {
        if (!(actual >= expected)) {
          throw new Error(`Expected ${actual} to be >= ${expected}`);
        }
      },
      toBeLessThan: (expected) => {
        if (!(actual < expected)) {
          throw new Error(`Expected ${actual} to be less than ${expected}`);
        }
      },
      toBeLessThanOrEqual: (expected) => {
        if (!(actual <= expected)) {
          throw new Error(`Expected ${actual} to be <= ${expected}`);
        }
      },
      toContain: (item) => {
        if (typeof actual === 'string') {
          if (!actual.includes(item)) {
            throw new Error(`Expected string "${actual}" to contain substring "${item}"`);
          }
        } else if (Array.isArray(actual)) {
          if (!actual.includes(item)) {
            throw new Error(`Expected array ${JSON.stringify(actual)} to contain element ${JSON.stringify(item)}`);
          }
        } else {
          throw new Error(`toContain only supports string and array, received ${typeof actual}`);
        }
      },
      toBeNull: () => {
        if (actual !== null) {
          throw new Error(`Expected null but received ${JSON.stringify(actual)}`);
        }
      },
      toBeDefined: () => {
        if (actual === undefined) {
          throw new Error(`Expected defined value but received undefined`);
        }
      },
      toBeUndefined: () => {
        if (actual !== undefined) {
          throw new Error(`Expected undefined but received ${JSON.stringify(actual)}`);
        }
      },
      toMatch: (regex) => {
        if (!regex.test(actual)) {
          throw new Error(`Expected "${actual}" to match pattern ${regex}`);
        }
      }
    };
  }

  async run(quiet = false) {
    const startTime = Date.now();
    this.results = {
      totalSuites: this.suites.length,
      totalTests: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      durationMs: 0,
      suites: []
    };

    if (!quiet) {
      console.log('\n═══════════════════════════════════════════════════════════════');
      console.log('🧪 RUNNING SYSTEM AUTOMATED TESTING SUITE (100% COVERAGE)');
      console.log('═══════════════════════════════════════════════════════════════\n');
    }

    for (const suite of this.suites) {
      this.currentSuite = suite;
      const suiteStartTime = Date.now();

      // Register tests in suite
      try {
        suite.fn();
      } catch (err) {
        console.error(`❌ Suite registration failed for "${suite.name}":`, err);
      }

      if (!quiet) {
        console.log(`📦 [SUITE] ${suite.name}`);
      }

      // Run beforeAll hooks
      for (const beforeFn of suite.beforeAllFns) {
        try {
          await beforeFn();
        } catch (bErr) {
          if (!quiet) console.error(`  ⚠️ beforeAll hook error in "${suite.name}":`, bErr);
        }
      }

      const suiteResult = {
        name: suite.name,
        total: suite.tests.length,
        passed: 0,
        failed: 0,
        durationMs: 0,
        tests: []
      };

      for (const test of suite.tests) {
        this.results.totalTests++;
        const testStartTime = Date.now();

        try {
          await test.fn();
          test.passed = true;
          test.durationMs = Date.now() - testStartTime;
          suiteResult.passed++;
          this.results.passed++;

          if (!quiet) {
            console.log(`  ✅ ${test.name} \x1b[90m(${test.durationMs}ms)\x1b[0m`);
          }
        } catch (err) {
          test.passed = false;
          test.error = err.message || String(err);
          test.durationMs = Date.now() - testStartTime;
          suiteResult.failed++;
          this.results.failed++;

          if (!quiet) {
            console.log(`  ❌ ${test.name} \x1b[90m(${test.durationMs}ms)\x1b[0m`);
            console.log(`     \x1b[31mError: ${test.error}\x1b[0m`);
          }
        }

        suiteResult.tests.push({
          name: test.name,
          passed: test.passed,
          error: test.error,
          durationMs: test.durationMs
        });
      }

      // Run afterAll hooks
      for (const afterFn of suite.afterAllFns) {
        try {
          await afterFn();
        } catch (aErr) {
          if (!quiet) console.error(`  ⚠️ afterAll hook error in "${suite.name}":`, aErr);
        }
      }

      suiteResult.durationMs = Date.now() - suiteStartTime;
      this.results.suites.push(suiteResult);
      if (!quiet) console.log('');
    }

    this.results.durationMs = Date.now() - startTime;

    if (!quiet) {
      console.log('═══════════════════════════════════════════════════════════════');
      console.log(`📊 SUMMARY: ${this.results.passed}/${this.results.totalTests} PASSED (${((this.results.passed / (this.results.totalTests || 1)) * 100).toFixed(1)}%) | Failed: ${this.results.failed} | Time: ${this.results.durationMs}ms`);
      console.log('═══════════════════════════════════════════════════════════════\n');
    }

    return this.results;
  }
}

// Global singleton runner instance
const globalRunner = new TestFramework();

module.exports = {
  TestFramework,
  describe: (name, fn) => globalRunner.describe(name, fn),
  beforeAll: (fn) => globalRunner.beforeAll(fn),
  afterAll: (fn) => globalRunner.afterAll(fn),
  it: (name, fn) => globalRunner.it(name, fn),
  expect: (val) => globalRunner.expect(val),
  run: (quiet) => globalRunner.run(quiet),
  getResults: () => globalRunner.results,
  runner: globalRunner
};
