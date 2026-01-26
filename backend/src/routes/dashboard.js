import express from 'express';
import { executeQuery, DB_PREFIX } from '../config/database.js';

const router = express.Router();

// GET /api/dashboard/overview
// Returns total active users, total courses, and today's activities
router.get('/overview', async (req, res) => {
  try {
    // Total active users (not deleted and confirmed)
    const usersQuery = `
      SELECT COUNT(*) as total 
      FROM ${DB_PREFIX}user 
      WHERE deleted = 0 AND confirmed = 1 AND suspended = 0
    `;
    const usersResult = await executeQuery(usersQuery);

    // Total courses (visible and not deleted)
    const coursesQuery = `
      SELECT COUNT(*) as total 
      FROM ${DB_PREFIX}course 
      WHERE visible = 1 AND id != 1
    `;
    const coursesResult = await executeQuery(coursesQuery);

    // Today's activities from log
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = Math.floor(today.getTime() / 1000);

    const activitiesQuery = `
      SELECT COUNT(*) as total 
      FROM ${DB_PREFIX}logstore_standard_log 
      WHERE timecreated >= ?
    `;
    const activitiesResult = await executeQuery(activitiesQuery, [todayTimestamp]);

    // Total enrollments
    const enrollmentsQuery = `
      SELECT COUNT(*) as total 
      FROM ${DB_PREFIX}user_enrolments ue
      JOIN ${DB_PREFIX}enrol e ON ue.enrolid = e.id
      WHERE ue.status = 0
    `;
    const enrollmentsResult = await executeQuery(enrollmentsQuery);

    if (!usersResult.success || !coursesResult.success || !activitiesResult.success) {
      return res.status(500).json({
        error: 'Failed to fetch dashboard data',
        details: usersResult.error || coursesResult.error || activitiesResult.error
      });
    }

    res.json({
      totalUsers: usersResult.data[0]?.total || 0,
      totalCourses: coursesResult.data[0]?.total || 0,
      todayActivities: activitiesResult.data[0]?.total || 0,
      totalEnrollments: enrollmentsResult.data[0]?.total || 0
    });

  } catch (error) {
    console.error('Dashboard overview error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
