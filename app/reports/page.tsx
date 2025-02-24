"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { PostgrestError } from "@supabase/supabase-js"

interface ReportEntry {
  id: number
  name: string
  employeeId: string
  timestamp: string
  type: string
  auto_generated: boolean
}

interface Employee {
  id: number
  name: string
  employee_id: string
}

interface AccessLog {
  id: number;
  timestamp: string;
  type: string;
  auto_generated: boolean;
  employees: {
    name: string;
    employee_id: string;
  } | null;
}

export default function Reports() {
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [reportData, setReportData] = useState<ReportEntry[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Establecer rango de fechas por defecto (último mes)
    const end = new Date()
    const start = new Date()
    start.setMonth(start.getMonth() - 1)
    setEndDate(end.toISOString().split("T")[0])
    setStartDate(start.toISOString().split("T")[0])

    // Cargar lista de empleados
    fetchEmployees()
  }, [])

  async function fetchEmployees() {
    try {
      const { data, error } = await supabase
        .from("employees")
        .select("id, name, employee_id")
        .order("name")

      if (error) throw error
      setEmployees(data || [])
    } catch (error) {
      console.error("Error fetching employees:", error)
    }
  }

  async function generateReport(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      let query = supabase
        .from("access_logs")
        .select(`
          id,
          timestamp,
          type,
          auto_generated,
          employees (
            name,
            employee_id
          )
        `)
        .gte("timestamp", `${startDate}T00:00:00`)
        .lte("timestamp", `${endDate}T23:59:59`)
        .order("timestamp", { ascending: false })

      // Aplicar filtro de empleado si está seleccionado
      if (selectedEmployee !== "all") {
        query = query.eq("employee_id", selectedEmployee)
      }

      const { data: logs, error: logsError } = await query as unknown as { 
        data: AccessLog[], 
        error: PostgrestError | null 
      }

      if (logsError) throw logsError

      const reportData = logs.map((log: AccessLog) => ({
        id: log.id,
        name: log.employees?.name || "Unknown",
        employeeId: log.employees?.employee_id || "Unknown",
        timestamp: new Date(log.timestamp).toLocaleString("es-CO", {
          dateStyle: "medium",
          timeStyle: "medium",
        }),
        type: log.type === "check_in" ? "Entrada" : "Salida",
        auto_generated: log.auto_generated
      }))

      setReportData(reportData)
    } catch (error) {
      console.error("Error generating report:", error)
      alert("Error al generar el reporte. Por favor, intenta de nuevo.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Reporte de Accesos</h1>
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <form onSubmit={generateReport} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Empleado
                </label>
                <select
                  value={selectedEmployee}
                  onChange={(e) => setSelectedEmployee(e.target.value)}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                >
                  <option value="all">Todos los empleados</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fecha Inicial
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fecha Final
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                  required
                />
              </div>
            </div>
            <div>
              <button
                type="submit"
                disabled={loading}
                className={`w-full bg-indigo-500 text-white font-bold py-2 px-4 rounded
                  ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-indigo-600'}`}
              >
                {loading ? 'Generando Reporte...' : 'Generar Reporte'}
              </button>
            </div>
          </form>
        </div>

        {reportData.length > 0 && (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gray-50 text-gray-600 text-sm leading-normal">
                    <th className="py-3 px-6 text-left">Nombre</th>
                    <th className="py-3 px-6 text-left">ID Empleado</th>
                    <th className="py-3 px-6 text-left">Fecha y Hora</th>
                    <th className="py-3 px-6 text-left">Tipo</th>
                    <th className="py-3 px-6 text-left">Estado</th>
                  </tr>
                </thead>
                <tbody className="text-gray-600 text-sm">
                  {reportData.map((entry) => (
                    <tr key={entry.id} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="py-3 px-6">{entry.name}</td>
                      <td className="py-3 px-6">{entry.employeeId}</td>
                      <td className="py-3 px-6">{entry.timestamp}</td>
                      <td className="py-3 px-6">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          entry.type === "Entrada" 
                            ? "bg-green-100 text-green-800" 
                            : "bg-red-100 text-red-800"
                        }`}>
                          {entry.type}
                        </span>
                      </td>
                      <td className="py-3 px-6">
                        {entry.auto_generated ? (
                          <span className="text-xs text-orange-600">
                            Generado automáticamente
                          </span>
                        ) : (
                          <span className="text-xs text-green-600">
                            Registro manual
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
