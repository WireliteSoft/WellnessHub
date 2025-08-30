import React, { useEffect, useState } from 'react';
import { Dumbbell, Clock, Zap, Heart, Play, Plus, Edit, Trash2, Save, X } from 'lucide-react';
import { Exercise } from '../types';
import WorkoutTimer from './WorkoutTimer';

const ExerciseSection: React.FC = () => {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [selectedType, setSelectedType] = useState<'all' | 'cardio' | 'strength' | 'flexibility' | 'balance'>('all');
  const [showCreateWorkout, setShowCreateWorkout] = useState(false);
  const [editingExercise, setEditingExercise] = useState<string | null>(null);
  const [activeWorkout, setActiveWorkout] = useState<Exercise | null>(null);
  const [completedWorkouts, setCompletedWorkouts] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [newExercise, setNewExercise] = useState({
    name: '',
    type: 'cardio' as const,
    duration: 30,
    intensity: 'moderate' as const,
    diabeticSafe: true,
    bestTime: 'anytime' as const,
    description: ''
  });

  function authHeaders() {
    const t = typeof window !== 'undefined' ? localStorage.getItem('auth:token') : null;
    return t ? { Authorization: `Bearer ${t}` } : {};
  }

  // Map D1 workout row -> your Exercise UI shape
  function mapServerWorkout(row: any): Exercise {
    return {
      id: row.id,
      name: row.name ?? 'Untitled',
      type: (row.type as Exercise['type']) || 'cardio',
      duration: Number(row.duration_min ?? 0),
      intensity: (row.intensity as Exercise['intensity']) || 'moderate',
      description: row.notes ?? '',
      // not stored server-side yet; default for UI
      diabeticSafe: true,
      bestTime: 'anytime'
    };
  }

  // Initial load from API
  useEffect(() => {
    (async () => {
      try {
        setLoadError(null);
        const res = await fetch('/api/workouts', { headers: { ...authHeaders() } });
        if (!res.ok) throw new Error(`GET /api/workouts ${res.status}`);
        const rows = await res.json();
        const mapped = Array.isArray(rows) ? rows.map(mapServerWorkout) : [];
        setExercises(mapped);
      } catch (e: any) {
        console.error(e);
        setLoadError('Failed to load workouts.');
        setExercises([]); // fail closed
      }
    })();
  }, []);

  const types = [
    { id: 'all', label: 'All Types', icon: Dumbbell },
    { id: 'cardio', label: 'Cardio', icon: Heart },
    { id: 'strength', label: 'Strength', icon: Dumbbell },
    { id: 'flexibility', label: 'Flexibility', icon: Zap },
    { id: 'balance', label: 'Balance', icon: Clock }
  ];

  const filteredExercises = selectedType === 'all'
    ? exercises
    : exercises.filter(exercise => exercise.type === selectedType);

  // Create -> POST /api/workouts then update local list
  const handleCreateExercise = async () => {
    try {
      setCreating(true);
      const res = await fetch('/api/workouts', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          name: newExercise.name,
          type: newExercise.type,
          duration_min: newExercise.duration,
          intensity: newExercise.intensity,
          // stash UI-only bits inside notes for now (optional)
          notes: newExercise.description
        })
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => '');
        throw new Error(msg || `POST /api/workouts ${res.status}`);
      }
      const { id } = await res.json();

      const created: Exercise = {
        id,
        ...newExercise
      };
      setExercises([created, ...exercises]);

      setNewExercise({
        name: '',
        type: 'cardio',
        duration: 30,
        intensity: 'moderate',
        diabeticSafe: true,
        bestTime: 'anytime',
        description: ''
      });
      setShowCreateWorkout(false);
    } catch (e) {
      console.error(e);
      alert('Failed to create workout.');
    } finally {
      setCreating(false);
    }
  };

  // Local-only until you add PUT /api/workouts/:id
  const handleUpdateExercise = (id: string, updatedExercise: Partial<Exercise>) => {
    setExercises(exercises.map(exercise =>
      exercise.id === id ? { ...exercise, ...updatedExercise } : exercise
    ));
    setEditingExercise(null);
  };

  // Local-only until you add DELETE /api/workouts/:id
  const handleDeleteExercise = (id: string) => {
    setExercises(exercises.filter(exercise => exercise.id !== id));
  };

  const handleStartWorkout = (exercise: Exercise) => setActiveWorkout(exercise);
  const handleCompleteWorkout = () => { if (activeWorkout) setCompletedWorkouts([...completedWorkouts, activeWorkout.id]); };
  const handleCloseWorkout = () => setActiveWorkout(null);

  const getIntensityColor = (intensity: string) => {
    switch (intensity) {
      case 'low': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'moderate': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'high': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const getBestTimeColor = (time: string) => {
    switch (time) {
      case 'morning': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      case 'afternoon': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400';
      case 'evening': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const EditableExerciseCard = ({ exercise }: { exercise: Exercise }) => {
    const [editData, setEditData] = useState(exercise);

    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Exercise Name</label>
              <input
                type="text"
                value={editData.name}
                onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
                <select
                  value={editData.type}
                  onChange={(e) => setEditData({ ...editData, type: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                >
                  <option value="cardio">Cardio</option>
                  <option value="strength">Strength</option>
                  <option value="flexibility">Flexibility</option>
                  <option value="balance">Balance</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Duration (min)</label>
                <input
                  type="number"
                  value={editData.duration}
                  onChange={(e) => setEditData({ ...editData, duration: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Intensity</label>
                <select
                  value={editData.intensity}
                  onChange={(e) => setEditData({ ...editData, intensity: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                >
                  <option value="low">Low</option>
                  <option value="moderate">Moderate</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Best Time</label>
                <select
                  value={editData.bestTime}
                  onChange={(e) => setEditData({ ...editData, bestTime: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                >
                  <option value="morning">Morning</option>
                  <option value="afternoon">Afternoon</option>
                  <option value="evening">Evening</option>
                  <option value="anytime">Anytime</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
              <textarea
                value={editData.description}
                onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                rows={2}
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id={`diabetic-safe-${exercise.id}`}
                checked={editData.diabeticSafe}
                onChange={(e) => setEditData({ ...editData, diabeticSafe: e.target.checked })}
                className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
              />
              <label htmlFor={`diabetic-safe-${exercise.id}`} className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                Diabetes Safe
              </label>
            </div>
          </div>

          <div className="flex justify-end space-x-2 mt-4">
            <button
              onClick={() => setEditingExercise(null)}
              className="px-3 py-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-medium"
            >
              <X className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleUpdateExercise(exercise.id, editData)}
              className="px-3 py-1.5 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg font-medium hover:from-purple-600 hover:to-purple-700 transition-all"
            >
              <Save className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">My Workouts</h1>
            <p className="text-gray-600 dark:text-gray-300">Create and manage your personalized exercise routines.</p>
            {loadError && <p className="text-sm text-red-600 dark:text-red-400 mt-2">{loadError}</p>}
          </div>
          <button
            onClick={() => setShowCreateWorkout(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg font-medium hover:from-purple-600 hover:to-purple-700 transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>Create Workout</span>
          </button>
        </div>
      </div>

      {exercises.length === 0 ? (
        <div className="text-center py-12">
          <Dumbbell className="h-16 w-16 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No workouts yet</h3>
          <p className="text-gray-600 dark:text-gray-300 mb-6">Create your first custom workout to get started with your fitness journey.</p>
          <button
            onClick={() => setShowCreateWorkout(true)}
            className="inline-flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg font-medium hover:from-purple-600 hover:to-purple-700 transition-all"
          >
            <Plus className="h-5 w-5" />
            <span>Create Your First Workout</span>
          </button>
        </div>
      ) : (
        <>
          {/* Type Filters */}
          <div className="flex flex-wrap gap-2 mb-8">
            {types.map((type) => {
              const IconComponent = type.icon;
              return (
                <button
                  key={type.id}
                  onClick={() => setSelectedType(type.id as any)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                    selectedType === type.id
                      ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-md'
                      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600'
                  }`}
                >
                  <IconComponent className="h-4 w-4" />
                  <span>{type.label}</span>
                </button>
              );
            })}
          </div>

          {/* Exercise Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {filteredExercises.map((exercise) => (
              editingExercise === exercise.id ? (
                <EditableExerciseCard key={exercise.id} exercise={exercise} />
              ) : (
                <div key={exercise.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden hover:shadow-md dark:hover:shadow-lg transition-all duration-200">
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{exercise.name}</h3>
                      <div className="flex items-center space-x-1">
                        {exercise.diabeticSafe && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400">
                            Diabetes Safe
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="text-gray-600 dark:text-gray-300 text-sm mb-4">{exercise.description}</p>

                    <div className="flex justify-between items-center mb-4">
                      <div className="text-center">
                        <p className="text-xl font-bold text-gray-900 dark:text-white">{exercise.duration}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">minutes</p>
                      </div>
                      <div className="flex flex-col space-y-1">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getIntensityColor(exercise.intensity)}`}>
                          {exercise.intensity}
                        </span>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getBestTimeColor(exercise.bestTime)}`}>
                          {exercise.bestTime}
                        </span>
                      </div>
                    </div>

                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleStartWorkout(exercise)}
                        className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all duration-200 flex items-center justify-center space-x-2 ${
                          completedWorkouts.includes(exercise.id)
                            ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700'
                            : 'bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:from-purple-600 hover:to-purple-700'
                        }`}
                      >
                        <Play className="h-4 w-4" />
                        <span>{completedWorkouts.includes(exercise.id) ? 'Completed' : 'Start'}</span>
                      </button>
                      <button
                        onClick={() => setEditingExercise(exercise.id)}
                        className="p-2 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-all"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteExercise(exercise.id)}
                        className="p-2 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            ))}
          </div>
        </>
      )}

      {/* Workout Timer Modal */}
      {activeWorkout && (
        <WorkoutTimer
          exercise={activeWorkout}
          onComplete={handleCompleteWorkout}
          onClose={handleCloseWorkout}
        />
      )}

      {/* Create Workout Modal */}
      {showCreateWorkout && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Create New Workout</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Exercise Name</label>
                <input
                  type="text"
                  value={newExercise.name}
                  onChange={(e) => setNewExercise({ ...newExercise, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  placeholder="Enter exercise name"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
                  <select
                    value={newExercise.type}
                    onChange={(e) => setNewExercise({ ...newExercise, type: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  >
                    <option value="cardio">Cardio</option>
                    <option value="strength">Strength</option>
                    <option value="flexibility">Flexibility</option>
                    <option value="balance">Balance</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Duration (min)</label>
                  <input
                    type="number"
                    value={newExercise.duration || ''}
                    onChange={(e) => setNewExercise({ ...newExercise, duration: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    placeholder="30"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Intensity</label>
                  <select
                    value={newExercise.intensity}
                    onChange={(e) => setNewExercise({ ...newExercise, intensity: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  >
                    <option value="low">Low</option>
                    <option value="moderate">Moderate</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Best Time</label>
                  <select
                    value={newExercise.bestTime}
                    onChange={(e) => setNewExercise({ ...newExercise, bestTime: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  >
                    <option value="morning">Morning</option>
                    <option value="afternoon">Afternoon</option>
                    <option value="evening">Evening</option>
                    <option value="anytime">Anytime</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <textarea
                  value={newExercise.description}
                  onChange={(e) => setNewExercise({ ...newExercise, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  rows={3}
                  placeholder="Describe the exercise and its benefits..."
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="diabetic-safe"
                  checked={newExercise.diabeticSafe}
                  onChange={(e) => setNewExercise({ ...newExercise, diabeticSafe: e.target.checked })}
                  className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                />
                <label htmlFor="diabetic-safe" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                  Safe for people with diabetes
                </label>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowCreateWorkout(false)}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateExercise}
                disabled={creating || !newExercise.name.trim()}
                className="px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg font-medium hover:from-purple-600 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? 'Saving…' : 'Create Workout'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exercise Schedule */}
      {exercises.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">This Week's Exercise Schedule</h3>
          <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => (
              <div key={day} className="text-center p-4 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <p className="font-semibold text-gray-900 dark:text-white mb-2">{day}</p>
                {index < 5 ? (
                  <div className="space-y-2">
                    <div className="h-2 bg-purple-200 dark:bg-purple-800 rounded-full">
                      <div className="h-2 bg-gradient-to-r from-purple-400 to-purple-500 rounded-full" style={{ width: '100%' }}></div>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Planned</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                    <p className="text-xs text-gray-400 dark:text-gray-500">Rest day</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ExerciseSection;
