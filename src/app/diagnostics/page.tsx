
'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PerformanceMonitor } from '@/lib/performance';
import { SEOOptimizer } from '@/lib/seo';
import { PWAValidator } from '@/lib/pwa-validator';

export default function DiagnosticsPage() {
  const [performanceReport, setPerformanceReport] = useState<any>(null);
  const [seoIssues, setSeoIssues] = useState<string[]>([]);
  const [pwaReport, setPwaReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const runDiagnostics = async () => {
    setLoading(true);
    
    // Performance
    const monitor = PerformanceMonitor.getInstance();
    monitor.generateReport();
    const resourceAnalysis = monitor.analyzeResourceLoading();
    const memory = monitor.monitorMemory();
    const network = monitor.detectNetworkQuality();
    
    setPerformanceReport({ resourceAnalysis, memory, network });

    // SEO
    const issues = SEOOptimizer.auditPage();
    setSeoIssues(issues);

    // PWA
    const pwa = await PWAValidator.validatePWA();
    setPwaReport(pwa);

    setLoading(false);
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">System Diagnostics</h1>
          <Button onClick={runDiagnostics} disabled={loading}>
            {loading ? 'Running...' : 'Run Diagnostics'}
          </Button>
        </div>

        {/* Performance */}
        <Card className="p-6">
          <h2 className="text-2xl font-bold mb-4">⚡ Performance Metrics</h2>
          {performanceReport && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">📦 Resource Analysis</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 bg-muted rounded">
                    <div className="text-sm text-muted-foreground">Scripts</div>
                    <div className="text-lg font-bold">{performanceReport.resourceAnalysis?.scripts?.length || 0}</div>
                  </div>
                  <div className="p-3 bg-muted rounded">
                    <div className="text-sm text-muted-foreground">Styles</div>
                    <div className="text-lg font-bold">{performanceReport.resourceAnalysis?.styles?.length || 0}</div>
                  </div>
                  <div className="p-3 bg-muted rounded">
                    <div className="text-sm text-muted-foreground">Images</div>
                    <div className="text-lg font-bold">{performanceReport.resourceAnalysis?.images?.length || 0}</div>
                  </div>
                  <div className="p-3 bg-muted rounded">
                    <div className="text-sm text-muted-foreground">Total</div>
                    <div className="text-lg font-bold">{performanceReport.resourceAnalysis?.total || 0}</div>
                  </div>
                </div>
              </div>

              {performanceReport.memory && (
                <div>
                  <h3 className="font-semibold mb-2">🧠 Memory Usage</h3>
                  <div className="p-3 bg-muted rounded">
                    <div>Used: {performanceReport.memory.used}MB / {performanceReport.memory.total}MB</div>
                    <div className="text-sm text-muted-foreground">Limit: {performanceReport.memory.limit}MB</div>
                  </div>
                </div>
              )}

              {performanceReport.network && (
                <div>
                  <h3 className="font-semibold mb-2">📡 Network</h3>
                  <div className="p-3 bg-muted rounded">
                    <div>Type: {performanceReport.network.type}</div>
                    <div>Downlink: {performanceReport.network.downlink}Mbps</div>
                    <div>RTT: {performanceReport.network.rtt}ms</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* SEO */}
        <Card className="p-6">
          <h2 className="text-2xl font-bold mb-4">🔍 SEO Audit</h2>
          {seoIssues.length === 0 ? (
            <div className="text-green-600">✅ No SEO issues detected</div>
          ) : (
            <ul className="space-y-2">
              {seoIssues.map((issue, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-yellow-600">⚠️</span>
                  <span>{issue}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* PWA */}
        <Card className="p-6">
          <h2 className="text-2xl font-bold mb-4">📱 PWA Validation</h2>
          {pwaReport && (
            <div className="space-y-3">
              {Object.entries(pwaReport).map(([key, value]: [string, any]) => (
                <div key={key} className="flex items-center justify-between p-3 bg-muted rounded">
                  <span className="font-medium capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                  <span className={`font-bold ${
                    value.status === 'pass' ? 'text-green-600' : 
                    value.status === 'warn' ? 'text-yellow-600' : 
                    'text-red-600'
                  }`}>
                    {value.status === 'pass' ? '✅' : value.status === 'warn' ? '⚠️' : '❌'} {value.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <div className="text-center text-sm text-muted-foreground">
          Check browser console for detailed logs
        </div>
      </div>
    </div>
  );
}
