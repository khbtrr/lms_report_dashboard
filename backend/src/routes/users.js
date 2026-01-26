import express from 'express';
import { executeQuery, DB_PREFIX } from '../config/database.js';

const router = express.Router();

// GET /api/users/search
// Search users by name or email
router.get('/search', async (req, res) => {
  try {
    const { q = '', page = 1, limit = 10 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    if (!q || q.length < 2) {
      return res.json({ users: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } });
    }

    const limitVal = parseInt(limit);
    const offsetVal = offset;
    const usersQuery = `
      SELECT 
        u.id,
        u.username,
        u.firstname,
        u.lastname,
        u.email,
        u.lastaccess,
        u.timecreated
      FROM ${DB_PREFIX}user u
      WHERE u.deleted = 0 
        AND u.confirmed = 1
        AND (
          u.username LIKE ? 
          OR u.firstname LIKE ? 
          OR u.lastname LIKE ? 
          OR u.email LIKE ?
          OR CONCAT(u.firstname, ' ', u.lastname) LIKE ?
        )
      ORDER BY u.lastname, u.firstname
      LIMIT ${limitVal} OFFSET ${offsetVal}
    `;

    const searchTerm = `%${q}%`;
    const params = [searchTerm, searchTerm, searchTerm, searchTerm, searchTerm];

    const usersResult = await executeQuery(usersQuery, params);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM ${DB_PREFIX}user u
      WHERE u.deleted = 0 
        AND u.confirmed = 1
        AND (
          u.username LIKE ? 
          OR u.firstname LIKE ? 
          OR u.lastname LIKE ? 
          OR u.email LIKE ?
          OR CONCAT(u.firstname, ' ', u.lastname) LIKE ?
        )
    `;

    const countResult = await executeQuery(countQuery, [searchTerm, searchTerm, searchTerm, searchTerm, searchTerm]);

    if (!usersResult.success) {
      return res.status(500).json({ error: 'Failed to search users', details: usersResult.error });
    }

    res.json({
      users: usersResult.data,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult.data[0]?.total || 0,
        totalPages: Math.ceil((countResult.data[0]?.total || 0) / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('User search error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/users/:id/grades
// Get user grades across all enrolled courses
router.get('/:id/grades', async (req, res) => {
  try {
    const { id } = req.params;

    // Get user info
    const userQuery = `
      SELECT id, username, firstname, lastname, email
      FROM ${DB_PREFIX}user
      WHERE id = ? AND deleted = 0
    `;
    const userResult = await executeQuery(userQuery, [id]);

    if (!userResult.success || userResult.data.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user grades
    const gradesQuery = `
      SELECT 
        c.id as course_id,
        c.fullname as course_name,
        c.shortname as course_shortname,
        gi.itemname as grade_item,
        gg.finalgrade,
        gi.grademax,
        gi.grademin,
        CASE 
          WHEN gi.grademax > 0 THEN ROUND((gg.finalgrade / gi.grademax) * 100, 2)
          ELSE 0
        END as percentage,
        gg.timemodified as graded_at,
        cc.timecompleted as completed_at
      FROM ${DB_PREFIX}grade_grades gg
      JOIN ${DB_PREFIX}grade_items gi ON gg.itemid = gi.id
      JOIN ${DB_PREFIX}course c ON gi.courseid = c.id
      LEFT JOIN ${DB_PREFIX}course_completions cc ON cc.course = c.id AND cc.userid = gg.userid
      WHERE gg.userid = ?
        AND gi.itemtype = 'course'
        AND gg.finalgrade IS NOT NULL
      ORDER BY c.fullname
    `;

    const gradesResult = await executeQuery(gradesQuery, [id]);

    if (!gradesResult.success) {
      return res.status(500).json({ error: 'Failed to fetch grades', details: gradesResult.error });
    }

    // Get enrolled courses
    const enrolledQuery = `
      SELECT 
        c.id as course_id,
        c.fullname as course_name,
        c.shortname as course_shortname,
        ue.timestart as enrolled_at,
        cc.timecompleted as completed_at
      FROM ${DB_PREFIX}user_enrolments ue
      JOIN ${DB_PREFIX}enrol e ON ue.enrolid = e.id
      JOIN ${DB_PREFIX}course c ON e.courseid = c.id
      LEFT JOIN ${DB_PREFIX}course_completions cc ON cc.course = c.id AND cc.userid = ue.userid
      WHERE ue.userid = ? AND ue.status = 0
      ORDER BY c.fullname
    `;

    const enrolledResult = await executeQuery(enrolledQuery, [id]);

    res.json({
      user: userResult.data[0],
      grades: gradesResult.data,
      enrolledCourses: enrolledResult.data || []
    });

  } catch (error) {
    console.error('User grades error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
