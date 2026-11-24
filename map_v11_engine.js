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
  isArenaMode: false,
  arenaHalfW: 300,
  arenaHalfH: 230,
  arenaPillars: [
    { x: -175, y: -125, w: 40, h: 40 },
    { x:  135, y: -125, w: 40, h: 40 },
    { x: -175, y:   85, w: 40, h: 40 },
    { x:  135, y:   85, w: 40, h: 40 }
  ],

  setArenaMode(enabled) {
    this.isArenaMode = !!enabled;
  },

  hitArenaPillar(x, y, radius = 0) {
    if (!this.isArenaMode) return null;
    for (let i = 0; i < this.arenaPillars.length; i++) {
      const pl = this.arenaPillars[i];
      if (x + radius >= pl.x && x - radius <= pl.x + pl.w &&
          y + radius >= pl.y && y - radius <= pl.y + pl.h) {
        return pl;
      }
    }
    return null;
  },

  isArenaLosBlocked(x1, y1, x2, y2, pad = 12) {
    if (!this.isArenaMode) return false;
    for (let s = 1; s <= 5; s++) {
      const t = s / 6;
      const sx = x1 + (x2 - x1) * t;
      const sy = y1 + (y2 - y1) * t;
      if (this.hitArenaPillar(sx, sy, pad)) return true;
    }
    return false;
  },

  clipRayAgainstArenaPillars(ox, oy, angle, maxLen, pad = 4) {
    if (!this.isArenaMode || !this.arenaPillars || this.arenaPillars.length === 0) {
      return { length: maxLen, hit: false };
    }
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    let bestT = maxLen;
    let hit = false;
    for (let i = 0; i < this.arenaPillars.length; i++) {
      const pl = this.arenaPillars[i];
      const minX = pl.x - pad;
      const maxX = pl.x + pl.w + pad;
      const minY = pl.y - pad;
      const maxY = pl.y + pl.h + pad;

      let tMin = 0;
      let tMax = bestT;

      if (Math.abs(dx) < 1e-6) {
        if (ox < minX || ox > maxX) continue;
      } else {
        const invDx = 1 / dx;
        let t1 = (minX - ox) * invDx;
        let t2 = (maxX - ox) * invDx;
        if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
        if (t1 > tMin) tMin = t1;
        if (t2 < tMax) tMax = t2;
        if (tMin > tMax) continue;
      }

      if (Math.abs(dy) < 1e-6) {
        if (oy < minY || oy > maxY) continue;
      } else {
        const invDy = 1 / dy;
        let t1 = (minY - oy) * invDy;
        let t2 = (maxY - oy) * invDy;
        if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
        if (t1 > tMin) tMin = t1;
        if (t2 < tMax) tMax = t2;
        if (tMin > tMax) continue;
      }

      if (tMin >= 0 && tMin < bestT) {
        bestT = tMin;
        hit = true;
      }
    }
    return { length: Math.max(12, bestT), hit };
  },
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

  // GBA 火紅/葉綠/寶石版程序化像素物件預烘焙器 (全三關卡離線一次性生成，戰鬥中 0 向量運算直接 drawImage)
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

    // 1. GBA 常磐森林三層簇狀點陣大樹 (oak_tree_full + oak_tree_canopy)
    const treeW = 72, treeH = 76;
    const canTreeFull = document.createElement("canvas");
    canTreeFull.width = treeW; canTreeFull.height = treeH;
    const ct = canTreeFull.getContext("2d");

    const canTreeCanopy = document.createElement("canvas");
    canTreeCanopy.width = treeW; canTreeCanopy.height = treeH;
    const cc = canTreeCanopy.getContext("2d");

    fillPixelBlob(ct, 36, 64, 26, 9, "rgba(15, 23, 42, 0.38)");
    dot(ct, 24, 42, 24, 24, "#3E1F0D");
    dot(ct, 26, 42, 20, 22, "#5C2E14");
    dot(ct, 28, 44, 8, 20, "#7C3F1D");
    dot(ct, 32, 46, 4, 16, "#9A5226");
    dot(ct, 20, 60, 8, 6, "#3E1F0D");
    dot(ct, 44, 60, 8, 6, "#3E1F0D");
    dot(ct, 22, 60, 6, 4, "#7C3F1D");

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
      clusters.forEach(cl => fillPixelBlob(ctx, cl.x, cl.y + 2, cl.rx + 2, cl.ry + 2, "#13381F"));
      clusters.forEach(cl => fillPixelBlob(ctx, cl.x, cl.y, cl.rx, cl.ry, "#1F5C2E"));
      clusters.forEach(cl => fillPixelBlob(ctx, cl.x, cl.y - 2, cl.rx - 2, cl.ry - 3, "#2E8540"));
      fillPixelBlob(ctx, 24, 19, 10, 8, "#52B756");
      fillPixelBlob(ctx, 46, 19, 10, 8, "#52B756");
      fillPixelBlob(ctx, 35, 13, 13, 9, "#52B756");
      fillPixelBlob(ctx, 33, 29, 14, 8, "#52B756");
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

    dot(ch, 6, 36, 92, 54, "rgba(15, 23, 42, 0.35)");
    dot(ch, 4, 34, 92, 52, "#1E293B");
    dot(ch, 6, 78, 88, 6, "#64748B");
    dot(ch, 6, 36, 88, 42, "#FFFBEB");
    for (let wy = 44; wy < 76; wy += 8) {
      dot(ch, 6, wy, 88, 2, "#E2E8F0");
    }
    dot(ch, 20, 50, 24, 34, "#451A03");
    dot(ch, 22, 52, 20, 32, "#92400E");
    dot(ch, 24, 54, 16, 12, "#B45309");
    dot(ch, 36, 68, 4, 4, "#FACC15");
    dot(ch, 58, 48, 26, 24, "#0F172A");
    dot(ch, 60, 50, 22, 20, "#38BDF8");
    dot(ch, 62, 52, 8, 8, "#BAE6FD");
    dot(ch, 70, 50, 2, 20, "#FFFBEB");
    dot(ch, 60, 58, 22, 2, "#FFFBEB");
    dot(ch, 56, 70, 30, 4, "#B45309");

    const bakeRoof = (ctx) => {
      for (let ry = 4; ry <= 38; ry += P) {
        const prog = (ry - 4) / 34;
        const halfSpan = Math.round((12 + prog * 38) / P) * P;
        dot(ctx, 50 - halfSpan - 2, ry, halfSpan * 2 + 4, P, "#450A0A");
        dot(ctx, 50 - halfSpan, ry, halfSpan * 2, P, (ry % 6 === 0) ? "#B91C1C" : "#DC2626");
        if (ry % 6 === 2) {
          dot(ctx, 50 - halfSpan + 4, ry, halfSpan * 2 - 8, P, "#EF4444");
        }
      }
      dot(ctx, 36, 4, 28, 4, "#FCA5A5");
      dot(ctx, 4, 36, 92, 4, "#991B1B");
    };
    bakeRoof(ch);
    bakeRoof(cr);
    this.spritePropCache.set("house_full", canHouse);
    this.spritePropCache.set("house_roof", canRoof);

    // 3. GBA 像素橫木 (fallen_log_pixel 100x44) ＆ 斷木樁 (tree_stump_pixel 52x52) ＆ 木路牌 (crooked_sign_pixel 28x28)
    const canLog = document.createElement("canvas");
    canLog.width = 100; canLog.height = 44;
    const clg = canLog.getContext("2d");
    dot(clg, 6, 16, 90, 24, "rgba(15, 23, 42, 0.35)");
    dot(clg, 2, 10, 96, 26, "#2E1505");
    dot(clg, 4, 12, 92, 22, "#5C2D0C");
    dot(clg, 10, 14, 80, 6, "#78350F");
    dot(clg, 16, 24, 68, 4, "#3E1F0D");
    // 兩端像素年輪切面与青苔點綴
    fillPixelBlob(clg, 8, 23, 5, 10, "#D97706");
    fillPixelBlob(clg, 8, 23, 2, 5, "#FDE68A");
    fillPixelBlob(clg, 92, 23, 5, 10, "#B45309");
    dot(clg, 24, 12, 10, 4, "#2E8540");
    dot(clg, 26, 10, 6, 4, "#52B756");
    this.spritePropCache.set("fallen_log_pixel", canLog);

    const canStump = document.createElement("canvas");
    canStump.width = 52; canStump.height = 52;
    const cst = canStump.getContext("2d");
    fillPixelBlob(cst, 26, 38, 22, 10, "rgba(15, 23, 42, 0.35)");
    dot(cst, 8, 20, 36, 24, "#2E1505");
    dot(cst, 6, 36, 40, 8, "#2E1505");
    dot(cst, 10, 22, 32, 20, "#5C2D0C");
    dot(cst, 14, 24, 6, 18, "#78350F");
    dot(cst, 26, 26, 4, 16, "#3E1F0D");
    fillPixelBlob(cst, 26, 20, 17, 9, "#2E1505");
    fillPixelBlob(cst, 26, 20, 15, 7, "#D97706");
    fillPixelBlob(cst, 26, 20, 10, 4, "#F59E0B");
    fillPixelBlob(cst, 26, 20, 4, 2, "#FEF08A");
    this.spritePropCache.set("tree_stump_pixel", canStump);

    const canSign = document.createElement("canvas");
    canSign.width = 28; canSign.height = 28;
    const csg = canSign.getContext("2d");
    dot(csg, 10, 22, 10, 4, "rgba(15, 23, 42, 0.35)");
    dot(csg, 12, 14, 4, 10, "#451A03");
    dot(csg, 4, 4, 20, 14, "#451A03");
    dot(csg, 6, 6, 16, 10, "#D97706");
    dot(csg, 8, 8, 12, 2, "#FEF08A");
    dot(csg, 8, 12, 8, 2, "#92400E");
    this.spritePropCache.set("crooked_sign_pixel", canSign);

    // 4. GBA 像素紅白小花叢 (flower_red / flower_white)
    ["red", "white"].forEach(kind => {
      const cfCan = document.createElement("canvas");
      cfCan.width = 20; cfCan.height = 20;
      const cfc = cfCan.getContext("2d");
      dot(cfc, 4, 12, 12, 4, "#15803D");
      dot(cfc, 6, 10, 8, 4, "#22C55E");
      const petalCol = kind === "red" ? "#F87171" : "#F8FAFC";
      const shadeCol = kind === "red" ? "#DC2626" : "#CBD5E1";
      dot(cfc, 6, 4, 8, 8, shadeCol);
      dot(cfc, 8, 2, 4, 10, petalCol);
      dot(cfc, 4, 6, 12, 4, petalCol);
      dot(cfc, 8, 6, 4, 4, "#FACC15");
      this.spritePropCache.set(`flower_${kind}`, cfCan);
    });

    // 5. 【華藍海岬專屬 GBA 像素物件】珊瑚暗礁 (reef_pixel 64x64)、像素海星 (starfish_pixel 20x20)、像素扇貝 (shell_pixel 20x20)
    const canReef = document.createElement("canvas");
    canReef.width = 64; canReef.height = 64;
    const crf = canReef.getContext("2d");
    // 礁石底部拍岸白沫圈
    fillPixelBlob(crf, 32, 38, 27, 18, "rgba(224, 242, 254, 0.75)");
    fillPixelBlob(crf, 32, 36, 24, 16, "#0F172A");
    fillPixelBlob(crf, 32, 34, 22, 15, "#334155");
    fillPixelBlob(crf, 28, 28, 16, 12, "#475569");
    fillPixelBlob(crf, 24, 24, 9, 7, "#94A3B8");
    // 礁石頂部像素紅珊瑚簇
    dot(crf, 34, 18, 6, 10, "#BE123C");
    dot(crf, 30, 20, 14, 6, "#FB7185");
    dot(crf, 36, 16, 4, 4, "#FDA4AF");
    this.spritePropCache.set("reef_pixel", canReef);

    const canStar = document.createElement("canvas");
    canStar.width = 20; canStar.height = 20;
    const cstr = canStar.getContext("2d");
    dot(cstr, 8, 2, 4, 14, "#BE123C");
    dot(cstr, 2, 6, 16, 4, "#BE123C");
    dot(cstr, 4, 12, 4, 6, "#BE123C");
    dot(cstr, 12, 12, 4, 6, "#BE123C");
    dot(cstr, 8, 4, 4, 10, "#FB7185");
    dot(cstr, 4, 6, 12, 4, "#FB7185");
    dot(cstr, 8, 8, 4, 4, "#FEF08A");
    this.spritePropCache.set("starfish_pixel", canStar);

    const canShell = document.createElement("canvas");
    canShell.width = 20; canShell.height = 20;
    const csh = canShell.getContext("2d");
    fillPixelBlob(csh, 10, 10, 7, 6, "#92400E");
    fillPixelBlob(csh, 10, 9, 6, 5, "#FDE68A");
    dot(csh, 8, 6, 2, 6, "#D97706");
    dot(csh, 12, 6, 2, 6, "#D97706");
    dot(csh, 6, 14, 8, 2, "#B45309");
    this.spritePropCache.set("shell_pixel", canShell);

    // 6. 【石英高原古神殿專屬 GBA 像素物件】翼神獸古代雕像 (statue_full + statue_top 64x80) ＆ 斷裂青苔古柱 (broken_pillar_pixel 64x80)
    const canStat = document.createElement("canvas");
    canStat.width = 64; canStat.height = 80;
    const csa = canStat.getContext("2d");

    const canStatTop = document.createElement("canvas");
    canStatTop.width = 64; canStatTop.height = 80;
    const cstTop = canStatTop.getContext("2d");

    // 雕像底層基座與金色銘文
    dot(csa, 6, 52, 52, 24, "rgba(15, 23, 42, 0.45)");
    dot(csa, 6, 46, 52, 28, "#0F172A");
    dot(csa, 8, 48, 48, 24, "#334155");
    dot(csa, 10, 50, 44, 6, "#64748B");
    dot(csa, 12, 58, 40, 12, "#475569");
    dot(csa, 16, 60, 32, 4, "#D97706");
    dot(csa, 20, 62, 24, 2, "#FEF08A");
    // 雕像立柱中段
    dot(csa, 14, 30, 36, 18, "#0F172A");
    dot(csa, 16, 32, 32, 16, "#475569");
    dot(csa, 20, 32, 6, 16, "#94A3B8");
    dot(csa, 38, 32, 6, 16, "#1E293B");

    const bakeStatueTop = (ctx) => {
      // 展開的像素雙翼與神獸冠冕頭雕
      dot(ctx, 4, 14, 16, 16, "#0F172A");
      dot(ctx, 44, 14, 16, 16, "#0F172A");
      dot(ctx, 6, 16, 14, 12, "#64748B");
      dot(ctx, 44, 16, 14, 12, "#475569");
      dot(ctx, 8, 16, 10, 4, "#CBD5E1");
      dot(ctx, 46, 16, 10, 4, "#94A3B8");
      // 中央神獸石首與三尖王冠
      fillPixelBlob(ctx, 32, 20, 14, 13, "#0F172A");
      fillPixelBlob(ctx, 32, 20, 12, 11, "#64748B");
      fillPixelBlob(ctx, 30, 17, 8, 6, "#94A3B8");
      dot(ctx, 24, 4, 4, 8, "#D97706");
      dot(ctx, 30, 2, 4, 10, "#FACC15");
      dot(ctx, 36, 4, 4, 8, "#D97706");
    };
    bakeStatueTop(csa);
    bakeStatueTop(cstTop);
    this.spritePropCache.set("statue_full", canStat);
    this.spritePropCache.set("statue_top", canStatTop);

    const canPil = document.createElement("canvas");
    canPil.width = 64; canPil.height = 80;
    const cpl = canPil.getContext("2d");
    dot(cpl, 6, 52, 52, 24, "rgba(15, 23, 42, 0.45)");
    dot(cpl, 8, 34, 48, 40, "#0F172A");
    dot(cpl, 10, 36, 44, 36, "#475569");
    // 羅馬柱縱向凹槽像素光影
    for (let px = 14; px <= 46; px += 8) {
      dot(cpl, px, 38, 4, 30, px <= 26 ? "#94A3B8" : "#334155");
    }
    // 頂部斜切崩裂斷面與紫晶青苔點綴
    dot(cpl, 10, 32, 28, 6, "#64748B");
    dot(cpl, 14, 28, 16, 6, "#94A3B8");
    dot(cpl, 36, 38, 14, 6, "#1E293B");
    dot(cpl, 12, 64, 14, 6, "#6B21A8");
    dot(cpl, 14, 62, 10, 4, "#A855F7");
    this.spritePropCache.set("broken_pillar_pixel", canPil);

    // 7. 【GPU 降溫關鍵優化】離線預烘焙 5 朵動態雲層柔邊陰影貼圖（徹底消除每幀 28 次 createRadialGradient 即時運算！）
    ["land", "bay"].forEach(mode => {
      const shadowColor = mode === "bay" ? "rgba(2, 28, 62, " : "rgba(8, 30, 14, ";
      this.clouds.forEach((c, idx) => {
        const pad = 210;
        const cw = pad * 2, ch = pad * 2;
        const canCloud = document.createElement("canvas");
        canCloud.width = cw; canCloud.height = ch;
        const cctx = canCloud.getContext("2d");
        c.puffs.forEach(p => {
          const px = pad + p.ox * c.scale * 2.0;
          const py = pad + p.oy * c.scale * 2.0;
          const pr = p.r * c.scale * 2.5;
          const grad = cctx.createRadialGradient(px, py, pr * 0.15, px, py, pr);
          grad.addColorStop(0, `${shadowColor}0.30)`);
          grad.addColorStop(0.5, `${shadowColor}0.16)`);
          grad.addColorStop(1, `${shadowColor}0)`);
          cctx.fillStyle = grad;
          cctx.beginPath();
          cctx.arc(px, py, pr, 0, Math.PI * 2);
          cctx.fill();
        });
        this.spritePropCache.set(`cloud_shadow_${mode}_${idx}`, canCloud);
      });
    });

    // 8. 【友好商店 GBA 像素預烘焙建築 (poke_mart_pixel 76x74)】火紅／葉綠藍頂白牆像素造型
    const mw = 76, mh = 74;
    const canMart = document.createElement("canvas");
    canMart.width = mw; canMart.height = mh;
    const cm = canMart.getContext("2d");

    // 地面像素橢圓投影
    fillPixelBlob(cm, 38, 62, 32, 9, "rgba(15, 23, 42, 0.42)");
    // 建築物深色像素外廓與石磚基座
    dot(cm, 8, 30, 60, 34, "#0F172A");
    dot(cm, 10, 58, 56, 4, "#64748B");
    dot(cm, 10, 60, 56, 2, "#475569");
    // 米白像素外牆與橫向牆面紋理
    dot(cm, 10, 32, 56, 26, "#F8FAFC");
    dot(cm, 10, 38, 56, 2, "#E2E8F0");
    dot(cm, 10, 44, 56, 2, "#E2E8F0");
    // 屋簷投影陰影條
    dot(cm, 10, 32, 56, 4, "#CBD5E1");

    // 左側透明玻璃櫥窗（內含紅白精靈球與藥水貨架像素）
    dot(cm, 14, 38, 22, 16, "#0F172A");
    dot(cm, 16, 40, 18, 12, "#0284C7");
    dot(cm, 16, 40, 18, 6, "#38BDF8");
    // 櫥窗斜向反光與貨架彩色瓶罐
    dot(cm, 18, 40, 4, 4, "#E0F2FE");
    dot(cm, 22, 42, 2, 4, "#BAE6FD");
    dot(cm, 18, 48, 4, 4, "#EF4444"); // 傷藥/精靈球紅
    dot(cm, 24, 48, 4, 4, "#FACC15"); // 道具黃
    dot(cm, 30, 48, 2, 4, "#4ADE80"); // 藥水綠

    // 右側自動感應玻璃大門（雙扇藍白玻璃門＋門框）
    dot(cm, 42, 38, 20, 22, "#0F172A");
    dot(cm, 44, 40, 16, 20, "#0369A1");
    dot(cm, 46, 42, 5, 16, "#7DD3FC");
    dot(cm, 53, 42, 5, 16, "#38BDF8");
    dot(cm, 46, 42, 2, 6, "#FFFFFF");
    dot(cm, 53, 42, 2, 6, "#E0F2FE");
    dot(cm, 51, 40, 2, 20, "#0F172A"); // 中央門縫

    // GBA 經典寶藍階梯斜屋頂（深藍描邊 ＋ 藍瓦層次 ＋ 受光亮藍瓦脊）
    for (let ry = 10; ry <= 32; ry += P) {
      const prog = (ry - 10) / 22;
      const halfSpan = Math.round((20 + prog * 16) / P) * P;
      dot(cm, 38 - halfSpan - 2, ry, halfSpan * 2 + 4, P, "#0F172A");
      dot(cm, 38 - halfSpan, ry, halfSpan * 2, P, (ry % 6 === 0) ? "#0369A1" : "#0284C7");
      if (ry % 6 === 2) {
        dot(cm, 38 - halfSpan + 4, ry, halfSpan * 2 - 8, P, "#38BDF8");
      }
    }
    // 屋頂頂部亮青高光脊與深藍屋簷底邊
    dot(cm, 20, 10, 36, 4, "#7DD3FC");
    dot(cm, 4, 30, 68, 4, "#075985");

    // 屋頂中央經典【MART】藍底白邊像素招牌
    dot(cm, 20, 14, 36, 14, "#0F172A");
    dot(cm, 22, 16, 32, 10, "#1D4ED8");
    dot(cm, 22, 16, 32, 2, "#93C5FD");
    // 像素字樣 "MART" (極簡 2px 點陣筆畫)
    // M
    dot(cm, 24, 18, 2, 6, "#FFFFFF"); dot(cm, 26, 20, 2, 2, "#FFFFFF"); dot(cm, 28, 18, 2, 6, "#FFFFFF");
    // A
    dot(cm, 32, 18, 6, 2, "#FFFFFF"); dot(cm, 32, 20, 2, 4, "#FFFFFF"); dot(cm, 36, 20, 2, 4, "#FFFFFF"); dot(cm, 34, 22, 2, 2, "#FFFFFF");
    // R
    dot(cm, 40, 18, 4, 2, "#FFFFFF"); dot(cm, 40, 20, 2, 4, "#FFFFFF"); dot(cm, 44, 20, 2, 2, "#FFFFFF"); dot(cm, 44, 22, 2, 2, "#FFFFFF");
    // T
    dot(cm, 48, 18, 6, 2, "#FFFFFF"); dot(cm, 50, 20, 2, 4, "#FFFFFF");

    this.spritePropCache.set("poke_mart_pixel", canMart);
  },

  renderStagePreviewCanvas(canvas, stageId) {
    if (!canvas) return;
    if (!this.tileCache || this.tileCache.size === 0) {
      this.prebakeTileTextures();
      this.prebakePixelProps();
    }
    const w = canvas.width = 240;
    const h = canvas.height = 116;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;

    if (stageId === "pallet") {
      // 1. GBA 草地底紋
      for (let tx = 0; tx < w; tx += 60) {
        for (let ty = 0; ty < h; ty += 60) {
          const isDark = (((tx / 60) + (ty / 60)) & 1) === 0;
          const tCan = this.tileCache.get(`pallet_${isDark ? 'dark' : 'light'}`);
          if (tCan) ctx.drawImage(tCan, tx, ty);
          else { ctx.fillStyle = isDark ? "#46783E" : "#4E8245"; ctx.fillRect(tx, ty, 60, 60); }
        }
      }
      // 2. 鵝卵石泥土大道
      ctx.fillStyle = "#C29B61";
      ctx.fillRect(0, 62, w, 30);
      ctx.fillStyle = "#D6B278";
      ctx.fillRect(0, 67, w, 20);
      for (let wx = 0; wx < w; wx += 14) {
        ctx.fillStyle = "#3B6634";
        ctx.fillRect(wx, 62, 8, 3);
        ctx.fillRect(wx + 4, 89, 8, 3);
        ctx.fillStyle = "#A8824C";
        ctx.fillRect(wx + 3, 72 + (wx % 7), 5, 3);
      }
      // 3. 高草叢
      ctx.fillStyle = "#14381F";
      ctx.fillRect(10, 14, 68, 42);
      ctx.fillStyle = "#1B3B22";
      ctx.fillRect(12, 16, 64, 38);
      for (let gx = 20; gx < 70; gx += 16) {
        for (let gy = 26; gy < 52; gy += 14) {
          ctx.fillStyle = "#2E8540";
          ctx.fillRect(gx - 4, gy - 6, 3, 6);
          ctx.fillRect(gx, gy - 8, 3, 8);
          ctx.fillRect(gx + 4, gy - 6, 3, 6);
          ctx.fillStyle = "#74E068";
          ctx.fillRect(gx, gy - 9, 3, 2);
        }
      }
      // 4. 單向跳崖與黃色箭頭
      ctx.fillStyle = "#3E1F0D";
      ctx.fillRect(12, 95, 118, 16);
      ctx.fillStyle = "#7C3F1D";
      ctx.fillRect(14, 99, 114, 10);
      ctx.fillStyle = "#68A357";
      ctx.fillRect(14, 95, 114, 4);
      [34, 70, 106].forEach(ax => {
        ctx.fillStyle = "#FEF08A";
        ctx.fillRect(ax - 4, 101, 8, 2);
        ctx.fillRect(ax - 2, 103, 4, 2);
        ctx.fillRect(ax - 1, 105, 2, 2);
      });
      // 5. 紅頂木屋、常磐大樹、紅白小花與斷木樁
      const house = this.spritePropCache.get("house_full");
      const tree = this.spritePropCache.get("oak_tree_full");
      const fRed = this.spritePropCache.get("flower_red");
      const fWhite = this.spritePropCache.get("flower_white");
      const sign = this.spritePropCache.get("crooked_sign_pixel");
      if (house) ctx.drawImage(house, 134, 4, 72, 65);
      if (tree) {
        ctx.drawImage(tree, 82, 4, 52, 55);
        ctx.drawImage(tree, 188, 52, 52, 55);
      }
      if (sign) ctx.drawImage(sign, 116, 48, 20, 20);
      if (fRed) { ctx.drawImage(fRed, 86, 66, 14, 14); ctx.drawImage(fRed, 152, 92, 14, 14); }
      if (fWhite) { ctx.drawImage(fWhite, 22, 64, 14, 14); ctx.drawImage(fWhite, 170, 96, 14, 14); }
    } else if (stageId === "cerulean_bay") {
      // 1. 碧藍深海與階梯狀像素海浪
      ctx.fillStyle = "#0284C7";
      ctx.fillRect(0, 0, w, h);
      for (let gy = 14; gy < h; gy += 24) {
        for (let gx = (gy % 48 === 14 ? 14 : 36); gx < w; gx += 46) {
          ctx.fillStyle = "rgba(7, 89, 133, 0.72)";
          ctx.fillRect(gx - 10, gy + 2, 20, 3);
          ctx.fillStyle = "rgba(224, 242, 254, 0.80)";
          ctx.fillRect(gx - 8, gy, 16, 2);
          ctx.fillRect(gx - 4, gy - 2, 8, 2);
        }
      }
      // 2. 黃金避難沙洲與拍岸白沫
      ctx.fillStyle = "rgba(224, 242, 254, 0.72)";
      ctx.fillRect(138, 12, 88, 66);
      ctx.fillStyle = "#B48A3E";
      ctx.fillRect(142, 16, 80, 58);
      ctx.fillStyle = "#F5D77F";
      ctx.fillRect(148, 22, 68, 46);
      // 3. 十字像素木棧道與鉚釘
      ctx.fillStyle = "rgba(3, 40, 75, 0.50)";
      ctx.fillRect(62, 0, 44, h);
      ctx.fillRect(0, 68, w, 34);
      ctx.fillStyle = "#85522D";
      ctx.fillRect(58, 0, 42, h);
      ctx.fillRect(0, 64, w, 32);
      ctx.fillStyle = "#9A6238";
      ctx.fillRect(64, 0, 30, h);
      ctx.fillRect(0, 70, w, 20);
      for (let py = 12; py < h; py += 16) {
        ctx.fillStyle = "#4A2A12"; ctx.fillRect(58, py, 42, 2);
        ctx.fillStyle = "#1E293B"; ctx.fillRect(61, py + 4, 3, 3); ctx.fillRect(94, py + 4, 3, 3);
      }
      for (let px = 12; px < w; px += 18) {
        if (px > 54 && px < 102) continue;
        ctx.fillStyle = "#4A2A12"; ctx.fillRect(px, 64, 2, 32);
        ctx.fillStyle = "#1E293B"; ctx.fillRect(px + 4, 67, 3, 3); ctx.fillRect(px + 4, 90, 3, 3);
      }
      // 4. 珊瑚暗礁、海星與扇貝
      const reef = this.spritePropCache.get("reef_pixel");
      const star = this.spritePropCache.get("starfish_pixel");
      const shell = this.spritePropCache.get("shell_pixel");
      if (reef) ctx.drawImage(reef, 160, 16, 48, 48);
      if (star) { ctx.drawImage(star, 148, 48, 16, 16); ctx.drawImage(star, 20, 22, 16, 16); }
      if (shell) { ctx.drawImage(shell, 198, 48, 15, 15); ctx.drawImage(shell, 114, 96, 15, 15); }
    } else {
      // 1. 石英高原古神殿紫黑石磚
      for (let tx = 0; tx < w; tx += 60) {
        for (let ty = 0; ty < h; ty += 60) {
          const isDark = (((tx / 60) + (ty / 60)) & 1) === 0;
          const tCan = this.tileCache.get(`sky_pillar_${isDark ? 'dark' : 'light'}`);
          if (tCan) ctx.drawImage(tCan, tx, ty);
          else { ctx.fillStyle = isDark ? "#251E38" : "#2B243D"; ctx.fillRect(tx, ty, 60, 60); }
        }
      }
      // 2. 中央金邊大理石大道
      ctx.fillStyle = "#1E1B4B"; ctx.fillRect(68, 0, 104, h);
      ctx.fillStyle = "#E2E8F0"; ctx.fillRect(70, 0, 100, h);
      ctx.fillStyle = "#F8FAFC"; ctx.fillRect(80, 0, 80, h);
      ctx.fillStyle = "#B45309"; ctx.fillRect(70, 0, 8, h); ctx.fillRect(162, 0, 8, h);
      ctx.fillStyle = "#FACC15"; ctx.fillRect(72, 0, 4, h); ctx.fillRect(164, 0, 4, h);
      for (let wy = 10; wy < h; wy += 24) {
        ctx.fillStyle = "#CBD5E1"; ctx.fillRect(78, wy, 84, 2);
        ctx.fillStyle = "#EF4444"; ctx.fillRect(72, wy + 8, 4, 4); ctx.fillRect(164, wy + 8, 4, 4);
      }
      // 3. 3D 透視五芒星超能重力陣
      ctx.save();
      const cx = 120, cy = 62;
      const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, 42);
      g.addColorStop(0, "rgba(217, 70, 239, 0.58)");
      g.addColorStop(0.6, "rgba(147, 51, 234, 0.28)");
      g.addColorStop(1, "rgba(15, 23, 42, 0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(cx, cy, 42, 22, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#F472B6"; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.ellipse(cx, cy, 34, 17, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = "#FDE047"; ctx.lineWidth = 1.6;
      const pts = [];
      for (let k = 0; k < 5; k++) {
        const a = -Math.PI / 2 + (k * Math.PI * 2) / 5;
        pts.push({ x: cx + Math.cos(a) * 26, y: cy + Math.sin(a) * 13 });
      }
      ctx.beginPath();
      let idx = 0; ctx.moveTo(pts[0].x, pts[0].y);
      for (let s = 0; s < 5; s++) { idx = (idx + 2) % 5; ctx.lineTo(pts[idx].x, pts[idx].y); }
      ctx.closePath(); ctx.stroke();
      ctx.restore();
      // 4. 翼神獸雕像與斷裂古柱
      const stat = this.spritePropCache.get("statue_full");
      const pil = this.spritePropCache.get("broken_pillar_pixel");
      if (stat) {
        ctx.drawImage(stat, 12, 16, 48, 60);
        ctx.fillStyle = "#FACC15";
        ctx.fillRect(28, 26, 3, 3); ctx.fillRect(36, 26, 3, 3);
      }
      if (pil) ctx.drawImage(pil, 180, 18, 48, 60);
    }
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

        // 防堵路保護：避開中央十字主幹道 (x/y: 225~365) 與跳崖缺口，改佈置於四個安全象限內
        const leftHalf = pseudoRand(8) < 0.5;
        const topHalf = pseudoRand(9) < 0.5;
        const ox = baseX + (leftHalf ? (65 + Math.floor(pseudoRand(10) * (170 - ow))) : (370 + Math.floor(pseudoRand(10) * (165 - ow))));
        const oy = baseY + (topHalf ? (65 + Math.floor(pseudoRand(11) * (165 - oh))) : (375 + Math.floor(pseudoRand(11) * (155 - oh))));

        chunk.obstacles.push({ x: ox, y: oy, w: ow, h: oh, kind });
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
    if (this.isArenaMode) {
      return { speedMult: 1.0, label: "⚔️ 石英大會競技場", inWater: false };
    }
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
    if (this.isArenaMode) {
      const r = radius || 18;
      const minX = -this.arenaHalfW + r;
      const maxX =  this.arenaHalfW - r;
      const minY = -this.arenaHalfH + r;
      const maxY =  this.arenaHalfH - r;
      if (ent.x < minX) ent.x = minX;
      if (ent.x > maxX) ent.x = maxX;
      if (ent.y < minY) ent.y = minY;
      if (ent.y > maxY) ent.y = maxY;
      // 四角石柱掩體碰撞
      for (const pl of this.arenaPillars) {
        const nearX = Math.max(pl.x, Math.min(ent.x, pl.x + pl.w));
        const nearY = Math.max(pl.y, Math.min(ent.y, pl.y + pl.h));
        const dx = ent.x - nearX;
        const dy = ent.y - nearY;
        const dSq = dx * dx + dy * dy;
        if (dSq < r * r) {
          const d = Math.sqrt(dSq) || 0.001;
          const push = r - d;
          ent.x += (dx / d) * push;
          ent.y += (dy / d) * push;
        }
      }
      return;
    }
    const cx = Math.floor(ent.x / 600);
    const cy = Math.floor(ent.y / 600);

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const chunk = this.getBiomeChunk(cx + dx, cy + dy);

        for (const ob of chunk.obstacles) {
          if (ob.kind === "fallen_log") {
            if (!isPlayer) continue;
            // 橫木雙向可輕跳跨越（無論向上或向下逃命皆不卡住玩家）
            if (Math.abs(ent.vy) > 1 && ent.y >= ob.y - 16 && ent.y <= ob.y + ob.h + 12 && ent.x >= ob.x - 10 && ent.x <= ob.x + ob.w + 10) {
              if (!ent.isJumpingLedge) {
                ent.isJumpingLedge = true;
                ent.jumpTimer = 0;
              }
              continue;
            }
          }
          if (ent.isJumpingLedge && ob.kind === "fallen_log") continue;

          // 2.5D 腳底縮框：大樹、木屋、神殿雕像、石柱與礁石只針對下半部底座做碰撞，北側繞行滑順不卡頭
          let bx1 = ob.x, bx2 = ob.x + ob.w, by1 = ob.y, by2 = ob.y + ob.h;
          if (ob.kind === "oak_tree" || ob.kind === "house" || ob.kind === "statue" || ob.kind === "broken_pillar") {
            bx1 = ob.x + 8;
            bx2 = ob.x + ob.w - 8;
            by1 = ob.y + ob.h * 0.54;
            by2 = ob.y + ob.h - 4;
          } else if (ob.kind === "reef" || ob.kind === "tree_stump") {
            bx1 = ob.x + 6;
            bx2 = ob.x + ob.w - 6;
            by1 = ob.y + ob.h * 0.42;
            by2 = ob.y + ob.h - 4;
          }

          const nearX = Math.max(bx1, Math.min(ent.x, bx2));
          const nearY = Math.max(by1, Math.min(ent.y, by2));
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
    this.cloudTime = (this.cloudTime || 0) + dt;

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
    } else {
      this.lightningFlashAlpha = 0;
    }

    for (let i = this.splashParticles.length - 1; i >= 0; i--) {
      const sp = this.splashParticles[i];
      sp.r += dt * 25;
      sp.life -= dt;
      if (sp.life <= 0) this.splashParticles.splice(i, 1);
    }
  },

  renderBiomeWorld(ctx, camX, camY, width, height) {
    // 防黑屏核心保護：每幀渲染地表前強制歸位 Canvas 狀態、混合模式與座標有效性
    ctx.save();
    ctx.globalAlpha = 1.0;
    ctx.globalCompositeOperation = "source-over";
    ctx.filter = "none";

    if (!Number.isFinite(camX)) camX = 0;
    if (!Number.isFinite(camY)) camY = 0;

    if (!this.tileCache || this.tileCache.size === 0) {
      this.prebakeTileTextures();
      this.prebakePixelProps();
    }

    if (this.isArenaMode) {
      this.renderIndigoArena(ctx, camX, camY, width, height);
      ctx.restore();
      return;
    }
    const stage = this.currentStage || STAGES[0];

    if (stage.id === "cerulean_bay") {
      ctx.fillStyle = stage.waterColor || "#0284C7";
      ctx.fillRect(0, 0, width, height);
    } else {
      ctx.fillStyle = stage.tileLight || "#4E8245";
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
          // GBA 紅寶石/藍寶石版階梯狀像素海浪與白沫波峰
          const stepX = 56, stepY = 40;
          const swx = chunk.baseX - camX + width / 2;
          const swy = chunk.baseY - camY + height / 2;

          for (let gy = 16; gy < chunk.size - 10; gy += stepY) {
            const rowIndex = Math.floor(gy / stepY);
            const xOffset = (rowIndex % 2 === 0) ? 0 : stepX * 0.5;
            for (let gx = 16; gx < chunk.size - 10; gx += stepX) {
              const waveSeed = (chunk.cx * 11 + chunk.cy * 17 + rowIndex * 7 + (gx / stepX)) * 0.8;
              const waveCycle = Math.sin(now * 1.5 + waveSeed);
              const wx = Math.round(swx + gx + xOffset + Math.cos(now * 1.1 + waveSeed) * 3.5);
              const wy = Math.round(swy + gy + Math.sin(now * 1.3 + waveSeed) * 1.8);

              // 深海浪谷像素底影
              ctx.fillStyle = "rgba(7, 89, 133, 0.72)";
              ctx.fillRect(wx - 12, wy + 2, 24, 3);
              ctx.fillRect(wx - 8, wy, 16, 2);

              // 階梯狀像素亮白浪尖
              const crestAlpha = 0.50 + waveCycle * 0.35;
              ctx.fillStyle = `rgba(224, 242, 254, ${crestAlpha})`;
              ctx.fillRect(wx - 10, wy, 20, 2);
              ctx.fillRect(wx - 6, wy - 2, 12, 2);
            }
          }
        }

        chunk.sandIslets.forEach(isl => {
          const ix = Math.round(isl.x - camX + width / 2);
          const iy = Math.round(isl.y - camY + height / 2);
          if (ix + isl.w < -24 || ix > width + 24 || iy + isl.h < -24 || iy > height + 24) return;
          // 像素拍岸淺灘水環 + 濕沙外框 + 暖金沙洲
          const wavePhase = (now * 1.6 + isl.x * 0.02) % Math.PI;
          const waveExpand = Math.round(Math.sin(wavePhase) * 5);
          ctx.fillStyle = `rgba(224, 242, 254, ${0.35 + Math.sin(wavePhase) * 0.45})`;
          ctx.fillRect(ix - 12 - waveExpand, iy - 12 - waveExpand, isl.w + 24 + waveExpand * 2, isl.h + 24 + waveExpand * 2);

          ctx.fillStyle = "#B48A3E";
          ctx.fillRect(ix - 10, iy - 10, isl.w + 20, isl.h + 20);
          ctx.fillStyle = "#E0C068";
          ctx.fillRect(ix - 6, iy - 6, isl.w + 12, isl.h + 12);
          ctx.fillStyle = "#F5D77F";
          ctx.fillRect(ix, iy, isl.w, isl.h);

          // 沙灘世界座標固定貝殼砂礫點綴
          for (let ox = 16; ox < isl.w - 16; ox += 28) {
            for (let oy = 16; oy < isl.h - 16; oy += 28) {
              ctx.fillStyle = "#D4AF53";
              ctx.fillRect(ix + ox, iy + oy, 4, 3);
              ctx.fillStyle = "#FFFBEB";
              ctx.fillRect(ix + ox + 8, iy + oy + 6, 3, 2);
            }
          }
        });

        (chunk.roads || []).concat(chunk.piers || []).forEach(r => {
          const rx = Math.round(r.x - camX + width / 2);
          const ry = Math.round(r.y - camY + height / 2);
          if (rx + r.w < -20 || rx > width + 20 || ry + r.h < -20 || ry > height + 20) return;

          if (r.isMarble) {
            // GBA 石英高原像素大理石金邊大道（綁定世界座標石板接縫與金磚雕花）
            ctx.fillStyle = "#1E1B4B";
            ctx.fillRect(rx - 2, ry, r.w + 4, r.h);
            ctx.fillStyle = "#E2E8F0";
            ctx.fillRect(rx, ry, r.w, r.h);
            ctx.fillStyle = "#F8FAFC";
            ctx.fillRect(rx + 14, ry, r.w - 28, r.h);

            // 左右兩側雙層黃金蓮花磚邊
            ctx.fillStyle = "#B45309";
            ctx.fillRect(rx, ry, 10, r.h);
            ctx.fillRect(rx + r.w - 10, ry, 10, r.h);
            ctx.fillStyle = "#FACC15";
            ctx.fillRect(rx + 2, ry, 6, r.h);
            ctx.fillRect(rx + r.w - 8, ry, 6, r.h);

            for (let wy = r.y; wy < r.y + r.h; wy += 30) {
              const sy = Math.round(wy - camY + height / 2);
              ctx.fillStyle = "#CBD5E1";
              ctx.fillRect(rx + 10, sy, r.w - 20, 2);
              ctx.fillStyle = "#94A3B8";
              ctx.fillRect(rx + Math.floor(r.w * 0.5), sy, 2, 30);
              // 金邊上的紅寶石像素嵌飾
              ctx.fillStyle = "#EF4444";
              ctx.fillRect(rx + 3, sy + 12, 4, 4);
              ctx.fillRect(rx + r.w - 7, sy + 12, 4, 4);
            }
          } else if (stage.id === "cerulean_bay") {
            // GBA 華藍海岬像素木棧道（水下立體木樁 + 像素木板紋 + 金屬鉚釘）
            ctx.fillStyle = "rgba(3, 40, 75, 0.52)";
            ctx.fillRect(rx + 6, ry + 8, r.w, r.h);

            ctx.fillStyle = "#3E1F0D";
            if (r.dir === "V") {
              ctx.fillRect(rx + r.w, ry, 8, r.h);
              ctx.fillRect(rx - 3, ry, 3, r.h);
            } else {
              ctx.fillRect(rx, ry + r.h, r.w, 8);
              ctx.fillRect(rx, ry - 3, r.w, 3);
            }

            ctx.fillStyle = stage.roadColor;
            ctx.fillRect(rx, ry, r.w, r.h);
            ctx.fillStyle = "#9A6238";
            if (r.dir === "V") ctx.fillRect(rx + 8, ry, r.w - 16, r.h);
            else ctx.fillRect(rx, ry + 8, r.w, r.h - 16);

            if (r.dir === "V") {
              for (let wy = r.y; wy < r.y + r.h; wy += 20) {
                const sy = Math.round(wy - camY + height / 2);
                ctx.fillStyle = "#4A2A12";
                ctx.fillRect(rx, sy, r.w, 2);
                ctx.fillStyle = "#B07548";
                ctx.fillRect(rx + 4, sy + 2, r.w - 8, 2);
                ctx.fillStyle = "#1E293B";
                ctx.fillRect(rx + 5, sy + 5, 3, 3);
                ctx.fillRect(rx + r.w - 8, sy + 5, 3, 3);
              }
            } else {
              for (let wx = r.x; wx < r.x + r.w; wx += 20) {
                const sx = Math.round(wx - camX + width / 2);
                ctx.fillStyle = "#4A2A12";
                ctx.fillRect(sx, ry, 2, r.h);
                ctx.fillStyle = "#B07548";
                ctx.fillRect(sx + 2, ry + 4, 2, r.h - 8);
                ctx.fillStyle = "#1E293B";
                ctx.fillRect(sx + 5, ry + 5, 3, 3);
                ctx.fillRect(sx + 5, ry + r.h - 8, 3, 3);
              }
            }
          } else {
            // GBA 1號道路鵝卵石自然咬合泥土路（100% 綁定世界座標 wx / wy，走路時石頭與草邊絕對穩固不蠕動！）
            ctx.fillStyle = "#C29B61";
            ctx.fillRect(rx, ry, r.w, r.h);
            ctx.fillStyle = "#D6B278";
            if (r.dir === "H") {
              ctx.fillRect(rx, ry + 8, r.w, r.h - 16);
              for (let wx = r.x; wx < r.x + r.w; wx += 12) {
                const sx = Math.round(wx - camX + width / 2);
                const h1 = Math.abs((wx * 7) + r.y * 3) % 30;
                const h2 = Math.abs((wx * 13) + r.y * 5) % 24;
                ctx.fillStyle = "#3B6634";
                ctx.fillRect(sx, ry, 8, 4);
                ctx.fillRect(sx + 4, ry + r.h - 4, 8, 4);
                ctx.fillStyle = "#8C673A";
                ctx.fillRect(sx, ry + 4, 8, 3);
                ctx.fillRect(sx + 4, ry + r.h - 7, 8, 3);
                ctx.fillStyle = "#A8824C";
                ctx.fillRect(sx + 2, ry + 16 + h1, 6, 4);
                ctx.fillStyle = "#EAD09E";
                ctx.fillRect(sx + 6, ry + 22 + h2, 4, 3);
              }
            } else {
              ctx.fillRect(rx + 8, ry, r.w - 16, r.h);
              for (let wy = r.y; wy < r.y + r.h; wy += 12) {
                const sy = Math.round(wy - camY + height / 2);
                const h1 = Math.abs((wy * 7) + r.x * 3) % 30;
                const h2 = Math.abs((wy * 13) + r.x * 5) % 24;
                ctx.fillStyle = "#3B6634";
                ctx.fillRect(rx, sy, 4, 8);
                ctx.fillRect(rx + r.w - 4, sy + 4, 4, 8);
                ctx.fillStyle = "#8C673A";
                ctx.fillRect(rx + 4, sy, 3, 8);
                ctx.fillRect(rx + r.w - 7, sy + 4, 3, 8);
                ctx.fillStyle = "#A8824C";
                ctx.fillRect(rx + 16 + h1, sy + 2, 4, 6);
                ctx.fillStyle = "#EAD09E";
                ctx.fillRect(rx + 22 + h2, sy + 6, 3, 4);
              }
            }
          }
        });

        chunk.grassTiles.forEach(g => {
          const gx = Math.round(g.x - camX + width / 2);
          const gy = Math.round(g.y - camY + height / 2);
          if (gx + g.w < -30 || gx > width + 30 || gy + g.h < -30 || gy > height + 160) return;

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
            // GBA 經典深綠茂密野生高草叢（相位綁定世界座標 wpx / wpy，搖曳自然不閃動）
            ctx.fillStyle = "#14381F";
            ctx.fillRect(gx - 2, gy - 2, g.w + 4, g.h + 4);
            ctx.fillStyle = stage.slowZoneColor;
            ctx.fillRect(gx, gy, g.w, g.h);

            for (let wpx = g.x + 10; wpx < g.x + g.w - 8; wpx += 18) {
              for (let wpy = g.y + 12; wpy < g.y + g.h - 6; wpy += 18) {
                const px = Math.round(wpx - camX + width / 2);
                const py = Math.round(wpy - camY + height / 2);
                const sway = Math.round(Math.sin(now * 1.8 + wpx * 0.05 + wpy * 0.05) * 2.0);
                ctx.fillStyle = "#0F2917";
                ctx.fillRect(px - 5, py - 2, 10, 4);
                ctx.fillStyle = "#2E8540";
                ctx.fillRect(px - 6 + sway, py - 7, 3, 6);
                ctx.fillRect(px - 1 + sway, py - 9, 3, 8);
                ctx.fillRect(px + 4 + sway, py - 7, 3, 6);
                ctx.fillStyle = "#74E068";
                ctx.fillRect(px - 6 + sway, py - 8, 3, 2);
                ctx.fillRect(px - 1 + sway, py - 10, 3, 2);
                ctx.fillRect(px + 4 + sway, py - 8, 3, 2);
              }
            }
          }
        });

        chunk.ledges.forEach(l => {
          const lx = Math.round(l.x - camX + width / 2);
          const ly = Math.round(l.y - camY + height / 2);
          ctx.fillStyle = "rgba(15, 23, 42, 0.38)";
          ctx.fillRect(lx + 2, ly + l.h, l.w - 4, 6);

          ctx.fillStyle = "#3E1F0D";
          ctx.fillRect(lx - 2, ly - 2, l.w + 4, l.h + 4);

          ctx.fillStyle = "#7C3F1D";
          ctx.fillRect(lx, ly + 4, l.w, l.h - 4);

          for (let rx = lx + 6; rx < lx + l.w - 6; rx += 14) {
            ctx.fillStyle = "#5C2E14";
            ctx.fillRect(rx, ly + 6, 4, l.h - 8);
            ctx.fillStyle = "#9A5226";
            ctx.fillRect(rx + 4, ly + 6, 4, l.h - 10);
          }

          ctx.fillStyle = "#68A357";
          ctx.fillRect(lx, ly - 2, l.w, 5);
          ctx.fillStyle = "#46783E";
          for (let gx = lx + 4; gx < lx + l.w - 4; gx += 10) {
            ctx.fillRect(gx, ly + 2, 6, 3);
          }

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
          const ox = Math.round(ob.x - camX + width / 2);
          const oy = Math.round(ob.y - camY + height / 2);
          if (ox + ob.w < -30 || ox > width + 30 || oy + ob.h < -30 || oy > height + 30) return;

          if (ob.kind === "house") {
            const hCan = this.spritePropCache.get("house_full");
            if (hCan) ctx.drawImage(hCan, ox - 4, oy - 4);
          } else if (ob.kind === "statue") {
            const sCan = this.spritePropCache.get("statue_full");
            if (sCan) ctx.drawImage(sCan, ox - 4, oy - 4);
            const eyeGlow = 0.80 + Math.sin(now * 2.4 + ob.x * 0.1) * 0.20;
            ctx.fillStyle = `rgba(250, 204, 21, ${eyeGlow})`;
            ctx.fillRect(ox + 21, oy + 14, 4, 4);
            ctx.fillRect(ox + 31, oy + 14, 4, 4);
          } else if (ob.kind === "broken_pillar") {
            const pCan = this.spritePropCache.get("broken_pillar_pixel");
            if (pCan) ctx.drawImage(pCan, ox - 4, oy - 4);
          } else if (ob.kind === "reef") {
            const rCan = this.spritePropCache.get("reef_pixel");
            if (rCan) ctx.drawImage(rCan, ox - 2, oy - 2);
          } else if (ob.kind === "fallen_log") {
            const lCan = this.spritePropCache.get("fallen_log_pixel");
            if (lCan) ctx.drawImage(lCan, ox - 2, oy - 2);
          } else if (ob.kind === "tree_stump") {
            const stCan = this.spritePropCache.get("tree_stump_pixel");
            if (stCan) ctx.drawImage(stCan, ox - 2, oy - 2);
          } else {
            const tCan = this.spritePropCache.get("oak_tree_full");
            if (tCan) ctx.drawImage(tCan, ox - 4, oy - 4);
          }
        });

        chunk.decorList.forEach(d => {
          const dx = Math.round(d.x - camX + width / 2);
          const dy = Math.round(d.y - camY + height / 2);
          ctx.save();
          ctx.translate(dx, dy);
          if (d.type === "starfish") {
            const sfCan = this.spritePropCache.get("starfish_pixel");
            if (sfCan) ctx.drawImage(sfCan, -10, -10);
          } else if (d.type === "shell") {
            const shCan = this.spritePropCache.get("shell_pixel");
            if (shCan) ctx.drawImage(shCan, -10, -10);
          } else if (d.type === "crooked_sign") {
            const sgCan = this.spritePropCache.get("crooked_sign_pixel");
            if (sgCan) ctx.drawImage(sgCan, -14, -14);
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
    const cloudMode = stage.id === "cerulean_bay" ? "bay" : "land";

    this.clouds.forEach((c, idx) => {
      const moveX = c.x + (this.cloudTime || 0) * c.speed - camX * plx;
      const moveY = c.y + (this.cloudTime || 0) * (c.speed * 0.3) - camY * plx;
      const sx = Math.round(((moveX % areaW) + areaW) % areaW - (areaW * 0.25));
      const sy = Math.round(((moveY % areaH) + areaH) % areaH - (areaH * 0.25));
      if (sx < -220 || sx > width + 220 || sy < -220 || sy > height + 220) return;
      const cCan = this.spritePropCache.get(`cloud_shadow_${cloudMode}_${idx}`);
      if (cCan) {
        ctx.drawImage(cCan, sx - 210, sy - 210);
      }
    });
    ctx.restore();
    ctx.restore();
  },

  // P1 新增：GBA 2.5D 樹冠、屋頂與古代神獸雕像前景遮擋層（角色走到後方時自動產生半透明景深遮罩）
  renderIndigoArena(ctx, camX, camY, width, height) {
    const toSx = (wx) => wx - camX + width / 2;
    const toSy = (wy) => wy - camY + height / 2;
    const hw = this.arenaHalfW;
    const hh = this.arenaHalfH;
    const x0 = toSx(-hw), y0 = toSy(-hh);
    const w = hw * 2, h = hh * 2;

    // 1. 場館外圍深色觀眾席背景
    ctx.fillStyle = "#0F172A";
    ctx.fillRect(0, 0, width, height);

    // 外圍石階框線
    ctx.fillStyle = "#1E293B";
    ctx.fillRect(x0 - 26, y0 - 26, w + 52, h + 52);
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 3;
    ctx.strokeRect(x0 - 26, y0 - 26, w + 52, h + 52);

    // 2. 競技場米灰石磚棋盤地板
    const tile = 40;
    for (let tx = -hw; tx < hw; tx += tile) {
      for (let ty = -hh; ty < hh; ty += tile) {
        const isEven = ((Math.floor(tx / tile) + Math.floor(ty / tile)) & 1) === 0;
        ctx.fillStyle = isEven ? "#CBD5E1" : "#B8C4D4";
        ctx.fillRect(toSx(tx), toSy(ty), tile + 0.5, tile + 0.5);
      }
    }

    // 3. 左藍右紅對戰場半場淡淡染色
    ctx.fillStyle = "rgba(56, 189, 248, 0.10)";
    ctx.fillRect(x0, y0, w / 2, h);
    ctx.fillStyle = "rgba(239, 68, 68, 0.10)";
    ctx.fillRect(x0 + w / 2, y0, w / 2, h);

    // 4. 經典石英大會場線 ＋ 中央精靈球圖騰
    const cx = toSx(0), cy = toSy(0);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
    ctx.lineWidth = 4;
    ctx.strokeRect(x0 + 18, y0 + 18, w - 36, h - 36);
    ctx.beginPath();
    ctx.moveTo(cx, y0 + 18);
    ctx.lineTo(cx, y0 + h - 18);
    ctx.stroke();

    // 中央精靈球圓環
    ctx.fillStyle = "rgba(239, 68, 68, 0.24)";
    ctx.beginPath();
    ctx.arc(cx, cy, 62, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.30)";
    ctx.beginPath();
    ctx.arc(cx, cy, 62, 0, Math.PI);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "rgba(255, 255, 255, 0.90)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, 62, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "#FFFFFF";
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 5. 競技場厚實石牆圍欄 ＋ 四角金火炬
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 10;
    ctx.strokeRect(x0 - 4, y0 - 4, w + 8, h + 8);
    ctx.strokeStyle = "#F59E0B";
    ctx.lineWidth = 2.5;
    ctx.strokeRect(x0, y0, w, h);

    const flamePulse = 1 + Math.sin(performance.now() * 0.012) * 0.2;
    [[-hw, -hh], [hw, -hh], [-hw, hh], [hw, hh]].forEach(([bx, by]) => {
      const fx = toSx(bx), fy = toSy(by);
      ctx.fillStyle = "#78350F";
      ctx.beginPath(); ctx.arc(fx, fy, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#F97316";
      ctx.beginPath(); ctx.arc(fx, fy, 7.5 * flamePulse, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#FEF08A";
      ctx.beginPath(); ctx.arc(fx, fy, 4 * flamePulse, 0, Math.PI * 2); ctx.fill();
    });

    // 6. 四角立體石柱掩體 (2.5D 陰影＋頂面高光)
    for (const pl of this.arenaPillars) {
      const px = toSx(pl.x), py = toSy(pl.y);
      ctx.fillStyle = "rgba(15, 23, 42, 0.35)";
      ctx.fillRect(px + 6, py + 8, pl.w, pl.h);
      ctx.fillStyle = "#475569";
      ctx.fillRect(px, py, pl.w, pl.h);
      ctx.fillStyle = "#64748B";
      ctx.fillRect(px + 3, py + 3, pl.w - 6, pl.h - 12);
      ctx.fillStyle = "#94A3B8";
      ctx.fillRect(px + 5, py + 5, pl.w - 10, 10);
      ctx.strokeStyle = "#1E293B";
      ctx.lineWidth = 2.5;
      ctx.strokeRect(px, py, pl.w, pl.h);
    }
  },

  renderForegroundCanopies(ctx, camX, camY, width, height, player, trainer) {
    if (this.isArenaMode) return;
    const startCx = Math.floor((camX - width / 2) / 600) - 1;
    const endCx = Math.floor((camX + width / 2) / 600) + 1;
    const startCy = Math.floor((camY - height / 2) / 600) - 1;
    const endCy = Math.floor((camY + height / 2) / 600) + 1;
    const now = performance.now() * 0.0016;

    const checkOccluded = (ent, ob) => {
      if (!ent) return false;
      const footY = ent.y + 18;
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
          const ox = Math.round(ob.x - camX + width / 2);
          const oy = Math.round(ob.y - camY + height / 2);
          if (ox + ob.w < -40 || ox > width + 40 || oy + ob.h < -40 || oy > height + 40) return;

          const playerBehind = checkOccluded(player, ob) || checkOccluded(trainer, ob);
          ctx.save();
          if (playerBehind) {
            ctx.globalAlpha = 0.52;
          }

          if (ob.kind === "house") {
            const rCan = this.spritePropCache.get("house_roof");
            if (rCan) ctx.drawImage(rCan, ox - 4, oy - 4);
          } else if (ob.kind === "statue") {
            const stTop = this.spritePropCache.get("statue_top");
            if (stTop) ctx.drawImage(stTop, ox - 4, oy - 4);
            const eyeGlow = 0.80 + Math.sin(now * 2.4 + ob.x * 0.1) * 0.20;
            ctx.fillStyle = `rgba(250, 204, 21, ${eyeGlow})`;
            ctx.fillRect(ox + 21, oy + 14, 4, 4);
            ctx.fillRect(ox + 31, oy + 14, 4, 4);
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
      ctx.strokeStyle = isThunder ? "rgba(224, 242, 254, 0.28)" : "rgba(186, 230, 253, 0.26)";
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
      // v7.1.3 中心全透明・邊緣寒霧漸層 (Vignette)，徹底保留中央戰場銳利度
      ctx.save();
      const maxDim = Math.max(width, height);
      const bGrad = ctx.createRadialGradient(width * 0.5, height * 0.5, maxDim * 0.28, width * 0.5, height * 0.5, maxDim * 0.72);
      bGrad.addColorStop(0, "rgba(186, 230, 253, 0.0)");
      bGrad.addColorStop(0.60, "rgba(186, 230, 253, 0.02)");
      bGrad.addColorStop(1, "rgba(186, 230, 253, 0.19)");
      ctx.fillStyle = bGrad;
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = "rgba(224, 242, 254, 0.55)";
      const t = performance.now() * 0.002;
      ctx.beginPath();
      for (let i = 0; i < 42; i++) {
        const sx = ((i * 53 + t * 45 + Math.sin(t * 1.5 + i) * 25) % width);
        const sy = ((i * 67 + t * 125) % height);
        const sz = (i % 3 === 0) ? 2.8 : (i % 2 === 0 ? 2.1 : 1.5);
        ctx.moveTo(sx + sz, sy);
        ctx.arc(sx, sy, sz, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.restore();

    } else if (this.weather === "HEATWAVE") {
      // v7.1.3 中心全透明・邊緣熱浪漸層 (Vignette)，保留中央技能色彩飽和度
      ctx.save();
      const maxDim = Math.max(width, height);
      const hGrad = ctx.createRadialGradient(width * 0.5, height * 0.5, maxDim * 0.28, width * 0.5, height * 0.5, maxDim * 0.72);
      hGrad.addColorStop(0, "rgba(249, 115, 22, 0.0)");
      hGrad.addColorStop(0.60, "rgba(249, 115, 22, 0.02)");
      hGrad.addColorStop(1, "rgba(249, 115, 22, 0.18)");
      ctx.fillStyle = hGrad;
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = "rgba(253, 224, 71, 0.38)";
      const t = performance.now() * 0.003;
      ctx.beginPath();
      for (let i = 0; i < 24; i++) {
        const hx = (i * 73 + Math.sin(t * 2.0 + i) * 18) % width;
        const hy = height - ((i * 37 + t * 90) % height);
        ctx.moveTo(hx + 2.0, hy);
        ctx.arc(hx, hy, 2.0, 0, Math.PI * 2);
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
