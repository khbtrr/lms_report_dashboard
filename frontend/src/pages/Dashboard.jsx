import { useState, useEffect } from 'react'
import { Users, BookOpen, Activity, UserCheck, TrendingUp, TrendingDown, Loader2 } from 'lucide-react'
import { dashboardApi, logsApi } from '../services/api'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'

function StatCard({ title, value, icon: Icon, trend, color, isLoading }) {
    const colorClasses = {
        blue: 'from-blue-500 to-blue-600 glow-blue',
        purple: 'from-purple-500 to-purple-600 glow-purple',
        green: 'from-green-500 to-green-600 glow-green',
        orange: 'from-orange-500 to-orange-600 glow-orange',
    }

    return (
        <div className="glass-card p-6 hover:scale-[1.02] transition-transform duration-300">
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <p className="text-dark-400 text-sm font-medium">{title}</p>
                    {isLoading ? (
                        <div className="flex items-center gap-2 mt-2">
                            <Loader2 className="w-5 h-5 animate-spin text-dark-400" />
                            <span className="text-dark-500">Loading...</span>
                        </div>
                    ) : (
                        <p className="text-3xl font-bold text-white mt-2">
                            {typeof value === 'number' ? value.toLocaleString() : value}
                        </p>
                    )}
                    {trend && !isLoading && (
                        <div className={`flex items-center gap-1 mt-2 ${trend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {trend >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                            <span className="text-sm font-medium">{Math.abs(trend)}%</span>
                            <span className="text-dark-500 text-xs">vs last week</span>
                        </div>
                    )}
                </div>
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${colorClasses[color]} flex items-center justify-center`}>
                    <Icon className="w-7 h-7 text-white" />
                </div>
            </div>
        </div>
    )
}

function ChartCard({ title, subtitle, children, isLoading }) {
    return (
        <div className="glass-card p-6">
            <div className="mb-4">
                <h3 className="text-lg font-semibold text-white">{title}</h3>
                {subtitle && <p className="text-sm text-dark-400">{subtitle}</p>}
            </div>
            {isLoading ? (
                <div className="h-64 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-primary-400" />
                </div>
            ) : (
                children
            )}
        </div>
    )
}

export default function Dashboard() {
    const [stats, setStats] = useState(null)
    const [loginActivity, setLoginActivity] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        async function fetchData() {
            try {
                setLoading(true)
                const [overviewData, activityData] = await Promise.all([
                    dashboardApi.getOverview(),
                    logsApi.getLoginActivity(7),
                ])
                setStats(overviewData)
                setLoginActivity(activityData)
            } catch (err) {
                setError(err.message)
                // Use demo data when API is not available
                setStats({
                    totalUsers: 1250,
                    totalCourses: 45,
                    todayActivities: 3420,
                    totalEnrollments: 5890,
                })
                setLoginActivity({
                    data: [
                        { date: '2026-01-20', login_count: 245, unique_users: 180 },
                        { date: '2026-01-21', login_count: 312, unique_users: 225 },
                        { date: '2026-01-22', login_count: 287, unique_users: 198 },
                        { date: '2026-01-23', login_count: 356, unique_users: 267 },
                        { date: '2026-01-24', login_count: 298, unique_users: 212 },
                        { date: '2026-01-25', login_count: 189, unique_users: 145 },
                        { date: '2026-01-26', login_count: 267, unique_users: 195 },
                    ]
                })
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [])

    const chartData = loginActivity?.data?.map(item => ({
        ...item,
        date: new Date(item.date).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' }),
    })) || []

    return (
        <div className="space-y-6">
            {/* Error Notice */}
            {error && (
                <div className="glass-card p-4 border-l-4 border-yellow-500">
                    <p className="text-yellow-400 text-sm">
                        ⚠️ Unable to connect to API. Showing demo data. Make sure the backend is running on port 3001.
                    </p>
                </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Total Users"
                    value={stats?.totalUsers ?? 0}
                    icon={Users}
                    color="blue"
                    isLoading={loading}
                />
                <StatCard
                    title="Total Courses"
                    value={stats?.totalCourses ?? 0}
                    icon={BookOpen}
                    color="purple"
                    isLoading={loading}
                />
                <StatCard
                    title="Today's Activities"
                    value={stats?.todayActivities ?? 0}
                    icon={Activity}
                    color="green"
                    isLoading={loading}
                />
                <StatCard
                    title="Total Enrollments"
                    value={stats?.totalEnrollments ?? 0}
                    icon={UserCheck}
                    color="orange"
                    isLoading={loading}
                />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Login Activity Chart */}
                <ChartCard
                    title="Login Activity"
                    subtitle="Last 7 days login trend"
                    isLoading={loading}
                >
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="loginGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                <XAxis
                                    dataKey="date"
                                    stroke="#64748b"
                                    fontSize={12}
                                    tickLine={false}
                                />
                                <YAxis
                                    stroke="#64748b"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: '#1e293b',
                                        border: '1px solid #334155',
                                        borderRadius: '8px',
                                        color: '#f1f5f9'
                                    }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="login_count"
                                    stroke="#3b82f6"
                                    strokeWidth={2}
                                    fill="url(#loginGradient)"
                                    name="Logins"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </ChartCard>

                {/* Unique Users Chart */}
                <ChartCard
                    title="Unique Users"
                    subtitle="Daily active users"
                    isLoading={loading}
                >
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                <XAxis
                                    dataKey="date"
                                    stroke="#64748b"
                                    fontSize={12}
                                    tickLine={false}
                                />
                                <YAxis
                                    stroke="#64748b"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: '#1e293b',
                                        border: '1px solid #334155',
                                        borderRadius: '8px',
                                        color: '#f1f5f9'
                                    }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="unique_users"
                                    stroke="#a855f7"
                                    strokeWidth={2}
                                    dot={{ fill: '#a855f7', strokeWidth: 2, r: 4 }}
                                    name="Unique Users"
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </ChartCard>
            </div>

            {/* Quick Info Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="glass-card p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">System Status</h3>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-dark-400">API Server</span>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${error ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400'}`}>
                                {error ? 'Demo Mode' : 'Connected'}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-dark-400">Database</span>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${error ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                                {error ? 'Disconnected' : 'Online'}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-dark-400">Query Mode</span>
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400">
                                Read-Only
                            </span>
                        </div>
                    </div>
                </div>

                <div className="glass-card p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
                    <div className="space-y-2">
                        <a href="/courses" className="block w-full text-left px-4 py-3 rounded-lg bg-dark-800/50 hover:bg-primary-500/20 text-dark-300 hover:text-white transition-colors">
                            View Course Reports →
                        </a>
                        <a href="/users" className="block w-full text-left px-4 py-3 rounded-lg bg-dark-800/50 hover:bg-primary-500/20 text-dark-300 hover:text-white transition-colors">
                            Search User Progress →
                        </a>
                        <a href="/reports" className="block w-full text-left px-4 py-3 rounded-lg bg-dark-800/50 hover:bg-primary-500/20 text-dark-300 hover:text-white transition-colors">
                            Create Custom Report →
                        </a>
                    </div>
                </div>

                <div className="glass-card p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Recent Updates</h3>
                    <div className="space-y-3 text-sm">
                        <div className="flex gap-3">
                            <div className="w-2 h-2 rounded-full bg-green-400 mt-2"></div>
                            <div>
                                <p className="text-white">Dashboard initialized</p>
                                <p className="text-dark-500 text-xs">Just now</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <div className="w-2 h-2 rounded-full bg-blue-400 mt-2"></div>
                            <div>
                                <p className="text-white">API endpoints ready</p>
                                <p className="text-dark-500 text-xs">System startup</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <div className="w-2 h-2 rounded-full bg-purple-400 mt-2"></div>
                            <div>
                                <p className="text-white">Charts configured</p>
                                <p className="text-dark-500 text-xs">Recharts loaded</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
