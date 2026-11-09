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
    if (typeof ITEM_SPRITES !== "undefined") {
      Object.values(ITEM_SPRITES).forEach(u => { if (u) urls.add(u); });
    }
    if (typeof TRAINERS !== "undefined") {
      TRAINERS.forEach(t => {
        if (t.sprite) urls.add(t.sprite);
        if (t.sprites) Object.values(t.sprites).forEach(u => { if (u) urls.add(u); });
        if (t.cutin) urls.add(t.cutin);
      });
    }
    if (typeof POKEMON_DB !== "undefined") {
      POKEMON_DB.forEach(p => {
        if (p.forward_sprite) urls.add(p.forward_sprite);
        if (p.back_sprite) urls.add(p.back_sprite);
      });
    }

    const urlList = Array.from(urls).filter(u => typeof u === "string" && u.trim().length > 0);
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
      if (bar) bar.style.width = "100%";
      if (pctEl) pctEl.textContent = "100%";
      if (statusEl) statusEl.textContent = "關都自然生態、圖鑑快取與招式引擎建構完畢！";
      setTimeout(() => {
        const preEl = document.getElementById("preloader-screen");
        const splashEl = document.getElementById("splashScreen");
        if (preEl) preEl.classList.add("hidden");
        if (splashEl) splashEl.classList.remove("hidden");
        this.state = "SPLASH";
      }, 200);
    };

    // 如果圖片列表為空，或者超過 3 秒直接強制放行，絕不卡死在 0/0！
    if (total === 0) {
      complete();
      return;
    }

    const step = () => {
      if (finished) return;
      done += 1;
      const pct = Math.min(100, Math.round((done / total) * 100));
      if (bar) bar.style.width = `${pct}%`;
      if (countEl) countEl.textContent = `${done} / ${total}`;
      if (pctEl) pctEl.textContent = `${pct}%`;
      if (done >= total) complete();
    };

    // 兜底定時器：最多 3.5 秒必定進入遊戲
    setTimeout(complete, 3500);

    urlList.forEach(url => {
      const rec = SpriteCache.get(url);
      if (!rec || rec.loaded || rec.error) {
        step();
      } else {
        const ol = rec.img.onload, oe = rec.img.onerror;
        rec.img.onload = () => { rec.loaded = true; if (ol) ol(); step(); };
        rec.img.onerror = () => { rec.error = true; if (oe) oe(); step(); };
      }
    });
  },

  enterLobbyFromSplash() {
    try {
      if (typeof SoundFX !== "undefined") {
        SoundFX.init();
        SoundFX.play("levelup");
        SoundFX.startBgm("lobby");
      }
    } catch (err) {
      console.warn("AudioContext init warning:", err);
    }

    this.state = "TITLE";
    const splashEl = document.getElementById("splashScreen");
    const titleEl = document.getElementById("titleScreen");
    const preEl = document.getElementById("preloader-screen");

    if (preEl) preEl.classList.add("hidden");
    if (splashEl) splashEl.classList.add("hidden");
    if (titleEl) {
      titleEl.style.display = "";
      titleEl.classList.remove("hidden");
    }

    try {
      this.updateTitleUI();
    } catch (e) {
      console.error("updateTitleUI error:", e);
    }
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
      lPkImg.src = p.forward_sprite;
      lPkImg.className = `w-12 h-12 sm:w-14 sm:h-14 pixel-sprite object-contain ${useShiny ? 'shiny-sprite-filter' : ''}`;
      const pNameEl = document.getElementById("lobbyPokemonName");
      if (pNameEl) pNameEl.textContent = `${p.name_zh} (#${String(p.id).padStart(3,'0')})`;
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
    const scrollArea = document.querySelector("#setupModal .overflow-y-auto");
    if (scrollArea) scrollArea.scrollTop = 0;
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

    const pBox = document.getElementById("wizardStep2");
    const bondSet = new Set(this.selectedTrainer.bondPokemonIds || []);

    const baseFormPokemon = POKEMON_DB.filter(p => {
      // 排除伊布的分支進化型 (水伊布 134, 雷伊布 135, 火伊布 136)
      if (p.id === 134 || p.id === 135 || p.id === 136) return false;
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

      const seen = !!this.saveData.pokedexSeen[p.id];
      return `
        <div onclick="GameApp.handlePokemonCardClick(${p.id}, ${unlockCost})" class="poke-card cursor-pointer p-3 flex flex-col justify-between ${selected ? 'selected' : ''} ${isBond ? 'border-amber-400 bg-amber-50/30' : ''} ${!unlocked ? 'opacity-85 bg-slate-100' : ''} ${!seen && !unlocked ? 'opacity-65' : ''}">
          <div>
            <div class="flex items-center justify-between gap-1 mb-1">
              <span class="font-pixel text-[10px] text-slate-500">#${String(p.id).padStart(3,'0')}</span>
              ${isBond
                ? `<span class="px-1.5 py-0.5 bg-amber-400 text-slate-900 font-black text-[9px] rounded-full border border-slate-800 animate-pulse">羈絆+25%</span>`
                : `<span class="px-1.5 py-0.5 bg-slate-100 text-slate-600 font-bold text-[9px] rounded-full">${p.evo_to ? '可進化' : '單一階'}</span>`
              }
            </div>
            <div class="relative h-15 flex items-center justify-center my-1 bg-sky-50/60 rounded-xl border border-slate-200">
              <img src="${p.forward_sprite}" class="w-13 h-13 pixel-sprite object-contain ${useShiny ? 'shiny-sprite-filter' : ''} ${!seen && !unlocked ? 'brightness-0 opacity-25' : ''}" alt="${p.name_zh}" />
              ${hasShiny && (unlocked || seen) ? `
                <button onclick="event.stopPropagation(); GameApp.toggleStarterShiny(${p.id})" class="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-full text-[8px] font-black border flex items-center gap-0.5 ${useShiny ? 'bg-amber-400 text-slate-900 border-slate-900' : 'bg-white/90 text-slate-600 border-slate-400'}">
                  <img src="${ITEM_SPRITES.starPiece}" class="w-3 h-3 pixel-sprite"/>${useShiny ? '閃光中' : '切換閃光'}
                </button>
              ` : ''}
            </div>
            <div class="font-black text-xs sm:text-sm text-slate-800 text-center truncate px-0.5">${unlocked || seen ? p.name_zh : '？？？'}</div>
            <div class="flex items-center justify-center gap-0.5 my-1 flex-wrap">
              ${unlocked || seen ? (renderTypeBadgeHTML(p.type1) + renderTypeBadgeHTML(p.type2)) : '<span class="text-[9px] font-bold text-slate-400">未知屬性</span>'}
            </div>
            <div class="text-[10px] font-bold text-slate-600 bg-slate-50 p-1.5 rounded-lg border border-slate-200 space-y-0.5">
              ${unlocked || seen
                ? `<div class="flex justify-between"><span>HP:<strong>${p.hp}</strong></span><span>ATK:<strong>${p.atk}</strong></span><span>SPD:<strong>${p.speed}</strong></span></div>
                   <div class="text-blue-700 truncate">招式：${sk ? sk.name : p.skill}</div>`
                : `<div class="text-center text-slate-400 py-1 font-bold">需在野外遭遇登錄圖鑑</div>`
              }
            </div>
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
    // 要求：必須先在圖鑑中見過（在關卡中遭遇或登錄）才能購買解鎖
    if (!this.saveData.pokedexSeen[pokeId]) {
      alert("【圖鑑未登錄】此寶可夢尚未在野外遭遇！請先在冒險地圖中發現它後方可收服！");
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

  // 友好商店貨架渲染
renderMartModal(shelf) {
  document.getElementById("martCoinsDisplay").textContent = this.runCoins;
  document.getElementById("martRerollCostText").textContent = this.martRerollCost || 50;

  const box = document.getElementById("martShelfContainer");
  box.innerHTML = shelf.map((it, idx) => {
    const isTM = !!it.tmNo;
    const badgeText = isTM ? `${it.type}系` : (it.type === "buff" ? "戰鬥增益" : "特製藥劑");
    const badgeBg = isTM ? "bg-slate-700 text-amber-300" : (it.type === "buff" ? "bg-rose-900 text-rose-300" : "bg-emerald-900 text-emerald-300");
    const titleText = isTM ? `${it.tmNo} ${it.name}` : it.name;

    return `
      <div class="bg-slate-800/90 p-2.5 rounded-xl border border-slate-700 flex items-center justify-between gap-2.5">
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="w-10 h-10 bg-slate-900 rounded-lg border border-slate-600 flex items-center justify-center shrink-0">
            <img src="${it.sprite}" class="w-7 h-7 pixel-sprite object-contain" alt="${it.name}"/>
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-1.5">
              <span class="font-black text-xs text-white">${titleText}</span>
              <span class="px-1.5 py-0.2 text-[9px] font-bold rounded ${badgeBg}">${badgeText}</span>
            </div>
            <p class="text-[10px] text-slate-400 truncate mt-0.5">${it.desc}</p>
          </div>
        </div>
        <button onclick="GameApp.buyMartItem('${it.id}', ${it.cost})" class="poke-btn-yellow px-3 py-1.5 text-xs font-black shrink-0 flex items-center gap-1">
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
      const subTitle = document.querySelector("#pokeMartModal p");
      if (subTitle) {
        const oldText = subTitle.textContent;
        subTitle.textContent = "⚠️ 代幣不足！無法購買此項道具！";
        subTitle.classList.add("text-rose-400");
        setTimeout(() => {
          subTitle.textContent = oldText;
          subTitle.classList.remove("text-rose-400");
        }, 1200);
      }
      return;
    }

    this.runCoins -= cost;
    this.saveData.coins = Math.max(0, this.saveData.coins - cost);
    const p = this.player;

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
    } else {
      // 方案A：TM 招式槽位覆蓋替換機制，嚴格不超過當前上限
      const currentSkills = Object.keys(p.skills);
      const maxSlots = p.maxSkillSlots || (3 + ((this.saveData.upgrades.fourthSlot >= 1) ? 1 : 0));

      if (currentSkills.length >= maxSlots) {
        // 已滿槽：優先替換非天生招式，若皆為天生招式則替換最後一招
        let replaceKey = currentSkills.slice().reverse().find(k => !(p.naturalSkills || []).includes(k)) || currentSkills[currentSkills.length - 1];
        const oldMeta = (typeof SKILLS_CATALOG !== "undefined") ? SKILLS_CATALOG[replaceKey] : null;
        delete p.skills[replaceKey];

        p.skills[itemId] = { id: itemId, level: 1, evolved: false, timer: 0.1 };
        SoundFX.play("levelup");
        const newMeta = (typeof SKILLS_CATALOG !== "undefined") ? SKILLS_CATALOG[itemId] : null;
        this.spawnFloatingText(p.x, p.y - 25, `【${oldMeta ? oldMeta.name : replaceKey}】已替換為【${newMeta ? newMeta.name : itemId}】！`, "#38BDF8", 15);
      } else {
        // 尚未滿槽：正常習得
        p.skills[itemId] = { id: itemId, level: 1, evolved: false, timer: 0.1 };
        SoundFX.play("levelup");
        const skName = (typeof SKILLS_CATALOG !== "undefined" && SKILLS_CATALOG[itemId]) ? SKILLS_CATALOG[itemId].name : itemId;
        this.spawnFloatingText(p.x, p.y - 25, `習得【${skName}】！`, "#38BDF8", 15);
      }
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
    const endEl = document.getElementById("endModal");
    if (endEl) {
      endEl.classList.add("hidden");
      endEl.style.display = "none";
    }
    const hudEl = document.getElementById("hudLayer");
    if (hudEl) {
      hudEl.classList.add("hidden");
      hudEl.style.display = "none";
    }
    const titleEl = document.getElementById("titleScreen");
    if (titleEl) {
      titleEl.classList.remove("hidden");
      titleEl.style.display = "flex";
    }
    this.state = "TITLE";
    this.updateTitleUI();
  }
});

// 確保 game_ui.js 掛載完畢後，立即啟動存檔載入、UI刷新與資源預載！
if (window.GameApp) {
  if (window.GameApp.loadSaveData) window.GameApp.loadSaveData();
  if (window.GameApp.updateTitleUI) window.GameApp.updateTitleUI();
  if (window.GameApp.runAssetPreloader) window.GameApp.runAssetPreloader();
}
