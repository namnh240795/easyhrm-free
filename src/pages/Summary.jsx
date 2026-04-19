import { useState, useEffect } from 'react';
import { useFaceDB } from '../hooks/useFaceDB';

function Summary() {
  const { faceDB, isInitialized } = useFaceDB();

  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [filteredRecords, setFilteredRecords] = useState([]);
  const [activeUsers, setActiveUsers] = useState([]);
  const [dateFilter, setDateFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [uniqueUsers, setUniqueUsers] = useState([]);

  useEffect(() => {
    async function loadData() {
      if (!isInitialized) return;
      try {
        const records = await faceDB.getAllAttendance();
        setAttendanceRecords(records);
        setFilteredRecords(records);

        // Load active sessions
        const sessions = await faceDB.getActiveSessions();
        setActiveUsers(sessions);

        // Extract unique users
        const users = [...new Set(records.map(r => r.faceId))];
        setUniqueUsers(users);
      } catch (error) {
        console.error('Failed to load data:', error);
      }
    }
    loadData();
  }, [isInitialized, faceDB]);

  useEffect(() => {
    let filtered = [...attendanceRecords];

    // Filter by date
    if (dateFilter !== 'all') {
      const today = new Date().toISOString().split('T')[0];
      filtered = filtered.filter(r => r.date === today);
    }

    // Filter by user
    if (userFilter !== 'all') {
      filtered = filtered.filter(r => r.faceId === userFilter);
    }

    setFilteredRecords(filtered);
  }, [dateFilter, userFilter, attendanceRecords]);

  function formatDuration(minutes) {
    if (!minutes) return '-';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }

  function groupByUserAndDate(records) {
    const grouped = {};

    records.forEach(record => {
      const key = `${record.faceId}_${record.date}`;
      if (!grouped[key]) {
        grouped[key] = {
          faceId: record.faceId,
          name: record.name,
          date: record.date,
          checkIns: [],
          checkOuts: [],
          totalMinutes: 0
        };
      }

      if (record.type === 'check-in') {
        grouped[key].checkIns.push(new Date(record.timestamp));
      } else if (record.type === 'check-out') {
        grouped[key].checkOuts.push(new Date(record.timestamp));
        if (record.duration) {
          grouped[key].totalMinutes += record.duration;
        }
      }
    });

    return Object.values(grouped).sort((a, b) => {
      const dateCompare = b.date.localeCompare(a.date);
      if (dateCompare !== 0) return dateCompare;
      return a.name.localeCompare(b.name);
    });
  }

  const groupedData = groupByUserAndDate(filteredRecords);

  async function handleExport() {
    const csv = [
      ['Date', 'Name', 'Check In', 'Check Out', 'Duration (minutes)'].join(','),
      ...groupedData.map(row => [
        row.date,
        row.name,
        row.checkIns.map(t => t.toLocaleTimeString()).join('; '),
        row.checkOuts.map(t => t.toLocaleTimeString()).join('; '),
        row.totalMinutes
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-summary-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Attendance Summary</h2>
        <p className="text-gray-600">Daily working hours and attendance records</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label htmlFor="date-filter" className="block text-sm font-medium text-gray-700 mb-2">
              Date Filter
            </label>
            <select
              id="date-filter"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Dates</option>
              <option value="today">Today Only</option>
            </select>
          </div>

          <div>
            <label htmlFor="user-filter" className="block text-sm font-medium text-gray-700 mb-2">
              User Filter
            </label>
            <select
              id="user-filter"
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Users</option>
              {Array.from(new Set(attendanceRecords.map(r => r.name))).map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={handleExport}
              disabled={groupedData.length === 0}
              className="w-full py-2 px-4 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Export CSV
            </button>
          </div>

          <div className="flex items-end justify-end">
            <div className="text-right">
              <div className="text-sm text-gray-600">Total Records</div>
              <div className="text-2xl font-bold text-blue-600">{filteredRecords.length}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Currently Active */}
      {activeUsers.length > 0 && (
        <div className="bg-green-50 rounded-2xl p-6 border border-green-200">
          <h3 className="text-lg font-bold text-green-900 mb-3">Currently Checked In ({activeUsers.length})</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeUsers.map(user => (
              <div key={user.faceId} className="flex items-center gap-3 bg-white p-3 rounded-lg">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <div>
                  <div className="font-semibold text-green-900">{user.name}</div>
                  <div className="text-xs text-green-700">
                    Since {new Date(user.checkInTime).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary Table */}
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Check In
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Check Out
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sessions
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Time
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {groupedData.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                    No attendance records found
                  </td>
                </tr>
              ) : (
                groupedData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(row.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {row.name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {row.checkIns.length > 0 ? (
                        <div className="space-y-1">
                          {row.checkIns.map((time, i) => (
                            <div key={i} className="text-green-600">
                              {time.toLocaleTimeString()}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {row.checkOuts.length > 0 ? (
                        <div className="space-y-1">
                          {row.checkOuts.map((time, i) => (
                            <div key={i} className="text-red-600">
                              {time.toLocaleTimeString()}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {row.checkIns.length}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                      {formatDuration(row.totalMinutes)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stats Summary */}
      {groupedData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="text-sm text-gray-600 mb-1">Total Users</div>
            <div className="text-3xl font-bold text-blue-600">
              {new Set(groupedData.map(d => d.faceId)).size}
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="text-sm text-gray-600 mb-1">Total Sessions</div>
            <div className="text-3xl font-bold text-green-600">
              {groupedData.reduce((sum, d) => sum + d.checkIns.length, 0)}
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="text-sm text-gray-600 mb-1">Total Hours</div>
            <div className="text-3xl font-bold text-purple-600">
              {(groupedData.reduce((sum, d) => sum + d.totalMinutes, 0) / 60).toFixed(1)}h
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Summary;
