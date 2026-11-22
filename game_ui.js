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
  selectedGameMode: "standard",
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
          claimedAch: { ...(parsed.claimedAch || {}) },
          settings: {
            mobCapProfile: "auto",
            screenFilter: "none",
            dmgTextMode: "all",
            procNoticeMode: "icon",
            screenShake: "normal",
            ...(this.saveData.settings || {}),
            ...(parsed.settings || {})
          }
        };
      }
    } catch (e) {}
    this.applyVisualSettings();
  },

  saveToStorage() {
    try {
      localStorage.setItem("POKEMON_ADV_SURVIVORS_V4", JSON.stringify(this.saveData));
    } catch (e) {}
    this.updateTitleUI();
  },

  runAssetPreloader() {
    const priorityUrls = new Set(["images/logo_title.png", "images/skills_icons_sheet.png"]);
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
      alert(this.debugToolsUnlocked
        ? "🔧 測試工具已解鎖（防 F12 保護亦已暫時解除）！後續進入遊戲後，右上方將顯示測試齒輪按鈕。"
        : "🔒 測試工具已重新隱藏，防 F12 保護已恢復。");
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
      lTrImg.src = t.sprite;
      const tNameEl = document.getElementById("lobbyTrainerName");
      if (tNameEl) tNameEl.textContent = t.name;
    }
    if (lPkImg && p) {
      lPkImg.src = SpriteCache.resolveUrl((useShiny && p.shiny_forward_sprite) ? p.shiny_forward_sprite : p.forward_sprite);
      lPkImg.className = "w-12 h-12 sm:w-14 sm:h-14 pixel-sprite object-contain";
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
                ${v134 ? `<img src="${v134.forward_sprite}" title="${s134 ? v134.name_zh : '???'}" class="w-5 h-5 pixel-sprite ${s134 ? '' : 'brightness-0 opacity-30'}"/>` : ''}
                ${v135 ? `<img src="${v135.forward_sprite}" title="${s135 ? v135.name_zh : '???'}" class="w-5 h-5 pixel-sprite ${s135 ? '' : 'brightness-0 opacity-30'}"/>` : ''}
                ${v136 ? `<img src="${v136.forward_sprite}" title="${s136 ? v136.name_zh : '???'}" class="w-5 h-5 pixel-sprite ${s136 ? '' : 'brightness-0 opacity-30'}"/>` : ''}
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
            const arrowHtml = idx > 0 ? `<span class="text-[9px] font-black text-amber-600 shrink-0">➔ Lv.${prevLv}</span>` : '';
            return `
              ${arrowHtml}
              <div class="flex items-center gap-0.5 bg-white px-1.5 py-0.5 rounded-lg border ${idx === chain.length - 1 ? 'border-amber-400 bg-amber-50/40' : 'border-slate-300'} shrink-0">
                <img src="${stPoke.forward_sprite}" class="w-5 h-5 pixel-sprite object-contain ${isKnown ? '' : 'brightness-0 opacity-25'}" alt="${isKnown ? stPoke.name_zh : '???'}"/>
                <span class="text-[9px] font-black ${isKnown ? 'text-slate-800' : 'text-slate-400'}">${isKnown ? stPoke.name_zh : '???'}</span>
              </div>
            `;
          }).join("");
          const lastPoke = chain[chain.length - 1];
          const megaFormLobby = (lastPoke && typeof MEGA_FORMS !== "undefined") ? MEGA_FORMS[lastPoke.id] : null;
          let megaStepHtml = "";
          if (megaFormLobby) {
            const isMegaKnown = !!(this.saveData.megaUnlocked && this.saveData.megaUnlocked[megaFormLobby.baseId]);
            megaStepHtml = `
              <span class="text-[9px] font-black text-cyan-600 shrink-0">➔ 💎</span>
              <div onclick="event.stopPropagation(); GameApp.openMegaInfoModal(${megaFormLobby.baseId})" class="flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg border shrink-0 cursor-pointer ${isMegaKnown ? 'border-cyan-400 bg-sky-50' : 'border-purple-400 bg-purple-50'}">
                <img src="${megaFormLobby.forward_sprite}" class="w-5 h-5 pixel-sprite object-contain ${isMegaKnown ? '' : 'brightness-0 opacity-40'}" alt="MEGA"/>
                <span class="text-[9px] font-black ${isMegaKnown ? 'text-cyan-700' : 'text-purple-700'}">${isMegaKnown ? megaFormLobby.name_zh : 'MEGA ???'}</span>
              </div>
            `;
          }
          evoEl.innerHTML = `
            <span class="text-[9px] font-black text-blue-700 shrink-0"><i class="fa-solid fa-angles-up"></i> 進化鏈：</span>
            <div class="flex items-center gap-1 overflow-x-auto">${stepsHtml}${megaStepHtml}</div>
          `;
        } else {
          const isLegend = p.id >= 144;
          evoEl.innerHTML = `
            <span class="text-[9px] font-black ${isLegend ? 'text-purple-700' : 'text-emerald-700'} shrink-0">
              <i class="fa-solid fa-crown"></i> ${isLegend ? '傳說神獸王權' : '單一完全體'}：
            </span>
            <span class="text-[9px] font-bold text-slate-600 truncate">
              ${isLegend ? '天生12%霸體 ‧ 每10級神聖覺醒回血+18%體質' : 'Lv.18 潛能覺醒 (HP+35% ‧ 全傷+15% ‧ 12%霸體)'}
            </span>
          `;
        }
      }
    }

    const hasAch = typeof ACHIEVEMENTS !== "undefined" && ACHIEVEMENTS.some(a => a.check(this.saveData.stats, this.saveData) && !this.saveData.claimedAch[a.id]);
    const achBadge = document.getElementById("achClaimBadge");
    if (achBadge) achBadge.classList.toggle("hidden", !hasAch);

    const hasDexReward = typeof POKEMON_DB !== "undefined" && POKEMON_DB.some(pk => this.saveData.pokedexCaught[pk.id] && !this.saveData.pokedexRewardClaimed[pk.id]);
    const dexBadge = document.getElementById("pokedexRewardBadge");
    if (dexBadge) dexBadge.classList.toggle("hidden", !hasDexReward);
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
    const bondBadge = document.getElementById("wizardBarBondBadge");

    const hasShiny = !!(this.saveData && this.saveData.shinyUnlocked && this.saveData.shinyUnlocked[p.id]);
    const useShiny = hasShiny && !!(this.useShinyStarter && this.useShinyStarter[p.id]);
    const starLv = (this.saveData && this.saveData.pokemonStars && this.saveData.pokemonStars[p.id]) || 0;
    const isBond = (t.bondPokemonIds || []).includes(p.id);

    if (trImg) trImg.src = SpriteCache.resolveUrl(t.sprite);
    if (trName) trName.textContent = t.name.split(" ")[0];
    if (pkImg) {
      pkImg.src = SpriteCache.resolveUrl((useShiny && p.shiny_forward_sprite) ? p.shiny_forward_sprite : p.forward_sprite);
      pkImg.className = "w-6 h-6 pixel-sprite object-contain shrink-0";
    }
    if (pkName) {
      pkName.textContent = `${p.name_zh}${starLv > 0 ? ' ' + '★'.repeat(starLv) : ''}`;
    }
    if (bondBadge) {
      bondBadge.classList.toggle("hidden", !isBond);
      if (isBond) bondBadge.textContent = `★ ${t.bondName || '羈絆'} +25%`;
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

    const titles = {
      1: ["STEP 1/3：選擇隨行訓練家", "6 位訓練家皆有專屬代表精靈羈絆（傷害+25%）！底部為隱藏冠軍【赤紅】"],
      2: ["STEP 2/3：選擇出戰寶可夢", "與所選訓練家有羈絆的精靈已【自動置頂高亮】！全一階基礎精靈皆可挑選！"],
      3: ["STEP 3/3：選擇關卡、模式與難度", "先挑選 GBA 自然生態地圖，再決定標準 8 分鐘快局或無盡深淵試煉！"]
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
        return bp ? `<img src="${bp.forward_sprite}" title="${bp.name_zh}" class="w-7 h-7 pixel-sprite bg-white rounded-full border border-slate-300 p-0.5"/>` : '';
      }).join("");

      return `
        <div onclick="GameApp.handleTrainerCardClick('${t.id}')" class="poke-card cursor-pointer p-3.5 flex flex-col justify-between ${selected ? 'selected' : ''} ${!unlocked ? 'opacity-85 bg-slate-100' : ''}">
          <div>
            <div class="flex items-center gap-3 mb-2">
              <div class="w-13 h-13 rounded-2xl bg-amber-50 border-2 border-slate-800 flex items-center justify-center shrink-0">
                <img src="${t.sprite}" onerror="this.onerror=null;this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/vs-seeker.png';" class="w-11 h-11 pixel-sprite object-contain ${!unlocked && t.isHiddenRed ? 'brightness-0' : ''}" alt="${t.name}" />
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

    const curSelPoke = POKEMON_MAP.get(this.selectedStarterId) || POKEMON_MAP.get(25);
    const curSelTrait1 = (typeof getPokemonInnateTrait === "function" && curSelPoke) ? getPokemonInnateTrait(curSelPoke, 1) : null;
    const selectedTraitBannerHtml = (curSelPoke && curSelTrait1) ? `
      <div class="bg-slate-900 text-white p-2.5 rounded-2xl border-2 border-amber-400 shadow-md flex items-center justify-between gap-2.5">
        <div class="flex items-center gap-2 min-w-0">
          <img src="${curSelPoke.forward_sprite}" class="w-10 h-10 pixel-sprite object-contain bg-slate-800 rounded-xl border border-slate-600 p-0.5 shrink-0"/>
          <div class="min-w-0">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="font-black text-xs text-amber-300">${curSelPoke.name_zh}</span>
              <span class="px-1.5 py-0.2 rounded bg-amber-500/20 border border-amber-400/60 text-amber-200 text-[9px] font-black"><i class="fa-solid ${curSelTrait1.icon} mr-0.5"></i>專屬特性：${curSelTrait1.name}</span>
            </div>
            <div class="text-[10px] text-slate-200 font-bold leading-snug mt-0.5 whitespace-normal break-words">${curSelTrait1.desc}（隨局內進化階級最高強化至 200%！）</div>
          </div>
        </div>
      </div>
    ` : "";

    const prevFilterScroll = document.getElementById("wizardStep2FilterBar") ? document.getElementById("wizardStep2FilterBar").scrollLeft : 0;
    const filterBarHtml = selectedTraitBannerHtml + `
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
            ${unlocked ? `
              <div class="mt-2 flex justify-center">
                <button onclick="event.stopPropagation(); GameApp.upgradePokemonStar(${p.id})" ${starLv >= 3 ? 'disabled' : ''} class="px-2.5 py-1 rounded-full text-[9px] font-black border flex items-center justify-center gap-1 shadow-sm ${starLv >= 3 ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-slate-800 text-amber-300 border-amber-500/80 hover:bg-slate-700 active:scale-95'}">
                  <i class="fa-solid fa-crown text-[8px] text-amber-400"></i>
                  <span>${starLv >= 3 ? '★3 金冠滿星覺醒' : `王冠突破 ★${starLv + 1} (${nextStarCost}金)`}</span>
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
        <div onclick="GameApp.selectDifficulty('${d.id}')" class="poke-card cursor-pointer p-2.5 flex flex-col justify-between ${sel ? 'selected' : ''}">
          <div>
            <div class="flex items-center justify-between gap-1 mb-0.5">
              <span class="font-black text-xs text-slate-800">${d.name}</span>
              <span class="px-1.5 py-0.2 bg-amber-100 text-amber-800 font-black text-[9px] rounded-full shrink-0">${d.badge}</span>
            </div>
            <p class="text-[10px] font-bold text-slate-600 leading-snug">${d.desc}</p>
          </div>
          <div class="mt-1 text-right">
            <span class="text-[9px] font-black ${sel ? 'text-red-600' : 'text-slate-400'}">${sel ? '✓ 已選用' : '點擊切換'}</span>
          </div>
        </div>
      `;
    }).join("");

    document.getElementById("stageGrid").innerHTML = STAGES.map(st => {
      const sel = this.selectedStage.id === st.id;
      return `
        <div onclick="GameApp.selectStage('${st.id}')" class="poke-card cursor-pointer p-2.5 flex flex-col justify-between ${sel ? 'selected' : ''}">
          <div>
            <div class="flex items-center justify-between gap-1 mb-1">
              <span class="font-black text-xs text-slate-800 truncate">${st.name}</span>
              <span class="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 font-black text-[9px] rounded-full shrink-0">賞金 ${st.rewardMult}x</span>
            </div>
            <div class="w-full h-2.5 rounded-full my-1 border border-slate-700 flex overflow-hidden">
              <span style="background:${st.tileLight}" class="flex-1"></span>
              <span style="background:${st.tileDark}" class="flex-1"></span>
              <span style="background:${st.roadColor}" class="flex-1"></span>
              <span style="background:${st.waterColor}" class="flex-1"></span>
            </div>
            <div class="text-[10px] font-black text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded-md border border-indigo-200 leading-snug">${st.buffDesc}</div>
          </div>
          <div class="mt-1.5 text-right">
            <span class="text-[9px] font-black ${sel ? 'text-red-600' : 'text-slate-400'}">${sel ? '✓ 目前選用' : '點擊切換'}</span>
          </div>
        </div>
      `;
    }).join("");

    const modeGridEl = document.getElementById("gameModeGrid");
    if (modeGridEl) {
      const bestTimeSec = (this.saveData && this.saveData.stats && this.saveData.stats.bestEndlessTime) || 0;
      const bestM = String(Math.floor(bestTimeSec / 60)).padStart(2, "0");
      const bestS = String(bestTimeSec % 60).padStart(2, "0");
      const bestKills = (this.saveData && this.saveData.stats && this.saveData.stats.bestEndlessKills) || 0;
      const modes = [
        {
          id: "standard",
          name: "⏱️ 8分鐘標準",
          badge: "經典",
          badgeCls: "bg-blue-100 text-blue-800",
          desc: "5:00 三聖鳥、7:30 超夢與隱藏夢幻 #151，擊破即登冠！"
        },
        {
          id: "endless",
          name: "♾️ 無盡深淵",
          badge: "1.25x金",
          badgeCls: "bg-purple-100 text-purple-800",
          desc: `8:00 後無限神獸波次！（紀錄 ${bestM}:${bestS} / ${bestKills}斬）`
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
    // 要求：必須先在圖鑑中見過（在關卡中遭遇或登錄）才能購買解鎖
    if (!this.saveData.pokedexSeen[pokeId]) {
      alert("【圖鑑未登錄】此寶可夢尚未在野外遭遇！請先在冒險地圖中發現它後方可收服！");
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
          alert("✅ 存檔引繼碼已自動複製到剪貼簿！可在其他裝置點擊「匯入存檔」貼上還原進度。");
        }).catch(() => {
          prompt("請複製以下存檔引繼碼：", code);
        });
      } else {
        prompt("請複製以下存檔引繼碼：", code);
      }
    } catch (e) {
      alert("匯出失敗：" + e.message);
    }
  },

  importSaveDataCode() {
    const code = prompt("請貼上您先前匯出的【存檔引繼碼】：");
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
        claimedAch: { ...(parsed.claimedAch || {}) }
      };
      this.selectedTrainer = TRAINERS[0];
      this.selectedStarterId = 25;
      this.useShinyStarter = {};
      this.pokedexShowMega = {};
    this.pokedexShowShiny = {};
      this.pokedexShowShiny = {};
      this.saveToStorage();
      this.renderAchievements();
      alert("🎉 存檔引繼碼匯入成功！所有圖鑑、代幣、閃光與 Mega 進度已同步！");
    } catch (e) {
      alert("❌ 引繼碼無效或格式損毀，請確認複製完整字串！");
    }
  },

  getFreshNewbieSaveData() {
    return {
      coins: 800,
      unlockedPokemon: { 1: true, 4: true, 7: true, 10: true, 16: true, 25: true },
      unlockedTrainers: { ash: true, misty: true, brock: true },
      upgrades: { atk: 0, cd: 0, hp: 0, shiny: 0, megaRing: 0, fourthSlot: 0, rerollCount: 0, trainerCd: 0, partner: 0, greed: 0 },
      pokemonStars: {},
      stats: { totalKills: 0, evolutions: 0, superMoves: 0, birdsDefeated: 0, mewtwoDefeated: 0, mewDefeated: 0 },
      pokedexSeen: { 1: true, 4: true, 7: true, 10: true, 16: true, 25: true, 133: true },
      pokedexCaught: { 1: true, 4: true, 7: true, 10: true, 16: true, 25: true },
      pokedexRewardClaimed: {},
      shinyUnlocked: { 25: true },
      megaUnlocked: {},
      claimedAch: {},
      settings: {
        mobCapProfile: "auto",
        screenFilter: "none",
        dmgTextMode: "all",
        procNoticeMode: "icon",
        screenShake: "normal"
      }
    };
  },

  resetToNewbieSave() {
    const ok1 = confirm("⚠️ 確定要重置為【純淨新手開局存檔】嗎？\n\n建議先點擊「匯出存檔」備份你目前的進度！確定繼續重置？");
    if (!ok1) return;
    this.saveData = this.getFreshNewbieSaveData();
    this.selectedTrainer = TRAINERS[0];
    this.selectedStarterId = 25;
    this.useShinyStarter = {};
    this.pokedexShowMega = {};
    this.pokedexShowShiny = {};
    this.saveToStorage();
    this.renderAchievements();
    alert("✅ 已成功回復為純淨新手開局狀態（800 代幣、初始御三家與皮卡丘、研究所全 Lv.0、Mega 未解鎖）！");
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

  selectGameMode(modeId) {
    this.selectedGameMode = modeId;
    SoundFX.play("hit");
    this.renderWizardContent();
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
        alert(`代幣不足！目前已勾選補給加上此項共需 ${newTotal} 代幣（目前持有 ${this.saveData.coins || 0} 金）！`);
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
    SoundFX.play("levelup");
    this.saveToStorage();
    this.closeUnlockConfirmModal();
    this.renderWizardContent();
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
      alert(`成功領取 ${count} 隻圖鑑賞金，獲得 +${count * 50} 代幣！`);
    } else {
      alert("目前沒有可領取的圖鑑賞金！");
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
      p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * 0.45));
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
      p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * 0.30));
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
      if (eligibleHeld.length > 0) {
        const hi = eligibleHeld[Math.floor(Math.random() * eligibleHeld.length)];
        p.heldItems[hi.id] = true;
        p.dmgMult *= 1.12;
        SoundFX.play("levelup");
        this.spawnFloatingText(p.x, p.y - 25, `🎁 獲得超武攜帶物：【${hi.name}】！`, "#C084FC", 15);
      } else {
        p.dmgMult *= 1.15;
        this.spawnFloatingText(p.x, p.y - 25, "全攜帶物已齊備！全傷害額外 +15%！", "#FACC15", 14);
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
    const summaryBar = `
      <div class="bg-slate-900 text-white px-3.5 py-2.5 rounded-2xl border-2 border-amber-400 flex items-center justify-between text-xs font-black shadow">
        <span class="flex items-center gap-1.5"><i class="fa-solid fa-trophy text-amber-400"></i> 榮譽達成進度</span>
        <span class="font-pixel text-[11px] text-amber-300">${completedCount} / ${ACHIEVEMENTS.length}</span>
      </div>
    `;
    box.innerHTML = summaryBar + sorted.map(a => {
      const unlocked = a.check(this.saveData.stats, this.saveData);
      const claimed = !!this.saveData.claimedAch[a.id];
      const progPair = typeof a.progress === "function" ? a.progress(this.saveData.stats, this.saveData) : [unlocked ? 1 : 0, 1];
      const curVal = Math.min(progPair[1], progPair[0]);
      const targetVal = Math.max(1, progPair[1]);
      const pct = Math.min(100, Math.round((curVal / targetVal) * 100));
      return `
        <div class="poke-card p-3 flex items-center justify-between gap-3 ${unlocked && !claimed ? 'border-amber-400 bg-amber-50/40' : (claimed ? 'opacity-80 bg-slate-50' : '')}">
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
            ? `<button onclick="GameApp.claimAchievement('${a.id}', ${a.reward})" class="poke-btn-red px-4 py-1.5 text-xs font-black shrink-0 min-h-[38px]">領取賞金</button>`
            : `<span class="text-xs font-black ${claimed ? 'text-emerald-600' : 'text-slate-400'} shrink-0">${claimed ? '✓ 已領取' : '進行中'}</span>`
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
    const modeTag = this.isEndlessMode ? " [♾️無盡試煉]" : "";
    document.getElementById("endStatPartner").textContent = `${this.selectedTrainer.name} & ${this.player.data.name_zh} (Lv.${this.player.level})${modeTag}`;
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
        dmgTextMode: "all",
        procNoticeMode: "icon",
        screenShake: "normal"
      };
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
  },

  resetDefaultSettings() {
    this.saveData.settings = {
      mobCapProfile: "auto",
      screenFilter: "none",
      dmgTextMode: "all",
      procNoticeMode: "icon",
      screenShake: "normal"
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
    const deviceLabel = isMob ? "📱 手機觸控模式 (自動上限 120隻 + 1.22x 經驗補償)" : "💻 電腦寬屏模式 (自動上限 190隻)";

    const renderOptionBtn = (settingKey, val, label, sub) => {
      const active = s[settingKey] === val;
      return `
        <button onclick="GameApp.updateSetting('${settingKey}', '${val}')" class="p-2 rounded-xl border text-left transition-all flex flex-col justify-between ${active ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-md' : 'bg-slate-800/90 border-slate-700 text-slate-300 hover:bg-slate-800'}">
          <div class="font-black text-[11px] flex items-center justify-between">
            <span>${label}</span>
            ${active ? '<i class="fa-solid fa-circle-check text-amber-400 text-[10px]"></i>' : ''}
          </div>
          ${sub ? `<div class="text-[9px] text-slate-400 mt-0.5 leading-tight">${sub}</div>` : ''}
        </button>
      `;
    };

    box.innerHTML = `
      <!-- 1. 跨裝置怪量與效能分流 -->
      <div class="bg-slate-950/70 p-3 rounded-2xl border border-slate-800 space-y-2">
        <div class="flex items-center justify-between">
          <span class="font-black text-amber-300 flex items-center gap-1.5"><i class="fa-solid fa-microchip"></i> 同屏怪量與效能分流</span>
          <span class="text-[10px] font-bold text-sky-400">${isMob ? '當前：手機端' : '當前：電腦端'}</span>
        </div>
        <div class="text-[10px] text-slate-400 leading-relaxed">${deviceLabel}</div>
        <div class="grid grid-cols-2 gap-1.5">
          ${renderOptionBtn("mobCapProfile", "auto", "🤖 自動依裝置", "手機120 / 電腦190")}
          ${renderOptionBtn("mobCapProfile", "low", "⚡ 省電流暢 (100隻)", "穩鎖60幀 + 1.22x經驗")}
          ${renderOptionBtn("mobCapProfile", "standard", "⚔️ 標準密度 (160隻)", "平衡視覺與流暢度")}
          ${renderOptionBtn("mobCapProfile", "extreme", "🔥 狂暴怪海 (250隻)", "高壓爽快割草")}
        </div>
      </div>

      <!-- 2. 畫面視覺濾鏡 (0 FPS 損耗 CSS 硬體加速) -->
      <div class="bg-slate-950/70 p-3 rounded-2xl border border-slate-800 space-y-2">
        <div class="flex items-center justify-between">
          <span class="font-black text-amber-300 flex items-center gap-1.5"><i class="fa-solid fa-tv"></i> 畫面視覺濾鏡 (零效能損耗)</span>
        </div>
        <div class="grid grid-cols-2 gap-1.5">
          ${renderOptionBtn("screenFilter", "none", "✨ 現代高清", "原始銳利像素色彩")}
          ${renderOptionBtn("screenFilter", "gba", "🎮 GBA 液晶網格", "經典掌機晶格質感")}
          ${renderOptionBtn("screenFilter", "crt", "📺 CRT 街機掃描線", "復古映像管暗角氛圍")}
          ${renderOptionBtn("screenFilter", "vivid", "🌈 鮮豔街機模式", "強化超武色彩對比度")}
        </div>
      </div>

      <!-- 3. 浮動傷害數字顯示模式 -->
      <div class="bg-slate-950/70 p-3 rounded-2xl border border-slate-800 space-y-2">
        <div class="flex items-center justify-between">
          <span class="font-black text-amber-300 flex items-center gap-1.5"><i class="fa-solid fa-font"></i> 傷害跳字顯示 (後期流暢度關鍵)</span>
        </div>
        <div class="grid grid-cols-3 gap-1.5">
          ${renderOptionBtn("dmgTextMode", "all", "全部顯示", "所有攻擊跳字")}
          ${renderOptionBtn("dmgTextMode", "crit_only", "精簡模式", "僅暴擊與克制")}
          ${renderOptionBtn("dmgTextMode", "off", "關閉傷害字", "視野最乾淨")}
        </div>
      </div>

      <!-- 3B. 攜帶物與被動觸發提示模式 -->
      <div class="bg-slate-950/70 p-3 rounded-2xl border border-slate-800 space-y-2">
        <div class="flex items-center justify-between">
          <span class="font-black text-amber-300 flex items-center gap-1.5"><i class="fa-solid fa-toolbox"></i> 攜帶物與被動提示</span>
        </div>
        <div class="grid grid-cols-3 gap-1.5">
          ${renderOptionBtn("procNoticeMode", "icon", "✨ 圖標氣泡", "頭頂輕量圖標(推薦)")}
          ${renderOptionBtn("procNoticeMode", "text", "📝 完整文字", "詳細中文說明")}
          ${renderOptionBtn("procNoticeMode", "off", "🔇 極簡關閉", "僅留左下閃光")}
        </div>
      </div>

      <!-- 4. 螢幕震動與頂部 FPS 監控 -->
      <div class="bg-slate-950/70 p-3 rounded-2xl border border-slate-800 space-y-2">
        <div class="flex items-center justify-between">
          <span class="font-black text-amber-300 flex items-center gap-1.5"><i class="fa-solid fa-mobile-screen-button"></i> 螢幕震動與幀率顯示</span>
        </div>
        <div class="grid grid-cols-3 gap-1.5">
          ${renderOptionBtn("screenShake", "normal", "震動：標準", "100% 震撼")}
          ${renderOptionBtn("screenShake", "low", "震動：柔和", "減半不頭暈")}
          ${renderOptionBtn("screenShake", "off", "震動：關閉", "完全靜止")}
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

  quitToTitle() {
    this.saveToStorage();
    this.evoSequence = null;
    this.battleCountdownTimer = 0;
    this._pendingEvolutionTarget = null;
    this._pauseFrameRendered = false;
    clearTimeout(this._cutInHideTimer);
    clearTimeout(this._bannerTimeout);
    if (typeof SpriteCache !== "undefined" && SpriteCache.clearVolatileCaches) {
      SpriteCache.clearVolatileCaches();
    }
    SoundFX.startBgm("lobby");
    ["endModal", "hudLayer", "levelUpModal", "eevee-evo-modal", "pokeMartModal", "cutInLayer", "setupModal"].forEach(mId => {
      const el = document.getElementById(mId);
      if (el) {
        el.classList.add("hidden");
        el.style.display = "none";
      }
    });
    if (typeof MapEngine !== "undefined") {
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
  }
});

// 統一由 DOMContentLoaded -> GameApp.init() 啟動存檔與資源預載，避免重複綁定計數器
