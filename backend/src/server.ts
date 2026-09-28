import 'dotenv/config';
import { createRuntimeApp } from './platform/http/app.ts';

const runtime = createRuntimeApp(process.env);
const port = Number(process.env.PORT) || 3001;
const app = runtime.app;
console.log('[Server] Initialized with PostgreSQL database pool and Supabase auth.');

const server = app.listen(port, () => {
  console.log(`[Server] E-Commerce Platform API is listening on http://localhost:${port}`);
  console.log(`[Server] Health Check: http://localhost:${port}/api/v1/health`);
  console.log(`[Server] OpenAPI Specification: http://localhost:${port}/api/v1/openapi.json`);
});

const gracefulShutdown = async () => {
  console.log('[Server] Shutting down gracefully...');
  server.close(async () => {
    if (runtime) {
      await runtime.close();
    }
    console.log('[Server] Closed all connections.');
    process.exit(0);
  });
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
