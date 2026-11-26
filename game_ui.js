/**
 * ============================================================================
 * game_ui.js
 * 大廳介面、三步驟選角嚮導、151 圖鑑系統、寶可夢中心天賦升級、
 * 道館榮譽成就、解鎖確認彈窗與結算介面 (DPS Breakdown)
 * ============================================================================
 */

window.GameApp = window.GameApp || {};

Object.assign(window.GameApp, {
  wizardStep: 1,
  wizardPokeFilter: "ALL",
  pokedexFilter: "ALL",
  centerTab: "pokemon",
  selectedTrainer: TRAINERS[0],
  selectedStarterId: 25,
  pendingUnlockType: null,
  pendingUnlockId: null,
  pendingUnlockCost: 0,
  useShinyStarter: {},
  pokedexShowBack: {},
  pokedexShowMega: {},
  pokedexShowShiny: {},
  selectedGameMode: "expedition",
  selectedArenaBossId: 144,
  selectedArenaDifficultyId: "standard",
  selectedArenaHeldItem: "silk_scarf",
  selectedDifficulty: DIFFICULTIES[1],
  selectedStage: STAGES[0],
  selectedLoadout: "none",
  selectedLoadouts: [],

  // 封面漫步展示動畫配置
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

  // 存檔資料載入與同步
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
          pokemonStars: { ...(this.saveData.pokemonStars || {}), ...(parsed.pokemonStars || {}) },
          stats: { ...this.saveData.stats, ...(parsed.stats || {}) },
          pokedexSeen: { ...this.saveData.pokedexSeen, ...(parsed.pokedexSeen || {}) },
          pokedexCaught: { ...this.saveData.pokedexCaught, ...(parsed.pokedexCaught || {}) },
          pokedexRewardClaimed: { ...(parsed.pokedexRewardClaimed || {}) },
          shinyUnlocked: { ...this.saveData.shinyUnlocked, ...(parsed.shinyUnlocked || {}) },
          megaUnlocked: { ...(this.saveData.megaUnlocked || {}), ...(parsed.megaUnlocked || {}) },
          selectedCostumes: { ash: "classic", lillie: "alola_powered", serena: "kalos_short", ...(this.saveData.selectedCostumes || {}), ...(parsed.selectedCostumes || {}) },
          unlockedCostumes: { ash: { classic: true, cutin_tactical: true }, lillie: { alola_powered: true, classic_hat: true }, serena: { kalos_short: true, kalos_long: true }, ...(this.saveData.unlockedCostumes || {}), ...(parsed.unlockedCostumes || {}) },
          claimedAch: { ...(parsed.claimedAch || {}) },
          bestRatings: { ...(this.saveData.bestRatings || {}), ...(parsed.bestRatings || {}) },
          lastSetup: parsed.lastSetup ? { ...parsed.lastSetup } : (this.saveData.lastSetup || null),
          lastSeenVersion: parsed.lastSeenVersion || "",
          settings: {
            mobCapProfile: "auto",
            screenFilter: "none",
            dmgTextMode: "crit_only",
            procNoticeMode: "icon",
            screenShake: "low",
            fourthSlotPoolMode: "affinity",
            skillAlpha: "85",
            uiTheme: "gba",
            ...(this.saveData.settings || {}),
            ...(parsed.settings || {})
          }
        };
      }
    } catch (e) {}
    if (this.saveData && this.saveData.settings) {
      if (this.saveData.settings.skillAlpha === "75" || this.saveData.settings.skillAlpha === "65") this.saveData.settings.skillAlpha = "85";
      if (this.saveData.settings.skillAlpha === "45" || this.saveData.settings.skillAlpha === "40") this.saveData.settings.skillAlpha = "50";
    }
    this.restoreLastSetup();
    this.applyVisualSettings();
  },

  saveLastSetup() {
    if (!this.saveData) return;
    this.saveData.lastSetup = {
      trainerId: (this.selectedTrainer && this.selectedTrainer.id) || "ash",
      starterId: this.selectedStarterId || 25,
      useShinyStarter: { ...(this.useShinyStarter || {}) },
      stageId: (this.selectedStage && this.selectedStage.id) || "pallet",
      difficultyId: (this.selectedDifficulty && this.selectedDifficulty.id) || "normal",
      gameMode: this.selectedGameMode || "standard",
      arenaBossId: this.selectedArenaBossId || 144,
      arenaDifficultyId: this.selectedArenaDifficultyId || "standard",
      arenaHeldItem: this.selectedArenaHeldItem || "silk_scarf"
    };
    try {
      localStorage.setItem("POKEMON_ADV_SURVIVORS_V4", JSON.stringify(this.saveData));
    } catch (e) {}
  },

  restoreLastSetup() {
    const ls = this.saveData && this.saveData.lastSetup;
    if (!ls || typeof ls !== "object") return;
    if (ls.trainerId && this.saveData.unlockedTrainers && this.saveData.unlockedTrainers[ls.trainerId]) {
      const tr = TRAINERS.find(x => x.id === ls.trainerId);
      if (tr) this.selectedTrainer = tr;
    }
    if (ls.starterId && this.saveData.unlockedPokemon && this.saveData.unlockedPokemon[ls.starterId] && POKEMON_MAP.has(ls.starterId)) {
      this.selectedStarterId = ls.starterId;
    }
    if (ls.useShinyStarter && typeof ls.useShinyStarter === "object") {
      this.useShinyStarter = { ...ls.useShinyStarter };
    }
    if (ls.stageId) {
      const st = STAGES.find(s => s.id === ls.stageId);
      if (st) {
        this.selectedStage = st;
        if (typeof MapEngine !== "undefined" && MapEngine.setStage) MapEngine.setStage(st.id);
      }
    }
    if (ls.difficultyId) {
      const df = DIFFICULTIES.find(d => d.id === ls.difficultyId);
      if (df) this.selectedDifficulty = df;
    }
    if (ls.gameMode === "standard" || ls.gameMode === "endless" || ls.gameMode === "arena" || ls.gameMode === "expedition") {
      this.selectedGameMode = ls.gameMode;
    }
    if (ls.arenaBossId) this.selectedArenaBossId = ls.arenaBossId;
    if (ls.arenaDifficultyId) this.selectedArenaDifficultyId = ls.arenaDifficultyId;
    if (ls.arenaHeldItem && HELD_ITEMS[ls.arenaHeldItem]) this.selectedArenaHeldItem = ls.arenaHeldItem;
  },

  saveToStorage() {
    try {
      localStorage.setItem("POKEMON_ADV_SURVIVORS_V4", JSON.stringify(this.saveData));
    } catch (e) {}
    this.updateTitleUI();
  },

  runAssetPreloader() {
    const priorityUrls = new Set(["images/logo_title.png", "images/skills_icons_sheet.png", "images/mega_ring_icon.png"]);
    const secondaryUrls = new Set();

    // 1. 優先佇列：所有道具、攜帶物、技能圖標、商店與研究所圖標、訓練家與一階出戰精靈
    if (typeof ITEM_SPRITES !== "undefined") {
      Object.values(ITEM_SPRITES).forEach(u => { if (u) priorityUrls.add(u); });
    }
    if (typeof HELD_ITEMS !== "undefined") {
      Object.values(HELD_ITEMS).forEach(it => { if (it && it.sprite) priorityUrls.add(it.sprite); });
    }
    if (typeof SKILLS_CATALOG !== "undefined") {
      Object.values(SKILLS_CATALOG).forEach(sk => { if (sk && sk.sprite) priorityUrls.add(sk.sprite); });
    }
    if (typeof TM_CATALOG !== "undefined") {
      Object.values(TM_CATALOG).forEach(tm => { if (tm && tm.sprite) priorityUrls.add(tm.sprite); });
    }
    if (typeof MART_SPECIAL_ITEMS !== "undefined") {
      Object.values(MART_SPECIAL_ITEMS).forEach(it => { if (it && it.sprite) priorityUrls.add(it.sprite); });
    }
    if (typeof MAP_BOSS_LOOTS !== "undefined") {
      Object.values(MAP_BOSS_LOOTS).forEach(lt => { if (lt && lt.sprite) priorityUrls.add(lt.sprite); });
    }
    if (typeof CENTER_POKEMON_UPGRADES !== "undefined") {
      CENTER_POKEMON_UPGRADES.forEach(u => { if (u && u.sprite) priorityUrls.add(u.sprite); });
    }
    if (typeof CENTER_TRAINER_UPGRADES !== "undefined") {
      CENTER_TRAINER_UPGRADES.forEach(u => { if (u && u.sprite) priorityUrls.add(u.sprite); });
    }
    if (typeof TRAINERS !== "undefined") {
      TRAINERS.forEach(t => {
        if (t.sprite) priorityUrls.add(t.sprite);
        if (t.walkSheet) priorityUrls.add(t.walkSheet);
        if (t.sprites) Object.values(t.sprites).forEach(u => { if (u) priorityUrls.add(u); });
        if (t.cutin) priorityUrls.add(t.cutin);
        if (Array.isArray(t.costumes)) {
          t.costumes.forEach(c => {
            if (c.sprite) priorityUrls.add(c.sprite);
            if (c.walkSheet) priorityUrls.add(c.walkSheet);
            if (c.cutin) priorityUrls.add(c.cutin);
          });
        }
      });
    }
    if (typeof POKEMON_DB !== "undefined") {
      const evoTargets = new Set(POKEMON_DB.map(p => p.evo_to).filter(Boolean));
      POKEMON_DB.forEach(p => {
        const isBaseOrLegend = !evoTargets.has(p.id) || p.id >= 144;
        if (isBaseOrLegend) {
          if (p.forward_sprite) priorityUrls.add(p.forward_sprite);
          if (p.back_sprite) priorityUrls.add(p.back_sprite);
        } else {
          if (p.forward_sprite) secondaryUrls.add(p.forward_sprite);
          if (p.back_sprite) secondaryUrls.add(p.back_sprite);
        }
      });
    }

    const priList = Array.from(priorityUrls).filter(u => typeof u === "string" && u.trim().length > 0);
    const secList = Array.from(secondaryUrls).filter(u => typeof u === "string" && u.trim().length > 0 && !priorityUrls.has(u));
    const allList = [...priList, ...secList];
    const total = allList.length;
    let done = 0;
    let finished = false;

    const bar = document.getElementById("preloaderBar");
    const countEl = document.getElementById("preloaderCountText");
    const pctEl = document.getElementById("preloaderPctText");
    const statusEl = document.getElementById("preloaderStatusText");

    const complete = () => {
      if (finished) return;
      finished = true;
      if (bar) bar.style.width = "100%";
      if (countEl) countEl.textContent = `${total} / ${total}`;
      if (pctEl) pctEl.textContent = "100%";
      if (statusEl) statusEl.textContent = "關都自然生態、圖鑑快取與招式引擎建構完畢！";
      setTimeout(() => {
        const preEl = document.getElementById("preloader-screen");
        const splashEl = document.getElementById("splashScreen");
        if (preEl) preEl.classList.add("hidden");
        if (splashEl) splashEl.classList.remove("hidden");
        this.state = "SPLASH";
      }, 180);
    };

    if (total === 0) {
      complete();
      return;
    }

    // 分批併發佇列 (每批最大 24 條連線)：徹底防止 350 張圖同時請求塞爆瀏覽器與 GitHub CDN 導致掉圖
    let cursor = 0;
    const maxConcurrency = 10;

    const loadNext = () => {
      if (cursor >= allList.length) return;
      const url = allList[cursor++];

      let settled = false;
      const onAssetSettled = () => {
        if (settled) return;
        settled = true;
        done += 1;
        if (!finished) {
          const pct = Math.min(100, Math.round((done / total) * 100));
          if (bar) bar.style.width = `${pct}%`;
          if (countEl) countEl.textContent = `${done} / ${total}`;
          if (pctEl) pctEl.textContent = `${pct}%`;
          if (done >= total) complete();
        }
        loadNext();
      };

      SpriteCache.onFinish(url, onAssetSettled);
    };

    // 兜底安全計時器：若網路較慢，最多等待 5.5 秒即放行進入封面，同時背景佇列繼續把剩餘圖片載完
    setTimeout(complete, 5500);

    for (let i = 0; i < Math.min(maxConcurrency, allList.length); i++) {
      loadNext();
    }
  },

  enterLobbyFromSplash() {
    if (this._enteringLobby) return;
    this._enteringLobby = true;

    try {
      if (typeof SoundFX !== "undefined") {
        SoundFX.init();
        SoundFX.play("levelup");
        SoundFX.startBgm("lobby");
      }
    } catch (err) {
      console.warn("AudioContext init warning:", err);
    }

    const splashEl = document.getElementById("splashScreen");
    const titleEl = document.getElementById("titleScreen");
    const preEl = document.getElementById("preloader-screen");
    const shutterEl = document.getElementById("pokeballTransitionOverlay");

    if (preEl) preEl.classList.add("hidden");

    const revealLobby = () => {
      this.state = "TITLE";
      if (splashEl) {
        splashEl.classList.add("hidden");
        splashEl.style.display = "none";
      }
      if (titleEl) {
        titleEl.style.display = "flex";
        titleEl.classList.remove("hidden");
        Array.from(titleEl.children).forEach((child, idx) => {
          child.classList.remove("lobby-pop-in");
          void child.offsetWidth;
          child.style.animationDelay = `${idx * 70}ms`;
          child.classList.add("lobby-pop-in");
        });
      }
      try {
        this.updateTitleUI();
        const ver = this.APP_VERSION || "v7.6.6";
        const isReturningPlayer = !!(this.saveData && this.saveData.stats && (this.saveData.stats.totalKills || 0) > 0);
        if (isReturningPlayer && this.saveData.lastSeenVersion !== ver && !this._autoChangelogShown) {
          this._autoChangelogShown = true;
          setTimeout(() => {
            if (this.state === "TITLE") this.openChangelogModal();
          }, 420);
        }
      } catch (e) {
        console.error("updateTitleUI error:", e);
      }
    };

    if (shutterEl) {
      shutterEl.classList.remove("hidden", "pokeball-shutter-active");
      void shutterEl.offsetWidth;
      shutterEl.classList.add("pokeball-shutter-active");

      setTimeout(revealLobby, 260);
      setTimeout(() => {
        shutterEl.classList.add("hidden");
        shutterEl.classList.remove("pokeball-shutter-active");
        this._enteringLobby = false;
      }, 660);
    } else {
      revealLobby();
      this._enteringLobby = false;
    }
  },

  backToSplash() {
    this.state = "SPLASH";
    const titleEl = document.getElementById("titleScreen");
    const splashEl = document.getElementById("splashScreen");
    if (titleEl) {
      titleEl.classList.add("hidden");
      titleEl.style.display = "none";
    }
    if (splashEl) {
      splashEl.style.display = "flex";
      splashEl.classList.remove("hidden");
    }
  },

  handleLobbyShinySecretTap(e) {
    if (this.state !== "TITLE") return;
    if (e && typeof e.preventDefault === "function") e.preventDefault();
    const now = performance.now();
    if (!Array.isArray(this._secretDebugTaps)) this._secretDebugTaps = [];
    this._secretDebugTaps = this._secretDebugTaps.filter(t => now - t <= 3000);
    this._secretDebugTaps.push(now);
    if (this._secretDebugTaps.length >= 10) {
      this._secretDebugTaps = [];
      this.debugToolsUnlocked = !this.debugToolsUnlocked;
      if (this.syncDebugButtonVisibility) this.syncDebugButtonVisibility();
      if (typeof SoundFX !== "undefined") SoundFX.play(this.debugToolsUnlocked ? "shiny" : "hit");
      const box = document.getElementById("lobbyShinyCounterBox");
      if (box) {
        box.classList.add("ring-2", "ring-amber-400");
        setTimeout(() => box.classList.remove("ring-2", "ring-amber-400"), 800);
      }
      this.pixelAlert(this.debugToolsUnlocked
        ? "🔧 測試工具已解鎖（防 F12 保護亦已暫時解除）！後續進入遊戲後，右上方將顯示測試齒輪按鈕。"
        : "🔒 測試工具已重新隱藏，防 F12 保護已恢復。", "開發者工具");
    }
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
    // 安全防護：若 saveData 尚未初始化，自動補上預設物件
    if (!this.saveData) {
      this.saveData = {
        coins: 800,
        unlockedPokemon: { 1: true, 4: true, 7: true, 10: true, 16: true, 25: true },
        unlockedTrainers: { ash: true, misty: true, brock: true },
        upgrades: { atk: 0, cd: 0, hp: 0, shiny: 0, fourthSlot: 0, rerollCount: 0, trainerCd: 0, partner: 0, greed: 0 },
        stats: { totalKills: 0, evolutions: 0, superMoves: 0, birdsDefeated: 0, mewtwoDefeated: 0, mewDefeated: 0, gemsCollected: 0, bestStandardTime: 0, clearedStages: {} },
        pokedexSeen: { 1: true, 4: true, 7: true, 10: true, 16: true, 25: true, 133: true },
        pokedexCaught: { 1: true, 4: true, 7: true, 10: true, 16: true, 25: true },
        pokedexRewardClaimed: {},
        shinyUnlocked: { 25: true },
        claimedAch: {}
      };
    }

    const coinsVal = (this.saveData.coins || 0).toLocaleString();
    const c1 = document.getElementById("titleCoinDisplay");
    const c2 = document.getElementById("shopCoinDisplay");
    const c3 = document.getElementById("wizardCoinDisplay");
    if (c1) c1.textContent = coinsVal;
    if (c2) c2.textContent = coinsVal;
    if (c3) c3.textContent = coinsVal;

    const sCount = document.getElementById("titleShinyCount");
    if (sCount) sCount.textContent = Object.keys(this.saveData.shinyUnlocked || {}).length;

    const p = (typeof POKEMON_MAP !== "undefined" && POKEMON_MAP.get(this.selectedStarterId)) || (typeof POKEMON_MAP !== "undefined" && POKEMON_MAP.get(25)) || { id: 25, name_zh: "皮卡丘", forward_sprite: "" };
    const t = this.selectedTrainer || (typeof TRAINERS !== "undefined" ? TRAINERS[0] : { name: "小智", sprite: "" });
    const useShiny = !!(this.saveData.shinyUnlocked && this.saveData.shinyUnlocked[p.id]) && !!(this.useShinyStarter && this.useShinyStarter[p.id]);

    const lTrImg = document.getElementById("lobbyTrainerPreview");
    const lPkImg = document.getElementById("lobbyPokemonPreview");
    if (lTrImg && t) {
      const trCos = (typeof getResolvedTrainerCostume === "function") ? getResolvedTrainerCostume(t, this.saveData) : t;
      const trHdUrl = trCos.cutin || trCos.sprite;
      lTrImg.onerror = () => {
        lTrImg.onerror = null;
        lTrImg.src = trCos.sprite || t.sprite;
        lTrImg.className = "w-12 h-12 sm:w-14 sm:h-14 pixel-sprite object-contain";
      };
      lTrImg.src = SpriteCache.resolveUrl(trHdUrl);
      lTrImg.className = trCos.cutin
        ? "w-full h-full object-cover object-top"
        : "w-12 h-12 sm:w-14 sm:h-14 pixel-sprite object-contain";
      const tNameEl = document.getElementById("lobbyTrainerName");
      const hasMultiCostumes = Array.isArray(t.costumes) && t.costumes.length > 1;
      if (tNameEl) tNameEl.textContent = hasMultiCostumes ? `${t.name} ‧ ${trCos.badge}` : t.name;
    }
    if (lPkImg && p) {
      const fallbackPxUrl = SpriteCache.resolveUrl((useShiny && p.shiny_forward_sprite) ? p.shiny_forward_sprite : p.forward_sprite);
      const hdArtUrl = (typeof getPokemonOfficialArtworkUrl === "function")
        ? getPokemonOfficialArtworkUrl(p.id, useShiny)
        : fallbackPxUrl;
      lPkImg.onerror = () => {
        lPkImg.onerror = null;
        lPkImg.src = fallbackPxUrl;
        lPkImg.className = "w-12 h-12 sm:w-14 sm:h-14 pixel-sprite object-contain";
      };
      lPkImg.src = hdArtUrl;
      lPkImg.className = "w-full h-full object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.28)]";
      const pNameEl = document.getElementById("lobbyPokemonName");
      const starLv = (this.saveData.pokemonStars && this.saveData.pokemonStars[p.id]) || 0;
      const starStr = starLv > 0 ? ` ${'★'.repeat(starLv)}` : '';
      if (pNameEl) pNameEl.textContent = `${p.name_zh} (#${String(p.id).padStart(3,'0')})${starStr}`;

      const evoEl = document.getElementById("lobbyEvolutionPreview");
      if (evoEl && typeof POKEMON_MAP !== "undefined") {
        if (p.id === 133) {
          const v134 = POKEMON_MAP.get(134), v135 = POKEMON_MAP.get(135), v136 = POKEMON_MAP.get(136);
          const s134 = !!(this.saveData.pokedexSeen && this.saveData.pokedexSeen[134]);
          const s135 = !!(this.saveData.pokedexSeen && this.saveData.pokedexSeen[135]);
          const s136 = !!(this.saveData.pokedexSeen && this.saveData.pokedexSeen[136]);
          evoEl.innerHTML = `
            <span class="text-[9px] font-black text-purple-700 shrink-0"><i class="fa-solid fa-code-branch"></i> 進化鏈：</span>
            <div class="flex items-center gap-1 overflow-x-auto py-0.5">
              <span class="px-1.5 py-0.2 bg-white rounded border border-slate-300 text-[9px] font-black text-slate-800">伊布</span>
              <span class="text-purple-600 font-black text-[9px]">➔ Lv.${p.evo_level || 18} 三選一 ➔</span>
              <div class="flex items-center gap-1 bg-white px-1.5 py-0.5 rounded border border-purple-300">
                ${v134 ? `<img src="${v134.forward_sprite}" title="${s134 ? v134.name_zh : '???'}" class="w-7 h-7 pixel-sprite object-contain ${s134 ? '' : 'brightness-0 opacity-30'}"/>` : ''}
                ${v135 ? `<img src="${v135.forward_sprite}" title="${s135 ? v135.name_zh : '???'}" class="w-7 h-7 pixel-sprite object-contain ${s135 ? '' : 'brightness-0 opacity-30'}"/>` : ''}
                ${v136 ? `<img src="${v136.forward_sprite}" title="${s136 ? v136.name_zh : '???'}" class="w-7 h-7 pixel-sprite object-contain ${s136 ? '' : 'brightness-0 opacity-30'}"/>` : ''}
              </div>
            </div>
          `;
        } else if (p.evo_to && p.evo_level !== "None") {
          const chain = [p];
          let cur = p;
          while (cur && cur.evo_to && cur.evo_level !== "None") {
            const nextP = POKEMON_MAP.get(cur.evo_to);
            if (!nextP || chain.includes(nextP)) break;
            chain.push(nextP);
            cur = nextP;
          }
          const stepsHtml = chain.map((stPoke, idx) => {
            const isKnown = idx === 0 || !!(this.saveData.pokedexSeen && this.saveData.pokedexSeen[stPoke.id]) || !!(this.saveData.unlockedPokemon && this.saveData.unlockedPokemon[stPoke.id]);
            const prevLv = idx > 0 ? chain[idx - 1].evo_level : null;
            const arrowHtml = idx > 0 ? `<span class="text-[8px] font-black text-amber-600 shrink-0">➔L${prevLv}</span>` : '';
            return `
              ${arrowHtml}
              <div class="flex items-center gap-0.5 bg-white px-1 py-0.5 rounded-md border ${idx === chain.length - 1 ? 'border-amber-400 bg-amber-50/40' : 'border-slate-300'} shrink-0">
                <img src="${stPoke.forward_sprite}" class="w-7 h-7 pixel-sprite object-contain ${isKnown ? '' : 'brightness-0 opacity-25'}" alt="${isKnown ? stPoke.name_zh : '???'}"/>
                <span class="text-[8px] sm:text-[9px] font-black ${isKnown ? 'text-slate-800' : 'text-slate-400'}">${isKnown ? stPoke.name_zh : '???'}</span>
              </div>
            `;
          }).join("");
          const lastPoke = chain[chain.length - 1];
          const megaFormLobby = (lastPoke && typeof MEGA_FORMS !== "undefined") ? MEGA_FORMS[lastPoke.id] : null;
          let megaStepHtml = "";
          if (megaFormLobby) {
            const isMegaKnown = !!(this.saveData.megaUnlocked && this.saveData.megaUnlocked[megaFormLobby.baseId]);
            megaStepHtml = `
              <span class="text-[8px] font-black text-cyan-600 shrink-0">➔</span>
              <div onclick="event.stopPropagation(); GameApp.openMegaInfoModal(${megaFormLobby.baseId})" class="flex items-center gap-0.5 px-1 py-0.5 rounded-md border shrink-0 cursor-pointer ${isMegaKnown ? 'border-cyan-400 bg-sky-50' : 'border-purple-400 bg-purple-50'}">
                <img src="${megaFormLobby.forward_sprite}" class="w-7 h-7 pixel-sprite object-contain ${isMegaKnown ? '' : 'brightness-0 opacity-40'}" alt="MEGA"/>
                <span class="text-[8px] sm:text-[9px] font-black ${isMegaKnown ? 'text-cyan-700' : 'text-purple-700'}">${isMegaKnown ? '💎MEGA' : '💎???'}</span>
              </div>
            `;
          }
          evoEl.innerHTML = `
            <div class="flex items-center gap-1 flex-wrap w-full">
              <span class="text-[8px] sm:text-[9px] font-black text-blue-700 shrink-0"><i class="fa-solid fa-angles-up"></i> 進化</span>
              ${stepsHtml}${megaStepHtml}
            </div>
          `;
        } else {
          const isLegend = p.id >= 144;
          const singleMega = (typeof MEGA_FORMS !== "undefined") ? MEGA_FORMS[p.id] : null;
          if (singleMega) {
            const isMegaKnown = !!(this.saveData.megaUnlocked && this.saveData.megaUnlocked[singleMega.baseId]);
            evoEl.innerHTML = `
              <span class="text-[9px] font-black text-amber-700 shrink-0"><i class="fa-solid fa-gem"></i> 超級進化：</span>
              <div class="flex items-center gap-1 overflow-x-auto">
                <div class="flex items-center gap-0.5 bg-white px-1.5 py-0.5 rounded-lg border border-slate-300 shrink-0">
                  <img src="${p.forward_sprite}" class="w-7 h-7 pixel-sprite object-contain" alt="${p.name_zh}"/>
                  <span class="text-[9px] font-black text-slate-800">${p.name_zh}</span>
                </div>
                <span class="text-[9px] font-black text-cyan-600 shrink-0">➔ 💎</span>
                <div onclick="event.stopPropagation(); GameApp.openMegaInfoModal(${singleMega.baseId})" class="flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg border shrink-0 cursor-pointer ${isMegaKnown ? 'border-cyan-400 bg-sky-50' : 'border-purple-400 bg-purple-50'}">
                  <img src="${singleMega.forward_sprite}" class="w-7 h-7 pixel-sprite object-contain ${isMegaKnown ? '' : 'brightness-0 opacity-40'}" alt="MEGA"/>
                  <span class="text-[9px] font-black ${isMegaKnown ? 'text-cyan-700' : 'text-purple-700'}">${isMegaKnown ? singleMega.name_zh : 'MEGA ???'}</span>
                </div>
              </div>
            `;
          } else {
            evoEl.innerHTML = `
              <span class="text-[9px] font-black ${isLegend ? 'text-purple-700' : 'text-emerald-700'} shrink-0">
                <i class="fa-solid fa-crown"></i> ${isLegend ? '傳說神獸王權' : '單一完全體'}：
              </span>
              <span class="text-[9px] font-bold text-slate-600 truncate">
                ${isLegend ? '天生12%霸體 ‧ 每10級神聖覺醒回血+18%體質' : 'Lv.18 潛能覺醒 (HP+22% ‧ 全傷+15% ‧ 12%霸體)'}
              </span>
            `;
          }
        }
      }
    }

    const hasAch = typeof ACHIEVEMENTS !== "undefined" && ACHIEVEMENTS.some(a => a.check(this.saveData.stats, this.saveData) && !this.saveData.claimedAch[a.id]);
    const achBadge = document.getElementById("achClaimBadge");
    if (achBadge) achBadge.classList.toggle("hidden", !hasAch);

    const hasDexReward = typeof POKEMON_DB !== "undefined" && POKEMON_DB.some(pk => this.saveData.pokedexCaught[pk.id] && !this.saveData.pokedexRewardClaimed[pk.id]);
    const dexBadge = document.getElementById("pokedexRewardBadge");
    if (dexBadge) dexBadge.classList.toggle("hidden", !hasDexReward);

    const clBadge = document.getElementById("changelogBadge");
    if (clBadge) {
      const curVer = this.APP_VERSION || "v7.6.6";
      clBadge.classList.toggle("hidden", this.saveData.lastSeenVersion === curVer);
    }
    if (this.renderLobbySkillLoadout) this.renderLobbySkillLoadout();
    if (this.updateLobbyModeHub) this.updateLobbyModeHub();
  },

  updateLobbyModeHub() {
    const summary = (typeof ModeExpedition !== "undefined" && ModeExpedition.getChapterSummary)
      ? ModeExpedition.getChapterSummary()
      : { chapterCount: 4, totalWaves: 10 };
    const cp = this.saveData && this.saveData.expeditionCheckpoint;
    const hasCp = !!(cp && cp.nextWave >= 2 && cp.nextWave <= summary.totalWaves);

    const expMetaEl = document.getElementById("lobbyExpMetaText");
    if (expMetaEl) {
      expMetaEl.textContent = `${summary.chapterCount} 大區域 ‧ 20+1 關推進 ‧ 三聖鳥歸位＆EX連戰`;
    }
    const expActionsEl = document.getElementById("lobbyExpActionRow");
    if (expActionsEl) {
      if (hasCp) {
        expActionsEl.innerHTML = `
          <button onclick="event.stopPropagation(); GameApp.resumeSavedExpedition()" class="poke-btn-yellow flex-1 py-2 text-xs font-black shadow">繼續第 ${cp.nextWave}/${summary.totalWaves} 關</button>
          <button onclick="event.stopPropagation(); GameApp.openModeFromLobby('expedition')" class="poke-btn-red px-3 py-2 text-xs font-black shadow">新開遠征</button>
        `;
      } else {
        expActionsEl.innerHTML = `
          <button onclick="event.stopPropagation(); GameApp.openModeFromLobby('expedition')" class="poke-btn-red w-full py-2 text-xs sm:text-sm font-black shadow flex items-center justify-center gap-1.5">
            <i class="fa-solid fa-play text-[10px]"></i> 展開關都大遠征 →
          </button>
        `;
      }
    }

    const arenaTimes = (this.saveData && this.saveData.stats && this.saveData.stats.arenaBestTimes) || {};
    const arenaCleared = (typeof ARENA_BOSSES !== "undefined")
      ? ARENA_BOSSES.filter(b => arenaTimes[b.id] !== undefined).length : 0;
    const arenaSub = document.getElementById("lobbyArenaSubText");
    if (arenaSub) arenaSub.textContent = `5大神獸 (${arenaCleared}/5)`;

    const bestSec = (this.saveData && this.saveData.stats && this.saveData.stats.bestEndlessTime) || 0;
    const bm = String(Math.floor(bestSec / 60)).padStart(2, "0");
    const bs = String(bestSec % 60).padStart(2, "0");
    const endSub = document.getElementById("lobbyEndlessSubText");
    if (endSub) endSub.textContent = bestSec > 0 ? `最高 ${bm}:${bs}` : "8分後無限波";
  },

  openModeFromLobby(modeId) {
    this.selectedGameMode = modeId || "expedition";
    this.saveLastSetup();
    this.openSetupFlow(3);
  },

  toggleLoadoutAccordion() {
    const grid = document.getElementById("tacticalLoadoutGrid");
    const icon = document.getElementById("loadoutAccordionIcon");
    if (!grid) return;
    const willOpen = grid.classList.contains("hidden");
    grid.classList.toggle("hidden", !willOpen);
    if (icon) icon.className = willOpen ? "fa-solid fa-chevron-up text-[10px]" : "fa-solid fa-chevron-down text-[10px]";
  },

  openSetupFlow(startStep = 3) {
    SoundFX.init();
    const titleEl = document.getElementById("titleScreen");
    if (titleEl) {
      titleEl.classList.add("hidden");
      titleEl.style.display = "none";
    }
    const setupEl = document.getElementById("setupModal");
    if (setupEl) {
      setupEl.classList.remove("hidden");
      setupEl.style.display = "flex";
    }
    this.setWizardStep(startStep);
  },

  backToTitle() {
    const setupEl = document.getElementById("setupModal");
    if (setupEl) {
      setupEl.classList.add("hidden");
      setupEl.style.display = "none";
    }
    const titleEl = document.getElementById("titleScreen");
    if (titleEl) {
      titleEl.classList.remove("hidden");
      titleEl.style.display = "flex";
    }
    this.updateTitleUI();
  },

  updateWizardLineupBar() {
    const t = this.selectedTrainer || (typeof TRAINERS !== "undefined" ? TRAINERS[0] : null);
    const p = (typeof POKEMON_MAP !== "undefined" && (POKEMON_MAP.get(this.selectedStarterId) || POKEMON_MAP.get(25))) || null;
    if (!t || !p) return;

    const trImg = document.getElementById("wizardBarTrainerImg");
    const trName = document.getElementById("wizardBarTrainerName");
    const pkImg = document.getElementById("wizardBarPokeImg");
    const pkName = document.getElementById("wizardBarPokeName");
    const pkStars = document.getElementById("wizardBarPokeStars");
    const bondBadge = document.getElementById("wizardBarBondBadge");
    const starBtn = document.getElementById("wizardBarStarBtn");
    const starBtnText = document.getElementById("wizardBarStarBtnText");
    const traitStrip = document.getElementById("wizardBarTraitStrip");
    const traitText = document.getElementById("wizardBarTraitText");
    const perkText = document.getElementById("wizardBarStarPerkText");

    const hasShiny = !!(this.saveData && this.saveData.shinyUnlocked && this.saveData.shinyUnlocked[p.id]);
    const useShiny = hasShiny && !!(this.useShinyStarter && this.useShinyStarter[p.id]);
    const starLv = (this.saveData && this.saveData.pokemonStars && this.saveData.pokemonStars[p.id]) || 0;
    const isBond = (t.bondPokemonIds || []).includes(p.id);
    const isUnlocked = !!(this.saveData && this.saveData.unlockedPokemon && this.saveData.unlockedPokemon[p.id]);
    const isStep2 = (this.wizardStep === 2);

    const _barCos = (typeof getResolvedTrainerCostume === "function") ? getResolvedTrainerCostume(t, this.saveData) : t;
    if (trImg) trImg.src = SpriteCache.resolveUrl(_barCos.sprite || t.sprite);
    if (trName) trName.textContent = t.name.split(" ")[0];
    if (pkImg) {
      pkImg.src = SpriteCache.resolveUrl((useShiny && p.shiny_forward_sprite) ? p.shiny_forward_sprite : p.forward_sprite);
      pkImg.className = "w-6 h-6 pixel-sprite object-contain shrink-0";
    }
    if (pkName) pkName.textContent = p.name_zh;
    if (pkStars) {
      pkStars.innerHTML = [1, 2, 3].map(n =>
        `<span class="${n <= starLv ? 'text-amber-400' : 'text-slate-600'}">${n <= starLv ? '★' : '☆'}</span>`
      ).join("");
    }
    if (bondBadge) {
      bondBadge.classList.toggle("hidden", !isBond);
      if (isBond) bondBadge.textContent = isStep2 ? "★ 羈絆" : `★ ${t.bondName || '羈絆'} +25%`;
    }

    if (starBtn && starBtnText) {
      if (isStep2 && isUnlocked) {
        starBtn.classList.remove("hidden");
        const starCostsTbl = [400, 800, 1500];
        const nextCost = starLv < 3 ? starCostsTbl[starLv] : 0;
        const canAfford = starLv < 3 && (this.saveData.coins || 0) >= nextCost;
        starBtn.disabled = (starLv >= 3);
        if (starLv >= 3) {
          starBtn.className = "relative px-2 py-1 rounded-xl font-black text-[10px] border flex items-center gap-1 shrink-0 bg-amber-950/70 text-amber-300 border-amber-500/70";
          starBtnText.textContent = "金冠滿星";
        } else if (canAfford) {
          starBtn.className = "relative px-2 py-1 rounded-xl font-black text-[10px] border-2 flex items-center gap-1 transition-transform active:scale-95 shrink-0 bg-gradient-to-b from-amber-300 to-amber-500 text-slate-950 border-white shadow-[0_0_12px_rgba(250,204,21,0.65)]";
          starBtnText.textContent = `突破 ★${starLv + 1} (${nextCost}金)`;
        } else {
          starBtn.className = "relative px-2 py-1 rounded-xl font-black text-[10px] border flex items-center gap-1 transition-transform active:scale-95 shrink-0 bg-slate-800 text-amber-300 border-amber-500/60";
          starBtnText.textContent = `突破 ★${starLv + 1} (${nextCost}金)`;
        }
      } else {
        starBtn.classList.add("hidden");
      }
    }

    if (traitStrip && traitText && perkText) {
      const trMeta = (typeof getPokemonInnateTrait === "function") ? getPokemonInnateTrait(p, 1) : null;
      if (isStep2 && trMeta) {
        traitStrip.classList.remove("hidden");
        traitText.innerHTML = `<span class="text-amber-300 font-black"><i class="fa-solid ${trMeta.icon} text-[9px] mr-0.5"></i>【${trMeta.name}】</span>${trMeta.desc}`;
        perkText.textContent = starLv >= 3 ? "✓ ★3開局Lv.2" : "★3開局主招Lv.2";
        perkText.className = `font-black whitespace-nowrap shrink-0 text-[9px] ${starLv >= 3 ? 'text-emerald-400' : 'text-sky-300'}`;
      } else {
        traitStrip.classList.add("hidden");
      }
    }
  },

  focusSelectedWizardCard(step) {
    const scrollArea = document.getElementById("setupScrollArea") || document.querySelector("#setupModal .overflow-y-auto");
    if (!scrollArea) return;
    if (step === 3) {
      scrollArea.scrollTop = 0;
      return;
    }
    const stepEl = document.getElementById(`wizardStep${step}`);
    const selectedCard = stepEl ? stepEl.querySelector(".poke-card.selected") : null;
    if (!selectedCard) {
      scrollArea.scrollTop = 0;
      return;
    }
    requestAnimationFrame(() => {
      const areaRect = scrollArea.getBoundingClientRect();
      const cardRect = selectedCard.getBoundingClientRect();
      const targetTop = scrollArea.scrollTop + (cardRect.top - areaRect.top) - (areaRect.height - cardRect.height) * 0.42;
      scrollArea.scrollTop = Math.max(0, targetTop);
    });
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

    const modeTitleMap = {
      expedition: ["STEP 3/3：關都大遠征 ‧ 關卡與難度 (STAGE)", "檢視本次遠征橫跨的所有生態地圖、續關進度與挑戰難度！"],
      standard:   ["STEP 3/3：8分鐘標準 ‧ 地圖與難度 (STAGE)", "挑選一張 GBA 自然生態地圖與挑戰難度，8 分鐘極速登冠！"],
      endless:    ["STEP 3/3：無盡深淵 ‧ 地圖與難度 (STAGE)", "挑選生態地圖挑戰 8 分鐘後無限雙神波次，刷新生存紀錄！"],
      arena:      ["STEP 3/3：1vs1 石英鬥技場 ‧ 挑戰設定", "選擇鬥技場難度、單挑神獸與免費攜帶物，展開純動作對決！"]
    };
    const mKey = this.selectedGameMode || "expedition";
    const titles = {
      1: ["STEP 1/3：選擇隨行訓練家", "6 位訓練家皆有專屬代表精靈羈絆（傷害+25%）！底部為隱藏冠軍【赤紅】"],
      2: ["STEP 2/3：選擇出戰寶可夢", "與所選訓練家有羈絆的精靈已【自動置頂高亮】！全一階基礎精靈皆可挑選！"],
      3: modeTitleMap[mKey] || modeTitleMap.expedition
    };
    document.getElementById("wizardStepTitle").textContent = titles[step][0];
    document.getElementById("wizardStepDesc").textContent = titles[step][1];
    document.getElementById("btnWizardPrev").textContent = step === 1 ? "← 返回大廳" : "← 上一步";
    this.updateWizardNextButtonText();

    this.renderWizardContent();
    this.updateTitleUI();
    this.focusSelectedWizardCard(step);
  },

  prevWizardStep() {
    if (this.wizardStep <= 1) this.backToTitle();
    else this.setWizardStep(this.wizardStep - 1);
  },

  nextWizardStep() {
    if (this.wizardStep < 3) this.setWizardStep(this.wizardStep + 1);
    else this.startGameRunWithTransition();
  },

  startGameRunWithTransition() {
    if (this._startingBattle) return;
    this._startingBattle = true;
    try {
      if (typeof SoundFX !== "undefined") {
        SoundFX.init();
        SoundFX.play("super");
      }
    } catch (e) {}

    const shutterEl = document.getElementById("pokeballTransitionOverlay");
    if (shutterEl) {
      shutterEl.classList.remove("hidden", "pokeball-shutter-active");
      void shutterEl.offsetWidth;
      shutterEl.classList.add("pokeball-shutter-active");

      setTimeout(() => {
        this.startGameRun();
      }, 260);
      setTimeout(() => {
        shutterEl.classList.add("hidden");
        shutterEl.classList.remove("pokeball-shutter-active");
        this._startingBattle = false;
      }, 660);
    } else {
      this.startGameRun();
      this._startingBattle = false;
    }
  },

  renderWizardContent() {
    const scrollArea = document.querySelector("#setupModal .overflow-y-auto");
    const prevVertScroll = scrollArea ? scrollArea.scrollTop : 0;
    const tBox = document.getElementById("wizardStep1");
    const isRedUnlocked = !!this.saveData.unlockedTrainers["red"] || (this.saveData.stats.mewtwoDefeated >= 1);
    if (isRedUnlocked) this.saveData.unlockedTrainers["red"] = true;

    tBox.innerHTML = TRAINERS.map(t => {
      const unlocked = !!this.saveData.unlockedTrainers[t.id];
      const selected = this.selectedTrainer.id === t.id;
      const bondIcons = (t.bondPreviewIds || []).map(pid => {
        const bp = POKEMON_MAP.get(pid);
        return bp ? `<img src="${bp.forward_sprite}" title="${bp.name_zh}" class="w-6 h-6 pixel-sprite bg-white rounded-full border border-slate-300 p-0.5 shadow-sm"/>` : '';
      }).join("");

      const passiveTags = [];
      const m = t.mods || {};
      if (m.startPartner) passiveTags.push("開局+1雙打夥伴");
      if (m.dmgMult && m.dmgMult > 1.01) passiveTags.push(`全傷+${Math.round((m.dmgMult - 1) * 100)}%`);
      if (m.hpMult && m.hpMult > 1.01) passiveTags.push(`HP+${Math.round((m.hpMult - 1) * 100)}%`);
      if (m.areaMult && m.areaMult > 1.01) passiveTags.push(`範圍+${Math.round((m.areaMult - 1) * 100)}%`);
      if (m.cdMult && m.cdMult < 0.99) passiveTags.push(`CD-${Math.round((1 - m.cdMult) * 100)}%`);
      if (m.critBonus && m.critBonus > 0) passiveTags.push(`暴擊+${Math.round(m.critBonus * 100)}%`);
      if (m.expMult && m.expMult > 1.01) passiveTags.push(`EXP+${Math.round((m.expMult - 1) * 100)}%`);
      if (m.regen && m.regen >= 0.8) passiveTags.push(`回血+${m.regen}/s`);
      const passiveHtml = passiveTags.slice(0, 3).map(tag =>
        `<span class="px-1.5 py-0.2 rounded bg-slate-100 border border-slate-300 text-[9px] font-black text-slate-700">${tag}</span>`
      ).join("");
      const accentColor = t.bondColor || "#F59E0B";
      const activeCostume = (typeof getResolvedTrainerCostume === "function") ? getResolvedTrainerCostume(t, this.saveData) : t;
      const hasCostumes = unlocked && Array.isArray(t.costumes) && t.costumes.length > 1;

      return `
        <div onclick="GameApp.handleTrainerCardClick('${t.id}')" class="poke-card cursor-pointer p-3 flex flex-col justify-between gap-2 ${selected ? 'selected' : ''} ${!unlocked ? 'opacity-85 bg-slate-100' : ''}">
          <div class="space-y-2">
            <!-- 1. 高清動漫特寫橫幅 ＋ 右上角時裝切換 ＋ 右下角局內像素預覽 -->
            <div class="relative h-24 sm:h-28 rounded-xl overflow-hidden bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 border-2 border-slate-800 shadow-inner">
              <img src="${activeCostume.cutin || activeCostume.sprite}" onerror="this.onerror=null;this.src='${activeCostume.sprite}';this.className='w-16 h-16 pixel-sprite object-contain mx-auto my-auto';" class="w-full h-full object-cover object-top ${!unlocked && t.isHiddenRed ? 'brightness-0 opacity-60' : ''}" alt="${t.name}" />
              <div class="absolute inset-x-0 bottom-0 h-11 bg-gradient-to-t from-slate-950/95 via-slate-950/45 to-transparent pointer-events-none"></div>
              ${selected ? `<span class="absolute top-1.5 left-1.5 px-2 py-0.5 bg-blue-600 text-white text-[9px] font-black rounded-full border border-white/80 shadow">✓ 出戰中</span>` : ''}
              ${hasCostumes ? `<button type="button" onclick="event.stopPropagation(); GameApp.cycleTrainerCostume('${t.id}')" title="點擊切換局內走路服裝" class="absolute top-1.5 right-1.5 px-2 py-0.5 bg-slate-950/90 hover:bg-slate-800 text-amber-300 text-[9px] font-black rounded-full border border-amber-400/90 shadow-md flex items-center gap-1 active:scale-95 transition-transform"><span>👕</span><span>${activeCostume.badge}</span></button>` : ''}
              <div class="absolute bottom-1.5 left-2 right-12 min-w-0">
                <div class="font-black text-xs sm:text-sm text-white drop-shadow-[0_1px_3px_rgba(0,0,0,1)] truncate">${!unlocked && t.isHiddenRed ? '??? 傳奇冠軍' : t.name}</div>
                <div class="text-[10px] font-bold text-amber-300 drop-shadow-[0_1px_2px_rgba(0,0,0,1)] truncate">${hasCostumes ? `${t.title} ‧ ${activeCostume.name}` : t.title}</div>
              </div>
              <div class="absolute bottom-1 right-1.5 w-10 h-10 rounded-xl bg-white/95 border-2 border-slate-900 flex items-center justify-center shadow-md" title="局內像素造型預覽">
                <img src="${activeCostume.sprite}" onerror="this.onerror=null;this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/vs-seeker.png';" class="w-8 h-8 pixel-sprite object-contain ${!unlocked && t.isHiddenRed ? 'brightness-0' : ''}" alt="Pixel" />
              </div>
            </div>
            <div class="flex flex-wrap gap-1">${passiveHtml}</div>

            <!-- 2. 主動大招獨立框（名稱、CD 與效果說明整合呈現，不再斷層） -->
            <div class="rounded-xl bg-slate-900 text-white p-2 border border-slate-700 shadow-inner" style="border-left: 4px solid ${accentColor};">
              <div class="flex items-center justify-between gap-1.5 mb-1">
                <span class="font-black text-[11px] text-amber-300 truncate">⚡ 主動大招：【${t.skillName}】</span>
                <span class="px-1.5 py-0.2 rounded-full bg-slate-800 border border-slate-600 font-pixel text-[8px] text-sky-300 shrink-0">CD ${t.skillCd}s</span>
              </div>
              <p class="text-[11px] font-bold text-slate-200 leading-snug">${t.desc}</p>
            </div>

            <!-- 3. 專屬羈絆條 -->
            <div class="flex items-center justify-between bg-amber-50/80 px-2 py-1 rounded-xl border border-amber-200 gap-1">
              <div class="min-w-0">
                <div class="text-[10px] font-black text-amber-900 truncate">★ 專屬羈絆【${t.bondName}】</div>
                <div class="text-[9px] font-bold text-amber-700">搭檔全傷 +25% ‧ 冷卻 -20%</div>
              </div>
              <div class="flex items-center -space-x-1 shrink-0">${bondIcons}</div>
            </div>
          </div>

          <!-- 4. 底部操作列 -->
          <div class="pt-2 border-t border-slate-200 flex items-center justify-between">
            ${unlocked
              ? `<span class="text-[11px] font-black text-emerald-600"><i class="fa-solid fa-circle-check"></i> 已解鎖可用</span>`
              : (t.isHiddenRed
                  ? `<span class="text-[11px] font-black text-purple-700"><i class="fa-solid fa-lock"></i> 擊敗 7.5m 超夢解鎖</span>`
                  : `<span class="text-[11px] font-black text-amber-600 flex items-center gap-1"><img src="${ITEM_SPRITES.coin}" class="w-4 h-4 pixel-sprite"/> ${t.cost} 代幣解鎖</span>`
                )
            }
            <button class="${selected ? 'poke-btn-blue' : 'poke-btn-red'} px-3 py-1 text-xs font-black">${unlocked ? (selected ? '已選擇' : '選擇') : (t.isHiddenRed ? '條件' : '解鎖')}</button>
          </div>
        </div>
      `;
    }).join("");

    const pBox = document.getElementById("wizardStep2");
    pBox.className = this.wizardStep === 2 ? "space-y-3" : "hidden space-y-3";
    const bondSet = new Set(this.selectedTrainer.bondPokemonIds || []);

    const filterTabs = [
      { key: "ALL", label: "全部一階" },
      { key: "BOND_UNLOCKED", label: "★ 羈絆 / 已收服" },
      { key: "Grass", label: "草 / 蟲系" },
      { key: "Fire", label: "火 / 龍系" },
      { key: "Water", label: "水 / 冰系" },
      { key: "Electric", label: "電 / 飛行" },
      { key: "Psychic", label: "超能 / 幽靈 / 毒" },
      { key: "Physical", label: "格鬥 / 地面 / 岩 / 一般" }
    ];
    const activeFilter = this.wizardPokeFilter || "ALL";

    const baseFormPokemon = POKEMON_DB.filter(p => {
      // 排除伊布的分支進化型 (水伊布 134, 雷伊布 135, 火伊布 136)
      if (p.id === 134 || p.id === 135 || p.id === 136) return false;
      return !POKEMON_DB.some(parent => parent.evo_to === p.id);
    }).filter(p => {
      if (activeFilter === "ALL") return true;
      if (activeFilter === "BOND_UNLOCKED") return bondSet.has(p.id) || !!this.saveData.unlockedPokemon[p.id];
      const types = [p.type1, p.type2];
      if (activeFilter === "Grass") return types.includes("Grass") || types.includes("Bug");
      if (activeFilter === "Fire") return types.includes("Fire") || types.includes("Dragon");
      if (activeFilter === "Water") return types.includes("Water") || types.includes("Ice");
      if (activeFilter === "Electric") return types.includes("Electric") || types.includes("Flying");
      if (activeFilter === "Psychic") return types.includes("Psychic") || types.includes("Ghost") || types.includes("Poison");
      if (activeFilter === "Physical") return types.includes("Fighting") || types.includes("Ground") || types.includes("Rock") || types.includes("Normal");
      return true;
    });

    const sortedRoster = [...baseFormPokemon].sort((a, b) => {
      const aUnlocked = this.saveData.unlockedPokemon[a.id] ? 1 : 0;
      const bUnlocked = this.saveData.unlockedPokemon[b.id] ? 1 : 0;
      const aBond = bondSet.has(a.id) ? 1 : 0;
      const bBond = bondSet.has(b.id) ? 1 : 0;
      return (bBond * 2 + bUnlocked) - (aBond * 2 + aUnlocked);
    });

    const prevFilterScroll = document.getElementById("wizardStep2FilterBar") ? document.getElementById("wizardStep2FilterBar").scrollLeft : 0;
    const filterBarHtml = `
      <div id="wizardStep2FilterBar" class="flex items-center gap-1.5 overflow-x-auto pb-1">
        ${filterTabs.map(t => `
          <button data-filter-key="${t.key}" onclick="GameApp.setWizardPokeFilter('${t.key}')" class="px-3 py-1 rounded-full text-xs font-black whitespace-nowrap border transition-colors ${activeFilter === t.key ? 'bg-red-600 text-white border-red-700 shadow-sm' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}">
            ${t.label}
          </button>
        `).join("")}
      </div>
    `;

    const cardsHtml = sortedRoster.map(p => {
      const unlocked = !!this.saveData.unlockedPokemon[p.id];
      const selected = this.selectedStarterId === p.id;
      const hasShiny = !!this.saveData.shinyUnlocked[p.id];
      const useShiny = hasShiny && !!this.useShinyStarter[p.id];
      const isBond = bondSet.has(p.id);
      const sk = SKILLS_CATALOG[p.skill];
      const unlockCost = p.id === 25 ? 0 : (p.id <= 9 ? 150 : (p.id >= 144 ? 350 : 100));
      const starLv = (this.saveData.pokemonStars && this.saveData.pokemonStars[p.id]) || 0;
      const starCosts = [400, 800, 1500];
      const nextStarCost = starLv < 3 ? starCosts[starLv] : 0;
      const starBonusMult = 1 + starLv * 0.12;
      const dispHp = Math.round(p.hp * starBonusMult);
      const dispAtk = Math.round(p.atk * starBonusMult);

      const seen = !!this.saveData.pokedexSeen[p.id];
      return `
        <div onclick="GameApp.handlePokemonCardClick(${p.id}, ${unlockCost})" class="poke-card cursor-pointer p-3 flex flex-col justify-between ${selected ? 'selected' : ''} ${isBond ? 'border-amber-400 bg-amber-50/30' : ''} ${!unlocked ? 'opacity-85 bg-slate-100' : ''} ${!seen && !unlocked ? 'opacity-65' : ''}">
          <div>
            <div class="flex items-center justify-between gap-1 mb-1">
              <span class="font-pixel text-[10px] text-slate-500">#${String(p.id).padStart(3,'0')}</span>
              ${isBond
                ? `<span class="px-1.5 py-0.5 bg-amber-400 text-slate-900 font-black text-[9px] rounded-full border border-slate-800 animate-pulse">羈絆+25%</span>`
                : `<span class="px-1.5 py-0.5 bg-slate-100 text-slate-700 font-black text-[9px] rounded-full">${p.id === 133 ? 'Lv.18三系分支' : (p.evo_to ? (() => { const n1 = POKEMON_MAP.get(p.evo_to); return (n1 && n1.evo_to) ? `Lv.${p.evo_level}➔${n1.evo_level}` : `Lv.${p.evo_level}進化`; })() : (p.id >= 144 ? '★傳說王權' : 'Lv.18覺醒'))}</span>`
              }
            </div>
            <div class="relative h-15 flex items-center justify-center my-1 bg-sky-50/60 rounded-xl border border-slate-200">
              <img src="${(useShiny && p.shiny_forward_sprite) ? p.shiny_forward_sprite : p.forward_sprite}" class="w-13 h-13 pixel-sprite object-contain ${!seen && !unlocked ? 'brightness-0 opacity-25' : ''}" alt="${p.name_zh}" />
              ${(() => {
                const mf = (typeof getMegaFormForPokemon === "function") ? getMegaFormForPokemon(p.id) : null;
                if (!mf) return "";
                const isMegaDone = !!(this.saveData.megaUnlocked && this.saveData.megaUnlocked[mf.baseId]);
                return `<button onclick="event.stopPropagation(); GameApp.openMegaInfoModal(${mf.baseId})" class="absolute top-1 left-1 px-1.5 py-0.5 rounded-full text-[8px] font-black border shadow-sm flex items-center gap-0.5 ${isMegaDone ? 'bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 text-white border-cyan-200' : 'bg-slate-900/90 text-purple-200 border-purple-400 hover:bg-purple-900'}">💎 MEGA</button>`;
              })()}
              ${hasShiny && (unlocked || seen) ? `
                <button onclick="event.stopPropagation(); GameApp.toggleStarterShiny(${p.id})" class="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-full text-[8px] font-black border flex items-center gap-0.5 ${useShiny ? 'bg-amber-400 text-slate-900 border-slate-900' : 'bg-white/90 text-slate-600 border-slate-400'}">
                  <img src="${ITEM_SPRITES.starPiece}" class="w-3 h-3 pixel-sprite"/>${useShiny ? '閃光中' : '切換閃光'}
                </button>
              ` : (unlocked && !hasShiny ? `
                <button onclick="event.stopPropagation(); GameApp.unlockPokemonShinyWithCoins(${p.id})" class="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-full text-[8px] font-black border bg-purple-900/90 text-amber-200 border-amber-400 hover:bg-purple-800 flex items-center gap-0.5 shadow">
                  <img src="${ITEM_SPRITES.starPiece}" class="w-3 h-3 pixel-sprite"/>800金閃光
                </button>
              ` : '')}
            </div>
            <div class="font-black text-xs sm:text-sm text-slate-800 text-center truncate px-0.5">
              ${unlocked || seen ? p.name_zh : '？？？'}
              ${starLv > 0 ? `<span class="text-amber-500 ml-0.5">${'★'.repeat(starLv)}</span>` : ''}
            </div>
            <div class="flex items-center justify-center gap-0.5 my-1 flex-wrap">
              ${unlocked || seen ? (renderTypeBadgeHTML(p.type1) + renderTypeBadgeHTML(p.type2)) : '<span class="text-[9px] font-bold text-slate-400">未知屬性</span>'}
            </div>
            <div class="text-[10px] font-bold text-slate-600 bg-slate-50 p-1.5 rounded-lg border border-slate-200 space-y-0.5">
              ${unlocked || seen
                ? (() => {
                    const trMeta = typeof getPokemonInnateTrait === "function" ? getPokemonInnateTrait(p, 1) : null;
                    const underdogExp = typeof getUnderdogExpBonus === "function" ? getUnderdogExpBonus(p) : 0;
                    return `<div class="flex justify-between"><span>HP:<strong class="${starLv > 0 ? 'text-amber-600' : ''}">${dispHp}</strong></span><span>ATK:<strong class="${starLv > 0 ? 'text-amber-600' : ''}">${dispAtk}</strong></span><span>SPD:<strong>${p.speed}</strong></span></div>
                            <div class="text-blue-700 truncate">招式：${sk ? sk.name : p.skill}${starLv >= 3 ? ' (開局Lv.2)' : ''}</div>
                            ${underdogExp > 0 ? `<div class="text-[9px] font-black text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 mt-0.5">🌱 大器晚成：進化前 EXP +${Math.round(underdogExp * 100)}%</div>` : ''}
                            ${trMeta ? `
                              <div class="mt-1 p-1 rounded-md bg-amber-100/90 text-amber-950 border border-amber-300 leading-tight whitespace-normal break-words">
                                <div class="text-[9px] font-black text-amber-900"><i class="fa-solid ${trMeta.icon} text-[8px] mr-0.5"></i>特性：【${trMeta.name}】</div>
                                <div class="text-[8px] font-bold text-amber-800 mt-0.5">${trMeta.desc}</div>
                              </div>` : ''}`;
                  })()
                : `<div class="text-center text-slate-400 py-1 font-bold">需在野外遭遇登錄圖鑑</div>`
              }
            </div>
            ${unlocked && starLv < 3 && (this.saveData.coins || 0) >= nextStarCost ? `
              <div class="mt-1.5 flex justify-center">
                <button onclick="event.stopPropagation(); GameApp.upgradePokemonStar(${p.id})" class="px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-400 text-slate-950 border border-slate-900 shadow-sm flex items-center gap-1 hover:bg-amber-300">
                  <i class="fa-solid fa-crown text-[8px]"></i> 可突破 ★${starLv + 1}
                </button>
              </div>
            ` : ''}
          </div>
          <div class="mt-2 pt-1.5 border-t border-slate-200 flex items-center justify-between">
            ${unlocked
              ? `<span class="text-[11px] font-black text-emerald-600">已收服</span>`
              : (seen
                  ? `<span class="text-[11px] font-black text-amber-600 flex items-center gap-0.5"><img src="${ITEM_SPRITES.coin}" class="w-3.5 h-3.5 pixel-sprite"/>${unlockCost}</span>`
                  : `<span class="text-[10px] font-black text-slate-400"><i class="fa-solid fa-eye-slash"></i> 未發現</span>`
                )
            }
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black ${unlocked ? (selected ? 'bg-blue-600 text-white' : 'bg-red-600 text-white') : (seen ? 'bg-amber-500 text-slate-950 font-black' : 'bg-slate-300 text-slate-500 cursor-not-allowed')}">${unlocked ? (selected ? '已出戰' : '選擇') : (seen ? '解鎖' : '未發現')}</span>
          </div>
        </div>
      `;
    }).join("");

    pBox.innerHTML = filterBarHtml + `<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">${cardsHtml}</div>`;
    const newFilterBarEl = document.getElementById("wizardStep2FilterBar");
    if (newFilterBarEl) {
      newFilterBarEl.scrollLeft = prevFilterScroll;
    }

    document.getElementById("difficultyGrid").innerHTML = DIFFICULTIES.map(d => {
      const sel = this.selectedDifficulty.id === d.id;
      return `
        <button type="button" onclick="GameApp.selectDifficulty('${d.id}')" class="px-2 py-2 rounded-xl border-2 text-center transition-all ${sel ? 'bg-red-600 text-white border-red-800 shadow-md' : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-50'}">
          <div class="font-black text-xs leading-tight">${d.name}</div>
          <div class="text-[9px] font-bold ${sel ? 'text-amber-200' : 'text-amber-700'} mt-0.5">${d.badge}</div>
        </button>
      `;
    }).join("");

    document.getElementById("stageGrid").innerHTML = STAGES.map(st => {
      const sel = this.selectedStage.id === st.id;
      return `
        <div onclick="GameApp.selectStage('${st.id}')" class="poke-card cursor-pointer overflow-hidden p-0 flex flex-col justify-between ${sel ? 'selected ring-2 ring-red-500' : ''}">
          <div class="relative w-full h-24 sm:h-28 bg-slate-900 overflow-hidden border-b-2 border-slate-800">
            <canvas data-stage-preview="${st.id}" class="w-full h-full block pixel-sprite object-cover"></canvas>
            <div class="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-slate-950/90 via-slate-950/45 to-transparent pointer-events-none"></div>
            ${sel ? `<span class="absolute top-1.5 left-1.5 px-2 py-0.5 bg-red-600 text-white font-black text-[9px] rounded-full border border-white shadow">✓ 已選定</span>` : ''}
            <span class="absolute top-1.5 right-1.5 px-2 py-0.5 bg-slate-950/85 text-amber-300 font-black text-[9px] rounded-full border border-amber-400/80 shadow">💰 賞金 ${st.rewardMult}x</span>
            <div class="absolute bottom-1.5 left-2 right-2 font-black text-xs text-white drop-shadow-[0_1px_3px_rgba(0,0,0,1)] truncate">${st.name}</div>
          </div>
          <div class="p-2 bg-white flex-1 flex flex-col justify-between gap-1">
            <div class="text-[10px] font-black text-indigo-800 bg-indigo-50 px-1.5 py-1 rounded-lg border border-indigo-200 leading-snug">${st.buffDesc}</div>
          </div>
        </div>
      `;
    }).join("");
    if (typeof MapEngine !== "undefined" && typeof MapEngine.renderStagePreviewCanvas === "function") {
      document.querySelectorAll('#stageGrid canvas[data-stage-preview]').forEach(can => {
        MapEngine.renderStagePreviewCanvas(can, can.getAttribute("data-stage-preview"));
      });
    }

    const modeGridEl = document.getElementById("gameModeGrid");
    if (modeGridEl) {
      const bestTimeSec = (this.saveData && this.saveData.stats && this.saveData.stats.bestEndlessTime) || 0;
      const bestM = String(Math.floor(bestTimeSec / 60)).padStart(2, "0");
      const bestS = String(bestTimeSec % 60).padStart(2, "0");
      const bestKills = (this.saveData && this.saveData.stats && this.saveData.stats.bestEndlessKills) || 0;
      const arenaTimes = (this.saveData && this.saveData.stats && this.saveData.stats.arenaBestTimes) || {};
      const arenaClearedCount = (typeof ARENA_BOSSES !== "undefined")
        ? ARENA_BOSSES.filter(b => arenaTimes[b.id] !== undefined).length
        : 0;
      const expClears = (this.saveData && this.saveData.stats && this.saveData.stats.expeditionClears) || 0;
      const modes = [
        {
          id: "standard",
          name: "8分鐘標準",
          badge: "經典",
          badgeCls: "bg-blue-100 text-blue-800",
          desc: "5:00 三聖鳥、7:30 超夢與夢幻，擊破登冠！"
        },
        {
          id: "expedition",
          name: "關都大遠征 (主打)",
          badge: "主線",
          badgeCls: "bg-emerald-600 text-white",
          desc: `${(typeof ModeExpedition !== "undefined" ? ModeExpedition.getChapterSummary().chapterCount : 4)}區 ${(typeof ModeExpedition !== "undefined" ? ModeExpedition.getChapterSummary().totalWaves : 10)}關殲滅推進（通關 ${expClears} 次）`
        },
        {
          id: "endless",
          name: "無盡深淵",
          badge: "1.25x金",
          badgeCls: "bg-purple-100 text-purple-800",
          desc: `8:00 後無限雙神波次（${bestM}:${bestS} / ${bestKills}斬）`
        },
        {
          id: "arena",
          name: "1vs1 鬥技場",
          badge: "單挑",
          badgeCls: "bg-rose-600 text-white",
          desc: `Lv.25 固定數值單挑 5 大神獸（已制霸 ${arenaClearedCount}/5）`
        }
      ];
      modeGridEl.innerHTML = modes.map(m => {
        const sel = (this.selectedGameMode || "standard") === m.id;
        return `
          <div onclick="GameApp.selectGameMode('${m.id}')" class="poke-card cursor-pointer p-2.5 flex flex-col justify-between ${sel ? 'selected' : ''}">
            <div>
              <div class="flex items-center justify-between gap-1 mb-0.5">
                <span class="font-black text-xs text-slate-800">${m.name}</span>
                <span class="px-1.5 py-0.2 ${m.badgeCls} font-black text-[9px] rounded-full shrink-0">${m.badge}</span>
              </div>
              <p class="text-[10px] font-bold text-slate-600 leading-snug">${m.desc}</p>
            </div>
            <div class="mt-1 text-right">
              <span class="text-[9px] font-black ${sel ? 'text-red-600' : 'text-slate-400'}">${sel ? '✓ 目前選用' : '點擊切換'}</span>
            </div>
          </div>
        `;
      }).join("");
    }

    const loadoutEl = document.getElementById("tacticalLoadoutGrid");
    if (loadoutEl) {
      if (!Array.isArray(this.selectedLoadouts)) this.selectedLoadouts = [];
      const loadouts = typeof TACTICAL_LOADOUTS !== "undefined" ? TACTICAL_LOADOUTS : [];
      const hasFirstFree = !(this.saveData && this.saveData.firstFreeLoadoutUsed);
      const firstFreeBadge = document.getElementById("loadoutFirstFreeBadge");
      if (firstFreeBadge) firstFreeBadge.classList.toggle("hidden", !hasFirstFree);

      const totalCost = this.getSelectedLoadoutsTotalCost();
      const badgeEl = document.getElementById("loadoutTotalCostBadge");
      if (badgeEl) {
        badgeEl.textContent = (hasFirstFree && this.selectedLoadouts.length > 0)
          ? `已選 ${this.selectedLoadouts.length} 項 (首項免費 ‧ 共 ${totalCost} 金)`
          : `已選 ${this.selectedLoadouts.length} 項 (共 ${totalCost} 金)`;
      }

      loadoutEl.innerHTML = loadouts.map(ld => {
        const selIdx = this.selectedLoadouts.indexOf(ld.id);
        const sel = selIdx !== -1;
        const isFreeSlot = hasFirstFree && (selIdx === 0 || (this.selectedLoadouts.length === 0));
        return `
          <div onclick="GameApp.toggleTacticalLoadout('${ld.id}', ${ld.cost})" class="poke-card cursor-pointer p-2.5 flex flex-col justify-between ${sel ? 'selected' : ''} ${hasFirstFree && this.selectedLoadouts.length === 0 ? 'border-amber-400' : ''}">
            <div>
              <div class="flex items-center justify-between gap-1 mb-1">
                <div class="flex items-center gap-1.5 min-w-0">
                  <img src="${ld.sprite}" class="w-5 h-5 pixel-sprite object-contain shrink-0"/>
                  <span class="font-black text-xs text-slate-800 leading-tight">${ld.name}</span>
                </div>
                ${isFreeSlot
                  ? `<span class="px-2 py-0.5 bg-gradient-to-r from-rose-500 to-amber-500 text-white font-black text-[10px] rounded-full shrink-0 shadow">🎁 首試免費</span>`
                  : `<span class="px-2 py-0.5 ${sel ? 'bg-red-600 text-white' : 'bg-amber-100 text-amber-800'} font-black text-[10px] rounded-full flex items-center gap-0.5 shrink-0"><img src="${ITEM_SPRITES.coin}" class="w-3 h-3 pixel-sprite"/>${ld.badge}</span>`
                }
              </div>
              <p class="text-[11px] font-bold text-slate-600 leading-snug">${ld.desc}</p>
            </div>
            <div class="mt-1.5 text-right">
              <span class="text-[10px] font-black ${sel ? 'text-red-600' : 'text-slate-400'}">${sel ? (selIdx === 0 && hasFirstFree ? '✓ 已勾選（免費體驗中）' : '✓ 已勾選（可再複選）') : (hasFirstFree && this.selectedLoadouts.length === 0 ? '點擊免費體驗此項' : '點擊勾選加入攜帶')}</span>
            </div>
          </div>
        `;
      }).join("");
    }
    const isArena = (this.selectedGameMode === "arena");
    const isExpedition = (this.selectedGameMode === "expedition");
    const stageEl = document.getElementById("stageSectionWrap");
    if (stageEl) stageEl.classList.toggle("hidden", isArena || isExpedition);
    const diffEl = document.getElementById("difficultySectionWrap");
    if (diffEl) diffEl.classList.toggle("hidden", isArena);
    const loadEl = document.getElementById("loadoutSectionWrap");
    if (loadEl) loadEl.classList.toggle("hidden", isArena);

    const arenaPanel = document.getElementById("arenaConfigPanel");
    if (arenaPanel) {
      arenaPanel.classList.toggle("hidden", !isArena);
      if (isArena) this.renderArenaConfigPanel();
    }
    const expPreviewPanel = document.getElementById("expeditionPreviewPanel");
    if (expPreviewPanel) {
      expPreviewPanel.classList.toggle("hidden", !isExpedition);
      if (isExpedition) this.renderExpeditionSetupPreview();
    }

    this.updateWizardNextButtonText();
    this.updateWizardLineupBar();

    // 恢復外層滾動容器的垂直捲動位置，防止點選下方精靈或升星時跳回頂部
    if (scrollArea) {
      scrollArea.scrollTop = prevVertScroll;
    }
  },

  setWizardPokeFilter(filterKey) {
    this.wizardPokeFilter = filterKey;
    if (typeof SoundFX !== "undefined") SoundFX.play("hit");
    this.renderWizardContent();
  },

  cycleTrainerCostume(trainerId) {
    const t = TRAINERS.find(x => x.id === trainerId);
    if (!t || !Array.isArray(t.costumes) || t.costumes.length <= 1) return;
    if (!this.saveData.selectedCostumes) this.saveData.selectedCostumes = {};
    const curId = this.saveData.selectedCostumes[trainerId] || t.costumes[0].id;
    const curIdx = Math.max(0, t.costumes.findIndex(c => c.id === curId));
    const nextCos = t.costumes[(curIdx + 1) % t.costumes.length];
    this.saveData.selectedCostumes[trainerId] = nextCos.id;
    if (typeof SoundFX !== "undefined") SoundFX.play("shiny");
    this.saveToStorage();
    this.renderWizardContent();
    this.updateTitleUI();
    if (this.pixelToast) {
      this.pixelToast(`👕 ${t.name.split(" ")[0]} 已切換為【${nextCos.name}】！`, "success");
    }
  },

  handleTrainerCardClick(trainerId) {
    const t = TRAINERS.find(x => x.id === trainerId);
    if (!t) return;
    const unlocked = !!this.saveData.unlockedTrainers[t.id];
    if (unlocked) {
      this.selectedTrainer = t;
      this.saveLastSetup();
      SoundFX.play("hit");
      this.renderWizardContent();
      this.updateTitleUI();
      return;
    }
    if (t.isHiddenRed) {
      this.pixelAlert("在任意難度下擊敗 7.5 分鐘最終 Boss【超夢 #150】即可永久解鎖！", "傳奇訓練家・赤紅 解鎖條件");
      return;
    }
    this.openUnlockConfirmModal("trainer", t.id, t.cost);
  },

  handlePokemonCardClick(pokeId, cost) {
    if (this.saveData.unlockedPokemon[pokeId]) {
      this.selectedStarterId = pokeId;
      this.saveLastSetup();
      SoundFX.play("hit");
      this.renderWizardContent();
      this.updateTitleUI();
      return;
    }
    // 要求：必須先在圖鑑中見過（在關卡中遭遇或登錄）才能購買解鎖
    if (!this.saveData.pokedexSeen[pokeId]) {
      this.pixelAlert("此寶可夢尚未在野外遭遇！請先在冒險地圖中發現它後方可收服！", "圖鑑未登錄");
      return;
    }
    this.openUnlockConfirmModal("pokemon", pokeId, cost);
  },

  upgradePokemonStar(pokeId) {
    if (!this.saveData.pokemonStars) this.saveData.pokemonStars = {};
    const curLv = this.saveData.pokemonStars[pokeId] || 0;
    if (curLv >= 3) return;
    const starCosts = [400, 800, 1500];
    const cost = starCosts[curLv];
    this.openUnlockConfirmModal("star_upgrade", pokeId, cost);
  },

  unlockPokemonShinyWithCoins(pokeId) {
    if (this.saveData.shinyUnlocked && this.saveData.shinyUnlocked[pokeId]) return;
    this.openUnlockConfirmModal("shiny_unlock", pokeId, 800);
  },

  exportSaveDataCode() {
    try {
      const jsonStr = JSON.stringify(this.saveData);
      const code = btoa(encodeURIComponent(jsonStr));
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).then(() => {
          this.pixelAlert("✅ 存檔引繼碼已自動複製到剪貼簿！可在其他裝置點擊「匯入」貼上還原進度。", "匯出存檔成功");
        }).catch(() => {
          this.pixelPrompt("請全選複製以下存檔引繼碼：", "匯出存檔引繼碼", code);
        });
      } else {
        this.pixelPrompt("請全選複製以下存檔引繼碼：", "匯出存檔引繼碼", code);
      }
    } catch (e) {
      this.pixelAlert("匯出失敗：" + e.message, "匯出異常");
    }
  },

  importSaveDataCode() {
    this.pixelPrompt("請貼上您先前匯出的【存檔引繼碼】：", "匯入存檔進度", "", (code) => {
      if (!code || !code.trim()) return;
      try {
        const jsonStr = decodeURIComponent(atob(code.trim()));
        const parsed = JSON.parse(jsonStr);
        if (!parsed || typeof parsed !== "object" || parsed.coins === undefined) {
          throw new Error("格式無效");
        }
        this.saveData = {
          ...this.getFreshNewbieSaveData(),
          ...parsed,
          unlockedPokemon: { ...(parsed.unlockedPokemon || { 1: true, 4: true, 7: true, 10: true, 16: true, 25: true }) },
          unlockedTrainers: { ...(parsed.unlockedTrainers || { ash: true, misty: true, brock: true }) },
          upgrades: { ...this.getFreshNewbieSaveData().upgrades, ...(parsed.upgrades || {}) },
          pokemonStars: { ...(parsed.pokemonStars || {}) },
          stats: { ...this.getFreshNewbieSaveData().stats, ...(parsed.stats || {}) },
          pokedexSeen: { ...(parsed.pokedexSeen || { 1: true, 4: true, 7: true, 10: true, 16: true, 25: true, 133: true }) },
          pokedexCaught: { ...(parsed.pokedexCaught || { 1: true, 4: true, 7: true, 10: true, 16: true, 25: true }) },
          pokedexRewardClaimed: { ...(parsed.pokedexRewardClaimed || {}) },
          shinyUnlocked: { ...(parsed.shinyUnlocked || { 25: true }) },
          megaUnlocked: { ...(parsed.megaUnlocked || {}) },
          skillLoadouts: { ...(parsed.skillLoadouts || {}) },
          selectedCostumes: { ash: "classic", lillie: "alola_powered", serena: "kalos_short", ...(parsed.selectedCostumes || {}) },
          unlockedCostumes: { ash: { classic: true, cutin_tactical: true }, lillie: { alola_powered: true, classic_hat: true }, serena: { kalos_short: true, kalos_long: true }, ...(parsed.unlockedCostumes || {}) },
          claimedAch: { ...(parsed.claimedAch || {}) },
          bestRatings: { ...(parsed.bestRatings || {}) }
        };
        this.selectedTrainer = TRAINERS[0];
        this.selectedStarterId = 25;
        this.useShinyStarter = {};
        this.restoreLastSetup();
        this.pokedexShowMega = {};
        this.pokedexShowShiny = {};
        this.saveToStorage();
        this.renderAchievements();
        this.pixelAlert("🎉 存檔引繼碼匯入成功！所有圖鑑、代幣、閃光與 Mega 進度已同步！", "匯入成功");
      } catch (e) {
        this.pixelAlert("❌ 引繼碼無效或格式損毀，請確認複製完整字串！", "匯入失敗");
      }
    });
  },

  getFreshNewbieSaveData() {
    return {
      coins: 800,
      unlockedPokemon: { 1: true, 4: true, 7: true, 10: true, 16: true, 25: true },
      unlockedTrainers: { ash: true, misty: true, brock: true },
      upgrades: { atk: 0, cd: 0, hp: 0, shiny: 0, megaRing: 0, fourthSlot: 0, rerollCount: 0, trainerCd: 0, partner: 0, greed: 0 },
      pokemonStars: {},
      stats: { totalKills: 0, evolutions: 0, superMoves: 0, birdsDefeated: 0, mewtwoDefeated: 0, mewDefeated: 0, gemsCollected: 0, bestStandardTime: 0, clearedStages: {} },
      pokedexSeen: { 1: true, 4: true, 7: true, 10: true, 16: true, 25: true, 133: true },
      pokedexCaught: { 1: true, 4: true, 7: true, 10: true, 16: true, 25: true },
      pokedexRewardClaimed: {},
      shinyUnlocked: { 25: true },
      megaUnlocked: {},
      skillLoadouts: {},
      selectedCostumes: { ash: "classic", lillie: "alola_powered", serena: "kalos_short" },
      unlockedCostumes: { ash: { classic: true, cutin_tactical: true }, lillie: { alola_powered: true, classic_hat: true }, serena: { kalos_short: true, kalos_long: true } },
      claimedAch: {},
      bestRatings: {},
      lastSeenVersion: this.APP_VERSION || "v7.6.6",
      settings: {
        mobCapProfile: "auto",
        screenFilter: "none",
        dmgTextMode: "crit_only",
        procNoticeMode: "icon",
        screenShake: "low",
        fourthSlotPoolMode: "affinity",
        skillAlpha: "85",
        uiTheme: "gba"
      }
    };
  },

  resetToNewbieSave() {
    this.pixelConfirm(
      "⚠️ 確定要重置為【純淨新手開局存檔】嗎？\n\n建議先點擊「匯出」備份你目前的進度！確定繼續重置？",
      "重置存檔確認",
      () => {
        this.saveData = this.getFreshNewbieSaveData();
        this.selectedTrainer = TRAINERS[0];
        this.selectedStarterId = 25;
        this.useShinyStarter = {};
        this.pokedexShowMega = {};
        this.pokedexShowShiny = {};
        this.saveToStorage();
        this.renderAchievements();
        this.pixelAlert("✅ 已成功回復為純淨新手開局狀態（800 代幣、初始御三家與皮卡丘、研究所全 Lv.0、Mega 未解鎖）！", "重置完成");
      }
    );
  },

  handlePokedexMegaClick(baseId) {
    const isUnlocked = !!(this.saveData && this.saveData.megaUnlocked && this.saveData.megaUnlocked[baseId]);
    if (!isUnlocked) {
      this.openMegaInfoModal(baseId);
      return;
    }
    if (!this.pokedexShowMega) this.pokedexShowMega = {};
    this.pokedexShowMega[baseId] = !this.pokedexShowMega[baseId];
    if (typeof SoundFX !== "undefined") SoundFX.play("super");
    this.renderPokedexGrid();
  },

  openMegaInfoModal(baseId) {
    const mf = (typeof MEGA_FORMS !== "undefined") ? MEGA_FORMS[baseId] : null;
    if (!mf) return;
    if (typeof SoundFX !== "undefined") SoundFX.play("hit");

    const hasRing = !!(this.saveData && this.saveData.upgrades && this.saveData.upgrades.megaRing >= 1);
    const isUnlocked = !!(this.saveData && this.saveData.megaUnlocked && this.saveData.megaUnlocked[baseId]);
    const basePoke = POKEMON_MAP.get(baseId);
    const starterPoke = POKEMON_MAP.get(mf.starterId || baseId);

    const box = document.getElementById("megaInfoContent");
    if (box) {
      box.innerHTML = `
        <div class="relative flex flex-col items-center justify-center py-4 px-3 rounded-2xl border-2 ${isUnlocked ? 'bg-slate-950 border-cyan-400 shadow-[0_0_24px_rgba(56,189,248,0.35)]' : 'bg-slate-950 border-purple-500/70'} mb-3 overflow-hidden">
          <div class="absolute inset-0 opacity-25 pointer-events-none" style="background: radial-gradient(circle at center, ${isUnlocked ? '#38BDF8' : '#A855F7'} 0%, transparent 68%);"></div>
          <img src="${mf.forward_sprite}" class="w-24 h-24 pixel-sprite object-contain relative z-10 ${isUnlocked ? '' : 'brightness-0 drop-shadow-[0_0_10px_rgba(56,189,248,0.85)]'}" alt="MEGA" />
          <div class="relative z-10 mt-1 text-center">
            <div class="font-black text-base ${isUnlocked ? 'text-cyan-300' : 'text-purple-200'}">
              ${isUnlocked ? `💎 ${mf.name_zh}` : '？？？・未知超級進化形態'}
            </div>
            <div class="flex items-center justify-center gap-1 mt-1">
              ${isUnlocked ? (renderTypeBadgeHTML(mf.type1) + renderTypeBadgeHTML(mf.type2)) : '<span class="px-2 py-0.5 rounded-full bg-purple-900/90 border border-purple-400/60 text-[10px] font-black text-purple-200">首次於戰場覺醒後解禁真容</span>'}
            </div>
          </div>
        </div>

        ${isUnlocked ? `
          <div class="bg-sky-950/70 border border-cyan-400/60 rounded-xl p-2.5 mb-3 text-[11px] font-bold text-cyan-100 leading-relaxed">
            <div class="text-amber-300 font-black mb-1"><i class="fa-solid fa-fire-flame-curved mr-1"></i>超級進化覺醒特性</div>
            ${mf.megaTraitDesc}
          </div>
        ` : ''}

        <div class="bg-slate-800/90 border border-slate-700 rounded-xl p-3 space-y-2 text-xs">
          <div class="font-black text-amber-300 flex items-center gap-1.5">
            <i class="fa-solid fa-list-check"></i>
            <span>MEGA 超級進化解鎖進度清單</span>
          </div>

          <div class="flex items-start gap-2 ${hasRing ? 'text-emerald-300' : 'text-slate-200'}">
            <span class="shrink-0 mt-0.5">${hasRing ? '✅' : '⬜'}</span>
            <div class="leading-snug">
              <div class="font-black">條件 1：研發【超級手環 (MEGA RING)】</div>
              <div class="text-[10px] text-slate-400">於【寶可夢中心研究所 ➔ 訓練家戰術槽位】消耗 500 代幣研發（全訓練家永久通用）。</div>
            </div>
          </div>

          <div class="flex items-start gap-2 ${isUnlocked ? 'text-emerald-300' : 'text-slate-200'}">
            <span class="shrink-0 mt-0.5">${isUnlocked ? '✅' : '⬜'}</span>
            <div class="leading-snug">
              <div class="font-black">條件 2：雙重門檻 ＋ 手動鑰石覺醒</div>
              <div class="text-[10px] text-slate-400">使用【${starterPoke ? starterPoke.name_zh : '小火龍'}】進化至【${basePoke ? basePoke.name_zh : '噴火龍'}】，等級達 <strong class="text-amber-300">Lv.${mf.reqLevel || 24}</strong> <strong class="text-cyan-300">且</strong> ${mf.reqSkillsText}，右下角將浮現【💎 MEGA】按鍵（快捷鍵 [M]），隨時由你親手引爆！</div>
            </div>
          </div>

          <div class="bg-amber-950/60 border border-amber-500/60 rounded-lg p-2 text-[10px] text-amber-200 font-bold leading-snug">
            ★ <span class="text-amber-300 font-black">羈絆加速秘訣：</span>搭配 <strong class="text-white">${mf.bondTrainerNames}</strong> 出戰，覺醒等級提前至 <strong class="text-cyan-300">Lv.${mf.bondReqLevel || 23}</strong>，按下【💎 MEGA】瞬間額外引爆 235px 專屬鑰石共鳴震波！
          </div>
        </div>
      `;
    }

    const labBtn = document.getElementById("btnMegaGoLab");
    if (labBtn) {
      labBtn.classList.toggle("hidden", hasRing);
    }

    const modal = document.getElementById("megaInfoModal");
    if (modal) {
      modal.classList.remove("hidden");
      modal.style.display = "flex";
    }
  },

  closeMegaInfoModal() {
    const modal = document.getElementById("megaInfoModal");
    if (modal) {
      modal.classList.add("hidden");
      modal.style.display = "none";
    }
  },

  goToMegaRingLab() {
    const setupEl = document.getElementById("setupModal");
    const dexEl = document.getElementById("pokedexModal");
    const fromSetup = !!(setupEl && !setupEl.classList.contains("hidden"));
    const fromDex = !!(dexEl && !dexEl.classList.contains("hidden"));

    this._labReturnTarget = fromSetup ? "setup" : (fromDex ? "pokedex" : "title");

    this.closeMegaInfoModal();
    if (fromDex) {
      dexEl.classList.add("hidden");
      dexEl.style.display = "none";
    }
    if (fromSetup) {
      setupEl.classList.add("hidden");
      setupEl.style.display = "none";
    }
    this.centerTab = "trainer";
    this.openSkillTreeModal();
  },

  toggleStarterShiny(id) {
    this.useShinyStarter[id] = !this.useShinyStarter[id];
    this.saveLastSetup();
    SoundFX.play("super");
    this.renderWizardContent();
    this.updateTitleUI();
  },

  selectDifficulty(id) {
    const found = DIFFICULTIES.find(d => d.id === id);
    if (found) {
      this.selectedDifficulty = found;
      this.saveLastSetup();
      SoundFX.play("hit");
      this.renderWizardContent();
    }
  },

  selectStage(id) {
    const found = STAGES.find(s => s.id === id);
    if (found) {
      this.selectedStage = found;
      MapEngine.setStage(found.id);
      this.saveLastSetup();
      SoundFX.play("hit");
      this.renderWizardContent();
    }
  },

  selectGameMode(modeId) {
    this.selectedGameMode = modeId;
    this.saveLastSetup();
    SoundFX.play("hit");
    this.renderWizardContent();
  },

  renderExpeditionSetupPreview() {
    const summary = (typeof ModeExpedition !== "undefined" && ModeExpedition.getChapterSummary)
      ? ModeExpedition.getChapterSummary()
      : { chapterCount: 4, totalWaves: 10, chapters: [] };
    const routeTextEl = document.getElementById("expeditionDynamicRouteText");
    if (routeTextEl) {
      routeTextEl.textContent = `關都大遠征路線（共 ${summary.chapterCount} 大區域 ‧ ${summary.totalWaves} 關推進）`;
    }
    const stageCardsEl = document.getElementById("expeditionStageCardsGrid");
    if (stageCardsEl && summary.chapters.length > 0) {
      let waveCursor = 1;
      stageCardsEl.innerHTML = summary.chapters.map((ch, idx) => {
        const wLen = (ch.waves && ch.waves.length) || 1;
        const wRange = wLen === 1 ? `W${waveCursor}` : `W${waveCursor}-${waveCursor + wLen - 1}`;
        waveCursor += wLen;
        const previewKey = ch.isArena ? "arena" : (ch.stageId || "pallet");
        const stObj = (typeof STAGES !== "undefined") ? STAGES.find(s => s.id === ch.stageId) : null;
        const buffText = ch.isArena ? "封閉石柱競技場 ‧ 最終 1vs1 決戰" : (stObj ? stObj.buffDesc : (ch.name || ""));
        return `
          <div class="poke-card overflow-hidden p-0 flex flex-col justify-between border-2 border-slate-800">
            <div class="relative w-full h-20 sm:h-24 bg-slate-900 overflow-hidden border-b border-slate-800">
              <canvas data-exp-stage-preview="${previewKey}" class="w-full h-full block pixel-sprite object-cover"></canvas>
              <div class="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-slate-950/90 via-slate-950/45 to-transparent pointer-events-none"></div>
              <span class="absolute top-1 left-1 px-1.5 py-0.5 rounded-full bg-slate-950/85 text-amber-300 font-pixel text-[8px] font-black border border-amber-400/70">${ch.isFinalChapter ? 'FINAL' : `ACT ${idx + 1}`} · ${wRange}</span>
              <div class="absolute bottom-1 left-1.5 right-1.5 font-black text-[11px] text-white drop-shadow-[0_1px_2px_rgba(0,0,0,1)] truncate">${ch.name}</div>
            </div>
            <div class="px-1.5 py-1 bg-white text-[9px] font-bold text-slate-700 leading-tight truncate">${buffText}</div>
          </div>
        `;
      }).join("");
      if (typeof MapEngine !== "undefined" && typeof MapEngine.renderStagePreviewCanvas === "function") {
        stageCardsEl.querySelectorAll("canvas[data-exp-stage-preview]").forEach(can => {
          MapEngine.renderStagePreviewCanvas(can, can.getAttribute("data-exp-stage-preview"));
        });
      }
    }
    const cpBox = document.getElementById("expeditionCheckpointBanner");
    const cp = this.saveData && this.saveData.expeditionCheckpoint;
    if (cpBox) {
      if (cp && cp.nextWave >= 2 && cp.nextWave <= summary.totalWaves) {
        const pk = POKEMON_MAP.get(cp.player ? cp.player.id : cp.starterId) || POKEMON_MAP.get(25);
        const df = DIFFICULTIES.find(d => d.id === cp.difficultyId);
        cpBox.classList.remove("hidden");
        cpBox.innerHTML = `
          <div class="flex items-center justify-between gap-2 bg-slate-900 text-white p-2.5 rounded-xl border-2 border-amber-400">
            <div class="flex items-center gap-2 min-w-0">
              <img src="${SpriteCache.resolveUrl(pk.forward_sprite)}" class="w-9 h-9 pixel-sprite bg-slate-800 rounded-lg border border-slate-600 p-0.5 shrink-0"/>
              <div class="min-w-0">
                <div class="font-pixel text-[8px] text-amber-300">續關存檔（沿用原難度：${df ? df.name : '標準'}）</div>
                <div class="font-black text-xs text-white truncate">第 ${cp.nextWave}/${summary.totalWaves} 關（${pk.name_zh} Lv.${cp.player ? cp.player.level : 1}）</div>
              </div>
            </div>
            <button onclick="GameApp.resumeSavedExpedition()" class="poke-btn-yellow px-3 py-1.5 text-xs font-black shrink-0">繼續遠征</button>
          </div>
          <div class="text-[10px] font-bold text-slate-600 pt-1">若要重新開局，請調整下方難度／補給後按右下角出發（將覆蓋舊進度）。</div>
        `;
      } else {
        cpBox.classList.add("hidden");
      }
    }
  },

  resumeSavedExpedition() {
    const cp = this.saveData && this.saveData.expeditionCheckpoint;
    if (!cp) return;
    if (cp.trainerId) {
      const tr = TRAINERS.find(t => t.id === cp.trainerId);
      if (tr) this.selectedTrainer = tr;
    }
    if (cp.starterId) this.selectedStarterId = cp.starterId;
    if (cp.difficultyId) {
      const df = DIFFICULTIES.find(d => d.id === cp.difficultyId);
      if (df) this.selectedDifficulty = df;
    }
    this.selectedGameMode = "expedition";
    this._resumeExpeditionCheckpoint = cp;
    this.startGameRunWithTransition();
  },

  selectArenaDifficulty(diffId) {
    this.selectedArenaDifficultyId = diffId;
    this.saveLastSetup();
    SoundFX.play("hit");
    this.renderArenaConfigPanel();
  },

  selectArenaBoss(bossId) {
    this.selectedArenaBossId = bossId;
    this.saveLastSetup();
    SoundFX.play("hit");
    this.renderArenaConfigPanel();
  },

  selectArenaHeldItem(itemId) {
    this.selectedArenaHeldItem = itemId;
    this.saveLastSetup();
    SoundFX.play("hit");
    this.renderArenaConfigPanel();
  },

  renderArenaConfigPanel() {
    const diffGrid = document.getElementById("arenaDiffGrid");
    const bossGrid = document.getElementById("arenaBossGrid");
    const heldGrid = document.getElementById("arenaHeldItemGrid");
    const bestTimes = (this.saveData && this.saveData.stats && this.saveData.stats.arenaBestTimes) || {};
    const bosses = typeof ARENA_BOSSES !== "undefined" ? ARENA_BOSSES : [];
    const diffs = typeof ARENA_DIFFICULTIES !== "undefined" ? ARENA_DIFFICULTIES : [];
    const activeDiff = diffs.find(d => d.id === (this.selectedArenaDifficultyId || "standard")) || diffs[0] || { id: "standard", name: "標準試煉", hpMult: 2.2, coinMult: 1.0 };

    if (diffGrid && diffs.length > 0) {
      diffGrid.innerHTML = diffs.map(d => {
        const sel = activeDiff.id === d.id;
        return `
          <div onclick="GameApp.selectArenaDifficulty('${d.id}')" class="poke-card cursor-pointer p-2 flex flex-col justify-between ${sel ? 'selected ring-2 ring-red-500' : ''}">
            <div class="flex items-center justify-between gap-1 mb-0.5">
              <span class="font-black text-xs text-slate-900">${d.name}</span>
              <span class="px-1.5 py-0.2 rounded-full text-[9px] font-black ${sel ? 'bg-red-600 text-white' : 'bg-amber-100 text-amber-800'} shrink-0">${d.badge}</span>
            </div>
            <p class="text-[9px] font-bold text-slate-600 leading-snug">${d.desc}</p>
          </div>
        `;
      }).join("");
    }

    if (bossGrid) {
      bossGrid.innerHTML = bosses.map(b => {
        const sel = (this.selectedArenaBossId || 144) === b.id;
        const pData = POKEMON_MAP.get(b.id);
        const recKey = `${b.id}_${activeDiff.id}`;
        const best = bestTimes[recKey] !== undefined ? bestTimes[recKey] : (activeDiff.id === "standard" ? bestTimes[b.id] : undefined);
        const hdUrl = (typeof getPokemonOfficialArtworkUrl === "function")
          ? getPokemonOfficialArtworkUrl(b.id, false)
          : (pData ? pData.forward_sprite : "");
        const pxUrl = pData ? pData.forward_sprite : "";
        const scaledHp = Math.round(b.hp * (activeDiff.hpMult || 2.2));
        const scaledReward = Math.round(b.reward * (activeDiff.coinMult || 1.0));
        const accent = b.color || "#EF4444";

        return `
          <div onclick="GameApp.selectArenaBoss(${b.id})" class="poke-card cursor-pointer p-2.5 flex flex-col justify-between gap-2 ${sel ? 'selected ring-2 ring-red-500' : ''}">
            <div class="space-y-1.5">
              <!-- 比照訓練家卡片雙圖層橫幅：左側大廳同款高清立繪 ＋ 右下角局內像素預覽 -->
              <div class="relative h-24 sm:h-28 rounded-xl overflow-hidden bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 border-2 border-slate-800 shadow-inner">
                <div class="absolute inset-0 opacity-30 pointer-events-none" style="background: radial-gradient(circle at 28% 50%, ${accent} 0%, transparent 65%);"></div>
                <img src="${hdUrl}" onerror="this.onerror=null;this.src='${pxUrl}';" class="absolute left-1.5 top-1 h-[92%] w-[52%] object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.85)]" alt="${b.name}" />
                <div class="absolute inset-x-0 bottom-0 h-11 bg-gradient-to-t from-slate-950/95 via-slate-950/50 to-transparent pointer-events-none"></div>
                ${sel ? `<span class="absolute top-1.5 left-1.5 px-2 py-0.5 bg-blue-600 text-white text-[9px] font-black rounded-full border border-white/80 shadow">✓ 挑戰中</span>` : ''}
                <span class="absolute top-1.5 right-1.5 px-2 py-0.5 rounded-full text-[9px] font-black border shadow ${best ? 'bg-emerald-600 text-white border-emerald-300' : 'bg-slate-950/85 text-slate-300 border-slate-600'}">${best ? `★ ${best.toFixed(1)}s` : '未制霸'}</span>
                <div class="absolute bottom-1.5 left-2 right-12 min-w-0">
                  <div class="flex items-center gap-1">
                    <span class="font-black text-xs sm:text-sm text-white drop-shadow-[0_1px_3px_rgba(0,0,0,1)] truncate">${b.name}</span>
                    ${pData ? renderTypeBadgeHTML(pData.type1) : ''}
                  </div>
                  <div class="text-[10px] font-bold text-amber-300 drop-shadow-[0_1px_2px_rgba(0,0,0,1)] truncate">${b.title} ‧ HP ${scaledHp.toLocaleString()}</div>
                </div>
                <div class="absolute bottom-1 right-1.5 w-10 h-10 rounded-xl bg-white/95 border-2 border-slate-900 flex items-center justify-center shadow-md" title="局內像素造型預覽">
                  <img src="${pxUrl}" class="w-8 h-8 pixel-sprite object-contain" alt="Pixel" />
                </div>
              </div>
              <p class="text-[10px] font-bold text-slate-600 leading-snug">${b.desc}</p>
            </div>
            <div class="pt-1.5 border-t border-slate-200 flex items-center justify-between text-[10px] font-black">
              <span class="text-amber-700 flex items-center gap-0.5"><img src="${ITEM_SPRITES.coin}" class="w-3.5 h-3.5 pixel-sprite"/> 賞金 +${scaledReward}金</span>
              <span class="px-2 py-0.5 rounded-full ${sel ? 'bg-blue-600 text-white' : 'bg-red-600 text-white'}">${sel ? '已選定' : '挑戰'}</span>
            </div>
          </div>
        `;
      }).join("");
    }

    if (heldGrid && typeof HELD_ITEMS !== "undefined") {
      const starter = POKEMON_MAP.get(this.selectedStarterId) || POKEMON_MAP.get(25);
      const natSkills = (typeof getNaturalSkillsForPokemon === "function") ? getNaturalSkillsForPokemon(starter) : [];
      const natTypes = new Set(natSkills.map(s => SKILLS_CATALOG[s]?.type).filter(Boolean));
      const allHeld = Object.values(HELD_ITEMS).sort((a, b) => {
        const aMatch = natTypes.has(SKILLS_CATALOG[a.skillReq]?.type) ? 1 : 0;
        const bMatch = natTypes.has(SKILLS_CATALOG[b.skillReq]?.type) ? 1 : 0;
        return bMatch - aMatch;
      });
      if (!HELD_ITEMS[this.selectedArenaHeldItem]) {
        this.selectedArenaHeldItem = allHeld[0]?.id || "silk_scarf";
      }
      heldGrid.innerHTML = allHeld.map(hi => {
        const sel = this.selectedArenaHeldItem === hi.id;
        const isRec = natTypes.has(SKILLS_CATALOG[hi.skillReq]?.type);
        return `
          <div onclick="GameApp.selectArenaHeldItem('${hi.id}')" class="poke-card cursor-pointer p-2 flex items-center gap-2 ${sel ? 'selected ring-2 ring-red-500' : ''}">
            <div class="w-8 h-8 rounded-lg bg-slate-900 border border-amber-400/70 flex items-center justify-center shrink-0">
              <img src="${hi.sprite}" class="w-6 h-6 pixel-sprite object-contain" alt="${hi.name}"/>
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1">
                <span class="font-black text-[11px] text-slate-800 truncate">${hi.name}</span>
                ${isRec ? '<span class="px-1 py-0.2 rounded bg-emerald-600 text-white text-[8px] font-black shrink-0">本系</span>' : ''}
              </div>
              <div class="text-[9px] font-bold text-slate-500 truncate">${hi.desc}</div>
            </div>
          </div>
        `;
      }).join("");
    }
  },

  getSelectedLoadoutsTotalCost() {
    if (!Array.isArray(this.selectedLoadouts)) return 0;
    const loadouts = typeof TACTICAL_LOADOUTS !== "undefined" ? TACTICAL_LOADOUTS : [];
    const hasFirstFree = !(this.saveData && this.saveData.firstFreeLoadoutUsed);
    return this.selectedLoadouts.reduce((sum, id, idx) => {
      if (hasFirstFree && idx === 0) return sum;
      const found = loadouts.find(x => x.id === id);
      return sum + (found ? found.cost : 0);
    }, 0);
  },

  updateWizardNextButtonText() {
    const btn = document.getElementById("btnWizardNext");
    if (!btn) return;
    if (this.wizardStep < 3) {
      btn.textContent = "下一步 →";
      return;
    }
    if (this.selectedGameMode === "arena") {
      btn.textContent = "進入石英大會 1vs1 鬥技場 →";
      return;
    }
    if (this.selectedGameMode === "expedition") {
      const totW = (typeof ModeExpedition !== "undefined" && ModeExpedition.getChapterSummary) ? ModeExpedition.getChapterSummary().totalWaves : 10;
      btn.textContent = `展開關都大遠征 (${totW}關 RPG) →`;
      return;
    }
    const totalCost = this.getSelectedLoadoutsTotalCost();
    const hasFirstFree = !(this.saveData && this.saveData.firstFreeLoadoutUsed);
    if (totalCost > 0) {
      btn.textContent = `立即出發冒險 (扣 ${totalCost} 金) →`;
    } else if (hasFirstFree && Array.isArray(this.selectedLoadouts) && this.selectedLoadouts.length > 0) {
      btn.textContent = "立即出發冒險 (🎁首試免費) →";
    } else {
      btn.textContent = "立即出發冒險 →";
    }
  },

  toggleTacticalLoadout(id, cost) {
    if (!Array.isArray(this.selectedLoadouts)) this.selectedLoadouts = [];
    const idx = this.selectedLoadouts.indexOf(id);
    if (idx !== -1) {
      this.selectedLoadouts.splice(idx, 1);
    } else {
      const hasFirstFree = !(this.saveData && this.saveData.firstFreeLoadoutUsed);
      const effectiveCost = (hasFirstFree && this.selectedLoadouts.length === 0) ? 0 : cost;
      const newTotal = this.getSelectedLoadoutsTotalCost() + effectiveCost;
      if ((this.saveData.coins || 0) < newTotal) {
        this.pixelToast(`⚠️ 代幣不足！此組合共需 ${newTotal} 金（目前持有 ${this.saveData.coins || 0} 金）`, "warn");
        return;
      }
      this.selectedLoadouts.push(id);
    }
    SoundFX.play("hit");
    this.renderWizardContent();
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
      document.getElementById("unlockConfirmFrontImg").className = "w-12 h-12 pixel-sprite object-contain";
      document.getElementById("unlockConfirmBackImg").src = p.back_sprite;
      document.getElementById("unlockConfirmBackImg").className = "w-12 h-12 pixel-sprite object-contain";
      document.getElementById("unlockBackCol").classList.remove("hidden");
      document.getElementById("unlockConfirmName").textContent = `${p.name_zh} (#${String(p.id).padStart(3,'0')})`;
      document.getElementById("unlockConfirmTypes").innerHTML = `${renderTypeBadgeHTML(p.type1)}${renderTypeBadgeHTML(p.type2)}`;
      const trMeta = typeof getPokemonInnateTrait === "function" ? getPokemonInnateTrait(p, 1) : null;
      document.getElementById("unlockConfirmStats").innerHTML = `
        <div>生命 HP：<strong>${p.hp}</strong> ｜ 攻擊：<strong>${p.atk}</strong> ｜ 速度：<strong>${p.speed}</strong></div>
        <div class="text-blue-700">初始招式：【${sk ? sk.name : p.skill}】</div>
        ${trMeta ? `<div class="text-amber-800 bg-amber-50 p-1.5 rounded border border-amber-200 mt-1"><i class="fa-solid ${trMeta.icon} mr-1"></i><strong>特性【${trMeta.name}】</strong>：${trMeta.desc}</div>` : ''}
      `;
    } else if (type === "shiny_unlock") {
      const p = POKEMON_MAP.get(id);
      document.getElementById("unlockModalHeaderTitle").textContent = "✨ 閃光寶可夢特訓覺醒確認";
      document.getElementById("unlockConfirmFrontImg").src = p.shiny_forward_sprite || p.forward_sprite;
      document.getElementById("unlockConfirmFrontImg").className = "w-12 h-12 pixel-sprite object-contain";
      document.getElementById("unlockConfirmBackImg").src = p.shiny_back_sprite || p.back_sprite;
      document.getElementById("unlockConfirmBackImg").className = "w-12 h-12 pixel-sprite object-contain";
      document.getElementById("unlockBackCol").classList.remove("hidden");
      document.getElementById("unlockConfirmName").textContent = `閃光・${p.name_zh} (#${String(p.id).padStart(3,'0')})`;
      document.getElementById("unlockConfirmTypes").innerHTML = `${renderTypeBadgeHTML(p.type1)}${renderTypeBadgeHTML(p.type2)}`;
      document.getElementById("unlockConfirmStats").innerHTML = `
        <div class="text-purple-700 font-black">永久解鎖【${p.name_zh}】專屬閃光色違形態！</div>
        <div>閃光出戰特典：基礎生命與攻擊力永久額外提升 <strong class="text-amber-600">+20%</strong>！</div>
        <div class="text-slate-500">（當前持有代幣：<strong>${(this.saveData.coins || 0).toLocaleString()}</strong>）</div>
      `;
    } else if (type === "star_upgrade") {
      const p = POKEMON_MAP.get(id);
      const sk = SKILLS_CATALOG[p.skill];
      const curLv = (this.saveData.pokemonStars && this.saveData.pokemonStars[id]) || 0;
      const nextLv = curLv + 1;
      const curMult = 1 + curLv * 0.12;
      const nextMult = 1 + nextLv * 0.12;
      const curHp = Math.round(p.hp * curMult), nextHp = Math.round(p.hp * nextMult);
      const curAtk = Math.round(p.atk * curMult), nextAtk = Math.round(p.atk * nextMult);

      document.getElementById("unlockModalHeaderTitle").textContent = `👑 王冠極限突破確認 (★${curLv} ➔ ★${nextLv})`;
      document.getElementById("unlockConfirmFrontImg").src = p.forward_sprite;
      document.getElementById("unlockConfirmFrontImg").className = "w-12 h-12 pixel-sprite object-contain";
      document.getElementById("unlockConfirmBackImg").src = p.back_sprite;
      document.getElementById("unlockConfirmBackImg").className = "w-12 h-12 pixel-sprite object-contain";
      document.getElementById("unlockBackCol").classList.remove("hidden");
      document.getElementById("unlockConfirmName").textContent = `${p.name_zh} ${'★'.repeat(nextLv)}`;
      document.getElementById("unlockConfirmTypes").innerHTML = `${renderTypeBadgeHTML(p.type1)}${renderTypeBadgeHTML(p.type2)}`;
      document.getElementById("unlockConfirmStats").innerHTML = `
        <div class="text-slate-700">基礎體質永久提升 <strong class="text-amber-600">+12%</strong>（當前持有：<strong class="text-amber-600">${(this.saveData.coins || 0).toLocaleString()}</strong> 代幣）</div>
        <div>生命 HP：<strong>${curHp}</strong> ➔ <strong class="text-emerald-600">${nextHp}</strong> ｜ 攻擊：<strong>${curAtk}</strong> ➔ <strong class="text-emerald-600">${nextAtk}</strong></div>
        ${nextLv === 3
          ? `<div class="text-amber-700 bg-amber-100 px-2 py-1 rounded border border-amber-300 font-black mt-1">★3 金冠滿星特典：開局初始招式【${sk ? sk.name : p.skill}】直接升為 Lv.2！</div>`
          : `<div class="text-blue-700">升至 ★3 金冠滿星時，開局主招式將直接以 Lv.2 出戰！</div>`
        }
      `;
    } else {
      const t = TRAINERS.find(x => x.id === id);
      document.getElementById("unlockModalHeaderTitle").textContent = "隨行訓練家解鎖確認";
      const uFront = document.getElementById("unlockConfirmFrontImg"); uFront.onerror = function(){this.onerror=null;this.src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/vs-seeker.png";}; uFront.src = t.sprite;
      document.getElementById("unlockBackCol").classList.add("hidden");
      document.getElementById("unlockConfirmName").textContent = t.name;
      document.getElementById("unlockConfirmTypes").innerHTML = `<span class="px-2 py-0.5 bg-amber-100 text-amber-800 text-xs font-black rounded-full">${t.title}</span>`;
      document.getElementById("unlockConfirmStats").innerHTML = `
        <div>戰術技能：【${t.skillName}】(CD ${t.skillCd}s)</div>
        <div class="text-slate-600">${t.desc}</div>
      `;
    }

    const modal = document.getElementById("unlock-confirm-modal");
    if (modal) {
      modal.classList.remove("hidden");
      modal.style.display = "flex";
    }
  },

  closeUnlockConfirmModal() {
    const modal = document.getElementById("unlock-confirm-modal");
    if (modal) {
      modal.classList.add("hidden");
      modal.style.display = "none";
    }
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
    } else if (this.pendingUnlockType === "shiny_unlock") {
      if (!this.saveData.shinyUnlocked) this.saveData.shinyUnlocked = {};
      this.saveData.shinyUnlocked[this.pendingUnlockId] = true;
      this.useShinyStarter[this.pendingUnlockId] = true;
      this.selectedStarterId = this.pendingUnlockId;
    } else if (this.pendingUnlockType === "star_upgrade") {
      if (!this.saveData.pokemonStars) this.saveData.pokemonStars = {};
      const curLv = this.saveData.pokemonStars[this.pendingUnlockId] || 0;
      this.saveData.pokemonStars[this.pendingUnlockId] = Math.min(3, curLv + 1);
    } else {
      this.saveData.unlockedTrainers[this.pendingUnlockId] = true;
      const found = TRAINERS.find(x => x.id === this.pendingUnlockId);
      if (found) this.selectedTrainer = found;
    }
    const unlockedType = this.pendingUnlockType;
    SoundFX.play("levelup");
    this.saveToStorage();
    this.closeUnlockConfirmModal();
    this.renderWizardContent();
    // 收服新寶可夢或解鎖新訓練家後，自動捲動定位至剛解鎖置頂的新角色並閃亮金框回饋
    if (unlockedType === "pokemon" || unlockedType === "trainer") {
      this.focusSelectedWizardCard(this.wizardStep);
      requestAnimationFrame(() => {
        const stepEl = document.getElementById(`wizardStep${this.wizardStep}`);
        const selCard = stepEl ? stepEl.querySelector(".poke-card.selected") : null;
        if (selCard) {
          selCard.classList.add("ring-4", "ring-amber-400");
          setTimeout(() => selCard.classList.remove("ring-4", "ring-amber-400"), 900);
        }
      });
    }
  },

  openPokedexModal() {
    const modal = document.getElementById("pokedexModal");
    if (modal) {
      modal.classList.remove("hidden");
      modal.style.display = "flex";
    }
    this.renderPokedexFilterTabs();
    this.renderPokedexGrid("ALL");
  },

  closePokedexModal() {
    const modal = document.getElementById("pokedexModal");
    if (modal) {
      modal.classList.add("hidden");
      modal.style.display = "none";
    }
    this.updateTitleUI();
  },

  renderPokedexFilterTabs() {
    const shinyTotal = Object.keys((this.saveData && this.saveData.shinyUnlocked) || {}).length;
    const tabs = [
      { key: "ALL", label: "全部 151" },
      { key: "CAUGHT", label: "已收服" },
      { key: "SHINY", label: `✨ 閃光 (${shinyTotal})` },
      { key: "Grass", label: "草系" },
      { key: "Fire", label: "火系" },
      { key: "Water", label: "水系" },
      { key: "Electric", label: "電系" },
      { key: "Psychic", label: "超能/幽靈" },
      { key: "Dragon", label: "傳說/龍" }
    ];
    const curFilter = this.pokedexFilter || "ALL";
    const tabBox = document.getElementById("pokedexFilterTabs");
    if (!tabBox) return;
    const prevScroll = tabBox.scrollLeft;

    tabBox.innerHTML = tabs.map((t) => {
      const isAct = curFilter === t.key;
      return `
        <button data-dex-key="${t.key}" onclick="GameApp.renderPokedexGrid('${t.key}')" class="px-3 py-1 rounded-full text-xs font-black whitespace-nowrap border transition-colors ${isAct ? 'bg-red-600 text-white border-red-700 shadow-sm' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}">
          ${t.label}
        </button>
      `;
    }).join("");
    tabBox.scrollLeft = prevScroll;
    const actBtn = tabBox.querySelector(`[data-dex-key="${curFilter}"]`);
    if (actBtn && actBtn.scrollIntoView) {
      actBtn.scrollIntoView({ behavior: "instant", block: "nearest", inline: "nearest" });
    }
  },

  renderPokedexGrid(filterKey) {
    if (filterKey) this.pokedexFilter = filterKey;
    const activeKey = this.pokedexFilter || "ALL";
    this.renderPokedexFilterTabs();
    let list = POKEMON_DB;
    filterKey = activeKey;
    if (filterKey === "CAUGHT") list = list.filter(p => this.saveData.pokedexCaught[p.id]);
    else if (filterKey === "SHINY") list = list.filter(p => this.saveData.shinyUnlocked && this.saveData.shinyUnlocked[p.id]);
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
      const megaForm = (typeof MEGA_FORMS !== "undefined") ? MEGA_FORMS[p.id] : null;
      const megaUnlocked = !!(megaForm && this.saveData.megaUnlocked && this.saveData.megaUnlocked[p.id]);
      const showMega = megaUnlocked && !!(this.pokedexShowMega && this.pokedexShowMega[p.id]);
      const showShiny = shiny && (filterKey === "SHINY"
        ? !(this.pokedexShowShiny && this.pokedexShowShiny[p.id] === false)
        : !!(this.pokedexShowShiny && this.pokedexShowShiny[p.id]));
      const dispPoke = showMega ? megaForm : p;
      const rawUrl = showShiny
        ? (showBack ? (dispPoke.shiny_back_sprite || dispPoke.back_sprite) : (dispPoke.shiny_forward_sprite || dispPoke.forward_sprite))
        : (showBack ? dispPoke.back_sprite : dispPoke.forward_sprite);
      const imgUrl = SpriteCache.resolveUrl(rawUrl);

      const cardStyle = showMega
        ? (showShiny ? 'border-amber-400 bg-sky-50/90 shadow-[0_0_14px_rgba(245,158,11,0.55)]' : 'border-cyan-500 bg-sky-50/80 shadow-[0_0_12px_rgba(6,182,212,0.45)]')
        : (showShiny ? 'border-amber-400 bg-amber-50/60 shadow-[0_0_12px_rgba(245,158,11,0.45)]' : (caught ? 'border-blue-500' : 'opacity-80'));

      return `
        <div onclick="GameApp.togglePokedexCardSide(${p.id})" class="poke-card min-h-[162px] p-2 flex flex-col justify-between cursor-pointer ${cardStyle}">
          <div class="flex items-center justify-between text-[10px] font-bold">
            <span class="font-pixel ${showMega ? 'text-cyan-700' : (showShiny ? 'text-amber-600' : 'text-slate-500')}">#${String(p.id).padStart(3,'0')}</span>
            ${showMega ? `<span class="px-1.5 py-0.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-full font-black text-[8px]">${showShiny ? '✨' : ''}${megaForm.badgeLabel || 'MEGA'}</span>`
                       : (shiny ? `<span class="px-1.5 py-0.5 bg-amber-300 text-slate-900 rounded-full font-black text-[8px]">✨ 閃光</span>`
                                : (caught ? `<span class="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-black text-[8px]">已登錄</span>`
                                          : `<span class="text-slate-400">? 未發現</span>`))}
          </div>
          <div class="h-15 flex items-center justify-center my-1 ${showMega ? 'bg-slate-900/90 border border-cyan-400/60' : (showShiny ? 'bg-gradient-to-br from-amber-50 to-purple-50 border border-amber-300/80' : 'bg-sky-50/60')} rounded-xl relative">
            <img src="${imgUrl}" class="w-13 h-13 pixel-sprite object-contain ${!seen && !showMega && !showShiny ? 'brightness-0 opacity-20' : ''}" alt="${dispPoke.name_zh}" />
            ${megaForm ? `
              <button onclick="event.stopPropagation(); GameApp.handlePokedexMegaClick(${p.id})" title="${megaUnlocked ? '切換超級進化形態' : '查看超級進化解鎖條件'}" class="absolute top-1 right-1 px-1.5 py-0.5 rounded-full text-[8px] font-black border shadow flex items-center gap-0.5 ${megaUnlocked ? (showMega ? 'bg-amber-400 text-slate-950 border-white' : 'bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 text-white border-cyan-200') : 'bg-slate-900/90 text-purple-200 border-purple-400'}">
                💎${showMega ? '還原' : 'MEGA'}
              </button>
            ` : ''}
            ${shiny ? `
              <button onclick="event.stopPropagation(); GameApp.togglePokedexShiny(${p.id})" title="切換正版閃光色違外觀" class="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-full text-[8px] font-black border shadow flex items-center gap-0.5 ${showShiny ? 'bg-amber-400 text-slate-950 border-slate-900' : 'bg-white/95 text-purple-700 border-purple-300'}">
                ✨${showShiny ? '閃光中' : '閃光'}
              </button>
            ` : ''}
          </div>
          <div class="text-center">
            <div class="font-black text-xs ${showMega ? 'text-cyan-800' : (showShiny ? 'text-amber-700' : 'text-slate-800')} truncate">${seen || showMega || showShiny ? `${showShiny ? '✨' : ''}${dispPoke.name_zh}` : '？？？'}</div>
            <div class="flex justify-center gap-0.5 my-0.5">${seen || showMega ? renderTypeBadgeHTML(dispPoke.type1) + renderTypeBadgeHTML(dispPoke.type2) : ''}</div>
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

  togglePokedexShiny(id) {
    if (!this.pokedexShowShiny) this.pokedexShowShiny = {};
    const curShown = this.pokedexFilter === "SHINY"
      ? !(this.pokedexShowShiny[id] === false)
      : !!this.pokedexShowShiny[id];
    this.pokedexShowShiny[id] = !curShown;
    if (typeof SoundFX !== "undefined") SoundFX.play("shiny");
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
      this.pixelToast(`🎉 成功領取 ${count} 隻圖鑑賞金，獲得 +${count * 50} 代幣！`, "success");
    } else {
      this.pixelToast("目前沒有可領取的圖鑑賞金！", "info");
    }
  },

  openSkillTreeModal() {
    const modal = document.getElementById("skillTreeModal");
    if (modal) {
      modal.classList.remove("hidden");
      modal.style.display = "flex";
    }
    this.switchCenterTab(this.centerTab || "pokemon");
  },

  closeSkillTreeModal() {
    const modal = document.getElementById("skillTreeModal");
    if (modal) {
      modal.classList.add("hidden");
      modal.style.display = "none";
    }
    const ret = this._labReturnTarget || "title";
    this._labReturnTarget = null;

    if (ret === "setup") {
      const setupEl = document.getElementById("setupModal");
      if (setupEl) {
        setupEl.classList.remove("hidden");
        setupEl.style.display = "flex";
      }
      this.renderWizardContent();
    } else if (ret === "pokedex") {
      const titleEl = document.getElementById("titleScreen");
      if (titleEl) {
        titleEl.classList.remove("hidden");
        titleEl.style.display = "flex";
      }
      const dexEl = document.getElementById("pokedexModal");
      if (dexEl) {
        dexEl.classList.remove("hidden");
        dexEl.style.display = "flex";
      }
      this.renderPokedexGrid();
    } else {
      const titleEl = document.getElementById("titleScreen");
      if (titleEl && this.state === "TITLE") {
        titleEl.classList.remove("hidden");
        titleEl.style.display = "flex";
      }
    }
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

    const poolMode = (this.ensureSettingsObject ? this.ensureSettingsObject().fourthSlotPoolMode : null) || "affinity";
    const isAffinityMode = poolMode !== "all";

    box.innerHTML = list.map(u => {
      const lv = this.saveData.upgrades[u.id] || 0;
      const isMax = lv >= u.maxLv;
      const cost = Math.round(u.baseCost * Math.pow(1.45, lv));
      const isFourthSlotToggle = (u.id === "fourthSlot" && isMax);

      return `
        <div class="poke-card p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${u.isSpecialSlot ? 'rarity-legendary' : ''}">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-2xl bg-sky-50 border-2 border-slate-800 flex items-center justify-center shrink-0">
              <img src="${u.sprite}" class="w-8 h-8 pixel-sprite object-contain" alt="${u.name}" />
            </div>
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-black text-sm sm:text-base text-slate-800">${u.name}</span>
                <span class="px-2 py-0.5 bg-blue-600 text-white font-pixel text-[9px] rounded-full">Lv.${lv}/${u.maxLv}</span>
                ${isFourthSlotToggle ? `<span class="px-2 py-0.5 ${isAffinityMode ? 'bg-emerald-600' : 'bg-indigo-600'} text-white text-[9px] font-black rounded-full">${isAffinityMode ? '🎯 本系與特性優先' : '🎲 全系自由混搭'}</span>` : ''}
              </div>
              <p class="text-xs font-bold text-slate-600 mt-0.5">${u.desc}</p>
              ${isFourthSlotToggle ? `<p class="text-[11px] font-bold ${isAffinityMode ? 'text-emerald-700' : 'text-indigo-700'} mt-1">${isAffinityMode ? '目前第 4 槽優先抽取本系 (STAB) 與種族特性相性招式（無可抽時自動回退全池保底）。' : '目前第 4 槽開放全屬性招式平等隨機抽取，適合自由跨系混搭。'}</p>` : ''}
            </div>
          </div>
          ${isFourthSlotToggle
            ? `<button onclick="GameApp.toggleFourthSlotPoolMode()" class="${isAffinityMode ? 'poke-btn-blue' : 'poke-btn-yellow'} px-3.5 py-2 text-xs font-black shrink-0 flex items-center gap-1.5 min-h-[40px] whitespace-nowrap">
                <i class="fa-solid ${isAffinityMode ? 'fa-crosshairs' : 'fa-shuffle'}"></i>
                <span>${isAffinityMode ? '切換：全系混搭' : '切換：本系優先'}</span>
              </button>`
            : `<button onclick="GameApp.buyUpgrade('${u.id}', ${u.baseCost}, ${u.maxLv})" ${isMax ? 'disabled' : ''} class="${isMax ? 'poke-btn-white opacity-60' : 'poke-btn-red'} px-4 py-2 text-xs font-black shrink-0 flex items-center gap-1.5 min-h-[40px]">
                ${isMax ? '已達上限' : `<img src="${ITEM_SPRITES.coin}" class="w-4 h-4 pixel-sprite"/> ${cost} 強化`}
              </button>`
          }
        </div>
      `;
    }).join("");
  },

  toggleFourthSlotPoolMode() {
    const s = this.ensureSettingsObject();
    s.fourthSlotPoolMode = (s.fourthSlotPoolMode === "all") ? "affinity" : "all";
    if (typeof SoundFX !== "undefined") SoundFX.play("hit");
    this.saveToStorage();
    this.renderCenterUpgrades();
    const settingsEl = document.getElementById("settingsModal");
    if (settingsEl && !settingsEl.classList.contains("hidden")) {
      this.renderSettingsModal();
    }
  },

  buyUpgrade(id, baseCost, maxLv) {
    const lv = this.saveData.upgrades[id] || 0;
    if (lv >= maxLv) return;
    const cost = Math.round(baseCost * Math.pow(1.45, lv));
    if (this.saveData.coins < cost) {
      this.pixelToast("⚠️ 代幣不足！可至 151 圖鑑或道館榮譽領取賞金！", "warn");
      return;
    }
    this.saveData.coins -= cost;
    this.saveData.upgrades[id] = lv + 1;
    SoundFX.play("levelup");
    this.saveToStorage();
    this.renderCenterUpgrades();
  },

  toggleLobbySkillLoadout() {
    this._lobbyLoadoutOpen = !this._lobbyLoadoutOpen;
    this.renderLobbySkillLoadout();
  },

  setLobbyStarterSkill(pokeId, skillId) {
    if (!this.saveData) return;
    if (!this.saveData.skillLoadouts) this.saveData.skillLoadouts = {};
    const cur = this.saveData.skillLoadouts[pokeId] || {};
    cur.starter = skillId;
    if (cur.banned === skillId) cur.banned = null;
    this.saveData.skillLoadouts[pokeId] = cur;
    this.saveToStorage();
    SoundFX.play("click");
    this.renderLobbySkillLoadout();
  },

  toggleLobbyBanSkill(pokeId, skillId) {
    if (!this.saveData) return;
    if (!this.saveData.skillLoadouts) this.saveData.skillLoadouts = {};
    const p = POKEMON_MAP.get(pokeId);
    const natSkills = (p && typeof getNaturalSkillsForPokemon === "function") ? getNaturalSkillsForPokemon(p) : [];
    const cur = this.saveData.skillLoadouts[pokeId] || {};
    const activeStarter = (cur.starter && natSkills.includes(cur.starter)) ? cur.starter : (natSkills[0] || "Tackle");
    if (skillId === activeStarter) {
      this.pixelAlert("初始第 1 招無法停用！請先將其他天生招式設為初始技後再停用此招。", "招式整備提示");
      return;
    }
    cur.banned = (cur.banned === skillId) ? null : skillId;
    this.saveData.skillLoadouts[pokeId] = cur;
    this.saveToStorage();
    SoundFX.play("click");
    this.renderLobbySkillLoadout();
  },

  renderLobbySkillLoadout() {
    const box = document.getElementById("lobbySkillLoadoutContainer");
    if (!box || typeof POKEMON_MAP === "undefined" || typeof SKILLS_CATALOG === "undefined") return;
    const p = POKEMON_MAP.get(this.selectedStarterId) || POKEMON_MAP.get(25);
    if (!p) return;
    const natSkills = (typeof getNaturalSkillsForPokemon === "function") ? getNaturalSkillsForPokemon(p) : [];
    const fourthPool = (typeof getFourthSlotPoolForPokemon === "function") ? getFourthSlotPoolForPokemon(p) : [];
    const cur = (this.saveData && this.saveData.skillLoadouts && this.saveData.skillLoadouts[p.id]) || {};
    const starterId = (cur.starter && natSkills.includes(cur.starter)) ? cur.starter : (natSkills[0] || "Tackle");
    const bannedId = (cur.banned && cur.banned !== starterId) ? cur.banned : null;
    const starterMeta = SKILLS_CATALOG[starterId];
    const bannedMeta = bannedId ? SKILLS_CATALOG[bannedId] : null;
    const has4thSlot = !!(this.saveData && this.saveData.upgrades && this.saveData.upgrades.fourthSlot >= 1);
    const isOpen = !!this._lobbyLoadoutOpen;

    const headerHtml = `
      <div onclick="event.stopPropagation(); GameApp.toggleLobbySkillLoadout()" class="cursor-pointer flex items-center justify-between gap-1.5 px-2 py-1 rounded-xl bg-indigo-50/90 border border-indigo-200 hover:bg-indigo-100/80 transition select-none">
        <div class="flex items-center gap-1.5 min-w-0">
          <span class="text-[9px] font-black text-indigo-700 shrink-0"><i class="fa-solid fa-sliders"></i> 招式整備</span>
          ${starterMeta ? `<span class="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md bg-white border border-amber-400 text-[9px] font-black text-slate-800 shrink-0">${renderSkillIconHTML(starterMeta, "w-3.5 h-3.5")}<span>★${starterMeta.name}</span></span>` : ''}
          ${bannedMeta ? `<span class="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-md bg-rose-100 border border-rose-300 text-[9px] font-black text-rose-700 truncate">🚫停用:${bannedMeta.name}</span>` : ''}
        </div>
        <span class="text-[9px] font-black text-indigo-600 shrink-0">${isOpen ? '收合 ▲' : '配置 ▾'}</span>
      </div>
    `;

    if (!isOpen) {
      box.innerHTML = headerHtml;
      return;
    }

    const natCardsHtml = natSkills.map(sId => {
      const m = SKILLS_CATALOG[sId];
      if (!m) return "";
      const isStarter = (sId === starterId);
      const isBanned = (sId === bannedId);
      return `
        <div class="flex flex-col justify-between gap-1 p-1.5 rounded-xl border ${isStarter ? 'bg-amber-50 border-amber-400 shadow-sm' : (isBanned ? 'bg-slate-100 border-rose-300 opacity-75' : 'bg-white border-slate-200')}">
          <div class="flex items-center gap-1 min-w-0">
            ${renderSkillIconHTML(m, "w-5 h-5 shrink-0")}
            <div class="min-w-0 flex-1">
              <div class="text-[10px] font-black truncate ${isBanned ? 'line-through text-slate-400' : 'text-slate-800'}">${m.name}</div>
              <div class="text-[8px] font-bold text-slate-500">${(typeof TYPE_NAMES_ZH !== "undefined" && TYPE_NAMES_ZH[m.type]) ? TYPE_NAMES_ZH[m.type] : m.type}</div>
            </div>
          </div>
          <div class="flex items-center gap-1">
            <button onclick="event.stopPropagation(); GameApp.setLobbyStarterSkill(${p.id}, '${sId}')" class="flex-1 py-0.5 rounded text-[8px] font-black ${isStarter ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-700 hover:bg-amber-100'}">${isStarter ? '★ 初始' : '設為初始'}</button>
            ${!isStarter ? `<button onclick="event.stopPropagation(); GameApp.toggleLobbyBanSkill(${p.id}, '${sId}')" class="px-1.5 py-0.5 rounded text-[8px] font-black ${isBanned ? 'bg-rose-600 text-white' : 'bg-slate-100 text-rose-600 hover:bg-rose-100'}">${isBanned ? '已停' : '🚫'}</button>` : ''}
          </div>
        </div>
      `;
    }).join("");

    const fourthCardsHtml = fourthPool.length > 0 ? fourthPool.map(({ meta: m, isStab }) => {
      const isBanned = (m.id === bannedId);
      return `
        <button onclick="event.stopPropagation(); GameApp.toggleLobbyBanSkill(${p.id}, '${m.id}')" class="inline-flex items-center gap-1 px-1.5 py-1 rounded-lg border text-[9px] font-black transition ${isBanned ? 'bg-rose-600 border-rose-700 text-white line-through' : 'bg-white border-slate-200 text-slate-700 hover:border-rose-300'}">
          ${renderSkillIconHTML(m, "w-4 h-4 shrink-0")}
          <span>${m.name}</span>
          <span class="text-[7px] px-1 rounded ${isBanned ? 'bg-rose-800 text-rose-100' : (isStab ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700')}">${isBanned ? '🚫已停' : (isStab ? '本系' : '特性')}</span>
        </button>
      `;
    }).join("") : `<span class="text-[9px] text-slate-400 font-bold">此精靈本系招式已全含於天生三技中</span>`;

    box.innerHTML = `
      ${headerHtml}
      <div class="mt-1.5 p-2 rounded-xl bg-slate-50 border border-indigo-200 space-y-2 text-left">
        <div>
          <div class="flex items-center justify-between text-[9px] font-black text-slate-600 mb-1">
            <span>天生三技（可切換開局第 1 招）</span>
            <span class="text-rose-600">全系列最多停用 1 招</span>
          </div>
          <div class="grid grid-cols-3 gap-1.5">${natCardsHtml}</div>
        </div>
        <div class="pt-1.5 border-t border-dashed border-slate-200">
          <div class="flex items-center justify-between text-[9px] font-black text-slate-600 mb-1">
            <span>第 4 槽本系／特性池（點擊可停用 1 招）</span>
            ${!has4thSlot ? `<span class="text-amber-600 text-[8px]">需研究所解鎖第4槽</span>` : ''}
          </div>
          <div class="flex flex-wrap gap-1 ${!has4thSlot ? 'opacity-65' : ''}">${fourthCardsHtml}</div>
        </div>
      </div>
    `;
  },

  openAchievementModal() {
    const modal = document.getElementById("achievementModal");
    if (modal) {
      modal.classList.remove("hidden");
      modal.style.display = "flex";
    }
    this.renderAchievements();
  },

  closeAchievementModal() {
    const modal = document.getElementById("achievementModal");
    if (modal) {
      modal.classList.add("hidden");
      modal.style.display = "none";
    }
    this.updateTitleUI();
  },

  // 友好商店貨架渲染（支援當前已學招式等級一覽、TM 現有等級對比與滿槽自選遺忘視圖切換）
  renderMartModal(shelf) {
    this._pendingMartTM = null;
    const mainView = document.getElementById("martMainView");
    const forgetView = document.getElementById("martForgetView");
    if (mainView) mainView.classList.remove("hidden");
    if (forgetView) forgetView.classList.add("hidden");

    document.getElementById("martCoinsDisplay").textContent = this.runCoins;
    document.getElementById("martRerollCostText").textContent = this.martRerollCost || 50;

    const p = this.player;
    const curCount = p ? Object.keys(p.skills).length : 0;
    const maxSlots = p ? (p.maxSkillSlots || 3) : 3;

    // 頂部即時展示「當前已裝備招式與現時等級」，方便玩家評估 PP 提升劑、神奇糖果與 TM 學習機
    const currentSkillPills = p ? Object.values(p.skills).map(sk => {
      const meta = (typeof SKILLS_CATALOG !== "undefined") ? SKILLS_CATALOG[sk.id] : null;
      const skName = meta ? (sk.evolved ? meta.evolvedName : meta.name) : sk.id;
      return `
        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-900 border ${sk.evolved ? 'border-amber-400 text-amber-300' : (sk.level >= 10 ? 'border-emerald-400 text-emerald-300' : 'border-slate-700 text-slate-200')} text-[10px] font-black">
          ${meta ? renderSkillIconHTML(meta, "w-4 h-4") : ''}
          <span>${skName}</span>
          <span class="font-pixel text-[8px] ${sk.evolved ? 'text-amber-300' : 'text-sky-300'}">${sk.evolved ? '★MAX' : `Lv.${sk.level}`}</span>
        </span>
      `;
    }).join("") : "";

    const hintEl = document.getElementById("martSlotHintText");
    if (hintEl) {
      const statusText = curCount >= maxSlots
        ? `招式槽已滿 (<span class="text-amber-300">${curCount}/${maxSlots}</span>)，買新 TM 可<span class="text-amber-300">自選替換</span>：8`
        : `招式槽 (<span class="text-emerald-300">${curCount}/${maxSlots}</span>)，目前持有招式與等級：`;
      hintEl.innerHTML = `
        <div class="mb-1">${statusText.replace('：8', '：')}</div>
        <div class="flex flex-wrap gap-1">${currentSkillPills}</div>
      `;
    }

    const findPlayerSkill = (sId) => {
      if (!p || !sId) return null;
      const clean = sId.replace(/\s+/g, '');
      const key = Object.keys(p.skills).find(k => k.replace(/\s+/g, '') === clean);
      return key ? p.skills[key] : null;
    };

    const box = document.getElementById("martShelfContainer");
    box.innerHTML = shelf.map((it) => {
      const isTM = !!it.tmNo;
      const badgeText = isTM ? `${it.type}系` : (it.type === "buff" ? "戰鬥增益" : "特製藥劑");
      const badgeBg = isTM ? "bg-slate-700 text-amber-300" : (it.type === "buff" ? "bg-rose-900 text-rose-300" : "bg-emerald-900 text-emerald-300");
      const titleText = isTM ? `${it.tmNo} ${it.name}` : it.name;

      let statusTag = '';
      if (isTM) {
        const ownedSk = findPlayerSkill(it.id);
        if (ownedSk) {
          statusTag = `<span class="px-1.5 py-0.2 text-[9px] font-black rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/60">現有 Lv.${ownedSk.level} ➔ Lv.${Math.min(10, ownedSk.level + 1)}</span>`;
        } else if (curCount >= maxSlots) {
          statusTag = `<span class="px-1.5 py-0.2 text-[9px] font-black rounded bg-amber-500/20 text-amber-300 border border-amber-400/50">新習得 (自選替換)</span>`;
        } else {
          statusTag = `<span class="px-1.5 py-0.2 text-[9px] font-black rounded bg-sky-500/20 text-sky-300 border border-sky-400/50">新習得 Lv.1</span>`;
        }
      }

      return `
        <div class="bg-slate-800/90 p-2.5 rounded-xl border border-slate-700 flex items-center justify-between gap-2">
          <div class="flex items-start gap-2.5 min-w-0 flex-1">
            <div class="w-10 h-10 bg-slate-900 rounded-lg border border-slate-600 flex items-center justify-center shrink-0 mt-0.5">
              ${isTM && typeof renderSkillIconHTML === "function" ? renderSkillIconHTML(it.id, "w-8 h-8") : `<img src="${it.sprite}" class="w-7 h-7 pixel-sprite object-contain" alt="${it.name}"/>`}
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="font-black text-xs text-white">${titleText}</span>
                <span class="px-1.5 py-0.2 text-[9px] font-bold rounded ${badgeBg}">${badgeText}</span>
                ${statusTag}
              </div>
              <p class="text-[10px] text-slate-300 leading-snug mt-0.5 whitespace-normal break-words line-clamp-2">${it.desc}</p>
            </div>
          </div>
          <button onclick="GameApp.buyMartItem('${it.id}', ${it.cost})" class="poke-btn-yellow px-2.5 py-1.5 text-xs font-black shrink-0 flex items-center gap-1">
            <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/amulet-coin.png" class="w-3.5 h-3.5 pixel-sprite"/>
            ${it.cost}
          </button>
        </div>
      `;
    }).join("");

    const modal = document.getElementById("pokeMartModal");
    if (modal) {
      modal.classList.remove("hidden");
      modal.style.display = "flex";
    }
  },

  promptMartForgetSkill(itemId, cost) {
    const p = this.player;
    const newMeta = (typeof SKILLS_CATALOG !== "undefined") ? SKILLS_CATALOG[itemId] : null;
    this._pendingMartTM = { itemId, cost };

    const mainView = document.getElementById("martMainView");
    const forgetView = document.getElementById("martForgetView");
    if (mainView) mainView.classList.add("hidden");
    if (forgetView) forgetView.classList.remove("hidden");

    const descEl = document.getElementById("martPendingTmDesc");
    if (descEl) {
      descEl.innerHTML = `準備學習：<span class="text-sky-300">【${newMeta ? newMeta.name : itemId}】</span>（花費 ${cost} 代幣），請點選下方要遺忘的招式：`;
    }

    const listBox = document.getElementById("martForgetListContainer");
    if (listBox) {
      listBox.innerHTML = Object.entries(p.skills).map(([key, sk]) => {
        const meta = (typeof SKILLS_CATALOG !== "undefined") ? SKILLS_CATALOG[sk.id] : null;
        const skName = meta ? (sk.evolved ? meta.evolvedName : meta.name) : sk.id;
        const typeHtml = meta ? renderTypeBadgeHTML(meta.type) : "";
        const isHighLv = sk.level >= 5 || sk.evolved;

        return `
          <div class="bg-slate-800/95 p-2.5 rounded-xl border ${isHighLv ? 'border-amber-500/60' : 'border-slate-700'} flex items-center justify-between gap-2">
            <div class="flex items-center gap-2.5 min-w-0">
              <div class="w-9 h-9 bg-slate-900 rounded-lg border border-slate-600 flex items-center justify-center shrink-0">
                ${meta ? renderSkillIconHTML(meta, "w-7 h-7") : ''}
              </div>
              <div class="min-w-0">
                <div class="flex items-center gap-1.5">
                  <span class="font-black text-xs text-white truncate">${skName}</span>
                  ${typeHtml}
                  <span class="px-1.5 py-0.2 rounded bg-slate-700 font-pixel text-[9px] text-amber-300">Lv.${sk.level}${sk.evolved ? ' MAX' : ''}</span>
                </div>
                <div class="text-[10px] ${isHighLv ? 'text-amber-300 font-bold' : 'text-slate-300'} leading-snug whitespace-normal break-words mt-0.5">
                  ${isHighLv ? '⚠️ 高階練度招式，遺忘後將失去當前等級' : '點擊右側按鈕遺忘並替換'}
                </div>
              </div>
            </div>
            <button onclick="GameApp.confirmMartForget('${key}')" class="poke-btn-red px-3 py-1.5 text-xs font-black shrink-0">
              遺忘此招
            </button>
          </div>
        `;
      }).join("");
    }
  },

  confirmMartForget(oldSkillKey) {
    if (!this._pendingMartTM) return;
    const { itemId, cost } = this._pendingMartTM;
    if (this.runCoins < cost) {
      this.cancelMartForget();
      return;
    }

    const p = this.player;
    this.runCoins -= cost;
    this.saveData.coins = Math.max(0, this.saveData.coins - cost);

    const oldSk = p.skills[oldSkillKey];
    const oldMeta = (typeof SKILLS_CATALOG !== "undefined" && oldSk) ? SKILLS_CATALOG[oldSk.id] : null;
    delete p.skills[oldSkillKey];

    const stagger = Object.keys(p.skills).length * 0.22;
    p.skills[itemId] = { id: itemId, level: 1, evolved: false, timer: 0.12 + stagger };
    const newMeta = (typeof SKILLS_CATALOG !== "undefined") ? SKILLS_CATALOG[itemId] : null;

    SoundFX.play("levelup");
    this.spawnFloatingText(
      p.x, p.y - 25,
      `遺忘了【${oldMeta ? oldMeta.name : oldSkillKey}】，習得【${newMeta ? newMeta.name : itemId}】！`,
      "#38BDF8", 15
    );
    this._pendingMartTM = null;
    this.closePokeMartModal();
  },

  cancelMartForget() {
    this._pendingMartTM = null;
    const mainView = document.getElementById("martMainView");
    const forgetView = document.getElementById("martForgetView");
    if (forgetView) forgetView.classList.add("hidden");
    if (mainView) mainView.classList.remove("hidden");
  },

  rerollMartShelf() {
    const cost = this.martRerollCost || 50;
    if (this.runCoins < cost) {
      this.spawnFloatingText(this.player.x, this.player.y - 20, "代幣不足！無法刷新！", "#EF4444", 13);
      return;
    }
    this.runCoins -= cost;
    this.saveData.coins = Math.max(0, this.saveData.coins - cost);
    this.martRerollCost = cost + 50; // 50 ➔ 100 ➔ 150 遞增
    SoundFX.play("hit");
    this.openPokeMartModal();
  },

  buyMartItem(itemId, cost) {
    if (this.runCoins < cost) {
      const coinDisplay = document.getElementById("martCoinsDisplay");
      if (coinDisplay) {
        coinDisplay.classList.add("text-rose-500", "animate-pulse");
        setTimeout(() => coinDisplay.classList.remove("text-rose-500", "animate-pulse"), 1000);
      }
      const subTitle = document.getElementById("martSlotHintText");
      if (subTitle) {
        const oldHtml = subTitle.innerHTML;
        subTitle.textContent = "⚠️ 代幣不足！無法購買此項道具！";
        subTitle.classList.add("text-rose-400");
        setTimeout(() => {
          subTitle.innerHTML = oldHtml;
          subTitle.classList.remove("text-rose-400");
        }, 1200);
      }
      return;
    }

    const p = this.player;
    const isConsumable = ["pp_up", "full_restore", "x_attack", "x_speed", "master_candy", "mystery_held"].includes(itemId);

    const cleanItemId = itemId.replace(/\s+/g, '');
    const existingSkillKey = !isConsumable
      ? Object.keys(p.skills).find(k => k.replace(/\s+/g, '') === cleanItemId)
      : null;

    if (!isConsumable && !existingSkillKey) {
      const currentSkills = Object.keys(p.skills);
      const maxSlots = p.maxSkillSlots || (3 + ((this.saveData.upgrades.fourthSlot >= 1) ? 1 : 0));
      if (currentSkills.length >= maxSlots) {
        // 滿槽且購買未學過的新招式時，進入自選遺忘選擇介面
        this.promptMartForgetSkill(itemId, cost);
        return;
      }
    }

    this.runCoins -= cost;
    this.saveData.coins = Math.max(0, this.saveData.coins - cost);

    if (itemId === "pp_up") {
      const upgradeable = Object.values(p.skills).filter(s => s.level < 10);
      if (upgradeable.length > 0) {
        const pick = upgradeable[Math.floor(Math.random() * upgradeable.length)];
        pick.level += 1;
        const skMeta = (typeof SKILLS_CATALOG !== "undefined") ? SKILLS_CATALOG[pick.id] : null;
        SoundFX.play("levelup");
        this.spawnFloatingText(p.x, p.y - 25, `【${skMeta ? skMeta.name : pick.id}】升級至 Lv.${pick.level}!`, "#FACC15", 15);
      } else {
        this.spawnFloatingText(p.x, p.y - 20, "所有招式已達 MAX 滿級！", "#38BDF8", 13);
      }
    } else if (itemId === "full_restore") {
      p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * 0.45 * (p.badgeHealMult || 1.0)));
      p.status = null;
      p.statusTimer = 0;
      SoundFX.play("levelup");
      this.spawnFloatingText(p.x, p.y - 25, "全滿傷藥：恢復 45% HP ＆ 淨化異常！", "#34D399", 15);
    } else if (itemId === "x_attack") {
      p.xAttackTimer = 30.0;
      SoundFX.play("super");
      this.spawnFloatingText(p.x, p.y - 25, "力量強化：30秒內全傷害+35%！", "#EF4444", 15);
      this.spawnParticleCluster(p.x, p.y, "#EF4444", "#F59E0B", 24, "star", 1.2);
    } else if (itemId === "x_speed") {
      p.xSpeedTimer = 30.0;
      SoundFX.play("super");
      this.spawnFloatingText(p.x, p.y - 25, "速度強化：30秒內移速+30% ＆ 涉水減速免疫！", "#38BDF8", 15);
      this.spawnParticleCluster(p.x, p.y, "#38BDF8", "#FFFFFF", 24, "circle", 1.2);
    } else if (itemId === "master_candy") {
      p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * 0.30 * (p.badgeHealMult || 1.0)));
      const upgradeable = Object.values(p.skills).filter(s => s.level < 10);
      if (upgradeable.length > 0) {
        const pick = upgradeable[Math.floor(Math.random() * upgradeable.length)];
        pick.level = Math.min(10, pick.level + 2);
        const skMeta = (typeof SKILLS_CATALOG !== "undefined") ? SKILLS_CATALOG[pick.id] : null;
        SoundFX.play("levelup");
        this.spawnFloatingText(p.x, p.y - 25, `🍬 極限糖果：【${skMeta ? skMeta.name : pick.id}】直升 Lv.${pick.level}!`, "#FACC15", 15);
      } else {
        this.gainExp(p.nextExp - p.exp);
      }
    } else if (itemId === "mystery_held") {
      const learnedTypes = new Set(Object.values(p.skills).map(s => SKILLS_CATALOG[s.id]?.type));
      let eligibleHeld = Object.values(HELD_ITEMS).filter(hi => {
        const targetSkill = SKILLS_CATALOG[hi.skillReq];
        return targetSkill && learnedTypes.has(targetSkill.type) && !p.heldItems[hi.id];
      });
      if (eligibleHeld.length === 0) {
        eligibleHeld = Object.values(HELD_ITEMS).filter(hi => !p.heldItems[hi.id]);
      }
      const ownedHeldCnt = Object.keys(p.heldItems || {}).filter(k => p.heldItems[k]).length;
      if (eligibleHeld.length > 0 && ownedHeldCnt < 4) {
        const hi = eligibleHeld[Math.floor(Math.random() * eligibleHeld.length)];
        p.heldItems[hi.id] = true;
        p.dmgMult += 0.06;
        SoundFX.play("levelup");
        this.spawnFloatingText(p.x, p.y - 25, `🎁 獲得超武攜帶物：【${hi.name}】(${ownedHeldCnt + 1}/4)！`, "#C084FC", 15);
      } else {
        p.dmgMult += 0.08;
        this.spawnFloatingText(p.x, p.y - 25, "攜帶物已達上限 (4/4)！轉化全傷害 +8%！", "#FACC15", 14);
      }
    } else if (existingSkillKey && p.skills[existingSkillKey]) {
      const skObj = p.skills[existingSkillKey];
      skObj.level = Math.min(10, skObj.level + 1);
      SoundFX.play("levelup");
      const skName = (typeof SKILLS_CATALOG !== "undefined" && SKILLS_CATALOG[skObj.id]) ? SKILLS_CATALOG[skObj.id].name : itemId;
      this.spawnFloatingText(p.x, p.y - 25, `【${skName}】提升至 Lv.${skObj.level}！`, "#34D399", 15);
    } else {
      const stagger = Object.keys(p.skills).length * 0.22;
      p.skills[itemId] = { id: itemId, level: 1, evolved: false, timer: 0.12 + stagger };
      SoundFX.play("levelup");
      const skName = (typeof SKILLS_CATALOG !== "undefined" && SKILLS_CATALOG[itemId]) ? SKILLS_CATALOG[itemId].name : itemId;
      this.spawnFloatingText(p.x, p.y - 25, `習得【${skName}】！`, "#38BDF8", 15);
    }

    this.closePokeMartModal();
  },

  closePokeMartModal() {
    const modal = document.getElementById("pokeMartModal");
    if (modal) modal.classList.add("hidden");
    this.state = "PLAYING";
    const idx = this.mapItems.findIndex(it => it.id === "poke_mart");
    if (idx !== -1) {
      const it = this.mapItems[idx];
      this.spawnParticleCluster(it.x, it.y, "#94A3B8", "#FFFFFF", 20, "circle", 1.2);
      this.mapItems.splice(idx, 1);
      SoundFX.play("hit");
    }
    this.martRerollCost = 50;
    this.refreshHUD();
  },

  selectKantoBadgeDetail(badgeId) {
    this._selectedKantoBadgeId = (this._selectedKantoBadgeId === badgeId) ? null : badgeId;
    SoundFX.play("click");
    this.renderAchievements();
  },

  renderAchievements() {
    const box = document.getElementById("achievementListContainer");
    const sorted = [...ACHIEVEMENTS].sort((a, b) => {
      const aUn = a.check(this.saveData.stats, this.saveData);
      const bUn = b.check(this.saveData.stats, this.saveData);
      const aCl = !!this.saveData.claimedAch[a.id];
      const bCl = !!this.saveData.claimedAch[b.id];
      const rank = (un, cl) => (un && !cl) ? 0 : (!un ? 1 : 2);
      return rank(aUn, aCl) - rank(bUn, bCl);
    });
    const completedCount = ACHIEVEMENTS.filter(a => a.check(this.saveData.stats, this.saveData)).length;
    const brMap = (this.saveData && this.saveData.bestRatings) || {};
    const modeCardsDef = [
      { key: "expedition", label: "關都大遠征 20+1", stripe: "bg-emerald-500" },
      { key: "arena",      label: "1vs1 石英鬥技場", stripe: "bg-rose-500" },
      { key: "standard",   label: "8分鐘標準模式",   stripe: "bg-sky-500" },
      { key: "endless",    label: "無盡深淵試煉",    stripe: "bg-purple-500" }
    ];
    const rankColorMap = {
      "MASTER": "bg-gradient-to-r from-rose-600 via-amber-500 to-purple-600 text-white border-amber-200",
      "S+":     "bg-amber-500 text-slate-950 border-amber-200",
      "S":      "bg-amber-900 text-amber-200 border-amber-400",
      "A":      "bg-sky-800 text-sky-200 border-sky-400",
      "B":      "bg-emerald-800 text-emerald-200 border-emerald-400",
      "C":      "bg-slate-700 text-slate-200 border-slate-400"
    };
    const bestRecordsHtml = `
      <div class="poke-card p-3 bg-white space-y-2">
        <div class="flex items-center justify-between text-xs font-black border-b border-slate-200 pb-1.5">
          <span class="flex items-center gap-1.5 text-slate-800"><i class="fa-solid fa-medal text-blue-600"></i> 歷史最佳戰績總覽</span>
          <span class="font-pixel text-[8px] text-slate-500">BEST RATINGS</span>
        </div>
        <div class="grid grid-cols-2 gap-2">
          ${modeCardsDef.map(mc => {
            const rec = brMap[mc.key];
            if (!rec) {
              return `
                <div class="best-record-card relative overflow-hidden bg-slate-50 rounded-xl pl-3 pr-2.5 py-2 border border-dashed border-slate-300 flex items-center gap-2 min-h-[62px]">
                  <span class="absolute left-0 top-0 bottom-0 w-1 ${mc.stripe} opacity-40"></span>
                  <div class="w-9 h-9 rounded-lg bg-slate-200/70 border border-slate-300/80 flex items-center justify-center text-slate-400 text-xs shrink-0"><i class="fa-solid fa-lock-open opacity-50"></i></div>
                  <div class="min-w-0 flex-1">
                    <div class="text-[10px] font-black text-slate-600 truncate">${mc.label}</div>
                    <div class="text-[9px] font-bold text-slate-400 mt-0.5">尚無通關紀錄</div>
                  </div>
                </div>
              `;
            }
            const pObj = (rec.build && POKEMON_MAP.get(rec.build.pokemonId)) || POKEMON_MAP.get(25);
            const sprUrl = pObj ? SpriteCache.resolveUrl((rec.build && rec.build.isShiny && pObj.shiny_forward_sprite) ? pObj.shiny_forward_sprite : pObj.forward_sprite) : "";
            const rCls = rankColorMap[rec.rank] || rankColorMap.C;
            return `
              <div class="best-record-card relative overflow-hidden bg-slate-50 rounded-xl pl-3 pr-2 py-2 border border-slate-200 flex items-center gap-2 min-h-[62px]">
                <span class="absolute left-0 top-0 bottom-0 w-1 ${mc.stripe}"></span>
                <div class="w-10 h-10 rounded-lg bg-white border border-slate-300 flex items-center justify-center shrink-0 overflow-hidden shadow-inner">
                  ${sprUrl ? `<img src="${sprUrl}" class="w-9 h-9 pixel-sprite object-contain"/>` : ''}
                </div>
                <div class="min-w-0 flex-1 flex flex-col justify-between gap-0.5">
                  <div class="flex items-center justify-between gap-1">
                    <span class="text-[10px] font-black text-slate-800 truncate">${mc.label}</span>
                    <span class="px-1.5 py-0.2 rounded border font-black italic text-[9px] leading-tight shrink-0 ${rCls}">${rec.rank}</span>
                  </div>
                  <div class="flex items-baseline gap-1">
                    <span class="font-pixel text-[10px] text-amber-600 leading-none">${(rec.score || 0).toLocaleString()}</span>
                    <span class="text-[8px] font-black text-slate-400">PTS</span>
                  </div>
                  <div class="text-[9px] font-bold text-indigo-600 truncate leading-tight">${rec.title || '關都挑戰者'}</div>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;

    const summaryBar = `
      <div class="poke-card px-3.5 py-2.5 bg-white flex items-center justify-between text-xs font-black">
        <span class="flex items-center gap-1.5 text-slate-800"><i class="fa-solid fa-trophy text-amber-500"></i> 榮譽達成進度</span>
        <span class="font-pixel text-[11px] text-amber-600">${completedCount} / ${ACHIEVEMENTS.length}</span>
      </div>
    `;
    const badgeBonuses = (typeof getKantoBadgeBonuses === "function") ? getKantoBadgeBonuses(this.saveData) : { count: 0, unlockedMap: {} };
    const selBadgeId = this._selectedKantoBadgeId || null;
    const selBadgeObj = (typeof KANTO_GYM_BADGES !== "undefined" && selBadgeId) ? KANTO_GYM_BADGES.find(b => b.id === selBadgeId) : null;
    const selBadgeUn = selBadgeObj ? !!badgeBonuses.unlockedMap[selBadgeObj.id] : false;
    const selBadgeProg = selBadgeObj ? selBadgeObj.progress(this.saveData.stats || {}, this.saveData) : [0, 1];
    const badgesCaseHtml = (typeof KANTO_GYM_BADGES !== "undefined") ? `
      <div class="poke-card p-3 bg-white space-y-2">
        <div class="flex items-center justify-between border-b border-slate-200 pb-1.5">
          <div class="flex items-center gap-1.5">
            <span class="text-slate-800 font-black text-xs sm:text-sm"><i class="fa-solid fa-shield-halved text-amber-500"></i> 關都道館徽章盒</span>
            <span class="px-1.5 py-0.2 rounded-full bg-amber-100 border border-amber-300 text-amber-700 font-pixel text-[8px]">${badgeBonuses.count} / 8</span>
          </div>
          <span class="text-[9px] font-bold text-slate-500">點擊徽章查看詳情</span>
        </div>
        <div class="grid grid-cols-4 gap-1.5">
          ${KANTO_GYM_BADGES.map(bg => {
            const un = !!badgeBonuses.unlockedMap[bg.id];
            const isSel = (selBadgeId === bg.id);
            return `
              <button onclick="GameApp.selectKantoBadgeDetail('${bg.id}')" class="kanto-badge-cell ${un ? 'is-unlocked bg-amber-50/70 border-amber-300' : 'bg-slate-50 border-slate-200 opacity-85'} ${isSel ? 'ring-2 ring-blue-500' : ''} rounded-xl px-1 py-1.5 border flex flex-col items-center text-center gap-0.5 transition cursor-pointer">
                <div class="kanto-badge-ring w-10 h-10 rounded-full ${un ? 'bg-slate-900/90 border-amber-400' : 'bg-slate-200 border-slate-300'} border flex items-center justify-center shrink-0">
                  ${renderKantoBadgeIconHTML(bg, un, 32)}
                </div>
                <div class="text-[9px] font-black ${un ? 'text-slate-800' : 'text-slate-500'} leading-tight truncate w-full">${bg.name}</div>
                <div class="text-[7px] font-bold ${un ? 'text-emerald-600' : 'text-slate-400'} leading-tight truncate w-full">${un ? '✓ 已啟用' : bg.gym}</div>
              </button>
            `;
          }).join("")}
        </div>
        <div id="kantoBadgeDetailBar" class="rounded-xl px-2.5 py-1.5 bg-slate-50 border border-slate-200 text-[10px] font-bold text-slate-700 flex items-center justify-between gap-2">
          ${selBadgeObj ? `
            <div class="min-w-0 flex-1">
              <div class="font-black text-slate-800">${selBadgeObj.name}（${selBadgeObj.gym}）· <span class="text-emerald-600">${selBadgeObj.buffText}</span></div>
              <div class="text-[9px] text-slate-500 mt-0.5">${selBadgeUn ? '✓ 已達成解鎖條件，永久被動生效中！' : `解鎖條件：${selBadgeObj.condDesc}（進度 ${selBadgeProg[0]}/${selBadgeProg[1]}）`}</div>
            </div>
          ` : `<span class="text-[9px] text-slate-500">已點亮 <strong class="text-amber-600">${badgeBonuses.count}/8</strong> 枚道館徽章（點選任一徽章可查看屬性加成與解鎖進度）</span>`}
        </div>
      </div>
    ` : "";
    box.innerHTML = badgesCaseHtml + bestRecordsHtml + summaryBar + sorted.map(a => {
      const unlocked = a.check(this.saveData.stats, this.saveData);
      const claimed = !!this.saveData.claimedAch[a.id];
      const progPair = typeof a.progress === "function" ? a.progress(this.saveData.stats, this.saveData) : [unlocked ? 1 : 0, 1];
      const curVal = Math.min(progPair[1], progPair[0]);
      const targetVal = Math.max(1, progPair[1]);
      const pct = Math.min(100, Math.round((curVal / targetVal) * 100));
      return `
        <div class="poke-card p-3 flex items-center justify-between gap-3 ${unlocked && !claimed ? 'border-amber-400 bg-amber-50/40' : (claimed ? 'opacity-80 bg-slate-50' : 'bg-white')}">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="font-black text-sm text-slate-800">${a.name}</span>
              <span class="text-[10px] font-black text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded-full">+${a.reward} 金</span>
            </div>
            <div class="text-xs font-bold text-slate-600 mt-0.5">${a.desc}</div>
            <div class="mt-1.5 flex items-center gap-2">
              <div class="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div class="h-full rounded-full ${unlocked ? 'bg-emerald-500' : 'bg-blue-500'}" style="width:${pct}%"></div>
              </div>
              <span class="font-pixel text-[9px] text-slate-500 shrink-0">${curVal}/${targetVal}</span>
            </div>
          </div>
          ${unlocked && !claimed
            ? `<button onclick="GameApp.claimAchievement('${a.id}', ${a.reward})" class="poke-btn-red px-3.5 py-1.5 text-xs font-black shrink-0 min-h-[38px] whitespace-nowrap">領取賞金</button>`
            : `<span class="text-xs font-black ${claimed ? 'text-emerald-600' : 'text-slate-400'} shrink-0 whitespace-nowrap">${claimed ? '✓ 已領取' : '進行中'}</span>`
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


  // ==========================================================================
  // v7.4.1 戰後六邊形評級系統完整版（全 4 模式覆蓋 ＋ 實測數據校準）
  // ==========================================================================
  computePostGameRating(isVictory) {
    const p = this.player;
    if (!p) return null;

    const rs = this.runStats || {
      hitsTaken: 0, damageTaken: 0, perfectDodges: 0,
      totalHitsDealt: 0, superEffectiveHits: 0, statusProcs: 0,
      arenaPowerupsPicked: 0, fieldPowerupsPicked: 0, treasuresKilled: 0,
      trainerSkillsUsed: 0, isDebugRun: false
    };
    const clamp = (v, lo = 10, hi = 100) => Math.max(lo, Math.min(hi, Math.round(v)));
    const totalDmg = Object.values(this.skillDamageStats || {}).reduce((s, v) => s + v, 0);
    const runSec = Math.max(5, this.runTime || 5);
    const dps = totalDmg / runSec;
    const kpm = (this.kills || 0) / Math.max(0.25, runSec / 60);
    const seRatio = rs.totalHitsDealt > 0 ? (rs.superEffectiveHits / rs.totalHitsDealt) : 0;
    const evolvedSkills = Object.values(p.skills || {}).filter(s => s && s.evolved).length;
    const heldCount = Object.keys(p.heldItems || {}).filter(k => p.heldItems[k]).length;
    const isMega = !!(p.megaEvolved || p.id >= 10000);
    const isFinalForm = isMega || !p.data.evo_to || p.data.evo_level === "None";
    const dmgRatio = rs.damageTaken / Math.max(1, p.maxHp);
    const trUses = rs.trainerSkillsUsed || 0;

    const modeKey = this.isExpeditionMode
      ? "expedition"
      : (this.isArenaMode ? "arena" : (this.isEndlessMode ? "endless" : "standard"));

    let diffId = "normal";
    let diffMult = 1.0;
    let hex = { atk: 50, sur: 50, spd: 50, tac: 50, bld: 50, eco: 50 };
    let hardcoreMasterGate = false;
    let effectiveVictory = !!isVictory;
    let isExTrueClear = false;
    let modeLabel = "STANDARD 8M";

    const lvPtsCommon = Math.min(35, (p.level / 24) * 35);
    const evoPtsCommon = isMega ? 28 : (isFinalForm ? 18 : 8);
    const superPtsCommon = Math.min(24, evolvedSkills * 14);
    const heldPtsCommon = Math.min(15, heldCount * 5);
    const commonBuildScore = clamp(lvPtsCommon + evoPtsCommon + superPtsCommon + heldPtsCommon, 15, 100);

    if (modeKey === "expedition") {
      const df = this.selectedDifficulty || { id: "normal" };
      diffId = df.id || "normal";
      diffMult = ({ easy: 0.85, normal: 1.0, hard: 1.25, hell: 1.50 })[diffId] || 1.0;
      const st = this.expeditionState || { currentWave: 1, totalWaves: 16 };
      const totW = st.totalWaves || 16;
      const clearedW = isVictory ? totW : Math.max(0, (st.currentWave || 1) - 1);
      isExTrueClear = !!(this.lastExpeditionResult && this.lastExpeditionResult.isExTrueClear);
      modeLabel = isExTrueClear ? "EXPEDITION EX CLEAR" : "EXPEDITION 20+1";

      // v7.4.1 實測校準：DPS 滿分線收緊至 1250、效率收緊至 <= 04:00 (240s)、生存放緩斜率＋勝場保底 35、戰術納入異常與大招
      hex.atk = clamp(25 + (dps / 1250) * 75, 12, 100);
      hex.sur = (rs.hitsTaken === 0 && isVictory)
        ? 100
        : clamp(100 - rs.hitsTaken * 2.4 - dmgRatio * 14 - (isVictory ? 0 : 18), isVictory ? 35 : 15, 100);
      if (isVictory) {
        hex.spd = clamp(100 - Math.max(0, runSec - 240) * 0.14, 55, 100);
      } else {
        hex.spd = clamp((clearedW / totW) * 68, 12, 68);
      }
      const statusRate = Math.min(1, rs.statusProcs / Math.max(10, (this.kills || 1) * 0.28));
      hex.tac = clamp(38 + seRatio * 85 + statusRate * 34 + Math.min(18, trUses * 4.5), 25, 100);
      hex.bld = commonBuildScore;
      const coinPts = Math.min(62, ((this.runCoins || 0) / 1100) * 62);
      const bonusPts = Math.min(20, rs.fieldPowerupsPicked * 5 + rs.treasuresKilled * 8);
      const exPts = isExTrueClear ? 28 : (isVictory ? 12 : 0);
      hex.eco = clamp(16 + coinPts + bonusPts + exPts, 15, 100);

      hardcoreMasterGate = isExTrueClear || diffId === "hard" || diffId === "hell" || rs.hitsTaken === 0;
    } else if (modeKey === "arena") {
      const ad = this.arenaDiff || { id: "standard", name: "標準試煉" };
      diffId = ad.id || "standard";
      diffMult = ({ standard: 1.0, master: 1.3, champion: 1.6 })[diffId] || 1.0;
      modeLabel = `1VS1 ARENA · ${ad.name || "標準試煉"}`;

      const parSec = ({ standard: 36, master: 56, champion: 78 })[diffId] || 40;
      const parDps = ({ standard: 540, master: 700, champion: 860 })[diffId] || 580;

      hex.atk = clamp(25 + (dps / parDps) * 75, 15, 100);
      // v7.4.1 實測校準：放緩受擊斜率（7.5 -> 4.5）並設勝場保底 35 分
      hex.sur = (rs.hitsTaken === 0 && isVictory)
        ? 100
        : clamp(100 - rs.hitsTaken * 4.5 - dmgRatio * 20 - (isVictory ? 0 : 20), isVictory ? 35 : 12, 100);
      if (isVictory) {
        const clearSec = (this.lastArenaResult && this.lastArenaResult.clearSec) || runSec;
        hex.spd = clamp(100 - Math.max(0, clearSec - parSec) * 0.85, 52, 100);
      } else {
        const bossRemainPct = (this.activeBoss && this.activeBoss.maxHp > 0) ? (this.activeBoss.hp / this.activeBoss.maxHp) : 0.7;
        hex.spd = clamp((1 - bossRemainPct) * 65, 12, 65);
      }
      // 戰術納入完美閃避 ＋ 屬性克制 ＋ 異常控場 ＋ 訓練家大招
      hex.tac = clamp(38 + Math.min(40, rs.perfectDodges * 16) + seRatio * 48 + Math.min(22, rs.statusProcs * 3.5) + Math.min(16, trUses * 8), 25, 100);
      const stabBonus = seRatio >= 0.30 ? 18 : 10;
      hex.bld = clamp(56 + (isMega ? 24 : 0) + evolvedSkills * 12 + (p.isTrainerBond ? 10 : 0) + stabBonus, 35, 100);
      const tierBase = diffId === "champion" ? 90 : (diffId === "master" ? 76 : 62);
      hex.eco = clamp(tierBase + rs.arenaPowerupsPicked * 8 - (isVictory ? 0 : 18), 20, 100);

      hardcoreMasterGate = diffId === "master" || diffId === "champion" || rs.hitsTaken === 0;
    } else if (modeKey === "standard") {
      // 8 分鐘標準模式
      const df = this.selectedDifficulty || { id: "normal" };
      diffId = df.id || "normal";
      diffMult = ({ easy: 0.85, normal: 1.0, hard: 1.25, hell: 1.50 })[diffId] || 1.0;
      modeLabel = "STANDARD · 8 MIN";

      hex.atk = clamp(24 + (dps / 850) * 76, 12, 100);
      hex.sur = (rs.hitsTaken === 0 && isVictory)
        ? 100
        : clamp(100 - rs.hitsTaken * 2.2 - dmgRatio * 14 - (isVictory ? 0 : 18), isVictory ? 35 : 15, 100);
      if (isVictory) {
        hex.spd = clamp(52 + Math.min(48, (kpm / 75) * 48), 55, 100);
      } else {
        hex.spd = clamp((runSec / 480) * 68, 12, 68);
      }
      const statusRate = Math.min(1, rs.statusProcs / Math.max(15, (this.kills || 1) * 0.25));
      hex.tac = clamp(38 + seRatio * 85 + statusRate * 34 + Math.min(18, trUses * 3.5), 25, 100);
      hex.bld = commonBuildScore;
      const coinPts = Math.min(60, ((this.runCoins || 0) / 1200) * 60);
      const bonusPts = Math.min(20, rs.fieldPowerupsPicked * 5 + rs.treasuresKilled * 8);
      hex.eco = clamp(18 + coinPts + bonusPts + (isVictory ? 16 : 0), 15, 100);

      hardcoreMasterGate = diffId === "hard" || diffId === "hell" || rs.hitsTaken === 0;
    } else {
      // 無盡深淵試煉（以存活 8 分鐘為 S 基準、12 分鐘以上可衝 MASTER）
      const df = this.selectedDifficulty || { id: "normal" };
      diffId = df.id || "normal";
      diffMult = ({ easy: 0.85, normal: 1.0, hard: 1.25, hell: 1.50 })[diffId] || 1.0;
      modeLabel = "ENDLESS ABYSS";
      effectiveVictory = (runSec >= 480);

      hex.atk = clamp(24 + (dps / 980) * 76, 12, 100);
      hex.sur = runSec <= 480
        ? clamp((runSec / 480) * 68, 12, 68)
        : clamp(68 + Math.min(32, ((runSec - 480) / 360) * 32), 68, 100);
      hex.spd = clamp(24 + (kpm / 85) * 76, 15, 100);
      const statusRate = Math.min(1, rs.statusProcs / Math.max(18, (this.kills || 1) * 0.25));
      hex.tac = clamp(38 + seRatio * 85 + statusRate * 34 + Math.min(18, trUses * 3), 25, 100);
      hex.bld = commonBuildScore;
      const cycles = this.endlessCycleIdx || 0;
      const coinPts = Math.min(54, ((this.runCoins || 0) / 1600) * 54);
      hex.eco = clamp(18 + coinPts + Math.min(36, cycles * 18) + rs.treasuresKilled * 6, 15, 100);

      hardcoreMasterGate = (runSec >= 720);
    }

    const avgHex = (hex.atk + hex.sur + hex.spd + hex.tac + hex.bld + hex.eco) / 6;
    const compositeScore = Math.round(avgHex * 100 * diffMult);

    // 評級印章判定（非無盡模式未通關鎖頂 A；無盡模式達 8 分鐘解鎖 S/S+、12 分鐘解鎖 MASTER）
    let rank = "C";
    if (!effectiveVictory) {
      if (avgHex >= 72) rank = "A";
      else if (avgHex >= 54) rank = "B";
      else rank = "C";
    } else {
      if (avgHex >= 90 && hardcoreMasterGate) rank = "MASTER";
      else if (avgHex >= 85) rank = "S+";
      else if (avgHex >= 73) rank = "S";
      else if (avgHex >= 60) rank = "A";
      else if (avgHex >= 46) rank = "B";
      else rank = "C";
    }

    // 戰後專屬稱號判定
    const allHigh = Object.values(hex).every(v => v >= 85);
    let title = "關都挑戰者";
    if (isExTrueClear) title = "EX 破界者";
    else if (modeKey === "endless" && runSec >= 720) title = "深淵不滅者";
    else if (rs.hitsTaken === 0 && isVictory) title = "無傷幻影";
    else if (allHigh && effectiveVictory) title = "六邊形戰士";
    else if (modeKey === "arena" && rs.perfectDodges >= 3 && isVictory) title = "閃避宗師";
    else if (hex.spd >= 94 && effectiveVictory) title = "極速斬神";
    else if (hex.tac >= 90) title = "克制大師";
    else if (hex.atk >= 94) title = "火力霸主";
    else if (hex.bld >= 95) title = "滿配大宗師";
    else if (effectiveVictory) {
      title = modeKey === "arena" ? "鬥技場勝者" : (modeKey === "endless" ? "深淵征服者" : (modeKey === "standard" ? "關都冠軍" : "關都遠征軍"));
    }

    return {
      version: this.APP_VERSION || "v7.6.6",
      mode: modeKey,
      difficulty: diffId,
      score: compositeScore,
      avgHex: Math.round(avgHex),
      rank,
      title,
      hex,
      metrics: {
        hitsTaken: rs.hitsTaken,
        perfectDodges: rs.perfectDodges,
        sePct: Math.round(seRatio * 100),
        dps: Math.round(dps)
      },
      build: {
        trainer: (this.selectedTrainer && this.selectedTrainer.id) || "ash",
        pokemonId: p.id,
        isShiny: !!p.isShiny,
        level: p.level,
        skills: Object.values(p.skills || {}).map(s => ({ id: s.id, lv: s.level, evo: !!s.evolved })),
        heldItems: Object.keys(p.heldItems || {}).filter(k => p.heldItems[k])
      },
      isDebugRun: !!rs.isDebugRun,
      isVictory: !!effectiveVictory,
      modeLabel,
      timestamp: Date.now()
    };
  },

  evaluateAndRenderPostGameRating(isVictory) {
    const box = document.getElementById("endHexRatingBox");
    if (!box) return;

    const snap = this.computePostGameRating(isVictory);
    if (!snap) {
      box.classList.add("hidden");
      return;
    }
    this.lastRunRating = snap;

    if (!this.saveData.bestRatings) this.saveData.bestRatings = {};
    const prevBest = this.saveData.bestRatings[snap.mode] || null;
    const isNewBest = !snap.isDebugRun && (!prevBest || snap.score > (prevBest.score || 0));
    if (isNewBest) {
      this.saveData.bestRatings[snap.mode] = snap;
      this.saveToStorage();
    }

    const showNewBest = isNewBest && (snap.mode === "endless" ? (this.runTime >= 180) : !!isVictory);
    box.classList.remove("hidden");
    const modeEl = document.getElementById("hexModeLabel");
    if (modeEl) modeEl.textContent = snap.modeLabel;
    const scoreEl = document.getElementById("hexTotalScore");
    if (scoreEl) scoreEl.textContent = snap.score.toLocaleString();
    const titleEl = document.getElementById("hexTitleBadge");
    if (titleEl) titleEl.textContent = snap.title;
    const newBestEl = document.getElementById("hexNewBestBadge");
    if (newBestEl) newBestEl.classList.toggle("hidden", !showNewBest);
    const testEl = document.getElementById("hexTestRunBadge");
    if (testEl) testEl.classList.toggle("hidden", !snap.isDebugRun);
    const ghostLeg = document.getElementById("hexGhostLegend");
    if (ghostLeg) ghostLeg.classList.toggle("hidden", !prevBest);

    const subRow = document.getElementById("hexSubMetricsRow");
    if (subRow && snap.metrics) {
      subRow.innerHTML = `
        <div class="bg-slate-900/90 rounded-lg py-1 border border-slate-800">受擊 <span class="${snap.metrics.hitsTaken === 0 ? 'text-emerald-400' : 'text-amber-300'} font-black">${snap.metrics.hitsTaken}</span> 次</div>
        <div class="bg-slate-900/90 rounded-lg py-1 border border-slate-800">克制 <span class="text-sky-300 font-black">${snap.metrics.sePct}%</span></div>
        <div class="bg-slate-900/90 rounded-lg py-1 border border-slate-800">${snap.mode === "arena" ? `閃避 <span class="text-cyan-300 font-black">${snap.metrics.perfectDodges}</span>` : `DPS <span class="text-rose-300 font-black">${snap.metrics.dps}</span>`}</div>
      `;
    }

    // 動態街機雙層印章樣式設定（固定 54x54 方章 ＋ 寬幅 MASTER 黑金流光章）
    const stampEl = document.getElementById("hexRankStamp");
    if (stampEl) {
      const isMaster = snap.rank === "MASTER";
      const rankMeta = {
        "MASTER": {
          box: "min-w-[94px] h-[48px] px-2.5 border-amber-300 bg-gradient-to-br from-slate-950 via-rose-900 to-amber-700 shadow-[0_0_22px_rgba(250,204,21,0.85)] ring-1 ring-inset ring-amber-200/70",
          txt: "text-[14px] tracking-wider bg-gradient-to-b from-white via-amber-200 to-amber-400 bg-clip-text text-transparent drop-shadow-[0_2px_2px_rgba(0,0,0,0.95)]",
          sub: "text-amber-200",
          subLabel: "★ GRAND"
        },
        "S+": {
          box: "w-[56px] h-[56px] border-amber-300 bg-gradient-to-br from-amber-400 via-orange-500 to-rose-600 shadow-[0_0_18px_rgba(251,191,36,0.75)] ring-1 ring-inset ring-white/60",
          txt: "text-[24px] text-white drop-shadow-[0_2px_0_rgba(124,45,18,0.95)]",
          sub: "text-amber-100",
          subLabel: "RANK"
        },
        "S": {
          box: "w-[54px] h-[54px] border-amber-400 bg-gradient-to-br from-slate-900 via-amber-950 to-slate-950 shadow-[0_0_15px_rgba(250,204,21,0.55)] ring-1 ring-inset ring-amber-300/45",
          txt: "text-[28px] text-amber-300 drop-shadow-[0_2px_0_rgba(0,0,0,0.95)]",
          sub: "text-amber-200/85",
          subLabel: "RANK"
        },
        "A": {
          box: "w-[54px] h-[54px] border-sky-400 bg-gradient-to-br from-slate-900 via-sky-950 to-slate-950 shadow-[0_0_12px_rgba(56,189,248,0.45)] ring-1 ring-inset ring-sky-300/40",
          txt: "text-[28px] text-sky-300 drop-shadow-[0_2px_0_rgba(0,0,0,0.95)]",
          sub: "text-sky-200/80",
          subLabel: "RANK"
        },
        "B": {
          box: "w-[54px] h-[54px] border-emerald-400 bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-950 shadow-[0_0_12px_rgba(52,211,153,0.40)] ring-1 ring-inset ring-emerald-300/40",
          txt: "text-[28px] text-emerald-300 drop-shadow-[0_2px_0_rgba(0,0,0,0.95)]",
          sub: "text-emerald-200/80",
          subLabel: "RANK"
        },
        "C": {
          box: "w-[54px] h-[54px] border-slate-400 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 ring-1 ring-inset ring-white/25",
          txt: "text-[28px] text-slate-200 drop-shadow-[0_2px_0_rgba(0,0,0,0.95)]",
          sub: "text-slate-400",
          subLabel: "RANK"
        }
      };
      const rm = rankMeta[snap.rank] || rankMeta.C;
      stampEl.className = `relative rounded-xl border-2 flex flex-col items-center justify-center transform -rotate-6 transition-all duration-300 shrink-0 overflow-hidden select-none ${rm.box}`;
      stampEl.innerHTML = `
        <div class="pointer-events-none absolute -top-3 -left-3 w-12 h-6 bg-white/15 -rotate-45"></div>
        <span class="relative z-10 font-black italic leading-none ${rm.txt}">${isMaster ? "MASTER" : snap.rank}</span>
        <span class="relative z-10 font-pixel text-[6px] tracking-widest mt-1 leading-none ${rm.sub}">${rm.subLabel}</span>
      `;
      stampEl.style.opacity = "0";
      stampEl.style.transform = "scale(2.1) rotate(-14deg)";
    }

    const canvas = document.getElementById("hexRatingCanvas");
    if (canvas) {
      this.animateHexRatingChart(canvas, snap.hex, prevBest ? prevBest.hex : null, snap.rank, stampEl);
    }
  },

  animateHexRatingChart(canvas, curHex, ghostHex, rank, stampEl) {
    if (this._hexRadarRaf) {
      cancelAnimationFrame(this._hexRadarRaf);
      this._hexRadarRaf = null;
    }
    const startTs = performance.now();
    const durationMs = 760;
    let stampPopped = false;

    const tick = (nowTs) => {
      const rawT = Math.min(1, (nowTs - startTs) / durationMs);
      // 彈性展開曲線 (easeOutBack 微幅回彈)
      const c1 = 1.35;
      const c3 = c1 + 1;
      const ease = 1 + c3 * Math.pow(rawT - 1, 3) + c1 * Math.pow(rawT - 1, 2);

      this.drawHexRatingCanvas(canvas, curHex, ghostHex, Math.max(0, ease));

      if (!stampPopped && rawT >= 0.65 && stampEl) {
        stampPopped = true;
        stampEl.style.opacity = "1";
        stampEl.style.transform = "scale(1) rotate(-6deg)";
        if (typeof SoundFX !== "undefined") {
          SoundFX.play(rank === "MASTER" || rank === "S+" ? "shiny" : "levelup");
        }
      }

      if (rawT < 1) {
        this._hexRadarRaf = requestAnimationFrame(tick);
      } else {
        this._hexRadarRaf = null;
        this.drawHexRatingCanvas(canvas, curHex, ghostHex, 1.0);
      }
    };
    this._hexRadarRaf = requestAnimationFrame(tick);
  },

  drawHexRatingCanvas(canvas, curHex, ghostHex, progress = 1.0) {
    const w = canvas.width = 320;
    const h = canvas.height = 230;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, w, h);

    const cx = w * 0.5;
    const cy = h * 0.51;
    const maxR = 76;
    const axes = [
      { key: "atk", label: "火力" },
      { key: "sur", label: "生存" },
      { key: "spd", label: "效率" },
      { key: "tac", label: "戰術" },
      { key: "bld", label: "成型" },
      { key: "eco", label: "破界" }
    ];

    const ptAt = (idx, ratio) => {
      const ang = -Math.PI / 2 + (idx * Math.PI * 2) / 6;
      return {
        x: cx + Math.cos(ang) * maxR * ratio,
        y: cy + Math.sin(ang) * maxR * ratio,
        ang
      };
    };

    const isDarkTheme = document.body.classList.contains("theme-dark-gold");

    // 1. 4 層六角同心網格與軸線（雙主題自適應高對比）
    [0.25, 0.50, 0.75, 1.0].forEach((lv, ringIdx) => {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const pt = ptAt(i, lv);
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      }
      ctx.closePath();
      if (isDarkTheme) {
        ctx.fillStyle = ringIdx === 3 ? "rgba(15, 23, 42, 0.72)" : "rgba(30, 41, 59, 0.25)";
        ctx.strokeStyle = ringIdx === 3 ? "rgba(148, 163, 184, 0.55)" : "rgba(100, 116, 139, 0.30)";
      } else {
        ctx.fillStyle = ringIdx === 3 ? "rgba(226, 232, 240, 0.68)" : "rgba(241, 245, 249, 0.45)";
        ctx.strokeStyle = ringIdx === 3 ? "rgba(100, 116, 139, 0.70)" : "rgba(148, 163, 184, 0.45)";
      }
      ctx.fill();
      ctx.lineWidth = ringIdx === 3 ? 1.5 : 1;
      ctx.stroke();
    });

    ctx.strokeStyle = isDarkTheme ? "rgba(100, 116, 139, 0.35)" : "rgba(148, 163, 184, 0.50)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      const pt = ptAt(i, 1.0);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(pt.x, pt.y);
      ctx.stroke();
    }

    // 2. 歷史最佳虛線疊影（Ghost Overlay）
    if (ghostHex) {
      ctx.save();
      ctx.beginPath();
      axes.forEach((ax, i) => {
        const val = Math.max(0.08, Math.min(1, (ghostHex[ax.key] || 0) / 100));
        const pt = ptAt(i, val);
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.closePath();
      ctx.fillStyle = "rgba(250, 204, 21, 0.10)";
      ctx.fill();
      ctx.strokeStyle = "rgba(250, 204, 21, 0.80)";
      ctx.lineWidth = 1.8;
      ctx.setLineDash([5, 4]);
      ctx.stroke();
      ctx.restore();
    }

    // 3. 本次六邊形實心多邊形（彈性展開動畫）
    const curPts = axes.map((ax, i) => {
      const val = Math.max(0.06, Math.min(1, ((curHex[ax.key] || 0) / 100) * progress));
      return ptAt(i, val);
    });
    const polyGrad = ctx.createRadialGradient(cx, cy, 4, cx, cy, maxR);
    polyGrad.addColorStop(0, "rgba(56, 189, 248, 0.58)");
    polyGrad.addColorStop(1, "rgba(16, 185, 129, 0.32)");

    ctx.beginPath();
    curPts.forEach((pt, i) => {
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    });
    ctx.closePath();
    ctx.fillStyle = polyGrad;
    ctx.fill();
    ctx.strokeStyle = "#38BDF8";
    ctx.lineWidth = 2.4;
    ctx.stroke();

    // 頂點發光點
    curPts.forEach((pt, i) => {
      const v = curHex[axes[i].key] || 0;
      ctx.fillStyle = v >= 90 ? "#FACC15" : "#E0F2FE";
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, v >= 90 ? 4.2 : 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#0F172A";
      ctx.lineWidth = 1.2;
      ctx.stroke();
    });

    // 4. 六角標籤與實時數值
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    axes.forEach((ax, i) => {
      const v = Math.round(curHex[ax.key] || 0);
      const lblPt = ptAt(i, 1.27);
      const lx = lblPt.x + (i === 1 || i === 2 ? 12 : (i === 4 || i === 5 ? -12 : 0));
      const ly = lblPt.y + (i === 0 ? -4 : (i === 3 ? 5 : 0));
      ctx.font = "900 11px 'Noto Sans TC', sans-serif";
      ctx.fillStyle = isDarkTheme
        ? (v >= 90 ? "#FEF08A" : "#E2E8F0")
        : (v >= 90 ? "#B45309" : "#1E293B");
      ctx.fillText(`${ax.label} ${v}`, lx, ly);
    });
  },

  populateEndModalStats() {
    const fpsEl = document.getElementById("endStatFps");
    if (fpsEl) {
      const fpsVal = this.currentFps || 60;
      const mobCount = this.enemies ? this.enemies.length : 0;
      const projCount = (typeof SkillsEngine !== "undefined" && SkillsEngine.projectiles ? SkillsEngine.projectiles.length : 0) + (this.enemyProjectiles ? this.enemyProjectiles.length : 0);
      fpsEl.textContent = `${fpsVal} FPS · ${mobCount}怪 / ${projCount}彈`;
      fpsEl.className = `font-pixel text-[9px] sm:text-[10px] whitespace-nowrap text-right ${fpsVal >= 50 ? 'text-emerald-400' : (fpsVal >= 35 ? 'text-amber-300' : 'text-rose-400')}`;
    }
    document.getElementById("endStatTime").textContent = document.getElementById("hudTimer").textContent;
    const modeTag = this.isExpeditionMode
      ? ` [關都大遠征 W${(this.expeditionState && this.expeditionState.currentWave) || 1}/${(this.expeditionState && this.expeditionState.totalWaves) || 16}]`
      : (this.isArenaMode
          ? ` [1vs1 ‧ ${(this.arenaDiff && this.arenaDiff.name) || "標準試煉"}]`
          : (this.isEndlessMode ? " [無盡試煉]" : ""));
    const trShortName = (this.selectedTrainer && this.selectedTrainer.name ? this.selectedTrainer.name.split(" ")[0] : "小智");
    document.getElementById("endStatPartner").textContent = `${trShortName} & ${this.player.data.name_zh} Lv.${this.player.level}${modeTag}`;
    document.getElementById("endStatKills").textContent = this.kills;
    document.getElementById("endStatCoins").textContent = `+${this.runCoins}`;

    const dpsBox = document.getElementById("endStatDpsContainer");
    if (dpsBox) {
      const stats = this.skillDamageStats;
      const totalDmg = Object.values(stats).reduce((sum, val) => sum + val, 0) || 1;
      const sortedSkills = Object.entries(stats).sort((a, b) => b[1] - a[1]);

      const p = this.player;
      const recipeRows = p ? Object.values(p.skills).map(sk => {
        const meta = SKILLS_CATALOG[sk.id];
        if (!meta) return "";
        const reqItemMeta = meta.reqItem ? HELD_ITEMS[meta.reqItem] : null;
        const hasItem = reqItemMeta ? !!(p.heldItems && p.heldItems[reqItemMeta.id]) : true;
        return `
          <div class="flex items-center justify-between bg-slate-900/90 px-2 py-1 rounded-lg border ${sk.evolved ? 'border-amber-400' : 'border-slate-700'} text-[10px]">
            <div class="flex items-center gap-1.5 min-w-0">
              ${renderSkillIconHTML(meta, "w-4 h-4")}
              <span class="text-white font-black whitespace-nowrap">${sk.evolved ? meta.evolvedName : meta.name}</span>
              <span class="text-amber-300 font-pixel text-[8px]">Lv.${sk.level}</span>
            </div>
            <div class="flex items-center gap-1 shrink-0">
              ${sk.evolved
                ? `<span class="px-1.5 py-0.2 bg-amber-400 text-slate-950 font-black rounded text-[9px]">★ 已突破超武</span>`
                : (reqItemMeta
                    ? `<span class="text-slate-400">需</span>
                       <img src="${reqItemMeta.sprite}" class="w-3.5 h-3.5 pixel-sprite"/>
                       <span class="${hasItem ? 'text-emerald-400 font-black' : 'text-slate-400'}">${reqItemMeta.name}${hasItem ? ' ✓' : ''}</span>
                       <span class="text-amber-300 font-bold">➔ ${meta.evolvedName}</span>`
                    : `<span class="text-slate-400">Lv.10 可突破</span>`)
              }
            </div>
          </div>
        `;
      }).join("") : "";

      const activeTrait = p && p.innateTrait ? p.innateTrait : (p && typeof getPokemonInnateTrait === "function" ? getPokemonInnateTrait(p.data, p.level) : null);
      const traitBannerHtml = activeTrait ? `
        <div class="mt-2 pt-2 border-t border-slate-700/80">
          <div class="bg-slate-900/95 border border-amber-500/60 rounded-xl p-2 flex flex-col gap-0.5">
            <div class="flex items-center justify-between text-[10px]">
              <span class="font-black text-amber-300 flex items-center gap-1"><i class="fa-solid ${activeTrait.icon}"></i> 種族特性：【${activeTrait.name}】</span>
              <span class="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-200 font-pixel text-[8px]">${activeTrait.tierLabel}</span>
            </div>
            <div class="text-[10px] text-slate-300 font-bold leading-snug">${activeTrait.desc}</div>
          </div>
        </div>
      ` : "";

      const ownedHeldIds = p ? Object.keys(p.heldItems || {}).filter(id => p.heldItems[id] && HELD_ITEMS[id]) : [];
      const heldItemsHtml = ownedHeldIds.length > 0
        ? ownedHeldIds.map(itemId => {
            const hi = HELD_ITEMS[itemId];
            const reqSk = hi.skillReq && SKILLS_CATALOG[hi.skillReq] ? SKILLS_CATALOG[hi.skillReq] : null;
            return `
              <div class="bg-slate-900/90 px-2.5 py-1.5 rounded-xl border border-purple-500/50 flex items-start gap-2">
                <div class="w-7 h-7 bg-slate-800 rounded-lg border border-amber-400/70 flex items-center justify-center shrink-0 mt-0.5">
                  <img src="${hi.sprite}" class="w-5 h-5 pixel-sprite object-contain" alt="${hi.name}"/>
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <span class="font-black text-[11px] text-amber-300">${hi.name}</span>
                    ${reqSk ? `<span class="px-1.5 py-0.2 rounded bg-purple-900/80 border border-purple-400/50 text-[9px] font-bold text-purple-200">對應：${reqSk.name} ➔ ${reqSk.evolvedName}</span>` : ''}
                  </div>
                  <div class="text-[10px] text-slate-200 font-bold leading-snug mt-0.5 whitespace-normal break-words">${hi.desc}</div>
                </div>
              </div>
            `;
          }).join("")
        : `<div class="text-[10px] text-slate-400 font-bold bg-slate-900/60 px-2.5 py-1.5 rounded-lg border border-slate-700/60">尚未裝備攜帶物（可於升級三選一、友好商店或擊敗三聖鳥取得）</div>`;

      dpsBox.innerHTML = traitBannerHtml + `
        <div class="mt-2.5 pt-2 border-t border-slate-700/80">
          <div class="text-[11px] font-black text-amber-300 mb-1.5 flex items-center gap-1">
            <i class="fa-solid fa-wand-magic-sparkles text-[10px]"></i>
            <span>當前招式 ＆ 超武合成配方表</span>
          </div>
          <div class="space-y-1 mb-2.5">
            ${recipeRows}
          </div>
        </div>
        <div class="mt-2.5 pt-2 border-t border-slate-700/80">
          <div class="text-[11px] font-black text-purple-300 mb-1.5 flex items-center justify-between">
            <span class="flex items-center gap-1"><i class="fa-solid fa-toolbox text-[10px]"></i><span>已裝備攜帶物效果 (${ownedHeldIds.length}件)</span></span>
          </div>
          <div class="space-y-1.5 mb-2.5">
            ${heldItemsHtml}
          </div>
        </div>
        <div class="mt-2.5 pt-2 border-t border-slate-700/80">
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

  // ==========================================================================
  // 系統設定介面 (跨裝置怪量分流、GBA/CRT 復古濾鏡切換、傷害字體精簡、震動強度與 FPS 開關)
  // ==========================================================================
  ensureSettingsObject() {
    if (!this.saveData.settings) {
      this.saveData.settings = {
        mobCapProfile: "auto",
        screenFilter: "none",
        dmgTextMode: "crit_only",
        procNoticeMode: "icon",
        screenShake: "low",
        fourthSlotPoolMode: "affinity",
        skillAlpha: "85",
        uiTheme: "gba"
      };
    }
    if (!this.saveData.settings.uiTheme) {
      this.saveData.settings.uiTheme = "gba";
    }
    if (!this.saveData.settings.skillAlpha) {
      this.saveData.settings.skillAlpha = "85";
    } else if (this.saveData.settings.skillAlpha === "75" || this.saveData.settings.skillAlpha === "65") {
      this.saveData.settings.skillAlpha = "85";
    } else if (this.saveData.settings.skillAlpha === "45" || this.saveData.settings.skillAlpha === "40") {
      this.saveData.settings.skillAlpha = "50";
    }
    return this.saveData.settings;
  },

  applyVisualSettings() {
    const s = this.ensureSettingsObject();
    const overlay = document.getElementById("screenFilterOverlay");
    const canvas = document.getElementById("gameCanvas");
    if (overlay) {
      overlay.className = "pointer-events-none fixed inset-0 z-[15]";
      if (s.screenFilter === "gba") {
        overlay.classList.add("screen-filter-gba");
      } else if (s.screenFilter === "crt") {
        overlay.classList.add("screen-filter-crt");
      } else {
        overlay.classList.add("hidden");
      }
    }
    if (canvas) {
      canvas.classList.toggle("canvas-vivid-boost", s.screenFilter === "vivid");
    }
    if (document.body) {
      document.body.classList.toggle("theme-dark-gold", s.uiTheme === "dark_gold");
    }
  },

  openSettingsModal() {
    SoundFX.play("hit");
    this.renderSettingsModal();
    const modal = document.getElementById("settingsModal");
    if (modal) {
      modal.classList.remove("hidden");
      modal.style.display = "flex";
    }
  },

  closeSettingsModal() {
    const modal = document.getElementById("settingsModal");
    if (modal) {
      modal.classList.add("hidden");
      modal.style.display = "none";
    }
    this.saveToStorage();
  },

  updateSetting(key, val) {
    const s = this.ensureSettingsObject();
    s[key] = val;
    if (key === "mobCapProfile") {
      this.debugMobCap = 0; // 切換設定檔位時解除測試面板強制鎖定，讓設定檔位立即生效
    }
    SoundFX.play("hit");
    this.applyVisualSettings();
    this.saveToStorage();
    this.renderSettingsModal();
    const labEl = document.getElementById("skillTreeModal");
    if (labEl && !labEl.classList.contains("hidden")) {
      this.renderCenterUpgrades();
    }
  },

  resetDefaultSettings() {
    this.saveData.settings = {
      mobCapProfile: "auto",
      screenFilter: "none",
      dmgTextMode: "crit_only",
      procNoticeMode: "icon",
      screenShake: "low",
      fourthSlotPoolMode: "affinity",
      skillAlpha: "85",
      uiTheme: "gba"
    };
    this.debugMobCap = 0;
    SoundFX.play("levelup");
    this.applyVisualSettings();
    this.saveToStorage();
    this.renderSettingsModal();
  },

  renderSettingsModal() {
    const box = document.getElementById("settingsContentBox");
    if (!box) return;
    const s = this.ensureSettingsObject();
    const isMob = this.isMobileDevice ? this.isMobileDevice() : (window.innerWidth < 768);
    const deviceLabel = isMob ? "📱 手機觸控模式 (自動上限 130隻 + 1.20x 經驗補償)" : "💻 電腦寬屏模式 (自動上限 205隻)";

    const renderOptionBtn = (settingKey, val, label, sub, isRec = false) => {
      const active = s[settingKey] === val;
      return `
        <button onclick="GameApp.updateSetting('${settingKey}', '${val}')" class="p-2 rounded-xl border text-left transition-all flex flex-col justify-between ${active ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-md' : 'bg-slate-800/90 border-slate-700 text-slate-300 hover:bg-slate-800'}">
          <div class="font-black text-[11px] flex items-center justify-between gap-1">
            <span class="truncate">${label}</span>
            <span class="flex items-center gap-1 shrink-0">
              ${isRec ? '<span class="px-1 py-0.2 rounded bg-emerald-600/90 text-white text-[8px] font-black leading-tight">推薦</span>' : ''}
              ${active ? '<i class="fa-solid fa-circle-check text-amber-400 text-[10px]"></i>' : ''}
            </span>
          </div>
          ${sub ? `<div class="text-[9px] text-slate-400 mt-0.5 leading-tight">${sub}</div>` : ''}
        </button>
      `;
    };

    box.innerHTML = `
      <!-- 0. 全局介面主題風格切換 (v7.5.5) -->
      <div class="bg-slate-950/70 p-3 rounded-2xl border border-amber-500/50 space-y-2">
        <div class="flex items-center justify-between">
          <span class="font-black text-amber-300 flex items-center gap-1.5"><i class="fa-solid fa-palette"></i> 全局介面主題風格</span>
          <span class="text-[10px] font-bold text-emerald-400">即時切換生效</span>
        </div>
        <div class="grid grid-cols-2 gap-1.5">
          ${renderOptionBtn("uiTheme", "gba", "🎮 經典 GBA 掌機風", "明亮白卡＋深藍描邊", true)}
          ${renderOptionBtn("uiTheme", "dark_gold", "✨ 深藍黑金戰術風", "全介面統一深色護眼")}
        </div>
      </div>

      <!-- 1. 跨裝置怪量與效能分流 -->
      <div class="bg-slate-950/70 p-3 rounded-2xl border border-slate-800 space-y-2">
        <div class="flex items-center justify-between">
          <span class="font-black text-amber-300 flex items-center gap-1.5"><i class="fa-solid fa-microchip"></i> 同屏怪量與效能分流</span>
          <span class="text-[10px] font-bold text-sky-400">${isMob ? '當前：手機端' : '當前：電腦端'}</span>
        </div>
        <div class="text-[10px] text-slate-400 leading-relaxed">${deviceLabel}</div>
        <div class="grid grid-cols-2 gap-1.5">
          ${renderOptionBtn("mobCapProfile", "auto", "🤖 自動依裝置", "手機130 / 電腦205，防發燙", true)}
          ${renderOptionBtn("mobCapProfile", "low", "⚡ 省電流暢 (100隻)", "穩鎖60幀 + 1.22x經驗")}
          ${renderOptionBtn("mobCapProfile", "standard", "⚔️ 標準密度 (160隻)", "均衡怪潮與流暢度")}
          ${renderOptionBtn("mobCapProfile", "extreme", "🔥 狂暴怪海 (250隻)", "極限高壓割草挑戰")}
        </div>
      </div>

      <!-- 2. 畫面視覺濾鏡 (0 FPS 損耗 CSS 硬體加速) -->
      <div class="bg-slate-950/70 p-3 rounded-2xl border border-slate-800 space-y-2">
        <div class="flex items-center justify-between">
          <span class="font-black text-amber-300 flex items-center gap-1.5"><i class="fa-solid fa-tv"></i> 畫面視覺濾鏡 (零效能損耗)</span>
        </div>
        <div class="grid grid-cols-2 gap-1.5">
          ${renderOptionBtn("screenFilter", "none", "✨ 現代高清", "清晰銳利，最利閃彈", true)}
          ${renderOptionBtn("screenFilter", "gba", "🎮 GBA 液晶網格", "懷舊掌機晶格質感")}
          ${renderOptionBtn("screenFilter", "crt", "📺 CRT 街機掃描線", "復古映像管暗角氛圍")}
          ${renderOptionBtn("screenFilter", "vivid", "🌈 鮮豔街機模式", "強化超武色彩對比度")}
        </div>
      </div>

      <!-- 2B. 我方技能特效透明度 (分層透明，敵方攻擊永遠 100% 清晰) -->
      <div class="bg-slate-950/70 p-3 rounded-2xl border border-slate-800 space-y-2">
        <div class="flex items-center justify-between">
          <span class="font-black text-amber-300 flex items-center gap-1.5"><i class="fa-solid fa-eye"></i> 我方技能特效透明度 (敵彈恆為100%)</span>
        </div>
        <div class="grid grid-cols-3 gap-1.5">
          ${renderOptionBtn("skillAlpha", "100", "🔥 100% 華麗", "完整特效張力")}
          ${renderOptionBtn("skillAlpha", "85", "✨ 85% 平衡", "細節銳利兼顧閃彈", true)}
          ${renderOptionBtn("skillAlpha", "50", "🎯 50% 極淨", "無盡深淵專注走位")}
        </div>
      </div>

      <!-- 3. 浮動傷害數字顯示模式 -->
      <div class="bg-slate-950/70 p-3 rounded-2xl border border-slate-800 space-y-2">
        <div class="flex items-center justify-between">
          <span class="font-black text-amber-300 flex items-center gap-1.5"><i class="fa-solid fa-font"></i> 傷害跳字顯示 (後期流暢度關鍵)</span>
        </div>
        <div class="grid grid-cols-3 gap-1.5">
          ${renderOptionBtn("dmgTextMode", "all", "全部顯示", "顯示所有普通傷害")}
          ${renderOptionBtn("dmgTextMode", "crit_only", "精簡模式", "僅暴擊與克制，視野清爽", true)}
          ${renderOptionBtn("dmgTextMode", "off", "關閉傷害字", "純淨戰場零干擾")}
        </div>
      </div>

      <!-- 3B. 攜帶物與被動觸發提示模式 -->
      <div class="bg-slate-950/70 p-3 rounded-2xl border border-slate-800 space-y-2">
        <div class="flex items-center justify-between">
          <span class="font-black text-amber-300 flex items-center gap-1.5"><i class="fa-solid fa-toolbox"></i> 攜帶物與被動提示</span>
        </div>
        <div class="grid grid-cols-3 gap-1.5">
          ${renderOptionBtn("procNoticeMode", "icon", "✨ 圖標氣泡", "頭頂輕量圖標不擋視線", true)}
          ${renderOptionBtn("procNoticeMode", "text", "📝 完整文字", "顯示詳細中文說明")}
          ${renderOptionBtn("procNoticeMode", "off", "🔇 極簡關閉", "僅留左下圖示閃光")}
        </div>
      </div>

      <!-- 3C. 第 4 招式槽抽卡偏好 (與研究所第 4 槽開關即時同步) -->
      <div class="bg-slate-950/70 p-3 rounded-2xl border border-slate-800 space-y-2">
        <div class="flex items-center justify-between gap-1">
          <span class="font-black text-amber-300 flex items-center gap-1.5"><i class="fa-solid fa-layer-group"></i> 第 4 招式槽抽卡偏好</span>
          <span class="text-[10px] font-bold ${(this.saveData && this.saveData.upgrades && this.saveData.upgrades.fourthSlot >= 1) ? 'text-emerald-400' : 'text-slate-400'}">${(this.saveData && this.saveData.upgrades && this.saveData.upgrades.fourthSlot >= 1) ? '已解鎖第 4 槽' : '研究所解鎖後生效'}</span>
        </div>
        <div class="grid grid-cols-2 gap-1.5">
          ${renderOptionBtn("fourthSlotPoolMode", "affinity", "🎯 本系與特性優先", "防卡池稀釋，穩衝超武", true)}
          ${renderOptionBtn("fourthSlotPoolMode", "all", "🎲 全系自由混搭", "全屬性招式平等隨機")}
        </div>
      </div>

      <!-- 4. 螢幕震動與頂部 FPS 監控 -->
      <div class="bg-slate-950/70 p-3 rounded-2xl border border-slate-800 space-y-2">
        <div class="flex items-center justify-between">
          <span class="font-black text-amber-300 flex items-center gap-1.5"><i class="fa-solid fa-mobile-screen-button"></i> 螢幕震動與幀率顯示</span>
        </div>
        <div class="grid grid-cols-3 gap-1.5">
          ${renderOptionBtn("screenShake", "low", "震動：柔和", "減半震幅護眼", true)}
          ${renderOptionBtn("screenShake", "normal", "震動：標準", "完整打擊震撼")}
          ${renderOptionBtn("screenShake", "off", "震動：關閉", "畫面完全靜止")}
        </div>
        <div class="pt-1 flex items-center justify-between border-t border-slate-800/80">
          <span class="text-[11px] font-bold text-slate-300">頂部常駐即時 FPS ＆ 怪量標籤：</span>
          <button onclick="GameApp.debugToggleFpsHud(); GameApp.renderSettingsModal();" class="px-3 py-1 rounded-xl font-black text-[11px] border ${this.showFpsHud ? 'bg-emerald-600 text-white border-emerald-400' : 'bg-slate-800 text-slate-400 border-slate-600'}">
            ${this.showFpsHud ? '📊 已開啟' : '已關閉'}
          </button>
        </div>
      </div>
    `;
  },

  // ==========================================================================
  // v7.1 版本更新日誌彈窗 ＆ GBA 像素風系統對話框 / Toast 提示系統
  // ==========================================================================
  openChangelogModal() {
    if (typeof SoundFX !== "undefined") SoundFX.play("hit");
    const box = document.getElementById("changelogContentBox");
    if (box) {
      box.innerHTML = `
        <div class="bg-slate-950/90 border border-amber-400/80 rounded-2xl p-3.5 space-y-2.5 shadow-[0_0_16px_rgba(250,204,21,0.22)]">
          <div class="flex items-center justify-between gap-2">
            <span class="font-black text-sm text-amber-300">🎉 關都大冒險・最新版本玩家指南</span>
            <span class="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-pixel text-[8px] font-black shrink-0">v7.6.6</span>
          </div>
          <div class="space-y-2 text-[11px] font-bold text-slate-200 leading-relaxed">
            <div class="text-emerald-300 font-black pt-0.5">🗺️ 全新玩法與內容亮點</div>
            <div>• <strong>關都大遠征 20+1（三聖鳥各歸主場）</strong>：一路闖過常磐密林、華藍海岬（<strong>急凍鳥</strong>）、無人發電廠（<strong>閃電鳥</strong>）、紅蓮火山（<strong>火焰鳥</strong>）與石英高原，最終踏入石英鬥技場決戰超夢！</div>
            <div>• <strong>兩張全新戰術生態地圖</strong>：
              <br/>　- <strong>紅蓮火山</strong>：場上有高溫熔岩池與定時噴發的地熱噴口——<strong>把怪潮引進噴口能幫你烤熟敵人</strong>，特定屬性的寶可夢甚至能無傷無阻橫渡熔岩！
              <br/>　- <strong>無人發電廠</strong>：踩上<strong>磁能加速帶</strong>能飆速又縮短冷卻；被追急了就順路撞一下<strong>高壓蓄電塔</strong>，直接引爆大範圍電磁脈衝麻痺全場！
            </div>
            <div>• <strong>關都 8 枚道館徽章</strong>：前往「道館榮譽」收集 8 枚經典道館徽章，點亮即獲得永久全隊戰力加成！</div>
            <div>• <strong>大廳「招式整備」</strong>：開局前就能自選第 1 招起手技，還能停用 1 個不想抽到的招式，自由捏出最順手的流派。</div>
            <div>• <strong>雙介面風格自由切換</strong>：系統設定可一鍵切換「經典 GBA 掌機風」與「深藍黑金戰術風」。</div>

            <div class="text-sky-300 font-black pt-1.5">⚡ 推薦探索：專屬效果與隱藏彩蛋招式</div>
            <div>• <strong>水炮（Hydro Pump）</strong>：超高壓貫穿水柱——<strong>用水箭龜施放會解鎖專屬「雙肩平行重炮」形態！</strong></div>
            <div>• <strong>電球（Electro Ball）</strong>：<strong>跑得越快、球越大越痛</strong>，飛行中還會自動抽射電弧！快搭配發電廠加速帶或疾風羽毛試試看！</div>
            <div>• <strong>毒擊（Poison Jab）</strong>：命中已中毒的敵人會觸發 <strong>+40% 毒爆</strong>，並把劇毒傳染給周圍一整片怪群！</div>
            <div>• <strong>暗影爪（Shadow Claw）</strong>：天生超高暴擊率——<strong>Mega 耿鬼使出這招會觸發專屬「猩紅冥火」暴擊強化！</strong></div>
            <div>• <strong>岩崩（Rock Slide）＆ 十字剪（X-Scissor）</strong>：高空砸石強擊退控場 vs 雙鐮破甲高暴擊，各有絕活。</div>
            <div>• <strong>撞擊（Tackle）</strong>：別小看這招起手技，升級後會解鎖多段破空震波，而且不會亂衝干擾走位！</div>

            <div class="text-amber-300 font-black pt-1.5">✨ 近期體驗與手感升級</div>
            <div>• 畫面與大廳進化圖示更加清晰銳利，大遠征過關漫步節奏與並肩站位更自然舒服，畫面震動預設為柔和護眼模式。</div>
            <div>• 難度階梯微調：「標準」更有小王對招與怪潮挑戰感，想輕鬆爽刷可選「簡易（輕鬆探索）」。</div>
          </div>
        </div>
        <div class="bg-slate-950/85 border border-amber-400/40 rounded-2xl p-3 space-y-1.5">
          <div class="font-black text-xs text-amber-300">💎 核心特色玩法一覽</div>
          <div class="space-y-1 text-[11px] font-bold text-slate-300 leading-relaxed">
            <div>• <strong>151 隻關都全圖鑑 ＆ 閃光／MEGA 進化</strong>：收集圖鑑可領賞金，局內集齊招式 Lv.10 ＋ 對應攜帶物即可突破「究極超武」，御三家與人氣神寵還能解放 <strong>💎 MEGA 超級進化</strong>！</div>
            <div>• <strong>四大模式任你挑</strong>：主線「關都大遠征 20+1」、「8 分鐘標準極速戰」、「1vs1 石英鬥技場神獸單挑」與「無盡深淵試煉」，通關即頒發六維戰術雷達評級！</div>
          </div>
        </div>
      `;
    }
    const curVer = this.APP_VERSION || "v7.6.6";
    if (this.saveData && this.saveData.lastSeenVersion !== curVer) {
      this.saveData.lastSeenVersion = curVer;
      this.saveToStorage();
    }
    const modal = document.getElementById("changelogModal");
    if (modal) {
      modal.classList.remove("hidden");
      modal.style.display = "flex";
    }
  },

  closeChangelogModal() {
    const modal = document.getElementById("changelogModal");
    if (modal) {
      modal.classList.add("hidden");
      modal.style.display = "none";
    }
    this.updateTitleUI();
  },

  pixelToast(message, tone = "info") {
    const host = document.getElementById("pixelToastContainer");
    if (!host) return;
    const toneCls = tone === "success"
      ? "border-emerald-400 text-emerald-200"
      : (tone === "warn" ? "border-rose-400 text-rose-200" : "border-amber-400 text-amber-200");
    const toast = document.createElement("div");
    toast.className = `px-3.5 py-2 rounded-2xl bg-slate-900/95 border-2 ${toneCls} text-xs font-black shadow-2xl text-center transition-all duration-200`;
    toast.textContent = message;
    host.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(-8px)";
      setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 220);
    }, 2400);
  },

  _openPixelDialog(opts) {
    const modal = document.getElementById("pixelDialogModal");
    if (!modal) return;
    const titleEl = document.getElementById("pixelDialogTitle");
    const msgEl = document.getElementById("pixelDialogMessage");
    const inputEl = document.getElementById("pixelDialogInput");
    const cancelBtn = document.getElementById("pixelDialogCancelBtn");
    const okBtn = document.getElementById("pixelDialogConfirmBtn");
    const iconEl = document.getElementById("pixelDialogIcon");

    if (titleEl) titleEl.textContent = opts.title || "系統提示";
    if (msgEl) msgEl.textContent = opts.message || "";
    if (iconEl) {
      iconEl.className = opts.mode === "confirm"
        ? "fa-solid fa-triangle-exclamation text-rose-400 text-sm"
        : (opts.mode === "prompt" ? "fa-solid fa-key text-sky-400 text-sm" : "fa-solid fa-circle-info text-amber-400 text-sm");
    }
    if (inputEl) {
      if (opts.mode === "prompt") {
        inputEl.classList.remove("hidden");
        inputEl.value = opts.defaultValue || "";
        setTimeout(() => {
          try { inputEl.focus(); inputEl.select(); } catch (e) {}
        }, 40);
      } else {
        inputEl.classList.add("hidden");
        inputEl.value = "";
      }
    }
    if (cancelBtn) cancelBtn.classList.toggle("hidden", opts.mode === "alert");
    if (okBtn) okBtn.textContent = opts.okText || (opts.mode === "confirm" ? "確定執行" : "確定");

    this._pixelDialogState = opts;
    modal.classList.remove("hidden");
    modal.style.display = "flex";
  },

  resolvePixelDialog(confirmed) {
    const modal = document.getElementById("pixelDialogModal");
    const inputEl = document.getElementById("pixelDialogInput");
    const st = this._pixelDialogState;
    this._pixelDialogState = null;
    if (modal) {
      modal.classList.add("hidden");
      modal.style.display = "none";
    }
    if (!st) return;
    if (confirmed) {
      if (st.mode === "prompt") {
        const val = inputEl ? inputEl.value : "";
        if (typeof st.onConfirm === "function") st.onConfirm(val);
      } else if (typeof st.onConfirm === "function") {
        st.onConfirm();
      }
    } else if (typeof st.onCancel === "function") {
      st.onCancel();
    }
  },

  pixelAlert(message, title = "系統提示", onOk = null) {
    this._openPixelDialog({ mode: "alert", title, message, onConfirm: onOk });
  },

  pixelConfirm(message, title = "操作確認", onConfirm = null, onCancel = null) {
    this._openPixelDialog({ mode: "confirm", title, message, onConfirm, onCancel });
  },

  pixelPrompt(message, title = "請輸入內容", defaultValue = "", onConfirm = null) {
    this._openPixelDialog({ mode: "prompt", title, message, defaultValue, onConfirm });
  },

  handleEndModalQuit() {
    if (this.state === "PAUSED") {
      this.pixelConfirm(
        "確定要放棄本局冒險並返回大廳嗎？\n（本局已收集的代幣與圖鑑進度仍會保留）",
        "返回大廳確認",
        () => this.quitToTitle()
      );
      return;
    }
    this.quitToTitle();
  },

  quitToTitle() {
    this.saveToStorage();
    if (this._hexRadarRaf) { cancelAnimationFrame(this._hexRadarRaf); this._hexRadarRaf = null; }
    this.evoSequence = null;
    this.victoryCeremony = null;
    this.bossDeathAnims = [];
    this.arenaPowerups = [];
    this.pendingMewTimer = 0;
    this.bossWeatherLock = false;
    this.battleCountdownTimer = 0;
    this._pendingEvolutionTarget = null;
    this._pauseFrameRendered = false;
    clearTimeout(this._cutInHideTimer);
    clearTimeout(this._bannerTimeout);
    if (typeof SpriteCache !== "undefined" && SpriteCache.clearVolatileCaches) {
      SpriteCache.clearVolatileCaches();
    }
    SoundFX.startBgm("lobby");
    ["endModal", "hudLayer", "levelUpModal", "eevee-evo-modal", "pokeMartModal", "expeditionModal", "cutInLayer", "setupModal"].forEach(mId => {
      const el = document.getElementById(mId);
      if (el) {
        el.classList.add("hidden");
        el.style.display = "none";
      }
    });
    if (typeof ModeExpedition !== "undefined") {
      ModeExpedition.stopRouteWalkAnim();
      ModeExpedition.dismissRegionSign();
    }
    const vsOv = document.getElementById("bossVsOverlay");
    if (vsOv) { vsOv.classList.add("hidden"); vsOv.style.display = "none"; }
    if (typeof MapEngine !== "undefined") {
      if (MapEngine.setArenaMode) MapEngine.setArenaMode(false);
      if (MapEngine.setBoundedMap) MapEngine.setBoundedMap(false);
      MapEngine.setWeather("CLEAR");
      MapEngine.lightningFlashAlpha = 0;
    }
    if (this.ctx) {
      const dpr = this.dpr || 1;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.ctx.globalAlpha = 1.0;
      this.ctx.globalCompositeOperation = "source-over";
      this.ctx.filter = "none";
    }
    const titleEl = document.getElementById("titleScreen");
    if (titleEl) {
      titleEl.classList.remove("hidden");
      titleEl.style.display = "flex";
    }
    this.state = "TITLE";
    this.updateTitleUI();
    window.scrollTo(0, 0);
    this.resize();
  },

  // ==========================================================================
  // v7.3.7 從 battle_core_2.js 解耦移入之戰鬥局內 HUD、升級三選一、友好商店與天候 UI 層
  // ==========================================================================
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

  openLevelUpModal(isFromReroll = false) {
    this.state = "PAUSED";
    // 0.45s 防誤觸鎖定期（重抽後 0.18s 短防連點），杜絕戰鬥換手或滑動時秒按錯選項或重抽
    this._levelUpUnlockAt = performance.now() + (isFromReroll ? 180 : 450);
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
              sprite: meta.sprite, skillIconMeta: meta,
              desc: meta.evoDesc,
              isNew: false,
              apply: () => {
                sk.evolved = true;
                sk.ultMaxCd = 10.0;
                sk.ultTimer = 0.4;
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
              sprite: meta.sprite, skillIconMeta: meta,
              desc: getSkillNextLevelBonusDesc(sk.id, nextLv),
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
        const banClean = p.bannedSkillId ? p.bannedSkillId.replace(/\s+/g, '') : null;
        const unlearnedNatural = (p.naturalSkills || []).filter(sId => {
          const m = SKILLS_CATALOG[sId];
          if (!m) return false;
          if (banClean && m.id.replace(/\s+/g, '') === banClean) return false;
          return !Object.values(p.skills).some(existing => existing.id === m.id || existing.id.replace(/\s+/g,'') === m.id.replace(/\s+/g,''));
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
                sprite: meta.sprite, skillIconMeta: meta,
                desc: meta.desc,
                isNew: true,
                apply: () => { const stagger = Object.keys(p.skills).length * 0.22; p.skills[meta.id] = { id: meta.id, level: 1, evolved: false, timer: 0.15 + stagger }; }
              });
            }
          });
        } else {
          // 2. 天生三招已學齊：依「第 4 招式槽抽卡偏好」決定本系與特性優先（軟鎖保底）或全系自由混搭
          const poolMode = (this.saveData && this.saveData.settings && this.saveData.settings.fourthSlotPoolMode) || "affinity";
          const traitAffinityMap = {
            heavy_slam:         ["Ground", "Rock", "Normal", "Fighting", "Fire", "Dragon"],
            quick_attack:       ["Electric", "Flying", "Bug", "Normal", "Fighting", "Psychic"],
            iron_fist:          ["Fighting", "Bug", "Ghost", "Normal", "Ground", "Rock"],
            mega_launcher:      ["Water", "Ice", "Dragon", "Psychic"],
            overgrow_thorn:     ["Grass", "Poison", "Bug"],
            dragon_maw:         ["Fire", "Dragon", "Flying", "Rock", "Ground"],
            psychic_surge:      ["Psychic", "Ghost", "Poison", "Electric"],
            legendary_pressure: ["Psychic", "Dragon", "Ice", "Electric", "Fire", "Flying", "Rock"]
          };
          const traitId = p.innateTrait ? p.innateTrait.id : "";
          const traitTypes = traitAffinityMap[traitId] || [];

          const unlearnedAll = [];
          const seenMetaNames = new Set();
          const banClean4 = p.bannedSkillId ? p.bannedSkillId.replace(/\s+/g, '') : null;
          Object.values(SKILLS_CATALOG).forEach(meta => {
            if (banClean4 && meta.id.replace(/\s+/g, '') === banClean4) return;
            const alreadyHas = Object.values(p.skills).some(existing => existing.id === meta.id || existing.id.replace(/\s+/g,'') === meta.id.replace(/\s+/g,''));
            if (!alreadyHas && meta.id !== "Metronome" && !addedKeys.has(meta.name) && !seenMetaNames.has(meta.name)) {
              seenMetaNames.add(meta.name);
              unlearnedAll.push(meta);
            }
          });

          const pushSkillChoice = (meta, weight, badgeLabel, badgeBg) => {
            addedKeys.add(meta.name);
            pool.push({
              key: meta.name,
              weight,
              rarityClass: "rarity-rare",
              badge: badgeLabel,
              badgeBg,
              title: meta.name,
              subTitle: "新領悟 Lv.1",
              typeBadge: renderTypeBadgeHTML(meta.type),
              sprite: meta.sprite, skillIconMeta: meta,
              desc: meta.desc,
              isNew: true,
              apply: () => { const stagger = Object.keys(p.skills).length * 0.22; p.skills[meta.id] = { id: meta.id, level: 1, evolved: false, timer: 0.15 + stagger }; }
            });
          };

          if (poolMode === "affinity") {
            const t1Stab = unlearnedAll.filter(m => m.type === p.data.type1 || (p.data.type2 && p.data.type2 !== "None" && m.type === p.data.type2));
            const t1Set = new Set(t1Stab.map(m => m.name));
            const t2Trait = unlearnedAll.filter(m => !t1Set.has(m.name) && traitTypes.includes(m.type));

            if (t1Stab.length > 0 || t2Trait.length > 0) {
              t1Stab.forEach(meta => pushSkillChoice(meta, 55, `本系進階 (${currentCount + 1}/${p.maxSkillSlots})`, "bg-emerald-600 text-white font-black"));
              t2Trait.forEach(meta => pushSkillChoice(meta, 35, `特性契合 (${currentCount + 1}/${p.maxSkillSlots})`, "bg-indigo-600 text-white font-black"));
            } else {
              // 軟鎖保底：若本系與特性相性招式全數已學會，自動回退全池避免空池
              unlearnedAll.forEach(meta => pushSkillChoice(meta, 15, `新招式 (${currentCount + 1}/${p.maxSkillSlots})`, "bg-blue-600 text-white font-black"));
            }
          } else {
            unlearnedAll.forEach(meta => pushSkillChoice(meta, 15, `新招式 (${currentCount + 1}/${p.maxSkillSlots})`, "bg-blue-600 text-white font-black"));
          }
        }
      }

      const ownedHeldCnt = Object.keys(p.heldItems || {}).filter(k => p.heldItems[k]).length;
      const learnedTypes = new Set(Object.values(p.skills).map(s => SKILLS_CATALOG[s.id]?.type));
      const eligibleHeld = ownedHeldCnt < 4
        ? Object.values(HELD_ITEMS).filter(hi => {
            const targetSkill = SKILLS_CATALOG[hi.skillReq];
            return targetSkill && learnedTypes.has(targetSkill.type) && !p.heldItems[hi.id];
          })
        : [];
      if (eligibleHeld.length > 0) {
        const hi = eligibleHeld[Math.floor(Math.random() * eligibleHeld.length)];
        if (!addedKeys.has(hi.name)) {
          addedKeys.add(hi.name);
          const isHighDiff = this.selectedDifficulty && (this.selectedDifficulty.id === "hard" || this.selectedDifficulty.id === "hell");
          const hasHighLvSkill = Object.values(p.skills).some(s => s.level >= 8 && !s.evolved);
          const dynamicHeldWeight = isHighDiff ? (hasHighLvSkill ? 28 : 10) : (hasHighLvSkill ? 12 : 6);
          pool.push({
            key: hi.name,
            weight: dynamicHeldWeight, rarityClass: "rarity-epic", badge: `超武攜帶物 (${ownedHeldCnt + 1}/4)`, badgeBg: "bg-purple-600 text-white font-black",
            title: hi.name, subTitle: "★ 超武突破必備", typeBadge: "", sprite: hi.sprite, desc: hi.desc,
            isNew: true,
            apply: () => { p.heldItems[hi.id] = true; p.dmgMult += 0.06; }
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
          ${renderSkillIconHTML(meta, "w-4 h-4")}
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
    const totalCoins = this.saveData ? (this.saveData.coins || 0) : (this.runCoins || 0);
    const statusHeaderBar = p ? `
      <div class="flex items-center justify-between gap-1 bg-slate-800/90 border border-slate-700 px-2.5 py-1 rounded-xl mb-2 text-[10px] font-black">
        <span class="text-emerald-400"><i class="fa-solid fa-heart-pulse"></i> HP: ${Math.ceil(p.hp)}/${p.maxHp}</span>
        <span class="text-sky-300"><i class="fa-solid fa-bolt"></i> 槽: ${curSlots}/${maxSlots}</span>
        <span class="text-purple-300"><i class="fa-solid fa-toolbox"></i> 攜帶: ${heldCount}/4</span>
        <span class="text-amber-300" title="本局獲得 ${this.runCoins} 金｜帳號總代幣 ${totalCoins.toLocaleString()} 金"><i class="fa-solid fa-coins"></i> 總 ${totalCoins.toLocaleString()}金</span>
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
      <div onclick="GameApp.selectUpgradeChoice(${idx})" class="poke-card ${c.rarityClass} cursor-pointer p-2.5 sm:p-3.5 flex items-center justify-between gap-2.5 sm:gap-3 hover:-translate-y-0.5 transition-transform relative select-none">
        ${c.isNew ? `
          <div class="absolute top-0 left-0 bg-gradient-to-r from-red-600 via-rose-500 to-amber-500 text-white font-pixel text-[9px] px-2.5 py-0.5 rounded-tl-[13px] rounded-br-lg border-b border-r border-white/80 shadow-md flex items-center gap-1 z-10 animate-pulse">
            <i class="fa-solid fa-sparkles text-[8px] text-amber-200"></i>NEW!
          </div>
        ` : ''}
        <div class="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div class="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-slate-900/40 border-2 border-slate-700 flex items-center justify-center shrink-0">
            ${c.skillIconMeta && typeof renderSkillIconHTML === "function" ? renderSkillIconHTML(c.skillIconMeta, "w-8 h-8 sm:w-9 sm:h-9") : `<img src="${c.sprite}" class="w-8 h-8 sm:w-9 sm:h-9 pixel-sprite object-contain" alt="${c.title}" />`}
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="font-black text-sm sm:text-base text-slate-800 leading-tight whitespace-nowrap">${c.title}</span>
              ${c.typeBadge || ''}
              <span class="px-2 py-0.5 rounded-full text-[9px] ${c.badgeBg} whitespace-nowrap">${c.badge}</span>
            </div>
            <p class="text-[11px] sm:text-xs font-bold text-slate-600 leading-snug mt-0.5 break-words">${c.desc}</p>
          </div>
        </div>
        <div class="flex items-center gap-1 shrink-0">
          <button type="button" class="poke-btn-red px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs font-black min-h-[36px] flex items-center gap-1 pointer-events-none">
            <span>選擇</span>
            <span class="pc-only-hotkey font-pixel text-[10px] text-amber-200 opacity-90">[${idx + 1}]</span>
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
      rerollLabelHtml = `<i class="fa-solid fa-dice text-xs"></i><span>重抽 (${freeRerolls})</span><span class="pc-only-hotkey font-pixel text-[9px] opacity-85">[R]</span>`;
    } else {
      rerollLabelHtml = `<img src="${ITEM_SPRITES.coin}" class="w-3.5 h-3.5 pixel-sprite"/><span>${coinCost}金重抽</span><span class="pc-only-hotkey font-pixel text-[9px] opacity-85">[R]</span>`;
    }

    const headerRerollSlot = document.getElementById("levelUpHeaderRerollSlot");
    if (headerRerollSlot) {
      headerRerollSlot.innerHTML = `
        <button type="button" onclick="GameApp.rerollUpgradeChoices()" ${!canReroll ? 'disabled' : ''} class="${canFreeReroll ? 'poke-btn-yellow' : (canCoinReroll ? 'poke-btn-blue' : 'poke-btn-white opacity-50 cursor-not-allowed')} px-2.5 py-1.5 text-[11px] font-black flex items-center gap-1 whitespace-nowrap shadow">
          ${rerollLabelHtml}
        </button>
      `;
    }

    const rerollErrorHtml = `
      <div id="levelUpRerollError" class="${!canReroll ? '' : 'hidden'} mt-2 px-2.5 py-1 rounded-xl bg-rose-950/80 border border-rose-500/60 text-center text-[10px] font-black text-rose-300">
        ⚠️ 總代幣不足：本次重抽需 ${coinCost} 金（目前總計 ${availableCoins.toLocaleString()} 金）
      </div>
    `;

    const rerollHintHtml = `
      <div id="levelUpRerollHint" class="pc-only-hotkey mt-2 pt-1.5 border-t border-slate-800/80 text-center text-[10px] font-bold text-slate-400">
        鍵盤提示：按 [1][2][3] 選取，[R] 鍵重抽（免費次數用完可用總代幣重抽）
      </div>
    `;

    box.innerHTML = recipeBarHtml + choicesHtml + rerollErrorHtml + rerollHintHtml;
  },

  rerollUpgradeChoices() {
    if (this._levelUpUnlockAt && performance.now() < this._levelUpUnlockAt) return;
    const freeRerolls = this.levelUpRerolls || 0;
    if (freeRerolls > 0) {
      this.levelUpRerolls -= 1;
      SoundFX.play("super");
      this.openLevelUpModal(true);
      return;
    }

    const paidCount = this.paidRerollCount || 0;
    const coinCost = 30 + paidCount * 30;
    const availableCoins = this.saveData ? (this.saveData.coins || 0) : (this.runCoins || 0);

    if (availableCoins < coinCost) {
      const errEl = document.getElementById("levelUpRerollError");
      if (errEl) {
        errEl.textContent = `⚠️ 總代幣不足：本次重抽需 ${coinCost} 金（目前總計 ${availableCoins.toLocaleString()} 金）`;
        errEl.classList.remove("hidden");
        errEl.classList.add("animate-pulse");
      }
      return;
    }

    if (this.saveData) {
      this.saveData.coins = Math.max(0, (this.saveData.coins || 0) - coinCost);
      if (this.saveToStorage) this.saveToStorage();
    }
    this.runCoins = Math.max(0, (this.runCoins || 0) - coinCost);
    this.paidRerollCount = paidCount + 1;
    SoundFX.play("super");
    this.refreshHUD();
    this.openLevelUpModal(true);
  },

  selectUpgradeChoice(idx) {
    if (this._levelUpUnlockAt && performance.now() < this._levelUpUnlockAt) return;
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
    } else if (pendingEvo === "awaken_single") {
      this.startAwakeningMoment("single");
      return;
    } else if (pendingEvo === "mega_6") {
      this.startEvolutionMoment(10034, false, null, true);
      return;
    } else if (pendingEvo === "awaken_legendary") {
      this.startAwakeningMoment("legendary");
      return;
    } else if (pendingEvo) {
      this.startEvolutionMoment(pendingEvo, false);
      return;
    }

    if ((this._deferredLevelUps || 0) > 0) {
      this._deferredLevelUps -= 1;
      this.openLevelUpModal();
      return;
    }

    if (this._pendingExpeditionIntermission && typeof ModeExpedition !== "undefined") {
      this._pendingExpeditionIntermission = false;
      ModeExpedition.openIntermissionModal(this);
      return;
    }

    this.state = "PLAYING";
  },

  showCutsceneBanner(title, subtitle, duration = 2600) {
    const b = document.getElementById("cutsceneBanner");
    document.getElementById("cutsceneTitle").textContent = title;
    document.getElementById("cutsceneSubtitle").textContent = subtitle;
    b.classList.remove("hidden");
    clearTimeout(this._bannerTimeout);
    this._bannerTimeout = setTimeout(() => b.classList.add("hidden"), duration);
  },

  // 零 ctx.filter ＆ 零管線阻塞剪影閃白渲染器：直接讀取 SpriteCache 預烘焙剪影，支援整張圖或精靈圖集單格裁切
  refreshHUD() {
    const p = this.player;
    if (!p) return;
    const tr = this.selectedTrainer;

    // 1. 頭像與屬性標籤：僅在寶可夢 ID、訓練家或時裝變更時更新 DOM 與圖片 src
    const activeTrCosHud = (typeof getResolvedTrainerCostume === "function") ? getResolvedTrainerCostume(tr, this.saveData) : tr;
    const identityKey = `${p.id}_${p.isTrainerBond ? 1 : 0}_${p.megaEvolved ? 1 : 0}_${tr.id}_${activeTrCosHud.id || "classic"}`;
    if (this._lastHudIdentityKey !== identityKey) {
      this._lastHudIdentityKey = identityKey;
      document.getElementById("hudAvatar").src = SpriteCache.resolveUrl((p.isShiny && p.data.shiny_forward_sprite) ? p.data.shiny_forward_sprite : p.data.forward_sprite);
      const isMegaHud = !!(p.megaEvolved || p.id >= 10000);
      const wasMegaHud = !!this._lastWasMegaHud;
      this._lastWasMegaHud = isMegaHud;

      const playerCardEl = document.getElementById("hudPlayerCard");
      if (playerCardEl) {
        playerCardEl.classList.toggle("mega-hud-card", isMegaHud);
        if (isMegaHud && !wasMegaHud) {
          playerCardEl.classList.remove("mega-hud-sheen");
          void playerCardEl.offsetWidth;
          playerCardEl.classList.add("mega-hud-sheen");
          setTimeout(() => playerCardEl.classList.remove("mega-hud-sheen"), 680);
        } else if (!isMegaHud) {
          playerCardEl.classList.remove("mega-hud-sheen");
        }
      }

      const avatarFrame = document.getElementById("hudAvatarFrame");
      if (avatarFrame) {
        avatarFrame.className = isMegaHud
          ? "relative w-9 h-9 sm:w-11 sm:h-11 bg-slate-950 rounded-xl border-2 border-cyan-400 shadow-[0_0_12px_rgba(56,189,248,0.85)] flex items-center justify-center shrink-0"
          : "relative w-9 h-9 sm:w-11 sm:h-11 bg-slate-800 rounded-xl border border-slate-600 flex items-center justify-center shrink-0";
      }

      const megaBadgeEl = document.getElementById("hudMegaBadge");
      if (megaBadgeEl) megaBadgeEl.classList.toggle("hidden", !isMegaHud);

      const partnerNameEl = document.getElementById("hudPartnerName");
      if (partnerNameEl) {
        partnerNameEl.textContent = p.data.name_zh;
        if (isMegaHud) {
          const megaThemeGrads = {
            10034: "linear-gradient(90deg, #38BDF8 0%, #E0F2FE 55%, #67E8F9 100%)",
            10036: "linear-gradient(90deg, #38BDF8 0%, #FEF08A 55%, #7DD3FC 100%)",
            10033: "linear-gradient(90deg, #4ADE80 0%, #F472B6 55%, #FEF08A 100%)",
            10038: "linear-gradient(90deg, #FB7185 0%, #C084FC 55%, #F43F5E 100%)",
            10041: "linear-gradient(90deg, #F43F5E 0%, #38BDF8 55%, #FDA4AF 100%)",
            10042: "linear-gradient(90deg, #FACC15 0%, #C084FC 55%, #FDE047 100%)"
          };
          partnerNameEl.style.backgroundImage = megaThemeGrads[p.id] || "linear-gradient(90deg, #38BDF8 0%, #C084FC 55%, #FACC15 100%)";
          partnerNameEl.style.webkitBackgroundClip = "text";
          partnerNameEl.style.backgroundClip = "text";
          partnerNameEl.style.color = "transparent";
        } else {
          partnerNameEl.style.backgroundImage = "";
          partnerNameEl.style.webkitBackgroundClip = "";
          partnerNameEl.style.backgroundClip = "";
          partnerNameEl.style.color = "#FFFFFF";
        }
      }

      const hpBarMegaEl = document.getElementById("hudHpBar");
      if (hpBarMegaEl) hpBarMegaEl.classList.toggle("mega-hp-bar", isMegaHud);
      const tb = document.getElementById("hudTypeBadges");
      if (tb && typeof renderTypeBadgeHTML === "function") {
        tb.innerHTML = `${renderTypeBadgeHTML(p.data.type1)}${renderTypeBadgeHTML(p.data.type2)}`;
      }
      document.getElementById("hudAshBondBadge").classList.toggle("hidden", !p.isTrainerBond);
      document.getElementById("hudActiveTrainerImg").src = SpriteCache.resolveUrl(activeTrCosHud.sprite || tr.sprite);
      document.getElementById("hudActiveSkillName").textContent = tr.skillName;
    }

    document.getElementById("hudLevelText").textContent = `Lv.${p.level}`;
    const traitBadgeEl = document.getElementById("hudTraitBadge");
    if (traitBadgeEl) {
      if (p.innateTrait) {
        const hasCrownShield = (p.id === 149 || (p.id >= 144 && p.id <= 151));
        const shieldHtml = hasCrownShield
          ? (p.multiscaleReady
              ? `<span class="text-emerald-300 ml-0.5">[🛡️就緒]</span>`
              : `<span class="text-slate-400 ml-0.5">[${Math.ceil(p.multiscaleTimer || 0)}s]</span>`)
          : '';
        const awakenTagHtml = p.legendaryAwaken24
          ? `<span class="text-pink-300 font-black ml-0.5">★★共鳴II</span>`
          : (p.legendaryAwaken12
              ? `<span class="text-amber-300 font-black ml-0.5">★共鳴I</span>`
              : (p.singleStageAwakened ? `<span class="text-sky-300 font-black ml-0.5">★覺醒</span>` : ''));
        const awakenKey = p.legendaryAwaken24 ? 'L2' : (p.legendaryAwaken12 ? 'L1' : (p.singleStageAwakened ? 'S1' : '0'));
        const underdogTagHtml = (p.underdogExpBonus > 0) ? `<span class="text-emerald-300 font-black ml-0.5">🌱+${Math.round(p.underdogExpBonus * 100)}%EXP</span>` : '';
        const nextBadgeKey = `${p.innateTrait.id}_${p.innateTrait.tier}_${awakenKey}_${p.underdogExpBonus || 0}_${hasCrownShield ? (p.multiscaleReady ? 'R' : Math.ceil(p.multiscaleTimer || 0)) : ''}`;
        if (this._lastTraitBadgeKey !== nextBadgeKey) {
          this._lastTraitBadgeKey = nextBadgeKey;
          traitBadgeEl.innerHTML = `<i class="fa-solid ${p.innateTrait.icon} text-[8px]"></i><span>${p.innateTrait.name}</span>${awakenTagHtml}${underdogTagHtml}${shieldHtml}`;
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

    const waveRemBadge = document.getElementById("hudWaveRemainBadge");
    if (this.isExpeditionMode && this.expeditionState) {
      const est = this.expeditionState;
      const totW = est.totalWaves || est.plan.length;
      const wCfg = est.plan[est.currentWave - 1];
      document.getElementById("hudTimer").textContent = `W${est.currentWave}/${totW}`;
      if (waveRemBadge) {
        waveRemBadge.classList.remove("hidden");
        if (wCfg && wCfg.isBossWave) {
          waveRemBadge.textContent = "BOSS";
          waveRemBadge.className = "px-1 py-0.2 rounded bg-rose-600 text-white font-pixel text-[7px] font-black";
        } else {
          const rem = Math.max(0, (est.killQuota || 0) - (est.killsInWave || 0));
          waveRemBadge.textContent = `剩${rem}`;
          waveRemBadge.className = "px-1 py-0.2 rounded bg-emerald-700 text-emerald-100 font-black text-[8px]";
        }
      }
    } else {
      if (waveRemBadge) waveRemBadge.classList.add("hidden");
      const mins = String(Math.floor(this.runTime / 60)).padStart(2, "0");
      const secs = String(Math.floor(this.runTime % 60)).padStart(2, "0");
      document.getElementById("hudTimer").textContent = `${mins}:${secs}`;
    }
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
            <div data-held-id="${itemId}" class="w-6 h-6 bg-slate-900/80 rounded-lg border border-amber-400/80 flex items-center justify-center p-0.5 shadow transition-transform" title="${itemMeta.name}">
              <img src="${itemMeta.sprite}" class="w-4 h-4 pixel-sprite object-contain"/>
            </div>
          ` : '';
        }).join("");
      }
    }

    const skillKey = Object.values(p.skills).map(sk => `${sk.id}:${sk.level}:${sk.evolved ? ('1:' + Math.ceil(sk.ultTimer || 0)) : '0'}`).join(",");
    if (this._lastHudSkillKey !== skillKey) {
      this._lastHudSkillKey = skillKey;
      document.getElementById("hudSkillList").innerHTML = Object.values(p.skills).map(sk => {
        const meta = SKILLS_CATALOG[sk.id];
        if (!meta) return "";
        if (sk.evolved) {
          const maxCd = sk.ultMaxCd || 10.0;
          const remSec = Math.max(0, Math.ceil(sk.ultTimer || 0));
          const pct = Math.max(0, Math.min(100, Math.round((1 - (sk.ultTimer || 0) / maxCd) * 100)));
          const cdBadge = remSec <= 0
            ? `<span class="text-emerald-300 font-black text-[8px] ml-0.5 animate-pulse">⚡就緒</span>`
            : `<span class="text-amber-200 font-pixel text-[8px] ml-0.5">${remSec}s</span>`;
          return `<span style="background: #221604; border: 1.5px solid #FFD700; color: #FFD700; box-shadow: 0 0 10px rgba(255, 215, 0, 0.35);" class="relative overflow-hidden px-2.5 py-0.5 rounded-full text-[9px] font-black flex items-center gap-1"><span style="width:${pct}%; background: linear-gradient(90deg, rgba(217,119,6,0.42) 0%, rgba(250,204,21,0.52) 100%);" class="absolute inset-y-0 left-0 transition-all duration-300 pointer-events-none"></span><span class="relative z-10 flex items-center gap-1">${renderSkillIconHTML(meta, "w-4 h-4")}<span>${meta.evolvedName}</span>${cdBadge}</span></span>`;
        }
        const borderCol = TYPE_COLORS[meta.type] || "#3A8FB7";
        return `<span style="background: rgba(20, 28, 40, 0.86); border: 1.5px solid ${borderCol}; color: #FFFFFF;" class="px-2.5 py-0.5 rounded-full text-[9px] font-black flex items-center gap-1 shadow-md">${renderSkillIconHTML(meta, "w-4 h-4")}<span>${meta.name}</span><span style="color: #63E2FF;" class="font-pixel text-[8px]">L${sk.level}</span></span>`;
      }).join("");
    }

    const btnMode = (p.buffTimer > 0 || p.shieldTimer > 0) ? "active" : (p.trainerSkillCd > 0 ? "cd" : "ready");
    const btnRemain = btnMode === "active" ? Math.ceil(p.buffTimer || p.shieldTimer) : (btnMode === "cd" ? Math.ceil(p.trainerSkillCd) : 0);
    const btnStateKey = `${btnMode}_${btnRemain}`;
    if (this._lastHudBtnStateKey !== btnStateKey) {
      this._lastHudBtnStateKey = btnStateKey;
      const btnEl = document.getElementById("btnTrainerActiveSkill");
      const cdOverlay = document.getElementById("trainerSkillCdOverlay");
      const cdText = document.getElementById("trainerSkillCdText");
      const cdSub = document.getElementById("trainerSkillStatusSub");
      if (btnMode === "active") {
        btnEl.className = "tactical-btn-active relative w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-emerald-500 border-3 border-emerald-400 flex items-center justify-center overflow-hidden shadow-xl";
        cdOverlay.className = "absolute inset-0 bg-emerald-950/70 flex flex-col items-center justify-center text-white";
        cdText.textContent = `${btnRemain}s`;
        cdText.className = "font-pixel text-xs text-emerald-300";
        cdSub.textContent = "生效中";
      } else if (btnMode === "cd") {
        btnEl.className = "relative w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-slate-800 border-3 border-slate-700 flex items-center justify-center overflow-hidden opacity-90 shadow-xl";
        cdOverlay.className = "absolute inset-0 bg-slate-950/85 flex flex-col items-center justify-center text-white";
        cdText.textContent = `${btnRemain}s`;
        cdText.className = "font-pixel text-xs text-amber-300";
        cdSub.textContent = "冷卻中";
      } else {
        btnEl.className = "tactical-btn-ready relative w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-gradient-to-b from-amber-300 via-amber-400 to-orange-500 border-3 border-slate-900 flex items-center justify-center overflow-hidden active:scale-90 transition-transform shadow-xl";
        cdOverlay.className = "hidden absolute inset-0";
      }
    }

    const dashWrap = document.getElementById("btnArenaDashWrap");
    if (dashWrap) {
      dashWrap.classList.toggle("hidden", !this.isArenaMode);
      if (this.isArenaMode) {
        const dashRem = Math.max(0, p.arenaDashCd || 0);
        const dashKey = dashRem > 0 ? `cd_${dashRem.toFixed(1)}` : "ready";
        if (this._lastArenaDashHudKey !== dashKey) {
          this._lastArenaDashHudKey = dashKey;
          const dBtn = document.getElementById("btnArenaDashSkill");
          const dOv = document.getElementById("arenaDashCdOverlay");
          const dTxt = document.getElementById("arenaDashCdText");
          if (dashRem > 0) {
            if (dBtn) dBtn.className = "relative w-14 h-14 sm:w-15 sm:h-15 rounded-full bg-slate-800 border-[3px] border-slate-600 flex items-center justify-center overflow-hidden opacity-85 shadow-xl";
            if (dOv) dOv.classList.remove("hidden");
            if (dTxt) dTxt.textContent = `${dashRem.toFixed(1)}s`;
          } else {
            if (dBtn) dBtn.className = "relative w-14 h-14 sm:w-15 sm:h-15 rounded-full bg-gradient-to-br from-sky-400 via-cyan-500 to-blue-600 border-[3px] border-white flex items-center justify-center overflow-hidden active:scale-90 transition-transform shadow-[0_0_16px_rgba(56,189,248,0.8)]";
            if (dOv) dOv.classList.add("hidden");
          }
        }
      }
    }

    if (!p.megaEvolved && !p.megaReady) {
      this.checkMegaEvolutionReady();
    }
    const megaWrapEl = document.getElementById("btnManualMegaWrap");
    if (megaWrapEl) {
      const mSt = this.getMegaEvolutionStatus();
      if (!mSt || p.megaEvolved) {
        megaWrapEl.classList.add("hidden");
      } else {
        megaWrapEl.classList.remove("hidden");
        const megaBtn = document.getElementById("btnManualMegaSkill");
        const megaImg = document.getElementById("hudManualMegaImg");
        const megaOv = document.getElementById("megaSkillCdOverlay");
        const megaIcon = document.getElementById("megaSkillStatusIcon");
        const megaSub = document.getElementById("megaSkillStatusSub");
        const megaLbl = document.getElementById("hudManualMegaLabel");
        const mKey = `${mSt.mf.id}_${mSt.hasRing ? 1 : 0}_${p.megaReady ? 1 : 0}_${mSt.curLv}_${mSt.skillSum}`;
        if (this._lastMegaHudKey !== mKey) {
          this._lastMegaHudKey = mKey;
          if (megaImg && mSt.mf.stoneSprite) megaImg.src = SpriteCache.resolveUrl(mSt.mf.stoneSprite);
          if (p.megaReady) {
            if (megaBtn) megaBtn.className = "mega-btn-ready relative w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-cyan-400 via-blue-600 to-purple-700 border-[3px] border-cyan-200 flex items-center justify-center overflow-hidden active:scale-90 transition-transform shadow-2xl";
            if (megaImg) megaImg.className = "w-9 h-9 sm:w-10 sm:h-10 pixel-sprite object-contain drop-shadow-[0_0_8px_rgba(255,255,255,0.95)]";
            if (megaOv) megaOv.classList.add("hidden");
            if (megaLbl) {
              megaLbl.textContent = "💎 MEGA";
              megaLbl.className = "mt-1 px-2 py-0.5 rounded-full bg-slate-950/95 border border-cyan-400 text-cyan-200 font-black text-[9px] whitespace-nowrap shadow-md leading-tight";
            }
          } else if (!mSt.hasRing) {
            if (megaBtn) megaBtn.className = "relative w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-slate-900/90 border-[3px] border-slate-700 flex items-center justify-center overflow-hidden opacity-75 shadow-xl";
            if (megaImg) megaImg.className = "w-9 h-9 sm:w-10 sm:h-10 pixel-sprite object-contain grayscale opacity-55";
            if (megaOv) megaOv.classList.remove("hidden");
            if (megaIcon) megaIcon.textContent = "🔒";
            if (megaSub) megaSub.textContent = "手環";
            if (megaLbl) {
              megaLbl.textContent = "🔒 需手環";
              megaLbl.className = "mt-1 px-2 py-0.5 rounded-full bg-slate-950/90 border border-slate-600 text-slate-400 font-black text-[9px] whitespace-nowrap shadow-md leading-tight";
            }
          } else {
            if (megaBtn) megaBtn.className = "relative w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-slate-800/90 border-[3px] border-slate-600 flex items-center justify-center overflow-hidden opacity-85 shadow-xl";
            if (megaImg) megaImg.className = "w-9 h-9 sm:w-10 sm:h-10 pixel-sprite object-contain grayscale opacity-65";
            if (megaOv) megaOv.classList.remove("hidden");
            const lvDone = mSt.isFinalForm && mSt.curLv >= mSt.reqLv;
            if (megaIcon) megaIcon.textContent = "💎";
            if (megaSub) megaSub.textContent = lvDone ? `技${mSt.skillSum}/${mSt.reqSum}` : `L${mSt.curLv}/${mSt.reqLv}`;
            if (megaLbl) {
              megaLbl.textContent = lvDone ? `招式 ${mSt.skillSum}/${mSt.reqSum}` : `Lv.${mSt.curLv}/${mSt.reqLv}`;
              megaLbl.className = "mt-1 px-2 py-0.5 rounded-full bg-slate-950/90 border border-slate-500 text-sky-300 font-black text-[9px] whitespace-nowrap shadow-md leading-tight";
            }
          }
        }
      }
    }

    const aliveBosses = this.enemies ? this.enemies.filter(b => b.isBoss && b.hp > 0) : [];
    const bossContainer = document.getElementById("bossHudContainer");
    const bossGrid = document.getElementById("bossHudGrid");
    const bossSlot2 = document.getElementById("bossHudSlot2");
    if (aliveBosses.length > 0 && bossContainer) {
      bossContainer.classList.remove("hidden");
      const b1 = aliveBosses[0];
      document.getElementById("bossHudName").textContent = `${b1.data.name_zh} (#${b1.id})`;
      document.getElementById("bossHudHpText").textContent = `${Math.max(0, Math.ceil(b1.hp))}/${b1.maxHp}`;
      document.getElementById("bossHudBar").style.width = `${Math.max(0, (b1.hp / b1.maxHp) * 100)}%`;

      if (aliveBosses.length >= 2 && bossSlot2 && bossGrid) {
        const b2 = aliveBosses[1];
        bossGrid.className = "grid grid-cols-2 gap-2";
        bossSlot2.classList.remove("hidden");
        document.getElementById("bossHudName2").textContent = `${b2.data.name_zh} (#${b2.id})`;
        document.getElementById("bossHudHpText2").textContent = `${Math.max(0, Math.ceil(b2.hp))}/${b2.maxHp}`;
        document.getElementById("bossHudBar2").style.width = `${Math.max(0, (b2.hp / b2.maxHp) * 100)}%`;
      } else if (bossSlot2 && bossGrid) {
        bossGrid.className = "grid grid-cols-1";
        bossSlot2.classList.add("hidden");
      }
    } else if (bossContainer) {
      bossContainer.classList.add("hidden");
    }
  }
});

// 統一由 DOMContentLoaded -> GameApp.init() 啟動存檔與資源預載，避免重複綁定計數器
