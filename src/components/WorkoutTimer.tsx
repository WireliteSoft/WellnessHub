import React, { useState, useEffect } from 'react';
import { Play, Pause, Square, RotateCcw } from 'lucide-react';
import { Exercise } from '../types';

interface WorkoutTimerProps {
  exercise: Exercise;
  onComplete: () => void;
  onClose: () => void;
}

const WorkoutTimer: React.FC<WorkoutTimerProps> = ({ exercise, onComplete, onClose }) => {
  const [timeLeft, setTimeLeft] = useState(exercise.duration * 60); // Convert minutes to seconds
  const [isRunning, setIsRunning] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((time) => {
          if (time <= 1) {
            setIsRunning(false);
            setIsCompleted(true);
            return 0;
          }
          return time - 1;
        });
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [isRunning, timeLeft]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStart = () => setIsRunning(true);
  const handlePause = () => setIsRunning(false);
  const handleReset = () => {
    setTimeLeft(exercise.duration * 60);
    setIsRunning(false);
    setIsCompleted(false);
  };

  const handleComplete = () => {
    onComplete();
    onClose();
  };

  const progressPercentage = ((exercise.duration * 60 - timeLeft) / (exercise.duration * 60)) * 100;

  const getIntensityColor = (intensity: string) => {
    switch (intensity) {
      case 'low': return 'from-green-400 to-green-500';
      case 'moderate': return 'from-yellow-400 to-yellow-500';
      case 'high': return 'from-red-400 to-red-500';
      default: return 'from-gray-400 to-gray-500';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-8">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{exercise.name}</h2>
          <p className="text-gray-600 dark:text-gray-300 text-sm">{exercise.description}</p>
        </div>

        {/* Timer Display */}
        <div className="text-center mb-8">
          <div className="relative w-48 h-48 mx-auto mb-4">
            <svg className="w-48 h-48 transform -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="45"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                className="text-gray-200 dark:text-gray-700"
              />
              <circle
                cx="50"
                cy="50"
                r="45"
                stroke="currentColor"
                strokeWidth="3"
                fill="none"
                strokeDasharray={`${2 * Math.PI * 45}`}
                strokeDashoffset={`${2 * Math.PI * 45 * (1 - progressPercentage / 100)}`}
                className={`bg-gradient-to-r ${getIntensityColor(exercise.intensity)} bg-clip-text text-transparent transition-all duration-1000 ease-linear`}
                style={{
                  background: `linear-gradient(45deg, ${exercise.intensity === 'low' ? '#10B981, #059669' : exercise.intensity === 'moderate' ? '#F59E0B, #D97706' : '#EF4444, #DC2626'})`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent'
                }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-4xl font-bold text-gray-900 dark:text-white">
                  {formatTime(timeLeft)}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {isCompleted ? 'Completed!' : isRunning ? 'Running' : 'Paused'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Exercise Info */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="text-lg font-semibold text-gray-900 dark:text-white">{exercise.duration} min</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Duration</div>
          </div>
          <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="text-lg font-semibold text-gray-900 dark:text-white capitalize">{exercise.intensity}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Intensity</div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex justify-center space-x-4 mb-6">
          {!isCompleted ? (
            <>
              {!isRunning ? (
                <button
                  onClick={handleStart}
                  className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg font-medium hover:from-green-600 hover:to-green-700 transition-all"
                >
                  <Play className="h-5 w-5" />
                  <span>Start</span>
                </button>
              ) : (
                <button
                  onClick={handlePause}
                  className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-yellow-500 to-yellow-600 text-white rounded-lg font-medium hover:from-yellow-600 hover:to-yellow-700 transition-all"
                >
                  <Pause className="h-5 w-5" />
                  <span>Pause</span>
                </button>
              )}
              <button
                onClick={handleReset}
                className="flex items-center space-x-2 px-4 py-3 bg-gray-500 text-white rounded-lg font-medium hover:bg-gray-600 transition-all"
              >
                <RotateCcw className="h-5 w-5" />
                <span>Reset</span>
              </button>
            </>
          ) : (
            <button
              onClick={handleComplete}
              className="flex items-center space-x-2 px-8 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-lg font-medium hover:from-emerald-600 hover:to-emerald-700 transition-all"
            >
              <span>Mark as Complete</span>
            </button>
          )}
        </div>

        {/* Close Button */}
        <div className="flex justify-center">
          <button
            onClick={onClose}
            className="px-6 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default WorkoutTimer;