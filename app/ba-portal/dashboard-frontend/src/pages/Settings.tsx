import React from "react";

const Settings: React.FC = () => {
  return (
    <div className="w-full h-screen bg-gradient-to-br from-slate-800 to-slate-900 text-white p-8 overflow-y-auto">
      <h1 className="text-4xl font-bold mb-6">Settings</h1>

      <div className="grid grid-cols-1 gap-6 max-w-2xl">
        {/* Account Settings */}
        <div className="bg-slate-700 rounded-lg p-6 border border-slate-600">
          <h2 className="text-xl font-bold mb-4">Account Settings</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-2">
                Display Name
              </label>
              <input
                type="text"
                className="w-full bg-slate-600 border border-slate-500 rounded px-3 py-2 text-white"
                placeholder="Your name"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">Email</label>
              <input
                type="email"
                className="w-full bg-slate-600 border border-slate-500 rounded px-3 py-2 text-white"
                placeholder="your@email.com"
              />
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-slate-700 rounded-lg p-6 border border-slate-600">
          <h2 className="text-xl font-bold mb-4">Notifications</h2>
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" defaultChecked className="w-4 h-4" />
              <span>Email Notifications</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" defaultChecked className="w-4 h-4" />
              <span>Push Notifications</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" className="w-4 h-4" />
              <span>Weekly Digest</span>
            </label>
          </div>
        </div>

        {/* Theme */}
        <div className="bg-slate-700 rounded-lg p-6 border border-slate-600">
          <h2 className="text-xl font-bold mb-4">Appearance</h2>
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="theme"
                defaultChecked
                className="w-4 h-4"
              />
              <span>Dark Mode</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="radio" name="theme" className="w-4 h-4" />
              <span>Light Mode</span>
            </label>
          </div>
        </div>

        <button className="bg-cyan-500 hover:bg-cyan-600 text-white font-semibold py-2 px-6 rounded-lg transition-colors mt-4">
          Save Changes
        </button>
      </div>
    </div>
  );
};

export default Settings;
