import express from 'express';
import { executeQuery, DB_PREFIX } from '../config/database.js';

const router = express.Router();

// GET /api/logs/login-activity
// Returns login activity trend for the last 7 days
router.get('/login-activity', async (req, res) => {
    try {
        const { days = 7 } = req.query;
        const daysCount = Math.min(parseInt(days), 30); // Max 30 days

        // Calculate date range using WIB timezone (UTC+7)
        const now = new Date();
        // Adjust for WIB timezone (UTC+7)
        const wibOffset = 7 * 60 * 60 * 1000; // 7 hours in milliseconds
        const nowWIB = new Date(now.getTime() + wibOffset);

        // Get today's date in WIB
        const todayStr = nowWIB.toISOString().split('T')[0];
        const today = new Date(todayStr + 'T00:00:00Z');

        // Calculate start date (daysCount-1 days before today)
        const startDate = new Date(today);
        startDate.setUTCDate(startDate.getUTCDate() - (daysCount - 1));

        const startTimestamp = Math.floor(startDate.getTime() / 1000);

        // More flexible login detection - Moodle uses different patterns
        const loginQuery = `
      SELECT 
        DATE(FROM_UNIXTIME(timecreated)) as date,
        COUNT(*) as login_count,
        COUNT(DISTINCT userid) as unique_users
      FROM ${DB_PREFIX}logstore_standard_log
      WHERE timecreated >= ${startTimestamp}
        AND (
          (action = 'loggedin' AND target = 'user')
          OR (action = 'loggedin')
          OR (eventname LIKE '%loggedin%')
          OR (eventname = '\\\\core\\\\event\\\\user_loggedin')
        )
      GROUP BY DATE(FROM_UNIXTIME(timecreated))
      ORDER BY date ASC
    `;

        const loginResult = await executeQuery(loginQuery);

        if (!loginResult.success) {
            return res.status(500).json({ error: 'Failed to fetch login activity', details: loginResult.error });
        }

        // Fill in missing dates with zero counts
        const dateMap = new Map();
        loginResult.data.forEach(row => {
            // Handle date as string or Date object
            const dateKey = row.date instanceof Date
                ? row.date.toISOString().split('T')[0]
                : String(row.date);
            dateMap.set(dateKey, {
                date: dateKey,
                login_count: parseInt(row.login_count) || 0,
                unique_users: parseInt(row.unique_users) || 0
            });
        });

        // Generate all dates from startDate to today (using UTC)
        const result = [];
        for (let i = 0; i < daysCount; i++) {
            const date = new Date(startDate);
            date.setUTCDate(startDate.getUTCDate() + i);
            const dateStr = date.toISOString().split('T')[0];

            if (dateMap.has(dateStr)) {
                result.push(dateMap.get(dateStr));
            } else {
                result.push({
                    date: dateStr,
                    login_count: 0,
                    unique_users: 0
                });
            }
        }

        res.json({
            period: `Last ${daysCount} days`,
            data: result
        });

    } catch (error) {
        console.error('Login activity error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/logs/recent
// Returns recent activity logs
router.get('/recent', async (req, res) => {
    try {
        const { limit = 50 } = req.query;

        const limitVal = parseInt(limit);
        const logsQuery = `
      SELECT 
        l.id,
        l.timecreated,
        l.action,
        l.target,
        l.objecttable,
        l.component,
        u.firstname,
        u.lastname,
        c.fullname as course_name
      FROM ${DB_PREFIX}logstore_standard_log l
      LEFT JOIN ${DB_PREFIX}user u ON l.userid = u.id
      LEFT JOIN ${DB_PREFIX}course c ON l.courseid = c.id
      ORDER BY l.timecreated DESC
      LIMIT ${limitVal}
    `;

        const logsResult = await executeQuery(logsQuery);

        if (!logsResult.success) {
            return res.status(500).json({ error: 'Failed to fetch logs', details: logsResult.error });
        }

        res.json({
            logs: logsResult.data
        });

    } catch (error) {
        console.error('Recent logs error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
