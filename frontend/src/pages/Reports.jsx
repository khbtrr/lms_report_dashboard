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
    Award,
    CheckCircle,
    AlertTriangle,
    XCircle,
    Trophy,
    BarChart3
} from 'lucide-react'
import { reportsApi } from '../services/api'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area } from 'recharts'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const REPORT_TABS = [
    { id: 'user-statistics', label: 'Statistik Pengguna', icon: Users },
    { id: 'teacher-activity', label: 'Aktivitas Guru', icon: GraduationCap },
    { id: 'student-activity', label: 'Aktivitas Siswa', icon: BookOpen },
    { id: 'course-activity', label: 'Aktivitas Kursus', icon: Activity },
    { id: 'teacher-compliance', label: 'Kepatuhan Guru', icon: CheckCircle },
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

    // Export modal state
    const [showExportModal, setShowExportModal] = useState(false)
    const [exportStartDate, setExportStartDate] = useState(thirtyDaysAgo.toISOString().split('T')[0])
    const [exportEndDate, setExportEndDate] = useState(today.toISOString().split('T')[0])
    const [exporting, setExporting] = useState(false)

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
                case 'teacher-compliance':
                    result = await reportsApi.getTeacherCompliance()
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

    // Export to PDF function
    async function exportToPDF() {
        try {
            setExporting(true)

            // Fetch export data from backend
            const response = await fetch(`/api/reports/teacher-compliance/export?startDate=${exportStartDate}&endDate=${exportEndDate}`)
            const exportData = await response.json()

            if (!response.ok) {
                throw new Error(exportData.error || 'Failed to fetch export data')
            }

            // Create PDF
            const doc = new jsPDF()
            const pageWidth = doc.internal.pageSize.getWidth()

            // Title
            doc.setFontSize(14)
            doc.setFont('helvetica', 'bold')
            doc.text('LAPORAN LMS SEKOLAH', pageWidth / 2, 20, { align: 'center' })
            doc.setFontSize(10)
            doc.setFont('helvetica', 'normal')
            doc.text(`Periode: ${exportStartDate} s/d ${exportEndDate}`, pageWidth / 2, 27, { align: 'center' })

            let yPos = 40

            // 1. Statistik Pengguna
            doc.setFontSize(11)
            doc.setFont('helvetica', 'bold')
            doc.text('1. Statistik Pengguna', 14, yPos)
            yPos += 5

            autoTable(doc, {
                startY: yPos,
                head: [['NO', 'KETERANGAN', 'JUMLAH', 'KETERANGAN TAMBAHAN']],
                body: exportData.statistikPengguna.map(row => [
                    row.no,
                    row.keterangan,
                    row.jumlah,
                    row.keteranganTambahan
                ]),
                theme: 'grid',
                headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 9 },
                bodyStyles: { fontSize: 9 },
                columnStyles: {
                    0: { cellWidth: 12 },
                    1: { cellWidth: 55 },
                    2: { cellWidth: 25, halign: 'center' },
                    3: { cellWidth: 'auto' }
                },
                margin: { left: 14, right: 14 }
            })

            yPos = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 15 : yPos + 50

            // 2. Aktivitas Guru
            doc.setFontSize(11)
            doc.setFont('helvetica', 'bold')
            doc.text('2. Aktivitas Guru', 14, yPos)
            yPos += 5

            if (exportData.aktivitasGuru.length > 0) {
                autoTable(doc, {
                    startY: yPos,
                    head: [['NO', 'NAMA', 'TANGGAL', 'AKTIVITAS', 'KELAS']],
                    body: exportData.aktivitasGuru.map(row => [
                        row.no,
                        row.nama,
                        row.tanggal,
                        row.aktivitas,
                        row.kelas
                    ]),
                    theme: 'grid',
                    headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 9 },
                    bodyStyles: { fontSize: 8 },
                    columnStyles: {
                        0: { cellWidth: 12 },
                        1: { cellWidth: 40 },
                        2: { cellWidth: 25 },
                        3: { cellWidth: 35 },
                        4: { cellWidth: 'auto' }
                    },
                    margin: { left: 14, right: 14 }
                })
                yPos = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 15 : yPos + 50
            } else {
                doc.setFontSize(9)
                doc.setFont('helvetica', 'italic')
                doc.text('Tidak ada data aktivitas guru dalam periode ini.', 14, yPos)
                yPos += 15
            }

            // Check if need new page
            if (yPos > 250) {
                doc.addPage()
                yPos = 20
            }

            // 3. Aktivitas Kursus
            doc.setFontSize(11)
            doc.setFont('helvetica', 'bold')
            doc.text('3. Aktivitas Kursus', 14, yPos)
            yPos += 5

            if (exportData.aktivitasKursus.length > 0) {
                autoTable(doc, {
                    startY: yPos,
                    head: [['NO', 'NAMA KELAS', 'JUMLAH MATERI BARU', 'JUMLAH TUGAS/KUIS BARU', 'GURU']],
                    body: exportData.aktivitasKursus.map(row => [
                        row.no,
                        row.namaKelas,
                        row.jumlahMateriBaru,
                        row.jumlahTugasKuisBaru,
                        row.guru
                    ]),
                    theme: 'grid',
                    headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 8 },
                    bodyStyles: { fontSize: 8 },
                    columnStyles: {
                        0: { cellWidth: 12 },
                        1: { cellWidth: 50 },
                        2: { cellWidth: 28, halign: 'center' },
                        3: { cellWidth: 32, halign: 'center' },
                        4: { cellWidth: 'auto' }
                    },
                    margin: { left: 14, right: 14 }
                })
            } else {
                doc.setFontSize(9)
                doc.setFont('helvetica', 'italic')
                doc.text('Tidak ada data aktivitas kursus dalam periode ini.', 14, yPos)
            }

            // Signature section at end of report
            const pageHeight = doc.internal.pageSize.height
            let signY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 30 : yPos + 30

            // Check if need new page for signature
            if (signY > pageHeight - 50) {
                doc.addPage()
                signY = 40
            }

            // Right-aligned signature
            const signPageWidth = doc.internal.pageSize.width
            const signX = signPageWidth - 60

            doc.setFontSize(11)
            doc.setFont('helvetica', 'normal')
            doc.text('Admin LMS', signX, signY, { align: 'center' })

            signY += 25
            doc.setFont('helvetica', 'bold')
            doc.text('Kukuh Bahtiar', signX, signY, { align: 'center' })

            // Save PDF
            doc.save(`Laporan_LMS_${exportStartDate}_${exportEndDate}.pdf`)
            setShowExportModal(false)

        } catch (err) {
            console.error('Export error:', err)
            alert('Gagal mengexport PDF: ' + err.message)
        } finally {
            setExporting(false)
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

    // Render Teacher Compliance Report - Executive Dashboard Style
    function renderTeacherCompliance() {
        if (!data) return null

        // Prepare donut chart data for activity mix
        const activityMixDonut = [
            {
                name: 'Sumber Daya Statis',
                value: data.activityMix?.static || 0,
                percentage: data.activityMix?.staticPercentage || 0,
                fill: '#3b82f6',
                description: 'PDF, PPT, Video Satu Arah'
            },
            {
                name: 'Aktivitas Interaktif',
                value: data.activityMix?.interactive || 0,
                percentage: data.activityMix?.interactivePercentage || 0,
                fill: '#f97316',
                description: 'Kuis, Tugas, Forum'
            }
        ]

        // Format large numbers
        const formatLargeNumber = (num) => {
            if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
            if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
            return num?.toString() || '0'
        }

        const getStatusColor = (status) => {
            switch (status) {
                case 'green': return 'text-green-400 bg-green-500/10 border-green-500/30'
                case 'yellow': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30'
                case 'red': return 'text-red-400 bg-red-500/10 border-red-500/30'
                default: return 'text-dark-400 bg-dark-700'
            }
        }

        const getStatusEmoji = (status) => {
            switch (status) {
                case 'green': return '🟢'
                case 'yellow': return '🟡'
                case 'red': return '🔴'
                default: return ''
            }
        }

        return (
            <div className="space-y-6">
                {/* Executive Dashboard Header */}
                <div className="glass-card p-4">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h3 className="text-lg font-semibold text-white">Laporan Eksekutif LMS Sekolah</h3>
                            <p className="text-dark-400 text-sm">Periode: <span className="font-semibold text-white">{data.period?.month}</span></p>
                        </div>
                        <button
                            onClick={() => setShowExportModal(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors"
                        >
                            <Download className="w-4 h-4" />
                            Export PDF
                        </button>
                    </div>
                </div>

                {/* Summary Cards - 3 Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Card 1: Guru Aktif */}
                    <div className="glass-card p-5 border border-blue-500/20">
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/20 flex items-center justify-center">
                                <Users className="w-6 h-6 text-blue-400" />
                            </div>
                            <div className="flex-1">
                                <p className="text-dark-400 text-sm">Guru Aktif Bulan Ini</p>
                                <p className="text-2xl font-bold text-white mt-1">
                                    {data.summary?.activeTeachers || 0} / {data.summary?.totalTeachers || 0}
                                </p>
                                <p className="text-blue-400 text-sm font-medium mt-1">
                                    {data.summary?.participationRate || 0}% Partisipasi
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Card 2: Tingkat Kepatuhan */}
                    <div className="glass-card p-5 border border-yellow-500/20">
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-500/20 to-orange-600/20 flex items-center justify-center">
                                <AlertTriangle className="w-6 h-6 text-yellow-400" />
                            </div>
                            <div className="flex-1">
                                <p className="text-dark-400 text-sm">Tingkat Kepatuhan (Target ≥4x)</p>
                                <p className="text-2xl font-bold text-white mt-1">
                                    {data.summary?.complianceRate || 0}%
                                </p>
                                <p className="text-yellow-400 text-sm font-medium mt-1">
                                    ⚠️ {data.summary?.nonCompliantCount || 0} Guru Belum Patuh
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Card 3: Total Interaksi Siswa */}
                    <div className="glass-card p-5 border border-green-500/20">
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-600/20 flex items-center justify-center">
                                <TrendingUp className="w-6 h-6 text-green-400" />
                            </div>
                            <div className="flex-1">
                                <p className="text-dark-400 text-sm">Total Interaksi Siswa</p>
                                <p className="text-2xl font-bold text-white mt-1">
                                    {formatLargeNumber(data.summary?.totalStudentInteractions)}
                                </p>
                                <p className={`text-sm font-medium mt-1 ${data.summary?.interactionChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {data.summary?.interactionChange >= 0 ? '↑' : '↓'} {Math.abs(data.summary?.interactionChange || 0)}% dari bulan lalu
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content: Table and Chart Side by Side */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Panel: Compliance Table (2/3 width) */}
                    <div className="lg:col-span-2 glass-card overflow-hidden">
                        <div className="p-4 border-b border-dark-700/50">
                            <h3 className="font-semibold text-white flex items-center gap-2">
                                <ClipboardList className="w-4 h-4 text-primary-400" />
                                Status Kepatuhan & Keaktifan Guru
                            </h3>
                            <p className="text-dark-500 text-xs mt-1">Mandat Pimpinan: Minimal 4 aktivitas per bulan</p>
                        </div>
                        <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                            <table className="data-table">
                                <thead className="sticky top-0 bg-dark-800">
                                    <tr>
                                        <th>Nama Guru</th>
                                        <th>Mata Pelajaran</th>
                                        <th className="text-center">Jml Aktivitas</th>
                                        <th className="text-center">Status Kepatuhan</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.teacherCompliance?.map((row, idx) => (
                                        <tr key={idx}>
                                            <td className="text-white font-medium">{row.firstname} {row.lastname}</td>
                                            <td className="text-dark-300">{row.course_name}</td>
                                            <td className="text-center">
                                                <span className="text-lg font-bold text-white">{row.activity_count}</span>
                                            </td>
                                            <td className="text-center">
                                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(row.status)}`}>
                                                    {getStatusEmoji(row.status)} {row.status_label}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Right Panel: Activity Mix Donut Chart (1/3 width) */}
                    <div className="glass-card overflow-hidden">
                        <div className="p-4 border-b border-dark-700/50">
                            <h3 className="font-semibold text-white flex items-center gap-2">
                                <Activity className="w-4 h-4 text-purple-400" />
                                Analisis Kualitas Konten
                            </h3>
                            <p className="text-dark-500 text-xs mt-1">Activity Mix: Statis vs Interaktif</p>
                        </div>
                        <div className="p-4" style={{ height: '280px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={activityMixDonut}
                                        cx="50%"
                                        cy="45%"
                                        innerRadius={50}
                                        outerRadius={80}
                                        paddingAngle={3}
                                        dataKey="value"
                                    >
                                        {activityMixDonut.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.fill} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: '#1f2937',
                                            border: '1px solid #374151',
                                            borderRadius: '8px'
                                        }}
                                        formatter={(value, name) => [formatNumber(value), name]}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        {/* Legend */}
                        <div className="px-4 pb-4 space-y-3">
                            {activityMixDonut.map((item, idx) => (
                                <div key={idx} className="flex items-center gap-3">
                                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: item.fill }}></div>
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-white">{item.name}</p>
                                        <p className="text-xs text-dark-500">{item.description}</p>
                                    </div>
                                    <p className="text-lg font-bold text-white">{item.percentage}%</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Daily Engagement Trend Chart */}
                <div className="glass-card overflow-hidden">
                    <div className="p-4 border-b border-dark-700/50">
                        <h3 className="font-semibold text-white flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-blue-400" />
                            Tren Keterlibatan Siswa (Harian)
                        </h3>
                        <p className="text-dark-500 text-xs mt-1">Aktivitas login dan interaksi siswa selama bulan berjalan</p>
                    </div>
                    <div className="p-4" style={{ height: '300px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data.dailyEngagement || []}>
                                <defs>
                                    <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                <XAxis
                                    dataKey="day"
                                    stroke="#9ca3af"
                                    tick={{ fontSize: 11 }}
                                    tickLine={false}
                                />
                                <YAxis
                                    stroke="#9ca3af"
                                    tick={{ fontSize: 11 }}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: '#1f2937',
                                        border: '1px solid #374151',
                                        borderRadius: '8px'
                                    }}
                                    labelStyle={{ color: '#fff' }}
                                    formatter={(value, name) => [formatNumber(value), name === 'users' ? 'Siswa Unik' : 'Total Aktivitas']}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="users"
                                    stroke="#3b82f6"
                                    strokeWidth={2}
                                    fillOpacity={1}
                                    fill="url(#colorUsers)"
                                    name="Siswa Aktif"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Top 5 Engaged Courses - For Teacher Appreciation */}
                <div className="glass-card overflow-hidden">
                    <div className="p-4 border-b border-dark-700/50">
                        <h3 className="font-semibold text-white flex items-center gap-2">
                            <Trophy className="w-4 h-4 text-yellow-400" />
                            Top 5 Kursus Paling Aktif (Apresiasi Guru)
                        </h3>
                        <p className="text-dark-500 text-xs mt-1">Berdasarkan log akses siswa bulan ini</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th className="w-12">#</th>
                                    <th>Kursus</th>
                                    <th>Pengajar</th>
                                    <th className="text-right">Total Akses</th>
                                    <th className="text-right">Siswa Unik</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.topEngagedCourses?.map((course, idx) => (
                                    <tr key={idx}>
                                        <td>
                                            <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${idx === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                                                idx === 1 ? 'bg-gray-400/20 text-gray-300' :
                                                    idx === 2 ? 'bg-orange-500/20 text-orange-400' :
                                                        'bg-dark-700 text-dark-300'
                                                }`}>
                                                {idx + 1}
                                            </span>
                                        </td>
                                        <td>
                                            <div>
                                                <p className="text-white font-medium">{course.course_name}</p>
                                                <p className="text-xs text-dark-500">{course.course_shortname}</p>
                                            </div>
                                        </td>
                                        <td className="text-dark-300">{course.teachers || '-'}</td>
                                        <td className="text-right">
                                            <span className="text-green-400 font-semibold">{formatNumber(course.total_access)}</span>
                                        </td>
                                        <td className="text-right text-dark-200">{formatNumber(course.unique_students)}</td>
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
            case 'teacher-compliance':
                return renderTeacherCompliance()
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

            {/* Export Modal */}
            {showExportModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="glass-card p-6 max-w-md w-full mx-4 rounded-2xl">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-semibold text-white">Export Laporan PDF</h3>
                            <button
                                onClick={() => setShowExportModal(false)}
                                className="text-dark-400 hover:text-white transition-colors"
                            >
                                <XCircle className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-dark-300 mb-2">Tanggal Mulai</label>
                                <input
                                    type="date"
                                    value={exportStartDate}
                                    onChange={(e) => setExportStartDate(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-dark-800/50 border border-dark-700 rounded-lg text-white focus:outline-none focus:border-primary-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-dark-300 mb-2">Tanggal Akhir</label>
                                <input
                                    type="date"
                                    value={exportEndDate}
                                    onChange={(e) => setExportEndDate(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-dark-800/50 border border-dark-700 rounded-lg text-white focus:outline-none focus:border-primary-500"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setShowExportModal(false)}
                                className="flex-1 px-4 py-2.5 bg-dark-700 hover:bg-dark-600 text-white rounded-lg transition-colors"
                            >
                                Batal
                            </button>
                            <button
                                onClick={exportToPDF}
                                disabled={exporting}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-500/50 text-white rounded-lg transition-colors"
                            >
                                {exporting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Mengexport...
                                    </>
                                ) : (
                                    <>
                                        <Download className="w-4 h-4" />
                                        Export PDF
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
