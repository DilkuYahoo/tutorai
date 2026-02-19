import React from "react";

const Analytics: React.FC = () => {
  return (
    <div className="w-full h-screen bg-gradient-to-br from-slate-800 to-slate-900 text-white p-8 overflow-y-auto">
      <h1 className="text-4xl font-bold mb-6">Analytics</h1>
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-slate-700 rounded-lg p-6 border border-slate-600">
          <h2 className="text-xl font-bold mb-4">Traffic Overview</h2>
          <p className="text-gray-300">Analytics data will be displayed here</p>
        </div>
        <div className="bg-slate-700 rounded-lg p-6 border border-slate-600">
          <h2 className="text-xl font-bold mb-4">User Behavior</h2>
          <p className="text-gray-300">
            User behavior metrics will be displayed here
          </p>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
