import { useState, useEffect } from 'react'
import { Play, Save, Plus, Trash2, Edit3, FileCode, AlertTriangle, Clock, Loader2, X, Check } from 'lucide-react'
import { reportsApi } from '../services/api'

export default function CustomReports() {
    const [reports, setReports] = useState([])
    const [selectedReport, setSelectedReport] = useState(null)
    const [sql, setSql] = useState('')
    const [reportName, setReportName] = useState('')
    const [reportDescription, setReportDescription] = useState('')
    const [results, setResults] = useState(null)
    const [loading, setLoading] = useState(false)
    const [executing, setExecuting] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)
    const [isEditing, setIsEditing] = useState(false)

    useEffect(() => {
        fetchReports()
    }, [])

    async function fetchReports() {
        try {
            setLoading(true)
            const data = await reportsApi.getAll()
            setReports(data.reports)
        } catch (err) {
            // Start with empty reports if API fails
            setReports([])
        } finally {
            setLoading(false)
        }
    }

    async function handleExecute() {
        if (!sql.trim()) return

        try {
            setExecuting(true)
            setError(null)
            setResults(null)
            const data = await reportsApi.execute(sql)
            setResults(data)
        } catch (err) {
            setError(err.message || 'Query execution failed')
        } finally {
            setExecuting(false)
        }
    }

    async function handleSave() {
        if (!sql.trim() || !reportName.trim()) {
            setError('Report name and SQL are required')
            return
        }

        try {
            setSaving(true)
            setError(null)

            if (selectedReport && isEditing) {
                await reportsApi.update(selectedReport.id, {
                    name: reportName,
                    description: reportDescription,
                    sql: sql
                })
            } else {
                await reportsApi.create({
                    name: reportName,
                    description: reportDescription,
                    sql: sql
                })
            }

            await fetchReports()
            handleNewReport()
        } catch (err) {
            setError(err.message || 'Failed to save report')
        } finally {
            setSaving(false)
        }
    }

    async function handleDelete(reportId) {
        if (!confirm('Are you sure you want to delete this report?')) return

        try {
            await reportsApi.delete(reportId)
            await fetchReports()
            if (selectedReport?.id === reportId) {
                handleNewReport()
            }
        } catch (err) {
            setError(err.message || 'Failed to delete report')
        }
    }

    function handleSelectReport(report) {
        setSelectedReport(report)
        setReportName(report.name)
        setReportDescription(report.description || '')
        setSql(report.sql)
        setResults(null)
        setError(null)
        setIsEditing(false)
    }

    function handleNewReport() {
        setSelectedReport(null)
        setReportName('')
        setReportDescription('')
        setSql('')
        setResults(null)
        setError(null)
        setIsEditing(false)
    }

    function handleEdit() {
        setIsEditing(true)
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">Custom SQL Reports</h1>
                    <p className="text-dark-400 mt-1">Create and execute custom read-only queries</p>
                </div>
                <button onClick={handleNewReport} className="btn btn-primary">
                    <Plus className="w-4 h-4" />
                    New Report
                </button>
            </div>

            {/* Security Notice */}
            <div className="glass-card p-4 border-l-4 border-blue-500 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                    <p className="text-blue-400 font-medium">Security Notice</p>
                    <p className="text-dark-300 mt-1">
                        Only SELECT queries are allowed. INSERT, UPDATE, DELETE, and other modifying statements are blocked for database safety.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Saved Reports Sidebar */}
                <div className="glass-card lg:col-span-1">
                    <div className="p-4 border-b border-dark-700/50">
                        <h3 className="font-semibold text-white flex items-center gap-2">
                            <FileCode className="w-4 h-4 text-primary-400" />
                            Saved Reports
                        </h3>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                        {loading ? (
                            <div className="flex items-center justify-center h-20">
                                <Loader2 className="w-5 h-5 animate-spin text-primary-400" />
                            </div>
                        ) : reports.length === 0 ? (
                            <div className="p-4 text-center text-dark-400 text-sm">
                                No saved reports yet
                            </div>
                        ) : (
                            <div className="divide-y divide-dark-700/30">
                                {reports.map(report => (
                                    <div
                                        key={report.id}
                                        className={`p-3 hover:bg-primary-500/10 cursor-pointer transition-colors ${selectedReport?.id === report.id ? 'bg-primary-500/20 border-l-2 border-primary-500' : ''
                                            }`}
                                        onClick={() => handleSelectReport(report)}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-white text-sm truncate">{report.name}</p>
                                                <p className="text-xs text-dark-500 mt-1 truncate">{report.description || 'No description'}</p>
                                            </div>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDelete(report.id); }}
                                                className="text-dark-500 hover:text-red-400 p-1"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* SQL Editor */}
                <div className="glass-card lg:col-span-3 flex flex-col">
                    <div className="p-4 border-b border-dark-700/50">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <input
                                    type="text"
                                    placeholder="Report name..."
                                    value={reportName}
                                    onChange={(e) => setReportName(e.target.value)}
                                    className="input-field"
                                    disabled={selectedReport && !isEditing}
                                />
                                <input
                                    type="text"
                                    placeholder="Description (optional)..."
                                    value={reportDescription}
                                    onChange={(e) => setReportDescription(e.target.value)}
                                    className="input-field"
                                    disabled={selectedReport && !isEditing}
                                />
                            </div>
                            {selectedReport && !isEditing && (
                                <button onClick={handleEdit} className="btn btn-secondary">
                                    <Edit3 className="w-4 h-4" />
                                    Edit
                                </button>
                            )}
                        </div>
                    </div>

                    {/* SQL Input */}
                    <div className="p-4 flex-1">
                        <textarea
                            value={sql}
                            onChange={(e) => setSql(e.target.value)}
                            placeholder="Enter your SQL query here...&#10;&#10;Example:&#10;SELECT u.id, u.firstname, u.lastname, u.email&#10;FROM mdl_user u&#10;WHERE u.deleted = 0&#10;LIMIT 10"
                            className="w-full h-48 input-field font-mono text-sm resize-none"
                            spellCheck="false"
                        />
                    </div>

                    {/* Action Buttons */}
                    <div className="p-4 border-t border-dark-700/50 flex flex-wrap items-center gap-3">
                        <button
                            onClick={handleExecute}
                            disabled={executing || !sql.trim()}
                            className="btn btn-primary disabled:opacity-50"
                        >
                            {executing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                            Execute
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving || !sql.trim() || !reportName.trim()}
                            className="btn btn-secondary disabled:opacity-50"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            {selectedReport && isEditing ? 'Update' : 'Save'}
                        </button>
                        {(selectedReport || sql || reportName) && (
                            <button onClick={handleNewReport} className="btn btn-secondary">
                                <X className="w-4 h-4" />
                                Clear
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Error Display */}
            {error && (
                <div className="glass-card p-4 border-l-4 border-yellow-500">
                    <p className="text-yellow-400 text-sm">⚠️ {error}</p>
                </div>
            )}

            {/* Results */}
            {results && (
                <div className="glass-card overflow-hidden">
                    <div className="p-4 border-b border-dark-700/50 flex items-center justify-between">
                        <div>
                            <h3 className="font-semibold text-white flex items-center gap-2">
                                <Check className="w-4 h-4 text-green-400" />
                                Query Results
                            </h3>
                            <p className="text-sm text-dark-400 mt-1">
                                {results.rowCount} rows returned
                            </p>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-dark-400">
                            <Clock className="w-4 h-4" />
                            {results.executionTime}
                        </div>
                    </div>

                    {results.data && results.data.length > 0 ? (
                        <div className="overflow-x-auto max-h-96">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        {Object.keys(results.data[0]).map((key) => (
                                            <th key={key}>{key}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {results.data.map((row, idx) => (
                                        <tr key={idx}>
                                            {Object.values(row).map((value, valIdx) => (
                                                <td key={valIdx}>
                                                    <span className="text-dark-200">
                                                        {value === null ? <span className="text-dark-500 italic">NULL</span> : String(value)}
                                                    </span>
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="p-8 text-center text-dark-400">
                            Query executed successfully but returned no results
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
