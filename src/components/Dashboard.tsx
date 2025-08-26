import React from 'react';
import { TrendingUp, Target, Apple, Dumbbell, Heart, Calendar } from 'lucide-react';

const Dashboard: React.FC = () => {
  const stats = [
    {
      label: 'Goals Completed',
      value: '7/10',
      icon: Target,
      color: 'from-emerald-500 to-emerald-600',
      bgColor: 'bg-emerald-50'
    },
    {
      label: 'Avg Blood Glucose',
      value: '128 mg/dL',
      icon: Heart,
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      label: 'Weekly Exercise',
      value: '4/5 sessions',
      icon: Dumbbell,
      color: 'from-purple-500 to-purple-600',
      bgColor: 'bg-purple-50'
    },
    {
      label: 'Nutrition Score',
      value: '85/100',
      icon: Apple,
      color: 'from-orange-500 to-orange-600',
      bgColor: 'bg-orange-50'
    }
  ];

  const recentActivities = [
    { time: '2 hours ago', activity: 'Logged blood glucose: 142 mg/dL', type: 'diabetes' },
    { time: '4 hours ago', activity: 'Completed 30min brisk walk', type: 'exercise' },
    { time: '6 hours ago', activity: 'Ate Greek yogurt with berries', type: 'nutrition' },
    { time: '1 day ago', activity: 'Reached daily water intake goal', type: 'goal' }
  ];

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'diabetes': return 'text-red-600 bg-red-50';
      case 'exercise': return 'text-purple-600 bg-purple-50';
      case 'nutrition': return 'text-green-600 bg-green-50';
      case 'goal': return 'text-blue-600 bg-blue-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Welcome back, Sarah!</h1>
        <p className="text-gray-600 dark:text-gray-300">Here's your health overview for today.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, index) => {
          const IconComponent = stat.icon;
          return (
            <div key={index} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 hover:shadow-md dark:hover:shadow-lg transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">{stat.label}</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-lg ${stat.bgColor} dark:bg-opacity-20`}>
                  <IconComponent className={`h-6 w-6 bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Today's Progress */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <TrendingUp className="h-5 w-5 mr-2 text-emerald-600" />
            Today's Progress
          </h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600 dark:text-gray-400">Water Intake</span>
                <span className="text-gray-900 dark:text-white font-medium">6/8 glasses</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div className="bg-gradient-to-r from-blue-400 to-blue-500 h-2 rounded-full" style={{ width: '75%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600 dark:text-gray-400">Daily Steps</span>
                <span className="text-gray-900 dark:text-white font-medium">8,245/10,000</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div className="bg-gradient-to-r from-emerald-400 to-emerald-500 h-2 rounded-full" style={{ width: '82%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600 dark:text-gray-400">Exercise Time</span>
                <span className="text-gray-900 dark:text-white font-medium">25/30 minutes</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div className="bg-gradient-to-r from-purple-400 to-purple-500 h-2 rounded-full" style={{ width: '83%' }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <Calendar className="h-5 w-5 mr-2 text-blue-600" />
            Recent Activity
          </h3>
          <div className="space-y-4">
            {recentActivities.map((activity, index) => (
              <div key={index} className="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <div className={`p-1.5 rounded-full ${getActivityColor(activity.type)}`}>
                  <div className="w-2 h-2 rounded-full bg-current"></div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 dark:text-white font-medium">{activity.activity}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;