/**
 * ============================================================================
 * map_v11_engine.js
 * 關卡生態地貌引擎、沙盒 V11 深度融合、離線 Tile 預渲染、3D 透視魔法陣與 6 大動態天氣系統
 * (CLEAR, RAIN, THUNDER, BLIZZARD, HEATWAVE, PSYCHIC)
 * ============================================================================
 */

const STAGES = [
  {
    id: "pallet",
    name: "真新鎮・常磐跳崖密林",
    tileLight: "#2E5A36",
    tileDark: "#274E2E",
    roadColor: "#6E563B",
    roadBorder: "#42311E",
    slowZoneColor: "#1B3B22",
    waterColor: "#1D4ED8",
    rewardMult: 1.00,
    grassSlow: 0.82,
    waterSlow: 0.70,
    buffDesc: "【森林庇護】草/蟲系威力+20%，經驗拾取範圍+20%",
    desc: "還原 GBA 1號道路：斷木樁、紅白小花、樹冠呼吸擺動、草叢踩踏碎葉粒子與單向跳崖！"
  },
  {
    id: "cerulean_bay",
    name: "華藍海岬・黃金海岸木棧道",
    tileLight: "#695843",
    tileDark: "#5B4B38",
    roadColor: "#85522D",
    roadBorder: "#4A2A12",
    slowZoneColor: "#2C4C3E",
    waterColor: "#0284C7",
    rewardMult: 1.20,
    grassSlow: 0.80,
    waterSlow: 0.65,
    buffDesc: "【華藍潮汐】水/冰系威力+20%，涉入淺灘每秒回復 2.0 HP",
    desc: "還原 GBA 絆橋水路：深水海域拍岸浪花、木棧道鐵釘與立體陰影、避難砂島。考驗繞水走位！"
  },
  {
    id: "sky_pillar",
    name: "石英高原・冠軍之路古神殿柱廊",
    tileLight: "#2B243D",
    tileDark: "#221C32",
    roadColor: "#3D3356",
    roadBorder: "#D97706",
    slowZoneColor: "#4C1D95",
    waterColor: "#0E7490",
    rewardMult: 1.35,
    grassSlow: 0.80,
    waterSlow: 0.70,
    buffDesc: "【遺跡共鳴】超能/幽靈威力+20%，全技能冷卻縮減-8%",
    desc: "還原 GBA 冠軍遺跡：大理石金蓮花邊大道、破損石柱雕像、3D等角透視旋轉五芒星超能陣！"
  }
];

const MapEngine = {
  currentStage: STAGES[0],
  chunkCache: new Map(),
  tileCache: new Map(),

  weather: "CLEAR",
  rainOffset: 0,
  lightningTimer: 0,
  lightningFlashAlpha: 0,
  splashParticles: [],

  cloudTime: 0,
  clouds: [
    {
      x: -350, y: -250, scale: 1.2, speed: 14,
      puffs: [
        { ox: 0,   oy: 0,   r: 48 },
        { ox: -36, oy: 6,   r: 38 },
        { ox: 40,  oy: -4,  r: 42 },
        { ox: -70, oy: 12,  r: 28 },
        { ox: 76,  oy: 8,   r: 32 },
        { ox: -20, oy: -24, r: 35 },
        { ox: 25,  oy: -20, r: 34 },
        { ox: 10,  oy: 18,  r: 30 }
      ]
    },
    {
      x: 300,  y: 180,  scale: 1.0, speed: 12,
      puffs: [
        { ox: 0,   oy: 0,   r: 48 },
        { ox: -36, oy: 6,   r: 38 },
        { ox: 40,  oy: -4,  r: 42 },
        { ox: -20, oy: -24, r: 35 },
        { ox: 25,  oy: -20, r: 34 }
      ]
    },
    {
      x: -550, y: 450,  scale: 1.35, speed: 15,
      puffs: [
        { ox: 0,   oy: 0,   r: 52 },
        { ox: -40, oy: 8,   r: 42 },
        { ox: 45,  oy: -5,  r: 46 },
        { ox: -20, oy: -26, r: 36 },
        { ox: 20,  oy: 20,  r: 32 }
      ]
    },
    {
      x: 550,  y: -400, scale: 0.9, speed: 11,
      puffs: [
        { ox: 0,   oy: 0,   r: 45 },
        { ox: -30, oy: 5,   r: 35 },
        { ox: 35,  oy: -4,  r: 38 }
      ]
    },
    {
      x: -100, y: 700,  scale: 1.15, speed: 13,
      puffs: [
        { ox: 0,   oy: 0,   r: 48 },
        { ox: -35, oy: 6,   r: 38 },
        { ox: 38,  oy: -4,  r: 40 },
        { ox: 15,  oy: 18,  r: 32 }
      ]
    }
  ],

  init() {
    this.prebakeTileTextures();
  },

  prebakeTileTextures() {
    STAGES.forEach(st => {
      ["light", "dark"].forEach(tone => {
        const key = `${st.id}_${tone}`;
        const can = document.createElement("canvas");
        can.width = 60;
        can.height = 60;
        const c = can.getContext("2d");
        const isDark = tone === "dark";

        c.fillStyle = isDark ? st.tileDark : st.tileLight;
        c.fillRect(0, 0, 60, 60);

        if (st.id === "pallet") {
          c.fillStyle = isDark ? "#1E3D24" : "#244C2B";
          c.fillRect(12, 14, 3, 4); c.fillRect(38, 22, 3, 4); c.fillRect(24, 44, 3, 4);
          c.fillStyle = isDark ? "#386C41" : "#458250";
          c.fillRect(16, 32, 2.5, 3); c.fillRect(44, 48, 2.5, 3); c.fillRect(32, 8, 2.5, 3);
        } else if (st.id === "cerulean_bay") {
          c.fillStyle = isDark ? "#4F4030" : "#574837";
          c.fillRect(8, 12, 2.5, 2.5); c.fillRect(34, 18, 2.5, 2.5); c.fillRect(48, 42, 2.5, 2.5); c.fillRect(18, 50, 2.5, 2.5);
        } else if (st.id === "sky_pillar") {
          c.fillStyle = isDark ? "#1C1729" : "#221C32";
          c.fillRect(14, 16, 4, 2.5); c.fillRect(42, 36, 4, 2.5);
          if (isDark) {
            c.strokeStyle = "rgba(147, 51, 234, 0.16)";
            c.lineWidth = 1;
            c.strokeRect(0.5, 0.5, 59, 59);
          }
        }

        this.tileCache.set(key, can);
      });
    });
  },

  setStage(stageId) {
    const found = STAGES.find(s => s.id === stageId);
    if (found) {
      this.currentStage = found;
      this.chunkCache.clear();
    }
  },

  setWeather(w) {
    this.weather = w;
  },

  getBiomeChunk(cx, cy) {
    const stage = this.currentStage;
    const key = `${stage.id}:${cx},${cy}`;
    if (this.chunkCache.has(key)) return this.chunkCache.get(key);

    const size = 600;
    const baseX = cx * size;
    const baseY = cy * size;
    const isOrigin = (cx === 0 && cy === 0);
    const seed = Math.abs((cx * 73856093) ^ (cy * 19349663));
    const pseudoRand = (n) => {
      const x = Math.sin(seed + n * 127.1) * 43758.5453;
      return x - Math.floor(x);
    };

    const chunk = {
      cx, cy, baseX, baseY, size,
      roads: [], piers: [], waterTiles: [], sandIslets: [],
      grassTiles: [], ledges: [], obstacles: [], decorList: []
    };

    if (stage.id === "cerulean_bay") {
      chunk.piers.push({ x: baseX + 264, y: baseY, w: 72, h: size, dir: "V" });
      if (pseudoRand(1) > 0.35) {
        chunk.piers.push({ x: baseX, y: baseY + 264, w: size, h: 72, dir: "H" });
      }
      if (!isOrigin && pseudoRand(2) > 0.32) {
        const islx = baseX + 70 + Math.floor(pseudoRand(3) * 150);
        const isly = baseY + 70 + Math.floor(pseudoRand(4) * 150);
        chunk.sandIslets.push({ x: islx, y: isly, w: 150, h: 130 });
        chunk.obstacles.push({ x: islx + 45, y: isly + 35, w: 60, h: 60, kind: "reef" });
      }
      for (let i = 0; i < 4; i++) {
        chunk.decorList.push({
          x: baseX + 50 + Math.floor(pseudoRand(i * 3 + 10) * (size - 100)),
          y: baseY + 50 + Math.floor(pseudoRand(i * 3 + 11) * (size - 100)),
          type: i % 2 === 0 ? "starfish" : "shell"
        });
      }

    } else if (stage.id === "pallet") {
      chunk.roads.push({ x: baseX, y: baseY + 265, w: size, h: 70, dir: "H" });
      if (pseudoRand(1) > 0.35) chunk.roads.push({ x: baseX + 265, y: baseY, w: 70, h: size, dir: "V" });

      if (!isOrigin && pseudoRand(2) > 0.30) {
        const ly = baseY + 160 + Math.floor(pseudoRand(3) * 220);
        chunk.ledges.push({ x: baseX + 60, y: ly, w: 200, h: 22 });
        chunk.ledges.push({ x: baseX + 340, y: ly, w: 200, h: 22 });
      }

      for (let i = 0; i < 2; i++) {
        chunk.grassTiles.push({
          x: baseX + 60 + Math.floor(pseudoRand(i * 4 + 5) * 130),
          y: baseY + 60 + Math.floor(pseudoRand(i * 4 + 6) * 130),
          w: 160, h: 120
        });
      }

      if (!isOrigin) {
        const obPick = pseudoRand(7);
        let kind = "oak_tree", ow = 64, oh = 68;
        if (obPick > 0.70) { kind = "house"; ow = 96; oh = 86; }
        else if (obPick > 0.45) { kind = "fallen_log"; ow = 96; oh = 40; }
        else if (obPick > 0.25) { kind = "tree_stump"; ow = 48; oh = 48; }

        chunk.obstacles.push({
          x: baseX + 80 + Math.floor(pseudoRand(8) * 360),
          y: baseY + 80 + Math.floor(pseudoRand(9) * 360),
          w: ow, h: oh, kind
        });
      }

      for (let i = 0; i < 5; i++) {
        chunk.decorList.push({
          x: baseX + 40 + Math.floor(pseudoRand(i * 4 + 20) * (size - 80)),
          y: baseY + 40 + Math.floor(pseudoRand(i * 4 + 21) * (size - 80)),
          type: i === 0 ? "crooked_sign" : "flower",
          color: i % 2 === 0 ? "#F87171" : "#F8FAFC"
        });
      }

    } else if (stage.id === "sky_pillar") {
      chunk.roads.push({ x: baseX + 210, y: baseY, w: 180, h: size, dir: "V", isMarble: true });

      for (let row = 0; row < 2; row++) {
        const py = baseY + 110 + row * 270;
        chunk.obstacles.push({ x: baseX + 135, y: py, w: 56, h: 72, kind: "statue" });
        chunk.obstacles.push({ x: baseX + 409, y: py, w: 56, h: 72, kind: "broken_pillar" });
      }

      if (pseudoRand(9) > 0.35) {
        chunk.grassTiles.push({ x: baseX + 230, y: baseY + 230, w: 140, h: 140, isPsychicWell: true });
      }
    }

    this.chunkCache.set(key, chunk);
    return chunk;
  },

  getTerrainModifierAt(x, y) {
    const cx = Math.floor(x / 600);
    const cy = Math.floor(y / 600);
    const chunk = this.getBiomeChunk(cx, cy);
    const stage = this.currentStage;

    if (stage.id === "cerulean_bay") {
      for (const p of chunk.piers) {
        if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) return { speedMult: 1.0, label: "", inWater: false };
      }
      for (const isl of chunk.sandIslets) {
        if (x >= isl.x && x <= isl.x + isl.w && y >= isl.y && y <= isl.y + isl.h) return { speedMult: 1.0, label: "", inWater: false };
      }
      return { speedMult: stage.waterSlow, label: "[地形] 潮汐浪花減速 -35% (水系回血中)", inWater: true };
    }

    if (stage.id === "sky_pillar") {
      for (const g of chunk.grassTiles) {
        if (g.isPsychicWell && x >= g.x && x <= g.x + g.w && y >= g.y && y <= g.y + g.h) {
          return { speedMult: 0.70, label: "[地形] 超能重力陣 -30%速 (招式冷卻-8%)", inWater: false };
        }
      }
      for (const r of chunk.roads) {
        if (r.isMarble && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
          return { speedMult: 1.10, label: "[地形] 大理石大道 +10%移速", inWater: false };
        }
      }
    }

    for (const g of chunk.grassTiles) {
      if (x >= g.x && x <= g.x + g.w && y >= g.y && y <= g.y + g.h) {
        return { speedMult: stage.grassSlow, label: "[地形] 常磐高草叢減速 -18%", inWater: false };
      }
    }

    return { speedMult: 1.0, label: "", inWater: false };
  },

  resolveObstacleCollision(ent, radius, isPlayer = false) {
    const cx = Math.floor(ent.x / 600);
    const cy = Math.floor(ent.y / 600);

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const chunk = this.getBiomeChunk(cx + dx, cy + dy);

        for (const ob of chunk.obstacles) {
          // 若為木樁且玩家正向下移動，觸發跨越跳木樁動作
          if (ob.kind === "fallen_log" && isPlayer && ent.vy > 0 && ent.y >= ob.y - 18 && ent.y <= ob.y + 12 && ent.x >= ob.x - 10 && ent.x <= ob.x + ob.w + 10) {
            if (!ent.isJumpingLedge) {
              ent.isJumpingLedge = true;
              ent.jumpTimer = 0;
            }
            continue;
          }
          if (ent.isJumpingLedge && ob.kind === "fallen_log") continue;

          const nearX = Math.max(ob.x, Math.min(ent.x, ob.x + ob.w));
          const nearY = Math.max(ob.y, Math.min(ent.y, ob.y + ob.h));
          const distX = ent.x - nearX;
          const distY = ent.y - nearY;
          const distSq = distX * distX + distY * distY;
          if (distSq < radius * radius) {
            const d = Math.sqrt(distSq) || 0.001;
            ent.x += (distX / d) * (radius - d);
            ent.y += (distY / d) * (radius - d);
          }
        }

        for (const ledge of chunk.ledges) {
          if (ent.x >= ledge.x - 8 && ent.x <= ledge.x + ledge.w + 8) {
            if (isPlayer && ent.y >= ledge.y - 14 && ent.y <= ledge.y && ent.vy > 0) {
              if (!ent.isJumpingLedge) {
                ent.isJumpingLedge = true;
                ent.jumpTimer = 0;
                ent.jumpStartX = ent.x;
                ent.jumpStartY = ent.y;
              }
            } else if (!isPlayer && ent.y >= ledge.y - 14 && ent.y <= ledge.y) {
              ent.y += 24;
            } else if (ent.y >= ledge.y && ent.y <= ledge.y + ledge.h + 8 && ent.vy < 0 && !ent.isJumpingLedge) {
              ent.y = ledge.y + ledge.h + 8;
            }
          }
        }
      }
    }
  },

  updateWeather(dt, width, height) {
    this.cloudTime += dt;

    if (this.weather === "RAIN") {
      this.rainOffset = (this.rainOffset + dt * 440) % 500;
      if (Math.random() < 0.20) {
        this.splashParticles.push({ x: Math.random() * width, y: Math.random() * height, r: 2, life: 0.22 });
      }
    } else if (this.weather === "THUNDER") {
      this.rainOffset = (this.rainOffset + dt * 820) % 500;
      this.lightningTimer -= dt;
      if (this.lightningTimer <= 0) {
        this.lightningTimer = 3.8 + Math.random() * 4.0;
        this.lightningFlashAlpha = 0.65;
        SoundFX.play("super");
      }
      if (this.lightningFlashAlpha > 0) {
        this.lightningFlashAlpha = Math.max(0, this.lightningFlashAlpha - dt * 2.6);
      }
      if (Math.random() < 0.50) {
        this.splashParticles.push({ x: Math.random() * width, y: Math.random() * height, r: 2, life: 0.24 });
      }
    }

    for (let i = this.splashParticles.length - 1; i >= 0; i--) {
      const sp = this.splashParticles[i];
      sp.r += dt * 25;
      sp.life -= dt;
      if (sp.life <= 0) this.splashParticles.splice(i, 1);
    }
  },

  renderBiomeWorld(ctx, camX, camY, width, height) {
    const stage = this.currentStage;

    if (stage.id === "cerulean_bay") {
      ctx.fillStyle = stage.waterColor;
      ctx.fillRect(0, 0, width, height);
    } else {
      ctx.fillStyle = stage.tileLight;
      ctx.fillRect(0, 0, width, height);

      const tileSize = 60;
      const startTx = Math.floor((camX - width / 2) / tileSize) - 1;
      const endTx = Math.floor((camX + width / 2) / tileSize) + 1;
      const startTy = Math.floor((camY - height / 2) / tileSize) - 1;
      const endTy = Math.floor((camY + height / 2) / tileSize) + 1;

      for (let tx = startTx; tx <= endTx; tx++) {
        for (let ty = startTy; ty <= endTy; ty++) {
          const isDark = ((tx + ty) & 1) === 0;
          const key = `${stage.id}_${isDark ? 'dark' : 'light'}`;
          const tileCanvas = this.tileCache.get(key);
          const sx = tx * tileSize - camX + width / 2;
          const sy = ty * tileSize - camY + height / 2;
          if (tileCanvas) {
            ctx.drawImage(tileCanvas, sx, sy);
          } else {
            ctx.fillStyle = isDark ? stage.tileDark : stage.tileLight;
            ctx.fillRect(sx, sy, tileSize, tileSize);
          }
        }
      }
    }

    const startCx = Math.floor((camX - width / 2) / 600) - 1;
    const endCx = Math.floor((camX + width / 2) / 600) + 1;
    const startCy = Math.floor((camY - height / 2) / 600) - 1;
    const endCy = Math.floor((camY + height / 2) / 600) + 1;
    const now = performance.now() * 0.0016;

    for (let cx = startCx; cx <= endCx; cx++) {
      for (let cy = startCy; cy <= endCy; cy++) {
        const chunk = this.getBiomeChunk(cx, cy);

        if (stage.id === "cerulean_bay") {
          const stepX = 54, stepY = 38;
          const swx = chunk.baseX - camX + width / 2;
          const swy = chunk.baseY - camY + height / 2;

          for (let gy = 16; gy < chunk.size - 10; gy += stepY) {
            const rowIndex = Math.floor(gy / stepY);
            const xOffset = (rowIndex % 2 === 0) ? 0 : stepX * 0.5;
            for (let gx = 16; gx < chunk.size - 10; gx += stepX) {
              const waveSeed = (chunk.cx * 11 + chunk.cy * 17 + rowIndex * 7 + (gx / stepX)) * 0.8;
              const waveCycle = Math.sin(now * 1.5 + waveSeed);
              const wx = swx + gx + xOffset + Math.cos(now * 1.1 + waveSeed) * 3.5;
              const wy = swy + gy + Math.sin(now * 1.3 + waveSeed) * 1.8;

              ctx.strokeStyle = "rgba(7, 89, 133, 0.65)";
              ctx.lineWidth = 2.2;
              ctx.lineCap = "round";
              ctx.beginPath();
              ctx.moveTo(wx - 14, wy + 2);
              ctx.quadraticCurveTo(wx, wy - 5 + 2, wx + 14, wy + 2);
              ctx.stroke();

              const crestAlpha = 0.45 + waveCycle * 0.35;
              ctx.strokeStyle = `rgba(224, 242, 254, ${crestAlpha})`;
              ctx.lineWidth = 1.8;
              ctx.beginPath();
              ctx.moveTo(wx - 14, wy);
              ctx.quadraticCurveTo(wx, wy - 5, wx + 14, wy);
              ctx.stroke();
            }
          }
        }

        chunk.sandIslets.forEach(isl => {
          const ix = isl.x - camX + width / 2;
          const iy = isl.y - camY + height / 2;
          ctx.fillStyle = "#E0C068";
          ctx.fillRect(ix - 8, iy - 8, isl.w + 16, isl.h + 16);
          ctx.fillStyle = "#F5D77F";
          ctx.fillRect(ix, iy, isl.w, isl.h);

          const wavePhase = (now * 1.6 + isl.x * 0.02) % Math.PI;
          const waveDist = Math.sin(wavePhase) * 6.5;
          ctx.strokeStyle = `rgba(255, 255, 255, ${Math.sin(wavePhase) * 0.75})`;
          ctx.lineWidth = 2.2;
          ctx.strokeRect(ix - (8 - waveDist), iy - (8 - waveDist), isl.w + 16 - waveDist * 2, isl.h + 16 - waveDist * 2);
        });

        (chunk.roads || []).concat(chunk.piers || []).forEach(r => {
          const rx = r.x - camX + width / 2;
          const ry = r.y - camY + height / 2;

          if (r.isMarble) {
            ctx.fillStyle = "#E2E8F0";
            ctx.fillRect(rx, ry, r.w, r.h);
            ctx.fillStyle = "#F59E0B";
            ctx.fillRect(rx, ry, 7, r.h);
            ctx.fillRect(rx + r.w - 7, ry, 7, r.h);

            ctx.strokeStyle = "#CBD5E1";
            ctx.lineWidth = 1.5;
            for (let py = ry; py < ry + r.h; py += 30) {
              ctx.beginPath();
              ctx.moveTo(rx + 7, py); ctx.lineTo(rx + r.w - 7, py);
              ctx.stroke();
            }
          } else if (stage.id === "cerulean_bay") {
            ctx.fillStyle = "rgba(3, 40, 75, 0.45)";
            ctx.fillRect(rx + 6, ry + 8, r.w, r.h);

            ctx.fillStyle = "#4A2A12";
            if (r.dir === "V") {
              ctx.fillRect(rx + r.w, ry, 8, r.h);
            } else {
              ctx.fillRect(rx, ry + r.h, r.w, 8);
            }

            ctx.fillStyle = stage.roadColor;
            ctx.fillRect(rx, ry, r.w, r.h);
            ctx.strokeStyle = stage.roadBorder;
            ctx.lineWidth = 2.2;
            ctx.strokeRect(rx, ry, r.w, r.h);

            ctx.strokeStyle = "rgba(45, 20, 5, 0.45)";
            ctx.lineWidth = 1.8;
            ctx.fillStyle = "rgba(40, 20, 5, 0.6)";
            for (let py = ry; py < ry + r.h; py += 20) {
              ctx.beginPath();
              ctx.moveTo(rx, py); ctx.lineTo(rx + r.w, py);
              ctx.stroke();
              ctx.fillRect(rx + 4, py - 3, 2, 2);
              ctx.fillRect(rx + r.w - 6, py - 3, 2, 2);
            }
          } else {
            ctx.fillStyle = stage.roadColor;
            ctx.fillRect(rx, ry, r.w, r.h);
            ctx.fillStyle = "#7D6243";
            if (r.dir === "H") ctx.fillRect(rx, ry + r.h * 0.22, r.w, r.h * 0.56);
            else ctx.fillRect(rx + r.w * 0.22, ry, r.w * 0.56, r.h);
          }
        });

        chunk.grassTiles.forEach(g => {
          const gx = g.x - camX + width / 2;
          const gy = g.y - camY + height / 2;

          if (g.isPsychicWell) {
            ctx.save();
            const cx = gx + g.w / 2;
            const cy = gy + g.h / 2;
            const rX = g.w * 0.54;
            const rY = g.w * 0.28;

            const floorGrad = ctx.createRadialGradient(cx, cy, rY * 0.2, cx, cy, rX * 1.35);
            floorGrad.addColorStop(0, "rgba(217, 70, 239, 0.45)");
            floorGrad.addColorStop(0.55, "rgba(147, 51, 234, 0.22)");
            floorGrad.addColorStop(1, "rgba(15, 23, 42, 0)");
            ctx.fillStyle = floorGrad;
            ctx.beginPath();
            ctx.ellipse(cx, cy, rX * 1.35, rY * 1.5, 0, 0, Math.PI * 2);
            ctx.fill();

            const shaftHeight = 140;
            const shaftGrad = ctx.createLinearGradient(cx, cy, cx, cy - shaftHeight);
            shaftGrad.addColorStop(0, "rgba(192, 132, 252, 0.40)");
            shaftGrad.addColorStop(0.4, "rgba(244, 114, 182, 0.20)");
            shaftGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
            ctx.fillStyle = shaftGrad;
            ctx.beginPath();
            ctx.moveTo(cx - rX * 0.85, cy);
            ctx.lineTo(cx - rX * 0.75, cy - shaftHeight);
            ctx.lineTo(cx + rX * 0.75, cy - shaftHeight);
            ctx.lineTo(cx + rX * 0.85, cy);
            ctx.closePath();
            ctx.fill();

            ctx.save();
            ctx.translate(cx, cy);

            ctx.strokeStyle = "rgba(244, 114, 182, 0.9)";
            ctx.lineWidth = 3.5;
            ctx.beginPath();
            ctx.ellipse(0, 0, rX, rY, 0, 0, Math.PI * 2);
            ctx.stroke();

            ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.ellipse(0, 0, rX * 0.94, rY * 0.94, 0, 0, Math.PI * 2);
            ctx.stroke();

            const starRot = now * 0.6;
            const starPts = [];
            for (let k = 0; k < 5; k++) {
              const ang = starRot + (k * Math.PI * 2) / 5;
              starPts.push({ x: Math.cos(ang) * (rX * 0.72), y: Math.sin(ang) * (rY * 0.72) });
            }
            ctx.strokeStyle = "#FDE047";
            ctx.lineWidth = 2.2;
            ctx.beginPath();
            let curV = 0;
            ctx.moveTo(starPts[0].x, starPts[0].y);
            for (let s = 0; s < 5; s++) {
              curV = (curV + 2) % 5;
              ctx.lineTo(starPts[curV].x, starPts[curV].y);
            }
            ctx.closePath();
            ctx.stroke();

            ctx.fillStyle = "#FDE047";
            for (let n = 0; n < 8; n++) {
              const nAng = -starRot * 0.8 + (n * Math.PI * 2) / 8;
              const nx = Math.cos(nAng) * (rX * 0.86);
              const ny = Math.sin(nAng) * (rY * 0.86);
              ctx.beginPath();
              ctx.arc(nx, ny, 2.5, 0, Math.PI * 2);
              ctx.fill();
            }

            ctx.restore();

            for (let orb = 0; orb < 8; orb++) {
              const orbSeed = (cx * 13 + cy * 19 + orb * 37);
              const orbProg = ((now * 0.7 + orb * 0.14) % 1.0);
              const orbAng = (orbSeed + orb * 1.7);
              const ox = cx + Math.cos(orbAng) * (rX * 0.65) + Math.sin(now * 3.0 + orb) * 6;
              const oy = cy + Math.sin(orbAng) * (rY * 0.65) - (orbProg * shaftHeight);
              const orbAlpha = Math.sin(orbProg * Math.PI) * 0.85;

              ctx.fillStyle = orb % 2 === 0 ? `rgba(244, 114, 182, ${orbAlpha})` : `rgba(56, 189, 248, ${orbAlpha})`;
              ctx.beginPath();
              ctx.arc(ox, oy, 2.8, 0, Math.PI * 2);
              ctx.fill();
            }

            ctx.restore();
          } else {
            ctx.fillStyle = stage.slowZoneColor;
            ctx.beginPath();
            ctx.roundRect(gx, gy, g.w, g.h, 8);
            ctx.fill();
            ctx.strokeStyle = "rgba(0,0,0,0.25)";
            ctx.lineWidth = 1.8;
            ctx.stroke();

            ctx.strokeStyle = "#4ADE80";
            ctx.lineWidth = 1.6;
            for (let px = gx + 12; px < gx + g.w - 8; px += 22) {
              for (let py = gy + 14; py < gy + g.h - 8; py += 22) {
                const grassSway = Math.sin(now * 1.8 + px * 0.05 + py * 0.05) * 3.0;
                ctx.beginPath();
                ctx.moveTo(px, py);
                ctx.lineTo(px - 3 + grassSway, py - 6);
                ctx.moveTo(px, py);
                ctx.lineTo(px + 3 + grassSway, py - 6);
                ctx.stroke();
              }
            }
          }
        });

        chunk.ledges.forEach(l => {
          const lx = l.x - camX + width / 2;
          const ly = l.y - camY + height / 2;
          ctx.fillStyle = "#B45309";
          ctx.fillRect(lx, ly, l.w, l.h * 0.45);
          ctx.fillStyle = "#78350F";
          ctx.fillRect(lx, ly + l.h * 0.45, l.w, l.h * 0.55);
          ctx.strokeStyle = "#451A03";
          ctx.lineWidth = 1.8;
          ctx.strokeRect(lx, ly, l.w, l.h);

          ctx.fillStyle = "#FDE68A";
          const count = Math.max(1, Math.floor((l.w - 30) / 38));
          const spacing = (l.w - 40) / (count > 1 ? count - 1 : 1);
          for (let i = 0; i < count; i++) {
            const px = lx + 20 + i * spacing;
            ctx.beginPath();
            ctx.moveTo(px - 5, ly + 3);
            ctx.lineTo(px + 5, ly + 3);
            ctx.lineTo(px, ly + 13);
            ctx.closePath();
            ctx.fill();
          }
        });

        chunk.obstacles.forEach(ob => {
          const ox = ob.x - camX + width / 2;
          const oy = ob.y - camY + height / 2;
          ctx.fillStyle = "rgba(0,0,0,0.3)";
          ctx.fillRect(ox + 4, oy + 6, ob.w, ob.h);

          if (ob.kind === "house") {
            ctx.fillStyle = "#FEF3C7";
            ctx.strokeStyle = "#1E293B";
            ctx.lineWidth = 2.5;
            ctx.fillRect(ox, oy + ob.h * 0.35, ob.w, ob.h * 0.65);
            ctx.strokeRect(ox, oy + ob.h * 0.35, ob.w, ob.h * 0.65);

            ctx.fillStyle = "#DC2626";
            ctx.beginPath();
            ctx.moveTo(ox - 6, oy + ob.h * 0.38);
            ctx.lineTo(ox + ob.w / 2, oy);
            ctx.lineTo(ox + ob.w + 6, oy + ob.h * 0.38);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = "#92400E";
            ctx.strokeStyle = "#451A03";
            ctx.lineWidth = 2;
            ctx.fillRect(ox + 16, oy + ob.h * 0.52, 22, ob.h * 0.48);
            ctx.strokeRect(ox + 16, oy + ob.h * 0.52, 22, ob.h * 0.48);
            ctx.fillStyle = "#FDE047";
            ctx.beginPath();
            ctx.arc(ox + 34, oy + ob.h * 0.74, 2, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = "#38BDF8";
            ctx.strokeStyle = "#0F172A";
            ctx.lineWidth = 2;
            ctx.fillRect(ox + ob.w - 36, oy + ob.h * 0.52, 20, 20);
            ctx.strokeRect(ox + ob.w - 36, oy + ob.h * 0.52, 20, 20);
            ctx.strokeStyle = "#FEF3C7";
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(ox + ob.w - 26, oy + ob.h * 0.52);
            ctx.lineTo(ox + ob.w - 26, oy + ob.h * 0.52 + 20);
            ctx.moveTo(ox + ob.w - 36, oy + ob.h * 0.52 + 10);
            ctx.lineTo(ox + ob.w - 16, oy + ob.h * 0.52 + 10);
            ctx.stroke();

          } else if (ob.kind === "statue") {
            ctx.fillStyle = "#475569";
            ctx.fillRect(ox, oy + 18, ob.w, ob.h - 18);
            ctx.strokeStyle = "#1E293B";
            ctx.lineWidth = 2;
            ctx.strokeRect(ox, oy + 18, ob.w, ob.h - 18);
            ctx.fillStyle = "#64748B";
            ctx.beginPath();
            ctx.arc(ox + ob.w / 2, oy + 14, 16, 0, Math.PI * 2);
            ctx.fill(); ctx.stroke();

            const eyeGlow = 0.85 + Math.sin(now * 2.4 + ob.x * 0.1) * 0.15;
            ctx.fillStyle = `rgba(250, 204, 21, ${eyeGlow})`;
            ctx.fillRect(ox + ob.w / 2 - 7, oy + 11, 4, 4);
            ctx.fillRect(ox + ob.w / 2 + 3, oy + 11, 4, 4);

          } else if (ob.kind === "broken_pillar") {
            ctx.fillStyle = "#475569";
            ctx.fillRect(ox, oy + 32, ob.w, ob.h - 32);
            ctx.strokeStyle = "#1E293B";
            ctx.lineWidth = 2;
            ctx.strokeRect(ox, oy + 32, ob.w, ob.h - 32);
          } else if (ob.kind === "reef") {
            ctx.fillStyle = "#334155";
            ctx.beginPath();
            ctx.arc(ox + ob.w / 2, oy + ob.h / 2, ob.w * 0.45, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#FB7185";
            ctx.beginPath();
            ctx.arc(ox + ob.w * 0.38, oy + ob.h * 0.38, 7, 0, Math.PI * 2);
            ctx.fill();
          } else {
            const treeSway = Math.sin(now * 1.3 + ob.x * 0.05) * 2.2;
            ctx.fillStyle = "#78350F";
            ctx.fillRect(ox + ob.w * 0.38, oy + ob.h * 0.55, ob.w * 0.24, ob.h * 0.45);
            ctx.fillStyle = "#15803D";
            ctx.beginPath();
            ctx.arc(ox + ob.w / 2 + treeSway, oy + ob.h * 0.42, ob.w * 0.46, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#22C55E";
            ctx.beginPath();
            ctx.arc(ox + ob.w * 0.44 + treeSway * 1.2, oy + ob.h * 0.34, ob.w * 0.3, 0, Math.PI * 2);
            ctx.fill();
          }
        });

        chunk.decorList.forEach(d => {
          const dx = d.x - camX + width / 2;
          const dy = d.y - camY + height / 2;
          ctx.save();
          ctx.translate(dx, dy);
          if (d.type === "starfish") {
            ctx.fillStyle = "#FB7185";
            ctx.beginPath(); ctx.arc(0, 0, 4.5, 0, Math.PI * 2); ctx.fill();
          } else if (d.type === "shell") {
            ctx.fillStyle = "#FDE68A";
            ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI); ctx.fill();
          } else {
            ctx.rotate(now * 0.35 + d.x * 0.1);
            ctx.fillStyle = d.color || "#F87171";
            ctx.fillRect(-2.5, -5, 5, 5); ctx.fillRect(-2.5, 1, 5, 5);
            ctx.fillRect(-5, -2.5, 5, 5); ctx.fillRect(1, -2.5, 5, 5);
            ctx.fillStyle = "#FACC15";
            ctx.fillRect(-2, -2, 4, 4);
          }
          ctx.restore();
        });
      }
    }

    ctx.save();
    const plx = 0.45;
    const areaW = 1600;
    const areaH = 1400;
    const isBay = stage.id === "cerulean_bay";
    const shadowColor = isBay ? "rgba(2, 28, 62, " : "rgba(8, 30, 14, ";

    this.clouds.forEach(c => {
      const moveX = c.x + this.cloudTime * c.speed - camX * plx;
      const moveY = c.y + this.cloudTime * (c.speed * 0.3) - camY * plx;
      const sx = ((moveX % areaW) + areaW) % areaW - (areaW * 0.25);
      const sy = ((moveY % areaH) + areaH) % areaH - (areaH * 0.25);

      c.puffs.forEach(p => {
        const px = sx + p.ox * c.scale * 2.0;
        const py = sy + p.oy * c.scale * 2.0;
        const pr = p.r * c.scale * 2.5;

        const grad = ctx.createRadialGradient(px, py, pr * 0.15, px, py, pr);
        grad.addColorStop(0, `${shadowColor}0.32)`);
        grad.addColorStop(0.5, `${shadowColor}0.18)`);
        grad.addColorStop(1, `${shadowColor}0)`);

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(px, py, pr, 0, Math.PI * 2);
        ctx.fill();
      });
    });
    ctx.restore();
  },

  renderWeatherOverlays(ctx, width, height) {
    if (this.weather === "RAIN" || this.weather === "THUNDER") {
      ctx.save();
      const isThunder = this.weather === "THUNDER";
      ctx.strokeStyle = isThunder ? "rgba(224, 242, 254, 0.34)" : "rgba(186, 230, 253, 0.32)";
      ctx.lineWidth = isThunder ? 1.6 : 1.3;
      const slant = isThunder ? 24 : 12;

      for (let x = -20; x < width + 50; x += (isThunder ? 32 : 46)) {
        for (let y = (x * 5 + this.rainOffset) % 65; y < height; y += 65) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x - slant, y + (isThunder ? 32 : 22));
          ctx.stroke();
        }
      }

      ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
      ctx.lineWidth = 1.0;
      this.splashParticles.forEach(sp => {
        ctx.beginPath();
        ctx.ellipse(sp.x, sp.y, sp.r * 1.3, sp.r * 0.5, 0, 0, Math.PI * 2);
        ctx.stroke();
      });

      if (isThunder && this.lightningFlashAlpha > 0) {
        ctx.fillStyle = `rgba(235, 245, 255, ${this.lightningFlashAlpha})`;
        ctx.fillRect(0, 0, width, height);
      }
      ctx.restore();

    } else if (this.weather === "BLIZZARD") {
      ctx.save();
      ctx.fillStyle = "rgba(224, 242, 254, 0.88)";
      const t = performance.now() * 0.002;
      for (let i = 0; i < 65; i++) {
        const sx = ((i * 47 + t * 45 + Math.sin(t * 1.5 + i) * 25) % width);
        const sy = ((i * 61 + t * 125) % height);
        const sz = (i % 3 === 0) ? 3.4 : (i % 2 === 0 ? 2.4 : 1.6);
        ctx.beginPath();
        ctx.arc(sx, sy, sz, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "rgba(186, 230, 253, 0.12)";
      ctx.fillRect(0, 0, width, height);
      ctx.restore();

    } else if (this.weather === "HEATWAVE") {
      ctx.save();
      ctx.fillStyle = "rgba(249, 115, 22, 0.11)";
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = "rgba(253, 224, 71, 0.45)";
      const t = performance.now() * 0.003;
      for (let i = 0; i < 30; i++) {
        const hx = (i * 73 + Math.sin(t * 2.0 + i) * 18) % width;
        const hy = height - ((i * 37 + t * 90) % height);
        ctx.beginPath();
        ctx.arc(hx, hy, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

    } else if (this.weather === "PSYCHIC") {
      ctx.save();
      ctx.fillStyle = "rgba(192, 132, 252, 0.65)";
      const t = performance.now() * 0.002;
      for (let i = 0; i < 22; i++) {
        const ax = ((i * 137 + t * 35) % width);
        const ay = ((i * 93 + Math.sin(t + i) * 80) % height);
        ctx.beginPath();
        ctx.arc(ax, ay, 2.8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }
};

window.addEventListener("DOMContentLoaded", () => MapEngine.init());
