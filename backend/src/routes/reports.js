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

// ============================================================
// GET /api/reports/teacher-compliance
// Teacher Compliance Tracker Report
// ============================================================
router.get('/teacher-compliance', async (req, res) => {
    try {
        // Get current month range
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

        const startTimestamp = Math.floor(monthStart.getTime() / 1000);
        const endTimestamp = Math.floor(monthEnd.getTime() / 1000);

        // Previous month for comparison
        const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
        const prevStartTimestamp = Math.floor(prevMonthStart.getTime() / 1000);
        const prevEndTimestamp = Math.floor(prevMonthEnd.getTime() / 1000);

        const monthName = monthStart.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

        // 1. Teacher Compliance Table - Teachers with their courses and activity count
        const teacherComplianceQuery = `
            SELECT 
                u.id as user_id,
                u.firstname,
                u.lastname,
                u.email,
                c.id as course_id,
                c.fullname as course_name,
                c.shortname as course_shortname,
                COUNT(DISTINCT l.id) as activity_count
            FROM ${DB_PREFIX}user u
            INNER JOIN ${DB_PREFIX}role_assignments ra ON u.id = ra.userid
            INNER JOIN ${DB_PREFIX}role r ON ra.roleid = r.id
            INNER JOIN ${DB_PREFIX}context ctx ON ra.contextid = ctx.id AND ctx.contextlevel = 50
            INNER JOIN ${DB_PREFIX}course c ON ctx.instanceid = c.id
            LEFT JOIN ${DB_PREFIX}logstore_standard_log l ON u.id = l.userid 
                AND l.courseid = c.id
                AND l.timecreated BETWEEN ${startTimestamp} AND ${endTimestamp}
                AND (
                    (l.action IN ('created', 'updated', 'uploaded') AND l.target IN ('course_module', 'course_content'))
                    OR (l.component LIKE 'mod_%' AND l.action IN ('created', 'updated'))
                    OR (l.objecttable IN ('resource', 'page', 'url', 'folder', 'book', 'assign', 'quiz', 'forum', 'label'))
                )
            WHERE u.deleted = 0 
                AND r.shortname IN ('teacher', 'editingteacher')
                AND c.id != 1
            GROUP BY u.id, u.firstname, u.lastname, u.email, c.id, c.fullname, c.shortname
            ORDER BY u.lastname, u.firstname, c.fullname
        `;
        const teacherComplianceResult = await executeQuery(teacherComplianceQuery);

        // Process compliance data with status
        const complianceData = (teacherComplianceResult.data || []).map(row => ({
            ...row,
            status: row.activity_count >= 4 ? 'green' : row.activity_count >= 1 ? 'yellow' : 'red',
            status_label: row.activity_count >= 4 ? 'Memenuhi Target' : row.activity_count >= 1 ? 'Perlu Ditingkatkan' : 'Tidak Aktif'
        }));

        // 2. Activity Mix Chart - Static vs Interactive features
        // Static: File, Resource, Page, URL, Folder, Book, Label
        // Interactive: Quiz, Assignment, Forum, Chat, Workshop, Lesson
        const staticActivityQuery = `
            SELECT 
                COUNT(*) as count,
                'static' as type
            FROM ${DB_PREFIX}logstore_standard_log l
            INNER JOIN ${DB_PREFIX}user u ON l.userid = u.id
            INNER JOIN ${DB_PREFIX}role_assignments ra ON u.id = ra.userid
            INNER JOIN ${DB_PREFIX}role r ON ra.roleid = r.id
            WHERE l.timecreated BETWEEN ${startTimestamp} AND ${endTimestamp}
                AND r.shortname IN ('teacher', 'editingteacher')
                AND u.deleted = 0
                AND (
                    l.component IN ('mod_resource', 'mod_page', 'mod_url', 'mod_folder', 'mod_book', 'mod_label')
                    OR l.objecttable IN ('resource', 'page', 'url', 'folder', 'book', 'label')
                )
                AND l.action IN ('created', 'updated', 'uploaded')
        `;
        const staticResult = await executeQuery(staticActivityQuery);

        const interactiveActivityQuery = `
            SELECT 
                COUNT(*) as count,
                'interactive' as type
            FROM ${DB_PREFIX}logstore_standard_log l
            INNER JOIN ${DB_PREFIX}user u ON l.userid = u.id
            INNER JOIN ${DB_PREFIX}role_assignments ra ON u.id = ra.userid
            INNER JOIN ${DB_PREFIX}role r ON ra.roleid = r.id
            WHERE l.timecreated BETWEEN ${startTimestamp} AND ${endTimestamp}
                AND r.shortname IN ('teacher', 'editingteacher')
                AND u.deleted = 0
                AND (
                    l.component IN ('mod_quiz', 'mod_assign', 'mod_forum', 'mod_chat', 'mod_workshop', 'mod_lesson', 'mod_choice', 'mod_feedback')
                    OR l.objecttable IN ('quiz', 'assign', 'forum', 'chat', 'workshop', 'lesson', 'choice', 'feedback')
                )
                AND l.action IN ('created', 'updated')
        `;
        const interactiveResult = await executeQuery(interactiveActivityQuery);

        // Detailed breakdown for chart
        const activityBreakdownQuery = `
            SELECT 
                CASE 
                    WHEN l.component IN ('mod_resource', 'mod_page', 'mod_url', 'mod_folder', 'mod_book', 'mod_label') 
                        OR l.objecttable IN ('resource', 'page', 'url', 'folder', 'book', 'label')
                    THEN 'File/Resource'
                    WHEN l.component = 'mod_quiz' OR l.objecttable = 'quiz' THEN 'Quiz'
                    WHEN l.component = 'mod_assign' OR l.objecttable = 'assign' THEN 'Assignment'
                    WHEN l.component = 'mod_forum' OR l.objecttable = 'forum' THEN 'Forum'
                    ELSE 'Lainnya'
                END as feature_type,
                COUNT(*) as count
            FROM ${DB_PREFIX}logstore_standard_log l
            INNER JOIN ${DB_PREFIX}user u ON l.userid = u.id
            INNER JOIN ${DB_PREFIX}role_assignments ra ON u.id = ra.userid
            INNER JOIN ${DB_PREFIX}role r ON ra.roleid = r.id
            WHERE l.timecreated BETWEEN ${startTimestamp} AND ${endTimestamp}
                AND r.shortname IN ('teacher', 'editingteacher')
                AND u.deleted = 0
                AND l.action IN ('created', 'updated', 'uploaded')
                AND (
                    l.component LIKE 'mod_%'
                    OR l.objecttable IN ('resource', 'page', 'url', 'folder', 'book', 'label', 'quiz', 'assign', 'forum')
                )
            GROUP BY feature_type
            ORDER BY count DESC
        `;
        const breakdownResult = await executeQuery(activityBreakdownQuery);

        const activityMix = {
            static: parseInt(staticResult.data?.[0]?.count) || 0,
            interactive: parseInt(interactiveResult.data?.[0]?.count) || 0,
            breakdown: breakdownResult.data || []
        };

        // 3. Top 5 Engaged Courses - by student access logs
        const topEngagedCoursesQuery = `
            SELECT 
                c.id as course_id,
                c.fullname as course_name,
                c.shortname as course_shortname,
                COUNT(DISTINCT l.id) as total_access,
                COUNT(DISTINCT l.userid) as unique_students,
                GROUP_CONCAT(DISTINCT CONCAT(u_teacher.firstname, ' ', u_teacher.lastname) SEPARATOR ', ') as teachers
            FROM ${DB_PREFIX}course c
            INNER JOIN ${DB_PREFIX}logstore_standard_log l ON c.id = l.courseid
            INNER JOIN ${DB_PREFIX}user u_student ON l.userid = u_student.id
            INNER JOIN ${DB_PREFIX}role_assignments ra_student ON u_student.id = ra_student.userid
            INNER JOIN ${DB_PREFIX}role r_student ON ra_student.roleid = r_student.id
            INNER JOIN ${DB_PREFIX}context ctx_student ON ra_student.contextid = ctx_student.id 
                AND ctx_student.contextlevel = 50 AND ctx_student.instanceid = c.id
            LEFT JOIN ${DB_PREFIX}context ctx_teacher ON ctx_teacher.instanceid = c.id AND ctx_teacher.contextlevel = 50
            LEFT JOIN ${DB_PREFIX}role_assignments ra_teacher ON ctx_teacher.id = ra_teacher.contextid
            LEFT JOIN ${DB_PREFIX}role r_teacher ON ra_teacher.roleid = r_teacher.id AND r_teacher.shortname IN ('teacher', 'editingteacher')
            LEFT JOIN ${DB_PREFIX}user u_teacher ON ra_teacher.userid = u_teacher.id AND u_teacher.deleted = 0
            WHERE l.timecreated BETWEEN ${startTimestamp} AND ${endTimestamp}
                AND c.id != 1
                AND r_student.shortname = 'student'
                AND u_student.deleted = 0
            GROUP BY c.id, c.fullname, c.shortname
            ORDER BY total_access DESC
            LIMIT 5
        `;
        const topEngagedResult = await executeQuery(topEngagedCoursesQuery);

        // Summary stats - Total teachers
        const totalTeachersQuery = `
            SELECT COUNT(DISTINCT u.id) as total
            FROM ${DB_PREFIX}user u
            INNER JOIN ${DB_PREFIX}role_assignments ra ON u.id = ra.userid
            INNER JOIN ${DB_PREFIX}role r ON ra.roleid = r.id
            WHERE u.deleted = 0 AND r.shortname IN ('teacher', 'editingteacher')
        `;
        const totalTeachersResult = await executeQuery(totalTeachersQuery);
        const totalTeachers = parseInt(totalTeachersResult.data?.[0]?.total) || 0;

        // Active teachers this month
        const activeTeachersQuery = `
            SELECT COUNT(DISTINCT u.id) as count
            FROM ${DB_PREFIX}user u
            INNER JOIN ${DB_PREFIX}role_assignments ra ON u.id = ra.userid
            INNER JOIN ${DB_PREFIX}role r ON ra.roleid = r.id
            INNER JOIN ${DB_PREFIX}logstore_standard_log l ON u.id = l.userid
            WHERE u.deleted = 0 
                AND r.shortname IN ('teacher', 'editingteacher')
                AND l.timecreated BETWEEN ${startTimestamp} AND ${endTimestamp}
                AND l.action IN ('created', 'updated', 'uploaded')
        `;
        const activeTeachersResult = await executeQuery(activeTeachersQuery);
        const activeTeachers = parseInt(activeTeachersResult.data?.[0]?.count) || 0;

        // Total Student Interactions this month
        const studentInteractionsQuery = `
            SELECT COUNT(*) as count
            FROM ${DB_PREFIX}logstore_standard_log l
            INNER JOIN ${DB_PREFIX}user u ON l.userid = u.id
            INNER JOIN ${DB_PREFIX}role_assignments ra ON u.id = ra.userid
            INNER JOIN ${DB_PREFIX}role r ON ra.roleid = r.id
            INNER JOIN ${DB_PREFIX}context ctx ON ra.contextid = ctx.id AND ctx.contextlevel = 50
            WHERE l.timecreated BETWEEN ${startTimestamp} AND ${endTimestamp}
                AND r.shortname = 'student'
                AND u.deleted = 0
        `;
        const studentInteractionsResult = await executeQuery(studentInteractionsQuery);
        const currentInteractions = parseInt(studentInteractionsResult.data?.[0]?.count) || 0;

        // Previous month interactions for comparison
        const prevInteractionsQuery = `
            SELECT COUNT(*) as count
            FROM ${DB_PREFIX}logstore_standard_log l
            INNER JOIN ${DB_PREFIX}user u ON l.userid = u.id
            INNER JOIN ${DB_PREFIX}role_assignments ra ON u.id = ra.userid
            INNER JOIN ${DB_PREFIX}role r ON ra.roleid = r.id
            INNER JOIN ${DB_PREFIX}context ctx ON ra.contextid = ctx.id AND ctx.contextlevel = 50
            WHERE l.timecreated BETWEEN ${prevStartTimestamp} AND ${prevEndTimestamp}
                AND r.shortname = 'student'
                AND u.deleted = 0
        `;
        const prevInteractionsResult = await executeQuery(prevInteractionsQuery);
        const prevInteractions = parseInt(prevInteractionsResult.data?.[0]?.count) || 1;
        const interactionChange = Math.round(((currentInteractions - prevInteractions) / prevInteractions) * 100);

        // Daily Student Engagement Trend
        const dailyTrendQuery = `
            SELECT 
                DATE(FROM_UNIXTIME(l.timecreated)) as date,
                COUNT(DISTINCT l.userid) as unique_users,
                COUNT(*) as total_activities
            FROM ${DB_PREFIX}logstore_standard_log l
            INNER JOIN ${DB_PREFIX}user u ON l.userid = u.id
            INNER JOIN ${DB_PREFIX}role_assignments ra ON u.id = ra.userid
            INNER JOIN ${DB_PREFIX}role r ON ra.roleid = r.id
            WHERE l.timecreated BETWEEN ${startTimestamp} AND ${endTimestamp}
                AND r.shortname = 'student'
                AND u.deleted = 0
            GROUP BY DATE(FROM_UNIXTIME(l.timecreated))
            ORDER BY date ASC
        `;
        const dailyTrendResult = await executeQuery(dailyTrendQuery);
        const dailyTrend = (dailyTrendResult.data || []).map(row => ({
            date: row.date,
            day: new Date(row.date).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' }),
            users: parseInt(row.unique_users) || 0,
            activities: parseInt(row.total_activities) || 0
        }));

        // Calculate compliance stats
        const greenCount = complianceData.filter(d => d.status === 'green').length;
        const yellowCount = complianceData.filter(d => d.status === 'yellow').length;
        const redCount = complianceData.filter(d => d.status === 'red').length;
        const totalEntries = complianceData.length || 1;
        const complianceRate = Math.round((greenCount / totalEntries) * 100);
        const nonCompliantCount = yellowCount + redCount;

        // Calculate activity mix percentages
        const staticCount = activityMix.static;
        const interactiveCount = activityMix.interactive;
        const totalMix = staticCount + interactiveCount || 1;
        activityMix.staticPercentage = Math.round((staticCount / totalMix) * 100);
        activityMix.interactivePercentage = Math.round((interactiveCount / totalMix) * 100);

        res.json({
            period: {
                month: monthName,
                startDate: monthStart.toISOString().split('T')[0],
                endDate: monthEnd.toISOString().split('T')[0]
            },
            summary: {
                totalTeachers: totalTeachers,
                activeTeachers: activeTeachers,
                participationRate: totalTeachers > 0 ? Math.round((activeTeachers / totalTeachers) * 100) : 0,
                complianceRate: complianceRate,
                nonCompliantCount: nonCompliantCount,
                totalStudentInteractions: currentInteractions,
                interactionChange: interactionChange,
                compliance: {
                    green: greenCount,
                    yellow: yellowCount,
                    red: redCount
                }
            },
            teacherCompliance: complianceData,
            activityMix: activityMix,
            dailyEngagement: dailyTrend,
            topEngagedCourses: topEngagedResult.data || []
        });

    } catch (error) {
        console.error('Teacher compliance report error:', error);
        res.status(500).json({ error: 'Failed to generate teacher compliance report' });
    }
});

// ============================================================
// GET /api/reports/teacher-compliance/export
// Export data for PDF generation with date range
// ============================================================
router.get('/teacher-compliance/export', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'startDate and endDate are required' });
        }

        const dateRange = getDateRange(startDate, endDate);
        const { startTimestamp, endTimestamp } = dateRange;

        // 1. Statistik Pengguna
        // Total Pengguna Terdaftar
        const totalUsersQuery = `
            SELECT COUNT(*) as total FROM ${DB_PREFIX}user WHERE deleted = 0
        `;
        const totalUsersResult = await executeQuery(totalUsersQuery);
        const totalUsers = totalUsersResult.data?.[0]?.total || 0;

        // Pengguna Aktif dalam range
        const activeUsersQuery = `
            SELECT COUNT(DISTINCT userid) as total
            FROM ${DB_PREFIX}logstore_standard_log
            WHERE timecreated BETWEEN ? AND ?
        `;
        const activeUsersResult = await executeQuery(activeUsersQuery, [startTimestamp, endTimestamp]);
        const activeUsers = activeUsersResult.data?.[0]?.total || 0;

        // Pengguna Baru Terdaftar dalam range
        const newUsersQuery = `
            SELECT COUNT(*) as total 
            FROM ${DB_PREFIX}user 
            WHERE deleted = 0 AND timecreated BETWEEN ? AND ?
        `;
        const newUsersResult = await executeQuery(newUsersQuery, [startTimestamp, endTimestamp]);
        const newUsers = newUsersResult.data?.[0]?.total || 0;

        // Akun yang Tidak Pernah Login
        const neverLoggedQuery = `
            SELECT COUNT(*) as total 
            FROM ${DB_PREFIX}user 
            WHERE deleted = 0 AND (lastlogin = 0 OR lastlogin IS NULL)
        `;
        const neverLoggedResult = await executeQuery(neverLoggedQuery);
        const neverLogged = neverLoggedResult.data?.[0]?.total || 0;

        const statistikPengguna = [
            { no: 1, keterangan: 'Total Pengguna Terdaftar', jumlah: totalUsers, keteranganTambahan: 'Guru, Siswa, Admin' },
            { no: 2, keterangan: 'Pengguna Aktif Periode Ini', jumlah: activeUsers, keteranganTambahan: 'Yang login minimal 1x' },
            { no: 3, keterangan: 'Pengguna Baru Terdaftar', jumlah: newUsers, keteranganTambahan: 'Siswa/Guru Baru' },
            { no: 4, keterangan: 'Akun yang Tidak Pernah Login', jumlah: neverLogged, keteranganTambahan: 'Dari total pengguna' }
        ];

        // 2. Aktivitas Guru - log aktivitas guru dengan detail per hari
        const teacherActivityQuery = `
            SELECT 
                u.firstname as nama,
                DATE_FORMAT(FROM_UNIXTIME(l.timecreated), '%d-%m-%Y') as tanggal,
                COALESCE(
                    GROUP_CONCAT(
                        DISTINCT 
                        CASE 
                            WHEN l.target = 'course_module' AND l.action = 'created' THEN 'Upload Materi'
                            WHEN l.component LIKE 'mod_assign%' AND l.action = 'created' THEN 'Membuat Penugasan'
                            WHEN l.component LIKE 'mod_quiz%' AND l.action = 'created' THEN 'Membuat Kuis'
                            WHEN l.action = 'graded' THEN 'Memberi Nilai'
                            ELSE NULL
                        END
                        SEPARATOR ', '
                    ),
                    'Mengakses LMS'
                ) as aktivitas,
                GROUP_CONCAT(DISTINCT c.shortname SEPARATOR ', ') as kelas
            FROM ${DB_PREFIX}logstore_standard_log l
            INNER JOIN ${DB_PREFIX}user u ON l.userid = u.id
            INNER JOIN ${DB_PREFIX}course c ON l.courseid = c.id AND c.id > 1
            INNER JOIN ${DB_PREFIX}role_assignments ra ON u.id = ra.userid
            INNER JOIN ${DB_PREFIX}role r ON ra.roleid = r.id
            WHERE l.timecreated BETWEEN ? AND ?
            AND r.shortname IN ('teacher', 'editingteacher')
            AND u.deleted = 0
            AND l.courseid > 1
            GROUP BY u.id, DATE_FORMAT(FROM_UNIXTIME(l.timecreated), '%d-%m-%Y')
            ORDER BY tanggal DESC, nama ASC
            LIMIT 200
        `;
        const teacherActivityResult = await executeQuery(teacherActivityQuery, [startTimestamp, endTimestamp]);
        const aktivitasGuru = (teacherActivityResult.data || []).map((row, idx) => ({
            no: idx + 1,
            nama: row.nama,
            tanggal: row.tanggal,
            aktivitas: row.aktivitas || 'Mengakses LMS',
            kelas: row.kelas || '-'
        }));

        // 3. Aktivitas Kursus - materi dan tugas baru per kursus
        const courseActivityQuery = `
            SELECT 
                c.fullname as namaKelas,
                COUNT(DISTINCT CASE 
                    WHEN m.name IN ('resource', 'url', 'page', 'folder') 
                    AND cm.added BETWEEN ? AND ?
                    THEN cm.id 
                END) as jumlahMateriBaru,
                COUNT(DISTINCT CASE 
                    WHEN m.name IN ('assign', 'quiz') 
                    AND cm.added BETWEEN ? AND ?
                    THEN cm.id 
                END) as jumlahTugasKuisBaru,
                (
                    SELECT GROUP_CONCAT(DISTINCT u2.firstname SEPARATOR ', ')
                    FROM ${DB_PREFIX}context ctx2
                    INNER JOIN ${DB_PREFIX}role_assignments ra2 ON ra2.contextid = ctx2.id
                    INNER JOIN ${DB_PREFIX}role r2 ON ra2.roleid = r2.id
                    INNER JOIN ${DB_PREFIX}user u2 ON ra2.userid = u2.id
                    WHERE ctx2.instanceid = c.id 
                    AND ctx2.contextlevel = 50
                    AND r2.shortname IN ('teacher', 'editingteacher')
                    AND u2.deleted = 0
                ) as guru
            FROM ${DB_PREFIX}course c
            LEFT JOIN ${DB_PREFIX}course_modules cm ON c.id = cm.course
            LEFT JOIN ${DB_PREFIX}modules m ON cm.module = m.id
            WHERE c.visible = 1 AND c.id > 1 AND c.fullname NOT LIKE '%TEKNOLOGI PENDIDIKAN%'
            GROUP BY c.id
            HAVING jumlahMateriBaru > 0 OR jumlahTugasKuisBaru > 0
            ORDER BY (jumlahMateriBaru + jumlahTugasKuisBaru) DESC
            LIMIT 50
        `;
        const courseActivityResult = await executeQuery(courseActivityQuery, [startTimestamp, endTimestamp, startTimestamp, endTimestamp]);
        const aktivitasKursus = (courseActivityResult.data || []).map((row, idx) => ({
            no: idx + 1,
            namaKelas: row.namaKelas,
            jumlahMateriBaru: row.jumlahMateriBaru || 0,
            jumlahTugasKuisBaru: row.jumlahTugasKuisBaru || 0,
            guru: row.guru || '-'
        }));

        res.json({
            period: {
                startDate: dateRange.startDate,
                endDate: dateRange.endDate
            },
            statistikPengguna,
            aktivitasGuru,
            aktivitasKursus
        });

    } catch (error) {
        console.error('Export report error:', error);
        res.status(500).json({ error: 'Failed to generate export data' });
    }
});

export default router;

