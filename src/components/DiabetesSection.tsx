import React, { useState } from 'react';
import { Heart, TrendingUp, Clock, Plus, AlertTriangle } from 'lucide-react';
import { mockBloodGlucoseReadings } from '../data/mockData';

const DiabetesSection: React.FC = () => {
  const [showAddReading, setShowAddReading] = useState(false);
  const [newReading, setNewReading] = useState({
    value: '',
    mealContext: 'fasting' as const,
    notes: ''
  });

  const handleAddReading = () => {
    // In a real app, this would save to database
    console.log('Adding reading:', newReading);
    setNewReading({ value: '', mealContext: 'fasting', notes: '' });
    setShowAddReading(false);
  };

  const getReadingStatus = (value: number, context: string) => {
    if (context === 'fasting') {
      if (value < 80) return { status: 'low', color: 'text-blue-600 bg-blue-50' };
      if (value <= 100) return { status: 'normal', color: 'text-green-600 bg-green-50' };
      if (value <= 125) return { status: 'elevated', color: 'text-yellow-600 bg-yellow-50' };
      return { status: 'high', color: 'text-red-600 bg-red-50' };
    } else {
      if (value < 80) return { status: 'low', color: 'text-blue-600 bg-blue-50' };
      if (value <= 140) return { status: 'normal', color: 'text-green-600 bg-green-50' };
      if (value <= 180) return { status: 'elevated', color: 'text-yellow-600 bg-yellow-50' };
      return { status: 'high', color: 'text-red-600 bg-red-50' };
    }
  };

  const averageReading = Math.round(
    mockBloodGlucoseReadings.reduce((sum, reading) => sum + reading.value, 0) / 
    mockBloodGlucoseReadings.length
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Diabetes Management</h1>
        <p className="text-gray-600 dark:text-gray-300">Track your blood glucose levels and monitor your diabetes health.</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Average Glucose</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{averageReading} mg/dL</p>
              <p className="text-sm text-green-600 mt-1">Within target range</p>
            </div>
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20">
              <Heart className="h-6 w-6 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Time in Range</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">73%</p>
              <p className="text-sm text-blue-600 mt-1">Good control</p>
            </div>
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
              <TrendingUp className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Last Reading</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">105 mg/dL</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">2 hours ago</p>
            </div>
            <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
              <Clock className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Readings */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Readings</h3>
            <button
              onClick={() => setShowAddReading(true)}
              className="flex items-center space-x-2 px-3 py-1.5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg text-sm font-medium hover:from-red-600 hover:to-red-700 transition-all"
            >
              <Plus className="h-4 w-4" />
              <span>Add Reading</span>
            </button>
          </div>
          
          <div className="space-y-4">
            {mockBloodGlucoseReadings.map((reading) => {
              const { status, color } = getReadingStatus(reading.value, reading.mealContext);
              return (
                <div key={reading.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center space-x-3">
                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${color}`}>
                      {reading.value} mg/dL
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                        {reading.mealContext.replace('-', ' ')}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(reading.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  {status === 'high' || status === 'low' ? (
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        {/* Add Reading Modal */}
        {showAddReading && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Add Blood Glucose Reading</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Blood Glucose (mg/dL)
                  </label>
                  <input
                    type="number"
                    value={newReading.value}
                    onChange={(e) => setNewReading({ ...newReading, value: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    placeholder="Enter reading"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Context
                  </label>
                  <select
                    value={newReading.mealContext}
                    onChange={(e) => setNewReading({ ...newReading, mealContext: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  >
                    <option value="fasting">Fasting</option>
                    <option value="before-meal">Before meal</option>
                    <option value="after-meal">After meal</option>
                    <option value="bedtime">Bedtime</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Notes (optional)
                  </label>
                  <textarea
                    value={newReading.notes}
                    onChange={(e) => setNewReading({ ...newReading, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    rows={2}
                    placeholder="Any additional notes..."
                  />
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowAddReading(false)}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddReading}
                  className="px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg font-medium hover:from-red-600 hover:to-red-700 transition-all"
                >
                  Add Reading
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Health Tips */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Diabetes Management Tips</h3>
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-1">Monitor Regularly</h4>
              <p className="text-sm text-blue-700 dark:text-blue-300">Check your blood glucose at consistent times each day for better pattern recognition.</p>
            </div>
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <h4 className="font-medium text-green-900 mb-1">Exercise After Meals</h4>
              <p className="text-sm text-green-700 dark:text-green-300">Light exercise 30-60 minutes after eating can help lower post-meal glucose spikes.</p>
            </div>
            <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
              <h4 className="font-medium text-orange-900 mb-1">Stay Hydrated</h4>
              <p className="text-sm text-orange-700 dark:text-orange-300">Proper hydration helps your kidneys flush out excess glucose through urine.</p>
            </div>
            <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <h4 className="font-medium text-purple-900 mb-1">Manage Stress</h4>
              <p className="text-sm text-purple-700 dark:text-purple-300">Chronic stress can raise blood sugar levels. Practice relaxation techniques daily.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DiabetesSection;