function Attendance() {
  return (
    <div className="max-w-7xl mx-auto">
      <h2 className="text-3xl font-bold text-gray-900 mb-6">Attendance Tracking</h2>
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <p className="text-gray-600">Motion-based attendance tracking - Coming soon</p>
        <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
          <p className="text-sm text-green-800">
            This page will provide automatic check-in/check-out using motion detection.
            Walk from left to right to check in, right to left to check out.
          </p>
        </div>
      </div>
    </div>
  );
}

export default Attendance;
