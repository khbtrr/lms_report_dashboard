import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Courses from './pages/Courses'
import UserProgress from './pages/UserProgress'
import LogActivity from './pages/LogActivity'
import Reports from './pages/Reports'

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Layout />}>
                    <Route index element={<Dashboard />} />
                    <Route path="courses" element={<Courses />} />
                    <Route path="users" element={<UserProgress />} />
                    <Route path="logs" element={<LogActivity />} />
                    <Route path="reports" element={<Reports />} />
                </Route>
            </Routes>
        </BrowserRouter>
    )
}

export default App
