import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetch('/api/dev/users')
      .then(res => {
        if (!res.ok) throw new Error('Not allowed or not in development mode');
        return res.json();
      })
      .then(data => setUsers(data.users))
      .catch(err => setError(err.message));
  }, []);

  const handleDelete = async (email) => {
    if (!window.confirm(`Are you sure you want to delete user ${email}?`)) return;
    setDeleting(email);
    try {
      const res = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error('Failed to delete user');
      setUsers(users.filter(u => u.email !== email));
    } catch (err) {
      alert('Error deleting user: ' + err.message);
    } finally {
      setDeleting(null);
    }
  };

  if (process.env.NODE_ENV === 'production') {
    return <div className="p-8 text-center text-red-500">This page is only available in development mode.</div>;
  }

  return (
    <div className="min-h-screen bg-[#181c2c] text-[#F4E1C1] p-8">
      <button onClick={() => navigate('/')} className="mb-6 px-4 py-2 bg-[#E8D5A4] text-[#181c2c] rounded font-bold">Back</button>
      <h1 className="text-2xl font-bold mb-4">Registered Users</h1>
      {error && <div className="text-red-400 mb-4">{error}</div>}
      <div className="overflow-x-auto">
        <table className="min-w-full bg-[#22263a] rounded-lg">
          <thead>
            <tr>
              <th className="px-4 py-2 text-left">Email</th>
              <th className="px-4 py-2 text-left">Paid</th>
              <th className="px-4 py-2 text-left">Free Chats Used</th>
              <th className="px-4 py-2 text-left">Created At</th>
              <th className="px-4 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} className="border-b border-[#33395a]">
                <td className="px-4 py-2">{user.email}</td>
                <td className="px-4 py-2">{user.has_paid ? 'Yes' : 'No'}</td>
                <td className="px-4 py-2">{user.free_chats_used}</td>
                <td className="px-4 py-2">{new Date(user.created_at * 1000).toLocaleString()}</td>
                <td className="px-4 py-2">
                  <button
                    className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                    disabled={deleting === user.email}
                    onClick={() => handleDelete(user.email)}
                  >
                    {deleting === user.email ? 'Deleting...' : 'Delete'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
} 