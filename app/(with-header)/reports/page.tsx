"use client"

import { useState, useEffect } from "react"
import { motion } from 'framer-motion'

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

interface ReportAPIResponse {
  id: number;
  name: string;
  employeeId: string;
  timestamp: string;
  type: string;
  auto_generated: boolean;
}

export default function Reports() {
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [reportData, setReportData] = useState<ReportEntry[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all")
  const [loading, setLoading] = useState(false)
  const [filterApplied, setFilterApplied] = useState(false)

  useEffect(() => {
    // Establecer rango de fechas por defecto (últimos 3 meses para incluir más registros)
    const end = new Date()
    const start = new Date()
    start.setMonth(start.getMonth() - 3)
    setEndDate(end.toISOString().split("T")[0])
    setStartDate(start.toISOString().split("T")[0])

    // Cargar lista de empleados
    fetchEmployees()
  }, [])

  // Función para ampliar el rango de búsqueda
  const expandDateRange = async () => {
    const end = new Date()
    const start = new Date()
    start.setFullYear(start.getFullYear() - 1) // Ampliar a 1 año
    const newStartDate = start.toISOString().split("T")[0];
    const newEndDate = end.toISOString().split("T")[0];
    
    setEndDate(newEndDate);
    setStartDate(newStartDate);
    
    // Generar reporte automáticamente con el nuevo rango
    setLoading(true)
    setFilterApplied(true)

    try {
      console.log("🔍 Expand: Iniciando generateReport...");
      console.log("📅 Expand: Rango de fechas:", { startDate: newStartDate, endDate: newEndDate });
      console.log("👤 Expand: Empleado seleccionado:", selectedEmployee);
      
      const params = new URLSearchParams({
        startDate: newStartDate,
        endDate: newEndDate,
        employeeId: selectedEmployee
      });

      console.log("🔎 Expand: Ejecutando consulta...");
      const response = await fetch(`/api/reports/access-logs?${params}`);
      const result = await response.json();

      console.log("📊 Expand: Resultado consulta:", result);
      console.log("📈 Expand: Cantidad de registros:", result.reports?.length || 0);

      if (!response.ok) {
        console.error("❌ Expand: Error en consulta:", result.error);
        throw new Error(result.error || "Error al obtener reportes");
      }

      const reportData = result.reports.map((log: ReportAPIResponse) => ({
        id: log.id,
        name: log.name,
        employeeId: log.employeeId,
        timestamp: new Date(log.timestamp).toLocaleString("es-CO", {
          dateStyle: "medium",
          timeStyle: "medium",
        }),
        type: log.type,
        auto_generated: log.auto_generated
      }));

      console.log("✅ Expand: Datos procesados:", reportData.length);
      setReportData(reportData);
    } catch (error) {
      console.error("💥 Expand: Error generating report:", error);
      alert("Error al generar el reporte. Por favor, intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  async function fetchEmployees() {
    try {
      console.log("🔍 Iniciando fetchEmployees...");
      
      const response = await fetch('/api/reports/employees');
      const result = await response.json();
      
      console.log("📊 Resultado fetchEmployees:", result);
      
      if (!response.ok) {
        console.error("❌ Error en fetchEmployees:", result.error);
        throw new Error(result.error || "Error al obtener empleados");
      }
      
      console.log("✅ Empleados cargados:", result.employees?.length || 0);
      setEmployees(result.employees || []);
    } catch (error) {
      console.error("💥 Error fetching employees:", error);
    }
  }

  async function generateReport(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setFilterApplied(true)

    try {
      console.log("🔍 Iniciando generateReport...");
      console.log("📅 Rango de fechas:", { startDate, endDate });
      console.log("👤 Empleado seleccionado:", selectedEmployee);
      
      const params = new URLSearchParams({
        startDate,
        endDate,
        employeeId: selectedEmployee
      });

      console.log("🔎 Ejecutando consulta...");
      const response = await fetch(`/api/reports/access-logs?${params}`);
      const result = await response.json();

      console.log("📊 Resultado consulta:", result);
      console.log("📈 Cantidad de registros:", result.reports?.length || 0);

      if (!response.ok) {
        console.error("❌ Error en consulta:", result.error);
        throw new Error(result.error || "Error al obtener reportes");
      }

      const reportData = result.reports.map((log: ReportAPIResponse) => ({
        id: log.id,
        name: log.name,
        employeeId: log.employeeId,
        timestamp: new Date(log.timestamp).toLocaleString("es-CO", {
          dateStyle: "medium",
          timeStyle: "medium",
        }),
        type: log.type,
        auto_generated: log.auto_generated
      }));

      console.log("✅ Datos procesados:", reportData.length);
      setReportData(reportData);
    } catch (error) {
      console.error("💥 Error generating report:", error);
      alert("Error al generar el reporte. Por favor, intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  // Calcular estadísticas simples
  const totalEntries = reportData.length;
  const checkIns = reportData.filter(entry => entry.type === "Entrada").length;
  const checkOuts = reportData.filter(entry => entry.type === "Salida").length;
  const autoGenerated = reportData.filter(entry => entry.auto_generated).length;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="container mx-auto px-4 py-12 max-w-7xl"
    >
      <div className="text-center mb-12">
        <h1 className="text-3xl md:text-4xl font-bold mb-3 text-gray-900">Reportes de Acceso</h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Genera informes detallados de entradas y salidas filtrados por fecha y empleado
        </p>
      </div>

      <div className="card mb-8">
        <form onSubmit={generateReport} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="label">
                Empleado
              </label>
              <select
                value={selectedEmployee}
                onChange={(e) => setSelectedEmployee(e.target.value)}
                className="input"
              >
                <option value="all">Todos los empleados</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.employee_id})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">
                Fecha Inicial
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input"
                required
              />
            </div>
            <div>
              <label className="label">
                Fecha Final
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="input"
                required
              />
            </div>
          </div>
          <div>
            <button
              type="submit"
              disabled={loading}
              className={`btn btn-primary btn-lg w-full ${loading ? 'opacity-70' : ''}`}
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  Generando Reporte...
                </div>
              ) : 'Generar Reporte'}
            </button>
          </div>
        </form>
      </div>

      {filterApplied && (
        <>
          {totalEntries > 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <div className="card bg-sky-50 border border-sky-100">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-gray-600 text-sm">Total de registros</p>
                      <h3 className="text-3xl font-bold text-sky-700">{totalEntries}</h3>
                    </div>
                    <div className="h-12 w-12 rounded-lg bg-sky-500 flex items-center justify-center">
                      <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
                      </svg>
                    </div>
                  </div>
                </div>
                
                <div className="card bg-green-50 border border-green-100">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-gray-600 text-sm">Entradas</p>
                      <h3 className="text-3xl font-bold text-green-700">{checkIns}</h3>
                    </div>
                    <div className="h-12 w-12 rounded-lg bg-green-500 flex items-center justify-center">
                      <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"></path>
                      </svg>
                    </div>
                  </div>
                </div>
                
                <div className="card bg-red-50 border border-red-100">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-gray-600 text-sm">Salidas</p>
                      <h3 className="text-3xl font-bold text-red-700">{checkOuts}</h3>
                    </div>
                    <div className="h-12 w-12 rounded-lg bg-red-500 flex items-center justify-center">
                      <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
                      </svg>
                    </div>
                  </div>
                </div>
                
                <div className="card bg-amber-50 border border-amber-100">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-gray-600 text-sm">Auto-generados</p>
                      <h3 className="text-3xl font-bold text-amber-700">{autoGenerated}</h3>
                    </div>
                    <div className="h-12 w-12 rounded-lg bg-amber-500 flex items-center justify-center">
                      <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              <div className="card overflow-hidden">
                <div className="bg-gradient-to-r from-gray-50 to-white px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-800">Registros de Acceso</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Nombre
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          ID Empleado
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Fecha y Hora
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Tipo
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Estado
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {reportData.map((entry) => (
                        <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {entry.name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {entry.employeeId}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {entry.timestamp}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-3 py-1 inline-flex text-xs leading-5 font-medium rounded-full ${
                              entry.type === "Entrada" 
                                ? "bg-green-100 text-green-800" 
                                : "bg-red-100 text-red-800"
                            }`}>
                              {entry.type}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {entry.auto_generated ? (
                              <span className="flex items-center text-xs text-amber-700">
                                <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                                Auto-generado
                              </span>
                            ) : (
                              <span className="flex items-center text-xs text-green-700">
                                <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                </svg>
                                Manual
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="card bg-gray-50 text-center p-8"
            >
              <div className="flex flex-col items-center justify-center text-gray-500 py-6">
                <svg className="h-16 w-16 mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path>
                </svg>
                <h3 className="text-lg font-medium mb-1">No se encontraron registros</h3>
                <p className="text-gray-500 mb-6">
                  No hay datos de acceso para los criterios seleccionados. Prueba con un rango de fechas más amplio o un empleado diferente.
                </p>
                <button
                  type="button"
                  onClick={expandDateRange}
                  className="btn btn-outline"
                >
                  Ampliar rango de búsqueda
                </button>
              </div>
            </motion.div>
          )}
        </>
      )}
    </motion.div>
  )
}
