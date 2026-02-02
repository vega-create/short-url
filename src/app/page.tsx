import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="text-6xl mb-4">🔗</div>
        <h1 className="text-3xl font-bold text-gray-800 mb-2">短網址管理系統</h1>
        <p className="text-gray-500 mb-8">智慧媽咪短網址服務</p>
        <Link
          href="/admin"
          className="inline-block bg-red-600 text-white px-8 py-3 rounded-xl hover:bg-red-700 transition font-medium"
        >
          進入管理後台
        </Link>
      </div>
    </div>
  )
}
