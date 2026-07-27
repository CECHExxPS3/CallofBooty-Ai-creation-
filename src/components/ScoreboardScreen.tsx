import React from 'react';
import { MatchStats, CLASSES } from '../types';
import { Trophy, RotateCcw, Swords, Medal, AlertTriangle, ShieldCheck } from 'lucide-react';

interface ScoreboardScreenProps {
  stats: MatchStats[];
  onRestart: () => void;
  playerName: string;
}

export const ScoreboardScreen: React.FC<ScoreboardScreenProps> = ({ stats, onRestart, playerName }) => {
  // Check if player won
  const winner = stats[0];
  const isPlayerWinner = winner?.id === 'player';

  return (
    <div id="scoreboard-screen-root" className="min-h-screen bg-slate-950 text-white flex flex-col justify-center items-center font-sans p-6 select-none overflow-y-auto">
      
      {/* Visual Header and Win State */}
      <div id="match-results-header" className="max-w-2xl w-full text-center space-y-6 mb-8 animate-fade-in">
        
        <div className="flex justify-center">
          {isPlayerWinner ? (
            <div className="p-5 bg-amber-500/15 border-2 border-amber-500/30 rounded-full animate-bounce shadow-2xl shadow-amber-500/20">
              <Trophy className="w-14 h-14 text-amber-400" />
            </div>
          ) : (
            <div className="p-5 bg-slate-900 border-2 border-slate-800 rounded-full shadow-2xl">
              <Swords className="w-14 h-14 text-slate-400" />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <h1 className={`text-5xl font-extrabold tracking-tighter ${isPlayerWinner ? 'text-amber-400' : 'text-slate-400'}`}>
            {isPlayerWinner ? 'VICTORY' : 'DEFEAT'}
          </h1>
          <p className="text-sm text-slate-400 font-mono">
            {isPlayerWinner 
              ? `Congratulations Soldier! You dominated the arena with ${winner.kills} kills!` 
              : `Combat match concluded. ${winner?.name || 'A bot'} claimed victory with ${winner?.kills || 0} kills.`
            }
          </p>
        </div>
      </div>

      {/* Main Scoreboard Table */}
      <div id="scoreboard-table-card" className="max-w-3xl w-full bg-slate-900/40 border border-slate-900 rounded-3xl p-6 md:p-8 shadow-3xl space-y-6 animate-fade-in">
        <h2 className="text-xs font-mono text-slate-400 uppercase tracking-widest font-bold">
          Match Statistics Leaderboard
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                <th className="pb-3 pl-3">Rank</th>
                <th className="pb-3">Soldier</th>
                <th className="pb-3">Class</th>
                <th className="pb-3 text-center">Kills</th>
                <th className="pb-3 text-center">Deaths</th>
                <th className="pb-3 text-right pr-3">Final Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40 text-sm font-mono">
              {stats.map((item, idx) => {
                const isLocalPlayer = item.id === 'player';
                const characterClass = CLASSES.find(c => c.id === item.classId);

                // Trophy assignment for podium
                let medalIcon = null;
                if (idx === 0) medalIcon = <Medal className="w-4.5 h-4.5 text-amber-400" />;
                else if (idx === 1) medalIcon = <Medal className="w-4.5 h-4.5 text-slate-300" />;
                else if (idx === 2) medalIcon = <Medal className="w-4.5 h-4.5 text-amber-700" />;

                return (
                  <tr
                    key={item.id}
                    className={`transition-all ${
                      isLocalPlayer 
                        ? 'bg-emerald-500/10 text-emerald-200' 
                        : 'hover:bg-slate-900/20 text-slate-300'
                    }`}
                  >
                    <td className="py-3.5 pl-3 font-bold">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-500 text-xs">#{idx + 1}</span>
                        {medalIcon}
                      </div>
                    </td>
                    <td className="py-3.5 font-sans font-extrabold flex items-center gap-2">
                      <span className="truncate max-w-[150px]">{item.name}</span>
                      {isLocalPlayer && (
                        <span className="bg-emerald-500/20 text-emerald-400 text-[8px] font-mono px-1.5 py-0.5 rounded uppercase font-extrabold tracking-wider">
                          YOU
                        </span>
                      )}
                    </td>
                    <td className="py-3.5">
                      <span className="text-xs uppercase font-bold" style={{ color: characterClass?.accentColor }}>
                        {characterClass?.codename || 'INFANTRY'}
                      </span>
                    </td>
                    <td className="py-3.5 text-center text-white font-bold">{item.kills}</td>
                    <td className="py-3.5 text-center text-slate-400">{item.deaths}</td>
                    <td className="py-3.5 text-right pr-3 text-amber-400 font-bold">{item.score} pts</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Action Button to Play Again */}
        <div className="flex justify-center pt-4">
          <button
            id="play-again-button"
            onClick={onRestart}
            className="px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-sans font-bold tracking-wide rounded-2xl shadow-xl shadow-emerald-500/10 flex items-center gap-2 transform active:scale-[0.98] transition-all"
          >
            <RotateCcw className="w-5 h-5" /> RE-ENTER COMBAT LOBBY
          </button>
        </div>

      </div>

    </div>
  );
};
export default ScoreboardScreen;
