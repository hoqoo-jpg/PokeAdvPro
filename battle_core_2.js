/**
 * ============================================================================
 * battle_core_2.js (Part 1 / 2)
 * 8分鐘快節奏戰鬥引擎核心、動態虛擬搖桿、三態戰術大招、腳底環形倒數規、
 * 涉水下沉水花、草地碎葉反饋、怪獸體重抗性、Boss 多重招式輪換與 60FPS 遊戲主循環
 * ============================================================================
 */

window.GameApp = {
  canvas: null,
  ctx: null,
  width: window.innerWidth,
  height: window.innerHeight,
  state: "LOADING",
  timeScale: 1,

  // 天氣測試鎖定開關、瞄準模式、壓力測試與 FPS 監控
  debugWeatherLock: false,
  manualAimMode: false,
  currentFps: 60,
  showFpsHud: false,
  debugGodMode: false,
  debugMobCap: 0,

  // 存檔基礎骨架 (詳細資料結構由 game_ui.js 接管同步)
  saveData: {
    coins: 800,
    unlockedPokemon: { 1: true, 4: true, 7: true, 10: true, 16: true, 25: true },
    unlockedTrainers: { ash: true, misty: true, brock: true },
    upgrades: { atk: 0, cd: 0, hp: 0, shiny: 0, fourthSlot: 0, rerollCount: 0, trainerCd: 0, partner: 0, greed: 0 },
    pokemonStars: {},
    stats: { totalKills: 0, evolutions: 0, superMoves: 0, birdsDefeated: 0, mewtwoDefeated: 0, mewDefeated: 0 },
    pokedexSeen: { 1: true, 4: true, 7: true, 10: true, 16: true, 25: true, 133: true },
    pokedexCaught: { 1: true, 4: true, 7: true, 10: true, 16: true, 25: true },
    pokedexRewardClaimed: {},
    shinyUnlocked: { 25: true },
    claimedAch: {},
    settings: {
      mobCapProfile: "auto",
      screenFilter: "none",
      dmgTextMode: "all",
      screenShake: "normal"
    }
  },
  spatialGrid: null,
  _frameCounter: 0,

  // 戰鬥實體
  player: null,
  trainerCompanion: null,
  partners: [],
  partnerOrbitBase: 0,
  camera: { x: 0, y: 0, shakeTime: 0, shakeMagnitude: 0 },
  hitStopTimer: 0,
  killSlowmoTimer: 0,

  enemies: [],
  particles: [],
  floatingTexts: [],
  gems: [],
  mapItems: [],
  lavaFootprints: [],
  activeBoss: null,
  telegraphs: [],
  enemyProjectiles: [],

  // 8 分鐘快局時間軸
  runTime: 0,
  spawnTimer: 0,
  eliteSpawnTimer: 45,
  treasureSpawnTimer: 38,
  magnetSpawnTimer: 35,
  birdBossSpawned: false,
  mewtwoBossSpawned: false,
  secretMewSpawned: false,
  kills: 0,
  runCoins: 0,

  // 招式傷害統計面板 (DPS Breakdown)
  skillDamageStats: {},

  // 輸入系統
  keys: {},
  touchJoy: {
    active: false,
    touchId: null,
    startX: 0,
    startY: 0,
    currX: 0,
    currY: 0,
    dx: 0,
    dy: 0,
    maxRadius: 48
  },

  init() {
    this.canvas = document.getElementById("gameCanvas");
    this.ctx = this.canvas.getContext("2d");
    if (this.loadSaveData) this.loadSaveData();
    this.resize();
    window.addEventListener("resize", () => this.resize());
    this.bindInputs();
    this.bindTouchJoystick();

    if (this.updateTitleUI) this.updateTitleUI();
    this.lastFrameTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
    if (this.runAssetPreloader) this.runAssetPreloader();
  },

  dpr: 1,

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    const maxDpr = this.isMobileDevice() ? 1.5 : 2.0;
    const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    this.dpr = dpr;
    this._pauseFrameRendered = false;
    this.canvas.width = Math.round(this.width * dpr);
    this.canvas.height = Math.round(this.height * dpr);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    if (this.ctx) {
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.ctx.imageSmoothingEnabled = false;
      this.ctx.webkitImageSmoothingEnabled = false;
    }
  },

  bindInputs() {
    window.addEventListener("keydown", (e) => {
      // 升級三選一視窗開啟時：支援頂層 1, 2, 3 與 R 鍵立即觸發
      const lvlModal = document.getElementById("levelUpModal");
      if (lvlModal && !lvlModal.classList.contains("hidden")) {
        if (e.key === "1") { e.preventDefault(); e.stopPropagation(); this.selectUpgradeChoice(0); return; }
        if (e.key === "2") { e.preventDefault(); e.stopPropagation(); this.selectUpgradeChoice(1); return; }
        if (e.key === "3") { e.preventDefault(); e.stopPropagation(); this.selectUpgradeChoice(2); return; }
        if (e.key === "r" || e.key === "R") { e.preventDefault(); e.stopPropagation(); this.rerollUpgradeChoices(); return; }
      }

      if (this.state === "SPLASH") {
        if (this.enterLobbyFromSplash) this.enterLobbyFromSplash();
        return;
      }
      const k = e.key.toLowerCase();
      this.keys[k] = true;
      if (e.code === "Tab" && this.state === "PLAYING") {
        e.preventDefault();
        this.toggleAimMode();
        return;
      }
      if (e.code === "Space" && this.state === "PLAYING") {
        e.preventDefault();
        this.triggerTrainerActiveSkill();
      }
      if ((k === "e" || k === "E") && this.state === "PLAYING") {
        const mart = this.mapItems.find(it => it.id === "poke_mart");
        if (mart && Math.hypot(this.player.x - mart.x, this.player.y - mart.y) < 75) {
          e.preventDefault();
          this.openPokeMartModal();
        }
      }
      if (e.key === "Escape" && (this.state === "PLAYING" || this.state === "PAUSED")) {
        this.togglePause();
      }
    }, true); // 使用 capture 捕獲階段，防止子元素搶焦點
    window.addEventListener("keyup", (e) => {
      this.keys[e.key.toLowerCase()] = false;
    });
  },

  bindTouchJoystick() {
    const joyBase = document.getElementById("touchJoyBase");
    const joyStick = document.getElementById("touchJoyStick");
    const skillBtn = document.getElementById("btnTrainerActiveSkill");

    const onTouchStart = (e) => {
      if (this.state !== "PLAYING") return;
      SoundFX.init();

      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (skillBtn) {
          const rect = skillBtn.getBoundingClientRect();
          if (t.clientX >= rect.left - 20 && t.clientX <= rect.right + 20 &&
              t.clientY >= rect.top - 20 && t.clientY <= rect.bottom + 20) {
            continue;
          }
        }

        if (t.clientX < this.width * 0.70 && !this.touchJoy.active) {
          this.touchJoy.active = true;
          this.touchJoy.touchId = t.identifier;
          this.touchJoy.startX = t.clientX;
          this.touchJoy.startY = t.clientY;
          this.touchJoy.currX = t.clientX;
          this.touchJoy.currY = t.clientY;
          this.touchJoy.dx = 0;
          this.touchJoy.dy = 0;

          joyBase.style.left = `${t.clientX}px`;
          joyBase.style.top = `${t.clientY}px`;
          joyBase.classList.remove("hidden");
          joyBase.style.display = "block";

          joyStick.style.left = `${t.clientX}px`;
          joyStick.style.top = `${t.clientY}px`;
          joyStick.classList.remove("hidden");
          joyStick.style.display = "block";
          break;
        }
      }
    };

    const onTouchMove = (e) => {
      if (!this.touchJoy.active) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === this.touchJoy.touchId) {
          e.preventDefault(); // 強制阻止 iOS Safari 彈簧橡皮筋滾動，避免觸發 touchcancel
          const distX = t.clientX - this.touchJoy.startX;
          const distY = t.clientY - this.touchJoy.startY;
          const len = Math.hypot(distX, distY);
          const maxR = this.touchJoy.maxRadius;

          if (len > 0) {
            const clamp = Math.min(len, maxR);
            this.touchJoy.dx = (distX / len) * (clamp / maxR);
            this.touchJoy.dy = (distY / len) * (clamp / maxR);
            this.touchJoy.currX = this.touchJoy.startX + (distX / len) * clamp;
            this.touchJoy.currY = this.touchJoy.startY + (distY / len) * clamp;
          }
          joyStick.style.left = `${this.touchJoy.currX}px`;
          joyStick.style.top = `${this.touchJoy.currY}px`;
          break;
        }
      }
    };

    const resetJoy = () => {
      this.touchJoy.active = false;
      this.touchJoy.touchId = null;
      this.touchJoy.dx = 0;
      this.touchJoy.dy = 0;
      if (joyBase) {
        joyBase.classList.add("hidden");
        joyBase.style.display = "none";
      }
      if (joyStick) {
        joyStick.classList.add("hidden");
        joyStick.style.display = "none";
      }
    };

    const onTouchEnd = (e) => {
      if (!this.touchJoy.active) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === this.touchJoy.touchId) {
          resetJoy();
          break;
        }
      }
    };

    window.addEventListener("touchstart", onTouchStart, { passive: false });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", () => resetJoy(), { passive: true }); // 防死鎖徹底重置

    // 解決移動中無法點擊大招：綁定原生 touchstart 支援多點觸控
    if (skillBtn) {
      skillBtn.addEventListener("touchstart", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.triggerTrainerActiveSkill();
      }, { passive: false });
    }

    // 手機端多點觸控委派：確保左手按住虛擬搖桿時，右手點擊頂部功能按鈕能即刻執行
    const topHudBtns = document.querySelectorAll("#hudLayer .pointer-events-auto button");
    topHudBtns.forEach(btn => {
      btn.addEventListener("touchstart", (e) => {
        e.preventDefault();
        e.stopPropagation();
        btn.click();
      }, { passive: false });
    });

    // 解決 iOS 搖桿卡死與畫面被誤縮放放大：徹底攔截 Safari 雙指手勢與快速雙擊放大
    document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
    document.addEventListener('gesturechange', (e) => e.preventDefault(), { passive: false });
    document.addEventListener('gestureend', (e) => e.preventDefault(), { passive: false });

    let lastTouchEnd = 0;
    document.addEventListener('touchend', (e) => {
      const now = performance.now();
      if (now - lastTouchEnd <= 300) {
        e.preventDefault();
      }
      lastTouchEnd = now;
    }, { passive: false });
  },

  // 開發者測試工具全套實裝
  toggleDebugMenu() {
    const menu = document.getElementById("debugDropdown");
    if (menu) menu.classList.toggle("hidden");
  },

  debugSetWeather(weatherType) {
    if (typeof MapEngine !== "undefined") {
      this.debugWeatherLock = true;
      MapEngine.setWeather(weatherType);
      this.updateWeatherUI(weatherType);
      this.spawnFloatingText(this.player.x, this.player.y - 30, `天候切換: ${weatherType}`, "#38BDF8", 14);
    }
  },

  debugForceLevelUp() {
    if (!this.player) return;
    for (let i = 0; i < 5; i++) {
      this.player.level += 1;
      if (this.player.data.evo_level !== "None" && this.player.level >= this.player.data.evo_level) {
        if (this.player.id === 133) {
          this.state = "PAUSED";
          this.touchJoy.active = false;
          this.touchJoy.dx = 0;
          this.touchJoy.dy = 0;
          const eeModal = document.getElementById("eevee-evo-modal");
          if (eeModal) {
            eeModal.classList.remove("hidden");
            eeModal.style.display = "flex";
          }
          return;
        } else if (this.player.data.evo_to) {
          this.startEvolutionMoment(this.player.data.evo_to, true);
          return;
        }
      }
    }
    this.openLevelUpModal();
  },

  debugUnlockSuperMove(targetCount = 1) {
    if (!this.player) return;
    const p = this.player;
    // 若要求雙超武但目前學會的招式不足 2 招，自動從天生三招池補齊第 2 招
    if (targetCount >= 2 && Object.keys(p.skills).length < 2) {
      const natList = p.naturalSkills || ["Tackle", "AirSlash", "Earthquake"];
      for (const sId of natList) {
        const metaCheck = SKILLS_CATALOG[sId];
        if (metaCheck && !p.skills[metaCheck.id]) {
          p.skills[metaCheck.id] = { id: metaCheck.id, level: 10, evolved: false, timer: 0.25 };
          if (Object.keys(p.skills).length >= 2) break;
        }
      }
    }

    const skillList = Object.values(p.skills).slice(0, targetCount);
    skillList.forEach((sk, idx) => {
      const meta = SKILLS_CATALOG[sk.id];
      if (!meta) return;
      sk.level = 10;
      if (meta.reqItem) p.heldItems[meta.reqItem] = true;
      sk.evolved = true;
      if (idx === 0) {
        SkillsEngine.triggerUltimateSuperMove(meta, sk, 1.0);
      } else {
        setTimeout(() => {
          if (this.state === "PLAYING" && this.player) {
            SkillsEngine.triggerUltimateSuperMove(meta, sk, 0.78);
          }
        }, 450);
      }
    });
    this.spawnFloatingText(p.x, p.y - 32, targetCount >= 2 ? "★★ 雙超武全開覺醒！" : "★ 第1招超武突破！", "#FACC15", 15);
    this.refreshHUD();
  },

  debugToggleFpsHud() {
    this.showFpsHud = !this.showFpsHud;
    const badge = document.getElementById("hudFpsBadge");
    if (badge) badge.classList.toggle("hidden", !this.showFpsHud);
    const btn = document.getElementById("btnDebugFpsToggle");
    if (btn) btn.textContent = `📊 頂部FPS: ${this.showFpsHud ? '開' : '關'}`;
  },

  debugToggleGodMode() {
    this.debugGodMode = !this.debugGodMode;
    const btn = document.getElementById("btnDebugGodMode");
    if (btn) {
      btn.textContent = `🛡️ 無敵鎖血: ${this.debugGodMode ? '開' : '關'}`;
      btn.className = this.debugGodMode
        ? "px-1.5 py-1 bg-amber-600 border border-amber-300 rounded text-[9px] font-black text-slate-950"
        : "px-1.5 py-1 bg-slate-800 border border-slate-600 rounded text-[9px] font-bold text-amber-300 hover:bg-slate-700";
    }
    if (this.player) {
      if (this.debugGodMode) this.player.hp = this.player.maxHp;
      this.spawnFloatingText(this.player.x, this.player.y - 28, this.debugGodMode ? "🛡️ 無敵開啟 (已暫停自動升級彈窗)" : "🛡️ 無敵關閉 (恢復正常升級)", "#FACC15", 14);
    }
  },

  debugSetMobCap(capVal) {
    this.debugMobCap = capVal || 0;
    const lbl = document.getElementById("debugMobCapLabel");
    if (lbl) lbl.textContent = this.debugMobCap > 0 ? `上限: ${this.debugMobCap}隻` : "上限: 動態";
    if (this.player) {
      this.spawnFloatingText(this.player.x, this.player.y - 28, this.debugMobCap > 0 ? `🔥 同屏怪量上限鎖定: ${this.debugMobCap}隻` : "同屏怪量上限: 恢復預設動態", "#38BDF8", 13);
    }
  },

  debugBatchSpawnMobs(count = 30) {
    if (!this.player) return;
    if (this.debugMobCap > 0 && this.enemies.length + count > this.debugMobCap) {
      this.debugMobCap = Math.max(this.debugMobCap, this.enemies.length + count);
      const lbl = document.getElementById("debugMobCapLabel");
      if (lbl) lbl.textContent = `上限: ${this.debugMobCap}隻`;
    }
    for (let i = 0; i < count; i++) {
      this.spawnWildEnemy(i % 18 === 0);
    }
    this.spawnFloatingText(this.player.x, this.player.y - 32, `⚡ 壓力測試：瞬間生成 +${count} 怪！(當前 ${this.enemies.length} 隻)`, "#F43F5E", 14);
  },

  debugClearRegularMobs() {
    if (!this.player) return;
    this.enemies = this.enemies.filter(e => e.isBoss);
    this.enemyProjectiles = [];
    this.spawnFloatingText(this.player.x, this.player.y - 28, "🧹 已清空全場常規小怪與彈幕！", "#34D399", 14);
  },

  debugInstantEvolve() {
    if (!this.player) return;
    const p = this.player;
    if (p.id === 133) {
      this.state = "PAUSED";
      const eeModal = document.getElementById("eevee-evo-modal");
      if (eeModal) {
        eeModal.classList.remove("hidden");
        eeModal.style.display = "flex";
      }
      return;
    }
    if (p.data.evo_to) {
      if (p.data.evo_level && p.level < p.data.evo_level) p.level = p.data.evo_level;
      this.startEvolutionMoment(p.data.evo_to, false);
    } else {
      this.spawnFloatingText(p.x, p.y - 28, "目前已是最終完全體形态！", "#FACC15", 13);
    }
  },

  debugSpawnTreasureMob(kind) {
    if (!this.player) return;
    this.spawnTreasureMonster(kind);
  },

  debugSkipToTime(sec) {
    this.runTime = sec;
    this.spawnFloatingText(this.player.x, this.player.y - 30, `時間跳轉至 ${Math.floor(sec/60)}分${sec%60}秒`, "#F59E0B", 14);
  },

  debugTriggerSecretMew() {
    if (!this.player) return;
    this.spawnBoss(151, false);
  },

  debugSpawnLegendaryBird(birdId) {
    if (!this.player) return;
    this.spawnBoss(birdId, false);
  },

  debugSpawnMewtwo() {
    if (!this.player) return;
    this.spawnBoss(150, true);
  },

  debugSpawnPokeMart() {
    if (!this.player) return;
    this.spawnPokeMartEntity(true);
  },

  debugTriggerRocketEvent() {
    if (!this.player) return;
    this.showCutsceneBanner("【火箭隊突襲 (DEBUG)】", "黑化阿柏怪與雙彈瓦斯帶著毒霧包夾！", 3200);
    SoundFX.play("boss");
    for (let k = 0; k < 6; k++) {
      const ang = (k * Math.PI * 2) / 6;
      const ex = this.player.x + Math.cos(ang) * 360;
      const ey = this.player.y + Math.sin(ang) * 360;
      const pId = k % 2 === 0 ? 24 : 110;
      const pData = POKEMON_MAP.get(pId);
      this.enemies.push({
        id: pId, data: pData, x: ex, y: ey,
        hp: 420 * this.selectedDifficulty.hpMult,
        maxHp: 420 * this.selectedDifficulty.hpMult,
        atk: 24, speed: 75, radius: 26, isElite: true, isBoss: false, isShiny: false,
        facingX: -1, facingY: 1, status: "Poison", statusTimer: 99, statusTick: 99,
        ccImmunityTimer: 1.5, rangedCd: 3.5, whiteFlashTimer: 0, weightTier: "heavy", kbResist: 0.7
      });
    }
  },

  debugTriggerTaurosStampede() {
    if (!this.player) return;
    this.showCutsceneBanner("【肯泰羅暴走狂潮 (DEBUG)】", "大群狂暴肯泰羅橫向踐踏！利用跳崖或繞水規避！", 3500);
    SoundFX.play("super");
    const startX = this.player.x - this.width / 2 - 120;
    for (let row = -3; row <= 3; row++) {
      const ey = this.player.y + row * 65;
      const tData = POKEMON_MAP.get(128);
      this.enemies.push({
        id: 128, data: tData, x: startX - Math.abs(row) * 35, y: ey,
        hp: 600 * this.selectedDifficulty.hpMult,
        maxHp: 600 * this.selectedDifficulty.hpMult,
        atk: 32, speed: 130, radius: 28, isElite: true, isBoss: false, isShiny: false,
        facingX: 1, facingY: 0, status: null, statusTimer: 0, statusTick: 0,
        ccImmunityTimer: 999, rangedCd: 999, whiteFlashTimer: 0, weightTier: "heavy", kbResist: 0.95
      });
    }
  },

  triggerMigrationSwarmEvent(isDebug = false) {
    if (!this.player) return;
    const isBay = MapEngine.currentStage.id === "cerulean_bay";
    const swarmId = isBay ? 16 : 12; // 華藍海岬刷波波群，常磐森林/神殿刷巴大蝶群
    const sData = POKEMON_MAP.get(swarmId);
    this.showCutsceneBanner(
      isDebug ? "【生態大遷徙潮 (DEBUG)】" : "【1:30 關都生態大遷徙】",
      `成群的【${sData.name_zh}】正橫越戰場！擊破牠們賺取大量初期經驗水晶！`,
      3200
    );
    SoundFX.play("super");
    this.saveData.pokedexSeen[swarmId] = true;
    const baseHp = Math.round(68 * this.selectedDifficulty.hpMult);
    for (let k = 0; k < 14; k++) {
      const side = k % 2 === 0 ? 1 : -1;
      const ex = this.player.x + side * (this.width / 2 + 55 + (k % 4) * 28);
      const ey = this.player.y + ((k - 7) * 34);
      this.enemies.push({
        id: swarmId, data: sData, x: ex, y: ey,
        hp: baseHp, maxHp: baseHp,
        atk: 11, speed: 92, radius: 18, isElite: false, isBoss: false, isShiny: false,
        facingX: -side, facingY: 1, status: null, statusTimer: 0, statusTick: 0,
        ccImmunityTimer: 0, rangedCd: 999, whiteFlashTimer: 0, weightTier: "light", kbResist: 0.0
      });
    }
  },

  triggerPrehistoricTrialEvent(isDebug = false) {
    if (!this.player) return;
    this.showCutsceneBanner(
      isDebug ? "【遠古化石甦醒試煉 (DEBUG)】" : "【6:15 冠軍之路・遠古試煉】",
      "遠古霸主【化石翼龍 ＆ 鐮刀盔】甦醒包夾！擊破可獲高額經驗與神奇糖果！",
      3500
    );
    SoundFX.play("boss");
    const ids = [142, 141, 139, 142];
    ids.forEach((pId, idx) => {
      const ang = (idx * Math.PI * 2) / ids.length + Math.PI / 4;
      const ex = this.player.x + Math.cos(ang) * 340;
      const ey = this.player.y + Math.sin(ang) * 340;
      const pData = POKEMON_MAP.get(pId);
      const hp = Math.round(1350 * this.selectedDifficulty.hpMult);
      this.saveData.pokedexSeen[pId] = true;
      this.enemies.push({
        id: pId, data: pData, x: ex, y: ey,
        hp, maxHp: hp,
        atk: Math.round(34 * this.selectedDifficulty.atkMult),
        speed: 112 * this.selectedDifficulty.spdMult,
        radius: 30, isElite: true, isBoss: false, isShiny: false,
        facingX: -1, facingY: 1, status: null, statusTimer: 0, statusTick: 0,
        ccImmunityTimer: 1.5, rangedCd: 1.8, whiteFlashTimer: 0, weightTier: "heavy", kbResist: 0.85
      });
    });
  },

  debugAddPartner() {
    if (!this.player) return;
    this.summonOrUpgradePartner();
  },

  updateWeatherUI(weatherType) {
    const iconMap = {
      CLEAR: "fa-sun text-amber-500",
      RAIN: "fa-cloud-rain text-sky-400",
      THUNDER: "fa-bolt text-yellow-400",
      PSYCHIC: "fa-moon text-purple-400",
      BLIZZARD: "fa-snowflake text-sky-200",
      HEATWAVE: "fa-fire text-orange-500"
    };
    const textMap = { CLEAR: "晴天", RAIN: "微雨", THUNDER: "雷暴", PSYCHIC: "極光", BLIZZARD: "暴雪", HEATWAVE: "熱浪" };
    
    const iconEl = document.getElementById("hudWeatherIcon");
    const textEl = document.getElementById("hudWeatherText");
    if (iconEl) iconEl.className = `fa-solid ${iconMap[weatherType] || "fa-sun text-amber-500"}`;
    if (textEl) textEl.textContent = textMap[weatherType] || weatherType;
  },

  showWeatherInfoToast() {
    const w = MapEngine.weather;
    const descMap = {
      CLEAR: "【晴天】正常視野與標準戰鬥環境。",
      RAIN: "【微雨】水系招式威力+25%，火系-20%！",
      THUNDER: "【狂暴雷暴】電系招式彈射+1，伴隨全屏天頂白閃！",
      PSYCHIC: "【超能極光】超能/幽靈暴擊率+15%，技能冷卻-8%！",
      BLIZZARD: "【極寒暴雪】冰系威力+20%，地面精靈移速微緩！",
      HEATWAVE: "【烈日熱浪】火系威力+25%，灼傷扣血速率提升50%！"
    };
    this.showCutsceneBanner(`[當前天候: ${w}]`, descMap[w] || "標準環境", 2500);
  },

  // Boss 降臨前奏系統 (Warning 預警序列)
  triggerBossWarningSequence(bossId, isFinalMewtwo = false) {
    const bData = POKEMON_MAP.get(bossId);
    if (!bData) return;

    const weatherMap = { 144: "BLIZZARD", 145: "THUNDER", 146: "HEATWAVE", 150: "PSYCHIC", 151: "PSYCHIC" };
    const wType = weatherMap[bossId] || "THUNDER";
    const wNames = { BLIZZARD: "極寒暴雪", THUNDER: "狂暴雷暴", HEATWAVE: "烈日熱浪", PSYCHIC: "超能極光" };

    // 關鍵鎖定：防止被 updateCombat 的時間軸常規天氣在 16ms 內覆蓋回來！
    this.debugWeatherLock = true;
    MapEngine.setWeather(wType);
    this.updateWeatherUI(wType);

    SoundFX.play("boss");
    this.showCutsceneBanner(
      "【⚠️ WARNING!! 神獸降臨預警】",
      `天地異變！氣候轉為【${wNames[wType] || wType}】！傳說精靈【${bData.name_zh}】即將在預警點降臨！`,
      2400
    );

    const ang = Math.random() * Math.PI * 2;
    const dropX = this.player.x + Math.cos(ang) * 280;
    const dropY = this.player.y + Math.sin(ang) * 280;

    this.telegraphs.push({
      shape: "circle",
      isBossWarning: true,
      bossId: bossId,
      isFinalMewtwo: isFinalMewtwo,
      x: dropX,
      y: dropY,
      radius: 95,
      timer: 1.8,
      maxTime: 1.8,
      dmg: 0,
      color: "#EF4444"
    });
  },

  spawnBoss(bossId, isFinalMewtwo = false) {
    this.triggerBossWarningSequence(bossId, isFinalMewtwo);
  },

  spawnBossAt(bossId, bx, by, isFinalMewtwo = false) {
    const bData = POKEMON_MAP.get(bossId);
    const diff = this.selectedDifficulty;
    const hp = Math.round((isFinalMewtwo ? 14000 : 7500) * diff.hpMult);

    SoundFX.startBgm("boss");
    this.camera.shakeTime = 0.65;
    this.camera.shakeMagnitude = 16;
    SoundFX.play("ultimate");

    this.spawnParticleCluster(bx, by, "#EF4444", "#F59E0B", 36, "star", 1.8);
    SkillsEngine.meleeEffects.push({
      style: "slam_wave",
      x: bx,
      y: by,
      radius: 140,
      timer: 0.45,
      maxTime: 0.45,
      color: "#EF4444"
    });

    this.saveData.pokedexSeen[bossId] = true;
    const boss = {
      id: bossId,
      data: bData,
      x: bx,
      y: by,
      hp,
      maxHp: hp,
      atk: Math.round((isFinalMewtwo ? 42 : 30) * diff.atkMult),
      speed: (isFinalMewtwo ? 132 : 118) * diff.spdMult,
      radius: 44,
      isElite: true,
      isBoss: true,
      isFinalMewtwo,
      isShiny: false,
      treasureType: null,
      facingX: -1,
      facingY: 1,
      status: null,
      statusTimer: 0,
      statusTick: 0,
      ccImmunityTimer: 0,
      rangedCd: 2.2,
      whiteFlashTimer: 0,
      weightTier: "boss",
      kbResist: 1.0,
      bossAttackIdx: 0
    };
    this.enemies.push(boss);
    this.activeBoss = boss;
    document.getElementById("bossHudContainer").classList.remove("hidden");
  },
  startGameRun() {
    SoundFX.init();
    const stageId = (this.selectedStage && this.selectedStage.id) ? this.selectedStage.id : "pallet";
    if (typeof MapEngine !== "undefined") {
      MapEngine.setStage(stageId);
      MapEngine.cloudTime = 0;
      MapEngine.lightningFlashAlpha = 0;
      MapEngine.splashParticles = [];
    }
    SoundFX.playBgm(stageId, true);

    // 徹底隱藏大廳、結算、過場以及所有局內可能殘留的全屏遮罩彈窗（根除第二局黑屏）
    ["preloader-screen", "splashScreen", "cutInLayer", "setupModal", "titleScreen", "endModal", "levelUpModal", "eevee-evo-modal", "pokeMartModal", "settingsModal", "unlock-confirm-modal", "pokedexModal", "skillTreeModal", "achievementModal"].forEach(mId => {
      const el = document.getElementById(mId);
      if (el) { el.classList.add("hidden"); el.style.display = "none"; }
    });

    // 重置 Canvas 繪圖狀態與鏡頭座標，防止前一局殘留狀態或座標偏移造成黑屏
    this.resize();
    if (this.ctx) {
      const dpr = this.dpr || 1;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.ctx.globalAlpha = 1.0;
      this.ctx.globalCompositeOperation = "source-over";
      this.ctx.filter = "none";
    }

    // 重置幀時間戳與打擊停頓，防止首幀時間差爆炸造成瞬移或物理崩潰
    this.lastFrameTime = performance.now();
    this.hitStopTimer = 0;
    this.killSlowmoTimer = 0;
    this.camera.x = 0;
    this.camera.y = 0;
    this.camera.shakeTime = 0;
    this.camera.shakeMagnitude = 0;
    this.touchJoy.active = false;
    this.touchJoy.dx = 0;
    this.touchJoy.dy = 0;

    // 關鍵修復：重新遊玩時，清除 quitToTitle 殘留的 inline style.display = "none"，強制展現 HUD UI
    const hudEl = document.getElementById("hudLayer");
    if (hudEl) {
      hudEl.classList.remove("hidden");
      hudEl.style.display = "block";
    }

    const basePoke = POKEMON_MAP.get(this.selectedStarterId) || POKEMON_MAP.get(25);
    const tr = this.selectedTrainer || TRAINERS[0];
    const upg = (this.saveData && this.saveData.upgrades) || {};

    // 重置每局免費重抽次數 (基礎 1 次 + 永久商店戰術重擲等級加成) 與代幣重抽計數
    this.levelUpRerolls = 1 + (upg.rerollCount || 0);
    this.paidRerollCount = 0;

    const isBond = (tr.bondPokemonIds || []).includes(basePoke.id);
    const hasShiny = !!this.saveData.shinyUnlocked[basePoke.id] && !!this.useShinyStarter[basePoke.id];
    const starLv = (this.saveData.pokemonStars && this.saveData.pokemonStars[basePoke.id]) || 0;
    const starMult = 1 + starLv * 0.12;
    const shinyMult = (hasShiny ? 1.20 : 1.0) * starMult;

    const maxHp = Math.round(basePoke.hp * tr.mods.hpMult * (1 + upg.hp * 0.12) * shinyMult);
    const maxSkillSlots = 3 + (upg.fourthSlot >= 1 ? 1 : 0);
    const trainerSkillMaxCd = Math.round(tr.skillCd * (1 - (upg.trainerCd || 0) * 0.04));

    this.player = {
      id: basePoke.id,
      data: basePoke,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      facingX: -1,
      facingY: 1,
      walkBob: 0,
      isShiny: hasShiny,
      starMult: starMult,
      finalEvoArmor: basePoke.id >= 144 ? 0.12 : 0,
      multiscaleTimer: 10.0,
      multiscaleReady: basePoke.id >= 144,
      royalAutoPulseTimer: 6.5,
      isTrainerBond: isBond,
      bondColor: tr.bondColor || "#F59E0B",
      bondName: tr.bondName || "專屬羈絆",
      level: 1,
      exp: 0,
      nextExp: 18,
      hp: maxHp,
      maxHp,
      baseAtk: basePoke.atk * shinyMult,
      baseSpeed: basePoke.speed,
      dmgMult: tr.mods.dmgMult * (1 + upg.atk * 0.08) * (isBond ? 1.25 : 1.0),
      cdMult: tr.mods.cdMult * Math.pow(0.965, upg.cd) * (isBond ? 0.80 : 1.0),
      speedMult: tr.mods.speedMult,
      areaMult: tr.mods.areaMult,
      critRate: 0.10 + tr.mods.critBonus,
      regen: tr.mods.regen + upg.hp * 0.4,
      magnetRadius: 92,
      projBonus: tr.mods.projBonus || 0,
      maxSkillSlots,
      skills: {},
      heldItems: {},
      invulnTimer: 0,
      buffTimer: 0,
      maxBuffTimer: tr.skillDuration || 6.0,
      shieldTimer: 0,
      maxShieldTimer: 5.0,
      trainerSkillCd: 0,
      trainerSkillMaxCd,
      status: null,
      statusTimer: 0,
      statusTick: 0,
      whiteFlashTimer: 0,
      isJumpingLedge: false,
      jumpTimer: 0,
      jumpY: 0,
      xAttackTimer: 0,
      xSpeedTimer: 0,
      dashTimer: 0,
      dashVx: 0,
      dashVy: 0,
      lungeTimer: 0,
      lungeMaxTime: 0.16,
      lungeAngle: 0,
      lungeDist: 0,
      inputX: 0,
      inputY: 0,
      inputActive: false,
      recoilTimer: 0,
      recoilX: 0,
      recoilY: 0,
      slamHopTimer: 0,
      quickStepTimer: 0,
      martialGodTimer: 0,
      innateTrait: typeof getPokemonInnateTrait === "function" ? getPokemonInnateTrait(basePoke, 1) : null,
      speedTrails: []
    };

    //const initSkillId = SKILLS_CATALOG[basePoke.skill] ? basePoke.skill : "Tackle";
    //this.player.skills[initSkillId] = { id: initSkillId, level: 1, evolved: false, timer: 0.2 };

    // 讀取或動態推導全 151 圖鑑專屬天生三招配置
    const derivedNatSkills = (typeof getNaturalSkillsForPokemon === "function")
      ? getNaturalSkillsForPokemon(basePoke)
      : ((typeof POKEMON_NATURAL_SKILLS !== "undefined" && POKEMON_NATURAL_SKILLS[basePoke.id])
          ? POKEMON_NATURAL_SKILLS[basePoke.id].skills
          : [SKILLS_CATALOG[basePoke.skill] ? basePoke.skill : "Tackle"]);

    const firstSkillId = derivedNatSkills[0] || "Tackle";
    const startSkillLv = starLv >= 3 ? 2 : 1;
    this.player.skills[firstSkillId] = { id: firstSkillId, level: startSkillLv, evolved: false, timer: 0.2 };
    this.player.naturalSkills = [...derivedNatSkills];
	
    this.trainerCompanion = {
      x: 26,
      y: 8,
      facingX: -1,
      facingY: 1,
      walkBob: 0,
      sprite: tr.sprite,
      sprites: tr.sprites || null,
      name: tr.name,
      pixelColors: tr.pixelColors,
      isJumpingLedge: false,
      jumpTimer: 0,
      jumpY: 0
    };

    this.partners = [];
    this.enemies = [];
    this.particles = [];
    this.floatingTexts = [];
    this.gems = [];
    this.mapItems = [];
    this.lavaFootprints = [];
    this.telegraphs = [];
    this.enemyProjectiles = [];
    this.activeBoss = null;
    this.debugWeatherLock = false;
    this.skillDamageStats = {};
    this._lastHudIdentityKey = null;
    this._lastHudHpTier = null;
    this._lastHudPartnerKey = null;
    this._lastHudHeldKey = null;
    this._lastHudSkillKey = null;

    SkillsEngine.reset();

    if (tr.mods.startPartner || (upg.partner >= 1)) {
      this.summonOrUpgradePartner();
    }

    // 初始化本局模式 ("standard" 8分鐘標準通關 | "endless" 無盡深淵試煉)
    this.isEndlessMode = (this.selectedGameMode === "endless");
    this.endlessNextBossTime = 480;
    this.endlessCycleIdx = 0;
    this.endlessNextKillMilestone = 150;
    this.activeLoadoutBuffs = {};

    // 兌現 STEP 3 多選勾選的所有「開局戰術特訓補給」
    const chosenLoadouts = Array.isArray(this.selectedLoadouts)
      ? [...this.selectedLoadouts]
      : (this.selectedLoadout && this.selectedLoadout !== "none" ? [this.selectedLoadout] : []);
    const loadoutCatalog = typeof TACTICAL_LOADOUTS !== "undefined" ? TACTICAL_LOADOUTS : [];
    const appliedNames = [];

    chosenLoadouts.forEach(ldId => {
      const ldMeta = loadoutCatalog.find(x => x.id === ldId);
      const cost = ldMeta ? ldMeta.cost : 0;
      if ((this.saveData.coins || 0) < cost) return;
      this.saveData.coins -= cost;
      this.activeLoadoutBuffs[ldId] = true;
      if (ldMeta) appliedNames.push(ldMeta.name);

      if (ldId === "combat_pack") {
        this.player.xAttackTimer = 45.0;
        this.player.xSpeedTimer = 45.0;
        this.player.maxHp = Math.round(this.player.maxHp * 1.25);
        this.player.hp = this.player.maxHp;
      } else if (ldId === "held_box") {
        const mainSkMeta = SKILLS_CATALOG[firstSkillId];
        const reqId = (mainSkMeta && mainSkMeta.reqItem) ? mainSkMeta.reqItem : "silk_scarf";
        const hiMeta = HELD_ITEMS[reqId] || Object.values(HELD_ITEMS)[0];
        if (hiMeta) {
          this.player.heldItems[hiMeta.id] = true;
          this.player.dmgMult *= 1.12;
        }
      } else if (ldId === "skill_manual") {
        const mainSkObj = this.player.skills[firstSkillId];
        if (mainSkObj) {
          mainSkObj.level = Math.min(10, Math.max(3, mainSkObj.level + 2));
        }
      } else if (ldId === "extra_partner") {
        this.summonOrUpgradePartner();
      } else if (ldId === "magnet_badge") {
        this.player.magnetRadius = Math.round(this.player.magnetRadius * 1.40);
        this.player.loadoutMagnetPulseTimer = 25.0;
      } else if (ldId === "shiny_charm_pass") {
        this.player.loadoutShinyMult = 3.0;
        this.player.loadoutCoinMult = 1.25;
      }
    });

    if (appliedNames.length > 0) {
      this.saveToStorage();
      setTimeout(() => {
        if (this.player) {
          this.spawnFloatingText(this.player.x, this.player.y - 36, `🎒 戰術補給啟動 (${appliedNames.length}項)：${appliedNames.join("、")}！`, "#FACC15", 13);
        }
      }, 450);
    }
    this.selectedLoadouts = [];
    this.selectedLoadout = "none";

    this.runTime = 0;
    this.spawnTimer = 0.5;
    this.eliteSpawnTimer = 45;
    this.treasureSpawnTimer = 38;
    this.magnetSpawnTimer = 35;
	this.martSpawnTimer = 110;
    this.migrationEventTriggered = false;
    this.rocketEventTriggered = false;
    this.taurosStampedeTriggered = false;
    this.prehistoricEventTriggered = false;
    this.birdBossSpawned = false;
    this.mewtwoBossSpawned = false;
    this.secretMewSpawned = false;
    this.kills = 0;
    this.runCoins = 0;
    this.timeScale = 1;

    document.getElementById("speedToggleText").textContent = "1x";
    document.getElementById("bossHudContainer").classList.add("hidden");
    MapEngine.setWeather("CLEAR");
    this.updateWeatherUI("CLEAR");

    this.state = "PLAYING";
    this.refreshHUD();
  },

  triggerTrainerActiveSkill() {
    if (this.state !== "PLAYING" || !this.player) return;
    if (this.player.trainerSkillCd > 0 || this.player.buffTimer > 0 || this.player.shieldTimer > 0) return;

    const tr = this.selectedTrainer;
    const p = this.player;
    p.status = null;
    p.statusTimer = 0;

    const cutLayer = document.getElementById("cutInLayer");
    const cutBannerWrap = document.getElementById("cutInBannerWrap");
    const cutBannerImg = document.getElementById("cutInBannerImg");
    const cutStrip = document.getElementById("cutInStrip");

    if (cutLayer) {
      cutLayer.style.display = "flex";
      cutLayer.classList.remove("hidden");

      const showFallbackStrip = () => {
        if (!cutStrip) return;
        if (cutBannerWrap) {
          cutBannerWrap.classList.add("hidden");
          cutBannerWrap.style.display = "none";
        }
        cutStrip.style.display = "flex";
        cutStrip.classList.remove("hidden");
        document.getElementById("cutInAvatar").src = tr.sprite;
        document.getElementById("cutInTrainer").textContent = `${tr.name} ‧ 戰術指令`;
        document.getElementById("cutInSkill").textContent = `【${tr.skillName}】`;
        cutStrip.classList.remove("cut-in-active");
        void cutStrip.offsetWidth;
        cutStrip.classList.add("cut-in-active");
      };

      const cutRec = tr.cutin ? SpriteCache.get(tr.cutin) : null;
      if (tr.cutin && cutBannerImg && cutBannerWrap && !(cutRec && cutRec.error)) {
        if (cutStrip) {
          cutStrip.classList.add("hidden");
          cutStrip.style.display = "none";
        }
        cutBannerWrap.style.display = "flex";
        cutBannerWrap.classList.remove("hidden");
        cutBannerImg.onerror = () => {
          if (cutRec) cutRec.error = true;
          showFallbackStrip();
        };
        cutBannerImg.src = tr.cutin;
        const bTrainerEl = document.getElementById("cutInBannerTrainer");
        const bSkillEl = document.getElementById("cutInBannerSkill");
        const bBoxEl = document.getElementById("cutInBannerOverlayBox");
        if (bTrainerEl) bTrainerEl.textContent = `${tr.name} ‧ 戰術指令`;
        if (bSkillEl) bSkillEl.textContent = `【${tr.skillName}】`;
        if (bBoxEl) {
          bBoxEl.style.borderColor = tr.bondColor || "#FBBF24";
          cutBannerImg.style.borderColor = tr.bondColor || "#FBBF24";
        }
        cutBannerWrap.classList.remove("cut-in-banner-active");
        void cutBannerWrap.offsetWidth;
        cutBannerWrap.classList.add("cut-in-banner-active");
      } else {
        showFallbackStrip();
      }

      clearTimeout(this._cutInHideTimer);
      this._cutInHideTimer = setTimeout(() => {
        cutLayer.classList.add("hidden");
        cutLayer.style.display = "none";
      }, 750);
    }

    this.hitStopTimer = 0.08;
    this.camera.shakeTime = 0.28;
    this.camera.shakeMagnitude = 8;
    SoundFX.play("ultimate");
    if (typeof SoundFX.playTrainerVoice === "function") {
      SoundFX.playTrainerVoice(tr.id);
    }

    let healPct = 0.20;
    if (tr.id === "ash") {
      healPct = 0.18;
      p.buffTimer = 6.0;
      p.maxBuffTimer = 6.0;
      this.spawnParticleCluster(p.x, p.y, "#F59E0B", "#FFFFFF", 28, "star");
      this.spawnFloatingText(p.x, p.y - 35, "就決定是你了! 全攻速暴擊UP!", "#F59E0B", 15);
    } else if (tr.id === "misty") {
      healPct = 0.24;
      const waveDmg = (48 + p.baseAtk * 1.1) * p.dmgMult;
      // 借用原生【潮旋激流】深海大漩渦 + 【絕對零度】極光冰晶環演繹小霞暴風海嘯！
      SkillsEngine.groundHazards.push({
        kind: "blastoise_maelstrom",
        x: p.x, y: p.y,
        followPlayer: true,
        rotAngle: 0,
        radius: 245 * p.areaMult,
        innerSafeRadius: 38,
        dmg: waveDmg * 0.35,
        type: "Water",
        timer: 1.55, maxTime: 1.55,
        tickTimer: 0.08, tickInterval: 0.30,
        color: "#38BDF8"
      });
      SkillsEngine.groundHazards.push({
        kind: "ice_shatter_domain",
        x: p.x, y: p.y,
        radius: 235 * p.areaMult,
        dmg: waveDmg * 0.65,
        type: "Ice",
        timer: 0.85, maxTime: 0.85,
        tickTimer: 0.80, tickInterval: 99,
        color: "#67E8F9"
      });
      this.spawnParticleCluster(p.x, p.y, "#38BDF8", "#E0F2FE", 36, "diamond", 1.3);
      this.enemies.forEach(e => {
        if (Math.hypot(e.x - p.x, e.y - p.y) < 250) {
          if (!e.isBoss) {
            const ang = Math.atan2(e.y - p.y, e.x - p.x);
            e.x += Math.cos(ang) * 115; e.y += Math.sin(ang) * 115;
          }
          e.status = "Freeze"; e.statusTimer = e.isBoss ? 1.4 : 3.5;
        }
      });
      this.spawnFloatingText(p.x, p.y - 35, "🌊 暴風海嘯！潮旋冰封席捲！", "#38BDF8", 15);
    } else if (tr.id === "brock") {
      healPct = 0.26;
      p.shieldTimer = 5.5;
      p.maxShieldTimer = 5.5;
      const rockDmg = (52 + p.baseAtk * 1.15) * p.dmgMult;
      // 借用原生【地震】環形地裂波 + 【地裂斷層破】熔岩岩柱演繹小剛岩石壁壘！
      SkillsEngine.meleeEffects.push({
        style: "quake_wave",
        casterRef: p,
        x: p.x, y: p.y,
        radius: 195 * p.areaMult,
        dmg: rockDmg * 0.85,
        type: "Ground",
        kb: 32,
        hitSet: new Set(),
        timer: 0.55, maxTime: 0.55,
        color: "#D97706"
      });
      SkillsEngine.groundHazards.push({
        kind: "quake_fissure",
        x: p.x, y: p.y,
        followPlayer: true,
        radius: 185 * p.areaMult,
        dmg: rockDmg * 0.32,
        type: "Ground",
        timer: 1.8, maxTime: 1.8,
        tickTimer: 0.12, tickInterval: 0.45,
        color: "#D97706"
      });
      this.spawnParticleCluster(p.x, p.y, "#D97706", "#FDE047", 32, "star", 1.2);
      this.spawnFloatingText(p.x, p.y - 35, "🪨 岩石壁壘！地裂震退 ＆ 減傷55%！", "#F59E0B", 15);
    } else if (tr.id === "serena") {
      healPct = 0.22;
      this.partners.forEach(pt => { pt.cdTimer = 0; });
      this.spawnParticleCluster(p.x, p.y, "#F472B6", "#FCE7F3", 28, "star");
      this.spawnFloatingText(p.x, p.y - 35, "雙打夥伴大招全開!", "#F472B6", 15);
    } else if (tr.id === "lillie") {
      healPct = 0.38;
      p.invulnTimer = 2.0;
      this.spawnParticleCluster(p.x, p.y, "#34D399", "#FFFFFF", 30, "star");
      this.spawnFloatingText(p.x, p.y - 35, "滿たん傷藥 +38% HP ＆ 淨化!", "#34D399", 15);
    } else if (tr.id === "red") {
      healPct = 0.25;
      p.buffTimer = 6.5;
      p.maxBuffTimer = 6.5;
      this.spawnParticleCluster(p.x, p.y, "#EF4444", "#F59E0B", 36, "star");
      this.enemies.forEach(e => {
        if (Math.hypot(e.x - p.x, e.y - p.y) < 240 && !e.isBoss) {
          const ang = Math.atan2(e.y - p.y, e.x - p.x);
          e.x += Math.cos(ang) * 110; e.y += Math.sin(ang) * 110;
        }
      });
      this.spawnFloatingText(p.x, p.y - 35, "赤紅王牌號令! 全傷+45%!", "#EF4444", 16);
    }

    const healAmt = Math.round(p.maxHp * healPct);
    p.hp = Math.min(p.maxHp, p.hp + healAmt);
    this.spawnFloatingText(p.x, p.y - 16, `+${healAmt} HP`, "#10B981", 14);

    // 瞬發型訓練家（小霞、莎莉娜、莉莉艾）釋放後立即賦予完整冷卻時間
    if (tr.id !== "ash" && tr.id !== "brock" && tr.id !== "red") {
      p.trainerSkillCd = p.trainerSkillMaxCd;
    }

    this.refreshHUD();
  },

  summonOrUpgradePartner() {
    if (this.partners.length < 2) {
      const pool = PARTNER_SUMMON_POOL.filter(id => id !== this.player.id && !this.partners.some(pt => pt.id === id));
      const pickId = pool[Math.floor(Math.random() * pool.length)] || 25;
      const pData = POKEMON_MAP.get(pickId);
      this.partners.push({
        id: pData.id,
        data: pData,
        level: 1,
        x: this.player.x,
        y: this.player.y,
        facingX: -1,
        facingY: 1,
        cdTimer: 0.6
      });
      this.saveData.pokedexSeen[pData.id] = true;
      this.saveData.pokedexCaught[pData.id] = true;
      this.spawnFloatingText(this.player.x, this.player.y - 28, `收服雙打夥伴：${pData.name_zh}!`, "#EC4899", 14);
    } else {
      let anyUpg = false;
      this.partners.forEach(pt => {
        if (pt.level < 5) {
          pt.level += 1;
          anyUpg = true;
          if (pt.data.evo_level !== "None" && pt.level >= 3 && pt.data.evo_to) {
            const nextData = POKEMON_MAP.get(pt.data.evo_to);
            if (nextData) {
              pt.id = nextData.id;
              pt.data = nextData;
              this.saveData.pokedexSeen[nextData.id] = true;
              this.saveData.pokedexCaught[nextData.id] = true;
            }
          }
        }
      });
      if (anyUpg) {
        this.spawnFloatingText(this.player.x, this.player.y - 28, `雙打夥伴等級提升 (MAX Lv.5)!`, "#EC4899", 14);
      } else {
        this.spawnFloatingText(this.player.x, this.player.y - 28, `雙打夥伴已達上限 Lv.5!`, "#EC4899", 14);
      }
    }
    this.refreshHUD();
  },

  loop(timestamp) {
    const actualDeltaMs = Math.max(1, timestamp - (this.lastFrameTime || timestamp));
    const instFps = Math.min(120, 1000 / actualDeltaMs);
    this.currentFps = Math.round((this.currentFps || 60) * 0.88 + instFps * 0.12);
    const rawDt = Math.min(0.05, actualDeltaMs / 1000 || 0.016);
    this.lastFrameTime = timestamp;

    if (this.state === "SPLASH" || this.state === "TITLE" || this.state === "LOADING") {
      // 若大廳已開啟全屏選角、151圖鑑、研究所或成就彈窗，自動休眠背景漫步渲染以大幅降低手機發熱
      const fullModalOpen = ["setupModal", "pokedexModal", "skillTreeModal", "achievementModal", "settingsModal"].some(id => {
        const el = document.getElementById(id);
        return el && !el.classList.contains("hidden");
      });
      if (!fullModalOpen) {
        this.updateTitleDemo(rawDt);
        this.renderTitleDemo();
      }
    } else if (this.state === "EVOLVING") {
      this._pauseFrameRendered = false;
      this.updateEvolutionMoment(rawDt);
      this.renderCombat();
    } else if (this.state === "PLAYING") {
      this._pauseFrameRendered = false;
      if (this.hitStopTimer > 0) {
        this.hitStopTimer -= rawDt;
      } else {
        let slowMult = 1.0;
        if (this.killSlowmoTimer > 0) {
          this.killSlowmoTimer = Math.max(0, this.killSlowmoTimer - rawDt);
          slowMult = 0.22;
        }
        const dt = rawDt * this.timeScale * slowMult;
        this.updateCombat(dt);
      }
      this.renderCombat();
    } else {
      // PAUSED / GAMEOVER 狀態（升級三選一、友好商店、暫停結算）：僅渲染凍結的最後一幀，避免背景 60FPS 重繪觸發毛玻璃 backdrop-filter 高溫發燙！
      if (!this._pauseFrameRendered) {
        this._pauseFrameRendered = true;
        this.renderCombat();
      }
    }

    requestAnimationFrame((t) => this.loop(t));
  },

  updateTitleDemo(dt) {
    if (!this.titleDemo) return;
    this.titleDemo.camX += 38 * dt;
    this.titleDemo.camY = Math.sin(this.titleDemo.camX * 0.003) * 45;
  },

  renderTitleDemo() {
    const ctx = this.ctx;
    const dpr = this.dpr || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, this.width, this.height);
    if (!this.titleDemo) return;
    const camX = this.titleDemo.camX;
    const camY = this.titleDemo.camY;

    MapEngine.renderBiomeWorld(ctx, camX, camY, this.width, this.height);

    const now = performance.now() * 0.004;
    this.titleDemo.wildWanderers.forEach((w, idx) => {
      const worldX = Math.floor((camX + w.offsetX) / 1200) * 1200 + ((w.offsetX + idx * 170) % 1200);
      const worldY = camY + w.offsetY + Math.sin(now + w.phase) * 14;
      const sx = worldX - camX + this.width / 2;
      const sy = worldY - camY + this.height / 2;
      const hop = Math.abs(Math.sin(now * 1.6 + w.phase)) * 8;

      const pData = POKEMON_MAP.get(w.id);
      if (!pData) return;
      const rec = SpriteCache.get(pData.forward_sprite);
      if (rec && rec.loaded) {
        ctx.save();
        ctx.translate(sx, sy - hop);
        ctx.fillStyle = "rgba(15,23,42,0.28)";
        ctx.beginPath();
        ctx.ellipse(0, 18 + hop * 0.4, 15, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        if (Math.cos(now * 0.5 + w.phase) > 0) ctx.scale(-1, 1);
        ctx.drawImage(rec.img, -24, -24, 48, 48);
        ctx.restore();
      }
    });
  },

  updateCombat(dt) {
    this.runTime += dt;
    const p = this.player;

    if (p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + p.regen * dt);
    if (p.invulnTimer > 0) p.invulnTimer -= dt;
    if (p.whiteFlashTimer > 0) p.whiteFlashTimer -= dt;

    if (p.buffTimer > 0) {
      p.buffTimer -= dt;
      if (p.buffTimer <= 0) {
        p.buffTimer = 0;
        p.trainerSkillCd = p.trainerSkillMaxCd;
      }
    }
    if (p.shieldTimer > 0) {
      p.shieldTimer -= dt;
      if (p.shieldTimer <= 0) {
        p.shieldTimer = 0;
        p.trainerSkillCd = p.trainerSkillMaxCd;
      }
    }
    if (p.buffTimer <= 0 && p.shieldTimer <= 0 && p.trainerSkillCd > 0) {
      p.trainerSkillCd = Math.max(0, p.trainerSkillCd - dt);
    }
    if (p.xAttackTimer > 0) {
      p.xAttackTimer -= dt;
      p._xAtkSparkTick = (p._xAtkSparkTick || 0) - dt;
      if (p._xAtkSparkTick <= 0) {
        p._xAtkSparkTick = 0.16;
        const rx = p.x + (Math.random() - 0.5) * 32;
        const ry = p.y + 10 - Math.random() * 16;
        SkillsEngine.spawnSubParticle(rx, ry, (Math.random() - 0.5) * 18, -55 - Math.random() * 35, Math.random() < 0.5 ? "#EF4444" : "#FDE047", 3.0, 0.32, "star");
      }
    }
    if (p.xSpeedTimer > 0) p.xSpeedTimer -= dt;
    if (p.recoilTimer > 0) {
      p.recoilTimer = Math.max(0, p.recoilTimer - dt);
    }
    if (p.slamHopTimer > 0) {
      p.slamHopTimer = Math.max(0, p.slamHopTimer - dt);
    }
    if (p.lungeTimer > 0) {
      p.lungeTimer = Math.max(0, p.lungeTimer - dt);
    }
    if (p.quickStepTimer > 0) {
      p.quickStepTimer = Math.max(0, p.quickStepTimer - dt);
    }
    if (p.martialGodTimer > 0) {
      p.martialGodTimer = Math.max(0, p.martialGodTimer - dt);
    }

    if (this.camera.shakeTime > 0) this.camera.shakeTime -= dt;

    if (p.statusTimer > 0) {
      p.statusTimer -= dt;
      p.statusTick -= dt;
      if (p.statusTick <= 0) {
        p.statusTick = 0.65;
        if ((p.status === "Burn" || p.status === "Poison") && !this.debugGodMode) {
          const dotDmg = Math.max(1, Math.round(p.maxHp * 0.008));
          p.hp = Math.max(1, p.hp - dotDmg);
          this.spawnFloatingText(p.x, p.y - 22, `${p.status === 'Burn' ? '灼傷' : '中毒'} -${dotDmg}`, p.status === 'Burn' ? "#F97316" : "#A855F7", 11);
        }
      }
      if (p.statusTimer <= 0) p.status = null;
    }

    let ix = this.touchJoy.active ? this.touchJoy.dx : 0;
    let iy = this.touchJoy.active ? this.touchJoy.dy : 0;

    if (this.keys["w"] || this.keys["arrowup"]) iy -= 1;
    if (this.keys["s"] || this.keys["arrowdown"]) iy += 1;
    if (this.keys["a"] || this.keys["arrowleft"]) ix -= 1;
    if (this.keys["d"] || this.keys["arrowright"]) ix += 1;

    if (p.status === "Confusion") { ix = -ix; iy = -iy; }

    const ilen = Math.hypot(ix, iy);
    if (ilen > 0.05) {
      ix /= ilen;
      iy /= ilen;
      p.inputX = ix;
      p.inputY = iy;
      p.inputActive = true;
      if (Math.abs(ix) > Math.abs(iy)) {
        p.facingX = ix >= 0 ? 1 : -1;
        p.facingY = 0;
        p.lastFacingX = p.facingX;
      } else {
        p.facingY = iy < 0 ? -1 : 1;
        p.facingX = 0;
      }
      p.walkBob += dt * 12;
    } else {
      p.inputX = 0;
      p.inputY = 0;
      p.inputActive = false;
      p.walkBob = 0;
    }
	
    // 1. 先計算當前主角所在位置的地形數據 (先宣告後使用)
    const terrain = MapEngine.getTerrainModifierAt(p.x, p.y);

    // 2. 恢復草地、涉水與木板腳底粒子反饋
    if (ilen > 0.05) {
      this.stepParticleTimer = (this.stepParticleTimer || 0) - dt;
      if (this.stepParticleTimer <= 0) {
        this.stepParticleTimer = 0.18;
        if (terrain.label && terrain.label.includes("草叢")) {
          this.spawnParticleCluster(p.x, p.y + 12, "#22C55E", "#86EFAC", 4, "leaf", 0.4);
        } else if (terrain.inWater) {
          this.spawnParticleCluster(p.x, p.y + 14, "#38BDF8", "#FFFFFF", 5, "circle", 0.5);
        } else if (terrain.label && (terrain.label.includes("木") || terrain.label.includes("橋"))) {
          this.spawnParticleCluster(p.x, p.y + 14, "#B45309", "#D97706", 3, "circle", 0.3);
        }
      }
    }
    if (terrain.inWater && MapEngine.currentStage.id === "cerulean_bay" && p.hp < p.maxHp) {
      p.hp = Math.min(p.maxHp, p.hp + 2.0 * dt);
    }

    // 【攜帶物：奇蹟種子】常駐光合作用回血 (0.8%/s)，處於草叢/淺灘/超能陣等特殊地形時提升至 1.8%/s，並每 1.2 秒跳出綠字與嫩葉粒子
    if (p.heldItems && p.heldItems["miracle_seed"] && p.hp < p.maxHp) {
      const inSpecialZone = !!(terrain.inWater || (terrain.label && (terrain.label.includes("草叢") || terrain.label.includes("重力陣"))));
      const overgrowMult = (p.innateTrait && p.innateTrait.overgrowHealMult) ? p.innateTrait.overgrowHealMult : 1.0;
      const healRate = (inSpecialZone ? 0.018 : 0.008) * overgrowMult;
      p.hp = Math.min(p.maxHp, p.hp + p.maxHp * healRate * dt);
      p.miracleSeedTick = (p.miracleSeedTick || 0) - dt;
      if (p.miracleSeedTick <= 0) {
        p.miracleSeedTick = 1.2;
        const healAmt = Math.max(1, Math.round(p.maxHp * healRate * 1.2));
        this.spawnFloatingText(p.x, p.y - 24, `🌱 奇蹟種子 +${healAmt}`, "#4ADE80", 12);
        this.spawnParticleCluster(p.x, p.y, "#22C55E", "#86EFAC", 5, "leaf", 0.5);
      }
    }

    // 【攜帶物：神秘水滴】生命低於 40% 時自動釋放環形高壓水幕擊退身周敵人 (內置 8 秒冷卻)
    if (p.mysticWaterCd > 0) p.mysticWaterCd -= dt;
    if (p.heldItems && p.heldItems["mystic_water"] && (p.hp / p.maxHp) <= 0.40 && (!p.mysticWaterCd || p.mysticWaterCd <= 0)) {
      p.mysticWaterCd = 8.0;
      SkillsEngine.meleeEffects.push({
        style: "slam_wave",
        x: p.x,
        y: p.y,
        radius: 155,
        timer: 0.42,
        maxTime: 0.42,
        color: "#38BDF8"
      });
      this.spawnParticleCluster(p.x, p.y, "#38BDF8", "#E0F2FE", 26, "circle", 1.25);
      this.spawnFloatingText(p.x, p.y - 28, "💧 神秘水滴：護體水幕擊退！", "#38BDF8", 14);
      SoundFX.play("super");
      this.enemies.forEach(e => {
        if (!e.isBoss && Math.hypot(e.x - p.x, e.y - p.y) <= 165) {
          const ang = Math.atan2(e.y - p.y, e.x - p.x);
          e.x += Math.cos(ang) * 95;
          e.y += Math.sin(ang) * 95;
          this.dealDamageToEnemy(e, p.baseAtk * 0.9 * p.dmgMult, "Water", 0.35, 22);
        }
      });
    }

    // 【開局戰術補給：黃金聚寶磁力徽章】每 25 秒自動釋放一次全場水晶牽引
    if (p.loadoutMagnetPulseTimer !== undefined) {
      p.loadoutMagnetPulseTimer -= dt;
      if (p.loadoutMagnetPulseTimer <= 0) {
        p.loadoutMagnetPulseTimer = 25.0;
        if (this.gems.some(g => !g.magnetized)) {
          this.gems.forEach(g => { g.magnetized = true; });
          this.spawnFloatingText(p.x, p.y - 26, "🧲 磁力徽章：全場水晶回收！", "#38BDF8", 13);
        }
      }
    }

    // 【攜帶物：磁鐵】每 12 秒釋放電磁脈衝，自動吸取全場散落的經驗水晶 (最多 8 顆遠處水晶，無水晶時不空轉)
    if (p.heldItems && p.heldItems["magnet"]) {
      p.heldMagnetTimer = (p.heldMagnetTimer === undefined ? 4.0 : p.heldMagnetTimer - dt);
      if (p.heldMagnetTimer <= 0) {
        const unmagnetized = this.gems.filter(g => !g.magnetized);
        if (unmagnetized.length > 0) {
          p.heldMagnetTimer = 12.0;
          unmagnetized
            .sort((a, b) => Math.hypot(b.x - p.x, b.y - p.y) - Math.hypot(a.x - p.x, a.y - p.y))
            .slice(0, 8)
            .forEach(g => { g.magnetized = true; });

          SkillsEngine.meleeEffects.push({
            style: "slam_wave",
            x: p.x,
            y: p.y,
            radius: 130,
            timer: 0.35,
            maxTime: 0.35,
            color: "#FACC15"
          });
          this.spawnParticleCluster(p.x, p.y, "#FACC15", "#FFFFFF", 14, "star", 0.9);
          this.spawnFloatingText(p.x, p.y - 28, "⚡ 磁鐵脈衝：遠程水晶牽引！", "#FACC15", 14);
          SoundFX.play("super");
        } else {
          p.heldMagnetTimer = 1.0;
        }
      }
    }

    // 【準神快龍 #149 ＆ 傳說五神獸專屬：多重鱗片 / 傳說王權星冕護盾】(每 10 秒充能，五神獸護盾就緒滿 6.5 秒且身邊有怪時更會主動爆發王權威壓新星！)
    if (p.id === 149 || p.id >= 144) {
      if (!p.multiscaleReady) {
        p.multiscaleTimer = (p.multiscaleTimer || 10.0) - dt;
        if (p.multiscaleTimer <= 0) {
          p.multiscaleReady = true;
          p.multiscaleTimer = 10.0;
          p.royalAutoPulseTimer = 6.5;
          this.spawnFloatingText(p.x, p.y - 26, p.id >= 144 && p.id !== 149 ? "👑 傳說王權護盾就緒!" : "🛡️ 多重鱗片護盾就緒!", "#FACC15", 13);
        }
      } else if (p.innateTrait && p.innateTrait.id === "legendary_pressure") {
        p.royalAutoPulseTimer = (p.royalAutoPulseTimer === undefined ? 6.5 : p.royalAutoPulseTimer - dt);
        if (p.royalAutoPulseTimer <= 0) {
          const nearbyEnemy = this.findNearestEnemyInViewport(p.x, p.y, 175);
          if (nearbyEnemy) {
            this.triggerRoyalShieldBurst(true);
          } else {
            p.royalAutoPulseTimer = 1.0;
          }
        }
      }
    }

    // 【攜帶物：木炭（或火焰鳥 #146 天生火羽）】走過的路徑留下持續 2 秒的熔岩灼燒腳印
    if (((p.heldItems && p.heldItems["charcoal"]) || p.id === 146) && ilen > 0.05) {
      p.charcoalStepTimer = (p.charcoalStepTimer || 0) - dt;
      if (p.charcoalStepTimer <= 0) {
        p.charcoalStepTimer = 0.24;
        this.lavaFootprints.push({
          x: p.x,
          y: p.y + 12,
          radius: 24,
          life: 2.0,
          maxLife: 2.0,
          tickTimer: 0.1
        });
      }
    }
    for (let i = this.lavaFootprints.length - 1; i >= 0; i--) {
      const lf = this.lavaFootprints[i];
      lf.life -= dt;
      lf.tickTimer -= dt;
      if (lf.tickTimer <= 0) {
        lf.tickTimer = 0.45;
        const lavaDmg = Math.max(4, Math.round((8 + p.baseAtk * 0.22) * p.dmgMult));
        const nearLava = SkillsEngine.getEnemiesInRadius(lf.x, lf.y, lf.radius);
        for (let j = nearLava.length - 1; j >= 0; j--) {
          const e = nearLava[j];
          if (e && e.hp > 0 && Math.hypot(e.x - lf.x, e.y - lf.y) <= lf.radius + e.radius) {
            this.dealDamageToEnemy(e, lavaDmg, "Fire", 0.20, 0);
          }
        }
      }
      if (lf.life <= 0) {
        this.lavaFootprints[i] = this.lavaFootprints[this.lavaFootprints.length - 1];
        this.lavaFootprints.pop();
      }
    }

    const tBadge = document.getElementById("hudTerrainBadge");
    if (terrain.label) {
      if (p.heldItems && p.heldItems["sharp_beak"] && terrain.speedMult < 1.0) {
        tBadge.textContent = `${terrain.label.split(' ')[0]} [銳利之喙：免疫減速]`;
      } else {
        tBadge.textContent = terrain.label;
      }
      tBadge.classList.remove("hidden");
    } else {
      tBadge.classList.add("hidden");
    }

    const pStatusEl = document.getElementById("hudPlayerStatusBadge");
    if (p.status) {
      const stNames = { Burn: "灼傷中", Paralysis: "麻痺減速", Freeze: "冰凍遲緩", Poison: "中毒中", Confusion: "混亂反向" };
      pStatusEl.textContent = `[異常] ${stNames[p.status] || p.status}`;
      pStatusEl.className = "px-2 py-0.5 bg-rose-950/80 text-rose-300 border border-rose-500 rounded-full font-black text-[10px]";
      pStatusEl.classList.remove("hidden");
    } else if (p.xAttackTimer > 0 || p.xSpeedTimer > 0) {
      const buffLabels = [];
      if (p.xAttackTimer > 0) buffLabels.push(`力量強化(${Math.ceil(p.xAttackTimer)}s)`);
      if (p.xSpeedTimer > 0) buffLabels.push(`速度強化(${Math.ceil(p.xSpeedTimer)}s)`);
      pStatusEl.textContent = `[增益] ${buffLabels.join(" ")}`;
      pStatusEl.className = "px-2 py-0.5 bg-amber-950/80 text-amber-300 border border-amber-500 rounded-full font-black text-[10px]";
      pStatusEl.classList.remove("hidden");
    } else {
      pStatusEl.classList.add("hidden");
    }

    const statusSpdMod = p.status === "Freeze" ? 0.45 : (p.status === "Paralysis" ? 0.65 : 1.0);
    const xSpdMod = p.xSpeedTimer > 0 ? 1.30 : 1.0;
    const hasSharpBeak = !!(p.heldItems && p.heldItems["sharp_beak"]);
    const sharpBeakSpdMod = hasSharpBeak ? 1.12 : 1.0;
    const finalTerrainSpd = (hasSharpBeak && terrain.speedMult < 1.0)
      ? 1.0
      : ((p.xSpeedTimer > 0 && terrain.inWater) ? 1.0 : terrain.speedMult);
    const quickStepMod = (p.quickStepTimer > 0) ? 1.15 : 1.0;
    const rawMoveSpd = (85 + p.baseSpeed * 1.15) * p.speedMult * sharpBeakSpdMod * finalTerrainSpd * statusSpdMod * (p.buffTimer > 0 ? 1.25 : 1.0) * xSpdMod * quickStepMod;
    // 主角速度軟上限 180 px/s，確保微操靈敏但避免中後期無腦風箏
    const moveSpd = Math.min(180, rawMoveSpd);

    p.vx = ix * moveSpd;
    p.vy = iy * moveSpd;
    if (p.dashTimer > 0) {
      // 若衝刺中途玩家突然將搖桿拉向反方向逃命，立即中斷物理衝刺，100% 歸還逃生控制權
      const dashLen = Math.hypot(p.dashVx || 0, p.dashVy || 0) || 1;
      const cosCancel = p.inputActive ? ((p.inputX * (p.dashVx || 0) + p.inputY * (p.dashVy || 0)) / dashLen) : 1;
      if (p.inputActive && cosCancel < -0.10) {
        p.dashTimer = 0;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      } else {
        p.dashTimer = Math.max(0, p.dashTimer - dt);
        p.x += (p.vx * 0.75 + (p.dashVx || 0)) * dt;
        p.y += (p.vy * 0.75 + (p.dashVy || 0)) * dt;
      }
    } else {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }

    // 速度強化藥水 (X Speed) 或 近戰前撲 (Dash / Lunge) 殘影軌跡記錄
    if (!p.speedTrails) p.speedTrails = [];
    if ((p.xSpeedTimer > 0 && ilen > 0.05) || p.dashTimer > 0 || p.lungeTimer > 0.06) {
      p._trailSampleTimer = (p._trailSampleTimer || 0) - dt;
      if (p._trailSampleTimer <= 0) {
        p._trailSampleTimer = p.dashTimer > 0 ? 0.035 : 0.055;
        p.speedTrails.push({
          x: p.x,
          y: p.y,
          facingX: p.facingX,
          facingY: p.facingY,
          isDash: p.dashTimer > 0,
          life: 0.20,
          maxLife: 0.20
        });
        if (p.speedTrails.length > 5) p.speedTrails.shift();
      }
    }
    for (let ti = p.speedTrails.length - 1; ti >= 0; ti--) {
      p.speedTrails[ti].life -= dt;
      if (p.speedTrails[ti].life <= 0) p.speedTrails.splice(ti, 1);
    }

    MapEngine.resolveObstacleCollision(p, 18, true);

    if (p.isJumpingLedge) {
      p.jumpTimer = (p.jumpTimer || 0) + dt;
      p.jumpY = Math.sin(Math.min(1, p.jumpTimer / 0.35) * Math.PI) * -18;
      if (p.jumpTimer >= 0.35) {
        p.isJumpingLedge = false;
        p.jumpTimer = 0;
        p.jumpY = 0;
      }
    } else {
      p.jumpY = 0;
    }

    const tc = this.trainerCompanion;
    const sideOffset = (p.facingX < 0 ? 24 : -24);
    const targetTx = p.x + sideOffset;
    const targetTy = p.y;
    tc.vy = (targetTy - tc.y);
    tc.vx = (targetTx - tc.x);
    tc.x += (targetTx - tc.x) * Math.min(1, dt * 30);
    tc.y += (targetTy - tc.y) * Math.min(1, dt * 30);
    tc.facingX = p.facingX;
    tc.facingY = p.facingY;
    tc.walkBob = p.walkBob;
    if (tc.whiteFlashTimer > 0) tc.whiteFlashTimer -= dt;

    // 主角起跳跨越木頭/懸崖時，訓練家無縫同步跟進起跳
    if (p.isJumpingLedge && !tc.isJumpingLedge) {
      tc.isJumpingLedge = true;
      tc.jumpTimer = 0;
    }

    // 訓練家獨立障礙碰撞與跨木樁/跳崖運算
    MapEngine.resolveObstacleCollision(tc, 18, true);
    if (tc.isJumpingLedge) {
      tc.jumpTimer = (tc.jumpTimer || 0) + dt;
      tc.jumpY = Math.sin(Math.min(1, tc.jumpTimer / 0.35) * Math.PI) * -18;
      if (tc.jumpTimer >= 0.35) {
        tc.isJumpingLedge = false;
        tc.jumpTimer = 0;
        tc.jumpY = 0;
      }
    } else {
      tc.jumpY = 0;
    }

    const midX = (p.x + this.trainerCompanion.x) * 0.5;
    const midY = (p.y + this.trainerCompanion.y) * 0.5;
    this.partnerOrbitBase += dt * 1.25;
    const upgPartnerMult = 1 + (this.saveData.upgrades.partner || 0) * 0.18;
    this.partners.forEach((pt, idx) => {
      const angle = this.partnerOrbitBase + idx * Math.PI;
      const skIdCheck = SKILLS_CATALOG[pt.data.skill] ? pt.data.skill : "Tackle";
      const skMetaCheck = SKILLS_CATALOG[skIdCheck];
      const isShortRange = !!(skMetaCheck && (skMetaCheck.isMelee || skIdCheck === "Thunderbolt"));

      // 目標鎖定記憶 (0.70s)：防止兩隻等距怪獸導致奇異種子等近戰夥伴高頻切換目標而抽搐閃動！
      pt.lockTimer = Math.max(0, (pt.lockTimer || 0) - dt);
      let nearTarget = pt.lockedTarget;
      const maxSearchR = isShortRange ? 230 : 360;
      const isValidLocked = nearTarget && nearTarget.hp > 0 && this.enemies.includes(nearTarget) && Math.hypot(nearTarget.x - midX, nearTarget.y - midY) <= maxSearchR + 35;

      if (!isValidLocked || pt.lockTimer <= 0) {
        nearTarget = this.findNearestEnemyInViewport(midX, midY, maxSearchR);
        pt.lockedTarget = nearTarget;
        pt.lockTimer = 0.70;
      }

      let tx = midX + Math.cos(angle) * 78;
      let ty = midY + Math.sin(angle) * 60;
      if (isShortRange && nearTarget) {
        const lungeAng = Math.atan2(nearTarget.y - midY, nearTarget.x - midX);
        const lungeDist = Math.min(132, Math.max(68, Math.hypot(nearTarget.x - midX, nearTarget.y - midY) - 24));
        tx = midX + Math.cos(lungeAng) * lungeDist;
        ty = midY + Math.sin(lungeAng) * lungeDist;
      }

      // 柔和阻尼平滑插值 (5.5)，徹底杜絕瞬移閃動感
      const prevX = pt.x;
      pt.x += (tx - pt.x) * Math.min(1, dt * 5.5);
      pt.y += (ty - pt.y) * Math.min(1, dt * 5.5);

      const moveDx = pt.x - prevX;
      if (nearTarget && Math.abs(nearTarget.x - pt.x) > 14) {
        pt.facingX = nearTarget.x >= pt.x ? 1 : -1;
      } else if (Math.abs(moveDx) > 0.6) {
        pt.facingX = moveDx >= 0 ? 1 : -1;
      } else {
        pt.facingX = p.facingX;
      }
      pt.facingY = p.facingY;

      pt.cdTimer -= dt;
      if (pt.cdTimer <= 0) {
        const target = nearTarget || this.findNearestEnemyInViewport(pt.x, pt.y, 360);
        if (target) {
          const skId = SKILLS_CATALOG[pt.data.skill] ? pt.data.skill : "Tackle";
          const isPartnerBond = (this.selectedTrainer.bondPokemonIds || []).includes(pt.id);
          const bondMult = isPartnerBond ? 1.20 : 1.0;
          const isAwakened = pt.level >= 5;
          pt.shotCount = (pt.shotCount || 0) + 1;
          const burstMult = (isAwakened && pt.shotCount % 4 === 0) ? 1.45 : 1.0;
          SkillsEngine.fireSkill(pt, skId, Math.min(10, pt.level + (isAwakened ? 2 : 0)), false, upgPartnerMult * 0.68 * bondMult * burstMult);
          if (burstMult > 1.0) {
            this.spawnParticleCluster(pt.x, pt.y, "#EC4899", "#FDE047", 10, "star", 0.7);
          }
          pt.cdTimer = isAwakened ? 0.95 : 1.35;
        }
      }
    });

    this.camera.x = p.x;
    this.camera.y = p.y;

    const psychicCdMod = (MapEngine.weather === "PSYCHIC" ? 0.92 : 1.0);
    const spoonCdMod = (p.heldItems && p.heldItems["twisted_spoon"]) ? 0.92 : 1.0;
    const pillarCdMod = (MapEngine.currentStage.id === "sky_pillar") ? 0.92 : 1.0;
    const cdFactor = Math.max(0.45, p.cdMult * (p.buffTimer > 0 ? 0.70 : 1.0) * psychicCdMod * spoonCdMod * pillarCdMod);
    p.castStaggerTimer = Math.max(0, (p.castStaggerTimer || 0) - dt);
    p.superMoveIcdTimer = Math.max(0, (p.superMoveIcdTimer || 0) - dt);

    const allSkillSlots = Object.values(p.skills);
    const evolvedSlots = allSkillSlots.filter(s => s.evolved);
    const hasDualSuper = evolvedSlots.length >= 2;

    allSkillSlots.forEach((skSlot, slotIdx) => {
      skSlot.timer = Math.max(0, skSlot.timer - dt);
      if (skSlot.timer <= 0) {
        const meta = SKILLS_CATALOG[skSlot.id];
        if (!meta) return;

        // 1. 智能有效射程觸發 (Range-Gated Smart Trigger)：
        // 在「自動索敵模式」下，必須有敵人踏入該招式的有效射程內才發動（沒怪時保持 timer = 0 待命蓄力，絕不對空氣亂放）；
        // 若玩家主動切換為「🧭 朝向（手動突圍）」模式，則允許無條件持續開火！
        if (!this.manualAimMode) {
          const trait = p.innateTrait || {};
          const lv = skSlot.level || 1;
          const meleeAreaScale = p.areaMult * (lv >= 3 ? 1.15 : 1.0) * (lv >= 8 ? 1.25 : 1.0) * (1 + (trait.legendaryAreaBonus || 0));
          let triggerRange = 330 * p.areaMult;
          if (skSlot.evolved) {
            triggerRange = 245 * p.areaMult;
          } else if (meta.isMelee) {
            // 精準對齊各近戰招式的真實有效打擊距離 (乘以 0.90 貼身裕度，確保怪獸踏入打擊圈內才出招，徹底根除打空氣！)
            if (meta.meleeStyle === "slam_wave") {
              // 撞擊 (Tackle)：Lv.1 第一波真實距離 ~80px，隨 Lv.4 二段 / Lv.8 三段震波延伸
              const tackleScale = p.areaMult * (lv >= 3 ? 1.20 : 1.0) * (lv >= 8 ? 1.25 : 1.0) * (1 + (trait.tackleQuakeAreaBonus || 0));
              const waves = 1 + (lv >= 4 ? 1 : 0) + (lv >= 8 ? 1 : 0);
              const actualReach = (28 + (waves - 1) * 24 + 50 + (waves - 1) * 10) * tackleScale;
              triggerRange = actualReach * 0.88;
            } else if (meta.meleeStyle === "martial_fist") {
              // 空手劈 (Karate Chop)：真實距離 ~90px * meleeAreaScale
              const actualReach = 90 * meleeAreaScale * (1 + (trait.ironFistAreaBonus || 0));
              triggerRange = actualReach * 0.90;
            } else if (meta.meleeStyle === "quake_wave") {
              // 地震 (Earthquake)：真實距離 (85 + lv * 4) * meleeAreaScale
              const actualReach = (85 + lv * 4) * meleeAreaScale * (1 + (trait.tackleQuakeAreaBonus || 0));
              triggerRange = actualReach * 0.88;
            } else if (meta.meleeStyle === "vine_whip") {
              // 藤鞭 (Vine Whip)：真實距離 24 + (135 + lv * 7) * meleeAreaScale
              const actualReach = 20 + (135 + lv * 7) * meleeAreaScale * (1 + (trait.overgrowAreaBonus || 0));
              triggerRange = actualReach * 0.88;
            } else {
              // 龍之俯衝 (Dragon Rush) 與其他近戰
              triggerRange = 135 * meleeAreaScale;
            }
          } else if (skSlot.id === "Thunderbolt") {
            triggerRange = 168 * p.areaMult;
          } else if (skSlot.id === "Ember") {
            triggerRange = 185 * p.areaMult;
          } else if (skSlot.id === "WaterGun" || skSlot.id === "Flamethrower") {
            triggerRange = 245 * p.areaMult;
          }
          const hasTargetInRange = this.findNearestEnemyInViewport(p.x, p.y, triggerRange);
          if (!hasTargetInRange) {
            skSlot.timer = 0; // 保持蓄勢待發，一旦怪進圈 0 秒瞬發
            return;
          }
        }

        if (skSlot.evolved) {
          // 2. 選項 A 雙超武平衡與 1.1s 錯峰共鳴：防止雙超武同幀重疊閃瞎眼並平衡秒王強度
          if (p.superMoveIcdTimer > 0) {
            skSlot.timer = p.superMoveIcdTimer;
            return;
          }
          const isSecondSuper = hasDualSuper && evolvedSlots[1] === skSlot;
          const ultDmgScale = isSecondSuper ? 0.78 : 1.0;
          const dualCdPenalty = hasDualSuper ? 1.18 : 1.0;

          SkillsEngine.triggerUltimateSuperMove(meta, skSlot, ultDmgScale);
          const minUltCd = (meta.ultMinCd || 3.2) * dualCdPenalty;
          skSlot.timer = Math.max(minUltCd, meta.baseCd * 2.45 * cdFactor * dualCdPenalty);
          p.superMoveIcdTimer = 1.10; // 強制與下一發超武錯開至少 1.1 秒
          p.castStaggerTimer = 0.08;
        } else {
          if (p.castStaggerTimer > 0) {
            skSlot.timer = 0.015; // 全局微序列排隊，防止多把子彈武器同一毫秒重疊發射
            return;
          }
          SkillsEngine.fireSkill(p, skSlot.id, skSlot.level, false, 1.0, slotIdx);
          const lvCdBonus = skSlot.level >= 9 ? 0.75 : (skSlot.level >= 4 ? 0.88 : 1.0);
          const isQuickSkill = ["Tackle", "AirSlash", "Air Slash", "Thunderbolt"].includes(skSlot.id);
          const traitCdMod = (p.innateTrait && (isQuickSkill || p.innateTrait.id === "legendary_pressure"))
            ? (p.innateTrait.quickAttackCdMult || 1.0)
            : 1.0;
          skSlot.timer = Math.max(0.35, meta.baseCd * lvCdBonus * Math.max(0.45, cdFactor * traitCdMod));
          p.castStaggerTimer = 0.085;
        }
      }
    });

    if (!this.debugWeatherLock && !this.activeBoss) {
      this.weatherCycleTimer = (this.weatherCycleTimer || 80) - dt;
      if (this.weatherCycleTimer <= 0) {
        this.weatherCycleTimer = 80; // 每 80 秒隨機輪替一次，錯開吉利蛋 38s 刷新
        const weatherPool = ["CLEAR", "RAIN", "THUNDER", "BLIZZARD", "HEATWAVE", "PSYCHIC"];
        const available = weatherPool.filter(w => w !== MapEngine.weather);
        const nextWeather = available[Math.floor(Math.random() * available.length)] || "CLEAR";
        
        MapEngine.setWeather(nextWeather);
        this.updateWeatherUI(nextWeather);

        const weatherNames = {
          CLEAR: "晴天", RAIN: "微雨", THUNDER: "狂暴雷暴",
          BLIZZARD: "極寒暴雪", HEATWAVE: "烈日熱浪", PSYCHIC: "超能極光"
        };
        const weatherEffects = {
          CLEAR: "天候恢復平靜，標準視野與戰鬥環境。",
          RAIN: "水系招式威力+25%，火系-20%！淺灘涉水每秒回血！",
          THUNDER: "雷電狂暴！電系招式彈射+1，伴隨全屏天頂白閃！",
          BLIZZARD: "極寒襲來！冰系威力+20%，地面精靈移速微緩！",
          HEATWAVE: "炎熱高溫！火系威力+25%，灼傷扣血速率提升50%！",
          PSYCHIC: "極光籠罩！超能/幽靈暴擊率+15%，技能冷卻-8%！"
        };
        this.showCutsceneBanner(`【氣候異變：${weatherNames[nextWeather]}】`, weatherEffects[nextWeather] || "環境異變！", 3800);
        SoundFX.play("super");
      }
    }

    MapEngine.updateWeather(dt, this.width, this.height);
    SkillsEngine.update(dt);
    this.updateSpawners(dt);
    this.updateTelegraphs(dt);
    this.updateEnemyProjectiles(dt);
    this.updateEnemies(dt);
    this.updateLootAndGems(dt);
    this.updateMartInteraction(dt);
    this.updateParticlesAndTexts(dt);
    this.refreshHUD();
  },

  findNearestEnemyInViewport(ox, oy, maxRange = 420) {
    let best = null;
    let bestScore = maxRange;
    const now = performance.now();
    const halfW = this.width / 2 + 40;
    const halfH = this.height / 2 + 40;
    const pool = (typeof SkillsEngine !== "undefined" && SkillsEngine.getEnemiesInRadius)
      ? SkillsEngine.getEnemiesInRadius(ox, oy, maxRange)
      : this.enemies;
    for (let i = 0; i < pool.length; i++) {
      const e = pool[i];
      if (!e || e.hp <= 0) continue;
      if (Math.abs(e.x - this.player.x) > halfW || Math.abs(e.y - this.player.y) > halfH) continue;
      const d = Math.hypot(e.x - ox, e.y - oy);
      if (d > maxRange) continue;
      // 若該目標剛被前一把武器鎖定 (<140ms)，加上 65px 虛擬距離權重，引導第二把武器優先分流打旁邊的怪
      const lockPenalty = (e._targetLockUntil && e._targetLockUntil > now) ? 65 : 0;
      if (d + lockPenalty < bestScore) {
        bestScore = d + lockPenalty;
        best = e;
      }
    }
    if (best) best._targetLockUntil = now + 140;
    return best;
  },

  findPriorityTargetInViewport(ox, oy, maxRange = 400, mode = "highest_hp") {
    const halfW = this.width / 2 + 40;
    const halfH = this.height / 2 + 40;
    const candidates = [];
    const pool = (typeof SkillsEngine !== "undefined" && SkillsEngine.getEnemiesInRadius)
      ? SkillsEngine.getEnemiesInRadius(ox, oy, maxRange)
      : this.enemies;
    for (let i = 0; i < pool.length; i++) {
      const e = pool[i];
      if (!e || e.hp <= 0) continue;
      if (Math.abs(e.x - this.player.x) > halfW || Math.abs(e.y - this.player.y) > halfH) continue;
      const d = Math.hypot(e.x - ox, e.y - oy);
      if (d <= maxRange) candidates.push({ e, d });
    }
    if (candidates.length === 0) return null;

    if (mode === "highest_hp") {
      // 若最近目標已在 120px 內，直接優先鎖定最近目標自衛；否則鎖定視野內高血量精英/Boss
      candidates.sort((a, b) => a.d - b.d);
      if (candidates[0].d <= 120) return candidates[0].e;
      candidates.sort((a, b) => (b.e.hp - a.e.hp) || (a.d - b.d));
      return candidates[0].e;
    }

    if (mode === "cluster") {
      // 尋找周圍 85px 內怪物數量最密集的怪群核心
      let bestTarget = candidates[0].e;
      let bestScore = -1;
      for (const c of candidates) {
        let neighbors = 0;
        for (const other of candidates) {
          const dx = other.e.x - c.e.x, dy = other.e.y - c.e.y;
          if (dx * dx + dy * dy <= 7225) neighbors++;
        }
        const score = neighbors * 100 - c.d * 0.1;
        if (score > bestScore) {
          bestScore = score;
          bestTarget = c.e;
        }
      }
      return bestTarget;
    }

    return candidates[0].e;
  },

  spawnParticleCluster(x, y, c1, c2, count = 14, shape = "circle", speedScale = 1.0) {
    for (let i = 0; i < count; i++) {
      if (this.particles.length > 300) this.particles.shift();
      const ang = Math.random() * Math.PI * 2;
      const spd = (25 + Math.random() * 115) * speedScale;
      this.particles.push({
        x: x + (Math.random() - 0.5) * 12,
        y: y + (Math.random() - 0.5) * 12,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        size: 3.5 + Math.random() * 4.5,
        color: i % 2 === 0 ? c1 : c2,
        shape,
        rot: Math.random() * Math.PI * 2,
        life: 0.28 + Math.random() * 0.24,
        maxLife: 0.52
      });
    }
  },

  isMobileDevice() {
    return window.innerWidth < 768 || !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
  },

  getEffectiveMobCap(minutes) {
    if (this.debugMobCap > 0) return this.debugMobCap;
    if (this.activeBoss && this.activeBoss.hp > 0) return 85;
    const prof = (this.saveData && this.saveData.settings && this.saveData.settings.mobCapProfile) || "auto";
    if (prof === "low") return 100;
    if (prof === "standard") return 160;
    if (prof === "extreme") return 250;
    // auto: 自動依裝置分流 (手機直向甜區 120隻、電腦寬屏 190隻)
    if (this.isMobileDevice()) {
      return Math.min(120, Math.round(62 + minutes * 10));
    }
    return Math.min(190, Math.round(80 + minutes * 16));
  },

  updateSpawners(dt) {
    const diff = this.selectedDifficulty;
    const minutes = this.runTime / 60;

    this.martSpawnTimer = (this.martSpawnTimer || 110) - dt;
    if (this.martSpawnTimer <= 0) {
      this.martSpawnTimer = 110;
      this.spawnPokeMartEntity(false);
    }

    if (!this.migrationEventTriggered && this.runTime >= 90) {
      this.migrationEventTriggered = true;
      this.triggerMigrationSwarmEvent(false);
    }

    if (!this.rocketEventTriggered && this.runTime >= 195) {
      this.rocketEventTriggered = true;
      this.showCutsceneBanner("【火箭隊突襲】", "黑化怪獸帶著劇毒霧氣包夾衝鋒！", 3200);
      SoundFX.play("boss");
      for (let k = 0; k < 6; k++) {
        const ang = (k * Math.PI * 2) / 6;
        const ex = this.player.x + Math.cos(ang) * 360;
        const ey = this.player.y + Math.sin(ang) * 360;
        const pId = k % 2 === 0 ? 24 : 110;
        const pData = POKEMON_MAP.get(pId);
        this.enemies.push({
          id: pId, data: pData, x: ex, y: ey,
          hp: 420 * this.selectedDifficulty.hpMult,
          maxHp: 420 * this.selectedDifficulty.hpMult,
          atk: 24, speed: 75, radius: 26, isElite: true, isBoss: false, isShiny: false,
          facingX: -1, facingY: 1, status: "Poison", statusTimer: 99, statusTick: 99,
          ccImmunityTimer: 1.5, rangedCd: 3.5, whiteFlashTimer: 0, weightTier: "heavy", kbResist: 0.7
        });
      }
    }

    if (!this.taurosStampedeTriggered && this.runTime >= 240) {
      this.taurosStampedeTriggered = true;
      this.showCutsceneBanner("【肯泰羅暴走狂潮】", "大群狂暴肯泰羅橫向踐踏！利用跳崖或繞水規避！", 3500);
      SoundFX.play("super");
      const startX = this.player.x - this.width / 2 - 120;
      for (let row = -3; row <= 3; row++) {
        const ey = this.player.y + row * 65;
        const tData = POKEMON_MAP.get(128);
        this.enemies.push({
          id: 128, data: tData, x: startX - Math.abs(row) * 35, y: ey,
          hp: 600 * this.selectedDifficulty.hpMult,
          maxHp: 600 * this.selectedDifficulty.hpMult,
          atk: 32, speed: 130, radius: 28, isElite: true, isBoss: false, isShiny: false,
          facingX: 1, facingY: 0, status: null, statusTimer: 0, statusTick: 0,
          ccImmunityTimer: 999, rangedCd: 999, whiteFlashTimer: 0, weightTier: "heavy", kbResist: 0.95
        });
      }
    }

    if (!this.birdBossSpawned && this.runTime >= 300) {
      this.birdBossSpawned = true;
      const birdIds = [144, 145, 146];
      this.spawnBoss(birdIds[Math.floor(Math.random() * birdIds.length)], false);
    }

    if (!this.prehistoricEventTriggered && this.runTime >= 375) {
      this.prehistoricEventTriggered = true;
      this.triggerPrehistoricTrialEvent(false);
    }

    if (!this.mewtwoBossSpawned && this.runTime >= 450) {
      this.mewtwoBossSpawned = true;
      this.spawnBoss(150, true);
    }

    // 【♾️ 無盡深淵試煉模式】8:00 (480s) 後每 120 秒輪迴降臨強化神獸 Boss 並切換極端天象！
    if (this.isEndlessMode && this.runTime >= (this.endlessNextBossTime || 480) && !this.activeBoss) {
      this.endlessNextBossTime = Math.floor(this.runTime) + 120;
      const cycleList = [144, 145, 146, 150, 151];
      const nextBossId = cycleList[(this.endlessCycleIdx || 0) % cycleList.length];
      this.endlessCycleIdx = (this.endlessCycleIdx || 0) + 1;
      const cycleWave = Math.floor((this.runTime - 480) / 120) + 1;
      this.showCutsceneBanner(
        `【♾️ 無盡深淵・第 ${cycleWave} 輪天災】`,
        `深淵裂隙擴張！神獸【${POKEMON_MAP.get(nextBossId)?.name_zh || '傳說神獸'}】降臨，賞金倍率持續飆升！`,
        3400
      );
      this.spawnBoss(nextBossId, nextBossId === 150);
    }

    this.magnetSpawnTimer -= dt;
    if (this.magnetSpawnTimer <= 0) {
      this.magnetSpawnTimer = 35;
      const activeMagnets = this.mapItems.filter(i => i.id === "magnet").length;
      if (activeMagnets < 2) {
        const ang = Math.random() * Math.PI * 2;
        this.spawnMapLoot("magnet", this.player.x + Math.cos(ang) * 320, this.player.y + Math.sin(ang) * 320);
      }
    }

    this.treasureSpawnTimer -= dt;
    if (this.treasureSpawnTimer <= 0) {
      this.treasureSpawnTimer = 38;
      const isMeowth = Math.random() < 0.58;
      this.spawnTreasureMonster(isMeowth ? "meowth" : "chansey");
    }

    this.eliteSpawnTimer -= dt;
    if (this.eliteSpawnTimer <= 0) {
      this.eliteSpawnTimer = 45;
      this.spawnWildEnemy(true);
    }

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      const bossThrottle = (this.activeBoss && this.activeBoss.hp > 0) ? 1.65 : 1.0;
      const baseInterval = Math.max(0.24, (1.15 - minutes * 0.12) / diff.spawnRateMult) * bossThrottle;
      this.spawnTimer = baseInterval;

      const maxMobCap = this.getEffectiveMobCap(minutes);
      if (this.enemies.length < maxMobCap) {
        this.spawnWildEnemy(false);
        if (!this.activeBoss && minutes >= 4.0 && this.enemies.length < maxMobCap - 5) {
          this.spawnWildEnemy(false);
        }
      }
    }
  },

  spawnWildEnemy(isElite = false) {
    const minutes = this.runTime / 60;
    const diff = this.selectedDifficulty;

    const ang = Math.random() * Math.PI * 2;
    const viewEdge = Math.hypot(this.width, this.height) * 0.45;
    const dist = Math.min(380, Math.max(260, viewEdge)) + (isElite ? 40 : 0);
    const ex = this.player.x + Math.cos(ang) * dist;
    const ey = this.player.y + Math.sin(ang) * dist;

    const spawnTerrain = MapEngine.getTerrainModifierAt(ex, ey);
    const isWater = spawnTerrain.inWater;

    let candidates = REGULAR_MOB_POOL;
    if (isElite) {
      // 【精英小王階級門檻】：嚴格限定僅會刷出「二階進化型、三階最終完全體、或單階猛將」，絕不出現一階幼體小怪戴皇冠！
      const evolvedOrSingleStrong = REGULAR_MOB_POOL.filter(p => {
        const hasParent = POKEMON_DB.some(parent => parent.evo_to === p.id || ([134, 135, 136].includes(p.id) && parent.id === 133));
        const isSinglePowerhouse = (!hasParent && !p.evo_to && p.hp >= 132);
        return hasParent || isSinglePowerhouse;
      });
      if (minutes >= 3.0) {
        const finalForms = evolvedOrSingleStrong.filter(p => !p.evo_to);
        candidates = finalForms.length > 0 ? finalForms : evolvedOrSingleStrong;
      } else {
        candidates = evolvedOrSingleStrong.length > 0 ? evolvedOrSingleStrong : REGULAR_MOB_POOL;
      }
    } else {
      if (minutes < 1.5) candidates = REGULAR_MOB_POOL.filter(p => p.hp <= 140);
      else if (minutes < 4.0) candidates = REGULAR_MOB_POOL.filter(p => p.hp <= 260);
    }

    if (MapEngine.currentStage.id === "cerulean_bay" && isWater) {
      const waterFlyPool = candidates.filter(p => 
        (p.type1 === "Water" || p.type2 === "Water" || p.type1 === "Flying" || p.type2 === "Flying") &&
        ![50, 51, 74, 95].includes(p.id)
      );
      if (waterFlyPool.length > 0 && Math.random() < 0.85) {
        candidates = waterFlyPool;
      } else {
        candidates = candidates.filter(p => ![50, 51, 74, 95].includes(p.id));
      }
    }

    const pick = candidates[Math.floor(Math.random() * candidates.length)] || REGULAR_MOB_POOL[0];
    const loadoutShinyMod = (this.player && this.player.loadoutShinyMult) ? this.player.loadoutShinyMult : 1.0;
    const shinyChance = 0.0025 * (1 + (this.saveData.upgrades.shiny || 0) * 0.35) * (this.selectedTrainer.mods.shinyBoost || 1) * (diff.shinyBonus || 1.0) * loadoutShinyMod;
    const isShiny = Math.random() < shinyChance;

    const timeHpScale = 1 + (minutes * 0.80) + Math.pow(minutes / 2.3, 2.0) * 0.90;
    let rawHp = (35 + pick.hp * 0.55) * timeHpScale * diff.hpMult * (isElite ? 3.8 : 1.0) * (isShiny ? 1.6 : 1.0);
    // 遠程怪體質保底：防止在手機小螢幕邊界被一擊瞬秒，確保有機會出招
    const isRangedMob = [23, 24, 35, 41, 42, 48, 60, 69, 70, 81, 109, 110, 116, 117, 120].includes(pick.id);
    if (isRangedMob && !isElite) {
      rawHp = Math.max(110 * timeHpScale * diff.hpMult, rawHp * 1.35);
    }
    let hp = Math.round(rawHp);
    if (isElite && minutes >= 4.0) hp = Math.round(hp * 1.12);

    const lateAtkCurve = minutes <= 4.5 ? (1 + minutes * 0.14) : (1.63 + (minutes - 4.5) * 0.08);
    const atk = Math.round((7 + pick.atk * 0.30) * lateAtkCurve * diff.atkMult * (isElite ? 1.38 : 1.0));

    this.saveData.pokedexSeen[pick.id] = true;

    this.enemies.push({
      id: pick.id,
      data: pick,
      x: ex,
      y: ey,
      hp,
      maxHp: hp,
      atk,
      speed: (48 + pick.speed * 0.52) * diff.spdMult * (isElite ? 1.25 : 1.0),
      radius: isElite ? 30 : 20,
      isElite,
      isBoss: false,
      isShiny,
      treasureType: null,
      facingX: -1,
      facingY: 1,
      status: null,
      statusTimer: 0,
      statusTick: 0,
      ccImmunityTimer: 0,
      rangedCd: 0.05, // 生成時即刻準備，進場立即開火第一發！
      whiteFlashTimer: 0,
      weightTier: pick.weightTier || "light",
      kbResist: pick.kbResist !== undefined ? pick.kbResist : 0.0
    });
  },

  spawnTreasureMonster(kind) {
    const pokeId = kind === "meowth" ? 52 : 113;
    const pData = POKEMON_MAP.get(pokeId);
    const ang = Math.random() * Math.PI * 2;
    const ex = this.player.x + Math.cos(ang) * 340;
    const ey = this.player.y + Math.sin(ang) * 340;
    const diff = this.selectedDifficulty;
    const hp = Math.round((kind === "meowth" ? 260 : 620) * (1 + (this.runTime / 60) * 0.40) * diff.hpMult);

    this.saveData.pokedexSeen[pokeId] = true;
    this.enemies.push({
      id: pokeId,
      data: pData,
      x: ex,
      y: ey,
      hp,
      maxHp: hp,
      atk: 0,
      speed: kind === "meowth" ? 130 : 54,
      radius: 24,
      isElite: false,
      isBoss: false,
      isShiny: false,
      treasureType: kind,
      escapeTimer: 20.0,
      facingX: -1,
      facingY: 1,
      status: null,
      statusTimer: 0,
      statusTick: 0,
      ccImmunityTimer: 0,
      rangedCd: 999,
      whiteFlashTimer: 0,
      weightTier: "medium",
      kbResist: 0.20
    });

    const msg = kind === "meowth"
      ? "發現野生【聚寶喵喵 #052】！沿金色箭頭追擊！"
      : "發現野生【幸福吉利蛋 #113】！沿粉色箭頭追擊！";
    this.showCutsceneBanner("[稀有寶藏精靈登場]", msg, 3000);
  },

  spawnPokeMartEntity(nearPlayer = false) {
    const activeMarts = this.mapItems.filter(i => i.id === "poke_mart").length;
    if (activeMarts < 1) {
      const ang = Math.random() * Math.PI * 2;
      const dist = nearPlayer ? 140 : 340;
      const mx = this.player.x + Math.cos(ang) * dist;
      const my = this.player.y + Math.sin(ang) * dist;
      this.mapItems.push({
        id: "poke_mart",
        x: mx,
        y: my,
        bobPhase: 0,
        standTimer: 0,
        meta: {
          name: "友好商店",
          color: "#38BDF8",
          sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/town-map.png"
        }
      });
      this.showCutsceneBanner("【友好商店 (Poké Mart) 登場】", "靠近並站定 0.5 秒即可進店選購 TM 學習機！", 3000);
    }
  },

  updateMartInteraction(dt) {
    if (!this.player || this.state !== "PLAYING") return;
    const p = this.player;
    const mart = this.mapItems.find(it => it.id === "poke_mart");
    const promptBtn = document.getElementById("hudEnterMartPrompt");

    if (!mart) {
      if (promptBtn) promptBtn.classList.add("hidden");
      return;
    }

    const d = Math.hypot(p.x - mart.x, p.y - mart.y);
    const inRange = d < 75;

    // 方案A：靠近範圍內時顯示右側快捷進入按鈕
    if (promptBtn) {
      promptBtn.classList.toggle("hidden", !inRange);
    }

    // 同步支援站定 0.35 秒自動開門 (帶有環形進度條)
    const isStationary = Math.hypot(p.vx, p.vy) < 18;
    if (inRange && isStationary) {
      mart.standTimer = (mart.standTimer || 0) + dt;
      if (mart.standTimer >= 0.35) {
        mart.standTimer = 0;
        if (promptBtn) promptBtn.classList.add("hidden");
        this.openPokeMartModal();
      }
    } else {
      mart.standTimer = Math.max(0, (mart.standTimer || 0) - dt * 2);
    }
  },

  openPokeMartModal() {
    this.state = "PAUSED";
    // 強制重置搖桿與輸入，防止多點觸控狀態殘留死鎖
    this.touchJoy.active = false;
    this.touchJoy.dx = 0;
    this.touchJoy.dy = 0;
    const joyBase = document.getElementById("touchJoyBase");
    const joyStick = document.getElementById("touchJoyStick");
    if (joyBase) joyBase.style.display = "none";
    if (joyStick) joyStick.style.display = "none";
    const p = this.player;
    const tmCatalog = typeof TM_CATALOG !== "undefined" ? TM_CATALOG : {};
    const specItems = typeof MART_SPECIAL_ITEMS !== "undefined" ? MART_SPECIAL_ITEMS : {};
    
    const findExistingSkill = (sId) => {
      const clean = sId.replace(/\s+/g, '');
      const key = Object.keys(p.skills).find(k => k.replace(/\s+/g, '') === clean);
      return key ? p.skills[key] : null;
    };

    const shelf = [];
    // 允許刷出尚未學習的 TM 或 已學習但尚未滿級 (<Lv.10) 的 TM，讓玩家既能學新招也能直接買 TM 升招式等級
    const availableTMs = Object.values(tmCatalog).filter(tm => {
      const ex = findExistingSkill(tm.id);
      return !ex || ex.level < 10;
    });
    if (availableTMs.length > 0) {
      shelf.push(availableTMs[Math.floor(Math.random() * availableTMs.length)]);
    }

    const medPool = [specItems.pp_up, specItems.full_restore].filter(Boolean);
    if (medPool.length > 0) {
      shelf.push(medPool[Math.floor(Math.random() * medPool.length)]);
    }

    const buffPool = [specItems.x_attack, specItems.x_speed].filter(Boolean);
    if (buffPool.length > 0) {
      shelf.push(buffPool[Math.floor(Math.random() * buffPool.length)]);
    }

    // 中後期或高代幣時，友好商店加開第 4 格【高階補給】（極限神奇糖果 / 秘傳攜帶物禮盒）
    const highTierPool = [specItems.master_candy, specItems.mystery_held].filter(Boolean);
    if (highTierPool.length > 0 && (this.runTime >= 150 || this.runCoins >= 220)) {
      shelf.push(highTierPool[Math.floor(Math.random() * highTierPool.length)]);
    }

    if (this.renderMartModal) this.renderMartModal(shelf);
  },

  // 友好商店購買與關閉邏輯統一由 game_ui.js 接管 (Single Source of Truth)
  buyTM(skillId, cost) {
    if (this.buyMartItem) this.buyMartItem(skillId, cost);
  },

  triggerRoyalShieldBurst(isAutoPulse = false) {
    const p = this.player;
    if (!p) return;
    p.multiscaleReady = false;
    p.multiscaleTimer = 10.0;
    p.royalAutoPulseTimer = 6.5;
    p.invulnTimer = Math.max(p.invulnTimer || 0, 0.65);

    this.spawnParticleCluster(p.x, p.y, "#FACC15", "#38BDF8", 20, "star", 1.1);
    if (p.innateTrait && p.innateTrait.id === "legendary_pressure") {
      const novaCol = TYPE_COLORS[p.data.type1] || "#F472B6";
      SkillsEngine.meleeEffects.push({
        style: "slam_wave",
        x: p.x, y: p.y,
        radius: 185, timer: 0.40, maxTime: 0.40,
        color: novaCol
      });
      [...this.enemies].forEach(en => {
        if (en && en.hp > 0 && Math.hypot(en.x - p.x, en.y - p.y) <= 190 + en.radius) {
          if (!en.isBoss) {
            const a = Math.atan2(en.y - p.y, en.x - p.x);
            en.x += Math.cos(a) * 85;
            en.y += Math.sin(a) * 85;
          }
          this.dealDamageToEnemy(en, (p.baseAtk * 1.25 + 35) * p.dmgMult, p.data.type1 || "Psychic", 0.60, 22);
        }
      });
      SoundFX.play("super");
      this.spawnFloatingText(p.x, p.y - 28, isAutoPulse ? "👑 傳說王權：神聖威壓新星!" : "👑 傳說王權：護盾反震新星!", "#FACC15", 14);
    } else {
      SoundFX.play("hit");
      this.spawnFloatingText(p.x, p.y - 24, "🛡️ 多重鱗片抵擋傷害!", "#FACC15", 14);
    }
  },

  updateEnemies(dt) {
    const p = this.player;
    const halfW = this.width / 2 - 16;
    const halfH = this.height / 2 - 16;
    this._frameCounter = ((this._frameCounter || 0) + 1) % 600;

    // 建立 80x80 空間雜湊網格 (Spatial Hash Grid)，供怪物推擠與 SkillsEngine 彈幕碰撞共享 O(1) 查詢
    const gridCellSize = 80;
    const spatialGrid = new Map();
    for (let idx = 0; idx < this.enemies.length; idx++) {
      const ent = this.enemies[idx];
      const gx = Math.floor(ent.x / gridCellSize);
      const gy = Math.floor(ent.y / gridCellSize);
      const key = `${gx},${gy}`;
      let cell = spatialGrid.get(key);
      if (!cell) {
        cell = [];
        spatialGrid.set(key, cell);
      }
      cell.push(ent);
    }
    this.spatialGrid = spatialGrid;

    // 預先快取場上的劇毒沼澤領域，避免每隻怪每幀重複跑陣列 .some()
    const activeSwamps = SkillsEngine.groundHazards.filter(hz => hz.kind === "toxic_swamp");

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.ccImmunityTimer > 0) e.ccImmunityTimer -= dt;
      if (e.whiteFlashTimer > 0) e.whiteFlashTimer -= dt;

      if (e.treasureType) {
        e.escapeTimer -= dt;
        if (e.escapeTimer <= 0) {
          this.spawnFloatingText(e.x, e.y, "寶藏精靈逃走了!", "#94A3B8", 12);
          this.enemies.splice(i, 1);
          continue;
        }
      }

      if (e.weakenTimer > 0) e.weakenTimer -= dt;
      let inToxicSwamp = false;
      for (let sIdx = 0; sIdx < activeSwamps.length; sIdx++) {
        const sw = activeSwamps[sIdx];
        const sdx = e.x - sw.x, sdy = e.y - sw.y;
        const sr = sw.radius + e.radius;
        if (sdx * sdx + sdy * sdy <= sr * sr) {
          inToxicSwamp = true;
          break;
        }
      }

      if (e.statusTimer > 0) {
        e.statusTimer -= dt;
        e.statusTick -= dt;
        if (e.statusTick <= 0) {
          e.statusTick = 0.55;
          if (e.status === "Burn") {
            const heatwaveMod = (MapEngine.weather === "HEATWAVE" ? 1.5 : 1.0);
            const rawBurn = Math.max(6, Math.round(e.maxHp * 0.018 * heatwaveMod));
            const bDmg = e.isBoss ? Math.min(rawBurn, Math.round(160 * heatwaveMod)) : rawBurn;
            e.hp -= bDmg;
            this.spawnFloatingText(e.x, e.y - 14, `灼傷 -${bDmg}`, "#F97316", 11);
          } else if (e.status === "Poison") {
            const swampMult = inToxicSwamp ? 2.0 : 1.0;
            const rawPsn = Math.max(8, Math.round(e.maxHp * 0.022 * swampMult));
            const pDmg = e.isBoss ? Math.min(rawPsn, Math.round(145 * swampMult)) : rawPsn;
            e.hp -= pDmg;
            this.spawnFloatingText(e.x, e.y - 14, `${inToxicSwamp ? '劇毒腐蝕' : '中毒'} -${pDmg}`, "#A855F7", 11);
          }
          if (e.hp <= 0) {
            this.handleEnemyDeath(e, i);
            continue;
          }
        }
        if (e.statusTimer <= 0) {
          // 解除硬控（冰凍/麻痺/混亂）時賦予全員韌性保護期，防止被高頻彈幕無限永控
          if (["Freeze", "Paralysis", "Confusion"].includes(e.status)) {
            e.ccImmunityTimer = e.isBoss ? 3.5 : (e.isElite ? 2.6 : 1.8);
          }
          e.status = null;
        }
      }

      if (e.status === "Freeze") continue;

      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const inView = Math.abs(dx) <= halfW && Math.abs(dy) <= halfH;
      const nearView = Math.abs(dx) <= halfW + 70 && Math.abs(dy) <= halfH + 70;
      const dist = Math.hypot(dx, dy) || 1;

      const paraMult = e.status === "Paralysis" ? 0.35 : 1.0;
      const confDir = e.status === "Confusion" ? -0.22 : 1.0;
      let eTerrMult = 1.0;

      // 效能加速 #1：僅對視野內 (nearView) 怪獸每 4 幀採樣一次地形緩速並快取，畫面外百怪直接略過地形查詢
      if (!e.isBoss && nearView) {
        if (e._cachedTerrMult === undefined || ((i + this._frameCounter) & 3) === 0) {
          const eTerr = MapEngine.getTerrainModifierAt(e.x, e.y);
          const isWaterOrFlying = e.data && (
            e.data.type1 === "Water" || e.data.type2 === "Water" ||
            e.data.type1 === "Flying" || e.data.type2 === "Flying"
          );
          let tMult = 1.0;
          if (!(eTerr.inWater && isWaterOrFlying)) {
            const rawTerrMult = eTerr.speedMult;
            tMult = e.isElite ? (1.0 - (1.0 - rawTerrMult) * 0.5) : rawTerrMult;
          }
          if (MapEngine.weather === "BLIZZARD" && e.data) {
            const isIceOrFlying = (e.data.type1 === "Ice" || e.data.type2 === "Ice" || e.data.type1 === "Flying" || e.data.type2 === "Flying");
            if (!isIceOrFlying) tMult *= 0.85;
          }
          e._cachedTerrMult = tMult;
        }
        eTerrMult = e._cachedTerrMult;
      }

      // 【攜帶物：不融冰】身周 125px 形成極寒霜凍結界，踏入光環的怪獸移速 -35% 並顯示結霜視覺
      if (p.heldItems && p.heldItems["never_melt_ice"] && dist <= 125 + e.radius) {
        eTerrMult *= 0.65;
        e.inFrostAura = true;
      } else {
        e.inFrostAura = false;
      }

      if (dist > Math.max(this.width, this.height) * 0.85 && !e.isBoss && !e.isElite && !e.treasureType) {
        const rAng = Math.random() * Math.PI * 2;
        e.x = p.x + Math.cos(rAng) * (Math.max(this.width, this.height) * 0.55);
        e.y = p.y + Math.sin(rAng) * (Math.max(this.width, this.height) * 0.55);
      }

      if (inToxicSwamp && !e.isBoss) eTerrMult *= 0.70;
      const bossEnrageSpd = (e.isBoss && (e.hp / e.maxHp) <= 0.5) ? 1.18 : 1.0;

      let moveDir = confDir;
      if (e.treasureType === "meowth") moveDir = -1.0;
      else if (e.treasureType === "chansey") moveDir = -0.85;

      let vx = (dx / dist) * e.speed * bossEnrageSpd * paraMult * eTerrMult * moveDir;
      let vy = (dy / dist) * e.speed * bossEnrageSpd * paraMult * eTerrMult * moveDir;
      if (e.status === "Confusion" && !e.treasureType) {
        const wobbleAng = Math.sin(performance.now() * 0.008 + e.id * 1.7) * 1.35;
        const cSpd = Math.hypot(vx, vy);
        const baseA = Math.atan2(vy, vx) + wobbleAng;
        vx = Math.cos(baseA) * cSpd;
        vy = Math.sin(baseA) * cSpd;
      }

      // 寶藏精靈防卡牆/障礙物滑動引導
      if (e.treasureType) {
        if (!e.slipAngle || Math.random() < 0.04) {
          e.slipAngle = (Math.random() < 0.5 ? 0.45 : -0.45);
        }
        const curAng = Math.atan2(vy, vx) + e.slipAngle;
        const curSpd = Math.hypot(vx, vy);
        vx = Math.cos(curAng) * curSpd;
        vy = Math.sin(curAng) * curSpd;
      }

      e.x += vx * dt;
      e.y += vy * dt;

      // 高壓怪海(>200隻)時，畫面外怪獸免除互相推擠與樹木碰撞，畫面內隔幀分流推擠，省下 70% CPU 開銷
      const doSeparation = !e.isBoss && (nearView || this.enemies.length <= 160) && (this.enemies.length <= 220 || ((i + this._frameCounter) & 1) === 0);
      if (doSeparation) {
        const gx = Math.floor(e.x / gridCellSize);
        const gy = Math.floor(e.y / gridCellSize);
        for (let ox = -1; ox <= 1; ox++) {
          for (let oy = -1; oy <= 1; oy++) {
            const cell = spatialGrid.get(`${gx + ox},${gy + oy}`);
            if (!cell) continue;
            for (let c = 0; c < cell.length; c++) {
              const other = cell[c];
              if (e === other) continue;
              const sepDx = e.x - other.x, sepDy = e.y - other.y;
              const minDist = (e.radius + other.radius) * 0.95;
              const sepSq = sepDx * sepDx + sepDy * sepDy;
              if (sepSq > 0 && sepSq < minDist * minDist) {
                const sepD = Math.sqrt(sepSq);
                const overlap = minDist - sepD;
                e.x += (sepDx / sepD) * overlap * (other.isBoss ? 1.0 : 0.5) * 0.35;
                e.y += (sepDy / sepD) * overlap * (other.isBoss ? 1.0 : 0.5) * 0.35;
              }
            }
          }
        }
      }

      if (Math.abs(vx) > 2) e.facingX = vx >= 0 ? 1 : -1;
      e.facingY = vy < -8 ? -1 : 1;

      if (!e.isBoss && (nearView || e.isElite || e.treasureType)) {
        MapEngine.resolveObstacleCollision(e, e.radius * 0.8, false);
      }

      const cdDt = e.status === "Paralysis" ? dt * 0.5 : dt;
      // 1. 神獸 Boss 彈幕與地毯技能（加快出招節奏 1.35s~1.85s、擴充扇形與環形彈幕數量，視覺華麗且走位可躲）
      if (inView && e.isBoss && !e.treasureType) {
        e.rangedCd = (e.rangedCd !== undefined ? e.rangedCd : 0.9) - cdDt;
        if (e.rangedCd <= 0) {
          const isEnraged = (e.hp / e.maxHp) <= 0.5;
          e.rangedCd = isEnraged ? (1.15 + Math.random() * 0.35) : (1.45 + Math.random() * 0.40);
          e.bossVolleyCount = (e.bossVolleyCount || 0) + 1;

          const baseAng = Math.atan2(p.y - e.y, p.x - e.x);

          // 1. 急凍鳥 (#144) —— 扇形 5 叉極寒冰錐 + 隔輪 8 向暴風雪冰環
          if (e.id === 144) {
            const spreadAngles = [-0.42, -0.21, 0, 0.21, 0.42];
            spreadAngles.forEach(angOffset => {
              const ang = baseAng + angOffset;
              this.enemyProjectiles.push({
                x: e.x + Math.cos(ang) * (e.radius + 10),
                y: e.y + Math.sin(ang) * (e.radius + 10),
                vx: Math.cos(ang) * 235,
                vy: Math.sin(ang) * 235,
                angle: ang, radius: 10,
                dmg: Math.round(e.atk * 0.72),
                color: "#38BDF8", vfx: "frost_lance",
                statusEffect: "Freeze", statusChance: 0.32,
                life: 3.4, rot: 0
              });
            });

            if (isEnraged || e.bossVolleyCount % 2 === 0) {
              const ringCount = isEnraged ? 10 : 6;
              for (let k = 0; k < ringCount; k++) {
                const ringAng = (k * Math.PI * 2) / ringCount + e.bossVolleyCount * 0.25;
                this.enemyProjectiles.push({
                  x: e.x, y: e.y,
                  vx: Math.cos(ringAng) * 185,
                  vy: Math.sin(ringAng) * 185,
                  angle: ringAng, radius: 9,
                  dmg: Math.round(e.atk * 0.65),
                  color: "#BAE6FD", vfx: "frost_lance",
                  statusEffect: "Freeze", statusChance: 0.25,
                  life: 3.0, rot: 0
                });
              }
              this.spawnParticleCluster(e.x, e.y, "#BAE6FD", "#38BDF8", 14, "star", 1.1);
            }
          }

          // 2. 閃電鳥 (#145) —— 4 連扇形高速雷羽 (265px/s) + 雙發追蹤電磁球
          else if (e.id === 145) {
            [-0.28, -0.09, 0.09, 0.28].forEach(angOffset => {
              const ang = baseAng + angOffset;
              this.enemyProjectiles.push({
                x: e.x, y: e.y,
                vx: Math.cos(ang) * 265, vy: Math.sin(ang) * 265,
                angle: ang, radius: 9,
                dmg: Math.round(e.atk * 0.68),
                color: "#FACC15", vfx: "swift_star",
                statusEffect: "Paralysis", statusChance: 0.28,
                life: 3.0, rot: 0
              });
            });

            const homingCount = isEnraged ? 3 : 2;
            for (let h = 0; h < homingCount; h++) {
              const hAng = baseAng + (h - (homingCount - 1) / 2) * 0.55;
              this.enemyProjectiles.push({
                x: e.x, y: e.y,
                vx: Math.cos(hAng) * 125, vy: Math.sin(hAng) * 125,
                angle: hAng, radius: 13,
                dmg: Math.round(e.atk * 0.78),
                color: "#FDE047", vfx: "storm_orb",
                homing: true, statusEffect: "Paralysis", statusChance: 0.42,
                life: 4.2, rot: 0
              });
            }
          }

          // 3. 火焰鳥 (#146) —— 三向扇形大字爆裂炎彈 (撞擊分裂火星) + 周身火環
          else if (e.id === 146) {
            const fireAngles = isEnraged ? [-0.34, -0.11, 0.11, 0.34] : [-0.24, 0, 0.24];
            fireAngles.forEach(off => {
              const fAng = baseAng + off;
              this.enemyProjectiles.push({
                x: e.x, y: e.y,
                vx: Math.cos(fAng) * 210, vy: Math.sin(fAng) * 210,
                angle: fAng, radius: 14,
                dmg: Math.round(e.atk * 0.85),
                color: "#EF4444", vfx: "fire_blast_orb",
                statusEffect: "Burn", statusChance: 0.40,
                canSplit: true, isEnragedSplit: isEnraged,
                life: 2.6, rot: 0
              });
            });
          }

          // 4. 超夢 (#150) —— 雙發引力黑核 + 8向（狂暴12向）暗影精神波
          else if (e.id === 150) {
            [-0.22, 0.22].forEach(off => {
              const cAng = baseAng + off;
              this.enemyProjectiles.push({
                x: e.x, y: e.y,
                vx: Math.cos(cAng) * 170, vy: Math.sin(cAng) * 170,
                angle: cAng, radius: 17,
                dmg: Math.round(e.atk * 0.95),
                color: "#A855F7", vfx: "psychic_core",
                isSuction: true, statusEffect: "Confusion", statusChance: 0.32,
                life: 3.8, rot: 0
              });
            });

            const waveCount = isEnraged ? 12 : 8;
            for (let pIdx = 0; pIdx < waveCount; pIdx++) {
              const pAng = (pIdx * Math.PI * 2) / waveCount + baseAng + e.bossVolleyCount * 0.2;
              this.enemyProjectiles.push({
                x: e.x, y: e.y,
                vx: Math.cos(pAng) * 220, vy: Math.sin(pAng) * 220,
                angle: pAng, radius: 10,
                dmg: Math.round(e.atk * 0.68),
                color: "#C084FC", vfx: "psy_wave",
                statusEffect: "Confusion", statusChance: 0.22,
                life: 3.0, rot: 0
              });
            }
          }

          // 5. 夢幻 (#151) —— 7 連發（狂暴 12 連發）彩虹混色高速星彈陣
          else if (e.id === 151) {
            const mCount = isEnraged ? 12 : 7;
            for (let m = 0; m < mCount; m++) {
              const spread = ((m / (mCount - 1)) - 0.5) * 0.95 + (Math.random() - 0.5) * 0.12;
              const mAng = baseAng + spread;
              const rainbowColors = ["#EF4444", "#38BDF8", "#FACC15", "#22C55E", "#EC4899"];
              const pickColor = rainbowColors[m % rainbowColors.length];
              this.enemyProjectiles.push({
                x: e.x, y: e.y,
                vx: Math.cos(mAng) * 245, vy: Math.sin(mAng) * 245,
                angle: mAng, radius: 9.5,
                dmg: Math.round(e.atk * 0.62),
                color: pickColor, vfx: "rainbow_star",
                statusEffect: m % 2 === 0 ? "Paralysis" : "Burn", statusChance: 0.20,
                life: 3.0, rot: 0
              });
            }
          }

          // 保持觸發原本的地面大招
          this.spawnEnemyTelegraphAttack(e);
        }
      }

      // 2. 精英怪地面預警招式 (獨立執行，不再阻斷遠程射擊)
      if (inView && e.isElite && !e.treasureType && !e.isBoss) {
        e.eliteTelegraphCd = (e.eliteTelegraphCd !== undefined ? e.eliteTelegraphCd : 3.0) - cdDt;
        if (e.eliteTelegraphCd <= 0) {
          e.eliteTelegraphCd = 3.5;
          this.spawnEnemyTelegraphAttack(e);
        }
      }

      // 3. 所有具備遠程習性的怪獸 (無論是普通怪、火箭隊精英阿柏怪 24 或雙彈瓦斯 110，均正常發射子彈！)
      const rangedIds = [23, 24, 35, 41, 42, 48, 60, 69, 70, 81, 109, 110, 116, 117, 120];
      if (inView && !e.treasureType && !e.isBoss && rangedIds.includes(e.id)) {
        e.rangedCd = (e.rangedCd !== undefined ? e.rangedCd : 0.05) - cdDt;
        if (e.rangedCd <= 0) {
          e.rangedCd = 2.4 + Math.random() * 1.3;
          const sAng = Math.atan2(p.y - e.y, p.x - e.x);
          const pSpd = 140;

          let pColor = "#A855F7";
          let pVfx = "poison_orb";
          if ([69, 70].includes(e.id)) { pColor = "#22C55E"; pVfx = "leaf_bullet"; }
          else if ([60, 116, 117].includes(e.id)) { pColor = "#38BDF8"; pVfx = "water_drop"; }
          else if ([41, 42].includes(e.id)) { pColor = "#818CF8"; pVfx = "wind_bullet"; }
          else if ([81, 120].includes(e.id)) { pColor = "#FACC15"; pVfx = "swift_star"; }
          else if (e.id === 35) { pColor = "#F472B6"; pVfx = "moon_bullet"; }
          else if (e.id === 48) { pColor = "#C084FC"; pVfx = "psy_wave"; }

          this.enemyProjectiles.push({
            x: e.x + Math.cos(sAng) * (e.radius + 6),
            y: e.y + Math.sin(sAng) * (e.radius + 6),
            vx: Math.cos(sAng) * pSpd,
            vy: Math.sin(sAng) * pSpd,
            angle: sAng,
            radius: 8.5,
            dmg: Math.max(1, Math.round(e.atk * 0.70)),
            color: pColor,
            vfx: pVfx,
            life: 3.5,
            rot: 0
          });
        }
      }

      const tc = this.trainerCompanion;
      const distToPoke = dist;
      const distToTrainer = tc ? Math.hypot(tc.x - e.x, tc.y - e.y) : 999;
      const hitPoke = distToPoke < e.radius + 16;
      const hitTrainer = tc && (distToTrainer < e.radius + 11);

      if (!e.treasureType && (hitPoke || hitTrainer) && p.invulnTimer <= 0) {
        if (p.multiscaleReady) {
          this.triggerRoyalShieldBurst(false);
          continue;
        }
        if (this.debugGodMode) continue;
        // 【攜帶物：柔軟沙子】受到近戰攻擊時 25% 機率揚起沙塵使怪獸失誤！
        if (p.heldItems && p.heldItems["soft_sand"] && Math.random() < 0.25) {
          p.invulnTimer = 0.45;
          this.spawnParticleCluster(p.x, p.y, "#D97706", "#FDE68A", 14, "circle", 0.8);
          this.spawnFloatingText(p.x, p.y - 24, "柔軟沙子：沙塵閃避 MISS!", "#FDE047", 14);
          continue;
        }

        const starLvCur = (this.saveData && this.saveData.pokemonStars && this.saveData.pokemonStars[this.selectedStarterId]) || 0;
        const starDrMult = Math.max(0.76, 1 - starLvCur * 0.06);
        const traitMeleeRed = (p.innateTrait && p.innateTrait.meleeDmgReduction) ? (1 - p.innateTrait.meleeDmgReduction) : 1.0;
        const martialGodRed = (p.martialGodTimer > 0) ? 0.70 : 1.0;
        const armorMult = (1 - (p.finalEvoArmor || 0)) * traitMeleeRed * martialGodRed * starDrMult;
        const dragonScaleMult = (p.heldItems && p.heldItems["dragon_scale"]) ? 0.85 : 1.0;
        const shieldMult = (p.shieldTimer > 0 ? 0.45 : 1.0) * armorMult * dragonScaleMult;
        const burnMod = (e.status === "Burn" ? 0.72 : 1.0) * (e.weakenTimer > 0 ? 0.65 : 1.0);
        const dmg = Math.max(1, Math.round(e.atk * shieldMult * burnMod));
        p.hp -= dmg;

        const hasMelee = Object.values(p.skills).some(s => SKILLS_CATALOG[s.id] && SKILLS_CATALOG[s.id].isMelee);
        const scarfBonus = (p.heldItems && p.heldItems["silk_scarf"]) ? 0.35 : 0;
        p.invulnTimer = (hasMelee ? 0.75 : 0.50) + scarfBonus;

        if (hitTrainer && !hitPoke) {
          this.camera.shakeTime = 0.28;
          this.camera.shakeMagnitude = 8.0;
          p.trainerSkillCd = Math.min(p.trainerSkillMaxCd, p.trainerSkillCd + 1.5);

          // 訓練家受創被撞退 12px 踉蹌反饋
          const stumbleAng = Math.atan2(tc.y - e.y, tc.x - e.x);
          tc.x += Math.cos(stumbleAng) * 12;
          tc.y += Math.sin(stumbleAng) * 12;
          tc.whiteFlashTimer = 0.16;

          this.spawnFloatingText(tc.x, tc.y - 25, `訓練家受創 -${dmg}!`, "#EF4444", 15);
          this.spawnFloatingText(tc.x, tc.y - 42, "⏳ 大招冷卻 +1.5s!", "#F59E0B", 13);
          this.spawnParticleCluster(tc.x, tc.y, "#EF4444", "#F59E0B", 12, "star", 0.8);
          SoundFX.play("hit");
        } else {
          p.whiteFlashTimer = 0.24; // 延長至 0.24s 扎實受創反饋
          this.camera.shakeTime = 0.18;
          this.camera.shakeMagnitude = 5.0;
          this.hitStopTimer = 0.05;
          this.spawnParticleCluster(p.x, p.y, "#EF4444", "#FFFFFF", 10, "star", 0.7);
          this.spawnFloatingText(p.x, p.y - 18, `-${dmg}`, "#EF4444", 15);
          SoundFX.play("hit");
        }

        if (p.hp <= 0) {
          p.hp = 0;
          this.triggerGameOver(false);
          return;
        }
      }
    }
  },

  spawnEnemyTelegraphAttack(enemy) {
    const p = this.player;
    const angToPlayer = Math.atan2(p.y - enemy.y, p.x - enemy.x);

    // 【精英小王五大種族流派專屬技能 ＋ 時間差連點 ＋ 彈幕連攜】
    if (!enemy.isBoss && enemy.isElite) {
      const t1 = enemy.data ? enemy.data.type1 : "Normal";
      const t2 = enemy.data ? enemy.data.type2 : "None";
      const hasType = (list) => list.includes(t1) || list.includes(t2);
      const atkIdx = (enemy.bossAttackIdx || 0) % 2;
      enemy.bossAttackIdx = (enemy.bossAttackIdx || 0) + 1;
      const eliteDmg = Math.round(enemy.atk * 1.25);

      // 流派 A：火 / 龍 / 電系 ——【追身時間差三連爆】＋【高速星火彈幕】
      if (hasType(["Fire", "Dragon", "Electric"])) {
        const isElec = hasType(["Electric"]);
        const col = isElec ? "#FACC15" : "#EF4444";
        for (let k = 0; k < 3; k++) {
          const leadDist = k * 42;
          const ox = p.x + Math.cos(angToPlayer) * leadDist + (Math.random() - 0.5) * 36;
          const oy = p.y + Math.sin(angToPlayer) * leadDist + (Math.random() - 0.5) * 36;
          this.telegraphs.push({
            shape: "circle", owner: enemy,
            x: ox, y: oy, radius: 46,
            timer: 0.70 + k * 0.18, maxTime: 0.70 + k * 0.18,
            dmg: eliteDmg, color: col, isBoss: false
          });
        }
        // 連攜 4 顆扇形火星 / 高速星彈
        [-0.36, -0.12, 0.12, 0.36].forEach(off => {
          const a = angToPlayer + off;
          this.enemyProjectiles.push({
            x: enemy.x, y: enemy.y,
            vx: Math.cos(a) * 185, vy: Math.sin(a) * 185,
            angle: a, radius: 8.5, dmg: Math.round(enemy.atk * 0.75),
            color: col, vfx: isElec ? "swift_star" : "fire_spark",
            statusEffect: isElec ? "Paralysis" : "Burn", statusChance: 0.25,
            life: 2.8, rot: 0
          });
        });
        return;
      }

      // 流派 B：地面 / 岩石 / 格鬥 / 一般系 —— 輪換【直線骨牌四連地裂 (時差連點)】與【破空音爆野蠻衝撞】
      if (hasType(["Ground", "Rock", "Fighting"]) || t1 === "Normal") {
        if (atkIdx === 0) {
          // 直線骨牌四連爆（每隔 58px 往前推進、引爆時間差 0.15s）
          for (let step = 1; step <= 4; step++) {
            const dist = step * 58;
            this.telegraphs.push({
              shape: "circle", owner: enemy,
              x: enemy.x + Math.cos(angToPlayer) * dist,
              y: enemy.y + Math.sin(angToPlayer) * dist,
              radius: 44,
              timer: 0.62 + (step - 1) * 0.15,
              maxTime: 0.62 + (step - 1) * 0.15,
              dmg: eliteDmg, color: "#D97706", isBoss: false
            });
          }
        } else {
          // 破空音爆直線衝撞
          this.telegraphs.push({
            shape: "line", owner: enemy,
            startX: enemy.x, startY: enemy.y,
            angle: angToPlayer, length: 265, width: 40,
            timer: 0.72, maxTime: 0.72,
            dmg: eliteDmg, speed: 440, color: "#F59E0B", isBoss: false
          });
        }
        return;
      }

      // 流派 C：水 / 冰系 ——【內外雙環潮汐陣】＋【扇形三叉冰錐/水滴彈】
      if (hasType(["Water", "Ice"])) {
        const isIce = hasType(["Ice"]);
        this.telegraphs.push({
          shape: "ring", owner: enemy,
          x: enemy.x, y: enemy.y,
          radius: 145, innerRadius: 42,
          timer: 0.85, maxTime: 0.85,
          dmg: eliteDmg, color: "#38BDF8", isBoss: false
        });
        [-0.25, 0, 0.25].forEach(off => {
          const a = angToPlayer + off;
          this.enemyProjectiles.push({
            x: enemy.x, y: enemy.y,
            vx: Math.cos(a) * 195, vy: Math.sin(a) * 195,
            angle: a, radius: 9, dmg: Math.round(enemy.atk * 0.80),
            color: "#38BDF8", vfx: isIce ? "frost_lance" : "water_drop",
            statusEffect: "Freeze", statusChance: 0.30,
            life: 3.0, rot: 0
          });
        });
        return;
      }

      // 流派 D：超能 / 幽靈 / 毒系 ——【引力黑洞 ＋ 時差雙側爆】＋【追蹤念力核 / 毒霧球】
      if (hasType(["Psychic", "Ghost", "Poison"])) {
        this.telegraphs.push({
          shape: "circle", owner: enemy,
          x: p.x, y: p.y, radius: 58,
          timer: 0.82, maxTime: 0.82,
          dmg: eliteDmg, isSuction: true, color: "#A855F7", isBoss: false
        });
        [-1, 1].forEach((side, idx) => {
          const perp = angToPlayer + side * (Math.PI / 2);
          this.telegraphs.push({
            shape: "circle", owner: enemy,
            x: p.x + Math.cos(perp) * 68, y: p.y + Math.sin(perp) * 68,
            radius: 42,
            timer: 0.98 + idx * 0.14, maxTime: 0.98 + idx * 0.14,
            dmg: eliteDmg, color: "#C084FC", isBoss: false
          });
        });
        this.enemyProjectiles.push({
          x: enemy.x, y: enemy.y,
          vx: Math.cos(angToPlayer) * 125, vy: Math.sin(angToPlayer) * 125,
          angle: angToPlayer, radius: 12, dmg: Math.round(enemy.atk * 0.85),
          color: "#C084FC", vfx: hasType(["Poison"]) ? "poison_orb" : "psy_wave",
          homing: !hasType(["Poison"]),
          life: 3.4, rot: 0
        });
        return;
      }

      // 流派 E：草 / 蟲 / 飛行系 ——【破空疾風衝刺】＋【扇形飛葉 / 風刃連射】
      this.telegraphs.push({
        shape: "line", owner: enemy,
        startX: enemy.x, startY: enemy.y,
        angle: angToPlayer, length: 270, width: 38,
        timer: 0.70, maxTime: 0.70,
        dmg: eliteDmg, speed: 450, color: "#4ADE80", isBoss: false
      });
      [-0.28, 0, 0.28].forEach(off => {
        const a = angToPlayer + off;
        this.enemyProjectiles.push({
          x: enemy.x, y: enemy.y,
          vx: Math.cos(a) * 185, vy: Math.sin(a) * 185,
          angle: a, radius: 8.5, dmg: Math.round(enemy.atk * 0.75),
          color: hasType(["Flying"]) ? "#818CF8" : "#22C55E",
          vfx: hasType(["Flying"]) ? "wind_bullet" : "leaf_bullet",
          life: 3.0, rot: 0
        });
      });
      return;
    }

    const bPattern = BOSS_ATTACK_PATTERNS[enemy.id] || BOSS_ATTACK_PATTERNS.default_elite;
    const skillList = bPattern.skills;
    
    const skill = skillList[(enemy.bossAttackIdx || 0) % skillList.length];
    enemy.bossAttackIdx = ((enemy.bossAttackIdx || 0) + 1) % skillList.length;

    const baseDmg = Math.round(enemy.atk * (skill.dmgMult || 1.25));

    if (skill.shape === "line") {
      const ang = Math.atan2(p.y - enemy.y, p.x - enemy.x);
      this.telegraphs.push({
        shape: "line",
        owner: enemy,
        startX: enemy.x,
        startY: enemy.y,
        angle: ang,
        length: skill.length || 320,
        width: skill.width || 44,
        timer: skill.delay || 0.75,
        maxTime: skill.delay || 0.75,
        dmg: baseDmg,
        speed: skill.speed || 480,
        color: skill.color || "#EF4444",
        isBoss: enemy.isBoss
      });
    } else if (skill.shape === "multi_pillar") {
      for (let i = 0; i < (skill.count || 4); i++) {
        const offsetAng = Math.random() * Math.PI * 2;
        const offsetR = 30 + Math.random() * 95;
        this.telegraphs.push({
          shape: "circle",
          owner: enemy,
          x: p.x + Math.cos(offsetAng) * offsetR,
          y: p.y + Math.sin(offsetAng) * offsetR,
          radius: skill.radius || 46,
          timer: (skill.delay || 0.85) + i * 0.1,
          maxTime: (skill.delay || 0.85) + i * 0.1,
          dmg: baseDmg,
          color: skill.color || "#FACC15",
          isBoss: enemy.isBoss
        });
      }
    } else if (skill.shape === "ring") {
      this.telegraphs.push({
        shape: "ring",
        owner: enemy,
        x: enemy.x,
        y: enemy.y,
        radius: skill.radius || 150,
        innerRadius: skill.innerRadius || 45,
        timer: skill.delay || 0.90,
        maxTime: skill.delay || 0.90,
        dmg: baseDmg,
        color: skill.color || "#38BDF8",
        isBoss: enemy.isBoss
      });
    } else {
      this.telegraphs.push({
        shape: "circle",
        owner: enemy,
        x: skill.isSuction ? p.x : enemy.x,
        y: skill.isSuction ? p.y : enemy.y,
        radius: skill.radius || 60,
        timer: skill.delay || 0.85,
        maxTime: skill.delay || 0.85,
        dmg: baseDmg,
        isSuction: !!skill.isSuction,
        color: skill.color || "#EF4444",
        isBoss: enemy.isBoss
      });
    }
  },

  updateTelegraphs(dt) {
    const p = this.player;
    for (let i = this.telegraphs.length - 1; i >= 0; i--) {
      const tg = this.telegraphs[i];

      if (tg.isSuction && tg.timer > 0) {
        const d = Math.hypot(p.x - tg.x, p.y - tg.y);
        if (d < tg.radius * 1.5) {
          const sAng = Math.atan2(tg.y - p.y, tg.x - p.x);
          p.x += Math.cos(sAng) * 45 * dt;
          p.y += Math.sin(sAng) * 45 * dt;
        }
      }

      tg.timer -= dt;
      if (tg.timer <= 0) {
        if (tg.isBossWarning) {
          this.spawnBossAt(tg.bossId, tg.x, tg.y, tg.isFinalMewtwo);
          this.telegraphs.splice(i, 1);
          continue;
        }

        let hitPlayer = false;

        if (tg.shape === "line") {
          const dx = Math.cos(tg.angle) * tg.length;
          const dy = Math.sin(tg.angle) * tg.length;
          const pxRel = p.x - tg.startX;
          const pyRel = p.y - tg.startY;
          const proj = (pxRel * dx + pyRel * dy) / (tg.length * tg.length);
          if (proj >= 0 && proj <= 1) {
            const nearX = tg.startX + proj * dx;
            const nearY = tg.startY + proj * dy;
            if (Math.hypot(p.x - nearX, p.y - nearY) <= tg.width / 2 + 16) hitPlayer = true;
          }
          if (tg.owner && tg.owner.hp > 0) {
            // 【衝撞視覺升級】：沿衝鋒路徑生成 3 道破空音爆風罩 (sonic_cone) 與揚塵粒子，告別乾癟瞬移感！
            for (let step = 1; step <= 3; step++) {
              const frac = step * 0.28;
              const cx = tg.startX + Math.cos(tg.angle) * (tg.length * frac);
              const cy = tg.startY + Math.sin(tg.angle) * (tg.length * frac);
              SkillsEngine.meleeEffects.push({
                style: "sonic_cone",
                casterRef: step === 3 ? tg.owner : null,
                ox: cx, oy: cy, x: cx, y: cy,
                angle: tg.angle,
                radius: (tg.width || 40) * (0.85 + step * 0.12),
                waveIdx: step - 1,
                timer: 0.22, maxTime: 0.22,
                color: tg.color || "#F8FAFC"
              });
            }
            tg.owner.x = tg.startX + Math.cos(tg.angle) * (tg.length * 0.85);
            tg.owner.y = tg.startY + Math.sin(tg.angle) * (tg.length * 0.85);
            this.spawnParticleCluster(tg.owner.x, tg.owner.y, tg.color || "#F59E0B", "#FFFFFF", 10, "star", 0.85);
          }
        } else if (tg.shape === "ring") {
          const d = Math.hypot(p.x - tg.x, p.y - tg.y);
          if (d <= tg.radius && d >= tg.innerRadius) hitPlayer = true;
        } else {
          const d = Math.hypot(p.x - tg.x, p.y - tg.y);
          if (d <= tg.radius) hitPlayer = true;
        }

        if (hitPlayer && p.invulnTimer <= 0 && !this.debugGodMode) {
          if (p.heldItems && p.heldItems["soft_sand"] && Math.random() < 0.25) {
            p.invulnTimer = 0.45;
            this.spawnParticleCluster(p.x, p.y, "#D97706", "#FDE68A", 16, "circle", 0.9);
            this.spawnFloatingText(p.x, p.y - 24, "柔軟沙子：沙塵閃避 MISS!", "#FDE047", 14);
            this.telegraphs.splice(i, 1);
            continue;
          }
          const armorMult = 1 - (p.finalEvoArmor || 0);
          const dragonScaleMult = (p.heldItems && p.heldItems["dragon_scale"]) ? 0.85 : 1.0;
          const scarfBonus = (p.heldItems && p.heldItems["silk_scarf"]) ? 0.35 : 0;
          const dmg = Math.max(1, Math.round(tg.dmg * (p.shieldTimer > 0 ? 0.5 : 1.0) * armorMult * dragonScaleMult));
          p.hp -= dmg;
          p.invulnTimer = 0.45 + scarfBonus;
          this.spawnFloatingText(p.x, p.y - 20, `重擊 -${dmg}`, "#DC2626", 15);
          SoundFX.play("hit");
          if (p.hp <= 0) {
            p.hp = 0;
            this.triggerGameOver(false);
            return;
          }
        }

        SkillsEngine.meleeEffects.push({
          style: "slam_wave",
          x: tg.shape === "line" ? tg.startX + Math.cos(tg.angle) * tg.length : tg.x,
          y: tg.shape === "line" ? tg.startY + Math.sin(tg.angle) * tg.length : tg.y,
          radius: tg.radius || tg.width * 1.5,
          timer: 0.28,
          maxTime: 0.28,
          color: tg.color || "#EF4444"
        });

        this.telegraphs.splice(i, 1);
      }
    }
  },

  updateEnemyProjectiles(dt) {
    const p = this.player;
    if (!p) return;
    const tc = this.trainerCompanion;

    for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
      const ep = this.enemyProjectiles[i];

      // 追蹤彈微修正角度 (閃電鳥追蹤電磁核等)
      if (ep.homing) {
        const curDesired = Math.atan2(p.y - ep.y, p.x - ep.x);
        const curSpd = Math.hypot(ep.vx, ep.vy);
        ep.vx = ep.vx * 0.92 + Math.cos(curDesired) * curSpd * 0.08;
        ep.vy = ep.vy * 0.92 + Math.sin(curDesired) * curSpd * 0.08;
        ep.angle = Math.atan2(ep.vy, ep.vx);
      }

      // 引力黑核微弱吸扯玩家 (超夢巨型黑核)
      if (ep.isSuction) {
        const d = Math.hypot(p.x - ep.x, p.y - ep.y);
        if (d < 180 && d > 20) {
          const pullAng = Math.atan2(ep.y - p.y, ep.x - p.x);
          p.x += Math.cos(pullAng) * 35 * dt;
          p.y += Math.sin(pullAng) * 35 * dt;
        }
      }

      ep.x += ep.vx * dt;
      ep.y += ep.vy * dt;
      ep.rot += dt * 3.0;
      ep.life -= dt;

      // 檢查是否擊中主角精靈或隨行訓練家
      const distToPoke = Math.hypot(p.x - ep.x, p.y - ep.y);
      const distToTrainer = tc ? Math.hypot(tc.x - ep.x, tc.y - ep.y) : 999;
      const hitPoke = distToPoke < ep.radius + 14;
      const hitTrainer = tc && (distToTrainer < ep.radius + 11);

      if ((hitPoke || hitTrainer) && p.invulnTimer <= 0) {
        if (p.multiscaleReady) {
          this.triggerRoyalShieldBurst(false);
          this.enemyProjectiles.splice(i, 1);
          continue;
        }
        if (this.debugGodMode) continue;
        if (p.heldItems && p.heldItems["soft_sand"] && Math.random() < 0.25) {
          p.invulnTimer = 0.45;
          this.spawnParticleCluster(p.x, p.y, "#D97706", "#FDE68A", 14, "circle", 0.85);
          this.spawnFloatingText(p.x, p.y - 24, "柔軟沙子：沙塵閃避 MISS!", "#FDE047", 14);
          this.enemyProjectiles.splice(i, 1);
          continue;
        }
        const armorMult = 1 - (p.finalEvoArmor || 0);
        const dragonScaleMult = (p.heldItems && p.heldItems["dragon_scale"]) ? 0.85 : 1.0;
        const scarfBonus = (p.heldItems && p.heldItems["silk_scarf"]) ? 0.35 : 0;
        const shieldMult = (p.shieldTimer > 0 ? 0.5 : 1.0) * armorMult * dragonScaleMult;
        const dmg = Math.max(1, Math.round(ep.dmg * shieldMult));
        p.hp -= dmg;
        p.invulnTimer = 0.55 + scarfBonus; // 賦予無敵硬直時間（含絲綢圍巾加成）

        // 狀態賦予判定 (普通怪子彈依 vfx 判定，神獸子彈依 statusEffect 判定)
        let inflictedStatus = ep.statusEffect || null;
        let inflictedChance = ep.statusChance || 0;
        let duration = 2.5;

        if (!inflictedStatus) {
          if (ep.vfx === "poison_orb")   { inflictedStatus = "Poison"; inflictedChance = 0.30; duration = 3.5; }
          else if (ep.vfx === "swift_star") { inflictedStatus = "Paralysis"; inflictedChance = 0.25; duration = 1.8; }
          else if (ep.vfx === "wind_bullet") { inflictedStatus = "Confusion"; inflictedChance = 0.20; duration = 1.2; }
          else if (ep.vfx === "water_drop") { inflictedStatus = "Freeze"; inflictedChance = 0.20; duration = 1.5; }
          else if (ep.vfx === "leaf_bullet") {
            // 物理擊退：將精靈推後 10px
            const pushAng = Math.atan2(p.y - ep.y, p.x - ep.x);
            p.x += Math.cos(pushAng) * 10;
            p.y += Math.sin(pushAng) * 10;
          }
        }

        if (inflictedStatus && Math.random() < inflictedChance && !p.status) {
          p.status = inflictedStatus;
          p.statusTimer = duration;
          const statusNames = { Poison: "中毒!", Paralysis: "麻痺!", Confusion: "混亂反向!", Freeze: "減速遲緩!", Burn: "灼傷!" };
          this.spawnFloatingText(p.x, p.y - 32, statusNames[inflictedStatus] || "異常!", "#F43F5E", 14);
        }

        // 火焰鳥大字炎巨彈分裂火星
        if (ep.canSplit) {
          const splitAngles = ep.isEnragedSplit ? [0, 0.78, 1.57, 2.35, 3.14, 3.92, 4.71, 5.49] : [0, Math.PI/2, Math.PI, Math.PI * 1.5];
          splitAngles.forEach(sAng => {
            this.enemyProjectiles.push({
              x: ep.x, y: ep.y,
              vx: Math.cos(sAng) * 160, vy: Math.sin(sAng) * 160,
              angle: sAng, radius: 7, dmg: Math.round(ep.dmg * 0.45),
              color: "#F97316", vfx: "fire_spark",
              life: 1.2, rot: 0
            });
          });
        }

        // A. 訓練家受創反饋 (強化版)
        if (hitTrainer && !hitPoke) {
          this.camera.shakeTime = 0.28;
          this.camera.shakeMagnitude = 8.0;
          p.trainerSkillCd = Math.min(p.trainerSkillMaxCd, p.trainerSkillCd + 1.5);

          // 踉蹌後退：遠離子彈向量被推開 12px
          const stumbleAng = Math.atan2(tc.y - ep.y, tc.x - ep.x);
          tc.x += Math.cos(stumbleAng) * 12;
          tc.y += Math.sin(stumbleAng) * 12;
          tc.whiteFlashTimer = 0.16; // 訓練家受創閃爍

          this.spawnFloatingText(tc.x, tc.y - 25, `訓練家受創 -${dmg}!`, "#EF4444", 15);
          this.spawnFloatingText(tc.x, tc.y - 42, "⏳ 大招冷卻 +1.5s!", "#F59E0B", 13);
          this.spawnParticleCluster(tc.x, tc.y, "#EF4444", "#F59E0B", 12, "star", 0.8);
          SoundFX.play("hit");
        } 
        // B. 精靈主角受創反饋 (強化版)
        else {
          p.whiteFlashTimer = 0.24; // 延長至 0.24s 扎實受創反饋
          this.camera.shakeTime = 0.18;
          this.camera.shakeMagnitude = 5.0;
          this.spawnFloatingText(p.x, p.y - 18, `-${dmg}`, "#EF4444", 15);
          this.spawnParticleCluster(ep.x, ep.y, ep.color || "#FFFFFF", "#EF4444", 10, "star", 0.7);
          SoundFX.play("hit");
        }

        this.enemyProjectiles[i] = this.enemyProjectiles[this.enemyProjectiles.length - 1];
        this.enemyProjectiles.pop();
        if (p.hp <= 0) {
          p.hp = 0;
          this.triggerGameOver(false);
          return;
        }
        continue;
      }

      if (ep.life <= 0) {
        this.enemyProjectiles[i] = this.enemyProjectiles[this.enemyProjectiles.length - 1];
        this.enemyProjectiles.pop();
      }
    }
  },

  dealDamageToEnemy(enemy, rawDmg, moveType, bonusStatusChance = 0, knockback = 0) {
    const eff = calcTypeMultiplier(moveType, enemy.data.type1, enemy.data.type2);
    const psychicCritBonus = (MapEngine.weather === "PSYCHIC" && (moveType === "Psychic" || moveType === "Ghost")) ? 0.15 : 0;
    // 【攜帶物：毒針】對處於中毒狀態的敵人額外暴擊率 +25%
    const pTrait = (this.player && this.player.innateTrait) ? this.player.innateTrait : {};
    const ironFistCrit = (["Fighting", "Normal", "Ground", "Rock"].includes(moveType)) ? (pTrait.ironFistCritBonus || 0) : 0;
    const psySurgeCrit = ((enemy.status === "Poison" || enemy.status === "Confusion") && pTrait.psychicStatusCritBonus) ? pTrait.psychicStatusCritBonus : 0;
    const martialGodCrit = (this.player.martialGodTimer > 0) ? 0.20 : 0;
    const poisonBarbCritBonus = (this.player.heldItems && this.player.heldItems["poison_barb"] && enemy.status === "Poison") ? 0.25 : 0;
    const dualSuperCritBonus = Object.values(this.player.skills || {}).filter(s => s.evolved).length >= 2 ? 0.08 : 0;
    const isCrit = Math.random() < (this.player.critRate + (this.player.buffTimer > 0 ? 0.25 : 0) + psychicCritBonus + poisonBarbCritBonus + dualSuperCritBonus + ironFistCrit + psySurgeCrit + martialGodCrit);
    // 【攜帶物：黑帶】暴擊傷害從 1.35x 提升至 1.75x
    const critMult = isCrit ? ((this.player.heldItems && this.player.heldItems["black_belt"]) ? 1.75 : 1.35) : 1.0;
    const xAtkMod = this.player.xAttackTimer > 0 ? 1.35 : 1.0;
    const dragonMawMod = (enemy.status === "Burn" && pTrait.dragonMawBurnAmp) ? (1 + pTrait.dragonMawBurnAmp) : 1.0;
    let finalDmg = Math.round(rawDmg * eff * critMult * xAtkMod * dragonMawMod);
    if (enemy.isBoss) {
      // P2 動態傷害上限：高單發慢速重擊招式（地震、龍之俯衝、水炮、撞擊超武等）放寬單發上限至 13.5%，確保重武器打王不吃虧
      const isHeavySingleHit = ["Ground", "Dragon", "Normal", "Fighting"].includes(moveType) || knockback >= 16;
      const capRatio = isHeavySingleHit ? 0.135 : 0.088;
      finalDmg = Math.min(finalDmg, Math.round(enemy.maxHp * capRatio));
    }

    enemy.hp -= finalDmg;
    // 任何受傷均觸發明顯白閃反饋
    enemy.whiteFlashTimer = (isCrit || eff > 1.1) ? 0.14 : 0.11;

    // P2 Boss 50% 血量二階段【領域覺醒 (Overdrive)】演出與氣浪震退
    if (enemy.isBoss && enemy.hp > 0 && !enemy.overdriveTriggered && (enemy.hp / enemy.maxHp) <= 0.50) {
      enemy.overdriveTriggered = true;
      enemy.status = null;
      enemy.statusTimer = 0;
      enemy.ccImmunityTimer = 3.0;
      this.hitStopTimer = 0.06;
      this.killSlowmoTimer = 0.38;
      this.camera.shakeTime = 0.45;
      this.camera.shakeMagnitude = 12;
      SoundFX.play("boss");

      const bCol = TYPE_COLORS[enemy.data.type1] || "#EF4444";
      SkillsEngine.meleeEffects.push({
        style: "slam_wave",
        x: enemy.x, y: enemy.y,
        radius: 195, timer: 0.45, maxTime: 0.45,
        color: bCol
      });
      this.spawnParticleCluster(enemy.x, enemy.y, bCol, "#FDE047", 32, "star", 1.5);
      this.showCutsceneBanner(
        `【⚡ BOSS 領域覺醒：${enemy.data.name_zh}】`,
        "生命跌破 50%！神獸解放狂暴姿態，攻速與彈幕全面強化！",
        3000
      );
      this.spawnFloatingText(enemy.x, enemy.y - 36, "🔥 狂暴領域覺醒 OVERDRIVE!!", "#FACC15", 15);

      // 覺醒氣浪將貼身玩家溫和震開 75px，給予反應空間並要求重新走位切入
      if (this.player && Math.hypot(this.player.x - enemy.x, this.player.y - enemy.y) < 180) {
        const pushAng = Math.atan2(this.player.y - enemy.y, this.player.x - enemy.x);
        this.player.x += Math.cos(pushAng) * 75;
        this.player.y += Math.sin(pushAng) * 75;
        MapEngine.resolveObstacleCollision(this.player, 18, true);
      }
    }

    this.skillDamageStats[moveType] = (this.skillDamageStats[moveType] || 0) + finalDmg;

    if (enemy.treasureType === "meowth") {
      this.runCoins += 8;
      this.saveData.coins += 8;
      this.spawnFloatingText(enemy.x, enemy.y - 20, "+8 代幣", "#F59E0B", 11);
    }

    const kbResist = enemy.isBoss ? 1.0 : (enemy.kbResist !== undefined ? enemy.kbResist : 0.0);
    const actualKb = knockback * (1 - kbResist);

    if (actualKb > 1) {
      const ang = Math.atan2(enemy.y - this.player.y, enemy.x - this.player.x);
      enemy.x += Math.cos(ang) * actualKb;
      enemy.y += Math.sin(ang) * actualKb;
    }

    const tMeta = TYPE_META[moveType];
    if (tMeta && tMeta.status) {
      const st = tMeta.status;
      const isHardCC = ["Freeze", "Paralysis", "Confusion"].includes(st);

      if (checkStatusImmunity(enemy, st)) {
        if (Math.random() < 0.25) this.spawnFloatingText(enemy.x, enemy.y - 20, "屬性免疫!", "#94A3B8", 11);
      } else if (!(isHardCC && (enemy.status === st || ["Freeze", "Paralysis", "Confusion"].includes(enemy.status)))) {
        const weightMod = enemy.weightTier === "heavy" ? 0.55 : (enemy.weightTier === "medium" ? 0.80 : 1.0);
        const tierMod = enemy.isBoss ? 0.40 : (enemy.isElite ? 0.65 : 1.0);
        const psyConfResist = (st === "Confusion" && enemy.data && (enemy.data.type1 === "Psychic" || enemy.data.type2 === "Psychic")) ? 0.50 : 1.0;
        const spoonBonus = (st === "Confusion" && this.player && this.player.heldItems && this.player.heldItems["twisted_spoon"]) ? 0.04 : 0;
        const frostAuraBonus = (st === "Freeze" && enemy.inFrostAura) ? 0.05 : 0;
        const rawChance = Math.max(0.03, tMeta.statusRate + spoonBonus + frostAuraBonus + (bonusStatusChance || 0) * 0.28);
        const finalChance = Math.min(isHardCC ? 0.30 : 0.44, rawChance * weightMod * tierMod * psyConfResist);

        if (Math.random() < finalChance) {
          if (isHardCC && enemy.ccImmunityTimer > 0) {
            if (enemy.isBoss || enemy.isElite) {
              this.spawnFloatingText(enemy.x, enemy.y - 20, "韌性抵抗!", "#CBD5E1", 11);
            }
          } else if (isHardCC) {
            enemy.status = st;
            const durWeightMod = enemy.weightTier === "heavy" ? 0.72 : 1.0;
            const baseDur = (st === "Freeze") ? 2.2 : 2.8;
            enemy.statusTimer = (enemy.isBoss ? 1.2 : (enemy.isElite ? 1.8 : baseDur)) * durWeightMod;
            enemy.ccImmunityTimer = enemy.isBoss ? 4.2 : (enemy.isElite ? 2.8 : (st === "Freeze" ? 1.4 : 1.8));
          } else {
            // 軟狀態（灼傷 Burn / 中毒 Poison）：
            // 1. 狀態優先級保護：絕不覆蓋正在生效的硬控（冰凍/麻痺/混亂）
            const inActiveHardCC = ["Freeze", "Paralysis", "Confusion"].includes(enemy.status) && enemy.statusTimer > 0;
            const alreadyInDot = (enemy.status === "Burn" || enemy.status === "Poison") && enemy.statusTimer > 0;
            const nowMs = performance.now();

            if (inActiveHardCC || alreadyInDot) {
              // 若已在灼傷/中毒中，僅刷新延長持續時間，絕不重置 statusTick 倒數！
              if (alreadyInDot && enemy.status === st) {
                enemy.statusTimer = Math.max(enemy.statusTimer, enemy.isBoss ? 2.8 : 4.2);
              }
              // 疊加觸發「烈焰爆燃 / 毒液迸發」瞬發補償直傷 (每隻怪 0.48s 內置冷卻)
              if (!enemy._lastDotBurstMs || nowMs - enemy._lastDotBurstMs > 480) {
                enemy._lastDotBurstMs = nowMs;
                const burstDmg = Math.max(4, Math.round(finalDmg * 0.32));
                enemy.hp -= burstDmg;
                this.skillDamageStats[moveType] = (this.skillDamageStats[moveType] || 0) + burstDmg;
                this.spawnFloatingText(
                  enemy.x + (Math.random() - 0.5) * 16,
                  enemy.y - 22,
                  st === "Burn" ? `🔥爆燃 -${burstDmg}` : `☠️毒爆 -${burstDmg}`,
                  st === "Burn" ? "#FB923C" : "#C084FC",
                  11
                );
              }
            } else {
              // 首次掛上灼傷或中毒，設定初始跳傷計時器
              enemy.status = st;
              enemy.statusTimer = enemy.isBoss ? 2.8 : 4.2;
              enemy.statusTick = 0.38;
            }
          }
        }
      }
    }

    // 【攜帶物：彎曲湯匙】非超能系招式攻擊時提供 6% 念力混亂支援，並附帶 0.6s 全局特效冷卻防洗頻
    if (this.player.heldItems && this.player.heldItems["twisted_spoon"] && moveType !== "Psychic" && moveType !== "Ghost" && !["Freeze", "Paralysis", "Confusion"].includes(enemy.status)) {
      const spoonChance = 0.06 * (enemy.isBoss ? 0.35 : (enemy.isElite ? 0.60 : 0.85));
      if (Math.random() < spoonChance && !(enemy.ccImmunityTimer > 0)) {
        enemy.status = "Confusion";
        enemy.statusTimer = enemy.isBoss ? 1.1 : (enemy.isElite ? 1.6 : 2.2);
        enemy.ccImmunityTimer = enemy.isBoss ? 4.2 : 2.8;
        const nowMs = performance.now();
        if (!this._lastSpoonWaveMs || nowMs - this._lastSpoonWaveMs > 600) {
          this._lastSpoonWaveMs = nowMs;
          SkillsEngine.meleeEffects.push({
            style: "slam_wave",
            x: enemy.x,
            y: enemy.y,
            radius: 34,
            timer: 0.20,
            maxTime: 0.20,
            color: "#EC4899"
          });
          this.spawnFloatingText(enemy.x, enemy.y - 24, "🌀 念力混亂!", "#F472B6", 11);
        }
      }
    }

    const hasBlackBelt = !!(this.player.heldItems && this.player.heldItems["black_belt"]);
    const isPoisonCrit = isCrit && poisonBarbCritBonus > 0;
    const critPrefix = isPoisonCrit ? "劇毒暴擊" : (hasBlackBelt ? "極限暴擊" : "暴擊");
    let label = `${finalDmg}`;
    let col = "#FFFFFF";
    if (eff <= 0.15) {
      label = `微弱抵抗 ${finalDmg}`;
      col = "#94A3B8";
    } else if (eff < 0.85) {
      label = `抵抗 ${finalDmg}`;
      col = "#CBD5E1";
    } else if (eff > 1.1) {
      label = isCrit ? `克制${critPrefix} ${finalDmg}!` : `克制 ${finalDmg}!`;
      col = isPoisonCrit ? "#C084FC" : "#F97316";
    } else if (isCrit) {
      label = `${critPrefix} ${finalDmg}!`;
      col = isPoisonCrit ? "#C084FC" : (hasBlackBelt ? "#FB7185" : "#FACC15");
    }
    this.spawnFloatingText(enemy.x, enemy.y - 12, label, col, eff > 1.1 || isCrit ? 15 : 12);

    if (enemy.hp <= 0) {
      const idx = this.enemies.indexOf(enemy);
      if (idx !== -1) this.handleEnemyDeath(enemy, idx);
    }
  },

  handleEnemyDeath(e, idx) {
    this.enemies[idx] = this.enemies[this.enemies.length - 1];
    this.enemies.pop();
    this.kills += 1;
    this.saveData.stats.totalKills += 1;
    if (this.isEndlessMode && this.kills >= (this.endlessNextKillMilestone || 150)) {
      this.endlessNextKillMilestone = this.kills + 150;
      const dropLoot = (this.kills % 300 === 0) ? "evo_chest" : "rare_candy";
      this.spawnMapLoot(dropLoot, e.x, e.y);
      this.spawnFloatingText(e.x, e.y - 24, `♾️ 連斬 ${this.kills} 里程碑掉落！`, "#FACC15", 14);
    }
    this.saveData.pokedexCaught[e.id] = true;

    // 【攜帶物：詛咒之符】擊敗敵人時 15% 機率將其靈魂轉化為騰空追蹤自爆鬼火 (帶 0.18 秒升空展示期，不被身邊屍群秒吃)
    if (this.player && this.player.heldItems && this.player.heldItems["spell_tag"] && Math.random() < 0.15) {
      const p = this.player;
      const wispDmg = Math.round((34 + p.baseAtk * 0.55) * p.dmgMult);
      const launchAng = -Math.PI / 2 + (Math.random() - 0.5) * 1.2;
      SkillsEngine.projectiles.push({
        x: e.x,
        y: e.y - 24,
        vx: Math.cos(launchAng) * 240,
        vy: Math.sin(launchAng) * 240,
        angle: launchAng,
        radius: 18 * p.areaMult,
        dmg: wispDmg,
        type: "Ghost",
        skillId: "Shadow Ball",
        vfx: "shadow_orb",
        homing: true,
        color: "#C084FC",
        pierce: 3,
        knockback: 8,
        life: 2.6,
        spawnGraceTimer: 0.18,
        statusBonus: 0.40,
        hitSet: new Set(),
        trailTimer: 0
      });
      this.spawnParticleCluster(e.x, e.y - 20, "#A855F7", "#E9D5FF", 10, "star", 0.8);
      this.spawnFloatingText(e.x, e.y - 28, "👻 詛咒鬼火！", "#C084FC", 13);
    }

    const loadoutCoinMod = (this.player && this.player.loadoutCoinMult) ? this.player.loadoutCoinMult : 1.0;
    const endlessCoinMod = this.isEndlessMode ? 1.25 : 1.0;
    const diffCoinMult = this.selectedDifficulty.coinMult * MapEngine.currentStage.rewardMult * (1 + (this.saveData.upgrades.greed || 0) * 0.15) * loadoutCoinMod * endlessCoinMod;

    if (e.isShiny) {
      this.saveData.shinyUnlocked[e.id] = true;
      SoundFX.play("shiny");
      this.showCutsceneBanner(`[閃光登錄] 成功收服【閃光・${e.data.name_zh}】！`, "已永久登錄圖鑑，可於選角處自由切換！", 3000);
    }

    if (e.treasureType === "meowth") {
      const jackpot = Math.round(180 * diffCoinMult);
      this.runCoins += jackpot;
      this.saveData.coins += jackpot;
      SoundFX.play("levelup");
      this.spawnFloatingText(e.x, e.y - 20, `聚寶功大爆代幣 +${jackpot}!`, "#F59E0B", 16);
    } else if (e.treasureType === "chansey") {
      SoundFX.play("levelup");
      this.spawnMapLoot("rare_candy", e.x - 18, e.y);
      this.spawnMapLoot("partner_ball", e.x + 18, e.y);
      this.spawnFloatingText(e.x, e.y - 20, `幸福吉利蛋掉落神奇糖果＆治癒球!`, "#EC4899", 15);
    }

    if (e.isElite && !e.isBoss) {
      // P3 精英小王擊破微頓幀 (斬肉頓幀感 Hit-Stop)
      this.hitStopTimer = Math.max(this.hitStopTimer || 0, 0.035);
      this.spawnParticleCluster(e.x, e.y, "#FACC15", "#EF4444", 18, "star", 1.15);
      const dropId = Math.random() < 0.22 ? "partner_ball" : "rare_candy";
      this.spawnMapLoot(dropId, e.x, e.y);
    }

    if (e.isBoss) {
      // P3 神獸 Boss 擊破特寫慢動作 (Kill Cam Slow-Mo 0.65s) 與全屏星芒爆散
      this.hitStopTimer = 0.07;
      this.killSlowmoTimer = 0.65;
      this.camera.shakeTime = 0.50;
      this.camera.shakeMagnitude = 14;
      this.spawnParticleCluster(e.x, e.y, "#FACC15", "#FFFFFF", 42, "star", 1.75);
      this.activeBoss = this.enemies.find(x => x.isBoss) || null;
      if (!this.activeBoss) {
        MapEngine.setWeather("CLEAR");
        this.updateWeatherUI("CLEAR");
        SoundFX.startBgm("battle");
        document.getElementById("bossHudContainer").classList.add("hidden");
      }
      this.spawnMapLoot("evo_chest", e.x, e.y);
      this.spawnMapLoot("rare_candy", e.x + 28, e.y);

      if ([144, 145, 146].includes(e.id)) {
        this.saveData.stats.birdsDefeated += 1;
        // 困難與地獄模式下，擊敗 5 分鐘三聖鳥額外保底贈予 1 件對應當前招式的超武攜帶物！
        if (this.selectedDifficulty && (this.selectedDifficulty.id === "hard" || this.selectedDifficulty.id === "hell")) {
          const p = this.player;
          const learnedTypes = new Set(Object.values(p.skills).map(s => SKILLS_CATALOG[s.id]?.type));
          const unownedHeld = Object.values(HELD_ITEMS).filter(hi => {
            const targetSk = SKILLS_CATALOG[hi.skillReq];
            return targetSk && learnedTypes.has(targetSk.type) && !p.heldItems[hi.id];
          });
          if (unownedHeld.length > 0) {
            const gift = unownedHeld[0];
            p.heldItems[gift.id] = true;
            p.dmgMult *= 1.12;
            this.spawnFloatingText(p.x, p.y - 36, `🎁 神鳥遺寶：獲得【${gift.name}】！`, "#C084FC", 15);
          }
        }
      } else if (e.id === 150) {
        this.saveData.stats.mewtwoDefeated += 1;
        this.saveData.unlockedTrainers["red"] = true;
        this.saveToStorage();
        if (!this.secretMewSpawned) {
          this.secretMewSpawned = true;
          // 擊敗超夢迎接夢幻前，給予神聖祝福：回復 60% HP 並立即重置訓練家大招冷卻！
          if (this.player) {
            this.player.hp = Math.min(this.player.maxHp, this.player.hp + Math.round(this.player.maxHp * 0.60));
            this.player.trainerSkillCd = 0;
            this.spawnFloatingText(this.player.x, this.player.y - 32, "✨ 冠軍祝福：HP +60% ＆ 大招重置！", "#34D399", 15);
          }
          this.spawnBoss(151, false);
          this.showCutsceneBanner("[終極試煉] 隱藏頭目【始祖夢幻 #151】甦醒！", "已為您回復 60% 生命並重置戰術大招，同時解鎖傳奇訓練家【赤紅 Red】！", 3800);
        }
      } else if (e.id === 151) {
        this.saveData.stats.mewDefeated += 1;
        this.saveToStorage();
        if (this.isEndlessMode) {
          const bonusCoins = Math.round(350 * diffCoinMult);
          this.runCoins += bonusCoins;
          this.saveData.coins += bonusCoins;
          if (this.player) {
            this.player.hp = Math.min(this.player.maxHp, this.player.hp + Math.round(this.player.maxHp * 0.50));
          }
          this.showCutsceneBanner(
            "【♾️ 始祖夢幻討伐成功・無盡深淵繼續！】",
            `獲得深淵賞金 +${bonusCoins} 代幣 ＆ 回復 50% HP！下一波深淵首領將於 2 分鐘後降臨！`,
            3800
          );
        } else {
          this.triggerGameOver(true);
          return;
        }
      }
    }

    if (e.isBoss) {
      for (let g = 0; g < 8; g++) {
        const gAng = (g * Math.PI * 2) / 8 + Math.random() * 0.3;
        const gDist = 18 + Math.random() * 28;
        this.gems.push({
          x: e.x + Math.cos(gAng) * gDist,
          y: e.y + Math.sin(gAng) * gDist,
          val: 120, tier: 4, size: 11.5,
          color: "#EC4899", innerColor: "#FBCFE8"
        });
      }
    } else if (e.isElite || e.treasureType) {
      this.gems.push({ x: e.x, y: e.y, val: 75, tier: 3, size: 9.5, color: "#F59E0B", innerColor: "#FEF08A" });
    } else if (e.weightTier === "heavy" || e.weightTier === "medium" || (e.data && e.data.hp >= 155)) {
      const capComp = this.getEffectiveMobCap(this.runTime / 60) <= 130 ? 1.22 : 1.0;
      this.gems.push({ x: e.x, y: e.y, val: Math.round(32 * capComp), tier: 2, size: 7.8, color: "#10B981", innerColor: "#A7F3D0" });
    } else {
      const capComp = this.getEffectiveMobCap(this.runTime / 60) <= 130 ? 1.22 : 1.0;
      this.gems.push({ x: e.x, y: e.y, val: Math.round(15 * capComp), tier: 1, size: 6.2, color: "#0284C7", innerColor: "#BAE6FD" });
    }

    if (this.gems.length > 120) {
      const g1 = this.gems.shift();
      this.gems[0].val += g1.val;
      if (this.gems[0].val >= 75) {
        this.gems[0].tier = 3; this.gems[0].size = 9.5;
        this.gems[0].color = "#F59E0B"; this.gems[0].innerColor = "#FEF08A";
      } else if (this.gems[0].val >= 30) {
        this.gems[0].tier = 2; this.gems[0].size = 7.8;
        this.gems[0].color = "#10B981"; this.gems[0].innerColor = "#A7F3D0";
      }
    }

    const coinGain = Math.max(1, Math.round((e.isElite ? 22 : 2) * diffCoinMult));
    this.runCoins += coinGain;
    this.saveData.coins += coinGain;
  },

  spawnMapLoot(id, x, y) {
    const meta = MAP_BOSS_LOOTS[id];
    if (meta) this.mapItems.push({ id, x, y, meta, bobPhase: Math.random() * Math.PI * 2 });
  },

  updateLootAndGems(dt) {
    const p = this.player;
    const palletBonus = (MapEngine.currentStage.id === "pallet") ? 1.20 : 1.0;
    const magnetHeldBonus = (p.heldItems && p.heldItems["magnet"]) ? 1.50 : 1.0;
    const effectiveMagnetR = p.magnetRadius * palletBonus * magnetHeldBonus;

    for (let i = this.gems.length - 1; i >= 0; i--) {
      const g = this.gems[i];
      const dx = p.x - g.x, dy = p.y - g.y;
      const dSq = dx * dx + dy * dy;

      // 遠處遺留水晶自動聚攏：超過 950px 的遠處水晶自動折疊至主角視野邊緣，防止長局跑圖累積
      if (dSq > 902500 && !g.magnetized) {
        const rAng = Math.random() * Math.PI * 2;
        g.x = p.x + Math.cos(rAng) * 320;
        g.y = p.y + Math.sin(rAng) * 320;
        continue;
      }

      if (dSq < effectiveMagnetR * effectiveMagnetR || g.magnetized) {
        g.magnetized = true;
        const d = Math.sqrt(dSq) || 1;
        g.x += (dx / d) * 440 * dt;
        g.y += (dy / d) * 440 * dt;
      }
      if (dSq < 484) {
        this.gems[i] = this.gems[this.gems.length - 1];
        this.gems.pop();
        this.gainExp(g.val);
      }
    }

    for (let i = this.mapItems.length - 1; i >= 0; i--) {
      const it = this.mapItems[i];
      if (it.id === "poke_mart") continue; // 商店絕不被碰撞拾取邏輯刪除

      const distToItem = Math.hypot(p.x - it.x, p.y - it.y);
      // 遠距離未拾取地面戰利品自動折疊順移至主角外圍 340px，避免無限累積
      if (distToItem > 1400) {
        const rAng = Math.random() * Math.PI * 2;
        it.x = p.x + Math.cos(rAng) * 340;
        it.y = p.y + Math.sin(rAng) * 340;
        continue;
      }

      it.bobPhase += dt * 4;
      if (distToItem < 30) {
        this.mapItems.splice(i, 1);
        if (it.id === "magnet") {
          this.gems.forEach(g => { g.magnetized = true; });
          SoundFX.play("super");
          this.spawnFloatingText(p.x, p.y - 24, "經驗磁鐵吸取!", "#38BDF8", 14);
        } else if (it.id === "partner_ball") {
          SoundFX.play("levelup");
          this.summonOrUpgradePartner();
        } else if (it.id === "rare_candy") {
          SoundFX.play("levelup");
          this.gainExp(p.nextExp - p.exp);
        } else if (it.id === "evo_chest") {
          this.openGoldenEvoChest();
        }
      }
    }
  },

  openGoldenEvoChest() {
    const p = this.player;
    SoundFX.play("levelup");
    let evolvedAny = false;
    const evolvedCount = Object.values(p.skills).filter(s => s.evolved).length;
    const maxAllowedSupers = (this.runTime >= 300 || (this.saveData && this.saveData.stats.birdsDefeated > 0 && this.birdBossSpawned)) ? 2 : 1;

    if (evolvedCount < maxAllowedSupers) {
      Object.values(p.skills).forEach(sk => {
        const meta = SKILLS_CATALOG[sk.id];
        if (sk.level >= 10 && !sk.evolved && (!meta.reqItem || p.heldItems[meta.reqItem])) {
          sk.evolved = true;
          evolvedAny = true;
          this.saveData.stats.superMoves += 1;
          this.showCutsceneBanner(`[寶箱突破] 領悟【${meta.evolvedName}】！`, meta.evoDesc, 3200);
        }
      });
    }

    if (!evolvedAny) {
      const skList = Object.values(p.skills);
      const pick = skList[Math.floor(Math.random() * skList.length)];
      if (pick && pick.level < 10) {
        pick.level = Math.min(10, pick.level + 2);
        this.spawnFloatingText(p.x, p.y - 26, `黃金寶箱強化 Lv.${pick.level}!`, "#F59E0B", 15);
      } else {
        this.runCoins += 250;
        this.saveData.coins += 250;
        this.spawnFloatingText(p.x, p.y - 26, `黃金寶箱 +250 代幣!`, "#F59E0B", 15);
      }
    }
    this.refreshHUD();
  },

  gainExp(amount) {
    const p = this.player;
    // 開啟測試無敵鎖血 (debugGodMode) 時，自動凍結經驗值升級彈窗，防止高壓怪海測試被三選一畫面頻繁打斷（除非主動點擊測試面板的 +5級三選一）
    if (this.debugGodMode) {
      p.exp = Math.min(p.nextExp - 1, p.exp + amount);
      return;
    }
    const expMult = (this.selectedTrainer.mods.expMult || 1.0) * (1 + (this.saveData.upgrades.greed || 0) * 0.12);
    p.exp += amount * expMult;
    if (p.exp >= p.nextExp) {
      p.exp -= p.nextExp;
      p.level += 1;
      p.nextExp = Math.round(p.nextExp * 1.22 + 14);
      SoundFX.play("levelup");

      // 每次升級附帶輕量生命回復 (+10% 最大 HP)，提升續航手感與正回饋
      if (p.hp < p.maxHp) {
        const lvlHeal = Math.max(4, Math.round(p.maxHp * 0.10));
        p.hp = Math.min(p.maxHp, p.hp + lvlHeal);
        this.spawnFloatingText(p.x, p.y - 24, `升級回復 +${lvlHeal} HP`, "#34D399", 12);
      }

      // 若達到進化等級，先記錄待執行的進化目標，優先彈出「升級三選一」，選完後緊接著播放進化光影演出！
      this._pendingEvolutionTarget = null;
      if (p.data.evo_level !== "None" && p.level >= p.data.evo_level) {
        if (p.id === 133) {
          this._pendingEvolutionTarget = "eevee";
        } else if (p.data.evo_to) {
          this._pendingEvolutionTarget = p.data.evo_to;
        }
      } else if (p.id >= 144 && (p.level === 12 || p.level === 24)) {
        // 傳說五神獸出戰專屬：Lv.12 與 Lv.24 觸發傳說神聖共鳴覺醒
        p.maxHp = Math.round(p.maxHp * 1.22);
        p.hp = p.maxHp;
        p.dmgMult *= 1.14;
        p.finalEvoArmor = 0.12;
        this.spawnParticleCluster(p.x, p.y, "#FACC15", "#EC4899", 36, "star", 1.4);
        this.showCutsceneBanner(`[傳說王權共鳴] ${p.data.name_zh} 釋放神聖威壓！`, "生命上限 +22% 並完全回滿，全招式傷害提升 +14%！", 3000);
      } else if (!p.data.evo_to && p.id < 144 && p.level === 18 && !p.singleStageAwakened) {
        // 單一階無進化精靈（卡比獸、拉普拉斯、飛天螳螂等）Lv.18 潛能突破覺醒
        p.singleStageAwakened = true;
        if (typeof getPokemonInnateTrait === "function") {
          p.innateTrait = getPokemonInnateTrait(p.data, p.level);
        }
        p.maxHp = Math.round(p.maxHp * 1.35);
        p.hp = p.maxHp;
        p.dmgMult *= 1.15;
        p.areaMult *= 1.08;
        p.finalEvoArmor = 0.12;
        this.spawnParticleCluster(p.x, p.y, "#38BDF8", "#FACC15", 38, "star", 1.4);
        this.showCutsceneBanner(`[潛能極限突破] ${p.data.name_zh} 覺醒完全體潛力！`, "最大生命 +35% 回滿、全傷害 +15%，並獲得 12% 霸體減傷！", 3200);
      }
      this.openLevelUpModal();
    }
  },

  confirmEeveeEvolution(targetId) {
    const eeModal = document.getElementById("eevee-evo-modal");
    if (eeModal) {
      eeModal.classList.add("hidden");
      eeModal.style.display = "none";
    }
    const p = this.player;
    const oldSkills = Object.values(p.skills);
    const savedLevels = oldSkills.slice(0, 3).map(s => s.level);
    const tmSkill = oldSkills[3] || null;

    this.startEvolutionMoment(targetId, true, () => {
      const evoSkillMap = typeof EEVEE_EVO_SKILLS !== "undefined" ? EEVEE_EVO_SKILLS : {
        134: ["Hydro Pump", "Ice Beam", "Tackle"],
        135: ["Thunderbolt", "Air Slash", "Tackle"],
        136: ["Flamethrower", "Dragon Rush", "Tackle"]
      };

      const rawSkillIds = evoSkillMap[targetId] || ["Hydro Pump", "Ice Beam", "Tackle"];
      const newSkillIds = rawSkillIds.map(sId => {
        if (SKILLS_CATALOG[sId]) return sId;
        const found = Object.keys(SKILLS_CATALOG).find(k => k.replace(/\s+/g, '') === sId.replace(/\s+/g, ''));
        return found || sId;
      });

      const unlockedSlotCount = Math.max(1, Math.min(3, oldSkills.length));
      p.skills = {};
      newSkillIds.slice(0, unlockedSlotCount).forEach((sId, idx) => {
        const minLv = (idx === 0) ? 3 : 1;
        p.skills[sId] = { id: sId, level: Math.max(minLv, savedLevels[idx] || 1), evolved: false, timer: 0.2 + idx * 0.15 };
      });

      p.naturalSkills = [...newSkillIds];
      if (tmSkill) {
        p.skills[tmSkill.id] = tmSkill;
      }
      this.refreshHUD();
    });
  },

  // ==========================================================================
  // 方案 A：【1.85 秒戰場時空凍結・掌機白光剪影交替進化演出】
  // ==========================================================================
  startEvolutionMoment(targetId, openLevelUpAfter = true, onEvolvedCallback = null) {
    const p = this.player;
    const nextData = POKEMON_MAP.get(targetId);
    if (!p || !nextData) {
      if (openLevelUpAfter) this.openLevelUpModal();
      return;
    }

    // 預載新形態立繪確保變身瞬間 0 閃爍
    SpriteCache.get(nextData.forward_sprite);
    SpriteCache.get(nextData.back_sprite);

    this.touchJoy.active = false;
    this.touchJoy.dx = 0;
    this.touchJoy.dy = 0;
    const joyBase = document.getElementById("touchJoyBase");
    const joyStick = document.getElementById("touchJoyStick");
    if (joyBase) joyBase.style.display = "none";
    if (joyStick) joyStick.style.display = "none";

    this.evoSequence = {
      active: true,
      timer: 0,
      duration: 1.85,
      oldData: p.data,
      nextData: nextData,
      targetId: targetId,
      evolvedApplied: false,
      openLevelUpAfter: openLevelUpAfter,
      onEvolvedCallback: onEvolvedCallback
    };

    this.state = "EVOLVING";
    SoundFX.play("evolution");
  },

  updateEvolutionMoment(dt) {
    const seq = this.evoSequence;
    if (!seq || !seq.active) {
      this.state = "PLAYING";
      return;
    }
    seq.timer += dt;

    // 在 1.35s 破殼瞬間正式套用新形態數值並炸開漫天金星與震退波
    if (seq.timer >= 1.35 && !seq.evolvedApplied) {
      seq.evolvedApplied = true;
      this.evolvePlayerPokemon(seq.targetId);
      if (typeof seq.onEvolvedCallback === "function") {
        seq.onEvolvedCallback();
      }
      this.camera.shakeTime = 0.35;
      this.camera.shakeMagnitude = 10;

      // 釋放 165px 進化覺醒保護震波，將周圍怪群震退 120px 防止時空恢復瞬間被貼臉圍毆
      const p = this.player;
      if (p) {
        const evoCol = TYPE_COLORS[seq.nextData.type1] || "#FACC15";
        SkillsEngine.meleeEffects.push({
          style: "slam_wave",
          x: p.x, y: p.y,
          radius: 175, timer: 0.42, maxTime: 0.42,
          color: evoCol
        });
        this.enemies.forEach(e => {
          if (e && e.hp > 0 && !e.isBoss && Math.hypot(e.x - p.x, e.y - p.y) < 185) {
            const ang = Math.atan2(e.y - p.y, e.x - p.x);
            e.x += Math.cos(ang) * 120;
            e.y += Math.sin(ang) * 120;
          }
        });
      }
    }

    if (seq.timer >= seq.duration) {
      seq.active = false;
      const shouldOpenLvl = seq.openLevelUpAfter;
      this.evoSequence = null;
      this.refreshHUD();
      if (shouldOpenLvl) {
        this.openLevelUpModal();
      } else {
        this.state = "PLAYING";
      }
    }
  },

  renderEvolutionOverlay(ctx, toSx, toSy) {
    const seq = this.evoSequence;
    if (!seq || !seq.active || !this.player) return;

    const p = this.player;
    const px = toSx(p.x);
    const py = toSy(p.y);
    const t = seq.timer;
    const dur = seq.duration;

    ctx.save();

    // 1. 戰場聚光燈暗角遮罩 (以主角為圓心，周圍戰場壓暗 74%)
    const spotR = t < 1.35 ? Math.max(68, 125 - t * 28) : 95 + (t - 1.35) * 420;
    const darkAlpha = t > 1.55 ? Math.max(0, (1 - (t - 1.55) / 0.30) * 0.74) : 0.74;
    const bgGrad = ctx.createRadialGradient(px, py, spotR * 0.25, px, py, spotR);
    bgGrad.addColorStop(0, "rgba(15, 23, 42, 0.0)");
    bgGrad.addColorStop(0.55, `rgba(15, 23, 42, ${darkAlpha * 0.45})`);
    bgGrad.addColorStop(1, `rgba(2, 6, 23, ${darkAlpha})`);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, this.width, this.height);

    // 2. 腳底雙層旋轉進化星陣與螺旋上升光球
    ctx.save();
    ctx.translate(px, py + 15);
    ctx.globalCompositeOperation = "lighter";
    const ringCol = TYPE_COLORS[seq.nextData.type1] || "#38BDF8";
    ctx.strokeStyle = "#FACC15";
    ctx.lineWidth = 3.0;
    ctx.beginPath();
    ctx.ellipse(0, 0, 42 + Math.sin(t * 14) * 5, 16, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = ringCol;
    ctx.lineWidth = 2.2;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.ellipse(0, 0, 56, 22, t * 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // 螺旋上升的 10 顆進化光珠
    for (let k = 0; k < 10; k++) {
      const orbProg = ((t * 1.6 + k * 0.1) % 1.0);
      const orbAng = t * 6.5 + (k * Math.PI * 2) / 10;
      const orbR = (1 - orbProg * 0.55) * 44;
      const ox = Math.cos(orbAng) * orbR;
      const oy = Math.sin(orbAng) * (orbR * 0.38) - orbProg * 78;
      ctx.fillStyle = k % 2 === 0 ? "#FEF08A" : "#38BDF8";
      ctx.beginPath();
      ctx.arc(ox, oy, 3.2 * (1 - orbProg * 0.4), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 3. 中央主角「雙重白光剪影加速交替變身」演出
    const oldRec = p.isShiny ? SpriteCache.getShiny(seq.oldData.forward_sprite) : SpriteCache.get(seq.oldData.forward_sprite);
    const nextRec = p.isShiny ? SpriteCache.getShiny(seq.nextData.forward_sprite) : SpriteCache.get(seq.nextData.forward_sprite);

    ctx.save();
    ctx.translate(px, py);

    if (t < 1.35) {
      // Phase 1 & 2 (0.0s ~ 1.35s)：由慢到快在舊形態與新形態純白剪影間交替縮放閃爍
      const normT = Math.max(0, (t - 0.18) / 1.17);
      // 頻率隨 normT 平方加速，從慢速交替到高速切換
      const wave = Math.sin(normT * normT * Math.PI * 13.5);
      const showNext = t >= 0.25 && wave > 0;
      const activeRec = showNext ? nextRec : oldRec;
      const pulseScale = 1.0 + Math.sin(t * 22) * 0.14 + normT * 0.22;
      const silhouetteAlpha = Math.min(1.0, 0.35 + normT * 0.65);

      // 中心凝聚白熾進化光球
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const orbGlow = ctx.createRadialGradient(0, -2, 4, 0, -2, 42 * pulseScale);
      orbGlow.addColorStop(0, `rgba(255, 255, 255, ${0.55 + normT * 0.4})`);
      orbGlow.addColorStop(0.55, "rgba(250, 204, 21, 0.45)");
      orbGlow.addColorStop(1, "rgba(56, 189, 248, 0)");
      ctx.fillStyle = orbGlow;
      ctx.beginPath();
      ctx.arc(0, -2, 42 * pulseScale, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      if (activeRec && activeRec.loaded) {
        const isHiRes = (activeRec.img.naturalWidth || activeRec.img.width || 0) > 160;
        ctx.imageSmoothingEnabled = isHiRes;
        ctx.scale(pulseScale, pulseScale);
        ctx.drawImage(activeRec.img, -28, -24, 56, 56);
        this.drawSilhouetteFlash(ctx, activeRec.img, -28, -24, 56, 56, "#FFFFFF", silhouetteAlpha);
      }
    } else {
      // Phase 3 (1.35s ~ 1.85s)：破殼金芒炸裂 + 新形態彈性登場跳躍
      const burstProg = (t - 1.35) / 0.50;
      const hopY = -Math.sin(burstProg * Math.PI) * 16;
      const scalePop = 1.28 - burstProg * 0.28;

      // 破殼瞬間放射狀八芒金白光束
      if (burstProg < 0.75) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const rayAlpha = (1 - burstProg / 0.75) * 0.85;
        ctx.strokeStyle = `rgba(254, 240, 138, ${rayAlpha})`;
        ctx.lineWidth = 4.5;
        for (let rIdx = 0; rIdx < 8; rIdx++) {
          const rAng = (rIdx * Math.PI) / 4 + burstProg * 0.6;
          ctx.beginPath();
          ctx.moveTo(Math.cos(rAng) * 18, Math.sin(rAng) * 18);
          ctx.lineTo(Math.cos(rAng) * (55 + burstProg * 65), Math.sin(rAng) * (55 + burstProg * 65));
          ctx.stroke();
        }
        ctx.restore();
      }

      if (nextRec && nextRec.loaded) {
        const isHiRes = (nextRec.img.naturalWidth || nextRec.img.width || 0) > 160;
        ctx.imageSmoothingEnabled = isHiRes;
        ctx.translate(0, hopY);
        ctx.scale(scalePop, scalePop);
        ctx.drawImage(nextRec.img, -28, -24, 56, 56);
        if (burstProg < 0.35) {
          this.drawSilhouetteFlash(ctx, nextRec.img, -28, -24, 56, 56, "#FEF08A", (1 - burstProg / 0.35) * 0.85);
        }
      }
    }
    ctx.restore();

    // 4. 畫面下方 GBA 經典雙層邊框進化對話框
    const boxW = Math.min(this.width - 28, 420);
    const boxH = 64;
    const boxX = (this.width - boxW) / 2;
    const boxY = Math.min(this.height - 118, py + 54);

    ctx.fillStyle = "rgba(15, 23, 42, 0.94)";
    ctx.strokeStyle = t >= 1.35 ? "#FACC15" : "#38BDF8";
    ctx.lineWidth = 3.0;
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, 14);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(boxX + 4, boxY + 4, boxW - 8, boxH - 8, 10);
    ctx.stroke();

    ctx.textAlign = "center";
    if (t < 1.35) {
      ctx.font = "900 13px 'Noto Sans TC', sans-serif";
      ctx.fillStyle = "#BAE6FD";
      ctx.fillText(`咦……！？ 你的 【${seq.oldData.name_zh}】 的樣子……！`, this.width / 2, boxY + 27);
      ctx.font = "700 11px 'Noto Sans TC', sans-serif";
      ctx.fillStyle = "#FDE047";
      ctx.fillText("✨ 正在凝聚進化之光，時空凍結中 ✨", this.width / 2, boxY + 47);
    } else {
      ctx.font = "900 14px 'Noto Sans TC', sans-serif";
      ctx.fillStyle = "#FACC15";
      ctx.fillText(`🎉 恭喜！ 進化成了 【${seq.nextData.name_zh}】！`, this.width / 2, boxY + 26);
      ctx.font = "700 11px 'Noto Sans TC', sans-serif";
      ctx.fillStyle = "#34D399";
      const traitText = p.innateTrait ? ` ‧ 特性【${p.innateTrait.name}】進階！` : "！";
      ctx.fillText(`HP上限突破至 ${p.maxHp} ‧ 全傷害大幅提升${traitText}`, this.width / 2, boxY + 47);
    }

    ctx.restore();
  },

  evolvePlayerPokemon(targetId) {
    const p = this.player;
    const nextData = POKEMON_MAP.get(targetId);
    if (!nextData) return;
    const oldName = p.data.name_zh;
    const isFinalForm = (nextData.evo_level === "None" || !nextData.evo_to);
    const hpBoostMult = isFinalForm ? 1.42 : 1.28;

    p.id = nextData.id;
    p.data = nextData;
    p.maxHp = Math.round(p.maxHp * hpBoostMult);
    p.hp = p.maxHp;
    p.invulnTimer = Math.max(p.invulnTimer || 0, 1.5);
    p.dmgMult *= isFinalForm ? 1.18 : 1.12;
    if (isFinalForm) {
      p.finalEvoArmor = 0.12; // 最終完全體獲得永久 12% 霸體減傷與範圍擴張
      p.areaMult *= 1.10;
      if (nextData.id === 149) {
        p.multiscaleReady = true;
        p.multiscaleTimer = 10.0;
      }
    }
    const starMult = p.starMult || 1.0;
    p.baseAtk = nextData.atk * (p.isShiny ? 1.2 : 1.0) * starMult;
    p.baseSpeed = nextData.speed;
    if (typeof getPokemonInnateTrait === "function") {
      p.innateTrait = getPokemonInnateTrait(nextData, p.level);
    }

    // 同步合併新形態的天生招式池（例如噴火龍解鎖空氣斬 AirSlash）
    if (typeof getNaturalSkillsForPokemon === "function") {
      const nextNat = getNaturalSkillsForPokemon(nextData);
      nextNat.forEach(sId => {
        if (p.naturalSkills && !p.naturalSkills.includes(sId)) {
          p.naturalSkills.push(sId);
        }
      });
    }

    this.saveData.stats.evolutions += 1;
    this.saveData.pokedexSeen[nextData.id] = true;
    this.saveData.pokedexCaught[nextData.id] = true;
    this.saveData.unlockedPokemon[nextData.id] = true;
    this.saveToStorage();

    SoundFX.play("levelup");
    this.spawnParticleCluster(p.x, p.y, "#F59E0B", "#FFFFFF", 44, "star", 1.5);
    const traitLabel = p.innateTrait ? ` ‧ 特性【${p.innateTrait.name}】進階強化！` : "！";
    const evoBannerSub = isFinalForm
      ? `【最終完全體覺醒】HP上限 ${p.maxHp}、全傷+18%、12%霸體${traitLabel}`
      : `生命上限提升至 ${p.maxHp}、全傷+12% 並回滿狀態${traitLabel}`;
    this.showCutsceneBanner(`[進化之光] ${oldName} 進化成了【${nextData.name_zh}】！`, evoBannerSub, 3400);
  },

  openLevelUpModal() {
    this.state = "PAUSED";
    // 強制重置搖桿與輸入，防止多點觸控狀態殘留死鎖
    this.touchJoy.active = false;
    this.touchJoy.dx = 0;
    this.touchJoy.dy = 0;
    const joyBase = document.getElementById("touchJoyBase");
    const joyStick = document.getElementById("touchJoyStick");
    if (joyBase) joyBase.style.display = "none";
    if (joyStick) joyStick.style.display = "none";
    const p = this.player;
    if (this.levelUpRerolls === undefined) {
      const upgReroll = (this.saveData && this.saveData.upgrades && this.saveData.upgrades.rerollCount) || 0;
      this.levelUpRerolls = 1 + upgReroll;
    }

    const buildPool = () => {
      const pool = [];
      const addedKeys = new Set();

      const evolvedCount = Object.values(p.skills).filter(s => s.evolved).length;
      const maxAllowedSupers = (this.runTime >= 300 || (this.saveData && this.saveData.stats.birdsDefeated > 0 && this.birdBossSpawned)) ? 2 : 1;
      if (evolvedCount < maxAllowedSupers) {
        Object.values(p.skills).forEach(sk => {
          const meta = SKILLS_CATALOG[sk.id];
          if (sk.level >= 10 && !sk.evolved && meta && (!meta.reqItem || p.heldItems[meta.reqItem])) {
            addedKeys.add(meta.name);
            pool.push({
              key: meta.name,
              weight: 100,
              rarityClass: "rarity-legendary",
              badge: "究極超武突破",
              badgeBg: "bg-amber-500 text-slate-950 font-black",
              title: meta.evolvedName,
              subTitle: "★ MAX 滿級突破",
              typeBadge: renderTypeBadgeHTML(meta.type),
              sprite: meta.sprite,
              desc: meta.evoDesc,
              isNew: false,
              apply: () => {
                sk.evolved = true;
                this.saveData.stats.superMoves += 1;
                this.showCutsceneBanner(`[究極突破] 領悟【${meta.evolvedName}】！`, meta.evoDesc, 3000);
              }
            });
          }
        });
      }

      Object.values(p.skills).forEach(sk => {
        if (sk.level < 10) {
          const meta = SKILLS_CATALOG[sk.id];
          const nextLv = sk.level + 1;
          if (meta && !addedKeys.has(meta.name)) {
            addedKeys.add(meta.name);
            pool.push({
              key: meta.name,
              weight: 42,
              rarityClass: "rarity-common",
              badge: "招式階級提升",
              badgeBg: "bg-slate-700 text-white font-bold",
              title: meta.name,
              subTitle: `Lv.${sk.level} ➔ Lv.${nextLv}`,
              typeBadge: renderTypeBadgeHTML(meta.type),
              sprite: meta.sprite,
              desc: getSkillNextLevelBonusDesc(nextLv),
              isNew: false,
              apply: () => { sk.level = nextLv; }
            });
          }
        }
      });

      pool.push(
        {
          key: "protein",
          weight: 30, rarityClass: "rarity-common", badge: "威力提升", badgeBg: "bg-slate-700 text-white",
          title: "蛋白藥劑", subTitle: "全傷 +5%", typeBadge: "", sprite: ITEM_SPRITES.protein,
          desc: "全面提升寶可夢所有招式傷害 +5%！", isNew: false, apply: () => { p.dmgMult *= 1.05; }
        },
        {
          key: "hpUp",
          weight: 30, rarityClass: "rarity-common", badge: "體質強化", badgeBg: "bg-slate-700 text-white",
          title: "HP提升劑", subTitle: "最大HP +12%", typeBadge: "", sprite: ITEM_SPRITES.hpUp,
          desc: "最大生命值提升 12%，並立即恢復 25% 已損失生命！", isNew: false,
          apply: () => { p.maxHp = Math.round(p.maxHp * 1.12); p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * 0.25)); }
        },
        {
          key: "carbos",
          weight: 28, rarityClass: "rarity-common", badge: "敏捷連動", badgeBg: "bg-slate-700 text-white",
          title: "敏捷強化劑", subTitle: "移速+5% ＆ CD-3%", typeBadge: "", sprite: ITEM_SPRITES.carbos,
          desc: "提升移動速度 5%，縮短招式冷卻 -3%！", isNew: false, apply: () => { p.speedMult *= 1.05; p.cdMult *= 0.97; }
        }
      );

      const currentCount = Object.keys(p.skills).length;
      if (currentCount < p.maxSkillSlots) {
        // 1. 優先推送天生尚未學會的招式 (高權重 60，嚴格去重)
        const unlearnedNatural = (p.naturalSkills || []).filter(sId => {
          const m = SKILLS_CATALOG[sId];
          return m && !Object.values(p.skills).some(existing => existing.id === m.id || existing.id.replace(/\s+/g,'') === m.id.replace(/\s+/g,''));
        });

        if (unlearnedNatural.length > 0) {
          unlearnedNatural.forEach(sId => {
            const meta = SKILLS_CATALOG[sId];
            if (meta && !addedKeys.has(meta.name)) {
              addedKeys.add(meta.name);
              pool.push({
                key: meta.name,
                weight: 60,
                rarityClass: "rarity-rare",
                badge: `天生招式 (${currentCount + 1}/${p.maxSkillSlots})`,
                badgeBg: "bg-emerald-600 text-white font-black",
                title: meta.name,
                subTitle: "本系領悟 Lv.1",
                typeBadge: renderTypeBadgeHTML(meta.type),
                sprite: meta.sprite,
                desc: meta.desc,
                isNew: true,
                apply: () => { const stagger = Object.keys(p.skills).length * 0.22; p.skills[meta.id] = { id: meta.id, level: 1, evolved: false, timer: 0.15 + stagger }; }
              });
            }
          });
        } else {
          // 2. 天生三招已學齊，才開放從全庫挑選普通新招
          Object.values(SKILLS_CATALOG).forEach(meta => {
            const alreadyHas = Object.values(p.skills).some(existing => existing.id === meta.id || existing.id.replace(/\s+/g,'') === meta.id.replace(/\s+/g,''));
            if (!alreadyHas && meta.id !== "Metronome" && !addedKeys.has(meta.name)) {
              addedKeys.add(meta.name);
              pool.push({
                key: meta.name,
                weight: 15,
                rarityClass: "rarity-rare",
                badge: `新招式 (${currentCount + 1}/${p.maxSkillSlots})`,
                badgeBg: "bg-blue-600 text-white font-black",
                title: meta.name,
                subTitle: "新領悟 Lv.1",
                typeBadge: renderTypeBadgeHTML(meta.type),
                sprite: meta.sprite,
                desc: meta.desc,
                isNew: true,
                apply: () => { const stagger = Object.keys(p.skills).length * 0.22; p.skills[meta.id] = { id: meta.id, level: 1, evolved: false, timer: 0.15 + stagger }; }
              });
            }
          });
        }
      }

      const learnedTypes = new Set(Object.values(p.skills).map(s => SKILLS_CATALOG[s.id]?.type));
      const eligibleHeld = Object.values(HELD_ITEMS).filter(hi => {
        const targetSkill = SKILLS_CATALOG[hi.skillReq];
        return targetSkill && learnedTypes.has(targetSkill.type) && !p.heldItems[hi.id];
      });
      if (eligibleHeld.length > 0) {
        const hi = eligibleHeld[Math.floor(Math.random() * eligibleHeld.length)];
        if (!addedKeys.has(hi.name)) {
          addedKeys.add(hi.name);
          const isHighDiff = this.selectedDifficulty && (this.selectedDifficulty.id === "hard" || this.selectedDifficulty.id === "hell");
          const hasHighLvSkill = Object.values(p.skills).some(s => s.level >= 8 && !s.evolved);
          const dynamicHeldWeight = isHighDiff ? (hasHighLvSkill ? 28 : 10) : (hasHighLvSkill ? 12 : 6);
          pool.push({
            key: hi.name,
            weight: dynamicHeldWeight, rarityClass: "rarity-epic", badge: "超武核心攜帶物", badgeBg: "bg-purple-600 text-white font-black",
            title: hi.name, subTitle: "★ 超武突破必備", typeBadge: "", sprite: hi.sprite, desc: hi.desc,
            isNew: true,
            apply: () => { p.heldItems[hi.id] = true; p.dmgMult *= 1.12; }
          });
        }
      }

      return pool;
    };

    const drawChoices = () => {
      const pool = buildPool();
      const choices = [];
      const temp = [...pool];
      while (choices.length < 3 && temp.length > 0) {
        const totalW = temp.reduce((s, x) => s + x.weight, 0);
        let r = Math.random() * totalW;
        let picked = 0;
        for (let i = 0; i < temp.length; i++) {
          r -= temp[i].weight;
          if (r <= 0) { picked = i; break; }
        }
        choices.push(temp.splice(picked, 1)[0]);
      }
      return choices;
    };

    this._currentUpgradeChoices = drawChoices();
    this.renderLevelUpModalContent();
    const modal = document.getElementById("levelUpModal");
    if (modal) {
      modal.classList.remove("hidden");
      modal.style.display = "flex";
    }
  },

  renderLevelUpModalContent() {
    const box = document.getElementById("upgradeChoicesContainer");
    if (!box) return;
    const p = this.player;

    // 頂部超武合成配方速查條 (顯示當前已學招式對應的超武攜帶物與持有狀態)
    const recipePills = p ? Object.values(p.skills).map(sk => {
      const meta = SKILLS_CATALOG[sk.id];
      if (!meta) return "";
      const reqMeta = meta.reqItem ? HELD_ITEMS[meta.reqItem] : null;
      const hasItem = reqMeta ? !!(p.heldItems && p.heldItems[reqMeta.id]) : true;
      return `
        <div class="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-800/90 border ${sk.evolved ? 'border-amber-400' : (hasItem ? 'border-emerald-500/70' : 'border-slate-700')} text-[10px]">
          <img src="${meta.sprite}" class="w-3.5 h-3.5 pixel-sprite"/>
          <span class="font-bold text-slate-200">${meta.name}</span>
          <span class="text-slate-500">+</span>
          ${reqMeta ? `<img src="${reqMeta.sprite}" class="w-3.5 h-3.5 pixel-sprite ${hasItem ? '' : 'opacity-40 grayscale'}"/>` : ''}
          <span class="${sk.evolved ? 'text-amber-300 font-black' : (hasItem ? 'text-emerald-400 font-black' : 'text-slate-400')}">
            ${sk.evolved ? '★已突破' : (reqMeta ? `${reqMeta.name}${hasItem ? '✓' : ''}` : '滿級突破')}
          </span>
        </div>
      `;
    }).join("") : "";

    const curSlots = p ? Object.keys(p.skills).length : 0;
    const maxSlots = p ? (p.maxSkillSlots || 3) : 3;
    const heldCount = p ? Object.keys(p.heldItems || {}).length : 0;
    const statusHeaderBar = p ? `
      <div class="flex items-center justify-between gap-1 bg-slate-800/90 border border-slate-700 px-2.5 py-1 rounded-xl mb-2 text-[10px] font-black">
        <span class="text-emerald-400"><i class="fa-solid fa-heart-pulse"></i> HP: ${Math.ceil(p.hp)}/${p.maxHp}</span>
        <span class="text-sky-300"><i class="fa-solid fa-bolt"></i> 招式槽: ${curSlots}/${maxSlots}</span>
        <span class="text-purple-300"><i class="fa-solid fa-toolbox"></i> 攜帶物: ${heldCount}件</span>
        <span class="text-amber-300"><i class="fa-solid fa-coins"></i> ${this.runCoins}金</span>
      </div>
    ` : "";

    const recipeBarHtml = statusHeaderBar + (recipePills ? `
      <div class="bg-slate-950/75 border border-slate-800 rounded-xl p-2 mb-2.5">
        <div class="text-[10px] font-bold text-amber-300/90 mb-1 flex items-center gap-1">
          <i class="fa-solid fa-flask text-[9px]"></i>
          <span>超武合成配方提示（招式 Lv.10 ＋ 對應攜帶物 ＝ 究極超武）：</span>
        </div>
        <div class="flex flex-wrap gap-1.5">${recipePills}</div>
      </div>
    ` : "");

    const choicesHtml = (this._currentUpgradeChoices || []).map((c, idx) => `
      <div onclick="GameApp.selectUpgradeChoice(${idx})" ontouchstart="event.preventDefault(); event.stopPropagation(); GameApp.selectUpgradeChoice(${idx})" class="poke-card ${c.rarityClass} cursor-pointer p-3 sm:p-3.5 flex items-center justify-between gap-3 hover:-translate-y-0.5 transition-transform relative select-none">
        ${c.isNew ? `
          <div class="absolute top-0 left-0 bg-gradient-to-r from-red-600 via-rose-500 to-amber-500 text-white font-pixel text-[9px] px-2.5 py-0.5 rounded-tl-[13px] rounded-br-lg border-b border-r border-white/80 shadow-md flex items-center gap-1 z-10 animate-pulse">
            <i class="fa-solid fa-sparkles text-[8px] text-amber-200"></i>NEW!
          </div>
        ` : ''}
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-12 h-12 rounded-2xl bg-slate-900/40 border-2 border-slate-700 flex items-center justify-center shrink-0">
            <img src="${c.sprite}" class="w-9 h-9 pixel-sprite object-contain" alt="${c.title}" />
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="font-black text-sm sm:text-base text-slate-800 leading-tight whitespace-nowrap">${c.title}</span>
              ${c.typeBadge || ''}
              <span class="px-2 py-0.5 rounded-full text-[9px] ${c.badgeBg} whitespace-nowrap">${c.badge}</span>
            </div>
            <p class="text-xs font-bold text-slate-600 leading-snug mt-0.5 break-words">${c.desc}</p>
          </div>
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          <button class="poke-btn-red px-3 sm:px-4 py-2 text-xs font-black min-h-[38px] flex items-center gap-1">
            <span>選擇</span>
            <span class="font-pixel text-[10px] text-amber-200 opacity-90">[${idx + 1}]</span>
          </button>
        </div>
      </div>
    `).join("");

    const freeRerolls = this.levelUpRerolls || 0;
    const paidCount = this.paidRerollCount || 0;
    const coinCost = 30 + paidCount * 30;
    const availableCoins = this.saveData ? (this.saveData.coins || 0) : (this.runCoins || 0);
    const canFreeReroll = freeRerolls > 0;
    const canCoinReroll = !canFreeReroll && availableCoins >= coinCost;
    const canReroll = canFreeReroll || canCoinReroll;

    let rerollLabelHtml = "";
    if (canFreeReroll) {
      rerollLabelHtml = `<i class="fa-solid fa-dice text-xs"></i><span>免費重抽 (剩餘 ${freeRerolls} 次) [R]</span>`;
    } else {
      rerollLabelHtml = `<img src="${ITEM_SPRITES.coin}" class="w-4 h-4 pixel-sprite"/><span>代幣重抽 (${coinCost} 金 / 持有 ${availableCoins}) [R]</span>`;
    }

    const rerollBarHtml = `
      <div class="mt-3 pt-2.5 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2">
        <span id="levelUpRerollHint" class="text-[11px] font-bold text-slate-400">鍵盤提示：按 [1][2][3] 選取，[R] 鍵重抽（免費次數用完可用代幣重抽）</span>
        <button onclick="GameApp.rerollUpgradeChoices()" ontouchstart="event.preventDefault(); event.stopPropagation(); GameApp.rerollUpgradeChoices()" ${!canReroll ? 'disabled' : ''} class="${canFreeReroll ? 'poke-btn-yellow' : (canCoinReroll ? 'poke-btn-blue' : 'poke-btn-white opacity-50 cursor-not-allowed')} px-3.5 py-1.5 text-xs font-black flex items-center gap-1.5 shrink-0">
          ${rerollLabelHtml}
        </button>
      </div>
    `;

    box.innerHTML = recipeBarHtml + choicesHtml + rerollBarHtml;
  },

  rerollUpgradeChoices() {
    const freeRerolls = this.levelUpRerolls || 0;
    if (freeRerolls > 0) {
      this.levelUpRerolls -= 1;
      SoundFX.play("super");
      this.openLevelUpModal();
      return;
    }

    const paidCount = this.paidRerollCount || 0;
    const coinCost = 30 + paidCount * 30;
    const availableCoins = this.saveData ? (this.saveData.coins || 0) : (this.runCoins || 0);

    if (availableCoins < coinCost) {
      const hintEl = document.getElementById("levelUpRerollHint");
      if (hintEl) {
        hintEl.textContent = `⚠️ 代幣不足！需要 ${coinCost} 代幣才能繼續重抽！`;
        hintEl.classList.remove("text-slate-400");
        hintEl.classList.add("text-rose-400", "animate-pulse");
      }
      return;
    }

    if (this.saveData) {
      this.saveData.coins = Math.max(0, (this.saveData.coins || 0) - coinCost);
    }
    this.runCoins = Math.max(0, (this.runCoins || 0) - coinCost);
    this.paidRerollCount = paidCount + 1;
    SoundFX.play("super");
    this.refreshHUD();
    this.openLevelUpModal();
  },

  selectUpgradeChoice(idx) {
    const c = this._currentUpgradeChoices && this._currentUpgradeChoices[idx];
    if (c && c.apply) c.apply();
    const lvlModal = document.getElementById("levelUpModal");
    if (lvlModal) {
      lvlModal.classList.add("hidden");
      lvlModal.style.display = "none";
    }
    this.refreshHUD();

    // 若本次升級同時達成進化門檻，三選一選完後立即銜接進化演出！
    const pendingEvo = this._pendingEvolutionTarget;
    this._pendingEvolutionTarget = null;
    if (pendingEvo === "eevee") {
      this.state = "PAUSED";
      const eeModal = document.getElementById("eevee-evo-modal");
      if (eeModal) {
        eeModal.classList.remove("hidden");
        eeModal.style.display = "flex";
      }
      return;
    } else if (pendingEvo) {
      this.startEvolutionMoment(pendingEvo, false);
      return;
    }

    this.state = "PLAYING";
  },

  updateParticlesAndTexts(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= dt;
      if (pt.life <= 0) {
        this.particles[i] = this.particles[this.particles.length - 1];
        this.particles.pop();
      }
    }
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y -= 28 * dt;
      ft.life -= dt;
      if (ft.life <= 0) this.floatingTexts.splice(i, 1);
    }
  },

  spawnFloatingText(x, y, text, color = "#FFFFFF", size = 12) {
    const mode = (this.saveData && this.saveData.settings && this.saveData.settings.dmgTextMode) || "all";
    // 若設定為「關閉傷害數字」，僅保留回血、升級、道具獲得與系統提示文字，過濾純數字與戰鬥爆字
    if (mode === "off" && (/^(\d+|克制|暴擊|極限暴擊|劇毒暴擊|抵抗|微弱抵抗|灼傷|中毒|劇毒腐蝕)/.test(text))) {
      return;
    }
    // 若設定為「精簡模式 (僅暴擊與克制)」，自動過濾普通白字與灰字抵抗傷害
    if (mode === "crit_only" && (color === "#FFFFFF" || color === "#CBD5E1" || color === "#94A3B8") && size <= 12) {
      return;
    }
    if (this.enemies && this.enemies.length > 100 && color === "#FFFFFF" && size <= 12 && Math.random() < 0.70) {
      return; // 百怪同屏高壓節流：過濾部分普通白字微傷，大幅減少 iOS Canvas strokeText 開銷
    }
    if (this.floatingTexts.length > 32) this.floatingTexts.shift();
    this.floatingTexts.push({ x, y, text, color, size, life: 0.72 });
  },

  showCutsceneBanner(title, subtitle, duration = 2600) {
    const b = document.getElementById("cutsceneBanner");
    document.getElementById("cutsceneTitle").textContent = title;
    document.getElementById("cutsceneSubtitle").textContent = subtitle;
    b.classList.remove("hidden");
    clearTimeout(this._bannerTimeout);
    this._bannerTimeout = setTimeout(() => b.classList.add("hidden"), duration);
  },

  // 零 ctx.filter ＆ 零管線阻塞剪影閃白渲染器：直接讀取 SpriteCache 預烘焙剪影，百怪同屏受創 0 clearRect 開銷！
  drawSilhouetteFlash(ctx, img, x, y, w, h, color = "#FFFFFF", alpha = 0.72) {
    if (!img) return;
    const silCan = (typeof SpriteCache !== "undefined" && SpriteCache.getSilhouette)
      ? SpriteCache.getSilhouette(img, color)
      : null;
    if (!silCan) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(silCan, 0, 0, silCan.width, silCan.height, x, y, w, h);
    ctx.restore();
  },

  renderCombat() {
    const ctx = this.ctx;
    const dpr = this.dpr || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, this.width, this.height);
    if (!this.player) return;

    let shakeX = 0, shakeY = 0;
    const shakePref = (this.saveData && this.saveData.settings && this.saveData.settings.screenShake) || "normal";
    if (this.camera.shakeTime > 0 && shakePref !== "off") {
      const shakeScale = shakePref === "low" ? 0.45 : 1.0;
      shakeX = (Math.random() - 0.5) * this.camera.shakeMagnitude * 2 * shakeScale;
      shakeY = (Math.random() - 0.5) * this.camera.shakeMagnitude * 2 * shakeScale;
    }
    const camX = this.camera.x + shakeX;
    const camY = this.camera.y + shakeY;
    const toSx = (wx) => wx - camX + this.width / 2;
    const toSy = (wy) => wy - camY + this.height / 2;

    MapEngine.renderBiomeWorld(ctx, camX, camY, this.width, this.height);

    this.telegraphs.forEach(tg => {
      const pct = 1 - (tg.timer / tg.maxTime);
      ctx.save();

      if (tg.shape === "line") {
        const ssx = toSx(tg.startX), ssy = toSy(tg.startY);
        ctx.translate(ssx, ssy);
        ctx.rotate(tg.angle);

        ctx.fillStyle = "rgba(239, 68, 68, 0.20)";
        ctx.strokeStyle = "rgba(239, 68, 68, 0.85)";
        ctx.lineWidth = 2.0;
        ctx.fillRect(0, -tg.width / 2, tg.length, tg.width);
        ctx.strokeRect(0, -tg.width / 2, tg.length, tg.width);

        ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
        ctx.fillRect(0, -tg.width / 2, tg.length * pct, tg.width);
      } else if (tg.shape === "ring") {
        const sx = toSx(tg.x), sy = toSy(tg.y);
        ctx.strokeStyle = tg.color || "rgba(56, 189, 248, 0.85)";
        ctx.lineWidth = 3.0;
        ctx.beginPath();
        ctx.arc(sx, sy, tg.innerRadius + (tg.radius - tg.innerRadius) * pct, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(sx, sy, tg.radius, 0, Math.PI * 2);
        ctx.stroke();
      } else if (tg.isBossWarning) {
        const sx = toSx(tg.x), sy = toSy(tg.y);
        const curR = tg.radius * (1 - pct);

        ctx.fillStyle = "rgba(239, 68, 68, 0.25)";
        ctx.beginPath();
        ctx.arc(sx, sy, tg.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "#EF4444";
        ctx.lineWidth = 3.5;
        ctx.stroke();

        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.arc(sx, sy, curR, 0, Math.PI * 2);
        ctx.stroke();

        ctx.font = "900 12px 'Noto Sans TC', sans-serif";
        ctx.textAlign = "center";
        ctx.fillStyle = "#FDE047";
        ctx.strokeStyle = "#0F172A";
        ctx.lineWidth = 3;
        ctx.strokeText(`⚠️ DANGER: ${tg.timer.toFixed(1)}s`, sx, sy + 4);
        ctx.fillText(`⚠️ DANGER: ${tg.timer.toFixed(1)}s`, sx, sy + 4);
      } else {
        const sx = toSx(tg.x), sy = toSy(tg.y);
        ctx.strokeStyle = tg.color || "rgba(239, 68, 68, 0.9)";
        ctx.fillStyle = tg.isSuction ? "rgba(168, 85, 247, 0.22)" : "rgba(239, 68, 68, 0.18)";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(sx, sy, tg.radius, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();

        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sx, sy, tg.radius * (1 - pct), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    });

    // 圖層 1：地面底層技能與領域特效 (renderGroundLayer) — 繪製於所有寶可夢與訓練家腳下
    SkillsEngine.renderGroundLayer(ctx, toSx, toSy);

    // 繪製【木炭】熔岩灼燒腳印
    this.lavaFootprints.forEach(lf => {
      const lsx = toSx(lf.x), lsy = toSy(lf.y);
      const alpha = Math.max(0, (lf.life / lf.maxLife) * 0.65);
      ctx.save();
      ctx.fillStyle = `rgba(239, 68, 68, ${alpha})`;
      ctx.strokeStyle = `rgba(253, 224, 71, ${alpha * 1.1})`;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.ellipse(lsx, lsy, lf.radius, lf.radius * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    });

    this.gems.forEach(g => {
      const sx = toSx(g.x), sy = toSy(g.y);
      if (sx < -20 || sx > this.width + 20 || sy < -20 || sy > this.height + 20) return;
      const s = g.size || 6.5;
      ctx.save();
      ctx.translate(sx, sy);

      ctx.fillStyle = "rgba(15, 23, 42, 0.30)";
      ctx.beginPath();
      ctx.ellipse(0, s * 0.85, s * 0.65, s * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = g.color || "#0284C7";
      ctx.strokeStyle = "#0F172A";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.lineTo(s * 0.78, 0);
      ctx.lineTo(0, s);
      ctx.lineTo(-s * 0.78, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = g.innerColor || "#BAE6FD";
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.62);
      ctx.lineTo(s * 0.38, 0);
      ctx.lineTo(0, s * 0.35);
      ctx.lineTo(-s * 0.45, -s * 0.08);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.arc(-s * 0.18, -s * 0.32, s * 0.16, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    this.mapItems.forEach(it => {
      const sx = toSx(it.x);
      const sy = toSy(it.y);

      // 專屬繪製：GBA 經典友好商店 (藍頂白牆建築風格 + 亮金色 SHOP 招牌)
      if (it.id === "poke_mart") {
        ctx.save();
        // 1. 地面投影
        ctx.fillStyle = "rgba(15, 23, 42, 0.45)";
        ctx.beginPath();
        ctx.ellipse(sx, sy + 18, 30, 11, 0, 0, Math.PI * 2);
        ctx.fill();

        // 2. 建築物主體白牆 (38 x 26)
        ctx.fillStyle = "#F8FAFC";
        ctx.strokeStyle = "#0F172A";
        ctx.lineWidth = 2.2;
        ctx.fillRect(sx - 19, sy - 6, 38, 24);
        ctx.strokeRect(sx - 19, sy - 6, 38, 24);

        // 3. 經典深藍色斜屋頂 (雙層立體像素屋頂)
        ctx.fillStyle = "#0284C7";
        ctx.beginPath();
        ctx.moveTo(sx - 24, sy - 6);
        ctx.lineTo(sx, sy - 22);
        ctx.lineTo(sx + 24, sy - 6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#38BDF8";
        ctx.beginPath();
        ctx.moveTo(sx - 20, sy - 7);
        ctx.lineTo(sx, sy - 20);
        ctx.lineTo(sx + 20, sy - 7);
        ctx.closePath();
        ctx.fill();

        // 4. 玻璃櫥窗與紅色大門
        ctx.fillStyle = "#BAE6FD";
        ctx.fillRect(sx - 14, sy + 2, 9, 8);
        ctx.strokeRect(sx - 14, sy + 2, 9, 8);

        ctx.fillStyle = "#EF4444";
        ctx.fillRect(sx + 2, sy + 1, 10, 17);
        ctx.strokeRect(sx + 2, sy + 1, 10, 17);

        // 5. 屋頂上方常駐霓虹招牌：【SHOP】亮金標籤
        const bounce = Math.sin(performance.now() * 0.005) * 3;
        const signY = sy - 30 + bounce;
        ctx.fillStyle = "#FDE047";
        ctx.strokeStyle = "#78350F";
        ctx.lineWidth = 1.8;
        ctx.fillRect(sx - 18, signY - 7, 36, 13);
        ctx.strokeRect(sx - 18, signY - 7, 36, 13);

        ctx.font = "900 8px 'Press Start 2P', monospace";
        ctx.textAlign = "center";
        ctx.fillStyle = "#1E293B";
        ctx.fillText("SHOP", sx, signY + 3);

        // 6. 玩家靠近範圍 (<75px) 時：繪製地面互動光圈與進度條
        const distToP = Math.hypot(this.player.x - it.x, this.player.y - it.y);
        if (distToP < 75) {
          ctx.strokeStyle = "rgba(56, 189, 248, 0.75)";
          ctx.lineWidth = 2.0;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.ellipse(sx, sy + 10, 42, 22, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);

          // 站定時的環形填充進度條
          if (it.standTimer > 0) {
            const fillPct = Math.min(1, it.standTimer / 0.35);
            ctx.strokeStyle = "#FDE047";
            ctx.lineWidth = 3.5;
            ctx.beginPath();
            ctx.arc(sx, sy + 10, 26, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * fillPct);
            ctx.stroke();
          }
        }
        ctx.restore();
      } else {
        // 其他常規掉落物 (磁鐵、糖果、寶箱、精靈球)
        const yOffset = Math.sin(it.bobPhase) * 4;
        const rec = SpriteCache.get(it.meta.sprite);
        ctx.save();
        ctx.fillStyle = "rgba(15,23,42,0.65)";
        ctx.strokeStyle = it.meta.color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(sx, sy + yOffset, 16, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        if (rec && rec.loaded) {
          ctx.drawImage(rec.img, sx - 12, sy + yOffset - 12, 24, 24);
        } else {
          ctx.fillStyle = it.meta.color || "#FACC15";
          ctx.beginPath();
          ctx.arc(sx, sy + yOffset, 7, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    });

    const p = this.player;
    const px = toSx(p.x), py = toSy(p.y);
    const pBob = Math.abs(Math.sin(p.walkBob)) * 4;
    const terrain = MapEngine.getTerrainModifierAt(p.x, p.y);
    const inWater = terrain.inWater;
    const inGrass = terrain.label.includes("草叢");

    // 1. 先繪製主角與隨行訓練家的地面光環、水波紋與戰術指標（屬於貼地層，永不遮擋任何角色腳部）
    if (this.trainerCompanion) {
      const tc = this.trainerCompanion;
      const tsx = toSx(tc.x), tsy = toSy(tc.y);
      const tTerrain = MapEngine.getTerrainModifierAt(tc.x, tc.y);
      ctx.save();
      if (tTerrain.inWater) {
        const waveCycle = (performance.now() * 0.005 + 1.2) % Math.PI;
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.8 - waveCycle / Math.PI})`;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.ellipse(tsx, tsy + 16, 15 + waveCycle * 7, 6 + waveCycle * 3, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = "rgba(15, 23, 42, 0.30)";
        ctx.beginPath();
        ctx.ellipse(tsx, tsy + 18, 14, 5.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = tc.whiteFlashTimer > 0 ? "rgba(239, 68, 68, 0.95)" : "rgba(56, 189, 248, 0.45)";
      ctx.lineWidth = tc.whiteFlashTimer > 0 ? 3.0 : 1.6;
      ctx.beginPath();
      ctx.ellipse(tsx, tsy + 18, 13, 5.2, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    this.partners.forEach(pt => {
      const psx = toSx(pt.x), psy = toSy(pt.y);
      ctx.save();
      ctx.fillStyle = "rgba(236,72,153,0.28)";
      ctx.beginPath();
      ctx.ellipse(psx, psy + 16, 13, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    ctx.save();
    if (inWater) {
      const waveCycle = (performance.now() * 0.005) % Math.PI;
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.8 - waveCycle / Math.PI})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(px, py + 15, 16 + waveCycle * 8, 7 + waveCycle * 3.5, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = "rgba(15, 23, 42, 0.30)";
      ctx.beginPath();
      ctx.ellipse(px, py + 15, 14, 5.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    if (p.isTrainerBond) {
      ctx.strokeStyle = p.bondColor;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(px, py + 16, 20, 7.0, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (Object.values(p.skills || {}).filter(s => s.evolved).length >= 2) {
      ctx.save();
      ctx.strokeStyle = "rgba(250, 204, 21, 0.9)";
      ctx.lineWidth = 2.2;
      ctx.setLineDash([7, 5]);
      ctx.beginPath();
      ctx.ellipse(px, py + 16, 25, 8.8, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (this.manualAimMode) {
      const aimAng = (p.vx || p.vy)
        ? Math.atan2(p.vy, p.vx)
        : (p.facingY !== 0 ? (p.facingY < 0 ? -Math.PI / 2 : Math.PI / 2) : (p.facingX >= 0 ? 0 : Math.PI));
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(aimAng);
      ctx.fillStyle = "rgba(56, 189, 248, 0.85)";
      ctx.strokeStyle = "#0F172A";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(42, 0);
      ctx.lineTo(30, -6);
      ctx.lineTo(33, 0);
      ctx.lineTo(30, 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    if (p.heldItems && p.heldItems["never_melt_ice"]) {
      ctx.save();
      ctx.strokeStyle = "rgba(130, 230, 255, 0.35)";
      ctx.fillStyle = "rgba(100, 210, 255, 0.05)";
      ctx.lineWidth = 1.8;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.arc(px, py, 125, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    if (p.xSpeedTimer > 0) {
      const spdNow = performance.now() * 0.01;
      ctx.save();
      ctx.strokeStyle = "rgba(56, 189, 248, 0.82)";
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.ellipse(px, py + 17, 24, 8, 0, -spdNow, -spdNow + Math.PI * 1.35);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();

    // 2. 單一 Batch 批次繪製全場可視敵人的腳底黑影 (1 次底層 GPU 呼叫)
    const visibleEnemies = [];
    ctx.save();
    ctx.fillStyle = "rgba(15, 23, 42, 0.32)";
    ctx.beginPath();
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      const esx = toSx(e.x), esy = toSy(e.y);
      if (esx < -90 || esx > this.width + 90 || esy < -90 || esy > this.height + 90) continue;
      const sz = e.isBoss ? 120 : (e.isElite || e.treasureType ? 88 : 64);
      e._esx = esx;
      e._esy = esy;
      e._sz = sz;
      visibleEnemies.push(e);
      const rx = sz * 0.32, ry = sz * 0.12, cy = esy + sz * 0.35;
      ctx.moveTo(esx + rx, cy);
      ctx.ellipse(esx, cy, rx, ry, 0, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.restore();

    // 精英小王腳底雙層頭目威壓底座 ＆ 神獸 Boss 二階段 Overdrive 狂暴光環（貼地層）
    visibleEnemies.forEach(e => {
      if (e.isBoss && e.overdriveTriggered) {
        const esx = e._esx, esy = e._esy, sz = e._sz;
        const pulse = Math.sin(performance.now() * 0.01) * 4;
        ctx.save();
        ctx.strokeStyle = "rgba(239, 68, 68, 0.90)";
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.ellipse(esx, esy + sz * 0.35, sz * 0.44 + pulse, sz * 0.19 + pulse * 0.4, 0, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = "#FACC15";
        ctx.lineWidth = 2.0;
        ctx.setLineDash([8, 5]);
        ctx.beginPath();
        ctx.ellipse(esx, esy + sz * 0.35, sz * 0.36, sz * 0.15, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      } else if (e.isElite && !e.isBoss) {
        const esx = e._esx, esy = e._esy, sz = e._sz;
        ctx.save();
        ctx.strokeStyle = "rgba(239, 68, 68, 0.85)";
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.ellipse(esx, esy + sz * 0.35, sz * 0.40, sz * 0.17, 0, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = "rgba(250, 204, 21, 0.90)";
        ctx.lineWidth = 1.6;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.ellipse(esx, esy + sz * 0.35, sz * 0.33, sz * 0.13, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
    });

    const highDensityLOD = visibleEnemies.length > 90;

    // 3. P1 關鍵升級：建立 2.5D Y-Axis 深度排序佇列 (Y-Sorting Queue)
    // 依據每個實體腳底接觸地面的螢幕 Y 座標升序排列，徹底解決角色與怪獸上下交錯時的頭腳穿幫問題
    const renderQueue = [];

    if (this.trainerCompanion) {
      renderQueue.push({ kind: "trainer", sortY: toSy(this.trainerCompanion.y) + 18 });
    }
    this.partners.forEach(pt => {
      renderQueue.push({ kind: "partner", pt, sortY: toSy(pt.y) + 16 });
    });
    renderQueue.push({ kind: "player", sortY: py + 18 });
    for (let i = 0; i < visibleEnemies.length; i++) {
      const e = visibleEnemies[i];
      renderQueue.push({ kind: "enemy", e, sortY: e._esy + e._sz * 0.35 });
    }

    renderQueue.sort((a, b) => a.sortY - b.sortY);

    // 共用 GBA 像素草簇遮腿繪製器（與地圖高草叢 100% 畫風統一：深綠根部 + 三片搖曳像素草葉 + 亮綠葉尖）
    const drawPixelGrassOverlay = (worldX, worldY, rootY, spreadList) => {
      const gNow = performance.now() * 0.0016;
      spreadList.forEach(ox => {
        const sway = Math.round(Math.sin(gNow * 1.8 + (worldX + ox) * 0.05 + worldY * 0.05) * 2.0);
        ctx.fillStyle = "#0F2917";
        ctx.fillRect(ox - 5, rootY - 2, 10, 4);
        ctx.fillStyle = "#2E8540";
        ctx.fillRect(ox - 6 + sway, rootY - 8, 3, 7);
        ctx.fillRect(ox - 1 + sway, rootY - 10, 3, 9);
        ctx.fillRect(ox + 4 + sway, rootY - 8, 3, 7);
        ctx.fillStyle = "#74E068";
        ctx.fillRect(ox - 6 + sway, rootY - 9, 3, 2);
        ctx.fillRect(ox - 1 + sway, rootY - 11, 3, 2);
        ctx.fillRect(ox + 4 + sway, rootY - 9, 3, 2);
      });
    };

    // 共用 GBA 像素涉水吃水線與水花波紋繪製器（營造腰部以下真正泡在海水中的真實折射與白沫感）
    const drawPixelWaterlineFoam = (cutY, halfWidth, phaseOffset = 0) => {
      const wNow = performance.now() * 0.004 + phaseOffset;
      // 水面下微藍海水折射半透明遮罩邊
      ctx.fillStyle = "rgba(2, 132, 199, 0.55)";
      ctx.fillRect(-halfWidth, cutY - 3, halfWidth * 2, 4);
      // 貼合腰部切線的階梯狀跳動像素白沫水花
      ctx.fillStyle = "rgba(224, 242, 254, 0.92)";
      for (let wx = -halfWidth + 2; wx <= halfWidth - 6; wx += 8) {
        const wyOff = Math.round(Math.sin(wNow + wx * 0.25) * 1.2);
        ctx.fillRect(wx, cutY - 1 + wyOff, 5, 2);
      }
      ctx.fillStyle = "#BAE6FD";
      ctx.fillRect(-halfWidth + 5, cutY + 1, halfWidth * 2 - 10, 2);
    };

    // 定義各類實體的精確繪製函數
    const drawTrainerEntity = () => {
      const tc = this.trainerCompanion;
      const tsx = toSx(tc.x), tsy = toSy(tc.y);
      const isMoving = tc.walkBob > 0.01;
      const bob = isMoving ? Math.abs(Math.sin(tc.walkBob)) * (tc.isJumpingLedge ? 1.5 : 3.2) : 0;
      // 針對雙腳並攏的立正像素圖 (Ash_01, brock_01 等)，加入步伐左右微傾角與輕微彈性縮放，消除立正跳躍感
      const strideTilt = isMoving ? Math.sin(tc.walkBob) * (tInWater => tInWater ? 0.035 : 0.068)(MapEngine.getTerrainModifierAt(tc.x, tc.y).inWater) : 0;
      const strideSquashY = isMoving ? (1 - Math.abs(Math.cos(tc.walkBob)) * 0.035) : 1.0;

      const tTerrain = MapEngine.getTerrainModifierAt(tc.x, tc.y);
      const tInWater = tTerrain.inWater && !tc.isJumpingLedge;
      const tInGrass = tTerrain.label.includes("草叢") && !tc.isJumpingLedge;

      let activeUrl = tc.sprite;
      let needFlip = false;
      if (tc.sprites) {
        if (tc.facingY < 0) activeUrl = tc.sprites.up;
        else if (tc.facingY > 0) activeUrl = tc.sprites.down;
        else if (tc.facingX < 0) activeUrl = tc.sprites.left;
        else activeUrl = tc.sprites.right;
      } else {
        needFlip = tc.facingX > 0;
      }
      const tRec = SpriteCache.get(activeUrl);

      ctx.save();
      // 智慧解析度分流：高解析訓練員原圖 (如 512x512 / 1024x1024 PNG) 開啟高階平滑縮放至 Retina 畫布，避免五官黑線被抽樣切碎；低解析點陣圖則維持像素銳利
      const isHiResTrainer = !!(tRec && tRec.loaded && (tRec.img.naturalWidth || tRec.img.width || 0) > 160);
      ctx.imageSmoothingEnabled = isHiResTrainer;
      if (isHiResTrainer) ctx.imageSmoothingQuality = "high";

      // 對齊腳底陰影中心 (tsy + 18) 並套用海中涉水下沉 14px
      ctx.translate(tsx, tsy - (tInWater ? bob * 0.45 : bob) + (tc.jumpY || 0) + (tInWater ? 14 : 0));
      if (strideTilt !== 0) ctx.rotate(strideTilt);
      ctx.scale(needFlip ? -1 : 1, strideSquashY);

      if (tRec && tRec.loaded) {
        if (tInWater) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(-28, -32, 56, 37); // 裁切至腰部 (y: -32 ~ +5)，讓雙腿完全浸入海中
          ctx.clip();
          ctx.drawImage(tRec.img, -28, -32, 56, 56);
          if (tc.whiteFlashTimer > 0) {
            this.drawSilhouetteFlash(ctx, tRec.img, -28, -32, 56, 56, "#FF6B4A", 0.70);
          }
          ctx.restore();
          drawPixelWaterlineFoam(5, 17, 1.2);
        } else {
          ctx.drawImage(tRec.img, -28, -32, 56, 56);
          if (tc.whiteFlashTimer > 0) {
            this.drawSilhouetteFlash(ctx, tRec.img, -28, -32, 56, 56, "#FF6B4A", 0.70);
          }
        }
        if (tInGrass) {
          ctx.save();
          if (needFlip) ctx.scale(-1, 1); // 保持草葉搖曳方向與世界一致
          drawPixelGrassOverlay(tc.x, tc.y, 22, [-12, 0, 12]);
          ctx.restore();
        }
      }
      ctx.restore();
    };

    const drawPartnerEntity = (pt) => {
      const psx = toSx(pt.x), psy = toSy(pt.y);
      const sprUrl = pt.facingY < 0 ? pt.data.back_sprite : pt.data.forward_sprite;
      const rec = SpriteCache.get(sprUrl);
      if (rec && rec.loaded) {
        ctx.save();
        ctx.translate(psx, psy);
        if (pt.facingX > 0) ctx.scale(-1, 1);
        ctx.drawImage(rec.img, -20, -20, 40, 40);
        ctx.restore();
      }
    };

    const drawPlayerEntity = () => {
      ctx.save();
      if (p.id === 149 || p.id >= 144) {
        if (p.multiscaleReady) {
          const crownNow = performance.now() * 0.0035;
          const isLegend = p.id >= 144 && p.id !== 149;
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(crownNow);
          ctx.strokeStyle = isLegend ? "rgba(244, 114, 182, 0.88)" : "rgba(250, 204, 21, 0.85)";
          ctx.fillStyle = isLegend ? "rgba(244, 114, 182, 0.10)" : "rgba(250, 204, 21, 0.08)";
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          for (let k = 0; k < 6; k++) {
            const a = (k * Math.PI) / 3;
            const rx = Math.cos(a) * 31, ry = Math.sin(a) * 31;
            if (k === 0) ctx.moveTo(rx, ry);
            else ctx.lineTo(rx, ry);
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = "#FEF08A";
          for (let k = 0; k < 3; k++) {
            const a = (k * Math.PI * 2) / 3;
            ctx.beginPath();
            ctx.arc(Math.cos(a) * 31, Math.sin(a) * 31, 2.5, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        } else {
          const chargePct = Math.max(0, 1 - (p.multiscaleTimer || 0) / 10.0);
          ctx.save();
          ctx.strokeStyle = "rgba(250, 204, 21, 0.45)";
          ctx.lineWidth = 2.0;
          ctx.beginPath();
          ctx.arc(px, py + 14, 24, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * chargePct, false);
          ctx.stroke();
          ctx.restore();
        }
      }

      if (p.shieldTimer > 0) {
        const shieldPct = p.shieldTimer / p.maxShieldTimer;
        ctx.strokeStyle = "rgba(245, 158, 11, 0.85)";
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(px, py, 30, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * shieldPct, false);
        ctx.stroke();
      }

      if (p.buffTimer > 0) {
        const buffPct = p.buffTimer / p.maxBuffTimer;
        ctx.strokeStyle = "rgba(245, 158, 11, 0.85)";
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(px, py + 12, 26, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * buffPct, false);
        ctx.stroke();
      }

      if (p.speedTrails && p.speedTrails.length > 0) {
        p.speedTrails.forEach(tr => {
          const tsx = toSx(tr.x), tsy = toSy(tr.y);
          const tUrl = tr.facingY < 0 ? p.data.back_sprite : p.data.forward_sprite;
          const tRec = SpriteCache.get(tUrl);
          if (tRec && tRec.loaded) {
            const alpha = Math.max(0, (tr.life / tr.maxLife) * (tr.isDash ? 0.52 : 0.38));
            ctx.save();
            ctx.translate(tsx, tsy + (inWater ? 10 : 0));
            if (tr.facingX > 0) ctx.scale(-1, 1);
            this.drawSilhouetteFlash(ctx, tRec.img, -26, -21, 52, 52, tr.isDash ? "#FDE047" : "#38BDF8", alpha);
            ctx.restore();
          }
        });
      }

      if (p.xAttackTimer > 0) {
        const auraNow = performance.now() * 0.008;
        const pulseR = 24 + Math.sin(auraNow * 2.2) * 3.5;
        ctx.save();
        const atkGrad = ctx.createRadialGradient(px, py + 4, 6, px, py + 4, pulseR + 8);
        atkGrad.addColorStop(0, "rgba(239, 68, 68, 0.0)");
        atkGrad.addColorStop(0.55, "rgba(239, 68, 68, 0.28)");
        atkGrad.addColorStop(0.85, "rgba(250, 204, 21, 0.45)");
        atkGrad.addColorStop(1, "rgba(250, 204, 21, 0.0)");
        ctx.fillStyle = atkGrad;
        ctx.beginPath();
        ctx.arc(px, py + 4, pulseR + 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "rgba(254, 240, 138, 0.85)";
        ctx.lineWidth = 2.0;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.ellipse(px, py + 16, 22, 8.5, 0, auraNow, auraNow + Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      const recScale = (p.recoilTimer > 0) ? (p.recoilTimer / 0.11) : 0;
      const lungePhase = (p.lungeTimer > 0) ? Math.sin((1 - p.lungeTimer / (p.lungeMaxTime || 0.16)) * Math.PI) : 0;
      const lungeOffsetX = Math.cos(p.lungeAngle || 0) * (p.lungeDist || 0) * lungePhase;
      const lungeOffsetY = Math.sin(p.lungeAngle || 0) * (p.lungeDist || 0) * lungePhase;

      const visOffsetX = (p.recoilX || 0) * recScale + lungeOffsetX;
      const slamProg = (p.slamHopTimer > 0) ? (1 - p.slamHopTimer / 0.24) : 0;
      const slamHopY = (p.slamHopTimer > 0) ? (slamProg < 0.55 ? -Math.sin((slamProg / 0.55) * Math.PI) * 14 : Math.sin(((slamProg - 0.55) / 0.45) * Math.PI) * 5) : 0;
      const visOffsetY = (p.recoilY || 0) * recScale + slamHopY + lungeOffsetY;

      const stretchX = 1 + lungePhase * 0.16;
      const squashY = 1 - lungePhase * 0.10;

      const pSprUrl = p.facingY < 0 ? p.data.back_sprite : p.data.forward_sprite;
      // P0 關鍵優化：使用離線預烘焙閃光圖 (SpriteCache.getShiny)，徹底移除戰鬥循環內的 ctx.filter！
      const pRec = p.isShiny ? SpriteCache.getShiny(pSprUrl) : SpriteCache.get(pSprUrl);
      if (pRec && pRec.loaded) {
        if (p.invulnTimer > 0 && !(p.dashTimer > 0) && !(p.lungeTimer > 0)) {
          const blinkCycle = Math.floor(p.invulnTimer * 24) % 2;
          ctx.globalAlpha = blinkCycle === 0 ? 0.35 : 0.95;
        }

        const isHiResPoke = ((pRec.img.naturalWidth || pRec.img.width || 0) > 160);
        ctx.imageSmoothingEnabled = isHiResPoke;
        if (isHiResPoke) ctx.imageSmoothingQuality = "high";

        const isFlyingPoke = p.data && (p.data.type1 === "Flying" || p.data.type2 === "Flying" || [92, 93, 94, 150, 151].includes(p.id));
        const submergeWater = inWater && !isFlyingPoke && !p.isJumpingLedge;
        const submergeGrass = inGrass && !isFlyingPoke && !p.isJumpingLedge;

        ctx.translate(px + visOffsetX, py + visOffsetY - (submergeWater ? pBob * 0.45 : pBob) + (p.jumpY || 0) + (submergeWater ? 11 : 0));
        ctx.scale((p.facingX > 0 ? -1 : 1) * stretchX, squashY);

        if (submergeWater) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(-26, -21, 52, 29); // 校準腳底透明留白 (+5px)，裁切至腹部吃水線 (y: -21 ~ +8)
          ctx.clip();
          ctx.drawImage(pRec.img, -26, -21, 52, 52);
          if (p.whiteFlashTimer > 0) {
            this.drawSilhouetteFlash(ctx, pRec.img, -26, -21, 52, 52, "#FFFFFF", 0.75);
          }
          ctx.restore();
          drawPixelWaterlineFoam(8, 16, 0);
        } else {
          ctx.drawImage(pRec.img, -26, -21, 52, 52);
          if (p.whiteFlashTimer > 0) {
            this.drawSilhouetteFlash(ctx, pRec.img, -26, -21, 52, 52, "#FFFFFF", 0.75);
          }
        }

        if (submergeGrass) {
          ctx.save();
          if (p.facingX > 0) ctx.scale(-1, 1);
          drawPixelGrassOverlay(p.x, p.y, 22, [-13, 0, 13]);
          ctx.restore();
        }
      }
      ctx.restore();
    };

    const drawEnemyEntity = (e) => {
      const esx = e._esx, esy = e._esy, sz = e._sz;
      const eSprUrl = e.facingY < 0 ? e.data.back_sprite : e.data.forward_sprite;
      // P0 關鍵優化：使用離線預烘焙閃光圖 (SpriteCache.getShiny)，0 ctx.filter 開銷
      const eRec = e.isShiny ? SpriteCache.getShiny(eSprUrl) : SpriteCache.get(eSprUrl);

      ctx.save();
      ctx.translate(esx, esy);
      if (e.facingX > 0) ctx.scale(-1, 1);

      if (eRec && eRec.loaded) {
        ctx.drawImage(eRec.img, -sz / 2, -sz / 2, sz, sz);
      } else {
        // 圖片重試載入期間的像素精靈球兜底繪製，徹底杜絕隱形怪
        const pr = sz * 0.26;
        ctx.fillStyle = "#EF4444";
        ctx.beginPath(); ctx.arc(0, 0, pr, Math.PI, 0); ctx.fill();
        ctx.fillStyle = "#F8FAFC";
        ctx.beginPath(); ctx.arc(0, 0, pr, 0, Math.PI); ctx.fill();
        ctx.strokeStyle = "#0F172A"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, pr, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-pr, 0); ctx.lineTo(pr, 0); ctx.stroke();
      }

      if (e.whiteFlashTimer > 0 && eRec && eRec.loaded) {
        this.drawSilhouetteFlash(ctx, eRec.img, -sz / 2, -sz / 2, sz, sz, "#FFFFFF", 0.72);
      }

      if (e.status === "Poison") {
        if (highDensityLOD && !e.isElite && !e.isBoss) {
          ctx.fillStyle = "#A855F7";
          ctx.fillRect(sz * 0.22, -sz * 0.24, 5, 5);
        } else {
          const pNow = performance.now() * 0.0045 + e.x * 0.02;
          for (let pb = 0; pb < 2; pb++) {
            const prog = ((pNow + pb * 0.5) % 1.0);
            const side = pb === 0 ? -1 : 1;
            const bx = side * (sz * 0.28) + Math.sin(prog * Math.PI * 2 + pb) * 2.5;
            const by = -sz * 0.10 - prog * (sz * 0.32);
            const br = 3.2;

            ctx.fillStyle = pb === 0 ? "#9333EA" : "#22C55E";
            ctx.strokeStyle = "#1E1B4B";
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.arc(bx, by, br, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = "#FFFFFF";
            ctx.beginPath();
            ctx.arc(bx - 1.0, by - 1.0, 1.0, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      if (e.status === "Burn") {
        if (highDensityLOD && !e.isElite && !e.isBoss) {
          ctx.fillStyle = "#F97316";
          ctx.fillRect(-sz * 0.28, -sz * 0.15, 5, 6);
        } else {
          const bNow = performance.now() * 0.010 + e.y * 0.03;
          for (let bf = -1; bf <= 1; bf += 2) {
            const fx = bf * (sz * 0.30);
            const fy = -sz * 0.02 + Math.sin(bNow + bf * 1.5) * 3.0;
            const sway = Math.cos(bNow * 1.3 + bf) * 1.5;

            ctx.save();
            ctx.translate(fx, fy);
            ctx.fillStyle = "#F97316";
            ctx.strokeStyle = "#451A03";
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(sway, -5.5);
            ctx.quadraticCurveTo(4.0, 0, 0, 3.5);
            ctx.quadraticCurveTo(-4.0, 0, sway, -5.5);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = "#FEF08A";
            ctx.beginPath();
            ctx.arc(0, 0.8, 1.8, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        }
      }

      if (e.inFrostAura && (!highDensityLOD || e.isElite || e.isBoss)) {
        const fNow = performance.now() * 0.0035 + e.x * 0.02;
        for (let fi = 0; fi < 2; fi++) {
          const prog = ((fNow + fi * 0.5) % 1.0);
          const side = fi === 0 ? -1 : 1;
          const ix = side * (sz * 0.30) + Math.cos(prog * Math.PI * 2) * 2.0;
          const iy = -sz * 0.22 + prog * (sz * 0.36);
          const s = 3.4;

          ctx.strokeStyle = "#0369A1";
          ctx.lineWidth = 2.4;
          ctx.beginPath();
          ctx.moveTo(ix - s, iy); ctx.lineTo(ix + s, iy);
          ctx.moveTo(ix, iy - s); ctx.lineTo(ix, iy + s);
          ctx.stroke();

          ctx.strokeStyle = "#E0FFFF";
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(ix - s, iy); ctx.lineTo(ix + s, iy);
          ctx.moveTo(ix, iy - s); ctx.lineTo(ix, iy + s);
          ctx.stroke();
        }
      }

      if (e.status === "Paralysis") {
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 2.0;
        const now = performance.now();
        for (let arc = 0; arc < 2; arc++) {
          ctx.beginPath();
          ctx.moveTo(-sz * 0.35, -4 + arc * 10);
          ctx.lineTo(0, -sz * 0.25 + Math.sin(now * 0.02 + arc) * 8);
          ctx.lineTo(sz * 0.35, 4 + arc * 10);
          ctx.stroke();
        }
      }

      if (e.status === "Freeze") {
        ctx.save();
        ctx.fillStyle = "rgba(56, 189, 248, 0.35)";
        ctx.strokeStyle = "#E0F2FE";
        ctx.lineWidth = 2.4;
        const r = sz * 0.48;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i * Math.PI) / 3 - Math.PI / 6;
          const ix = Math.cos(a) * r;
          const iy = Math.sin(a) * r;
          if (i === 0) ctx.moveTo(ix, iy);
          else ctx.lineTo(ix, iy);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(-r * 0.45, -r * 0.65);
        ctx.lineTo(r * 0.45, r * 0.65);
        ctx.stroke();
        ctx.restore();
      }

      if (e.status === "Confusion") {
        ctx.save();
        const rot = performance.now() * 0.006;
        for (let c = 0; c < 2; c++) {
          const cAng = rot + c * Math.PI;
          const sx = Math.cos(cAng) * (sz * 0.42);
          const sy = Math.sin(cAng) * (sz * 0.22) - sz * 0.45;
          ctx.fillStyle = "#FACC15";
          ctx.beginPath();
          ctx.arc(sx, sy, 3.2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      ctx.restore();

      const rangedMobSet = [23, 24, 35, 41, 42, 48, 60, 69, 70, 81, 109, 110, 116, 117, 120];
      if (!e.treasureType && !e.isBoss && rangedMobSet.includes(e.id) && e.rangedCd !== undefined && e.rangedCd > 0 && e.rangedCd <= 0.35) {
        const chargeProgress = 1 - (e.rangedCd / 0.35);
        const glowR = 2.5 + chargeProgress * 3.5;
        const targetAng = Math.atan2(p.y - e.y, p.x - e.x);
        const muzzleX = esx + Math.cos(targetAng) * (sz * 0.32);
        const muzzleY = esy + Math.sin(targetAng) * (sz * 0.32) - 4;

        ctx.save();
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(muzzleX, muzzleY, glowR, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = [69, 70].includes(e.id) ? "#4ADE80" : ([60, 116, 117].includes(e.id) ? "#38BDF8" : "#C084FC");
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(muzzleX, muzzleY, glowR * 1.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      if (e.hp < e.maxHp || e.isElite || e.treasureType) {
        const bw = e.isBoss ? 72 : (e.isElite ? 50 : 44);
        const bh = e.isBoss ? 6 : (e.isElite ? 6.0 : 5.5);
        const barX = esx - bw / 2;
        const barY = esy - sz / 2 - 10;
        const hpRatio = Math.max(0, e.hp / e.maxHp);

        ctx.save();
        ctx.fillStyle = "rgba(0, 0, 0, 0.72)";
        ctx.strokeStyle = (e.isElite && !e.isBoss) ? "#FACC15" : "rgba(15, 23, 42, 0.85)";
        ctx.lineWidth = (e.isElite && !e.isBoss) ? 1.4 : 1.0;
        ctx.fillRect(barX, barY, bw, bh);
        if (e.isElite || e.isBoss || this.enemies.length <= 100) {
          ctx.strokeRect(barX, barY, bw, bh);
        }

        let barColor = "#FF5252";
        if (e.treasureType) {
          barColor = "#FACC15";
        } else if (hpRatio <= 0.25) {
          const pulse = 0.75 + Math.sin(performance.now() * 0.015) * 0.25;
          ctx.globalAlpha = pulse;
          barColor = "#FF2E2E";
        } else if (e.isElite && !e.isBoss) {
          barColor = "#FF6B4A";
        }

        ctx.fillStyle = barColor;
        ctx.fillRect(barX + 0.5, barY + 0.5, (bw - 1) * hpRatio, bh - 1);

        if (e.isElite && !e.isBoss) {
          const cx = barX - 8;
          const cy = barY + bh / 2;
          ctx.globalAlpha = 1.0;
          ctx.fillStyle = "#FACC15";
          ctx.strokeStyle = "#78350F";
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(cx - 5, cy + 3.5);
          ctx.lineTo(cx - 5.5, cy - 3.5);
          ctx.lineTo(cx - 2, cy - 0.5);
          ctx.lineTo(cx, cy - 4.5);
          ctx.lineTo(cx + 2, cy - 0.5);
          ctx.lineTo(cx + 5.5, cy - 3.5);
          ctx.lineTo(cx + 5, cy + 3.5);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = "#EF4444";
          ctx.beginPath();
          ctx.arc(cx, cy + 1, 1.3, 0, Math.PI * 2);
          ctx.fill();
        }

        if (e.weakenTimer && e.weakenTimer > 0) {
          const wx = barX + bw + 6;
          const wy = barY + bh / 2;
          ctx.globalAlpha = 1.0;
          ctx.fillStyle = "#F472B6";
          ctx.strokeStyle = "#831843";
          ctx.lineWidth = 1.1;
          ctx.beginPath();
          ctx.moveTo(wx - 3.5, wy - 3);
          ctx.lineTo(wx + 3.5, wy - 3);
          ctx.lineTo(wx, wy + 3.5);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
        ctx.restore();
      }
    };

    // 依 Y-Sorting 順序統一繪製所有角色與怪獸
    for (let q = 0; q < renderQueue.length; q++) {
      const item = renderQueue[q];
      if (item.kind === "enemy") drawEnemyEntity(item.e);
      else if (item.kind === "player") drawPlayerEntity();
      else if (item.kind === "trainer") drawTrainerEntity();
      else if (item.kind === "partner") drawPartnerEntity(item.pt);
    }

    // 4. P1 關鍵升級：繪製 GBA 2.5D 樹冠與屋頂前景遮罩層（當角色走到樹冠或屋簷北側時自動呈半透明遮擋）
    if (typeof MapEngine.renderForegroundCanopies === "function") {
      MapEngine.renderForegroundCanopies(ctx, camX, camY, this.width, this.height, this.player, this.trainerCompanion);
    }

    ctx.save();
    SkillsEngine.renderAerialLayer(ctx, toSx, toSy);

    // 繪製敵方動態飛行道具 (依據 pVfx 繪製專屬幾何像素圖形)
    this.enemyProjectiles.forEach(ep => {
      const esx = toSx(ep.x), esy = toSy(ep.y);
      if (esx < -24 || esx > this.width + 24 || esy < -24 || esy > this.height + 24) return;

      ctx.save();
      ctx.translate(esx, esy);
      const r = ep.radius;

      if (ep.vfx === "swift_star") {
        // 旋轉金黃星芒
        ctx.rotate(ep.rot * 2);
        ctx.fillStyle = ep.color;
        ctx.strokeStyle = "#0F172A";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        for (let s = 0; s < 5; s++) {
          const a1 = (s * Math.PI * 2) / 5 - Math.PI / 2;
          const a2 = a1 + Math.PI / 5;
          if (s === 0) ctx.moveTo(Math.cos(a1) * (r * 1.25), Math.sin(a1) * (r * 1.25));
          else ctx.lineTo(Math.cos(a1) * (r * 1.25), Math.sin(a1) * (r * 1.25));
          ctx.lineTo(Math.cos(a2) * (r * 0.55), Math.sin(a2) * (r * 0.55));
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2);
        ctx.fill();
      } else if (ep.vfx === "leaf_bullet") {
        // 旋轉翠綠飛葉
        ctx.rotate(ep.angle || ep.rot);
        ctx.fillStyle = ep.color;
        ctx.strokeStyle = "#0F172A";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 1.4, r * 0.65, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = "#86EFAC";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(-r * 1.1, 0); ctx.lineTo(r * 1.1, 0);
        ctx.stroke();
      } else if (ep.vfx === "wind_bullet") {
        // 月牙風刃
        ctx.rotate(ep.angle || ep.rot);
        ctx.fillStyle = ep.color;
        ctx.strokeStyle = "#0F172A";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(0, 0, r * 1.2, -1.2, 1.2);
        ctx.arc(r * 0.5, 0, r * 0.9, 1.2, -1.2, true);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (ep.vfx === "water_drop") {
        // 水滴彈頭
        ctx.rotate(ep.angle || ep.rot);
        ctx.fillStyle = ep.color;
        ctx.strokeStyle = "#0F172A";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(r * 1.3, 0);
        ctx.lineTo(-r * 0.8, -r * 0.7);
        ctx.lineTo(-r * 0.4, 0);
        ctx.lineTo(-r * 0.8, r * 0.7);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2);
        ctx.fill();
      } else if (ep.vfx === "frost_lance") {
        // 急凍鳥：高速三叉尖銳冰錐
        ctx.rotate(ep.angle);
        ctx.fillStyle = "#38BDF8";
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(r * 1.6, 0); ctx.lineTo(-r * 0.8, -r * 0.6); ctx.lineTo(-r * 0.3, 0); ctx.lineTo(-r * 0.8, r * 0.6);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
      } else if (ep.vfx === "storm_orb") {
        // 閃電鳥：旋轉追蹤電磁核
        ctx.rotate(ep.rot * 3);
        ctx.fillStyle = "#FACC15";
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#FFFFFF"; ctx.lineWidth = 2.2; ctx.stroke();
        ctx.strokeStyle = "#FEF08A"; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(0, 0, r * 0.6, 0, Math.PI * 2); ctx.stroke();
      } else if (ep.vfx === "fire_blast_orb") {
        // 火焰鳥：大字炎巨彈
        ctx.rotate(ep.rot * 2);
        ctx.fillStyle = "#EF4444";
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#FDE047";
        ctx.beginPath(); ctx.arc(0, 0, r * 0.6, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#7F1D1D"; ctx.lineWidth = 1.8; ctx.stroke();
      } else if (ep.vfx === "fire_spark") {
        // 大字炎分裂小火星
        ctx.rotate(ep.rot * 4);
        ctx.fillStyle = "#F97316";
        ctx.fillRect(-r * 0.6, -r * 0.6, r * 1.2, r * 1.2);
        ctx.fillStyle = "#FEF08A";
        ctx.beginPath(); ctx.arc(0, 0, r * 0.4, 0, Math.PI * 2); ctx.fill();
      } else if (ep.vfx === "psychic_core") {
        // 超夢：暗影引力黑核
        ctx.rotate(-ep.rot);
        ctx.fillStyle = "#581C87";
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#C084FC"; ctx.lineWidth = 3.0; ctx.stroke();
        ctx.fillStyle = "#F3E8FF";
        ctx.beginPath(); ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2); ctx.fill();
      } else if (ep.vfx === "rainbow_star") {
        // 夢幻：五色彩虹星芒
        ctx.rotate(ep.rot * 4);
        ctx.fillStyle = ep.color || "#EC4899";
        ctx.fillRect(-r * 0.6, -r * 0.6, r * 1.2, r * 1.2);
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath(); ctx.arc(0, 0, r * 0.4, 0, Math.PI * 2); ctx.fill();
      } else if (ep.vfx === "psy_wave") {
        // 超能精神衝擊波：旋轉雙層同心光環
        ctx.rotate(ep.rot * 3);
        ctx.strokeStyle = ep.color || "#C084FC";
        ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2); ctx.stroke();
      } else {
        // 毒氣/能量球：外溢光環與白色高光核心
        ctx.rotate(ep.rot);
        ctx.fillStyle = ep.color;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#0F172A";
        ctx.lineWidth = 1.6;
        ctx.stroke();
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(r * 0.2, -r * 0.2, r * 0.35, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    });

    this.particles.forEach(pt => {
      const sx = toSx(pt.x), sy = toSy(pt.y);
      ctx.save();
      ctx.globalAlpha = Math.max(0, pt.life / (pt.maxLife || 0.4));
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(sx, sy, pt.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
    ctx.restore();

    MapEngine.renderWeatherOverlays(ctx, this.width, this.height);
    if (this.state === "EVOLVING") {
      this.renderEvolutionOverlay(ctx, toSx, toSy);
    }

    this.floatingTexts.forEach(ft => {
      const sx = toSx(ft.x), sy = toSy(ft.y);
      ctx.save();
      ctx.font = `900 ${ft.size}px 'Noto Sans TC', sans-serif`;
      ctx.textAlign = "center";
      ctx.strokeStyle = "#0F172A";
      ctx.lineWidth = 3.5;
      ctx.strokeText(ft.text, sx, sy);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, sx, sy);
      ctx.restore();
    });

    const edgePad = 32;
    this.enemies.forEach(e => {
      if (!e.treasureType && !e.isBoss && !e.isElite) return;
      const esx = toSx(e.x), esy = toSy(e.y);

      if (esx < 0 || esx > this.width || esy < 0 || esy > this.height) {
        const dx = e.x - this.player.x;
        const dy = e.y - this.player.y;
        const ang = Math.atan2(dy, dx);
        const distMeters = Math.round(Math.hypot(dx, dy) / 10);

        const arrowX = Math.max(edgePad, Math.min(this.width - edgePad, this.width / 2 + Math.cos(ang) * (this.width / 2 - edgePad)));
        const arrowY = Math.max(edgePad, Math.min(this.height - edgePad, this.height / 2 + Math.sin(ang) * (this.height / 2 - edgePad)));

        const isMeowth = e.treasureType === "meowth";
        const isChansey = e.treasureType === "chansey";
        const isOnlyElite = e.isElite && !e.isBoss && !e.treasureType;
        const arrowColor = isMeowth ? "#F59E0B" : (isChansey ? "#EC4899" : (isOnlyElite ? "#FB7185" : "#EF4444"));

        ctx.save();
        ctx.translate(arrowX, arrowY);

        ctx.fillStyle = arrowColor;
        ctx.strokeStyle = "#0F172A";
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.arc(0, 0, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.rotate(ang);
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.moveTo(11, 0); ctx.lineTo(-4, -6.5); ctx.lineTo(-4, 6.5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.font = "900 10px 'Noto Sans TC', sans-serif";
        ctx.textAlign = "center";
        ctx.fillStyle = "#FFFFFF";
        ctx.strokeStyle = "#0F172A";
        ctx.lineWidth = 2.5;
        ctx.strokeText(`${distMeters}m`, arrowX, arrowY + 25);
        ctx.fillText(`${distMeters}m`, arrowX, arrowY + 25);
        ctx.restore();
      }
    });

    this.mapItems.forEach(it => {
      const esx = toSx(it.x), esy = toSy(it.y);
      if (esx < 0 || esx > this.width || esy < 0 || esy > this.height) {
        const isMart = it.id === "poke_mart";
        const isMagnet = it.id === "magnet";
        if (!isMart && !isMagnet) return;

        const dx = it.x - this.player.x;
        const dy = it.y - this.player.y;
        const ang = Math.atan2(dy, dx);
        const distMeters = Math.round(Math.hypot(dx, dy) / 10);

        const arrowX = Math.max(edgePad, Math.min(this.width - edgePad, this.width / 2 + Math.cos(ang) * (this.width / 2 - edgePad)));
        const arrowY = Math.max(edgePad, Math.min(this.height - edgePad, this.height / 2 + Math.sin(ang) * (this.height / 2 - edgePad)));

        const arrowColor = isMart ? "#38BDF8" : "#FACC15";
        const labelText = isMart ? `商店 ${distMeters}m` : `磁鐵 ${distMeters}m`;

        ctx.save();
        ctx.translate(arrowX, arrowY);
        ctx.fillStyle = arrowColor;
        ctx.strokeStyle = "#0F172A";
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.arc(0, 0, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.rotate(ang);
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.moveTo(10, 0); ctx.lineTo(-3, -5.5); ctx.lineTo(-3, 5.5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.font = "900 10px 'Noto Sans TC', sans-serif";
        ctx.textAlign = "center";
        ctx.fillStyle = arrowColor;
        ctx.strokeStyle = "#0F172A";
        ctx.lineWidth = 2.5;
        ctx.strokeText(labelText, arrowX, arrowY + 25);
        ctx.fillText(labelText, arrowX, arrowY + 25);
        ctx.restore();
      }
    });
  },

  refreshHUD() {
    const p = this.player;
    if (!p) return;
    const tr = this.selectedTrainer;

    // 1. 頭像與屬性標籤：僅在寶可夢 ID 或訓練家變更時更新 DOM 與圖片 src
    const identityKey = `${p.id}_${p.isTrainerBond ? 1 : 0}_${tr.id}`;
    if (this._lastHudIdentityKey !== identityKey) {
      this._lastHudIdentityKey = identityKey;
      document.getElementById("hudAvatar").src = SpriteCache.resolveUrl(p.data.forward_sprite);
      document.getElementById("hudPartnerName").textContent = p.data.name_zh;
      const tb = document.getElementById("hudTypeBadges");
      if (tb && typeof renderTypeBadgeHTML === "function") {
        tb.innerHTML = `${renderTypeBadgeHTML(p.data.type1)}${renderTypeBadgeHTML(p.data.type2)}`;
      }
      document.getElementById("hudAshBondBadge").classList.toggle("hidden", !p.isTrainerBond);
      document.getElementById("hudActiveTrainerImg").src = SpriteCache.resolveUrl(tr.sprite);
      document.getElementById("hudActiveSkillName").textContent = tr.skillName;
    }

    document.getElementById("hudLevelText").textContent = `Lv.${p.level}`;
    const traitBadgeEl = document.getElementById("hudTraitBadge");
    if (traitBadgeEl) {
      if (p.innateTrait) {
        const hasCrownShield = (p.id === 149 || p.id >= 144);
        const shieldHtml = hasCrownShield
          ? (p.multiscaleReady
              ? `<span class="text-emerald-300 ml-0.5">[🛡️就緒]</span>`
              : `<span class="text-slate-400 ml-0.5">[${Math.ceil(p.multiscaleTimer || 0)}s]</span>`)
          : '';
        const nextBadgeKey = `${p.innateTrait.id}_${p.innateTrait.tier}_${hasCrownShield ? (p.multiscaleReady ? 'R' : Math.ceil(p.multiscaleTimer || 0)) : ''}`;
        if (this._lastTraitBadgeKey !== nextBadgeKey) {
          this._lastTraitBadgeKey = nextBadgeKey;
          traitBadgeEl.innerHTML = `<i class="fa-solid ${p.innateTrait.icon} text-[8px]"></i><span>${p.innateTrait.name}</span>${shieldHtml}`;
          traitBadgeEl.classList.remove("hidden");
        }
      } else {
        traitBadgeEl.classList.add("hidden");
      }
    }

    // 2. 血條與經驗條（僅在血量區間變化時切換漸層背景）
    const hpPct = Math.max(0, (p.hp / p.maxHp) * 100);
    const hpBarEl = document.getElementById("hudHpBar");
    hpBarEl.style.width = `${hpPct}%`;
    const hpTier = hpPct > 50 ? "high" : (hpPct > 22 ? "mid" : "low");
    if (this._lastHudHpTier !== hpTier) {
      this._lastHudHpTier = hpTier;
      if (hpTier === "high") {
        hpBarEl.style.background = "linear-gradient(90deg, #2EE66B 0%, #1CB34E 100%)";
      } else if (hpTier === "mid") {
        hpBarEl.style.background = "linear-gradient(90deg, #F5B041 0%, #D68910 100%)";
      } else {
        hpBarEl.style.background = "linear-gradient(90deg, #FF5252 0%, #E74C3C 100%)";
      }
    }
    document.getElementById("hudHpText").textContent = `${Math.ceil(p.hp)}/${p.maxHp}`;
    document.getElementById("hudExpBar").style.width = `${Math.min(100, (p.exp / p.nextExp) * 100)}%`;

    const mins = String(Math.floor(this.runTime / 60)).padStart(2, "0");
    const secs = String(Math.floor(this.runTime % 60)).padStart(2, "0");
    document.getElementById("hudTimer").textContent = `${mins}:${secs}`;
    document.getElementById("hudKills").textContent = this.kills;
    document.getElementById("hudCoins").textContent = this.runCoins;

    const fpsVal = this.currentFps || 60;
    const mobCount = this.enemies ? this.enemies.length : 0;
    if (this.showFpsHud) {
      const fpsBadge = document.getElementById("hudFpsBadge");
      if (fpsBadge) {
        fpsBadge.textContent = `${fpsVal} FPS · ${mobCount}怪`;
        fpsBadge.className = `absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap px-1.5 py-0.2 rounded-full bg-slate-950/90 border font-pixel text-[7px] sm:text-[8px] shadow pointer-events-none ${fpsVal >= 50 ? 'border-emerald-500/70 text-emerald-400' : (fpsVal >= 35 ? 'border-amber-500/70 text-amber-300' : 'border-rose-500/80 text-rose-400')}`;
      }
    }
    const debugStatsEl = document.getElementById("debugLiveStatsText");
    if (debugStatsEl && !document.getElementById("debugDropdown").classList.contains("hidden")) {
      const projCount = (SkillsEngine.projectiles ? SkillsEngine.projectiles.length : 0) + (this.enemyProjectiles ? this.enemyProjectiles.length : 0);
      debugStatsEl.textContent = `${fpsVal} FPS | ${mobCount}怪 | ${projCount}彈`;
      debugStatsEl.className = `font-pixel text-[9px] ${fpsVal >= 50 ? 'text-emerald-400' : (fpsVal >= 35 ? 'text-amber-300' : 'text-rose-400')}`;
    }

    // 3. 雙打夥伴列表：僅在夥伴數量、ID 或等級變化時重建 innerHTML
    const partnerKey = this.partners.map(pt => `${pt.id}:${pt.level}`).join(",");
    if (this._lastHudPartnerKey !== partnerKey) {
      this._lastHudPartnerKey = partnerKey;
      const partnerBox = document.getElementById("hudPartnerList");
      if (partnerBox) {
        partnerBox.innerHTML = this.partners.map(pt => `
          <div class="flex items-center gap-1 bg-slate-900/85 text-white px-2 py-0.5 rounded-full border border-pink-500 shadow-md">
            <img src="${pt.data.forward_sprite}" class="w-5 h-5 pixel-sprite object-contain"/>
            <span class="font-black text-[10px] text-pink-300">${pt.data.name_zh}</span>
            <span class="font-pixel text-[9px] text-amber-300">Lv.${pt.level}</span>
          </div>
        `).join("");
      }
    }

    // 4. 攜帶道具與技能膠囊：僅在道具或技能狀態變更時重建 innerHTML
    const heldKey = Object.keys(p.heldItems || {}).join(",");
    if (this._lastHudHeldKey !== heldKey) {
      this._lastHudHeldKey = heldKey;
      const heldBox = document.getElementById("hudHeldItemList");
      if (heldBox) {
        heldBox.innerHTML = Object.keys(p.heldItems || {}).map(itemId => {
          const itemMeta = HELD_ITEMS[itemId];
          return itemMeta ? `
            <div class="w-6 h-6 bg-slate-900/80 rounded-lg border border-amber-400/80 flex items-center justify-center p-0.5 shadow" title="${itemMeta.name}">
              <img src="${itemMeta.sprite}" class="w-4 h-4 pixel-sprite object-contain"/>
            </div>
          ` : '';
        }).join("");
      }
    }

    const skillKey = Object.values(p.skills).map(sk => `${sk.id}:${sk.level}:${sk.evolved ? 1 : 0}`).join(",");
    if (this._lastHudSkillKey !== skillKey) {
      this._lastHudSkillKey = skillKey;
      document.getElementById("hudSkillList").innerHTML = Object.values(p.skills).map(sk => {
        const meta = SKILLS_CATALOG[sk.id];
        if (!meta) return "";
        if (sk.evolved) {
          return `<span style="background: linear-gradient(135deg, #4A3510 0%, #2A1C05 100%); border: 1.5px solid #FFD700; color: #FFD700; box-shadow: 0 0 10px rgba(255, 215, 0, 0.38);" class="px-2.5 py-0.5 rounded-full text-[9px] font-black flex items-center gap-1 backdrop-blur-sm"><img src="${meta.sprite}" class="w-3.5 h-3.5 pixel-sprite"/><span>${meta.evolvedName}</span><span class="text-amber-200 font-pixel text-[8px]">L${sk.level}</span></span>`;
        }
        const borderCol = TYPE_COLORS[meta.type] || "#3A8FB7";
        return `<span style="background: rgba(20, 28, 40, 0.86); border: 1.5px solid ${borderCol}; color: #FFFFFF;" class="px-2.5 py-0.5 rounded-full text-[9px] font-black flex items-center gap-1 shadow-md backdrop-blur-sm"><img src="${meta.sprite}" class="w-3.5 h-3.5 pixel-sprite"/><span>${meta.name}</span><span style="color: #63E2FF;" class="font-pixel text-[8px]">L${sk.level}</span></span>`;
      }).join("");
    }

    const btnEl = document.getElementById("btnTrainerActiveSkill");
    const cdOverlay = document.getElementById("trainerSkillCdOverlay");
    const cdText = document.getElementById("trainerSkillCdText");
    const cdSub = document.getElementById("trainerSkillStatusSub");

    if (p.buffTimer > 0 || p.shieldTimer > 0) {
      btnEl.className = "tactical-btn-active relative w-18 h-18 sm:w-20 sm:h-20 rounded-full bg-emerald-500 border-3 border-emerald-400 flex flex-col items-center justify-center overflow-hidden shadow-xl";
      cdOverlay.classList.remove("hidden");
      cdOverlay.className = "absolute inset-0 bg-emerald-950/70 flex flex-col items-center justify-center text-white";
      const remain = Math.ceil(p.buffTimer || p.shieldTimer);
      cdText.textContent = `${remain}s`;
      cdText.className = "font-pixel text-xs text-emerald-300";
      cdSub.textContent = "生效中";
    } else if (p.trainerSkillCd > 0) {
      btnEl.className = "relative w-18 h-18 sm:w-20 sm:h-20 rounded-full bg-slate-800 border-3 border-slate-700 flex flex-col items-center justify-center overflow-hidden opacity-90 shadow-xl";
      cdOverlay.classList.remove("hidden");
      cdOverlay.className = "absolute inset-0 bg-slate-950/85 flex flex-col items-center justify-center text-white";
      cdText.textContent = `${Math.ceil(p.trainerSkillCd)}s`;
      cdText.className = "font-pixel text-xs text-amber-300";
      cdSub.textContent = "冷卻中";
    } else {
      btnEl.className = "tactical-btn-ready relative w-18 h-18 sm:w-20 sm:h-20 rounded-full bg-gradient-to-b from-amber-300 via-amber-400 to-orange-500 border-3 border-slate-900 flex flex-col items-center justify-center overflow-hidden active:scale-90 transition-transform shadow-xl";
      cdOverlay.classList.add("hidden");
    }

    if (this.activeBoss && this.activeBoss.hp > 0) {
      document.getElementById("bossHudName").textContent = `${this.activeBoss.data.name_zh} (#${this.activeBoss.id})`;
      document.getElementById("bossHudHpText").textContent = `${Math.max(0, Math.ceil(this.activeBoss.hp))}/${this.activeBoss.maxHp}`;
      document.getElementById("bossHudBar").style.width = `${Math.max(0, (this.activeBoss.hp / this.activeBoss.maxHp) * 100)}%`;
    }
  },

  toggleAimMode() {
    this.manualAimMode = !this.manualAimMode;
    const iconEl = document.getElementById("hudAimIcon");
    const textEl = document.getElementById("hudAimText");
    if (iconEl) {
      iconEl.className = this.manualAimMode
        ? "fa-solid fa-compass text-sky-400 text-xs"
        : "fa-solid fa-crosshairs text-emerald-400 text-xs";
    }
    if (textEl) {
      textEl.textContent = this.manualAimMode ? "朝向" : "自動";
    }
    if (this.player) {
      this.spawnFloatingText(
        this.player.x,
        this.player.y - 28,
        this.manualAimMode ? "🧭 瞄準切換：移動朝向突圍" : "🎯 瞄準切換：自動智能索敵",
        this.manualAimMode ? "#38BDF8" : "#34D399",
        13
      );
    }
    SoundFX.play("hit");
  },

  toggleTimeScale() {
    this.timeScale = this.timeScale === 1 ? 2 : 1;
    document.getElementById("speedToggleText").textContent = `${this.timeScale}x`;
  },

  togglePause() {
    const endEl = document.getElementById("endModal");
    if (this.state === "PLAYING") {
      this.state = "PAUSED";
      document.getElementById("endModalTitle").textContent = "GAME PAUSED";
      document.getElementById("endModalSubtitle").textContent = "冒險暫停中，隨時可返回挑戰！";
      document.getElementById("btnResumeGame").classList.remove("hidden");
      if (this.populateEndModalStats) this.populateEndModalStats();
      if (endEl) {
        endEl.classList.remove("hidden");
        endEl.style.display = "flex";
      }
    } else if (this.state === "PAUSED") {
      if (endEl) {
        endEl.classList.add("hidden");
        endEl.style.display = "none";
      }
      this.state = "PLAYING";
    }
  },

  triggerGameOver(isVictory) {
    this.state = "GAMEOVER";
    SoundFX.startBgm("lobby");
    if (this.isEndlessMode && this.saveData && this.saveData.stats) {
      this.saveData.stats.bestEndlessTime = Math.max(this.saveData.stats.bestEndlessTime || 0, Math.floor(this.runTime));
      this.saveData.stats.bestEndlessKills = Math.max(this.saveData.stats.bestEndlessKills || 0, this.kills);
    }
    if (this.saveToStorage) this.saveToStorage();
    document.getElementById("endModalTitle").textContent = isVictory ? "VICTORY! 關都冠軍!" : "BATTLE FINISHED";
    document.getElementById("endModalSubtitle").textContent = isVictory
      ? "恭喜通過 8 分鐘極速關都傳說考驗！"
      : "前往寶可夢中心強化能力後再次挑戰！";
    document.getElementById("btnResumeGame").classList.add("hidden");
    if (this.populateEndModalStats) this.populateEndModalStats();
    const endEl = document.getElementById("endModal");
    if (endEl) {
      endEl.classList.remove("hidden");
      endEl.style.display = "flex";
    }
  }
};

window.addEventListener("DOMContentLoaded", () => GameApp.init());