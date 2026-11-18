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
      for (let gy = minGy; gy <= maxGy; gy++) {
        const cell = grid.get(`${gx},${gy}`);
        if (cell) {
          for (let i = 0; i < cell.length; i++) res.push(cell[i]);
        }
      }
    }
    return res;
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

  // 全屬性專屬命中材質爆破 (Elemental Impact Hit-Sparks)
  spawnElementalHitSpark(x, y, type) {
    if (GameApp.enemies && GameApp.enemies.length > 140 && Math.random() < 0.65) return;
    if (type === "Water") {
      this.meleeEffects.push({ style: "slam_wave", x, y, radius: 22, timer: 0.16, maxTime: 0.16, color: "#38BDF8" });
      for (let i = 0; i < 3; i++) {
        const a = Math.random() * Math.PI * 2;
        this.spawnSubParticle(x, y, Math.cos(a) * 55, Math.sin(a) * 55, "#E0FFFF", 2.6, 0.20, "circle");
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

    const countBonus = (level >= 4 ? 1 : 0) + (level >= 8 ? 1 : 0) + (caster === GameApp.player ? GameApp.player.projBonus : 0);
    const count = Math.min(4, 1 + countBonus);

    const isStab = (caster.data.type1 === meta.type || caster.data.type2 === meta.type);
    const stabMult = isStab ? 1.35 : 1.0;

    const lvDmgMult = 1 + (level - 1) * 0.06 + (level === 10 ? 0.12 : 0);

    let stageBuffMult = 1.0;
    const stId = MapEngine.currentStage.id;
    if (stId === "pallet" && (meta.type === "Grass" || meta.type === "Bug")) stageBuffMult = 1.20;
    if (stId === "cerulean_bay" && (meta.type === "Water" || meta.type === "Ice")) stageBuffMult = 1.20;
    if (stId === "sky_pillar" && (meta.type === "Psychic" || meta.type === "Ghost")) stageBuffMult = 1.20;

    const curW = MapEngine.weather;
    let weatherBuff = 1.0;
    if (curW === "RAIN") {
      if (meta.type === "Water") weatherBuff = 1.25;
      if (meta.type === "Fire") weatherBuff = 0.80;
    } else if (curW === "HEATWAVE") {
      if (meta.type === "Fire") weatherBuff = 1.25;
      if (meta.type === "Water") weatherBuff = 0.80;
    } else if (curW === "BLIZZARD") {
      if (meta.type === "Ice") weatherBuff = 1.20;
    } else if (curW === "THUNDER") {
      if (meta.type === "Electric") weatherBuff = 1.20;
    } else if (curW === "PSYCHIC") {
      if (meta.type === "Psychic" || meta.type === "Ghost") weatherBuff = 1.20;
    }

    let heldItemMult = 1.0;
    if (GameApp.player && GameApp.player.heldItems) {
      if (meta.type === "Fire" && GameApp.player.heldItems["charcoal"]) heldItemMult *= 1.20;
      if (meta.type === "Water" && GameApp.player.heldItems["mystic_water"]) heldItemMult *= 1.20;
      if (meta.type === "Grass" && GameApp.player.heldItems["miracle_seed"]) heldItemMult *= 1.20;
      if (meta.type === "Electric" && GameApp.player.heldItems["magnet"]) heldItemMult *= 1.20;
      if (meta.type === "Ghost" && GameApp.player.heldItems["spell_tag"]) heldItemMult *= 1.20;
      if (meta.type === "Psychic" && GameApp.player.heldItems["twisted_spoon"]) heldItemMult *= 1.20;
      if (meta.type === "Ice" && GameApp.player.heldItems["never_melt_ice"]) heldItemMult *= 1.20;
      if (meta.type === "Ground" && GameApp.player.heldItems["soft_sand"]) heldItemMult *= 1.20;
      if (meta.type === "Fighting" && GameApp.player.heldItems["black_belt"]) heldItemMult *= 1.20;
      if (meta.type === "Flying" && GameApp.player.heldItems["sharp_beak"]) heldItemMult *= 1.20;
      if (meta.type === "Normal" && GameApp.player.heldItems["silk_scarf"]) heldItemMult *= 1.20;
      if (meta.type === "Poison" && GameApp.player.heldItems["poison_barb"]) heldItemMult *= 1.20;
      if (meta.type === "Dragon" && GameApp.player.heldItems["dragon_scale"]) heldItemMult *= 1.20;
    }

    const trait = (caster === GameApp.player && GameApp.player.innateTrait)
      ? GameApp.player.innateTrait
      : (typeof getPokemonInnateTrait === "function" ? getPokemonInnateTrait(caster.data, caster.level || 1) : {});
    caster._activeTrait = trait;

    const basePower = meta.baseDmg * 0.55 + (GameApp.player.baseAtk * 0.18);
    // 依據最新版，xAtkMod 在 battle_core_2 的 dealDamageToEnemy 結算，此處不重複乘算
    const rawDmg = basePower * lvDmgMult * GameApp.player.dmgMult * stabMult * dmgScale * stageBuffMult * weatherBuff * heldItemMult;

    if (meta.isMelee) {
      this.executeMeleeSkill(caster, meta, level, count, baseAngle, rawDmg);
      return;
    }

    if (skillId === "Thunderbolt") {
      const maxStrikeRange = 175 * GameApp.player.areaMult;
      const nearby = GameApp.enemies
        .filter(e => Math.hypot(e.x - caster.x, e.y - caster.y) <= maxStrikeRange)
        .sort((a, b) => Math.hypot(a.x - caster.x, a.y - caster.y) - Math.hypot(b.x - caster.x, b.y - caster.y));

      // 主角外圍 28px 電氣蓄電環（淨空中心，不擋皮卡丘臉部）
      this.meleeEffects.push({
        style: "electric_cheek_aura",
        casterRef: caster,
        x: caster.x,
        y: caster.y,
        radius: 30,
        timer: 0.22,
        maxTime: 0.22,
        color: "#FACC15"
      });

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

    // 2. 沙盒 V10 物理高拋拋物線：種子炸彈 (Seed Bomb / seed_nut)
    if (cleanSkillId === "SeedBomb" || meta.vfx === "seed_nut") {
      const nutCount = Math.min(4, count);
      for (let i = 0; i < nutCount; i++) {
        const spreadAng = baseAngle + (nutCount > 1 ? (i - (nutCount - 1) / 2) * 0.24 : 0) + (Math.random() - 0.5) * 0.10;
        const baseDist = target ? Math.min(310, Math.max(85, Math.hypot(target.x - caster.x, target.y - caster.y))) : 185;
        const targetDist = baseDist + (i - (nutCount - 1) / 2) * 24;
        const tx = caster.x + Math.cos(spreadAng) * targetDist;
        const ty = caster.y + Math.sin(spreadAng) * targetDist;

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
          arcHeight: 68 + i * 8,
          radius: (13 + level * 0.5) * GameApp.player.areaMult * (1 + (trait.overgrowAreaBonus || 0) + (trait.legendaryAreaBonus || 0)),
          dmg: rawDmg * 1.15,
          type: "Grass",
          skillId: "Seed Bomb",
          vfx: "seed_nut",
          color: "#65A30D",
          pierce: 99,
          knockback: meta.knockback !== undefined ? meta.knockback : 10,
          life: 0.62 + i * 0.05,
          maxLife: 0.62 + i * 0.05,
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
      for (let i = 0; i < lobCount; i++) {
        const spreadAng = baseAngle + (lobCount > 1 ? (i - (lobCount - 1) / 2) * 0.28 : 0);
        const baseDist = (!useManualAim && target) ? Math.min(280, Math.max(80, Math.hypot(target.x - caster.x, target.y - caster.y))) : 165;
        const tx = caster.x + Math.cos(spreadAng) * (baseDist + (i - (lobCount - 1) / 2) * 26);
        const ty = caster.y + Math.sin(spreadAng) * (baseDist + (i - (lobCount - 1) / 2) * 26);

        this.projectiles.push({
          x: caster.x, y: caster.y,
          startX: caster.x, startY: caster.y,
          targetX: tx, targetY: ty,
          vx: 0, vy: 0, angle: spreadAng,
          progress: 0, arcHeight: 58 + i * 6,
          radius: (14 + level * 0.5) * GameApp.player.areaMult,
          dmg: rawDmg * 0.85,
          type: "Poison", skillId: "Sludge Bomb", vfx: "sludge_lob",
          color: "#9333EA", pierce: 99, knockback: 4,
          life: 0.55 + i * 0.04, maxLife: 0.55 + i * 0.04,
          statusBonus: level >= 5 ? 0.45 : 0.25,
          hitSet: new Set(), trailTimer: 0
        });
      }
      SoundFX.play("hit", "Poison");
      return;
    }

    // 2C. 月亮之力 (Moonblast)：鎖定敵群降下持續 1.45 秒的高速索敵 3D 螺旋月光聖柱 (多段連擊+降攻+星塵粒子)
    if (cleanSkillId === "Moonblast") {
      const pillarCount = Math.min(2, 1 + (level >= 6 ? 1 : 0));
      for (let i = 0; i < pillarCount; i++) {
        const ang = baseAngle + (i - (pillarCount - 1) / 2) * 0.42;
        const dist = (!useManualAim && target) ? Math.min(250, Math.max(48, Math.hypot(target.x - caster.x, target.y - caster.y))) : 120;
        const px = caster.x + Math.cos(ang) * dist;
        const py = caster.y + Math.sin(ang) * dist;
        this.groundHazards.push({
          kind: "moon_pillar",
          x: px, y: py,
          vx: Math.cos(ang) * 105, vy: Math.sin(ang) * 105,
          radius: (54 + level * 2.6) * GameApp.player.areaMult * (1 + (trait.legendaryAreaBonus || 0)),
          dmg: rawDmg * 0.56,
          type: "Psychic",
          timer: 1.45 * (trait.psychicHazardDurMult || 1.0), maxTime: 1.45 * (trait.psychicHazardDurMult || 1.0),
          tickTimer: 0.04, tickInterval: 0.30,
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
          radius: (20 + level * 0.8) * GameApp.player.areaMult * mewtwoScale,
          dmg: rawDmg * 0.85,
          type: "Psychic",
          skillId: "Psystrike",
          vfx: "psychic_lance",
          homing: true,
          color: "#EC4899",
          pierce: level >= 6 ? 4 : 3,
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

    // 2E. 噴射火焰 (Flamethrower)：主角前方 30px 淨空噴出扇形翻湧四色漸層火浪
    if (cleanSkillId === "Flamethrower") {
      const waveStreams = Math.min(4, count);
      for (let w = 0; w < 2; w++) {
        for (let i = 0; i < waveStreams; i++) {
          const spread = (waveStreams > 1 ? (i - (waveStreams - 1) / 2) * 0.18 : 0) + (w === 1 ? (Math.random() - 0.5) * 0.12 : 0);
          const ang = baseAngle + spread;
          const spd = 290 + w * 45;
          const muzzleDist = 30 + w * 18;
          this.projectiles.push({
            x: caster.x + Math.cos(ang) * muzzleDist,
            y: caster.y + Math.sin(ang) * muzzleDist,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd,
            angle: ang,
            radius: (15 + w * 4.5) * GameApp.player.areaMult * (level >= 8 ? 1.25 : 1.0) * (1 + (trait.dragonMawAreaBonus || 0) + (trait.legendaryAreaBonus || 0)),
            dmg: rawDmg * 0.62,
            type: "Fire",
            skillId,
            vfx: "fire_stream",
            homing: false,
            color: "#EF4444",
            pierce: (level >= 6 ? 4 : 3),
            knockback: 0,
            life: 0.68,
            statusBonus: level >= 5 ? 0.35 : 0.15,
            hitSet: new Set(),
            trailTimer: 0
          });
        }
      }
      SoundFX.play("hit", "Fire");
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

    for (let i = 0; i < count; i++) {
      const spread = count > 1 ? (i - (count - 1) / 2) * 0.16 : (cleanSkillId === "Ember" ? (Math.random() - 0.5) * 0.14 : 0);
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
        radius: (cleanSkillId === "HydroPump" ? 22 : 16) * GameApp.player.areaMult * (level >= 8 ? 1.25 : 1.0) * traitSizeMult,
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

    if (cleanSkillId === "IceBeam" && caster && caster.id === 144) {
      [-0.22, 0.22].forEach(sideAng => {
        const a = baseAngle + sideAng;
        this.projectiles.push({
          x: caster.x + Math.cos(a) * 28,
          y: caster.y + Math.sin(a) * 28,
          vx: Math.cos(a) * 395,
          vy: Math.sin(a) * 395,
          initSpeed: 395,
          angle: a,
          casterRef: caster,
          radius: 13 * GameApp.player.areaMult,
          dmg: rawDmg * 0.55,
          type: "Ice",
          skillId,
          vfx: "frost_beam",
          homing: false,
          color: "#67E8F9",
          pierce: 3,
          knockback: 4,
          life: 0.78,
          maxLife: 0.78,
          statusBonus: 0.35,
          hitSet: new Set(),
          trailTimer: 0
        });
      });
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
      const whipCount = 1 + (level >= 5 ? 1 : 0);
      const reach = (135 + level * 7) * areaScale * (1 + (trait.overgrowAreaBonus || 0));
      const perp = baseAngle + Math.PI / 2;
      for (let w = 0; w < whipCount; w++) {
        const spread = (w - (whipCount - 1) / 2) * 0.30;
        const ang = baseAngle + spread;
        const sideShift = whipCount > 1 ? (w === 0 ? -12 : 12) : 0;
        const startX = caster.x + Math.cos(ang) * 24 + Math.cos(perp) * sideShift;
        const startY = caster.y + Math.sin(ang) * 24 + Math.sin(perp) * sideShift;
        this.meleeEffects.push({
          style: "vine_whip",
          casterRef: caster,
          ox: startX,
          oy: startY,
          x: startX,
          y: startY,
          angle: ang,
          reach: reach,
          dmg: rawDmg * 1.15,
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
      // 空手劈：方案 C 零物理位移 ＋ 鐵拳宗師特性加成 (範圍擴大 + 滿階額外多揮 1 道氣勁拳印)
      this.triggerSmartMeleeLunge(caster, baseAngle, 0, 0, 12, 0);
      const reach = 90 * areaScale * (1 + (trait.ironFistAreaBonus || 0));
      const strikes = Math.min(4, 1 + Math.floor(level / 4) + (trait.ironFistExtraStrike || 0));
      for (let s = 0; s < strikes; s++) {
        const fAng = baseAngle + (s - (strikes - 1) / 2) * 0.28;
        const fx = caster.x + Math.cos(fAng) * (24 + reach * 0.42);
        const fy = caster.y + Math.sin(fAng) * (24 + reach * 0.42);
        this.meleeEffects.push({
          style: "karate_cross",
          x: fx,
          y: fy,
          angle: fAng,
          radius: reach * 0.58,
          timer: 0.24,
          maxTime: 0.24,
          color: "#EF4444"
        });
        const hitCandidates = this.getEnemiesInRadius(fx, fy, reach * 0.62);
        hitCandidates.forEach(e => {
          if (Math.hypot(e.x - fx, e.y - fy) <= reach * 0.62 + e.radius) {
            GameApp.dealDamageToEnemy(e, rawDmg * 1.25, meta.type, 0.30, kb * 1.35);
          }
        });
      }
      GameApp.spawnParticleCluster(caster.x + Math.cos(baseAngle) * 26, caster.y + Math.sin(baseAngle) * 26, "#FFFFFF", "#FACC15", 8, "star", 0.9);
      SoundFX.play("hit", "Fighting");
      return;
    }

    // 1. 撞擊專屬：方案 C 零物理位移 ＋ 重量級霸體/電光疾行特性加成 ＋ Lv.4 二段 / Lv.8 三段連環破空震波推進！
    if (style === "slam_wave") {
      const tackleAreaScale = GameApp.player.areaMult * (level >= 3 ? 1.20 : 1.0) * (level >= 8 ? 1.25 : 1.0) * (1 + (trait.tackleQuakeAreaBonus || 0));
      const visualLungePx = (17 + (level >= 3 ? 3 : 0) + (level >= 8 ? 4 : 0)) * (1 + (trait.quickAttackLungeBonus || 0));
      this.triggerSmartMeleeLunge(caster, baseAngle, 0, 0, visualLungePx, 0);

      const totalWaves = 1 + (level >= 4 ? 1 : 0) + (level >= 8 ? 1 : 0);
      const effectiveKb = (kb || 20) * (level >= 6 ? 1.35 : 1.0) * (1 + (trait.tackleQuakeKbBonus || 0));
      const drainPct = level >= 6 ? 0.015 : 0.008;

      const fireTackleWave = (waveIdx) => {
        if (!caster || (caster === GameApp.player && GameApp.state !== "PLAYING")) return;
        const forwardStep = (28 + waveIdx * 24) * tackleAreaScale;
        const hitX = caster.x + Math.cos(baseAngle) * forwardStep;
        const hitY = caster.y + Math.sin(baseAngle) * forwardStep;
        const rad = (52 + waveIdx * 10) * tackleAreaScale;
        const waveDmg = rawDmg * (waveIdx === 0 ? 1.0 : (waveIdx === 1 ? 0.65 : 0.50));

        if (waveIdx > 0 && caster === GameApp.player) {
          this.triggerSmartMeleeLunge(caster, baseAngle, 0, 0, visualLungePx * 0.75, 0);
        }

        this.meleeEffects.push({
          style: "sonic_cone",
          casterRef: waveIdx === 0 ? caster : null,
          ox: caster.x + Math.cos(baseAngle) * (8 + waveIdx * 22),
          oy: caster.y + Math.sin(baseAngle) * (8 + waveIdx * 22),
          x: hitX,
          y: hitY,
          angle: baseAngle,
          radius: rad,
          waveIdx: waveIdx,
          timer: 0.20,
          maxTime: 0.20,
          color: waveIdx === 0 ? "#F8FAFC" : (waveIdx === 1 ? "#BAE6FD" : "#FEF08A")
        });

        let healedThisWave = false;
        const hitCandidates = this.getEnemiesInRadius(hitX, hitY, rad);
        hitCandidates.forEach(e => {
          if (Math.hypot(e.x - hitX, e.y - hitY) <= rad + e.radius) {
            GameApp.dealDamageToEnemy(e, waveDmg, meta.type, 0.20, effectiveKb);
            this.meleeEffects.push({
              style: "z_spark",
              x: (e.x + hitX) * 0.5,
              y: (e.y + hitY) * 0.5,
              radius: 18 + waveIdx * 3,
              timer: 0.16,
              maxTime: 0.16,
              color: waveIdx >= 2 ? "#FEF08A" : "#FFFFFF"
            });
            if (!healedThisWave && caster === GameApp.player && GameApp.player.hp < GameApp.player.maxHp) {
              healedThisWave = true;
              GameApp.player.hp = Math.min(GameApp.player.maxHp, GameApp.player.hp + Math.round(GameApp.player.maxHp * drainPct));
            }
          }
        });
        SoundFX.play("hit", "Normal");
      };

      fireTackleWave(0);
      for (let w = 1; w < totalWaves; w++) {
        setTimeout(() => fireTackleWave(w), w * 115);
      }
      return;
    }

    // 2. 地震專屬：原地重踏起跳下壓感 (Slam Hop) + 大範圍環形地裂 (支援【重量級霸體】範圍與擊退強化)
    if (style === "quake_wave") {
      if (caster === GameApp.player) {
        caster.slamHopTimer = 0.24;
        GameApp.camera.shakeTime = Math.max(GameApp.camera.shakeTime || 0, 0.14);
        GameApp.camera.shakeMagnitude = Math.max(GameApp.camera.shakeMagnitude || 0, 3.5);
      }
      const rad = (85 + level * 4) * areaScale * (1 + (trait.tackleQuakeAreaBonus || 0));
      const quakeKb = kb * (1 + (trait.tackleQuakeKbBonus || 0));
      this.meleeEffects.push({
        style,
        casterRef: caster,
        x: caster.x,
        y: caster.y,
        radius: rad,
        dmg: rawDmg,
        type: meta.type,
        kb: quakeKb,
        hitSet: new Set(),
        timer: 0.50,
        maxTime: 0.50,
        color: meta.color
      });

      const dustCount = 18;
      for (let d = 0; d < dustCount; d++) {
        const dAng = Math.random() * Math.PI * 2;
        const dSpd = 45 + Math.random() * 95;
        this.spawnSubParticle(caster.x, caster.y, Math.cos(dAng) * dSpd, Math.sin(dAng) * dSpd, d % 2 === 0 ? "#92400E" : "#D97706", 3.2, 0.45, "circle");
      }
      SoundFX.play("ultimate");
      return;
    }

    // 3. 龍之俯衝 (Dragon Rush)：方案 B 智慧龍威撲擊 (含騰空飛撲小跳與 0.18s 霸體) ＋ 蒼藍/金焰龍首氣旋直接從胸前咆哮衝出
    if (meta.type === "Dragon") {
      this.triggerSmartMeleeLunge(caster, baseAngle, 155, 0.12, 14, 0.18);
      if (caster === GameApp.player) {
        caster.slamHopTimer = 0.18;
      }
      const isDragonite = !!(caster && caster.id === 149);
      const dragonWaves = 1 + (level >= 6 ? 1 : 0) + (isDragonite ? 1 : 0);
      for (let d = 0; d < dragonWaves; d++) {
        const ang = baseAngle + (d - (dragonWaves - 1) / 2) * 0.26;
        this.groundHazards.push({
          kind: "dragon_wave",
          isDragoniteKing: isDragonite,
          x: caster.x + Math.cos(ang) * 16,
          y: caster.y + Math.sin(ang) * 16,
          vx: Math.cos(ang) * (isDragonite ? 290 : 260),
          vy: Math.sin(ang) * (isDragonite ? 290 : 260),
          angle: ang,
          radius: (isDragonite ? 58 : 42) * areaScale * (1 + (trait.dragonMawAreaBonus || 0)),
          dmg: rawDmg * (isDragonite ? 0.72 : 0.60),
          type: "Dragon",
          timer: 0.68,
          maxTime: 0.68,
          tickTimer: 0.01,
          tickInterval: 0.15,
          color: isDragonite ? "#F59E0B" : "#4338CA"
        });
      }
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
      timer: 1.35,
      maxTime: 1.35,
      color: meta.color,
      radius: 260
    });

    if (meta.type === "Electric") {
      // 【比卡超超武・打雷暴風雨】：黑金雷雲壓頂 ＋ 8 道垂直落下的三層白熾天罰雷柱 ＋ 底層焦黑裂痕與電圈
      const strikePts = [];
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI * 2) / 8 + (i % 2 === 0 ? 0.12 : -0.12);
        const dist = (95 + (i % 2) * 95) * p.areaMult;
        strikePts.push({
          x: p.x + Math.cos(a) * dist,
          y: p.y + Math.sin(a) * dist,
          delay: i * 0.06
        });
      }
      this.groundHazards.push({
        kind: "thunder_pillars_storm",
        x: p.x, y: p.y,
        strikePts,
        radius: 245 * p.areaMult,
        dmg: ultDmg * 0.40,
        type: "Electric",
        timer: 1.45, maxTime: 1.45,
        tickTimer: 0.16, tickInterval: 0.32,
        color: "#FACC15"
      });
    } else if (meta.type === "Fire") {
      // 【噴火龍超武・立體大字爆炎】：外推 42px 淨空出發，密集翻滾動態火球簇構成『大』字 ＋ 底層熔岩火海
      for (let d = 0; d < 4; d++) {
        const ang = (d * Math.PI) / 2 + (p.facingX >= 0 ? 0 : 0.4);
        const startX = p.x + Math.cos(ang) * 42;
        const startY = p.y + Math.sin(ang) * 42;
        this.groundHazards.push({
          kind: "drifting_daimonji",
          x: startX, y: startY,
          lastSpawnX: startX, lastSpawnY: startY,
          vx: Math.cos(ang) * 235, vy: Math.sin(ang) * 235,
          angle: ang,
          radius: 78 * p.areaMult,
          dmg: ultDmg * 0.42,
          type: "Fire",
          timer: 1.25, maxTime: 1.25,
          tickTimer: 0.08, tickInterval: 0.25,
          color: "#EF4444"
        });
      }
    } else if (meta.type === "Water") {
      // 【水箭龜超武・潮旋激流】：底層 300px 深海大漩渦（中央 45px 淨空風眼）＋ 外圈 6 道浮世繪風拍岸巨浪
      this.groundHazards.push({
        kind: "blastoise_maelstrom",
        x: p.x, y: p.y,
        followPlayer: true,
        rotAngle: 0,
        radius: 295 * p.areaMult,
        innerSafeRadius: 44,
        dmg: ultDmg * 0.34,
        type: "Water",
        timer: 1.65, maxTime: 1.65,
        tickTimer: 0.06, tickInterval: 0.24,
        color: "#38BDF8"
      });
    } else if (meta.type === "Grass") {
      // 【奇異種子超武・瘋狂植物】：地面底層裂開 10 個泥坑，破土竄出帶尖刺與紅花苞的巨型彎曲荊棘藤木（完全不擋主角）
      const rootNodes = [];
      for (let i = 0; i < 10; i++) {
        const ang = (i * Math.PI * 2) / 10 + (Math.random() - 0.5) * 0.2;
        const dist = (68 + (i % 3) * 62) * p.areaMult;
        rootNodes.push({
          x: p.x + Math.cos(ang) * dist,
          y: p.y + Math.sin(ang) * dist,
          leanDir: (i % 2 === 0 ? 1 : -1),
          heightScale: 0.85 + (i % 3) * 0.14,
          phaseOffset: i * 0.45
        });
      }
      this.groundHazards.push({
        kind: "frenzy_plant_roots",
        x: p.x, y: p.y,
        rootNodes,
        radius: 255 * p.areaMult,
        dmg: ultDmg * 0.36,
        type: "Grass",
        timer: 1.55, maxTime: 1.55,
        tickTimer: 0.08, tickInterval: 0.28,
        color: "#15803D"
      });
      for (let g = 0; g < 24; g++) {
        const gAng = Math.random() * Math.PI * 2;
        const gSpd = 65 + Math.random() * 145;
        this.spawnSubParticle(
          p.x + Math.cos(gAng) * 45, p.y + Math.sin(gAng) * 45,
          Math.cos(gAng) * gSpd, Math.sin(gAng) * gSpd,
          g % 3 === 0 ? "#F472B6" : (g % 2 === 0 ? "#22C55E" : "#86EFAC"),
          4.0, 0.85, "leaf"
        );
      }
    } else if (meta.type === "Normal") {
      // 【終極衝擊（Giga Impact）】：3 層立體黃金螺旋鑽頭巨錐 ＋ 地面焦土刮痕 ＋ 連環破空音爆雲環
      for (let i = 0; i < 4; i++) {
        const ang = (i * Math.PI * 2) / 4 + Math.PI / 4;
        this.meleeEffects.push({
          style: "giga_impact_lance",
          casterRef: p,
          ox: p.x + Math.cos(ang) * 30,
          oy: p.y + Math.sin(ang) * 30,
          x: p.x + Math.cos(ang) * 30,
          y: p.y + Math.sin(ang) * 30,
          angle: ang,
          radius: 245 * p.areaMult,
          dmg: ultDmg * 0.62,
          type: "Normal",
          kb: 26,
          hitSet: new Set(),
          timer: 0.52 + i * 0.04,
          maxTime: 0.52 + i * 0.04,
          color: "#FACC15"
        });
      }
    } else if (meta.type === "Fighting") {
      // 【爆裂十字劈（太極八卦武神破）・三段式武學連招】：
      // 第 1 拍（0.0s 立陣）：隨身展開 1.95 秒「太極八卦武神陣」（外卦八宮＋中層交錯金剛星盤＋內圈陰陽雙魚氣旋，賦予 +20% 暴擊與 30% 減傷）
      p.martialGodTimer = 1.95;
      this.groundHazards.push({
        kind: "martial_aura_domain",
        x: p.x, y: p.y,
        followPlayer: true,
        radius: 225 * p.areaMult,
        dmg: ultDmg * 0.34,
        type: "Fighting",
        timer: 1.95, maxTime: 1.95,
        tickTimer: 0.06, tickInterval: 0.28,
        color: "#DC2626"
      });

      // 第 2 拍（0.0s 百裂）：12 道阿修羅螺旋金紅重拳護體掃除四周
      for (let i = 0; i < 12; i++) {
        const ang = (i * Math.PI * 2) / 12;
        this.projectiles.push({
          x: p.x + Math.cos(ang) * 24, y: p.y + Math.sin(ang) * 24,
          vx: Math.cos(ang) * 310, vy: Math.sin(ang) * 310,
          angle: ang, spinSpeed: (i % 2 === 0 ? 1.05 : -1.05),
          radius: 28 * p.areaMult, dmg: ultDmg * 0.68,
          type: "Fighting", skillId: "Karate Chop", vfx: "giant_fist",
          color: "#DC2626", pierce: 14, knockback: 24, life: 1.35, statusBonus: 0.45, hitSet: new Set(), trailTimer: 0
        });
      }

      // 第 3 拍（0.28s 鎮嶽終結斬）：以主角自身為中心且全程跟隨主角移動（followPlayer: true），劈開橫跨全屏的白熾「X 十字天譴破甲斬」！
      setTimeout(() => {
        if (GameApp.state !== "PLAYING" || !GameApp.player) return;
        const pl = GameApp.player;
        const armLen = 235 * pl.areaMult;
        this.groundHazards = this.groundHazards.filter(h => h.kind !== "cross_chop_cleave");
        this.groundHazards.push({
          kind: "cross_chop_cleave",
          x: pl.x, y: pl.y,
          followPlayer: true,
          radius: armLen,
          dmg: ultDmg * 0.58,
          type: "Fighting",
          timer: 1.05, maxTime: 1.05,
          tickTimer: 0.16, tickInterval: 0.30,
          color: "#FACC15"
        });
        SoundFX.play("ultimate");
        GameApp.camera.shakeTime = 0.20;
        GameApp.camera.shakeMagnitude = 5.5;

        // 自身周圍十字斬瞬發破甲裁決判定
        const crossCandidates = [...this.getEnemiesInRadius(pl.x, pl.y, armLen)];
        crossCandidates.forEach(e => {
          if (!e || e.hp <= 0) return;
          const dx = e.x - pl.x, dy = e.y - pl.y;
          const d = Math.hypot(dx, dy);
          if (d <= armLen + e.radius) {
            const diag1 = Math.abs(dx - dy) * 0.707;
            const diag2 = Math.abs(dx + dy) * 0.707;
            const inCore = d <= 88 * pl.areaMult + e.radius;
            if (inCore || diag1 <= 48 * pl.areaMult + e.radius || diag2 <= 48 * pl.areaMult + e.radius) {
              const armorBreakMult = inCore ? 1.45 : 1.18;
              GameApp.dealDamageToEnemy(e, ultDmg * armorBreakMult, "Fighting", 0.65, 28);
              if (!e.status && !(e.ccImmunityTimer > 0)) {
                e.status = "Paralysis";
                e.statusTimer = e.isBoss ? 1.2 : 2.0;
                e.ccImmunityTimer = e.isBoss ? 3.5 : 2.2;
              }
            }
          }
        });
      }, 280);
    } else if (meta.type === "Flying") {
      // 【暴風驟雨】：生成 3 道沉穩游走的聚怪龍捲風（持續 3.1s，配合 4.2s 保底冷卻絕不疊出 6 道龍捲風）
      for (let i = 0; i < 3; i++) {
        const ang = (i * Math.PI * 2) / 3;
        this.groundHazards.push({
          kind: "tornado",
          x: p.x + Math.cos(ang) * 90,
          y: p.y + Math.sin(ang) * 90,
          vx: Math.cos(ang) * 62,
          vy: Math.sin(ang) * 62,
          radius: 95 * p.areaMult,
          dmg: ultDmg * 0.26,
          type: "Flying",
          timer: 3.1, maxTime: 3.1,
          tickTimer: 0.1, tickInterval: 0.25,
          color: "#818CF8"
        });
      }
    } else if (meta.type === "Poison") {
      // 【劇毒沼澤】：展開持續 3.4 秒的 230px 沸騰劇毒領域，減速 30% 並使沼澤內中毒 DOT 翻倍
      this.groundHazards.push({
        kind: "toxic_swamp",
        x: p.x, y: p.y,
        followPlayer: true,
        radius: 230 * p.areaMult,
        dmg: ultDmg * 0.24,
        type: "Poison",
        timer: 3.4, maxTime: 3.4,
        tickTimer: 0.1, tickInterval: 0.35,
        color: "#9333EA"
      });
    } else if (meta.type === "Ice") {
      // 【絕對零度（防永凍平衡版）】：對 285px 極光圈內非韌性保護期的敵人凍結 2.0s (Boss 1.0s)，韌性保護期內則賦予極寒減速
      const freezeRange = 285 * p.areaMult;
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
        radius: 280 * p.areaMult,
        dmg: ultDmg * 0.95,
        type: "Ice",
        timer: 0.95, maxTime: 0.95,
        tickTimer: 0.90, tickInterval: 99,
        color: "#38BDF8"
      });
    } else if (meta.type === "Dragon") {
      // 【天龍流星雨（重構 4 層次垂直陰影美學）】：6 顆定點雙環星軌陣列（內3外3），比照雷系超武的高空積雲陰影＋垂直龍魂星柱
      for (let m = 0; m < 6; m++) {
        const isOuter = m >= 3;
        const ringIdx = m % 3;
        const ang = (ringIdx * Math.PI * 2) / 3 + (isOuter ? Math.PI / 3 : 0) + (p.facingX >= 0 ? 0.15 : -0.15);
        const dist = (isOuter ? 165 : 88) * p.areaMult;
        const tx = p.x + Math.cos(ang) * dist;
        const ty = p.y + Math.sin(ang) * dist;
        this.groundHazards.push({
          kind: "meteor_strike",
          x: tx, y: ty,
          startX: tx + 24, startY: ty - 210,
          radius: 82 * p.areaMult,
          dmg: ultDmg * 0.62,
          type: "Dragon",
          delay: m * 0.14,
          timer: 0.48 + m * 0.14,
          maxTime: 0.48,
          color: "#4338CA"
        });
      }
    } else if (meta.type === "Ground") {
      // 【地裂斷層破】：持續 2.4 秒的米字型地底熔岩斷層，連續震擊 5 波 (對空有效)
      this.groundHazards.push({
        kind: "quake_fissure",
        x: p.x, y: p.y,
        radius: 220 * p.areaMult,
        dmg: ultDmg * 0.36,
        type: "Ground",
        timer: 2.0, maxTime: 2.0,
        tickTimer: 0.1, tickInterval: 0.45,
        color: "#D97706"
      });
    } else if (meta.type === "Ghost") {
      // 【耿鬼專屬超武・暗影死滅波】：底層「冥界巨大壞笑暗影陣（血紅雙眼＋弦月壞笑）」＋ 8 隻張嘴惡靈鬼影穿梭撕咬
      this.groundHazards.push({
        kind: "gengar_grin_domain",
        x: p.x, y: p.y,
        radius: 235 * p.areaMult,
        dmg: ultDmg * 0.32,
        type: "Ghost",
        timer: 2.1, maxTime: 2.1,
        tickTimer: 0.15, tickInterval: 0.42,
        color: "#A855F7"
      });
      for (let k = 0; k < 8; k++) {
        const ang = (k * Math.PI * 2) / 8;
        this.projectiles.push({
          x: p.x + Math.cos(ang) * 34,
          y: p.y + Math.sin(ang) * 34,
          vx: Math.cos(ang) * 310, vy: Math.sin(ang) * 310,
          initSpeed: 310,
          angle: ang, radius: 22, dmg: ultDmg * 0.52,
          type: "Ghost", skillId: meta.id, vfx: "gengar_phantom",
          homing: true, color: "#A855F7",
          pierce: 8, knockback: 8, life: 1.85, statusBonus: 0.65, hitSet: new Set(), trailTimer: 0
        });
      }
    } else if (meta.id === "Moonblast") {
      // 【創世極光（月亮之力超武）】：皎潔滿月虛影 ＋ 粉金與青色交織寬幅極光天幕 ＋ 十字星屑洗禮
      this.groundHazards.push({
        kind: "genesis_aurora",
        x: p.x, y: p.y,
        radius: 255 * p.areaMult,
        dmg: ultDmg * 0.36,
        type: "Psychic",
        timer: 2.0, maxTime: 2.0,
        tickTimer: 0.14, tickInterval: 0.36,
        color: "#F472B6"
      });
    } else if (meta.type === "Psychic") {
      // 【精神強念領域】：引力黑洞牽引壓縮怪群 + 8 道同心念力波環
      this.groundHazards.push({
        kind: "psychic_blackhole",
        x: p.x, y: p.y,
        radius: 230 * p.areaMult,
        dmg: ultDmg * 0.32,
        type: "Psychic",
        timer: 2.1, maxTime: 2.1,
        tickTimer: 0.15, tickInterval: 0.45,
        color: "#EC4899"
      });
      for (let k = 0; k < 8; k++) {
        const ang = (k * Math.PI * 2) / 8;
        this.projectiles.push({
          x: p.x + Math.cos(ang) * 32,
          y: p.y + Math.sin(ang) * 32,
          vx: Math.cos(ang) * 320, vy: Math.sin(ang) * 320,
          angle: ang, radius: 20, dmg: ultDmg * 0.50,
          type: "Psychic", skillId: meta.id, vfx: "psychic_lance",
          homing: true, color: "#EC4899",
          pierce: 8, knockback: 6, life: 1.8, statusBonus: 0.5, hitSet: new Set(), trailTimer: 0
        });
      }
    }

    // 釋放瞬間僅對貼身 115px 內敵人產生起手震退氣浪（使用空間網格與淺拷貝快照防刪除錯位）
    [...this.getEnemiesInRadius(p.x, p.y, 115)].forEach(e => {
      if (!e || e.hp <= 0) return;
      if (Math.hypot(e.x - p.x, e.y - p.y) <= 115 + e.radius) {
        let adjustedDmg = ultDmg * 0.55;
        if (meta.type === "Ground" && (e.data.type1 === "Flying" || e.data.type2 === "Flying")) {
          adjustedDmg *= 7.5;
        }
        GameApp.dealDamageToEnemy(e, adjustedDmg, meta.type, 0.70, e.isBoss ? 0 : 28);
      }
    });

    if (meta.type === "Grass") {
      const healMult = (p.innateTrait && p.innateTrait.overgrowHealMult) ? p.innateTrait.overgrowHealMult : 1.0;
      p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * 0.08 * healMult));
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
          this.groundHazards.push({
            kind: "poison_puddle",
            x: pr.targetX,
            y: pr.targetY,
            radius: puddleR,
            dmg: pr.dmg * 0.42,
            type: "Poison",
            timer: 2.2,
            maxTime: 2.2,
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
          // 落地第二層：12 團翠綠與草綠色孢子毒霧擴散
          for (let s = 0; s < 12; s++) {
            const a = Math.random() * Math.PI * 2;
            const spd = 25 + Math.random() * 55;
            this.spawnSubParticle(pr.targetX, pr.targetY, Math.cos(a) * spd, Math.sin(a) * spd, s % 2 === 0 ? "#4ADE80" : "#BEF264", 5.2, 0.48, "circle");
          }
          // 落地範圍轟炸傷害判定
          const blastRadius = 68 * GameApp.player.areaMult;
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
          SoundFX.play("hit", "Grass");
          this.projectiles[i] = this.projectiles[this.projectiles.length - 1];
          this.projectiles.pop();
        }
        continue;
      }

      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      pr.life -= dt;
      if (pr.spawnGraceTimer > 0) pr.spawnGraceTimer -= dt;

      pr.trailTimer = (pr.trailTimer || 0) - dt;
      if (pr.trailTimer <= 0) {
        pr.trailTimer = 0.045;
        if (pr.vfx === "ember_spark") {
          this.spawnSubParticle(pr.x - pr.vx * 0.02, pr.y - pr.vy * 0.02, (Math.random() - 0.5) * 15, (Math.random() - 0.5) * 15, "#F97316", 2.0, 0.20, "circle");
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
        if (m.style === "vine_whip") {
          const curReach = m.reach * Math.min(1, prog * 1.7);
          const ox = m.ox !== undefined ? m.ox : m.x;
          const oy = m.oy !== undefined ? m.oy : m.y;
          const candidates = this.getEnemiesInRadius(ox, oy, curReach);
          for (let j = 0; j < candidates.length; j++) {
            const e = candidates[j];
            if (!e || e.hp <= 0 || m.hitSet.has(e)) continue;
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
          const curR = m.radius * (0.28 + prog * 0.72);
          const candidates = this.getEnemiesInRadius(m.x, m.y, curR);
          for (let j = 0; j < candidates.length; j++) {
            const e = candidates[j];
            if (!e || e.hp <= 0 || m.hitSet.has(e)) continue;
            const dx = e.x - m.x, dy = e.y - m.y;
            const rSum = curR + e.radius * 0.85;
            if (dx * dx + dy * dy <= rSum * rSum) {
              m.hitSet.add(e);
              GameApp.dealDamageToEnemy(e, m.dmg, m.type, 0.25, m.kb || 20);
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
        // 【噴火龍超武・3D 熔岩立體大字爆炎】：地面推進焦黑烙印 ＋ 雙層熔岩火舌筆畫 ＋ 加色霓虹火芯
        ctx.translate(sx, sy);
        ctx.rotate(hz.angle || 0);
        const alpha = Math.min(1, hz.timer * 1.3);
        ctx.globalAlpha = alpha;
        const r = hz.radius * 0.88;

        const scorchGrad = ctx.createRadialGradient(0, 0, r * 0.15, 0, 0, r * 1.05);
        scorchGrad.addColorStop(0, "rgba(127, 29, 29, 0.55)");
        scorchGrad.addColorStop(0.65, "rgba(234, 88, 12, 0.28)");
        scorchGrad.addColorStop(1, "rgba(15, 23, 42, 0)");
        ctx.fillStyle = scorchGrad;
        ctx.beginPath();
        ctx.arc(0, 0, r * 1.05, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = "lighter";

        const strokes = [
          // 橫畫 (-0.75r, -0.18r) -> (0.75r, -0.18r)
          { x1: -r * 0.75, y1: -r * 0.18, x2: r * 0.75, y2: -r * 0.18 },
          // 撇畫上半 (0, -0.82r) -> (-0.12r, 0.05r)
          { x1: 0, y1: -r * 0.82, x2: -r * 0.12, y2: r * 0.05 },
          // 撇畫下半 (-0.12r, 0.05r) -> (-0.74r, 0.74r)
          { x1: -r * 0.12, y1: r * 0.05, x2: -r * 0.74, y2: r * 0.74 },
          // 捺畫上半 (0, -0.18r) -> (0.25r, 0.25r)
          { x1: 0, y1: -r * 0.18, x2: r * 0.25, y2: r * 0.25 },
          // 捺畫下半 (0.25r, 0.25r) -> (0.74r, 0.74r)
          { x1: r * 0.25, y1: r * 0.25, x2: r * 0.74, y2: r * 0.74 }
        ];

        // 先繪製翻滾火球簇外層深紅烈焰
        strokes.forEach((st, sIdx) => {
          const steps = 6;
          for (let k = 0; k <= steps; k++) {
            const t = k / steps;
            const pulse = Math.sin(now * 10 + k + sIdx) * 3.5;
            const fx = st.x1 + (st.x2 - st.x1) * t;
            const fy = st.y1 + (st.y2 - st.y1) * t + pulse * 0.4;
            const rad = (k === 0 || k === steps ? 13 : 11) + pulse * 0.5;

            ctx.fillStyle = "#B91C1C";
            ctx.beginPath();
            ctx.arc(fx, fy, rad + 3, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = "#F97316";
            ctx.beginPath();
            ctx.arc(fx, fy, rad, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = "#FEF08A";
            ctx.beginPath();
            ctx.arc(fx + 2, fy, rad * 0.48, 0, Math.PI * 2);
            ctx.fill();
          }
        });
      }
      ctx.restore();
    });

    // 2. 空中近戰與環形氣浪特效 (藤鞭錐形流線＋音爆半月、空手劈X十字氣勁、撞擊破空音爆錐、比卡超外圍蓄電環)
    this.meleeEffects.forEach(m => {
      if (m.style === "quake_wave") return; // 已在地面底層繪製
      const prog = Math.max(0, Math.min(1, 1 - (m.timer / (m.maxTime || 0.3))));
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - prog * 0.72);

      if (m.style === "vine_whip") {
        // 【奇異種子・V10 經典藤鞭】：雙層 S 彎曲藤蔓 ＋ 兩側倒刺三角與嫩芽圓點 ＋ 末端雙層氣泡音爆環（鞭打落地爆破感）
        const osx = toSx(m.ox !== undefined ? m.ox : m.x);
        const osy = toSy(m.oy !== undefined ? m.oy : m.y);
        ctx.save();
        ctx.translate(osx, osy);
        ctx.rotate(m.angle || 0);

        const reach = m.reach * Math.min(1, prog * 1.8);
        const thickness = 7.8;
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

          ctx.fillStyle = "#86EFAC";
          ctx.beginPath();
          ctx.arc(step, y + side * (thickness * 0.6), 2.3, 0, Math.PI * 2);
          ctx.fill();
        }

        // 末端鞭打落地爆破雙層氣泡音爆環 (V10 經典設計)
        ctx.strokeStyle = "#BBF7D0";
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.arc(reach, 0, 16 * prog, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(reach, 0, 10 * prog, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
      } else if (m.style === "karate_cross") {
        // 【空手劈】：剛猛「X 型白熾十字氣勁斬痕 + 拳風殘影」
        const msx = toSx(m.x), msy = toSy(m.y);
        const r = m.radius * (0.55 + prog * 0.55);
        ctx.save();
        ctx.translate(msx, msy);
        ctx.rotate(m.angle || 0);

        // 兩道交錯的 X 型氣勁斬痕
        [-0.75, 0.75].forEach(rot => {
          ctx.save();
          ctx.rotate(rot);
          ctx.fillStyle = "#7F1D1D";
          ctx.beginPath();
          ctx.ellipse(0, 0, r * 1.15, 6.5 * (1 - prog * 0.5), 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = "#FACC15";
          ctx.beginPath();
          ctx.ellipse(0, 0, r * 1.05, 4.2 * (1 - prog * 0.5), 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = "#FFFFFF";
          ctx.beginPath();
          ctx.ellipse(0, 0, r * 0.85, 2.0 * (1 - prog * 0.5), 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        });
        ctx.restore();
      } else if (m.style === "sonic_cone") {
        // 【撞擊（Tackle）・一體化貼身破空衝鋒風罩】：動態鎖定精靈前撲本體，緊貼鼻尖包覆身體兩側，徹底消除空殼分離感！
        const cRef = m.casterRef;
        const lungeProg = (cRef && cRef.lungeTimer > 0) ? Math.sin((1 - cRef.lungeTimer / (cRef.lungeMaxTime || 0.16)) * Math.PI) : 0;
        const lx = cRef ? Math.cos(cRef.lungeAngle || 0) * (cRef.lungeDist || 0) * lungeProg : 0;
        const ly = cRef ? Math.sin(cRef.lungeAngle || 0) * (cRef.lungeDist || 0) * lungeProg : 0;
        const baseSx = cRef ? toSx(cRef.x) + lx : toSx(m.ox !== undefined ? m.ox : m.x);
        const baseSy = cRef ? toSy(cRef.y) + ly : toSy(m.oy !== undefined ? m.oy : m.y);
        const shroudR = 26 + prog * 10;

        ctx.save();
        ctx.translate(baseSx, baseSy);
        ctx.rotate(m.angle || 0);

        // 1. 身體兩側向後掠起的破風流線羽翼 (Swept-back Slipstreams，從頭頂包覆至身後)
        ctx.strokeStyle = "rgba(224, 242, 254, 0.82)";
        ctx.lineWidth = 2.4 * (1 - prog * 0.35);
        ctx.lineCap = "round";
        [-1, 1].forEach(side => {
          ctx.beginPath();
          ctx.moveTo(16, side * 6);
          ctx.quadraticCurveTo(2, side * (shroudR * 0.85), -20 - prog * 8, side * (shroudR * 0.95));
          ctx.stroke();

          ctx.strokeStyle = "rgba(254, 240, 138, 0.75)";
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(12, side * 12);
          ctx.lineTo(-14 - prog * 10, side * 18);
          ctx.stroke();
        });

        // 2. 緊貼精靈鼻尖前緣 (僅 +6px) 的半透明貼身破空弧形風罩 (Mach Bow Shock)
        const bowGrad = ctx.createRadialGradient(8, 0, 6, 8, 0, shroudR);
        bowGrad.addColorStop(0, "rgba(255, 255, 255, 0.0)");
        bowGrad.addColorStop(0.55, "rgba(186, 230, 253, 0.35)");
        bowGrad.addColorStop(0.88, "rgba(255, 255, 255, 0.92)");
        bowGrad.addColorStop(1, "rgba(255, 255, 255, 0.0)");
        ctx.fillStyle = bowGrad;
        ctx.beginPath();
        ctx.arc(4, 0, shroudR, -1.05, 1.05);
        ctx.arc(-4, 0, shroudR * 0.72, 1.05, -1.05, true);
        ctx.closePath();
        ctx.fill();

        // 風罩最前緣銳利純白高光刃線
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 3.0 * (1 - prog * 0.3);
        ctx.beginPath();
        ctx.arc(5, 0, shroudR * 0.96, -0.92, 0.92);
        ctx.stroke();

        // 鼻尖破空閃光點
        if (prog < 0.65) {
          const tipX = 5 + shroudR * 0.98;
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
        const maxW = 44 * (1 - prog * 0.22);
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
        ctx.strokeStyle = "#FACC15";
        ctx.lineWidth = 2.2;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.arc(0, 0, m.radius + prog * 6, now * 5, now * 5 + Math.PI * 2);
        ctx.stroke();
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
      const ringR = 42 + prog * 185;
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
        ctx.rotate(pr.angle || 0);
        ctx.fillStyle = "#7F1D1D";
        ctx.beginPath(); ctx.arc(0, 0, r * 0.88, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#F97316";
        ctx.beginPath(); ctx.arc(r * 0.08, 0, r * 0.72, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#FEF08A";
        ctx.beginPath(); ctx.arc(r * 0.22, -r * 0.12, r * 0.38, 0, Math.PI * 2); ctx.fill();

      } else if (pr.vfx === "fire_stream") {
        // 【噴火龍・噴射火焰】：四色漸層翻湧火浪（亮白芯 ➔ 明黃 ➔ 橘紅 ➔ 尾端黑煙微粒）
        ctx.rotate(pr.angle || 0);
        const flicker = Math.sin(now * 9 + pr.x * 0.05) * (r * 0.16);

        // 尾端暗煙霧團
        ctx.fillStyle = "rgba(30, 41, 59, 0.45)";
        ctx.beginPath();
        ctx.arc(-r * 0.95, flicker * 0.6, r * 0.52, 0, Math.PI * 2);
        ctx.fill();

        // 深紅外廓火舌
        ctx.fillStyle = "#991B1B";
        ctx.beginPath();
        ctx.arc(r * 0.25, 0, r * 0.82, -Math.PI / 2, Math.PI / 2);
        ctx.lineTo(-r * 1.18, r * 0.58 + flicker);
        ctx.lineTo(-r * 0.65, 0);
        ctx.lineTo(-r * 1.18, -r * 0.58 + flicker);
        ctx.closePath();
        ctx.fill();

        // 橘紅翻湧主火身
        ctx.fillStyle = "#F97316";
        ctx.beginPath();
        ctx.arc(r * 0.25, 0, r * 0.64, -Math.PI / 2, Math.PI / 2);
        ctx.lineTo(-r * 0.92, r * 0.40 + flicker);
        ctx.lineTo(-r * 0.45, 0);
        ctx.lineTo(-r * 0.92, -r * 0.40 + flicker);
        ctx.closePath();
        ctx.fill();

        // 明黃高溫內焰
        ctx.fillStyle = "#FACC15";
        ctx.beginPath();
        ctx.ellipse(r * 0.16, 0, r * 0.48, r * 0.34, 0, 0, Math.PI * 2);
        ctx.fill();

        // 純白熾熱火芯
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.ellipse(r * 0.30, 0, r * 0.26, r * 0.18, 0, 0, Math.PI * 2);
        ctx.fill();

      } else if (pr.vfx === "water_gun") {
        ctx.rotate(pr.angle || 0);
        ctx.fillStyle = "#0284C7";
        ctx.beginPath();
        ctx.moveTo(r * 1.42, 0); ctx.lineTo(-r * 0.78, -r * 0.62); ctx.lineTo(-r * 0.32, 0); ctx.lineTo(-r * 0.78, r * 0.62);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "#00D2FF";
        ctx.beginPath();
        ctx.moveTo(r * 1.25, 0); ctx.lineTo(-r * 0.58, -r * 0.44); ctx.lineTo(-r * 0.18, 0); ctx.lineTo(-r * 0.58, r * 0.44);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "#E0FFFF";
        ctx.beginPath(); ctx.arc(r * 0.38, 0, r * 0.30, 0, Math.PI * 2); ctx.fill();

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
        // 【精神擊破（融合 V10 超夢空間次元三層念刃）】：純白激光邊深紫黑新月刃 ＋ 後方2道漸隱同心念力波環 ＋ 折射鏡面菱片
        ctx.rotate(pr.angle || 0);

        // 1. 後方 2 道動態漸隱同心念力波環
        [-15, -7].forEach((ox, idx) => {
          const scale = 0.74 + idx * 0.14;
          ctx.strokeStyle = idx === 0 ? "rgba(192, 132, 252, 0.45)" : "rgba(244, 114, 182, 0.72)";
          ctx.lineWidth = 2.8;
          ctx.beginPath();
          ctx.ellipse(ox, 0, r * 0.34 * scale, r * 0.88 * scale, 0, 0, Math.PI * 2);
          ctx.stroke();
        });

        // 2. 前端深紫黑次元新月主刃 + 純白高光激光刃口
        ctx.fillStyle = "#3B0764";
        ctx.beginPath();
        ctx.arc(4, 0, r * 0.96, -0.68, 0.68);
        ctx.arc(2, 0, r * 0.42, 0.68, -0.68, true);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = "#EC4899";
        ctx.lineWidth = 4.2;
        ctx.beginPath();
        ctx.arc(4, 0, r * 0.96, -0.65, 0.65);
        ctx.stroke();

        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(5, 0, r * 0.96, -0.58, 0.58);
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
      } else if (pr.vfx === "seed_nut") {
        ctx.rotate(pr.angle || 0);
        ctx.fillStyle = "#3F6212";
        ctx.beginPath();
        ctx.ellipse(0, r * 0.18, r * 0.82, r * 0.95, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#65A30D";
        ctx.beginPath();
        ctx.ellipse(0, r * 0.18, r * 0.70, r * 0.82, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#78350F";
        ctx.strokeStyle = "#451A03";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(0, -r * 0.22, r * 0.84, Math.PI, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#BEF264";
        ctx.beginPath();
        ctx.arc(-r * 0.24, r * 0.1, r * 0.2, 0, Math.PI * 2);
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
        ctx.save();
        ctx.rotate(pr.angle || 0);
        [-22, -12].forEach((tx, idx) => {
          ctx.strokeStyle = idx === 0 ? "rgba(34, 197, 94, 0.35)" : "rgba(134, 239, 172, 0.68)";
          ctx.lineWidth = 4.2 - idx * 1.2;
          ctx.beginPath();
          ctx.arc(tx, 0, r * (0.75 + idx * 0.15), -0.65, 0.65);
          ctx.stroke();
        });
        ctx.restore();
        // 【飛葉快刀（Razor Leaf）】：高速自轉雙色立體鋒利葉片 ＋ 中央亮綠葉脈 ＋ 破空青綠殘影弧線
        const spinAng = (pr.angle || 0) + now * 4.2;
        ctx.rotate(spinAng);

        // 外圍高速旋轉破空青綠刀光環
        ctx.strokeStyle = "rgba(74, 222, 128, 0.65)";
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(0, 0, r * 1.05, -0.4, 1.3);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, r * 1.05, Math.PI - 0.4, Math.PI + 1.3);
        ctx.stroke();

        // 葉片上半受光亮綠面 (#22C55E) 與下半深綠暗面 (#15803D)
        ctx.fillStyle = "#15803D";
        ctx.strokeStyle = "#052E16";
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(r * 1.15, 0);
        ctx.quadraticCurveTo(0, r * 0.68, -r * 1.15, 0);
        ctx.quadraticCurveTo(0, -r * 0.68, r * 1.15, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#4ADE80";
        ctx.beginPath();
        ctx.moveTo(r * 1.12, 0);
        ctx.quadraticCurveTo(0, -r * 0.64, -r * 1.12, 0);
        ctx.closePath();
        ctx.fill();

        // 中央純白與嫩綠葉脈主軸
        ctx.strokeStyle = "#ECFCCB";
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(-r * 0.95, 0);
        ctx.lineTo(r * 0.95, 0);
        ctx.stroke();

      } else if (pr.vfx === "wind_blade") {
        // 【空氣斬（迴旋風刃）】：十字交錯雙層迴旋手裏劍風刃 ＋ 真空切裂氣環
        ctx.rotate(pr.angle || 0);

        // 外圈真空切裂殘影環
        ctx.strokeStyle = "rgba(165, 180, 252, 0.55)";
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.arc(0, 0, r * 1.08, 0, Math.PI * 2);
        ctx.stroke();

        // 十字交錯雙月牙風刃
        [0, Math.PI / 2].forEach((rotOff, idx) => {
          ctx.save();
          ctx.rotate(rotOff);
          ctx.fillStyle = idx === 0 ? "#E0E7FF" : "#C7D2FE";
          ctx.strokeStyle = "#4F46E5";
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.arc(0, 0, r * 0.98, -1.15, 1.15);
          ctx.arc(r * 0.42, 0, r * 0.74, 1.15, -1.15, true);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        });

        // 中心風眼白熾核心
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.24, 0, Math.PI * 2);
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
