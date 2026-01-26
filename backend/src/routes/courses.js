import express from 'express';
import { executeQuery, DB_PREFIX } from '../config/database.js';

const router = express.Router();

// GET /api/courses
// Returns list of courses with participant count and completion rate
router.get('/', async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '' } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        // Get courses with enrollment count
        let coursesQuery = `
      SELECT 
        c.id,
        c.fullname,
        c.shortname,
        c.visible,
        c.timecreated,
        cat.name as category_name,
        (
          SELECT COUNT(DISTINCT ue.userid) 
          FROM ${DB_PREFIX}enrol e 
          JOIN ${DB_PREFIX}user_enrolments ue ON e.id = ue.enrolid 
          WHERE e.courseid = c.id AND ue.status = 0
        ) as enrolled_count,
        (
          SELECT COUNT(DISTINCT cc.userid) 
          FROM ${DB_PREFIX}course_completions cc 
          WHERE cc.course = c.id AND cc.timecompleted IS NOT NULL
        ) as completed_count
      FROM ${DB_PREFIX}course c
      LEFT JOIN ${DB_PREFIX}course_categories cat ON c.category = cat.id
      WHERE c.id != 1
    `;

        const params = [];

        if (search) {
            coursesQuery += ` AND (c.fullname LIKE ? OR c.shortname LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`);
        }

        const limitVal = parseInt(limit);
        const offsetVal = offset;
        coursesQuery += ` ORDER BY c.fullname ASC LIMIT ${limitVal} OFFSET ${offsetVal}`;

        const coursesResult = await executeQuery(coursesQuery, params);

        // Get total count for pagination
        let countQuery = `SELECT COUNT(*) as total FROM ${DB_PREFIX}course WHERE id != 1`;
        const countParams = [];

        if (search) {
            countQuery += ` AND (fullname LIKE ? OR shortname LIKE ?)`;
            countParams.push(`%${search}%`, `%${search}%`);
        }

        const countResult = await executeQuery(countQuery, countParams);

        if (!coursesResult.success) {
            return res.status(500).json({ error: 'Failed to fetch courses', details: coursesResult.error });
        }

        // Calculate completion percentage
        const courses = coursesResult.data.map(course => ({
            ...course,
            completion_rate: course.enrolled_count > 0
                ? Math.round((course.completed_count / course.enrolled_count) * 100)
                : 0
        }));

        res.json({
            courses,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: countResult.data[0]?.total || 0,
                totalPages: Math.ceil((countResult.data[0]?.total || 0) / parseInt(limit))
            }
        });

    } catch (error) {
        console.error('Courses list error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/courses/:id
// Returns detailed course information
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const courseQuery = `
      SELECT 
        c.id,
        c.fullname,
        c.shortname,
        c.summary,
        c.visible,
        c.startdate,
        c.enddate,
        c.timecreated,
        cat.name as category_name
      FROM ${DB_PREFIX}course c
      LEFT JOIN ${DB_PREFIX}course_categories cat ON c.category = cat.id
      WHERE c.id = ?
    `;

        const courseResult = await executeQuery(courseQuery, [id]);

        if (!courseResult.success || courseResult.data.length === 0) {
            return res.status(404).json({ error: 'Course not found' });
        }

        res.json(courseResult.data[0]);

    } catch (error) {
        console.error('Course detail error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
