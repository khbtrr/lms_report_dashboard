import { useState } from 'react'
import { Search, User, BookOpen, Award, Calendar, Loader2, X } from 'lucide-react'
import { usersApi } from '../services/api'

export default function UserProgress() {
    const [searchQuery, setSearchQuery] = useState('')
    const [users, setUsers] = useState([])
    const [selectedUser, setSelectedUser] = useState(null)
    const [userGrades, setUserGrades] = useState(null)
    const [loading, setLoading] = useState(false)
    const [gradesLoading, setGradesLoading] = useState(false)
    const [error, setError] = useState(null)

    async function handleSearch(e) {
        e.preventDefault()
        if (!searchQuery || searchQuery.length < 2) return

        try {
            setLoading(true)
            setSelectedUser(null)
            setUserGrades(null)
            const data = await usersApi.search(searchQuery)
            setUsers(data.users)
            setError(null)
        } catch (err) {
            setError(err.message)
            // Demo data
            setUsers([
                { id: 1, username: 'john.doe', firstname: 'John', lastname: 'Doe', email: 'john@example.com', lastaccess: Date.now() / 1000 - 3600 },
                { id: 2, username: 'jane.smith', firstname: 'Jane', lastname: 'Smith', email: 'jane@example.com', lastaccess: Date.now() / 1000 - 86400 },
                { id: 3, username: 'bob.wilson', firstname: 'Bob', lastname: 'Wilson', email: 'bob@example.com', lastaccess: Date.now() / 1000 - 172800 },
            ])
        } finally {
            setLoading(false)
        }
    }

    async function handleSelectUser(user) {
        setSelectedUser(user)
        try {
            setGradesLoading(true)
            const data = await usersApi.getGrades(user.id)
            setUserGrades(data)
        } catch (err) {
            // Demo grades
            setUserGrades({
                user: user,
                grades: [
                    { course_id: 1, course_name: 'Introduction to Computer Science', finalgrade: 85, grademax: 100, percentage: 85, completed_at: Date.now() / 1000 - 86400 },
                    { course_id: 2, course_name: 'Web Development Fundamentals', finalgrade: 92, grademax: 100, percentage: 92, completed_at: null },
                    { course_id: 3, course_name: 'Database Management Systems', finalgrade: 78, grademax: 100, percentage: 78, completed_at: Date.now() / 1000 - 172800 },
                ],
                enrolledCourses: [
                    { course_id: 1, course_name: 'Introduction to Computer Science', enrolled_at: Date.now() / 1000 - 2592000, completed_at: Date.now() / 1000 - 86400 },
                    { course_id: 2, course_name: 'Web Development Fundamentals', enrolled_at: Date.now() / 1000 - 1296000, completed_at: null },
                    { course_id: 3, course_name: 'Database Management Systems', enrolled_at: Date.now() / 1000 - 864000, completed_at: Date.now() / 1000 - 172800 },
                ]
            })
        } finally {
            setGradesLoading(false)
        }
    }

    function formatDate(timestamp) {
        if (!timestamp) return 'N/A'
        return new Date(timestamp * 1000).toLocaleDateString('id-ID', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        })
    }

    function getGradeColor(percentage) {
        if (percentage >= 80) return 'text-green-400'
        if (percentage >= 60) return 'text-yellow-400'
        return 'text-red-400'
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-white">User Progress</h1>
                <p className="text-dark-400 mt-1">Search users and view their grades across courses</p>
            </div>

            {/* Search Form */}
            <form onSubmit={handleSearch} className="glass-card p-6">
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
                        <input
                            type="text"
                            placeholder="Search by name, username, or email..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="input-field pl-12 w-full"
                        />
                    </div>
                    <button type="submit" className="btn btn-primary" disabled={loading || searchQuery.length < 2}>
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                        Search
                    </button>
                </div>
                <p className="text-xs text-dark-500 mt-2">Enter at least 2 characters to search</p>
            </form>

            {error && (
                <div className="glass-card p-4 border-l-4 border-yellow-500">
                    <p className="text-yellow-400 text-sm">⚠️ Using demo data. Connect to backend for live data.</p>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* User List */}
                <div className="glass-card">
                    <div className="p-4 border-b border-dark-700/50">
                        <h3 className="font-semibold text-white">Search Results</h3>
                        <p className="text-sm text-dark-400">{users.length} users found</p>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                        {loading ? (
                            <div className="flex items-center justify-center h-32">
                                <Loader2 className="w-6 h-6 animate-spin text-primary-400" />
                            </div>
                        ) : users.length === 0 ? (
                            <div className="p-8 text-center text-dark-400">
                                <User className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                <p>No users found. Try searching above.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-dark-700/30">
                                {users.map(user => (
                                    <button
                                        key={user.id}
                                        onClick={() => handleSelectUser(user)}
                                        className={`w-full text-left p-4 hover:bg-primary-500/10 transition-colors ${selectedUser?.id === user.id ? 'bg-primary-500/20 border-l-2 border-primary-500' : ''
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-purple-500 flex items-center justify-center">
                                                <span className="text-white font-semibold">
                                                    {user.firstname?.charAt(0)}{user.lastname?.charAt(0)}
                                                </span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-white truncate">
                                                    {user.firstname} {user.lastname}
                                                </p>
                                                <p className="text-sm text-dark-400 truncate">{user.email}</p>
                                            </div>
                                            <div className="text-xs text-dark-500">
                                                Last: {formatDate(user.lastaccess)}
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* User Grades */}
                <div className="glass-card">
                    <div className="p-4 border-b border-dark-700/50 flex items-center justify-between">
                        <div>
                            <h3 className="font-semibold text-white">User Grades</h3>
                            <p className="text-sm text-dark-400">
                                {selectedUser ? `${selectedUser.firstname} ${selectedUser.lastname}` : 'Select a user'}
                            </p>
                        </div>
                        {selectedUser && (
                            <button onClick={() => { setSelectedUser(null); setUserGrades(null); }} className="text-dark-400 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        )}
                    </div>

                    <div className="max-h-96 overflow-y-auto">
                        {!selectedUser ? (
                            <div className="p-8 text-center text-dark-400">
                                <Award className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                <p>Select a user to view their grades</p>
                            </div>
                        ) : gradesLoading ? (
                            <div className="flex items-center justify-center h-32">
                                <Loader2 className="w-6 h-6 animate-spin text-primary-400" />
                            </div>
                        ) : (
                            <div className="divide-y divide-dark-700/30">
                                {userGrades?.grades?.length === 0 ? (
                                    <div className="p-8 text-center text-dark-400">
                                        <p>No grades found for this user</p>
                                    </div>
                                ) : (
                                    userGrades?.grades?.map((grade, idx) => (
                                        <div key={idx} className="p-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex items-start gap-3 flex-1 min-w-0">
                                                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-500/20 to-purple-500/20 flex items-center justify-center flex-shrink-0">
                                                        <BookOpen className="w-5 h-5 text-primary-400" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-medium text-white truncate">{grade.course_name}</p>
                                                        <div className="flex items-center gap-3 mt-1 text-sm text-dark-400">
                                                            <span className="flex items-center gap-1">
                                                                <Calendar className="w-3 h-3" />
                                                                {grade.completed_at ? 'Completed' : 'In Progress'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className={`text-2xl font-bold ${getGradeColor(grade.percentage)}`}>
                                                        {grade.percentage}%
                                                    </p>
                                                    <p className="text-xs text-dark-500">
                                                        {grade.finalgrade}/{grade.grademax}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Enrolled Courses */}
            {userGrades?.enrolledCourses && userGrades.enrolledCourses.length > 0 && (
                <div className="glass-card">
                    <div className="p-4 border-b border-dark-700/50">
                        <h3 className="font-semibold text-white">Enrolled Courses</h3>
                        <p className="text-sm text-dark-400">{userGrades.enrolledCourses.length} courses</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Course</th>
                                    <th>Enrolled Date</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {userGrades.enrolledCourses.map((course, idx) => (
                                    <tr key={idx}>
                                        <td>
                                            <span className="text-white">{course.course_name}</span>
                                        </td>
                                        <td>
                                            <span className="text-dark-300">{formatDate(course.enrolled_at)}</span>
                                        </td>
                                        <td>
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${course.completed_at ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                                                }`}>
                                                {course.completed_at ? 'Completed' : 'In Progress'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    )
}
