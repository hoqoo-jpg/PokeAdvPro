/**
 * ============================================================================
 * battle_core_2.js (上半部 - 完整不簡化版)
 * 8分鐘快節奏戰鬥引擎、動態虛擬搖桿、三態戰術大招、腳底環形倒數規、
 * 涉水下沉水花、草地碎葉反饋、怪獸體重抗性、Boss 多重招式輪換與 60FPS 遊戲主循環
 * ============================================================================
 */

const GameApp = {
  canvas: null,
  ctx: null,
  width: window.innerWidth,
  height: window.innerHeight,
  state: "LOADING",
  wizardStep: 1,
  centerTab: "pokemon",

  selectedTrainer: TRAINERS[0],
  selectedStarterId: 25,
  pendingUnlockType: null,
  pendingUnlockId: null,
  pendingUnlockCost: 0,
  useShinyStarter: {},
  pokedexShowBack: {},
  selectedDifficulty: DIFFICULTIES[1],
  selectedStage: STAGES[0],
  timeScale: 1,

  // 天氣測試鎖定開關
  debugWeatherLock: false,

  // 存檔資料
  saveData: {
    coins: 800,
    unlockedPokemon: { 1: true, 4: true, 7: true, 10: true, 16: true, 25: true },
    unlockedTrainers: { ash: true, misty: true, brock: true },
    upgrades: { atk: 0, cd: 0, hp: 0, shiny: 0, fourthSlot: 0, trainerCd: 0, partner: 0, greed: 0 },
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
  hitStopTimer: 0, // 0.08s 頓挫感定格

  enemies: [],
  particles: [],
  floatingTexts: [],
  gems: [],
  mapItems: [],
  activeBoss: null,
  telegraphs: [], // 多形態危險預警系統 (circle, line, ring, multi_pillar)

  // 8 分鐘快局時間軸
  runTime: 0,
  spawnTimer: 0,
  eliteSpawnTimer: 45,       // 45s 首隻精英
  treasureSpawnTimer: 38,    // 38s 寶藏精靈
  magnetSpawnTimer: 35,
  birdBossSpawned: false,    // 5:00 (300s) 三聖鳥
  mewtwoBossSpawned: false,  // 7:30 (450s) 王者超夢
  secretMewSpawned: false,   // 8:00 始祖夢幻
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

  // 封面漫步展示動畫
  titleDemo: {
    camX: 0,
    camY: 0,
    wildWanderers: [
      { id: 25,  offsetX: 160,  offsetY: -80, phase: 0,   dir: 1 },
      { id: 133, offsetX: 340,  offsetY: 75,  phase: 1.2, dir: -1 },
      { id: 16,  offsetX: 520,  offsetY: -95, phase: 2.4, dir: 1 },
      { id: 10,  offsetX: 240,  offsetY: 110, phase: 3.1, dir: 1 },
      { id: 1,   offsetX: 680,  offsetY: 40,  phase: 4.0, dir: -1 },
      { id: 4,   offsetX: 840,  offsetY: -70, phase: 5.2, dir: 1 },
      { id: 7,   offsetX: 980,  offsetY: 90,  phase: 1.8, dir: -1 },
      { id: 54,  offsetX: 1120, offsetY: -40, phase: 2.9, dir: 1 }
    ]
  },

  init() {
    this.canvas = document.getElementById("gameCanvas");
    this.ctx = this.canvas.getContext("2d");
    this.loadSaveData();
    this.resize();
    window.addEventListener("resize", () => this.resize());
    this.bindInputs();
    this.bindTouchJoystick();

    this.updateTitleUI();
    this.lastFrameTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
    this.runAssetPreloader();
  },

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
  },

  loadSaveData() {
    try {
      const raw = localStorage.getItem("POKEMON_ADV_SURVIVORS_V4");
      if (raw) {
        const parsed = JSON.parse(raw);
        this.saveData = {
          ...this.saveData,
          ...parsed,
          unlockedPokemon: { ...this.saveData.unlockedPokemon, ...(parsed.unlockedPokemon || {}) },
          unlockedTrainers: { ...this.saveData.unlockedTrainers, ...(parsed.unlockedTrainers || {}) },
          upgrades: { ...this.saveData.upgrades, ...(parsed.upgrades || {}) },
          stats: { ...this.saveData.stats, ...(parsed.stats || {}) },
          pokedexSeen: { ...this.saveData.pokedexSeen, ...(parsed.pokedexSeen || {}) },
          pokedexCaught: { ...this.saveData.pokedexCaught, ...(parsed.pokedexCaught || {}) },
          pokedexRewardClaimed: { ...(parsed.pokedexRewardClaimed || {}) },
          shinyUnlocked: { ...this.saveData.shinyUnlocked, ...(parsed.shinyUnlocked || {}) },
          claimedAch: { ...(parsed.claimedAch || {}) }
        };
      }
    } catch (e) {}
  },

  saveToStorage() {
    try {
      localStorage.setItem("POKEMON_ADV_SURVIVORS_V4", JSON.stringify(this.saveData));
    } catch (e) {}
    this.updateTitleUI();
  },

  runAssetPreloader() {
    const urls = new Set();
    Object.values(ITEM_SPRITES).forEach(u => urls.add(u));
    TRAINERS.forEach(t => {
      urls.add(t.sprite);
      if (t.sprites) Object.values(t.sprites).forEach(u => urls.add(u));
    });
    POKEMON_DB.forEach(p => {
      urls.add(p.forward_sprite);
      urls.add(p.back_sprite);
    });

    const urlList = Array.from(urls);
    const total = urlList.length;
    let done = 0;
    let finished = false;

    const bar = document.getElementById("preloaderBar");
    const countEl = document.getElementById("preloaderCountText");
    const pctEl = document.getElementById("preloaderPctText");
    const statusEl = document.getElementById("preloaderStatusText");

    const complete = () => {
      if (finished) return;
      finished = true;
      bar.style.width = "100%";
      pctEl.textContent = "100%";
      statusEl.textContent = "關都自然生態、圖鑑快取與招式引擎建構完畢！";
      setTimeout(() => {
        document.getElementById("preloader-screen").classList.add("hidden");
        document.getElementById("splashScreen").classList.remove("hidden");
        this.state = "SPLASH";
      }, 200);
    };

    const step = () => {
      if (finished) return;
      done += 1;
      const pct = Math.min(100, Math.round((done / total) * 100));
      bar.style.width = `${pct}%`;
      countEl.textContent = `${done} / ${total}`;
      pctEl.textContent = `${pct}%`;
      if (done >= total) complete();
    };

    setTimeout(complete, 4500);

    urlList.forEach(url => {
      const rec = SpriteCache.get(url);
      if (rec.loaded || rec.error) step();
      else {
        const ol = rec.img.onload, oe = rec.img.onerror;
        rec.img.onload = () => { rec.loaded = true; if (ol) ol(); step(); };
        rec.img.onerror = () => { rec.error = true; if (oe) oe(); step(); };
      }
    });
  },

  enterLobbyFromSplash() {
    if (this.state !== "SPLASH") return;
    SoundFX.init();
    SoundFX.play("levelup");
    SoundFX.startBgm("lobby");
    this.state = "TITLE";
    document.getElementById("splashScreen").classList.add("hidden");
    document.getElementById("titleScreen").classList.remove("hidden");
    this.updateTitleUI();
  },

  backToSplash() {
    this.state = "SPLASH";
    document.getElementById("titleScreen").classList.add("hidden");
    document.getElementById("splashScreen").classList.remove("hidden");
  },

  toggleBgm() {
    const muted = SoundFX.toggleMute();
    const cls = muted ? "fa-solid fa-volume-xmark text-slate-400" : "fa-solid fa-volume-high text-blue-600";
    const i1 = document.getElementById("hudBgmIcon");
    const i2 = document.getElementById("lobbyBgmIcon");
    if (i1) i1.className = cls;
    if (i2) i2.className = cls;
  },

  updateTitleUI() {
    document.getElementById("titleCoinDisplay").textContent = this.saveData.coins.toLocaleString();
    document.getElementById("shopCoinDisplay").textContent = this.saveData.coins.toLocaleString();
    const wCoin = document.getElementById("wizardCoinDisplay");
    if (wCoin) wCoin.textContent = this.saveData.coins.toLocaleString();
    document.getElementById("titleShinyCount").textContent = Object.keys(this.saveData.shinyUnlocked).length;

    const p = POKEMON_MAP.get(this.selectedStarterId) || POKEMON_MAP.get(25);
    const t = this.selectedTrainer || TRAINERS[0];
    const useShiny = !!this.saveData.shinyUnlocked[p.id] && !!this.useShinyStarter[p.id];

    const lTrImg = document.getElementById("lobbyTrainerPreview");
    const lPkImg = document.getElementById("lobbyPokemonPreview");
    if (lTrImg) {
      lTrImg.src = t.sprite;
      document.getElementById("lobbyTrainerName").textContent = t.name;
    }
    if (lPkImg) {
      lPkImg.src = p.forward_sprite;
      lPkImg.className = `w-12 h-12 sm:w-14 sm:h-14 pixel-sprite object-contain ${useShiny ? 'shiny-sprite-filter' : ''}`;
      document.getElementById("lobbyPokemonName").textContent = `${p.name_zh} (#${String(p.id).padStart(3,'0')})`;
    }

    ["wizardPreviewTrainer", "wizardMobileTrainer"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.src = t.sprite;
    });
    ["wizardPreviewPoke", "wizardMobilePoke"].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.src = p.forward_sprite;
        el.className = `w-6 h-6 pixel-sprite object-contain ${useShiny ? 'shiny-sprite-filter' : ''}`;
      }
    });

    const hasAch = ACHIEVEMENTS.some(a => a.check(this.saveData.stats, this.saveData) && !this.saveData.claimedAch[a.id]);
    document.getElementById("achClaimBadge").classList.toggle("hidden", !hasAch);

    const hasDexReward = POKEMON_DB.some(pk => this.saveData.pokedexCaught[pk.id] && !this.saveData.pokedexRewardClaimed[pk.id]);
    document.getElementById("pokedexRewardBadge").classList.toggle("hidden", !hasDexReward);
  },

  bindInputs() {
    window.addEventListener("keydown", (e) => {
      if (this.state === "SPLASH") {
        this.enterLobbyFromSplash();
        return;
      }
      const k = e.key.toLowerCase();
      this.keys[k] = true;
      if (e.code === "Space" && this.state === "PLAYING") {
        e.preventDefault();
        this.triggerTrainerActiveSkill();
      }
      if (e.key === "Escape" && (this.state === "PLAYING" || this.state === "PAUSED")) {
        this.togglePause();
      }
    });
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
          joyBase.style.display = "block";

          joyStick.style.left = `${t.clientX}px`;
          joyStick.style.top = `${t.clientY}px`;
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

    const onTouchEnd = (e) => {
      if (!this.touchJoy.active) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === this.touchJoy.touchId) {
          this.touchJoy.active = false;
          this.touchJoy.touchId = null;
          this.touchJoy.dx = 0;
          this.touchJoy.dy = 0;
          joyBase.style.display = "none";
          joyStick.style.display = "none";
          break;
        }
      }
    };

    window.addEventListener("touchstart", onTouchStart, { passive: false });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("touchcancel", onTouchEnd);
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

  // 三步驟選角嚮導
  openSetupFlow() {
    SoundFX.init();
    document.getElementById("titleScreen").classList.add("hidden");
    document.getElementById("setupModal").classList.remove("hidden");
    this.setWizardStep(1);
  },

  backToTitle() {
    document.getElementById("setupModal").classList.add("hidden");
    document.getElementById("titleScreen").classList.remove("hidden");
    this.updateTitleUI();
  },

  setWizardStep(step) {
    this.wizardStep = step;
    [1, 2, 3].forEach(s => {
      document.getElementById(`wizardStep${s}`).classList.toggle("hidden", s !== step);
      const tab = document.getElementById(`stepTab${s}`);
      tab.className = s === step
        ? "py-3 border-b-4 border-red-600 text-red-600 bg-white"
        : "py-3 border-b-4 border-transparent text-slate-500";
    });

    const titles = {
      1: ["STEP 1/3：選擇隨行訓練家", "6 位訓練家皆有專屬代表精靈羈絆（傷害+25%）！底部為隱藏冠軍【赤紅】"],
      2: ["STEP 2/3：選擇出戰寶可夢", "與所選訓練家有羈絆的精靈已【自動置頂高亮】！全一階基礎精靈皆可挑選！"],
      3: ["STEP 3/3：選擇模式與 GBA 自然生態", "8分鐘極速快局 ‧ 整合沙盒 V11 超細緻地表與拍岸海浪！"]
    };
    document.getElementById("wizardStepTitle").textContent = titles[step][0];
    document.getElementById("wizardStepDesc").textContent = titles[step][1];
    document.getElementById("btnWizardPrev").textContent = step === 1 ? "← 返回大廳" : "← 上一步";
    document.getElementById("btnWizardNext").textContent = step === 3 ? "立即出發冒險 →" : "下一步 →";

    this.renderWizardContent();
    this.updateTitleUI();
  },

  prevWizardStep() {
    if (this.wizardStep <= 1) this.backToTitle();
    else this.setWizardStep(this.wizardStep - 1);
  },

  nextWizardStep() {
    if (this.wizardStep < 3) this.setWizardStep(this.wizardStep + 1);
    else this.startGameRun();
  },

  renderWizardContent() {
    const tBox = document.getElementById("wizardStep1");
    const isRedUnlocked = !!this.saveData.unlockedTrainers["red"] || (this.saveData.stats.mewtwoDefeated >= 1);
    if (isRedUnlocked) this.saveData.unlockedTrainers["red"] = true;

    tBox.innerHTML = TRAINERS.map(t => {
      const unlocked = !!this.saveData.unlockedTrainers[t.id];
      const selected = this.selectedTrainer.id === t.id;
      const bondIcons = (t.bondPreviewIds || []).map(pid => {
        const bp = POKEMON_MAP.get(pid);
        return bp ? `<img src="${bp.forward_sprite}" title="${bp.name_zh}" class="w-7 h-7 pixel-sprite bg-white rounded-full border border-slate-300 p-0.5"/>` : '';
      }).join("");

      return `
        <div onclick="GameApp.handleTrainerCardClick('${t.id}')" class="poke-card cursor-pointer p-3.5 flex flex-col justify-between ${selected ? 'selected' : ''} ${!unlocked ? 'opacity-85 bg-slate-100' : ''}">
          <div>
            <div class="flex items-center gap-3 mb-2">
              <div class="w-13 h-13 rounded-2xl bg-amber-50 border-2 border-slate-800 flex items-center justify-center shrink-0">
                <img src="${t.sprite}" class="w-11 h-11 pixel-sprite object-contain ${!unlocked && t.isHiddenRed ? 'brightness-0' : ''}" alt="${t.name}" />
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center justify-between gap-1">
                  <span class="font-black text-sm text-slate-800 truncate">${!unlocked && t.isHiddenRed ? '??? 傳奇冠軍' : t.name}</span>
                  ${selected ? `<span class="px-2 py-0.5 bg-blue-600 text-white text-[10px] font-black rounded-full">出戰中</span>` : ''}
                </div>
                <div class="text-[11px] font-bold text-blue-700">${t.title}</div>
                <div class="text-[10px] font-black text-amber-800 bg-amber-100 inline-block px-2 py-0.5 rounded-full mt-0.5">指令：${t.skillName} (CD ${t.skillCd}s)</div>
              </div>
            </div>
            <div class="flex items-center justify-between bg-slate-100 px-2 py-1 rounded-xl border border-slate-200 mb-1.5">
              <span class="text-[10px] font-black text-slate-700">專屬羈絆【${t.bondName}】：</span>
              <div class="flex items-center -space-x-1">${bondIcons}</div>
            </div>
            <p class="text-xs font-bold text-slate-600 leading-relaxed">${t.desc}</p>
          </div>
          <div class="mt-2.5 pt-2 border-t border-slate-200 flex items-center justify-between">
            ${unlocked
              ? `<span class="text-xs font-black text-emerald-600"><i class="fa-solid fa-circle-check"></i> 已解鎖可用</span>`
              : (t.isHiddenRed
                  ? `<span class="text-xs font-black text-purple-700"><i class="fa-solid fa-lock"></i> 擊敗 7.5m 超夢解鎖</span>`
                  : `<span class="text-xs font-black text-amber-600 flex items-center gap-1"><img src="${ITEM_SPRITES.coin}" class="w-4 h-4 pixel-sprite"/> ${t.cost} 代幣解鎖</span>`
                )
            }
            <button class="${selected ? 'poke-btn-blue' : 'poke-btn-red'} px-3 py-1 text-xs font-black">${unlocked ? (selected ? '已選擇' : '選擇') : (t.isHiddenRed ? '條件' : '解鎖')}</button>
          </div>
        </div>
      `;
    }).join("");

    // Step 2：全一階基礎精靈開放，羈絆與已收服優先置頂
    const pBox = document.getElementById("wizardStep2");
    const bondSet = new Set(this.selectedTrainer.bondPokemonIds || []);

    const baseFormPokemon = POKEMON_DB.filter(p => {
      return !POKEMON_DB.some(parent => parent.evo_to === p.id);
    });

    const sortedRoster = [...baseFormPokemon].sort((a, b) => {
      const aUnlocked = this.saveData.unlockedPokemon[a.id] ? 1 : 0;
      const bUnlocked = this.saveData.unlockedPokemon[b.id] ? 1 : 0;
      const aBond = bondSet.has(a.id) ? 1 : 0;
      const bBond = bondSet.has(b.id) ? 1 : 0;
      return (bBond * 2 + bUnlocked) - (aBond * 2 + aUnlocked);
    });

    pBox.innerHTML = sortedRoster.map(p => {
      const unlocked = !!this.saveData.unlockedPokemon[p.id];
      const selected = this.selectedStarterId === p.id;
      const hasShiny = !!this.saveData.shinyUnlocked[p.id];
      const useShiny = hasShiny && !!this.useShinyStarter[p.id];
      const isBond = bondSet.has(p.id);
      const sk = SKILLS_CATALOG[p.skill];
      const unlockCost = p.id === 25 ? 0 : (p.id <= 9 ? 150 : (p.id >= 147 ? 350 : 100));

      return `
        <div onclick="GameApp.handlePokemonCardClick(${p.id}, ${unlockCost})" class="poke-card cursor-pointer p-3 flex flex-col justify-between ${selected ? 'selected' : ''} ${isBond ? 'border-amber-400 bg-amber-50/30' : ''} ${!unlocked ? 'opacity-80 bg-slate-100' : ''}">
          <div>
            <div class="flex items-center justify-between gap-1 mb-1">
              <span class="font-pixel text-[10px] text-slate-500">#${String(p.id).padStart(3,'0')}</span>
              ${isBond
                ? `<span class="px-1.5 py-0.5 bg-amber-400 text-slate-900 font-black text-[9px] rounded-full border border-slate-800 animate-pulse">羈絆+25%</span>`
                : `<span class="px-1.5 py-0.5 bg-slate-100 text-slate-600 font-bold text-[9px] rounded-full">${p.evo_to ? '可進化' : '單一階'}</span>`
              }
            </div>
            <div class="relative h-15 flex items-center justify-center my-1 bg-sky-50/60 rounded-xl border border-slate-200">
              <img src="${p.forward_sprite}" class="w-13 h-13 pixel-sprite object-contain ${useShiny ? 'shiny-sprite-filter' : ''}" alt="${p.name_zh}" />
              ${hasShiny ? `
                <button onclick="event.stopPropagation(); GameApp.toggleStarterShiny(${p.id})" class="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-full text-[8px] font-black border flex items-center gap-0.5 ${useShiny ? 'bg-amber-400 text-slate-900 border-slate-900' : 'bg-white/90 text-slate-600 border-slate-400'}">
                  <img src="${ITEM_SPRITES.starPiece}" class="w-3 h-3 pixel-sprite"/>${useShiny ? '閃光中' : '切換閃光'}
                </button>
              ` : ''}
            </div>
            <div class="font-black text-sm text-slate-800 text-center">${p.name_zh}</div>
            <div class="flex items-center justify-center gap-1 my-1">
              ${renderTypeBadgeHTML(p.type1)}
              ${renderTypeBadgeHTML(p.type2)}
            </div>
            <div class="text-[10px] font-bold text-slate-600 bg-slate-50 p-1.5 rounded-lg border border-slate-200 space-y-0.5">
              <div class="flex justify-between"><span>HP:<strong>${p.hp}</strong></span><span>ATK:<strong>${p.atk}</strong></span><span>SPD:<strong>${p.speed}</strong></span></div>
              <div class="text-blue-700 truncate">招式：${sk ? sk.name : p.skill}</div>
            </div>
          </div>
          <div class="mt-2 pt-1.5 border-t border-slate-200 flex items-center justify-between">
            ${unlocked
              ? `<span class="text-[11px] font-black text-emerald-600">已收服</span>`
              : `<span class="text-[11px] font-black text-amber-600 flex items-center gap-0.5"><img src="${ITEM_SPRITES.coin}" class="w-3.5 h-3.5 pixel-sprite"/>${unlockCost}</span>`
            }
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black ${selected ? 'bg-blue-600 text-white' : 'bg-red-600 text-white'}">${unlocked ? (selected ? '已出戰' : '選擇') : '解鎖'}</span>
          </div>
        </div>
      `;
    }).join("");

    document.getElementById("difficultyGrid").innerHTML = DIFFICULTIES.map(d => {
      const sel = this.selectedDifficulty.id === d.id;
      return `
        <div onclick="GameApp.selectDifficulty('${d.id}')" class="poke-card cursor-pointer p-3 flex flex-col justify-between ${sel ? 'selected' : ''}">
          <div>
            <div class="flex items-center justify-between gap-1 mb-1">
              <span class="font-black text-xs text-slate-800">${d.name}</span>
              <span class="px-2 py-0.5 bg-amber-100 text-amber-800 font-black text-[10px] rounded-full">${d.badge}</span>
            </div>
            <p class="text-xs font-bold text-slate-600 leading-relaxed">${d.desc}</p>
          </div>
          <div class="mt-2 text-right">
            <span class="text-[10px] font-black ${sel ? 'text-blue-600' : 'text-slate-400'}">${sel ? '目前選用' : '點擊切換'}</span>
          </div>
        </div>
      `;
    }).join("");

    document.getElementById("stageGrid").innerHTML = STAGES.map(st => {
      const sel = this.selectedStage.id === st.id;
      return `
        <div onclick="GameApp.selectStage('${st.id}')" class="poke-card cursor-pointer p-3.5 flex flex-col justify-between ${sel ? 'selected' : ''}">
          <div>
            <div class="flex items-center justify-between gap-1 mb-1">
              <span class="font-black text-xs text-slate-800">${st.name}</span>
              <span class="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-black text-[10px] rounded-full">賞金 ${st.rewardMult}x</span>
            </div>
            <div class="w-full h-3.5 rounded-full my-1.5 border border-slate-700 flex overflow-hidden">
              <span style="background:${st.tileLight}" class="flex-1"></span>
              <span style="background:${st.tileDark}" class="flex-1"></span>
              <span style="background:${st.roadColor}" class="flex-1"></span>
              <span style="background:${st.waterColor}" class="flex-1"></span>
            </div>
            <div class="text-[10px] font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md my-1 border border-indigo-200">${st.buffDesc}</div>
            <p class="text-xs font-bold text-slate-600 leading-relaxed">${st.desc}</p>
          </div>
          <div class="mt-2 text-right">
            <span class="text-[10px] font-black ${sel ? 'text-blue-600' : 'text-slate-400'}">${sel ? '目前選用' : '點擊切換'}</span>
          </div>
        </div>
      `;
    }).join("");
  },

  handleTrainerCardClick(trainerId) {
    const t = TRAINERS.find(x => x.id === trainerId);
    if (!t) return;
    const unlocked = !!this.saveData.unlockedTrainers[t.id];
    if (unlocked) {
      this.selectedTrainer = t;
      SoundFX.play("hit");
      this.renderWizardContent();
      this.updateTitleUI();
      return;
    }
    if (t.isHiddenRed) {
      alert("【傳奇訓練家・赤紅】解鎖條件：在任意難度下擊敗 7.5 分鐘最終 Boss【超夢 #150】即可永久解鎖！");
      return;
    }
    this.openUnlockConfirmModal("trainer", t.id, t.cost);
  },

  handlePokemonCardClick(pokeId, cost) {
    if (this.saveData.unlockedPokemon[pokeId]) {
      this.selectedStarterId = pokeId;
      SoundFX.play("hit");
      this.renderWizardContent();
      this.updateTitleUI();
      return;
    }
    this.openUnlockConfirmModal("pokemon", pokeId, cost);
  },

  toggleStarterShiny(id) {
    this.useShinyStarter[id] = !this.useShinyStarter[id];
    SoundFX.play("super");
    this.renderWizardContent();
    this.updateTitleUI();
  },

  selectDifficulty(id) {
    const found = DIFFICULTIES.find(d => d.id === id);
    if (found) {
      this.selectedDifficulty = found;
      SoundFX.play("hit");
      this.renderWizardContent();
    }
  },

  selectStage(id) {
    const found = STAGES.find(s => s.id === id);
    if (found) {
      this.selectedStage = found;
      MapEngine.setStage(found.id);
      SoundFX.play("hit");
      this.renderWizardContent();
    }
  },

  openUnlockConfirmModal(type, id, cost) {
    this.pendingUnlockType = type;
    this.pendingUnlockId = id;
    this.pendingUnlockCost = cost;
    document.getElementById("unlockConfirmError").classList.add("hidden");
    document.getElementById("unlockConfirmCost").textContent = cost.toLocaleString();

    if (type === "pokemon") {
      const p = POKEMON_MAP.get(id);
      const sk = SKILLS_CATALOG[p.skill];
      document.getElementById("unlockModalHeaderTitle").textContent = "寶可夢收服確認";
      document.getElementById("unlockConfirmFrontImg").src = p.forward_sprite;
      document.getElementById("unlockConfirmBackImg").src = p.back_sprite;
      document.getElementById("unlockBackCol").classList.remove("hidden");
      document.getElementById("unlockConfirmName").textContent = `${p.name_zh} (#${String(p.id).padStart(3,'0')})`;
      document.getElementById("unlockConfirmTypes").innerHTML = `${renderTypeBadgeHTML(p.type1)}${renderTypeBadgeHTML(p.type2)}`;
      document.getElementById("unlockConfirmStats").innerHTML = `
        <div>生命 HP：<strong>${p.hp}</strong> ｜ 攻擊：<strong>${p.atk}</strong> ｜ 速度：<strong>${p.speed}</strong></div>
        <div class="text-blue-700">初始招式：【${sk ? sk.name : p.skill}】</div>
      `;
    } else {
      const t = TRAINERS.find(x => x.id === id);
      document.getElementById("unlockModalHeaderTitle").textContent = "隨行訓練家解鎖確認";
      document.getElementById("unlockConfirmFrontImg").src = t.sprite;
      document.getElementById("unlockBackCol").classList.add("hidden");
      document.getElementById("unlockConfirmName").textContent = t.name;
      document.getElementById("unlockConfirmTypes").innerHTML = `<span class="px-2 py-0.5 bg-amber-100 text-amber-800 text-xs font-black rounded-full">${t.title}</span>`;
      document.getElementById("unlockConfirmStats").innerHTML = `
        <div>戰術技能：【${t.skillName}】(CD ${t.skillCd}s)</div>
        <div class="text-slate-600">${t.desc}</div>
      `;
    }

    document.getElementById("unlock-confirm-modal").classList.remove("hidden");
  },

  closeUnlockConfirmModal() {
    document.getElementById("unlock-confirm-modal").classList.add("hidden");
  },

  confirmUnlockAction() {
    if (this.saveData.coins < this.pendingUnlockCost) {
      document.getElementById("unlockConfirmError").classList.remove("hidden");
      return;
    }
    this.saveData.coins -= this.pendingUnlockCost;
    if (this.pendingUnlockType === "pokemon") {
      this.saveData.unlockedPokemon[this.pendingUnlockId] = true;
      this.saveData.pokedexSeen[this.pendingUnlockId] = true;
      this.saveData.pokedexCaught[this.pendingUnlockId] = true;
      this.selectedStarterId = this.pendingUnlockId;
    } else {
      this.saveData.unlockedTrainers[this.pendingUnlockId] = true;
      const found = TRAINERS.find(x => x.id === this.pendingUnlockId);
      if (found) this.selectedTrainer = found;
    }
    SoundFX.play("levelup");
    this.saveToStorage();
    this.closeUnlockConfirmModal();
    this.renderWizardContent();
  },

  openPokedexModal() {
    document.getElementById("pokedexModal").classList.remove("hidden");
    this.renderPokedexFilterTabs();
    this.renderPokedexGrid("ALL");
  },

  closePokedexModal() {
    document.getElementById("pokedexModal").classList.add("hidden");
    this.updateTitleUI();
  },

  renderPokedexFilterTabs() {
    const tabs = [
      { key: "ALL", label: "全部 151" },
      { key: "CAUGHT", label: "已收服" },
      { key: "Grass", label: "草系" },
      { key: "Fire", label: "火系" },
      { key: "Water", label: "水系" },
      { key: "Electric", label: "電系" },
      { key: "Psychic", label: "超能/幽靈" },
      { key: "Dragon", label: "傳說/龍" }
    ];

    document.getElementById("pokedexFilterTabs").innerHTML = tabs.map((t, idx) => `
      <button onclick="GameApp.renderPokedexGrid('${t.key}')" class="px-3 py-1 rounded-full text-xs font-black whitespace-nowrap border ${idx === 0 ? 'bg-red-600 text-white border-red-700' : 'bg-white text-slate-700 border-slate-300'}">
        ${t.label}
      </button>
    `).join("");
  },

  renderPokedexGrid(filterKey = "ALL") {
    let list = POKEMON_DB;
    if (filterKey === "CAUGHT") list = list.filter(p => this.saveData.pokedexCaught[p.id]);
    else if (filterKey === "Psychic") list = list.filter(p => p.type1 === "Psychic" || p.type1 === "Ghost");
    else if (filterKey === "Dragon") list = list.filter(p => p.type1 === "Dragon" || [144,145,146,150,151].includes(p.id));
    else if (filterKey !== "ALL") list = list.filter(p => p.type1 === filterKey || p.type2 === filterKey);

    const grid = document.getElementById("pokedexGrid");
    grid.innerHTML = list.map(p => {
      const seen = !!this.saveData.pokedexSeen[p.id];
      const caught = !!this.saveData.pokedexCaught[p.id];
      const shiny = !!this.saveData.shinyUnlocked[p.id];
      const claimed = !!this.saveData.pokedexRewardClaimed[p.id];
      const showBack = !!this.pokedexShowBack[p.id];
      const imgUrl = showBack ? p.back_sprite : p.forward_sprite;

      return `
        <div onclick="GameApp.togglePokedexCardSide(${p.id})" class="poke-card min-h-[162px] p-2 flex flex-col justify-between cursor-pointer ${caught ? 'border-blue-500' : 'opacity-80'}">
          <div class="flex items-center justify-between text-[10px] font-bold">
            <span class="font-pixel text-slate-500">#${String(p.id).padStart(3,'0')}</span>
            ${shiny ? `<span class="px-1.5 py-0.5 bg-amber-300 text-slate-900 rounded-full font-black text-[8px]">閃光</span>`
                   : (caught ? `<span class="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-black text-[8px]">已登錄</span>`
                             : `<span class="text-slate-400">? 未發現</span>`)}
          </div>
          <div class="h-15 flex items-center justify-center my-1 bg-sky-50/60 rounded-xl relative">
            <img src="${imgUrl}" class="w-13 h-13 pixel-sprite object-contain ${!seen ? 'brightness-0 opacity-20' : ''}" alt="${p.name_zh}" />
          </div>
          <div class="text-center">
            <div class="font-black text-xs text-slate-800 truncate">${seen ? p.name_zh : '？？？'}</div>
            <div class="flex justify-center gap-0.5 my-0.5">${seen ? renderTypeBadgeHTML(p.type1) + renderTypeBadgeHTML(p.type2) : ''}</div>
          </div>
          ${caught && !claimed
            ? `<button onclick="event.stopPropagation(); GameApp.claimPokedexReward(${p.id})" class="poke-btn-yellow w-full py-1 text-[10px] font-black">領取 +50 代幣</button>`
            : `<div class="text-[9px] text-center font-bold text-slate-400">${claimed ? '賞金已領取' : '點擊翻轉正反'}</div>`
          }
        </div>
      `;
    }).join("");
  },

  togglePokedexCardSide(id) {
    this.pokedexShowBack[id] = !this.pokedexShowBack[id];
    this.renderPokedexGrid();
  },

  claimPokedexReward(id) {
    if (!this.saveData.pokedexCaught[id] || this.saveData.pokedexRewardClaimed[id]) return;
    this.saveData.pokedexRewardClaimed[id] = true;
    this.saveData.coins += 50;
    SoundFX.play("levelup");
    this.saveToStorage();
    this.renderPokedexGrid();
  },

  claimAllPokedexRewards() {
    let count = 0;
    POKEMON_DB.forEach(pk => {
      if (this.saveData.pokedexCaught[pk.id] && !this.saveData.pokedexRewardClaimed[pk.id]) {
        this.saveData.pokedexRewardClaimed[pk.id] = true;
        this.saveData.coins += 50;
        count++;
      }
    });
    if (count > 0) {
      SoundFX.play("levelup");
      this.saveToStorage();
      this.renderPokedexGrid();
      this.updateTitleUI();
      alert(`成功領取 ${count} 隻圖鑑賞金，獲得 +${count * 50} 代幣！`);
    } else {
      alert("目前沒有可領取的圖鑑賞金！");
    }
  },

  openSkillTreeModal() {
    document.getElementById("skillTreeModal").classList.remove("hidden");
    this.switchCenterTab(this.centerTab || "pokemon");
  },

  closeSkillTreeModal() {
    document.getElementById("skillTreeModal").classList.add("hidden");
    this.updateTitleUI();
  },

  switchCenterTab(tab) {
    this.centerTab = tab;
    const b1 = document.getElementById("centerTabBtn1");
    const b2 = document.getElementById("centerTabBtn2");
    if (tab === "pokemon") {
      b1.className = "py-3 border-b-4 border-red-600 text-red-600 bg-white";
      b2.className = "py-3 border-b-4 border-transparent text-slate-500";
    } else {
      b2.className = "py-3 border-b-4 border-red-600 text-red-600 bg-white";
      b1.className = "py-3 border-b-4 border-transparent text-slate-500";
    }
    this.renderCenterUpgrades();
  },

  renderCenterUpgrades() {
    document.getElementById("shopCoinDisplay").textContent = this.saveData.coins.toLocaleString();
    const list = this.centerTab === "pokemon" ? CENTER_POKEMON_UPGRADES : CENTER_TRAINER_UPGRADES;
    const box = document.getElementById("skillTreeContainer");

    box.innerHTML = list.map(u => {
      const lv = this.saveData.upgrades[u.id] || 0;
      const isMax = lv >= u.maxLv;
      const cost = Math.round(u.baseCost * Math.pow(1.45, lv));

      return `
        <div class="poke-card p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${u.isSpecialSlot ? 'rarity-legendary' : ''}">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-2xl bg-sky-50 border-2 border-slate-800 flex items-center justify-center shrink-0">
              <img src="${u.sprite}" class="w-8 h-8 pixel-sprite object-contain" alt="${u.name}" />
            </div>
            <div>
              <div class="flex items-center gap-2">
                <span class="font-black text-sm sm:text-base text-slate-800">${u.name}</span>
                <span class="px-2 py-0.5 bg-blue-600 text-white font-pixel text-[9px] rounded-full">Lv.${lv}/${u.maxLv}</span>
              </div>
              <p class="text-xs font-bold text-slate-600 mt-0.5">${u.desc}</p>
            </div>
          </div>
          <button onclick="GameApp.buyUpgrade('${u.id}', ${u.baseCost}, ${u.maxLv})" ${isMax ? 'disabled' : ''} class="${isMax ? 'poke-btn-white opacity-60' : 'poke-btn-red'} px-4 py-2 text-xs font-black shrink-0 flex items-center gap-1.5 min-h-[40px]">
            ${isMax ? '已達上限' : `<img src="${ITEM_SPRITES.coin}" class="w-4 h-4 pixel-sprite"/> ${cost} 強化`}
          </button>
        </div>
      `;
    }).join("");
  },

  buyUpgrade(id, baseCost, maxLv) {
    const lv = this.saveData.upgrades[id] || 0;
    if (lv >= maxLv) return;
    const cost = Math.round(baseCost * Math.pow(1.45, lv));
    if (this.saveData.coins < cost) {
      alert("代幣不足！可至 151 圖鑑領取賞金！");
      return;
    }
    this.saveData.coins -= cost;
    this.saveData.upgrades[id] = lv + 1;
    SoundFX.play("levelup");
    this.saveToStorage();
    this.renderCenterUpgrades();
  },

  openAchievementModal() {
    document.getElementById("achievementModal").classList.remove("hidden");
    this.renderAchievements();
  },

  closeAchievementModal() {
    document.getElementById("achievementModal").classList.add("hidden");
    this.updateTitleUI();
  },

  renderAchievements() {
    const box = document.getElementById("achievementListContainer");
    box.innerHTML = ACHIEVEMENTS.map(a => {
      const unlocked = a.check(this.saveData.stats, this.saveData);
      const claimed = !!this.saveData.claimedAch[a.id];
      return `
        <div class="poke-card p-3 flex items-center justify-between gap-3">
          <div>
            <div class="font-black text-sm text-slate-800">${a.name}</div>
            <div class="text-xs font-bold text-slate-600">${a.desc}</div>
            <div class="text-xs font-black text-amber-600 mt-0.5">+${a.reward} 代幣</div>
          </div>
          ${unlocked && !claimed
            ? `<button onclick="GameApp.claimAchievement('${a.id}', ${a.reward})" class="poke-btn-red px-4 py-1.5 text-xs font-black shrink-0 min-h-[38px]">領取賞金</button>`
            : `<span class="text-xs font-black ${claimed ? 'text-emerald-600' : 'text-slate-400'} shrink-0">${claimed ? '已領取' : '未達成'}</span>`
          }
        </div>
      `;
    }).join("");
  },

  claimAchievement(id, reward) {
    if (this.saveData.claimedAch[id]) return;
    this.saveData.claimedAch[id] = true;
    this.saveData.coins += reward;
    SoundFX.play("levelup");
    this.saveToStorage();
    this.renderAchievements();
  },

  /**
   * ============================================================================
   * 8 分鐘快節奏開局與戰鬥循環
   * ============================================================================
   */
  startGameRun() {
    SoundFX.init();
    SoundFX.startBgm("battle");
    document.getElementById("setupModal").classList.add("hidden");
    document.getElementById("titleScreen").classList.add("hidden");
    document.getElementById("hudLayer").classList.remove("hidden");

    const basePoke = POKEMON_MAP.get(this.selectedStarterId) || POKEMON_MAP.get(25);
    const tr = this.selectedTrainer || TRAINERS[0];
    const upg = this.saveData.upgrades;

    const isBond = (tr.bondPokemonIds || []).includes(basePoke.id);
    const hasShiny = !!this.saveData.shinyUnlocked[basePoke.id] && !!this.useShinyStarter[basePoke.id];
    const shinyMult = hasShiny ? 1.20 : 1.0;

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
      isJumpingLedge: false,
      jumpTimer: 0
    };

    const initSkillId = SKILLS_CATALOG[basePoke.skill] ? basePoke.skill : "Tackle";
    this.player.skills[initSkillId] = { id: initSkillId, level: 1, evolved: false, timer: 0.2 };

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
      jumpTimer: 0
    };

    this.partners = [];
    this.enemies = [];
    this.particles = [];
    this.floatingTexts = [];
    this.gems = [];
    this.mapItems = [];
    this.telegraphs = [];
    this.activeBoss = null;
    this.debugWeatherLock = false;
    this.skillDamageStats = {};

    // 呼叫獨立招式引擎重置
    SkillsEngine.reset();

    if (tr.mods.startPartner || (upg.partner >= 1)) {
      this.summonOrUpgradePartner();
    }

    // 8 分鐘時間軸重置
    this.runTime = 0;
    this.spawnTimer = 0.5;
    this.eliteSpawnTimer = 45;       // 45s 首隻精英
    this.treasureSpawnTimer = 38;    // 38s 寶藏怪
    this.magnetSpawnTimer = 35;
    this.birdBossSpawned = false;    // 300s (5分)
    this.mewtwoBossSpawned = false;  // 450s (7.5分)
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

  // 戰術大招發動
  triggerTrainerActiveSkill() {
    if (this.state !== "PLAYING" || !this.player) return;
    if (this.player.trainerSkillCd > 0 || this.player.buffTimer > 0 || this.player.shieldTimer > 0) return;

    const tr = this.selectedTrainer;
    const p = this.player;
    p.status = null;
    p.statusTimer = 0;

    // 二次元眼神斜切特寫
    const cutLayer = document.getElementById("cutInLayer");
    const cutStrip = document.getElementById("cutInStrip");
    const cutAvatar = document.getElementById("cutInAvatar");
    const cutTrainer = document.getElementById("cutInTrainer");
    const cutSkill = document.getElementById("cutInSkill");

    if (cutLayer && cutStrip) {
      cutAvatar.src = tr.sprite;
      cutTrainer.textContent = `${tr.name} ‧ 戰術指令`;
      cutSkill.textContent = `【${tr.skillName}】`;
      cutLayer.classList.remove("hidden");
      cutStrip.classList.remove("cut-in-active");
      void cutStrip.offsetWidth;
      cutStrip.classList.add("cut-in-active");
      setTimeout(() => cutLayer.classList.add("hidden"), 750);
    }

    // 全場 0.08 秒定格
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
      this.spawnFloatingText(p.x, p.y - 35, "小智熱血狂暴! 攻速暴擊UP!", "#F59E0B", 15);
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
      this.partners.forEach(pt => {
        pt.level += 1;
        if (pt.data.evo_level !== "None" && pt.level >= 5 && pt.data.evo_to) {
          const nextData = POKEMON_MAP.get(pt.data.evo_to);
          if (nextData) {
            pt.id = nextData.id;
            pt.data = nextData;
            this.saveData.pokedexSeen[nextData.id] = true;
            this.saveData.pokedexCaught[nextData.id] = true;
          }
        }
      });
      this.spawnFloatingText(this.player.x, this.player.y - 28, `雙打夥伴等級提升!`, "#EC4899", 14);
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
    this.titleDemo.camX += 38 * dt;
    this.titleDemo.camY = Math.sin(this.titleDemo.camX * 0.003) * 45;
  },

  renderTitleDemo() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
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

  // 戰鬥邏輯更新
  updateCombat(dt) {
    this.runTime += dt;
    const p = this.player;

    if (p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + p.regen * dt);
    if (p.invulnTimer > 0) p.invulnTimer -= dt;

    // 大招三態：持續時間倒數完畢後，才正式進入 CD 倒數！
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

    if (this.camera.shakeTime > 0) this.camera.shakeTime -= dt;

    // 狀態異常 DOT
    if (p.statusTimer > 0) {
      p.statusTimer -= dt;
      p.statusTick -= dt;
      if (p.statusTick <= 0) {
        p.statusTick = 0.65;
        if (p.status === "Burn" || p.status === "Poison") {
          const dotDmg = Math.max(3, Math.round(p.maxHp * 0.015));
          p.hp = Math.max(1, p.hp - dotDmg);
          this.spawnFloatingText(p.x, p.y - 22, `${p.status === 'Burn' ? '灼傷' : '中毒'} -${dotDmg}`, p.status === 'Burn' ? "#F97316" : "#A855F7", 11);
        }
      }
      if (p.statusTimer <= 0) p.status = null;
    }

    // 移動向量計算
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

    // 地形判定
    const terrain = MapEngine.getTerrainModifierAt(p.x, p.y);
    if (terrain.inWater && MapEngine.currentStage.id === "cerulean_bay" && p.hp < p.maxHp) {
      p.hp = Math.min(p.maxHp, p.hp + 2.0 * dt);
    }

    // --- 草皮行走撥草與碎葉反饋 (玩家與隨行訓練家) ---
    if (ilen > 0.05 && terrain.label.includes("草叢")) {
      if (Math.random() < 0.28) {
        this.particles.push({
          x: p.x + (Math.random() - 0.5) * 16,
          y: p.y + 10,
          vx: (Math.random() - 0.5) * 24 - p.vx * 0.1,
          vy: -10 - Math.random() * 14,
          size: 2.5 + Math.random() * 2,
          color: Math.random() < 0.5 ? "#22C55E" : "#84CC16",
          shape: "petal",
          rot: Math.random() * Math.PI,
          life: 0.32,
          maxLife: 0.32
        });
      }
      if (Math.random() < 0.20 && this.trainerCompanion) {
        this.particles.push({
          x: this.trainerCompanion.x + (Math.random() - 0.5) * 14,
          y: this.trainerCompanion.y + 12,
          vx: (Math.random() - 0.5) * 20,
          vy: -10 - Math.random() * 12,
          size: 2.2,
          color: "#22C55E",
          shape: "petal",
          life: 0.30,
          maxLife: 0.30
        });
      }
    }

    // --- 涉水撲騰水花微滴噴濺 (玩家與隨行訓練家) ---
    if (terrain.inWater && ilen > 0.05) {
      if (Math.random() < 0.30) {
        this.particles.push({
          x: p.x + (Math.random() - 0.5) * 14,
          y: p.y + 14,
          vx: (Math.random() - 0.5) * 35,
          vy: -15 - Math.random() * 20,
          size: 2.2,
          color: "#E0F2FE",
          shape: "circle",
          life: 0.25,
          maxLife: 0.25
        });
      }
      if (Math.random() < 0.22 && this.trainerCompanion) {
        this.particles.push({
          x: this.trainerCompanion.x + (Math.random() - 0.5) * 14,
          y: this.trainerCompanion.y + 16,
          vx: (Math.random() - 0.5) * 30,
          vy: -12 - Math.random() * 18,
          size: 2.0,
          color: "#E0F2FE",
          shape: "circle",
          life: 0.22,
          maxLife: 0.22
        });
      }
    }

    const tBadge = document.getElementById("hudTerrainBadge");
    if (terrain.label) {
      tBadge.textContent = terrain.label;
      tBadge.classList.remove("hidden");
    } else {
      tBadge.classList.add("hidden");
    }

    const pStatusEl = document.getElementById("hudPlayerStatusBadge");
    if (p.status) {
      const stNames = { Burn: "灼傷中", Paralysis: "麻痺減速", Freeze: "冰凍遲緩", Poison: "中毒中", Confusion: "混亂反向" };
      pStatusEl.textContent = `[異常] ${stNames[p.status] || p.status}`;
      pStatusEl.classList.remove("hidden");
    } else {
      pStatusEl.classList.add("hidden");
    }

    const statusSpdMod = p.status === "Freeze" ? 0.45 : (p.status === "Paralysis" ? 0.65 : 1.0);
    
    // 【嚴格修正】：移動速度回歸 GBA 原版精準數值，徹底解決超快失控問題
    const moveSpd = (85 + p.baseSpeed * 1.15) * p.speedMult * terrain.speedMult * statusSpdMod * (p.buffTimer > 0 ? 1.25 : 1.0);

    // --- 單向跳崖 (Ledge Jump) 滯空拋物線位移與免傷 ---
    if (p.isJumpingLedge) {
      p.jumpTimer -= dt;
      p.vy = 260;
      p.y += p.vy * dt;
      p.invulnTimer = Math.max(p.invulnTimer, 0.1);

      if (p.jumpTimer <= 0) {
        p.isJumpingLedge = false;
        p.jumpTimer = 0;
        SoundFX.play("hit");
        this.spawnParticleCluster(p.x, p.y + 16, "#CBD5E1", "#94A3B8", 8, "circle", 0.6);
      }
    } else {
      p.vx = ix * moveSpd;
      p.vy = iy * moveSpd;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }

    MapEngine.resolveObstacleCollision(p, 18, true);

    // 隨行訓練家跟隨與跳崖判定
    const sideOffset = (p.facingX !== 0 ? p.facingX : (p.lastFacingX || -1)) * 28;
    const targetTx = p.x - sideOffset;
    const targetTy = p.y + (p.facingY < 0 ? 12 : -8);
    this.trainerCompanion.x += (targetTx - this.trainerCompanion.x) * Math.min(1, dt * 11.5);
    this.trainerCompanion.y += (targetTy - this.trainerCompanion.y) * Math.min(1, dt * 11.5);
    this.trainerCompanion.facingX = p.facingX;
    this.trainerCompanion.facingY = p.facingY;
    this.trainerCompanion.walkBob = p.walkBob;
    this.trainerCompanion.isJumpingLedge = p.isJumpingLedge;
    this.trainerCompanion.jumpTimer = p.jumpTimer;

    // 雙打夥伴
    this.partnerOrbitBase += dt * 2.1;
    const upgPartnerMult = 1 + (this.saveData.upgrades.partner || 0) * 0.18;
    this.partners.forEach((pt, idx) => {
      const angle = this.partnerOrbitBase + idx * Math.PI;
      const tx = p.x + Math.cos(angle) * 60;
      const ty = p.y + Math.sin(angle) * 48;
      pt.x += (tx - pt.x) * Math.min(1, dt * 10);
      pt.y += (ty - pt.y) * Math.min(1, dt * 10);
      pt.facingX = p.facingX;
      pt.facingY = p.facingY;

      pt.cdTimer -= dt;
      if (pt.cdTimer <= 0) {
        const target = this.findNearestEnemyInViewport(pt.x, pt.y, 340);
        if (target) {
          const skId = SKILLS_CATALOG[pt.data.skill] ? pt.data.skill : "Tackle";
          SkillsEngine.fireSkill(pt, skId, Math.min(10, pt.level), false, upgPartnerMult * 0.65);
          pt.cdTimer = 1.35;
        }
      }
    });

    this.camera.x = p.x;
    this.camera.y = p.y;

    // 招式冷卻判定與 SkillsEngine 呼叫
    const cdFactor = Math.max(0.55, p.cdMult * (p.buffTimer > 0 ? 0.70 : 1.0));
    Object.values(p.skills).forEach(skSlot => {
      skSlot.timer -= dt;
      if (skSlot.timer <= 0) {
        const meta = SKILLS_CATALOG[skSlot.id];
        if (!meta) return;
        if (skSlot.evolved) {
          SkillsEngine.triggerUltimateSuperMove(meta, skSlot);
          skSlot.timer = Math.max(2.4, meta.baseCd * 1.95 * cdFactor);
        } else {
          SkillsEngine.fireSkill(p, skSlot.id, skSlot.level, false, 1.0);
          const lvCdBonus = skSlot.level >= 9 ? 0.75 : (skSlot.level >= 4 ? 0.88 : 1.0);
          skSlot.timer = Math.max(0.35, meta.baseCd * lvCdBonus * cdFactor);
        }
      }
    });

    // 8 分鐘快局自然天氣演進 (防手動覆蓋)
    if (!this.debugWeatherLock && !this.activeBoss) {
      const minutes = this.runTime / 60;
      let targetWeather = "CLEAR";
      if (minutes >= 6.0) targetWeather = "PSYCHIC";
      else if (minutes >= 3.5) targetWeather = "THUNDER";
      else if (minutes >= 1.5) targetWeather = "RAIN";
      
      if (MapEngine.weather !== targetWeather) {
        MapEngine.setWeather(targetWeather);
        this.updateWeatherUI(targetWeather);
      }
    }

    MapEngine.updateWeather(dt, this.width, this.height);
    SkillsEngine.update(dt);
    this.updateSpawners(dt);
    this.updateTelegraphs(dt);
    this.updateEnemies(dt);
    this.updateLootAndGems(dt);
    this.updateParticlesAndTexts(dt);
    this.refreshHUD();
  },

  findNearestEnemyInViewport(ox, oy, maxRange = 420) {
    let best = null;
    let bestDist = maxRange;
    const halfW = this.width / 2 + 40;
    const halfH = this.height / 2 + 40;
    for (const e of this.enemies) {
      if (Math.abs(e.x - this.player.x) > halfW || Math.abs(e.y - this.player.y) > halfH) continue;
      const d = Math.hypot(e.x - ox, e.y - oy);
      if (d < bestDist) {
        bestDist = d;
        best = e;
      }
    }
    return best;
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

    // 3:15 (195s) 火箭隊突襲小隊
    if (!this.rocketEventTriggered && this.runTime >= 195) {
      this.rocketEventTriggered = true;
      this.showCutsceneBanner("【火箭隊突襲】", "黑化怪獸帶著劇毒霧氣包夾衝鋒！", 3200);
      SoundFX.play("boss");
      for (let k = 0; k < 6; k++) {
        const ang = (k * Math.PI * 2) / 6;
        const ex = this.player.x + Math.cos(ang) * 360;
        const ey = this.player.y + Math.sin(ang) * 360;
        const pId = k % 2 === 0 ? 24 : 110; // 阿柏怪 & 雙彈瓦斯
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

    // 4:00 (240s) 野生肯泰羅暴走潮
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
          atk: 32, speed: 220, radius: 28, isElite: true, isBoss: false, isShiny: false,
          facingX: 1, facingY: 0, status: null, statusTimer: 0, statusTick: 0,
          ccImmunityTimer: 999, rangedCd: 999, whiteFlashTimer: 0, weightTier: "heavy", kbResist: 0.95
        });
      }
    }

    // 5:00 (300s) 三聖鳥
    if (!this.birdBossSpawned && this.runTime >= 300) {
      this.birdBossSpawned = true;
      const birdIds = [144, 145, 146];
      this.spawnBoss(birdIds[Math.floor(Math.random() * birdIds.length)], false);
    }
    // 7:30 (450s) 王者超夢
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
      const baseInterval = Math.max(0.28, (1.20 - minutes * 0.12) / diff.spawnRateMult);
      this.spawnTimer = baseInterval;
      if (this.enemies.length < 75) {
        this.spawnWildEnemy(false);
      }
    }
  },

  // 怪獸刷新（華藍海岬深水區域生態過濾）
  spawnWildEnemy(isElite = false) {
    const minutes = this.runTime / 60;
    const diff = this.selectedDifficulty;

    const ang = Math.random() * Math.PI * 2;
    const dist = Math.max(this.width, this.height) * 0.56 + 50;
    const ex = this.player.x + Math.cos(ang) * dist;
    const ey = this.player.y + Math.sin(ang) * dist;

    const spawnTerrain = MapEngine.getTerrainModifierAt(ex, ey);
    const isWater = spawnTerrain.inWater;

    let candidates = REGULAR_MOB_POOL;
    if (minutes < 1.5) candidates = REGULAR_MOB_POOL.filter(p => p.hp <= 140);
    else if (minutes < 4.0) candidates = REGULAR_MOB_POOL.filter(p => p.hp <= 260);

    // 華藍海岬深水生態過濾：85% 優先挑選水/飛行系，徹底排除地鼠、三地鼠、小拳石、大岩蛇
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

    const timeHpScale = 1 + (minutes * 0.75) + Math.pow(minutes / 2.5, 2.0) * 0.85;
    const hp = Math.round((35 + pick.hp * 0.55) * timeHpScale * diff.hpMult * (isElite ? 3.8 : 1.0) * (isShiny ? 1.6 : 1.0));
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
      speed: (32 + pick.speed * 0.45) * diff.spdMult * (isElite ? 1.28 : 1.0),
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
      rangedCd: 2.5 + Math.random() * 2.0,
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

  spawnBoss(bossId, isFinalMewtwo = false) {
    const bData = POKEMON_MAP.get(bossId);
    const diff = this.selectedDifficulty;
    const ang = Math.random() * Math.PI * 2;
    const bx = this.player.x + Math.cos(ang) * 290;
    const by = this.player.y + Math.sin(ang) * 290;
    const hp = Math.round((isFinalMewtwo ? 14000 : 7500) * diff.hpMult);

    const weatherMap = { 144: "BLIZZARD", 145: "THUNDER", 146: "HEATWAVE", 150: "PSYCHIC", 151: "PSYCHIC" };
    const wType = weatherMap[bossId] || "THUNDER";
    MapEngine.setWeather(wType);
    this.updateWeatherUI(wType);

    SoundFX.startBgm("boss");
    this.camera.shakeTime = 0.65;
    this.camera.shakeMagnitude = 14;

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
      kbResist: 1.0, // Boss 100% 免擊退
      bossAttackIdx: 0 // 3.1 招式輪換計數器
    };
    this.enemies.push(boss);
    this.activeBoss = boss;
    SoundFX.play("boss");
    document.getElementById("bossHudContainer").classList.remove("hidden");
  },

  updateEnemies(dt) {
    const p = this.player;
    const halfW = this.width / 2 - 16;
    const halfH = this.height / 2 - 16;

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
            const bDmg = Math.max(6, Math.round(e.maxHp * 0.018));
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
      iif (!e.isBoss) {
        const rawTerrMult = MapEngine.getTerrainModifierAt(e.x, e.y).speedMult;
        eTerrMult = e.isElite ? (1.0 - (1.0 - rawTerrMult) * 0.5) : rawTerrMult;
      }

      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const dist = Math.hypot(dx, dy) || 1;

      let moveDir = confDir;
      if (e.treasureType === "meowth") moveDir = dist < 340 ? -1.0 : 0.25;
      else if (e.treasureType === "chansey") moveDir = dist < 240 ? -0.65 : 0.2;

      const vx = (dx / dist) * e.speed * paraMult * eTerrMult * moveDir;
      const vy = (dy / dist) * e.speed * paraMult * eTerrMult * moveDir;
      e.x += vx * dt;
      e.y += vy * dt;

      if (!e.isBoss) {
        for (let j = 0; j < this.enemies.length; j++) {
          if (i === j) continue;
          const other = this.enemies[j];
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

      if (Math.abs(vx) > 2) e.facingX = vx >= 0 ? 1 : -1;
      e.facingY = vy < -8 ? -1 : 1;

      if (!e.isBoss) {
        MapEngine.resolveObstacleCollision(e, e.radius * 0.8, false);
      }

      const inView = Math.abs(e.x - p.x) <= halfW && Math.abs(e.y - p.y) <= halfH;
      if (inView && (e.isElite || e.isBoss) && !e.treasureType) {
        e.rangedCd -= dt;
        if (e.rangedCd <= 0) {
          e.rangedCd = e.isBoss ? 2.6 : 3.0;
          this.spawnEnemyTelegraphAttack(e);
        }
      }

      if (!e.treasureType && dist < e.radius + 16 && p.invulnTimer <= 0) {
        const shieldMult = p.shieldTimer > 0 ? 0.5 : 1.0;
        const burnMod = e.status === "Burn" ? 0.72 : 1.0;
        const dmg = Math.max(1, Math.round(e.atk * shieldMult * burnMod));
        p.hp -= dmg;

        const hasMelee = Object.values(p.skills).some(s => SKILLS_CATALOG[s.id] && SKILLS_CATALOG[s.id].isMelee);
        p.invulnTimer = hasMelee ? 0.75 : 0.45;

        this.spawnFloatingText(p.x, p.y - 18, `-${dmg}`, "#EF4444", 14);
        SoundFX.play("hit");
        if (p.hp <= 0) {
          p.hp = 0;
          this.triggerGameOver(false);
          return;
        }
      }
    }
  },

  // 3.1 原版 Boss & 精英怪多型態前搖警示生成器 (支援 line, multi_pillar, ring, circle)
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
          const dmg = Math.max(1, Math.round(tg.dmg * (p.shieldTimer > 0 ? 0.5 : 1.0)));
          p.hp -= dmg;
          p.invulnTimer = 0.45;
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

  // 傷害計算 (套用怪獸體重擊退抗性 weightTier & kbResist)
  dealDamageToEnemy(enemy, rawDmg, moveType, bonusStatusChance = 0, knockback = 0) {
    const eff = calcTypeMultiplier(moveType, enemy.data.type1, enemy.data.type2);
    const isCrit = Math.random() < (this.player.critRate + (this.player.buffTimer > 0 ? 0.25 : 0));
    let finalDmg = Math.round(rawDmg * eff * (isCrit ? 1.65 : 1.0));
    if (enemy.isBoss) finalDmg = Math.min(finalDmg, Math.round(enemy.maxHp * 0.085));

    enemy.hp -= finalDmg;
    if (isCrit || eff > 1.1) enemy.whiteFlashTimer = 0.06;

    // 累積 DPS 統計
    this.skillDamageStats[moveType] = (this.skillDamageStats[moveType] || 0) + finalDmg;

    if (enemy.treasureType === "meowth") {
      this.runCoins += 8;
      this.saveData.coins += 8;
      this.spawnFloatingText(enemy.x, enemy.y - 20, "+8 代幣", "#F59E0B", 11);
    }

    // 體重抗性衰減
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

    const label = eff > 1.1 ? `克制 ${finalDmg}!` : (isCrit ? `暴擊 ${finalDmg}!` : `${finalDmg}`);
    const col = eff > 1.1 ? "#F97316" : (isCrit ? "#FACC15" : "#FFFFFF");
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
      const dropId = Math.random() < 0.55 ? "partner_ball" : "rare_candy";
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
    for (let i = this.gems.length - 1; i >= 0; i--) {
      const g = this.gems[i];
      const d = Math.hypot(p.x - g.x, p.y - g.y);
      if (d < p.magnetRadius || g.magnetized) {
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
    Object.values(p.skills).forEach(sk => {
      const meta = SKILLS_CATALOG[sk.id];
      if (sk.level >= 10 && !sk.evolved && (!meta.reqItem || p.heldItems[meta.reqItem])) {
        sk.evolved = true;
        evolvedAny = true;
        this.saveData.stats.superMoves += 1;
        this.showCutsceneBanner(`[寶箱突破] 領悟【${meta.evolvedName}】！`, meta.evoDesc, 3200);
      }
    });
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
    this.evolvePlayerPokemon(targetId);

    const sigSkill = targetId === 134 ? "Hydro Pump" : (targetId === 135 ? "Thunderbolt" : "Flamethrower");
    if (this.player.skills[sigSkill]) {
      this.player.skills[sigSkill].level = Math.min(10, this.player.skills[sigSkill].level + 2);
    } else {
      this.player.skills[sigSkill] = { id: sigSkill, level: 3, evolved: false, timer: 0.1 };
    }
    this.state = "PLAYING";
    this.refreshHUD();
  },

  evolvePlayerPokemon(targetId) {
    const p = this.player;
    const nextData = POKEMON_MAP.get(targetId);
    if (!nextData) return;
    const oldName = p.data.name_zh;
    p.id = nextData.id;
    p.data = nextData;
    p.maxHp = Math.round(p.maxHp * 1.32);
    p.hp = p.maxHp;
    p.baseAtk = nextData.atk * (p.isShiny ? 1.2 : 1.0);
    p.baseSpeed = nextData.speed;

    this.saveData.stats.evolutions += 1;
    this.saveData.pokedexSeen[nextData.id] = true;
    this.saveData.pokedexCaught[nextData.id] = true;
    this.saveData.unlockedPokemon[nextData.id] = true;
    this.saveToStorage();

    SoundFX.play("levelup");
    this.spawnParticleCluster(p.x, p.y, "#F59E0B", "#FFFFFF", 40, "star", 1.4);
    this.showCutsceneBanner(`[進化之光] ${oldName} 進化成了【${nextData.name_zh}】！`, "生命全滿且戰鬥數值大幅躍升！", 3200);
  },

  // 升級三選一視窗 (含內嵌不切邊 NEW! 標籤)
  openLevelUpModal() {
    this.state = "PAUSED";
    const p = this.player;
    const pool = [];

    // 超武突破
    Object.values(p.skills).forEach(sk => {
      const meta = SKILLS_CATALOG[sk.id];
      if (sk.level >= 10 && !sk.evolved && meta && (!meta.reqItem || p.heldItems[meta.reqItem])) {
        pool.push({
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

    // 招式階級提升
    Object.values(p.skills).forEach(sk => {
      if (sk.level < 10) {
        const meta = SKILLS_CATALOG[sk.id];
        const nextLv = sk.level + 1;
        pool.push({
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
    });

    // 通用營養藥劑
    pool.push(
      {
        weight: 30, rarityClass: "rarity-common", badge: "威力提升", badgeBg: "bg-slate-700 text-white",
        title: "蛋白藥劑", subTitle: "全傷 +8%", typeBadge: "", sprite: ITEM_SPRITES.protein,
        desc: "全面提升寶可夢所有招式傷害 +8%！", isNew: false, apply: () => { p.dmgMult *= 1.08; }
      },
      {
        weight: 30, rarityClass: "rarity-common", badge: "體質強化", badgeBg: "bg-slate-700 text-white",
        title: "HP提升劑", subTitle: "最大HP +12%", typeBadge: "", sprite: ITEM_SPRITES.hpUp,
        desc: "最大生命值提升 12%，並立即恢復 25% 已損失生命！", isNew: false,
        apply: () => { p.maxHp = Math.round(p.maxHp * 1.12); p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * 0.25)); }
      },
      {
        weight: 28, rarityClass: "rarity-common", badge: "敏捷連動", badgeBg: "bg-slate-700 text-white",
        title: "敏捷強化劑", subTitle: "移速+5% ＆ CD-3%", typeBadge: "", sprite: ITEM_SPRITES.carbos,
        desc: "提升移動速度 5%，縮短招式冷卻 -3%！", isNew: false, apply: () => { p.speedMult *= 1.05; p.cdMult *= 0.97; }
      }
    );

    // 新招式解鎖 (附帶 isNew 標籤)
    const currentCount = Object.keys(p.skills).length;
    if (currentCount < p.maxSkillSlots) {
      Object.values(SKILLS_CATALOG).forEach(meta => {
        if (!p.skills[meta.id] && meta.id !== "Metronome") {
          pool.push({
            weight: 18, rarityClass: "rarity-rare", badge: `新招式 (${currentCount + 1}/${p.maxSkillSlots})`,
            badgeBg: "bg-blue-600 text-white font-black", title: meta.name, subTitle: "新領悟 Lv.1",
            typeBadge: renderTypeBadgeHTML(meta.type), sprite: meta.sprite, desc: meta.desc,
            isNew: true,
            apply: () => { p.skills[meta.id] = { id: meta.id, level: 1, evolved: false, timer: 0.2 }; }
          });
        }
      });
    }

    // 攜帶道具
    Object.values(HELD_ITEMS).forEach(hi => {
      if (!p.heldItems[hi.id]) {
        pool.push({
          weight: 8, rarityClass: "rarity-epic", badge: "超武核心攜帶物", badgeBg: "bg-purple-600 text-white font-black",
          title: hi.name, subTitle: "★ 超武突破必備", typeBadge: "", sprite: hi.sprite, desc: hi.desc,
          isNew: true,
          apply: () => { p.heldItems[hi.id] = true; p.dmgMult *= 1.12; }
        });
      }
    });

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

    this._currentUpgradeChoices = choices;
    const box = document.getElementById("upgradeChoicesContainer");

    // 精確貼合內嵌設計：移除外層溢出裁切，避免 NEW! 被切邊
    box.innerHTML = choices.map((c, idx) => `
      <div onclick="GameApp.selectUpgradeChoice(${idx})" class="poke-card ${c.rarityClass} cursor-pointer p-3.5 flex items-center justify-between gap-3 hover:-translate-y-0.5 transition-transform relative">
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
            <p class="text-xs font-bold text-slate-600 truncate mt-0.5">${c.desc}</p>
          </div>
        </div>
        <button class="poke-btn-red px-4 py-2 text-xs font-black shrink-0 min-h-[38px]">
          選擇
        </button>
      </div>
    `).join("");

    document.getElementById("levelUpModal").classList.remove("hidden");
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
      if (pt.life <= 0) this.particles.splice(i, 1);
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

  /**
   * ============================================================================
   * 戰鬥畫面渲染、多形態危險預警、草叢沉浸與動態草尖、對接 SkillsEngine
   * ============================================================================
   */
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

    // 1. 地貌底層 (MapEngine)
    MapEngine.renderBiomeWorld(ctx, camX, camY, this.width, this.height);

    // 2. 3.1 原版多形態危險預警框 (支援 line 矩形軌道、ring 環形波、circle 圓形陷阱)
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

    // 3. 經驗水晶
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

    // 4. 地面掉落物
    this.mapItems.forEach(it => {
      const sx = toSx(it.x);
      const sy = toSy(it.y) + Math.sin(it.bobPhase) * 4;
      const rec = SpriteCache.get(it.meta.sprite);
      ctx.save();
      ctx.fillStyle = "rgba(15,23,42,0.65)";
      ctx.strokeStyle = it.meta.color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(sx, sy, 16, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      if (rec && rec.loaded) ctx.drawImage(rec.img, sx - 12, sy - 12, 24, 24);
      ctx.restore();
    });

    // 5. 隨行訓練家 (水面涉水波紋 + 高草叢下半身遮罩 + 前景撥草草尖)
    if (this.trainerCompanion) {
      const tc = this.trainerCompanion;
      const tsx = toSx(tc.x), tsy = toSy(tc.y);
      const bob = Math.abs(Math.sin(tc.walkBob)) * 3.5;
      const tTerrain = MapEngine.getTerrainModifierAt(tc.x, tc.y);
      const tInWater = tTerrain.inWater;
      const tInGrass = tTerrain.label.includes("草叢");

      let tJumpOffsetZ = 0;
      if (tc.isJumpingLedge && tc.jumpTimer > 0) {
        const tJumpProg = 1 - (tc.jumpTimer / 0.22);
        tJumpOffsetZ = Math.sin(tJumpProg * Math.PI) * 18;
      }

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
        ctx.ellipse(tsx, tsy + 18, Math.max(7, 14 - tJumpOffsetZ * 0.3), Math.max(3, 5.5 - tJumpOffsetZ * 0.1), 0, 0, Math.PI * 2);
        ctx.fill();
      }

      if (tInWater) {
        ctx.beginPath();
        ctx.rect(tsx - 35, tsy - 45, 70, 56);
        ctx.clip();
      } else if (tInGrass && !tc.isJumpingLedge) {
        ctx.beginPath();
        ctx.rect(tsx - 35, tsy - 45, 70, 58);
        ctx.clip();
      }

      ctx.translate(tsx, tsy - bob - tJumpOffsetZ + (tInWater ? 5 : 0));
      if (needFlip) ctx.scale(-1, 1);
      if (tRec && tRec.loaded) ctx.drawImage(tRec.img, -28, -28, 56, 56);
      ctx.restore();

      if (tInGrass && !tc.isJumpingLedge && !tInWater) {
        ctx.save();
        ctx.strokeStyle = "#4ADE80";
        ctx.lineWidth = 2.0;
        const tSway = Math.sin(performance.now() * 0.01 + tc.walkBob) * 2;
        ctx.beginPath();
        ctx.moveTo(tsx - 10, tsy + 16);
        ctx.lineTo(tsx - 6 + tSway, tsy + 4);
        ctx.lineTo(tsx - 2, tsy + 16);
        ctx.moveTo(tsx + 1, tsy + 16);
        ctx.lineTo(tsx + 5 - tSway, tsy + 3);
        ctx.lineTo(tsx + 9, tsy + 16);
        ctx.stroke();
        ctx.restore();
      }
    }

    // 6. 雙打夥伴
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

    // 7. 出戰主角精靈 (單向跳崖拋物線 + 草叢下半身遮罩 + 前景撥草草尖)
    const p = this.player;
    const px = toSx(p.x), py = toSy(p.y);
    const pBob = Math.abs(Math.sin(p.walkBob)) * 4;
    const terrain = MapEngine.getTerrainModifierAt(p.x, p.y);
    const inWater = terrain.inWater;
    const inGrass = terrain.label.includes("草叢");
    const isFlyingOrWater = p.data.type1 === "Water" || p.data.type2 === "Water" ||
                            p.data.type1 === "Flying" || p.data.type2 === "Flying";

    let jumpOffsetZ = 0;
    if (p.isJumpingLedge && p.jumpTimer > 0) {
      const jumpProg = 1 - (p.jumpTimer / 0.22);
      jumpOffsetZ = Math.sin(jumpProg * Math.PI) * 18;
    }

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
      ctx.ellipse(px, py + 18, Math.max(8, 14 - jumpOffsetZ * 0.3), Math.max(3, 5.5 - jumpOffsetZ * 0.1), 0, 0, Math.PI * 2);
      ctx.fill();
    }

    if (p.isTrainerBond) {
      ctx.strokeStyle = p.bondColor;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(px, py + 19, 22, 7.5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (p.shieldTimer > 0) {
      const shieldPct = p.shieldTimer / p.maxShieldTimer;
      const isEnding = p.shieldTimer < 1.5;
      const blinkAlpha = isEnding ? (Math.sin(performance.now() * 0.02) > 0 ? 1 : 0.3) : 1;
      ctx.strokeStyle = "rgba(245, 158, 11, 0.35)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(px, py, 30, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = `rgba(245, 158, 11, ${blinkAlpha})`;
      ctx.lineWidth = 3.5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(px, py, 30, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * shieldPct, false);
      ctx.stroke();
    }

    if (p.buffTimer > 0) {
      const buffPct = p.buffTimer / p.maxBuffTimer;
      const isEnding = p.buffTimer < 1.5;
      const blinkAlpha = isEnding ? (Math.sin(performance.now() * 0.02) > 0 ? 1 : 0.25) : 1;

      ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(px, py + 12, 26, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = `rgba(245, 158, 11, ${blinkAlpha})`;
      ctx.lineWidth = 3.5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(px, py + 12, 26, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * buffPct, false);
      ctx.stroke();
    }

    if (inWater && !isFlyingOrWater) {
      ctx.beginPath();
      ctx.rect(px - 40, py - 50, 80, 58);
      ctx.clip();
    } else if (inGrass && !isFlyingOrWater && !p.isJumpingLedge) {
      ctx.beginPath();
      ctx.rect(px - 40, py - 50, 80, 60);
      ctx.clip();
    }

    const pSprUrl = p.facingY < 0 ? p.data.back_sprite : p.data.forward_sprite;
    const pRec = SpriteCache.get(pSprUrl);
    if (pRec && pRec.loaded) {
      ctx.translate(px, py - pBob - jumpOffsetZ + (inWater && !isFlyingOrWater ? 4 : 0));
      if (p.facingX > 0) ctx.scale(-1, 1);
      if (p.isShiny) ctx.filter = "hue-rotate(48deg) saturate(1.75) brightness(1.15)";
      ctx.drawImage(pRec.img, -26, -26, 52, 52);
      ctx.filter = "none";
    }
    ctx.restore();

    if (inGrass && !isFlyingOrWater && !p.isJumpingLedge && !inWater) {
      ctx.save();
      ctx.strokeStyle = "#4ADE80";
      ctx.lineWidth = 2.0;
      const sway = Math.sin(performance.now() * 0.01 + p.walkBob) * 2;
      const gx = px, gy = py + 14;

      ctx.beginPath();
      ctx.moveTo(gx - 12, gy + 4);
      ctx.lineTo(gx - 8 + sway, gy - 6);
      ctx.lineTo(gx - 4, gy + 4);

      ctx.moveTo(gx - 2, gy + 4);
      ctx.lineTo(gx + 1 - sway, gy - 8);
      ctx.lineTo(gx + 5, gy + 4);

      ctx.moveTo(gx + 6, gy + 4);
      ctx.lineTo(gx + 10 + sway, gy - 5);
      ctx.lineTo(gx + 14, gy + 4);
      ctx.stroke();
      ctx.restore();
    }

    // 8. 敵人渲染 (含涉水波紋、草叢下半身遮罩與受擊純白閃模)
    this.enemies.forEach(e => {
      const esx = toSx(e.x), esy = toSy(e.y);
      if (esx < -90 || esx > this.width + 90 || esy < -90 || esy > this.height + 90) return;

      const eTerrain = MapEngine.getTerrainModifierAt(e.x, e.y);
      const eInWater = eTerrain.inWater;
      const eInGrass = eTerrain.label.includes("草叢");
      const eFlyingOrWater = e.data.type1 === "Water" || e.data.type2 === "Water" ||
                             e.data.type1 === "Flying" || e.data.type2 === "Flying";

      const eSprUrl = e.facingY < 0 ? e.data.back_sprite : e.data.forward_sprite;
      const eRec = SpriteCache.get(eSprUrl);
      const sz = e.isBoss ? 120 : (e.isElite || e.treasureType ? 88 : 64);

      ctx.save();
      if (eInWater) {
        const waveC = (performance.now() * 0.005 + e.x * 0.01) % Math.PI;
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.7 - waveC / Math.PI})`;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.ellipse(esx, esy + sz * 0.25, sz * 0.3 + waveC * 6, sz * 0.12 + waveC * 3, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (eInWater && !eFlyingOrWater) {
        ctx.beginPath();
        ctx.rect(esx - sz, esy - sz, sz * 2, sz * 1.35);
        ctx.clip();
      } else if (eInGrass && !eFlyingOrWater && !e.isBoss) {
        ctx.beginPath();
        ctx.rect(esx - sz, esy - sz, sz * 2, sz * 1.4);
        ctx.clip();
      }

      ctx.translate(esx, esy + (eInWater && !eFlyingOrWater ? 6 : 0));
      if (e.facingX > 0) ctx.scale(-1, 1);

      if (e.whiteFlashTimer > 0) {
        ctx.filter = "brightness(10) contrast(10)";
      } else if (e.isShiny) {
        ctx.filter = "hue-rotate(48deg) saturate(1.8) brightness(1.15)";
      } else if (e.status === "Poison") {
        ctx.filter = "hue-rotate(240deg) saturate(1.8)";
      } else if (e.status === "Burn") {
        ctx.filter = "sepia(0.8) saturate(2.5) hue-rotate(-25deg)";
      }

      if (eRec && eRec.loaded) ctx.drawImage(eRec.img, -sz / 2, -sz / 2, sz, sz);
      ctx.restore();

      if (eInGrass && !eFlyingOrWater && !e.isBoss && !eInWater) {
        ctx.save();
        ctx.strokeStyle = "#4ADE80";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(esx - 8, esy + sz * 0.22);
        ctx.lineTo(esx - 4, esy + sz * 0.12);
        ctx.lineTo(esx, esy + sz * 0.22);
        ctx.moveTo(esx + 2, esy + sz * 0.22);
        ctx.lineTo(esx + 6, esy + sz * 0.10);
        ctx.lineTo(esx + 10, esy + sz * 0.22);
        ctx.stroke();
        ctx.restore();
      }

      if (e.hp < e.maxHp || e.isElite || e.treasureType) {
        const bw = e.isBoss ? 66 : 36;
        ctx.fillStyle = "rgba(15,23,42,0.85)";
        ctx.fillRect(esx - bw / 2, esy - sz / 2 - 8, bw, 5);
        ctx.fillStyle = e.treasureType ? "#FACC15" : "#22C55E";
        ctx.fillRect(esx - bw / 2, esy - sz / 2 - 8, bw * Math.max(0, e.hp / e.maxHp), 5);
      }
    });

    // 9. 開啟加色高光模式 (lighter) 呼叫獨立招式特效引擎 SkillsEngine
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    SkillsEngine.render(ctx, toSx, toSy);

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

    // 10. 動態天氣覆蓋層
    MapEngine.renderWeatherOverlays(ctx, this.width, this.height);

    // 11. 浮動傷害數字
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

    // 12. 螢幕邊緣視野外目標追蹤指示箭頭 (喵喵/吉利蛋/BOSS)
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
  },

  // 介面 HUD 刷新
  refreshHUD() {
    const p = this.player;
    if (!p) return;
    const tr = this.selectedTrainer;

    document.getElementById("hudAvatar").src = p.data.forward_sprite;
    document.getElementById("hudPartnerName").textContent = p.data.name_zh;
    document.getElementById("hudTypeBadges").innerHTML = `${renderTypeBadgeHTML(p.data.type1)}${renderTypeBadgeHTML(p.data.type2)}`;
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

    // 招式微型標籤
    document.getElementById("hudSkillList").innerHTML = Object.values(p.skills).map(sk => {
      const meta = SKILLS_CATALOG[sk.id];
      return `<span class="px-2 py-0.5 rounded-full text-[9px] font-black border border-slate-800 ${sk.evolved ? 'bg-amber-300 text-slate-900' : 'bg-white text-slate-800'} flex items-center gap-1 shadow-sm"><img src="${meta.sprite}" class="w-3 h-3 pixel-sprite"/>${sk.evolved ? meta.evolvedName : meta.name} L${sk.level}</span>`;
    }).join("");

    // 大招三態呈現
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

  toggleTimeScale() {
    this.timeScale = this.timeScale === 1 ? 2 : 1;
    document.getElementById("speedToggleText").textContent = `${this.timeScale}x`;
  },

  togglePause() {
    if (this.state === "PLAYING") {
      this.state = "PAUSED";
      document.getElementById("endModalTitle").textContent = "GAME PAUSED";
      document.getElementById("endModalSubtitle").textContent = "冒險暫停中，隨時可返回挑戰！";
      document.getElementById("btnResumeGame").classList.remove("hidden");
      this.populateEndModalStats();
      document.getElementById("endModal").classList.remove("hidden");
    } else if (this.state === "PAUSED") {
      document.getElementById("endModal").classList.add("hidden");
      this.state = "PLAYING";
    }
  },

  triggerGameOver(isVictory) {
    this.state = "GAMEOVER";
    SoundFX.startBgm("lobby");
    this.saveToStorage();
    document.getElementById("endModalTitle").textContent = isVictory ? "VICTORY! 關都冠軍!" : "BATTLE FINISHED";
    document.getElementById("endModalSubtitle").textContent = isVictory
      ? "恭喜通過 8 分鐘極速關都傳說考驗！"
      : "前往寶可夢中心強化能力後再次挑戰！";
    document.getElementById("btnResumeGame").classList.add("hidden");
    this.populateEndModalStats();
    document.getElementById("endModal").classList.remove("hidden");
  },

  // 結算畫面注入 MVP 招式傷害長條圖 (DPS Breakdown)
  populateEndModalStats() {
    document.getElementById("endStatTime").textContent = document.getElementById("hudTimer").textContent;
    document.getElementById("endStatPartner").textContent = `${this.selectedTrainer.name} & ${this.player.data.name_zh} (Lv.${this.player.level})`;
    document.getElementById("endStatKills").textContent = this.kills;
    document.getElementById("endStatCoins").textContent = `+${this.runCoins}`;

    const dpsBox = document.getElementById("endStatDpsContainer");
    if (dpsBox) {
      const stats = this.skillDamageStats;
      const totalDmg = Object.values(stats).reduce((sum, val) => sum + val, 0) || 1;
      const sortedSkills = Object.entries(stats).sort((a, b) => b[1] - a[1]);

      dpsBox.innerHTML = `
        <div class="mt-3 pt-2.5 border-t border-slate-700/80">
          <div class="text-[11px] font-black text-slate-300 mb-1.5 flex justify-between">
            <span>招式傷害統計 (DPS Breakdown)</span>
            <span class="text-amber-400">總輸出: ${totalDmg.toLocaleString()}</span>
          </div>
          <div class="space-y-1.5">
            ${sortedSkills.map(([skillType, dmg]) => {
              const pct = Math.round((dmg / totalDmg) * 100);
              const color = TYPE_COLORS[skillType] || "#94A3B8";
              const typeName = TYPE_NAMES_ZH[skillType] || skillType;
              return `
                <div class="text-[10px]">
                  <div class="flex justify-between font-bold text-slate-300 mb-0.5">
                    <span>【${typeName}系】</span>
                    <span>${dmg.toLocaleString()} (${pct}%)</span>
                  </div>
                  <div class="w-full h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                    <div style="width: ${pct}%; background-color: ${color};" class="h-full rounded-full transition-all duration-500"></div>
                  </div>
                </div>
              `;
            }).join("")}
          </div>
        </div>
      `;
    }
  },

  quitToTitle() {
    this.saveToStorage();
    SoundFX.startBgm("lobby");
    document.getElementById("endModal").classList.add("hidden");
    document.getElementById("hudLayer").classList.add("hidden");
    document.getElementById("titleScreen").classList.remove("hidden");
    this.state = "TITLE";
    this.updateTitleUI();
  }
};

window.addEventListener("DOMContentLoaded", () => GameApp.init());
