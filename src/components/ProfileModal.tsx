import React, { useState, useEffect } from 'react';
import { X, User, Trophy, Crosshair, Skull, Award, Swords, ChevronRight, Activity, Clock, LogOut } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { collection, getDocs, query, where, orderBy, limit, doc, getDoc } from 'firebase/firestore';

interface ProfileModalProps {
  user: any;
  onClose: () => void;
  onLogout: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ user, onClose, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'HISTORY' | 'WEAPONS' | 'ID'>('OVERVIEW');
  const [matchHistory, setMatchHistory] = useState<any[]>([]);
  const [weaponStats, setWeaponStats] = useState<Record<string, any>>({});
  const [loadingStats, setLoadingStats] = useState(false);

  useEffect(() => {
    if (!user || user.isGuest) return;

    const fetchStats = async () => {
      setLoadingStats(true);
      try {
        if (activeTab === 'HISTORY' && matchHistory.length === 0) {
          const q = query(collection(db, 'match_history'), where('userId', '==', user.uid), orderBy('timestamp', 'desc'), limit(10));
          const snapshot = await getDocs(q);
          const history = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
          setMatchHistory(history);
        } else if (activeTab === 'WEAPONS' && Object.keys(weaponStats).length === 0) {
          const wRef = doc(db, 'weapon_stats', user.uid);
          const snap = await getDoc(wRef);
          if (snap.exists()) {
            setWeaponStats(snap.data());
          }
        }
      } catch (err) {
        console.error("Failed to fetch stats:", err);
      } finally {
        setLoadingStats(false);
      }
    };

    fetchStats();
  }, [activeTab, user]);

  // Helper to safely format numbers
  const formatNum = (num: any) => (typeof num === 'number' ? num.toLocaleString() : '0');
  
  // Calculate K/D ratio safely
  const kills = user?.kills || 0;
  const deaths = user?.deaths || 0;
  const kdRatio = deaths > 0 ? (kills / deaths).toFixed(2) : kills > 0 ? kills.toString() : '0.00';

  const wins = user?.wins || 0;
  const matches = user?.matchesPlayed || 0;
  const winRate = matches > 0 ? Math.round((wins / matches) * 100) : 0;

  const handleSignOut = () => {
    auth.signOut();
    onLogout();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative z-10 w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-emerald-500/20 border-2 border-emerald-500/50 rounded-xl flex items-center justify-center text-emerald-400">
              <User className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
                {user?.username || 'Unknown Soldier'}
                {user?.isGuest && <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono uppercase tracking-widest font-bold">Guest</span>}
              </h2>
              <div className="text-sm font-mono text-emerald-400 flex items-center gap-2 mt-1">
                <span className="font-bold">LEVEL {user?.level || 1}</span>
                <span className="text-slate-600">•</span>
                <span className="text-slate-400">{formatNum(user?.xp)} XP</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex px-6 border-b border-slate-800">
          {['OVERVIEW', 'HISTORY', 'WEAPONS', 'ID'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-4 py-3 text-sm font-bold tracking-widest transition-colors border-b-2 ${
                activeTab === tab
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900/50">
          
          {activeTab === 'OVERVIEW' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                  <div className="text-slate-400 text-xs font-mono font-bold mb-1">K/D RATIO</div>
                  <div className="text-3xl font-black text-white">{kdRatio}</div>
                </div>
                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                  <div className="text-slate-400 text-xs font-mono font-bold mb-1">WIN RATE</div>
                  <div className="text-3xl font-black text-emerald-400">{winRate}%</div>
                </div>
                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                  <div className="text-slate-400 text-xs font-mono font-bold mb-1">MATCHES</div>
                  <div className="text-3xl font-black text-white">{formatNum(matches)}</div>
                </div>
                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                  <div className="text-slate-400 text-xs font-mono font-bold mb-1">HIGHEST STREAK</div>
                  <div className="text-3xl font-black text-amber-400">{formatNum(user?.highestKillStreak)}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest border-b border-slate-800 pb-2">Combat Record</h3>
                  <div className="bg-slate-950/50 rounded-xl p-4 space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500 font-mono">TOTAL KILLS</span>
                      <span className="text-white font-bold">{formatNum(kills)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500 font-mono">TOTAL DEATHS</span>
                      <span className="text-white font-bold">{formatNum(deaths)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500 font-mono">ASSISTS</span>
                      <span className="text-white font-bold">{formatNum(user?.assists)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500 font-mono">HEADSHOTS</span>
                      <span className="text-white font-bold">{formatNum(user?.headshots)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500 font-mono">LONGEST SHOT</span>
                      <span className="text-white font-bold">{formatNum(user?.longestShot)}m</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest border-b border-slate-800 pb-2">Performance</h3>
                  <div className="bg-slate-950/50 rounded-xl p-4 space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500 font-mono">WINS</span>
                      <span className="text-emerald-400 font-bold">{formatNum(wins)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500 font-mono">LOSSES</span>
                      <span className="text-red-400 font-bold">{formatNum(user?.losses)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500 font-mono">DAMAGE DEALT</span>
                      <span className="text-white font-bold">{formatNum(user?.damageDealt)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500 font-mono">ACCURACY</span>
                      <span className="text-white font-bold">
                        {user?.shotsFired > 0 ? Math.round((user.shotsHit / user.shotsFired) * 100) : 0}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500 font-mono">TIME PLAYED</span>
                      <span className="text-white font-bold">
                        {Math.floor((user?.totalPlayTime || 0) / 3600)}h {Math.floor(((user?.totalPlayTime || 0) % 3600) / 60)}m
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'HISTORY' && (
            <div className="flex flex-col h-full space-y-4">
              {loadingStats ? (
                <div className="flex items-center justify-center h-full text-slate-500">Loading history...</div>
              ) : matchHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                  <Activity className="w-16 h-16 text-slate-700" />
                  <h3 className="text-xl font-bold text-slate-300">No Match History</h3>
                  <p className="text-slate-500 max-w-md">Play some matches to see your combat logs here.</p>
                </div>
              ) : (
                <div className="space-y-2 overflow-y-auto pr-2">
                  {matchHistory.map((match, i) => (
                    <div key={match.id || i} className={`p-4 rounded-xl border flex items-center justify-between ${match.isWin ? 'bg-emerald-900/20 border-emerald-500/30' : 'bg-red-900/20 border-red-500/30'}`}>
                      <div>
                        <div className="font-bold text-lg flex items-center gap-2">
                          <span className={match.isWin ? 'text-emerald-400' : 'text-red-400'}>
                            {match.isWin ? 'VICTORY' : 'DEFEAT'}
                          </span>
                          <span className="text-slate-500 text-sm font-mono">- {match.mapId}</span>
                        </div>
                        <div className="text-xs text-slate-500 mt-1">{new Date(match.timestamp).toLocaleString()}</div>
                      </div>
                      <div className="flex gap-6 text-center">
                        <div>
                          <div className="text-xs text-slate-500 font-mono">SCORE</div>
                          <div className="font-bold text-white">{match.score}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500 font-mono">K/D</div>
                          <div className="font-bold text-white">{match.kills} / {match.deaths}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'WEAPONS' && (
            <div className="flex flex-col h-full space-y-4">
              {loadingStats ? (
                <div className="flex items-center justify-center h-full text-slate-500">Loading weapon stats...</div>
              ) : Object.keys(weaponStats).length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                  <Crosshair className="w-16 h-16 text-slate-700" />
                  <h3 className="text-xl font-bold text-slate-300">No Weapon Statistics</h3>
                  <p className="text-slate-500 max-w-md">Get some kills with weapons to track your mastery.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 overflow-y-auto pr-2">
                  {Object.entries(weaponStats).sort((a, b) => (b[1] as any).kills - (a[1] as any).kills).map(([wepId, data]) => (
                    <div key={wepId} className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center">
                          <Crosshair className="w-5 h-5 text-slate-400" />
                        </div>
                        <div>
                          <div className="font-bold text-slate-200 uppercase">{wepId.replace(/_/g, ' ')}</div>
                          <div className="text-xs text-slate-500 font-mono">MASTERY LEVEL {Math.floor(((data as any).kills || 0) / 100) + 1}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-black text-emerald-400 text-xl">{(data as any).kills}</div>
                        <div className="text-[10px] text-slate-500 font-mono">KILLS</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'ID' && (
            <div className="flex flex-col items-center justify-center h-full space-y-8">
              <div className="text-center space-y-2">
                <h3 className="text-sm font-mono font-bold text-slate-400 uppercase tracking-widest">Permanent Player ID</h3>
                <div className="bg-slate-950 border-2 border-slate-800 rounded-2xl px-12 py-6">
                  <span className="text-5xl font-black text-white tracking-widest">{user?.playerId || '#00000'}</span>
                </div>
                {user?.isGuest && (
                  <p className="text-amber-500 text-xs font-bold mt-2">Warning: Temporary Guest ID. Will be lost upon exiting.</p>
                )}
              </div>

              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 px-6 py-3 rounded-xl font-bold transition"
              >
                <LogOut className="w-5 h-5" />
                Sign Out / Switch Account
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
