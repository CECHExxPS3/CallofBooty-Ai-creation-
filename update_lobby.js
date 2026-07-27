import fs from 'fs';
let code = fs.readFileSync('src/components/Lobby.tsx', 'utf8');

const propsInterfaceStr = `interface LobbyProps {
  onStartGame: (config: MatchConfig, selectedClass: CharacterClass, name: string) => void;
  isMuted: boolean;
  onToggleMute: () => void;
  bindings: KeyBindings;
  onBindingsChange: (bindings: KeyBindings) => void;
  touchBindings: TouchBindings;
  onTouchBindingsChange: (bindings: TouchBindings) => void;
  useTouchControls: boolean;
  onToggleTouchControls: (enabled: boolean) => void;
}`;

const newPropsInterfaceStr = `interface LobbyProps {
  onStartGame: (config: MatchConfig, selectedClass: CharacterClass, name: string) => void;
  isMuted: boolean;
  onToggleMute: () => void;
  bindings: KeyBindings;
  onBindingsChange: (bindings: KeyBindings) => void;
  touchBindings: TouchBindings;
  onTouchBindingsChange: (bindings: TouchBindings) => void;
  useTouchControls: boolean;
  onToggleTouchControls: (enabled: boolean) => void;
  graphicsQuality: 'POTATO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'ULTRA';
  onGraphicsQualityChange: (quality: 'POTATO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'ULTRA') => void;
}`;

code = code.replace(propsInterfaceStr, newPropsInterfaceStr);

const signatureStr = `export const Lobby: React.FC<LobbyProps> = ({
  onStartGame,
  isMuted,
  onToggleMute,
  bindings,
  onBindingsChange,
  touchBindings,
  onTouchBindingsChange,
  useTouchControls,
  onToggleTouchControls
}) => {`;

const newSignatureStr = `export const Lobby: React.FC<LobbyProps> = ({
  onStartGame,
  isMuted,
  onToggleMute,
  bindings,
  onBindingsChange,
  touchBindings,
  onTouchBindingsChange,
  useTouchControls,
  onToggleTouchControls,
  graphicsQuality,
  onGraphicsQualityChange
}) => {`;

code = code.replace(signatureStr, newSignatureStr);

// Add showSettingsModal state
const stateStr = `  const [selectedClassId, setSelectedClassId] = useState('assault');`;
const newStateStr = `  const [selectedClassId, setSelectedClassId] = useState('assault');\n  const [showSettingsModal, setShowSettingsModal] = useState(false);`;
code = code.replace(stateStr, newStateStr);

fs.writeFileSync('src/components/Lobby.tsx', code);
console.log("Updated Lobby.tsx props");
