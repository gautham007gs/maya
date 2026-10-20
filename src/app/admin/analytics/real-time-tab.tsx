'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Activity, MessageSquare, Clock, Users } from 'lucide-react';

interface RealTimeTabProps {
  newRealTimeStats: {
    sessionQualityMetrics: {
      averageMessagesPerSession: number;
      averageSessionLength: number;
      bounceRate: number;
      retentionRate: number;
    };
    apiCostMetrics: {
      totalCost: number;
      costPerUser: number;
      tokenUsage: number;
      cacheHitRate: number;
    };
  };
  peakHours: Array<{ hour: number; users: number }>;
  sessionsStartedLast15Minutes: number;
  aiResponseTime: number;
}

// ⚠️ This component intentionally does NOT fetch /api/analytics itself.
// The parent (AnalyticsDashboard) already fetches realtime data and passes
// it down via props. Adding a second fetch here would fire a third concurrent
// SELECT on messages_log (alongside the parent's overview + realtime calls),
// exhausting the 5-connection MySQL pool and freezing the browser.
export function RealTimeTab({ newRealTimeStats, peakHours: _peakHours, sessionsStartedLast15Minutes, aiResponseTime }: RealTimeTabProps) {
  const sessionMetrics = newRealTimeStats?.sessionQualityMetrics ?? {
    averageMessagesPerSession: 0,
    averageSessionLength: 0,
    bounceRate: 0,
    retentionRate: 0,
  };

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {sessionsStartedLast15Minutes}
            </div>
            <p className="text-xs text-muted-foreground">Marked active; session start was in the last 15 minutes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Messages/Session</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {sessionMetrics.averageMessagesPerSession.toFixed(1)}
            </div>
            <p className="text-xs text-muted-foreground">Real message count</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Session Length</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {sessionMetrics.averageSessionLength.toFixed(1)}m
            </div>
            <p className="text-xs text-blue-600">Real session data</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Retention Rate</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sessionMetrics.retentionRate.toFixed(1)}%</div>
            <p className="text-xs text-green-600">From real sessions</p>
          </CardContent>
        </Card>
      </div>

      {/* Session Quality Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Session Quality</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm">
                <span>Avg Messages/Session</span>
                <span className="font-bold">{sessionMetrics.averageMessagesPerSession.toFixed(1)}</span>
              </div>
              <Progress value={Math.min(100, sessionMetrics.averageMessagesPerSession * 5)} className="mt-2" />
            </div>
            <div>
              <div className="flex justify-between text-sm">
                <span>Avg Session Length</span>
                <span className="font-bold">{sessionMetrics.averageSessionLength.toFixed(1)}m</span>
              </div>
              <Progress value={Math.min(100, sessionMetrics.averageSessionLength * 3)} className="mt-2" />
            </div>
            <div>
              <div className="flex justify-between text-sm">
                <span>Bounce Rate</span>
                <span className="font-bold text-red-600">{sessionMetrics.bounceRate.toFixed(1)}%</span>
              </div>
              <Progress value={sessionMetrics.bounceRate} className="mt-2" />
            </div>
            <div>
              <div className="flex justify-between text-sm">
                <span>Retention Rate</span>
                <span className="font-bold text-green-600">{sessionMetrics.retentionRate.toFixed(1)}%</span>
              </div>
              <Progress value={sessionMetrics.retentionRate} className="mt-2" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>AI Performance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm">
                <span>Avg response time</span>
                <span className="font-bold">{aiResponseTime > 0 ? `${aiResponseTime}ms` : '—'}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {aiResponseTime > 0 ? 'Measured from chat requests' : 'No measured responses yet'}
              </p>
            </div>
            <div>
              <div className="flex justify-between text-sm">
                <span>Provider cost</span>
                <span className="font-bold">—</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Not recorded by the current provider APIs</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Status */}
      <Card className="bg-gradient-to-r from-green-50 to-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="h-5 w-5 text-green-600" />
            <span>System Status</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-green-600">🟢</div>
              <div className="text-sm">AI Services</div>
              <div className="text-xs text-muted-foreground">Operational</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">🟢</div>
              <div className="text-sm">Database</div>
              <div className="text-xs text-muted-foreground">Healthy</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">🟢</div>
              <div className="text-sm">Performance</div>
              <div className="text-xs text-muted-foreground">Good</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">🟢</div>
              <div className="text-sm">Analytics</div>
              <div className="text-xs text-muted-foreground">Live</div>
            </div>
          </div>
          <div className="mt-4 text-center text-xs text-muted-foreground">
            Data refreshes every 30 seconds from parent dashboard
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
