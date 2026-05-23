export default function CreatorsPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">Creators</h1>
        <p className="text-gray-400 mt-1 text-sm">Manage your creator and model roster, accounts, and performance.</p>
      </div>
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 flex flex-col items-center justify-center text-center">
        <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center mb-4">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
          </svg>
        </div>
        <p className="text-white font-medium">Creator management coming soon</p>
        <p className="text-gray-500 text-sm mt-1">Add creators, track their accounts, content, and revenue performance.</p>
      </div>
    </div>
  );
}
