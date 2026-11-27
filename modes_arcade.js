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
    overdrive_storm: [0, 3], exp_mist: [1, 3], rival_ambush: [2, 3], league_contract: [3, 3],
    pokedex: [0, 4], timer: [1, 4], abyss: [2, 4], mart: [3, 4],
    tower: [0, 5], relic: [1, 5], campfire: [2, 5], portal: [3, 5]
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

// ============================================================================
// v7.8.1 關都 Mega 試煉塔 (ModeTower - 實體場景化深度改造版)
// 實體三道傳送門走位選關 ＋ 奇遇雙寶箱／血祭房 ＋ 實體營火房 ＋ 地面遺物水晶拾取 ＋ 垂直登塔過場 ＋ Mega 鑰石 VS 演出
// ============================================================================
window.ModeTower = {
  PROPS_SHEET_URL: "images/tower_props_sheet.png",

  RELICS: [
    { id: "prism_split",     name: "多重稜鏡",   cat: "進攻", color: "#38BDF8", desc: "所有招式傷害 +18%，並於發射時額外強化貫穿壓制力！" },
    { id: "chain_volt",      name: "連鎖雷核",   cat: "進攻", color: "#FACC15", desc: "暴擊率 +12%，暴擊命中時引爆小範圍連鎖電弧！" },
    { id: "overclock_core",  name: "超頻核心",   cat: "進攻", color: "#F43F5E", desc: "全招式冷卻額外縮減 -15%（遵守全域冷卻下限）！" },
    { id: "exec_mark",       name: "處決印記",   cat: "進攻", color: "#EF4444", desc: "對半血以下敵人與首領額外造成 +28% 斬殺傷害！" },
    { id: "counter_pulse",   name: "反擊電場",   cat: "生存", color: "#22D3EE", desc: "每次受擊自動釋放高壓反擊衝擊波，震退並重創周圍敵人！" },
    { id: "life_leech",      name: "生命汲取",   cat: "生存", color: "#10B981", desc: "每次擊敗敵人回復 2% 最大 HP（遵守難度回復係數）！" },
    { id: "overheal_shield", name: "溢血護盾",   cat: "生存", color: "#60A5FA", desc: "最大 HP 上限 +22%，且每層開場贈送 4 秒堅固護盾！" },
    { id: "wind_step",       name: "疾風閃步",   cat: "生存", color: "#34D399", desc: "移動速度 +18%，受擊無敵時間延長 +0.25 秒！" },
    { id: "speed_crit",      name: "疾速暴擊",   cat: "戰術", color: "#A78BFA", desc: "移動速度加成同步轉化為 +15% 暴擊率與 +20% 暴擊傷害！" },
    { id: "relic_resonance", name: "秘寶共鳴",   cat: "戰術", color: "#F59E0B", desc: "全傷害 +14%、經驗與金幣獲取 +30%！" },
    { id: "opening_charge",  name: "開場蓄能",   cat: "戰術", color: "#FB923C", desc: "每層進場時訓練家大招冷卻立刻歸零，且大招冷卻 -18%！" },
    { id: "gold_magnet",     name: "黃金磁場",   cat: "戰術", color: "#EAB308", desc: "拾取磁鐵範圍翻倍，每通關 1 層額外獲得 +60 金幣！" }
  ],

  AFFIXES: [
    { id: "toxic_death",   name: "☠️ 敵亡毒沼", desc: "敵怪陣亡時短暫釋放毒氣，請保持移動！" },
    { id: "swift_barrage", name: "⚡ 疾風強襲", desc: "敵人移速 +15%、彈幕威脅強化！" },
    { id: "berserk_pact",  name: "🔥 狂戰代價", desc: "全傷害 +15%，但本層回復效率 -25%！" },
    { id: "heavy_gravity", name: "🌑 重壓領域", desc: "高壓戰場！敵血 +15%，但賞金與經驗 +25%！" }
  ],

  MEGA_MILESTONES: [
    { floor: 5,  stageId: "pallet",           bossBaseIds: [3],      archetypes: ["toxic_zone"],          treasureId: "leftovers",    title: "密林 Mega 試煉" },
    { floor: 10, stageId: "cerulean_bay",     bossBaseIds: [9, 130], archetypes: ["sniper", "juggernaut"], treasureId: "life_orb",     title: "海岬 Mega 試煉", pickOne: true },
    { floor: 15, stageId: "cinnabar_volcano", bossBaseIds: [6],      archetypes: ["juggernaut"],          treasureId: "choice_scarf", title: "火山 Mega 試煉" },
    { floor: 20, stageId: "sky_pillar",       bossBaseIds: [94, 142],archetypes: ["trickster", "sniper"],  treasureId: "focus_sash",   title: "古殿雙 Mega 決戰" }
  ],

  hasRelic(app, id) {
    return !!(app && app.towerState && Array.isArray(app.towerState.relics) && app.towerState.relics.includes(id));
  },

  hasAffix(app, id) {
    return !!(app && app.towerState && Array.isArray(app.towerState.activeAffixes) && app.towerState.activeAffixes.includes(id));
  },

  setQuickExitVisible(show) {
    const btn = document.getElementById("towerQuickExitBtn");
    if (btn) btn.classList.toggle("hidden", !show);
  },

  onStart(app) {
    if (typeof SpriteCache !== "undefined") SpriteCache.get(this.PROPS_SHEET_URL);
    const resumeCp = app._resumeTowerCheckpoint || null;
    app._resumeTowerCheckpoint = null;

    if (resumeCp && resumeCp.nextFloor >= 2) {
      app.towerState = {
        floor: resumeCp.nextFloor,
        portalType: resumeCp.nextPortalType || "battle",
        relics: Array.isArray(resumeCp.relics) ? [...resumeCp.relics] : [],
        activeAffixes: [],
        killsInFloor: 0,
        killQuota: 20,
        spawnTimer: 0.4,
        floorCleared: false,
        totalCoinsEarned: resumeCp.totalCoinsEarned || 0,
        arenaBounds: { halfW: 540, halfH: 380 },
        portals: [],
        relicDrop: null,
        roomProps: [],
        pendingTreasureBanner: null,
        pendingBossSpecs: null
      };
      const p = app.player;
      if (p && resumeCp.player) {
        const sp = resumeCp.player;
        p.level = sp.level || p.level;
        p.exp = sp.exp || 0;
        p.maxHp = sp.maxHp || p.maxHp;
        p.hp = Math.min(p.maxHp, sp.hp || p.maxHp);
        p.dmgMult = sp.dmgMult || p.dmgMult;
        p.speedMult = sp.speedMult || p.speedMult;
        if (sp.skills) p.skills = JSON.parse(JSON.stringify(sp.skills));
        if (sp.heldItems) p.heldItems = { ...sp.heldItems };
        if (sp.legendaryTreasures) p.legendaryTreasures = { ...sp.legendaryTreasures };
      }
      if (resumeCp.runCoins) app.runCoins = resumeCp.runCoins;
      if (app.selectedDifficulty && resumeCp.difficultyId) {
        const df = DIFFICULTIES.find(d => d.id === resumeCp.difficultyId);
        if (df) app.selectedDifficulty = df;
      }
    } else {
      app.towerState = {
        floor: 1,
        portalType: "battle",
        relics: [],
        activeAffixes: [],
        killsInFloor: 0,
        killQuota: 18,
        spawnTimer: 0.4,
        floorCleared: false,
        totalCoinsEarned: 0,
        arenaBounds: { halfW: 540, halfH: 380 },
        portals: [],
        relicDrop: null,
        roomProps: [],
        pendingTreasureBanner: null,
        pendingBossSpecs: null
      };
      if (app.saveData) {
        app.saveData.towerCheckpoint = null;
        if (app.saveToStorage) app.saveToStorage();
      }
    }
    this.launchFloorWithCeremony(app, Math.max(1, app.towerState.floor - 1), app.towerState.floor, app.towerState.portalType, app.towerState.floor === 1);
  },

  getStageForFloor(floor) {
    const cycle = ["pallet", "cerulean_bay", "power_plant", "cinnabar_volcano", "sky_pillar"];
    const idx = Math.floor((floor - 1) / 5) % cycle.length;
    return STAGES.find(s => s.id === cycle[idx]) || STAGES[0];
  },

  resolveBossSpecsForFloor(floor) {
    const ms = this.MEGA_MILESTONES.find(m => m.floor === floor);
    if (ms) {
      if (ms.pickOne) {
        const i = Math.floor(Math.random() * ms.bossBaseIds.length);
        return [{ baseId: ms.bossBaseIds[i], arch: ms.archetypes[i] }];
      }
      return ms.bossBaseIds.map((bid, i) => ({ baseId: bid, arch: ms.archetypes[i] || "juggernaut" }));
    }
    const allMegas = [
      { baseId: 3, arch: "toxic_zone" }, { baseId: 6, arch: "juggernaut" },
      { baseId: 9, arch: "sniper" }, { baseId: 94, arch: "trickster" },
      { baseId: 130, arch: "juggernaut" }, { baseId: 142, arch: "sniper" }
    ].sort(() => Math.random() - 0.5);
    return allMegas.slice(0, 2);
  },

  // 垂直登塔過場 ➔（若為 5F 倍數）Mega 鑰石 VS 遭遇戰演出 ➔ 正式開戰
  launchFloorWithCeremony(app, fromFloor, toFloor, portalType, skipClimb = false) {
    const st = app.towerState;
    if (!st) return;
    const isBossFloor = (toFloor % 5 === 0);
    const effPortal = isBossFloor ? "boss" : portalType;
    st.pendingBossSpecs = isBossFloor ? this.resolveBossSpecsForFloor(toFloor) : null;

    const proceedToVsOrStart = () => {
      if (isBossFloor && typeof ModeExpedition !== "undefined" && ModeExpedition.showBossVsOverlay) {
        const specs = st.pendingBossSpecs || this.resolveBossSpecsForFloor(toFloor);
        const bossDataList = specs.map(sp => (typeof MEGA_FORMS !== "undefined" && MEGA_FORMS[sp.baseId]) ? MEGA_FORMS[sp.baseId] : (POKEMON_MAP.get(sp.baseId) || POKEMON_MAP.get(150)));
        const baseDataList = specs.map(sp => POKEMON_MAP.get(sp.baseId) || bossDataList[0]);
        const stageObj = this.getStageForFloor(toFloor);
        const ms = this.MEGA_MILESTONES.find(m => m.floor === toFloor);
        const vsCfg = {
          stageId: stageObj.id,
          isMegaTowerBoss: true,
          isLegendaryBoss: true,
          bossIds: bossDataList.map(b => b.id),
          bossDataList,
          baseDataList,
          customSubTag: `MEGA BATTLE TOWER · ${toFloor}F · ${ms ? ms.title : "冠軍雙 Mega 決戰"}`
        };
        ModeExpedition.showBossVsOverlay(app, vsCfg, () => {
          this.startFloor(app, toFloor, "boss");
        });
      } else {
        this.startFloor(app, toFloor, effPortal);
      }
    };

    if (skipClimb) {
      proceedToVsOrStart();
    } else {
      this.playClimbTransition(app, fromFloor, toFloor, effPortal, proceedToVsOrStart);
    }
  },

  // 垂直 GBA 登塔動態過場（~1.35 秒，點擊畫面立即跳過）
  playClimbTransition(app, fromFloor, toFloor, portalType, onDone) {
    const ov = document.getElementById("towerClimbOverlay");
    const can = document.getElementById("towerClimbCanvas");
    const tagEl = document.getElementById("towerClimbFloorTag");
    const hintEl = document.getElementById("towerClimbHint");
    if (!ov || !can) {
      if (typeof onDone === "function") onDone();
      return;
    }
    this.setQuickExitVisible(false);
    app.state = "TOWER_CLIMB";
    if (tagEl) tagEl.textContent = `${fromFloor}F ➔ ${toFloor}F`;
    if (hintEl) {
      hintEl.textContent = toFloor % 5 === 0
        ? `👑 逼近第 ${toFloor} 層 Mega 首領領域……（點擊跳過）`
        : `正在攀登至第 ${toFloor} 層……（點擊跳過）`;
    }

    const tr = app.selectedTrainer || TRAINERS[0];
    const trCos = (typeof getResolvedTrainerCostume === "function") ? getResolvedTrainerCostume(tr, app.saveData) : tr;
    const p = app.player;
    const pData = (p && p.data) || POKEMON_MAP.get(25);
    const pSprUrl = (p && p.isShiny && pData.shiny_forward_sprite) ? pData.shiny_forward_sprite : pData.forward_sprite;
    SpriteCache.get(pSprUrl);
    if (trCos && trCos.sprite) SpriteCache.get(trCos.sprite);

    const nextBossFloor = Math.ceil(toFloor / 5) * 5;
    const nextMs = this.MEGA_MILESTONES.find(m => m.floor === nextBossFloor);
    const nextBossBaseId = nextMs ? nextMs.bossBaseIds[0] : 6;
    const nextBossData = (typeof MEGA_FORMS !== "undefined" && MEGA_FORMS[nextBossBaseId]) ? MEGA_FORMS[nextBossBaseId] : POKEMON_MAP.get(nextBossBaseId);
    if (nextBossData && nextBossData.forward_sprite) SpriteCache.get(nextBossData.forward_sprite);

    ov.classList.remove("hidden");
    ov.style.display = "flex";
    if (typeof SoundFX !== "undefined") SoundFX.play("levelup");

    let finished = false;
    let rafId = null;
    const startTs = performance.now();
    const durationMs = 1350;

    const finish = () => {
      if (finished) return;
      finished = true;
      if (rafId) cancelAnimationFrame(rafId);
      this._climbSkipCb = null;
      ov.classList.add("hidden");
      ov.style.display = "none";
      if (typeof onDone === "function") onDone();
    };
    this._climbSkipCb = finish;

    const drawFrame = (nowTs) => {
      if (finished) return;
      const t = Math.min(1, (nowTs - startTs) / durationMs);
      const ease = 1 - Math.pow(1 - t, 3);
      const w = can.width = 360;
      const h = can.height = 320;
      const ctx = can.getContext("2d");
      ctx.imageSmoothingEnabled = false;

      // 1. GBA 垂直高塔石磚背景
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, "#0F172A");
      grad.addColorStop(0.5, "#1E1B4B");
      grad.addColorStop(1, "#020617");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // 左右石柱磚紋
      ctx.fillStyle = "#1E293B";
      ctx.fillRect(16, 0, 46, h);
      ctx.fillRect(w - 62, 0, 46, h);
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 2;
      for (let by = (Math.floor(t * 48) % 24) - 24; by < h; by += 24) {
        ctx.strokeRect(16, by, 46, 24);
        ctx.strokeRect(w - 62, by, 46, 24);
      }

      // 中央發光登塔階梯軌道
      const trackX = w * 0.5;
      ctx.strokeStyle = "rgba(99, 102, 241, 0.35)";
      ctx.lineWidth = 36;
      ctx.beginPath(); ctx.moveTo(trackX, h); ctx.lineTo(trackX, 20); ctx.stroke();

      ctx.strokeStyle = "#FACC15";
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 6]);
      ctx.beginPath(); ctx.moveTo(trackX, h - 30); ctx.lineTo(trackX, 55); ctx.stroke();
      ctx.setLineDash([]);

      // 繪製 3 層階梯節點（下: fromFloor, 中: toFloor, 上: nextBossFloor）
      const yFrom = 250;
      const yTo = 152;
      const yTop = 58;

      const drawNode = (ny, label, col, active) => {
        ctx.fillStyle = "#0F172A";
        ctx.strokeStyle = col;
        ctx.lineWidth = active ? 3 : 2;
        ctx.fillRect(74, ny - 14, 72, 26);
        ctx.strokeRect(74, ny - 14, 72, 26);
        ctx.fillStyle = active ? "#FEF08A" : "#CBD5E1";
        ctx.font = "900 10px 'Press Start 2P', monospace";
        ctx.textAlign = "center";
        ctx.fillText(label, 110, ny + 3);

        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(trackX, ny, active ? 10 : 7, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 2;
        ctx.stroke();
      };

      drawNode(yFrom, `${fromFloor}F`, "#22C55E", false);
      drawNode(yTo, `${toFloor}F`, toFloor % 5 === 0 ? "#EF4444" : "#38BDF8", true);
      if (nextBossFloor > toFloor) {
        drawNode(yTop, `${nextBossFloor}F`, "#F43F5E", false);
      }

      // 頂部顯示即將鎮守的 Mega 首領剪影
      if (nextBossData && nextBossData.forward_sprite) {
        const bRec = SpriteCache.get(nextBossData.forward_sprite);
        if (bRec && bRec.loaded) {
          const sil = SpriteCache.getSilhouette ? SpriteCache.getSilhouette(nextBossData.forward_sprite, toFloor === nextBossFloor ? "#F43F5E" : "#64748B") : bRec.img;
          ctx.save();
          ctx.globalAlpha = toFloor === nextBossFloor ? 0.92 : 0.45;
          ctx.drawImage(sil || bRec.img, w - 140, yTop - 34, 64, 64);
          ctx.restore();
        }
      }

      // 主角訓練家 ＋ 寶可夢沿光梯向上攀登
      const curY = yFrom + (yTo - yFrom) * ease;
      const bob = t < 0.95 ? Math.abs(Math.sin(t * 22)) * 5 : 0;
      const pRec = SpriteCache.get(pSprUrl);
      const tRec = (trCos && trCos.sprite) ? SpriteCache.get(trCos.sprite) : null;
      if (tRec && tRec.loaded) {
        ctx.drawImage(tRec.img, trackX - 38, curY - 26 - bob, 36, 36);
      }
      if (pRec && pRec.loaded) {
        ctx.drawImage(pRec.img, trackX + 2, curY - 28 - bob, 40, 40);
      }

      // 抵達瞬間光環
      if (t > 0.85) {
        const ringT = (t - 0.85) / 0.15;
        ctx.strokeStyle = `rgba(250, 204, 21, ${1 - ringT})`;
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(trackX, yTo, 12 + ringT * 38, 0, Math.PI * 2); ctx.stroke();
      }

      if (t < 1) {
        rafId = requestAnimationFrame(drawFrame);
      } else {
        setTimeout(finish, 80);
      }
    };
    rafId = requestAnimationFrame(drawFrame);
  },

  skipClimbTransition() {
    if (typeof this._climbSkipCb === "function") {
      this._climbSkipCb();
    }
  },

  startFloor(app, floor, portalType = "battle") {
    const st = app.towerState;
    const p = app.player;
    if (!st || !p) return;

    st.floor = floor;
    st.portalType = (floor % 5 === 0) ? "boss" : portalType;
    st.killsInFloor = 0;
    st.floorCleared = false;
    st.spawnTimer = 0.45;
    st.portals = [];
    st.relicDrop = null;
    st.roomProps = [];
    st.pendingTreasureBanner = null;
    st.killQuota = (st.portalType === "boss" || st.portalType === "campfire" || st.portalType === "mystery")
      ? 0
      : (st.portalType === "elite" ? 16 : Math.min(36, 16 + Math.floor(floor * 0.9)));

    st.activeAffixes = [];
    if (floor >= 11 && st.portalType !== "campfire" && st.portalType !== "mystery") {
      const count = floor >= 21 ? 2 : 1;
      const pool = [...this.AFFIXES].sort(() => Math.random() - 0.5);
      st.activeAffixes = pool.slice(0, count).map(a => a.id);
    }

    const stageObj = this.getStageForFloor(floor);
    if (typeof MapEngine !== "undefined") {
      if (MapEngine.setStage) MapEngine.setStage(stageObj.id);
      if (MapEngine.setArenaMode) MapEngine.setArenaMode(false);
      if (MapEngine.setBoundedMap) MapEngine.setBoundedMap(true, 540, 380);
    }

    app.enemies = [];
    app.enemyProjectiles = [];
    app.telegraphs = [];
    app.gems = [];
    app.mapItems = [];
    app.activeBoss = null;
    if (typeof SkillsEngine !== "undefined") {
      SkillsEngine.projectiles = [];
      SkillsEngine.groundHazards = [];
      SkillsEngine.meleeEffects = [];
    }
    p.x = 0; p.y = 140;
    app.camera.x = 0; app.camera.y = 80;

    if (this.hasRelic(app, "opening_charge")) p.trainerSkillCd = 0;
    if (this.hasRelic(app, "overheal_shield")) p.shieldTimer = Math.max(p.shieldTimer || 0, 4.0);

    const bossHud = document.getElementById("bossHudContainer");
    if (st.portalType === "boss") {
      this.setQuickExitVisible(false);
      this.spawnMegaTowerBosses(app, floor);
      if (bossHud) bossHud.classList.remove("hidden");
    } else if (st.portalType === "campfire") {
      if (bossHud) bossHud.classList.add("hidden");
      this.setQuickExitVisible(true);
      this.setupCampfireRoom(app);
    } else if (st.portalType === "mystery") {
      if (bossHud) bossHud.classList.add("hidden");
      this.setQuickExitVisible(true);
      this.setupMysteryRoom(app);
    } else {
      if (bossHud) bossHud.classList.add("hidden");
      this.setQuickExitVisible(false);
      if (st.portalType === "elite") {
        this.spawnTowerElitePair(app, floor);
      }
    }

    const isSpecialRoom = (st.portalType === "campfire" || st.portalType === "mystery");
    app.battleCountdownTimer = isSpecialRoom ? 0 : 1.80;
    app._lastCountdownBeat = 4;
    app.state = "PLAYING";

    const affNames = st.activeAffixes.map(id => (this.AFFIXES.find(a => a.id === id) || {}).name).filter(Boolean);
    let subTxt = affNames.length > 0 ? `環境詞綴：${affNames.join(" ＋ ")}` : "";
    if (!subTxt) {
      if (st.portalType === "boss") subTxt = "擊敗鎮守 Mega 首領，解鎖秘寶並晉級高層！";
      else if (st.portalType === "campfire") subTxt = "走入左側療癒陣回血，或右側鍛造陣強化招式！";
      else if (st.portalType === "mystery") subTxt = "走近地圖上的實體寶箱或祭壇做出抉擇！";
      else subTxt = `目標：清剿本層敵軍（${st.portalType === "elite" ? "精英試煉 ‧ 必掉遺物水晶" : `殲滅 ${st.killQuota} 隻`}）`;
    }
    if (app.showCutsceneBanner) {
      app.showCutsceneBanner(`🗼 MEGA 試煉塔 ‧ 第 ${floor} 層`, subTxt, 2100);
    }
    if (app.refreshHUD) app.refreshHUD();
  },

  setupCampfireRoom(app) {
    const st = app.towerState;
    st.roomProps = [
      { kind: "campfire_center", x: 0, y: -20, radius: 34, done: false },
      { kind: "campfire_heal", x: -160, y: 25, radius: 52, standTimer: 0, done: false, label: "💚 暖火療癒陣", sub: "回復 50% HP ＋ 淨化", color: "#10B981" },
      { kind: "campfire_forge", x: 160, y: 25, radius: 52, standTimer: 0, done: false, label: "🔨 招式鍛造陣", sub: "隨機招式 +2 級", color: "#F59E0B" }
    ];
  },

  setupMysteryRoom(app) {
    const st = app.towerState;
    if (Math.random() < 0.62) {
      // 真假雙寶箱實體房
      const realIdx = Math.random() < 0.5 ? 0 : 1;
      st.roomProps = [
        { kind: "mystery_chest", x: -150, y: -15, radius: 40, isReal: realIdx === 0, stateFrame: 0, standTimer: 0, done: false, label: "神秘紫寶箱 A", color: "#A855F7" },
        { kind: "mystery_chest", x: 150, y: -15, radius: 40, isReal: realIdx === 1, stateFrame: 0, standTimer: 0, done: false, label: "神秘紫寶箱 B", color: "#A855F7" }
      ];
    } else {
      // 狂戰血祭祭壇 ＋ 黃金補給箱
      st.roomProps = [
        { kind: "blood_altar", x: -160, y: 0, radius: 50, standTimer: 0, done: false, label: "🩸 狂戰血祭陣", sub: "扣20%血 ➔ 遺物＋全招+1", color: "#F43F5E" },
        { kind: "gold_supply", x: 160, y: 0, radius: 46, standTimer: 0, done: false, label: "💰 黃金補給箱", sub: "無傷奪 +140金 ＋ 回20%血", color: "#FACC15" }
      ];
    }
  },

  spawnMegaTowerBosses(app, floor) {
    const st = app.towerState;
    const diff = app.selectedDifficulty || { hpMult: 1.0, atkMult: 1.0, spdMult: 1.0 };
    const specs = (st && st.pendingBossSpecs) ? st.pendingBossSpecs : this.resolveBossSpecsForFloor(floor);

    const dualMod = specs.length >= 2 ? 0.68 : 1.0;
    const floorScale = 1 + (floor - 5) * 0.14;
    const gravMod = this.hasAffix(app, "heavy_gravity") ? 1.15 : 1.0;
    const swiftMod = this.hasAffix(app, "swift_barrage") ? 1.15 : 1.0;

    specs.forEach((sp, idx) => {
      const mf = (typeof MEGA_FORMS !== "undefined" && MEGA_FORMS[sp.baseId]) ? MEGA_FORMS[sp.baseId] : null;
      const bData = mf || POKEMON_MAP.get(sp.baseId) || POKEMON_MAP.get(150);
      const hp = Math.round(11500 * floorScale * diff.hpMult * dualMod * gravMod);
      const atk = Math.round((24 + floor * 0.85) * diff.atkMult);
      const bx = specs.length >= 2 ? (idx === 0 ? 190 : -190) : 0;
      const by = -110;
      const bossObj = {
        id: bData.id,
        data: bData,
        x: bx, y: by,
        hp, maxHp: hp,
        atk,
        speed: Math.min(125, 92 * diff.spdMult * swiftMod),
        radius: 42,
        isElite: true,
        isBoss: true,
        isMiniBoss: false,
        isLegendaryBoss: true,
        isTowerMegaBoss: true,
        bossArchetype: sp.arch,
        noEliteDrop: true,
        isShiny: false,
        whiteFlashTimer: 0,
        ccImmunityTimer: 0,
        dpsBucket: 0,
        dpsShieldFlashTimer: 0,
        status: null,
        statusTimer: 0,
        bossAttackTimer: 1.6 + idx * 0.7,
        bossAttackIdx: 0
      };
      app.enemies.push(bossObj);
      if (!app.activeBoss) app.activeBoss = bossObj;
    });
  },

  spawnTowerElitePair(app, floor) {
    const diff = app.selectedDifficulty || { hpMult: 1.0, atkMult: 1.0, spdMult: 1.0 };
    const elitePool = [59, 65, 68, 94, 130, 143, 149];
    const floorScale = 1 + (floor - 1) * 0.13;
    for (let i = 0; i < 2; i++) {
      const pid = elitePool[Math.floor(Math.random() * elitePool.length)];
      const data = POKEMON_MAP.get(pid) || POKEMON_MAP.get(68);
      const hp = Math.round(1350 * floorScale * diff.hpMult);
      app.enemies.push({
        id: pid, data,
        x: i === 0 ? 210 : -210, y: -90,
        hp, maxHp: hp,
        atk: Math.round((16 + floor * 0.65) * diff.atkMult),
        speed: Math.min(115, 84 * diff.spdMult),
        radius: 26,
        isElite: true, isMiniBoss: true, isBoss: false, isShiny: false,
        isTowerQuotaMob: true,
        expVal: 135,
        whiteFlashTimer: 0, ccImmunityTimer: 0, status: null, statusTimer: 0, treasureType: null
      });
    }
  },

  spawnTowerMob(app) {
    const st = app.towerState;
    const p = app.player;
    const diff = app.selectedDifficulty || { hpMult: 1.0, atkMult: 1.0, spdMult: 1.0 };
    const pool = [16, 19, 23, 27, 41, 43, 52, 58, 63, 66, 74, 81, 92, 100, 111, 129];
    const pid = pool[Math.floor(Math.random() * pool.length)];
    const data = POKEMON_MAP.get(pid) || POKEMON_MAP.get(19);
    const ang = Math.random() * Math.PI * 2;
    const dist = 260 + Math.random() * 140;
    const b = st.arenaBounds;
    const x = Math.max(-b.halfW + 30, Math.min(b.halfW - 30, p.x + Math.cos(ang) * dist));
    const y = Math.max(-b.halfH + 30, Math.min(b.halfH - 30, p.y + Math.sin(ang) * dist));
    const floorScale = 1 + (st.floor - 1) * 0.14;
    const gravMod = this.hasAffix(app, "heavy_gravity") ? 1.15 : 1.0;
    const swiftMod = this.hasAffix(app, "swift_barrage") ? 1.15 : 1.0;
    const hp = Math.round((72 + data.hp * 0.45) * floorScale * diff.hpMult * gravMod);
    app.enemies.push({
      id: pid, data, x, y,
      hp, maxHp: hp,
      atk: Math.round((10 + st.floor * 0.55) * diff.atkMult),
      speed: Math.min(120, (60 + data.speed * 0.22) * diff.spdMult * swiftMod),
      radius: 18,
      isElite: false, isBoss: false, isShiny: Math.random() < 0.03 * (diff.shinyBonus || 1),
      isTowerQuotaMob: true,
      expVal: 48 + st.floor * 3,
      whiteFlashTimer: 0, ccImmunityTimer: 0, status: null, statusTimer: 0, treasureType: null
    });
  },

  spawnPhysicalPortals(app) {
    const st = app.towerState;
    if (!st || st.portals.length > 0) return;
    const nextF = st.floor + 1;
    const py = -255;

    if (nextF % 5 === 0) {
      const ms = this.MEGA_MILESTONES.find(m => m.floor === nextF);
      const bossBaseId = ms ? ms.bossBaseIds[0] : 6;
      const bData = (typeof MEGA_FORMS !== "undefined" && MEGA_FORMS[bossBaseId]) ? MEGA_FORMS[bossBaseId] : POKEMON_MAP.get(bossBaseId);
      if (bData && bData.forward_sprite) SpriteCache.get(bData.forward_sprite);
      st.portals = [{
        type: "boss", x: 0, y: py, radius: 54, standTimer: 0,
        color: "#EF4444", label: `👑 ${nextF}F MEGA 首領`, sub: ms ? ms.title : "雙 Mega 決戰",
        bossSprite: bData ? bData.forward_sprite : null
      }];
    } else {
      const isPreBoss = ((nextF + 1) % 5 === 0);
      const rightPortal = isPreBoss
        ? { type: "campfire", x: 205, y: py, radius: 44, standTimer: 0, color: "#10B981", label: `🏕️ ${nextF}F 營火房`, sub: "回血 / 鍛造" }
        : { type: "mystery",  x: 205, y: py, radius: 44, standTimer: 0, color: "#A855F7", label: `❓ ${nextF}F 奇遇房`, sub: "雙寶箱 / 祭壇" };
      st.portals = [
        { type: "battle", x: -205, y: py, radius: 44, standTimer: 0, color: "#38BDF8", label: `⚔️ ${nextF}F 激戰門`, sub: "標準清剿" },
        { type: "elite",  x: 0,    y: py, radius: 44, standTimer: 0, color: "#F59E0B", label: `💀 ${nextF}F 精英試煉`, sub: "必掉遺物水晶" },
        rightPortal
      ];
    }

    this.setQuickExitVisible(true);
    if (typeof SoundFX !== "undefined") SoundFX.play("levelup");
    if (app.spawnFloatingText && app.player) {
      app.spawnFloatingText(app.player.x, app.player.y - 44, "🌀 上方傳送門已開啟！走入選擇下一層！", "#FACC15", 14);
    }
  },

  update(app, dt) {
    const st = app.towerState;
    const p = app.player;
    if (!st || !p) return;

    const b = st.arenaBounds;
    p.x = Math.max(-b.halfW + 24, Math.min(b.halfW - 24, p.x));
    p.y = Math.max(-b.halfH + 24, Math.min(b.halfH - 24, p.y));

    // 1. 戰鬥波次刷怪與清場判定
    if (!st.floorCleared && (st.portalType === "battle" || st.portalType === "elite")) {
      const aliveMobs = app.enemies.filter(e => e.hp > 0).length;
      const remain = Math.max(0, st.killQuota - st.killsInFloor);
      if (remain > 0 && aliveMobs < Math.min(18, remain + 3)) {
        st.spawnTimer -= dt;
        if (st.spawnTimer <= 0) {
          st.spawnTimer = Math.max(0.32, 0.72 - st.floor * 0.015);
          this.spawnTowerMob(app);
        }
      } else if (remain <= 0 && aliveMobs === 0) {
        this.onFloorCleared(app, 0, -40);
      }
    }

    // 2. 實體特殊房互動（營火房 ／ 奇遇雙寶箱房 ／ 血祭祭壇房）
    if (st.roomProps && st.roomProps.length > 0 && !st.floorCleared) {
      for (const prop of st.roomProps) {
        if (prop.done || prop.kind === "campfire_center") continue;
        const dist = Math.hypot(p.x - prop.x, p.y - prop.y);
        const triggerR = prop.radius + 16;
        if (dist <= triggerR) {
          if (prop.kind === "mystery_chest") prop.stateFrame = 1;
          prop.standTimer = (prop.standTimer || 0) + dt;
          if (prop.standTimer >= 0.45) {
            this.activateRoomProp(app, prop);
            break;
          }
        } else {
          prop.standTimer = Math.max(0, (prop.standTimer || 0) - dt * 2.5);
          if (prop.kind === "mystery_chest" && !prop.done) prop.stateFrame = 0;
        }
      }
    }

    // 3. 地面遺物水晶拾取
    if (st.relicDrop && !st.relicDrop.picked) {
      const rd = st.relicDrop;
      if (Math.hypot(p.x - rd.x, p.y - rd.y) <= 44) {
        rd.picked = true;
        app.state = "TOWER_MENU";
        if (typeof SoundFX !== "undefined") SoundFX.play("shiny");
        this.openRelicChoiceModal(app, st.pendingTreasureBanner);
        return;
      }
    }

    // 4. 實體三道傳送門走位進入（停留 0.45s 防誤觸）
    if (st.portals && st.portals.length > 0) {
      for (const pt of st.portals) {
        const dist = Math.hypot(p.x - pt.x, p.y - pt.y);
        if (dist <= pt.radius + 12) {
          pt.standTimer = (pt.standTimer || 0) + dt;
          if (pt.standTimer >= 0.45) {
            const fromF = st.floor;
            const nextF = st.floor + 1;
            const targetType = pt.type;
            st.portals = [];
            this.saveCheckpoint(app, nextF, targetType);
            this.launchFloorWithCeremony(app, fromF, nextF, targetType, false);
            return;
          }
        } else {
          pt.standTimer = Math.max(0, (pt.standTimer || 0) - dt * 3.0);
        }
      }
    }
  },

  activateRoomProp(app, prop) {
    const st = app.towerState;
    const p = app.player;
    if (!st || !p) return;

    if (prop.kind === "campfire_heal" || prop.kind === "campfire_forge") {
      st.roomProps.forEach(rp => { if (rp.kind !== "campfire_center") rp.done = true; });
      if (prop.kind === "campfire_heal") {
        const heal = Math.round(p.maxHp * 0.50);
        p.hp = Math.min(p.maxHp, p.hp + heal);
        p.status = null; p.statusTimer = 0;
        if (app.spawnFloatingText) app.spawnFloatingText(p.x, p.y - 36, `💚 暖火療癒！回復 +${heal} HP！`, "#10B981", 15);
      } else {
        const cand = Object.values(p.skills || {}).filter(s => s.level < 10);
        if (cand.length > 0) {
          const pick = cand[Math.floor(Math.random() * cand.length)];
          pick.level = Math.min(10, pick.level + 2);
          const meta = SKILLS_CATALOG[pick.id];
          if (app.spawnFloatingText) app.spawnFloatingText(p.x, p.y - 36, `🔨 鍛造成功！【${meta ? meta.name : pick.id}】+2 級！`, "#FACC15", 15);
        } else {
          p.dmgMult = (p.dmgMult || 1.0) + 0.10;
          if (app.spawnFloatingText) app.spawnFloatingText(p.x, p.y - 36, `🔨 鍛造極限！全傷害永久 +10%！`, "#FACC15", 15);
        }
      }
      if (typeof SoundFX !== "undefined") SoundFX.play("levelup");
      this.finishSpecialRoom(app);
    } else if (prop.kind === "mystery_chest") {
      st.roomProps.forEach(rp => { rp.done = true; });
      if (prop.isReal) {
        prop.stateFrame = 2; // 金光開箱
        app.runCoins = (app.runCoins || 0) + 130;
        if (app.saveData) app.saveData.coins = (app.saveData.coins || 0) + 130;
        if (app.spawnMapLoot) app.spawnMapLoot("rare_candy", prop.x, prop.y + 34);
        if (app.spawnFloatingText) app.spawnFloatingText(prop.x, prop.y - 36, "🎁 真品秘寶箱！+130 金 ＋ 神奇糖果！", "#FACC15", 15);
        if (typeof SoundFX !== "undefined") SoundFX.play("shiny");
        this.finishSpecialRoom(app);
      } else {
        prop.stateFrame = 3; // 百變怪紫煙現形！
        const ditto = POKEMON_MAP.get(132);
        const diff = app.selectedDifficulty || { hpMult: 1.0, atkMult: 1.0 };
        if (ditto) {
          const dHp = Math.round((1100 + st.floor * 160) * diff.hpMult);
          app.enemies.push({
            id: 132, data: ditto, x: prop.x, y: prop.y + 12,
            hp: dHp, maxHp: dHp, atk: Math.round((18 + st.floor * 0.6) * diff.atkMult), speed: 92, radius: 26,
            isElite: true, isMiniBoss: true, isBoss: false, isShiny: true,
            isTowerMimic: true, guaranteedRareCandy: true, expVal: 160,
            whiteFlashTimer: 0, ccImmunityTimer: 0, status: null, statusTimer: 0, treasureType: null
          });
        }
        if (app.spawnFloatingText) app.spawnFloatingText(prop.x, prop.y - 36, "😈 是閃光百變怪假扮的！擊倒它才能開門！", "#C084FC", 14);
        if (typeof SoundFX !== "undefined") SoundFX.play("boss_encounter");
      }
    } else if (prop.kind === "blood_altar" || prop.kind === "gold_supply") {
      st.roomProps.forEach(rp => { rp.done = true; });
      if (prop.kind === "blood_altar") {
        p.hp = Math.max(1, p.hp - Math.floor(p.hp * 0.20));
        Object.values(p.skills || {}).forEach(s => { if (s.level < 10) s.level = Math.min(10, s.level + 1); });
        if (app.spawnFloatingText) app.spawnFloatingText(p.x, p.y - 36, "🩸 狂戰血祭！全招 +1 級 ＆ 掉落遺物水晶！", "#F43F5E", 15);
        if (typeof SoundFX !== "undefined") SoundFX.play("super");
        st.floorCleared = true;
        st.relicDrop = { x: prop.x, y: prop.y + 42, picked: false };
      } else {
        app.runCoins = (app.runCoins || 0) + 140;
        if (app.saveData) app.saveData.coins = (app.saveData.coins || 0) + 140;
        p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * 0.20));
        if (app.spawnFloatingText) app.spawnFloatingText(p.x, p.y - 36, "💰 奪取黃金補給！+140 金 ＋ 回 20% HP！", "#FACC15", 15);
        if (typeof SoundFX !== "undefined") SoundFX.play("levelup");
        this.finishSpecialRoom(app);
      }
    }
  },

  finishSpecialRoom(app) {
    const st = app.towerState;
    if (!st) return;
    st.floorCleared = true;
    if (app.saveData) {
      if (!app.saveData.stats) app.saveData.stats = {};
      app.saveData.stats.bestTowerFloor = Math.max(app.saveData.stats.bestTowerFloor || 0, st.floor);
    }
    this.saveCheckpoint(app, st.floor + 1, "battle");
    this.spawnPhysicalPortals(app);
  },

  onEnemyKilled(app, enemy) {
    const st = app.towerState;
    if (!st) return;
    if (enemy && enemy.isTowerMimic && !st.floorCleared) {
      this.finishSpecialRoom(app);
      return;
    }
    if (st.floorCleared) return;
    if (enemy && enemy.isTowerQuotaMob && st.portalType !== "boss") {
      st.killsInFloor = Math.min(st.killQuota, (st.killsInFloor || 0) + 1);
    }
    if (this.hasRelic(app, "life_leech") && app.player && app.player.hp > 0) {
      const diffHeal = (app.selectedDifficulty && app.selectedDifficulty.healEff !== undefined) ? app.selectedDifficulty.healEff : 1.0;
      const berserkMod = this.hasAffix(app, "berserk_pact") ? 0.75 : 1.0;
      app.player.hp = Math.min(app.player.maxHp, app.player.hp + app.player.maxHp * 0.02 * diffHeal * berserkMod);
    }
    if (this.hasAffix(app, "toxic_death") && enemy && !enemy.isBoss && typeof SkillsEngine !== "undefined") {
      SkillsEngine.groundHazards.push({ kind: "enemy_poison_puddle", x: enemy.x, y: enemy.y, radius: 28, timer: 2.2, maxTime: 2.2 });
    }
  },

  onBossDefeated(app, boss) {
    const st = app.towerState;
    if (!st || st.floorCleared) return false;
    const stillAlive = app.enemies.some(e => e.isBoss && e.hp > 0 && e !== boss);
    if (stillAlive) return true;
    this.onFloorCleared(app, boss ? boss.x : 0, boss ? boss.y : -40);
    return true;
  },

  onFloorCleared(app, dropX = 0, dropY = -40) {
    const st = app.towerState;
    if (!st || st.floorCleared) return;
    st.floorCleared = true;

    const floor = st.floor;
    const diff = app.selectedDifficulty || { coinMult: 1.0 };
    const gravBonus = this.hasAffix(app, "heavy_gravity") ? 1.25 : 1.0;
    const resBonus = this.hasRelic(app, "relic_resonance") ? 1.30 : 1.0;
    const magFlat = this.hasRelic(app, "gold_magnet") ? 60 : 0;
    const coinGain = Math.round(((45 + floor * 12 + (st.portalType === "boss" ? 160 : 0)) * (diff.coinMult || 1.0) * gravBonus * resBonus) + magFlat);

    app.runCoins = (app.runCoins || 0) + coinGain;
    st.totalCoinsEarned = (st.totalCoinsEarned || 0) + coinGain;
    if (app.saveData) {
      app.saveData.coins = (app.saveData.coins || 0) + coinGain;
      if (!app.saveData.stats) app.saveData.stats = {};
      app.saveData.stats.bestTowerFloor = Math.max(app.saveData.stats.bestTowerFloor || 0, floor);
    }

    let newlyUnlockedTreasure = null;
    const ms = this.MEGA_MILESTONES.find(m => m.floor === floor);
    if (ms && app.saveData) {
      if (!app.saveData.unlockedLegendaryTreasures) app.saveData.unlockedLegendaryTreasures = {};
      if (!app.saveData.unlockedLegendaryTreasures[ms.treasureId]) {
        app.saveData.unlockedLegendaryTreasures[ms.treasureId] = true;
        newlyUnlockedTreasure = (typeof LEGENDARY_TREASURES !== "undefined") ? LEGENDARY_TREASURES[ms.treasureId] : null;
      }
    }

    this.saveCheckpoint(app, floor + 1, "battle");
    if (app.saveToStorage) app.saveToStorage();
    if (app.spawnFloatingText && app.player) {
      app.spawnFloatingText(app.player.x, app.player.y - 30, `🏆 第 ${floor} 層通關！賞金 +${coinGain} 金！`, "#FACC15", 15);
    }
    if (newlyUnlockedTreasure && app.pixelToast) {
      app.pixelToast(`🏆 永久解鎖傳說秘寶【${newlyUnlockedTreasure.name}】！`, "success");
    }

    // 精英／Mega 首領層：於場中掉落發光「遺物水晶」，玩家親自走去拾取才展開卡片三選一！
    if (st.portalType === "elite" || st.portalType === "boss") {
      const b = st.arenaBounds;
      st.relicDrop = {
        x: Math.max(-b.halfW + 90, Math.min(b.halfW - 90, dropX)),
        y: Math.max(-b.halfH + 110, Math.min(b.halfH - 90, dropY)),
        picked: false
      };
      st.pendingTreasureBanner = newlyUnlockedTreasure;
      this.setQuickExitVisible(true);
      if (app.spawnFloatingText) {
        app.spawnFloatingText(st.relicDrop.x, st.relicDrop.y - 36, "💎 掉落破格遺物水晶！走去拾取！", "#38BDF8", 14);
      }
    } else {
      // 普通層：直接開啟房間上方實體傳送門！
      this.spawnPhysicalPortals(app);
    }
  },

  renderRelicStrip(app) {
    const strip = document.getElementById("towerRelicStrip");
    if (!strip) return;
    const st = app.towerState;
    const list = (st && st.relics) || [];
    if (list.length === 0) {
      strip.classList.add("hidden");
      return;
    }
    strip.classList.remove("hidden");
    strip.innerHTML = `<span class="text-[9px] font-black text-indigo-700 mr-1">已持有遺物 (${list.length})：</span>` + list.map(rid => {
      const r = this.RELICS.find(x => x.id === rid);
      return r ? `<span class="px-1.5 py-0.5 rounded-md bg-indigo-50 border border-indigo-300 text-[9px] font-black text-indigo-900">${r.name}</span>` : "";
    }).join("");
  },

  openRelicChoiceModal(app, unlockedTreasure = null) {
    const modal = document.getElementById("towerModal");
    if (!modal) return;
    const st = app.towerState;
    const p = app.player;
    const titleEl = document.getElementById("towerModalTitle");
    const subEl = document.getElementById("towerModalSub");
    const hpEl = document.getElementById("towerModalHp");
    const grid = document.getElementById("towerChoicesGrid");

    if (hpEl && p) hpEl.textContent = `HP ${Math.ceil(p.hp)}/${p.maxHp}`;
    this.renderRelicStrip(app);

    const treasureBanner = unlockedTreasure
      ? `<div class="p-2.5 rounded-xl bg-amber-50 border-2 border-amber-500 flex items-center gap-2 mb-2">
           <img src="${unlockedTreasure.sprite}" class="w-8 h-8 pixel-sprite shrink-0"/>
           <div class="min-w-0">
             <div class="text-[10px] font-black text-amber-800">🏆 首次通關 ${st.floor}F ‧ 永久解鎖傳說秘寶！</div>
             <div class="text-xs font-black text-slate-900">${unlockedTreasure.name}</div>
             <div class="text-[10px] font-bold text-slate-600">${unlockedTreasure.desc}</div>
           </div>
         </div>`
      : "";

    if (titleEl) titleEl.textContent = `💎 拾取遺物水晶 ‧ 三選一`;
    if (subEl) subEl.textContent = "挑選 1 件本局專屬「塔內破格遺物」，選完即開啟上方傳送門：";
    const avail = this.RELICS.filter(r => !st.relics.includes(r.id)).sort(() => Math.random() - 0.5).slice(0, 3);
    const picks = avail.length > 0 ? avail : this.RELICS.slice(0, 3);
    grid.innerHTML = treasureBanner + picks.map(r => `
      <button type="button" onclick="ModeTower.chooseRelic('${r.id}')" class="tower-choice-card w-full text-left p-3 rounded-xl bg-white border-2 border-slate-800 shadow-[0_3px_0_#CBD5E1] hover:border-indigo-600 active:scale-[0.985] transition">
        <div class="flex items-center justify-between gap-2">
          <span class="font-black text-xs sm:text-sm text-slate-900 flex items-center gap-1.5">
            <span class="gba-ui-icon gba-ui-relic w-4 h-4"></span>${r.name}
          </span>
          <span class="px-2 py-0.5 rounded-full text-[9px] font-black text-white" style="background:${r.color};">${r.cat}遺物</span>
        </div>
        <p class="text-[11px] font-bold text-slate-600 mt-1 leading-snug">${r.desc}</p>
      </button>
    `).join("");

    modal.classList.remove("hidden");
    modal.style.display = "flex";
  },

  closeTowerModal() {
    const modal = document.getElementById("towerModal");
    if (modal) { modal.classList.add("hidden"); modal.style.display = "none"; }
  },

  chooseRelic(relicId) {
    const app = GameApp;
    const st = app && app.towerState;
    if (!st) return;
    if (!st.relics.includes(relicId)) {
      st.relics.push(relicId);
      if (relicId === "overheal_shield" && app.player) {
        const bonus = Math.round(app.player.maxHp * 0.22);
        app.player.maxHp += bonus;
        app.player.hp = Math.min(app.player.maxHp, app.player.hp + bonus);
      }
    }
    this.saveCheckpoint(app, st.floor + 1, "battle");
    this.closeTowerModal();
    app.state = "PLAYING";
    this.spawnPhysicalPortals(app);
  },

  // 繪製所有試煉塔實體物件（使用 images/tower_props_sheet.png 4x4 逐幀動畫精靈表）
  renderGroundEntities(app, ctx, toSx, toSy) {
    if (!app || !app.isTowerMode || !app.towerState) return;
    const st = app.towerState;
    const propRec = SpriteCache.get(this.PROPS_SHEET_URL);
    const hasSheet = !!(propRec && propRec.loaded);
    const frame4 = Math.floor(performance.now() / 160) % 4;
    const bob = Math.sin(performance.now() * 0.006) * 3.5;

    const drawPropFrame = (row, col, sx, sy, size) => {
      if (!hasSheet) return;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(propRec.img, col * 128, row * 128, 128, 128, sx - size / 2, sy - size / 2, size, size);
    };

    const drawLabel = (sx, sy, text, sub, borderCol) => {
      ctx.save();
      ctx.font = "900 10px 'Noto Sans TC', sans-serif";
      const w = Math.max(92, ctx.measureText(text).width + 18);
      const h = sub ? 32 : 20;
      ctx.fillStyle = "rgba(15, 23, 42, 0.90)";
      ctx.strokeStyle = borderCol;
      ctx.lineWidth = 2;
      ctx.fillRect(sx - w / 2, sy, w, h);
      ctx.strokeRect(sx - w / 2, sy, w, h);
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "center";
      ctx.fillText(text, sx, sy + 14);
      if (sub) {
        ctx.fillStyle = "#FEF08A";
        ctx.font = "700 8.5px 'Noto Sans TC', sans-serif";
        ctx.fillText(sub, sx, sy + 26);
      }
      ctx.restore();
    };

    // 1. 營火房 ／ 奇遇房實體物件
    if (st.roomProps && st.roomProps.length > 0) {
      st.roomProps.forEach(prop => {
        const sx = toSx(prop.x), sy = toSy(prop.y);
        ctx.save();
        if (prop.kind === "campfire_center") {
          const glow = ctx.createRadialGradient(sx, sy, 8, sx, sy, 85);
          glow.addColorStop(0, "rgba(251, 146, 60, 0.42)");
          glow.addColorStop(1, "rgba(251, 146, 60, 0)");
          ctx.fillStyle = glow;
          ctx.beginPath(); ctx.arc(sx, sy, 85, 0, Math.PI * 2); ctx.fill();
          drawPropFrame(1, frame4, sx, sy, 68);
        } else if (prop.kind === "mystery_chest") {
          const glow = ctx.createRadialGradient(sx, sy, 6, sx, sy, 46);
          glow.addColorStop(0, "rgba(168, 85, 247, 0.35)");
          glow.addColorStop(1, "rgba(168, 85, 247, 0)");
          ctx.fillStyle = glow;
          ctx.beginPath(); ctx.arc(sx, sy, 46, 0, Math.PI * 2); ctx.fill();
          drawPropFrame(3, prop.stateFrame || 0, sx, sy + (prop.done ? 0 : bob * 0.5), 56);
          if (!prop.done) {
            if (prop.standTimer > 0) {
              const prog = Math.min(1, prop.standTimer / 0.45);
              ctx.strokeStyle = "#FACC15";
              ctx.lineWidth = 4;
              ctx.beginPath(); ctx.arc(sx, sy, 34, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * prog); ctx.stroke();
            }
            drawLabel(sx, sy + 30, prop.label, "走近開啟", "#A855F7");
          }
        } else {
          // 圓形互動魔法陣（療癒陣 / 鍛造陣 / 血祭陣 / 黃金補給箱）
          ctx.globalAlpha = prop.done ? 0.28 : 1.0;
          ctx.fillStyle = `${prop.color}28`;
          ctx.beginPath(); ctx.arc(sx, sy, prop.radius, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = prop.color;
          ctx.lineWidth = 3;
          ctx.setLineDash([8, 5]);
          ctx.beginPath(); ctx.arc(sx, sy, prop.radius, 0, Math.PI * 2); ctx.stroke();
          ctx.setLineDash([]);
          if (prop.kind === "gold_supply") {
            drawPropFrame(3, prop.done ? 2 : 0, sx, sy - 4, 48);
          } else {
            drawPropFrame(prop.kind === "campfire_heal" ? 1 : 2, frame4, sx, sy - 4, 44);
          }
          if (!prop.done && prop.standTimer > 0) {
            const prog = Math.min(1, prop.standTimer / 0.45);
            ctx.strokeStyle = "#FFFFFF";
            ctx.lineWidth = 4.5;
            ctx.beginPath(); ctx.arc(sx, sy, prop.radius + 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * prog); ctx.stroke();
          }
          if (!prop.done) drawLabel(sx, sy + prop.radius + 6, prop.label, prop.sub, prop.color);
        }
        ctx.restore();
      });
    }

    // 2. 地面破格遺物水晶
    if (st.relicDrop && !st.relicDrop.picked) {
      const rd = st.relicDrop;
      const sx = toSx(rd.x), sy = toSy(rd.y);
      ctx.save();
      const beam = ctx.createLinearGradient(sx, sy - 110, sx, sy + 20);
      beam.addColorStop(0, "rgba(56, 189, 248, 0)");
      beam.addColorStop(1, "rgba(56, 189, 248, 0.38)");
      ctx.fillStyle = beam;
      ctx.fillRect(sx - 20, sy - 110, 40, 125);
      drawPropFrame(2, frame4, sx, sy + bob, 56);
      drawLabel(sx, sy + 30, "💎 遺物水晶", "走近拾取三選一", "#38BDF8");
      ctx.restore();
    }

    // 3. 房間上方實體傳送門（2~3 道門或 Mega 首領巨門）
    if (st.portals && st.portals.length > 0) {
      st.portals.forEach(pt => {
        const sx = toSx(pt.x), sy = toSy(pt.y);
        const isBoss = pt.type === "boss";
        const sz = isBoss ? 88 : 68;
        ctx.save();
        const aura = ctx.createRadialGradient(sx, sy, 10, sx, sy, pt.radius + 22);
        aura.addColorStop(0, `${pt.color}66`);
        aura.addColorStop(1, `${pt.color}00`);
        ctx.fillStyle = aura;
        ctx.beginPath(); ctx.arc(sx, sy, pt.radius + 22, 0, Math.PI * 2); ctx.fill();

        ctx.strokeStyle = pt.color;
        ctx.lineWidth = isBoss ? 4 : 3;
        ctx.beginPath(); ctx.arc(sx, sy, pt.radius, 0, Math.PI * 2); ctx.stroke();

        drawPropFrame(0, frame4, sx, sy, sz);

        // Mega 首領門頂部懸浮 Mega 首領像素頭像
        if (isBoss && pt.bossSprite) {
          const bRec = SpriteCache.get(pt.bossSprite);
          if (bRec && bRec.loaded) {
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(bRec.img, sx - 28, sy - sz / 2 - 44 + bob * 0.6, 56, 56);
          }
        }

        // 停留 0.45s 傳送進度環
        if (pt.standTimer > 0) {
          const prog = Math.min(1, pt.standTimer / 0.45);
          ctx.strokeStyle = "#FFFFFF";
          ctx.lineWidth = 5;
          ctx.beginPath(); ctx.arc(sx, sy, pt.radius + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * prog); ctx.stroke();
        }
        drawLabel(sx, sy + pt.radius + 6, pt.label, pt.sub, pt.color);
        ctx.restore();
      });
    }
  },

  renderEdgeIndicators(app, drawEdgeIconIndicator) {
    if (!app || !app.isTowerMode || !app.towerState) return;
    const st = app.towerState;
    const uiRec = (typeof FieldEventsEngine !== "undefined") ? SpriteCache.get(FieldEventsEngine.UI_SHEET_URL) : null;
    const uiImg = (uiRec && uiRec.loaded) ? uiRec.img : null;

    if (st.relicDrop && !st.relicDrop.picked) {
      const sr = (typeof FieldEventsEngine !== "undefined") ? FieldEventsEngine.getIconSrcRect("relic") : null;
      drawEdgeIconIndicator(st.relicDrop.x, st.relicDrop.y, "#38BDF8", "遺物", uiImg, 24, sr);
    }
    if (st.portals && st.portals.length > 0) {
      const targetPt = st.portals[Math.floor(st.portals.length / 2)];
      const sr = (typeof FieldEventsEngine !== "undefined") ? FieldEventsEngine.getIconSrcRect(targetPt.type === "boss" ? "tower" : "portal") : null;
      drawEdgeIconIndicator(targetPt.x, targetPt.y, targetPt.color, targetPt.type === "boss" ? "MEGA門" : "傳送門", uiImg, 24, sr);
    }
  },

  saveCheckpoint(app, nextFloor, nextPortalType = "battle") {
    if (!app || !app.saveData || !app.player || !app.towerState) return;
    const p = app.player;
    const st = app.towerState;
    app.saveData.towerCheckpoint = {
      nextFloor,
      nextPortalType,
      starterId: app.selectedStarterId,
      trainerId: app.selectedTrainer ? app.selectedTrainer.id : "ash",
      difficultyId: app.selectedDifficulty ? app.selectedDifficulty.id : "normal",
      relics: [...(st.relics || [])],
      runCoins: app.runCoins || 0,
      totalCoinsEarned: st.totalCoinsEarned || 0,
      player: {
        id: p.id, level: p.level, exp: p.exp,
        hp: Math.ceil(p.hp), maxHp: p.maxHp,
        dmgMult: p.dmgMult, speedMult: p.speedMult,
        skills: JSON.parse(JSON.stringify(p.skills || {})),
        heldItems: { ...(p.heldItems || {}) },
        legendaryTreasures: { ...(p.legendaryTreasures || {}) }
      }
    };
    if (app.saveToStorage) app.saveToStorage();
  },

  saveAndReturnToLobby() {
    const app = GameApp;
    if (!app) return;
    const st = app.towerState;
    this.closeTowerModal();
    this.setQuickExitVisible(false);
    if (st) {
      const saveF = st.floorCleared ? (st.floor + 1) : st.floor;
      const saveType = st.floorCleared ? "battle" : (st.portalType || "battle");
      this.saveCheckpoint(app, saveF, saveType);
    }
    if (typeof app.quitToTitle === "function") app.quitToTitle();
    if (st && app.pixelToast) {
      const saveF = st.floorCleared ? (st.floor + 1) : st.floor;
      app.pixelToast(`💾 已保存 Mega 試煉塔第 ${saveF} 層進度，隨時可回大廳續爬！`, "success");
    }
  }
};
