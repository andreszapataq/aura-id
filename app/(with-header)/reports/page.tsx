"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { motion, AnimatePresence } from 'framer-motion'

interface ReportEntry {
  id: string
  name: string
  employeeId: string
  timestamp: string
  type: string
  auto_generated: boolean
  edited_by_admin: boolean
  originalTimestamp?: string
}

interface Employee {
  id: number
  name: string
  employee_id: string
}

interface ReportAPIResponse {
  id: string
  name: string
  employeeId: string
  timestamp: string
  type: string
  auto_generated: boolean
  edited_by_admin: boolean
}

interface EditHistory {
  id: string
  previousTimestamp: string
  newTimestamp: string
  reason: string
  evidenceUrl: string | null
  createdAt: string
  adminName: string
}

// ─── Edit Modal ──────────────────────────────────────────────────────────────

function EditModal({
  entry,
  onClose,
  onSave,
}: {
  entry: ReportEntry
  onClose: () => void
  onSave: () => void
}) {
  const [newTime, setNewTime] = useState("")
  const [reason, setReason] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const reasonRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const date = new Date(entry.originalTimestamp || entry.timestamp)
    const h = String(date.getHours()).padStart(2, "0")
    const m = String(date.getMinutes()).padStart(2, "0")
    setNewTime(`${h}:${m}`)
    setTimeout(() => reasonRef.current?.focus(), 100)
  }, [entry])

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleEsc)
    return () => window.removeEventListener("keydown", handleEsc)
  }, [onClose])

  const handleSave = async () => {
    setError("")

    if (!newTime) {
      setError("Ingrese una hora válida")
      return
    }
    if (!reason.trim() || reason.trim().length < 10) {
      setError("El motivo debe tener al menos 10 caracteres")
      reasonRef.current?.focus()
      return
    }

    setSaving(true)
    try {
      const response = await fetch("/api/access/update-time", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logId: entry.id,
          newTime,
          reason: reason.trim(),
        }),
      })
      const result = await response.json()

      if (!response.ok) {
        setError(result.error || "Error al actualizar")
        return
      }

      onSave()
    } catch {
      setError("Error de conexión. Intente nuevamente.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#014F59] to-[#016d6d] px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">Editar Registro</h3>
              <p className="text-sm text-white/70 mt-0.5">
                {entry.name} &middot; {entry.type}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white/60 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* Hora actual vs nueva */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="label">Hora actual</label>
              <div className="input bg-gray-100 text-gray-500 cursor-not-allowed">
                {new Date(entry.originalTimestamp || entry.timestamp).toLocaleTimeString("es-CO", {
                  timeZone: "America/Bogota",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
            <div className="flex items-end pb-3 text-gray-400">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </div>
            <div className="flex-1">
              <label className="label">Nueva hora</label>
              <input
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                className="input"
                disabled={saving}
              />
            </div>
          </div>

          {/* Motivo */}
          <div>
            <label className="label">
              Motivo de la edición <span className="text-red-500">*</span>
            </label>
            <textarea
              ref={reasonRef}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej: Kiosco inaccesible, empleado reportó llegada a las 8:00 AM con foto de la puerta cerrada"
              className="input min-h-[100px] resize-none"
              disabled={saving}
              maxLength={500}
            />
            <div className="flex justify-between mt-1.5">
              <p className="text-xs text-gray-400">Mínimo 10 caracteres</p>
              <p className={`text-xs ${reason.length >= 10 ? "text-[#00BF71]" : "text-gray-400"}`}>
                {reason.length}/500
              </p>
            </div>
          </div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="alert alert-error flex items-start gap-2"
              >
                <svg className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 px-6 py-4 bg-gray-50/50 flex items-center justify-between">
          <p className="text-xs text-gray-400 max-w-[200px]">
            Esta acción quedará registrada en el historial de auditoría
          </p>
          <div className="flex gap-3">
            <button onClick={onClose} disabled={saving} className="btn btn-outline btn-sm">
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving} className="btn btn-secondary btn-sm min-w-[120px]">
              {saving ? (
                <div className="flex items-center gap-2">
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Guardando...
                </div>
              ) : (
                "Guardar cambio"
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── History Panel ───────────────────────────────────────────────────────────

function HistoryPanel({
  entryId,
  entryName,
  onClose,
}: {
  entryId: string
  entryName: string
  onClose: () => void
}) {
  const [history, setHistory] = useState<EditHistory[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch(`/api/access/edit-history?accessLogId=${entryId}`)
        const data = await res.json()
        if (res.ok) setHistory(data.history || [])
      } catch { /* silently fail */ }
      setLoading(false)
    }
    fetchHistory()
  }, [entryId])

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleEsc)
    return () => window.removeEventListener("keydown", handleEsc)
  }, [onClose])

  const formatTimestamp = (ts: string) =>
    new Date(ts).toLocaleString("es-CO", {
      timeZone: "America/Bogota",
      dateStyle: "medium",
      timeStyle: "short",
    })

  const formatTime = (ts: string) =>
    new Date(ts).toLocaleTimeString("es-CO", {
      timeZone: "America/Bogota",
      hour: "2-digit",
      minute: "2-digit",
    })

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[80vh] flex flex-col"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#014F59] to-[#016d6d] px-6 py-5 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">Historial de Ediciones</h3>
              <p className="text-sm text-white/70 mt-0.5">{entryName}</p>
            </div>
            <button
              onClick={onClose}
              className="text-white/60 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#00DD8B] border-t-transparent" />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <svg className="h-12 w-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm">No hay ediciones registradas</p>
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((edit, idx) => (
                <motion.div
                  key={edit.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="relative pl-6 pb-4 border-l-2 border-[#00DD8B]/30 last:border-transparent last:pb-0"
                >
                  {/* Timeline dot */}
                  <div className="absolute -left-[7px] top-1 h-3 w-3 rounded-full bg-[#00DD8B] ring-4 ring-[#00DD8B]/10" />

                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-[#014F59]">{edit.adminName}</span>
                      <span className="text-xs text-gray-400">{formatTimestamp(edit.createdAt)}</span>
                    </div>

                    {/* Time change */}
                    <div className="flex items-center gap-2 mb-3">
                      <span className="font-mono text-sm bg-red-50 text-red-600 px-2 py-0.5 rounded">
                        {formatTime(edit.previousTimestamp)}
                      </span>
                      <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                      <span className="font-mono text-sm bg-green-50 text-green-600 px-2 py-0.5 rounded">
                        {formatTime(edit.newTimestamp)}
                      </span>
                    </div>

                    {/* Reason */}
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {edit.reason}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 px-6 py-3 bg-gray-50/50 flex-shrink-0">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">
              {history.length} {history.length === 1 ? "edición" : "ediciones"} registradas
            </p>
            <button onClick={onClose} className="btn btn-outline btn-sm">
              Cerrar
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Stat Card Component ─────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  color,
  icon,
}: {
  label: string
  value: number
  color: "teal" | "green" | "red" | "amber"
  icon: React.ReactNode
}) {
  const colors = {
    teal: "bg-[#014F59]/5 border-[#014F59]/10 text-[#014F59]",
    green: "bg-[#00DD8B]/10 border-[#00BF71]/20 text-[#00BF71]",
    red: "bg-red-50 border-red-100 text-red-600",
    amber: "bg-amber-50 border-amber-100 text-amber-600",
  }
  const iconBg = {
    teal: "bg-[#014F59]",
    green: "bg-[#00BF71]",
    red: "bg-red-500",
    amber: "bg-amber-500",
  }

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.15 }}
      className={`card border ${colors[color]} transition-shadow hover:shadow-md`}
    >
      <div className="flex justify-between items-center">
        <div>
          <p className="text-gray-500 text-sm font-medium">{label}</p>
          <h3 className="text-3xl font-bold mt-1">{value}</h3>
        </div>
        <div className={`h-11 w-11 rounded-xl ${iconBg[color]} flex items-center justify-center shadow-sm`}>
          {icon}
        </div>
      </div>
    </motion.div>
  )
}

// ─── Worked Hours Calculator ────────────────────────────────────────────────

interface WorkedHoursResult {
  totalMs: number
  totalHours: number
  totalMinutes: number
  dailyBreakdown: { date: string; dateRaw: Date; hours: number; minutes: number; totalMs: number }[]
  incompletePairs: number
  totalPairs: number
}

function calculateWorkedHours(entries: ReportEntry[]): WorkedHoursResult {
  const sorted = [...entries].sort(
    (a, b) =>
      new Date(a.originalTimestamp!).getTime() -
      new Date(b.originalTimestamp!).getTime()
  )

  const pairs: { checkIn: Date; checkOut: Date }[] = []
  let incompletePairs = 0

  let i = 0
  while (i < sorted.length) {
    if (sorted[i].type === "Entrada") {
      const checkIn = new Date(sorted[i].originalTimestamp!)
      if (i + 1 < sorted.length && sorted[i + 1].type === "Salida") {
        const checkOut = new Date(sorted[i + 1].originalTimestamp!)
        pairs.push({ checkIn, checkOut })
        i += 2
      } else {
        incompletePairs++
        i++
      }
    } else {
      incompletePairs++
      i++
    }
  }

  const dailyMap = new Map<string, { dateRaw: Date; totalMs: number }>()
  let totalMs = 0

  for (const { checkIn, checkOut } of pairs) {
    const diffMs = checkOut.getTime() - checkIn.getTime()
    totalMs += diffMs

    const dateKey = checkIn.toLocaleDateString("es-CO", {
      timeZone: "America/Bogota",
    })
    const existing = dailyMap.get(dateKey)
    if (existing) {
      existing.totalMs += diffMs
    } else {
      dailyMap.set(dateKey, { dateRaw: checkIn, totalMs: diffMs })
    }
  }

  const dailyBreakdown = Array.from(dailyMap.entries())
    .map(([date, { dateRaw, totalMs: ms }]) => ({
      date,
      dateRaw,
      hours: Math.floor(ms / 3_600_000),
      minutes: Math.floor((ms % 3_600_000) / 60_000),
      totalMs: ms,
    }))
    .sort((a, b) => a.dateRaw.getTime() - b.dateRaw.getTime())

  return {
    totalMs,
    totalHours: Math.floor(totalMs / 3_600_000),
    totalMinutes: Math.floor((totalMs % 3_600_000) / 60_000),
    dailyBreakdown,
    incompletePairs,
    totalPairs: pairs.length,
  }
}

// ─── Worked Hours Panel ─────────────────────────────────────────────────────

function WorkedHoursPanel({ data, employeeName }: { data: WorkedHoursResult; employeeName: string }) {
  const [expanded, setExpanded] = useState(false)
  const maxDailyMs = Math.max(...data.dailyBreakdown.map((d) => d.totalMs), 1)

  const avgMs = data.dailyBreakdown.length > 0 ? data.totalMs / data.dailyBreakdown.length : 0
  const avgHours = Math.floor(avgMs / 3_600_000)
  const avgMinutes = Math.floor((avgMs % 3_600_000) / 60_000)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.12, duration: 0.35 }}
      className="mb-8 card overflow-hidden border border-[#014F59]/8"
    >
      {/* Compact Header */}
      <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
        {/* Left: icon + info */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#014F59] to-[#016d6d] flex items-center justify-center flex-shrink-0 shadow-sm">
            <svg className="h-5 w-5 text-[#00DD8B]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-gray-800">Horas Trabajadas</h3>
              <span className="text-xs text-gray-400">&middot;</span>
              <span className="text-sm text-gray-500 truncate">{employeeName}</span>
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="inline-flex items-center gap-1 text-xs text-[#014F59] bg-[#014F59]/5 px-2 py-0.5 rounded-full font-medium">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {data.dailyBreakdown.length} día{data.dailyBreakdown.length !== 1 ? "s" : ""}
              </span>
              {data.dailyBreakdown.length > 0 && (
                <span className="inline-flex items-center gap-1 text-xs text-[#00BF71] bg-[#00DD8B]/10 px-2 py-0.5 rounded-full font-medium">
                  ~{avgHours}h {String(avgMinutes).padStart(2, "0")}m/día
                </span>
              )}
              {data.incompletePairs > 0 && (
                <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-medium">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01" />
                  </svg>
                  {data.incompletePairs} sin par
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: total + toggle */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-right">
            <p className="text-2xl font-bold text-[#014F59] tracking-tight leading-none flex items-baseline gap-1">
              <span>{data.totalHours}</span>
              <span className="text-xs font-semibold text-[#014F59]/40">hrs</span>
              <span>{String(data.totalMinutes).padStart(2, "0")}</span>
              <span className="text-xs font-semibold text-[#014F59]/40">min</span>
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {data.dailyBreakdown.length} jornada{data.dailyBreakdown.length !== 1 ? "s" : ""}
            </p>
          </div>
          {data.dailyBreakdown.length > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-[#014F59]"
              title={expanded ? "Ocultar desglose" : "Ver desglose diario"}
            >
              <motion.svg
                animate={{ rotate: expanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </motion.svg>
            </button>
          )}
        </div>
      </div>

      {/* Collapsible Daily Breakdown */}
      <AnimatePresence initial={false}>
        {expanded && data.dailyBreakdown.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-4 pt-1 border-t border-gray-100">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2.5 mt-3">
                Desglose Diario
              </p>
              <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-1">
                {data.dailyBreakdown.map((day, idx) => {
                  const percent = Math.max((day.totalMs / maxDailyMs) * 100, 3)
                  const isOvertime = day.hours >= 9
                  return (
                    <motion.div
                      key={day.date}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.03 * idx, duration: 0.25 }}
                      className="flex items-center gap-3"
                    >
                      <span className="text-xs text-gray-500 w-20 flex-shrink-0 font-medium tabular-nums">
                        {day.date}
                      </span>
                      <div className="flex-1 h-5 bg-gray-100/80 rounded overflow-hidden relative">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${percent}%` }}
                          transition={{ delay: 0.06 + 0.03 * idx, duration: 0.4, ease: "easeOut" }}
                          className={`h-full rounded relative ${
                            isOvertime
                              ? "bg-gradient-to-r from-[#014F59] to-[#016d6d]"
                              : "bg-gradient-to-r from-[#00BF71] to-[#00DD8B]"
                          }`}
                        />
                      </div>
                      <span className={`text-xs font-semibold w-14 text-right tabular-nums ${
                        isOvertime ? "text-[#014F59]" : "text-gray-600"
                      }`}>
                        {day.hours}h {String(day.minutes).padStart(2, "0")}m
                      </span>
                    </motion.div>
                  )
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {data.dailyBreakdown.length === 0 && (
        <div className="px-5 pb-4 border-t border-gray-100">
          <p className="text-center py-4 text-sm text-gray-400">
            No se encontraron pares entrada/salida completos
          </p>
        </div>
      )}
    </motion.div>
  )
}

// ─── Main Reports Page ──────────────────────────────────────────────────────

export default function Reports() {
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [reportData, setReportData] = useState<ReportEntry[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all")
  const [loading, setLoading] = useState(false)
  const [filterApplied, setFilterApplied] = useState(false)

  // Modal state
  const [editingEntry, setEditingEntry] = useState<ReportEntry | null>(null)
  const [historyEntry, setHistoryEntry] = useState<{ id: string; name: string } | null>(null)
  const [successMessage, setSuccessMessage] = useState("")

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [recordsPerPage, setRecordsPerPage] = useState(25)

  useEffect(() => {
    const end = new Date()
    const start = new Date()
    start.setMonth(start.getMonth() - 3)
    setEndDate(end.toISOString().split("T")[0])
    setStartDate(start.toISOString().split("T")[0])
    fetchEmployees()
  }, [])

  // Auto-dismiss success message
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(""), 4000)
      return () => clearTimeout(timer)
    }
  }, [successMessage])

  async function fetchEmployees() {
    try {
      const response = await fetch("/api/reports/employees")
      const result = await response.json()
      if (response.ok) setEmployees(result.employees || [])
    } catch { /* silently fail */ }
  }

  const fetchReportWithParams = useCallback(async (start: string, end: string, empId: string) => {
    setLoading(true)
    setFilterApplied(true)
    setCurrentPage(1)

    try {
      const params = new URLSearchParams({ startDate: start, endDate: end })
      if (empId !== "all") params.append("employeeId", empId)

      const response = await fetch(`/api/reports/access-logs?${params}`)
      const result = await response.json()

      if (!response.ok) throw new Error(result.error)

      const mapped = result.reports.map((log: ReportAPIResponse) => ({
        id: log.id,
        name: log.name,
        employeeId: log.employeeId,
        timestamp: new Date(log.timestamp).toLocaleString("es-CO", {
          timeZone: "America/Bogota",
          dateStyle: "medium",
          timeStyle: "medium",
        }),
        type: log.type,
        auto_generated: log.auto_generated,
        edited_by_admin: log.edited_by_admin,
        originalTimestamp: log.timestamp,
      }))
      setReportData(mapped)
    } catch {
      setReportData([])
    } finally {
      setLoading(false)
    }
  }, [])

  async function generateReport(e: React.FormEvent) {
    e.preventDefault()
    await fetchReportWithParams(startDate, endDate, selectedEmployee)
  }

  const expandDateRange = async () => {
    const end = new Date()
    const start = new Date()
    start.setFullYear(start.getFullYear() - 1)
    const newStart = start.toISOString().split("T")[0]
    const newEnd = end.toISOString().split("T")[0]
    setStartDate(newStart)
    setEndDate(newEnd)
    await fetchReportWithParams(newStart, newEnd, selectedEmployee)
  }

  const handleEditSave = async () => {
    setEditingEntry(null)
    setSuccessMessage("Hora actualizada correctamente")
    await fetchReportWithParams(startDate, endDate, selectedEmployee)
  }

  // Stats
  const totalEntries = reportData.length
  const checkIns = reportData.filter((e) => e.type === "Entrada").length
  const checkOuts = reportData.filter((e) => e.type === "Salida").length
  const autoGenerated = reportData.filter((e) => e.auto_generated).length

  const selectedEmp = selectedEmployee !== "all"
    ? employees.find((e) => String(e.id) === selectedEmployee)
    : null
  const selectedEmployeeName = selectedEmp?.name ?? ""

  const workedHoursData = selectedEmp
    ? reportData.filter((entry) => entry.employeeId === selectedEmp.employee_id)
    : reportData
  const workedHours = selectedEmp ? calculateWorkedHours(workedHoursData) : null

  // Pagination
  const totalPages = Math.ceil(totalEntries / recordsPerPage)
  const startIndex = (currentPage - 1) * recordsPerPage
  const endIndex = startIndex + recordsPerPage
  const paginatedData = reportData.slice(startIndex, endIndex)

  const handleRecordsPerPageChange = (value: number) => {
    setRecordsPerPage(value)
    setCurrentPage(1)
  }

  const getStatusBadge = (entry: ReportEntry) => {
    if (entry.edited_by_admin) {
      return (
        <button
          onClick={() => setHistoryEntry({ id: entry.id, name: entry.name })}
          className="group inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-full transition-colors cursor-pointer"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Editado
          <svg className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )
    }
    if (entry.auto_generated) {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full">
          <svg className="h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Automático
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#00BF71] bg-[#00DD8B]/10 px-2.5 py-1 rounded-full">
        <svg className="h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
        </svg>
        Biométrico
      </span>
    )
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="container mx-auto px-4 py-10 max-w-7xl"
      >
        {/* Header */}
        <div className="text-center mb-10">
          <motion.h1
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl md:text-4xl font-bold mb-2"
          >
            Reportes de Acceso
          </motion.h1>
          <p className="text-gray-500 max-w-xl mx-auto">
            Consulta y gestiona los registros de entrada y salida de tu organización
          </p>
        </div>

        {/* Success Toast */}
        <AnimatePresence>
          {successMessage && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed top-6 right-6 z-40 alert alert-success flex items-center gap-3 shadow-lg"
            >
              <svg className="h-5 w-5 text-[#00BF71]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-medium">{successMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="card mb-8"
        >
          <form onSubmit={generateReport} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="label">Empleado</label>
                <select
                  value={selectedEmployee}
                  onChange={(e) => {
                    const val = e.target.value
                    setSelectedEmployee(val)
                    if (filterApplied) {
                      fetchReportWithParams(startDate, endDate, val)
                    }
                  }}
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
                <label className="label">Fecha Inicial</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="label">Fecha Final</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="input"
                  required
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className={`btn btn-primary btn-lg w-full ${loading ? "opacity-70" : ""}`}
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#014F59] border-t-transparent" />
                  Generando...
                </div>
              ) : (
                "Generar Reporte"
              )}
            </button>
          </form>
        </motion.div>

        {/* Results */}
        {filterApplied && (
          <>
            {totalEntries > 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                  <StatCard
                    label="Total registros"
                    value={totalEntries}
                    color="teal"
                    icon={
                      <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    }
                  />
                  <StatCard
                    label="Entradas"
                    value={checkIns}
                    color="green"
                    icon={
                      <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                      </svg>
                    }
                  />
                  <StatCard
                    label="Salidas"
                    value={checkOuts}
                    color="red"
                    icon={
                      <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                    }
                  />
                  <StatCard
                    label="Automáticos"
                    value={autoGenerated}
                    color="amber"
                    icon={
                      <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    }
                  />
                </div>

                {/* Worked Hours Panel */}
                <AnimatePresence>
                  {workedHours && (
                    <WorkedHoursPanel data={workedHours} employeeName={selectedEmployeeName} />
                  )}
                </AnimatePresence>

                {/* Table */}
                <div className="card overflow-hidden">
                  <div className="bg-gradient-to-r from-gray-50 to-white px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <h2 className="text-lg font-semibold text-gray-800">Registros de Acceso</h2>
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-500">Mostrar:</label>
                      <select
                        value={recordsPerPage}
                        onChange={(e) => handleRecordsPerPageChange(Number(e.target.value))}
                        className="input py-1.5 px-3 text-sm w-auto"
                      >
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50/80">
                        <tr>
                          <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Empleado
                          </th>
                          <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Fecha y Hora
                          </th>
                          <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Tipo
                          </th>
                          <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Estado
                          </th>
                          <th className="px-6 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Acciones
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-100">
                        {paginatedData.map((entry, idx) => (
                          <motion.tr
                            key={entry.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: idx * 0.02 }}
                            className="hover:bg-[#00DD8B]/[0.03] transition-colors group"
                          >
                            <td className="px-6 py-4">
                              <div>
                                <p className="text-sm font-medium text-gray-900">{entry.name}</p>
                                <p className="text-xs text-gray-400 mt-0.5">{entry.employeeId}</p>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                              {entry.timestamp}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full ${
                                  entry.type === "Entrada"
                                    ? "bg-[#00DD8B]/10 text-[#00BF71]"
                                    : "bg-red-50 text-red-600"
                                }`}
                              >
                                <span className={`h-1.5 w-1.5 rounded-full ${
                                  entry.type === "Entrada" ? "bg-[#00BF71]" : "bg-red-500"
                                }`} />
                                {entry.type}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {getStatusBadge(entry)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right">
                              <button
                                onClick={() => setEditingEntry(entry)}
                                className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-[#014F59] opacity-0 group-hover:opacity-100 transition-all px-2.5 py-1.5 rounded-lg hover:bg-[#014F59]/5"
                                title="Editar hora"
                              >
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                Editar
                              </button>
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="bg-gray-50/80 px-6 py-4 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <p className="text-sm text-gray-500">
                        Mostrando{" "}
                        <span className="font-medium text-gray-700">{startIndex + 1}</span> -{" "}
                        <span className="font-medium text-gray-700">{Math.min(endIndex, totalEntries)}</span>{" "}
                        de <span className="font-medium text-gray-700">{totalEntries}</span>
                      </p>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setCurrentPage(1)}
                          disabled={currentPage === 1}
                          className="p-2 rounded-lg border border-gray-200 hover:bg-white hover:border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                          disabled={currentPage === 1}
                          className="p-2 rounded-lg border border-gray-200 hover:bg-white hover:border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>

                        <div className="flex items-center gap-1 px-2">
                          <select
                            value={currentPage}
                            onChange={(e) => setCurrentPage(Number(e.target.value))}
                            className="input py-1 px-2 text-sm w-auto"
                          >
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                              <option key={p} value={p}>{p}</option>
                            ))}
                          </select>
                          <span className="text-sm text-gray-500">de {totalPages}</span>
                        </div>

                        <button
                          onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                          disabled={currentPage === totalPages}
                          className="p-2 rounded-lg border border-gray-200 hover:bg-white hover:border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setCurrentPage(totalPages)}
                          disabled={currentPage === totalPages}
                          className="p-2 rounded-lg border border-gray-200 hover:bg-white hover:border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="card bg-gray-50/50 text-center p-10"
              >
                <div className="flex flex-col items-center justify-center text-gray-400 py-6">
                  <svg className="h-16 w-16 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                  <h3 className="text-lg font-semibold text-gray-600 mb-1">Sin resultados</h3>
                  <p className="text-gray-400 mb-6 max-w-md">
                    No hay registros de acceso para los filtros seleccionados. Intenta ampliar el rango de fechas.
                  </p>
                  <button type="button" onClick={expandDateRange} className="btn btn-outline">
                    Ampliar a 1 año
                  </button>
                </div>
              </motion.div>
            )}
          </>
        )}
      </motion.div>

      {/* Modals */}
      <AnimatePresence>
        {editingEntry && (
          <EditModal
            entry={editingEntry}
            onClose={() => setEditingEntry(null)}
            onSave={handleEditSave}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {historyEntry && (
          <HistoryPanel
            entryId={historyEntry.id}
            entryName={historyEntry.name}
            onClose={() => setHistoryEntry(null)}
          />
        )}
      </AnimatePresence>
    </>
  )
}
