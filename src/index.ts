/**
 * SentinelFlow Backend Entry Point
 * Starts the governed agentic workflow server
 */

import { SentinelFlowServer } from './server';

async function main() {
  const port = process.env.PORT ? parseInt(process.env.PORT) : 3001;
  const server = new SentinelFlowServer(port);

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nReceived SIGINT, shutting down gracefully...');
    await server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\nReceived SIGTERM, shutting down gracefully...');
    await server.stop();
    process.exit(0);
  });

  try {
    await server.start();
  } catch (error) {
    console.error('Failed to start SentinelFlow server:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

export { SentinelFlowServer };