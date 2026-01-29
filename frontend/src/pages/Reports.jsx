import { useState, useEffect } from 'react'
import {
    BarChart3,
    GraduationCap,
    Users,
    Download,
    Loader2,
    FileText,
    FileSpreadsheet,
    File,
    Check,
    Clock,
    Trash2,
    ChevronDown,
    TrendingUp,
    Activity,
    BookOpen,
    Award,
    UserCheck,
    X,
    Search,
    Filter,
    Eye,
    AlertCircle,
    CheckCircle2,
    AlertTriangle
} from 'lucide-react'
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Legend,
    RadarChart,
    Radar,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis
} from 'recharts'
import { reportsApi } from '../services/api'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// Report types configuration
const REPORT_TYPES = [
    {
        id: 'executive-summary',
        title: 'Ringkasan Eksekutif',
        description: 'Ringkasan performa sekolah menyeluruh & KPI utama.',
        icon: BarChart3,
        color: 'primary'
    },
    {
        id: 'teacher-detail',
        title: 'Guru Detail',
        description: 'Analisis kinerja, kehadiran, dan efektivitas guru.',
        icon: Users,
        color: 'purple'
    },
    {
        id: 'student-detail',
        title: 'Siswa Detail',
        description: 'Detail nilai, keterlibatan, dan perkembangan siswa.',
        icon: GraduationCap,
        color: 'green'
    }
]

// Period options
const PERIOD_OPTIONS = [
    {
        id: 'this-month', label: 'Bulan Ini', getValue: () => {
            const now = new Date()
            const start = new Date(now.getFullYear(), now.getMonth(), 1)
            return { start, end: now }
        }
    },
    {
        id: 'last-3-months', label: '3 Bulan Terakhir', getValue: () => {
            const now = new Date()
            const start = new Date(now.getFullYear(), now.getMonth() - 3, 1)
            return { start, end: now }
        }
    },
    {
        id: 'last-6-months', label: '6 Bulan Terakhir', getValue: () => {
            const now = new Date()
            const start = new Date(now.getFullYear(), now.getMonth() - 6, 1)
            return { start, end: now }
        }
    },
    {
        id: 'this-year', label: 'Tahun Ini', getValue: () => {
            const now = new Date()
            const start = new Date(now.getFullYear(), 0, 1)
            return { start, end: now }
        }
    }
]

// Format file options
const FORMAT_OPTIONS = [
    { id: 'pdf', label: 'PDF', icon: FileText },
    { id: 'excel', label: 'Excel', icon: FileSpreadsheet },
    { id: 'csv', label: 'CSV', icon: File }
]

// Chart colors
const CHART_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6']
const GRADE_COLORS = {
    'A (90-100)': '#22c55e',
    'B (80-89)': '#3b82f6',
    'C (70-79)': '#f59e0b',
    'D (60-69)': '#f97316',
    'E (<60)': '#ef4444'
}

// Report type selection card
function ReportTypeCard({ report, isSelected, onSelect }) {
    const Icon = report.icon

    return (
        <button
            onClick={() => onSelect(report.id)}
            className={`
                relative p-6 rounded-2xl text-left transition-all duration-200
                ${isSelected
                    ? 'bg-white dark:bg-dark-800 border-2 border-primary-500 shadow-lg shadow-primary-500/10'
                    : 'bg-white dark:bg-dark-800/50 border-2 border-gray-200 dark:border-dark-700 hover:border-primary-300 dark:hover:border-dark-600'
                }
            `}
        >
            {isSelected && (
                <div className="absolute top-4 right-4 w-6 h-6 rounded-full bg-primary-500 flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                </div>
            )}
            <div className={`
                w-12 h-12 rounded-xl flex items-center justify-center mb-4
                ${report.color === 'primary' ? 'bg-primary-100 dark:bg-primary-500/20' : ''}
                ${report.color === 'purple' ? 'bg-purple-100 dark:bg-purple-500/20' : ''}
                ${report.color === 'green' ? 'bg-green-100 dark:bg-green-500/20' : ''}
            `}>
                <Icon className={`
                    w-6 h-6
                    ${report.color === 'primary' ? 'text-primary-500' : ''}
                    ${report.color === 'purple' ? 'text-purple-500' : ''}
                    ${report.color === 'green' ? 'text-green-500' : ''}
                `} />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{report.title}</h3>
            <p className="text-sm text-gray-500 dark:text-dark-400">{report.description}</p>
        </button>
    )
}

// KPI Card Component
function KPICard({ icon: Icon, label, value, suffix = '', trend, color = 'primary' }) {
    const colorClasses = {
        primary: 'bg-primary-100 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400',
        green: 'bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400',
        purple: 'bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400',
        orange: 'bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400'
    }

    return (
        <div className="bg-white dark:bg-dark-800/50 rounded-xl p-4 border border-gray-200 dark:border-dark-700">
            <div className="flex items-start justify-between mb-2">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClasses[color]}`}>
                    <Icon className="w-5 h-5" />
                </div>
                {trend && (
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${trend > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                        {trend > 0 ? '+' : ''}{trend}%
                    </span>
                )}
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}{suffix}</p>
            <p className="text-sm text-gray-500 dark:text-dark-400">{label}</p>
        </div>
    )
}

// Executive Summary Preview Component
function ExecutiveSummaryPreview({ data, isLoading }) {
    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
                <span className="ml-3 text-gray-500">Memuat data ringkasan...</span>
            </div>
        )
    }

    if (!data) return null

    const { kpiScorecard, loginTrends, lmsAdoption, gradeDistribution, popularActivities, participationPerClass } = data

    // Format login trends for chart
    const loginChartData = (loginTrends || []).map(item => ({
        date: new Date(item.date).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' }),
        logins: parseInt(item.login_count) || 0,
        users: parseInt(item.unique_users) || 0
    }))

    // Format grade distribution for chart
    const gradeChartData = (gradeDistribution || []).map(item => ({
        name: item.grade_range,
        value: parseInt(item.count) || 0,
        color: GRADE_COLORS[item.grade_range] || '#9ca3af'
    }))

    // Format popular activities for chart
    const activityChartData = (popularActivities || []).slice(0, 5).map(item => ({
        name: item.activity_label || item.activity_type,
        modules: parseInt(item.total_modules) || 0,
        access: parseInt(item.total_access) || 0
    }))

    // Adoption pie data
    const adoptionData = [
        { name: 'Course Aktif', value: lmsAdoption?.active || 0, color: '#22c55e' },
        { name: 'Course Kosong', value: (lmsAdoption?.total || 0) - (lmsAdoption?.active || 0), color: '#e5e7eb' }
    ]

    return (
        <div className="space-y-6 mt-6">
            {/* Section Header */}
            <div className="flex items-center gap-2 text-primary-600 dark:text-primary-400">
                <Activity className="w-5 h-5" />
                <h3 className="font-semibold">Preview Laporan Ringkasan Eksekutif</h3>
            </div>

            {/* KPI Scorecard */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KPICard
                    icon={Users}
                    label="Total Siswa Aktif"
                    value={kpiScorecard?.totalStudents?.toLocaleString() || 0}
                    color="primary"
                />
                <KPICard
                    icon={Award}
                    label="Rata-rata Nilai Sekolah"
                    value={kpiScorecard?.avgSchoolGrade || 0}
                    color="green"
                />
                <KPICard
                    icon={BookOpen}
                    label="Tingkat Adopsi LMS"
                    value={kpiScorecard?.adoptionRate || 0}
                    suffix="%"
                    color="purple"
                />
                <KPICard
                    icon={UserCheck}
                    label="Kehadiran Digital"
                    value={kpiScorecard?.digitalAttendanceRate || 0}
                    suffix="%"
                    color="orange"
                />
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Login Trends Chart */}
                <div className="bg-white dark:bg-dark-800/50 rounded-xl p-5 border border-gray-200 dark:border-dark-700">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-primary-500" />
                        Tren Login Mingguan
                    </h4>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={loginChartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                                <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: '#fff',
                                        border: '1px solid #e5e7eb',
                                        borderRadius: '8px'
                                    }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="users"
                                    name="Pengguna Unik"
                                    stroke="#3b82f6"
                                    strokeWidth={2}
                                    dot={{ fill: '#3b82f6' }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* LMS Adoption Gauge */}
                <div className="bg-white dark:bg-dark-800/50 rounded-xl p-5 border border-gray-200 dark:border-dark-700">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-green-500" />
                        Tingkat Adopsi LMS
                    </h4>
                    <div className="h-64 flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={adoptionData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {adoptionData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="text-center mt-2">
                        <span className="text-3xl font-bold text-green-500">{lmsAdoption?.percentage || 0}%</span>
                        <p className="text-sm text-gray-500">Course Aktif</p>
                    </div>
                </div>
            </div>

            {/* Charts Row 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Grade Distribution */}
                <div className="bg-white dark:bg-dark-800/50 rounded-xl p-5 border border-gray-200 dark:border-dark-700">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <Award className="w-4 h-4 text-purple-500" />
                        Distribusi Nilai Siswa
                    </h4>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={gradeChartData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                <XAxis type="number" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} stroke="#9ca3af" />
                                <Tooltip />
                                <Bar dataKey="value" name="Jumlah Siswa" radius={[0, 4, 4, 0]}>
                                    {gradeChartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Top Activities */}
                <div className="bg-white dark:bg-dark-800/50 rounded-xl p-5 border border-gray-200 dark:border-dark-700">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <Activity className="w-4 h-4 text-orange-500" />
                        Top 5 Aktivitas Terpopuler
                    </h4>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={activityChartData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                <XAxis type="number" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} stroke="#9ca3af" />
                                <Tooltip />
                                <Bar dataKey="access" name="Total Akses" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Participation Table */}
            <div className="bg-white dark:bg-dark-800/50 rounded-xl p-5 border border-gray-200 dark:border-dark-700">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-500" />
                    Tingkat Partisipasi Kelas/Kursus
                </h4>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-gray-200 dark:border-dark-700">
                                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600 dark:text-dark-300">Nama Kelas/Kursus</th>
                                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600 dark:text-dark-300">Guru</th>
                                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600 dark:text-dark-300">Siswa Terdaftar</th>
                                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600 dark:text-dark-300">Siswa Aktif</th>
                                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600 dark:text-dark-300">Partisipasi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(participationPerClass || []).slice(0, 10).map((item, idx) => (
                                <tr key={idx} className="border-b border-gray-100 dark:border-dark-700/50 hover:bg-gray-50 dark:hover:bg-dark-700/30">
                                    <td className="py-3 px-4 text-sm text-gray-900 dark:text-white">{item.course_name}</td>
                                    <td className="py-3 px-4 text-sm text-gray-600 dark:text-dark-400">{item.teacher_name || '-'}</td>
                                    <td className="py-3 px-4 text-sm text-right text-gray-600 dark:text-dark-400">{item.enrolled_students}</td>
                                    <td className="py-3 px-4 text-sm text-right text-gray-600 dark:text-dark-400">{item.active_students}</td>
                                    <td className="py-3 px-4 text-sm text-right">
                                        <span className={`font-medium ${parseFloat(item.participation_rate) >= 70 ? 'text-green-600' :
                                            parseFloat(item.participation_rate) >= 40 ? 'text-yellow-600' : 'text-red-600'
                                            }`}>
                                            {item.participation_rate}%
                                        </span>
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

// Teacher Detail Modal (Drill-down View)
function TeacherDetailModal({ teacher, onClose, period }) {
    const [detailData, setDetailData] = useState(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        if (teacher?.user_id) {
            loadTeacherDetail()
        }
    }, [teacher])

    async function loadTeacherDetail() {
        try {
            setIsLoading(true)
            const data = await reportsApi.getTeacherDetail(teacher.user_id, {
                startDate: period.startDate,
                endDate: period.endDate
            })
            setDetailData(data)
        } catch (error) {
            console.error('Error loading teacher detail:', error)
        } finally {
            setIsLoading(false)
        }
    }

    if (!teacher) return null

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-dark-700">
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                            Profil Performa: {teacher.firstname} {teacher.lastname}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-dark-400">{teacher.email}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
                            <span className="ml-3 text-gray-500">Memuat data detail...</span>
                        </div>
                    ) : detailData ? (
                        <div className="space-y-6">
                            {/* Radar Chart & Heatmap Row */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Radar Chart */}
                                <div className="bg-gray-50 dark:bg-dark-700/50 rounded-xl p-5">
                                    <h4 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                        <Activity className="w-4 h-4 text-purple-500" />
                                        Kompetensi Digital
                                    </h4>
                                    <div className="h-64">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <RadarChart data={detailData.radarData}>
                                                <PolarGrid stroke="#e5e7eb" />
                                                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
                                                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                                                <Radar
                                                    name="Score"
                                                    dataKey="value"
                                                    stroke="#8b5cf6"
                                                    fill="#8b5cf6"
                                                    fillOpacity={0.5}
                                                />
                                            </RadarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                {/* Activity Heatmap */}
                                <div className="bg-gray-50 dark:bg-dark-700/50 rounded-xl p-5">
                                    <h4 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                        <Clock className="w-4 h-4 text-green-500" />
                                        Pola Aktivitas (Heatmap)
                                    </h4>
                                    <div className="overflow-x-auto">
                                        <div className="min-w-[500px]">
                                            {['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'].map((day, dayIdx) => (
                                                <div key={day} className="flex items-center gap-1 mb-1">
                                                    <span className="w-16 text-xs text-gray-500">{day}</span>
                                                    <div className="flex gap-[2px]">
                                                        {Array.from({ length: 24 }, (_, hour) => {
                                                            const dayMapping = { 'Senin': 2, 'Selasa': 3, 'Rabu': 4, 'Kamis': 5, 'Jumat': 6, 'Sabtu': 7, 'Minggu': 1 }
                                                            const cell = (detailData.heatmapData || []).find(
                                                                h => h.dayIndex === dayMapping[day] && h.hour === hour
                                                            )
                                                            const count = cell?.count || 0
                                                            const intensity = Math.min(count / 10, 1)
                                                            return (
                                                                <div
                                                                    key={hour}
                                                                    className="w-4 h-4 rounded-sm"
                                                                    style={{
                                                                        backgroundColor: count > 0
                                                                            ? `rgba(34, 197, 94, ${0.2 + intensity * 0.8})`
                                                                            : '#f3f4f6'
                                                                    }}
                                                                    title={`${day} ${hour}:00 - ${count} aktivitas`}
                                                                />
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            ))}
                                            <div className="flex items-center gap-1 mt-2 ml-16">
                                                <span className="text-[10px] text-gray-400">0</span>
                                                {[6, 12, 18, 23].map(h => (
                                                    <span key={h} className="text-[10px] text-gray-400" style={{ marginLeft: `${h * 18 - 18}px` }}>{h}</span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Courses Table */}
                            <div className="bg-gray-50 dark:bg-dark-700/50 rounded-xl p-5">
                                <h4 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                    <BookOpen className="w-4 h-4 text-blue-500" />
                                    Kelas/Kursus yang Diampu
                                </h4>
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b border-gray-200 dark:border-dark-600">
                                                <th className="text-left py-2 px-3 text-xs font-semibold text-gray-600 dark:text-dark-300">Nama Kursus</th>
                                                <th className="text-left py-2 px-3 text-xs font-semibold text-gray-600 dark:text-dark-300">Kategori</th>
                                                <th className="text-right py-2 px-3 text-xs font-semibold text-gray-600 dark:text-dark-300">Siswa</th>
                                                <th className="text-right py-2 px-3 text-xs font-semibold text-gray-600 dark:text-dark-300">Selesai</th>
                                                <th className="text-right py-2 px-3 text-xs font-semibold text-gray-600 dark:text-dark-300">Progress</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(detailData.courses || []).map((course, idx) => (
                                                <tr key={idx} className="border-b border-gray-100 dark:border-dark-600/50">
                                                    <td className="py-2 px-3 text-sm text-gray-900 dark:text-white">{course.course_name}</td>
                                                    <td className="py-2 px-3 text-sm text-gray-500 dark:text-dark-400">{course.category_name || '-'}</td>
                                                    <td className="py-2 px-3 text-sm text-right text-gray-600 dark:text-dark-400">{course.enrolled_students}</td>
                                                    <td className="py-2 px-3 text-sm text-right text-gray-600 dark:text-dark-400">{course.completed_students}</td>
                                                    <td className="py-2 px-3 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <div className="w-16 h-2 bg-gray-200 dark:bg-dark-600 rounded-full overflow-hidden">
                                                                <div
                                                                    className={`h-full rounded-full ${course.completion_rate >= 70 ? 'bg-green-500' : course.completion_rate >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                                                    style={{ width: `${course.completion_rate}%` }}
                                                                />
                                                            </div>
                                                            <span className="text-xs font-medium text-gray-600 dark:text-dark-300">{course.completion_rate}%</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <p className="text-center text-gray-500">Tidak ada data</p>
                    )}
                </div>
            </div>
        </div>
    )
}

// Teacher Detail Preview (Master View)
function TeacherDetailPreview({ period, isLoading: parentLoading }) {
    const [data, setData] = useState(null)
    const [isLoading, setIsLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [filterStatus, setFilterStatus] = useState('all')
    const [filterCategory, setFilterCategory] = useState('all')
    const [sortBy, setSortBy] = useState('name')
    const [sortOrder, setSortOrder] = useState('asc')
    const [selectedTeacher, setSelectedTeacher] = useState(null)

    useEffect(() => {
        loadData()
    }, [period])

    async function loadData() {
        try {
            setIsLoading(true)
            const result = await reportsApi.getTeacherDetailMaster({
                startDate: period.startDate,
                endDate: period.endDate
            })
            setData(result)
        } catch (error) {
            console.error('Error loading teacher data:', error)
        } finally {
            setIsLoading(false)
        }
    }

    if (isLoading || parentLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
                <span className="ml-3 text-gray-500">Memuat data guru...</span>
            </div>
        )
    }

    if (!data) return null

    // Filter and sort teachers
    let filteredTeachers = (data.teachers || []).filter(teacher => {
        const matchesSearch = searchTerm === '' ||
            `${teacher.firstname} ${teacher.lastname}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (teacher.courses_taught || '').toLowerCase().includes(searchTerm.toLowerCase())
        const matchesStatus = filterStatus === 'all' || teacher.status === filterStatus
        const matchesCategory = filterCategory === 'all' ||
            (teacher.departments || '').includes(filterCategory)
        return matchesSearch && matchesStatus && matchesCategory
    })

    // Sort
    filteredTeachers.sort((a, b) => {
        let valA, valB
        switch (sortBy) {
            case 'name':
                valA = `${a.firstname} ${a.lastname}`
                valB = `${b.firstname} ${b.lastname}`
                break
            case 'login':
                valA = a.lastaccess || 0
                valB = b.lastaccess || 0
                break
            case 'updates':
                valA = parseInt(a.content_updates_7days) || 0
                valB = parseInt(b.content_updates_7days) || 0
                break
            case 'grading':
                valA = a.grading_percentage
                valB = b.grading_percentage
                break
            default:
                valA = a.firstname
                valB = b.firstname
        }
        if (sortOrder === 'asc') {
            return valA > valB ? 1 : -1
        }
        return valA < valB ? 1 : -1
    })

    const formatLastLogin = (timestamp) => {
        if (!timestamp || timestamp === 0) return 'Tidak pernah'
        const date = new Date(timestamp * 1000)
        const now = new Date()
        const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24))
        if (diffDays === 0) return 'Hari ini'
        if (diffDays === 1) return 'Kemarin'
        if (diffDays < 7) return `${diffDays} hari lalu`
        return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
    }

    const getStatusIcon = (status) => {
        switch (status) {
            case 'green': return <CheckCircle2 className="w-4 h-4 text-green-500" />
            case 'yellow': return <AlertTriangle className="w-4 h-4 text-yellow-500" />
            case 'red': return <AlertCircle className="w-4 h-4 text-red-500" />
            default: return null
        }
    }

    return (
        <div className="space-y-6 mt-6">
            {/* Header */}
            <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
                <Users className="w-5 h-5" />
                <h3 className="font-semibold">Preview Laporan Guru Detail</h3>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-dark-800/50 rounded-xl p-4 border border-gray-200 dark:border-dark-700">
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{data.summary?.total || 0}</p>
                    <p className="text-sm text-gray-500">Total Guru</p>
                </div>
                <div className="bg-white dark:bg-dark-800/50 rounded-xl p-4 border border-green-200 dark:border-green-500/30">
                    <p className="text-2xl font-bold text-green-600">{data.summary?.active || 0}</p>
                    <p className="text-sm text-gray-500">Aktif</p>
                </div>
                <div className="bg-white dark:bg-dark-800/50 rounded-xl p-4 border border-yellow-200 dark:border-yellow-500/30">
                    <p className="text-2xl font-bold text-yellow-600">{data.summary?.needsAttention || 0}</p>
                    <p className="text-sm text-gray-500">Perlu Perhatian</p>
                </div>
                <div className="bg-white dark:bg-dark-800/50 rounded-xl p-4 border border-red-200 dark:border-red-500/30">
                    <p className="text-2xl font-bold text-red-600">{data.summary?.inactive || 0}</p>
                    <p className="text-sm text-gray-500">Tidak Aktif</p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Cari nama guru atau kursus..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                </div>
                <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="px-4 py-2 bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-600 rounded-lg text-sm"
                >
                    <option value="all">Semua Status</option>
                    <option value="green">Aktif</option>
                    <option value="yellow">Perlu Perhatian</option>
                    <option value="red">Tidak Aktif</option>
                </select>
                <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="px-4 py-2 bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-600 rounded-lg text-sm"
                >
                    <option value="all">Semua Departemen</option>
                    {(data.categories || []).map(cat => (
                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                </select>
            </div>

            {/* Master Table */}
            <div className="bg-white dark:bg-dark-800/50 rounded-xl border border-gray-200 dark:border-dark-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-dark-700/50">
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 dark:text-dark-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-dark-600" onClick={() => { setSortBy('name'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc') }}>
                                    Nama Guru & Mapel {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                                </th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 dark:text-dark-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-dark-600" onClick={() => { setSortBy('login'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc') }}>
                                    Login Terakhir {sortBy === 'login' && (sortOrder === 'asc' ? '↑' : '↓')}
                                </th>
                                <th className="text-center py-3 px-4 text-xs font-semibold text-gray-600 dark:text-dark-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-dark-600" onClick={() => { setSortBy('updates'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc') }}>
                                    Update 7 Hari {sortBy === 'updates' && (sortOrder === 'asc' ? '↑' : '↓')}
                                </th>
                                <th className="text-center py-3 px-4 text-xs font-semibold text-gray-600 dark:text-dark-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-dark-600" onClick={() => { setSortBy('grading'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc') }}>
                                    % Penilaian {sortBy === 'grading' && (sortOrder === 'asc' ? '↑' : '↓')}
                                </th>
                                <th className="text-center py-3 px-4 text-xs font-semibold text-gray-600 dark:text-dark-300">
                                    Rata-rata Respon
                                </th>
                                <th className="text-center py-3 px-4 text-xs font-semibold text-gray-600 dark:text-dark-300">
                                    Aksi
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredTeachers.slice(0, 20).map((teacher, idx) => (
                                <tr key={teacher.user_id} className={`border-b border-gray-100 dark:border-dark-700/50 hover:bg-gray-50 dark:hover:bg-dark-700/30 ${teacher.status === 'red' ? 'bg-red-50/50 dark:bg-red-500/5' :
                                    teacher.status === 'yellow' ? 'bg-yellow-50/50 dark:bg-yellow-500/5' : ''
                                    }`}>
                                    <td className="py-3 px-4">
                                        <div className="flex items-center gap-2">
                                            {getStatusIcon(teacher.status)}
                                            <div>
                                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                                    {teacher.firstname} {teacher.lastname}
                                                </p>
                                                <p className="text-xs text-gray-500 dark:text-dark-400 truncate max-w-xs">
                                                    {teacher.courses_taught || '-'}
                                                </p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-3 px-4">
                                        <span className={`text-sm ${teacher.status === 'red' ? 'text-red-600 font-medium' : 'text-gray-600 dark:text-dark-400'}`}>
                                            {formatLastLogin(teacher.lastaccess)}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${parseInt(teacher.content_updates_7days) > 5 ? 'bg-green-100 text-green-700' :
                                            parseInt(teacher.content_updates_7days) > 0 ? 'bg-yellow-100 text-yellow-700' :
                                                'bg-gray-100 text-gray-500'
                                            }`}>
                                            {teacher.content_updates_7days || 0}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                        <span className={`text-sm font-medium ${teacher.grading_percentage >= 80 ? 'text-green-600' :
                                            teacher.grading_percentage >= 50 ? 'text-yellow-600' :
                                                'text-red-600'
                                            }`}>
                                            {teacher.grading_percentage}%
                                        </span>
                                    </td>
                                    <td className="py-3 px-4 text-center text-sm text-gray-600 dark:text-dark-400">
                                        {teacher.avg_response_hours > 0 ? `${teacher.avg_response_hours}h` : '-'}
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                        <button
                                            onClick={() => setSelectedTeacher(teacher)}
                                            className="p-2 text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-500/10 rounded-lg transition-colors"
                                            title="Lihat Detail"
                                        >
                                            <Eye className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {filteredTeachers.length > 20 && (
                    <div className="p-3 text-center text-sm text-gray-500 bg-gray-50 dark:bg-dark-700/30">
                        Menampilkan 20 dari {filteredTeachers.length} guru
                    </div>
                )}
            </div>

            {/* Detail Modal */}
            {selectedTeacher && (
                <TeacherDetailModal
                    teacher={selectedTeacher}
                    onClose={() => setSelectedTeacher(null)}
                    period={period}
                />
            )}
        </div>
    )
}

// Student Detail Modal (Drill-down View - Portfolio)
function StudentDetailModal({ student, onClose, period }) {
    const [detailData, setDetailData] = useState(null)
    const [isLoading, setIsLoading] = useState(true)
    const [expandedCourse, setExpandedCourse] = useState(null)

    useEffect(() => {
        if (student?.user_id) {
            loadStudentDetail()
        }
    }, [student])

    async function loadStudentDetail() {
        try {
            setIsLoading(true)
            const data = await reportsApi.getStudentDetail(student.user_id, {
                startDate: period.startDate,
                endDate: period.endDate
            })
            setDetailData(data)
        } catch (error) {
            console.error('Error loading student detail:', error)
        } finally {
            setIsLoading(false)
        }
    }

    if (!student) return null

    const getRiskColor = (level) => {
        switch (level) {
            case 'green': return 'bg-green-100 text-green-800 border-green-200'
            case 'yellow': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
            case 'red': return 'bg-red-100 text-red-800 border-red-200'
            default: return 'bg-gray-100 text-gray-800 border-gray-200'
        }
    }

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-dark-700">
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                            Portfolio Siswa: {student.firstname} {student.lastname}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-dark-400">{student.email}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
                            <span className="ml-3 text-gray-500">Memuat portfolio siswa...</span>
                        </div>
                    ) : detailData ? (
                        <div className="space-y-6">
                            {/* Tier 1: Scorecard */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                {/* Risk Level */}
                                <div className={`rounded-xl p-4 border-2 ${getRiskColor(detailData.scorecard?.riskLevel)}`}>
                                    <div className="flex items-center gap-2 mb-2">
                                        {detailData.scorecard?.riskLevel === 'green' && <CheckCircle2 className="w-5 h-5" />}
                                        {detailData.scorecard?.riskLevel === 'yellow' && <AlertTriangle className="w-5 h-5" />}
                                        {detailData.scorecard?.riskLevel === 'red' && <AlertCircle className="w-5 h-5" />}
                                        <span className="font-semibold">Status Risiko</span>
                                    </div>
                                    <p className="text-2xl font-bold">{detailData.scorecard?.riskLabel}</p>
                                    {detailData.scorecard?.warnings?.length > 0 && (
                                        <ul className="text-xs mt-2 space-y-1">
                                            {detailData.scorecard.warnings.map((w, i) => (
                                                <li key={i}>• {w}</li>
                                            ))}
                                        </ul>
                                    )}
                                </div>

                                {/* Overall Progress */}
                                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-500/30">
                                    <p className="text-sm text-blue-600 dark:text-blue-400 mb-2">Ketuntasan Kurikulum</p>
                                    <div className="relative w-20 h-20 mx-auto">
                                        <svg className="w-20 h-20 transform -rotate-90">
                                            <circle cx="40" cy="40" r="35" stroke="#e5e7eb" strokeWidth="6" fill="none" />
                                            <circle
                                                cx="40" cy="40" r="35"
                                                stroke="#3b82f6"
                                                strokeWidth="6"
                                                fill="none"
                                                strokeDasharray={`${(detailData.scorecard?.overallProgress || 0) * 2.2} 220`}
                                                strokeLinecap="round"
                                            />
                                        </svg>
                                        <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-blue-600">
                                            {detailData.scorecard?.overallProgress || 0}%
                                        </span>
                                    </div>
                                    <p className="text-xs text-center mt-2 text-gray-500">
                                        {detailData.scorecard?.completedCourses}/{detailData.scorecard?.totalCourses} Kursus
                                    </p>
                                </div>

                                {/* Average Grade */}
                                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 border border-purple-200 dark:border-purple-500/30">
                                    <p className="text-sm text-purple-600 dark:text-purple-400 mb-2">Nilai Rata-rata</p>
                                    <p className={`text-4xl font-bold ${detailData.scorecard?.avgGrade >= 70 ? 'text-green-600' :
                                        detailData.scorecard?.avgGrade >= 60 ? 'text-yellow-600' :
                                            'text-red-600'
                                        }`}>
                                        {detailData.scorecard?.avgGrade || 0}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">Dari skala 100</p>
                                </div>

                                {/* Last Activity */}
                                <div className="bg-gray-50 dark:bg-dark-700/50 rounded-xl p-4 border border-gray-200 dark:border-dark-600">
                                    <p className="text-sm text-gray-600 dark:text-dark-400 mb-2">Login Terakhir</p>
                                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                                        {detailData.student?.lastaccess ?
                                            new Date(detailData.student.lastaccess * 1000).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
                                            : 'Tidak pernah'}
                                    </p>
                                </div>
                            </div>

                            {/* Tier 2: Visualizations */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Grade Trend */}
                                <div className="bg-gray-50 dark:bg-dark-700/50 rounded-xl p-5">
                                    <h4 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                        <TrendingUp className="w-4 h-4 text-blue-500" />
                                        Tren Nilai
                                    </h4>
                                    {(detailData.gradeTrend || []).length > 0 ? (
                                        <div className="h-48">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={detailData.gradeTrend}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                                                    <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                                                    <Tooltip content={({ active, payload }) => {
                                                        if (active && payload?.length) {
                                                            return (
                                                                <div className="bg-white dark:bg-dark-700 p-2 rounded shadow text-sm">
                                                                    <p className="font-medium">{payload[0].payload.name}</p>
                                                                    <p className="text-blue-600">Nilai: {payload[0].value}%</p>
                                                                </div>
                                                            )
                                                        }
                                                        return null
                                                    }} />
                                                    <Line type="monotone" dataKey="grade" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </div>
                                    ) : (
                                        <p className="text-center text-gray-500 py-8">Belum ada data nilai</p>
                                    )}
                                </div>

                                {/* Engagement Radar */}
                                <div className="bg-gray-50 dark:bg-dark-700/50 rounded-xl p-5">
                                    <h4 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                        <Activity className="w-4 h-4 text-purple-500" />
                                        Profil Aktivitas
                                    </h4>
                                    <div className="h-48">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <RadarChart data={detailData.engagementData}>
                                                <PolarGrid stroke="#e5e7eb" />
                                                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
                                                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                                                <Radar
                                                    name="Engagement"
                                                    dataKey="value"
                                                    stroke="#8b5cf6"
                                                    fill="#8b5cf6"
                                                    fillOpacity={0.5}
                                                />
                                            </RadarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>

                            {/* Timeline Heatmap */}
                            <div className="bg-gray-50 dark:bg-dark-700/50 rounded-xl p-5">
                                <h4 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-green-500" />
                                    Pola Belajar (Timeline)
                                </h4>
                                <div className="overflow-x-auto">
                                    <div className="min-w-[500px]">
                                        {['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'].map((day) => (
                                            <div key={day} className="flex items-center gap-1 mb-1">
                                                <span className="w-16 text-xs text-gray-500">{day}</span>
                                                <div className="flex gap-[2px]">
                                                    {Array.from({ length: 24 }, (_, hour) => {
                                                        const dayMapping = { 'Senin': 2, 'Selasa': 3, 'Rabu': 4, 'Kamis': 5, 'Jumat': 6, 'Sabtu': 7, 'Minggu': 1 }
                                                        const cell = (detailData.timelineData || []).find(
                                                            h => h.dayIndex === dayMapping[day] && h.hour === hour
                                                        )
                                                        const count = cell?.count || 0
                                                        const intensity = Math.min(count / 10, 1)
                                                        return (
                                                            <div
                                                                key={hour}
                                                                className="w-4 h-4 rounded-sm"
                                                                style={{
                                                                    backgroundColor: count > 0
                                                                        ? `rgba(59, 130, 246, ${0.2 + intensity * 0.8})`
                                                                        : '#f3f4f6'
                                                                }}
                                                                title={`${day} ${hour}:00 - ${count} aktivitas`}
                                                            />
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Tier 3: Course Details (Accordion) */}
                            <div className="bg-gray-50 dark:bg-dark-700/50 rounded-xl p-5">
                                <h4 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                    <BookOpen className="w-4 h-4 text-blue-500" />
                                    Detail Per Mata Pelajaran
                                </h4>
                                <div className="space-y-2">
                                    {(detailData.courses || []).map((course, idx) => (
                                        <div key={idx} className="border border-gray-200 dark:border-dark-600 rounded-lg overflow-hidden">
                                            <button
                                                onClick={() => setExpandedCourse(expandedCourse === idx ? null : idx)}
                                                className="w-full flex items-center justify-between p-3 bg-white dark:bg-dark-700 hover:bg-gray-50 dark:hover:bg-dark-600"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <span className={`w-2 h-2 rounded-full ${course.status === 'completed' ? 'bg-green-500' :
                                                        course.status === 'behind' ? 'bg-red-500' : 'bg-blue-500'
                                                        }`} />
                                                    <span className="font-medium text-sm text-gray-900 dark:text-white">{course.course_name}</span>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <span className={`text-sm font-semibold ${course.grade_percentage >= 70 ? 'text-green-600' :
                                                        course.grade_percentage >= 60 ? 'text-yellow-600' :
                                                            course.grade_percentage > 0 ? 'text-red-600' : 'text-gray-400'
                                                        }`}>
                                                        {course.grade_percentage > 0 ? `${course.grade_percentage}%` : '-'}
                                                    </span>
                                                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expandedCourse === idx ? 'rotate-180' : ''}`} />
                                                </div>
                                            </button>
                                            {expandedCourse === idx && (
                                                <div className="p-4 bg-gray-50 dark:bg-dark-800 border-t border-gray-200 dark:border-dark-600">
                                                    <div className="grid grid-cols-3 gap-4 text-sm">
                                                        <div>
                                                            <p className="text-gray-500">Status Tugas</p>
                                                            <p className="font-medium">
                                                                <span className="text-green-600">{course.submitted_assignments} Selesai</span>
                                                                {course.missing_assignments > 0 && (
                                                                    <span className="text-red-600 ml-2">{course.missing_assignments} Belum</span>
                                                                )}
                                                            </p>
                                                        </div>
                                                        <div>
                                                            <p className="text-gray-500">Total Tugas</p>
                                                            <p className="font-medium">{course.total_assignments}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-gray-500">Kategori</p>
                                                            <p className="font-medium">{course.category_name || '-'}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <p className="text-center text-gray-500">Tidak ada data</p>
                    )}
                </div>
            </div>
        </div>
    )
}

// Student Detail Preview (Master View)
function StudentDetailPreview({ period, isLoading: parentLoading }) {
    const [data, setData] = useState(null)
    const [isLoading, setIsLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [filterRisk, setFilterRisk] = useState('all')
    const [sortBy, setSortBy] = useState('name')
    const [sortOrder, setSortOrder] = useState('asc')
    const [selectedStudent, setSelectedStudent] = useState(null)

    useEffect(() => {
        loadData()
    }, [period])

    async function loadData() {
        try {
            setIsLoading(true)
            const result = await reportsApi.getStudentDetailMaster({
                startDate: period.startDate,
                endDate: period.endDate
            })
            setData(result)
        } catch (error) {
            console.error('Error loading student data:', error)
        } finally {
            setIsLoading(false)
        }
    }

    if (isLoading || parentLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
                <span className="ml-3 text-gray-500">Memuat data siswa...</span>
            </div>
        )
    }

    if (!data) return null

    // Filter and sort students
    let filteredStudents = (data.students || []).filter(student => {
        const matchesSearch = searchTerm === '' ||
            `${student.firstname} ${student.lastname}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (student.enrolled_courses || '').toLowerCase().includes(searchTerm.toLowerCase())
        const matchesRisk = filterRisk === 'all' || student.risk_level === filterRisk
        return matchesSearch && matchesRisk
    })

    // Sort
    filteredStudents.sort((a, b) => {
        let valA, valB
        switch (sortBy) {
            case 'name':
                valA = `${a.firstname} ${a.lastname}`
                valB = `${b.firstname} ${b.lastname}`
                break
            case 'grade':
                valA = a.avg_grade || 0
                valB = b.avg_grade || 0
                break
            case 'progress':
                valA = a.completion_rate || 0
                valB = b.completion_rate || 0
                break
            case 'risk':
                const riskOrder = { red: 0, yellow: 1, green: 2 }
                valA = riskOrder[a.risk_level] ?? 3
                valB = riskOrder[b.risk_level] ?? 3
                break
            default:
                valA = a.firstname
                valB = b.firstname
        }
        if (sortOrder === 'asc') {
            return valA > valB ? 1 : -1
        }
        return valA < valB ? 1 : -1
    })

    const getRiskIcon = (level) => {
        switch (level) {
            case 'green': return <CheckCircle2 className="w-4 h-4 text-green-500" />
            case 'yellow': return <AlertTriangle className="w-4 h-4 text-yellow-500" />
            case 'red': return <AlertCircle className="w-4 h-4 text-red-500" />
            default: return null
        }
    }

    return (
        <div className="space-y-6 mt-6">
            {/* Header */}
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                <GraduationCap className="w-5 h-5" />
                <h3 className="font-semibold">Preview Laporan Siswa Detail</h3>
            </div>

            {/* Summary Cards with Early Warning */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-dark-800/50 rounded-xl p-4 border border-gray-200 dark:border-dark-700">
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{data.summary?.total || 0}</p>
                    <p className="text-sm text-gray-500">Total Siswa</p>
                </div>
                <div className="bg-white dark:bg-dark-800/50 rounded-xl p-4 border border-green-200 dark:border-green-500/30">
                    <p className="text-2xl font-bold text-green-600">{data.summary?.safe || 0}</p>
                    <p className="text-sm text-gray-500">Aman</p>
                </div>
                <div className="bg-white dark:bg-dark-800/50 rounded-xl p-4 border border-yellow-200 dark:border-yellow-500/30">
                    <p className="text-2xl font-bold text-yellow-600">{data.summary?.needsAttention || 0}</p>
                    <p className="text-sm text-gray-500">Perlu Perhatian</p>
                </div>
                <div className="bg-white dark:bg-dark-800/50 rounded-xl p-4 border border-red-200 dark:border-red-500/30">
                    <p className="text-2xl font-bold text-red-600">{data.summary?.critical || 0}</p>
                    <p className="text-sm text-gray-500">Kritis</p>
                </div>
            </div>

            {/* Early Warning Alert */}
            {data.summary?.critical > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
                        <div>
                            <p className="font-semibold text-red-800 dark:text-red-400">⚠️ Early Warning System</p>
                            <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                                {data.summary.critical} siswa dalam kondisi kritis membutuhkan perhatian segera.
                                Klik tombol mata untuk melihat detail dan rekomendasi tindakan.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Cari nama siswa atau kursus..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                </div>
                <select
                    value={filterRisk}
                    onChange={(e) => setFilterRisk(e.target.value)}
                    className="px-4 py-2 bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-600 rounded-lg text-sm"
                >
                    <option value="all">Semua Status Risiko</option>
                    <option value="green">Aman</option>
                    <option value="yellow">Perlu Perhatian</option>
                    <option value="red">Kritis</option>
                </select>
            </div>

            {/* Master Table */}
            <div className="bg-white dark:bg-dark-800/50 rounded-xl border border-gray-200 dark:border-dark-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-dark-700/50">
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 dark:text-dark-300 cursor-pointer hover:bg-gray-100" onClick={() => { setSortBy('risk'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc') }}>
                                    Status {sortBy === 'risk' && (sortOrder === 'asc' ? '↑' : '↓')}
                                </th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 dark:text-dark-300 cursor-pointer hover:bg-gray-100" onClick={() => { setSortBy('name'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc') }}>
                                    Nama Siswa {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                                </th>
                                <th className="text-center py-3 px-4 text-xs font-semibold text-gray-600 dark:text-dark-300 cursor-pointer hover:bg-gray-100" onClick={() => { setSortBy('progress'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc') }}>
                                    Ketuntasan {sortBy === 'progress' && (sortOrder === 'asc' ? '↑' : '↓')}
                                </th>
                                <th className="text-center py-3 px-4 text-xs font-semibold text-gray-600 dark:text-dark-300 cursor-pointer hover:bg-gray-100" onClick={() => { setSortBy('grade'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc') }}>
                                    Nilai Rata-rata {sortBy === 'grade' && (sortOrder === 'asc' ? '↑' : '↓')}
                                </th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 dark:text-dark-300">
                                    Peringatan
                                </th>
                                <th className="text-center py-3 px-4 text-xs font-semibold text-gray-600 dark:text-dark-300">
                                    Aksi
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredStudents.slice(0, 25).map((student, idx) => (
                                <tr key={student.user_id} className={`border-b border-gray-100 dark:border-dark-700/50 hover:bg-gray-50 dark:hover:bg-dark-700/30 ${student.risk_level === 'red' ? 'bg-red-50/50 dark:bg-red-500/5' :
                                    student.risk_level === 'yellow' ? 'bg-yellow-50/50 dark:bg-yellow-500/5' : ''
                                    }`}>
                                    <td className="py-3 px-4">
                                        {getRiskIcon(student.risk_level)}
                                    </td>
                                    <td className="py-3 px-4">
                                        <div>
                                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                                                {student.firstname} {student.lastname}
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-dark-400 truncate max-w-xs">
                                                {student.enrolled_courses || '-'}
                                            </p>
                                        </div>
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            <div className="w-16 h-2 bg-gray-200 dark:bg-dark-600 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full ${student.completion_rate >= 70 ? 'bg-green-500' :
                                                        student.completion_rate >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                                                        }`}
                                                    style={{ width: `${student.completion_rate}%` }}
                                                />
                                            </div>
                                            <span className="text-xs font-medium text-gray-600">{student.completion_rate}%</span>
                                        </div>
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                        <span className={`text-sm font-semibold ${student.avg_grade >= 70 ? 'text-green-600' :
                                            student.avg_grade >= 60 ? 'text-yellow-600' :
                                                student.avg_grade > 0 ? 'text-red-600' : 'text-gray-400'
                                            }`}>
                                            {student.avg_grade > 0 ? student.avg_grade : '-'}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4">
                                        {student.warnings?.length > 0 ? (
                                            <span className="text-xs text-red-600 dark:text-red-400">
                                                {student.warnings[0]}
                                            </span>
                                        ) : (
                                            <span className="text-xs text-green-600">Tidak ada masalah</span>
                                        )}
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                        <button
                                            onClick={() => setSelectedStudent(student)}
                                            className="p-2 text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-500/10 rounded-lg transition-colors"
                                            title="Lihat Portfolio"
                                        >
                                            <Eye className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {filteredStudents.length > 25 && (
                    <div className="p-3 text-center text-sm text-gray-500 bg-gray-50 dark:bg-dark-700/30">
                        Menampilkan 25 dari {filteredStudents.length} siswa
                    </div>
                )}
            </div>

            {/* Detail Modal */}
            {selectedStudent && (
                <StudentDetailModal
                    student={selectedStudent}
                    onClose={() => setSelectedStudent(null)}
                    period={period}
                />
            )}
        </div>
    )
}

export default function Reports() {
    // State
    const [selectedReport, setSelectedReport] = useState('executive-summary')
    const [selectedPeriod, setSelectedPeriod] = useState('this-month')
    const [selectedFormat, setSelectedFormat] = useState('pdf')
    const [isGenerating, setIsGenerating] = useState(false)
    const [showPeriodDropdown, setShowPeriodDropdown] = useState(false)
    const [recentReports, setRecentReports] = useState([])
    const [executiveSummaryData, setExecutiveSummaryData] = useState(null)
    const [isLoadingPreview, setIsLoadingPreview] = useState(false)

    // Load recent reports from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('lms_recent_reports')
        if (saved) {
            setRecentReports(JSON.parse(saved))
        }
    }, [])

    // Load executive summary preview when selected
    useEffect(() => {
        if (selectedReport === 'executive-summary') {
            loadExecutiveSummary()
        }
    }, [selectedReport, selectedPeriod])

    async function loadExecutiveSummary() {
        try {
            setIsLoadingPreview(true)
            const period = PERIOD_OPTIONS.find(p => p.id === selectedPeriod)
            const { start, end } = period.getValue()
            const data = await reportsApi.getExecutiveSummary({
                startDate: start.toISOString().split('T')[0],
                endDate: end.toISOString().split('T')[0]
            })
            setExecutiveSummaryData(data)
        } catch (error) {
            console.error('Error loading executive summary:', error)
        } finally {
            setIsLoadingPreview(false)
        }
    }

    // Save recent reports to localStorage
    function saveRecentReports(reports) {
        localStorage.setItem('lms_recent_reports', JSON.stringify(reports))
        setRecentReports(reports)
    }

    // Format date for display
    function formatDate(dateStr) {
        const date = new Date(dateStr)
        return date.toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    // Get current period label
    function getCurrentPeriodLabel() {
        const period = PERIOD_OPTIONS.find(p => p.id === selectedPeriod)
        if (!period) return ''

        const { start } = period.getValue()
        const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
            'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

        if (selectedPeriod === 'this-month') {
            return `Bulan Ini (${monthNames[start.getMonth()]} ${start.getFullYear()})`
        }
        return period.label
    }

    // Generate report
    async function handleGenerateReport() {
        try {
            setIsGenerating(true)

            const period = PERIOD_OPTIONS.find(p => p.id === selectedPeriod)
            const { start, end } = period.getValue()
            const startDate = start.toISOString().split('T')[0]
            const endDate = end.toISOString().split('T')[0]

            const reportType = REPORT_TYPES.find(r => r.id === selectedReport)

            // Fetch data based on report type
            let reportData
            switch (selectedReport) {
                case 'executive-summary':
                    reportData = executiveSummaryData || await reportsApi.getExecutiveSummary({ startDate, endDate })
                    break
                case 'teacher-detail':
                    reportData = await reportsApi.getTeacherActivity({ startDate, endDate })
                    break
                case 'student-detail':
                    reportData = await reportsApi.getStudentActivity({ startDate, endDate })
                    break
                default:
                    reportData = {}
            }

            // Generate file based on format
            let filename = ''
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)

            if (selectedFormat === 'pdf') {
                filename = await generatePDF(reportType, reportData, startDate, endDate, timestamp)
            } else if (selectedFormat === 'excel' || selectedFormat === 'csv') {
                filename = generateCSV(reportType, reportData, startDate, endDate, timestamp, selectedFormat)
            }

            // Add to recent reports
            const newReport = {
                id: Date.now(),
                name: filename,
                type: reportType.title,
                format: selectedFormat.toUpperCase(),
                createdAt: new Date().toISOString()
            }

            const updatedReports = [newReport, ...recentReports].slice(0, 10)
            saveRecentReports(updatedReports)

        } catch (error) {
            console.error('Error generating report:', error)
            alert('Gagal generate laporan: ' + error.message)
        } finally {
            setIsGenerating(false)
        }
    }

    // Generate PDF report
    async function generatePDF(reportType, data, startDate, endDate, timestamp) {
        const doc = new jsPDF()
        const pageWidth = doc.internal.pageSize.getWidth()

        // Title
        doc.setFontSize(16)
        doc.setFont('helvetica', 'bold')
        doc.text(`LAPORAN ${reportType.title.toUpperCase()}`, pageWidth / 2, 20, { align: 'center' })
        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        doc.text(`Periode: ${startDate} s/d ${endDate}`, pageWidth / 2, 28, { align: 'center' })
        doc.text(`Digenerate: ${new Date().toLocaleString('id-ID')}`, pageWidth / 2, 34, { align: 'center' })

        let yPos = 50

        // Content based on report type
        if (reportType.id === 'executive-summary' && data) {
            // KPI Scorecard
            doc.setFontSize(12)
            doc.setFont('helvetica', 'bold')
            doc.text('KPI Utama', 14, yPos)
            yPos += 8

            const kpi = data.kpiScorecard || {}
            const kpiData = [
                ['Total Siswa Aktif', kpi.totalStudents?.toLocaleString() || '0'],
                ['Total Guru', kpi.totalTeachers?.toLocaleString() || '0'],
                ['Total Course', kpi.totalCourses?.toLocaleString() || '0'],
                ['Rata-rata Nilai Sekolah', `${kpi.avgSchoolGrade || 0}`],
                ['Tingkat Adopsi LMS', `${kpi.adoptionRate || 0}%`],
                ['Tingkat Ketuntasan', `${kpi.completionRate || 0}%`],
                ['Kehadiran Digital', `${kpi.digitalAttendanceRate || 0}%`],
                ['Pengguna Aktif Hari Ini', kpi.dailyActiveUsers?.toLocaleString() || '0']
            ]

            autoTable(doc, {
                startY: yPos,
                body: kpiData,
                theme: 'grid',
                bodyStyles: { fontSize: 10 },
                columnStyles: { 0: { fontStyle: 'bold' } },
                margin: { left: 14, right: 14 }
            })

            yPos = doc.lastAutoTable.finalY + 15

            // Grade Distribution
            if (data.gradeDistribution?.length > 0) {
                doc.setFontSize(12)
                doc.setFont('helvetica', 'bold')
                doc.text('Distribusi Nilai Siswa', 14, yPos)
                yPos += 8

                autoTable(doc, {
                    startY: yPos,
                    head: [['Rentang Nilai', 'Jumlah Siswa']],
                    body: data.gradeDistribution.map(g => [g.grade_range, g.count?.toString() || '0']),
                    theme: 'grid',
                    headStyles: { fillColor: [59, 130, 246], fontSize: 10 },
                    bodyStyles: { fontSize: 9 },
                    margin: { left: 14, right: 14 }
                })
                yPos = doc.lastAutoTable.finalY + 15
            }

            // Popular Activities
            if (data.popularActivities?.length > 0) {
                doc.setFontSize(12)
                doc.setFont('helvetica', 'bold')
                doc.text('Top 5 Aktivitas Terpopuler', 14, yPos)
                yPos += 8

                autoTable(doc, {
                    startY: yPos,
                    head: [['Aktivitas', 'Jumlah Modul', 'Total Akses']],
                    body: data.popularActivities.map(a => [
                        a.activity_label || a.activity_type,
                        a.total_modules?.toString() || '0',
                        a.total_access?.toString() || '0'
                    ]),
                    theme: 'grid',
                    headStyles: { fillColor: [245, 158, 11], fontSize: 10 },
                    bodyStyles: { fontSize: 9 },
                    margin: { left: 14, right: 14 }
                })
                yPos = doc.lastAutoTable.finalY + 15
            }

            // Participation per Class
            if (data.participationPerClass?.length > 0) {
                // Check if need new page
                if (yPos > 240) {
                    doc.addPage()
                    yPos = 20
                }

                doc.setFontSize(12)
                doc.setFont('helvetica', 'bold')
                doc.text('Tingkat Partisipasi Kelas/Kursus', 14, yPos)
                yPos += 8

                autoTable(doc, {
                    startY: yPos,
                    head: [['Nama Kelas/Kursus', 'Guru', 'Siswa Terdaftar', 'Siswa Aktif', 'Partisipasi']],
                    body: data.participationPerClass.map(p => [
                        p.course_name,
                        p.teacher_name || '-',
                        p.enrolled_students?.toString() || '0',
                        p.active_students?.toString() || '0',
                        `${p.participation_rate}%`
                    ]),
                    theme: 'grid',
                    headStyles: { fillColor: [34, 197, 94], fontSize: 10 },
                    bodyStyles: { fontSize: 9 },
                    margin: { left: 14, right: 14 }
                })
            }

        } else if (reportType.id === 'teacher-detail' && data) {
            doc.setFontSize(12)
            doc.setFont('helvetica', 'bold')
            doc.text('Aktivitas Guru', 14, yPos)
            yPos += 8

            if (data.totalActivitySummary?.length > 0) {
                autoTable(doc, {
                    startY: yPos,
                    head: [['Nama', 'Total Aktivitas', 'Hari Aktif']],
                    body: data.totalActivitySummary.slice(0, 30).map(t => [
                        `${t.firstname} ${t.lastname}`,
                        t.total_activities?.toString() || '0',
                        t.active_days?.toString() || '0'
                    ]),
                    theme: 'grid',
                    headStyles: { fillColor: [139, 92, 246], fontSize: 10 },
                    bodyStyles: { fontSize: 9 },
                    margin: { left: 14, right: 14 }
                })
            }

        } else if (reportType.id === 'student-detail' && data) {
            doc.setFontSize(12)
            doc.setFont('helvetica', 'bold')
            doc.text('Aktivitas Siswa', 14, yPos)
            yPos += 8

            if (data.totalActivitySummary?.length > 0) {
                autoTable(doc, {
                    startY: yPos,
                    head: [['Nama', 'Total Aktivitas', 'Hari Aktif']],
                    body: data.totalActivitySummary.slice(0, 30).map(s => [
                        `${s.firstname} ${s.lastname}`,
                        s.total_activities?.toString() || '0',
                        s.active_days?.toString() || '0'
                    ]),
                    theme: 'grid',
                    headStyles: { fillColor: [34, 197, 94], fontSize: 10 },
                    bodyStyles: { fontSize: 9 },
                    margin: { left: 14, right: 14 }
                })
            }
        }

        // Save
        const filename = `${reportType.title.replace(/\s+/g, '_')}_${timestamp}.pdf`
        doc.save(filename)
        return filename
    }

    // Generate CSV/Excel
    function generateCSV(reportType, data, startDate, endDate, timestamp, format) {
        let csvContent = ''

        // Header
        csvContent += `Laporan: ${reportType.title}\n`
        csvContent += `Periode: ${startDate} s/d ${endDate}\n`
        csvContent += `Digenerate: ${new Date().toLocaleString('id-ID')}\n\n`

        // Data based on report type
        if (reportType.id === 'executive-summary' && data) {
            // KPI
            csvContent += 'KPI,Nilai\n'
            const kpi = data.kpiScorecard || {}
            csvContent += `Total Siswa,${kpi.totalStudents || 0}\n`
            csvContent += `Total Guru,${kpi.totalTeachers || 0}\n`
            csvContent += `Rata-rata Nilai,${kpi.avgSchoolGrade || 0}\n`
            csvContent += `Tingkat Adopsi LMS,${kpi.adoptionRate || 0}%\n\n`

            // Grade Distribution
            if (data.gradeDistribution?.length > 0) {
                csvContent += '\nDistribusi Nilai\n'
                csvContent += 'Rentang,Jumlah\n'
                data.gradeDistribution.forEach(g => {
                    csvContent += `"${g.grade_range}",${g.count || 0}\n`
                })
            }

            // Popular Activities
            if (data.popularActivities?.length > 0) {
                csvContent += '\nAktivitas Terpopuler\n'
                csvContent += 'Aktivitas,Jumlah Modul,Total Akses\n'
                data.popularActivities.forEach(a => {
                    csvContent += `"${a.activity_label || a.activity_type}",${a.total_modules || 0},${a.total_access || 0}\n`
                })
            }

        } else if (reportType.id === 'teacher-detail' && data?.totalActivitySummary) {
            csvContent += 'Nama,Total Aktivitas,Hari Aktif\n'
            data.totalActivitySummary.forEach(t => {
                csvContent += `"${t.firstname} ${t.lastname}",${t.total_activities || 0},${t.active_days || 0}\n`
            })
        } else if (reportType.id === 'student-detail' && data?.totalActivitySummary) {
            csvContent += 'Nama,Total Aktivitas,Hari Aktif\n'
            data.totalActivitySummary.forEach(s => {
                csvContent += `"${s.firstname} ${s.lastname}",${s.total_activities || 0},${s.active_days || 0}\n`
            })
        }

        // Download
        const blob = new Blob([csvContent], { type: format === 'csv' ? 'text/csv' : 'application/vnd.ms-excel' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        const ext = format === 'csv' ? 'csv' : 'xlsx'
        const filename = `${reportType.title.replace(/\s+/g, '_')}_${timestamp}.${ext}`
        a.href = url
        a.download = filename
        a.click()
        URL.revokeObjectURL(url)

        return filename
    }

    // Delete report from history
    function handleDeleteReport(id) {
        const updated = recentReports.filter(r => r.id !== id)
        saveRecentReports(updated)
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <div className="text-sm text-gray-500 dark:text-dark-400 mb-2">
                    Laporan &gt; <span className="text-gray-900 dark:text-white">Generator</span>
                </div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Generator Laporan</h1>
                <p className="text-gray-500 dark:text-dark-400 mt-1">
                    Pilih tipe laporan dan atur parameter untuk menghasilkan analisis performa akademik.
                </p>
            </div>

            {/* Step 1: Pilih Tipe Laporan */}
            <div className="bg-white dark:bg-dark-800/30 rounded-2xl p-6 border border-gray-200 dark:border-dark-700">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-500/20 flex items-center justify-center">
                        <span className="text-sm font-semibold text-primary-600 dark:text-primary-400">1</span>
                    </div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Pilih Tipe Laporan</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {REPORT_TYPES.map(report => (
                        <ReportTypeCard
                            key={report.id}
                            report={report}
                            isSelected={selectedReport === report.id}
                            onSelect={setSelectedReport}
                        />
                    ))}
                </div>
            </div>

            {/* Step 2: Konfigurasi Laporan */}
            <div className="bg-white dark:bg-dark-800/30 rounded-2xl p-6 border border-gray-200 dark:border-dark-700">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-500/20 flex items-center justify-center">
                        <span className="text-sm font-semibold text-primary-600 dark:text-primary-400">2</span>
                    </div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Konfigurasi Laporan</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Periode Laporan */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-2">
                            Periode Laporan
                        </label>
                        <div className="relative">
                            <button
                                onClick={() => setShowPeriodDropdown(!showPeriodDropdown)}
                                className="w-full flex items-center justify-between px-4 py-3 bg-white dark:bg-dark-800 border border-gray-300 dark:border-dark-600 rounded-xl text-left text-gray-900 dark:text-white hover:border-primary-400 transition-colors"
                            >
                                <span>{getCurrentPeriodLabel()}</span>
                                <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${showPeriodDropdown ? 'rotate-180' : ''}`} />
                            </button>

                            {showPeriodDropdown && (
                                <div className="absolute z-10 w-full mt-2 bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-600 rounded-xl shadow-lg overflow-hidden">
                                    {PERIOD_OPTIONS.map(period => (
                                        <button
                                            key={period.id}
                                            onClick={() => {
                                                setSelectedPeriod(period.id)
                                                setShowPeriodDropdown(false)
                                            }}
                                            className={`w-full px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors ${selectedPeriod === period.id
                                                ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-500/10'
                                                : 'text-gray-700 dark:text-dark-300'
                                                }`}
                                        >
                                            {period.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Format File */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-2">
                            Format File
                        </label>
                        <div className="flex gap-2">
                            {FORMAT_OPTIONS.map(format => {
                                const Icon = format.icon
                                const isSelected = selectedFormat === format.id
                                return (
                                    <button
                                        key={format.id}
                                        onClick={() => setSelectedFormat(format.id)}
                                        className={`
                                            flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 transition-all
                                            ${isSelected
                                                ? 'border-primary-500 bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400'
                                                : 'border-gray-200 dark:border-dark-600 text-gray-600 dark:text-dark-400 hover:border-gray-300 dark:hover:border-dark-500'
                                            }
                                        `}
                                    >
                                        <Icon className="w-5 h-5" />
                                        <span className="font-medium">{format.label}</span>
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* Executive Summary Preview */}
            {selectedReport === 'executive-summary' && (
                <ExecutiveSummaryPreview data={executiveSummaryData} isLoading={isLoadingPreview} />
            )}

            {/* Teacher Detail Preview */}
            {selectedReport === 'teacher-detail' && (
                <TeacherDetailPreview
                    period={(() => {
                        const p = PERIOD_OPTIONS.find(p => p.id === selectedPeriod)
                        const { start, end } = p.getValue()
                        return {
                            startDate: start.toISOString().split('T')[0],
                            endDate: end.toISOString().split('T')[0]
                        }
                    })()}
                    isLoading={isLoadingPreview}
                />
            )}

            {/* Student Detail Preview */}
            {selectedReport === 'student-detail' && (
                <StudentDetailPreview
                    period={(() => {
                        const p = PERIOD_OPTIONS.find(p => p.id === selectedPeriod)
                        const { start, end } = p.getValue()
                        return {
                            startDate: start.toISOString().split('T')[0],
                            endDate: end.toISOString().split('T')[0]
                        }
                    })()}
                    isLoading={isLoadingPreview}
                />
            )}

            {/* Generate Button */}
            <button
                onClick={handleGenerateReport}
                disabled={isGenerating}
                className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 disabled:from-primary-400 disabled:to-primary-500 text-white font-semibold rounded-xl shadow-lg shadow-primary-500/25 transition-all duration-200"
            >
                {isGenerating ? (
                    <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Generating Laporan...</span>
                    </>
                ) : (
                    <>
                        <Download className="w-5 h-5" />
                        <span>Generate Laporan Sekarang</span>
                    </>
                )}
            </button>

            {/* Laporan Terakhir */}
            <div className="bg-white dark:bg-dark-800/30 rounded-2xl border border-gray-200 dark:border-dark-700 overflow-hidden">
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-dark-700">
                    <div className="flex items-center gap-3">
                        <Clock className="w-5 h-5 text-gray-500 dark:text-dark-400" />
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Laporan Terakhir</h2>
                    </div>
                    <button className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium">
                        Lihat Semua
                    </button>
                </div>

                {recentReports.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-gray-50 dark:bg-dark-800/50">
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-dark-400 uppercase tracking-wider">
                                        Nama Laporan
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-dark-400 uppercase tracking-wider">
                                        Tanggal Dibuat
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-dark-400 uppercase tracking-wider">
                                        Aksi
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-dark-700">
                                {recentReports.map(report => (
                                    <tr key={report.id} className="hover:bg-gray-50 dark:hover:bg-dark-800/30">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${report.format === 'PDF' ? 'bg-red-100 dark:bg-red-500/20' :
                                                    report.format === 'EXCEL' ? 'bg-green-100 dark:bg-green-500/20' :
                                                        'bg-blue-100 dark:bg-blue-500/20'
                                                    }`}>
                                                    {report.format === 'PDF' ? (
                                                        <FileText className="w-4 h-4 text-red-600 dark:text-red-400" />
                                                    ) : report.format === 'EXCEL' ? (
                                                        <FileSpreadsheet className="w-4 h-4 text-green-600 dark:text-green-400" />
                                                    ) : (
                                                        <File className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                                    )}
                                                </div>
                                                <span className="text-sm font-medium text-gray-900 dark:text-white">{report.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-dark-400">
                                            {formatDate(report.createdAt)}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button className="p-2 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-500/10 rounded-lg transition-colors">
                                                    <Download className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteReport(report.id)}
                                                    className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="p-12 text-center">
                        <FileText className="w-12 h-12 text-gray-300 dark:text-dark-600 mx-auto mb-4" />
                        <p className="text-gray-500 dark:text-dark-400">Belum ada laporan yang digenerate.</p>
                        <p className="text-sm text-gray-400 dark:text-dark-500 mt-1">Generate laporan pertama Anda menggunakan form di atas.</p>
                    </div>
                )}
            </div>
        </div>
    )
}
