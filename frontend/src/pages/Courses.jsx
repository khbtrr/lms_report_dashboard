import { useState, useEffect } from 'react'
import { Search, ChevronLeft, ChevronRight, BookOpen, Users, Award, Loader2 } from 'lucide-react'
import { coursesApi } from '../services/api'

export default function Courses() {
    const [courses, setCourses] = useState([])
    const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 })
    const [search, setSearch] = useState('')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        fetchCourses()
    }, [pagination.page, search])

    async function fetchCourses() {
        try {
            setLoading(true)
            const data = await coursesApi.getAll({
                page: pagination.page,
                limit: pagination.limit,
                search: search
            })
            setCourses(data.courses)
            setPagination(data.pagination)
            setError(null)
        } catch (err) {
            setError(err.message)
            // Demo data
            setCourses([
                { id: 1, fullname: 'Introduction to Computer Science', shortname: 'CS101', category_name: 'Computer Science', enrolled_count: 156, completed_count: 89, completion_rate: 57, visible: 1 },
                { id: 2, fullname: 'Web Development Fundamentals', shortname: 'WEB101', category_name: 'Web Development', enrolled_count: 234, completed_count: 178, completion_rate: 76, visible: 1 },
                { id: 3, fullname: 'Database Management Systems', shortname: 'DB201', category_name: 'Database', enrolled_count: 89, completed_count: 45, completion_rate: 51, visible: 1 },
                { id: 4, fullname: 'Data Structures and Algorithms', shortname: 'DSA301', category_name: 'Computer Science', enrolled_count: 67, completed_count: 23, completion_rate: 34, visible: 1 },
                { id: 5, fullname: 'Machine Learning Basics', shortname: 'ML101', category_name: 'AI/ML', enrolled_count: 198, completed_count: 156, completion_rate: 79, visible: 1 },
            ])
            setPagination({ page: 1, limit: 10, total: 5, totalPages: 1 })
        } finally {
            setLoading(false)
        }
    }

    function handleSearch(e) {
        e.preventDefault()
        setPagination(prev => ({ ...prev, page: 1 }))
        fetchCourses()
    }

    function getCompletionColor(rate) {
        if (rate >= 70) return 'text-green-400 bg-green-400/20'
        if (rate >= 40) return 'text-yellow-400 bg-yellow-400/20'
        return 'text-red-400 bg-red-400/20'
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">Course Reporting</h1>
                    <p className="text-dark-400 mt-1">View course statistics and completion rates</p>
                </div>

                <form onSubmit={handleSearch} className="flex gap-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
                        <input
                            type="text"
                            placeholder="Search courses..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="input-field pl-10 w-64"
                        />
                    </div>
                    <button type="submit" className="btn btn-primary">
                        Search
                    </button>
                </form>
            </div>

            {error && (
                <div className="glass-card p-4 border-l-4 border-yellow-500">
                    <p className="text-yellow-400 text-sm">⚠️ Using demo data. Connect to backend for live data.</p>
                </div>
            )}

            {/* Course Table */}
            <div className="glass-card overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <Loader2 className="w-8 h-8 animate-spin text-primary-400" />
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Course Name</th>
                                    <th>Category</th>
                                    <th className="text-center">
                                        <div className="flex items-center justify-center gap-1">
                                            <Users className="w-4 h-4" /> Enrolled
                                        </div>
                                    </th>
                                    <th className="text-center">
                                        <div className="flex items-center justify-center gap-1">
                                            <Award className="w-4 h-4" /> Completed
                                        </div>
                                    </th>
                                    <th className="text-center">Completion Rate</th>
                                    <th className="text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {courses.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="text-center py-8 text-dark-400">
                                            No courses found
                                        </td>
                                    </tr>
                                ) : (
                                    courses.map((course) => (
                                        <tr key={course.id}>
                                            <td>
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-500/20 to-purple-500/20 flex items-center justify-center">
                                                        <BookOpen className="w-5 h-5 text-primary-400" />
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-white">{course.fullname}</p>
                                                        <p className="text-xs text-dark-500">{course.shortname}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <span className="px-2 py-1 rounded-md bg-dark-700/50 text-dark-300 text-sm">
                                                    {course.category_name || 'Uncategorized'}
                                                </span>
                                            </td>
                                            <td className="text-center">
                                                <span className="text-white font-medium">{course.enrolled_count}</span>
                                            </td>
                                            <td className="text-center">
                                                <span className="text-white font-medium">{course.completed_count}</span>
                                            </td>
                                            <td className="text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <div className="w-24 h-2 bg-dark-700 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full ${course.completion_rate >= 70 ? 'bg-green-500' :
                                                                    course.completion_rate >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                                                                }`}
                                                            style={{ width: `${course.completion_rate}%` }}
                                                        />
                                                    </div>
                                                    <span className={`text-sm font-medium px-2 py-0.5 rounded ${getCompletionColor(course.completion_rate)}`}>
                                                        {course.completion_rate}%
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="text-center">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${course.visible ? 'bg-green-500/20 text-green-400' : 'bg-dark-600 text-dark-400'
                                                    }`}>
                                                    {course.visible ? 'Active' : 'Hidden'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {!loading && pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between px-6 py-4 border-t border-dark-700/50">
                        <p className="text-sm text-dark-400">
                            Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} courses
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                                disabled={pagination.page === 1}
                                className="btn btn-secondary disabled:opacity-50"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="px-4 py-2 text-white">
                                Page {pagination.page} of {pagination.totalPages}
                            </span>
                            <button
                                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                                disabled={pagination.page === pagination.totalPages}
                                className="btn btn-secondary disabled:opacity-50"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
