import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { testConnection } from './config/database.js';

// Import routes
import dashboardRoutes from './routes/dashboard.js';
import coursesRoutes from './routes/courses.js';
import usersRoutes from './routes/users.js';
import logsRoutes from './routes/logs.js';
import reportsRoutes from './routes/reports.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
    const dbConnected = await testConnection();
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: dbConnected ? 'connected' : 'disconnected'
    });
});

// API Routes
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/courses', coursesRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/reports', reportsRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
async function startServer() {
    // Test database connection on startup
    console.log('🔌 Testing database connection...');
    const dbConnected = await testConnection();

    if (!dbConnected) {
        console.warn('⚠️  Warning: Database connection failed. API will start but database queries will fail.');
        console.warn('   Please check your .env configuration.');
    }

    app.listen(PORT, () => {
        console.log(`
╔════════════════════════════════════════════════════════╗
║     LMS Moodle Dashboard - API Server                  ║
╠════════════════════════════════════════════════════════╣
║  🚀 Server running on http://localhost:${PORT}            ║
║  📊 API Base URL: http://localhost:${PORT}/api            ║
║  💾 Database: ${dbConnected ? '✅ Connected' : '❌ Disconnected'}                        ║
╚════════════════════════════════════════════════════════╝
    `);
    });
}

startServer();
