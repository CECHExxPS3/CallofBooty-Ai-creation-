const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:3000');
ws.on('open', () => {
  ws.send(JSON.stringify({
    type: 'join',
    payload: {
      name: 'spectator1',
      classId: 'assault',
      isSpectator: true,
      x: 0, y: 1.5, z: 0, yaw: 0, pitch: 0
    }
  }));
  console.log('Joined as spectator');
  let i = 0;
  setInterval(() => {
    ws.send(JSON.stringify({
      type: 'player_updated',
      payload: { x: i++, y: 1.5, z: 0, yaw: 0, pitch: 0, isFiring: false, isADS: false, isReloading: false, activeWeaponId: 'm4_assault' }
    }));
  }, 50);
});
ws.on('close', () => console.log('closed'));
ws.on('error', (e) => console.log('error', e));
