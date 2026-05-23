export default function RevenuePage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">Revenue</h1>
        <p className="text-gray-400 mt-1 text-sm">Track income, expenses, and profit across your agency.</p>
      </div>
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 flex flex-col items-center justify-center text-center">
        <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center mb-4">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        </div>
        <p className="text-white font-medium">Revenue tracking coming soon</p>
        <p className="text-gray-500 text-sm mt-1">Log monthly revenue, track expenses, and view profit margins.</p>
      </div>
    </div>
  );
}
