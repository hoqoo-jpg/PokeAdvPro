/**
 * ============================================================================
 * skills_engine.js
 * 專屬招式與視覺特效引擎 (Skills & VFX Engine - 完整平滑與 iPhone 適配版)
 * 職責：
 * 1. 技能發射判定 (彈道數、穿透、追蹤、散射角、傷害加成與擊退分配)
 * 2. 投射物實體生命週期運算與旋轉運動學 (適配 iPhone 螢幕射程與速度)
 * 3. 近戰刀光、空手劈氣勁巨拳、地震重踏裂痕與打擊幾何渲染
 * 4. 金白電漿鏈 (十萬伏特)、大字爆炎、高壓水柱粒子特效
 * 5. 全屏究極超武視覺爆發 (加色高光合成 lighter 模式)
 * ============================================================================
 */

const SkillsEngine = {
  projectiles: [],
  meleeEffects: [],
  ultimateVfxList: [],
  lightningArcs: [],

  reset() {
    this.projectiles = [];
    this.meleeEffects = [];
    this.ultimateVfxList = [];
    this.lightningArcs = [];
  },

  fireSkill(caster, skillId, level, isEvolved, dmgScale = 1.0) {
    if (skillId === "Metronome") {
      const pool = ["Flamethrower", "Hydro Pump", "Seed Bomb", "Thunderbolt", "Shadow Ball", "Psystrike", "Ice Beam", "Moonblast", "Dragon Rush"];
      const pick = pool[Math.floor(Math.random() * pool.length)];
      this.fireSkill(caster, pick, level, isEvolved, dmgScale * 1.15);
      return;
    }

    const meta = SKILLS_CATALOG[skillId] || SKILLS_CATALOG["Tackle"];
    const target = GameApp.findNearestEnemyInViewport(caster.x, caster.y, 380);
    const baseAngle = target
      ? Math.atan2(target.y - caster.y, target.x - caster.x)
      : (caster.facingX >= 0 ? 0 : Math.PI);

    const countBonus = (level >= 3 ? 1 : 0) + (level >= 6 ? 1 : 0) + (level >= 9 ? 1 : 0) + (caster === GameApp.player ? GameApp.player.projBonus : 0);
    const count = Math.min(6, 1 + countBonus);

    const isStab = (caster.data.type1 === meta.type || caster.data.type2 === meta.type);
    const stabMult = isStab ? 1.35 : 1.0;

    const lvDmgMult = 1 + (level - 1) * 0.10 + (level === 10 ? 0.20 : 0);

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
    }

    const basePower = meta.baseDmg * 0.55 + (GameApp.player.baseAtk * 0.18);
    const xAtkMult = (GameApp.player && GameApp.player.xAttackTimer > 0) ? 1.35 : 1.0;
    const rawDmg = basePower * lvDmgMult * GameApp.player.dmgMult * xAtkMult * stabMult * dmgScale * stageBuffMult * weatherBuff * heldItemMult;

    if (meta.isMelee) {
      this.executeMeleeSkill(caster, meta, level, count, baseAngle, rawDmg);
      return;
    }

    if (skillId === "Thunderbolt") {
      const maxStrikeRange = 210 * GameApp.player.areaMult;
      const nearby = GameApp.enemies
        .filter(e => Math.hypot(e.x - caster.x, e.y - caster.y) <= maxStrikeRange)
        .sort((a, b) => Math.hypot(a.x - caster.x, a.y - caster.y) - Math.hypot(b.x - caster.x, b.y - caster.y));

      const boltCount = Math.max(3, count + 2);
      for (let b = 0; b < boltCount; b++) {
        const enemyTarget = nearby[b];
        let endX, endY;
        if (enemyTarget) {
          endX = enemyTarget.x; endY = enemyTarget.y;
          GameApp.dealDamageToEnemy(enemyTarget, rawDmg, meta.type, level >= 5 ? 0.55 : 0.35, meta.knockback !== undefined ? meta.knockback : 2);
        } else {
          const spreadAng = baseAngle + (b - (boltCount - 1) / 2) * 0.36;
          const rDist = (120 + Math.random() * 80) * GameApp.player.areaMult;
          endX = caster.x + Math.cos(spreadAng) * rDist;
          endY = caster.y + Math.sin(spreadAng) * rDist;
          GameApp.enemies.forEach(e => {
            if (Math.hypot(e.x - endX, e.y - endY) <= 42 + e.radius) {
              GameApp.dealDamageToEnemy(e, rawDmg * 0.85, meta.type, 0.35, meta.knockback !== undefined ? meta.knockback : 2);
            }
          });
        }
        this.createLightningArc(caster.x, caster.y, endX, endY, "#FDE047");
        GameApp.spawnParticleCluster(endX, endY, "#FFFFFF", "#F59E0B", 8, "star", 0.85);
      }
      SoundFX.play("hit");
      return;
    }

    for (let i = 0; i < count; i++) {
      const spread = count > 1 ? (i - (count - 1) / 2) * 0.16 : 0;
      const ang = baseAngle + spread;
      const spd = skillId === "Hydro Pump" ? 320 : (skillId === "Air Slash" ? 350 : 300);
      const isHoming = (skillId === "Shadow Ball" || skillId === "Psystrike" || skillId === "Moonblast");

      this.projectiles.push({
        x: caster.x,
        y: caster.y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        angle: ang,
        radius: (skillId === "Hydro Pump" ? 22 : 16) * GameApp.player.areaMult * (level >= 8 ? 1.25 : 1.0),
        dmg: rawDmg,
        type: meta.type,
        skillId,
        vfx: meta.vfx || "star_shot",
        homing: isHoming,
        color: meta.color,
        pierce: (level >= 6 ? 3 : 2),
        knockback: meta.knockback !== undefined ? meta.knockback : 0,
        life: 0.85,
        statusBonus: level >= 5 ? 0.30 : 0,
        hitSet: new Set()
      });
    }
    SoundFX.play("hit");
  },

  executeMeleeSkill(caster, meta, level, count, baseAngle, rawDmg) {
    const style = meta.meleeStyle || "claw_slash";
    const areaScale = GameApp.player.areaMult * (level >= 3 ? 1.15 : 1.0) * (level >= 8 ? 1.25 : 1.0);
    const kb = meta.knockback !== undefined ? meta.knockback : 8;

    if (style === "martial_fist") {
      const fistCount = Math.min(10, 4 + count + Math.floor(level / 2));
      for (let f = 0; f < fistCount; f++) {
        const ang = baseAngle + (f * (Math.PI * 2) / fistCount) * (level >= 5 ? 1 : 0.45);
        const spd = 240 + (f % 3) * 45;
        this.projectiles.push({
          x: caster.x,
          y: caster.y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          angle: ang,
          spinSpeed: 2.8,
          radius: 28 * areaScale,
          dmg: rawDmg,
          type: meta.type,
          skillId: meta.id,
          vfx: "giant_fist",
          homing: false,
          color: meta.color,
          pierce: 4,
          knockback: kb,
          life: 0.58,
          maxLife: 0.58,
          statusBonus: 0.25,
          hitSet: new Set()
        });
      }
      GameApp.spawnParticleCluster(caster.x, caster.y, "#FFFFFF", "#FEF08A", 16, "star", 1.1);
      SoundFX.play("hit");
      return;
    }

    if (style === "quake_wave" || style === "slam_wave") {
      const rad = (style === "quake_wave" ? (120 + level * 6) : 110) * areaScale;
      this.meleeEffects.push({
        style,
        x: caster.x,
        y: caster.y,
        radius: rad,
        timer: 0.42,
        maxTime: 0.42,
        color: meta.color
      });
      GameApp.camera.shakeTime = 0.16;
      GameApp.camera.shakeMagnitude = 4.8;
      GameApp.enemies.forEach(e => {
        if (Math.hypot(e.x - caster.x, e.y - caster.y) <= rad + e.radius) {
          GameApp.dealDamageToEnemy(e, rawDmg, meta.type, style === "slam_wave" ? 0.35 : 0.20, kb);
          if (caster === GameApp.player && GameApp.player.hp < GameApp.player.maxHp) {
            GameApp.player.hp = Math.min(GameApp.player.maxHp, GameApp.player.hp + Math.round(GameApp.player.maxHp * 0.008));
          }
        }
      });
      SoundFX.play("ultimate");
      return;
    }

    const maxReach = 98 * areaScale;
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
        timer: 0.32,
        maxTime: 0.32,
        color: meta.color
      });

      GameApp.enemies.forEach(e => {
        const dx = e.x - caster.x, dy = e.y - caster.y;
        const d = Math.hypot(dx, dy);
        if (d <= maxReach + e.radius) {
          const eAng = Math.atan2(dy, dx);
          const diff = Math.abs(Math.atan2(Math.sin(eAng - ang), Math.cos(eAng - ang)));
          if (diff <= 0.95 || d < 38) {
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
    GameApp.camera.shakeTime = 0.30;
    GameApp.camera.shakeMagnitude = 8.5;
    SoundFX.play("ultimate");

    const ultDmg = (meta.baseDmg * 2.6 + p.baseAtk * 1.2) * p.dmgMult;

    this.ultimateVfxList.push({
      type: meta.type,
      skillId: meta.id,
      x: p.x,
      y: p.y,
      timer: 1.15,
      maxTime: 1.15,
      color: meta.color
    });

    if (meta.type === "Electric") {
      for (let i = 0; i < 14; i++) {
        const ang = (i * Math.PI * 2) / 14;
        const dist = 240 + Math.random() * 70;
        const tx = p.x + Math.cos(ang) * dist;
        const ty = p.y + Math.sin(ang) * dist;
        this.createLightningArc(p.x, p.y, tx, ty, "#FDE047");
        GameApp.spawnParticleCluster(tx, ty, "#FEF08A", "#F59E0B", 5, "star", 0.85);
      }
    } else if (meta.type === "Fire") {
      for (let i = 0; i < 8; i++) {
        const ang = (i * Math.PI * 2) / 8;
        this.projectiles.push({
          x: p.x, y: p.y,
          vx: Math.cos(ang) * 320, vy: Math.sin(ang) * 320,
          angle: ang, radius: 24, dmg: ultDmg * 0.65,
          type: "Fire", skillId: "Flamethrower", vfx: "fire_stream",
          color: "#F97316", pierce: 6, knockback: 0, life: 0.95, statusBonus: 0.5, hitSet: new Set()
        });
      }
    } else if (meta.type === "Water") {
      for (let i = 0; i < 10; i++) {
        const ang = (i * Math.PI * 2) / 10;
        this.projectiles.push({
          x: p.x, y: p.y,
          vx: Math.cos(ang) * 360, vy: Math.sin(ang) * 360,
          angle: ang, radius: 24, dmg: ultDmg * 0.65,
          type: "Water", skillId: "Hydro Pump", vfx: "water_beam",
          color: "#38BDF8", pierce: 6, knockback: 20, life: 0.95, statusBonus: 0.5, hitSet: new Set()
        });
      }
    }

    const halfW = GameApp.width / 2 + 60;
    const halfH = GameApp.height / 2 + 60;
    GameApp.enemies.forEach(e => {
      if (Math.abs(e.x - p.x) <= halfW && Math.abs(e.y - p.y) <= halfH) {
        GameApp.dealDamageToEnemy(e, ultDmg, meta.type, 0.65, e.isBoss ? 0 : 35);
      }
    });

    if (meta.type === "Grass") {
      p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * 0.08));
    }
  },

  createLightningArc(x1, y1, x2, y2, color) {
    const pts = [{ x: x1, y: y1 }];
    const steps = 6;
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      pts.push({
        x: x1 + (x2 - x1) * t + (Math.random() - 0.5) * 34,
        y: y1 + (y2 - y1) * t + (Math.random() - 0.5) * 34
      });
    }
    pts.push({ x: x2, y: y2 });
    this.lightningArcs.push({ pts, color, timer: 0.25 });
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

      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      pr.life -= dt;

      for (let j = GameApp.enemies.length - 1; j >= 0; j--) {
        const e = GameApp.enemies[j];
        if (pr.hitSet.has(e)) continue;
        if (Math.hypot(e.x - pr.x, e.y - pr.y) <= pr.radius + e.radius) {
          pr.hitSet.add(e);
          GameApp.dealDamageToEnemy(e, pr.dmg, pr.type, pr.statusBonus, pr.knockback || 0);
          GameApp.spawnParticleCluster(pr.x, pr.y, pr.color, "#FFFFFF", 7, "star", 0.75);
          pr.pierce -= 1;
          if (pr.pierce <= 0) break;
        }
      }

      if (pr.life <= 0 || pr.pierce <= 0) {
        this.projectiles.splice(i, 1);
      }
    }

    for (let i = this.meleeEffects.length - 1; i >= 0; i--) {
      this.meleeEffects[i].timer -= dt;
      if (this.meleeEffects[i].timer <= 0) this.meleeEffects.splice(i, 1);
    }

    for (let i = this.ultimateVfxList.length - 1; i >= 0; i--) {
      this.ultimateVfxList[i].timer -= dt;
      if (this.ultimateVfxList[i].timer <= 0) this.ultimateVfxList.splice(i, 1);
    }

    for (let i = this.lightningArcs.length - 1; i >= 0; i--) {
      this.lightningArcs[i].timer -= dt;
      if (this.lightningArcs[i].timer <= 0) this.lightningArcs.splice(i, 1);
    }
  },

  render(ctx, toSx, toSy) {
    this.meleeEffects.forEach(m => {
      const prog = 1 - (m.timer / m.maxTime);
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - prog * 0.75);

      if (m.style === "quake_wave" || m.style === "slam_wave") {
        const msx = toSx(m.x), msy = toSy(m.y);
        const curR = m.radius * (0.28 + prog * 0.72);
        ctx.strokeStyle = m.color;
        ctx.lineWidth = 6 * (1 - prog * 0.5);
        ctx.beginPath();
        ctx.arc(msx, msy, curR, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(msx, msy, curR * 0.8, 0, Math.PI * 2);
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
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, curR, -0.85, 0.85);
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

      if (pr.vfx === "giant_fist") {
        ctx.fillStyle = pr.color;
        ctx.strokeStyle = "#FEF08A";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.roundRect(-18, -16, 30, 32, 9);
        ctx.fill(); ctx.stroke();

        ctx.fillStyle = "#FFFFFF";
        for (let k = -1.5; k <= 1.5; k += 1) {
          ctx.beginPath(); ctx.arc(12, k * 7.5, 4.5, 0, Math.PI * 2); ctx.fill();
        }
      } else if (pr.vfx === "fire_stream") {
        ctx.fillStyle = "#DC2626";
        ctx.beginPath(); ctx.arc(0, 0, r * 0.75, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#F97316";
        ctx.beginPath(); ctx.arc(r * 0.15, 0, r * 0.55, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath(); ctx.arc(r * 0.25, 0, r * 0.3, 0, Math.PI * 2); ctx.fill();
      } else if (pr.vfx === "water_beam") {
        ctx.fillStyle = "#0284C7";
        ctx.beginPath(); ctx.arc(0, 0, r * 0.7, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath(); ctx.arc(r * 0.2, -r * 0.2, r * 0.25, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = pr.color;
        ctx.beginPath(); ctx.arc(0, 0, r * 0.7, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath(); ctx.arc(r * 0.35, 0, r * 0.35, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    });

    this.lightningArcs.forEach(arc => {
      ctx.save();
      ctx.strokeStyle = arc.color;
      ctx.lineWidth = 5;
      ctx.lineJoin = "round";
      ctx.beginPath();
      arc.pts.forEach((pt, idx) => {
        const sx = toSx(pt.x), sy = toSy(pt.y);
        if (idx === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      });
      ctx.stroke();

      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      arc.pts.forEach((pt, idx) => {
        const sx = toSx(pt.x), sy = toSy(pt.y);
        if (idx === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      });
      ctx.stroke();
      ctx.restore();
    });
  }
};
