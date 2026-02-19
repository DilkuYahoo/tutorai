import React from "react";

const Users: React.FC = () => {
  const usersList = [
    {
      id: 1,
      name: "John Doe",
      email: "john@example.com",
      role: "Admin",
      joined: "2024-01-15",
    },
    {
      id: 2,
      name: "Jane Smith",
      email: "jane@example.com",
      role: "User",
      joined: "2024-02-20",
    },
    {
      id: 3,
      name: "Bob Johnson",
      email: "bob@example.com",
      role: "User",
      joined: "2024-03-10",
    },
    {
      id: 4,
      name: "Alice Brown",
      email: "alice@example.com",
      role: "Moderator",
      joined: "2024-01-25",
    },
  ];

  return (
    <div className="w-full h-screen bg-gradient-to-br from-slate-800 to-slate-900 text-white p-8 overflow-y-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Users Management</h1>
        <p className="text-gray-400">Manage and view all users in the system</p>
      </div>

      <div className="bg-slate-700 rounded-lg border border-slate-600 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-800 border-b border-slate-600">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold">
                Name
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold">
                Email
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold">
                Role
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold">
                Joined
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {usersList.map((user) => (
              <tr
                key={user.id}
                className="border-b border-slate-600 hover:bg-slate-600 transition-colors"
              >
                <td className="px-6 py-4 text-sm">{user.name}</td>
                <td className="px-6 py-4 text-sm text-gray-300">
                  {user.email}
                </td>
                <td className="px-6 py-4 text-sm">
                  <span className="inline-block px-3 py-1 bg-cyan-500 rounded-full text-xs font-semibold">
                    {user.role}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-300">
                  {user.joined}
                </td>
                <td className="px-6 py-4 text-sm">
                  <button className="text-cyan-400 hover:text-cyan-300 font-semibold">
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Users;
