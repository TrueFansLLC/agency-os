const stats = [
  { label: "Monthly Revenue", value: "$0", change: "--" },
  { label: "Active Creators", value: "0", change: "--" },
  { label: "Content Pieces", value: "0", change: "--" },
  { label: "Open Tasks", value: "0", change: "--" },
];

export default function DashboardPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
        <p className="text-gray-400 mt-1 text-sm">Good morning. Here&apos;s your agency overview.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-gray-400 text-xs uppercase tracking-wider">{stat.label}</p>
            <p className="text-white text-2xl font-semibold mt-2">{stat.value}</p>
            <p className="text-gray-500 text-xs mt-1">{stat.change}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-white font-medium mb-4">Recent Activity</h2>
          <p className="text-gray-500 text-sm">No activity yet. Start by adding creators or tasks.</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-white font-medium mb-4">Quick Actions</h2>
          <div className="space-y-2">
            {["Add a creator", "Log revenue", "Upload content", "Assign a task"].map((action) => (
              <button
                key={action}
                className="w-full text-left text-sm text-gray-400 hover:text-white px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors"
              >
                + {action}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
