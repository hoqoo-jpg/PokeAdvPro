/**
 * ============================================================================
 * game_ui.js
 * 遊戲 UI 管理、三步驟選角向導、圖鑑/天賦/成就彈窗、資源預載與儲存
 * ============================================================================
 */

// 1. 全域精靈圖片快取管理器
window.SpriteCache = {
  cache: new Map(),
  get(url) {
    if (!url) return null;
    let item = this.cache.get(url);
    if (!item) {
      const img = new Image();
      img.src = url;
      item = { img, loaded: false, error: false };
      img.onload = () => { item.loaded = true; };
      img.onerror = () => { item.error = true; };
      this.cache.set(url, item);
    }
    return item;
  }
};

// 2. 音效管理器 (Web Audio API 復古合成)
window.SoundFX = {
  ctx: null,
  isMuted: false,
  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
  },
  toggleMute() {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  },
  play(type) {
    if (this.isMuted || !this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);

      if (type === "hit") {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(140, t);
        osc.frequency.exponentialRampToValueAtTime(30, t + 0.12);
        gain.gain.setValueAtTime(0.25, t);
        gain.gain.linearRampToValueAtTime(0.01, t + 0.12);
        osc.start(t); osc.stop(t + 0.12);
      } else if (type === "levelup") {
        osc.type = "square";
        osc.frequency.setValueAtTime(330, t);
        osc.frequency.setValueAtTime(440, t + 0.08);
        osc.frequency.setValueAtTime(554, t + 0.16);
        osc.frequency.setValueAtTime(659, t + 0.24);
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.linearRampToValueAtTime(0.01, t + 0.35);
        osc.start(t); osc.stop(t + 0.35);
      } else if (type === "boss") {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(110, t);
        osc.frequency.setValueAtTime(95, t + 0.15);
        gain.gain.setValueAtTime(0.35, t);
        gain.gain.linearRampToValueAtTime(0.01, t + 0.45);
        osc.start(t); osc.stop(t + 0.45);
      } else {
        osc.type = "sine";
        osc.frequency.setValueAtTime(520, t);
        gain.gain.setValueAtTime(0.15, t);
        gain.gain.linearRampToValueAtTime(0.01, t + 0.08);
        osc.start(t); osc.stop(t + 0.08);
      }
    } catch (e) {}
  },
  startBgm(theme) {}
};

// 3. UI 邏輯掛載至 window.GameApp
window.GameApp = window.GameApp || {};

Object.assign(window.GameApp, {
  selectedTrainer: null,
  selectedStarterId: 25,
  selectedDifficulty: { id: "normal", name: "標準冒險", hpMult: 1.0, atkMult: 1.0, spdMult: 1.0, coinMult: 1.0, spawnRateMult: 1.0 },
  useShinyStarter: {},
  wizardStep: 1,

  // 資源預載進度條
  runAssetPreloader() {
    const pEl = document.getElementById("preloader-screen");
    const bEl = document.getElementById("preloaderBar");
    const countEl = document.getElementById("preloaderCountText");
    const pctEl = document.getElementById("preloaderPctText");
    const sEl = document.getElementById("preloaderStatusText");

    const urls = [
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png",
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/amulet-coin.png",
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/star-piece.png",
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/rare-candy.png",
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/heal-ball.png",
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/town-map.png",
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/charcoal.png",
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/mystic-water.png",
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/miracle-seed.png",
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/magnet.png",
      "https://raw.githubusercontent.com/NightCatSama/pokedex/main/images/sprite/forward/25.png",
      "https://raw.githubusercontent.com/NightCatSama/pokedex/main/images/sprite/forward/1.png",
      "https://raw.githubusercontent.com/NightCatSama/pokedex/main/images/sprite/forward/4.png",
      "https://raw.githubusercontent.com/NightCatSama/pokedex/main/images/sprite/forward/7.png",
      "https://raw.githubusercontent.com/NightCatSama/pokedex/main/images/sprite/forward/133.png",
      "https://raw.githubusercontent.com/NightCatSama/pokedex/main/images/sprite/forward/150.png",
      "https://raw.githubusercontent.com/NightCatSama/pokedex/main/images/sprite/forward/151.png",
      "images/Ash_01.png"
    ];

    // 動態載入全 151 隻正反面圖片，精確達到 333/333
    if (typeof POKEMON_MAP !== "undefined") {
      POKEMON_MAP.forEach(p => {
        if (p.forward_sprite) urls.push(p.forward_sprite);
        if (p.back_sprite) urls.push(p.back_sprite);
      });
    }

    let loaded = 0;
    const total = urls.length;

    const complete = () => {
      if (bEl) bEl.style.width = "100%";
      if (pctEl) pctEl.textContent = "100%";
      if (countEl) countEl.textContent = `${total} / ${total}`;
      if (sEl) sEl.textContent = "載入完成！點擊螢幕開啟冒險！";
      setTimeout(() => {
        if (pEl) pEl.classList.add("hidden");
        const splash = document.getElementById("splashScreen");
        if (splash) splash.classList.remove("hidden");
        this.state = "SPLASH";
      }, 350);
    };

    if (total === 0) { complete(); return; }

    urls.forEach(url => {
      const rec = SpriteCache.get(url);
      if (!rec || rec.loaded || rec.error) {
        loaded++;
        const pct = Math.round((loaded / total) * 100);
        if (bEl) bEl.style.width = `${pct}%`;
        if (pctEl) pctEl.textContent = `${pct}%`;
        if (countEl) countEl.textContent = `${loaded} / ${total}`;
        if (loaded >= total) complete();
      } else {
        const ol = rec.img.onload, oe = rec.img.onerror;
        rec.img.onload = () => {
          rec.loaded = true; if (ol) ol();
          loaded++;
          const pct = Math.round((loaded / total) * 100);
          if (bEl) bEl.style.width = `${pct}%`;
          if (pctEl) pctEl.textContent = `${pct}%`;
          if (countEl) countEl.textContent = `${loaded} / ${total}`;
          if (loaded >= total) complete();
        };
        rec.img.onerror = () => {
          rec.error = true; if (oe) oe();
          loaded++;
          if (loaded >= total) complete();
        };
      }
    });
  },

  enterLobbyFromSplash() {
    if (this.state !== "SPLASH") return;
    SoundFX.init();
    SoundFX.play("levelup");
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
    if (!this.saveData) {
      this.saveData = {
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
      };
    }

    const coinsVal = (this.saveData.coins || 0).toLocaleString();
    const c1 = document.getElementById("titleCoinDisplay");
    const c2 = document.getElementById("wizardCoinDisplay");
    if (c1) c1.textContent = coinsVal;
    if (c2) c2.textContent = coinsVal;

    const sCount = document.getElementById("titleShinyCount");
    if (sCount) sCount.textContent = Object.keys(this.saveData.shinyUnlocked || {}).length;

    const p = (typeof POKEMON_MAP !== "undefined" && POKEMON_MAP.get(this.selectedStarterId)) || { id: 25, name_zh: "皮卡丘", forward_sprite: "https://raw.githubusercontent.com/NightCatSama/pokedex/main/images/sprite/forward/25.png" };
    const t = this.selectedTrainer || (typeof TRAINERS !== "undefined" ? TRAINERS[0] : { name: "小智", sprite: "images/Ash_01.png" });

    const lTrImg = document.getElementById("lobbyTrainerPreview");
    const lPkImg = document.getElementById("lobbyPokemonPreview");
    if (lTrImg && t) {
      lTrImg.src = t.sprite;
      const tNameEl = document.getElementById("lobbyTrainerName");
      if (tNameEl) tNameEl.textContent = t.name;
    }
    if (lPkImg && p) {
      lPkImg.src = p.forward_sprite;
      const pNameEl = document.getElementById("lobbyPokemonName");
      if (pNameEl) pNameEl.textContent = `${p.name_zh} (#${String(p.id).padStart(3, '0')})`;
    }
  },

  // 支援指定起始步驟：主按鈕預設為 3 (直接進入難度地圖模式選擇)
  openSetupFlow(startStep = 3) {
    SoundFX.init();
    document.getElementById("titleScreen").classList.add("hidden");
    document.getElementById("setupModal").classList.remove("hidden");
    this.setWizardStep(startStep);
    const scrollArea = document.querySelector("#setupModal .overflow-y-auto");
    if (scrollArea) scrollArea.scrollTop = 0;
  },

  backToTitle() {
    document.getElementById("setupModal").classList.add("hidden");
    document.getElementById("titleScreen").classList.remove("hidden");
    this.updateTitleUI();
  },

  setWizardStep(step) {
    this.wizardStep = step;
    [1, 2, 3].forEach(s => {
      const tabEl = document.getElementById(`stepTab${s}`);
      const stepEl = document.getElementById(`wizardStep${s}`);
      if (tabEl) {
        tabEl.className = s === step
          ? "py-3 border-b-4 border-red-600 text-red-600 bg-white"
          : "py-3 border-b-4 border-transparent text-slate-500";
      }
      if (stepEl) stepEl.classList.toggle("hidden", s !== step);
    });

    const prevBtn = document.getElementById("btnWizardPrev");
    const nextBtn = document.getElementById("btnWizardNext");
    if (prevBtn) prevBtn.classList.toggle("hidden", step === 1);
    if (nextBtn) nextBtn.textContent = step === 3 ? "進入冒險 ➔" : "下一步 →";

    const titleEl = document.getElementById("wizardStepTitle");
    const descEl = document.getElementById("wizardStepDesc");
    const titles = { 1: "STEP 1/3：選擇隨行訓練家", 2: "STEP 2/3：挑選出戰寶可夢", 3: "STEP 3/3：挑戰難度與關都生態地圖" };
    const descs = { 1: "每位訓練家皆有專屬代表精靈羈絆（傷害+25%）！", 2: "挑選初始夥伴出擊！", 3: "難度越高，代幣與經驗獎勵加成越豐厚！" };
    if (titleEl) titleEl.textContent = titles[step];
    if (descEl) descEl.textContent = descs[step];

    if (step === 1) this.renderWizardTrainers();
    if (step === 2) this.renderWizardPokemon();
    if (step === 3) this.renderWizardDifficultiesAndStages();
  },

  prevWizardStep() {
    if (this.wizardStep > 1) this.setWizardStep(this.wizardStep - 1);
  },

  nextWizardStep() {
    if (this.wizardStep < 3) {
      this.setWizardStep(this.wizardStep + 1);
    } else {
      this.startGameRun();
    }
  },

  renderWizardTrainers() {
    const box = document.getElementById("wizardStep1");
    if (!box || typeof TRAINERS === "undefined") return;
    box.innerHTML = TRAINERS.map(tr => {
      const isSel = (this.selectedTrainer && this.selectedTrainer.id === tr.id) || (!this.selectedTrainer && tr.id === "ash");
      return `
        <div onclick="GameApp.selectTrainer('${tr.id}')" class="poke-card cursor-pointer p-3.5 flex flex-col justify-between ${isSel ? 'selected' : ''}">
          <div class="flex items-center gap-3">
            <img src="${tr.sprite}" class="w-14 h-14 pixel-sprite object-contain bg-slate-100 rounded-xl p-1"/>
            <div>
              <div class="font-black text-sm text-slate-900">${tr.name}</div>
              <div class="text-[10px] font-bold text-red-600 mt-0.5">指令: ${tr.skillName}</div>
            </div>
          </div>
          <p class="text-xs font-bold text-slate-600 mt-2">${tr.desc}</p>
        </div>
      `;
    }).join("");
  },

  selectTrainer(id) {
    if (typeof TRAINERS !== "undefined") {
      this.selectedTrainer = TRAINERS.find(t => t.id === id) || TRAINERS[0];
    }
    this.renderWizardTrainers();
    this.updateTitleUI();
  },

  renderWizardPokemon() {
    const box = document.getElementById("wizardStep2");
    if (!box || typeof STARTER_POKEMON_LIST === "undefined") return;
    box.innerHTML = STARTER_POKEMON_LIST.map(p => {
      const isSel = this.selectedStarterId === p.id;
      return `
        <div onclick="GameApp.selectStarter(${p.id})" class="poke-card cursor-pointer p-3 flex flex-col items-center text-center ${isSel ? 'selected' : ''}">
          <img src="${p.forward_sprite}" class="w-14 h-14 pixel-sprite object-contain mb-1.5"/>
          <span class="font-black text-xs text-slate-800">${p.name_zh}</span>
          <span class="text-[9px] font-bold text-slate-500">#${String(p.id).padStart(3, '0')}</span>
        </div>
      `;
    }).join("");
  },

  selectStarter(id) {
    this.selectedStarterId = id;
    this.renderWizardPokemon();
    this.updateTitleUI();
  },

  renderWizardDifficultiesAndStages() {
    const dBox = document.getElementById("difficultyGrid");
    const sBox = document.getElementById("stageGrid");
    if (dBox && typeof GAME_DIFFICULTIES !== "undefined") {
      dBox.innerHTML = GAME_DIFFICULTIES.map(d => {
        const isSel = this.selectedDifficulty && this.selectedDifficulty.id === d.id;
        return `
          <div onclick="GameApp.selectDifficulty('${d.id}')" class="poke-card cursor-pointer p-3 flex items-center justify-between ${isSel ? 'selected' : ''}">
            <div>
              <div class="font-black text-xs text-slate-900">${d.name}</div>
              <div class="text-[10px] font-bold text-slate-500">${d.desc}</div>
            </div>
            <span class="text-xs font-black text-amber-600">x${d.coinMult} 賞金</span>
          </div>
        `;
      }).join("");
    }
    if (sBox && typeof MAP_STAGES !== "undefined") {
      sBox.innerHTML = MAP_STAGES.map(st => `
        <div class="poke-card p-3 flex items-center gap-2 selected">
          <i class="fa-solid fa-tree text-emerald-600 text-lg"></i>
          <div>
            <div class="font-black text-xs text-slate-900">${st.name}</div>
            <div class="text-[10px] font-bold text-slate-500">${st.desc}</div>
          </div>
        </div>
      `).join("");
    }
  },

  selectDifficulty(id) {
    if (typeof GAME_DIFFICULTIES !== "undefined") {
      this.selectedDifficulty = GAME_DIFFICULTIES.find(d => d.id === id) || GAME_DIFFICULTIES[0];
    }
    this.renderWizardDifficultiesAndStages();
  },

  openPokedexModal() { document.getElementById("pokedexModal")?.classList.remove("hidden"); },
  closePokedexModal() { document.getElementById("pokedexModal")?.classList.add("hidden"); },
  openSkillTreeModal() { document.getElementById("skillTreeModal")?.classList.remove("hidden"); },
  closeSkillTreeModal() { document.getElementById("skillTreeModal")?.classList.add("hidden"); },
  openAchievementModal() { document.getElementById("achievementModal")?.classList.remove("hidden"); },
  closeAchievementModal() { document.getElementById("achievementModal")?.classList.add("hidden"); },

  populateEndModalStats() {
    const mins = String(Math.floor(this.runTime / 60)).padStart(2, "0");
    const secs = String(Math.floor(this.runTime % 60)).padStart(2, "0");
    document.getElementById("endStatTime").textContent = `${mins}:${secs}`;
    document.getElementById("endStatKills").textContent = this.kills;
    document.getElementById("endStatCoins").textContent = `+${this.runCoins}`;
    if (this.player) {
      document.getElementById("endStatPartner").textContent = `${this.selectedTrainer ? this.selectedTrainer.name : '小智'} & ${this.player.data.name_zh}`;
    }
  },

  quitToTitle() {
    this.saveToStorage();
    document.getElementById("endModal").classList.add("hidden");
    document.getElementById("hudLayer").classList.add("hidden");
    document.getElementById("titleScreen").classList.remove("hidden");
    this.state = "TITLE";
    this.updateTitleUI();
  },

  saveToStorage() {
    try { localStorage.setItem("poke_adv_save", JSON.stringify(this.saveData)); } catch (e) {}
  },

  loadSaveData() {
    try {
      const data = localStorage.getItem("poke_adv_save");
      if (data) Object.assign(this.saveData, JSON.parse(data));
    } catch (e) {}
  }
});

// 確保腳本載入後立刻啟動存檔與預載
if (window.GameApp) {
  if (window.GameApp.loadSaveData) window.GameApp.loadSaveData();
  if (window.GameApp.updateTitleUI) window.GameApp.updateTitleUI();
  if (window.GameApp.runAssetPreloader) window.GameApp.runAssetPreloader();
}