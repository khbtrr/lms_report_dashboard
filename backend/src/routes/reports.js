import express from 'express';
import { executeQuery, isReadOnlyQuery } from '../config/database.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPORTS_FILE = path.join(__dirname, '../../data/reports.json');

// Ensure data directory exists
async function ensureDataDir() {
    const dataDir = path.dirname(REPORTS_FILE);
    try {
        await fs.access(dataDir);
    } catch {
        await fs.mkdir(dataDir, { recursive: true });
    }
}

// Read saved reports from file
async function readReports() {
    try {
        await ensureDataDir();
        const data = await fs.readFile(REPORTS_FILE, 'utf-8');
        return JSON.parse(data);
    } catch {
        return [];
    }
}

// Write reports to file
async function writeReports(reports) {
    await ensureDataDir();
    await fs.writeFile(REPORTS_FILE, JSON.stringify(reports, null, 2));
}

// GET /api/reports
// List all saved custom reports
router.get('/', async (req, res) => {
    try {
        const reports = await readReports();
        res.json({ reports });
    } catch (error) {
        console.error('List reports error:', error);
        res.status(500).json({ error: 'Failed to fetch reports' });
    }
});

// GET /api/reports/:id
// Get a specific report
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const reports = await readReports();
        const report = reports.find(r => r.id === id);

        if (!report) {
            return res.status(404).json({ error: 'Report not found' });
        }

        res.json(report);
    } catch (error) {
        console.error('Get report error:', error);
        res.status(500).json({ error: 'Failed to fetch report' });
    }
});

// POST /api/reports
// Create a new custom report
router.post('/', async (req, res) => {
    try {
        const { name, description, sql } = req.body;

        if (!name || !sql) {
            return res.status(400).json({ error: 'Name and SQL are required' });
        }

        if (!isReadOnlyQuery(sql)) {
            return res.status(400).json({ error: 'Only SELECT queries are allowed for security reasons' });
        }

        const reports = await readReports();
        const newReport = {
            id: `report_${Date.now()}`,
            name,
            description: description || '',
            sql,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        reports.push(newReport);
        await writeReports(reports);

        res.status(201).json(newReport);
    } catch (error) {
        console.error('Create report error:', error);
        res.status(500).json({ error: 'Failed to create report' });
    }
});

// PUT /api/reports/:id
// Update an existing report
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, sql } = req.body;

        if (sql && !isReadOnlyQuery(sql)) {
            return res.status(400).json({ error: 'Only SELECT queries are allowed for security reasons' });
        }

        const reports = await readReports();
        const index = reports.findIndex(r => r.id === id);

        if (index === -1) {
            return res.status(404).json({ error: 'Report not found' });
        }

        reports[index] = {
            ...reports[index],
            name: name || reports[index].name,
            description: description ?? reports[index].description,
            sql: sql || reports[index].sql,
            updatedAt: new Date().toISOString()
        };

        await writeReports(reports);
        res.json(reports[index]);
    } catch (error) {
        console.error('Update report error:', error);
        res.status(500).json({ error: 'Failed to update report' });
    }
});

// DELETE /api/reports/:id
// Delete a report
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const reports = await readReports();
        const index = reports.findIndex(r => r.id === id);

        if (index === -1) {
            return res.status(404).json({ error: 'Report not found' });
        }

        reports.splice(index, 1);
        await writeReports(reports);

        res.json({ message: 'Report deleted successfully' });
    } catch (error) {
        console.error('Delete report error:', error);
        res.status(500).json({ error: 'Failed to delete report' });
    }
});

// POST /api/reports/execute
// Execute a custom SQL query (must be read-only)
router.post('/execute', async (req, res) => {
    try {
        const { sql, limit = 100 } = req.body;

        if (!sql) {
            return res.status(400).json({ error: 'SQL query is required' });
        }

        if (!isReadOnlyQuery(sql)) {
            return res.status(400).json({
                error: 'Only SELECT queries are allowed for security reasons. INSERT, UPDATE, DELETE, and other modifying statements are not permitted.'
            });
        }

        // Add LIMIT if not present to prevent huge result sets
        let executeSql = sql.trim();
        if (!executeSql.toUpperCase().includes('LIMIT')) {
            executeSql = `${executeSql} LIMIT ${parseInt(limit)}`;
        }

        const startTime = Date.now();
        const result = await executeQuery(executeSql);
        const executionTime = Date.now() - startTime;

        if (!result.success) {
            return res.status(400).json({
                error: 'Query execution failed',
                details: result.error
            });
        }

        res.json({
            success: true,
            rowCount: result.data.length,
            executionTime: `${executionTime}ms`,
            data: result.data
        });

    } catch (error) {
        console.error('Execute query error:', error);
        res.status(500).json({ error: 'Failed to execute query' });
    }
});

export default router;
