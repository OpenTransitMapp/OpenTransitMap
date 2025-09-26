import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    reporters: 'default',
    coverage: {
      provider: 'v8',
      reporter: ['html', 'lcov', 'text', 'text-summary', 'json-summary', 'json'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/__tests__/**',
        '**/*.d.ts',
      ],
      reportOnFailure: true,
    },
  },
});
