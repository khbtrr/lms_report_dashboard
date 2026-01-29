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
        // Count from course_modules table for more accurate results
        const staticActivityQuery = `
            SELECT 
                COUNT(*) as count,
                'static' as type
            FROM ${DB_PREFIX}course_modules cm
            INNER JOIN ${DB_PREFIX}modules m ON cm.module = m.id
            WHERE m.name IN ('resource', 'page', 'url', 'folder', 'book', 'label')
                AND cm.added BETWEEN ${startTimestamp} AND ${endTimestamp}
                AND cm.visible = 1
        `;
        const staticResult = await executeQuery(staticActivityQuery);

        const interactiveActivityQuery = `
            SELECT 
                COUNT(*) as count,
                'interactive' as type
            FROM ${DB_PREFIX}course_modules cm
            INNER JOIN ${DB_PREFIX}modules m ON cm.module = m.id
            WHERE m.name IN ('quiz', 'assign', 'forum', 'chat', 'workshop', 'lesson', 'choice', 'feedback')
                AND cm.added BETWEEN ${startTimestamp} AND ${endTimestamp}
                AND cm.visible = 1
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
                (
                    SELECT GROUP_CONCAT(DISTINCT u_t.firstname SEPARATOR ', ')
                    FROM ${DB_PREFIX}context ctx_t
                    INNER JOIN ${DB_PREFIX}role_assignments ra_t ON ctx_t.id = ra_t.contextid
                    INNER JOIN ${DB_PREFIX}role r_t ON ra_t.roleid = r_t.id
                    INNER JOIN ${DB_PREFIX}user u_t ON ra_t.userid = u_t.id
                    WHERE ctx_t.instanceid = c.id 
                    AND ctx_t.contextlevel = 50
                    AND r_t.shortname IN ('teacher', 'editingteacher')
                    AND u_t.deleted = 0
                ) as teachers
            FROM ${DB_PREFIX}course c
            INNER JOIN ${DB_PREFIX}logstore_standard_log l ON c.id = l.courseid
            INNER JOIN ${DB_PREFIX}user u_student ON l.userid = u_student.id
            INNER JOIN ${DB_PREFIX}role_assignments ra_student ON u_student.id = ra_student.userid
            INNER JOIN ${DB_PREFIX}role r_student ON ra_student.roleid = r_student.id
            INNER JOIN ${DB_PREFIX}context ctx_student ON ra_student.contextid = ctx_student.id 
                AND ctx_student.contextlevel = 50 AND ctx_student.instanceid = c.id
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

// ============================================================
// GET /api/reports/executive-summary
// Ringkasan Eksekutif untuk Kepala Sekolah/Yayasan
// ============================================================
router.get('/executive-summary', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const dateRange = getDateRange(startDate, endDate);

        // ===== 1. Tingkat Adopsi LMS =====
        // Course aktif vs total course
        const courseAdoptionQuery = `
            SELECT 
                COUNT(DISTINCT c.id) as total_courses,
                COUNT(DISTINCT CASE 
                    WHEN cm.id IS NOT NULL THEN c.id 
                    ELSE NULL 
                END) as active_courses
            FROM ${DB_PREFIX}course c
            LEFT JOIN ${DB_PREFIX}course_modules cm ON c.id = cm.course AND cm.visible = 1
            WHERE c.id > 1 AND c.visible = 1
        `;
        const adoptionResult = await executeQuery(courseAdoptionQuery);
        const totalCourses = parseInt(adoptionResult.data?.[0]?.total_courses) || 0;
        const activeCourses = parseInt(adoptionResult.data?.[0]?.active_courses) || 0;
        const adoptionRate = totalCourses > 0 ? Math.round((activeCourses / totalCourses) * 100) : 0;

        // ===== 2. Partisipasi Pengguna (DAU & Login Trends) =====
        // Daily Active Users today
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayTimestamp = Math.floor(todayStart.getTime() / 1000);

        const dauQuery = `
            SELECT COUNT(DISTINCT userid) as dau
            FROM ${DB_PREFIX}logstore_standard_log
            WHERE timecreated >= ${todayTimestamp}
        `;
        const dauResult = await executeQuery(dauQuery);
        const dailyActiveUsers = parseInt(dauResult.data?.[0]?.dau) || 0;

        // Weekly login trends (last 7 days)
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const weekTimestamp = Math.floor(weekAgo.getTime() / 1000);

        const loginTrendsQuery = `
            SELECT 
                DATE(FROM_UNIXTIME(timecreated)) as date,
                COUNT(*) as login_count,
                COUNT(DISTINCT userid) as unique_users
            FROM ${DB_PREFIX}logstore_standard_log
            WHERE timecreated >= ${weekTimestamp}
                AND (action = 'loggedin' OR eventname LIKE '%loggedin%')
            GROUP BY DATE(FROM_UNIXTIME(timecreated))
            ORDER BY date ASC
        `;
        const loginTrendsResult = await executeQuery(loginTrendsQuery);

        // ===== 3. Rata-rata Ketuntasan (Completion Rate) =====
        const completionQuery = `
            SELECT 
                COUNT(DISTINCT ue.userid) as total_enrolled,
                COUNT(DISTINCT cc.userid) as total_completed
            FROM ${DB_PREFIX}user_enrolments ue
            INNER JOIN ${DB_PREFIX}enrol e ON ue.enrolid = e.id
            LEFT JOIN ${DB_PREFIX}course_completions cc ON e.courseid = cc.course AND ue.userid = cc.userid AND cc.timecompleted IS NOT NULL
            WHERE ue.status = 0
        `;
        const completionResult = await executeQuery(completionQuery);
        const totalEnrolled = parseInt(completionResult.data?.[0]?.total_enrolled) || 0;
        const totalCompleted = parseInt(completionResult.data?.[0]?.total_completed) || 0;
        const completionRate = totalEnrolled > 0 ? Math.round((totalCompleted / totalEnrolled) * 100) : 0;

        // ===== 4. Distribusi Nilai per Kategori/Level =====
        const gradeDistributionQuery = `
            SELECT 
                CASE 
                    WHEN (gg.finalgrade / gi.grademax * 100) >= 90 THEN 'A (90-100)'
                    WHEN (gg.finalgrade / gi.grademax * 100) >= 80 THEN 'B (80-89)'
                    WHEN (gg.finalgrade / gi.grademax * 100) >= 70 THEN 'C (70-79)'
                    WHEN (gg.finalgrade / gi.grademax * 100) >= 60 THEN 'D (60-69)'
                    ELSE 'E (<60)'
                END as grade_range,
                COUNT(*) as count
            FROM ${DB_PREFIX}grade_grades gg
            INNER JOIN ${DB_PREFIX}grade_items gi ON gg.itemid = gi.id
            WHERE gi.itemtype = 'course' 
                AND gg.finalgrade IS NOT NULL 
                AND gi.grademax > 0
            GROUP BY grade_range
            ORDER BY 
                CASE grade_range 
                    WHEN 'A (90-100)' THEN 1
                    WHEN 'B (80-89)' THEN 2
                    WHEN 'C (70-79)' THEN 3
                    WHEN 'D (60-69)' THEN 4
                    ELSE 5
                END
        `;
        const gradeResult = await executeQuery(gradeDistributionQuery);

        // Grade per category (department)
        const gradePerCategoryQuery = `
            SELECT 
                cat.name as category_name,
                ROUND(AVG(gg.finalgrade / gi.grademax * 100), 1) as avg_grade,
                COUNT(DISTINCT gg.userid) as student_count
            FROM ${DB_PREFIX}grade_grades gg
            INNER JOIN ${DB_PREFIX}grade_items gi ON gg.itemid = gi.id
            INNER JOIN ${DB_PREFIX}course c ON gi.courseid = c.id
            INNER JOIN ${DB_PREFIX}course_categories cat ON c.category = cat.id
            WHERE gi.itemtype = 'course' 
                AND gg.finalgrade IS NOT NULL 
                AND gi.grademax > 0
            GROUP BY cat.id, cat.name
            ORDER BY avg_grade DESC
            LIMIT 10
        `;
        const gradePerCategoryResult = await executeQuery(gradePerCategoryQuery);

        // ===== 5. Aktivitas Terpopuler =====
        const popularActivitiesQuery = `
            SELECT 
                m.name as activity_type,
                CASE m.name
                    WHEN 'quiz' THEN 'Kuis'
                    WHEN 'assign' THEN 'Tugas'
                    WHEN 'forum' THEN 'Forum'
                    WHEN 'resource' THEN 'File/Resource'
                    WHEN 'page' THEN 'Halaman'
                    WHEN 'url' THEN 'URL/Link'
                    WHEN 'h5pactivity' THEN 'H5P Interaktif'
                    WHEN 'lesson' THEN 'Lesson'
                    WHEN 'book' THEN 'Buku'
                    WHEN 'folder' THEN 'Folder'
                    WHEN 'choice' THEN 'Polling'
                    WHEN 'feedback' THEN 'Feedback'
                    ELSE m.name
                END as activity_label,
                COUNT(DISTINCT cm.id) as total_modules,
                COUNT(DISTINCT l.id) as total_access
            FROM ${DB_PREFIX}modules m
            LEFT JOIN ${DB_PREFIX}course_modules cm ON m.id = cm.module AND cm.visible = 1
            LEFT JOIN ${DB_PREFIX}logstore_standard_log l ON cm.id = l.contextinstanceid 
                AND l.contextlevel = 70 
                AND l.timecreated BETWEEN ${dateRange.startTimestamp} AND ${dateRange.endTimestamp}
            GROUP BY m.id, m.name
            HAVING total_modules > 0
            ORDER BY total_access DESC
            LIMIT 5
        `;
        const popularResult = await executeQuery(popularActivitiesQuery);

        // ===== 6. Partisipasi per Kelas/Kursus =====
        const participationPerClassQuery = `
            SELECT 
                c.fullname as course_name,
                (
                    SELECT GROUP_CONCAT(DISTINCT CONCAT(u_t.firstname, ' ', u_t.lastname) SEPARATOR ', ')
                    FROM ${DB_PREFIX}context ctx_t
                    INNER JOIN ${DB_PREFIX}role_assignments ra_t ON ctx_t.id = ra_t.contextid
                    INNER JOIN ${DB_PREFIX}role r_t ON ra_t.roleid = r_t.id
                    INNER JOIN ${DB_PREFIX}user u_t ON ra_t.userid = u_t.id
                    WHERE ctx_t.instanceid = c.id 
                    AND ctx_t.contextlevel = 50
                    AND r_t.shortname IN ('teacher', 'editingteacher')
                    AND u_t.deleted = 0
                ) as teacher_name,
                COUNT(DISTINCT ue.userid) as enrolled_students,
                COUNT(DISTINCT l.userid) as active_students,
                ROUND(
                    CASE WHEN COUNT(DISTINCT ue.userid) > 0 
                    THEN (COUNT(DISTINCT l.userid) / COUNT(DISTINCT ue.userid)) * 100 
                    ELSE 0 END
                , 1) as participation_rate
            FROM ${DB_PREFIX}course c
            INNER JOIN ${DB_PREFIX}enrol e ON c.id = e.courseid
            INNER JOIN ${DB_PREFIX}user_enrolments ue ON e.id = ue.enrolid AND ue.status = 0
            LEFT JOIN ${DB_PREFIX}logstore_standard_log l ON ue.userid = l.userid 
                AND l.courseid = c.id 
                AND l.timecreated BETWEEN ${dateRange.startTimestamp} AND ${dateRange.endTimestamp}
            WHERE c.visible = 1 AND c.id > 1
            GROUP BY c.id, c.fullname
            HAVING COUNT(DISTINCT ue.userid) > 0
            ORDER BY participation_rate DESC
            LIMIT 10
        `;
        const participationResult = await executeQuery(participationPerClassQuery);

        // ===== 7. KPI Summary Stats =====
        // Total students
        const totalStudentsQuery = `
            SELECT COUNT(DISTINCT u.id) as total
            FROM ${DB_PREFIX}user u
            INNER JOIN ${DB_PREFIX}role_assignments ra ON u.id = ra.userid
            INNER JOIN ${DB_PREFIX}role r ON ra.roleid = r.id
            WHERE u.deleted = 0 AND r.shortname = 'student'
        `;
        const studentsResult = await executeQuery(totalStudentsQuery);
        const totalStudents = parseInt(studentsResult.data?.[0]?.total) || 0;

        // Total teachers
        const totalTeachersQuery = `
            SELECT COUNT(DISTINCT u.id) as total
            FROM ${DB_PREFIX}user u
            INNER JOIN ${DB_PREFIX}role_assignments ra ON u.id = ra.userid
            INNER JOIN ${DB_PREFIX}role r ON ra.roleid = r.id
            WHERE u.deleted = 0 AND r.shortname IN ('teacher', 'editingteacher')
        `;
        const teachersResult = await executeQuery(totalTeachersQuery);
        const totalTeachers = parseInt(teachersResult.data?.[0]?.total) || 0;

        // Average grade school-wide
        const avgGradeQuery = `
            SELECT ROUND(AVG(gg.finalgrade / gi.grademax * 100), 1) as avg_grade
            FROM ${DB_PREFIX}grade_grades gg
            INNER JOIN ${DB_PREFIX}grade_items gi ON gg.itemid = gi.id
            WHERE gi.itemtype = 'course' AND gg.finalgrade IS NOT NULL AND gi.grademax > 0
        `;
        const avgGradeResult = await executeQuery(avgGradeQuery);
        const avgSchoolGrade = parseFloat(avgGradeResult.data?.[0]?.avg_grade) || 0;

        // Digital attendance (users who accessed today)
        const digitalAttendanceQuery = `
            SELECT 
                COUNT(DISTINCT u.id) as total_users,
                COUNT(DISTINCT CASE WHEN u.lastaccess >= ${todayTimestamp} THEN u.id END) as accessed_today
            FROM ${DB_PREFIX}user u
            WHERE u.deleted = 0 AND u.confirmed = 1
        `;
        const attendanceResult = await executeQuery(digitalAttendanceQuery);
        const totalUsers = parseInt(attendanceResult.data?.[0]?.total_users) || 0;
        const accessedToday = parseInt(attendanceResult.data?.[0]?.accessed_today) || 0;
        const digitalAttendanceRate = totalUsers > 0 ? Math.round((accessedToday / totalUsers) * 100) : 0;

        res.json({
            period: {
                startDate: dateRange.startDate,
                endDate: dateRange.endDate
            },
            // KPI Scorecard
            kpiScorecard: {
                totalStudents,
                totalTeachers,
                totalCourses,
                activeCourses,
                dailyActiveUsers,
                avgSchoolGrade,
                completionRate,
                adoptionRate,
                digitalAttendanceRate
            },
            // Charts data
            lmsAdoption: {
                total: totalCourses,
                active: activeCourses,
                percentage: adoptionRate
            },
            loginTrends: loginTrendsResult.data || [],
            completionStats: {
                totalEnrolled,
                totalCompleted,
                rate: completionRate
            },
            gradeDistribution: gradeResult.data || [],
            gradePerCategory: gradePerCategoryResult.data || [],
            popularActivities: popularResult.data || [],
            participationPerClass: participationResult.data || []
        });

    } catch (error) {
        console.error('Executive summary report error:', error);
        res.status(500).json({ error: 'Failed to generate executive summary report' });
    }
});

// ============================================================
// GET /api/reports/teacher-detail-master
// Master View: Tabel Performa Guru untuk Wakasek Kurikulum
// ============================================================
router.get('/teacher-detail-master', async (req, res) => {
    try {
        const { startDate, endDate, category } = req.query;
        const dateRange = getDateRange(startDate, endDate);

        // Timestamp for "last 7 days" untuk status update konten
        const sevenDaysAgo = Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60);
        const threeDaysAgo = Math.floor(Date.now() / 1000) - (3 * 24 * 60 * 60);

        // Main query untuk semua guru dengan data performa
        const teacherMasterQuery = `
            SELECT 
                u.id as user_id,
                u.firstname,
                u.lastname,
                u.email,
                u.lastaccess,
                FROM_UNIXTIME(u.lastaccess) as last_login,
                (
                    SELECT GROUP_CONCAT(DISTINCT c.shortname SEPARATOR ', ')
                    FROM ${DB_PREFIX}context ctx
                    INNER JOIN ${DB_PREFIX}role_assignments ra ON ctx.id = ra.contextid
                    INNER JOIN ${DB_PREFIX}course c ON ctx.instanceid = c.id
                    WHERE ra.userid = u.id 
                    AND ctx.contextlevel = 50
                    AND c.visible = 1 AND c.id > 1
                ) as courses_taught,
                (
                    SELECT GROUP_CONCAT(DISTINCT cat.name SEPARATOR ', ')
                    FROM ${DB_PREFIX}context ctx
                    INNER JOIN ${DB_PREFIX}role_assignments ra ON ctx.id = ra.contextid
                    INNER JOIN ${DB_PREFIX}course c ON ctx.instanceid = c.id
                    INNER JOIN ${DB_PREFIX}course_categories cat ON c.category = cat.id
                    WHERE ra.userid = u.id 
                    AND ctx.contextlevel = 50
                    AND c.visible = 1 AND c.id > 1
                ) as departments,
                (
                    SELECT COUNT(*)
                    FROM ${DB_PREFIX}logstore_standard_log l
                    WHERE l.userid = u.id 
                    AND l.timecreated >= ${sevenDaysAgo}
                    AND l.action IN ('created', 'updated')
                    AND (l.component LIKE 'mod_%' OR l.objecttable IN ('resource', 'page', 'quiz', 'assign', 'forum'))
                ) as content_updates_7days,
                (
                    SELECT COUNT(*)
                    FROM ${DB_PREFIX}assign_submission asub
                    INNER JOIN ${DB_PREFIX}assign a ON asub.assignment = a.id
                    INNER JOIN ${DB_PREFIX}context ctx ON ctx.instanceid = a.course AND ctx.contextlevel = 50
                    INNER JOIN ${DB_PREFIX}role_assignments ra ON ctx.id = ra.contextid AND ra.userid = u.id
                    WHERE asub.status = 'submitted'
                ) as total_submissions,
                (
                    SELECT COUNT(*)
                    FROM ${DB_PREFIX}assign_grades ag
                    INNER JOIN ${DB_PREFIX}assign a ON ag.assignment = a.id
                    INNER JOIN ${DB_PREFIX}context ctx ON ctx.instanceid = a.course AND ctx.contextlevel = 50
                    INNER JOIN ${DB_PREFIX}role_assignments ra ON ctx.id = ra.contextid AND ra.userid = u.id
                    WHERE ag.grader = u.id
                ) as total_graded,
                (
                    SELECT ROUND(AVG(ag.timecreated - asub.timecreated) / 3600, 1)
                    FROM ${DB_PREFIX}assign_grades ag
                    INNER JOIN ${DB_PREFIX}assign_submission asub ON ag.assignment = asub.assignment AND ag.userid = asub.userid
                    INNER JOIN ${DB_PREFIX}assign a ON ag.assignment = a.id
                    INNER JOIN ${DB_PREFIX}context ctx ON ctx.instanceid = a.course AND ctx.contextlevel = 50
                    INNER JOIN ${DB_PREFIX}role_assignments ra ON ctx.id = ra.contextid AND ra.userid = u.id
                    WHERE ag.grader = u.id AND ag.timecreated > asub.timecreated
                ) as avg_response_hours
            FROM ${DB_PREFIX}user u
            INNER JOIN ${DB_PREFIX}role_assignments ra ON u.id = ra.userid
            INNER JOIN ${DB_PREFIX}role r ON ra.roleid = r.id
            WHERE u.deleted = 0 
                AND r.shortname IN ('teacher', 'editingteacher')
            GROUP BY u.id, u.firstname, u.lastname, u.email, u.lastaccess
            ORDER BY u.lastname, u.firstname
        `;

        const teacherResult = await executeQuery(teacherMasterQuery);

        // Process data dengan status warna
        const teachers = (teacherResult.data || []).map(teacher => {
            const lastAccessTimestamp = teacher.lastaccess || 0;
            const totalSubmissions = parseInt(teacher.total_submissions) || 0;
            const totalGraded = parseInt(teacher.total_graded) || 0;
            const gradingPercentage = totalSubmissions > 0
                ? Math.round((totalGraded / totalSubmissions) * 100)
                : 100;

            // Determine status color
            let status = 'green';
            let statusLabel = 'Aktif';

            if (lastAccessTimestamp < threeDaysAgo || lastAccessTimestamp === 0) {
                status = 'red';
                statusLabel = 'Tidak Aktif > 3 Hari';
            } else if (gradingPercentage < 70) {
                status = 'yellow';
                statusLabel = 'Perlu Tindak Lanjut';
            }

            return {
                ...teacher,
                grading_percentage: gradingPercentage,
                status,
                status_label: statusLabel,
                avg_response_hours: teacher.avg_response_hours || 0
            };
        });

        // Get category list for filter
        const categoriesQuery = `
            SELECT DISTINCT cat.id, cat.name
            FROM ${DB_PREFIX}course_categories cat
            INNER JOIN ${DB_PREFIX}course c ON cat.id = c.category
            WHERE c.visible = 1 AND c.id > 1
            ORDER BY cat.name
        `;
        const categoriesResult = await executeQuery(categoriesQuery);

        res.json({
            period: {
                startDate: dateRange.startDate,
                endDate: dateRange.endDate
            },
            teachers,
            categories: categoriesResult.data || [],
            summary: {
                total: teachers.length,
                active: teachers.filter(t => t.status === 'green').length,
                needsAttention: teachers.filter(t => t.status === 'yellow').length,
                inactive: teachers.filter(t => t.status === 'red').length
            }
        });

    } catch (error) {
        console.error('Teacher detail master error:', error);
        res.status(500).json({ error: 'Failed to generate teacher detail master report' });
    }
});

// ============================================================
// GET /api/reports/teacher-detail/:id
// Drill-down View: Profil Performa Individu Guru
// ============================================================
router.get('/teacher-detail/:id', async (req, res) => {
    try {
        const teacherId = parseInt(req.params.id);
        const { startDate, endDate } = req.query;
        const dateRange = getDateRange(startDate, endDate);

        // 1. Basic teacher info
        const teacherInfoQuery = `
            SELECT 
                u.id, u.firstname, u.lastname, u.email, u.lastaccess,
                FROM_UNIXTIME(u.lastaccess) as last_login
            FROM ${DB_PREFIX}user u
            WHERE u.id = ${teacherId}
        `;
        const teacherInfo = await executeQuery(teacherInfoQuery);

        // 2. Courses taught with completion status
        const coursesQuery = `
            SELECT 
                c.id as course_id,
                c.fullname as course_name,
                c.shortname,
                cat.name as category_name,
                (
                    SELECT COUNT(DISTINCT ue.userid)
                    FROM ${DB_PREFIX}enrol e
                    INNER JOIN ${DB_PREFIX}user_enrolments ue ON e.id = ue.enrolid
                    WHERE e.courseid = c.id AND ue.status = 0
                ) as enrolled_students,
                (
                    SELECT COUNT(DISTINCT cc.userid)
                    FROM ${DB_PREFIX}course_completions cc
                    WHERE cc.course = c.id AND cc.timecompleted IS NOT NULL
                ) as completed_students,
                (
                    SELECT COUNT(*)
                    FROM ${DB_PREFIX}course_modules cm
                    WHERE cm.course = c.id AND cm.visible = 1
                ) as total_modules
            FROM ${DB_PREFIX}course c
            INNER JOIN ${DB_PREFIX}context ctx ON c.id = ctx.instanceid AND ctx.contextlevel = 50
            INNER JOIN ${DB_PREFIX}role_assignments ra ON ctx.id = ra.contextid
            INNER JOIN ${DB_PREFIX}role r ON ra.roleid = r.id
            LEFT JOIN ${DB_PREFIX}course_categories cat ON c.category = cat.id
            WHERE ra.userid = ${teacherId}
                AND r.shortname IN ('teacher', 'editingteacher')
                AND c.visible = 1 AND c.id > 1
            GROUP BY c.id, c.fullname, c.shortname, cat.name
        `;
        const coursesResult = await executeQuery(coursesQuery);

        // Process courses with completion percentage
        const courses = (coursesResult.data || []).map(course => ({
            ...course,
            completion_rate: course.enrolled_students > 0
                ? Math.round((course.completed_students / course.enrolled_students) * 100)
                : 0
        }));

        // 3. Radar chart data (kompetensi digital)
        // Keaktifan Forum
        const forumActivityQuery = `
            SELECT COUNT(*) as count
            FROM ${DB_PREFIX}logstore_standard_log l
            WHERE l.userid = ${teacherId}
                AND l.component = 'mod_forum'
                AND l.timecreated BETWEEN ${dateRange.startTimestamp} AND ${dateRange.endTimestamp}
        `;
        const forumResult = await executeQuery(forumActivityQuery);
        const forumActivity = parseInt(forumResult.data?.[0]?.count) || 0;

        // Variasi Konten (different module types created)
        const contentVarietyQuery = `
            SELECT COUNT(DISTINCT l.component) as count
            FROM ${DB_PREFIX}logstore_standard_log l
            WHERE l.userid = ${teacherId}
                AND l.action = 'created'
                AND l.component LIKE 'mod_%'
                AND l.timecreated BETWEEN ${dateRange.startTimestamp} AND ${dateRange.endTimestamp}
        `;
        const varietyResult = await executeQuery(contentVarietyQuery);
        const contentVariety = parseInt(varietyResult.data?.[0]?.count) || 0;

        // Ketepatan Waktu Menilai (average response time)
        const responseTimeQuery = `
            SELECT AVG(ag.timecreated - asub.timecreated) / 3600 as avg_hours
            FROM ${DB_PREFIX}assign_grades ag
            INNER JOIN ${DB_PREFIX}assign_submission asub ON ag.assignment = asub.assignment AND ag.userid = asub.userid
            WHERE ag.grader = ${teacherId}
                AND ag.timecreated BETWEEN ${dateRange.startTimestamp} AND ${dateRange.endTimestamp}
                AND ag.timecreated > asub.timecreated
        `;
        const responseResult = await executeQuery(responseTimeQuery);
        const avgResponseHours = parseFloat(responseResult.data?.[0]?.avg_hours) || 0;

        // Kualitas Kuis (quiz with multiple questions)
        const quizQualityQuery = `
            SELECT COUNT(DISTINCT q.id) as count
            FROM ${DB_PREFIX}quiz q
            INNER JOIN ${DB_PREFIX}course c ON q.course = c.id
            INNER JOIN ${DB_PREFIX}context ctx ON c.id = ctx.instanceid AND ctx.contextlevel = 50
            INNER JOIN ${DB_PREFIX}role_assignments ra ON ctx.id = ra.contextid
            WHERE ra.userid = ${teacherId}
                AND (SELECT COUNT(*) FROM ${DB_PREFIX}quiz_slots qs WHERE qs.quizid = q.id) >= 5
        `;
        const quizResult = await executeQuery(quizQualityQuery);
        const quizQuality = parseInt(quizResult.data?.[0]?.count) || 0;

        // Normalize radar data (0-100 scale)
        const radarData = [
            { subject: 'Keaktifan Forum', value: Math.min(forumActivity * 2, 100), fullMark: 100 },
            { subject: 'Variasi Konten', value: Math.min(contentVariety * 15, 100), fullMark: 100 },
            { subject: 'Ketepatan Nilai', value: avgResponseHours > 0 ? Math.max(100 - (avgResponseHours * 2), 0) : 50, fullMark: 100 },
            { subject: 'Kualitas Kuis', value: Math.min(quizQuality * 20, 100), fullMark: 100 }
        ];

        // 4. Activity heatmap (hour x day of week)
        const heatmapQuery = `
            SELECT 
                DAYOFWEEK(FROM_UNIXTIME(timecreated)) as day_of_week,
                HOUR(FROM_UNIXTIME(timecreated)) as hour_of_day,
                COUNT(*) as activity_count
            FROM ${DB_PREFIX}logstore_standard_log
            WHERE userid = ${teacherId}
                AND timecreated BETWEEN ${dateRange.startTimestamp} AND ${dateRange.endTimestamp}
            GROUP BY day_of_week, hour_of_day
            ORDER BY day_of_week, hour_of_day
        `;
        const heatmapResult = await executeQuery(heatmapQuery);

        // Transform heatmap data
        const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        const heatmapData = [];
        for (let day = 1; day <= 7; day++) {
            for (let hour = 0; hour < 24; hour++) {
                const found = (heatmapResult.data || []).find(
                    h => parseInt(h.day_of_week) === day && parseInt(h.hour_of_day) === hour
                );
                heatmapData.push({
                    day: dayNames[day - 1],
                    dayIndex: day,
                    hour,
                    count: found ? parseInt(found.activity_count) : 0
                });
            }
        }

        res.json({
            teacher: teacherInfo.data?.[0] || null,
            courses,
            radarData,
            heatmapData,
            period: {
                startDate: dateRange.startDate,
                endDate: dateRange.endDate
            }
        });

    } catch (error) {
        console.error('Teacher detail individual error:', error);
        res.status(500).json({ error: 'Failed to generate teacher detail report' });
    }
});

// ============================================================
// GET /api/reports/student-detail-master
// Master View: Daftar Siswa dengan Indikator Risiko
// ============================================================
router.get('/student-detail-master', async (req, res) => {
    try {
        const { startDate, endDate, category } = req.query;
        const dateRange = getDateRange(startDate, endDate);

        const threeDaysAgo = Math.floor(Date.now() / 1000) - (3 * 24 * 60 * 60);
        const sevenDaysAgo = Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60);

        // Query siswa dengan data performa
        const studentMasterQuery = `
            SELECT 
                u.id as user_id,
                u.firstname,
                u.lastname,
                u.email,
                u.lastaccess,
                FROM_UNIXTIME(u.lastaccess) as last_login,
                (
                    SELECT GROUP_CONCAT(DISTINCT c.shortname SEPARATOR ', ')
                    FROM ${DB_PREFIX}user_enrolments ue
                    INNER JOIN ${DB_PREFIX}enrol e ON ue.enrolid = e.id
                    INNER JOIN ${DB_PREFIX}course c ON e.courseid = c.id
                    WHERE ue.userid = u.id AND ue.status = 0 AND c.visible = 1 AND c.id > 1
                    LIMIT 5
                ) as enrolled_courses,
                (
                    SELECT COUNT(DISTINCT cc.course)
                    FROM ${DB_PREFIX}course_completions cc
                    WHERE cc.userid = u.id AND cc.timecompleted IS NOT NULL
                ) as completed_courses,
                (
                    SELECT COUNT(DISTINCT e.courseid)
                    FROM ${DB_PREFIX}user_enrolments ue
                    INNER JOIN ${DB_PREFIX}enrol e ON ue.enrolid = e.id
                    INNER JOIN ${DB_PREFIX}course c ON e.courseid = c.id
                    WHERE ue.userid = u.id AND ue.status = 0 AND c.visible = 1 AND c.id > 1
                ) as total_enrolled,
                (
                    SELECT ROUND(AVG(gg.finalgrade), 1)
                    FROM ${DB_PREFIX}grade_grades gg
                    INNER JOIN ${DB_PREFIX}grade_items gi ON gg.itemid = gi.id
                    WHERE gg.userid = u.id AND gg.finalgrade IS NOT NULL AND gi.itemtype = 'course'
                ) as avg_grade,
                (
                    SELECT COUNT(*)
                    FROM ${DB_PREFIX}assign a
                    INNER JOIN ${DB_PREFIX}course c ON a.course = c.id
                    INNER JOIN ${DB_PREFIX}user_enrolments ue ON c.id = (SELECT e.courseid FROM ${DB_PREFIX}enrol e WHERE e.id = ue.enrolid)
                    LEFT JOIN ${DB_PREFIX}assign_submission asub ON a.id = asub.assignment AND asub.userid = u.id AND asub.status = 'submitted'
                    WHERE ue.userid = u.id AND asub.id IS NULL AND a.duedate > 0 AND a.duedate < UNIX_TIMESTAMP()
                ) as missing_assignments,
                (
                    SELECT COUNT(*)
                    FROM ${DB_PREFIX}assign_submission asub2
                    INNER JOIN ${DB_PREFIX}assign a2 ON asub2.assignment = a2.id
                    WHERE asub2.userid = u.id AND asub2.status = 'submitted' AND a2.duedate > 0 AND asub2.timemodified > a2.duedate
                ) as late_submissions
            FROM ${DB_PREFIX}user u
            INNER JOIN ${DB_PREFIX}role_assignments ra ON u.id = ra.userid
            INNER JOIN ${DB_PREFIX}role r ON ra.roleid = r.id
            WHERE u.deleted = 0 
                AND r.shortname = 'student'
            GROUP BY u.id, u.firstname, u.lastname, u.email, u.lastaccess
            ORDER BY u.lastname, u.firstname
        `;

        const studentResult = await executeQuery(studentMasterQuery);

        // Process data dengan risk level
        const students = (studentResult.data || []).map(student => {
            const lastAccessTimestamp = student.lastaccess || 0;
            const totalEnrolled = parseInt(student.total_enrolled) || 0;
            const completedCourses = parseInt(student.completed_courses) || 0;
            const completionRate = totalEnrolled > 0
                ? Math.round((completedCourses / totalEnrolled) * 100)
                : 0;
            const missingAssignments = parseInt(student.missing_assignments) || 0;
            const avgGrade = parseFloat(student.avg_grade) || 0;

            // Determine risk level
            let riskLevel = 'green';
            let riskLabel = 'Aman';
            let warnings = [];

            // Critical conditions (Red)
            if (lastAccessTimestamp < sevenDaysAgo || lastAccessTimestamp === 0) {
                riskLevel = 'red';
                riskLabel = 'Kritis';
                warnings.push('Tidak login > 7 hari');
            } else if (missingAssignments >= 3) {
                riskLevel = 'red';
                riskLabel = 'Kritis';
                warnings.push(`${missingAssignments} tugas belum dikerjakan`);
            } else if (avgGrade > 0 && avgGrade < 60) {
                riskLevel = 'red';
                riskLabel = 'Kritis';
                warnings.push('Nilai di bawah KKM');
            }
            // Warning conditions (Yellow)
            else if (lastAccessTimestamp < threeDaysAgo) {
                riskLevel = 'yellow';
                riskLabel = 'Perlu Perhatian';
                warnings.push('Tidak login > 3 hari');
            } else if (missingAssignments >= 1) {
                riskLevel = 'yellow';
                riskLabel = 'Perlu Perhatian';
                warnings.push(`${missingAssignments} tugas belum dikerjakan`);
            } else if (avgGrade > 0 && avgGrade < 70) {
                riskLevel = 'yellow';
                riskLabel = 'Perlu Perhatian';
                warnings.push('Nilai mendekati batas KKM');
            }

            return {
                ...student,
                completion_rate: completionRate,
                risk_level: riskLevel,
                risk_label: riskLabel,
                warnings,
                avg_grade: avgGrade
            };
        });

        // Get category list for filter
        const categoriesQuery = `
            SELECT DISTINCT cat.id, cat.name
            FROM ${DB_PREFIX}course_categories cat
            INNER JOIN ${DB_PREFIX}course c ON cat.id = c.category
            WHERE c.visible = 1 AND c.id > 1
            ORDER BY cat.name
        `;
        const categoriesResult = await executeQuery(categoriesQuery);

        res.json({
            period: {
                startDate: dateRange.startDate,
                endDate: dateRange.endDate
            },
            students,
            categories: categoriesResult.data || [],
            summary: {
                total: students.length,
                safe: students.filter(s => s.risk_level === 'green').length,
                needsAttention: students.filter(s => s.risk_level === 'yellow').length,
                critical: students.filter(s => s.risk_level === 'red').length
            }
        });

    } catch (error) {
        console.error('Student detail master error:', error);
        res.status(500).json({ error: 'Failed to generate student detail master report' });
    }
});

// ============================================================
// GET /api/reports/student-detail/:id
// Drill-down View: Portfolio Siswa Individual
// ============================================================
router.get('/student-detail/:id', async (req, res) => {
    try {
        const studentId = parseInt(req.params.id);
        const { startDate, endDate } = req.query;
        const dateRange = getDateRange(startDate, endDate);

        // 1. Basic student info
        const studentInfoQuery = `
            SELECT 
                u.id, u.firstname, u.lastname, u.email, u.lastaccess,
                FROM_UNIXTIME(u.lastaccess) as last_login
            FROM ${DB_PREFIX}user u
            WHERE u.id = ${studentId}
        `;
        const studentInfo = await executeQuery(studentInfoQuery);

        // 2. Grade trend (nilai per waktu)
        const gradeTrendQuery = `
            SELECT 
                FROM_UNIXTIME(gg.timemodified, '%Y-%m-%d') as grade_date,
                gi.itemname,
                gg.finalgrade as grade,
                gi.grademax as max_grade
            FROM ${DB_PREFIX}grade_grades gg
            INNER JOIN ${DB_PREFIX}grade_items gi ON gg.itemid = gi.id
            WHERE gg.userid = ${studentId}
                AND gg.finalgrade IS NOT NULL
                AND gg.timemodified BETWEEN ${dateRange.startTimestamp} AND ${dateRange.endTimestamp}
                AND gi.itemtype != 'course'
            ORDER BY gg.timemodified ASC
            LIMIT 30
        `;
        const gradeTrendResult = await executeQuery(gradeTrendQuery);

        // Process grade trend
        const gradeTrend = (gradeTrendResult.data || []).map(item => ({
            date: item.grade_date,
            name: item.itemname?.substring(0, 20) || 'N/A',
            grade: Math.round((parseFloat(item.grade) / parseFloat(item.max_grade || 100)) * 100),
            rawGrade: parseFloat(item.grade)
        }));

        // 3. Activity engagement (radar)
        // Quiz activity
        const quizActivityQuery = `
            SELECT COUNT(*) as count
            FROM ${DB_PREFIX}quiz_attempts qa
            WHERE qa.userid = ${studentId}
                AND qa.timefinish BETWEEN ${dateRange.startTimestamp} AND ${dateRange.endTimestamp}
        `;
        const quizResult = await executeQuery(quizActivityQuery);
        const quizActivity = parseInt(quizResult.data?.[0]?.count) || 0;

        // Forum activity
        const forumActivityQuery = `
            SELECT COUNT(*) as count
            FROM ${DB_PREFIX}forum_posts fp
            INNER JOIN ${DB_PREFIX}forum_discussions fd ON fp.discussion = fd.id
            WHERE fp.userid = ${studentId}
                AND fp.created BETWEEN ${dateRange.startTimestamp} AND ${dateRange.endTimestamp}
        `;
        const forumResult = await executeQuery(forumActivityQuery);
        const forumActivity = parseInt(forumResult.data?.[0]?.count) || 0;

        // Assignment submissions
        const assignActivityQuery = `
            SELECT COUNT(*) as count
            FROM ${DB_PREFIX}assign_submission asub
            WHERE asub.userid = ${studentId}
                AND asub.status = 'submitted'
                AND asub.timemodified BETWEEN ${dateRange.startTimestamp} AND ${dateRange.endTimestamp}
        `;
        const assignResult = await executeQuery(assignActivityQuery);
        const assignActivity = parseInt(assignResult.data?.[0]?.count) || 0;

        // Resource views
        const resourceActivityQuery = `
            SELECT COUNT(*) as count
            FROM ${DB_PREFIX}logstore_standard_log l
            WHERE l.userid = ${studentId}
                AND l.action = 'viewed'
                AND l.component IN ('mod_resource', 'mod_page', 'mod_book', 'mod_url')
                AND l.timecreated BETWEEN ${dateRange.startTimestamp} AND ${dateRange.endTimestamp}
        `;
        const resourceResult = await executeQuery(resourceActivityQuery);
        const resourceActivity = parseInt(resourceResult.data?.[0]?.count) || 0;

        // Normalize radar data
        const engagementData = [
            { subject: 'Kuis', value: Math.min(quizActivity * 10, 100), fullMark: 100 },
            { subject: 'Forum', value: Math.min(forumActivity * 15, 100), fullMark: 100 },
            { subject: 'Tugas', value: Math.min(assignActivity * 12, 100), fullMark: 100 },
            { subject: 'Materi', value: Math.min(resourceActivity * 3, 100), fullMark: 100 }
        ];

        // 4. Timeline belajar (aktivitas per jam)
        const timelineQuery = `
            SELECT 
                DAYOFWEEK(FROM_UNIXTIME(timecreated)) as day_of_week,
                HOUR(FROM_UNIXTIME(timecreated)) as hour_of_day,
                COUNT(*) as activity_count
            FROM ${DB_PREFIX}logstore_standard_log
            WHERE userid = ${studentId}
                AND timecreated BETWEEN ${dateRange.startTimestamp} AND ${dateRange.endTimestamp}
            GROUP BY day_of_week, hour_of_day
            ORDER BY day_of_week, hour_of_day
        `;
        const timelineResult = await executeQuery(timelineQuery);

        // Transform timeline data
        const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        const timelineData = [];
        for (let day = 1; day <= 7; day++) {
            for (let hour = 0; hour < 24; hour++) {
                const found = (timelineResult.data || []).find(
                    h => parseInt(h.day_of_week) === day && parseInt(h.hour_of_day) === hour
                );
                timelineData.push({
                    day: dayNames[day - 1],
                    dayIndex: day,
                    hour,
                    count: found ? parseInt(found.activity_count) : 0
                });
            }
        }

        // 5. Enrolled courses with grades and status
        const coursesQuery = `
            SELECT 
                c.id as course_id,
                c.fullname as course_name,
                c.shortname,
                cat.name as category_name,
                (
                    SELECT gg.finalgrade
                    FROM ${DB_PREFIX}grade_grades gg
                    INNER JOIN ${DB_PREFIX}grade_items gi ON gg.itemid = gi.id
                    WHERE gg.userid = ${studentId} AND gi.courseid = c.id AND gi.itemtype = 'course'
                ) as course_grade,
                (
                    SELECT gi2.grademax
                    FROM ${DB_PREFIX}grade_items gi2
                    WHERE gi2.courseid = c.id AND gi2.itemtype = 'course'
                ) as grade_max,
                (
                    SELECT cc.timecompleted
                    FROM ${DB_PREFIX}course_completions cc
                    WHERE cc.userid = ${studentId} AND cc.course = c.id
                ) as completed_at,
                (
                    SELECT COUNT(*)
                    FROM ${DB_PREFIX}assign a
                    WHERE a.course = c.id
                ) as total_assignments,
                (
                    SELECT COUNT(*)
                    FROM ${DB_PREFIX}assign_submission asub
                    INNER JOIN ${DB_PREFIX}assign a ON asub.assignment = a.id
                    WHERE asub.userid = ${studentId} AND a.course = c.id AND asub.status = 'submitted'
                ) as submitted_assignments,
                (
                    SELECT COUNT(*)
                    FROM ${DB_PREFIX}assign a2
                    LEFT JOIN ${DB_PREFIX}assign_submission asub2 ON a2.id = asub2.assignment AND asub2.userid = ${studentId} AND asub2.status = 'submitted'
                    WHERE a2.course = c.id AND asub2.id IS NULL AND a2.duedate > 0 AND a2.duedate < UNIX_TIMESTAMP()
                ) as missing_assignments
            FROM ${DB_PREFIX}course c
            INNER JOIN ${DB_PREFIX}enrol e ON c.id = e.courseid
            INNER JOIN ${DB_PREFIX}user_enrolments ue ON e.id = ue.enrolid
            LEFT JOIN ${DB_PREFIX}course_categories cat ON c.category = cat.id
            WHERE ue.userid = ${studentId}
                AND ue.status = 0
                AND c.visible = 1 AND c.id > 1
            GROUP BY c.id, c.fullname, c.shortname, cat.name
        `;
        const coursesResult = await executeQuery(coursesQuery);

        // Process courses
        const courses = (coursesResult.data || []).map(course => {
            const grade = parseFloat(course.course_grade) || 0;
            const gradeMax = parseFloat(course.grade_max) || 100;
            const percentage = gradeMax > 0 ? Math.round((grade / gradeMax) * 100) : 0;
            const totalAssignments = parseInt(course.total_assignments) || 0;
            const submittedAssignments = parseInt(course.submitted_assignments) || 0;
            const missingAssignments = parseInt(course.missing_assignments) || 0;

            let status = 'on-track';
            if (course.completed_at) {
                status = 'completed';
            } else if (missingAssignments > 0) {
                status = 'behind';
            }

            return {
                ...course,
                grade_percentage: percentage,
                status,
                total_assignments: totalAssignments,
                submitted_assignments: submittedAssignments,
                missing_assignments: missingAssignments
            };
        });

        // 6. Calculate overall stats for scorecard
        const totalCourses = courses.length;
        const completedCourses = courses.filter(c => c.status === 'completed').length;
        const overallProgress = totalCourses > 0 ? Math.round((completedCourses / totalCourses) * 100) : 0;
        const avgGrade = courses.length > 0
            ? Math.round(courses.reduce((sum, c) => sum + c.grade_percentage, 0) / courses.length)
            : 0;

        // Determine overall risk
        const missingTotal = courses.reduce((sum, c) => sum + c.missing_assignments, 0);
        const lastAccess = studentInfo.data?.[0]?.lastaccess || 0;
        const sevenDaysAgo = Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60);

        let riskLevel = 'green';
        let riskLabel = 'Aman';
        let warnings = [];

        if (lastAccess < sevenDaysAgo || lastAccess === 0) {
            riskLevel = 'red';
            riskLabel = 'Kritis';
            warnings.push('Tidak aktif lebih dari 7 hari');
        }
        if (missingTotal >= 3) {
            riskLevel = 'red';
            riskLabel = 'Kritis';
            warnings.push(`${missingTotal} tugas belum dikerjakan`);
        }
        if (avgGrade > 0 && avgGrade < 60) {
            riskLevel = riskLevel === 'red' ? 'red' : 'yellow';
            riskLabel = riskLevel === 'red' ? 'Kritis' : 'Perlu Perhatian';
            warnings.push('Nilai rata-rata di bawah KKM');
        }

        res.json({
            student: studentInfo.data?.[0] || null,
            scorecard: {
                riskLevel,
                riskLabel,
                warnings,
                overallProgress,
                avgGrade,
                totalCourses,
                completedCourses
            },
            gradeTrend,
            engagementData,
            timelineData,
            courses,
            period: {
                startDate: dateRange.startDate,
                endDate: dateRange.endDate
            }
        });

    } catch (error) {
        console.error('Student detail individual error:', error);
        res.status(500).json({ error: 'Failed to generate student detail report' });
    }
});

export default router;




