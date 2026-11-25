/**
 * ============================================================================
 * mode_expedition.js (v7.2.8 關都大遠征 2.0：可擴充章節架構 ＋ 殲滅進度制 ＋ 火車站捲動長卷)
 * 設計重點：
 * 1. 全資料驅動 EXPEDITION_CHAPTERS（零寫死波數與章節數），支援 ModeExpedition.registerChapter()
 *    隨時追加第四章（如紅蓮火山）、第五章（如月見山／野生原野區）而無須改動引擎與 UI 程式碼。
 * 2. 常規波次採【波次殲滅進度制 (Kill Quota)】＋ 剩餘 ≤3 隻紅箭頭指引 ＋ AREA CLEAR 吸晶儀式。
 * 3. 非鬥技場波次套用中大型固定生態戰場 (1160×880) 並於波中刷新限時增益道具。
 * 4. 火車站式局部捲動 GBA 長卷路線圖（約顯示 3.5 站）＋ 訓練家與主角向右一步一步漫步動畫（非阻塞）。
 * 5. 跨區 GBA 左上路牌 ＋ 寶可夢中心 5 連音營地回復 ＋ Boss VS 對峙橫幅 ＋ 殿堂登錄紀念卡。
 * ============================================================================
 */

window.EXPEDITION_CHAPTERS = [
  {
    id: "act1_pallet",
    name: "真新鎮・常磐密林",
    shortName: "常磐密林",
    stageId: "pallet",
    isArena: false,
    signStyle: "wood",
    bounds: { halfW: 580, halfH: 440 },
    theme: { bg: "#3E6B38", accent: "#2E5229", text: "#BBF7D0", badgeBg: "#15803D", badgeLabel: "密林徽章" },
    waves: [
      {
        title: "常磐密林・外圍探索",
        subtitle: "淨空 22 隻野生蟲系與草系精靈，快速升級成型主招。",
        enemyTypes: ["Grass", "Bug", "Normal"],
        enemyPool: [10, 13, 16, 19, 43, 69],
        elitePool: [12, 15],
        previewIds: [10, 16, 43],
        killQuota: 22,
        clearBonus: 65,
        weather: "CLEAR"
      },
      {
        title: "密林深處・生態遷徙潮",
        subtitle: "擊破 28 隻飛行與毒系野生精靈，留意遠程毒針！",
        enemyTypes: ["Poison", "Flying", "Bug"],
        enemyPool: [12, 15, 17, 23, 41, 48],
        elitePool: [18, 24, 42],
        previewIds: [12, 23, 41],
        killQuota: 28,
        spawnTreasure: "meowth",
        clearBonus: 80,
        weather: "CLEAR"
      },
      {
        title: "關底・火箭隊突襲軍團",
        subtitle: "擊破阿柏怪與雙彈瓦斯雙首領即可突圍前往華藍海岬！",
        isBossWave: true,
        enemyTypes: ["Poison", "Normal"],
        enemyPool: [23, 41, 109, 19],
        bossIds: [24, 110],
        previewIds: [24, 110],
        clearBonus: 135,
        actClearHeal: 0.35,
        weather: "CLEAR"
      }
    ]
  },
  {
    id: "act2_cerulean",
    name: "華藍海岬・木棧道",
    shortName: "華藍海岬",
    stageId: "cerulean_bay",
    isArena: false,
    signStyle: "ocean",
    bounds: { halfW: 580, halfH: 440 },
    theme: { bg: "#0369A1", accent: "#38BDF8", text: "#BAE6FD", badgeBg: "#0284C7", badgeLabel: "海岬徽章" },
    waves: [
      {
        title: "華藍海岬・潮汐木棧道",
        subtitle: "淨空 34 隻海岸精靈！善用木棧道避免涉水減速。",
        enemyTypes: ["Water", "Poison", "Electric"],
        enemyPool: [54, 60, 72, 81, 98, 116],
        elitePool: [62, 73, 117],
        previewIds: [60, 72, 81],
        killQuota: 34,
        clearBonus: 95,
        weather: "RAIN"
      },
      {
        title: "暴風海峽・冰海精銳潮",
        subtitle: "擊破 40 隻水系與冰系精銳，搶奪場中增益道具！",
        enemyTypes: ["Water", "Ice", "Flying"],
        enemyPool: [86, 87, 91, 117, 120, 130],
        elitePool: [87, 91, 130],
        previewIds: [87, 91, 130],
        killQuota: 40,
        spawnTreasure: "chansey",
        clearBonus: 115,
        weather: "RAIN"
      },
      {
        title: "關底・海峽傳說神鳥",
        subtitle: "討伐海峽守護神獸，奪取進軍石英高原的通行權！",
        isBossWave: true,
        isDynamicAct2Bird: true,
        isLegendaryBoss: true,
        enemyTypes: ["Ice", "Flying"],
        enemyPool: [86, 91, 117, 120],
        bossIds: [144],
        previewIds: [144],
        clearBonus: 185,
        actClearHeal: 0.40,
        weather: "BLIZZARD"
      }
    ]
  },
  {
    id: "act3_sky_pillar",
    name: "石英高原・古神殿",
    shortName: "石英高原",
    stageId: "sky_pillar",
    isArena: false,
    signStyle: "temple",
    bounds: { halfW: 580, halfH: 440 },
    theme: { bg: "#2E2447", accent: "#6D28D9", text: "#E9D5FF", badgeBg: "#7C3AED", badgeLabel: "神殿徽章" },
    waves: [
      {
        title: "石英高原・古神殿柱廊",
        subtitle: "淨空 44 隻超能與幽靈守衛，善用大理石大道加速！",
        enemyTypes: ["Psychic", "Ghost", "Rock"],
        enemyPool: [64, 75, 93, 95, 105, 111],
        elitePool: [65, 94, 112],
        previewIds: [64, 93, 95],
        killQuota: 44,
        clearBonus: 125,
        weather: "PSYCHIC"
      },
      {
        title: "冠軍之路・遠古化石覺醒",
        subtitle: "擊破 48 隻遠古化石霸主與龍系精銳，衝刺 Lv.10 超武！",
        enemyTypes: ["Rock", "Dragon", "Fighting"],
        enemyPool: [68, 112, 139, 141, 142, 148],
        elitePool: [139, 141, 142],
        previewIds: [141, 142, 148],
        killQuota: 48,
        clearBonus: 150,
        weather: "PSYCHIC"
      },
      {
        title: "關底・烈焰鳥神殿試煉",
        subtitle: "討伐烈焰神鳥【火焰鳥】，踏入石英大會冠軍競技場！",
        isBossWave: true,
        isLegendaryBoss: true,
        enemyTypes: ["Fire", "Flying"],
        enemyPool: [59, 78, 126, 142],
        bossIds: [146],
        previewIds: [146],
        clearBonus: 220,
        actClearHeal: 0.45,
        weather: "HEATWAVE"
      }
    ]
  },
  {
    id: "final_arena",
    name: "石英大會鬥技場",
    shortName: "鬥技場",
    stageId: "sky_pillar",
    isArena: true,
    isFinalChapter: true,
    signStyle: "arena",
    bounds: null,
    theme: { bg: "#334155", accent: "#B91C1C", text: "#FDE047", badgeBg: "#D97706", badgeLabel: "冠軍徽章" },
    waves: [
      {
        title: "石英大會・終極決戰",
        subtitle: "封閉石柱競技場（[SHIFT] 閃避可用）！討伐王者【超夢】加冕遠征冠軍！",
        isBossWave: true,
        isLegendaryBoss: true,
        isFinalArena: true,
        enemyTypes: ["Psychic"],
        enemyPool: [],
        bossIds: [150],
        previewIds: [150],
        clearBonus: 450,
        weather: "PSYCHIC"
      }
    ]
  }
];

window.ModeExpedition = {
  id: "expedition",
  _walkAnimRaf: null,
  _vsSkipCallback: null,
  _regionSignTimer: null,

  // 未來追加第四章、第五章地圖的標準掛載介面（自動插入在最終鬥技場之前，全 UI 與進度自動適配）
  registerChapter(chapterObj, insertBeforeFinal = true) {
    if (!chapterObj || !Array.isArray(chapterObj.waves) || chapterObj.waves.length === 0) return;
    const list = window.EXPEDITION_CHAPTERS;
    if (list.some(c => c.id === chapterObj.id)) return;
    if (insertBeforeFinal) {
      const finalIdx = list.findIndex(c => c.isFinalChapter);
      if (finalIdx !== -1) {
        list.splice(finalIdx, 0, chapterObj);
        return;
      }
    }
    list.push(chapterObj);
  },

  getChapterSummary() {
    const chs = window.EXPEDITION_CHAPTERS || [];
    const totalWaves = chs.reduce((s, c) => s + (c.waves ? c.waves.length : 0), 0);
    return { chapterCount: chs.length, totalWaves, chapters: chs };
  },

  buildWavePlan(act2BirdId = 144) {
    const chapters = window.EXPEDITION_CHAPTERS || [];
    const plan = [];
    let waveIdx = 0;

    chapters.forEach((ch, chIdx) => {
      const actNum = chIdx + 1;
      (ch.waves || []).forEach((wDef, localIdx) => {
        waveIdx += 1;
        const entry = {
          ...wDef,
          wave: waveIdx,
          act: actNum,
          chapterIndex: chIdx,
          chapterId: ch.id,
          chapterName: ch.name,
          chapterShortName: ch.shortName,
          chapterTheme: ch.theme,
          signStyle: ch.signStyle || "wood",
          stageId: wDef.stageId || ch.stageId,
          isArena: wDef.isArena !== undefined ? wDef.isArena : !!ch.isArena,
          bounds: wDef.bounds !== undefined ? wDef.bounds : (ch.bounds || null),
          isFirstWaveOfChapter: (localIdx === 0),
          isLastWaveOfChapter: (localIdx === ch.waves.length - 1),
          isFinalChapter: !!ch.isFinalChapter
        };

        if (entry.isDynamicAct2Bird) {
          const isZapdos = act2BirdId === 145;
          const bName = isZapdos ? "閃電鳥" : "急凍鳥";
          entry.title = `關底・傳說【${bName}】降臨`;
          entry.subtitle = `擊敗海峽守護神獸【${bName}】，奪取進軍下一區域的通行權！`;
          entry.enemyTypes = isZapdos ? ["Electric", "Flying"] : ["Ice", "Flying"];
          entry.bossIds = [act2BirdId];
          entry.previewIds = [act2BirdId];
          entry.weather = isZapdos ? "THUNDER" : "BLIZZARD";
        }
        plan.push(entry);
      });
    });

    return plan;
  },

  onStart(app) {
    app.isExpeditionMode = true;
    app.isEndlessMode = false;
    app.isArenaMode = false;
    app._pendingExpeditionIntermission = false;
    app.lastExpeditionResult = null;
    app.areaClearStampTimer = 0;

    const resumeCp = app._resumeExpeditionCheckpoint || null;
    app._resumeExpeditionCheckpoint = null;

    const act2BirdId = resumeCp
      ? (resumeCp.act2BirdId || 144)
      : (Math.random() < 0.5 ? 144 : 145);

    const plan = this.buildWavePlan(act2BirdId);
    const totalWaves = plan.length;
    const startWaveNum = resumeCp
      ? Math.max(1, Math.min(totalWaves, resumeCp.nextWave || 1))
      : 1;

    app.expeditionState = {
      currentWave: startWaveNum,
      totalWaves,
      act2BirdId,
      plan,
      spawnedCount: 0,
      killsInWave: 0,
      killQuota: 0,
      spawnCd: 0.5,
      eliteSpawnedCount: 0,
      treasureSpawned: false,
      powerupSpawned: false,
      waveCleared: false,
      clearDelayTimer: 0,
      shopShelf: [],
      shopRerollCost: 40,
      pendingForgetTm: null
    };

    if (resumeCp) {
      this.applyCheckpointToRun(app, resumeCp);
    }

    this.launchWaveWithCeremony(app, startWaveNum);
  },

  applyCheckpointToRun(app, cp) {
    const p = app.player;
    if (!p || !cp || !cp.player) return;
    const sp = cp.player;
    const pData = POKEMON_MAP.get(sp.id);
    if (pData) {
      p.id = pData.id;
      p.data = pData;
    }
    p.level = sp.level || 1;
    p.exp = sp.exp || 0;
    p.nextExp = sp.nextExp || 18;
    p.maxHp = sp.maxHp || p.maxHp;
    p.hp = Math.min(p.maxHp, sp.hp || p.maxHp);
    p.baseAtk = sp.baseAtk || p.baseAtk;
    p.baseSpeed = sp.baseSpeed || p.baseSpeed;
    p.dmgMult = sp.dmgMult || p.dmgMult;
    p.cdMult = sp.cdMult || p.cdMult;
    p.speedMult = sp.speedMult || p.speedMult;
    p.areaMult = sp.areaMult || p.areaMult;
    p.critRate = sp.critRate || p.critRate;
    p.magnetRadius = sp.magnetRadius || p.magnetRadius;
    p.finalEvoArmor = sp.finalEvoArmor || 0;
    p.megaEvolved = !!sp.megaEvolved;
    p.singleStageAwakened = !!sp.singleStageAwakened;
    p.legendaryAwaken12 = !!sp.legendaryAwaken12;
    p.legendaryAwaken24 = !!sp.legendaryAwaken24;
    p.underdogExpBonus = sp.underdogExpBonus || 0;
    p.heldItems = { ...(sp.heldItems || {}) };
    if (sp.loadoutMagnetPulseTimer !== undefined) p.loadoutMagnetPulseTimer = sp.loadoutMagnetPulseTimer;
    if (sp.loadoutShinyMult) p.loadoutShinyMult = sp.loadoutShinyMult;
    if (sp.loadoutCoinMult) p.loadoutCoinMult = sp.loadoutCoinMult;
    app.activeLoadoutBuffs = { ...(cp.activeLoadoutBuffs || {}) };

    p.skills = {};
    Object.entries(sp.skills || {}).forEach(([k, sk]) => {
      p.skills[k] = {
        id: sk.id,
        level: sk.level || 1,
        evolved: !!sk.evolved,
        timer: 0.25,
        ultTimer: sk.evolved ? 2.0 : undefined,
        ultMaxCd: sk.evolved ? 10.0 : undefined
      };
    });
    if (Array.isArray(sp.naturalSkills)) p.naturalSkills = [...sp.naturalSkills];
    if (typeof getPokemonInnateTrait === "function") {
      p.innateTrait = getPokemonInnateTrait(p.data, p.level);
    }
    app.partners = [];
    (cp.partners || []).forEach(pt => {
      const ptData = POKEMON_MAP.get(pt.id);
      if (ptData) {
        app.partners.push({
          id: ptData.id, data: ptData, level: pt.level || 1,
          x: p.x, y: p.y, facingX: -1, facingY: 1, cdTimer: 0.6
        });
      }
    });
    app.kills = cp.kills || 0;
    app.runCoins = cp.runCoins || 0;
    app.runTime = cp.runTime || 0;
  },

  saveCheckpoint(app, nextWave) {
    if (!app || !app.saveData || !app.player || !app.expeditionState) return;
    const p = app.player;
    const st = app.expeditionState;
    const skillsSnap = {};
    Object.entries(p.skills || {}).forEach(([k, sk]) => {
      skillsSnap[k] = { id: sk.id, level: sk.level, evolved: !!sk.evolved };
    });
    app.saveData.expeditionCheckpoint = {
      nextWave,
      totalWaves: st.totalWaves || st.plan.length,
      act2BirdId: st.act2BirdId || 144,
      trainerId: (app.selectedTrainer && app.selectedTrainer.id) || "ash",
      starterId: app.selectedStarterId || 25,
      difficultyId: (app.selectedDifficulty && app.selectedDifficulty.id) || "normal",
      activeLoadoutBuffs: { ...(app.activeLoadoutBuffs || {}) },
      kills: app.kills || 0,
      runCoins: app.runCoins || 0,
      runTime: app.runTime || 0,
      partners: (app.partners || []).map(pt => ({ id: pt.id, level: pt.level })),
      player: {
        id: p.id, level: p.level, exp: p.exp, nextExp: p.nextExp,
        hp: Math.ceil(p.hp), maxHp: p.maxHp, baseAtk: p.baseAtk, baseSpeed: p.baseSpeed,
        dmgMult: p.dmgMult, cdMult: p.cdMult, speedMult: p.speedMult, areaMult: p.areaMult,
        critRate: p.critRate, magnetRadius: p.magnetRadius || 92,
        finalEvoArmor: p.finalEvoArmor || 0,
        megaEvolved: !!p.megaEvolved,
        singleStageAwakened: !!p.singleStageAwakened,
        legendaryAwaken12: !!p.legendaryAwaken12,
        legendaryAwaken24: !!p.legendaryAwaken24,
        underdogExpBonus: p.underdogExpBonus || 0,
        loadoutMagnetPulseTimer: p.loadoutMagnetPulseTimer,
        loadoutShinyMult: p.loadoutShinyMult || 1.0,
        loadoutCoinMult: p.loadoutCoinMult || 1.0,
        heldItems: { ...(p.heldItems || {}) },
        skills: skillsSnap,
        naturalSkills: [...(p.naturalSkills || [])]
      }
    };
    if (app.saveToStorage) app.saveToStorage();
  },

  clearCheckpoint(app) {
    if (app && app.saveData && app.saveData.expeditionCheckpoint) {
      app.saveData.expeditionCheckpoint = null;
      if (app.saveToStorage) app.saveToStorage();
    }
  },

  // 啟動波次前的儀式路由：Boss 關卡先播放 1.15s 斜切 VS 對峙橫幅（點擊可跳過）
  launchWaveWithCeremony(app, waveNum) {
    const st = app.expeditionState;
    if (!st) return;
    const cfg = st.plan[waveNum - 1];
    if (!cfg) return;

    if (cfg.isBossWave && Array.isArray(cfg.bossIds) && cfg.bossIds.length > 0) {
      this.showBossVsOverlay(app, cfg, () => this.startWave(app, waveNum));
    } else {
      this.startWave(app, waveNum);
    }
  },

  showBossVsOverlay(app, cfg, onDone) {
    const ov = document.getElementById("bossVsOverlay");
    if (!ov) {
      if (typeof onDone === "function") onDone();
      return;
    }
    app.state = "PAUSED";
    const tr = app.selectedTrainer || TRAINERS[0];
    const trCos = (typeof getResolvedTrainerCostume === "function") ? getResolvedTrainerCostume(tr, app.saveData) : tr;
    const pData = (app.player && app.player.data) || POKEMON_MAP.get(25);
    const bossId = cfg.bossIds[0];
    const bData = POKEMON_MAP.get(bossId) || POKEMON_MAP.get(150);

    const leftTrImg = document.getElementById("vsLeftTrainerImg");
    const leftPkImg = document.getElementById("vsLeftPokeImg");
    const leftName  = document.getElementById("vsLeftName");
    const rightBossImg = document.getElementById("vsRightBossImg");
    const rightName = document.getElementById("vsRightName");
    const subTag    = document.getElementById("vsSubTag");

    if (leftTrImg) leftTrImg.src = SpriteCache.resolveUrl(trCos.cutin || trCos.sprite);
    if (leftPkImg) leftPkImg.src = SpriteCache.resolveUrl(pData.forward_sprite);
    if (leftName)  leftName.textContent = `${tr.name.split(" ")[0]} ＆ ${pData.name_zh}`;
    if (rightBossImg) rightBossImg.src = SpriteCache.resolveUrl(bData.forward_sprite);
    if (rightName) rightName.textContent = cfg.bossIds.length > 1 ? `${bData.name_zh} 聯軍` : bData.name_zh;
    if (subTag) subTag.textContent = `ACT ${cfg.act} · WAVE ${cfg.wave}/${app.expeditionState.totalWaves} BOSS BATTLE`;

    ov.classList.remove("hidden");
    ov.style.display = "flex";
    SoundFX.play("boss");

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(this._vsTimer);
      this._vsSkipCallback = null;
      ov.classList.add("hidden");
      ov.style.display = "none";
      if (typeof onDone === "function") onDone();
    };
    this._vsSkipCallback = finish;
    clearTimeout(this._vsTimer);
    this._vsTimer = setTimeout(finish, 1180);
  },

  skipBossVsOverlay() {
    if (typeof this._vsSkipCallback === "function") {
      this._vsSkipCallback();
    }
  },

  showRegionSign(cfg) {
    const sign = document.getElementById("gbaRegionSign");
    if (!sign) return;
    const titleEl = document.getElementById("gbaRegionSignTitle");
    const subEl   = document.getElementById("gbaRegionSignSub");
    const styleClsMap = {
      wood:   "bg-amber-950/95 border-amber-500 text-amber-100",
      ocean:  "bg-sky-950/95 border-sky-400 text-sky-100",
      temple: "bg-purple-950/95 border-purple-400 text-purple-100",
      arena:  "bg-rose-950/95 border-amber-400 text-amber-200"
    };
    const cls = styleClsMap[cfg.signStyle] || styleClsMap.wood;
    sign.className = `absolute top-[86px] left-2 z-30 px-3 py-1.5 rounded-r-xl border-l-4 border-2 shadow-2xl cursor-pointer transition-all duration-300 pointer-events-auto ${cls}`;
    if (titleEl) titleEl.textContent = `ACT ${cfg.act} · ${cfg.chapterName}`;
    if (subEl) subEl.textContent = cfg.title;
    sign.classList.remove("hidden");

    clearTimeout(this._regionSignTimer);
    this._regionSignTimer = setTimeout(() => {
      sign.classList.add("hidden");
    }, 2200);
  },

  dismissRegionSign() {
    const sign = document.getElementById("gbaRegionSign");
    if (sign) sign.classList.add("hidden");
    clearTimeout(this._regionSignTimer);
  },

  startWave(app, waveNum) {
    const st = app.expeditionState;
    if (!st) return;
    const cfg = st.plan[waveNum - 1];
    if (!cfg) return;

    st.currentWave = waveNum;
    st.spawnedCount = 0;
    st.killsInWave = 0;
    st.killQuota = cfg.isBossWave ? 0 : (cfg.killQuota || 25);
    st.spawnCd = 0.45;
    st.eliteSpawnedCount = 0;
    st.treasureSpawned = false;
    st.powerupSpawned = false;
    st.waveCleared = false;
    st.clearDelayTimer = 0;
    app.areaClearStampTimer = 0;

    // 1. 切換地圖、固定邊界與天候
    const isFinalArena = !!cfg.isArena;
    app.isArenaMode = isFinalArena;
    if (typeof MapEngine !== "undefined") {
      if (MapEngine.setArenaMode) MapEngine.setArenaMode(isFinalArena);
      if (!isFinalArena) {
        if (MapEngine.setStage) MapEngine.setStage(cfg.stageId);
        if (MapEngine.setBoundedMap) {
          const b = cfg.bounds || { halfW: 580, halfH: 440 };
          MapEngine.setBoundedMap(true, b.halfW, b.halfH);
        }
      } else if (MapEngine.setBoundedMap) {
        MapEngine.setBoundedMap(false);
      }
      MapEngine.setWeather(cfg.weather || "CLEAR");
    }
    if (app.updateWeatherUI) app.updateWeatherUI(cfg.weather || "CLEAR");
    if (typeof SoundFX !== "undefined") {
      if (cfg.isBossWave) SoundFX.startBgm("boss");
      else SoundFX.playBgm(cfg.stageId || "pallet", true);
    }

    // 2. 重置戰場殘留物與起跑定位
    app.enemies = [];
    app.enemyProjectiles = [];
    app.telegraphs = [];
    app.enemyExplosions = [];
    app.enemyDashes = [];
    app.gems = [];
    app.mapItems = [];
    app.lavaFootprints = [];
    app.arenaPowerups = [];
    app.fieldPowerups = [];
    app.activeBoss = null;
    SkillsEngine.reset();

    const p = app.player;
    if (p) {
      p.x = isFinalArena ? -120 : 0;
      p.y = 0;
      p.vx = 0;
      p.vy = 0;
      p.invulnTimer = 1.2;
      p.trail = [{ x: p.x, y: p.y }];
      if (isFinalArena) {
        p.arenaDashCd = 0;
        p.arenaDashMaxCd = 3.2;
        p.arenaDashInvulnTimer = 0;
        p.arenaPerfectCounterTimer = 0;
      }
      if (app.trainerCompanion) {
        app.trainerCompanion.x = p.x - 28;
        app.trainerCompanion.y = p.y + 10;
      }
      (app.partners || []).forEach(pt => {
        pt.x = p.x;
        pt.y = p.y;
      });
    }

    // 3. Boss 波次直接召喚目標首領／神獸
    if (cfg.isBossWave && Array.isArray(cfg.bossIds)) {
      const diff = app.selectedDifficulty || { hpMult: 1.0, atkMult: 1.0 };
      cfg.bossIds.forEach((bId, idx) => {
        const bData = POKEMON_MAP.get(bId) || POKEMON_MAP.get(150);
        app.saveData.pokedexSeen[bId] = true;
        const isLeg = !!cfg.isLegendaryBoss;
        const waveScale = 1 + (waveNum - 1) * 0.18;
        const baseHp = bId === 150 ? 13200 : (isLeg ? 7600 : 1450);
        const scaledHp = Math.round(baseHp * (diff.hpMult || 1.0) * (isLeg ? 1.0 : waveScale));
        const scaledAtk = Math.round((isLeg ? 28 : 19) * (diff.atkMult || 1.0) * (1 + (waveNum - 1) * 0.05));
        const bx = isFinalArena ? 130 : (p.x + (idx === 0 ? 220 : -220));
        const by = isFinalArena ? 0 : (p.y + (idx % 2 === 0 ? -70 : 70));

        const bossObj = {
          id: bId,
          data: bData,
          x: bx,
          y: by,
          hp: scaledHp,
          maxHp: scaledHp,
          atk: scaledAtk,
          speed: isLeg ? 96 : 82,
          radius: isLeg ? 44 : 30,
          isElite: true,
          isBoss: true,
          isExpeditionBoss: true,
          noEliteDrop: !isLeg,
          isFinalMewtwo: bId === 150,
          isShiny: false,
          treasureType: null,
          facingX: -1,
          facingY: 0,
          status: null,
          statusTimer: 0,
          statusTick: 0,
          ccImmunityTimer: 0,
          rangedCd: 1.1,
          whiteFlashTimer: 0,
          weightTier: isLeg ? "boss" : "heavy",
          kbResist: isLeg ? 1.0 : 0.80,
          bossAttackIdx: 0
        };
        app.enemies.push(bossObj);
        if (!app.activeBoss) app.activeBoss = bossObj;
      });
      const bossHud = document.getElementById("bossHudContainer");
      if (bossHud) bossHud.classList.remove("hidden");
    } else {
      const bossHud = document.getElementById("bossHudContainer");
      if (bossHud) bossHud.classList.add("hidden");
    }

    // 4. 新章節第一關滑入 GBA 左上角地名木牌／石牌
    if (cfg.isFirstWaveOfChapter) {
      this.showRegionSign(cfg);
    }

    app.battleCountdownTimer = 1.14;
    app._lastCountdownBeat = 4;
    app.showCutsceneBanner(
      `【WAVE ${waveNum}/${st.totalWaves} ‧ ${cfg.title}】`,
      cfg.subtitle,
      2600
    );
    app.state = "PLAYING";
    app.refreshHUD();
  },

  onEnemyKilled(app, enemy) {
    if (!app.isExpeditionMode || !app.expeditionState) return;
    const st = app.expeditionState;
    const cfg = st.plan[st.currentWave - 1];
    if (!cfg || cfg.isBossWave) return;
    if (enemy && enemy.isQuotaMob) {
      st.killsInWave = Math.min(st.killQuota, (st.killsInWave || 0) + 1);
    }
  },

  update(app, dt) {
    const st = app.expeditionState;
    const p = app.player;
    if (!st || !p) return;
    const cfg = st.plan[st.currentWave - 1];
    if (!cfg) return;

    if (cfg.isArena) {
      app.camera.x = p.x * 0.42;
      app.camera.y = p.y * 0.42;
    }

    if (app.areaClearStampTimer > 0) {
      app.areaClearStampTimer = Math.max(0, app.areaClearStampTimer - dt);
    }

    // 波次淨空後的 0.85s 吸晶與 AREA CLEAR 緩衝
    if (st.waveCleared) {
      st.clearDelayTimer -= dt;
      if (st.clearDelayTimer <= 0) {
        // 收尾兜底：把還沒吸進來的殘留水晶一次補算
        if (app.gems.length > 0) {
          let remExp = 0;
          app.gems.forEach(g => { remExp += (g.val || 15); });
          app.gems = [];
          if (remExp > 0) app.gainExp(remExp);
        }
        if (app.state === "PAUSED" || app.state === "EVOLVING") {
          app._pendingExpeditionIntermission = true;
        } else {
          this.openIntermissionModal(app);
        }
      }
      return;
    }

    // 1. 檢查通關條件
    if (cfg.isBossWave) {
      const aliveBosses = app.enemies.filter(e => e.isExpeditionBoss && e.hp > 0);
      if (aliveBosses.length === 0) {
        if (st.currentWave >= st.totalWaves) {
          this.handleExpeditionVictory(app);
        } else {
          this.completeWave(app, cfg);
        }
        return;
      }
    } else {
      // 常規波次：波次殲滅進度制（全數刷完且場上配額怪全滅才通關！）
      const aliveQuotaMobs = app.enemies.filter(e => e.isQuotaMob && e.hp > 0).length;
      if (st.spawnedCount >= st.killQuota && aliveQuotaMobs === 0) {
        this.completeWave(app, cfg);
        return;
      }
    }

    // 2. 波中限時增益道具搶點（進度達 ~45% 時於戰場內刷出 1 顆限時增益）
    if (!cfg.isArena && !st.powerupSpawned) {
      const triggerPowerup = cfg.isBossWave
        ? (app.activeBoss && (app.activeBoss.hp / app.activeBoss.maxHp) < 0.72)
        : (st.killsInWave >= Math.floor(st.killQuota * 0.42));
      if (triggerPowerup && typeof app.spawnFieldPowerup === "function") {
        st.powerupSpawned = true;
        const b = cfg.bounds || { halfW: 580, halfH: 440 };
        const ang = Math.random() * Math.PI * 2;
        const dist = 170 + Math.random() * 110;
        const px = Math.max(-b.halfW + 70, Math.min(b.halfW - 70, p.x + Math.cos(ang) * dist));
        const py = Math.max(-b.halfH + 70, Math.min(b.halfH - 70, p.y + Math.sin(ang) * dist));
        app.spawnFieldPowerup(px, py);
      }
    }

    // 3. 刷怪排程
    if (cfg.enemyPool && cfg.enemyPool.length > 0) {
      st.spawnCd -= dt;
      const cap = cfg.isBossWave ? 14 : Math.min(36, 18 + st.currentWave * 2);
      const canSpawnMore = cfg.isBossWave || (st.spawnedCount < st.killQuota);
      if (canSpawnMore && st.spawnCd <= 0 && app.enemies.length < cap) {
        const remainToSpawn = cfg.isBossWave ? 2 : (st.killQuota - st.spawnedCount);
        const batch = cfg.isBossWave
          ? 2
          : Math.min(remainToSpawn, Math.min(5, 3 + Math.floor(st.currentWave / 3)));
        st.spawnCd = cfg.isBossWave ? 2.6 : Math.max(0.85, 1.35 - st.currentWave * 0.05);

        for (let i = 0; i < batch; i++) {
          const maxElites = Math.min(2, 1 + Math.floor(st.currentWave / 4));
          const needElite = !cfg.isBossWave && cfg.elitePool && cfg.elitePool.length > 0 &&
            st.eliteSpawnedCount < maxElites &&
            st.spawnedCount >= Math.floor(st.killQuota * 0.55) && i === 0;
          if (needElite) st.eliteSpawnedCount += 1;
          this.spawnWaveMob(app, cfg, needElite);
          if (!cfg.isBossWave) st.spawnedCount += 1;
        }
      }

      if (cfg.spawnTreasure && !st.treasureSpawned && st.killsInWave >= Math.floor(st.killQuota * 0.50)) {
        st.treasureSpawned = true;
        if (app.spawnTreasureMonster) app.spawnTreasureMonster(cfg.spawnTreasure);
      }
    }
  },

  spawnWaveMob(app, cfg, isElite = false) {
    const p = app.player;
    const pool = (isElite && cfg.elitePool && cfg.elitePool.length > 0) ? cfg.elitePool : cfg.enemyPool;
    const pickId = pool[Math.floor(Math.random() * pool.length)];
    const pData = POKEMON_MAP.get(pickId) || POKEMON_MAP.get(19);
    const diff = app.selectedDifficulty || { hpMult: 1.0, atkMult: 1.0 };
    const w = cfg.wave;
    const hpScale = (1 + (w - 1) * 0.34) * (diff.hpMult || 1.0);
    const baseHp = Math.round((pData.hp * 0.55 + 20) * hpScale * (isElite ? 3.0 : 1.0));
    const atkVal = Math.round((8 + w * 1.55) * (diff.atkMult || 1.0) * (isElite ? 1.4 : 1.0));
    const spdVal = Math.min(115, (54 + pData.speed * 0.30) * (isElite ? 1.08 : 1.0));

    // 在固定生態邊界內、玩家外圍 250~380px 處刷新，確保不刷到牆外也不貼臉
    const b = cfg.bounds || { halfW: 580, halfH: 440 };
    let ex = 0, ey = 0;
    for (let tries = 0; tries < 6; tries++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = 240 + Math.random() * 140;
      const cx = Math.max(-b.halfW + 32, Math.min(b.halfW - 32, p.x + Math.cos(ang) * dist));
      const cy = Math.max(-b.halfH + 32, Math.min(b.halfH - 32, p.y + Math.sin(ang) * dist));
      ex = cx; ey = cy;
      if (Math.hypot(ex - p.x, ey - p.y) >= 165) break;
    }

    app.saveData.pokedexSeen[pData.id] = true;
    app.enemies.push({
      id: pData.id,
      data: pData,
      x: ex,
      y: ey,
      hp: baseHp,
      maxHp: baseHp,
      atk: atkVal,
      speed: spdVal,
      radius: isElite ? 26 : 18,
      isElite,
      isBoss: false,
      isQuotaMob: !cfg.isBossWave,
      isShiny: Math.random() < (0.008 * (p.loadoutShinyMult || 1.0)),
      facingX: -1,
      facingY: 1,
      status: null,
      statusTimer: 0,
      statusTick: 0,
      ccImmunityTimer: 0,
      rangedCd: 1.6 + Math.random() * 1.4,
      whiteFlashTimer: 0,
      weightTier: isElite ? "heavy" : (pData.hp >= 140 ? "medium" : "light"),
      kbResist: isElite ? 0.65 : 0.0
    });
  },

  onBossDefeated(app, boss) {
    if (!app.isExpeditionMode || !app.expeditionState) return false;
    const st = app.expeditionState;
    const cfg = st.plan[st.currentWave - 1];
    if (!cfg) return false;
    const remainBosses = app.enemies.filter(e => e.isExpeditionBoss && e.hp > 0);
    if (remainBosses.length > 0) return true;
    if (st.currentWave >= st.totalWaves) {
      this.handleExpeditionVictory(app);
      return true;
    }
    this.completeWave(app, cfg);
    return true;
  },

  completeWave(app, cfg) {
    const st = app.expeditionState;
    if (!st || st.waveCleared) return;
    st.waveCleared = true;
    st.clearDelayTimer = 0.85;

    // 尾刀爽感閉環：0.22s 微慢動作 ＋ AREA CLEAR 印章 ＋ 全場經驗水晶磁力音階吸入
    app.killSlowmoTimer = Math.max(app.killSlowmoTimer || 0, 0.22);
    app.areaClearStampTimer = 0.90;
    app.enemies.forEach(en => {
      app.spawnParticleCluster(en.x, en.y, "#FACC15", "#FFFFFF", 5, "star", 0.9);
    });
    app.enemies = [];
    app.enemyProjectiles = [];
    app.telegraphs = [];
    app.fieldPowerups = [];
    app.activeBoss = null;
    const bossHud = document.getElementById("bossHudContainer");
    if (bossHud) bossHud.classList.add("hidden");

    const diffMult = (app.selectedDifficulty && app.selectedDifficulty.coinMult) || 1.0;
    const coinMod = (app.player && app.player.loadoutCoinMult) ? app.player.loadoutCoinMult : 1.0;
    const bonusCoins = Math.round((cfg.clearBonus || 80) * diffMult * coinMod);
    app.runCoins += bonusCoins;
    app.saveData.coins += bonusCoins;

    const p = app.player;
    if (p) {
      const healPct = cfg.actClearHeal || 0.20;
      const healAmt = Math.round(p.maxHp * healPct);
      p.hp = Math.min(p.maxHp, p.hp + healAmt);
      p.status = null;
      p.statusTimer = 0;
      app.spawnFloatingText(p.x, p.y - 34, `WAVE ${cfg.wave} 淨空！+${bonusCoins} 金 ‧ +${healAmt} HP`, "#34D399", 15);
    }

    // 讓所有地上水晶立即磁力飛向主角（伴隨升調音效），未飛完的在 0.85s 結束時自動結算
    app.gems.forEach(g => { g.magnetized = true; });

    SoundFX.play("area_clear");
    this.saveCheckpoint(app, st.currentWave + 1);
  },

  handleExpeditionVictory(app) {
    this.clearCheckpoint(app);
    const st = app.expeditionState;
    const diffMult = (app.selectedDifficulty && app.selectedDifficulty.coinMult) || 1.0;
    const clearCoins = Math.round(450 * diffMult);
    app.runCoins += clearCoins;
    app.saveData.coins += clearCoins;
    if (!app.saveData.stats.expeditionClears) app.saveData.stats.expeditionClears = 0;
    app.saveData.stats.expeditionClears += 1;
    app.lastExpeditionResult = {
      clearedWaves: st ? st.totalWaves : 10,
      totalGain: clearCoins,
      clearTimeSec: Math.round(app.runTime || 0),
      chaptersCleared: (window.EXPEDITION_CHAPTERS || []).map(c => ({
        id: c.id,
        name: c.shortName || c.name,
        badgeLabel: (c.theme && c.theme.badgeLabel) || c.shortName,
        badgeBg: (c.theme && c.theme.badgeBg) || "#D97706"
      }))
    };
    if (app.saveToStorage) app.saveToStorage();
    app.showCutsceneBanner(
      `關都大遠征 ${st ? st.totalWaves : 10}/${st ? st.totalWaves : 10} 制霸！CHAMPION!`,
      `貫穿全區域並討伐王者超夢！獲得遠征冠軍賞金 +${clearCoins} 代幣！`,
      2400
    );
    app.startVictoryCeremony();
  },

  // ==========================================================================
  // 波間整備商店與「火車站式局部捲動 GBA 長卷 ＋ 雙人向右漫步動畫」
  // ==========================================================================
  openIntermissionModal(app) {
    const st = app.expeditionState;
    if (!st) return;
    app.state = "PAUSED";
    if (app.touchJoy) {
      app.touchJoy.active = false;
      app.touchJoy.dx = 0;
      app.touchJoy.dy = 0;
    }
    const joyBase = document.getElementById("touchJoyBase");
    const joyStick = document.getElementById("touchJoyStick");
    if (joyBase) joyBase.style.display = "none";
    if (joyStick) joyStick.style.display = "none";

    st.shopRerollCost = 40;
    st.pendingForgetTm = null;
    this.rollIntermissionShop(app);
    this.renderIntermissionModal(app, true);

    const modal = document.getElementById("expeditionModal");
    if (modal) {
      modal.classList.remove("hidden");
      modal.style.display = "flex";
    }
  },

  stopRouteWalkAnim() {
    if (this._walkAnimRaf) {
      cancelAnimationFrame(this._walkAnimRaf);
      this._walkAnimRaf = null;
    }
  },

  rollIntermissionShop(app) {
    const st = app.expeditionState;
    const p = app.player;
    const nextCfg = st.plan[st.currentWave] || st.plan[st.plan.length - 1];
    const nextEnemyTypes = nextCfg.enemyTypes || [];
    const tmList = typeof TM_CATALOG !== "undefined" ? Object.values(TM_CATALOG) : [];
    const specItems = typeof MART_SPECIAL_ITEMS !== "undefined" ? MART_SPECIAL_ITEMS : {};

    const findOwned = (sId) => {
      const clean = sId.replace(/\s+/g, "");
      const key = Object.keys(p.skills).find(k => k.replace(/\s+/g, "") === clean);
      return key ? p.skills[key] : null;
    };

    const shelf = [];

    const eligibleTMs = tmList.filter(tm => {
      const ex = findOwned(tm.id);
      return !ex || ex.level < 10;
    });
    const counterTMs = eligibleTMs.filter(tm =>
      nextEnemyTypes.some(et => typeof calcTypeMultiplier === "function" && calcTypeMultiplier(tm.type, et, "None") > 1.1)
    );
    const tmPickPool = counterTMs.length > 0 ? counterTMs : eligibleTMs;
    if (tmPickPool.length > 0) {
      const pickedTm = tmPickPool[Math.floor(Math.random() * tmPickPool.length)];
      shelf.push({ ...pickedTm, kind: "tm", isCounterRec: counterTMs.includes(pickedTm), bought: false });
    }

    const candyPick = (st.currentWave >= 5 && specItems.master_candy) ? specItems.master_candy : specItems.pp_up;
    if (candyPick) {
      shelf.push({ ...candyPick, kind: "consumable", bought: false });
    }

    const allHeld = typeof HELD_ITEMS !== "undefined" ? Object.values(HELD_ITEMS) : [];
    const unownedHeld = allHeld.filter(hi => !p.heldItems[hi.id]);
    let pickedHeld = null;
    if (nextCfg.stageId === "cerulean_bay" && !p.heldItems["sharp_beak"] && HELD_ITEMS["sharp_beak"]) {
      pickedHeld = HELD_ITEMS["sharp_beak"];
    } else if (unownedHeld.length > 0) {
      const learnedTypes = new Set(Object.values(p.skills).map(s => SKILLS_CATALOG[s.id]?.type));
      const matched = unownedHeld.filter(hi => learnedTypes.has(SKILLS_CATALOG[hi.skillReq]?.type));
      const hPool = matched.length > 0 ? matched : unownedHeld;
      pickedHeld = hPool[Math.floor(Math.random() * hPool.length)];
    }
    if (pickedHeld) {
      shelf.push({
        id: pickedHeld.id,
        name: pickedHeld.name,
        desc: pickedHeld.desc,
        sprite: pickedHeld.sprite,
        cost: 110,
        kind: "held",
        isStageRec: (nextCfg.stageId === "cerulean_bay" && pickedHeld.id === "sharp_beak"),
        bought: false
      });
    } else if (specItems.x_attack) {
      shelf.push({ ...specItems.x_attack, kind: "consumable", bought: false });
    }

    if (specItems.full_restore) {
      shelf.push({ ...specItems.full_restore, cost: 65, kind: "consumable", bought: false });
    }

    st.shopShelf = shelf;
  },

  renderIntermissionModal(app, playWalkAnim = false) {
    const st = app.expeditionState;
    const p = app.player;
    if (!st || !p) return;
    const clearedWave = st.currentWave;
    const nextWave = Math.min(st.totalWaves, clearedWave + 1);
    const clearedCfg = st.plan[clearedWave - 1];
    const nextCfg = st.plan[nextWave - 1];
    const isCrossingAct = !!(clearedCfg && nextCfg && clearedCfg.act !== nextCfg.act);

    const titleEl = document.getElementById("expModalTitle");
    if (titleEl) titleEl.textContent = `EXPEDITION · WAVE ${clearedWave}/${st.totalWaves} CLEAR`;

    const coinEl = document.getElementById("expCoinsDisplay");
    if (coinEl) coinEl.textContent = app.runCoins.toLocaleString();

    const hpEl = document.getElementById("expHpDisplay");
    if (hpEl) hpEl.textContent = `HP ${Math.ceil(p.hp)}/${p.maxHp}`;

    const rerollCostEl = document.getElementById("expRerollCostText");
    if (rerollCostEl) rerollCostEl.textContent = st.shopRerollCost || 40;

    const nextBtnEl = document.getElementById("btnExpStartNextWave");
    if (nextBtnEl) {
      nextBtnEl.textContent = nextCfg.isFinalChapter
        ? `踏入${nextCfg.chapterShortName} · 最終決戰 →`
        : `出發！第 ${nextWave}/${st.totalWaves} 站（${nextCfg.title}） →`;
    }

    // 1. 啟動或靜態繪製「火車站式局部捲動 GBA 路線長卷 ＋ 訓練家與主角向右漫步」
    const routeCan = document.getElementById("expeditionRouteCanvas");
    if (routeCan) {
      if (playWalkAnim) {
        this.startRouteWalkAnimation(routeCan, app, clearedWave, nextWave, isCrossingAct);
      } else {
        this.drawScrollingRouteMap(routeCan, app, clearedWave, nextWave, 1.0, isCrossingAct);
      }
    }

    // 2. 單行精簡下一站情報條（全像素徽章＋精靈頭像，零 Emoji）
    const intelBox = document.getElementById("expNextWaveIntelBox");
    if (intelBox) {
      const typeBadges = (nextCfg.enemyTypes || []).map(t => renderTypeBadgeHTML(t)).join("");
      const enemySprites = (nextCfg.previewIds || []).map(pid => {
        const pd = POKEMON_MAP.get(pid);
        return pd
          ? `<div class="w-8 h-8 rounded-lg bg-slate-950 border ${nextCfg.isBossWave ? 'border-rose-500' : 'border-slate-600'} flex items-center justify-center shrink-0" title="${pd.name_zh}">
               <img src="${SpriteCache.resolveUrl(pd.forward_sprite)}" class="w-7 h-7 pixel-sprite object-contain" alt="${pd.name_zh}"/>
             </div>`
          : "";
      }).join("");
      const goalTag = nextCfg.isBossWave
        ? '<span class="px-1.5 py-0.5 rounded bg-rose-900 border border-rose-400 text-rose-200 font-pixel text-[8px]">BOSS戰</span>'
        : `<span class="px-1.5 py-0.5 rounded bg-emerald-900 border border-emerald-400 text-emerald-200 font-pixel text-[8px]">殲滅 ${nextCfg.killQuota || 25}隻</span>`;

      intelBox.innerHTML = `
        <div class="flex items-center justify-between gap-2">
          <div class="min-w-0 flex-1 space-y-1">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="px-1.5 py-0.5 rounded bg-red-600 text-white font-pixel text-[8px] font-black">NEXT W${nextWave}</span>
              ${goalTag}
              <span class="font-black text-[11px] text-amber-300 truncate">${nextCfg.chapterShortName} · ${nextCfg.title}</span>
            </div>
            <div class="flex items-center gap-1 flex-wrap">
              <span class="text-[10px] font-bold text-slate-400">敵軍屬性：</span>
              ${typeBadges}
              ${isCrossingAct ? '<span class="px-1.5 py-0.2 rounded bg-emerald-700 text-white text-[9px] font-black ml-1">跨區營地回復</span>' : ''}
            </div>
          </div>
          <div class="flex items-center gap-1 shrink-0">${enemySprites}</div>
        </div>
      `;
    }

    // 3. 渲染 2×2 免捲動像素商品卡片網格（含滿槽自選遺忘）
    const shopBox = document.getElementById("expShopContainer");
    if (!shopBox) return;

    if (st.pendingForgetTm) {
      const pend = st.pendingForgetTm;
      const newMeta = SKILLS_CATALOG[pend.item.id];
      shopBox.className = "space-y-1.5";
      shopBox.innerHTML = `
        <div class="bg-amber-950/75 border border-amber-400 rounded-xl p-2.5 space-y-2">
          <div class="text-[11px] font-black text-amber-300">招式槽已滿！選擇要遺忘的招式以學習【${newMeta ? newMeta.name : pend.item.name}】：</div>
          <div class="space-y-1.5">
            ${Object.entries(p.skills).map(([key, sk]) => {
              const meta = SKILLS_CATALOG[sk.id];
              return `
                <div class="flex items-center justify-between bg-slate-900/95 px-2.5 py-1.5 rounded-lg border border-slate-700">
                  <div class="flex items-center gap-2 min-w-0">
                    ${meta ? renderSkillIconHTML(meta, "w-6 h-6") : ""}
                    <span class="font-black text-xs text-white truncate">${meta ? (sk.evolved ? meta.evolvedName : meta.name) : sk.id}</span>
                    <span class="font-pixel text-[9px] text-amber-300">Lv.${sk.level}</span>
                  </div>
                  <button onclick="ModeExpedition.confirmForgetAndBuy('${key}')" class="poke-btn-red px-2.5 py-1 text-[10px] font-black shrink-0">遺忘替換</button>
                </div>
              `;
            }).join("")}
          </div>
          <button onclick="ModeExpedition.cancelForget()" class="poke-btn-white w-full py-1.5 text-xs font-black">返回整備商店</button>
        </div>
      `;
      return;
    }

    const curCount = Object.keys(p.skills).length;
    const maxSlots = p.maxSkillSlots || 3;
    const findOwned = (sId) => {
      const clean = sId.replace(/\s+/g, "");
      const key = Object.keys(p.skills).find(k => k.replace(/\s+/g, "") === clean);
      return key ? p.skills[key] : null;
    };

    shopBox.className = "grid grid-cols-2 gap-1.5";
    shopBox.innerHTML = (st.shopShelf || []).map((it, idx) => {
      let badgeHtml = "";
      if (it.kind === "tm") {
        const owned = findOwned(it.id);
        if (owned) {
          badgeHtml = `<span class="px-1 py-0.2 rounded bg-emerald-900 text-emerald-300 text-[8px] font-black">Lv.${owned.level}➔${Math.min(10, owned.level + 1)}</span>`;
        } else if (curCount >= maxSlots) {
          badgeHtml = `<span class="px-1 py-0.2 rounded bg-amber-900 text-amber-300 text-[8px] font-black">替換</span>`;
        }
        if (it.isCounterRec) {
          badgeHtml += `<span class="px-1 py-0.2 rounded bg-sky-700 text-white text-[8px] font-black">克制</span>`;
        }
      } else if (it.kind === "held") {
        badgeHtml = `<span class="px-1 py-0.2 rounded bg-purple-800 text-purple-100 text-[8px] font-black">${it.isStageRec ? '海域推薦' : '攜帶物'}</span>`;
      }

      const iconHtml = (it.kind === "tm" && typeof renderSkillIconHTML === "function")
        ? renderSkillIconHTML(it.id, "w-7 h-7")
        : `<img src="${SpriteCache.resolveUrl(it.sprite)}" class="w-7 h-7 pixel-sprite object-contain" alt="${it.name}"/>`;

      return `
        <div class="bg-slate-800/95 p-2 rounded-xl border ${it.bought ? 'border-slate-700 opacity-50' : 'border-slate-600'} flex flex-col justify-between gap-1.5">
          <div class="flex items-start gap-2 min-w-0">
            <div class="w-8 h-8 bg-slate-950 rounded-lg border border-slate-700 flex items-center justify-center shrink-0">${iconHtml}</div>
            <div class="min-w-0 flex-1">
              <div class="font-black text-[11px] text-white truncate leading-tight">${it.kind === "tm" ? `${it.tmNo || 'TM'} ${it.name}` : it.name}</div>
              <div class="flex items-center gap-1 flex-wrap mt-0.5">${badgeHtml}</div>
            </div>
          </div>
          <div class="text-[9px] text-slate-300 leading-tight line-clamp-2 min-h-[22px]">${it.desc}</div>
          ${it.bought
            ? `<div class="w-full py-1 rounded-lg bg-slate-900 border border-slate-700 font-pixel text-[8px] text-emerald-400 text-center">SOLD</div>`
            : `<button onclick="ModeExpedition.buyShopItem(${idx})" class="poke-btn-yellow w-full py-1 text-[11px] font-black flex items-center justify-center gap-1">
                 <img src="${ITEM_SPRITES.coin}" class="w-3.5 h-3.5 pixel-sprite"/>
                 <span>${it.cost}</span>
               </button>`
          }
        </div>
      `;
    }).join("");
  },

  startRouteWalkAnimation(canvas, app, clearedWave, nextWave, isCrossingAct) {
    this.stopRouteWalkAnim();
    const startTs = performance.now();
    const durationMs = 1350;
    let healChimePlayed = false;

    const tick = (nowTs) => {
      const elapsed = nowTs - startTs;
      const t = Math.min(1, elapsed / durationMs);
      if (isCrossingAct && !healChimePlayed && t >= 0.48) {
        healChimePlayed = true;
        if (typeof SoundFX !== "undefined") SoundFX.play("pokecenter_heal");
      }
      this.drawScrollingRouteMap(canvas, app, clearedWave, nextWave, t, isCrossingAct);
      if (t < 1) {
        this._walkAnimRaf = requestAnimationFrame(tick);
      } else {
        this._walkAnimRaf = null;
      }
    };
    this._walkAnimRaf = requestAnimationFrame(tick);
  },

  // 火車站式局部捲動 GBA 路線長卷（動態適配任意章節數與總站數）
  drawScrollingRouteMap(canvas, app, clearedWave, nextWave, walkT = 1.0, isCrossingAct = false) {
    const st = app.expeditionState;
    if (!st || !st.plan) return;
    const plan = st.plan;
    const total = plan.length;
    const vpW = canvas.width = 440;
    const vpH = canvas.height = 122;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;

    const spacing = 128;
    const padLeft = 72;
    const worldW = padLeft * 2 + (total - 1) * spacing;

    const nodeX = (idx) => padLeft + idx * spacing;
    const nodeY = (idx) => 70 + (idx % 2 === 0 ? 4 : -4);

    const ease = 1 - Math.pow(1 - Math.min(1, walkT), 2.2);
    const fromIdx = Math.max(0, clearedWave - 1);
    const toIdx = Math.min(total - 1, nextWave - 1);
    const duoX = nodeX(fromIdx) + (nodeX(toIdx) - nodeX(fromIdx)) * ease;
    const duoY = nodeY(fromIdx) + (nodeY(toIdx) - nodeY(fromIdx)) * ease;

    // 鏡頭平滑跟隨雙人主角（讓當前進度落在畫面偏中左，清楚看見前方 1~2 站與關底 Boss）
    const desiredCamX = duoX - vpW * 0.42;
    const camX = Math.max(0, Math.min(Math.max(0, worldW - vpW), desiredCamX));

    ctx.save();
    ctx.translate(-Math.round(camX), 0);

    // 1. 動態依章節繪製橫向 GBA 生態風景背景帶
    const chapters = window.EXPEDITION_CHAPTERS || [];
    let cursorWave = 0;
    chapters.forEach((ch, chIdx) => {
      const len = (ch.waves && ch.waves.length) || 0;
      if (len === 0) return;
      const startX = cursorWave === 0 ? 0 : (nodeX(cursorWave - 1) + nodeX(cursorWave)) * 0.5;
      const endX = (cursorWave + len >= total) ? worldW : (nodeX(cursorWave + len - 1) + nodeX(cursorWave + len)) * 0.5;
      const segW = endX - startX;
      const th = ch.theme || { bg: "#3E6B38", accent: "#2E5229", text: "#BBF7D0" };

      ctx.fillStyle = th.bg;
      ctx.fillRect(startX, 0, segW, vpH);

      // 依生態繪製像素地景紋理
      ctx.fillStyle = th.accent;
      if (ch.stageId === "pallet") {
        for (let x = startX + 12; x < endX - 10; x += 28) {
          ctx.fillRect(x, 22, 14, 10);
          ctx.fillRect(x + 8, 98, 14, 10);
        }
      } else if (ch.stageId === "cerulean_bay") {
        for (let x = startX + 10; x < endX - 12; x += 30) {
          ctx.fillRect(x, 26, 16, 3);
          ctx.fillRect(x + 12, 102, 16, 3);
        }
      } else if (ch.isArena) {
        ctx.fillStyle = "#B91C1C";
        ctx.fillRect(startX + 4, 58, segW - 8, 24);
        ctx.fillStyle = "#F59E0B";
        ctx.fillRect(startX + 4, 56, segW - 8, 3);
        ctx.fillRect(startX + 4, 81, segW - 8, 3);
      } else {
        for (let x = startX + 12; x < endX - 12; x += 26) {
          ctx.fillRect(x, 24, 12, 6);
          ctx.fillRect(x, 96, 12, 6);
        }
      }

      // 區域分界線
      if (cursorWave > 0) {
        ctx.strokeStyle = "rgba(15, 23, 42, 0.78)";
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(startX, 0); ctx.lineTo(startX, vpH); ctx.stroke();
      }

      // 區域頂部 GBA 招牌（固定跟隨該章節可視區中央）
      const visL = Math.max(startX + 4, camX + 6);
      const visR = Math.min(endX - 4, camX + vpW - 6);
      if (visR - visL > 64) {
        const labelCx = (visL + visR) * 0.5;
        ctx.fillStyle = "rgba(15, 23, 42, 0.78)";
        ctx.fillRect(labelCx - 46, 5, 92, 15);
        ctx.fillStyle = th.text || "#FFFFFF";
        ctx.font = "bold 9px 'Noto Sans TC', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`ACT ${chIdx + 1} · ${ch.shortName || ch.name}`, labelCx, 16);
      }

      cursorWave += len;
    });

    // 2. 繪製火車站式 GBA 像素軌道／冒險小徑
    ctx.lineCap = "round";
    for (let i = 0; i < total - 1; i++) {
      const ax = nodeX(i), ay = nodeY(i);
      const bx = nodeX(i + 1), by = nodeY(i + 1);
      const passed = (i + 1) < clearedWave;
      const walkingSeg = (i + 1) === clearedWave;

      ctx.strokeStyle = "#0F172A";
      ctx.lineWidth = 10;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();

      ctx.strokeStyle = passed ? "#FACC15" : "#64748B";
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();

      if (walkingSeg) {
        ctx.strokeStyle = "#FACC15";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax + (bx - ax) * ease, ay + (by - ay) * ease);
        ctx.stroke();
      }
    }

    // 3. 繪製站點月台圓章、站名與前方 Boss 預覽
    plan.forEach((cfg, idx) => {
      const sx = nodeX(idx), sy = nodeY(idx);
      if (sx < camX - 60 || sx > camX + vpW + 60) return;
      const wNum = idx + 1;
      const isBoss = !!cfg.isBossWave;
      const isCleared = wNum <= clearedWave;
      const isNext = wNum === nextWave;
      const r = isBoss ? 12 : 9;

      ctx.fillStyle = "#0F172A";
      ctx.beginPath(); ctx.arc(sx, sy, r + 3, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = isCleared ? "#22C55E" : (isNext ? "#EF4444" : (isBoss ? "#7F1D1D" : "#334155"));
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 9px monospace";
      ctx.textAlign = "center";
      ctx.fillText(isCleared ? "OK" : String(wNum), sx, sy + 3);

      // 下一站亮黃游標框
      if (isNext) {
        ctx.strokeStyle = "#FEF08A";
        ctx.lineWidth = 2.4;
        ctx.strokeRect(sx - 16, sy - 16, 32, 32);
      }

      // 未通關 Boss 站點在上方顯示 Boss 像素頭像
      if (isBoss && !isCleared && cfg.previewIds && cfg.previewIds[0]) {
        const bData = POKEMON_MAP.get(cfg.previewIds[0]);
        if (bData && bData.forward_sprite) {
          const rec = SpriteCache.get(bData.forward_sprite);
          if (rec && rec.loaded) {
            ctx.drawImage(rec.img, sx - 16, sy - 46, 32, 32);
          }
        }
      }

      // 下方站牌編號與簡稱
      ctx.fillStyle = "rgba(15, 23, 42, 0.76)";
      ctx.fillRect(sx - 36, 94, 72, 16);
      ctx.fillStyle = isNext ? "#FEF08A" : (isCleared ? "#86EFAC" : "#CBD5E1");
      ctx.font = "bold 9px 'Noto Sans TC', sans-serif";
      const shortLbl = isBoss ? `W${wNum} BOSS` : `第 ${wNum} 站`;
      ctx.fillText(shortLbl, sx, 105);
    });

    // 4. 繪製「訓練家 ＋ 主角寶可夢」向右一步一步走去下一站！
    const stepPhase = walkT * 10 * Math.PI;
    const isMoving = walkT < 0.99;
    const bobPoke = isMoving ? Math.abs(Math.sin(stepPhase)) * 5 : 0;
    const bobTrainer = isMoving ? Math.abs(Math.sin(stepPhase + 1.2)) * 3.5 : 0;

    // 腳底像素塵土（移動中）
    if (isMoving) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
      const d1 = (walkT * 45) % 14;
      ctx.beginPath();
      ctx.arc(duoX - 24 - d1, duoY + 4, 2.6, 0, Math.PI * 2);
      ctx.arc(duoX - 10 - d1 * 0.7, duoY + 5, 2.0, 0, Math.PI * 2);
      ctx.fill();
    }

    // 訓練家（跟在主角左後方 22px，優先使用 3×4 行走圖集向右行 [row=2]）
    const tr = app.selectedTrainer || TRAINERS[0];
    const trCos = (typeof getResolvedTrainerCostume === "function") ? getResolvedTrainerCostume(tr, app.saveData) : tr;
    const sheetUrl = trCos.walkSheet || tr.walkSheet;
    const sheetRec = sheetUrl ? SpriteCache.get(sheetUrl) : null;
    if (sheetRec && sheetRec.loaded && sheetRec.img.naturalWidth > 0) {
      const fw = Math.floor(sheetRec.img.naturalWidth / 3);
      const fh = Math.floor(sheetRec.img.naturalHeight / 4);
      const col = isMoving ? [0, 1, 2, 1][Math.floor(walkT * 12) % 4] : 1;
      const row = 2; // 向右行走列
      ctx.drawImage(sheetRec.img, col * fw, row * fh, fw, fh, Math.round(duoX - 38), Math.round(duoY - 40 - bobTrainer), 30, 36);
    } else if (trCos.sprite) {
      const trRec = SpriteCache.get(trCos.sprite);
      if (trRec && trRec.loaded) {
        ctx.drawImage(trRec.img, Math.round(duoX - 38), Math.round(duoY - 38 - bobTrainer), 30, 34);
      }
    }

    // 主角寶可夢（走在右前方領路，面向右方水平翻轉）
    const pData = app.player && app.player.data;
    if (pData && pData.forward_sprite) {
      const pUrl = (app.player.isShiny && pData.shiny_forward_sprite) ? pData.shiny_forward_sprite : pData.forward_sprite;
      const pRec = SpriteCache.get(pUrl);
      if (pRec && pRec.loaded) {
        ctx.save();
        ctx.translate(Math.round(duoX + 2), Math.round(duoY - 22 - bobPoke));
        ctx.scale(-1, 1);
        ctx.drawImage(pRec.img, -17, -17, 34, 34);
        ctx.restore();
      }
    }

    // 跨區休整營地治癒星光（跨 Act 過境中段閃耀）
    if (isCrossingAct && walkT > 0.38 && walkT < 0.88) {
      const spAlpha = Math.sin(((walkT - 0.38) / 0.50) * Math.PI);
      ctx.save();
      ctx.globalAlpha = spAlpha;
      ctx.fillStyle = "#4ADE80";
      for (let k = 0; k < 5; k++) {
        const sxp = duoX - 18 + k * 9;
        const syp = duoY - 46 - ((walkT * 30 + k * 5) % 14);
        ctx.fillRect(sxp - 1.5, syp - 4, 3, 8);
        ctx.fillRect(sxp - 4, syp - 1.5, 8, 3);
      }
      ctx.restore();
    }

    ctx.restore();

    // 視窗外框 GBA 金邊
    ctx.strokeStyle = "#F59E0B";
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, vpW - 3, vpH - 3);
  },

  buyShopItem(idx) {
    const app = GameApp;
    const st = app.expeditionState;
    const p = app.player;
    if (!st || !p) return;
    const it = st.shopShelf && st.shopShelf[idx];
    if (!it || it.bought) return;

    if (app.runCoins < it.cost) {
      if (app.pixelToast) app.pixelToast(`代幣不足！需 ${it.cost} 金（目前 ${app.runCoins} 金）`, "warn");
      return;
    }

    if (it.kind === "tm") {
      const cleanId = it.id.replace(/\s+/g, "");
      const existKey = Object.keys(p.skills).find(k => k.replace(/\s+/g, "") === cleanId);
      if (!existKey && Object.keys(p.skills).length >= (p.maxSkillSlots || 3)) {
        st.pendingForgetTm = { idx, item: it };
        this.renderIntermissionModal(app, false);
        return;
      }
      app.runCoins -= it.cost;
      app.saveData.coins = Math.max(0, app.saveData.coins - it.cost);
      it.bought = true;
      if (existKey) {
        p.skills[existKey].level = Math.min(10, p.skills[existKey].level + 1);
      } else {
        p.skills[it.id] = { id: it.id, level: 1, evolved: false, timer: 0.25 };
      }
    } else if (it.kind === "held") {
      app.runCoins -= it.cost;
      app.saveData.coins = Math.max(0, app.saveData.coins - it.cost);
      it.bought = true;
      p.heldItems[it.id] = true;
      p.dmgMult *= 1.12;
    } else if (it.id === "pp_up") {
      app.runCoins -= it.cost;
      app.saveData.coins = Math.max(0, app.saveData.coins - it.cost);
      it.bought = true;
      const upgList = Object.values(p.skills).filter(s => s.level < 10);
      if (upgList.length > 0) {
        const pick = upgList[Math.floor(Math.random() * upgList.length)];
        pick.level = Math.min(10, pick.level + 1);
      }
    } else if (it.id === "master_candy") {
      app.runCoins -= it.cost;
      app.saveData.coins = Math.max(0, app.saveData.coins - it.cost);
      it.bought = true;
      p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * 0.30));
      const upgList = Object.values(p.skills).filter(s => s.level < 10);
      if (upgList.length > 0) {
        const pick = upgList[Math.floor(Math.random() * upgList.length)];
        pick.level = Math.min(10, pick.level + 2);
      }
    } else if (it.id === "full_restore") {
      app.runCoins -= it.cost;
      app.saveData.coins = Math.max(0, app.saveData.coins - it.cost);
      it.bought = true;
      p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * 0.45));
      p.status = null;
      p.statusTimer = 0;
    } else if (it.id === "x_attack") {
      app.runCoins -= it.cost;
      app.saveData.coins = Math.max(0, app.saveData.coins - it.cost);
      it.bought = true;
      p.xAttackTimer = 35.0;
    }

    SoundFX.play("levelup");
    this.saveCheckpoint(app, st.currentWave + 1);
    app.refreshHUD();
    this.renderIntermissionModal(app, false);
  },

  confirmForgetAndBuy(oldKey) {
    const app = GameApp;
    const st = app.expeditionState;
    const p = app.player;
    if (!st || !st.pendingForgetTm || !p) return;
    const { item } = st.pendingForgetTm;
    if (app.runCoins < item.cost) {
      st.pendingForgetTm = null;
      this.renderIntermissionModal(app, false);
      return;
    }
    app.runCoins -= item.cost;
    app.saveData.coins = Math.max(0, app.saveData.coins - item.cost);
    delete p.skills[oldKey];
    p.skills[item.id] = { id: item.id, level: 1, evolved: false, timer: 0.25 };
    item.bought = true;
    st.pendingForgetTm = null;
    SoundFX.play("levelup");
    this.saveCheckpoint(app, st.currentWave + 1);
    app.refreshHUD();
    this.renderIntermissionModal(app, false);
  },

  cancelForget() {
    if (GameApp.expeditionState) GameApp.expeditionState.pendingForgetTm = null;
    this.renderIntermissionModal(GameApp, false);
  },

  rerollShop() {
    const app = GameApp;
    const st = app.expeditionState;
    if (!st) return;
    const cost = st.shopRerollCost || 40;
    if (app.runCoins < cost) {
      if (app.pixelToast) app.pixelToast(`代幣不足！刷新需 ${cost} 金`, "warn");
      return;
    }
    app.runCoins -= cost;
    app.saveData.coins = Math.max(0, app.saveData.coins - cost);
    st.shopRerollCost = cost + 30;
    SoundFX.play("hit");
    this.rollIntermissionShop(app);
    this.renderIntermissionModal(app, false);
  },

  proceedToNextWave() {
    this.stopRouteWalkAnim();
    const app = GameApp;
    const st = app.expeditionState;
    if (!st) return;
    const modal = document.getElementById("expeditionModal");
    if (modal) {
      modal.classList.add("hidden");
      modal.style.display = "none";
    }
    this.launchWaveWithCeremony(app, Math.min(st.totalWaves, st.currentWave + 1));
  },

  renderHallOfFameHtml(app) {
    const res = app.lastExpeditionResult;
    const p = app.player;
    const tr = app.selectedTrainer || TRAINERS[0];
    if (!res || !p) return "";
    const trCos = (typeof getResolvedTrainerCostume === "function") ? getResolvedTrainerCostume(tr, app.saveData) : tr;
    const pSpr = (p.isShiny && p.data.shiny_forward_sprite) ? p.data.shiny_forward_sprite : p.data.forward_sprite;
    const partnerImgs = (app.partners || []).map(pt =>
      `<img src="${SpriteCache.resolveUrl(pt.data.forward_sprite)}" class="w-10 h-10 pixel-sprite object-contain" alt="${pt.data.name_zh}"/>`
    ).join("");
    const badgesHtml = (res.chaptersCleared || []).map(ch =>
      `<span style="background:${ch.badgeBg};" class="px-2 py-0.5 rounded-full text-[9px] font-black text-white border border-white/50 shadow">${ch.badgeLabel}</span>`
    ).join("");
    const m = String(Math.floor((res.clearTimeSec || 0) / 60)).padStart(2, "0");
    const s = String((res.clearTimeSec || 0) % 60).padStart(2, "0");

    return `
      <div class="mb-3 rounded-2xl bg-gradient-to-b from-slate-950 via-indigo-950 to-slate-950 border-2 border-amber-400 p-3 text-center shadow-xl">
        <div class="font-pixel text-[9px] text-amber-300 tracking-widest mb-2">HALL OF FAME · 關都殿堂登錄</div>
        <div class="flex items-end justify-center gap-2 py-1.5 bg-slate-900/75 rounded-xl border border-amber-500/40 mb-2">
          <img src="${SpriteCache.resolveUrl(trCos.sprite || tr.sprite)}" class="w-12 h-12 pixel-sprite object-contain" alt="${tr.name}"/>
          <img src="${SpriteCache.resolveUrl(pSpr)}" class="w-16 h-16 pixel-sprite object-contain drop-shadow-[0_0_8px_rgba(250,204,21,0.75)]" alt="${p.data.name_zh}"/>
          ${partnerImgs}
        </div>
        <div class="flex items-center justify-center gap-1 flex-wrap mb-1.5">${badgesHtml}</div>
        <div class="text-[10px] font-bold text-slate-300">總通關耗時 <span class="font-pixel text-amber-300">${m}:${s}</span> · 遠征賞金 <span class="text-emerald-300">+${res.totalGain} 金</span></div>
      </div>
    `;
  }
};
