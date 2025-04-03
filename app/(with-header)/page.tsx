'use client'

import Link from "next/link"
import { motion } from 'framer-motion'

// Iconos estilizados para cada sección
const RegisterIcon = () => (
  <svg className="w-12 h-12 text-white group-hover:text-[#014F59]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"></path>
  </svg>
)

const AccessIcon = () => (
  <svg className="w-12 h-12 text-white group-hover:text-[#014F59]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"></path>
  </svg>
)

const ReportsIcon = () => (
  <svg className="w-12 h-12 text-white group-hover:text-[#014F59]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
  </svg>
)

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
}

const item = {
  hidden: { y: 20, opacity: 0 },
  show: { y: 0, opacity: 1 }
}

export default function Home() {
  return (
    <main className="container mx-auto px-4 py-12 md:py-20">
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-12 md:mb-16"
      >
        <h1 className="text-4xl md:text-5xl font-bold mb-4 text-gray-900 text-display">
          Control de Acceso de Empleados
        </h1>
        <p className="text-lg md:text-xl text-gray-600 max-w-3xl mx-auto text-body">
          Sistema inteligente de verificación facial para gestión de entradas y salidas
        </p>
      </motion.div>

      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="grid gap-6 sm:grid-cols-1 md:grid-cols-3 max-w-6xl mx-auto"
      >
        <motion.div variants={item}>
          <Link href="/register" className="block group h-full">
            <div className="card card-hover h-full flex flex-col items-center py-12 group-hover:bg-[#00DD8B] transition-all duration-300">
              <div className="w-20 h-20 flex items-center justify-center rounded-full bg-[#00BF71] group-hover:bg-white transition-colors duration-300">
                <RegisterIcon />
              </div>
              <h2 className="text-2xl font-semibold mt-6 mb-3 text-gray-900 text-heading">Registro</h2>
              <p className="text-gray-700 text-center max-w-xs text-body">
                Registra nuevos empleados en el sistema mediante reconocimiento facial
              </p>
            </div>
          </Link>
        </motion.div>

        <motion.div variants={item}>
          <Link href="/access" className="block group h-full">
            <div className="card card-hover h-full flex flex-col items-center py-12 group-hover:bg-[#00DD8B] transition-all duration-300">
              <div className="w-20 h-20 flex items-center justify-center rounded-full bg-[#00BF71] group-hover:bg-white transition-colors duration-300">
                <AccessIcon />
              </div>
              <h2 className="text-2xl font-semibold mt-6 mb-3 text-gray-900 text-heading">Control de Acceso</h2>
              <p className="text-gray-700 text-center max-w-xs text-body">
                Registra entradas y salidas de empleados de manera rápida y segura
              </p>
            </div>
          </Link>
        </motion.div>

        <motion.div variants={item}>
          <Link href="/reports" className="block group h-full">
            <div className="card card-hover h-full flex flex-col items-center py-12 group-hover:bg-[#00DD8B] transition-all duration-300">
              <div className="w-20 h-20 flex items-center justify-center rounded-full bg-[#00BF71] group-hover:bg-white transition-colors duration-300">
                <ReportsIcon />
              </div>
              <h2 className="text-2xl font-semibold mt-6 mb-3 text-gray-900 text-heading">Reportes</h2>
              <p className="text-gray-700 text-center max-w-xs text-body">
                Genera informes detallados de acceso y visualiza estadísticas
              </p>
            </div>
          </Link>
        </motion.div>
      </motion.div>
    </main>
  )
}
