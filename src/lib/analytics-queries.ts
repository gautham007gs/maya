import 'server-only';
import { getMysqlClient } from './mysql-client';
import { getQuotaDateString } from './quota-date';

function startBoundary(startDate: string): string {
  return startDate.includes('T') ? startDate : `${startDate}T00:00:00Z`;
}

export async function getDeviceBreakdownAggregated(startDate = '1970-01-01T00:00:00Z'): Promise<{ mobile: number; desktop: number; tablet: number }> {
  const db = await getMysqlClient();
  const [rows]: any = await db.query(
    `SELECT device_type, COUNT(*) AS cnt FROM user_analytics WHERE created_at >= ? GROUP BY device_type`,
    [startBoundary(startDate)],
  );
  const counts: Record<string, number> = {};
  let total = 0;
  for (const row of rows || []) {
    const key = String(row.device_type || 'unknown');
    counts[key] = Number(row.cnt) || 0;
    total += counts[key];
  }
  if (!total) return { mobile: 0, desktop: 0, tablet: 0 };
  return {
    mobile: Math.round(((counts.mobile || 0) / total) * 100),
    desktop: Math.round(((counts.desktop || 0) / total) * 100),
    tablet: Math.round(((counts.tablet || 0) / total) * 100),
  };
}

export async function getTopCountriesAggregated(startDate = '1970-01-01T00:00:00Z', limit = 5) {
  const db = await getMysqlClient();
  const [rows]: any = await db.query(
    `SELECT country_name AS country, COUNT(*) AS users
     FROM user_analytics
     WHERE created_at >= ? AND country_name IS NOT NULL AND country_name != ''
     GROUP BY country_name
     ORDER BY users DESC
     LIMIT ?`,
    [startBoundary(startDate), limit],
  );
  return (rows || []).map((r: any) => ({ country: r.country, users: Number(r.users) || 0 }));
}

export async function getPeakHoursAggregated(startDate: string) {
  const db = await getMysqlClient();
  const [rows]: any = await db.query(
    `SELECT HOUR(created_at) AS hour, COUNT(*) AS users
     FROM messages_log
     WHERE created_at >= ?
     GROUP BY HOUR(created_at)
     ORDER BY hour ASC`,
    [startBoundary(startDate)],
  );
  const hourCounts: Record<number, number> = {};
  for (const row of rows || []) hourCounts[Number(row.hour)] = Number(row.users) || 0;
  return Array.from({ length: 24 }, (_, hour) => ({
    hour,
    hourFormatted: `${hour.toString().padStart(2, '0')}:00`,
    timeLabel: hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`,
    users: hourCounts[hour] || 0,
  }));
}

export async function getTopPagesAggregated(startDate: string, limit = 5) {
  const db = await getMysqlClient();
  const [rows]: any = await db.query(
    `SELECT page_path AS page, COUNT(*) AS views
     FROM page_views
     WHERE viewed_at >= ?
     GROUP BY page_path
     ORDER BY views DESC
     LIMIT ?`,
    [startBoundary(startDate), limit],
  );
  return (rows || []).map((r: any) => ({ page: r.page || '/', views: Number(r.views) || 0 }));
}

export async function getSessionMetricsAggregated(startDate: string) {
  const db = await getMysqlClient();
  const [rows]: any = await db.query(
    `SELECT
       AVG(COALESCE(messages_sent, 0)) AS avg_messages,
       AVG(COALESCE(duration_seconds, 0)) AS avg_duration,
       SUM(CASE WHEN COALESCE(messages_sent, 0) <= 1 THEN 1 ELSE 0 END) AS bounce_sessions,
       COUNT(*) AS total_sessions
     FROM user_sessions
     WHERE started_at >= ?`,
    [startBoundary(startDate)],
  );
  const row = (rows || [])[0] || {};
  const total = Number(row.total_sessions) || 0;
  if (!total) {
    return { averageMessagesPerSession: 0, averageSessionLength: 0, bounceRate: 0, retentionRate: 0 };
  }
  const bounceRate = (Number(row.bounce_sessions) / total) * 100;
  return {
    averageMessagesPerSession: parseFloat(Number(row.avg_messages || 0).toFixed(1)),
    averageSessionLength: parseFloat((Number(row.avg_duration || 0) / 60).toFixed(1)),
    bounceRate: parseFloat(bounceRate.toFixed(1)),
    retentionRate: parseFloat((100 - bounceRate).toFixed(1)),
  };
}

export async function getLanguageDistributionAggregated(startDate: string, limit = 10) {
  const db = await getMysqlClient();
  const [rows]: any = await db.query(
    `SELECT language, COUNT(*) AS messages
     FROM user_analytics
     WHERE created_at >= ? AND language IS NOT NULL AND language != ''
     GROUP BY language
     ORDER BY messages DESC
     LIMIT ?`,
    [startBoundary(startDate), limit],
  );
  const total = (rows || []).reduce((s: number, r: any) => s + (Number(r.messages) || 0), 0);
  return (rows || []).map((r: any) => ({
    language: r.language,
    messages: Number(r.messages) || 0,
    percentage: total ? Number((((Number(r.messages) || 0) / total) * 100).toFixed(1)) : 0,
  }));
}

export async function getRepeatUsersAggregated(startDate: string): Promise<number> {
  const db = await getMysqlClient();
  const [rows]: any = await db.query(
    `SELECT COUNT(*) AS repeat_users FROM (
       SELECT user_pseudo_id FROM daily_activity_log
       WHERE activity_date >= ?
       GROUP BY user_pseudo_id
       HAVING COUNT(DISTINCT activity_date) > 1
     ) t`,
    [startDate.slice(0, 10)],
  );
  return Number((rows || [])[0]?.repeat_users) || 0;
}

export async function getAiResponseMetricsAggregated(startDate: string) {
  const db = await getMysqlClient();
  const [rows]: any = await db.query(
    `SELECT AVG(duration_ms) AS average, COUNT(*) AS samples
     FROM ai_response_times
     WHERE created_at >= ? AND duration_ms > 0`,
    [startBoundary(startDate)],
  );
  const row = (rows || [])[0] || {};
  return {
    average: Math.round(Number(row.average) || 0),
    samples: Number(row.samples) || 0,
  };
}

export async function getOverviewCountsAggregated(startDate: string) {
  const db = await getMysqlClient();
  const [[msgRows], [dauRows]]: any = await Promise.all([
    db.query(
      `SELECT DATE(created_at) AS d, COUNT(*) AS messages
       FROM messages_log WHERE created_at >= ?
       GROUP BY DATE(created_at) ORDER BY d ASC`,
      [startBoundary(startDate)],
    ),
    db.query(
      `SELECT activity_date AS d, COUNT(DISTINCT user_pseudo_id) AS users
       FROM daily_activity_log WHERE activity_date >= ?
       GROUP BY activity_date ORDER BY d ASC`,
      [startDate.slice(0, 10)],
    ),
  ]);
  return {
    messagesByDay: Object.fromEntries((msgRows || []).map((r: any) => [String(r.d), Number(r.messages) || 0])),
    usersByDay: Object.fromEntries((dauRows || []).map((r: any) => [String(r.d), Number(r.users) || 0])),
  };
}

export async function getOverviewTotals(startDate: string) {
  const db = await getMysqlClient();
  const [[msgRows], [userRows], [todayRows], [chatUsersRows]]: any = await Promise.all([
    db.query(`SELECT COUNT(*) AS total FROM messages_log WHERE created_at >= ?`, [startBoundary(startDate)]),
    db.query(`SELECT COUNT(DISTINCT user_pseudo_id) AS total FROM daily_activity_log WHERE activity_date >= ?`, [startDate.slice(0, 10)]),
    db.query(
      `SELECT COUNT(*) AS msgs_today, SUM(CASE WHEN has_image = 1 THEN 1 ELSE 0 END) AS images_today
       FROM messages_log WHERE DATE(created_at) = CURDATE() AND sender_type = 'user'`,
    ),
    db.query(
      `SELECT COUNT(DISTINCT user_pseudo_id) AS chatted_today
       FROM daily_activity_log
       WHERE activity_date = ? AND chat_id IS NOT NULL`,
      [getQuotaDateString()],
    ),
  ]);
  return {
    totalMessages: Number(msgRows?.[0]?.total) || 0,
    totalUsers: Number(userRows?.[0]?.total) || 0,
    todayMessages: Number(todayRows?.[0]?.msgs_today) || 0,
    imagesSharedToday: Number(todayRows?.[0]?.images_today) || 0,
    todayChattedUsers: Number(chatUsersRows?.[0]?.chatted_today) || 0,
  };
}

export async function getTodayActiveSessionsAggregated(): Promise<number> {
  const db = await getMysqlClient();
  const [rows]: any = await db.query(
    `SELECT COUNT(DISTINCT user_pseudo_id) AS users
     FROM daily_activity_log
     WHERE activity_date = ?`,
    [getQuotaDateString()],
  );
  return Number((rows || [])[0]?.users) || 0;
}

export async function getRealtimeSessionCountsAggregated(): Promise<{
  sessionsStartedLast15Minutes: number;
  sessionsStartedLast24Hours: number;
}> {
  const db = await getMysqlClient();
  const now = Date.now();
  const last15Minutes = new Date(now - 15 * 60 * 1000).toISOString();
  const last24Hours = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const [rows]: any = await db.query(
    `SELECT
       COUNT(DISTINCT CASE
         WHEN started_at >= ? AND is_active = 1 THEN session_id
       END) AS sessions_15m,
       COUNT(DISTINCT session_id) AS sessions_24h
     FROM user_sessions
     WHERE started_at >= ?`,
    [last15Minutes, last24Hours],
  );
  return {
    sessionsStartedLast15Minutes: Number((rows || [])[0]?.sessions_15m) || 0,
    sessionsStartedLast24Hours: Number((rows || [])[0]?.sessions_24h) || 0,
  };
}

export async function getMessageBreakdownAggregated(startDate: string) {
  const db = await getMysqlClient();
  const [rows]: any = await db.query(
    `SELECT
       SUM(CASE WHEN sender_type = 'user' THEN 1 ELSE 0 END) AS user_msgs,
       SUM(CASE WHEN sender_type = 'ai' THEN 1 ELSE 0 END) AS ai_msgs,
       SUM(CASE WHEN has_image = 1 THEN 1 ELSE 0 END) AS image_msgs,
       COUNT(*) AS total
     FROM messages_log
     WHERE created_at >= ?`,
    [startBoundary(startDate)],
  );
  const row = (rows || [])[0] || {};
  return {
    user: Number(row.user_msgs) || 0,
    ai: Number(row.ai_msgs) || 0,
    withImages: Number(row.image_msgs) || 0,
    total: Number(row.total) || 0,
  };
}

export async function getHourlyDistributionAggregated(startDate: string) {
  const db = await getMysqlClient();
  const [rows]: any = await db.query(
    `SELECT HOUR(created_at) AS hour, COUNT(*) AS messages
     FROM messages_log
     WHERE created_at >= ?
     GROUP BY HOUR(created_at)`,
    [startBoundary(startDate)],
  );
  const counts: Record<number, number> = {};
  for (const row of rows || []) counts[Number(row.hour)] = Number(row.messages) || 0;
  return Array.from({ length: 24 }, (_, hour) => ({
    hour,
    messages: counts[hour] || 0,
    users: Math.ceil((counts[hour] || 0) * 0.7),
  }));
}
