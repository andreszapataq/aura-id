import Link from 'next/link';
import Image from 'next/image';

export default function Footer() {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="bg-white border-t border-gray-200 mt-auto">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="md:flex md:items-center md:justify-between">
          <div className="flex justify-center md:justify-start space-x-6">
            <Link 
              href="/"
              className="text-gray-500 hover:text-[#014F59]"
            >
              Inicio
            </Link>
            <Link 
              href="/register"
              className="text-gray-500 hover:text-[#014F59]"
            >
              Registro
            </Link>
            <Link 
              href="/access"
              className="text-gray-500 hover:text-[#014F59]"
            >
              Control de Acceso
            </Link>
            <Link 
              href="/reports"
              className="text-gray-500 hover:text-[#014F59]"
            >
              Reportes
            </Link>
          </div>
          
          <div className="mt-8 md:mt-0 flex items-center justify-center md:justify-end">
            <div className="flex items-center">
              <Image 
                src="/logo.svg" 
                alt="Aura ID Logo" 
                width={24} 
                height={24}
                className="h-6 w-auto"
                unoptimized
              />
              <span className="ml-2 text-sm text-[#014F59]">
                © {currentYear} Aura ID. Todos los derechos reservados.
              </span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
} 