const fs = require('fs');
const file = fs.readFileSync('src/components/GameCanvas.tsx', 'utf8');
const newFile = file.replace(
`      {showAdminCheatMenu && (
        <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-red-500/80 rounded-2xl p-6 max-w-md w-full shadow-2xl shadow-red-500/20 text-white font-mono space-y-4">
            <div className="flex justify-between items-center border-b border-red-500/30 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-400 animate-ping" />
                <h3 className="text-md font-black text-red-400 tracking-wider">
                  DEVDEVDEV9 // ADMIN CHEATS
                </h3>
              </div>
              <button
                onClick={() => setShowAdminCheatMenu(false)}
                className="text-xs bg-red-500/20 hover:bg-red-500/40 text-red-300 px-3 py-1 rounded-lg border border-red-500/40 font-bold transition"
              >
                CLOSE (8)
              </button>
            </div>
            
            <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
              Select a player to modify their active cheats and game logic attributes in real-time.
            </p>

            {gameRef.current.bots.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                  <button 
                    onClick={() => setAdminCheatTargetIndex(prev => (prev - 1 + gameRef.current.bots.length) % gameRef.current.bots.length)}
                    className="text-red-400 hover:text-white px-2"
                  >
                    &lt;--
                  </button>
                  <span className="font-bold text-sm tracking-widest text-emerald-300">
                    {gameRef.current.bots[adminCheatTargetIndex]?.name}#{gameRef.current.bots[adminCheatTargetIndex]?.id.slice(0,4)}
                  </span>
                  <button 
                    onClick={() => setAdminCheatTargetIndex(prev => (prev + 1) % gameRef.current.bots.length)}
                    className="text-red-400 hover:text-white px-2"
                  >
                    --&gt;
                  </button>
                </div>
                
                <div className="space-y-2">
                  <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-xs text-red-400">GOD MODE (INVINCIBLE)</span>
                      <button 
                        onClick={() => {
                          const botId = gameRef.current.bots[adminCheatTargetIndex].id;
                          setAdminTargetCheats(prev => ({
                            ...prev,
                            [botId]: { ...prev[botId], godMode: !(prev[botId]?.godMode) }
                          }));
                        }}
                        className={\`px-3 py-1 rounded text-[10px] font-bold \${(adminTargetCheats[gameRef.current.bots[adminCheatTargetIndex]?.id]?.godMode) ? 'bg-red-500 text-slate-950' : 'bg-slate-800 text-slate-400'}\`}
                      >
                        {(adminTargetCheats[gameRef.current.bots[adminCheatTargetIndex]?.id]?.godMode) ? 'ON' : 'OFF'}
                      </button>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-xs text-red-400">RAPID FIRE (NO COOLDOWN)</span>
                      <button 
                        onClick={() => {
                          const botId = gameRef.current.bots[adminCheatTargetIndex].id;
                          setAdminTargetCheats(prev => ({
                            ...prev,
                            [botId]: { ...prev[botId], rapidFire: !(prev[botId]?.rapidFire) }
                          }));
                        }}
                        className={\`px-3 py-1 rounded text-[10px] font-bold \${(adminTargetCheats[gameRef.current.bots[adminCheatTargetIndex]?.id]?.rapidFire) ? 'bg-red-500 text-slate-950' : 'bg-slate-800 text-slate-400'}\`}
                      >
                        {(adminTargetCheats[gameRef.current.bots[adminCheatTargetIndex]?.id]?.rapidFire) ? 'ON' : 'OFF'}
                      </button>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-xs text-red-400">SPEED HACK (SUPER SPEED)</span>
                      <button 
                        onClick={() => {
                          const botId = gameRef.current.bots[adminCheatTargetIndex].id;
                          setAdminTargetCheats(prev => ({
                            ...prev,
                            [botId]: { ...prev[botId], speedHack: !(prev[botId]?.speedHack) }
                          }));
                        }}
                        className={\`px-3 py-1 rounded text-[10px] font-bold \${(adminTargetCheats[gameRef.current.bots[adminCheatTargetIndex]?.id]?.speedHack) ? 'bg-red-500 text-slate-950' : 'bg-slate-800 text-slate-400'}\`}
                      >
                        {(adminTargetCheats[gameRef.current.bots[adminCheatTargetIndex]?.id]?.speedHack) ? 'ON' : 'OFF'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-slate-500">No players found to modify.</div>
            )}
          </div>
        </div>
      )}`,
`      {(() => {
        if (!showAdminCheatMenu) return null;
        const allPlayers = [
          ...gameRef.current.bots.map(b => ({ id: b.id, name: b.name, isBot: true })),
          ...Array.from(gameRef.current.otherPlayers.values()).filter(p => !p.isSpectator).map(p => ({ id: p.id, name: p.name, isBot: false }))
        ];
        const targetPlayer = allPlayers[adminCheatTargetIndex] || allPlayers[0];
        
        const toggleHack = (hackName) => {
          if (!targetPlayer) return;
          const currentCheats = adminTargetCheats[targetPlayer.id] || { 
            godMode: false, speedHack: false, flyHack: false, insaneSpeed: false, superJump: false, aimbotMode: 'OFF' 
          };
          const newCheats = { ...currentCheats };
          
          if (hackName === 'aimbotMode') {
            const modes = ['OFF', 'SILENT', 'FOV_CIRCLE'];
            newCheats.aimbotMode = modes[(modes.indexOf(currentCheats.aimbotMode || 'OFF') + 1) % modes.length];
          } else {
            newCheats[hackName] = !currentCheats[hackName];
          }

          setAdminTargetCheats(prev => ({ ...prev, [targetPlayer.id]: newCheats }));

          if (!targetPlayer.isBot && socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({
              type: 'admin_cheat',
              payload: { targetId: targetPlayer.id, hacks: newCheats }
            }));
          }
        };

        return (
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border-2 border-red-500/80 rounded-2xl p-6 max-w-md w-full shadow-2xl shadow-red-500/20 text-white font-mono space-y-4">
              <div className="flex justify-between items-center border-b border-red-500/30 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-400 animate-ping" />
                  <h3 className="text-md font-black text-red-400 tracking-wider">
                    DEVDEVDEV9 // ADMIN CHEATS
                  </h3>
                </div>
                <button
                  onClick={() => setShowAdminCheatMenu(false)}
                  className="text-xs bg-red-500/20 hover:bg-red-500/40 text-red-300 px-3 py-1 rounded-lg border border-red-500/40 font-bold transition"
                >
                  CLOSE (8)
                </button>
              </div>
              
              <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                Select a player to modify their active cheats and game logic attributes in real-time.
              </p>

              {allPlayers.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                    <button 
                      onClick={() => setAdminCheatTargetIndex(prev => (prev - 1 + allPlayers.length) % allPlayers.length)}
                      className="text-red-400 hover:text-white px-2"
                    >
                      &lt;--
                    </button>
                    <span className="font-bold text-sm tracking-widest text-emerald-300">
                      {targetPlayer.name}#{targetPlayer.id.slice(0,4)} {targetPlayer.isBot ? '(BOT)' : '(PLAYER)'}
                    </span>
                    <button 
                      onClick={() => setAdminCheatTargetIndex(prev => (prev + 1) % allPlayers.length)}
                      className="text-red-400 hover:text-white px-2"
                    >
                      --&gt;
                    </button>
                  </div>
                  
                  <div className="space-y-2">
                    {[
                      { key: 'godMode', label: 'GOD MODE (INVINCIBLE)' },
                      { key: 'flyHack', label: 'FLY HACK (GRAVITY OFF)' },
                      { key: 'speedHack', label: 'SPEED HACK (2.5X SPEED)' },
                      { key: 'insaneSpeed', label: 'INSANE SPEED (10X SPEED)' },
                      { key: 'superJump', label: 'SUPER JUMP' },
                    ].map(hack => {
                      const isActive = adminTargetCheats[targetPlayer?.id]?.[hack.key] || false;
                      return (
                        <div key={hack.key} className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-xs text-red-400">{hack.label}</span>
                            <button 
                              onClick={() => toggleHack(hack.key)}
                              className={\`px-3 py-1 rounded text-[10px] font-bold \${isActive ? 'bg-red-500 text-slate-950' : 'bg-slate-800 text-slate-400'}\`}
                            >
                              {isActive ? 'ON' : 'OFF'}
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-xs text-red-400">AIMBOT MODE</span>
                        <button 
                          onClick={() => toggleHack('aimbotMode')}
                          className={\`px-3 py-1 rounded text-[10px] font-bold \${(adminTargetCheats[targetPlayer?.id]?.aimbotMode || 'OFF') !== 'OFF' ? 'bg-red-500 text-slate-950' : 'bg-slate-800 text-slate-400'}\`}
                        >
                          {adminTargetCheats[targetPlayer?.id]?.aimbotMode || 'OFF'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-slate-500">No players found to modify.</div>
              )}
            </div>
          </div>
        );
      })()}`
);
fs.writeFileSync('src/components/GameCanvas.tsx', newFile);
