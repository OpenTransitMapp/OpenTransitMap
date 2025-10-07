import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    reporters: 'default',
    testTimeout: 10000, // 10 second timeout per test
    hookTimeout: 10000, // 10 second timeout for hooks
    coverage: {
      provider: 'v8',
      reporter: ['html', 'lcov', 'text', 'text-summary', 'json-summary', 'json'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/__tests__/**',
        'src/main.ts',
        '**/*.d.ts',
      ],
      reportOnFailure: true,
    },
  },
});
