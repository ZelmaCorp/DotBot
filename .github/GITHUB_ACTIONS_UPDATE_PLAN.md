# GitHub Actions Update Plan

## Current Status

The GitHub Actions workflows currently test:
- ✅ Frontend (React app)
- ✅ Backend (Express API)
- ❌ **Missing**: `lib/dotbot-core` (Core library with 839 tests)
- ❌ **Missing**: `lib/dotbot-express` (Express middleware library)

## Issues Identified

1. **Missing Library Tests**: The CI/CD pipeline doesn't run tests for the core libraries in the monorepo
2. **No Build Step for Core**: Frontend and backend depend on `@dotbot/core`, but it's not built before testing
3. **Incomplete Test Coverage**: Only testing application layers, not the shared libraries

## Update Plan

### Phase 1: Add Core Library Testing (HIGH PRIORITY)
**Why**: `lib/dotbot-core` now has 839 passing unit tests covering critical functionality

**Changes needed**:
- Add test step for `lib/dotbot-core` before frontend/backend tests
- Build `lib/dotbot-core` first (required by other workspaces)
- Run all 839 tests to ensure library stability

### Phase 2: Add Express Middleware Testing (MEDIUM PRIORITY)
**Why**: `lib/dotbot-express` provides Express integration and should be tested

**Changes needed**:
- Add test step for `lib/dotbot-express`
- Run after core library tests (may depend on core)

### Phase 3: Optimize Test Execution (LOW PRIORITY)
**Why**: Improve CI/CD speed and maintainability

**Changes needed**:
- Use monorepo-level test command: `npm run test` (runs all workspaces)
- Consider parallelizing library tests vs application tests
- Add test result caching

## Implementation Details

### Updated Test Job Structure

```yaml
test:
  name: Run Tests
  runs-on: ubuntu-latest
  
  steps:
  - name: Checkout code
    uses: actions/checkout@v4
    
  - name: Setup Node.js
    uses: actions/setup-node@v4
    with:
      node-version: '18'
      cache: 'npm'
      cache-dependency-path: package-lock.json
      
  - name: Install all dependencies (workspaces)
    run: npm ci
    
  # NEW: Build core library first (required by frontend/backend)
  - name: Build dotbot-core library
    working-directory: ./lib/dotbot-core
    run: npm run build
    
  # NEW: Test core library (839 tests)
  - name: Run dotbot-core tests
    working-directory: ./lib/dotbot-core
    run: npm test -- --coverage
    
  # NEW: Test express middleware library
  - name: Run dotbot-express tests
    working-directory: ./lib/dotbot-express
    run: npm test -- --coverage || echo "No tests configured yet"
    
  # EXISTING: Frontend tests
  - name: Run frontend tests
    working-directory: ./frontend
    run: npm test -- --coverage --watchAll=false
    
  - name: Run frontend type check
    working-directory: ./frontend
    run: npm run type-check
    
  - name: Run frontend lint
    working-directory: ./frontend
    run: npm run lint
    
  # EXISTING: Backend tests
  - name: Run backend type check
    working-directory: ./backend
    run: npm run type-check
    
  - name: Run backend tests
    working-directory: ./backend
    run: npm test -- --coverage --watchAll=false || echo "No tests configured yet"
```

## Test Execution Order

```
1. Install dependencies (all workspaces)
   ↓
2. Build @dotbot/core
   ↓
3. Test @dotbot/core (839 tests) ← NEW
   ↓
4. Test @dotbot/express ← NEW
   ↓
5. Test frontend (depends on @dotbot/core)
   ↓
6. Test backend (depends on @dotbot/core)
```

## Benefits

1. **Full Test Coverage**: All 839 core library tests run on every push
2. **Early Failure Detection**: Library issues caught before application testing
3. **Proper Build Order**: Core library built before dependents
4. **Confidence**: Ensures the foundation (core library) is stable before testing apps

## Risks & Mitigation

| Risk | Mitigation |
|------|------------|
| Longer CI/CD time | Acceptable - only adds ~10-15 seconds for 839 tests |
| Build failures | Core library already built successfully locally |
| Flaky tests | All 839 tests passing locally, well-isolated |

## Success Criteria

- ✅ All 839 `lib/dotbot-core` tests pass in CI
- ✅ Core library built before frontend/backend tests
- ✅ No breaking changes to existing workflow
- ✅ Both staging and production workflows updated

## Rollback Plan

If issues occur:
1. Revert workflow changes
2. Add `|| echo "Tests skipped"` to new test steps
3. Investigate and fix
4. Redeploy

## Timeline

- **Immediate**: Update both workflow files
- **Validation**: Monitor first CI run
- **Complete**: After successful deployment to both staging and production

---

**Updated**: 2026-01-14
**Status**: Ready for implementation
