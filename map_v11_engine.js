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
    tileLight: "#4A7043",
    tileDark: "#3D5E38",
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

  spritePropCache: new Map(),

  init() {
    this.prebakeTileTextures();
    this.prebakePixelProps();
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

        if (st.id === "pallet") {
          // GBA 火紅/葉綠版溫潤草地色階 (消除生硬棋盤格，改為柔和像素草芽簇與三葉草紋理)
          c.fillStyle = isDark ? "#46783E" : "#4E8245";
          c.fillRect(0, 0, 60, 60);

          // 像素點陣草皮抖動微紋理 (4x4 pixel grid feel)
          c.fillStyle = isDark ? "#3B6634" : "#42703A";
          const tufts = isDark ? [[8, 12], [36, 20], [20, 44], [48, 48]] : [[14, 16], [42, 10], [26, 38], [10, 50]];
          tufts.forEach(([tx, ty]) => {
            c.fillRect(tx, ty + 2, 2, 4);
            c.fillRect(tx + 3, ty, 2, 6);
            c.fillRect(tx + 6, ty + 2, 2, 4);
          });

          // 嫩綠受光草尖點陣
          c.fillStyle = "#68A357";
          tufts.forEach(([tx, ty]) => {
            c.fillRect(tx + 3, ty, 2, 2);
            c.fillRect(tx + 6, ty + 2, 2, 2);
          });
        } else if (st.id === "cerulean_bay") {
          c.fillStyle = isDark ? st.tileDark : st.tileLight;
          c.fillRect(0, 0, 60, 60);
          c.fillStyle = isDark ? "#4F4030" : "#574837";
          c.fillRect(8, 12, 3, 3); c.fillRect(34, 18, 3, 3); c.fillRect(48, 42, 3, 3); c.fillRect(18, 50, 3, 3);
        } else if (st.id === "sky_pillar") {
          c.fillStyle = isDark ? "#251E38" : "#2B243D";
          c.fillRect(0, 0, 60, 60);
          // 古神殿石板像素裂紋與高光邊
          c.fillStyle = "#1B152B";
          c.fillRect(0, 58, 60, 2);
          c.fillRect(58, 0, 2, 60);
          c.fillStyle = "rgba(192, 132, 252, 0.10)";
          c.fillRect(2, 2, 56, 2);
          c.fillStyle = isDark ? "#1C1729" : "#221C32";
          c.fillRect(14, 16, 6, 2); c.fillRect(18, 18, 4, 2);
          c.fillRect(40, 36, 6, 2); c.fillRect(38, 38, 4, 2);
        }

        this.tileCache.set(key, can);
      });
    });
  },

  // GBA 火紅/葉綠風格程序化像素物件預烘焙器 (離線一次性生成，戰鬥中 0 向量運算直接 drawImage)
  prebakePixelProps() {
    const P = 2; // 2x2 像素點陣單位，營造道地 16-bit 顆粒感
    const dot = (c, x, y, w, h, col) => {
      c.fillStyle = col;
      c.fillRect(Math.round(x / P) * P, Math.round(y / P) * P, Math.round(w / P) * P, Math.round(h / P) * P);
    };

    const fillPixelBlob = (c, cx, cy, rx, ry, col) => {
      c.fillStyle = col;
      for (let py = cy - ry; py <= cy + ry; py += P) {
        for (let px = cx - rx; px <= cx + rx; px += P) {
          const nx = (px - cx) / rx;
          const ny = (py - cy) / ry;
          if (nx * nx + ny * ny <= 1.0) {
            c.fillRect(Math.floor(px / P) * P, Math.floor(py / P) * P, P, P);
          }
        }
      }
    };

    // 1. GBA 常磐森林三層簇狀點陣大樹 (oak_tree_base 樹幹底座 + oak_tree_canopy 茂密像素樹冠)
    const treeW = 72, treeH = 76;
    const canTreeFull = document.createElement("canvas");
    canTreeFull.width = treeW; canTreeFull.height = treeH;
    const ct = canTreeFull.getContext("2d");

    const canTreeCanopy = document.createElement("canvas");
    canTreeCanopy.width = treeW; canTreeCanopy.height = treeH;
    const cc = canTreeCanopy.getContext("2d");

    // 樹底橢圓像素落影
    fillPixelBlob(ct, 36, 64, 26, 9, "rgba(15, 23, 42, 0.38)");

    // 像素樹幹與盤根細節 (僅繪製於底座層)
    dot(ct, 24, 42, 24, 24, "#3E1F0D");
    dot(ct, 26, 42, 20, 22, "#5C2E14");
    dot(ct, 28, 44, 8, 20, "#7C3F1D");
    dot(ct, 32, 46, 4, 16, "#9A5226");
    // 盤根外擴像素
    dot(ct, 20, 60, 8, 6, "#3E1F0D");
    dot(ct, 44, 60, 8, 6, "#3E1F0D");
    dot(ct, 22, 60, 6, 4, "#7C3F1D");

    // 繪製三層像素簇狀樹冠的共用函數 (同時寫入全樹與前景樹冠層)
    const bakeCanopy = (ctx) => {
      const clusters = [
        { x: 22, y: 36, rx: 16, ry: 15 },
        { x: 50, y: 36, rx: 16, ry: 15 },
        { x: 18, y: 24, rx: 15, ry: 14 },
        { x: 54, y: 24, rx: 15, ry: 14 },
        { x: 36, y: 40, rx: 22, ry: 15 },
        { x: 36, y: 24, rx: 22, ry: 18 },
        { x: 36, y: 15, rx: 17, ry: 13 }
      ];
      // 第一層：GBA 深墨綠粗像素外輪廓與底影 (#13381F)
      clusters.forEach(cl => fillPixelBlob(ctx, cl.x, cl.y + 2, cl.rx + 2, cl.ry + 2, "#13381F"));
      // 第二層：森林深綠背光葉簇 (#1F5C2E)
      clusters.forEach(cl => fillPixelBlob(ctx, cl.x, cl.y, cl.rx, cl.ry, "#1F5C2E"));
      // 第三層：中層翠綠飽滿葉團 (#2E8540)
      clusters.forEach(cl => fillPixelBlob(ctx, cl.x, cl.y - 2, cl.rx - 2, cl.ry - 3, "#2E8540"));
      // 第四層：頂部受光嫩綠像素亮團 (#52B756)
      fillPixelBlob(ctx, 24, 19, 10, 8, "#52B756");
      fillPixelBlob(ctx, 46, 19, 10, 8, "#52B756");
      fillPixelBlob(ctx, 35, 13, 13, 9, "#52B756");
      fillPixelBlob(ctx, 33, 29, 14, 8, "#52B756");
      // 第五層：GBA 標誌性檸檬綠點陣鋸齒高光 (#8CE070)
      const highlights = [
        [28, 8], [32, 6], [36, 6], [40, 8],
        [18, 14], [22, 12], [46, 12], [50, 14],
        [26, 24], [30, 22], [38, 22], [42, 24]
      ];
      highlights.forEach(([hx, hy]) => dot(ctx, hx, hy, 4, 4, "#8CE070"));
    };

    bakeCanopy(ct);
    bakeCanopy(cc);
    this.spritePropCache.set("oak_tree_full", canTreeFull);
    this.spritePropCache.set("oak_tree_canopy", canTreeCanopy);

    // 2. GBA 真新鎮紅頂像素木屋 (house_full + house_roof)
    const hw = 104, hh = 94;
    const canHouse = document.createElement("canvas");
    canHouse.width = hw; canHouse.height = hh;
    const ch = canHouse.getContext("2d");

    const canRoof = document.createElement("canvas");
    canRoof.width = hw; canRoof.height = hh;
    const cr = canRoof.getContext("2d");

    // 房屋地面像素陰影與石砌地基
    dot(ch, 6, 36, 92, 54, "rgba(15, 23, 42, 0.35)");
    dot(ch, 4, 34, 92, 52, "#1E293B");
    dot(ch, 6, 78, 88, 6, "#64748B");
    dot(ch, 6, 36, 88, 42, "#FFFBEB");
    // 牆面水平木紋磚線
    for (let wy = 44; wy < 76; wy += 8) {
      dot(ch, 6, wy, 88, 2, "#E2E8F0");
    }
    // 像素木門與金門把
    dot(ch, 20, 50, 24, 34, "#451A03");
    dot(ch, 22, 52, 20, 32, "#92400E");
    dot(ch, 24, 54, 16, 12, "#B45309");
    dot(ch, 36, 68, 4, 4, "#FACC15");
    // 像素玻璃格窗與木窗台
    dot(ch, 58, 48, 26, 24, "#0F172A");
    dot(ch, 60, 50, 22, 20, "#38BDF8");
    dot(ch, 62, 52, 8, 8, "#BAE6FD");
    dot(ch, 70, 50, 2, 20, "#FFFBEB");
    dot(ch, 60, 58, 22, 2, "#FFFBEB");
    dot(ch, 56, 70, 30, 4, "#B45309");

    const bakeRoof = (ctx) => {
      // 階梯狀像素斜屋頂 + 瓦片橫紋
      for (let ry = 4; ry <= 38; ry += P) {
        const prog = (ry - 4) / 34;
        const halfSpan = Math.round((12 + prog * 38) / P) * P;
        dot(ctx, 50 - halfSpan - 2, ry, halfSpan * 2 + 4, P, "#450A0A");
        dot(ctx, 50 - halfSpan, ry, halfSpan * 2, P, (ry % 6 === 0) ? "#B91C1C" : "#DC2626");
        if (ry % 6 === 2) {
          dot(ctx, 50 - halfSpan + 4, ry, halfSpan * 2 - 8, P, "#EF4444");
        }
      }
      // 屋脊亮紅高光條
      dot(ctx, 36, 4, 28, 4, "#FCA5A5");
      dot(ctx, 4, 36, 92, 4, "#991B1B");
    };
    bakeRoof(ch);
    bakeRoof(cr);
    this.spritePropCache.set("house_full", canHouse);
    this.spritePropCache.set("house_roof", canRoof);

    // 3. GBA 像素紅白小花叢 (flower_red / flower_white)
    ["red", "white"].forEach(kind => {
      const cfCan = document.createElement("canvas");
      cfCan.width = 20; cfCan.height = 20;
      const cfc = cfCan.getContext("2d");
      // 翠綠底座葉片
      dot(cfc, 4, 12, 12, 4, "#15803D");
      dot(cfc, 6, 10, 8, 4, "#22C55E");
      // 花瓣與花蕊
      const petalCol = kind === "red" ? "#F87171" : "#F8FAFC";
      const shadeCol = kind === "red" ? "#DC2626" : "#CBD5E1";
      dot(cfc, 6, 4, 8, 8, shadeCol);
      dot(cfc, 8, 2, 4, 10, petalCol);
      dot(cfc, 4, 6, 12, 4, petalCol);
      dot(cfc, 8, 6, 4, 4, "#FACC15");
      this.spritePropCache.set(`flower_${kind}`, cfCan);
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

    if (this.chunkCache.size >= 64) {
      const oldestKey = this.chunkCache.keys().next().value;
      if (oldestKey !== undefined) this.chunkCache.delete(oldestKey);
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
          // 方案 A：橫木 (fallen_log) 跨越與防卡邏輯
          if (ob.kind === "fallen_log") {
            // 怪物追擊主角時，直接允許跨越橫木忽略剛體碰撞，不再被卡死！
            if (!isPlayer) continue;

            // 玩家向下移動時觸發跨躍起跳
            if (ent.vy > 0 && ent.y >= ob.y - 18 && ent.y <= ob.y + 12 && ent.x >= ob.x - 10 && ent.x <= ob.x + ob.w + 10) {
              if (!ent.isJumpingLedge) {
                ent.isJumpingLedge = true;
                ent.jumpTimer = 0;
              }
              continue;
            }
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
            // GBA 1號道路鵝卵石自然咬合泥土路（溫暖沙黃路徑 + 像素鋸齒草皮咬合邊 + 鵝卵石顆粒）
            ctx.fillStyle = "#C29B61";
            ctx.fillRect(rx, ry, r.w, r.h);
            ctx.fillStyle = "#D6B278";
            if (r.dir === "H") {
              ctx.fillRect(rx, ry + 8, r.w, r.h - 16);
              // 上下草皮像素鋸齒咬合邊與內凹暗影
              for (let sx = rx; sx < rx + r.w; sx += 12) {
                ctx.fillStyle = "#3B6634";
                ctx.fillRect(sx, ry, 8, 4);
                ctx.fillRect(sx + 4, ry + r.h - 4, 8, 4);
                ctx.fillStyle = "#8C673A";
                ctx.fillRect(sx, ry + 4, 8, 3);
                ctx.fillRect(sx + 4, ry + r.h - 7, 8, 3);
                // 路面鵝卵石與小碎石點綴
                ctx.fillStyle = "#A8824C";
                ctx.fillRect(sx + 2, ry + 16 + ((sx * 7) % 30), 6, 4);
                ctx.fillStyle = "#EAD09E";
                ctx.fillRect(sx + 6, ry + 22 + ((sx * 13) % 24), 4, 3);
              }
            } else {
              ctx.fillRect(rx + 8, ry, r.w - 16, r.h);
              for (let sy = ry; sy < ry + r.h; sy += 12) {
                ctx.fillStyle = "#3B6634";
                ctx.fillRect(rx, sy, 4, 8);
                ctx.fillRect(rx + r.w - 4, sy + 4, 4, 8);
                ctx.fillStyle = "#8C673A";
                ctx.fillRect(rx + 4, sy, 3, 8);
                ctx.fillRect(rx + r.w - 7, sy + 4, 3, 8);
                ctx.fillStyle = "#A8824C";
                ctx.fillRect(rx + 16 + ((sy * 7) % 30), sy + 2, 4, 6);
                ctx.fillStyle = "#EAD09E";
                ctx.fillRect(rx + 22 + ((sy * 13) % 24), sy + 6, 3, 4);
              }
            }
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
            // GBA 經典深綠茂密野生高草叢（帶像素鋸齒邊框與隨風搖曳的雙色像素草簇）
            ctx.fillStyle = "#14381F";
            ctx.fillRect(gx - 2, gy - 2, g.w + 4, g.h + 4);
            ctx.fillStyle = stage.slowZoneColor;
            ctx.fillRect(gx, gy, g.w, g.h);

            for (let px = gx + 10; px < gx + g.w - 8; px += 18) {
              for (let py = gy + 12; py < gy + g.h - 6; py += 18) {
                const sway = Math.round(Math.sin(now * 1.8 + px * 0.05 + py * 0.05) * 2.0);
                // 像素草簇深色根部
                ctx.fillStyle = "#0F2917";
                ctx.fillRect(px - 5, py - 2, 10, 4);
                // 左中右三片像素草葉
                ctx.fillStyle = "#2E8540";
                ctx.fillRect(px - 6 + sway, py - 7, 3, 6);
                ctx.fillRect(px - 1 + sway, py - 9, 3, 8);
                ctx.fillRect(px + 4 + sway, py - 7, 3, 6);
                // 草葉受光亮尖
                ctx.fillStyle = "#74E068";
                ctx.fillRect(px - 6 + sway, py - 8, 3, 2);
                ctx.fillRect(px - 1 + sway, py - 10, 3, 2);
                ctx.fillRect(px + 4 + sway, py - 8, 3, 2);
              }
            }
          }
        });

        chunk.ledges.forEach(l => {
          const lx = l.x - camX + width / 2;
          const ly = l.y - camY + height / 2;
          // GBA 三段式立體跳崖（底部落地暗影 + 垂直岩石切面 + 頂部亮綠懸崖草皮邊）
          ctx.fillStyle = "rgba(15, 23, 42, 0.38)";
          ctx.fillRect(lx + 2, ly + l.h, l.w - 4, 6);

          ctx.fillStyle = "#3E1F0D";
          ctx.fillRect(lx - 2, ly - 2, l.w + 4, l.h + 4);

          ctx.fillStyle = "#7C3F1D";
          ctx.fillRect(lx, ly + 4, l.w, l.h - 4);

          // 岩壁像素縱向立體凹凸紋
          for (let rx = lx + 6; rx < lx + l.w - 6; rx += 14) {
            ctx.fillStyle = "#5C2E14";
            ctx.fillRect(rx, ly + 6, 4, l.h - 8);
            ctx.fillStyle = "#9A5226";
            ctx.fillRect(rx + 4, ly + 6, 4, l.h - 10);
          }

          // 懸崖上緣覆蓋亮綠草皮齒邊
          ctx.fillStyle = "#68A357";
          ctx.fillRect(lx, ly - 2, l.w, 5);
          ctx.fillStyle = "#46783E";
          for (let gx = lx + 4; gx < lx + l.w - 4; gx += 10) {
            ctx.fillRect(gx, ly + 2, 6, 3);
          }

          // 經典單向跳崖指示小箭頭
          ctx.fillStyle = "#FEF08A";
          const count = Math.max(1, Math.floor((l.w - 30) / 42));
          const spacing = (l.w - 40) / (count > 1 ? count - 1 : 1);
          for (let i = 0; i < count; i++) {
            const px = Math.round(lx + 20 + i * spacing);
            ctx.fillRect(px - 4, ly + 7, 8, 2);
            ctx.fillRect(px - 2, ly + 9, 4, 2);
            ctx.fillRect(px - 1, ly + 11, 2, 2);
          }
        });

        chunk.obstacles.forEach(ob => {
          const ox = ob.x - camX + width / 2;
          const oy = ob.y - camY + height / 2;
          if (ob.kind !== "oak_tree" && ob.kind !== "house") {
            ctx.fillStyle = "rgba(0,0,0,0.3)";
            ctx.fillRect(ox + 4, oy + 6, ob.w, ob.h);
          }

          if (ob.kind === "house") {
            const hCan = this.spritePropCache.get("house_full");
            if (hCan) {
              ctx.drawImage(hCan, ox - 4, oy - 4);
            }
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
          } else if (ob.kind === "fallen_log") {
            // 橫木 (fallen_log)：GBA 樹皮橫幹 + 兩端年輪切面
            ctx.fillStyle = "#5C2D0C";
            ctx.strokeStyle = "#2E1505";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(ox, oy + 8, ob.w, ob.h - 12, 8);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = "#78350F";
            ctx.fillRect(ox + 8, oy + 12, ob.w - 16, 6);

            ctx.fillStyle = "#D97706";
            ctx.beginPath();
            ctx.ellipse(ox + 6, oy + ob.h / 2 + 2, 5, (ob.h - 14) / 2, 0, 0, Math.PI * 2);
            ctx.ellipse(ox + ob.w - 6, oy + ob.h / 2 + 2, 5, (ob.h - 14) / 2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          } else if (ob.kind === "tree_stump") {
            // 斷木樁 (tree_stump)：立體樹根底座 + 頂部淺木色年輪
            ctx.fillStyle = "#5C2D0C";
            ctx.strokeStyle = "#2E1505";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(ox + 4, oy + 14, ob.w - 8, ob.h - 16, 6);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = "#F59E0B";
            ctx.beginPath();
            ctx.ellipse(ox + ob.w / 2, oy + 16, (ob.w - 10) / 2, 10, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            ctx.strokeStyle = "#92400E";
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.ellipse(ox + ob.w / 2, oy + 16, (ob.w - 22) / 2, 5, 0, 0, Math.PI * 2);
            ctx.stroke();
          } else {
            const tCan = this.spritePropCache.get("oak_tree_full");
            if (tCan) {
              ctx.drawImage(tCan, ox - 4, oy - 4);
            }
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
          } else if (d.type === "crooked_sign") {
            ctx.rotate(-0.12);
            ctx.fillStyle = "#78350F";
            ctx.fillRect(-2, 0, 4, 9);
            ctx.fillStyle = "#D97706";
            ctx.strokeStyle = "#451A03";
            ctx.lineWidth = 1.5;
            ctx.fillRect(-9, -8, 18, 10);
            ctx.strokeRect(-9, -8, 18, 10);
          } else {
            const fKey = (d.color === "#F87171") ? "flower_red" : "flower_white";
            const fCan = this.spritePropCache.get(fKey);
            if (fCan) {
              const fBob = Math.round(Math.sin(now * 2.0 + d.x * 0.1) * 1.2);
              ctx.drawImage(fCan, -10 + fBob, -10);
            }
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

  // P1 新增：GBA 2.5D 樹冠與屋頂前景遮擋層（角色走到樹後/屋頂北側時自動產生半透明景深遮罩）
  renderForegroundCanopies(ctx, camX, camY, width, height, player, trainer) {
    const stage = this.currentStage;
    const startCx = Math.floor((camX - width / 2) / 600) - 1;
    const endCx = Math.floor((camX + width / 2) / 600) + 1;
    const startCy = Math.floor((camY - height / 2) / 600) - 1;
    const endCy = Math.floor((camY + height / 2) / 600) + 1;
    const now = performance.now() * 0.0016;

    const checkOccluded = (ent, ob) => {
      if (!ent) return false;
      const footY = ent.y + 18;
      // 角色腳底位於障礙物底部北側（上方），且身體與樹冠/屋頂上半部重疊
      return (
        footY < ob.y + ob.h * 0.88 &&
        ent.y > ob.y - 28 &&
        ent.x > ob.x - 24 &&
        ent.x < ob.x + ob.w + 24
      );
    };

    for (let cx = startCx; cx <= endCx; cx++) {
      for (let cy = startCy; cy <= endCy; cy++) {
        const chunk = this.getBiomeChunk(cx, cy);
        chunk.obstacles.forEach(ob => {
          if (ob.kind !== "oak_tree" && ob.kind !== "house" && ob.kind !== "statue") return;
          const ox = ob.x - camX + width / 2;
          const oy = ob.y - camY + height / 2;
          if (ox + ob.w < -40 || ox > width + 40 || oy + ob.h < -40 || oy > height + 40) return;

          const playerBehind = checkOccluded(player, ob) || checkOccluded(trainer, ob);
          // 只有當主角、訓練家或附近怪獸處於該障礙物北側（或為營造樹冠立體層次）時重繪上半部樹冠/屋頂
          ctx.save();
          if (playerBehind) {
            ctx.globalAlpha = 0.52; // 角色走到樹冠或屋簷後方時自動半透明，兼顧 2.5D 遮擋感與視野清晰度
          }

          if (ob.kind === "house") {
            const rCan = this.spritePropCache.get("house_roof");
            if (rCan) ctx.drawImage(rCan, ox - 4, oy - 4);
          } else if (ob.kind === "statue") {
            ctx.fillStyle = "#64748B";
            ctx.strokeStyle = "#1E293B";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(ox + ob.w / 2, oy + 14, 16, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            const eyeGlow = 0.85 + Math.sin(now * 2.4 + ob.x * 0.1) * 0.15;
            ctx.fillStyle = `rgba(250, 204, 21, ${eyeGlow})`;
            ctx.fillRect(ox + ob.w / 2 - 7, oy + 11, 4, 4);
            ctx.fillRect(ox + ob.w / 2 + 3, oy + 11, 4, 4);
          } else if (ob.kind === "oak_tree") {
            const cCan = this.spritePropCache.get("oak_tree_canopy");
            if (cCan) ctx.drawImage(cCan, ox - 4, oy - 4);
          }
          ctx.restore();
        });
      }
    }
  },

  renderWeatherOverlays(ctx, width, height) {
    if (this.weather === "RAIN" || this.weather === "THUNDER") {
      ctx.save();
      const isThunder = this.weather === "THUNDER";
      ctx.strokeStyle = isThunder ? "rgba(224, 242, 254, 0.34)" : "rgba(186, 230, 253, 0.32)";
      ctx.lineWidth = isThunder ? 1.6 : 1.3;
      const slant = isThunder ? 24 : 12;
      const dropLen = isThunder ? 32 : 22;

      // 單一 Batch 批次繪製所有雨絲 (將 150+ 次獨立 stroke() 合併為 1 次，大幅降低 iOS 繪圖消耗)
      ctx.beginPath();
      for (let x = -20; x < width + 50; x += (isThunder ? 32 : 46)) {
        for (let y = (x * 5 + this.rainOffset) % 65; y < height; y += 65) {
          ctx.moveTo(x, y);
          ctx.lineTo(x - slant, y + dropLen);
        }
      }
      ctx.stroke();

      if (this.splashParticles.length > 0) {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        for (let i = 0; i < this.splashParticles.length; i++) {
          const sp = this.splashParticles[i];
          const rx = sp.r * 1.3;
          ctx.moveTo(sp.x + rx, sp.y);
          ctx.ellipse(sp.x, sp.y, rx, sp.r * 0.5, 0, 0, Math.PI * 2);
        }
        ctx.stroke();
      }

      if (isThunder && this.lightningFlashAlpha > 0) {
        ctx.fillStyle = `rgba(235, 245, 255, ${this.lightningFlashAlpha})`;
        ctx.fillRect(0, 0, width, height);
      }
      ctx.restore();

    } else if (this.weather === "BLIZZARD") {
      ctx.save();
      ctx.fillStyle = "rgba(224, 242, 254, 0.88)";
      const t = performance.now() * 0.002;
      ctx.beginPath();
      for (let i = 0; i < 65; i++) {
        const sx = ((i * 47 + t * 45 + Math.sin(t * 1.5 + i) * 25) % width);
        const sy = ((i * 61 + t * 125) % height);
        const sz = (i % 3 === 0) ? 3.4 : (i % 2 === 0 ? 2.4 : 1.6);
        ctx.moveTo(sx + sz, sy);
        ctx.arc(sx, sy, sz, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.fillStyle = "rgba(186, 230, 253, 0.12)";
      ctx.fillRect(0, 0, width, height);
      ctx.restore();

    } else if (this.weather === "HEATWAVE") {
      ctx.save();
      ctx.fillStyle = "rgba(249, 115, 22, 0.11)";
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = "rgba(253, 224, 71, 0.45)";
      const t = performance.now() * 0.003;
      ctx.beginPath();
      for (let i = 0; i < 30; i++) {
        const hx = (i * 73 + Math.sin(t * 2.0 + i) * 18) % width;
        const hy = height - ((i * 37 + t * 90) % height);
        ctx.moveTo(hx + 2.2, hy);
        ctx.arc(hx, hy, 2.2, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.restore();

    } else if (this.weather === "PSYCHIC") {
      ctx.save();
      ctx.fillStyle = "rgba(192, 132, 252, 0.65)";
      const t = performance.now() * 0.002;
      ctx.beginPath();
      for (let i = 0; i < 22; i++) {
        const ax = ((i * 137 + t * 35) % width);
        const ay = ((i * 93 + Math.sin(t + i) * 80) % height);
        ctx.moveTo(ax + 2.8, ay);
        ctx.arc(ax, ay, 2.8, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.restore();
    }
  }
};

window.addEventListener("DOMContentLoaded", () => MapEngine.init());
