// Next.js instrumentation for performance monitoring

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Server-side performance monitoring
    if (process.env.NODE_ENV === 'development') {
      console.log('🔧 Performance instrumentation loaded for server');
    }
    
    // Monitor server startup time
    const startTime = process.hrtime.bigint();
    
    process.on('exit', () => {
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
      console.log(`📊 Server runtime: ${duration.toFixed(2)}ms`);
    });

    // Monitor memory usage in development
    if (process.env.NODE_ENV === 'development') {
      setInterval(() => {
        const memUsage = process.memoryUsage();
        const formatBytes = (bytes: number) => (bytes / 1024 / 1024).toFixed(2) + 'MB';
        
        console.log('🧠 Memory Usage:', {
          rss: formatBytes(memUsage.rss),
          heapTotal: formatBytes(memUsage.heapTotal),
          heapUsed: formatBytes(memUsage.heapUsed),
          external: formatBytes(memUsage.external)
        });
      }, 30000); // Every 30 seconds
    }
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    console.log('⚡ Edge runtime instrumentation loaded');
  }
}