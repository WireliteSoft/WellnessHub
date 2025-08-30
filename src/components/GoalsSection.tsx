import React, { useEffect, useMemo, useState } from 'react';
import { Target, Plus, Check, Calendar, TrendingUp } from 'lucide-react';
import { Goal } from '../types';

// ---- helpers ----
function authHeaders() {
  const t = typeof window !== 'undefined' ? localStorage.getItem('auth:token') : null;
  return t ? { Authorization: `Bearer ${t}` } : {};
}

type ServerGoal = {
  id: string;
  title: string;
  target_value: number;
  unit: string;
  current_value: number;
  due_date?: string | null;
  status: 'active' | 'completed' | 'archived';
  created_at?: string;
  updated_at?: string;
};

// Local metadata (because DB schema has no category/description columns)
type GoalMeta = { category: 'nutrition' | 'exercise' | 'diabetes' | 'weight' | 'other'; description: string };

const metaKey = (id: string) => `goal:meta:${id}`;
const readMeta = (id: string): GoalMeta => {
  try {
    const raw = localStorage.getItem(metaKey(id));
    if (!raw) return { category: 'other', description: '' };
    const parsed = JSON.parse(raw);
    return {
      category: parsed.category ?? 'other',
      description: parsed.description ?? ''
    };
  } catch {
    return { category: 'other', description: '' };
  }
};
const writeMeta = (id: string, meta: GoalMeta) => {
  localStorage.setItem(metaKey(id), JSON.stringify(meta));
};

const getCategoryColor = (category: string) => {
  switch (category) {
    case 'nutrition': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
    case 'exercise': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400';
    case 'diabetes': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
    case 'weight': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  }
};

// ---- component ----
const GoalsSection: React.FC = () => {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [showAddGoal, setShowAddGoal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newGoal, setNewGoal] = useState({
    title: '',
    description: '',
    category: 'nutrition' as GoalMeta['category'],
    target: 0,
    unit: '',
    deadline: ''
  });

  // map server -> UI
  function mapServerGoal(g: ServerGoal): Goal {
    const meta = readMeta(g.id);
    return {
      id: g.id,
      title: g.title,
      description: meta.description || '',
      category: meta.category,
      target: g.target_value,
      unit: g.unit,
      deadline: g.due_date || '',
      current: g.current_value,
      completed: g.status === 'completed'
    };
  }

  // initial load
  useEffect(() => {
    (async () => {
      try {
        setErr(null);
        setLoading(true);
        const res = await fetch('/api/goals', { headers: { ...authHeaders() } });
        if (!res.ok) throw new Error(`GET /api/goals ${res.status}`);
        const rows: ServerGoal[] = await res.json();
        setGoals(Array.isArray(rows) ? rows.map(mapServerGoal) : []);
      } catch (e) {
        console.error(e);
        setErr('Failed to load goals.');
        setGoals([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // create -> POST /api/goals
  const handleAddGoal = async () => {
    if (!newGoal.title.trim() || !newGoal.unit.trim() || newGoal.target <= 0) {
      alert('Title, unit, and a positive target are required.');
      return;
    }
    try {
      setCreating(true);
      const body = {
        title: newGoal.title.trim(),
        target_value: Number(newGoal.target),
        unit: newGoal.unit.trim(),
        due_date: newGoal.deadline || null
      };
      const res = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...authHeaders() },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => '');
        throw new Error(msg || `POST /api/goals ${res.status}`);
      }
      const { id } = await res.json();

      // persist local-only metadata
      writeMeta(id, { category: newGoal.category, description: newGoal.description });

      // update UI immediately
      const created: Goal = {
        id,
        title: newGoal.title,
        description: newGoal.description,
        category: newGoal.category,
        target: newGoal.target,
        unit: newGoal.unit,
        deadline: newGoal.deadline,
        current: 0,
        completed: false
      };
      setGoals((prev) => [created, ...prev]);

      // reset form
      setNewGoal({ title: '', description: '', category: 'nutrition', target: 0, unit: '', deadline: '' });
      setShowAddGoal(false);
    } catch (e) {
      console.error(e);
      alert('Failed to create goal.');
    } finally {
      setCreating(false);
    }
  };

  // progress -> POST /api/goals/:id/progress  { delta }
  const updateGoalProgress = async (goalId: string, newCurrent: number) => {
    const g = goals.find((x) => x.id === goalId);
    if (!g) return;
    const delta = Math.max(0, Math.floor(newCurrent - g.current));
    if (delta === 0) return;

    // optimistic UI
    setGoals((prev) =>
      prev.map((goal) =>
        goal.id === goalId
          ? { ...goal, current: goal.current + delta, completed: goal.current + delta >= goal.target }
          : goal
      )
    );

    try {
      const res = await fetch(`/api/goals/${encodeURIComponent(goalId)}/progress`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ delta, note: 'UI increment' })
      });
      if (!res.ok) {
        // rollback on failure
        setGoals((prev) =>
          prev.map((goal) =>
            goal.id === goalId
              ? { ...goal, current: goal.current - delta, completed: goal.current - delta >= goal.target }
              : goal
          )
        );
        const msg = await res.text().catch(() => '');
        throw new Error(msg || `POST /api/goals/:id/progress ${res.status}`);
      }
    } catch (e) {
      console.error(e);
      alert('Failed to update progress.');
    }
  };

  const completedGoals = useMemo(() => goals.filter(g => g.completed).length, [goals]);
  const totalGoals = goals.length;
  const completionPercentage = totalGoals > 0 ? Math.round((completedGoals / totalGoals) * 100) : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Health Goals</h1>
        <p className="text-gray-600 dark:text-gray-300">Set and track your health and wellness objectives.</p>
        {err && <p className="text-sm text-red-600 dark:text-red-400 mt-2">{err}</p>}
      </div>

      {/* Progress Overview */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            <TrendingUp className="h-5 w-5 mr-2 text-emerald-600" />
            Overall Progress {loading && <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">loading…</span>}
          </h3>
          <button
            onClick={() => setShowAddGoal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-lg font-medium hover:from-emerald-600 hover:to-emerald-700 transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>Add Goal</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-emerald-600">{completedGoals}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Goals Completed</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600">{totalGoals - completedGoals}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Goals In Progress</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-purple-600">{completionPercentage}%</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Success Rate</div>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-600 dark:text-gray-400">Overall Progress</span>
            <span className="text-gray-900 dark:text-white font-medium">{completedGoals}/{totalGoals} goals</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
            <div
              className="bg-gradient-to-r from-emerald-400 to-emerald-500 h-3 rounded-full transition-all duration-300"
              style={{ width: `${completionPercentage}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Goals Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {goals.map((goal) => {
          const progressPercentage = goal.target > 0 ? Math.min((goal.current / goal.target) * 100, 100) : 0;
          const daysLeft = goal.deadline
            ? Math.ceil((new Date(goal.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
            : null;

          return (
            <div key={goal.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 hover:shadow-md dark:hover:shadow-lg transition-all duration-200">
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{goal.title}</h3>
                {goal.completed && (
                  <div className="p-1.5 bg-green-100 dark:bg-green-900/20 rounded-full">
                    <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                )}
              </div>

              {goal.description && <p className="text-gray-600 dark:text-gray-300 text-sm mb-3">{goal.description}</p>}

              <div className="flex items-center space-x-2 mb-4">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getCategoryColor(goal.category)}`}>
                  {goal.category}
                </span>
                {daysLeft !== null && (
                  <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                    <Calendar className="h-3 w-3 mr-1" />
                    {daysLeft > 0 ? `${daysLeft} days left` : 'Overdue'}
                  </div>
                )}
              </div>

              <div className="mb-4">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600 dark:text-gray-400">Progress</span>
                  <span className="text-gray-900 dark:text-white font-medium">{goal.current}/{goal.target} {goal.unit}</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      goal.completed
                        ? 'bg-gradient-to-r from-green-400 to-green-500'
                        : 'bg-gradient-to-r from-blue-400 to-blue-500'
                    }`}
                    style={{ width: `${progressPercentage}%` }}
                  ></div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => updateGoalProgress(goal.id, Math.min(goal.current + 1, goal.target))}
                  disabled={goal.completed}
                  className={`flex-1 py-2 px-3 rounded-lg font-medium text-sm transition-all ${
                    goal.completed
                      ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700'
                  }`}
                >
                  {goal.completed ? 'Completed!' : 'Update Progress'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Goal Modal */}
      {showAddGoal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Create New Goal</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Goal Title</label>
                <input
                  type="text"
                  value={newGoal.title}
                  onChange={(e) => setNewGoal({ ...newGoal, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="Enter goal title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <textarea
                  value={newGoal.description}
                  onChange={(e) => setNewGoal({ ...newGoal, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  rows={2}
                  placeholder="Describe your goal"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                <select
                  value={newGoal.category}
                  onChange={(e) => setNewGoal({ ...newGoal, category: e.target.value as GoalMeta['category'] })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="nutrition">Nutrition</option>
                  <option value="exercise">Exercise</option>
                  <option value="diabetes">Diabetes</option>
                  <option value="weight">Weight</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target</label>
                  <input
                    type="number"
                    value={newGoal.target || ''}
                    onChange={(e) => setNewGoal({ ...newGoal, target: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="Target value"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Unit</label>
                  <input
                    type="text"
                    value={newGoal.unit}
                    onChange={(e) => setNewGoal({ ...newGoal, unit: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="e.g., workouts, lbs, km"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Deadline</label>
                <input
                  type="date"
                  value={newGoal.deadline}
                  onChange={(e) => setNewGoal({ ...newGoal, deadline: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowAddGoal(false)}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-medium"
                disabled={creating}
              >
                Cancel
              </button>
              <button
                onClick={handleAddGoal}
                disabled={creating || !newGoal.title.trim() || !newGoal.unit.trim() || newGoal.target <= 0}
                className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-lg font-medium hover:from-emerald-600 hover:to-emerald-700 transition-all disabled:opacity-60"
              >
                {creating ? 'Saving…' : 'Create Goal'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add button floating for small screens */}
      {!showAddGoal && (
        <button
          onClick={() => setShowAddGoal(true)}
          className="fixed bottom-6 right-6 md:hidden inline-flex items-center justify-center rounded-full h-12 w-12 shadow-lg bg-gradient-to-r from-emerald-500 to-emerald-600 text-white"
          aria-label="Add Goal"
          title="Add Goal"
        >
          <Plus className="h-5 w-5" />
        </button>
      )}
    </div>
  );
};

export default GoalsSection;
