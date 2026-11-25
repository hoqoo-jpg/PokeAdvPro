/**
 * ============================================================================
 * skills_engine.js
 * 專屬招式與視覺特效引擎 (Skills & VFX Engine - GBA 像素風粒子與超武全屏渲染升級版)
 * 職責：
 * 1. 技能發射判定 (彈道數、穿透、追蹤、散射角、傷害加成與擊退分配)
 * 2. 投射物實體生命週期運算、拖尾粒子流 (Particle Trails) 與旋轉運動學
 * 3. 近戰刀光、空手劈氣勁巨拳、地震重踏裂痕與多段打擊幾何渲染
 * 4. 金白電漿鏈 (十萬伏特)、大字爆炎、高壓水柱、冰晶、幽靈鬼火專屬特效
 * 5. 全屏究極超武視覺爆發 (大字爆、潮旋激流、打雷風暴、瘋狂植物等專屬全屏動畫)
 * ============================================================================
 */

const SkillsEngine = {
  projectiles: [],
  meleeEffects: [],
  ultimateVfxList: [],
  lightningArcs: [],
  subParticles: [],
  groundHazards: [],
  scheduledEvents: [],

  reset() {
    this.projectiles = [];
    this.meleeEffects = [];
    this.ultimateVfxList = [];
    this.lightningArcs = [];
    this.subParticles = [];
    this.groundHazards = [];
    this.scheduledEvents = [];
  },

  scheduleEvent(delaySec, fn) {
    if (typeof fn !== "function") return;
    if (delaySec <= 0) {
      fn();
      return;
    }
    this.scheduledEvents.push({ delay: delaySec, fn });
  },

  getPlayerSkillAlpha() {
    const raw = (typeof GameApp !== "undefined" && GameApp.saveData && GameApp.saveData.settings && GameApp.saveData.settings.skillAlpha) || "85";
    const num = parseFloat(raw);
    if (!Number.isFinite(num)) return 0.85;
    return Math.max(0.25, Math.min(1.0, num / 100));
  },

  getLightProjectileAlpha() {
    return Math.max(0.60, this.getPlayerSkillAlpha());
  },

  // 【v7.2 第一刀解耦】陣營辨識、統一索敵與傷害路由介面 (team: "player" | "enemy")
  getCasterTeam(caster) {
    return (caster && caster.team === "enemy") ? "enemy" : "player";
  },

  getTargetsFor(team, x, y, radius) {
    if (team === "enemy") {
      const p = (typeof GameApp !== "undefined") ? GameApp.player : null;
      if (!p || p.hp <= 0) return [];
      const pad = radius + 24;
      if (Math.abs(p.x - x) <= pad && Math.abs(p.y - y) <= pad) {
        return [p];
      }
      return [];
    }
    return this.getEnemiesInRadius(x, y, radius);
  },

  applySkillHit(team, target, dmg, moveType, bonusStatusChance = 0, knockback = 0, extraCritBonus = 0) {
    if (!target || target.hp <= 0) return;
    if (team === "enemy") {
      if (typeof GameApp !== "undefined" && GameApp.dealEnemySkillDamageToPlayer) {
        GameApp.dealEnemySkillDamageToPlayer(dmg, moveType, bonusStatusChance, knockback);
      }
      return;
    }
    GameApp.dealDamageToEnemy(target, dmg, moveType, bonusStatusChance, knockback, extraCritBonus);
  },

  // 空間網格快速範圍索敵：利用 battle_core_2 每幀建立的 80x80 spatialGrid，將彈幕與領域碰撞由 O(N) 全陣列掃描降至 O(1) 鄰近格查詢
  getEnemiesInRadius(x, y, radius) {
    const grid = GameApp.spatialGrid;
    if (!grid || GameApp.enemies.length < 45) return GameApp.enemies;
    const cellSize = 80;
    const pad = radius + 46; // 涵蓋最大 Boss 半徑 (44px)
    const minGx = Math.floor((x - pad) / cellSize);
    const maxGx = Math.floor((x + pad) / cellSize);
    const minGy = Math.floor((y - pad) / cellSize);
    const maxGy = Math.floor((y + pad) / cellSize);
    const res = [];
    for (let gx = minGx; gx <= maxGx; gx++) {
      const gxBase = (gx + 32768) * 65536;
      for (let gy = minGy; gy <= maxGy; gy++) {
        const cell = grid.get(gxBase + (gy + 32768));
        if (cell) {
          for (let i = 0; i < cell.length; i++) res.push(cell[i]);
        }
      }
    }
    return res;
  },

  isInsideViewport(x, y, pad = 20) {
    if (typeof GameApp === "undefined" || !GameApp.camera) return true;
    return (
      Math.abs(x - GameApp.camera.x) <= GameApp.width * 0.5 + pad &&
      Math.abs(y - GameApp.camera.y) <= GameApp.height * 0.5 + pad
    );
  },

  getBeamLengthCap(kind) {
    const isPortraitMobile = !!(
      typeof GameApp !== "undefined" &&
      GameApp.isMobileDevice &&
      GameApp.isMobileDevice() &&
      GameApp.width < GameApp.height
    );
    if (isPortraitMobile) {
      if (kind === "Flamethrower") return Math.min(245, Math.max(195, Math.round(GameApp.width * 0.58)));
      if (kind === "HydroPump") return Math.min(265, Math.max(210, Math.round(GameApp.width * 0.62)));
      if (kind === "IceBeam") return Math.min(290, Math.max(230, Math.round(GameApp.width * 0.68)));
    }
    if (kind === "Flamethrower") return 285;
    if (kind === "HydroPump") return 355;
    if (kind === "IceBeam") return 365;
    return 320;
  },

  getVineWhipReach(level, areaScale = 1.0, traitBonus = 0) {
    const isPortraitMobile = !!(
      typeof GameApp !== "undefined" &&
      GameApp.isMobileDevice &&
      GameApp.isMobileDevice() &&
      GameApp.width < GameApp.height
    );
    const maxCap = isPortraitMobile ? 215 : 265;
    const baseLen = 88 + (level || 1) * 11;
    return Math.min(maxCap, Math.round(baseLen * Math.min(1.38, areaScale * (1 + (traitBonus || 0)))));
  },

  // 超武半徑軟上限計算：手機直屏自動收斂在螢幕寬度約 2/3（直徑 ~260~310px），避免蓋屏與遮擋彈幕
  getUltRadius(baseR, mobileCap = 158, desktopCap = 205) {
    const p = GameApp.player;
    const areaMult = p ? (p.areaMult || 1.0) : 1.0;
    const scaled = baseR * (1 + (areaMult - 1) * 0.60);
    const isPortraitMobile = !!(
      typeof GameApp !== "undefined" &&
      GameApp.isMobileDevice &&
      GameApp.isMobileDevice() &&
      GameApp.width < GameApp.height
    );
    if (isPortraitMobile) {
      const screenCap = Math.round(GameApp.width * 0.39);
      return Math.min(mobileCap, Math.max(125, screenCap), Math.round(scaled));
    }
    return Math.min(desktopCap, Math.round(scaled));
  },

  spawnSubParticle(x, y, vx, vy, color, size, life, shape = "circle") {
    const maxCap = (GameApp.enemies && GameApp.enemies.length > 140) ? 130 : 240;
    if (this.subParticles.length > maxCap) this.subParticles.shift();
    this.subParticles.push({
      x, y, vx, vy, color, size, life, maxLife: life, shape,
      rot: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 8
    });
  },

  // 預先生成不規則樹狀地裂網（從震央向外隨機偏折、由粗到細收尖並自然分岔，渲染時穩定不亂跳）
  buildQuakeCrackTree(branchCount, maxRadius, isUlt = false) {
    const segments = [];
    const rocks = [];
    const baseOffset = Math.random() * Math.PI * 2;
    const startR = isUlt ? 22 : 16;

    for (let b = 0; b < branchCount; b++) {
      // 基礎角度加上明顯隨機擾動，徹底消除等分輪輻感
      const sector = (Math.PI * 2) / branchCount;
      let curAng = baseOffset + b * sector + (Math.random() - 0.5) * sector * 0.62;
      const totalLen = maxRadius * (0.84 + Math.random() * 0.22);
      const steps = isUlt ? 5 : 4;
      let px = Math.cos(curAng) * startR;
      let py = Math.sin(curAng) * startR;

      for (let s = 0; s < steps; s++) {
        const t0 = s / steps;
        const t1 = (s + 1) / steps;
        const stepLen = (totalLen - startR) / steps * (0.82 + Math.random() * 0.36);
        if (s > 0) {
          curAng += (Math.random() < 0.5 ? 1 : -1) * (0.22 + Math.random() * 0.26);
        }
        const nx = px + Math.cos(curAng) * stepLen;
        const ny = py + Math.sin(curAng) * stepLen;
        const wMul = Math.max(0.22, 1.0 - t0 * 0.78);

        segments.push({ x1: px, y1: py, x2: nx, y2: ny, wMul, t0, t1, isSub: false });

        // 在中段轉折點（約 35% 與 68% 處）生成 1～2 條不對稱次級分岔裂紋
        if (s === 1 || (s === 2 && (isUlt || Math.random() < 0.75))) {
          const forkNum = (isUlt && s === 1) ? 2 : 1;
          for (let fk = 0; fk < forkNum; fk++) {
            const side = (fk === 0) ? (Math.random() < 0.5 ? 1 : -1) : -1;
            let subAng = curAng + side * (0.42 + Math.random() * 0.38);
            const subSteps = isUlt ? 2 : (Math.random() < 0.55 ? 2 : 1);
            let sx = nx, sy = ny;
            for (let ss = 0; ss < subSteps; ss++) {
              const sLen = totalLen * (0.16 + Math.random() * 0.12) * (ss === 0 ? 1.0 : 0.72);
              if (ss > 0) subAng += (Math.random() - 0.5) * 0.55;
              const snx = sx + Math.cos(subAng) * sLen;
              const sny = sy + Math.sin(subAng) * sLen;
              const subT0 = Math.min(0.95, t1 + ss * 0.14);
              const subT1 = Math.min(1.0, subT0 + 0.18);
              segments.push({
                x1: sx, y1: sy, x2: snx, y2: sny,
                wMul: ss === 0 ? 0.46 : 0.22,
                t0: subT0, t1: subT1, isSub: true
              });
              sx = snx; sy = sny;
            }
          }
        }

        // 在裂縫外圈轉折點佈置精簡大岩柱（地裂超武精簡至 5 根外圈錯落岩柱，保持內圈清爽不擋主角）
        if ((isUlt && s === 2 && b % 2 === 0) || (!isUlt && s === 1 && b % 2 === 0)) {
          rocks.push({
            x: nx + (Math.random() - 0.5) * 6,
            y: ny + (Math.random() - 0.5) * 6,
            h: isUlt ? (26 + Math.random() * 12) : (10 + Math.random() * 5),
            w: isUlt ? (11 + Math.random() * 4) : (6 + Math.random() * 3),
            hopH: isUlt ? 0 : (11 + Math.random() * 9),
            phase: b * 0.9 + s * 1.3
          });
        }

        px = nx;
        py = ny;
      }
    }
    return { segments, rocks };
  },

  // 全屬性專屬命中材質爆破 (Elemental Impact Hit-Sparks)
  spawnElementalHitSpark(x, y, type) {
    if (GameApp.enemies && GameApp.enemies.length > 140 && Math.random() < 0.65) return;
    if (type === "Water") {
      this.meleeEffects.push({
        style: "water_splash_burst",
        x, y,
        angle: Math.random() * Math.PI * 2,
        radius: 22,
        timer: 0.22,
        maxTime: 0.22,
        color: "#38BDF8"
      });
      for (let i = 0; i < 4; i++) {
        const a = Math.random() * Math.PI * 2;
        const spd = 48 + Math.random() * 58;
        this.spawnSubParticle(x, y, Math.cos(a) * spd, Math.sin(a) * spd - 14, i % 2 === 0 ? "#E0FFFF" : "#38BDF8", 2.6 + Math.random() * 1.1, 0.24, "circle");
      }
    } else if (type === "Ice") {
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2 + Math.random() * 0.4;
        this.spawnSubParticle(x, y, Math.cos(a) * 65, Math.sin(a) * 65, i % 2 === 0 ? "#67E8F9" : "#FFFFFF", 3.4, 0.22, "diamond");
      }
    } else if (type === "Fire" || type === "Dragon") {
      this.meleeEffects.push({ style: "z_spark", x, y, radius: 18, timer: 0.14, maxTime: 0.14, color: "#F97316" });
      for (let i = 0; i < 3; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.4;
        this.spawnSubParticle(x, y, Math.cos(a) * 45, Math.sin(a) * 65, i === 0 ? "#334155" : "#FEF08A", 3.2, 0.24, "star");
      }
    } else if (type === "Psychic" || type === "Ghost" || type === "Poison") {
      const col = type === "Poison" ? "#4ADE80" : "#F472B6";
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2 + 0.35;
        this.spawnSubParticle(x, y, Math.cos(a) * 58, Math.sin(a) * 58, i % 2 === 0 ? col : "#C084FC", 3.5, 0.22, "diamond");
      }
    } else if (type === "Grass" || type === "Bug") {
      for (let i = 0; i < 4; i++) {
        const a = Math.random() * Math.PI * 2;
        this.spawnSubParticle(x, y, Math.cos(a) * 62, Math.sin(a) * 62, i % 2 === 0 ? "#4ADE80" : "#BEF264", 3.2, 0.24, "leaf");
      }
    } else {
      this.meleeEffects.push({ style: "z_spark", x, y, radius: 17, timer: 0.14, maxTime: 0.14, color: TYPE_COLORS[type] || "#FACC15" });
    }
  },

  fireSkill(caster, skillId, level, isEvolved, dmgScale = 1.0, slotIdx = 0, opts = null) {
    const team = (opts && opts.team) || this.getCasterTeam(caster);
    if (skillId === "Metronome") {
      const pool = ["Flamethrower", "Hydro Pump", "Razor Leaf", "Seed Bomb", "Thunderbolt", "Shadow Ball", "Psystrike", "Ice Beam", "Moonblast", "Dragon Rush"];
      const pick1 = pool[Math.floor(Math.random() * pool.length)];
      this.fireSkill(caster, pick1, level, isEvolved, dmgScale * 1.15, slotIdx, opts);
      if (caster && caster.id === 151) {
        const rest = pool.filter(s => s !== pick1);
        const pick2 = rest[Math.floor(Math.random() * rest.length)];
        this.fireSkill(caster, pick2, level, isEvolved, dmgScale * 0.95, slotIdx + 1, opts);
      }
      return;
    }

    const meta = SKILLS_CATALOG[skillId] || SKILLS_CATALOG["Tackle"];
    const cleanSkillId = skillId.replace(/\s+/g, '');

    // 1. 陣營化智能索敵：敵方施法直接鎖定玩家；我方優先鎖定貼身警戒圈內敵軍
    let target = null;
    if (team === "enemy") {
      target = GameApp.player;
    } else {
      target = GameApp.findNearestEnemyInViewport(caster.x, caster.y, 105);
      if (!target) {
        if (["Thunderbolt", "Psystrike", "IceBeam", "ShadowBall"].includes(cleanSkillId)) {
          target = GameApp.findPriorityTargetInViewport ? GameApp.findPriorityTargetInViewport(caster.x, caster.y, 400, "highest_hp") : GameApp.findNearestEnemyInViewport(caster.x, caster.y, 400);
        } else if (["SeedBomb", "SludgeBomb"].includes(cleanSkillId)) {
          target = GameApp.findPriorityTargetInViewport ? GameApp.findPriorityTargetInViewport(caster.x, caster.y, 360, "cluster") : GameApp.findNearestEnemyInViewport(caster.x, caster.y, 360);
        } else {
          target = GameApp.findNearestEnemyInViewport(caster.x, caster.y, 380);
        }
      }
    }

    const useManualAim = (caster === GameApp.player && GameApp.manualAimMode);
    const moveAngle = (caster.vx || caster.vy)
      ? Math.atan2(caster.vy, caster.vx)
      : (caster.facingY !== 0 ? (caster.facingY < 0 ? -Math.PI / 2 : Math.PI / 2) : (caster.facingX >= 0 ? 0 : Math.PI));
    const baseAngle = (!useManualAim && target)
      ? Math.atan2(target.y - caster.y, target.x - caster.x)
      : moveAngle;

    // 槍口極細微粒子 (Muzzle Spark)：於發射口前方 22px 瞬間迸發 2～3 顆屬性微粒，不擋角色與腳下光環
    if (caster === GameApp.player && (!caster._lastMuzzleSparkMs || performance.now() - caster._lastMuzzleSparkMs > 160)) {
      const mobDense = GameApp.enemies && GameApp.enemies.length > 140;
      if (!mobDense || Math.random() < 0.45) {
        caster._lastMuzzleSparkMs = performance.now();
        const mx = caster.x + Math.cos(baseAngle) * 22;
        const my = caster.y + Math.sin(baseAngle) * 22;
        const mType = meta.type || "Normal";
        let mShape = "circle";
        let mCol1 = TYPE_COLORS[mType] || "#F8FAFC";
        let mCol2 = "#FFFFFF";
        if (mType === "Fire" || mType === "Dragon") { mShape = "star"; mCol1 = "#F97316"; mCol2 = "#FEF08A"; }
        else if (mType === "Electric") { mShape = "star"; mCol1 = "#FACC15"; mCol2 = "#FFFFFF"; }
        else if (mType === "Ice") { mShape = "diamond"; mCol1 = "#67E8F9"; mCol2 = "#E0F2FE"; }
        else if (mType === "Water") { mShape = "circle"; mCol1 = "#38BDF8"; mCol2 = "#E0F2FE"; }
        else if (mType === "Grass" || mType === "Bug") { mShape = "leaf"; mCol1 = "#4ADE80"; mCol2 = "#BEF264"; }
        else if (mType === "Psychic" || mType === "Ghost" || mType === "Poison") { mShape = "diamond"; mCol1 = mType === "Poison" ? "#A855F7" : "#F472B6"; mCol2 = "#E9D5FF"; }

        // 側向炸開的發射火花 (±35°~65° 高速斜向噴散，清晰展現屬性且絕不遮擋主角與子彈)
        const sparkNum = mobDense ? 2 : 4;
        for (let ms = 0; ms < sparkNum; ms++) {
          const side = (ms % 2 === 0) ? 1 : -1;
          const sideAngleOffset = side * (0.62 + Math.random() * 0.50); // ±35° ~ ±65°
          const sAng = baseAngle + sideAngleOffset;
          const sSpd = 85 + Math.random() * 50;
          const upDrift = (mType === "Fire" || mType === "Dragon") ? -28 : 0;
          this.spawnSubParticle(
            mx, my,
            Math.cos(sAng) * sSpd, Math.sin(sAng) * sSpd + upDrift,
            ms % 2 === 0 ? mCol1 : mCol2,
            3.2 + Math.random() * 1.3,
            0.28,
            mShape
          );
        }
      }
    }

    const countBonus = (level >= 4 ? 1 : 0) + (level >= 8 ? 1 : 0) + (caster === GameApp.player ? GameApp.player.projBonus : 0);
    const count = Math.min(4, 1 + countBonus);

    const isStab = (caster.data.type1 === meta.type || caster.data.type2 === meta.type);
    const stabMult = isStab ? 1.35 : 1.0;

    const lvDmgMult = 1 + (level - 1) * 0.06 + (level === 10 ? 0.12 : 0);

    const trait = (caster === GameApp.player && GameApp.player.innateTrait)
      ? GameApp.player.innateTrait
      : (typeof getPokemonInnateTrait === "function" ? getPokemonInnateTrait(caster.data, caster.level || 1) : {});
    caster._activeTrait = trait;
    if (caster === GameApp.player && trait && trait.id === "quick_attack") {
      caster.quickStepTimer = 1.1; // 電光疾行：全招式（含十萬伏特／空氣斬／撞擊）出招後皆觸發輕巧步伐加速
    }

    const basePower = meta.baseDmg * 0.55 + (GameApp.player.baseAtk * 0.18);
    // v6.6 傷害乘區收斂：地圖、天氣、攜帶物、力量強化與灼傷增傷統一移至 battle_core_2.dealDamageToEnemy 同區加法結算
    const rawDmg = basePower * lvDmgMult * GameApp.player.dmgMult * stabMult * dmgScale;

    if (meta.isMelee) {
      this.executeMeleeSkill(caster, meta, level, count, baseAngle, rawDmg);
      return;
    }

    if (skillId === "Thunderbolt") {
      const maxStrikeRange = 175 * GameApp.player.areaMult;
      const nearby = GameApp.enemies
        .filter(e => Math.hypot(e.x - caster.x, e.y - caster.y) <= maxStrikeRange)
        .sort((a, b) => Math.hypot(a.x - caster.x, a.y - caster.y) - Math.hypot(b.x - caster.x, b.y - caster.y));

      const thunderBonus = (MapEngine.weather === "THUNDER" ? 1 : 0) + (caster && caster.id === 145 ? 2 : 0);
      const boltCount = Math.max(3, count + 1 + thunderBonus);
      for (let b = 0; b < boltCount; b++) {
        const enemyTarget = nearby[b];
        let endX, endY, strikeAng;
        if (enemyTarget) {
          endX = enemyTarget.x; endY = enemyTarget.y;
          strikeAng = Math.atan2(endY - caster.y, endX - caster.x);
          GameApp.dealDamageToEnemy(enemyTarget, rawDmg, meta.type, level >= 5 ? 0.25 : 0.18, meta.knockback !== undefined ? meta.knockback : 2);
        } else {
          strikeAng = baseAngle + (b - (boltCount - 1) / 2) * 0.36;
          const rDist = (125 + Math.random() * 85) * GameApp.player.areaMult;
          endX = caster.x + Math.cos(strikeAng) * rDist;
          endY = caster.y + Math.sin(strikeAng) * rDist;
          this.getEnemiesInRadius(endX, endY, 44).forEach(e => {
            if (Math.hypot(e.x - endX, e.y - endY) <= 44 + e.radius) {
              GameApp.dealDamageToEnemy(e, rawDmg * 0.85, meta.type, 0.35, meta.knockback !== undefined ? meta.knockback : 2);
            }
          });
        }
        // 起點外推至主角 28px 淨空環邊緣，不從身體正中央拉線
        const startX = caster.x + Math.cos(strikeAng) * 28;
        const startY = caster.y + Math.sin(strikeAng) * 28;
        this.createLightningArc(startX, startY, endX, endY, "#FDE047", true);

        // 命中爆開金白十字電火花
        this.meleeEffects.push({
          style: "z_spark",
          x: endX,
          y: endY,
          radius: 22,
          timer: 0.20,
          maxTime: 0.20,
          color: "#FEF08A"
        });
        for (let sp = 0; sp < 6; sp++) {
          const sAng = Math.random() * Math.PI * 2;
          const spd = 65 + Math.random() * 95;
          this.spawnSubParticle(endX, endY, Math.cos(sAng) * spd, Math.sin(sAng) * spd, sp % 2 === 0 ? "#FEF08A" : "#FFFFFF", 2.8 + Math.random() * 2, 0.35, "star");
        }
      }
      SoundFX.play("hit", "Electric");
      return;
    }

    // 1B. 種子機關槍 (Bullet Seed)：鎖定同一目標連續高頻連射 4～6 顆黃金流光種子彈（目標中途陣亡才自動轉火）
    if (cleanSkillId === "BulletSeed" || meta.vfx === "bullet_seed") {
      const burstCount = 4 + (level >= 4 ? 1 : 0) + (level >= 8 ? 1 : 0) + (caster === GameApp.player ? (GameApp.player.projBonus || 0) : 0);
      const areaBonus = 1 + (trait.overgrowAreaBonus || 0) + (trait.legendaryAreaBonus || 0);
      let lockedTarget = (!useManualAim) ? (target || GameApp.findNearestEnemyInViewport(caster.x, caster.y, 370)) : null;

      for (let b = 0; b < burstCount; b++) {
        this.scheduleEvent(b * 0.072, () => {
          if (!caster || (caster === GameApp.player && GameApp.state !== "PLAYING")) return;
          if (!useManualAim) {
            const stillAlive = lockedTarget && lockedTarget.hp > 0 && GameApp.enemies.includes(lockedTarget) &&
              Math.hypot(lockedTarget.x - caster.x, lockedTarget.y - caster.y) <= 410;
            if (!stillAlive) {
              lockedTarget = GameApp.findNearestEnemyInViewport(caster.x, caster.y, 370);
            }
          }
          const jitter = (Math.random() - 0.5) * 0.06;
          const liveMoveAng = (caster.vx || caster.vy)
            ? Math.atan2(caster.vy, caster.vx)
            : baseAngle;
          const shotAng = (!useManualAim && lockedTarget)
            ? Math.atan2(lockedTarget.y - caster.y, lockedTarget.x - caster.x) + jitter
            : (useManualAim ? liveMoveAng : baseAngle) + jitter;

          const spd = 445;
          const latJitter = (b % 2 === 0 ? 1 : -1) * 3.0;
          const perpS = shotAng + Math.PI / 2;
          const mx = caster.x + Math.cos(shotAng) * 22 + Math.cos(perpS) * latJitter;
          const my = caster.y + Math.sin(shotAng) * 22 + Math.sin(perpS) * latJitter;
          this.spawnSubParticle(mx, my, Math.cos(shotAng + 0.4) * 45, Math.sin(shotAng + 0.4) * 45, "#BEF264", 2.4, 0.16, "leaf");
          this.projectiles.push({
            x: mx,
            y: my,
            vx: Math.cos(shotAng) * spd,
            vy: Math.sin(shotAng) * spd,
            initSpeed: spd,
            angle: shotAng,
            casterRef: caster,
            radius: Math.min(18, 11 * GameApp.player.areaMult * areaBonus),
            dmg: rawDmg * 0.48,
            type: "Grass",
            skillId: "Bullet Seed",
            vfx: "bullet_seed",
            homing: false,
            color: "#84CC16",
            pierce: level >= 6 ? 2 : 1,
            knockback: 3,
            life: 0.72,
            maxLife: 0.72,
            statusBonus: level >= 5 ? 0.20 : 0.10,
            hitSet: new Set(),
            trailTimer: 0
          });
          if (b % 2 === 0) SoundFX.play("hit", "Grass");
        });
      }
      return;
    }

    // 2. 沙盒 V10 物理高拋拋物線：種子炸彈 (Seed Bomb / seed_nut)
    if (cleanSkillId === "SeedBomb" || meta.vfx === "seed_nut") {
      const nutCount = Math.min(4, count);
      // 0.28s 移動方向微預判（針對朝向玩家逼近的敵群，避開逃跑寶藏怪）
      let aimX = caster.x + Math.cos(baseAngle) * 185;
      let aimY = caster.y + Math.sin(baseAngle) * 185;
      if (!useManualAim && target) {
        let leadX = target.x, leadY = target.y;
        if (!target.treasureType && target.status !== "Freeze") {
          const toPAng = Math.atan2(GameApp.player.y - target.y, GameApp.player.x - target.x);
          const leadDist = Math.min(44, (target.speed || 65) * 0.28);
          leadX += Math.cos(toPAng) * leadDist;
          leadY += Math.sin(toPAng) * leadDist;
        }
        aimX = leadX;
        aimY = leadY;
      }
      const aimAng = Math.atan2(aimY - caster.y, aimX - caster.x);
      const baseDist = (!useManualAim && target) ? Math.min(310, Math.max(75, Math.hypot(aimX - caster.x, aimY - caster.y))) : 185;

      for (let i = 0; i < nutCount; i++) {
        const spreadAng = aimAng + (nutCount > 1 ? (i - (nutCount - 1) / 2) * 0.24 : 0) + (Math.random() - 0.5) * 0.10;
        const targetDist = baseDist + (i - (nutCount - 1) / 2) * 24;
        const tx = caster.x + Math.cos(spreadAng) * targetDist;
        const ty = caster.y + Math.sin(spreadAng) * targetDist;
        const flightTime = 0.46 + i * 0.04;

        this.projectiles.push({
          x: caster.x,
          y: caster.y,
          startX: caster.x,
          startY: caster.y,
          targetX: tx,
          targetY: ty,
          vx: 0,
          vy: 0,
          angle: spreadAng,
          progress: 0,
          arcHeight: 62 + i * 7,
          radius: Math.min(22, (13 + level * 0.5) * GameApp.player.areaMult * (1 + (trait.overgrowAreaBonus || 0) + (trait.legendaryAreaBonus || 0))),
          blastAreaBonus: 1 + (trait.overgrowAreaBonus || 0) + (trait.legendaryAreaBonus || 0),
          dmg: rawDmg * 1.15,
          type: "Grass",
          skillId: "Seed Bomb",
          vfx: "seed_nut",
          isVenusaurSeed: !!(caster && (caster.id === 3 || caster.id === 10033)),
          isMegaVenusaurSeed: !!(caster && caster.id === 10033),
          color: "#65A30D",
          pierce: 99,
          knockback: meta.knockback !== undefined ? meta.knockback : 10,
          life: flightTime,
          maxLife: flightTime,
          statusBonus: level >= 5 ? 0.35 : 0.15,
          hitSet: new Set(),
          trailTimer: 0
        });
      }
      SoundFX.play("hit", "Grass");
      return;
    }

    // 2B. 污泥炸彈 (Sludge Bomb)：拋物線投擲 + 落地生成持續 3.2 秒冒泡腐蝕毒沼 (多段 DOT)
    if (cleanSkillId === "SludgeBomb") {
      const lobCount = Math.min(3, count);
      let aimX = caster.x + Math.cos(baseAngle) * 165;
      let aimY = caster.y + Math.sin(baseAngle) * 165;
      if (!useManualAim && target) {
        let leadX = target.x, leadY = target.y;
        if (!target.treasureType && target.status !== "Freeze") {
          const toPAng = Math.atan2(GameApp.player.y - target.y, GameApp.player.x - target.x);
          const leadDist = Math.min(42, (target.speed || 65) * 0.28);
          leadX += Math.cos(toPAng) * leadDist;
          leadY += Math.sin(toPAng) * leadDist;
        }
        aimX = leadX;
        aimY = leadY;
      }
      const aimAng = Math.atan2(aimY - caster.y, aimX - caster.x);
      const baseDist = (!useManualAim && target) ? Math.min(280, Math.max(72, Math.hypot(aimX - caster.x, aimY - caster.y))) : 165;

      for (let i = 0; i < lobCount; i++) {
        const spreadAng = aimAng + (lobCount > 1 ? (i - (lobCount - 1) / 2) * 0.28 : 0);
        const tx = caster.x + Math.cos(spreadAng) * (baseDist + (i - (lobCount - 1) / 2) * 26);
        const ty = caster.y + Math.sin(spreadAng) * (baseDist + (i - (lobCount - 1) / 2) * 26);
        const flightTime = 0.45 + i * 0.04;

        this.projectiles.push({
          x: caster.x, y: caster.y,
          startX: caster.x, startY: caster.y,
          targetX: tx, targetY: ty,
          vx: 0, vy: 0, angle: spreadAng,
          progress: 0, arcHeight: 54 + i * 5,
          radius: Math.min(22, (14 + level * 0.5) * GameApp.player.areaMult),
          hazardDurMult: trait.psychicHazardDurMult || 1.0,
          dmg: rawDmg * 0.85,
          type: "Poison", skillId: "Sludge Bomb", vfx: "sludge_lob",
          isMegaGengarPuddle: !!(caster && caster.id === 10038),
          color: (caster && caster.id === 10038) ? "#E11D48" : "#9333EA", pierce: 99, knockback: 4,
          life: flightTime, maxLife: flightTime,
          statusBonus: level >= 5 ? 0.45 : 0.25,
          hitSet: new Set(), trailTimer: 0
        });
      }
      SoundFX.play("hit", "Poison");
      return;
    }

    // 2C. 月亮之力 (Moonblast)：平衡版區域月光聖柱（精準半徑 + 0.90s 俐落持續 + 70px/s 緩步壓制 + 降攻輔助）
    if (cleanSkillId === "Moonblast") {
      const pillarCount = Math.min(2, 1 + (level >= 6 ? 1 : 0));
      const moonDur = 0.90 * (trait.psychicHazardDurMult || 1.0);
      const moonRad = Math.min(62, (34 + level * 1.6) * GameApp.player.areaMult * (1 + (trait.legendaryAreaBonus || 0)));
      for (let i = 0; i < pillarCount; i++) {
        const ang = baseAngle + (i - (pillarCount - 1) / 2) * 0.42;
        const dist = (!useManualAim && target) ? Math.min(235, Math.max(48, Math.hypot(target.x - caster.x, target.y - caster.y))) : 120;
        const px = caster.x + Math.cos(ang) * dist;
        const py = caster.y + Math.sin(ang) * dist;
        this.groundHazards.push({
          kind: "moon_pillar",
          x: px, y: py,
          vx: Math.cos(ang) * 65, vy: Math.sin(ang) * 65,
          radius: moonRad,
          dmg: rawDmg * 0.45,
          type: "Psychic",
          timer: moonDur, maxTime: moonDur,
          tickTimer: 0.06, tickInterval: 0.34,
          color: "#F472B6"
        });
      }
      SoundFX.play("super");
      return;
    }

    // 2D. 精神擊破 (Psystrike)：多重同心橢圓念力波環高速推進 + 終點念力內爆坍縮
    if (cleanSkillId === "Psystrike") {
      const waveCount = Math.min(3, count);
      for (let i = 0; i < waveCount; i++) {
        const ang = baseAngle + (waveCount > 1 ? (i - (waveCount - 1) / 2) * 0.24 : 0);
        const psyDist = target ? Math.hypot(target.x - caster.x, target.y - caster.y) : 999;
        const muzzleR = psyDist < 75 ? 8 : 28;
        const startX = caster.x + Math.cos(ang) * muzzleR;
        const startY = caster.y + Math.sin(ang) * muzzleR;
        const spd = 340;
        const mewtwoScale = (caster && caster.id === 150) ? 1.35 : 1.0;
        this.projectiles.push({
          x: startX,
          y: startY,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          angle: ang,
          radius: Math.min(28, (18 + level * 0.7) * GameApp.player.areaMult * mewtwoScale),
          dmg: rawDmg * 0.85,
          type: "Psychic",
          skillId: "Psystrike",
          vfx: "psychic_lance",
          homing: true,
          color: "#EC4899",
          pierce: (level >= 6 ? 4 : 3) + (trait.psychicExtraPierce || 0),
          knockback: 4,
          life: 0.85,
          statusBonus: level >= 5 ? 0.35 : 0.20,
          hitSet: new Set(),
          trailTimer: 0
        });

        // 終點念力內爆陣（貼地層）
        const blastDist = (185 + level * 6) * GameApp.player.areaMult;
        this.groundHazards.push({
          kind: "psy_delayed_blast",
          x: caster.x + Math.cos(ang) * blastDist,
          y: caster.y + Math.sin(ang) * blastDist,
          radius: (50 + level * 2) * GameApp.player.areaMult,
          dmg: rawDmg * 0.65,
          type: "Psychic",
          timer: 0.38, maxTime: 0.38,
          tickTimer: 0.35, tickInterval: 99,
          color: "#EC4899"
        });
      }
      SoundFX.play("hit", "Psychic");
      return;
    }

    // 2E-0. 火花 (Ember)：廣角扇形（±26°）、短射程（~180px）高頻噴吐 2～4 團搖曳火苗，專職貼身扇形撒網與高頻灼傷
    if (cleanSkillId === "Ember") {
      const sparkCount = Math.min(5, count + 1); // Lv.1: 2團, Lv.4: 3團, Lv.8: 4團
      const fanArc = 0.60 + (level >= 6 ? 0.14 : 0); // 約 34°~42° 廣角噴濺火星扇面
      const areaBonus = 1 + (trait.dragonMawAreaBonus || 0) + (trait.legendaryAreaBonus || 0);
      for (let i = 0; i < sparkCount; i++) {
        const frac = sparkCount > 1 ? (i / (sparkCount - 1) - 0.5) : 0;
        const ang = baseAngle + frac * fanArc + (Math.random() - 0.5) * 0.10;
        const spd = 410 + (Math.random() - 0.5) * 45;
        const muzzle = 20;
        this.projectiles.push({
          x: caster.x + Math.cos(ang) * muzzle,
          y: caster.y + Math.sin(ang) * muzzle,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          initSpeed: spd,
          angle: ang,
          cinderSeed: Math.random() * 100,
          flutterSign: (i % 2 === 0 ? 1 : -1),
          casterRef: caster,
          radius: Math.min(23, 15.5 * GameApp.player.areaMult * (level >= 8 ? 1.18 : 1.0) * areaBonus),
          dmg: rawDmg * 0.68,
          type: "Fire",
          skillId: "Ember",
          vfx: "ember_spark",
          isMegaBlueFlame: !!(caster && caster.id === 10034),
          homing: false,
          color: "#F97316",
          pierce: level >= 6 ? 3 : 2,
          knockback: 0,
          life: 0.54,
          maxLife: 0.54,
          statusBonus: level >= 5 ? 0.40 : 0.22,
          hitSet: new Set(),
          trailTimer: 0
        });
      }
      SoundFX.play("hit", "Fire");
      return;
    }

    // 2E. 噴射火焰 (Flamethrower) — 連續噴射式錐形烈焰流：四層翻湧火浪 ＋ 捲曲火舌 ＋ 兩段灼燒沖刷（火焰鳥 #146 專屬三向鳳凰烈焰）
    if (cleanSkillId === "Flamethrower") {
      const isMoltres = !!(caster && caster.id === 146);
      const isCharizard = !!(caster && caster.id === 6);
      const isMegaX = !!(caster && caster.id === 10034);
      const isInferno = (level >= 8);
      const streamCount = isMoltres ? 3 : 1;
      const traitAreaMult = 1 + (trait.dragonMawAreaBonus || 0) + (trait.legendaryAreaBonus || 0);
      const lvLenMult = level >= 8 ? 1.22 : (level >= 4 ? 1.12 : 1.0);
      const lvWidthMult = level >= 8 ? 1.34 : (level >= 4 ? 1.18 : 1.0);
      const beamLength = Math.min(this.getBeamLengthCap("Flamethrower"), (175 + level * 6.5) * Math.min(1.42, GameApp.player.areaMult * lvLenMult * (1 + (trait.dragonMawAreaBonus || 0) * 0.5)));
      const endHalfW = Math.min(54, (24 + level * 1.1) * lvWidthMult * (isMoltres ? 1.12 : 1.0) * Math.min(1.38, GameApp.player.areaMult * traitAreaMult));

      for (let s = 0; s < streamCount; s++) {
        const angOffset = streamCount === 3 ? (s - 1) * 0.28 : 0;
        const ang = baseAngle + angOffset;
        const startX = caster.x + Math.cos(ang) * 22;
        const startY = caster.y + Math.sin(ang) * 22;
        const clippedFlame = (GameApp.isArenaMode && typeof MapEngine !== "undefined" && MapEngine.clipRayAgainstArenaPillars)
          ? MapEngine.clipRayAgainstArenaPillars(startX, startY, ang, beamLength, 4)
          : { length: beamLength, hit: false };

        this.meleeEffects.push({
          style: "flamethrower_beam",
          casterRef: caster,
          ox: startX,
          oy: startY,
          x: startX,
          y: startY,
          angle: ang,
          baseLength: beamLength,
          length: clippedFlame.length,
          startHalfW: 9,
          endHalfW: endHalfW,
          isInferno,
          isMoltresFlame: isMoltres,
          isCharizardFlame: isCharizard,
          isMegaBlueFlame: isMegaX,
          dmg: rawDmg * (isInferno ? 0.66 : 0.60),
          type: "Fire",
          kb: 0,
          statusBonus: level >= 5 ? 0.36 : 0.18,
          hitSet: new Set(),
          secondTickDone: false,
          emberEmitTimer: 0.04,
          timer: 0.38,
          maxTime: 0.38,
          color: "#EF4444"
        });

        for (let ms = 0; ms < 4; ms++) {
          const mAng = ang + (Math.random() - 0.5) * 0.9;
          const mSpd = 55 + Math.random() * 55;
          const mCol = isMegaX ? (ms % 2 === 0 ? "#E0F2FE" : "#38BDF8") : (isCharizard && ms === 0 ? "#38BDF8" : (ms % 2 === 0 ? "#FEF08A" : "#F97316"));
          this.spawnSubParticle(startX, startY, Math.cos(mAng) * mSpd, Math.sin(mAng) * mSpd - 16, mCol, 3.0, 0.26, "star");
        }

        // 超級噴火龍X (#10034) 蒼藍冥炎質變：噴射火焰沿途與末端潑灑留下 2 團蒼藍冥炎火簇持續灼燒敵群
        if (isMegaX && typeof GameApp !== "undefined" && Array.isArray(GameApp.lavaFootprints)) {
          [0.58, 0.92].forEach(frac => {
            if (GameApp.lavaFootprints.length >= 26) GameApp.lavaFootprints.shift();
            GameApp.lavaFootprints.push({
              x: startX + Math.cos(ang) * (clippedFlame.length * frac),
              y: startY + Math.sin(ang) * (clippedFlame.length * frac) + 6,
              radius: 28,
              life: 2.3,
              maxLife: 2.3,
              tickTimer: 0.12,
              isMegaBlue: true,
              seed: Math.random() * 100
            });
          });
        }
      }

      if (caster === GameApp.player) {
        caster.recoilX = -Math.cos(baseAngle) * 3.8;
        caster.recoilY = -Math.sin(baseAngle) * 3.8;
        caster.recoilTimer = 0.11;
      }
      SoundFX.play("hit", "Fire");
      return;
    }

    // 2F. 水炮 (Hydro Pump) — 水箭龜 (#009) 雙肩平行重炮 ／ 超級水箭龜 (#10036) 背甲巨型主炮＋雙腕副炮三管齊射
    if (cleanSkillId === "HydroPump") {
      const isMegaBlastoise = !!(caster && caster.id === 10036);
      const isMegaGyarados = !!(caster && caster.id === 10041);
      const isBlastoise = !!(caster && (caster.id === 9 || caster.id === 10036 || caster.id === 10041));
      const isOverpressure = (level >= 8) || isMegaBlastoise || isMegaGyarados;
      const beamCount = isMegaBlastoise ? 3 : ((isBlastoise || isMegaGyarados) ? 2 : Math.min(2, count));
      const traitSizeMult = 1 + (trait.megaLauncherSizeBonus || 0) + (trait.legendaryAreaBonus || 0);
      const traitKbMult = 1 + (trait.megaLauncherKbBonus || 0);
      const beamLength = Math.min(this.getBeamLengthCap("HydroPump") + (isMegaBlastoise ? 22 : 0), (205 + level * 8) * Math.min(1.52, GameApp.player.areaMult * (isOverpressure ? 1.18 : 1.0) * (1 + (trait.megaLauncherSizeBonus || 0) * 0.5)));
      const beamWidth = Math.min(50, (18 + level * 0.85) * (isOverpressure ? 1.28 : 1.0) * (isBlastoise ? 1.16 : 1.0) * Math.min(1.40, GameApp.player.areaMult * traitSizeMult));
      const perp = baseAngle + Math.PI / 2;

      for (let b = 0; b < beamCount; b++) {
        let angOffset = 0;
        let latOffset = 0;
        let widthMult = 1.0;
        let dmgMult = isOverpressure ? 0.68 : 0.60;
        if (isMegaBlastoise) {
          // 超級水箭龜 (#10036) 專屬：中央背甲巨型主炮 (b===1) ＋ 左右雙腕副炮 (b===0, 2) 三管齊射
          if (b === 1) {
            angOffset = 0;
            latOffset = 0;
            widthMult = 1.24;
            dmgMult = 0.80;
          } else {
            angOffset = (b === 0 ? -0.10 : 0.10);
            latOffset = (b === 0 ? -17 : 17);
            widthMult = 0.72;
            dmgMult = 0.50;
          }
        } else if (isBlastoise) {
          // 水箭龜 (#009) 專屬：雙肩寬距嚴格平行齊射（張角 0、肩距 ±13px）
          angOffset = 0;
          latOffset = (b === 0 ? -13 : 13);
        } else if (beamCount === 2) {
          // 通用 Lv.4+ 雙柱高壓水炮（微張角 ±0.08 rad）
          angOffset = (b === 0 ? -0.08 : 0.08);
          latOffset = (b === 0 ? -9 : 9);
        }
        const ang = baseAngle + angOffset;
        const startX = caster.x + Math.cos(perp) * latOffset + Math.cos(ang) * 22;
        const startY = caster.y + Math.sin(perp) * latOffset + Math.sin(ang) * 22;
        const rawHydroLen = beamLength * (isMegaBlastoise && b !== 1 ? 0.88 : 1.0);
        const clippedHydro = (GameApp.isArenaMode && typeof MapEngine !== "undefined" && MapEngine.clipRayAgainstArenaPillars)
          ? MapEngine.clipRayAgainstArenaPillars(startX, startY, ang, rawHydroLen, 4)
          : { length: rawHydroLen, hit: false };

        this.meleeEffects.push({
          style: "hydro_pump_beam",
          casterRef: caster,
          latOffset,
          perpAngle: perp,
          isBlastoiseCannon: isBlastoise,
          isMegaBlastoiseMain: isMegaBlastoise && b === 1,
          isOverpressure,
          ox: startX,
          oy: startY,
          x: startX,
          y: startY,
          angle: ang,
          baseLength: rawHydroLen,
          length: clippedHydro.length,
          width: Math.min(54, beamWidth * widthMult),
          dmg: rawDmg * dmgMult,
          type: "Water",
          kb: (meta.knockback !== undefined ? meta.knockback : 16) * traitKbMult * (isBlastoise ? 1.15 : 1.0),
          statusBonus: level >= 5 ? 0.30 : 0.12,
          hitSet: new Set(),
          secondTickDone: false,
          splashEmitTimer: 0.04,
          timer: 0.36,
          maxTime: 0.36,
          color: "#38BDF8"
        });

        for (let ms = 0; ms < 4; ms++) {
          const mAng = ang + (ms % 2 === 0 ? 1 : -1) * (0.45 + Math.random() * 0.45);
          const mSpd = 60 + Math.random() * 50;
          this.spawnSubParticle(startX, startY, Math.cos(mAng) * mSpd, Math.sin(mAng) * mSpd, (isBlastoise && ms === 0) ? "#FEF08A" : (ms % 2 === 0 ? "#E0FFFF" : "#38BDF8"), 2.8, 0.24, "circle");
        }
      }

      if (caster === GameApp.player) {
        const rec = isBlastoise ? 6.2 : 5.5;
        caster.recoilX = -Math.cos(baseAngle) * rec;
        caster.recoilY = -Math.sin(baseAngle) * rec;
        caster.recoilTimer = 0.13;
        GameApp.camera.shakeTime = Math.max(GameApp.camera.shakeTime || 0, 0.06);
        GameApp.camera.shakeMagnitude = Math.max(GameApp.camera.shakeMagnitude || 0, isBlastoise ? 1.8 : 1.5);
      }
      SoundFX.play("hit", "Water");
      return;
    }

    // 2G. 冷凍光線 (Ice Beam) — 經典 GBA 折線極寒雷射：瞬發貫穿冰藍折線結晶鞘 ＋ 純白雷射軸 ＋ 末端六角冰霜爆破（急凍鳥 #144 三向冰光）
    if (cleanSkillId === "IceBeam") {
      const isArticuno = !!(caster && caster.id === 144);
      const isHighCryo = (level >= 8);
      const beamCount = isArticuno ? 3 : 1;
      const traitSizeMult = 1 + (trait.megaLauncherSizeBonus || 0) + (trait.legendaryAreaBonus || 0);
      const beamLength = Math.min(this.getBeamLengthCap("IceBeam"), (225 + level * 8) * Math.min(1.45, GameApp.player.areaMult * (isHighCryo ? 1.16 : 1.0) * (1 + (trait.megaLauncherSizeBonus || 0) * 0.45)));
      const beamWidth = Math.min(34, (14 + level * 0.72) * (isHighCryo ? 1.28 : (level >= 4 ? 1.14 : 1.0)) * Math.min(1.38, GameApp.player.areaMult * traitSizeMult));

      for (let b = 0; b < beamCount; b++) {
        const angOffset = beamCount === 3 ? (b - 1) * 0.22 : 0;
        const ang = baseAngle + angOffset;
        const startX = caster.x + Math.cos(ang) * 22;
        const startY = caster.y + Math.sin(ang) * 22;
        const zigSeed = Math.random() * 10;
        const clippedIce = (GameApp.isArenaMode && typeof MapEngine !== "undefined" && MapEngine.clipRayAgainstArenaPillars)
          ? MapEngine.clipRayAgainstArenaPillars(startX, startY, ang, beamLength, 4)
          : { length: beamLength, hit: false };

        this.meleeEffects.push({
          style: "ice_beam_laser",
          casterRef: caster,
          ox: startX,
          oy: startY,
          x: startX,
          y: startY,
          angle: ang,
          baseLength: beamLength,
          length: clippedIce.length,
          width: beamWidth,
          zigSeed,
          isHighCryo,
          isArticunoBeam: isArticuno,
          dmg: rawDmg * (isHighCryo ? 0.64 : 0.58),
          type: "Ice",
          kb: (meta.knockback !== undefined ? meta.knockback : 4) * (1 + (trait.megaLauncherKbBonus || 0)),
          statusBonus: level >= 5 ? 0.36 : 0.22,
          hitSet: new Set(),
          secondTickDone: false,
          shardEmitTimer: 0.04,
          timer: 0.32,
          maxTime: 0.32,
          color: "#67E8F9"
        });

        for (let ms = 0; ms < 4; ms++) {
          const mAng = ang + (ms % 2 === 0 ? 1 : -1) * (0.5 + Math.random() * 0.4);
          const mSpd = 65 + Math.random() * 45;
          this.spawnSubParticle(startX, startY, Math.cos(mAng) * mSpd, Math.sin(mAng) * mSpd, ms % 2 === 0 ? "#FFFFFF" : "#67E8F9", 3.0, 0.22, "diamond");
        }
      }

      if (caster === GameApp.player) {
        caster.recoilX = -Math.cos(baseAngle) * 4.5;
        caster.recoilY = -Math.sin(baseAngle) * 4.5;
        caster.recoilTimer = 0.11;
      }
      SoundFX.play("hit", "Ice");
      return;
    }

    // 3. 30px 主角淨空結界發射點 + 雙肩水炮/雙翼偏移
    const perpAng = baseAngle + Math.PI / 2;
    const slotLateralMap = [0, -18, 18, 0];
    const slotForwardMap = [30, 26, 26, 32];
    const slotBaseLat = slotLateralMap[slotIdx % 4] || 0;
    const slotBaseFwd = slotForwardMap[slotIdx % 4] || 30;
    const isWingSkill = ["AirSlash", "RazorLeaf", "IceBeam"].includes(cleanSkillId);
    const isTwinCannon = ["WaterGun", "HydroPump"].includes(cleanSkillId);

    const targetDist = target ? Math.hypot(target.x - caster.x, target.y - caster.y) : 999;
    const isCloseQuarters = targetDist < 75;

    const isMegaWaterGun = !!(cleanSkillId === "WaterGun" && caster && caster.id === 10036);
    const isMegaGengarShadow = !!(cleanSkillId === "ShadowBall" && caster && caster.id === 10038);
    const isMegaAeroBlade = !!(cleanSkillId === "AirSlash" && caster && caster.id === 10042);
    const loopCount = (isMegaWaterGun || isMegaGengarShadow || isMegaAeroBlade) ? Math.max(3, count + 1) : count;
    for (let i = 0; i < loopCount; i++) {
      const spread = loopCount > 1 ? (i - (loopCount - 1) / 2) * (isMegaWaterGun ? 0.14 : 0.16) : (cleanSkillId === "Ember" ? (Math.random() - 0.5) * 0.14 : 0);
      const ang = baseAngle + spread;
      const spd = cleanSkillId === "IceBeam" ? 385 : ((cleanSkillId === "WaterGun" || cleanSkillId === "Ember" || cleanSkillId === "RazorLeaf") ? 355 : (cleanSkillId === "HydroPump" ? 335 : (cleanSkillId === "AirSlash" ? 365 : 315)));
      // 冷凍光線 (IceBeam) 取消轉彎追蹤，改為 385 極速直線穿雲狙擊光束 (+1 穿透)！
      const isHoming = (cleanSkillId === "ShadowBall" || cleanSkillId === "Psystrike" || cleanSkillId === "Moonblast");

      // 當敵人貼近至 75px 內時，自動收攏側向與前推偏移，避免子彈跨過貼身怪背後
      const lateralScale = isCloseQuarters ? 0.25 : 1.0;
      const lateralOffset = (slotBaseLat + ((isWingSkill || isTwinCannon)
        ? ((i % 2 === 0 ? 1 : -1) * 13)
        : (count > 1 ? (i - (count - 1) / 2) * 10 : 0))) * lateralScale;
      const forwardStagger = (isCloseQuarters ? 8 : slotBaseFwd) + i * (isCloseQuarters ? 5 : 10);

      const spawnX = caster.x + Math.cos(perpAng) * lateralOffset + Math.cos(ang) * forwardStagger;
      const spawnY = caster.y + Math.sin(perpAng) * lateralOffset + Math.sin(ang) * forwardStagger;

      const isBoomerang = (cleanSkillId === "AirSlash");
      const traitSizeMult = 1
        + ((meta.type === "Water" || meta.type === "Ice") ? (trait.megaLauncherSizeBonus || 0) : 0)
        + (meta.type === "Grass" ? (trait.overgrowAreaBonus || 0) : 0)
        + (meta.type === "Fire" ? (trait.dragonMawAreaBonus || 0) : 0)
        + (trait.legendaryAreaBonus || 0);
      const traitKbMult = 1 + ((meta.type === "Water" || meta.type === "Ice") ? (trait.megaLauncherKbBonus || 0) : 0);
      const traitPierceBonus = (meta.type === "Psychic" || meta.type === "Ghost") ? (trait.psychicExtraPierce || 0) : 0;

      this.projectiles.push({
        x: spawnX,
        y: spawnY,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        initSpeed: spd,
        angle: ang,
        casterRef: caster,
        isBoomerang,
        returning: false,
        radius: Math.min(cleanSkillId === "HydroPump" ? 28 : (cleanSkillId === "WaterGun" ? 23 : 24), (cleanSkillId === "HydroPump" ? 22 : (isMegaWaterGun ? 18 : 16)) * GameApp.player.areaMult * (level >= 8 ? 1.20 : 1.0) * traitSizeMult),
        dmg: isBoomerang ? rawDmg * 0.80 : rawDmg,
        type: meta.type,
        skillId,
        vfx: meta.vfx || "star_shot",
        isMegaGengarShadow,
        isMegaAeroBlade,
        extraCritBonus: (isMegaGengarShadow || isMegaAeroBlade) ? 0.20 : 0,
        homing: isHoming,
        color: isMegaGengarShadow ? "#E11D48" : (isMegaAeroBlade ? "#F59E0B" : meta.color),
        pierce: (isBoomerang ? (level >= 6 ? 6 : 4) : ((level >= 6 ? 3 : 2) + (cleanSkillId === "IceBeam" ? 1 : 0))) + traitPierceBonus,
        knockback: (meta.knockback !== undefined ? meta.knockback : 0) * traitKbMult,
        life: isBoomerang ? 0.92 : 0.88,
        maxLife: isBoomerang ? 0.92 : 0.88,
        statusBonus: level >= 5 ? 0.30 : 0,
        hitSet: new Set(),
        trailTimer: 0
      });
    }
    // 遠程彈幕微幅視覺後座力 (Visual Recoil：僅偏移繪圖位置 3.5px，絕不干涉實際走位碰撞座標)
    if (caster === GameApp.player) {
      const recoilStrength = (cleanSkillId === "HydroPump" || cleanSkillId === "IceBeam") ? 5.0 : 3.2;
      caster.recoilX = -Math.cos(baseAngle) * recoilStrength;
      caster.recoilY = -Math.sin(baseAngle) * recoilStrength;
      caster.recoilTimer = 0.11;
    }


    SoundFX.play("hit", meta.type);
  },

  // 方案 C 純視覺撲擊控制 (100% 零物理座標位移)：完全不改變角色物理 Hitbox 座標，精準控距零失誤，同時保留精靈立繪「閃電前撲＋擠壓拉伸形變 (Squash & Stretch)」與金色殘影！
  triggerSmartMeleeLunge(caster, attackAngle, dashSpeed, dashDur, lungeVisualPx = 18, grantInvuln = 0) {
    if (!caster || caster !== GameApp.player) return;
    caster.dashTimer = 0;
    caster.dashVx = 0;
    caster.dashVy = 0;

    caster.lungeAngle = attackAngle;
    caster.lungeDist = lungeVisualPx;
    caster.lungeTimer = 0.17;
    caster.lungeMaxTime = 0.17;
  },

  executeMeleeSkill(caster, meta, level, count, baseAngle, rawDmg) {
    const trait = caster._activeTrait || ((caster === GameApp.player && GameApp.player.innateTrait) ? GameApp.player.innateTrait : {});
    if (caster === GameApp.player && trait.id === "quick_attack") {
      caster.quickStepTimer = 1.1; // 電光疾行：施展近戰後獲得 1.1 秒 +15% 輕巧步伐加速
    }
    const style = meta.meleeStyle || "claw_slash";
    const areaScale = GameApp.player.areaMult * (level >= 3 ? 1.15 : 1.0) * (level >= 8 ? 1.25 : 1.0) * (1 + (trait.legendaryAreaBonus || 0));
    const kb = meta.knockback !== undefined ? meta.knockback : 8;

    // 0. 奇異種子：兩側肩部外推 24px 伸出 ＋ 根粗尾尖錐形流線藤鞭 ＋ 末端半月形音爆斬痕
    if (style === "vine_whip") {
      const isMegaVenusaur = !!(caster && caster.id === 10033);
      const isVenusaur = !!(caster && (caster.id === 3 || caster.id === 10033));
      const whipCount = isMegaVenusaur ? 3 : (isVenusaur ? 2 : (1 + (level >= 5 ? 1 : 0)));
      const reach = this.getVineWhipReach(level, areaScale, trait.overgrowAreaBonus || 0);
      const perp = baseAngle + Math.PI / 2;
      for (let w = 0; w < whipCount; w++) {
        const spread = (w - (whipCount - 1) / 2) * 0.30;
        const ang = baseAngle + spread;
        const sideShift = whipCount === 3 ? ((w - 1) * 12) : (whipCount > 1 ? (w === 0 ? -10 : 10) : 0);
        const startX = caster.x + Math.cos(ang) * 14 + Math.cos(perp) * sideShift;
        const startY = caster.y + Math.sin(ang) * 14 + Math.sin(perp) * sideShift;
        this.meleeEffects.push({
          style: "vine_whip",
          casterRef: caster,
          isVenusaurWhip: isVenusaur,
          ox: startX,
          oy: startY,
          x: startX,
          y: startY,
          angle: ang,
          reach: reach,
          dmg: rawDmg * (isVenusaur ? 1.22 : 1.15),
          type: meta.type,
          kb: kb * 1.2,
          hitSet: new Set(),
          timer: 0.36,
          maxTime: 0.36,
          color: "#15803D"
        });

        const tipX = startX + Math.cos(ang) * reach;
        const tipY = startY + Math.sin(ang) * reach;
        for (let lf = -1; lf <= 1; lf++) {
          const leafAng = ang + lf * 0.28;
          this.spawnSubParticle(
            tipX, tipY,
            Math.cos(leafAng) * (60 + Math.random() * 35),
            Math.sin(leafAng) * (60 + Math.random() * 35),
            lf === 0 ? "#15803D" : "#4ADE80",
            3.0, 0.32, "leaf"
          );
        }
      }
      SoundFX.play("hit", "Grass");
      return;
    }

    if (style === "martial_fist") {
      // 【空手劈・商業級單點突破連環拳】：收斂肉搏射程軟上限 (最高 138px)，避免滿級重坦隔空揮拳
      const karateScale = Math.min(1.42, areaScale * (1 + (trait.ironFistAreaBonus || 0) * 0.75));
      const reach = Math.min(138, (64 + level * 3.5) * karateScale);
      const baseHits = level >= 8 ? 4 : (level >= 4 ? 3 : 2);
      const totalHits = Math.min(5, baseHits + (trait.ironFistExtraStrike || 0));
      const dmgTable = {
        2: [0.55, 1.05],
        3: [0.45, 0.50, 1.00],
        4: [0.42, 0.42, 0.48, 0.95],
        5: [0.38, 0.38, 0.42, 0.46, 0.95]
      };
      const dmgMults = dmgTable[totalHits] || dmgTable[4];
      const useManual = (caster === GameApp.player && GameApp.manualAimMode);
      let curAng = baseAngle;

      const firePunch = (hitIdx) => {
        if (!caster || (caster === GameApp.player && GameApp.state !== "PLAYING")) return;
        const isFinisher = (hitIdx === totalHits - 1);

        // 自動瞄準模式下若原目標已陣亡，後續拳微調角度自動轉火鎖定射程內下一隻怪
        if (!useManual && hitIdx > 0) {
          const nextT = GameApp.findNearestEnemyInViewport(caster.x, caster.y, reach * 1.15);
          if (nextT) {
            curAng = Math.atan2(nextT.y - caster.y, nextT.x - caster.x);
          }
        }

        // 沿同一進攻軸線由近到遠梯次推進（前段快拳貼身 42~68px ➔ 終結重拳 85~95px），左右僅 ±6px 交替直拳
        const stepFrac = totalHits > 1 ? (hitIdx / (totalHits - 1)) : 1;
        const distReach = 16 + reach * (0.30 + stepFrac * 0.52);
        const perpAng = curAng + Math.PI / 2;
        const sideOffset = isFinisher ? 0 : ((hitIdx % 2 === 0 ? -1 : 1) * 6);

        const ox = caster.x + Math.cos(curAng) * 14 + Math.cos(perpAng) * (sideOffset * 0.5);
        const oy = caster.y + Math.sin(curAng) * 14 + Math.sin(perpAng) * (sideOffset * 0.5);
        const fx = caster.x + Math.cos(curAng) * distReach + Math.cos(perpAng) * sideOffset;
        const fy = caster.y + Math.sin(curAng) * distReach + Math.sin(perpAng) * sideOffset;
        const hitRad = Math.min(58, Math.max(34, reach * (isFinisher ? 0.44 : 0.34)));

        this.triggerSmartMeleeLunge(caster, curAng, 0, 0, isFinisher ? 15 : 8, 0);
        if (isFinisher && caster === GameApp.player) {
          GameApp.camera.shakeTime = Math.max(GameApp.camera.shakeTime || 0, 0.06);
          GameApp.camera.shakeMagnitude = Math.max(GameApp.camera.shakeMagnitude || 0, 1.4);
        }

        this.meleeEffects.push({
          style: "karate_cross",
          ox, oy,
          x: fx,
          y: fy,
          angle: curAng,
          radius: hitRad,
          isFinisher,
          timer: isFinisher ? 0.30 : 0.21,
          maxTime: isFinisher ? 0.30 : 0.21,
          color: isFinisher ? "#FACC15" : "#EF4444"
        });

        const sparkNum = isFinisher ? 8 : 4;
        for (let sp = 0; sp < sparkNum; sp++) {
          const spAng = curAng + (Math.random() - 0.5) * (isFinisher ? 1.8 : 1.1);
          const spSpd = (isFinisher ? 95 : 65) + Math.random() * 65;
          this.spawnSubParticle(
            fx + Math.cos(spAng) * 6,
            fy + Math.sin(spAng) * 6,
            Math.cos(spAng) * spSpd,
            Math.sin(spAng) * spSpd,
            sp % 2 === 0 ? (isFinisher ? "#FEF08A" : "#F97316") : "#FFFFFF",
            (isFinisher ? 3.4 : 2.6) + Math.random() * 1.2,
            isFinisher ? 0.30 : 0.22,
            sp % 2 === 0 ? "star" : "diamond"
          );
        }

        // 前段快拳採極輕擊退把目標釘在拳程內吃滿連招，終結重拳才轟出強擊退＋額外 +20% 暴擊率
        // 微延遲 55ms 對齊拳頭伸直撞擊目標的衝擊幀 (Impact Frame)
        const punchKb = isFinisher ? (kb * 1.55) : Math.min(4, kb * 0.25);
        const punchDmg = rawDmg * (dmgMults[hitIdx] || 0.50);
        const extraCrit = isFinisher ? 0.20 : 0;
        this.scheduleEvent(0.055, () => {
          if (!caster || (caster === GameApp.player && GameApp.state !== "PLAYING")) return;
          const hitCandidates = this.getEnemiesInRadius(fx, fy, hitRad * 1.08);
          hitCandidates.forEach(e => {
            if (e && e.hp > 0 && Math.hypot(e.x - fx, e.y - fy) <= hitRad * 1.08 + e.radius) {
              GameApp.dealDamageToEnemy(e, punchDmg, meta.type, isFinisher ? 0.35 : 0.15, punchKb, extraCrit);
            }
          });
          if (isFinisher) {
            GameApp.spawnParticleCluster(fx, fy, "#FFFFFF", "#FACC15", 8, "star", 1.05);
          }
          SoundFX.play("hit", "Fighting");
        });
      };

      firePunch(0);
      let accDelay = 0;
      for (let h = 1; h < totalHits; h++) {
        const isLast = (h === totalHits - 1);
        accDelay += isLast ? 90 : 65;
        this.scheduleEvent(accDelay / 1000, () => firePunch(h));
      }
      return;
    }

    // 1. 撞擊專屬（A+C 方案）：第 1 段本體貼身撞擊 ➔ 第 2/3 段由第一擊落點展開「精靈殘影分身＋1:1 動能氣浪」接力前衝！
    if (style === "slam_wave") {
      const tackleAreaScale = Math.min(1.52, GameApp.player.areaMult * (level >= 3 ? 1.14 : 1.0) * (level >= 8 ? 1.15 : 1.0) * (1 + (trait.tackleQuakeAreaBonus || 0) * 0.65));
      const visualLungePx = Math.min(26, (16 + (level >= 3 ? 2 : 0) + (level >= 8 ? 3 : 0)) * (1 + (trait.quickAttackLungeBonus || 0)));
      this.triggerSmartMeleeLunge(caster, baseAngle, 0, 0, visualLungePx, 0);

      const totalWaves = 1 + (level >= 4 ? 1 : 0) + (level >= 8 ? 1 : 0);
      const effectiveKb = (kb || 20) * (level >= 6 ? 1.35 : 1.0) * (1 + (trait.tackleQuakeKbBonus || 0));
      const drainPct = level >= 6 ? 0.010 : 0.008;
      let healedThisCast = false;

      // 記錄第 1 段本體貼身撞擊基準落點（1:1 對齊風罩視覺半徑，杜絕隔山打牛），後續殘影接力前衝
      const stepDist = 34 * Math.min(1.25, tackleAreaScale);
      const firstDist = 22 * Math.min(1.15, tackleAreaScale);
      let chainX = caster.x + Math.cos(baseAngle) * firstDist;
      let chainY = caster.y + Math.sin(baseAngle) * firstDist;
      const lockedSprUrl = (caster.data && (caster.facingY < 0 ? caster.data.back_sprite : caster.data.forward_sprite)) || null;
      const lockedIsShiny = !!caster.isShiny;
      const lockedFacingX = Math.cos(baseAngle) >= 0 ? 1 : -1;

      const tackleDmgTable = {
        1: [1.00],
        2: [0.80, 0.98],
        3: [0.72, 0.78, 0.96]
      };
      const tackleDmgMults = tackleDmgTable[totalWaves] || tackleDmgTable[3];

      const fireTackleWave = (waveIdx) => {
        if (!caster || (caster === GameApp.player && GameApp.state !== "PLAYING")) return;
        const isFinisher = (totalWaves > 1 && waveIdx === totalWaves - 1);
        let startX, startY, hitX, hitY;
        if (waveIdx === 0) {
          startX = caster.x;
          startY = caster.y;
          hitX = chainX;
          hitY = chainY;
        } else {
          startX = chainX;
          startY = chainY;
          hitX = startX + Math.cos(baseAngle) * stepDist;
          hitY = startY + Math.sin(baseAngle) * stepDist;
          chainX = hitX;
          chainY = hitY;
        }

        const rad = waveIdx === 0
          ? Math.min(46, Math.round(36 * tackleAreaScale))
          : Math.min(isFinisher ? 74 : 64, Math.round((42 + waveIdx * 8) * tackleAreaScale));
        const waveDmg = rawDmg * (tackleDmgMults[waveIdx] || 0.80);
        const waveKb = isFinisher ? (effectiveKb * 1.25) : effectiveKb;

        if (waveIdx === 0) {
          this.meleeEffects.push({
            style: "sonic_cone",
            casterRef: caster,
            ox: startX,
            oy: startY,
            x: hitX,
            y: hitY,
            angle: baseAngle,
            radius: rad,
            waveIdx: 0,
            timer: 0.18,
            maxTime: 0.18,
            color: "#F8FAFC"
          });
        } else {
          this.meleeEffects.push({
            style: "phantom_tackle",
            ox: startX,
            oy: startY,
            x: hitX,
            y: hitY,
            angle: baseAngle,
            radius: rad,
            waveIdx: waveIdx,
            spriteUrl: lockedSprUrl,
            isShiny: lockedIsShiny,
            facingX: lockedFacingX,
            timer: isFinisher ? 0.24 : 0.20,
            maxTime: isFinisher ? 0.24 : 0.20,
            color: isFinisher ? "#FEF08A" : "#BAE6FD"
          });
        }

        const hitCandidates = this.getEnemiesInRadius(hitX, hitY, rad);
        hitCandidates.forEach(e => {
          if (Math.hypot(e.x - hitX, e.y - hitY) <= rad + e.radius) {
            GameApp.dealDamageToEnemy(e, waveDmg, meta.type, isFinisher ? 0.30 : 0.18, waveKb, isFinisher ? 0.15 : 0);
            const hitAng = Math.atan2(e.y - startY, e.x - startX);
            const impactX = e.x - Math.cos(hitAng) * (e.radius * 0.45);
            const impactY = e.y - Math.sin(hitAng) * (e.radius * 0.45);
            this.meleeEffects.push({
              style: "z_spark",
              x: impactX,
              y: impactY,
              radius: 16 + waveIdx * 3,
              timer: 0.16,
              maxTime: 0.16,
              color: isFinisher ? "#FEF08A" : "#FFFFFF"
            });
            if (!healedThisCast && caster === GameApp.player && GameApp.player.hp < GameApp.player.maxHp) {
              healedThisCast = true;
              const bossHealMod = (GameApp.activeBoss && GameApp.activeBoss.hp > 0) ? 0.5 : 1.0;
              const healVal = Math.max(1, Math.round(GameApp.player.maxHp * drainPct * bossHealMod));
              GameApp.player.hp = Math.min(GameApp.player.maxHp, GameApp.player.hp + healVal);
            }
          }
        });
        SoundFX.play("hit", "Normal");
      };

      // 分段收招 ＋ 蓄力停頓節奏：第1段(0ms/180ms) ➔ 停頓80ms ➔ 第2段(260ms/200ms) ➔ 蓄力停頓110ms ➔ 第3段(570ms/240ms)
      fireTackleWave(0);
      const waveDelays = [0, 260, 570];
      for (let w = 1; w < totalWaves; w++) {
        const triggerMs = waveDelays[w] || (w * 280);
        const pauseCueMs = Math.max(40, triggerMs - 85);
        this.scheduleEvent(pauseCueMs / 1000, () => {
          if (!caster || (caster === GameApp.player && GameApp.state !== "PLAYING")) return;
          this.meleeEffects.push({
            style: "slam_wave",
            x: chainX,
            y: chainY,
            radius: w === totalWaves - 1 ? 30 : 24,
            timer: 0.10,
            maxTime: 0.10,
            color: w === totalWaves - 1 ? "#FEF08A" : "#7DD3FC"
          });
        });
        this.scheduleEvent(triggerMs / 1000, () => fireTackleWave(w));
      }
      return;
    }

    // 2. 地震專屬：範圍軟上限（基礎 125px / 終結 150px）＋ 類空手劈「輕踏 ➔ 停頓高跳終結重踏」節奏
    if (style === "quake_wave") {
      const megaAeroQuakeMod = (caster && caster.id === 10042) ? 1.15 : 1.0;
      const quakeScale = Math.min(1.55, areaScale * megaAeroQuakeMod * (1 + (trait.tackleQuakeAreaBonus || 0) * 0.75));
      const baseRad = Math.min(125, (80 + level * 3.5) * quakeScale);
      const quakeKb = kb * (1 + (trait.tackleQuakeKbBonus || 0));
      const totalWaves = Math.min(3, Math.max(1, count));

      // 節奏表：{ hopStartMs, stompMs, hopDur, hopH, radMult, dmgMult, isFinisher }
      const cadenceMap = {
        1: [
          { hopStartMs: 0, stompMs: 110, hopDur: 0.22, hopH: 14, radMult: 1.00, dmgMult: 1.00, isFinisher: false }
        ],
        2: [
          { hopStartMs: 0,   stompMs: 95,  hopDur: 0.19, hopH: 11, radMult: 0.90, dmgMult: 0.65, isFinisher: false },
          { hopStartMs: 260, stompMs: 430, hopDur: 0.34, hopH: 22, radMult: 1.18, dmgMult: 1.05, isFinisher: true }
        ],
        3: [
          { hopStartMs: 0,   stompMs: 95,  hopDur: 0.19, hopH: 11, radMult: 0.85, dmgMult: 0.48, isFinisher: false },
          { hopStartMs: 210, stompMs: 305, hopDur: 0.20, hopH: 12, radMult: 0.95, dmgMult: 0.52, isFinisher: false },
          { hopStartMs: 480, stompMs: 655, hopDur: 0.35, hopH: 24, radMult: 1.18, dmgMult: 1.05, isFinisher: true }
        ]
      };
      const plan = cadenceMap[totalWaves] || cadenceMap[3];

      const triggerHop = (stepCfg) => {
        if (!caster || (caster === GameApp.player && GameApp.state !== "PLAYING")) return;
        if (caster === GameApp.player) {
          caster.slamHopMaxTime = stepCfg.hopDur;
          caster.slamHopHeight = stepCfg.hopH;
          caster.slamHopTimer = stepCfg.hopDur;
        }
      };

      const fireQuakeWave = (waveIdx, stepCfg) => {
        if (!caster || (caster === GameApp.player && GameApp.state !== "PLAYING")) return;
        const capR = stepCfg.isFinisher ? 150 : 125;
        const waveRad = Math.min(capR, Math.round(baseRad * stepCfg.radMult));
        const waveDmg = rawDmg * stepCfg.dmgMult;
        const branchNum = stepCfg.isFinisher ? 8 : 6;

        if (caster === GameApp.player) {
          if (stepCfg.isFinisher) {
            GameApp.camera.shakeTime = Math.max(GameApp.camera.shakeTime || 0, 0.10);
            GameApp.camera.shakeMagnitude = Math.max(GameApp.camera.shakeMagnitude || 0, 2.2);
          } else {
            GameApp.camera.shakeTime = Math.max(GameApp.camera.shakeTime || 0, 0.05);
            GameApp.camera.shakeMagnitude = Math.max(GameApp.camera.shakeMagnitude || 0, 0.9);
          }
        }

        this.meleeEffects.push({
          style,
          casterRef: caster,
          x: caster.x,
          y: caster.y,
          radius: waveRad,
          dmg: waveDmg,
          type: meta.type,
          kb: quakeKb * (stepCfg.isFinisher ? 1.25 : 0.72),
          extraCrit: stepCfg.isFinisher ? 0.18 : 0,
          waveIdx,
          cracks: this.buildQuakeCrackTree(branchNum, waveRad, false),
          hitSet: new Set(),
          timer: stepCfg.isFinisher ? 0.50 : 0.36,
          maxTime: stepCfg.isFinisher ? 0.50 : 0.36,
          color: stepCfg.isFinisher ? "#F59E0B" : meta.color
        });

        const dustCount = stepCfg.isFinisher ? 14 : 7;
        for (let d = 0; d < dustCount; d++) {
          const dAng = Math.random() * Math.PI * 2;
          const dSpd = (stepCfg.isFinisher ? 70 : 50) + Math.random() * 80;
          this.spawnSubParticle(
            caster.x + Math.cos(dAng) * 14,
            caster.y + Math.sin(dAng) * 14,
            Math.cos(dAng) * dSpd,
            Math.sin(dAng) * dSpd,
            d % 2 === 0 ? "#92400E" : "#FDE68A",
            stepCfg.isFinisher ? 3.4 : 2.6, 0.34, "circle"
          );
        }
        SoundFX.play("hit", "Ground");
      };

      plan.forEach((stepCfg, idx) => {
        if (stepCfg.hopStartMs === 0) triggerHop(stepCfg);
        else this.scheduleEvent(stepCfg.hopStartMs / 1000, () => triggerHop(stepCfg));

        const impactMs = (caster === GameApp.player) ? stepCfg.stompMs : stepCfg.hopStartMs;
        if (impactMs === 0) fireQuakeWave(idx, stepCfg);
        else this.scheduleEvent(impactMs / 1000, () => fireQuakeWave(idx, stepCfg));
      });
      return;
    }

    // 3. 龍之俯衝 (Dragon Rush)：單發巨龍破陣（尺寸與距離隨等級平滑成長，並設視覺上限避免遮屏，高爆發濃縮傷害）
    if (meta.type === "Dragon") {
      this.triggerSmartMeleeLunge(caster, baseAngle, 155, 0.12, 14, 0.18);
      if (caster === GameApp.player) {
        caster.slamHopTimer = 0.18;
      }
      const isDragonite = !!(caster && caster.id === 149);
      const isMegaX = !!(caster && caster.id === 10034);
      const isMegaGyara = !!(caster && caster.id === 10041);
      const isEliteDragon = isDragonite || isMegaX || isMegaGyara;
      const isMob = typeof GameApp !== "undefined" && GameApp.isMobileDevice && GameApp.isMobileDevice();
      const maxVisualR = isMob ? 56 : 64;
      const baseR = isEliteDragon ? 38 : 32;
      const lvGrow = 1 + (Math.max(1, level) - 1) * 0.042;
      const finalR = Math.min(maxVisualR, baseR * lvGrow * Math.min(1.28, GameApp.player.areaMult * (1 + (trait.dragonMawAreaBonus || 0) * 0.45)));
      const speedVal = 275 + Math.max(1, level) * 9 + (isEliteDragon ? 32 : 0);
      const durVal = 0.68 + Math.max(1, level) * 0.026 + (isEliteDragon ? 0.08 : 0);
      const singleDmgMult = 0.96 + (level >= 6 ? 0.28 : 0) + (isEliteDragon ? 0.30 : 0);

      this.groundHazards.push({
        kind: "dragon_wave",
        isDragoniteKing: isDragonite,
        isMegaCharizardX: isMegaX,
        isMegaGyarados: isMegaGyara,
        facingX: Math.cos(baseAngle) >= 0 ? 1 : -1,
        x: caster.x + Math.cos(baseAngle) * 18,
        y: caster.y + Math.sin(baseAngle) * 18,
        vx: Math.cos(baseAngle) * speedVal,
        vy: Math.sin(baseAngle) * speedVal,
        angle: baseAngle,
        radius: finalR,
        dmg: rawDmg * singleDmgMult,
        type: "Dragon",
        timer: durVal,
        maxTime: durVal,
        tickTimer: 0.01,
        tickInterval: 0.14,
        color: isMegaGyara ? "#F43F5E" : (isMegaX ? "#0EA5E9" : (isDragonite ? "#F59E0B" : "#4338CA"))
      });
      SoundFX.play("hit", "Dragon");
      return;
    }

    const maxReach = 105 * areaScale;
    const waves = Math.min(3, Math.ceil(count / 2));
    for (let w = 0; w < waves; w++) {
      const ang = baseAngle + (w - (waves - 1) / 2) * 0.48;
      this.meleeEffects.push({
        style,
        casterRef: caster,
        ox: caster.x,
        oy: caster.y,
        x: caster.x + Math.cos(ang) * (maxReach * 0.55),
        y: caster.y + Math.sin(ang) * (maxReach * 0.55),
        angle: ang,
        radius: maxReach,
        dmg: rawDmg,
        type: meta.type,
        kb: kb,
        hitSet: new Set(),
        timer: 0.34,
        maxTime: 0.34,
        color: meta.color
      });
    }
    SoundFX.play("hit", meta.type);
  },

  triggerUltimateSuperMove(meta, skSlot, ultDmgScale = 1.0) {
    const p = GameApp.player;
    if (meta.id === "Metronome") {
      // 【天命百寶袋（揮指功超武）】：隨機抽取 3 種不同屬性超武錯峰同時轟炸全場！
      const ultPool = ["Thunderbolt", "Flamethrower", "Hydro Pump", "Seed Bomb", "Ice Beam", "Dragon Rush", "Shadow Ball", "Moonblast"];
      const shuffled = [...ultPool].sort(() => Math.random() - 0.5).slice(0, 3);
      const rolledColors = shuffled.map(id => {
        const m = SKILLS_CATALOG[id];
        return (m && m.color) ? m.color : "#FACC15";
      });
      this.meleeEffects.push({
        style: "metronome_wheel",
        casterRef: p,
        x: p.x,
        y: p.y - 36,
        radius: 26,
        rolledColors,
        timer: 0.42,
        maxTime: 0.42,
        color: "#FACC15"
      });
      shuffled.forEach((pickId, idx) => {
        const pickMeta = SKILLS_CATALOG[pickId];
        if (pickMeta) {
          if (idx === 0) {
            this.triggerUltimateSuperMove(pickMeta, skSlot, ultDmgScale * 0.72);
          } else {
            this.scheduleEvent(idx * 0.18, () => {
              if (GameApp.state === "PLAYING" && GameApp.player) {
                this.triggerUltimateSuperMove(pickMeta, skSlot, ultDmgScale * 0.72);
              }
            });
          }
        }
      });
      return;
    }

    // 究極超武改為微弱柔和震動，絕不干擾走位與視覺
    GameApp.camera.shakeTime = 0.15;
    GameApp.camera.shakeMagnitude = 3.0;
    SoundFX.play("ultimate");

    const powerBonus = meta.ultPowerBonus || 1.0;
    const ultDmg = (meta.baseDmg * 2.8 + p.baseAtk * 1.3) * p.dmgMult * ultDmgScale * powerBonus;

    // 防領域重疊機制 (Anti-Overlap)：若場上已有同類型的持續領域超武，先清除舊領域再展開新領域，避免雙重疊加卡頓與倍率失控
    const domainMap = {
      Water: "blastoise_maelstrom",
      Grass: "frenzy_plant_roots",
      Flying: "tornado",
      Poison: "toxic_swamp",
      Ice: "ice_shatter_domain",
      Ground: "quake_fissure",
      Fighting: "martial_aura_domain",
      Ghost: "gengar_grin_domain",
      Psychic: meta.id === "Moonblast" ? "genesis_aurora" : "psychic_blackhole"
    };
    const domainKind = domainMap[meta.type];
    if (domainKind) {
      this.groundHazards = this.groundHazards.filter(h => h.kind !== domainKind);
    }

    this.ultimateVfxList.push({
      type: meta.type,
      skillId: meta.id,
      name: meta.evolvedName,
      x: p.x,
      y: p.y,
      timer: 1.15,
      maxTime: 1.15,
      color: meta.color,
      radius: 165
    });

    if (meta.type === "Electric") {
      // 【點狀／多發型・打雷暴風雨】：收斂至手機 2/3 範圍，6 道天罰雷柱錯落轟炸
      const ultR = this.getUltRadius(150, 155, 195);
      const strikePts = [];
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI * 2) / 6 + (i % 2 === 0 ? 0.14 : -0.14);
        const dist = ultR * (i % 2 === 0 ? 0.44 : 0.84);
        strikePts.push({
          x: p.x + Math.cos(a) * dist,
          y: p.y + Math.sin(a) * dist,
          delay: i * 0.07
        });
      }
      this.groundHazards.push({
        kind: "thunder_pillars_storm",
        x: p.x, y: p.y,
        strikePts,
        radius: ultR,
        dmg: ultDmg * 0.42,
        type: "Electric",
        timer: 1.40, maxTime: 1.40,
        tickTimer: 0.16, tickInterval: 0.32,
        color: "#FACC15"
      });
    } else if (meta.type === "Fire") {
      // 【點狀／多發型・立體大字爆炎】：縮減單字半徑與射程，保留八方推進灼燒
      const fireR = Math.round(this.getUltRadius(56, 62, 74));
      for (let d = 0; d < 4; d++) {
        const ang = (d * Math.PI) / 2 + (p.facingX >= 0 ? 0 : 0.4);
        const startX = p.x + Math.cos(ang) * 36;
        const startY = p.y + Math.sin(ang) * 36;
        this.groundHazards.push({
          kind: "drifting_daimonji",
          isMegaBlueFlame: !!(p && p.id === 10034),
          x: startX, y: startY,
          lastSpawnX: startX, lastSpawnY: startY,
          vx: Math.cos(ang) * 190, vy: Math.sin(ang) * 190,
          angle: ang,
          radius: fireR,
          dmg: ultDmg * 0.42,
          type: "Fire",
          timer: 0.95, maxTime: 0.95,
          tickTimer: 0.08, tickInterval: 0.25,
          color: "#EF4444"
        });
      }
    } else if (meta.type === "Water") {
      // 【持續領域型・潮旋激流】：約 2/3 手機畫面深海大漩渦，保留外圈閃彈視野
      const ultR = this.getUltRadius(158, 162, 205);
      this.groundHazards.push({
        kind: "blastoise_maelstrom",
        isMegaMaelstrom: !!(p && p.id === 10036),
        x: p.x, y: p.y,
        followPlayer: true,
        rotAngle: 0,
        radius: ultR,
        innerSafeRadius: 34,
        dmg: ultDmg * 0.35,
        type: "Water",
        timer: 1.65, maxTime: 1.65,
        tickTimer: 0.06, tickInterval: 0.24,
        color: "#38BDF8"
      });
    } else if (meta.type === "Grass") {
      // 【點狀／多發型・瘋狂植物】：8 株破土巨型荊棘藤木收斂於 2/3 圈內
      const ultR = this.getUltRadius(152, 158, 198);
      const rootNodes = [];
      for (let i = 0; i < 8; i++) {
        const ang = (i * Math.PI * 2) / 8 + (Math.random() - 0.5) * 0.18;
        const dist = ultR * (0.34 + (i % 3) * 0.24);
        rootNodes.push({
          x: p.x + Math.cos(ang) * dist,
          y: p.y + Math.sin(ang) * dist,
          leanDir: (i % 2 === 0 ? 1 : -1),
          heightScale: 0.78 + (i % 3) * 0.12,
          phaseOffset: i * 0.45
        });
      }
      this.groundHazards.push({
        kind: "frenzy_plant_roots",
        x: p.x, y: p.y,
        rootNodes,
        radius: ultR,
        dmg: ultDmg * 0.36,
        type: "Grass",
        timer: 1.55, maxTime: 1.55,
        tickTimer: 0.08, tickInterval: 0.28,
        color: "#15803D"
      });
      for (let g = 0; g < 18; g++) {
        const gAng = Math.random() * Math.PI * 2;
        const gSpd = 55 + Math.random() * 115;
        this.spawnSubParticle(
          p.x + Math.cos(gAng) * 38, p.y + Math.sin(gAng) * 38,
          Math.cos(gAng) * gSpd, Math.sin(gAng) * gSpd,
          g % 3 === 0 ? "#F472B6" : (g % 2 === 0 ? "#22C55E" : "#86EFAC"),
          3.6, 0.75, "leaf"
        );
      }
    } else if (meta.type === "Normal") {
      // 【近戰爆發型・終極衝擊 v7.2.7 八方雙層版】：4 支斜角高速旋轉黃金螺旋錐 ＋ 上下左右 4 向撞擊尾段動能月牙衝擊波
      const ultR = this.getUltRadius(148, 152, 192);
      for (let i = 0; i < 4; i++) {
        const ang = (i * Math.PI * 2) / 4 + Math.PI / 4;
        this.meleeEffects.push({
          style: "giga_impact_lance",
          casterRef: p,
          baseAngle: ang,
          spinSweep: 1.35,
          ox: p.x + Math.cos(ang) * 24,
          oy: p.y + Math.sin(ang) * 24,
          x: p.x + Math.cos(ang) * 24,
          y: p.y + Math.sin(ang) * 24,
          angle: ang,
          radius: ultR,
          dmg: ultDmg * 0.58,
          type: "Normal",
          kb: 22,
          hitSet: new Set(),
          timer: 0.52,
          maxTime: 0.52,
          color: "#FACC15"
        });

        const cardAng = (i * Math.PI) / 2;
        const waveStartR = 26;
        const waveEndR = ultR * 0.92;
        this.meleeEffects.push({
          style: "giga_cardinal_wave",
          casterRef: p,
          ox: p.x + Math.cos(cardAng) * waveStartR,
          oy: p.y + Math.sin(cardAng) * waveStartR,
          x: p.x + Math.cos(cardAng) * waveEndR,
          y: p.y + Math.sin(cardAng) * waveEndR,
          angle: cardAng,
          radius: Math.round(ultR * 0.48),
          dmg: ultDmg * 0.50,
          type: "Normal",
          kb: 28,
          hitSet: new Set(),
          timer: 0.42,
          maxTime: 0.42,
          color: "#FEF08A"
        });
      }
    } else if (meta.type === "Fighting") {
      // 【近戰爆發型・爆裂十字劈】：緊湊太極八卦陣 ＋ 8 拳護體 ＋ 收斂型 X 十字破甲斬
      const domainR = this.getUltRadius(140, 145, 180);
      p.martialGodTimer = 1.85;
      this.groundHazards.push({
        kind: "martial_aura_domain",
        x: p.x, y: p.y,
        followPlayer: true,
        radius: domainR,
        dmg: ultDmg * 0.34,
        type: "Fighting",
        timer: 1.85, maxTime: 1.85,
        tickTimer: 0.06, tickInterval: 0.28,
        color: "#DC2626"
      });

      for (let i = 0; i < 8; i++) {
        const ang = (i * Math.PI * 2) / 8;
        this.projectiles.push({
          x: p.x + Math.cos(ang) * 22, y: p.y + Math.sin(ang) * 22,
          vx: Math.cos(ang) * 285, vy: Math.sin(ang) * 285,
          angle: ang, spinSpeed: (i % 2 === 0 ? 1.05 : -1.05),
          radius: 21 * Math.min(1.25, p.areaMult), dmg: ultDmg * 0.66,
          type: "Fighting", skillId: "Karate Chop", vfx: "giant_fist",
          color: "#DC2626", pierce: 12, knockback: 22, life: 0.90, statusBonus: 0.45, hitSet: new Set(), trailTimer: 0
        });
      }

      this.scheduleEvent(0.26, () => {
        if (GameApp.state !== "PLAYING" || !GameApp.player) return;
        const pl = GameApp.player;
        const armLen = this.getUltRadius(148, 152, 188);
        this.groundHazards = this.groundHazards.filter(h => h.kind !== "cross_chop_cleave");
        this.groundHazards.push({
          kind: "cross_chop_cleave",
          x: pl.x, y: pl.y,
          followPlayer: true,
          radius: armLen,
          dmg: ultDmg * 0.58,
          type: "Fighting",
          timer: 0.95, maxTime: 0.95,
          tickTimer: 0.16, tickInterval: 0.30,
          color: "#FACC15"
        });
        SoundFX.play("ultimate");
        GameApp.camera.shakeTime = 0.18;
        GameApp.camera.shakeMagnitude = 4.5;

        const crossCandidates = [...this.getEnemiesInRadius(pl.x, pl.y, armLen)];
        crossCandidates.forEach(e => {
          if (!e || e.hp <= 0) return;
          const dx = e.x - pl.x, dy = e.y - pl.y;
          const d = Math.hypot(dx, dy);
          if (d <= armLen + e.radius) {
            const diag1 = Math.abs(dx - dy) * 0.707;
            const diag2 = Math.abs(dx + dy) * 0.707;
            const inCore = d <= 62 * Math.min(1.25, pl.areaMult) + e.radius;
            if (inCore || diag1 <= 36 * Math.min(1.25, pl.areaMult) + e.radius || diag2 <= 36 * Math.min(1.25, pl.areaMult) + e.radius) {
              const armorBreakMult = inCore ? 1.42 : 1.15;
              GameApp.dealDamageToEnemy(e, ultDmg * armorBreakMult, "Fighting", 0.65, 24);
              if (!e.status && !(e.ccImmunityTimer > 0)) {
                e.status = "Paralysis";
                e.statusTimer = e.isBoss ? 1.2 : 2.0;
                e.ccImmunityTimer = e.isBoss ? 3.5 : 2.2;
              }
            }
          }
        });
      });
    } else if (meta.type === "Flying") {
      // 【全場控場型・暴風驟雨】：3 道緊湊聚怪龍捲風
      const torR = Math.round(this.getUltRadius(68, 72, 86));
      for (let i = 0; i < 3; i++) {
        const ang = (i * Math.PI * 2) / 3;
        this.groundHazards.push({
          kind: "tornado",
          x: p.x + Math.cos(ang) * 68,
          y: p.y + Math.sin(ang) * 68,
          vx: Math.cos(ang) * 58,
          vy: Math.sin(ang) * 58,
          radius: torR,
          dmg: ultDmg * 0.26,
          type: "Flying",
          timer: 2.6, maxTime: 2.6,
          tickTimer: 0.1, tickInterval: 0.25,
          color: "#818CF8"
        });
      }
    } else if (meta.type === "Poison") {
      // 【持續領域型・劇毒沼澤】：收斂至約 2/3 畫面的護身毒沼
      const ultR = this.getUltRadius(150, 155, 195);
      this.groundHazards.push({
        kind: "toxic_swamp",
        x: p.x, y: p.y,
        followPlayer: true,
        radius: ultR,
        dmg: ultDmg * 0.25,
        type: "Poison",
        timer: 3.2, maxTime: 3.2,
        tickTimer: 0.1, tickInterval: 0.35,
        color: "#9333EA"
      });
    } else if (meta.type === "Ice") {
      // 【全場控場型・絕對零度】：收斂至 168px 極光冰圈，保留螢幕外緣預警視野
      const freezeRange = this.getUltRadius(168, 172, 215);
      this.getEnemiesInRadius(p.x, p.y, freezeRange).forEach(e => {
        if (Math.hypot(e.x - p.x, e.y - p.y) <= freezeRange + e.radius) {
          if (e.ccImmunityTimer > 0) {
            e.inFrostAura = true;
            e.weakenTimer = Math.max(e.weakenTimer || 0, 2.5);
          } else {
            e.status = "Freeze";
            e.statusTimer = e.isBoss ? 1.0 : (e.isElite ? 1.6 : 2.0);
            e.ccImmunityTimer = e.isBoss ? 4.5 : (e.isElite ? 3.2 : 2.5);
          }
        }
      });
      this.groundHazards.push({
        kind: "ice_shatter_domain",
        x: p.x, y: p.y,
        radius: freezeRange,
        dmg: ultDmg * 0.92,
        type: "Ice",
        timer: 0.95, maxTime: 0.95,
        tickTimer: 0.90, tickInterval: 99,
        color: "#38BDF8"
      });
    } else if (meta.type === "Dragon") {
      // 【點狀／多發型・天龍流星雨】：6 顆緊湊雙環龍星陣
      const outerR = this.getUltRadius(115, 120, 148);
      const innerR = Math.round(outerR * 0.54);
      const meteorR = Math.round(this.getUltRadius(62, 66, 78));
      for (let m = 0; m < 6; m++) {
        const isOuter = m >= 3;
        const ringIdx = m % 3;
        const ang = (ringIdx * Math.PI * 2) / 3 + (isOuter ? Math.PI / 3 : 0) + (p.facingX >= 0 ? 0.15 : -0.15);
        const dist = isOuter ? outerR : innerR;
        const tx = p.x + Math.cos(ang) * dist;
        const ty = p.y + Math.sin(ang) * dist;
        this.groundHazards.push({
          kind: "meteor_strike",
          isMegaBlueFlame: !!(p && p.id === 10034),
          x: tx, y: ty,
          startX: tx + 145, startY: ty - 210,
          radius: meteorR,
          dmg: ultDmg * 0.62,
          type: "Dragon",
          delay: m * 0.12,
          timer: 0.42 + m * 0.12,
          maxTime: 0.42,
          seed: m * 1.73 + Math.random(),
          color: "#7C3AED"
        });
      }
    } else if (meta.type === "Ground") {
      // 【近戰爆發型・地裂斷層破】：145px 緊湊深淵網狀裂谷
      GameApp.camera.shakeTime = 0.12;
      GameApp.camera.shakeMagnitude = 2.0;
      const ultRad = this.getUltRadius(145, 150, 188);
      this.groundHazards.push({
        kind: "quake_fissure",
        x: p.x, y: p.y,
        radius: ultRad,
        dmg: ultDmg * 0.36,
        type: "Ground",
        cracks: this.buildQuakeCrackTree(9, ultRad, true),
        timer: 1.9, maxTime: 1.9,
        tickTimer: 0.1, tickInterval: 0.45,
        color: "#D97706"
      });
    } else if (meta.type === "Ghost") {
      // 【持續領域型・暗影死滅波】：150px 冥界壞笑陣 ＋ 6 隻惡靈鬼影
      const ultR = this.getUltRadius(150, 156, 195);
      this.groundHazards.push({
        kind: "gengar_grin_domain",
        x: p.x, y: p.y,
        radius: ultR,
        dmg: ultDmg * 0.34,
        type: "Ghost",
        timer: 2.0, maxTime: 2.0,
        tickTimer: 0.15, tickInterval: 0.42,
        color: "#A855F7"
      });
      for (let k = 0; k < 6; k++) {
        const ang = (k * Math.PI * 2) / 6;
        this.projectiles.push({
          x: p.x + Math.cos(ang) * 28,
          y: p.y + Math.sin(ang) * 28,
          vx: Math.cos(ang) * 290, vy: Math.sin(ang) * 290,
          initSpeed: 290,
          angle: ang, radius: 17, dmg: ultDmg * 0.52,
          type: "Ghost", skillId: meta.id, vfx: "gengar_phantom",
          homing: true, color: "#A855F7",
          pierce: 7, knockback: 8, life: 1.35, statusBonus: 0.65, hitSet: new Set(), trailTimer: 0
        });
      }
    } else if (meta.id === "Moonblast") {
      // 【全場控場型・創世極光】：164px 月華極光天幕
      const ultR = this.getUltRadius(164, 168, 210);
      this.groundHazards.push({
        kind: "genesis_aurora",
        x: p.x, y: p.y,
        radius: ultR,
        dmg: ultDmg * 0.36,
        type: "Psychic",
        timer: 1.95, maxTime: 1.95,
        tickTimer: 0.14, tickInterval: 0.36,
        color: "#F472B6"
      });
    } else if (meta.type === "Psychic") {
      // 【持續領域型・精神強念領域】：150px 引力黑洞 ＋ 6 道念力梭
      const ultR = this.getUltRadius(150, 156, 195);
      this.groundHazards.push({
        kind: "psychic_blackhole",
        x: p.x, y: p.y,
        radius: ultR,
        dmg: ultDmg * 0.34,
        type: "Psychic",
        timer: 2.0, maxTime: 2.0,
        tickTimer: 0.15, tickInterval: 0.45,
        color: "#EC4899"
      });
      for (let k = 0; k < 6; k++) {
        const ang = (k * Math.PI * 2) / 6;
        this.projectiles.push({
          x: p.x + Math.cos(ang) * 28,
          y: p.y + Math.sin(ang) * 28,
          vx: Math.cos(ang) * 300, vy: Math.sin(ang) * 300,
          angle: ang, radius: 16, dmg: ultDmg * 0.50,
          type: "Psychic", skillId: meta.id, vfx: "psychic_lance",
          homing: true, color: "#EC4899",
          pierce: 7, knockback: 6, life: 1.35, statusBonus: 0.5, hitSet: new Set(), trailTimer: 0
        });
      }
    }

    // 釋放瞬間對貼身 95px 內敵人產生起手震退氣浪
    [...this.getEnemiesInRadius(p.x, p.y, 95)].forEach(e => {
      if (!e || e.hp <= 0) return;
      if (Math.hypot(e.x - p.x, e.y - p.y) <= 95 + e.radius) {
        let adjustedDmg = ultDmg * 0.52;
        if (meta.type === "Ground" && (e.data.type1 === "Flying" || e.data.type2 === "Flying")) {
          adjustedDmg *= 3.0;
        }
        GameApp.dealDamageToEnemy(e, adjustedDmg, meta.type, 0.70, e.isBoss ? 0 : 24);
      }
    });

    if (meta.type === "Grass") {
      const healMult = (p.innateTrait && p.innateTrait.overgrowHealMult) ? p.innateTrait.overgrowHealMult : 1.0;
      const bossHealMod = (GameApp.activeBoss && GameApp.activeBoss.hp > 0) ? 0.5 : 1.0;
      p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * 0.08 * healMult * bossHealMod));
    }
  },

  createLightningArc(x1, y1, x2, y2, color, withForks = false) {
    const pts = [{ x: x1, y: y1 }];
    const steps = 7;
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      pts.push({
        x: x1 + (x2 - x1) * t + (Math.random() - 0.5) * 32,
        y: y1 + (y2 - y1) * t + (Math.random() - 0.5) * 32
      });
    }
    pts.push({ x: x2, y: y2 });

    const branches = [];
    if (withForks) {
      for (let b = 0; b < 2; b++) {
        const midIdx = 2 + b * 2;
        const origin = pts[midIdx] || pts[1];
        const mainAng = Math.atan2(y2 - y1, x2 - x1);
        const branchAng = mainAng + (b === 0 ? 0.55 : -0.55);
        const bLen = 36 + Math.random() * 24;
        const midBx = origin.x + Math.cos(branchAng + 0.2) * (bLen * 0.5);
        const midBy = origin.y + Math.sin(branchAng + 0.2) * (bLen * 0.5);
        const endBx = origin.x + Math.cos(branchAng) * bLen;
        const endBy = origin.y + Math.sin(branchAng) * bLen;
        branches.push([origin, { x: midBx, y: midBy }, { x: endBx, y: endBy }]);
      }
    }
    this.lightningArcs.push({ pts, branches, color, timer: 0.26 });
  },

  update(dt) {
    if (this.scheduledEvents && this.scheduledEvents.length > 0) {
      const due = [];
      for (let i = this.scheduledEvents.length - 1; i >= 0; i--) {
        const ev = this.scheduledEvents[i];
        ev.delay -= dt;
        if (ev.delay <= 0) {
          due.push(ev.fn);
          this.scheduledEvents.splice(i, 1);
        }
      }
      for (let i = due.length - 1; i >= 0; i--) {
        try { due[i](); } catch (e) {}
      }
    }

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];

      if (pr.vfx === "giant_fist" && pr.spinSpeed) {
        const curAng = Math.atan2(pr.vy, pr.vx) + pr.spinSpeed * dt;
        const spd = Math.hypot(pr.vx, pr.vy);
        pr.vx = Math.cos(curAng) * spd;
        pr.vy = Math.sin(curAng) * spd;
        pr.angle = curAng;
      } else if (pr.homing) {
        const baseSpd = pr.initSpeed || Math.max(260, Math.hypot(pr.vx, pr.vy));
        if (!pr.initSpeed) pr.initSpeed = baseSpd;
        const target = GameApp.findNearestEnemyInViewport(pr.x, pr.y, 440);
        if (target) {
          const curAng = pr.angle !== undefined ? pr.angle : Math.atan2(pr.vy, pr.vx);
          const desired = Math.atan2(target.y - pr.y, target.x - pr.x);
          const distToTarget = Math.hypot(target.x - pr.x, target.y - pr.y);
          const diff = Math.atan2(Math.sin(desired - curAng), Math.cos(desired - curAng));
          const turnRate = distToTarget < 95 ? 14.5 : 7.5;
          const maxTurn = turnRate * dt;
          const nextAng = curAng + Math.max(-maxTurn, Math.min(maxTurn, diff));
          pr.angle = nextAng;
          pr.vx = Math.cos(nextAng) * baseSpd;
          pr.vy = Math.sin(nextAng) * baseSpd;
        } else {
          // 目標死亡且周圍無新怪時，維持恆定全速沿當前角度貫穿飛出，絕不停滯在畫面中間
          const curAng = pr.angle !== undefined ? pr.angle : Math.atan2(pr.vy, pr.vx);
          pr.vx = Math.cos(curAng) * baseSpd;
          pr.vy = Math.sin(curAng) * baseSpd;
        }
      }

      // 空氣斬迴旋鏢物理：去程減速懸停 -> 折返加速飛回施法者並重置命中集合 (二段切割)
      if (pr.isBoomerang) {
        const elapsed = pr.maxLife - pr.life;
        if (!pr.returning && elapsed >= 0.38) {
          pr.returning = true;
          pr.hitSet.clear(); // 折返時允許再次切割同一批怪獸，達成雙段傷害！
        }
        if (pr.returning && pr.casterRef) {
          const backAng = Math.atan2(pr.casterRef.y - pr.y, pr.casterRef.x - pr.x);
          const backSpd = (pr.initSpeed || 360) * 1.20;
          pr.vx = pr.vx * 0.80 + Math.cos(backAng) * backSpd * 0.20;
          pr.vy = pr.vy * 0.80 + Math.sin(backAng) * backSpd * 0.20;
          if (Math.hypot(pr.casterRef.x - pr.x, pr.casterRef.y - pr.y) < 26 && elapsed > 0.56) {
            pr.life = 0;
          }
        }
        pr.angle = (pr.angle || 0) + dt * 9.5;
      }

      // 污泥炸彈拋物線：落地爆開並生成持續 3.2 秒的冒泡腐蝕毒沼
      if (pr.vfx === "sludge_lob") {
        pr.progress = (pr.progress || 0) + dt / pr.maxLife;
        const t = Math.min(1, pr.progress);
        pr.x = pr.startX + (pr.targetX - pr.startX) * t;
        pr.y = pr.startY + (pr.targetY - pr.startY) * t - Math.sin(t * Math.PI) * (pr.arcHeight || 58);
        pr.angle = (pr.angle || 0) + dt * 3.8;

        if (t >= 1) {
          const isCrimson = !!pr.isMegaGengarPuddle;
          const puddleR = 64 * GameApp.player.areaMult;
          const spCol1 = isCrimson ? "#E11D48" : "#9333EA";
          const spCol2 = isCrimson ? "#C084FC" : "#4ADE80";
          for (let s = 0; s < 10; s++) {
            const a = Math.random() * Math.PI * 2;
            const spd = 25 + Math.random() * 55;
            this.spawnSubParticle(pr.targetX, pr.targetY, Math.cos(a) * spd, Math.sin(a) * spd, s % 2 === 0 ? spCol1 : spCol2, 4.5, 0.42, "circle");
          }
          [...this.getEnemiesInRadius(pr.targetX, pr.targetY, puddleR)].forEach(e => {
            if (e && e.hp > 0 && Math.hypot(e.x - pr.targetX, e.y - pr.targetY) <= puddleR + e.radius) {
              GameApp.dealDamageToEnemy(e, pr.dmg, "Poison", pr.statusBonus, 6);
            }
          });
          const activePuddles = this.groundHazards.filter(h => h.kind === "poison_puddle");
          if (activePuddles.length >= 6) {
            const firstIdx = this.groundHazards.findIndex(h => h.kind === "poison_puddle");
            if (firstIdx !== -1) this.groundHazards.splice(firstIdx, 1);
          }
          const puddleDur = 2.2 * (pr.hazardDurMult || 1.0);
          this.groundHazards.push({
            kind: "poison_puddle",
            isMegaGengarPuddle: isCrimson,
            x: pr.targetX,
            y: pr.targetY,
            radius: Math.min(95, puddleR),
            dmg: pr.dmg * 0.42,
            type: "Poison",
            timer: puddleDur,
            maxTime: puddleDur,
            tickTimer: 0.32,
            tickInterval: 0.42,
            color: isCrimson ? "#E11D48" : "#9333EA"
          });
          SoundFX.play("hit", "Poison");
          this.projectiles[i] = this.projectiles[this.projectiles.length - 1];
          this.projectiles.pop();
        }
        continue;
      }

      // 種子炸彈正弦物理高拋拋物線 (飛越前排障礙並定點引爆)
      if (pr.vfx === "seed_nut") {
        pr.progress = (pr.progress || 0) + dt / pr.maxLife;
        const t = Math.min(1, pr.progress);
        pr.x = pr.startX + (pr.targetX - pr.startX) * t;
        pr.y = pr.startY + (pr.targetY - pr.startY) * t - Math.sin(t * Math.PI) * (pr.arcHeight || 68);
        pr.angle = (pr.angle || 0) + dt * 4.5;

        if (t >= 1) {
          // 落地第一層：6 枚深褐堅果碎殼向四周彈飛
          for (let k = 0; k < 6; k++) {
            const a = (k * Math.PI * 2) / 6 + Math.random() * 0.25;
            const spd = 65 + Math.random() * 45;
            this.spawnSubParticle(pr.targetX, pr.targetY, Math.cos(a) * spd, Math.sin(a) * spd, k % 2 === 0 ? "#78350F" : "#84CC16", 3.6, 0.36, "diamond");
          }
          // 落地第二層：翠綠與草綠色孢子擴散（妙蛙花 #003 專屬追加粉金霸王花瓣風暴）
          for (let s = 0; s < (pr.isVenusaurSeed ? 16 : 12); s++) {
            const a = Math.random() * Math.PI * 2;
            const spd = 25 + Math.random() * (pr.isVenusaurSeed ? 72 : 55);
            const col = pr.isVenusaurSeed
              ? (s % 3 === 0 ? "#F472B6" : (s % 3 === 1 ? "#FDE047" : "#4ADE80"))
              : (s % 2 === 0 ? "#4ADE80" : "#BEF264");
            this.spawnSubParticle(pr.targetX, pr.targetY, Math.cos(a) * spd, Math.sin(a) * spd, col, pr.isVenusaurSeed && s % 3 === 0 ? 4.4 : 5.2, 0.48, (pr.isVenusaurSeed && s % 3 === 0) ? "leaf" : "circle");
          }
          // 落地範圍轟炸傷害判定（接入茂盛荊棘範圍加成並設 105px 軟上限）
          const blastRadius = Math.min(105, 68 * GameApp.player.areaMult * (pr.blastAreaBonus || 1.0));
          this.meleeEffects.push({
            style: "slam_wave",
            x: pr.targetX,
            y: pr.targetY,
            radius: blastRadius,
            timer: 0.26,
            maxTime: 0.26,
            color: "#65A30D"
          });
          [...this.getEnemiesInRadius(pr.targetX, pr.targetY, blastRadius)].forEach(e => {
            if (e && e.hp > 0 && Math.hypot(e.x - pr.targetX, e.y - pr.targetY) <= blastRadius + e.radius) {
              GameApp.dealDamageToEnemy(e, pr.dmg, pr.type, pr.statusBonus, pr.knockback || 10);
            }
          });
          if (pr.isMegaVenusaurSeed) {
            const activePuddles = this.groundHazards.filter(h => h.kind === "poison_puddle");
            if (activePuddles.length < 6) {
              this.groundHazards.push({
                kind: "poison_puddle",
                x: pr.targetX,
                y: pr.targetY,
                radius: 52 * GameApp.player.areaMult,
                dmg: pr.dmg * 0.34,
                type: "Poison",
                timer: 1.8,
                maxTime: 1.8,
                tickTimer: 0.25,
                tickInterval: 0.42,
                color: "#EC4899"
              });
            }
          }
          SoundFX.play("hit", "Grass");
          this.projectiles[i] = this.projectiles[this.projectiles.length - 1];
          this.projectiles.pop();
        }
        continue;
      }

      if (pr.vfx === "ember_spark") {
        // 火花阻尼減速 ＋ 輕微熱氣流左右飄忽 (Drag + Thermal Flutter)
        const drag = Math.pow(0.24, dt);
        pr.vx *= drag;
        pr.vy *= drag;
        const elapsed = (pr.maxLife || 0.54) - pr.life;
        const perpAng = (pr.angle || 0) + Math.PI * 0.5;
        const flutter = Math.sin(elapsed * 22 + (pr.cinderSeed || 0)) * 58 * (pr.flutterSign || 1);
        pr.x += (pr.vx + Math.cos(perpAng) * flutter) * dt;
        pr.y += (pr.vy + Math.sin(perpAng) * flutter) * dt;
      } else {
        pr.x += pr.vx * dt;
        pr.y += pr.vy * dt;
      }
      if (GameApp.isArenaMode && typeof MapEngine !== "undefined" && MapEngine.hitArenaPillar) {
        const ignoresPillar = (
          pr.vfx === "shadow_orb" ||
          pr.vfx === "psychic_lance" ||
          pr.vfx === "seed_nut" ||
          pr.vfx === "moon_blast" ||
          pr.isArc ||
          pr.isSuper
        );
        if (!ignoresPillar && MapEngine.hitArenaPillar(pr.x, pr.y, Math.min(8, (pr.radius || 8) * 0.45))) {
          GameApp.spawnParticleCluster(pr.x, pr.y, "#94A3B8", "#E2E8F0", 5, "circle", 0.65);
          this.projectiles[i] = this.projectiles[this.projectiles.length - 1];
          this.projectiles.pop();
          continue;
        }
      }
      pr.life -= dt;
      if (pr.spawnGraceTimer > 0) pr.spawnGraceTimer -= dt;

      pr.trailTimer = (pr.trailTimer || 0) - dt;
      if (pr.trailTimer <= 0) {
        pr.trailTimer = 0.045;
        if (pr.vfx === "ember_spark") {
          const embTCol = pr.isMegaBlueFlame ? (Math.random() < 0.5 ? "#E0F2FE" : "#38BDF8") : (Math.random() < 0.5 ? "#FEF08A" : "#F97316");
          this.spawnSubParticle(pr.x + (Math.random() - 0.5) * 6, pr.y + (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 28, -22 - Math.random() * 24, embTCol, 2.2, 0.22, "diamond");
        } else if (pr.vfx === "water_gun") {
          this.spawnSubParticle(pr.x - pr.vx * 0.02, pr.y - pr.vy * 0.02, (Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16, "#BAE6FD", 2.0, 0.18, "circle");
        } else if (pr.vfx === "fire_stream") {
          this.spawnSubParticle(pr.x - pr.vx * 0.03, pr.y - pr.vy * 0.03, (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20, Math.random() < 0.6 ? "#EF4444" : "#FBBF24", 3.0, 0.25, "circle");
        } else if (pr.vfx === "water_beam") {
          this.spawnSubParticle(pr.x - pr.vx * 0.03, pr.y - pr.vy * 0.03, (Math.random() - 0.5) * 25, (Math.random() - 0.5) * 25, "#7DD3FC", 2.6, 0.22, "circle");
        } else if (pr.vfx === "seed_cluster" || pr.vfx === "leaf_blade") {
          this.spawnSubParticle(pr.x, pr.y, (Math.random() - 0.5) * 15, (Math.random() - 0.5) * 15, "#4ADE80", 2.8, 0.28, "leaf");
        } else if (pr.vfx === "frost_beam") {
          this.spawnSubParticle(pr.x, pr.y, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, "#E0F2FE", 2.5, 0.25, "diamond");
        } else if (pr.vfx === "shadow_orb" || pr.vfx === "sludge_ball" || pr.vfx === "gengar_phantom") {
          this.spawnSubParticle(pr.x, pr.y, (Math.random() - 0.5) * 18, (Math.random() - 0.5) * 18, pr.vfx === "gengar_phantom" ? "#A855F7" : (pr.color || "#C084FC"), 3.2, 0.32, "star");
        } else if (pr.vfx === "psychic_lance") {
          this.spawnSubParticle(pr.x, pr.y, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, "#F472B6", 2.6, 0.25, "diamond");
        }
      }

      if (pr.spawnGraceTimer && pr.spawnGraceTimer > 0) continue;
      const tightRadius = pr.radius * 0.82; // 緊縮判定框 0.82x，確保子彈視覺前端真正嵌入目標身體才觸發命中
      const prTeam = pr.team || this.getCasterTeam(pr.casterRef);
      const nearbyEnemies = this.getTargetsFor(prTeam, pr.x, pr.y, tightRadius);
      for (let j = nearbyEnemies.length - 1; j >= 0; j--) {
        const e = nearbyEnemies[j];
        if (!e || e.hp <= 0 || pr.hitSet.has(e)) continue;
        const dx = e.x - pr.x, dy = e.y - pr.y;
        const tRad = (e.radius !== undefined) ? e.radius : 16;
        const rSum = tightRadius + tRad * 0.9;
        if (dx * dx + dy * dy <= rSum * rSum) {
          pr.hitSet.add(e);
          this.applySkillHit(prTeam, e, pr.dmg, pr.type, pr.statusBonus, pr.knockback || 0, pr.extraCritBonus || 0);
          this.spawnElementalHitSpark(e.x, e.y, pr.type);
          if ((pr.vfx === "shadow_orb" || pr.skillId === "Shadow Ball") && !(GameApp.enemies && GameApp.enemies.length > 140 && Math.random() < 0.55)) {
            this.meleeEffects.push({
              style: "shadow_implosion",
              x: e.x,
              y: e.y,
              radius: 26,
              timer: 0.18,
              maxTime: 0.18,
              color: "#A855F7"
            });
          } else if (pr.vfx === "ember_spark") {
            // 火花接觸爆散 (Cinder Pop)：炸出 5 顆紅橘跳躍像素火星
            for (let cp = 0; cp < 5; cp++) {
              const ca = Math.random() * Math.PI * 2;
              const cs = 55 + Math.random() * 65;
              const popCol = pr.isMegaBlueFlame ? (cp % 2 === 0 ? "#E0F2FE" : "#0EA5E9") : (cp % 2 === 0 ? "#FEF08A" : "#EF4444");
              this.spawnSubParticle(e.x, e.y, Math.cos(ca) * cs, Math.sin(ca) * cs - 18, popCol, 2.6 + Math.random() * 1.1, 0.22, "diamond");
            }
          } else if (pr.vfx === "bullet_seed") {
            // 種子機關槍命中：補上細碎翠綠＋深褐爆殼微粒
            for (let bs = 0; bs < 4; bs++) {
              const ba = (pr.angle || 0) + Math.PI + (Math.random() - 0.5) * 1.6;
              const bspd = 52 + Math.random() * 48;
              this.spawnSubParticle(e.x, e.y, Math.cos(ba) * bspd, Math.sin(ba) * bspd, bs % 2 === 0 ? "#84CC16" : "#78350F", 2.5, 0.20, bs % 2 === 0 ? "leaf" : "diamond");
            }
          }

          const pColor = pr.color || "#FFFFFF";
          for (let k = 0; k < 5; k++) {
            const hAng = Math.random() * Math.PI * 2;
            const hSpd = 40 + Math.random() * 70;
            this.spawnSubParticle(pr.x, pr.y, Math.cos(hAng) * hSpd, Math.sin(hAng) * hSpd, k % 2 === 0 ? pColor : "#FFFFFF", 2.8, 0.3, "star");
          }

          pr.pierce -= 1;
          if (pr.pierce <= 0) break;
        }
      }

      if (pr.life <= 0 || pr.pierce <= 0) {
        this.projectiles[i] = this.projectiles[this.projectiles.length - 1];
        this.projectiles.pop();
      }
    }

    for (let i = this.meleeEffects.length - 1; i >= 0; i--) {
      const m = this.meleeEffects[i];
      m.timer -= dt;
      const prog = 1 - Math.max(0, m.timer / m.maxTime);

      // 所見即所得波前推進判定 (Wavefront Active Hitframes + Spatial Grid + 平方距離加速)
      if (m.hitSet && m.dmg) {
        if (m.style === "hydro_pump_beam") {
          // 動態錨定施法者位置，讓水柱在 0.36s 噴射期間跟隨角色微移
          if (m.casterRef) {
            m.ox = m.casterRef.x + Math.cos(m.perpAngle || 0) * (m.latOffset || 0) + Math.cos(m.angle) * 22;
            m.oy = m.casterRef.y + Math.sin(m.perpAngle || 0) * (m.latOffset || 0) + Math.sin(m.angle) * 22;
            m.x = m.ox;
            m.y = m.oy;
          }
          if (GameApp.isArenaMode && typeof MapEngine !== "undefined" && MapEngine.clipRayAgainstArenaPillars) {
            const clip = MapEngine.clipRayAgainstArenaPillars(m.ox, m.oy, m.angle, m.baseLength || m.length, 4);
            m.length = clip.length;
          }
          // 0.18s 時重置命中集，執行第 2 段高壓持續沖刷判定
          if (!m.secondTickDone && prog >= 0.50) {
            m.secondTickDone = true;
            m.hitSet.clear();
          }
          const extendFrac = Math.min(1, prog / 0.22);
          const curLen = m.length * extendFrac;
          const halfW = (m.width || 22) * 0.58;
          const cosA = Math.cos(m.angle), sinA = Math.sin(m.angle);
          const midX = m.ox + cosA * (curLen * 0.5);
          const midY = m.oy + sinA * (curLen * 0.5);

          // 末端持續噴湧扇形水花飛沫粒子
          m.splashEmitTimer = (m.splashEmitTimer || 0) - dt;
          if (m.splashEmitTimer <= 0 && prog < 0.82) {
            m.splashEmitTimer = 0.055;
            const tipX = m.ox + cosA * curLen;
            const tipY = m.oy + sinA * curLen;
            for (let sp = 0; sp < 2; sp++) {
              const spAng = m.angle + (Math.random() - 0.5) * 1.45;
              const spSpd = 65 + Math.random() * 75;
              this.spawnSubParticle(tipX, tipY, Math.cos(spAng) * spSpd, Math.sin(spAng) * spSpd, sp % 2 === 0 ? "#E0FFFF" : "#38BDF8", 2.8 + Math.random() * 1.2, 0.24, "circle");
            }
          }

          const mTeam = m.team || this.getCasterTeam(m.casterRef);
          const candidates = this.getTargetsFor(mTeam, midX, midY, curLen * 0.5 + halfW + 18);
          for (let j = 0; j < candidates.length; j++) {
            const e = candidates[j];
            if (!e || e.hp <= 0 || m.hitSet.has(e) || !this.isInsideViewport(e.x, e.y, 20)) continue;
            const tRad = (e.radius !== undefined) ? e.radius : 16;
            const rx = e.x - m.ox, ry = e.y - m.oy;
            const along = rx * cosA + ry * sinA;
            if (along < -tRad * 0.5 || along > curLen + tRad) continue;
            const perpDist = Math.abs(-rx * sinA + ry * cosA);
            if (perpDist <= halfW + tRad * 0.85) {
              m.hitSet.add(e);
              this.applySkillHit(mTeam, e, m.dmg, m.type, m.statusBonus || 0.15, (m.kb || 16) * (m.secondTickDone ? 0.65 : 1.0));
              if (!(GameApp.enemies && GameApp.enemies.length > 140 && Math.random() < 0.6)) {
                this.meleeEffects.push({
                  style: "water_splash_burst",
                  x: e.x,
                  y: e.y,
                  angle: m.angle,
                  radius: 26,
                  timer: 0.24,
                  maxTime: 0.24,
                  color: "#38BDF8"
                });
              }
            }
          }
        } else if (m.style === "flamethrower_beam") {
          if (m.casterRef) {
            m.ox = m.casterRef.x + Math.cos(m.angle) * 22;
            m.oy = m.casterRef.y + Math.sin(m.angle) * 22;
            m.x = m.ox;
            m.y = m.oy;
          }
          if (GameApp.isArenaMode && typeof MapEngine !== "undefined" && MapEngine.clipRayAgainstArenaPillars) {
            const clip = MapEngine.clipRayAgainstArenaPillars(m.ox, m.oy, m.angle, m.baseLength || m.length, 4);
            m.length = clip.length;
          }
          if (!m.secondTickDone && prog >= 0.48) {
            m.secondTickDone = true;
            m.hitSet.clear();
          }
          const extendFrac = Math.min(1, prog / 0.24);
          const curLen = m.length * extendFrac;
          const cosA = Math.cos(m.angle), sinA = Math.sin(m.angle);
          const midX = m.ox + cosA * (curLen * 0.5);
          const midY = m.oy + sinA * (curLen * 0.5);

          m.emberEmitTimer = (m.emberEmitTimer || 0) - dt;
          if (m.emberEmitTimer <= 0 && prog < 0.85) {
            m.emberEmitTimer = 0.05;
            const sampleT = 0.45 + Math.random() * 0.55;
            const px = m.ox + cosA * (curLen * sampleT);
            const py = m.oy + sinA * (curLen * sampleT);
            const spreadW = (m.startHalfW + (m.endHalfW - m.startHalfW) * sampleT) * (Math.random() - 0.5) * 1.4;
            const ex = px - sinA * spreadW;
            const ey = py + cosA * spreadW;
            const embCol = m.isMegaBlueFlame
              ? (Math.random() < 0.5 ? "#E0F2FE" : "#38BDF8")
              : (m.isCharizardFlame && Math.random() < 0.35 ? "#67E8F9" : (Math.random() < 0.5 ? "#FEF08A" : "#F97316"));
            this.spawnSubParticle(ex, ey, cosA * 55 + (Math.random() - 0.5) * 35, sinA * 55 - 35 - Math.random() * 30, embCol, 3.0 + Math.random() * 1.4, 0.28, "star");
          }

          const mTeam = m.team || this.getCasterTeam(m.casterRef);
          const candidates = this.getTargetsFor(mTeam, midX, midY, curLen * 0.5 + (m.endHalfW || 36) + 18);
          for (let j = 0; j < candidates.length; j++) {
            const e = candidates[j];
            if (!e || e.hp <= 0 || m.hitSet.has(e) || !this.isInsideViewport(e.x, e.y, 20)) continue;
            const tRad = (e.radius !== undefined) ? e.radius : 16;
            const rx = e.x - m.ox, ry = e.y - m.oy;
            const along = rx * cosA + ry * sinA;
            if (along < -tRad * 0.5 || along > curLen + tRad) continue;
            const tFrac = Math.max(0, Math.min(1, along / Math.max(1, m.length)));
            const coneHalfW = (m.startHalfW || 9) + ((m.endHalfW || 32) - (m.startHalfW || 9)) * tFrac;
            const perpDist = Math.abs(-rx * sinA + ry * cosA);
            if (perpDist <= coneHalfW + tRad * 0.85) {
              m.hitSet.add(e);
              this.applySkillHit(mTeam, e, m.dmg, "Fire", m.statusBonus || 0.22, 0);
              this.spawnElementalHitSpark(e.x, e.y, "Fire");
            }
          }
        } else if (m.style === "ice_beam_laser") {
          if (m.casterRef) {
            m.ox = m.casterRef.x + Math.cos(m.angle) * 22;
            m.oy = m.casterRef.y + Math.sin(m.angle) * 22;
            m.x = m.ox;
            m.y = m.oy;
          }
          if (GameApp.isArenaMode && typeof MapEngine !== "undefined" && MapEngine.clipRayAgainstArenaPillars) {
            const clip = MapEngine.clipRayAgainstArenaPillars(m.ox, m.oy, m.angle, m.baseLength || m.length, 4);
            m.length = clip.length;
          }
          if (!m.secondTickDone && prog >= 0.48) {
            m.secondTickDone = true;
            m.hitSet.clear();
          }
          const extendFrac = Math.min(1, prog / 0.16);
          const curLen = m.length * extendFrac;
          const halfW = (m.width || 16) * 0.62;
          const cosA = Math.cos(m.angle), sinA = Math.sin(m.angle);
          const midX = m.ox + cosA * (curLen * 0.5);
          const midY = m.oy + sinA * (curLen * 0.5);

          m.shardEmitTimer = (m.shardEmitTimer || 0) - dt;
          if (m.shardEmitTimer <= 0 && prog < 0.82) {
            m.shardEmitTimer = 0.05;
            const tipX = m.ox + cosA * curLen;
            const tipY = m.oy + sinA * curLen;
            for (let sp = 0; sp < 2; sp++) {
              const spAng = m.angle + (Math.random() - 0.5) * 1.8;
              const spSpd = 60 + Math.random() * 65;
              this.spawnSubParticle(tipX, tipY, Math.cos(spAng) * spSpd, Math.sin(spAng) * spSpd, sp % 2 === 0 ? "#FFFFFF" : "#67E8F9", 3.2, 0.24, "diamond");
            }
          }

          const mTeam = m.team || this.getCasterTeam(m.casterRef);
          const candidates = this.getTargetsFor(mTeam, midX, midY, curLen * 0.5 + halfW + 18);
          for (let j = 0; j < candidates.length; j++) {
            const e = candidates[j];
            if (!e || e.hp <= 0 || m.hitSet.has(e) || !this.isInsideViewport(e.x, e.y, 20)) continue;
            const tRad = (e.radius !== undefined) ? e.radius : 16;
            const rx = e.x - m.ox, ry = e.y - m.oy;
            const along = rx * cosA + ry * sinA;
            if (along < -tRad * 0.5 || along > curLen + tRad) continue;
            const perpDist = Math.abs(-rx * sinA + ry * cosA);
            if (perpDist <= halfW + tRad * 0.85) {
              m.hitSet.add(e);
              this.applySkillHit(mTeam, e, m.dmg, "Ice", m.statusBonus || 0.25, m.kb || 4);
              this.spawnElementalHitSpark(e.x, e.y, "Ice");
            }
          }
        } else if (m.style === "vine_whip") {
          const curReach = m.reach * Math.min(1, prog * 1.7);
          const ox = m.ox !== undefined ? m.ox : m.x;
          const oy = m.oy !== undefined ? m.oy : m.y;
          const candidates = this.getEnemiesInRadius(ox, oy, curReach);
          for (let j = 0; j < candidates.length; j++) {
            const e = candidates[j];
            if (!e || e.hp <= 0 || m.hitSet.has(e) || !this.isInsideViewport(e.x, e.y, 20)) continue;
            const dx = e.x - ox, dy = e.y - oy;
            const rSum = curReach + e.radius * 0.85;
            const dSq = dx * dx + dy * dy;
            if (dSq <= rSum * rSum) {
              const eAng = Math.atan2(dy, dx);
              const diff = Math.abs(Math.atan2(Math.sin(eAng - m.angle), Math.cos(eAng - m.angle)));
              if (diff <= 0.58 || dSq < 1024) {
                m.hitSet.add(e);
                GameApp.dealDamageToEnemy(e, m.dmg, m.type, 0.30, m.kb || 10);
              }
            }
          }
        } else if (m.style === "quake_wave") {
          const burstT = Math.min(1, prog / 0.30);
          const easeOut = 1 - Math.pow(1 - burstT, 3);
          const curR = m.radius * (0.22 + easeOut * 0.78);
          const candidates = this.getEnemiesInRadius(m.x, m.y, curR);
          for (let j = 0; j < candidates.length; j++) {
            const e = candidates[j];
            if (!e || e.hp <= 0 || m.hitSet.has(e)) continue;
            const dx = e.x - m.x, dy = e.y - m.y;
            const rSum = curR + e.radius * 0.85;
            if (dx * dx + dy * dy <= rSum * rSum) {
              m.hitSet.add(e);
              GameApp.dealDamageToEnemy(e, m.dmg, m.type, 0.25, m.kb || 20, m.extraCrit || 0);
            }
          }
        } else if (m.style === "giga_impact_lance") {
          if (m.spinSweep && m.baseAngle !== undefined) {
            m.angle = m.baseAngle + prog * m.spinSweep;
          }
          if (m.casterRef) {
            m.ox = m.casterRef.x + Math.cos(m.angle) * 24;
            m.oy = m.casterRef.y + Math.sin(m.angle) * 24;
            m.x = m.ox;
            m.y = m.oy;
          }
          const curR = m.radius * (0.32 + prog * 0.72);
          const candidates = this.getEnemiesInRadius(m.ox, m.oy, curR);
          for (let j = 0; j < candidates.length; j++) {
            const e = candidates[j];
            if (!e || e.hp <= 0 || m.hitSet.has(e)) continue;
            const dx = e.x - m.ox, dy = e.y - m.oy;
            const rSum = curR + e.radius * 0.85;
            const dSq = dx * dx + dy * dy;
            if (dSq <= rSum * rSum) {
              const eAng = Math.atan2(dy, dx);
              const diff = Math.abs(Math.atan2(Math.sin(eAng - m.angle), Math.cos(eAng - m.angle)));
              if (diff <= 0.42 || dSq < 1296) {
                m.hitSet.add(e);
                GameApp.dealDamageToEnemy(e, m.dmg, m.type, 0.28, m.kb || 22);
              }
            }
          }
        } else if (m.style === "giga_cardinal_wave") {
          const ease = 1 - Math.pow(1 - Math.min(1, prog * 1.45), 2.6);
          const curX = m.ox + (m.x - m.ox) * ease;
          const curY = m.oy + (m.y - m.oy) * ease;
          const curR = m.radius * (0.72 + ease * 0.36);
          const candidates = this.getEnemiesInRadius(curX, curY, curR);
          for (let j = 0; j < candidates.length; j++) {
            const e = candidates[j];
            if (!e || e.hp <= 0 || m.hitSet.has(e)) continue;
            const dx = e.x - curX, dy = e.y - curY;
            const rSum = curR + e.radius * 0.85;
            if (dx * dx + dy * dy <= rSum * rSum) {
              m.hitSet.add(e);
              GameApp.dealDamageToEnemy(e, m.dmg, m.type, 0.30, m.kb || 28);
            }
          }
        } else {
          const curR = m.radius * (0.28 + prog * 0.75);
          const ox = m.ox !== undefined ? m.ox : m.x;
          const oy = m.oy !== undefined ? m.oy : m.y;
          const candidates = this.getEnemiesInRadius(ox, oy, curR);
          for (let j = 0; j < candidates.length; j++) {
            const e = candidates[j];
            if (!e || e.hp <= 0 || m.hitSet.has(e)) continue;
            const dx = e.x - ox, dy = e.y - oy;
            const rSum = curR + e.radius * 0.85;
            const dSq = dx * dx + dy * dy;
            if (dSq <= rSum * rSum) {
              const eAng = Math.atan2(dy, dx);
              const diff = Math.abs(Math.atan2(Math.sin(eAng - m.angle), Math.cos(eAng - m.angle)));
              if (diff <= 0.90 || dSq < 1296) {
                m.hitSet.add(e);
                GameApp.dealDamageToEnemy(e, m.dmg, m.type, 0.28, m.kb || 12);
              }
            }
          }
        }
      }

      if (m.timer <= 0) {
        this.meleeEffects[i] = this.meleeEffects[this.meleeEffects.length - 1];
        this.meleeEffects.pop();
      }
    }

    for (let i = this.ultimateVfxList.length - 1; i >= 0; i--) {
      this.ultimateVfxList[i].timer -= dt;
      if (this.ultimateVfxList[i].timer <= 0) {
        this.ultimateVfxList[i] = this.ultimateVfxList[this.ultimateVfxList.length - 1];
        this.ultimateVfxList.pop();
      }
    }

    for (let i = this.lightningArcs.length - 1; i >= 0; i--) {
      this.lightningArcs[i].timer -= dt;
      if (this.lightningArcs[i].timer <= 0) {
        this.lightningArcs[i] = this.lightningArcs[this.lightningArcs.length - 1];
        this.lightningArcs.pop();
      }
    }

    for (let i = this.subParticles.length - 1; i >= 0; i--) {
      const sp = this.subParticles[i];
      sp.x += sp.vx * dt;
      sp.y += sp.vy * dt;
      sp.rot += sp.rotSpeed * dt;
      sp.life -= dt;
      if (sp.life <= 0) {
        this.subParticles[i] = this.subParticles[this.subParticles.length - 1];
        this.subParticles.pop();
      }
    }

    // 更新持續性領域、毒沼、月光柱、聚怪龍捲風、天降流星與二段震爆 (groundHazards)
    const p = GameApp.player;
    for (let i = this.groundHazards.length - 1; i >= 0; i--) {
      const hz = this.groundHazards[i];

      if (hz.kind === "meteor_strike") {
        if (hz.delay > 0) {
          hz.delay -= dt;
          continue;
        }
        hz.timer -= dt;
        if (hz.timer <= 0) {
          // 隕石落地引爆：深紫 ＋ 蒼藍雙層星爆衝擊波 ＋ 10 顆飛散龍晶星屑
          this.meleeEffects.push({
            style: "slam_wave",
            x: hz.x, y: hz.y,
            radius: hz.radius * 0.95,
            timer: 0.32, maxTime: 0.32,
            color: hz.isMegaBlueFlame ? "#00F0FF" : "#7C3AED"
          });
          this.meleeEffects.push({
            style: "slam_wave",
            x: hz.x, y: hz.y,
            radius: hz.radius * 0.62,
            timer: 0.24, maxTime: 0.24,
            color: "#38BDF8"
          });
          for (let k = 0; k < 10; k++) {
            const a = (k * Math.PI * 2) / 10 + Math.random() * 0.2;
            const spd = 62 + Math.random() * 58;
            const mc = hz.isMegaBlueFlame
              ? (k % 2 === 0 ? "#00F0FF" : "#E0F2FE")
              : (k % 3 === 0 ? "#A855F7" : (k % 3 === 1 ? "#38BDF8" : "#E0F2FE"));
            this.spawnSubParticle(hz.x, hz.y, Math.cos(a) * spd, Math.sin(a) * spd, mc, 3.6, 0.36, k % 2 === 0 ? "star" : "diamond");
          }
          [...this.getEnemiesInRadius(hz.x, hz.y, hz.radius)].forEach(e => {
            if (e && e.hp > 0 && Math.hypot(e.x - hz.x, e.y - hz.y) <= hz.radius + e.radius) {
              GameApp.dealDamageToEnemy(e, hz.dmg, "Dragon", 0.40, 18);
            }
          });
          SoundFX.play("hit", "Dragon");
          this.groundHazards[i] = this.groundHazards[this.groundHazards.length - 1];
          this.groundHazards.pop();
        }
        continue;
      }

      hz.timer -= dt;
      if (hz.followPlayer && p) {
        hz.x = p.x;
        hz.y = p.y;
      }
      if (hz.kind === "blastoise_maelstrom") {
        hz.rotAngle = (hz.rotAngle || 0) + dt * 1.85;
        // 潮旋激流：轉速沉穩化，且外推力透過空間網格查詢並納入怪獸體重抗性 (kbResist) 與精英減免
        this.getEnemiesInRadius(hz.x, hz.y, hz.radius).forEach(e => {
          if (e && !e.isBoss) {
            const d = Math.hypot(e.x - hz.x, e.y - hz.y);
            if (d < hz.radius && d > 10) {
              const resist = e.kbResist !== undefined ? e.kbResist : 0;
              const eliteMod = e.isElite ? 0.45 : 1.0;
              const pushSpeed = 62 * (1 - resist) * eliteMod;
              if (pushSpeed > 2) {
                const pushAng = Math.atan2(e.y - hz.y, e.x - hz.x);
                e.x += Math.cos(pushAng) * pushSpeed * dt;
                e.y += Math.sin(pushAng) * pushSpeed * dt;
              }
            }
          }
        });
      } else if (hz.kind === "drifting_daimonji") {
        hz.x += (hz.vx || 0) * dt;
        hz.y += (hz.vy || 0) * dt;
        if (GameApp.player && Math.hypot(hz.x - hz.lastSpawnX, hz.y - hz.lastSpawnY) >= 44) {
          hz.lastSpawnX = hz.x;
          hz.lastSpawnY = hz.y;
          GameApp.lavaFootprints.push({ x: hz.x, y: hz.y, radius: 36, life: 2.4, maxLife: 2.4, tickTimer: 0.1, isMegaBlue: !!hz.isMegaBlueFlame, seed: Math.random() * 100 });
        }
      } else if (hz.kind === "thunder_pillars_storm") {
        (hz.strikePts || []).forEach(pt => {
          if (!pt.struck && (hz.maxTime - hz.timer) >= pt.delay) {
            pt.struck = true;
            this.spawnSubParticle(pt.x, pt.y, (Math.random() - 0.5) * 90, -50 - Math.random() * 60, "#FEF08A", 3.8, 0.35, "star");
          }
        });
      } else if (hz.kind === "moon_pillar") {
        const target = GameApp.findNearestEnemyInViewport(hz.x, hz.y, 420);
        if (target) {
          const desired = Math.atan2(target.y - hz.y, target.x - hz.x);
          const distToT = Math.hypot(target.x - hz.x, target.y - hz.y);
          const trackSpd = distToT > 24 ? 70 : 28;
          hz.vx = (hz.vx || 0) * 0.75 + Math.cos(desired) * trackSpd * 0.25;
          hz.vy = (hz.vy || 0) * 0.75 + Math.sin(desired) * trackSpd * 0.25;
        }
        hz.x += (hz.vx || 0) * dt;
        hz.y += (hz.vy || 0) * dt;
        // 持續向上噴發月華十字星屑粒子，賦予聖柱生動立體感
        if (Math.random() < 0.55) {
          const rx = hz.x + (Math.random() - 0.5) * hz.radius * 1.1;
          const ry = hz.y + (Math.random() - 0.5) * hz.radius * 0.5;
          this.spawnSubParticle(
            rx, ry,
            (Math.random() - 0.5) * 22, -65 - Math.random() * 55,
            Math.random() < 0.55 ? "#FEF08A" : "#F472B6",
            3.2 + Math.random() * 1.5, 0.42,
            Math.random() < 0.65 ? "star" : "diamond"
          );
        }
      } else if (hz.kind === "tornado") {
        const target = GameApp.findNearestEnemyInViewport(hz.x, hz.y, 420);
        const curAng = Math.atan2(hz.vy || 0, hz.vx || 60);
        if (target) {
          const desired = Math.atan2(target.y - hz.y, target.x - hz.x);
          const diff = Math.atan2(Math.sin(desired - curAng), Math.cos(desired - curAng));
          const nextAng = curAng + Math.max(-3.2 * dt, Math.min(3.2 * dt, diff));
          hz.vx = Math.cos(nextAng) * 75;
          hz.vy = Math.sin(nextAng) * 75;
        } else {
          hz.vx = Math.cos(curAng) * 60;
          hz.vy = Math.sin(curAng) * 60;
        }
        hz.x += (hz.vx || 0) * dt;
        hz.y += (hz.vy || 0) * dt;
        // 龍捲風牽引吸力透過空間網格查詢並納入怪獸體重抗性 (kbResist) 與精英減免
        this.getEnemiesInRadius(hz.x, hz.y, hz.radius * 1.30).forEach(e => {
          if (e && !e.isBoss) {
            const d = Math.hypot(hz.x - e.x, hz.y - e.y);
            if (d < hz.radius * 1.30 && d > 14) {
              const resist = e.kbResist !== undefined ? e.kbResist : 0;
              const eliteMod = e.isElite ? 0.45 : 1.0;
              const pullSpeed = 68 * (1 - resist) * eliteMod;
              if (pullSpeed > 2) {
                const pullAng = Math.atan2(hz.y - e.y, hz.x - e.x);
                e.x += Math.cos(pullAng) * pullSpeed * dt;
                e.y += Math.sin(pullAng) * pullSpeed * dt;
              }
            }
          }
        });
      } else if (hz.kind === "psychic_blackhole") {
        this.getEnemiesInRadius(hz.x, hz.y, hz.radius).forEach(e => {
          if (e && !e.isBoss) {
            const d = Math.hypot(hz.x - e.x, hz.y - e.y);
            if (d < hz.radius && d > 16) {
              const resist = e.kbResist !== undefined ? e.kbResist : 0;
              const eliteMod = e.isElite ? 0.45 : 1.0;
              const pullSpeed = 65 * (1 - resist) * eliteMod;
              if (pullSpeed > 2) {
                const pullAng = Math.atan2(hz.y - e.y, hz.x - e.x);
                e.x += Math.cos(pullAng) * pullSpeed * dt;
                e.y += Math.sin(pullAng) * pullSpeed * dt;
              }
            }
          }
        });
      } else if (hz.kind === "genesis_aurora") {
        if (Math.random() < 0.35) {
          const rx = hz.x + (Math.random() - 0.5) * hz.radius * 1.4;
          const ry = hz.y + (Math.random() - 0.5) * hz.radius * 0.8;
          this.spawnSubParticle(rx, ry - 55, -18 + (Math.random() - 0.5) * 14, 42 + Math.random() * 24, Math.random() < 0.5 ? "#E0E7FF" : "#F9A8D4", 3.0, 0.55, "star");
        }
      } else if (hz.kind === "serena_stage") {
        if (Math.random() < 0.28) {
          const ang = Math.random() * Math.PI * 2;
          const rad = 20 + Math.random() * (hz.radius * 0.78);
          const rx = hz.x + Math.cos(ang) * rad;
          const ry = hz.y + Math.sin(ang) * rad - 48;
          const col = Math.random() < 0.55 ? "#F472B6" : "#FEF08A";
          this.spawnSubParticle(rx, ry, (Math.random() - 0.5) * 18, 28 + Math.random() * 22, col, 2.8, 0.62, Math.random() < 0.6 ? "star" : "diamond");
        }
      } else if (hz.kind === "misty_tsunami") {
        if (Math.random() < 0.42) {
          const tProg = Math.min(1, (hz.maxTime - hz.timer) / (hz.maxTime || 1.15));
          const curR = 36 + tProg * (hz.radius - 36);
          const a = Math.random() * Math.PI * 2;
          const rx = hz.x + Math.cos(a) * curR;
          const ry = hz.y + Math.sin(a) * curR;
          this.spawnSubParticle(rx, ry, Math.cos(a) * 55, Math.sin(a) * 55 - 18, Math.random() < 0.5 ? "#E0F2FE" : "#38BDF8", 2.8, 0.34, Math.random() < 0.55 ? "circle" : "diamond");
        }
      } else if (hz.kind === "dragon_wave") {
        hz.afterimageTimer = (hz.afterimageTimer || 0) - dt;
        if (hz.afterimageTimer <= 0) {
          hz.afterimageTimer = 0.04;
          if (!hz.afterimages) hz.afterimages = [];
          hz.afterimages.push({ x: hz.x, y: hz.y });
          if (hz.afterimages.length > 3) hz.afterimages.shift();
        }
        hz.x += (hz.vx || 0) * dt;
        hz.y += (hz.vy || 0) * dt;
        if (Math.random() < 0.55) {
          const backAng = (hz.angle || 0) + Math.PI + (Math.random() - 0.5) * 0.7;
          const spd = 45 + Math.random() * 45;
          const c1 = hz.isMegaCharizardX ? "#67E8F9" : (hz.isDragoniteKing ? "#FACC15" : "#38BDF8");
          const c2 = hz.isMegaCharizardX ? "#2563EB" : (hz.isDragoniteKing ? "#F97316" : "#818CF8");
          this.spawnSubParticle(
            hz.x + Math.cos(backAng) * 14,
            hz.y + Math.sin(backAng) * 14,
            Math.cos(backAng) * spd,
            Math.sin(backAng) * spd,
            Math.random() < 0.5 ? c1 : c2,
            3.0 + Math.random() * 1.2,
            0.28,
            "star"
          );
        }
      } else if (hz.vx || hz.vy) {
        hz.x += (hz.vx || 0) * dt;
        hz.y += (hz.vy || 0) * dt;
      }

      hz.tickTimer -= dt;
      if (hz.tickTimer <= 0) {
        hz.tickTimer = hz.tickInterval || 0.4;

        if (hz.kind === "ice_shatter_domain") {
          // 絕對零度二段破冰巨爆 ＋ 高空折射冰稜裂紋閃光
          this.meleeEffects.push({
            style: "ice_shatter_flash",
            x: hz.x,
            y: hz.y,
            radius: hz.radius * 0.92,
            timer: 0.38,
            maxTime: 0.38,
            color: "#67E8F9"
          });
          for (let k = 0; k < 24; k++) {
            const a = Math.random() * Math.PI * 2;
            const spd = 60 + Math.random() * 140;
            this.spawnSubParticle(hz.x, hz.y, Math.cos(a) * spd, Math.sin(a) * spd, k % 2 === 0 ? "#67E8F9" : "#FFFFFF", 4.2, 0.45, "diamond");
          }
          [...this.getEnemiesInRadius(hz.x, hz.y, hz.radius)].forEach(e => {
            if (e && e.hp > 0 && Math.hypot(e.x - hz.x, e.y - hz.y) <= hz.radius + e.radius) {
              const shatterMult = (e.status === "Freeze") ? 1.65 : 1.0;
              GameApp.dealDamageToEnemy(e, hz.dmg * shatterMult, "Ice", 0.5, 14);
            }
          });
          SoundFX.play("ultimate");
        } else {
          if (hz.kind === "psy_delayed_blast") {
            this.meleeEffects.push({
              style: "psy_collapse_star",
              x: hz.x,
              y: hz.y,
              radius: Math.min(34, hz.radius * 0.58),
              timer: 0.24,
              maxTime: 0.24,
              color: "#EC4899"
            });
          }
          const nowMs = performance.now();
          const hzTeam = hz.team || "player";
          const hzCandidates = [...this.getTargetsFor(hzTeam, hz.x, hz.y, hz.radius)];
          hzCandidates.forEach(e => {
            if (!e || e.hp <= 0) return;
            const tRad = (e.radius !== undefined) ? e.radius : 16;
            const dx = e.x - hz.x, dy = e.y - hz.y;
            const rSum = hz.radius + tRad;
            if (dx * dx + dy * dy <= rSum * rSum) {
              // 防多個普攻毒沼重疊秒殺：同一隻怪每 360ms 最多吃一次 poison_puddle 跳傷
              if (hz.kind === "poison_puddle") {
                if (e._lastPuddleHit && nowMs - e._lastPuddleHit < 360) return;
                e._lastPuddleHit = nowMs;
              }
              let dVal = hz.dmg;
              if (hz.kind === "quake_fissure" && (e.data.type1 === "Flying" || e.data.type2 === "Flying")) {
                dVal *= 3.0; // 飛石對空破局 (對齊 0.35x 屬性底線)
              }
              if (hz.kind === "genesis_aurora" || hz.kind === "moon_pillar" || hz.kind === "serena_stage") {
                const wasWeakened = (e.weakenTimer && e.weakenTimer > 0.5);
                e.weakenTimer = 3.0; // 創世極光、月光聖柱與莎莉娜華麗舞台：降低敵方 35% 攻擊力
                if (!wasWeakened) {
                  GameApp.spawnFloatingText(e.x, e.y - 24, hz.kind === "serena_stage" ? "✨ 魅惑降攻 -35%!" : "🌙 降攻 -35%!", "#F472B6", 11);
                }
              }
              const hzStatusMod = hz.kind === "dragon_wave" ? 0.25 : ((hz.kind === "moon_pillar" || hz.kind === "genesis_aurora" || hz.kind === "serena_stage") ? -0.28 : -0.08);
              const megaToughClawsCrit = (hz.kind === "dragon_wave" && hz.isMegaCharizardX) ? 0.25 : ((hz.kind === "dragon_wave" && hz.isMegaGyarados) ? 0.20 : 0);
              this.applySkillHit(hzTeam, e, dVal, hz.type, hzStatusMod, hz.kind === "dragon_wave" ? 14 : 2, megaToughClawsCrit);
              // 超級噴火龍X (#10034) 硬爪＋藍焰聯動：龍之俯衝命中必定掛上灼傷，完美觸發猛火龍威增傷
              if (hz.kind === "dragon_wave" && hz.isMegaCharizardX && e.hp > 0 && !checkStatusImmunity(e, "Burn")) {
                if (!["Freeze", "Paralysis", "Confusion"].includes(e.status)) {
                  e.status = "Burn";
                  e.statusTimer = e.isBoss ? 2.8 : 4.2;
                  if (!e.statusTick || e.statusTick <= 0) e.statusTick = 0.40;
                }
              }
            }
          });
        }
      }

      if (hz.timer <= 0) {
        this.groundHazards[i] = this.groundHazards[this.groundHazards.length - 1];
        this.groundHazards.pop();
      }
    }
  }
};
