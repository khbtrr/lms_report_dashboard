import express from 'express';
import { executeQuery, DB_PREFIX } from '../config/database.js';

const router = express.Router();

// Helper function to get timestamp from date string
function getTimestamp(dateStr) {
    return Math.floor(new Date(dateStr).getTime() / 1000);
}

// Helper function to get date range timestamps (default: last 30 days)
function getDateRange(startDate, endDate) {
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    const start = startDate ? new Date(startDate) : new Date(end);
    if (!startDate) {
        start.setDate(start.getDate() - 30);
    }
    start.setHours(0, 0, 0, 0);

    return {
        startTimestamp: Math.floor(start.getTime() / 1000),
        endTimestamp: Math.floor(end.getTime() / 1000),
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0]
    };
}

// ============================================================
// GET /api/reports/user-statistics
// Statistik Pengguna (User Statistics Report)
// ============================================================
router.get('/user-statistics', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const dateRange = getDateRange(startDate, endDate);

        // 1. Total pengguna terdaftar
        const totalRegisteredQuery = `
            SELECT COUNT(*) as total
            FROM ${DB_PREFIX}user
            WHERE deleted = 0 AND confirmed = 1
        `;
        const totalRegisteredResult = await executeQuery(totalRegisteredQuery);

        // 2. Total pengguna aktif per role
        const usersByRoleQuery = `
            SELECT 
                r.shortname as role,
                r.name as role_name,
                COUNT(DISTINCT ra.userid) as total
            FROM ${DB_PREFIX}role r
            LEFT JOIN ${DB_PREFIX}role_assignments ra ON r.id = ra.roleid
            LEFT JOIN ${DB_PREFIX}user u ON ra.userid = u.id AND u.deleted = 0 AND u.suspended = 0
            GROUP BY r.id, r.shortname, r.name
            ORDER BY total DESC
        `;
        const usersByRoleResult = await executeQuery(usersByRoleQuery);

        // 3. Pengguna baru per periode
        const newUsersQuery = `
            SELECT 
                DATE(FROM_UNIXTIME(timecreated)) as date,
                COUNT(*) as new_users
            FROM ${DB_PREFIX}user
            WHERE deleted = 0 
                AND confirmed = 1
                AND timecreated BETWEEN ${dateRange.startTimestamp} AND ${dateRange.endTimestamp}
            GROUP BY DATE(FROM_UNIXTIME(timecreated))
            ORDER BY date ASC
        `;
        const newUsersResult = await executeQuery(newUsersQuery);

        // 4. Pengguna terakhir login (recent logins)
        const recentLoginsQuery = `
            SELECT 
                u.id,
                u.username,
                u.firstname,
                u.lastname,
                u.email,
                FROM_UNIXTIME(u.lastaccess) as last_access
            FROM ${DB_PREFIX}user u
            WHERE u.deleted = 0 
                AND u.confirmed = 1
                AND u.lastaccess > 0
            ORDER BY u.lastaccess DESC
            LIMIT 20
        `;
        const recentLoginsResult = await executeQuery(recentLoginsQuery);

        // 5. Akun yang tidak pernah login
        const neverLoggedInQuery = `
            SELECT 
                u.id,
                u.username,
                u.firstname,
                u.lastname,
                u.email,
                FROM_UNIXTIME(u.timecreated) as created_at
            FROM ${DB_PREFIX}user u
            WHERE u.deleted = 0 
                AND u.confirmed = 1
                AND (u.lastaccess = 0 OR u.lastaccess IS NULL)
            ORDER BY u.timecreated DESC
            LIMIT 50
        `;
        const neverLoggedInResult = await executeQuery(neverLoggedInQuery);

        // 6. Count never logged in users
        const neverLoggedInCountQuery = `
            SELECT COUNT(*) as total
            FROM ${DB_PREFIX}user u
            WHERE u.deleted = 0 
                AND u.confirmed = 1
                AND (u.lastaccess = 0 OR u.lastaccess IS NULL)
        `;
        const neverLoggedInCountResult = await executeQuery(neverLoggedInCountQuery);

        // 7. Distribusi pengguna per kursus (top 10)
        const usersPerCourseQuery = `
            SELECT 
                c.id as course_id,
                c.fullname as course_name,
                c.shortname as course_shortname,
                COUNT(DISTINCT ue.userid) as enrolled_users
            FROM ${DB_PREFIX}course c
            LEFT JOIN ${DB_PREFIX}enrol e ON c.id = e.courseid
            LEFT JOIN ${DB_PREFIX}user_enrolments ue ON e.id = ue.enrolid AND ue.status = 0
            WHERE c.id != 1
            GROUP BY c.id, c.fullname, c.shortname
            ORDER BY enrolled_users DESC
            LIMIT 10
        `;
        const usersPerCourseResult = await executeQuery(usersPerCourseQuery);

        res.json({
            period: {
                startDate: dateRange.startDate,
                endDate: dateRange.endDate
            },
            summary: {
                totalRegistered: totalRegisteredResult.data[0]?.total || 0,
                neverLoggedIn: neverLoggedInCountResult.data[0]?.total || 0
            },
            usersByRole: usersByRoleResult.data || [],
            newUsersOverTime: newUsersResult.data || [],
            recentLogins: recentLoginsResult.data || [],
            neverLoggedInUsers: neverLoggedInResult.data || [],
            usersPerCourse: usersPerCourseResult.data || []
        });

    } catch (error) {
        console.error('User statistics report error:', error);
        res.status(500).json({ error: 'Failed to generate user statistics report' });
    }
});

// ============================================================
// GET /api/reports/teacher-activity
// Laporan Aktivitas Guru (Teacher Activity Report)
// ============================================================
router.get('/teacher-activity', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const dateRange = getDateRange(startDate, endDate);

        // 1. Teacher login frequency
        const teacherLoginsQuery = `
            SELECT 
                u.id as user_id,
                u.firstname,
                u.lastname,
                u.email,
                COUNT(DISTINCT DATE(FROM_UNIXTIME(l.timecreated))) as login_days,
                COUNT(*) as total_logins,
                MAX(FROM_UNIXTIME(l.timecreated)) as last_login
            FROM ${DB_PREFIX}user u
            INNER JOIN ${DB_PREFIX}role_assignments ra ON u.id = ra.userid
            INNER JOIN ${DB_PREFIX}role r ON ra.roleid = r.id
            LEFT JOIN ${DB_PREFIX}logstore_standard_log l ON u.id = l.userid 
                AND l.timecreated BETWEEN ${dateRange.startTimestamp} AND ${dateRange.endTimestamp}
                AND (l.action = 'loggedin' OR l.eventname LIKE '%loggedin%')
            WHERE u.deleted = 0 
                AND r.shortname IN ('teacher', 'editingteacher', 'manager', 'coursecreator')
            GROUP BY u.id, u.firstname, u.lastname, u.email
            ORDER BY total_logins DESC
            LIMIT 50
        `;
        const teacherLoginsResult = await executeQuery(teacherLoginsQuery);

        // 2. Upload materi (file/resource creation)
        const uploadMaterialQuery = `
            SELECT 
                u.id as user_id,
                u.firstname,
                u.lastname,
                COUNT(*) as uploads,
                l.component,
                l.objecttable
            FROM ${DB_PREFIX}logstore_standard_log l
            INNER JOIN ${DB_PREFIX}user u ON l.userid = u.id
            INNER JOIN ${DB_PREFIX}role_assignments ra ON u.id = ra.userid
            INNER JOIN ${DB_PREFIX}role r ON ra.roleid = r.id
            WHERE l.timecreated BETWEEN ${dateRange.startTimestamp} AND ${dateRange.endTimestamp}
                AND l.action = 'created'
                AND (l.component LIKE '%resource%' OR l.component LIKE '%mod_resource%' OR l.component LIKE '%mod_folder%' OR l.component LIKE '%mod_url%')
                AND r.shortname IN ('teacher', 'editingteacher', 'manager', 'coursecreator')
                AND u.deleted = 0
            GROUP BY u.id, u.firstname, u.lastname, l.component, l.objecttable
            ORDER BY uploads DESC
            LIMIT 50
        `;
        const uploadMaterialResult = await executeQuery(uploadMaterialQuery);

        // 3. Create assignments
        const createAssignmentQuery = `
            SELECT 
                u.id as user_id,
                u.firstname,
                u.lastname,
                COUNT(*) as assignments_created
            FROM ${DB_PREFIX}logstore_standard_log l
            INNER JOIN ${DB_PREFIX}user u ON l.userid = u.id
            INNER JOIN ${DB_PREFIX}role_assignments ra ON u.id = ra.userid
            INNER JOIN ${DB_PREFIX}role r ON ra.roleid = r.id
            WHERE l.timecreated BETWEEN ${dateRange.startTimestamp} AND ${dateRange.endTimestamp}
                AND l.action = 'created'
                AND (l.component = 'mod_assign' OR l.objecttable = 'assign')
                AND r.shortname IN ('teacher', 'editingteacher', 'manager', 'coursecreator')
                AND u.deleted = 0
            GROUP BY u.id, u.firstname, u.lastname
            ORDER BY assignments_created DESC
            LIMIT 50
        `;
        const createAssignmentResult = await executeQuery(createAssignmentQuery);

        // 4. Create quiz
        const createQuizQuery = `
            SELECT 
                u.id as user_id,
                u.firstname,
                u.lastname,
                COUNT(*) as quizzes_created
            FROM ${DB_PREFIX}logstore_standard_log l
            INNER JOIN ${DB_PREFIX}user u ON l.userid = u.id
            INNER JOIN ${DB_PREFIX}role_assignments ra ON u.id = ra.userid
            INNER JOIN ${DB_PREFIX}role r ON ra.roleid = r.id
            WHERE l.timecreated BETWEEN ${dateRange.startTimestamp} AND ${dateRange.endTimestamp}
                AND l.action = 'created'
                AND (l.component = 'mod_quiz' OR l.objecttable = 'quiz')
                AND r.shortname IN ('teacher', 'editingteacher', 'manager', 'coursecreator')
                AND u.deleted = 0
            GROUP BY u.id, u.firstname, u.lastname
            ORDER BY quizzes_created DESC
            LIMIT 50
        `;
        const createQuizResult = await executeQuery(createQuizQuery);

        // 5. Grading activity
        const gradingQuery = `
            SELECT 
                u.id as user_id,
                u.firstname,
                u.lastname,
                COUNT(*) as grades_given
            FROM ${DB_PREFIX}logstore_standard_log l
            INNER JOIN ${DB_PREFIX}user u ON l.userid = u.id
            INNER JOIN ${DB_PREFIX}role_assignments ra ON u.id = ra.userid
            INNER JOIN ${DB_PREFIX}role r ON ra.roleid = r.id
            WHERE l.timecreated BETWEEN ${dateRange.startTimestamp} AND ${dateRange.endTimestamp}
                AND (l.action = 'graded' OR l.target = 'grade' OR l.component = 'core_grades')
                AND r.shortname IN ('teacher', 'editingteacher', 'manager', 'coursecreator')
                AND u.deleted = 0
            GROUP BY u.id, u.firstname, u.lastname
            ORDER BY grades_given DESC
            LIMIT 50
        `;
        const gradingResult = await executeQuery(gradingQuery);

        // 6. Total activity summary per teacher
        const totalActivityQuery = `
            SELECT 
                u.id as user_id,
                u.firstname,
                u.lastname,
                u.email,
                COUNT(*) as total_activities,
                COUNT(DISTINCT DATE(FROM_UNIXTIME(l.timecreated))) as active_days
            FROM ${DB_PREFIX}logstore_standard_log l
            INNER JOIN ${DB_PREFIX}user u ON l.userid = u.id
            INNER JOIN ${DB_PREFIX}role_assignments ra ON u.id = ra.userid
            INNER JOIN ${DB_PREFIX}role r ON ra.roleid = r.id
            WHERE l.timecreated BETWEEN ${dateRange.startTimestamp} AND ${dateRange.endTimestamp}
                AND r.shortname IN ('teacher', 'editingteacher', 'manager', 'coursecreator')
                AND u.deleted = 0
            GROUP BY u.id, u.firstname, u.lastname, u.email
            ORDER BY total_activities DESC
            LIMIT 50
        `;
        const totalActivityResult = await executeQuery(totalActivityQuery);

        res.json({
            period: {
                startDate: dateRange.startDate,
                endDate: dateRange.endDate
            },
            teacherLogins: teacherLoginsResult.data || [],
            materialUploads: uploadMaterialResult.data || [],
            assignmentsCreated: createAssignmentResult.data || [],
            quizzesCreated: createQuizResult.data || [],
            gradingActivity: gradingResult.data || [],
            totalActivitySummary: totalActivityResult.data || []
        });

    } catch (error) {
        console.error('Teacher activity report error:', error);
        res.status(500).json({ error: 'Failed to generate teacher activity report' });
    }
});

// ============================================================
// GET /api/reports/student-activity
// Laporan Aktivitas Siswa (Student Activity Report)
// ============================================================
router.get('/student-activity', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const dateRange = getDateRange(startDate, endDate);

        // 1. Student login frequency
        const studentLoginsQuery = `
            SELECT 
                u.id as user_id,
                u.firstname,
                u.lastname,
                u.email,
                COUNT(DISTINCT DATE(FROM_UNIXTIME(l.timecreated))) as login_days,
                COUNT(*) as total_logins,
                MAX(FROM_UNIXTIME(l.timecreated)) as last_login
            FROM ${DB_PREFIX}user u
            INNER JOIN ${DB_PREFIX}role_assignments ra ON u.id = ra.userid
            INNER JOIN ${DB_PREFIX}role r ON ra.roleid = r.id
            LEFT JOIN ${DB_PREFIX}logstore_standard_log l ON u.id = l.userid 
                AND l.timecreated BETWEEN ${dateRange.startTimestamp} AND ${dateRange.endTimestamp}
                AND (l.action = 'loggedin' OR l.eventname LIKE '%loggedin%')
            WHERE u.deleted = 0 
                AND r.shortname = 'student'
            GROUP BY u.id, u.firstname, u.lastname, u.email
            ORDER BY total_logins DESC
            LIMIT 50
        `;
        const studentLoginsResult = await executeQuery(studentLoginsQuery);

        // 2. Assignment submissions
        const submissionsQuery = `
            SELECT 
                u.id as user_id,
                u.firstname,
                u.lastname,
                COUNT(*) as submissions
            FROM ${DB_PREFIX}logstore_standard_log l
            INNER JOIN ${DB_PREFIX}user u ON l.userid = u.id
            INNER JOIN ${DB_PREFIX}role_assignments ra ON u.id = ra.userid
            INNER JOIN ${DB_PREFIX}role r ON ra.roleid = r.id
            WHERE l.timecreated BETWEEN ${dateRange.startTimestamp} AND ${dateRange.endTimestamp}
                AND (l.action = 'submitted' OR l.target = 'submission' OR (l.component = 'mod_assign' AND l.action = 'created'))
                AND r.shortname = 'student'
                AND u.deleted = 0
            GROUP BY u.id, u.firstname, u.lastname
            ORDER BY submissions DESC
            LIMIT 50
        `;
        const submissionsResult = await executeQuery(submissionsQuery);

        // 3. Quiz attempts
        const quizAttemptsQuery = `
            SELECT 
                u.id as user_id,
                u.firstname,
                u.lastname,
                COUNT(*) as quiz_attempts
            FROM ${DB_PREFIX}logstore_standard_log l
            INNER JOIN ${DB_PREFIX}user u ON l.userid = u.id
            INNER JOIN ${DB_PREFIX}role_assignments ra ON u.id = ra.userid
            INNER JOIN ${DB_PREFIX}role r ON ra.roleid = r.id
            WHERE l.timecreated BETWEEN ${dateRange.startTimestamp} AND ${dateRange.endTimestamp}
                AND l.component = 'mod_quiz'
                AND (l.action = 'attempted' OR l.action = 'submitted' OR l.target = 'attempt')
                AND r.shortname = 'student'
                AND u.deleted = 0
            GROUP BY u.id, u.firstname, u.lastname
            ORDER BY quiz_attempts DESC
            LIMIT 50
        `;
        const quizAttemptsResult = await executeQuery(quizAttemptsQuery);

        // 4. Course completion progress
        const courseProgressQuery = `
            SELECT 
                u.id as user_id,
                u.firstname,
                u.lastname,
                u.email,
                COUNT(DISTINCT cc.course) as courses_completed,
                COUNT(DISTINCT ue.enrolid) as courses_enrolled
            FROM ${DB_PREFIX}user u
            INNER JOIN ${DB_PREFIX}role_assignments ra ON u.id = ra.userid
            INNER JOIN ${DB_PREFIX}role r ON ra.roleid = r.id
            LEFT JOIN ${DB_PREFIX}user_enrolments ue ON u.id = ue.userid AND ue.status = 0
            LEFT JOIN ${DB_PREFIX}course_completions cc ON u.id = cc.userid AND cc.timecompleted IS NOT NULL
            WHERE u.deleted = 0 
                AND r.shortname = 'student'
            GROUP BY u.id, u.firstname, u.lastname, u.email
            HAVING courses_enrolled > 0
            ORDER BY courses_completed DESC
            LIMIT 50
        `;
        const courseProgressResult = await executeQuery(courseProgressQuery);

        // 5. Grade summary (average grade per student)
        const gradeSummaryQuery = `
            SELECT 
                u.id as user_id,
                u.firstname,
                u.lastname,
                COUNT(DISTINCT gi.courseid) as courses_with_grades,
                ROUND(AVG(
                    CASE WHEN gi.grademax > 0 THEN (gg.finalgrade / gi.grademax) * 100 ELSE 0 END
                ), 2) as average_percentage
            FROM ${DB_PREFIX}user u
            INNER JOIN ${DB_PREFIX}role_assignments ra ON u.id = ra.userid
            INNER JOIN ${DB_PREFIX}role r ON ra.roleid = r.id
            INNER JOIN ${DB_PREFIX}grade_grades gg ON u.id = gg.userid
            INNER JOIN ${DB_PREFIX}grade_items gi ON gg.itemid = gi.id AND gi.itemtype = 'course'
            WHERE u.deleted = 0 
                AND r.shortname = 'student'
                AND gg.finalgrade IS NOT NULL
            GROUP BY u.id, u.firstname, u.lastname
            ORDER BY average_percentage DESC
            LIMIT 50
        `;
        const gradeSummaryResult = await executeQuery(gradeSummaryQuery);

        // 6. Total activity per student
        const totalActivityQuery = `
            SELECT 
                u.id as user_id,
                u.firstname,
                u.lastname,
                COUNT(*) as total_activities,
                COUNT(DISTINCT DATE(FROM_UNIXTIME(l.timecreated))) as active_days
            FROM ${DB_PREFIX}logstore_standard_log l
            INNER JOIN ${DB_PREFIX}user u ON l.userid = u.id
            INNER JOIN ${DB_PREFIX}role_assignments ra ON u.id = ra.userid
            INNER JOIN ${DB_PREFIX}role r ON ra.roleid = r.id
            WHERE l.timecreated BETWEEN ${dateRange.startTimestamp} AND ${dateRange.endTimestamp}
                AND r.shortname = 'student'
                AND u.deleted = 0
            GROUP BY u.id, u.firstname, u.lastname
            ORDER BY total_activities DESC
            LIMIT 50
        `;
        const totalActivityResult = await executeQuery(totalActivityQuery);

        res.json({
            period: {
                startDate: dateRange.startDate,
                endDate: dateRange.endDate
            },
            studentLogins: studentLoginsResult.data || [],
            assignmentSubmissions: submissionsResult.data || [],
            quizAttempts: quizAttemptsResult.data || [],
            courseProgress: courseProgressResult.data || [],
            gradeSummary: gradeSummaryResult.data || [],
            totalActivitySummary: totalActivityResult.data || []
        });

    } catch (error) {
        console.error('Student activity report error:', error);
        res.status(500).json({ error: 'Failed to generate student activity report' });
    }
});

// ============================================================
// GET /api/reports/course-activity
// Laporan Aktivitas Kursus/Kelas (Course Activity Report)
// ============================================================
router.get('/course-activity', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const dateRange = getDateRange(startDate, endDate);

        // 1. Activity per course
        const courseActivityQuery = `
            SELECT 
                c.id as course_id,
                c.fullname as course_name,
                c.shortname as course_shortname,
                COUNT(*) as total_activities,
                COUNT(DISTINCT l.userid) as unique_users,
                COUNT(DISTINCT DATE(FROM_UNIXTIME(l.timecreated))) as active_days
            FROM ${DB_PREFIX}course c
            LEFT JOIN ${DB_PREFIX}logstore_standard_log l ON c.id = l.courseid 
                AND l.timecreated BETWEEN ${dateRange.startTimestamp} AND ${dateRange.endTimestamp}
            WHERE c.id != 1
            GROUP BY c.id, c.fullname, c.shortname
            ORDER BY total_activities DESC
            LIMIT 20
        `;
        const courseActivityResult = await executeQuery(courseActivityQuery);

        // 2. Enrollment trends (new enrollments per day)
        const enrollmentTrendsQuery = `
            SELECT 
                DATE(FROM_UNIXTIME(ue.timecreated)) as date,
                COUNT(*) as new_enrollments
            FROM ${DB_PREFIX}user_enrolments ue
            WHERE ue.timecreated BETWEEN ${dateRange.startTimestamp} AND ${dateRange.endTimestamp}
            GROUP BY DATE(FROM_UNIXTIME(ue.timecreated))
            ORDER BY date ASC
        `;
        const enrollmentTrendsResult = await executeQuery(enrollmentTrendsQuery);

        // 3. Completion rates per course
        const completionRatesQuery = `
            SELECT 
                c.id as course_id,
                c.fullname as course_name,
                c.shortname as course_shortname,
                COUNT(DISTINCT ue.userid) as enrolled_count,
                COUNT(DISTINCT cc.userid) as completed_count,
                CASE 
                    WHEN COUNT(DISTINCT ue.userid) > 0 
                    THEN ROUND((COUNT(DISTINCT cc.userid) / COUNT(DISTINCT ue.userid)) * 100, 2)
                    ELSE 0 
                END as completion_rate
            FROM ${DB_PREFIX}course c
            LEFT JOIN ${DB_PREFIX}enrol e ON c.id = e.courseid
            LEFT JOIN ${DB_PREFIX}user_enrolments ue ON e.id = ue.enrolid AND ue.status = 0
            LEFT JOIN ${DB_PREFIX}course_completions cc ON c.id = cc.course AND ue.userid = cc.userid AND cc.timecompleted IS NOT NULL
            WHERE c.id != 1
            GROUP BY c.id, c.fullname, c.shortname
            HAVING enrolled_count > 0
            ORDER BY completion_rate DESC
            LIMIT 20
        `;
        const completionRatesResult = await executeQuery(completionRatesQuery);

        // 4. Most active courses (by activity in period)
        const mostActiveCoursesQuery = `
            SELECT 
                c.id as course_id,
                c.fullname as course_name,
                c.shortname as course_shortname,
                cat.name as category_name,
                COUNT(*) as total_activities,
                COUNT(DISTINCT l.userid) as unique_users
            FROM ${DB_PREFIX}logstore_standard_log l
            INNER JOIN ${DB_PREFIX}course c ON l.courseid = c.id
            LEFT JOIN ${DB_PREFIX}course_categories cat ON c.category = cat.id
            WHERE l.timecreated BETWEEN ${dateRange.startTimestamp} AND ${dateRange.endTimestamp}
                AND c.id != 1
            GROUP BY c.id, c.fullname, c.shortname, cat.name
            ORDER BY total_activities DESC
            LIMIT 10
        `;
        const mostActiveCoursesResult = await executeQuery(mostActiveCoursesQuery);

        // 5. Course summary stats
        const summaryQuery = `
            SELECT 
                (SELECT COUNT(*) FROM ${DB_PREFIX}course WHERE id != 1) as total_courses,
                (SELECT COUNT(*) FROM ${DB_PREFIX}course WHERE id != 1 AND visible = 1) as visible_courses,
                (SELECT COUNT(DISTINCT cc.course) FROM ${DB_PREFIX}course_completions cc WHERE cc.timecompleted IS NOT NULL) as courses_with_completions
        `;
        const summaryResult = await executeQuery(summaryQuery);

        res.json({
            period: {
                startDate: dateRange.startDate,
                endDate: dateRange.endDate
            },
            summary: summaryResult.data[0] || {},
            courseActivity: courseActivityResult.data || [],
            enrollmentTrends: enrollmentTrendsResult.data || [],
            completionRates: completionRatesResult.data || [],
            mostActiveCourses: mostActiveCoursesResult.data || []
        });

    } catch (error) {
        console.error('Course activity report error:', error);
        res.status(500).json({ error: 'Failed to generate course activity report' });
    }
});

export default router;
