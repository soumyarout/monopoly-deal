import { useState, useEffect, useCallback, useRef } from 'react';

/* ─── Types ─── */
interface AdminPlayer {
  id: string; name: string; isAI: boolean; aiSkill: string | null;
  isHost: boolean; disconnected: boolean;
  handCount: number; bankTotal: number; propertySets: number; completeSets: number;
}

interface AdminRoom {
  id: string; phase: 'lobby' | 'playing' | 'ended'; version: string; mode: string;
  createdAt: number; ageMinutes: number;
  turnTimeLimit: number; timerPaused: boolean;
  pendingPayments: number; pendingActions: number;
  deckRemaining: number; discardCount: number;
  winner: string | null; activePlayerName: string | null;
  players: AdminPlayer[]; spectatorCount: number;
}

interface AdminStats {
  serverTime: number; totalRooms: number;
  playingRooms: number; lobbyRooms: number; endedRooms: number; totalPlayers: number;
  rooms: AdminRoom[];
}

/* ─── Helpers ─── */
const VERSION_LABEL: Record<string, string> = { us: '🇺🇸 US', uk: '🇬🇧 UK', india: '🇮🇳 India' };
const PHASE_COLOR: Record<string, string> = {
  lobby:   'bg-yellow-100 text-yellow-800 border-yellow-300',
  playing: 'bg-green-100 text-green-800 border-green-300',
  ended:   'bg-gray-100 text-gray-600 border-gray-300',
};

function age(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`rounded-xl border p-4 flex flex-col gap-1 ${color}`}>
      <span className="text-2xl font-black">{value}</span>
      <span className="text-xs font-semibold uppercase tracking-wider opacity-70">{label}</span>
    </div>
  );
}

/* ─── Room row ─── */
function RoomRow({ room, onKill }: { room: AdminRoom; onKill: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [killing, setKilling] = useState(false);

  const handleKill = async () => {
    if (!confirm(`Kill room ${room.id}? All players will be disconnected.`)) return;
    setKilling(true);
    onKill(room.id);
  };

  const aiPlayers    = room.players.filter(p => p.isAI);
  const disconnected = room.players.filter(p => p.disconnected).length;

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
           onClick={() => setExpanded(e => !e)}>

        {/* Phase badge */}
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${PHASE_COLOR[room.phase]} flex-shrink-0`}>
          {room.phase.toUpperCase()}
        </span>

        {/* Room ID */}
        <code className="font-mono text-sm font-bold text-gray-800 flex-shrink-0"
              onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(room.id); }}>
          {room.id}
          <span className="ml-1 text-[10px] text-gray-400 cursor-copy">[copy]</span>
        </code>

        {/* Version */}
        <span className="text-xs text-gray-500 flex-shrink-0">{VERSION_LABEL[room.version] ?? room.version}</span>

        {/* Players summary */}
        <span className="text-xs text-gray-600 flex-shrink-0">
          👥 {room.players.length} player{room.players.length !== 1 ? 's' : ''}
          {aiPlayers.length > 0 && ` (${aiPlayers.length} AI)`}
          {disconnected > 0 && <span className="text-red-500 ml-1">· {disconnected} 🔴</span>}
        </span>

        {/* Active player */}
        {room.phase === 'playing' && room.activePlayerName && (
          <span className="text-xs text-blue-600 flex-shrink-0">Turn: <strong>{room.activePlayerName}</strong></span>
        )}

        {/* Pending badges */}
        {room.pendingPayments > 0 && (
          <span className="text-[10px] bg-orange-100 text-orange-700 border border-orange-300 px-1.5 py-0.5 rounded-full font-bold flex-shrink-0">
            {room.pendingPayments} payment{room.pendingPayments !== 1 ? 's' : ''}
          </span>
        )}
        {room.pendingActions > 0 && (
          <span className="text-[10px] bg-purple-100 text-purple-700 border border-purple-300 px-1.5 py-0.5 rounded-full font-bold flex-shrink-0">
            {room.pendingActions} action{room.pendingActions !== 1 ? 's' : ''}
          </span>
        )}

        {/* Winner */}
        {room.winner && (
          <span className="text-[10px] bg-yellow-100 text-yellow-800 border border-yellow-300 px-1.5 py-0.5 rounded-full font-bold flex-shrink-0">
            🏆 {room.winner}
          </span>
        )}

        {/* Age */}
        <span className="text-xs text-gray-400 ml-auto flex-shrink-0">{age(room.ageMinutes)} ago</span>

        {/* Expand toggle */}
        <span className="text-gray-400 text-xs flex-shrink-0">{expanded ? '▲' : '▼'}</span>

        {/* Kill button */}
        <button
          onClick={e => { e.stopPropagation(); handleKill(); }}
          disabled={killing}
          className="flex-shrink-0 px-3 py-1 rounded-lg text-xs font-bold bg-red-500 hover:bg-red-600 text-white disabled:opacity-50 transition-colors ml-1"
        >
          {killing ? '...' : 'Kill'}
        </button>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 space-y-3">
          {/* Room meta */}
          <div className="flex flex-wrap gap-4 text-xs text-gray-600">
            <span>📦 Deck: <strong>{room.deckRemaining}</strong> remaining</span>
            <span>🗑️ Discard: <strong>{room.discardCount}</strong></span>
            <span>🕐 Timer: <strong>{room.turnTimeLimit ? `${room.turnTimeLimit}s` : 'off'}</strong>
              {room.timerPaused && <span className="ml-1 text-orange-600">(paused)</span>}
            </span>
            <span>👁️ Spectators: <strong>{room.spectatorCount}</strong></span>
            <span>🕹️ Mode: <strong>{room.mode}</strong></span>
            <span>🌐 Version: <strong>{room.version}</strong></span>
            <span>🕑 Created: <strong>{new Date(room.createdAt).toLocaleTimeString()}</strong></span>
          </div>

          {/* Players table */}
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-200">
                <th className="py-1 pr-3 font-semibold">Player</th>
                <th className="py-1 pr-3 font-semibold">Type</th>
                <th className="py-1 pr-3 font-semibold">Status</th>
                <th className="py-1 pr-3 font-semibold text-right">Hand</th>
                <th className="py-1 pr-3 font-semibold text-right">Bank</th>
                <th className="py-1 pr-3 font-semibold text-right">Sets</th>
                <th className="py-1 font-semibold text-right">Complete</th>
              </tr>
            </thead>
            <tbody>
              {room.players.map(p => (
                <tr key={p.id} className={`border-b border-gray-100 ${p.disconnected ? 'opacity-50' : ''}`}>
                  <td className="py-1.5 pr-3 font-medium text-gray-800">
                    {p.isHost && <span className="mr-1">👑</span>}
                    {p.name}
                    {p.name === room.activePlayerName && room.phase === 'playing' && (
                      <span className="ml-1 text-blue-500">◀</span>
                    )}
                  </td>
                  <td className="py-1.5 pr-3 text-gray-500">
                    {p.isAI ? `🤖 AI (${p.aiSkill ?? '?'})` : '🙋 Human'}
                  </td>
                  <td className="py-1.5 pr-3">
                    {p.disconnected
                      ? <span className="text-red-500 font-semibold">Disconnected</span>
                      : <span className="text-green-600 font-semibold">Connected</span>
                    }
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{p.handCount}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums font-medium text-green-700">${p.bankTotal}M</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{p.propertySets}</td>
                  <td className="py-1.5 text-right tabular-nums font-bold text-blue-700">{p.completeSets}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ─── Login screen ─── */
function LoginScreen({ onLogin }: { onLogin: (key: string) => void }) {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/stats', { headers: { 'x-admin-key': key } });
      if (res.ok) {
        sessionStorage.setItem('admin-key', key);
        onLogin(key);
      } else {
        setError('Invalid admin key. Please try again.');
      }
    } catch {
      setError('Server unreachable. Make sure the server is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🎲</div>
          <h1 className="text-xl font-black text-gray-900">Monopoly Deal</h1>
          <p className="text-sm text-gray-500 mt-1">Admin Dashboard</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider">
              Admin Key
            </label>
            <input
              type="password"
              value={key}
              onChange={e => setKey(e.target.value)}
              placeholder="Enter admin key…"
              autoFocus
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
          <button
            type="submit"
            disabled={loading || !key}
            className="w-full bg-gray-900 hover:bg-gray-800 text-white font-bold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {loading ? 'Verifying…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ─── Main admin dashboard ─── */
export function AdminPage() {
  const [adminKey, setAdminKey] = useState<string | null>(() => sessionStorage.getItem('admin-key'));
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [error, setError] = useState('');
  const [filterPhase, setFilterPhase] = useState<'all' | 'lobby' | 'playing' | 'ended'>('all');
  const [sortBy, setSortBy] = useState<'age' | 'players' | 'phase'>('phase');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStats = useCallback(async (key: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/stats', { headers: { 'x-admin-key': key } });
      if (res.status === 401) { setAdminKey(null); sessionStorage.removeItem('admin-key'); return; }
      if (!res.ok) throw new Error('Server error');
      const data: AdminStats = await res.json();
      setStats(data);
      setLastRefresh(new Date());
    } catch {
      setError('Failed to fetch data. Is the server running?');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!adminKey) return;
    fetchStats(adminKey);
    intervalRef.current = setInterval(() => fetchStats(adminKey), 10_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [adminKey, fetchStats]);

  const handleKill = async (roomId: string) => {
    if (!adminKey) return;
    await fetch(`/api/admin/rooms/${roomId}`, {
      method: 'DELETE',
      headers: { 'x-admin-key': adminKey },
    });
    // Refresh immediately after kill
    fetchStats(adminKey);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('admin-key');
    setAdminKey(null);
    setStats(null);
  };

  if (!adminKey) return <LoginScreen onLogin={setAdminKey} />;

  const filteredRooms = (stats?.rooms ?? [])
    .filter(r => filterPhase === 'all' || r.phase === filterPhase)
    .sort((a, b) => {
      if (sortBy === 'age')     return b.createdAt - a.createdAt;
      if (sortBy === 'players') return b.players.length - a.players.length;
      // sort by phase: playing > lobby > ended
      const order = { playing: 0, lobby: 1, ended: 2 };
      return (order[a.phase] ?? 3) - (order[b.phase] ?? 3);
    });

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
          <span className="text-lg font-black text-white">🎲 Admin Dashboard</span>
          {lastRefresh && (
            <span className="text-xs text-gray-500">
              Updated {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => adminKey && fetchStats(adminKey)}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 transition-colors"
            >
              {loading ? '⟳ Refreshing…' : '⟳ Refresh'}
            </button>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {error && (
          <div className="bg-red-900/40 border border-red-700 rounded-xl px-4 py-3 text-red-300 text-sm">
            ⚠️ {error}
          </div>
        )}

        {/* Stats cards */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard label="Total Rooms"   value={stats.totalRooms}   color="bg-gray-800 text-white border-gray-700" />
            <StatCard label="Playing"       value={stats.playingRooms} color="bg-green-900 text-green-100 border-green-700" />
            <StatCard label="In Lobby"      value={stats.lobbyRooms}   color="bg-yellow-900 text-yellow-100 border-yellow-700" />
            <StatCard label="Ended"         value={stats.endedRooms}   color="bg-gray-800 text-gray-300 border-gray-700" />
            <StatCard label="Total Players" value={stats.totalPlayers} color="bg-blue-900 text-blue-100 border-blue-700" />
            <div className="rounded-xl border bg-purple-900 text-purple-100 border-purple-700 p-4 flex flex-col gap-1">
              <span className="text-2xl font-black">
                {stats.rooms.reduce((s, r) => s + r.pendingPayments, 0)}
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider opacity-70">Pending Pay</span>
            </div>
          </div>
        )}

        {/* Filters + sort */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Filter:</span>
          {(['all', 'playing', 'lobby', 'ended'] as const).map(phase => (
            <button
              key={phase}
              onClick={() => setFilterPhase(phase)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                filterPhase === phase
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {phase === 'all' ? 'All' : phase.charAt(0).toUpperCase() + phase.slice(1)}
              {stats && phase !== 'all' && (
                <span className="ml-1 opacity-70">
                  ({phase === 'playing' ? stats.playingRooms : phase === 'lobby' ? stats.lobbyRooms : stats.endedRooms})
                </span>
              )}
            </button>
          ))}
          <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider ml-4">Sort:</span>
          {(['phase', 'age', 'players'] as const).map(s => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                sortBy === s
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
          {stats && (
            <span className="ml-auto text-xs text-gray-500">
              {filteredRooms.length} room{filteredRooms.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Room list */}
        {!stats && !error && (
          <div className="text-center text-gray-500 py-16 text-sm">Loading…</div>
        )}
        {stats && filteredRooms.length === 0 && (
          <div className="text-center text-gray-600 py-16 text-sm">No rooms match the current filter.</div>
        )}
        <div className="space-y-2">
          {filteredRooms.map(room => (
            <RoomRow key={room.id} room={room} onKill={handleKill} />
          ))}
        </div>
      </div>

      {/* Auto-refresh indicator */}
      <div className="fixed bottom-4 right-4 text-[10px] text-gray-700 font-mono">
        Auto-refresh every 10s
      </div>
    </div>
  );
}
