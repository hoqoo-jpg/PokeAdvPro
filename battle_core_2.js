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

  // 天氣測試鎖定開關與瞄準模式
  debugWeatherLock: false,
  manualAimMode: false,

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
    claimedAch: {}
  },

  // 戰鬥實體
  player: null,
  trainerCompanion: null,
  partners: [],
  partnerOrbitBase: 0,
  camera: { x: 0, y: 0, shakeTime: 0, shakeMagnitude: 0 },
  hitStopTimer: 0,

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

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
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
          document.getElementById("eevee-evo-modal").classList.remove("hidden");
          return;
        } else if (this.player.data.evo_to) {
          this.evolvePlayerPokemon(this.player.data.evo_to);
        }
      }
    }
    this.openLevelUpModal();
  },

  debugUnlockSuperMove() {
    if (!this.player) return;
    const sk = Object.values(this.player.skills)[0];
    if (!sk) return;
    const meta = SKILLS_CATALOG[sk.id];
    sk.level = 10;
    if (meta.reqItem) this.player.heldItems[meta.reqItem] = true;
    sk.evolved = true;
    SkillsEngine.triggerUltimateSuperMove(meta, sk);
    this.refreshHUD();
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
      speed: (isFinalMewtwo ? 92 : 82) * diff.spdMult,
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
    SoundFX.playBgm(stageId, true);

    // 徹底隱藏大廳、結算以及所有局內可能殘留的彈窗
    ["setupModal", "titleScreen", "endModal", "levelUpModal", "eevee-evo-modal", "pokeMartModal"].forEach(mId => {
      const el = document.getElementById(mId);
      if (el) { el.classList.add("hidden"); el.style.display = "none"; }
    });

    // 重置幀時間戳與打擊停頓，防止首幀時間差爆炸造成瞬移或物理崩潰
    this.lastFrameTime = performance.now();
    this.hitStopTimer = 0;
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
      xSpeedTimer: 0
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

    SkillsEngine.reset();

    if (tr.mods.startPartner || (upg.partner >= 1)) {
      this.summonOrUpgradePartner();
    }

    this.runTime = 0;
    this.spawnTimer = 0.5;
    this.eliteSpawnTimer = 45;
    this.treasureSpawnTimer = 38;
    this.magnetSpawnTimer = 35;
	this.martSpawnTimer = 110;
    this.rocketEventTriggered = false;
    this.taurosStampedeTriggered = false;
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
      cutLayer.classList.remove("hidden");

      const showFallbackStrip = () => {
        if (!cutStrip) return;
        if (cutBannerWrap) cutBannerWrap.classList.add("hidden");
        cutStrip.classList.remove("hidden");
        document.getElementById("cutInAvatar").src = tr.sprite;
        document.getElementById("cutInTrainer").textContent = `${tr.name} ‧ 戰術指令`;
        document.getElementById("cutInSkill").textContent = `【${tr.skillName}】`;
        cutStrip.classList.remove("cut-in-active");
        void cutStrip.offsetWidth;
        cutStrip.classList.add("cut-in-active");
      };

      const cutRec = tr.cutin ? SpriteCache.get(tr.cutin) : null;
      if (tr.cutin && cutBannerImg && cutBannerWrap && cutRec && cutRec.loaded && !cutRec.error) {
        cutStrip.classList.add("hidden");
        cutBannerWrap.classList.remove("hidden");
        cutBannerImg.onerror = () => {
          if (cutRec) cutRec.error = true;
          showFallbackStrip();
        };
        cutBannerImg.src = tr.cutin;
        cutBannerWrap.classList.remove("cut-in-banner-active");
        void cutBannerWrap.offsetWidth;
        cutBannerWrap.classList.add("cut-in-banner-active");
      } else {
        showFallbackStrip();
      }

      setTimeout(() => cutLayer.classList.add("hidden"), 750);
    }

    this.hitStopTimer = 0.08;
    this.camera.shakeTime = 0.28;
    this.camera.shakeMagnitude = 8;
    SoundFX.play("ultimate");

    let healPct = 0.20;
    if (tr.id === "ash") {
      healPct = 0.18;
      p.buffTimer = 6.0;
      p.maxBuffTimer = 6.0;
      this.spawnParticleCluster(p.x, p.y, "#F59E0B", "#FFFFFF", 28, "star");
      this.spawnFloatingText(p.x, p.y - 35, "就決定是你了! 全攻速暴擊UP!", "#F59E0B", 15);
    } else if (tr.id === "misty") {
      healPct = 0.22;
      SkillsEngine.meleeEffects.push({ style: "slam_wave", x: p.x, y: p.y, radius: 180, timer: 0.45, maxTime: 0.45, color: "#38BDF8" });
      this.spawnParticleCluster(p.x, p.y, "#38BDF8", "#E0F2FE", 32, "circle");
      this.enemies.forEach(e => {
        if (Math.hypot(e.x - p.x, e.y - p.y) < 220) {
          const ang = Math.atan2(e.y - p.y, e.x - p.x);
          e.x += Math.cos(ang) * 95; e.y += Math.sin(ang) * 95;
          e.status = "Freeze"; e.statusTimer = 3.0;
        }
      });
    } else if (tr.id === "brock") {
      healPct = 0.25;
      p.shieldTimer = 5.0;
      p.maxShieldTimer = 5.0;
      this.spawnParticleCluster(p.x, p.y, "#D97706", "#FDE047", 26, "rock");
      this.spawnFloatingText(p.x, p.y - 35, "岩石壁壘 5秒減傷50%!", "#F59E0B", 15);
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
          if (pt.data.evo_level !== "None" && pt.level >= 5 && pt.data.evo_to) {
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
    const rawDt = Math.min(0.05, (timestamp - this.lastFrameTime) / 1000 || 0.016);
    this.lastFrameTime = timestamp;

    if (this.state === "SPLASH" || this.state === "TITLE" || this.state === "LOADING") {
      this.updateTitleDemo(rawDt);
      this.renderTitleDemo();
    } else if (this.state === "PLAYING") {
      if (this.hitStopTimer > 0) {
        this.hitStopTimer -= rawDt;
      } else {
        const dt = rawDt * this.timeScale;
        this.updateCombat(dt);
      }
      this.renderCombat();
    } else {
      this.renderCombat();
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
    if (p.xAttackTimer > 0) p.xAttackTimer -= dt;
    if (p.xSpeedTimer > 0) p.xSpeedTimer -= dt;

    if (this.camera.shakeTime > 0) this.camera.shakeTime -= dt;

    if (p.statusTimer > 0) {
      p.statusTimer -= dt;
      p.statusTick -= dt;
      if (p.statusTick <= 0) {
        p.statusTick = 0.65;
        if (p.status === "Burn" || p.status === "Poison") {
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
      const healRate = inSpecialZone ? 0.018 : 0.008;
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

    // 【攜帶物：木炭】走過的路徑留下持續 2 秒的熔岩灼燒腳印
    if (p.heldItems && p.heldItems["charcoal"] && ilen > 0.05) {
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
        for (let j = this.enemies.length - 1; j >= 0; j--) {
          const e = this.enemies[j];
          if (Math.hypot(e.x - lf.x, e.y - lf.y) <= lf.radius + e.radius) {
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
    const rawMoveSpd = (85 + p.baseSpeed * 1.15) * p.speedMult * sharpBeakSpdMod * finalTerrainSpd * statusSpdMod * (p.buffTimer > 0 ? 1.25 : 1.0) * xSpdMod;
    // 主角速度軟上限 180 px/s，確保微操靈敏但避免中後期無腦風箏
    const moveSpd = Math.min(180, rawMoveSpd);

    p.vx = ix * moveSpd;
    p.vy = iy * moveSpd;
    p.x += p.vx * dt;
    p.y += p.vy * dt;

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
    this.partnerOrbitBase += dt * 2.1;
    const upgPartnerMult = 1 + (this.saveData.upgrades.partner || 0) * 0.18;
    this.partners.forEach((pt, idx) => {
      const angle = this.partnerOrbitBase + idx * Math.PI;
      const tx = midX + Math.cos(angle) * 78;
      const ty = midY + Math.sin(angle) * 60;
      pt.x += (tx - pt.x) * Math.min(1, dt * 12);
      pt.y += (ty - pt.y) * Math.min(1, dt * 12);
      pt.facingX = p.facingX;
      pt.facingY = p.facingY;

      pt.cdTimer -= dt;
      if (pt.cdTimer <= 0) {
        const target = this.findNearestEnemyInViewport(pt.x, pt.y, 360);
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
    Object.values(p.skills).forEach((skSlot, slotIdx) => {
      skSlot.timer -= dt;
      if (skSlot.timer <= 0) {
        if (p.castStaggerTimer > 0 && !skSlot.evolved) {
          skSlot.timer = 0.015; // 全局微序列排隊，防止多把子彈武器同一毫秒重疊發射
          return;
        }
        const meta = SKILLS_CATALOG[skSlot.id];
        if (!meta) return;
        if (skSlot.evolved) {
          SkillsEngine.triggerUltimateSuperMove(meta, skSlot);
          skSlot.timer = Math.max(2.4, meta.baseCd * 1.95 * cdFactor);
          p.castStaggerTimer = 0.08;
        } else {
          SkillsEngine.fireSkill(p, skSlot.id, skSlot.level, false, 1.0, slotIdx);
          const lvCdBonus = skSlot.level >= 9 ? 0.75 : (skSlot.level >= 4 ? 0.88 : 1.0);
          skSlot.timer = Math.max(0.35, meta.baseCd * lvCdBonus * cdFactor);
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
    for (const e of this.enemies) {
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
    for (const e of this.enemies) {
      if (Math.abs(e.x - this.player.x) > halfW || Math.abs(e.y - this.player.y) > halfH) continue;
      const d = Math.hypot(e.x - ox, e.y - oy);
      if (d <= maxRange) candidates.push({ e, d });
    }
    if (candidates.length === 0) return null;

    if (mode === "highest_hp") {
      // 優先鎖定視野內最高血量目標（Boss / 精英怪 / 滿血怪），若只有一群普通怪則取次近目標實現分流
      candidates.sort((a, b) => (b.e.hp - a.e.hp) || (a.d - b.d));
      if (candidates.length >= 2 && candidates[0].e.hp === candidates[1].e.hp) {
        candidates.sort((a, b) => a.d - b.d);
        return candidates[1].e;
      }
      return candidates[0].e;
    }

    if (mode === "cluster") {
      // 尋找周圍 85px 內怪物數量最密集的怪群核心
      let bestTarget = candidates[0].e;
      let bestScore = -1;
      for (const c of candidates) {
        let neighbors = 0;
        for (const other of candidates) {
          if (Math.hypot(other.e.x - c.e.x, other.e.y - c.e.y) <= 85) neighbors++;
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

  updateSpawners(dt) {
    const diff = this.selectedDifficulty;
    const minutes = this.runTime / 60;

    this.martSpawnTimer = (this.martSpawnTimer || 110) - dt;
    if (this.martSpawnTimer <= 0) {
      this.martSpawnTimer = 110;
      this.spawnPokeMartEntity(false);
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

    if (!this.mewtwoBossSpawned && this.runTime >= 450) {
      this.mewtwoBossSpawned = true;
      this.spawnBoss(150, true);
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
      const baseInterval = Math.max(0.24, (1.15 - minutes * 0.12) / diff.spawnRateMult);
      this.spawnTimer = baseInterval;

      const maxMobCap = Math.min(180, Math.round(75 + minutes * 15));
      if (this.enemies.length < maxMobCap) {
        this.spawnWildEnemy(false);
        if (minutes >= 4.0 && this.enemies.length < maxMobCap - 5) {
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
    if (minutes < 1.5) candidates = REGULAR_MOB_POOL.filter(p => p.hp <= 140);
    else if (minutes < 4.0) candidates = REGULAR_MOB_POOL.filter(p => p.hp <= 260);

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
    const shinyChance = 0.0025 * (1 + (this.saveData.upgrades.shiny || 0) * 0.35) * (this.selectedTrainer.mods.shinyBoost || 1) * (diff.shinyBonus || 1.0);
    const isShiny = Math.random() < shinyChance;

    const timeHpScale = 1 + (minutes * 0.80) + Math.pow(minutes / 2.3, 2.0) * 0.90;
    let rawHp = (35 + pick.hp * 0.55) * timeHpScale * diff.hpMult * (isElite ? 3.8 : 1.0) * (isShiny ? 1.6 : 1.0);
    // 遠程怪體質保底：防止在手機小螢幕邊界被一擊瞬秒，確保有機會出招
    const isRangedMob = [23, 24, 35, 41, 42, 48, 60, 69, 70, 81, 109, 110, 116, 117, 120].includes(pick.id);
    if (isRangedMob && !isElite) {
      rawHp = Math.max(110 * timeHpScale * diff.hpMult, rawHp * 1.35);
    }
    let hp = Math.round(rawHp);
    if (isElite && minutes >= 4.0) hp = Math.round(hp * 1.25);

    const atk = Math.round((8 + pick.atk * 0.35) * (1 + minutes * 0.15) * diff.atkMult * (isElite ? 1.45 : 1.0));

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
    
    const hasSkill = (sId) => {
      const clean = sId.replace(/\s+/g, '');
      return Object.keys(p.skills).some(k => k.replace(/\s+/g, '') === clean);
    };

    const shelf = [];
    const availableTMs = Object.values(tmCatalog).filter(tm => !hasSkill(tm.id));
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

  updateEnemies(dt) {
    const p = this.player;
    const halfW = this.width / 2 - 16;
    const halfH = this.height / 2 - 16;

    // 建立 80x80 空間雜湊網格 (Spatial Hash Grid)，將怪物推擠判定由 O(N^2) 降至 O(N)
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

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.isBoss && e.ccImmunityTimer > 0) e.ccImmunityTimer -= dt;
      if (e.whiteFlashTimer > 0) e.whiteFlashTimer -= dt;

      if (e.treasureType) {
        e.escapeTimer -= dt;
        if (e.escapeTimer <= 0) {
          this.spawnFloatingText(e.x, e.y, "寶藏精靈逃走了!", "#94A3B8", 12);
          this.enemies.splice(i, 1);
          continue;
        }
      }

      if (e.statusTimer > 0) {
        e.statusTimer -= dt;
        e.statusTick -= dt;
        if (e.statusTick <= 0) {
          e.statusTick = 0.55;
          if (e.status === "Burn") {
            const heatwaveMod = (MapEngine.weather === "HEATWAVE" ? 1.5 : 1.0);
            const bDmg = Math.max(6, Math.round(e.maxHp * 0.018 * heatwaveMod));
            e.hp -= bDmg;
            this.spawnFloatingText(e.x, e.y - 14, `灼傷 -${bDmg}`, "#F97316", 11);
          } else if (e.status === "Poison") {
            const pDmg = Math.max(8, Math.round(e.maxHp * 0.022));
            e.hp -= pDmg;
            this.spawnFloatingText(e.x, e.y - 14, `中毒 -${pDmg}`, "#A855F7", 11);
          }
          if (e.hp <= 0) {
            this.handleEnemyDeath(e, i);
            continue;
          }
        }
        if (e.statusTimer <= 0) e.status = null;
      }

      if (e.status === "Freeze") continue;

      const paraMult = e.status === "Paralysis" ? 0.35 : 1.0;
      const confDir = e.status === "Confusion" ? -0.75 : 1.0;
      let eTerrMult = 1.0;
      if (!e.isBoss) {
        const eTerr = MapEngine.getTerrainModifierAt(e.x, e.y);
        const isWaterOrFlying = e.data && (
          e.data.type1 === "Water" || e.data.type2 === "Water" ||
          e.data.type1 === "Flying" || e.data.type2 === "Flying"
        );
        // 水系與飛行系敵人在水域中免疫減速，水系自在遊弋、飛行系掠空飛翔
        if (eTerr.inWater && isWaterOrFlying) {
          eTerrMult = 1.0;
        } else {
          const rawTerrMult = eTerr.speedMult;
          eTerrMult = e.isElite ? (1.0 - (1.0 - rawTerrMult) * 0.5) : rawTerrMult;
        }
        // 暴雪天候：非冰系且非飛行系的地面怪物移速受到極寒微緩 (-15%)
        if (MapEngine.weather === "BLIZZARD" && e.data) {
          const isIceOrFlying = (e.data.type1 === "Ice" || e.data.type2 === "Ice" || e.data.type1 === "Flying" || e.data.type2 === "Flying");
          if (!isIceOrFlying) eTerrMult *= 0.85;
        }
      }

      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const dist = Math.hypot(dx, dy) || 1;

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

      let moveDir = confDir;
      if (e.treasureType === "meowth") moveDir = -1.0;
      else if (e.treasureType === "chansey") moveDir = -0.85;

      let vx = (dx / dist) * e.speed * paraMult * eTerrMult * moveDir;
      let vy = (dy / dist) * e.speed * paraMult * eTerrMult * moveDir;

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

      if (!e.isBoss) {
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

      if (!e.isBoss) {
        MapEngine.resolveObstacleCollision(e, e.radius * 0.8, false);
      }

      const inView = Math.abs(e.x - p.x) <= halfW && Math.abs(e.y - p.y) <= halfH;

      // 1. 神獸 Boss 彈幕與地毯技能
      if (inView && e.isBoss && !e.treasureType) {
        e.rangedCd = (e.rangedCd !== undefined ? e.rangedCd : 1.5) - dt;
        if (e.rangedCd <= 0) {
          const isEnraged = (e.hp / e.maxHp) <= 0.5; // 血量低於 50% 觸發狂暴強化
          e.rangedCd = isEnraged ? (1.8 + Math.random() * 0.7) : (2.4 + Math.random() * 0.9);

          const baseAng = Math.atan2(p.y - e.y, p.x - e.x);

          // 1. 急凍鳥 (#144) —— 扇形三叉冰錐 (速度 220px/s，快於玩家跑速，附帶 40% 減速)
          if (e.id === 144) {
            const spreadAngles = [-0.26, 0, 0.26];
            spreadAngles.forEach(angOffset => {
              const ang = baseAng + angOffset;
              this.enemyProjectiles.push({
                x: e.x + Math.cos(ang) * (e.radius + 10),
                y: e.y + Math.sin(ang) * (e.radius + 10),
                vx: Math.cos(ang) * 220,
                vy: Math.sin(ang) * 220,
                angle: ang, radius: 10,
                dmg: Math.round(e.atk * 0.85),
                color: "#38BDF8", vfx: "frost_lance",
                statusEffect: "Freeze", statusChance: 0.45,
                life: 3.5, rot: 0
              });
            });

            // 狂暴強化 (<50% HP)：原地爆發 8 向環形暴風雪冰晶
            if (isEnraged) {
              for (let k = 0; k < 8; k++) {
                const ringAng = (k * Math.PI * 2) / 8 + Math.random() * 0.2;
                this.enemyProjectiles.push({
                  x: e.x, y: e.y,
                  vx: Math.cos(ringAng) * 175,
                  vy: Math.sin(ringAng) * 175,
                  angle: ringAng, radius: 9,
                  dmg: Math.round(e.atk * 0.75),
                  color: "#BAE6FD", vfx: "frost_lance",
                  statusEffect: "Freeze", statusChance: 0.35,
                  life: 3.0, rot: 0
                });
              }
              this.spawnParticleCluster(e.x, e.y, "#BAE6FD", "#38BDF8", 16, "star", 1.2);
            }
          }

          // 2. 閃電鳥 (#145) —— 預判高速雙聯金羽 (255px/s) + 慢速引力追蹤雷球
          else if (e.id === 145) {
            [-0.12, 0.12].forEach(angOffset => {
              const ang = baseAng + angOffset;
              this.enemyProjectiles.push({
                x: e.x, y: e.y,
                vx: Math.cos(ang) * 255, vy: Math.sin(ang) * 255,
                angle: ang, radius: 9,
                dmg: Math.round(e.atk * 0.80),
                color: "#FACC15", vfx: "swift_star",
                statusEffect: "Paralysis", statusChance: 0.35,
                life: 3.0, rot: 0
              });
            });

            const homingCount = isEnraged ? 2 : 1;
            for (let h = 0; h < homingCount; h++) {
              const hAng = baseAng + (h === 0 ? 0 : 0.4);
              this.enemyProjectiles.push({
                x: e.x, y: e.y,
                vx: Math.cos(hAng) * 105, vy: Math.sin(hAng) * 105,
                angle: hAng, radius: 14,
                dmg: Math.round(e.atk * 0.95),
                color: "#FDE047", vfx: "storm_orb",
                homing: true, statusEffect: "Paralysis", statusChance: 0.60,
                life: 4.5, rot: 0
              });
            }
          }

          // 3. 火焰鳥 (#146) —— 大字巨炎彈 (半徑 15px，命中灼傷)，撞擊後十字二次分裂
          else if (e.id === 146) {
            const count = isEnraged ? 2 : 1;
            for (let f = 0; f < count; f++) {
              const fAng = baseAng + (count > 1 ? (f === 0 ? -0.2 : 0.2) : 0);
              this.enemyProjectiles.push({
                x: e.x, y: e.y,
                vx: Math.cos(fAng) * 195, vy: Math.sin(fAng) * 195,
                angle: fAng, radius: 15,
                dmg: Math.round(e.atk * 1.10),
                color: "#EF4444", vfx: "fire_blast_orb",
                statusEffect: "Burn", statusChance: 0.50,
                canSplit: true, isEnragedSplit: isEnraged,
                life: 2.5, rot: 0
              });
            }
          }

          // 4. 超夢 (#150) —— 巨型引力黑核 (直徑 36px，微牽引走位) + 8向暗影波
          else if (e.id === 150) {
            this.enemyProjectiles.push({
              x: e.x, y: e.y,
              vx: Math.cos(baseAng) * 155, vy: Math.sin(baseAng) * 155,
              angle: baseAng, radius: 18,
              dmg: Math.round(e.atk * 1.30),
              color: "#A855F7", vfx: "psychic_core",
              isSuction: true, statusEffect: "Confusion", statusChance: 0.40,
              life: 4.0, rot: 0
            });

            if (isEnraged) {
              for (let p = 0; p < 8; p++) {
                const pAng = (p * Math.PI * 2) / 8 + baseAng;
                this.enemyProjectiles.push({
                  x: e.x, y: e.y,
                  vx: Math.cos(pAng) * 210, vy: Math.sin(pAng) * 210,
                  angle: pAng, radius: 10,
                  dmg: Math.round(e.atk * 0.80),
                  color: "#C084FC", vfx: "psy_wave",
                  statusEffect: "Confusion", statusChance: 0.25,
                  life: 3.0, rot: 0
                });
              }
            }
          }

          // 5. 夢幻 (#151) —— 5 連發（狂暴 10 連發）彩虹混色速射彈
          else if (e.id === 151) {
            const mCount = isEnraged ? 10 : 5;
            for (let m = 0; m < mCount; m++) {
              const spread = (Math.random() - 0.5) * 0.75;
              const mAng = baseAng + spread;
              const rainbowColors = ["#EF4444", "#38BDF8", "#FACC15", "#22C55E", "#EC4899"];
              const pickColor = rainbowColors[m % rainbowColors.length];
              this.enemyProjectiles.push({
                x: e.x, y: e.y,
                vx: Math.cos(mAng) * 230, vy: Math.sin(mAng) * 230,
                angle: mAng, radius: 9,
                dmg: Math.round(e.atk * 0.70),
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
        e.eliteTelegraphCd = (e.eliteTelegraphCd !== undefined ? e.eliteTelegraphCd : 3.0) - dt;
        if (e.eliteTelegraphCd <= 0) {
          e.eliteTelegraphCd = 3.5;
          this.spawnEnemyTelegraphAttack(e);
        }
      }

      // 3. 所有具備遠程習性的怪獸 (無論是普通怪、火箭隊精英阿柏怪 24 或雙彈瓦斯 110，均正常發射子彈！)
      const rangedIds = [23, 24, 35, 41, 42, 48, 60, 69, 70, 81, 109, 110, 116, 117, 120];
      if (inView && !e.treasureType && !e.isBoss && rangedIds.includes(e.id)) {
        e.rangedCd = (e.rangedCd !== undefined ? e.rangedCd : 0.05) - dt;
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
      const hitTrainer = tc && (distToTrainer < e.radius + 18);

      if (!e.treasureType && (hitPoke || hitTrainer) && p.invulnTimer <= 0) {
        // 【攜帶物：柔軟沙子】受到近戰攻擊時 25% 機率揚起沙塵使怪獸失誤！
        if (p.heldItems && p.heldItems["soft_sand"] && Math.random() < 0.25) {
          p.invulnTimer = 0.45;
          this.spawnParticleCluster(p.x, p.y, "#D97706", "#FDE68A", 14, "circle", 0.8);
          this.spawnFloatingText(p.x, p.y - 24, "柔軟沙子：沙塵閃避 MISS!", "#FDE047", 14);
          continue;
        }

        const armorMult = 1 - (p.finalEvoArmor || 0);
        const dragonScaleMult = (p.heldItems && p.heldItems["dragon_scale"]) ? 0.85 : 1.0;
        const shieldMult = (p.shieldTimer > 0 ? 0.5 : 1.0) * armorMult * dragonScaleMult;
        const burnMod = e.status === "Burn" ? 0.72 : 1.0;
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
            tg.owner.x = tg.startX + Math.cos(tg.angle) * (tg.length * 0.85);
            tg.owner.y = tg.startY + Math.sin(tg.angle) * (tg.length * 0.85);
          }
        } else if (tg.shape === "ring") {
          const d = Math.hypot(p.x - tg.x, p.y - tg.y);
          if (d <= tg.radius && d >= tg.innerRadius) hitPlayer = true;
        } else {
          const d = Math.hypot(p.x - tg.x, p.y - tg.y);
          if (d <= tg.radius) hitPlayer = true;
        }

        if (hitPlayer && p.invulnTimer <= 0) {
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
      ep.rot += dt * 5;
      ep.life -= dt;

      // 檢查是否擊中主角精靈或隨行訓練家
      const distToPoke = Math.hypot(p.x - ep.x, p.y - ep.y);
      const distToTrainer = tc ? Math.hypot(tc.x - ep.x, tc.y - ep.y) : 999;
      const hitPoke = distToPoke < ep.radius + 14;
      const hitTrainer = tc && (distToTrainer < ep.radius + 15);

      if ((hitPoke || hitTrainer) && p.invulnTimer <= 0) {
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
    const poisonBarbCritBonus = (this.player.heldItems && this.player.heldItems["poison_barb"] && enemy.status === "Poison") ? 0.25 : 0;
    const isCrit = Math.random() < (this.player.critRate + (this.player.buffTimer > 0 ? 0.25 : 0) + psychicCritBonus + poisonBarbCritBonus);
    // 【攜帶物：黑帶】暴擊傷害從 1.35x 提升至 1.75x
    const critMult = isCrit ? ((this.player.heldItems && this.player.heldItems["black_belt"]) ? 1.75 : 1.35) : 1.0;
    const xAtkMod = this.player.xAttackTimer > 0 ? 1.35 : 1.0;
    let finalDmg = Math.round(rawDmg * eff * critMult * xAtkMod);
    if (enemy.isBoss) finalDmg = Math.min(finalDmg, Math.round(enemy.maxHp * 0.085));

    enemy.hp -= finalDmg;
    // 任何受傷均觸發明顯白閃反饋
    enemy.whiteFlashTimer = (isCrit || eff > 1.1) ? 0.12 : 0.09;

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
      if (checkStatusImmunity(enemy, tMeta.status)) {
        this.spawnFloatingText(enemy.x, enemy.y - 20, "免疫!", "#94A3B8", 11);
      } else if (Math.random() < (tMeta.statusRate + bonusStatusChance)) {
        if (enemy.isBoss && enemy.ccImmunityTimer > 0 && ["Freeze", "Paralysis", "Confusion"].includes(tMeta.status)) {
          this.spawnFloatingText(enemy.x, enemy.y - 20, "韌性抵抗!", "#CBD5E1", 11);
        } else {
          enemy.status = tMeta.status;
          enemy.statusTimer = enemy.isBoss ? 1.6 : 4.2;
          if (enemy.isBoss) enemy.ccImmunityTimer = 3.0;
          enemy.statusTick = 0.3;
        }
      }
    }

    // 【攜帶物：彎曲湯匙】攻擊有 15% 機率引發念力震盪與混亂（後置判定，不被其他狀態吃掉，並帶有粉紫念力波圈）
    if (this.player.heldItems && this.player.heldItems["twisted_spoon"] && Math.random() < 0.15) {
      if (!(enemy.isBoss && enemy.ccImmunityTimer > 0)) {
        enemy.status = "Confusion";
        enemy.statusTimer = enemy.isBoss ? 1.6 : 3.6;
        if (enemy.isBoss) enemy.ccImmunityTimer = 3.0;
        SkillsEngine.meleeEffects.push({
          style: "slam_wave",
          x: enemy.x,
          y: enemy.y,
          radius: 42,
          timer: 0.22,
          maxTime: 0.22,
          color: "#EC4899"
        });
        this.spawnFloatingText(enemy.x, enemy.y - 24, "🌀 念力混亂!", "#F472B6", 12);
      }
    }

    const hasBlackBelt = !!(this.player.heldItems && this.player.heldItems["black_belt"]);
    const isPoisonCrit = isCrit && poisonBarbCritBonus > 0;
    const critPrefix = isPoisonCrit ? "劇毒暴擊" : (hasBlackBelt ? "極限暴擊" : "暴擊");
    const label = eff > 1.1 ? (isCrit ? `克制${critPrefix} ${finalDmg}!` : `克制 ${finalDmg}!`) : (isCrit ? `${critPrefix} ${finalDmg}!` : `${finalDmg}`);
    const col = isPoisonCrit ? "#C084FC" : (eff > 1.1 ? "#F97316" : (isCrit ? (hasBlackBelt ? "#FB7185" : "#FACC15") : "#FFFFFF"));
    this.spawnFloatingText(enemy.x, enemy.y - 12, label, col, eff > 1.1 || isCrit ? 15 : 12);

    if (enemy.hp <= 0) {
      const idx = this.enemies.indexOf(enemy);
      if (idx !== -1) this.handleEnemyDeath(enemy, idx);
    }
  },

  handleEnemyDeath(e, idx) {
    this.enemies.splice(idx, 1);
    this.kills += 1;
    this.saveData.stats.totalKills += 1;
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

    const diffCoinMult = this.selectedDifficulty.coinMult * MapEngine.currentStage.rewardMult * (1 + (this.saveData.upgrades.greed || 0) * 0.15);

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
      const dropId = Math.random() < 0.22 ? "partner_ball" : "rare_candy";
      this.spawnMapLoot(dropId, e.x, e.y);
    }

    if (e.isBoss) {
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
      } else if (e.id === 150) {
        this.saveData.stats.mewtwoDefeated += 1;
        this.saveData.unlockedTrainers["red"] = true;
        this.saveToStorage();
        if (!this.secretMewSpawned) {
          this.secretMewSpawned = true;
          this.spawnBoss(151, false);
          this.showCutsceneBanner("[終極試煉] 隱藏頭目【始祖夢幻 #151】甦醒！", "同時解鎖傳奇訓練家【赤紅 Red】！", 3800);
        }
      } else if (e.id === 151) {
        this.saveData.stats.mewDefeated += 1;
        this.saveToStorage();
        this.triggerGameOver(true);
        return;
      }
    }

    this.gems.push({ x: e.x, y: e.y, val: e.isElite ? 45 : 14, color: e.isElite ? "#F59E0B" : "#38BDF8" });
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
      const d = Math.hypot(p.x - g.x, p.y - g.y);
      if (d < effectiveMagnetR || g.magnetized) {
        g.magnetized = true;
        const ang = Math.atan2(p.y - g.y, p.x - g.x);
        g.x += Math.cos(ang) * 440 * dt;
        g.y += Math.sin(ang) * 440 * dt;
      }
      if (d < 22) {
        this.gems.splice(i, 1);
        this.gainExp(g.val);
      }
    }

    for (let i = this.mapItems.length - 1; i >= 0; i--) {
      const it = this.mapItems[i];
	  if (it.id === "poke_mart") continue; // 👈 關鍵防護：商店絕不被碰撞拾取邏輯刪除！
	  
      it.bobPhase += dt * 4;
      if (Math.hypot(p.x - it.x, p.y - it.y) < 30) {
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

    if (evolvedCount < 2) {
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
    const expMult = (this.selectedTrainer.mods.expMult || 1.0) * (1 + (this.saveData.upgrades.greed || 0) * 0.12);
    p.exp += amount * expMult;
    if (p.exp >= p.nextExp) {
      p.exp -= p.nextExp;
      p.level += 1;
      p.nextExp = Math.round(p.nextExp * 1.22 + 12);
      SoundFX.play("levelup");

      if (p.data.evo_level !== "None" && p.level >= p.data.evo_level) {
        if (p.id === 133) {
          this.state = "PAUSED";
          document.getElementById("eevee-evo-modal").classList.remove("hidden");
          return;
        } else if (p.data.evo_to) {
          this.evolvePlayerPokemon(p.data.evo_to);
        }
      }
      this.openLevelUpModal();
    }
  },

  confirmEeveeEvolution(targetId) {
    document.getElementById("eevee-evo-modal").classList.add("hidden");
    const p = this.player;
    const oldSkills = Object.values(p.skills);
    const savedLevels = oldSkills.slice(0, 3).map(s => s.level);
    const tmSkill = oldSkills[3] || null;

    this.evolvePlayerPokemon(targetId);

    const evoSkillMap = typeof EEVEE_EVO_SKILLS !== "undefined" ? EEVEE_EVO_SKILLS : {
      134: ["HydroPump", "IceBeam", "Tackle"],
      135: ["Thunderbolt", "AirSlash", "Tackle"],
      136: ["Flamethrower", "DragonRush", "Tackle"]
    };

    const newSkillIds = evoSkillMap[targetId] || ["HydroPump", "IceBeam", "Tackle"];
    p.skills = {};
    newSkillIds.forEach((sId, idx) => {
      p.skills[sId] = { id: sId, level: Math.max(1, savedLevels[idx] || 1), evolved: false, timer: 0.2 };
    });

    p.naturalSkills = [...newSkillIds];
	
    if (tmSkill) {
      p.skills[tmSkill.id] = tmSkill;
    }

    this.state = "PLAYING";
    this.refreshHUD();
  },

  evolvePlayerPokemon(targetId) {
    const p = this.player;
    const nextData = POKEMON_MAP.get(targetId);
    if (!nextData) return;
    const oldName = p.data.name_zh;
    const isFinalForm = (nextData.evo_level === "None" || !nextData.evo_to);
    const hpBoostMult = isFinalForm ? 1.50 : 1.30;

    p.id = nextData.id;
    p.data = nextData;
    p.maxHp = Math.round(p.maxHp * hpBoostMult);
    p.hp = p.maxHp;
    p.invulnTimer = Math.max(p.invulnTimer || 0, 1.5);
    if (isFinalForm) {
      p.finalEvoArmor = 0.12; // 最終完全體獲得永久 12% 霸體減傷
    }
    p.baseAtk = nextData.atk * (p.isShiny ? 1.2 : 1.0);
    p.baseSpeed = nextData.speed;

    this.saveData.stats.evolutions += 1;
    this.saveData.pokedexSeen[nextData.id] = true;
    this.saveData.pokedexCaught[nextData.id] = true;
    this.saveData.unlockedPokemon[nextData.id] = true;
    this.saveToStorage();

    SoundFX.play("levelup");
    this.spawnParticleCluster(p.x, p.y, "#F59E0B", "#FFFFFF", 44, "star", 1.5);
    const evoBannerSub = isFinalForm
      ? `【最終完全體覺醒】血量上限暴增 +50%（${p.maxHp} HP）並獲得 12% 霸體減傷！`
      : `生命上限提升 +30%（${p.maxHp} HP）並立即回滿狀態！`;
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
      if (evolvedCount < 2) {
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
          pool.push({
            key: hi.name,
            weight: 2, rarityClass: "rarity-epic", badge: "超武核心攜帶物", badgeBg: "bg-purple-600 text-white font-black",
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

    const recipeBarHtml = recipePills ? `
      <div class="bg-slate-950/75 border border-slate-800 rounded-xl p-2 mb-2.5">
        <div class="text-[10px] font-bold text-amber-300/90 mb-1 flex items-center gap-1">
          <i class="fa-solid fa-flask text-[9px]"></i>
          <span>超武合成配方提示（招式 Lv.10 ＋ 對應攜帶物 ＝ 究極超武）：</span>
        </div>
        <div class="flex flex-wrap gap-1.5">${recipePills}</div>
      </div>
    ` : "";

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
            <div class="flex items-center gap-2">
              <span class="font-black text-sm sm:text-base text-slate-800 truncate">${c.title}</span>
              ${c.typeBadge || ''}
              <span class="px-2 py-0.2 rounded-full text-[9px] ${c.badgeBg} truncate">${c.badge}</span>
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
    document.getElementById("levelUpModal").classList.add("hidden");
    this.state = "PLAYING";
    this.refreshHUD();
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
    if (this.floatingTexts.length > 36) this.floatingTexts.shift();
    this.floatingTexts.push({ x, y, text, color, size, life: 0.75 });
  },

  showCutsceneBanner(title, subtitle, duration = 2600) {
    const b = document.getElementById("cutsceneBanner");
    document.getElementById("cutsceneTitle").textContent = title;
    document.getElementById("cutsceneSubtitle").textContent = subtitle;
    b.classList.remove("hidden");
    clearTimeout(this._bannerTimeout);
    this._bannerTimeout = setTimeout(() => b.classList.add("hidden"), duration);
  },

  renderCombat() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    if (!this.player) return;

    let shakeX = 0, shakeY = 0;
    if (this.camera.shakeTime > 0) {
      shakeX = (Math.random() - 0.5) * this.camera.shakeMagnitude * 2;
      shakeY = (Math.random() - 0.5) * this.camera.shakeMagnitude * 2;
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
      ctx.save();
      ctx.translate(sx, sy);
      ctx.fillStyle = g.color;
      ctx.strokeStyle = "#0F172A";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(0, -8); ctx.lineTo(6.5, 0); ctx.lineTo(0, 8); ctx.lineTo(-6.5, 0);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
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
        if (rec && rec.loaded) ctx.drawImage(rec.img, sx - 12, sy + yOffset - 12, 24, 24);
        ctx.restore();
      }
    });

    if (this.trainerCompanion) {
      const tc = this.trainerCompanion;
      const tsx = toSx(tc.x), tsy = toSy(tc.y);
      const bob = Math.abs(Math.sin(tc.walkBob)) * 3.5;
      const tTerrain = MapEngine.getTerrainModifierAt(tc.x, tc.y);
      const tInWater = tTerrain.inWater;
      const tInGrass = tTerrain.label.includes("草叢");

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
      if (tInWater) {
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

      // 隨行訓練家腳底戰術光環（平時淡青藍，受創時閃爍鮮紅警戒圈，直觀提示訓練家受擊判定區）
      ctx.strokeStyle = tc.whiteFlashTimer > 0 ? "rgba(239, 68, 68, 0.95)" : "rgba(56, 189, 248, 0.45)";
      ctx.lineWidth = tc.whiteFlashTimer > 0 ? 3.0 : 1.6;
      ctx.beginPath();
      ctx.ellipse(tsx, tsy + 18, 18, 7, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.translate(tsx, tsy - bob + (tc.jumpY || 0) + (tInWater ? 11 : 0));
      if (needFlip) ctx.scale(-1, 1);
      if (tRec && tRec.loaded) {
        // 訓練家受創橙紅閃爍
        if (tc.whiteFlashTimer > 0) {
          ctx.filter = "sepia(1) saturate(5) hue-rotate(-30deg) brightness(1.2)";
        }
        if (tInWater) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(-28, -28, 56, 40);
          ctx.clip();
          ctx.drawImage(tRec.img, -28, -28, 56, 56);
          ctx.restore();
        } else {
          ctx.drawImage(tRec.img, -28, -28, 56, 56);
        }
        if (tInGrass) {
          ctx.save();
          const gNow = performance.now() * 0.0025;
          ctx.strokeStyle = "#4ADE80";
          ctx.lineWidth = 1.6;
          const vOffsets = [-15, -2, 11];
          vOffsets.forEach((ox, i) => {
            const sway = Math.sin(gNow * 1.8 + (tc.x + ox) * 0.05) * 2.5;
            const rootY = 24;
            ctx.beginPath();
            ctx.moveTo(ox, rootY);
            ctx.lineTo(ox - 3 + sway, rootY - 7);
            ctx.moveTo(ox, rootY);
            ctx.lineTo(ox + 3 + sway, rootY - 7);
            ctx.stroke();
          });
          ctx.restore();
        }
      }
      ctx.restore();
    }

    this.partners.forEach(pt => {
      const psx = toSx(pt.x), psy = toSy(pt.y);
      const sprUrl = pt.facingY < 0 ? pt.data.back_sprite : pt.data.forward_sprite;
      const rec = SpriteCache.get(sprUrl);
      ctx.save();
      ctx.fillStyle = "rgba(236,72,153,0.28)";
      ctx.beginPath();
      ctx.ellipse(psx, psy + 16, 13, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      if (rec && rec.loaded) {
        ctx.translate(psx, psy);
        if (pt.facingX > 0) ctx.scale(-1, 1);
        ctx.drawImage(rec.img, -20, -20, 40, 40);
      }
      ctx.restore();
    });

    const p = this.player;
    const px = toSx(p.x), py = toSy(p.y);
    const pBob = Math.abs(Math.sin(p.walkBob)) * 4;
    const terrain = MapEngine.getTerrainModifierAt(p.x, p.y);
    const inWater = terrain.inWater;
    const inGrass = terrain.label.includes("草叢");

    ctx.save();

    if (inWater) {
      const waveCycle = (performance.now() * 0.005) % Math.PI;
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.8 - waveCycle / Math.PI})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(px, py + 16, 16 + waveCycle * 8, 7 + waveCycle * 3.5, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = "rgba(15, 23, 42, 0.30)";
      ctx.beginPath();
      ctx.ellipse(px, py + 18, 14, 5.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    if (p.isTrainerBond) {
      ctx.strokeStyle = p.bondColor;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(px, py + 19, 22, 7.5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 手動突圍瞄準模式時：在主角身前繪製翠綠戰術準星箭頭，清楚指示當前移動開火方向
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

    // 繪製【不融冰】125px 極寒霜凍結界光環
    if (p.heldItems && p.heldItems["never_melt_ice"]) {
      ctx.save();
      ctx.strokeStyle = "rgba(103, 232, 249, 0.60)";
      ctx.fillStyle = "rgba(56, 189, 248, 0.10)";
      ctx.lineWidth = 2.0;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.arc(px, py, 125, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
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

    const pSprUrl = p.facingY < 0 ? p.data.back_sprite : p.data.forward_sprite;
    const pRec = SpriteCache.get(pSprUrl);
    if (pRec && pRec.loaded) {
      // 受傷無敵時間高頻半透明閃爍 (Sprite Blinking，經典 GBA 受創無敵反饋)
      if (p.invulnTimer > 0) {
        const blinkCycle = Math.floor(p.invulnTimer * 24) % 2;
        ctx.globalAlpha = blinkCycle === 0 ? 0.35 : 0.95;
      }

      // 涉水時下沉 10px，造成半身浸在水面感
      ctx.translate(px, py - pBob + (p.jumpY || 0) + (inWater ? 10 : 0));
      if (p.facingX > 0) ctx.scale(-1, 1);
      if (p.whiteFlashTimer > 0) {
        ctx.filter = "brightness(10) contrast(10)";
      } else if (p.isShiny) {
        ctx.filter = "hue-rotate(48deg) saturate(1.75) brightness(1.15)";
      }
      
      // 若在水中，裁剪下半身 14px，只露出上半身
      if (inWater) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(-26, -26, 52, 38);
        ctx.clip();
        ctx.drawImage(pRec.img, -26, -26, 52, 52);
        ctx.restore();
      } else {
        ctx.drawImage(pRec.img, -26, -26, 52, 52);
      }
      ctx.filter = "none";

      // 若在草叢中，直接沿用背景同款復古 V 形分叉像素小草，自然融入場景
      if (inGrass) {
        ctx.save();
        const gNow = performance.now() * 0.0025;
        ctx.strokeStyle = "#4ADE80";
        ctx.lineWidth = 1.6;
        const vOffsets = [-15, -2, 11];
        vOffsets.forEach((ox, i) => {
          const sway = Math.sin(gNow * 1.8 + (p.x + ox) * 0.05) * 2.5;
          const rootY = 22;
          ctx.beginPath();
          ctx.moveTo(ox, rootY);
          ctx.lineTo(ox - 3 + sway, rootY - 7);
          ctx.moveTo(ox, rootY);
          ctx.lineTo(ox + 3 + sway, rootY - 7);
          ctx.stroke();
        });
        ctx.restore();
      }
    }
    ctx.restore();

    this.enemies.forEach(e => {
      const esx = toSx(e.x), esy = toSy(e.y);
      if (esx < -90 || esx > this.width + 90 || esy < -90 || esy > this.height + 90) return;

      const eSprUrl = e.facingY < 0 ? e.data.back_sprite : e.data.forward_sprite;
      const eRec = SpriteCache.get(eSprUrl);
      const sz = e.isBoss ? 120 : (e.isElite || e.treasureType ? 88 : 64);

      // 繪製敵人腳底陰影
      ctx.save();
      ctx.fillStyle = "rgba(15, 23, 42, 0.32)";
      ctx.beginPath();
      ctx.ellipse(esx, esy + sz * 0.35, sz * 0.32, sz * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.translate(esx, esy);
      if (e.facingX > 0) ctx.scale(-1, 1);

      if (e.whiteFlashTimer > 0) {
        ctx.filter = "brightness(10) contrast(10)";
      } else if (e.isShiny) {
        ctx.filter = "hue-rotate(48deg) saturate(1.8) brightness(1.15)";
      } else if (e.status === "Poison") {
        ctx.filter = "hue-rotate(240deg) saturate(1.8)";
      } else if (e.status === "Burn") {
        ctx.filter = "sepia(0.8) saturate(2.5) hue-rotate(-25deg)";
      } else if (e.inFrostAura) {
        ctx.filter = "hue-rotate(155deg) saturate(1.6) brightness(1.18)";
      }

      if (eRec && eRec.loaded) ctx.drawImage(eRec.img, -sz / 2, -sz / 2, sz, sz);

      // --- 沙盒 V10 狀態視覺效果 (告別純色濾鏡，辨識度極高且不遮擋彈道) ---
      // 1. 麻痺 (Paralysis)：周身跳動 2 條隨機白金微電弧
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

      // 2. 冰凍 (Freeze)：沙盒 V10 六角透明折射稜柱冰棺
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

        // 冰棺白色反光斜切高光線
        ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(-r * 0.45, -r * 0.65);
        ctx.lineTo(r * 0.45, r * 0.65);
        ctx.stroke();
        ctx.restore();
      }

      // 3. 混亂 (Confusion)：傾斜星芒
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

      // 遠程怪射擊前 0.35s 嘴邊/頭頂凝聚微型光點蓄力預警 (避免滿屏紅線干擾視線)
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

      // --- 血條升級：加長至 44px + 1px 黑色硬描邊 + 綠/黃/紅三段變色 (殘血瀕危呼吸) ---
      if (e.hp < e.maxHp || e.isElite || e.treasureType) {
        const bw = e.isBoss ? 72 : 44;
        const bh = e.isBoss ? 6 : 5.5;
        const barX = esx - bw / 2;
        const barY = esy - sz / 2 - 10;
        const hpRatio = Math.max(0, e.hp / e.maxHp);

        // 黑色外描邊 + 深黑底槽 (確保在草地、水面與任何地貌均有強烈輪廓對比)
        ctx.save();
        ctx.fillStyle = "rgba(10, 15, 29, 0.92)";
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 1.2;
        ctx.fillRect(barX, barY, bw, bh);
        ctx.strokeRect(barX, barY, bw, bh);

        // 三段式色溫判定 (經典 GBA 寶可夢血條機制)
        let barColor = "#22C55E"; // > 50%: 翠綠
        if (e.treasureType) {
          barColor = "#FACC15";
        } else if (hpRatio <= 0.20) {
          // <= 20%: 鮮紅 + 瀕死呼吸脈動
          const pulse = 0.75 + Math.sin(performance.now() * 0.015) * 0.25;
          ctx.globalAlpha = pulse;
          barColor = "#EF4444";
        } else if (hpRatio <= 0.50) {
          // 20% ~ 50%: 警告金黃
          barColor = "#FACC15";
        }

        ctx.fillStyle = barColor;
        ctx.fillRect(barX + 0.5, barY + 0.5, (bw - 1) * hpRatio, bh - 1);
        ctx.restore();
      }
    });

    ctx.save();
    SkillsEngine.render(ctx, toSx, toSy);

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
      if (!e.treasureType && !e.isBoss) return;
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
        const arrowColor = isMeowth ? "#F59E0B" : (isChansey ? "#EC4899" : "#EF4444");

        ctx.save();
        ctx.translate(arrowX, arrowY);

        ctx.fillStyle = arrowColor;
        ctx.shadowColor = arrowColor;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(0, 0, 16, 0, Math.PI * 2);
        ctx.fill();

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
        ctx.shadowColor = arrowColor;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(0, 0, 15, 0, Math.PI * 2);
        ctx.fill();

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

    document.getElementById("hudAvatar").src = p.data.forward_sprite;
    document.getElementById("hudPartnerName").textContent = p.data.name_zh;
    const tb = document.getElementById("hudTypeBadges"); if (tb && typeof renderTypeBadgeHTML === "function") tb.innerHTML = `${renderTypeBadgeHTML(p.data.type1)}${renderTypeBadgeHTML(p.data.type2)}`;
    document.getElementById("hudAshBondBadge").classList.toggle("hidden", !p.isTrainerBond);
    document.getElementById("hudLevelText").textContent = `Lv.${p.level}`;

    document.getElementById("hudHpBar").style.width = `${Math.max(0, (p.hp / p.maxHp) * 100)}%`;
    document.getElementById("hudHpText").textContent = `${Math.ceil(p.hp)}/${p.maxHp}`;
    document.getElementById("hudExpBar").style.width = `${Math.min(100, (p.exp / p.nextExp) * 100)}%`;

    const mins = String(Math.floor(this.runTime / 60)).padStart(2, "0");
    const secs = String(Math.floor(this.runTime % 60)).padStart(2, "0");
    document.getElementById("hudTimer").textContent = `${mins}:${secs}`;
    document.getElementById("hudKills").textContent = this.kills;
    document.getElementById("hudCoins").textContent = this.runCoins;

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

    document.getElementById("hudSkillList").innerHTML = Object.values(p.skills).map(sk => {
      const meta = SKILLS_CATALOG[sk.id];
      return `<span class="px-2 py-0.5 rounded-full text-[9px] font-black border border-slate-800 ${sk.evolved ? 'bg-amber-300 text-slate-900' : 'bg-white text-slate-800'} flex items-center gap-1 shadow-sm"><img src="${meta.sprite}" class="w-3 h-3 pixel-sprite"/>${sk.evolved ? meta.evolvedName : meta.name} L${sk.level}</span>`;
    }).join("");

    document.getElementById("hudActiveTrainerImg").src = tr.sprite;
    document.getElementById("hudActiveSkillName").textContent = tr.skillName;

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