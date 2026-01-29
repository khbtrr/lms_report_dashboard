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

// GET /api/logs/recent-activity
// Returns recent activity logs formatted for dashboard display
router.get('/recent-activity', async (req, res) => {
    try {
        const { limit = 10 } = req.query;
        const limitVal = parseInt(limit);

        // Get recent activities from Moodle logs with meaningful events
        const activityQuery = `
            SELECT 
                l.id,
                l.timecreated,
                l.action,
                l.target,
                l.objecttable,
                l.component,
                l.eventname,
                l.ip,
                u.firstname,
                u.lastname,
                c.fullname as course_name
            FROM ${DB_PREFIX}logstore_standard_log l
            LEFT JOIN ${DB_PREFIX}user u ON l.userid = u.id
            LEFT JOIN ${DB_PREFIX}course c ON l.courseid = c.id
            WHERE l.userid > 0
            ORDER BY l.timecreated DESC
            LIMIT ${limitVal}
        `;

        const result = await executeQuery(activityQuery);

        if (!result.success) {
            return res.status(500).json({ error: 'Failed to fetch recent activity', details: result.error });
        }

        // Format activities for frontend
        const activities = result.data.map(log => {
            const userName = log.firstname && log.lastname
                ? `${log.firstname} ${log.lastname}`
                : 'System';

            // Determine activity type and message
            let type = 'login';
            let message = '';

            if (log.action === 'loggedin' || log.eventname?.includes('loggedin')) {
                type = 'login';
                message = `User '${userName}' logged in from ${log.ip || 'unknown IP'}`;
            } else if (log.action === 'loggedout' || log.eventname?.includes('loggedout')) {
                type = 'login';
                message = `User '${userName}' logged out`;
            } else if (log.action === 'created') {
                type = 'update';
                if (log.target === 'course_module' || log.objecttable === 'course_modules') {
                    message = `User '${userName}' created a new module in course '${log.course_name || 'Unknown'}'`;
                } else if (log.target === 'user') {
                    message = `New user '${userName}' was created`;
                } else {
                    message = `User '${userName}' created ${log.target || 'content'}`;
                }
            } else if (log.action === 'updated') {
                type = 'update';
                if (log.target === 'course_module' || log.objecttable === 'course_modules') {
                    message = `User '${userName}' updated a module in course '${log.course_name || 'Unknown'}'`;
                } else if (log.target === 'course') {
                    message = `User '${userName}' updated course '${log.course_name || 'Unknown'}'`;
                } else {
                    message = `User '${userName}' updated ${log.target || 'content'}`;
                }
            } else if (log.action === 'assigned' || log.action === 'unassigned') {
                type = 'permission';
                message = `Role ${log.action} for user '${userName}'`;
            } else if (log.action === 'viewed') {
                type = 'login';
                if (log.target === 'course') {
                    message = `User '${userName}' viewed course '${log.course_name || 'Unknown'}'`;
                } else {
                    message = `User '${userName}' viewed ${log.target || 'content'}`;
                }
            } else if (log.component === 'tool_recyclebin' || log.action === 'deleted') {
                type = 'backup';
                message = `User '${userName}' deleted ${log.target || 'content'}`;
            } else {
                // Generic fallback
                message = `User '${userName}' performed ${log.action} on ${log.target || 'system'}`;
            }

            // Format time
            const timestamp = log.timecreated * 1000;
            const now = Date.now();
            const diff = now - timestamp;

            let timeStr;
            const minutes = Math.floor(diff / 60000);
            const hours = Math.floor(diff / 3600000);
            const days = Math.floor(diff / 86400000);

            if (minutes < 1) {
                timeStr = 'Just now';
            } else if (minutes < 60) {
                timeStr = `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
            } else if (hours < 24) {
                timeStr = `${hours} hour${hours > 1 ? 's' : ''} ago`;
            } else if (days === 1) {
                const date = new Date(timestamp);
                timeStr = `Yesterday, ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
            } else if (days < 7) {
                timeStr = `${days} day${days > 1 ? 's' : ''} ago`;
            } else {
                const date = new Date(timestamp);
                timeStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            }

            return {
                id: log.id,
                type,
                message,
                time: timeStr,
                timestamp: log.timecreated
            };
        });

        res.json({ activities });

    } catch (error) {
        console.error('Recent activity error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;

