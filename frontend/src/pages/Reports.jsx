import { useState, useEffect } from 'react'
import {
    Users,
    GraduationCap,
    BookOpen,
    Activity,
    Calendar,
    Download,
    Loader2,
    TrendingUp,
    TrendingDown,
    UserX,
    UserCheck,
    Clock,
    FileText,
    ClipboardList,
    Award
} from 'lucide-react'
import { reportsApi } from '../services/api'

const REPORT_TABS = [
    { id: 'user-statistics', label: 'Statistik Pengguna', icon: Users },
    { id: 'teacher-activity', label: 'Aktivitas Guru', icon: GraduationCap },
    { id: 'student-activity', label: 'Aktivitas Siswa', icon: BookOpen },
    { id: 'course-activity', label: 'Aktivitas Kursus', icon: Activity },
]

export default function Reports() {
    const [activeTab, setActiveTab] = useState('user-statistics')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [data, setData] = useState(null)

    // Date range state (default: last 30 days)
    const today = new Date()
    const thirtyDaysAgo = new Date(today)
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const [startDate, setStartDate] = useState(thirtyDaysAgo.toISOString().split('T')[0])
    const [endDate, setEndDate] = useState(today.toISOString().split('T')[0])

    useEffect(() => {
        fetchReport()
    }, [activeTab, startDate, endDate])

    async function fetchReport() {
        try {
            setLoading(true)
            setError(null)

            const params = { startDate, endDate }
            let result

            switch (activeTab) {
                case 'user-statistics':
                    result = await reportsApi.getUserStatistics(params)
                    break
                case 'teacher-activity':
                    result = await reportsApi.getTeacherActivity(params)
                    break
                case 'student-activity':
                    result = await reportsApi.getStudentActivity(params)
                    break
                case 'course-activity':
                    result = await reportsApi.getCourseActivity(params)
                    break
                default:
                    result = null
            }

            setData(result)
        } catch (err) {
            setError(err.message || 'Gagal memuat laporan')
        } finally {
            setLoading(false)
        }
    }

    function formatNumber(num) {
        return new Intl.NumberFormat('id-ID').format(num || 0)
    }

    function formatDate(dateStr) {
        if (!dateStr) return '-'
        const date = new Date(dateStr)
        return date.toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    function formatShortDate(dateStr) {
        if (!dateStr) return '-'
        const date = new Date(dateStr)
        return date.toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short'
        })
    }

    // Render User Statistics Report
    function renderUserStatistics() {
        if (!data) return null

        return (
            <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="glass-card p-5">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/20 flex items-center justify-center">
                                <Users className="w-6 h-6 text-blue-400" />
                            </div>
                            <div>
                                <p className="text-dark-400 text-sm">Total Terdaftar</p>
                                <p className="text-2xl font-bold text-white">{formatNumber(data.summary?.totalRegistered)}</p>
                            </div>
                        </div>
                    </div>
                    <div className="glass-card p-5">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500/20 to-red-600/20 flex items-center justify-center">
                                <UserX className="w-6 h-6 text-red-400" />
                            </div>
                            <div>
                                <p className="text-dark-400 text-sm">Tidak Pernah Login</p>
                                <p className="text-2xl font-bold text-white">{formatNumber(data.summary?.neverLoggedIn)}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Users by Role */}
                <div className="glass-card overflow-hidden">
                    <div className="p-4 border-b border-dark-700/50">
                        <h3 className="font-semibold text-white flex items-center gap-2">
                            <UserCheck className="w-4 h-4 text-primary-400" />
                            Pengguna Per Role
                        </h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Role</th>
                                    <th className="text-right">Jumlah</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.usersByRole?.map((role, idx) => (
                                    <tr key={idx}>
                                        <td className="text-white">{role.role_name || role.role}</td>
                                        <td className="text-right text-dark-200">{formatNumber(role.total)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Recent Logins */}
                    <div className="glass-card overflow-hidden">
                        <div className="p-4 border-b border-dark-700/50">
                            <h3 className="font-semibold text-white flex items-center gap-2">
                                <Clock className="w-4 h-4 text-green-400" />
                                Login Terakhir
                            </h3>
                        </div>
                        <div className="overflow-x-auto max-h-80">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Nama</th>
                                        <th>Terakhir Akses</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.recentLogins?.map((user, idx) => (
                                        <tr key={idx}>
                                            <td className="text-white">{user.firstname} {user.lastname}</td>
                                            <td className="text-dark-300 text-sm">{formatDate(user.last_access)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Never Logged In */}
                    <div className="glass-card overflow-hidden">
                        <div className="p-4 border-b border-dark-700/50">
                            <h3 className="font-semibold text-white flex items-center gap-2">
                                <UserX className="w-4 h-4 text-red-400" />
                                Belum Pernah Login
                            </h3>
                        </div>
                        <div className="overflow-x-auto max-h-80">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Nama</th>
                                        <th>Email</th>
                                        <th>Dibuat</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.neverLoggedInUsers?.map((user, idx) => (
                                        <tr key={idx}>
                                            <td className="text-white">{user.firstname} {user.lastname}</td>
                                            <td className="text-dark-300 text-sm">{user.email}</td>
                                            <td className="text-dark-400 text-sm">{formatDate(user.created_at)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Users Per Course */}
                <div className="glass-card overflow-hidden">
                    <div className="p-4 border-b border-dark-700/50">
                        <h3 className="font-semibold text-white flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-purple-400" />
                            Distribusi Pengguna per Kursus (Top 10)
                        </h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Kursus</th>
                                    <th>Kode</th>
                                    <th className="text-right">Peserta</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.usersPerCourse?.map((course, idx) => (
                                    <tr key={idx}>
                                        <td className="text-white">{course.course_name}</td>
                                        <td className="text-dark-400">{course.course_shortname}</td>
                                        <td className="text-right text-dark-200">{formatNumber(course.enrolled_users)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )
    }

    // Render Teacher Activity Report
    function renderTeacherActivity() {
        if (!data) return null

        return (
            <div className="space-y-6">
                {/* Total Activity Summary */}
                <div className="glass-card overflow-hidden">
                    <div className="p-4 border-b border-dark-700/50">
                        <h3 className="font-semibold text-white flex items-center gap-2">
                            <Activity className="w-4 h-4 text-primary-400" />
                            Ringkasan Aktivitas Guru
                        </h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Nama</th>
                                    <th>Email</th>
                                    <th className="text-right">Total Aktivitas</th>
                                    <th className="text-right">Hari Aktif</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.totalActivitySummary?.map((teacher, idx) => (
                                    <tr key={idx}>
                                        <td className="text-white">{teacher.firstname} {teacher.lastname}</td>
                                        <td className="text-dark-300">{teacher.email}</td>
                                        <td className="text-right text-dark-200">{formatNumber(teacher.total_activities)}</td>
                                        <td className="text-right text-dark-200">{teacher.active_days}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Teacher Logins */}
                    <div className="glass-card overflow-hidden">
                        <div className="p-4 border-b border-dark-700/50">
                            <h3 className="font-semibold text-white flex items-center gap-2">
                                <Clock className="w-4 h-4 text-blue-400" />
                                Frekuensi Login
                            </h3>
                        </div>
                        <div className="overflow-x-auto max-h-72">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Nama</th>
                                        <th className="text-right">Total Login</th>
                                        <th className="text-right">Hari Login</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.teacherLogins?.slice(0, 10).map((teacher, idx) => (
                                        <tr key={idx}>
                                            <td className="text-white">{teacher.firstname} {teacher.lastname}</td>
                                            <td className="text-right text-dark-200">{formatNumber(teacher.total_logins)}</td>
                                            <td className="text-right text-dark-200">{teacher.login_days}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Grading Activity */}
                    <div className="glass-card overflow-hidden">
                        <div className="p-4 border-b border-dark-700/50">
                            <h3 className="font-semibold text-white flex items-center gap-2">
                                <Award className="w-4 h-4 text-yellow-400" />
                                Aktivitas Penilaian
                            </h3>
                        </div>
                        <div className="overflow-x-auto max-h-72">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Nama</th>
                                        <th className="text-right">Nilai Diberikan</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.gradingActivity?.slice(0, 10).map((teacher, idx) => (
                                        <tr key={idx}>
                                            <td className="text-white">{teacher.firstname} {teacher.lastname}</td>
                                            <td className="text-right text-dark-200">{formatNumber(teacher.grades_given)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Assignments Created */}
                    <div className="glass-card overflow-hidden">
                        <div className="p-4 border-b border-dark-700/50">
                            <h3 className="font-semibold text-white flex items-center gap-2">
                                <ClipboardList className="w-4 h-4 text-green-400" />
                                Penugasan Dibuat
                            </h3>
                        </div>
                        <div className="overflow-x-auto max-h-72">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Nama</th>
                                        <th className="text-right">Jumlah</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.assignmentsCreated?.slice(0, 10).map((teacher, idx) => (
                                        <tr key={idx}>
                                            <td className="text-white">{teacher.firstname} {teacher.lastname}</td>
                                            <td className="text-right text-dark-200">{formatNumber(teacher.assignments_created)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Quizzes Created */}
                    <div className="glass-card overflow-hidden">
                        <div className="p-4 border-b border-dark-700/50">
                            <h3 className="font-semibold text-white flex items-center gap-2">
                                <FileText className="w-4 h-4 text-purple-400" />
                                Kuis Dibuat
                            </h3>
                        </div>
                        <div className="overflow-x-auto max-h-72">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Nama</th>
                                        <th className="text-right">Jumlah</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.quizzesCreated?.slice(0, 10).map((teacher, idx) => (
                                        <tr key={idx}>
                                            <td className="text-white">{teacher.firstname} {teacher.lastname}</td>
                                            <td className="text-right text-dark-200">{formatNumber(teacher.quizzes_created)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // Render Student Activity Report
    function renderStudentActivity() {
        if (!data) return null

        return (
            <div className="space-y-6">
                {/* Total Activity Summary */}
                <div className="glass-card overflow-hidden">
                    <div className="p-4 border-b border-dark-700/50">
                        <h3 className="font-semibold text-white flex items-center gap-2">
                            <Activity className="w-4 h-4 text-primary-400" />
                            Ringkasan Aktivitas Siswa
                        </h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Nama</th>
                                    <th className="text-right">Total Aktivitas</th>
                                    <th className="text-right">Hari Aktif</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.totalActivitySummary?.map((student, idx) => (
                                    <tr key={idx}>
                                        <td className="text-white">{student.firstname} {student.lastname}</td>
                                        <td className="text-right text-dark-200">{formatNumber(student.total_activities)}</td>
                                        <td className="text-right text-dark-200">{student.active_days}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Student Logins */}
                    <div className="glass-card overflow-hidden">
                        <div className="p-4 border-b border-dark-700/50">
                            <h3 className="font-semibold text-white flex items-center gap-2">
                                <Clock className="w-4 h-4 text-blue-400" />
                                Frekuensi Login
                            </h3>
                        </div>
                        <div className="overflow-x-auto max-h-72">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Nama</th>
                                        <th className="text-right">Total Login</th>
                                        <th className="text-right">Hari Login</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.studentLogins?.slice(0, 10).map((student, idx) => (
                                        <tr key={idx}>
                                            <td className="text-white">{student.firstname} {student.lastname}</td>
                                            <td className="text-right text-dark-200">{formatNumber(student.total_logins)}</td>
                                            <td className="text-right text-dark-200">{student.login_days}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Assignment Submissions */}
                    <div className="glass-card overflow-hidden">
                        <div className="p-4 border-b border-dark-700/50">
                            <h3 className="font-semibold text-white flex items-center gap-2">
                                <ClipboardList className="w-4 h-4 text-green-400" />
                                Pengumpulan Tugas
                            </h3>
                        </div>
                        <div className="overflow-x-auto max-h-72">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Nama</th>
                                        <th className="text-right">Pengumpulan</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.assignmentSubmissions?.slice(0, 10).map((student, idx) => (
                                        <tr key={idx}>
                                            <td className="text-white">{student.firstname} {student.lastname}</td>
                                            <td className="text-right text-dark-200">{formatNumber(student.submissions)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Quiz Attempts */}
                    <div className="glass-card overflow-hidden">
                        <div className="p-4 border-b border-dark-700/50">
                            <h3 className="font-semibold text-white flex items-center gap-2">
                                <FileText className="w-4 h-4 text-purple-400" />
                                Percobaan Kuis
                            </h3>
                        </div>
                        <div className="overflow-x-auto max-h-72">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Nama</th>
                                        <th className="text-right">Percobaan</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.quizAttempts?.slice(0, 10).map((student, idx) => (
                                        <tr key={idx}>
                                            <td className="text-white">{student.firstname} {student.lastname}</td>
                                            <td className="text-right text-dark-200">{formatNumber(student.quiz_attempts)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Grade Summary */}
                    <div className="glass-card overflow-hidden">
                        <div className="p-4 border-b border-dark-700/50">
                            <h3 className="font-semibold text-white flex items-center gap-2">
                                <Award className="w-4 h-4 text-yellow-400" />
                                Rata-rata Nilai
                            </h3>
                        </div>
                        <div className="overflow-x-auto max-h-72">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Nama</th>
                                        <th className="text-right">Kursus</th>
                                        <th className="text-right">Rata-rata</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.gradeSummary?.slice(0, 10).map((student, idx) => (
                                        <tr key={idx}>
                                            <td className="text-white">{student.firstname} {student.lastname}</td>
                                            <td className="text-right text-dark-200">{student.courses_with_grades}</td>
                                            <td className="text-right">
                                                <span className={`${student.average_percentage >= 75 ? 'text-green-400' : student.average_percentage >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                                                    {student.average_percentage}%
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Course Progress */}
                <div className="glass-card overflow-hidden">
                    <div className="p-4 border-b border-dark-700/50">
                        <h3 className="font-semibold text-white flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-green-400" />
                            Progress Penyelesaian Kursus
                        </h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Nama</th>
                                    <th>Email</th>
                                    <th className="text-right">Terdaftar</th>
                                    <th className="text-right">Selesai</th>
                                    <th className="text-right">Progres</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.courseProgress?.map((student, idx) => (
                                    <tr key={idx}>
                                        <td className="text-white">{student.firstname} {student.lastname}</td>
                                        <td className="text-dark-300">{student.email}</td>
                                        <td className="text-right text-dark-200">{student.courses_enrolled}</td>
                                        <td className="text-right text-dark-200">{student.courses_completed}</td>
                                        <td className="text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <div className="w-16 h-2 bg-dark-700 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-primary-500 to-purple-500"
                                                        style={{ width: `${student.courses_enrolled > 0 ? (student.courses_completed / student.courses_enrolled) * 100 : 0}%` }}
                                                    />
                                                </div>
                                                <span className="text-dark-300 text-xs">
                                                    {student.courses_enrolled > 0 ? Math.round((student.courses_completed / student.courses_enrolled) * 100) : 0}%
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )
    }

    // Render Course Activity Report
    function renderCourseActivity() {
        if (!data) return null

        return (
            <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="glass-card p-5">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/20 flex items-center justify-center">
                                <BookOpen className="w-6 h-6 text-blue-400" />
                            </div>
                            <div>
                                <p className="text-dark-400 text-sm">Total Kursus</p>
                                <p className="text-2xl font-bold text-white">{formatNumber(data.summary?.total_courses)}</p>
                            </div>
                        </div>
                    </div>
                    <div className="glass-card p-5">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500/20 to-green-600/20 flex items-center justify-center">
                                <Activity className="w-6 h-6 text-green-400" />
                            </div>
                            <div>
                                <p className="text-dark-400 text-sm">Kursus Aktif</p>
                                <p className="text-2xl font-bold text-white">{formatNumber(data.summary?.visible_courses)}</p>
                            </div>
                        </div>
                    </div>
                    <div className="glass-card p-5">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-600/20 flex items-center justify-center">
                                <Award className="w-6 h-6 text-purple-400" />
                            </div>
                            <div>
                                <p className="text-dark-400 text-sm">Dengan Penyelesaian</p>
                                <p className="text-2xl font-bold text-white">{formatNumber(data.summary?.courses_with_completions)}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Most Active Courses */}
                <div className="glass-card overflow-hidden">
                    <div className="p-4 border-b border-dark-700/50">
                        <h3 className="font-semibold text-white flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-green-400" />
                            Kursus Paling Aktif
                        </h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Kursus</th>
                                    <th>Kategori</th>
                                    <th className="text-right">Total Aktivitas</th>
                                    <th className="text-right">Pengguna Unik</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.mostActiveCourses?.map((course, idx) => (
                                    <tr key={idx}>
                                        <td>
                                            <div>
                                                <p className="text-white">{course.course_name}</p>
                                                <p className="text-xs text-dark-500">{course.course_shortname}</p>
                                            </div>
                                        </td>
                                        <td className="text-dark-300">{course.category_name || '-'}</td>
                                        <td className="text-right text-dark-200">{formatNumber(course.total_activities)}</td>
                                        <td className="text-right text-dark-200">{formatNumber(course.unique_users)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Completion Rates */}
                <div className="glass-card overflow-hidden">
                    <div className="p-4 border-b border-dark-700/50">
                        <h3 className="font-semibold text-white flex items-center gap-2">
                            <Award className="w-4 h-4 text-yellow-400" />
                            Tingkat Penyelesaian Kursus
                        </h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Kursus</th>
                                    <th className="text-right">Terdaftar</th>
                                    <th className="text-right">Selesai</th>
                                    <th className="text-right">Tingkat</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.completionRates?.map((course, idx) => (
                                    <tr key={idx}>
                                        <td>
                                            <div>
                                                <p className="text-white">{course.course_name}</p>
                                                <p className="text-xs text-dark-500">{course.course_shortname}</p>
                                            </div>
                                        </td>
                                        <td className="text-right text-dark-200">{formatNumber(course.enrolled_count)}</td>
                                        <td className="text-right text-dark-200">{formatNumber(course.completed_count)}</td>
                                        <td className="text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <div className="w-16 h-2 bg-dark-700 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-green-500 to-emerald-500"
                                                        style={{ width: `${course.completion_rate || 0}%` }}
                                                    />
                                                </div>
                                                <span className={`text-xs ${course.completion_rate >= 75 ? 'text-green-400' : course.completion_rate >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                                                    {course.completion_rate || 0}%
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Course Activity Summary */}
                <div className="glass-card overflow-hidden">
                    <div className="p-4 border-b border-dark-700/50">
                        <h3 className="font-semibold text-white flex items-center gap-2">
                            <Activity className="w-4 h-4 text-blue-400" />
                            Aktivitas per Kursus
                        </h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Kursus</th>
                                    <th className="text-right">Total Aktivitas</th>
                                    <th className="text-right">Pengguna Unik</th>
                                    <th className="text-right">Hari Aktif</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.courseActivity?.map((course, idx) => (
                                    <tr key={idx}>
                                        <td>
                                            <div>
                                                <p className="text-white">{course.course_name}</p>
                                                <p className="text-xs text-dark-500">{course.course_shortname}</p>
                                            </div>
                                        </td>
                                        <td className="text-right text-dark-200">{formatNumber(course.total_activities)}</td>
                                        <td className="text-right text-dark-200">{formatNumber(course.unique_users)}</td>
                                        <td className="text-right text-dark-200">{course.active_days}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )
    }

    // Render content based on active tab
    function renderContent() {
        if (loading) {
            return (
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="w-8 h-8 animate-spin text-primary-400" />
                </div>
            )
        }

        if (error) {
            return (
                <div className="glass-card p-6 text-center">
                    <p className="text-red-400">⚠️ {error}</p>
                    <button onClick={fetchReport} className="btn btn-primary mt-4">
                        Coba Lagi
                    </button>
                </div>
            )
        }

        switch (activeTab) {
            case 'user-statistics':
                return renderUserStatistics()
            case 'teacher-activity':
                return renderTeacherActivity()
            case 'student-activity':
                return renderStudentActivity()
            case 'course-activity':
                return renderCourseActivity()
            default:
                return null
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">Report</h1>
                    <p className="text-dark-400 mt-1">Generate laporan aktivitas LMS</p>
                </div>

                {/* Date Range Filter */}
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-sm">
                        <Calendar className="w-4 h-4 text-dark-400" />
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="input-field py-1.5 px-2 text-sm"
                        />
                        <span className="text-dark-500">-</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="input-field py-1.5 px-2 text-sm"
                        />
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex flex-wrap gap-2">
                {REPORT_TABS.map((tab) => {
                    const Icon = tab.icon
                    const isActive = activeTab === tab.id
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`
                                flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-200
                                ${isActive
                                    ? 'bg-gradient-to-r from-primary-500/20 to-purple-500/10 text-white border border-primary-500/30'
                                    : 'glass text-dark-300 hover:text-white hover:bg-dark-800/50'
                                }
                            `}
                        >
                            <Icon className={`w-4 h-4 ${isActive ? 'text-primary-400' : ''}`} />
                            <span className="font-medium text-sm">{tab.label}</span>
                        </button>
                    )
                })}
            </div>

            {/* Period Info */}
            {data?.period && (
                <div className="text-sm text-dark-400">
                    Periode: {formatShortDate(data.period.startDate)} - {formatShortDate(data.period.endDate)}
                </div>
            )}

            {/* Content */}
            {renderContent()}
        </div>
    )
}
