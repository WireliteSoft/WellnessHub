import React, { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";

export const SignupForm: React.FC = () => {
  const { signup } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!name || !email || !password) { setErr("All fields are required."); return; }
    setLoading(true);
    try {
      await signup(name.trim(), email.trim(), password);
    } catch {
      setErr("Sign up failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-sm mb-1 text-gray-700 dark:text-gray-300">Name</label>
        <input
          type="text"
          className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-gray-900 dark:text-gray-100"
          value={name} onChange={(e) => setName(e.target.value)} autoComplete="name"
        />
      </div>
      <div>
        <label className="block text-sm mb-1 text-gray-700 dark:text-gray-300">Email</label>
        <input
          type="email"
          className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-gray-900 dark:text-gray-100"
          value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email"
        />
      </div>
      <div>
        <label className="block text-sm mb-1 text-gray-700 dark:text-gray-300">Password</label>
        <input
          type="password"
          className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-gray-900 dark:text-gray-100"
          value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password"
        />
      </div>
      {err && <p className="text-sm text-red-600 dark:text-red-400">{err}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-gray-900 dark:bg-gray-100 text-gray-100 dark:text-gray-900 font-medium py-2.5 hover:opacity-90 disabled:opacity-60"
      >
        {loading ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
};
