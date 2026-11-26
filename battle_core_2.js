/**
 * ============================================================================
 * battle_core_2.js (Part 1 / 2)
 * 8分鐘快節奏戰鬥引擎核心、動態虛擬搖桿、三態戰術大招、腳底環形倒數規、
 * 涉水下沉水花、草地碎葉反饋、怪獸體重抗性、Boss 多重招式輪換與 60FPS 遊戲主循環
 * ============================================================================
 */

window.GameApp = {
  APP_VERSION: "v7.6.2",
  canvas: null,
  ctx: null,
  width: window.innerWidth,
  height: window.innerHeight,
  state: "LOADING",
  timeScale: 1,

  // 天氣測試鎖定開關、Boss 專屬天候鎖、瞄準模式、壓力測試與 FPS 監控
  debugWeatherLock: false,
  bossWeatherLock: false,
  bossDeathAnims: [],
  victoryCeremony: null,
  pendingMewTimer: 0,
  manualAimMode: false,
  currentFps: 60,
  showFpsHud: false,
  debugToolsUnlocked: false,
  debugGodMode: false,
  debugStopSpawn: false,
  debugMobCap: 0,

  // 存檔基礎骨架 (詳細資料結構由 game_ui.js 接管同步)
  saveData: {
    coins: 800,
    unlockedPokemon: { 1: true, 4: true, 7: true, 10: true, 16: true, 25: true },
    unlockedTrainers: { ash: true, misty: true, brock: true },
    upgrades: { atk: 0, cd: 0, hp: 0, shiny: 0, megaRing: 0, fourthSlot: 0, rerollCount: 0, trainerCd: 0, partner: 0, greed: 0 },
    pokemonStars: {},
    stats: { totalKills: 0, evolutions: 0, superMoves: 0, birdsDefeated: 0, mewtwoDefeated: 0, mewDefeated: 0, gemsCollected: 0 },
    pokedexSeen: { 1: true, 4: true, 7: true, 10: true, 16: true, 25: true, 133: true },
    pokedexCaught: { 1: true, 4: true, 7: true, 10: true, 16: true, 25: true },
    pokedexRewardClaimed: {},
    shinyUnlocked: { 25: true },
    megaUnlocked: {},
    selectedCostumes: { ash: "classic", lillie: "alola_powered", serena: "kalos_short" },
    unlockedCostumes: { ash: { classic: true, cutin_tactical: true }, lillie: { alola_powered: true, classic_hat: true }, serena: { kalos_short: true, kalos_long: true } },
    claimedAch: {},
    bestRatings: {},
    lastSeenVersion: "",
    settings: {
      mobCapProfile: "auto",
      screenFilter: "none",
      dmgTextMode: "crit_only",
      procNoticeMode: "icon",
      screenShake: "normal",
      fourthSlotPoolMode: "affinity",
      skillAlpha: "85"
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
  iconPopups: [],
  gems: [],
  mapItems: [],
  lavaFootprints: [],
  activeBoss: null,
  telegraphs: [],
  enemyProjectiles: [],
  enemyExplosions: [],
  enemyDashes: [],

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
    window.addEventListener("orientationchange", () => {
      setTimeout(() => this.resize(), 120);
      setTimeout(() => this.resize(), 360);
    });
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", () => this.resize());
    }
    this.bindInputs();
    this.bindTouchJoystick();
    this.initDevToolsGuard();

    const svEl = document.getElementById("splashVersionBadge");
    if (svEl) svEl.textContent = this.APP_VERSION;
    const setvEl = document.getElementById("settingsVersionBadge");
    if (setvEl) setvEl.textContent = this.APP_VERSION;
    if (this.updateTitleUI) this.updateTitleUI();
    this.lastFrameTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
    if (this.runAssetPreloader) this.runAssetPreloader();
  },

  dpr: 1,

  resize() {
    const vv = window.visualViewport;
    this.width = vv ? Math.round(vv.width) : window.innerWidth;
    this.height = vv ? Math.round(vv.height) : window.innerHeight;
    if (this.height > 0) {
      document.documentElement.style.setProperty("--app-h", `${this.height}px`);
    }
    const maxDpr = this.isMobileDevice() ? 1.35 : 2.0;
    const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    this.dpr = dpr;
    this._pauseFrameRendered = false;
    const targetW = Math.max(1, Math.round(this.width * dpr));
    const targetH = Math.max(1, Math.round(this.height * dpr));
    // 僅在實際像素尺寸變更時才重配 Canvas 顯存，徹底避免第二局 iOS Safari 黑屏
    if (this.canvas.width !== targetW || this.canvas.height !== targetH) {
      this.canvas.width = targetW;
      this.canvas.height = targetH;
      this.canvas.style.width = `${this.width}px`;
      this.canvas.style.height = `${this.height}px`;
    }
    if (this.ctx) {
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.ctx.globalAlpha = 1.0;
      this.ctx.globalCompositeOperation = "source-over";
      this.ctx.filter = "none";
      this.ctx.imageSmoothingEnabled = false;
      this.ctx.webkitImageSmoothingEnabled = false;
    }

    // 手機橫拿友善保護：偵測觸控手機意外轉橫 (寬>高 且 高度<=500px) 時自動暫停戰鬥，轉回直向即自動繼續
    const isCoarsePointer = !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
    const isMobileLandscape = isCoarsePointer && this.width > this.height && this.height <= 500;
    if (isMobileLandscape) {
      if (this.state === "PLAYING") {
        this.state = "PAUSED";
        this._pausedByLandscape = true;
        if (this.touchJoy) {
          this.touchJoy.active = false;
          this.touchJoy.dx = 0;
          this.touchJoy.dy = 0;
        }
      }
    } else if (this._pausedByLandscape) {
      this._pausedByLandscape = false;
      if (this.state === "PAUSED") {
        this.state = "PLAYING";
        this.lastFrameTime = performance.now();
      }
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
      if (k === "m" && this.state === "PLAYING") {
        e.preventDefault();
        this.triggerManualMegaEvolution();
      }
      if ((e.key === "Shift" || e.code === "ShiftLeft" || e.code === "ShiftRight") && this.state === "PLAYING" && this.isArenaMode) {
        e.preventDefault();
        this.triggerArenaDash();
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
    const megaBtn = document.getElementById("btnManualMegaSkill");
    const dashBtn = document.getElementById("btnArenaDashSkill");

    const martPrompt = document.getElementById("hudEnterMartPrompt");
    const onTouchStart = (e) => {
      if (this.state !== "PLAYING") return;
      SoundFX.init();

      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        // 1. 精準排除所有按鈕元件與頂部 HUD 條
        if (t.target && t.target.closest && t.target.closest("button")) continue;
        if (t.clientY < 76) continue;

        // 2. 僅保留右下角大招、MEGA 與商店按鈕各自 12px 防誤觸外框，其餘全屏空白處（含大招正上方）皆可自由喚出搖桿
        if (skillBtn) {
          const rect = skillBtn.getBoundingClientRect();
          if (t.clientX >= rect.left - 12 && t.clientX <= rect.right + 12 &&
              t.clientY >= rect.top - 12 && t.clientY <= rect.bottom + 12) {
            continue;
          }
        }
        if (megaBtn && megaBtn.offsetParent !== null) {
          const mRect = megaBtn.getBoundingClientRect();
          if (t.clientX >= mRect.left - 12 && t.clientX <= mRect.right + 12 &&
              t.clientY >= mRect.top - 12 && t.clientY <= mRect.bottom + 12) {
            continue;
          }
        }
        if (dashBtn && dashBtn.offsetParent !== null) {
          const dRect = dashBtn.getBoundingClientRect();
          if (t.clientX >= dRect.left - 12 && t.clientX <= dRect.right + 12 &&
              t.clientY >= dRect.top - 12 && t.clientY <= dRect.bottom + 12) {
            continue;
          }
        }
        if (martPrompt && martPrompt.offsetParent !== null) {
          const pRect = martPrompt.getBoundingClientRect();
          if (t.clientX >= pRect.left - 10 && t.clientX <= pRect.right + 10 &&
              t.clientY >= pRect.top - 10 && t.clientY <= pRect.bottom + 10) {
            continue;
          }
        }

        if (!this.touchJoy.active) {
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

    // 解決移動中無法點擊大招與手動 Mega：綁定原生 touchstart 支援多點觸控
    if (skillBtn) {
      skillBtn.addEventListener("touchstart", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.triggerTrainerActiveSkill();
      }, { passive: false });
    }
    if (megaBtn) {
      megaBtn.addEventListener("touchstart", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.triggerManualMegaEvolution();
      }, { passive: false });
    }
    if (dashBtn) {
      dashBtn.addEventListener("touchstart", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.triggerArenaDash();
      }, { passive: false });
    }

    // 手機端多點觸控委派：確保左手按住虛擬搖桿時，右手點擊頂部功能按鈕能即刻執行
    const topHudBtns = document.querySelectorAll("#hudLayer .pointer-events-auto button");
    topHudBtns.forEach(btn => {
      if (btn.id === "btnTrainerActiveSkill" || btn.id === "btnManualMegaSkill" || btn.id === "btnArenaDashSkill") return;
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
      if (this.state !== "PLAYING") return;
      const now = performance.now();
      if (now - lastTouchEnd <= 300) {
        e.preventDefault();
      }
      lastTouchEnd = now;
    }, { passive: false });
  },

  // 開發者測試工具全套實裝（預設隱藏，大廳右上角閃光計數 2 秒內連點 10 次後解鎖）
  isDevToolsGuardActive() {
    if (this.debugToolsUnlocked) return false;
    // 手機與觸控裝置停用 DevTools 輪詢偵測，徹底避免怪潮 GC 卡頓誤觸鎖屏
    if (this.isMobileDevice && this.isMobileDevice()) return false;
    try {
      const proto = window.location.protocol;
      const host = window.location.hostname;
      if (proto === "file:" || host === "localhost" || host === "127.0.0.1" || host === "::1") {
        return false;
      }
    } catch (e) {}
    return true;
  },

  initDevToolsGuard() {
    if (this._devToolsGuardBound) return;
    this._devToolsGuardBound = true;
    this._devToolsLocked = false;
    this._pausedByDevTools = false;

    // 1. 攔截滑鼠右鍵選單
    window.addEventListener("contextmenu", (e) => {
      if (this.isDevToolsGuardActive()) {
        e.preventDefault();
      }
    }, true);

    // 2. 攔截 F12、DevTools 與檢視原始碼快捷鍵
    window.addEventListener("keydown", (e) => {
      if (!this.isDevToolsGuardActive()) return;
      const key = (e.key || "").toLowerCase();
      const ctrlOrMeta = e.ctrlKey || e.metaKey;
      const isF12 = (e.key === "F12" || e.keyCode === 123);
      const isDevShortcut = (ctrlOrMeta && e.shiftKey && (key === "i" || key === "j" || key === "c")) ||
                            (e.metaKey && e.altKey && (key === "i" || key === "j" || key === "c"));
      const isViewSourceOrSave = (ctrlOrMeta && (key === "u" || key === "s"));
      if (isF12 || isDevShortcut || isViewSourceOrSave) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    }, true);

    // 3. 僅桌面端啟用輕量級 debugger 斷點陷阱 + 連續 3 次超時防誤判機制
    this._devToolsStrikeCount = 0;
    setInterval(() => {
      if (!this.isDevToolsGuardActive()) {
        this._devToolsStrikeCount = 0;
        if (this._devToolsLocked) this.releaseDevToolsGuard();
        return;
      }
      if (document.hidden) {
        this._devToolsStrikeCount = 0;
        return;
      }
      const t0 = performance.now();
      try {
        (function(){}).constructor("debugger")();
      } catch (e) {}
      if (document.hidden) return;
      const dt = performance.now() - t0;
      if (dt > 260) {
        this._devToolsStrikeCount = (this._devToolsStrikeCount || 0) + 1;
        if (this._devToolsStrikeCount >= 3) {
          this.triggerDevToolsPause();
        }
      } else {
        this._devToolsStrikeCount = 0;
      }
    }, 1200);
  },

  triggerDevToolsPause() {
    if (!this._devToolsLocked) {
      this._devToolsLocked = true;
      if (this.state === "PLAYING") {
        this.state = "PAUSED";
        this._pausedByDevTools = true;
      }
      if (this.touchJoy) {
        this.touchJoy.active = false;
        this.touchJoy.dx = 0;
        this.touchJoy.dy = 0;
      }
      const joyBase = document.getElementById("touchJoyBase");
      const joyStick = document.getElementById("touchJoyStick");
      if (joyBase) joyBase.style.display = "none";
      if (joyStick) joyStick.style.display = "none";
    }
    const overlay = document.getElementById("devToolsGuardOverlay");
    if (overlay) {
      overlay.classList.remove("hidden");
      overlay.style.display = "flex";
    }
  },

  releaseDevToolsGuard() {
    this._devToolsLocked = false;
    const overlay = document.getElementById("devToolsGuardOverlay");
    if (overlay) {
      overlay.classList.add("hidden");
      overlay.style.display = "none";
    }
    if (this._pausedByDevTools) {
      this._pausedByDevTools = false;
      if (this.state === "PAUSED") {
        this.state = "PLAYING";
        this.lastFrameTime = performance.now();
      }
    }
  },

  tryResumeFromDevToolsGuard() {
    if (!this.isDevToolsGuardActive()) {
      this.releaseDevToolsGuard();
      return;
    }
    const t0 = performance.now();
    try {
      (function(){}).constructor("debugger")();
    } catch (e) {}
    const dt = performance.now() - t0;
    if (dt <= 260) {
      this._devToolsStrikeCount = 0;
      this.releaseDevToolsGuard();
    }
  },

  syncDebugButtonVisibility() {
    const btn = document.getElementById("btnHudDebugToggle");
    if (btn) btn.classList.toggle("hidden", !this.debugToolsUnlocked);
    if (this.debugToolsUnlocked && this._devToolsLocked) {
      this.releaseDevToolsGuard();
    }
    if (!this.debugToolsUnlocked) {
      const menu = document.getElementById("debugDropdown");
      if (menu) menu.classList.add("hidden");
    }
  },

  toggleDebugMenu() {
    if (!this.debugToolsUnlocked) return;
    const menu = document.getElementById("debugDropdown");
    if (menu) menu.classList.toggle("hidden");
  },

  markDebugRun() {
    if (this.runStats) this.runStats.isDebugRun = true;
  },

  recordPlayerHit(dmg) {
    if (!this.runStats) return;
    this.runStats.hitsTaken = (this.runStats.hitsTaken || 0) + 1;
    this.runStats.damageTaken = (this.runStats.damageTaken || 0) + Math.max(0, dmg || 0);
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
    this.markDebugRun();
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

  debugUnlockSuperMoveSlot(slotIdx = 0) {
    if (!this.player) return;
    this.markDebugRun();
    const p = this.player;
    // 若點選第 2 槽超武但目前只學 1 招，自動從天生三招池補齊第 2 招（不動第 1 槽）
    if (slotIdx >= 1 && Object.keys(p.skills).length <= slotIdx) {
      const natList = p.naturalSkills || ["Tackle", "AirSlash", "Earthquake"];
      for (const sId of natList) {
        const metaCheck = SKILLS_CATALOG[sId];
        if (metaCheck && !p.skills[metaCheck.id]) {
          p.skills[metaCheck.id] = { id: metaCheck.id, level: 10, evolved: false, timer: 0.25 };
          if (Object.keys(p.skills).length > slotIdx) break;
        }
      }
    }
    const skillList = Object.values(p.skills);
    const sk = skillList[slotIdx];
    if (!sk) return;
    const meta = SKILLS_CATALOG[sk.id];
    if (!meta) return;
    sk.level = 10;
    if (meta.reqItem) p.heldItems[meta.reqItem] = true;
    sk.evolved = true;
    sk.ultMaxCd = 8.0;
    sk.ultTimer = 8.0;
    SkillsEngine.triggerUltimateSuperMove(meta, sk, 0.82);
    this.spawnFloatingText(p.x, p.y - 32, `★ 第${slotIdx + 1}槽【${meta.evolvedName || meta.name}】超武覺醒！`, "#FACC15", 15);
    this.refreshHUD();
  },

  debugUnlockSuperMove(targetCount = 1) {
    this.debugUnlockSuperMoveSlot(targetCount >= 2 ? 1 : 0);
  },

  debugToggleStopSpawn() {
    if (!this.player) return;
    this.markDebugRun();
    this.debugStopSpawn = !this.debugStopSpawn;
    const btn = document.getElementById("btnDebugStopSpawn");
    if (this.debugStopSpawn) {
      this.enemies = this.enemies.filter(e => e.isTrainingDummy);
      this.enemyProjectiles = [];
      this.spawnFloatingText(this.player.x, this.player.y - 28, "🧹 已清空全場敵人並【停止刷怪】！", "#34D399", 14);
      if (btn) {
        btn.textContent = "🚫 停刷中: 開 (點此恢復)";
        btn.className = "px-1.5 py-1 bg-rose-800 border border-rose-400 rounded text-[9px] font-black text-rose-100";
      }
    } else {
      this.spawnFloatingText(this.player.x, this.player.y - 28, "▶ 已恢復敵人自動生成！", "#38BDF8", 14);
      if (btn) {
        btn.textContent = "🧹 清怪停刷: 關";
        btn.className = "px-1.5 py-1 bg-slate-700 border border-slate-500 rounded text-[9px] font-bold";
      }
    }
  },

  debugToggleTrainingDummy() {
    if (!this.player) return;
    this.markDebugRun();
    const p = this.player;
    const hasDummy = this.enemies.some(e => e.isTrainingDummy);
    const btn = document.getElementById("btnDebugDummyToggle");
    if (hasDummy) {
      this.enemies = this.enemies.filter(e => !e.isTrainingDummy);
      this.spawnFloatingText(p.x, p.y - 28, "🎯 已移除測試木樁", "#94A3B8", 13);
      if (btn) btn.textContent = "🎯 召喚木樁";
      return;
    }
    const ang = p.facingAngle || 0;
    const dx = p.x + Math.cos(ang) * 125;
    const dy = p.y + Math.sin(ang) * 125;
    const dummyData = {
      id: 9999, name_zh: "測試木樁", type1: "Normal", type2: "None",
      hp: 999999, atk: 0, speed: 0, weightTier: "heavy", kbResist: 1.0,
      forward_sprite: "", back_sprite: ""
    };
    this.enemies.push({
      id: 9999,
      data: dummyData,
      x: dx, y: dy,
      vx: 0, vy: 0,
      hp: 999999, maxHp: 999999,
      atk: 0, speed: 0,
      radius: 26,
      isBoss: false, isElite: false, isTrainingDummy: true,
      kbResist: 1.0, weightTier: "heavy",
      facingX: -1, facingY: 1,
      status: null, statusTimer: 0, whiteFlashTimer: 0,
      ccImmunityTimer: 0, dpsBucket: 0, dpsShieldFlashTimer: 0
    });
    this.spawnFloatingText(dx, dy - 32, "🎯 測試木樁就位！(999,999 HP)", "#34D399", 14);
    if (btn) btn.textContent = "🎯 移除木樁";
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
    if (this.debugGodMode) this.markDebugRun();
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
    this.markDebugRun();
    this.enemies = this.enemies.filter(e => e.isBoss);
    this.enemyProjectiles = [];
    this.spawnFloatingText(this.player.x, this.player.y - 28, "🧹 已清空全場常規小怪與彈幕！", "#34D399", 14);
  },

  debugInstantEvolve() {
    if (!this.player) return;
    this.markDebugRun();
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
    } else if (typeof MEGA_FORMS !== "undefined" && MEGA_FORMS[p.id] && !p.megaEvolved) {
      this.startEvolutionMoment(MEGA_FORMS[p.id].id, false, null, true);
    } else {
      this.spawnFloatingText(p.x, p.y - 28, "目前已是最終完全體形態！", "#FACC15", 13);
    }
  },

  debugTriggerMegaCharizardX() {
    if (!this.player) return;
    this.markDebugRun();
    const p = this.player;
    if (p.id === 10034) {
      this.spawnFloatingText(p.x, p.y - 28, "已是【超級噴火龍X】蒼藍冥炎形態！", "#38BDF8", 14);
      return;
    }
    if (!p.skills["Flamethrower"]) {
      p.skills["Flamethrower"] = { id: "Flamethrower", level: 8, evolved: false, timer: 0.15 };
    }
    if (!p.skills["Dragon Rush"] && !p.skills["DragonRush"]) {
      p.skills["Dragon Rush"] = { id: "Dragon Rush", level: 6, evolved: false, timer: 0.30 };
    }
    this.startEvolutionMoment(10034, false, null, true);
  },

  debugTriggerMegaBlastoise() {
    if (!this.player) return;
    this.markDebugRun();
    const p = this.player;
    if (p.id === 10036) {
      this.spawnFloatingText(p.x, p.y - 28, "已是【超級水箭龜】重炮形態！", "#38BDF8", 14);
      return;
    }
    if (!p.skills["Hydro Pump"] && !p.skills["HydroPump"]) {
      p.skills["Hydro Pump"] = { id: "Hydro Pump", level: 8, evolved: false, timer: 0.15 };
    }
    if (!p.skills["WaterGun"]) {
      p.skills["WaterGun"] = { id: "WaterGun", level: 6, evolved: false, timer: 0.30 };
    }
    this.startEvolutionMoment(10036, false, null, true);
  },

  debugTriggerMegaVenusaur() {
    if (!this.player) return;
    this.markDebugRun();
    const p = this.player;
    if (p.id === 10033) {
      this.spawnFloatingText(p.x, p.y - 28, "已是【超級妙蛙花】霸王花王形態！", "#4ADE80", 14);
      return;
    }
    if (!p.skills["VineWhip"]) {
      p.skills["VineWhip"] = { id: "VineWhip", level: 8, evolved: false, timer: 0.15 };
    }
    if (!p.skills["Seed Bomb"] && !p.skills["SeedBomb"]) {
      p.skills["Seed Bomb"] = { id: "Seed Bomb", level: 6, evolved: false, timer: 0.30 };
    }
    this.startEvolutionMoment(10033, false, null, true);
  },

  debugTriggerMegaGengar() {
    if (!this.player) return;
    this.markDebugRun();
    const p = this.player;
    if (p.id === 10038) {
      this.spawnFloatingText(p.x, p.y - 28, "已是【超級耿鬼】冥界踩影形態！", "#C084FC", 14);
      return;
    }
    if (!p.skills["Shadow Ball"] && !p.skills["ShadowBall"]) {
      p.skills["Shadow Ball"] = { id: "Shadow Ball", level: 8, evolved: false, timer: 0.15 };
    }
    if (!p.skills["Sludge Bomb"] && !p.skills["SludgeBomb"]) {
      p.skills["Sludge Bomb"] = { id: "Sludge Bomb", level: 6, evolved: false, timer: 0.30 };
    }
    this.startEvolutionMoment(10038, false, null, true);
  },

  debugTriggerMegaGyarados() {
    if (!this.player) return;
    this.markDebugRun();
    const p = this.player;
    if (p.id === 10041) {
      this.spawnFloatingText(p.x, p.y - 28, "已是【超級暴鯉龍】深海狂龍形態！", "#F43F5E", 14);
      return;
    }
    if (!p.skills["Hydro Pump"] && !p.skills["HydroPump"]) {
      p.skills["Hydro Pump"] = { id: "Hydro Pump", level: 8, evolved: false, timer: 0.15 };
    }
    if (!p.skills["Dragon Rush"] && !p.skills["DragonRush"]) {
      p.skills["Dragon Rush"] = { id: "Dragon Rush", level: 6, evolved: false, timer: 0.30 };
    }
    this.startEvolutionMoment(10041, false, null, true);
  },

  debugTriggerMegaAerodactyl() {
    if (!this.player) return;
    this.markDebugRun();
    const p = this.player;
    if (p.id === 10042) {
      this.spawnFloatingText(p.x, p.y - 28, "已是【超級化石翼龍】太古蒼穹形態！", "#F59E0B", 14);
      return;
    }
    if (!p.skills["Air Slash"] && !p.skills["AirSlash"]) {
      p.skills["Air Slash"] = { id: "Air Slash", level: 8, evolved: false, timer: 0.15 };
    }
    if (!p.skills["Earthquake"]) {
      p.skills["Earthquake"] = { id: "Earthquake", level: 6, evolved: false, timer: 0.30 };
    }
    this.startEvolutionMoment(10042, false, null, true);
  },

  debugSpawnTreasureMob(kind) {
    if (!this.player) return;
    this.spawnTreasureMonster(kind);
  },

  debugSkipToTime(sec) {
    this.markDebugRun();
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
    this.markDebugRun();
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
        atk: 24, speed: 75, radius: 26, isElite: true, noEliteDrop: true, isBoss: false, isShiny: false,
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
        atk: 32, speed: 130, radius: 28, isElite: true, noEliteDrop: true, isBoss: false, isShiny: false,
        facingX: 1, facingY: 0, status: null, statusTimer: 0, statusTick: 0,
        ccImmunityTimer: 999, rangedCd: 999, whiteFlashTimer: 0, weightTier: "heavy", kbResist: 0.95
      });
    }
  },

  debugAddPartner() {
    if (!this.player) return;
    this.markDebugRun();
    this.summonOrUpgradePartner();
  },

  // Boss 降臨前奏系統 (Warning 預警序列，支援無盡深淵對角雙神降臨)
  startGameRun() {
    SoundFX.init();
    if (this.saveLastSetup) this.saveLastSetup();
    const stageId = (this.selectedStage && this.selectedStage.id) ? this.selectedStage.id : "pallet";
    if (typeof MapEngine !== "undefined") {
      MapEngine.setStage(stageId);
      MapEngine.cloudTime = 0;
      MapEngine.lightningFlashAlpha = 0;
      MapEngine.splashParticles = [];
    }
    SoundFX.playBgm(stageId, true);

    // 徹底隱藏大廳、結算、過場以及所有局內可能殘留的全屏遮罩彈窗（根除第二局黑屏）
    ["preloader-screen", "splashScreen", "cutInLayer", "setupModal", "titleScreen", "endModal", "levelUpModal", "eevee-evo-modal", "pokeMartModal", "expeditionModal", "expExChoiceModal", "settingsModal", "unlock-confirm-modal", "pokedexModal", "skillTreeModal", "achievementModal", "megaInfoModal"].forEach(mId => {
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

    // 徹底清除上一局殘留的進化演出、過場計時器與離線剪影顯存，根除第二局黑屏
    this.evoSequence = null;
    this._pendingEvolutionTarget = null;
    this._pauseFrameRendered = false;
    clearTimeout(this._cutInHideTimer);
    clearTimeout(this._bannerTimeout);
    if (typeof SpriteCache !== "undefined" && SpriteCache.clearVolatileCaches) {
      SpriteCache.clearVolatileCaches();
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

    const badgeB = (typeof getKantoBadgeBonuses === "function") ? getKantoBadgeBonuses(this.saveData) : { hpMult: 1, magnetMult: 1, speedMult: 1, healMult: 1, statusBonus: 0, cdMult: 1, atkMult: 1, critBonus: 0, coinMult: 1 };
    const isPowerPlantStage = (MapEngine.currentStage && MapEngine.currentStage.id === "power_plant");
    const maxHp = Math.round(basePoke.hp * tr.mods.hpMult * (1 + upg.hp * 0.12) * shinyMult * badgeB.hpMult);
    const maxSkillSlots = 3 + (upg.fourthSlot >= 1 ? 1 : 0);
    const trainerSkillMaxCd = Math.round(tr.skillCd * (1 - (upg.trainerCd || 0) * 0.04));
    const isPureSingleStage = !basePoke.evo_to && basePoke.id < 144 &&
      !POKEMON_DB.some(parent => parent.evo_to === basePoke.id || ([134, 135, 136].includes(basePoke.id) && parent.id === 133));

    this.player = {
      isPureSingleStage: isPureSingleStage,
      singleStageAwakened: false,
      legendaryAwaken12: false,
      legendaryAwaken24: false,
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
      dmgMult: tr.mods.dmgMult * (1 + upg.atk * 0.08) * (isBond ? 1.25 : 1.0) * badgeB.atkMult,
      cdMult: tr.mods.cdMult * Math.pow(0.965, upg.cd) * (isBond ? 0.80 : 1.0) * badgeB.cdMult,
      speedMult: tr.mods.speedMult * badgeB.speedMult * (isPowerPlantStage ? 1.10 : 1.0),
      areaMult: tr.mods.areaMult,
      critRate: 0.10 + tr.mods.critBonus + badgeB.critBonus,
      regen: Math.min(2.2, (tr.mods.regen || 0.3) + (upg.hp || 0) * 0.4) * badgeB.healMult,
      magnetRadius: Math.round(92 * badgeB.magnetMult),
      badgeHealMult: badgeB.healMult,
      badgeStatusBonus: badgeB.statusBonus,
      badgeCoinMult: badgeB.coinMult,
      projBonus: tr.mods.projBonus || 0,
      maxSkillSlots,
      skills: {},
      heldItems: {},
      invulnTimer: 0,
      lillieSanctuaryTimer: 0,
      maxLillieSanctuaryTimer: 2.0,
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
      underdogExpBonus: typeof getUnderdogExpBonus === "function" ? getUnderdogExpBonus(basePoke) : 0,
      trail: [{ x: 0, y: 0 }],
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

    const loadout = (this.saveData && this.saveData.skillLoadouts && this.saveData.skillLoadouts[basePoke.id]) || {};
    const customStarter = (loadout.starter && derivedNatSkills.includes(loadout.starter)) ? loadout.starter : null;
    const firstSkillId = customStarter || derivedNatSkills[0] || "Tackle";
    const startSkillLv = starLv >= 3 ? 2 : 1;
    this.player.skills[firstSkillId] = { id: firstSkillId, level: startSkillLv, evolved: false, timer: 0.2 };
    this.player.naturalSkills = [...derivedNatSkills];
    this.player.bannedSkillId = (loadout.banned && loadout.banned !== firstSkillId) ? loadout.banned : null;
	
    const trCostume = (typeof getResolvedTrainerCostume === "function")
      ? getResolvedTrainerCostume(tr, this.saveData)
      : { id: "classic", sprite: tr.sprite, walkSheet: tr.walkSheet || null, sprites: tr.sprites || null, cutin: tr.cutin };
    this.trainerCompanion = {
      x: 26,
      y: 8,
      facingX: -1,
      facingY: 1,
      walkBob: 0,
      costumeId: trCostume.id,
      sprite: trCostume.sprite,
      walkSheet: trCostume.walkSheet || null,
      sprites: trCostume.sprites || null,
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
    this.iconPopups = [];
    this._procThrottleMap = {};
    this.gems = [];
    this.mapItems = [];
    this.lavaFootprints = [];
    this.telegraphs = [];
    this.enemyProjectiles = [];
    this.enemyExplosions = [];
    this.enemyDashes = [];
    this.activeBoss = null;
    this.debugWeatherLock = false;
    this.bossWeatherLock = false;
    this.bossDeathAnims = [];
    this.victoryCeremony = null;
    this.pendingMewTimer = 0;
    this.skillDamageStats = {};
    this.runStats = {
      hitsTaken: 0,
      damageTaken: 0,
      perfectDodges: 0,
      totalHitsDealt: 0,
      superEffectiveHits: 0,
      statusProcs: 0,
      arenaPowerupsPicked: 0,
      fieldPowerupsPicked: 0,
      treasuresKilled: 0,
      trainerSkillsUsed: 0,
      isDebugRun: !!this.debugGodMode
    };
    this.lastRunRating = null;
    this._lastHudIdentityKey = null;
    this._lastWasMegaHud = false;
    this._lastHudHpTier = null;
    this._lastHudPartnerKey = null;
    this._lastHudHeldKey = null;
    this._lastHudSkillKey = null;
    this._lastHudBtnStateKey = null;
    this._lastTerrainBadgeKey = null;
    this._lastStatusBadgeKey = null;
    this._lastArenaDashHudKey = null;
    this._lastMegaHudKey = null;
    this._lastTraitBadgeKey = null;
    this._hudRefreshTimer = 0;

    SkillsEngine.reset();

    if (tr.mods.startPartner || (upg.partner >= 1)) {
      this.summonOrUpgradePartner();
    }

    // 初始化本局模式 ("standard" 8分鐘標準 | "endless" 無盡深淵 | "arena" 1vs1 鬥技場 | "expedition" 10波RPG大遠征)
    this.isArenaMode = (this.selectedGameMode === "arena");
    this.isEndlessMode = (this.selectedGameMode === "endless");
    this.isExpeditionMode = (this.selectedGameMode === "expedition");
    this.arenaHealEff = 1.0;
    this.arenaDiff = null;
    this.arenaPowerups = [];
    this.fieldPowerups = [];
    this.fieldPowerupTimer = 38.0;
    this.areaClearStampTimer = 0;
    this._deferLevelUpDuringClear = false;
    this._deferredLevelUps = 0;
    this.activeMode = this.isExpeditionMode
      ? (typeof ModeExpedition !== "undefined" ? ModeExpedition : ModeSurvivor)
      : (this.isArenaMode
          ? (typeof ModeArena !== "undefined" ? ModeArena : ModeSurvivor)
          : (typeof ModeSurvivor !== "undefined" ? ModeSurvivor : null));
    this.endlessNextBossTime = 480;
    this.endlessCycleIdx = 0;
    this.endlessNextKillMilestone = 150;
    this.activeLoadoutBuffs = {};

    // 兌現 STEP 3 多選勾選的所有「開局戰術特訓補給」（1vs1 鬥技場不扣款、不套用割草開局補給）
    const chosenLoadouts = this.isArenaMode
      ? []
      : (Array.isArray(this.selectedLoadouts)
          ? [...this.selectedLoadouts]
          : (this.selectedLoadout && this.selectedLoadout !== "none" ? [this.selectedLoadout] : []));
    const loadoutCatalog = typeof TACTICAL_LOADOUTS !== "undefined" ? TACTICAL_LOADOUTS : [];
    const appliedNames = [];

    let usedFreeTrialThisRun = false;
    chosenLoadouts.forEach(ldId => {
      const ldMeta = loadoutCatalog.find(x => x.id === ldId);
      let cost = ldMeta ? ldMeta.cost : 0;
      if (!this.saveData.firstFreeLoadoutUsed && !usedFreeTrialThisRun) {
        cost = 0;
        usedFreeTrialThisRun = true;
        this.saveData.firstFreeLoadoutUsed = true;
      }
      if ((this.saveData.coins || 0) < cost) return;
      this.saveData.coins -= cost;
      this.activeLoadoutBuffs[ldId] = true;
      if (ldMeta) appliedNames.push(cost === 0 ? `${ldMeta.name}(首試免費)` : ldMeta.name);

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
          this.player.dmgMult += 0.06;
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
    this.debugStopSpawn = false;
    const stopBtn = document.getElementById('btnDebugStopSpawn');
    if (stopBtn) { stopBtn.textContent = '🧹 清怪停刷: 關'; stopBtn.className = 'px-1.5 py-1 bg-slate-700 border border-slate-500 rounded text-[9px] font-bold'; }
    const dumBtn = document.getElementById('btnDebugDummyToggle');
    if (dumBtn) dumBtn.textContent = '🎯 召喚木樁';
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
    this.runGemsCollected = 0;
    this.lastGemCollectTime = 0;
    this.gemGuideRemindCount = 0;
    this.gemGuideActive = false;
    this.timeScale = 1;

    document.getElementById("speedToggleText").textContent = "1x";
    document.getElementById("bossHudContainer").classList.add("hidden");
    MapEngine.setWeather("CLEAR");
    this.updateWeatherUI("CLEAR");

    this.battleCountdownTimer = 1.52;
    this._lastCountdownBeat = 4;
    const megaWrap = document.getElementById("btnManualMegaWrap");
    if (megaWrap) megaWrap.classList.add("hidden");

    if (typeof MapEngine !== "undefined" && MapEngine.setBoundedMap) {
      MapEngine.setBoundedMap(false);
    }
    if (this.activeMode && typeof this.activeMode.onStart === "function") {
      this.activeMode.onStart(this);
    } else if (typeof MapEngine !== "undefined" && MapEngine.setArenaMode) {
      MapEngine.setArenaMode(false);
    }

    this.syncDebugButtonVisibility();
    this.state = "PLAYING";
    this.refreshHUD();
  },

  getMegaEvolutionStatus() {
    const p = this.player;
    if (!p || p.megaEvolved) return null;
    const mf = (typeof getMegaFormForPokemon === "function") ? getMegaFormForPokemon(p.id) : null;
    if (!mf) return null;
    const hasRing = !!(this.saveData && this.saveData.upgrades && this.saveData.upgrades.megaRing >= 1);
    const isFinalForm = (p.id === mf.baseId);
    const isBond = !!(this.selectedTrainer && (mf.bondTrainerIds || []).includes(this.selectedTrainer.id));
    const reqLv = isBond ? (mf.bondReqLevel || 23) : (mf.reqLevel || 24);
    const reqList = mf.reqSkills || ["Flamethrower", "Dragon Rush"];
    const reqCleanSet = new Set(reqList.map(s => s.replace(/\s+/g, "")));
    let skillSum = 0;
    Object.values(p.skills || {}).forEach(sk => {
      if (sk && sk.id && reqCleanSet.has(sk.id.replace(/\s+/g, ""))) {
        skillSum += (sk.level || 0);
      }
    });
    const reqSum = mf.reqSkillSum || 10;
    const ready = hasRing && isFinalForm && p.level >= reqLv && skillSum >= reqSum;
    return { mf, hasRing, isFinalForm, curLv: p.level, reqLv, skillSum, reqSum, ready };
  },

  checkMegaEvolutionReady() {
    const p = this.player;
    if (!p || p.megaEvolved || p.megaReady) return false;
    const st = this.getMegaEvolutionStatus();
    if (!st || !st.ready) return false;

    p.megaReady = true;
    p.megaTargetId = st.mf.id;
    SoundFX.play("shiny");
    this.showCutsceneBanner(
      "【💎 MEGA 鑰石共鳴就緒！】",
      `點擊右下角【💎 MEGA】按鈕（或按 M 鍵），隨時釋放【${st.mf.name_zh}】覺醒！`,
      3200
    );
    this.spawnFloatingText(p.x, p.y - 34, "💎 MEGA 覺醒就緒！", "#38BDF8", 15);
    return true;
  },

  triggerManualMegaEvolution() {
    if (this.state !== "PLAYING" || !this.player) return;
    if (this.battleCountdownTimer > 0) return;
    const p = this.player;
    if (p.megaEvolved) return;
    if (!p.megaReady) {
      const st = this.getMegaEvolutionStatus();
      if (!st) return;
      SoundFX.play("hit");
      if (!st.hasRing) {
        this.spawnFloatingText(p.x, p.y - 30, "🔒 需先於【研究所】研發超級手環！", "#CBD5E1", 13);
      } else if (!st.isFinalForm || st.curLv < st.reqLv) {
        this.spawnFloatingText(p.x, p.y - 30, `💎 需進化完全體並達 Lv.${st.reqLv} (目前 Lv.${st.curLv})`, "#38BDF8", 13);
      } else {
        this.spawnFloatingText(p.x, p.y - 30, `💎 招式條件未達：${st.skillSum}/${st.reqSum} 級`, "#38BDF8", 13);
      }
      return;
    }
    const targetId = p.megaTargetId || 10034;
    p.megaReady = false;
    const megaWrap = document.getElementById("btnManualMegaWrap");
    if (megaWrap) megaWrap.classList.add("hidden");
    this.startEvolutionMoment(targetId, false, null, true);
  },

  triggerArenaDash() {
    if (this.state !== "PLAYING" || !this.player || !this.isArenaMode) return;
    if (this.battleCountdownTimer > 0) return;
    const p = this.player;
    if ((p.arenaDashCd || 0) > 0) return;

    let dx = p.inputActive ? p.inputX : 0;
    let dy = p.inputActive ? p.inputY : 0;
    if (Math.hypot(dx, dy) < 0.05) {
      dx = p.facingX || 0;
      dy = p.facingY || 0;
      if (Math.hypot(dx, dy) < 0.05) { dx = 1; dy = 0; }
    }
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;

    p.dashTimer = 0.18;
    p.dashVx = dx * 690;
    p.dashVy = dy * 690;
    p.arenaDashInvulnTimer = 0.25;
    p.arenaDashPerfectUsed = false;
    p.invulnTimer = Math.max(p.invulnTimer || 0, 0.25);
    p.arenaDashMaxCd = 3.2;
    p.arenaDashCd = 3.2;

    this.spawnParticleCluster(p.x, p.y, "#38BDF8", "#E0F2FE", 12, "circle", 0.9);
    SoundFX.play("hit", "Flying");
    this.refreshHUD();
  },

  tryArenaPerfectDodge() {
    const p = this.player;
    if (!this.isArenaMode || !p) return false;
    if ((p.arenaDashInvulnTimer || 0) > 0) {
      if (!p.arenaDashPerfectUsed) {
        p.arenaDashPerfectUsed = true;
        p.arenaDashCd = Math.max(0, (p.arenaDashCd || 0) - 1.0);
        p.arenaPerfectCounterTimer = 2.0;
        if (this.runStats) this.runStats.perfectDodges += 1;
        this.spawnParticleCluster(p.x, p.y, "#38BDF8", "#FEF08A", 16, "star", 1.15);
        this.spawnFloatingText(p.x, p.y - 34, "⚡ 完美閃避！CD -1s ‧ 反擊+20%傷", "#38BDF8", 14);
        SoundFX.play("shiny");
      }
      return true;
    }
    return false;
  },

  tryConsumeArenaShield() {
    const p = this.player;
    if (!p || (p.arenaShieldTimer || 0) <= 0) return false;
    p.arenaShieldTimer = 0;
    p.invulnTimer = Math.max(p.invulnTimer || 0, 0.55);
    this.spawnParticleCluster(p.x, p.y, "#C084FC", "#E0F2FE", 18, "star", 1.1);
    this.enemies.forEach(en => {
      if (en && !en.isBoss && Math.hypot(en.x - p.x, en.y - p.y) < 135) {
        const a = Math.atan2(en.y - p.y, en.x - p.x);
        en.x += Math.cos(a) * 65;
        en.y += Math.sin(a) * 65;
      }
    });
    this.spawnFloatingText(p.x, p.y - 32, "折射護盾抵擋！", "#C084FC", 14);
    SoundFX.play("super");
    return true;
  },

  getArenaAdjustedIncomingDmg(normalDmg, kind = "bullet") {
    const p = this.player;
    if (!p) return normalDmg;
    const activeShieldMod = (p.shieldTimer > 0 ? 0.55 : 1.0);
    if (this.isArenaMode && this.arenaDiff) {
      const d = this.arenaDiff;
      const pct = kind === "telegraph"
        ? (d.telegraphPct || 0.16)
        : (kind === "contact" ? (d.contactPct || 0.09) : (d.bulletPct || 0.06));
      const threatFloor = Math.round(p.maxHp * pct * activeShieldMod);
      return Math.max(normalDmg, threatFloor);
    }
    if (this.isExpeditionMode) {
      const diffId = (this.selectedDifficulty && this.selectedDifficulty.id) || "normal";
      const diffScale = ({ casual: 0.70, normal: 1.00, hard: 1.30, hell: 1.55 })[diffId] || 1.00;
      const basePct = kind === "telegraph" ? 0.19 : 0.07;
      const threatFloor = Math.round(p.maxHp * basePct * diffScale * activeShieldMod);
      return Math.max(normalDmg, threatFloor);
    }
    return normalDmg;
  },

  triggerTrainerActiveSkill() {
    if (this.state !== "PLAYING" || !this.player || this.battleCountdownTimer > 0) return;
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
        const _trCos = (typeof getResolvedTrainerCostume === "function") ? getResolvedTrainerCostume(tr, this.saveData) : tr;
        document.getElementById("cutInAvatar").src = _trCos.sprite;
        document.getElementById("cutInTrainer").textContent = `${tr.name} ‧ 戰術指令`;
        document.getElementById("cutInSkill").textContent = `【${tr.skillName}】`;
        cutStrip.classList.remove("cut-in-active");
        void cutStrip.offsetWidth;
        cutStrip.classList.add("cut-in-active");
      };

      const activeTrCos = (typeof getResolvedTrainerCostume === "function") ? getResolvedTrainerCostume(tr, this.saveData) : tr;
      const activeCutinUrl = activeTrCos.cutin || tr.cutin;
      const cutRec = activeCutinUrl ? SpriteCache.get(activeCutinUrl) : null;
      if (activeCutinUrl && cutBannerImg && cutBannerWrap && !(cutRec && cutRec.error)) {
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
        cutBannerImg.src = activeCutinUrl;
        const bTrainerEl = document.getElementById("cutInBannerTrainer");
        const bSkillEl = document.getElementById("cutInBannerSkill");
        const bBoxEl = document.getElementById("cutInBannerOverlayBox");
        if (bTrainerEl) bTrainerEl.textContent = `${tr.name} ‧ 戰術指令`;
        if (bSkillEl) bSkillEl.textContent = `【${tr.skillName}】`;
        if (bBoxEl) {
          bBoxEl.style.borderColor = tr.bondColor || "#FBBF24";
          cutBannerImg.style.borderColor = tr.bondColor || "#FBBF24";
          if (tr.id === "serena") {
            bBoxEl.className = "absolute bottom-2 left-3 sm:bottom-3 sm:left-6 bg-gradient-to-r from-slate-950/95 via-slate-900/95 to-pink-950/95 px-4 py-2 sm:px-6 sm:py-2.5 rounded-xl border-2 shadow-[0_8px_24px_rgba(0,0,0,0.95)] transform -skew-x-12 flex flex-col items-start pointer-events-none";
          } else {
            bBoxEl.className = "absolute bottom-2 right-3 sm:bottom-3 sm:right-6 bg-gradient-to-r from-slate-950/95 via-slate-900/95 to-red-950/95 px-4 py-2 sm:px-6 sm:py-2.5 rounded-xl border-2 shadow-[0_8px_24px_rgba(0,0,0,0.95)] transform -skew-x-12 flex flex-col items-end pointer-events-none";
          }
        }
        cutBannerWrap.classList.remove("cut-in-banner-active");
        void cutBannerWrap.offsetWidth;
        cutBannerWrap.classList.add("cut-in-banner-active");
      } else {
        showFallbackStrip();
      }

      // 0.80s 時空凍結：立即重置搖桿避免殘留滑動，播放語音與 Cut-in；結束瞬間才解凍並正式發動技能效果與倒數！
      this.touchJoy.active = false;
      this.touchJoy.touchId = null;
      this.touchJoy.dx = 0;
      this.touchJoy.dy = 0;
      const joyBase = document.getElementById("touchJoyBase");
      const joyStick = document.getElementById("touchJoyStick");
      if (joyBase) joyBase.style.display = "none";
      if (joyStick) joyStick.style.display = "none";

      this.state = "CUTIN";
      this._pauseFrameRendered = false;
      SoundFX.play("ultimate");
      if (typeof SoundFX.playTrainerVoice === "function") {
        SoundFX.playTrainerVoice(tr.id);
      }

      clearTimeout(this._cutInHideTimer);
      this._cutInHideTimer = setTimeout(() => {
        cutLayer.classList.add("hidden");
        cutLayer.style.display = "none";
        if (this.state !== "CUTIN" || !this.player) return;
        this.state = "PLAYING";
        this.lastFrameTime = performance.now();
        this._pauseFrameRendered = false;
        this.executeTrainerActiveSkillEffect(tr);
      }, 800);
      return;
    }

    SoundFX.play("ultimate");
    if (typeof SoundFX.playTrainerVoice === "function") {
      SoundFX.playTrainerVoice(tr.id);
    }
    this.executeTrainerActiveSkillEffect(tr);
  },

  executeTrainerActiveSkillEffect(tr) {
    const p = this.player;
    if (!p || !tr) return;
    if (this.runStats) this.runStats.trainerSkillsUsed = (this.runStats.trainerSkillsUsed || 0) + 1;
    p.status = null;
    p.statusTimer = 0;
    // 解凍落地給予 0.65s 安全無敵幀（莉莉艾另設 2.0s），杜絕恢復畫面瞬間被貼臉彈幕偷襲
    p.invulnTimer = Math.max(p.invulnTimer || 0, 0.65);
    this.camera.shakeTime = 0.26;
    this.camera.shakeMagnitude = 7.5;

    let healPct = 0.20;
    if (tr.id === "ash") {
      healPct = 0.18;
      p.buffTimer = 6.0;
      p.maxBuffTimer = 6.0;
      SkillsEngine.meleeEffects.push({
        style: "ash_pokeball_wave",
        x: p.x, y: p.y,
        radius: 155 * Math.min(1.25, p.areaMult),
        timer: 0.70, maxTime: 0.70,
        color: "#EF4444"
      });
      this.spawnParticleCluster(p.x, p.y, "#F59E0B", "#FFFFFF", 28, "star");
      this.spawnFloatingText(p.x, p.y - 68, "⚡ 命運羈絆全開！", "#FACC15", 14);
    } else if (tr.id === "misty") {
      healPct = 0.24;
      const waveDmg = (48 + p.baseAtk * 1.1) * p.dmgMult;
      // 獨立專屬【暴風海嘯】中空碧藍擴散浪環 ＋ 碎浪白沫 ＋ 冰晶霜圈（與水/冰超武完全分家，清爽不擋紅彈）
      SkillsEngine.groundHazards = SkillsEngine.groundHazards.filter(h => h.kind !== "misty_tsunami");
      SkillsEngine.groundHazards.push({
        kind: "misty_tsunami",
        x: p.x, y: p.y,
        radius: 238 * Math.min(1.25, p.areaMult),
        dmg: waveDmg * 0.52,
        type: "Water",
        timer: 1.15, maxTime: 1.15,
        tickTimer: 0.14, tickInterval: 0.42,
        color: "#38BDF8"
      });
      this.spawnParticleCluster(p.x, p.y, "#38BDF8", "#E0F2FE", 30, "diamond", 1.25);
      this.enemies.forEach(e => {
        if (Math.hypot(e.x - p.x, e.y - p.y) < 250) {
          if (!e.isBoss) {
            const ang = Math.atan2(e.y - p.y, e.x - p.x);
            e.x += Math.cos(ang) * 115; e.y += Math.sin(ang) * 115;
          }
          e.status = "Freeze"; e.statusTimer = e.isBoss ? 1.4 : 3.5;
        }
      });
      this.spawnFloatingText(p.x, p.y - 68, "🌊 暴風海嘯・冰封席捲！", "#38BDF8", 14);
    } else if (tr.id === "brock") {
      healPct = 0.26;
      p.shieldTimer = 5.5;
      p.maxShieldTimer = 5.5;
      p.brockRockOrbitAngle = 0;
      const pushR = 165 * Math.min(1.3, p.areaMult);
      const initDmg = (34 + p.baseAtk * 0.78) * p.dmgMult;
      // 單發乾淨土黃震退衝擊波，不再借用地面超武地裂特效
      SkillsEngine.meleeEffects.push({
        style: "slam_wave",
        x: p.x, y: p.y,
        radius: pushR,
        timer: 0.36, maxTime: 0.36,
        color: "#D97706"
      });
      [...SkillsEngine.getEnemiesInRadius(p.x, p.y, pushR)].forEach(e => {
        if (e && e.hp > 0 && Math.hypot(e.x - p.x, e.y - p.y) <= pushR + e.radius) {
          if (!e.isBoss) {
            const ang = Math.atan2(e.y - p.y, e.x - p.x);
            e.x += Math.cos(ang) * 90;
            e.y += Math.sin(ang) * 90;
          }
          this.dealDamageToEnemy(e, initDmg, "Rock", 0.2, 24);
        }
      });
      this.spawnParticleCluster(p.x, p.y, "#B45309", "#FDE68A", 26, "circle", 1.15);
      this.spawnFloatingText(p.x, p.y - 68, "🛡️ 岩石壁壘・減傷55%！", "#F59E0B", 14);
    } else if (tr.id === "serena") {
      healPct = 0.22;
      p.buffTimer = 5.5;
      p.maxBuffTimer = 5.5;
      if (!this.isArenaMode && this.partners.length === 0) {
        this.summonOrUpgradePartner();
      }
      // 展開 5.5 秒專屬「華麗雙打舞台」（臨時圓形星光地毯 ＋ 雙聚光燈，與月亮之力超武完全分家）
      const stageDmg = (34 + p.baseAtk * 0.72) * p.dmgMult;
      SkillsEngine.groundHazards = SkillsEngine.groundHazards.filter(h => h.kind !== "serena_stage");
      SkillsEngine.groundHazards.push({
        kind: "serena_stage",
        x: p.x, y: p.y,
        followPlayer: true,
        radius: 172 * Math.min(1.25, p.areaMult),
        dmg: stageDmg * 0.45,
        type: "Psychic",
        timer: 5.5, maxTime: 5.5,
        tickTimer: 0.12, tickInterval: 0.48,
        color: "#F472B6"
      });
      if (this.isArenaMode) {
        // 純 1vs1 鬥技場不召喚副手，轉化為主角 5.5 秒華麗獨舞爆發（傷害 +35% ＋ 立即重置閃避 CD）
        p.arenaFuryTimer = Math.max(p.arenaFuryTimer || 0, 5.5);
        p.arenaDashCd = 0;
        this.spawnParticleCluster(p.x, p.y, "#F472B6", "#FEF08A", 32, "star", 1.25);
        this.spawnFloatingText(p.x, p.y - 68, "✨ 華麗獨舞・全傷+35% ＆ 閃避重置！", "#F472B6", 14);
      } else {
        // 全雙打夥伴立即爆發 1.6x 強化華麗合擊，並重置冷卻進入 5.5 秒狂熱演出
        const upgPartnerMult = 1 + ((this.saveData.upgrades && this.saveData.upgrades.partner) || 0) * 0.18;
        this.partners.forEach(pt => {
          pt.cdTimer = 0;
          const skId = SKILLS_CATALOG[pt.data.skill] ? pt.data.skill : "Tackle";
          SkillsEngine.fireSkill(pt, skId, Math.min(10, pt.level + 3), false, upgPartnerMult * 1.10);
          this.spawnParticleCluster(pt.x, pt.y, "#F472B6", "#FEF08A", 16, "star", 1.1);
        });
        this.spawnParticleCluster(p.x, p.y, "#F472B6", "#FEF08A", 32, "star", 1.25);
        this.spawnFloatingText(p.x, p.y - 68, "✨ 華麗舞台・夥伴 2x 攻速！", "#F472B6", 14);
      }
    } else if (tr.id === "lillie") {
      healPct = 0.38;
      p.invulnTimer = 2.0;
      p.lillieSanctuaryTimer = 2.0;
      p.maxLillieSanctuaryTimer = 2.0;
      SkillsEngine.meleeEffects.push({
        style: "slam_wave",
        x: p.x, y: p.y,
        radius: 105,
        timer: 0.36, maxTime: 0.36,
        color: "#6EE7B7"
      });
      this.spawnParticleCluster(p.x, p.y, "#34D399", "#FEF08A", 28, "star", 1.05);
      this.spawnFloatingText(p.x, p.y - 68, "✨ 星之祈願・2s無敵！", "#34D399", 14);
    } else if (tr.id === "red") {
      healPct = 0.25;
      p.buffTimer = 6.5;
      p.maxBuffTimer = 6.5;
      // 冠軍專屬赤紅霸氣衝擊環（與 240px 震退範圍 1:1 呼應）
      SkillsEngine.meleeEffects.push({
        style: "slam_wave",
        x: p.x, y: p.y,
        radius: 235,
        timer: 0.42, maxTime: 0.42,
        color: "#EF4444"
      });
      SkillsEngine.meleeEffects.push({
        style: "slam_wave",
        x: p.x, y: p.y,
        radius: 155,
        timer: 0.32, maxTime: 0.32,
        color: "#FACC15"
      });
      this.spawnParticleCluster(p.x, p.y, "#EF4444", "#F59E0B", 36, "star", 1.35);
      this.enemies.forEach(e => {
        if (Math.hypot(e.x - p.x, e.y - p.y) < 240 && !e.isBoss) {
          const ang = Math.atan2(e.y - p.y, e.x - p.x);
          e.x += Math.cos(ang) * 110; e.y += Math.sin(ang) * 110;
        }
      });
      this.spawnFloatingText(p.x, p.y - 68, "🔥 王牌號令・全傷+45%！", "#EF4444", 15);
    }

    const arenaHealMod = this.isArenaMode ? (this.arenaHealEff || 0.85) : 1.0;
    const healAmt = Math.round(p.maxHp * healPct * arenaHealMod);
    p.hp = Math.min(p.maxHp, p.hp + healAmt);
    this.spawnFloatingText(p.x + 28, p.y - 14, `+${healAmt} HP`, "#10B981", 13);

    // 瞬發型訓練家（小霞、莉莉艾）釋放後立即賦予完整冷卻時間；持續型（小智、小剛、莎莉娜、赤紅）於 buff 結束後進冷卻
    if (tr.id !== "ash" && tr.id !== "brock" && tr.id !== "serena" && tr.id !== "red") {
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
      let evolvedAny = false;
      let maxNewLv = 1;
      this.partners.forEach(pt => {
        if (pt.level < 5) {
          pt.level += 1;
          anyUpg = true;
          if (pt.level > maxNewLv) maxNewLv = pt.level;
          if (pt.data.evo_level !== "None" && pt.level >= 3 && pt.data.evo_to) {
            const nextData = POKEMON_MAP.get(pt.data.evo_to);
            if (nextData) {
              pt.id = nextData.id;
              pt.data = nextData;
              evolvedAny = true;
              this.saveData.pokedexSeen[nextData.id] = true;
              this.saveData.pokedexCaught[nextData.id] = true;
            }
          }
        } else if (pt.level > maxNewLv) {
          maxNewLv = pt.level;
        }
      });
      if (anyUpg) {
        if (evolvedAny) {
          this.spawnFloatingText(this.player.x, this.player.y - 30, `✨ 夥伴進化＆強化！Lv.${maxNewLv} / 5`, "#F472B6", 14);
        } else if (maxNewLv >= 5) {
          this.spawnFloatingText(this.player.x, this.player.y - 30, `★ 夥伴滿級覺醒 (Lv.5)！狂熱連擊解鎖！`, "#FACC15", 14);
        } else {
          this.spawnFloatingText(this.player.x, this.player.y - 30, `雙打夥伴強化！Lv.${maxNewLv} / 5`, "#EC4899", 14);
        }
      } else {
        const p = this.player;
        const healAmt = Math.round(p.maxHp * 0.20 * (p.badgeHealMult || 1.0));
        p.hp = Math.min(p.maxHp, p.hp + healAmt);
        this.runCoins += 50;
        this.saveData.coins += 50;
        SoundFX.play("coin");
        this.spawnParticleCluster(p.x, p.y, "#F472B6", "#FACC15", 16, "star", 1.0);
        this.spawnFloatingText(p.x, p.y - 30, `💖 夥伴已滿級！轉化 +${healAmt} HP ＆ +50 金幣！`, "#34D399", 14);
      }
    }
    this.refreshHUD();
  },

  loop(timestamp) {
    // 永遠先預約下一幀，並以 try/catch 保護主循環，確保任何單幀異常絕不會導致畫面永久死鎖黑屏
    requestAnimationFrame((t) => this.loop(t));

    try {
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
    } catch (err) {
      console.error("GameApp loop recovered from error:", err);
    }
  },

  updateTitleDemo(dt) {
    if (!this.titleDemo) return;
    this.titleDemo.camX += 38 * dt;
    this.titleDemo.camY = Math.sin(this.titleDemo.camX * 0.003) * 45;
  },

  updateCombat(dt) {
    const isWarmupCountdown = (this.battleCountdownTimer > 0);
    if (isWarmupCountdown) {
      this.battleCountdownTimer = Math.max(0, this.battleCountdownTimer - dt);
      const beat = Math.ceil(this.battleCountdownTimer / 0.38); // 4..1 -> 3, 2, 1, START!
      const mappedBeat = Math.min(3, Math.max(0, beat - 1));
      if (this._lastCountdownBeat !== mappedBeat) {
        this._lastCountdownBeat = mappedBeat;
        SoundFX.play(mappedBeat > 0 ? "countdown_tick" : "countdown_go");
      }
    } else {
      this.runTime += dt;
    }
    const p = this.player;

    if (p.arenaDashCd > 0) p.arenaDashCd = Math.max(0, p.arenaDashCd - dt);
    if (p.arenaDashInvulnTimer > 0) p.arenaDashInvulnTimer = Math.max(0, p.arenaDashInvulnTimer - dt);
    if (p.arenaFuryTimer > 0) p.arenaFuryTimer = Math.max(0, p.arenaFuryTimer - dt);
    if (p.arenaGaleTimer > 0) p.arenaGaleTimer = Math.max(0, p.arenaGaleTimer - dt);
    if (p.arenaShieldTimer > 0) p.arenaShieldTimer = Math.max(0, p.arenaShieldTimer - dt);
    if (p.arenaPerfectCounterTimer > 0) p.arenaPerfectCounterTimer = Math.max(0, p.arenaPerfectCounterTimer - dt);

    const arenaHealEff = this.isArenaMode ? (this.arenaHealEff || 0.85) : 1.0;
    const bossHealMod = ((this.activeBoss && this.activeBoss.hp > 0) ? 0.5 : 1.0) * arenaHealEff;
    if (p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + p.regen * dt * bossHealMod);
    // 閃光精靈出戰專屬：每 2.2 秒於身周輕閃淡金四芒星，突顯正版官方色違質感
    if (p.isShiny) {
      p._shinySparkTick = (p._shinySparkTick || 0.8) - dt;
      if (p._shinySparkTick <= 0) {
        p._shinySparkTick = 2.2;
        for (let ss = 0; ss < 2; ss++) {
          const sx = p.x + (Math.random() - 0.5) * 34;
          const sy = p.y - 4 + (Math.random() - 0.5) * 24;
          SkillsEngine.spawnSubParticle(sx, sy, (Math.random() - 0.5) * 14, -26 - Math.random() * 14, ss === 0 ? "#FEF08A" : "#FFFFFF", 3.2, 0.55, "star");
        }
      }
    }
    // 超級妙蛙花 (#10033) 【厚脂肪 ＋ 光合堡壘】：免疫灼傷/冰凍並常駐 +0.8%/s 光合回血
    if (p.id === 10033) {
      if (p.status === "Burn" || p.status === "Freeze") {
        p.status = null;
        p.statusTimer = 0;
      }
      if (p.hp < p.maxHp) {
        p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.008 * dt * bossHealMod);
      }
    }
    if (p.megaEvolved || p.id >= 10000) {
      p._megaSparkTick = (p._megaSparkTick || 0) - dt;
      if (p._megaSparkTick <= 0) {
        p._megaSparkTick = 0.12;
        const ax = p.x + (Math.random() - 0.5) * 38;
        const ay = p.y + 10 - Math.random() * 16;
        if (p.id === 10036) {
          // 超級水箭龜：深藍水霧 ＋ 金青色高壓水珠星芒
          SkillsEngine.spawnSubParticle(ax, ay, (Math.random() - 0.5) * 22, -44 - Math.random() * 24, Math.random() < 0.4 ? "#FEF08A" : "#38BDF8", 3.2, 0.36, Math.random() < 0.5 ? "circle" : "star");
        } else if (p.id === 10033) {
          // 超級妙蛙花：翡翠嫩葉 ＋ 粉金霸王花瓣孢子
          SkillsEngine.spawnSubParticle(ax, ay, (Math.random() - 0.5) * 24, -40 - Math.random() * 24, Math.random() < 0.45 ? "#F472B6" : "#4ADE80", 3.3, 0.40, Math.random() < 0.55 ? "leaf" : "star");
        } else if (p.id === 10038) {
          // 超級耿鬼：冥界暗紫鬼火 ＋ 血紅邪眼星芒
          SkillsEngine.spawnSubParticle(ax, ay, (Math.random() - 0.5) * 24, -42 - Math.random() * 24, Math.random() < 0.42 ? "#FB7185" : "#A855F7", 3.4, 0.40, Math.random() < 0.55 ? "diamond" : "star");
        } else if (p.id === 10041) {
          // 超級暴鯉龍：深海赤紅狂瀾 ＋ 耀金電水星芒
          SkillsEngine.spawnSubParticle(ax, ay, (Math.random() - 0.5) * 24, -46 - Math.random() * 24, Math.random() < 0.48 ? "#F43F5E" : "#38BDF8", 3.4, 0.38, Math.random() < 0.5 ? "circle" : "star");
        } else if (p.id === 10042) {
          // 超級化石翼龍：太古金岩碎芒 ＋ 蒼穹紫銀疾風
          SkillsEngine.spawnSubParticle(ax, ay, (Math.random() - 0.5) * 26, -48 - Math.random() * 26, Math.random() < 0.5 ? "#FACC15" : "#C084FC", 3.1, 0.36, Math.random() < 0.55 ? "diamond" : "star");
        } else {
          // 超級噴火龍X：暗黑冥炎 ＋ 蒼藍電焰
          const isDarkFlame = Math.random() < 0.45;
          if (isDarkFlame) {
            SkillsEngine.spawnSubParticle(ax, ay, (Math.random() - 0.5) * 20, -38 - Math.random() * 24, Math.random() < 0.5 ? "#0F172A" : "#312E81", 4.2, 0.38, "circle");
          } else {
            SkillsEngine.spawnSubParticle(ax, ay, (Math.random() - 0.5) * 22, -48 - Math.random() * 26, Math.random() < 0.55 ? "#38BDF8" : "#E0F2FE", 3.1, 0.36, "star");
          }
        }
      }
    }
    if (p.singleStageAwakened || p.legendaryAwaken24) {
      p._awakenSparkTick = (p._awakenSparkTick || 0) - dt;
      if (p._awakenSparkTick <= 0) {
        p._awakenSparkTick = p.legendaryAwaken24 ? 0.34 : 0.40;
        const ax = p.x + (Math.random() - 0.5) * 36;
        const ay = p.y + 8 - Math.random() * 22;
        const typeCol = p.legendaryAwaken24 ? (TYPE_COLORS[p.data.type1] || "#EC4899") : "#38BDF8";
        SkillsEngine.spawnSubParticle(ax, ay, (Math.random() - 0.5) * 14, -38 - Math.random() * 20, Math.random() < 0.5 ? "#FEF08A" : typeCol, 2.5, 0.44, "star");
      }
    }
    if (p.invulnTimer > 0) p.invulnTimer -= dt;
    if (p.whiteFlashTimer > 0) p.whiteFlashTimer -= dt;

    if (p.lillieSanctuaryTimer > 0) {
      p.lillieSanctuaryTimer = Math.max(0, p.lillieSanctuaryTimer - dt);
      p._lillieSparkTick = (p._lillieSparkTick || 0) - dt;
      if (p._lillieSparkTick <= 0) {
        p._lillieSparkTick = 0.14;
        const la = Math.random() * Math.PI * 2;
        const lx = p.x + Math.cos(la) * (16 + Math.random() * 14);
        const ly = p.y + 10 + Math.sin(la) * 8;
        SkillsEngine.spawnSubParticle(lx, ly, (Math.random() - 0.5) * 12, -38 - Math.random() * 20, Math.random() < 0.5 ? "#6EE7B7" : "#FEF08A", 2.8, 0.42, "star");
      }
    }
    if (p.buffTimer > 0) {
      p.buffTimer -= dt;
      if (this.selectedTrainer && this.selectedTrainer.id === "ash") {
        p._ashSparkTick = (p._ashSparkTick || 0) - dt;
        if (p._ashSparkTick <= 0) {
          p._ashSparkTick = 0.15;
          const aa = Math.random() * Math.PI * 2;
          const ax = p.x + Math.cos(aa) * (18 + Math.random() * 10);
          const ay = p.y + 10 + Math.sin(aa) * 6;
          SkillsEngine.spawnSubParticle(
            ax, ay,
            (Math.random() - 0.5) * 18, -48 - Math.random() * 24,
            Math.random() < 0.5 ? "#FACC15" : (Math.random() < 0.5 ? "#FFFFFF" : "#FB923C"),
            2.8, 0.36, "star"
          );
        }
      } else if (this.selectedTrainer && this.selectedTrainer.id === "red") {
        p._redChampSparkTick = (p._redChampSparkTick || 0) - dt;
        if (p._redChampSparkTick <= 0) {
          p._redChampSparkTick = 0.16;
          const ra = Math.random() * Math.PI * 2;
          const rx = p.x + Math.cos(ra) * (20 + Math.random() * 10);
          const ry = p.y + 12 + Math.sin(ra) * 6;
          SkillsEngine.spawnSubParticle(rx, ry, (Math.random() - 0.5) * 16, -46 - Math.random() * 24, Math.random() < 0.55 ? "#EF4444" : "#FACC15", 2.9, 0.36, "star");
        }
      }
      if (p.buffTimer <= 0) {
        p.buffTimer = 0;
        p.trainerSkillCd = p.trainerSkillMaxCd;
      }
    }
    if (p.shieldTimer > 0) {
      p.shieldTimer -= dt;
      if (this.selectedTrainer && this.selectedTrainer.id === "brock") {
        p.brockRockOrbitAngle = (p.brockRockOrbitAngle || 0) + dt * 4.2;
        const nowMs = performance.now();
        const orbitR = 56;
        const reflectDmg = (24 + p.baseAtk * 0.58) * p.dmgMult;
        const nearRocks = SkillsEngine.getEnemiesInRadius(p.x, p.y, orbitR + 24);
        for (let ri = nearRocks.length - 1; ri >= 0; ri--) {
          const en = nearRocks[ri];
          if (!en || en.hp <= 0 || en.treasureType) continue;
          if (en._brockReflectUntil && en._brockReflectUntil > nowMs) continue;
          const d = Math.hypot(en.x - p.x, en.y - p.y);
          if (d <= orbitR + 14 + en.radius * 0.85) {
            en._brockReflectUntil = nowMs + 380;
            if (!en.isBoss) {
              const pushAng = Math.atan2(en.y - p.y, en.x - p.x);
              const kbAmt = 46 * (1 - (en.kbResist || 0) * 0.5);
              en.x += Math.cos(pushAng) * kbAmt;
              en.y += Math.sin(pushAng) * kbAmt;
            }
            this.dealDamageToEnemy(en, reflectDmg, "Rock", 0.12, 16);
            this.spawnParticleCluster(en.x, en.y, "#D97706", "#FDE68A", 6, "circle", 0.75);
            SoundFX.play("hit", "Rock");
          }
        }
      }
      if (p.shieldTimer <= 0) {
        p.shieldTimer = 0;
        p.trainerSkillCd = p.trainerSkillMaxCd;
      }
    }
    if (p.heldItems && p.heldItems["never_melt_ice"]) {
      p._frostRimTick = (p._frostRimTick || 0) - dt;
      if (p._frostRimTick <= 0) {
        p._frostRimTick = 0.24;
        const fa = Math.random() * Math.PI * 2;
        const fx = p.x + Math.cos(fa) * (120 + (Math.random() - 0.5) * 10);
        const fy = p.y + Math.sin(fa) * (120 + (Math.random() - 0.5) * 10);
        SkillsEngine.spawnSubParticle(fx, fy, (Math.random() - 0.5) * 16, -18 - Math.random() * 14, Math.random() < 0.5 ? "#E0F2FE" : "#67E8F9", 2.4, 0.42, "diamond");
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
    this._playerOnBoostTrack = !!terrain.onBoostTrack;
    if (typeof MapEngine.updateAndCheckMapHazards === 'function') MapEngine.updateAndCheckMapHazards(dt, this);

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
      p.hp = Math.min(p.maxHp, p.hp + 2.0 * dt * bossHealMod);
    }

    // 【攜帶物：奇蹟種子】常駐光合作用回血 (0.8%/s)，處於草叢/淺灘/超能陣等特殊地形時提升至 1.8%/s，並每 1.2 秒跳出綠字與嫩葉粒子
    if (p.heldItems && p.heldItems["miracle_seed"] && p.hp < p.maxHp) {
      const inSpecialZone = !!(terrain.inWater || (terrain.label && (terrain.label.includes("草叢") || terrain.label.includes("重力陣"))));
      const overgrowMult = (p.innateTrait && p.innateTrait.overgrowHealMult) ? p.innateTrait.overgrowHealMult : 1.0;
      const healRate = (inSpecialZone ? 0.018 : 0.008) * overgrowMult * bossHealMod;
      p.hp = Math.min(p.maxHp, p.hp + p.maxHp * healRate * dt);
      p.miracleSeedTick = (p.miracleSeedTick || 0) - dt;
      if (p.miracleSeedTick <= 0) {
        p.miracleSeedTick = 1.2;
        const healAmt = Math.max(1, Math.round(p.maxHp * healRate * 1.2));
        this.spawnItemProcFeedback("miracle_seed", p.x, p.y - 28, `+${healAmt}`, `🌱 奇蹟種子 +${healAmt}`, "#4ADE80", "miracle_seed");
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
      this.spawnItemProcFeedback("mystic_water", p.x, p.y - 30, "", "💧 神秘水滴：護體水幕擊退！", "#38BDF8", "mystic_water");
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
          this.spawnItemProcFeedback("magnet", p.x, p.y - 30, "", "🧲 磁力徽章：全場水晶回收！", "#38BDF8", "magnet_badge");
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
          this.spawnItemProcFeedback("magnet", p.x, p.y - 30, "", "⚡ 磁鐵脈衝：遠程水晶牽引！", "#FACC15", "magnet");
          SoundFX.play("super");
        } else {
          p.heldMagnetTimer = 1.0;
        }
      }
    }

    // 【準神快龍 #149 ＆ 傳說五神獸專屬：多重鱗片 / 傳說王權星冕護盾】(每 10 秒充能，五神獸護盾就緒滿 6.5 秒且身邊有怪時更會主動爆發王權威壓新星！)
    if (p.id === 149 || (p.id >= 144 && p.id <= 151)) {
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
          tickTimer: 0.1,
          isMegaBlue: !!(p.megaEvolved || p.id === 10034),
          seed: Math.random() * 100
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

    const isLavaImmBadge = !!(terrain.inLava && p.data && ["Fire", "Rock", "Ground", "Flying"].some(t => p.data.type1 === t || p.data.type2 === t));
    const nextTerrainText = terrain.label
      ? (isLavaImmBadge
          ? "[地形] 淺層熔岩池 [本系免疫燙傷＆減速]"
          : ((p.heldItems && p.heldItems["sharp_beak"] && terrain.speedMult < 1.0)
              ? `${terrain.label.split(' ')[0]} [銳利之喙：免疫減速]`
              : terrain.label))
      : "";
    if (this._lastTerrainBadgeKey !== nextTerrainText) {
      this._lastTerrainBadgeKey = nextTerrainText;
      const tBadge = document.getElementById("hudTerrainBadge");
      if (tBadge) {
        if (nextTerrainText) {
          tBadge.textContent = nextTerrainText;
          tBadge.classList.remove("hidden");
        } else {
          tBadge.classList.add("hidden");
        }
      }
    }

    let nextStatusText = "";
    let nextStatusKind = "";
    if (p.status) {
      const stNames = { Burn: "灼傷中", Paralysis: "麻痺減速", Freeze: "冰凍遲緩", Poison: "中毒中", Confusion: "混亂反向" };
      nextStatusText = `[異常] ${stNames[p.status] || p.status}`;
      nextStatusKind = "debuff";
    } else if (p.xAttackTimer > 0 || p.xSpeedTimer > 0 || p.arenaFuryTimer > 0 || p.arenaGaleTimer > 0 || p.arenaShieldTimer > 0) {
      const buffLabels = [];
      if (p.xAttackTimer > 0) buffLabels.push(`力量強化(${Math.ceil(p.xAttackTimer)}s)`);
      if (p.xSpeedTimer > 0) buffLabels.push(`速度強化(${Math.ceil(p.xSpeedTimer)}s)`);
      if (p.arenaFuryTimer > 0) buffLabels.push(`⚡狂暴+35%(${Math.ceil(p.arenaFuryTimer)}s)`);
      if (p.arenaGaleTimer > 0) buffLabels.push(`💨疾風(${Math.ceil(p.arenaGaleTimer)}s)`);
      if (p.arenaShieldTimer > 0) buffLabels.push(`🛡️折射護盾(${Math.ceil(p.arenaShieldTimer)}s)`);
      nextStatusText = `[增益] ${buffLabels.join(" ")}`;
      nextStatusKind = "buff";
    }
    const statusKey = `${nextStatusKind}|${nextStatusText}`;
    if (this._lastStatusBadgeKey !== statusKey) {
      this._lastStatusBadgeKey = statusKey;
      const pStatusEl = document.getElementById("hudPlayerStatusBadge");
      if (pStatusEl) {
        if (nextStatusText) {
          pStatusEl.textContent = nextStatusText;
          pStatusEl.className = nextStatusKind === "debuff"
            ? "px-2 py-0.5 bg-rose-950/90 text-rose-300 border border-rose-500 rounded-full font-black text-[10px]"
            : "px-2 py-0.5 bg-amber-950/90 text-amber-300 border border-amber-500 rounded-full font-black text-[10px]";
          pStatusEl.classList.remove("hidden");
        } else {
          pStatusEl.classList.add("hidden");
        }
      }
    }

    const statusSpdMod = p.status === "Freeze" ? 0.45 : (p.status === "Paralysis" ? 0.65 : 1.0);
    const xSpdMod = p.xSpeedTimer > 0 ? 1.30 : 1.0;
    const hasSharpBeak = !!(p.heldItems && p.heldItems["sharp_beak"]);
    const sharpBeakSpdMod = hasSharpBeak ? 1.12 : 1.0;
    const isLavaImmuneType = !!(terrain.inLava && p.data && ["Fire", "Rock", "Ground", "Flying"].some(t => p.data.type1 === t || p.data.type2 === t));
    const finalTerrainSpd = ((hasSharpBeak || isLavaImmuneType) && terrain.speedMult < 1.0)
      ? 1.0
      : ((p.xSpeedTimer > 0 && terrain.inWater) ? 1.0 : terrain.speedMult);
    const quickStepMod = (p.quickStepTimer > 0) ? 1.15 : 1.0;
    const arenaGaleSpdMod = (p.arenaGaleTimer > 0) ? 1.25 : 1.0;
    const rawMoveSpd = (112 + p.baseSpeed * 0.72) * p.speedMult * sharpBeakSpdMod * finalTerrainSpd * statusSpdMod * (p.buffTimer > 0 ? 1.25 : 1.0) * xSpdMod * quickStepMod * arenaGaleSpdMod;
    // 主角速度軟上限 185 px/s，拉高坦型精靈底盤同時保留快慢手感差異
    const moveSpd = Math.min(185, rawMoveSpd);

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
    if (!p.trail) p.trail = [{ x: p.x, y: p.y }];
    const lastTrail = p.trail[p.trail.length - 1];
    if (!lastTrail || Math.hypot(p.x - lastTrail.x, p.y - lastTrail.y) >= 4) {
      p.trail.push({ x: p.x, y: p.y });
      if (p.trail.length > 32) p.trail.shift();
    }

    // 沿主角實際走過的安全路徑，定位身後 26px 的滯後跟隨點
    let targetTx = tc.x;
    let targetTy = tc.y;
    let accumDist = 0;
    let prevPt = { x: p.x, y: p.y };
    let foundTrailPt = false;
    for (let ti = p.trail.length - 1; ti >= 0; ti--) {
      const pt = p.trail[ti];
      const segD = Math.hypot(prevPt.x - pt.x, prevPt.y - pt.y);
      if (accumDist + segD >= 26) {
        const remain = 26 - accumDist;
        const ratio = segD > 0.001 ? (remain / segD) : 0;
        targetTx = prevPt.x + (pt.x - prevPt.x) * ratio;
        targetTy = prevPt.y + (pt.y - prevPt.y) * ratio;
        foundTrailPt = true;
        break;
      }
      accumDist += segD;
      prevPt = pt;
    }
    if (!foundTrailPt) {
      const dToP = Math.hypot(tc.x - p.x, tc.y - p.y);
      if (dToP > 28) {
        const ang = Math.atan2(tc.y - p.y, tc.x - p.x);
        targetTx = p.x + Math.cos(ang) * 26;
        targetTy = p.y + Math.sin(ang) * 26;
      }
    }

    const tcDx = targetTx - tc.x;
    const tcDy = targetTy - tc.y;
    const tcDist = Math.hypot(tcDx, tcDy);
    const followSpeed = tcDist > 90 ? 22 : 13;
    const prevTcX = tc.x, prevTcY = tc.y;
    tc.x += tcDx * Math.min(1, dt * followSpeed);
    tc.y += tcDy * Math.min(1, dt * followSpeed);
    const movedX = tc.x - prevTcX;
    const movedY = tc.y - prevTcY;
    tc.vx = dt > 0 ? movedX / dt : 0;
    tc.vy = dt > 0 ? movedY / dt : 0;

    if (Math.hypot(movedX, movedY) > 0.35) {
      if (Math.abs(movedX) > Math.abs(movedY)) {
        tc.facingX = movedX >= 0 ? 1 : -1;
        tc.facingY = 0;
      } else {
        tc.facingY = movedY < 0 ? -1 : 1;
        tc.facingX = 0;
      }
      tc.walkBob = (tc.walkBob || 0) + dt * 12;
    } else {
      tc.facingX = p.facingX;
      tc.facingY = p.facingY;
      tc.walkBob = 0;
    }
    if (tc.whiteFlashTimer > 0) tc.whiteFlashTimer -= dt;
    if (tc.walkBob > 0.01 && !tc.isJumpingLedge) {
      tc.dustTimer = (tc.dustTimer || 0) - dt;
      if (tc.dustTimer <= 0) {
        tc.dustTimer = 0.26;
        const tcTerr = MapEngine.getTerrainModifierAt(tc.x, tc.y);
        if (!tcTerr.inWater && (!tcTerr.label || !tcTerr.label.includes("草叢"))) {
          this.spawnParticleCluster(tc.x, tc.y + 18, "#E2E8F0", "#CBD5E1", 2, "circle", 0.22);
        }
      }
    }

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
          const serenaStageOn = (this.selectedTrainer && this.selectedTrainer.id === "serena" && p.buffTimer > 0);
          const stageDmgMult = serenaStageOn ? 1.45 : 1.0;
          const burstMult = (isAwakened && pt.shotCount % 4 === 0) ? 1.45 : 1.0;
          SkillsEngine.fireSkill(pt, skId, Math.min(10, pt.level + (isAwakened ? 2 : 0) + (serenaStageOn ? 1 : 0)), false, upgPartnerMult * 0.68 * bondMult * burstMult * stageDmgMult);
          if (burstMult > 1.0 || serenaStageOn) {
            this.spawnParticleCluster(pt.x, pt.y, "#F472B6", "#FEF08A", serenaStageOn ? 6 : 10, "star", 0.7);
          }
          const basePartnerCd = isAwakened ? 0.95 : 1.35;
          pt.cdTimer = serenaStageOn ? (basePartnerCd * 0.50) : basePartnerCd;
        }
      }
    });

    this.camera.x = p.x;
    this.camera.y = p.y;

    if (isWarmupCountdown) {
      MapEngine.updateWeather(dt, this.width, this.height);
      this.updateParticlesAndTexts(dt);
      this._hudRefreshTimer = (this._hudRefreshTimer || 0) - dt;
      if (this._hudRefreshTimer <= 0) {
        this._hudRefreshTimer = 0.10;
        this.refreshHUD();
      }
      return;
    }

    const psychicCdMod = (MapEngine.weather === "PSYCHIC" ? 0.92 : 1.0);
    const spoonCdMod = (p.heldItems && p.heldItems["twisted_spoon"]) ? 0.92 : 1.0;
    const pillarCdMod = (MapEngine.currentStage.id === "sky_pillar") ? 0.92 : (this._playerOnBoostTrack ? 0.90 : 1.0);
    const arenaGaleCdMod = (p.arenaGaleTimer > 0) ? 0.80 : 1.0;
    const cdFactor = Math.max(0.52, p.cdMult * (p.buffTimer > 0 ? 0.70 : 1.0) * psychicCdMod * spoonCdMod * pillarCdMod * arenaGaleCdMod);
    p.castStaggerTimer = Math.max(0, (p.castStaggerTimer || 0) - dt);
    p.superMoveIcdTimer = Math.max(0, (p.superMoveIcdTimer || 0) - dt);

    const allSkillSlots = Object.values(p.skills);
    const evolvedSlots = allSkillSlots.filter(s => s.evolved);
    const hasDualSuper = evolvedSlots.length >= 2;

    allSkillSlots.forEach((skSlot, slotIdx) => {
      const meta = SKILLS_CATALOG[skSlot.id];
      if (!meta) return;

      // 【雙軌超武・軌道 B】：已突破超武的招式擁有獨立 ~10 秒自動充能爆發軸（不取代原本 Lv.10 普攻）
      if (skSlot.evolved) {
        const isSecondSuper = hasDualSuper && evolvedSlots[1] === skSlot;
        const dualCdPenalty = hasDualSuper ? 1.10 : 1.0;
        const ultMaxCd = Math.max(7.5, Math.min(11.5, 10.0 * Math.max(0.80, cdFactor) * dualCdPenalty));
        skSlot.ultMaxCd = ultMaxCd;
        if (skSlot.ultTimer === undefined) skSlot.ultTimer = 0.6;
        skSlot.ultTimer = Math.max(0, skSlot.ultTimer - dt);

        if (skSlot.ultTimer <= 0 && p.superMoveIcdTimer <= 0) {
          const ultTriggerRange = 205 * Math.min(1.25, p.areaMult);
          const hasUltTarget = this.manualAimMode || !!this.findNearestEnemyInViewport(p.x, p.y, ultTriggerRange);
          if (hasUltTarget) {
            const ultDmgScale = isSecondSuper ? 0.68 : 0.78;
            SkillsEngine.triggerUltimateSuperMove(meta, skSlot, ultDmgScale);
            skSlot.ultTimer = ultMaxCd;
            p.superMoveIcdTimer = 1.60; // 雙超武強制錯峰 1.6 秒，避免同時蓋屏
          }
        }
      }

      // 【雙軌超武・軌道 A】：所有招式（包含已突破超武的 Lv.10 招式）皆維持正常普攻連發
      skSlot.timer = Math.max(0, skSlot.timer - dt);
      if (skSlot.timer <= 0) {
        // 1. 智能有效射程觸發 (Range-Gated Smart Trigger)：
        // 在「自動索敵模式」下，必須有敵人踏入該招式的有效射程內才發動（沒怪時保持 timer = 0 待命蓄力，絕不對空氣亂放）；
        // 若玩家主動切換為「🧭 朝向（手動突圍）」模式，則允許無條件持續開火！
        if (!this.manualAimMode) {
          const trait = p.innateTrait || {};
          const lv = skSlot.level || 1;
          const meleeAreaScale = p.areaMult * (lv >= 3 ? 1.15 : 1.0) * (lv >= 8 ? 1.25 : 1.0) * (1 + (trait.legendaryAreaBonus || 0));
          let triggerRange = 330 * p.areaMult;
          if (meta.isMelee) {
            // 精準對齊各近戰招式的真實有效打擊距離 (乘以 0.90 貼身裕度，確保怪獸踏入打擊圈內才出招，徹底根除打空氣！)
            if (meta.meleeStyle === "slam_wave") {
              // 撞擊 (Tackle A+C)：觸發門檻收斂至第 1~2 段紮實命中區間，杜絕遠距隔山打牛
              const tackleScale = Math.min(1.52, p.areaMult * (lv >= 3 ? 1.14 : 1.0) * (lv >= 8 ? 1.15 : 1.0) * (1 + (trait.tackleQuakeAreaBonus || 0) * 0.65));
              const hasFollowWave = lv >= 4;
              const firstDist = 22 * Math.min(1.15, tackleScale);
              const firstRad = Math.min(46, 36 * tackleScale);
              const actualReach = firstDist + firstRad + (hasFollowWave ? 26 : 0);
              triggerRange = actualReach * 0.90;
            } else if (meta.meleeStyle === "martial_fist") {
              // 空手劈 (Karate Chop)：收斂肉搏射程軟上限，避免滿級隔空揮拳
              const karateScale = Math.min(1.42, meleeAreaScale * (1 + (trait.ironFistAreaBonus || 0) * 0.75));
              const reach = Math.min(138, (64 + lv * 3.5) * karateScale);
              const actualReach = 16 + reach * 0.82 + Math.min(58, Math.max(34, reach * 0.44));
              triggerRange = actualReach * 0.88;
            } else if (meta.meleeStyle === "quake_wave") {
              // 地震 (Earthquake)：對齊軟上限（基礎波 125px、終結重踏 150px）
              const rawReach = (80 + lv * 3.5) * Math.min(1.45, meleeAreaScale * (1 + (trait.tackleQuakeAreaBonus || 0) * 0.75));
              const actualReach = Math.min(lv >= 4 ? 150 : 125, rawReach);
              triggerRange = actualReach * 0.88;
            } else if (meta.meleeStyle === "vine_whip") {
              const whipReach = (typeof SkillsEngine !== "undefined" && SkillsEngine.getVineWhipReach)
                ? SkillsEngine.getVineWhipReach(lv, meleeAreaScale, trait.overgrowAreaBonus || 0)
                : (88 + lv * 11);
              triggerRange = (20 + whipReach) * 0.90;
            } else if (meta.type === "Dragon") {
              // 龍之俯衝 (Dragon Rush)：對齊中距離龍首破陣射程 (195px)
              triggerRange = 195 * meleeAreaScale;
            } else {
              triggerRange = 135 * meleeAreaScale;
            }
          } else if (skSlot.id === "Thunderbolt") {
            triggerRange = 168 * p.areaMult;
          } else if (skSlot.id === "Ember") {
            triggerRange = 185 * p.areaMult;
          } else if (skSlot.id === "HydroPump" || skSlot.id === "Hydro Pump") {
            const cap = (typeof SkillsEngine !== "undefined" && SkillsEngine.getBeamLengthCap) ? SkillsEngine.getBeamLengthCap("HydroPump") : 355;
            const beamLen = Math.min(cap, (205 + lv * 8) * Math.min(1.48, p.areaMult * (lv >= 8 ? 1.18 : 1.0) * (1 + (trait.megaLauncherSizeBonus || 0) * 0.5)));
            triggerRange = beamLen * 0.92;
          } else if (skSlot.id === "Flamethrower") {
            const cap = (typeof SkillsEngine !== "undefined" && SkillsEngine.getBeamLengthCap) ? SkillsEngine.getBeamLengthCap("Flamethrower") : 285;
            const lvLenMult = lv >= 8 ? 1.22 : (lv >= 4 ? 1.12 : 1.0);
            const flameLen = Math.min(cap, (175 + lv * 6.5) * Math.min(1.42, p.areaMult * lvLenMult * (1 + (trait.dragonMawAreaBonus || 0) * 0.5)));
            triggerRange = flameLen * 0.92;
          } else if (skSlot.id === "IceBeam" || skSlot.id === "Ice Beam") {
            const cap = (typeof SkillsEngine !== "undefined" && SkillsEngine.getBeamLengthCap) ? SkillsEngine.getBeamLengthCap("IceBeam") : 365;
            const iceLen = Math.min(cap, (225 + lv * 8) * Math.min(1.45, p.areaMult * (lv >= 8 ? 1.16 : 1.0) * (1 + (trait.megaLauncherSizeBonus || 0) * 0.45)));
            triggerRange = iceLen * 0.92;
          } else if (skSlot.id === "WaterGun") {
            triggerRange = 245 * p.areaMult;
          }
          const hasTargetInRange = this.findNearestEnemyInViewport(p.x, p.y, triggerRange);
          if (!hasTargetInRange) {
            skSlot.timer = 0; // 保持蓄勢待發，一旦怪進圈 0 秒瞬發
            return;
          }
        }

        if (p.castStaggerTimer > 0) {
          skSlot.timer = 0.015; // 全局微序列排隊，防止多把子彈武器同一毫秒重疊發射
          return;
        }
        SkillsEngine.fireSkill(p, skSlot.id, skSlot.level, false, 1.0, slotIdx);
        const lvCdBonus = skSlot.level >= 9 ? 0.75 : (skSlot.level >= 4 ? 0.88 : 1.0);
        const isQuickSkill = ["Tackle", "AirSlash", "Air Slash", "Thunderbolt", "ElectroBall", "XScissor"].includes(skSlot.id);
        const traitCdMod = (p.innateTrait && (isQuickSkill || p.innateTrait.id === "legendary_pressure"))
          ? (p.innateTrait.quickAttackCdMult || 1.0)
          : 1.0;
        const isLongAnimSkill = ["Karate Chop", "Flamethrower", "Hydro Pump", "HydroPump", "Ice Beam", "IceBeam", "VineWhip"].includes(skSlot.id);
        const minSkillCd = (skSlot.id === "Tackle")
          ? (skSlot.level >= 8 ? 0.88 : (skSlot.level >= 4 ? 0.56 : 0.48))
          : (isLongAnimSkill ? 0.55 : 0.48);
        skSlot.timer = Math.max(minSkillCd, meta.baseCd * lvCdBonus * Math.max(0.55, cdFactor * traitCdMod));
        p.castStaggerTimer = 0.085;
      }
    });

    if (!this.isArenaMode && !this.debugWeatherLock && !this.bossWeatherLock && !this.activeBoss) {
      this.weatherCycleTimer = (this.weatherCycleTimer || 80) - dt;
      if (this.weatherCycleTimer <= 0) {
        this.weatherCycleTimer = 80; // 每 80 秒隨機輪替一次，錯開吉利蛋 38s 刷新
        const curStW = MapEngine.currentStage ? MapEngine.currentStage.id : "";
      const weatherPool = curStW === "cinnabar_volcano" ? ["CLEAR", "HEATWAVE", "HEATWAVE", "HEATWAVE", "THUNDER"] : (curStW === "power_plant" ? ["CLEAR", "THUNDER", "THUNDER", "THUNDER", "RAIN"] : ["CLEAR", "RAIN", "THUNDER", "BLIZZARD", "HEATWAVE", "PSYCHIC"]);
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
    this.updateBossDeathAnims(dt);
    if (this.victoryCeremony && this.victoryCeremony.active) {
      this.updateVictoryCeremony(dt);
    } else if (this.activeMode && typeof this.activeMode.update === "function") {
      this.activeMode.update(this, dt);
    } else if (typeof this.updateSpawners === "function") {
      this.updateSpawners(dt);
    }
    this.updateTelegraphs(dt);
    this.updateEnemyProjectiles(dt);
    this.updateEnemies(dt);
    this.updateLootAndGems(dt);
    this.updateFieldPowerups(dt);
    this.updateMartInteraction(dt);
    this.updateParticlesAndTexts(dt);
    this._hudRefreshTimer = (this._hudRefreshTimer || 0) - dt;
    if (this._hudRefreshTimer <= 0) {
      this._hudRefreshTimer = 0.10;
      this.refreshHUD();
    }
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
    if (this.activeBoss && this.activeBoss.hp > 0) return 35;
    const prof = (this.saveData && this.saveData.settings && this.saveData.settings.mobCapProfile) || "auto";
    if (prof === "low") return 100;
    if (prof === "standard") return 160;
    if (prof === "extreme") return 250;
    // auto: 自動依裝置分流 (手機直向甜區 120隻、電腦寬屏 190隻)
    if (this.isMobileDevice()) {
      return Math.min(130, Math.round(68 + minutes * 11));
    }
    return Math.min(205, Math.round(88 + minutes * 17));
  },

  spawnFieldPowerup(wx, wy) {
    if (!this.fieldPowerups) this.fieldPowerups = [];
    if (this.fieldPowerups.length >= 1) return;
    const p = this.player;
    const lowHp = p && (p.hp / p.maxHp) < 0.55;
    const catalog = [
      { id: "fury_core",     name: "力量核心", short: "ATK+35%", color: "#EF4444", sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/x-attack.png" },
      { id: "gale_feather",  name: "疾風羽毛", short: "SPD+30%", color: "#38BDF8", sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/x-speed.png" },
      { id: "mirror_shield", name: "折射護盾", short: "SHIELD",  color: "#C084FC", sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/guard-spec.png" },
      { id: "sitrus_berry",  name: "特大文柚果", short: "+25%HP", color: "#4ADE80", sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/sitrus-berry.png" }
    ];
    const pool = lowHp ? [catalog[3], catalog[3], catalog[0], catalog[1], catalog[2]] : catalog;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    this.fieldPowerups.push({
      ...pick,
      x: wx,
      y: wy,
      life: 14.0,
      maxLife: 14.0,
      bob: 0
    });
    this.spawnParticleCluster(wx, wy, pick.color, "#FFFFFF", 12, "star", 0.85);
    SoundFX.play("gem");
  },

  updateFieldPowerups(dt) {
    const p = this.player;
    if (!p) return;
    if (!this.fieldPowerups) this.fieldPowerups = [];

    // 8 分鐘標準 ／ 無盡深淵模式每 42 秒於玩家視野附近刷出 1 顆限時增益道具
    if (!this.isArenaMode && !this.isExpeditionMode && this.fieldPowerups.length === 0) {
      this.fieldPowerupTimer = (this.fieldPowerupTimer !== undefined ? this.fieldPowerupTimer : 38.0) - dt;
      if (this.fieldPowerupTimer <= 0) {
        this.fieldPowerupTimer = 42.0;
        const ang = Math.random() * Math.PI * 2;
        const dist = 210 + Math.random() * 90;
        this.spawnFieldPowerup(p.x + Math.cos(ang) * dist, p.y + Math.sin(ang) * dist);
      }
    }

    for (let i = this.fieldPowerups.length - 1; i >= 0; i--) {
      const pu = this.fieldPowerups[i];
      pu.life -= dt;
      pu.bob += dt * 4.5;
      if (Math.hypot(p.x - pu.x, p.y - pu.y) <= 34) {
        this.fieldPowerups.splice(i, 1);
        if (this.runStats) this.runStats.fieldPowerupsPicked += 1;
        SoundFX.play("levelup");
        this.spawnParticleCluster(p.x, p.y, pu.color, "#FEF08A", 18, "star", 1.1);
        if (pu.id === "sitrus_berry") {
          const healAmt = Math.round(p.maxHp * 0.25 * (p.badgeHealMult || 1.0));
          p.hp = Math.min(p.maxHp, p.hp + healAmt);
          p.status = null;
          p.statusTimer = 0;
          this.spawnItemProcFeedback(null, p.x, p.y - 30, `+${healAmt} HP`, `特大文柚果：回復 +${healAmt} HP ＆ 淨化！`, pu.color, "fp_berry", pu.sprite);
        } else if (pu.id === "fury_core") {
          p.arenaFuryTimer = Math.max(p.arenaFuryTimer || 0, 8.0);
          this.spawnItemProcFeedback(null, p.x, p.y - 30, "ATK+35%", "力量核心：8秒全傷 +35%！", pu.color, "fp_fury", pu.sprite);
        } else if (pu.id === "gale_feather") {
          p.arenaGaleTimer = Math.max(p.arenaGaleTimer || 0, 8.0);
          p.xSpeedTimer = Math.max(p.xSpeedTimer || 0, 8.0);
          this.spawnItemProcFeedback(null, p.x, p.y - 30, "SPD+30%", "疾風羽毛：8秒疾速 ＆ 涉水免疫！", pu.color, "fp_gale", pu.sprite);
        } else if (pu.id === "mirror_shield") {
          p.arenaShieldTimer = Math.max(p.arenaShieldTimer || 0, 10.0);
          this.spawnItemProcFeedback(null, p.x, p.y - 30, "SHIELD", "折射護盾：抵擋下次攻擊！", pu.color, "fp_shield", pu.sprite);
        }
        continue;
      }
      if (pu.life <= 0) {
        this.fieldPowerups.splice(i, 1);
      }
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
      this.spawnItemProcFeedback(null, p.x, p.y - 30, "NOVA", isAutoPulse ? "👑 傳說王權：神聖威壓新星!" : "👑 傳說王權：護盾反震新星!", "#FACC15", "royal_nova", ITEM_SPRITES.starPiece);
    } else {
      SoundFX.play("hit");
      this.spawnItemProcFeedback(null, p.x, p.y - 28, "GUARD", "🛡️ 多重鱗片抵擋傷害!", "#FACC15", "shield_guard", ITEM_SPRITES.starPiece);
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
      const key = (gx + 32768) * 65536 + (gy + 32768);
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
      if (e.isBoss && e.dpsBucket > 0) {
        const capPct = e.arenaDpsCapPct || 0.12;
        e.dpsBucket = Math.max(0, e.dpsBucket - e.maxHp * capPct * dt);
      }
      if (e.dpsShieldFlashTimer > 0) {
        e.dpsShieldFlashTimer = Math.max(0, e.dpsShieldFlashTimer - dt);
      }

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
          // 解除硬控（冰凍/麻痺/混亂）時賦予全員韌性保護期，混亂保護期拉長防止被超能/幽靈系無限風箏
          if (e.status === "Confusion") {
            e.ccImmunityTimer = e.isBoss ? 4.5 : (e.isElite ? 4.0 : 3.2);
          } else if (["Freeze", "Paralysis"].includes(e.status)) {
            e.ccImmunityTimer = e.isBoss ? 3.5 : (e.isElite ? 2.6 : 1.8);
          }
          e.status = null;
        }
      }

      if (e.isTrainingDummy) {
        if (e.hp < e.maxHp * 0.5) e.hp = e.maxHp;
        continue;
      }
      if (e.status === "Freeze") continue;

      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const inView = Math.abs(dx) <= halfW && Math.abs(dy) <= halfH;
      const nearView = Math.abs(dx) <= halfW + 70 && Math.abs(dy) <= halfH + 70;
      const dist = Math.hypot(dx, dy) || 1;

      const paraMult = e.status === "Paralysis" ? 0.35 : 1.0;
      const confDir = 1.0;
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
      const bossEnrageSpd = (e.isBoss && (e.hp / e.maxHp) <= 0.5) ? 1.10 : 1.0;
      const bossKeepDistMod = (e.isBoss && dist < 90) ? 0.68 : 1.0;
      const effectiveSpd = e.isBoss
        ? Math.min(132, e.speed * bossEnrageSpd) * bossKeepDistMod
        : e.speed * bossEnrageSpd;

      let moveDir = confDir;
      let vx = (dx / dist) * effectiveSpd * paraMult * eTerrMult * moveDir;
      let vy = (dy / dist) * effectiveSpd * paraMult * eTerrMult * moveDir;

      // 1vs1 鬥技場神獸專屬戰術 AI（維持交戰距離、智能繞柱找射界、夢幻對角瞬移、招後 0.55s 硬直窗口）
      if (this.isArenaMode && e.isBoss) {
        if (e.arenaRecoveryTimer > 0) {
          e.arenaRecoveryTimer = Math.max(0, e.arenaRecoveryTimer - dt);
        }
        e.arenaStrafeTimer = (e.arenaStrafeTimer || 2.2) - dt;
        if (e.arenaStrafeTimer <= 0) {
          e.arenaStrafeTimer = 2.0 + Math.random() * 1.4;
          e.arenaStrafeSign = (e.arenaStrafeSign || 1) * -1;
        }
        const sSign = e.arenaStrafeSign || 1;
        const ux = dx / dist, uy = dy / dist;
        const pxVec = -uy * sSign, pyVec = ux * sSign;
        const isRangedKiter = (e.id === 144 || e.id === 150);
        const idealMin = isRangedKiter ? 175 : 125;
        const idealMax = isRangedKiter ? 235 : 190;
        const losBlocked = (typeof MapEngine !== "undefined" && MapEngine.isArenaLosBlocked)
          ? MapEngine.isArenaLosBlocked(e.x, e.y, p.x, p.y, 16)
          : false;

        let dirX = 0, dirY = 0;
        if (losBlocked) {
          // 視線被石柱擋住時：強橫移繞柱並微幅調整距離
          dirX = pxVec * 0.92 + ux * 0.25;
          dirY = pyVec * 0.92 + uy * 0.25;
        } else if (dist > idealMax) {
          dirX = ux * 0.82 + pxVec * 0.45;
          dirY = uy * 0.82 + pyVec * 0.45;
        } else if (dist < idealMin) {
          // 過近時向後滑步拉開身距並橫移（避免像殭屍硬蹭貼臉）
          const nearWall = Math.abs(e.x) > (MapEngine.arenaHalfW - 65) || Math.abs(e.y) > (MapEngine.arenaHalfH - 65);
          dirX = nearWall ? (pxVec * 0.95) : (-ux * 0.65 + pxVec * 0.72);
          dirY = nearWall ? (pyVec * 0.95) : (-uy * 0.65 + pyVec * 0.72);
        } else {
          dirX = pxVec;
          dirY = pyVec;
        }
        const dLen = Math.hypot(dirX, dirY) || 1;
        const recMod = (e.arenaRecoveryTimer > 0) ? 0.25 : 1.0;
        const spdNow = effectiveSpd * paraMult * eTerrMult * recMod;
        vx = (dirX / dLen) * spdNow;
        vy = (dirY / dLen) * spdNow;

        // 始祖夢幻 (#151) 專屬幻影游擊 AI（方案 A）：改於奇數彈幕輪觸發，且蓄力預警或衝鋒期間絕對鎖定不瞬移
        const hasOwnTelegraph = this.telegraphs.some(tg => tg.owner === e);
        const hasOwnDash = this.enemyDashes && this.enemyDashes.some(ds => ds.owner === e);
        if (
          e.id === 151 &&
          (e.bossCycleStep || 0) >= 3 &&
          (e.bossCycleStep % 2 === 1) &&
          !hasOwnTelegraph &&
          !hasOwnDash &&
          e._lastTeleportStep !== e.bossCycleStep
        ) {
          e._lastTeleportStep = e.bossCycleStep;
          this.spawnParticleCluster(e.x, e.y, "#F472B6", "#FEF08A", 18, "star", 1.1);
          e.x = p.x >= 0 ? -205 : 205;
          e.y = p.y >= 0 ? -145 : 145;
          this.spawnParticleCluster(e.x, e.y, "#F472B6", "#FFFFFF", 20, "star", 1.2);
          this.spawnFloatingText(e.x, e.y - 36, "✨ 夢幻瞬移！", "#F472B6", 13);
          SoundFX.play("shiny");
        }
      } else if (e.isBoss && ![144, 145, 146, 150, 151].includes(e.id) && typeof BOSS_ARCHETYPES !== "undefined") {
        // v7.3.8 小王與區域雙王 4 大職能流派專屬走位 AI（告別無腦貼臉送死）
        const archKey = e.bossArchetype || (typeof getBossArchetypeKey === "function" ? getBossArchetypeKey(e.id, e.data) : "juggernaut");
        const arch = BOSS_ARCHETYPES[archKey] || BOSS_ARCHETYPES.juggernaut;
        if (e.bossRecoveryTimer > 0) {
          e.bossRecoveryTimer = Math.max(0, e.bossRecoveryTimer - dt);
        }
        e.arenaStrafeTimer = (e.arenaStrafeTimer || 1.9) - dt;
        if (e.arenaStrafeTimer <= 0) {
          e.arenaStrafeTimer = 1.8 + Math.random() * 1.2;
          e.arenaStrafeSign = (e.arenaStrafeSign || (e.id % 2 === 0 ? 1 : -1)) * -1;
        }
        const sSign = e.arenaStrafeSign || 1;
        const ux = dx / dist, uy = dy / dist;
        const pxVec = -uy * sSign, pyVec = ux * sSign;
        let dirX = ux, dirY = uy;
        if (dist > arch.idealMax) {
          dirX = ux * 0.85 + pxVec * 0.40;
          dirY = uy * 0.85 + pyVec * 0.40;
        } else if (dist < arch.idealMin) {
          if (archKey === "sniper" || archKey === "trickster") {
            dirX = -ux * 0.62 + pxVec * 0.78;
            dirY = -uy * 0.62 + pyVec * 0.78;
          } else {
            dirX = pxVec * 0.85 + ux * 0.25;
            dirY = pyVec * 0.85 + uy * 0.25;
          }
        } else {
          dirX = pxVec * 0.90 + ux * 0.22;
          dirY = pyVec * 0.90 + uy * 0.22;
        }
        const dLen = Math.hypot(dirX, dirY) || 1;
        const recMod = (e.bossRecoveryTimer > 0) ? 0.25 : 1.0;
        const spdNow = effectiveSpd * paraMult * eTerrMult * recMod;
        vx = (dirX / dLen) * spdNow;
        vy = (dirY / dLen) * spdNow;

        // 念影詭術型（胡地／耿鬼）每 3 輪觸發短距離側移閃現（蓄力與衝鋒期間鎖定）
        const hasOwnTelegraph = this.telegraphs.some(tg => tg.owner === e);
        const hasOwnDash = this.enemyDashes && this.enemyDashes.some(ds => ds.owner === e);
        if (
          archKey === "trickster" &&
          (e.bossCycleStep || 0) >= 3 &&
          (e.bossCycleStep % 3 === 0) &&
          !hasOwnTelegraph &&
          !hasOwnDash &&
          e._lastBlinkStep !== e.bossCycleStep
        ) {
          e._lastBlinkStep = e.bossCycleStep;
          this.spawnParticleCluster(e.x, e.y, "#A855F7", "#E9D5FF", 12, "star", 0.9);
          const blinkAng = Math.atan2(p.y - e.y, p.x - e.x) + (sSign * Math.PI * 0.55);
          e.x += Math.cos(blinkAng) * 130;
          e.y += Math.sin(blinkAng) * 130;
          if (typeof MapEngine !== "undefined") MapEngine.resolveObstacleCollision(e, e.radius * 0.85, false);
          this.spawnParticleCluster(e.x, e.y, "#C084FC", "#FFFFFF", 14, "star", 1.0);
          SoundFX.play("hit", "Psychic");
        }
      }

      // 直線衝鋒預警蓄力定身鎖：任何 Boss 或精英正在畫出直線衝鋒跑道時原地蓄力不漂移，確保起點 100% 貼合
      if ((e.isBoss || e.isElite) && this.telegraphs.some(tg => tg.owner === e && tg.shape === "line")) {
        vx = 0;
        vy = 0;
      }

      if (e.treasureType) {
        // 盜寶哥布林 AI：見面 (220px 內) 或受傷後才受驚逃跑；未受驚前在視野邊緣附近切線徘徊，絕不剛出生就逃到百米外！
        if (!e.fleeTriggered && (dist <= 220 || e.hp < e.maxHp)) {
          e.fleeTriggered = true;
          this.spawnFloatingText(e.x, e.y - 26, e.treasureType === "meowth" ? "❗ 聚寶喵喵受驚逃跑!" : "❗ 吉利蛋受驚逃跑!", "#FACC15", 12);
        }
        const angToPlayer = Math.atan2(dy, dx);
        const side = e.fleeDirSign || 1;
        if (!e.fleeTriggered) {
          // 巡邏階段：若距離偏遠(>260px)則斜向靠近視野，否則繞著主角切線散步
          const patrolAng = dist > 260 ? (angToPlayer + side * 0.55) : (angToPlayer + side * 1.48);
          const patrolSpd = Math.min(72, effectiveSpd * 0.72);
          vx = Math.cos(patrolAng) * patrolSpd;
          vy = Math.sin(patrolAng) * patrolSpd;
        } else {
          // 受驚逃跑階段：弧線切線繞逃 ＋ 每 3 秒停頓 0.42 秒灑落金幣讓玩家有機會追上
          if (e.tauntPauseTimer > 0) {
            e.tauntPauseTimer -= dt;
            vx = 0;
            vy = 0;
          } else {
            e.tauntCd = (e.tauntCd === undefined ? 3.0 : e.tauntCd - dt);
            if (e.tauntCd <= 0) {
              e.tauntCd = 3.0;
              e.tauntPauseTimer = 0.42;
              if (e.treasureType === "meowth") {
                this.runCoins += 12;
                this.saveData.coins += 12;
                this.spawnParticleCluster(e.x, e.y, "#FACC15", "#FEF08A", 8, "star", 0.7);
                SoundFX.play("coin");
                this.spawnFloatingText(e.x, e.y - 24, "💰 掉金幣 +12!", "#FACC15", 11);
              }
            }
            const fleeBase = angToPlayer + Math.PI + side * 0.62;
            const fleeSpd = Math.min(e.treasureType === "meowth" ? 108 : 64, effectiveSpd) * paraMult * eTerrMult;
            vx = Math.cos(fleeBase) * fleeSpd;
            vy = Math.sin(fleeBase) * fleeSpd;
          }
        }
      } else if (e.status === "Confusion") {
        // 混亂改為「暈眩蛇行與切線打轉」，偶爾仍會歪斜撞近玩家，不再永遠倒退逃離螢幕
        const swirlDir = (e.id % 2 === 0 ? 1 : -1);
        const dizzyOffset = swirlDir * 1.15 + Math.sin(performance.now() * 0.0055 + e.id * 2.3) * 1.65;
        const cSpd = Math.hypot(vx, vy) * 0.58;
        const baseA = Math.atan2(vy, vx) + dizzyOffset;
        vx = Math.cos(baseA) * cSpd;
        vy = Math.sin(baseA) * cSpd;
      }

      e.x += vx * dt;
      e.y += vy * dt;

      // 高壓怪海(>200隻)時，畫面外怪獸免除互相推擠與樹木碰撞，畫面內隔幀分流推擠，省下 70% CPU 開銷
      const doSeparation = !e.isBoss && (nearView || this.enemies.length <= 160) && (this.enemies.length <= 220 || ((i + this._frameCounter) & 1) === 0);
      if (doSeparation) {
        const gx = Math.floor(e.x / gridCellSize);
        const gy = Math.floor(e.y / gridCellSize);
        for (let ox = -1; ox <= 1; ox++) {
          const gxBase = (gx + ox + 32768) * 65536;
          for (let oy = -1; oy <= 1; oy++) {
            const cell = spatialGrid.get(gxBase + (gy + oy + 32768));
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

      if ((this.isArenaMode && e.isBoss) || (!e.isBoss && (nearView || e.isElite || e.treasureType))) {
        MapEngine.resolveObstacleCollision(e, e.radius * 0.8, false);
      }

      const cdDt = e.status === "Paralysis" ? dt * 0.5 : dt;
      // 1. 神獸 Boss 彈幕與紅圈交替出招節奏（彈幕輪 ⇄ 紅圈大招輪，避免同幀傾倒；雙神同場自動放緩 18%）
      if ((inView || this.isArenaMode) && e.isBoss && !e.treasureType) {
        e.rangedCd = (e.rangedCd !== undefined ? e.rangedCd : 0.9) - cdDt;
        if (e.rangedCd <= 0) {
          const isEnraged = (e.hp / e.maxHp) <= 0.5;
          const aliveBossCount = this.enemies.filter(b => b.isBoss && b.hp > 0).length;
          const dualPaceMod = aliveBossCount >= 2 ? 1.18 : 1.0;
          e.bossCycleStep = (e.bossCycleStep || 0) + 1;
          const isTelegraphTurn = (e.bossCycleStep % 2 === 0);
          const arenaPaceMod = e.arenaCdMult || 1.0;
          e.rangedCd = (isEnraged ? (1.32 + Math.random() * 0.34) : (1.58 + Math.random() * 0.38)) * dualPaceMod * arenaPaceMod;

          if (isTelegraphTurn) {
            // 紅圈大招輪：清晰預警走位解題
            this.spawnEnemyTelegraphAttack(e);
          } else {
            // 彈幕攻勢輪：統一從 Boss 身體外緣 (e.radius + 12) 釋放，杜絕原點重疊黏球
            e.bossVolleyCount = (e.bossVolleyCount || 0) + 1;
            const baseAng = Math.atan2(p.y - e.y, p.x - e.x);
            const rim = e.radius + 12;

            // 1. 急凍鳥 (#144) —— 扇形 5 叉極寒冰錐 ＋ 隔輪 6～8 向暴風雪冰環
            if (e.id === 144) {
              const spreadAngles = [-0.42, -0.21, 0, 0.21, 0.42];
              spreadAngles.forEach(angOffset => {
                const ang = baseAng + angOffset;
                this.enemyProjectiles.push({
                  x: e.x + Math.cos(ang) * rim,
                  y: e.y + Math.sin(ang) * rim,
                  vx: Math.cos(ang) * 230,
                  vy: Math.sin(ang) * 230,
                  angle: ang, radius: 10,
                  dmg: Math.round(e.atk * 0.72),
                  color: "#38BDF8", vfx: "frost_lance",
                  statusEffect: "Freeze", statusChance: 0.30,
                  life: 3.4, rot: 0
                });
              });

              if (e.bossVolleyCount % 2 === 0) {
                const ringCount = isEnraged ? 8 : 6;
                for (let k = 0; k < ringCount; k++) {
                  const ringAng = (k * Math.PI * 2) / ringCount + e.bossVolleyCount * 0.28;
                  this.enemyProjectiles.push({
                    x: e.x + Math.cos(ringAng) * rim,
                    y: e.y + Math.sin(ringAng) * rim,
                    vx: Math.cos(ringAng) * 180,
                    vy: Math.sin(ringAng) * 180,
                    angle: ringAng, radius: 9,
                    dmg: Math.round(e.atk * 0.65),
                    color: "#BAE6FD", vfx: "frost_lance",
                    statusEffect: "Freeze", statusChance: 0.24,
                    life: 3.0, rot: 0
                  });
                }
                this.spawnParticleCluster(e.x, e.y, "#BAE6FD", "#38BDF8", 14, "star", 1.1);
              }
            }

            // 2. 閃電鳥 (#145) —— 4 連扇形高速雷羽 ＋ 恆速左右分流追蹤電磁球 (徹底消除黏團卡死)
            else if (e.id === 145) {
              [-0.28, -0.09, 0.09, 0.28].forEach(angOffset => {
                const ang = baseAng + angOffset;
                this.enemyProjectiles.push({
                  x: e.x + Math.cos(ang) * rim,
                  y: e.y + Math.sin(ang) * rim,
                  vx: Math.cos(ang) * 260, vy: Math.sin(ang) * 260,
                  angle: ang, radius: 9,
                  dmg: Math.round(e.atk * 0.68),
                  color: "#FACC15", vfx: "swift_star",
                  statusEffect: "Paralysis", statusChance: 0.28,
                  life: 3.0, rot: 0
                });
              });

              const homingCount = isEnraged ? 3 : 2;
              const perpAng = baseAng + Math.PI * 0.5;
              for (let h = 0; h < homingCount; h++) {
                const sideFrac = homingCount > 1 ? (h - (homingCount - 1) / 2) : 0;
                const hAng = baseAng + sideFrac * 0.68;
                const latShift = sideFrac * 26;
                const orbSpd = 148;
                this.enemyProjectiles.push({
                  x: e.x + Math.cos(hAng) * (rim + 4) + Math.cos(perpAng) * latShift,
                  y: e.y + Math.sin(hAng) * (rim + 4) + Math.sin(perpAng) * latShift,
                  vx: Math.cos(hAng) * orbSpd, vy: Math.sin(hAng) * orbSpd,
                  initSpeed: orbSpd,
                  turnRate: 2.1,
                  angle: hAng, radius: 12.5,
                  dmg: Math.round(e.atk * 0.78),
                  color: "#FDE047", vfx: "storm_orb",
                  homing: true, statusEffect: "Paralysis", statusChance: 0.40,
                  life: 3.8, rot: 0
                });
              }
            }

            // 3. 火焰鳥 (#146) —— 三～四向大字爆裂炎彈（飛行至終點或命中皆會爆裂散射十字火星）
            else if (e.id === 146) {
              const fireAngles = isEnraged ? [-0.36, -0.12, 0.12, 0.36] : [-0.26, 0, 0.26];
              fireAngles.forEach(off => {
                const fAng = baseAng + off;
                this.enemyProjectiles.push({
                  x: e.x + Math.cos(fAng) * rim,
                  y: e.y + Math.sin(fAng) * rim,
                  vx: Math.cos(fAng) * 215, vy: Math.sin(fAng) * 215,
                  angle: fAng, radius: 14,
                  dmg: Math.round(e.atk * 0.85),
                  color: "#EF4444", vfx: "fire_blast_orb",
                  statusEffect: "Burn", statusChance: 0.40,
                  canSplit: true, isEnragedSplit: isEnraged,
                  life: 1.45, rot: 0
                });
              });
            }

            // 4. 超夢 (#150) —— 單發（狂暴大夾角雙發）引力黑核 ＋ 8～10 向暗影精神波
            else if (e.id === 150) {
              const coreOffsets = isEnraged ? [-0.52, 0.52] : [0];
              coreOffsets.forEach(off => {
                const cAng = baseAng + off;
                this.enemyProjectiles.push({
                  x: e.x + Math.cos(cAng) * rim,
                  y: e.y + Math.sin(cAng) * rim,
                  vx: Math.cos(cAng) * 168, vy: Math.sin(cAng) * 168,
                  angle: cAng, radius: 17,
                  dmg: Math.round(e.atk * 0.92),
                  color: "#A855F7", vfx: "psychic_core",
                  isSuction: true, statusEffect: "Confusion", statusChance: 0.30,
                  life: 3.6, rot: 0
                });
              });

              const waveCount = isEnraged ? 10 : 8;
              for (let pIdx = 0; pIdx < waveCount; pIdx++) {
                const pAng = (pIdx * Math.PI * 2) / waveCount + baseAng + e.bossVolleyCount * 0.24;
                this.enemyProjectiles.push({
                  x: e.x + Math.cos(pAng) * rim,
                  y: e.y + Math.sin(pAng) * rim,
                  vx: Math.cos(pAng) * 215, vy: Math.sin(pAng) * 215,
                  angle: pAng, radius: 10,
                  dmg: Math.round(e.atk * 0.68),
                  color: "#C084FC", vfx: "psy_wave",
                  statusEffect: "Confusion", statusChance: 0.22,
                  life: 3.0, rot: 0
                });
              }
            }

            // 5. 夢幻 (#151) —— 交替釋放「旋轉八瓣彩虹星花環」與「七彩高速星彈扇」
            else if (e.id === 151) {
              const rainbowColors = ["#EF4444", "#38BDF8", "#FACC15", "#22C55E", "#EC4899"];
              if (e.bossVolleyCount % 2 === 1) {
                const petalCount = isEnraged ? 12 : 8;
                const spinBase = e.bossVolleyCount * 0.42;
                for (let m = 0; m < petalCount; m++) {
                  const mAng = spinBase + (m * Math.PI * 2) / petalCount;
                  const spd = 205 + (m % 2) * 35;
                  this.enemyProjectiles.push({
                    x: e.x + Math.cos(mAng) * rim,
                    y: e.y + Math.sin(mAng) * rim,
                    vx: Math.cos(mAng) * spd, vy: Math.sin(mAng) * spd,
                    angle: mAng, radius: 9.5,
                    dmg: Math.round(e.atk * 0.62),
                    color: rainbowColors[m % rainbowColors.length], vfx: "rainbow_star",
                    statusEffect: m % 2 === 0 ? "Paralysis" : "Burn", statusChance: 0.20,
                    life: 3.2, rot: 0
                  });
                }
              } else {
                const mCount = isEnraged ? 9 : 7;
                for (let m = 0; m < mCount; m++) {
                  const spread = ((m / (mCount - 1)) - 0.5) * 0.92;
                  const mAng = baseAng + spread;
                  this.enemyProjectiles.push({
                    x: e.x + Math.cos(mAng) * rim,
                    y: e.y + Math.sin(mAng) * rim,
                    vx: Math.cos(mAng) * 240, vy: Math.sin(mAng) * 240,
                    angle: mAng, radius: 9.5,
                    dmg: Math.round(e.atk * 0.62),
                    color: rainbowColors[m % rainbowColors.length], vfx: "rainbow_star",
                    statusEffect: m % 2 === 0 ? "Paralysis" : "Burn", statusChance: 0.20,
                    life: 3.0, rot: 0
                  });
                }
              }
            }

            // 6. 非神獸小王與區域雙王：4 大職能流派專屬彈幕系統 (v7.3.8)
            else {
              const archKey = e.bossArchetype || (typeof getBossArchetypeKey === "function" ? getBossArchetypeKey(e.id, e.data) : "juggernaut");
              const t1 = e.data ? e.data.type1 : "Normal";
              const t2 = e.data ? e.data.type2 : "None";
              const spdBoost = isEnraged ? 1.12 : 1.0;

              if (archKey === "sniper") {
                // 疾風連射型：3 叉（半血 5 叉）高速扇形彈，半血再追加錯位二段連射
                const isPoison = (t1 === "Poison" || t2 === "Poison" || e.id === 15 || e.id === 24);
                const isStar = (e.id === 121 || t1 === "Electric");
                const vfx = isPoison ? "poison_orb" : (isStar ? "swift_star" : "wind_bullet");
                const col = isPoison ? "#A855F7" : (isStar ? "#FACC15" : "#818CF8");
                const stEff = isPoison ? "Poison" : (isStar ? "Paralysis" : "Confusion");
                const cnt = isEnraged ? 5 : 3;
                const arc = isEnraged ? 0.68 : 0.44;
                const spd = 235 * spdBoost;
                for (let k = 0; k < cnt; k++) {
                  const a = baseAng + ((k / (cnt - 1)) - 0.5) * arc;
                  this.enemyProjectiles.push({
                    x: e.x + Math.cos(a) * rim, y: e.y + Math.sin(a) * rim,
                    vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
                    angle: a, radius: 9, dmg: Math.round(e.atk * 0.68),
                    color: col, vfx, statusEffect: stEff, statusChance: 0.22,
                    life: 3.0, rot: 0
                  });
                }
                if (isEnraged) {
                  // 半血交錯二段慢速補彈
                  [-0.20, 0, 0.20].forEach(off => {
                    const a = baseAng + off;
                    this.enemyProjectiles.push({
                      x: e.x + Math.cos(a) * (rim - 6), y: e.y + Math.sin(a) * (rim - 6),
                      vx: Math.cos(a) * (spd * 0.78), vy: Math.sin(a) * (spd * 0.78),
                      angle: a, radius: 8.5, dmg: Math.round(e.atk * 0.62),
                      color: col, vfx, statusEffect: stEff, statusChance: 0.18,
                      life: 3.1, rot: 0
                    });
                  });
                }
              } else if (archKey === "toxic_zone") {
                // 毒霧封鎖型：6 向（半血 8 向）緩速旋轉擴散毒環／孢子波封鎖走位
                const isGrass = (t1 === "Grass");
                const isWater = (t1 === "Water");
                const vfx = isGrass ? "leaf_bullet" : (isWater ? "water_drop" : "poison_orb");
                const col = isGrass ? "#22C55E" : (isWater ? "#38BDF8" : "#A855F7");
                const stEff = isWater ? "Freeze" : "Poison";
                const ringCnt = isEnraged ? 8 : 6;
                const spinOff = e.bossVolleyCount * 0.36;
                const spd = 152 * spdBoost;
                for (let k = 0; k < ringCnt; k++) {
                  const a = spinOff + (k * Math.PI * 2) / ringCnt;
                  this.enemyProjectiles.push({
                    x: e.x + Math.cos(a) * rim, y: e.y + Math.sin(a) * rim,
                    vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
                    angle: a, radius: 9.5, dmg: Math.round(e.atk * 0.66),
                    color: col, vfx, statusEffect: stEff, statusChance: 0.28,
                    life: 3.3, rot: 0
                  });
                }
              } else if (archKey === "trickster") {
                // 念影詭術型：2 顆（半血 3 顆）左右分流恆速追蹤念力球／暗影球
                const cnt = isEnraged ? 3 : 2;
                const perpAng = baseAng + Math.PI * 0.5;
                const orbSpd = 148 * spdBoost;
                const col = (t1 === "Ghost") ? "#A855F7" : "#F472B6";
                for (let h = 0; h < cnt; h++) {
                  const sideFrac = cnt > 1 ? (h - (cnt - 1) / 2) : 0;
                  const hAng = baseAng + sideFrac * 0.62;
                  const lat = sideFrac * 24;
                  this.enemyProjectiles.push({
                    x: e.x + Math.cos(hAng) * (rim + 4) + Math.cos(perpAng) * lat,
                    y: e.y + Math.sin(hAng) * (rim + 4) + Math.sin(perpAng) * lat,
                    vx: Math.cos(hAng) * orbSpd, vy: Math.sin(hAng) * orbSpd,
                    initSpeed: orbSpd, turnRate: 2.0,
                    angle: hAng, radius: 11.5, dmg: Math.round(e.atk * 0.74),
                    color: col, vfx: "psy_wave", homing: true,
                    statusEffect: "Confusion", statusChance: 0.24,
                    life: 3.4, rot: 0
                  });
                }
              } else {
                // 重裝猛攻型：近中距 3 叉（半血 5 叉）重型衝擊波／水彈／冰柱，懲罰貼臉站樁
                const isIce = (t1 === "Ice" || t2 === "Ice");
                const isWater = (t1 === "Water" && !isIce);
                const vfx = isIce ? "frost_lance" : (isWater ? "water_drop" : "fire_spark");
                const col = isIce ? "#38BDF8" : (isWater ? "#0EA5E9" : "#F97316");
                const stEff = isIce ? "Freeze" : (isWater ? "Freeze" : "Burn");
                const cnt = isEnraged ? 5 : 3;
                const arc = isEnraged ? 0.80 : 0.52;
                const spd = 200 * spdBoost;
                for (let k = 0; k < cnt; k++) {
                  const a = baseAng + ((k / (cnt - 1)) - 0.5) * arc;
                  this.enemyProjectiles.push({
                    x: e.x + Math.cos(a) * rim, y: e.y + Math.sin(a) * rim,
                    vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
                    angle: a, radius: 10, dmg: Math.round(e.atk * 0.72),
                    color: col, vfx, statusEffect: stEff, statusChance: 0.22,
                    life: 2.6, rot: 0
                  });
                }
              }
            }
          }
        }
      }

      // 2. 精英怪地面預警招式 (獨立執行，不再阻斷遠程射擊)
      if (inView && e.isElite && !e.treasureType && !e.isBoss) {
        e.eliteTelegraphCd = (e.eliteTelegraphCd !== undefined ? e.eliteTelegraphCd : 1.1) - cdDt;
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
      const hitTrainer = tc && !(p.lungeTimer > 0) && (distToTrainer < e.radius + 5);

      if (!e.treasureType && (hitPoke || hitTrainer) && this.tryArenaPerfectDodge()) {
        continue;
      }

      if (!e.treasureType && (hitPoke || hitTrainer) && p.invulnTimer <= 0) {
        if (this.tryConsumeArenaShield()) continue;
        if (p.multiscaleReady) {
          this.triggerRoyalShieldBurst(false);
          continue;
        }
        if (this.debugGodMode) continue;
        // 【攜帶物：柔軟沙子】受到近戰攻擊時 25% 機率揚起沙塵使怪獸失誤！
        if (p.heldItems && p.heldItems["soft_sand"] && Math.random() < 0.25) {
          p.invulnTimer = 0.45;
          this.spawnParticleCluster(p.x, p.y, "#D97706", "#FDE68A", 14, "circle", 0.8);
          this.spawnItemProcFeedback("soft_sand", p.x, p.y - 28, "MISS", "柔軟沙子：沙塵閃避 MISS!", "#FDE047", "soft_sand");
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
        const rawContactDmg = Math.max(1, Math.round(e.atk * shieldMult * burnMod));
        const dmg = this.getArenaAdjustedIncomingDmg(rawContactDmg, "contact");
        p.hp -= dmg;
        this.recordPlayerHit(dmg);

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
          SoundFX.play("hurt");
        } else {
          p.whiteFlashTimer = 0.24; // 延長至 0.24s 扎實受創反饋
          this.camera.shakeTime = 0.18;
          this.camera.shakeMagnitude = 5.0;
          this.hitStopTimer = 0.05;
          this.spawnParticleCluster(p.x, p.y, "#EF4444", "#FFFFFF", 10, "star", 0.7);
          this.spawnFloatingText(p.x, p.y - 18, `-${dmg}`, "#EF4444", 15);
          SoundFX.play("hurt");
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

    let bPattern = BOSS_ATTACK_PATTERNS[enemy.id];
    const archKey = enemy.bossArchetype || (typeof getBossArchetypeKey === "function" ? getBossArchetypeKey(enemy.id, enemy.data) : null);
    if (!bPattern && archKey && typeof BOSS_ARCHETYPES !== "undefined" && BOSS_ARCHETYPES[archKey]) {
      bPattern = BOSS_ARCHETYPES[archKey];
    }
    if (!bPattern) bPattern = BOSS_ATTACK_PATTERNS.default_elite;
    const skillList = bPattern.skills;
    
    const skill = skillList[(enemy.bossAttackIdx || 0) % skillList.length];
    enemy.bossAttackIdx = ((enemy.bossAttackIdx || 0) + 1) % skillList.length;

    if (archKey === "juggernaut" && enemy.isBoss) {
      enemy.bossRecoveryTimer = 0.45;
    }

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
    } else if (skill.shape === "chase_triplet") {
      const cnt = skill.count || 3;
      const stepD = skill.stepDelay || 0.16;
      for (let k = 0; k < cnt; k++) {
        const leadDist = k * 42;
        this.telegraphs.push({
          shape: "circle",
          owner: enemy,
          x: p.x + Math.cos(angToPlayer) * leadDist + (Math.random() - 0.5) * 28,
          y: p.y + Math.sin(angToPlayer) * leadDist + (Math.random() - 0.5) * 28,
          radius: skill.radius || 45,
          timer: (skill.delay || 0.70) + k * stepD,
          maxTime: (skill.delay || 0.70) + k * stepD,
          dmg: baseDmg,
          color: skill.color || "#A855F7",
          isBoss: enemy.isBoss
        });
      }
    } else if (skill.shape === "domino_line") {
      const cnt = skill.count || 4;
      const stepDist = skill.stepDist || 58;
      const stepD = skill.stepDelay || 0.14;
      for (let step = 1; step <= cnt; step++) {
        this.telegraphs.push({
          shape: "circle",
          owner: enemy,
          x: enemy.x + Math.cos(angToPlayer) * (step * stepDist),
          y: enemy.y + Math.sin(angToPlayer) * (step * stepDist),
          radius: skill.radius || 44,
          timer: (skill.delay || 0.62) + (step - 1) * stepD,
          maxTime: (skill.delay || 0.62) + (step - 1) * stepD,
          dmg: baseDmg,
          color: skill.color || "#D97706",
          isBoss: enemy.isBoss
        });
      }
    } else if (skill.shape === "suction_flank") {
      this.telegraphs.push({
        shape: "circle",
        owner: enemy,
        x: p.x, y: p.y,
        radius: skill.radius || 58,
        timer: skill.delay || 0.82,
        maxTime: skill.delay || 0.82,
        dmg: baseDmg,
        isSuction: true,
        color: skill.color || "#A855F7",
        isBoss: enemy.isBoss
      });
      [-1, 1].forEach((side, idx) => {
        const perp = angToPlayer + side * (Math.PI / 2);
        this.telegraphs.push({
          shape: "circle",
          owner: enemy,
          x: p.x + Math.cos(perp) * 68,
          y: p.y + Math.sin(perp) * 68,
          radius: skill.flankRadius || 42,
          timer: (skill.delay || 0.82) + 0.16 + idx * 0.14,
          maxTime: (skill.delay || 0.82) + 0.16 + idx * 0.14,
          dmg: Math.round(baseDmg * 0.90),
          color: "#C084FC",
          isBoss: enemy.isBoss
        });
      });
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

  inferEnemyExplosionKind(tg) {
    const col = (tg.color || "").toUpperCase();
    const t1 = (tg.owner && tg.owner.data && tg.owner.data.type1) || "";
    const t2 = (tg.owner && tg.owner.data && tg.owner.data.type2) || "";
    if (col === "#FACC15" || t1 === "Electric" || t2 === "Electric") return "electric";
    if (col === "#38BDF8" || t1 === "Ice" || t2 === "Ice" || t1 === "Water" || t2 === "Water") return "ice_water";
    if (col === "#A855F7" || col === "#C084FC" || tg.isSuction || t1 === "Psychic" || t1 === "Ghost" || t1 === "Poison") return "psychic_ghost";
    return "fire_rock";
  },

  updateTelegraphs(dt) {
    const p = this.player;
    if (!this.enemyExplosions) this.enemyExplosions = [];
    if (!this.enemyDashes) this.enemyDashes = [];

    // 1. 更新敵方 3 層次屬性爆炸特效（獨立於我方技能透明度，永遠 100% 清晰）
    for (let i = this.enemyExplosions.length - 1; i >= 0; i--) {
      const ex = this.enemyExplosions[i];
      ex.timer -= dt;
      if (ex.timer <= 0) {
        this.enemyExplosions.splice(i, 1);
      }
    }

    // 2. 更新敵方 0.16s 高速實質衝鋒與殘影（修復殘影無限再生導致 Boss 抵達終點後卡死之 Bug）
    for (let i = this.enemyDashes.length - 1; i >= 0; i--) {
      const ds = this.enemyDashes[i];
      ds.timer += dt;
      const t = Math.min(1, ds.timer / ds.duration);
      const ease = 1 - Math.pow(1 - t, 2.2);
      const curX = ds.startX + (ds.endX - ds.startX) * ease;
      const curY = ds.startY + (ds.endY - ds.startY) * ease;

      // 僅在尚未落地前驅動怪獸座標，抵達終點 (impactDone) 後立即歸還移動權（鬥技場強制鎖在圍牆內）
      if (!ds.impactDone && ds.owner && ds.owner.hp > 0) {
        ds.owner.x = curX;
        ds.owner.y = curY;
        if (this.isArenaMode && typeof MapEngine !== "undefined") {
          MapEngine.resolveObstacleCollision(ds.owner, (ds.owner.radius || 36) * 0.85, false);
        }
        ds.owner.facingX = Math.cos(ds.angle) >= 0 ? 1 : -1;
      }

      if (t < 1 && (ds.spawnedAfterimages || 0) < 3 && t >= ((ds.spawnedAfterimages || 0) + 1) * 0.26) {
        ds.spawnedAfterimages = (ds.spawnedAfterimages || 0) + 1;
        ds.afterimages.push({
          x: curX, y: curY,
          facingX: Math.cos(ds.angle) >= 0 ? 1 : -1,
          life: 0.22, maxLife: 0.22
        });
        const dustCol2 = ds.explosionKind === "ice_water" ? "#E0F2FE" : (ds.explosionKind === "psychic_ghost" ? "#E9D5FF" : "#FEF08A");
        this.spawnParticleCluster(curX, curY + 12, ds.color || "#F59E0B", dustCol2, 4, ds.explosionKind === "ice_water" ? "diamond" : "circle", 0.55);
      }
      for (let a = ds.afterimages.length - 1; a >= 0; a--) {
        ds.afterimages[a].life -= dt;
        if (ds.afterimages[a].life <= 0) ds.afterimages.splice(a, 1);
      }

      if (t >= 1) {
        if (!ds.impactDone) {
          ds.impactDone = true;
          if (this.isArenaMode && ds.owner && ds.owner.isBoss) {
            ds.owner.arenaRecoveryTimer = 0.55;
          }
          const exKind = ds.explosionKind || "fire_rock";
          this.enemyExplosions.push({
            kind: exKind,
            shape: "circle",
            x: ds.endX, y: ds.endY,
            radius: Math.max(46, (ds.width || 40) * 1.35),
            color: ds.color || "#F59E0B",
            timer: 0.34, maxTime: 0.34,
            seed: Math.random() * 10
          });
          const pCol2 = exKind === "ice_water" ? "#E0F2FE" : "#FFFFFF";
          this.spawnParticleCluster(ds.endX, ds.endY, ds.color || "#F59E0B", pCol2, 12, exKind === "ice_water" ? "diamond" : "star", 0.95);
        }
        if (ds.afterimages.length === 0) {
          this.enemyDashes.splice(i, 1);
        }
      }
    }

    // 3. 更新敵方預警圈／環／跑道讀條
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
          this.spawnBossAt(tg.bossId, tg.x, tg.y, tg.isFinalMewtwo, !!tg.isDualBoss);
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
            let endX = tg.startX + Math.cos(tg.angle) * (tg.length * 0.88);
            let endY = tg.startY + Math.sin(tg.angle) * (tg.length * 0.88);
            if (this.isArenaMode && typeof MapEngine !== "undefined") {
              const pad = (tg.owner.radius || 44) * 0.9;
              endX = Math.max(-MapEngine.arenaHalfW + pad, Math.min(MapEngine.arenaHalfW - pad, endX));
              endY = Math.max(-MapEngine.arenaHalfH + pad, Math.min(MapEngine.arenaHalfH - pad, endY));
            }
            const sprUrl = tg.owner.data ? tg.owner.data.forward_sprite : null;
            this.enemyDashes.push({
              owner: tg.owner,
              spriteUrl: sprUrl,
              size: tg.owner.isBoss ? 120 : 88,
              startX: tg.owner.x,
              startY: tg.owner.y,
              endX, endY,
              angle: tg.angle,
              width: tg.width || 40,
              color: tg.color || "#F59E0B",
              explosionKind: this.inferEnemyExplosionKind(tg),
              timer: 0,
              duration: 0.16,
              impactDone: false,
              spawnedAfterimages: 0,
              afterimages: []
            });
          }
        } else if (tg.shape === "ring") {
          const d = Math.hypot(p.x - tg.x, p.y - tg.y);
          if (d <= tg.radius && d >= tg.innerRadius) hitPlayer = true;
        } else {
          const d = Math.hypot(p.x - tg.x, p.y - tg.y);
          if (d <= tg.radius) hitPlayer = true;
        }

        if (this.isArenaMode && tg.owner && tg.owner.isBoss && tg.shape !== "line") {
          tg.owner.arenaRecoveryTimer = Math.max(tg.owner.arenaRecoveryTimer || 0, 0.55);
        }

        if (hitPlayer && this.tryArenaPerfectDodge()) {
          // 完美閃避成功，略過傷害並保留特效
        } else if (hitPlayer && p.invulnTimer <= 0 && !this.debugGodMode) {
          if (this.tryConsumeArenaShield()) {
            this.telegraphs.splice(i, 1);
            continue;
          }
          if (p.heldItems && p.heldItems["soft_sand"] && Math.random() < 0.25) {
            p.invulnTimer = 0.45;
            this.spawnParticleCluster(p.x, p.y, "#D97706", "#FDE68A", 16, "circle", 0.9);
            this.spawnItemProcFeedback("soft_sand", p.x, p.y - 28, "MISS", "柔軟沙子：沙塵閃避 MISS!", "#FDE047", "soft_sand");
            this.telegraphs.splice(i, 1);
            continue;
          }
          const starLvCur = (this.saveData && this.saveData.pokemonStars && this.saveData.pokemonStars[this.selectedStarterId]) || 0;
          const starDrMult = Math.max(0.76, 1 - starLvCur * 0.06);
          const armorMult = (1 - (p.finalEvoArmor || 0)) * starDrMult;
          const dragonScaleMult = (p.heldItems && p.heldItems["dragon_scale"]) ? 0.85 : 1.0;
          const scarfBonus = (p.heldItems && p.heldItems["silk_scarf"]) ? 0.35 : 0;
          const rawTgDmg = Math.max(1, Math.round(tg.dmg * (p.shieldTimer > 0 ? 0.45 : 1.0) * armorMult * dragonScaleMult));
          const dmg = this.getArenaAdjustedIncomingDmg(rawTgDmg, "telegraph");
          p.hp -= dmg;
        this.recordPlayerHit(dmg);
          p.invulnTimer = 0.45 + scarfBonus;
          this.spawnFloatingText(p.x, p.y - 20, `重擊 -${dmg}`, "#DC2626", 15);
          SoundFX.play("hurt");
          if (p.hp <= 0) {
            p.hp = 0;
            this.triggerGameOver(false);
            return;
          }
        }

        // 觸發 3 層次屬性專屬爆破 + 微份量鏡頭震動（100% 獨立於我方技能透明度）
        if (tg.shape !== "line") {
          const exKind = this.inferEnemyExplosionKind(tg);
          const exX = tg.x;
          const exY = tg.y;
          const exR = tg.radius || 52;
          this.enemyExplosions.push({
            kind: exKind,
            shape: tg.shape || "circle",
            x: exX, y: exY,
            radius: exR,
            innerRadius: tg.innerRadius || 0,
            color: tg.color || "#EF4444",
            timer: 0.36, maxTime: 0.36,
            seed: Math.random() * 10
          });
          const pCol2 = exKind === "electric" ? "#FEF08A" : (exKind === "ice_water" ? "#E0F2FE" : (exKind === "psychic_ghost" ? "#E9D5FF" : "#FDE047"));
          this.spawnParticleCluster(exX, exY, tg.color || "#EF4444", pCol2, tg.isBoss ? 14 : 9, exKind === "ice_water" ? "diamond" : "star", 1.0);
          if (Math.hypot(p.x - exX, p.y - exY) < Math.max(this.width, this.height) * 0.65) {
            this.camera.shakeTime = Math.max(this.camera.shakeTime || 0, 0.12);
            this.camera.shakeMagnitude = Math.max(this.camera.shakeMagnitude || 0, tg.isBoss ? 2.5 : 1.6);
          }
        }

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

      // 追蹤彈恆速角速度轉向（與 dt 掛鉤並鎖定 initSpeed，徹底杜絕向量衰減卡死黏團！）
      if (ep.homing) {
        const baseSpd = ep.initSpeed || Math.max(125, Math.hypot(ep.vx, ep.vy));
        if (!ep.initSpeed) ep.initSpeed = baseSpd;
        const curAng = (ep.angle !== undefined) ? ep.angle : Math.atan2(ep.vy, ep.vx);
        const desired = Math.atan2(p.y - ep.y, p.x - ep.x);
        const diff = Math.atan2(Math.sin(desired - curAng), Math.cos(desired - curAng));
        const maxTurn = (ep.turnRate || 2.2) * dt;
        const nextAng = curAng + Math.max(-maxTurn, Math.min(maxTurn, diff));
        ep.angle = nextAng;
        ep.vx = Math.cos(nextAng) * baseSpd;
        ep.vy = Math.sin(nextAng) * baseSpd;
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

      if (this.isArenaMode && typeof MapEngine !== "undefined" && MapEngine.hitArenaPillar) {
        if (MapEngine.hitArenaPillar(ep.x, ep.y, Math.min(8, (ep.radius || 8) * 0.5))) {
          this.spawnParticleCluster(ep.x, ep.y, "#CBD5E1", ep.color || "#FACC15", 6, "circle", 0.7);
          this.enemyProjectiles[i] = this.enemyProjectiles[this.enemyProjectiles.length - 1];
          this.enemyProjectiles.pop();
          continue;
        }
      }

      // 檢查是否擊中主角精靈或隨行訓練家
      const distToPoke = Math.hypot(p.x - ep.x, p.y - ep.y);
      const distToTrainer = tc ? Math.hypot(tc.x - ep.x, tc.y - ep.y) : 999;
      const hitPoke = distToPoke < ep.radius + 14;
      const hitTrainer = tc && !(p.lungeTimer > 0) && (distToTrainer < ep.radius + 5);

      if ((hitPoke || hitTrainer) && this.tryArenaPerfectDodge()) {
        continue;
      }

      if ((hitPoke || hitTrainer) && p.invulnTimer <= 0) {
        if (this.tryConsumeArenaShield()) {
          this.enemyProjectiles.splice(i, 1);
          continue;
        }
        if (p.multiscaleReady) {
          this.triggerRoyalShieldBurst(false);
          this.enemyProjectiles.splice(i, 1);
          continue;
        }
        if (this.debugGodMode) continue;
        if (p.heldItems && p.heldItems["soft_sand"] && Math.random() < 0.25) {
          p.invulnTimer = 0.45;
          this.spawnParticleCluster(p.x, p.y, "#D97706", "#FDE68A", 14, "circle", 0.85);
          this.spawnItemProcFeedback("soft_sand", p.x, p.y - 28, "MISS", "柔軟沙子：沙塵閃避 MISS!", "#FDE047", "soft_sand");
          this.enemyProjectiles.splice(i, 1);
          continue;
        }
        const starLvCur = (this.saveData && this.saveData.pokemonStars && this.saveData.pokemonStars[this.selectedStarterId]) || 0;
        const starDrMult = Math.max(0.76, 1 - starLvCur * 0.06);
        const armorMult = (1 - (p.finalEvoArmor || 0)) * starDrMult;
        const dragonScaleMult = (p.heldItems && p.heldItems["dragon_scale"]) ? 0.85 : 1.0;
        const scarfBonus = (p.heldItems && p.heldItems["silk_scarf"]) ? 0.35 : 0;
        const shieldMult = (p.shieldTimer > 0 ? 0.45 : 1.0) * armorMult * dragonScaleMult;
        const rawProjDmg = Math.max(1, Math.round(ep.dmg * shieldMult));
        const dmg = this.getArenaAdjustedIncomingDmg(rawProjDmg, "bullet");
        p.hp -= dmg;
        this.recordPlayerHit(dmg);
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
          if (p.id === 10033 && (inflictedStatus === "Burn" || inflictedStatus === "Freeze")) {
            this.spawnFloatingText(p.x, p.y - 30, "🌺 厚脂肪免疫！", "#4ADE80", 12);
          } else {
            p.status = inflictedStatus;
          p.statusTimer = duration;
            const statusNames = { Poison: "中毒!", Paralysis: "麻痺!", Confusion: "混亂反向!", Freeze: "減速遲緩!", Burn: "灼傷!" };
            this.spawnFloatingText(p.x, p.y - 32, statusNames[inflictedStatus] || "異常!", "#F43F5E", 14);
          }
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
          SoundFX.play("hurt");
        } 
        // B. 精靈主角受創反饋 (強化版)
        else {
          p.whiteFlashTimer = 0.24; // 延長至 0.24s 扎實受創反饋
          this.camera.shakeTime = 0.18;
          this.camera.shakeMagnitude = 5.0;
          this.spawnFloatingText(p.x, p.y - 18, `-${dmg}`, "#EF4444", 15);
          this.spawnParticleCluster(ep.x, ep.y, ep.color || "#FFFFFF", "#EF4444", 10, "star", 0.7);
          SoundFX.play("hurt");
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
        // 火焰鳥大字炎巨彈飛達射程終點自動爆裂散射十字火星
        if (ep.canSplit) {
          const splitAngles = ep.isEnragedSplit ? [0, 0.785, 1.57, 2.356, 3.14, 3.927, 4.71, 5.498] : [0, Math.PI / 2, Math.PI, Math.PI * 1.5];
          splitAngles.forEach(sAng => {
            this.enemyProjectiles.push({
              x: ep.x, y: ep.y,
              vx: Math.cos(sAng) * 165, vy: Math.sin(sAng) * 165,
              angle: sAng, radius: 7, dmg: Math.round(ep.dmg * 0.45),
              color: "#F97316", vfx: "fire_spark",
              statusEffect: "Burn", statusChance: 0.25,
              life: 1.15, rot: 0
            });
          });
          this.spawnParticleCluster(ep.x, ep.y, "#EF4444", "#FEF08A", 8, "star", 0.9);
        }
        this.enemyProjectiles[i] = this.enemyProjectiles[this.enemyProjectiles.length - 1];
        this.enemyProjectiles.pop();
      }
    }
  },

  dealEnemySkillDamageToPlayer(rawDmg, moveType, bonusStatusChance = 0, knockback = 0) {
    const p = this.player;
    if (!p || p.hp <= 0 || p.invulnTimer > 0) return;
    if (p.multiscaleReady) {
      this.triggerRoyalShieldBurst(false);
      return;
    }
    if (this.debugGodMode) return;
    if (p.heldItems && p.heldItems["soft_sand"] && Math.random() < 0.25) {
      p.invulnTimer = 0.45;
      this.spawnParticleCluster(p.x, p.y, "#D97706", "#FDE68A", 14, "circle", 0.85);
      this.spawnItemProcFeedback("soft_sand", p.x, p.y - 28, "MISS", "柔軟沙子：沙塵閃避 MISS!", "#FDE047", "soft_sand");
      return;
    }
    const eff = calcTypeMultiplier(moveType, p.data.type1, p.data.type2);
    const starLvCur = (this.saveData && this.saveData.pokemonStars && this.saveData.pokemonStars[this.selectedStarterId]) || 0;
    const starDrMult = Math.max(0.76, 1 - starLvCur * 0.06);
    const armorMult = (1 - (p.finalEvoArmor || 0)) * starDrMult;
    const dragonScaleMult = (p.heldItems && p.heldItems["dragon_scale"]) ? 0.85 : 1.0;
    const shieldMult = (p.shieldTimer > 0 ? 0.45 : 1.0) * armorMult * dragonScaleMult;
    const dmg = Math.max(1, Math.round(rawDmg * eff * shieldMult));
    const scarfBonus = (p.heldItems && p.heldItems["silk_scarf"]) ? 0.35 : 0;
    p.hp -= dmg;
        this.recordPlayerHit(dmg);
    p.invulnTimer = 0.50 + scarfBonus;
    p.whiteFlashTimer = 0.22;
    this.camera.shakeTime = Math.max(this.camera.shakeTime || 0, 0.16);
    this.camera.shakeMagnitude = Math.max(this.camera.shakeMagnitude || 0, 4.5);
    this.spawnFloatingText(p.x, p.y - 20, `-${dmg}`, "#EF4444", 15);
    SoundFX.play("hurt");
    if (p.hp <= 0) {
      p.hp = 0;
      this.triggerGameOver(false);
    }
  },

  dealDamageToEnemy(enemy, rawDmg, moveType, bonusStatusChance = 0, knockback = 0, extraCritBonus = 0) {
    const eff = calcTypeMultiplier(moveType, enemy.data.type1, enemy.data.type2);
    const psychicCritBonus = (MapEngine.weather === "PSYCHIC" && (moveType === "Psychic" || moveType === "Ghost")) ? 0.15 : 0;
    // 【攜帶物：毒針】對處於中毒狀態的敵人額外暴擊率 +25%
    const pTrait = (this.player && this.player.innateTrait) ? this.player.innateTrait : {};
    const ironFistCrit = (["Fighting", "Normal", "Ground", "Rock"].includes(moveType)) ? (pTrait.ironFistCritBonus || 0) : 0;
    const psySurgeCrit = ((enemy.status === "Poison" || enemy.status === "Confusion") && pTrait.psychicStatusCritBonus) ? pTrait.psychicStatusCritBonus : 0;
    const martialGodCrit = (this.player.martialGodTimer > 0) ? 0.20 : 0;
    const poisonBarbCritBonus = (this.player.heldItems && this.player.heldItems["poison_barb"] && enemy.status === "Poison") ? 0.25 : 0;
    const dualSuperCritBonus = Object.values(this.player.skills || {}).filter(s => s.evolved).length >= 2 ? 0.08 : 0;
    const perfectCounterCrit = (this.player.arenaPerfectCounterTimer > 0) ? 0.25 : 0;
    const isCrit = Math.random() < (this.player.critRate + (this.player.buffTimer > 0 ? 0.25 : 0) + psychicCritBonus + poisonBarbCritBonus + dualSuperCritBonus + ironFistCrit + psySurgeCrit + martialGodCrit + perfectCounterCrit + (extraCritBonus || 0));
    // 【攜帶物：黑帶】暴擊傷害從 1.35x 提升至 1.75x
    const critMult = isCrit ? ((this.player.heldItems && this.player.heldItems["black_belt"]) ? 1.75 : 1.35) : 1.0;

    // v6.6 環境與戰術加法區（地圖 + 天氣 + 攜帶物屬性傷 + 力量強化 + 猛火龍威灼傷增傷）
    let stageBonus = 0;
    const stId = (typeof MapEngine !== "undefined" && MapEngine.currentStage) ? MapEngine.currentStage.id : "";
    if (stId === "pallet" && (moveType === "Grass" || moveType === "Bug")) stageBonus = 0.20;
    else if (stId === "cerulean_bay" && (moveType === "Water" || moveType === "Ice")) stageBonus = 0.20;
    else if (stId === "sky_pillar" && (moveType === "Psychic" || moveType === "Ghost")) stageBonus = 0.20;
    else if (stId === "cinnabar_volcano") {
      if (moveType === "Fire" || moveType === "Rock" || moveType === "Ground") stageBonus += 0.20;
      if (enemy && enemy.status === "Burn") stageBonus += 0.15;
    } else if (stId === "power_plant" && (moveType === "Electric" || moveType === "Steel" || moveType === "Poison")) {
      stageBonus = 0.20;
    }

    let weatherBonus = 0;
    const curW = (typeof MapEngine !== "undefined") ? MapEngine.weather : "CLEAR";
    if (curW === "RAIN") {
      if (moveType === "Water") weatherBonus = 0.25;
      else if (moveType === "Fire") weatherBonus = -0.20;
    } else if (curW === "HEATWAVE") {
      if (moveType === "Fire") weatherBonus = 0.25;
      else if (moveType === "Water") weatherBonus = -0.20;
    } else if (curW === "BLIZZARD" && moveType === "Ice") {
      weatherBonus = 0.20;
    } else if (curW === "THUNDER" && moveType === "Electric") {
      weatherBonus = 0.20;
    } else if (curW === "PSYCHIC" && (moveType === "Psychic" || moveType === "Ghost")) {
      weatherBonus = 0.20;
    }

    let heldBonus = 0;
    const hi = this.player && this.player.heldItems;
    if (hi) {
      const heldTypeMap = {
        Fire: "charcoal", Water: "mystic_water", Grass: "miracle_seed", Electric: "magnet",
        Ghost: "spell_tag", Psychic: "twisted_spoon", Ice: "never_melt_ice", Ground: "soft_sand",
        Fighting: "black_belt", Flying: "sharp_beak", Normal: "silk_scarf", Poison: "poison_barb", Dragon: "dragon_scale"
      };
      if (heldTypeMap[moveType] && hi[heldTypeMap[moveType]]) heldBonus = 0.20;
    }

    const xAtkBonus = (this.player.xAttackTimer > 0 ? 0.35 : 0) + (this.player.arenaFuryTimer > 0 ? 0.35 : 0) + (this.player.arenaPerfectCounterTimer > 0 ? 0.20 : 0);
    const dragonMawBonus = (enemy.status === "Burn" && pTrait.dragonMawBurnAmp) ? pTrait.dragonMawBurnAmp : 0;
    const envAddMult = Math.max(0.5, 1.0 + stageBonus + weatherBonus + heldBonus + xAtkBonus + dragonMawBonus);

    let finalDmg = Math.round(rawDmg * envAddMult * eff * critMult);
    if (enemy.arenaArmor) {
      finalDmg = Math.max(1, Math.round(finalDmg * (1 - enemy.arenaArmor)));
    }
    if (enemy.isBoss) {
      // Boss 滾動秒傷軟上限護盾（鬥技場高難度動態收緊防站樁秒殺）
      const softPct = enemy.arenaDpsCapPct || 0.12;
      const singleCap = Math.round(enemy.maxHp * Math.min(0.18, softPct * 1.4));
      const cappedRaw = Math.min(finalDmg, singleCap);
      const softLimit = enemy.maxHp * softPct;
      const curBucket = enemy.dpsBucket || 0;
      const fullRoom = Math.max(0, softLimit - curBucket);
      if (cappedRaw <= fullRoom) {
        finalDmg = cappedRaw;
        enemy.dpsBucket = curBucket + cappedRaw;
      } else {
        const overflow = cappedRaw - fullRoom;
        finalDmg = Math.max(1, Math.round(fullRoom + overflow * 0.30));
        enemy.dpsBucket = softLimit;
        enemy.dpsShieldFlashTimer = 0.28;
      }
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
      const isTrueLegend = !!(enemy.isLegendaryBoss || [144, 145, 146, 150, 151].includes(enemy.id));
      this.spawnParticleCluster(enemy.x, enemy.y, bCol, "#FDE047", isTrueLegend ? 32 : 20, "star", isTrueLegend ? 1.5 : 1.15);
      if (isTrueLegend) {
        this.showCutsceneBanner(
          `【⚡ BOSS 領域覺醒：${enemy.data.name_zh}】`,
          "生命跌破 50%！神獸解放狂暴姿態，攻速與彈幕全面強化！",
          3000
        );
        this.spawnFloatingText(enemy.x, enemy.y - 36, "🔥 狂暴領域覺醒 OVERDRIVE!!", "#FACC15", 15);
      } else {
        this.spawnFloatingText(enemy.x, enemy.y - 34, "🔥 狂暴加速！彈幕強化！", "#FB7185", 14);
      }

      // 覺醒氣浪將貼身玩家溫和震開 75px，給予反應空間並要求重新走位切入
      if (this.player && Math.hypot(this.player.x - enemy.x, this.player.y - enemy.y) < 180) {
        const pushAng = Math.atan2(this.player.y - enemy.y, this.player.x - enemy.x);
        this.player.x += Math.cos(pushAng) * 75;
        this.player.y += Math.sin(pushAng) * 75;
        MapEngine.resolveObstacleCollision(this.player, 18, true);
      }
    }

    this.skillDamageStats[moveType] = (this.skillDamageStats[moveType] || 0) + finalDmg;
    if (this.runStats) {
      this.runStats.totalHitsDealt += 1;
      if (eff > 1.1) this.runStats.superEffectiveHits += 1;
    }

    if (enemy.treasureType === "meowth") {
      this.runCoins += 8;
      this.saveData.coins += 8;
      SoundFX.play("coin");
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
        const badgeStBonus = (this.player && this.player.badgeStatusBonus) || 0;
        const rawChance = Math.max(0.03, tMeta.statusRate + spoonBonus + frostAuraBonus + badgeStBonus + (bonusStatusChance || 0) * 0.28);
        const finalChance = Math.min(isHardCC ? 0.30 : 0.44, rawChance * weightMod * tierMod * psyConfResist);

        if (Math.random() < finalChance) {
          if (isHardCC && enemy.ccImmunityTimer > 0) {
            if (enemy.isBoss || enemy.isElite) {
              this.spawnFloatingText(enemy.x, enemy.y - 20, "韌性抵抗!", "#CBD5E1", 11);
            }
          } else if (isHardCC) {
            if (this.runStats) this.runStats.statusProcs += 1;
            enemy.status = st;
            const durWeightMod = enemy.weightTier === "heavy" ? 0.72 : 1.0;
            const baseDur = (st === "Confusion") ? 1.8 : ((st === "Freeze") ? 2.2 : 2.8);
            const eliteDur = (st === "Confusion") ? 1.5 : 1.8;
            const bossDur = (st === "Confusion") ? 1.0 : 1.2;
            enemy.statusTimer = (enemy.isBoss ? bossDur : (enemy.isElite ? eliteDur : baseDur)) * durWeightMod;
            enemy.ccImmunityTimer = (st === "Confusion")
              ? (enemy.isBoss ? 4.5 : (enemy.isElite ? 4.0 : 3.2))
              : (enemy.isBoss ? 4.2 : (enemy.isElite ? 2.8 : (st === "Freeze" ? 1.4 : 1.8)));
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
              if (this.runStats) this.runStats.statusProcs += 1;
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
          this.spawnItemProcFeedback("twisted_spoon", enemy.x, enemy.y - 26, "", "🌀 念力混亂!", "#F472B6", "twisted_spoon");
        }
      }
    }

    const hasBlackBelt = !!(this.player.heldItems && this.player.heldItems["black_belt"]);
    const isPoisonCrit = isCrit && poisonBarbCritBonus > 0;
    const critPrefix = isPoisonCrit ? "劇毒暴擊" : (hasBlackBelt ? "極限暴擊" : "暴擊");
    let label = `${finalDmg}`;
    let col = "#FFFFFF";
    if (eff <= 0.40) {
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
    if (this.isExpeditionMode && typeof ModeExpedition !== "undefined" && ModeExpedition.onEnemyKilled) {
      ModeExpedition.onEnemyKilled(this, e);
    }
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
      this.spawnItemProcFeedback("spell_tag", e.x, e.y - 28, "", "👻 詛咒鬼火！", "#C084FC", "spell_tag");
    }

    const loadoutCoinMod = (this.player && this.player.loadoutCoinMult) ? this.player.loadoutCoinMult : 1.0;
    const endlessCoinMod = this.isEndlessMode ? 1.25 : 1.0;
    const diffCoinMult = this.selectedDifficulty.coinMult * MapEngine.currentStage.rewardMult * (1 + (this.saveData.upgrades.greed || 0) * 0.15) * loadoutCoinMod * endlessCoinMod * ((this.player && this.player.badgeCoinMult) || 1.0);

    if (e.isShiny) {
      this.saveData.shinyUnlocked[e.id] = true;
      SoundFX.play("shiny");
      this.showCutsceneBanner(`[閃光登錄] 成功收服【閃光・${e.data.name_zh}】！`, "已永久登錄圖鑑，可於選角處自由切換！", 3000);
    }

    const hasActiveMagnet = this.mapItems.some(it => it.id === "magnet");
    if (e.treasureType && this.runStats) this.runStats.treasuresKilled += 1;
    if (e.treasureType === "meowth") {
      const jackpot = Math.round(180 * diffCoinMult);
      this.runCoins += jackpot;
      this.saveData.coins += jackpot;
      SoundFX.play("levelup");
      if (!hasActiveMagnet && Math.random() < 0.45) {
        this.spawnMapLoot("magnet", e.x + 22, e.y);
      }
      this.spawnFloatingText(e.x, e.y - 20, `聚寶功大爆代幣 +${jackpot}!`, "#F59E0B", 16);
    } else if (e.treasureType === "chansey") {
      SoundFX.play("levelup");
      this.spawnMapLoot("rare_candy", e.x - 18, e.y);
      this.spawnMapLoot("partner_ball", e.x + 18, e.y);
      if (!hasActiveMagnet && Math.random() < 0.45) {
        this.spawnMapLoot("magnet", e.x, e.y + 22);
      }
      this.spawnFloatingText(e.x, e.y - 20, `幸福吉利蛋掉落神奇糖果＆治癒球!`, "#EC4899", 15);
    }

    if (e.isElite && !e.isBoss) {
      // P3 精英小王擊破微頓幀 (斬肉頓幀感 Hit-Stop)
      this.hitStopTimer = Math.max(this.hitStopTimer || 0, 0.035);
      this.spawnParticleCluster(e.x, e.y, "#FACC15", "#EF4444", 18, "star", 1.15);
      if (!e.noEliteDrop) {
        const dropId = e.guaranteedRareCandy ? "rare_candy" : (this.isExpeditionMode ? (Math.random() < 0.65 ? "rare_candy" : "partner_ball") : (Math.random() < 0.22 ? "partner_ball" : "rare_candy"));
        this.spawnMapLoot(dropId, e.x, e.y);
        if (!hasActiveMagnet && Math.random() < 0.25) {
          this.spawnMapLoot("magnet", e.x + 26, e.y);
        }
      }
    }

    if (e.isBoss) {
      // 神獸討伐儀式：立即淨空全場殘留敵彈與紅圈（杜絕贏王後被殘彈反殺）
      this.enemyProjectiles = [];
      this.telegraphs = this.telegraphs.filter(tg => tg.isBossWarning);
      this.hitStopTimer = 0.08;
      this.killSlowmoTimer = 0.60;
      this.camera.shakeTime = 0.52;
      this.camera.shakeMagnitude = 14;
      SoundFX.play("ultimate");

      // 啟動 0.85 秒神獸白光閃爍膨脹 ➔ 漫天金星炸裂討伐演出
      if (!this.bossDeathAnims) this.bossDeathAnims = [];
      this.bossDeathAnims.push({
        id: e.id,
        data: e.data,
        x: e.x,
        y: e.y,
        facingX: e.facingX || -1,
        color: TYPE_COLORS[e.data.type1] || "#FACC15",
        timer: 0,
        duration: 0.85
      });

      this.activeBoss = this.enemies.find(x => x.isBoss && x.hp > 0) || null;
      if (!this.activeBoss) {
        this.bossWeatherLock = false;
        MapEngine.setWeather("CLEAR");
        this.updateWeatherUI("CLEAR");
        SoundFX.startBgm("battle");
        document.getElementById("bossHudContainer").classList.add("hidden");
      }
      if (this.activeMode && typeof this.activeMode.onBossDefeated === "function" && this.activeMode.onBossDefeated(this, e)) {
        return;
      }
      this.spawnMapLoot("evo_chest", e.x, e.y);
      this.spawnMapLoot("rare_candy", e.x + 28, e.y);

      if ([144, 145, 146].includes(e.id)) {
        this.saveData.stats.birdsDefeated += 1;
        this.showCutsceneBanner(`【⚡ 傳說討伐：${e.data.name_zh} 敗退！】`, "天象恢復平靜！快拾取黃金進化寶箱與粉紅經驗晶群！", 2600);
        // 困難與地獄模式下，擊敗 5 分鐘三聖鳥額外保底贈予 1 件對應當前招式的超武攜帶物！
        if (this.selectedDifficulty && (this.selectedDifficulty.id === "hard" || this.selectedDifficulty.id === "hell")) {
          const p = this.player;
          const learnedTypes = new Set(Object.values(p.skills).map(s => SKILLS_CATALOG[s.id]?.type));
          const unownedHeld = Object.values(HELD_ITEMS).filter(hi => {
            const targetSk = SKILLS_CATALOG[hi.skillReq];
            return targetSk && learnedTypes.has(targetSk.type) && !p.heldItems[hi.id];
          });
          const curHeldCnt = Object.keys(p.heldItems || {}).filter(k => p.heldItems[k]).length;
          if (unownedHeld.length > 0 && curHeldCnt < 4) {
            const gift = unownedHeld[0];
            p.heldItems[gift.id] = true;
            p.dmgMult += 0.06;
            this.spawnFloatingText(p.x, p.y - 36, `🎁 神鳥遺寶：獲得【${gift.name}】！`, "#C084FC", 15);
          }
        }
      } else if (e.id === 150) {
        this.saveData.stats.mewtwoDefeated += 1;
        this.saveData.unlockedTrainers["red"] = true;
        this.saveToStorage();
        if (!this.secretMewSpawned) {
          this.secretMewSpawned = true;
          // 擊敗超夢後給予 4.5 秒喘息與回收寶箱期，再華麗降臨始祖夢幻 #151！
          this.pendingMewTimer = 4.5;
          if (this.player) {
            this.player.hp = Math.min(this.player.maxHp, this.player.hp + Math.round(this.player.maxHp * 0.60));
            this.player.trainerSkillCd = 0;
            this.spawnFloatingText(this.player.x, this.player.y - 32, "✨ 冠軍祝福：HP +60% ＆ 大招重置！", "#34D399", 15);
          }
          this.showCutsceneBanner(
            "[超夢敗退] 解鎖冠軍【赤紅 Red】！",
            "已回復 60% HP ＆ 大招重置！把握 4.5 秒回收寶箱，始祖氣息正在逼近……",
            4000
          );
        }
      } else if (e.id === 151) {
        this.saveData.stats.mewDefeated += 1;
        this.saveToStorage();
        if (this.isEndlessMode) {
          const bonusCoins = Math.round(350 * diffCoinMult);
          this.runCoins += bonusCoins;
          this.saveData.coins += bonusCoins;
          this.endlessNextBossTime = Math.max(this.endlessNextBossTime || 480, Math.floor(this.runTime) + 95);
          if (this.player) {
            this.player.hp = Math.min(this.player.maxHp, this.player.hp + Math.round(this.player.maxHp * 0.50));
          }
          this.showCutsceneBanner(
            "【♾️ 始祖夢幻討伐成功・無盡深淵繼續！】",
            `獲得深淵賞金 +${bonusCoins} 代幣 ＆ 回復 50% HP！下輪深淵天災即將來襲！`,
            3800
          );
        } else {
          // 標準模式：啟動 2.4 秒冠軍加冕勝利儀式（全屏淨化、無敵防反殺、煙火與歡呼），絕不秒跳結算！
          this.startVictoryCeremony();
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
      const capComp = this.getEffectiveMobCap(this.runTime / 60) <= 135 ? 1.20 : 1.0;
      const diffExpBal = (this.selectedDifficulty && this.selectedDifficulty.id !== "casual") ? 0.92 : 1.0;
      this.gems.push({ x: e.x, y: e.y, val: Math.max(10, Math.round(15 * capComp * diffExpBal)), tier: 1, size: 6.2, color: "#0284C7", innerColor: "#BAE6FD" });
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

    const bossWaveBonus = (e.isBoss && e.endlessRewardMult) ? e.endlessRewardMult : 1.0;
    const coinGain = Math.max(1, Math.round((e.isBoss ? 120 : (e.isElite ? 22 : 2)) * diffCoinMult * bossWaveBonus));
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
        if (this.saveData && this.saveData.stats) {
          this.saveData.stats.gemsCollected = (this.saveData.stats.gemsCollected || 0) + 1;
        }
        this.runGemsCollected = (this.runGemsCollected || 0) + 1;
        this.lastGemCollectTime = this.runTime || 0;
        this.gemGuideActive = false;
        SoundFX.play("gem");
        this.gainExp(g.val);
      }
    }

    for (let i = this.mapItems.length - 1; i >= 0; i--) {
      const it = this.mapItems[i];
      if (it.id === "poke_mart") continue; // 商店絕不被碰撞拾取邏輯刪除

      let distToItem = Math.hypot(p.x - it.x, p.y - it.y);
      if (it.magnetized) {
        const d = distToItem || 1;
        const flySpd = 560;
        it.x += ((p.x - it.x) / d) * flySpd * dt;
        it.y += ((p.y - it.y) / d) * flySpd * dt;
        distToItem = Math.hypot(p.x - it.x, p.y - it.y);
      } else {
        // 經驗磁鐵走遠超過 1200px 直接回收清除，不再強制瞬移尾隨；重要寶箱/糖果才自動折疊
        if (it.id === "magnet" && distToItem > 1200) {
          this.mapItems.splice(i, 1);
          continue;
        }
        if (distToItem > 1400) {
          const rAng = Math.random() * Math.PI * 2;
          it.x = p.x + Math.cos(rAng) * 340;
          it.y = p.y + Math.sin(rAng) * 340;
          continue;
        }
      }

      it.bobPhase += dt * 4;
      if (distToItem < 32) {
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
          sk.ultMaxCd = 10.0;
          sk.ultTimer = 0.4;
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
    const expModeMod = this.isExpeditionMode ? 1.25 : 1.0;
    const expMult = (this.selectedTrainer.mods.expMult || 1.0) * (1 + (this.saveData.upgrades.greed || 0) * 0.12) * (1 + (p.underdogExpBonus || 0)) * expModeMod;
    p.exp += amount * expMult;
    if (p.exp >= p.nextExp) {
      p.exp -= p.nextExp;
      p.level += 1;
      p.nextExp = Math.round(p.nextExp * 1.22 + 14);
      SoundFX.play("levelup");

      // 每次升級附帶輕量生命回復 (+10% 最大 HP)，提升續航手感與正回饋
      if (p.hp < p.maxHp) {
        const lvlHeal = Math.max(4, Math.round(p.maxHp * 0.10 * (p.badgeHealMult || 1.0)));
        p.hp = Math.min(p.maxHp, p.hp + lvlHeal);
        this.spawnFloatingText(p.x, p.y - 24, `升級回復 +${lvlHeal} HP`, "#34D399", 12);
      }

      // 若達到進化等級，先記錄待執行的進化目標，優先彈出「升級三選一」，選完後緊接著播放進化光影演出！
      if (!this._pendingEvolutionTarget) {
        if (p.data.evo_level !== "None" && p.level >= p.data.evo_level) {
          if (p.id === 133) {
            this._pendingEvolutionTarget = "eevee";
          } else if (p.data.evo_to) {
            this._pendingEvolutionTarget = p.data.evo_to;
          }
        } else if (p.id >= 144 && p.id < 10000 && ((p.level >= 12 && !p.legendaryAwaken12) || (p.level >= 24 && !p.legendaryAwaken24))) {
          this._pendingEvolutionTarget = "awaken_legendary";
        } else if (p.isPureSingleStage && p.level >= 18 && !p.singleStageAwakened) {
          this._pendingEvolutionTarget = "awaken_single";
        }
      }

      // AREA CLEAR 期間延後彈出升級三選一，確保玩家看清楚 AREA CLEAR 印章與吸晶演出
      if (this._deferLevelUpDuringClear) {
        this._deferredLevelUps = (this._deferredLevelUps || 0) + 1;
        return;
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
    const savedEvolved = oldSkills.slice(0, 3).map(s => !!s.evolved);
    const tmSkill = oldSkills[3] || null;

    // 三選一已於進化前完成，此處 openLevelUpAfter 設為 false 避免重複彈窗
    this.startEvolutionMoment(targetId, false, () => {
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
        const wasEvolved = !!savedEvolved[idx];
        const newMeta = SKILLS_CATALOG[sId];
        if (wasEvolved && newMeta && newMeta.reqItem && !p.heldItems[newMeta.reqItem]) {
          p.heldItems[newMeta.reqItem] = true;
        }
        p.skills[sId] = {
          id: sId,
          level: Math.max(minLv, savedLevels[idx] || 1),
          evolved: wasEvolved,
          timer: 0.2 + idx * 0.15
        };
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
  startAwakeningMoment(kind = "single") {
    const p = this.player;
    if (!p) return;

    this.touchJoy.active = false;
    this.touchJoy.dx = 0;
    this.touchJoy.dy = 0;
    const joyBase = document.getElementById("touchJoyBase");
    const joyStick = document.getElementById("touchJoyStick");
    if (joyBase) joyBase.style.display = "none";
    if (joyStick) joyStick.style.display = "none";

    this.evoSequence = {
      active: true,
      isAwakening: true,
      awakenKind: kind,
      timer: 0,
      duration: 1.35,
      burstAt: 0.72,
      oldData: p.data,
      nextData: p.data,
      evolvedApplied: false,
      openLevelUpAfter: false
    };

    this.state = "EVOLVING";
    SoundFX.play("super");
  },

  startEvolutionMoment(targetId, openLevelUpAfter = true, onEvolvedCallback = null, isMega = false) {
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

    const megaFlag = !!isMega || !!(nextData && nextData.isMega);
    this.evoSequence = {
      active: true,
      isMega: megaFlag,
      timer: 0,
      duration: megaFlag ? 2.10 : 1.85,
      burstAt: megaFlag ? 1.50 : 1.35,
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

    const burstTime = seq.isAwakening ? (seq.burstAt || 0.72) : (seq.isMega ? (seq.burstAt || 1.50) : 1.35);
    // 在破殼／覺醒爆發瞬間正式套用數值並炸開漫天金星與震退波
    if (seq.timer >= burstTime && !seq.evolvedApplied) {
      seq.evolvedApplied = true;
      const p = this.player;
      if (seq.isAwakening && p) {
        if (seq.awakenKind === "legendary") {
          if (p.level >= 12 && !p.legendaryAwaken12) p.legendaryAwaken12 = true;
          else if (p.level >= 24 && !p.legendaryAwaken24) p.legendaryAwaken24 = true;
          p.maxHp = Math.round(p.maxHp * 1.22);
          p.hp = p.maxHp;
          p.dmgMult *= 1.14;
          p.finalEvoArmor = 0.12;
          p.invulnTimer = Math.max(p.invulnTimer || 0, 1.4);
          this.spawnParticleCluster(p.x, p.y, "#FACC15", "#EC4899", 36, "star", 1.4);
        } else {
          p.singleStageAwakened = true;
          if (typeof getPokemonInnateTrait === "function") {
            p.innateTrait = getPokemonInnateTrait(p.data, p.level);
          }
          p.maxHp = Math.round(p.maxHp * 1.22);
          p.hp = p.maxHp;
          p.dmgMult *= 1.15;
          p.areaMult *= 1.08;
          p.finalEvoArmor = 0.12;
          p.invulnTimer = Math.max(p.invulnTimer || 0, 1.4);
          this.spawnParticleCluster(p.x, p.y, "#38BDF8", "#FACC15", 38, "star", 1.4);
        }
        SoundFX.play("levelup");
      } else {
        this.evolvePlayerPokemon(seq.targetId);
        if (typeof seq.onEvolvedCallback === "function") {
          seq.onEvolvedCallback();
        }
      }
      this.camera.shakeTime = 0.32;
      this.camera.shakeMagnitude = 9;

      // 釋放 175px 覺醒保護震波，將周圍怪群震退 120px 防止時空恢復瞬間被貼臉圍毆
      if (p) {
        const evoCol = seq.isAwakening
          ? (seq.awakenKind === "legendary" ? "#EC4899" : "#38BDF8")
          : (TYPE_COLORS[seq.nextData.type1] || "#FACC15");
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
      const finishedTargetId = seq.targetId;
      const wasMega = !!seq.isMega;
      const wasAwaken = !!seq.isAwakening;
      this.evoSequence = null;
      this.refreshHUD();

      // 進化完成後檢查是否達成手動 MEGA 雙重門檻（不再自動強制變身，改為點亮右下角 💎 MEGA 按鍵）
      this.checkMegaEvolutionReady();

      if (shouldOpenLvl) {
        this.openLevelUpModal();
      } else if ((this._deferredLevelUps || 0) > 0) {
        this._deferredLevelUps -= 1;
        this.openLevelUpModal();
      } else if (this._pendingExpeditionIntermission && typeof ModeExpedition !== "undefined") {
        this._pendingExpeditionIntermission = false;
        ModeExpedition.openIntermissionModal(this);
      } else {
        this.state = "PLAYING";
      }
    }
  },

  evolvePlayerPokemon(targetId) {
    const p = this.player;
    const nextData = POKEMON_MAP.get(targetId);
    if (!nextData) return;
    const oldName = p.data.name_zh;
    const isMegaForm = !!(nextData.isMega || nextData.id >= 10000);
    const isFinalForm = !isMegaForm && (nextData.evo_level === "None" || !nextData.evo_to);
    const hpBoostMult = isMegaForm ? (nextData.hpBoost || 1.25) : (isFinalForm ? 1.42 : 1.28);

    p.id = nextData.id;
    p.data = nextData;
    p.underdogExpBonus = 0;
    p.maxHp = Math.round(p.maxHp * hpBoostMult);
    p.hp = p.maxHp;
    p.invulnTimer = Math.max(p.invulnTimer || 0, 1.8);
    p.dmgMult *= isMegaForm ? (nextData.dmgBoost || 1.18) : (isFinalForm ? 1.18 : 1.12);
    if (isMegaForm) {
      p.megaEvolved = true;
      p.finalEvoArmor = nextData.armor || 0.16;
      p.areaMult *= 1.08;
      if (nextData.critBoost) p.critRate = (p.critRate || 0.10) + nextData.critBoost;
      if (nextData.speedBoost) p.speedMult = (p.speedMult || 1.0) * nextData.speedBoost;
      if (!this.saveData.megaUnlocked) this.saveData.megaUnlocked = {};
      this.saveData.megaUnlocked[nextData.baseId || 6] = true;
      const isBondMega = !!(this.selectedTrainer && (nextData.bondTrainerIds || []).includes(this.selectedTrainer.id));
      if (isBondMega) {
        const bCol = nextData.burstColor || "#38BDF8";
        const bType = nextData.burstType || "Dragon";
        const bText = nextData.burstText || "💎 鑰石共鳴爆發！";
        SkillsEngine.meleeEffects.push({
          style: "slam_wave",
          x: p.x, y: p.y,
          radius: 235 * p.areaMult,
          timer: 0.52, maxTime: 0.52,
          color: bCol
        });
        this.spawnParticleCluster(p.x, p.y, bCol, "#FEF08A", 36, "star", 1.5);
        [...SkillsEngine.getEnemiesInRadius(p.x, p.y, 235 * p.areaMult)].forEach(en => {
          if (en && en.hp > 0 && Math.hypot(en.x - p.x, en.y - p.y) <= 235 * p.areaMult + en.radius) {
            this.dealDamageToEnemy(en, (p.baseAtk * 1.8 + 60) * p.dmgMult, bType, 0.55, en.isBoss ? 0 : 28);
            if ((nextData.id === 10033 || nextData.id === 10038) && !en.status) {
              en.status = nextData.id === 10038 ? "Confusion" : "Poison";
              en.statusTimer = en.isBoss ? 2.2 : 4.0;
              en.statusTick = 0.35;
            } else if ((nextData.id === 10036 || nextData.id === 10041) && !en.isBoss) {
              en.inFrostAura = true;
            }
          }
        });
        this.spawnFloatingText(p.x, p.y - 38, bText, bCol, 15);
      }
    } else if (isFinalForm) {
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
    if (nextData.id <= 151) {
      this.saveData.pokedexSeen[nextData.id] = true;
      this.saveData.pokedexCaught[nextData.id] = true;
      this.saveData.unlockedPokemon[nextData.id] = true;
    }
    this.saveToStorage();

    SoundFX.play("levelup");
    this.spawnParticleCluster(p.x, p.y, "#F59E0B", "#FFFFFF", 44, "star", 1.5);
    const traitLabel = p.innateTrait ? ` ‧ 特性【${p.innateTrait.name}】進階強化！` : "！";
    const evoBannerSub = isFinalForm
      ? `【最終完全體覺醒】HP上限 ${p.maxHp}、全傷+18%、12%霸體${traitLabel}`
      : `生命上限提升至 ${p.maxHp}、全傷+12% 並回滿狀態${traitLabel}`;
    this.showCutsceneBanner(`[進化之光] ${oldName} 進化成了【${nextData.name_zh}】！`, evoBannerSub, 3400);
  },

  updateBossDeathAnims(dt) {
    if (!this.bossDeathAnims || this.bossDeathAnims.length === 0) return;
    for (let i = this.bossDeathAnims.length - 1; i >= 0; i--) {
      const ba = this.bossDeathAnims[i];
      ba.timer += dt;
      if (Math.random() < 0.55) {
        const ang = Math.random() * Math.PI * 2;
        const r = 20 + Math.random() * 44;
        this.spawnParticleCluster(ba.x + Math.cos(ang) * r, ba.y + Math.sin(ang) * r, ba.color, "#FFFFFF", 3, "star", 1.1);
      }
      if (ba.timer >= ba.duration) {
        this.spawnParticleCluster(ba.x, ba.y, "#FACC15", "#FFFFFF", 42, "star", 1.85);
        this.spawnParticleCluster(ba.x, ba.y, ba.color, "#FEF08A", 24, "star", 1.45);
        SkillsEngine.meleeEffects.push({
          style: "slam_wave",
          x: ba.x,
          y: ba.y,
          radius: 190,
          timer: 0.45,
          maxTime: 0.45,
          color: ba.color
        });
        SoundFX.play("levelup");
        this.bossDeathAnims.splice(i, 1);
      }
    }
  },

  startVictoryCeremony() {
    const p = this.player;
    this.victoryCeremony = {
      active: true,
      timer: 0,
      duration: 2.4,
      fireworkTimer: 0.12
    };
    if (p) {
      p.invulnTimer = 5.0;
      p.status = null;
      p.statusTimer = 0;
      p.hp = p.maxHp;
    }
    // 全屏淨化：將場上殘留所有小怪化為金色星塵
    this.enemies.forEach(en => {
      this.spawnParticleCluster(en.x, en.y, "#FACC15", "#FFFFFF", 6, "star", 1.1);
    });
    this.enemies = [];
    this.enemyProjectiles = [];
    this.telegraphs = [];
    this.arenaPowerups = [];
    this.activeBoss = null;
    this.bossWeatherLock = false;
    MapEngine.setWeather("CLEAR");
    this.updateWeatherUI("CLEAR");
    document.getElementById("bossHudContainer").classList.add("hidden");
    SoundFX.play("levelup");
    setTimeout(() => SoundFX.play("shiny"), 320);
    this.showCutsceneBanner(
      "🏆 關都傳說制霸！CHAMPION!",
      "始祖夢幻已討伐！全場淨化，正在為關都新冠軍加冕……",
      2400
    );
  },

  updateVictoryCeremony(dt) {
    const vc = this.victoryCeremony;
    if (!vc || !vc.active) return;
    vc.timer += dt;
    vc.fireworkTimer -= dt;
    const p = this.player;
    if (p) {
      p.invulnTimer = 5.0;
      p.status = null;
      p.jumpY = -Math.abs(Math.sin(vc.timer * 10.5)) * 12;
    }
    if (this.trainerCompanion) {
      this.trainerCompanion.jumpY = -Math.abs(Math.sin(vc.timer * 10.5 + 0.6)) * 11;
    }
    if (vc.fireworkTimer <= 0 && p) {
      vc.fireworkTimer = 0.30;
      const rainbow = ["#FACC15", "#F472B6", "#38BDF8", "#4ADE80", "#C084FC"];
      const ang = Math.random() * Math.PI * 2;
      const dist = 65 + Math.random() * 115;
      const c1 = rainbow[Math.floor(Math.random() * rainbow.length)];
      const c2 = "#FFFFFF";
      this.spawnParticleCluster(p.x + Math.cos(ang) * dist, p.y + Math.sin(ang) * dist, c1, c2, 18, "star", 1.45);
      SoundFX.play("gem");
    }
    if (vc.timer >= vc.duration) {
      vc.active = false;
      this.victoryCeremony = null;
      if (p) p.jumpY = 0;
      if (this.trainerCompanion) this.trainerCompanion.jumpY = 0;
      this.triggerGameOver(true);
    }
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
    if (this.iconPopups) {
      for (let i = this.iconPopups.length - 1; i >= 0; i--) {
        const ip = this.iconPopups[i];
        ip.age += dt;
        ip.y -= 24 * dt;
        ip.life -= dt;
        if (ip.life <= 0) this.iconPopups.splice(i, 1);
      }
    }
  },

  triggerHeldItemHudPulse(itemId) {
    if (!itemId) return;
    const el = document.querySelector(`#hudHeldItemList [data-held-id="${itemId}"]`);
    if (!el) return;
    el.classList.remove("held-item-proc-pulse");
    void el.offsetWidth;
    el.classList.add("held-item-proc-pulse");
  },

  spawnItemProcFeedback(itemId, x, y, shortLabel = "", fullText = "", color = "#FACC15", throttleKey = null, customSpriteUrl = null) {
    if (itemId) this.triggerHeldItemHudPulse(itemId);
    const mode = (this.saveData && this.saveData.settings && this.saveData.settings.procNoticeMode) || "icon";
    if (mode === "off") return;
    if (mode === "text") {
      if (fullText) this.spawnFloatingText(x, y, fullText, color, 13);
      return;
    }

    const nowMs = performance.now();
    if (!this._procThrottleMap) this._procThrottleMap = {};
    const tKey = throttleKey || itemId || shortLabel;
    const minInterval = (tKey === "spell_tag" || tKey === "twisted_spoon") ? 450 : 180;
    if (this._procThrottleMap[tKey] && (nowMs - this._procThrottleMap[tKey]) < minInterval) return;
    this._procThrottleMap[tKey] = nowMs;

    const hiMeta = (itemId && typeof HELD_ITEMS !== "undefined") ? HELD_ITEMS[itemId] : null;
    const spriteUrl = customSpriteUrl || (hiMeta ? hiMeta.sprite : null);
    if (!this.iconPopups) this.iconPopups = [];

    // 水平防重疊錯位：若同時觸發多個氣泡，自動左右微錯開 24px
    const offsets = [0, 24, -24, 44, -44];
    let chosenX = x;
    for (let oi = 0; oi < offsets.length; oi++) {
      const candX = x + offsets[oi];
      const clash = this.iconPopups.some(ip => Math.abs(ip.x - candX) < 20 && Math.abs(ip.y - y) < 22);
      if (!clash) { chosenX = candX; break; }
    }

    if (this.iconPopups.length > 10) this.iconPopups.shift();
    this.iconPopups.push({
      x: chosenX,
      y,
      spriteUrl,
      label: shortLabel || "",
      color,
      age: 0,
      life: 0.72,
      maxLife: 0.72
    });
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
    // 簡易垂直防重疊偏移：避免訓練家受創與傷害數字疊在同一行
    let adjY = y;
    for (let pass = 0; pass < 3; pass++) {
      const clash = this.floatingTexts.some(ft => Math.abs(ft.x - x) < 58 && Math.abs(ft.y - adjY) < 16);
      if (!clash) break;
      adjY -= 16;
    }
    const ftMax = this.isMobileDevice() ? 18 : 32;
    if (this.floatingTexts.length > ftMax) this.floatingTexts.shift();
    this.floatingTexts.push({ x, y: adjY, text, color, size, life: 0.72 });
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
      const rBox = document.getElementById("endHexRatingBox");
      if (rBox) rBox.classList.add("hidden");
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
    if (!this.isEndlessMode && !this.isArenaMode && !this.isExpeditionMode && this.saveData && this.saveData.stats) {
      this.saveData.stats.bestStandardTime = Math.max(this.saveData.stats.bestStandardTime || 0, Math.floor(this.runTime || 0));
      if (isVictory && MapEngine.currentStage && MapEngine.currentStage.id) {
        if (!this.saveData.stats.clearedStages) this.saveData.stats.clearedStages = {};
        this.saveData.stats.clearedStages[MapEngine.currentStage.id] = true;
      }
    }
    if (this.saveToStorage) this.saveToStorage();
    const hofBox = document.getElementById("endHallOfFameBox");
    if (hofBox) hofBox.innerHTML = "";
    if (this.isExpeditionMode) {
      if (!isVictory && typeof ModeExpedition !== "undefined") ModeExpedition.clearCheckpoint(this);
      const curW = (this.expeditionState && this.expeditionState.currentWave) || 1;
      const totW = (this.expeditionState && this.expeditionState.totalWaves) || 16;
      const er = this.lastExpeditionResult;
      document.getElementById("endModalTitle").textContent = isVictory ? "EXPEDITION CHAMPION!" : `EXPEDITION FAILED (W${curW}/${totW})`;
      document.getElementById("endModalSubtitle").textContent = (isVictory && er)
        ? `完成全 ${totW} 關遠征並討伐王者超夢！冠軍賞金 +${er.totalGain} 金`
        : `止步於第 ${curW}/${totW} 關，調整陣容或強化天賦後再次啟程！`;
      if (isVictory && hofBox && typeof ModeExpedition !== "undefined" && ModeExpedition.renderHallOfFameHtml) {
        hofBox.innerHTML = ModeExpedition.renderHallOfFameHtml(this);
      }
    } else if (this.isArenaMode) {
      const ar = this.lastArenaResult;
      document.getElementById("endModalTitle").textContent = isVictory ? "⚔️ ARENA VICTORY!" : "⚔️ ARENA DEFEAT";
      document.getElementById("endModalSubtitle").textContent = (isVictory && ar)
        ? `耗時 ${ar.clearSec.toFixed(1)} 秒擊破【${ar.bossName}】${ar.isNewRecord ? "（★ 新個人紀錄！）" : ""} ‧ 賞金 +${ar.totalGain} 金`
        : "調整出戰寶可夢或攜帶物，再次挑戰石英大會神獸！";
    } else {
      document.getElementById("endModalTitle").textContent = isVictory ? "VICTORY! 關都冠軍!" : "BATTLE FINISHED";
      document.getElementById("endModalSubtitle").textContent = isVictory
        ? "恭喜通過 8 分鐘極速關都傳說考驗！"
        : "前往寶可夢中心強化能力後再次挑戰！";
    }
    document.getElementById("btnResumeGame").classList.add("hidden");
    if (this.evaluateAndRenderPostGameRating) this.evaluateAndRenderPostGameRating(!!isVictory);
    if (this.populateEndModalStats) this.populateEndModalStats();
    const endEl = document.getElementById("endModal");
    if (endEl) {
      endEl.classList.remove("hidden");
      endEl.style.display = "flex";
    }
  }
};

window.addEventListener("DOMContentLoaded", () => GameApp.init());
