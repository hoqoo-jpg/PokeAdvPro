/**
 * ============================================================================
 * skills_vfx.js (v7.3.7 純架構解耦：技能與超武 Canvas 特效渲染層)
 * 從 skills_engine.js 獨立抽離 renderGroundLayer()、renderAerialLayer() 與 render()，
 * 徹底隔離戰鬥物理邏輯與 Canvas 特效繪圖，零功能異動。
 * ============================================================================
 */

window.SkillsEngine = window.SkillsEngine || {};

Object.assign(window.SkillsEngine, {
  // ==========================================================================
  // 圖層 1：地面底層渲染 (renderGroundLayer) — 繪製於所有精靈與訓練家腳底下，絕不遮擋人物
  // ==========================================================================
  renderGroundLayer(ctx, toSx, toSy) {
    const now = performance.now() * 0.004;
    const sAlpha = this.getPlayerSkillAlpha();
    ctx.save();
    ctx.globalAlpha = sAlpha;

    this.groundHazards.forEach(hz => {
      if (hz.kind === "meteor_strike" && hz.delay > 0) return;
      const sx = toSx(hz.x), sy = toSy(hz.y);
      const prog = Math.max(0, Math.min(1, 1 - (hz.timer / (hz.maxTime || 0.45))));
      ctx.save();

      if (hz.kind === "shadow_rift_grip") {
        // 【冥界裂空爪（底層空間裂縫黑洞）】
        const alpha = Math.min(1, hz.timer * 2.4);
        const rx = hz.radius * (prog < 0.25 ? (0.4 + prog * 2.4) : 1.0);
        const ry = rx * 0.58;
        const isC = !!hz.isMegaGengar;
        const g = ctx.createRadialGradient(sx, sy, rx * 0.08, sx, sy, rx);
        g.addColorStop(0, `rgba(10, 5, 20, ${alpha * 0.92})`);
        g.addColorStop(0.55, isC ? `rgba(159, 18, 57, ${alpha * 0.65})` : `rgba(88, 28, 135, ${alpha * 0.65})`);
        g.addColorStop(1, "rgba(15, 23, 42, 0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(sx, sy, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        // 鋸齒空間裂痕
        ctx.strokeStyle = isC ? `rgba(251, 113, 133, ${alpha * 0.9})` : `rgba(216, 180, 254, ${alpha * 0.9})`;
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.ellipse(sx, sy, rx * 0.85, ry * 0.85, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (hz.kind === "x_scissor_wheel") {
        // 【終極十字星斬（底層旋轉刀影 Z 軸投影）】
        const alpha = Math.min(1, hz.timer * 3.0) * 0.45;
        ctx.translate(sx, sy + 12);
        ctx.rotate(hz.angle || 0);
        ctx.fillStyle = `rgba(20, 83, 45, ${alpha})`;
        const r = hz.radius;
        for (let b = 0; b < 4; b++) {
          ctx.rotate(Math.PI / 2);
          ctx.beginPath();
          ctx.moveTo(0, -10); ctx.quadraticCurveTo(r * 0.65, -26, r, 0);
          ctx.quadraticCurveTo(r * 0.55, 8, 0, 10); ctx.closePath();
          ctx.fill();
        }
      } else if (hz.kind === "electro_cage_ult") {
        // 【超載磁暴球（底層高壓電磁軌道暈）】
        const alpha = Math.min(1, hz.timer * 2.0) * 0.42;
        ctx.strokeStyle = `rgba(56, 189, 248, ${alpha})`;
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 8]);
        ctx.beginPath();
        ctx.ellipse(sx, sy + 8, hz.radius, hz.radius * 0.65, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (hz.kind === "poison_spike_ring") {
        // 【劇毒新星（插地紫綠結晶毒刺陣）】
        const alpha = Math.min(1, hz.timer * 2.2);
        const r = hz.radius;
        ctx.strokeStyle = `rgba(74, 222, 128, ${alpha * 0.65})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.ellipse(sx, sy, r, r * 0.64, 0, 0, Math.PI * 2);
        ctx.stroke();
        // 12 根插地結晶毒刺
        for (let k = 0; k < 12; k++) {
          const a = (k * Math.PI * 2) / 12;
          const px = sx + Math.cos(a) * r;
          const py = sy + Math.sin(a) * r * 0.64;
          const h = (14 + (k % 2) * 6) * Math.min(1, prog * 6);
          ctx.fillStyle = "#581C87";
          ctx.beginPath();
          ctx.moveTo(px - 5, py + 2); ctx.lineTo(px, py - h); ctx.lineTo(px + 5, py + 2); ctx.closePath();
          ctx.fill();
          ctx.fillStyle = k % 2 === 0 ? "#4ADE80" : "#E879F9";
          ctx.beginPath();
          ctx.moveTo(px - 2.5, py + 1); ctx.lineTo(px, py - h + 3); ctx.lineTo(px + 2.5, py + 1); ctx.closePath();
          ctx.fill();
        }
      } else       if (hz.kind === "poison_puddle" || hz.kind === "toxic_swamp") {
        const isUltSwamp = (hz.kind === "toxic_swamp");
        const isCrimson = !!hz.isMegaGengarPuddle || hz.color === "#E11D48" || hz.color === "#EC4899";
        const alpha = Math.min(1, hz.timer * 1.2);
        const rx = hz.radius;
        const ry = hz.radius * (isUltSwamp ? 0.72 : 0.62);

        // 1. v7.8.6 黃金可見度毒沼底盤（針對 85% 預設透明度微調至 0.56~0.58，辨識清晰且不與敵方紅圈混淆）
        const swampGrad = ctx.createRadialGradient(sx, sy, rx * 0.12, sx, sy, rx);
        swampGrad.addColorStop(0, isCrimson ? `rgba(159, 18, 57, ${alpha * 0.58})` : `rgba(20, 83, 45, ${alpha * 0.56})`);
        swampGrad.addColorStop(0.58, isCrimson ? `rgba(107, 33, 168, ${alpha * 0.46})` : `rgba(88, 28, 135, ${alpha * 0.44})`);
        swampGrad.addColorStop(1, isCrimson ? `rgba(76, 5, 25, 0)` : `rgba(59, 7, 100, 0)`);
        ctx.fillStyle = swampGrad;
        ctx.beginPath();
        ctx.ellipse(sx, sy, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();

        // 2. 半透明外圍細環與緩轉虛線（0.46~0.48 清晰界定毒沼範圍）
        ctx.strokeStyle = isCrimson ? `rgba(225, 29, 72, ${alpha * 0.48})` : `rgba(147, 51, 234, ${alpha * 0.48})`;
        ctx.lineWidth = isUltSwamp ? 2.2 : 1.8;
        ctx.beginPath();
        ctx.ellipse(sx, sy, rx * 0.92, ry * 0.92, 0, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = isCrimson ? `rgba(251, 113, 133, ${alpha * 0.46})` : `rgba(74, 222, 128, ${alpha * 0.46})`;
        ctx.lineWidth = 1.5;
        ctx.setLineDash(isUltSwamp ? [16, 10] : [10, 8]);
        ctx.lineDashOffset = -now * 16;
        ctx.beginPath();
        ctx.ellipse(sx, sy, rx * 0.76, ry * 0.76, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineDashOffset = 0;

        if (isUltSwamp) {
          // 劇毒沼澤超武：內部 4 道螢光綠逆時針腐蝕渦流帶
          for (let arm = 0; arm < 4; arm++) {
            const a0 = -now * 1.6 + (arm * Math.PI * 2) / 4;
            ctx.strokeStyle = isCrimson ? `rgba(244, 63, 94, ${alpha * 0.68})` : `rgba(163, 230, 53, ${alpha * 0.65})`;
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

          ctx.fillStyle = isCrimson
            ? (b % 2 === 0 ? `rgba(244, 63, 94, ${alpha * 0.90})` : `rgba(192, 132, 252, ${alpha * 0.90})`)
            : (b % 2 === 0 ? `rgba(34, 197, 94, ${alpha * 0.88})` : `rgba(168, 85, 247, ${alpha * 0.88})`);
          ctx.strokeStyle = isCrimson ? `rgba(76, 5, 25, ${alpha * 0.95})` : `rgba(20, 83, 45, ${alpha * 0.95})`;
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
        ctx.globalAlpha = (alpha) * sAlpha;
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
        ctx.globalAlpha = (alpha) * sAlpha;
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

        const shadowGrad = ctx.createRadialGradient(0, 0, 16, 0, 0, curR);
        shadowGrad.addColorStop(0, `rgba(12, 5, 28, ${alpha * 0.92})`);
        shadowGrad.addColorStop(0.58, `rgba(59, 7, 100, ${alpha * 0.70})`);
        shadowGrad.addColorStop(0.88, `rgba(107, 33, 168, ${alpha * 0.34})`);
        shadowGrad.addColorStop(1, "rgba(15, 23, 42, 0)");
        ctx.fillStyle = shadowGrad;
        ctx.beginPath();
        ctx.arc(0, 0, curR, 0, Math.PI * 2);
        ctx.fill();

        // 外圍雙層紫冥符文圈
        ctx.strokeStyle = `rgba(192, 132, 252, ${alpha * 0.92})`;
        ctx.lineWidth = 3.4;
        ctx.setLineDash([14, 8]);
        ctx.beginPath();
        ctx.arc(0, 0, curR * 0.88, now * 0.8, now * 0.8 + Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // 耿鬼標誌性「血紅邪魅雙眼 + 弦月露齒壞笑」高對比地面投影圖騰
        ctx.save();
        const grinScale = Math.min(1.12, curR / 155);
        ctx.scale(grinScale, grinScale);
        ctx.globalAlpha = Math.min(1.0, alpha * 1.05) * sAlpha;
        // 左眼三角形（加黑紫銳利描邊）
        ctx.fillStyle = "#FF2E4C";
        ctx.strokeStyle = "#1E0738";
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.moveTo(-48, -28); ctx.lineTo(-14, -10); ctx.lineTo(-42, -2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // 右眼三角形
        ctx.beginPath();
        ctx.moveTo(48, -28); ctx.lineTo(14, -10); ctx.lineTo(42, -2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

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
        ctx.globalAlpha = (alpha) * sAlpha;
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
        ctx.globalAlpha = (alpha) * sAlpha;

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
        // 【創世極光（月亮之力超武・底層）】：天頂月華投影陣（星夜深紫微暈 ＋ 旋轉銀白月相符文環）
        ctx.translate(sx, sy);
        const alpha = Math.sin((1 - prog) * Math.PI) * 0.88;
        const curR = Math.max(28, hz.radius * Math.min(1, prog * 2.1));

        // 1. 半透明星夜深紫微暈底盤（中心輕透不擋敵彈，外緣泛出銀紫月暈）
        const aurGrad = ctx.createRadialGradient(0, 0, curR * 0.25, 0, 0, curR);
        aurGrad.addColorStop(0, `rgba(30, 27, 75, ${alpha * 0.14})`);
        aurGrad.addColorStop(0.58, `rgba(88, 28, 135, ${alpha * 0.24})`);
        aurGrad.addColorStop(0.86, `rgba(244, 114, 182, ${alpha * 0.28})`);
        aurGrad.addColorStop(1, "rgba(15, 23, 42, 0)");
        ctx.fillStyle = aurGrad;
        ctx.beginPath();
        ctx.arc(0, 0, curR, 0, Math.PI * 2);
        ctx.fill();

        // 2. 雙層逆向旋轉銀白月相星軌細環
        ctx.strokeStyle = `rgba(224, 231, 255, ${alpha * 0.72})`;
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.arc(0, 0, curR * 0.90, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = `rgba(244, 114, 182, ${alpha * 0.55})`;
        ctx.lineWidth = 1.4;
        ctx.setLineDash([10, 8]);
        ctx.beginPath();
        ctx.arc(0, 0, curR * 0.72, -now * 0.5, -now * 0.5 + Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // 3. 環繞地面投影的 8 枚「新月 ➔ 弦月 ➔ 滿月」幾何月相刻紋
        const phaseR = curR * 0.81;
        for (let m = 0; m < 8; m++) {
          const ma = now * 0.35 + (m * Math.PI * 2) / 8;
          const mx = Math.cos(ma) * phaseR;
          const my = Math.sin(ma) * phaseR;
          ctx.save();
          ctx.translate(mx, my);
          ctx.rotate(ma + Math.PI / 2);
          ctx.globalAlpha = (alpha * 0.85) * sAlpha;
          if (m % 4 === 0) {
            // 滿月銀白圓印
            ctx.fillStyle = "#FEF9C3";
            ctx.beginPath(); ctx.arc(0, 0, 5.5, 0, Math.PI * 2); ctx.fill();
          } else if (m % 4 === 2) {
            // 新月空心銀環
            ctx.strokeStyle = "#E0E7FF";
            ctx.lineWidth = 1.6;
            ctx.beginPath(); ctx.arc(0, 0, 5.2, 0, Math.PI * 2); ctx.stroke();
          } else {
            // 上／下弦月眉印
            ctx.fillStyle = "#FBCFE8";
            ctx.beginPath();
            ctx.arc(0, 0, 5.5, -Math.PI * 0.45, Math.PI * 0.45);
            ctx.arc(2.4, 0, 4.4, Math.PI * 0.45, -Math.PI * 0.45, true);
            ctx.closePath();
            ctx.fill();
          }
          ctx.restore();
        }
      } else if (hz.kind === "serena_stage") {
        // 【莎莉娜大招・華麗雙打舞台（底層）】：中空星光圓形臨時舞台 ＋ 深玫紅/金邊細框 ＋ 12 顆交替閃爍像素小燈泡
        ctx.translate(sx, sy);
        const fade = hz.timer < 0.5 ? Math.max(0, hz.timer / 0.5) : Math.min(1, prog * 4.0);
        const curR = Math.max(32, hz.radius * Math.min(1, prog * 3.0));

        // 1. 中空星光舞台邊暈（中心 0~70% 幾近透明，絕不遮草地與敵方紅彈）
        const stGrad = ctx.createRadialGradient(0, 0, curR * 0.65, 0, 0, curR);
        stGrad.addColorStop(0, "rgba(244, 114, 182, 0.0)");
        stGrad.addColorStop(0.55, `rgba(219, 39, 119, ${fade * 0.14})`);
        stGrad.addColorStop(0.92, `rgba(254, 240, 138, ${fade * 0.24})`);
        stGrad.addColorStop(1, "rgba(190, 24, 93, 0.0)");
        ctx.fillStyle = stGrad;
        ctx.beginPath();
        ctx.arc(0, 0, curR, 0, Math.PI * 2);
        ctx.fill();

        // 2. 深玫紅外框 ＋ 香檳金內細線
        ctx.strokeStyle = `rgba(190, 24, 93, ${fade * 0.78})`;
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.arc(0, 0, curR, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = `rgba(254, 240, 138, ${fade * 0.72})`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(0, 0, curR - 4.5, 0, Math.PI * 2);
        ctx.stroke();

        // 3. 12 顆沿舞台外緣輪流明暗閃爍的暖金／粉紅像素舞台小燈泡
        const bulbCount = 12;
        const chaseStep = Math.floor(now * 3.8);
        for (let b = 0; b < bulbCount; b++) {
          const ba = (b * Math.PI * 2) / bulbCount;
          const bx = Math.cos(ba) * (curR - 1.5);
          const by = Math.sin(ba) * (curR - 1.5);
          const isLit = ((b + chaseStep) % 2 === 0);
          ctx.fillStyle = isLit
            ? `rgba(254, 249, 195, ${fade * 0.96})`
            : `rgba(244, 114, 182, ${fade * 0.55})`;
          ctx.strokeStyle = `rgba(131, 24, 67, ${fade * 0.85})`;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(bx, by, isLit ? 4.0 : 2.8, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      } else if (hz.kind === "misty_tsunami") {
        // 【小霞大招・暴風海嘯（底層）】：中空碧藍擴散海嘯浪環 ＋ 10 道碎浪白沫 ＋ 外緣寒冰霜晶圈（不蓋屏、不與超武撞臉）
        ctx.translate(sx, sy);
        const ease = 1 - Math.pow(1 - Math.min(1, prog * 1.35), 2.5);
        const curR = Math.max(38, hz.radius * (0.20 + ease * 0.80));
        const fade = hz.timer < 0.32 ? Math.max(0, hz.timer / 0.32) : 1.0;

        // 1. 中空碧藍海嘯環帶（中心 0~66% 全透明，保留完美躲彈視野）
        const tGrad = ctx.createRadialGradient(0, 0, curR * 0.62, 0, 0, curR);
        tGrad.addColorStop(0, "rgba(2, 132, 199, 0.0)");
        tGrad.addColorStop(0.55, `rgba(14, 165, 233, ${fade * 0.24})`);
        tGrad.addColorStop(0.88, `rgba(186, 230, 253, ${fade * 0.36})`);
        tGrad.addColorStop(1, "rgba(56, 189, 248, 0.0)");
        ctx.fillStyle = tGrad;
        ctx.beginPath();
        ctx.arc(0, 0, curR, 0, Math.PI * 2);
        ctx.fill();

        // 2. 雙層破浪外框（碧藍主浪線 ＋ 冰白霜晶虛線）
        ctx.strokeStyle = `rgba(56, 189, 248, ${fade * 0.85})`;
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.arc(0, 0, curR, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = `rgba(224, 242, 254, ${fade * 0.82})`;
        ctx.lineWidth = 1.8;
        ctx.setLineDash([12, 8]);
        ctx.beginPath();
        ctx.arc(0, 0, curR * 0.88, now * 1.4, now * 1.4 + Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // 3. 10 道沿浪環奔湧的簡約浮世繪碎浪白沫弧
        const crestCount = 10;
        for (let w = 0; w < crestCount; w++) {
          const wa = now * 0.9 + (w * Math.PI * 2) / crestCount;
          ctx.save();
          ctx.rotate(wa);
          ctx.translate(curR * 0.94, 0);
          ctx.fillStyle = `rgba(255, 255, 255, ${fade * 0.85})`;
          ctx.beginPath();
          ctx.arc(0, -6, 3.2, 0, Math.PI * 2);
          ctx.arc(4, 0, 4.4, 0, Math.PI * 2);
          ctx.arc(0, 6, 3.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      } else if (hz.kind === "quake_fissure") {
        // 【地裂斷層破（超武・瞬爆網狀深淵龜裂）】：0.22s 指數緩出瞬間撕裂全範圍 ＋ 不規則樹狀分岔裂谷 ＋ 熔岩呼吸光 ＋ 轉折點巨岩尖柱
        ctx.translate(sx, sy);
        if (!hz.cracks) hz.cracks = this.buildQuakeCrackTree(11, hz.radius, true);
        const alpha = Math.min(1, hz.timer * 1.35);
        ctx.globalAlpha = (alpha) * sAlpha;
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

          // 外層熾熱焦土微暈（消除在亮藍水面上的枯樹枝乾硬感）
          if (!sg.isSub && baseW > 3.5) {
            ctx.strokeStyle = `rgba(234, 88, 12, ${0.34 * lavaPulse})`;
            ctx.lineWidth = baseW * 1.55;
            ctx.beginPath();
            ctx.moveTo(sg.x1, sg.y1);
            ctx.lineTo(ex, ey);
            ctx.stroke();
          }

          // 深淵暗溝底色
          ctx.strokeStyle = "#231006";
          ctx.lineWidth = Math.max(2.2, baseW * 1.08);
          ctx.beginPath();
          ctx.moveTo(sg.x1, sg.y1);
          ctx.lineTo(ex, ey);
          ctx.stroke();

          // 中層厚實熔岩熾橘呼吸光
          if (baseW > 2.4) {
            ctx.strokeStyle = `rgba(249, 115, 22, ${0.94 * lavaPulse})`;
            ctx.lineWidth = Math.max(1.6, baseW * 0.60);
            ctx.beginPath();
            ctx.moveTo(sg.x1, sg.y1);
            ctx.lineTo(ex, ey);
            ctx.stroke();
          }

          // 核心地脈金白熾流
          if (!sg.isSub && sg.wMul > 0.30) {
            ctx.strokeStyle = `rgba(254, 240, 138, ${0.96 * lavaPulse})`;
            ctx.lineWidth = Math.max(1.2, baseW * 0.26);
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
        ctx.globalAlpha = (alpha) * sAlpha;
        const curR = Math.max(36, hz.radius * Math.min(1, prog * 1.8));
        const spin = -now * 1.6;

        // 1. 次元暗物質漸層底盤（保留中央 38px 淨空，強化外圈紫粉重力張力）
        const grad = ctx.createRadialGradient(0, 0, 36, 0, 0, curR);
        grad.addColorStop(0, "rgba(15, 23, 42, 0.0)");
        grad.addColorStop(0.28, "rgba(59, 7, 100, 0.48)");
        grad.addColorStop(0.68, "rgba(168, 85, 247, 0.34)");
        grad.addColorStop(0.90, "rgba(236, 72, 153, 0.24)");
        grad.addColorStop(1, "rgba(244, 114, 182, 0.0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, curR, 0, Math.PI * 2);
        ctx.fill();

        // 2. 雙層逆向旋轉紫粉空間重力波動外環
        ctx.strokeStyle = "rgba(236, 72, 153, 0.82)";
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.arc(0, 0, curR * 0.88, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = "rgba(233, 213, 255, 0.85)";
        ctx.lineWidth = 2.0;
        ctx.setLineDash([12, 8]);
        ctx.beginPath();
        ctx.arc(0, 0, curR * 0.78, spin * 0.7, spin * 0.7 + Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // 3. 6 道清晰紫粉次元星軌光束（保持通透且具超能壓迫感）
        for (let b = 0; b < 6; b++) {
          const a = spin * 0.65 + (b * Math.PI) / 3;
          const sx0 = Math.cos(a) * 38, sy0 = Math.sin(a) * 38;
          const ex = Math.cos(a) * (curR * 0.88), ey = Math.sin(a) * (curR * 0.88);

          ctx.strokeStyle = "rgba(217, 70, 239, 0.68)";
          ctx.lineWidth = 4.2;
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
        ctx.globalAlpha = ((1 - prog) * 0.55) * sAlpha;
        const shrink = Math.max(0.15, (1 - prog) * 0.55);
        ctx.strokeStyle = "#EC4899";
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.arc(0, 0, hz.radius * shrink, 0, Math.PI * 2);
        ctx.stroke();
      } else if (hz.kind === "dragon_wave") {
        ctx.translate(sx, sy + 15);
        ctx.rotate(hz.angle || 0);
        ctx.globalAlpha = (Math.max(0, (hz.timer / hz.maxTime) * 0.30)) * sAlpha;
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
        ctx.globalAlpha = (alpha * 0.62) * sAlpha;
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
      ctx.globalAlpha = (fadeAlpha) * sAlpha;
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
      if (m.style !== "giga_impact_lance" && m.style !== "sonic_cone" && m.style !== "phantom_tackle" && m.style !== "hydro_pump_beam" && m.style !== "flamethrower_beam" && m.style !== "ice_beam_laser" && m.style !== "x_scissor" && m.style !== "shadow_claw" && m.style !== "shadow_claw_scar" && m.style !== "rock_obelisk_ult") return;
      if (m.style === "x_scissor") {
        // 真 X 形地面投影（貼合雙鐮交叉形狀，不再用生硬橢圓）
        const prog = Math.max(0, Math.min(1, 1 - (m.timer / (m.maxTime || 0.28))));
        const sx = toSx(m.x), sy = toSy(m.y) + 10;
        const r = (m.radius || 64) * 0.85;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(m.angle || 0);
        ctx.globalAlpha = Math.max(0, 1 - prog) * 0.32 * sAlpha;
        ctx.strokeStyle = "#14532D";
        ctx.lineWidth = 10;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(-r * 0.72, -r * 0.72); ctx.lineTo(r * 0.72, r * 0.72);
        ctx.moveTo(r * 0.72, -r * 0.72); ctx.lineTo(-r * 0.72, r * 0.72);
        ctx.stroke();
        ctx.restore();
        return;
      }
      if (m.style === "shadow_claw") {
        // 與空中三指利爪 100% 對齊的同座標地面投影（ox, oy 向下偏移 10px）
        const prog = Math.max(0, Math.min(1, 1 - (m.timer / (m.maxTime || 0.26))));
        const ox = toSx(m.ox !== undefined ? m.ox : m.x);
        const oy = toSy(m.oy !== undefined ? m.oy : m.y) + 10;
        const r = (m.radius || 72) * 0.88;
        const sDir = m.slashDir || 1;
        ctx.save();
        ctx.translate(ox, oy);
        ctx.rotate(m.angle || 0);
        ctx.scale(1, sDir);
        ctx.globalAlpha = Math.max(0, 1 - prog) * 0.30 * sAlpha;
        ctx.strokeStyle = m.isMegaGengar ? "#4C0519" : "#1E1B4B";
        ctx.lineCap = "round";
        const scLv = m.skillLevel || (m.isLv8 ? 8 : 1);
        const scThick = scLv <= 3 ? 1.0 : (scLv <= 7 ? (1.12 + (scLv - 3) * 0.08) : (1.56 + (scLv - 8) * 0.09));
        [-14, 0, 14].forEach((yOff, idx) => {
          ctx.lineWidth = (idx === 1 ? 8 : 5) * scThick;
          ctx.beginPath();
          ctx.moveTo(r * 0.12, yOff - r * 0.34);
          ctx.quadraticCurveTo(r * 0.62, yOff - 4, r * 0.86, yOff + r * 0.34);
          ctx.stroke();
        });
        ctx.restore();
        return;
      }
      if (m.style === "shadow_claw_scar") {
        // 【暗影爪命中焦紫／猩紅地面撕裂傷痕】：強化打擊尾韻
        const prog = Math.max(0, Math.min(1, 1 - (m.timer / (m.maxTime || 0.52))));
        const sx = toSx(m.x), sy = toSy(m.y);
        const fade = Math.max(0, 1 - prog);
        const r = m.radius || 36;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(m.angle || 0);
        ctx.scale(1, m.slashDir || 1);
        ctx.globalAlpha = fade * 0.82 * sAlpha;
        ctx.lineCap = "round";
        const scarLv = m.skillLevel || 1;
        const scarThick = scarLv <= 3 ? 1.0 : (scarLv <= 7 ? (1.12 + (scarLv - 3) * 0.08) : (1.52 + (scarLv - 8) * 0.08));
        [-10, 0, 10].forEach((yOff, idx) => {
          ctx.strokeStyle = m.isMegaGengar ? "#4C0519" : "#2E1065";
          ctx.lineWidth = (idx === 1 ? 6 : 4) * scarThick;
          ctx.beginPath();
          ctx.moveTo(-r * 0.65, yOff - r * 0.45);
          ctx.lineTo(r * 0.65, yOff + r * 0.45);
          ctx.stroke();
          ctx.strokeStyle = m.isMegaGengar ? "#FB7185" : "#E879F9";
          ctx.lineWidth = (idx === 1 ? 2.4 : 1.5) * scarThick;
          ctx.stroke();
        });
        ctx.restore();
        return;
      }
      if (m.style === "rock_obelisk_ult") {
        // 不規則鋸齒折線熔岩斷層裂縫 ＋ 地底深褐暗影塌陷坑
        const prog = Math.max(0, Math.min(1, 1 - (m.timer / (m.maxTime || 0.86))));
        const sx = toSx(m.x), sy = toSy(m.y);
        const r = m.radius || 130;
        const fade = prog < 0.72 ? 1.0 : Math.max(0, (1 - prog) / 0.28);
        const burst = Math.min(1, prog / 0.28);
        ctx.save();
        ctx.translate(sx, sy);
        ctx.globalAlpha = fade * 0.92 * sAlpha;
        // 地底深褐熔岩塌陷暗影坑
        const pitG = ctx.createRadialGradient(0, 0, 10, 0, 0, r * 0.72 * burst);
        pitG.addColorStop(0, "rgba(69, 26, 3, 0.82)");
        pitG.addColorStop(0.55, "rgba(180, 83, 9, 0.45)");
        pitG.addColorStop(1, "rgba(120, 53, 15, 0)");
        ctx.fillStyle = pitG;
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 0.72 * burst, r * 0.46 * burst, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        const arms = [
          [[0,0], [r*0.26,-6], [r*0.54,8], [r*0.82,-4]],
          [[0,0], [-r*0.28,7], [-r*0.56,-8], [-r*0.84,5]],
          [[0,0], [6,r*0.20], [-8,r*0.40], [4,r*0.58]],
          [[0,0], [-7,-r*0.18], [7,-r*0.36], [-5,-r*0.54]]
        ];
        [
          { color: "#451A03", w: 9.5 },
          { color: "#EA580C", w: 4.6 },
          { color: "#FEF08A", w: 1.9 }
        ].forEach(layer => {
          ctx.strokeStyle = layer.color;
          ctx.lineWidth = layer.w;
          ctx.beginPath();
          arms.forEach(pts => {
            ctx.moveTo(pts[0][0], pts[0][1]);
            for (let k = 1; k < pts.length; k++) {
              ctx.lineTo(pts[k][0] * burst, pts[k][1] * burst);
            }
          });
          ctx.stroke();
        });
        ctx.restore();
        return;
      }
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
        ctx.globalAlpha = (Math.max(0, (1 - prog * 0.72) * 0.36)) * sAlpha;
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
        ctx.globalAlpha = (Math.max(0, (1 - prog * 0.75) * 0.34)) * sAlpha;
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
        ctx.globalAlpha = (Math.max(0, (1 - prog * 0.75) * 0.38)) * sAlpha;
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
        ctx.globalAlpha = (Math.max(0, (1 - prog) * 0.42)) * sAlpha;
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
        ctx.globalAlpha = (Math.max(0, (1 - prog) * 0.42)) * sAlpha;
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
      ctx.globalAlpha = (Math.max(0, 1 - prog * 0.62)) * sAlpha;

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
    ctx.restore();
  },

  // ==========================================================================
  // 圖層 2：空中與特效層渲染 (renderAerialLayer) — 具象化招式與超武，嚴守 30px 主角淨空區
  // ==========================================================================
  renderAerialLayer(ctx, toSx, toSy) {
    const now = performance.now() * 0.004;
    const sAlpha = this.getPlayerSkillAlpha();
    ctx.save();
    ctx.globalAlpha = sAlpha;

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

        const pulseR = r * (0.35 + ((now * 0.55) % 0.65));
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
            const ang = now * 1.1 + h * 0.055 + strand * Math.PI;
            const hx = Math.cos(ang) * curW;
            const hy = -h + Math.sin(ang) * (curW * 0.25);
            if (h === 0) ctx.moveTo(hx, hy);
            else ctx.lineTo(hx, hy);
          }
          ctx.stroke();
        }

        // 4. 光柱頂端懸浮的立體黃金新月聖徽 (Crescent Moon Crest)
        const crestY = -pillarH * 0.78 + Math.sin(now * 1.6) * 6;
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
        // 【創世極光（高空層）】：移除貼地圓月，改由畫面上緣斜射 4 道潔白偏粉丁達爾月光柱（由單柱聚光進化為滿天月華）
        ctx.translate(sx, sy);
        const alpha = Math.sin((1 - prog) * Math.PI) * 0.85;
        ctx.globalCompositeOperation = "lighter";
        const beams = [
          { bx: -hz.radius * 0.52, by: -hz.radius * 0.14, w: 28, phase: 0.0 },
          { bx: -hz.radius * 0.14, by:  hz.radius * 0.24, w: 36, phase: 1.4 },
          { bx:  hz.radius * 0.22, by: -hz.radius * 0.18, w: 32, phase: 2.7 },
          { bx:  hz.radius * 0.56, by:  hz.radius * 0.16, w: 26, phase: 4.1 }
        ];
        beams.forEach((bm, idx) => {
          const sway = Math.sin(now * 2.2 + bm.phase) * 8;
          const topX = bm.bx + 92 + sway;
          const topY = bm.by - 270;
          const bGrad = ctx.createLinearGradient(topX, topY, bm.bx, bm.by + 12);
          bGrad.addColorStop(0, "rgba(255, 255, 255, 0.0)");
          bGrad.addColorStop(0.28, `rgba(224, 231, 255, ${alpha * 0.26})`);
          bGrad.addColorStop(0.76, idx % 2 === 0 ? `rgba(244, 114, 182, ${alpha * 0.28})` : `rgba(254, 240, 138, ${alpha * 0.26})`);
          bGrad.addColorStop(1, "rgba(244, 114, 182, 0.0)");
          ctx.fillStyle = bGrad;
          ctx.beginPath();
          ctx.moveTo(topX - bm.w * 0.42, topY);
          ctx.lineTo(topX + bm.w * 0.42, topY);
          ctx.lineTo(bm.bx + bm.w * 0.95, bm.by + 10);
          ctx.lineTo(bm.bx - bm.w * 0.95, bm.by + 10);
          ctx.closePath();
          ctx.fill();

          // 光柱落點柔和月華光斑
          ctx.fillStyle = `rgba(254, 249, 195, ${alpha * 0.28})`;
          ctx.beginPath();
          ctx.ellipse(bm.bx, bm.by + 4, bm.w * 0.72, bm.w * 0.30, 0, 0, Math.PI * 2);
          ctx.fill();
        });
      } else if (hz.kind === "serena_stage") {
        // 【莎莉娜大招・華麗雙打舞台（高空層）】：2 道克制半透明斜射追蹤聚光燈（分別照亮主角與雙打夥伴/莎莉娜）
        const fade = hz.timer < 0.5 ? Math.max(0, hz.timer / 0.5) : Math.min(1, prog * 4.0);
        const pRef = GameApp.player;
        const spotTargets = [];
        if (pRef) spotTargets.push({ x: toSx(pRef.x), y: toSy(pRef.y) + 12, fromSide: -1, rgb: "244, 114, 182" });
        if (GameApp.partners && GameApp.partners.length > 0) {
          const pt0 = GameApp.partners[0];
          spotTargets.push({ x: toSx(pt0.x), y: toSy(pt0.y) + 10, fromSide: 1, rgb: "254, 240, 138" });
        } else if (GameApp.trainerCompanion) {
          const tc = GameApp.trainerCompanion;
          spotTargets.push({ x: toSx(tc.x), y: toSy(tc.y) + 12, fromSide: 1, rgb: "254, 240, 138" });
        }

        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        spotTargets.forEach((st, idx) => {
          const sway = Math.sin(now * 2.6 + idx * 2.1) * 10;
          const srcX = st.x + st.fromSide * 135 + sway;
          const srcY = st.y - 260;

          const coneGrad = ctx.createLinearGradient(srcX, srcY, st.x, st.y);
          coneGrad.addColorStop(0, `rgba(${st.rgb}, 0.0)`);
          coneGrad.addColorStop(0.25, `rgba(${st.rgb}, ${0.18 * fade})`);
          coneGrad.addColorStop(0.85, `rgba(${st.rgb}, ${0.25 * fade})`);
          coneGrad.addColorStop(1, `rgba(${st.rgb}, 0.0)`);

          ctx.fillStyle = coneGrad;
          ctx.beginPath();
          ctx.moveTo(srcX - 10, srcY);
          ctx.lineTo(srcX + 10, srcY);
          ctx.lineTo(st.x + 36, st.y);
          ctx.lineTo(st.x - 36, st.y);
          ctx.closePath();
          ctx.fill();

          // 腳底柔和聚光圓斑
          ctx.fillStyle = `rgba(${st.rgb}, ${0.22 * fade})`;
          ctx.beginPath();
          ctx.ellipse(st.x, st.y, 34, 13, 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = `rgba(255, 255, 255, ${0.42 * fade})`;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.ellipse(st.x, st.y, 34, 13, 0, 0, Math.PI * 2);
          ctx.stroke();
        });
        ctx.restore();
      } else if (hz.kind === "misty_tsunami") {
        // 【小霞大招・暴風海嘯（高空層）】：8 枚隨浪潮向外飄散的半透明冰晶星芒
        ctx.translate(sx, sy);
        const ease = 1 - Math.pow(1 - Math.min(1, prog * 1.35), 2.5);
        const curR = Math.max(38, hz.radius * (0.20 + ease * 0.80));
        const fade = hz.timer < 0.32 ? Math.max(0, hz.timer / 0.32) : 1.0;
        ctx.globalAlpha = (fade * 0.82) * sAlpha;
        for (let k = 0; k < 8; k++) {
          const a = -now * 1.1 + (k * Math.PI * 2) / 8;
          const ix = Math.cos(a) * (curR * 0.92);
          const iy = Math.sin(a) * (curR * 0.92) - 8;
          ctx.save();
          ctx.translate(ix, iy);
          ctx.rotate(a + Math.PI / 2);
          ctx.fillStyle = "#E0F2FE";
          ctx.strokeStyle = "#0284C7";
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(0, -7); ctx.lineTo(4.2, 0); ctx.lineTo(0, 7); ctx.lineTo(-4.2, 0);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
      } else if (hz.kind === "tornado") {
        // 【暴風驟雨・3層立體流體龍捲風柱】：底層吸塵渦流 ＋ 錐形半透明流體風柱與交織S風帶 ＋ 環繞月牙風刃與飛葉
        ctx.translate(sx, sy);
        ctx.globalAlpha = (Math.min(1, hz.timer * 1.25)) * sAlpha;

        // 1. 地面風眼吸塵暗影與高速旋轉氣流圈
        ctx.fillStyle = "rgba(15, 23, 42, 0.42)";
        ctx.beginPath();
        ctx.ellipse(0, 6, hz.radius * 0.78, hz.radius * 0.36, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "rgba(186, 230, 253, 0.75)";
        ctx.lineWidth = 2.4;
        for (let g = 0; g < 3; g++) {
          const gAng = -now * 2.6 + (g * Math.PI * 2) / 3;
          ctx.beginPath();
          ctx.ellipse(0, 4, hz.radius * 0.62, hz.radius * 0.28, 0, gAng, gAng + 1.2);
          ctx.stroke();
        }

        // 2. 中層：由下往上漸寬的錐形半透明流體風柱主體
        const topSway = Math.sin(now * 2.2) * 9;
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
          const swayX = Math.sin(now * 2.4 + levelIdx * 0.7) * (3 + t * 6);

          ctx.save();
          ctx.translate(swayX, rY);
          const rot = now * (2.4 - t * 0.6) + levelIdx * 1.15;
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
        // 【龍之俯衝（v7.0 定案正式版）】：7 節動態扭動裝甲實質巨龍 ＋ 雙層龍鱗鰭刺 ＋ 烈焰龍尾鞭 ＋ 流線貝茲龍首 ＋ V 字破空音爆
        const lifeAlpha = Math.max(0, hz.timer / hz.maxTime);
        const r = hz.radius * 1.12;
        const isKing = !!hz.isDragoniteKing;
        const isMegaX = !!hz.isMegaCharizardX;
        const isMegaGyara = !!hz.isMegaGyarados;

        // 主體抬升 6px 與地面暗影拉開俯衝高度差
        ctx.save();
        ctx.translate(sx, sy - 6);

        ctx.save();
        ctx.rotate(hz.angle || 0);
        ctx.globalAlpha = (lifeAlpha) * sAlpha;

        const dWave = Math.sin(now * 5.5 + hz.x * 0.04) * 3.5;
        const gradMain = ctx.createLinearGradient(-r * 1.0, 0, r * 1.15, 0);
        if (isMegaGyara) {
          gradMain.addColorStop(0, "rgba(15, 23, 42, 0.25)");
          gradMain.addColorStop(0.45, "rgba(190, 18, 60, 0.58)");
          gradMain.addColorStop(1, "rgba(251, 113, 133, 0.88)");
        } else if (isMegaX) {
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
        const edgeCol = isMegaGyara ? "#FDA4AF" : (isMegaX ? "#67E8F9" : (isKing ? "#FEF08A" : "#7DD3FC"));
        const hornCol = isMegaGyara ? "#0F172A" : (isMegaX ? "#0F172A" : (isKing ? "#9A3412" : "#1E1B4B"));
        const eyeCol  = isMegaGyara ? "#FACC15" : (isMegaX ? "#EF4444" : (isKing ? "#38BDF8" : "#FACC15"));

        // 1A. 7 節動態扭動實質巨龍軀幹 ＋ 雙層裝甲龍鱗 ＋ 背脊能量鰭刺 ＋ 烈焰龍尾鞭
        {
          ctx.save();
          const segCount = 7;
          const bodyBaseCol = isMegaGyara ? "#0F172A" : (isMegaX ? "#0F172A" : (isKing ? "#B45309" : "#1E1B4B"));
          const scaleMidCol = isMegaGyara ? "#E11D48" : (isMegaX ? "#0284C7" : (isKing ? "#F59E0B" : "#4338CA"));
          const finGlowCol  = isMegaGyara ? "#FACC15" : (isMegaX ? "#38BDF8" : (isKing ? "#FEF08A" : "#7DD3FC"));
          const pts = [];
          for (let s = 0; s < segCount; s++) {
            const frac = s / (segCount - 1);
            const bx = -r * (0.36 + frac * 1.65);
            const sway = Math.sin(now * 5.5 - s * 0.92 + hz.x * 0.02) * (r * (0.14 + frac * 0.22));
            const segR = r * (0.42 * (1 - frac * 0.68));
            pts.push({ x: bx, y: sway, r: segR, frac });
          }

          // 尾端尖銳流體龍焰尾鞭
          const tailEnd = pts[pts.length - 1];
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.fillStyle = finGlowCol;
          ctx.beginPath();
          ctx.moveTo(tailEnd.x + 4, tailEnd.y - tailEnd.r * 0.85);
          ctx.quadraticCurveTo(tailEnd.x - r * 0.45, tailEnd.y + Math.sin(now * 7.0) * 8, tailEnd.x - r * 0.78, tailEnd.y);
          ctx.quadraticCurveTo(tailEnd.x - r * 0.45, tailEnd.y - Math.sin(now * 7.0) * 8, tailEnd.x + 4, tailEnd.y + tailEnd.r * 0.85);
          ctx.closePath();
          ctx.fill();
          ctx.restore();

          // 由尾到頭疊繪 7 節實質龍軀鱗甲，呈現強烈 3D 前後遮擋立體感
          for (let s = segCount - 1; s >= 0; s--) {
            const pt = pts[s];
            const prev = s > 0 ? pts[s - 1] : { x: r * 0.1, y: 0 };
            const segAng = Math.atan2(prev.y - pt.y, prev.x - pt.x);
            ctx.save();
            ctx.translate(pt.x, pt.y);
            ctx.rotate(segAng);

            // 深色裝甲外鱗
            ctx.fillStyle = bodyBaseCol;
            ctx.strokeStyle = finGlowCol;
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.ellipse(0, 0, pt.r * 1.18, pt.r * 0.88, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // 亮色核心龍鱗切面
            ctx.fillStyle = scaleMidCol;
            ctx.beginPath();
            ctx.moveTo(pt.r * 0.95, 0);
            ctx.lineTo(-pt.r * 0.25, -pt.r * 0.62);
            ctx.lineTo(-pt.r * 0.78, 0);
            ctx.lineTo(-pt.r * 0.25, pt.r * 0.62);
            ctx.closePath();
            ctx.fill();

            // 背脊雙側外掠能量鰭刺
            if (s < segCount - 1) {
              ctx.fillStyle = finGlowCol;
              [-1, 1].forEach(side => {
                ctx.beginPath();
                ctx.moveTo(pt.r * 0.35, side * pt.r * 0.55);
                ctx.lineTo(-pt.r * 0.65, side * pt.r * 1.25);
                ctx.lineTo(-pt.r * 0.30, side * pt.r * 0.45);
                ctx.closePath();
                ctx.fill();
              });
            }
            ctx.restore();
          }

          // 沿龍脊貫穿的高亮龍脈能量線
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.strokeStyle = "#FFFFFF";
          ctx.lineWidth = 2.2;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(r * 0.10, 0);
          pts.forEach(pt => ctx.lineTo(pt.x, pt.y));
          ctx.stroke();
          ctx.restore();
          ctx.restore();
        }

        // 1. 飄逸龍鬃焰尾（3 股貝茲流動龍氣鬃毛向後翻捲）
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        for (let m = -1; m <= 1; m++) {
          const my = m * r * 0.24;
          const tailWag = Math.sin(now * 6.5 + m * 2.1) * 5.5;
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
          const side = s === 2 ? (Math.sin(now * 11) >= 0 ? 1 : -1) : (s === 0 ? -1 : 1);
          const jitter1 = Math.sin(now * 10 + s * 3.1) * 5;
          const jitter2 = Math.cos(now * 12 + s * 4.7) * 6;
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

        ctx.restore();

      } else if (hz.kind === "x_scissor_wheel") {
        // 【終極十字星斬（空中層 v7.5.9）】：中空護體結構（中心 28px 完全留白看清主角）＋ 4 片高速彎月翡翠金星刃
        const alpha = Math.min(1, hz.timer * 3.2);
        const r = hz.radius;
        const innerGap = 30;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(hz.angle || 0);
        ctx.globalAlpha = alpha * sAlpha;
        // 內圈薄氣流護環（中空透明，不遮擋主角）
        ctx.strokeStyle = "rgba(254, 249, 195, 0.78)";
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(0, 0, innerGap, 0, Math.PI * 2);
        ctx.stroke();
        // 外圈音爆風環
        ctx.strokeStyle = "rgba(190, 242, 100, 0.72)";
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.92, 0, Math.PI * 2);
        ctx.stroke();
        // 4 片從外圍 30px 向外延伸的漸層光刃（飛天螳螂享青金殘像光暈）
        const isScy = !!hz.isScyther;
        for (let b = 0; b < 4; b++) {
          ctx.rotate(Math.PI / 2);
          const bGrad = ctx.createLinearGradient(innerGap, 0, r, 0);
          bGrad.addColorStop(0, isScy ? "#059669" : "#4D7C0F");
          bGrad.addColorStop(0.55, isScy ? "#34D399" : "#84CC16");
          bGrad.addColorStop(1, isScy ? "#FEF08A" : "#ECFCCB");
          ctx.fillStyle = bGrad;
          ctx.strokeStyle = "#14532D";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(innerGap, -8);
          ctx.quadraticCurveTo(r * 0.68, -r * 0.30, r, -4);
          ctx.quadraticCurveTo(r * 0.62, r * 0.08, innerGap, 8);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = "#FFFFFF";
          ctx.beginPath();
          ctx.moveTo(innerGap + 4, -4);
          ctx.quadraticCurveTo(r * 0.64, -r * 0.16, r * 0.88, -3);
          ctx.quadraticCurveTo(r * 0.56, 0, innerGap + 4, 2);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      } else if (hz.kind === "electro_cage_ult") {
        // 【超載磁暴球（空中層）】：3 顆藍白高壓電磁衛星繞主角公轉 ＋ 實時連接旋轉三角形閃電牢籠
        const alpha = Math.min(1, hz.timer * 2.5);
        const r = hz.radius;
        const pts = [];
        for (let k = 0; k < 3; k++) {
          const a = (hz.angle || 0) + (k * Math.PI * 2) / 3;
          pts.push({ x: sx + Math.cos(a) * r, y: sy + Math.sin(a) * r * 0.68 });
        }
        ctx.save();
        ctx.globalAlpha = alpha * sAlpha;
        // 三角形內部淡電漿磁場填充（皮卡丘家族帶青金雙色高壓光）
        ctx.fillStyle = hz.isPikachuFamily ? "rgba(56, 189, 248, 0.14)" : "rgba(250, 204, 21, 0.12)";
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y); ctx.lineTo(pts[1].x, pts[1].y); ctx.lineTo(pts[2].x, pts[2].y);
        ctx.closePath();
        ctx.fill();
        // 繪製三角形高壓閃電牢籠邊線（每條邊帶隨機鋸齒電弧）
        for (let k = 0; k < 3; k++) {
          const p1 = pts[k], p2 = pts[(k + 1) % 3];
          ctx.strokeStyle = "#38BDF8";
          ctx.lineWidth = 5.5;
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          for (let seg = 1; seg <= 5; seg++) {
            const t = seg / 6;
            const jx = (Math.sin(now * 42 + k * 7 + seg * 3.1) * 7);
            const jy = (Math.cos(now * 38 + k * 5 + seg * 2.7) * 7);
            ctx.lineTo(p1.x + (p2.x - p1.x) * t + jx, p1.y + (p2.y - p1.y) * t + jy);
          }
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();

          ctx.strokeStyle = "#FFFFFF";
          ctx.lineWidth = 2.0;
          ctx.stroke();
        }
        // 繪製 3 顆藍白金高壓衛星球
        pts.forEach((pt, idx) => {
          const g = ctx.createRadialGradient(pt.x, pt.y, 2, pt.x, pt.y, 22);
          g.addColorStop(0, "#FFFFFF");
          g.addColorStop(0.4, "#38BDF8");
          g.addColorStop(0.75, "#FACC15");
          g.addColorStop(1, "rgba(56, 189, 248, 0)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 22, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#FFFFFF";
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 7 + Math.sin(now * 28 + idx) * 1.5, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.restore();
      } else if (hz.kind === "shadow_rift_grip") {
        // 【冥界裂空爪（空中層 v7.5.9）】：兩隻帶鬼掌基部的「兩端收尖填充貝茲巨爪」由兩側向中心合掌撕裂抓握！
        const alpha = Math.min(1, hz.timer * 2.4);
        const isC = !!hz.isMegaGengar;
        const r = hz.radius * 0.76;
        const clench = prog < 0.46 ? Math.pow(prog / 0.46, 0.7) : 1.0;
        const spread = (1 - clench * 0.82) * r * 0.92;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.globalAlpha = alpha * sAlpha;
        [-1, 1].forEach(side => {
          ctx.save();
          ctx.translate(side * spread, -8);
          ctx.scale(side, 1);
          // 幽靈鬼掌基部剪影
          ctx.fillStyle = isC ? "rgba(136, 19, 55, 0.72)" : "rgba(59, 7, 100, 0.72)";
          ctx.beginPath();
          ctx.ellipse(42, 0, 18, 34, 0, 0, Math.PI * 2);
          ctx.fill();
          // 3 根立體收尖彎鉤巨爪（中爪最長最粗）
          const fingers = [
            { y0: -26, tipX: -24, tipY: -12, thick: 9.0, arch: -16 },
            { y0:   0, tipX: -36, tipY:   6, thick: 12.5, arch: -14 },
            { y0:  26, tipX: -22, tipY:  24, thick: 8.5, arch: -10 }
          ];
          fingers.forEach((fg, fi) => {
            const mx = 10, my = fg.y0 + fg.arch;
            // 深色外描邊爪體
            ctx.fillStyle = isC ? "#4C0519" : "#2E1065";
            ctx.beginPath();
            ctx.moveTo(42, fg.y0 - fg.thick * 0.65);
            ctx.quadraticCurveTo(mx, my - fg.thick * 0.8, fg.tipX, fg.tipY);
            ctx.quadraticCurveTo(mx + 4, my + fg.thick * 0.85, 42, fg.y0 + fg.thick * 0.65);
            ctx.closePath();
            ctx.fill();
            // 沿爪身漸層（深紫黑➔高飽和紫紅/猩紅➔純白爪尖）
            const fgGrad = ctx.createLinearGradient(40, fg.y0, fg.tipX, fg.tipY);
            fgGrad.addColorStop(0, isC ? "#881337" : "#4C1D95");
            fgGrad.addColorStop(0.55, isC ? "#F43F5E" : "#D946EF");
            fgGrad.addColorStop(1, "#FFFFFF");
            ctx.fillStyle = fgGrad;
            ctx.beginPath();
            ctx.moveTo(38, fg.y0 - fg.thick * 0.42);
            ctx.quadraticCurveTo(mx, my - fg.thick * 0.45, fg.tipX, fg.tipY);
            ctx.quadraticCurveTo(mx + 3, my + fg.thick * 0.45, 38, fg.y0 + fg.thick * 0.42);
            ctx.closePath();
            ctx.fill();
            // 純白爪尖鋒刃脊線
            ctx.fillStyle = "#FDF4FF";
            ctx.beginPath();
            ctx.moveTo(22, fg.y0 - fg.thick * 0.14);
            ctx.quadraticCurveTo(mx, my - fg.thick * 0.14, fg.tipX, fg.tipY);
            ctx.quadraticCurveTo(mx + 2, my + fg.thick * 0.14, 22, fg.y0 + fg.thick * 0.14);
            ctx.closePath();
            ctx.fill();
          });
          ctx.restore();
        });
        // 合掌瞬間中央暗影爆裂十字星芒
        if (prog >= 0.44 && prog <= 0.80) {
          const bp = (prog - 0.44) / 0.36;
          const st = r * 0.72 * (1 - bp * 0.4);
          ctx.fillStyle = isC ? `rgba(253, 164, 175, ${1 - bp})` : `rgba(245, 208, 254, ${1 - bp})`;
          ctx.beginPath();
          ctx.moveTo(0, -st); ctx.lineTo(st * 0.22, -st * 0.22); ctx.lineTo(st, 0);
          ctx.lineTo(st * 0.22, st * 0.22); ctx.lineTo(0, st); ctx.lineTo(-st * 0.22, st * 0.22);
          ctx.lineTo(-st, 0); ctx.lineTo(-st * 0.22, -st * 0.22); ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      } else if (hz.kind === "meteor_strike") {
        // 【天龍流星雨 v7.2.6 重製版】：深紫 ＋ 蒼藍星焰 45° 斜切墜落 ＋ 高空次元裂隙 ＋ 燃燒彗尾 ＋ 銳角黑曜龍晶隕岩
        const riftX = toSx(hz.startX), riftY = toSy(hz.startY);
        const easeProg = Math.pow(prog, 1.35);
        const curX = toSx(hz.startX + (hz.x - hz.startX) * easeProg);
        const curY = toSy(hz.startY + (hz.y - hz.startY) * easeProg);
        const flyAng = Math.atan2(sy - riftY, sx - riftX);
        const isMegaBlue = !!hz.isMegaBlueFlame;

        // 1. 地面落點深紫暗影 ＋ 內縮鎖定讀條星環
        ctx.fillStyle = `rgba(30, 16, 66, ${0.22 + easeProg * 0.34})`;
        ctx.beginPath();
        ctx.ellipse(sx, sy, hz.radius * (0.28 + easeProg * 0.50), hz.radius * 0.44 * (0.28 + easeProg * 0.50), 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = isMegaBlue ? "rgba(56, 189, 248, 0.85)" : "rgba(168, 85, 247, 0.82)";
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.ellipse(sx, sy, hz.radius * 0.78, hz.radius * 0.40, 0, 0, Math.PI * 2);
        ctx.stroke();

        const shrinkFrac = Math.max(0.14, 1 - easeProg * 0.86);
        ctx.strokeStyle = "rgba(103, 232, 249, 0.90)";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.ellipse(sx, sy, hz.radius * 0.78 * shrinkFrac, hz.radius * 0.40 * shrinkFrac, 0, 0, Math.PI * 2);
        ctx.stroke();

        // 2. 高空斜向暗紫次元星縫（取代原本飛碟雲朵，隨流星劃出漸隱）
        const riftAlpha = Math.max(0, 1 - prog * 1.15);
        if (riftAlpha > 0.04) {
          ctx.save();
          ctx.translate(riftX, riftY);
          ctx.rotate(flyAng + Math.PI * 0.5);
          ctx.globalAlpha = riftAlpha * sAlpha;

          const rGlow = ctx.createRadialGradient(0, 0, 2, 0, 0, 34);
          rGlow.addColorStop(0, isMegaBlue ? "rgba(224, 242, 254, 0.92)" : "rgba(192, 132, 252, 0.85)");
          rGlow.addColorStop(0.5, "rgba(56, 189, 248, 0.45)");
          rGlow.addColorStop(1, "rgba(46, 16, 101, 0)");
          ctx.fillStyle = rGlow;
          ctx.beginPath();
          ctx.ellipse(0, 0, 34, 14, 0, 0, Math.PI * 2);
          ctx.fill();

          // 銳利裂隙黑紫核心與蒼藍邊緣
          ctx.fillStyle = "#1E103C";
          ctx.strokeStyle = "#38BDF8";
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.moveTo(-28, 0);
          ctx.quadraticCurveTo(0, -7, 28, 0);
          ctx.quadraticCurveTo(0, 7, -28, 0);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }

        // 3. 45° 斜切多層燃燒彗尾（深紫龍氣外尾 ➔ 蒼藍星焰中尾 ➔ 純白熾核）
        ctx.save();
        ctx.translate(curX, curY);
        ctx.rotate(flyAng);
        const tailLen = Math.min(132, 55 + easeProg * 88);
        const wag = Math.sin(now * 16 + (hz.seed || 0)) * 4.5;

        // 外層深紫龍氣長尾
        const tailOuter = ctx.createLinearGradient(0, 0, -tailLen, 0);
        tailOuter.addColorStop(0, isMegaBlue ? "rgba(14, 165, 233, 0.90)" : "rgba(124, 58, 237, 0.92)");
        tailOuter.addColorStop(0.55, isMegaBlue ? "rgba(37, 99, 235, 0.48)" : "rgba(91, 33, 182, 0.48)");
        tailOuter.addColorStop(1, "rgba(46, 16, 101, 0)");
        ctx.fillStyle = tailOuter;
        ctx.beginPath();
        ctx.moveTo(6, -15);
        ctx.quadraticCurveTo(-tailLen * 0.45, -14 + wag, -tailLen, wag * 0.6);
        ctx.quadraticCurveTo(-tailLen * 0.45, 14 + wag, 6, 15);
        ctx.closePath();
        ctx.fill();

        // 中層蒼藍電青星焰尾
        const tailMid = ctx.createLinearGradient(0, 0, -tailLen * 0.82, 0);
        tailMid.addColorStop(0, "#67E8F9");
        tailMid.addColorStop(0.55, "rgba(56, 189, 248, 0.65)");
        tailMid.addColorStop(1, "rgba(56, 189, 248, 0)");
        ctx.fillStyle = tailMid;
        ctx.beginPath();
        ctx.moveTo(8, -9);
        ctx.quadraticCurveTo(-tailLen * 0.36, -7 - wag * 0.5, -tailLen * 0.82, -wag * 0.3);
        ctx.quadraticCurveTo(-tailLen * 0.36, 7 - wag * 0.5, 8, 9);
        ctx.closePath();
        ctx.fill();

        // 內層純白熾熱彗心尾
        const tailCore = ctx.createLinearGradient(4, 0, -tailLen * 0.48, 0);
        tailCore.addColorStop(0, "#FFFFFF");
        tailCore.addColorStop(1, "rgba(224, 242, 254, 0)");
        ctx.fillStyle = tailCore;
        ctx.beginPath();
        ctx.moveTo(8, -4);
        ctx.lineTo(-tailLen * 0.48, 0);
        ctx.lineTo(8, 4);
        ctx.closePath();
        ctx.fill();

        // 沿彗尾飛散的 3 顆菱形星焰碎屑
        [-0.32, -0.58, -0.80].forEach((f, idx) => {
          const sxp = tailLen * f;
          const syp = (idx % 2 === 0 ? -1 : 1) * (5 + idx * 2.5) + wag * 0.4;
          ctx.fillStyle = idx === 1 ? "#E0F2FE" : (isMegaBlue ? "#38BDF8" : "#C084FC");
          ctx.beginPath();
          ctx.arc(sxp, syp, 2.8 - idx * 0.5, 0, Math.PI * 2);
          ctx.fill();
        });

        // 4. 不規則銳角黑曜龍晶隕岩本體 ＋ 發光蒼藍裂紋
        ctx.save();
        ctx.rotate(now * 4.5 + (hz.seed || 0));
        ctx.fillStyle = "#1E103C";
        ctx.strokeStyle = isMegaBlue ? "#67E8F9" : "#C084FC";
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(15, -2);
        ctx.lineTo(9, -12);
        ctx.lineTo(-4, -14);
        ctx.lineTo(-14, -6);
        ctx.lineTo(-12, 8);
        ctx.lineTo(-2, 14);
        ctx.lineTo(11, 10);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 隕岩內部發光蒼藍星紋裂痕與熾白晶核
        ctx.strokeStyle = "#38BDF8";
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.moveTo(-8, -5); ctx.lineTo(0, 0); ctx.lineTo(10, -4);
        ctx.moveTo(0, 0); ctx.lineTo(-3, 9);
        ctx.moveTo(0, 0); ctx.lineTo(7, 6);
        ctx.stroke();

        ctx.fillStyle = "#E0F2FE";
        ctx.beginPath();
        ctx.arc(1, 0, 4.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // 隕石迎風破空弧光
        ctx.strokeStyle = "#E0F2FE";
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(4, 0, 16, -0.95, 0.95);
        ctx.stroke();
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
          ctx.globalAlpha = (cloudAlpha) * sAlpha;

          // 1. 地面烏雲投射暗影 (拉開高空與地面的 3D 空間距離)
          ctx.fillStyle = "rgba(15, 23, 42, 0.38)";
          ctx.beginPath();
          ctx.ellipse(px, py + 4, 38, 15, 0, 0, Math.PI * 2);
          ctx.fill();

          // 2. 落雷瞬間的垂直三層白熾天罰雷柱（畫在雲朵下半部後方，彷彿從雲肚子裡劈出）
          if (localAge >= 0 && localAge <= 0.65) {
            const boltAlpha = Math.max(0, 1 - localAge / 0.65);
            ctx.save();
            ctx.globalAlpha = (boltAlpha * cloudAlpha) * sAlpha;

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
        ctx.globalAlpha = (alpha) * sAlpha;
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
        ctx.globalAlpha = (alpha) * sAlpha;
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
        ctx.globalAlpha = (alpha) * sAlpha;
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
        ctx.globalAlpha = (alpha) * sAlpha;
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

          // 粉紫念力反重力光暈底襯（讓浮空碎石與鏡面在任何地形皆立體搶眼）
          const pHalo = ctx.createRadialGradient(0, 0, 2, 0, 0, 18);
          pHalo.addColorStop(0, "rgba(244, 114, 182, 0.62)");
          pHalo.addColorStop(1, "rgba(168, 85, 247, 0)");
          ctx.fillStyle = pHalo;
          ctx.beginPath();
          ctx.arc(0, 0, 18, 0, Math.PI * 2);
          ctx.fill();

          if (isMirror) {
            // 次元鏡面菱片（粉紫半透明折射面＋純白星芒高光）
            ctx.fillStyle = "rgba(236, 72, 153, 0.68)";
            ctx.strokeStyle = "#FFFFFF";
            ctx.lineWidth = 2.0;
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
      ctx.globalAlpha = (Math.max(0, 1 - prog * 0.72)) * sAlpha;

      if (m.style === "cast_origin_ring") {
        // 起手發力氣爆環（電球靜電脈衝／毒擊毒霧噴口／岩崩震地起手）
        const sx = toSx(m.x), sy = toSy(m.y);
        const r = (m.radius || 24) * (0.4 + prog * 0.9);
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(m.angle || 0);
        ctx.globalAlpha = Math.max(0, 1 - prog) * 0.85 * sAlpha;
        ctx.strokeStyle = m.color || "#FEF08A";
        ctx.lineWidth = 3.2 * (1 - prog) + 0.8;
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 0.45, r, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else if (m.style === "shadow_claw_scar") {
        // 已於地面底層繪製
      } else if (m.style === "rock_slide_impact") {
        // 【岩崩 v7.5.7】：縮小體積至 14-19px 實心像素主岩＋2顆副碎岩錯落天墜，內縮地面鎖定圈➔砸地碎裂飛石（無幽靈半透明）
        const sx = toSx(m.x), sy = toSy(m.y);
        const r = m.radius || 44;
        const br = m.visualRockR || 16;
        const dropFrac = Math.min(1, prog / 0.28);
        const easeDrop = dropFrac * dropFrac;
        const fallX = (1 - easeDrop) * 34;
        const fallY = (1 - easeDrop) * 98;
        const seed = m.seed || 1.7;
        ctx.save();
        ctx.translate(sx, sy);

        // 1. 內縮鎖定陰影圈（對齊天龍流星雨手感）
        ctx.fillStyle = `rgba(28, 14, 5, ${0.26 + easeDrop * 0.36})`;
        ctx.beginPath();
        ctx.ellipse(0, 4, br * (0.65 + easeDrop * 0.55), br * 0.42 * (0.65 + easeDrop * 0.55), 0, 0, Math.PI * 2);
        ctx.fill();
        if (dropFrac < 0.92) {
          const shrink = Math.max(0.2, 1 - easeDrop * 0.8);
          ctx.strokeStyle = "rgba(251, 191, 36, 0.85)";
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.ellipse(0, 4, r * 0.65 * shrink, r * 0.34 * shrink, 0, 0, Math.PI * 2);
          ctx.stroke();
        }

        // 2. 砸地碎裂：短促土塵環 ＋ 飛散實心碎石塊（主岩砸地後直接碎裂，不半透明殘留）
        if (dropFrac >= 0.88) {
          const ringP = Math.max(0, (prog - 0.24) / 0.76);
          const fade = Math.max(0, 1 - ringP);
          ctx.strokeStyle = (m.isAeroRock || m.isLv8) ? `rgba(253, 224, 71, ${fade * 0.95})` : `rgba(217, 119, 6, ${fade * 0.92})`;
          ctx.lineWidth = ((m.isAeroRock || m.isLv8) ? 4.2 : 3.2) * fade + 1;
          ctx.beginPath();
          ctx.ellipse(0, 4, r * (0.32 + ringP * 0.68), r * 0.30 * (0.32 + ringP * 0.68), 0, 0, Math.PI * 2);
          ctx.stroke();
          if (m.isAeroRock) {
            ctx.strokeStyle = `rgba(254, 249, 195, ${fade * 0.85})`;
            ctx.lineWidth = 2.0 * fade + 0.6;
            ctx.beginPath();
            ctx.ellipse(0, 4, r * (0.48 + ringP * 0.78), r * 0.36 * (0.48 + ringP * 0.78), 0, 0, Math.PI * 2);
            ctx.stroke();
          }
          for (let pIdx = 0; pIdx < 6; pIdx++) {
            const pa = seed * 2 + pIdx * 1.05;
            const pd = r * (0.18 + ringP * 0.78);
            const px = Math.cos(pa) * pd;
            const py = Math.sin(pa) * pd * 0.48 - Math.sin(ringP * Math.PI) * 24;
            const sz = pIdx % 2 === 0 ? 6 : 4;
            ctx.fillStyle = pIdx % 2 === 0 ? "#B45309" : "#F59E0B";
            ctx.fillRect(px - sz / 2, py - sz / 2, sz, sz);
            ctx.strokeStyle = "#1C0D04";
            ctx.lineWidth = 1.2;
            ctx.strokeRect(px - sz / 2, py - sz / 2, sz, sz);
          }
        }

        // 3. 墜落熱浪沙塵彗尾（對齊天龍流星雨天降感）＋ 實心漸層像素主岩與副碎岩
        if (prog < 0.44) {
          ctx.save();
          ctx.globalAlpha = sAlpha;
          ctx.translate(fallX, -fallY);
          if (dropFrac < 0.96) {
            const tailG = ctx.createLinearGradient(0, 0, 36, -68);
            tailG.addColorStop(0, m.isAeroRock ? "rgba(254, 240, 138, 0.85)" : "rgba(251, 191, 36, 0.72)");
            tailG.addColorStop(0.5, m.isLv8 ? "rgba(234, 88, 12, 0.48)" : "rgba(217, 119, 6, 0.38)");
            tailG.addColorStop(1, "rgba(180, 83, 9, 0)");
            ctx.fillStyle = tailG;
            ctx.beginPath();
            ctx.moveTo(-br * 0.75, -br * 0.2);
            ctx.lineTo(36, -68);
            ctx.lineTo(br * 0.85, br * 0.2);
            ctx.closePath();
            ctx.fill();
          }
          const drawPixelRock = (ox, oy, rr) => {
            ctx.save();
            ctx.translate(ox, oy);
            // 對齊地震與岩崩 Icon 暖沙金褐高明度色盤（暗面 #78350F ➔ 主面 #D97706 ➔ 受光面 #FBBF24 ➔ 稜線高光 #FEF3C7）
            ctx.fillStyle = "#78350F";
            ctx.strokeStyle = "#451A03";
            ctx.lineWidth = 2.0;
            ctx.beginPath();
            ctx.moveTo(-rr * 0.9, rr * 0.2); ctx.lineTo(-rr * 0.6, -rr * 0.75);
            ctx.lineTo(rr * 0.2, -rr * 0.95); ctx.lineTo(rr * 0.9, -rr * 0.25);
            ctx.lineTo(rr * 0.7, rr * 0.65); ctx.lineTo(-rr * 0.25, rr * 0.85);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = "#D97706";
            ctx.beginPath();
            ctx.moveTo(-rr * 0.78, rr * 0.12); ctx.lineTo(-rr * 0.54, -rr * 0.68);
            ctx.lineTo(rr * 0.18, -rr * 0.86); ctx.lineTo(rr * 0.56, -rr * 0.05);
            ctx.lineTo(-rr * 0.15, rr * 0.52);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = "#FBBF24";
            ctx.beginPath();
            ctx.moveTo(-rr * 0.48, -rr * 0.58); ctx.lineTo(rr * 0.18, -rr * 0.82);
            ctx.lineTo(rr * 0.66, -rr * 0.25); ctx.lineTo(rr * 0.10, -rr * 0.08);
            ctx.closePath();
            ctx.fill();
            // 稜線銳利暖金高光（化石翼龍升級太古耀金晶面；Lv.8 岩體內嵌熾橘熔岩裂紋！）
            if (m.isAeroRock) {
              ctx.fillStyle = "#FEF08A";
              ctx.beginPath();
              ctx.moveTo(-rr * 0.45, -rr * 0.52); ctx.lineTo(rr * 0.18, -rr * 0.84);
              ctx.lineTo(rr * 0.68, -rr * 0.22); ctx.lineTo(rr * 0.05, rr * 0.08); ctx.closePath();
              ctx.fill();
            }
            if (m.isLv8) {
              ctx.strokeStyle = "#EA580C";
              ctx.lineWidth = 2.4;
              ctx.beginPath();
              ctx.moveTo(-rr * 0.42, rr * 0.32); ctx.lineTo(0, -rr * 0.05); ctx.lineTo(rr * 0.45, rr * 0.25);
              ctx.stroke();
              ctx.strokeStyle = "#FEF08A";
              ctx.lineWidth = 1.1;
              ctx.stroke();
            }
            ctx.strokeStyle = m.isAeroRock ? "#FFFFFF" : "#FEF3C7";
            ctx.lineWidth = m.isAeroRock ? 2.2 : 1.6;
            ctx.beginPath();
            ctx.moveTo(-rr * 0.46, -rr * 0.54); ctx.lineTo(rr * 0.16, -rr * 0.78); ctx.lineTo(rr * 0.56, -rr * 0.26);
            ctx.stroke();
            ctx.restore();
          };
          drawPixelRock(0, 0, br);
          drawPixelRock(-br * 1.05, -br * 0.7, br * 0.46);
          drawPixelRock(br * 0.95, -br * 0.85, br * 0.42);
          ctx.restore();
        }
        ctx.restore();
      } else if (m.style === "rock_obelisk_ult") {
        // 【大陸板塊崩落（空中層）】：巨型深褐黑曜「尖碑岩柱」從正上方轟然砸落
        const sx = toSx(m.x), sy = toSy(m.y);
        const dropFrac = Math.min(1, prog / 0.28);
        const fallY = (1 - dropFrac * dropFrac) * 185;
        const fade = prog < 0.75 ? 1.0 : Math.max(0, (1 - prog) / 0.25);
        ctx.save();
        ctx.translate(sx, sy - fallY);
        ctx.globalAlpha = fade * sAlpha;
        // 暖岩熔金尖碑本體（提亮對齊地震暖沙金琥珀色盤）
        ctx.fillStyle = "#78350F";
        ctx.strokeStyle = "#451A03";
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.moveTo(-26, 12); ctx.lineTo(-32, -62); ctx.lineTo(0, -96); ctx.lineTo(32, -62); ctx.lineTo(26, 12);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // 暖岩熔金漸層受光切面
        const obGrad = ctx.createLinearGradient(-26, -90, 26, 12);
        obGrad.addColorStop(0, m.isAeroRock ? "#FEF08A" : "#FBBF24");
        obGrad.addColorStop(0.5, "#D97706");
        obGrad.addColorStop(1, "#78350F");
        ctx.fillStyle = obGrad;
        ctx.beginPath();
        ctx.moveTo(-22, 9); ctx.lineTo(-27, -58); ctx.lineTo(0, -90); ctx.lineTo(4, 9); ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#FBBF24";
        ctx.beginPath();
        ctx.moveTo(-18, -52); ctx.lineTo(0, -88); ctx.lineTo(14, -54); ctx.lineTo(-2, -32); ctx.closePath();
        ctx.fill();
        // 耀眼熔金裂紋
        ctx.strokeStyle = "#FEF3C7";
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.moveTo(0, -84); ctx.lineTo(-8, -42); ctx.lineTo(7, -18); ctx.lineTo(-2, 8);
        ctx.stroke();
        ctx.restore();
      } else if (m.style === "poison_burst_ring") {
        // 【毒擊毒爆飛濺衝擊 v7.5.9】：中心紫綠內爆閃光 ➔ 7向不規則放射毒液尖刺噴濺 ＋ 爆裂毒泡（徹底移除突兀空心圓）
        const sx = toSx(m.x), sy = toSy(m.y);
        const maxR = m.radius || 44;
        const burst = Math.sin(Math.min(1, prog * 1.35) * Math.PI * 0.5);
        const fade = Math.max(0, 1 - prog);
        const seed = m.seed || 2.1;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.globalAlpha = fade * sAlpha;

        // 1. 中心高熱紫綠內爆核（前 45% 瞬爆收縮）
        if (prog < 0.55) {
          const coreR = maxR * 0.52 * (1 - prog / 0.55);
          const cg = ctx.createRadialGradient(0, 0, 2, 0, 0, coreR);
          cg.addColorStop(0, "#FFFFFF");
          cg.addColorStop(0.45, "#4ADE80");
          cg.addColorStop(1, "rgba(168, 85, 247, 0)");
          ctx.fillStyle = cg;
          ctx.beginPath();
          ctx.arc(0, 0, coreR, 0, Math.PI * 2);
          ctx.fill();
        }
        // 2. 7 向不規則放射毒液飛濺尖刺
        for (let k = 0; k < 7; k++) {
          const a = seed + (k * Math.PI * 2) / 7 + (k % 2) * 0.18;
          const len = maxR * (0.55 + (k % 3) * 0.22) * burst;
          const w = (5.5 - prog * 3.2);
          ctx.save();
          ctx.rotate(a);
          ctx.fillStyle = k % 2 === 0 ? "#4ADE80" : "#D946EF";
          ctx.beginPath();
          ctx.moveTo(len * 0.25, -w);
          ctx.lineTo(len, 0);
          ctx.lineTo(len * 0.25, w);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
        ctx.restore();
      } else if (m.style === "poison_crystal_core") {
        // 【劇毒新星（凝聚紫綠毒晶核）】
        const sx = toSx(m.x), sy = toSy(m.y);
        const r = (m.radius || 70) * (0.3 + Math.sin(prog * Math.PI) * 0.75);
        ctx.save();
        ctx.translate(sx, sy);
        ctx.globalAlpha = Math.max(0, 1 - prog * 0.7) * sAlpha;
        const g = ctx.createRadialGradient(0, 0, 4, 0, 0, r);
        g.addColorStop(0, "#FFFFFF");
        g.addColorStop(0.4, "#4ADE80");
        g.addColorStop(0.75, "#A855F7");
        g.addColorStop(1, "rgba(88, 28, 135, 0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (m.style === "x_scissor") {
        // 【十字剪 v7.5.7】：錯落兩段彎月刀光 Smear Arc（左鐮先劈➔0.06s右鐮反劈）＋ 交點白金星芒與飛散青綠火花
        const sx = toSx(m.x), sy = toSy(m.y);
        const r = m.radius || 72;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(m.angle || 0);

        const drawCrescentSlash = (rotAng, localProg, flipArc) => {
          if (localProg <= 0) return;
          const pClamped = Math.min(1, localProg);
          const sweep = 0.45 + Math.sin(pClamped * Math.PI * 0.5) * 0.65;
          ctx.save();
          ctx.rotate(rotAng);
          ctx.scale(1, flipArc ? -1 : 1);
          const L = r * sweep;
          const curveH = r * 0.34 * sweep;
          // 深綠像素暗影描邊
          ctx.fillStyle = "#14532D";
          ctx.beginPath();
          ctx.moveTo(-L * 1.05, curveH * 0.35);
          ctx.quadraticCurveTo(0, -curveH * 1.25, L * 1.05, curveH * 0.35);
          ctx.quadraticCurveTo(0, -curveH * 0.25, -L * 1.05, curveH * 0.35);
          ctx.fill();
          // 三段漸層光刃（飛天螳螂切換高辨識度青碧➔亮金光刃；一般蟲系為翡翠亮綠）
          const xGrad = ctx.createLinearGradient(-L, 0, L, 0);
          xGrad.addColorStop(0, m.isScyther ? "#0891B2" : "#4D7C0F");
          xGrad.addColorStop(0.5, m.isScyther ? "#22D3EE" : "#84CC16");
          xGrad.addColorStop(1, (m.isScyther || m.isLv8) ? "#FDE047" : "#D9F99D");
          ctx.fillStyle = xGrad;
          ctx.beginPath();
          ctx.moveTo(-L * 0.96, curveH * 0.28);
          ctx.quadraticCurveTo(0, -curveH * 1.05, L * 0.96, curveH * 0.28);
          ctx.quadraticCurveTo(0, -curveH * 0.32, -L * 0.96, curveH * 0.28);
          ctx.fill();
          // 飛天螳螂／Lv.8 專屬亮金外緣月牙鋒線（覆蓋在主刀光上緣，在深綠草地一眼分明！）
          if (m.isScyther || m.isLv8) {
            ctx.strokeStyle = m.isScyther ? "#FDE047" : "#67E8F9";
            ctx.lineWidth = m.isScyther ? 3.2 : 2.4;
            ctx.beginPath();
            ctx.moveTo(-L * 1.02, curveH * 0.24);
            ctx.quadraticCurveTo(0, -curveH * 1.24, L * 1.02, curveH * 0.24);
            ctx.stroke();
          }
          // 純白高銳度鋒刃芯
          ctx.fillStyle = "#FFFFFF";
          ctx.beginPath();
          ctx.moveTo(-L * 0.78, curveH * 0.14);
          ctx.quadraticCurveTo(0, -curveH * 0.78, L * 0.78, curveH * 0.14);
          ctx.quadraticCurveTo(0, -curveH * 0.45, -L * 0.78, curveH * 0.14);
          ctx.fill();
          ctx.restore();
        };

        drawCrescentSlash(-Math.PI / 4, prog * 1.6, false);
        drawCrescentSlash(Math.PI / 4, (prog - 0.18) * 1.8, true);

        // 雙鐮交點爆裂白金星芒 ＋ 四散像素青綠火花
        if (prog >= 0.18) {
          const sp = Math.min(1, (prog - 0.18) / 0.82);
          const starR = r * 0.42 * (1 - sp * 0.45);
          ctx.fillStyle = "#FEF9C3";
          ctx.beginPath();
          ctx.moveTo(0, -starR); ctx.lineTo(starR * 0.24, -starR * 0.24); ctx.lineTo(starR, 0);
          ctx.lineTo(starR * 0.24, starR * 0.24); ctx.lineTo(0, starR); ctx.lineTo(-starR * 0.24, starR * 0.24);
          ctx.lineTo(-starR, 0); ctx.lineTo(-starR * 0.24, -starR * 0.24); ctx.closePath();
          ctx.fill();
          for (let k = 0; k < 6; k++) {
            const ka = k * 1.05 + 0.3;
            const kd = r * (0.25 + sp * 0.75);
            ctx.fillStyle = m.isScyther ? (k % 2 === 0 ? "#22D3EE" : "#FDE047") : (m.isLv8 ? (k % 2 === 0 ? "#67E8F9" : "#BEF264") : (k % 2 === 0 ? "#BEF264" : "#FFFFFF"));
            ctx.fillRect(Math.cos(ka) * kd - 2.5, Math.sin(ka) * kd - 2.5, 5, 5);
          }
        }
        ctx.restore();
      } else if (m.style === "shadow_claw") {
        // 【暗影爪 v7.5.9】：斜向左上➔右下（反手右上➔左下）三指收尖利爪 ＋ 每條爪尾專屬幽冥火舌與動態火星！
        const ox = toSx(m.ox !== undefined ? m.ox : m.x);
        const oy = toSy(m.oy !== undefined ? m.oy : m.y);
        const r = (m.radius || 74) * 1.05;
        const sweep = Math.min(1, prog * 2.2);
        const isCrimson = !!m.isMegaGengar;
        const sDir = m.slashDir || 1;
        ctx.save();
        ctx.translate(ox, oy);
        ctx.rotate(m.angle || 0);
        ctx.scale(1, sDir);

        // v7.8.7 暗影爪隨升級分階加粗（Lv1-3: 1.0x ➔ Lv4-7: 1.20-1.44x ➔ Lv8-10: 1.56-1.74x 厚實冥界巨爪）
        const clawLv = m.skillLevel || (m.isLv8 ? 8 : 1);
        const thickMult = clawLv <= 3 ? 1.0 : (clawLv <= 7 ? (1.12 + (clawLv - 3) * 0.08) : (1.56 + (clawLv - 8) * 0.09));
        const gapMult = 1 + (thickMult - 1) * 0.34;
        const claws = [
          { yBase: -r * 0.24 * gapMult, len: r * (0.90 + (thickMult - 1) * 0.14), thick: 9.0  * thickMult, tilt: -0.14 },
          { yBase:  0,                  len: r * (1.12 + (thickMult - 1) * 0.16), thick: 12.8 * thickMult, tilt:  0.00 },
          { yBase:  r * 0.24 * gapMult, len: r * (0.88 + (thickMult - 1) * 0.14), thick: 8.8  * thickMult, tilt:  0.14 }
        ];
        claws.forEach((cl, idx) => {
          ctx.save();
          ctx.translate(r * 0.16, cl.yBase);
          ctx.rotate(cl.tilt);
          const curL = cl.len * (0.30 + sweep * 0.70);
          const halfT = cl.thick * 0.5 * (1 - prog * 0.22);
          // 左上起手 (-0.08, -0.46) ➔ 中段外拱 (+0.52, -0.12) ➔ 右下鉤尖 (+0.86, +0.46)
          const sx0 = -curL * 0.08, sy0 = -curL * 0.46;
          const mx  =  curL * 0.52, my  = -curL * 0.12;
          const tx  =  curL * 0.86, ty  =  curL * 0.46;

          // 每條爪尾部的幽冥火焰尾翼（隨揮爪拉長跳動，強烈動感）
          const fLen = 14 + Math.sin(now * 32 + idx * 2.1) * 5;
          ctx.fillStyle = isCrimson ? "rgba(225, 29, 72, 0.72)" : "rgba(147, 51, 234, 0.72)";
          ctx.beginPath();
          ctx.moveTo(sx0, sy0);
          ctx.lineTo(sx0 - fLen, sy0 - fLen * 0.55);
          ctx.lineTo(sx0 + 6, sy0 + 7);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = isCrimson ? "#FDA4AF" : "#F0ABFC";
          ctx.fillRect(sx0 - fLen * 0.7, sy0 - fLen * 0.4, 4, 4);

          // 外層暗影深紫／深紅描邊爪體
          ctx.fillStyle = isCrimson ? "#4C0519" : "#2E1065";
          ctx.beginPath();
          ctx.moveTo(sx0, sy0);
          ctx.quadraticCurveTo(mx + halfT * 1.45, my - halfT * 0.85, tx, ty);
          ctx.quadraticCurveTo(mx - halfT * 1.05, my + halfT * 0.85, sx0, sy0);
          ctx.closePath();
          ctx.fill();

          // Lv.8 額外半透明幽冥殘像爪
          if (m.isLv8) {
            ctx.fillStyle = isCrimson ? "rgba(251, 113, 133, 0.32)" : "rgba(232, 121, 249, 0.32)";
            ctx.beginPath();
            ctx.moveTo(sx0 - 6, sy0 - 4);
            ctx.quadraticCurveTo(mx + halfT * 1.6, my - halfT * 1.1, tx + 4, ty + 3);
            ctx.quadraticCurveTo(mx - halfT * 0.9, my + halfT * 0.9, sx0 - 6, sy0 - 4);
            ctx.closePath();
            ctx.fill();
          }
          // 中層沿爪身三段線性漸層（深紫黑➔高飽和紫紅/猩紅➔尖端純白）
          const clGrad = ctx.createLinearGradient(sx0, sy0, tx, ty);
          clGrad.addColorStop(0, isCrimson ? "#881337" : "#581C87");
          clGrad.addColorStop(0.55, isCrimson ? (idx === 1 ? "#FB7185" : "#E11D48") : (idx === 1 ? "#F0ABFC" : "#C026D3"));
          clGrad.addColorStop(1, "#FFFFFF");
          ctx.fillStyle = clGrad;
          ctx.beginPath();
          ctx.moveTo(sx0 + 3, sy0 + 3);
          ctx.quadraticCurveTo(mx + halfT * 0.92, my - halfT * 0.52, tx, ty);
          ctx.quadraticCurveTo(mx - halfT * 0.52, my + halfT * 0.52, sx0 + 3, sy0 + 3);
          ctx.closePath();
          ctx.fill();

          // 內層純白尖銳高光脊線
          ctx.fillStyle = "#FDF4FF";
          ctx.beginPath();
          ctx.moveTo(mx * 0.32, sy0 * 0.45);
          ctx.quadraticCurveTo(mx + halfT * 0.34, my - halfT * 0.18, tx, ty);
          ctx.quadraticCurveTo(mx - halfT * 0.10, my + halfT * 0.16, mx * 0.32, sy0 * 0.45);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        });
        ctx.restore();
      } else if (m.style === "hydro_pump_beam") {
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
        ctx.globalAlpha = (alpha) * sAlpha;

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
          const wave = Math.sin(now * 9.5 - x * 0.085) * 2.6 * wScale;
          ctx.lineTo(x, -halfW * taper + wave);
        }
        ctx.lineTo(curLen + 6, 0);
        for (let x = curLen; x >= 0; x -= stepPx) {
          const taper = 0.84 + (x / Math.max(1, curLen)) * 0.26;
          const wave = Math.sin(now * 9.5 - x * 0.085 + 1.4) * 2.6 * wScale;
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
            const y = Math.sin(x * 0.095 - now * 11 + (strand * Math.PI * 2) / strandCount) * amp;
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
          const jitter = Math.sin(now * 9.0 + idx * 1.7) * 2.5;
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
        ctx.globalAlpha = (alpha) * sAlpha;

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
            const curl = Math.sin(now * 10 - x * 0.095 + phaseShift) * (3.2 + t * 5.2) * ampMul * wScale;
            ctx.lineTo(x, -baseHalf + curl);
          }
          ctx.lineTo(lim + 10 * wMul, Math.sin(now * 9.0 + phaseShift) * 3.5);
          for (let x = lim; x >= 0; x -= stepPx) {
            const t = x / Math.max(1, curLen);
            const baseHalf = (sW + (eW - sW) * t) * wMul;
            const curl = Math.sin(now * 10 - x * 0.095 + phaseShift + 2.1) * (3.2 + t * 5.2) * ampMul * wScale;
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
          const jit = Math.sin(now * 9.5 + idx * 1.9) * 3.0;
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
        ctx.globalAlpha = (alpha) * sAlpha;
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
        ctx.globalAlpha = (fade * 0.92) * sAlpha;

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
        ctx.globalAlpha = (fade) * sAlpha;

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
        // 【藤鞭 v7.1.4 漸細流線版】：根部 8px ➔ 尖端收尖 2px 自然 S 型甩鞭 ＋ 倒刺花瓣 ＋ 銳利月牙鞭爆
        const osx = toSx(m.ox !== undefined ? m.ox : m.x);
        const osy = toSy(m.oy !== undefined ? m.oy : m.y);
        const isVenu = !!m.isVenusaurWhip;
        ctx.save();
        ctx.translate(osx, osy);
        ctx.rotate(m.angle || 0);

        const reach = Math.max(12, m.reach * Math.min(1, prog * 1.8));
        const baseThick = isVenu ? 8.2 : 7.0;
        const waveFreq = 1.35;
        const waveAmp = (1 - prog * 0.45) * 15;
        const segs = 14;

        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        const vinePts = [];
        for (let s = 0; s <= segs; s++) {
          const t = s / segs;
          const x = t * reach;
          const y = Math.sin(t * Math.PI * waveFreq) * waveAmp * Math.sin(t * Math.PI);
          vinePts.push({ x, y, t });
        }

        // 分段漸細繪製：底層深綠硬邊 ➔ 中層翠綠主幹 ➔ 內層嫩綠高光脊
        for (let s = 0; s < segs; s++) {
          const p0 = vinePts[s], p1 = vinePts[s + 1];
          const w = Math.max(1.8, baseThick * (1 - p0.t * 0.74));

          ctx.strokeStyle = "#14532D";
          ctx.lineWidth = w + 2.8;
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p1.x, p1.y);
          ctx.stroke();

          ctx.strokeStyle = "#22C55E";
          ctx.lineWidth = w;
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p1.x, p1.y);
          ctx.stroke();

          if (w > 2.8) {
            ctx.strokeStyle = "#86EFAC";
            ctx.lineWidth = Math.max(1.0, w * 0.28);
            ctx.beginPath();
            ctx.moveTo(p0.x, p0.y - w * 0.16);
            ctx.lineTo(p1.x, p1.y - w * 0.16);
            ctx.stroke();
          }
        }

        // 兩側交錯倒刺三角 + 花瓣／嫩芽點綴（依該處藤身粗細縮放）
        for (let s = 2; s < segs - 1; s += 2) {
          const pt = vinePts[s];
          const localW = Math.max(2.2, baseThick * (1 - pt.t * 0.74));
          const side = (s % 4 === 0) ? 1 : -1;

          ctx.fillStyle = "#15803D";
          ctx.beginPath();
          ctx.moveTo(pt.x, pt.y);
          ctx.lineTo(pt.x + 5, pt.y + side * (localW + 4.5));
          ctx.lineTo(pt.x - 3, pt.y + side * (localW + 1.5));
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = isVenu ? "#F472B6" : "#86EFAC";
          ctx.beginPath();
          ctx.arc(pt.x, pt.y + side * (localW * 0.65), isVenu ? 2.6 : 1.9, 0, Math.PI * 2);
          ctx.fill();
          if (isVenu) {
            ctx.fillStyle = "#FDE047";
            ctx.beginPath();
            ctx.arc(pt.x, pt.y + side * (localW * 0.65), 1.1, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // 末端銳利乾淨月牙鞭爆（移除雜亂分岔短線）
        const tipPt = vinePts[segs];
        const slashR = (isVenu ? 16 : 13) + prog * 10;
        const slashAlpha = Math.max(0, 1 - prog * 0.78);
        ctx.save();
        ctx.translate(tipPt.x, tipPt.y);
        ctx.globalAlpha = (slashAlpha) * sAlpha;

        ctx.fillStyle = isVenu ? "rgba(244, 114, 182, 0.78)" : "rgba(34, 197, 94, 0.72)";
        ctx.beginPath();
        ctx.arc(-2, 0, slashR, -1.12, 1.12);
        ctx.arc(-7, 0, slashR * 0.72, 1.12, -1.12, true);
        ctx.closePath();
        ctx.fill();

        if (isVenu) {
          ctx.fillStyle = "rgba(34, 197, 94, 0.80)";
          ctx.beginPath();
          ctx.arc(-4, 0, slashR * 0.80, -0.98, 0.98);
          ctx.arc(-8, 0, slashR * 0.58, 0.98, -0.98, true);
          ctx.closePath();
          ctx.fill();
        }

        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 2.4 * slashAlpha + 0.7;
        ctx.beginPath();
        ctx.arc(-1, 0, slashR * 0.95, -1.0, 1.0);
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
        ctx.globalAlpha = (fade) * sAlpha;

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
          ctx.globalAlpha = (fade * g.al) * sAlpha;
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
          ctx.globalAlpha = (cFade * 0.95) * sAlpha;
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
        ctx.globalAlpha = (fade * 0.85) * sAlpha;
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
          ctx.globalAlpha = (fade * 0.42) * sAlpha;
          ctx.drawImage(sprRec.img, -26, -24, 52, 52);
          GameApp.drawSilhouetteFlash(ctx, sprRec.img, -26, -24, 52, 52, tintCol, fade * 0.65);
          ctx.restore();
        }

        // 3. 1:1 等比貼合真實傷害半徑 m.radius 的寬幅動能月牙氣浪 (Shockwave Crescent)
        ctx.save();
        ctx.rotate(m.angle || 0);
        ctx.globalAlpha = (fade) * sAlpha;
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
      } else if (m.style === "giga_cardinal_wave") {
        // 【終極衝擊・上下左右四正向動能月牙衝擊波】：承襲撞擊尾段雙層金白月牙氣浪，補足八方全覆蓋
        const ease = 1 - Math.pow(1 - Math.min(1, prog * 1.45), 2.6);
        const curWx = m.ox + (m.x - m.ox) * ease;
        const curWy = m.oy + (m.y - m.oy) * ease;
        const csx = toSx(curWx), csy = toSy(curWy);
        const fade = Math.max(0, 1 - prog * 0.90);
        const waveR = Math.max(36, m.radius * (0.76 + ease * 0.36));

        ctx.save();
        ctx.translate(csx, csy);
        ctx.rotate(m.angle || 0);
        ctx.globalAlpha = fade * sAlpha;

        ctx.strokeStyle = "rgba(254, 240, 138, 0.78)";
        ctx.lineWidth = 2.2;
        ctx.lineCap = "round";
        [-1, 0, 1].forEach(row => {
          const ly = row * (waveR * 0.34);
          ctx.beginPath();
          ctx.moveTo(-4, ly);
          ctx.lineTo(-28 - ease * 20, ly * 1.12);
          ctx.stroke();
        });

        const cGrad = ctx.createRadialGradient(6, 0, waveR * 0.28, 6, 0, waveR);
        cGrad.addColorStop(0, "rgba(255, 255, 255, 0.0)");
        cGrad.addColorStop(0.50, "rgba(254, 240, 138, 0.42)");
        cGrad.addColorStop(0.86, "rgba(255, 255, 255, 0.95)");
        cGrad.addColorStop(1, "rgba(255, 255, 255, 0.0)");
        ctx.fillStyle = cGrad;
        ctx.beginPath();
        ctx.arc(4, 0, waveR, -1.16, 1.16);
        ctx.arc(-10, 0, waveR * 0.66, 1.16, -1.16, true);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 3.6 * (1 - prog * 0.32);
        ctx.beginPath();
        ctx.arc(6, 0, waveR * 0.96, -1.06, 1.06);
        ctx.stroke();

        ctx.strokeStyle = "#FACC15";
        ctx.lineWidth = 2.2 * (1 - prog * 0.32);
        ctx.beginPath();
        ctx.arc(10, 0, waveR * 1.03, -0.82, 0.82);
        ctx.stroke();
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

        // 1. 音爆雲「後半亮青金環」（畫在鑽頭本體後方，建立清澈通透的 3D 穿插景深）
        [0.28, 0.54, 0.78].forEach((rPos, idx) => {
          const rx = curLen * rPos;
          const ry = maxW * (1.18 - idx * 0.24);
          ctx.strokeStyle = idx === 2 ? "rgba(224, 242, 254, 0.78)" : "rgba(250, 204, 21, 0.62)";
          ctx.lineWidth = 3.8 - idx * 0.5;
          ctx.beginPath();
          ctx.ellipse(rx, 0, ry * 0.34, ry, 0, Math.PI * 0.5, Math.PI * 1.5);
          ctx.stroke();
        });

        // 2. 3D 衝擊錐下半「暖金動能面」（徹底去濁，採用清亮琥珀金 -> 耀金）
        const darkGrad = ctx.createLinearGradient(tailX, 0, tipX, maxW);
        darkGrad.addColorStop(0, "rgba(245, 158, 11, 0.16)");
        darkGrad.addColorStop(0.45, "rgba(251, 191, 36, 0.78)");
        darkGrad.addColorStop(1, "rgba(254, 240, 138, 0.96)");
        ctx.fillStyle = darkGrad;
        ctx.beginPath();
        ctx.moveTo(tipX, 0);
        ctx.lineTo(tailX, maxW);
        ctx.lineTo(curLen * 0.26, 0);
        ctx.closePath();
        ctx.fill();

        // 3. 3D 衝擊錐上半「白熾受光面」（流金 -> 純白高光）
        const lightGrad = ctx.createLinearGradient(tailX, -maxW, tipX, 0);
        lightGrad.addColorStop(0, "rgba(253, 224, 71, 0.22)");
        lightGrad.addColorStop(0.45, "rgba(254, 249, 195, 0.88)");
        lightGrad.addColorStop(1, "rgba(255, 255, 255, 0.98)");
        ctx.fillStyle = lightGrad;
        ctx.beginPath();
        ctx.moveTo(tipX, 0);
        ctx.lineTo(tailX, -maxW);
        ctx.lineTo(curLen * 0.26, 0);
        ctx.closePath();
        ctx.fill();

        // 外廓發光金白氣刃邊線 ＋ 中央高壓純白脊線
        ctx.strokeStyle = "rgba(254, 240, 138, 0.92)";
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(tailX, -maxW);
        ctx.lineTo(tipX, 0);
        ctx.lineTo(tailX, maxW);
        ctx.stroke();

        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 4.2;
        ctx.beginPath();
        ctx.moveTo(curLen * 0.20, 0);
        ctx.lineTo(tipX, 0);
        ctx.stroke();

        // 4. 包覆衝擊錐表面的流光螺旋動能帶（金橙內影 ＋ 純白高光絲帶）
        for (let seg = 1; seg <= 4; seg++) {
          const t = seg / 5;
          const sxSeg = curLen * (0.24 + t * 0.72);
          const wSeg = maxW * (1 - t * 0.82);
          const phase = Math.sin(now * 6.5 + seg * 1.4) * (wSeg * 0.28);

          ctx.strokeStyle = "rgba(245, 158, 11, 0.72)";
          ctx.lineWidth = 4.2;
          ctx.beginPath();
          ctx.moveTo(sxSeg - 9, -wSeg + 2);
          ctx.quadraticCurveTo(sxSeg + 6, phase + 2, sxSeg + 9, wSeg - 2);
          ctx.stroke();

          ctx.strokeStyle = "#FFFFFF";
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.moveTo(sxSeg - 9, -wSeg + 2);
          ctx.quadraticCurveTo(sxSeg + 6, phase, sxSeg + 9, wSeg - 2);
          ctx.stroke();
        }

        // 5. 纏繞外圍的高速白青動能破風電弧
        [-1, 1].forEach(side => {
          ctx.strokeStyle = "#E0F2FE";
          ctx.lineWidth = 2.0;
          ctx.beginPath();
          ctx.moveTo(curLen * 0.28, side * maxW * 0.55);
          ctx.lineTo(curLen * 0.55, side * (maxW * 0.72 + Math.sin(now * 8 + side) * 4));
          ctx.lineTo(curLen * 0.86, side * maxW * 0.22);
          ctx.stroke();
        });

        // 6. 音爆雲「前半純白耀金高光環」與頂點八芒破空星
        [0.28, 0.54, 0.78].forEach((rPos, idx) => {
          const rx = curLen * rPos;
          const ry = maxW * (1.18 - idx * 0.24);
          ctx.strokeStyle = idx >= 1 ? "#FFFFFF" : "#FEF08A";
          ctx.lineWidth = 3.4 - idx * 0.4;
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
        ctx.globalAlpha = (Math.max(0, alpha)) * sAlpha;

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
        ctx.globalAlpha = (alpha * 0.92) * sAlpha;

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
        ctx.globalAlpha = (alpha) * sAlpha;

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
      } else if (m.style === "ash_pokeball_wave") {
        // 【小智大招 v7.1.1 三拍實心精靈球】：0.00~0.22s 實心彈出定格 ➔ 0.22~0.36s 咔噠裂開閃光 ➔ 0.36~0.70s 紅金中空衝擊環
        const msx = toSx(m.x), msy = toSy(m.y);
        const totalT = m.maxTime || 0.70;
        const elapsed = prog * totalT;

        ctx.save();
        ctx.translate(msx, msy);

        // 第 1 & 2 拍（0.00s ~ 0.44s）：實心精靈球彈出、微晃、裂開迸發金光並淡出
        if (elapsed < 0.44) {
          const ballR = 20;
          const ballY = -36; // 懸浮於主角頭頂上方，一眼清晰辨識且完全不遮擋腳下敵彈
          let scale = 1.0;
          let wobble = 0;
          let splitGap = 0;
          let ballAlpha = 1.0;

          if (elapsed < 0.22) {
            // 第 1 拍：彈性彈出 (0.6 -> 1.15 -> 1.0) 與經典微晃
            const p1 = elapsed / 0.22;
            scale = p1 < 0.55
              ? (0.60 + 0.55 * (p1 / 0.55))
              : (1.15 - 0.15 * ((p1 - 0.55) / 0.45));
            wobble = Math.sin(p1 * Math.PI * 3.0) * 0.16 * (1 - p1 * 0.3);
          } else if (elapsed < 0.36) {
            // 第 2 拍：紅白上下撐開裂縫，迸發金白光芒
            const p2 = (elapsed - 0.22) / 0.14;
            scale = 1.0 + p2 * 0.14;
            splitGap = p2 * 7.5;
          } else {
            // 過渡淡出至第 3 拍
            const pFade = (elapsed - 0.36) / 0.08;
            scale = 1.14 + pFade * 0.10;
            splitGap = 7.5 + pFade * 3.0;
            ballAlpha = Math.max(0, 1 - pFade);
          }

          ctx.save();
          ctx.translate(0, ballY);
          ctx.rotate(wobble);
          ctx.scale(scale, scale);
          ctx.globalAlpha = ballAlpha * sAlpha;

          // 裂縫中迸發的金白光芒（第 2 拍啟動）
          if (splitGap > 0.5) {
            const flashAlpha = Math.min(1, splitGap / 6.0) * ballAlpha;
            ctx.save();
            ctx.globalCompositeOperation = "lighter";
            ctx.globalAlpha = flashAlpha * sAlpha;
            const gGlow = ctx.createRadialGradient(0, 0, 2, 0, 0, ballR * 1.9);
            gGlow.addColorStop(0, "rgba(255, 255, 255, 0.98)");
            gGlow.addColorStop(0.45, "rgba(254, 240, 138, 0.82)");
            gGlow.addColorStop(1, "rgba(245, 158, 11, 0)");
            ctx.fillStyle = gGlow;
            ctx.beginPath();
            ctx.arc(0, 0, ballR * 1.9, 0, Math.PI * 2);
            ctx.fill();

            // 6 道金白放射光束
            ctx.strokeStyle = "#FEF08A";
            ctx.lineWidth = 2.6;
            for (let rIdx = 0; rIdx < 6; rIdx++) {
              const ra = (rIdx * Math.PI) / 3 + 0.22;
              ctx.beginPath();
              ctx.moveTo(Math.cos(ra) * 5, Math.sin(ra) * 5);
              ctx.lineTo(Math.cos(ra) * (ballR + splitGap * 2.2), Math.sin(ra) * (ballR + splitGap * 2.2));
              ctx.stroke();
            }
            ctx.restore();
          }

          // 上半赤紅實心球蓋
          ctx.save();
          ctx.translate(0, -splitGap);
          ctx.fillStyle = "#EF4444";
          ctx.strokeStyle = "#0F172A";
          ctx.lineWidth = 2.6;
          ctx.beginPath();
          ctx.arc(0, 0, ballR, Math.PI, 0);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          // 左上高光月牙
          ctx.fillStyle = "rgba(254, 202, 202, 0.78)";
          ctx.beginPath();
          ctx.ellipse(-ballR * 0.38, -ballR * 0.42, 4.8, 2.6, -0.55, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          // 下半純白實心球底
          ctx.save();
          ctx.translate(0, splitGap);
          ctx.fillStyle = "#F8FAFC";
          ctx.strokeStyle = "#0F172A";
          ctx.lineWidth = 2.6;
          ctx.beginPath();
          ctx.arc(0, 0, ballR, 0, Math.PI);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          // 右下淺灰陰影弧
          ctx.fillStyle = "rgba(203, 213, 225, 0.72)";
          ctx.beginPath();
          ctx.arc(0, 0, ballR - 2.5, 0.18, Math.PI * 0.65);
          ctx.lineTo(0, 2);
          ctx.closePath();
          ctx.fill();
          ctx.restore();

          // 中央深黑腰帶與發光按鈕（僅未大幅裂開時完整顯示）
          if (splitGap < 3.5) {
            ctx.fillStyle = "#0F172A";
            ctx.fillRect(-ballR, -2.2, ballR * 2, 4.4);
          }
          ctx.fillStyle = splitGap > 0.5 ? "#FEF08A" : "#FFFFFF";
          ctx.strokeStyle = "#0F172A";
          ctx.lineWidth = 2.4;
          ctx.beginPath();
          ctx.arc(0, 0, 5.8, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }

        // 第 3 拍（0.32s ~ 0.70s）：乾淨俐落的紅金雙色中空熱血衝擊環向外擴散至 m.radius
        if (elapsed >= 0.32) {
          const p3 = Math.min(1, (elapsed - 0.32) / Math.max(0.05, totalT - 0.32));
          const ease3 = 1 - Math.pow(1 - p3, 2.2);
          const curR = 26 + (m.radius - 26) * ease3;
          const ringFade = Math.max(0, 1 - p3);

          ctx.globalAlpha = (ringFade * 0.94) * sAlpha;

          // 外圈耀金熱血衝擊環
          ctx.strokeStyle = "#FACC15";
          ctx.lineWidth = Math.max(1.8, 6.5 * (1 - p3 * 0.55));
          ctx.beginPath();
          ctx.arc(0, 0, curR, 0, Math.PI * 2);
          ctx.stroke();

          // 內圈赤紅熱血餘波環
          ctx.strokeStyle = "#EF4444";
          ctx.lineWidth = Math.max(1.4, 4.2 * (1 - p3 * 0.50));
          ctx.beginPath();
          ctx.arc(0, 0, curR * 0.84, 0, Math.PI * 2);
          ctx.stroke();

          // 極細純白電光內邊
          ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
          ctx.lineWidth = Math.max(1.0, 2.0 * ringFade);
          ctx.beginPath();
          ctx.arc(0, 0, curR * 0.94, 0, Math.PI * 2);
          ctx.stroke();
        }
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
      ctx.globalAlpha = (Math.max(0, 1 - prog * 0.85)) * sAlpha;
      const ringR = 32 + prog * 112;
      ctx.strokeStyle = u.color || "#FACC15";
      ctx.lineWidth = 4.5 * (1 - prog * 0.5);
      ctx.beginPath();
      ctx.arc(0, 0, ringR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    });

    // 4. 具象化投射物彈幕 (projectiles — 輕量普攻彈幕享有 55% 透明度下限保底，避免 45% 極淨模式下隱形)
    const projAlpha = this.getLightProjectileAlpha();
    this.projectiles.forEach(pr => {
      const sx = toSx(pr.x), sy = toSy(pr.y);
      let r = pr.radius;
      ctx.save();
      ctx.globalAlpha = projAlpha;
      ctx.translate(sx, sy);

      if (pr.vfx === "poison_jab" || pr.vfx === "toxic_bone_spear") {
        // 【毒擊 / 劇毒骨矛 v7.5.7】：細長銳利突刺毒針（帶純白高光脊線＋滴落螢光綠毒液尾珠）
        const isUltSpear = (pr.vfx === "toxic_bone_spear");
        ctx.rotate(pr.angle || 0);
        const len = r * (isUltSpear ? 2.1 : 1.75);
        const hw = r * (isUltSpear ? 0.42 : 0.34);
        // 紫➔螢光綠液態漸層流光拖尾（Lv.8 與超武骨矛追加雙股螺旋毒氣緞帶）
        const pTailG = ctx.createLinearGradient(-len * 1.85, 0, len * 0.6, 0);
        pTailG.addColorStop(0, "rgba(74, 222, 128, 0)");
        pTailG.addColorStop(0.55, pr.isCrimsonVenom ? "rgba(244, 63, 94, 0.52)" : "rgba(168, 85, 247, 0.55)");
        pTailG.addColorStop(1, "rgba(74, 222, 128, 0.82)");
        ctx.fillStyle = pTailG;
        ctx.beginPath();
        ctx.moveTo(len * 0.4, 0); ctx.lineTo(-len * 1.85, -hw * 0.95); ctx.lineTo(-len * 1.85, hw * 0.95); ctx.closePath();
        ctx.fill();
        if (pr.isLv8 || isUltSpear) {
          // Lv.8 雙色粗線纏繞螺旋毒氣緞帶（螢光綠 ＋ 亮紫/猩紅反相交織）
          ctx.lineWidth = 2.4;
          ctx.strokeStyle = "#4ADE80";
          ctx.beginPath();
          for (let sx = -len * 1.6; sx <= len * 0.45; sx += 4) {
            const sy = Math.sin(now * 26 + sx * 0.26) * hw * 1.05;
            if (sx === -len * 1.6) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
          }
          ctx.stroke();
          ctx.strokeStyle = pr.isCrimsonVenom ? "#FB7185" : "#F0ABFC";
          ctx.beginPath();
          for (let sx = -len * 1.6; sx <= len * 0.45; sx += 4) {
            const sy = -Math.sin(now * 26 + sx * 0.26) * hw * 1.05;
            if (sx === -len * 1.6) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
          }
          ctx.stroke();
        }
        // 細長深紫像素描邊毒針
        ctx.fillStyle = "#2E1065";
        ctx.beginPath();
        ctx.moveTo(len, 0); ctx.lineTo(-len * 0.75, -hw * 1.25); ctx.lineTo(-len * 0.45, 0); ctx.lineTo(-len * 0.75, hw * 1.25);
        ctx.closePath();
        ctx.fill();
        // 高飽和紫紅針身
        ctx.fillStyle = isUltSpear ? "#E879F9" : "#C084FC";
        ctx.beginPath();
        ctx.moveTo(len * 0.88, 0); ctx.lineTo(-len * 0.55, -hw * 0.78); ctx.lineTo(-len * 0.32, 0); ctx.lineTo(-len * 0.55, hw * 0.78);
        ctx.closePath();
        ctx.fill();
        // 純白銳利高光脊線
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(-len * 0.25, 0); ctx.lineTo(len * 0.75, 0);
        ctx.stroke();
        // 滴落螢光綠毒液尾珠
        ctx.fillStyle = "#4ADE80";
        ctx.fillRect(-len * 0.95, -hw * 0.9, 4, 4);
        ctx.fillRect(-len * 1.25, hw * 0.5, 3, 3);
      } else if (pr.vfx === "electro_orb") {
        // 【電球 v7.5.9】：柔化高熱純白電漿芯 ＋ 外圍「高速旋轉＋不規則跳動」多段鋸齒閃電弧 ＋ 地面反光暈
        const seed = (pr.x * 0.05 + pr.y * 0.07);
        const pulse = 1 + Math.sin(now * 26 + seed) * 0.10;
        // 1. 地面淡黃電光反射暈
        ctx.fillStyle = "rgba(250, 204, 21, 0.24)";
        ctx.beginPath();
        ctx.ellipse(0, r * 0.92, r * 0.92, r * 0.32, 0, 0, Math.PI * 2);
        ctx.fill();
        // 1B. 皮卡丘家族 / Lv.8 專屬金青雙色高壓尾跡流光
        if (pr.isPikachuFamily || pr.isLv8) {
          ctx.save();
          ctx.rotate(pr.angle || 0);
          const wakeG = ctx.createLinearGradient(-r * 2.4, 0, 0, 0);
          wakeG.addColorStop(0, "rgba(56, 189, 248, 0)");
          wakeG.addColorStop(0.5, pr.isPikachuFamily ? "rgba(56, 189, 248, 0.55)" : "rgba(250, 204, 21, 0.45)");
          wakeG.addColorStop(1, "rgba(254, 249, 195, 0.85)");
          ctx.fillStyle = wakeG;
          ctx.beginPath();
          ctx.moveTo(0, -r * 0.55); ctx.lineTo(-r * 2.4, 0); ctx.lineTo(0, r * 0.55); ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
        // 2. 高熱雙層等離子外暈（皮卡丘家族外緣透出青白高壓電暈）
        const grad = ctx.createRadialGradient(0, 0, r * 0.12, 0, 0, r * 1.38 * pulse);
        grad.addColorStop(0, "#FFFFFF");
        grad.addColorStop(0.38, "#FEF08A");
        grad.addColorStop(0.72, pr.isPikachuFamily ? "#38BDF8" : "#F59E0B");
        grad.addColorStop(1, "rgba(234, 179, 8, 0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, r * 1.32 * pulse, 0, Math.PI * 2);
        ctx.fill();
        // 3. 柔化微呼吸純白電漿核心（去尖銳多邊形感）
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 0.48 * pulse, r * 0.44 * (2 - pulse), now * 5, 0, Math.PI * 2);
        ctx.fill();
        // 4. 外圍 3 道「高速公轉旋轉 ＋ 不規則鋸齒跳動」高壓電弧
        const spinBase = now * 9.5 + seed;
        for (let k = 0; k < 3; k++) {
          const aStart = spinBase + (k * Math.PI * 2) / 3 + Math.sin(now * 29 + k * 3.7) * 0.28;
          const arcSpan = 1.05 + Math.sin(now * 37 + k * 5.3) * 0.25;
          ctx.strokeStyle = k === 0 ? "#FFFFFF" : "#FEF08A";
          ctx.lineWidth = k === 0 ? 2.2 : 1.7;
          ctx.beginPath();
          for (let seg = 0; seg <= 4; seg++) {
            const t = seg / 4;
            const a = aStart + arcSpan * t;
            const jitterR = r * (0.82 + ((seg === 0 || seg === 4) ? 0 : (Math.sin(now * 58 + k * 11 + seg * 7.3) * 0.26)));
            const px = Math.cos(a) * jitterR;
            const py = Math.sin(a) * jitterR;
            if (seg === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.stroke();
        }
      } else if (pr.vfx === "rolling_rock") {
        // 【大陸板塊崩落・滾動碎岩塊】
        ctx.fillStyle = "rgba(28, 14, 5, 0.35)";
        ctx.beginPath();
        ctx.ellipse(0, r * 0.72, r * 0.85, r * 0.32, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.rotate((pr.spin || 0) + now * 12);
        ctx.fillStyle = "#B45309";
        ctx.strokeStyle = "#451A03";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-r * 0.85, 0); ctx.lineTo(-r * 0.45, -r * 0.8); ctx.lineTo(r * 0.55, -r * 0.7);
        ctx.lineTo(r * 0.85, r * 0.2); ctx.lineTo(r * 0.2, r * 0.85); ctx.lineTo(-r * 0.65, r * 0.6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#F59E0B";
        ctx.fillRect(-r * 0.35, -r * 0.45, r * 0.55, r * 0.45);
      } else if (pr.vfx === "emerald_wave") {
        // 【終極十字星斬・八向翡翠劍氣波】
        ctx.rotate(pr.angle || 0);
        ctx.fillStyle = "#84CC16";
        ctx.strokeStyle = "#14532D";
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(r * 0.9, 0);
        ctx.quadraticCurveTo(0, -r * 1.25, -r * 0.65, -r * 1.05);
        ctx.quadraticCurveTo(r * 0.15, 0, -r * 0.65, r * 1.05);
        ctx.quadraticCurveTo(0, r * 1.25, r * 0.9, 0);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.moveTo(r * 0.7, 0);
        ctx.quadraticCurveTo(0.1 * r, -r * 0.75, -r * 0.35, -r * 0.65);
        ctx.quadraticCurveTo(r * 0.25, 0, -r * 0.35, r * 0.65);
        ctx.quadraticCurveTo(0.1 * r, r * 0.75, r * 0.7, 0);
        ctx.fill();
      } else if (pr.vfx === "ember_spark") {
        // 【小火龍・火花（Ember）】：不規則跳動像素火星簇（高溫明黃火芯 ＋ 3 顆錯落閃爍菱形／方形火星）
        const seed = pr.cinderSeed || (pr.x * 0.13);
        const flicker = Math.sin(now * 28 + seed);
        const vr = Math.min(11.5, r * 0.68);
        const jx = Math.cos(now * 34 + seed) * 1.4;
        const jy = Math.sin(now * 31 + seed * 1.7) * 1.4;

        ctx.rotate(pr.angle || 0);

        const isBlueEmb = !!pr.isMegaBlueFlame;
        // 1. 柔和熱暈外層（Mega 噴火龍X 切換蒼藍冥炎）
        const halo = ctx.createRadialGradient(jx, jy, 1.5, jx, jy, vr * 1.15);
        halo.addColorStop(0, isBlueEmb ? "rgba(224, 242, 254, 0.88)" : "rgba(254, 240, 138, 0.85)");
        halo.addColorStop(0.5, isBlueEmb ? "rgba(14, 165, 233, 0.58)" : "rgba(249, 115, 22, 0.55)");
        halo.addColorStop(1, isBlueEmb ? "rgba(29, 78, 216, 0)" : "rgba(220, 38, 38, 0)");
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(jx, jy, vr * 1.15, 0, Math.PI * 2);
        ctx.fill();

        // 2. 主火星：高頻跳動的不規則菱形火芯
        const cs = vr * (0.62 + flicker * 0.12);
        ctx.save();
        ctx.translate(jx, jy);
        ctx.rotate(flicker * 0.35);
        ctx.fillStyle = isBlueEmb ? "#1D4ED8" : "#DC2626";
        ctx.beginPath();
        ctx.moveTo(cs * 1.15, 0); ctx.lineTo(0, -cs * 0.85);
        ctx.lineTo(-cs * 1.35, 0); ctx.lineTo(0, cs * 0.85);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = isBlueEmb ? "#0EA5E9" : "#F97316";
        ctx.beginPath();
        ctx.moveTo(cs * 0.82, 0); ctx.lineTo(0, -cs * 0.58);
        ctx.lineTo(-cs * 0.95, 0); ctx.lineTo(0, cs * 0.58);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = isBlueEmb ? "#E0F2FE" : "#FEF9C3";
        ctx.fillRect(-cs * 0.30, -cs * 0.30, cs * 0.60, cs * 0.60);
        ctx.restore();

        // 3. 周圍 3 顆錯落閃爍的方形／菱形像素火星碎屑
        const embers = [
          { ox: -vr * 0.72, oy: -vr * 0.58 + Math.sin(now * 24 + seed) * 2.4, sz: 3.6, col: isBlueEmb ? "#E0F2FE" : "#FEF08A" },
          { ox: -vr * 0.98, oy:  vr * 0.50 + Math.cos(now * 26 + seed) * 2.4, sz: 3.0, col: isBlueEmb ? "#38BDF8" : "#FB923C" },
          { ox: -vr * 1.48, oy:  Math.sin(now * 20 + seed * 2) * 3.2,         sz: 2.4, col: isBlueEmb ? "#2563EB" : "#EF4444" }
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
        // 【耿鬼・暗影球】：v7.8.4 收斂視覺上限 16px，多發連射更俐落
        r = Math.min(16, r);
        const rot = -now * 2.8;
        ctx.save();
        ctx.rotate(rot);

        // 不規則跳動幽冥鬼火外殼（超級耿鬼切換深紅冥炎）
        ctx.fillStyle = pr.isMegaGengarShadow ? "#9F1239" : "#581C87";
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
        ctx.strokeStyle = pr.isMegaGengarShadow ? "#FB7185" : "#C084FC";
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
        // v7.8.4 收斂污泥炸彈視覺半徑上限 14px 與高拋縮放 1.20x（不影響實際傷害判定）
        const rOrig = r;
        r = Math.min(14, rOrig);
        if (pr.vfx === "sludge_lob" && pr.startX !== undefined) {
          const t = Math.min(1, pr.progress || 0);
          const groundY = (pr.startY + (pr.targetY - pr.startY) * t) - pr.y;
          ctx.fillStyle = "rgba(15, 23, 42, 0.34)";
          ctx.beginPath();
          ctx.ellipse(0, groundY + 8, r * (0.55 + 0.40 * Math.abs(t - 0.5)), r * 0.26, 0, 0, Math.PI * 2);
          ctx.fill();
          const liftScale = 1 + Math.sin(t * Math.PI) * 0.20;
          ctx.scale(liftScale, liftScale);
        }
        ctx.rotate(pr.angle || 0);
        const isCrimsonOrb = !!pr.isMegaGengarPuddle;
        const wobble = Math.sin(now * 6.5 + pr.x * 0.05) * 0.12;

        // 1. 拖尾飛濺的 2 顆黏稠毒液小水滴
        ctx.fillStyle = isCrimsonOrb ? "rgba(190, 18, 60, 0.85)" : "rgba(126, 34, 206, 0.85)";
        ctx.beginPath();
        ctx.arc(-r * 1.18, r * 0.28, r * 0.28, 0, Math.PI * 2);
        ctx.arc(-r * 0.95, -r * 0.42, r * 0.20, 0, Math.PI * 2);
        ctx.fill();

        // 2. 不規則有機流動毒泥主體（取代死板正圓保齡球）
        ctx.fillStyle = isCrimsonOrb ? "#4C0519" : "#3B0764";
        ctx.beginPath();
        for (let k = 0; k < 10; k++) {
          const a = (k * Math.PI * 2) / 10;
          const rad = r * (0.86 + Math.sin(a * 3 + now * 5.0) * 0.14 + (k % 2 === 0 ? wobble : -wobble));
          const px = Math.cos(a) * rad, py = Math.sin(a) * rad;
          if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = isCrimsonOrb ? "#BE123C" : "#7E22CE";
        ctx.beginPath();
        for (let k = 0; k < 10; k++) {
          const a = (k * Math.PI * 2) / 10;
          const rad = r * (0.68 + Math.sin(a * 3 + now * 5.0 + 0.6) * 0.11);
          const px = Math.cos(a) * rad, py = Math.sin(a) * rad;
          if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();

        // 3. 表面翻湧的立體亮綠／血紅毒泡與彎月高光
        ctx.fillStyle = isCrimsonOrb ? "#FB7185" : "#4ADE80";
        ctx.strokeStyle = isCrimsonOrb ? "#881337" : "#14532D";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(-r * 0.24, -r * 0.18, r * 0.24, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();

        ctx.beginPath();
        ctx.arc(r * 0.28, r * 0.16, r * 0.18, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();

        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(-r * 0.31, -r * 0.25, r * 0.09, 0, Math.PI * 2);
        ctx.arc(r * 0.23, r * 0.11, r * 0.06, 0, Math.PI * 2);
        ctx.fill();

      } else if (pr.vfx === "giant_fist") {
        // 【爆裂十字劈 v7.2.6 升級版】：統一沿用空手劈【赤金烈焰武道重拳】造型 ＋ 錐形拳風帶 ＋ 透視音爆環 ＋ 前端純白月牙
        ctx.rotate(pr.angle || 0);
        const f = Math.min(20, Math.max(15, r * 0.76));

        // 1. 錐形漸層拳風拖尾帶與雙側破風線
        const windGrad = ctx.createLinearGradient(-f * 2.5, 0, f * 0.4, 0);
        windGrad.addColorStop(0, "rgba(234, 88, 12, 0.0)");
        windGrad.addColorStop(0.55, "rgba(249, 115, 22, 0.38)");
        windGrad.addColorStop(1, "rgba(254, 240, 138, 0.68)");
        ctx.fillStyle = windGrad;
        ctx.beginPath();
        ctx.moveTo(f * 0.35, -f * 1.10);
        ctx.quadraticCurveTo(-f * 0.95, -f * 0.62, -f * 2.5, 0);
        ctx.quadraticCurveTo(-f * 0.95, f * 0.62, f * 0.35, f * 1.10);
        ctx.closePath();
        ctx.fill();

        // 2. 透視壓扁橢圓音爆氣環
        ctx.strokeStyle = "rgba(254, 240, 138, 0.85)";
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.ellipse(-f * 0.35, 0, f * 0.42, f * 1.18, 0, 0, Math.PI * 2);
        ctx.stroke();

        // 3. 空手劈同款赤金烈焰武道重拳本體（旋轉 90° 對齊飛行方向 +X）
        ctx.save();
        ctx.rotate(Math.PI * 0.5);

        // 烈焰三尾外焰
        ctx.fillStyle = "rgba(234, 88, 12, 0.90)";
        ctx.beginPath();
        ctx.moveTo(-f * 0.94, f * 0.24);
        ctx.quadraticCurveTo(-f * 1.12, -f * 0.62, -f * 0.42, -f * 1.15);
        ctx.quadraticCurveTo(0, -f * 1.48, f * 0.44, -f * 1.12);
        ctx.quadraticCurveTo(f * 1.12, -f * 0.58, f * 0.90, f * 0.28);
        ctx.lineTo(f * 0.52, f * 1.28);
        ctx.lineTo(f * 0.14, f * 0.86);
        ctx.lineTo(-f * 0.12, f * 1.38);
        ctx.lineTo(-f * 0.44, f * 0.90);
        ctx.lineTo(-f * 0.80, f * 1.18);
        ctx.closePath();
        ctx.fill();

        // 耀金內焰邊緣
        ctx.fillStyle = "#FACC15";
        ctx.beginPath();
        ctx.moveTo(-f * 0.76, f * 0.18);
        ctx.quadraticCurveTo(-f * 0.90, -f * 0.50, -f * 0.32, -f * 0.94);
        ctx.quadraticCurveTo(0, -f * 1.20, f * 0.34, -f * 0.92);
        ctx.quadraticCurveTo(f * 0.90, -f * 0.48, f * 0.74, f * 0.20);
        ctx.lineTo(f * 0.32, f * 0.84);
        ctx.lineTo(-f * 0.32, f * 0.84);
        ctx.closePath();
        ctx.fill();

        // 立體緊握拳體
        ctx.fillStyle = "#991B1B";
        ctx.strokeStyle = "#450A0A";
        ctx.lineWidth = 1.8;
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.roundRect(-f * 0.64, -f * 0.68, f * 1.28, f * 1.22, f * 0.28);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#DC2626";
        ctx.beginPath();
        ctx.roundRect(-f * 0.52, -f * 0.54, f * 1.04, f * 0.76, f * 0.20);
        ctx.fill();

        // 四顆凸起指節
        ctx.fillStyle = "#EF4444";
        ctx.strokeStyle = "#450A0A";
        ctx.lineWidth = 1.3;
        for (let k = 0; k < 4; k++) {
          const kx = -f * 0.56 + k * (f * 0.29);
          const ky = -f * 0.72 + (k === 0 || k === 3 ? f * 0.08 : 0);
          ctx.beginPath();
          ctx.roundRect(kx, ky, f * 0.27, f * 0.44, f * 0.10);
          ctx.fill();
          ctx.stroke();
        }

        // 橫扣拇指 ＋ 金白高光點
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

        // 4. 拳峰前端純白月牙破空閃光
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 2.6;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.arc(f * 0.46, 0, f * 1.06, -0.82, 0.82);
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

        const spinAng = (pr.angle || 0) + now * 2.6;
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
          if (pr.isMegaAeroBlade) {
            bladeGrad.addColorStop(0, "rgba(254, 249, 195, 0.98)");
            bladeGrad.addColorStop(0.55, "rgba(251, 191, 36, 0.92)");
            bladeGrad.addColorStop(1, "rgba(168, 85, 247, 0.88)");
          } else if (idx === 0) {
            bladeGrad.addColorStop(0, "rgba(224, 242, 254, 0.96)");
            bladeGrad.addColorStop(0.55, "rgba(186, 230, 253, 0.92)");
            bladeGrad.addColorStop(1, "rgba(165, 180, 252, 0.85)");
          } else {
            bladeGrad.addColorStop(0, "rgba(241, 245, 249, 0.94)");
            bladeGrad.addColorStop(0.55, "rgba(199, 210, 254, 0.90)");
            bladeGrad.addColorStop(1, "rgba(125, 211, 252, 0.85)");
          }
          ctx.fillStyle = bladeGrad;
          ctx.strokeStyle = pr.isMegaAeroBlade ? "#F59E0B" : "#38BDF8";
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

      ctx.beginPath();
      arc.pts.forEach((pt, idx) => {
        const sx = toSx(pt.x), sy = toSy(pt.y);
        if (idx === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      });

      if (arc.thin) {
        // 電球專屬輕量細電弧：去除厚重暗邊，3.0px 外暈 ＋ 1.6px 核心 ＋ 0.9px 純白細絲
        ctx.save();
        ctx.globalAlpha *= 0.55;
        ctx.strokeStyle = arc.color || "#FACC15";
        ctx.lineWidth = 3.0;
        ctx.stroke();
        ctx.restore();

        ctx.strokeStyle = arc.color || "#FEF08A";
        ctx.lineWidth = 1.6;
        ctx.stroke();

        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 0.9;
        ctx.stroke();
      } else {
        ctx.strokeStyle = "rgba(120, 53, 15, 0.85)";
        ctx.lineWidth = 7.5;
        ctx.stroke();

        ctx.strokeStyle = arc.color || "#FDE047";
        ctx.lineWidth = 4.5;
        ctx.stroke();

        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 2.0;
        ctx.stroke();
      }

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
      ctx.globalAlpha = (Math.max(0, sp.life / sp.maxLife)) * sAlpha;
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
    ctx.restore();
  },

  // 向後兼容總渲染入口
  render(ctx, toSx, toSy) {
    this.renderGroundLayer(ctx, toSx, toSy);
    this.renderAerialLayer(ctx, toSx, toSy);
  }
});
