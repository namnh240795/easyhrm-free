import { useState, useEffect } from 'react';
import { useFaceDB } from '../hooks/useFaceDB';

const DAYS_OF_WEEK = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' }
];

function Workstation() {
  const { faceDB, isInitialized } = useFaceDB();

  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [schedule, setSchedule] = useState(() =>
    DAYS_OF_WEEK.reduce((acc, day) => ({
      ...acc,
      [day.key]: { enabled: day.key !== 'saturday' && day.key !== 'sunday', startTime: '09:00', endTime: '17:00' }
    }), {})
  );
  const [saved, setSaved] = useState(false);
  const [existingConfig, setExistingConfig] = useState(null);

  useEffect(() => {
    async function loadConfig() {
      if (!isInitialized) return;
      try {
        const config = await faceDB.getWorkstation();
        if (config) {
          setName(config.name || '');
          setLocation(config.location || '');
          setSchedule(config.schedule || schedule);
          setExistingConfig(config);
        }
      } catch (error) {
        console.error('Failed to load workstation config:', error);
      }
    }
    loadConfig();
  }, [isInitialized, faceDB]);

  function handleScheduleChange(day, field, value) {
    setSchedule(prev => ({
      ...prev,
      [day]: { ...prev[day], [field]: value }
    }));
  }

  function applyToAll(sourceDay) {
    const sourceSchedule = schedule[sourceDay];
    setSchedule(
      DAYS_OF_WEEK.reduce((acc, day) => ({
        ...acc,
        [day.key]: { ...sourceSchedule }
      }), {})
    );
  }

  function applyToWeekdays(sourceDay) {
    const sourceSchedule = schedule[sourceDay];
    const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    setSchedule(prev =>
      weekdays.reduce((acc, day) => ({
        ...acc,
        [day]: { ...sourceSchedule }
      }), prev)
    );
  }

  async function handleSave(e) {
    e.preventDefault();

    if (!name.trim()) {
      alert('Please enter a workstation name');
      return;
    }

    try {
      await faceDB.saveWorkstation({
        name: name.trim(),
        location: location.trim(),
        schedule
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      alert(`Failed to save workstation: ${error.message}`);
    }
  }

  async function handleClear() {
    if (!confirm('Are you sure you want to clear the workstation configuration?')) return;

    try {
      await faceDB.deleteWorkstation();
      setName('');
      setLocation('');
      setSchedule(() =>
        DAYS_OF_WEEK.reduce((acc, day) => ({
          ...acc,
          [day.key]: { enabled: day.key !== 'saturday' && day.key !== 'sunday', startTime: '09:00', endTime: '17:00' }
        }), {})
      );
      setExistingConfig(null);
    } catch (error) {
      alert(`Failed to clear workstation: ${error.message}`);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Workstation Configuration</h2>
        <p className="text-gray-600">Set up your workstation and working hours schedule</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Workstation Info */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Workstation Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="ws-name" className="block text-sm font-medium text-gray-700 mb-2">
                Workstation Name *
              </label>
              <input
                type="text"
                id="ws-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Front Desk, Office A"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label htmlFor="ws-location" className="block text-sm font-medium text-gray-700 mb-2">
                Location
              </label>
              <input
                type="text"
                id="ws-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g., 1st Floor, Building A"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Working Hours Schedule */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-gray-900">Working Hours Schedule</h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => applyToAll('monday')}
                className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Apply Monday to All
              </button>
              <button
                type="button"
                onClick={() => applyToWeekdays('monday')}
                className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600"
              >
                Apply to Weekdays
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {DAYS_OF_WEEK.map((day) => (
              <div key={day.key} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3 flex-1">
                  <input
                    type="checkbox"
                    id={`${day.key}-enabled`}
                    checked={schedule[day.key].enabled}
                    onChange={(e) => handleScheduleChange(day.key, 'enabled', e.target.checked)}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <label htmlFor={`${day.key}-enabled`} className="font-semibold text-gray-900 min-w-[100px]">
                    {day.label}
                  </label>
                </div>

                {schedule[day.key].enabled && (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="time"
                      value={schedule[day.key].startTime}
                      onChange={(e) => handleScheduleChange(day.key, 'startTime', e.target.value)}
                      className="px-3 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-gray-500">to</span>
                    <input
                      type="time"
                      value={schedule[day.key].endTime}
                      onChange={(e) => handleScheduleChange(day.key, 'endTime', e.target.value)}
                      className="px-3 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}

                <div className="text-sm text-gray-600 w-24 text-right">
                  {schedule[day.key].enabled
                    ? `${schedule[day.key].startTime} - ${schedule[day.key].endTime}`
                    : 'Day off'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="submit"
            className="flex-1 py-3 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 transition-colors"
          >
            Save Configuration
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="px-6 py-3 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition-colors"
          >
            Clear
          </button>
        </div>

        {saved && (
          <div className="p-4 bg-green-50 rounded-lg border border-green-200 text-center">
            <p className="text-green-800 font-semibold">✓ Configuration saved successfully!</p>
          </div>
        )}
      </form>

      {/* Info */}
      <div className="bg-blue-50 rounded-2xl p-6 border border-blue-200">
        <h3 className="text-lg font-bold text-blue-900 mb-2">ℹ️ Workstation Configuration</h3>
        <ul className="space-y-2 text-blue-800">
          <li>• Set up your workstation name and location for better tracking</li>
          <li>• Configure working hours for each day of the week</li>
          <li>• Attendance will only be recorded within configured working hours</li>
          <li>• Use Test Mode on the Attendance page to bypass time restrictions</li>
        </ul>
      </div>
    </div>
  );
}

export default Workstation;
