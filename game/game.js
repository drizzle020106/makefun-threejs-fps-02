// Tactical FPS — round-based, Counter-Strike-style, original map/art/names.
// Single-player vs bots. Static files only, no build step, no network requests.
// three.js 0.187.0 vendored locally at ./vendor/three.module.js
// Per-entry tuning (map name, seed, colours, team names) lives in ./config.js
import * as THREE from './vendor/three.module.js';
import { CONFIG } from './config.js';

window.addEventListener('error', (e) => {
  document.title = 'GAME_ERROR: ' + (e.message || 'unknown');
});

// ---------------------------------------------------------------- utilities
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const DEMO = params.get('demo') === '1'; // autopilot camera, for screenshots

// ---------------------------------------------------------------- audio (synth, no files)
let AC = null;
function audio() {
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AC = null; } }
  if (AC && AC.state === 'suspended') AC.resume();
  return AC;
}
function tone(freq, dur, type, vol, slideTo) {
  const ac = audio(); if (!ac) return;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type || 'square'; o.frequency.setValueAtTime(freq, ac.currentTime);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ac.currentTime + dur);
  g.gain.setValueAtTime(vol || 0.08, ac.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
  o.connect(g).connect(ac.destination); o.start(); o.stop(ac.currentTime + dur);
}
function noiseBurst(dur, vol, cutoff) {
  const ac = audio(); if (!ac) return;
  const len = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ac.createBufferSource(); src.buffer = buf;
  const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff || 1800;
  const g = ac.createGain(); g.gain.value = vol || 0.15;
  src.connect(f).connect(g).connect(ac.destination); src.start();
}
const sfx = {
  shoot: () => noiseBurst(0.09, 0.16, 2400),
  enemyShoot: () => noiseBurst(0.07, 0.05, 1200),
  hit: () => tone(1400, 0.06, 'sine', 0.10),
  kill: () => { tone(660, 0.08, 'sine', 0.10); setTimeout(() => tone(990, 0.12, 'sine', 0.10), 70); },
  hurt: () => tone(180, 0.15, 'sawtooth', 0.10, 90),
  reload: () => tone(500, 0.08, 'square', 0.05),
  buy: () => tone(880, 0.08, 'sine', 0.09),
  roundWin: () => { [523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'sine', 0.10), i * 110)); },
  roundLose: () => { [392, 330, 262].forEach((f, i) => setTimeout(() => tone(f, 0.2, 'sine', 0.09), i * 120)); },
  capture: () => tone(1200, 0.1, 'sine', 0.08),
};

// ---------------------------------------------------------------- weapons
const WEAPONS = {
  p2000:   { name: 'P2000 Sidearm', price: 0,    damage: 26, interval: 0.26, mag: 12, reserve: 48,  spread: 0.014, auto: false, zoom: false },
  hornet:  { name: 'Hornet SMG',    price: 600,  damage: 22, interval: 0.095, mag: 30, reserve: 120, spread: 0.032, auto: true,  zoom: false },
  longbow: { name: 'Longbow Rifle', price: 2700, damage: 34, interval: 0.12, mag: 25, reserve: 100, spread: 0.009, auto: true,  zoom: false },
  deadeye: { name: 'Deadeye Sniper',price: 4750, damage: 88, interval: 1.10, mag: 5,  reserve: 20,  spread: 0.002, auto: false, zoom: true },
};
const ARMOR_PRICE = 650;

// ---------------------------------------------------------------- three.js scene
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color(CONFIG.sky);
scene.fog = new THREE.Fog(CONFIG.sky, 45, 150);
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 300);
scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7a5a, 0.95));
const sun = new THREE.DirectionalLight(0xfff2d0, 1.6);
sun.position.set(30, 55, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -55; sun.shadow.camera.right = 55;
sun.shadow.camera.top = 55; sun.shadow.camera.bottom = -55;
scene.add(sun);

const WALLS = [];   // {minX,maxX,minZ,maxZ} colliders
const WALL_MESHES = [];
const SHOOTABLES = []; // meshes raycast can hit: walls + bot bodies
function addBox(x, z, w, d, h, color, opts) {
  const o = opts || {};
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0.05 }));
  m.position.set(x, h / 2 + (o.y || 0), z);
  m.castShadow = true; m.receiveShadow = true;
  scene.add(m);
  if (!o.noCollide) WALLS.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
  if (!o.noShoot) { m.userData.kind = 'wall'; WALL_MESHES.push(m); SHOOTABLES.push(m); }
  return m;
}
function labelSprite(text, color) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 96;
  const g = cv.getContext('2d');
  g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(0, 0, 256, 96);
  g.strokeStyle = color; g.lineWidth = 6; g.strokeRect(4, 4, 248, 88);
  g.fillStyle = '#ffffff'; g.font = 'bold 52px sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 128, 52);
  const tex = new THREE.CanvasTexture(cv);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sp.scale.set(10, 3.75, 1);
  return sp;
}

// Ground
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(110, 110),
  new THREE.MeshStandardMaterial({ color: CONFIG.ground, roughness: 1 }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
scene.add(ground);
// Ground grid lines for orientation
const grid = new THREE.GridHelper(100, 25, 0x000000, 0x000000);
grid.material.transparent = true; grid.material.opacity = 0.08;
grid.position.y = 0.02; scene.add(grid);

// Map layout (seeded, differs per entry via CONFIG.seed)
const rng = mulberry32(CONFIG.seed);
const MAP = 40; // half-extent of playable area
// Perimeter
addBox(0, -MAP - 1, 2 * MAP + 4, 2, 4, CONFIG.wall);
addBox(0, MAP + 1, 2 * MAP + 4, 2, 4, CONFIG.wall);
addBox(-MAP - 1, 0, 2, 2 * MAP + 4, 4, CONFIG.wall);
addBox(MAP + 1, 0, 2, 2 * MAP + 4, 4, CONFIG.wall);
// Mid wall with two gaps (x = 0 line, gaps at z = -14 and z = +16)
addBox(0, -30, 2, 20, 3.6, CONFIG.wall);
addBox(0, 2, 2, 12, 3.6, CONFIG.wall);
addBox(0, 30, 2, 20, 3.6, CONFIG.wall);
// Site cover walls
addBox(24, -24, 2, 16, 3.2, CONFIG.wall);
addBox(24, 24, 2, 16, 3.2, CONFIG.wall);
addBox(-20, -8, 14, 2, 3.0, CONFIG.wall);
addBox(-20, 10, 14, 2, 3.0, CONFIG.wall);
// Seeded crates (positions differ per entry)
const crateColors = [CONFIG.crateA, CONFIG.crateB];
const crates = [];
for (let i = 0; i < 16; i++) {
  const x = -34 + rng() * 68, z = -34 + rng() * 68;
  if (Math.abs(x) < 6 && Math.abs(z) < 6) continue;              // keep mid clear
  if (x < -30 || x > 30) continue;                               // keep spawns clear
  if (Math.hypot(x - 28, z + 24) < 9 || Math.hypot(x - 28, z - 24) < 9) continue; // keep sites clear
  const s = 1.6 + rng() * 1.8, h = 1.2 + rng() * 1.6;
  addBox(x, z, s, s, h, crateColors[i % 2]);
  crates.push([x, z]);
}
// Sites
const SITES = {
  A: { x: 30, z: -24, color: 0xffb020 },
  B: { x: 30, z: 24, color: 0x20c0ff },
};
for (const key of Object.keys(SITES)) {
  const s = SITES[key];
  const zone = new THREE.Mesh(
    new THREE.CircleGeometry(5, 32),
    new THREE.MeshBasicMaterial({ color: s.color, transparent: true, opacity: 0.28 }));
  zone.rotation.x = -Math.PI / 2; zone.position.set(s.x, 0.05, s.z);
  scene.add(zone);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(4.8, 5.3, 40),
    new THREE.MeshBasicMaterial({ color: s.color, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(s.x, 0.06, s.z);
  scene.add(ring);
  const lab = labelSprite('SITE ' + key, '#' + s.color.toString(16).padStart(6, '0'));
  lab.scale.set(8, 3, 1);
  lab.position.set(s.x, 6.5, s.z);
  scene.add(lab);
}
// Spawn markers (no floating team labels: a big depthTest-false sprite at
// spawn sits right in front of the camera and blocks the view)
const spawnA = { x: -34, z: 0 }, spawnB = { x: 34, z: 0 };

// Viewmodel gun
const gun = new THREE.Group();
const gunBody = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.55),
  new THREE.MeshStandardMaterial({ color: 0x22242a, roughness: 0.4, metalness: 0.7 }));
const gunBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 8),
  new THREE.MeshStandardMaterial({ color: 0x111214, roughness: 0.3, metalness: 0.8 }));
gunBarrel.rotation.x = Math.PI / 2; gunBarrel.position.set(0, 0.02, -0.4);
const gunSight = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.06, 0.08),
  new THREE.MeshStandardMaterial({ color: 0x111214 }));
gunSight.position.set(0, 0.1, -0.1);
gun.add(gunBody, gunBarrel, gunSight);
gun.scale.setScalar(0.8);
gun.position.set(0.26, -0.24, -0.6);
camera.add(gun);
scene.add(camera);
// Muzzle flash quad
const flash = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3),
  new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0 }));
flash.position.set(0, 0.02, -0.62);
gun.add(flash);

// ---------------------------------------------------------------- game state
const WIN_ROUNDS = 5, MAX_ROUNDS = 9, ROUND_TIME = 100, BUY_TIME = 18, CAPTURE_TIME = 6;
const TEAM_A = { name: CONFIG.teamA, color: CONFIG.teamAColor, spawn: spawnA };
const TEAM_B = { name: CONFIG.teamB, color: CONFIG.teamBColor, spawn: spawnB };
const BOT_NAMES_A = ['Falcon', 'Iris', 'Juno'];
const BOT_NAMES_B = ['Viper', 'Onyx', 'Rook'];

const state = {
  phase: 'menu', // menu | buy | playing | roundEnd | over
  round: 1,
  score: { A: 0, B: 0 },
  timer: ROUND_TIME,
  buyTimer: BUY_TIME,
  capture: 0,
  activeSite: 'A',
  attackers: 'A', // team key attacking this round
  kills: { A: 0, B: 0 },
  paused: false,
  demoCam: 0,
};

const player = {
  isPlayer: true, team: 'A', name: 'You',
  pos: new THREE.Vector3(-34, 1.7, 0), yaw: -Math.PI / 2, pitch: 0,
  hp: 100, armor: 0, money: 800, alive: true,
  weapon: 'p2000', owned: { p2000: true },
  mag: 12, reserve: 48, reloading: false,
  lastShot: 0, speed: 5.4, kills: 0, deaths: 0,
  ai: { wp: null, strafe: 0, strafeT: 0, shootCd: 0 },
};
let bots = [];

function makeBot(team, name, idx) {
  const t = team === 'A' ? TEAM_A : TEAM_B;
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 1.05, 0.38),
    new THREE.MeshStandardMaterial({ color: t.color, roughness: 0.8 }));
  body.position.y = 0.85; body.castShadow = true;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34),
    new THREE.MeshStandardMaterial({ color: 0xd9a066, roughness: 0.8 }));
  head.position.y = 1.55; head.castShadow = true;
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.08, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x111111 }));
  visor.position.set(0, 1.58, 0.18);
  const gunM = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.7),
    new THREE.MeshStandardMaterial({ color: 0x1a1a1a }));
  gunM.position.set(0.25, 1.1, 0.3);
  g.add(body, head, visor, gunM);
  // health bar sprite (two planes billboarded via Sprite is simpler)
  const hpBg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x330000, depthTest: false }));
  hpBg.scale.set(1.1, 0.1, 1); hpBg.position.y = 2.0;
  const hpFg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x37d67a, depthTest: false }));
  hpFg.scale.set(1.1, 0.1, 1); hpFg.position.y = 2.0;
  g.add(hpBg, hpFg);
  scene.add(g);
  const bot = {
    isPlayer: false, team, name, idx, group: g, body, head,
    hpFg, hpBg,
    pos: new THREE.Vector3(t.spawn.x + (idx - 1) * 2.5, 0, t.spawn.z + (idx % 2 ? 3 : -3)),
    yaw: team === 'A' ? -Math.PI / 2 : Math.PI / 2,
    hp: 100, alive: true, weapon: idx === 0 ? 'longbow' : 'hornet',
    ai: { wp: null, strafe: 0, strafeT: 0, shootCd: 1 + Math.random(), repath: 0 },
    kills: 0, deaths: 0,
  };
  g.position.copy(bot.pos);
  body.userData = { kind: 'bot', bot }; head.userData = { kind: 'bot', bot };
  SHOOTABLES.push(body, head);
  return bot;
}
function spawnAll() {
  for (const b of bots) {
    scene.remove(b.group);
    for (const m of [b.body, b.head]) { const i = SHOOTABLES.indexOf(m); if (i >= 0) SHOOTABLES.splice(i, 1); }
  }
  bots = [];
  for (let i = 0; i < 2; i++) bots.push(makeBot('A', BOT_NAMES_A[i], i));
  for (let i = 0; i < 3; i++) bots.push(makeBot('B', BOT_NAMES_B[i], i));
  // reset player
  player.pos.set(spawnA.x, 1.7, spawnA.z + 2);
  player.yaw = -Math.PI / 2; player.pitch = 0;
  player.hp = 100; player.alive = true; player.reloading = false;
  player.mag = WEAPONS[player.weapon].mag;
  player.reserve = WEAPONS[player.weapon].reserve;
  for (const b of bots) {
    const t = b.team === 'A' ? TEAM_A : TEAM_B;
    b.pos.set(t.spawn.x + (b.idx - 1) * 2.5, 0, t.spawn.z + (b.idx % 2 ? 3 : -3));
    b.group.position.copy(b.pos);
    b.hp = 100; b.alive = true; b.group.visible = true;
    b.ai.wp = null; b.ai.shootCd = 1 + Math.random() * 2;
  }
}

// ---------------------------------------------------------------- collision + LOS
function collide(pos, r) {
  for (const w of WALLS) {
    const cx = clamp(pos.x, w.minX, w.maxX), cz = clamp(pos.z, w.minZ, w.maxZ);
    const dx = pos.x - cx, dz = pos.z - cz, d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 1e-6) { const d = Math.sqrt(d2); pos.x = cx + dx / d * r; pos.z = cz + dz / d * r; }
      else pos.x = w.maxX + r;
    }
  }
  pos.x = clamp(pos.x, -MAP + 0.5, MAP - 0.5);
  pos.z = clamp(pos.z, -MAP + 0.5, MAP - 0.5);
}
const _ray = new THREE.Raycaster();
function hasLOS(from, to) {
  const dir = new THREE.Vector3().subVectors(to, from);
  const dist = dir.length();
  if (dist < 0.1) return true;
  dir.normalize();
  _ray.set(from, dir); _ray.far = dist;
  const hits = _ray.intersectObjects(WALL_MESHES, false);
  return hits.length === 0;
}
function allCombatants() {
  const list = [player, ...bots];
  return list.filter((c) => c.alive);
}

// ---------------------------------------------------------------- shooting
const tracers = [];
function addTracer(from, to, color) {
  const geo = new THREE.BufferGeometry().setFromPoints([from.clone(), to.clone()]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: color || 0xffe08a, transparent: true, opacity: 0.9 }));
  scene.add(line);
  tracers.push({ line, ttl: 0.09 });
}
function damage(target, amount, attacker, weaponName) {
  if (!target.alive) return;
  let rest = amount;
  if (target.isPlayer && player.armor > 0) {
    const absorbed = Math.min(player.armor, rest * 0.5);
    player.armor -= absorbed; rest -= absorbed;
  }
  target.hp -= rest;
  if (target.isPlayer) {
    $('dmg').style.opacity = '0.55';
    setTimeout(() => { $('dmg').style.opacity = '0'; }, 120);
    sfx.hurt();
  } else {
    sfx.hit();
    $('hitmark').style.opacity = '1';
    setTimeout(() => { $('hitmark').style.opacity = '0'; }, 90);
    target.hpFg.scale.x = Math.max(0.01, 1.1 * target.hp / 100);
  }
  if (target.hp <= 0) kill(target, attacker, weaponName);
}
function kill(target, attacker, weaponName) {
  target.hp = 0; target.alive = false;
  if (target.isPlayer) { player.deaths++; }
  else {
    target.group.visible = false; target.deaths++;
    // remove corpse from the raycast list so it no longer blocks shots
    for (const m of [target.body, target.head]) {
      const i = SHOOTABLES.indexOf(m);
      if (i >= 0) SHOOTABLES.splice(i, 1);
    }
  }
  if (attacker) {
    attacker.kills++;
    if (attacker.isPlayer) {
      player.money += 300; sfx.kill();
      addKillfeed('You', target.name, weaponName);
    } else if (target.isPlayer) {
      addKillfeed(attacker.name, 'You', weaponName);
    } else {
      addKillfeed(attacker.name, target.name, weaponName);
    }
  }
  checkRoundEnd();
}
function playerShoot() {
  if (state.phase !== 'playing' || state.paused || !player.alive) return;
  const w = WEAPONS[player.weapon];
  const now = performance.now() / 1000;
  if (now - player.lastShot < w.interval) return;
  if (player.reloading) return;
  if (player.mag <= 0) { startReload(); return; }
  player.lastShot = now;
  player.mag--;
  sfx.shoot();
  flash.material.opacity = 0.95;
  setTimeout(() => { flash.material.opacity = 0; }, 45);
  player.pitch = clamp(player.pitch + 0.006, -1.5, 1.5);
  gun.position.z = -0.55; setTimeout(() => { gun.position.z = -0.6; }, 60);
  const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  dir.x += (Math.random() - 0.5) * w.spread * 2;
  dir.y += (Math.random() - 0.5) * w.spread * 2;
  dir.normalize();
  _ray.set(camera.position, dir); _ray.far = 150;
  const hits = _ray.intersectObjects(SHOOTABLES, false);
  let end = camera.position.clone().add(dir.clone().multiplyScalar(60));
  if (hits.length) {
    const h = hits[0];
    end = h.point.clone();
    if (h.object.userData.kind === 'bot') {
      const bot = h.object.userData.bot;
      if (bot.team !== player.team) damage(bot, w.damage * (0.9 + Math.random() * 0.2), player, w.name);
    }
  }
  const muzzle = new THREE.Vector3();
  gunBarrel.getWorldPosition(muzzle);
  addTracer(muzzle, end);
  updateHUD();
}
function startReload() {
  const w = WEAPONS[player.weapon];
  if (player.reloading || player.mag === w.mag || player.reserve <= 0) return;
  player.reloading = true;
  sfx.reload();
  setTimeout(() => {
    const need = w.mag - player.mag;
    const take = Math.min(need, player.reserve);
    player.mag += take; player.reserve -= take;
    player.reloading = false;
    updateHUD();
  }, 1200);
  updateHUD();
}
function botShoot(bot, target) {
  const w = WEAPONS[bot.weapon];
  const from = bot.pos.clone(); from.y = 1.5;
  const to = target.isPlayer
    ? new THREE.Vector3(player.pos.x, 1.4, player.pos.z)
    : new THREE.Vector3(target.pos.x, 1.2, target.pos.z);
  const dist = from.distanceTo(to);
  // accuracy falls off with distance
  const hitP = clamp(0.55 - dist * 0.008, 0.12, 0.55);
  const dir = new THREE.Vector3().subVectors(to, from).normalize();
  const end = to.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 2));
  addTracer(from, Math.random() < hitP ? to : end, 0xff9a7a);
  if (Math.random() < hitP) {
    damage(target, w.damage * (0.8 + Math.random() * 0.3), bot, w.name);
  }
  if (!target.isPlayer || Math.random() < 0.4) sfx.enemyShoot();
}

// ---------------------------------------------------------------- bot AI
const WAYPOINTS = [];
for (let gx = -30; gx <= 30; gx += 12) for (let gz = -30; gz <= 30; gz += 12) WAYPOINTS.push([gx, gz]);
function botThink(c, dt) {
  if (!c.alive) return;
  const ai = c.ai;
  // nearest visible enemy
  let enemy = null, best = 45;
  for (const o of allCombatants()) {
    if (o.team === c.team) continue;
    const from = c.isPlayer ? new THREE.Vector3(player.pos.x, 1.6, player.pos.z) : new THREE.Vector3(c.pos.x, 1.5, c.pos.z);
    const to = o.isPlayer ? new THREE.Vector3(player.pos.x, 1.4, player.pos.z) : new THREE.Vector3(o.pos.x, 1.2, o.pos.z);
    const d = from.distanceTo(to);
    if (d < best && hasLOS(from, to)) { best = d; enemy = o; }
  }
  const pos = c.isPlayer ? player.pos : c.pos;
  let moveX = 0, moveZ = 0, speed = 4.2;
  if (enemy) {
    const epos = enemy.isPlayer ? player.pos : enemy.pos;
    const dx = epos.x - pos.x, dz = epos.z - pos.z;
    const d = Math.hypot(dx, dz) || 1;
    c.yaw = Math.atan2(-dx, -dz);
    ai.strafeT -= dt;
    if (ai.strafeT <= 0) { ai.strafe = Math.random() < 0.5 ? -1 : 1; ai.strafeT = 0.7 + Math.random(); }
    // strafe perpendicular, drift closer if far
    const px = -dz / d * ai.strafe, pz = dx / d * ai.strafe;
    moveX = px * 0.8 + (d > 14 ? dx / d * 0.6 : 0);
    moveZ = pz * 0.8 + (d > 14 ? dz / d * 0.6 : 0);
    ai.shootCd -= dt;
    if (ai.shootCd <= 0 && d < 42) {
      botShoot(c, enemy);
      ai.shootCd = WEAPONS[c.weapon].interval * (6 + Math.random() * 6);
    }
  } else {
    if (!ai.wp || Math.hypot(ai.wp[0] - pos.x, ai.wp[1] - pos.z) < 2) {
      // attackers bias toward the active site
      if (c.team === state.attackers && Math.random() < 0.55) {
        const s = SITES[state.activeSite];
        ai.wp = [s.x + (Math.random() - 0.5) * 6, s.z + (Math.random() - 0.5) * 6];
      } else {
        ai.wp = WAYPOINTS[Math.floor(Math.random() * WAYPOINTS.length)];
      }
    }
    const dx = ai.wp[0] - pos.x, dz = ai.wp[1] - pos.z;
    const d = Math.hypot(dx, dz) || 1;
    moveX = dx / d; moveZ = dz / d;
    c.yaw = Math.atan2(-dx, -dz);
  }
  pos.x += moveX * speed * dt;
  pos.z += moveZ * speed * dt;
  collide(pos, 0.45);
  if (!c.isPlayer) {
    c.pos.y = 0;
    c.group.position.copy(c.pos);
    c.group.rotation.y = c.yaw + Math.PI;
  }
}

// ---------------------------------------------------------------- rounds
function startRound() {
  state.activeSite = state.round % 2 === 1 ? 'A' : 'B';
  state.attackers = state.round % 2 === 1 ? 'A' : 'B';
  state.capture = 0;
  state.timer = ROUND_TIME;
  state.phase = 'playing';
  state.paused = false;
  spawnAll();
  $('banner').style.display = 'none';
  $('buy').style.display = 'none';
  $('hud').style.display = 'block';
  showBanner('ROUND ' + state.round + ' — ' + (state.attackers === 'A' ? CONFIG.teamA + ' attacks Site ' + state.activeSite : CONFIG.teamB + ' attacks Site ' + state.activeSite));
  updateHUD();
}
function startBuyPhase(first) {
  state.phase = 'buy';
  state.buyTimer = BUY_TIME;
  $('buy').style.display = 'block';
  $('hud').style.display = 'block';
  document.exitPointerLock && document.exitPointerLock();
  renderBuy();
  updateHUD();
}
function endRound(winner, reason) {
  if (state.phase !== 'playing') return;
  state.phase = 'roundEnd';
  state.score[winner]++;
  const won = winner === 'A';
  if (won) { player.money += 325; sfx.roundWin(); }
  else { player.money += 190; sfx.roundLose(); }
  if (state.attackers === 'A' && won) player.money += 300; // capture/attack bonus handled in money too
  showBanner((won ? CONFIG.teamA : CONFIG.teamB) + ' wins the round — ' + reason);
  updateHUD();
  setTimeout(() => {
    if (state.score.A >= WIN_ROUNDS || state.score.B >= WIN_ROUNDS || state.round >= MAX_ROUNDS) {
      endGame();
    } else {
      state.round++;
      startBuyPhase();
    }
  }, 3500);
}
function endGame() {
  state.phase = 'over';
  document.exitPointerLock && document.exitPointerLock();
  const a = state.score.A, b = state.score.B;
  const title = a > b ? CONFIG.teamA + ' WIN THE MATCH' : b > a ? CONFIG.teamB + ' WIN THE MATCH' : 'DRAW';
  $('overTitle').textContent = title;
  $('overScore').textContent = CONFIG.teamA + ' ' + a + ' — ' + b + ' ' + CONFIG.teamB +
    '  ·  Your kills: ' + player.kills + '  ·  Deaths: ' + player.deaths;
  $('over').style.display = 'flex';
  updateHUD();
}
function checkRoundEnd() {
  if (state.phase !== 'playing') return;
  const aAlive = allCombatants().some((c) => c.team === 'A');
  const bAlive = allCombatants().some((c) => c.team === 'B');
  if (!aAlive) endRound('B', 'team eliminated');
  else if (!bAlive) endRound('A', 'team eliminated');
}
function checkCapture(dt) {
  const s = SITES[state.activeSite];
  const atk = state.attackers, def = atk === 'A' ? 'B' : 'A';
  let atkIn = false, defIn = false;
  for (const c of allCombatants()) {
    const p = c.isPlayer ? player.pos : c.pos;
    if (Math.hypot(p.x - s.x, p.z - s.z) < 5) {
      if (c.team === atk) atkIn = true; else defIn = true;
    }
  }
  if (atkIn && !defIn) {
    state.capture += dt / CAPTURE_TIME;
    if (Math.random() < dt * 2) sfx.capture();
    if (state.capture >= 1) { endRound(atk, 'Site ' + state.activeSite + ' captured'); return; }
  } else if (defIn) {
    state.capture = Math.max(0, state.capture - dt / 3);
  }
  $('capFill').style.width = Math.round(state.capture * 100) + '%';
  $('capWrap').style.display = state.capture > 0.02 ? 'block' : 'none';
  $('capLabel').textContent = 'CAPTURING SITE ' + state.activeSite + ' — ' + (state.attackers === 'A' ? CONFIG.teamA : CONFIG.teamB);
}

// ---------------------------------------------------------------- HUD / DOM
function updateHUD() {
  $('hpFill').style.width = Math.max(0, player.hp) + '%';
  $('hpText').textContent = Math.max(0, Math.ceil(player.hp)) + ' HP' + (player.armor > 0 ? '  ·  ' + Math.ceil(player.armor) + ' ARMOR' : '');
  $('money').textContent = '$' + player.money;
  const w = WEAPONS[player.weapon];
  $('ammo').textContent = player.mag + ' / ' + player.reserve;
  $('wname').textContent = w.name + (player.reloading ? ' — RELOADING…' : '');
  $('score').textContent = CONFIG.teamA + ' ' + state.score.A + ' — ' + state.score.B + ' ' + CONFIG.teamB + '  ·  ROUND ' + state.round + '/' + MAX_ROUNDS;
  const aliveA = allCombatants().filter((c) => c.team === 'A').length;
  const aliveB = allCombatants().filter((c) => c.team === 'B').length;
  $('alive').textContent = 'ALIVE  ' + CONFIG.teamA + ' ' + aliveA + '  ·  ' + CONFIG.teamB + ' ' + aliveB;
  const t = Math.max(0, Math.ceil(state.timer));
  $('timer').textContent = Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
}
function showBanner(text) {
  const b = $('banner');
  b.textContent = text;
  b.style.display = 'block';
  clearTimeout(showBanner._t);
  showBanner._t = setTimeout(() => { b.style.display = 'none'; }, 3200);
}
function addKillfeed(a, b, weapon) {
  const kf = $('killfeed');
  const div = document.createElement('div');
  div.textContent = a + '  ▸  ' + b + '   [' + weapon + ']';
  kf.prepend(div);
  while (kf.children.length > 5) kf.removeChild(kf.lastChild);
  setTimeout(() => { if (div.parentNode) div.parentNode.removeChild(div); }, 6000);
}
function renderBuy() {
  const list = $('buyList');
  list.innerHTML = '';
  for (const key of Object.keys(WEAPONS)) {
    const w = WEAPONS[key];
    const owned = !!player.owned[key];
    const div = document.createElement('div');
    div.className = 'buyItem' + (player.weapon === key ? ' equipped' : '');
    div.innerHTML = '<b>' + w.name + '</b><span>$' + w.price + ' · DMG ' + w.damage + ' · MAG ' + w.mag + (owned ? ' · OWNED' : '') + '</span>';
    div.onclick = () => {
      if (!owned) {
        if (player.money < w.price) { div.style.borderColor = '#ff5a4d'; return; }
        player.money -= w.price; player.owned[key] = true; sfx.buy();
      }
      player.weapon = key;
      player.mag = w.mag; player.reserve = w.reserve; player.reloading = false;
      renderBuy(); updateHUD();
    };
    list.appendChild(div);
  }
  const armor = document.createElement('div');
  armor.className = 'buyItem';
  armor.innerHTML = '<b>Kevlar Vest</b><span>$' + ARMOR_PRICE + ' · +50 armor' + (player.armor > 0 ? ' · WORN' : '') + '</span>';
  armor.onclick = () => {
    if (player.money < ARMOR_PRICE || player.armor >= 50) return;
    player.money -= ARMOR_PRICE; player.armor = 50; sfx.buy();
    renderBuy(); updateHUD();
  };
  list.appendChild(armor);
  $('buyMoney').textContent = 'Money: $' + player.money + '  ·  Buy phase ends in ' + Math.ceil(state.buyTimer) + 's — press B to close';
}

// ---------------------------------------------------------------- input
const keys = {};
addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'KeyR' && state.phase === 'playing') startReload();
  if (e.code === 'Digit1') equipOwned('p2000');
  if (e.code === 'Digit2') equipOwned('hornet');
  if (e.code === 'Digit3') equipOwned('longbow');
  if (e.code === 'Digit4') equipOwned('deadeye');
  if (e.code === 'KeyB' && (state.phase === 'buy' || state.phase === 'playing')) toggleBuy();
  if (e.code === 'KeyP' && state.phase === 'playing') togglePause();
  if (e.code === 'Enter' && state.phase === 'menu') startGame();
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
function equipOwned(key) {
  if (player.owned[key] && state.phase === 'playing' && !player.reloading) {
    player.weapon = key;
    player.mag = WEAPONS[key].mag; player.reserve = WEAPONS[key].reserve;
    updateHUD();
  }
}
function toggleBuy() {
  if (state.phase === 'buy') { $('buy').style.display = 'none'; state.phase = 'playing'; lockPointer(); }
  else if (state.phase === 'playing') { state.phase = 'buy'; state.buyTimer = Math.max(state.buyTimer, 8); $('buy').style.display = 'block'; document.exitPointerLock && document.exitPointerLock(); renderBuy(); }
}
function togglePause() {
  state.paused = !state.paused;
  $('pause').style.display = state.paused ? 'flex' : 'none';
  if (state.paused) document.exitPointerLock && document.exitPointerLock();
  else lockPointer();
}
function lockPointer() {
  if (DEMO) return;
  try { canvas.requestPointerLock(); } catch (e) { /* pointer lock unavailable */ }
}
document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && state.phase === 'playing' && !state.paused && !DEMO && player.alive) {
    // user pressed Esc: pause the game
    state.paused = true;
    $('pause').style.display = 'flex';
  }
});
document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== canvas || state.paused) return;
  player.yaw -= e.movementX * 0.0022;
  player.pitch = clamp(player.pitch - e.movementY * 0.0022, -1.5, 1.5);
});
let mouseDown = false;
canvas.addEventListener('mousedown', (e) => {
  if (state.phase !== 'playing' || state.paused) return;
  if (document.pointerLockElement !== canvas && !DEMO) { lockPointer(); return; }
  if (e.button === 0) { mouseDown = true; playerShoot(); }
  if (e.button === 2 && WEAPONS[player.weapon].zoom) {
    camera.fov = 32; camera.updateProjectionMatrix();
  }
});
addEventListener('mouseup', (e) => {
  if (e.button === 0) mouseDown = false;
  if (e.button === 2) { camera.fov = 75; camera.updateProjectionMatrix(); }
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
$('startBtn').onclick = () => startGame();
$('resumeBtn').onclick = () => togglePause();
$('restartBtn').onclick = () => location.reload();
$('overRestart').onclick = () => location.reload();
$('closeBuy').onclick = () => { if (state.phase === 'buy') toggleBuy(); };

function startGame() {
  audio();
  $('menu').style.display = 'none';
  state.round = 1; state.score = { A: 0, B: 0 };
  player.money = 800; player.weapon = 'p2000'; player.owned = { p2000: true };
  player.armor = 0; player.kills = 0; player.deaths = 0;
  $('over').style.display = 'none';
  $('killfeed').innerHTML = '';
  lockPointer();
  startBuyPhase(true);
}

// ---------------------------------------------------------------- main loop
const clock = new THREE.Clock();
let bobT = 0;
function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);
  const now = performance.now() / 1000;

  if (state.phase === 'buy') {
    state.buyTimer -= dt;
    $('buyMoney').textContent = 'Money: $' + player.money + '  ·  Buy phase ends in ' + Math.max(0, Math.ceil(state.buyTimer)) + 's — press B to close';
    if (state.buyTimer <= 0) {
      $('buy').style.display = 'none';
      state.phase = 'playing';
      lockPointer();
    }
  }

  if (state.phase === 'playing' && !state.paused) {
    state.timer -= dt;
    if (state.timer <= 0) { endRound(state.attackers === 'A' ? 'B' : 'A', 'time expired — defenders hold'); }
    else {
      // player movement (keyboard) or autopilot in demo
      if (DEMO) {
        botThink(player, dt);
        player.hp = Math.max(player.hp, 100); // demo camera never dies mid-screenshot
      } else if (player.alive) {
        const sprint = keys['ShiftLeft'] || keys['ShiftRight'];
        const sp = player.speed * (sprint ? 1.35 : 1);
        let fx = 0, fz = 0;
        if (keys['KeyW']) fz -= 1;
        if (keys['KeyS']) fz += 1;
        if (keys['KeyA']) fx -= 1;
        if (keys['KeyD']) fx += 1;
        const len = Math.hypot(fx, fz) || 1;
        const sin = Math.sin(player.yaw), cos = Math.cos(player.yaw);
        // delta = forward * (-fz) + right * fx, forward = (-sin, -cos), right = (cos, -sin)
        player.pos.x += ((sin * fz + cos * fx) / len) * sp * dt * (fx || fz ? 1 : 0);
        player.pos.z += ((cos * fz - sin * fx) / len) * sp * dt * (fx || fz ? 1 : 0);
        collide(player.pos, 0.45);
        if ((fx || fz) && now - (tick._bob || 0) > 0.05) { bobT += dt * 9; tick._bob = now; }
        if (mouseDown && WEAPONS[player.weapon].auto) playerShoot();
      }
      for (const b of bots) botThink(b, dt);
      checkCapture(dt);
    }
    updateHUD();
  }

  // camera
  if (DEMO) {
    // third-person follow cam behind the player bot
    const back = 7, up = 3.2;
    const cx = player.pos.x + Math.sin(player.yaw) * back;
    const cz = player.pos.z + Math.cos(player.yaw) * back;
    camera.position.set(cx, player.pos.y + up, cz);
    camera.lookAt(player.pos.x, 1.6, player.pos.z);
  } else {
    camera.position.copy(player.pos);
    camera.position.y = 1.7 + Math.sin(bobT) * 0.04;
    camera.rotation.order = 'YXZ';
    camera.rotation.y = player.yaw;
    camera.rotation.x = player.pitch;
  }

  // tracers fade
  for (let i = tracers.length - 1; i >= 0; i--) {
    const t = tracers[i];
    t.ttl -= dt;
    t.line.material.opacity = Math.max(0, t.ttl / 0.09) * 0.9;
    if (t.ttl <= 0) { scene.remove(t.line); t.line.geometry.dispose(); tracers.splice(i, 1); }
  }
  // capture ring pulse
  const s = SITES[state.activeSite];
  renderer.render(scene, camera);
}
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// boot
$('mapName').textContent = CONFIG.mapName;
$('mapSub').textContent = CONFIG.teamA + ' vs ' + CONFIG.teamB + '  ·  First to ' + WIN_ROUNDS + ' rounds  ·  ' + CONFIG.tagline;
$('menuTitle').textContent = CONFIG.mapName;
document.title = CONFIG.mapName + ' — Tactical FPS';
spawnAll();
if (DEMO) {
  $('menu').style.display = 'none';
  $('hud').style.display = 'block';
  state.round = 1;
  startRound();
} else {
  state.phase = 'menu';
}
updateHUD();
tick();
