import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const rootEnvPath = path.resolve(backendRoot, '../.env');

dotenv.config({ path: rootEnvPath });
