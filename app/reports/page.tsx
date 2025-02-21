"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"

interface ReportEntry {
  name: string
  employeeId: string
  checkIn: string
  type: string
}

interface LogEntry {
  employees?: {
    name?: string
    employee_id?: string
  }
  timestamp: string
  type: string
}

export default function Reports() {
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [reportData, setReportData] = useState<ReportEntry[]>([])

  useEffect(() => {
    // Set default date range to last 7 days
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - 7)
    setEndDate(end.toISOString().split("T")[0])
    setStartDate(start.toISOString().split("T")[0])
  }, [])

  async function generateReport(e: React.FormEvent) {
    e.preventDefault()

    try {
      const { data: logs, error: logsError } = await supabase
        .from("access_logs")
        .select("*, employees(name, employee_id)")
        .gte("timestamp", startDate)
        .lte("timestamp", endDate)
        .order("timestamp", { ascending: true })

      if (logsError) throw logsError

      const reportData = logs.map((log: LogEntry) => ({
        name: log.employees?.name || "Unknown",
        employeeId: log.employees?.employee_id || "Unknown",
        checkIn: new Date(log.timestamp).toLocaleString(),
        type: log.type,
      }))

      setReportData(reportData)
    } catch (error) {
      console.error("Error generating report:", error)
      alert("Failed to generate report. Please try again.")
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <h1 className="text-3xl font-bold mb-8">Generate Reports</h1>
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-4xl">
        <form onSubmit={generateReport} className="space-y-4 mb-8">
          <div className="flex space-x-4">
            <div className="flex-1">
              <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">
                Start Date
              </label>
              <input
                type="date"
                id="startDate"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
              />
            </div>
            <div className="flex-1">
              <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">
                End Date
              </label>
              <input
                type="date"
                id="endDate"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
              />
            </div>
          </div>
          <div>
            <button
              type="submit"
              className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2 px-4 rounded"
            >
              Generate Report
            </button>
          </div>
        </form>
        {reportData.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white">
              <thead>
                <tr className="bg-gray-200 text-gray-600 uppercase text-sm leading-normal">
                  <th className="py-3 px-6 text-left">Name</th>
                  <th className="py-3 px-6 text-left">Employee ID</th>
                  <th className="py-3 px-6 text-left">Check In/Out</th>
                  <th className="py-3 px-6 text-left">Type</th>
                </tr>
              </thead>
              <tbody className="text-gray-600 text-sm font-light">
                {reportData.map((entry, index) => (
                  <tr key={index} className="border-b border-gray-200 hover:bg-gray-100">
                    <td className="py-3 px-6 text-left whitespace-nowrap">{entry.name}</td>
                    <td className="py-3 px-6 text-left">{entry.employeeId}</td>
                    <td className="py-3 px-6 text-left">{entry.checkIn}</td>
                    <td className="py-3 px-6 text-left">{entry.type}</td>
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
