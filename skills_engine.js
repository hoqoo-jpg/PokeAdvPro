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

  spawnSubParticle(x, y, vx, vy, color, size, life, shape = "circle") {
    if (this.subParticles.length > 250) this.subParticles.shift();
    this.subParticles.push({
      x, y, vx, vy, color, size, life, maxLife: life, shape,
      rot: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 8
    });
  },

  fireSkill(caster, skillId, level, isEvolved, dmgScale = 1.0, slotIdx = 0) {
    if (skillId === "Metronome") {
      const pool = ["Flamethrower", "Hydro Pump", "Razor Leaf", "Seed Bomb", "Thunderbolt", "Shadow Ball", "Psystrike", "Ice Beam", "Moonblast", "Dragon Rush"];
      const pick = pool[Math.floor(Math.random() * pool.length)];
      this.fireSkill(caster, pick, level, isEvolved, dmgScale * 1.15, slotIdx);
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

      const thunderBonus = (MapEngine.weather === "THUNDER" ? 1 : 0);
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
          GameApp.enemies.forEach(e => {
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
      SoundFX.play("hit");
      return;
    }

    // 2C. 月亮之力 (Moonblast)：鎖定敵群降下持續 1.35 秒的多段移動月光聖柱 (4段連擊+降攻)
    if (cleanSkillId === "Moonblast") {
      const pillarCount = Math.min(2, 1 + (level >= 7 ? 1 : 0));
      for (let i = 0; i < pillarCount; i++) {
        const ang = baseAngle + (i - (pillarCount - 1) / 2) * 0.45;
        const dist = (!useManualAim && target) ? Math.min(260, Math.hypot(target.x - caster.x, target.y - caster.y)) : 140;
        const px = caster.x + Math.cos(ang) * dist;
        const py = caster.y + Math.sin(ang) * dist;
        this.groundHazards.push({
          kind: "moon_pillar",
          x: px, y: py,
          vx: Math.cos(ang) * 28, vy: Math.sin(ang) * 28,
          radius: (46 + level * 2.5) * GameApp.player.areaMult,
          dmg: rawDmg * 0.52,
          type: "Psychic",
          timer: 1.35, maxTime: 1.35,
          tickTimer: 0.05, tickInterval: 0.32,
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
        this.projectiles.push({
          x: startX,
          y: startY,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          angle: ang,
          radius: (20 + level * 0.8) * GameApp.player.areaMult,
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
      SoundFX.play("hit");
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
            radius: (15 + w * 4.5) * GameApp.player.areaMult * (level >= 8 ? 1.25 : 1.0),
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
      SoundFX.play("hit");
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
      const spd = (cleanSkillId === "WaterGun" || cleanSkillId === "Ember" || cleanSkillId === "RazorLeaf") ? 355 : (cleanSkillId === "HydroPump" ? 335 : (cleanSkillId === "AirSlash" ? 365 : 315));
      // 冷凍光線 (IceBeam) 同步開啟自動轉向追蹤！
      const isHoming = (cleanSkillId === "ShadowBall" || cleanSkillId === "Psystrike" || cleanSkillId === "Moonblast" || cleanSkillId === "IceBeam");

      // 當敵人貼近至 75px 內時，自動收攏側向與前推偏移，避免子彈跨過貼身怪背後
      const lateralScale = isCloseQuarters ? 0.25 : 1.0;
      const lateralOffset = (slotBaseLat + ((isWingSkill || isTwinCannon)
        ? ((i % 2 === 0 ? 1 : -1) * 13)
        : (count > 1 ? (i - (count - 1) / 2) * 10 : 0))) * lateralScale;
      const forwardStagger = (isCloseQuarters ? 8 : slotBaseFwd) + i * (isCloseQuarters ? 5 : 10);

      const spawnX = caster.x + Math.cos(perpAng) * lateralOffset + Math.cos(ang) * forwardStagger;
      const spawnY = caster.y + Math.sin(perpAng) * lateralOffset + Math.sin(ang) * forwardStagger;

      const isBoomerang = (cleanSkillId === "AirSlash");
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
        radius: (cleanSkillId === "HydroPump" ? 22 : 16) * GameApp.player.areaMult * (level >= 8 ? 1.25 : 1.0),
        dmg: isBoomerang ? rawDmg * 0.72 : rawDmg,
        type: meta.type,
        skillId,
        vfx: meta.vfx || "star_shot",
        homing: isHoming,
        color: meta.color,
        pierce: isBoomerang ? (level >= 6 ? 6 : 4) : (level >= 6 ? 3 : 2),
        knockback: meta.knockback !== undefined ? meta.knockback : 0,
        life: isBoomerang ? 1.25 : 0.88,
        maxLife: isBoomerang ? 1.25 : 0.88,
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

    // 0. 奇異種子：兩側肩部外推 24px 伸出 ＋ 根粗尾尖錐形流線藤鞭 ＋ 末端半月形音爆斬痕
    if (style === "vine_whip") {
      const whipCount = 1 + (level >= 5 ? 1 : 0);
      const reach = (135 + level * 7) * areaScale;
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
      SoundFX.play("hit");
      return;
    }

    if (style === "martial_fist") {
      // 空手劈：剛猛「X 型白熾十字氣勁斬痕 + 拳風殘影」（取代空心黃圓圈）
      const reach = 90 * areaScale;
      const strikes = Math.min(3, 1 + Math.floor(level / 4));
      for (let s = 0; s < strikes; s++) {
        const fAng = baseAngle + (s - (strikes - 1) / 2) * 0.28;
        const fx = caster.x + Math.cos(fAng) * (34 + reach * 0.52);
        const fy = caster.y + Math.sin(fAng) * (34 + reach * 0.52);
        this.meleeEffects.push({
          style: "karate_cross",
          x: fx,
          y: fy,
          angle: fAng,
          radius: reach * 0.58,
          timer: 0.26,
          maxTime: 0.26,
          color: "#EF4444"
        });
        GameApp.enemies.forEach(e => {
          if (Math.hypot(e.x - fx, e.y - fy) <= reach * 0.62 + e.radius) {
            GameApp.dealDamageToEnemy(e, rawDmg * 1.25, meta.type, 0.30, kb * 1.35);
          }
        });
      }
      GameApp.spawnParticleCluster(caster.x + Math.cos(baseAngle) * 34, caster.y + Math.sin(baseAngle) * 34, "#FFFFFF", "#FACC15", 10, "star", 1.0);
      SoundFX.play("hit");
      return;
    }

    // 1. 撞擊專屬：主角身前 30px 淨空外推的「破空音爆氣錐 (Sonic Boom Cone)」
    if (style === "slam_wave") {
      const fDist = 34 * areaScale;
      const hitX = caster.x + Math.cos(baseAngle) * fDist;
      const hitY = caster.y + Math.sin(baseAngle) * fDist;
      const rad = 48 * areaScale;

      this.meleeEffects.push({
        style: "sonic_cone",
        ox: caster.x + Math.cos(baseAngle) * 26,
        oy: caster.y + Math.sin(baseAngle) * 26,
        x: hitX,
        y: hitY,
        angle: baseAngle,
        radius: rad,
        timer: 0.22,
        maxTime: 0.22,
        color: "#F8FAFC"
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
        casterRef: caster,
        x: caster.x,
        y: caster.y,
        radius: rad,
        dmg: rawDmg,
        type: meta.type,
        kb: kb,
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

    // 3. 龍之俯衝 (Dragon Rush)：釋放向前推進的多段蒼藍龍魂衝擊波 + 近身龍爪撕裂
    if (meta.type === "Dragon") {
      const dragonWaves = 1 + (level >= 6 ? 1 : 0);
      for (let d = 0; d < dragonWaves; d++) {
        const ang = baseAngle + (d - (dragonWaves - 1) / 2) * 0.28;
        this.groundHazards.push({
          kind: "dragon_wave",
          x: caster.x + Math.cos(ang) * 24,
          y: caster.y + Math.sin(ang) * 24,
          vx: Math.cos(ang) * 260,
          vy: Math.sin(ang) * 260,
          angle: ang,
          radius: 42 * areaScale,
          dmg: rawDmg * 0.55,
          type: "Dragon",
          timer: 0.65,
          maxTime: 0.65,
          tickTimer: 0.02,
          tickInterval: 0.16,
          color: "#4338CA"
        });
      }
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
    SoundFX.play("hit");
  },

  triggerUltimateSuperMove(meta, skSlot, ultDmgScale = 1.0) {
    const p = GameApp.player;
    // 究極超武改為微弱柔和震動，絕不干擾走位與視覺
    GameApp.camera.shakeTime = 0.15;
    GameApp.camera.shakeMagnitude = 3.0;
    SoundFX.play("ultimate");

    const ultDmg = (meta.baseDmg * 2.8 + p.baseAtk * 1.3) * p.dmgMult * ultDmgScale;

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
      // 【爆裂十字劈】：底層展開赤金武神鬥氣震波陣 ＋ 10 道帶殘影與音爆環的立體指節金紅重拳
      this.groundHazards.push({
        kind: "martial_aura_domain",
        x: p.x, y: p.y,
        radius: 195 * p.areaMult,
        dmg: ultDmg * 0.25,
        type: "Fighting",
        timer: 0.85, maxTime: 0.85,
        tickTimer: 0.12, tickInterval: 0.40,
        color: "#DC2626"
      });
      for (let i = 0; i < 10; i++) {
        const ang = (i * Math.PI * 2) / 10;
        this.projectiles.push({
          x: p.x + Math.cos(ang) * 26, y: p.y + Math.sin(ang) * 26,
          vx: Math.cos(ang) * 290, vy: Math.sin(ang) * 290,
          angle: ang, spinSpeed: (i % 2 === 0 ? 2.2 : -2.2),
          radius: 27, dmg: ultDmg * 0.65,
          type: "Fighting", skillId: "Karate Chop", vfx: "giant_fist",
          color: "#DC2626", pierce: 12, knockback: 18, life: 1.35, statusBonus: 0.4, hitSet: new Set(), trailTimer: 0
        });
      }
    } else if (meta.type === "Flying") {
      // 【暴風驟雨】：生成 3 道持續 3.5 秒游走追敵並將怪物扯入風眼的聚怪龍捲風
      for (let i = 0; i < 3; i++) {
        const ang = (i * Math.PI * 2) / 3;
        this.groundHazards.push({
          kind: "tornado",
          x: p.x + Math.cos(ang) * 95,
          y: p.y + Math.sin(ang) * 95,
          vx: Math.cos(ang) * 85,
          vy: Math.sin(ang) * 85,
          radius: 95 * p.areaMult,
          dmg: ultDmg * 0.24,
          type: "Flying",
          timer: 3.5, maxTime: 3.5,
          tickTimer: 0.1, tickInterval: 0.25,
          color: "#818CF8"
        });
      }
    } else if (meta.type === "Poison") {
      // 【劇毒沼澤】：展開持續 4.0 秒的 240px 沸騰劇毒領域，減速並雙倍毒傷高頻腐蝕
      this.groundHazards.push({
        kind: "toxic_swamp",
        x: p.x, y: p.y,
        followPlayer: true,
        radius: 230 * p.areaMult,
        dmg: ultDmg * 0.22,
        type: "Poison",
        timer: 4.0, maxTime: 4.0,
        tickTimer: 0.1, tickInterval: 0.35,
        color: "#9333EA"
      });
    } else if (meta.type === "Ice") {
      // 【絕對零度】：全場凍結 3 秒 + 0.9 秒後觸發二次「全屏冰晶碎裂」200% 破冰重擊
      GameApp.enemies.forEach(e => {
        if (Math.hypot(e.x - p.x, e.y - p.y) <= 380) {
          e.status = "Freeze";
          e.statusTimer = e.isBoss ? 1.8 : 3.2;
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
      // 【天龍流星雨】：在 1.8 秒內從高空連續砸下 10 顆龍系隕石轟炸怪群
      for (let m = 0; m < 10; m++) {
        const ang = Math.random() * Math.PI * 2;
        const dist = 40 + Math.random() * 210;
        const tx = p.x + Math.cos(ang) * dist;
        const ty = p.y + Math.sin(ang) * dist;
        this.groundHazards.push({
          kind: "meteor_strike",
          x: tx, y: ty,
          startX: tx + 140, startY: ty - 260,
          radius: 75 * p.areaMult,
          dmg: ultDmg * 0.48,
          type: "Dragon",
          delay: m * 0.16,
          timer: 0.45 + m * 0.16,
          maxTime: 0.45,
          color: "#4338CA"
        });
      }
    } else if (meta.type === "Ground") {
      // 【地裂斷層破】：持續 2.4 秒的米字型地底熔岩斷層，連續震擊 5 波 (對空有效)
      this.groundHazards.push({
        kind: "quake_fissure",
        x: p.x, y: p.y,
        radius: 220 * p.areaMult,
        dmg: ultDmg * 0.32,
        type: "Ground",
        timer: 2.4, maxTime: 2.4,
        tickTimer: 0.1, tickInterval: 0.45,
        color: "#D97706"
      });
    } else if (meta.type === "Ghost") {
      // 【耿鬼專屬超武・暗影死滅波】：底層「冥界巨大壞笑暗影陣（血紅雙眼＋弦月壞笑）」＋ 8 隻張嘴惡靈鬼影穿梭撕咬
      this.groundHazards.push({
        kind: "gengar_grin_domain",
        x: p.x, y: p.y,
        radius: 235 * p.areaMult,
        dmg: ultDmg * 0.28,
        type: "Ghost",
        timer: 2.4, maxTime: 2.4,
        tickTimer: 0.15, tickInterval: 0.42,
        color: "#A855F7"
      });
      for (let k = 0; k < 8; k++) {
        const ang = (k * Math.PI * 2) / 8;
        this.projectiles.push({
          x: p.x + Math.cos(ang) * 34,
          y: p.y + Math.sin(ang) * 34,
          vx: Math.cos(ang) * 330, vy: Math.sin(ang) * 330,
          angle: ang, radius: 22, dmg: ultDmg * 0.52,
          type: "Ghost", skillId: meta.id, vfx: "gengar_phantom",
          homing: true, color: "#A855F7",
          pierce: 8, knockback: 8, life: 1.85, statusBonus: 0.5, hitSet: new Set(), trailTimer: 0
        });
      }
    } else if (meta.id === "Moonblast") {
      // 【創世極光（月亮之力超武）】：皎潔滿月虛影 ＋ 粉金與青色交織寬幅極光天幕 ＋ 十字星屑洗禮
      this.groundHazards.push({
        kind: "genesis_aurora",
        x: p.x, y: p.y,
        radius: 255 * p.areaMult,
        dmg: ultDmg * 0.34,
        type: "Psychic",
        timer: 2.2, maxTime: 2.2,
        tickTimer: 0.14, tickInterval: 0.36,
        color: "#F472B6"
      });
    } else if (meta.type === "Psychic") {
      // 【精神強念領域】：引力黑洞牽引壓縮怪群 + 8 道同心念力波環
      this.groundHazards.push({
        kind: "psychic_blackhole",
        x: p.x, y: p.y,
        radius: 230 * p.areaMult,
        dmg: ultDmg * 0.28,
        type: "Psychic",
        timer: 2.5, maxTime: 2.5,
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

    // 釋放瞬間僅對貼身 115px 內敵人產生起手震退氣浪，遠處敵人由超武實體波前（藤蔓/水柱/電網/隕石）推進命中結算！
    GameApp.enemies.forEach(e => {
      if (Math.hypot(e.x - p.x, e.y - p.y) <= 115 + e.radius) {
        let adjustedDmg = ultDmg * 0.55;
        if (meta.type === "Ground" && (e.data.type1 === "Flying" || e.data.type2 === "Flying")) {
          adjustedDmg *= 7.5;
        }
        GameApp.dealDamageToEnemy(e, adjustedDmg, meta.type, 0.70, e.isBoss ? 0 : 28);
      }
    });

    if (meta.type === "Grass") {
      p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * 0.08));
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
        pr.angle = (pr.angle || 0) + dt * 16;
      }

      // 污泥炸彈拋物線：落地爆開並生成持續 3.2 秒的冒泡腐蝕毒沼
      if (pr.vfx === "sludge_lob") {
        pr.progress = (pr.progress || 0) + dt / pr.maxLife;
        const t = Math.min(1, pr.progress);
        pr.x = pr.startX + (pr.targetX - pr.startX) * t;
        pr.y = pr.startY + (pr.targetY - pr.startY) * t - Math.sin(t * Math.PI) * (pr.arcHeight || 58);
        pr.angle = (pr.angle || 0) + dt * 7;

        if (t >= 1) {
          const puddleR = 64 * GameApp.player.areaMult;
          for (let s = 0; s < 10; s++) {
            const a = Math.random() * Math.PI * 2;
            const spd = 25 + Math.random() * 55;
            this.spawnSubParticle(pr.targetX, pr.targetY, Math.cos(a) * spd, Math.sin(a) * spd, s % 2 === 0 ? "#9333EA" : "#4ADE80", 4.5, 0.42, "circle");
          }
          GameApp.enemies.forEach(e => {
            if (Math.hypot(e.x - pr.targetX, e.y - pr.targetY) <= puddleR + e.radius) {
              GameApp.dealDamageToEnemy(e, pr.dmg, "Poison", pr.statusBonus, 6);
            }
          });
          this.groundHazards.push({
            kind: "poison_puddle",
            x: pr.targetX,
            y: pr.targetY,
            radius: puddleR,
            dmg: pr.dmg * 0.38,
            type: "Poison",
            timer: 3.2,
            maxTime: 3.2,
            tickTimer: 0.35,
            tickInterval: 0.42,
            color: "#9333EA"
          });
          SoundFX.play("hit");
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
      for (let j = GameApp.enemies.length - 1; j >= 0; j--) {
        const e = GameApp.enemies[j];
        if (pr.hitSet.has(e)) continue;
        if (Math.hypot(e.x - pr.x, e.y - pr.y) <= tightRadius + e.radius * 0.9) {
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

      // 所見即所得波前推進判定 (Wavefront Active Hitframes)：藤鞭、地震與刀光伸展到哪裡，哪裡的怪才即時爆血！
      if (m.hitSet && m.dmg) {
        if (m.style === "vine_whip") {
          const curReach = m.reach * Math.min(1, prog * 1.7);
          const ox = m.ox !== undefined ? m.ox : m.x;
          const oy = m.oy !== undefined ? m.oy : m.y;
          GameApp.enemies.forEach(e => {
            if (m.hitSet.has(e)) return;
            const dx = e.x - ox, dy = e.y - oy;
            const dist = Math.hypot(dx, dy);
            if (dist <= curReach + e.radius * 0.85) {
              const eAng = Math.atan2(dy, dx);
              const diff = Math.abs(Math.atan2(Math.sin(eAng - m.angle), Math.cos(eAng - m.angle)));
              if (diff <= 0.58 || dist < 32) {
                m.hitSet.add(e);
                GameApp.dealDamageToEnemy(e, m.dmg, m.type, 0.30, m.kb || 10);
              }
            }
          });
        } else if (m.style === "quake_wave") {
          const curR = m.radius * (0.28 + prog * 0.72);
          GameApp.enemies.forEach(e => {
            if (m.hitSet.has(e)) return;
            if (Math.hypot(e.x - m.x, e.y - m.y) <= curR + e.radius * 0.85) {
              m.hitSet.add(e);
              GameApp.dealDamageToEnemy(e, m.dmg, m.type, 0.25, m.kb || 20);
            }
          });
        } else {
          const curR = m.radius * (0.28 + prog * 0.75);
          const ox = m.ox !== undefined ? m.ox : m.x;
          const oy = m.oy !== undefined ? m.oy : m.y;
          GameApp.enemies.forEach(e => {
            if (m.hitSet.has(e)) return;
            const dx = e.x - ox, dy = e.y - oy;
            const d = Math.hypot(dx, dy);
            if (d <= curR + e.radius * 0.85) {
              const eAng = Math.atan2(dy, dx);
              const diff = Math.abs(Math.atan2(Math.sin(eAng - m.angle), Math.cos(eAng - m.angle)));
              if (diff <= 0.90 || d < 36) {
                m.hitSet.add(e);
                GameApp.dealDamageToEnemy(e, m.dmg, m.type, 0.28, m.kb || 12);
              }
            }
          });
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
          // 隕石落地引爆：雙層蒼藍與金橙龍焰爆破環 + 飛散熔岩星屑
          this.meleeEffects.push({
            style: "slam_wave",
            x: hz.x, y: hz.y,
            radius: hz.radius * 1.08,
            timer: 0.36, maxTime: 0.36,
            color: "#F97316"
          });
          this.meleeEffects.push({
            style: "z_spark",
            x: hz.x, y: hz.y,
            radius: hz.radius * 0.55,
            timer: 0.26, maxTime: 0.26,
            color: "#38BDF8"
          });
          for (let k = 0; k < 14; k++) {
            const a = Math.random() * Math.PI * 2;
            const spd = 55 + Math.random() * 105;
            this.spawnSubParticle(hz.x, hz.y, Math.cos(a) * spd, Math.sin(a) * spd, k % 3 === 0 ? "#F97316" : (k % 2 === 0 ? "#38BDF8" : "#FDE047"), 4.0, 0.42, k % 2 === 0 ? "star" : "diamond");
          }
          GameApp.enemies.forEach(e => {
            if (Math.hypot(e.x - hz.x, e.y - hz.y) <= hz.radius + e.radius) {
              GameApp.dealDamageToEnemy(e, hz.dmg, "Dragon", 0.35, 16);
            }
          });
          SoundFX.play("hit");
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
        hz.rotAngle = (hz.rotAngle || 0) + dt * 3.2;
        // 潮旋激流：將靠近的怪物往外圍捲飛推開，保護水箭龜中央淨空風眼
        GameApp.enemies.forEach(e => {
          if (!e.isBoss) {
            const d = Math.hypot(e.x - hz.x, e.y - hz.y);
            if (d < hz.radius && d > 10) {
              const pushAng = Math.atan2(e.y - hz.y, e.x - hz.x);
              e.x += Math.cos(pushAng) * 85 * dt;
              e.y += Math.sin(pushAng) * 85 * dt;
            }
          }
        });
      } else if (hz.kind === "drifting_daimonji") {
        hz.x += (hz.vx || 0) * dt;
        hz.y += (hz.vy || 0) * dt;
        if (GameApp.player && Math.hypot(hz.x - hz.lastSpawnX, hz.y - hz.lastSpawnY) >= 44) {
          hz.lastSpawnX = hz.x;
          hz.lastSpawnY = hz.y;
          GameApp.lavaFootprints.push({ x: hz.x, y: hz.y, radius: 36, life: 2.4, maxLife: 2.4, tickTimer: 0.1 });
        }
      } else if (hz.kind === "thunder_pillars_storm") {
        (hz.strikePts || []).forEach(pt => {
          if (!pt.struck && (hz.maxTime - hz.timer) >= pt.delay) {
            pt.struck = true;
            this.spawnSubParticle(pt.x, pt.y, (Math.random() - 0.5) * 90, -50 - Math.random() * 60, "#FEF08A", 3.8, 0.35, "star");
          }
        });
      } else if (hz.kind === "moon_pillar") {
        const target = GameApp.findNearestEnemyInViewport(hz.x, hz.y, 380);
        if (target) {
          const desired = Math.atan2(target.y - hz.y, target.x - hz.x);
          hz.vx = Math.cos(desired) * 85;
          hz.vy = Math.sin(desired) * 85;
        }
        hz.x += (hz.vx || 0) * dt;
        hz.y += (hz.vy || 0) * dt;
      } else if (hz.kind === "tornado") {
        const target = GameApp.findNearestEnemyInViewport(hz.x, hz.y, 440);
        const curAng = Math.atan2(hz.vy || 0, hz.vx || 85);
        if (target) {
          const desired = Math.atan2(target.y - hz.y, target.x - hz.x);
          const diff = Math.atan2(Math.sin(desired - curAng), Math.cos(desired - curAng));
          const nextAng = curAng + Math.max(-4.5 * dt, Math.min(4.5 * dt, diff));
          hz.vx = Math.cos(nextAng) * 115;
          hz.vy = Math.sin(nextAng) * 115;
        } else {
          hz.vx = Math.cos(curAng) * 95;
          hz.vy = Math.sin(curAng) * 95;
        }
        hz.x += (hz.vx || 0) * dt;
        hz.y += (hz.vy || 0) * dt;
        // 龍捲風持續將周圍非 Boss 怪獸扯向風眼中心
        GameApp.enemies.forEach(e => {
          if (!e.isBoss) {
            const d = Math.hypot(hz.x - e.x, hz.y - e.y);
            if (d < hz.radius * 1.35 && d > 12) {
              const pullAng = Math.atan2(hz.y - e.y, hz.x - e.x);
              e.x += Math.cos(pullAng) * 95 * dt;
              e.y += Math.sin(pullAng) * 95 * dt;
            }
          }
        });
      } else if (hz.kind === "psychic_blackhole") {
        GameApp.enemies.forEach(e => {
          if (!e.isBoss) {
            const d = Math.hypot(hz.x - e.x, hz.y - e.y);
            if (d < hz.radius && d > 16) {
              const pullAng = Math.atan2(hz.y - e.y, hz.x - e.x);
              e.x += Math.cos(pullAng) * 75 * dt;
              e.y += Math.sin(pullAng) * 75 * dt;
            }
          }
        });
      } else if (hz.vx || hz.vy) {
        hz.x += (hz.vx || 0) * dt;
        hz.y += (hz.vy || 0) * dt;
      }

      hz.tickTimer -= dt;
      if (hz.tickTimer <= 0) {
        hz.tickTimer = hz.tickInterval || 0.4;

        if (hz.kind === "ice_shatter_domain") {
          // 絕對零度二段破冰巨爆
          for (let k = 0; k < 24; k++) {
            const a = Math.random() * Math.PI * 2;
            const spd = 60 + Math.random() * 140;
            this.spawnSubParticle(hz.x, hz.y, Math.cos(a) * spd, Math.sin(a) * spd, k % 2 === 0 ? "#67E8F9" : "#FFFFFF", 4.2, 0.45, "diamond");
          }
          GameApp.enemies.forEach(e => {
            if (Math.hypot(e.x - hz.x, e.y - hz.y) <= hz.radius + e.radius) {
              const shatterMult = (e.status === "Freeze") ? 1.65 : 1.0;
              GameApp.dealDamageToEnemy(e, hz.dmg * shatterMult, "Ice", 0.5, 14);
            }
          });
          SoundFX.play("ultimate");
        } else {
          GameApp.enemies.forEach(e => {
            if (Math.hypot(e.x - hz.x, e.y - hz.y) <= hz.radius + e.radius) {
              let dVal = hz.dmg;
              if (hz.kind === "quake_fissure" && (e.data.type1 === "Flying" || e.data.type2 === "Flying")) {
                dVal *= 7.5; // 飛石對空破局
              }
              GameApp.dealDamageToEnemy(e, dVal, hz.type, 0.35, hz.kind === "dragon_wave" ? 14 : 2);
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
      const prog = 1 - Math.max(0, hz.timer / hz.maxTime);
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
        const maxR = hz.radius * Math.min(1, prog * 2.4);
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

        const spin = -(hz.rotAngle || now * 3.2);

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
          const bProg = ((now * 1.4 + b * 0.19) % 1.0);
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
        const alpha = Math.min(1, hz.timer * 1.4);
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
          const h = 76 * (rn.heightScale || 1.0) * grow;
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
            const thick = Math.max(3.5, 11.5 * (1 - t0 * 0.55));

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
        const curR = hz.radius * Math.min(1, prog * 2.2);

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

        // 耿鬼標誌性「血紅邪魅雙眼 + 弦月露齒壞笑」地面投影圖騰
        ctx.save();
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
      } else if (hz.kind === "martial_aura_domain") {
        // 【爆裂十字劈・底層武神八卦氣浪陣】：赤金雙層震地氣環 ＋ 十字裂地氣勁
        ctx.translate(sx, sy);
        const alpha = Math.max(0, hz.timer / hz.maxTime);
        const curR = hz.radius * Math.min(1, prog * 2.2);
        ctx.globalAlpha = alpha;

        const mGrad = ctx.createRadialGradient(0, 0, 26, 0, 0, curR);
        mGrad.addColorStop(0, "rgba(220, 38, 38, 0.0)");
        mGrad.addColorStop(0.35, "rgba(220, 38, 38, 0.42)");
        mGrad.addColorStop(0.8, "rgba(250, 204, 21, 0.32)");
        mGrad.addColorStop(1, "rgba(250, 204, 21, 0.0)");
        ctx.fillStyle = mGrad;
        ctx.beginPath();
        ctx.arc(0, 0, curR, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "#FEF08A";
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(0, 0, curR * 0.86, 0, Math.PI * 2);
        ctx.stroke();

        // 八向武道破空震波線
        for (let k = 0; k < 8; k++) {
          const a = (k * Math.PI) / 4 + prog * 0.3;
          ctx.strokeStyle = k % 2 === 0 ? "#EF4444" : "#FACC15";
          ctx.lineWidth = 3.2;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * 32, Math.sin(a) * 32);
          ctx.lineTo(Math.cos(a) * curR, Math.sin(a) * curR);
          ctx.stroke();
        }
      } else if (hz.kind === "genesis_aurora") {
        // 【創世極光（月亮之力超武・底層）】：月華星河投影陣 ＋ 雙向交織波浪極光帶 ＋ 閃爍十字星芒
        ctx.translate(sx, sy);
        const alpha = Math.sin((1 - prog) * Math.PI) * 0.90;
        const curR = hz.radius * Math.min(1, prog * 2.0);

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
        // 【地裂斷層破（超武・3 層地殼熔岩崩裂）】：內圈塌陷熔岩坑 ＋ 10 道分叉樹狀深淵裂谷 ＋ 破土雙色切面巨岩尖柱
        ctx.translate(sx, sy);
        const alpha = Math.min(1, hz.timer * 1.25);
        ctx.globalAlpha = alpha;
        const curR = hz.radius * Math.min(1, prog * 2.2);

        // 1. 內圈 55% 震央塌陷熔岩坑漸層底盤
        const craterGrad = ctx.createRadialGradient(0, 0, 26, 0, 0, curR * 0.65);
        craterGrad.addColorStop(0, "rgba(69, 26, 3, 0.0)");
        craterGrad.addColorStop(0.35, "rgba(69, 26, 3, 0.62)");
        craterGrad.addColorStop(0.75, "rgba(217, 119, 6, 0.35)");
        craterGrad.addColorStop(1, "rgba(120, 53, 15, 0.0)");
        ctx.fillStyle = craterGrad;
        ctx.beginPath();
        ctx.arc(0, 0, curR * 0.65, 0, Math.PI * 2);
        ctx.fill();

        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        // 2. 10 道主斷層裂谷 + 左右分叉次級裂紋 (Sub-cracks)
        const branchCount = 10;
        for (let k = 0; k < branchCount; k++) {
          const a = (k * Math.PI * 2) / branchCount + (k % 2 === 0 ? 0.07 : -0.07);
          const len = curR * (0.85 + (k % 3) * 0.08);
          const p1x = Math.cos(a) * 28, p1y = Math.sin(a) * 28;
          const p2x = Math.cos(a + 0.13) * (len * 0.45), p2y = Math.sin(a + 0.13) * (len * 0.45);
          const p3x = Math.cos(a - 0.08) * (len * 0.76), p3y = Math.sin(a - 0.08) * (len * 0.76);
          const p4x = Math.cos(a) * len, p4y = Math.sin(a) * len;

          const drawFissurePath = () => {
            ctx.beginPath();
            ctx.moveTo(p1x, p1y);
            ctx.lineTo(p2x, p2y);
            ctx.lineTo(p3x, p3y);
            ctx.lineTo(p4x, p4y);
            // 分叉支線
            const subAng = a + (k % 2 === 0 ? 0.48 : -0.48);
            ctx.moveTo(p2x, p2y);
            ctx.lineTo(p2x + Math.cos(subAng) * (len * 0.28), p2y + Math.sin(subAng) * (len * 0.28));
          };

          // 深淵暗溝底色 (13px)
          ctx.strokeStyle = "#291509";
          ctx.lineWidth = 13;
          drawFissurePath();
          ctx.stroke();

          // 中層熔岩熾橘紅 (5.5px)
          ctx.strokeStyle = "#EA580C";
          ctx.lineWidth = 5.5;
          drawFissurePath();
          ctx.stroke();

          // 核心地脈金白高光 (2px)
          ctx.strokeStyle = "#FEF08A";
          ctx.lineWidth = 2.0;
          drawFissurePath();
          ctx.stroke();

          // 3. 沿斷層破土刺出的雙色立體斜切面巨岩尖柱 (Jagged 3D Rock Spires)
          const spireX = (k % 2 === 0) ? p3x : p2x;
          const spireY = (k % 2 === 0) ? p3y : p2y;
          const spireH = (24 + (k % 3) * 7) * Math.min(1, prog * 3.0) + Math.abs(Math.sin(now * 4 + k)) * 6;

          ctx.save();
          ctx.translate(spireX, spireY);
          // 右暗面 (#78350F)
          ctx.fillStyle = "#78350F";
          ctx.strokeStyle = "#1C0D06";
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(0, -spireH);
          ctx.lineTo(12, 4);
          ctx.lineTo(0, 9);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // 左受光亮面 (#D97706)
          ctx.fillStyle = "#D97706";
          ctx.beginPath();
          ctx.moveTo(0, -spireH);
          ctx.lineTo(-12, 4);
          ctx.lineTo(0, 9);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // 岩尖熔岩金邊
          ctx.strokeStyle = "#FDE047";
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(-7, 1); ctx.lineTo(0, -spireH * 0.55); ctx.lineTo(7, 1);
          ctx.stroke();
          ctx.restore();
        }
      } else if (hz.kind === "ice_shatter_domain") {
        // 【絕對零度（融合 V10 急凍鳥雙向極光幔帳 ＋ 內6外8雙排立體折射冰稜矩陣）】
        ctx.translate(sx, sy);
        const r = hz.radius * Math.min(1, prog * 1.55);
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
        const curR = hz.radius * Math.min(1, prog * 1.8);
        const spin = -now * 1.6;

        // 1. 次元暗物質漸層底盤（保留中央 34px 淨空）
        const grad = ctx.createRadialGradient(0, 0, 32, 0, 0, curR);
        grad.addColorStop(0, "rgba(15, 23, 42, 0.0)");
        grad.addColorStop(0.25, "rgba(59, 7, 100, 0.62)");
        grad.addColorStop(0.68, "rgba(192, 132, 252, 0.38)");
        grad.addColorStop(1, "rgba(244, 114, 182, 0.0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, curR, 0, Math.PI * 2);
        ctx.fill();

        // 2. 雙層空間重力坍縮幾何陣
        ctx.strokeStyle = "rgba(244, 114, 182, 0.78)";
        ctx.lineWidth = 3.0;
        ctx.beginPath();
        ctx.arc(0, 0, curR * 0.86, 0, Math.PI * 2);
        ctx.stroke();

        // 3. 8 向旋轉次元切割激光射線 + 終端四芒星爆點 (外推 34px 起點，不擋主角)
        for (let b = 0; b < 8; b++) {
          const a = spin * 0.65 + (b * Math.PI) / 4;
          const sx0 = Math.cos(a) * 34, sy0 = Math.sin(a) * 34;
          const ex = Math.cos(a) * (curR * 0.94), ey = Math.sin(a) * (curR * 0.94);

          ctx.strokeStyle = "rgba(192, 132, 252, 0.55)";
          ctx.lineWidth = 7.0;
          ctx.beginPath();
          ctx.moveTo(sx0, sy0); ctx.lineTo(ex, ey);
          ctx.stroke();

          ctx.strokeStyle = "#FFFFFF";
          ctx.lineWidth = 2.4;
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
      } else if (hz.kind === "psy_delayed_blast") {
        // 精神擊破終點內縮引力波環（貼地層）
        ctx.translate(sx, sy);
        const shrink = Math.max(0.15, 1 - prog);
        ctx.strokeStyle = "#EC4899";
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.arc(0, 0, hz.radius * shrink, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = "#FBCFE8";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(0, 0, hz.radius * shrink * 0.6, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    });

    // 地面層近戰特效：地震（V10 雙圈塌陷震央 ＋ 分叉樹狀深淵裂谷 ＋ 雙色切面跳動崩岩）
    this.meleeEffects.forEach(m => {
      if (m.style !== "quake_wave") return;
      const prog = 1 - (m.timer / m.maxTime);
      const msx = toSx(m.x), msy = toSy(m.y);
      const curR = m.radius * (0.28 + prog * 0.72);
      const innerR = curR * 0.56;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - prog * 0.72);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // 1. 內圈 56% 核心重擊陷坑陰影底盤
      const coreGrad = ctx.createRadialGradient(msx, msy, 18, msx, msy, innerR);
      coreGrad.addColorStop(0, "rgba(69, 26, 3, 0.0)");
      coreGrad.addColorStop(0.5, "rgba(120, 53, 15, 0.36)");
      coreGrad.addColorStop(1, "rgba(69, 26, 3, 0.0)");
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(msx, msy, innerR, 0, Math.PI * 2);
      ctx.fill();

      // 2. 外擴雙層震盪斷層環
      ctx.strokeStyle = "rgba(217, 119, 6, 0.72)";
      ctx.lineWidth = 4.2 * (1 - prog * 0.5);
      ctx.beginPath();
      ctx.arc(msx, msy, curR, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = "rgba(254, 240, 138, 0.55)";
      ctx.lineWidth = 2.0 * (1 - prog * 0.5);
      ctx.beginPath();
      ctx.arc(msx, msy, innerR, 0, Math.PI * 2);
      ctx.stroke();

      // 3. 8 道分叉樹狀深坑裂隙 (11px 深底 + 4px 金光 + 1.6px 白亮核心 + 分叉支線)
      for (let crack = 0; crack < 8; crack++) {
        const cAng = (crack * Math.PI * 2) / 8 + (crack % 2 === 0 ? 0.09 : -0.09);
        const startR = 24;
        const midR = Math.max(startR + 6, curR * 0.54);
        const mx = msx + Math.cos(cAng + 0.14) * midR;
        const my = msy + Math.sin(cAng + 0.14) * midR;
        const ex = msx + Math.cos(cAng) * curR;
        const ey = msy + Math.sin(cAng) * curR;
        const subAng = cAng + (crack % 2 === 0 ? 0.45 : -0.45);
        const sx2 = mx + Math.cos(subAng) * (curR * 0.26);
        const sy2 = my + Math.sin(subAng) * (curR * 0.26);

        const traceCrack = () => {
          ctx.beginPath();
          ctx.moveTo(msx + Math.cos(cAng) * startR, msy + Math.sin(cAng) * startR);
          ctx.lineTo(mx, my);
          ctx.lineTo(ex, ey);
          ctx.moveTo(mx, my);
          ctx.lineTo(sx2, sy2);
        };

        ctx.strokeStyle = "#3E1602";
        ctx.lineWidth = 11 * (1 - prog * 0.42);
        traceCrack();
        ctx.stroke();

        ctx.strokeStyle = "#D97706";
        ctx.lineWidth = 4.0 * (1 - prog * 0.42);
        traceCrack();
        ctx.stroke();

        ctx.strokeStyle = "#FEF08A";
        ctx.lineWidth = 1.6;
        traceCrack();
        ctx.stroke();

        // 4. 沿裂縫向上跳起的雙色立體斜切面岩石稜塊
        const hop = Math.sin(prog * Math.PI) * 18;
        ctx.save();
        ctx.translate(mx, my - hop);
        ctx.fillStyle = "#78350F";
        ctx.strokeStyle = "#291509";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(0, -10); ctx.lineTo(8, 2); ctx.lineTo(0, 6);
        ctx.closePath();
        ctx.fill(); ctx.stroke();

        ctx.fillStyle = "#F59E0B";
        ctx.beginPath();
        ctx.moveTo(0, -10); ctx.lineTo(-8, 2); ctx.lineTo(0, 6);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.restore();
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
      const prog = 1 - Math.max(0, hz.timer / hz.maxTime);
      ctx.save();

      if (hz.kind === "moon_pillar") {
        const alpha = Math.sin((1 - prog) * Math.PI) * 0.85;
        ctx.fillStyle = `rgba(131, 24, 67, ${alpha * 0.45})`;
        ctx.strokeStyle = `rgba(244, 114, 182, ${alpha})`;
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.ellipse(sx, sy, hz.radius, hz.radius * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        const grad = ctx.createLinearGradient(sx, sy, sx, sy - 200);
        grad.addColorStop(0, `rgba(244, 114, 182, ${alpha * 0.75})`);
        grad.addColorStop(0.5, `rgba(253, 224, 71, ${alpha * 0.55})`);
        grad.addColorStop(1, "rgba(255, 255, 255, 0)");
        ctx.fillStyle = grad;
        ctx.fillRect(sx - hz.radius * 0.65, sy - 200, hz.radius * 1.3, 200);

        ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.7})`;
        ctx.fillRect(sx - hz.radius * 0.25, sy - 200, hz.radius * 0.5, 200);
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
          const rot = now * (6.8 - t * 1.5) + levelIdx * 1.15;
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
      } else if (hz.kind === "dragon_wave") {
        // 【龍之俯衝（普攻）・蒼藍威猛龍首氣旋】：張開雙顎的立體蒼藍龍首輪廓 ＋ 金色龍睛 ＋ 螺旋逆鱗氣浪
        ctx.translate(sx, sy);
        ctx.rotate(hz.angle || 0);
        ctx.globalAlpha = Math.max(0, hz.timer / hz.maxTime);
        const r = hz.radius;

        // 1. 身後三道螺旋擴散的蒼藍與金紫龍魂殘影
        [-22, -11].forEach((tx, idx) => {
          ctx.strokeStyle = idx === 0 ? "rgba(67, 56, 202, 0.50)" : "rgba(56, 189, 248, 0.75)";
          ctx.lineWidth = 5.0 - idx;
          ctx.beginPath();
          ctx.arc(tx, 0, r * (0.72 + idx * 0.14), -0.88, 0.88);
          ctx.stroke();
        });

        // 2. 威猛龍首主體輪廓（前突龍吻 + 上下龍角/逆鱗翼）
        ctx.fillStyle = "#1E1B4B";
        ctx.strokeStyle = "#38BDF8";
        ctx.lineWidth = 3.0;
        ctx.beginPath();
        ctx.moveTo(r * 1.18, 0); // 龍吻前端
        ctx.lineTo(r * 0.45, -r * 0.48); // 上顎
        ctx.lineTo(-r * 0.35, -r * 0.92); // 左上龍角尖
        ctx.lineTo(-r * 0.05, -r * 0.32);
        ctx.lineTo(-r * 0.55, 0); // 龍頸內凹
        ctx.lineTo(-r * 0.05, r * 0.32);
        ctx.lineTo(-r * 0.35, r * 0.92); // 左下龍角尖
        ctx.lineTo(r * 0.45, r * 0.48); // 下顎
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 3. 龍首內部亮藍能量脈絡與雙側發光黃金龍睛
        ctx.fillStyle = "#4338CA";
        ctx.beginPath();
        ctx.moveTo(r * 0.95, 0);
        ctx.lineTo(r * 0.25, -r * 0.32);
        ctx.lineTo(-r * 0.22, 0);
        ctx.lineTo(r * 0.25, r * 0.32);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "#FACC15";
        ctx.beginPath();
        ctx.ellipse(r * 0.36, -r * 0.22, 4.5, 2.2, -0.3, 0, Math.PI * 2);
        ctx.ellipse(r * 0.36, r * 0.22, 4.5, 2.2, 0.3, 0, Math.PI * 2);
        ctx.fill();

        // 4. 龍吻前端破空純白氣刃
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.arc(r * 0.12, 0, r * 0.96, -0.78, 0.78);
        ctx.stroke();

      } else if (hz.kind === "meteor_strike") {
        // 【天龍流星雨（超武）・3層立體次元裂隙龍焰隕石】：高空星雲次元裂縫 ＋ 蒼藍龍魂盤旋隕石 ＋ 雙色龍焰引力圈
        const startSx = toSx(hz.startX), startSy = toSy(hz.startY);
        const curX = toSx(hz.startX + (hz.x - hz.startX) * prog);
        const curY = toSy(hz.startY + (hz.y - hz.startY) * prog);

        // 1. 底層：地面龍焰目標引力陣與向內收縮鎖定環
        const tGrad = ctx.createRadialGradient(sx, sy, 6, sx, sy, hz.radius);
        tGrad.addColorStop(0, "rgba(249, 115, 22, 0.35)");
        tGrad.addColorStop(0.6, "rgba(67, 56, 202, 0.28)");
        tGrad.addColorStop(1, "rgba(30, 27, 75, 0.0)");
        ctx.fillStyle = tGrad;
        ctx.beginPath();
        ctx.ellipse(sx, sy, hz.radius, hz.radius * 0.56, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "#818CF8";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.ellipse(sx, sy, hz.radius, hz.radius * 0.56, 0, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = "#FDE047";
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.ellipse(sx, sy, hz.radius * prog, hz.radius * 0.56 * prog, 0, 0, Math.PI * 2);
        ctx.stroke();

        // 2. 高空層：頭頂撕開的「紫金星雲次元裂隙雲洞 (Dimensional Rift Cloud)」
        ctx.save();
        ctx.translate(startSx, startSy);
        ctx.rotate(-0.35);
        ctx.fillStyle = "#0F172A";
        ctx.strokeStyle = "#C084FC";
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.ellipse(0, 0, 34, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        const riftGlow = ctx.createRadialGradient(0, 0, 2, 0, 0, 24);
        riftGlow.addColorStop(0, "#FFFFFF");
        riftGlow.addColorStop(0.5, "#F59E0B");
        riftGlow.addColorStop(1, "rgba(168, 85, 247, 0)");
        ctx.fillStyle = riftGlow;
        ctx.beginPath();
        ctx.ellipse(0, 0, 24, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // 3. 中層：高速墜落的立體稜角龍焰隕石 + 螺旋盤旋蒼藍龍魂尾焰
        ctx.save();
        ctx.translate(curX, curY);
        const mAng = Math.atan2(hz.y - hz.startY, hz.x - hz.startX);
        ctx.rotate(mAng);

        // 外層蒼藍龍魂長尾
        ctx.fillStyle = "rgba(67, 56, 202, 0.85)";
        ctx.beginPath();
        ctx.moveTo(16, 0); ctx.lineTo(-56, -18); ctx.lineTo(-38, 0); ctx.lineTo(-56, 18);
        ctx.closePath();
        ctx.fill();

        // 中層熾橘紅烈焰尾羽
        ctx.fillStyle = "#F97316";
        ctx.beginPath();
        ctx.moveTo(14, 0); ctx.lineTo(-36, -11); ctx.lineTo(-22, 0); ctx.lineTo(-36, 11);
        ctx.closePath();
        ctx.fill();

        // 螺旋纏繞隕石的亮青白龍氣絲帶
        ctx.strokeStyle = "#38BDF8";
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        for (let x = -45; x <= 10; x += 7) {
          const y = Math.sin(x * 0.18 + now * 16) * 12;
          if (x === -45) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // 不規則多邊形立體熔岩隕石核
        ctx.fillStyle = "#1E1B4B";
        ctx.strokeStyle = "#F59E0B";
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(16, 0);
        ctx.lineTo(8, -13);
        ctx.lineTo(-9, -15);
        ctx.lineTo(-16, -4);
        ctx.lineTo(-12, 12);
        ctx.lineTo(6, 14);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 隕石內部熔岩金白裂紋核心
        ctx.fillStyle = "#FEF08A";
        ctx.beginPath();
        ctx.arc(4, -2, 6.5, 0, Math.PI * 2);
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
      } else if (hz.kind === "drifting_daimonji") {
        // 【噴火龍超武・立體大字爆炎】：由密集翻滾動態火球簇構成『大』字圖騰，筆畫末端帶烈焰尖角
        ctx.translate(sx, sy);
        ctx.rotate(hz.angle || 0);
        ctx.globalAlpha = Math.min(1, hz.timer * 1.3);
        const r = hz.radius * 0.85;

        // 定義『大』字五筆畫的關鍵節點路徑
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
      const prog = 1 - (m.timer / m.maxTime);
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
        // 【撞擊（Tackle）・3層動態推進音爆衝擊】：推進位移氣錐 ＋ 4道破風速度線 ＋ 雙層高壓新月波與音爆雲環
        const osx = toSx(m.ox !== undefined ? m.ox : m.x);
        const osy = toSy(m.oy !== undefined ? m.oy : m.y);
        const curR = m.radius * (0.42 + prog * 0.68);
        const thrustX = prog * 18;
        ctx.save();
        ctx.translate(osx, osy);
        ctx.rotate(m.angle || 0);

        // 1. 底層：4 條銳利破風速度線 (Speed Streaks)
        ctx.strokeStyle = "rgba(226, 232, 240, 0.75)";
        ctx.lineWidth = 2.0;
        [-0.45, -0.18, 0.18, 0.45].forEach((yRatio, idx) => {
          const syLine = curR * yRatio;
          const sxStart = thrustX - 8 + (idx % 2) * 6;
          ctx.beginPath();
          ctx.moveTo(sxStart, syLine);
          ctx.lineTo(sxStart + curR * 0.55, syLine);
          ctx.stroke();
        });

        // 2. 中層：後段壓縮橢圓音爆雲環 (Sonic Boom Ring)
        ctx.strokeStyle = "#E2E8F0";
        ctx.lineWidth = 3.4 * (1 - prog * 0.45);
        ctx.beginPath();
        ctx.ellipse(thrustX + curR * 0.28, 0, curR * 0.22, curR * 0.68, 0, 0, Math.PI * 2);
        ctx.stroke();

        // 3. 頂層：前方厚實雙層新月破空激波（銀藍底邊 + 純白熾亮前鋒）
        ctx.fillStyle = "rgba(148, 163, 184, 0.45)";
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 3.0;
        ctx.beginPath();
        ctx.arc(thrustX + curR * 0.25, 0, curR * 0.78, -0.88, 0.88);
        ctx.arc(thrustX + curR * 0.05, 0, curR * 0.62, 0.88, -0.88, true);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 撞擊頂點十字爆裂高光星
        if (prog > 0.25) {
          const tipX = thrustX + curR * 1.02;
          ctx.fillStyle = "#FFFFFF";
          ctx.beginPath();
          ctx.moveTo(tipX, -9); ctx.lineTo(tipX + 2.5, -2.5);
          ctx.lineTo(tipX + 9, 0); ctx.lineTo(tipX + 2.5, 2.5);
          ctx.lineTo(tipX, 9); ctx.lineTo(tipX - 2.5, 2.5);
          ctx.lineTo(tipX - 9, 0); ctx.lineTo(tipX - 2.5, -2.5);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      } else if (m.style === "giga_impact_lance") {
        // 【終極衝擊（Giga Impact 超武）・黃金螺旋鑽頭風暴】：地面高壓氣浪軌跡 ＋ 5節高速旋轉黃金螺旋鑽頭巨錐 ＋ 3圈連環破空音爆雲
        const osx = toSx(m.ox !== undefined ? m.ox : m.x);
        const osy = toSy(m.oy !== undefined ? m.oy : m.y);
        const curLen = m.radius * Math.min(1, prog * 1.55);
        const maxW = 44 * (1 - prog * 0.25);
        ctx.save();
        ctx.translate(osx, osy);
        ctx.rotate(m.angle || 0);

        // 1. 底層：兩側撕裂空氣的高壓金白流線刮痕
        ctx.strokeStyle = "rgba(250, 204, 21, 0.55)";
        ctx.lineWidth = 3.2;
        [-1, 1].forEach(side => {
          ctx.beginPath();
          ctx.moveTo(10, side * maxW * 0.75);
          ctx.lineTo(curLen * 0.85, side * maxW * 0.25);
          ctx.stroke();
        });

        // 2. 中層：黃金螺旋鑽頭巨錐主體（外層赤金 ➔ 中層耀金 ➔ 中心純白激光核）
        const drillGrad = ctx.createLinearGradient(0, 0, curLen, 0);
        drillGrad.addColorStop(0, "rgba(217, 119, 6, 0.15)");
        drillGrad.addColorStop(0.45, "rgba(250, 204, 21, 0.72)");
        drillGrad.addColorStop(1, "rgba(255, 255, 255, 0.95)");
        ctx.fillStyle = drillGrad;
        ctx.beginPath();
        ctx.moveTo(curLen * 1.08, 0);
        ctx.lineTo(curLen * 0.12, -maxW);
        ctx.lineTo(curLen * 0.28, 0);
        ctx.lineTo(curLen * 0.12, maxW);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = "#FEF08A";
        ctx.lineWidth = 2.8;
        ctx.stroke();

        // 鑽頭表面高速旋轉的 5 節螺旋紋 (Helix Drill Threads)
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 2.6;
        for (let seg = 1; seg <= 5; seg++) {
          const t = seg / 6;
          const sxSeg = curLen * (0.2 + t * 0.78);
          const wSeg = maxW * (1 - t * 0.85);
          const phaseOffset = Math.sin(now * 18 + seg * 1.3) * (wSeg * 0.35);
          ctx.beginPath();
          ctx.moveTo(sxSeg - 10, -wSeg + phaseOffset);
          ctx.lineTo(sxSeg + 10, wSeg + phaseOffset);
          ctx.stroke();
        }

        // 3. 頂層：身後連環炸開的 3 圈純白立體音爆雲環 (Mach Cone Rings)
        [0.28, 0.52, 0.76].forEach((rPos, idx) => {
          const rx = curLen * rPos;
          const ry = maxW * (1.15 - idx * 0.22);
          ctx.strokeStyle = idx === 2 ? "#FFFFFF" : "#FEF08A";
          ctx.lineWidth = 3.5 - idx * 0.6;
          ctx.beginPath();
          ctx.ellipse(rx, 0, ry * 0.32, ry, 0, 0, Math.PI * 2);
          ctx.stroke();
        });
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
      const prog = 1 - (u.timer / u.maxTime);
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
          const rad = (k % 2 === 0) ? r * (0.98 + Math.sin(now * 12 + k) * 0.14) : r * 0.72;
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
          const y = Math.sin(x * 0.25 + now * 12) * 4.5;
          if (x === -r * 1.8) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        ctx.strokeStyle = "#E0F2FE";
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        for (let x = -r * 1.8; x <= r * 0.6; x += 6) {
          const y = -Math.sin(x * 0.25 + now * 12) * 4.5;
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
        // 【飛葉快刀（Razor Leaf）】：高速自轉雙色立體鋒利葉片 ＋ 中央亮綠葉脈 ＋ 破空青綠殘影弧線
        const spinAng = (pr.angle || 0) + now * 14;
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
