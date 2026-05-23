export default function AIToolsPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">AI Tools</h1>
        <p className="text-gray-400 mt-1 text-sm">AI employees and assistants with specialized skills and tools.</p>
      </div>
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 flex flex-col items-center justify-center text-center">
        <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center mb-4">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" /><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
          </svg>
        </div>
        <p className="text-white font-medium">AI tools coming soon</p>
        <p className="text-gray-500 text-sm mt-1">Deploy AI assistants for caption writing, content planning, analytics, and more.</p>
      </div>
    </div>
  );
}
