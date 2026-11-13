/**
 * ============================================================================
 * pokedex_data.js
 * 關都地區 151 全圖鑑、屬性相剋、超武突破配方、攜帶物戰術詞綴、
 * 怪獸體重擊退抗性階級、Boss 多重攻擊模式資料庫
 * ============================================================================
 */

// 1. 屬性視覺與異常狀態設定
const TYPE_COLORS = {
  Normal: "#94A3B8", Fire: "#EF4444", Water: "#38BDF8", Grass: "#22C55E",
  Electric: "#FACC15", Ice: "#67E8F9", Fighting: "#B91C1C", Poison: "#A855F7",
  Ground: "#D97706", Flying: "#818CF8", Psychic: "#EC4899", Bug: "#84CC16",
  Rock: "#78350F", Ghost: "#6B21A8", Dragon: "#4338CA", Steel: "#64748B"
};

const TYPE_NAMES_ZH = {
  Normal: "一般", Fire: "火", Water: "水", Grass: "草", Electric: "電",
  Ice: "冰", Fighting: "格鬥", Poison: "毒", Ground: "地面", Flying: "飛行",
  Psychic: "超能", Bug: "蟲", Rock: "岩石", Ghost: "幽靈", Dragon: "龍", Steel: "鋼"
};

const TYPE_META = {
  Fire: { color: "#EF4444", status: "Burn", statusRate: 0.28 },
  Water: { color: "#38BDF8", status: null, statusRate: 0 },
  Grass: { color: "#22C55E", status: null, statusRate: 0 },
  Electric: { color: "#FACC15", status: "Paralysis", statusRate: 0.24 },
  Ice: { color: "#67E8F9", status: "Freeze", statusRate: 0.22 },
  Poison: { color: "#A855F7", status: "Poison", statusRate: 0.35 },
  Psychic: { color: "#EC4899", status: "Confusion", statusRate: 0.20 },
  Ground: { color: "#D97706", status: null, statusRate: 0 },
  Fighting: { color: "#B91C1C", status: null, statusRate: 0 },
  Flying: { color: "#818CF8", status: null, statusRate: 0 },
  Bug: { color: "#84CC16", status: null, statusRate: 0 },
  Rock: { color: "#78350F", status: null, statusRate: 0 },
  Ghost: { color: "#6B21A8", status: "Confusion", statusRate: 0.20 },
  Dragon: { color: "#4338CA", status: null, statusRate: 0 },
  Normal: { color: "#94A3B8", status: null, statusRate: 0 }
};

// 屬性相剋倍率表 (攻方 -> 守方)
const TYPE_CHART = {
  Fire:     { Grass: 1.5, Ice: 1.5, Bug: 1.5, Steel: 1.5, Water: 0.65, Fire: 0.65, Rock: 0.65, Dragon: 0.65 },
  Water:    { Fire: 1.5, Ground: 1.5, Rock: 1.5, Water: 0.65, Grass: 0.65, Dragon: 0.65 },
  Grass:    { Water: 1.5, Ground: 1.5, Rock: 1.5, Fire: 0.65, Grass: 0.65, Poison: 0.65, Flying: 0.65, Bug: 0.65, Dragon: 0.65 },
  Electric: { Water: 1.5, Flying: 1.5, Electric: 0.65, Grass: 0.65, Dragon: 0.65, Ground: 0.1 },
  Ice:      { Grass: 1.5, Ground: 1.5, Flying: 1.5, Dragon: 1.5, Fire: 0.65, Water: 0.65, Ice: 0.65 },
  Fighting: { Normal: 1.5, Ice: 1.5, Rock: 1.5, Steel: 1.5, Poison: 0.65, Flying: 0.65, Psychic: 0.65, Bug: 0.65, Ghost: 0.1 },
  Poison:   { Grass: 1.5, Poison: 0.65, Ground: 0.65, Rock: 0.65, Ghost: 0.65, Steel: 0.1 },
  Ground:   { Fire: 1.5, Electric: 1.5, Poison: 1.5, Rock: 1.5, Steel: 1.5, Grass: 0.65, Bug: 0.65, Flying: 0.1 },
  Flying:   { Grass: 1.5, Fighting: 1.5, Bug: 1.5, Electric: 0.65, Rock: 0.65, Steel: 0.65 },
  Psychic:  { Fighting: 1.5, Poison: 1.5, Psychic: 0.65, Steel: 0.65 },
  Bug:      { Grass: 1.5, Psychic: 1.5, Fire: 0.65, Fighting: 0.65, Poison: 0.65, Flying: 0.65, Ghost: 0.65, Steel: 0.65 },
  Rock:     { Fire: 1.5, Ice: 1.5, Flying: 1.5, Bug: 1.5, Fighting: 0.65, Ground: 0.65, Steel: 0.65 },
  Ghost:    { Psychic: 1.5, Ghost: 1.5, Normal: 0.1 },
  Dragon:   { Dragon: 1.5, Steel: 0.65 },
  Normal:   { Rock: 0.65, Steel: 0.65, Ghost: 0.1 }
};

function calcTypeMultiplier(atkType, defType1, defType2) {
  let mult = 1.0;
  if (TYPE_CHART[atkType]) {
    if (TYPE_CHART[atkType][defType1] !== undefined) mult *= TYPE_CHART[atkType][defType1];
    if (defType2 && TYPE_CHART[atkType][defType2] !== undefined) mult *= TYPE_CHART[atkType][defType2];
  }
  return mult;
}

function checkStatusImmunity(target, status) {
  if (!status) return true;
  if (status === "Burn" && (target.data.type1 === "Fire" || target.data.type2 === "Fire")) return true;
  if (status === "Poison" && (target.data.type1 === "Poison" || target.data.type2 === "Poison" || target.data.type1 === "Steel" || target.data.type2 === "Steel")) return true;
  if (status === "Freeze" && (target.data.type1 === "Ice" || target.data.type2 === "Ice")) return true;
  if (status === "Paralysis" && (target.data.type1 === "Electric" || target.data.type2 === "Electric")) return true;
  return false;
}

function renderTypeBadgeHTML(type) {
  if (!type || type === "None") return "";
  const bg = TYPE_COLORS[type] || "#94A3B8";
  const zh = TYPE_NAMES_ZH[type] || type;
  return `<span style="background-color:${bg}" class="px-1 py-0.2 text-[8px] font-black text-white rounded shadow-sm whitespace-nowrap inline-block leading-tight mx-0.5">${zh}</span>`;
}

// 2. 招式資料庫 (已優化 iPhone 擊退抗性 knockback)
const SKILLS_CATALOG = {
      VineWhip: {
    id: "VineWhip", name: "藤鞭", type: "Grass", baseDmg: 28, baseCd: 0.75,
    knockback: 6, isMelee: true, meleeStyle: "vine_whip", reqItem: "miracle_seed",
    evolvedName: "瘋狂植物", color: "#15803D",
    sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/miracle-seed.png",
    desc: "甩動帶刺S型雙層藤蔓，兩側生出嫩芽，末端音爆鞭笞身前敵人！",
    evoDesc: "【終極超武】全場破土生長嗜血荊棘藤蔓，命中回覆自身 8% 生命！"
  },
Ember: {
    id: "Ember", name: "火花", type: "Fire", baseDmg: 25, baseCd: 0.85,
    knockback: 0, isMelee: false, vfx: "ember_spark", reqItem: "charcoal",
    evolvedName: "大字爆炎", color: "#F97316",
    sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/charcoal.png",
    desc: "噴吐數團跳動小火花，攻速極快，高頻引發灼傷！",
    evoDesc: "【終極超武】向八方噴射高溫大字烈焰，並引爆全圖焦土！"
  },
  WaterGun: {
    id: "WaterGun", name: "水槍", type: "Water", baseDmg: 26, baseCd: 0.90,
    knockback: 8, isMelee: false, vfx: "water_gun", reqItem: "mystic_water",
    evolvedName: "潮旋激流", color: "#38BDF8",
    sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/mystic-water.png",
    desc: "射出輕型高壓水流束，穿透身前小群敵人並產生推阻。",
    evoDesc: "【終極超武】10 條深海漩渦光束席捲全場，大幅擊退並撕裂敵陣！"
  },
  Tackle: {
    id: "Tackle", name: "撞擊", type: "Normal", baseDmg: 24, baseCd: 1.05,
    knockback: 8, isMelee: true, meleeStyle: "slam_wave", reqItem: "silk_scarf",
    evolvedName: "終極衝擊", color: "#CBD5E1",
    sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/silk-scarf.png",
    desc: "向身前施展猛烈衝撞，微幅擊退身周敵人。",
    evoDesc: "【終極超武】全屏金白衝擊狂濤，造成 400% 毀滅巨損！"
  },
  Flamethrower: {
    id: "Flamethrower", name: "噴射火焰", type: "Fire", baseDmg: 32, baseCd: 1.15,
    knockback: 0, isMelee: false, vfx: "fire_stream", reqItem: "charcoal",
    evolvedName: "大字爆炎", color: "#EF4444",
    sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/charcoal.png",
    desc: "朝前方噴吐高溫烈焰，無擊退，專注高頻灼傷輸出。",
    evoDesc: "【終極超武】向八方噴射高溫大字烈焰，並引爆全圖焦土！"
  },
  HydroPump: {
    id: "Hydro Pump", name: "水炮", type: "Water", baseDmg: 38, baseCd: 1.45,
    knockback: 16, isMelee: false, vfx: "water_beam", reqItem: "mystic_water",
    evolvedName: "潮旋激流", color: "#38BDF8",
    sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/mystic-water.png",
    desc: "噴發粗大高壓水柱，產生適度擊退，防禦怪潮貼身。",
    evoDesc: "【終極超武】10 條深海漩渦光束席捲全場，大幅擊退並撕裂敵陣！"
  },
  SeedBomb: {
    id: "Seed Bomb", name: "種子炸彈", type: "Grass", baseDmg: 30, baseCd: 1.15,
    knockback: 10, isMelee: false, vfx: "seed_nut", reqItem: "miracle_seed",
    evolvedName: "瘋狂植物", color: "#65A30D",
    sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/miracle-seed.png",
    desc: "高拋物理拋物線木紋橡子，越過前排轟炸怪群並爆開碎殼與孢子毒霧！",
    evoDesc: "【終極超武】全場破土生長嗜血荊棘藤蔓，命中回覆自身 8% 生命！"
  },
  Thunderbolt: {
    id: "Thunderbolt", name: "十萬伏特", type: "Electric", baseDmg: 34, baseCd: 1.10,
    knockback: 2, isMelee: false, vfx: "lightning_chain", reqItem: "magnet",
    evolvedName: "打雷暴風雨", color: "#FACC15",
    sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/magnet.png",
    desc: "釋放金白高頻電漿鏈，無擊退，極致電擊麻痺。",
    evoDesc: "【終極超武】全屏降下 14 道高壓萬鈞雷霆，附帶全屏白閃！"
  },
  ShadowBall: {
    id: "Shadow Ball", name: "暗影球", type: "Ghost", baseDmg: 30, baseCd: 1.05,
    knockback: 0, isMelee: false, vfx: "shadow_orb", reqItem: "spell_tag",
    evolvedName: "暗影死滅波", color: "#A855F7",
    sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/spell-tag.png",
    desc: "凝縮幽靈黑核射線，純穿透打擊，無擊退。",
    evoDesc: "【終極超武】全圖暗影鬼影奔襲撕咬，附帶混亂反向！"
  },
  Psystrike: {
    id: "Psystrike", name: "精神擊破", type: "Psychic", baseDmg: 36, baseCd: 1.25,
    knockback: 0, isMelee: false, vfx: "psychic_lance", reqItem: "twisted_spoon",
    evolvedName: "精神強念領域", color: "#EC4899",
    sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/twisted-spoon.png",
    desc: "高壓念力實體穿刺，無擊退，精準索敵。",
    evoDesc: "【終極超武】釋放引力超能風暴，全屏崩解目標防禦！"
  },
  IceBeam: {
    id: "Ice Beam", name: "冷凍光線", type: "Ice", baseDmg: 30, baseCd: 1.15,
    knockback: 4, isMelee: false, vfx: "frost_beam", reqItem: "never_melt_ice",
    evolvedName: "絕對零度", color: "#67E8F9",
    sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/never-melt-ice.png",
    desc: "極低溫寒冰射線，微抖動擊退，高概率冰凍遲緩。",
    evoDesc: "【終極超武】凍結全屏怪物 3 秒，並引發全屏冰爆碎裂！"
  },
  Earthquake: {
    id: "Earthquake", name: "地震", type: "Ground", baseDmg: 40, baseCd: 1.65,
    knockback: 28, isMelee: true, meleeStyle: "quake_wave", reqItem: "soft_sand",
    evolvedName: "地裂斷層破", color: "#D97706",
    sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/soft-sand.png",
    desc: "重踏地面激發環形地震波，大範圍強烈擊退。",
    evoDesc: "【終極超武】全屏雙層地底深坑岩石爆裂，造成雙倍粉碎重創！"
  },
  KarateChop: {
    id: "Karate Chop", name: "空手劈", type: "Fighting", baseDmg: 26, baseCd: 0.85,
    knockback: 6, isMelee: true, meleeStyle: "martial_fist", reqItem: "black_belt",
    evolvedName: "爆裂十字劈", color: "#B91C1C",
    sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/black-belt.png",
    desc: "高頻連續金色拳印，極微擊退，完美黏怪打滿連招。",
    evoDesc: "【終極超武】向全方位轟出 10 道巨大氣勁武道金拳！"
  },
  AirSlash: {
    id: "Air Slash", name: "空氣斬", type: "Flying", baseDmg: 28, baseCd: 0.95,
    knockback: 6, isMelee: false, vfx: "wind_blade", reqItem: "sharp_beak",
    evolvedName: "暴風驟雨", color: "#818CF8",
    sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/sharp-beak.png",
    desc: "快速斬出高頻風刃，微弱擊退。",
    evoDesc: "【終極超武】全屏生成穿透龍捲風，將怪物扯入風眼！"
  },
  SludgeBomb: {
    id: "Sludge Bomb", name: "污泥炸彈", type: "Poison", baseDmg: 30, baseCd: 1.15,
    knockback: 4, isMelee: false, vfx: "sludge_ball", reqItem: "poison_barb",
    evolvedName: "劇毒沼澤", color: "#9333EA",
    sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poison-barb.png",
    desc: "投擲劇毒泥漿塊，微擊退，附帶高概率中毒。",
    evoDesc: "【終極超武】全屏覆蓋腐蝕性毒霧，中毒扣血速率提升 100%！"
  },
  Moonblast: {
    id: "Moonblast", name: "月亮之力", type: "Psychic", baseDmg: 34, baseCd: 1.20,
    knockback: 0, isMelee: false, vfx: "moon_blast", reqItem: "twisted_spoon",
    evolvedName: "創世極光", color: "#F472B6",
    sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/twisted-spoon.png",
    desc: "汲取月光引力光球，無擊退，具備索敵追蹤能力。",
    evoDesc: "【終極超武】神聖極光洗禮全屏，超大幅度降低敵人攻擊力！"
  },
  DragonRush: {
    id: "Dragon Rush", name: "龍之俯衝", type: "Dragon", baseDmg: 44, baseCd: 1.80,
    knockback: 24, isMelee: true, meleeStyle: "claw_slash", reqItem: "dragon_scale",
    evolvedName: "天龍流星雨", color: "#4338CA",
    sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/dragon-scale.png",
    desc: "釋放殺氣騰空俯衝，造成範圍擊退與高額物理爆發。",
    evoDesc: "【終極超武】從九天召喚無數燃燒龍系流星砸碎地面！"
  },
  Metronome: {
    id: "Metronome", name: "揮指功", type: "Normal", baseDmg: 30, baseCd: 1.30,
    knockback: 8, isMelee: false, vfx: "star_shot", reqItem: "silk_scarf",
    evolvedName: "天命百寶袋", color: "#F59E0B",
    sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/metronome.png",
    desc: "隨機搖出全圖鑑任意強力攻擊招式！",
    evoDesc: "【終極超武】全場隨機觸發三重不同屬性超武同時轟炸！"
  }
};

Object.values(SKILLS_CATALOG).forEach(sk => {
  SKILLS_CATALOG[sk.id] = sk;
  SKILLS_CATALOG[sk.id.replace(/\s+/g, '')] = sk;
});

function getSkillNextLevelBonusDesc(nextLv) {
  const dmgMultStr = (1 + (nextLv - 1) * 0.06 + (nextLv === 10 ? 0.12 : 0)).toFixed(2);
  if (nextLv === 10) return `★ 滿級覺醒！傷害倍率躍升至 ${dmgMultStr}x，解鎖超武進化前置！`;
  if (nextLv === 4) return `彈幕/打擊數 +1！冷卻時間縮短 -12%！基礎傷害提升至 ${dmgMultStr}x！`;
  if (nextLv === 8) return `彈幕/打擊數 +1！攻擊範圍擴大 +25%！基礎傷害提升至 ${dmgMultStr}x！`;
  if (nextLv === 9) return `極限連發！冷卻時間大幅縮短 -25%！基礎傷害提升至 ${dmgMultStr}x！`;
  if (nextLv === 6) return `穿透力/近戰波次強化！基礎傷害提升至 ${dmgMultStr}x！`;
  if (nextLv === 5) return `異常狀態觸發率提升 +30%！基礎傷害提升至 ${dmgMultStr}x！`;
  if (nextLv === 3) return `近戰/打擊範圍擴大 +15%！基礎傷害提升至 ${dmgMultStr}x！`;
  return `基礎傷害提升至 ${dmgMultStr}x！打擊威力強化！`;
}

// 3. 攜帶道具資料庫 (Phase 2.1 全詞綴與視覺反饋強化版)
const HELD_ITEMS = {
  charcoal: {
    id: "charcoal", name: "木炭", skillReq: "Flamethrower",
    sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/charcoal.png",
    desc: "火傷+20%，走過的路徑留下持續2秒的熔岩灼燒腳印！"
  },
  mystic_water: {
    id: "mystic_water", name: "神秘水滴", skillReq: "Hydro Pump",
    sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/mystic-water.png",
    desc: "水傷+20%，生命低於40%時自動釋放環形高壓水幕擊退身周敵人！"
  },
  miracle_seed: {
    id: "miracle_seed", name: "奇蹟種子", skillReq: "Seed Bomb",
    sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/miracle-seed.png",
    desc: "草傷+20%，常駐光合作用回血，踏入草叢/淺灘/超能陣回復翻倍！"
  },
  magnet: {
    id: "magnet", name: "磁鐵", skillReq: "Thunderbolt",
    sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/magnet.png",
    desc: "電傷+20%，拾取範圍+50%，每12秒釋放電磁波牽引遠處最多8顆水晶！"
  },
  spell_tag: {
    id: "spell_tag", name: "詛咒之符", skillReq: "Shadow Ball",
    sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/spell-tag.png",
    desc: "幽靈傷+20%，擊敗敵人時 15% 機率騰空釋放穿透索敵靈魂鬼火！"
  },
  twisted_spoon: {
    id: "twisted_spoon", name: "彎曲湯匙", skillReq: "Psystrike",
    sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/twisted-spoon.png",
    desc: "超能傷+20%，全技能冷卻縮減-8%，攻擊 15% 機率引發念力震盪與混亂！"
  },
  never_melt_ice: {
    id: "never_melt_ice", name: "不融冰", skillReq: "Ice Beam",
    sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/never-melt-ice.png",
    desc: "冰傷+20%，身周 125px 展開極寒霜凍結界，踏入的怪獸結霜移速-35%！"
  },
  soft_sand: {
    id: "soft_sand", name: "柔軟沙子", skillReq: "Earthquake",
    sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/soft-sand.png",
    desc: "地面傷+20%，受到近戰、彈幕或紅圈攻擊時 25% 機率揚起沙塵完全閃避！"
  },
  black_belt: {
    id: "black_belt", name: "黑帶", skillReq: "Karate Chop",
    sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/black-belt.png",
    desc: "格鬥傷+20%，暴擊傷害從 1.35x 提升至 1.75x（觸發極限暴擊特效）！"
  },
  sharp_beak: {
    id: "sharp_beak", name: "銳利之喙", skillReq: "Air Slash",
    sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/sharp-beak.png",
    desc: "飛行傷+20%，移動速度額外提升 +12%，且完全免疫任何減速地形！"
  },
  silk_scarf: {
    id: "silk_scarf", name: "絲綢圍巾", skillReq: "Tackle",
    sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/silk-scarf.png",
    desc: "一般傷+20%，受創時獲得 0.35 秒額外無敵時間！"
  },
  poison_barb: {
    id: "poison_barb", name: "毒針", skillReq: "Sludge Bomb",
    sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poison-barb.png",
    desc: "毒傷+20%，對處於中毒狀態的敵人造成全額傷害時額外暴擊+25%！"
  },
  dragon_scale: {
    id: "dragon_scale", name: "龍之鱗片", skillReq: "Dragon Rush",
    sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/dragon-scale.png",
    desc: "龍傷+20%，自身受到傷害永久減少 15%（硬質減傷）！"
  }
};

// 4. Boss 與精英小王多重攻擊模式資料庫
const BOSS_ATTACK_PATTERNS = {
  145: {
    name: "閃電鳥",
    skills: [
      { id: "zapdos_pillar", name: "天頂狂雷", shape: "multi_pillar", count: 4, radius: 46, delay: 0.85, dmgMult: 1.35, color: "#FACC15" },
      { id: "zapdos_nova",   name: "電磁激波", shape: "ring", radius: 140, innerRadius: 50, delay: 0.90, dmgMult: 1.15, color: "#FDE047" },
      { id: "zapdos_rush",   name: "疾風俯衝", shape: "line", width: 44, length: 320, delay: 0.75, dmgMult: 1.45, speed: 480, color: "#EAB308" }
    ]
  },
  144: {
    name: "急凍鳥",
    skills: [
      { id: "articuno_line",  name: "絕對零度冰錐線", shape: "line", width: 48, length: 340, delay: 0.80, dmgMult: 1.40, speed: 460, color: "#38BDF8" },
      { id: "articuno_blizz", name: "極寒暴風雪",     shape: "ring", radius: 160, innerRadius: 40, delay: 0.95, dmgMult: 1.25, color: "#BAE6FD" },
      { id: "articuno_nova",  name: "冰華落雨",       shape: "multi_pillar", count: 3, radius: 52, delay: 0.85, dmgMult: 1.30, color: "#67E8F9" }
    ]
  },
  146: {
    name: "火焰鳥",
    skills: [
      { id: "moltres_blast", name: "大字爆炎", shape: "circle", radius: 68, delay: 0.85, dmgMult: 1.50, color: "#EF4444" },
      { id: "moltres_rush",  name: "烈焰衝鋒", shape: "line", width: 46, length: 320, delay: 0.75, dmgMult: 1.40, speed: 500, color: "#F97316" },
      { id: "moltres_rain",  name: "天火燔祭", shape: "multi_pillar", count: 4, radius: 48, delay: 0.80, dmgMult: 1.30, color: "#DC2626" }
    ]
  },
  150: {
    name: "超夢",
    skills: [
      { id: "mewtwo_well",  name: "精神擊破重力陷阱", shape: "circle", radius: 76, delay: 0.85, dmgMult: 1.55, isSuction: true, color: "#A855F7" },
      { id: "mewtwo_dash",  name: "超能穿透突刺",     shape: "line", width: 52, length: 360, delay: 0.70, dmgMult: 1.60, speed: 520, color: "#C084FC" },
      { id: "mewtwo_nova",  name: "念力巨星環",       shape: "ring", radius: 180, innerRadius: 60, delay: 0.90, dmgMult: 1.35, color: "#EC4899" }
    ]
  },
  151: {
    name: "始祖夢幻",
    skills: [
      { id: "mew_metronome", name: "天命百寶引爆", shape: "circle", radius: 65, delay: 0.80, dmgMult: 1.40, color: "#F472B6" },
      { id: "mew_rush",      name: "幻象瞬影衝鋒", shape: "line", width: 42, length: 300, delay: 0.65, dmgMult: 1.35, speed: 480, color: "#FDE047" },
      { id: "mew_pillars",   name: "起源四象光陣", shape: "multi_pillar", count: 5, radius: 44, delay: 0.80, dmgMult: 1.30, color: "#38BDF8" }
    ]
  },
  default_elite: {
    name: "精英領主",
    skills: [
      { id: "elite_smash", name: "首領重踏", shape: "circle", radius: 48, delay: 0.85, dmgMult: 1.25, color: "#EF4444" },
      { id: "elite_rush",  name: "野蠻衝撞", shape: "line", width: 36, length: 260, delay: 0.75, dmgMult: 1.30, speed: 420, color: "#F59E0B" }
    ]
  }
};

// 5. 關都 151 隻完整圖鑑資料庫
const POKEMON_DB = [
  { id: 1, name_zh: "妙蛙種子", type1: "Grass", type2: "Poison", hp: 120, atk: 49, speed: 45, skill: "VineWhip", weightTier: "light", kbResist: 0.10, evo_level: 16, evo_to: 2 },
  { id: 2, name_zh: "妙蛙草", type1: "Grass", type2: "Poison", hp: 160, atk: 62, speed: 60, skill: "Seed Bomb", weightTier: "medium", kbResist: 0.35, evo_level: 32, evo_to: 3 },
  { id: 3, name_zh: "妙蛙花", type1: "Grass", type2: "Poison", hp: 220, atk: 82, speed: 80, skill: "Seed Bomb", weightTier: "heavy", kbResist: 0.85, evo_level: "None", evo_to: null },
  { id: 4, name_zh: "小火龍", type1: "Fire", type2: "None", hp: 115, atk: 52, speed: 65, skill: "Ember", weightTier: "light", kbResist: 0.10, evo_level: 16, evo_to: 5 },
  { id: 5, name_zh: "火恐龍", type1: "Fire", type2: "None", hp: 155, atk: 64, speed: 80, skill: "Flamethrower", weightTier: "medium", kbResist: 0.35, evo_level: 36, evo_to: 6 },
  { id: 6, name_zh: "噴火龍", type1: "Fire", type2: "Flying", hp: 215, atk: 84, speed: 100, skill: "Flamethrower", weightTier: "heavy", kbResist: 0.85, evo_level: "None", evo_to: null },
  { id: 7, name_zh: "傑尼龜", type1: "Water", type2: "None", hp: 133, atk: 48, speed: 43, skill: "WaterGun", weightTier: "light", kbResist: 0.15, evo_level: 16, evo_to: 8 },
  { id: 8, name_zh: "卡咪龜", type1: "Water", type2: "None", hp: 170, atk: 63, speed: 58, skill: "Hydro Pump", weightTier: "medium", kbResist: 0.40, evo_level: 36, evo_to: 9 },
  { id: 9, name_zh: "水箭龜", type1: "Water", type2: "None", hp: 230, atk: 83, speed: 78, skill: "Hydro Pump", weightTier: "heavy", kbResist: 0.90, evo_level: "None", evo_to: null },
  { id: 10, name_zh: "綠毛蟲", type1: "Bug", type2: "None", hp: 95, atk: 30, speed: 45, skill: "Tackle", weightTier: "light", kbResist: 0.0, evo_level: 7, evo_to: 11 },
  { id: 11, name_zh: "鐵甲蛹", type1: "Bug", type2: "None", hp: 140, atk: 25, speed: 30, skill: "Tackle", weightTier: "medium", kbResist: 0.60, evo_level: 10, evo_to: 12 },
  { id: 12, name_zh: "巴大蝶", type1: "Bug", type2: "Flying", hp: 160, atk: 45, speed: 70, skill: "Air Slash", weightTier: "light", kbResist: 0.10, evo_level: "None", evo_to: null },
  { id: 13, name_zh: "獨角蟲", type1: "Bug", type2: "Poison", hp: 95, atk: 35, speed: 50, skill: "Tackle", weightTier: "light", kbResist: 0.0, evo_level: 7, evo_to: 14 },
  { id: 14, name_zh: "鐵殼蛹", type1: "Bug", type2: "Poison", hp: 140, atk: 25, speed: 35, skill: "Tackle", weightTier: "medium", kbResist: 0.60, evo_level: 10, evo_to: 15 },
  { id: 15, name_zh: "大針蜂", type1: "Bug", type2: "Poison", hp: 165, atk: 90, speed: 75, skill: "Sludge Bomb", weightTier: "medium", kbResist: 0.25, evo_level: "None", evo_to: null },
  { id: 16, name_zh: "波波", type1: "Normal", type2: "Flying", hp: 100, atk: 45, speed: 56, skill: "Air Slash", weightTier: "light", kbResist: 0.0, evo_level: 18, evo_to: 17 },
  { id: 17, name_zh: "比比鳥", type1: "Normal", type2: "Flying", hp: 150, atk: 60, speed: 71, skill: "Air Slash", weightTier: "medium", kbResist: 0.25, evo_level: 36, evo_to: 18 },
  { id: 18, name_zh: "大比鳥", type1: "Normal", type2: "Flying", hp: 205, atk: 80, speed: 101, skill: "Air Slash", weightTier: "medium", kbResist: 0.45, evo_level: "None", evo_to: null },
  { id: 19, name_zh: "小拉達", type1: "Normal", type2: "None", hp: 90, atk: 56, speed: 72, skill: "Tackle", weightTier: "light", kbResist: 0.0, evo_level: 20, evo_to: 20 },
  { id: 20, name_zh: "拉達", type1: "Normal", type2: "None", hp: 155, atk: 81, speed: 97, skill: "Tackle", weightTier: "medium", kbResist: 0.30, evo_level: "None", evo_to: null },
  { id: 21, name_zh: "烈雀", type1: "Normal", type2: "Flying", hp: 100, atk: 60, speed: 70, skill: "Air Slash", weightTier: "light", kbResist: 0.0, evo_level: 20, evo_to: 22 },
  { id: 22, name_zh: "大嘴雀", type1: "Normal", type2: "Flying", hp: 165, atk: 90, speed: 100, skill: "Air Slash", weightTier: "medium", kbResist: 0.35, evo_level: "None", evo_to: null },
  { id: 23, name_zh: "阿柏蛇", type1: "Poison", type2: "None", hp: 105, atk: 60, speed: 55, skill: "Sludge Bomb", weightTier: "light", kbResist: 0.15, evo_level: 22, evo_to: 24 },
  { id: 24, name_zh: "阿柏怪", type1: "Poison", type2: "None", hp: 160, atk: 95, speed: 80, skill: "Sludge Bomb", weightTier: "medium", kbResist: 0.45, evo_level: "None", evo_to: null },
  { id: 25, name_zh: "皮卡丘", type1: "Electric", type2: "None", hp: 102, atk: 55, speed: 90, skill: "Thunderbolt", weightTier: "light", kbResist: 0.10, evo_level: 22, evo_to: 26 },
  { id: 26, name_zh: "雷丘", type1: "Electric", type2: "None", hp: 160, atk: 90, speed: 110, skill: "Thunderbolt", weightTier: "medium", kbResist: 0.40, evo_level: "None", evo_to: null },
  { id: 27, name_zh: "穿山鼠", type1: "Ground", type2: "None", hp: 110, atk: 75, speed: 40, skill: "Earthquake", weightTier: "light", kbResist: 0.25, evo_level: 22, evo_to: 28 },
  { id: 28, name_zh: "穿山王", type1: "Ground", type2: "None", hp: 175, atk: 100, speed: 65, skill: "Earthquake", weightTier: "medium", kbResist: 0.60, evo_level: "None", evo_to: null },
  { id: 29, name_zh: "尼多蘭", type1: "Poison", type2: "None", hp: 115, atk: 47, speed: 41, skill: "Sludge Bomb", weightTier: "light", kbResist: 0.15, evo_level: 16, evo_to: 30 },
  { id: 30, name_zh: "尼多娜", type1: "Poison", type2: "None", hp: 160, atk: 62, speed: 56, skill: "Sludge Bomb", weightTier: "medium", kbResist: 0.40, evo_level: 36, evo_to: 31 },
  { id: 31, name_zh: "尼多后", type1: "Poison", type2: "Ground", hp: 210, atk: 92, speed: 76, skill: "Earthquake", weightTier: "heavy", kbResist: 0.85, evo_level: "None", evo_to: null },
  { id: 32, name_zh: "尼多朗", type1: "Poison", type2: "None", hp: 110, atk: 57, speed: 50, skill: "Sludge Bomb", weightTier: "light", kbResist: 0.15, evo_level: 16, evo_to: 33 },
  { id: 33, name_zh: "尼多力諾", type1: "Poison", type2: "None", hp: 155, atk: 72, speed: 65, skill: "Sludge Bomb", weightTier: "medium", kbResist: 0.40, evo_level: 36, evo_to: 34 },
  { id: 34, name_zh: "尼多王", type1: "Poison", type2: "Ground", hp: 201, atk: 102, speed: 85, skill: "Earthquake", weightTier: "heavy", kbResist: 0.85, evo_level: "None", evo_to: null },
  { id: 35, name_zh: "皮皮", type1: "Psychic", type2: "None", hp: 140, atk: 45, speed: 35, skill: "Moonblast", weightTier: "light", kbResist: 0.20, evo_level: 20, evo_to: 36 },
  { id: 36, name_zh: "皮可西", type1: "Psychic", type2: "None", hp: 195, atk: 70, speed: 60, skill: "Moonblast", weightTier: "medium", kbResist: 0.50, evo_level: "None", evo_to: null },
  { id: 37, name_zh: "六尾", type1: "Fire", type2: "None", hp: 108, atk: 41, speed: 65, skill: "Flamethrower", weightTier: "light", kbResist: 0.10, evo_level: 20, evo_to: 38 },
  { id: 38, name_zh: "九尾", type1: "Fire", type2: "None", hp: 173, atk: 76, speed: 100, skill: "Flamethrower", weightTier: "medium", kbResist: 0.40, evo_level: "None", evo_to: null },
  { id: 39, name_zh: "胖丁", type1: "Normal", type2: "Psychic", hp: 185, atk: 45, speed: 20, skill: "Moonblast", weightTier: "light", kbResist: 0.15, evo_level: 20, evo_to: 40 },
  { id: 40, name_zh: "胖可丁", type1: "Normal", type2: "Psychic", hp: 240, atk: 70, speed: 45, skill: "Moonblast", weightTier: "medium", kbResist: 0.55, evo_level: "None", evo_to: null },
  { id: 41, name_zh: "超音蝠", type1: "Poison", type2: "Flying", hp: 100, atk: 45, speed: 55, skill: "Air Slash", weightTier: "light", kbResist: 0.0, evo_level: 22, evo_to: 42 },
  { id: 42, name_zh: "大嘴蝠", type1: "Poison", type2: "Flying", hp: 165, atk: 80, speed: 90, skill: "Air Slash", weightTier: "medium", kbResist: 0.30, evo_level: "None", evo_to: null },
  { id: 43, name_zh: "走路草", type1: "Grass", type2: "Poison", hp: 110, atk: 50, speed: 30, skill: "Seed Bomb", weightTier: "light", kbResist: 0.10, evo_level: 21, evo_to: 44 },
  { id: 44, name_zh: "臭臭花", type1: "Grass", type2: "Poison", hp: 150, atk: 65, speed: 40, skill: "Seed Bomb", weightTier: "medium", kbResist: 0.35, evo_level: 36, evo_to: 45 },
  { id: 45, name_zh: "霸王花", type1: "Grass", type2: "Poison", hp: 195, atk: 80, speed: 50, skill: "Seed Bomb", weightTier: "medium", kbResist: 0.65, evo_level: "None", evo_to: null },
  { id: 46, name_zh: "派拉斯", type1: "Bug", type2: "Grass", hp: 105, atk: 70, speed: 25, skill: "Seed Bomb", weightTier: "light", kbResist: 0.15, evo_level: 24, evo_to: 47 },
  { id: 47, name_zh: "派拉斯特", type1: "Bug", type2: "Grass", hp: 160, atk: 95, speed: 30, skill: "Seed Bomb", weightTier: "medium", kbResist: 0.55, evo_level: "None", evo_to: null },
  { id: 48, name_zh: "毛球", type1: "Bug", type2: "Poison", hp: 120, atk: 55, speed: 45, skill: "Sludge Bomb", weightTier: "light", kbResist: 0.15, evo_level: 31, evo_to: 49 },
  { id: 49, name_zh: "摩魯蛾", type1: "Bug", type2: "Poison", hp: 170, atk: 65, speed: 90, skill: "Sludge Bomb", weightTier: "medium", kbResist: 0.40, evo_level: "None", evo_to: null },
  { id: 50, name_zh: "地鼠", type1: "Ground", type2: "None", hp: 70, atk: 55, speed: 95, skill: "Earthquake", weightTier: "light", kbResist: 0.0, evo_level: 26, evo_to: 51 },
  { id: 51, name_zh: "三地鼠", type1: "Ground", type2: "None", hp: 105, atk: 100, speed: 120, skill: "Earthquake", weightTier: "medium", kbResist: 0.35, evo_level: "None", evo_to: null },
  { id: 52, name_zh: "喵喵", type1: "Normal", type2: "None", hp: 100, atk: 45, speed: 90, skill: "Tackle", weightTier: "light", kbResist: 0.05, evo_level: 28, evo_to: 53 },
  { id: 53, name_zh: "貓老大", type1: "Normal", type2: "None", hp: 165, atk: 70, speed: 115, skill: "Tackle", weightTier: "medium", kbResist: 0.35, evo_level: "None", evo_to: null },
  { id: 54, name_zh: "可達鴨", type1: "Water", type2: "None", hp: 120, atk: 52, speed: 55, skill: "Hydro Pump", weightTier: "light", kbResist: 0.15, evo_level: 33, evo_to: 55 },
  { id: 55, name_zh: "哥達鴨", type1: "Water", type2: "None", hp: 180, atk: 82, speed: 85, skill: "Hydro Pump", weightTier: "medium", kbResist: 0.50, evo_level: "None", evo_to: null },
  { id: 56, name_zh: "猴怪", type1: "Fighting", type2: "None", hp: 100, atk: 80, speed: 70, skill: "Karate Chop", weightTier: "light", kbResist: 0.10, evo_level: 28, evo_to: 57 },
  { id: 57, name_zh: "火爆猴", type1: "Fighting", type2: "None", hp: 165, atk: 105, speed: 95, skill: "Karate Chop", weightTier: "medium", kbResist: 0.45, evo_level: "None", evo_to: null },
  { id: 58, name_zh: "卡蒂狗", type1: "Fire", type2: "None", hp: 125, atk: 70, speed: 60, skill: "Flamethrower", weightTier: "light", kbResist: 0.20, evo_level: 24, evo_to: 59 },
  { id: 59, name_zh: "風速狗", type1: "Fire", type2: "None", hp: 210, atk: 110, speed: 95, skill: "Flamethrower", weightTier: "heavy", kbResist: 0.85, evo_level: "None", evo_to: null },
  { id: 60, name_zh: "蚊香蝌蚪", type1: "Water", type2: "None", hp: 100, atk: 50, speed: 90, skill: "Hydro Pump", weightTier: "light", kbResist: 0.05, evo_level: 25, evo_to: 61 },
  { id: 61, name_zh: "蚊香君", type1: "Water", type2: "None", hp: 155, atk: 65, speed: 90, skill: "Hydro Pump", weightTier: "medium", kbResist: 0.40, evo_level: 36, evo_to: 62 },
  { id: 62, name_zh: "蚊香泳士", type1: "Water", type2: "Fighting", hp: 210, atk: 95, speed: 70, skill: "Hydro Pump", weightTier: "heavy", kbResist: 0.85, evo_level: "None", evo_to: null },
  { id: 63, name_zh: "凱西", type1: "Psychic", type2: "None", hp: 85, atk: 20, speed: 90, skill: "Psystrike", weightTier: "light", kbResist: 0.0, evo_level: 16, evo_to: 64 },
  { id: 64, name_zh: "勇基拉", type1: "Psychic", type2: "None", hp: 130, atk: 35, speed: 105, skill: "Psystrike", weightTier: "medium", kbResist: 0.25, evo_level: 36, evo_to: 65 },
  { id: 65, name_zh: "胡地", type1: "Psychic", type2: "None", hp: 175, atk: 50, speed: 120, skill: "Psystrike", weightTier: "medium", kbResist: 0.45, evo_level: "None", evo_to: null },
  { id: 66, name_zh: "腕力", type1: "Fighting", type2: "None", hp: 130, atk: 80, speed: 35, skill: "Karate Chop", weightTier: "medium", kbResist: 0.35, evo_level: 28, evo_to: 67 },
  { id: 67, name_zh: "豪力", type1: "Fighting", type2: "None", hp: 170, atk: 100, speed: 45, skill: "Karate Chop", weightTier: "medium", kbResist: 0.65, evo_level: 36, evo_to: 68 },
  { id: 68, name_zh: "怪力", type1: "Fighting", type2: "None", hp: 220, atk: 130, speed: 55, skill: "Karate Chop", weightTier: "heavy", kbResist: 0.95, evo_level: "None", evo_to: null },
  { id: 69, name_zh: "喇叭芽", type1: "Grass", type2: "Poison", hp: 110, atk: 75, speed: 40, skill: "Seed Bomb", weightTier: "light", kbResist: 0.05, evo_level: 21, evo_to: 70 },
  { id: 70, name_zh: "口呆花", type1: "Grass", type2: "Poison", hp: 155, atk: 90, speed: 55, skill: "Seed Bomb", weightTier: "medium", kbResist: 0.35, evo_level: 36, evo_to: 71 },
  { id: 71, name_zh: "大食花", type1: "Grass", type2: "Poison", hp: 200, atk: 105, speed: 70, skill: "Seed Bomb", weightTier: "heavy", kbResist: 0.75, evo_level: "None", evo_to: null },
  { id: 72, name_zh: "瑪瑙水母", type1: "Water", type2: "Poison", hp: 110, atk: 40, speed: 70, skill: "Hydro Pump", weightTier: "light", kbResist: 0.15, evo_level: 30, evo_to: 73 },
  { id: 73, name_zh: "毒刺水母", type1: "Water", type2: "Poison", hp: 190, atk: 70, speed: 100, skill: "Hydro Pump", weightTier: "heavy", kbResist: 0.85, evo_level: "None", evo_to: null },
  { id: 74, name_zh: "小拳石", type1: "Rock", type2: "Ground", hp: 120, atk: 80, speed: 20, skill: "Earthquake", weightTier: "medium", kbResist: 0.55, evo_level: 25, evo_to: 75 },
  { id: 75, name_zh: "隆隆石", type1: "Rock", type2: "Ground", hp: 165, atk: 95, speed: 35, skill: "Earthquake", weightTier: "heavy", kbResist: 0.85, evo_level: 36, evo_to: 76 },
  { id: 76, name_zh: "隆隆岩", type1: "Rock", type2: "Ground", hp: 210, atk: 120, speed: 45, skill: "Earthquake", weightTier: "heavy", kbResist: 0.95, evo_level: "None", evo_to: null },
  { id: 77, name_zh: "小火馬", type1: "Fire", type2: "None", hp: 120, atk: 85, speed: 90, skill: "Flamethrower", weightTier: "light", kbResist: 0.20, evo_level: 34, evo_to: 78 },
  { id: 78, name_zh: "烈焰馬", type1: "Fire", type2: "None", hp: 175, atk: 100, speed: 105, skill: "Flamethrower", weightTier: "medium", kbResist: 0.55, evo_level: "None", evo_to: null },
  { id: 79, name_zh: "呆呆獸", type1: "Water", type2: "Psychic", hp: 150, atk: 65, speed: 15, skill: "Hydro Pump", weightTier: "medium", kbResist: 0.65, evo_level: 37, evo_to: 80 },
  { id: 80, name_zh: "呆殼獸", type1: "Water", type2: "Psychic", hp: 215, atk: 75, speed: 30, skill: "Hydro Pump", weightTier: "heavy", kbResist: 0.90, evo_level: "None", evo_to: null },
  { id: 81, name_zh: "小磁怪", type1: "Electric", type2: "Steel", hp: 90, atk: 35, speed: 45, skill: "Thunderbolt", weightTier: "light", kbResist: 0.10, evo_level: 30, evo_to: 82 },
  { id: 82, name_zh: "三合一磁怪", type1: "Electric", type2: "Steel", hp: 145, atk: 60, speed: 70, skill: "Thunderbolt", weightTier: "medium", kbResist: 0.50, evo_level: "None", evo_to: null },
  { id: 83, name_zh: "大蔥鴨", type1: "Normal", type2: "Flying", hp: 132, atk: 90, speed: 60, skill: "Air Slash", weightTier: "light", kbResist: 0.15, evo_level: "None", evo_to: null },
  { id: 84, name_zh: "嘟嘟", type1: "Normal", type2: "Flying", hp: 105, atk: 85, speed: 75, skill: "Air Slash", weightTier: "light", kbResist: 0.15, evo_level: 31, evo_to: 85 },
  { id: 85, name_zh: "嘟嘟利", type1: "Normal", type2: "Flying", hp: 165, atk: 110, speed: 110, skill: "Air Slash", weightTier: "medium", kbResist: 0.45, evo_level: "None", evo_to: null },
  { id: 86, name_zh: "小海獅", type1: "Water", type2: "None", hp: 135, atk: 45, speed: 45, skill: "Ice Beam", weightTier: "medium", kbResist: 0.35, evo_level: 34, evo_to: 87 },
  { id: 87, name_zh: "白海獅", type1: "Water", type2: "Ice", hp: 200, atk: 70, speed: 70, skill: "Ice Beam", weightTier: "heavy", kbResist: 0.80, evo_level: "None", evo_to: null },
  { id: 88, name_zh: "臭泥", type1: "Poison", type2: "None", hp: 140, atk: 80, speed: 25, skill: "Sludge Bomb", weightTier: "medium", kbResist: 0.45, evo_level: 38, evo_to: 89 },
  { id: 89, name_zh: "臭臭泥", type1: "Poison", type2: "None", hp: 215, atk: 105, speed: 50, skill: "Sludge Bomb", weightTier: "heavy", kbResist: 0.85, evo_level: "None", evo_to: null },
  { id: 90, name_zh: "大舌貝", type1: "Water", type2: "None", hp: 95, atk: 65, speed: 40, skill: "Hydro Pump", weightTier: "light", kbResist: 0.30, evo_level: 24, evo_to: 91 },
  { id: 91, name_zh: "刺甲貝", type1: "Water", type2: "Ice", hp: 160, atk: 95, speed: 70, skill: "Ice Beam", weightTier: "heavy", kbResist: 0.85, evo_level: "None", evo_to: null },
  { id: 92, name_zh: "鬼斯", type1: "Ghost", type2: "Poison", hp: 85, atk: 35, speed: 80, skill: "Shadow Ball", weightTier: "light", kbResist: 0.0, evo_level: 25, evo_to: 93 },
  { id: 93, name_zh: "鬼斯通", type1: "Ghost", type2: "Poison", hp: 125, atk: 50, speed: 95, skill: "Shadow Ball", weightTier: "medium", kbResist: 0.20, evo_level: 36, evo_to: 94 },
  { id: 94, name_zh: "耿鬼", type1: "Ghost", type2: "Poison", hp: 170, atk: 65, speed: 110, skill: "Shadow Ball", weightTier: "medium", kbResist: 0.50, evo_level: "None", evo_to: null },
  { id: 95, name_zh: "大岩蛇", type1: "Rock", type2: "Ground", hp: 145, atk: 45, speed: 70, skill: "Earthquake", weightTier: "heavy", kbResist: 0.95, evo_level: "None", evo_to: null },
  { id: 96, name_zh: "催眠貘", type1: "Psychic", type2: "None", hp: 130, atk: 48, speed: 42, skill: "Psystrike", weightTier: "light", kbResist: 0.20, evo_level: 26, evo_to: 97 },
  { id: 97, name_zh: "引夢貘人", type1: "Psychic", type2: "None", hp: 185, atk: 73, speed: 67, skill: "Psystrike", weightTier: "medium", kbResist: 0.60, evo_level: "None", evo_to: null },
  { id: 98, name_zh: "大鉗蟹", type1: "Water", type2: "None", hp: 95, atk: 105, speed: 50, skill: "Hydro Pump", weightTier: "light", kbResist: 0.20, evo_level: 28, evo_to: 99 },
  { id: 99, name_zh: "巨鉗蟹", type1: "Water", type2: "None", hp: 165, atk: 130, speed: 75, skill: "Hydro Pump", weightTier: "heavy", kbResist: 0.85, evo_level: "None", evo_to: null },
  { id: 100, name_zh: "霹靂電球", type1: "Electric", type2: "None", hp: 100, atk: 30, speed: 100, skill: "Thunderbolt", weightTier: "light", kbResist: 0.05, evo_level: 30, evo_to: 101 },
  { id: 101, name_zh: "頑皮雷彈", type1: "Electric", type2: "None", hp: 160, atk: 50, speed: 150, skill: "Thunderbolt", weightTier: "medium", kbResist: 0.45, evo_level: "None", evo_to: null },
  { id: 102, name_zh: "蛋蛋", type1: "Grass", type2: "Psychic", hp: 120, atk: 40, speed: 40, skill: "Seed Bomb", weightTier: "light", kbResist: 0.15, evo_level: 24, evo_to: 103 },
  { id: 103, name_zh: "椰蛋樹", type1: "Grass", type2: "Psychic", hp: 205, atk: 95, speed: 55, skill: "Seed Bomb", weightTier: "heavy", kbResist: 0.85, evo_level: "None", evo_to: null },
  { id: 104, name_zh: "卡拉卡拉", type1: "Ground", type2: "None", hp: 110, atk: 50, speed: 35, skill: "Earthquake", weightTier: "light", kbResist: 0.20, evo_level: 28, evo_to: 105 },
  { id: 105, name_zh: "嘎啦嘎啦", type1: "Ground", type2: "None", hp: 170, atk: 80, speed: 45, skill: "Earthquake", weightTier: "medium", kbResist: 0.60, evo_level: "None", evo_to: null },
  { id: 106, name_zh: "飛腿郎", type1: "Fighting", type2: "None", hp: 150, atk: 120, speed: 87, skill: "Karate Chop", weightTier: "medium", kbResist: 0.50, evo_level: "None", evo_to: null },
  { id: 107, name_zh: "快拳郎", type1: "Fighting", type2: "None", hp: 150, atk: 105, speed: 76, skill: "Karate Chop", weightTier: "medium", kbResist: 0.50, evo_level: "None", evo_to: null },
  { id: 108, name_zh: "大舌頭", type1: "Normal", type2: "None", hp: 195, atk: 55, speed: 30, skill: "Tackle", weightTier: "heavy", kbResist: 0.80, evo_level: "None", evo_to: null },
  { id: 109, name_zh: "瓦斯彈", type1: "Poison", type2: "None", hp: 100, atk: 65, speed: 35, skill: "Sludge Bomb", weightTier: "light", kbResist: 0.20, evo_level: 35, evo_to: 110 },
  { id: 110, name_zh: "雙彈瓦斯", type1: "Poison", type2: "None", hp: 175, atk: 90, speed: 60, skill: "Sludge Bomb", weightTier: "medium", kbResist: 0.60, evo_level: "None", evo_to: null },
  { id: 111, name_zh: "獨角犀牛", type1: "Ground", type2: "Rock", hp: 145, atk: 85, speed: 25, skill: "Earthquake", weightTier: "heavy", kbResist: 0.75, evo_level: 36, evo_to: 112 },
  { id: 112, name_zh: "鑽角犀獸", type1: "Ground", type2: "Rock", hp: 215, atk: 130, speed: 40, skill: "Earthquake", weightTier: "heavy", kbResist: 0.95, evo_level: "None", evo_to: null },
  { id: 113, name_zh: "吉利蛋", type1: "Normal", type2: "None", hp: 450, atk: 15, speed: 50, skill: "Tackle", weightTier: "heavy", kbResist: 0.85, evo_level: "None", evo_to: null },
  { id: 114, name_zh: "蔓藤怪", type1: "Grass", type2: "None", hp: 145, atk: 55, speed: 60, skill: "Seed Bomb", weightTier: "medium", kbResist: 0.50, evo_level: "None", evo_to: null },
  { id: 115, name_zh: "袋獸", type1: "Normal", type2: "None", hp: 215, atk: 95, speed: 90, skill: "Tackle", weightTier: "heavy", kbResist: 0.85, evo_level: "None", evo_to: null },
  { id: 116, name_zh: "墨海馬", type1: "Water", type2: "None", hp: 90, atk: 40, speed: 60, skill: "Hydro Pump", weightTier: "light", kbResist: 0.05, evo_level: 32, evo_to: 117 },
  { id: 117, name_zh: "海刺龍", type1: "Water", type2: "None", hp: 155, atk: 65, speed: 85, skill: "Hydro Pump", weightTier: "medium", kbResist: 0.45, evo_level: "None", evo_to: null },
  { id: 118, name_zh: "角金魚", type1: "Water", type2: "None", hp: 110, atk: 67, speed: 63, skill: "Hydro Pump", weightTier: "light", kbResist: 0.10, evo_level: 33, evo_to: 119 },
  { id: 119, name_zh: "金魚王", type1: "Water", type2: "None", hp: 175, atk: 92, speed: 68, skill: "Hydro Pump", weightTier: "medium", kbResist: 0.50, evo_level: "None", evo_to: null },
  { id: 120, name_zh: "海星星", type1: "Water", type2: "None", hp: 95, atk: 45, speed: 85, skill: "Hydro Pump", weightTier: "light", kbResist: 0.10, evo_level: 24, evo_to: 121 },
  { id: 121, name_zh: "寶石海星", type1: "Water", type2: "Psychic", hp: 170, atk: 75, speed: 115, skill: "Hydro Pump", weightTier: "medium", kbResist: 0.50, evo_level: "None", evo_to: null },
  { id: 122, name_zh: "魔牆人偶", type1: "Psychic", type2: "None", hp: 140, atk: 45, speed: 90, skill: "Psystrike", weightTier: "medium", kbResist: 0.45, evo_level: "None", evo_to: null },
  { id: 123, name_zh: "飛天螳螂", type1: "Bug", type2: "Flying", hp: 175, atk: 110, speed: 105, skill: "Air Slash", weightTier: "medium", kbResist: 0.55, evo_level: "None", evo_to: null },
  { id: 124, name_zh: "迷唇姐", type1: "Ice", type2: "Psychic", hp: 155, atk: 50, speed: 95, skill: "Ice Beam", weightTier: "medium", kbResist: 0.40, evo_level: "None", evo_to: null },
  { id: 125, name_zh: "電擊獸", type1: "Electric", type2: "None", hp: 170, atk: 83, speed: 105, skill: "Thunderbolt", weightTier: "medium", kbResist: 0.55, evo_level: "None", evo_to: null },
  { id: 126, name_zh: "鴨嘴火獸", type1: "Fire", type2: "None", hp: 170, atk: 95, speed: 93, skill: "Flamethrower", weightTier: "medium", kbResist: 0.55, evo_level: "None", evo_to: null },
  { id: 127, name_zh: "凱羅斯", type1: "Bug", type2: "None", hp: 170, atk: 125, speed: 85, skill: "Karate Chop", weightTier: "heavy", kbResist: 0.75, evo_level: "None", evo_to: null },
  { id: 128, name_zh: "肯泰羅", type1: "Normal", type2: "None", hp: 185, atk: 100, speed: 110, skill: "Tackle", weightTier: "heavy", kbResist: 0.85, evo_level: "None", evo_to: null },
  { id: 129, name_zh: "鯉魚王", type1: "Water", type2: "None", hp: 70, atk: 10, speed: 80, skill: "Tackle", weightTier: "light", kbResist: 0.0, evo_level: 20, evo_to: 130 },
  { id: 130, name_zh: "暴鯉龍", type1: "Water", type2: "Flying", hp: 225, atk: 125, speed: 81, skill: "Hydro Pump", weightTier: "heavy", kbResist: 0.95, evo_level: "None", evo_to: null },
  { id: 131, name_zh: "拉普拉斯", type1: "Water", type2: "Ice", hp: 260, atk: 85, speed: 60, skill: "Ice Beam", weightTier: "heavy", kbResist: 0.95, evo_level: "None", evo_to: null },
  { id: 132, name_zh: "百變怪", type1: "Normal", type2: "None", hp: 120, atk: 48, speed: 48, skill: "Metronome", weightTier: "light", kbResist: 0.15, evo_level: "None", evo_to: null },
  { id: 133, name_zh: "伊布", type1: "Normal", type2: "None", hp: 118, atk: 55, speed: 55, skill: "Tackle", weightTier: "light", kbResist: 0.15, evo_level: 20, evo_to: 134 },
  { id: 134, name_zh: "水伊布", type1: "Water", type2: "None", hp: 240, atk: 65, speed: 65, skill: "Hydro Pump", weightTier: "heavy", kbResist: 0.80, evo_level: "None", evo_to: null },
  { id: 135, name_zh: "雷伊布", type1: "Electric", type2: "None", hp: 165, atk: 65, speed: 130, skill: "Thunderbolt", weightTier: "medium", kbResist: 0.45, evo_level: "None", evo_to: null },
  { id: 136, name_zh: "火伊布", type1: "Fire", type2: "None", hp: 165, atk: 130, speed: 65, skill: "Flamethrower", weightTier: "medium", kbResist: 0.50, evo_level: "None", evo_to: null },
  { id: 137, name_zh: "多邊獸", type1: "Normal", type2: "None", hp: 145, atk: 60, speed: 40, skill: "Psystrike", weightTier: "medium", kbResist: 0.45, evo_level: "None", evo_to: null },
  { id: 138, name_zh: "菊石獸", type1: "Rock", type2: "Water", hp: 105, atk: 40, speed: 35, skill: "Hydro Pump", weightTier: "light", kbResist: 0.35, evo_level: 34, evo_to: 139 },
  { id: 139, name_zh: "多刺菊石獸", type1: "Rock", type2: "Water", hp: 175, atk: 60, speed: 55, skill: "Hydro Pump", weightTier: "heavy", kbResist: 0.85, evo_level: "None", evo_to: null },
  { id: 140, name_zh: "化石盔", type1: "Rock", type2: "Water", hp: 95, atk: 75, speed: 55, skill: "Hydro Pump", weightTier: "light", kbResist: 0.35, evo_level: 34, evo_to: 141 },
  { id: 141, name_zh: "鐮刀盔", type1: "Rock", type2: "Water", hp: 165, atk: 115, speed: 80, skill: "Karate Chop", weightTier: "heavy", kbResist: 0.85, evo_level: "None", evo_to: null },
  { id: 142, name_zh: "化石翼龍", type1: "Rock", type2: "Flying", hp: 185, atk: 105, speed: 130, skill: "Air Slash", weightTier: "heavy", kbResist: 0.85, evo_level: "None", evo_to: null },
  { id: 143, name_zh: "卡比獸", type1: "Normal", type2: "None", hp: 320, atk: 110, speed: 30, skill: "Tackle", weightTier: "heavy", kbResist: 1.0, evo_level: "None", evo_to: null },
  { id: 144, name_zh: "急凍鳥", type1: "Ice", type2: "Flying", hp: 200, atk: 85, speed: 85, skill: "Ice Beam", weightTier: "boss", kbResist: 1.0, evo_level: "None", evo_to: null },
  { id: 145, name_zh: "閃電鳥", type1: "Electric", type2: "Flying", hp: 200, atk: 90, speed: 100, skill: "Thunderbolt", weightTier: "boss", kbResist: 1.0, evo_level: "None", evo_to: null },
  { id: 146, name_zh: "火焰鳥", type1: "Fire", type2: "Flying", hp: 200, atk: 100, speed: 90, skill: "Flamethrower", weightTier: "boss", kbResist: 1.0, evo_level: "None", evo_to: null },
  { id: 147, name_zh: "迷你龍", type1: "Dragon", type2: "None", hp: 110, atk: 64, speed: 50, skill: "Dragon Rush", weightTier: "light", kbResist: 0.15, evo_level: 20, evo_to: 148 },
  { id: 148, name_zh: "哈克龍", type1: "Dragon", type2: "None", hp: 165, atk: 84, speed: 70, skill: "Dragon Rush", weightTier: "medium", kbResist: 0.45, evo_level: 38, evo_to: 149 },
  { id: 149, name_zh: "快龍", type1: "Dragon", type2: "Flying", hp: 225, atk: 134, speed: 80, skill: "Dragon Rush", weightTier: "heavy", kbResist: 0.95, evo_level: "None", evo_to: null },
  { id: 150, name_zh: "超夢", type1: "Psychic", type2: "None", hp: 240, atk: 110, speed: 130, skill: "Psystrike", weightTier: "boss", kbResist: 1.0, evo_level: "None", evo_to: null },
  { id: 151, name_zh: "夢幻", type1: "Psychic", type2: "None", hp: 220, atk: 100, speed: 100, skill: "Metronome", weightTier: "boss", kbResist: 1.0, evo_level: "None", evo_to: null }
];

POKEMON_DB.forEach(p => {
  p.forward_sprite = `https://raw.githubusercontent.com/NightCatSama/pokedex/main/images/sprite/forward/${p.id}.png`;
  p.back_sprite = `https://raw.githubusercontent.com/NightCatSama/pokedex/main/images/sprite/back/${p.id}.png`;
});

const POKEMON_MAP = new Map(POKEMON_DB.map(p => [p.id, p]));
const REGULAR_MOB_POOL = POKEMON_DB.filter(p => p.id <= 143 && p.id !== 52 && p.id !== 113);
const PARTNER_SUMMON_POOL = [1, 4, 7, 25, 39, 54, 58, 60, 133, 147];

// 6. 出戰初始陣容卡牌定義
const PLAYABLE_ROSTER = [
  { id: 25, cost: 0,   tag: "初始搭檔" },
  { id: 1,  cost: 150, tag: "草系禦三家" },
  { id: 4,  cost: 150, tag: "火系禦三家" },
  { id: 7,  cost: 150, tag: "水系禦三家" },
  { id: 10, cost: 80,  tag: "森林速通" },
  { id: 16, cost: 80,  tag: "極速飛行" },
  { id: 133,cost: 250, tag: "三系分支進化" },
  { id: 147,cost: 350, tag: "准神幼體" }
];

// 7. 六大隨行訓練家 (小智支援專屬 cutin 插圖)
const TRAINERS = [
  {
    id: "ash",
    name: "小智 (Ash)",
    title: "真新鎮的少年",
    sprite: "images/Ash_01.png",
    cutin: "images/cutin_ash.png",
    sprites: {
      down: "images/Ash_01.png",
      up: "images/Ash_04.png",
      left: "images/Ash_02.png",
      right: "images/Ash_03.png"
    },
    cost: 0,
    skillName: "就決定是你了！",
    skillCd: 25,
    skillDuration: 6.0,
    desc: "發動後全夥伴攻速與暴擊率+25%，全場敵軍擊退阻尼削弱，立即回覆18% HP！",
    bondName: "命運搭檔",
    bondColor: "#F59E0B",
    bondPokemonIds: [25, 1, 4, 7],
    bondPreviewIds: [25, 1, 4, 7],
    mods: { dmgMult: 1.0, cdMult: 1.0, hpMult: 1.0, speedMult: 1.05, areaMult: 1.0, critBonus: 0.05, regen: 0, expMult: 1.10 }
  },
  {
    id: "misty",
    name: "小霞 (Misty)",
    title: "華藍道館館主",
    sprite: "images/misty_01.png",
    cutin: "images/cutin_misty.png",
    sprites: {
      down: "images/misty_01.png",
      up: "images/misty_04.png",
      left: "images/misty_02.png",
      right: "images/misty_03.png"
    },
    cost: 200,
    skillName: "暴風海嘯",
    skillCd: 28,
    skillDuration: 4.5,
    desc: "釋放全屏高壓環形水浪，強烈震退周遭敵軍並冰凍遲緩 3 秒！",
    bondName: "水之精靈",
    bondColor: "#38BDF8",
    bondPokemonIds: [7, 54, 120, 131],
    bondPreviewIds: [7, 54, 120, 131],
    mods: { dmgMult: 1.0, cdMult: 0.92, hpMult: 1.0, speedMult: 1.0, areaMult: 1.15, critBonus: 0.0, regen: 0.5, expMult: 1.0 }
  },
  {
    id: "brock",
    name: "小剛 (Brock)",
    title: "深灰道館館主",
    sprite: "images/brock_01.png",
    cutin: "images/cutin_brock.png",
    sprites: {
      down: "images/brock_01.png",
      up: "images/brock_04.png",
      left: "images/brock_02.png",
      right: "images/brock_03.png"
    },
    cost: 200,
    skillName: "岩石壁壘",
    skillCd: 30,
    skillDuration: 5.0,
    desc: "召喚堅不可摧的岩石護盾，5 秒內受到傷害減少 50% 並免疫擊退！",
    bondName: "磐石守護",
    bondColor: "#D97706",
    bondPokemonIds: [74, 95, 111],
    bondPreviewIds: [74, 95, 111],
    mods: { dmgMult: 0.95, cdMult: 1.05, hpMult: 1.30, speedMult: 0.95, areaMult: 1.0, critBonus: 0.0, regen: 1.5, expMult: 1.0 }
  },
  {
    id: "serena",
    name: "莎莉娜 (Serena)",
    title: "卡洛斯表演家",
    sprite: "images/serena_01.png",
    cutin: "images/cutin_serena.png",
    sprites: {
      down: "images/serena_01.png",
      up: "images/serena_04.png",
      left: "images/serena_02.png",
      right: "images/serena_03.png"
    },
    cost: 350,
    skillName: "華麗雙打舞台",
    skillCd: 32,
    skillDuration: 5.5,
    desc: "開局直接召喚 1 隻雙打夥伴！主動發動時全夥伴大招冷卻立即重置！",
    bondName: "華麗羈絆",
    bondColor: "#F472B6",
    bondPokemonIds: [133, 4, 39],
    bondPreviewIds: [133, 4, 39],
    mods: { dmgMult: 1.0, cdMult: 1.0, hpMult: 1.0, speedMult: 1.05, areaMult: 1.0, critBonus: 0.05, regen: 0, expMult: 1.05, startPartner: true }
  },
  {
    id: "lillie",
    name: "莉莉艾 (Lillie)",
    title: "阿羅拉大小姐",
    sprite: "images/lillie_01.png",
    cutin: "images/cutin_lillie.png",
    sprites: {
      down: "images/lillie_01.png",
      up: "images/lillie_04.png",
      left: "images/lillie_02.png",
      right: "images/lillie_03.png"
    },
    cost: 450,
    skillName: "全滿傷藥＆淨化",
    skillCd: 35,
    skillDuration: 3.0,
    desc: "立即回覆 38% 最大 HP，淨化所有負面異常，並獲得 2 秒絕對無敵！",
    bondName: "星之祈願",
    bondColor: "#34D399",
    bondPokemonIds: [35, 133, 147],
    bondPreviewIds: [35, 133, 147],
    mods: { dmgMult: 0.95, cdMult: 0.95, hpMult: 1.15, speedMult: 1.0, areaMult: 1.0, critBonus: 0.0, regen: 2.0, expMult: 1.15 }
  },
  {
    id: "red",
    name: "赤紅 (Red)",
    title: "傳奇冠軍",
    sprite: "images/red_01.png",
    cutin: "images/cutin_red.png",
    sprites: {
      down: "images/red_01.png",
      up: "images/red_04.png",
      left: "images/red_02.png",
      right: "images/red_03.png"
    },
    cost: 1000,
    isHiddenRed: true,
    skillName: "王牌號令",
    skillCd: 26,
    skillDuration: 6.5,
    desc: "全屏爆發王牌威壓！自身全招式傷害+45%，暴擊率+30%！",
    bondName: "真新鎮傳奇",
    bondColor: "#EF4444",
    bondPokemonIds: [1, 4, 7, 25, 131, 143],
    bondPreviewIds: [1, 4, 7, 25, 131, 143],
    mods: { dmgMult: 1.25, cdMult: 0.88, hpMult: 1.15, speedMult: 1.10, areaMult: 1.20, critBonus: 0.15, regen: 1.0, expMult: 1.20 }
  }
];

// 8. 模式與難度考驗
const DIFFICULTIES = [
  { id: "casual", name: "輕鬆探索", badge: "休閒", desc: "怪獸血量減免，賞金獲取率 0.9x", hpMult: 0.80, atkMult: 0.75, spdMult: 0.90, spawnRateMult: 0.85, coinMult: 0.9, shinyBonus: 1.0 },
  { id: "normal", name: "關都標準", badge: "標準", desc: "標準 8 分鐘極速通關節奏", hpMult: 1.00, atkMult: 1.00, spdMult: 1.00, spawnRateMult: 1.00, coinMult: 1.0, shinyBonus: 1.0 },
  { id: "hard",   name: "大師挑戰", badge: "困難", desc: "怪潮密集洶湧，賞金+35%，閃光率翻倍！", hpMult: 1.40, atkMult: 1.30, spdMult: 1.12, spawnRateMult: 1.35, coinMult: 1.35, shinyBonus: 2.0 },
  { id: "hell",   name: "冠軍之巔", badge: "地獄", desc: "極致怪潮與霸體，賞金+80%，閃光率 3 倍！", hpMult: 1.95, atkMult: 1.65, spdMult: 1.25, spawnRateMult: 1.70, coinMult: 1.80, shinyBonus: 3.0 }
];

// 9. 寶可夢中心永久強化研究所
const CENTER_POKEMON_UPGRADES = [
  { id: "atk", name: "基礎攻擊力 (ATK)", maxLv: 5, baseCost: 150, sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/protein.png", desc: "所有招式基礎傷害提升 +8%" },
  { id: "cd",  name: "招式冷卻縮減 (CDR)", maxLv: 5, baseCost: 160, sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/carbos.png", desc: "所有招式冷卻時間縮短 -3.5%" },
  { id: "hp",  name: "最大體質生命 (HP)", maxLv: 5, baseCost: 140, sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/hp-up.png", desc: "出戰生命值提升 +12%，每秒回血 +0.4" },
  { id: "shiny", name: "閃光護符 (SHINY)", maxLv: 3, baseCost: 350, sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/shiny-charm.png", desc: "局內野生閃光怪遭遇率提升 +35%" }
];

const CENTER_TRAINER_UPGRADES = [
  { id: "fourthSlot", name: "解鎖第 4 招式槽", maxLv: 1, baseCost: 800, isSpecialSlot: true, sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/tm-case.png", desc: "出戰招式槽上限由 3 招擴充至 4 招！" },
  { id: "rerollCount", name: "戰術重擲 (REROLL)", maxLv: 5, baseCost: 180, sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-toy.png", desc: "升級三選一免費重抽次數每級 +1 次（免費次數用完後可消耗代幣繼續重抽）！" },
  { id: "trainerCd", name: "戰術指令靈犀", maxLv: 5, baseCost: 180, sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/soothe-bell.png", desc: "隨行訓練家大招冷卻縮減 -4%" },
  { id: "partner", name: "雙打羈絆共鳴", maxLv: 3, baseCost: 240, sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/destiny-knot.png", desc: "開局隨機召喚 1 隻夥伴，夥伴傷害+18%" },
  { id: "greed", name: "護身金幣 (COINS)", maxLv: 5, baseCost: 150, sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/amulet-coin.png", desc: "每局獲得代幣總量增加 +15%" }
];

// 10. 道館榮譽徽章與成就館
const ACHIEVEMENTS = [
  { id: "first_blood", name: "初出茅廬", desc: "擊退累計 100 隻野生寶可夢", reward: 150, check: (st) => st.totalKills >= 100 },
  { id: "hunter_500",  name: "精靈獵手", desc: "擊退累計 500 隻野生寶可夢", reward: 300, check: (st) => st.totalKills >= 500 },
  { id: "evo_master",  name: "進化之光", desc: "累計完成 5 次寶可夢戰鬥進化", reward: 250, check: (st) => st.evolutions >= 5 },
  { id: "super_move",  name: "極限突破", desc: "領悟並釋放 3 次究極超武技能", reward: 350, check: (st) => st.superMoves >= 3 },
  { id: "beat_birds",  name: "傳說落幕", desc: "擊敗 5 分鐘降臨的傳說三聖鳥", reward: 500, check: (st) => st.birdsDefeated >= 1 },
  { id: "beat_mewtwo", name: "終極宿命", desc: "擊退 7.5 分鐘王者超夢，解鎖【赤紅】", reward: 1000, check: (st) => st.mewtwoDefeated >= 1 },
  { id: "beat_mew",    name: "始祖夢幻", desc: "擊退終極隱藏 Boss 夢幻 #151", reward: 1500, check: (st) => st.mewDefeated >= 1 },
  { id: "dex_30",      name: "關都見習生", desc: "圖鑑登錄收服 30 隻寶可夢", reward: 300, check: (st, sv) => Object.keys(sv.pokedexCaught || {}).length >= 30 },
  { id: "dex_70",      name: "資深訓練家", desc: "圖鑑登錄收服 70 隻寶可夢", reward: 600, check: (st, sv) => Object.keys(sv.pokedexCaught || {}).length >= 70 }
];

// 11. 地面 Boss 戰利品
const MAP_BOSS_LOOTS = {
  evo_chest: { name: "黃金進化寶箱", color: "#F59E0B", sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/dusk-stone.png" },
  rare_candy: { name: "神奇糖果 (立即升級)", color: "#38BDF8", sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/rare-candy.png" },
  partner_ball: { name: "治癒球 (雙打召喚/升級)", color: "#EC4899", sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/heal-ball.png" },
  magnet: { name: "磁鐵 (吸取全屏水晶)", color: "#FACC15", sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/magnet.png" }
};

const ITEM_SPRITES = {
  coin: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/amulet-coin.png",
  rareCandy: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/rare-candy.png",
  starPiece: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/star-piece.png",
  protein: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/protein.png",
  hpUp: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/hp-up.png",
  carbos: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/carbos.png"
};

// 12. Sprite 快取載入器
const SpriteCache = {
  cache: new Map(),
  get(url) {
    if (!url) return null;
    if (this.cache.has(url)) return this.cache.get(url);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = url;
    const rec = { img, loaded: false, error: false };
    img.onload = () => { rec.loaded = true; };
    img.onerror = () => { rec.error = true; };
    this.cache.set(url, rec);
    return rec;
  }
};

// 13. GBA 8-bit 原生復古音效生成器
const SoundFX = {
  ctx: null,
  muted: false,
  bgmGain: null,
  sfxGain: null,
  currentTrack: null,
  currentSource: null,
  currentTrackGain: null,
  audioBuffers: {},
  fallbackTimer: null,

  // 音訊檔案路徑配置 (支援本地 audio/ 或 CDN 外部連結)
  bgmUrls: {
    lobby: "audio/lobby.mp3",
    pallet: "audio/stage_pallet.mp3",
    cerulean_bay: "audio/stage_cerulean.mp3",
    sky_pillar: "audio/stage_sky.mp3",
    boss: "audio/boss_battle.mp3",
    victory: "audio/victory.mp3"
  },

  init() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") {
        this.ctx.resume().catch(() => {});
      }
      return;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      this.ctx = new AudioCtx();
      this.bgmGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.bgmGain.connect(this.ctx.destination);
      this.sfxGain.connect(this.ctx.destination);
      this.bgmGain.gain.setValueAtTime(this.muted ? 0 : 0.35, this.ctx.currentTime);
      this.sfxGain.gain.setValueAtTime(this.muted ? 0 : 0.40, this.ctx.currentTime);
      if (this.ctx.state === "suspended") {
        this.ctx.resume().catch(() => {});
      }
    }
  },

  async preloadTrack(key, url) {
    if (!this.ctx || this.audioBuffers[key]) return;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        // 音訊資源尚未齊全時靜默略過，由 startFallbackBgm 自動無縫回退至 8-bit 原生合成音源
        return;
      }
      const arrayBuffer = await res.arrayBuffer();
      this.audioBuffers[key] = await this.ctx.decodeAudioData(arrayBuffer);
    } catch (e) {
      // 捕獲網路異常或音檔不存在，確保遊戲引擎不中斷運行
    }
  },

  playBgm(trackKey, loop = true) {
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    if (this.currentTrack === trackKey && this.currentSource) return;

    const now = this.ctx.currentTime;
    const fadeTime = 0.8;

    if (this.currentSource && this.currentTrackGain) {
      const oldSrc = this.currentSource;
      const oldGain = this.currentTrackGain;
      oldGain.gain.setValueAtTime(oldGain.gain.value, now);
      oldGain.gain.linearRampToValueAtTime(0.001, now + fadeTime);
      setTimeout(() => {
        try { oldSrc.stop(); } catch(e){}
      }, fadeTime * 1000);
      this.currentSource = null;
      this.currentTrackGain = null;
    }

    this.stopFallbackBgm();
    this.currentTrack = trackKey;

    const buffer = this.audioBuffers[trackKey];
    if (buffer) {
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = loop;

      const trackGain = this.ctx.createGain();
      trackGain.gain.setValueAtTime(0.001, now);
      trackGain.gain.linearRampToValueAtTime(0.35, now + fadeTime);

      source.connect(trackGain);
      trackGain.connect(this.bgmGain);

      source.start(0);
      this.currentSource = source;
      this.currentTrackGain = trackGain;
    } else {
      const url = this.bgmUrls[trackKey];
      if (url) {
        this.preloadTrack(trackKey, url).then(() => {
          if (this.currentTrack === trackKey && this.audioBuffers[trackKey]) {
            this.playBgm(trackKey, loop);
          }
        });
      }
      this.startFallbackBgm(trackKey);
    }
  },

  startBgm(mode = "battle") {
    let target = mode;
    if (mode === "battle") {
      target = (typeof GameApp !== "undefined" && GameApp.selectedStage) ? GameApp.selectedStage.id : "pallet";
    }
    this.playBgm(target, true);
  },

  stopBgm() {
    this.stopFallbackBgm();
    if (this.currentSource) {
      try { this.currentSource.stop(); } catch(e){}
      this.currentSource = null;
    }
    this.currentTrack = null;
  },

  startFallbackBgm(mode) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    this.stopFallbackBgm();

    const isBoss = mode === "boss";
    const isLobby = mode === "lobby";
    const bpm = isBoss ? 152 : (isLobby ? 112 : 136);
    const stepTime = 60 / bpm / 2;

    // 雙軌 16 拍 GameBoy 晶片音樂編曲 (主旋律 + 根音低音 Bassline)
    const battleLead = [
      329.63, 392.00, 440.00, 523.25, 493.88, 392.00, 329.63, 392.00,
      349.23, 440.00, 523.25, 587.33, 523.25, 493.88, 440.00, 392.00
    ];
    const battleBass = [
      130.81, 196.00, 130.81, 196.00, 164.81, 196.00, 164.81, 196.00,
      174.61, 220.00, 174.61, 220.00, 196.00, 246.94, 196.00, 146.83
    ];

    const bossLead = [
      220.00, 261.63, 246.94, 220.00, 329.63, 293.66, 261.63, 246.94,
      220.00, 261.63, 329.63, 349.23, 329.63, 293.66, 246.94, 196.00
    ];
    const bossBass = [
      110.00, 110.00, 123.47, 110.00, 130.81, 130.81, 123.47, 98.00,
      110.00, 110.00, 146.83, 146.83, 130.81, 123.47, 110.00, 98.00
    ];

    const lobbyLead = [
      392.00, 493.88, 587.33, 659.25, 587.33, 493.88, 392.00, 440.00,
      349.23, 440.00, 523.25, 587.33, 523.25, 440.00, 392.00, 329.63
    ];
    const lobbyBass = [
      196.00, 246.94, 293.66, 246.94, 164.81, 196.00, 246.94, 196.00,
      174.61, 220.00, 261.63, 220.00, 146.83, 196.00, 246.94, 196.00
    ];

    const notes = isBoss ? bossLead : (isLobby ? lobbyLead : battleLead);
    const bassNotes = isBoss ? bossBass : (isLobby ? lobbyBass : battleBass);
    let noteIdx = 0;

    this.fallbackTimer = setInterval(() => {
      if (this.muted || !this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        // 第一軌：主旋律 (Square / Sawtooth)
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.bgmGain);

        osc.type = isBoss ? "sawtooth" : (isLobby ? "triangle" : "square");
        osc.frequency.setValueAtTime(notes[noteIdx % notes.length], now);
        gain.gain.setValueAtTime(0.022, now);
        gain.gain.exponentialRampToValueAtTime(0.002, now + stepTime * 0.85);
        osc.start(now);
        osc.stop(now + stepTime * 0.9);

        // 第二軌：GBA 低音伴奏 (Triangle Bassline，每拍與偶數拍觸發)
        if (noteIdx % 2 === 0 || isBoss) {
          const bOsc = this.ctx.createOscillator();
          const bGain = this.ctx.createGain();
          bOsc.connect(bGain);
          bGain.connect(this.bgmGain);
          bOsc.type = "triangle";
          bOsc.frequency.setValueAtTime(bassNotes[noteIdx % bassNotes.length], now);
          bGain.gain.setValueAtTime(0.032, now);
          bGain.gain.exponentialRampToValueAtTime(0.003, now + stepTime * 1.4);
          bOsc.start(now);
          bOsc.stop(now + stepTime * 1.45);
        }

        noteIdx++;
      } catch (e) {}
    }, stepTime * 1000);
  },

  stopFallbackBgm() {
    if (this.fallbackTimer) {
      clearInterval(this.fallbackTimer);
      this.fallbackTimer = null;
    }
  },

  toggleMute() {
    this.muted = !this.muted;
    if (this.bgmGain && this.ctx) {
      this.bgmGain.gain.setValueAtTime(this.muted ? 0 : 0.35, this.ctx.currentTime);
      this.sfxGain.gain.setValueAtTime(this.muted ? 0 : 0.40, this.ctx.currentTime);
    }
    return this.muted;
  },

  lastHitTime: 0,

  play(type) {
    if (this.muted) return;
    if (type === "hit") {
      const perfNow = performance.now();
      if (perfNow - (this.lastHitTime || 0) < 40) return;
      this.lastHitTime = perfNow;
    }
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.sfxGain || this.ctx.destination);

      if (type === "hit") {
        osc.type = "sawtooth";
        const startFreq = 140 + (Math.random() - 0.5) * 30;
        const endFreq = Math.max(25, 40 + (Math.random() - 0.5) * 12);
        osc.frequency.setValueAtTime(startFreq, now);
        osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.08);
        gain.gain.setValueAtTime(0.16, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);
      } else if (type === "levelup") {
        osc.type = "square";
        osc.frequency.setValueAtTime(330, now);
        osc.frequency.setValueAtTime(440, now + 0.08);
        osc.frequency.setValueAtTime(554, now + 0.16);
        osc.frequency.setValueAtTime(660, now + 0.24);
        gain.gain.setValueAtTime(0.20, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.38);
        osc.start(now);
        osc.stop(now + 0.38);
      } else if (type === "super") {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.25);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.30);
        osc.start(now);
        osc.stop(now + 0.30);
      } else if (type === "ultimate") {
        osc.type = "square";
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(740, now + 0.35);
        gain.gain.setValueAtTime(0.28, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.45);
        osc.start(now);
        osc.stop(now + 0.45);
      } else if (type === "boss") {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(110, now);
        osc.frequency.exponentialRampToValueAtTime(55, now + 0.4);
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.45);
        osc.start(now);
        osc.stop(now + 0.45);
      } else if (type === "shiny") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.setValueAtTime(1320, now + 0.08);
        osc.frequency.setValueAtTime(1760, now + 0.16);
        gain.gain.setValueAtTime(0.22, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      }
    } catch (e) {}
  }
};

const TM_CATALOG = {
  Flamethrower: { id: "Flamethrower", tmNo: "TM35", name: "噴射火焰", type: "Fire", cost: 260, sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/tm-fire.png", desc: "朝身前噴吐直線貫穿高溫烈焰，造成高頻灼傷輸出。" },
  HydroPump:    { id: "HydroPump",    tmNo: "TM55", name: "水炮",     type: "Water", cost: 260, sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/tm-water.png", desc: "發射高壓衝擊水流，強力推開身前一整排敵人。" },
  Thunderbolt:  { id: "Thunderbolt",  tmNo: "TM24", name: "十萬伏特", type: "Electric", cost: 260, sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/tm-electric.png", desc: "向身周射出折射電弧鏈，牽制並麻痺分散的敵群。" },
  SeedBomb:     { id: "SeedBomb",     tmNo: "TM86", name: "種子炸彈", type: "Grass", cost: 240, sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/tm-grass.png", desc: "向目標區域投擲炸彈，爆裂造成大範圍草系重擊。" },
  IceBeam:      { id: "IceBeam",      tmNo: "TM13", name: "冷凍光線", type: "Ice", cost: 260, sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/tm-ice.png", desc: "發射直線極寒光束，具有極高機率完全凍結怪物。" },
  Earthquake:   { id: "Earthquake",   tmNo: "TM26", name: "地震",     type: "Ground", cost: 280, sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/tm-ground.png", desc: "猛力震裂地面，全屏地面目標浮空打擊（對飛行系無效）。" },
  ShadowBall:   { id: "ShadowBall",   tmNo: "TM30", name: "暗影球",   type: "Ghost", cost: 250, sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/tm-ghost.png", desc: "投擲凝聚暗影之球，可無視所有牆體與障礙穿透打擊。" },
  KarateChop:   { id: "KarateChop",   tmNo: "TM31", name: "空手劈",   type: "Fighting", cost: 240, sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/tm-fighting.png", desc: "連續極限重拳揮擊，近戰超高硬直與暴擊輸出。" },
  AirSlash:     { id: "AirSlash",     tmNo: "TM40", name: "空氣斬",   type: "Flying", cost: 250, sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/tm-flying.png", desc: "雙翼斬出迴旋風刃，擊退身前逼近的飛行怪與鳥群。" },
  SludgeBomb:   { id: "SludgeBomb",   tmNo: "TM36", name: "污泥炸彈", type: "Poison", cost: 250, sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/tm-poison.png", desc: "投擲劇毒泥沼，踏入泥沼之敵全體陷入劇毒持續扣血。" }
};

// 一階先發精靈天生三招階梯表 (起手 ➔ 中程牽制 ➔ 領域爆發)
const POKEMON_NATURAL_SKILLS = {
  1:   { name: "妙蛙種子", skills: ["VineWhip", "SeedBomb", "SludgeBomb"] },
  4:   { name: "小火龍",   skills: ["Ember", "Flamethrower", "DragonRush"] },
  7:   { name: "傑尼龜",   skills: ["WaterGun", "HydroPump", "IceBeam"] },
  10:  { name: "綠毛蟲",   skills: ["Tackle", "SeedBomb", "AirSlash"] },
  13:  { name: "獨角蟲",   skills: ["Tackle", "SludgeBomb", "SeedBomb"] },
  16:  { name: "波波",     skills: ["AirSlash", "Tackle", "DragonRush"] },
  25:  { name: "皮卡丘",   skills: ["Thunderbolt", "Tackle", "AirSlash"] },
  132: { name: "百變怪",   skills: ["Metronome", "Tackle", "Psystrike"] },
  133: { name: "伊布",     skills: ["Tackle", "AirSlash", "Metronome"] }, // 撞擊 + 電光風刃 + 天命揮指
  143: { name: "卡比獸",   skills: ["Tackle", "Earthquake", "KarateChop"] },
  147: { name: "迷你龍",   skills: ["DragonRush", "Thunderbolt", "IceBeam"] }
};

// 根據屬性對應的代表招式池（供全 151 圖鑑動態推導天生三招）
const TYPE_SKILL_POOLS = {
  Grass:    ["VineWhip", "SeedBomb", "SludgeBomb"],
  Fire:     ["Ember", "Flamethrower", "DragonRush"],
  Water:    ["WaterGun", "HydroPump", "IceBeam"],
  Electric: ["Thunderbolt", "AirSlash", "Tackle"],
  Ice:      ["IceBeam", "WaterGun", "HydroPump"],
  Fighting: ["KarateChop", "Earthquake", "Tackle"],
  Poison:   ["SludgeBomb", "ShadowBall", "SeedBomb"],
  Ground:   ["Earthquake", "KarateChop", "Tackle"],
  Flying:   ["AirSlash", "DragonRush", "Tackle"],
  Psychic:  ["Psystrike", "Moonblast", "ShadowBall"],
  Bug:      ["SeedBomb", "SludgeBomb", "AirSlash"],
  Rock:     ["Earthquake", "KarateChop", "Tackle"],
  Ghost:    ["ShadowBall", "SludgeBomb", "Psystrike"],
  Dragon:   ["DragonRush", "Flamethrower", "Thunderbolt"],
  Steel:    ["Thunderbolt", "Earthquake", "Tackle"],
  Normal:   ["Tackle", "AirSlash", "Earthquake"]
};

function getNaturalSkillsForPokemon(pokeData) {
  if (!pokeData) return ["Tackle", "AirSlash", "Earthquake"];
  if (POKEMON_NATURAL_SKILLS[pokeData.id]) {
    return [...POKEMON_NATURAL_SKILLS[pokeData.id].skills];
  }
  const result = [];
  const addUnique = (skId) => {
    if (!skId) return;
    const clean = skId.replace(/\s+/g, '');
    if (SKILLS_CATALOG[clean] && !result.includes(clean)) {
      result.push(clean);
    }
  };
  // 1. 優先放入圖鑑預設主招式
  addUnique(pokeData.skill);
  // 2. 放入第一屬性代表招式
  (TYPE_SKILL_POOLS[pokeData.type1] || []).forEach(s => { if (result.length < 3) addUnique(s); });
  // 3. 放入第二屬性代表招式
  if (pokeData.type2 && pokeData.type2 !== "None") {
    (TYPE_SKILL_POOLS[pokeData.type2] || []).forEach(s => { if (result.length < 3) addUnique(s); });
  }
  // 4. 兜底補齊至 3 招
  ["Tackle", "AirSlash", "Earthquake"].forEach(s => { if (result.length < 3) addUnique(s); });
  return result;
}

// 伊布進化時的三系本系替換表 (第一招直接替換為代表屬性大招，繼承原本升高的招式等級！)
const EEVEE_EVO_SKILLS = {
  134: ["HydroPump", "IceBeam", "Tackle"],       // 水伊布：第一招直接變水炮！
  135: ["Thunderbolt", "AirSlash", "Tackle"],    // 雷伊布：第一招直接變十萬伏特！
  136: ["Flamethrower", "DragonRush", "Tackle"]  // 火伊布：第一招直接變噴射火焰！
};
// 友好商店多元化道具庫 (TM 學習機、PP 提升劑、傷藥與戰鬥增益)
const MART_SPECIAL_ITEMS = {
  pp_up: {
    id: "pp_up",
    name: "PP 提升劑",
    type: "item",
    cost: 180,
    sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/pp-up.png",
    desc: "立即隨機提升當前一項已學會招式的等級 +1！"
  },
  full_restore: {
    id: "full_restore",
    name: "全滿傷藥",
    type: "item",
    cost: 120,
    sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/full-restore.png",
    desc: "立即恢復 45% 最大生命值，並完全淨化身上所有異常狀態！"
  },
  x_attack: {
    id: "x_attack",
    name: "力量強化 (X Attack)",
    type: "buff",
    cost: 110,
    sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/x-attack.png",
    desc: "30 秒內全招式傷害提升 +35%，伴隨戰意金光！"
  },
  x_speed: {
    id: "x_speed",
    name: "速度強化 (X Speed)",
    type: "buff",
    cost: 90,
    sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/x-speed.png",
    desc: "30 秒內移動速度提升 +30%，且踏入涉水/泥沼完全免疫減速！"
  },
  master_candy: {
    id: "master_candy",
    name: "極限神奇糖果",
    type: "item",
    cost: 360,
    sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/rare-candy.png",
    desc: "【高階補給】立即將一項未滿級招式連升 +2 級，並回復 30% HP！"
  },
  mystery_held: {
    id: "mystery_held",
    name: "秘傳攜帶物禮盒",
    type: "item",
    cost: 380,
    sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/EXP-share.png",
    desc: "【高階補給】立即隨機獲得一件對應當前已學招式的超武攜帶物！"
  }
};
