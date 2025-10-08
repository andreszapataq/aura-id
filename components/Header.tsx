'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '@/contexts/AuthContext'

export default function Header() {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const { user, userProfile, isAdmin, isKiosk, canLogout, signOut } = useAuth()
  
  // NO renderizar header para usuarios kiosco
  if (isKiosk) {
    return null
  }
  
  // Filtrar navegación según rol del usuario
  const allNavigationItems = [
    { name: 'Inicio', href: '/', roles: ['admin', 'user'] },
    { name: 'Registrar', href: '/register', roles: ['admin'] },
    { name: 'Control de Acceso', href: '/access', roles: ['admin', 'user'] },
    { name: 'Reportes', href: '/reports', roles: ['admin'] },
    { name: 'Kioscos', href: '/admin/kiosks', roles: ['admin'] },
  ]
  
  // Mostrar solo las opciones permitidas para el rol actual
  const navigationItems = allNavigationItems.filter(item => 
    item.roles.includes(userProfile?.role || 'user')
  )

  // Verifica si la ruta actual coincide con el enlace de navegación
  const isActive = (path: string) => {
    return pathname === path
  }

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      await signOut()
      // La redirección a la página de login se realiza en la función signOut
    } catch (error) {
      console.error('Error al cerrar sesión:', error)
    } finally {
      setIsLoggingOut(false)
    }
  }

  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/" className="flex items-center">
                <Image 
                  src="/logo.png" 
                  alt="Aura ID Logo" 
                  width={32} 
                  height={32}
                  className="h-8 w-auto"
                />
                <span className="ml-2 text-xl font-bold text-black">Aura ID</span>
              </Link>
            </div>
            <nav className="hidden sm:ml-8 sm:flex sm:space-x-8">
              {navigationItems.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium h-16 ${
                    isActive(item.href)
                      ? 'border-[#00DD8B] text-[#014F59]'
                      : 'border-transparent text-gray-500 hover:text-[#014F59] hover:border-[#00BF71]'
                  }`}
                >
                  {item.name}
                </Link>
              ))}
            </nav>
          </div>
          
          {/* Botón de cerrar sesión - Solo si canLogout es true */}
          {user && (
            <div className="hidden sm:flex sm:items-center">
              <div className="mr-4 text-sm text-gray-600">
                {userProfile?.full_name || user.email}
                {isAdmin && <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">Admin</span>}
              </div>
              {canLogout && (
                <button
                  onClick={handleLogout}
                  className="btn btn-sm btn-outline"
                  disabled={isLoggingOut}
                >
                  {isLoggingOut ? 'Cerrando...' : 'Cerrar Sesión'}
                </button>
              )}
            </div>
          )}
          
          {/* Botón del menú móvil */}
          <div className="sm:hidden flex items-center">
            <button
              type="button"
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-[#014F59] hover:bg-[#00DD8B]/10 focus:outline-none"
              aria-controls="mobile-menu"
              aria-expanded="false"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <span className="sr-only">Abrir menú principal</span>
              {!mobileMenuOpen ? (
                <svg className="block h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              ) : (
                <svg className="block h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Menú móvil */}
      {mobileMenuOpen && (
        <motion.div 
          id="mobile-menu"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="sm:hidden"
        >
          <div className="pt-2 pb-3 space-y-1">
            {navigationItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`block pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
                  isActive(item.href)
                    ? 'bg-[#00DD8B]/10 border-[#00DD8B] text-[#014F59]'
                    : 'border-transparent text-gray-500 hover:bg-[#00DD8B]/5 hover:border-[#00BF71] hover:text-[#014F59]'
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                {item.name}
              </Link>
            ))}
            
            {/* Información de usuario y botón de cerrar sesión en menú móvil */}
            {user && (
              <>
                <div className="pl-3 pr-4 py-2 text-sm text-gray-600">
                  {userProfile?.full_name || user.email}
                  {isAdmin && <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">Admin</span>}
                </div>
                {canLogout && (
                  <button
                    onClick={handleLogout}
                    className="w-full text-left block pl-3 pr-4 py-2 border-l-4 border-transparent text-gray-500 hover:bg-[#00DD8B]/5 hover:border-[#00BF71] hover:text-[#014F59] text-base font-medium"
                    disabled={isLoggingOut}
                  >
                    {isLoggingOut ? 'Cerrando...' : 'Cerrar Sesión'}
                  </button>
                )}
              </>
            )}
          </div>
        </motion.div>
      )}
    </header>
  )
} 