import React from "react";

const Reports: React.FC = () => {
  const reports = [
    {
      id: 1,
      name: "Monthly Revenue Report",
      date: "2024-01-15",
      status: "Completed",
    },
    {
      id: 2,
      name: "User Engagement Analysis",
      date: "2024-01-10",
      status: "Completed",
    },
    {
      id: 3,
      name: "Performance Metrics",
      date: "2024-01-20",
      status: "In Progress",
    },
    { id: 4, name: "Quarterly Summary", date: "2024-02-01", status: "Pending" },
  ];

  return (
    <div className="w-full h-screen bg-gradient-to-br from-slate-800 to-slate-900 text-white p-8 overflow-y-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Reports</h1>
        <p className="text-gray-400">View and manage all system reports</p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {reports.map((report) => (
          <div
            key={report.id}
            className="bg-slate-700 rounded-lg p-6 border border-slate-600 hover:border-cyan-500 transition-all"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">{report.name}</h3>
                <p className="text-sm text-gray-400">{report.date}</p>
              </div>
              <div className="flex items-center gap-4">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    report.status === "Completed"
                      ? "bg-green-500"
                      : report.status === "In Progress"
                      ? "bg-yellow-500"
                      : "bg-gray-500"
                  }`}
                >
                  {report.status}
                </span>
                <button className="text-cyan-400 hover:text-cyan-300 font-semibold">
                  Download
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Reports;
