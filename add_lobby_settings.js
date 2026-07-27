import fs from 'fs';
let code = fs.readFileSync('src/components/Lobby.tsx', 'utf8');

const audioBtnStr = `        <div className="flex items-center gap-3">
          {/* Audio toggle button */}
          <button
            id="lobby-audio-toggle"
            onClick={onToggleMute}`;

const newAudioBtnStr = `        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSettingsModal(true)}
            className="p-3 bg-slate-900 border border-slate-800 hover:bg-slate-850 hover:border-slate-700 rounded-xl transition"
            title="Graphics Settings"
          >
            <Settings className="text-slate-400 w-5 h-5" />
          </button>
          
          {/* Audio toggle button */}
          <button
            id="lobby-audio-toggle"
            onClick={onToggleMute}`;

code = code.replace(audioBtnStr, newAudioBtnStr);

const endStr = `      </main>

    </div>
  );
};`;

const newEndStr = `      </main>

      {/* SETTINGS MODAL */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <button
              onClick={() => setShowSettingsModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              &times;
            </button>
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><Settings className="w-5 h-5"/> Graphics Quality</h2>
            
            <div className="space-y-3">
              {(['POTATO', 'LOW', 'MEDIUM', 'HIGH', 'ULTRA'] as const).map(q => (
                <button
                  key={q}
                  onClick={() => onGraphicsQualityChange(q)}
                  className={\`w-full p-4 rounded-xl text-left transition font-mono text-sm border \${
                    graphicsQuality === q 
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' 
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800 hover:border-slate-700'
                  }\`}
                >
                  {q} QUALITY
                </button>
              ))}
            </div>
            
            <p className="mt-6 text-xs text-slate-500 text-center">
              Changes apply immediately. Potato quality disables anti-aliasing and post-processing for maximum FPS.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};`;

code = code.replace(endStr, newEndStr);
fs.writeFileSync('src/components/Lobby.tsx', code);
console.log("Added settings modal to Lobby");
