import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    reporters: 'default',
    coverage: {
      provider: 'v8',
      reporter: ['html', 'lcov', 'text', 'text-summary'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/__tests__/**',
        '**/*.d.ts',
      ],
    },
  },
});
