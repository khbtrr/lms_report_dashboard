import { useState, useEffect } from 'react'
import { Activity, Calendar, Users, Loader2 } from 'lucide-react'
import { logsApi } from '../services/api'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts'

export default function LogActivity() {
    const [loginData, setLoginData] = useState(null)
    const [days, setDays] = useState(7)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        fetchLoginActivity()
    }, [days])

    async function fetchLoginActivity() {
        try {
            setLoading(true)
            const data = await logsApi.getLoginActivity(days)
            setLoginData(data)
            setError(null)
        } catch (err) {
            setError(err.message)
            // Demo data
            const demoData = []
            for (let i = days - 1; i >= 0; i--) {
                const date = new Date()
                date.setDate(date.getDate() - i)
                demoData.push({
                    date: date.toISOString().split('T')[0],
                    login_count: Math.floor(Math.random() * 300) + 100,
                    unique_users: Math.floor(Math.random() * 200) + 50
                })
            }
            setLoginData({ period: `Last ${days} days`, data: demoData })
        } finally {
            setLoading(false)
        }
    }

    const chartData = loginData?.data?.map(item => ({
        ...item,
        date: new Date(item.date).toLocaleDateString('id-ID', {
            weekday: 'short',
            day: 'numeric',
            month: 'short'
        }),
    })) || []

    const totalLogins = loginData?.data?.reduce((sum, d) => sum + d.login_count, 0) || 0
    const totalUniqueUsers = loginData?.data?.reduce((sum, d) => sum + d.unique_users, 0) || 0
    const avgLogins = loginData?.data?.length ? Math.round(totalLogins / loginData.data.length) : 0
    const peakDay = loginData?.data?.reduce((max, d) => d.login_count > (max?.login_count || 0) ? d : max, null)

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">Login Activity</h1>
                    <p className="text-dark-400 mt-1">Track user login trends and patterns</p>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-dark-400 text-sm">Period:</span>
                    <select
                        value={days}
                        onChange={(e) => setDays(Number(e.target.value))}
                        className="input-field py-2"
                    >
                        <option value={7}>Last 7 days</option>
                        <option value={14}>Last 14 days</option>
                        <option value={30}>Last 30 days</option>
                    </select>
                </div>
            </div>

            {error && (
                <div className="glass-card p-4 border-l-4 border-yellow-500">
                    <p className="text-yellow-400 text-sm">⚠️ Using demo data. Connect to backend for live data.</p>
                </div>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="glass-card p-5">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/20 flex items-center justify-center">
                            <Activity className="w-6 h-6 text-blue-400" />
                        </div>
                        <div>
                            <p className="text-dark-400 text-sm">Total Logins</p>
                            <p className="text-2xl font-bold text-white">{totalLogins.toLocaleString()}</p>
                        </div>
                    </div>
                </div>

                <div className="glass-card p-5">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-600/20 flex items-center justify-center">
                            <Users className="w-6 h-6 text-purple-400" />
                        </div>
                        <div>
                            <p className="text-dark-400 text-sm">Unique Users</p>
                            <p className="text-2xl font-bold text-white">{totalUniqueUsers.toLocaleString()}</p>
                        </div>
                    </div>
                </div>

                <div className="glass-card p-5">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500/20 to-green-600/20 flex items-center justify-center">
                            <Calendar className="w-6 h-6 text-green-400" />
                        </div>
                        <div>
                            <p className="text-dark-400 text-sm">Avg Daily Logins</p>
                            <p className="text-2xl font-bold text-white">{avgLogins.toLocaleString()}</p>
                        </div>
                    </div>
                </div>

                <div className="glass-card p-5">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-600/20 flex items-center justify-center">
                            <Activity className="w-6 h-6 text-orange-400" />
                        </div>
                        <div>
                            <p className="text-dark-400 text-sm">Peak Day</p>
                            <p className="text-lg font-bold text-white">
                                {peakDay ? new Date(peakDay.date).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' }) : '-'}
                            </p>
                            <p className="text-xs text-dark-500">{peakDay?.login_count.toLocaleString()} logins</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Area Chart */}
                <div className="glass-card p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Login Trend</h3>
                    {loading ? (
                        <div className="h-72 flex items-center justify-center">
                            <Loader2 className="w-8 h-8 animate-spin text-primary-400" />
                        </div>
                    ) : (
                        <div className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData}>
                                    <defs>
                                        <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                    <XAxis
                                        dataKey="date"
                                        stroke="#64748b"
                                        fontSize={11}
                                        tickLine={false}
                                        angle={-45}
                                        textAnchor="end"
                                        height={60}
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
                                        fill="url(#areaGradient)"
                                        name="Total Logins"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>

                {/* Bar Chart */}
                <div className="glass-card p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Logins vs Unique Users</h3>
                    {loading ? (
                        <div className="h-72 flex items-center justify-center">
                            <Loader2 className="w-8 h-8 animate-spin text-primary-400" />
                        </div>
                    ) : (
                        <div className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                    <XAxis
                                        dataKey="date"
                                        stroke="#64748b"
                                        fontSize={11}
                                        tickLine={false}
                                        angle={-45}
                                        textAnchor="end"
                                        height={60}
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
                                    <Legend />
                                    <Bar dataKey="login_count" fill="#3b82f6" name="Total Logins" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="unique_users" fill="#a855f7" name="Unique Users" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>
            </div>

            {/* Data Table */}
            <div className="glass-card overflow-hidden">
                <div className="p-4 border-b border-dark-700/50">
                    <h3 className="font-semibold text-white">Daily Breakdown</h3>
                </div>
                {loading ? (
                    <div className="flex items-center justify-center h-32">
                        <Loader2 className="w-6 h-6 animate-spin text-primary-400" />
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th className="text-right">Total Logins</th>
                                    <th className="text-right">Unique Users</th>
                                    <th className="text-right">Avg Logins/User</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loginData?.data?.map((day, idx) => (
                                    <tr key={idx}>
                                        <td>
                                            <span className="text-white">
                                                {new Date(day.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}
                                            </span>
                                        </td>
                                        <td className="text-right">
                                            <span className="text-blue-400 font-medium">{day.login_count.toLocaleString()}</span>
                                        </td>
                                        <td className="text-right">
                                            <span className="text-purple-400 font-medium">{day.unique_users.toLocaleString()}</span>
                                        </td>
                                        <td className="text-right">
                                            <span className="text-dark-300">
                                                {day.unique_users > 0 ? (day.login_count / day.unique_users).toFixed(1) : '0'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}
