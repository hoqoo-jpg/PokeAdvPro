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
      const pool = ["Flamethrower", "Hydro Pump", "Seed Bomb", "Thunderbolt", "Shadow Ball", "Psystrike", "Ice Beam", "Moonblast", "Dragon Rush"];
      const pick = pool[Math.floor(Math.random() * pool.length)];
      this.fireSkill(caster, pick, level, isEvolved, dmgScale * 1.15, slotIdx);
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

    // 2D. 精神擊破 (Psystrike)：高頻雙段貫穿念力光束 (首段瞬間穿透 + 0.25秒後路徑念力內爆)
    if (cleanSkillId === "Psystrike") {
      const beamCount = Math.min(3, count);
      const beamLen = (270 + level * 8) * GameApp.player.areaMult;
      for (let i = 0; i < beamCount; i++) {
        const ang = baseAngle + (beamCount > 1 ? (i - (beamCount - 1) / 2) * 0.22 : 0);
        const endX = caster.x + Math.cos(ang) * beamLen;
        const endY = caster.y + Math.sin(ang) * beamLen;
        this.createLightningArc(caster.x, caster.y, endX, endY, "#EC4899");
        // 首段貫穿傷害
        GameApp.enemies.forEach(e => {
          const dx = endX - caster.x, dy = endY - caster.y;
          const t = Math.max(0, Math.min(1, ((e.x - caster.x) * dx + (e.y - caster.y) * dy) / (beamLen * beamLen)));
          const nx = caster.x + t * dx, ny = caster.y + t * dy;
          if (Math.hypot(e.x - nx, e.y - ny) <= 24 * GameApp.player.areaMult + e.radius) {
            GameApp.dealDamageToEnemy(e, rawDmg * 0.75, "Psychic", 0.25, 4);
          }
        });
        // 路徑終點埋設 0.25 秒後引爆的二段念力震爆圈
        const blastX = caster.x + Math.cos(ang) * (beamLen * 0.72);
        const blastY = caster.y + Math.sin(ang) * (beamLen * 0.72);
        this.groundHazards.push({
          kind: "psy_delayed_blast",
          x: blastX, y: blastY,
          radius: (52 + level * 2) * GameApp.player.areaMult,
          dmg: rawDmg * 0.70,
          type: "Psychic",
          timer: 0.26, maxTime: 0.26,
          tickTimer: 0.25, tickInterval: 99,
          color: "#EC4899"
        });
      }
      SoundFX.play("hit");
      return;
    }

    // 2E. 噴射火焰 (Flamethrower)：扇形多段連湧烈焰吐息 (每次觸發連噴 2 波擴張火浪)
    if (cleanSkillId === "Flamethrower") {
      const waveStreams = Math.min(4, count);
      for (let w = 0; w < 2; w++) {
        for (let i = 0; i < waveStreams; i++) {
          const spread = (waveStreams > 1 ? (i - (waveStreams - 1) / 2) * 0.18 : 0) + (w === 1 ? (Math.random() - 0.5) * 0.12 : 0);
          const ang = baseAngle + spread;
          const spd = 285 + w * 45;
          this.projectiles.push({
            x: caster.x + Math.cos(ang) * (14 + w * 18),
            y: caster.y + Math.sin(ang) * (14 + w * 18),
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd,
            angle: ang,
            radius: (15 + w * 4) * GameApp.player.areaMult * (level >= 8 ? 1.25 : 1.0),
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

    // 3. 業界標準槽位空間解耦 (Slot-based Muzzle Offsets)：4 個招式槽各自擁有專屬身周發射錨點 (正胸、左翼-18px、右翼+18px、頭頂-22px)
    const perpAng = baseAngle + Math.PI / 2;
    const slotLateralMap = [0, -18, 18, 0];
    const slotForwardMap = [12, -4, -4, 18];
    const slotBaseLat = slotLateralMap[slotIdx % 4] || 0;
    const slotBaseFwd = slotForwardMap[slotIdx % 4] || 0;
    const isWingSkill = ["AirSlash", "RazorLeaf", "IceBeam"].includes(cleanSkillId);

    for (let i = 0; i < count; i++) {
      const spread = count > 1 ? (i - (count - 1) / 2) * 0.17 : (cleanSkillId === "Ember" ? (Math.random() - 0.5) * 0.14 : 0);
      const ang = baseAngle + spread;
      const spd = (cleanSkillId === "WaterGun" || cleanSkillId === "Ember") ? 345 : (cleanSkillId === "HydroPump" ? 330 : (cleanSkillId === "AirSlash" ? 365 : 310));
      const isHoming = (cleanSkillId === "ShadowBall" || cleanSkillId === "Psystrike" || cleanSkillId === "Moonblast");

      const lateralOffset = slotBaseLat + (isWingSkill
        ? ((i % 2 === 0 ? 1 : -1) * 14)
        : (count > 1 ? (i - (count - 1) / 2) * 10 : 0));
      const forwardStagger = slotBaseFwd + i * 11;

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

    // 0. 妙蛙種子：沙盒 V10 正弦波倒刺 S 藤鞭 (Vine Whip)
    if (style === "vine_whip") {
      const whipCount = 1 + (level >= 5 ? 1 : 0);
      const reach = (130 + level * 7) * areaScale;
      for (let w = 0; w < whipCount; w++) {
        const spread = (w - (whipCount - 1) / 2) * 0.32;
        const ang = baseAngle + spread;
        this.meleeEffects.push({
          style: "vine_whip",
          casterRef: caster,
          ox: caster.x,
          oy: caster.y,
          x: caster.x,
          y: caster.y,
          angle: ang,
          reach: reach,
          dmg: rawDmg * 1.15,
          type: meta.type,
          kb: kb * 1.2,
          hitSet: new Set(),
          timer: 0.38,
          maxTime: 0.38,
          color: "#15803D"
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
      // 【V10 三段階梯神罰萬雷 + 閃電鳥六芒高壓電網】
      for (let i = 0; i < 8; i++) {
        const ang = (i * Math.PI * 2) / 8;
        this.createLightningArc(p.x, p.y, p.x + Math.cos(ang) * 120, p.y + Math.sin(ang) * 120, "#FEF08A");
      }
      const hitPts = [];
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI * 2) / 6;
        hitPts.push({ x: p.x + Math.cos(a) * 230, y: p.y + Math.sin(a) * 230 });
      }
      this.groundHazards.push({
        kind: "zapdos_storm_web",
        x: p.x, y: p.y,
        hitPts: hitPts,
        stage2Triggered: false,
        radius: 250 * p.areaMult,
        dmg: ultDmg * 0.36,
        type: "Electric",
        timer: 1.45, maxTime: 1.45,
        tickTimer: 0.18, tickInterval: 0.30,
        color: "#FACC15"
      });
    } else if (meta.type === "Fire") {
      // 【V10 推進式巨型立體大字爆炎 + 沿途定距鋪設熔岩火海】
      for (let d = 0; d < 4; d++) {
        const ang = (d * Math.PI) / 2 + (p.facingX >= 0 ? 0 : 0.4);
        this.groundHazards.push({
          kind: "drifting_daimonji",
          x: p.x, y: p.y,
          lastSpawnX: p.x, lastSpawnY: p.y,
          vx: Math.cos(ang) * 240, vy: Math.sin(ang) * 240,
          angle: ang,
          radius: 76 * p.areaMult,
          dmg: ultDmg * 0.42,
          type: "Fire",
          timer: 1.25, maxTime: 1.25,
          tickTimer: 0.08, tickInterval: 0.25,
          color: "#EF4444"
        });
      }
    } else if (meta.type === "Water") {
      // 【V10 八方正弦高壓水柱大迴旋 + 王冠浪花】
      this.groundHazards.push({
        kind: "eight_hydro_pillars",
        x: p.x, y: p.y,
        followPlayer: true,
        rotAngle: 0,
        pillarsCount: 8,
        radius: 310 * p.areaMult,
        width: 44 * p.areaMult,
        dmg: ultDmg * 0.32,
        type: "Water",
        timer: 1.45, maxTime: 1.45,
        tickTimer: 0.05, tickInterval: 0.22,
        color: "#38BDF8"
      });
    } else if (meta.type === "Grass") {
      // 【V10 森羅瘋狂植物：12 根巨型帶刺 S 藤蔓破土鞭笞全場】
      for (let i = 0; i < 12; i++) {
        const ang = (i * Math.PI * 2) / 12 + (i % 2 === 0 ? 0.06 : -0.06);
        this.meleeEffects.push({
          style: "vine_whip",
          casterRef: p,
          ox: p.x, oy: p.y, x: p.x, y: p.y,
          angle: ang,
          reach: (265 + (i % 3) * 25) * p.areaMult,
          dmg: ultDmg * 0.55,
          type: "Grass",
          kb: 18,
          hitSet: new Set(),
          timer: 0.68 + (i % 2) * 0.16,
          maxTime: 0.68 + (i % 2) * 0.16,
          color: "#15803D"
        });
      }
      for (let g = 0; g < 28; g++) {
        const gAng = Math.random() * Math.PI * 2;
        const gSpd = 60 + Math.random() * 150;
        this.spawnSubParticle(p.x, p.y, Math.cos(gAng) * gSpd, Math.sin(gAng) * gSpd, g % 2 === 0 ? "#22C55E" : "#86EFAC", 4.2, 0.85, "leaf");
      }
    } else if (meta.type === "Normal") {
      // 【V10 居合極限瞬斬 / 終極衝擊：3 道 160° 超寬幅雙層次元刀浪】
      for (let i = 0; i < 3; i++) {
        const ang = (i * Math.PI * 2) / 3;
        this.meleeEffects.push({
          style: "claw_slash",
          casterRef: p,
          ox: p.x, oy: p.y, x: p.x, y: p.y,
          angle: ang,
          radius: 250 * p.areaMult,
          dmg: ultDmg * 0.65,
          type: "Normal",
          kb: 24,
          hitSet: new Set(),
          timer: 0.48 + i * 0.08,
          maxTime: 0.48 + i * 0.08,
          color: "#38BDF8"
        });
      }
    } else if (meta.type === "Fighting") {
      // 【爆裂十字劈】：向四周發射 10 道螺旋擴張的武道巨型金拳 (重啟 giant_fist 特效)
      for (let i = 0; i < 10; i++) {
        const ang = (i * Math.PI * 2) / 10;
        this.projectiles.push({
          x: p.x, y: p.y,
          vx: Math.cos(ang) * 280, vy: Math.sin(ang) * 280,
          angle: ang, spinSpeed: (i % 2 === 0 ? 2.4 : -2.4),
          radius: 26, dmg: ultDmg * 0.65,
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
    } else if (meta.type === "Psychic" || meta.type === "Ghost") {
      // 【精神強念領域 / 暗影死滅波】：引力黑洞牽引壓縮怪群 + 8 道穿梭鬼影彈
      this.groundHazards.push({
        kind: "psychic_blackhole",
        x: p.x, y: p.y,
        radius: 230 * p.areaMult,
        dmg: ultDmg * 0.28,
        type: meta.type,
        timer: 2.5, maxTime: 2.5,
        tickTimer: 0.15, tickInterval: 0.45,
        color: meta.color || "#EC4899"
      });
      for (let k = 0; k < 8; k++) {
        const ang = (k * Math.PI * 2) / 8;
        this.projectiles.push({
          x: p.x, y: p.y,
          vx: Math.cos(ang) * 320, vy: Math.sin(ang) * 320,
          angle: ang, radius: 20, dmg: ultDmg * 0.50,
          type: meta.type, skillId: meta.id, vfx: "shadow_orb",
          homing: true, color: meta.color || "#A855F7",
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
        } else if (pr.vfx === "seed_cluster") {
          this.spawnSubParticle(pr.x, pr.y, (Math.random() - 0.5) * 15, (Math.random() - 0.5) * 15, "#4ADE80", 2.8, 0.28, "leaf");
        } else if (pr.vfx === "frost_beam") {
          this.spawnSubParticle(pr.x, pr.y, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, "#E0F2FE", 2.5, 0.25, "diamond");
        } else if (pr.vfx === "shadow_orb" || pr.vfx === "sludge_ball") {
          this.spawnSubParticle(pr.x, pr.y, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, pr.color || "#C084FC", 3.0, 0.30, "circle");
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
          // 隕石落地引爆
          this.meleeEffects.push({
            style: "slam_wave",
            x: hz.x, y: hz.y,
            radius: hz.radius,
            timer: 0.32, maxTime: 0.32,
            color: "#4338CA"
          });
          for (let k = 0; k < 10; k++) {
            const a = Math.random() * Math.PI * 2;
            const spd = 45 + Math.random() * 85;
            this.spawnSubParticle(hz.x, hz.y, Math.cos(a) * spd, Math.sin(a) * spd, k % 2 === 0 ? "#818CF8" : "#FDE047", 3.8, 0.38, "star");
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
      if (hz.kind === "eight_hydro_pillars") {
        hz.rotAngle = (hz.rotAngle || 0) + dt * 2.4;
      } else if (hz.kind === "drifting_daimonji") {
        hz.x += (hz.vx || 0) * dt;
        hz.y += (hz.vy || 0) * dt;
        if (GameApp.player && Math.hypot(hz.x - hz.lastSpawnX, hz.y - hz.lastSpawnY) >= 42) {
          hz.lastSpawnX = hz.x;
          hz.lastSpawnY = hz.y;
          GameApp.lavaFootprints.push({ x: hz.x, y: hz.y, radius: 34, life: 2.2, maxLife: 2.2, tickTimer: 0.1 });
        }
      } else if (hz.kind === "zapdos_storm_web" && !hz.stage2Triggered && hz.timer <= 1.22) {
        hz.stage2Triggered = true;
        (hz.hitPts || []).forEach(pt => {
          this.createLightningArc(pt.x, pt.y - 260, pt.x, pt.y, "#FFFFFF");
          this.createLightningArc(pt.x, pt.y - 260, pt.x, pt.y, "#FACC15");
        });
        SoundFX.play("ultimate");
      } else if (hz.kind === "tornado") {
        const target = GameApp.findNearestEnemyInViewport(hz.x, hz.y, 420);
        if (target) {
          const desired = Math.atan2(target.y - hz.y, target.x - hz.x);
          hz.vx = hz.vx * 0.90 + Math.cos(desired) * 115 * 0.10;
          hz.vy = hz.vy * 0.90 + Math.sin(desired) * 115 * 0.10;
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

  render(ctx, toSx, toSy) {
    const now = performance.now() * 0.004;

    // 1. 繪製持續性領域、立體毒沼、月光聖柱、GBA錐形龍捲風、V10三層深坑斷層、雙排冰稜極光陣與黑洞 (groundHazards)
    this.groundHazards.forEach(hz => {
      if (hz.kind === "meteor_strike" && hz.delay > 0) return;
      const sx = toSx(hz.x), sy = toSy(hz.y);
      const prog = 1 - Math.max(0, hz.timer / hz.maxTime);
      ctx.save();

      if (hz.kind === "poison_puddle" || hz.kind === "toxic_swamp") {
        // 外實內透三明治結構：深紫黑外框襯底 ➔ 半透明紫泥 ➔ 螢光綠腐蝕內圈 ➔ 帶高光立體毒泡
        const alpha = Math.min(1, hz.timer * 1.2);
        const rx = hz.radius;
        const ry = hz.radius * 0.62;

        ctx.fillStyle = `rgba(59, 7, 100, ${alpha * 0.55})`;
        ctx.strokeStyle = `rgba(88, 28, 135, ${alpha * 0.9})`;
        ctx.lineWidth = 4.0;
        ctx.beginPath();
        ctx.ellipse(sx, sy, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = `rgba(74, 222, 128, ${alpha * 0.85})`;
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.ellipse(sx, sy, rx * 0.88, ry * 0.88, 0, 0, Math.PI * 2);
        ctx.stroke();

        for (let b = 0; b < 6; b++) {
          const bAng = now * 1.2 + (b * Math.PI * 2) / 6;
          const distR = 0.35 + ((b % 3) * 0.2);
          const bx = sx + Math.cos(bAng) * (rx * distR);
          const by = sy + Math.sin(bAng) * (ry * distR);
          const br = Math.max(2.2, 4.5 + Math.sin(now * 3.5 + b) * 2.2);

          ctx.fillStyle = `rgba(34, 197, 94, ${alpha * 0.85})`;
          ctx.strokeStyle = `rgba(20, 83, 45, ${alpha * 0.95})`;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.arc(bx, by, br, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // 氣泡左上角純白反光點 (GBA 像素高光)
          ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
          ctx.beginPath();
          ctx.arc(bx - br * 0.3, by - br * 0.3, br * 0.32, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (hz.kind === "moon_pillar") {
        const alpha = Math.sin((1 - prog) * Math.PI) * 0.85;
        // 底部立體雙環折射陣
        ctx.fillStyle = `rgba(131, 24, 67, ${alpha * 0.45})`;
        ctx.strokeStyle = `rgba(244, 114, 182, ${alpha})`;
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.ellipse(sx, sy, hz.radius, hz.radius * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // 光柱外層粉紫邊與內核明黃白光束
        const grad = ctx.createLinearGradient(sx, sy, sx, sy - 200);
        grad.addColorStop(0, `rgba(244, 114, 182, ${alpha * 0.75})`);
        grad.addColorStop(0.5, `rgba(253, 224, 71, ${alpha * 0.55})`);
        grad.addColorStop(1, "rgba(255, 255, 255, 0)");
        ctx.fillStyle = grad;
        ctx.fillRect(sx - hz.radius * 0.65, sy - 200, hz.radius * 1.3, 200);

        ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.7})`;
        ctx.fillRect(sx - hz.radius * 0.25, sy - 200, hz.radius * 0.5, 200);

        ctx.strokeStyle = `rgba(254, 240, 138, ${alpha})`;
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.ellipse(sx, sy, hz.radius * 0.7, hz.radius * 0.38, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (hz.kind === "tornado") {
        // 參考 IMG_5056 頂部錐形立體龍捲風：由下往上由窄變寬的 6 層錐形螺旋風環 + 深灰藍描邊襯底
        ctx.translate(sx, sy);
        ctx.globalAlpha = Math.min(1, hz.timer * 1.2);
        // 地面吸扯風眼暗影
        ctx.fillStyle = "rgba(15, 23, 42, 0.45)";
        ctx.beginPath();
        ctx.ellipse(0, 6, hz.radius * 0.85, hz.radius * 0.42, 0, 0, Math.PI * 2);
        ctx.fill();

        for (let ring = 0; ring < 6; ring++) {
          const rY = -ring * 13;
          const rRadX = (hz.radius * 0.22) + ring * 11;
          const rRadY = rRadX * 0.45;
          const swayX = Math.sin(now * 5 + ring * 0.8) * 5;
          ctx.save();
          ctx.translate(swayX, rY);
          // 底層深色描邊
          ctx.strokeStyle = "#334155";
          ctx.lineWidth = 6.5;
          ctx.beginPath();
          ctx.ellipse(0, 0, rRadX, rRadY, 0, 0, Math.PI * 2);
          ctx.stroke();
          // 中層青白高速旋轉風帶
          ctx.rotate(now * 6 + ring * 1.1);
          ctx.strokeStyle = ring % 2 === 0 ? "#CBD5E1" : "#38BDF8";
          ctx.lineWidth = 3.8;
          ctx.beginPath();
          ctx.arc(0, 0, rRadX, 0, Math.PI * 1.45);
          ctx.stroke();
          // 頂層純白高光風刃
          ctx.strokeStyle = "#FFFFFF";
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.arc(0, 0, rRadX * 0.92, 0.2, Math.PI * 0.9);
          ctx.stroke();
          ctx.restore();
        }
      } else if (hz.kind === "dragon_wave") {
        // V10 三層次元新月龍魂破：深靛藍暗底 ➔ 電光青中層 ➔ 純白激光刃口 + 雙重殘影弧
        ctx.translate(sx, sy);
        ctx.rotate(hz.angle || 0);
        ctx.globalAlpha = Math.max(0, hz.timer / hz.maxTime);

        [-16, -8].forEach((tx, idx) => {
          ctx.strokeStyle = idx === 0 ? "rgba(67, 56, 202, 0.45)" : "rgba(56, 189, 248, 0.65)";
          ctx.lineWidth = 4.5;
          ctx.beginPath();
          ctx.arc(tx, 0, hz.radius * (0.75 + idx * 0.12), -0.85, 0.85);
          ctx.stroke();
        });

        ctx.fillStyle = "#1E1B4B";
        ctx.strokeStyle = "#4338CA";
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(0, 0, hz.radius, -0.95, 0.95);
        ctx.arc(0, 0, hz.radius * 0.45, 0.95, -0.95, true);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.arc(2, 0, hz.radius, -0.88, 0.88);
        ctx.stroke();
      } else if (hz.kind === "meteor_strike") {
        const curX = toSx(hz.startX + (hz.x - hz.startX) * prog);
        const curY = toSy(hz.startY + (hz.y - hz.startY) * prog);
        // 地面立體雙環靶心預警
        ctx.fillStyle = "rgba(67, 56, 202, 0.22)";
        ctx.strokeStyle = "#818CF8";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.ellipse(sx, sy, hz.radius, hz.radius * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = "#FDE047";
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.ellipse(sx, sy, hz.radius * prog, hz.radius * 0.55 * prog, 0, 0, Math.PI * 2);
        ctx.stroke();

        // 下墜立體隕石 + 雙色長尾烈焰 (參考 IMG_5056 隕石序列)
        ctx.save();
        ctx.translate(curX, curY);
        const mAng = Math.atan2(hz.y - hz.startY, hz.x - hz.startX);
        ctx.rotate(mAng);
        ctx.fillStyle = "#4338CA";
        ctx.beginPath();
        ctx.moveTo(14, 0); ctx.lineTo(-42, -14); ctx.lineTo(-28, 0); ctx.lineTo(-42, 14);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "#F97316";
        ctx.beginPath();
        ctx.moveTo(12, 0); ctx.lineTo(-26, -9); ctx.lineTo(-16, 0); ctx.lineTo(-26, 9);
        ctx.closePath();
        ctx.fill();

        // 三切面立體隕石核心
        ctx.fillStyle = "#312E81";
        ctx.strokeStyle = "#1E1B4B";
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#FEF08A";
        ctx.beginPath();
        ctx.arc(4, -3, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (hz.kind === "quake_fissure") {
        // V10 三層立體深坑裂隙 (12px 深褐暗溝 + 4.5px 地脈金光 + 1.8px 白熾斷層)
        ctx.translate(sx, sy);
        ctx.globalAlpha = Math.min(1, hz.timer * 1.2);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        for (let k = 0; k < 8; k++) {
          const a = (k * Math.PI * 2) / 8 + (k % 2 === 0 ? 0.08 : -0.08);
          const midLen = hz.radius * 0.52;
          const mx = Math.cos(a + 0.14) * midLen;
          const my = Math.sin(a + 0.14) * midLen;
          const ex = Math.cos(a) * hz.radius;
          const ey = Math.sin(a) * hz.radius;

          ctx.strokeStyle = "#451A03";
          ctx.lineWidth = 12;
          ctx.beginPath();
          ctx.moveTo(0, 0); ctx.lineTo(mx, my); ctx.lineTo(ex, ey);
          ctx.stroke();

          ctx.strokeStyle = "#D97706";
          ctx.lineWidth = 4.5;
          ctx.beginPath();
          ctx.moveTo(0, 0); ctx.lineTo(mx, my); ctx.lineTo(ex, ey);
          ctx.stroke();

          ctx.strokeStyle = "#FEF08A";
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.moveTo(0, 0); ctx.lineTo(mx, my); ctx.lineTo(ex, ey);
          ctx.stroke();
        }
      } else if (hz.kind === "ice_shatter_domain") {
        // V10 雙排交錯立體冰稜矩陣 (內6順時針、外8逆時針) + IMG_5056 雙向流動極光幔帳
        ctx.translate(sx, sy);
        const r = hz.radius * Math.min(1, prog * 1.5);
        const spin = now * 1.2;

        // 極光交錯幔帳底襯
        const grad1 = ctx.createLinearGradient(-r, -r * 0.5, r, r * 0.5);
        grad1.addColorStop(0, "rgba(56, 189, 248, 0.28)");
        grad1.addColorStop(0.5, "rgba(52, 211, 153, 0.22)");
        grad1.addColorStop(1, "rgba(192, 132, 252, 0.28)");
        ctx.fillStyle = grad1;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "#E0F2FE";
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // 內排 6 枚順時針立體雙色切面冰稜
        for (let k = 0; k < 6; k++) {
          const a = spin * 1.5 + (k * Math.PI) / 3;
          const px = Math.cos(a) * (r * 0.45);
          const py = Math.sin(a) * (r * 0.45);
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(a);
          ctx.fillStyle = "#0284C7";
          ctx.strokeStyle = "#FFFFFF";
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.moveTo(0, -12); ctx.lineTo(9, 0); ctx.lineTo(0, 12); ctx.lineTo(-9, 0);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }

        // 外排 8 枚逆時針立體雙色切面大冰塊 (參考 IMG_5056 冰岩切面)
        for (let k = 0; k < 8; k++) {
          const a = -spin + (k * Math.PI) / 4 + 0.39;
          const px = Math.cos(a) * (r * 0.82);
          const py = Math.sin(a) * (r * 0.82);
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(-a);
          ctx.fillStyle = "#38BDF8";
          ctx.strokeStyle = "#0369A1";
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.moveTo(0, -16); ctx.lineTo(12, -4); ctx.lineTo(8, 14); ctx.lineTo(-8, 14); ctx.lineTo(-12, -4);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          // 左半亮白折射切面
          ctx.fillStyle = "#E0F2FE";
          ctx.beginPath();
          ctx.moveTo(0, -14); ctx.lineTo(-10, -3); ctx.lineTo(-6, 12); ctx.lineTo(0, 12);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      } else if (hz.kind === "psychic_blackhole") {
        // V10 二段式漸進放大黑洞：外圍厚積盤 + 逆時針旋轉吸扯臂 + 純黑奇點核心 + GBA 雙色鬼火環繞
        ctx.translate(sx, sy);
        const curR = hz.radius * (0.45 + 0.55 * Math.sin((1 - prog) * Math.PI));
        const grad = ctx.createRadialGradient(0, 0, curR * 0.25, 0, 0, curR);
        grad.addColorStop(0, "rgba(2, 6, 23, 0.92)");
        grad.addColorStop(0.55, "rgba(126, 34, 206, 0.45)");
        grad.addColorStop(1, "rgba(192, 132, 252, 0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, curR, 0, Math.PI * 2);
        ctx.fill();

        const spin = -now * 2.2;
        ctx.strokeStyle = "#C084FC";
        ctx.lineWidth = 3.5;
        for (let a = 0; a < 4; a++) {
          ctx.beginPath();
          ctx.arc(0, 0, curR * (0.45 + a * 0.12), spin + a * 1.57, spin + a * 1.57 + 1.15);
          ctx.stroke();
        }

        // 純黑奇點核心
        ctx.fillStyle = "#020617";
        ctx.strokeStyle = "#F472B6";
        ctx.lineWidth = 3.0;
        ctx.beginPath();
        ctx.arc(0, 0, 26, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (hz.kind === "eight_hydro_pillars") {
        // V10 八方正弦高壓水柱大迴旋 + 王冠浪花 (開啟 lighter 呈現通透水光)
        ctx.translate(sx, sy);
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = Math.min(1, hz.timer * 1.3);
        const pLen = hz.radius * Math.min(1, prog * 2.2);
        const pW = hz.width || 42;
        for (let pi = 0; pi < 8; pi++) {
          ctx.save();
          ctx.rotate((hz.rotAngle || 0) + (pi * Math.PI * 2) / 8);
          ctx.fillStyle = "rgba(2, 132, 199, 0.55)";
          ctx.beginPath();
          ctx.moveTo(12, -pW * 0.45);
          for (let x = 12; x <= pLen; x += 18) {
            const wv = Math.sin(now * 6 + x * 0.08) * 4;
            ctx.lineTo(x, -pW * 0.45 + wv);
          }
          for (let x = pLen; x >= 12; x -= 18) {
            const wv = Math.sin(now * 6 + x * 0.08) * 4;
            ctx.lineTo(x, pW * 0.45 + wv);
          }
          ctx.closePath();
          ctx.fill();

          ctx.strokeStyle = "#E0F2FE";
          ctx.lineWidth = 3.8;
          ctx.beginPath();
          ctx.moveTo(12, 0); ctx.lineTo(pLen * 0.96, 0);
          ctx.stroke();

          ctx.fillStyle = "#FFFFFF";
          ctx.beginPath();
          ctx.arc(pLen, 0, pW * 0.55, -Math.PI / 2, Math.PI / 2);
          ctx.fill();
          ctx.restore();
        }
      } else if (hz.kind === "zapdos_storm_web") {
        // V10 閃電鳥六芒星高頻跳動分形電網
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = Math.min(1, hz.timer);
        const pts = hz.hitPts || [];
        for (let idx = 0; idx < pts.length; idx++) {
          const p1 = pts[idx];
          const p2 = pts[(idx + 1) % pts.length];
          const x1 = toSx(p1.x), y1 = toSy(p1.y);
          const x2 = toSx(p2.x), y2 = toSy(p2.y);
          const mx = (x1 + x2) * 0.5 + (Math.random() - 0.5) * 22;
          const my = (y1 + y2) * 0.5 + (Math.random() - 0.5) * 22;

          ctx.strokeStyle = "#FACC15";
          ctx.lineWidth = 4.8;
          ctx.beginPath();
          ctx.moveTo(sx, sy); ctx.lineTo((sx + x1) * 0.5 + (Math.random() - 0.5) * 18, (sy + y1) * 0.5 + (Math.random() - 0.5) * 18); ctx.lineTo(x1, y1);
          ctx.moveTo(x1, y1); ctx.lineTo(mx, my); ctx.lineTo(x2, y2);
          ctx.stroke();

          ctx.strokeStyle = "#FFFFFF";
          ctx.lineWidth = 2.0;
          ctx.stroke();

          ctx.fillStyle = "#FEF08A";
          ctx.beginPath();
          ctx.arc(x1, y1, 8, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (hz.kind === "drifting_daimonji") {
        // V10 推進式立體大字爆炎
        ctx.translate(sx, sy);
        ctx.rotate(hz.angle || 0);
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = Math.min(1, hz.timer);
        const r = hz.radius * 0.85;
        const drawD = () => {
          ctx.beginPath();
          ctx.moveTo(-r * 0.7, -r * 0.2); ctx.lineTo(r * 0.7, -r * 0.2);
          ctx.moveTo(0, -r * 0.8); ctx.quadraticCurveTo(-r * 0.1, r * 0.1, -r * 0.7, r * 0.7);
          ctx.moveTo(0, -r * 0.2); ctx.quadraticCurveTo(r * 0.2, r * 0.2, r * 0.7, r * 0.7);
        };
        ctx.lineCap = "round";
        ctx.strokeStyle = "#DC2626"; ctx.lineWidth = 16; drawD(); ctx.stroke();
        ctx.strokeStyle = "#F97316"; ctx.lineWidth = 9;  drawD(); ctx.stroke();
        ctx.strokeStyle = "#FEF08A"; ctx.lineWidth = 3.5; drawD(); ctx.stroke();
      } else {
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = Math.max(0, 1 - prog);
        ctx.strokeStyle = hz.color || "#EC4899";
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(sx, sy, hz.radius * (0.4 + prog * 0.6), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    });

    // 2. 繪製近戰刀光、S藤鞭、V10立體地震裂隙 (meleeEffects)
    this.meleeEffects.forEach(m => {
      const prog = 1 - (m.timer / m.maxTime);
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - prog * 0.72);

      if (m.style === "vine_whip") {
        const osx = toSx(m.ox !== undefined ? m.ox : m.x);
        const osy = toSy(m.oy !== undefined ? m.oy : m.y);
        ctx.save();
        ctx.translate(osx, osy);
        ctx.rotate(m.angle || 0);

        const reach = m.reach * Math.min(1, prog * 1.7);
        const thickness = 7.5;
        const waveFreq = 2.4;
        const waveAmp = (1 - prog * 0.45) * 22;

        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        // 底層深綠硬邊襯底
        ctx.strokeStyle = "#052E16";
        ctx.lineWidth = thickness + 4.5;
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

        // 內層亮嫩綠高光脊線
        ctx.strokeStyle = "#BBF7D0";
        ctx.lineWidth = 2.0;
        ctx.stroke();

        for (let step = 25; step < reach - 16; step += 22) {
          const t = step / reach;
          const y = Math.sin(t * Math.PI * waveFreq) * waveAmp * Math.sin(t * Math.PI);
          const side = (step % 44 === 0) ? 1 : -1;

          ctx.fillStyle = "#14532D";
          ctx.beginPath();
          ctx.moveTo(step, y);
          ctx.lineTo(step + 5, y + side * (thickness + 6));
          ctx.lineTo(step - 3, y + side * (thickness + 1.5));
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = "#86EFAC";
          ctx.beginPath();
          ctx.arc(step, y + side * (thickness * 0.55), 2.2, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.strokeStyle = "#86EFAC";
        ctx.lineWidth = 3.0;
        ctx.beginPath();
        ctx.arc(reach, 0, 15 * prog, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(reach, 0, 8 * prog, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
      } else if (m.style === "slam_wave") {
        const msx = toSx(m.x), msy = toSy(m.y);
        const curR = m.radius * (0.35 + prog * 0.65);
        ctx.save();
        ctx.translate(msx, msy);
        ctx.rotate(m.angle || 0);

        if (m.ox !== undefined) {
          // 撞擊身前俐落雙層氣浪
          ctx.strokeStyle = "rgba(15, 23, 42, 0.55)";
          ctx.lineWidth = 5.0 * (1 - prog * 0.5);
          ctx.beginPath();
          ctx.arc(0, 0, curR, -0.68, 0.68);
          ctx.stroke();

          ctx.strokeStyle = "#F8FAFC";
          ctx.lineWidth = 2.5 * (1 - prog * 0.5);
          ctx.beginPath();
          ctx.arc(0, 0, curR, -0.65, 0.65);
          ctx.stroke();
        } else {
          // 範圍震爆環（空手劈拳印、種子炸彈爆圈等）
          ctx.strokeStyle = "#0F172A";
          ctx.lineWidth = 5.5 * (1 - prog * 0.5);
          ctx.beginPath();
          ctx.arc(0, 0, curR, 0, Math.PI * 2);
          ctx.stroke();

          ctx.strokeStyle = m.color || "#FACC15";
          ctx.lineWidth = 3.2 * (1 - prog * 0.5);
          ctx.beginPath();
          ctx.arc(0, 0, curR, 0, Math.PI * 2);
          ctx.stroke();

          ctx.strokeStyle = "#FFFFFF";
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.arc(0, 0, curR * 0.82, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      } else if (m.style === "quake_wave") {
        // V10 立體雙層深坑裂隙 (11px 深褐暗溝 + 4px 地脈金光 + 1.6px 白芯)
        const msx = toSx(m.x), msy = toSy(m.y);
        const curR = m.radius * (0.28 + prog * 0.72);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        ctx.fillStyle = "rgba(69, 26, 3, 0.25)";
        ctx.beginPath();
        ctx.arc(msx, msy, curR * 0.65, 0, Math.PI * 2);
        ctx.fill();

        for (let crack = 0; crack < 8; crack++) {
          const cAng = (crack * Math.PI * 2) / 8 + (crack % 2 === 0 ? 0.09 : -0.09);
          const midR = curR * 0.55;
          const mx = msx + Math.cos(cAng + 0.12) * midR;
          const my = msy + Math.sin(cAng + 0.12) * midR;
          const ex = msx + Math.cos(cAng) * curR;
          const ey = msy + Math.sin(cAng) * curR;

          ctx.strokeStyle = "#451A03";
          ctx.lineWidth = 10 * (1 - prog * 0.45);
          ctx.beginPath();
          ctx.moveTo(msx, msy); ctx.lineTo(mx, my); ctx.lineTo(ex, ey);
          ctx.stroke();

          ctx.strokeStyle = "#D97706";
          ctx.lineWidth = 3.8 * (1 - prog * 0.45);
          ctx.beginPath();
          ctx.moveTo(msx, msy); ctx.lineTo(mx, my); ctx.lineTo(ex, ey);
          ctx.stroke();

          ctx.strokeStyle = "#FEF08A";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(msx, msy); ctx.lineTo(mx, my); ctx.lineTo(ex, ey);
          ctx.stroke();
        }
      } else {
        // V10 居合/龍爪三層立體刀芒 + 後方延遲漸隱殘影弧線
        const osx = toSx(m.ox !== undefined ? m.ox : m.x);
        const osy = toSy(m.oy !== undefined ? m.oy : m.y);
        const curR = m.radius * (0.28 + prog * 0.75);
        ctx.translate(osx, osy);
        ctx.rotate(m.angle || 0);

        [-0.22, -0.11].forEach((off, idx) => {
          ctx.strokeStyle = idx === 0 ? "rgba(30, 58, 138, 0.45)" : "rgba(56, 189, 248, 0.65)";
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.arc(0, 0, curR * (0.72 + idx * 0.12), -0.75, 0.75);
          ctx.stroke();
        });

        ctx.fillStyle = "#1E1B4B";
        ctx.strokeStyle = m.color || "#4338CA";
        ctx.lineWidth = 4.5;
        ctx.beginPath();
        ctx.arc(0, 0, curR, -0.9, 0.9);
        ctx.arc(0, 0, curR * 0.42, 0.9, -0.9, true);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.arc(0, 0, curR, -0.82, 0.82);
        ctx.stroke();
      }
      ctx.restore();
    });

    // 3. 繪製全屏超武主圖騰 (開啟 lighter 加色發光，兼具高對比與霓虹通透度)
    this.ultimateVfxList.forEach(u => {
      const prog = 1 - (u.timer / u.maxTime);
      const usx = toSx(u.x), usy = toSy(u.y);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";

      if (u.type === "Fire") {
        // V10 立體三層大字爆炎 (深紅黑底框 18px ➔ 鮮紅橙中層 10px ➔ 明黃白芯 4px)
        ctx.translate(usx, usy);
        const curR = u.radius * (0.4 + prog * 0.65);
        ctx.globalAlpha = Math.max(0, 1 - prog * 0.75);

        ctx.strokeStyle = "#7F1D1D";
        ctx.lineWidth = 10 * (1 - prog * 0.5);
        ctx.beginPath(); ctx.arc(0, 0, curR, 0, Math.PI * 2); ctx.stroke();

        ctx.strokeStyle = "#F97316";
        ctx.lineWidth = 5 * (1 - prog * 0.5);
        ctx.beginPath(); ctx.arc(0, 0, curR, 0, Math.PI * 2); ctx.stroke();

        const sz = 68 * (1 + prog * 0.45);
        const drawDaimonji = () => {
          ctx.beginPath();
          ctx.moveTo(-sz * 0.75, -sz * 0.18); ctx.lineTo(sz * 0.75, -sz * 0.18);
          ctx.moveTo(0, -sz * 0.82); ctx.quadraticCurveTo(-sz * 0.1, sz * 0.12, -sz * 0.75, sz * 0.75);
          ctx.moveTo(0, -sz * 0.18); ctx.quadraticCurveTo(sz * 0.22, sz * 0.22, sz * 0.75, sz * 0.75);
        };
        ctx.lineCap = "round";
        ctx.strokeStyle = "#7F1D1D"; ctx.lineWidth = 18 * (1 - prog * 0.4); drawDaimonji(); ctx.stroke();
        ctx.strokeStyle = "#EF4444"; ctx.lineWidth = 11 * (1 - prog * 0.4); drawDaimonji(); ctx.stroke();
        ctx.strokeStyle = "#FEF08A"; ctx.lineWidth = 4.2 * (1 - prog * 0.4); drawDaimonji(); ctx.stroke();

      } else if (u.type === "Water") {
        ctx.translate(usx, usy);
        ctx.globalAlpha = Math.max(0, 1 - prog * 0.75);
        ctx.rotate(-prog * 4.5);

        for (let arm = 0; arm < 4; arm++) {
          const aAng = (arm * Math.PI * 2) / 4;
          ctx.strokeStyle = "#0369A1";
          ctx.lineWidth = 9 * (1 - prog * 0.45);
          ctx.beginPath();
          ctx.arc(0, 0, 70 + prog * 130, aAng, aAng + 1.25);
          ctx.stroke();

          ctx.strokeStyle = arm % 2 === 0 ? "#38BDF8" : "#E0F2FE";
          ctx.lineWidth = 4.5 * (1 - prog * 0.45);
          ctx.beginPath();
          ctx.arc(0, 0, 70 + prog * 130, aAng, aAng + 1.2);
          ctx.stroke();
        }
      } else if (u.type === "Grass") {
        ctx.translate(usx, usy);
        ctx.globalAlpha = Math.max(0, 1 - prog * 0.7);
        ctx.strokeStyle = "#052E16";
        ctx.lineWidth = 8 * (1 - prog * 0.5);
        ctx.beginPath();
        ctx.arc(0, 0, 80 + prog * 110, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = "#22C55E";
        ctx.lineWidth = 4 * (1 - prog * 0.5);
        ctx.stroke();
      } else {
        ctx.translate(usx, usy);
        ctx.globalAlpha = Math.max(0, 1 - prog * 0.8);
        ctx.strokeStyle = "#0F172A";
        ctx.lineWidth = 9 * (1 - prog * 0.5);
        ctx.beginPath();
        ctx.arc(0, 0, 50 + prog * 170, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = u.color || "#FACC15";
        ctx.lineWidth = 5 * (1 - prog * 0.5);
        ctx.stroke();

        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 32 + prog * 145, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    });

    // 4. 繪製立體投射物彈幕 (projectiles：GBA四階火舌、螺旋氣泡水柱與王冠水花、純黑奇點暗影球、木紋橡子、三層風刃)
    this.projectiles.forEach(pr => {
      const sx = toSx(pr.x), sy = toSy(pr.y);
      const r = pr.radius;
      ctx.save();
      ctx.translate(sx, sy);

      if (pr.vfx === "ember_spark") {
        // 火花：深紅硬邊 ➔ 鮮橙火舌 ➔ 明黃白芯
        ctx.rotate(pr.angle || 0);
        ctx.fillStyle = "#7F1D1D";
        ctx.beginPath(); ctx.arc(0, 0, r * 0.88, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#F97316";
        ctx.beginPath(); ctx.arc(r * 0.08, 0, r * 0.72, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#FEF08A";
        ctx.beginPath(); ctx.arc(r * 0.22, -r * 0.12, r * 0.38, 0, Math.PI * 2); ctx.fill();

      } else if (pr.vfx === "fire_stream") {
        // 噴射火焰：GBA 四階色溫動態分叉火舌 (IMG_5056 左下角火球結構)
        ctx.rotate(pr.angle || 0);
        const flicker = Math.sin(now * 8 + pr.x * 0.05) * (r * 0.15);

        // 第1層：深褐紅硬描邊外廓
        ctx.fillStyle = "#7F1D1D";
        ctx.beginPath();
        ctx.arc(r * 0.25, 0, r * 0.78, -Math.PI / 2, Math.PI / 2);
        ctx.lineTo(-r * 1.15, r * 0.55 + flicker);
        ctx.lineTo(-r * 0.65, 0);
        ctx.lineTo(-r * 1.15, -r * 0.55 + flicker);
        ctx.closePath();
        ctx.fill();

        // 第2層：鮮紅主火身
        ctx.fillStyle = "#DC2626";
        ctx.beginPath();
        ctx.arc(r * 0.25, 0, r * 0.64, -Math.PI / 2, Math.PI / 2);
        ctx.lineTo(-r * 0.95, r * 0.42 + flicker);
        ctx.lineTo(-r * 0.48, 0);
        ctx.lineTo(-r * 0.95, -r * 0.42 + flicker);
        ctx.closePath();
        ctx.fill();

        // 第3層：亮橙內焰
        ctx.fillStyle = "#F97316";
        ctx.beginPath();
        ctx.ellipse(r * 0.1, 0, r * 0.55, r * 0.42, 0, 0, Math.PI * 2);
        ctx.fill();

        // 第4層：明黃純白高熱火芯
        ctx.fillStyle = "#FEF08A";
        ctx.beginPath();
        ctx.ellipse(r * 0.28, 0, r * 0.32, r * 0.22, 0, 0, Math.PI * 2);
        ctx.fill();

      } else if (pr.vfx === "water_gun") {
        // 水槍：深藍硬邊 ➔ 亮青水梭 ➔ 純白氣泡反光核
        ctx.rotate(pr.angle || 0);
        ctx.fillStyle = "#0369A1";
        ctx.beginPath();
        ctx.moveTo(r * 1.35, 0); ctx.lineTo(-r * 0.75, -r * 0.58); ctx.lineTo(-r * 0.35, 0); ctx.lineTo(-r * 0.75, r * 0.58);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "#38BDF8";
        ctx.beginPath();
        ctx.moveTo(r * 1.18, 0); ctx.lineTo(-r * 0.58, -r * 0.42); ctx.lineTo(-r * 0.2, 0); ctx.lineTo(-r * 0.58, r * 0.42);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath(); ctx.arc(r * 0.3, -r * 0.1, r * 0.26, 0, Math.PI * 2); ctx.fill();

      } else if (pr.vfx === "water_beam") {
        // 水炮：GBA 螺旋水柱束 + 前端三尖王冠水花衝擊冠 (IMG_5056 左上角水柱與水花王冠)
        ctx.rotate(pr.angle || 0);
        const tailLen = r * 2.1;

        // 深海藍外襯水柱
        ctx.fillStyle = "#0369A1";
        ctx.beginPath();
        ctx.roundRect(-tailLen, -r * 0.58, tailLen + r * 0.4, r * 1.16, r * 0.5);
        ctx.fill();

        // 亮青水柱主體
        ctx.fillStyle = "#0284C7";
        ctx.beginPath();
        ctx.roundRect(-tailLen * 0.92, -r * 0.46, tailLen * 0.92 + r * 0.35, r * 0.92, r * 0.4);
        ctx.fill();

        // 內部斜向交錯推進的白色螺旋水紋與氣泡
        ctx.strokeStyle = "#BAE6FD";
        ctx.lineWidth = 2.4;
        for (let s = -tailLen * 0.75; s < r * 0.1; s += r * 0.65) {
          ctx.beginPath();
          ctx.moveTo(s, -r * 0.38);
          ctx.lineTo(s + r * 0.35, r * 0.38);
          ctx.stroke();
        }

        // 前端立體三尖王冠狀浪花冠 (Crown Splash)
        ctx.fillStyle = "#E0F2FE";
        ctx.strokeStyle = "#0284C7";
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(r * 0.1, -r * 0.85);
        ctx.lineTo(r * 0.85, -r * 0.55);
        ctx.lineTo(r * 0.45, -r * 0.18);
        ctx.lineTo(r * 1.15, 0);
        ctx.lineTo(r * 0.45, r * 0.18);
        ctx.lineTo(r * 0.85, r * 0.55);
        ctx.lineTo(r * 0.1, r * 0.85);
        ctx.quadraticCurveTo(r * 0.4, 0, r * 0.1, -r * 0.85);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

      } else if (pr.vfx === "shadow_orb") {
        // 暗影球：V10 純黑奇點核心 + 逆時針旋轉紫光吸附臂 + 亮白星芒核
        const rot = -now * 2.5;
        ctx.rotate(rot);

        ctx.strokeStyle = "#9333EA";
        ctx.lineWidth = 3.0;
        for (let k = 0; k < 3; k++) {
          const a = (k * Math.PI * 2) / 3;
          ctx.beginPath();
          ctx.arc(0, 0, r * 0.95, a, a + 1.15);
          ctx.stroke();
        }

        ctx.fillStyle = "#05050A";
        ctx.strokeStyle = "#C084FC";
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.68, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#F3E8FF";
        ctx.beginPath();
        ctx.arc(-r * 0.2, -r * 0.2, r * 0.18, 0, Math.PI * 2);
        ctx.fill();

      } else if (pr.vfx === "sludge_lob" || pr.vfx === "sludge_ball") {
        // 污泥炸彈：深紫黑外廓 + 濃紫毒團 + 3 顆螢光綠毒泡隆起
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
        ctx.rotate(pr.angle || 0);
        ctx.fillStyle = "#7F1D1D";
        ctx.beginPath();
        ctx.roundRect(-20, -18, 36, 36, 10);
        ctx.fill();

        ctx.fillStyle = pr.color || "#DC2626";
        ctx.strokeStyle = "#FEF08A";
        ctx.lineWidth = 2.8;
        ctx.beginPath();
        ctx.roundRect(-18, -16, 32, 32, 9);
        ctx.fill(); ctx.stroke();

        ctx.fillStyle = "#FFFFFF";
        for (let k = -1.5; k <= 1.5; k += 1) {
          ctx.beginPath(); ctx.arc(12, k * 7.5, 4.5, 0, Math.PI * 2); ctx.fill();
        }
      } else if (pr.vfx === "seed_nut") {
        // V10 立體木紋橡子
        ctx.rotate(pr.angle || 0);
        ctx.fillStyle = "#3F6212";
        ctx.beginPath();
        ctx.ellipse(0, r * 0.18, r * 0.82, r * 0.95, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#65A30D";
        ctx.beginPath();
        ctx.ellipse(0, r * 0.18, r * 0.70, r * 0.82, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "#365314";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-r * 0.26, -r * 0.2); ctx.quadraticCurveTo(-r * 0.32, r * 0.25, -r * 0.14, r * 0.82);
        ctx.moveTo(r * 0.26, -r * 0.2);  ctx.quadraticCurveTo(r * 0.32, r * 0.25, r * 0.14, r * 0.82);
        ctx.stroke();

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
        // 冷凍光線：立體雙色切面六角冰晶槍 + 尾端雙軌折線寒霜束
        ctx.rotate(pr.angle || 0);
        ctx.strokeStyle = "#0284C7";
        ctx.lineWidth = 5.5;
        ctx.beginPath();
        ctx.moveTo(-r * 1.6, 0); ctx.lineTo(r * 0.5, 0);
        ctx.stroke();

        ctx.strokeStyle = "#E0F2FE";
        ctx.lineWidth = 2.2;
        ctx.stroke();

        // 前端雙色切面冰稜槍頭
        ctx.fillStyle = "#0369A1";
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(r * 1.35, 0); ctx.lineTo(0, -r * 0.62); ctx.lineTo(-r * 0.85, 0); ctx.lineTo(0, r * 0.62);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#BAE6FD";
        ctx.beginPath();
        ctx.moveTo(r * 1.25, 0); ctx.lineTo(0, -r * 0.52); ctx.lineTo(-r * 0.75, 0);
        ctx.closePath();
        ctx.fill();
      } else if (pr.vfx === "wind_blade") {
        // 空氣斬：V10 三層新月風刃 (深藍紫底框 + 青白風刃 + 純白亮刃口)
        ctx.rotate(pr.angle || 0);
        ctx.fillStyle = "#312E81";
        ctx.beginPath();
        ctx.arc(0, 0, r * 1.05, -1.25, 1.25);
        ctx.arc(r * 0.38, 0, r * 0.78, 1.25, -1.25, true);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "#E0E7FF";
        ctx.strokeStyle = "#6366F1";
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.92, -1.18, 1.18);
        ctx.arc(r * 0.42, 0, r * 0.72, 1.18, -1.18, true);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(-r * 0.05, 0, r * 0.92, -1.0, 1.0);
        ctx.stroke();
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

    // 5. 繪製三層立體雷電鏈 (開啟 lighter 呈現白熾高壓電漿發光)
    this.lightningArcs.forEach(arc => {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.lineJoin = "round";
      ctx.lineCap = "round";

      ctx.strokeStyle = "rgba(120, 53, 15, 0.75)";
      ctx.lineWidth = 8.5;
      ctx.beginPath();
      arc.pts.forEach((pt, idx) => {
        const sx = toSx(pt.x), sy = toSy(pt.y);
        if (idx === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      });
      ctx.stroke();

      ctx.strokeStyle = arc.color || "#FDE047";
      ctx.lineWidth = 5.0;
      ctx.stroke();

      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 2.2;
      ctx.stroke();
      ctx.restore();
    });

    // 6. 繪製立體微粒子 (支援三切面立體岩塊、GBA十字星芒、帶邊樹葉與高光水珠)
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
        // GBA 經典十字閃耀星芒 (IMG_5056 中間偏左十字星)
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
  }
};
