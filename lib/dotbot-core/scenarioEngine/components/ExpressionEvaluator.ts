/**
 * ExpressionEvaluator
 * 
 * Evaluates comparison operators and logical expressions in scenario expectations.
 * 
 * Features:
 * - Comparison operators: eq, ne, gt, gte, lt, lte, between, matches, in, notIn
 * - Type coercion for flexible comparisons
 * - Performance-optimized evaluation
 * 
 * @example
 * ```typescript
 * const evaluator = new ExpressionEvaluator();
 * 
 * // Comparison operators
 * evaluator.evaluateComparison('5.5', { gte: '5', lte: '10' }); // true
 * evaluator.evaluateComparison('Alice', { matches: /^[A-Z]/ }); // true
 * ```
 */

import type {
  ScenarioExpectation,
  ComparisonOperator,
  ParamValue,
  isComparisonOperator,
  isLogicalExpectation,
} from '../types';

export interface EvaluationContext {
  /** Actual value being evaluated */
  actualValue?: unknown;
  
  /** Full context object (for conditional expressions) */
  context?: Record<string, unknown>;
  
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

export interface ComparisonResult {
  /** Whether the comparison passed */
  passed: boolean;
  
  /** Human-readable message */
  message: string;
  
  /** Actual value that was compared */
  actualValue?: unknown;
  
  /** Expected value or operator */
  expectedValue?: unknown;
}

export interface LogicalEvaluationResult {
  /** Whether the logical expression passed */
  passed: boolean;
  
  /** Human-readable message explaining the result */
  message: string;
  
  /** Individual sub-results (for all/any operators) */
  subResults?: LogicalEvaluationResult[];
  
  /** Operator used (all, any, not, when) */
  operator?: string;
}

/**
 * Expression Evaluator for comparison operators
 */
export class ExpressionEvaluator {
  /**
   * Evaluate a comparison operator against an actual value
   */
  evaluateComparison(actual: unknown, expected: ParamValue): ComparisonResult {
    // Handle simple values (exact match - backward compatible)
    if (this.isSimpleValue(expected)) {
      return this.evaluateSimpleMatch(actual, expected);
    }
    
    // Handle comparison operators
    const comp = expected as ComparisonOperator;
    return this.evaluateComparisonOperator(actual, comp);
  }
  
  /**
   * Check if expected is a simple value (not a comparison operator)
   */
  private isSimpleValue(expected: ParamValue): expected is string | number | boolean {
    return typeof expected === 'string' || typeof expected === 'number' || typeof expected === 'boolean';
  }
  
  /**
   * Evaluate simple exact match
   */
  private evaluateSimpleMatch(actual: unknown, expected: string | number | boolean): ComparisonResult {
    const passed = String(actual) === String(expected);
    return {
      passed,
      message: passed ? `Value matches ${expected}` : `Expected ${expected}, got ${actual}`,
      actualValue: actual,
      expectedValue: expected,
    };
  }
  
  /**
   * Evaluate comparison operator
   */
  private evaluateComparisonOperator(actual: unknown, comp: ComparisonOperator): ComparisonResult {
    const actualStr = String(actual);
    const actualNum = this.parseNumber(actual);
    
    // Equality operators
    if (comp.eq !== undefined) return this.evaluateEquals(actual, comp.eq);
    if (comp.ne !== undefined) return this.evaluateNotEquals(actual, comp.ne);
    
    // Numeric comparisons
    if (comp.gt !== undefined) return this.evaluateGreaterThan(actualNum, comp.gt);
    if (comp.gte !== undefined) return this.evaluateGreaterThanOrEqual(actualNum, comp.gte);
    if (comp.lt !== undefined) return this.evaluateLessThan(actualNum, comp.lt);
    if (comp.lte !== undefined) return this.evaluateLessThanOrEqual(actualNum, comp.lte);
    
    // Range and pattern matching
    if (comp.between) return this.evaluateBetween(actualNum, comp.between);
    if (comp.matches) return this.evaluateMatches(actualStr, comp.matches);
    
    // List operations
    if (comp.in) return this.evaluateIn(actual, comp.in);
    if (comp.notIn) return this.evaluateNotIn(actual, comp.notIn);
    
    // No valid operator found
    return { passed: false, message: 'No valid comparison operator found', actualValue: actual };
  }
  
  private evaluateEquals(actual: unknown, expected: unknown): ComparisonResult {
    const passed = String(actual) === String(expected);
    return {
      passed,
      message: passed ? `Value equals ${expected}` : `Expected ${expected}, got ${actual}`,
      actualValue: actual,
      expectedValue: expected,
    };
  }
  
  private evaluateNotEquals(actual: unknown, expected: unknown): ComparisonResult {
    const passed = String(actual) !== String(expected);
    return {
      passed,
      message: passed ? `Value is not ${expected}` : `Value should not be ${expected}`,
      actualValue: actual,
      expectedValue: expected,
    };
  }
  
  private evaluateGreaterThan(actualNum: number, expectedValue: unknown): ComparisonResult {
    const expected = this.parseNumber(expectedValue);
    const passed = actualNum > expected;
    return {
      passed,
      message: passed ? `Value ${actualNum} > ${expected}` : `Expected > ${expected}, got ${actualNum}`,
      actualValue: actualNum,
      expectedValue: expected,
    };
  }
  
  private evaluateGreaterThanOrEqual(actualNum: number, expectedValue: unknown): ComparisonResult {
    const expected = this.parseNumber(expectedValue);
    const passed = actualNum >= expected;
    return {
      passed,
      message: passed ? `Value ${actualNum} >= ${expected}` : `Expected >= ${expected}, got ${actualNum}`,
      actualValue: actualNum,
      expectedValue: expected,
    };
  }
  
  private evaluateLessThan(actualNum: number, expectedValue: unknown): ComparisonResult {
    const expected = this.parseNumber(expectedValue);
    const passed = actualNum < expected;
    return {
      passed,
      message: passed ? `Value ${actualNum} < ${expected}` : `Expected < ${expected}, got ${actualNum}`,
      actualValue: actualNum,
      expectedValue: expected,
    };
  }
  
  private evaluateLessThanOrEqual(actualNum: number, expectedValue: unknown): ComparisonResult {
    const expected = this.parseNumber(expectedValue);
    const passed = actualNum <= expected;
    return {
      passed,
      message: passed ? `Value ${actualNum} <= ${expected}` : `Expected <= ${expected}, got ${actualNum}`,
      actualValue: actualNum,
      expectedValue: expected,
    };
  }
  
  private evaluateBetween(actualNum: number, range: [unknown, unknown]): ComparisonResult {
    if (!Array.isArray(range) || range.length !== 2) {
      return { passed: false, message: 'Invalid range format', actualValue: actualNum };
    }
    
    const min = this.parseNumber(range[0]);
    const max = this.parseNumber(range[1]);
    const passed = actualNum >= min && actualNum <= max;
    
    return {
      passed,
      message: passed 
        ? `Value ${actualNum} is between ${min} and ${max}` 
        : `Expected between ${min} and ${max}, got ${actualNum}`,
      actualValue: actualNum,
      expectedValue: range,
    };
  }
  
  private evaluateMatches(actualStr: string, pattern: RegExp | string): ComparisonResult {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    const passed = regex.test(actualStr);
    
    return {
      passed,
      message: passed 
        ? `Value matches pattern ${regex}` 
        : `Value does not match pattern ${regex}`,
      actualValue: actualStr,
      expectedValue: pattern,
    };
  }
  
  private evaluateIn(actual: unknown, list: unknown[]): ComparisonResult {
    if (!Array.isArray(list)) {
      return { passed: false, message: 'Invalid list format', actualValue: actual };
    }
    
    const passed = list.some(v => String(actual) === String(v));
    return {
      passed,
      message: passed 
        ? `Value ${actual} is in [${list.join(', ')}]` 
        : `Value ${actual} is not in [${list.join(', ')}]`,
      actualValue: actual,
      expectedValue: list,
    };
  }
  
  private evaluateNotIn(actual: unknown, list: unknown[]): ComparisonResult {
    if (!Array.isArray(list)) {
      return { passed: false, message: 'Invalid list format', actualValue: actual };
    }
    
    const passed = !list.some(v => String(actual) === String(v));
    return {
      passed,
      message: passed 
        ? `Value ${actual} is not in [${list.join(', ')}]` 
        : `Value ${actual} should not be in [${list.join(', ')}]`,
      actualValue: actual,
      expectedValue: list,
    };
  }
  
  /**
   * Parse a value as a number, handling strings and edge cases
   */
  private parseNumber(value: unknown): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  }
}
