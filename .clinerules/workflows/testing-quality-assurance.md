# Workflow: Testing e Quality Assurance

## 🎯 Obiettivo
Garantire alta qualità del codice attraverso testing sistematico e QA procedures.

## 🧪 Strategia di Testing

### Test Pyramid
```
     /\     E2E Tests (Few)
    /  \    - User workflows
   /____\   - Critical paths
  /      \  
 /________\  Integration Tests (Some)
/          \ - Component interactions
/____________\ Unit Tests (Many)
             - Functions, methods
             - Components logic
```

## 📋 Pre-Testing Checklist

### Code Quality
- [ ] Lint checks passano (`npm run lint`)
- [ ] Type checks passano (`npm run type-check`)
- [ ] No console.log/debugger statements
- [ ] Code coverage requirements soddisfatti
- [ ] Dead code rimosso

### Test Environment Setup
- [ ] Test database pulito
- [ ] Mock data consistenti
- [ ] Environment variables configurati
- [ ] Dependencies aggiornati

## 🔧 Unit Testing

### Pattern Standard
```typescript
// src/components/__tests__/ComponentName.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { ComponentName } from '../ComponentName';

// Mock dependencies
vi.mock('../dependency', () => ({
  dependency: vi.fn()
}));

describe('ComponentName', () => {
  const defaultProps = {
    prop1: 'value1',
    onAction: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should render with default props', () => {
    render(<ComponentName {...defaultProps} />);
    
    expect(screen.getByRole('button')).toBeInTheDocument();
    expect(screen.getByText('Expected Text')).toBeVisible();
  });

  it('should handle user interactions', async () => {
    const user = userEvent.setup();
    render(<ComponentName {...defaultProps} />);
    
    await user.click(screen.getByRole('button'));
    
    expect(defaultProps.onAction).toHaveBeenCalledWith(expectedArgs);
  });

  it('should handle loading states', () => {
    render(<ComponentName {...defaultProps} isLoading={true} />);
    
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('should handle error states', () => {
    const errorMessage = 'Test error message';
    render(<ComponentName {...defaultProps} error={errorMessage} />);
    
    expect(screen.getByRole('alert')).toHaveTextContent(errorMessage);
  });
});
```

### Service Testing Pattern
```typescript
// src/services/__tests__/ServiceName.test.ts
import { vi } from 'vitest';
import { ServiceName } from '../ServiceName';

// Mock dependencies
const mockElectronAPI = {
  filesystem: {
    readFile: vi.fn(),
    writeFile: vi.fn()
  }
};

global.window = {
  electronAPI: mockElectronAPI
} as any;

describe('ServiceName', () => {
  let service: ServiceName;

  beforeEach(() => {
    service = new ServiceName();
    vi.clearAllMocks();
  });

  describe('methodName', () => {
    it('should return expected result on success', async () => {
      // Arrange
      const mockData = { id: '1', name: 'test' };
      mockElectronAPI.filesystem.readFile.mockResolvedValue(JSON.stringify(mockData));
      
      // Act
      const result = await service.methodName('test-id');
      
      // Assert
      expect(result).toEqual(mockData);
      expect(mockElectronAPI.filesystem.readFile).toHaveBeenCalledWith('expected-path');
    });

    it('should handle file not found error', async () => {
      // Arrange
      mockElectronAPI.filesystem.readFile.mockRejectedValue(new Error('File not found'));
      
      // Act & Assert
      await expect(service.methodName('test-id')).rejects.toThrow('File not found');
    });

    it('should handle invalid JSON data', async () => {
      // Arrange
      mockElectronAPI.filesystem.readFile.mockResolvedValue('invalid json');
      
      // Act & Assert
      await expect(service.methodName('test-id')).rejects.toThrow();
    });
  });
});
```

## 🔗 Integration Testing

### Component Integration
```typescript
// test/integration/ModManagement.integration.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { ModManagerLayout } from '../../src/components/layout/ModManagerLayout';
import { TestProviders } from '../utils/TestProviders';

describe('Mod Management Integration', () => {
  it('should complete full mod installation workflow', async () => {
    const user = userEvent.setup();
    
    render(
      <TestProviders>
        <ModManagerLayout />
      </TestProviders>
    );

    // 1. Upload mod file
    const fileInput = screen.getByLabelText(/upload mod/i);
    const testFile = new File(['test content'], 'test-mod.pak', {
      type: 'application/octet-stream'
    });
    
    await user.upload(fileInput, testFile);

    // 2. Verify mod appears in list
    await waitFor(() => {
      expect(screen.getByText('test-mod')).toBeInTheDocument();
    });

    // 3. Enable mod
    const enableButton = screen.getByRole('button', { name: /enable/i });
    await user.click(enableButton);

    // 4. Verify mod is enabled
    await waitFor(() => {
      expect(screen.getByText(/enabled/i)).toBeInTheDocument();
    });
  });
});
```

## 🌍 E2E Testing

### Playwright E2E Tests
```typescript
// test/e2e/mod-management.spec.ts
import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Mod Management E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app
    await page.goto('/');
    
    // Setup game folder if needed
    await page.getByTestId('setup-game-folder').click();
    await page.getByRole('button', { name: 'Select Folder' }).click();
    // ... folder selection logic
  });

  test('should install and enable mod from file', async ({ page }) => {
    // 1. Upload mod file
    const fileInput = page.getByTestId('mod-file-input');
    await fileInput.setInputFiles(path.join(__dirname, 'fixtures/test-mod.pak'));

    // 2. Wait for processing
    await page.waitForSelector('[data-testid="mod-processing"]', { state: 'hidden' });

    // 3. Verify mod in list
    await expect(page.getByTestId('mod-list')).toContainText('test-mod');

    // 4. Enable mod
    await page.getByTestId('mod-test-mod-enable').click();

    // 5. Verify enabled state
    await expect(page.getByTestId('mod-test-mod-status')).toHaveText('Enabled');

    // 6. Verify mod files copied to game directory
    // ... file system verification
  });

  test('should handle mod installation errors gracefully', async ({ page }) => {
    // Upload invalid file
    const fileInput = page.getByTestId('mod-file-input');
    await fileInput.setInputFiles(path.join(__dirname, 'fixtures/invalid-file.txt'));

    // Verify error message
    await expect(page.getByRole('alert')).toContainText('Invalid mod file');
    
    // Verify no mod added to list
    await expect(page.getByTestId('mod-list')).not.toContainText('invalid-file');
  });
});
```

## 📊 Coverage Testing

### Coverage Requirements
```json
// vitest.config.ts coverage thresholds
{
  coverage: {
    provider: 'v8',
    reporter: ['text', 'html', 'lcov'],
    thresholds: {
      global: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80
      },
      // Critical files require higher coverage
      'src/services/': {
        branches: 90,
        functions: 90,
        lines: 90,
        statements: 90
      }
    },
    exclude: [
      'src/**/*.d.ts',
      'src/**/*.stories.tsx',
      'src/test-utils/',
      'electron/'
    ]
  }
}
```

### Coverage Analysis Workflow
```bash
# 1. Run tests with coverage
npm run test:coverage

# 2. Generate detailed report
npm run coverage:report

# 3. Open HTML report
npm run coverage:open

# 4. Identify uncovered code
npm run coverage:uncovered
```

## 🔍 Quality Assurance Checklist

### Automated QA
- [ ] All unit tests passing
- [ ] Integration tests passing
- [ ] E2E tests passing
- [ ] Coverage thresholds met
- [ ] Performance benchmarks passed
- [ ] Memory leak detection clean
- [ ] Bundle size within limits

### Manual QA

#### Functional Testing
- [ ] Core user workflows tested
- [ ] Edge cases verified
- [ ] Error handling tested
- [ ] Input validation working
- [ ] File operations secure

#### UI/UX Testing
- [ ] Layout responsive on different screen sizes
- [ ] Dark mode functionality
- [ ] Keyboard navigation working
- [ ] Screen reader compatibility
- [ ] Loading states appropriate
- [ ] Error messages clear and helpful

#### Performance Testing
- [ ] App startup time acceptable
- [ ] Large mod lists performant
- [ ] File operations don't block UI
- [ ] Memory usage stable
- [ ] CPU usage reasonable

#### Cross-Platform Testing
- [ ] Windows functionality verified
- [ ] macOS functionality verified
- [ ] Linux functionality verified
- [ ] File path handling correct
- [ ] Permissions working properly

## 🐛 Bug Reproduction Workflow

### Bug Report Analysis
```markdown
# Bug Report Template
## Environment
- OS: Windows 11
- App Version: 1.2.3
- Node Version: 18.17.0
- Electron Version: 25.3.0

## Steps to Reproduce
1. Open app
2. Import mod file X
3. Enable mod Y
4. Expected: Z happens
5. Actual: Error occurs

## Error Details
- Error message: "..."
- Stack trace: "..."
- Console logs: "..."

## Additional Info
- Happens every time / intermittently
- Other mods installed: [list]
- Recent changes: [describe]
```

### Reproduction Steps
```typescript
// 1. Create test case from bug report
it('should reproduce bug #123', async () => {
  // Setup exact conditions from report
  // Follow exact steps
  // Verify bug occurs
  // Document findings
});

// 2. Create regression test
it('should prevent regression of bug #123', async () => {
  // Test case that would fail if bug reintroduced
});
```

## 📈 Performance Testing

### Performance Benchmarks
```typescript
// test/performance/mod-loading.perf.test.ts
import { performance } from 'perf_hooks';

describe('Performance Benchmarks', () => {
  it('should load 100 mods within 2 seconds', async () => {
    const startTime = performance.now();
    
    // Load 100 test mods
    const mods = await loadMods(generateTestMods(100));
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    expect(duration).toBeLessThan(2000); // 2 seconds max
    expect(mods).toHaveLength(100);
  });

  it('should handle 1000 mod enable/disable operations efficiently', async () => {
    const mods = await loadMods(generateTestMods(1000));
    
    const startTime = performance.now();
    
    // Enable all mods
    await Promise.all(mods.map(mod => enableMod(mod.id)));
    
    // Disable all mods
    await Promise.all(mods.map(mod => disableMod(mod.id)));
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    expect(duration).toBeLessThan(5000); // 5 seconds max
  });
});
```

### Memory Testing
```typescript
// Memory leak detection
describe('Memory Usage', () => {
  it('should not leak memory during mod operations', async () => {
    const initialMemory = process.memoryUsage().heapUsed;
    
    // Perform memory-intensive operations
    for (let i = 0; i < 100; i++) {
      await loadMod(`test-mod-${i}.pak`);
      await unloadMod(`test-mod-${i}.pak`);
    }
    
    // Force garbage collection
    if (global.gc) global.gc();
    
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;
    
    // Memory increase should be minimal
    expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // 50MB max
  });
});
```

## 🚀 CI/CD Testing Integration

### GitHub Actions Testing
```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
        node-version: [18, 20]

    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run linting
        run: npm run lint
      
      - name: Run type checking
        run: npm run type-check
      
      - name: Run unit tests
        run: npm run test:coverage
      
      - name: Run E2E tests
        run: npm run test:e2e
      
      - name: Upload coverage reports
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info
```

## 📋 Testing Maintenance

### Regular Tasks
- [ ] Review and update test data
- [ ] Clean up obsolete tests
- [ ] Update mock responses
- [ ] Refresh E2E test fixtures
- [ ] Performance benchmark updates

### Quarterly Reviews
- [ ] Test coverage analysis
- [ ] Test execution time optimization
- [ ] Flaky test identification and fixes
- [ ] Testing tool updates
- [ ] Best practices review
