import React, { useEffect, useMemo, useState } from 'react';
import { Heart, TrendingUp, Clock, Plus, AlertTriangle } from 'lucide-react';

type GlucoseRow = {
  id: string;
  mg_dl: number;
  reading_time: string; // ISO
  meal_context?: 'fasting' | 'pre-meal' | 'post-meal' | 'bedtime' | 'other' | null;
  notes?: string | null;
};

const DiabetesSection: React.FC = () => {
  const [readings, setReadings] = useState<GlucoseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [showAddReading, setShowAddReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newReading, setNewReading] = useState({
    value: '',
    mealContext: 'fasting' as 'fasting' | 'before-meal' | 'after-meal' | 'bedtime' | 'any',
    notes: ''
  });

  function authHeaders() {
    const t = typeof window !== 'undefined' ? localStorage.getItem('auth:token') : null;
    return t ? { Authorization: `Bearer ${t}` } : {};
  }

  useEffect(() => {
    (async () => {
      try {
        setErr(null);
        setLoading(true);
        const res = await fetch('/api/glucose', { headers: { ...authHeaders() } });
        if (!res.ok) throw new Error(`GET /api/glucose ${res.status}`);
        const rows: GlucoseRow[] = await res.json();
        // sort newest → oldest
        rows.sort((a, b) => +new Date(b.reading_time) - +new Date(a.reading_time));
        setReadings(rows);
      } catch (e) {
        console.error(e);
        setErr('Failed to load glucose data.');
        setReadings([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const mapUiToDbContext = (v: string): GlucoseRow['meal_context'] => {
    if (v === 'before-meal') return 'pre-meal';
    if (v === 'after-meal') return 'post-meal';
    if (v === 'any') return 'other';
    return (v as any) ?? 'other';
  };

  const handleAddReading = async () => {
    const mg = parseFloat(newReading.value);
    if (!isFinite(mg) || mg <= 0) {
      alert('Enter a valid glucose value.');
      return;
    }
    try {
      setSaving(true);
      const body = {
        mg_dl: mg,
        reading_time: new Date().toISOString(),
        meal_context: mapUiToDbContext(newReading.mealContext),
        notes: newReading.notes.trim() || undefined
      };
      const res = await fetch('/api/glucose', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...authHeaders() },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => '');
        throw new Error(msg || `POST /api/glucose ${res.status}`);
      }
      const { id } = await res.json();
      // reflect immediately
      setReadings(prev => [{ id, ...body }, ...prev]);
      setNewReading({ value: '', mealContext: 'fasting', notes: '' });
      setShowAddReading(false);
    } catch (e) {
      console.error(e);
      alert('Failed to add reading.');
    } finally {
      setSaving(false);
    }
  };

  const getReadingStatus = (value: number, context?: string | null) => {
    const fasting = context === 'fasting';
    if (fasting) {
      if (value < 80) return { status: 'low', color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400' };
      if (value <= 100) return { status: 'normal', color: 'text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400' };
      if (value <= 125) return { status: 'elevated', color: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 dark:text-yellow-400' };
      return { status: 'high', color: 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400' };
    } else {
      if (value < 80) return { status: 'low', color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400' };
      if (value <= 140) return { status: 'normal', color: 'text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400' };
      if (value <= 180) return { status: 'elevated', color: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 dark:text-yellow-400' };
      return { status: 'high', color: 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400' };
    }
  };

  const { averageReading, timeInRangePct, lastReading } = useMemo(() => {
    if (!readings.length) return { averageReading: null as number | null, timeInRangePct: null as number | null, lastReading: null as GlucoseRow | null };
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 14);
    const r14 = readings.filter(r => new Date(r.reading_time) >= cutoff);
    const avg = r14.length ? Math.round(r14.reduce((s, r) => s + (r.mg_dl ?? 0), 0) / r14.length) : null;
    const inRange = r14.length ? Math.round((r14.filter(r => r.mg_dl >= 70 && r.mg_dl <= 180).length / r14.length) * 100) : null;
    const last = readings[0] ?? null;
    return { averageReading: avg, timeInRangePct: inRange, lastReading: last };
  }, [readings]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Diabetes Management</h1>
        <p className="text-gray-600 dark:text-gray-300">Track your blood glucose levels and monitor your diabetes health.</p>
        {err && <p className="text-sm text-red-600 dark:text-red-400 mt-2">{err}</p>}
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Average Glucose (14d)</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {loading ? '…' : (averageReading ?? '—')} {averageReading !== null ? 'mg/dL' : ''}
              </p>
              {averageReading !== null && (
                <p className={`text-sm ${averageReading >= 70 && averageReading <= 180 ? 'text-green-600' : 'text-red-600'} mt-1`}>
                  {averageReading >= 70 && averageReading <= 180 ? 'Within target range' : 'Outside target range'}
                </p>
              )}
            </div>
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20">
              <Heart className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Time in Range (70–180, 14d)</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{loading ? '…' : (timeInRangePct === null ? '—' : `${timeInRangePct}%`)}</p>
              {timeInRangePct !== null && (
                <p className={`text-sm ${timeInRangePct >= 70 ? 'text-blue-600' : 'text-yellow-600'} mt-1`}>
                  {timeInRangePct >= 70 ? 'Good control' : 'Could improve'}
                </p>
              )}
            </div>
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
              <TrendingUp className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Last Reading</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {loading || !lastReading ? '—' : `${lastReading.mg_dl} mg/dL`}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {loading || !lastReading ? '' : new Date(lastReading.reading_time).toLocaleString()}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
              <Clock className="h-6 w-6 text-green-600 dark:text-green-400" />
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
            {loading ? (
              <p className="text-sm text-gray-600 dark:text-gray-400">Loading…</p>
            ) : readings.length === 0 ? (
              <p className="text-sm text-gray-600 dark:text-gray-400">No readings yet.</p>
            ) : (
              readings.slice(0, 20).map((reading) => {
                const { status, color } = getReadingStatus(reading.mg_dl, reading.meal_context || undefined);
                return (
                  <div
                    key={reading.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`px-2 py-1 rounded-full text-xs font-medium ${color}`}>
                        {reading.mg_dl} mg/dL
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                          {(reading.meal_context ?? 'other').replace('-', ' ')}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(reading.reading_time).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    {(status === 'high' || status === 'low') ? (
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    ) : null}
                  </div>
                );
              })
            )}
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
                    <option value="any">Other/Any</option>
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
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddReading}
                  disabled={saving || !newReading.value.trim()}
                  className="px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg font-medium hover:from-red-600 hover:to-red-700 transition-all disabled:opacity-60"
                >
                  {saving ? 'Saving…' : 'Add Reading'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Health Tips (static) */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Diabetes Management Tips</h3>
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <h4 className="font-medium text-blue-900 dark:text-blue-300 mb-1">Monitor Regularly</h4>
              <p className="text-sm text-blue-700 dark:text-blue-300">Check your blood glucose at consistent times each day for better pattern recognition.</p>
            </div>
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <h4 className="font-medium text-green-900 dark:text-green-300 mb-1">Exercise After Meals</h4>
              <p className="text-sm text-green-700 dark:text-green-300">Light exercise 30–60 minutes after eating can help lower post-meal spikes.</p>
            </div>
            <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
              <h4 className="font-medium text-orange-900 dark:text-orange-300 mb-1">Stay Hydrated</h4>
              <p className="text-sm text-orange-700 dark:text-orange-300">Hydration helps your kidneys flush out excess glucose.</p>
            </div>
            <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <h4 className="font-medium text-purple-900 dark:text-purple-300 mb-1">Manage Stress</h4>
              <p className="text-sm text-purple-700 dark:text-purple-300">Chronic stress can raise blood sugar. Practice relaxation daily.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DiabetesSection;
