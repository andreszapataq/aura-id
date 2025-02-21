import Link from "next/link"

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-100">
      <h1 className="text-4xl font-bold mb-8">Employee Access Control</h1>
      <div className="flex space-x-4">
        <Link href="/register" className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded">
          Register New Employee
        </Link>
        <Link href="/access" className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded">
          Check In/Out
        </Link>
        <Link href="/reports" className="bg-purple-500 hover:bg-purple-600 text-white font-bold py-2 px-4 rounded">
          Generate Reports
        </Link>
      </div>
    </main>
  )
}
