import { createApp } from './app';
import { config } from './shared/config';
import { connectDatabase, disconnectDatabase } from './shared/database';

async function bootstrap() {
  console.log('🚀 Initializing TeleBill Pro Server...');

  // 1. Establish database connection and configure SQLite WAL pragmas
  await connectDatabase();

  // 2. Create Express application
  const app = createApp();

  // 3. Start HTTP listener
  const server = app.listen(config.PORT, config.HOST, () => {
    console.log(`=======================================================`);
    console.log(`📡 TeleBill Pro OSS/BSS Monolith Backend Running`);
    console.log(`🌐 URL: http://${config.HOST === '0.0.0.0' ? 'localhost' : config.HOST}:${config.PORT}`);
    console.log(`🩺 Health: http://localhost:${config.PORT}/api/health`);
    console.log(`🔒 Mode: ${config.NODE_ENV}`);
    console.log(`=======================================================`);
  });

  // 4. Graceful Shutdown Handlers
  const gracefulShutdown = async (signal: string) => {
    console.log(`\n🛑 Received ${signal}. Initiating graceful shutdown...`);
    server.close(async () => {
      console.log('🛑 HTTP server closed.');
      await disconnectDatabase();
      console.log('✅ TeleBill Pro backend shut down cleanly.');
      process.exit(0);
    });

    // Timeout force termination after 10s
    setTimeout(() => {
      console.error('⚠️ Forcefully terminating process after shutdown timeout.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

  process.on('unhandledRejection', (reason, _promise) => {
    console.error('💥 Unhandled Promise Rejection:', reason);
  });

  process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception thrown:', error);
    process.exit(1);
  });
}

bootstrap().catch((err) => {
  console.error('❌ FATAL: Application bootstrap failed:', err);
  process.exit(1);
});
