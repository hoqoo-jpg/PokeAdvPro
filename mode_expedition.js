/**
 * ============================================================================
 * mode_expedition.js (v7.2.7 關都大遠征：RPG 串連地圖 ＋ 10波回合制模式)
 * 職責：
 * 1. 4 幕 10 波 RPG 串連旅程（真新鎮 W1-3 ➔ 華藍海岬 W4-6 ➔ 石英高原 W7-9 ➔ 石英大會鬥技場 W10）
 * 2. GBA 像素風格「關都大遠征路線圖」Canvas 即時繪製（零 Emoji、角色頭像步進、Boss 標記）
 * 3. 波間戰術整備商店（自動推薦克制下波屬性的 TM、適配攜帶物、強化與回血）
 * 4. 自動斷點續關 (saveData.expeditionCheckpoint)
 * ============================================================================
 */

window.ModeExpedition = {
  id: "expedition",

  buildWavePlan(act2BirdId = 144) {
    const birdName = act2BirdId === 145 ? "閃電鳥" : "急凍鳥";
    const birdTypes = act2BirdId === 145 ? ["Electric", "Flying"] : ["Ice", "Flying"];
    return [
      {
        wave: 1, act: 1, stageId: "pallet", isArena: false, isBossWave: false, duration: 28,
        title: "常磐密林・外圍探索",
        subtitle: "野生蟲系與草系精靈出沒，快速升級成型主招。",
        enemyTypes: ["Grass", "Bug", "Normal"],
        enemyPool: [10, 13, 16, 19, 43, 69],
        elitePool: [12, 15],
        previewIds: [10, 16, 43],
        clearBonus: 65,
        weather: "CLEAR"
      },
      {
        wave: 2, act: 1, stageId: "pallet", isArena: false, isBossWave: false, duration: 32,
        title: "密林深處・生態遷徙潮",
        subtitle: "大批飛行與毒系野生精靈湧現，小心遠程毒針！",
        enemyTypes: ["Poison", "Flying", "Bug"],
        enemyPool: [12, 15, 17, 23, 41, 48],
        elitePool: [18, 24, 42],
        previewIds: [12, 23, 41],
        spawnTreasure: "meowth",
        clearBonus: 80,
        weather: "CLEAR"
      },
      {
        wave: 3, act: 1, stageId: "pallet", isArena: false, isBossWave: true, duration: 0,
        title: "ACT 1 關底・火箭隊突襲軍團",
        subtitle: "擊破阿柏怪與雙彈瓦斯雙首領即可突圍前往華藍海岬！",
        enemyTypes: ["Poison", "Normal"],
        enemyPool: [23, 41, 109, 19],
        bossIds: [24, 110],
        bossLabels: ["火箭隊首領・阿柏怪", "火箭隊首領・雙彈瓦斯"],
        previewIds: [24, 110],
        clearBonus: 130,
        actClearHeal: 0.35,
        weather: "CLEAR"
      },
      {
        wave: 4, act: 2, stageId: "cerulean_bay", isArena: false, isBossWave: false, duration: 30,
        title: "華藍海岬・潮汐木棧道",
        subtitle: "涉水將減速 -35%，善用木棧道走位迎戰海岸精靈！",
        enemyTypes: ["Water", "Poison", "Electric"],
        enemyPool: [54, 60, 72, 81, 98, 116],
        elitePool: [62, 73, 117],
        previewIds: [60, 72, 81],
        clearBonus: 95,
        weather: "RAIN"
      },
      {
        wave: 5, act: 2, stageId: "cerulean_bay", isArena: false, isBossWave: false, duration: 35,
        title: "暴風海峽・冰海精銳潮",
        subtitle: "水系與冰系精銳大舉逼近，建議備妥電系或草系克制！",
        enemyTypes: ["Water", "Ice", "Flying"],
        enemyPool: [86, 87, 91, 117, 120, 130],
        elitePool: [87, 91, 130],
        previewIds: [87, 91, 130],
        spawnTreasure: "chansey",
        clearBonus: 115,
        weather: "RAIN"
      },
      {
        wave: 6, act: 2, stageId: "cerulean_bay", isArena: false, isBossWave: true, duration: 0,
        title: `ACT 2 關底・傳說【${birdName}】降臨`,
        subtitle: `擊敗海峽守護神獸【${birdName}】，奪取黃金進化寶箱進軍石英高原！`,
        enemyTypes: birdTypes,
        enemyPool: [86, 91, 117, 120],
        bossIds: [act2BirdId],
        isLegendaryBoss: true,
        previewIds: [act2BirdId],
        clearBonus: 180,
        actClearHeal: 0.40,
        weather: act2BirdId === 145 ? "THUNDER" : "BLIZZARD"
      },
      {
        wave: 7, act: 3, stageId: "sky_pillar", isArena: false, isBossWave: false, duration: 32,
        title: "石英高原・古神殿柱廊",
        subtitle: "大理石大道移速 +10%，小心超能重力陣與幽靈突襲！",
        enemyTypes: ["Psychic", "Ghost", "Rock"],
        enemyPool: [64, 75, 93, 95, 105, 111],
        elitePool: [65, 94, 112],
        previewIds: [64, 93, 95],
        clearBonus: 120,
        weather: "PSYCHIC"
      },
      {
        wave: 8, act: 3, stageId: "sky_pillar", isArena: false, isBossWave: false, duration: 36,
        title: "冠軍之路・遠古化石覺醒",
        subtitle: "遠古化石霸主與重裝龍系傾巢而出，衝刺 Lv.10 超武突破！",
        enemyTypes: ["Rock", "Dragon", "Fighting"],
        enemyPool: [68, 112, 139, 141, 142, 148],
        elitePool: [139, 141, 142],
        previewIds: [141, 142, 148],
        clearBonus: 145,
        weather: "PSYCHIC"
      },
      {
        wave: 9, act: 3, stageId: "sky_pillar", isArena: false, isBossWave: true, duration: 0,
        title: "ACT 3 關底・烈焰鳥神殿試煉",
        subtitle: "討伐烈焰神鳥【火焰鳥】，正式踏入石英大會冠軍競技場！",
        enemyTypes: ["Fire", "Flying"],
        enemyPool: [59, 78, 126, 142],
        bossIds: [146],
        isLegendaryBoss: true,
        previewIds: [146],
        clearBonus: 220,
        actClearHeal: 0.45,
        weather: "HEATWAVE"
      },
      {
        wave: 10, act: 4, stageId: "sky_pillar", isArena: true, isBossWave: true, duration: 0,
        title: "FINAL ACT・石英大會終極決戰",
        subtitle: "封閉石柱競技場（可使用 [SHIFT] 閃避衝刺）！討伐王者【超夢】加冕遠征冠軍！",
        enemyTypes: ["Psychic"],
        enemyPool: [],
        bossIds: [150],
        isLegendaryBoss: true,
        isFinalArena: true,
        previewIds: [150],
        clearBonus: 420,
        weather: "PSYCHIC"
      }
    ];
  },

  onStart(app) {
    app.isExpeditionMode = true;
    app.isEndlessMode = false;
    app.isArenaMode = false;
    app._pendingExpeditionIntermission = false;
    app.lastExpeditionResult = null;

    const resumeCp = app._resumeExpeditionCheckpoint || null;
    app._resumeExpeditionCheckpoint = null;

    const act2BirdId = resumeCp
      ? (resumeCp.act2BirdId || 144)
      : (Math.random() < 0.5 ? 144 : 145);

    app.expeditionState = {
      currentWave: resumeCp ? Math.max(1, Math.min(10, resumeCp.nextWave || 1)) : 1,
      act2BirdId,
      plan: this.buildWavePlan(act2BirdId),
      waveTimer: 0,
      spawnCd: 0.6,
      eliteSpawnedCount: 0,
      treasureSpawned: false,
      waveCleared: false,
      clearDelayTimer: 0,
      shopShelf: [],
      shopRerollCost: 40,
      pendingForgetTm: null
    };

    if (resumeCp) {
      this.applyCheckpointToRun(app, resumeCp);
    }

    this.startWave(app, app.expeditionState.currentWave);
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
    p.finalEvoArmor = sp.finalEvoArmor || 0;
    p.megaEvolved = !!sp.megaEvolved;
    p.singleStageAwakened = !!sp.singleStageAwakened;
    p.legendaryAwaken12 = !!sp.legendaryAwaken12;
    p.legendaryAwaken24 = !!sp.legendaryAwaken24;
    p.underdogExpBonus = sp.underdogExpBonus || 0;
    p.heldItems = { ...(sp.heldItems || {}) };
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
    const skillsSnap = {};
    Object.entries(p.skills || {}).forEach(([k, sk]) => {
      skillsSnap[k] = { id: sk.id, level: sk.level, evolved: !!sk.evolved };
    });
    app.saveData.expeditionCheckpoint = {
      nextWave,
      act2BirdId: app.expeditionState.act2BirdId || 144,
      trainerId: (app.selectedTrainer && app.selectedTrainer.id) || "ash",
      starterId: app.selectedStarterId || 25,
      difficultyId: (app.selectedDifficulty && app.selectedDifficulty.id) || "normal",
      kills: app.kills || 0,
      runCoins: app.runCoins || 0,
      runTime: app.runTime || 0,
      partners: (app.partners || []).map(pt => ({ id: pt.id, level: pt.level })),
      player: {
        id: p.id, level: p.level, exp: p.exp, nextExp: p.nextExp,
        hp: Math.ceil(p.hp), maxHp: p.maxHp, baseAtk: p.baseAtk, baseSpeed: p.baseSpeed,
        dmgMult: p.dmgMult, cdMult: p.cdMult, speedMult: p.speedMult, areaMult: p.areaMult,
        critRate: p.critRate, finalEvoArmor: p.finalEvoArmor || 0,
        megaEvolved: !!p.megaEvolved,
        singleStageAwakened: !!p.singleStageAwakened,
        legendaryAwaken12: !!p.legendaryAwaken12,
        legendaryAwaken24: !!p.legendaryAwaken24,
        underdogExpBonus: p.underdogExpBonus || 0,
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

  startWave(app, waveNum) {
    const st = app.expeditionState;
    if (!st) return;
    const cfg = st.plan[waveNum - 1];
    if (!cfg) return;

    st.currentWave = waveNum;
    st.waveTimer = cfg.duration || 0;
    st.spawnCd = 0.55;
    st.eliteSpawnedCount = 0;
    st.treasureSpawned = false;
    st.waveCleared = false;
    st.clearDelayTimer = 0;

    // 1. 切換地圖與天候
    const isFinalArena = !!cfg.isArena;
    app.isArenaMode = isFinalArena;
    if (typeof MapEngine !== "undefined") {
      if (MapEngine.setArenaMode) MapEngine.setArenaMode(isFinalArena);
      if (!isFinalArena && MapEngine.setStage) MapEngine.setStage(cfg.stageId);
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
        p.arenaFuryTimer = 0;
        p.arenaGaleTimer = 0;
        p.arenaShieldTimer = 0;
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

    app.battleCountdownTimer = 1.14;
    app._lastCountdownBeat = 4;
    app.showCutsceneBanner(
      `【WAVE ${waveNum}/10 ‧ ${cfg.title}】`,
      cfg.subtitle,
      3000
    );
    app.state = "PLAYING";
    app.refreshHUD();
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

    if (st.waveCleared) {
      st.clearDelayTimer -= dt;
      if (st.clearDelayTimer <= 0) {
        this.openIntermissionModal(app);
      }
      return;
    }

    if (cfg.isBossWave) {
      const aliveBosses = app.enemies.filter(e => e.isExpeditionBoss && e.hp > 0);
      if (aliveBosses.length === 0) {
        if (st.currentWave >= 10) {
          this.handleExpeditionVictory(app);
        } else {
          this.completeWave(app, cfg);
        }
        return;
      }
    } else {
      st.waveTimer = Math.max(0, st.waveTimer - dt);
      if (st.waveTimer <= 0) {
        this.completeWave(app, cfg);
        return;
      }
    }

    if (cfg.enemyPool && cfg.enemyPool.length > 0) {
      st.spawnCd -= dt;
      const cap = cfg.isBossWave ? 18 : Math.min(72, 26 + st.currentWave * 6);
      if (st.spawnCd <= 0 && app.enemies.length < cap) {
        const batch = cfg.isBossWave ? 2 : Math.min(5, 2 + Math.floor(st.currentWave / 3));
        st.spawnCd = cfg.isBossWave ? 2.4 : Math.max(0.75, 1.38 - st.currentWave * 0.06);
        for (let i = 0; i < batch; i++) {
          const needElite = !cfg.isBossWave && cfg.elitePool && cfg.elitePool.length > 0 && st.eliteSpawnedCount < Math.ceil(st.currentWave / 3) && st.waveTimer < (cfg.duration * 0.62) && i === 0;
          if (needElite) st.eliteSpawnedCount += 1;
          this.spawnWaveMob(app, cfg, needElite);
        }
      }
      if (cfg.spawnTreasure && !st.treasureSpawned && st.waveTimer < cfg.duration * 0.55) {
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
    const hpScale = (1 + (w - 1) * 0.36) * (diff.hpMult || 1.0);
    const baseHp = Math.round((pData.hp * 0.58 + 22) * hpScale * (isElite ? 3.2 : 1.0));
    const atkVal = Math.round((8 + w * 1.6) * (diff.atkMult || 1.0) * (isElite ? 1.45 : 1.0));
    const spdVal = Math.min(115, (52 + pData.speed * 0.30) * (isElite ? 1.08 : 1.0));
    const ang = Math.random() * Math.PI * 2;
    const dist = Math.max(app.width, app.height) * 0.52 + 38 + Math.random() * 55;
    app.saveData.pokedexSeen[pData.id] = true;

    app.enemies.push({
      id: pData.id,
      data: pData,
      x: p.x + Math.cos(ang) * dist,
      y: p.y + Math.sin(ang) * dist,
      hp: baseHp,
      maxHp: baseHp,
      atk: atkVal,
      speed: spdVal,
      radius: isElite ? 26 : 18,
      isElite,
      isBoss: false,
      isShiny: Math.random() < 0.008,
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
    if (st.currentWave >= 10) {
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
    st.clearDelayTimer = 0.65;

    app.enemies.forEach(en => {
      app.spawnParticleCluster(en.x, en.y, "#FACC15", "#FFFFFF", 5, "star", 0.9);
    });
    app.enemies = [];
    app.enemyProjectiles = [];
    app.telegraphs = [];
    app.activeBoss = null;
    const bossHud = document.getElementById("bossHudContainer");
    if (bossHud) bossHud.classList.add("hidden");

    const diffMult = (app.selectedDifficulty && app.selectedDifficulty.coinMult) || 1.0;
    const bonusCoins = Math.round((cfg.clearBonus || 80) * diffMult);
    app.runCoins += bonusCoins;
    app.saveData.coins += bonusCoins;

    const p = app.player;
    if (p) {
      const healPct = cfg.actClearHeal || 0.20;
      const healAmt = Math.round(p.maxHp * healPct);
      p.hp = Math.min(p.maxHp, p.hp + healAmt);
      p.status = null;
      p.statusTimer = 0;
      app.spawnFloatingText(p.x, p.y - 34, `WAVE ${cfg.wave} 通關！+${bonusCoins} 金 ‧ +${healAmt} HP`, "#34D399", 15);
    }

    let totalGemExp = 0;
    app.gems.forEach(g => { totalGemExp += (g.val || 15); });
    app.gems = [];
    if (totalGemExp > 0) {
      app.gainExp(totalGemExp);
    }

    SoundFX.play("levelup");
    this.saveCheckpoint(app, st.currentWave + 1);

    if (app.state === "PAUSED" || app.state === "EVOLVING") {
      app._pendingExpeditionIntermission = true;
      st.clearDelayTimer = 0;
    }
  },

  handleExpeditionVictory(app) {
    this.clearCheckpoint(app);
    const diffMult = (app.selectedDifficulty && app.selectedDifficulty.coinMult) || 1.0;
    const clearCoins = Math.round(420 * diffMult);
    app.runCoins += clearCoins;
    app.saveData.coins += clearCoins;
    if (!app.saveData.stats.expeditionClears) app.saveData.stats.expeditionClears = 0;
    app.saveData.stats.expeditionClears += 1;
    app.lastExpeditionResult = {
      clearedWaves: 10,
      totalGain: clearCoins
    };
    if (app.saveToStorage) app.saveToStorage();
    app.showCutsceneBanner(
      "關都大遠征 10/10 制霸！CHAMPION!",
      `貫穿四大區域並討伐王者超夢！獲得遠征冠軍賞金 +${clearCoins} 代幣！`,
      2600
    );
    app.startVictoryCeremony();
  },

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
    this.renderIntermissionModal(app);

    const modal = document.getElementById("expeditionModal");
    if (modal) {
      modal.classList.remove("hidden");
      modal.style.display = "flex";
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

  renderIntermissionModal(app) {
    const st = app.expeditionState;
    const p = app.player;
    if (!st || !p) return;
    const clearedWave = st.currentWave;
    const nextWave = Math.min(10, clearedWave + 1);
    const nextCfg = st.plan[nextWave - 1];
    const curStageObj = STAGES.find(s => s.id === nextCfg.stageId) || STAGES[0];

    const titleEl = document.getElementById("expModalTitle");
    if (titleEl) titleEl.textContent = `KANTO EXPEDITION · WAVE ${clearedWave}/10 CLEAR`;

    const coinEl = document.getElementById("expCoinsDisplay");
    if (coinEl) coinEl.textContent = app.runCoins.toLocaleString();

    const hpEl = document.getElementById("expHpDisplay");
    if (hpEl) hpEl.textContent = `HP ${Math.ceil(p.hp)}/${p.maxHp}`;

    const rerollCostEl = document.getElementById("expRerollCostText");
    if (rerollCostEl) rerollCostEl.textContent = st.shopRerollCost || 40;

    const nextBtnEl = document.getElementById("btnExpStartNextWave");
    if (nextBtnEl) {
      nextBtnEl.textContent = nextWave === 10
        ? "踏入石英大會鬥技場 · 最終決戰 →"
        : `出發！第 ${nextWave} 波（${nextCfg.title}） →`;
    }

    const routeCan = document.getElementById("expeditionRouteCanvas");
    if (routeCan) {
      this.drawGbaRouteMapCanvas(routeCan, app, clearedWave, nextWave);
    }

    const intelBox = document.getElementById("expNextWaveIntelBox");
    if (intelBox) {
      const typeBadges = (nextCfg.enemyTypes || []).map(t => renderTypeBadgeHTML(t)).join("");
      const enemySprites = (nextCfg.previewIds || []).map(pid => {
        const pd = POKEMON_MAP.get(pid);
        return pd
          ? `<div class="w-9 h-9 rounded-lg bg-slate-950 border ${nextCfg.isBossWave ? 'border-rose-500' : 'border-slate-600'} flex items-center justify-center shrink-0" title="${pd.name_zh}">
               <img src="${SpriteCache.resolveUrl(pd.forward_sprite)}" class="w-8 h-8 pixel-sprite object-contain" alt="${pd.name_zh}"/>
             </div>`
          : "";
      }).join("");

      const stageBadgeText = nextCfg.isArena
        ? "石英大會鬥技場（石柱掩體 ‧ [SHIFT] 閃避可用）"
        : `${curStageObj.name}（${curStageObj.buffDesc}）`;

      intelBox.innerHTML = `
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0 flex-1 space-y-1">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="px-1.5 py-0.5 rounded bg-red-600 text-white font-pixel text-[8px] font-black">NEXT WAVE ${nextWave}/10</span>
              <span class="font-black text-xs text-amber-300 truncate">${nextCfg.title}</span>
              ${nextCfg.isBossWave ? '<span class="px-1.5 py-0.5 rounded bg-rose-900 border border-rose-400 text-rose-200 font-pixel text-[8px]">BOSS</span>' : ''}
            </div>
            <div class="text-[10px] font-bold text-sky-300 leading-snug">${stageBadgeText}</div>
            <div class="flex items-center gap-1 flex-wrap pt-0.5">
              <span class="text-[10px] font-bold text-slate-400">主要屬性：</span>
              ${typeBadges}
            </div>
          </div>
          <div class="flex items-center gap-1 shrink-0">${enemySprites}</div>
        </div>
      `;
    }

    const shopBox = document.getElementById("expShopContainer");
    if (!shopBox) return;

    if (st.pendingForgetTm) {
      const pend = st.pendingForgetTm;
      const newMeta = SKILLS_CATALOG[pend.item.id];
      shopBox.innerHTML = `
        <div class="bg-amber-950/75 border border-amber-400 rounded-xl p-2.5 space-y-2">
          <div class="text-[11px] font-black text-amber-300">招式槽已滿！請選擇要遺忘的招式以學習【${newMeta ? newMeta.name : pend.item.name}】：</div>
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

    shopBox.innerHTML = (st.shopShelf || []).map((it, idx) => {
      let tagHtml = "";
      if (it.kind === "tm") {
        const owned = findOwned(it.id);
        if (owned) {
          tagHtml = `<span class="px-1.5 py-0.2 rounded bg-emerald-900/80 border border-emerald-400/60 text-emerald-300 text-[9px] font-black">Lv.${owned.level} ➔ Lv.${Math.min(10, owned.level + 1)}</span>`;
        } else if (curCount >= maxSlots) {
          tagHtml = `<span class="px-1.5 py-0.2 rounded bg-amber-900/80 border border-amber-400/60 text-amber-300 text-[9px] font-black">替換學習</span>`;
        }
        if (it.isCounterRec) {
          tagHtml += `<span class="px-1.5 py-0.2 rounded bg-sky-700 text-white text-[9px] font-black">克制推薦</span>`;
        }
      } else if (it.kind === "held") {
        tagHtml = `<span class="px-1.5 py-0.2 rounded bg-purple-800 text-purple-100 text-[9px] font-black">${it.isStageRec ? '海域推薦' : '攜帶物'}</span>`;
      }

      const iconHtml = (it.kind === "tm" && typeof renderSkillIconHTML === "function")
        ? renderSkillIconHTML(it.id, "w-7 h-7")
        : `<img src="${SpriteCache.resolveUrl(it.sprite)}" class="w-7 h-7 pixel-sprite object-contain" alt="${it.name}"/>`;

      return `
        <div class="bg-slate-800/95 p-2 rounded-xl border ${it.bought ? 'border-slate-700 opacity-55' : 'border-slate-600'} flex items-center justify-between gap-2">
          <div class="flex items-center gap-2 min-w-0 flex-1">
            <div class="w-9 h-9 bg-slate-950 rounded-lg border border-slate-700 flex items-center justify-center shrink-0">${iconHtml}</div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1 flex-wrap">
                <span class="font-black text-xs text-white truncate">${it.kind === "tm" ? `${it.tmNo || 'TM'} ${it.name}` : it.name}</span>
                ${tagHtml}
              </div>
              <div class="text-[10px] text-slate-300 leading-tight truncate">${it.desc}</div>
            </div>
          </div>
          ${it.bought
            ? `<span class="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 font-pixel text-[9px] text-emerald-400 shrink-0">SOLD</span>`
            : `<button onclick="ModeExpedition.buyShopItem(${idx})" class="poke-btn-yellow px-2.5 py-1.5 text-xs font-black shrink-0 flex items-center gap-1">
                 <img src="${ITEM_SPRITES.coin}" class="w-3.5 h-3.5 pixel-sprite"/>
                 <span>${it.cost}</span>
               </button>`
          }
        </div>
      `;
    }).join("");
  },

  drawGbaRouteMapCanvas(canvas, app, clearedWave, nextWave) {
    const w = canvas.width = 440;
    const h = canvas.height = 108;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;

    ctx.fillStyle = "#3E6B38";
    ctx.fillRect(0, 0, 138, h);
    ctx.fillStyle = "#2E5229";
    for (let x = 8; x < 130; x += 22) {
      ctx.fillRect(x, 12, 10, 8);
      ctx.fillRect(x + 6, 84, 10, 8);
    }
    ctx.fillStyle = "#0369A1";
    ctx.fillRect(138, 0, 126, h);
    ctx.fillStyle = "#38BDF8";
    for (let x = 148; x < 256; x += 26) {
      ctx.fillRect(x, 18, 12, 2);
      ctx.fillRect(x + 8, 86, 12, 2);
    }
    ctx.fillStyle = "#2E2447";
    ctx.fillRect(264, 0, 112, h);
    ctx.fillStyle = "#4C3B75";
    for (let x = 272; x < 370; x += 22) {
      ctx.fillRect(x, 14, 14, 4);
      ctx.fillRect(x, 86, 14, 4);
    }
    ctx.fillStyle = "#334155";
    ctx.fillRect(376, 0, 64, h);
    ctx.fillStyle = "#B91C1C";
    ctx.fillRect(380, 6, 56, 6);
    ctx.fillStyle = "#F59E0B";
    ctx.fillRect(380, 96, 56, 4);

    ctx.strokeStyle = "rgba(15, 23, 42, 0.7)";
    ctx.lineWidth = 2;
    [138, 264, 376].forEach(bx => {
      ctx.beginPath(); ctx.moveTo(bx, 0); ctx.lineTo(bx, h); ctx.stroke();
    });

    const zones = [
      { x: 69,  label: "ACT 1 常磐密林", col: "#BBF7D0" },
      { x: 201, label: "ACT 2 華藍海岬", col: "#BAE6FD" },
      { x: 320, label: "ACT 3 石英高原", col: "#E9D5FF" },
      { x: 408, label: "FINAL 鬥技場",  col: "#FDE047" }
    ];
    ctx.font = "bold 9px 'Noto Sans TC', sans-serif";
    ctx.textAlign = "center";
    zones.forEach(z => {
      ctx.fillStyle = "rgba(15, 23, 42, 0.72)";
      ctx.fillRect(z.x - 32, 3, 64, 14);
      ctx.fillStyle = z.col;
      ctx.fillText(z.label, z.x, 13);
    });

    const nodes = [
      { x: 26,  y: 58 }, { x: 68,  y: 44 }, { x: 112, y: 60 },
      { x: 158, y: 46 }, { x: 201, y: 62 }, { x: 244, y: 46 },
      { x: 286, y: 60 }, { x: 324, y: 44 }, { x: 358, y: 60 },
      { x: 408, y: 54 }
    ];

    ctx.lineCap = "round";
    for (let i = 0; i < nodes.length - 1; i++) {
      const a = nodes[i], b = nodes[i + 1];
      const passed = (i + 1) <= clearedWave;
      ctx.strokeStyle = "#0F172A";
      ctx.lineWidth = 7;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.strokeStyle = passed ? "#FACC15" : "#94A3B8";
      ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }

    const st = app.expeditionState;
    nodes.forEach((pt, idx) => {
      const wNum = idx + 1;
      const cfg = st.plan[idx];
      const isBoss = !!(cfg && cfg.isBossWave);
      const isCleared = wNum <= clearedWave;
      const isNext = wNum === nextWave;
      const r = isBoss ? 10 : 7;

      ctx.fillStyle = "#0F172A";
      ctx.beginPath(); ctx.arc(pt.x, pt.y, r + 2.5, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = isCleared ? "#22C55E" : (isNext ? "#EF4444" : (isBoss ? "#7F1D1D" : "#334155"));
      ctx.beginPath(); ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 8px monospace";
      ctx.textAlign = "center";
      ctx.fillText(isCleared ? "OK" : String(wNum), pt.x, pt.y + 3);

      if (isNext) {
        ctx.strokeStyle = "#FEF08A";
        ctx.lineWidth = 2.2;
        ctx.strokeRect(pt.x - 13, pt.y - 13, 26, 26);

        const pData = app.player && app.player.data;
        if (pData && pData.forward_sprite) {
          const rec = SpriteCache.get(pData.forward_sprite);
          if (rec && rec.loaded) {
            ctx.drawImage(rec.img, pt.x - 15, pt.y - 34, 30, 30);
          }
        }
      } else if (isBoss && !isCleared && cfg.previewIds && cfg.previewIds[0]) {
        const bData = POKEMON_MAP.get(cfg.previewIds[0]);
        if (bData && bData.forward_sprite) {
          const rec = SpriteCache.get(bData.forward_sprite);
          if (rec && rec.loaded) {
            ctx.drawImage(rec.img, pt.x - 12, pt.y + 8, 24, 24);
          }
        }
      }

      ctx.fillStyle = isNext ? "#FEF08A" : "#CBD5E1";
      ctx.font = "bold 8px monospace";
      ctx.fillText(`W${wNum}`, pt.x, h - 5);
    });

    ctx.strokeStyle = "#F59E0B";
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, w - 3, h - 3);
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
        this.renderIntermissionModal(app);
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
    this.renderIntermissionModal(app);
  },

  confirmForgetAndBuy(oldKey) {
    const app = GameApp;
    const st = app.expeditionState;
    const p = app.player;
    if (!st || !st.pendingForgetTm || !p) return;
    const { item } = st.pendingForgetTm;
    if (app.runCoins < item.cost) {
      st.pendingForgetTm = null;
      this.renderIntermissionModal(app);
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
    this.renderIntermissionModal(app);
  },

  cancelForget() {
    if (GameApp.expeditionState) GameApp.expeditionState.pendingForgetTm = null;
    this.renderIntermissionModal(GameApp);
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
    this.renderIntermissionModal(app);
  },

  proceedToNextWave() {
    const app = GameApp;
    const st = app.expeditionState;
    if (!st) return;
    const modal = document.getElementById("expeditionModal");
    if (modal) {
      modal.classList.add("hidden");
      modal.style.display = "none";
    }
    this.startWave(app, Math.min(10, st.currentWave + 1));
  }
};
