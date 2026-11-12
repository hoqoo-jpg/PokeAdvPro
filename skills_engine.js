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

  reset() {
    this.projectiles = [];
    this.meleeEffects = [];
    this.ultimateVfxList = [];
    this.lightningArcs = [];
    this.subParticles = [];
  },

  spawnSubParticle(x, y, vx, vy, color, size, life, shape = "circle") {
    if (this.subParticles.length > 250) this.subParticles.shift();
    this.subParticles.push({
      x, y, vx, vy, color, size, life, maxLife: life, shape,
      rot: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 8
    });
  },

  fireSkill(caster, skillId, level, isEvolved, dmgScale = 1.0) {
    if (skillId === "Metronome") {
      const pool = ["Flamethrower", "Hydro Pump", "Seed Bomb", "Thunderbolt", "Shadow Ball", "Psystrike", "Ice Beam", "Moonblast", "Dragon Rush"];
      const pick = pool[Math.floor(Math.random() * pool.length)];
      this.fireSkill(caster, pick, level, isEvolved, dmgScale * 1.15);
      return;
    }

    const meta = SKILLS_CATALOG[skillId] || SKILLS_CATALOG["Tackle"];
    const cleanSkillId = skillId.replace(/\s+/g, '');

    // 1. 多招式防重疊：差異化智能索敵 (貼身自衛 vs 精英狙擊 vs 怪群轟炸)
    let target = null;
    if (["Thunderbolt", "Psystrike", "IceBeam", "ShadowBall"].includes(cleanSkillId)) {
      // 狙擊型招式：優先鎖定視野內最高血量（精英/Boss）或次近目標，避免全體疊打前排殘血小怪
      target = GameApp.findPriorityTargetInViewport ? GameApp.findPriorityTargetInViewport(caster.x, caster.y, 400, "highest_hp") : GameApp.findNearestEnemyInViewport(caster.x, caster.y, 400);
    } else if (["SeedBomb", "SludgeBomb"].includes(cleanSkillId)) {
      // 投擲轟炸型：優先鎖定怪物密集區中心
      target = GameApp.findPriorityTargetInViewport ? GameApp.findPriorityTargetInViewport(caster.x, caster.y, 360, "cluster") : GameApp.findNearestEnemyInViewport(caster.x, caster.y, 360);
    } else {
      // 貼身自衛型（藤鞭、水槍、火花等）：鎖定最近威脅
      target = GameApp.findNearestEnemyInViewport(caster.x, caster.y, 380);
    }

    const baseAngle = target
      ? Math.atan2(target.y - caster.y, target.x - caster.x)
      : (caster.facingX >= 0 ? 0 : Math.PI);

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

    const basePower = meta.baseDmg * 0.55 + (GameApp.player.baseAtk * 0.18);
    // 依據最新版，xAtkMod 在 battle_core_2 的 dealDamageToEnemy 結算，此處不重複乘算
    const rawDmg = basePower * lvDmgMult * GameApp.player.dmgMult * stabMult * dmgScale * stageBuffMult * weatherBuff * heldItemMult;

    if (meta.isMelee) {
      this.executeMeleeSkill(caster, meta, level, count, baseAngle, rawDmg);
      return;
    }

    if (skillId === "Thunderbolt") {
      const maxStrikeRange = 165 * GameApp.player.areaMult;
      const nearby = GameApp.enemies
        .filter(e => Math.hypot(e.x - caster.x, e.y - caster.y) <= maxStrikeRange)
        .sort((a, b) => Math.hypot(a.x - caster.x, a.y - caster.y) - Math.hypot(b.x - caster.x, b.y - caster.y));

      const thunderBonus = (MapEngine.weather === "THUNDER" ? 1 : 0);
      const boltCount = Math.max(3, count + 1 + thunderBonus);
      for (let b = 0; b < boltCount; b++) {
        const enemyTarget = nearby[b];
        let endX, endY;
        if (enemyTarget) {
          endX = enemyTarget.x; endY = enemyTarget.y;
          GameApp.dealDamageToEnemy(enemyTarget, rawDmg, meta.type, level >= 5 ? 0.25 : 0.18, meta.knockback !== undefined ? meta.knockback : 2);
        } else {
          const spreadAng = baseAngle + (b - (boltCount - 1) / 2) * 0.36;
          const rDist = (120 + Math.random() * 85) * GameApp.player.areaMult;
          endX = caster.x + Math.cos(spreadAng) * rDist;
          endY = caster.y + Math.sin(spreadAng) * rDist;
          GameApp.enemies.forEach(e => {
            if (Math.hypot(e.x - endX, e.y - endY) <= 44 + e.radius) {
              GameApp.dealDamageToEnemy(e, rawDmg * 0.85, meta.type, 0.35, meta.knockback !== undefined ? meta.knockback : 2);
            }
          });
        }
        this.createLightningArc(caster.x, caster.y, endX, endY, "#FDE047");
        for (let sp = 0; sp < 6; sp++) {
          const sAng = Math.random() * Math.PI * 2;
          const spd = 60 + Math.random() * 90;
          this.spawnSubParticle(endX, endY, Math.cos(sAng) * spd, Math.sin(sAng) * spd, sp % 2 === 0 ? "#FEF08A" : "#FFFFFF", 2.5 + Math.random() * 2, 0.35, "star");
        }
      }
      SoundFX.play("hit");
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
          radius: (13 + level * 0.5) * GameApp.player.areaMult,
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
      SoundFX.play("hit");
      return;
    }

    // 3. 多招式幾何發射偏移與微序列交錯（防止同點疊彈）
    const perpAng = baseAngle + Math.PI / 2;
    const isWingSkill = ["AirSlash", "RazorLeaf", "IceBeam"].includes(cleanSkillId);

    for (let i = 0; i < count; i++) {
      const spread = count > 1 ? (i - (count - 1) / 2) * 0.17 : (cleanSkillId === "Ember" ? (Math.random() - 0.5) * 0.14 : 0);
      const ang = baseAngle + spread;
      const spd = (cleanSkillId === "WaterGun" || cleanSkillId === "Ember") ? 345 : (cleanSkillId === "HydroPump" ? 330 : (cleanSkillId === "AirSlash" ? 365 : 310));
      const isHoming = (cleanSkillId === "ShadowBall" || cleanSkillId === "Psystrike" || cleanSkillId === "Moonblast");

      // 左右側翼平行偏移 (±15px) 與前向微錯開，使彈幕呈雙軌或扇形展開不重疊
      const lateralOffset = isWingSkill
        ? ((i % 2 === 0 ? 1 : -1) * 15)
        : (count > 1 ? (i - (count - 1) / 2) * 10 : 0);
      const forwardStagger = i * 10;

      const spawnX = caster.x + Math.cos(perpAng) * lateralOffset + Math.cos(ang) * forwardStagger;
      const spawnY = caster.y + Math.sin(perpAng) * lateralOffset + Math.sin(ang) * forwardStagger;

      this.projectiles.push({
        x: spawnX,
        y: spawnY,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        angle: ang,
        radius: (cleanSkillId === "HydroPump" ? 22 : 16) * GameApp.player.areaMult * (level >= 8 ? 1.25 : 1.0),
        dmg: rawDmg,
        type: meta.type,
        skillId,
        vfx: meta.vfx || "star_shot",
        homing: isHoming,
        color: meta.color,
        pierce: (level >= 6 ? 3 : 2),
        knockback: meta.knockback !== undefined ? meta.knockback : 0,
        life: 0.88,
        statusBonus: level >= 5 ? 0.30 : 0,
        hitSet: new Set(),
        trailTimer: 0
      });
    }
    SoundFX.play("hit");
  },

  executeMeleeSkill(caster, meta, level, count, baseAngle, rawDmg) {
    const style = meta.meleeStyle || "claw_slash";
    const areaScale = GameApp.player.areaMult * (level >= 3 ? 1.15 : 1.0) * (level >= 8 ? 1.25 : 1.0);
    const kb = meta.knockback !== undefined ? meta.knockback : 8;

    // 0. 妙蛙種子：沙盒 V10 正弦波倒刺 S 藤鞭 (Vine Whip)
    if (style === "vine_whip") {
      const whipCount = 1 + (level >= 5 ? 1 : 0);
      const reach = (130 + level * 7) * areaScale;
      for (let w = 0; w < whipCount; w++) {
        const spread = (w - (whipCount - 1) / 2) * 0.32;
        const ang = baseAngle + spread;
        this.meleeEffects.push({
          style: "vine_whip",
          ox: caster.x,
          oy: caster.y,
          x: caster.x,
          y: caster.y,
          angle: ang,
          reach: reach,
          timer: 0.38,
          maxTime: 0.38,
          color: "#15803D"
        });

        // 沿藤鞭路徑判定傷害與擊退
        GameApp.enemies.forEach(e => {
          const dx = e.x - caster.x, dy = e.y - caster.y;
          const dist = Math.hypot(dx, dy);
          if (dist <= reach + e.radius) {
            const eAng = Math.atan2(dy, dx);
            const diff = Math.abs(Math.atan2(Math.sin(eAng - ang), Math.cos(eAng - ang)));
            if (diff <= 0.62 || dist < 35) {
              GameApp.dealDamageToEnemy(e, rawDmg * 1.15, meta.type, 0.28, kb * 1.2);
            }
          }
        });

        // 藤鞭末端噴發微量飛葉粒子
        const tipX = caster.x + Math.cos(ang) * reach;
        const tipY = caster.y + Math.sin(ang) * reach;
        for (let lf = -1; lf <= 1; lf++) {
          const leafAng = ang + lf * 0.25;
          this.spawnSubParticle(
            tipX, tipY,
            Math.cos(leafAng) * (60 + Math.random() * 35),
            Math.sin(leafAng) * (60 + Math.random() * 35),
            lf === 0 ? "#15803D" : "#4ADE80",
            3.0, 0.32, "leaf"
          );
        }
      }
      SoundFX.play("hit");
      return;
    }

    if (style === "martial_fist") {
      // 空手劈回歸近身剛猛拳打：身前小半徑爆發短打連擊
      const reach = 85 * areaScale;
      const strikes = Math.min(3, 1 + Math.floor(level / 4));
      for (let s = 0; s < strikes; s++) {
        const fAng = baseAngle + (s - (strikes - 1) / 2) * 0.28;
        const fx = caster.x + Math.cos(fAng) * (reach * 0.6);
        const fy = caster.y + Math.sin(fAng) * (reach * 0.6);
        this.meleeEffects.push({
          style: "slam_wave",
          x: fx,
          y: fy,
          radius: reach * 0.65,
          timer: 0.28,
          maxTime: 0.28,
          color: meta.color
        });
        GameApp.enemies.forEach(e => {
          if (Math.hypot(e.x - fx, e.y - fy) <= reach * 0.65 + e.radius) {
            GameApp.dealDamageToEnemy(e, rawDmg * 1.25, meta.type, 0.30, kb * 1.35);
          }
        });
      }
      GameApp.spawnParticleCluster(caster.x + Math.cos(baseAngle) * 30, caster.y + Math.sin(baseAngle) * 30, "#FFFFFF", "#FEF08A", 12, "star", 1.0);
      SoundFX.play("hit");
      return;
    }

    // 1. 撞擊專屬：身前俐落小衝鋒氣浪 (Forward Arc) ＋ 輕量微型碎屑，不遮擋子彈
    if (style === "slam_wave") {
      const fDist = 32 * areaScale;
      const hitX = caster.x + Math.cos(baseAngle) * fDist;
      const hitY = caster.y + Math.sin(baseAngle) * fDist;
      const rad = 46 * areaScale;

      this.meleeEffects.push({
        style: "slam_wave",
        ox: caster.x,
        oy: caster.y,
        x: hitX,
        y: hitY,
        angle: baseAngle,
        radius: rad,
        timer: 0.22,
        maxTime: 0.22,
        color: "rgba(203, 213, 225, 0.40)"
      });

      // 輕量保留 3 顆極淡的微型菱形碎屑，保留反饋但尺寸僅 1.8px，絕不遮擋或混淆敵方飛行道具
      for (let d = 0; d < 3; d++) {
        const dAng = baseAngle + (Math.random() - 0.5) * 0.8;
        const dSpd = 30 + Math.random() * 35;
        this.spawnSubParticle(
          hitX, hitY,
          Math.cos(dAng) * dSpd, Math.sin(dAng) * dSpd,
          "rgba(226, 232, 240, 0.45)", 1.8, 0.25, "diamond"
        );
      }

      GameApp.enemies.forEach(e => {
        if (Math.hypot(e.x - hitX, e.y - hitY) <= rad + e.radius) {
          GameApp.dealDamageToEnemy(e, rawDmg, meta.type, 0.20, kb);
          if (caster === GameApp.player && GameApp.player.hp < GameApp.player.maxHp) {
            GameApp.player.hp = Math.min(GameApp.player.maxHp, GameApp.player.hp + Math.round(GameApp.player.maxHp * 0.008));
          }
        }
      });
      SoundFX.play("hit");
      return;
    }

    // 2. 地震專屬：大範圍環形地裂
    if (style === "quake_wave") {
      const rad = (85 + level * 4) * areaScale;
      this.meleeEffects.push({
        style,
        x: caster.x,
        y: caster.y,
        radius: rad,
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

      GameApp.enemies.forEach(e => {
        if (Math.hypot(e.x - caster.x, e.y - caster.y) <= rad + e.radius) {
          GameApp.dealDamageToEnemy(e, rawDmg, meta.type, 0.20, kb);
          if (caster === GameApp.player && GameApp.player.hp < GameApp.player.maxHp) {
            GameApp.player.hp = Math.min(GameApp.player.maxHp, GameApp.player.hp + Math.round(GameApp.player.maxHp * 0.008));
          }
        }
      });
      SoundFX.play("ultimate");
      return;
    }

    const maxReach = 105 * areaScale;
    const waves = Math.min(3, Math.ceil(count / 2));
    for (let w = 0; w < waves; w++) {
      const ang = baseAngle + (w - (waves - 1) / 2) * 0.48;
      this.meleeEffects.push({
        style,
        ox: caster.x,
        oy: caster.y,
        x: caster.x + Math.cos(ang) * (maxReach * 0.55),
        y: caster.y + Math.sin(ang) * (maxReach * 0.55),
        angle: ang,
        radius: maxReach,
        timer: 0.34,
        maxTime: 0.34,
        color: meta.color
      });

      GameApp.enemies.forEach(e => {
        const dx = e.x - caster.x, dy = e.y - caster.y;
        const d = Math.hypot(dx, dy);
        if (d <= maxReach + e.radius) {
          const eAng = Math.atan2(dy, dx);
          const diff = Math.abs(Math.atan2(Math.sin(eAng - ang), Math.cos(eAng - ang)));
          if (diff <= 0.95 || d < 40) {
            GameApp.dealDamageToEnemy(e, rawDmg, meta.type, 0.28, kb);
            if (caster === GameApp.player && GameApp.player.hp < GameApp.player.maxHp) {
              GameApp.player.hp = Math.min(GameApp.player.maxHp, GameApp.player.hp + Math.round(GameApp.player.maxHp * 0.008));
            }
          }
        }
      });
    }
    SoundFX.play("hit");
  },

  triggerUltimateSuperMove(meta, skSlot) {
    const p = GameApp.player;
    // 究極超武改為微弱柔和震動，絕不干擾走位與視覺
    GameApp.camera.shakeTime = 0.15;
    GameApp.camera.shakeMagnitude = 3.0;
    SoundFX.play("ultimate");

    const ultDmg = (meta.baseDmg * 2.8 + p.baseAtk * 1.3) * p.dmgMult;

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
      for (let i = 0; i < 16; i++) {
        const ang = (i * Math.PI * 2) / 16;
        const dist = 160 + Math.random() * 180;
        const tx = p.x + Math.cos(ang) * dist;
        const ty = p.y + Math.sin(ang) * dist;
        this.createLightningArc(p.x, p.y, tx, ty, "#FDE047");
        for (let k = 0; k < 5; k++) {
          this.spawnSubParticle(tx, ty, (Math.random() - 0.5) * 120, (Math.random() - 0.5) * 120, "#FFFFFF", 3.0, 0.4, "star");
        }
      }
    } else if (meta.type === "Fire") {
      for (let i = 0; i < 8; i++) {
        const ang = (i * Math.PI * 2) / 8;
        this.projectiles.push({
          x: p.x, y: p.y,
          vx: Math.cos(ang) * 340, vy: Math.sin(ang) * 340,
          angle: ang, radius: 26, dmg: ultDmg * 0.70,
          type: "Fire", skillId: "Flamethrower", vfx: "fire_stream",
          color: "#EF4444", pierce: 8, knockback: 0, life: 1.05, statusBonus: 0.6, hitSet: new Set(), trailTimer: 0
        });
      }
    } else if (meta.type === "Water") {
      for (let i = 0; i < 10; i++) {
        const ang = (i * Math.PI * 2) / 10;
        this.projectiles.push({
          x: p.x, y: p.y,
          vx: Math.cos(ang) * 380, vy: Math.sin(ang) * 380,
          angle: ang, radius: 26, dmg: ultDmg * 0.70,
          type: "Water", skillId: "Hydro Pump", vfx: "water_beam",
          color: "#38BDF8", pierce: 8, knockback: 25, life: 1.05, statusBonus: 0.5, hitSet: new Set(), trailTimer: 0
        });
      }
    } else if (meta.type === "Grass") {
      for (let g = 0; g < 30; g++) {
        const gAng = Math.random() * Math.PI * 2;
        const gSpd = 50 + Math.random() * 140;
        this.spawnSubParticle(p.x, p.y, Math.cos(gAng) * gSpd, Math.sin(gAng) * gSpd, g % 2 === 0 ? "#22C55E" : "#86EFAC", 4.0, 0.9, "leaf");
      }
    }

    const halfW = GameApp.width / 2 + 70;
    const halfH = GameApp.height / 2 + 70;
    GameApp.enemies.forEach(e => {
      if (Math.abs(e.x - p.x) <= halfW && Math.abs(e.y - p.y) <= halfH) {
        // 地裂斷層破：飛濺巨岩可對飛行系造成相當於 75% 的重擊，突破地面系對三聖鳥的刮痧限制
        let adjustedDmg = ultDmg;
        if (meta.type === "Ground" && (e.data.type1 === "Flying" || e.data.type2 === "Flying")) {
          adjustedDmg = ultDmg * 7.5; // 抵銷 0.1x 後達 0.75x 實質傷害
        }
        GameApp.dealDamageToEnemy(e, adjustedDmg, meta.type, 0.70, e.isBoss ? 0 : 35);
      }
    });

    if (meta.type === "Grass") {
      p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * 0.08));
    }
  },

  createLightningArc(x1, y1, x2, y2, color) {
    const pts = [{ x: x1, y: y1 }];
    const steps = 7;
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      pts.push({
        x: x1 + (x2 - x1) * t + (Math.random() - 0.5) * 36,
        y: y1 + (y2 - y1) * t + (Math.random() - 0.5) * 36
      });
    }
    pts.push({ x: x2, y: y2 });
    this.lightningArcs.push({ pts, color, timer: 0.28 });
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
        const target = GameApp.findNearestEnemyInViewport(pr.x, pr.y, 380);
        if (target) {
          const desired = Math.atan2(target.y - pr.y, target.x - pr.x);
          const spd = Math.hypot(pr.vx, pr.vy);
          pr.vx = pr.vx * 0.90 + Math.cos(desired) * spd * 0.10;
          pr.vy = pr.vy * 0.90 + Math.sin(desired) * spd * 0.10;
          pr.angle = Math.atan2(pr.vy, pr.vx);
        }
      }

      // 種子炸彈正弦物理高拋拋物線 (飛越前排障礙並定點引爆)
      if (pr.vfx === "seed_nut") {
        pr.progress = (pr.progress || 0) + dt / pr.maxLife;
        const t = Math.min(1, pr.progress);
        pr.x = pr.startX + (pr.targetX - pr.startX) * t;
        pr.y = pr.startY + (pr.targetY - pr.startY) * t - Math.sin(t * Math.PI) * (pr.arcHeight || 68);
        pr.angle = (pr.angle || 0) + dt * 9;

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
          GameApp.enemies.forEach(e => {
            if (Math.hypot(e.x - pr.targetX, e.y - pr.targetY) <= blastRadius + e.radius) {
              GameApp.dealDamageToEnemy(e, pr.dmg, pr.type, pr.statusBonus, pr.knockback || 10);
            }
          });
          SoundFX.play("hit");
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
        } else if (pr.vfx === "seed_cluster") {
          this.spawnSubParticle(pr.x, pr.y, (Math.random() - 0.5) * 15, (Math.random() - 0.5) * 15, "#4ADE80", 2.8, 0.28, "leaf");
        } else if (pr.vfx === "frost_beam") {
          this.spawnSubParticle(pr.x, pr.y, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, "#E0F2FE", 2.5, 0.25, "diamond");
        } else if (pr.vfx === "shadow_orb" || pr.vfx === "sludge_ball") {
          this.spawnSubParticle(pr.x, pr.y, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, pr.color || "#C084FC", 3.0, 0.30, "circle");
        }
      }

      if (pr.spawnGraceTimer && pr.spawnGraceTimer > 0) continue;
      for (let j = GameApp.enemies.length - 1; j >= 0; j--) {
        const e = GameApp.enemies[j];
        if (pr.hitSet.has(e)) continue;
        if (Math.hypot(e.x - pr.x, e.y - pr.y) <= pr.radius + e.radius) {
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
      this.meleeEffects[i].timer -= dt;
      if (this.meleeEffects[i].timer <= 0) {
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
  },

  render(ctx, toSx, toSy) {
    this.meleeEffects.forEach(m => {
      const prog = 1 - (m.timer / m.maxTime);
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - prog * 0.75);

      // 0. 妙蛙種子：沙盒 V10 正弦波倒刺 S 藤鞭 (Vine Whip)
      if (m.style === "vine_whip") {
        const osx = toSx(m.ox !== undefined ? m.ox : m.x);
        const osy = toSy(m.oy !== undefined ? m.oy : m.y);
        ctx.save();
        ctx.translate(osx, osy);
        ctx.rotate(m.angle || 0);

        const reach = m.reach * Math.min(1, prog * 1.7);
        const thickness = 7;
        const waveFreq = 2.4;
        const waveAmp = (1 - prog * 0.45) * 22;

        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        // 外層深綠描邊
        ctx.strokeStyle = "#14532D";
        ctx.lineWidth = thickness + 3;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        for (let x = 0; x <= reach; x += 8) {
          const t = x / reach;
          const y = Math.sin(t * Math.PI * waveFreq) * waveAmp * Math.sin(t * Math.PI);
          ctx.lineTo(x, y);
        }
        ctx.stroke();

        // 內層亮綠主幹
        ctx.strokeStyle = "#22C55E";
        ctx.lineWidth = thickness;
        ctx.stroke();

        // 沿途生長立體倒刺與嫩芽圓點
        for (let step = 25; step < reach - 16; step += 22) {
          const t = step / reach;
          const y = Math.sin(t * Math.PI * waveFreq) * waveAmp * Math.sin(t * Math.PI);
          const side = (step % 44 === 0) ? 1 : -1;

          // 倒刺三角形
          ctx.fillStyle = "#15803D";
          ctx.beginPath();
          ctx.moveTo(step, y);
          ctx.lineTo(step + 5, y + side * (thickness + 5));
          ctx.lineTo(step - 3, y + side * (thickness + 1.5));
          ctx.closePath();
          ctx.fill();

          // 芽苞嫩綠圓點
          ctx.fillStyle = "#86EFAC";
          ctx.beginPath();
          ctx.arc(step, y + side * (thickness * 0.55), 2.0, 0, Math.PI * 2);
          ctx.fill();
        }

        // 末端雙層微型破空音爆環
        ctx.strokeStyle = "rgba(187, 247, 208, 0.85)";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(reach, 0, 14 * prog, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(reach, 0, 8 * prog, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
      } else if (m.style === "slam_wave") {
        // 撞擊專屬：身前扇形俐落半透明小氣浪，低飽和灰白，不遮擋任何敵方子彈
        const msx = toSx(m.x), msy = toSy(m.y);
        const curR = m.radius * (0.35 + prog * 0.65);
        ctx.save();
        ctx.translate(msx, msy);
        ctx.rotate(m.angle || 0);

        ctx.strokeStyle = "rgba(203, 213, 225, 0.35)";
        ctx.lineWidth = 2.0 * (1 - prog * 0.5);
        ctx.beginPath();
        ctx.arc(0, 0, curR, -0.65, 0.65);
        ctx.stroke();

        ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(0, 0, curR * 0.8, -0.5, 0.5);
        ctx.stroke();
        ctx.restore();
      } else if (m.style === "quake_wave") {
        const msx = toSx(m.x), msy = toSy(m.y);
        const curR = m.radius * (0.28 + prog * 0.72);

        ctx.strokeStyle = m.color;
        ctx.lineWidth = 5 * (1 - prog * 0.5);
        ctx.beginPath();
        ctx.arc(msx, msy, curR, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(msx, msy, curR * 0.8, 0, Math.PI * 2);
        ctx.stroke();

        // 八方放射地裂紋與多段土黃岩層
        ctx.strokeStyle = "rgba(180, 83, 9, 0.85)";
        ctx.lineWidth = 2.8 * (1 - prog * 0.5);
        for (let crack = 0; crack < 8; crack++) {
          const cAng = (crack * Math.PI * 2) / 8 + (crack % 2 === 0 ? 0.08 : -0.08);
          const midR = curR * 0.55;
          ctx.beginPath();
          ctx.moveTo(msx + Math.cos(cAng) * (curR * 0.2), msy + Math.sin(cAng) * (curR * 0.2));
          ctx.lineTo(msx + Math.cos(cAng + 0.1) * midR, msy + Math.sin(cAng + 0.1) * midR);
          ctx.lineTo(msx + Math.cos(cAng) * (curR * 0.95), msy + Math.sin(cAng) * (curR * 0.95));
          ctx.stroke();
        }
        // 地裂同心土褐色環
        ctx.strokeStyle = "rgba(217, 119, 6, 0.55)";
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(msx, msy, curR * 0.6, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        const osx = toSx(m.ox !== undefined ? m.ox : m.x);
        const osy = toSy(m.oy !== undefined ? m.oy : m.y);
        const curR = m.radius * (0.25 + prog * 0.8);
        ctx.translate(osx, osy);
        ctx.rotate(m.angle || 0);

        ctx.fillStyle = m.color;
        ctx.beginPath();
        ctx.arc(0, 0, curR, -0.9, 0.9);
        ctx.arc(0, 0, curR * 0.4, 0.9, -0.9, true);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(0, 0, curR, -0.85, 0.85);
        ctx.stroke();
      }
      ctx.restore();
    });

    this.ultimateVfxList.forEach(u => {
      const prog = 1 - (u.timer / u.maxTime);
      const usx = toSx(u.x), usy = toSy(u.y);
      ctx.save();

      if (u.type === "Fire") {
        ctx.translate(usx, usy);
        const curR = u.radius * (0.4 + prog * 0.7);
        ctx.globalAlpha = Math.max(0, 1 - prog * 0.8);

        ctx.strokeStyle = "#EF4444";
        ctx.lineWidth = 8 * (1 - prog * 0.6);
        ctx.beginPath(); ctx.arc(0, 0, curR, 0, Math.PI * 2); ctx.stroke();

        ctx.strokeStyle = "#FDE047";
        ctx.lineWidth = 4 * (1 - prog * 0.6);
        ctx.beginPath(); ctx.arc(0, 0, curR * 0.85, 0, Math.PI * 2); ctx.stroke();

        ctx.rotate(prog * 1.5);
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 6 * (1 - prog * 0.5);
        ctx.lineCap = "round";
        const sz = 55 * (1 + prog * 0.4);
        ctx.beginPath();
        ctx.moveTo(-sz, 0); ctx.lineTo(sz, 0);
        ctx.moveTo(0, -sz * 0.9); ctx.lineTo(0, sz * 0.9);
        ctx.moveTo(0, 0); ctx.lineTo(-sz * 0.7, sz * 0.9);
        ctx.moveTo(0, 0); ctx.lineTo(sz * 0.7, sz * 0.9);
        ctx.stroke();

      } else if (u.type === "Water") {
        ctx.translate(usx, usy);
        ctx.globalAlpha = Math.max(0, 1 - prog * 0.75);
        ctx.rotate(-prog * 4.5);

        for (let arm = 0; arm < 4; arm++) {
          const aAng = (arm * Math.PI * 2) / 4;
          ctx.strokeStyle = arm % 2 === 0 ? "#0284C7" : "#38BDF8";
          ctx.lineWidth = 5 * (1 - prog * 0.5);
          ctx.beginPath();
          ctx.arc(0, 0, 70 + prog * 130, aAng, aAng + 1.2);
          ctx.stroke();
        }
      } else if (u.type === "Grass") {
        ctx.translate(usx, usy);
        ctx.globalAlpha = Math.max(0, 1 - prog * 0.7);
        ctx.strokeStyle = "#22C55E";
        ctx.lineWidth = 5 * (1 - prog * 0.6);
        ctx.beginPath();
        ctx.arc(0, 0, 80 + prog * 110, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = "#86EFAC";
        ctx.lineWidth = 2.5;
        for (let k = 0; k < 8; k++) {
          const kAng = (k * Math.PI * 2) / 8 + prog;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(kAng) * (70 + prog * 90), Math.sin(kAng) * (70 + prog * 90));
          ctx.stroke();
        }
      } else {
        ctx.translate(usx, usy);
        ctx.globalAlpha = Math.max(0, 1 - prog * 0.8);
        ctx.strokeStyle = u.color || "#FACC15";
        ctx.lineWidth = 6 * (1 - prog * 0.5);
        ctx.beginPath();
        ctx.arc(0, 0, 50 + prog * 170, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 30 + prog * 140, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    });

    this.projectiles.forEach(pr => {
      const sx = toSx(pr.x), sy = toSy(pr.y);
      const r = pr.radius;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(pr.angle || 0);

      if (pr.vfx === "ember_spark") {
        // 火花：輕快跳動的橙紅小火核
        ctx.fillStyle = "#F97316";
        ctx.beginPath(); ctx.arc(0, 0, r * 0.75, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#FEF08A";
        ctx.beginPath(); ctx.arc(r * 0.2, -r * 0.2, r * 0.35, 0, Math.PI * 2); ctx.fill();
      } else if (pr.vfx === "water_gun") {
        // 水槍：破空梭形水箭彈束
        ctx.fillStyle = "#38BDF8";
        ctx.beginPath();
        ctx.moveTo(r * 1.3, 0); ctx.lineTo(-r * 0.6, -r * 0.45); ctx.lineTo(-r * 0.2, 0); ctx.lineTo(-r * 0.6, r * 0.45);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath(); ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2); ctx.fill();
      } else if (pr.vfx === "giant_fist") {
        ctx.fillStyle = pr.color || "#DC2626";
        ctx.strokeStyle = "#FEF08A";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.roundRect(-18, -16, 32, 32, 9);
        ctx.fill(); ctx.stroke();

        ctx.fillStyle = "#FFFFFF";
        for (let k = -1.5; k <= 1.5; k += 1) {
          ctx.beginPath(); ctx.arc(12, k * 7.5, 4.5, 0, Math.PI * 2); ctx.fill();
        }
      } else if (pr.vfx === "fire_stream") {
        ctx.fillStyle = "#DC2626";
        ctx.beginPath();
        ctx.moveTo(r * 1.1, 0);
        ctx.lineTo(-r * 0.9, -r * 0.65);
        ctx.lineTo(-r * 0.5, 0);
        ctx.lineTo(-r * 0.9, r * 0.65);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "#F97316";
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 0.65, r * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.ellipse(r * 0.2, 0, r * 0.35, r * 0.2, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (pr.vfx === "water_beam") {
        ctx.fillStyle = "#0284C7";
        ctx.beginPath(); ctx.ellipse(0, 0, r * 0.9, r * 0.6, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#38BDF8";
        ctx.beginPath(); ctx.ellipse(r * 0.1, 0, r * 0.65, r * 0.4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath(); ctx.arc(r * 0.25, -r * 0.15, r * 0.22, 0, Math.PI * 2); ctx.fill();
      } else if (pr.vfx === "seed_nut") {
        // 沙盒 V10 立體木紋橡子 (Acorn) 渲染
        // 下半身草綠色飽滿果實
        ctx.fillStyle = "#65A30D";
        ctx.beginPath();
        ctx.ellipse(0, r * 0.18, r * 0.72, r * 0.85, 0, 0, Math.PI * 2);
        ctx.fill();

        // 縱向深綠溝槽木紋
        ctx.strokeStyle = "#3F6212";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(-r * 0.28, -r * 0.25); ctx.quadraticCurveTo(-r * 0.35, r * 0.25, -r * 0.15, r * 0.85);
        ctx.moveTo(r * 0.28, -r * 0.25);  ctx.quadraticCurveTo(r * 0.35, r * 0.25, r * 0.15, r * 0.85);
        ctx.stroke();

        // 頂部深褐色橡子帽
        ctx.fillStyle = "#78350F";
        ctx.beginPath();
        ctx.arc(0, -r * 0.22, r * 0.82, Math.PI, 0);
        ctx.closePath();
        ctx.fill();

        // 橡子帽網格刻紋與頂蒂
        ctx.strokeStyle = "#451A03";
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, -r * 1.04); ctx.lineTo(0, -r * 1.28);
        ctx.stroke();

        // 亮綠高光點
        ctx.fillStyle = "#BEF264";
        ctx.beginPath();
        ctx.arc(-r * 0.25, r * 0.1, r * 0.2, 0, Math.PI * 2);
        ctx.fill();
      } else if (pr.vfx === "seed_cluster") {
        ctx.fillStyle = "#15803D";
        ctx.beginPath(); ctx.arc(0, 0, r * 0.75, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#4ADE80";
        ctx.beginPath(); ctx.arc(-r * 0.15, -r * 0.15, r * 0.45, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#FEF08A";
        ctx.beginPath(); ctx.arc(r * 0.15, r * 0.15, r * 0.22, 0, Math.PI * 2); ctx.fill();
      } else if (pr.vfx === "frost_beam") {
        ctx.fillStyle = "#0284C7";
        ctx.strokeStyle = "#E0F2FE";
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(r * 1.1, 0); ctx.lineTo(0, -r * 0.55); ctx.lineTo(-r * 0.9, 0); ctx.lineTo(0, r * 0.55);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
      } else if (pr.vfx === "wind_blade") {
        ctx.fillStyle = "rgba(224, 231, 255, 0.9)";
        ctx.strokeStyle = "#818CF8";
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.9, -1.2, 1.2);
        ctx.arc(r * 0.4, 0, r * 0.7, 1.2, -1.2, true);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
      } else {
        ctx.fillStyle = pr.color || "#FACC15";
        ctx.beginPath(); ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath(); ctx.arc(r * 0.2, -r * 0.15, r * 0.32, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    });

    this.lightningArcs.forEach(arc => {
      ctx.save();
      ctx.strokeStyle = arc.color;
      ctx.lineWidth = 5.5;
      ctx.lineJoin = "round";
      ctx.beginPath();
      arc.pts.forEach((pt, idx) => {
        const sx = toSx(pt.x), sy = toSy(pt.y);
        if (idx === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      });
      ctx.stroke();

      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      arc.pts.forEach((pt, idx) => {
        const sx = toSx(pt.x), sy = toSy(pt.y);
        if (idx === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      });
      ctx.stroke();
      ctx.restore();
    });

    this.subParticles.forEach(sp => {
      const sx = toSx(sp.x), sy = toSy(sp.y);
      ctx.save();
      ctx.globalAlpha = Math.max(0, sp.life / sp.maxLife);
      ctx.translate(sx, sy);
      ctx.rotate(sp.rot || 0);

      if (sp.shape === "leaf") {
        ctx.fillStyle = sp.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, sp.size * 1.5, sp.size * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (sp.shape === "diamond") {
        ctx.fillStyle = sp.color;
        ctx.beginPath();
        ctx.moveTo(0, -sp.size); ctx.lineTo(sp.size, 0); ctx.lineTo(0, sp.size); ctx.lineTo(-sp.size, 0);
        ctx.closePath();
        ctx.fill();
      } else if (sp.shape === "star") {
        ctx.fillStyle = sp.color;
        ctx.fillRect(-sp.size * 0.5, -sp.size * 0.5, sp.size, sp.size);
      } else {
        ctx.fillStyle = sp.color;
        ctx.beginPath();
        ctx.arc(0, 0, sp.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });
  }
};
