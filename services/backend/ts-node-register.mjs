import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

// Register ts-node ESM loader for on-the-fly TypeScript in dev
register('ts-node/esm', pathToFileURL('./'));

