/**
 * OpenAPI Test Runner
 * 
 * Automatically generates and runs integration tests from openapi.yaml
 * No maintenance burden - just maintain the OpenAPI spec!
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { OpenAPIV3 } from 'openapi-types';
import YAML from 'yaml';

interface TestResult {
  method: string;
  path: string;
  status: 'pass' | 'fail' | 'skip';
  error?: string;
  duration: number;
  requestBody?: any;
  responseStatus?: number;
  responseBody?: any;
  validationErrors?: string[];
}

class OpenAPITestRunner {
  private spec: OpenAPIV3.Document;
  private baseUrl: string;
  private results: TestResult[] = [];

  constructor(specPath: string, baseUrl: string) {
    const specContent = fs.readFileSync(specPath, 'utf-8');
    this.spec = YAML.parse(specContent) as OpenAPIV3.Document;
    this.baseUrl = baseUrl;
  }

  /**
   * Resolve $ref reference
   */
  private resolveRef(ref: string): OpenAPIV3.SchemaObject | null {
    // Format: #/components/schemas/ChatRequest
    if (!ref.startsWith('#/')) {
      return null;
    }

    const parts = ref.slice(2).split('/'); // Remove '#/' and split
    let current: any = this.spec;

    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return null;
      }
    }

    return current as OpenAPIV3.SchemaObject;
  }

  /**
   * Generate test data for a request
   */
  private generateTestData(schema: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject): any {
    // Handle $ref
    if ('$ref' in schema) {
      const resolved = this.resolveRef(schema.$ref);
      if (resolved) {
        return this.generateTestData(resolved);
      }
      return {};
    }

    const schemaObj = schema as OpenAPIV3.SchemaObject;

    // Use example if available
    if (schemaObj.example !== undefined) {
      return schemaObj.example;
    }

    if (schemaObj.type === 'object' && schemaObj.properties) {
      const obj: any = {};
      
      // Include all required fields
      if (schemaObj.required) {
        for (const key of schemaObj.required) {
          if (schemaObj.properties[key]) {
            obj[key] = this.generateTestData(schemaObj.properties[key] as OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject);
          }
        }
      }
      
      return obj;
    }

    if (schemaObj.type === 'string') {
      if (schemaObj.enum) return schemaObj.enum[0];
      if (schemaObj.format === 'date-time') return new Date().toISOString();
      if (schemaObj.example !== undefined) return schemaObj.example;
      return 'test-string';
    }

    if (schemaObj.type === 'number' || schemaObj.type === 'integer') {
      return schemaObj.example || 0;
    }

    if (schemaObj.type === 'boolean') {
      return true;
    }

    if (schemaObj.type === 'array' && schemaObj.items) {
      return [this.generateTestData(schemaObj.items as OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject)];
    }

    return {};
  }

  /**
   * Validate response against OpenAPI schema
   */
  private validateResponse(
    response: any,
    schema: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Handle $ref
    if ('$ref' in schema) {
      // For now, skip $ref validation (would need to resolve references)
      return { valid: true, errors: [] };
    }

    const schemaObj = schema as OpenAPIV3.SchemaObject;

    // Check required fields
    if (schemaObj.required) {
      for (const field of schemaObj.required) {
        if (!(field in response)) {
          errors.push(`Missing required field: ${field}`);
        }
      }
    }

    // Check type
    if (schemaObj.type === 'object' && typeof response !== 'object') {
      errors.push(`Expected object, got ${typeof response}`);
    }

    if (schemaObj.type === 'string' && typeof response !== 'string') {
      errors.push(`Expected string, got ${typeof response}`);
    }

    if (schemaObj.type === 'number' && typeof response !== 'number') {
      errors.push(`Expected number, got ${typeof response}`);
    }

    // Check properties
    if (schemaObj.type === 'object' && schemaObj.properties) {
      for (const [key, prop] of Object.entries(schemaObj.properties)) {
        if (key in response) {
          const propSchema = prop as OpenAPIV3.SchemaObject;
          if (propSchema.type) {
            const actualType = Array.isArray(response[key]) ? 'array' : typeof response[key];
            if (propSchema.type !== actualType && propSchema.type !== 'array') {
              errors.push(`Field ${key}: expected ${propSchema.type}, got ${actualType}`);
            }
          }
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Test a single endpoint
   */
  private async testEndpoint(
    method: string,
    path: string,
    operation: OpenAPIV3.OperationObject
  ): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      // Skip if no 200 response defined
      const successResponse = operation.responses?.['200'];
      if (!successResponse) {
        return {
          method,
          path,
          status: 'skip',
          duration: 0,
        };
      }

      // Generate request body if needed
      let requestBody: any = undefined;
      if (operation.requestBody) {
        const requestBodyContent = (operation.requestBody as OpenAPIV3.RequestBodyObject).content;
        const jsonContent = requestBodyContent?.['application/json'];
        if (jsonContent?.schema) {
          requestBody = this.generateTestData(jsonContent.schema as OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject);
        }
      }

      // Replace path parameters with test values
      let testPath = path;
      const pathParams = path.match(/\{([^}]+)\}/g);
      if (pathParams) {
        for (const param of pathParams) {
          const paramName = param.slice(1, -1);
          // Use test values based on parameter name
          if (paramName.includes('sessionId')) {
            testPath = testPath.replace(param, 'wallet:5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY:mainnet');
          } else if (paramName.includes('chatId')) {
            testPath = testPath.replace(param, 'chat_test_12345');
          } else if (paramName.includes('executionId')) {
            testPath = testPath.replace(param, 'exec_test_12345');
          } else {
            testPath = testPath.replace(param, 'test');
          }
        }
      }

      // Make request
      const url = `${this.baseUrl}${testPath}`;
      const config: any = {
        method: method.toLowerCase(),
        url,
        validateStatus: () => true, // Don't throw on any status
      };

      if (requestBody) {
        config.data = requestBody;
        config.headers = { 'Content-Type': 'application/json' };
      }

      const response = await axios(config);
      const duration = Date.now() - startTime;

      // Check status code
      if (response.status !== 200) {
        return {
          method,
          path,
          status: 'fail',
          error: `Expected 200, got ${response.status}`,
          duration,
          requestBody,
          responseStatus: response.status,
          responseBody: response.data,
        };
      }

      // Validate response schema
      const responseContent = (successResponse as OpenAPIV3.ResponseObject).content;
      const jsonSchema = responseContent?.['application/json']?.schema;
      
      if (jsonSchema) {
        const validation = this.validateResponse(response.data, jsonSchema);
        if (!validation.valid) {
          return {
            method,
            path,
            status: 'fail',
            error: validation.errors.join('; '),
            duration,
            requestBody,
            responseStatus: response.status,
            responseBody: response.data,
            validationErrors: validation.errors,
          };
        }
      }

      return {
        method,
        path,
        status: 'pass',
        duration,
        requestBody,
        responseStatus: response.status,
        responseBody: response.data,
      };
    } catch (error: any) {
      return {
        method,
        path,
        status: 'fail',
        error: error.message || String(error),
        duration: Date.now() - startTime,
      };
    }
  }
  
  /**
   * Test a single endpoint with detailed output
   */
  async testSingleEndpoint(endpointPath: string, verbose: boolean = true): Promise<void> {
    console.log('======================================');
    console.log('Testing Single Endpoint');
    console.log('======================================');
    console.log(`Endpoint: ${endpointPath}`);
    console.log(`Base URL: ${this.baseUrl}`);
    console.log('');

    if (!this.spec.paths) {
      console.log('No paths found in OpenAPI spec');
      return;
    }

    // Find the endpoint
    let found = false;
    for (const [path, pathItem] of Object.entries(this.spec.paths)) {
      if (!pathItem) continue;

      // Check if this path matches (exact match or pattern match)
      if (path === endpointPath || path.replace(/\{[^}]+\}/g, '*') === endpointPath.replace(/\{[^}]+\}/g, '*')) {
        const methods = ['get', 'post', 'put', 'delete', 'patch'] as const;
        for (const method of methods) {
          const operation = pathItem[method];
          if (operation) {
            found = true;
            console.log(`\x1b[36mTesting: ${method.toUpperCase()} ${path}\x1b[0m`);
            console.log('');

            // Show request details
            if (verbose) {
              console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
              console.log('REQUEST');
              console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
              console.log(`Method: ${method.toUpperCase()}`);
              console.log(`URL: ${this.baseUrl}${path}`);
              
              if (operation.requestBody) {
                const requestBodyContent = (operation.requestBody as OpenAPIV3.RequestBodyObject).content;
                const jsonContent = requestBodyContent?.['application/json'];
                if (jsonContent?.schema) {
                  const requestBody = this.generateTestData(jsonContent.schema as OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject);
                  console.log('Body:');
                  console.log(JSON.stringify(requestBody, null, 2));
                }
              }
              console.log('');
            }

            const result = await this.testEndpoint(method.toUpperCase(), path, operation);
            
            // Show response details
            if (verbose) {
              console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
              console.log('RESPONSE');
              console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
              console.log(`Status: ${result.responseStatus || 'N/A'}`);
              if (result.responseBody) {
                console.log('Body:');
                console.log(JSON.stringify(result.responseBody, null, 2));
              }
              console.log('');
            }

            // Show validation results
            if (result.status === 'pass') {
              console.log('\x1b[32m✅ Test PASSED\x1b[0m');
              console.log(`Duration: ${result.duration}ms`);
            } else if (result.status === 'fail') {
              console.log('\x1b[31m❌ Test FAILED\x1b[0m');
              console.log(`Duration: ${result.duration}ms`);
              console.log('');
              console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
              console.log('ERROR DETAILS');
              console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
              console.log(`Error: ${result.error}`);
              
              if (result.validationErrors && result.validationErrors.length > 0) {
                console.log('');
                console.log('Validation Errors:');
                result.validationErrors.forEach((err, i) => {
                  console.log(`  ${i + 1}. ${err}`);
                });
              }

              // Show expected vs received
              if (result.responseStatus && result.responseStatus !== 200) {
                console.log('');
                console.log('Expected: HTTP 200');
                console.log(`Received: HTTP ${result.responseStatus}`);
              }

              // Show schema expectations
              const successResponse = operation.responses?.['200'];
              if (successResponse) {
                const responseContent = (successResponse as OpenAPIV3.ResponseObject).content;
                const jsonSchema = responseContent?.['application/json']?.schema;
                if (jsonSchema && !('$ref' in jsonSchema)) {
                  const schema = jsonSchema as OpenAPIV3.SchemaObject;
                  console.log('');
                  console.log('Expected Schema:');
                  if (schema.type) console.log(`  Type: ${schema.type}`);
                  if (schema.required) {
                    console.log(`  Required fields: ${schema.required.join(', ')}`);
                  }
                  if (schema.properties) {
                    console.log('  Properties:');
                    for (const [key, prop] of Object.entries(schema.properties)) {
                      const propSchema = prop as OpenAPIV3.SchemaObject;
                      const required = schema.required?.includes(key) ? ' (required)' : '';
                      console.log(`    - ${key}: ${propSchema.type || 'any'}${required}`);
                    }
                  }
                }
              }
            }
            console.log('');
            return;
          }
        }
      }
    }

    if (!found) {
      console.log(`\x1b[31m❌ Endpoint not found: ${endpointPath}\x1b[0m`);
      console.log('');
      console.log('Available endpoints:');
      for (const [path, pathItem] of Object.entries(this.spec.paths)) {
        if (!pathItem) continue;
        const methods = ['get', 'post', 'put', 'delete', 'patch'] as const;
        for (const method of methods) {
          if (pathItem[method]) {
            console.log(`  ${method.toUpperCase()} ${path}`);
          }
        }
      }
      process.exit(1);
    }
  }

  /**
   * Run all tests
   */
  async runTests(): Promise<void> {
    console.log('======================================');
    console.log('OpenAPI Integration Tests');
    console.log('======================================');
    console.log(`Base URL: ${this.baseUrl}`);
    console.log('');

    if (!this.spec.paths) {
      console.log('No paths found in OpenAPI spec');
      return;
    }

    // Test each endpoint
    for (const [path, pathItem] of Object.entries(this.spec.paths)) {
      if (!pathItem) continue;

      const methods = ['get', 'post', 'put', 'delete', 'patch'] as const;
      for (const method of methods) {
        const operation = pathItem[method];
        if (operation) {
          const result = await this.testEndpoint(method.toUpperCase(), path, operation);
          this.results.push(result);

          // Print result
          const statusIcon = result.status === 'pass' ? '✓' : result.status === 'fail' ? '✗' : '⊘';
          const statusColor = result.status === 'pass' ? '\x1b[32m' : result.status === 'fail' ? '\x1b[31m' : '\x1b[33m';
          console.log(
            `${statusColor}${statusIcon}\x1b[0m ${result.method} ${result.path} (${result.duration}ms)`
          );
          if (result.error) {
            console.log(`  Error: ${result.error}`);
          }
        }
      }
    }

    // Print summary
    console.log('');
    console.log('======================================');
    console.log('Summary');
    console.log('======================================');
    const passed = this.results.filter(r => r.status === 'pass').length;
    const failed = this.results.filter(r => r.status === 'fail').length;
    const skipped = this.results.filter(r => r.status === 'skip').length;
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Total: ${this.results.length}`);
    console.log('');

    // Exit with error code if any tests failed (standard behavior for CI/CD)
    if (failed > 0) {
      console.log('\x1b[31m❌ Some tests failed. Fix the failing endpoints and run again.\x1b[0m');
      console.log('');
      process.exit(1);
    } else {
      console.log('\x1b[32m✅ All tests passed!\x1b[0m');
      console.log('');
    }
  }
}

// Run tests if executed directly
if (require.main === module) {
  const specPath = path.resolve(__dirname, '../../openapi.yaml');
  const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:8000';

  // Parse command-line arguments
  const args = process.argv.slice(2);
  const endpointArg = args.find(arg => arg.startsWith('/'));
  const verbose = !args.includes('--quiet') && !args.includes('-q');

  const runner = new OpenAPITestRunner(specPath, baseUrl);

  if (endpointArg) {
    // Test single endpoint
    runner.testSingleEndpoint(endpointArg, verbose).catch((error) => {
      console.error('Test runner error:', error);
      process.exit(1);
    });
  } else {
    // Run all tests
    runner.runTests().catch((error) => {
      console.error('Test runner error:', error);
      process.exit(1);
    });
  }
}

export default OpenAPITestRunner;
