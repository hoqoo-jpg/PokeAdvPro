/**
 * ============================================================================
 * battle_renderer.js (v7.2.0 Step 1A 渲染層解耦模組)
 * 職責：
 * 1. 大廳自然生態背景漫步渲染 (renderTitleDemo)
 * 2. 戰場主畫面渲染與 2.5D Y-Sorting 深度排序 (renderCombat)
 * 3. 敵方衝鋒殘影、3 層次屬性爆破、神獸討伐與冠軍加冕過場演出
 * 4. 進化／覺醒／Mega 變身聚光燈特寫、開戰倒數與離線剪影閃白渲染
 * ============================================================================
 */

window.GameApp = window.GameApp || {};

Object.assign(window.GameApp, {
  renderTitleDemo() {
    const ctx = this.ctx;
    const dpr = this.dpr || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, this.width, this.height);
    if (!this.titleDemo) return;
    const camX = this.titleDemo.camX;
    const camY = this.titleDemo.camY;

    MapEngine.renderBiomeWorld(ctx, camX, camY, this.width, this.height);

    const now = performance.now() * 0.004;
    this.titleDemo.wildWanderers.forEach((w, idx) => {
      const worldX = Math.floor((camX + w.offsetX) / 1200) * 1200 + ((w.offsetX + idx * 170) % 1200);
      const worldY = camY + w.offsetY + Math.sin(now + w.phase) * 14;
      const sx = worldX - camX + this.width / 2;
      const sy = worldY - camY + this.height / 2;
      const hop = Math.abs(Math.sin(now * 1.6 + w.phase)) * 8;

      const pData = POKEMON_MAP.get(w.id);
      if (!pData) return;
      const rec = SpriteCache.get(pData.forward_sprite);
      if (rec && rec.loaded) {
        ctx.save();
        ctx.translate(sx, sy - hop);
        ctx.fillStyle = "rgba(15,23,42,0.28)";
        ctx.beginPath();
        ctx.ellipse(0, 18 + hop * 0.4, 15, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        if (Math.cos(now * 0.5 + w.phase) > 0) ctx.scale(-1, 1);
        ctx.drawImage(rec.img, -24, -24, 48, 48);
        ctx.restore();
      }
    });
  },

  renderEvolutionOverlay(ctx, toSx, toSy) {
    const seq = this.evoSequence;
    if (!seq || !seq.active || !this.player) return;

    const p = this.player;
    const px = toSx(p.x);
    const py = toSy(p.y);
    const t = seq.timer;
    const dur = seq.duration;

    ctx.save();

    const burstT = seq.isAwakening ? (seq.burstAt || 0.72) : (seq.isMega ? (seq.burstAt || 1.50) : 1.35);
    const fadeStartT = dur - 0.30;
    // 1. 戰場聚光燈暗角遮罩 (以主角為圓心，周圍戰場壓暗 74%)
    const spotR = t < burstT ? Math.max(68, 125 - t * 28) : 95 + (t - burstT) * 420;
    const darkAlpha = t > fadeStartT ? Math.max(0, (1 - (t - fadeStartT) / 0.30) * 0.74) : 0.74;
    const bgGrad = ctx.createRadialGradient(px, py, spotR * 0.25, px, py, spotR);
    bgGrad.addColorStop(0, "rgba(15, 23, 42, 0.0)");
    bgGrad.addColorStop(0.55, `rgba(15, 23, 42, ${darkAlpha * 0.45})`);
    bgGrad.addColorStop(1, `rgba(2, 6, 23, ${darkAlpha})`);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, this.width, this.height);

    // 2. 腳底雙層旋轉進化星陣與螺旋上升光球
    ctx.save();
    ctx.translate(px, py + 15);
    ctx.globalCompositeOperation = "lighter";
    const ringCol = TYPE_COLORS[seq.nextData.type1] || "#38BDF8";
    ctx.strokeStyle = "#FACC15";
    ctx.lineWidth = 3.0;
    ctx.beginPath();
    ctx.ellipse(0, 0, 42 + Math.sin(t * 14) * 5, 16, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = ringCol;
    ctx.lineWidth = 2.2;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.ellipse(0, 0, 56, 22, t * 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // 螺旋上升的 10 顆進化光珠
    for (let k = 0; k < 10; k++) {
      const orbProg = ((t * 1.6 + k * 0.1) % 1.0);
      const orbAng = t * 6.5 + (k * Math.PI * 2) / 10;
      const orbR = (1 - orbProg * 0.55) * 44;
      const ox = Math.cos(orbAng) * orbR;
      const oy = Math.sin(orbAng) * (orbR * 0.38) - orbProg * 78;
      ctx.fillStyle = k % 2 === 0 ? "#FEF08A" : "#38BDF8";
      ctx.beginPath();
      ctx.arc(ox, oy, 3.2 * (1 - orbProg * 0.4), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 3. 中央主角變身演出（Mega 專屬三段式：鑰石連線 ➔ 彩虹菱晶繭裂紋 ➔ 破繭降臨；一般進化維持掌機剪影閃爍）
    const oldRec = p.isShiny ? SpriteCache.getShiny(seq.oldData.forward_sprite) : SpriteCache.get(seq.oldData.forward_sprite);
    const nextRec = p.isShiny ? SpriteCache.getShiny(seq.nextData.forward_sprite) : SpriteCache.get(seq.nextData.forward_sprite);

    if (seq.isMega) {
      const mCol = (seq.nextData && seq.nextData.burstColor) || "#38BDF8";
      // 階段 1 (0.0s ~ 0.85s)：訓練家手腕 ⇄ 精靈「彩虹 DNA 雙螺旋鑰石共鳴光束」＋ 頭頂 Mega 彩虹徽記
      if (t < 0.90) {
        const beamFade = t > 0.70 ? Math.max(0, 1 - (t - 0.70) / 0.20) : Math.min(1, t / 0.18);
        const tc = this.trainerCompanion;
        const tx = tc ? toSx(tc.x) : (px - 62);
        const ty = tc ? (toSy(tc.y) - 6) : (py + 12);
        const dx = px - tx, dy = py - ty;
        const dist = Math.hypot(dx, dy) || 1;
        const ux = dx / dist, uy = dy / dist;
        const nx = -uy, ny = ux;

        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = beamFade;
        const rainbowCols = ["#38BDF8", "#E879F9", "#FACC15"];
        rainbowCols.forEach((col, sIdx) => {
          ctx.strokeStyle = col;
          ctx.lineWidth = sIdx === 0 ? 3.2 : 2.2;
          ctx.beginPath();
          for (let step = 0; step <= 24; step++) {
            const frac = step / 24;
            const wave = Math.sin(frac * Math.PI * 3.5 - t * 18 + sIdx * 2.1) * (8 * Math.sin(frac * Math.PI));
            const bx = tx + dx * frac + nx * wave;
            const by = ty + dy * frac + ny * wave;
            if (step === 0) ctx.moveTo(bx, by);
            else ctx.lineTo(bx, by);
          }
          ctx.stroke();
        });
        // 訓練家手腕鑰石爆閃
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath(); ctx.arc(tx, ty, 6 + Math.sin(t * 24) * 2, 0, Math.PI * 2); ctx.fill();
        ctx.restore();

        // 頭頂浮現經典 Mega 彩虹雙螺旋徽記
        ctx.save();
        ctx.translate(px, py - 46 - Math.sin(t * 6) * 3);
        ctx.globalAlpha = beamFade;
        ctx.globalCompositeOperation = "lighter";
        ctx.lineWidth = 3.2;
        ctx.strokeStyle = "#38BDF8";
        ctx.beginPath();
        for (let k = -12; k <= 12; k += 2) {
          const hy = Math.sin((k / 12) * Math.PI + t * 8) * 7;
          if (k === -12) ctx.moveTo(k, hy); else ctx.lineTo(k, hy);
        }
        ctx.stroke();
        ctx.strokeStyle = "#E879F9";
        ctx.beginPath();
        for (let k = -12; k <= 12; k += 2) {
          const hy = -Math.sin((k / 12) * Math.PI + t * 8) * 7;
          if (k === -12) ctx.moveTo(k, hy); else ctx.lineTo(k, hy);
        }
        ctx.stroke();
        ctx.restore();
      }

      ctx.save();
      ctx.translate(px, py);
      if (t < burstT) {
        // 階段 2 (0.65s ~ 1.50s)：六角彩虹棱鏡結晶繭包覆 ➔ 裂紋擴散震動
        const cocoonProg = Math.max(0, Math.min(1, (t - 0.55) / (burstT - 0.55)));
        const shakeAmp = cocoonProg > 0.45 ? (cocoonProg - 0.45) * 9 : 0;
        const jx = (Math.random() - 0.5) * shakeAmp;
        const jy = (Math.random() - 0.5) * shakeAmp;
        ctx.translate(jx, jy);

        if (oldRec && oldRec.loaded) {
          ctx.drawImage(oldRec.img, -28, -24, 56, 56);
          if (cocoonProg > 0) {
            this.drawSilhouetteFlash(ctx, oldRec.img, -28, -24, 56, 56, "#E0F2FE", Math.min(0.85, cocoonProg * 0.9));
          }
        }
        if (cocoonProg > 0) {
          const cr = 34 + cocoonProg * 8;
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          const cGrad = ctx.createRadialGradient(0, -2, 6, 0, -2, cr);
          cGrad.addColorStop(0, `rgba(255, 255, 255, ${0.28 + cocoonProg * 0.45})`);
          cGrad.addColorStop(0.55, `rgba(56, 189, 248, ${0.35 + cocoonProg * 0.35})`);
          cGrad.addColorStop(1, `rgba(232, 121, 249, ${0.42 + cocoonProg * 0.30})`);
          ctx.fillStyle = cGrad;
          ctx.strokeStyle = "#FFFFFF";
          ctx.lineWidth = 2.6;
          ctx.beginPath();
          for (let h = 0; h < 6; h++) {
            const ha = (h * Math.PI) / 3 - Math.PI / 6;
            const hx = Math.cos(ha) * cr * 0.88;
            const hy = Math.sin(ha) * cr * 1.12;
            if (h === 0) ctx.moveTo(hx, hy); else ctx.lineTo(hx, hy);
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // 表面蔓延的彩虹裂紋
          if (cocoonProg > 0.35) {
            const crackAlpha = (cocoonProg - 0.35) / 0.65;
            ctx.strokeStyle = `rgba(254, 240, 138, ${crackAlpha})`;
            ctx.lineWidth = 2.2;
            for (let cIdx = 0; cIdx < 5; cIdx++) {
              const ca = cIdx * 1.25 + 0.3;
              const len = cr * (0.35 + crackAlpha * 0.62);
              ctx.beginPath();
              ctx.moveTo(0, 0);
              ctx.lineTo(Math.cos(ca + 0.18) * len * 0.5, Math.sin(ca + 0.18) * len * 0.5);
              ctx.lineTo(Math.cos(ca) * len, Math.sin(ca) * len);
              ctx.stroke();
            }
          }
          ctx.restore();
        }
      } else {
        // 階段 3 (1.50s ~ 2.10s)：棱鏡炸裂碎片 ＋ Mega 專屬色調放射光環霸氣降臨
        const burstProg = Math.min(1, (t - burstT) / Math.max(0.1, dur - burstT));
        const hopY = -Math.sin(burstProg * Math.PI) * 18;
        const scalePop = 1.56 - burstProg * 0.22;

        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        // 炸裂飛散的 10 枚彩虹棱鏡碎片
        const shardCols = ["#38BDF8", "#E879F9", "#FACC15", "#FFFFFF", mCol];
        for (let sh = 0; sh < 10; sh++) {
          const sa = (sh * Math.PI * 2) / 10 + 0.2;
          const dist = 26 + burstProg * 95;
          const sx = Math.cos(sa) * dist;
          const sy = Math.sin(sa) * dist;
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(sa + burstProg * 5);
          ctx.globalAlpha = Math.max(0, 1 - burstProg * 1.15);
          ctx.fillStyle = shardCols[sh % shardCols.length];
          ctx.beginPath();
          ctx.moveTo(0, -8); ctx.lineTo(5, 0); ctx.lineTo(0, 8); ctx.lineTo(-5, 0);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
        // 專屬 Mega 放射光束與衝擊環
        if (burstProg < 0.8) {
          const rA = (1 - burstProg / 0.8) * 0.9;
          ctx.strokeStyle = mCol;
          ctx.globalAlpha = rA;
          ctx.lineWidth = 4.2;
          ctx.beginPath(); ctx.arc(0, 0, 28 + burstProg * 88, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.restore();

        if (nextRec && nextRec.loaded) {
          ctx.imageSmoothingEnabled = false;
          ctx.translate(0, hopY);
          ctx.scale(scalePop, scalePop);
          ctx.drawImage(nextRec.img, -28, -24, 56, 56);
          if (burstProg < 0.32) {
            this.drawSilhouetteFlash(ctx, nextRec.img, -28, -24, 56, 56, mCol, (1 - burstProg / 0.32) * 0.85);
          }
        }
      }
      ctx.restore();
      ctx.restore();
      return;
    }

    ctx.save();
    ctx.translate(px, py);

    if (t < burstT) {
      // Phase 1 & 2：進化交替閃爍 / 單階覺醒金青蓄氣脈衝
      const normT = Math.max(0, (t - 0.12) / Math.max(0.1, burstT - 0.12));
      const wave = Math.sin(normT * normT * Math.PI * 13.5);
      const showNext = !seq.isAwakening && t >= 0.25 && wave > 0;
      const activeRec = showNext ? nextRec : oldRec;
      const pulseScale = 1.0 + Math.sin(t * 22) * 0.12 + normT * (seq.isAwakening ? 0.18 : 0.22);
      const silhouetteAlpha = seq.isAwakening ? (0.20 + normT * 0.55) : Math.min(1.0, 0.35 + normT * 0.65);

      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const orbGlow = ctx.createRadialGradient(0, -2, 4, 0, -2, 44 * pulseScale);
      orbGlow.addColorStop(0, `rgba(255, 255, 255, ${0.55 + normT * 0.4})`);
      orbGlow.addColorStop(0.55, seq.awakenKind === "legendary" ? "rgba(236, 72, 153, 0.45)" : "rgba(250, 204, 21, 0.48)");
      orbGlow.addColorStop(1, "rgba(56, 189, 248, 0)");
      ctx.fillStyle = orbGlow;
      ctx.beginPath();
      ctx.arc(0, -2, 44 * pulseScale, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      if (activeRec && activeRec.loaded) {
        const isHiRes = (activeRec.img.naturalWidth || activeRec.img.width || 0) > 160;
        ctx.imageSmoothingEnabled = isHiRes;
        ctx.scale(pulseScale, pulseScale);
        ctx.drawImage(activeRec.img, -28, -24, 56, 56);
        this.drawSilhouetteFlash(ctx, activeRec.img, -28, -24, 56, 56, seq.isAwakening ? "#FEF08A" : "#FFFFFF", silhouetteAlpha);
      }
    } else {
      // Phase 3：破殼／覺醒金芒炸裂 + 霸氣登場跳躍
      const burstProg = Math.min(1, (t - burstT) / Math.max(0.1, dur - burstT));
      const hopY = -Math.sin(burstProg * Math.PI) * 16;
      const endScale = seq.isAwakening
        ? (seq.awakenKind === "single" ? 1.12 : (p.legendaryAwaken24 ? 1.16 : 1.08))
        : 1.0;
      const scalePop = (endScale + 0.26) - burstProg * 0.26;

      // 破殼瞬間放射狀八芒金白光束
      if (burstProg < 0.75) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const rayAlpha = (1 - burstProg / 0.75) * 0.85;
        ctx.strokeStyle = `rgba(254, 240, 138, ${rayAlpha})`;
        ctx.lineWidth = 4.5;
        for (let rIdx = 0; rIdx < 8; rIdx++) {
          const rAng = (rIdx * Math.PI) / 4 + burstProg * 0.6;
          ctx.beginPath();
          ctx.moveTo(Math.cos(rAng) * 18, Math.sin(rAng) * 18);
          ctx.lineTo(Math.cos(rAng) * (55 + burstProg * 65), Math.sin(rAng) * (55 + burstProg * 65));
          ctx.stroke();
        }
        ctx.restore();
      }

      if (nextRec && nextRec.loaded) {
        const isHiRes = (nextRec.img.naturalWidth || nextRec.img.width || 0) > 160;
        ctx.imageSmoothingEnabled = isHiRes;
        ctx.translate(0, hopY);
        ctx.scale(scalePop, scalePop);
        ctx.drawImage(nextRec.img, -28, -24, 56, 56);
        if (burstProg < 0.35) {
          this.drawSilhouetteFlash(ctx, nextRec.img, -28, -24, 56, 56, "#FEF08A", (1 - burstProg / 0.35) * 0.85);
        }
      }
    }
    ctx.restore();

    ctx.restore();
  },

  renderEvolutionDialogBox(ctx) {
    const seq = this.evoSequence;
    if (!seq || !seq.active || !this.player) return;
    const p = this.player;
    const t = seq.timer;

    ctx.save();
    const boxW = Math.min(this.width - 28, 420);
    const boxH = 64;
    const boxX = (this.width - boxW) / 2;
    const boxY = Math.min(this.height - 118, this.height / 2 + 72);

    ctx.fillStyle = "rgba(15, 23, 42, 0.94)";
    ctx.strokeStyle = t >= 1.35 ? "#FACC15" : "#38BDF8";
    ctx.lineWidth = 3.0;
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, 14);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(boxX + 4, boxY + 4, boxW - 8, boxH - 8, 10);
    ctx.stroke();

    const burstT = seq.isAwakening ? (seq.burstAt || 0.72) : (seq.isMega ? (seq.burstAt || 1.50) : 1.35);
    ctx.textAlign = "center";
    if (seq.isAwakening) {
      const isLeg = seq.awakenKind === "legendary";
      if (t < burstT) {
        ctx.font = "900 13px 'Noto Sans TC', sans-serif";
        ctx.fillStyle = isLeg ? "#FBCFE8" : "#BAE6FD";
        ctx.fillText(isLeg ? `👑 【${p.data.name_zh}】 體內的傳說王權正在共鳴……！` : `⚡ 【${p.data.name_zh}】 正在突破種族極限……！`, this.width / 2, boxY + 27);
        ctx.font = "700 11px 'Noto Sans TC', sans-serif";
        ctx.fillStyle = "#FDE047";
        ctx.fillText("✨ 潛能覺醒中，時空凍結 ✨", this.width / 2, boxY + 47);
      } else {
        ctx.font = "900 14px 'Noto Sans TC', sans-serif";
        ctx.fillStyle = "#FACC15";
        ctx.fillText(isLeg ? `👑 傳說王權共鳴！【${p.data.name_zh}】解放神聖威壓！` : `⚡ 潛能極限突破！【${p.data.name_zh}】覺醒完全體霸氣！`, this.width / 2, boxY + 26);
        ctx.font = "700 11px 'Noto Sans TC', sans-serif";
        ctx.fillStyle = "#34D399";
        ctx.fillText(isLeg ? `HP上限 +22% 回滿 ‧ 全傷害 +14% ‧ 12%霸體` : `體型與氣場進化 ‧ HP+22%回滿 ‧ 全傷+15% ‧ 12%霸體`, this.width / 2, boxY + 47);
      }
    } else if (seq.isMega) {
      const mCol = (seq.nextData && seq.nextData.burstColor) || "#38BDF8";
      if (t < burstT) {
        ctx.font = "900 13px 'Noto Sans TC', sans-serif";
        ctx.fillStyle = mCol;
        ctx.fillText(`💎 MEGA 鑰石強烈共鳴！【${seq.oldData.name_zh}】正在超越進化界限……！`, this.width / 2, boxY + 27);
        ctx.font = "700 11px 'Noto Sans TC', sans-serif";
        ctx.fillStyle = "#E879F9";
        ctx.fillText((seq.nextData && seq.nextData.evoPreText) || "💎 超級進化能量覺醒中，時空凍結 💎", this.width / 2, boxY + 47);
      } else {
        ctx.font = "900 14px 'Noto Sans TC', sans-serif";
        ctx.fillStyle = mCol;
        ctx.fillText((seq.nextData && seq.nextData.evoDoneTitle) || `💎 MEGA 超級進化！【${seq.nextData.name_zh}】降臨！`, this.width / 2, boxY + 26);
        ctx.font = "700 11px 'Noto Sans TC', sans-serif";
        ctx.fillStyle = "#FEF08A";
        ctx.fillText(`${(seq.nextData && seq.nextData.evoDoneSub) || "全屬性大幅解放"} ‧ HP上限 ${p.maxHp}`, this.width / 2, boxY + 47);
      }
    } else if (t < burstT) {
      ctx.font = "900 13px 'Noto Sans TC', sans-serif";
      ctx.fillStyle = "#BAE6FD";
      ctx.fillText(`咦……！？ 你的 【${seq.oldData.name_zh}】 的樣子……！`, this.width / 2, boxY + 27);
      ctx.font = "700 11px 'Noto Sans TC', sans-serif";
      ctx.fillStyle = "#FDE047";
      ctx.fillText("✨ 正在凝聚進化之光，時空凍結中 ✨", this.width / 2, boxY + 47);
    } else {
      ctx.font = "900 14px 'Noto Sans TC', sans-serif";
      ctx.fillStyle = "#FACC15";
      ctx.fillText(`🎉 恭喜！ 進化成了 【${seq.nextData.name_zh}】！`, this.width / 2, boxY + 26);
      ctx.font = "700 11px 'Noto Sans TC', sans-serif";
      ctx.fillStyle = "#34D399";
      const traitText = p.innateTrait ? ` ‧ 特性【${p.innateTrait.name}】進階！` : "！";
      ctx.fillText(`HP上限突破至 ${p.maxHp} ‧ 全傷害大幅提升${traitText}`, this.width / 2, boxY + 47);
    }
    ctx.restore();
  },

  renderEnemyDashesAndExplosions(ctx, toSx, toSy) {
    // 1. 敵方高速衝鋒殘影（暗紅／金黃剪影，100% 獨立於我方透明度）
    if (this.enemyDashes && this.enemyDashes.length > 0) {
      this.enemyDashes.forEach(ds => {
        const rec = ds.spriteUrl ? SpriteCache.get(ds.spriteUrl) : null;
        if (!rec || !rec.loaded) return;
        const sz = ds.size || 88;
        ds.afterimages.forEach(ai => {
          const sx = toSx(ai.x), sy = toSy(ai.y);
          const alpha = Math.max(0, (ai.life / (ai.maxLife || 0.22)) * 0.65);
          ctx.save();
          ctx.translate(sx, sy);
          if (ai.facingX > 0) ctx.scale(-1, 1);
          this.drawSilhouetteFlash(ctx, rec.img, -sz / 2, -sz / 2, sz, sz, ds.color || "#EF4444", alpha);
          ctx.restore();
        });
      });
    }

    // 2. 敵方 3 層次屬性專屬爆破特效（100% 不受我方技能透明度影響）
    if (this.enemyExplosions && this.enemyExplosions.length > 0) {
      this.enemyExplosions.forEach(ex => {
        const prog = Math.max(0, Math.min(1, 1 - (ex.timer / (ex.maxTime || 0.36))));
        const fade = Math.max(0, 1 - prog);
        const sx = toSx(ex.x), sy = toSy(ex.y);
        const r = ex.radius || 52;
        const curR = r * (0.42 + (1 - Math.pow(1 - prog, 2.2)) * 0.66);

        ctx.save();
        ctx.translate(sx, sy);

        // 第 1 層：前 0.08s 白金實心閃核（提供紮實引爆擊打點）
        if (prog < 0.24) {
          const coreA = (1 - prog / 0.24) * 0.88;
          ctx.fillStyle = `rgba(255, 255, 255, ${coreA})`;
          if (ex.shape === "ring" && ex.innerRadius > 0) {
            ctx.beginPath();
            ctx.arc(0, 0, r * 0.96, 0, Math.PI * 2);
            ctx.arc(0, 0, ex.innerRadius, 0, Math.PI * 2, true);
            ctx.fill("evenodd");
          } else {
            ctx.beginPath();
            ctx.arc(0, 0, r * (0.68 + prog * 0.45), 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // 第 2 層：依屬性區分專屬爆破視覺
        if (ex.kind === "electric") {
          // 雷系：天頂劈下 0.20s 細亮雷柱 ＋ 地面金白十字電環
          if (prog < 0.60) {
            const bA = 1 - prog / 0.60;
            ctx.strokeStyle = `rgba(250, 204, 21, ${bA * 0.9})`;
            ctx.lineWidth = 10 * bA;
            ctx.beginPath();
            ctx.moveTo(0, -240);
            ctx.lineTo(-10, -150);
            ctx.lineTo(9, -70);
            ctx.lineTo(0, 0);
            ctx.stroke();

            ctx.strokeStyle = `rgba(255, 255, 255, ${bA})`;
            ctx.lineWidth = 3.8 * bA;
            ctx.stroke();
          }
          ctx.strokeStyle = `rgba(250, 204, 21, ${fade})`;
          ctx.lineWidth = Math.max(1.5, 5.5 * fade);
          ctx.beginPath();
          ctx.arc(0, 0, curR, 0, Math.PI * 2);
          ctx.stroke();
        } else if (ex.kind === "ice_water") {
          // 冰／水系：淺藍霜霧內暈 ＋ 加粗碧藍衝擊環 ＋ 六角冰晶放射碎片
          ctx.fillStyle = `rgba(56, 189, 248, ${fade * 0.22})`;
          ctx.beginPath();
          ctx.arc(0, 0, curR * 0.94, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = `rgba(56, 189, 248, ${fade})`;
          ctx.lineWidth = Math.max(2.2, 7.2 * fade);
          ctx.beginPath();
          ctx.arc(0, 0, curR, 0, Math.PI * 2);
          ctx.stroke();

          ctx.strokeStyle = `rgba(224, 242, 254, ${fade * 0.96})`;
          ctx.lineWidth = Math.max(1.5, 3.4 * fade);
          for (let k = 0; k < 6; k++) {
            const a = (k * Math.PI) / 3 + (ex.seed || 0);
            const r0 = ex.shape === "ring" ? (ex.innerRadius || 24) : curR * 0.30;
            ctx.beginPath();
            ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
            ctx.lineTo(Math.cos(a) * curR * 1.06, Math.sin(a) * curR * 1.06);
            ctx.stroke();
          }
        } else if (ex.kind === "psychic_ghost") {
          // 超能／幽靈系：暗紫內爆波 ＋ 粉白星芒環
          const inR = Math.max(6, r * (1.0 - prog * 0.72));
          ctx.fillStyle = `rgba(88, 28, 135, ${fade * 0.42})`;
          ctx.beginPath();
          ctx.arc(0, 0, inR, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = `rgba(192, 132, 252, ${fade})`;
          ctx.lineWidth = Math.max(1.8, 5.2 * fade);
          ctx.beginPath();
          ctx.arc(0, 0, curR, 0, Math.PI * 2);
          ctx.stroke();

          ctx.strokeStyle = `rgba(255, 255, 255, ${fade * 0.9})`;
          ctx.lineWidth = 2.0 * fade;
          ctx.beginPath();
          ctx.arc(0, 0, inR, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          // 火／岩系：焦黑地裂 ＋ 熾橘火環 ＋ 飛濺岩屑線
          ctx.fillStyle = `rgba(28, 10, 6, ${fade * 0.46})`;
          ctx.beginPath();
          ctx.ellipse(0, 4, curR * 0.85, curR * 0.46, 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = `rgba(239, 68, 68, ${fade})`;
          ctx.lineWidth = Math.max(2.0, 7.0 * fade);
          ctx.beginPath();
          ctx.arc(0, 0, curR, 0, Math.PI * 2);
          ctx.stroke();

          ctx.strokeStyle = `rgba(254, 240, 138, ${fade * 0.95})`;
          ctx.lineWidth = Math.max(1.4, 3.2 * fade);
          ctx.beginPath();
          ctx.arc(0, 0, curR * 0.78, 0, Math.PI * 2);
          ctx.stroke();

          // 5 條焦黑放射地裂線
          ctx.strokeStyle = `rgba(41, 16, 6, ${fade * 0.9})`;
          ctx.lineWidth = 2.6 * fade;
          for (let k = 0; k < 5; k++) {
            const a = (k * Math.PI * 2) / 5 + (ex.seed || 0);
            ctx.beginPath();
            ctx.moveTo(Math.cos(a) * 10, Math.sin(a) * 10);
            ctx.lineTo(Math.cos(a + 0.14) * curR * 0.55, Math.sin(a + 0.14) * curR * 0.55);
            ctx.lineTo(Math.cos(a) * curR * 0.92, Math.sin(a) * curR * 0.92);
            ctx.stroke();
          }
        }

        ctx.restore();
      });
    }
  },

  renderBossDeathAnims(ctx, toSx, toSy) {
    if (!this.bossDeathAnims || this.bossDeathAnims.length === 0) return;
    this.bossDeathAnims.forEach(ba => {
      const prog = Math.max(0, Math.min(1, ba.timer / ba.duration));
      const sx = toSx(ba.x), sy = toSy(ba.y);
      const jitterX = (Math.random() - 0.5) * (6 + prog * 14);
      const jitterY = (Math.random() - 0.5) * (6 + prog * 14);
      const scale = 1.0 + prog * 0.34;
      const sz = 120;
      const rec = ba.data ? SpriteCache.get(ba.data.forward_sprite) : null;

      ctx.save();
      ctx.translate(sx + jitterX, sy + jitterY);
      ctx.scale((ba.facingX > 0 ? -1 : 1) * scale, scale);
      ctx.globalAlpha = Math.max(0.15, 1 - prog * 0.72);
      if (rec && rec.loaded) {
        ctx.drawImage(rec.img, -sz / 2, -sz / 2, sz, sz);
        const flashOn = Math.floor(prog * 18) % 2 === 0;
        this.drawSilhouetteFlash(ctx, rec.img, -sz / 2, -sz / 2, sz, sz, flashOn ? "#FFFFFF" : "#FEF08A", 0.55 + prog * 0.45);
      }
      ctx.restore();

      // 爆裂擴散光環
      ctx.save();
      ctx.strokeStyle = ba.color;
      ctx.lineWidth = 4.5 * (1 - prog * 0.5);
      ctx.globalAlpha = 1 - prog;
      ctx.beginPath();
      ctx.arc(sx, sy, 38 + prog * 115, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    });
  },

  renderVictoryCeremonyOverlay(ctx, toSx, toSy) {
    const vc = this.victoryCeremony;
    if (!vc || !vc.active || !this.player) return;
    const px = toSx(this.player.x), py = toSy(this.player.y);
    const prog = Math.min(1, vc.timer / vc.duration);

    ctx.save();
    // 冠軍彩虹加冕光環
    const ringR = 44 + Math.sin(vc.timer * 6) * 8;
    const grad = ctx.createRadialGradient(px, py, 10, px, py, ringR + 48);
    grad.addColorStop(0, "rgba(254, 240, 138, 0.35)");
    grad.addColorStop(0.6, "rgba(244, 114, 182, 0.22)");
    grad.addColorStop(1, "rgba(56, 189, 248, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(px, py, ringR + 48, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#FACC15";
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.ellipse(px, py + 16, ringR, ringR * 0.36, 0, 0, Math.PI * 2);
    ctx.stroke();

    // 結尾 0.4 秒優雅金白柔光過渡至勝利結算面板
    if (prog > 0.82) {
      const flashA = Math.min(0.45, ((prog - 0.82) / 0.18) * 0.45);
      ctx.fillStyle = `rgba(254, 249, 195, ${flashA})`;
      ctx.fillRect(0, 0, this.width, this.height);
    }
    ctx.restore();
  },

  drawSilhouetteFlash(ctx, img, x, y, w, h, color = "#FFFFFF", alpha = 0.72, sx = 0, sy = 0, sw = 0, sh = 0) {
    if (!img) return;
    const silCan = (typeof SpriteCache !== "undefined" && SpriteCache.getSilhouette)
      ? SpriteCache.getSilhouette(img, color)
      : null;
    if (!silCan) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    if (sw > 0 && sh > 0) {
      const iw = img.naturalWidth || img.width || silCan.width;
      const ih = img.naturalHeight || img.height || silCan.height;
      const scaleX = silCan.width / iw;
      const scaleY = silCan.height / ih;
      ctx.drawImage(silCan, sx * scaleX, sy * scaleY, sw * scaleX, sh * scaleY, x, y, w, h);
    } else {
      ctx.drawImage(silCan, 0, 0, silCan.width, silCan.height, x, y, w, h);
    }
    ctx.restore();
  },

  renderCombat() {
    const ctx = this.ctx;
    const dpr = this.dpr || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, this.width, this.height);
    if (!this.player) return;

    let shakeX = 0, shakeY = 0;
    const shakePref = (this.saveData && this.saveData.settings && this.saveData.settings.screenShake) || "normal";
    if (this.camera.shakeTime > 0 && shakePref !== "off") {
      const shakeScale = shakePref === "low" ? 0.45 : 1.0;
      shakeX = (Math.random() - 0.5) * this.camera.shakeMagnitude * 2 * shakeScale;
      shakeY = (Math.random() - 0.5) * this.camera.shakeMagnitude * 2 * shakeScale;
    }
    const camX = this.camera.x + shakeX;
    const camY = this.camera.y + shakeY;
    const toSx = (wx) => wx - camX + this.width / 2;
    const toSy = (wy) => wy - camY + this.height / 2;

    // 進化／Mega／單階覺醒演出平滑鏡頭 Zoom-in 特寫 (動態聚焦主角實際螢幕座標，競技場半鎖定鏡頭同樣 100% 置中)
    let evoZoom = 1.0;
    let evoZoomDelta = this.isMobileDevice() ? 1.05 : 0.80;
    if (this.state === "EVOLVING" && this.evoSequence && this.evoSequence.active) {
      const seq = this.evoSequence;
      const et = seq.timer;
      const zoomInEnd = seq.isAwakening ? 0.28 : 0.35;
      const zoomOutStart = seq.isAwakening ? 0.90 : (seq.isMega ? 1.65 : 1.35);
      const zoomOutDur = Math.max(0.1, seq.duration - zoomOutStart);
      if (et < zoomInEnd) {
        const k = et / zoomInEnd;
        evoZoom = 1.0 + evoZoomDelta * (1 - Math.pow(1 - k, 3));
      } else if (et < zoomOutStart) {
        evoZoom = 1.0 + evoZoomDelta;
      } else {
        const k = Math.min(1, (et - zoomOutStart) / zoomOutDur);
        evoZoom = (1.0 + evoZoomDelta) - evoZoomDelta * (1 - Math.pow(1 - k, 3));
      }
    }

    ctx.save();
    if (evoZoom > 1.001) {
      const pSx = toSx(this.player.x);
      const pSy = toSy(this.player.y);
      const blend = Math.min(1, (evoZoom - 1.0) / Math.max(0.01, evoZoomDelta));
      const destX = pSx + (this.width / 2 - pSx) * blend;
      const destY = pSy + (this.height / 2 - pSy) * blend;
      ctx.translate(destX, destY);
      ctx.scale(evoZoom, evoZoom);
      ctx.translate(-pSx, -pSy);
    }

    MapEngine.renderBiomeWorld(ctx, camX, camY, this.width, this.height);

    // 收集當前正在蓄力放招的怪獸，供腳底壓迫氣環與微幅蓄力膨脹使用
    const castingOwners = new Set();
    const tgNow = performance.now() * 0.008;

    this.telegraphs.forEach(tg => {
      if (tg.owner && tg.owner.hp > 0 && !tg.isBossWarning) castingOwners.add(tg.owner);
      const pct = Math.max(0, Math.min(1, 1 - (tg.timer / (tg.maxTime || 0.8))));
      const isFinalFlash = (tg.timer <= 0.12 && !tg.isBossWarning);
      ctx.save();

      if (tg.shape === "line") {
        // 【戰術箭頭衝鋒跑道 (Chevron Lane)】：雙側亮紅軌道線 ＋ 前端尖頭 ＋ 3 組滾動 >>> 警示箭頭 ＋ 前推充能帶
        const ssx = toSx(tg.startX), ssy = toSy(tg.startY);
        const halfW = (tg.width || 40) * 0.5;
        const len = tg.length || 260;
        const tipExt = Math.min(26, halfW * 1.05);
        ctx.translate(ssx, ssy);
        ctx.rotate(tg.angle);

        // 1. 漸層紅底跑道（前端微尖破空輪廓）
        const laneGrad = ctx.createLinearGradient(0, 0, len + tipExt, 0);
        laneGrad.addColorStop(0, "rgba(220, 38, 38, 0.16)");
        laneGrad.addColorStop(0.85, "rgba(239, 68, 68, 0.28)");
        laneGrad.addColorStop(1, "rgba(248, 113, 113, 0.10)");
        ctx.fillStyle = laneGrad;
        ctx.beginPath();
        ctx.moveTo(0, -halfW);
        ctx.lineTo(len, -halfW);
        ctx.lineTo(len + tipExt, 0);
        ctx.lineTo(len, halfW);
        ctx.lineTo(0, halfW);
        ctx.closePath();
        ctx.fill();

        // 2. 前推充能紅金掃描帶
        const fillLen = len * pct;
        const chargeGrad = ctx.createLinearGradient(0, 0, Math.max(12, fillLen), 0);
        chargeGrad.addColorStop(0, "rgba(239, 68, 68, 0.18)");
        chargeGrad.addColorStop(0.82, isFinalFlash ? "rgba(255, 255, 255, 0.58)" : "rgba(249, 115, 22, 0.45)");
        chargeGrad.addColorStop(1, "rgba(254, 240, 138, 0.78)");
        ctx.fillStyle = chargeGrad;
        ctx.fillRect(0, -halfW, fillLen, tg.width);

        // 3. 兩側高對比亮紅軌道線 ＋ 前端尖頭描邊（去除了生硬的左右封閉盒框）
        ctx.strokeStyle = isFinalFlash ? "#FFFFFF" : "#F43F5E";
        ctx.lineWidth = isFinalFlash ? 3.2 : 2.4;
        ctx.beginPath();
        ctx.moveTo(0, -halfW);
        ctx.lineTo(len, -halfW);
        ctx.lineTo(len + tipExt, 0);
        ctx.lineTo(len, halfW);
        ctx.lineTo(0, halfW);
        ctx.stroke();

        // 4. 內部 3 組不斷向前滾動的 >>> 動態方向箭頭
        const chevSpacing = len / 3;
        const scrollOff = ((tgNow * 22) % chevSpacing);
        ctx.strokeStyle = isFinalFlash ? "#FFFFFF" : "rgba(254, 240, 138, 0.88)";
        ctx.lineWidth = 2.6;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        for (let c = 0; c < 3; c++) {
          const cx = scrollOff + c * chevSpacing;
          if (cx < 10 || cx > len - 6) continue;
          const ch = halfW * 0.58;
          ctx.beginPath();
          ctx.moveTo(cx - 10, -ch);
          ctx.lineTo(cx + 4, 0);
          ctx.lineTo(cx - 10, ch);
          ctx.stroke();
        }
      } else if (tg.shape === "ring") {
        // 【甜甜圈危險帶 ＋ 清晰安全眼】：evenodd 填滿危險環、內圈淺色虛線標示安全貼臉區、由內向外充能
        const sx = toSx(tg.x), sy = toSy(tg.y);
        const inR = tg.innerRadius || 42;
        const outR = tg.radius || 145;
        const curFillR = inR + (outR - inR) * pct;

        // 1. 靜態半透明紅危環帶
        ctx.fillStyle = "rgba(239, 68, 68, 0.18)";
        ctx.beginPath();
        ctx.arc(sx, sy, outR, 0, Math.PI * 2);
        ctx.arc(sx, sy, inR, 0, Math.PI * 2, true);
        ctx.fill("evenodd");

        // 2. 由內向外擴張的充能危險帶
        ctx.fillStyle = isFinalFlash ? "rgba(255, 255, 255, 0.42)" : "rgba(239, 68, 68, 0.34)";
        ctx.beginPath();
        ctx.arc(sx, sy, curFillR, 0, Math.PI * 2);
        ctx.arc(sx, sy, inR, 0, Math.PI * 2, true);
        ctx.fill("evenodd");

        // 3. 外邊界框線（最後 0.12s 爆閃亮白）
        ctx.strokeStyle = isFinalFlash ? "#FFFFFF" : (tg.color || "#EF4444");
        ctx.lineWidth = isFinalFlash ? 3.5 : 2.6;
        ctx.beginPath();
        ctx.arc(sx, sy, outR, 0, Math.PI * 2);
        ctx.stroke();

        // 4. 內圓安全眼虛線邊界
        ctx.strokeStyle = "rgba(224, 242, 254, 0.90)";
        ctx.lineWidth = 2.0;
        ctx.setLineDash([6, 5]);
        ctx.beginPath();
        ctx.arc(sx, sy, inR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (tg.isBossWarning) {
        const sx = toSx(tg.x), sy = toSy(tg.y);
        const curR = tg.radius * pct;

        ctx.fillStyle = "rgba(239, 68, 68, 0.18)";
        ctx.beginPath();
        ctx.arc(sx, sy, tg.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "rgba(239, 68, 68, 0.28)";
        ctx.beginPath();
        ctx.arc(sx, sy, curR, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "#EF4444";
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(sx, sy, tg.radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.font = "900 12px 'Noto Sans TC', sans-serif";
        ctx.textAlign = "center";
        ctx.fillStyle = "#FDE047";
        ctx.strokeStyle = "#0F172A";
        ctx.lineWidth = 3;
        ctx.strokeText(`⚠️ DANGER: ${tg.timer.toFixed(1)}s`, sx, sy + 4);
        ctx.fillText(`⚠️ DANGER: ${tg.timer.toFixed(1)}s`, sx, sy + 4);
      } else {
        // 【圓形紅圈預警】：反轉為「由內向外充能填滿」＋ 最後 0.12s 外框爆閃亮白
        const sx = toSx(tg.x), sy = toSy(tg.y);
        const baseFill = tg.isSuction ? "rgba(168, 85, 247, 0.16)" : "rgba(239, 68, 68, 0.14)";
        const chargeFill = isFinalFlash
          ? "rgba(255, 255, 255, 0.45)"
          : (tg.isSuction ? "rgba(192, 132, 252, 0.36)" : "rgba(239, 68, 68, 0.34)");

        ctx.fillStyle = baseFill;
        ctx.beginPath();
        ctx.arc(sx, sy, tg.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = chargeFill;
        ctx.beginPath();
        ctx.arc(sx, sy, Math.max(4, tg.radius * pct), 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = isFinalFlash ? "#FFFFFF" : (tg.color || "#EF4444");
        ctx.lineWidth = isFinalFlash ? 3.5 : 2.6;
        ctx.beginPath();
        ctx.arc(sx, sy, tg.radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(sx, sy, Math.max(4, tg.radius * pct), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    });

    // 繪製正在蓄力放招怪獸的腳底壓迫聚氣環（Casting Aura）
    castingOwners.forEach(owner => {
      const osx = toSx(owner.x), osy = toSy(owner.y);
      const sz = owner.isBoss ? 120 : 88;
      const pulse = Math.sin(tgNow * 2.4) * 5;
      ctx.save();
      ctx.strokeStyle = "#F43F5E";
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.ellipse(osx, osy + sz * 0.35, sz * 0.42 + pulse, sz * 0.18 + pulse * 0.4, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = "#FEF08A";
      ctx.lineWidth = 1.8;
      ctx.setLineDash([7, 5]);
      ctx.beginPath();
      ctx.ellipse(osx, osy + sz * 0.35, sz * 0.52 - pulse * 0.5, sz * 0.22 - pulse * 0.2, 0, tgNow, tgNow + Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    });

    // 圖層 1：地面底層技能與領域特效 (renderGroundLayer) — 繪製於所有寶可夢與訓練家腳下
    SkillsEngine.renderGroundLayer(ctx, toSx, toSy);

    // v7.8.1 關都 Mega 試煉塔實體場景物件渲染（傳送門 ／ 營火 ／ 遺物水晶 ／ 雙寶箱）
    if (this.isTowerMode && typeof ModeTower !== "undefined" && ModeTower.renderGroundEntities) {
      ModeTower.renderGroundEntities(this, ctx, toSx, toSy);
    }

    // v7.7.0 突發事件戰場實體渲染（信標佔領圈 ／ 空投補給箱 ／ 真假雙寶箱）
    if (this.activeFieldEvent && Array.isArray(this.activeFieldEvent.nodes) && this.activeFieldEvent.nodes.length > 0) {
      const ev = this.activeFieldEvent;
      const nowT = performance.now() * 0.004;
      ev.nodes.forEach(nd => {
        if (nd.opened) return;
        const nsx = toSx(nd.x), nsy = toSy(nd.y);
        ctx.save();
        if (nd.kind === "beacon") {
          const prog = Math.max(0, Math.min(1, (ev.progress || 0) / (ev.targetProgress || 5)));
          const pulse = 1 + Math.sin(nowT * 2.2) * 0.04;
          ctx.fillStyle = "rgba(56, 189, 248, 0.16)";
          ctx.beginPath(); ctx.arc(nsx, nsy, nd.radius * pulse, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = "rgba(125, 211, 252, 0.85)";
          ctx.lineWidth = 3;
          ctx.setLineDash([10, 6]);
          ctx.beginPath(); ctx.arc(nsx, nsy, nd.radius, 0, Math.PI * 2); ctx.stroke();
          ctx.setLineDash([]);
          if (prog > 0) {
            ctx.strokeStyle = "#FACC15";
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.arc(nsx, nsy, nd.radius + 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * prog);
            ctx.stroke();
          }
          ctx.fillStyle = "#0F172A";
          ctx.strokeStyle = "#38BDF8";
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(nsx, nsy, 14, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          ctx.fillStyle = "#FEF08A";
          ctx.font = "900 10px 'Noto Sans TC', sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(prog > 0 ? `${Math.round(prog * 100)}%` : "站入", nsx, nsy + 4);
        } else {
          const bob = Math.sin(nowT * 2.4) * 3.5;
          const isDrop = nd.kind === "airdrop";
          const col = isDrop ? "#FACC15" : "#C084FC";
          ctx.fillStyle = isDrop ? "rgba(250, 204, 21, 0.22)" : "rgba(192, 132, 252, 0.22)";
          ctx.beginPath(); ctx.arc(nsx, nsy, 28, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = col;
          ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.arc(nsx, nsy, 22, 0, Math.PI * 2); ctx.stroke();
          const uiRec = (typeof FieldEventsEngine !== "undefined") ? SpriteCache.get(FieldEventsEngine.UI_SHEET_URL) : null;
          const sr = (typeof FieldEventsEngine !== "undefined") ? FieldEventsEngine.getIconSrcRect(isDrop ? "rocket_airdrop" : "ditto_chests") : null;
          if (uiRec && uiRec.loaded && sr) {
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(uiRec.img, sr.x, sr.y, sr.w, sr.h, nsx - 18, nsy - 18 + bob, 36, 36);
          } else {
            ctx.fillStyle = isDrop ? "#D97706" : "#7E22CE";
            ctx.strokeStyle = "#0F172A";
            ctx.lineWidth = 2;
            ctx.fillRect(nsx - 13, nsy - 11 + bob, 26, 20);
            ctx.strokeRect(nsx - 13, nsy - 11 + bob, 26, 20);
          }
        }
        ctx.restore();
      });
    }

    // 戰場限時增益道具渲染（大遠征與 8 分鐘共用：像素道具圖標 ＋ 柔和光暈 ＋ 倒數環，最後 3 秒閃爍，無雜亂大字）
    if (this.fieldPowerups && this.fieldPowerups.length > 0) {
      this.fieldPowerups.forEach(pu => {
        if (pu.life < 3.0 && Math.floor(pu.life * 8) % 2 === 0) return;
        const psx = toSx(pu.x), psy = toSy(pu.y);
        const bobY = Math.sin(pu.bob || 0) * 4;
        const pct = Math.max(0, Math.min(1, pu.life / (pu.maxLife || 14.0)));
        ctx.save();
        const halo = ctx.createRadialGradient(psx, psy + bobY, 4, psx, psy + bobY, 26);
        halo.addColorStop(0, `${pu.color}55`);
        halo.addColorStop(1, `${pu.color}00`);
        ctx.fillStyle = halo;
        ctx.beginPath(); ctx.arc(psx, psy + bobY, 26, 0, Math.PI * 2); ctx.fill();

        ctx.strokeStyle = "rgba(15, 23, 42, 0.72)";
        ctx.lineWidth = 3.5;
        ctx.beginPath(); ctx.arc(psx, psy + bobY, 17, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = pu.color;
        ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.arc(psx, psy + bobY, 17, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct); ctx.stroke();

        ctx.fillStyle = "rgba(15, 23, 42, 0.88)";
        ctx.beginPath(); ctx.arc(psx, psy + bobY, 14, 0, Math.PI * 2); ctx.fill();
        const rec = pu.sprite ? SpriteCache.get(pu.sprite) : null;
        if (rec && rec.loaded) {
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(rec.img, psx - 11, psy + bobY - 11, 22, 22);
        }
        ctx.restore();
      });
    }

    // 1vs1 鬥技場臨時戰術道具渲染（光柱 ＋ 倒數環 ＋ 圖示標籤）
    if (this.isArenaMode && this.arenaPowerups && this.arenaPowerups.length > 0) {
      this.arenaPowerups.forEach(pu => {
        const psx = toSx(pu.x), psy = toSy(pu.y);
        const bobY = Math.sin(pu.bob || 0) * 4;
        const pct = Math.max(0, Math.min(1, pu.life / (pu.maxLife || 10.0)));
        ctx.save();
        // 垂直淡光柱
        const beamGrad = ctx.createLinearGradient(psx, psy, psx, psy - 64);
        beamGrad.addColorStop(0, `${pu.color}55`);
        beamGrad.addColorStop(1, `${pu.color}00`);
        ctx.fillStyle = beamGrad;
        ctx.fillRect(psx - 14, psy - 64, 28, 64);

        // 地面倒數環
        ctx.strokeStyle = "rgba(15, 23, 42, 0.75)";
        ctx.lineWidth = 4.5;
        ctx.beginPath(); ctx.arc(psx, psy + bobY, 19, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = pu.color;
        ctx.lineWidth = 3.0;
        ctx.beginPath(); ctx.arc(psx, psy + bobY, 19, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct); ctx.stroke();

        // 實心深底圓牌與圖示
        ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
        ctx.beginPath(); ctx.arc(psx, psy + bobY, 16, 0, Math.PI * 2); ctx.fill();
        ctx.font = "900 16px 'Noto Sans TC', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(pu.icon, psx, psy + bobY + 1);

        // 下方名稱標籤
        ctx.font = "900 10px 'Noto Sans TC', sans-serif";
        ctx.strokeStyle = "#0F172A";
        ctx.lineWidth = 3;
        ctx.strokeText(pu.name, psx, psy + 28);
        ctx.fillStyle = pu.color;
        ctx.fillText(pu.name, psx, psy + 28);
        ctx.restore();
      });
    }

    // 繪製地面燃燒火焰（三層動態搖曳像素火簇 ＋ 超級噴火龍X 蒼藍冥炎聯動）
    const flameNow = performance.now() * 0.011;
    this.lavaFootprints.forEach(lf => {
      const lsx = toSx(lf.x), lsy = toSy(lf.y);
      if (lsx < -48 || lsx > this.width + 48 || lsy < -48 || lsy > this.height + 48) return;
      const lifeRatio = Math.max(0, Math.min(1, lf.life / (lf.maxLife || 2.0)));
      const fade = lifeRatio < 0.25 ? (lifeRatio / 0.25) : 1.0;
      const isBlue = !!lf.isMegaBlue;
      const r = lf.radius || 24;
      const seed = lf.seed || (lf.x * 0.13 + lf.y * 0.07);

      const lfSkillAlpha = (typeof SkillsEngine !== "undefined" && SkillsEngine.getLightProjectileAlpha)
        ? SkillsEngine.getLightProjectileAlpha()
        : 1.0;
      ctx.save();
      ctx.translate(lsx, lsy);
      ctx.globalAlpha = fade * 0.92 * lfSkillAlpha;

      // 第 1 層：地面焦黑炭化烙印（讓火焰真正「咬」在草地與石板上）
      ctx.fillStyle = isBlue ? "rgba(10, 18, 40, 0.56)" : "rgba(32, 14, 6, 0.52)";
      ctx.beginPath();
      ctx.ellipse(0, 2, r * 0.95, r * 0.44, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = isBlue ? "rgba(14, 165, 233, 0.28)" : "rgba(234, 88, 12, 0.30)";
      ctx.beginPath();
      ctx.ellipse(0, 1, r * 0.72, r * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();

      // 第 2 層：3～4 簇錯落動態搖曳淚滴火舌（外焰 -> 中焰 -> 亮芯）
      const tongues = r > 28
        ? [
            { ox: -r * 0.42, oy: 2, s: 0.95 },
            { ox: 0,         oy: -1, s: 1.25 },
            { ox: r * 0.42,  oy: 3, s: 0.92 },
            { ox: -r * 0.14, oy: 5, s: 0.85 }
          ]
        : [
            { ox: -r * 0.36, oy: 2, s: 0.85 },
            { ox: 0,         oy: -1, s: 1.08 },
            { ox: r * 0.36,  oy: 2, s: 0.82 }
          ];

      const outerCol = isBlue ? "#1D4ED8" : "#DC2626";
      const midCol   = isBlue ? "#0EA5E9" : "#F97316";
      const coreCol  = isBlue ? "#E0F2FE" : "#FEF08A";

      for (let t = 0; t < tongues.length; t++) {
        const tg = tongues[t];
        const phase = flameNow + seed + t * 2.1;
        const sway = Math.sin(phase) * 2.8;
        const h = (13.5 + Math.cos(phase * 1.35) * 2.6) * tg.s * (0.72 + 0.28 * lifeRatio);
        const w = 6.2 * tg.s;
        const bx = tg.ox;
        const by = tg.oy;

        // 外焰
        ctx.fillStyle = outerCol;
        ctx.beginPath();
        ctx.moveTo(bx - w, by);
        ctx.quadraticCurveTo(bx - w * 0.95, by - h * 0.55, bx + sway, by - h);
        ctx.quadraticCurveTo(bx + w * 0.95, by - h * 0.55, bx + w, by);
        ctx.quadraticCurveTo(bx, by + w * 0.45, bx - w, by);
        ctx.closePath();
        ctx.fill();

        // 中焰
        ctx.fillStyle = midCol;
        ctx.beginPath();
        ctx.moveTo(bx - w * 0.66, by - 0.5);
        ctx.quadraticCurveTo(bx - w * 0.6, by - h * 0.45, bx + sway * 0.72, by - h * 0.76);
        ctx.quadraticCurveTo(bx + w * 0.6, by - h * 0.45, bx + w * 0.66, by - 0.5);
        ctx.closePath();
        ctx.fill();

        // 熾亮火芯
        ctx.fillStyle = coreCol;
        ctx.beginPath();
        ctx.ellipse(bx + sway * 0.25, by - h * 0.24, w * 0.34, h * 0.20, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });

    const gemNow = performance.now() * 0.0052;
    let visibleUnmagGems = 0;
    let nearestGuideGem = null;
    let nearestGuideDistSq = Infinity;

    this.gems.forEach(g => {
      const sx = toSx(g.x), sy = toSy(g.y);
      if (sx < -20 || sx > this.width + 20 || sy < -20 || sy > this.height + 20) return;
      const s = g.size || 6.5;
      const phase = gemNow + g.x * 0.045 + g.y * 0.035;
      const bobY = Math.sin(phase) * 2.4;
      const shScale = 1 - Math.max(0, -bobY) * 0.05;

      if (this.player && sx > 36 && sx < this.width - 36 && sy > 76 && sy < this.height - 80) {
        if (!g.magnetized) visibleUnmagGems += 1;
        const dSq = (g.x - this.player.x) ** 2 + (g.y - this.player.y) ** 2;
        if (dSq < nearestGuideDistSq) {
          nearestGuideDistSq = dSq;
          nearestGuideGem = { sx, sy: sy + bobY, s };
        }
      }

      ctx.save();
      ctx.translate(sx, sy);

      // 地面陰影保持貼地，隨寶石懸浮高度微縮
      ctx.fillStyle = "rgba(15, 23, 42, 0.30)";
      ctx.beginPath();
      ctx.ellipse(0, s * 0.88, s * 0.65 * shScale, s * 0.28 * shScale, 0, 0, Math.PI * 2);
      ctx.fill();

      // 寶石本體輕微上下懸浮呼吸
      ctx.translate(0, bobY);

      ctx.fillStyle = g.color || "#0284C7";
      ctx.strokeStyle = "#0F172A";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.lineTo(s * 0.78, 0);
      ctx.lineTo(0, s);
      ctx.lineTo(-s * 0.78, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = g.innerColor || "#BAE6FD";
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.62);
      ctx.lineTo(s * 0.38, 0);
      ctx.lineTo(0, s * 0.35);
      ctx.lineTo(-s * 0.45, -s * 0.08);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.arc(-s * 0.18, -s * 0.32, s * 0.16, 0, Math.PI * 2);
      ctx.fill();

      // 偶發十字星芒閃光，自然提示為可拾取戰利品
      const glint = Math.sin(phase * 1.45);
      if (glint > 0.86) {
        const gs = ((glint - 0.86) / 0.14) * (s * 0.68);
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(-gs, -s * 0.35); ctx.lineTo(gs, -s * 0.35);
        ctx.moveTo(0, -s * 0.35 - gs); ctx.lineTo(0, -s * 0.35 + gs);
        ctx.stroke();
      }
      ctx.restore();
    });

    this.mapItems.forEach(it => {
      const sx = toSx(it.x);
      const sy = toSy(it.y);

      // 專屬繪製：GBA 火紅／葉綠預烘焙友好商店 (MapEngine.spritePropCache['poke_mart_pixel'] + 浮動 SHOP 標籤)
      if (it.id === "poke_mart") {
        ctx.save();
        const martCan = (typeof MapEngine !== "undefined" && MapEngine.spritePropCache)
          ? MapEngine.spritePropCache.get("poke_mart_pixel")
          : null;
        if (martCan) {
          ctx.drawImage(martCan, Math.round(sx - 38), Math.round(sy - 46));
        } else {
          ctx.fillStyle = "#0284C7";
          ctx.fillRect(sx - 20, sy - 16, 40, 32);
        }

        // 屋頂上方常駐浮動提示：【SHOP】亮金像素標籤
        const bounce = Math.sin(performance.now() * 0.005) * 3;
        const signY = sy - 42 + bounce;
        ctx.fillStyle = "#FDE047";
        ctx.strokeStyle = "#78350F";
        ctx.lineWidth = 1.8;
        ctx.fillRect(sx - 18, signY - 7, 36, 13);
        ctx.strokeRect(sx - 18, signY - 7, 36, 13);

        ctx.font = "900 8px 'Press Start 2P', monospace";
        ctx.textAlign = "center";
        ctx.fillStyle = "#1E293B";
        ctx.fillText("SHOP", sx, signY + 3);

        // 6. 玩家靠近範圍 (<75px) 時：繪製地面互動光圈與進度條
        const distToP = Math.hypot(this.player.x - it.x, this.player.y - it.y);
        if (distToP < 75) {
          ctx.strokeStyle = "rgba(56, 189, 248, 0.75)";
          ctx.lineWidth = 2.0;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.ellipse(sx, sy + 10, 42, 22, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);

          // 站定時的環形填充進度條
          if (it.standTimer > 0) {
            const fillPct = Math.min(1, it.standTimer / 0.35);
            ctx.strokeStyle = "#FDE047";
            ctx.lineWidth = 3.5;
            ctx.beginPath();
            ctx.arc(sx, sy + 10, 26, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * fillPct);
            ctx.stroke();
          }
        }
        ctx.restore();
      } else {
        // 其他常規掉落物 (磁鐵、糖果、寶箱、精靈球)
        const yOffset = Math.sin(it.bobPhase) * 4;
        const rec = SpriteCache.get(it.meta.sprite);
        ctx.save();
        ctx.fillStyle = "rgba(15,23,42,0.65)";
        ctx.strokeStyle = it.meta.color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(sx, sy + yOffset, 16, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        if (rec && rec.loaded) {
          ctx.drawImage(rec.img, sx - 12, sy + yOffset - 12, 24, 24);
        } else {
          ctx.fillStyle = it.meta.color || "#FACC15";
          ctx.beginPath();
          ctx.arc(sx, sy + yOffset, 7, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    });

    const p = this.player;
    const px = toSx(p.x), py = toSy(p.y);
    const pBob = Math.abs(Math.sin(p.walkBob)) * 4;
    const terrain = MapEngine.getTerrainModifierAt(p.x, p.y);
    const inWater = terrain.inWater;
    const inGrass = terrain.label.includes("草叢");

    // 1. 先繪製主角與隨行訓練家的地面光環、水波紋與戰術指標（屬於貼地層，永不遮擋任何角色腳部）
    if (this.trainerCompanion) {
      const tc = this.trainerCompanion;
      const tsx = toSx(tc.x), tsy = toSy(tc.y);
      const tTerrain = MapEngine.getTerrainModifierAt(tc.x, tc.y);
      ctx.save();
      if (tTerrain.inWater) {
        const waveCycle = (performance.now() * 0.005 + 1.2) % Math.PI;
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.8 - waveCycle / Math.PI})`;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.ellipse(tsx, tsy + 16, 15 + waveCycle * 7, 6 + waveCycle * 3, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        const tcLift = tc.walkBob > 0.01 ? Math.abs(Math.sin(tc.walkBob)) : 0;
        const shScale = 1 - tcLift * 0.16;
        ctx.fillStyle = `rgba(15, 23, 42, ${(0.32 - tcLift * 0.07).toFixed(2)})`;
        ctx.beginPath();
        ctx.ellipse(tsx, tsy + 18, 14 * shScale, 5.5 * shScale, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = tc.whiteFlashTimer > 0 ? "rgba(239, 68, 68, 0.95)" : "rgba(56, 189, 248, 0.45)";
      ctx.lineWidth = tc.whiteFlashTimer > 0 ? 3.0 : 1.6;
      ctx.beginPath();
      ctx.ellipse(tsx, tsy + 18, 13, 5.2, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    this.partners.forEach(pt => {
      const psx = toSx(pt.x), psy = toSy(pt.y);
      ctx.save();
      ctx.fillStyle = "rgba(236,72,153,0.28)";
      ctx.beginPath();
      ctx.ellipse(psx, psy + 16, 13, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    ctx.save();
    if (inWater) {
      const waveCycle = (performance.now() * 0.005) % Math.PI;
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.8 - waveCycle / Math.PI})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(px, py + 15, 16 + waveCycle * 8, 7 + waveCycle * 3.5, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = "rgba(15, 23, 42, 0.30)";
      ctx.beginPath();
      ctx.ellipse(px, py + 15, 14, 5.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    if (p.isTrainerBond) {
      ctx.strokeStyle = p.bondColor;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(px, py + 16, 20, 7.0, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (p.megaEvolved || p.id >= 10000) {
      const mNow = performance.now() * 0.006;
      const mPulse = Math.sin(mNow * 1.8) * 2.2;
      const isMVenu = (p.id === 10033);
      const isMBlas = (p.id === 10036);
      const isMGeng = (p.id === 10038);
      const isMGyar = (p.id === 10041);
      const isMAero = (p.id === 10042);
      const ringMain = isMVenu ? "#4ADE80" : (isMBlas ? "#0EA5E9" : (isMGeng ? "#C084FC" : (isMGyar ? "#F43F5E" : (isMAero ? "#F59E0B" : "#38BDF8"))));
      const ringInner = isMVenu ? "#F472B6" : (isMBlas ? "#FEF08A" : (isMGeng ? "#FB7185" : (isMGyar ? "#38BDF8" : (isMAero ? "#E9D5FF" : "#E0F2FE"))));
      const midGlow = isMVenu ? "rgba(34, 197, 94, 0.34)" : (isMBlas ? "rgba(2, 132, 199, 0.36)" : (isMGeng ? "rgba(168, 85, 247, 0.38)" : (isMGyar ? "rgba(225, 29, 72, 0.36)" : (isMAero ? "rgba(245, 158, 11, 0.34)" : "rgba(14, 165, 233, 0.34)"))));
      ctx.save();
      const mGrad = ctx.createRadialGradient(px, py + 16, 6, px, py + 16, 36 + mPulse);
      mGrad.addColorStop(0, "rgba(15, 23, 42, 0.62)");
      mGrad.addColorStop(0.55, midGlow);
      mGrad.addColorStop(1, "rgba(56, 189, 248, 0)");
      ctx.fillStyle = mGrad;
      ctx.beginPath();
      ctx.ellipse(px, py + 16, 36 + mPulse, 13.8 + mPulse * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "rgba(15, 23, 42, 0.85)";
      ctx.lineWidth = 4.2;
      ctx.beginPath();
      ctx.ellipse(px, py + 17, 31 + mPulse * 0.5, 11.4, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = ringMain;
      ctx.lineWidth = 2.4;
      ctx.setLineDash([10, 6]);
      ctx.lineDashOffset = -mNow * 12;
      ctx.beginPath();
      ctx.ellipse(px, py + 17, 31 + mPulse * 0.5, 11.4, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = ringInner;
      ctx.lineWidth = 1.6;
      ctx.setLineDash([6, 10]);
      ctx.lineDashOffset = mNow * 16;
      ctx.beginPath();
      ctx.ellipse(px, py + 17, 25, 9.2, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (Object.values(p.skills || {}).filter(s => s.evolved).length >= 2) {
      ctx.save();
      ctx.strokeStyle = "rgba(250, 204, 21, 0.9)";
      ctx.lineWidth = 2.2;
      ctx.setLineDash([7, 5]);
      ctx.beginPath();
      ctx.ellipse(px, py + 16, 25, 8.8, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (this.manualAimMode) {
      const aimAng = (p.vx || p.vy)
        ? Math.atan2(p.vy, p.vx)
        : (p.facingY !== 0 ? (p.facingY < 0 ? -Math.PI / 2 : Math.PI / 2) : (p.facingX >= 0 ? 0 : Math.PI));
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(aimAng);
      ctx.fillStyle = "rgba(56, 189, 248, 0.85)";
      ctx.strokeStyle = "#0F172A";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(42, 0);
      ctx.lineTo(30, -6);
      ctx.lineTo(33, 0);
      ctx.lineTo(30, 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    if (p.heldItems && p.heldItems["never_melt_ice"]) {
      const fNow = performance.now() * 0.0012;
      ctx.save();
      // 1. 中空極寒冰霧邊暈（圓心 0~74% 完全透明，絕不遮擋主角與敵方彈幕）
      const fGrad = ctx.createRadialGradient(px, py, 92, px, py, 127);
      fGrad.addColorStop(0, "rgba(56, 189, 248, 0.0)");
      fGrad.addColorStop(0.55, "rgba(103, 232, 249, 0.10)");
      fGrad.addColorStop(0.88, "rgba(186, 230, 253, 0.24)");
      fGrad.addColorStop(1, "rgba(224, 242, 254, 0.0)");
      ctx.fillStyle = fGrad;
      ctx.beginPath();
      ctx.arc(px, py, 127, 0, Math.PI * 2);
      ctx.fill();

      // 2. 外圈 12 邊形冰晶折射細框 ＋ 內圈逆向細微霜環
      ctx.strokeStyle = "rgba(186, 230, 253, 0.56)";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let k = 0; k < 12; k++) {
        const a = fNow * 0.35 + (k * Math.PI * 2) / 12;
        const rx = px + Math.cos(a) * 125;
        const ry = py + Math.sin(a) * 125;
        if (k === 0) ctx.moveTo(rx, ry); else ctx.lineTo(rx, ry);
      }
      ctx.closePath();
      ctx.stroke();

      ctx.strokeStyle = "rgba(56, 189, 248, 0.34)";
      ctx.lineWidth = 1.2;
      ctx.setLineDash([12, 14]);
      ctx.beginPath();
      ctx.arc(px, py, 117, -fNow * 0.6, -fNow * 0.6 + Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // 3. 6 枚雙色切面菱形冰晶沿 125px 邊界緩慢公轉
      for (let c = 0; c < 6; c++) {
        const ca = fNow * 0.75 + (c * Math.PI * 2) / 6;
        const cx = px + Math.cos(ca) * 125;
        const cy = py + Math.sin(ca) * 125;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(ca + Math.PI / 2);
        ctx.fillStyle = "#E0F2FE";
        ctx.beginPath();
        ctx.moveTo(0, -6.5); ctx.lineTo(4.2, 0); ctx.lineTo(0, 6.5);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#0284C7";
        ctx.beginPath();
        ctx.moveTo(0, -6.5); ctx.lineTo(-4.2, 0); ctx.lineTo(0, 6.5);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.moveTo(0, -6.5); ctx.lineTo(4.2, 0); ctx.lineTo(0, 6.5); ctx.lineTo(-4.2, 0);
        ctx.closePath(); ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    }

    if (p.xSpeedTimer > 0) {
      const spdNow = performance.now() * 0.01;
      ctx.save();
      ctx.strokeStyle = "rgba(56, 189, 248, 0.82)";
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.ellipse(px, py + 17, 24, 8, 0, -spdNow, -spdNow + Math.PI * 1.35);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();

    // 2. 單一 Batch 批次繪製全場可視敵人的腳底黑影 (1 次底層 GPU 呼叫)
    const visibleEnemies = [];
    ctx.save();
    ctx.fillStyle = "rgba(15, 23, 42, 0.32)";
    ctx.beginPath();
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      const esx = toSx(e.x), esy = toSy(e.y);
      if (esx < -90 || esx > this.width + 90 || esy < -90 || esy > this.height + 90) continue;
      const sz = e.isBoss ? 120 : (e.isElite || e.treasureType ? 88 : 64);
      e._esx = esx;
      e._esy = esy;
      e._sz = sz;
      visibleEnemies.push(e);
      const rx = sz * 0.32, ry = sz * 0.12, cy = esy + sz * 0.35;
      ctx.moveTo(esx + rx, cy);
      ctx.ellipse(esx, cy, rx, ry, 0, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.restore();

    // 精英小王腳底雙層頭目威壓底座 ＆ 神獸 Boss 二階段 Overdrive 狂暴光環（貼地層）
    visibleEnemies.forEach(e => {
      if (e.isTowerMegaBoss) {
        const esx = e._esx, esy = e._esy, sz = e._sz;
        const tRot = performance.now() * (e.overdriveTriggered ? 0.006 : 0.0025);
        const typeCol = (typeof TYPE_COLORS !== "undefined" && e.data && TYPE_COLORS[e.data.type1]) || "#38BDF8";
        ctx.save();
        ctx.translate(esx, esy + sz * 0.35);
        ctx.strokeStyle = e.overdriveTriggered ? "#EF4444" : typeCol;
        ctx.lineWidth = e.overdriveTriggered ? 3.5 : 2.8;
        ctx.beginPath(); ctx.ellipse(0, 0, sz * 0.48, sz * 0.21, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = "#FACC15";
        ctx.lineWidth = 2.0;
        ctx.setLineDash([7, 5]);
        ctx.lineDashOffset = -tRot * 28;
        ctx.beginPath(); ctx.ellipse(0, 0, sz * 0.38, sz * 0.16, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      } else if (e.isBoss && e.overdriveTriggered) {
        const esx = e._esx, esy = e._esy, sz = e._sz;
        const pulse = Math.sin(performance.now() * 0.01) * 4;
        ctx.save();
        ctx.strokeStyle = "rgba(239, 68, 68, 0.90)";
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.ellipse(esx, esy + sz * 0.35, sz * 0.44 + pulse, sz * 0.19 + pulse * 0.4, 0, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = "#FACC15";
        ctx.lineWidth = 2.0;
        ctx.setLineDash([8, 5]);
        ctx.beginPath();
        ctx.ellipse(esx, esy + sz * 0.35, sz * 0.36, sz * 0.15, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      } else if (e.isElite && !e.isBoss) {
        const esx = e._esx, esy = e._esy, sz = e._sz;
        ctx.save();
        ctx.strokeStyle = "rgba(239, 68, 68, 0.85)";
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.ellipse(esx, esy + sz * 0.35, sz * 0.40, sz * 0.17, 0, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = "rgba(250, 204, 21, 0.90)";
        ctx.lineWidth = 1.6;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.ellipse(esx, esy + sz * 0.35, sz * 0.33, sz * 0.13, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
    });

    const highDensityLOD = visibleEnemies.length > 90;

    // 3. P1 關鍵升級：建立 2.5D Y-Axis 深度排序佇列 (Y-Sorting Queue)
    // 依據每個實體腳底接觸地面的螢幕 Y 座標升序排列，徹底解決角色與怪獸上下交錯時的頭腳穿幫問題
    const renderQueue = [];

    if (this.trainerCompanion) {
      renderQueue.push({ kind: "trainer", sortY: toSy(this.trainerCompanion.y) + 18 });
    }
    this.partners.forEach(pt => {
      renderQueue.push({ kind: "partner", pt, sortY: toSy(pt.y) + 16 });
    });
    renderQueue.push({ kind: "player", sortY: py + 18 });
    for (let i = 0; i < visibleEnemies.length; i++) {
      const e = visibleEnemies[i];
      renderQueue.push({ kind: "enemy", e, sortY: e._esy + e._sz * 0.35 });
    }

    renderQueue.sort((a, b) => a.sortY - b.sortY);

    // 共用 GBA 像素草簇遮腿繪製器（與地圖高草叢 100% 畫風統一：深綠根部 + 三片搖曳像素草葉 + 亮綠葉尖）
    const drawPixelGrassOverlay = (worldX, worldY, rootY, spreadList) => {
      const gNow = performance.now() * 0.0016;
      spreadList.forEach(ox => {
        const sway = Math.round(Math.sin(gNow * 1.8 + (worldX + ox) * 0.05 + worldY * 0.05) * 2.0);
        ctx.fillStyle = "#0F2917";
        ctx.fillRect(ox - 5, rootY - 2, 10, 4);
        ctx.fillStyle = "#2E8540";
        ctx.fillRect(ox - 6 + sway, rootY - 8, 3, 7);
        ctx.fillRect(ox - 1 + sway, rootY - 10, 3, 9);
        ctx.fillRect(ox + 4 + sway, rootY - 8, 3, 7);
        ctx.fillStyle = "#74E068";
        ctx.fillRect(ox - 6 + sway, rootY - 9, 3, 2);
        ctx.fillRect(ox - 1 + sway, rootY - 11, 3, 2);
        ctx.fillRect(ox + 4 + sway, rootY - 9, 3, 2);
      });
    };

    // 共用 GBA 像素涉水吃水線與水花波紋繪製器（營造腰部以下真正泡在海水中的真實折射與白沫感）
    const drawPixelWaterlineFoam = (cutY, halfWidth, phaseOffset = 0) => {
      const wNow = performance.now() * 0.004 + phaseOffset;
      // 水面下微藍海水折射半透明遮罩邊
      ctx.fillStyle = "rgba(2, 132, 199, 0.55)";
      ctx.fillRect(-halfWidth, cutY - 3, halfWidth * 2, 4);
      // 貼合腰部切線的階梯狀跳動像素白沫水花
      ctx.fillStyle = "rgba(224, 242, 254, 0.92)";
      for (let wx = -halfWidth + 2; wx <= halfWidth - 6; wx += 8) {
        const wyOff = Math.round(Math.sin(wNow + wx * 0.25) * 1.2);
        ctx.fillRect(wx, cutY - 1 + wyOff, 5, 2);
      }
      ctx.fillStyle = "#BAE6FD";
      ctx.fillRect(-halfWidth + 5, cutY + 1, halfWidth * 2 - 10, 2);
    };

    // 定義各類實體的精確繪製函數（優先使用 GBA 3x4 行走精靈圖集 walkSheet，無圖集時自動降級至單張圖程序化步態）
    const drawTrainerEntity = () => {
      const tc = this.trainerCompanion;
      const tsx = toSx(tc.x), tsy = toSy(tc.y);
      const isMoving = tc.walkBob > 0.01;
      const tTerrain = MapEngine.getTerrainModifierAt(tc.x, tc.y);
      const tInWater = tTerrain.inWater && !tc.isJumpingLedge;
      const tInGrass = tTerrain.label.includes("草叢") && !tc.isJumpingLedge;

      const sheetRec = tc.walkSheet ? SpriteCache.get(tc.walkSheet) : null;
      if (sheetRec && sheetRec.loaded) {
        const img = sheetRec.img;
        const cellW = (img.naturalWidth || img.width || 384) / 3;
        const cellH = (img.naturalHeight || img.height || 512) / 4;

        // 3x4 格排列：Row 0=下(DOWN), 1=左(LEFT), 2=右(RIGHT), 3=上(UP)
        let row = 0;
        if (tc.facingY < 0) row = 3;
        else if (tc.facingY > 0) row = 0;
        else if (tc.facingX < 0) row = 1;
        else if (tc.facingX > 0) row = 2;

        // GBA 四方向統一俐落步態：配合重烘焙 13px 明顯抬腳圖集，上下/左右同步具備踏步彈跳、重心微傾與落地微壓縮
        const isVerticalWalk = (row === 0 || row === 3);
        const stepPhase = Math.floor(tc.walkBob * 0.78) % 4;
        const col = isMoving ? [0, 1, 2, 1][stepPhase] : 1;
        const sx = col * cellW;
        const sy = row * cellH;
        const drawW = 56, drawH = 56;

        const isStriding = isMoving && (col === 0 || col === 2);
        const stepLift = isStriding ? (isVerticalWalk ? -2.2 : -1.9) : 0;
        let stepTilt = 0;
        if (isMoving) {
          if (isVerticalWalk) {
            stepTilt = col === 0 ? -0.045 : (col === 2 ? 0.045 : 0);
          } else {
            // 左右奔跑微前傾衝刺動感
            const runLean = (row === 2 ? 0.036 : -0.036);
            stepTilt = isStriding ? runLean : (runLean * 0.35);
          }
        }
        const landSquashX = (isMoving && !isStriding) ? 1.032 : 1.0;
        const landSquashY = (isMoving && !isStriding) ? 0.968 : 1.0;

        ctx.save();
        ctx.imageSmoothingEnabled = false;

        if (tInWater) {
          const waterBob = isMoving ? Math.abs(Math.sin(tc.walkBob * 1.15)) * 1.6 : 0;
          ctx.translate(tsx, tsy - waterBob + (tc.jumpY || 0) + 14);
          ctx.save();
          if (stepTilt !== 0) ctx.rotate(stepTilt * 0.6);
          ctx.beginPath();
          ctx.rect(-28, -32, 56, 37);
          ctx.clip();
          ctx.drawImage(img, sx, sy, cellW, cellH, -28, -32, drawW, drawH);
          if (tc.whiteFlashTimer > 0) {
            this.drawSilhouetteFlash(ctx, img, -28, -32, drawW, drawH, "#FF6B4A", 0.70, sx, sy, cellW, cellH);
          }
          ctx.restore();
          drawPixelWaterlineFoam(5, 17, 1.2);
        } else {
          ctx.translate(tsx, tsy + 20 + stepLift + (tc.jumpY || 0));
          ctx.save();
          if (stepTilt !== 0) ctx.rotate(stepTilt);
          if (landSquashX !== 1.0) ctx.scale(landSquashX, landSquashY);
          ctx.drawImage(img, sx, sy, cellW, cellH, -drawW / 2, -drawH, drawW, drawH);
          if (tc.whiteFlashTimer > 0) {
            this.drawSilhouetteFlash(ctx, img, -drawW / 2, -drawH, drawW, drawH, "#FF6B4A", 0.70, sx, sy, cellW, cellH);
          }
          ctx.restore();
          if (tInGrass) {
            drawPixelGrassOverlay(tc.x, tc.y, 2 - stepLift, [-12, 0, 12]);
          }
        }
        ctx.restore();
        return;
      }

      // 降級備援：單張 PNG 程序化步態
      const phase = tc.walkBob;
      const stepSin = isMoving ? Math.sin(phase) : 0;
      const stepAbs = isMoving ? Math.abs(stepSin) : 0;
      const bob = isMoving ? stepAbs * (tc.isJumpingLedge ? 1.5 : (tInWater ? 1.4 : 2.8)) : 0;
      const footTilt = isMoving ? stepSin * (tInWater ? 0.032 : 0.062) : 0;
      const squashY = isMoving ? (1 - Math.abs(Math.cos(phase)) * 0.04) : 1.0;
      const squashX = isMoving ? (1 + Math.abs(Math.cos(phase)) * 0.025) : 1.0;

      let activeUrl = tc.sprite;
      let needFlip = false;
      if (tc.sprites) {
        if (tc.facingY < 0) activeUrl = tc.sprites.up;
        else if (tc.facingY > 0) activeUrl = tc.sprites.down;
        else if (tc.facingX < 0) activeUrl = tc.sprites.left;
        else activeUrl = tc.sprites.right;
      } else {
        needFlip = tc.facingX > 0;
      }
      const tRec = SpriteCache.get(activeUrl);

      ctx.save();
      const isHiResTrainer = !!(tRec && tRec.loaded && (tRec.img.naturalWidth || tRec.img.width || 0) > 160);
      ctx.imageSmoothingEnabled = isHiResTrainer;
      if (isHiResTrainer) ctx.imageSmoothingQuality = "high";

      if (tRec && tRec.loaded) {
        const img = tRec.img;
        const srcW = img.naturalWidth || img.width || 56;
        const srcH = img.naturalHeight || img.height || 56;

        if (tInWater) {
          ctx.translate(tsx, tsy - bob + (tc.jumpY || 0) + 14);
          if (footTilt !== 0) ctx.rotate(footTilt);
          ctx.scale((needFlip ? -1 : 1) * squashX, squashY);
          ctx.save();
          ctx.beginPath();
          ctx.rect(-28, -32, 56, 37);
          ctx.clip();
          ctx.drawImage(img, -28, -32, 56, 56);
          if (tc.whiteFlashTimer > 0) {
            this.drawSilhouetteFlash(ctx, img, -28, -32, 56, 56, "#FF6B4A", 0.70);
          }
          ctx.restore();
          drawPixelWaterlineFoam(5, 17, 1.2);
        } else {
          ctx.translate(tsx, tsy + 20 - bob + (tc.jumpY || 0));
          ctx.scale(needFlip ? -1 : 1, 1);

          const drawW = 56, drawH = 56;
          const splitRatio = 0.68;
          const srcTopH = Math.round(srcH * splitRatio);
          const srcBotH = srcH - srcTopH;
          const dstTopH = drawH * splitRatio;
          const dstBotH = drawH - dstTopH;
          const topY = -drawH;

          const legSkew = isMoving ? stepSin * 0.14 : 0;
          const legLift = isMoving ? -stepAbs * 1.1 : 0;
          ctx.save();
          ctx.translate(0, -dstBotH + legLift);
          ctx.transform(1, 0, legSkew, squashY, 0, 0);
          ctx.drawImage(img, 0, srcTopH, srcW, srcBotH, -drawW / 2, 0, drawW, dstBotH);
          ctx.restore();

          ctx.save();
          if (footTilt !== 0) ctx.rotate(footTilt);
          ctx.scale(squashX, squashY);
          ctx.drawImage(img, 0, 0, srcW, srcTopH, -drawW / 2, topY, drawW, dstTopH + 0.8);
          if (tc.whiteFlashTimer > 0) {
            this.drawSilhouetteFlash(ctx, img, -drawW / 2, topY, drawW, drawH, "#FF6B4A", 0.70);
          }
          ctx.restore();

          if (tInGrass) {
            ctx.save();
            if (needFlip) ctx.scale(-1, 1);
            drawPixelGrassOverlay(tc.x, tc.y, 2, [-12, 0, 12]);
            ctx.restore();
          }
        }
      }
      ctx.restore();
    };

    const drawPartnerEntity = (pt) => {
      const psx = toSx(pt.x), psy = toSy(pt.y);
      const serenaStageOn = (this.selectedTrainer && this.selectedTrainer.id === "serena" && p.buffTimer > 0);
      if (serenaStageOn) {
        const sNow = performance.now() * 0.008;
        ctx.save();
        ctx.strokeStyle = "#F472B6";
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.ellipse(psx, psy + 15, 19 + Math.sin(sNow) * 2, 7.2, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = "#FEF08A";
        ctx.lineWidth = 1.4;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.ellipse(psx, psy + 15, 24, 9.0, 0, sNow, sNow + Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      const sprUrl = pt.facingY < 0 ? pt.data.back_sprite : pt.data.forward_sprite;
      const rec = SpriteCache.get(sprUrl);
      if (rec && rec.loaded) {
        ctx.save();
        ctx.translate(psx, psy);
        if (pt.facingX > 0) ctx.scale(-1, 1);
        ctx.drawImage(rec.img, -20, -20, 40, 40);
        ctx.restore();
      }
    };

    const drawPlayerEntity = () => {
      ctx.save();
      if (p.id === 149 || (p.id >= 144 && p.id <= 151)) {
        if (p.multiscaleReady) {
          const crownNow = performance.now() * 0.0035;
          const isLegend = p.id >= 144 && p.id !== 149;
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(crownNow);
          ctx.strokeStyle = isLegend ? "rgba(244, 114, 182, 0.88)" : "rgba(250, 204, 21, 0.85)";
          ctx.fillStyle = isLegend ? "rgba(244, 114, 182, 0.10)" : "rgba(250, 204, 21, 0.08)";
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          for (let k = 0; k < 6; k++) {
            const a = (k * Math.PI) / 3;
            const rx = Math.cos(a) * 31, ry = Math.sin(a) * 31;
            if (k === 0) ctx.moveTo(rx, ry);
            else ctx.lineTo(rx, ry);
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = "#FEF08A";
          for (let k = 0; k < 3; k++) {
            const a = (k * Math.PI * 2) / 3;
            ctx.beginPath();
            ctx.arc(Math.cos(a) * 31, Math.sin(a) * 31, 2.5, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        } else {
          const chargePct = Math.max(0, 1 - (p.multiscaleTimer || 0) / 10.0);
          ctx.save();
          ctx.strokeStyle = "rgba(250, 204, 21, 0.45)";
          ctx.lineWidth = 2.0;
          ctx.beginPath();
          ctx.arc(px, py + 14, 24, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * chargePct, false);
          ctx.stroke();
          ctx.restore();
        }
      }

      if (p.shieldTimer > 0) {
        const shieldPct = p.shieldTimer / (p.maxShieldTimer || 5.5);
        const blinkAlpha = p.shieldTimer < 1.2 ? (0.45 + Math.abs(Math.sin(performance.now() * 0.02)) * 0.55) : 1.0;
        ctx.save();
        ctx.globalAlpha = blinkAlpha;

        // 1. 半透明六角蜂巢琥珀岩盾結界 + 剩餘時間倒數外環
        ctx.fillStyle = "rgba(217, 119, 6, 0.14)";
        ctx.strokeStyle = "rgba(245, 158, 11, 0.72)";
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        for (let h = 0; h < 6; h++) {
          const ha = (h * Math.PI) / 3 - Math.PI / 6;
          const hx = px + Math.cos(ha) * 34;
          const hy = py + Math.sin(ha) * 34;
          if (h === 0) ctx.moveTo(hx, hy); else ctx.lineTo(hx, hy);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = "#FACC15";
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.arc(px, py, 37, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * shieldPct, false);
        ctx.stroke();

        // 2. 結界正上方像素盾牌徽記
        const shX = px, shY = py - 42;
        ctx.fillStyle = "#B45309";
        ctx.strokeStyle = "#FEF08A";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(shX, shY - 7);
        ctx.lineTo(shX + 7, shY - 4);
        ctx.lineTo(shX + 6, shY + 3);
        ctx.lineTo(shX, shY + 8);
        ctx.lineTo(shX - 6, shY + 3);
        ctx.lineTo(shX - 7, shY - 4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 3. 6 塊 3D 雙色切面像素巨岩高速公轉（半徑 56px）
        const orbitA = p.brockRockOrbitAngle || (performance.now() * 0.0042);
        const orbitR = 56;
        for (let rIdx = 0; rIdx < 6; rIdx++) {
          const a = orbitA + (rIdx * Math.PI * 2) / 6;
          const rx = px + Math.cos(a) * orbitR;
          const ry = py + Math.sin(a) * orbitR;
          ctx.save();
          ctx.translate(rx, ry);
          ctx.rotate(a * 1.5);
          // 右背光深褐岩面
          ctx.fillStyle = "#78350F";
          ctx.strokeStyle = "#1C0D06";
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(0, -9); ctx.lineTo(8, -2); ctx.lineTo(5, 8); ctx.lineTo(-2, 7);
          ctx.closePath(); ctx.fill(); ctx.stroke();
          // 左受光琥珀金岩面
          ctx.fillStyle = "#D97706";
          ctx.beginPath();
          ctx.moveTo(0, -9); ctx.lineTo(-8, -2); ctx.lineTo(-6, 6); ctx.lineTo(-2, 7); ctx.lineTo(1, -1);
          ctx.closePath(); ctx.fill(); ctx.stroke();
          // 岩稜微金高光
          ctx.fillStyle = "#FDE68A";
          ctx.fillRect(-3, -5, 3, 2);
          ctx.restore();
        }
        ctx.restore();
      }

      if (p.lillieSanctuaryTimer > 0) {
        // 【莉莉艾・星之祈願治癒結界】：2 秒無敵期柔和淡金綠半透明結界 ＋ 旋轉星十字
        const lPct = p.lillieSanctuaryTimer / (p.maxLillieSanctuaryTimer || 2.0);
        const lNow = performance.now() * 0.004;
        const lFade = p.lillieSanctuaryTimer < 0.35 ? (p.lillieSanctuaryTimer / 0.35) : 1.0;
        ctx.save();
        ctx.globalAlpha = lFade;
        const lGrad = ctx.createRadialGradient(px, py, 8, px, py, 34);
        lGrad.addColorStop(0, "rgba(254, 249, 195, 0.06)");
        lGrad.addColorStop(0.65, "rgba(110, 231, 183, 0.22)");
        lGrad.addColorStop(1, "rgba(52, 211, 153, 0.0)");
        ctx.fillStyle = lGrad;
        ctx.beginPath();
        ctx.arc(px, py, 34, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "rgba(110, 231, 183, 0.88)";
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(px, py, 31, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * lPct, false);
        ctx.stroke();

        // 4 枚細小星十字繞結界公轉
        for (let k = 0; k < 4; k++) {
          const sa = lNow + (k * Math.PI) / 2;
          const sx = px + Math.cos(sa) * 31;
          const sy = py + Math.sin(sa) * 31;
          ctx.strokeStyle = k % 2 === 0 ? "#FEF08A" : "#FFFFFF";
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(sx - 3.5, sy); ctx.lineTo(sx + 3.5, sy);
          ctx.moveTo(sx, sy - 3.5); ctx.lineTo(sx, sy + 3.5);
          ctx.stroke();
        }
        ctx.restore();
      }

      if (p.buffTimer > 0) {
        const buffPct = p.buffTimer / p.maxBuffTimer;
        if (this.selectedTrainer && this.selectedTrainer.id === "red") {
          // 【赤紅・冠軍霸氣深紅金焰光環】：與小智一般黃環拉開視覺階級
          const rNow = performance.now() * 0.006;
          ctx.save();
          const rGrad = ctx.createRadialGradient(px, py + 14, 10, px, py + 14, 34);
          rGrad.addColorStop(0, "rgba(220, 38, 38, 0.0)");
          rGrad.addColorStop(0.6, "rgba(220, 38, 38, 0.24)");
          rGrad.addColorStop(1, "rgba(250, 204, 21, 0.0)");
          ctx.fillStyle = rGrad;
          ctx.beginPath();
          ctx.ellipse(px, py + 15, 34, 12.5, 0, 0, Math.PI * 2);
          ctx.fill();

          // 外圈深紅倒數弧
          ctx.strokeStyle = "rgba(239, 68, 68, 0.92)";
          ctx.lineWidth = 3.8;
          ctx.beginPath();
          ctx.arc(px, py + 12, 28, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * buffPct, false);
          ctx.stroke();

          // 內圈旋轉耀金細虛線
          ctx.strokeStyle = "rgba(254, 240, 138, 0.90)";
          ctx.lineWidth = 1.8;
          ctx.setLineDash([7, 5]);
          ctx.lineDashOffset = -rNow * 14;
          ctx.beginPath();
          ctx.ellipse(px, py + 15, 29, 10.5, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        } else if (this.selectedTrainer && this.selectedTrainer.id === "ash") {
          // 【小智・就決定是你了！6秒命運羈絆雙層金紅疾風環 ＋ 訓練家⇄精靈羈絆電光連線（中空不遮敵彈）】
          const aNow = performance.now() * 0.007;
          ctx.save();

          // 1. 訓練家 ⇄ 寶可夢「命運羈絆電光連線」
          if (this.trainerCompanion) {
            const tc = this.trainerCompanion;
            const tx = toSx(tc.x), ty = toSy(tc.y) - 2;
            const dx = px - tx, dy = py - ty;
            const dist = Math.hypot(dx, dy);
            if (dist > 14 && dist < 340) {
              const ux = dx / dist, uy = dy / dist;
              const nx = -uy, ny = ux;
              ctx.save();
              ctx.globalCompositeOperation = "lighter";
              // 外層暖橘羈絆光流
              ctx.strokeStyle = "rgba(245, 158, 11, 0.58)";
              ctx.lineWidth = 4.2;
              ctx.lineCap = "round";
              ctx.beginPath();
              for (let s = 0; s <= 10; s++) {
                const frac = s / 10;
                const jag = (s === 0 || s === 10) ? 0 : Math.sin(aNow * 5 + s * 2.3) * 5.5;
                const bx = tx + dx * frac + nx * jag;
                const by = ty + dy * frac + ny * jag;
                if (s === 0) ctx.moveTo(bx, by); else ctx.lineTo(bx, by);
              }
              ctx.stroke();
              // 內層耀金純白電光芯
              ctx.strokeStyle = "#FEF08A";
              ctx.lineWidth = 1.8;
              ctx.stroke();
              ctx.restore();
            }
          }

          // 2. 腳底中空金紅熱血微暈
          const aGrad = ctx.createRadialGradient(px, py + 15, 14, px, py + 15, 34);
          aGrad.addColorStop(0, "rgba(245, 158, 11, 0.0)");
          aGrad.addColorStop(0.62, "rgba(239, 68, 68, 0.18)");
          aGrad.addColorStop(0.92, "rgba(250, 204, 21, 0.28)");
          aGrad.addColorStop(1, "rgba(250, 204, 21, 0.0)");
          ctx.fillStyle = aGrad;
          ctx.beginPath();
          ctx.ellipse(px, py + 15, 34, 12.5, 0, 0, Math.PI * 2);
          ctx.fill();

          // 3. 外圈耀金剩餘時間倒數環
          ctx.strokeStyle = "rgba(250, 204, 21, 0.92)";
          ctx.lineWidth = 3.4;
          ctx.beginPath();
          ctx.arc(px, py + 12, 27, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * buffPct, false);
          ctx.stroke();

          // 4. 雙層交錯逆向旋轉金紅疾風虛線環
          ctx.strokeStyle = "rgba(239, 68, 68, 0.88)";
          ctx.lineWidth = 2.0;
          ctx.setLineDash([8, 6]);
          ctx.lineDashOffset = -aNow * 18;
          ctx.beginPath();
          ctx.ellipse(px, py + 16, 30, 11, 0, 0, Math.PI * 2);
          ctx.stroke();

          ctx.strokeStyle = "rgba(254, 240, 138, 0.88)";
          ctx.lineWidth = 1.6;
          ctx.setLineDash([6, 8]);
          ctx.lineDashOffset = aNow * 22;
          ctx.beginPath();
          ctx.ellipse(px, py + 16, 23, 8.2, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        } else {
          ctx.strokeStyle = "rgba(245, 158, 11, 0.85)";
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.arc(px, py + 12, 26, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * buffPct, false);
          ctx.stroke();
        }
      }

      if (p.speedTrails && p.speedTrails.length > 0) {
        p.speedTrails.forEach(tr => {
          const tsx = toSx(tr.x), tsy = toSy(tr.y);
          const tUrl = tr.facingY < 0 ? p.data.back_sprite : p.data.forward_sprite;
          const tRec = SpriteCache.get(tUrl);
          if (tRec && tRec.loaded) {
            const alpha = Math.max(0, (tr.life / tr.maxLife) * (tr.isDash ? 0.52 : 0.38));
            ctx.save();
            ctx.translate(tsx, tsy + (inWater ? 10 : 0));
            if (tr.facingX > 0) ctx.scale(-1, 1);
            this.drawSilhouetteFlash(ctx, tRec.img, -26, -21, 52, 52, tr.isDash ? "#FDE047" : "#38BDF8", alpha);
            ctx.restore();
          }
        });
      }

      if (p.arenaShieldTimer > 0) {
        const shPct = Math.min(1, p.arenaShieldTimer / 8.0);
        ctx.save();
        ctx.fillStyle = "rgba(192, 132, 252, 0.14)";
        ctx.strokeStyle = "#C084FC";
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.arc(px, py, 32, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = "#E0F2FE";
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.arc(px, py, 35, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * shPct);
        ctx.stroke();
        ctx.restore();
      }

      if (p.xAttackTimer > 0 || p.arenaFuryTimer > 0) {
        const auraNow = performance.now() * 0.008;
        const pulseR = 24 + Math.sin(auraNow * 2.2) * 3.5;
        ctx.save();
        const atkGrad = ctx.createRadialGradient(px, py + 4, 6, px, py + 4, pulseR + 8);
        atkGrad.addColorStop(0, "rgba(239, 68, 68, 0.0)");
        atkGrad.addColorStop(0.55, "rgba(239, 68, 68, 0.28)");
        atkGrad.addColorStop(0.85, "rgba(250, 204, 21, 0.45)");
        atkGrad.addColorStop(1, "rgba(250, 204, 21, 0.0)");
        ctx.fillStyle = atkGrad;
        ctx.beginPath();
        ctx.arc(px, py + 4, pulseR + 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "rgba(254, 240, 138, 0.85)";
        ctx.lineWidth = 2.0;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.ellipse(px, py + 16, 22, 8.5, 0, auraNow, auraNow + Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      const recScale = (p.recoilTimer > 0) ? (p.recoilTimer / 0.11) : 0;
      const lungePhase = (p.lungeTimer > 0) ? Math.sin((1 - p.lungeTimer / (p.lungeMaxTime || 0.16)) * Math.PI) : 0;
      const lungeOffsetX = Math.cos(p.lungeAngle || 0) * (p.lungeDist || 0) * lungePhase;
      const lungeOffsetY = Math.sin(p.lungeAngle || 0) * (p.lungeDist || 0) * lungePhase;

      const visOffsetX = (p.recoilX || 0) * recScale + lungeOffsetX;
      const slamMaxT = p.slamHopMaxTime || 0.24;
      const slamH = p.slamHopHeight || 14;
      const slamProg = (p.slamHopTimer > 0) ? Math.max(0, Math.min(1, 1 - p.slamHopTimer / slamMaxT)) : 0;
      const slamHopY = (p.slamHopTimer > 0) ? (slamProg < 0.58 ? -Math.sin((slamProg / 0.58) * Math.PI) * slamH : Math.sin(((slamProg - 0.58) / 0.42) * Math.PI) * Math.min(8, slamH * 0.34)) : 0;
      const visOffsetY = (p.recoilY || 0) * recScale + slamHopY + lungeOffsetY;

      const stretchX = 1 + lungePhase * 0.16;
      const squashY = 1 - lungePhase * 0.10;

      const pSprUrl = p.facingY < 0 ? p.data.back_sprite : p.data.forward_sprite;
      // P0 關鍵優化：使用離線預烘焙閃光圖 (SpriteCache.getShiny)，徹底移除戰鬥循環內的 ctx.filter！
      const pRec = p.isShiny ? SpriteCache.getShiny(pSprUrl) : SpriteCache.get(pSprUrl);
      if (pRec && pRec.loaded) {
        if (p.invulnTimer > 0 && !(p.dashTimer > 0) && !(p.lungeTimer > 0)) {
          const blinkCycle = Math.floor(p.invulnTimer * 24) % 2;
          ctx.globalAlpha = blinkCycle === 0 ? 0.35 : 0.95;
        }

        const isHiResPoke = ((pRec.img.naturalWidth || pRec.img.width || 0) > 160);
        ctx.imageSmoothingEnabled = isHiResPoke;
        if (isHiResPoke) ctx.imageSmoothingQuality = "high";

        const isFlyingPoke = p.data && (p.data.type1 === "Flying" || p.data.type2 === "Flying" || [92, 93, 94, 150, 151].includes(p.id));
        const submergeWater = inWater && !isFlyingPoke && !p.isJumpingLedge;
        const submergeGrass = inGrass && !isFlyingPoke && !p.isJumpingLedge;

        const isMegaSprite = !!(p.megaEvolved || p.id >= 10000);
        const awakenScale = isMegaSprite ? 1.38 : (p.legendaryAwaken24 ? 1.16 : (p.singleStageAwakened ? 1.12 : (p.legendaryAwaken12 ? 1.08 : 1.0)));
        // 獨立 Mega 腳底錨點對照表（於鏡像後本地座標套用，轉向左右時自動對稱貼齊光環正中央）
        const MEGA_ANCHOR_OFFSETS = {
          10036: { ox: -6, oy: -4 }, // 超級水箭龜：修正左炮留白導致雙腳偏右下
          10034: { ox: 2,  oy: -5 }, // 超級噴火龍X：雙爪收進光環內側並居中重心
          10033: { ox: 0,  oy: -2 }, // 超級妙蛙花：四足完全落入光環內圈
          10038: { ox: 0,  oy: -2 }, // 超級耿鬼：下盤沉入冥界光環中央
          10041: { ox: -2, oy: -4 }, // 超級暴鯉龍：龍軀居中收進赤藍光環
          10042: { ox: 0,  oy: -6 }  // 超級化石翼龍：展翼微浮於太古光環正上方
        };
        const mOff = isMegaSprite ? (MEGA_ANCHOR_OFFSETS[p.id] || { ox: 0, oy: 0 }) : { ox: 0, oy: 0 };
        const footAnchorLiftY = isMegaSprite ? 7 : (awakenScale - 1.0) * 28;
        ctx.translate(Math.round(px + visOffsetX), Math.round(py + visOffsetY - footAnchorLiftY - (submergeWater ? pBob * 0.45 : pBob) + (p.jumpY || 0) + (submergeWater ? 11 : 0)));
        ctx.scale((p.facingX > 0 ? -1 : 1) * stretchX * awakenScale, squashY * awakenScale);

        const drawX = -26 + mOff.ox;
        const drawY = -21 + mOff.oy;
        if (submergeWater) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(-26, -21, 52, 29); // 校準腳底透明留白 (+5px)，裁切至腹部吃水線 (y: -21 ~ +8)
          ctx.clip();
          ctx.drawImage(pRec.img, drawX, drawY, 52, 52);
          if (p.whiteFlashTimer > 0) {
            this.drawSilhouetteFlash(ctx, pRec.img, drawX, drawY, 52, 52, "#FFFFFF", 0.75);
          }
          ctx.restore();
          drawPixelWaterlineFoam(8, 16, 0);
        } else {
          ctx.drawImage(pRec.img, drawX, drawY, 52, 52);
          if (p.whiteFlashTimer > 0) {
            this.drawSilhouetteFlash(ctx, pRec.img, drawX, drawY, 52, 52, "#FFFFFF", 0.75);
          }
        }

        if (submergeGrass) {
          ctx.save();
          if (p.facingX > 0) ctx.scale(-1, 1);
          drawPixelGrassOverlay(p.x, p.y, 22, [-13, 0, 13]);
          ctx.restore();
        }
      }
      ctx.restore();
    };

    const drawEnemyEntity = (e) => {
      const esx = e._esx, esy = e._esy, sz = e._sz;
      if (e.isTrainingDummy) {
        ctx.save();
        ctx.translate(esx, esy);
        const shake = e.whiteFlashTimer > 0 ? Math.sin(performance.now() * 0.08) * 3.5 : 0;
        ctx.translate(shake, 0);
        // 木樁底座十字架
        ctx.fillStyle = "#5C2808";
        ctx.strokeStyle = "#1C0D04";
        ctx.lineWidth = 2;
        ctx.fillRect(-16, 14, 32, 7);
        ctx.strokeRect(-16, 14, 32, 7);
        // 垂直木柱
        ctx.fillStyle = "#92400E";
        ctx.fillRect(-6, -24, 12, 40);
        ctx.strokeRect(-6, -24, 12, 40);
        // 橫木雙臂
        ctx.fillStyle = "#B45309";
        ctx.fillRect(-24, -10, 48, 8);
        ctx.strokeRect(-24, -10, 48, 8);
        // 稻草標靶頭
        ctx.fillStyle = e.whiteFlashTimer > 0 ? "#FFFFFF" : "#FDE68A";
        ctx.beginPath();
        ctx.arc(0, -18, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // 紅白靶心
        ctx.strokeStyle = "#DC2626";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, -18, 7.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "#DC2626";
        ctx.beginPath();
        ctx.arc(0, -18, 2.8, 0, Math.PI * 2);
        ctx.fill();
        // 頭頂標籤
        ctx.font = "900 10px 'Noto Sans TC', sans-serif";
        ctx.textAlign = "center";
        ctx.fillStyle = "#34D399";
        ctx.strokeStyle = "#0F172A";
        ctx.lineWidth = 3;
        ctx.strokeText("🎯 測試木樁", 0, -37);
        ctx.fillText("🎯 測試木樁", 0, -37);
        ctx.restore();
        return;
      }
      const eSprUrl = e.facingY < 0 ? e.data.back_sprite : e.data.forward_sprite;
      // P0 關鍵優化：使用離線預烘焙閃光圖 (SpriteCache.getShiny)，0 ctx.filter 開銷
      const eRec = e.isShiny ? SpriteCache.getShiny(eSprUrl) : SpriteCache.get(eSprUrl);

      ctx.save();
      ctx.translate(Math.round(esx), Math.round(esy));
      const castPulse = castingOwners.has(e) ? (1.06 + Math.sin(tgNow * 3.0) * 0.06) : 1.0;
      ctx.scale((e.facingX > 0 ? -1 : 1) * castPulse, castPulse);

      if (eRec && eRec.loaded) {
        const isHiResEnemy = ((eRec.img.naturalWidth || eRec.img.width || 0) > 160);
        ctx.imageSmoothingEnabled = isHiResEnemy;
        ctx.webkitImageSmoothingEnabled = isHiResEnemy;
        ctx.drawImage(eRec.img, Math.round(-sz / 2), Math.round(-sz / 2), Math.round(sz), Math.round(sz));
      } else {
        // 圖片重試載入期間的像素精靈球兜底繪製，徹底杜絕隱形怪
        const pr = sz * 0.26;
        ctx.fillStyle = "#EF4444";
        ctx.beginPath(); ctx.arc(0, 0, pr, Math.PI, 0); ctx.fill();
        ctx.fillStyle = "#F8FAFC";
        ctx.beginPath(); ctx.arc(0, 0, pr, 0, Math.PI); ctx.fill();
        ctx.strokeStyle = "#0F172A"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, pr, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-pr, 0); ctx.lineTo(pr, 0); ctx.stroke();
      }

      if (e.whiteFlashTimer > 0 && eRec && eRec.loaded) {
        this.drawSilhouetteFlash(ctx, eRec.img, -sz / 2, -sz / 2, sz, sz, "#FFFFFF", 0.72);
      } else if ((e.isBoss || e.isMiniBoss) && e.hp > 0 && (e.hp / (e.maxHp || 1)) <= 0.50 && eRec && eRec.loaded) {
        // v7.6.11 小王／Boss 半血以下脈衝猩紅憤怒呼吸覆層（零 ctx.filter，不糊五官且穩 60 FPS）
        const ragePulse = 0.20 + (0.5 + 0.5 * Math.sin(performance.now() * 0.011)) * 0.16;
        this.drawSilhouetteFlash(ctx, eRec.img, -sz / 2, -sz / 2, sz, sz, "#DC2626", ragePulse);
      }

      if (e.isBoss && e.dpsShieldFlashTimer > 0) {
        const shAlpha = Math.min(0.85, (e.dpsShieldFlashTimer / 0.28) * 0.85);
        const shR = sz * 0.52;
        ctx.save();
        ctx.globalAlpha = shAlpha;
        ctx.strokeStyle = "#38BDF8";
        ctx.lineWidth = 3.0;
        ctx.beginPath();
        for (let h = 0; h < 6; h++) {
          const ha = (h * Math.PI) / 3 - Math.PI / 6;
          const hx = Math.cos(ha) * shR, hy = Math.sin(ha) * shR;
          if (h === 0) ctx.moveTo(hx, hy); else ctx.lineTo(hx, hy);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.strokeStyle = "#FEF08A";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, shR * 0.88, -Math.PI * 0.75, Math.PI * 0.25);
        ctx.stroke();
        ctx.restore();
      }

      if (e.status === "Poison") {
        if (highDensityLOD && !e.isElite && !e.isBoss) {
          ctx.fillStyle = "#A855F7";
          ctx.fillRect(sz * 0.22, -sz * 0.24, 5, 5);
        } else {
          const pNow = performance.now() * 0.0045 + e.x * 0.02;
          for (let pb = 0; pb < 2; pb++) {
            const prog = ((pNow + pb * 0.5) % 1.0);
            const side = pb === 0 ? -1 : 1;
            const bx = side * (sz * 0.28) + Math.sin(prog * Math.PI * 2 + pb) * 2.5;
            const by = -sz * 0.10 - prog * (sz * 0.32);
            const br = 3.2;

            ctx.fillStyle = pb === 0 ? "#9333EA" : "#22C55E";
            ctx.strokeStyle = "#1E1B4B";
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.arc(bx, by, br, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = "#FFFFFF";
            ctx.beginPath();
            ctx.arc(bx - 1.0, by - 1.0, 1.0, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      if (e.status === "Burn") {
        if (highDensityLOD && !e.isElite && !e.isBoss) {
          ctx.fillStyle = "#F97316";
          ctx.fillRect(-sz * 0.28, -sz * 0.15, 5, 6);
        } else {
          const bNow = performance.now() * 0.010 + e.y * 0.03;
          for (let bf = -1; bf <= 1; bf += 2) {
            const fx = bf * (sz * 0.30);
            const fy = -sz * 0.02 + Math.sin(bNow + bf * 1.5) * 3.0;
            const sway = Math.cos(bNow * 1.3 + bf) * 1.5;

            ctx.save();
            ctx.translate(fx, fy);
            ctx.fillStyle = "#F97316";
            ctx.strokeStyle = "#451A03";
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(sway, -5.5);
            ctx.quadraticCurveTo(4.0, 0, 0, 3.5);
            ctx.quadraticCurveTo(-4.0, 0, sway, -5.5);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = "#FEF08A";
            ctx.beginPath();
            ctx.arc(0, 0.8, 1.8, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        }
      }

      if (e.inFrostAura && (!highDensityLOD || e.isElite || e.isBoss)) {
        const fNow = performance.now() * 0.0035 + e.x * 0.02;
        for (let fi = 0; fi < 2; fi++) {
          const prog = ((fNow + fi * 0.5) % 1.0);
          const side = fi === 0 ? -1 : 1;
          const ix = side * (sz * 0.30) + Math.cos(prog * Math.PI * 2) * 2.0;
          const iy = -sz * 0.22 + prog * (sz * 0.36);
          const s = 3.4;

          ctx.strokeStyle = "#0369A1";
          ctx.lineWidth = 2.4;
          ctx.beginPath();
          ctx.moveTo(ix - s, iy); ctx.lineTo(ix + s, iy);
          ctx.moveTo(ix, iy - s); ctx.lineTo(ix, iy + s);
          ctx.stroke();

          ctx.strokeStyle = "#E0FFFF";
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(ix - s, iy); ctx.lineTo(ix + s, iy);
          ctx.moveTo(ix, iy - s); ctx.lineTo(ix, iy + s);
          ctx.stroke();
        }
      }

      if (e.status === "Paralysis") {
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 2.0;
        const now = performance.now();
        for (let arc = 0; arc < 2; arc++) {
          ctx.beginPath();
          ctx.moveTo(-sz * 0.35, -4 + arc * 10);
          ctx.lineTo(0, -sz * 0.25 + Math.sin(now * 0.02 + arc) * 8);
          ctx.lineTo(sz * 0.35, 4 + arc * 10);
          ctx.stroke();
        }
      }

      if (e.status === "Freeze") {
        ctx.save();
        ctx.fillStyle = "rgba(56, 189, 248, 0.35)";
        ctx.strokeStyle = "#E0F2FE";
        ctx.lineWidth = 2.4;
        const r = sz * 0.48;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i * Math.PI) / 3 - Math.PI / 6;
          const ix = Math.cos(a) * r;
          const iy = Math.sin(a) * r;
          if (i === 0) ctx.moveTo(ix, iy);
          else ctx.lineTo(ix, iy);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(-r * 0.45, -r * 0.65);
        ctx.lineTo(r * 0.45, r * 0.65);
        ctx.stroke();
        ctx.restore();
      }

      if (e.status === "Confusion") {
        ctx.save();
        const rot = performance.now() * 0.006;
        for (let c = 0; c < 2; c++) {
          const cAng = rot + c * Math.PI;
          const sx = Math.cos(cAng) * (sz * 0.42);
          const sy = Math.sin(cAng) * (sz * 0.22) - sz * 0.45;
          ctx.fillStyle = "#FACC15";
          ctx.beginPath();
          ctx.arc(sx, sy, 3.2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      ctx.restore();

      const rangedMobSet = [23, 24, 35, 41, 42, 48, 60, 69, 70, 81, 109, 110, 116, 117, 120];
      if (!e.treasureType && !e.isBoss && rangedMobSet.includes(e.id) && e.rangedCd !== undefined && e.rangedCd > 0 && e.rangedCd <= 0.35) {
        const chargeProgress = 1 - (e.rangedCd / 0.35);
        const glowR = 2.5 + chargeProgress * 3.5;
        const targetAng = Math.atan2(p.y - e.y, p.x - e.x);
        const muzzleX = esx + Math.cos(targetAng) * (sz * 0.32);
        const muzzleY = esy + Math.sin(targetAng) * (sz * 0.32) - 4;

        ctx.save();
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(muzzleX, muzzleY, glowR, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = [69, 70].includes(e.id) ? "#4ADE80" : ([60, 116, 117].includes(e.id) ? "#38BDF8" : "#C084FC");
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(muzzleX, muzzleY, glowR * 1.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      if (!e.isBoss && (e.hp < e.maxHp || e.isElite || e.treasureType)) {
        const isMobOnly = !e.isElite && !e.treasureType;
        const bw = e.isElite ? 36 : (e.treasureType ? 32 : 22);
        const bh = e.isElite ? 3.5 : (e.treasureType ? 3.2 : 2.5);
        const barX = esx - bw / 2;
        const barY = esy - sz / 2 - (e.isElite ? 8 : 6);
        const hpRatio = Math.max(0, e.hp / e.maxHp);
        const trailRatio = Math.max(hpRatio, e.hpTrailRatio !== undefined ? e.hpTrailRatio : hpRatio);

        ctx.save();
        if (isMobOnly && this.enemies.length > 60) {
          ctx.globalAlpha = 0.60;
        }
        ctx.fillStyle = isMobOnly ? "rgba(2, 6, 23, 0.52)" : "rgba(2, 6, 23, 0.72)";
        ctx.fillRect(barX, barY, bw, bh);

        // 精英／小王白色延遲扣血殘影條
        if (e.isElite && trailRatio > hpRatio + 0.005) {
          ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
          ctx.fillRect(barX + 0.5, barY + 0.5, (bw - 1) * trailRatio, bh - 1);
        }

        let barColor = "#FF5252";
        if (e.treasureType) {
          barColor = "#FACC15";
        } else if (hpRatio <= 0.25) {
          const pulse = 0.75 + Math.sin(performance.now() * 0.015) * 0.25;
          ctx.globalAlpha = isMobOnly && this.enemies.length > 60 ? pulse * 0.65 : pulse;
          barColor = "#FF2E2E";
        } else if (e.isElite) {
          barColor = (e.isMiniBoss && hpRatio <= 0.50) ? "#EF4444" : "#FF6B4A";
        }

        ctx.fillStyle = barColor;
        const pad = isMobOnly ? 0 : 0.5;
        ctx.fillRect(barX + pad, barY + pad, (bw - pad * 2) * hpRatio, bh - pad * 2);

        if (e.isElite) {
          ctx.strokeStyle = (e.isMiniBoss && hpRatio <= 0.50) ? "#F87171" : "#FACC15";
          ctx.lineWidth = 1.0;
          ctx.strokeRect(barX, barY, bw, bh);
        }

        if (e.isElite && !e.isBoss) {
          const cx = barX - 8;
          const cy = barY + bh / 2;
          ctx.globalAlpha = 1.0;
          ctx.fillStyle = "#FACC15";
          ctx.strokeStyle = "#78350F";
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(cx - 5, cy + 3.5);
          ctx.lineTo(cx - 5.5, cy - 3.5);
          ctx.lineTo(cx - 2, cy - 0.5);
          ctx.lineTo(cx, cy - 4.5);
          ctx.lineTo(cx + 2, cy - 0.5);
          ctx.lineTo(cx + 5.5, cy - 3.5);
          ctx.lineTo(cx + 5, cy + 3.5);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = "#EF4444";
          ctx.beginPath();
          ctx.arc(cx, cy + 1, 1.3, 0, Math.PI * 2);
          ctx.fill();
        }

        if (e.weakenTimer && e.weakenTimer > 0) {
          const wx = barX + bw + 6;
          const wy = barY + bh / 2;
          ctx.globalAlpha = 1.0;
          ctx.fillStyle = "#F472B6";
          ctx.strokeStyle = "#831843";
          ctx.lineWidth = 1.1;
          ctx.beginPath();
          ctx.moveTo(wx - 3.5, wy - 3);
          ctx.lineTo(wx + 3.5, wy - 3);
          ctx.lineTo(wx, wy + 3.5);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
        ctx.restore();
      }
    };

    // 依 Y-Sorting 順序統一繪製所有角色與怪獸
    for (let q = 0; q < renderQueue.length; q++) {
      const item = renderQueue[q];
      if (item.kind === "enemy") drawEnemyEntity(item.e);
      else if (item.kind === "player") drawPlayerEntity();
      else if (item.kind === "trainer") drawTrainerEntity();
      else if (item.kind === "partner") drawPartnerEntity(item.pt);
    }

    // 4. P1 關鍵升級：繪製 GBA 2.5D 樹冠與屋頂前景遮罩層（當角色走到樹冠或屋簷北側時自動呈半透明遮擋）
    if (typeof MapEngine.renderForegroundCanopies === "function") {
      MapEngine.renderForegroundCanopies(ctx, camX, camY, this.width, this.height, this.player, this.trainerCompanion);
    }

    ctx.save();
    SkillsEngine.renderAerialLayer(ctx, toSx, toSy);

    // 繪製敵方動態飛行道具 (方案 A：全彈種貼合幾何輪廓高對比暗紅／洋紅厚描邊，零 shadowBlur 開銷)
    this.enemyProjectiles.forEach(ep => {
      const esx = toSx(ep.x), esy = toSy(ep.y);
      if (esx < -28 || esx > this.width + 28 || esy < -28 || esy > this.height + 28) return;

      ctx.save();
      ctx.translate(esx, esy);
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      const r = ep.radius;

      // 威脅等級分流：精英／Boss 致命彈幕採用加粗洋紅警戒輪廓，一般遠程怪採用俐落暗紅輪廓
      const isHighThreat = ep.isHighThreat || ep.homing || ep.isSuction || ep.canSplit ||
        ["frost_lance", "storm_orb", "fire_blast_orb", "psychic_core", "rainbow_star", "fire_spark"].includes(ep.vfx);
      const dangerColor = isHighThreat ? "#F43F5E" : "#DC2626";
      const outerRimW = isHighThreat ? 6.0 : 4.6;
      const innerIsoW = isHighThreat ? 2.6 : 2.0;

      const strokeFittedRim = () => {
        ctx.strokeStyle = dangerColor;
        ctx.lineWidth = outerRimW;
        ctx.stroke();
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = innerIsoW;
        ctx.stroke();
      };

      if (ep.vfx === "swift_star") {
        // 旋轉金黃星芒（貼合五芒星輪廓）
        ctx.rotate(ep.rot * 2);
        ctx.beginPath();
        for (let s = 0; s < 5; s++) {
          const a1 = (s * Math.PI * 2) / 5 - Math.PI / 2;
          const a2 = a1 + Math.PI / 5;
          if (s === 0) ctx.moveTo(Math.cos(a1) * (r * 1.25), Math.sin(a1) * (r * 1.25));
          else ctx.lineTo(Math.cos(a1) * (r * 1.25), Math.sin(a1) * (r * 1.25));
          ctx.lineTo(Math.cos(a2) * (r * 0.55), Math.sin(a2) * (r * 0.55));
        }
        ctx.closePath();
        strokeFittedRim();
        ctx.fillStyle = ep.color;
        ctx.fill();
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2);
        ctx.fill();
      } else if (ep.vfx === "leaf_bullet") {
        // 旋轉翠綠飛葉（貼合葉片輪廓）
        ctx.rotate(ep.angle || ep.rot);
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 1.4, r * 0.65, 0, 0, Math.PI * 2);
        strokeFittedRim();
        ctx.fillStyle = ep.color;
        ctx.fill();
        ctx.strokeStyle = "#86EFAC";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(-r * 1.1, 0); ctx.lineTo(r * 1.1, 0);
        ctx.stroke();
      } else if (ep.vfx === "wind_bullet") {
        // 月牙風刃（貼合月牙輪廓）
        ctx.rotate(ep.angle || ep.rot);
        ctx.beginPath();
        ctx.arc(0, 0, r * 1.2, -1.2, 1.2);
        ctx.arc(r * 0.5, 0, r * 0.9, 1.2, -1.2, true);
        ctx.closePath();
        strokeFittedRim();
        ctx.fillStyle = ep.color;
        ctx.fill();
      } else if (ep.vfx === "water_drop") {
        // 水滴彈頭（貼合箭鏃水滴輪廓）
        ctx.rotate(ep.angle || ep.rot);
        ctx.beginPath();
        ctx.moveTo(r * 1.3, 0);
        ctx.lineTo(-r * 0.8, -r * 0.7);
        ctx.lineTo(-r * 0.4, 0);
        ctx.lineTo(-r * 0.8, r * 0.7);
        ctx.closePath();
        strokeFittedRim();
        ctx.fillStyle = ep.color;
        ctx.fill();
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2);
        ctx.fill();
      } else if (ep.vfx === "frost_lance") {
        // 急凍鳥：高速三叉尖銳冰錐（貼合尖錐輪廓）
        ctx.rotate(ep.angle);
        ctx.beginPath();
        ctx.moveTo(r * 1.6, 0); ctx.lineTo(-r * 0.8, -r * 0.6); ctx.lineTo(-r * 0.3, 0); ctx.lineTo(-r * 0.8, r * 0.6);
        ctx.closePath();
        strokeFittedRim();
        ctx.fillStyle = "#38BDF8";
        ctx.fill();
        ctx.fillStyle = "#E0F2FE";
        ctx.beginPath();
        ctx.moveTo(r * 1.2, 0); ctx.lineTo(-r * 0.35, -r * 0.25); ctx.lineTo(-r * 0.35, r * 0.25);
        ctx.closePath();
        ctx.fill();
      } else if (ep.vfx === "storm_orb") {
        // 閃電鳥：旋轉追蹤電磁核
        ctx.rotate(ep.rot * 3);
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
        strokeFittedRim();
        ctx.fillStyle = "#FACC15";
        ctx.fill();
        ctx.strokeStyle = "#FEF08A"; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(0, 0, r * 0.58, 0, Math.PI * 2); ctx.stroke();
      } else if (ep.vfx === "fire_blast_orb") {
        // 火焰鳥：大字炎巨彈
        ctx.rotate(ep.rot * 2);
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
        strokeFittedRim();
        ctx.fillStyle = "#EF4444";
        ctx.fill();
        ctx.fillStyle = "#FDE047";
        ctx.beginPath(); ctx.arc(0, 0, r * 0.6, 0, Math.PI * 2); ctx.fill();
      } else if (ep.vfx === "fire_spark") {
        // 大字炎分裂小火星（貼合旋轉方塊輪廓）
        ctx.rotate(ep.rot * 4);
        ctx.beginPath();
        ctx.rect(-r * 0.6, -r * 0.6, r * 1.2, r * 1.2);
        strokeFittedRim();
        ctx.fillStyle = "#F97316";
        ctx.fill();
        ctx.fillStyle = "#FEF08A";
        ctx.beginPath(); ctx.arc(0, 0, r * 0.4, 0, Math.PI * 2); ctx.fill();
      } else if (ep.vfx === "psychic_core") {
        // 超夢：暗影引力黑核
        ctx.rotate(-ep.rot);
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
        strokeFittedRim();
        ctx.fillStyle = "#581C87";
        ctx.fill();
        ctx.strokeStyle = "#C084FC"; ctx.lineWidth = 2.0; ctx.stroke();
        ctx.fillStyle = "#F3E8FF";
        ctx.beginPath(); ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2); ctx.fill();
      } else if (ep.vfx === "rainbow_star") {
        // 夢幻：五色彩虹星芒（貼合旋轉方塊輪廓）
        ctx.rotate(ep.rot * 4);
        ctx.beginPath();
        ctx.rect(-r * 0.6, -r * 0.6, r * 1.2, r * 1.2);
        strokeFittedRim();
        ctx.fillStyle = ep.color || "#EC4899";
        ctx.fill();
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath(); ctx.arc(0, 0, r * 0.4, 0, Math.PI * 2); ctx.fill();
      } else if (ep.vfx === "psy_wave") {
        // 超能精神衝擊波：旋轉雙層同心光環
        ctx.rotate(ep.rot * 3);
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
        strokeFittedRim();
        ctx.strokeStyle = ep.color || "#C084FC";
        ctx.lineWidth = 2.2;
        ctx.stroke();
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2); ctx.stroke();
      } else {
        // 毒氣/能量球：外溢光環與白色高光核心
        ctx.rotate(ep.rot);
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        strokeFittedRim();
        ctx.fillStyle = ep.color;
        ctx.fill();
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(r * 0.2, -r * 0.2, r * 0.35, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    });

    this.renderEnemyDashesAndExplosions(ctx, toSx, toSy);
    this.renderBossDeathAnims(ctx, toSx, toSy);
    this.renderVictoryCeremonyOverlay(ctx, toSx, toSy);

    this.particles.forEach(pt => {
      const sx = toSx(pt.x), sy = toSy(pt.y);
      ctx.save();
      ctx.globalAlpha = Math.max(0, pt.life / (pt.maxLife || 0.4));
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(sx, sy, pt.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
    ctx.restore();

    MapEngine.renderWeatherOverlays(ctx, this.width, this.height);
    if (this.state === "EVOLVING") {
      this.renderEvolutionOverlay(ctx, toSx, toSy, false);
    }
    ctx.restore(); // 結束鏡頭 Zoom-in 變換，下方對話框與螢幕邊緣指標維持 1:1 銳利清晰
    if (this.state === "EVOLVING") {
      this.renderEvolutionDialogBox(ctx);
    }
    if (this.battleCountdownTimer > 0 && this.state === "PLAYING") {
      this.renderBattleCountdownOverlay(ctx);
    }

    this.floatingTexts.forEach(ft => {
      const sx = toSx(ft.x), sy = toSy(ft.y);
      ctx.save();
      ctx.font = `900 ${ft.size}px 'Noto Sans TC', sans-serif`;
      ctx.textAlign = "center";
      ctx.strokeStyle = "#0F172A";
      ctx.lineWidth = 3.5;
      ctx.strokeText(ft.text, sx, sy);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, sx, sy);
      ctx.restore();
    });

    // 智慧防遺忘經驗水晶引導：新手首 3 顆必顯示；老玩家每局開局滿 10 秒未撿或局中 20 秒未撿且場上累積 ≥ 5 顆時喚醒（單局上限 2 次）
    if (!this.gemGuideActive && (this.gemGuideRemindCount || 0) < 2 && visibleUnmagGems > 0) {
      const openingMissed = ((this.runGemsCollected || 0) === 0 && (this.runTime || 0) >= 10);
      const midRunIdle = ((this.runGemsCollected || 0) > 0 && ((this.runTime || 0) - (this.lastGemCollectTime || 0)) >= 20 && visibleUnmagGems >= 5);
      if (openingMissed || midRunIdle) {
        this.gemGuideActive = true;
        this.gemGuideRemindCount = (this.gemGuideRemindCount || 0) + 1;
      }
    }
    const isNewbieGemGuide = !!(this.saveData && this.saveData.stats && (this.saveData.stats.gemsCollected || 0) < 3);
    const shouldShowGemGuide = !!nearestGuideGem && (isNewbieGemGuide || !!this.gemGuideActive);
    if (shouldShowGemGuide) {
      const bounce = Math.abs(Math.sin(performance.now() * 0.0075)) * 6;
      const gx = nearestGuideGem.sx;
      const gy = nearestGuideGem.sy - nearestGuideGem.s - 12 - bounce;

      ctx.save();
      ctx.translate(gx, gy);
      // 向下指示三角箭頭
      ctx.fillStyle = "#FACC15";
      ctx.strokeStyle = "#0F172A";
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(0, 6);
      ctx.lineTo(-6, -2);
      ctx.lineTo(6, -2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 精簡亮眼引導膠囊
      ctx.font = "900 11px 'Noto Sans TC', sans-serif";
      const pillText = "撿取升級!";
      const pw = Math.max(66, ctx.measureText(pillText).width + 14);
      ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
      ctx.strokeStyle = "#FACC15";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.roundRect(-pw / 2, -23, pw, 20, 10);
      ctx.fill();
      ctx.stroke();

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#FEF08A";
      ctx.fillText(pillText, 0, -13);
      ctx.restore();
    }

    // 繪製輕量級攜帶物／被動觸發頭頂圖標氣泡 (Icon Pop-ups)
    if (this.iconPopups && this.iconPopups.length > 0) {
      this.iconPopups.forEach(ip => {
        const sx = toSx(ip.x), sy = toSy(ip.y);
        const popScale = ip.age < 0.12
          ? (0.55 + 0.60 * (ip.age / 0.12))
          : (ip.age < 0.22 ? (1.15 - 0.15 * ((ip.age - 0.12) / 0.10)) : 1.0);
        const alpha = ip.life < 0.22 ? Math.max(0, ip.life / 0.22) : 0.96;

        ctx.save();
        ctx.translate(sx, sy);
        ctx.scale(popScale, popScale);
        ctx.globalAlpha = alpha;

        // 半透明深色圓底 ＋ 屬性光環描邊
        ctx.fillStyle = "rgba(15, 23, 42, 0.86)";
        ctx.strokeStyle = ip.color || "#FACC15";
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.arc(0, 0, 11.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // 道具像素原圖
        const rec = ip.spriteUrl ? SpriteCache.get(ip.spriteUrl) : null;
        if (rec && rec.loaded) {
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(rec.img, -8.5, -8.5, 17, 17);
        }

        // 極簡右側短詞（如 +12 / MISS / GUARD）
        if (ip.label) {
          ctx.font = "900 11px 'Noto Sans TC', sans-serif";
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.strokeStyle = "#0F172A";
          ctx.lineWidth = 3.2;
          ctx.strokeText(ip.label, 14, 1);
          ctx.fillStyle = ip.color || "#FFFFFF";
          ctx.fillText(ip.label, 14, 1);
        }
        ctx.restore();
      });
    }

    // 商業級圖像化螢幕邊緣方向指示器（圓形頭像／道具縮圖 ＋ 外緣指向箭頭 ＋ 去噪分級）
    const edgePad = 36;
    const drawEdgeIconIndicator = (wx, wy, borderColor, labelText, iconImg, iconDrawSize = 24, srcRect = null) => {
      const esx = toSx(wx), esy = toSy(wy);
      // 放寬 40px 入鏡提前隱藏容差，商店／神獸剛露頭時即刻無縫淡出指標
      if (esx >= -40 && esx <= this.width + 40 && esy >= -40 && esy <= this.height + 40) return;

      const dx = wx - this.player.x;
      const dy = wy - this.player.y;
      const ang = Math.atan2(dy, dx);
      const distMeters = Math.round(Math.hypot(dx, dy) / 10);

      let cx = Math.max(edgePad, Math.min(this.width - edgePad, this.width / 2 + Math.cos(ang) * (this.width / 2 - edgePad)));
      let cy = Math.max(edgePad + 46, Math.min(this.height - edgePad - 14, this.height / 2 + Math.sin(ang) * (this.height / 2 - edgePad)));
      // 智慧避讓左下角緊湊 HUD（僅 <46% 寬度）與右下角大招／Mega 按鈕區，正下方指標貼底不飄入搖桿區
      const bottomLeftLimitY = this.height - 118;
      const bottomRightLimitY = this.height - 132;
      if (cx < this.width * 0.46 && cy > bottomLeftLimitY) {
        cy = bottomLeftLimitY;
      } else if (cx > this.width - 148 && cy > bottomRightLimitY) {
        cy = bottomRightLimitY;
      }
      const rad = 17;

      // 1. 外緣指向箭頭（沿目標方向旋轉，緊貼圓框外側）
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(ang);
      ctx.fillStyle = borderColor;
      ctx.strokeStyle = "#0F172A";
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(rad + 10, 0);
      ctx.lineTo(rad - 1, -6.5);
      ctx.lineTo(rad - 1, 6.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // 2. 深色圓形徽章底座 ＋ 屬性/稀有度外框
      ctx.save();
      ctx.translate(cx, cy);
      ctx.fillStyle = "rgba(15, 23, 42, 0.90)";
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.arc(0, 0, rad, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // 3. 圓框內繪製實體像素頭像／道具縮圖（直立不旋轉，一眼辨識）
      if (iconImg) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, rad - 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.imageSmoothingEnabled = false;
        if (srcRect) {
          ctx.drawImage(iconImg, srcRect.x, srcRect.y, srcRect.w, srcRect.h, -iconDrawSize / 2, -iconDrawSize / 2, iconDrawSize, iconDrawSize);
        } else {
          ctx.drawImage(iconImg, -iconDrawSize / 2, -iconDrawSize / 2, iconDrawSize, iconDrawSize);
        }
        ctx.restore();
      }
      ctx.restore();

      // 4. 下方精簡文字與距離標籤
      ctx.save();
      ctx.font = "900 10px 'Noto Sans TC', sans-serif";
      ctx.textAlign = "center";
      ctx.strokeStyle = "#0F172A";
      ctx.lineWidth = 2.8;
      const fullLabel = `${labelText} ${distMeters}m`;
      ctx.strokeText(fullLabel, cx, cy + rad + 12);
      ctx.fillStyle = borderColor;
      ctx.fillText(fullLabel, cx, cy + rad + 12);
      ctx.restore();
    };

    // 關都大遠征殲滅收尾指引：剩餘 ≤3 隻目標怪時於畫面邊緣顯示紅色箭頭指引，杜絕找怪冷場
    if (this.isExpeditionMode && this.expeditionState) {
      const est = this.expeditionState;
      const wCfg = est.plan[est.currentWave - 1];
      if (wCfg && !wCfg.isBossWave && est.spawnedCount >= est.killQuota) {
        const remMobs = this.enemies.filter(en => en.isQuotaMob && en.hp > 0);
        if (remMobs.length > 0 && remMobs.length <= 3) {
          remMobs.forEach(en => {
            const sprRec = en.data ? SpriteCache.get(en.data.forward_sprite) : null;
            const iconImg = (sprRec && sprRec.loaded) ? sprRec.img : null;
            drawEdgeIconIndicator(en.x, en.y, "#F43F5E", "殘敵", iconImg, 24);
          });
        }
      }
    }

    // 關都大遠征：擊破最後一隻怪瞬間蓋上 GBA 像素 AREA CLEAR 印章
    if (this.areaClearStampTimer > 0) {
      const t = Math.min(1, this.areaClearStampTimer / 0.90);
      const scale = t > 0.78 ? (1.35 - (1 - t) * 1.6) : 1.0;
      ctx.save();
      ctx.translate(this.width / 2, this.height * 0.34);
      ctx.scale(scale, scale);
      ctx.globalAlpha = Math.min(1, t * 2.2);
      ctx.fillStyle = "rgba(15, 23, 42, 0.90)";
      ctx.strokeStyle = "#FACC15";
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.roundRect(-118, -28, 236, 56, 12);
      ctx.fill();
      ctx.stroke();
      ctx.font = "900 18px 'Press Start 2P', monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#FEF08A";
      ctx.fillText("AREA CLEAR!", 0, -4);
      ctx.font = "900 10px 'Noto Sans TC', sans-serif";
      ctx.fillStyle = "#6EE7B7";
      ctx.fillText("區域淨空 ‧ 回收全場水晶中", 0, 16);
      ctx.restore();
    }

    // 僅顯示高價值首領與寶藏精靈（Boss / 聚寶喵喵 / 幸福吉利蛋），移除常規精英與事件怪洗版
    this.enemies.forEach(e => {
      if (!e.isBoss && !e.treasureType) return;
      const sprRec = e.data ? SpriteCache.get(e.data.forward_sprite) : null;
      const iconImg = (sprRec && sprRec.loaded) ? sprRec.img : null;
      if (e.isBoss) {
        drawEdgeIconIndicator(e.x, e.y, "#EF4444", "BOSS", iconImg, 30);
      } else if (e.treasureType === "meowth") {
        drawEdgeIconIndicator(e.x, e.y, "#F59E0B", "喵喵", iconImg, 28);
      } else if (e.treasureType === "chansey") {
        drawEdgeIconIndicator(e.x, e.y, "#EC4899", "吉利蛋", iconImg, 28);
      }
    });

    // 顯示全場高價值地面互動與掉落物（友好商店、黃金寶箱、神奇糖果、夥伴球、經驗磁鐵）
    const martPixelIcon = (typeof MapEngine !== "undefined" && MapEngine.spritePropCache)
      ? MapEngine.spritePropCache.get("poke_mart_pixel")
      : null;
    const itemIndicatorCfg = {
      poke_mart:    { color: "#38BDF8", label: "商店",   size: 26 },
      evo_chest:    { color: "#F59E0B", label: "寶箱",   size: 22 },
      rare_candy:   { color: "#38BDF8", label: "糖果",   size: 22 },
      partner_ball: { color: "#EC4899", label: "夥伴球", size: 22 },
      magnet:       { color: "#FACC15", label: "磁鐵",   size: 22 }
    };
    this.mapItems.forEach(it => {
      const cfg = itemIndicatorCfg[it.id];
      if (!cfg) return;
      let iconImg = null;
      if (it.id === "poke_mart" && martPixelIcon) {
        iconImg = martPixelIcon;
      } else if (it.meta && it.meta.sprite) {
        const rec = SpriteCache.get(it.meta.sprite);
        if (rec && rec.loaded) iconImg = rec.img;
      }
      drawEdgeIconIndicator(it.x, it.y, cfg.color, cfg.label, iconImg, cfg.size);
    });

    if (this.isTowerMode && typeof ModeTower !== "undefined" && ModeTower.renderEdgeIndicators) {
      ModeTower.renderEdgeIndicators(this, drawEdgeIconIndicator);
    }

    // v7.7.0 突發事件場外邊緣方向箭頭（信標 ／ 空投 ／ 寶箱）＋ 迷霧與電磁風暴氛圍邊框
    if (this.activeFieldEvent) {
      const ev = this.activeFieldEvent;
      if (Array.isArray(ev.nodes)) {
        const uiRec = (typeof FieldEventsEngine !== "undefined") ? SpriteCache.get(FieldEventsEngine.UI_SHEET_URL) : null;
        ev.nodes.forEach(nd => {
          if (!nd.opened) {
            const key = nd.kind === "beacon" ? "energy_beacon" : (nd.kind === "airdrop" ? "rocket_airdrop" : "ditto_chests");
            const sr = (typeof FieldEventsEngine !== "undefined") ? FieldEventsEngine.getIconSrcRect(key) : null;
            const img = (uiRec && uiRec.loaded) ? uiRec.img : null;
            drawEdgeIconIndicator(nd.x, nd.y, nd.color || "#FACC15", nd.label || "事件", img, 24, sr);
          }
        });
      }
      if (ev.id === "exp_mist") {
        ctx.save();
        const mistGrad = ctx.createRadialGradient(this.width / 2, this.height / 2, Math.min(this.width, this.height) * 0.28, this.width / 2, this.height / 2, Math.max(this.width, this.height) * 0.68);
        mistGrad.addColorStop(0, "rgba(30, 27, 75, 0)");
        mistGrad.addColorStop(1, "rgba(49, 46, 129, 0.42)");
        ctx.fillStyle = mistGrad;
        ctx.fillRect(0, 0, this.width, this.height);
        ctx.restore();
      } else if (ev.id === "overdrive_storm") {
        ctx.save();
        const a = 0.25 + 0.18 * Math.sin(performance.now() * 0.014);
        ctx.strokeStyle = `rgba(56, 189, 248, ${a})`;
        ctx.lineWidth = 8;
        ctx.strokeRect(4, 4, this.width - 8, this.height - 8);
        ctx.restore();
      }
    }
  },

  renderBattleCountdownOverlay(ctx) {
    const t = this.battleCountdownTimer || 0;
    if (t <= 0) return;

    // 關都大遠征專屬：於 3-2-1 START 正上方清楚展示 WAVE ?/10 與關卡名（不與左上角路牌重疊）
    if (this.isExpeditionMode && this.expeditionState) {
      const est = this.expeditionState;
      const totW = est.totalWaves || est.plan.length;
      const wCfg = est.plan[est.currentWave - 1];
      ctx.save();
      const pillY = this.height * 0.27;
      ctx.fillStyle = "rgba(15, 23, 42, 0.90)";
      ctx.strokeStyle = (wCfg && wCfg.isBossWave) ? "#F43F5E" : "#FACC15";
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.roundRect(this.width / 2 - 122, pillY - 24, 244, 48, 12);
      ctx.fill();
      ctx.stroke();

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "900 13px 'Press Start 2P', monospace";
      ctx.fillStyle = (wCfg && wCfg.isBossWave) ? "#FDA4AF" : "#FEF08A";
      ctx.fillText(`WAVE ${est.currentWave} / ${totW}`, this.width / 2, pillY - 6);

      ctx.font = "900 11px 'Noto Sans TC', sans-serif";
      ctx.fillStyle = "#E0F2FE";
      ctx.fillText(wCfg ? `${wCfg.chapterShortName} · ${wCfg.title}` : "", this.width / 2, pillY + 13);
      ctx.restore();
    }

    const beatDur = 0.50;
    const beatIdx = Math.min(3, Math.floor(t / beatDur)); // 3="3", 2="2", 1="1", 0="BATTLE START!"
    const localElapsed = beatDur - (t - beatIdx * beatDur);
    const localProg = Math.max(0, Math.min(1, localElapsed / beatDur));
    const popPeak = beatIdx === 0 ? 1.20 : 1.38;
    const popScale = localProg < 0.28
      ? (popPeak - (popPeak - 1.0) * (localProg / 0.28))
      : (1.0 + Math.sin((localProg - 0.28) * Math.PI) * 0.05);
    const alpha = localProg > 0.82 ? Math.max(0, (1 - localProg) / 0.18) : 1.0;

    const labels = ["BATTLE START!", "1", "2", "3"];
    const text = labels[beatIdx] || "3";
    const isStart = (beatIdx === 0);
    const startFontSize = Math.min(30, Math.max(18, Math.floor(this.width * 0.054)));
    const maxSafeW = Math.max(220, (this.width - 36) / popScale);

    ctx.save();
    ctx.translate(this.width / 2, this.height * 0.40);
    ctx.scale(popScale, popScale);
    ctx.globalAlpha = alpha;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.font = isStart
      ? `900 ${startFontSize}px 'Press Start 2P', 'Noto Sans TC', sans-serif`
      : "900 54px 'Press Start 2P', monospace";
    ctx.lineWidth = isStart ? 5.5 : 8.5;
    ctx.strokeStyle = "#0F172A";
    ctx.strokeText(text, 0, 0, maxSafeW);

    ctx.fillStyle = isStart ? "#34D399" : (beatIdx === 1 ? "#F43F5E" : "#FACC15");
    ctx.fillText(text, 0, 0, maxSafeW);

    if (!isStart) {
      ctx.font = "900 12px 'Noto Sans TC', sans-serif";
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = "#0F172A";
      ctx.strokeText("熱身走位中 ‧ 準備迎戰！", 0, 44);
      ctx.fillStyle = "#E0F2FE";
      ctx.fillText("熱身走位中 ‧ 準備迎戰！", 0, 44);
    }
    ctx.restore();
  }
});
