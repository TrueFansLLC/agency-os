export default function EmployeesPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">Employees</h1>
        <p className="text-gray-400 mt-1 text-sm">Manage team members, roles, and task assignments.</p>
      </div>
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 flex flex-col items-center justify-center text-center">
        <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center mb-4">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </div>
        <p className="text-white font-medium">Employee management coming soon</p>
        <p className="text-gray-500 text-sm mt-1">Add team members, assign tasks, and track productivity.</p>
      </div>
    </div>
  );
}
