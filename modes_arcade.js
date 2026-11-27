/**
 * ============================================================================
 * modes_arcade.js (v7.3.5 9 檔架構整理・方案 B：街機與單挑模式整合控制器)
 * 整合原本的 mode_survivor.js（8 分鐘標準 ／ 無盡深淵）與 mode_arena.js（1vs1 石英鬥技場），
 * 釋放 1 個專案檔位供後續 v7.4.0 六邊形評級與排行榜模組擴充使用。
 * ============================================================================
 */

/**
 * ============================================================================
 * mode_survivor.js (v7.2.0 第二刀解耦：8 分鐘標準 ／ 無盡深淵模式控制器)
 * 職責：
 * 1. 封裝 8 分鐘標準通關與無盡深淵波次時間軸 (updateSpawners)
 * 2. 管理野生怪潮、寶藏精靈、友好商店、生態遷徙、遠古試煉與神獸降臨預警
 * ============================================================================
 */

window.GameApp = window.GameApp || {};

Object.assign(window.GameApp, {
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
      isDebug ? "【6:30 遠古化石試煉 (DEBUG)】" : "【6:30 冠軍之路・遠古化石試煉】",
      "8 隻遠古霸主【化石翼龍 ＆ 鐮刀盔 ＆ 多刺菊石獸】八角包夾！擊破領頭霸主必掉神奇糖果！",
      3800
    );
    SoundFX.play("boss");
    this.camera.shakeTime = Math.max(this.camera.shakeTime || 0, 0.35);
    this.camera.shakeMagnitude = Math.max(this.camera.shakeMagnitude || 0, 7);

    const mins = Math.max(6.5, this.runTime / 60);
    const timeHpScale = 1 + (mins * 0.60) + Math.pow(mins / 3.0, 1.8) * 0.55;
    const ids = [142, 141, 139, 142, 141, 139, 142, 141];
    ids.forEach((pId, idx) => {
      const ang = (idx * Math.PI * 2) / ids.length + Math.PI / 8;
      const ex = this.player.x + Math.cos(ang) * 330;
      const ey = this.player.y + Math.sin(ang) * 330;
      const pData = POKEMON_MAP.get(pId);
      const isLead = (idx === 0 || idx === 4);
      const hp = Math.round((isLead ? 920 : 680) * timeHpScale * this.selectedDifficulty.hpMult);
      this.saveData.pokedexSeen[pId] = true;
      this.enemies.push({
        id: pId, data: pData, x: ex, y: ey,
        hp, maxHp: hp,
        atk: Math.round((isLead ? 38 : 32) * this.selectedDifficulty.atkMult),
        speed: (isLead ? 116 : 108) * this.selectedDifficulty.spdMult,
        radius: isLead ? 32 : 28,
        isElite: true,
        noEliteDrop: !isLead,
        guaranteedRareCandy: isLead,
        isBoss: false, isShiny: false,
        facingX: -1, facingY: 1, status: null, statusTimer: 0, statusTick: 0,
        ccImmunityTimer: 1.8, rangedCd: 1.5, whiteFlashTimer: 0, weightTier: "heavy", kbResist: 0.85
      });
    });
  },

  triggerBossWarningSequence(bossId, isFinalMewtwo = false, opts = {}) {
    const bData = POKEMON_MAP.get(bossId);
    if (!bData) return;

    const weatherMap = { 144: "BLIZZARD", 145: "THUNDER", 146: "HEATWAVE", 150: "PSYCHIC", 151: "PSYCHIC" };
    const wType = weatherMap[bossId] || "THUNDER";
    const wNames = { BLIZZARD: "極寒暴雪", THUNDER: "狂暴雷暴", HEATWAVE: "烈日熱浪", PSYCHIC: "超能極光" };

    // 使用獨立 bossWeatherLock（不再誤鎖 debugWeatherLock），確保 Boss 討伐後恢復常規動態天候輪替
    this.bossWeatherLock = true;
    if (!opts.skipWeather) {
      MapEngine.setWeather(wType);
      this.updateWeatherUI(wType);
    }

    if (!opts.skipBanner) {
      SoundFX.play("boss");
      this.showCutsceneBanner(
        "【⚠️ WARNING!! 神獸降臨預警】",
        `天地異變！氣候轉為【${wNames[wType] || wType}】！傳說精靈【${bData.name_zh}】即將在預警點降臨！`,
        2400
      );
    }

    const ang = (opts.angle !== undefined) ? opts.angle : (Math.random() * Math.PI * 2);
    const dropDist = opts.isDualBoss ? 255 : 280;
    const dropX = this.player.x + Math.cos(ang) * dropDist;
    const dropY = this.player.y + Math.sin(ang) * dropDist;

    this.telegraphs.push({
      shape: "circle",
      isBossWarning: true,
      bossId: bossId,
      isFinalMewtwo: isFinalMewtwo,
      isDualBoss: !!opts.isDualBoss,
      x: dropX,
      y: dropY,
      radius: 95,
      timer: 1.8,
      maxTime: 1.8,
      dmg: 0,
      color: opts.isDualBoss ? "#F59E0B" : "#EF4444"
    });
  },

  spawnBoss(bossId, isFinalMewtwo = false, opts = {}) {
    this.triggerBossWarningSequence(bossId, isFinalMewtwo, opts);
  },

  spawnBossAt(bossId, bx, by, isFinalMewtwo = false, isDualBoss = false) {
    const bData = POKEMON_MAP.get(bossId);
    const diff = this.selectedDifficulty;
    const endlessWave = (this.isEndlessMode && this.runTime >= 480) ? Math.max(1, Math.floor((this.runTime - 480) / 120) + 1) : 0;
    const endlessHpScale = 1 + endlessWave * 0.45;
    const dualHpMod = isDualBoss ? 0.72 : 1.0;
    const hp = Math.round((isFinalMewtwo ? 20000 : 9500) * diff.hpMult * endlessHpScale * dualHpMod);

    SoundFX.startBgm("boss");
    this.camera.shakeTime = 0.65;
    this.camera.shakeMagnitude = 16;
    SoundFX.play("ultimate");

    this.spawnParticleCluster(bx, by, "#EF4444", "#F59E0B", 36, "star", 1.8);
    SkillsEngine.meleeEffects.push({
      style: "slam_wave",
      x: bx,
      y: by,
      radius: 165,
      timer: 0.48,
      maxTime: 0.48,
      color: "#EF4444"
    });

    // 神獸降臨霸王氣場清場：保留最多 20 隻常規小怪，超出的常規怪被威壓直接嚇散消失（不掉落經驗，杜絕蓄怪取巧）
    const regularMobs = this.enemies.filter(en => !en.isBoss && !en.isElite && !en.treasureType);
    if (regularMobs.length > 20) {
      let toClear = regularMobs.length - 20;
      let puffCount = 0;
      for (let i = this.enemies.length - 1; i >= 0 && toClear > 0; i--) {
        const en = this.enemies[i];
        if (!en.isBoss && !en.isElite && !en.treasureType) {
          if (puffCount < 16 && this.player && Math.abs(en.x - this.player.x) < this.width * 0.55 && Math.abs(en.y - this.player.y) < this.height * 0.55) {
            this.spawnParticleCluster(en.x, en.y, "#94A3B8", "#E2E8F0", 4, "circle", 0.55);
            puffCount++;
          }
          this.enemies[i] = this.enemies[this.enemies.length - 1];
          this.enemies.pop();
          toClear--;
        }
      }
      if (this.player) {
        this.spawnFloatingText(this.player.x, this.player.y - 36, "⚡ 神獸威壓驅散小怪！決鬥舞台開啟！", "#FACC15", 13);
      }
    }

    this.saveData.pokedexSeen[bossId] = true;
    const boss = {
      id: bossId,
      data: bData,
      x: bx,
      y: by,
      hp,
      maxHp: hp,
      atk: Math.round((isFinalMewtwo ? 42 : 30) * diff.atkMult),
      speed: Math.min(132, (isFinalMewtwo ? 106 : 94) * diff.spdMult),
      endlessRewardMult: 1 + endlessWave * 0.35,
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
          atk: 24, speed: 75, radius: 26, isElite: true, noEliteDrop: true, isBoss: false, isShiny: false,
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
          atk: 32, speed: 130, radius: 28, isElite: true, noEliteDrop: true, isBoss: false, isShiny: false,
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

    if (!this.prehistoricEventTriggered && this.runTime >= 390) {
      this.prehistoricEventTriggered = true;
      this.triggerPrehistoricTrialEvent(false);
    }

    if (!this.mewtwoBossSpawned && this.runTime >= 450) {
      this.mewtwoBossSpawned = true;
      this.spawnBoss(150, true);
    }

    // 【超夢 ➔ 夢幻 4.5 秒喘息與戰利品回收緩衝】
    if (this.pendingMewTimer > 0) {
      this.pendingMewTimer -= dt;
      if (this.pendingMewTimer <= 0) {
        this.pendingMewTimer = 0;
        this.spawnBoss(151, false);
        this.showCutsceneBanner(
          "[終極試煉] 始祖之影降臨！【夢幻 #151】甦醒！",
          "關都最後的傳說考驗展開，擊破始祖夢幻登頂冠軍寶座！",
          3600
        );
      }
    }

    // 【♾️ 無盡深淵試煉模式】8:00 (480s) 後每 120 秒輪迴降臨：奇數輪單神、偶數輪「雙神同場對決」！
    const hasPendingBossEvent = (this.pendingMewTimer > 0)
      || this.telegraphs.some(t => t.isBossWarning)
      || (this.bossDeathAnims && this.bossDeathAnims.length > 0);
    if (this.isEndlessMode && this.runTime >= (this.endlessNextBossTime || 480) && !this.activeBoss && !hasPendingBossEvent) {
      this.endlessNextBossTime = Math.floor(this.runTime) + 120;
      this.endlessCycleIdx = (this.endlessCycleIdx || 0) + 1;
      const cycleWave = this.endlessCycleIdx;

      if (cycleWave % 2 === 0) {
        // 偶數輪：無盡深淵專屬「雙神對角降臨」
        const dualPairs = [
          [144, 145], // 急凍鳥 ＋ 閃電鳥
          [145, 146], // 閃電鳥 ＋ 火焰鳥
          [150, 151]  // 超夢 ＋ 夢幻
        ];
        const pair = dualPairs[(Math.floor(cycleWave / 2) - 1) % dualPairs.length];
        const n1 = POKEMON_MAP.get(pair[0])?.name_zh || "傳說神獸";
        const n2 = POKEMON_MAP.get(pair[1])?.name_zh || "傳說神獸";
        const baseAng = Math.random() * Math.PI * 2;

        SoundFX.play("boss");
        this.showCutsceneBanner(
          `【♾️ 無盡雙神降臨・第 ${cycleWave} 輪天災】`,
          `深淵裂隙雙重崩壞！【${n1}】與【${n2}】自對角同時降臨戰場！`,
          3600
        );
        this.spawnBoss(pair[0], pair[0] === 150, { angle: baseAng, isDualBoss: true, skipBanner: true });
        this.spawnBoss(pair[1], pair[1] === 150, { angle: baseAng + Math.PI, isDualBoss: true, skipBanner: true, skipWeather: true });
      } else {
        const singleList = [144, 145, 146, 150, 151];
        const nextBossId = singleList[Math.floor(cycleWave / 2) % singleList.length];
        this.showCutsceneBanner(
          `【♾️ 無盡深淵・第 ${cycleWave} 輪天災】`,
          `深淵裂隙擴張！神獸【${POKEMON_MAP.get(nextBossId)?.name_zh || '傳說神獸'}】降臨，賞金倍率持續飆升！`,
          3400
        );
        this.spawnBoss(nextBossId, nextBossId === 150);
      }
    }

    // 經驗磁鐵改為「戰鬥掉落 ＋ 場上散落水晶累積超過 45 顆時動態補給」，場上最多只存在 1 顆，不再定時憑空空投
    this.magnetSpawnTimer = Math.max(0, this.magnetSpawnTimer - dt);
    if (this.magnetSpawnTimer <= 0) {
      const activeMagnets = this.mapItems.filter(i => i.id === "magnet").length;
      if (activeMagnets < 1) {
        const looseGems = this.gems.filter(g => !g.magnetized).length;
        if (looseGems >= 45) {
          this.magnetSpawnTimer = 28;
          const ang = Math.random() * Math.PI * 2;
          this.spawnMapLoot("magnet", this.player.x + Math.cos(ang) * 235, this.player.y + Math.sin(ang) * 235);
        } else {
          this.magnetSpawnTimer = 3.0;
        }
      } else {
        this.magnetSpawnTimer = 5.0;
      }
    }

    this.treasureSpawnTimer -= dt;
    if (this.treasureSpawnTimer <= 0) {
      this.treasureSpawnTimer = 38;
      const isMeowth = Math.random() < 0.58;
      this.spawnTreasureMonster(isMeowth ? "meowth" : "chansey");
    }

    if (this.debugStopSpawn) return;
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
    const ex = this.player.x + Math.cos(ang) * 285;
    const ey = this.player.y + Math.sin(ang) * 285;
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
      speed: kind === "meowth" ? 104 : 58,
      radius: 24,
      isElite: false,
      isBoss: false,
      isShiny: false,
      treasureType: kind,
      fleeTriggered: false,
      fleeDirSign: Math.random() < 0.5 ? 1 : -1,
      tauntPauseTimer: 0,
      tauntCd: 3.0,
      escapeTimer: 26.0,
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
      this.showCutsceneBanner("【友好商店 (Poké Mart) 登場】", "靠近點擊進入，或站定 0.35 秒選購 TM 學習機！", 2800);
    }
  }
});

window.ModeSurvivor = {
  id: "survivor",
  onStart(app) {
    app.isArenaMode = false;
    if (typeof MapEngine !== "undefined" && MapEngine.setArenaMode) {
      MapEngine.setArenaMode(false);
    }
  },
  update(app, dt) {
    app.updateSpawners(dt);
  },
  onBossDefeated(app, boss) {
    return false; // 沿用原本標準／無盡模式內建神獸結算與彩蛋流程
  }
};

// ============================================================================
// PART 2: 石英大會 1vs1 鬥技場控制器 (ModeArena)
// ============================================================================

/**
 * ============================================================================
 * mode_arena.js (v7.2.0 第二刀解耦：石英大會 1vs1 鬥技場 Phase 1)
 * 職責：
 * 1. 封閉單屏石英大會競技場初始化（固定 Lv.25 完全體 ＋ 天生三招 Lv.8 ＋ 自選 1 件免費攜帶物）
 * 2. 單挑 5 大傳說神獸（無小怪干擾、固定公平競技）
 * 3. 計時排行榜紀錄 (saveData.stats.arenaBestTimes) 與首次通關／破紀錄賞金結算
 * ============================================================================
 */

window.ModeArena = {
  id: "arena",

  onStart(app) {
    app.isArenaMode = true;
    app.isEndlessMode = false;
    app.lastArenaResult = null;
    if (typeof MapEngine !== "undefined" && MapEngine.setArenaMode) {
      MapEngine.setArenaMode(true);
      MapEngine.setWeather("CLEAR");
    }
    if (app.updateWeatherUI) app.updateWeatherUI("CLEAR");

    const p = app.player;
    if (!p) return;

    // 1. 自動進化至最終完全體（保留閃光、王冠星級與訓練家羈絆；伊布預設進化為雷伊布 #135）
    let curData = p.data;
    let guard = 0;
    while (curData && curData.evo_to && curData.evo_level !== "None" && guard < 3) {
      const nextId = (curData.id === 133) ? 135 : curData.evo_to;
      const nextData = POKEMON_MAP.get(nextId);
      if (!nextData || nextData === curData) break;
      curData = nextData;
      guard++;
    }
    p.id = curData.id;
    p.data = curData;
    p.underdogExpBonus = 0;

    // 2. 固定 Lv.25 競技場公平體質與最終形態霸體
    p.level = 25;
    p.exp = 0;
    p.nextExp = 999999; // 鬥技場固定等級，不觸發升級彈窗打斷單挑節奏
    const tr = app.selectedTrainer || TRAINERS[0];
    const upg = (app.saveData && app.saveData.upgrades) || {};
    const starMult = p.starMult || 1.0;
    const shinyMult = (p.isShiny ? 1.20 : 1.0) * starMult;
    p.maxHp = Math.round(curData.hp * 2.15 * (tr.mods.hpMult || 1.0) * (1 + (upg.hp || 0) * 0.12) * shinyMult);
    p.hp = p.maxHp;
    p.baseAtk = (typeof getEffectiveBaseAtk === "function" ? getEffectiveBaseAtk(curData) : curData.atk) * 1.18 * shinyMult;
    p.baseSpeed = curData.speed;
    p.finalEvoArmor = 0.12;
    p.areaMult *= 1.10;
    if (curData.id === 149 || curData.id >= 144) {
      p.multiscaleReady = true;
      p.multiscaleTimer = 10.0;
    }
    if (typeof getPokemonInnateTrait === "function") {
      p.innateTrait = getPokemonInnateTrait(curData, 25);
    }

    // 3. 自動學齊天生三招並設為固定 Lv.8
    const natSkills = (typeof getNaturalSkillsForPokemon === "function")
      ? getNaturalSkillsForPokemon(curData)
      : ["Tackle", "AirSlash", "Earthquake"];
    p.naturalSkills = [...natSkills];
    p.skills = {};
    natSkills.slice(0, 3).forEach((sId, idx) => {
      const meta = SKILLS_CATALOG[sId] || SKILLS_CATALOG[sId.replace(/\s+/g, '')];
      const keyId = meta ? meta.id : sId;
      p.skills[keyId] = { id: keyId, level: 8, evolved: false, timer: 0.18 + idx * 0.22 };
    });

    // 3B. 純 1vs1 單挑規則：移除雙打夥伴以確保公平 1 對 1，並將莎莉娜／研究所夥伴投資轉化為主角單挑加成
    const hadPartnerBonus = (app.partners && app.partners.length > 0) || !!(tr.mods && tr.mods.startPartner) || ((upg.partner || 0) >= 1);
    app.partners = [];
    let soloCompNote = "";
    if (hadPartnerBonus) {
      const pLabLv = upg.partner || 0;
      const spdBonus = 1.06 + pLabLv * 0.02;
      const cdBonus = Math.max(0.86, 0.94 - pLabLv * 0.02);
      p.speedMult *= spdBonus;
      p.cdMult *= cdBonus;
      p.critRate = (p.critRate || 0.10) + 0.05;
      soloCompNote = " ‧ 單挑專注補償已啟動";
    }

    // 4. 裝備玩家於 STEP 3 免費自選的 1 件競技場攜帶物
    p.heldItems = {};
    const chosenHeldId = app.selectedArenaHeldItem || "silk_scarf";
    if (HELD_ITEMS[chosenHeldId]) {
      p.heldItems[chosenHeldId] = true;
      p.dmgMult *= 1.12;
    }

    // 5. 擺放左側選手起跑位置與右側神獸對手（適配 600x460 緊湊競技場）
    p.x = -120;
    p.y = 0;
    p.facingX = 1;
    p.facingY = 0;
    p.trail = [{ x: p.x, y: p.y }];
    if (app.trainerCompanion) {
      app.trainerCompanion.x = -148;
      app.trainerCompanion.y = 12;
      app.trainerCompanion.facingX = 1;
      app.trainerCompanion.facingY = 0;
    }

    const diffList = (typeof ARENA_DIFFICULTIES !== "undefined") ? ARENA_DIFFICULTIES : [];
    const arenaDiff = diffList.find(d => d.id === (app.selectedArenaDifficultyId || "standard")) || {
      id: "standard", name: "標準試煉", hpMult: 2.2, atkMult: 1.15, bulletPct: 0.06, telegraphPct: 0.16, contactPct: 0.09, healEff: 0.85, cdMult: 0.85, armor: 0, dpsCapPct: 0.12, coinMult: 1.0
    };
    app.arenaDiff = arenaDiff;
    app.arenaHealEff = arenaDiff.healEff || 0.85;
    app.arenaPowerups = [];
    app.arenaPowerupTimer = 11.0;
    p.arenaDashCd = 0;
    p.arenaDashMaxCd = 3.2;
    p.arenaDashInvulnTimer = 0;
    p.arenaFuryTimer = 0;
    p.arenaGaleTimer = 0;
    p.arenaShieldTimer = 0;
    p.arenaPerfectCounterTimer = 0;

    const bossCfg = (typeof ARENA_BOSSES !== "undefined"
      ? ARENA_BOSSES.find(b => b.id === app.selectedArenaBossId)
      : null) || (typeof ARENA_BOSSES !== "undefined" ? ARENA_BOSSES[0] : { id: 144, name: "急凍鳥", hp: 9200, atk: 32, speed: 94, reward: 140, firstBonus: 200 });

    const bData = POKEMON_MAP.get(bossCfg.id) || POKEMON_MAP.get(144);
    const scaledHp = Math.round(bossCfg.hp * (arenaDiff.hpMult || 2.2));
    const scaledAtk = Math.round(bossCfg.atk * (arenaDiff.atkMult || 1.0));
    app.saveData.pokedexSeen[bossCfg.id] = true;
    const boss = {
      id: bossCfg.id,
      data: bData,
      x: 125,
      y: 0,
      hp: scaledHp,
      maxHp: scaledHp,
      atk: scaledAtk,
      speed: bossCfg.speed,
      radius: 44,
      isElite: true,
      isBoss: true,
      isArenaBoss: true,
      arenaCfg: bossCfg,
      arenaDiff: arenaDiff,
      arenaCdMult: arenaDiff.cdMult || 0.85,
      arenaArmor: arenaDiff.armor || 0,
      arenaDpsCapPct: arenaDiff.dpsCapPct || 0.12,
      isFinalMewtwo: bossCfg.id === 150,
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
      weightTier: "boss",
      kbResist: 1.0,
      bossAttackIdx: 0
    };
    app.enemies = [boss];
    app.activeBoss = boss;
    const bossHud = document.getElementById("bossHudContainer");
    if (bossHud) bossHud.classList.remove("hidden");
    SoundFX.startBgm("boss");

    if (app.checkMegaEvolutionReady) app.checkMegaEvolutionReady();
    app.showCutsceneBanner(
      `【⚔️ 石英大會 1vs1 ‧ ${arenaDiff.name}】`,
      `純 1vs1 單挑【${bData.name_zh}】(HP ${scaledHp.toLocaleString()})${soloCompNote}！`,
      3000
    );
  },

  ARENA_POWERUP_TYPES: [
    { id: "sitrus_berry",  name: "文柚果",   icon: "🍒", color: "#4ADE80", desc: "立即回復 18% HP ＆ 淨化異常！" },
    { id: "fury_core",     name: "狂暴核心", icon: "⚡", color: "#EF4444", desc: "8秒內全招式傷害 +35%！" },
    { id: "gale_feather",  name: "疾風羽毛", icon: "💨", color: "#38BDF8", desc: "重置閃避CD ‧ 6秒移速+25% ＆ 冷卻-20%！" },
    { id: "mirror_shield", name: "折射護盾", icon: "🛡️", color: "#A855F7", desc: "展開 8秒能量護盾，完全抵擋下次重擊！" }
  ],

  ARENA_SPAWN_SPOTS: [
    { x: -225, y: 0 },
    { x:  225, y: 0 },
    { x: 0,    y: -165 },
    { x: 0,    y:  165 },
    { x: -85,  y: -155 },
    { x:  85,  y:  155 }
  ],

  update(app, dt) {
    const p = app.player;
    if (!p) return;
    // 鏡頭柔和鎖定場地中央讓全場對決一覽無遺
    app.camera.x = p.x * 0.42;
    app.camera.y = p.y * 0.42;

    // 場地臨時戰術道具刷新與拾取（每 12~14 秒刷新 1 顆，存在 10 秒）
    if (!app.arenaPowerups) app.arenaPowerups = [];
    if (app.arenaPowerups.length === 0) {
      app.arenaPowerupTimer = (app.arenaPowerupTimer !== undefined ? app.arenaPowerupTimer : 11.0) - dt;
      if (app.arenaPowerupTimer <= 0) {
        app.arenaPowerupTimer = 12.0 + Math.random() * 2.5;
        // 挑選距離玩家較遠的 3 個開放點隨機生成，鼓勵玩家離開石柱搶資源
        const sortedSpots = [...this.ARENA_SPAWN_SPOTS].sort((a, b) =>
          Math.hypot(b.x - p.x, b.y - p.y) - Math.hypot(a.x - p.x, a.y - p.y)
        );
        const spot = sortedSpots[Math.floor(Math.random() * Math.min(3, sortedSpots.length))];
        // 若玩家殘血 (<55%) 提高文柚果權重
        const lowHp = (p.hp / p.maxHp) < 0.55;
        const pool = lowHp
          ? [this.ARENA_POWERUP_TYPES[0], this.ARENA_POWERUP_TYPES[0], this.ARENA_POWERUP_TYPES[1], this.ARENA_POWERUP_TYPES[2], this.ARENA_POWERUP_TYPES[3]]
          : this.ARENA_POWERUP_TYPES;
        const pick = pool[Math.floor(Math.random() * pool.length)];
        app.arenaPowerups.push({
          ...pick,
          x: spot.x,
          y: spot.y,
          life: 10.0,
          maxLife: 10.0,
          bob: 0
        });
        app.spawnParticleCluster(spot.x, spot.y, pick.color, "#FFFFFF", 14, "star", 0.9);
        app.spawnFloatingText(spot.x, spot.y - 24, `${pick.icon} 場地補給：【${pick.name}】出現！`, pick.color, 13);
        SoundFX.play("gem");
      }
    }

    for (let i = app.arenaPowerups.length - 1; i >= 0; i--) {
      const pu = app.arenaPowerups[i];
      pu.life -= dt;
      pu.bob += dt * 4.5;
      if (Math.hypot(p.x - pu.x, p.y - pu.y) <= 34) {
        app.arenaPowerups.splice(i, 1);
        if (app.runStats) app.runStats.arenaPowerupsPicked += 1;
        SoundFX.play("levelup");
        app.spawnParticleCluster(p.x, p.y, pu.color, "#FEF08A", 20, "star", 1.15);
        if (pu.id === "sitrus_berry") {
          const healAmt = Math.round(p.maxHp * 0.18);
          p.hp = Math.min(p.maxHp, p.hp + healAmt);
          p.status = null;
          p.statusTimer = 0;
          app.spawnFloatingText(p.x, p.y - 32, `🍒 文柚果：+${healAmt} HP ＆ 淨化！`, "#4ADE80", 14);
        } else if (pu.id === "fury_core") {
          p.arenaFuryTimer = 8.0;
          app.spawnFloatingText(p.x, p.y - 32, "⚡ 狂暴核心：8秒全傷 +35%！", "#EF4444", 14);
        } else if (pu.id === "gale_feather") {
          p.arenaDashCd = 0;
          p.arenaGaleTimer = 6.0;
          app.spawnFloatingText(p.x, p.y - 32, "💨 疾風羽毛：閃避重置 ‧ 疾速6s！", "#38BDF8", 14);
        } else if (pu.id === "mirror_shield") {
          p.arenaShieldTimer = 8.0;
          app.spawnFloatingText(p.x, p.y - 32, "🛡️ 折射護盾：抵擋下次攻擊！", "#C084FC", 14);
        }
        continue;
      }
      if (pu.life <= 0) {
        app.arenaPowerups.splice(i, 1);
      }
    }
  },

  onBossDefeated(app, boss) {
    if (!app.isArenaMode) return false;
    const clearSec = Math.max(0.1, Number((app.runTime || 0.1).toFixed(1)));
    const cfg = boss.arenaCfg || { id: boss.id, name: boss.data ? boss.data.name_zh : "神獸", reward: 150, firstBonus: 200 };
    const diff = boss.arenaDiff || { id: "standard", name: "標準試煉", coinMult: 1.0 };

    if (!app.saveData.stats.arenaBestTimes) app.saveData.stats.arenaBestTimes = {};
    const recKey = `${boss.id}_${diff.id}`;
    const prevBest = app.saveData.stats.arenaBestTimes[recKey];
    const isFirstClear = (prevBest === undefined || prevBest === null);
    const isNewRecord = isFirstClear || clearSec < prevBest;
    if (isNewRecord) {
      app.saveData.stats.arenaBestTimes[recKey] = clearSec;
    }
    // 同步維護神獸整體最佳紀錄（向下相容總制霸數統計）
    const overallPrev = app.saveData.stats.arenaBestTimes[boss.id];
    if (overallPrev === undefined || clearSec < overallPrev) {
      app.saveData.stats.arenaBestTimes[boss.id] = clearSec;
    }

    const coinMult = diff.coinMult || 1.0;
    const baseReward = Math.round((cfg.reward || 150) * coinMult);
    const bonusCoins = Math.round((isFirstClear ? (cfg.firstBonus || 200) : (isNewRecord ? 100 : 0)) * coinMult);
    const totalGain = baseReward + bonusCoins;
    app.runCoins += totalGain;
    app.saveData.coins += totalGain;
    if (app.saveToStorage) app.saveToStorage();

    app.lastArenaResult = {
      bossId: boss.id,
      bossName: boss.data ? boss.data.name_zh : cfg.name,
      clearSec,
      prevBest,
      isFirstClear,
      isNewRecord,
      totalGain
    };

    app.showCutsceneBanner(
      isFirstClear ? `🏆 首次單挑擊破【${app.lastArenaResult.bossName}】！` : (isNewRecord ? `⚡ 新紀錄！${clearSec.toFixed(1)}s 擊破【${app.lastArenaResult.bossName}】！` : `⚔️ 鬥技場勝利！耗時 ${clearSec.toFixed(1)}s`),
      `獲得鬥技場賞金 +${totalGain} 代幣！正在為勝者加冕……`,
      2600
    );
    app.startVictoryCeremony();
    return true;
  }
};

// ============================================================================
// v7.7.0 十大隨機突發事件系統 (FieldEventsEngine)
// 涵蓋：移動搶點(3) ＋ 打寶爆發(3) ＋ 戰術異變(4)，通用於 8 分鐘 / 無盡 / 關都大遠征
// ============================================================================
window.FieldEventsEngine = {
  UI_SHEET_URL: "images/gba_ui_icons_sheet.png",
  UI_CELLS: {
    expedition: [0, 0], arena: [1, 0], lab: [2, 0], trophy: [3, 0],
    costume: [0, 1], settings: [1, 1], energy_beacon: [2, 1], rocket_airdrop: [3, 1],
    chansey_patrol: [0, 2], meowth_convoy: [1, 2], shiny_swarm: [2, 2], ditto_chests: [3, 2],
    overdrive_storm: [0, 3], exp_mist: [1, 3], rival_ambush: [2, 3], league_contract: [3, 3]
  },
  getIconSrcRect(key) {
    const pos = this.UI_CELLS[key];
    if (!pos) return null;
    return { x: pos[0] * 128, y: pos[1] * 128, w: 128, h: 128 };
  },
  CATALOG: [
    { id: "energy_beacon",  icon: "📡", name: "能量信標佔領圈",   cat: "move",   duration: 24, sub: "站入光圈充能 5 秒，引爆全屏清場波並回血！" },
    { id: "rocket_airdrop", icon: "📦", name: "火箭隊空投補給箱", cat: "move",   duration: 22, sub: "搶先開啟空投箱，奪取無敵護盾與全場磁鐵！" },
    { id: "chansey_patrol", icon: "🥚", name: "野生吉利蛋巡遊",   cat: "move",   duration: 22, sub: "追擊幸運吉利蛋，奪取大補包與高階經驗晶！" },
    { id: "meowth_convoy",  icon: "💰", name: "聚寶喵喵運鈔車",   cat: "loot",   duration: 22, sub: "攔截高速逃竄的喵喵雙人組，狂賺賞金！" },
    { id: "shiny_swarm",    icon: "✨", name: "閃光野生群襲",     cat: "loot",   duration: 16, sub: "閃光野生寶可夢大批湧現，經驗倍增助開圖鑑！" },
    { id: "ditto_chests",   icon: "🎁", name: "真假百變怪寶箱",   cat: "loot",   duration: 24, sub: "場上出現雙寶箱！選對領秘寶，選錯迎戰百變怪！" },
    { id: "overdrive_storm",icon: "⚡", name: "超電磁過載風暴",   cat: "tactic", duration: 15, sub: "全招冷卻 -35%！但敵軍移速 +20%，全速傾瀉火力！" },
    { id: "exp_mist",       icon: "🌫️", name: "迷霧雙倍經驗潮",   cat: "tactic", duration: 18, sub: "戰場籠罩紫霧，期間全額經驗獲取 2.0x！" },
    { id: "rival_ambush",   icon: "⚔️", name: "宿敵精英突襲",     cat: "tactic", duration: 28, sub: "強敵宿敵殺入戰場！擊破必掉稀世補給與賞金！" },
    { id: "league_contract",icon: "📜", name: "聯盟緊急契約",     cat: "tactic", duration: 1,  sub: "緊急戰術抉擇：高風險全招+1 或穩健護盾回血！" }
  ],

  reset(app) {
    app.activeFieldEvent = null;
    app.fieldEventCooldown = 78;
    app.lastFieldEventId = null;
    app.fieldEventCdMult = 1.0;
    app.fieldEventExpMult = 1.0;
    app.fieldEventEnemySpdMult = 1.0;
    this.syncHud(app);
    const cm = document.getElementById("fieldEventContractModal");
    if (cm) { cm.classList.add("hidden"); cm.style.display = "none"; }
  },

  pickRandomEventId(app, excludeContract = false) {
    const pool = this.CATALOG.filter(ev => {
      if (ev.id === app.lastFieldEventId) return false;
      if (excludeContract && ev.id === "league_contract") return false;
      return true;
    });
    const pick = pool[Math.floor(Math.random() * pool.length)] || this.CATALOG[0];
    return pick.id;
  },

  spawnOffsetPos(app, minDist = 175, maxDist = 265) {
    const p = app.player;
    const ang = Math.random() * Math.PI * 2;
    const dist = minDist + Math.random() * (maxDist - minDist);
    let tx = (p ? p.x : 0) + Math.cos(ang) * dist;
    let ty = (p ? p.y : 0) + Math.sin(ang) * dist;
    if (app.isExpeditionMode && app.expeditionState && app.expeditionState.arenaBounds) {
      const b = app.expeditionState.arenaBounds;
      tx = Math.max(-b.halfW + 70, Math.min(b.halfW - 70, tx));
      ty = Math.max(-b.halfH + 70, Math.min(b.halfH - 70, ty));
    }
    return { x: tx, y: ty };
  },

  triggerEvent(app, eventId = null) {
    if (!app || !app.player || app.isArenaMode) return false;
    const chosenId = eventId || this.pickRandomEventId(app, false);
    const meta = this.CATALOG.find(e => e.id === chosenId) || this.CATALOG[0];
    app.lastFieldEventId = meta.id;

    if (meta.id === "league_contract") {
      app.activeFieldEvent = null;
      this.syncHud(app);
      app._preContractState = app.state;
      app.state = "CONTRACT";
      if (typeof SoundFX !== "undefined") SoundFX.play("shiny");
      const cm = document.getElementById("fieldEventContractModal");
      if (cm) {
        cm.classList.remove("hidden");
        cm.style.display = "flex";
      }
      return true;
    }

    const ev = {
      id: meta.id,
      icon: meta.icon,
      name: meta.name,
      sub: meta.sub,
      timer: meta.duration,
      maxTimer: meta.duration,
      progress: 0,
      targetProgress: 5.0,
      nodes: [],
      spawnTick: 0
    };

    if (meta.id === "energy_beacon") {
      const pos = this.spawnOffsetPos(app, 175, 250);
      ev.nodes.push({ kind: "beacon", x: pos.x, y: pos.y, radius: 76, label: "信標", color: "#38BDF8" });
    } else if (meta.id === "rocket_airdrop") {
      const pos = this.spawnOffsetPos(app, 185, 270);
      ev.nodes.push({ kind: "airdrop", x: pos.x, y: pos.y, radius: 34, label: "空投", color: "#FACC15", opened: false });
    } else if (meta.id === "ditto_chests") {
      const p = app.player;
      const baseAng = Math.random() * Math.PI * 2;
      const d = 195;
      const realIdx = Math.random() < 0.5 ? 0 : 1;
      [0, 1].forEach(idx => {
        const ang = baseAng + (idx === 0 ? -0.55 : 0.55);
        ev.nodes.push({
          kind: "chest",
          x: p.x + Math.cos(ang) * d,
          y: p.y + Math.sin(ang) * d,
          radius: 32,
          isReal: idx === realIdx,
          opened: false,
          label: "寶箱",
          color: "#A855F7"
        });
      });
    } else if (meta.id === "chansey_patrol") {
      if (typeof app.spawnTreasureMonster === "function") app.spawnTreasureMonster("chansey");
    } else if (meta.id === "meowth_convoy") {
      if (typeof app.spawnTreasureMonster === "function") {
        app.spawnTreasureMonster("meowth");
        app.spawnTreasureMonster("meowth");
      }
    } else if (meta.id === "shiny_swarm") {
      this.spawnShinyBurst(app, 7);
    } else if (meta.id === "overdrive_storm") {
      app.fieldEventCdMult = 0.65;
      app.fieldEventEnemySpdMult = 1.20;
    } else if (meta.id === "exp_mist") {
      app.fieldEventExpMult = 2.0;
    } else if (meta.id === "rival_ambush") {
      this.spawnRivalElite(app);
    }

    app.activeFieldEvent = ev;
    if (typeof SoundFX !== "undefined") SoundFX.play("levelup");
    if (app.spawnFloatingText) {
      app.spawnFloatingText(app.player.x, app.player.y - 54, `${meta.icon} 突發事件：${meta.name}！`, "#FACC15", 14);
    }
    this.syncHud(app);
    return true;
  },

  spawnShinyBurst(app, count = 6) {
    const p = app.player;
    if (!p || typeof POKEMON_MAP === "undefined") return;
    const poolIds = [25, 133, 58, 37, 92, 63, 129, 147, 54, 19, 16];
    const diff = app.selectedDifficulty || { hpMult: 1.0, atkMult: 1.0, spdMult: 1.0 };
    for (let i = 0; i < count; i++) {
      const pid = poolIds[Math.floor(Math.random() * poolIds.length)];
      const data = POKEMON_MAP.get(pid);
      if (!data) continue;
      if (app.saveData && app.saveData.pokedexSeen) app.saveData.pokedexSeen[pid] = true;
      const ang = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const dist = 250 + Math.random() * 90;
      const hp = Math.round((85 + data.hp * 0.7) * diff.hpMult * (1 + (app.runTime || 0) / 180));
      app.enemies.push({
        id: pid,
        data,
        x: p.x + Math.cos(ang) * dist,
        y: p.y + Math.sin(ang) * dist,
        hp, maxHp: hp,
        atk: Math.round((10 + data.atk * 0.25) * diff.atkMult),
        speed: Math.min(115, (62 + data.speed * 0.22) * diff.spdMult),
        radius: 19,
        isElite: false, isBoss: false, isShiny: true,
        expVal: 55,
        whiteFlashTimer: 0, ccImmunityTimer: 0, status: null, statusTimer: 0,
        treasureType: null
      });
    }
  },

  spawnRivalElite(app) {
    const p = app.player;
    if (!p || typeof POKEMON_MAP === "undefined") return;
    const rivalPool = [65, 94, 130, 149, 59, 143];
    const pid = rivalPool[Math.floor(Math.random() * rivalPool.length)];
    const data = POKEMON_MAP.get(pid) || POKEMON_MAP.get(94);
    if (app.saveData && app.saveData.pokedexSeen) app.saveData.pokedexSeen[pid] = true;
    const diff = app.selectedDifficulty || { hpMult: 1.0, atkMult: 1.0, spdMult: 1.0 };
    const pos = this.spawnOffsetPos(app, 230, 290);
    const hp = Math.round((1450 + (app.runTime || 0) * 6.5) * diff.hpMult);
    app.enemies.push({
      id: pid,
      data,
      x: pos.x,
      y: pos.y,
      hp, maxHp: hp,
      atk: Math.round(24 * diff.atkMult),
      speed: Math.min(112, 86 * diff.spdMult),
      radius: 28,
      isElite: true,
      isMiniBoss: true,
      isBoss: false,
      isShiny: false,
      guaranteedRareCandy: true,
      isRivalAmbush: true,
      expVal: 180,
      whiteFlashTimer: 0, ccImmunityTimer: 0, status: null, statusTimer: 0,
      treasureType: null
    });
  },

  resolveContractChoice(app, choice) {
    const cm = document.getElementById("fieldEventContractModal");
    if (cm) { cm.classList.add("hidden"); cm.style.display = "none"; }
    const p = app && app.player;
    if (p) {
      if (choice === "risk") {
        const hpCost = Math.max(1, Math.floor(p.hp * 0.20));
        p.hp = Math.max(1, p.hp - hpCost);
        let upgraded = 0;
        Object.values(p.skills || {}).forEach(sk => {
          if (sk.level < 10) { sk.level = Math.min(10, sk.level + 1); upgraded++; }
        });
        if (upgraded > 0) {
          if (app.spawnFloatingText) app.spawnFloatingText(p.x, p.y - 44, `🔥 狂戰契約！全招式 +1 級！`, "#F43F5E", 15);
        } else {
          p.dmgMult = (p.dmgMult || 1.0) + 0.12;
          if (app.spawnFloatingText) app.spawnFloatingText(p.x, p.y - 44, `🔥 狂戰契約！全傷永久 +12%！`, "#F43F5E", 15);
        }
        if (typeof SoundFX !== "undefined") SoundFX.play("super");
      } else {
        const healAmt = Math.round(p.maxHp * 0.35 * (p.badgeHealMult || 1.0));
        p.hp = Math.min(p.maxHp, p.hp + healAmt);
        p.invulnTimer = Math.max(p.invulnTimer || 0, 6.0);
        app.runCoins = (app.runCoins || 0) + 80;
        if (app.saveData) app.saveData.coins = (app.saveData.coins || 0) + 80;
        if (app.spawnFloatingText) app.spawnFloatingText(p.x, p.y - 44, `🛡️ 聯盟補給！+${healAmt} HP ＆ 6s無敵`, "#10B981", 14);
        if (typeof SoundFX !== "undefined") SoundFX.play("levelup");
      }
      if (app.refreshHUD) app.refreshHUD();
    }
    app.state = app._preContractState || "PLAYING";
  },

  clearActiveEvent(app) {
    app.activeFieldEvent = null;
    app.fieldEventCdMult = 1.0;
    app.fieldEventExpMult = 1.0;
    app.fieldEventEnemySpdMult = 1.0;
    this.syncHud(app);
  },

  update(app, dt) {
    if (!app || !app.player || app.isArenaMode || app.battleCountdownTimer > 0) return;
    const p = app.player;

    if (!app.isExpeditionMode && !app.activeFieldEvent) {
      if (!app.activeBoss) {
        app.fieldEventCooldown = (app.fieldEventCooldown !== undefined ? app.fieldEventCooldown : 78) - dt;
        if (app.fieldEventCooldown <= 0) {
          app.fieldEventCooldown = 75 + Math.random() * 15;
          this.triggerEvent(app);
        }
      }
      return;
    }

    const ev = app.activeFieldEvent;
    if (!ev) return;

    ev.timer -= dt;
    if (ev.timer <= 0) {
      this.clearActiveEvent(app);
      return;
    }

    if (ev.id === "energy_beacon" && ev.nodes[0]) {
      const nd = ev.nodes[0];
      const dist = Math.hypot(p.x - nd.x, p.y - nd.y);
      if (dist <= nd.radius) {
        ev.progress = Math.min(ev.targetProgress, ev.progress + dt);
        if (ev.progress >= ev.targetProgress) {
          const heal = Math.round(p.maxHp * 0.25 * (p.badgeHealMult || 1.0));
          p.hp = Math.min(p.maxHp, p.hp + heal);
          app.runCoins = (app.runCoins || 0) + 90;
          if (app.saveData) app.saveData.coins = (app.saveData.coins || 0) + 90;
          (app.enemies || []).forEach(en => {
            if (en && en.hp > 0 && Math.hypot(en.x - nd.x, en.y - nd.y) <= 380) {
              const dmg = en.isBoss ? Math.round(en.maxHp * 0.08) : Math.round(en.maxHp * 0.85);
              app.dealDamageToEnemy(en, Math.max(120, dmg), "Electric", 0.2, en.isBoss ? 0 : 40);
            }
          });
          if (typeof SkillsEngine !== "undefined") {
            SkillsEngine.meleeEffects.push({ style: "slam_wave", x: nd.x, y: nd.y, radius: 340, timer: 0.45, maxTime: 0.45, color: "#38BDF8" });
          }
          if (app.spawnFloatingText) app.spawnFloatingText(nd.x, nd.y - 36, `📡 信標充能完成！+${heal} HP ＆ +90 金`, "#38BDF8", 15);
          if (typeof SoundFX !== "undefined") SoundFX.play("super");
          this.clearActiveEvent(app);
          return;
        }
      }
    }

    if (ev.id === "rocket_airdrop" && ev.nodes[0] && !ev.nodes[0].opened) {
      const nd = ev.nodes[0];
      if (Math.hypot(p.x - nd.x, p.y - nd.y) <= nd.radius + 18) {
        nd.opened = true;
        p.invulnTimer = Math.max(p.invulnTimer || 0, 8.0);
        p.xAttackTimer = Math.max(p.xAttackTimer || 0, 15.0);
        (app.gems || []).forEach(g => { g.magnetized = true; });
        app.runCoins = (app.runCoins || 0) + 75;
        if (app.saveData) app.saveData.coins = (app.saveData.coins || 0) + 75;
        if (app.spawnFloatingText) app.spawnFloatingText(nd.x, nd.y - 32, `📦 奪取空投！8s無敵＋全場磁鐵＋75金`, "#FACC15", 14);
        if (typeof SoundFX !== "undefined") SoundFX.play("shiny");
        this.clearActiveEvent(app);
        return;
      }
    }

    if (ev.id === "ditto_chests" && ev.nodes.length > 0) {
      for (const nd of ev.nodes) {
        if (nd.opened) continue;
        if (Math.hypot(p.x - nd.x, p.y - nd.y) <= nd.radius + 18) {
          nd.opened = true;
          if (nd.isReal) {
            app.runCoins = (app.runCoins || 0) + 120;
            if (app.saveData) app.saveData.coins = (app.saveData.coins || 0) + 120;
            app.spawnMapLoot("rare_candy", nd.x, nd.y);
            if (app.spawnFloatingText) app.spawnFloatingText(nd.x, nd.y - 34, `🎁 真品寶箱！神奇糖果 ＋ 120 金！`, "#FACC15", 15);
            if (typeof SoundFX !== "undefined") SoundFX.play("shiny");
          } else {
            const ditto = POKEMON_MAP.get(132);
            const diff = app.selectedDifficulty || { hpMult: 1.0, atkMult: 1.0 };
            if (ditto) {
              const dHp = Math.round(950 * diff.hpMult);
              app.enemies.push({
                id: 132, data: ditto, x: nd.x, y: nd.y,
                hp: dHp, maxHp: dHp, atk: Math.round(20 * diff.atkMult), speed: 88, radius: 24,
                isElite: true, isMiniBoss: true, isBoss: false, isShiny: true,
                guaranteedRareCandy: true, expVal: 140,
                whiteFlashTimer: 0, ccImmunityTimer: 0, status: null, statusTimer: 0, treasureType: null
              });
            }
            if (app.spawnFloatingText) app.spawnFloatingText(nd.x, nd.y - 34, `😈 是閃光百變怪假扮的！快擊倒它！`, "#C084FC", 14);
            if (typeof SoundFX !== "undefined") SoundFX.play("boss_encounter");
          }
          this.clearActiveEvent(app);
          return;
        }
      }
    }

    if (ev.id === "shiny_swarm") {
      ev.spawnTick += dt;
      if (ev.spawnTick >= 7.5) {
        ev.spawnTick = 0;
        this.spawnShinyBurst(app, 5);
      }
    }

    this.syncHud(app);
  },

  syncHud(app) {
    const ban = document.getElementById("fieldEventHudBanner");
    if (!ban) return;
    const ev = app && app.activeFieldEvent;
    if (!ev) {
      ban.classList.add("hidden");
      return;
    }
    ban.classList.remove("hidden");
    const iconEl = document.getElementById("fieldEventHudIcon");
    const titleEl = document.getElementById("fieldEventHudTitle");
    const timerEl = document.getElementById("fieldEventHudTimer");
    const subEl = document.getElementById("fieldEventHudSub");
    const barEl = document.getElementById("fieldEventHudBar");
    if (iconEl) iconEl.innerHTML = `<span class="gba-ui-icon gba-ui-${ev.id} w-4 h-4"></span>`;
    if (titleEl) titleEl.textContent = ev.name;
    if (timerEl) timerEl.textContent = `${Math.ceil(ev.timer)}s`;
    if (subEl) {
      subEl.textContent = ev.id === "energy_beacon"
        ? `站入信標圈充能：${Math.round((ev.progress / ev.targetProgress) * 100)}%（剩餘 ${Math.ceil(ev.timer)}s）`
        : ev.sub;
    }
    if (barEl) {
      const pct = ev.id === "energy_beacon"
        ? Math.min(100, (ev.progress / ev.targetProgress) * 100)
        : Math.max(0, Math.min(100, (ev.timer / ev.maxTimer) * 100));
      barEl.style.width = `${pct}%`;
    }
  }
};
