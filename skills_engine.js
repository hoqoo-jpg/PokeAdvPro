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

  reset() {
    this.projectiles = [];
    this.meleeEffects = [];
    this.ultimateVfxList = [];
    this.lightningArcs = [];
    this.subParticles = [];
    this.groundHazards = [];
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

        // 在裂縫轉折交匯點佈置崩岩或巨岩尖柱
        if ((isUlt && (s === 1 || (s === 2 && b % 2 === 0))) || (!isUlt && s === 1)) {
          rocks.push({
            x: nx + (Math.random() - 0.5) * 6,
            y: ny + (Math.random() - 0.5) * 6,
            h: isUlt ? (22 + Math.random() * 14) : (9 + Math.random() * 5),
            w: isUlt ? (9 + Math.random() * 4) : (6 + Math.random() * 3),
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

  fireSkill(caster, skillId, level, isEvolved, dmgScale = 1.0, slotIdx = 0) {
    if (skillId === "Metronome") {
      const pool = ["Flamethrower", "Hydro Pump", "Razor Leaf", "Seed Bomb", "Thunderbolt", "Shadow Ball", "Psystrike", "Ice Beam", "Moonblast", "Dragon Rush"];
      const pick1 = pool[Math.floor(Math.random() * pool.length)];
      this.fireSkill(caster, pick1, level, isEvolved, dmgScale * 1.15, slotIdx);
      if (caster && caster.id === 151) {
        const rest = pool.filter(s => s !== pick1);
        const pick2 = rest[Math.floor(Math.random() * rest.length)];
        this.fireSkill(caster, pick2, level, isEvolved, dmgScale * 0.95, slotIdx + 1);
      }
      return;
    }

    const meta = SKILLS_CATALOG[skillId] || SKILLS_CATALOG["Tackle"];
    const cleanSkillId = skillId.replace(/\s+/g, '');

    // 1. 貼身自衛最高優先級 + 差異化智能索敵：
    // 若怪獸已逼近主角 105px 警戒圈內，強制最優先鎖定貼身最近目標，徹底消除鬼斯/拉普拉斯近身死區！
    let target = GameApp.findNearestEnemyInViewport(caster.x, caster.y, 105);
    if (!target) {
      if (["Thunderbolt", "Psystrike", "IceBeam", "ShadowBall"].includes(cleanSkillId)) {
        target = GameApp.findPriorityTargetInViewport ? GameApp.findPriorityTargetInViewport(caster.x, caster.y, 400, "highest_hp") : GameApp.findNearestEnemyInViewport(caster.x, caster.y, 400);
      } else if (["SeedBomb", "SludgeBomb"].includes(cleanSkillId)) {
        target = GameApp.findPriorityTargetInViewport ? GameApp.findPriorityTargetInViewport(caster.x, caster.y, 360, "cluster") : GameApp.findNearestEnemyInViewport(caster.x, caster.y, 360);
      } else {
        target = GameApp.findNearestEnemyInViewport(caster.x, caster.y, 380);
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
        setTimeout(() => {
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
          const mx = caster.x + Math.cos(shotAng) * 24;
          const my = caster.y + Math.sin(shotAng) * 24;
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
        }, b * 38);
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
          color: "#9333EA", pierce: 99, knockback: 4,
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

        this.meleeEffects.push({
          style: "flamethrower_beam",
          casterRef: caster,
          ox: startX,
          oy: startY,
          x: startX,
          y: startY,
          angle: ang,
          length: beamLength,
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
              x: startX + Math.cos(ang) * (beamLength * frac),
              y: startY + Math.sin(ang) * (beamLength * frac) + 6,
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
      const isBlastoise = !!(caster && (caster.id === 9 || caster.id === 10036));
      const isOverpressure = (level >= 8) || isMegaBlastoise;
      const beamCount = isMegaBlastoise ? 3 : (isBlastoise ? 2 : Math.min(2, count));
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
          length: beamLength * (isMegaBlastoise && b !== 1 ? 0.88 : 1.0),
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

        this.meleeEffects.push({
          style: "ice_beam_laser",
          casterRef: caster,
          ox: startX,
          oy: startY,
          x: startX,
          y: startY,
          angle: ang,
          length: beamLength,
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
    const loopCount = isMegaWaterGun ? Math.max(3, count + 1) : count;
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
        dmg: isBoomerang ? rawDmg * 0.72 : rawDmg,
        type: meta.type,
        skillId,
        vfx: meta.vfx || "star_shot",
        homing: isHoming,
        color: meta.color,
        pierce: (isBoomerang ? (level >= 6 ? 6 : 4) : ((level >= 6 ? 3 : 2) + (cleanSkillId === "IceBeam" ? 1 : 0))) + traitPierceBonus,
        knockback: (meta.knockback !== undefined ? meta.knockback : 0) * traitKbMult,
        life: isBoomerang ? 1.25 : 0.88,
        maxLife: isBoomerang ? 1.25 : 0.88,
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
        const sideShift = whipCount === 3 ? ((w - 1) * 14) : (whipCount > 1 ? (w === 0 ? -12 : 12) : 0);
        const startX = caster.x + Math.cos(ang) * 24 + Math.cos(perp) * sideShift;
        const startY = caster.y + Math.sin(ang) * 24 + Math.sin(perp) * sideShift;
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
        setTimeout(() => {
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
        }, 55);
      };

      firePunch(0);
      let accDelay = 0;
      for (let h = 1; h < totalHits; h++) {
        const isLast = (h === totalHits - 1);
        accDelay += isLast ? 90 : 65;
        setTimeout(() => firePunch(h), accDelay);
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
        setTimeout(() => {
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
        }, pauseCueMs);
        setTimeout(() => fireTackleWave(w), triggerMs);
      }
      return;
    }

    // 2. 地震專屬：範圍軟上限（基礎 125px / 終結 150px）＋ 類空手劈「輕踏 ➔ 停頓高跳終結重踏」節奏
    if (style === "quake_wave") {
      const quakeScale = Math.min(1.45, areaScale * (1 + (trait.tackleQuakeAreaBonus || 0) * 0.75));
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
        else setTimeout(() => triggerHop(stepCfg), stepCfg.hopStartMs);

        const impactMs = (caster === GameApp.player) ? stepCfg.stompMs : stepCfg.hopStartMs;
        if (impactMs === 0) fireQuakeWave(idx, stepCfg);
        else setTimeout(() => fireQuakeWave(idx, stepCfg), impactMs);
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
      const dSprUrl = (caster.data && (caster.facingY < 0 ? caster.data.back_sprite : caster.data.forward_sprite)) || null;
      const isMob = typeof GameApp !== "undefined" && GameApp.isMobileDevice && GameApp.isMobileDevice();
      const maxVisualR = isMob ? 56 : 64;
      const baseR = (isDragonite || isMegaX) ? 38 : 32;
      const lvGrow = 1 + (Math.max(1, level) - 1) * 0.042;
      const finalR = Math.min(maxVisualR, baseR * lvGrow * Math.min(1.28, GameApp.player.areaMult * (1 + (trait.dragonMawAreaBonus || 0) * 0.45)));
      const speedVal = 275 + Math.max(1, level) * 9 + ((isDragonite || isMegaX) ? 32 : 0);
      const durVal = 0.68 + Math.max(1, level) * 0.026 + ((isDragonite || isMegaX) ? 0.08 : 0);
      const singleDmgMult = 0.96 + (level >= 6 ? 0.28 : 0) + ((isDragonite || isMegaX) ? 0.30 : 0);

      this.groundHazards.push({
        kind: "dragon_wave",
        isDragoniteKing: isDragonite,
        isMegaCharizardX: isMegaX,
        spriteUrl: dSprUrl,
        isShiny: !!caster.isShiny,
        facingX: Math.cos(baseAngle) >= 0 ? 1 : -1,
        afterimages: [],
        afterimageTimer: 0.02,
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
        color: isMegaX ? "#0EA5E9" : (isDragonite ? "#F59E0B" : "#4338CA")
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
            setTimeout(() => {
              if (GameApp.state === "PLAYING" && GameApp.player) {
                this.triggerUltimateSuperMove(pickMeta, skSlot, ultDmgScale * 0.72);
              }
            }, idx * 180);
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
      // 【近戰爆發型・終極衝擊】：收斂鑽頭長度至中近距離四向衝鋒
      const ultR = this.getUltRadius(148, 152, 192);
      for (let i = 0; i < 4; i++) {
        const ang = (i * Math.PI * 2) / 4 + Math.PI / 4;
        this.meleeEffects.push({
          style: "giga_impact_lance",
          casterRef: p,
          ox: p.x + Math.cos(ang) * 26,
          oy: p.y + Math.sin(ang) * 26,
          x: p.x + Math.cos(ang) * 26,
          y: p.y + Math.sin(ang) * 26,
          angle: ang,
          radius: ultR,
          dmg: ultDmg * 0.62,
          type: "Normal",
          kb: 24,
          hitSet: new Set(),
          timer: 0.48 + i * 0.04,
          maxTime: 0.48 + i * 0.04,
          color: "#FACC15"
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

      setTimeout(() => {
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
      }, 260);
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
          x: tx, y: ty,
          startX: tx + 20, startY: ty - 185,
          radius: meteorR,
          dmg: ultDmg * 0.62,
          type: "Dragon",
          delay: m * 0.13,
          timer: 0.45 + m * 0.13,
          maxTime: 0.45,
          color: "#4338CA"
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
        if (!pr.returning && elapsed >= 0.48) {
          pr.returning = true;
          pr.hitSet.clear(); // 折返時允許再次切割同一批怪獸，達成雙段傷害！
        }
        if (pr.returning && pr.casterRef) {
          const backAng = Math.atan2(pr.casterRef.y - pr.y, pr.casterRef.x - pr.x);
          const backSpd = (pr.initSpeed || 360) * 1.15;
          pr.vx = pr.vx * 0.82 + Math.cos(backAng) * backSpd * 0.18;
          pr.vy = pr.vy * 0.82 + Math.sin(backAng) * backSpd * 0.18;
          if (Math.hypot(pr.casterRef.x - pr.x, pr.casterRef.y - pr.y) < 24 && elapsed > 0.72) {
            pr.life = 0;
          }
        }
        pr.angle = (pr.angle || 0) + dt * 8.5;
      }

      // 污泥炸彈拋物線：落地爆開並生成持續 3.2 秒的冒泡腐蝕毒沼
      if (pr.vfx === "sludge_lob") {
        pr.progress = (pr.progress || 0) + dt / pr.maxLife;
        const t = Math.min(1, pr.progress);
        pr.x = pr.startX + (pr.targetX - pr.startX) * t;
        pr.y = pr.startY + (pr.targetY - pr.startY) * t - Math.sin(t * Math.PI) * (pr.arcHeight || 58);
        pr.angle = (pr.angle || 0) + dt * 3.8;

        if (t >= 1) {
          const puddleR = 64 * GameApp.player.areaMult;
          for (let s = 0; s < 10; s++) {
            const a = Math.random() * Math.PI * 2;
            const spd = 25 + Math.random() * 55;
            this.spawnSubParticle(pr.targetX, pr.targetY, Math.cos(a) * spd, Math.sin(a) * spd, s % 2 === 0 ? "#9333EA" : "#4ADE80", 4.5, 0.42, "circle");
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
            x: pr.targetX,
            y: pr.targetY,
            radius: Math.min(95, puddleR),
            dmg: pr.dmg * 0.42,
            type: "Poison",
            timer: puddleDur,
            maxTime: puddleDur,
            tickTimer: 0.32,
            tickInterval: 0.42,
            color: "#9333EA"
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
      pr.life -= dt;
      if (pr.spawnGraceTimer > 0) pr.spawnGraceTimer -= dt;

      pr.trailTimer = (pr.trailTimer || 0) - dt;
      if (pr.trailTimer <= 0) {
        pr.trailTimer = 0.045;
        if (pr.vfx === "ember_spark") {
          this.spawnSubParticle(pr.x + (Math.random() - 0.5) * 6, pr.y + (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 28, -22 - Math.random() * 24, Math.random() < 0.5 ? "#FEF08A" : "#F97316", 2.2, 0.22, "diamond");
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
      const tightRadius = pr.radius * 0.82; // 緊縮判定框 0.82x，確保子彈視覺前端真正嵌入怪獸身體才觸發命中
      const nearbyEnemies = this.getEnemiesInRadius(pr.x, pr.y, tightRadius);
      for (let j = nearbyEnemies.length - 1; j >= 0; j--) {
        const e = nearbyEnemies[j];
        if (!e || e.hp <= 0 || pr.hitSet.has(e)) continue;
        const dx = e.x - pr.x, dy = e.y - pr.y;
        const rSum = tightRadius + e.radius * 0.9;
        if (dx * dx + dy * dy <= rSum * rSum) {
          pr.hitSet.add(e);
          GameApp.dealDamageToEnemy(e, pr.dmg, pr.type, pr.statusBonus, pr.knockback || 0);
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
              this.spawnSubParticle(e.x, e.y, Math.cos(ca) * cs, Math.sin(ca) * cs - 18, cp % 2 === 0 ? "#FEF08A" : "#EF4444", 2.6 + Math.random() * 1.1, 0.22, "diamond");
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

          const candidates = this.getEnemiesInRadius(midX, midY, curLen * 0.5 + halfW + 18);
          for (let j = 0; j < candidates.length; j++) {
            const e = candidates[j];
            if (!e || e.hp <= 0 || m.hitSet.has(e) || !this.isInsideViewport(e.x, e.y, 20)) continue;
            const rx = e.x - m.ox, ry = e.y - m.oy;
            const along = rx * cosA + ry * sinA;
            if (along < -e.radius * 0.5 || along > curLen + e.radius) continue;
            const perpDist = Math.abs(-rx * sinA + ry * cosA);
            if (perpDist <= halfW + e.radius * 0.85) {
              m.hitSet.add(e);
              GameApp.dealDamageToEnemy(e, m.dmg, m.type, m.statusBonus || 0.15, (m.kb || 16) * (m.secondTickDone ? 0.65 : 1.0));
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

          const candidates = this.getEnemiesInRadius(midX, midY, curLen * 0.5 + (m.endHalfW || 36) + 18);
          for (let j = 0; j < candidates.length; j++) {
            const e = candidates[j];
            if (!e || e.hp <= 0 || m.hitSet.has(e) || !this.isInsideViewport(e.x, e.y, 20)) continue;
            const rx = e.x - m.ox, ry = e.y - m.oy;
            const along = rx * cosA + ry * sinA;
            if (along < -e.radius * 0.5 || along > curLen + e.radius) continue;
            const tFrac = Math.max(0, Math.min(1, along / Math.max(1, m.length)));
            const coneHalfW = (m.startHalfW || 9) + ((m.endHalfW || 32) - (m.startHalfW || 9)) * tFrac;
            const perpDist = Math.abs(-rx * sinA + ry * cosA);
            if (perpDist <= coneHalfW + e.radius * 0.85) {
              m.hitSet.add(e);
              GameApp.dealDamageToEnemy(e, m.dmg, "Fire", m.statusBonus || 0.22, 0);
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

          const candidates = this.getEnemiesInRadius(midX, midY, curLen * 0.5 + halfW + 18);
          for (let j = 0; j < candidates.length; j++) {
            const e = candidates[j];
            if (!e || e.hp <= 0 || m.hitSet.has(e) || !this.isInsideViewport(e.x, e.y, 20)) continue;
            const rx = e.x - m.ox, ry = e.y - m.oy;
            const along = rx * cosA + ry * sinA;
            if (along < -e.radius * 0.5 || along > curLen + e.radius) continue;
            const perpDist = Math.abs(-rx * sinA + ry * cosA);
            if (perpDist <= halfW + e.radius * 0.85) {
              m.hitSet.add(e);
              GameApp.dealDamageToEnemy(e, m.dmg, "Ice", m.statusBonus || 0.25, m.kb || 4);
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
          // 隕石落地引爆：乾淨收斂的單環蒼藍龍威氣浪 + 6 顆星屑，不遮擋戰場視野
          this.meleeEffects.push({
            style: "slam_wave",
            x: hz.x, y: hz.y,
            radius: hz.radius * 0.92,
            timer: 0.30, maxTime: 0.30,
            color: "#38BDF8"
          });
          for (let k = 0; k < 6; k++) {
            const a = (k * Math.PI * 2) / 6;
            this.spawnSubParticle(hz.x, hz.y, Math.cos(a) * 65, Math.sin(a) * 65, k % 2 === 0 ? "#38BDF8" : "#FDE047", 3.5, 0.32, "star");
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
          this.spawnSubParticle(rx, ry - 40, (Math.random() - 0.5) * 20, 35 + Math.random() * 25, Math.random() < 0.5 ? "#FEF08A" : "#F472B6", 3.2, 0.55, "star");
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
          const hzCandidates = [...this.getEnemiesInRadius(hz.x, hz.y, hz.radius)];
          hzCandidates.forEach(e => {
            if (!e || e.hp <= 0) return;
            const dx = e.x - hz.x, dy = e.y - hz.y;
            const rSum = hz.radius + e.radius;
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
              if (hz.kind === "genesis_aurora" || hz.kind === "moon_pillar") {
                const wasWeakened = (e.weakenTimer && e.weakenTimer > 0.5);
                e.weakenTimer = 3.0; // 創世極光與月光聖柱：降低敵方 35% 攻擊力
                if (!wasWeakened) {
                  GameApp.spawnFloatingText(e.x, e.y - 24, "🌙 降攻 -35%!", "#F472B6", 11);
                }
              }
              const hzStatusMod = hz.kind === "dragon_wave" ? 0.25 : ((hz.kind === "moon_pillar" || hz.kind === "genesis_aurora") ? -0.28 : -0.08);
              const megaToughClawsCrit = (hz.kind === "dragon_wave" && hz.isMegaCharizardX) ? 0.25 : 0;
              GameApp.dealDamageToEnemy(e, dVal, hz.type, hzStatusMod, hz.kind === "dragon_wave" ? 14 : 2, megaToughClawsCrit);
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
  },

  // ==========================================================================
  // 圖層 1：地面底層渲染 (renderGroundLayer) — 繪製於所有精靈與訓練家腳底下，絕不遮擋人物
  // ==========================================================================
  renderGroundLayer(ctx, toSx, toSy) {
    const now = performance.now() * 0.004;

    this.groundHazards.forEach(hz => {
      if (hz.kind === "meteor_strike" && hz.delay > 0) return;
      const sx = toSx(hz.x), sy = toSy(hz.y);
      const prog = Math.max(0, Math.min(1, 1 - (hz.timer / (hz.maxTime || 0.45))));
      ctx.save();

      if (hz.kind === "poison_puddle" || hz.kind === "toxic_swamp") {
        const isUltSwamp = (hz.kind === "toxic_swamp");
        const alpha = Math.min(1, hz.timer * 1.2);
        const rx = hz.radius;
        const ry = hz.radius * (isUltSwamp ? 0.72 : 0.62);

        // 1. 底層深紫黑腐蝕泥沼漸層底盤
        const swampGrad = ctx.createRadialGradient(sx, sy, rx * 0.15, sx, sy, rx);
        swampGrad.addColorStop(0, `rgba(20, 83, 45, ${alpha * 0.65})`);
        swampGrad.addColorStop(0.55, `rgba(88, 28, 135, ${alpha * 0.58})`);
        swampGrad.addColorStop(1, `rgba(59, 7, 100, 0)`);
        ctx.fillStyle = swampGrad;
        ctx.beginPath();
        ctx.ellipse(sx, sy, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();

        // 2. 雙層沸騰毒波外環與順逆旋轉劇毒漩渦紋 (超武專屬強化)
        ctx.strokeStyle = `rgba(147, 51, 234, ${alpha * 0.9})`;
        ctx.lineWidth = isUltSwamp ? 4.0 : 3.0;
        ctx.beginPath();
        ctx.ellipse(sx, sy, rx * 0.92, ry * 0.92, 0, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = `rgba(74, 222, 128, ${alpha * 0.85})`;
        ctx.lineWidth = 2.0;
        ctx.setLineDash(isUltSwamp ? [16, 10] : []);
        ctx.beginPath();
        ctx.ellipse(sx, sy, rx * 0.76, ry * 0.76, now * 0.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        if (isUltSwamp) {
          // 劇毒沼澤超武：內部 4 道螢光綠逆時針腐蝕渦流帶
          for (let arm = 0; arm < 4; arm++) {
            const a0 = -now * 1.6 + (arm * Math.PI * 2) / 4;
            ctx.strokeStyle = `rgba(163, 230, 53, ${alpha * 0.65})`;
            ctx.lineWidth = 5.5;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.ellipse(sx, sy, rx * 0.52, ry * 0.52, 0, a0, a0 + 0.95);
            ctx.stroke();
          }
        }

        // 3. 密集翻湧立體毒泡群（超武 16 顆大小錯落 + 破裂十字毒霧，普攻 6 顆）
        const bubbleCount = isUltSwamp ? 16 : 6;
        for (let b = 0; b < bubbleCount; b++) {
          const bAng = now * (b % 2 === 0 ? 1.1 : -0.9) + (b * Math.PI * 2) / bubbleCount;
          const distR = 0.22 + ((b % 4) * 0.18);
          const bx = sx + Math.cos(bAng) * (rx * distR);
          const by = sy + Math.sin(bAng) * (ry * distR);
          const pulse = Math.sin(now * 4.2 + b * 1.3);
          const br = Math.max(2.4, (isUltSwamp ? 5.2 : 4.0) + pulse * 2.2);

          ctx.fillStyle = b % 2 === 0 ? `rgba(34, 197, 94, ${alpha * 0.88})` : `rgba(168, 85, 247, ${alpha * 0.88})`;
          ctx.strokeStyle = `rgba(20, 83, 45, ${alpha * 0.95})`;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.arc(bx, by, br, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
          ctx.beginPath();
          ctx.arc(bx - br * 0.3, by - br * 0.3, br * 0.32, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (hz.kind === "blastoise_maelstrom") {
        // 【水箭龜超武・三層立體深海大漩渦】：底層深海暗湧 ＋ 中層順逆交錯激流與氣泡環 ＋ 外圈 8 道碎浪白沫海嘯巨浪
        ctx.translate(sx, sy);
        const alpha = Math.min(1, hz.timer * 1.35);
        ctx.globalAlpha = alpha;
        const maxR = Math.max((hz.innerSafeRadius || 44) + 4, hz.radius * Math.min(1, prog * 2.4));
        const safeR = hz.innerSafeRadius || 44;

        // 第 1 層：深海暗湧雙色漸層底盤（保留中央 44px 淨空風眼）
        const swirlGrad = ctx.createRadialGradient(0, 0, safeR, 0, 0, maxR);
        swirlGrad.addColorStop(0, "rgba(3, 105, 161, 0.0)");
        swirlGrad.addColorStop(0.18, "rgba(7, 89, 133, 0.52)");
        swirlGrad.addColorStop(0.55, "rgba(2, 132, 199, 0.42)");
        swirlGrad.addColorStop(0.85, "rgba(56, 189, 248, 0.30)");
        swirlGrad.addColorStop(1, "rgba(14, 116, 144, 0.0)");
        ctx.fillStyle = swirlGrad;
        ctx.beginPath();
        ctx.arc(0, 0, maxR, 0, Math.PI * 2);
        ctx.fill();

        const spin = -(hz.rotAngle || now * 1.85);

        // 第 2 層 A：底層寬幅深海螺旋暗帶（逆時針）
        for (let band = 0; band < 4; band++) {
          const bAng = spin * 0.9 + (band * Math.PI * 2) / 4;
          ctx.strokeStyle = "rgba(3, 105, 161, 0.65)";
          ctx.lineWidth = 14;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.arc(0, 0, safeR + (maxR - safeR) * 0.45, bAng, bAng + 0.95);
          ctx.stroke();
        }

        // 第 2 層 B：中層順逆時針交錯亮青白激流線（5 環正反交錯）
        for (let ring = 0; ring < 5; ring++) {
          const rr = safeR + 18 + ring * ((maxR - safeR - 22) / 4.5);
          if (rr > maxR) continue;
          const dir = (ring % 2 === 0) ? 1 : -1;
          ctx.strokeStyle = ring % 2 === 0 ? "#00D2FF" : "#E0FFFF";
          ctx.lineWidth = 3.6 - ring * 0.35;
          for (let arm = 0; arm < 4; arm++) {
            const a0 = spin * dir * (1.3 - ring * 0.12) + (arm * Math.PI * 2) / 4 + ring * 0.4;
            ctx.beginPath();
            ctx.arc(0, 0, rr, a0, a0 + 1.15);
            ctx.stroke();
          }
        }

        // 第 2 層 C：由內向外螺旋噴湧的密集立體水泡群 (16 顆帶高光氣泡)
        for (let b = 0; b < 16; b++) {
          const bProg = ((now * 0.85 + b * 0.19) % 1.0);
          const bR = safeR + 12 + bProg * (maxR - safeR - 20);
          const bAng = spin * 1.4 + b * 1.15 + bProg * 2.2;
          const bx = Math.cos(bAng) * bR;
          const by = Math.sin(bAng) * bR;
          const br = 2.5 + (b % 3) * 1.4;
          ctx.fillStyle = "rgba(186, 230, 253, 0.85)";
          ctx.strokeStyle = "#FFFFFF";
          ctx.lineWidth = 1.1;
          ctx.beginPath();
          ctx.arc(bx, by, br, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }

        // 第 3 層：外圈 8 道浮世繪風立體拍岸海嘯波峰 ＋ 飛濺白沫水珠
        for (let w = 0; w < 8; w++) {
          const wAng = -spin * 0.95 + (w * Math.PI * 2) / 8;
          const waveR = Math.max(safeR + 28, maxR * 0.84);
          ctx.save();
          ctx.rotate(wAng);
          ctx.translate(waveR, 0);

          ctx.fillStyle = "#0284C7";
          ctx.strokeStyle = "#E0FFFF";
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.arc(0, 0, 34, -1.12, 1.12);
          ctx.arc(-13, 0, 25, 1.12, -1.12, true);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = "#7DD3FC";
          ctx.beginPath();
          ctx.arc(3, 0, 26, -0.85, 0.85);
          ctx.arc(-6, 0, 20, 0.85, -0.85, true);
          ctx.closePath();
          ctx.fill();

          // 浪尖三連純白泡沫與外濺水珠
          ctx.fillStyle = "#FFFFFF";
          ctx.beginPath();
          ctx.arc(25, -14, 4.8, 0, Math.PI * 2);
          ctx.arc(30, 0, 6.2, 0, Math.PI * 2);
          ctx.arc(25, 14, 4.8, 0, Math.PI * 2);
          ctx.arc(37, -7, 2.8, 0, Math.PI * 2);
          ctx.arc(37, 7, 2.8, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      } else if (hz.kind === "frenzy_plant_roots") {
        // 【奇異種子超武・瘋狂植物】：地面底層裂開泥坑，破土竄出帶尖刺與紅花苞的巨型彎曲荊棘藤木
        const alpha = Math.min(0.80, hz.timer * 1.15);
        ctx.globalAlpha = alpha;
        const grow = Math.min(1, prog * 2.8);

        (hz.rootNodes || []).forEach((rn, idx) => {
          const rx = toSx(rn.x), ry = toSy(rn.y);
          ctx.save();
          ctx.translate(rx, ry);

          // 1. 破土泥坑裂縫底座
          ctx.fillStyle = "#3E2723";
          ctx.strokeStyle = "#1B100E";
          ctx.lineWidth = 2.0;
          ctx.beginPath();
          ctx.ellipse(0, 4, 18 * grow, 8 * grow, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // 2. 破土竄出的 S 型彎曲巨型荊棘魔藤
          const h = 52 * (rn.heightScale || 1.0) * grow;
          const sway = Math.sin(now * 2.4 + rn.phaseOffset) * 10 * rn.leanDir;
          const tipX = rn.leanDir * 22 * grow + sway;
          const tipY = -h;

          ctx.lineCap = "round";
          // 逐段繪製「雙股麻花交錯纏繞藤幹紋理 + 節點倒刺三角 + 翠綠葉片」
          const vSegs = 12;
          for (let s = 0; s < vSegs; s++) {
            const t0 = s / vSegs;
            const t1 = (s + 1) / vSegs;
            const y0 = 2 - t0 * h;
            const y1 = 2 - t1 * h;
            const curve0 = Math.sin(t0 * Math.PI * 1.6) * 16 * rn.leanDir + t0 * sway;
            const curve1 = Math.sin(t1 * Math.PI * 1.6) * 16 * rn.leanDir + t1 * sway;
            const twist0 = Math.sin(t0 * Math.PI * 5 + now * 4) * 3.2 * (1 - t0 * 0.4);
            const twist1 = Math.sin(t1 * Math.PI * 5 + now * 4) * 3.2 * (1 - t1 * 0.4);
            const thick = Math.max(2.6, 8.2 * (1 - t0 * 0.55));

            // 底層深墨綠硬邊
            ctx.strokeStyle = "#052E16";
            ctx.lineWidth = thick + 3.5;
            ctx.beginPath();
            ctx.moveTo(curve0, y0);
            ctx.lineTo(curve1, y1);
            ctx.stroke();

            // 第一股深翠綠主藤
            ctx.strokeStyle = "#15803D";
            ctx.lineWidth = thick * 0.72;
            ctx.beginPath();
            ctx.moveTo(curve0 - twist0, y0);
            ctx.lineTo(curve1 - twist1, y1);
            ctx.stroke();

            // 第二股亮草綠交纏副藤（形成立體麻花藤紋）
            ctx.strokeStyle = "#22C55E";
            ctx.lineWidth = thick * 0.58;
            ctx.beginPath();
            ctx.moveTo(curve0 + twist0, y0);
            ctx.lineTo(curve1 + twist1, y1);
            ctx.stroke();

            // 嫩綠高光藤節紋
            ctx.strokeStyle = "#86EFAC";
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.moveTo(curve0 + twist0 * 0.5, y0);
            ctx.lineTo(curve1 + twist1 * 0.5, y1);
            ctx.stroke();

            // 沿藤身兩側交錯長出鋒利三角倒刺與嫩葉
            if (grow > 0.35 && s > 1 && s < vSegs - 1 && s % 2 === 0) {
              const side = (s % 4 === 0) ? 1 : -1;
              // 鋒利深綠棘刺三角
              ctx.fillStyle = "#14532D";
              ctx.strokeStyle = "#052E16";
              ctx.lineWidth = 1.0;
              ctx.beginPath();
              ctx.moveTo(curve0, y0 + 3);
              ctx.lineTo(curve0 + side * (thick + 7), y0 - 2);
              ctx.lineTo(curve0, y0 - 4);
              ctx.closePath();
              ctx.fill();
              ctx.stroke();

              // 節點嫩綠芽苞與小葉
              ctx.fillStyle = "#4ADE80";
              ctx.beginPath();
              ctx.ellipse(curve0 - side * (thick * 0.6), y0, 4.5, 2.2, -side * 0.5, 0, Math.PI * 2);
              ctx.fill();
            }
          }

          // 頂端盛開五瓣立體薔薇/霸王花冠
          if (grow > 0.5) {
            ctx.save();
            ctx.translate(tipX, tipY);
            ctx.rotate(now * 1.2);
            for (let pIdx = 0; pIdx < 5; pIdx++) {
              const pAng = (pIdx * Math.PI * 2) / 5;
              ctx.fillStyle = idx % 2 === 0 ? "#F43F5E" : "#FB7185";
              ctx.strokeStyle = "#881337";
              ctx.lineWidth = 1.2;
              ctx.beginPath();
              ctx.arc(Math.cos(pAng) * 4.5, Math.sin(pAng) * 4.5, 4.2, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();
            }
            ctx.fillStyle = "#FDE047";
            ctx.beginPath();
            ctx.arc(0, 0, 3.0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
          ctx.restore();
        });
      } else if (hz.kind === "gengar_grin_domain") {
        // 【耿鬼專屬超武・暗影死滅波】：底層冥界巨大壞笑暗影陣（血紅雙眼＋經典弦月壞笑）
        ctx.translate(sx, sy);
        const alpha = Math.sin((1 - prog) * Math.PI) * 0.90;
        const curR = Math.max(30, hz.radius * Math.min(1, prog * 2.2));

        const shadowGrad = ctx.createRadialGradient(0, 0, 18, 0, 0, curR);
        shadowGrad.addColorStop(0, `rgba(15, 7, 32, ${alpha * 0.85})`);
        shadowGrad.addColorStop(0.65, `rgba(88, 28, 135, ${alpha * 0.48})`);
        shadowGrad.addColorStop(1, "rgba(15, 23, 42, 0)");
        ctx.fillStyle = shadowGrad;
        ctx.beginPath();
        ctx.arc(0, 0, curR, 0, Math.PI * 2);
        ctx.fill();

        // 外圍旋轉紫冥符文圈
        ctx.strokeStyle = `rgba(192, 132, 252, ${alpha * 0.85})`;
        ctx.lineWidth = 3.0;
        ctx.setLineDash([14, 8]);
        ctx.beginPath();
        ctx.arc(0, 0, curR * 0.88, now * 0.8, now * 0.8 + Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // 耿鬼標誌性「血紅邪魅雙眼 + 弦月露齒壞笑」地面投影圖騰（隨領域半徑等比縮放）
        ctx.save();
        const grinScale = Math.min(1.0, curR / 205);
        ctx.scale(grinScale, grinScale);
        ctx.globalAlpha = alpha * 0.85;
        // 左眼三角形
        ctx.fillStyle = "#EF4444";
        ctx.beginPath();
        ctx.moveTo(-48, -28); ctx.lineTo(-16, -12); ctx.lineTo(-42, -4);
        ctx.closePath();
        ctx.fill();
        // 右眼三角形
        ctx.beginPath();
        ctx.moveTo(48, -28); ctx.lineTo(16, -12); ctx.lineTo(42, -4);
        ctx.closePath();
        ctx.fill();

        // 弦月壞笑大嘴
        ctx.fillStyle = "#F8FAFC";
        ctx.strokeStyle = "#3B0764";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 12, 54, 0.12 * Math.PI, 0.88 * Math.PI);
        ctx.quadraticCurveTo(0, 32, -54 * Math.cos(0.12 * Math.PI), 12 + 54 * Math.sin(0.12 * Math.PI));
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 牙齒豎線
        ctx.strokeStyle = "#3B0764";
        ctx.lineWidth = 2.0;
        [-28, -14, 0, 14, 28].forEach(tx => {
          ctx.beginPath();
          ctx.moveTo(tx, 24);
          ctx.lineTo(tx, 58);
          ctx.stroke();
        });
        ctx.restore();
      } else if (hz.kind === "cross_chop_cleave") {
        // 【爆裂十字劈・巨型白熾 X 十字天譴裂地痕（底層）】
        ctx.translate(sx, sy);
        const alpha = Math.min(1, hz.timer * 1.5);
        ctx.globalAlpha = alpha;
        const arm = hz.radius * Math.min(1, prog * 3.2);

        [-Math.PI / 4, Math.PI / 4].forEach(rot => {
          ctx.save();
          ctx.rotate(rot);
          // 焦黑裂地深溝
          ctx.fillStyle = "rgba(69, 10, 10, 0.78)";
          ctx.beginPath();
          ctx.ellipse(0, 0, arm, 22 * (1 - prog * 0.35), 0, 0, Math.PI * 2);
          ctx.fill();

          // 赤紅熔岩武道氣焰外框
          ctx.fillStyle = "#DC2626";
          ctx.beginPath();
          ctx.ellipse(0, 0, arm * 0.94, 14 * (1 - prog * 0.35), 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        });
      } else if (hz.kind === "martial_aura_domain") {
        // 【太極八卦武神陣（底層三層中式武道法陣）】：
        // 1. 鎮嶽焦黑石板底盤 2. 外圈順時針八卦方位陣盤與卦象符紋 3. 中層逆時針交錯金剛八角星盤 4. 內圈陰陽雙魚流體氣旋
        ctx.translate(sx, sy);
        const alpha = Math.min(1, hz.timer * 1.25);
        const curR = Math.max(36, hz.radius * Math.min(1, prog * 3.0));
        ctx.globalAlpha = alpha;

        // 第 1 層：入木三分的暗紅焦黑武道石板底盤（凸顯上方金紅陣紋）
        const mGrad = ctx.createRadialGradient(0, 0, 28, 0, 0, curR);
        mGrad.addColorStop(0, "rgba(15, 23, 42, 0.0)");
        mGrad.addColorStop(0.22, "rgba(69, 10, 10, 0.62)");
        mGrad.addColorStop(0.72, "rgba(185, 28, 28, 0.45)");
        mGrad.addColorStop(0.92, "rgba(250, 204, 21, 0.32)");
        mGrad.addColorStop(1, "rgba(250, 204, 21, 0.0)");
        ctx.fillStyle = mGrad;
        ctx.beginPath();
        ctx.arc(0, 0, curR, 0, Math.PI * 2);
        ctx.fill();

        // 第 2 層：外圈順時針「正八邊形八卦外盤 ＋ 八宮三畫卦象金紋 ＋ 八方鎮陣符印」
        ctx.save();
        ctx.rotate(now * 0.45);
        const octR = curR * 0.92;
        const innerOctR = curR * 0.72;

        // 外八角雙線金框
        ctx.strokeStyle = "#FACC15";
        ctx.lineWidth = 3.0;
        ctx.beginPath();
        for (let k = 0; k < 8; k++) {
          const a = (k * Math.PI) / 4;
          const ox = Math.cos(a) * octR, oy = Math.sin(a) * octR;
          if (k === 0) ctx.moveTo(ox, oy);
          else ctx.lineTo(ox, oy);
        }
        ctx.closePath();
        ctx.stroke();

        ctx.strokeStyle = "rgba(254, 240, 138, 0.75)";
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        for (let k = 0; k < 8; k++) {
          const a = (k * Math.PI) / 4;
          const ox = Math.cos(a) * innerOctR, oy = Math.sin(a) * innerOctR;
          if (k === 0) ctx.moveTo(ox, oy);
          else ctx.lineTo(ox, oy);
        }
        ctx.closePath();
        ctx.stroke();

        // 八卦三畫卦象（乾、兌、離、震、巽、坎、艮、坤：1代表陽爻長線，0代表陰爻斷線）
        const trigrams = [
          [1, 1, 1], [0, 1, 1], [1, 0, 1], [0, 0, 1],
          [1, 1, 0], [0, 1, 0], [1, 0, 0], [0, 0, 0]
        ];
        for (let k = 0; k < 8; k++) {
          const midA = (k * Math.PI) / 4 + Math.PI / 8;
          ctx.save();
          ctx.rotate(midA);
          const baseDist = curR * 0.76;
          const tri = trigrams[k];
          ctx.strokeStyle = "#FEF08A";
          ctx.lineWidth = 2.2;
          ctx.lineCap = "round";
          for (let lineIdx = 0; lineIdx < 3; lineIdx++) {
            const rDist = baseDist + lineIdx * (curR * 0.042);
            const barHalfW = curR * 0.085;
            ctx.beginPath();
            if (tri[lineIdx] === 1) {
              // 陽爻（長實線）
              ctx.moveTo(rDist, -barHalfW);
              ctx.lineTo(rDist, barHalfW);
            } else {
              // 陰爻（雙短斷線）
              ctx.moveTo(rDist, -barHalfW);
              ctx.lineTo(rDist, -barHalfW * 0.22);
              ctx.moveTo(rDist, barHalfW * 0.22);
              ctx.lineTo(rDist, barHalfW);
            }
            ctx.stroke();
          }
          ctx.restore();

          // 八角頂點鎮陣赤金菱形陣眼
          const vx = Math.cos((k * Math.PI) / 4) * octR;
          const vy = Math.sin((k * Math.PI) / 4) * octR;
          ctx.fillStyle = "#FEF08A";
          ctx.strokeStyle = "#991B1B";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(vx, vy, 4.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
        ctx.restore();

        // 第 3 層：中圈逆時針「交錯八角金剛星盤（兩個 45 度交疊正方形陣紋）」
        ctx.save();
        ctx.rotate(-now * 0.65);
        const sqR = curR * 0.66;
        [0, Math.PI / 4].forEach((rotOff, idx) => {
          ctx.save();
          ctx.rotate(rotOff);
          ctx.strokeStyle = idx === 0 ? "rgba(239, 68, 68, 0.88)" : "rgba(250, 204, 21, 0.85)";
          ctx.lineWidth = 2.4;
          ctx.beginPath();
          for (let s = 0; s < 4; s++) {
            const a = (s * Math.PI) / 2;
            const px = Math.cos(a) * sqR, py = Math.sin(a) * sqR;
            if (s === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.stroke();
          ctx.restore();
        });
        ctx.restore();

        // 第 4 層：內圈「太極陰陽雙魚氣旋」（一赤紅一耀金圍繞主角 42px 淨空區高速盤旋）
        const yinYangR = Math.max(36, curR * 0.36);
        for (let arm = 0; arm < 2; arm++) {
          const startA = now * 2.2 + arm * Math.PI;
          ctx.strokeStyle = arm === 0 ? "#FEF08A" : "#EF4444";
          ctx.lineWidth = 5.5;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.arc(0, 0, yinYangR, startA, startA + Math.PI * 0.78);
          ctx.stroke();

          // 魚眼陣樞圓點
          const headA = startA + Math.PI * 0.78;
          ctx.fillStyle = arm === 0 ? "#EF4444" : "#FEF08A";
          ctx.beginPath();
          ctx.arc(Math.cos(headA) * yinYangR, Math.sin(headA) * yinYangR, 4.5, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (hz.kind === "genesis_aurora") {
        // 【創世極光（月亮之力超武・底層）】：月華星河投影陣 ＋ 雙向交織波浪極光帶 ＋ 閃爍十字星芒
        ctx.translate(sx, sy);
        const alpha = Math.sin((1 - prog) * Math.PI) * 0.90;
        const curR = Math.max(28, hz.radius * Math.min(1, prog * 2.0));

        const aurGrad = ctx.createRadialGradient(0, 0, 24, 0, 0, curR);
        aurGrad.addColorStop(0, `rgba(254, 240, 138, ${alpha * 0.25})`);
        aurGrad.addColorStop(0.45, `rgba(244, 114, 182, ${alpha * 0.38})`);
        aurGrad.addColorStop(0.82, `rgba(56, 189, 248, ${alpha * 0.32})`);
        aurGrad.addColorStop(1, "rgba(15, 23, 42, 0)");
        ctx.fillStyle = aurGrad;
        ctx.beginPath();
        ctx.arc(0, 0, curR, 0, Math.PI * 2);
        ctx.fill();

        // 外圍神聖月相星軌環
        ctx.strokeStyle = `rgba(254, 240, 138, ${alpha * 0.8})`;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(0, 0, curR * 0.88, 0, Math.PI * 2);
        ctx.stroke();

        // 4 道交織流動的波浪極光絲帶
        for (let band = 0; band < 4; band++) {
          ctx.strokeStyle = band % 2 === 0 ? `rgba(244, 114, 182, ${alpha * 0.9})` : (band === 1 ? `rgba(254, 240, 138, ${alpha * 0.95})` : `rgba(103, 232, 249, ${alpha * 0.9})`);
          ctx.lineWidth = 4.8;
          ctx.lineCap = "round";
          ctx.beginPath();
          for (let x = -curR * 0.84; x <= curR * 0.84; x += 16) {
            const y = (band - 1.5) * 36 + Math.sin(now * 3.4 + x * 0.032 + band * 1.4) * 18;
            if (x === -curR * 0.84) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      } else if (hz.kind === "quake_fissure") {
        // 【地裂斷層破（超武・瞬爆網狀深淵龜裂）】：0.22s 指數緩出瞬間撕裂全範圍 ＋ 不規則樹狀分岔裂谷 ＋ 熔岩呼吸光 ＋ 轉折點巨岩尖柱
        ctx.translate(sx, sy);
        if (!hz.cracks) hz.cracks = this.buildQuakeCrackTree(11, hz.radius, true);
        const alpha = Math.min(1, hz.timer * 1.35);
        ctx.globalAlpha = alpha;
        const elapsed = (hz.maxTime || 2.0) - hz.timer;
        const burstT = Math.min(1, elapsed / 0.22);
        const tearProg = 1 - Math.pow(1 - burstT, 3); // 0.22s 極速瞬爆撕裂至 100%
        const curR = Math.max(30, hz.radius * tearProg);
        const lavaPulse = 0.72 + Math.sin(now * 5.2) * 0.28;

        // 1. 內圈震央塌陷熔岩坑漸層底盤與起手飛沙衝擊波環
        const craterGrad = ctx.createRadialGradient(0, 0, 24, 0, 0, curR * 0.72);
        craterGrad.addColorStop(0, "rgba(69, 26, 3, 0.0)");
        craterGrad.addColorStop(0.38, "rgba(69, 26, 3, 0.56)");
        craterGrad.addColorStop(0.75, `rgba(217, 119, 6, ${0.32 * lavaPulse})`);
        craterGrad.addColorStop(1, "rgba(120, 53, 15, 0.0)");
        ctx.fillStyle = craterGrad;
        ctx.beginPath();
        ctx.arc(0, 0, curR * 0.72, 0, Math.PI * 2);
        ctx.fill();

        if (elapsed < 0.42) {
          const dustProg = elapsed / 0.42;
          const dustEase = 1 - Math.pow(1 - dustProg, 2);
          ctx.strokeStyle = `rgba(253, 230, 138, ${(1 - dustProg) * 0.65})`;
          ctx.lineWidth = Math.max(2, 10 * (1 - dustProg));
          ctx.beginPath();
          ctx.arc(0, 0, hz.radius * (0.28 + dustEase * 0.78), 0, Math.PI * 2);
          ctx.stroke();
        }

        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        // 2. 繪製預生成的不規則網狀龜裂（由中心向外瞬間撕裂，寬度根粗尾尖自然收窄）
        const segs = hz.cracks.segments;
        for (let k = 0; k < segs.length; k++) {
          const sg = segs[k];
          if (tearProg <= sg.t0) continue;
          const localFrac = Math.min(1, (tearProg - sg.t0) / Math.max(0.01, sg.t1 - sg.t0));
          const ex = sg.x1 + (sg.x2 - sg.x1) * localFrac;
          const ey = sg.y1 + (sg.y2 - sg.y1) * localFrac;
          const baseW = (sg.isSub ? 6.2 : 12.5) * sg.wMul;

          // 深淵暗溝底色
          ctx.strokeStyle = "#231006";
          ctx.lineWidth = Math.max(1.8, baseW);
          ctx.beginPath();
          ctx.moveTo(sg.x1, sg.y1);
          ctx.lineTo(ex, ey);
          ctx.stroke();

          // 中層熔岩熾橘呼吸光
          if (baseW > 2.6) {
            ctx.strokeStyle = `rgba(234, 88, 12, ${0.88 * lavaPulse})`;
            ctx.lineWidth = Math.max(1.2, baseW * 0.46);
            ctx.beginPath();
            ctx.moveTo(sg.x1, sg.y1);
            ctx.lineTo(ex, ey);
            ctx.stroke();
          }

          // 核心地脈金白微光（僅主裂谷與粗分岔顯示，保留末端純黑尖刺感）
          if (!sg.isSub && sg.wMul > 0.35) {
            ctx.strokeStyle = `rgba(254, 240, 138, ${0.92 * lavaPulse})`;
            ctx.lineWidth = Math.max(1.0, baseW * 0.18);
            ctx.beginPath();
            ctx.moveTo(sg.x1, sg.y1);
            ctx.lineTo(ex, ey);
            ctx.stroke();
          }
        }

        // 3. 沿裂縫轉折交匯點破土刺出的雙色立體斜切面巨岩尖柱
        const spirePop = Math.min(1, elapsed / 0.18);
        const spireEase = 1 - Math.pow(1 - spirePop, 3);
        hz.cracks.rocks.forEach(rk => {
          const spireH = rk.h * spireEase + Math.abs(Math.sin(now * 3.8 + rk.phase)) * 3.5;
          const rw = rk.w;
          ctx.save();
          ctx.translate(rk.x, rk.y);
          ctx.fillStyle = "#78350F";
          ctx.strokeStyle = "#1C0D06";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(0, -spireH);
          ctx.lineTo(rw, 4);
          ctx.lineTo(0, 8);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = "#D97706";
          ctx.beginPath();
          ctx.moveTo(0, -spireH);
          ctx.lineTo(-rw, 4);
          ctx.lineTo(0, 8);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          ctx.strokeStyle = `rgba(253, 224, 71, ${0.85 * lavaPulse})`;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(-rw * 0.55, 1); ctx.lineTo(0, -spireH * 0.52); ctx.lineTo(rw * 0.55, 1);
          ctx.stroke();
          ctx.restore();
        });

        // 4. 配合空中飛石的地面動態縮放暗影（建立清晰 Z 軸景深）
        for (let b = 0; b < 7; b++) {
          const bAng = (b * Math.PI * 2) / 7 + 0.35;
          const bCycle = (prog * 1.8 + b * 0.23) % 1.0;
          const lift = Math.sin(bCycle * Math.PI);
          const distR = curR * (0.34 + (b % 3) * 0.21) + bCycle * 18;
          const shX = Math.cos(bAng) * distR;
          const shY = Math.sin(bAng) * distR;
          const shScale = Math.max(0.35, 1.0 - lift * 0.58);
          ctx.fillStyle = `rgba(15, 23, 42, ${0.42 * shScale})`;
          ctx.beginPath();
          ctx.ellipse(shX, shY + 4, 13 * shScale, 6 * shScale, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (hz.kind === "ice_shatter_domain") {
        // 【絕對零度（融合 V10 急凍鳥雙向極光幔帳 ＋ 內6外8雙排立體折射冰稜矩陣）】
        ctx.translate(sx, sy);
        const r = Math.max(42, hz.radius * Math.min(1, prog * 1.55));
        const spin = now * 1.1;

        // 1. 第一組：主極光幔帳（左上至右下，冰藍 ➔ 翠綠 ➔ 紫羅蘭）
        for (let k = 0; k < 2; k++) {
          const grad1 = ctx.createLinearGradient(-r, -r + k * 70, r, r);
          grad1.addColorStop(0, "rgba(56, 189, 248, 0.38)");
          grad1.addColorStop(0.5, "rgba(52, 211, 153, 0.30)");
          grad1.addColorStop(1, "rgba(192, 132, 252, 0.38)");
          ctx.fillStyle = grad1;
          ctx.beginPath();
          ctx.ellipse(0, (k - 0.5) * 52, r * 0.96, 64, Math.PI / 12, 0, Math.PI * 2);
          ctx.fill();
        }

        // 2. 第二組：副極光幔帳（右上至左下反向交錯流動，紫羅蘭 ➔ 冰青 ➔ 純白）
        for (let k = 0; k < 2; k++) {
          const grad2 = ctx.createLinearGradient(r, -r + k * 70, -r, r);
          grad2.addColorStop(0, "rgba(192, 132, 252, 0.32)");
          grad2.addColorStop(0.5, "rgba(56, 189, 248, 0.36)");
          grad2.addColorStop(1, "rgba(224, 242, 254, 0.32)");
          ctx.fillStyle = grad2;
          ctx.beginPath();
          ctx.ellipse(0, (k - 0.5) * 46, r * 0.88, 56, -Math.PI / 10, 0, Math.PI * 2);
          ctx.fill();
        }

        // 3. 底層八角冰晶幾何外環與雪花支線
        ctx.strokeStyle = "rgba(224, 242, 254, 0.85)";
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.92, 0, Math.PI * 2);
        ctx.stroke();

        for (let arm = 0; arm < 8; arm++) {
          const a = spin * 0.35 + (arm * Math.PI) / 4;
          const x0 = Math.cos(a) * 38, y0 = Math.sin(a) * 38;
          const x1 = Math.cos(a) * (r * 0.92), y1 = Math.sin(a) * (r * 0.92);
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
          ctx.stroke();
        }

        // 4. 內排 6 枚（順時針高速旋轉）：立體雙色折射菱形冰晶
        for (let k = 0; k < 6; k++) {
          const a = spin * 1.45 + (k * Math.PI) / 3;
          const px = Math.cos(a) * (r * 0.46);
          const py = Math.sin(a) * (r * 0.46);
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(a + Math.PI / 2);

          ctx.fillStyle = "#E0F2FE";
          ctx.beginPath();
          ctx.moveTo(0, -15); ctx.lineTo(10, 0); ctx.lineTo(0, 15);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = "#0284C7";
          ctx.beginPath();
          ctx.moveTo(0, -15); ctx.lineTo(-10, 0); ctx.lineTo(0, 15);
          ctx.closePath();
          ctx.fill();

          ctx.strokeStyle = "#FFFFFF";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(0, -15); ctx.lineTo(10, 0); ctx.lineTo(0, 15); ctx.lineTo(-10, 0);
          ctx.closePath();
          ctx.stroke();
          ctx.restore();
        }

        // 5. 外排 8 枚（逆時針交錯）：巨型雙色切面高聳冰山稜柱
        for (let k = 0; k < 8; k++) {
          const a = -spin * 0.85 + (k * Math.PI) / 4 + 0.39;
          const px = Math.cos(a) * (r * 0.82);
          const py = Math.sin(a) * (r * 0.82);
          const spireH = 36 * Math.min(1, prog * 2.4);
          ctx.save();
          ctx.translate(px, py);

          // 右暗面（深海冰藍）
          ctx.fillStyle = "#0284C7";
          ctx.strokeStyle = "#0F172A";
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.moveTo(0, -spireH);
          ctx.lineTo(15, 5);
          ctx.lineTo(0, 12);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // 左亮面（極光白藍）
          ctx.fillStyle = "#E0F2FE";
          ctx.beginPath();
          ctx.moveTo(0, -spireH);
          ctx.lineTo(-15, 5);
          ctx.lineTo(0, 12);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // 冰稜腰線反光
          ctx.strokeStyle = "#FFFFFF";
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(-10, 2); ctx.lineTo(0, -spireH * 0.45); ctx.lineTo(10, 2);
          ctx.stroke();
          ctx.restore();
        }
      } else if (hz.kind === "psychic_blackhole") {
        // 【精神強念領域（融合 V10 超夢次元崩解）】：空間重力坍縮環 ＋ 8 向次元切割光束 ＋ 終端四芒星與鏡面菱片
        ctx.translate(sx, sy);
        const alpha = Math.min(1, hz.timer * 1.25);
        ctx.globalAlpha = alpha;
        const curR = Math.max(36, hz.radius * Math.min(1, prog * 1.8));
        const spin = -now * 1.6;

        // 1. 通透化次元暗物質漸層底盤（保留中央 38px 淨空，大幅降低遮擋）
        const grad = ctx.createRadialGradient(0, 0, 36, 0, 0, curR);
        grad.addColorStop(0, "rgba(15, 23, 42, 0.0)");
        grad.addColorStop(0.30, "rgba(59, 7, 100, 0.36)");
        grad.addColorStop(0.70, "rgba(192, 132, 252, 0.22)");
        grad.addColorStop(1, "rgba(244, 114, 182, 0.0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, curR, 0, Math.PI * 2);
        ctx.fill();

        // 2. 纖細空間重力幾何外環
        ctx.strokeStyle = "rgba(244, 114, 182, 0.52)";
        ctx.lineWidth = 1.8;
        ctx.setLineDash([10, 8]);
        ctx.beginPath();
        ctx.arc(0, 0, curR * 0.82, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // 3. 6 道纖細次元星軌絲線 (由 8 條 7px 粗光柱瘦身為 6 條 2.8px 通透絲線)
        for (let b = 0; b < 6; b++) {
          const a = spin * 0.65 + (b * Math.PI) / 3;
          const sx0 = Math.cos(a) * 38, sy0 = Math.sin(a) * 38;
          const ex = Math.cos(a) * (curR * 0.86), ey = Math.sin(a) * (curR * 0.86);

          ctx.strokeStyle = "rgba(192, 132, 252, 0.42)";
          ctx.lineWidth = 2.8;
          ctx.beginPath();
          ctx.moveTo(sx0, sy0); ctx.lineTo(ex, ey);
          ctx.stroke();

          ctx.strokeStyle = "rgba(255, 255, 255, 0.78)";
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(sx0, sy0); ctx.lineTo(ex, ey);
          ctx.stroke();

          // 射線終端四芒星與折射鏡面菱片
          ctx.save();
          ctx.translate(ex, ey);
          ctx.rotate(-spin * 1.5);
          ctx.fillStyle = "#FFFFFF";
          ctx.strokeStyle = "#EC4899";
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(0, -8); ctx.lineTo(5, 0); ctx.lineTo(0, 8); ctx.lineTo(-5, 0);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }

        // 4. 地面暗影投影（對應高空反重力懸浮碎石與次元鏡面，拉開空間高度差）
        for (let s = 0; s < 7; s++) {
          const orbAng = -spin * 0.45 + (s * Math.PI * 2) / 7;
          const orbR = Math.max(54, curR * (0.48 + (s % 3) * 0.17));
          const shX = Math.cos(orbAng) * orbR;
          const shY = Math.sin(orbAng) * orbR;
          ctx.fillStyle = "rgba(15, 7, 32, 0.36)";
          ctx.beginPath();
          ctx.ellipse(shX, shY + 4, 9, 4, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (hz.kind === "psy_delayed_blast") {
        // 精神擊破終點輕量化微縮念力星環（視覺縮小 45% 並半透明化，不搶主畫面）
        ctx.translate(sx, sy);
        ctx.globalAlpha = (1 - prog) * 0.55;
        const shrink = Math.max(0.15, (1 - prog) * 0.55);
        ctx.strokeStyle = "#EC4899";
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.arc(0, 0, hz.radius * shrink, 0, Math.PI * 2);
        ctx.stroke();
      } else if (hz.kind === "dragon_wave") {
        ctx.translate(sx, sy + 15);
        ctx.rotate(hz.angle || 0);
        ctx.globalAlpha = Math.max(0, (hz.timer / hz.maxTime) * 0.30);
        const isMegaD = !!hz.isMegaCharizardX;
        const isKingD = !!hz.isDragoniteKing;
        ctx.fillStyle = isMegaD ? "rgba(56, 189, 248, 0.45)" : (isKingD ? "rgba(250, 204, 21, 0.42)" : "rgba(99, 102, 241, 0.38)");
        ctx.beginPath();
        ctx.ellipse(0, 0, hz.radius * 0.78, hz.radius * 0.30, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (hz.kind === "drifting_daimonji") {
        // 【大字爆炎（底層 Z 軸投影）】：向下偏移 12px 的暗紅焦黑『大』字烙印，撐開空中烈焰懸浮立體感
        ctx.translate(sx, sy + 12);
        ctx.rotate(hz.angle || 0);
        const alpha = Math.min(1, hz.timer * 1.3);
        ctx.globalAlpha = alpha * 0.62;
        const r = hz.radius * 0.88;

        const scorchGrad = ctx.createRadialGradient(0, 0, r * 0.15, 0, 0, r * 1.05);
        scorchGrad.addColorStop(0, "rgba(69, 10, 10, 0.72)");
        scorchGrad.addColorStop(0.65, "rgba(154, 52, 18, 0.34)");
        scorchGrad.addColorStop(1, "rgba(15, 23, 42, 0)");
        ctx.fillStyle = scorchGrad;
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 1.05, r * 0.85, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "rgba(28, 10, 6, 0.75)";
        ctx.lineWidth = 14;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(-r * 0.75, -r * 0.18); ctx.lineTo(r * 0.75, -r * 0.18);
        ctx.moveTo(0, -r * 0.82); ctx.lineTo(-r * 0.12, r * 0.05); ctx.lineTo(-r * 0.74, r * 0.74);
        ctx.moveTo(0, -r * 0.18); ctx.lineTo(r * 0.25, r * 0.25); ctx.lineTo(r * 0.74, r * 0.74);
        ctx.stroke();
      }
      ctx.restore();
    });

    // 地面層近戰特效：地震（前 0.13s 瞬爆撕裂 ＋ 後 0.32s 定格漸隱 ＋ 不規則樹狀龜裂 ＋ 飛沙震波環）
    this.meleeEffects.forEach(m => {
      if (m.style !== "quake_wave") return;
      if (!m.cracks) m.cracks = this.buildQuakeCrackTree(6, m.radius, false);
      const maxT = m.maxTime || 0.45;
      const elapsed = maxT - m.timer;
      const prog = Math.max(0, Math.min(1, elapsed / maxT));
      const burstT = Math.min(1, elapsed / 0.13);
      const tearProg = 1 - Math.pow(1 - burstT, 3); // 前 130ms 極速撕裂至 100%
      const fadeAlpha = prog < 0.30 ? 1.0 : Math.max(0, 1 - (prog - 0.30) / 0.70);

      const msx = toSx(m.x), msy = toSy(m.y);
      const curR = m.radius * (0.22 + tearProg * 0.78);
      const innerR = curR * 0.56;

      ctx.save();
      ctx.translate(msx, msy);
      ctx.globalAlpha = fadeAlpha;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // 1. 核心陷坑陰影底盤
      const coreGrad = ctx.createRadialGradient(0, 0, 14, 0, 0, innerR);
      coreGrad.addColorStop(0, "rgba(69, 26, 3, 0.0)");
      coreGrad.addColorStop(0.55, "rgba(120, 53, 15, 0.34)");
      coreGrad.addColorStop(1, "rgba(69, 26, 3, 0.0)");
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(0, 0, innerR, 0, Math.PI * 2);
      ctx.fill();

      // 2. 瞬爆擴散的飛沙塵土震波環（柔和淡金＋暖沙外圈）
      const ringAlpha = Math.max(0, (1 - prog * 1.15) * 0.75);
      if (ringAlpha > 0.02) {
        ctx.strokeStyle = `rgba(253, 230, 138, ${ringAlpha})`;
        ctx.lineWidth = Math.max(1.5, 6.5 * (1 - prog * 0.75));
        ctx.beginPath();
        ctx.arc(0, 0, curR * 1.02, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = `rgba(217, 119, 6, ${ringAlpha * 0.85})`;
        ctx.lineWidth = Math.max(1.0, 2.5 * (1 - prog * 0.75));
        ctx.beginPath();
        ctx.arc(0, 0, innerR, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 3. 5～7 條不規則樹狀龜裂（由中心向外極速撕裂，根部 8px ➔ 末端 1.5px 自然收尖）
      const glowFade = Math.max(0.25, 1 - prog * 0.85);
      const segs = m.cracks.segments;
      for (let k = 0; k < segs.length; k++) {
        const sg = segs[k];
        if (tearProg <= sg.t0) continue;
        const localFrac = Math.min(1, (tearProg - sg.t0) / Math.max(0.01, sg.t1 - sg.t0));
        const ex = sg.x1 + (sg.x2 - sg.x1) * localFrac;
        const ey = sg.y1 + (sg.y2 - sg.y1) * localFrac;
        const baseW = (sg.isSub ? 4.4 : 8.4) * sg.wMul;

        ctx.strokeStyle = "#2A1205";
        ctx.lineWidth = Math.max(1.4, baseW);
        ctx.beginPath();
        ctx.moveTo(sg.x1, sg.y1);
        ctx.lineTo(ex, ey);
        ctx.stroke();

        if (baseW > 2.2) {
          ctx.strokeStyle = `rgba(234, 88, 12, ${0.88 * glowFade})`;
          ctx.lineWidth = Math.max(1.0, baseW * 0.44);
          ctx.beginPath();
          ctx.moveTo(sg.x1, sg.y1);
          ctx.lineTo(ex, ey);
          ctx.stroke();
        }

        if (!sg.isSub && sg.wMul > 0.45) {
          ctx.strokeStyle = `rgba(254, 240, 138, ${0.85 * glowFade})`;
          ctx.lineWidth = Math.max(0.9, baseW * 0.18);
          ctx.beginPath();
          ctx.moveTo(sg.x1, sg.y1);
          ctx.lineTo(ex, ey);
          ctx.stroke();
        }
      }

      // 4. 轉折處彈起後回落的雙色斜切面崩岩碎石
      const hopCurve = Math.sin(Math.min(1, prog * 1.25) * Math.PI);
      m.cracks.rocks.forEach(rk => {
        if (tearProg < 0.35) return;
        const hop = hopCurve * (rk.hopH || 14);
        const rw = rk.w || 7;
        const rh = rk.h || 10;
        ctx.save();
        ctx.translate(rk.x, rk.y - hop);
        ctx.fillStyle = "#78350F";
        ctx.strokeStyle = "#231006";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(0, -rh); ctx.lineTo(rw, 2); ctx.lineTo(0, 5);
        ctx.closePath();
        ctx.fill(); ctx.stroke();

        ctx.fillStyle = "#F59E0B";
        ctx.beginPath();
        ctx.moveTo(0, -rh); ctx.lineTo(-rw, 2); ctx.lineTo(0, 5);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.restore();
      });

      ctx.restore();
    });

    // 地面底層：終極衝擊 (giga_impact_lance) 與撞擊 (sonic_cone) 的地面犁地焦黑溝槽與 Z 軸投影暗影
    this.meleeEffects.forEach(m => {
      if (m.style !== "giga_impact_lance" && m.style !== "sonic_cone" && m.style !== "phantom_tackle" && m.style !== "hydro_pump_beam" && m.style !== "flamethrower_beam" && m.style !== "ice_beam_laser") return;
      if (m.style === "flamethrower_beam") {
        const prog = Math.max(0, Math.min(1, 1 - (m.timer / (m.maxTime || 0.38))));
        const extendFrac = Math.min(1, prog / 0.24);
        const curLen = m.length * extendFrac;
        const wFade = prog < 0.72 ? 1.0 : Math.max(0.1, (1 - prog) / 0.28);
        const endW = (m.endHalfW || 32) * wFade;
        const osx = toSx(m.ox), osy = toSy(m.oy);
        ctx.save();
        ctx.translate(osx, osy + 12);
        ctx.rotate(m.angle || 0);
        ctx.globalAlpha = Math.max(0, (1 - prog * 0.72) * 0.36);
        const scGrad = ctx.createLinearGradient(0, 0, curLen, 0);
        scGrad.addColorStop(0, "rgba(185, 28, 28, 0.55)");
        scGrad.addColorStop(0.65, "rgba(234, 88, 12, 0.42)");
        scGrad.addColorStop(1, "rgba(250, 204, 21, 0.0)");
        ctx.fillStyle = scGrad;
        ctx.beginPath();
        ctx.moveTo(0, -10);
        ctx.lineTo(curLen, -endW * 1.05);
        ctx.lineTo(curLen + 14, 0);
        ctx.lineTo(curLen, endW * 1.05);
        ctx.lineTo(0, 10);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        return;
      }
      if (m.style === "ice_beam_laser") {
        const prog = Math.max(0, Math.min(1, 1 - (m.timer / (m.maxTime || 0.32))));
        const extendFrac = Math.min(1, prog / 0.16);
        const curLen = m.length * extendFrac;
        const wFade = prog < 0.70 ? 1.0 : Math.max(0.1, (1 - prog) / 0.30);
        const halfW = (m.width || 16) * 0.58 * wFade;
        const osx = toSx(m.ox), osy = toSy(m.oy);
        ctx.save();
        ctx.translate(osx, osy + 12);
        ctx.rotate(m.angle || 0);
        ctx.globalAlpha = Math.max(0, (1 - prog * 0.75) * 0.34);
        ctx.fillStyle = "rgba(56, 189, 248, 0.48)";
        ctx.beginPath();
        ctx.ellipse(curLen * 0.5, 0, curLen * 0.52, halfW * 1.15, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        return;
      }
      if (m.style === "hydro_pump_beam") {
        const prog = Math.max(0, Math.min(1, 1 - (m.timer / (m.maxTime || 0.36))));
        const extendFrac = Math.min(1, prog / 0.22);
        const curLen = m.length * extendFrac;
        const wScale = prog < 0.72 ? 1.0 : Math.max(0.1, (1 - prog) / 0.28);
        const halfW = (m.width || 22) * 0.55 * wScale;
        const osx = toSx(m.ox), osy = toSy(m.oy);
        ctx.save();
        ctx.translate(osx, osy + 12);
        ctx.rotate(m.angle || 0);
        ctx.globalAlpha = Math.max(0, (1 - prog * 0.75) * 0.38);
        ctx.fillStyle = "rgba(3, 105, 161, 0.52)";
        ctx.beginPath();
        ctx.ellipse(curLen * 0.5, 0, curLen * 0.52, halfW * 1.15, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(186, 230, 253, 0.65)";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.ellipse(curLen, 0, halfW * 0.9 + prog * 14, halfW * 1.45 + prog * 16, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        return;
      }
      if (m.style === "phantom_tackle") {
        const prog = Math.max(0, Math.min(1, 1 - (m.timer / (m.maxTime || 0.24))));
        const ease = 1 - Math.pow(1 - Math.min(1, prog * 1.45), 3);
        const curX = toSx(m.ox + (m.x - m.ox) * ease);
        const curY = toSy(m.oy + (m.y - m.oy) * ease);
        ctx.save();
        ctx.translate(curX, curY + 14);
        ctx.rotate(m.angle || 0);
        ctx.globalAlpha = Math.max(0, (1 - prog) * 0.42);
        ctx.fillStyle = "rgba(15, 23, 42, 0.52)";
        ctx.beginPath();
        ctx.ellipse(0, 0, m.radius * 0.55, m.radius * 0.30, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        return;
      }
      const prog = Math.max(0, Math.min(1, 1 - (m.timer / (m.maxTime || 0.4))));
      const osx = toSx(m.ox !== undefined ? m.ox : m.x);
      const osy = toSy(m.oy !== undefined ? m.oy : m.y);

      if (m.style === "sonic_cone") {
        const cRef = m.casterRef;
        const lungeProg = (cRef && cRef.lungeTimer > 0) ? Math.sin((1 - cRef.lungeTimer / (cRef.lungeMaxTime || 0.16)) * Math.PI) : 0;
        const lx = cRef ? Math.cos(cRef.lungeAngle || 0) * (cRef.lungeDist || 0) * lungeProg : 0;
        const ly = cRef ? Math.sin(cRef.lungeAngle || 0) * (cRef.lungeDist || 0) * lungeProg : 0;
        const baseSx = cRef ? toSx(cRef.x) + lx : osx;
        const baseSy = cRef ? toSy(cRef.y) + ly : osy;
        const curR = m.radius * (0.48 + prog * 0.42);
        ctx.save();
        ctx.translate(baseSx, baseSy + 12);
        ctx.rotate(m.angle || 0);
        ctx.globalAlpha = Math.max(0, (1 - prog) * 0.42);
        ctx.fillStyle = "rgba(15, 23, 42, 0.50)";
        ctx.beginPath();
        ctx.ellipse(6, 0, curR * 0.46, curR * 0.28, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        return;
      }

      const curLen = Math.max(16, m.radius * Math.min(1, prog * 1.55));
      const maxW = 38 * (1 - prog * 0.20);
      ctx.save();
      ctx.translate(osx, osy + 11); // 向下偏移 11px 作為地面投射陰影，拉開 Z 軸立體高度差
      ctx.rotate(m.angle || 0);
      ctx.globalAlpha = Math.max(0, 1 - prog * 0.62);

      // 1. 外層地面犁地震波暗影
      ctx.fillStyle = "rgba(15, 23, 42, 0.46)";
      ctx.beginPath();
      ctx.ellipse(curLen * 0.52, 0, curLen * 0.50, maxW * 0.76, 0, 0, Math.PI * 2);
      ctx.fill();

      // 2. 內層焦黑裂地溝槽與金紅餘燼邊緣
      ctx.fillStyle = "rgba(69, 26, 3, 0.72)";
      ctx.strokeStyle = "rgba(217, 119, 6, 0.65)";
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(10, -maxW * 0.42);
      ctx.lineTo(curLen * 0.94, 0);
      ctx.lineTo(10, maxW * 0.42);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 3. 溝槽兩側翻起的雙色立體碎石塊
      for (let rIdx = 1; rIdx <= 3; rIdx++) {
        const rx = curLen * (0.22 * rIdx);
        const side = rIdx % 2 === 0 ? 1 : -1;
        const ry = side * (maxW * 0.48);
        ctx.fillStyle = "#78350F";
        ctx.strokeStyle = "#291509";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(rx, ry - 4);
        ctx.lineTo(rx + 6, ry + 2);
        ctx.lineTo(rx - 4, ry + 4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    });
  },

  // ==========================================================================
  // 圖層 2：空中與特效層渲染 (renderAerialLayer) — 具象化招式與超武，嚴守 30px 主角淨空區
  // ==========================================================================
  renderAerialLayer(ctx, toSx, toSy) {
    const now = performance.now() * 0.004;

    // 1. 空中持續特效 (龍捲風、月光聖柱、推進式立體大字爆炎、比卡超天罰雷柱風暴、下墜隕石、次元龍魂波)
    this.groundHazards.forEach(hz => {
      if (hz.kind === "meteor_strike" && hz.delay > 0) return;
      const sx = toSx(hz.x), sy = toSy(hz.y);
      const prog = Math.max(0, Math.min(1, 1 - (hz.timer / (hz.maxTime || 0.45))));
      ctx.save();

      if (hz.kind === "moon_pillar") {
        // 【月亮之力・3D 螺旋星落月光聖柱】：地面雙層旋轉月相陣 ＋ 雙股螺旋上升星軌光帶 ＋ 頂端新月聖徽
        const alpha = Math.min(1, Math.sin((1 - prog) * Math.PI) * 1.15);
        const r = hz.radius;
        ctx.translate(sx, sy);

        // 1. 地面雙層月華星陣與內縮脈動波
        const baseGrad = ctx.createRadialGradient(0, 0, r * 0.1, 0, 0, r);
        baseGrad.addColorStop(0, `rgba(254, 240, 138, ${alpha * 0.55})`);
        baseGrad.addColorStop(0.6, `rgba(244, 114, 182, ${alpha * 0.42})`);
        baseGrad.addColorStop(1, "rgba(131, 24, 67, 0)");
        ctx.fillStyle = baseGrad;
        ctx.beginPath();
        ctx.ellipse(0, 0, r, r * 0.56, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = `rgba(244, 114, 182, ${alpha * 0.95})`;
        ctx.lineWidth = 3.0;
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 0.92, r * 0.52, 0, 0, Math.PI * 2);
        ctx.stroke();

        const pulseR = r * (0.35 + ((now * 1.8) % 0.65));
        ctx.strokeStyle = `rgba(254, 240, 138, ${alpha * 0.85})`;
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.ellipse(0, 0, pulseR, pulseR * 0.52, 0, 0, Math.PI * 2);
        ctx.stroke();

        // 2. 錐形漸層立體月光主柱與純白月芯
        const pillarH = 195;
        const grad = ctx.createLinearGradient(0, 0, 0, -pillarH);
        grad.addColorStop(0, `rgba(244, 114, 182, ${alpha * 0.72})`);
        grad.addColorStop(0.55, `rgba(253, 224, 71, ${alpha * 0.48})`);
        grad.addColorStop(1, "rgba(255, 255, 255, 0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(-r * 0.68, 0);
        ctx.lineTo(-r * 0.42, -pillarH);
        ctx.lineTo(r * 0.42, -pillarH);
        ctx.lineTo(r * 0.68, 0);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.78})`;
        ctx.beginPath();
        ctx.moveTo(-r * 0.24, 0);
        ctx.lineTo(-r * 0.10, -pillarH * 0.92);
        ctx.lineTo(r * 0.10, -pillarH * 0.92);
        ctx.lineTo(r * 0.24, 0);
        ctx.closePath();
        ctx.fill();

        // 3. 環繞光柱高速盤旋上升的雙股粉金星軌絲帶 (Double Helix Ribbons)
        for (let strand = 0; strand < 2; strand++) {
          ctx.strokeStyle = strand === 0 ? `rgba(254, 240, 138, ${alpha * 0.92})` : `rgba(244, 114, 182, ${alpha * 0.92})`;
          ctx.lineWidth = 2.6;
          ctx.beginPath();
          for (let h = 0; h <= pillarH * 0.85; h += 10) {
            const t = h / pillarH;
            const curW = r * (0.62 - t * 0.25);
            const ang = now * 2.4 + h * 0.055 + strand * Math.PI;
            const hx = Math.cos(ang) * curW;
            const hy = -h + Math.sin(ang) * (curW * 0.25);
            if (h === 0) ctx.moveTo(hx, hy);
            else ctx.lineTo(hx, hy);
          }
          ctx.stroke();
        }

        // 4. 光柱頂端懸浮的立體黃金新月聖徽 (Crescent Moon Crest)
        const crestY = -pillarH * 0.78 + Math.sin(now * 3.5) * 6;
        ctx.fillStyle = `rgba(254, 240, 138, ${alpha * 0.95})`;
        ctx.strokeStyle = `rgba(217, 119, 6, ${alpha * 0.9})`;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(0, crestY, 15, -Math.PI * 0.35, Math.PI * 0.85);
        ctx.arc(6, crestY - 3, 12, Math.PI * 0.75, -Math.PI * 0.25, true);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (hz.kind === "genesis_aurora") {
        // 【創世極光（高空層）】：頭頂高空浮現皎潔立體滿月虛影 ＋ 傾瀉而下的雙色垂直極光天幕
        ctx.translate(sx, sy);
        const alpha = Math.sin((1 - prog) * Math.PI) * 0.85;
        ctx.globalAlpha = alpha;
        const moonY = -165;

        // 1. 垂直傾瀉極光布幕 (粉金 ➔ 冰青 ➔ 透明)
        const curtainGrad = ctx.createLinearGradient(0, moonY, 0, 10);
        curtainGrad.addColorStop(0, "rgba(254, 240, 138, 0.55)");
        curtainGrad.addColorStop(0.5, "rgba(244, 114, 182, 0.32)");
        curtainGrad.addColorStop(1, "rgba(56, 189, 248, 0.0)");
        ctx.fillStyle = curtainGrad;
        ctx.beginPath();
        ctx.moveTo(-45, moonY);
        ctx.lineTo(45, moonY);
        ctx.lineTo(hz.radius * 0.65, 10);
        ctx.lineTo(-hz.radius * 0.65, 10);
        ctx.closePath();
        ctx.fill();

        // 2. 高空皎潔滿月外暈與立體環形山紋理
        const haloGrad = ctx.createRadialGradient(0, moonY, 10, 0, moonY, 54);
        haloGrad.addColorStop(0, "rgba(254, 249, 195, 0.95)");
        haloGrad.addColorStop(0.55, "rgba(244, 114, 182, 0.45)");
        haloGrad.addColorStop(1, "rgba(244, 114, 182, 0)");
        ctx.fillStyle = haloGrad;
        ctx.beginPath();
        ctx.arc(0, moonY, 54, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#FEF9C3";
        ctx.strokeStyle = "#FDE047";
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(0, moonY, 26, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // 月面淺影紋理
        ctx.fillStyle = "rgba(250, 204, 21, 0.35)";
        ctx.beginPath();
        ctx.arc(-8, moonY - 5, 6, 0, Math.PI * 2);
        ctx.arc(9, moonY + 7, 8, 0, Math.PI * 2);
        ctx.arc(5, moonY - 9, 4, 0, Math.PI * 2);
        ctx.fill();

      } else if (hz.kind === "tornado") {
        // 【暴風驟雨・3層立體流體龍捲風柱】：底層吸塵渦流 ＋ 錐形半透明流體風柱與交織S風帶 ＋ 環繞月牙風刃與飛葉
        ctx.translate(sx, sy);
        ctx.globalAlpha = Math.min(1, hz.timer * 1.25);

        // 1. 地面風眼吸塵暗影與高速旋轉氣流圈
        ctx.fillStyle = "rgba(15, 23, 42, 0.42)";
        ctx.beginPath();
        ctx.ellipse(0, 6, hz.radius * 0.78, hz.radius * 0.36, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "rgba(186, 230, 253, 0.75)";
        ctx.lineWidth = 2.4;
        for (let g = 0; g < 3; g++) {
          const gAng = -now * 5.5 + (g * Math.PI * 2) / 3;
          ctx.beginPath();
          ctx.ellipse(0, 4, hz.radius * 0.62, hz.radius * 0.28, 0, gAng, gAng + 1.2);
          ctx.stroke();
        }

        // 2. 中層：由下往上漸寬的錐形半透明流體風柱主體
        const topSway = Math.sin(now * 4.5) * 9;
        const funnelGrad = ctx.createLinearGradient(0, 8, topSway, -92);
        funnelGrad.addColorStop(0, "rgba(51, 65, 85, 0.65)");
        funnelGrad.addColorStop(0.5, "rgba(148, 163, 184, 0.48)");
        funnelGrad.addColorStop(1, "rgba(224, 242, 254, 0.20)");
        ctx.fillStyle = funnelGrad;
        ctx.beginPath();
        ctx.moveTo(-14, 6);
        ctx.quadraticCurveTo(-28, -42, -52 + topSway, -88);
        ctx.ellipse(topSway, -88, 52, 16, 0, Math.PI, 0, true);
        ctx.quadraticCurveTo(28, -42, 14, 6);
        ctx.closePath();
        ctx.fill();

        // 3. 交織上升的 S 型螺旋流線風帶與外圍月牙風刃
        for (let levelIdx = 0; levelIdx < 7; levelIdx++) {
          const t = levelIdx / 6;
          const rY = 4 - t * 88;
          const rRadX = 15 + t * 38;
          const rRadY = rRadX * 0.34;
          const swayX = Math.sin(now * 5 + levelIdx * 0.7) * (3 + t * 6);

          ctx.save();
          ctx.translate(swayX, rY);
          const rot = now * (4.2 - t * 1.0) + levelIdx * 1.15;
          ctx.strokeStyle = levelIdx % 2 === 0 ? "#E0F2FE" : "#38BDF8";
          ctx.lineWidth = 3.2 - t * 0.8;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.ellipse(0, 0, rRadX, rRadY, 0, rot, rot + Math.PI * 1.25);
          ctx.stroke();

          ctx.strokeStyle = "#FFFFFF";
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.ellipse(0, 0, rRadX * 0.88, rRadY * 0.88, 0, rot + 0.3, rot + Math.PI * 0.85);
          ctx.stroke();

          // 風暴外圍捲起的翠綠飛葉
          if (levelIdx % 2 === 1) {
            const leafX = Math.cos(rot + 1.8) * (rRadX + 8);
            const leafY = Math.sin(rot + 1.8) * (rRadY + 4);
            ctx.fillStyle = "#4ADE80";
            ctx.beginPath();
            ctx.ellipse(leafX, leafY, 4.5, 2.2, rot, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }

        // 4. 龍捲風頂端旋轉深灰風暴雲蓋（沿用雷系積雨雲三階明暗體積畫法）
        ctx.save();
        const capX = topSway + Math.cos(now * 3.8) * 3;
        const capY = -92;
        ctx.fillStyle = "#0F172A";
        ctx.beginPath();
        ctx.roundRect(capX - 38, capY - 2, 76, 15, 7);
        ctx.arc(capX - 24, capY + 2, 13, 0, Math.PI * 2);
        ctx.arc(capX + 24, capY + 2, 13, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#1E293B";
        ctx.beginPath();
        ctx.arc(capX - 26, capY - 4, 14, 0, Math.PI * 2);
        ctx.arc(capX + 25, capY - 3, 13, 0, Math.PI * 2);
        ctx.arc(capX - 10, capY - 11, 17, 0, Math.PI * 2);
        ctx.arc(capX + 12, capY - 9, 15, 0, Math.PI * 2);
        ctx.arc(capX + 1, capY - 14, 15, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#334155";
        ctx.beginPath();
        ctx.arc(capX - 10, capY - 12, 12, 0, Math.PI * 2);
        ctx.arc(capX + 8, capY - 11, 11, 0, Math.PI * 2);
        ctx.arc(capX, capY - 15, 12, 0, Math.PI * 2);
        ctx.fill();

        // 雲蓋受光銀灰弧邊與頂端氣流漩渦線
        ctx.strokeStyle = "rgba(224, 242, 254, 0.72)";
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(capX - 10, capY - 12, 11.5, Math.PI * 1.1, Math.PI * 1.75);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(capX, capY - 15, 11.5, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
        ctx.restore();
      } else if (hz.kind === "dragon_wave") {
        // 【龍之俯衝（龍魂附身・三段階梯殘影）】：3 連階梯精靈殘像 ＋ 龍首內嵌前撲剪影 ＋ 快龍金焰 / Mega X 蒼藍冥炎
        const lifeAlpha = Math.max(0, hz.timer / hz.maxTime);
        const r = hz.radius;
        const isKing = !!hz.isDragoniteKing;
        const isMegaX = !!hz.isMegaCharizardX;
        const sprRec = hz.spriteUrl ? (hz.isShiny ? SpriteCache.getShiny(hz.spriteUrl) : SpriteCache.get(hz.spriteUrl)) : null;
        const trailTint = isMegaX ? "#00F0FF" : (isKing ? "#FACC15" : "#38BDF8");

        // 0. 方案 A：加法發光混合 (lighter) 3 連純能量靈體殘影（徹底消除棕色木橋上的灰褐泥印）
        if (sprRec && sprRec.loaded && hz.afterimages && hz.afterimages.length > 0) {
          const alphas = [0.18, 0.32, 0.48];
          const scales = [0.82, 0.92, 1.02];
          const leanAngle = (hz.facingX > 0 ? 0.24 : -0.24);
          const totalAI = hz.afterimages.length;
          for (let ai = 0; ai < totalAI; ai++) {
            const pt = hz.afterimages[ai];
            const idxMap = Math.min(2, ai + (3 - totalAI));
            const asx = toSx(pt.x), asy = toSy(pt.y) - 6;
            ctx.save();
            ctx.globalCompositeOperation = "lighter";
            ctx.translate(asx, asy);
            ctx.rotate(leanAngle);
            ctx.scale((hz.facingX > 0 ? -1 : 1) * scales[idxMap] * 1.14, scales[idxMap] * 0.88);
            GameApp.drawSilhouetteFlash(ctx, sprRec.img, -24, -22, 48, 48, trailTint, lifeAlpha * alphas[idxMap]);
            ctx.restore();
          }
        }

        // 主體抬升 6px 與地面暗影拉開俯衝高度差
        ctx.save();
        ctx.translate(sx, sy - 6);

        ctx.save();
        ctx.rotate(hz.angle || 0);
        ctx.globalAlpha = lifeAlpha;

        // 【方案一：流線貝茲真・龍首氣場 ＋ 破空 V 字音爆 ＋ 動態鋸齒電弧】
        const dWave = Math.sin(now * 16 + hz.x * 0.04) * 3.5;
        const gradMain = ctx.createLinearGradient(-r * 1.0, 0, r * 1.15, 0);
        if (isMegaX) {
          gradMain.addColorStop(0, "rgba(14, 116, 144, 0.18)");
          gradMain.addColorStop(0.45, "rgba(2, 132, 199, 0.52)");
          gradMain.addColorStop(1, "rgba(34, 211, 238, 0.85)");
        } else if (isKing) {
          gradMain.addColorStop(0, "rgba(180, 83, 9, 0.18)");
          gradMain.addColorStop(0.45, "rgba(234, 88, 12, 0.52)");
          gradMain.addColorStop(1, "rgba(250, 204, 21, 0.86)");
        } else {
          gradMain.addColorStop(0, "rgba(49, 46, 129, 0.18)");
          gradMain.addColorStop(0.45, "rgba(56, 189, 248, 0.50)");
          gradMain.addColorStop(1, "rgba(103, 232, 249, 0.84)");
        }
        const edgeCol = isMegaX ? "#67E8F9" : (isKing ? "#FEF08A" : "#7DD3FC");
        const hornCol = isMegaX ? "#0F172A" : (isKing ? "#9A3412" : "#1E1B4B");
        const eyeCol  = isMegaX ? "#EF4444" : (isKing ? "#38BDF8" : "#FACC15");

        // 1. 飄逸龍鬃焰尾（3 股貝茲流動龍氣鬃毛向後翻捲）
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        for (let m = -1; m <= 1; m++) {
          const my = m * r * 0.24;
          const tailWag = Math.sin(now * 18 + m * 2.1) * 5.5;
          ctx.fillStyle = isMegaX
            ? (m === 0 ? "rgba(34, 211, 238, 0.42)" : "rgba(37, 99, 235, 0.34)")
            : (isKing
                ? (m === 0 ? "rgba(250, 204, 21, 0.42)" : "rgba(234, 88, 12, 0.34)")
                : (m === 0 ? "rgba(56, 189, 248, 0.40)" : "rgba(99, 102, 241, 0.32)"));
          ctx.beginPath();
          ctx.moveTo(r * 0.15, my - r * 0.12);
          ctx.quadraticCurveTo(-r * 0.45, my - r * 0.28 + tailWag, -r * (1.05 - Math.abs(m) * 0.16), my + tailWag * 1.4);
          ctx.quadraticCurveTo(-r * 0.45, my + r * 0.24 + tailWag, r * 0.15, my + r * 0.12);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();

        // 2. 有機貝茲龍首本體（修長龍吻 ＋ 微張尖牙下顎 ＋ 雙側後掠龍角）
        ctx.fillStyle = gradMain;
        ctx.strokeStyle = edgeCol;
        ctx.lineWidth = 2.4;
        ctx.lineJoin = "round";
        ctx.beginPath();
        // 龍吻上緣
        ctx.moveTo(r * 1.06, -r * 0.04);
        ctx.quadraticCurveTo(r * 0.72, -r * 0.26, r * 0.34, -r * 0.34);
        // 上龍角外廓（流線後掠收尖）
        ctx.quadraticCurveTo(-r * 0.05, -r * 0.56, -r * 0.46, -r * 0.66);
        ctx.quadraticCurveTo(-r * 0.26, -r * 0.36, -r * 0.18, -r * 0.22);
        // 龍頸後收
        ctx.quadraticCurveTo(-r * 0.52, -r * 0.08, -r * 0.64, 0);
        ctx.quadraticCurveTo(-r * 0.52, r * 0.08, -r * 0.18, r * 0.22);
        // 下龍角外廓
        ctx.quadraticCurveTo(-r * 0.26, r * 0.36, -r * 0.46, r * 0.66);
        ctx.quadraticCurveTo(-r * 0.05, r * 0.56, r * 0.34, r * 0.34);
        // 龍吻下緣（微張尖牙感）
        ctx.quadraticCurveTo(r * 0.72, r * 0.26, r * 1.06, r * 0.04);
        ctx.quadraticCurveTo(r * 1.14, 0, r * 1.06, -r * 0.04);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 雙龍角深色實質角稜與高光脊
        [-1, 1].forEach(side => {
          ctx.fillStyle = hornCol;
          ctx.strokeStyle = edgeCol;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(r * 0.24, side * r * 0.28);
          ctx.quadraticCurveTo(-r * 0.06, side * r * 0.52, -r * 0.44, side * r * 0.64);
          ctx.quadraticCurveTo(-r * 0.16, side * r * 0.34, r * 0.06, side * r * 0.20);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        });

        // 龍吻尖牙與鼻樑高光脊線
        ctx.strokeStyle = "rgba(255, 255, 255, 0.78)";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(r * 1.02, 0);
        ctx.lineTo(r * 0.22, 0);
        ctx.stroke();

        ctx.fillStyle = "#FFFFFF";
        [-1, 1].forEach(side => {
          ctx.beginPath();
          ctx.moveTo(r * 0.88, side * r * 0.10);
          ctx.lineTo(r * 0.78, side * r * 0.19);
          ctx.lineTo(r * 0.72, side * r * 0.11);
          ctx.closePath();
          ctx.fill();
        });

        // 3. 凌厲斜挑龍眉與發光龍睛
        [-1, 1].forEach(side => {
          ctx.fillStyle = "#0F172A";
          ctx.beginPath();
          ctx.moveTo(r * 0.58, side * r * 0.12);
          ctx.lineTo(r * 0.34, side * r * 0.26);
          ctx.lineTo(r * 0.24, side * r * 0.16);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = eyeCol;
          ctx.beginPath();
          ctx.moveTo(r * 0.54, side * r * 0.13);
          ctx.lineTo(r * 0.36, side * r * 0.23);
          ctx.lineTo(r * 0.30, side * r * 0.16);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = "#FFFFFF";
          ctx.beginPath();
          ctx.arc(r * 0.44, side * r * 0.16, 1.4, 0, Math.PI * 2);
          ctx.fill();
        });

        // 4. 動態多段鋸齒龍焰電弧（3 條緊貼龍角與龍鬃微閃，告別僵硬白棍）
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = isKing ? "#FEF08A" : "#E0F2FE";
        ctx.lineWidth = 1.8;
        ctx.lineCap = "round";
        const sparkCount = (isKing || isMegaX) ? 3 : 2;
        for (let s = 0; s < sparkCount; s++) {
          const side = s === 2 ? (Math.sin(now * 30) >= 0 ? 1 : -1) : (s === 0 ? -1 : 1);
          const jitter1 = Math.sin(now * 28 + s * 3.1) * 5;
          const jitter2 = Math.cos(now * 32 + s * 4.7) * 6;
          ctx.beginPath();
          ctx.moveTo(r * 0.46, side * r * 0.22);
          ctx.lineTo(r * 0.16, side * r * 0.42 + jitter1);
          ctx.lineTo(-r * 0.18, side * r * 0.34 + jitter2);
          ctx.lineTo(-r * 0.56, side * r * 0.54 - jitter1 * 0.8);
          ctx.stroke();
        }
        ctx.restore();

        // 5. 破空 V 字音爆（Mach Cone）＋ 速度線：由龍吻尖端向兩側後方掠出漸隱，徹底取代奇怪圓弧
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const tipX = r * 1.24;
        const wingX = -r * 0.48;
        const wingY = r * 0.96;

        // 外層蒼藍／耀金寬幅漸隱 V 字衝擊波
        const vGrad = ctx.createLinearGradient(tipX, 0, wingX, 0);
        vGrad.addColorStop(0, "rgba(255, 255, 255, 0.95)");
        vGrad.addColorStop(0.45, isKing ? "rgba(250, 204, 21, 0.72)" : "rgba(56, 189, 248, 0.72)");
        vGrad.addColorStop(1, "rgba(56, 189, 248, 0.0)");

        ctx.strokeStyle = vGrad;
        ctx.lineWidth = 6.0;
        ctx.lineCap = "round";
        ctx.lineJoin = "miter";
        ctx.beginPath();
        ctx.moveTo(wingX, -wingY);
        ctx.lineTo(tipX, 0);
        ctx.lineTo(wingX, wingY);
        ctx.stroke();

        // 內層純白銳利 V 字音爆核心刃
        const vCoreGrad = ctx.createLinearGradient(tipX, 0, wingX * 0.65, 0);
        vCoreGrad.addColorStop(0, "#FFFFFF");
        vCoreGrad.addColorStop(0.55, "rgba(224, 242, 254, 0.85)");
        vCoreGrad.addColorStop(1, "rgba(255, 255, 255, 0.0)");
        ctx.strokeStyle = vCoreGrad;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(wingX * 0.65, -wingY * 0.76);
        ctx.lineTo(tipX + 2, 0);
        ctx.lineTo(wingX * 0.65, wingY * 0.76);
        ctx.stroke();

        // 兩側平行破空速度線
        ctx.strokeStyle = "rgba(224, 242, 254, 0.55)";
        ctx.lineWidth = 1.4;
        [-1, 1].forEach(side => {
          ctx.beginPath();
          ctx.moveTo(r * 0.55, side * r * 0.56);
          ctx.lineTo(-r * 0.68, side * r * 0.78 + dWave * 0.25);
          ctx.stroke();
        });
        ctx.restore();
        ctx.restore();

        // 5. 方案 A：移除原色複製分身，改為「純能量發光靈體剪影（外層蒼藍/金焰 ＋ 內層純白熾核）」並前傾俯衝
        if (sprRec && sprRec.loaded) {
          const leanAngle = (hz.facingX > 0 ? 0.24 : -0.24);
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.rotate(leanAngle);
          ctx.scale((hz.facingX > 0 ? -1 : 1) * 1.16, 0.86);
          GameApp.drawSilhouetteFlash(ctx, sprRec.img, -25, -23, 50, 50, trailTint, lifeAlpha * 0.72);
          GameApp.drawSilhouetteFlash(ctx, sprRec.img, -20, -18, 40, 40, "#FFFFFF", lifeAlpha * 0.42);
          ctx.restore();
        }
        ctx.restore();

      } else if (hz.kind === "meteor_strike") {
        // 【天龍流星雨・4層次垂直陰影龍星美學（致敬雷系超武多層次架構）】
        const cloudX = toSx(hz.startX), cloudY = toSy(hz.startY);
        const curX = toSx(hz.startX + (hz.x - hz.startX) * prog);
        const curY = toSy(hz.startY + (hz.y - hz.startY) * prog);

        // 第 1 層：地面深邃烏雲與隕石投影（隨墜落進度擴大加深，營造強烈 Z 軸立體空間感）
        ctx.fillStyle = `rgba(15, 23, 42, ${0.28 + prog * 0.36})`;
        ctx.beginPath();
        ctx.ellipse(sx, sy, hz.radius * (0.35 + prog * 0.45), hz.radius * 0.50 * (0.35 + prog * 0.45), 0, 0, Math.PI * 2);
        ctx.fill();

        // 地面蒼藍古龍星軌鎖定圈
        ctx.strokeStyle = "rgba(56, 189, 248, 0.78)";
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.ellipse(sx, sy, hz.radius * 0.76, hz.radius * 0.40, 0, 0, Math.PI * 2);
        ctx.stroke();

        // 第 2 層：垂直貫穿天地的蒼藍龍魂光束導軌與螺旋龍氣
        const beamGrad = ctx.createLinearGradient(cloudX, cloudY, sx, sy);
        beamGrad.addColorStop(0, "rgba(67, 56, 202, 0.0)");
        beamGrad.addColorStop(0.5, "rgba(56, 189, 248, 0.32)");
        beamGrad.addColorStop(1, "rgba(250, 204, 21, 0.46)");
        ctx.fillStyle = beamGrad;
        ctx.beginPath();
        ctx.moveTo(cloudX - 10, cloudY);
        ctx.lineTo(cloudX + 10, cloudY);
        ctx.lineTo(sx + 18, sy);
        ctx.lineTo(sx - 18, sy);
        ctx.closePath();
        ctx.fill();

        // 第 3 層：墜落中的立體龍晶星核（外蒼藍、中金焰、內純白）
        ctx.save();
        ctx.translate(curX, curY);
        ctx.fillStyle = "#1E1B4B";
        ctx.strokeStyle = "#38BDF8";
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(0, 0, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#F59E0B";
        ctx.beginPath();
        ctx.arc(0, 2, 9, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#FEF08A";
        ctx.beginPath();
        ctx.arc(0, 3, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // 第 4 層：高空立體星雲暗雲簇（比照雷系積雨雲的上拱下平結構，雲肚內透出龍焰金藍光）
        ctx.save();
        ctx.translate(cloudX, cloudY);
        ctx.fillStyle = "#0F172A";
        ctx.beginPath();
        ctx.roundRect(-32, -2, 64, 16, 8);
        ctx.arc(-18, -6, 14, 0, Math.PI * 2);
        ctx.arc(18, -5, 13, 0, Math.PI * 2);
        ctx.arc(0, -12, 17, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#1E1B4B";
        ctx.beginPath();
        ctx.arc(-10, -10, 13, 0, Math.PI * 2);
        ctx.arc(10, -9, 12, 0, Math.PI * 2);
        ctx.arc(0, -15, 14, 0, Math.PI * 2);
        ctx.fill();

        const riftGlow = ctx.createRadialGradient(0, 2, 2, 0, 2, 22);
        riftGlow.addColorStop(0, "#FEF08A");
        riftGlow.addColorStop(0.5, "rgba(56, 189, 248, 0.78)");
        riftGlow.addColorStop(1, "rgba(30, 27, 75, 0)");
        ctx.fillStyle = riftGlow;
        ctx.beginPath();
        ctx.ellipse(0, 3, 22, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (hz.kind === "thunder_pillars_storm") {
        // 【比卡超超武・打雷暴風雨】：4 層立體悶雷積雨雲（上拱下平6雲簇 + 三階明暗體積 + 雲內悶雷透光 + 地面烏雲暗影）＋ 8 道垂直白熾天罰雷柱
        const elapsed = hz.maxTime - hz.timer;
        (hz.strikePts || []).forEach((pt, idx) => {
          const localAge = elapsed - pt.delay;
          if (localAge < -0.18) return;
          const px = toSx(pt.x), py = toSy(pt.y);
          const cloudY = py - 210;
          const cloudAlpha = Math.min(1, hz.timer * 1.6);

          ctx.save();
          ctx.globalAlpha = cloudAlpha;

          // 1. 地面烏雲投射暗影 (拉開高空與地面的 3D 空間距離)
          ctx.fillStyle = "rgba(15, 23, 42, 0.38)";
          ctx.beginPath();
          ctx.ellipse(px, py + 4, 38, 15, 0, 0, Math.PI * 2);
          ctx.fill();

          // 2. 落雷瞬間的垂直三層白熾天罰雷柱（畫在雲朵下半部後方，彷彿從雲肚子裡劈出）
          if (localAge >= 0 && localAge <= 0.65) {
            const boltAlpha = Math.max(0, 1 - localAge / 0.65);
            ctx.save();
            ctx.globalAlpha = boltAlpha * cloudAlpha;

            // 地面焦黑電漿震波圈
            ctx.fillStyle = "rgba(15, 23, 42, 0.72)";
            ctx.beginPath();
            ctx.ellipse(px, py, 28, 12, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = "#FACC15";
            ctx.lineWidth = 3.2;
            ctx.beginPath();
            ctx.ellipse(px, py, 16 + localAge * 48, 7 + localAge * 20, 0, 0, Math.PI * 2);
            ctx.stroke();

            // 垂直三層雷柱（外金黃電氣 ➔ 中亮黃 ➔ 內純白雷核）
            ctx.fillStyle = "rgba(250, 204, 21, 0.52)";
            ctx.fillRect(px - 14, cloudY + 4, 28, py - cloudY - 4);

            ctx.fillStyle = "#FEF08A";
            ctx.fillRect(px - 8, cloudY + 4, 16, py - cloudY - 4);

            ctx.fillStyle = "#FFFFFF";
            ctx.fillRect(px - 3.5, cloudY + 4, 7, py - cloudY - 4);

            // 雷柱外圍螺旋纏繞電弧
            ctx.strokeStyle = "#FEF08A";
            ctx.lineWidth = 2.4;
            ctx.beginPath();
            for (let y = cloudY + 6; y <= py; y += 14) {
              const hx = px + Math.sin(y * 0.08 + now * 12 + idx) * 16;
              if (y === cloudY + 6) ctx.moveTo(hx, y);
              else ctx.lineTo(hx, y);
            }
            ctx.stroke();
            ctx.restore();
          }

          // 3. 立體積雨雲繪製（上拱下平 6 雲簇 + 三階明暗體積）
          const sway = Math.sin(now * 2.5 + idx) * 2.5;
          const cx = px + sway;

          // (A) 雲朵底層：厚重暗夜紫黑陰影底盤 (#0F172A)
          ctx.fillStyle = "#0F172A";
          ctx.beginPath();
          ctx.roundRect(cx - 34, cloudY - 2, 68, 18, 9);
          ctx.arc(cx - 22, cloudY + 2, 14, 0, Math.PI * 2);
          ctx.arc(cx + 22, cloudY + 2, 13, 0, Math.PI * 2);
          ctx.arc(cx, cloudY + 4, 16, 0, Math.PI * 2);
          ctx.fill();

          // (B) 雲朵中層：翻湧風暴深灰藍雲團 (#1E293B & #334155，6團不對稱自然簇)
          ctx.fillStyle = "#1E293B";
          ctx.beginPath();
          ctx.arc(cx - 24, cloudY - 4, 15, 0, Math.PI * 2);
          ctx.arc(cx + 23, cloudY - 3, 14, 0, Math.PI * 2);
          ctx.arc(cx - 10, cloudY - 12, 18, 0, Math.PI * 2);
          ctx.arc(cx + 11, cloudY - 10, 16, 0, Math.PI * 2);
          ctx.arc(cx + 2, cloudY - 16, 17, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = "#334155";
          ctx.beginPath();
          ctx.arc(cx - 12, cloudY - 14, 14, 0, Math.PI * 2);
          ctx.arc(cx + 9, cloudY - 12, 13, 0, Math.PI * 2);
          ctx.arc(cx + 1, cloudY - 18, 14, 0, Math.PI * 2);
          ctx.fill();

          // (C) 雲朵頂層：受光銀灰與淡金高光弧邊 (Rim Light)
          ctx.strokeStyle = "rgba(203, 213, 225, 0.75)";
          ctx.lineWidth = 2.0;
          ctx.beginPath();
          ctx.arc(cx - 12, cloudY - 14, 13.5, Math.PI * 1.05, Math.PI * 1.75);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(cx + 1, cloudY - 18, 13.5, Math.PI * 1.15, Math.PI * 1.85);
          ctx.stroke();

          // (D) 雲層內部悶雷透光核心 (Internal Subsurface Lightning Glow)
          const flashIntensity = (localAge >= -0.08 && localAge <= 0.25) ? 0.92 : (0.35 + Math.sin(now * 16 + idx * 2.1) * 0.30);
          if (flashIntensity > 0.15) {
            const glowGrad = ctx.createRadialGradient(cx, cloudY - 4, 2, cx, cloudY - 4, 26);
            glowGrad.addColorStop(0, `rgba(255, 255, 255, ${flashIntensity})`);
            glowGrad.addColorStop(0.45, `rgba(250, 204, 21, ${flashIntensity * 0.75})`);
            glowGrad.addColorStop(1, "rgba(250, 204, 21, 0)");
            ctx.fillStyle = glowGrad;
            ctx.beginPath();
            ctx.arc(cx, cloudY - 4, 26, 0, Math.PI * 2);
            ctx.fill();

            // 雲肚內若隱若現的金色閃電裂紋
            ctx.strokeStyle = `rgba(254, 240, 138, ${flashIntensity})`;
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.moveTo(cx - 10, cloudY - 8);
            ctx.lineTo(cx - 2, cloudY - 3);
            ctx.lineTo(cx + 4, cloudY - 7);
            ctx.lineTo(cx + 12, cloudY);
            ctx.stroke();
          }
          ctx.restore();
        });
      } else if (hz.kind === "cross_chop_cleave") {
        // 【爆裂十字劈・高空巨型白熾 X 十字天譴破甲斬（空中層）】
        ctx.translate(sx, sy);
        const alpha = Math.min(1, hz.timer * 1.45);
        ctx.globalAlpha = alpha;
        const arm = hz.radius * Math.min(1, prog * 3.2);

        [-Math.PI / 4, Math.PI / 4].forEach(rot => {
          ctx.save();
          ctx.rotate(rot);
          // 耀金氣勁主刃
          ctx.fillStyle = "#FACC15";
          ctx.strokeStyle = "#991B1B";
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.moveTo(-arm, 0);
          ctx.quadraticCurveTo(0, -18 * (1 - prog * 0.3), arm, 0);
          ctx.quadraticCurveTo(0, 18 * (1 - prog * 0.3), -arm, 0);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // 純白熾熱核心劍脊
          ctx.fillStyle = "#FFFFFF";
          ctx.beginPath();
          ctx.ellipse(0, 0, arm * 0.85, 5.5 * (1 - prog * 0.4), 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        });

        // 十字交叉中心破甲震爆核心環與八芒星
        const coreR = (38 + Math.sin(now * 14) * 6) * (1 - prog * 0.3);
        ctx.strokeStyle = "#FEF08A";
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(0, 0, coreR, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        for (let s = 0; s < 8; s++) {
          const a = (s * Math.PI) / 4 + prog * 0.8;
          const rOut = s % 2 === 0 ? coreR * 1.25 : coreR * 0.55;
          const rIn = coreR * 0.22;
          if (s === 0) ctx.moveTo(Math.cos(a) * rOut, Math.sin(a) * rOut);
          else ctx.lineTo(Math.cos(a) * rOut, Math.sin(a) * rOut);
          ctx.lineTo(Math.cos(a + Math.PI / 8) * rIn, Math.sin(a + Math.PI / 8) * rIn);
        }
        ctx.closePath();
        ctx.fill();
      } else if (hz.kind === "drifting_daimonji") {
        // 【噴火龍超武・Z軸懸浮立體大字爆炎（空中層）】：懸空動態搖曳火舌筆畫 ＋ 交點升騰熱浪火星柱
        const alpha = Math.min(1, hz.timer * 1.3);
        ctx.globalAlpha = alpha;
        const r = hz.radius * 0.88;
        const hoverY = sy - 10 + Math.sin(now * 6) * 2.5;

        ctx.save();
        ctx.translate(sx, hoverY);
        ctx.rotate(hz.angle || 0);
        ctx.globalCompositeOperation = "lighter";
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        const strokes = [
          { x1: -r * 0.75, y1: -r * 0.18, x2: r * 0.75, y2: -r * 0.18 },
          { x1: 0, y1: -r * 0.82, x2: -r * 0.12, y2: r * 0.05 },
          { x1: -r * 0.12, y1: r * 0.05, x2: -r * 0.74, y2: r * 0.74 },
          { x1: 0, y1: -r * 0.18, x2: r * 0.25, y2: r * 0.25 },
          { x1: r * 0.25, y1: r * 0.25, x2: r * 0.74, y2: r * 0.74 }
        ];

        // 1. 動態流體火舌筆畫（三層深紅➔熾橘➔金白火芯＋向後拖曳的銳利火尾）
        strokes.forEach((st, sIdx) => {
          const midX = (st.x1 + st.x2) * 0.5;
          const midY = (st.y1 + st.y2) * 0.5 + Math.sin(now * 9 + sIdx * 1.7) * 5;

          // 外層赤紅／Mega X 蒼藍冥炎帶
          ctx.strokeStyle = hz.isMegaBlueFlame ? "#1E3A8A" : "#B91C1C";
          ctx.lineWidth = 22;
          ctx.beginPath();
          ctx.moveTo(st.x1, st.y1);
          ctx.quadraticCurveTo(midX, midY, st.x2, st.y2);
          ctx.stroke();

          // 中層耀橘／電青動態火舌
          ctx.strokeStyle = hz.isMegaBlueFlame ? "#0EA5E9" : "#F97316";
          ctx.lineWidth = 14;
          ctx.beginPath();
          ctx.moveTo(st.x1, st.y1);
          ctx.quadraticCurveTo(midX, midY - 1.5, st.x2, st.y2);
          ctx.stroke();

          // 內層熾白金黃／蒼白火脊
          ctx.strokeStyle = hz.isMegaBlueFlame ? "#E0F2FE" : "#FEF08A";
          ctx.lineWidth = 5.5;
          ctx.beginPath();
          ctx.moveTo(st.x1, st.y1);
          ctx.quadraticCurveTo(midX, midY - 1.5, st.x2, st.y2);
          ctx.stroke();

          // 筆畫節點前圓後尖搖曳火舌簇（模擬高速推進拉出的烈焰尾鞭）
          for (let k = 0; k <= 3; k++) {
            const t = k / 3;
            const fx = st.x1 + (st.x2 - st.x1) * t;
            const fy = st.y1 + (st.y2 - st.y1) * t;
            const wag = Math.sin(now * 14 + sIdx * 2.1 + k * 1.6) * 5.5;
            const tipLen = 18 + (k % 2) * 7;

            ctx.fillStyle = "#EA580C";
            ctx.beginPath();
            ctx.arc(fx, fy, 7.5, -Math.PI * 0.5, Math.PI * 0.5);
            ctx.quadraticCurveTo(fx - tipLen * 0.5, fy + 6, fx - tipLen, fy + wag);
            ctx.quadraticCurveTo(fx - tipLen * 0.5, fy - 6, fx, fy - 7.5);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = "#FEF08A";
            ctx.beginPath();
            ctx.arc(fx + 1.5, fy, 3.8, 0, Math.PI * 2);
            ctx.fill();
          }
        });
        ctx.restore();

        // 2. 螢幕垂直向上竄升的 3 股立體熱浪火星柱（不受旋轉影響，強化高溫騰空感）
        const cosA = Math.cos(hz.angle || 0), sinA = Math.sin(hz.angle || 0);
        const hubs = [
          { lx: 0, ly: -r * 0.18 },
          { lx: -r * 0.45, ly: r * 0.42 },
          { lx: r * 0.45, ly: r * 0.42 }
        ];
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        hubs.forEach((hb, hIdx) => {
          const hx = sx + hb.lx * cosA - hb.ly * sinA;
          const hy = hoverY + hb.lx * sinA + hb.ly * cosA;
          const colH = 44 + Math.sin(now * 12 + hIdx * 2.2) * 12;
          const sway = Math.cos(now * 10 + hIdx) * 6;

          const colGrad = ctx.createLinearGradient(hx, hy, hx + sway, hy - colH);
          colGrad.addColorStop(0, "rgba(254, 240, 138, 0.85)");
          colGrad.addColorStop(0.5, "rgba(249, 115, 22, 0.52)");
          colGrad.addColorStop(1, "rgba(239, 68, 68, 0)");
          ctx.fillStyle = colGrad;
          ctx.beginPath();
          ctx.moveTo(hx - 8, hy);
          ctx.quadraticCurveTo(hx - 4 + sway * 0.5, hy - colH * 0.55, hx + sway, hy - colH);
          ctx.quadraticCurveTo(hx + 4 + sway * 0.5, hy - colH * 0.55, hx + 8, hy);
          ctx.closePath();
          ctx.fill();
        });
        ctx.restore();
      } else if (hz.kind === "quake_fissure") {
        // 【地裂斷層破（空中層）】：7 顆破土升空、翻滾下墜的 3D 雙色切面飛石巨岩，100% 呼應「飛石對空重創飛行系」
        const alpha = Math.min(1, hz.timer * 1.25);
        ctx.globalAlpha = alpha;
        const curR = Math.max(30, hz.radius * Math.min(1, prog * 2.2));

        for (let b = 0; b < 7; b++) {
          const bAng = (b * Math.PI * 2) / 7 + 0.35;
          const bCycle = (prog * 1.8 + b * 0.23) % 1.0;
          const lift = Math.sin(bCycle * Math.PI);
          const peakH = 56 + (b % 3) * 26;
          const distR = curR * (0.34 + (b % 3) * 0.21) + bCycle * 18;
          const bx = sx + Math.cos(bAng) * distR;
          const by = sy + Math.sin(bAng) * distR - lift * peakH;
          const bSize = 9.5 + (b % 3) * 2.5 + lift * 2.8;
          const rot = now * (b % 2 === 0 ? 3.8 : -3.4) + b * 1.4;

          ctx.save();
          ctx.translate(bx, by);
          ctx.rotate(rot);

          // 3D 雙色切面巨岩塊（左受光暖棕 #D97706 ＋ 右背光深褐 #78350F）
          ctx.fillStyle = "#78350F";
          ctx.strokeStyle = "#1C0D06";
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(0, -bSize);
          ctx.lineTo(bSize * 0.92, -bSize * 0.15);
          ctx.lineTo(bSize * 0.55, bSize * 0.85);
          ctx.lineTo(-bSize * 0.20, bSize * 0.72);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = "#D97706";
          ctx.beginPath();
          ctx.moveTo(0, -bSize);
          ctx.lineTo(-bSize * 0.88, -bSize * 0.22);
          ctx.lineTo(-bSize * 0.62, bSize * 0.68);
          ctx.lineTo(-bSize * 0.15, bSize * 0.72);
          ctx.lineTo(bSize * 0.18, -bSize * 0.05);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // 熔岩熾金裂紋高光
          ctx.strokeStyle = "#FDE047";
          ctx.lineWidth = 1.3;
          ctx.beginPath();
          ctx.moveTo(-bSize * 0.38, -bSize * 0.35);
          ctx.lineTo(bSize * 0.12, 0);
          ctx.lineTo(bSize * 0.38, bSize * 0.35);
          ctx.stroke();
          ctx.restore();
        }
      } else if (hz.kind === "toxic_swamp") {
        // 【劇毒沼澤（空中層）】：從外圍 60%~92% 環帶緩緩蒸騰上升的半透明毒瘴煙柱與淡紫幽霧團（嚴守主角 45px 淨空區）
        const alpha = Math.min(1, hz.timer * 1.15);
        const rx = hz.radius;
        const ry = hz.radius * 0.72;

        for (let m = 0; m < 8; m++) {
          const mProg = (now * 0.45 + m * 0.17) % 1.0;
          const mAng = (m * Math.PI * 2) / 8 + Math.sin(now * 0.7 + m) * 0.12;
          const ringFrac = 0.62 + (m % 3) * 0.13;
          const baseX = sx + Math.cos(mAng) * (rx * ringFrac);
          const baseY = sy + Math.sin(mAng) * (ry * ringFrac);
          const riseH = mProg * 68;
          const swayX = Math.sin(now * 2.4 + m * 1.9 + mProg * 4) * 9;
          const puffAlpha = Math.sin(mProg * Math.PI) * alpha * 0.46;
          const puffR = 11 + mProg * 14;

          // 細長微扭曲上升毒氣煙帶
          ctx.strokeStyle = m % 2 === 0
            ? `rgba(168, 85, 247, ${puffAlpha * 0.85})`
            : `rgba(74, 222, 128, ${puffAlpha * 0.80})`;
          ctx.lineWidth = 4.2 * (1 - mProg * 0.4);
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(baseX, baseY);
          ctx.quadraticCurveTo(baseX + swayX * 0.6, baseY - riseH * 0.5, baseX + swayX, baseY - riseH);
          ctx.stroke();

          // 頂端翻捲的半透明毒瘴幽霧團
          ctx.fillStyle = m % 2 === 0
            ? `rgba(147, 51, 234, ${puffAlpha})`
            : `rgba(34, 197, 94, ${puffAlpha * 0.90})`;
          ctx.beginPath();
          ctx.arc(baseX + swayX, baseY - riseH, puffR, 0, Math.PI * 2);
          ctx.arc(baseX + swayX - puffR * 0.55, baseY - riseH + 3, puffR * 0.68, 0, Math.PI * 2);
          ctx.arc(baseX + swayX + puffR * 0.52, baseY - riseH + 2, puffR * 0.64, 0, Math.PI * 2);
          ctx.fill();

          // 霧團內部螢光毒點微光
          ctx.fillStyle = `rgba(217, 249, 157, ${puffAlpha * 1.3})`;
          ctx.beginPath();
          ctx.arc(baseX + swayX - 2, baseY - riseH - 2, 2.4, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (hz.kind === "psychic_blackhole") {
        // 【精神強念領域（空中層）】：被反重力念力托舉浮空的 7 塊碎石與次元鏡面菱片（外推 54px 以外公轉，視野通透且具空間扭曲威壓）
        const alpha = Math.min(1, hz.timer * 1.25);
        ctx.globalAlpha = alpha;
        const curR = Math.max(36, hz.radius * Math.min(1, prog * 1.8));
        const spin = -now * 1.6;

        for (let s = 0; s < 7; s++) {
          const orbAng = -spin * 0.45 + (s * Math.PI * 2) / 7;
          const orbR = Math.max(54, curR * (0.48 + (s % 3) * 0.17));
          const floatH = 30 + (s % 3) * 14 + Math.sin(now * 3.2 + s * 1.5) * 9;
          const fx = sx + Math.cos(orbAng) * orbR;
          const fy = sy + Math.sin(orbAng) * orbR - floatH;
          const isMirror = (s % 2 === 1);

          ctx.save();
          ctx.translate(fx, fy);
          ctx.rotate(now * (isMirror ? 1.8 : -1.2) + s);

          if (isMirror) {
            // 次元鏡面菱片（粉紫半透明折射面＋純白星芒高光）
            ctx.fillStyle = "rgba(236, 72, 153, 0.45)";
            ctx.strokeStyle = "#FBCFE8";
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.moveTo(0, -13); ctx.lineTo(8, 0); ctx.lineTo(0, 13); ctx.lineTo(-8, 0);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
            ctx.beginPath();
            ctx.moveTo(0, -10); ctx.lineTo(4, -1); ctx.lineTo(-4, -1);
            ctx.closePath();
            ctx.fill();
          } else {
            // 被念力包裹的反重力懸浮碎石（紫晶念力外框＋雙色立體岩面）
            ctx.fillStyle = "#3B0764";
            ctx.strokeStyle = "#C084FC";
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.moveTo(-7, -6); ctx.lineTo(3, -9); ctx.lineTo(9, 1); ctx.lineTo(2, 8); ctx.lineTo(-8, 4);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = "#A855F7";
            ctx.beginPath();
            ctx.moveTo(-6, -5); ctx.lineTo(2, -7); ctx.lineTo(2, 1); ctx.lineTo(-6, 2);
            ctx.closePath();
            ctx.fill();

            // 念力反重力微星光點
            ctx.fillStyle = "#FFFFFF";
            ctx.beginPath();
            ctx.arc(-2, -3, 1.8, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }
      }
      ctx.restore();
    });

    // 2. 空中近戰與環形氣浪特效 (藤鞭錐形流線＋音爆半月、空手劈X十字氣勁、撞擊破空音爆錐、比卡超外圍蓄電環)
    this.meleeEffects.forEach(m => {
      if (m.style === "quake_wave") return; // 已在地面底層繪製
      const prog = Math.max(0, Math.min(1, 1 - (m.timer / (m.maxTime || 0.3))));
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - prog * 0.72);

      if (m.style === "hydro_pump_beam") {
        // 【水炮（Hydro Pump）】：雙柱加粗高壓水柱 ＋ 水箭龜 (#009) 專屬金青【超級發射器】雙肩平行重炮 ＋ Lv.8+ 三股純白螺旋絞線
        const extendFrac = Math.min(1, prog / 0.22);
        const curLen = Math.max(18, m.length * extendFrac);
        const wScale = prog < 0.72 ? (0.90 + Math.sin(prog * 30) * 0.10) : Math.max(0.08, (1 - prog) / 0.28);
        const halfW = (m.width || 22) * 0.5 * wScale;
        const osx = toSx(m.ox), osy = toSy(m.oy);
        const alpha = prog < 0.75 ? 0.96 : Math.max(0, (1 - prog) / 0.25);

        ctx.save();
        ctx.translate(osx, osy);
        ctx.rotate(m.angle || 0);
        ctx.globalAlpha = alpha;

        // 1. 炮口聚焦水霧環（水箭龜專屬追加金青色超級發射器氣爆環）
        ctx.strokeStyle = m.isBlastoiseCannon ? "#FEF08A" : "rgba(224, 242, 254, 0.88)";
        ctx.lineWidth = (m.isBlastoiseCannon ? 3.2 : 2.6) * wScale;
        ctx.beginPath();
        ctx.ellipse(2, 0, 5.0, halfW * (m.isBlastoiseCannon ? 1.52 : 1.38), 0, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = "rgba(56, 189, 248, 0.78)";
        ctx.lineWidth = 2.0 * wScale;
        ctx.beginPath();
        ctx.ellipse(10 + prog * 16, 0, 4.0, halfW * (1.18 + prog * 0.45), 0, 0, Math.PI * 2);
        ctx.stroke();

        // 2. 外層深海藍高壓水柱（上下正弦浪紋）
        const stepPx = 14;
        ctx.fillStyle = m.isBlastoiseCannon ? "rgba(3, 105, 161, 0.90)" : "rgba(2, 132, 199, 0.86)";
        ctx.beginPath();
        ctx.moveTo(0, -halfW * 0.78);
        for (let x = 0; x <= curLen; x += stepPx) {
          const taper = 0.84 + (x / Math.max(1, curLen)) * 0.26;
          const wave = Math.sin(now * 26 - x * 0.085) * 2.6 * wScale;
          ctx.lineTo(x, -halfW * taper + wave);
        }
        ctx.lineTo(curLen + 6, 0);
        for (let x = curLen; x >= 0; x -= stepPx) {
          const taper = 0.84 + (x / Math.max(1, curLen)) * 0.26;
          const wave = Math.sin(now * 26 - x * 0.085 + 1.4) * 2.6 * wScale;
          ctx.lineTo(x, halfW * taper + wave);
        }
        ctx.closePath();
        ctx.fill();

        // 3. 中層亮青色高壓湍流帶
        const midGrad = ctx.createLinearGradient(0, -halfW, 0, halfW);
        midGrad.addColorStop(0, "rgba(56, 189, 248, 0.45)");
        midGrad.addColorStop(0.5, "rgba(186, 230, 253, 0.95)");
        midGrad.addColorStop(1, "rgba(56, 189, 248, 0.45)");
        ctx.fillStyle = midGrad;
        ctx.beginPath();
        ctx.moveTo(0, -halfW * 0.58);
        ctx.lineTo(curLen, -halfW * 0.70);
        ctx.lineTo(curLen + 4, 0);
        ctx.lineTo(curLen, halfW * 0.70);
        ctx.lineTo(0, halfW * 0.58);
        ctx.closePath();
        ctx.fill();

        // 4. 中央白熾水壓軸線 ＋ 螺旋絞線（Lv.8+ 升級為三股純白高壓螺旋絞線）
        ctx.lineCap = "round";
        ctx.strokeStyle = "rgba(255, 255, 255, 0.94)";
        ctx.lineWidth = Math.max(1.8, halfW * (m.isOverpressure ? 0.34 : 0.28));
        ctx.beginPath();
        ctx.moveTo(4, 0);
        ctx.lineTo(curLen - 4, 0);
        ctx.stroke();

        const strandCount = m.isOverpressure ? 3 : 2;
        for (let strand = 0; strand < strandCount; strand++) {
          ctx.strokeStyle = strand === 0 ? "#FFFFFF" : (strand === 1 ? "#BAE6FD" : "#E0F2FE");
          ctx.lineWidth = Math.max(1.4, (m.isOverpressure ? 2.7 : 2.4) * wScale);
          ctx.beginPath();
          for (let x = 2; x <= curLen; x += 10) {
            const amp = halfW * 0.66 * (0.75 + (x / Math.max(1, curLen)) * 0.28);
            const y = Math.sin(x * 0.095 - now * 30 + (strand * Math.PI * 2) / strandCount) * amp;
            if (x === 2) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }

        // 5. 高速氣泡拉絲
        ctx.strokeStyle = "rgba(224, 255, 255, 0.88)";
        ctx.lineWidth = 1.7;
        for (let k = 0; k < 5; k++) {
          const fx = ((now * 460 + k * (curLen / 5)) % Math.max(20, curLen - 14)) + 8;
          const fy = ((k % 3) - 1) * halfW * 0.55;
          ctx.beginPath();
          ctx.moveTo(fx, fy);
          ctx.lineTo(Math.max(4, fx - 18), fy);
          ctx.stroke();
        }

        // 6. 末端扇形炸開的翻捲白沫與飛濺水珠（Lv.8+ 與水箭龜大幅放大水花冠）
        ctx.save();
        ctx.translate(curLen, 0);
        const sprayBoost = (m.isOverpressure ? 1.22 : 1.0) * (m.isBlastoiseCannon ? 1.12 : 1.0);
        const sprayR = Math.max(14, halfW * 1.65 * sprayBoost + prog * 11);

        ctx.strokeStyle = "rgba(125, 211, 252, 0.85)";
        ctx.lineWidth = 3.4 * wScale;
        ctx.beginPath();
        ctx.arc(-4, 0, sprayR * 0.88, -1.18, 1.18);
        ctx.stroke();

        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 2.6 * wScale;
        ctx.beginPath();
        ctx.arc(-2, 0, sprayR * 0.65, -1.05, 1.05);
        ctx.stroke();

        const foamPts = [
          [2, -sprayR * 0.58, 4.8 * sprayBoost], [7, -sprayR * 0.25, 5.6 * sprayBoost],
          [9, 0, 6.0 * sprayBoost], [7, sprayR * 0.25, 5.6 * sprayBoost], [2, sprayR * 0.58, 4.8 * sprayBoost]
        ];
        ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
        foamPts.forEach(([fx, fy, fr], idx) => {
          const jitter = Math.sin(now * 24 + idx * 1.7) * 2.5;
          ctx.beginPath();
          ctx.arc(fx + jitter, fy, fr * wScale, 0, Math.PI * 2);
          ctx.fill();
        });

        [-0.85, -0.35, 0.35, 0.85].forEach((da, idx) => {
          const dist = sprayR * 0.92 + prog * 16 + (idx % 2) * 5;
          const dx = Math.cos(da) * dist;
          const dy = Math.sin(da) * dist;
          ctx.save();
          ctx.translate(dx, dy);
          ctx.rotate(da);
          ctx.fillStyle = idx % 2 === 0 ? "#E0FFFF" : "#38BDF8";
          ctx.beginPath();
          ctx.moveTo(5.8 * wScale, 0);
          ctx.lineTo(-3.6 * wScale, -2.5 * wScale);
          ctx.lineTo(-3.6 * wScale, 2.5 * wScale);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        });
        ctx.restore();

        ctx.restore();
      } else if (m.style === "flamethrower_beam") {
        // 【噴射火焰（Flamethrower）・連續錐形烈焰流】：深紅➔熾橘➔明黃➔純白四層翻湧火浪 ＋ 邊緣捲曲火舌 ＋ 前端烈焰湧冠
        const extendFrac = Math.min(1, prog / 0.24);
        const curLen = Math.max(20, m.length * extendFrac);
        const wScale = prog < 0.72 ? (0.92 + Math.sin(prog * 28) * 0.08) : Math.max(0.10, (1 - prog) / 0.28);
        const sW = (m.startHalfW || 9) * wScale;
        const eW = (m.endHalfW || 32) * wScale;
        const osx = toSx(m.ox), osy = toSy(m.oy);
        const alpha = prog < 0.74 ? 0.96 : Math.max(0, (1 - prog) / 0.26);

        ctx.save();
        ctx.translate(osx, osy);
        ctx.rotate(m.angle || 0);
        ctx.globalAlpha = alpha;

        // 1. 口部灼熱噴射火花環（噴火龍 #006 追加雙重熱浪氣爆環；Mega X 切換蒼藍冥炎）
        const isBlue = !!m.isMegaBlueFlame;
        const isZard = !!m.isCharizardFlame;
        ctx.fillStyle = isBlue ? "#E0F2FE" : "#FEF08A";
        ctx.beginPath();
        ctx.ellipse(3, 0, 5.5 * wScale, sW * 1.15, 0, 0, Math.PI * 2);
        ctx.fill();

        if (isZard || isBlue) {
          ctx.strokeStyle = isBlue ? "rgba(56, 189, 248, 0.90)" : "rgba(254, 240, 138, 0.88)";
          ctx.lineWidth = 2.4 * wScale;
          ctx.beginPath();
          ctx.ellipse(8 + prog * 14, 0, 4.2, sW * (1.45 + prog * 0.55), 0, 0, Math.PI * 2);
          ctx.stroke();
        }

        const stepPx = 14;
        const buildConePath = (wMul, lenMul, phaseShift, ampMul) => {
          const lim = curLen * lenMul;
          ctx.beginPath();
          ctx.moveTo(0, -sW * wMul);
          for (let x = 0; x <= lim; x += stepPx) {
            const t = x / Math.max(1, curLen);
            const baseHalf = (sW + (eW - sW) * t) * wMul;
            const curl = Math.sin(now * 28 - x * 0.095 + phaseShift) * (3.2 + t * 5.2) * ampMul * wScale;
            ctx.lineTo(x, -baseHalf + curl);
          }
          ctx.lineTo(lim + 10 * wMul, Math.sin(now * 24 + phaseShift) * 3.5);
          for (let x = lim; x >= 0; x -= stepPx) {
            const t = x / Math.max(1, curLen);
            const baseHalf = (sW + (eW - sW) * t) * wMul;
            const curl = Math.sin(now * 28 - x * 0.095 + phaseShift + 2.1) * (3.2 + t * 5.2) * ampMul * wScale;
            ctx.lineTo(x, baseHalf + curl);
          }
          ctx.closePath();
        };

        // 2. 第 1 層：深紅 / 蒼藍冥炎外焰翻湧火浪
        const outerGrad = ctx.createLinearGradient(0, 0, curLen, 0);
        if (isBlue) {
          outerGrad.addColorStop(0, "rgba(29, 78, 216, 0.94)");
          outerGrad.addColorStop(0.75, "rgba(37, 99, 235, 0.86)");
          outerGrad.addColorStop(1, "rgba(30, 58, 138, 0.45)");
        } else {
          outerGrad.addColorStop(0, "rgba(185, 28, 28, 0.92)");
          outerGrad.addColorStop(0.75, "rgba(220, 38, 38, 0.85)");
          outerGrad.addColorStop(1, "rgba(153, 27, 27, 0.45)");
        }
        ctx.fillStyle = outerGrad;
        buildConePath(1.02, 1.0, 0, 1.0);
        ctx.fill();

        // 3. 第 2 層：熾橘 / 電青主體火流
        const midGrad = ctx.createLinearGradient(0, 0, curLen, 0);
        if (isBlue) {
          midGrad.addColorStop(0, "#38BDF8");
          midGrad.addColorStop(0.65, "#0EA5E9");
          midGrad.addColorStop(1, "rgba(2, 132, 199, 0.55)");
        } else {
          midGrad.addColorStop(0, "#FB923C");
          midGrad.addColorStop(0.65, "#F97316");
          midGrad.addColorStop(1, "rgba(234, 88, 12, 0.55)");
        }
        ctx.fillStyle = midGrad;
        buildConePath(0.76, 0.94, 1.1, 0.85);
        ctx.fill();

        // 4. 第 3 層：明黃高溫內焰（噴火龍專屬帶金白龍息高溫芯，Mega X 為亮青蒼炎）
        ctx.fillStyle = isBlue ? "#67E8F9" : (m.isMoltresFlame ? "#FEF08A" : "#FACC15");
        buildConePath(0.48, 0.82, 2.3, 0.60);
        ctx.fill();

        // 5. 第 4 層：純白熾熱噴射火芯（噴火龍 #006 專屬在口部延伸蒼藍龍息高溫內線）
        ctx.fillStyle = "#FFFFFF";
        buildConePath(0.24, 0.58, 3.1, 0.35);
        ctx.fill();
        if (isZard) {
          ctx.fillStyle = "rgba(103, 232, 249, 0.72)";
          buildConePath(0.14, 0.42, 4.2, 0.25);
          ctx.fill();
        }

        // 6. 邊緣捲曲躍動的烈焰火舌簇與前端翻滾火球團
        const puffCount = (m.isInferno || isZard || isBlue) ? 6 : 4;
        for (let k = 0; k < puffCount; k++) {
          const frac = ((now * 3.8 + k / puffCount) % 1.0);
          const fx = frac * curLen * 0.96;
          const side = (k % 2 === 0 ? 1 : -1);
          const halfH = sW + (eW - sW) * frac;
          const fy = side * halfH * 0.72;
          const pr = (5.5 + frac * 6.5) * wScale;

          ctx.fillStyle = isBlue
            ? (k % 2 === 0 ? "rgba(14, 165, 233, 0.88)" : "rgba(103, 232, 249, 0.88)")
            : (k % 2 === 0 ? "rgba(249, 115, 22, 0.88)" : "rgba(250, 204, 21, 0.86)");
          ctx.beginPath();
          ctx.arc(fx, fy, pr, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = isBlue ? "rgba(224, 242, 254, 0.88)" : "rgba(254, 240, 138, 0.85)";
          ctx.beginPath();
          ctx.arc(fx + 2, fy, pr * 0.48, 0, Math.PI * 2);
          ctx.fill();
        }

        // 前端翻湧火焰湧冠
        ctx.save();
        ctx.translate(curLen, 0);
        const capPts = [
          [-2, -eW * 0.62, eW * 0.32],
          [5, -eW * 0.24, eW * 0.38],
          [8, 0, eW * 0.42],
          [5, eW * 0.24, eW * 0.38],
          [-2, eW * 0.62, eW * 0.32]
        ];
        capPts.forEach(([cx, cy, cr], idx) => {
          const jit = Math.sin(now * 26 + idx * 1.9) * 3.0;
          ctx.fillStyle = isBlue
            ? (idx === 2 ? "rgba(103, 232, 249, 0.86)" : "rgba(56, 189, 248, 0.78)")
            : (idx === 2 ? "rgba(250, 204, 21, 0.82)" : "rgba(249, 115, 22, 0.78)");
          ctx.beginPath();
          ctx.arc(cx + jit, cy, Math.max(3, cr), 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.restore();

        ctx.restore();
      } else if (m.style === "ice_beam_laser") {
        // 【冷凍光線（Ice Beam）・經典 GBA 折線極寒雷射】：冰藍折線結晶鞘 ＋ 純白高壓極寒雷射軸 ＋ 環繞菱形冰晶 ＋ 末端六角冰霜爆破
        const extendFrac = Math.min(1, prog / 0.16);
        const curLen = Math.max(20, m.length * extendFrac);
        const wScale = prog < 0.70 ? (0.94 + Math.sin(prog * 34) * 0.06) : Math.max(0.08, (1 - prog) / 0.30);
        const halfW = (m.width || 16) * 0.5 * wScale;
        const osx = toSx(m.ox), osy = toSy(m.oy);
        const alpha = prog < 0.74 ? 0.97 : Math.max(0, (1 - prog) / 0.26);

        ctx.save();
        ctx.translate(osx, osy);
        ctx.rotate(m.angle || 0);
        ctx.globalAlpha = alpha;
        ctx.lineCap = "round";
        ctx.lineJoin = "miter";

        // 1. 發射口寒冰六角光暈
        ctx.fillStyle = "rgba(224, 242, 254, 0.90)";
        ctx.strokeStyle = "#38BDF8";
        ctx.lineWidth = 2.0 * wScale;
        ctx.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = (k * Math.PI) / 3 + now * 4;
          const rr = halfW * 1.15;
          if (k === 0) ctx.moveTo(2 + Math.cos(a) * rr * 0.65, Math.sin(a) * rr);
          else ctx.lineTo(2 + Math.cos(a) * rr * 0.65, Math.sin(a) * rr);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 2. 半透明冰藍外鞘光束帶
        const beamGrad = ctx.createLinearGradient(0, -halfW, 0, halfW);
        beamGrad.addColorStop(0, "rgba(2, 132, 199, 0.25)");
        beamGrad.addColorStop(0.5, "rgba(103, 232, 249, 0.78)");
        beamGrad.addColorStop(1, "rgba(2, 132, 199, 0.25)");
        ctx.fillStyle = beamGrad;
        ctx.fillRect(0, -halfW * 0.85, curLen, halfW * 1.70);

        // 3. 經典 GBA 折線寒冰雷射（雙層交錯銳利鋸齒折線）
        const segLen = 22;
        const zigCount = Math.max(2, Math.floor(curLen / segLen));
        const flickerPhase = Math.floor(now * 24 + (m.zigSeed || 0));

        const drawZigZag = (color, lineW, ampMul, invert) => {
          ctx.strokeStyle = color;
          ctx.lineWidth = Math.max(1.2, lineW * wScale);
          ctx.beginPath();
          ctx.moveTo(2, 0);
          for (let s = 1; s < zigCount; s++) {
            const zx = (s / zigCount) * curLen;
            const sign = ((s + flickerPhase) % 2 === 0 ? 1 : -1) * (invert ? -1 : 1);
            const zy = sign * halfW * ampMul;
            ctx.lineTo(zx, zy);
          }
          ctx.lineTo(curLen, 0);
          ctx.stroke();
        };

        drawZigZag("#0284C7", halfW * 0.72, 0.88, false);
        drawZigZag("#67E8F9", halfW * 0.42, 0.82, false);
        if (m.isHighCryo || m.isArticunoBeam) {
          drawZigZag("#BAE6FD", halfW * 0.34, 0.76, true);
        }

        // 4. 中央極細純白極寒雷射主軸
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = Math.max(2.0, halfW * 0.36);
        ctx.beginPath();
        ctx.moveTo(2, 0);
        ctx.lineTo(curLen, 0);
        ctx.stroke();

        // 5. 沿光束飛速推進的菱形冰晶碎片
        for (let d = 0; d < 5; d++) {
          const dx = ((now * 420 + d * (curLen / 5)) % Math.max(18, curLen - 12)) + 8;
          const dy = ((d % 2 === 0 ? 1 : -1) * halfW * 0.75);
          const sz = (3.4 + (d % 2) * 1.4) * wScale;
          ctx.fillStyle = d % 2 === 0 ? "#FFFFFF" : "#BAE6FD";
          ctx.beginPath();
          ctx.moveTo(dx + sz * 1.4, dy);
          ctx.lineTo(dx, dy - sz * 0.7);
          ctx.lineTo(dx - sz * 1.4, dy);
          ctx.lineTo(dx, dy + sz * 0.7);
          ctx.closePath();
          ctx.fill();
        }

        // 6. 末端六角冰霜爆破星芒
        ctx.save();
        ctx.translate(curLen, 0);
        const burstR = Math.max(12, halfW * 1.45 + prog * 14);
        ctx.rotate(now * 3.2);
        ctx.strokeStyle = "#E0F2FE";
        ctx.lineWidth = 2.4 * wScale;
        for (let k = 0; k < 6; k++) {
          const a = (k * Math.PI) / 3;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(a) * burstR, Math.sin(a) * burstR);
          ctx.stroke();
        }
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(3, halfW * 0.55), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.restore();
      } else if (m.style === "water_splash_burst") {
        // 【全水系通用・優化水花爆濺特效】：水冠飛濺弧 ＋ 5 顆放射淚滴水珠 ＋ 細膩白沫環
        const msx = toSx(m.x), msy = toSy(m.y);
        const fade = Math.max(0, 1 - prog);
        const curR = m.radius * (0.45 + prog * 0.82);

        ctx.save();
        ctx.translate(msx, msy);
        ctx.rotate(m.angle || 0);
        ctx.globalAlpha = fade * 0.92;

        // 1. 雙層輕盈水花擴散弧（半透明亮青＋純白碎浪邊）
        ctx.strokeStyle = "#38BDF8";
        ctx.lineWidth = 2.6 * fade;
        ctx.beginPath();
        ctx.arc(0, 0, curR, -1.25, 1.25);
        ctx.stroke();

        ctx.strokeStyle = "#E0FFFF";
        ctx.lineWidth = 1.6 * fade;
        ctx.beginPath();
        ctx.arc(0, 0, curR * 0.72, -1.5, 1.5);
        ctx.stroke();

        // 2. 5 顆沿衝擊方向放射飛濺的淚滴水珠（前圓後尖）
        [-1.05, -0.52, 0, 0.52, 1.05].forEach((da, idx) => {
          const d = curR * (0.85 + (idx % 2) * 0.25);
          const wx = Math.cos(da) * d;
          const wy = Math.sin(da) * d;
          ctx.save();
          ctx.translate(wx, wy);
          ctx.rotate(da);
          ctx.fillStyle = idx % 2 === 0 ? "#FFFFFF" : "#7DD3FC";
          ctx.beginPath();
          ctx.arc(2.2, 0, 2.4 * fade + 0.8, -Math.PI * 0.5, Math.PI * 0.5);
          ctx.lineTo(-4.5 * fade - 1.5, 0);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        });
        ctx.restore();
      } else if (m.style === "shadow_implosion") {
        // 【暗影球命中・暗紫內爆空間漣漪】：極短促 0.18s 空間向內坍縮收縮環 ＋ 幽紫吞噬閃光
        const msx = toSx(m.x), msy = toSy(m.y);
        const shrink = Math.max(0.12, 1 - prog * 0.86);
        const curR = m.radius * shrink;
        const fade = Math.max(0, 1 - prog * 0.75);

        ctx.save();
        ctx.translate(msx, msy);
        ctx.globalAlpha = fade;

        ctx.fillStyle = "rgba(59, 7, 100, 0.55)";
        ctx.strokeStyle = "#A855F7";
        ctx.lineWidth = 2.6 * fade + 0.8;
        ctx.beginPath();
        ctx.arc(0, 0, curR, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = "#E9D5FF";
        ctx.lineWidth = 1.6;
        for (let k = 0; k < 4; k++) {
          const a = (k * Math.PI) / 2 + prog * 1.4;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * (curR * 1.25), Math.sin(a) * (curR * 1.25));
          ctx.lineTo(Math.cos(a) * (curR * 0.35), Math.sin(a) * (curR * 0.35));
          ctx.stroke();
        }

        ctx.fillStyle = "#090514";
        ctx.strokeStyle = "#F3E8FF";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(2.5, curR * 0.38), 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      } else if (m.style === "vine_whip") {
        // 【藤鞭（漸進射程 ＋ 妙蛙花 #003 專屬霸王花瓣藤鞭）】：雙層 S 彎曲藤蔓 ＋ 倒刺花瓣 ＋ 破空月牙斬痕
        const osx = toSx(m.ox !== undefined ? m.ox : m.x);
        const osy = toSy(m.oy !== undefined ? m.oy : m.y);
        const isVenu = !!m.isVenusaurWhip;
        ctx.save();
        ctx.translate(osx, osy);
        ctx.rotate(m.angle || 0);

        const reach = m.reach * Math.min(1, prog * 1.8);
        const thickness = isVenu ? 9.4 : 7.8;
        const waveFreq = 2.5;
        const waveAmp = (1 - prog * 0.5) * 24;

        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        // 底層深綠硬邊襯底
        ctx.strokeStyle = "#14532D";
        ctx.lineWidth = thickness + 3.5;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        for (let x = 0; x <= reach; x += 8) {
          const t = x / reach;
          const y = Math.sin(t * Math.PI * waveFreq) * waveAmp * Math.sin(t * Math.PI);
          ctx.lineTo(x, y);
        }
        ctx.stroke();

        // 中層翠綠主幹
        ctx.strokeStyle = "#22C55E";
        ctx.lineWidth = thickness;
        ctx.stroke();

        // 內層嫩綠高光脊線
        ctx.strokeStyle = "#86EFAC";
        ctx.lineWidth = 2.0;
        ctx.stroke();

        // 兩側交錯倒刺三角 + 發光嫩芽圓點
        for (let step = 26; step < reach - 18; step += 22) {
          const t = step / reach;
          const y = Math.sin(t * Math.PI * waveFreq) * waveAmp * Math.sin(t * Math.PI);
          const side = (step % 44 === 0) ? 1 : -1;

          ctx.fillStyle = "#15803D";
          ctx.beginPath();
          ctx.moveTo(step, y);
          ctx.lineTo(step + 6, y + side * (thickness + 6));
          ctx.lineTo(step - 4, y + side * (thickness + 2));
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = isVenu ? "#F472B6" : "#86EFAC";
          ctx.beginPath();
          ctx.arc(step, y + side * (thickness * 0.6), isVenu ? 3.2 : 2.3, 0, Math.PI * 2);
          ctx.fill();
          if (isVenu) {
            ctx.fillStyle = "#FDE047";
            ctx.beginPath();
            ctx.arc(step, y + side * (thickness * 0.6), 1.3, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // 末端破空月牙鞭影斬痕（妙蛙花專屬升級翠綠＋粉紅霸王花瓣風暴斬）
        const slashR = (isVenu ? 18 : 14) + prog * 12;
        const slashAlpha = Math.max(0, 1 - prog * 0.78);
        ctx.save();
        ctx.translate(reach, 0);
        ctx.globalAlpha = slashAlpha;

        ctx.fillStyle = isVenu ? "rgba(244, 114, 182, 0.78)" : "rgba(34, 197, 94, 0.72)";
        ctx.beginPath();
        ctx.arc(-2, 0, slashR, -1.18, 1.18);
        ctx.arc(-8, 0, slashR * 0.74, 1.18, -1.18, true);
        ctx.closePath();
        ctx.fill();

        if (isVenu) {
          ctx.fillStyle = "rgba(34, 197, 94, 0.80)";
          ctx.beginPath();
          ctx.arc(-4, 0, slashR * 0.82, -1.02, 1.02);
          ctx.arc(-9, 0, slashR * 0.60, 1.02, -1.02, true);
          ctx.closePath();
          ctx.fill();
        }

        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 2.8 * slashAlpha + 0.8;
        ctx.beginPath();
        ctx.arc(-1, 0, slashR * 0.96, -1.05, 1.05);
        ctx.stroke();

        ctx.strokeStyle = "#BBF7D0";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(slashR * 0.65, -7); ctx.lineTo(slashR * 1.18, -13);
        ctx.moveTo(slashR * 0.65, 7); ctx.lineTo(slashR * 1.18, 13);
        ctx.stroke();
        ctx.restore();

        ctx.restore();
      } else if (m.style === "karate_cross") {
        // 【空手劈・商業動作遊戲級連環拳風】：錐形漸層拳風帶 ＋ 錯落速度線 ＋ 半透明殘影拳 ＋ 透視壓扁橢圓音爆環 ＋ 尾拳月牙破空閃光
        const burstT = Math.min(1, prog / 0.36);
        const thrustEase = 1 - Math.pow(1 - burstT, 3);
        const curWx = m.ox !== undefined ? (m.ox + (m.x - m.ox) * thrustEase) : m.x;
        const curWy = m.oy !== undefined ? (m.oy + (m.y - m.oy) * thrustEase) : m.y;
        const msx = toSx(curWx), msy = toSy(curWy);
        const isFin = !!m.isFinisher;
        const baseR = Math.min(isFin ? 58 : 46, Math.max(isFin ? 32 : 24, m.radius * (isFin ? 0.90 : 0.76)));
        const fade = Math.max(0, 1 - prog * 0.88);
        const popScale = (isFin ? 0.88 : 0.78) + Math.sin(Math.min(1, prog * 2.5) * Math.PI * 0.5) * (isFin ? 0.32 : 0.22);
        const f = baseR * 0.42;

        ctx.save();
        ctx.translate(msx, msy);
        ctx.rotate(m.angle || 0); // +X 為出拳前進方向，-X 為拳頭後方
        ctx.globalAlpha = fade;

        // 1. 半透明錐形拳風帶（前寬後尖，前端亮金➔尾端透明，完全不黏死角色身體）
        const coneLen = Math.min(isFin ? 66 : 48, baseR * (isFin ? 1.45 : 1.20));
        const coneHalfW = baseR * (isFin ? 0.62 : 0.50);
        const windGrad = ctx.createLinearGradient(-coneLen, 0, f * 0.4, 0);
        windGrad.addColorStop(0, "rgba(234, 88, 12, 0.0)");
        windGrad.addColorStop(0.55, isFin ? "rgba(249, 115, 22, 0.38)" : "rgba(249, 115, 22, 0.28)");
        windGrad.addColorStop(1, isFin ? "rgba(254, 240, 138, 0.62)" : "rgba(254, 240, 138, 0.44)");
        ctx.fillStyle = windGrad;
        ctx.beginPath();
        ctx.moveTo(f * 0.35, -coneHalfW);
        ctx.quadraticCurveTo(-coneLen * 0.35, -coneHalfW * 0.55, -coneLen, 0);
        ctx.quadraticCurveTo(-coneLen * 0.35, coneHalfW * 0.55, f * 0.35, coneHalfW);
        ctx.closePath();
        ctx.fill();

        // 2. 3～4 條長短錯落的銳利破風速度線 (Speed Lines)
        const speedLines = isFin
          ? [[-coneLen * 0.95, -coneHalfW * 0.72, coneLen * 0.78, 2.2], [-coneLen * 0.70, -coneHalfW * 0.28, coneLen * 0.62, 1.5], [-coneLen * 0.80, coneHalfW * 0.30, coneLen * 0.65, 1.5], [-coneLen * 0.98, coneHalfW * 0.74, coneLen * 0.80, 2.2]]
          : [[-coneLen * 0.88, -coneHalfW * 0.68, coneLen * 0.68, 1.8], [-coneLen * 0.65, 0, coneLen * 0.50, 1.3], [-coneLen * 0.90, coneHalfW * 0.66, coneLen * 0.70, 1.8]];
        ctx.lineCap = "round";
        speedLines.forEach(([lx, ly, llen, lw], idx) => {
          const shiftX = prog * 10;
          ctx.strokeStyle = idx % 2 === 0 ? "rgba(255, 255, 255, 0.82)" : "rgba(253, 186, 116, 0.72)";
          ctx.lineWidth = lw * (1 - prog * 0.45);
          ctx.beginPath();
          ctx.moveTo(lx + shiftX, ly);
          ctx.lineTo(lx + llen + shiftX, ly * 0.82);
          ctx.stroke();
        });

        // 3. 1～2 層半透明殘影拳 (Afterimage Silhouettes)，強化高速連打殘像
        const ghosts = isFin ? [{ dx: -22, sc: 0.68, al: 0.22 }, { dx: -11, sc: 0.84, al: 0.38 }] : [{ dx: -12, sc: 0.80, al: 0.30 }];
        ghosts.forEach(g => {
          ctx.save();
          ctx.translate(g.dx, 0);
          ctx.rotate(Math.PI * 0.5);
          ctx.scale(popScale * g.sc, popScale * g.sc);
          ctx.globalAlpha = fade * g.al;
          ctx.fillStyle = isFin ? "#FACC15" : "#EA580C";
          ctx.beginPath();
          ctx.roundRect(-f * 0.66, -f * 0.70, f * 1.32, f * 1.24, f * 0.28);
          ctx.fill();
          ctx.restore();
        });

        // 4. 垂直於出拳方向的「透視壓扁橢圓音爆環」（模擬拳頭擊穿空氣膜，告別平面正圓貼紙感）
        const outerRy = baseR * (isFin ? (0.64 + prog * 0.62) : (0.50 + prog * 0.44));
        const outerRx = outerRy * 0.34;
        const innerRy = baseR * (isFin ? (0.42 + prog * 0.44) : (0.32 + prog * 0.32));
        const innerRx = innerRy * 0.32;

        ctx.strokeStyle = "rgba(254, 240, 138, 0.75)";
        ctx.lineWidth = Math.max(1.5, (isFin ? 5.2 : 3.8) * (1 - prog * 0.55));
        ctx.beginPath();
        ctx.ellipse(-f * 0.25, 0, outerRx, outerRy, 0, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = "rgba(255, 255, 255, 0.92)";
        ctx.lineWidth = Math.max(1.0, (isFin ? 2.4 : 1.8) * (1 - prog * 0.55));
        ctx.beginPath();
        ctx.ellipse(-f * 0.25, 0, outerRx, outerRy, 0, 0, Math.PI * 2);
        ctx.stroke();

        if (isFin) {
          ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
          ctx.lineWidth = Math.max(1.0, 2.8 * (1 - prog * 0.50));
          ctx.beginPath();
          ctx.ellipse(f * 0.35, 0, innerRx, innerRy, 0, 0, Math.PI * 2);
          ctx.stroke();
        }

        // 5. 沿出拳方向旋轉並彈出「赤金烈焰武道重拳本體」
        ctx.save();
        ctx.rotate(Math.PI * 0.5);
        ctx.scale(popScale, popScale);

        // 拳印後方拖曳的烈焰氣焰與 3 道尾舌
        ctx.fillStyle = "rgba(234, 88, 12, 0.88)";
        ctx.beginPath();
        ctx.moveTo(-f * 0.95, f * 0.25);
        ctx.quadraticCurveTo(-f * 1.15, -f * 0.65, -f * 0.42, -f * 1.18);
        ctx.quadraticCurveTo(0, -f * 1.52, f * 0.45, -f * 1.15);
        ctx.quadraticCurveTo(f * 1.15, -f * 0.60, f * 0.92, f * 0.30);
        ctx.lineTo(f * 0.55, f * 1.32);
        ctx.lineTo(f * 0.15, f * 0.88);
        ctx.lineTo(-f * 0.12, f * 1.44);
        ctx.lineTo(-f * 0.45, f * 0.92);
        ctx.lineTo(-f * 0.82, f * 1.20);
        ctx.closePath();
        ctx.fill();

        // 內層耀金烈焰光暈邊緣
        ctx.fillStyle = "#FACC15";
        ctx.beginPath();
        ctx.moveTo(-f * 0.78, f * 0.18);
        ctx.quadraticCurveTo(-f * 0.92, -f * 0.52, -f * 0.32, -f * 0.96);
        ctx.quadraticCurveTo(0, -f * 1.22, f * 0.35, -f * 0.94);
        ctx.quadraticCurveTo(f * 0.92, -f * 0.48, f * 0.75, f * 0.20);
        ctx.lineTo(f * 0.32, f * 0.86);
        ctx.lineTo(-f * 0.32, f * 0.86);
        ctx.closePath();
        ctx.fill();

        // 立體緊握武道重拳剪影（深褐像素描邊 ＋ 赤紅拳體 ＋ 四指節凸起 ＋ 橫握拇指）
        ctx.fillStyle = "#991B1B";
        ctx.strokeStyle = "#450A0A";
        ctx.lineWidth = 2.0;
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.roundRect(-f * 0.64, -f * 0.68, f * 1.28, f * 1.22, f * 0.28);
        ctx.fill();
        ctx.stroke();

        // 拳背受光亮面
        ctx.fillStyle = "#DC2626";
        ctx.beginPath();
        ctx.roundRect(-f * 0.52, -f * 0.54, f * 1.04, f * 0.76, f * 0.20);
        ctx.fill();

        // 四顆凸起指節與指縫陰影
        ctx.fillStyle = "#EF4444";
        ctx.strokeStyle = "#450A0A";
        ctx.lineWidth = 1.4;
        for (let k = 0; k < 4; k++) {
          const kx = -f * 0.56 + k * (f * 0.29);
          const ky = -f * 0.72 + (k === 0 || k === 3 ? f * 0.08 : 0);
          ctx.beginPath();
          ctx.roundRect(kx, ky, f * 0.27, f * 0.44, f * 0.10);
          ctx.fill();
          ctx.stroke();
        }

        // 橫扣於前方的拇指與金白高光點
        ctx.fillStyle = "#B91C1C";
        ctx.beginPath();
        ctx.roundRect(-f * 0.72, -f * 0.14, f * 0.74, f * 0.36, f * 0.14);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#FEF08A";
        ctx.beginPath();
        ctx.arc(-f * 0.12, -f * 0.56, f * 0.10, 0, Math.PI * 2);
        ctx.arc(f * 0.18, -f * 0.56, f * 0.10, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // 6. 終結重拳指節最前端：銳利純白月牙破空閃光 (Finisher Impact Crescent)
        if (isFin && prog < 0.68) {
          const cFade = 1 - prog / 0.68;
          ctx.save();
          ctx.globalAlpha = cFade * 0.95;
          ctx.strokeStyle = "#FFFFFF";
          ctx.lineWidth = 3.8 * cFade;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.arc(f * 0.42, 0, baseR * 0.54, -0.88, 0.88);
          ctx.stroke();

          ctx.strokeStyle = "#FEF08A";
          ctx.lineWidth = 2.0 * cFade;
          ctx.beginPath();
          ctx.arc(f * 0.54, 0, baseR * 0.66, -0.68, 0.68);
          ctx.stroke();
          ctx.restore();
        }

        ctx.restore();
      } else if (m.style === "phantom_tackle") {
        // 【撞擊 A+C 接力段】：從上一擊落點飛出的「半透明精靈殘影分身 ＋ 1:1 真實範圍動能月牙氣浪」
        const ease = 1 - Math.pow(1 - Math.min(1, prog * 1.55), 3);
        const curWx = m.ox + (m.x - m.ox) * ease;
        const curWy = m.oy + (m.y - m.oy) * ease;
        const csx = toSx(curWx), csy = toSy(curWy);
        const fade = Math.max(0, 1 - prog * 0.92);
        const waveR = Math.max(30, m.radius * (0.76 + ease * 0.24));
        const tintCol = m.waveIdx >= 2 ? "#FEF08A" : "#7DD3FC";
        const rimCol = m.waveIdx >= 2 ? "#FACC15" : "#38BDF8";

        ctx.save();
        ctx.translate(csx, csy);

        // 1. 殘影衝刺拖尾速度線（沿衝擊軸向後拉開）
        ctx.save();
        ctx.rotate(m.angle || 0);
        ctx.globalAlpha = fade * 0.85;
        ctx.strokeStyle = tintCol;
        ctx.lineWidth = 2.4;
        ctx.lineCap = "round";
        [-1, 0, 1].forEach((row) => {
          const ly = row * (waveR * 0.32);
          ctx.beginPath();
          ctx.moveTo(-4, ly);
          ctx.lineTo(-26 - ease * 18, ly * 1.15);
          ctx.stroke();
        });
        ctx.restore();

        // 2. 半透明精靈前衝殘影分身（直立朝向衝擊左右方向，帶輕微前傾擠壓拉伸，0 ctx.filter 開銷）
        const sprRec = m.spriteUrl ? (m.isShiny ? SpriteCache.getShiny(m.spriteUrl) : SpriteCache.get(m.spriteUrl)) : null;
        if (sprRec && sprRec.loaded) {
          ctx.save();
          ctx.scale((m.facingX > 0 ? -1 : 1) * 1.12, 0.92);
          ctx.globalAlpha = fade * 0.42;
          ctx.drawImage(sprRec.img, -26, -24, 52, 52);
          GameApp.drawSilhouetteFlash(ctx, sprRec.img, -26, -24, 52, 52, tintCol, fade * 0.65);
          ctx.restore();
        }

        // 3. 1:1 等比貼合真實傷害半徑 m.radius 的寬幅動能月牙氣浪 (Shockwave Crescent)
        ctx.save();
        ctx.rotate(m.angle || 0);
        ctx.globalAlpha = fade;
        const crescentGrad = ctx.createRadialGradient(8, 0, waveR * 0.30, 8, 0, waveR);
        crescentGrad.addColorStop(0, "rgba(255, 255, 255, 0.0)");
        crescentGrad.addColorStop(0.55, m.waveIdx >= 2 ? "rgba(254, 240, 138, 0.32)" : "rgba(125, 211, 252, 0.32)");
        crescentGrad.addColorStop(0.88, "rgba(255, 255, 255, 0.92)");
        crescentGrad.addColorStop(1, "rgba(255, 255, 255, 0.0)");
        ctx.fillStyle = crescentGrad;
        ctx.beginPath();
        ctx.arc(4, 0, waveR, -1.12, 1.12);
        ctx.arc(-8, 0, waveR * 0.68, 1.12, -1.12, true);
        ctx.closePath();
        ctx.fill();

        // 外緣主氣浪高光弧線
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 3.4 * (1 - prog * 0.35);
        ctx.beginPath();
        ctx.arc(6, 0, waveR * 0.96, -1.02, 1.02);
        ctx.stroke();

        ctx.strokeStyle = rimCol;
        ctx.lineWidth = 2.0 * (1 - prog * 0.35);
        ctx.beginPath();
        ctx.arc(10, 0, waveR * 1.02, -0.78, 0.78);
        ctx.stroke();

        // 前鋒破空四芒閃光點
        if (prog < 0.72) {
          const tipX = 6 + waveR * 0.98;
          ctx.fillStyle = tintCol;
          ctx.beginPath();
          ctx.moveTo(tipX + 9, 0); ctx.lineTo(tipX + 1, -4.5);
          ctx.lineTo(tipX - 3, 0); ctx.lineTo(tipX + 1, 4.5);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
        ctx.restore();
      } else if (m.style === "sonic_cone") {
        // 【撞擊（Tackle）・一體化貼身破空衝鋒風罩】：動態鎖定精靈前撲本體，緊貼鼻尖包覆身體兩側，徹底消除空殼分離感！
        const cRef = m.casterRef;
        const lungeProg = (cRef && cRef.lungeTimer > 0) ? Math.sin((1 - cRef.lungeTimer / (cRef.lungeMaxTime || 0.16)) * Math.PI) : 0;
        const lx = cRef ? Math.cos(cRef.lungeAngle || 0) * (cRef.lungeDist || 0) * lungeProg : 0;
        const ly = cRef ? Math.sin(cRef.lungeAngle || 0) * (cRef.lungeDist || 0) * lungeProg : 0;
        const baseSx = cRef ? toSx(cRef.x) + lx : toSx(m.ox !== undefined ? m.ox : m.x);
        const baseSy = cRef ? toSy(cRef.y) + ly : toSy(m.oy !== undefined ? m.oy : m.y);
        const targetR = Math.max(30, m.radius || 38);
        const shroudR = targetR * (0.72 + prog * 0.30);

        ctx.save();
        ctx.translate(baseSx, baseSy);
        ctx.rotate(m.angle || 0);

        // 1. 身體兩側向後掠起的破風流線羽翼 (Swept-back Slipstreams)
        ctx.strokeStyle = "rgba(224, 242, 254, 0.82)";
        ctx.lineWidth = 2.4 * (1 - prog * 0.35);
        ctx.lineCap = "round";
        [-1, 1].forEach(side => {
          ctx.beginPath();
          ctx.moveTo(16, side * 6);
          ctx.quadraticCurveTo(2, side * (shroudR * 0.82), -18 - prog * 8, side * (shroudR * 0.92));
          ctx.stroke();

          ctx.strokeStyle = "rgba(254, 240, 138, 0.75)";
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(12, side * 12);
          ctx.lineTo(-14 - prog * 10, side * 18);
          ctx.stroke();
        });

        // 2. 1:1 貼齊實際判定半徑的破空衝擊風罩 ＋ 前推短促動能氣浪
        const bowGrad = ctx.createRadialGradient(10, 0, 8, 10, 0, shroudR);
        bowGrad.addColorStop(0, "rgba(255, 255, 255, 0.0)");
        bowGrad.addColorStop(0.55, "rgba(186, 230, 253, 0.36)");
        bowGrad.addColorStop(0.88, "rgba(255, 255, 255, 0.92)");
        bowGrad.addColorStop(1, "rgba(255, 255, 255, 0.0)");
        ctx.fillStyle = bowGrad;
        ctx.beginPath();
        ctx.arc(8, 0, shroudR, -1.08, 1.08);
        ctx.arc(-2, 0, shroudR * 0.72, 1.08, -1.08, true);
        ctx.closePath();
        ctx.fill();

        // 風罩最前緣銳利純白高光刃線
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 3.2 * (1 - prog * 0.3);
        ctx.beginPath();
        ctx.arc(9, 0, shroudR * 0.98, -0.96, 0.96);
        ctx.stroke();

        // 前推短促動能氣浪外弧（標示實際打擊前緣）
        ctx.strokeStyle = "rgba(186, 230, 253, 0.75)";
        ctx.lineWidth = 2.0 * (1 - prog * 0.45);
        ctx.beginPath();
        ctx.arc(14 + prog * 10, 0, shroudR * 1.06, -0.78, 0.78);
        ctx.stroke();

        // 鼻尖破空閃光點
        if (prog < 0.65) {
          const tipX = 10 + shroudR;
          ctx.fillStyle = "#FEF08A";
          ctx.beginPath();
          ctx.moveTo(tipX + 7, 0); ctx.lineTo(tipX, -3.5);
          ctx.lineTo(tipX - 3, 0); ctx.lineTo(tipX, 3.5);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      } else if (m.style === "giga_impact_lance") {
        // 【終極衝擊（Giga Impact 超武）・4層次 3D 雙切面黃金霸王螺旋鑽 ＋ 黑紅霸氣閃電弧】
        const osx = toSx(m.ox !== undefined ? m.ox : m.x);
        const osy = toSy(m.oy !== undefined ? m.oy : m.y);
        const curLen = Math.max(16, m.radius * Math.min(1, prog * 1.55));
        const maxW = 32 * (1 - prog * 0.22);
        const tailX = curLen * 0.12;
        const tipX = curLen * 1.08;

        ctx.save();
        ctx.translate(osx, osy);
        ctx.rotate(m.angle || 0);

        // 1. 音爆雲「後半暗部環」（畫在鑽頭本體後方，建立 3D 穿插景深）
        [0.28, 0.54, 0.78].forEach((rPos, idx) => {
          const rx = curLen * rPos;
          const ry = maxW * (1.18 - idx * 0.24);
          ctx.strokeStyle = "rgba(180, 83, 9, 0.60)";
          ctx.lineWidth = 4.2 - idx * 0.6;
          ctx.beginPath();
          ctx.ellipse(rx, 0, ry * 0.34, ry, 0, Math.PI * 0.5, Math.PI * 1.5);
          ctx.stroke();
        });

        // 2. 3D 圓錐下半「背光暗面」（深琥珀銅 -> 赤金暗影，賦予厚重立體感）
        const darkGrad = ctx.createLinearGradient(tailX, 0, tipX, maxW);
        darkGrad.addColorStop(0, "rgba(120, 53, 15, 0.28)");
        darkGrad.addColorStop(0.45, "rgba(180, 83, 9, 0.90)");
        darkGrad.addColorStop(1, "rgba(245, 158, 11, 0.96)");
        ctx.fillStyle = darkGrad;
        ctx.beginPath();
        ctx.moveTo(tipX, 0);
        ctx.lineTo(tailX, maxW);
        ctx.lineTo(curLen * 0.26, 0);
        ctx.closePath();
        ctx.fill();

        // 3. 3D 圓錐上半「受光亮面」（耀金 -> 熾白高光，與下半暗面形成強烈立體對比）
        const lightGrad = ctx.createLinearGradient(tailX, -maxW, tipX, 0);
        lightGrad.addColorStop(0, "rgba(217, 119, 6, 0.32)");
        lightGrad.addColorStop(0.45, "rgba(250, 204, 21, 0.94)");
        lightGrad.addColorStop(1, "rgba(255, 255, 255, 0.98)");
        ctx.fillStyle = lightGrad;
        ctx.beginPath();
        ctx.moveTo(tipX, 0);
        ctx.lineTo(tailX, -maxW);
        ctx.lineTo(curLen * 0.26, 0);
        ctx.closePath();
        ctx.fill();

        // 圓錐外廓立體深褐描邊與中央高壓白熾脊線 (3D Spine Ridge)
        ctx.strokeStyle = "#78350F";
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(tailX, -maxW);
        ctx.lineTo(tipX, 0);
        ctx.lineTo(tailX, maxW);
        ctx.stroke();

        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 3.8;
        ctx.beginPath();
        ctx.moveTo(curLen * 0.24, 0);
        ctx.lineTo(tipX, 0);
        ctx.stroke();

        // 4. 包覆圓錐表面的 3D 弧形螺旋鑽紋（調慢至 now * 6.5 沉穩推進）
        for (let seg = 1; seg <= 4; seg++) {
          const t = seg / 5;
          const sxSeg = curLen * (0.24 + t * 0.72);
          const wSeg = maxW * (1 - t * 0.82);
          const phase = Math.sin(now * 6.5 + seg * 1.4) * (wSeg * 0.28);

          ctx.strokeStyle = "rgba(120, 53, 15, 0.78)";
          ctx.lineWidth = 4.4;
          ctx.beginPath();
          ctx.moveTo(sxSeg - 9, -wSeg + 2);
          ctx.quadraticCurveTo(sxSeg + 6, phase + 2, sxSeg + 9, wSeg - 2);
          ctx.stroke();

          ctx.strokeStyle = "#FEF08A";
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.moveTo(sxSeg - 9, -wSeg + 2);
          ctx.quadraticCurveTo(sxSeg + 6, phase, sxSeg + 9, wSeg - 2);
          ctx.stroke();
        }

        // 5. 纏繞鑽頭外圍的黑紅霸王氣浪閃電弧
        [-1, 1].forEach(side => {
          ctx.strokeStyle = "#DC2626";
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.moveTo(curLen * 0.28, side * maxW * 0.55);
          ctx.lineTo(curLen * 0.55, side * (maxW * 0.72 + Math.sin(now * 8 + side) * 4));
          ctx.lineTo(curLen * 0.86, side * maxW * 0.22);
          ctx.stroke();
        });

        // 6. 音爆雲「前半高光環」（跨過鑽頭正上方，完成 3D 環繞透視）與頂點八芒破空星
        [0.28, 0.54, 0.78].forEach((rPos, idx) => {
          const rx = curLen * rPos;
          const ry = maxW * (1.18 - idx * 0.24);
          ctx.strokeStyle = idx === 2 ? "#FFFFFF" : "#FEF08A";
          ctx.lineWidth = 3.2 - idx * 0.5;
          ctx.beginPath();
          ctx.ellipse(rx, 0, ry * 0.34, ry, 0, -Math.PI * 0.5, Math.PI * 0.5);
          ctx.stroke();
        });

        const starR = 14 * (1 - prog * 0.3);
        ctx.fillStyle = "#FFFFFF";
        ctx.strokeStyle = "#F59E0B";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(tipX + starR, 0);
        ctx.lineTo(tipX + 3, -3);
        ctx.lineTo(tipX, -starR);
        ctx.lineTo(tipX - 3, -3);
        ctx.lineTo(tipX - starR * 0.6, 0);
        ctx.lineTo(tipX - 3, 3);
        ctx.lineTo(tipX, starR);
        ctx.lineTo(tipX + 3, 3);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      } else if (m.style === "electric_cheek_aura") {
        // 【比卡超】：外圍 30px 電氣蓄電環（淨空中心）
        const cx = m.casterRef ? toSx(m.casterRef.x) : toSx(m.x);
        const cy = m.casterRef ? toSy(m.casterRef.y) : toSy(m.y);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = m.color || "#FACC15";
        ctx.lineWidth = 2.2;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.arc(0, 0, m.radius + prog * 6, now * 5, now * 5 + Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else if (m.style === "metronome_wheel") {
        // 【揮指功超武・天命百寶袋】：主角頭頂短暫浮現旋轉黃金星輪與 3 顆隨機屬性微徽章
        const cx = m.casterRef ? toSx(m.casterRef.x) : toSx(m.x);
        const cy = (m.casterRef ? toSy(m.casterRef.y) : toSy(m.y)) - 38 - prog * 10;
        const wheelR = m.radius * (0.75 + Math.sin(prog * Math.PI) * 0.35);
        const alpha = Math.sin(prog * Math.PI);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.globalAlpha = Math.max(0, alpha);

        // 外圍黃金星輪光環
        ctx.strokeStyle = "#FACC15";
        ctx.lineWidth = 2.6;
        ctx.setLineDash([7, 4]);
        ctx.beginPath();
        ctx.arc(0, 0, wheelR, prog * 5, prog * 5 + Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // 中央旋轉六芒金星
        ctx.save();
        ctx.rotate(prog * 6.5);
        ctx.fillStyle = "#FEF08A";
        ctx.strokeStyle = "#B45309";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        for (let k = 0; k < 6; k++) {
          const a1 = (k * Math.PI) / 3;
          const a2 = a1 + Math.PI / 6;
          if (k === 0) ctx.moveTo(Math.cos(a1) * 11, Math.sin(a1) * 11);
          else ctx.lineTo(Math.cos(a1) * 11, Math.sin(a1) * 11);
          ctx.lineTo(Math.cos(a2) * 4.5, Math.sin(a2) * 4.5);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        // 三顆對應本次搖出屬性的公轉微寶石徽章
        const cols = m.rolledColors || ["#EF4444", "#38BDF8", "#FACC15"];
        cols.forEach((col, idx) => {
          const a = -Math.PI / 2 + prog * 4.2 + (idx * Math.PI * 2) / 3;
          const gx = Math.cos(a) * wheelR;
          const gy = Math.sin(a) * wheelR;
          ctx.fillStyle = col;
          ctx.strokeStyle = "#FFFFFF";
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.arc(gx, gy, 5.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        });
        ctx.restore();
      } else if (m.style === "ice_shatter_flash") {
        // 【絕對零度二段破冰】：高空折射冰稜裂紋放射閃光＋六角棱鏡碎裂環
        const msx = toSx(m.x), msy = toSy(m.y);
        const curR = m.radius * (0.42 + prog * 0.68);
        const alpha = Math.max(0, 1 - prog);
        ctx.save();
        ctx.translate(msx, msy);
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = alpha * 0.92;

        // 1. 六角棱鏡碎裂外環
        ctx.strokeStyle = "#E0F2FE";
        ctx.lineWidth = 4.2 * alpha;
        ctx.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = (k * Math.PI) / 3 + prog * 0.25;
          const px = Math.cos(a) * curR;
          const py = Math.sin(a) * curR;
          if (k === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();

        // 2. 12 道高空折射冰稜放射裂紋光束（保留中央 38px 淨空）
        for (let k = 0; k < 12; k++) {
          const a = (k * Math.PI) / 6 + (k % 2 === 0 ? 0.08 : -0.08);
          const r0 = 38 + prog * 28;
          const r1 = curR * (k % 2 === 0 ? 1.06 : 0.78);
          ctx.strokeStyle = k % 2 === 0 ? "#FFFFFF" : "#67E8F9";
          ctx.lineWidth = (k % 2 === 0 ? 3.0 : 1.8) * alpha;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
          ctx.lineTo(Math.cos(a + 0.05) * ((r0 + r1) * 0.5), Math.sin(a + 0.05) * ((r0 + r1) * 0.5));
          ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
          ctx.stroke();
        }
        ctx.restore();
      } else if (m.style === "psy_collapse_star") {
        // 【精神擊破終點二段引爆】：銳利乾淨的粉白四芒星坍縮閃光＋細微內縮環
        const msx = toSx(m.x), msy = toSy(m.y);
        const alpha = Math.max(0, 1 - prog);
        const starR = m.radius * (0.45 + Math.sin(prog * Math.PI) * 0.65);
        ctx.save();
        ctx.translate(msx, msy);
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = alpha;

        // 細微坍縮念力環
        ctx.strokeStyle = "#F472B6";
        ctx.lineWidth = 2.2 * alpha;
        ctx.beginPath();
        ctx.arc(0, 0, m.radius * (1.05 - prog * 0.65), 0, Math.PI * 2);
        ctx.stroke();

        // 銳利粉白四芒星閃光
        ctx.rotate(prog * 0.9);
        ctx.fillStyle = "#EC4899";
        ctx.beginPath();
        ctx.moveTo(0, -starR); ctx.lineTo(starR * 0.22, -starR * 0.22);
        ctx.lineTo(starR, 0); ctx.lineTo(starR * 0.22, starR * 0.22);
        ctx.lineTo(0, starR); ctx.lineTo(-starR * 0.22, starR * 0.22);
        ctx.lineTo(-starR, 0); ctx.lineTo(-starR * 0.22, -starR * 0.22);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "#FFFFFF";
        const inR = starR * 0.58;
        ctx.beginPath();
        ctx.moveTo(0, -inR); ctx.lineTo(inR * 0.20, -inR * 0.20);
        ctx.lineTo(inR, 0); ctx.lineTo(inR * 0.20, inR * 0.20);
        ctx.lineTo(0, inR); ctx.lineTo(-inR * 0.20, inR * 0.20);
        ctx.lineTo(-inR, 0); ctx.lineTo(-inR * 0.20, -inR * 0.20);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else if (m.style === "z_spark") {
        // 【比卡超十萬伏特命中】：金白十字電火花
        const msx = toSx(m.x), msy = toSy(m.y);
        const s = m.radius * (0.6 + prog * 0.5);
        ctx.save();
        ctx.translate(msx, msy);
        ctx.rotate(prog * 1.5);
        ctx.fillStyle = "#FACC15";
        ctx.beginPath();
        ctx.moveTo(0, -s); ctx.lineTo(s * 0.25, -s * 0.25);
        ctx.lineTo(s, 0); ctx.lineTo(s * 0.25, s * 0.25);
        ctx.lineTo(0, s); ctx.lineTo(-s * 0.25, s * 0.25);
        ctx.lineTo(-s, 0); ctx.lineTo(-s * 0.25, -s * 0.25);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.28, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (m.style === "slam_wave") {
        const msx = toSx(m.x), msy = toSy(m.y);
        const curR = m.radius * (0.35 + prog * 0.65);
        ctx.save();
        ctx.translate(msx, msy);
        ctx.strokeStyle = "#0F172A";
        ctx.lineWidth = 5.0 * (1 - prog * 0.5);
        ctx.beginPath();
        ctx.arc(0, 0, curR, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = m.color || "#FACC15";
        ctx.lineWidth = 3.0 * (1 - prog * 0.5);
        ctx.beginPath();
        ctx.arc(0, 0, curR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else {
        const osx = toSx(m.ox !== undefined ? m.ox : m.x);
        const osy = toSy(m.oy !== undefined ? m.oy : m.y);
        const curR = m.radius * (0.28 + prog * 0.75);
        ctx.translate(osx, osy);
        ctx.rotate(m.angle || 0);

        ctx.fillStyle = "#1E1B4B";
        ctx.strokeStyle = m.color || "#4338CA";
        ctx.lineWidth = 4.2;
        ctx.beginPath();
        ctx.arc(0, 0, curR, -0.9, 0.9);
        ctx.arc(0, 0, curR * 0.42, 0.9, -0.9, true);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 3.0;
        ctx.beginPath();
        ctx.arc(0, 0, curR, -0.82, 0.82);
        ctx.stroke();
      }
      ctx.restore();
    });

    // 3. 超武啟動外環提示（避開主角中心 40px，只向外擴散）
    this.ultimateVfxList.forEach(u => {
      const prog = Math.max(0, Math.min(1, 1 - (u.timer / (u.maxTime || 1.0))));
      const usx = toSx(u.x), usy = toSy(u.y);
      ctx.save();
      ctx.translate(usx, usy);
      ctx.globalAlpha = Math.max(0, 1 - prog * 0.85);
      const ringR = 32 + prog * 112;
      ctx.strokeStyle = u.color || "#FACC15";
      ctx.lineWidth = 4.5 * (1 - prog * 0.5);
      ctx.beginPath();
      ctx.arc(0, 0, ringR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    });

    // 4. 具象化投射物彈幕 (projectiles)
    this.projectiles.forEach(pr => {
      const sx = toSx(pr.x), sy = toSy(pr.y);
      const r = pr.radius;
      ctx.save();
      ctx.translate(sx, sy);

      if (pr.vfx === "ember_spark") {
        // 【小火龍・火花（Ember）】：不規則跳動像素火星簇（高溫明黃火芯 ＋ 3 顆錯落閃爍菱形／方形火星）
        const seed = pr.cinderSeed || (pr.x * 0.13);
        const flicker = Math.sin(now * 28 + seed);
        const vr = Math.min(11.5, r * 0.68);
        const jx = Math.cos(now * 34 + seed) * 1.4;
        const jy = Math.sin(now * 31 + seed * 1.7) * 1.4;

        ctx.rotate(pr.angle || 0);

        // 1. 柔和赤橘熱暈外層（營造高溫餘燼感，不再是硬邊子彈）
        const halo = ctx.createRadialGradient(jx, jy, 1.5, jx, jy, vr * 1.15);
        halo.addColorStop(0, "rgba(254, 240, 138, 0.85)");
        halo.addColorStop(0.5, "rgba(249, 115, 22, 0.55)");
        halo.addColorStop(1, "rgba(220, 38, 38, 0)");
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(jx, jy, vr * 1.15, 0, Math.PI * 2);
        ctx.fill();

        // 2. 主火星：高頻跳動的不規則菱形火芯（外赤紅 ➔ 中熾橘 ➔ 內白黃）
        const cs = vr * (0.62 + flicker * 0.12);
        ctx.save();
        ctx.translate(jx, jy);
        ctx.rotate(flicker * 0.35);
        ctx.fillStyle = "#DC2626";
        ctx.beginPath();
        ctx.moveTo(cs * 1.15, 0); ctx.lineTo(0, -cs * 0.85);
        ctx.lineTo(-cs * 1.35, 0); ctx.lineTo(0, cs * 0.85);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "#F97316";
        ctx.beginPath();
        ctx.moveTo(cs * 0.82, 0); ctx.lineTo(0, -cs * 0.58);
        ctx.lineTo(-cs * 0.95, 0); ctx.lineTo(0, cs * 0.58);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "#FEF9C3";
        ctx.fillRect(-cs * 0.30, -cs * 0.30, cs * 0.60, cs * 0.60);
        ctx.restore();

        // 3. 周圍 3 顆錯落閃爍的方形／菱形像素火星碎屑
        const embers = [
          { ox: -vr * 0.72, oy: -vr * 0.58 + Math.sin(now * 24 + seed) * 2.4, sz: 3.6, col: "#FEF08A" },
          { ox: -vr * 0.98, oy:  vr * 0.50 + Math.cos(now * 26 + seed) * 2.4, sz: 3.0, col: "#FB923C" },
          { ox: -vr * 1.48, oy:  Math.sin(now * 20 + seed * 2) * 3.2,         sz: 2.4, col: "#EF4444" }
        ];
        embers.forEach((em, idx) => {
          ctx.save();
          ctx.translate(em.ox, em.oy);
          ctx.rotate(now * (idx % 2 === 0 ? 5 : -5) + seed);
          ctx.fillStyle = em.col;
          ctx.fillRect(-em.sz * 0.5, -em.sz * 0.5, em.sz, em.sz);
          ctx.restore();
        });

      } else if (pr.vfx === "fire_stream") {
        // 【噴火龍／火焰鳥・噴射火焰（視覺精悍修長版）】：保留完整大範圍傷害判定 r，視覺半徑收斂於 vr (上限 17px)，呈現俐落修長噴射火舌
        ctx.rotate(pr.angle || 0);
        const vr = Math.min(17, r * 0.72);
        const flicker = Math.sin(now * 9 + pr.x * 0.05) * (vr * 0.16);

        // 尾端微縮淡煙霧團
        ctx.fillStyle = "rgba(30, 41, 59, 0.32)";
        ctx.beginPath();
        ctx.arc(-vr * 1.10, flicker * 0.5, vr * 0.34, 0, Math.PI * 2);
        ctx.fill();

        // 深紅外廓修長火舌（略微壓扁寬度、拉長尾焰，呈現高速噴射流線感）
        ctx.fillStyle = "#991B1B";
        ctx.beginPath();
        ctx.arc(vr * 0.28, 0, vr * 0.72, -Math.PI / 2, Math.PI / 2);
        ctx.lineTo(-vr * 1.32, vr * 0.46 + flicker);
        ctx.lineTo(-vr * 0.72, 0);
        ctx.lineTo(-vr * 1.32, -vr * 0.46 + flicker);
        ctx.closePath();
        ctx.fill();

        // 橘紅翻湧主火身
        ctx.fillStyle = "#F97316";
        ctx.beginPath();
        ctx.arc(vr * 0.28, 0, vr * 0.56, -Math.PI / 2, Math.PI / 2);
        ctx.lineTo(-vr * 1.05, vr * 0.32 + flicker);
        ctx.lineTo(-vr * 0.50, 0);
        ctx.lineTo(-vr * 1.05, -vr * 0.32 + flicker);
        ctx.closePath();
        ctx.fill();

        // 明黃高溫內焰
        ctx.fillStyle = "#FACC15";
        ctx.beginPath();
        ctx.ellipse(vr * 0.18, 0, vr * 0.46, vr * 0.28, 0, 0, Math.PI * 2);
        ctx.fill();

        // 純白熾熱火芯
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.ellipse(vr * 0.32, 0, vr * 0.24, vr * 0.14, 0, 0, Math.PI * 2);
        ctx.fill();

      } else if (pr.vfx === "water_gun") {
        // 【傑尼龜・水槍（Water Gun）】：流線型高壓水彈 ＋ 尾部雙股波浪水痕 ＋ 前端浪花弧與飛濺水珠（告別尖銳飛鏢感）
        ctx.rotate(pr.angle || 0);
        const vr = Math.min(13.5, r * 0.80);
        const wave = Math.sin(now * 12 + pr.y * 0.08) * (vr * 0.20);

        // 1. 尾部雙股螺旋波浪水痕拖尾
        ctx.strokeStyle = "rgba(56, 189, 248, 0.75)";
        ctx.lineWidth = 2.4;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(0, -vr * 0.32);
        ctx.quadraticCurveTo(-vr * 0.85, -vr * 0.55 + wave, -vr * 1.65, -vr * 0.20 - wave);
        ctx.moveTo(0, vr * 0.32);
        ctx.quadraticCurveTo(-vr * 0.85, vr * 0.55 + wave, -vr * 1.65, vr * 0.20 - wave);
        ctx.stroke();

        // 2. 流線水滴狀主水彈（前頭渾圓飽滿、後方收束）
        ctx.fillStyle = "#0284C7";
        ctx.beginPath();
        ctx.arc(vr * 0.30, 0, vr * 0.62, -Math.PI * 0.52, Math.PI * 0.52);
        ctx.quadraticCurveTo(-vr * 0.45, vr * 0.42, -vr * 1.25, wave * 0.4);
        ctx.quadraticCurveTo(-vr * 0.45, -vr * 0.42, vr * 0.30, -vr * 0.62);
        ctx.closePath();
        ctx.fill();

        // 3. 內層亮青色清澈水體
        ctx.fillStyle = "#38BDF8";
        ctx.beginPath();
        ctx.ellipse(vr * 0.22, 0, vr * 0.58, vr * 0.42, 0, 0, Math.PI * 2);
        ctx.fill();

        // 4. 前端純白高壓水花弧頂與飛濺小水珠
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(vr * 0.34, 0, vr * 0.48, -0.85, 0.85);
        ctx.stroke();

        ctx.fillStyle = "#E0F2FE";
        ctx.beginPath();
        ctx.arc(vr * 0.52, -vr * 0.58, 2.0, 0, Math.PI * 2);
        ctx.arc(vr * 0.52, vr * 0.58, 2.0, 0, Math.PI * 2);
        ctx.arc(-vr * 0.85, wave * 0.5, 2.2, 0, Math.PI * 2);
        ctx.fill();

      } else if (pr.vfx === "water_beam") {
        // 【水箭龜・V10 高壓水炮】：正弦波紋流體水柱 ＋ 中央白熾高壓水芯 ＋ 內部密集氣泡流 ＋ 前端半圓翻滾浪花衝擊冠（告別箭頭感）
        ctx.rotate(pr.angle || 0);
        const tailLen = r * 2.5;
        const halfW = r * 0.62;

        // 1. 正弦波紋流體外廓水柱
        ctx.fillStyle = "rgba(2, 132, 199, 0.82)";
        ctx.beginPath();
        ctx.moveTo(-tailLen, -halfW * 0.7);
        for (let x = -tailLen; x <= r * 0.4; x += 9) {
          const wv = Math.sin(now * 10 + x * 0.18) * 3.0;
          ctx.lineTo(x, -halfW + wv);
        }
        for (let x = r * 0.4; x >= -tailLen; x -= 9) {
          const wv = Math.sin(now * 10 + x * 0.18) * 3.0;
          ctx.lineTo(x, halfW + wv);
        }
        ctx.closePath();
        ctx.fill();

        // 2. 中層晶瑩亮青水流 (#00D2FF)
        ctx.fillStyle = "rgba(0, 210, 255, 0.88)";
        ctx.beginPath();
        ctx.roundRect(-tailLen * 0.9, -halfW * 0.68, tailLen * 0.9 + r * 0.35, halfW * 1.36, halfW * 0.5);
        ctx.fill();

        // 3. 中央高壓純白水芯
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 3.8;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(-tailLen * 0.78, 0);
        ctx.lineTo(r * 0.35, 0);
        ctx.stroke();

        // 4. 內部高速穿梭氣泡流 (Bubbles)
        ctx.fillStyle = "#E0FFFF";
        for (let b = -tailLen * 0.75; b <= r * 0.15; b += 14) {
          const by = Math.sin(now * 12 + b * 0.25) * (halfW * 0.45);
          ctx.beginPath();
          ctx.arc(b, by, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }

        // 5. 前端半圓翻滾白色浪花衝擊冠 + 飛濺水沫圓珠
        ctx.fillStyle = "#FFFFFF";
        ctx.strokeStyle = "#BAE6FD";
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.arc(r * 0.35, 0, halfW * 1.18, -Math.PI / 2, Math.PI / 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#E0FFFF";
        ctx.beginPath();
        ctx.arc(r * 0.55, -halfW * 0.95, 3.2, 0, Math.PI * 2);
        ctx.arc(r * 0.55, halfW * 0.95, 3.2, 0, Math.PI * 2);
        ctx.arc(r * 0.85, -halfW * 0.45, 2.5, 0, Math.PI * 2);
        ctx.arc(r * 0.85, halfW * 0.45, 2.5, 0, Math.PI * 2);
        ctx.fill();

      } else if (pr.vfx === "shadow_orb") {
        // 【耿鬼・暗影球】：純黑奇點核心 ＋ 不規則跳動紫黑幽冥鬼火外殼 ＋ 蒼白閃電紋
        const rot = -now * 2.8;
        ctx.save();
        ctx.rotate(rot);

        // 不規則跳動幽冥鬼火外殼（8 瓣鋸齒火焰）
        ctx.fillStyle = "#581C87";
        ctx.beginPath();
        for (let k = 0; k < 16; k++) {
          const a = (k * Math.PI * 2) / 16;
          const rad = (k % 2 === 0) ? r * (0.98 + Math.sin(now * 5.0 + k) * 0.12) : r * 0.72;
          const px = Math.cos(a) * rad, py = Math.sin(a) * rad;
          if (k === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();

        // 純黑奇點核心
        ctx.fillStyle = "#05050A";
        ctx.strokeStyle = "#C084FC";
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.64, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // 球體表面蒼白閃電紋
        ctx.strokeStyle = "#F3E8FF";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-r * 0.35, -r * 0.15);
        ctx.lineTo(-r * 0.05, r * 0.05);
        ctx.lineTo(r * 0.25, -r * 0.22);
        ctx.stroke();
        ctx.restore();

      } else if (pr.vfx === "gengar_phantom") {
        // 【耿鬼超武・迷你經典壞笑耿鬼小鬼】：保持正面直立（僅隨移動方向微傾），具備尖耳刺毛、血紅三角邪眼與裂到耳根的白色鋸齒弦月壞笑！
        const moveX = Math.cos(pr.angle || 0);
        const moveY = Math.sin(pr.angle || 0);

        // 1. 身後逆時針暗靈幽冥尾氣（朝運動反方向飄曳）
        ctx.save();
        ctx.rotate(pr.angle || 0);
        ctx.fillStyle = "rgba(88, 28, 135, 0.58)";
        ctx.beginPath();
        ctx.arc(-r * 0.55, 0, r * 0.68, 0, Math.PI * 2);
        ctx.arc(-r * 1.15, Math.sin(now * 10 + pr.x) * 3, r * 0.45, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // 2. 迷你耿鬼本體（帶左右尖耳與頭頂三根刺毛）
        const tilt = moveX * 0.14;
        ctx.rotate(tilt);

        ctx.fillStyle = "#2E1065";
        ctx.strokeStyle = "#A855F7";
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        // 左尖耳
        ctx.moveTo(-r * 0.45, -r * 0.52);
        ctx.lineTo(-r * 0.92, -r * 1.05);
        ctx.lineTo(-r * 0.18, -r * 0.72);
        // 頭頂刺毛
        ctx.lineTo(0, -r * 0.96);
        ctx.lineTo(r * 0.18, -r * 0.72);
        // 右尖耳
        ctx.lineTo(r * 0.92, -r * 1.05);
        ctx.lineTo(r * 0.45, -r * 0.52);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 圓滾滾的紫黑身體
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.78, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // 3. 經典血紅上吊三角邪眼
        ctx.fillStyle = "#EF4444";
        ctx.beginPath();
        ctx.moveTo(-r * 0.48, -r * 0.28);
        ctx.lineTo(-r * 0.12, -r * 0.08);
        ctx.lineTo(-r * 0.42, -r * 0.02);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(r * 0.48, -r * 0.28);
        ctx.lineTo(r * 0.12, -r * 0.08);
        ctx.lineTo(r * 0.42, -r * 0.02);
        ctx.closePath();
        ctx.fill();

        // 4. 經典裂到耳根的白色鋸齒弦月壞笑
        ctx.fillStyle = "#F8FAFC";
        ctx.strokeStyle = "#1E1B4B";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(0, r * 0.06, r * 0.52, 0.12 * Math.PI, 0.88 * Math.PI);
        ctx.quadraticCurveTo(0, r * 0.26, -r * 0.52 * Math.cos(0.12 * Math.PI), r * 0.06 + r * 0.52 * Math.sin(0.12 * Math.PI));
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 壞笑牙齒豎線
        ctx.strokeStyle = "#3B0764";
        ctx.lineWidth = 1.1;
        [-r * 0.24, 0, r * 0.24].forEach(tx => {
          ctx.beginPath();
          ctx.moveTo(tx, r * 0.18);
          ctx.lineTo(tx, r * 0.52);
          ctx.stroke();
        });

      } else if (pr.vfx === "psychic_lance") {
        // 【精神擊破（精悍凝縮版）】：保留原始大範圍傷害判定 r，但視覺尺寸收斂為 vr (上限 15px)，呈現銳利破空念力梭
        const vr = Math.min(15, r * 0.68);
        ctx.rotate(pr.angle || 0);

        [-11, -5].forEach((ox, idx) => {
          const scale = 0.72 + idx * 0.14;
          ctx.strokeStyle = idx === 0 ? "rgba(192, 132, 252, 0.40)" : "rgba(244, 114, 182, 0.68)";
          ctx.lineWidth = 2.0;
          ctx.beginPath();
          ctx.ellipse(ox, 0, vr * 0.30 * scale, vr * 0.76 * scale, 0, 0, Math.PI * 2);
          ctx.stroke();
        });

        ctx.fillStyle = "#3B0764";
        ctx.beginPath();
        ctx.arc(3, 0, vr * 0.92, -0.65, 0.65);
        ctx.arc(1, 0, vr * 0.42, 0.65, -0.65, true);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = "#EC4899";
        ctx.lineWidth = 3.0;
        ctx.beginPath();
        ctx.arc(3, 0, vr * 0.92, -0.62, 0.62);
        ctx.stroke();

        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(4, 0, vr * 0.92, -0.55, 0.55);
        ctx.stroke();

      } else if (pr.vfx === "sludge_lob" || pr.vfx === "sludge_ball") {
        if (pr.vfx === "sludge_lob" && pr.startX !== undefined) {
          const t = Math.min(1, pr.progress || 0);
          const groundY = (pr.startY + (pr.targetY - pr.startY) * t) - pr.y;
          ctx.fillStyle = "rgba(15, 23, 42, 0.38)";
          ctx.beginPath();
          ctx.ellipse(0, groundY + 8, r * (0.55 + 0.45 * Math.abs(t - 0.5)), r * 0.28, 0, 0, Math.PI * 2);
          ctx.fill();
          const liftScale = 1 + Math.sin(t * Math.PI) * 0.32;
          ctx.scale(liftScale, liftScale);
        }
        ctx.rotate(pr.angle || 0);
        ctx.fillStyle = "#3B0764";
        ctx.beginPath(); ctx.arc(0, 0, r * 0.92, 0, Math.PI * 2); ctx.fill();

        ctx.fillStyle = "#7E22CE";
        ctx.beginPath(); ctx.arc(0, 0, r * 0.76, 0, Math.PI * 2); ctx.fill();

        ctx.fillStyle = "#4ADE80";
        ctx.beginPath();
        ctx.arc(-r * 0.25, -r * 0.2, r * 0.26, 0, Math.PI * 2);
        ctx.arc(r * 0.28, r * 0.15, r * 0.22, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath(); ctx.arc(-r * 0.3, -r * 0.28, r * 0.1, 0, Math.PI * 2); ctx.fill();

      } else if (pr.vfx === "giant_fist") {
        // 【爆裂十字劈・3層立體武神百裂重拳】：後方赤紅殘影與破空音爆環 ＋ 立體四指節金紅重拳 ＋ 前端白熾氣勁波
        ctx.rotate(pr.angle || 0);

        // 1. 後方 2 層半透明赤紅拳影與白色音爆氣環
        [-18, -9].forEach((tx, idx) => {
          ctx.fillStyle = idx === 0 ? "rgba(185, 28, 28, 0.28)" : "rgba(239, 68, 68, 0.45)";
          ctx.beginPath();
          ctx.roundRect(tx - 14, -13, 24, 26, 7);
          ctx.fill();
        });

        ctx.strokeStyle = "rgba(254, 240, 138, 0.75)";
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.ellipse(-6, 0, 7, 22, 0, 0, Math.PI * 2);
        ctx.stroke();

        // 2. 重拳立體暗部底座與赤紅主拳體
        ctx.fillStyle = "#7F1D1D";
        ctx.beginPath();
        ctx.roundRect(-18, -17, 34, 34, 9);
        ctx.fill();

        ctx.fillStyle = pr.color || "#DC2626";
        ctx.strokeStyle = "#FACC15";
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.roundRect(-16, -15, 30, 30, 8);
        ctx.fill();
        ctx.stroke();

        // 3. 前端四顆立體凸出黃金指節與破空拳風弧線
        ctx.fillStyle = "#FEF08A";
        ctx.strokeStyle = "#991B1B";
        ctx.lineWidth = 1.4;
        for (let k = -1.5; k <= 1.5; k += 1) {
          ctx.beginPath();
          ctx.roundRect(8, k * 7.2 - 3.2, 8, 6.4, 3);
          ctx.fill();
          ctx.stroke();
        }

        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(6, 0, 21, -0.68, 0.68);
        ctx.stroke();
      } else if (pr.vfx === "bullet_seed") {
        // 【種子機關槍（Bullet Seed）】：飽滿高速黃金流光種子彈（視覺半徑 8.5px，貼近判定框且連射感明確）
        ctx.rotate(pr.angle || 0);
        const vr = 8.5;

        // 尾部翠綠高速流光線
        const tailGrad = ctx.createLinearGradient(-vr * 3.2, 0, 0, 0);
        tailGrad.addColorStop(0, "rgba(132, 204, 22, 0)");
        tailGrad.addColorStop(1, "rgba(190, 242, 100, 0.85)");
        ctx.fillStyle = tailGrad;
        ctx.beginPath();
        ctx.moveTo(0, -vr * 0.55);
        ctx.lineTo(-vr * 3.2, 0);
        ctx.lineTo(0, vr * 0.55);
        ctx.closePath();
        ctx.fill();

        // 黃金種子本體（前尖後圓水滴形）
        ctx.fillStyle = "#65A30D";
        ctx.strokeStyle = "#365314";
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.ellipse(0, 0, vr * 1.18, vr * 0.76, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#FEF08A";
        ctx.beginPath();
        ctx.ellipse(vr * 0.22, -vr * 0.16, vr * 0.55, vr * 0.32, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (pr.vfx === "seed_nut") {
        // 【種子炸彈】：精巧化木紋橡子（視覺上限鎖定 11px，保留高空拋物線縮放與地面黑影）
        const vr = Math.min(11, r * 0.65);
        if (pr.startX !== undefined) {
          const t = Math.min(1, pr.progress || 0);
          const groundY = (pr.startY + (pr.targetY - pr.startY) * t) - pr.y;
          ctx.fillStyle = "rgba(15, 23, 42, 0.34)";
          ctx.beginPath();
          ctx.ellipse(0, groundY + 6, vr * 0.75, vr * 0.32, 0, 0, Math.PI * 2);
          ctx.fill();
          const liftScale = 1 + Math.sin(t * Math.PI) * 0.25;
          ctx.scale(liftScale, liftScale);
        }
        ctx.rotate(pr.angle || 0);
        ctx.fillStyle = "#3F6212";
        ctx.beginPath();
        ctx.ellipse(0, vr * 0.18, vr * 0.82, vr * 0.95, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#65A30D";
        ctx.beginPath();
        ctx.ellipse(0, vr * 0.18, vr * 0.70, vr * 0.82, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#78350F";
        ctx.strokeStyle = "#451A03";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(0, -vr * 0.22, vr * 0.84, Math.PI, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#BEF264";
        ctx.beginPath();
        ctx.arc(-vr * 0.24, vr * 0.1, vr * 0.2, 0, Math.PI * 2);
        ctx.fill();
      } else if (pr.vfx === "frost_beam") {
        // 【冷凍光線】：雙股交錯寒冰光束 ＋ 沿途閃爍六角雪花結晶
        ctx.rotate(pr.angle || 0);
        ctx.strokeStyle = "#0284C7";
        ctx.lineWidth = 4.5;
        ctx.beginPath();
        for (let x = -r * 1.8; x <= r * 0.6; x += 6) {
          const y = Math.sin(x * 0.25 + now * 5.5) * 4.5;
          if (x === -r * 1.8) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        ctx.strokeStyle = "#E0F2FE";
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        for (let x = -r * 1.8; x <= r * 0.6; x += 6) {
          const y = -Math.sin(x * 0.25 + now * 5.5) * 4.5;
          if (x === -r * 1.8) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // 前端雙色切面冰稜槍頭
        ctx.fillStyle = "#0369A1";
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(r * 1.4, 0); ctx.lineTo(0, -r * 0.62); ctx.lineTo(-r * 0.85, 0); ctx.lineTo(0, r * 0.62);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#BAE6FD";
        ctx.beginPath();
        ctx.moveTo(r * 1.28, 0); ctx.lineTo(0, -r * 0.52); ctx.lineTo(-r * 0.75, 0);
        ctx.closePath();
        ctx.fill();
      } else if (pr.vfx === "leaf_blade" || pr.vfx === "seed_cluster") {
        // 【飛葉快刀（Razor Leaf 視覺精悍化）】：移除外圍笨重圓框，視覺半徑鎖定上限 13px（長約 28px 修長柳葉飛刀），保留原本大範圍傷害判定 r
        const vr = Math.min(13, r * 0.62);
        ctx.save();
        ctx.rotate(pr.angle || 0);
        [-14, -7].forEach((tx, idx) => {
          ctx.strokeStyle = idx === 0 ? "rgba(34, 197, 94, 0.32)" : "rgba(134, 239, 172, 0.65)";
          ctx.lineWidth = 2.8 - idx * 0.8;
          ctx.beginPath();
          ctx.arc(tx, 0, vr * (0.68 + idx * 0.12), -0.52, 0.52);
          ctx.stroke();
        });
        ctx.restore();

        const spinAng = (pr.angle || 0) + now * 4.8;
        ctx.rotate(spinAng);

        // 修長柳葉刀身（寬度由 0.68 壓窄至 0.44，俐落銳利）
        ctx.fillStyle = "#15803D";
        ctx.strokeStyle = "#052E16";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(vr * 1.15, 0);
        ctx.quadraticCurveTo(0, vr * 0.44, -vr * 1.15, 0);
        ctx.quadraticCurveTo(0, -vr * 0.44, vr * 1.15, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#4ADE80";
        ctx.beginPath();
        ctx.moveTo(vr * 1.10, 0);
        ctx.quadraticCurveTo(0, -vr * 0.40, -vr * 1.10, 0);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = "#ECFCCB";
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(-vr * 0.90, 0);
        ctx.lineTo(vr * 0.90, 0);
        ctx.stroke();

      } else if (pr.vfx === "wind_blade") {
        // 【空氣斬（對齊新圖標・雙重銀青真空月牙風刃 ＋ 破風氣流線）】
        const vr = Math.min(15.5, r * 0.72);
        const flyAng = (pr.vx || pr.vy) ? Math.atan2(pr.vy, pr.vx) : (pr.angle || 0);

        // 1. 沿飛行方向的斜向破風氣流尾跡（不隨自轉亂晃）
        ctx.save();
        ctx.rotate(flyAng);
        ctx.strokeStyle = "rgba(186, 230, 253, 0.68)";
        ctx.lineWidth = 1.8;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(-vr * 0.35, -vr * 0.58); ctx.lineTo(-vr * 1.65, -vr * 0.42);
        ctx.moveTo(-vr * 0.25, 0);          ctx.lineTo(-vr * 1.95, 0);
        ctx.moveTo(-vr * 0.35, vr * 0.58);  ctx.lineTo(-vr * 1.65, vr * 0.42);
        ctx.stroke();
        ctx.restore();

        // 2. 雙片對稱銀白淺青紫銳利月牙風刃（高速自轉切割）
        ctx.rotate(pr.angle || 0);
        [0, Math.PI].forEach((rotOff, idx) => {
          ctx.save();
          ctx.rotate(rotOff);
          const bladeGrad = ctx.createLinearGradient(-vr, -vr, vr, vr);
          if (idx === 0) {
            bladeGrad.addColorStop(0, "rgba(224, 242, 254, 0.96)");
            bladeGrad.addColorStop(0.55, "rgba(186, 230, 253, 0.92)");
            bladeGrad.addColorStop(1, "rgba(165, 180, 252, 0.85)");
          } else {
            bladeGrad.addColorStop(0, "rgba(241, 245, 249, 0.94)");
            bladeGrad.addColorStop(0.55, "rgba(199, 210, 254, 0.90)");
            bladeGrad.addColorStop(1, "rgba(125, 211, 252, 0.85)");
          }
          ctx.fillStyle = bladeGrad;
          ctx.strokeStyle = "#38BDF8";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(vr * 0.14, 0, vr * 1.02, -1.18, 1.18);
          ctx.arc(vr * 0.56, 0, vr * 0.78, 1.18, -1.18, true);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // 刀鋒外緣純白高光刃線
          ctx.strokeStyle = "#FFFFFF";
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.arc(vr * 0.14, 0, vr * 0.98, -0.92, 0.92);
          ctx.stroke();
          ctx.restore();
        });

        // 中心真空氣旋微核
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(0, 0, vr * 0.18, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.rotate(pr.angle || 0);
        ctx.fillStyle = "#0F172A";
        ctx.beginPath(); ctx.arc(0, 0, r * 0.84, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = pr.color || "#FACC15";
        ctx.beginPath(); ctx.arc(0, 0, r * 0.70, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath(); ctx.arc(r * 0.2, -r * 0.15, r * 0.30, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    });

    // 5. 繪製分叉立體雷電鏈（主雷電 + 兩側細微支流分叉）
    this.lightningArcs.forEach(arc => {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.lineJoin = "round";
      ctx.lineCap = "round";

      ctx.strokeStyle = "rgba(120, 53, 15, 0.85)";
      ctx.lineWidth = 7.5;
      ctx.beginPath();
      arc.pts.forEach((pt, idx) => {
        const sx = toSx(pt.x), sy = toSy(pt.y);
        if (idx === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      });
      ctx.stroke();

      ctx.strokeStyle = arc.color || "#FDE047";
      ctx.lineWidth = 4.5;
      ctx.stroke();

      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 2.0;
      ctx.stroke();

      // 繪製兩側細微支流分叉電弧
      (arc.branches || []).forEach(br => {
        ctx.strokeStyle = "#FACC15";
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        br.forEach((pt, idx) => {
          const sx = toSx(pt.x), sy = toSy(pt.y);
          if (idx === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        });
        ctx.stroke();

        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 1.1;
        ctx.stroke();
      });
      ctx.restore();
    });

    // 6. 繪製立體微粒子
    this.subParticles.forEach(sp => {
      const sx = toSx(sp.x), sy = toSy(sp.y);
      ctx.save();
      ctx.globalAlpha = Math.max(0, sp.life / sp.maxLife);
      ctx.translate(sx, sy);
      ctx.rotate(sp.rot || 0);

      if (sp.shape === "leaf") {
        ctx.fillStyle = "#052E16";
        ctx.beginPath();
        ctx.ellipse(0, 0, sp.size * 1.65, sp.size * 0.95, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = sp.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, sp.size * 1.4, sp.size * 0.75, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (sp.shape === "diamond") {
        ctx.fillStyle = sp.color;
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(0, -sp.size * 1.2); ctx.lineTo(sp.size * 0.85, 0); ctx.lineTo(0, sp.size * 1.2); ctx.lineTo(-sp.size * 0.85, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (sp.shape === "star") {
        const s = sp.size * 1.35;
        ctx.fillStyle = sp.color;
        ctx.beginPath();
        ctx.moveTo(0, -s); ctx.lineTo(s * 0.28, -s * 0.28);
        ctx.lineTo(s, 0); ctx.lineTo(s * 0.28, s * 0.28);
        ctx.lineTo(0, s); ctx.lineTo(-s * 0.28, s * 0.28);
        ctx.lineTo(-s, 0); ctx.lineTo(-s * 0.28, -s * 0.28);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillStyle = "#0F172A";
        ctx.beginPath();
        ctx.arc(0, 0, sp.size + 1.0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = sp.color;
        ctx.beginPath();
        ctx.arc(0, 0, sp.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });
  },

  // 向後兼容總渲染入口
  render(ctx, toSx, toSy) {
    this.renderGroundLayer(ctx, toSx, toSy);
    this.renderAerialLayer(ctx, toSx, toSy);
  }
};
