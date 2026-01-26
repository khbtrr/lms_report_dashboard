import { Outlet, NavLink, useLocation } from 'react-router-dom'
import {
    LayoutDashboard,
    BookOpen,
    Users,
    Activity,
    FileCode,
    GraduationCap,
    Menu,
    X,
    ChevronRight
} from 'lucide-react'
import { useState } from 'react'

const navItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard', description: 'Overview & Stats' },
    { path: '/courses', icon: BookOpen, label: 'Courses', description: 'Course Reports' },
    { path: '/users', icon: Users, label: 'Users', description: 'Progress Tracking' },
    { path: '/logs', icon: Activity, label: 'Activity', description: 'Login Logs' },
    { path: '/reports', icon: FileCode, label: 'Custom SQL', description: 'Custom Reports' },
]

export default function Layout() {
    const [sidebarOpen, setSidebarOpen] = useState(true)
    const location = useLocation()

    const currentPage = navItems.find(item => item.path === location.pathname) || navItems[0]

    return (
        <div className="min-h-screen flex bg-dark-950">
            {/* Sidebar */}
            <aside
                className={`${sidebarOpen ? 'w-72' : 'w-20'} transition-all duration-300 ease-in-out flex flex-col glass border-r border-dark-700/50`}
            >
                {/* Logo */}
                <div className="p-6 border-b border-dark-700/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-purple-500 flex items-center justify-center glow-blue">
                            <GraduationCap className="w-6 h-6 text-white" />
                        </div>
                        {sidebarOpen && (
                            <div className="overflow-hidden">
                                <h1 className="font-bold text-lg gradient-text">LMS Dashboard</h1>
                                <p className="text-xs text-dark-400">Moodle Reporting</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-4 space-y-2">
                    {navItems.map((item) => {
                        const Icon = item.icon
                        const isActive = location.pathname === item.path

                        return (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                className={`
                  flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200
                  ${isActive
                                        ? 'bg-gradient-to-r from-primary-500/20 to-purple-500/10 text-white border border-primary-500/30'
                                        : 'text-dark-300 hover:text-white hover:bg-dark-800/50'
                                    }
                `}
                            >
                                <Icon className={`w-5 h-5 ${isActive ? 'text-primary-400' : ''}`} />
                                {sidebarOpen && (
                                    <div className="overflow-hidden">
                                        <span className="font-medium">{item.label}</span>
                                        <p className="text-xs text-dark-500">{item.description}</p>
                                    </div>
                                )}
                                {sidebarOpen && isActive && (
                                    <ChevronRight className="w-4 h-4 ml-auto text-primary-400" />
                                )}
                            </NavLink>
                        )
                    })}
                </nav>

                {/* Toggle Button */}
                <div className="p-4 border-t border-dark-700/50">
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-dark-800/50 hover:bg-dark-700/50 text-dark-400 hover:text-white transition-colors"
                    >
                        {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                        {sidebarOpen && <span className="text-sm">Collapse</span>}
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden">
                {/* Top Header */}
                <header className="h-16 glass border-b border-dark-700/50 flex items-center px-6">
                    <div className="flex items-center gap-3">
                        <currentPage.icon className="w-5 h-5 text-primary-400" />
                        <div>
                            <h2 className="font-semibold text-white">{currentPage.label}</h2>
                            <p className="text-xs text-dark-400">{currentPage.description}</p>
                        </div>
                    </div>

                    <div className="ml-auto flex items-center gap-4">
                        <div className="text-right">
                            <p className="text-sm text-white">Moodle LMS</p>
                            <p className="text-xs text-dark-400">Read-Only Access</p>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                            <span className="text-white font-semibold text-sm">M</span>
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <div className="flex-1 overflow-auto p-6">
                    <Outlet />
                </div>
            </main>
        </div>
    )
}
