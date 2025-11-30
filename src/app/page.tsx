import Link from "next/link";
import { ArrowRight, BarChart3, ShieldCheck, Zap } from "lucide-react";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="container flex h-14 items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-2 font-bold text-xl">
            <BarChart3 className="h-6 w-6 text-blue-600" />
            <span>ContableAR</span>
          </div>
          <nav className="flex gap-4 sm:gap-6">
            <Link
              className="text-sm font-medium hover:underline underline-offset-4"
              href="/sign-in"
            >
              Iniciar Sesión
            </Link>
            <Link
              className="text-sm font-medium bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
              href="/sign-up"
            >
              Registrarse
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48 bg-gray-50">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl/none">
                  Gestión Contable Simplificada para Argentina
                </h1>
                <p className="mx-auto max-w-[700px] text-gray-500 md:text-xl dark:text-gray-400">
                  La plataforma integral para contadores y PyMEs. Facturación, Asientos, Libros IVA y más, adaptado a la normativa local.
                </p>
              </div>
              <div className="space-x-4">
                <Link
                  className="inline-flex h-9 items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-950 disabled:pointer-events-none disabled:opacity-50"
                  href="/dashboard"
                >
                  Comenzar Ahora <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>
        <section className="w-full py-12 md:py-24 lg:py-32 bg-white">
          <div className="container px-4 md:px-6">
            <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex flex-col items-center space-y-4 text-center">
                <div className="p-4 bg-blue-100 rounded-full">
                  <Zap className="h-6 w-6 text-blue-600" />
                </div>
                <h2 className="text-xl font-bold">Rápido y Eficiente</h2>
                <p className="text-gray-500">
                  Carga de comprobantes automatizada y generación de asientos al instante.
                </p>
              </div>
              <div className="flex flex-col items-center space-y-4 text-center">
                <div className="p-4 bg-green-100 rounded-full">
                  <ShieldCheck className="h-6 w-6 text-green-600" />
                </div>
                <h2 className="text-xl font-bold">Seguro y Confiable</h2>
                <p className="text-gray-500">
                  Tus datos están protegidos con los más altos estándares de seguridad.
                </p>
              </div>
              <div className="flex flex-col items-center space-y-4 text-center">
                <div className="p-4 bg-purple-100 rounded-full">
                  <BarChart3 className="h-6 w-6 text-purple-600" />
                </div>
                <h2 className="text-xl font-bold">Reportes en Tiempo Real</h2>
                <p className="text-gray-500">
                  Visualiza el estado financiero de tu empresa con dashboards interactivos.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer className="flex flex-col gap-2 sm:flex-row py-6 w-full shrink-0 items-center px-4 md:px-6 border-t">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          © 2024 ContableAR. Todos los derechos reservados.
        </p>
        <nav className="sm:ml-auto flex gap-4 sm:gap-6">
          <Link className="text-xs hover:underline underline-offset-4" href="#">
            Términos de Servicio
          </Link>
          <Link className="text-xs hover:underline underline-offset-4" href="#">
            Privacidad
          </Link>
        </nav>
      </footer>
    </div>
  );
}
