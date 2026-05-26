export default function Unauthorized() {
  return (
    <div className="flex-1 flex items-center justify-center bg-gray-900 text-white">
      <div className="text-center">
        <div className="text-5xl mb-4">🔒</div>
        <h1 className="text-xl font-semibold mb-2">Kein Zugriff</h1>
        <p className="text-gray-400 text-sm">Du hast keine Berechtigung für diese Seite.</p>
      </div>
    </div>
  )
}
