// ── CONSTANTS ──
const COLS = 15, ROWS = 9;
const EMPTY = 0, WALL_SOLID = 1, WALL_BRICK = 2, ITEM = 3;
const CELL_SIZE = 60;

// ── STATE ──
let gameState = {};
let gameLoopInterval = null, timerInterval = null, enemyInterval = null;
let currentPlayer = '';
let selectedIcon = '🤖'; // Ikon bawaan awal

// ── FEATURE: SELEKSI AVATAR ──
function selectAvatar(icon, element) {
  selectedIcon = icon;
  document.querySelectorAll('.avatar-box').forEach(box => box.classList.remove('active'));
  element.classList.add('active');
}

// ── MAP LAYOUT ──
function buildBoard() {
  const b = [];
  for (let r = 0; r < ROWS; r++) {
    b[r] = [];
    for (let c = 0; c < COLS; c++) {
      if (r === 0 || r === ROWS-1 || c === 0 || c === COLS-1) { b[r][c] = WALL_SOLID; }
      else if (r % 2 === 0 && c % 2 === 0) { b[r][c] = WALL_SOLID; }
      else {
        const safe = (r<=2 && c<=2) || (r<=2 && c>=COLS-3) || (r>=ROWS-3 && c<=2);
        b[r][c] = (!safe && Math.random() < 0.38) ? WALL_BRICK : EMPTY;
      }
    }
  }
  [[1,1],[1,2],[2,1]].forEach(([r,c]) => b[r][c] = EMPTY);
  return b;
}

function buildEnemies(level) {
  const count = Math.min(4 + level, 12);
  const enemies = [];
  
  const spots = [
    {x:COLS-2, y:ROWS-2}, {x:COLS-3, y:ROWS-2}, {x:COLS-2, y:ROWS-3},
    {x:COLS-4, y:1}, {x:7, y:4}, {x:7, y:7}, {x:1, y:ROWS-2},
    {x:12, y:3}, {x:2, y:6}, {x:10, y:5}
  ];

  for(let i=0; i<count; i++) {
    const spot = spots[i % spots.length];
    enemies.push({
      x: spot.x,
      y: spot.y,
      id: i,
      dir: Math.floor(Math.random()*4)
    });
  }
  return enemies;
}

// ── START GAME ──
function startGame() {
  const nameInput = document.getElementById('player-name');
  const err = document.getElementById('name-error');
  const name = nameInput.value.trim();
  if (!name) { err.textContent = '⚠ Nama tidak boleh kosong!'; return; }
  err.textContent = '';
  currentPlayer = name;

  gameState = {
    player: { x:1, y:1, lives:3, blastRadius:2, moveDelay: 150, lastMoveTime: 0, avatar: selectedIcon },
    board: buildBoard(),
    enemies: buildEnemies(1),
    bombs: [],
    items: [],
    isPlaying: true,
    timeElapsed: 0,
    score: 0,
    level: 1,
    combo: 0,
    lastKillTime: 0,
    playerName: name
  };

  showScreen('game-screen');
  document.getElementById('hud-name').textContent = name;
  
  injectLevelHUD();
  
  updateHUD();
  renderBoard();
  startLoops();
}

function injectLevelHUD() {
  if (!document.getElementById('hud-level-item')) {
    const hud = document.getElementById('hud');
    const levelDiv = document.createElement('div');
    levelDiv.className = 'hud-item';
    levelDiv.id = 'hud-level-item';
    levelDiv.innerHTML = '<span class="label">STAGE:</span><span class="val" id="hud-level">1</span>';
    hud.insertBefore(levelDiv, hud.querySelector('button'));
  }
}

function startLoops() {
  stopLoops();
  gameLoopInterval = setInterval(gameLoop, 1000/60);
  timerInterval    = setInterval(() => {
    if (!gameState.isPlaying) return;
    gameState.timeElapsed++;
    document.getElementById('hud-time').textContent = gameState.timeElapsed + 's';
    
    if (Date.now() - gameState.lastKillTime > 3000) {
      gameState.combo = 0;
    }
  }, 1000);
  enemyInterval = setInterval(moveEnemies, Math.max(400, 800 - (gameState.level * 40)));
}

function stopLoops() {
  clearInterval(gameLoopInterval);
  clearInterval(timerInterval);
  clearInterval(enemyInterval);
}

function gameLoop() {
  if (!gameState.isPlaying) return;
  checkPlayerEnemyCollision();
  checkPlayerItemCollision();
  renderBoard();
}

// ── KEYBOARD ──
document.addEventListener('keydown', e => {
  if (!gameState.isPlaying) return;
  const map = {
    'ArrowUp':    [0,-1], 'w':[0,-1],
    'ArrowDown':  [0, 1], 's':[0, 1],
    'ArrowLeft':  [-1,0], 'a':[-1,0],
    'ArrowRight': [1, 0], 'd':[1, 0],
  };
  if (map[e.key]) { e.preventDefault(); movePlayer(...map[e.key]); }
  if (e.key === ' ') { e.preventDefault(); placeBomb(); }
});

function mobileMove(dx, dy) { if (gameState.isPlaying) movePlayer(dx, dy); }

function movePlayer(dx, dy) {
  const p = gameState.player;
  const now = Date.now();
  if (now - p.lastMoveTime < p.moveDelay) return;

  const nx = p.x + dx, ny = p.y + dy;
  if (nx<0||nx>=COLS||ny<0||ny>=ROWS) return;
  const cell = gameState.board[ny][nx];
  if (cell === WALL_SOLID || cell === WALL_BRICK) return;
  if (gameState.bombs.some(b => b.x===nx && b.y===ny)) return;
  
  p.x = nx; 
  p.y = ny;
  p.lastMoveTime = now;
}

// ── ENEMY MOVEMENT ──
const DIRS = [[1,0],[-1,0],[0,1],[0,-1]];
function moveEnemies() {
  if (!gameState.isPlaying) return;
  gameState.enemies.forEach(en => {
    for (let attempt = 0; attempt < 4; attempt++) {
      const d = DIRS[(en.dir + attempt) % 4];
      const nx = en.x + d[0], ny = en.y + d[1];
      if (nx<0||nx>=COLS||ny<0||ny>=ROWS) { en.dir = Math.floor(Math.random()*4); continue; }
      const cell = gameState.board[ny][nx];
      if (cell === EMPTY || cell === ITEM) {
        if (gameState.bombs.some(b=>b.x===nx&&b.y===ny)) { en.dir=Math.floor(Math.random()*4); continue; }
        en.x = nx; en.y = ny;
        if (attempt > 0) en.dir = (en.dir + attempt) % 4;
        break;
      }
      en.dir = Math.floor(Math.random()*4);
    }
    if (Math.random() < 0.20) en.dir = Math.floor(Math.random()*4);
  });
}

// ── BOMB ──
function placeBomb() {
  if (!gameState.isPlaying) return;
  const p = gameState.player;
  if (gameState.bombs.some(b => b.x===p.x && b.y===p.y)) return;
  const bomb = { x: p.x, y: p.y, id: Date.now() };
  gameState.bombs.push(bomb);
  setTimeout(() => explodeBomb(bomb), 2000);
}

function explodeBomb(bomb) {
  if (!gameState.isPlaying && !gameState.board) return;
  gameState.bombs = gameState.bombs.filter(b => b.id !== bomb.id);

  const radius = gameState.player.blastRadius;
  const blastCells = [{x: bomb.x, y: bomb.y}];

  DIRS.forEach(([dx, dy]) => {
    for (let i = 1; i <= radius; i++) {
      const bx = bomb.x + dx*i, by = bomb.y + dy*i;
      if (bx<0||bx>=COLS||by<0||by>=ROWS) break;
      const cell = gameState.board[by][bx];
      if (cell === WALL_SOLID) break;
      blastCells.push({x:bx, y:by});
      if (cell === WALL_BRICK) {
        gameState.board[by][bx] = EMPTY;
        if (Math.random() < 0.45) {
          const rand = Math.random();
          let type = 'score';
          if (rand < 0.25) type = 'radius';
          else if (rand < 0.45) type = 'speed';
          else if (rand < 0.55) type = 'heart';
          
          gameState.items.push({x:bx, y:by, type: type});
          gameState.board[by][bx] = ITEM;
        }
        break;
      }
    }
  });

  blastCells.forEach(({x,y}) => {
    const div = document.createElement('div');
    div.className = 'cell entity-explosion';
    div.style.left = (x * CELL_SIZE) + 'px';
    div.style.top  = (y * CELL_SIZE) + 'px';
    div.style.width = CELL_SIZE + 'px';
    div.style.height = CELL_SIZE + 'px';
    document.getElementById('game-board').appendChild(div);
    setTimeout(() => div.remove(), 400);
  });

  const p = gameState.player;
  if (blastCells.some(c => c.x===p.x && c.y===p.y)) playerDie();

  let killedCount = 0;
  gameState.enemies = gameState.enemies.filter(en => {
    if (blastCells.some(c => c.x===en.x && c.y===en.y)) {
      killedCount++;
      return false;
    }
    return true;
  });

  if (killedCount > 0) {
    const now = Date.now();
    if (now - gameState.lastKillTime < 3000) {
      gameState.combo += killedCount;
    } else {
      gameState.combo = killedCount;
    }
    gameState.lastKillTime = now;
    
    gameState.score += (100 * killedCount) + (gameState.combo * 25);
    updateHUD();
  }

  if (gameState.enemies.length === 0) {
    if (gameState.level >= 5) {
      triggerVictory();
    } else {
      nextStage();
    }
  }
}

function nextStage() {
  gameState.level++;
  gameState.board = buildBoard();
  gameState.enemies = buildEnemies(gameState.level);
  gameState.bombs = [];
  gameState.items = [];
  gameState.player.x = 1;
  gameState.player.y = 1;
  
  updateHUD();
  renderBoard();
}

function checkPlayerEnemyCollision() {
  const p = gameState.player;
  if (gameState.enemies.some(en => en.x===p.x && en.y===p.y)) playerDie();
}

function checkPlayerItemCollision() {
  const p = gameState.player;
  gameState.items = gameState.items.filter(item => {
    if (item.x===p.x && item.y===p.y) {
      if (item.type === 'radius') { 
        p.blastRadius = Math.min(p.blastRadius+1, 6); 
      } else if (item.type === 'speed') {
        p.moveDelay = Math.max(70, p.moveDelay - 25);
      } else if (item.type === 'heart') {
        p.lives = Math.min(p.lives + 1, 5);
      } else { 
        gameState.score += 75; 
      }
      gameState.board[item.y][item.x] = EMPTY;
      updateHUD();
      return false;
    }
    return true;
  });
}

function playerDie() {
  const p = gameState.player;
  p.lives--;
  gameState.combo = 0;
  updateHUD();
  if (p.lives <= 0) { triggerGameOver(); return; }
  p.x = 1; p.y = 1;
}

function renderBoard() {
  const board = document.getElementById('game-board');
  board.innerHTML = '';

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.style.left = (c * CELL_SIZE) + 'px';
      cell.style.top  = (r * CELL_SIZE) + 'px';
      cell.style.width = CELL_SIZE + 'px';
      cell.style.height = CELL_SIZE + 'px';
      const v = gameState.board[r][c];
      if (v === WALL_SOLID) { cell.classList.add('cell-wall-solid'); }
      else if (v === WALL_BRICK) { cell.classList.add('cell-wall-brick'); }
      else { cell.classList.add('cell-floor'); }
      board.appendChild(cell);
    }
  }

  gameState.items.forEach(item => {
    const el = document.createElement('div');
    el.className = 'cell entity-item';
    el.style.left = (item.x * CELL_SIZE) + 'px';
    el.style.top  = (item.y * CELL_SIZE) + 'px';
    el.style.width = CELL_SIZE + 'px';
    el.style.height = CELL_SIZE + 'px';
    
    if (item.type === 'radius') el.textContent = '🔥';
    else if (item.type === 'speed') el.textContent = '⚡';
    else if (item.type === 'heart') el.textContent = '🧪';
    else el.textContent = '💎';
    
    board.appendChild(el);
  });

  gameState.bombs.forEach(bomb => {
    const el = document.createElement('div');
    el.className = 'cell entity-bomb';
    el.style.left = (bomb.x * CELL_SIZE) + 'px';
    el.style.top  = (bomb.y * CELL_SIZE) + 'px';
    el.style.width = CELL_SIZE + 'px';
    el.style.height = CELL_SIZE + 'px';
    el.textContent = '💣';
    board.appendChild(el);
  });

  gameState.enemies.forEach(en => {
    const el = document.createElement('div');
    el.className = 'cell entity-enemy';
    el.style.left = (en.x * CELL_SIZE) + 'px';
    el.style.top  = (en.y * CELL_SIZE) + 'px';
    el.style.width = CELL_SIZE + 'px';
    el.style.height = CELL_SIZE + 'px';
    el.textContent = '🐙'; 
    board.appendChild(el);
  });

  // MENAMPILKAN IKON AVATAR YANG DIPILIH SECARA DINAMIS
  const p = gameState.player;
  const pel = document.createElement('div');
  pel.className = 'cell entity-player';
  pel.style.left = (p.x * CELL_SIZE) + 'px';
  pel.style.top  = (p.y * CELL_SIZE) + 'px';
  pel.style.width = CELL_SIZE + 'px';
  pel.style.height = CELL_SIZE + 'px';
  pel.textContent = p.avatar; 
  board.appendChild(pel);
}

function updateHUD() {
  const p = gameState.player;
  const livesEl = document.getElementById('hud-lives');
  if (livesEl) {
    livesEl.innerHTML = '';
    for (let i=0; i < Math.max(3, p.lives); i++) {
      const h = document.createElement('span');
      h.className = 'life-icon';
      h.textContent = i < p.lives ? '💚' : '🖤'; 
      livesEl.appendChild(h);
    }
  }
  document.getElementById('hud-score').textContent = gameState.score;
  document.getElementById('hud-radius').textContent = p.blastRadius;
  
  const lvlEl = document.getElementById('hud-level');
  if (lvlEl) lvlEl.textContent = gameState.level;
}

function triggerGameOver(manual = false) {
  gameState.isPlaying = false;
  stopLoops();
  if (!manual) {
    saveScore();
    document.getElementById('go-score').innerHTML = `STAGE DICAPAI: ${gameState.level}<br><br>FINAL SKOR: ${gameState.score}<br>WAKTU: ${gameState.timeElapsed}s`;
    showScreen('gameover-screen');
  } else {
    goToMenu();
  }
}

function triggerVictory() {
  gameState.isPlaying = false;
  stopLoops();
  gameState.score += Math.max(0, 1000 - gameState.timeElapsed * 2);
  saveScore();
  document.getElementById('vc-score').innerHTML = `MISSION SUCCESS! 🎉<br><br>TOTAL SKOR: ${gameState.score}<br>TOTAL WAKTU: ${gameState.timeElapsed}s`;
  showScreen('victory-screen');
}

function saveScore() {
  try {
    const raw = localStorage.getItem('nekoboom_scores');
    const scores = raw ? JSON.parse(raw) : [];
    scores.push({ name: gameState.playerName, score: gameState.score, time: gameState.timeElapsed });
    scores.sort((a,b) => b.score - a.score);
    localStorage.setItem('nekoboom_scores', JSON.stringify(scores.slice(0,20)));
  } catch(e) {}
}

function renderScoreboard() {
  try {
    const raw = localStorage.getItem('nekoboom_scores');
    const scores = raw ? JSON.parse(raw) : [];
    const tbody = document.getElementById('lb-body');
    tbody.innerHTML = '';
    scores.slice(0,5).forEach((s,i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${i+1}</td><td>${s.name}</td><td>${s.score}</td><td>${s.time}s</td>`;
      tbody.appendChild(tr);
    });
    if (!scores.length) {
      tbody.innerHTML = '<tr><td colspan="4" style="color:#44495e;text-align:center;padding:12px;font-size:8px;">Belum ada skor mission</td></tr>';
    }
  } catch(e) {}
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function goToMenu() {
  stopLoops();
  gameState = {};
  renderScoreboard();
  showScreen('welcome-screen');
}

renderScoreboard();
