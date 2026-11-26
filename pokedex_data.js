/**
 * ============================================================================
 * pokedex_data.js
 * 關都地區 151 全圖鑑、屬性相剋、超武突破配方、攜帶物戰術詞綴、
 * 怪獸體重擊退抗性階級、Boss 多重攻擊模式資料庫
 * ============================================================================
 */

// 1. 屬性視覺與異常狀態設定
const TYPE_COLORS = {
  Normal: "#64748B", Fire: "#E74C3C", Water: "#2980B9", Grass: "#27AE60",
  Electric: "#D4AC0D", Ice: "#38B2A6", Fighting: "#B91C1C", Poison: "#8E44AD",
  Ground: "#D35400", Flying: "#5B6ABF", Psychic: "#D81B60", Bug: "#689F38",
  Rock: "#6D4C41", Ghost: "#6B21A8", Dragon: "#4338CA", Steel: "#546E7A"
};

const TYPE_NAMES_ZH = {
  Normal: "一般", Fire: "火", Water: "水", Grass: "草", Electric: "電",
  Ice: "冰", Fighting: "格鬥", Poison: "毒", Ground: "地面", Flying: "飛行",
  Psychic: "超能", Bug: "蟲", Rock: "岩石", Ghost: "幽靈", Dragon: "龍", Steel: "鋼"
};

const TYPE_META = {
  Fire: { color: "#EF4444", status: "Burn", statusRate: 0.16 },
  Water: { color: "#38BDF8", status: null, statusRate: 0 },
  Grass: { color: "#22C55E", status: null, statusRate: 0 },
  Electric: { color: "#FACC15", status: "Paralysis", statusRate: 0.12 },
  Ice: { color: "#67E8F9", status: "Freeze", statusRate: 0.10 },
  Poison: { color: "#A855F7", status: "Poison", statusRate: 0.20 },
  Psychic: { color: "#EC4899", status: "Confusion", statusRate: 0.11 },
  Ground: { color: "#D97706", status: null, statusRate: 0 },
  Fighting: { color: "#B91C1C", status: null, statusRate: 0 },
  Flying: { color: "#818CF8", status: null, statusRate: 0 },
  Bug: { color: "#84CC16", status: null, statusRate: 0 },
  Rock: { color: "#78350F", status: null, statusRate: 0 },
  Ghost: { color: "#6B21A8", status: "Confusion", statusRate: 0.11 },
  Dragon: { color: "#4338CA", status: null, statusRate: 0 },
  Normal: { color: "#94A3B8", status: null, statusRate: 0 }
};

// 屬性相剋倍率表 (攻方 -> 守方)
const TYPE_CHART = {
  Fire:     { Grass: 1.5, Ice: 1.5, Bug: 1.5, Steel: 1.5, Water: 0.65, Fire: 0.65, Rock: 0.65, Dragon: 0.65 },
  Water:    { Fire: 1.5, Ground: 1.5, Rock: 1.5, Water: 0.65, Grass: 0.65, Dragon: 0.65 },
  Grass:    { Water: 1.5, Ground: 1.5, Rock: 1.5, Fire: 0.65, Grass: 0.65, Poison: 0.65, Flying: 0.65, Bug: 0.65, Dragon: 0.65 },
  Electric: { Water: 1.5, Flying: 1.5, Electric: 0.65, Grass: 0.65, Dragon: 0.65, Ground: 0.35 },
  Ice:      { Grass: 1.5, Ground: 1.5, Flying: 1.5, Dragon: 1.5, Fire: 0.65, Water: 0.65, Ice: 0.65 },
  Fighting: { Normal: 1.5, Ice: 1.5, Rock: 1.5, Steel: 1.5, Poison: 0.65, Flying: 0.65, Psychic: 0.65, Bug: 0.65, Ghost: 0.35 },
  Poison:   { Grass: 1.5, Poison: 0.65, Ground: 0.65, Rock: 0.65, Ghost: 0.65, Steel: 0.35 },
  Ground:   { Fire: 1.5, Electric: 1.5, Poison: 1.5, Rock: 1.5, Steel: 1.5, Grass: 0.65, Bug: 0.65, Flying: 0.35 },
  Flying:   { Grass: 1.5, Fighting: 1.5, Bug: 1.5, Electric: 0.65, Rock: 0.65, Steel: 0.65 },
  Psychic:  { Fighting: 1.5, Poison: 1.5, Psychic: 0.65, Steel: 0.65 },
  Bug:      { Grass: 1.5, Psychic: 1.5, Fire: 0.65, Fighting: 0.65, Poison: 0.65, Flying: 0.65, Ghost: 0.65, Steel: 0.65 },
  Rock:     { Fire: 1.5, Ice: 1.5, Flying: 1.5, Bug: 1.5, Fighting: 0.65, Ground: 0.65, Steel: 0.65 },
  Ghost:    { Psychic: 1.5, Ghost: 1.5, Normal: 0.35 },
  Dragon:   { Dragon: 1.5, Steel: 0.65 },
  Normal:   { Rock: 0.65, Steel: 0.65, Ghost: 0.35 }
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
  if (!status || !target || !target.data) return true;
  const t1 = target.data.type1, t2 = target.data.type2;
  if (status === "Burn" && (t1 === "Fire" || t2 === "Fire")) return true;
  if (status === "Poison" && (t1 === "Poison" || t2 === "Poison" || t1 === "Steel" || t2 === "Steel")) return true;
  if (status === "Freeze" && (t1 === "Ice" || t2 === "Ice")) return true;
  if (status === "Paralysis" && (t1 === "Electric" || t2 === "Electric" || t1 === "Ghost" || t2 === "Ghost" || t1 === "Ground" || t2 === "Ground")) return true;
  return false;
}

function renderTypeBadgeHTML(type) {
  if (!type || type === "None") return "";
  const bg = TYPE_COLORS[type] || "#64748B";
  const zh = TYPE_NAMES_ZH[type] || type;
  return `<span style="background-color:${bg}; text-shadow: 0 1px 2px rgba(0,0,0,0.85);" class="px-1.5 py-0.2 text-[8px] font-black text-white rounded border border-black/30 shadow-sm whitespace-nowrap inline-block leading-tight mx-0.5">${zh}</span>`;
}

// 2. 招式資料庫 (已優化 iPhone 擊退抗性 knockback)
const SKILLS_CATALOG = {
      VineWhip: {
    id: "VineWhip", name: "藤鞭", type: "Grass", baseDmg: 28, baseCd: 0.75, ultMinCd: 3.6, ultPowerBonus: 1.0,
    knockback: 6, isMelee: true, meleeStyle: "vine_whip", reqItem: "miracle_seed",
    evolvedName: "瘋狂植物", color: "#15803D",
    sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/miracle-seed.png",
    desc: "甩動帶刺S型雙層藤蔓，兩側生出嫩芽，末端音爆鞭笞身前敵人！",
    evoDesc: "【終極超武】全場破土生長嗜血荊棘藤蔓，命中回覆自身 8% 生命！"
  },
  RazorLeaf: {
    id: "Razor Leaf", name: "飛葉快刀", type: "Grass", baseDmg: 29, baseCd: 0.88, ultMinCd: 3.6, ultPowerBonus: 1.08,
    knockback: 6, isMelee: false, vfx: "leaf_blade", reqItem: "miracle_seed",
    evolvedName: "瘋狂植物", color: "#22C55E",
    sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/miracle-seed.png",
    desc: "射出高速自轉的修長柳葉刀片，穿透敵群並附帶高暴擊率！",
    evoDesc: "【終極超武】全場破土生長嗜血荊棘藤蔓，命中回覆自身 8% 生命！"
  },
  BulletSeed: {
    id: "Bullet Seed", name: "種子機關槍", type: "Grass", baseDmg: 16, baseCd: 0.92, ultMinCd: 3.6, ultPowerBonus: 1.08,
    knockback: 3, isMelee: false, vfx: "bullet_seed", reqItem: "miracle_seed",
    evolvedName: "瘋狂植物", color: "#84CC16",
    sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/miracle-seed.png",
    desc: "如衝鋒槍般高速連射 4～6 顆黃金流光種子彈，密集壓制並爆出嫩芽！",
    evoDesc: "【終極超武】全場破土生長嗜血荊棘藤蔓，命中回覆自身 8% 生命！"
  },
Ember: {
    id: "Ember", name: "火花", type: "Fire", baseDmg: 22, baseCd: 0.78, ultMinCd: 3.5, ultPowerBonus: 1.0,
    knockback: 0, isMelee: false, vfx: "ember_spark", reqItem: "charcoal",
    evolvedName: "大字爆炎", color: "#F97316",
    sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/charcoal.png",
    desc: "向身前廣角扇面噴吐 2～4 團跳動火花，短射程高頻壓制並引發灼傷！",
    evoDesc: "【終極超武】向八方推進高溫立體『大』字烈焰，留下炙熱焦土持續灼燒！"
  },
  WaterGun: {
    id: "WaterGun", name: "水槍", type: "Water", baseDmg: 26, baseCd: 0.90, ultMinCd: 3.4, ultPowerBonus: 1.0,
    knockback: 8, isMelee: false, vfx: "water_gun", reqItem: "mystic_water",
    evolvedName: "潮旋激流", color: "#38BDF8",
    sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/mystic-water.png",
    desc: "射出輕型高壓水流束，穿透身前小群敵人並產生推阻。",
    evoDesc: "【終極超武】於周身展開深海大漩渦持續捲吸並強力擊退敵陣！"
  },
  Tackle: {
    id: "Tackle", name: "撞擊", type: "Normal", baseDmg: 26, baseCd: 1.02, ultMinCd: 2.6, ultPowerBonus: 1.05,
    knockback: 20, isMelee: true, meleeStyle: "slam_wave", reqItem: "silk_scarf",
    evolvedName: "終極衝擊", color: "#CBD5E1",
    sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/silk-scarf.png",
    desc: "向身前猛烈撲擊並強力撞退敵群（零位移干擾走位），升級解鎖二段與三段連環破空震波！",
    evoDesc: "【終極超武】爆發四向黃金螺旋衝擊錐與動能月牙波，造成毀滅性擊退重創！"
  },
  Flamethrower: {
    id: "Flamethrower", name: "噴射火焰", type: "Fire", baseDmg: 32, baseCd: 1.15, ultMinCd: 3.5, ultPowerBonus: 1.15,
    knockback: 0, isMelee: false, vfx: "fire_stream", reqItem: "charcoal",
    evolvedName: "大字爆炎", color: "#EF4444",
    sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/charcoal.png",
    desc: "從口中噴出連續錐形高溫烈焰流，持續兩段灼燒整片扇形敵群，升級大幅拓寬烈焰寬度與射程！",
    evoDesc: "【終極超武】向八方推進高溫立體『大』字烈焰，留下炙熱焦土持續灼燒！"
  },
  HydroPump: {
    id: "Hydro Pump", name: "水炮", type: "Water", baseDmg: 38, baseCd: 1.45, ultMinCd: 3.4, ultPowerBonus: 1.18,
    knockback: 16, isMelee: false, vfx: "water_beam", reqItem: "mystic_water",
    evolvedName: "潮旋激流", color: "#38BDF8",
    sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/mystic-water.png",
    desc: "從炮口射出貫穿式高壓螺旋水柱，持續兩段沖刷並強力擊退整排敵群，Lv.4 雙炮齊射、Lv.8 超壓加粗（水箭龜專屬雙肩平行重炮）！",
    evoDesc: "【終極超武】於周身展開深海大漩渦持續捲吸並強力擊退敵陣！"
  },
  SeedBomb: {
    id: "Seed Bomb", name: "種子炸彈", type: "Grass", baseDmg: 30, baseCd: 1.15, ultMinCd: 3.6, ultPowerBonus: 1.15,
    knockback: 10, isMelee: false, vfx: "seed_nut", reqItem: "miracle_seed",
    evolvedName: "瘋狂植物", color: "#65A30D",
    sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/miracle-seed.png",
    desc: "高拋物理拋物線木紋橡子，越過前排轟炸怪群並爆開碎殼與孢子毒霧！",
    evoDesc: "【終極超武】全場破土生長嗜血荊棘藤蔓，命中回覆自身 8% 生命！"
  },
  Thunderbolt: {
    id: "Thunderbolt", name: "十萬伏特", type: "Electric", baseDmg: 34, baseCd: 1.10, ultMinCd: 3.2, ultPowerBonus: 1.10,
    knockback: 2, isMelee: false, vfx: "lightning_chain", reqItem: "magnet",
    evolvedName: "打雷暴風雨", color: "#FACC15",
    sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/magnet.png",
    desc: "釋放金白高頻電漿鏈，無擊退，極致電擊麻痺。",
    evoDesc: "【終極超武】召喚 6 道高壓萬鈞天罰雷柱錯落轟炸並強力麻痺敵陣！"
  },
  ShadowBall: {
    id: "Shadow Ball", name: "暗影球", type: "Ghost", baseDmg: 30, baseCd: 1.05, ultMinCd: 3.6, ultPowerBonus: 1.10,
    knockback: 0, isMelee: false, vfx: "shadow_orb", reqItem: "spell_tag",
    evolvedName: "暗影死滅波", color: "#A855F7",
    sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/spell-tag.png",
    desc: "凝縮幽靈黑核射線，純穿透打擊，無擊退。",
    evoDesc: "【終極超武】腳下浮現冥界陣紋並放出 6 隻惡靈鬼影奔襲撕咬，附帶混亂！"
  },
  Psystrike: {
    id: "Psystrike", name: "精神擊破", type: "Psychic", baseDmg: 36, baseCd: 1.25, ultMinCd: 3.8, ultPowerBonus: 1.12,
    knockback: 0, isMelee: false, vfx: "psychic_lance", reqItem: "twisted_spoon",
    evolvedName: "精神強念領域", color: "#EC4899",
    sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/twisted-spoon.png",
    desc: "高壓念力實體穿刺，無擊退，精準索敵。",
    evoDesc: "【終極超武】展開引力超能黑洞牽引敵群，並齊射 6 道穿透念力梭！"
  },
  IceBeam: {
    id: "Ice Beam", name: "冷凍光線", type: "Ice", baseDmg: 30, baseCd: 1.15, ultMinCd: 4.8, ultPowerBonus: 1.08,
    knockback: 4, isMelee: false, vfx: "frost_beam", reqItem: "never_melt_ice",
    evolvedName: "絕對零度", color: "#67E8F9",
    sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/never-melt-ice.png",
    desc: "瞬間貫穿整條直線的經典 GBA 折線極寒雷射，末端引發六角冰霜爆破並高機率凍結敵群！",
    evoDesc: "【終極超武】展開廣域極光絕對零度領域凍結敵群，並引發二段碎冰巨爆！"
  },
  Earthquake: {
    id: "Earthquake", name: "地震", type: "Ground", baseDmg: 40, baseCd: 1.65, ultMinCd: 3.8, ultPowerBonus: 1.15,
    knockback: 28, isMelee: true, meleeStyle: "quake_wave", reqItem: "soft_sand",
    evolvedName: "地裂斷層破", color: "#D97706",
    sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/soft-sand.png",
    desc: "重踏地面激發環形地震波，大範圍強烈擊退。",
    evoDesc: "【終極超武】瞬間撕開網狀深淵熔岩裂谷，崩裂飛石對空重創飛行系並造成粉碎重擊！"
  },
  KarateChop: {
    id: "Karate Chop", name: "空手劈", type: "Fighting", baseDmg: 26, baseCd: 0.85, ultMinCd: 3.0, ultPowerBonus: 1.15,
    knockback: 14, isMelee: true, meleeStyle: "martial_fist", reqItem: "black_belt",
    evolvedName: "爆裂十字劈", color: "#B91C1C",
    sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/black-belt.png",
    desc: "單軸高速連環拳單點突破！前段快拳釘住目標，尾拳放大重擊貫穿，每級提升出拳距離！",
    evoDesc: "【終極超武】身周爆發阿修羅百裂拳網，並鎖定敵陣降下巨型白熾「X 十字天譴破甲斬」與 1.8s 武神霸體陣！"
  },
  AirSlash: {
    id: "Air Slash", name: "空氣斬", type: "Flying", baseDmg: 28, baseCd: 0.95, ultMinCd: 4.2, ultPowerBonus: 1.05,
    knockback: 6, isMelee: false, vfx: "wind_blade", reqItem: "sharp_beak",
    evolvedName: "暴風驟雨", color: "#818CF8",
    sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/sharp-beak.png",
    desc: "快速斬出高頻風刃，微弱擊退。",
    evoDesc: "【終極超武】召喚 3 道穿透暴風龍捲風巡航戰場，將沿途敵人扯入風眼！"
  },
  SludgeBomb: {
    id: "Sludge Bomb", name: "污泥炸彈", type: "Poison", baseDmg: 30, baseCd: 1.15, ultMinCd: 4.6, ultPowerBonus: 1.08,
    knockback: 4, isMelee: false, vfx: "sludge_ball", reqItem: "poison_barb",
    evolvedName: "劇毒沼澤", color: "#9333EA",
    sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poison-barb.png",
    desc: "投擲劇毒泥漿塊，微擊退，附帶高概率中毒。",
    evoDesc: "【終極超武】展開廣域劇毒腐蝕沼澤，大幅加速圈內敵人中毒扣血！"
  },
  Moonblast: {
    id: "Moonblast", name: "月亮之力", type: "Psychic", baseDmg: 34, baseCd: 1.45, ultMinCd: 3.8, ultPowerBonus: 1.10,
    knockback: 0, isMelee: false, vfx: "moon_blast", reqItem: "twisted_spoon",
    evolvedName: "創世極光", color: "#F472B6",
    sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/twisted-spoon.png",
    desc: "汲取月光引力光球，無擊退，具備索敵追蹤能力。",
    evoDesc: "【終極超武】降下廣域神聖月華極光天幕洗禮戰場，大幅削弱敵人攻擊力！"
  },
  DragonRush: {
    id: "Dragon Rush", name: "龍之俯衝", type: "Dragon", baseDmg: 44, baseCd: 1.55, ultMinCd: 3.6, ultPowerBonus: 1.15,
    knockback: 24, isMelee: true, meleeStyle: "claw_slash", reqItem: "dragon_scale",
    evolvedName: "天龍流星雨", color: "#4338CA",
    sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/dragon-scale.png",
    desc: "釋放殺氣騰空俯衝，造成範圍擊退與高額物理爆發。",
    evoDesc: "【終極超武】從九天召喚無數燃燒龍系流星砸碎地面！"
  },
  Metronome: {
    id: "Metronome", name: "揮指功", type: "Normal", baseDmg: 30, baseCd: 1.30, ultMinCd: 3.8, ultPowerBonus: 1.0,
    knockback: 8, isMelee: false, vfx: "star_shot", reqItem: "silk_scarf",
    evolvedName: "天命百寶袋", color: "#F59E0B",
    sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/metronome.png",
    desc: "隨機搖出全圖鑑任意強力攻擊招式！",
    evoDesc: "【終極超武】全場隨機觸發三重不同屬性超武同時轟炸！"
  },
  // v7.5.6 重構 5 大屬性補完招式（岩／蟲／毒／電／幽靈）
  RockSlide: {
    id: "RockSlide", name: "岩崩", type: "Rock", baseDmg: 36, baseCd: 1.52, ultMinCd: 3.6, ultPowerBonus: 1.08,
    knockback: 18, isMelee: false, vfx: "rock_slide", reqItem: "soft_sand",
    evolvedName: "大陸板塊崩落", color: "#D97706",
    extraIconCol: 0, svgIcon: "rock",
    desc: "鎖定敵群預警落點，連續砸下 3～5 顆稜角巨岩與碎石震波，造成強擊退重擊！",
    evoDesc: "【終極超武】震裂熔岩十字斷層，天降暖金巨岩尖碑並四散 8 顆滾石碾壓！"
  },
  XScissor: {
    id: "XScissor", name: "十字剪", type: "Bug", baseDmg: 32, baseCd: 1.05, ultMinCd: 3.2, ultPowerBonus: 1.08,
    knockback: 10, isMelee: true, meleeStyle: "x_scissor", reqItem: "poison_barb",
    evolvedName: "終極十字星斬", color: "#84CC16",
    extraIconCol: 1, svgIcon: "bug",
    desc: "雙鐮高速交錯斬出翡翠彎月十字刃，附帶 +15% 暴擊率與兩段破甲切割！",
    evoDesc: "【終極超武】化作高速自轉的翡翠金十字星手裡劍巨輪跟隨切碎敵群，收尾爆出八向劍氣！"
  },
  PoisonJab: {
    id: "PoisonJab", name: "毒擊", type: "Poison", baseDmg: 27, baseCd: 1.04, ultMinCd: 3.3, ultPowerBonus: 1.06,
    knockback: 5, isMelee: false, vfx: "poison_jab", reqItem: "poison_barb",
    evolvedName: "劇毒新星", color: "#A855F7",
    extraIconCol: 2, svgIcon: "poison",
    desc: "扇形連射貫穿毒矛；命中已中毒敵人觸發 +40% 毒爆並將中毒傳染周圍敵群！",
    evoDesc: "【終極超武】凝聚紫綠毒晶核雙波螺旋齊射 16 根劇毒骨矛，插地化作結晶毒刺陣爆毒！"
  },
  ElectroBall: {
    id: "ElectroBall", name: "電球", type: "Electric", baseDmg: 31, baseCd: 1.24, ultMinCd: 3.4, ultPowerBonus: 1.06,
    knockback: 6, isMelee: false, vfx: "electro_orb", reqItem: "magnet",
    evolvedName: "超載磁暴球", color: "#FACC15",
    extraIconCol: 3, svgIcon: "electric",
    desc: "高壓等離子球推進，移速越快球越大且最高增傷 +35%，飛行中自動抽射電弧！",
    evoDesc: "【終極超武】召喚 3 顆藍白高壓電磁衛星繞身公轉，構成旋轉三角形閃電牢籠持續麻痺！"
  },
  ShadowClaw: {
    id: "ShadowClaw", name: "暗影爪", type: "Ghost", baseDmg: 34, baseCd: 1.10, ultMinCd: 3.3, ultPowerBonus: 1.08,
    knockback: 9, isMelee: true, meleeStyle: "shadow_claw", reqItem: "spell_tag",
    evolvedName: "冥界裂空爪", color: "#9333EA",
    extraIconCol: 4, svgIcon: "ghost",
    desc: "撕開三道紫紅幽靈爪痕橫掃，天生 +25% 暴擊（Mega 耿鬼享猩紅冥火 +35% 暴擊）！",
    evoDesc: "【終極超武】張開暗紫空間裂縫黑洞，雙巨爪由兩側合掌撕裂抓握聚怪並引爆處決！"
  }
};

const SKILL_ICON_SHEET_URL = "images/skills_icons_sheet.png";
const SKILL_ICON_GRID = {
  VineWhip:     [0, 0],
  RazorLeaf:    [1, 0],
  BulletSeed:   [2, 0],
  SeedBomb:     [3, 0],
  Ember:        [4, 0],
  Flamethrower: [0, 1],
  WaterGun:     [1, 1],
  HydroPump:    [2, 1],
  Thunderbolt:  [3, 1],
  IceBeam:      [4, 1],
  Tackle:       [0, 2],
  KarateChop:   [1, 2],
  Earthquake:   [2, 2],
  AirSlash:     [3, 2],
  SludgeBomb:   [4, 2],
  ShadowBall:   [0, 3],
  Psystrike:    [1, 3],
  Moonblast:    [2, 3],
  DragonRush:   [3, 3],
  Metronome:    [4, 3]
};

Object.values(SKILLS_CATALOG).forEach(sk => {
  const cleanKey = sk.id.replace(/\s+/g, '');
  if (SKILL_ICON_GRID[cleanKey]) {
    sk.iconCol = SKILL_ICON_GRID[cleanKey][0];
    sk.iconRow = SKILL_ICON_GRID[cleanKey][1];
  }
  SKILLS_CATALOG[sk.id] = sk;
  SKILLS_CATALOG[cleanKey] = sk;
});

function renderSkillIconHTML(skillOrId, sizeClass = "w-4 h-4") {
  const meta = typeof skillOrId === "string"
    ? (SKILLS_CATALOG[skillOrId] || SKILLS_CATALOG[skillOrId.replace(/\s+/g, '')])
    : skillOrId;
  if (!meta) return "";
  if (meta.iconCol !== undefined && meta.iconRow !== undefined) {
    const posX = (meta.iconCol * 25).toFixed(4);
    const posY = (meta.iconRow * (100 / 3)).toFixed(4);
    return `<span class="skill-sheet-icon ${sizeClass} inline-block shrink-0" style="background-position: ${posX}% ${posY}%;" title="${meta.name || ''}"></span>`;
  }
  if (meta.extraIconCol !== undefined) {
    const posX = (meta.extraIconCol * 25).toFixed(4);
    return `<span class="skill-sheet-icon-extra ${sizeClass} inline-block shrink-0" style="background-position: ${posX}% 0%;" title="${meta.name || ''}"></span>`;
  }
  if (meta.svgIcon) {
    const svgMap = {
      rock: `<svg viewBox="0 0 24 24" class="w-full h-full"><rect width="24" height="24" rx="5" fill="#451A03" stroke="#D97706" stroke-width="2"/><polygon points="5,18 9,8 16,7 20,17 13,20" fill="#B45309" stroke="#FEF3C7" stroke-width="1.3"/><polygon points="9,8 13,13 16,7" fill="#F59E0B"/></svg>`,
      bug: `<svg viewBox="0 0 24 24" class="w-full h-full"><rect width="24" height="24" rx="5" fill="#1A2E05" stroke="#84CC16" stroke-width="2"/><path d="M5 5 L19 19 M19 5 L5 19" stroke="#BEF264" stroke-width="3.2" stroke-linecap="round"/><path d="M5 5 L19 19 M19 5 L5 19" stroke="#FFFFFF" stroke-width="1.2" stroke-linecap="round"/></svg>`,
      poison: `<svg viewBox="0 0 24 24" class="w-full h-full"><rect width="24" height="24" rx="5" fill="#3B0764" stroke="#C084FC" stroke-width="2"/><path d="M12 4 L17 14 L12 20 L7 14 Z" fill="#A855F7" stroke="#F3E8FF" stroke-width="1.4"/><circle cx="12" cy="13" r="2.2" fill="#4ADE80"/></svg>`,
      electric: `<svg viewBox="0 0 24 24" class="w-full h-full"><rect width="24" height="24" rx="5" fill="#422006" stroke="#FACC15" stroke-width="2"/><circle cx="12" cy="12" r="6.5" fill="#FACC15" stroke="#FEF9C3" stroke-width="1.5"/><path d="M13 6 L8.5 12.5 H12 L11 18 L15.5 11.5 H12 Z" fill="#FFFFFF"/></svg>`,
      ghost: `<svg viewBox="0 0 24 24" class="w-full h-full"><rect width="24" height="24" rx="5" fill="#2E1065" stroke="#A855F7" stroke-width="2"/><path d="M5 7 Q12 4 19 8 M4 12 Q12 9 20 13 M6 17 Q12 15 18 18" fill="none" stroke="#E879F9" stroke-width="2.4" stroke-linecap="round"/></svg>`
    };
    const svg = svgMap[meta.svgIcon] || "";
    if (svg) return `<span class="${sizeClass} inline-flex items-center justify-center shrink-0" title="${meta.name || ''}">${svg}</span>`;
  }
  return meta.sprite ? `<img src="${meta.sprite}" class="${sizeClass} pixel-sprite object-contain shrink-0" alt="${meta.name || ''}"/>` : "";
}

function getSkillNextLevelBonusDesc(skillId, nextLv) {
  // 相容舊呼叫格式 getSkillNextLevelBonusDesc(nextLv)
  if (typeof skillId === "number") {
    nextLv = skillId;
    skillId = "";
  }
  const cleanId = (skillId || "").replace(/\s+/g, "");
  const meta = SKILLS_CATALOG[skillId] || SKILLS_CATALOG[cleanId] || null;
  const dmgMultStr = (1 + (nextLv - 1) * 0.06 + (nextLv === 10 ? 0.12 : 0)).toFixed(2);
  const hasStatus = !!(meta && TYPE_META[meta.type] && TYPE_META[meta.type].status);
  const isMelee = !!(meta && meta.isMelee);

  if (nextLv === 10) {
    return `★ 滿級覺醒！傷害倍率躍升至 ${dmgMultStr}x，解鎖究極超武進化前置！`;
  }
  if (nextLv === 9) {
    return `極限連發！冷卻時間大幅縮短 -25%！基礎傷害提升至 ${dmgMultStr}x！`;
  }

  // 光束三大招式專屬精準說明
  if (cleanId === "HydroPump") {
    if (nextLv === 4) return `雙柱高壓齊射（最多2柱）！冷卻縮短 -12%！射程與威力提升至 ${dmgMultStr}x！`;
    if (nextLv === 8) return `★ 超壓水柱！水柱寬度 +28%、長度 +18%、升級三股螺旋絞線與單段增傷（${dmgMultStr}x）！`;
    return `水柱射程與寬度同步提升！基礎傷害提升至 ${dmgMultStr}x！`;
  }
  if (cleanId === "Flamethrower") {
    if (nextLv === 4) return `烈焰扇面拓寬 +18%、射程 +12%！冷卻縮短 -12%！傷害提升至 ${dmgMultStr}x！`;
    if (nextLv === 5) return `灼傷觸發機率大幅提升！烈焰寬度與射程強化，傷害提升至 ${dmgMultStr}x！`;
    if (nextLv === 8) return `★ 煉獄烈焰！扇面寬度 +34%、射程 +22%、翻湧火舌強化與增傷（${dmgMultStr}x）！`;
    return `烈焰射程與寬度同步成長！基礎傷害提升至 ${dmgMultStr}x！`;
  }
  if (cleanId === "IceBeam") {
    if (nextLv === 4) return `極寒雷射加粗 +14%！冷卻縮短 -12%！基礎傷害提升至 ${dmgMultStr}x！`;
    if (nextLv === 5) return `冰凍觸發機率大幅提升！雷射威力提升至 ${dmgMultStr}x！`;
    if (nextLv === 8) return `★ 零度重光！雷射寬度 +28%、射程 +16%、解鎖雙重交錯冰折線（${dmgMultStr}x）！`;
    return `極寒雷射射程與寬度同步提升！基礎傷害提升至 ${dmgMultStr}x！`;
  }

  // 藤鞭專屬漸進射程與雙鞭說明
  if (cleanId === "VineWhip") {
    if (nextLv === 3) return `藤鞭抽打射程明顯延長 ＆ 範圍 +15%！基礎傷害提升至 ${dmgMultStr}x！`;
    if (nextLv === 4) return `冷卻時間縮短 -12%！藤鞭射程繼續延長，基礎傷害提升至 ${dmgMultStr}x！`;
    if (nextLv === 5) return `★ 雙藤齊發！同時甩出 2 條藤鞭並延長射程，傷害提升至 ${dmgMultStr}x！`;
    if (nextLv === 8) return `★ 鞭影覺醒！藤鞭範圍大幅擴大 +25% ＆ 射程再延長，傷害提升至 ${dmgMultStr}x！`;
    return `藤鞭射程延長（越抽越長）！基礎傷害提升至 ${dmgMultStr}x！`;
  }

  // 空手劈、撞擊、地震、龍之俯衝、月亮之力專屬說明
  if (cleanId === "KarateChop") {
    if (nextLv === 3) return `拳風打擊範圍 +15% ＆ 出拳距離延長！基礎傷害提升至 ${dmgMultStr}x！`;
    if (nextLv === 4) return `★ 升級 3 連環拳！冷卻縮短 -12%！基礎傷害提升至 ${dmgMultStr}x！`;
    if (nextLv === 8) return `★ 升級 4 連環拳！拳風範圍擴大 +25%！基礎傷害提升至 ${dmgMultStr}x！`;
    return `出拳距離延伸 ＆ 連打威力提升至 ${dmgMultStr}x！`;
  }
  if (cleanId === "Tackle") {
    if (nextLv === 3) return `撞擊範圍擴大 +14%！基礎傷害提升至 ${dmgMultStr}x！`;
    if (nextLv === 4) return `★ 解鎖二段殘影接力撞擊！冷卻縮短 -12%！傷害提升至 ${dmgMultStr}x！`;
    if (nextLv === 6) return `撞擊擊退力 +35% ＆ 命中吸血提升！傷害提升至 ${dmgMultStr}x！`;
    if (nextLv === 8) return `★ 解鎖三段金焰殘影連環撞擊！範圍再擴張，傷害提升至 ${dmgMultStr}x！`;
    return `撞擊衝鋒威力提升至 ${dmgMultStr}x！`;
  }
  if (cleanId === "Earthquake") {
    if (nextLv === 3) return `地震龜裂範圍擴大 +15%！基礎傷害提升至 ${dmgMultStr}x！`;
    if (nextLv === 4) return `★ 餘震波次 +1！冷卻縮短 -12%！基礎傷害提升至 ${dmgMultStr}x！`;
    if (nextLv === 8) return `★ 三重連環餘震！震裂範圍擴大 +25%！傷害提升至 ${dmgMultStr}x！`;
    return `地震半徑擴大 ＆ 震波威力提升至 ${dmgMultStr}x！`;
  }
  if (cleanId === "DragonRush") {
    if (nextLv === 3) return `龍首氣旋範圍擴大 +15%！基礎傷害提升至 ${dmgMultStr}x！`;
    if (nextLv === 4) return `冷卻縮短 -12%！基礎傷害提升至 ${dmgMultStr}x！`;
    if (nextLv === 6) return `★ 巨龍破陣覺醒！龍首尺寸、突進距離與單發爆發大幅提升（${dmgMultStr}x）！`;
    if (nextLv === 8) return `龍首氣旋範圍擴大 +25%！基礎傷害提升至 ${dmgMultStr}x！`;
    return `龍威衝擊威力提升至 ${dmgMultStr}x！`;
  }
  if (cleanId === "Moonblast") {
    if (nextLv === 4) return `冷卻縮短 -12%！月光聖柱半徑擴大，傷害提升至 ${dmgMultStr}x！`;
    if (nextLv === 5) return `念力混亂機率提升！月光聖柱傷害提升至 ${dmgMultStr}x！`;
    if (nextLv === 6) return `★ 月光聖柱數量 +1（雙柱同步索敵）！傷害提升至 ${dmgMultStr}x！`;
    return `月光聖柱半徑擴大 ＆ 傷害提升至 ${dmgMultStr}x！`;
  }
  if (cleanId === "BulletSeed") {
    if (nextLv === 4) return `★ 機關槍連射數 +1！冷卻縮短 -12%！傷害提升至 ${dmgMultStr}x！`;
    if (nextLv === 6) return `種子彈穿透數提升至 2！傷害提升至 ${dmgMultStr}x！`;
    if (nextLv === 8) return `★ 機關槍連射數再 +1！基礎傷害提升至 ${dmgMultStr}x！`;
    return `種子連射威力提升至 ${dmgMultStr}x！`;
  }

  // v7.5.9 新增 5 大招式專屬精準升級說明（與實機等級門檻 100% 同步）
  if (cleanId === "RockSlide") {
    if (nextLv === 4) return `★ 落岩數量 +1（4 連岩崩）！冷卻縮短 -12%！傷害提升至 ${dmgMultStr}x！`;
    if (nextLv === 7) return `巨岩衝擊半徑擴大 +14%！基礎傷害提升至 ${dmgMultStr}x！`;
    if (nextLv === 8) return `★ 落岩數量再 +1（5 連岩崩）！砸地範圍強化，傷害提升至 ${dmgMultStr}x！`;
    return `岩崩落石重擊威力提升至 ${dmgMultStr}x！`;
  }
  if (cleanId === "XScissor") {
    if (nextLv === 3) return `十字雙鐮斬擊範圍擴大 +15%！基礎傷害提升至 ${dmgMultStr}x！`;
    if (nextLv === 4) return `★ 解鎖二連十字斬！冷卻縮短 -12%！傷害提升至 ${dmgMultStr}x！`;
    if (nextLv === 8) return `★ 翡翠星鐮覺醒！斬擊範圍大幅擴大 +25% ＆ 暴擊率再 +8%（${dmgMultStr}x）！`;
    return `十字剪破甲切割威力提升至 ${dmgMultStr}x！`;
  }
  if (cleanId === "PoisonJab") {
    if (nextLv === 4) return `★ 毒矛扇射 +1（4 連毒矛）！冷卻縮短 -12%！傷害提升至 ${dmgMultStr}x！`;
    if (nextLv === 6) return `毒矛穿透次數提升至 3！基礎傷害提升至 ${dmgMultStr}x！`;
    if (nextLv === 8) return `★ 毒矛扇射再 +1（5 連毒矛）！毒爆範圍強化，傷害提升至 ${dmgMultStr}x！`;
    return `毒擊與毒爆連鎖威力提升至 ${dmgMultStr}x！`;
  }
  if (cleanId === "ElectroBall") {
    if (nextLv === 4) return `★ 電球數量 +1（雙球齊發）！冷卻縮短 -12%！傷害提升至 ${dmgMultStr}x！`;
    if (nextLv === 6) return `電球穿透次數提升至 6！基礎傷害提升至 ${dmgMultStr}x！`;
    if (nextLv === 8) return `★ 電球數量再 +1（三球齊發）！球體尺寸擴大 +20%，傷害提升至 ${dmgMultStr}x！`;
    return `高壓電球與電弧抽射威力提升至 ${dmgMultStr}x！`;
  }
  if (cleanId === "ShadowClaw") {
    if (nextLv === 3) return `暗影利爪揮掃範圍擴大 +15%！基礎傷害提升至 ${dmgMultStr}x！`;
    if (nextLv === 4) return `★ 解鎖正反手二連斜劈（左上➔右下 ＆ 右上➔左下）！冷卻 -12%（${dmgMultStr}x）！`;
    if (nextLv === 8) return `★ 幽冥魔爪覺醒！爪痕範圍擴大 +25% ＆ 暴擊率再 +10%（${dmgMultStr}x）！`;
    return `暗影爪撕裂暴擊威力提升至 ${dmgMultStr}x！`;
  }

  // 通用遠程彈幕（火花、水槍、飛葉快刀、種子炸彈、十萬伏特、暗影球、精神擊破、空氣斬、污泥炸彈等）
  if (nextLv === 4) return `彈幕數量 +1！冷卻時間縮短 -12%！基礎傷害提升至 ${dmgMultStr}x！`;
  if (nextLv === 8) return `彈幕數量 +1！彈體尺寸擴大 +25%！基礎傷害提升至 ${dmgMultStr}x！`;
  if (nextLv === 6) return `穿透次數強化！基礎傷害提升至 ${dmgMultStr}x！`;
  if (nextLv === 5) {
    return hasStatus
      ? `異常狀態觸發機率大幅提升！基礎傷害提升至 ${dmgMultStr}x！`
      : `招式爆發威力穩步成長！基礎傷害提升至 ${dmgMultStr}x！`;
  }
  if (nextLv === 3 && isMelee) return `近戰打擊範圍擴大 +15%！基礎傷害提升至 ${dmgMultStr}x！`;
  return `基礎傷害提升至 ${dmgMultStr}x！招式威力全面強化！`;
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

// v7.3.8 非神獸小王與雙王 4 大職能流派模板 (Archetype System)
const BOSS_ARCHETYPES = {
  sniper: {
    name: "疾風連射型",
    idealMin: 150,
    idealMax: 220,
    skills: [
      { id: "sniper_dash",   name: "疾風俯衝", shape: "line", width: 38, length: 300, delay: 0.72, dmgMult: 1.32, speed: 470, color: "#F59E0B" },
      { id: "sniper_snipe",  name: "三連鎖定爆", shape: "chase_triplet", count: 3, radius: 44, delay: 0.68, stepDelay: 0.16, dmgMult: 1.20, color: "#38BDF8" }
    ]
  },
  toxic_zone: {
    name: "毒霧封鎖型",
    idealMin: 95,
    idealMax: 155,
    skills: [
      { id: "toxic_triplet", name: "毒霧三連爆", shape: "chase_triplet", count: 3, radius: 46, delay: 0.72, stepDelay: 0.17, dmgMult: 1.22, color: "#A855F7" },
      { id: "toxic_ring",    name: "安全眼毒環", shape: "ring", radius: 155, innerRadius: 52, delay: 0.88, dmgMult: 1.25, color: "#C084FC" }
    ]
  },
  juggernaut: {
    name: "重裝猛攻型",
    idealMin: 55,
    idealMax: 125,
    skills: [
      { id: "jug_domino",    name: "骨牌連環地裂", shape: "domino_line", count: 4, stepDist: 58, radius: 44, delay: 0.62, stepDelay: 0.14, dmgMult: 1.28, color: "#D97706" },
      { id: "jug_charge",    name: "重裝野蠻衝撞", shape: "line", width: 44, length: 280, delay: 0.74, dmgMult: 1.38, speed: 450, color: "#EF4444" }
    ]
  },
  trickster: {
    name: "念影詭術型",
    idealMin: 170,
    idealMax: 240,
    skills: [
      { id: "trick_suction", name: "重力黑洞夾擊", shape: "suction_flank", radius: 58, flankRadius: 42, delay: 0.82, dmgMult: 1.30, color: "#A855F7" },
      { id: "trick_ring",    name: "暗影星環", shape: "ring", radius: 145, innerRadius: 48, delay: 0.86, dmgMult: 1.24, color: "#C084FC" }
    ]
  }
};

const BOSS_ARCHETYPE_ID_MAP = {
  15: "sniper",      // 大針蜂
  18: "sniper",      // 大比鳥
  24: "sniper",      // 阿柏怪
  121: "sniper",     // 寶石海星
  45: "toxic_zone",  // 霸王花
  73: "toxic_zone",  // 毒刺水母
  110: "toxic_zone", // 雙彈瓦斯
  31: "toxic_zone",  // 尼多后
  130: "juggernaut", // 暴鯉龍
  91: "juggernaut",  // 刺甲貝
  106: "juggernaut", // 飛腿郎
  107: "juggernaut", // 快拳郎
  34: "juggernaut",  // 尼多王
  65: "trickster",   // 胡地
  94: "trickster"    // 耿鬼
};

function getBossArchetypeKey(id, data) {
  if (BOSS_ARCHETYPE_ID_MAP[id]) return BOSS_ARCHETYPE_ID_MAP[id];
  const t1 = data ? data.type1 : "";
  const t2 = data ? data.type2 : "";
  if (t1 === "Psychic" || t1 === "Ghost" || t2 === "Psychic" || t2 === "Ghost") return "trickster";
  if (t1 === "Poison" || t1 === "Grass" || t2 === "Poison") return "toxic_zone";
  if (t1 === "Flying" || t1 === "Electric" || t1 === "Bug") return "sniper";
  return "juggernaut";
}

// 5. 關都 151 隻完整圖鑑資料庫
const POKEMON_DB = [
  { id: 1, name_zh: "妙蛙種子", type1: "Grass", type2: "Poison", hp: 120, atk: 49, speed: 45, skill: "VineWhip", weightTier: "light", kbResist: 0.10, evo_level: 12, evo_to: 2 },
  { id: 2, name_zh: "妙蛙草", type1: "Grass", type2: "Poison", hp: 160, atk: 62, speed: 60, skill: "Seed Bomb", weightTier: "medium", kbResist: 0.35, evo_level: 21, evo_to: 3 },
  { id: 3, name_zh: "妙蛙花", type1: "Grass", type2: "Poison", hp: 220, atk: 82, speed: 80, skill: "Seed Bomb", weightTier: "heavy", kbResist: 0.85, evo_level: "None", evo_to: null },
  { id: 4, name_zh: "小火龍", type1: "Fire", type2: "None", hp: 115, atk: 52, speed: 65, skill: "Ember", weightTier: "light", kbResist: 0.10, evo_level: 12, evo_to: 5 },
  { id: 5, name_zh: "火恐龍", type1: "Fire", type2: "None", hp: 155, atk: 64, speed: 80, skill: "Flamethrower", weightTier: "medium", kbResist: 0.35, evo_level: 21, evo_to: 6 },
  { id: 6, name_zh: "噴火龍", type1: "Fire", type2: "Flying", hp: 215, atk: 84, speed: 100, skill: "Flamethrower", weightTier: "heavy", kbResist: 0.85, evo_level: "None", evo_to: null },
  { id: 7, name_zh: "傑尼龜", type1: "Water", type2: "None", hp: 133, atk: 48, speed: 43, skill: "WaterGun", weightTier: "light", kbResist: 0.15, evo_level: 12, evo_to: 8 },
  { id: 8, name_zh: "卡咪龜", type1: "Water", type2: "None", hp: 170, atk: 63, speed: 58, skill: "Hydro Pump", weightTier: "medium", kbResist: 0.40, evo_level: 21, evo_to: 9 },
  { id: 9, name_zh: "水箭龜", type1: "Water", type2: "None", hp: 230, atk: 83, speed: 78, skill: "Hydro Pump", weightTier: "heavy", kbResist: 0.90, evo_level: "None", evo_to: null },
  { id: 10, name_zh: "綠毛蟲", type1: "Bug", type2: "None", hp: 95, atk: 30, speed: 45, skill: "Tackle", weightTier: "light", kbResist: 0.0, evo_level: 7, evo_to: 11 },
  { id: 11, name_zh: "鐵甲蛹", type1: "Bug", type2: "None", hp: 140, atk: 25, speed: 30, skill: "Tackle", weightTier: "medium", kbResist: 0.60, evo_level: 10, evo_to: 12 },
  { id: 12, name_zh: "巴大蝶", type1: "Bug", type2: "Flying", hp: 160, atk: 45, speed: 70, skill: "Air Slash", weightTier: "light", kbResist: 0.10, evo_level: "None", evo_to: null },
  { id: 13, name_zh: "獨角蟲", type1: "Bug", type2: "Poison", hp: 95, atk: 35, speed: 50, skill: "Tackle", weightTier: "light", kbResist: 0.0, evo_level: 7, evo_to: 14 },
  { id: 14, name_zh: "鐵殼蛹", type1: "Bug", type2: "Poison", hp: 140, atk: 25, speed: 35, skill: "Tackle", weightTier: "medium", kbResist: 0.60, evo_level: 10, evo_to: 15 },
  { id: 15, name_zh: "大針蜂", type1: "Bug", type2: "Poison", hp: 165, atk: 90, speed: 75, skill: "Sludge Bomb", weightTier: "medium", kbResist: 0.25, evo_level: "None", evo_to: null },
  { id: 16, name_zh: "波波", type1: "Normal", type2: "Flying", hp: 100, atk: 45, speed: 56, skill: "Air Slash", weightTier: "light", kbResist: 0.0, evo_level: 12, evo_to: 17 },
  { id: 17, name_zh: "比比鳥", type1: "Normal", type2: "Flying", hp: 150, atk: 60, speed: 71, skill: "Air Slash", weightTier: "medium", kbResist: 0.25, evo_level: 21, evo_to: 18 },
  { id: 18, name_zh: "大比鳥", type1: "Normal", type2: "Flying", hp: 205, atk: 80, speed: 101, skill: "Air Slash", weightTier: "medium", kbResist: 0.45, evo_level: "None", evo_to: null },
  { id: 19, name_zh: "小拉達", type1: "Normal", type2: "None", hp: 90, atk: 56, speed: 72, skill: "Tackle", weightTier: "light", kbResist: 0.0, evo_level: 16, evo_to: 20 },
  { id: 20, name_zh: "拉達", type1: "Normal", type2: "None", hp: 155, atk: 81, speed: 97, skill: "Tackle", weightTier: "medium", kbResist: 0.30, evo_level: "None", evo_to: null },
  { id: 21, name_zh: "烈雀", type1: "Normal", type2: "Flying", hp: 100, atk: 60, speed: 70, skill: "Air Slash", weightTier: "light", kbResist: 0.0, evo_level: 16, evo_to: 22 },
  { id: 22, name_zh: "大嘴雀", type1: "Normal", type2: "Flying", hp: 165, atk: 90, speed: 100, skill: "Air Slash", weightTier: "medium", kbResist: 0.35, evo_level: "None", evo_to: null },
  { id: 23, name_zh: "阿柏蛇", type1: "Poison", type2: "None", hp: 105, atk: 60, speed: 55, skill: "Sludge Bomb", weightTier: "light", kbResist: 0.15, evo_level: 16, evo_to: 24 },
  { id: 24, name_zh: "阿柏怪", type1: "Poison", type2: "None", hp: 160, atk: 95, speed: 80, skill: "Sludge Bomb", weightTier: "medium", kbResist: 0.45, evo_level: "None", evo_to: null },
  { id: 25, name_zh: "皮卡丘", type1: "Electric", type2: "None", hp: 102, atk: 55, speed: 90, skill: "Thunderbolt", weightTier: "light", kbResist: 0.10, evo_level: 18, evo_to: 26 },
  { id: 26, name_zh: "雷丘", type1: "Electric", type2: "None", hp: 160, atk: 90, speed: 110, skill: "Thunderbolt", weightTier: "medium", kbResist: 0.40, evo_level: "None", evo_to: null },
  { id: 27, name_zh: "穿山鼠", type1: "Ground", type2: "None", hp: 110, atk: 75, speed: 40, skill: "Earthquake", weightTier: "light", kbResist: 0.25, evo_level: 16, evo_to: 28 },
  { id: 28, name_zh: "穿山王", type1: "Ground", type2: "None", hp: 175, atk: 100, speed: 65, skill: "Earthquake", weightTier: "medium", kbResist: 0.60, evo_level: "None", evo_to: null },
  { id: 29, name_zh: "尼多蘭", type1: "Poison", type2: "None", hp: 115, atk: 47, speed: 41, skill: "Sludge Bomb", weightTier: "light", kbResist: 0.15, evo_level: 12, evo_to: 30 },
  { id: 30, name_zh: "尼多娜", type1: "Poison", type2: "None", hp: 160, atk: 62, speed: 56, skill: "Sludge Bomb", weightTier: "medium", kbResist: 0.40, evo_level: 21, evo_to: 31 },
  { id: 31, name_zh: "尼多后", type1: "Poison", type2: "Ground", hp: 210, atk: 92, speed: 76, skill: "Earthquake", weightTier: "heavy", kbResist: 0.85, evo_level: "None", evo_to: null },
  { id: 32, name_zh: "尼多朗", type1: "Poison", type2: "None", hp: 110, atk: 57, speed: 50, skill: "Sludge Bomb", weightTier: "light", kbResist: 0.15, evo_level: 12, evo_to: 33 },
  { id: 33, name_zh: "尼多力諾", type1: "Poison", type2: "None", hp: 155, atk: 72, speed: 65, skill: "Sludge Bomb", weightTier: "medium", kbResist: 0.40, evo_level: 21, evo_to: 34 },
  { id: 34, name_zh: "尼多王", type1: "Poison", type2: "Ground", hp: 201, atk: 102, speed: 85, skill: "Earthquake", weightTier: "heavy", kbResist: 0.85, evo_level: "None", evo_to: null },
  { id: 35, name_zh: "皮皮", type1: "Psychic", type2: "None", hp: 140, atk: 45, speed: 35, skill: "Moonblast", weightTier: "light", kbResist: 0.20, evo_level: 16, evo_to: 36 },
  { id: 36, name_zh: "皮可西", type1: "Psychic", type2: "None", hp: 195, atk: 70, speed: 60, skill: "Moonblast", weightTier: "medium", kbResist: 0.50, evo_level: "None", evo_to: null },
  { id: 37, name_zh: "六尾", type1: "Fire", type2: "None", hp: 108, atk: 41, speed: 65, skill: "Flamethrower", weightTier: "light", kbResist: 0.10, evo_level: 16, evo_to: 38 },
  { id: 38, name_zh: "九尾", type1: "Fire", type2: "None", hp: 173, atk: 76, speed: 100, skill: "Flamethrower", weightTier: "medium", kbResist: 0.40, evo_level: "None", evo_to: null },
  { id: 39, name_zh: "胖丁", type1: "Normal", type2: "Psychic", hp: 185, atk: 45, speed: 20, skill: "Moonblast", weightTier: "light", kbResist: 0.15, evo_level: 16, evo_to: 40 },
  { id: 40, name_zh: "胖可丁", type1: "Normal", type2: "Psychic", hp: 240, atk: 70, speed: 45, skill: "Moonblast", weightTier: "medium", kbResist: 0.55, evo_level: "None", evo_to: null },
  { id: 41, name_zh: "超音蝠", type1: "Poison", type2: "Flying", hp: 100, atk: 45, speed: 55, skill: "Air Slash", weightTier: "light", kbResist: 0.0, evo_level: 16, evo_to: 42 },
  { id: 42, name_zh: "大嘴蝠", type1: "Poison", type2: "Flying", hp: 165, atk: 80, speed: 90, skill: "Air Slash", weightTier: "medium", kbResist: 0.30, evo_level: "None", evo_to: null },
  { id: 43, name_zh: "走路草", type1: "Grass", type2: "Poison", hp: 110, atk: 50, speed: 30, skill: "Razor Leaf", weightTier: "light", kbResist: 0.10, evo_level: 12, evo_to: 44 },
  { id: 44, name_zh: "臭臭花", type1: "Grass", type2: "Poison", hp: 150, atk: 65, speed: 40, skill: "Razor Leaf", weightTier: "medium", kbResist: 0.35, evo_level: 21, evo_to: 45 },
  { id: 45, name_zh: "霸王花", type1: "Grass", type2: "Poison", hp: 195, atk: 80, speed: 50, skill: "Seed Bomb", weightTier: "medium", kbResist: 0.65, evo_level: "None", evo_to: null },
  { id: 46, name_zh: "派拉斯", type1: "Bug", type2: "Grass", hp: 105, atk: 70, speed: 25, skill: "Bullet Seed", weightTier: "light", kbResist: 0.15, evo_level: 16, evo_to: 47 },
  { id: 47, name_zh: "派拉斯特", type1: "Bug", type2: "Grass", hp: 160, atk: 95, speed: 30, skill: "Seed Bomb", weightTier: "medium", kbResist: 0.55, evo_level: "None", evo_to: null },
  { id: 48, name_zh: "毛球", type1: "Bug", type2: "Poison", hp: 120, atk: 55, speed: 45, skill: "Sludge Bomb", weightTier: "light", kbResist: 0.15, evo_level: 18, evo_to: 49 },
  { id: 49, name_zh: "摩魯蛾", type1: "Bug", type2: "Poison", hp: 170, atk: 65, speed: 90, skill: "Sludge Bomb", weightTier: "medium", kbResist: 0.40, evo_level: "None", evo_to: null },
  { id: 50, name_zh: "地鼠", type1: "Ground", type2: "None", hp: 70, atk: 55, speed: 95, skill: "Earthquake", weightTier: "light", kbResist: 0.0, evo_level: 18, evo_to: 51 },
  { id: 51, name_zh: "三地鼠", type1: "Ground", type2: "None", hp: 105, atk: 100, speed: 120, skill: "Earthquake", weightTier: "medium", kbResist: 0.35, evo_level: "None", evo_to: null },
  { id: 52, name_zh: "喵喵", type1: "Normal", type2: "None", hp: 100, atk: 45, speed: 90, skill: "Tackle", weightTier: "light", kbResist: 0.05, evo_level: 18, evo_to: 53 },
  { id: 53, name_zh: "貓老大", type1: "Normal", type2: "None", hp: 165, atk: 70, speed: 115, skill: "Tackle", weightTier: "medium", kbResist: 0.35, evo_level: "None", evo_to: null },
  { id: 54, name_zh: "可達鴨", type1: "Water", type2: "None", hp: 120, atk: 52, speed: 55, skill: "Hydro Pump", weightTier: "light", kbResist: 0.15, evo_level: 18, evo_to: 55 },
  { id: 55, name_zh: "哥達鴨", type1: "Water", type2: "None", hp: 180, atk: 82, speed: 85, skill: "Hydro Pump", weightTier: "medium", kbResist: 0.50, evo_level: "None", evo_to: null },
  { id: 56, name_zh: "猴怪", type1: "Fighting", type2: "None", hp: 100, atk: 80, speed: 70, skill: "Karate Chop", weightTier: "light", kbResist: 0.10, evo_level: 18, evo_to: 57 },
  { id: 57, name_zh: "火爆猴", type1: "Fighting", type2: "None", hp: 165, atk: 105, speed: 95, skill: "Karate Chop", weightTier: "medium", kbResist: 0.45, evo_level: "None", evo_to: null },
  { id: 58, name_zh: "卡蒂狗", type1: "Fire", type2: "None", hp: 125, atk: 70, speed: 60, skill: "Flamethrower", weightTier: "light", kbResist: 0.20, evo_level: 18, evo_to: 59 },
  { id: 59, name_zh: "風速狗", type1: "Fire", type2: "None", hp: 210, atk: 110, speed: 95, skill: "Flamethrower", weightTier: "heavy", kbResist: 0.85, evo_level: "None", evo_to: null },
  { id: 60, name_zh: "蚊香蝌蚪", type1: "Water", type2: "None", hp: 100, atk: 50, speed: 90, skill: "Hydro Pump", weightTier: "light", kbResist: 0.05, evo_level: 12, evo_to: 61 },
  { id: 61, name_zh: "蚊香君", type1: "Water", type2: "None", hp: 155, atk: 65, speed: 90, skill: "Hydro Pump", weightTier: "medium", kbResist: 0.40, evo_level: 21, evo_to: 62 },
  { id: 62, name_zh: "蚊香泳士", type1: "Water", type2: "Fighting", hp: 210, atk: 95, speed: 70, skill: "Hydro Pump", weightTier: "heavy", kbResist: 0.85, evo_level: "None", evo_to: null },
  { id: 63, name_zh: "凱西", type1: "Psychic", type2: "None", hp: 85, atk: 20, speed: 90, skill: "Psystrike", weightTier: "light", kbResist: 0.0, evo_level: 12, evo_to: 64 },
  { id: 64, name_zh: "勇基拉", type1: "Psychic", type2: "None", hp: 130, atk: 35, speed: 105, skill: "Psystrike", weightTier: "medium", kbResist: 0.25, evo_level: 21, evo_to: 65 },
  { id: 65, name_zh: "胡地", type1: "Psychic", type2: "None", hp: 175, atk: 50, speed: 120, skill: "Psystrike", weightTier: "medium", kbResist: 0.45, evo_level: "None", evo_to: null },
  { id: 66, name_zh: "腕力", type1: "Fighting", type2: "None", hp: 130, atk: 80, speed: 35, skill: "Karate Chop", weightTier: "medium", kbResist: 0.35, evo_level: 12, evo_to: 67 },
  { id: 67, name_zh: "豪力", type1: "Fighting", type2: "None", hp: 170, atk: 100, speed: 45, skill: "Karate Chop", weightTier: "medium", kbResist: 0.65, evo_level: 21, evo_to: 68 },
  { id: 68, name_zh: "怪力", type1: "Fighting", type2: "None", hp: 220, atk: 130, speed: 55, skill: "Karate Chop", weightTier: "heavy", kbResist: 0.95, evo_level: "None", evo_to: null },
  { id: 69, name_zh: "喇叭芽", type1: "Grass", type2: "Poison", hp: 110, atk: 75, speed: 40, skill: "Bullet Seed", weightTier: "light", kbResist: 0.05, evo_level: 12, evo_to: 70 },
  { id: 70, name_zh: "口呆花", type1: "Grass", type2: "Poison", hp: 155, atk: 90, speed: 55, skill: "Razor Leaf", weightTier: "medium", kbResist: 0.35, evo_level: 21, evo_to: 71 },
  { id: 71, name_zh: "大食花", type1: "Grass", type2: "Poison", hp: 200, atk: 105, speed: 70, skill: "Seed Bomb", weightTier: "heavy", kbResist: 0.75, evo_level: "None", evo_to: null },
  { id: 72, name_zh: "瑪瑙水母", type1: "Water", type2: "Poison", hp: 110, atk: 40, speed: 70, skill: "Hydro Pump", weightTier: "light", kbResist: 0.15, evo_level: 18, evo_to: 73 },
  { id: 73, name_zh: "毒刺水母", type1: "Water", type2: "Poison", hp: 190, atk: 70, speed: 100, skill: "Hydro Pump", weightTier: "heavy", kbResist: 0.85, evo_level: "None", evo_to: null },
  { id: 74, name_zh: "小拳石", type1: "Rock", type2: "Ground", hp: 120, atk: 80, speed: 20, skill: "Earthquake", weightTier: "medium", kbResist: 0.55, evo_level: 12, evo_to: 75 },
  { id: 75, name_zh: "隆隆石", type1: "Rock", type2: "Ground", hp: 165, atk: 95, speed: 35, skill: "Earthquake", weightTier: "heavy", kbResist: 0.85, evo_level: 21, evo_to: 76 },
  { id: 76, name_zh: "隆隆岩", type1: "Rock", type2: "Ground", hp: 210, atk: 120, speed: 45, skill: "Earthquake", weightTier: "heavy", kbResist: 0.95, evo_level: "None", evo_to: null },
  { id: 77, name_zh: "小火馬", type1: "Fire", type2: "None", hp: 120, atk: 85, speed: 90, skill: "Flamethrower", weightTier: "light", kbResist: 0.20, evo_level: 20, evo_to: 78 },
  { id: 78, name_zh: "烈焰馬", type1: "Fire", type2: "None", hp: 175, atk: 100, speed: 105, skill: "Flamethrower", weightTier: "medium", kbResist: 0.55, evo_level: "None", evo_to: null },
  { id: 79, name_zh: "呆呆獸", type1: "Water", type2: "Psychic", hp: 150, atk: 65, speed: 15, skill: "Hydro Pump", weightTier: "medium", kbResist: 0.65, evo_level: 20, evo_to: 80 },
  { id: 80, name_zh: "呆殼獸", type1: "Water", type2: "Psychic", hp: 215, atk: 75, speed: 30, skill: "Hydro Pump", weightTier: "heavy", kbResist: 0.90, evo_level: "None", evo_to: null },
  { id: 81, name_zh: "小磁怪", type1: "Electric", type2: "Steel", hp: 90, atk: 35, speed: 45, skill: "Thunderbolt", weightTier: "light", kbResist: 0.10, evo_level: 18, evo_to: 82 },
  { id: 82, name_zh: "三合一磁怪", type1: "Electric", type2: "Steel", hp: 145, atk: 60, speed: 70, skill: "Thunderbolt", weightTier: "medium", kbResist: 0.50, evo_level: "None", evo_to: null },
  { id: 83, name_zh: "大蔥鴨", type1: "Normal", type2: "Flying", hp: 132, atk: 90, speed: 60, skill: "Air Slash", weightTier: "light", kbResist: 0.15, evo_level: "None", evo_to: null },
  { id: 84, name_zh: "嘟嘟", type1: "Normal", type2: "Flying", hp: 105, atk: 85, speed: 75, skill: "Air Slash", weightTier: "light", kbResist: 0.15, evo_level: 18, evo_to: 85 },
  { id: 85, name_zh: "嘟嘟利", type1: "Normal", type2: "Flying", hp: 165, atk: 110, speed: 110, skill: "Air Slash", weightTier: "medium", kbResist: 0.45, evo_level: "None", evo_to: null },
  { id: 86, name_zh: "小海獅", type1: "Water", type2: "None", hp: 135, atk: 45, speed: 45, skill: "Ice Beam", weightTier: "medium", kbResist: 0.35, evo_level: 18, evo_to: 87 },
  { id: 87, name_zh: "白海獅", type1: "Water", type2: "Ice", hp: 200, atk: 70, speed: 70, skill: "Ice Beam", weightTier: "heavy", kbResist: 0.80, evo_level: "None", evo_to: null },
  { id: 88, name_zh: "臭泥", type1: "Poison", type2: "None", hp: 140, atk: 80, speed: 25, skill: "Sludge Bomb", weightTier: "medium", kbResist: 0.45, evo_level: 20, evo_to: 89 },
  { id: 89, name_zh: "臭臭泥", type1: "Poison", type2: "None", hp: 215, atk: 105, speed: 50, skill: "Sludge Bomb", weightTier: "heavy", kbResist: 0.85, evo_level: "None", evo_to: null },
  { id: 90, name_zh: "大舌貝", type1: "Water", type2: "None", hp: 95, atk: 65, speed: 40, skill: "Hydro Pump", weightTier: "light", kbResist: 0.30, evo_level: 18, evo_to: 91 },
  { id: 91, name_zh: "刺甲貝", type1: "Water", type2: "Ice", hp: 160, atk: 95, speed: 70, skill: "Ice Beam", weightTier: "heavy", kbResist: 0.85, evo_level: "None", evo_to: null },
  { id: 92, name_zh: "鬼斯", type1: "Ghost", type2: "Poison", hp: 85, atk: 35, speed: 80, skill: "Shadow Ball", weightTier: "light", kbResist: 0.0, evo_level: 12, evo_to: 93 },
  { id: 93, name_zh: "鬼斯通", type1: "Ghost", type2: "Poison", hp: 125, atk: 50, speed: 95, skill: "Shadow Ball", weightTier: "medium", kbResist: 0.20, evo_level: 21, evo_to: 94 },
  { id: 94, name_zh: "耿鬼", type1: "Ghost", type2: "Poison", hp: 170, atk: 65, speed: 110, skill: "Shadow Ball", weightTier: "medium", kbResist: 0.50, evo_level: "None", evo_to: null },
  { id: 95, name_zh: "大岩蛇", type1: "Rock", type2: "Ground", hp: 145, atk: 68, speed: 70, skill: "Earthquake", weightTier: "heavy", kbResist: 0.95, evo_level: "None", evo_to: null },
  { id: 96, name_zh: "催眠貘", type1: "Psychic", type2: "None", hp: 130, atk: 48, speed: 42, skill: "Psystrike", weightTier: "light", kbResist: 0.20, evo_level: 18, evo_to: 97 },
  { id: 97, name_zh: "引夢貘人", type1: "Psychic", type2: "None", hp: 185, atk: 73, speed: 67, skill: "Psystrike", weightTier: "medium", kbResist: 0.60, evo_level: "None", evo_to: null },
  { id: 98, name_zh: "大鉗蟹", type1: "Water", type2: "None", hp: 95, atk: 105, speed: 50, skill: "Hydro Pump", weightTier: "light", kbResist: 0.20, evo_level: 18, evo_to: 99 },
  { id: 99, name_zh: "巨鉗蟹", type1: "Water", type2: "None", hp: 165, atk: 130, speed: 75, skill: "Hydro Pump", weightTier: "heavy", kbResist: 0.85, evo_level: "None", evo_to: null },
  { id: 100, name_zh: "霹靂電球", type1: "Electric", type2: "None", hp: 100, atk: 30, speed: 100, skill: "Thunderbolt", weightTier: "light", kbResist: 0.05, evo_level: 18, evo_to: 101 },
  { id: 101, name_zh: "頑皮雷彈", type1: "Electric", type2: "None", hp: 160, atk: 50, speed: 150, skill: "Thunderbolt", weightTier: "medium", kbResist: 0.45, evo_level: "None", evo_to: null },
  { id: 102, name_zh: "蛋蛋", type1: "Grass", type2: "Psychic", hp: 120, atk: 40, speed: 40, skill: "Bullet Seed", weightTier: "light", kbResist: 0.15, evo_level: 18, evo_to: 103 },
  { id: 103, name_zh: "椰蛋樹", type1: "Grass", type2: "Psychic", hp: 205, atk: 95, speed: 55, skill: "Seed Bomb", weightTier: "heavy", kbResist: 0.85, evo_level: "None", evo_to: null },
  { id: 104, name_zh: "卡拉卡拉", type1: "Ground", type2: "None", hp: 110, atk: 50, speed: 35, skill: "Earthquake", weightTier: "light", kbResist: 0.20, evo_level: 18, evo_to: 105 },
  { id: 105, name_zh: "嘎啦嘎啦", type1: "Ground", type2: "None", hp: 170, atk: 80, speed: 45, skill: "Earthquake", weightTier: "medium", kbResist: 0.60, evo_level: "None", evo_to: null },
  { id: 106, name_zh: "飛腿郎", type1: "Fighting", type2: "None", hp: 150, atk: 120, speed: 87, skill: "Karate Chop", weightTier: "medium", kbResist: 0.50, evo_level: "None", evo_to: null },
  { id: 107, name_zh: "快拳郎", type1: "Fighting", type2: "None", hp: 150, atk: 105, speed: 76, skill: "Karate Chop", weightTier: "medium", kbResist: 0.50, evo_level: "None", evo_to: null },
  { id: 108, name_zh: "大舌頭", type1: "Normal", type2: "None", hp: 195, atk: 55, speed: 30, skill: "Tackle", weightTier: "heavy", kbResist: 0.80, evo_level: "None", evo_to: null },
  { id: 109, name_zh: "瓦斯彈", type1: "Poison", type2: "None", hp: 100, atk: 65, speed: 35, skill: "Sludge Bomb", weightTier: "light", kbResist: 0.20, evo_level: 18, evo_to: 110 },
  { id: 110, name_zh: "雙彈瓦斯", type1: "Poison", type2: "None", hp: 175, atk: 90, speed: 60, skill: "Sludge Bomb", weightTier: "medium", kbResist: 0.60, evo_level: "None", evo_to: null },
  { id: 111, name_zh: "獨角犀牛", type1: "Ground", type2: "Rock", hp: 145, atk: 85, speed: 25, skill: "Earthquake", weightTier: "heavy", kbResist: 0.75, evo_level: 20, evo_to: 112 },
  { id: 112, name_zh: "鑽角犀獸", type1: "Ground", type2: "Rock", hp: 215, atk: 130, speed: 40, skill: "Earthquake", weightTier: "heavy", kbResist: 0.95, evo_level: "None", evo_to: null },
  { id: 113, name_zh: "吉利蛋", type1: "Normal", type2: "None", hp: 450, atk: 40, speed: 50, skill: "Moonblast", weightTier: "heavy", kbResist: 0.85, evo_level: "None", evo_to: null },
  { id: 114, name_zh: "蔓藤怪", type1: "Grass", type2: "None", hp: 145, atk: 55, speed: 60, skill: "Bullet Seed", weightTier: "medium", kbResist: 0.50, evo_level: "None", evo_to: null },
  { id: 115, name_zh: "袋獸", type1: "Normal", type2: "None", hp: 215, atk: 95, speed: 90, skill: "Tackle", weightTier: "heavy", kbResist: 0.85, evo_level: "None", evo_to: null },
  { id: 116, name_zh: "墨海馬", type1: "Water", type2: "None", hp: 90, atk: 40, speed: 60, skill: "Hydro Pump", weightTier: "light", kbResist: 0.05, evo_level: 18, evo_to: 117 },
  { id: 117, name_zh: "海刺龍", type1: "Water", type2: "None", hp: 155, atk: 65, speed: 85, skill: "Hydro Pump", weightTier: "medium", kbResist: 0.45, evo_level: "None", evo_to: null },
  { id: 118, name_zh: "角金魚", type1: "Water", type2: "None", hp: 110, atk: 67, speed: 63, skill: "Hydro Pump", weightTier: "light", kbResist: 0.10, evo_level: 18, evo_to: 119 },
  { id: 119, name_zh: "金魚王", type1: "Water", type2: "None", hp: 175, atk: 92, speed: 68, skill: "Hydro Pump", weightTier: "medium", kbResist: 0.50, evo_level: "None", evo_to: null },
  { id: 120, name_zh: "海星星", type1: "Water", type2: "None", hp: 95, atk: 45, speed: 85, skill: "Hydro Pump", weightTier: "light", kbResist: 0.10, evo_level: 18, evo_to: 121 },
  { id: 121, name_zh: "寶石海星", type1: "Water", type2: "Psychic", hp: 170, atk: 75, speed: 115, skill: "Hydro Pump", weightTier: "medium", kbResist: 0.50, evo_level: "None", evo_to: null },
  { id: 122, name_zh: "魔牆人偶", type1: "Psychic", type2: "None", hp: 140, atk: 45, speed: 90, skill: "Psystrike", weightTier: "medium", kbResist: 0.45, evo_level: "None", evo_to: null },
  { id: 123, name_zh: "飛天螳螂", type1: "Bug", type2: "Flying", hp: 175, atk: 110, speed: 105, skill: "XScissor", weightTier: "medium", kbResist: 0.55, evo_level: "None", evo_to: null },
  { id: 124, name_zh: "迷唇姐", type1: "Ice", type2: "Psychic", hp: 155, atk: 50, speed: 95, skill: "Ice Beam", weightTier: "medium", kbResist: 0.40, evo_level: "None", evo_to: null },
  { id: 125, name_zh: "電擊獸", type1: "Electric", type2: "None", hp: 170, atk: 83, speed: 105, skill: "Thunderbolt", weightTier: "medium", kbResist: 0.55, evo_level: "None", evo_to: null },
  { id: 126, name_zh: "鴨嘴火獸", type1: "Fire", type2: "None", hp: 170, atk: 95, speed: 93, skill: "Flamethrower", weightTier: "medium", kbResist: 0.55, evo_level: "None", evo_to: null },
  { id: 127, name_zh: "凱羅斯", type1: "Bug", type2: "None", hp: 170, atk: 125, speed: 85, skill: "Karate Chop", weightTier: "heavy", kbResist: 0.75, evo_level: "None", evo_to: null },
  { id: 128, name_zh: "肯泰羅", type1: "Normal", type2: "None", hp: 185, atk: 100, speed: 110, skill: "Tackle", weightTier: "heavy", kbResist: 0.85, evo_level: "None", evo_to: null },
  { id: 129, name_zh: "鯉魚王", type1: "Water", type2: "None", hp: 70, atk: 10, speed: 80, skill: "Tackle", weightTier: "light", kbResist: 0.0, evo_level: 18, evo_to: 130 },
  { id: 130, name_zh: "暴鯉龍", type1: "Water", type2: "Flying", hp: 225, atk: 125, speed: 81, skill: "Hydro Pump", weightTier: "heavy", kbResist: 0.95, evo_level: "None", evo_to: null },
  { id: 131, name_zh: "拉普拉斯", type1: "Water", type2: "Ice", hp: 260, atk: 85, speed: 60, skill: "Ice Beam", weightTier: "heavy", kbResist: 0.95, evo_level: "None", evo_to: null },
  { id: 132, name_zh: "百變怪", type1: "Normal", type2: "None", hp: 120, atk: 48, speed: 48, skill: "Metronome", weightTier: "light", kbResist: 0.15, evo_level: "None", evo_to: null },
  { id: 133, name_zh: "伊布", type1: "Normal", type2: "None", hp: 118, atk: 55, speed: 55, skill: "Tackle", weightTier: "light", kbResist: 0.15, evo_level: 18, evo_to: 134 },
  { id: 134, name_zh: "水伊布", type1: "Water", type2: "None", hp: 240, atk: 65, speed: 65, skill: "Hydro Pump", weightTier: "heavy", kbResist: 0.80, evo_level: "None", evo_to: null },
  { id: 135, name_zh: "雷伊布", type1: "Electric", type2: "None", hp: 165, atk: 65, speed: 130, skill: "Thunderbolt", weightTier: "medium", kbResist: 0.45, evo_level: "None", evo_to: null },
  { id: 136, name_zh: "火伊布", type1: "Fire", type2: "None", hp: 165, atk: 130, speed: 65, skill: "Flamethrower", weightTier: "medium", kbResist: 0.50, evo_level: "None", evo_to: null },
  { id: 137, name_zh: "多邊獸", type1: "Normal", type2: "None", hp: 145, atk: 60, speed: 40, skill: "Psystrike", weightTier: "medium", kbResist: 0.45, evo_level: "None", evo_to: null },
  { id: 138, name_zh: "菊石獸", type1: "Rock", type2: "Water", hp: 105, atk: 40, speed: 35, skill: "Hydro Pump", weightTier: "light", kbResist: 0.35, evo_level: 20, evo_to: 139 },
  { id: 139, name_zh: "多刺菊石獸", type1: "Rock", type2: "Water", hp: 175, atk: 60, speed: 55, skill: "Hydro Pump", weightTier: "heavy", kbResist: 0.85, evo_level: "None", evo_to: null },
  { id: 140, name_zh: "化石盔", type1: "Rock", type2: "Water", hp: 95, atk: 75, speed: 55, skill: "Hydro Pump", weightTier: "light", kbResist: 0.35, evo_level: 20, evo_to: 141 },
  { id: 141, name_zh: "鐮刀盔", type1: "Rock", type2: "Water", hp: 165, atk: 115, speed: 80, skill: "Karate Chop", weightTier: "heavy", kbResist: 0.85, evo_level: "None", evo_to: null },
  { id: 142, name_zh: "化石翼龍", type1: "Rock", type2: "Flying", hp: 185, atk: 105, speed: 130, skill: "Air Slash", weightTier: "heavy", kbResist: 0.85, evo_level: "None", evo_to: null },
  { id: 143, name_zh: "卡比獸", type1: "Normal", type2: "None", hp: 320, atk: 110, speed: 30, skill: "Tackle", weightTier: "heavy", kbResist: 1.0, evo_level: "None", evo_to: null },
  { id: 144, name_zh: "急凍鳥", type1: "Ice", type2: "Flying", hp: 200, atk: 85, speed: 85, skill: "Ice Beam", weightTier: "boss", kbResist: 1.0, evo_level: "None", evo_to: null },
  { id: 145, name_zh: "閃電鳥", type1: "Electric", type2: "Flying", hp: 200, atk: 90, speed: 100, skill: "Thunderbolt", weightTier: "boss", kbResist: 1.0, evo_level: "None", evo_to: null },
  { id: 146, name_zh: "火焰鳥", type1: "Fire", type2: "Flying", hp: 200, atk: 100, speed: 90, skill: "Flamethrower", weightTier: "boss", kbResist: 1.0, evo_level: "None", evo_to: null },
  { id: 147, name_zh: "迷你龍", type1: "Dragon", type2: "None", hp: 110, atk: 64, speed: 50, skill: "Dragon Rush", weightTier: "light", kbResist: 0.15, evo_level: 14, evo_to: 148 },
  { id: 148, name_zh: "哈克龍", type1: "Dragon", type2: "None", hp: 165, atk: 84, speed: 70, skill: "Dragon Rush", weightTier: "medium", kbResist: 0.45, evo_level: 24, evo_to: 149 },
  { id: 149, name_zh: "快龍", type1: "Dragon", type2: "Flying", hp: 225, atk: 134, speed: 80, skill: "Dragon Rush", weightTier: "heavy", kbResist: 0.95, evo_level: "None", evo_to: null },
  { id: 150, name_zh: "超夢", type1: "Psychic", type2: "None", hp: 240, atk: 110, speed: 130, skill: "Psystrike", weightTier: "boss", kbResist: 1.0, evo_level: "None", evo_to: null },
  { id: 151, name_zh: "夢幻", type1: "Psychic", type2: "None", hp: 220, atk: 100, speed: 100, skill: "Metronome", weightTier: "boss", kbResist: 1.0, evo_level: "None", evo_to: null }
];

function getPokemonOfficialArtworkUrl(pokeId, isShiny = false) {
  if (!pokeId) return "";
  return isShiny
    ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/shiny/${pokeId}.png`
    : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokeId}.png`;
}

POKEMON_DB.forEach(p => {
  p.forward_sprite = `https://raw.githubusercontent.com/NightCatSama/pokedex/main/images/sprite/forward/${p.id}.png`;
  p.back_sprite = `https://raw.githubusercontent.com/NightCatSama/pokedex/main/images/sprite/back/${p.id}.png`;
  p.shiny_forward_sprite = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/${p.id}.png`;
  p.shiny_back_sprite = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/shiny/${p.id}.png`;
});

const MEGA_FORMS = {
  6: {
    id: 10034,
    baseId: 6,
    starterId: 4,
    evoLineIds: [4, 5, 6],
    name_zh: "超級噴火龍X",
    badgeLabel: "MEGA X",
    type1: "Fire",
    type2: "Dragon",
    hp: 260,
    atk: 130,
    speed: 105,
    skill: "Flamethrower",
    weightTier: "heavy",
    kbResist: 0.95,
    evo_level: "None",
    evo_to: null,
    isMega: true,
    bondTrainerIds: ["ash", "red", "serena"],
    bondTrainerNames: "小智、赤紅、莎莉娜",
    reqLevel: 24,
    bondReqLevel: 23,
    reqSkills: ["Flamethrower", "Dragon Rush"],
    reqSkillSum: 10,
    reqSkillsText: "噴射火焰 ＋ 龍之俯衝 合計達 Lv.10",
    hpBoost: 1.25,
    dmgBoost: 1.18,
    armor: 0.16,
    burstType: "Dragon",
    burstColor: "#38BDF8",
    burstText: "💎 鑰石共鳴：蒼藍龍焰爆發！",
    evoPreText: "🔥 蒼藍龍焰正在覺醒，時空凍結中 🔥",
    evoDoneTitle: "🔥 MEGA 超級進化！【超級噴火龍X】黑龍降臨！",
    evoDoneSub: "屬性進化【火＋龍】‧ 蒼藍冥炎全面解放",
    megaTraitDesc: "硬爪爆發覺醒：屬性進化【火＋龍】、HP上限 +25% 回滿、全傷 +18%、16% 霸體；【噴射火焰】沿途留下蒼藍火簇持續燃燒，【龍之俯衝】附帶硬爪暴擊 +25% 與命中必灼傷！",
    stoneSprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/charizardite-x.png",
    forward_sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/10034.png",
    back_sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/10034.png"
  },
  9: {
    id: 10036,
    baseId: 9,
    starterId: 7,
    evoLineIds: [7, 8, 9],
    name_zh: "超級水箭龜",
    badgeLabel: "MEGA",
    type1: "Water",
    type2: "None",
    hp: 270,
    atk: 128,
    speed: 88,
    skill: "Hydro Pump",
    weightTier: "heavy",
    kbResist: 0.96,
    evo_level: "None",
    evo_to: null,
    isMega: true,
    bondTrainerIds: ["ash", "misty", "red"],
    bondTrainerNames: "小智、小霞、赤紅",
    reqLevel: 24,
    bondReqLevel: 23,
    reqSkills: ["WaterGun", "Hydro Pump"],
    reqSkillSum: 10,
    reqSkillsText: "水槍 ＋ 水炮 合計達 Lv.10",
    hpBoost: 1.25,
    dmgBoost: 1.18,
    armor: 0.16,
    burstType: "Water",
    burstColor: "#38BDF8",
    burstText: "💎 鑰石共鳴：深海重炮震波！",
    evoPreText: "🌊 背甲主炮超壓蓄能中，時空凍結 🌊",
    evoDoneTitle: "🌊 MEGA 超級進化！【超級水箭龜】重炮降臨！",
    evoDoneSub: "超級發射器極限突破 ‧ 背甲三管水炮齊射",
    megaTraitDesc: "重炮火力型覺醒：HP上限 +25% 並回滿、全傷害 +18%、16% 霸體減傷；【水炮】昇華為背甲巨型主炮＋雙腕副炮三管齊射，【水槍】同步強化為三連重壓水彈！",
    stoneSprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/blastoisinite.png",
    forward_sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/10036.png",
    back_sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/10036.png"
  },
  3: {
    id: 10033,
    baseId: 3,
    starterId: 1,
    evoLineIds: [1, 2, 3],
    name_zh: "超級妙蛙花",
    badgeLabel: "MEGA",
    type1: "Grass",
    type2: "Poison",
    hp: 285,
    atk: 118,
    speed: 85,
    skill: "Seed Bomb",
    weightTier: "heavy",
    kbResist: 0.95,
    evo_level: "None",
    evo_to: null,
    isMega: true,
    bondTrainerIds: ["ash", "red"],
    bondTrainerNames: "小智、赤紅",
    reqLevel: 24,
    bondReqLevel: 23,
    reqSkills: ["VineWhip", "Razor Leaf", "Seed Bomb"],
    reqSkillSum: 10,
    reqSkillsText: "藤鞭 ＋ 飛葉快刀 ＋ 種子炸彈 合計達 Lv.10",
    hpBoost: 1.30,
    dmgBoost: 1.16,
    armor: 0.20,
    burstType: "Grass",
    burstColor: "#4ADE80",
    burstText: "💎 鑰石共鳴：霸王毒花震波！",
    evoPreText: "🌺 霸王毒花盛放共鳴中，時空凍結 🌺",
    evoDoneTitle: "🌺 MEGA 超級進化！【超級妙蛙花】花王降臨！",
    evoDoneSub: "厚脂肪 20% 霸體坦續 ‧ 三藤齊舞與毒花孢子",
    megaTraitDesc: "厚脂肪坦續覺醒：HP上限 +30% 回滿、全傷 +16%、20% 霸體、免疫灼傷與冰凍並常駐光合回血；【藤鞭】昇華為 3 條粉金霸王花巨藤，【種子炸彈】落地綻放腐蝕毒花孢子霧！",
    stoneSprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/venusaurite.png",
    forward_sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/10033.png",
    back_sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/10033.png"
  },
  94: {
    id: 10038,
    baseId: 94,
    starterId: 92,
    evoLineIds: [92, 93, 94],
    name_zh: "超級耿鬼",
    badgeLabel: "MEGA",
    type1: "Ghost",
    type2: "Poison",
    hp: 245,
    atk: 138,
    speed: 130,
    skill: "Shadow Ball",
    weightTier: "medium",
    kbResist: 0.85,
    evo_level: "None",
    evo_to: null,
    isMega: true,
    bondTrainerIds: ["ash", "red", "lillie"],
    bondTrainerNames: "小智、赤紅、莉莉艾",
    reqLevel: 24,
    bondReqLevel: 23,
    reqSkills: ["Shadow Ball", "Sludge Bomb", "Psystrike"],
    reqSkillSum: 10,
    reqSkillsText: "暗影球 ＋ 污泥炸彈 ＋ 精神擊破 合計達 Lv.10",
    hpBoost: 1.22,
    dmgBoost: 1.22,
    critBoost: 0.10,
    armor: 0.14,
    burstType: "Ghost",
    burstColor: "#C084FC",
    burstText: "💎 鑰石共鳴：冥界踩影震波！",
    evoPreText: "👻 冥界踩影暗物質覺醒中，時空凍結 👻",
    evoDoneTitle: "👻 MEGA 超級進化！【超級耿鬼】冥界降臨！",
    evoDoneSub: "踩影收割覺醒 ‧ 紫紅暗影球連發與暴擊 +10%",
    megaTraitDesc: "踩影冥界收割：HP上限 +22% 回滿、全傷 +22%、暴擊 +10%、14% 霸體；【暗影球】昇華為紫紅冥火彈（彈數 +1、暴擊 +20%），【污泥炸彈】留下冥界腐蝕紫紅毒沼！",
    stoneSprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/gengarite.png",
    forward_sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/10038.png",
    back_sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/10038.png"
  },
  130: {
    id: 10041,
    baseId: 130,
    starterId: 129,
    evoLineIds: [129, 130],
    name_zh: "超級暴鯉龍",
    badgeLabel: "MEGA",
    type1: "Water",
    type2: "Dragon",
    hp: 290,
    atk: 145,
    speed: 92,
    skill: "Hydro Pump",
    weightTier: "heavy",
    kbResist: 0.96,
    evo_level: "None",
    evo_to: null,
    isMega: true,
    bondTrainerIds: ["misty", "red"],
    bondTrainerNames: "小霞、赤紅",
    reqLevel: 24,
    bondReqLevel: 23,
    reqSkills: ["Hydro Pump", "Dragon Rush", "Ice Beam"],
    reqSkillSum: 10,
    reqSkillsText: "水炮 ＋ 龍之俯衝 ＋ 冷凍光線 合計達 Lv.10",
    hpBoost: 1.28,
    dmgBoost: 1.20,
    armor: 0.18,
    burstType: "Water",
    burstColor: "#F43F5E",
    burstText: "💎 鑰石共鳴：深海狂龍怒濤！",
    evoPreText: "🌊 深海破格狂龍甦醒中，時空凍結 🌊",
    evoDoneTitle: "🐉 MEGA 超級進化！【超級暴鯉龍】深海霸主降臨！",
    evoDoneSub: "屬性進化【水＋龍】‧ 破格深海狂龍與赤紅水炮",
    megaTraitDesc: "破格深海狂龍：屬性進化【水＋龍】、HP上限 +28% 回滿、全傷 +20%、18% 霸體；【龍之俯衝】化為深海赤紅巨龍衝鋒並暴擊 +20%，【水炮】昇華為雙柱深海暗藍高壓狂濤！",
    stoneSprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/gyaradosite.png",
    forward_sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/10041.png",
    back_sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/10041.png"
  },
  142: {
    id: 10042,
    baseId: 142,
    starterId: 142,
    evoLineIds: [142],
    name_zh: "超級化石翼龍",
    badgeLabel: "MEGA",
    type1: "Rock",
    type2: "Flying",
    hp: 255,
    atk: 138,
    speed: 150,
    skill: "Air Slash",
    weightTier: "heavy",
    kbResist: 0.92,
    evo_level: "None",
    evo_to: null,
    isMega: true,
    bondTrainerIds: ["brock", "red"],
    bondTrainerNames: "小剛、赤紅",
    reqLevel: 24,
    bondReqLevel: 23,
    reqSkills: ["Air Slash", "Dragon Rush", "Earthquake"],
    reqSkillSum: 10,
    reqSkillsText: "空氣斬 ＋ 龍之俯衝 ＋ 地震 合計達 Lv.10",
    hpBoost: 1.24,
    dmgBoost: 1.18,
    speedBoost: 1.12,
    critBoost: 0.10,
    armor: 0.16,
    burstType: "Rock",
    burstColor: "#F59E0B",
    burstText: "💎 鑰石共鳴：太古蒼穹碎岩波！",
    evoPreText: "🦅 太古硬爪岩翼覺醒中，時空凍結 🦅",
    evoDoneTitle: "🦅 MEGA 超級進化！【超級化石翼龍】蒼穹霸主降臨！",
    evoDoneSub: "硬爪極速覺醒 ‧ 太古金紫岩刃風暴與移速 +12%",
    megaTraitDesc: "硬爪蒼穹霸主：HP上限 +24% 回滿、全傷 +18%、移速 +12%、暴擊 +10%、16% 霸體；【空氣斬】昇華為太古金紫岩刃風暴（刃數 +1、暴擊 +20%），【地震】範圍額外擴張 +15%！",
    stoneSprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/aerodactylite.png",
    forward_sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/10042.png",
    back_sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/10042.png"
  }
};

function getMegaFormForPokemon(pokeId) {
  if (!pokeId) return null;
  if (MEGA_FORMS[pokeId]) return MEGA_FORMS[pokeId];
  return Object.values(MEGA_FORMS).find(mf => Array.isArray(mf.evoLineIds) && mf.evoLineIds.includes(pokeId)) || null;
}

const POKEMON_MAP = new Map(POKEMON_DB.map(p => [p.id, p]));
Object.values(MEGA_FORMS).forEach(mf => {
  mf.shiny_forward_sprite = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/${mf.id}.png`;
  mf.shiny_back_sprite = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/shiny/${mf.id}.png`;
  POKEMON_MAP.set(mf.id, mf);
});
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
    walkSheet: "images/ash_walk_sheet.png",
    cutin: "images/cutin_ash_classic.png",
    sprites: {
      down: "images/Ash_01.png",
      up: "images/Ash_04.png",
      left: "images/Ash_02.png",
      right: "images/Ash_03.png"
    },
    costumes: [
      {
        id: "classic",
        name: "初代關都經典裝",
        badge: "經典裝",
        sprite: "images/Ash_01.png",
        walkSheet: "images/ash_walk_sheet.png",
        cutin: "images/cutin_ash_classic.png",
        sprites: {
          down: "images/Ash_01.png",
          up: "images/Ash_04.png",
          left: "images/Ash_02.png",
          right: "images/Ash_03.png"
        },
        cost: 0
      },
      {
        id: "cutin_tactical",
        name: "Cut-in 熱血戰術裝",
        badge: "戰術裝",
        sprite: "images/Ash_01_cutin.png",
        walkSheet: "images/ash_walk_sheet_cutin.png",
        cutin: "images/cutin_ash.png",
        sprites: {
          down: "images/Ash_01_cutin.png",
          up: "images/Ash_04.png",
          left: "images/Ash_02.png",
          right: "images/Ash_03.png"
        },
        cost: 0
      }
    ],
    cost: 0,
    skillName: "就決定是你了！",
    skillCd: 25,
    skillDuration: 6.0,
    desc: "發動後全夥伴攻速與暴擊率+25%，全場敵軍擊退阻尼削弱，立即回覆18% HP！",
    bondName: "命運搭檔",
    bondColor: "#F59E0B",
    bondPokemonIds: [25, 1, 4, 7],
    bondPreviewIds: [25, 1, 4, 7],
    mods: { dmgMult: 1.0, cdMult: 1.0, hpMult: 1.0, speedMult: 1.05, areaMult: 1.0, critBonus: 0.05, regen: 0.3, expMult: 1.10 }
  },
  {
    id: "misty",
    name: "小霞 (Misty)",
    title: "華藍道館館主",
    sprite: "images/misty_01.png",
    walkSheet: "images/misty_walk_sheet.png",
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
    desc: "召喚專屬碧藍海嘯巨浪與冰晶霜環席捲戰場，強烈震退並凍結周遭敵軍 3.5 秒！",
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
    walkSheet: "images/brock_walk_sheet.png",
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
    desc: "震退身周敵群並展開 5.5 秒岩石壁壘（減傷 55% ＋ 6 塊環繞巨岩高速反震撞飛觸碰敵軍）！",
    bondName: "磐石守護",
    bondColor: "#D97706",
    bondPokemonIds: [74, 95, 111],
    bondPreviewIds: [74, 95, 111],
    mods: { dmgMult: 0.95, cdMult: 1.05, hpMult: 1.30, speedMult: 0.95, areaMult: 1.0, critBonus: 0.0, regen: 0.8, expMult: 1.0 }
  },
  {
    id: "serena",
    name: "莎莉娜 (Serena)",
    title: "卡洛斯表演家",
    sprite: "images/serena_01.png",
    walkSheet: "images/serena_walk_sheet.png",
    cutin: "images/cutin_serena.png",
    sprites: {
      down: "images/serena_01.png",
      up: "images/serena_04.png",
      left: "images/serena_02.png",
      right: "images/serena_03.png"
    },
    costumes: [
      {
        id: "kalos_short",
        name: "短髮表演家裝",
        badge: "短髮裝",
        sprite: "images/serena_01.png",
        walkSheet: "images/serena_walk_sheet.png",
        cutin: "images/cutin_serena.png",
        sprites: {
          down: "images/serena_01.png",
          up: "images/serena_04.png",
          left: "images/serena_02.png",
          right: "images/serena_03.png"
        },
        cost: 0
      },
      {
        id: "kalos_long",
        name: "卡洛斯長髮裝",
        badge: "長髮裝",
        sprite: "images/serena_01_2.png",
        walkSheet: "images/serena_walk_sheet_2.png",
        cutin: "images/cutin_serena_2.png",
        sprites: {
          down: "images/serena_01_2.png",
          up: "images/serena_04.png",
          left: "images/serena_02.png",
          right: "images/serena_03.png"
        },
        cost: 0
      }
    ],
    cost: 350,
    skillName: "華麗雙打舞台",
    skillCd: 32,
    skillDuration: 5.5,
    desc: "展開 5.5 秒粉金華麗舞台（降敵攻 35% 並持續星光打擊）！雙打夥伴立即爆發 1.6x 強化招式，期間攻速翻倍、傷害+45%，並回復 22% HP！",
    bondName: "華麗羈絆",
    bondColor: "#F472B6",
    bondPokemonIds: [133, 4, 39],
    bondPreviewIds: [133, 4, 39],
    mods: { dmgMult: 1.0, cdMult: 1.0, hpMult: 1.0, speedMult: 1.05, areaMult: 1.0, critBonus: 0.05, regen: 0.3, expMult: 1.05, startPartner: true }
  },
  {
    id: "lillie",
    name: "莉莉艾 (Lillie)",
    title: "阿羅拉大小姐",
    sprite: "images/lillie_01.png",
    walkSheet: "images/lillie_walk_sheet.png",
    cutin: "images/cutin_lillie.png",
    sprites: {
      down: "images/lillie_01.png",
      up: "images/lillie_04.png",
      left: "images/lillie_02.png",
      right: "images/lillie_03.png"
    },
    costumes: [
      {
        id: "alola_powered",
        name: "阿羅拉全力裝",
        badge: "全力裝",
        sprite: "images/lillie_01.png",
        walkSheet: "images/lillie_walk_sheet.png",
        cutin: "images/cutin_lillie.png",
        sprites: {
          down: "images/lillie_01.png",
          up: "images/lillie_04.png",
          left: "images/lillie_02.png",
          right: "images/lillie_03.png"
        },
        cost: 0
      },
      {
        id: "classic_hat",
        name: "白帽洋裝經典裝",
        badge: "白帽裝",
        sprite: "images/lillie_01_2.png",
        walkSheet: "images/lillie_walk_sheet_2.png",
        cutin: "images/cutin_lillie_2.png",
        sprites: {
          down: "images/lillie_01_2.png",
          up: "images/lillie_04.png",
          left: "images/lillie_02.png",
          right: "images/lillie_03.png"
        },
        cost: 0
      }
    ],
    cost: 450,
    skillName: "全滿傷藥＆淨化",
    skillCd: 35,
    skillDuration: 3.0,
    desc: "立即回覆 38% 最大 HP，淨化所有負面異常，並獲得 2 秒絕對無敵！",
    bondName: "星之祈願",
    bondColor: "#34D399",
    bondPokemonIds: [35, 133, 147],
    bondPreviewIds: [35, 133, 147],
    mods: { dmgMult: 0.95, cdMult: 0.95, hpMult: 1.15, speedMult: 1.0, areaMult: 1.0, critBonus: 0.0, regen: 1.0, expMult: 1.15 }
  },
  {
    id: "red",
    name: "赤紅 (Red)",
    title: "傳奇冠軍",
    sprite: "images/red_01.png",
    walkSheet: "images/red_walk_sheet.png",
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
    mods: { dmgMult: 1.25, cdMult: 0.88, hpMult: 1.15, speedMult: 1.10, areaMult: 1.20, critBonus: 0.15, regen: 0.6, expMult: 1.20 }
  }
];

function getResolvedTrainerCostume(trainer, saveData) {
  if (!trainer) {
    return { id: "classic", name: "經典裝", badge: "經典裝", sprite: "", walkSheet: null, cutin: "", sprites: null };
  }
  const list = Array.isArray(trainer.costumes) ? trainer.costumes : [];
  if (list.length === 0) {
    return {
      id: "classic",
      name: "經典裝",
      badge: "經典裝",
      sprite: trainer.sprite,
      walkSheet: trainer.walkSheet || null,
      cutin: trainer.cutin || trainer.sprite,
      sprites: trainer.sprites || null
    };
  }
  const chosenId = (saveData && saveData.selectedCostumes && saveData.selectedCostumes[trainer.id]) || list[0].id;
  const found = list.find(c => c.id === chosenId) || list[0];
  return {
    id: found.id,
    name: found.name || "經典裝",
    badge: found.badge || "時裝",
    sprite: found.sprite || trainer.sprite,
    walkSheet: found.walkSheet || trainer.walkSheet || null,
    cutin: found.cutin || trainer.cutin || trainer.sprite,
    sprites: found.sprites || trainer.sprites || null
  };
}

// 8. 模式與難度考驗
const DIFFICULTIES = [
  { id: "casual", name: "輕鬆探索", badge: "簡易", desc: "經典輕鬆割草節奏，賞金獲取率 0.9x", hpMult: 1.00, atkMult: 1.00, spdMult: 1.00, spawnRateMult: 1.00, coinMult: 0.9, shinyBonus: 1.0, bossArmor: 0.00, healEff: 1.00, bossDpsCapPct: 0.12, telegraphMinPct: 0.00 },
  { id: "normal", name: "關都標準", badge: "標準", desc: "標準進階挑戰與神獸博弈，賞金 1.0x", hpMult: 1.20, atkMult: 1.15, spdMult: 1.04, spawnRateMult: 1.18, coinMult: 1.0, shinyBonus: 1.0, bossArmor: 0.00, healEff: 1.00, bossDpsCapPct: 0.12, telegraphMinPct: 0.00 },
  { id: "hard",   name: "大師挑戰", badge: "困難", desc: "王具 12% 減傷與回復壓制，賞金+35%、閃光 2x！", hpMult: 2.10, atkMult: 1.60, spdMult: 1.14, spawnRateMult: 1.45, coinMult: 1.35, shinyBonus: 2.0, bossArmor: 0.12, healEff: 0.80, bossDpsCapPct: 0.10, telegraphMinPct: 0.00 },
  { id: "hell",   name: "冠軍之巔", badge: "地獄", desc: "終局極限！王 22% 減傷、紅圈重創、回復 55%，賞金+80%、閃光 3x！", hpMult: 3.60, atkMult: 2.20, spdMult: 1.25, spawnRateMult: 1.75, coinMult: 1.80, shinyBonus: 3.0, bossArmor: 0.22, healEff: 0.55, bossDpsCapPct: 0.08, telegraphMinPct: 0.20 }
];

// v7.6.10 特攻手與弱勢終態基礎攻擊保底（彌補本傳物攻偏低的胡地、巴大蝶、頑皮雷彈等法師型主角）
function getEffectiveBaseAtk(pokeData) {
  if (!pokeData) return 60;
  const raw = Number(pokeData.atk) || 50;
  const isFinal = (!pokeData.evo_to || pokeData.evo_to === "None") && (pokeData.id < 10000);
  if (!isFinal) return raw;
  const spAtkMap = { 65: 96, 94: 96, 124: 90, 122: 86, 82: 92, 101: 86, 121: 90, 134: 88, 135: 90, 12: 82, 49: 82, 114: 82, 113: 78, 108: 80, 132: 78 };
  if (spAtkMap[pokeData.id]) return Math.max(raw, spAtkMap[pokeData.id]);
  if (raw < 80) return Math.max(raw, Math.round(78 + (raw - 40) * 0.25));
  return raw;
}

// 9. 寶可夢中心永久強化研究所
const CENTER_POKEMON_UPGRADES = [
  { id: "atk", name: "基礎攻擊力 (ATK)", maxLv: 5, baseCost: 150, sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/protein.png", desc: "所有招式基礎傷害提升 +8%" },
  { id: "cd",  name: "招式冷卻縮減 (CDR)", maxLv: 5, baseCost: 160, sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/carbos.png", desc: "所有招式冷卻時間縮短 -3.5%" },
  { id: "hp",  name: "最大體質生命 (HP)", maxLv: 5, baseCost: 140, sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/hp-up.png", desc: "出戰生命值提升 +12%，每秒回血 +0.4" },
  { id: "shiny", name: "閃光護符 (SHINY)", maxLv: 3, baseCost: 350, sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/shiny-charm.png", desc: "局內野生閃光怪遭遇率提升 +35%" }
];

const CENTER_TRAINER_UPGRADES = [
  { id: "megaRing", name: "超級手環 (MEGA RING)", maxLv: 1, baseCost: 1200, isSpecialSlot: true, sprite: "images/mega_ring_icon.png", desc: "全訓練家永久解鎖局內【MEGA 超級進化】權限！達成等級與招式門檻後解鎖手動【💎 MEGA】覺醒鍵（羈絆訓練家提前至 Lv.23）！" },
  { id: "fourthSlot", name: "解鎖第 4 招式槽", maxLv: 1, baseCost: 2000, isSpecialSlot: true, sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/tm-normal.png", desc: "出戰招式槽上限由 3 招擴充至 4 招！" },
  { id: "rerollCount", name: "戰術重擲 (REROLL)", maxLv: 5, baseCost: 180, sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-doll.png", desc: "升級三選一免費重抽次數每級 +1 次（免費次數用完後可消耗代幣繼續重抽）！" },
  { id: "trainerCd", name: "戰術指令靈犀", maxLv: 5, baseCost: 180, sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/soothe-bell.png", desc: "隨行訓練家大招冷卻縮減 -4%" },
  { id: "partner", name: "雙打羈絆共鳴", maxLv: 3, baseCost: 240, sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/destiny-knot.png", desc: "開局隨機召喚 1 隻夥伴，夥伴傷害+18%" },
  { id: "greed", name: "護身金幣 (COINS)", maxLv: 5, baseCost: 150, sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/amulet-coin.png", desc: "每局獲得代幣總量增加 +15%" }
];

// 10. 道館榮譽徽章與成就館 (涵蓋戰鬥、進化、MEGA、閃光、王冠、無盡深淵與 151 全圖鑑)
const ACHIEVEMENTS = [
  { id: "first_blood", name: "初出茅廬", desc: "擊退累計 100 隻野生寶可夢", reward: 150, check: (st) => (st.totalKills || 0) >= 100, progress: (st) => [st.totalKills || 0, 100] },
  { id: "hunter_500",  name: "精靈獵手", desc: "擊退累計 500 隻野生寶可夢", reward: 300, check: (st) => (st.totalKills || 0) >= 500, progress: (st) => [st.totalKills || 0, 500] },
  { id: "slayer_2000", name: "關都無雙", desc: "擊退累計 2,000 隻野生寶可夢", reward: 600, check: (st) => (st.totalKills || 0) >= 2000, progress: (st) => [st.totalKills || 0, 2000] },
  { id: "evo_master",  name: "進化之光", desc: "累計完成 5 次寶可夢戰鬥進化", reward: 250, check: (st) => (st.evolutions || 0) >= 5, progress: (st) => [st.evolutions || 0, 5] },
  { id: "super_move",  name: "極限突破", desc: "領悟並釋放 3 次究極超武技能", reward: 350, check: (st) => (st.superMoves || 0) >= 3, progress: (st) => [st.superMoves || 0, 3] },
  { id: "mega_first",  name: "💎 鑰石覺醒", desc: "首次於戰場完成【MEGA 超級進化】", reward: 500, check: (st, sv) => Object.keys(sv.megaUnlocked || {}).length >= 1, progress: (st, sv) => [Object.keys(sv.megaUnlocked || {}).length, 1] },
  { id: "mega_trio",   name: "💎 御三家 MEGA 大師", desc: "集齊超級噴火龍X、超級水箭龜與超級妙蛙花", reward: 1200, check: (st, sv) => [3, 6, 9].every(id => !!(sv.megaUnlocked && sv.megaUnlocked[id])), progress: (st, sv) => [[3, 6, 9].filter(id => !!(sv.megaUnlocked && sv.megaUnlocked[id])).length, 3] },
  { id: "mega_all6",   name: "💎 關都 MEGA 傳說宗師", desc: "集齊全部 6 隻關都超級進化形態（含耿鬼、暴鯉龍與化石翼龍）", reward: 2000, check: (st, sv) => [3, 6, 9, 94, 130, 142].every(id => !!(sv.megaUnlocked && sv.megaUnlocked[id])), progress: (st, sv) => [[3, 6, 9, 94, 130, 142].filter(id => !!(sv.megaUnlocked && sv.megaUnlocked[id])).length, 6] },
  { id: "shiny_3",     name: "✨ 閃光收藏家", desc: "於圖鑑中解鎖 3 隻不同閃光色違寶可夢", reward: 450, check: (st, sv) => Object.keys(sv.shinyUnlocked || {}).length >= 3, progress: (st, sv) => [Object.keys(sv.shinyUnlocked || {}).length, 3] },
  { id: "shiny_10",    name: "✨ 星芒獵人", desc: "於圖鑑中解鎖 10 隻不同閃光色違寶可夢", reward: 1000, check: (st, sv) => Object.keys(sv.shinyUnlocked || {}).length >= 10, progress: (st, sv) => [Object.keys(sv.shinyUnlocked || {}).length, 10] },
  { id: "crown_max",   name: "👑 金冠王者", desc: "將任意 1 隻寶可夢王冠突破至 ★3 金冠滿星", reward: 600, check: (st, sv) => Object.values(sv.pokemonStars || {}).some(v => v >= 3), progress: (st, sv) => [Object.values(sv.pokemonStars || {}).filter(v => v >= 3).length, 1] },
  { id: "beat_birds",  name: "傳說落幕", desc: "擊敗 5 分鐘降臨的傳說三聖鳥", reward: 500, check: (st) => (st.birdsDefeated || 0) >= 1, progress: (st) => [st.birdsDefeated || 0, 1] },
  { id: "beat_mewtwo", name: "終極宿命", desc: "擊退 7.5 分鐘王者超夢，解鎖【赤紅】", reward: 1000, check: (st) => (st.mewtwoDefeated || 0) >= 1, progress: (st) => [st.mewtwoDefeated || 0, 1] },
  { id: "beat_mew",    name: "始祖夢幻", desc: "擊退終極隱藏 Boss 夢幻 #151", reward: 1500, check: (st) => (st.mewDefeated || 0) >= 1, progress: (st) => [st.mewDefeated || 0, 1] },
  { id: "endless_10m", name: "♾️ 深淵行者", desc: "於【無盡深淵】模式存活超過 10 分鐘", reward: 800, check: (st) => (st.bestEndlessTime || 0) >= 600, progress: (st) => [Math.floor((st.bestEndlessTime || 0) / 60), 10] },
  { id: "dex_30",      name: "關都見習生", desc: "圖鑑登錄收服 30 隻寶可夢", reward: 300, check: (st, sv) => Object.keys(sv.pokedexCaught || {}).length >= 30, progress: (st, sv) => [Object.keys(sv.pokedexCaught || {}).length, 30] },
  { id: "dex_70",      name: "資深訓練家", desc: "圖鑑登錄收服 70 隻寶可夢", reward: 600, check: (st, sv) => Object.keys(sv.pokedexCaught || {}).length >= 70, progress: (st, sv) => [Object.keys(sv.pokedexCaught || {}).length, 70] },
  { id: "dex_151",     name: "🏆 關都圖鑑大師", desc: "登錄收服全部 151 隻關都寶可夢", reward: 3000, check: (st, sv) => Object.keys(sv.pokedexCaught || {}).length >= 151, progress: (st, sv) => [Object.keys(sv.pokedexCaught || {}).length, 151] }
];


// 10B. 關都 8 枚像素道館徽章（v7.6.0 三段階梯解鎖 ＋ 永久戰力被動 ＋ 4x2 像素精靈圖集）
const KANTO_BADGES_SHEET_URL = "images/kanto_badges_sheet.png?v=7.6.1";
const KANTO_GYM_BADGES = [
  {
    id: "boulder", name: "灰色徽章", gym: "尼比道館", type: "Rock", col: 0, row: 0, tier: "入門",
    buffText: "全精靈最大 HP +5%",
    condDesc: "累計擊敗 500 隻野怪，或單局存活達 6 分鐘",
    check: (st, sv) => (st.totalKills || 0) >= 500 || (st.bestStandardTime || 0) >= 360 || (st.bestEndlessTime || 0) >= 360,
    progress: (st) => [Math.min(500, st.totalKills || 0), 500]
  },
  {
    id: "cascade", name: "藍色徽章", gym: "華藍道館", type: "Water", col: 1, row: 0, tier: "中階",
    buffText: "經驗拾取範圍 +10%",
    condDesc: "通關【華藍海岬】，或累計完成 12 次戰鬥進化",
    check: (st, sv) => !!(st.clearedStages && st.clearedStages.cerulean_bay) || (st.evolutions || 0) >= 12,
    progress: (st) => (st.clearedStages && st.clearedStages.cerulean_bay) ? [1, 1] : [Math.min(12, st.evolutions || 0), 12]
  },
  {
    id: "thunder", name: "橙色徽章", gym: "枯葉道館", type: "Electric", col: 2, row: 0, tier: "中階",
    buffText: "全精靈移動速度 +4%",
    condDesc: "通關【無人發電廠】，或累計釋放 25 次終極超武",
    check: (st, sv) => !!(st.clearedStages && st.clearedStages.power_plant) || (st.superMoves || 0) >= 25,
    progress: (st) => (st.clearedStages && st.clearedStages.power_plant) ? [1, 1] : [Math.min(25, st.superMoves || 0), 25]
  },
  {
    id: "rainbow", name: "彩虹徽章", gym: "玉虹道館", type: "Grass", col: 3, row: 0, tier: "入門",
    buffText: "升級＆道具回血 +15%",
    condDesc: "通關【常磐密林】，或圖鑑收服達 35 隻",
    check: (st, sv) => !!(st.clearedStages && st.clearedStages.pallet) || Object.keys((sv && sv.pokedexCaught) || {}).length >= 35,
    progress: (st, sv) => (st.clearedStages && st.clearedStages.pallet) ? [1, 1] : [Math.min(35, Object.keys((sv && sv.pokedexCaught) || {}).length), 35]
  },
  {
    id: "soul", name: "粉紅徽章", gym: "淺紅道館", type: "Poison", col: 0, row: 1, tier: "中階",
    buffText: "異常狀態觸發率 +8%",
    condDesc: "擁有任 1 隻 ★3 金冠滿星精靈，或無盡深淵存活 10 分鐘",
    check: (st, sv) => Object.values((sv && sv.pokemonStars) || {}).some(v => v >= 3) || (st.bestEndlessTime || 0) >= 600,
    progress: (st, sv) => Object.values((sv && sv.pokemonStars) || {}).some(v => v >= 3) ? [1, 1] : [Math.min(10, Math.floor((st.bestEndlessTime || 0) / 60)), 10]
  },
  {
    id: "marsh", name: "金黃徽章", gym: "金黃道館", type: "Psychic", col: 1, row: 1, tier: "終局",
    buffText: "全招式冷卻縮減 -3%",
    condDesc: "通關【石英高原】，或擊敗傳說三聖鳥累計 3 次",
    check: (st, sv) => !!(st.clearedStages && st.clearedStages.sky_pillar) || (st.birdsDefeated || 0) >= 3,
    progress: (st) => (st.clearedStages && st.clearedStages.sky_pillar) ? [1, 1] : [Math.min(3, st.birdsDefeated || 0), 3]
  },
  {
    id: "volcano", name: "深紅徽章", gym: "紅蓮道館", type: "Fire", col: 2, row: 1, tier: "終局",
    buffText: "全精靈基礎攻擊 +5%",
    condDesc: "通關【紅蓮火山】，或解鎖累計 3 隻 MEGA 形態",
    check: (st, sv) => !!(st.clearedStages && st.clearedStages.cinnabar_volcano) || Object.keys((sv && sv.megaUnlocked) || {}).length >= 3,
    progress: (st, sv) => (st.clearedStages && st.clearedStages.cinnabar_volcano) ? [1, 1] : [Math.min(3, Object.keys((sv && sv.megaUnlocked) || {}).length), 3]
  },
  {
    id: "earth", name: "綠色徽章", gym: "常磐道館", type: "Ground", col: 3, row: 1, tier: "終局",
    buffText: "暴擊率 +5% ＆ 代幣 +10%",
    condDesc: "通關【關都大遠征 20+1】，或於 1vs1 鬥技場擊敗 3 隻神獸",
    check: (st, sv) => (st.expeditionClears || 0) >= 1 || Object.keys((st && st.arenaBestTimes) || {}).length >= 3,
    progress: (st) => (st.expeditionClears || 0) >= 1 ? [1, 1] : [Math.min(3, Object.keys((st && st.arenaBestTimes) || {}).length), 3]
  }
];

function getKantoBadgeBonuses(saveData) {
  const st = (saveData && saveData.stats) || {};
  const b = {
    count: 0, unlockedMap: {},
    hpMult: 1.0, magnetMult: 1.0, speedMult: 1.0, healMult: 1.0,
    statusBonus: 0, cdMult: 1.0, atkMult: 1.0, critBonus: 0, coinMult: 1.0
  };
  KANTO_GYM_BADGES.forEach(badge => {
    const ok = !!badge.check(st, saveData);
    b.unlockedMap[badge.id] = ok;
    if (!ok) return;
    b.count += 1;
    if (badge.id === "boulder") b.hpMult *= 1.05;
    else if (badge.id === "cascade") b.magnetMult *= 1.10;
    else if (badge.id === "thunder") b.speedMult *= 1.04;
    else if (badge.id === "rainbow") b.healMult *= 1.15;
    else if (badge.id === "soul") b.statusBonus += 0.08;
    else if (badge.id === "marsh") b.cdMult *= 0.97;
    else if (badge.id === "volcano") b.atkMult *= 1.05;
    else if (badge.id === "earth") { b.critBonus += 0.05; b.coinMult *= 1.10; }
  });
  return b;
}

function renderKantoBadgeIconHTML(badge, unlocked, sizePx = 42) {
  const posX = (badge.col / 3) * 100;
  const posY = badge.row * 100;
  const filterCss = unlocked
    ? "drop-shadow(0 0 6px rgba(250,204,21,0.55))"
    : "brightness(0.18) saturate(0) opacity(0.52)";
  return `<span style="display:block;width:${sizePx}px;height:${sizePx}px;background-image:url('${KANTO_BADGES_SHEET_URL}');background-size:400% 200%;background-position:${posX}% ${posY}%;background-repeat:no-repeat;image-rendering:pixelated;filter:${filterCss};flex-shrink:0;"></span>`;
}

// 取得該精靈在第 4 招式槽「本系與特性優先」模式下的所有候選招式（供大廳招式整備抽屜預覽與停用）
function getFourthSlotPoolForPokemon(poke) {
  if (!poke || typeof SKILLS_CATALOG === "undefined") return [];
  const natSkills = (typeof getNaturalSkillsForPokemon === "function") ? getNaturalSkillsForPokemon(poke) : [];
  const natClean = new Set(natSkills.map(id => (id || "").replace(/\s+/g, "")));
  const trait = (typeof getPokemonInnateTrait === "function") ? getPokemonInnateTrait(poke, 1) : null;
  const traitAffinityMap = {
    heavy_slam:         ["Ground", "Rock", "Normal", "Fighting", "Fire", "Dragon"],
    quick_attack:       ["Electric", "Flying", "Bug", "Normal", "Fighting", "Psychic"],
    iron_fist:          ["Fighting", "Bug", "Ghost", "Normal", "Ground", "Rock"],
    mega_launcher:      ["Water", "Ice", "Dragon", "Psychic"],
    overgrow_thorn:     ["Grass", "Poison", "Bug"],
    dragon_maw:         ["Fire", "Dragon", "Flying", "Rock", "Ground"],
    psychic_surge:      ["Psychic", "Ghost", "Poison", "Electric"],
    legendary_pressure: ["Psychic", "Dragon", "Ice", "Electric", "Fire", "Flying", "Rock"]
  };
  const traitTypes = (trait && traitAffinityMap[trait.id]) ? traitAffinityMap[trait.id] : [];
  const seenNames = new Set();
  const res = [];
  Object.values(SKILLS_CATALOG).forEach(meta => {
    if (!meta || meta.id === "Metronome") return;
    const clean = (meta.id || "").replace(/\s+/g, "");
    if (natClean.has(clean) || seenNames.has(meta.name)) return;
    const isStab = (meta.type === poke.type1) || (poke.type2 && poke.type2 !== "None" && meta.type === poke.type2);
    const isTrait = traitTypes.includes(meta.type);
    if (isStab || isTrait) {
      seenNames.add(meta.name);
      res.push({ meta, isStab });
    }
  });
  res.sort((a, b) => (b.isStab ? 1 : 0) - (a.isStab ? 1 : 0));
  return res;
}

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

// 12. Sprite 快取載入器 (移除 crossOrigin 避免與 HTML <img> 標籤產生快取模式衝突，並支援網路瞬斷自動重試)
const SpriteCache = {
  cache: new Map(),
  shinyCache: new Map(),
  silhouetteCache: new Map(),
  // 釋放暫態離線剪影畫布，主動回收 iOS Safari GPU 顯存以防止第二局黑屏
  clearVolatileCaches() {
    this.silhouetteCache.forEach(can => {
      try { can.width = 0; can.height = 0; } catch (e) {}
    });
    this.silhouetteCache.clear();
  },
  toOfficialShinyUrl(url) {
    if (!url || typeof url !== "string") return url;
    if (url.includes("/shiny/")) return url;
    const mNight = url.match(/\/images\/sprite\/(forward|back)\/(\d+)\.png$/);
    if (mNight) {
      const dir = mNight[1] === "back" ? "back/shiny" : "shiny";
      return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${dir}/${mNight[2]}.png`;
    }
    const mPokeApi = url.match(/\/sprites\/pokemon\/(back\/)?(\d+)\.png$/);
    if (mPokeApi) {
      const dir = mPokeApi[1] ? "back/shiny" : "shiny";
      return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${dir}/${mPokeApi[2]}.png`;
    }
    return url;
  },
  getShiny(url) {
    if (!url) return null;
    const shinyUrl = this.toOfficialShinyUrl(url);
    const shinyRec = this.get(shinyUrl);
    if (shinyRec && shinyRec.loaded) return shinyRec;
    // 官方閃光圖載入中或異常時，無縫降級回原圖避免閃爍隱形
    return this.get(url);
  },
  getSilhouette(imgOrUrl, color = "#FFFFFF") {
    const key = typeof imgOrUrl === "string" ? `${imgOrUrl}|${color}` : `${imgOrUrl.src || "img"}|${color}`;
    if (this.silhouetteCache.has(key)) return this.silhouetteCache.get(key);

    const srcImg = typeof imgOrUrl === "string" ? (this.get(imgOrUrl)?.img) : imgOrUrl;
    if (!srcImg || !(srcImg.complete || srcImg.naturalWidth > 0 || srcImg.width > 0)) return null;

    const w = Math.min(128, srcImg.naturalWidth || srcImg.width || 64);
    const h = Math.min(128, srcImg.naturalHeight || srcImg.height || 64);
    const can = document.createElement("canvas");
    can.width = w;
    can.height = h;
    const c = can.getContext("2d");
    c.drawImage(srcImg, 0, 0, w, h);
    c.globalCompositeOperation = "source-in";
    c.fillStyle = color;
    c.fillRect(0, 0, w, h);
    c.globalCompositeOperation = "source-over";

    if (this.silhouetteCache.size > 360) {
      const oldest = this.silhouetteCache.keys().next().value;
      if (oldest) this.silhouetteCache.delete(oldest);
    }
    this.silhouetteCache.set(key, can);
    return can;
  },
  toBackupCdnUrl(url) {
    if (!url || typeof url !== "string") return url;
    // 自動將 GitHub Raw 轉為全球高速 jsDelivr CDN 鏡像，徹底解決 429 限流掉圖
    if (url.startsWith("https://raw.githubusercontent.com/")) {
      const rest = url.replace("https://raw.githubusercontent.com/", "");
      const parts = rest.split("/");
      if (parts.length >= 4) {
        const user = parts[0], repo = parts[1], branch = parts[2];
        const filePath = parts.slice(3).join("/");
        return `https://cdn.jsdelivr.net/gh/${user}/${repo}@${branch}/${filePath}`;
      }
    }
    return url;
  },
  resolveUrl(url) {
    if (!url) return url;
    const rec = this.cache.get(url);
    if (rec && rec.loaded && rec.activeUrl) return rec.activeUrl;
    return url;
  },
  onFinish(url, callback) {
    const rec = this.get(url);
    if (!rec || rec.loaded || rec.error) {
      callback();
      return;
    }
    rec.listeners.push(callback);
  },
  get(url) {
    if (!url) return null;
    if (this.cache.has(url)) {
      const existing = this.cache.get(url);
      if (existing.error && (existing.retries || 0) < 4 && !existing.retrying) {
        existing.retrying = true;
        existing.retries = (existing.retries || 0) + 1;
        const nextUrl = (existing.retries % 2 === 1) ? this.toBackupCdnUrl(url) : url;
        setTimeout(() => {
          existing.error = false;
          existing.retrying = false;
          existing.activeUrl = nextUrl;
          existing.img.src = nextUrl;
        }, 300 * existing.retries);
      }
      return existing;
    }
    const img = new Image();
    const rec = { img, loaded: false, error: false, retries: 0, retrying: false, activeUrl: url, listeners: [] };
    const notifyListeners = () => {
      while (rec.listeners.length > 0) {
        try { rec.listeners.shift()(); } catch (e) {}
      }
    };
    img.onload = () => {
      rec.loaded = true;
      rec.error = false;
      rec.retrying = false;
      notifyListeners();
    };
    img.onerror = () => {
      if (rec.retries < 3) {
        rec.retries += 1;
        rec.retrying = true;
        const fallbackUrl = (rec.retries % 2 === 1) ? this.toBackupCdnUrl(url) : url;
        setTimeout(() => {
          rec.retrying = false;
          rec.activeUrl = fallbackUrl;
          img.src = fallbackUrl;
        }, 250 * rec.retries);
      } else {
        rec.error = true;
        rec.retrying = false;
        notifyListeners();
      }
    };
    img.src = url;
    this.cache.set(url, rec);
    return rec;
  }
};

// 全局 DOM <img> 自動 CDN 備援監聽器：任何介面圖片若從 GitHub Raw 載入失敗，自動無縫切換至 jsDelivr CDN 或精靈球兜底圖
window.addEventListener("error", (ev) => {
  const el = ev.target;
  if (el && el.tagName === "IMG" && el.src) {
    const curSrc = el.getAttribute("src") || el.src;
    const retryStep = parseInt(el.dataset.cdnRetry || "0", 10);
    if (retryStep === 0 && curSrc.includes("raw.githubusercontent.com")) {
      el.dataset.cdnRetry = "1";
      el.src = SpriteCache.toBackupCdnUrl(curSrc);
    } else if (retryStep <= 1 && !curSrc.includes("poke-ball.png")) {
      el.dataset.cdnRetry = "2";
      el.src = "https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/items/poke-ball.png";
    }
  }
}, true);

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

  // 6 大隨行訓練家專屬戰術指令語音 (Cut-in Voice MP3)
  voiceUrls: {
    ash: "audio/voice_ash.mp3",
    misty: "audio/voice_misty.mp3",
    brock: "audio/voice_brock.mp3",
    serena: "audio/voice_serena.mp3",
    lillie: "audio/voice_lillie.mp3",
    red: "audio/voice_red.mp3"
  },
  voiceElements: {},

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
      // 主軌防破音動態壓限器 (DynamicsCompressorNode)：確保百怪＋雙超武齊發時手機喇叭不破音
      this.masterCompressor = this.ctx.createDynamicsCompressor();
      this.masterCompressor.threshold.setValueAtTime(-14, this.ctx.currentTime);
      this.masterCompressor.knee.setValueAtTime(18, this.ctx.currentTime);
      this.masterCompressor.ratio.setValueAtTime(6, this.ctx.currentTime);
      this.masterCompressor.attack.setValueAtTime(0.004, this.ctx.currentTime);
      this.masterCompressor.release.setValueAtTime(0.14, this.ctx.currentTime);
      this.masterCompressor.connect(this.ctx.destination);

      this.bgmGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.bgmGain.connect(this.masterCompressor);
      this.sfxGain.connect(this.masterCompressor);
      this.bgmGain.gain.setValueAtTime(this.muted ? 0 : 0.35, this.ctx.currentTime);
      this.sfxGain.gain.setValueAtTime(this.muted ? 0 : 0.44, this.ctx.currentTime);
      if (this.ctx.state === "suspended") {
        this.ctx.resume().catch(() => {});
      }
    }
    this.preloadVoices();
  },

  preloadVoices() {
    Object.entries(this.voiceUrls).forEach(([key, url]) => {
      if (!this.voiceElements[key]) {
        try {
          const audio = new Audio();
          audio.preload = "auto";
          audio.src = url;
          this.voiceElements[key] = audio;
        } catch (e) {}
      }
      if (this.ctx && !this.audioBuffers[`voice_${key}`]) {
        this.preloadTrack(`voice_${key}`, url);
      }
    });
  },

  playTrainerVoice(trainerId) {
    if (this.muted || !trainerId) return;
    this.init();
    const voiceKey = `voice_${trainerId}`;
    const url = this.voiceUrls[trainerId] || `audio/voice_${trainerId}.mp3`;

    // 啟動 BGM 自動閃避 (Audio Ducking)：發動戰術語音瞬間將背景音樂壓低至 10%，1.6 秒後平滑恢復，凸顯熱血人聲台詞！
    if (this.bgmGain && this.ctx && !this.muted) {
      const now = this.ctx.currentTime;
      this.bgmGain.gain.cancelScheduledValues(now);
      this.bgmGain.gain.setValueAtTime(this.bgmGain.gain.value, now);
      this.bgmGain.gain.linearRampToValueAtTime(0.08, now + 0.06);
      this.bgmGain.gain.setValueAtTime(0.08, now + 1.45);
      this.bgmGain.gain.linearRampToValueAtTime(0.35, now + 2.0);
    }

    // 1. 優先使用已解碼的 WebAudio Buffer 播放（iOS / 手機零延遲且音量飽滿）
    if (this.ctx && this.audioBuffers[voiceKey]) {
      try {
        if (this.currentVoiceSource) {
          try { this.currentVoiceSource.stop(); } catch (e) {}
        }
        const source = this.ctx.createBufferSource();
        source.buffer = this.audioBuffers[voiceKey];
        const vGain = this.ctx.createGain();
        vGain.gain.setValueAtTime(1.15, this.ctx.currentTime);
        source.connect(vGain);
        vGain.connect(this.ctx.destination);
        source.start(0);
        this.currentVoiceSource = source;
        return;
      } catch (e) {}
    }

    // 2. 備援：使用 HTML5 Audio 元素直接播放本地 MP3（支援 file:// 與首次即時觸發）
    try {
      let el = this.voiceElements[trainerId];
      if (!el) {
        el = new Audio(url);
        this.voiceElements[trainerId] = el;
      }
      el.muted = this.muted;
      el.volume = 1.0;
      el.currentTime = 0;
      const playPromise = el.play();
      if (playPromise && playPromise.catch) {
        playPromise.catch(() => {});
      }
      // 同步背景預載進 WebAudio Buffer 供下次零延遲使用
      if (this.ctx && !this.audioBuffers[voiceKey]) {
        this.preloadTrack(voiceKey, url);
      }
    } catch (e) {}
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
    Object.values(this.voiceElements || {}).forEach(el => {
      if (el) el.muted = this.muted;
    });
    return this.muted;
  },

  lastSfxTimes: {},
  _gemComboCount: 0,
  _lastGemMs: 0,
  _noiseBuffer: null,

  getNoiseBuffer() {
    if (!this.ctx) return null;
    if (this._noiseBuffer) return this._noiseBuffer;
    const bufSize = Math.floor(this.ctx.sampleRate * 0.36);
    const buffer = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this._noiseBuffer = buffer;
    return buffer;
  },

  play(type, moveType = null) {
    if (this.muted) return;
    const perfNow = performance.now();
    // 分頻獨立節流（依招式/事件類型各自冷卻，徹底避免多招齊發互相吃音）
    if (type === "hit" || type === "gem" || type === "coin" || type === "hurt") {
      const catKey = type === "hit" ? `hit_${moveType || "default"}` : type;
      const minGap = type === "gem" ? 42 : (type === "coin" ? 55 : (type === "hurt" ? 120 : (moveType === "Fire" || moveType === "Water" ? 110 : 75)));
      if (this.lastSfxTimes[catKey] && (perfNow - this.lastSfxTimes[catKey]) < minGap) return;
      this.lastSfxTimes[catKey] = perfNow;
    }
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const dest = this.sfxGain || this.ctx.destination;

      if (type === "gem") {
        // 💎 經驗水晶連吸升調（1.2 秒內連續拾取沿五聲音階爬升：C6 -> D6 -> E6 -> G6 -> A6 -> C7 -> D7 -> E7）
        if (perfNow - this._lastGemMs <= 1200) {
          this._gemComboCount = Math.min(7, (this._gemComboCount || 0) + 1);
        } else {
          this._gemComboCount = 0;
        }
        this._lastGemMs = perfNow;
        const scale = [1046.5, 1174.66, 1318.51, 1567.98, 1760.0, 2093.0, 2349.32, 2637.02];
        const freq = scale[this._gemComboCount] || 1046.5;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.12, now + 0.075);
        gain.gain.setValueAtTime(0.14, now);
        gain.gain.exponentialRampToValueAtTime(0.005, now + 0.09);
        osc.connect(gain);
        gain.connect(dest);
        osc.start(now);
        osc.stop(now + 0.095);
        return;
      }

      if (type === "coin") {
        // 💰 經典金屬金幣「叮－鈴！」(B5 -> E6)
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(987.77, now);
        osc.frequency.setValueAtTime(1318.51, now + 0.055);
        gain.gain.setValueAtTime(0.13, now);
        gain.gain.exponentialRampToValueAtTime(0.005, now + 0.19);
        osc.connect(gain);
        gain.connect(dest);
        osc.start(now);
        osc.stop(now + 0.20);
        return;
      }

      if (type === "hurt") {
        // 💔 主角／訓練家受創獨立警示音（低沉雙拍「咚－嗡」，混戰中光靠耳朵即能察覺掉血）
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(155, now);
        osc.frequency.exponentialRampToValueAtTime(88, now + 0.075);
        osc.frequency.setValueAtTime(112, now + 0.08);
        osc.frequency.exponentialRampToValueAtTime(58, now + 0.18);
        gain.gain.setValueAtTime(0.24, now);
        gain.gain.exponentialRampToValueAtTime(0.008, now + 0.19);
        osc.connect(gain);
        gain.connect(dest);
        osc.start(now);
        osc.stop(now + 0.195);
        return;
      }

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(dest);

      if (type === "hit") {
        // 全屬性 WebAudio 濾波合成音效引擎（零外部流量、低延遲、具材質辨識度）
        if (moveType === "Fire") {
          // 🔥 火系（火花／噴射火焰）：帶通濾波白噪音掃頻（350Hz -> 1300Hz -> 280Hz，0.28s）模擬燃燒氣流「呼——嘶！」＋ 尾段火星劈啪
          osc.type = "triangle";
          osc.frequency.setValueAtTime(190, now);
          osc.frequency.exponentialRampToValueAtTime(65, now + 0.16);
          gain.gain.setValueAtTime(0.08, now);
          gain.gain.exponentialRampToValueAtTime(0.005, now + 0.17);
          osc.start(now);
          osc.stop(now + 0.175);

          const nBuf = this.getNoiseBuffer();
          if (nBuf) {
            const nSrc = this.ctx.createBufferSource();
            nSrc.buffer = nBuf;
            const bp = this.ctx.createBiquadFilter();
            bp.type = "bandpass";
            bp.Q.setValueAtTime(1.6, now);
            bp.frequency.setValueAtTime(360, now);
            bp.frequency.exponentialRampToValueAtTime(1320, now + 0.09);
            bp.frequency.exponentialRampToValueAtTime(280, now + 0.28);

            const nGain = this.ctx.createGain();
            nGain.gain.setValueAtTime(0.01, now);
            nGain.gain.linearRampToValueAtTime(0.26, now + 0.045);
            nGain.gain.exponentialRampToValueAtTime(0.008, now + 0.28);

            nSrc.connect(bp);
            bp.connect(nGain);
            nGain.connect(dest);
            nSrc.start(now);
            nSrc.stop(now + 0.29);

            // 火星劈啪爆裂微點 (Highpass crackle)
            const crackSrc = this.ctx.createBufferSource();
            crackSrc.buffer = nBuf;
            const hp = this.ctx.createBiquadFilter();
            hp.type = "highpass";
            hp.frequency.setValueAtTime(3200, now + 0.10);
            const cGain = this.ctx.createGain();
            cGain.gain.setValueAtTime(0.001, now);
            cGain.gain.setValueAtTime(0.10, now + 0.11);
            cGain.gain.exponentialRampToValueAtTime(0.005, now + 0.16);
            crackSrc.connect(hp);
            hp.connect(cGain);
            cGain.connect(dest);
            crackSrc.start(now + 0.10);
            crackSrc.stop(now + 0.17);
          }
        } else if (moveType === "Water") {
          // 🌊 水系（水槍／水炮）：低通濾波沖刷水聲（900Hz -> 320Hz）＋ 快速上升氣泡正弦滑音
          osc.type = "sine";
          osc.frequency.setValueAtTime(360 + Math.random() * 40, now);
          osc.frequency.exponentialRampToValueAtTime(760, now + 0.11);
          gain.gain.setValueAtTime(0.11, now);
          gain.gain.exponentialRampToValueAtTime(0.006, now + 0.13);
          osc.start(now);
          osc.stop(now + 0.135);

          const nBuf = this.getNoiseBuffer();
          if (nBuf) {
            const nSrc = this.ctx.createBufferSource();
            nSrc.buffer = nBuf;
            const lp = this.ctx.createBiquadFilter();
            lp.type = "lowpass";
            lp.Q.setValueAtTime(2.2, now);
            lp.frequency.setValueAtTime(950, now);
            lp.frequency.exponentialRampToValueAtTime(320, now + 0.22);

            const nGain = this.ctx.createGain();
            nGain.gain.setValueAtTime(0.22, now);
            nGain.gain.exponentialRampToValueAtTime(0.008, now + 0.22);
            nSrc.connect(lp);
            lp.connect(nGain);
            nGain.connect(dest);
            nSrc.start(now);
            nSrc.stop(now + 0.23);
          }
        } else if (moveType === "Grass" || moveType === "Bug") {
          // 🌿 草／蟲系（藤鞭／飛葉／種子）：高通濾波瞬時抽裂「啪！」＋ 俐落切音
          osc.type = "triangle";
          osc.frequency.setValueAtTime(580 + Math.random() * 60, now);
          osc.frequency.exponentialRampToValueAtTime(175, now + 0.065);
          gain.gain.setValueAtTime(0.13, now);
          gain.gain.exponentialRampToValueAtTime(0.006, now + 0.07);
          osc.start(now);
          osc.stop(now + 0.075);

          const nBuf = this.getNoiseBuffer();
          if (nBuf) {
            const nSrc = this.ctx.createBufferSource();
            nSrc.buffer = nBuf;
            const hp = this.ctx.createBiquadFilter();
            hp.type = "highpass";
            hp.frequency.setValueAtTime(1800, now);
            const nGain = this.ctx.createGain();
            nGain.gain.setValueAtTime(0.18, now);
            nGain.gain.exponentialRampToValueAtTime(0.006, now + 0.065);
            nSrc.connect(hp);
            hp.connect(nGain);
            nGain.connect(dest);
            nSrc.start(now);
            nSrc.stop(now + 0.07);
          }
        } else if (moveType === "Flying") {
          // 💨 飛行系（空氣斬）：高 Q 帶通銳利風切「咻！」掃頻
          osc.type = "sine";
          osc.frequency.setValueAtTime(760, now);
          osc.frequency.exponentialRampToValueAtTime(320, now + 0.11);
          gain.gain.setValueAtTime(0.09, now);
          gain.gain.exponentialRampToValueAtTime(0.005, now + 0.12);
          osc.start(now);
          osc.stop(now + 0.125);

          const nBuf = this.getNoiseBuffer();
          if (nBuf) {
            const nSrc = this.ctx.createBufferSource();
            nSrc.buffer = nBuf;
            const bp = this.ctx.createBiquadFilter();
            bp.type = "bandpass";
            bp.Q.setValueAtTime(3.2, now);
            bp.frequency.setValueAtTime(1200, now);
            bp.frequency.exponentialRampToValueAtTime(2400, now + 0.045);
            bp.frequency.exponentialRampToValueAtTime(620, now + 0.14);
            const nGain = this.ctx.createGain();
            nGain.gain.setValueAtTime(0.18, now);
            nGain.gain.exponentialRampToValueAtTime(0.006, now + 0.14);
            nSrc.connect(bp);
            bp.connect(nGain);
            nGain.connect(dest);
            nSrc.start(now);
            nSrc.stop(now + 0.15);
          }
        } else if (moveType === "Poison") {
          // ☠️ 毒系（污泥炸彈）：黏稠低頻氣泡「咕嚕」彈音
          osc.type = "sine";
          osc.frequency.setValueAtTime(165, now);
          osc.frequency.exponentialRampToValueAtTime(310, now + 0.055);
          osc.frequency.exponentialRampToValueAtTime(135, now + 0.125);
          gain.gain.setValueAtTime(0.17, now);
          gain.gain.exponentialRampToValueAtTime(0.006, now + 0.13);
          osc.start(now);
          osc.stop(now + 0.135);
        } else if (moveType === "Ground" || moveType === "Rock") {
          // 🪨 地面／岩石系（地震）：沉重低頻下潛 ＋ 低通岩土悶響
          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(118 + Math.random() * 16, now);
          osc.frequency.exponentialRampToValueAtTime(26, now + 0.13);
          gain.gain.setValueAtTime(0.20, now);
          gain.gain.exponentialRampToValueAtTime(0.008, now + 0.135);
          osc.start(now);
          osc.stop(now + 0.14);

          const nBuf = this.getNoiseBuffer();
          if (nBuf) {
            const nSrc = this.ctx.createBufferSource();
            nSrc.buffer = nBuf;
            const lp = this.ctx.createBiquadFilter();
            lp.type = "lowpass";
            lp.frequency.setValueAtTime(420, now);
            const nGain = this.ctx.createGain();
            nGain.gain.setValueAtTime(0.16, now);
            nGain.gain.exponentialRampToValueAtTime(0.008, now + 0.11);
            nSrc.connect(lp);
            lp.connect(nGain);
            nGain.connect(dest);
            nSrc.start(now);
            nSrc.stop(now + 0.12);
          }
        } else if (moveType === "Ice") {
          // ❄️ 冰系（冷凍光線）：清脆高頻冰晶折射雙泛音
          osc.type = "sine";
          const f0 = 1120 + (Math.random() - 0.5) * 80;
          osc.frequency.setValueAtTime(f0, now);
          osc.frequency.exponentialRampToValueAtTime(f0 * 1.45, now + 0.09);
          gain.gain.setValueAtTime(0.13, now);
          gain.gain.exponentialRampToValueAtTime(0.005, now + 0.10);
          osc.start(now);
          osc.stop(now + 0.105);
        } else if (moveType === "Psychic" || moveType === "Ghost") {
          // 🔮 超能／幽靈系：空靈共振念波滑音
          osc.type = "sine";
          const f0 = moveType === "Psychic" ? 720 : 540;
          osc.frequency.setValueAtTime(f0 + (Math.random() - 0.5) * 50, now);
          osc.frequency.exponentialRampToValueAtTime(f0 * 0.44, now + 0.11);
          gain.gain.setValueAtTime(0.15, now);
          gain.gain.exponentialRampToValueAtTime(0.006, now + 0.115);
          osc.start(now);
          osc.stop(now + 0.12);
        } else if (moveType === "Electric") {
          // ⚡ 電系（十萬伏特）：高頻電漿跳變劈啪聲
          osc.type = "square";
          osc.frequency.setValueAtTime(560, now);
          osc.frequency.setValueAtTime(260, now + 0.022);
          osc.frequency.setValueAtTime(720, now + 0.045);
          osc.frequency.setValueAtTime(340, now + 0.068);
          gain.gain.setValueAtTime(0.12, now);
          gain.gain.exponentialRampToValueAtTime(0.006, now + 0.095);
          osc.start(now);
          osc.stop(now + 0.10);
        } else if (moveType === "Fighting" || moveType === "Normal" || moveType === "Dragon") {
          // 🥊 格鬥／一般／龍系：厚實拳風破空重擊下潛
          osc.type = "triangle";
          osc.frequency.setValueAtTime(178 + (Math.random() - 0.5) * 20, now);
          osc.frequency.exponentialRampToValueAtTime(34, now + 0.095);
          gain.gain.setValueAtTime(0.22, now);
          gain.gain.exponentialRampToValueAtTime(0.008, now + 0.10);
          osc.start(now);
          osc.stop(now + 0.105);
        } else {
          // 通用介面輕點回饋
          osc.type = "triangle";
          osc.frequency.setValueAtTime(320, now);
          osc.frequency.exponentialRampToValueAtTime(160, now + 0.055);
          gain.gain.setValueAtTime(0.11, now);
          gain.gain.exponentialRampToValueAtTime(0.006, now + 0.06);
          osc.start(now);
          osc.stop(now + 0.065);
        }
      } else if (type === "evolution") {
        // GBA 經典進化旋律 (哒-哒-哒-哒 加速交替音階 + 1.35s 破殼大三和弦勝利樊音)
        osc.type = "square";
        const notes = [
          [0.00, 392.00], [0.16, 349.23], [0.32, 392.00], [0.46, 349.23],
          [0.60, 440.00], [0.72, 392.00], [0.84, 440.00], [0.94, 392.00],
          [1.04, 493.88], [1.12, 440.00], [1.20, 493.88], [1.28, 523.25],
          [1.35, 587.33], [1.46, 659.25], [1.58, 783.99]
        ];
        notes.forEach(([tOff, freq]) => {
          osc.frequency.setValueAtTime(freq, now + tOff);
        });
        gain.gain.setValueAtTime(0.22, now);
        gain.gain.setValueAtTime(0.24, now + 1.35);
        gain.gain.linearRampToValueAtTime(0.01, now + 1.85);
        osc.start(now);
        osc.stop(now + 1.85);
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
      } else if (type === "boss_encounter") {
        // 經典掌機 1.85s Boss 遇敵專屬晶片合成前奏（警報急音 ➔ 雙聲部爬升 ➔ 破影重音和弦）
        const leadNotes = [
          // Beat 1: 遇敵閃屏急促警報 (0.00 - 0.36s)
          { f: 1318.5, t: 0.00, d: 0.055, v: 0.14, w: "square" },
          { f: 1244.5, t: 0.06, d: 0.055, v: 0.14, w: "square" },
          { f: 1318.5, t: 0.12, d: 0.055, v: 0.14, w: "square" },
          { f: 1244.5, t: 0.18, d: 0.055, v: 0.14, w: "square" },
          { f: 1046.5, t: 0.24, d: 0.055, v: 0.15, w: "square" },
          { f: 987.77, t: 0.30, d: 0.060, v: 0.15, w: "square" },
          // Beat 2: 剪影滑入張力爬升 (0.38 - 0.90s)
          { f: 440.00, t: 0.38, d: 0.08, v: 0.15, w: "square" },
          { f: 493.88, t: 0.47, d: 0.08, v: 0.15, w: "square" },
          { f: 523.25, t: 0.56, d: 0.08, v: 0.16, w: "square" },
          { f: 587.33, t: 0.65, d: 0.08, v: 0.16, w: "square" },
          { f: 659.25, t: 0.74, d: 0.08, v: 0.17, w: "square" },
          { f: 783.99, t: 0.83, d: 0.09, v: 0.18, w: "square" },
          // Beat 3: 破影顯形 + 精靈球爆發定音和弦 (0.94 - 1.85s)
          { f: 880.00, t: 0.94, d: 0.16, v: 0.20, w: "square" },
          { f: 1046.5, t: 1.12, d: 0.14, v: 0.19, w: "square" },
          { f: 1174.7, t: 1.28, d: 0.14, v: 0.20, w: "square" },
          { f: 1318.5, t: 1.44, d: 0.42, v: 0.20, w: "square" },
          // 低音伴奏與定音鼓衝擊
          { f: 146.83, t: 0.38, d: 0.16, v: 0.18, w: "sawtooth" },
          { f: 164.81, t: 0.56, d: 0.16, v: 0.18, w: "sawtooth" },
          { f: 196.00, t: 0.74, d: 0.16, v: 0.20, w: "sawtooth" },
          { f: 110.00, t: 0.94, d: 0.32, v: 0.26, w: "sawtooth" },
          { f: 130.81, t: 1.28, d: 0.16, v: 0.22, w: "sawtooth" },
          { f: 164.81, t: 1.44, d: 0.44, v: 0.24, w: "triangle" }
        ];
        leadNotes.forEach(n => {
          const o = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          o.type = n.w;
          o.frequency.setValueAtTime(n.f, now + n.t);
          g.gain.setValueAtTime(n.v, now + n.t);
          g.gain.exponentialRampToValueAtTime(0.004, now + n.t + n.d);
          o.connect(g);
          g.connect(dest);
          o.start(now + n.t);
          o.stop(now + n.t + n.d + 0.02);
        });
      } else if (type === "shiny") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.setValueAtTime(1320, now + 0.08);
        osc.frequency.setValueAtTime(1760, now + 0.16);
        gain.gain.setValueAtTime(0.22, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === "countdown_tick") {
        osc.type = "square";
        osc.frequency.setValueAtTime(523.25, now);
        gain.gain.setValueAtTime(0.16, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.11);
        osc.start(now);
        osc.stop(now + 0.11);
      } else if (type === "pokecenter_heal") {
        // 致敬寶可夢中心經典 5 連音回復音效 (B4-B4-B4-G#4-E5)
        const notes = [
          { f: 493.88, t: 0.00, d: 0.11 },
          { f: 493.88, t: 0.13, d: 0.11 },
          { f: 493.88, t: 0.26, d: 0.11 },
          { f: 415.30, t: 0.39, d: 0.12 },
          { f: 659.25, t: 0.53, d: 0.30 }
        ];
        notes.forEach(n => {
          const o = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          o.type = "triangle";
          o.frequency.setValueAtTime(n.f, now + n.t);
          g.gain.setValueAtTime(0.18, now + n.t);
          g.gain.exponentialRampToValueAtTime(0.005, now + n.t + n.d);
          o.connect(g);
          g.connect(dest);
          o.start(now + n.t);
          o.stop(now + n.t + n.d + 0.02);
        });
        return;
      } else if (type === "area_clear") {
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((f, idx) => {
          const o = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          o.type = "square";
          o.frequency.setValueAtTime(f, now + idx * 0.065);
          g.gain.setValueAtTime(0.13, now + idx * 0.065);
          g.gain.exponentialRampToValueAtTime(0.005, now + idx * 0.065 + 0.14);
          o.connect(g);
          g.connect(dest);
          o.start(now + idx * 0.065);
          o.stop(now + idx * 0.065 + 0.15);
        });
        return;
      } else if (type === "countdown_go") {
        osc.type = "square";
        osc.frequency.setValueAtTime(783.99, now);
        osc.frequency.setValueAtTime(1046.5, now + 0.07);
        gain.gain.setValueAtTime(0.22, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.24);
        osc.start(now);
        osc.stop(now + 0.24);
      }
    } catch (e) {}
  }
};

const TM_CATALOG = {
  Flamethrower: { id: "Flamethrower", tmNo: "TM35", name: "噴射火焰", type: "Fire", cost: 260, sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/tm-fire.png", desc: "朝身前噴吐直線貫穿高溫烈焰，造成高頻灼傷輸出。" },
  HydroPump:    { id: "HydroPump",    tmNo: "TM55", name: "水炮",     type: "Water", cost: 260, sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/tm-water.png", desc: "發射高壓衝擊水流，強力推開身前一整排敵人。" },
  Thunderbolt:  { id: "Thunderbolt",  tmNo: "TM24", name: "十萬伏特", type: "Electric", cost: 260, sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/tm-electric.png", desc: "向身周射出折射電弧鏈，牽制並麻痺分散的敵群。" },
  RazorLeaf:    { id: "RazorLeaf",    tmNo: "TM75", name: "飛葉快刀", type: "Grass", cost: 240, sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/tm-grass.png", desc: "射出高速自轉的雙色立體鋒利葉片，直線穿透敵群。" },
  SeedBomb:     { id: "SeedBomb",     tmNo: "TM86", name: "種子炸彈", type: "Grass", cost: 240, sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/tm-grass.png", desc: "向目標區域投擲炸彈，爆裂造成大範圍草系重擊。" },
  BulletSeed:   { id: "BulletSeed",   tmNo: "TM09", name: "種子機關槍", type: "Grass", cost: 240, sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/tm-grass.png", desc: "高速連射黃金流光種子彈，密集單點連擊壓制。" },
  DragonRush:   { id: "DragonRush",   tmNo: "TM59", name: "龍之俯衝", type: "Dragon", cost: 280, sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/tm-dragon.png", desc: "釋放威猛蒼藍龍首氣旋衝擊，滿級配龍之鱗片突破【天龍流星雨】！" },
  IceBeam:      { id: "IceBeam",      tmNo: "TM13", name: "冷凍光線", type: "Ice", cost: 260, sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/tm-ice.png", desc: "發射直線極寒光束，具有極高機率完全凍結怪物。" },
  Earthquake:   { id: "Earthquake",   tmNo: "TM26", name: "地震",     type: "Ground", cost: 280, sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/tm-ground.png", desc: "猛力震裂地面，全屏地面目標浮空打擊（對飛行系無效）。" },
  ShadowBall:   { id: "ShadowBall",   tmNo: "TM30", name: "暗影球",   type: "Ghost", cost: 250, sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/tm-ghost.png", desc: "投擲凝聚暗影之球，可無視所有牆體與障礙穿透打擊。" },
  KarateChop:   { id: "KarateChop",   tmNo: "TM31", name: "空手劈",   type: "Fighting", cost: 240, sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/tm-fighting.png", desc: "連續極限重拳揮擊，近戰超高硬直與暴擊輸出。" },
  AirSlash:     { id: "AirSlash",     tmNo: "TM40", name: "空氣斬",   type: "Flying", cost: 250, sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/tm-flying.png", desc: "雙翼斬出迴旋風刃，擊退身前逼近的飛行怪與鳥群。" },
  SludgeBomb:   { id: "SludgeBomb",   tmNo: "TM36", name: "污泥炸彈", type: "Poison", cost: 250, sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/tm-poison.png", desc: "投擲劇毒泥沼，踏入泥沼之敵全體陷入劇毒持續扣血。" },
  RockSlide:    { id: "RockSlide",    tmNo: "TM80", name: "岩崩",     type: "Rock",     cost: 250, sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/tm-rock.png", desc: "召喚巨岩從天砸落範圍敵群，造成高擊退岩系重擊。" },
  XScissor:     { id: "XScissor",     tmNo: "TM81", name: "十字剪",   type: "Bug",      cost: 245, sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/tm-bug.png", desc: "高速翡翠十字雙斬，天生 +15% 暴擊率，補齊蟲系近戰火力。" },
  PoisonJab:    { id: "PoisonJab",    tmNo: "TM84", name: "毒擊",     type: "Poison",   cost: 245, sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/tm-poison.png", desc: "扇形連射劇毒尖刺，對中毒目標額外觸發 +40% 毒爆傷害！" },
  ElectroBall:  { id: "ElectroBall",  tmNo: "TM73", name: "電球",     type: "Electric", cost: 255, sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/tm-electric.png", desc: "發射隨移速增傷的高壓穿透電球，命中濺射金色電弧。" },
  ShadowClaw:   { id: "ShadowClaw",   tmNo: "TM65", name: "暗影爪",   type: "Ghost",    cost: 255, sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/tm-ghost.png", desc: "幽靈三連利爪橫掃，附帶 +25% 暴擊率，Mega 耿鬼絕配！" }
};

// 一階先發精靈天生三招階梯表 (起手 ➔ 中程牽制 ➔ 領域爆發)
const POKEMON_NATURAL_SKILLS = {
  1:   { name: "妙蛙種子", skills: ["VineWhip", "RazorLeaf", "SeedBomb"] },
  2:   { name: "妙蛙草",   skills: ["VineWhip", "RazorLeaf", "SeedBomb"] },
  3:   { name: "妙蛙花",   skills: ["VineWhip", "RazorLeaf", "SeedBomb"] },
  4:   { name: "小火龍",   skills: ["Ember", "Flamethrower", "DragonRush"] },
  5:   { name: "火恐龍",   skills: ["Flamethrower", "DragonRush", "Ember"] },
  6:   { name: "噴火龍",   skills: ["Flamethrower", "DragonRush", "AirSlash"] },
  7:   { name: "傑尼龜",   skills: ["WaterGun", "HydroPump", "IceBeam"] },
  10:  { name: "綠毛蟲",   skills: ["XScissor", "RazorLeaf", "AirSlash"] },
  13:  { name: "獨角蟲",   skills: ["XScissor", "PoisonJab", "SludgeBomb"] },
  16:  { name: "波波",     skills: ["AirSlash", "Tackle", "DragonRush"] },
  25:  { name: "皮卡丘",   skills: ["Thunderbolt", "ElectroBall", "AirSlash"] },
  29:  { name: "尼多蘭",   skills: ["PoisonJab", "SludgeBomb", "KarateChop"] },
  30:  { name: "尼多娜",   skills: ["PoisonJab", "SludgeBomb", "KarateChop"] },
  31:  { name: "尼多后",   skills: ["PoisonJab", "Earthquake", "SludgeBomb"] },
  32:  { name: "尼多朗",   skills: ["PoisonJab", "SludgeBomb", "KarateChop"] },
  33:  { name: "尼多力諾", skills: ["PoisonJab", "SludgeBomb", "KarateChop"] },
  34:  { name: "尼多王",   skills: ["PoisonJab", "Earthquake", "SludgeBomb"] },
  43:  { name: "走路草",   skills: ["RazorLeaf", "SeedBomb", "SludgeBomb"] },
  46:  { name: "派拉斯",   skills: ["XScissor", "SeedBomb", "PoisonJab"] },
  69:  { name: "喇叭芽",   skills: ["BulletSeed", "VineWhip", "SludgeBomb"] },
  72:  { name: "瑪瑙水母", skills: ["HydroPump", "SludgeBomb", "IceBeam"] },
  79:  { name: "呆呆獸",   skills: ["HydroPump", "Psystrike", "IceBeam"] },
  92:  { name: "鬼斯",     skills: ["ShadowBall", "ShadowClaw", "SludgeBomb"] },
  93:  { name: "鬼斯通",   skills: ["ShadowBall", "ShadowClaw", "SludgeBomb"] },
  94:  { name: "耿鬼",     skills: ["ShadowBall", "ShadowClaw", "SludgeBomb"] },
  102: { name: "蛋蛋",     skills: ["BulletSeed", "Psystrike", "SeedBomb"] },
  113: { name: "吉利蛋",   skills: ["Moonblast", "Metronome", "Earthquake"] },
  114: { name: "蔓藤怪",   skills: ["BulletSeed", "VineWhip", "SeedBomb"] },
  116: { name: "墨海馬",   skills: ["HydroPump", "DragonRush", "IceBeam"] },
  117: { name: "海刺龍",   skills: ["HydroPump", "DragonRush", "IceBeam"] },
  123: { name: "飛天螳螂", skills: ["XScissor", "AirSlash", "Tackle"] },
  129: { name: "鯉魚王",   skills: ["Tackle", "HydroPump", "DragonRush"] },
  130: { name: "暴鯉龍",   skills: ["HydroPump", "DragonRush", "IceBeam"] },
  132: { name: "百變怪",   skills: ["Metronome", "Tackle", "Psystrike"] },
  133: { name: "伊布",     skills: ["Tackle", "AirSlash", "Metronome"] }, // 撞擊 + 電光風刃 + 天命揮指
  142: { name: "化石翼龍", skills: ["RockSlide", "AirSlash", "DragonRush"] },
  124: { name: "迷唇姐",   skills: ["IceBeam", "Psystrike", "Moonblast"] },
  143: { name: "卡比獸",   skills: ["Tackle", "Earthquake", "KarateChop"] },
  144: { name: "急凍鳥",   skills: ["IceBeam", "AirSlash", "Moonblast"] },
  146: { name: "火焰鳥",   skills: ["Flamethrower", "AirSlash", "Ember"] },
  147: { name: "迷你龍",   skills: ["DragonRush", "Thunderbolt", "IceBeam"] },
  148: { name: "哈克龍",   skills: ["DragonRush", "Thunderbolt", "IceBeam"] },
  149: { name: "快龍",     skills: ["DragonRush", "Thunderbolt", "Flamethrower"] }
};

// 根據屬性對應的代表招式池（供全 151 圖鑑動態推導天生三招）
const TYPE_SKILL_POOLS = {
  Grass:    ["RazorLeaf", "BulletSeed", "SeedBomb"],
  Fire:     ["Ember", "Flamethrower", "DragonRush"],
  Water:    ["WaterGun", "HydroPump", "IceBeam"],
  Electric: ["Thunderbolt", "ElectroBall", "Tackle"],
  Ice:      ["IceBeam", "WaterGun", "HydroPump"],
  Fighting: ["KarateChop", "Tackle", "Earthquake"],
  Poison:   ["PoisonJab", "SludgeBomb", "ShadowBall"],
  Ground:   ["Earthquake", "RockSlide", "Tackle"],
  Flying:   ["AirSlash", "Tackle", "DragonRush"],
  Psychic:  ["Psystrike", "Moonblast", "ShadowBall"],
  Bug:      ["XScissor", "PoisonJab", "AirSlash"],
  Rock:     ["RockSlide", "Earthquake", "Tackle"],
  Ghost:    ["ShadowBall", "ShadowClaw", "SludgeBomb"],
  Dragon:   ["DragonRush", "Flamethrower", "Thunderbolt"],
  Steel:    ["Thunderbolt", "RockSlide", "Tackle"],
  Normal:   ["Tackle", "KarateChop", "AirSlash"]
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
  const p1 = TYPE_SKILL_POOLS[pokeData.type1] || [];
  const p2 = (pokeData.type2 && pokeData.type2 !== "None") ? (TYPE_SKILL_POOLS[pokeData.type2] || []) : [];
  // 2. 雙屬性精靈優先各取 1 招主／副屬性核心本系招（例如地+岩必得地震+岩崩、普通+飛行必得撞擊+空氣斬）
  if (p1.length > 0 && result.length < 3) addUnique(p1[0]);
  if (p2.length > 0 && result.length < 3) addUnique(p2[0]);
  // 3. 再依序從主屬性、副屬性補齊第 3 招（鳥類飛行系優先取飛行池，絕不誤拿地震）
  const orderedFill = (pokeData.type2 === "Flying") ? [...p2, ...p1] : [...p1, ...p2];
  orderedFill.forEach(s => { if (result.length < 3) addUnique(s); });
  // 4. 兜底補齊至 3 招
  ["Tackle", "AirSlash", "KarateChop"].forEach(s => { if (result.length < 3) addUnique(s); });
  return result;
}

// 伊布進化時的三系本系替換表 (第一招直接替換為代表屬性大招，繼承原本升高的招式等級！)
const EEVEE_EVO_SKILLS = {
  134: ["Hydro Pump", "Ice Beam", "Tackle"],       // 水伊布：第一招直接變水炮！
  135: ["Thunderbolt", "Air Slash", "Tackle"],     // 雷伊布：第一招直接變十萬伏特！
  136: ["Flamethrower", "Dragon Rush", "Tackle"]   // 火伊布：第一招直接變噴射火焰！
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
    cost: 240,
    sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/exp-share.png",
    desc: "【高階補給】立即隨機獲得一件對應當前已學招式的超武攜帶物！"
  }
};


// ============================================================================
// 14. 寶可夢專屬種族被動特性系統 (Innate Passives - 8大核心流派 ＆ 三階進化成長)
// ============================================================================
const INNATE_TRAITS = {
  heavy_slam: {
    id: "heavy_slam",
    name: "重量級霸體",
    badgeColor: "#D97706",
    icon: "fa-weight-hanging",
    summary: (t) => `撞擊/地震/岩崩範圍+${Math.round(18 * t)}%・擊退+${Math.round(30 * t)}%・近戰減傷${Math.min(12, Math.round(8 * t))}%`
  },
  quick_attack: {
    id: "quick_attack",
    name: "電光疾行",
    badgeColor: "#EAB308",
    icon: "fa-bolt-lightning",
    summary: (t) => `撞擊/風刃/電系/十字剪冷卻-${Math.round(10 * t)}%・前撲距離+25%・出招後輕巧加速`
  },
  iron_fist: {
    id: "iron_fist",
    name: "鐵拳宗師",
    badgeColor: "#DC2626",
    icon: "fa-hand-fist",
    summary: (t) => `空手劈/十字剪/暗影爪暴擊+${Math.round(8 * t)}%・近戰範圍+${Math.round(12 * t)}%${t >= 1.45 ? '・空手劈額外+1拳' : ''}`
  },
  mega_launcher: {
    id: "mega_launcher",
    name: "超級發射器",
    badgeColor: "#0284C7",
    icon: "fa-water",
    summary: (t) => `水炮/水槍/冰光寬度+${Math.round(18 * t)}%・水冰擊退推阻+${Math.round(25 * t)}%`
  },
  overgrow_thorn: {
    id: "overgrow_thorn",
    name: "茂盛荊棘",
    badgeColor: "#16A34A",
    icon: "fa-seedling",
    summary: (t) => `藤鞭/葉刀/種彈範圍+${Math.round(15 * t)}%・草毒招式吸血與回血效率+${Math.round(30 * t)}%`
  },
  dragon_maw: {
    id: "dragon_maw",
    name: "猛火龍威",
    badgeColor: "#EA580C",
    icon: "fa-fire-flame-curved",
    summary: (t) => `火系/龍系範圍+${Math.round(15 * t)}%・對灼傷狀態敵人全傷害+${Math.round(15 * t)}%`
  },
  psychic_surge: {
    id: "psychic_surge",
    name: "超能共鳴",
    badgeColor: "#9333EA",
    icon: "fa-wand-sparkles",
    summary: (t) => `念力/暗影/毒擊穿透+${t >= 1.45 ? 2 : 1}・月光柱與毒沼持續+${Math.round(15 * t)}%・異常暴擊+12%`
  },
  legendary_pressure: {
    id: "legendary_pressure",
    name: "傳說王權",
    badgeColor: "#DB2777",
    icon: "fa-crown",
    summary: () => `全招式範圍+20%・冷卻-12%・王權護盾破裂時爆發全屏屬性震退新星`
  }
};

function getPokemonEvolutionTierScale(pokeData, currentLevel = 1) {
  if (!pokeData) return { tier: 1, scale: 1.0, label: "一階" };
  if (pokeData.isMega || pokeData.id >= 10000) {
    return { tier: 4, scale: 1.65, label: "MEGA 覺醒" };
  }
  if (pokeData.id >= 144 && pokeData.id !== 147 && pokeData.id !== 148 && pokeData.id !== 149) {
    return { tier: 3, scale: 1.50, label: "傳說王權" };
  }
  const hasParent = POKEMON_DB.some(parent => parent.evo_to === pokeData.id || ([134, 135, 136].includes(pokeData.id) && parent.id === 133));
  const hasGrandParent = POKEMON_DB.some(parent => parent.evo_to === pokeData.id && POKEMON_DB.some(gp => gp.evo_to === parent.id));
  if (hasGrandParent) return { tier: 3, scale: 1.50, label: "三階完全體" };
  if (hasParent && !pokeData.evo_to) return { tier: 3, scale: 1.50, label: "最終完全體" };
  if (hasParent && pokeData.evo_to) return { tier: 2, scale: 1.25, label: "二階進化" };
  if (!hasParent && !pokeData.evo_to) {
    return currentLevel >= 18
      ? { tier: 3, scale: 1.50, label: "潛能突破" }
      : { tier: 2, scale: 1.25, label: "單階精銳" };
  }
  return { tier: 1, scale: 1.0, label: "一階幼體" };
}

function getPokemonInnateTrait(pokeData, currentLevel = 1) {
  if (!pokeData) pokeData = POKEMON_MAP.get(25);
  const id = pokeData.id;
  const tierInfo = getPokemonEvolutionTierScale(pokeData, currentLevel);
  const t = tierInfo.scale;

  let traitKey = "quick_attack";
  // 0. Mega 超級進化（超級噴火龍X / 超級水箭龜 / 超級妙蛙花）
  if (id === 10034) {
    traitKey = "dragon_maw";
  } else if (id === 10036) {
    traitKey = "mega_launcher";
  } else if (id === 10033) {
    traitKey = "overgrow_thorn";
  } else if (id === 10038) {
    traitKey = "psychic_surge";
  } else if (id === 10041) {
    traitKey = "mega_launcher";
  } else if (id === 10042) {
    traitKey = "quick_attack";
  }
  // 1. 傳說五神獸
  else if ([144, 145, 146, 150, 151].includes(id)) {
    traitKey = "legendary_pressure";
  }
  // 2. 重量級霸體代表 (卡比獸、小拳石家族、獨角犀牛家族、大岩蛇、袋獸、肯泰羅、大舌頭、吉利蛋、穿山鼠家族、卡拉卡拉家族、尼多王/后)
  else if ([27, 28, 31, 34, 50, 51, 74, 75, 76, 95, 104, 105, 108, 111, 112, 113, 115, 128, 143].includes(id)) {
    traitKey = "heavy_slam";
  }
  // 3. 鐵拳宗師代表 (腕力家族、猴怪家族、飛腿郎、快拳郎、蚊香泳士、凱羅斯、鐮刀盔、巨鉗蟹)
  else if ([56, 57, 62, 66, 67, 68, 98, 99, 106, 107, 127, 140, 141].includes(id) || pokeData.type1 === "Fighting") {
    traitKey = "iron_fist";
  }
  // 4. 電光疾行代表 (皮卡丘、雷丘、伊布、雷伊布、小拉達、波波家族、烈雀、喵喵、飛天螳螂、化石翼龍、霹靂電球、電擊獸、嘟嘟)
  else if ([16, 17, 18, 19, 20, 21, 22, 25, 26, 52, 53, 83, 84, 85, 100, 101, 123, 125, 133, 135, 142].includes(id) || pokeData.type1 === "Electric") {
    traitKey = "quick_attack";
  }
  // 5. 超級發射器代表 (傑尼龜家族、水伊布、墨海馬、可達鴨、拉普拉斯、暴鯉龍、海星星、小海獅、大舌貝、菊石獸等水/冰系)
  else if (id === 134 || pokeData.type1 === "Water" || pokeData.type1 === "Ice" || pokeData.type2 === "Ice") {
    traitKey = "mega_launcher";
  }
  // 6. 猛火龍威代表 (小火龍家族、火伊布、迷你龍家族、六尾、卡蒂狗、小火馬、鴨嘴火獸)
  else if (id === 136 || pokeData.type1 === "Fire" || pokeData.type1 === "Dragon") {
    traitKey = "dragon_maw";
  }
  // 7. 茂盛荊棘代表 (妙蛙種子家族、走路草、喇叭芽、派拉斯、蔓藤怪、蛋蛋、綠毛蟲、獨角蟲等草/蟲系)
  else if (pokeData.type1 === "Grass" || pokeData.type1 === "Bug") {
    traitKey = "overgrow_thorn";
  }
  // 8. 超能共鳴代表 (凱西家族、鬼斯家族、皮皮、胖丁、催眠貘、魔牆人偶、臭泥、瓦斯彈、阿柏蛇等超能/幽靈/毒系)
  else if (pokeData.type1 === "Psychic" || pokeData.type1 === "Ghost" || pokeData.type1 === "Poison") {
    traitKey = "psychic_surge";
  }

  const baseMeta = INNATE_TRAITS[traitKey] || INNATE_TRAITS.quick_attack;
  return {
    id: baseMeta.id,
    name: baseMeta.name,
    badgeColor: baseMeta.badgeColor,
    icon: baseMeta.icon,
    tier: tierInfo.tier,
    tierLabel: tierInfo.label,
    scale: t,
    desc: baseMeta.summary(t),
    // 具體物理與戰鬥調用數值 (加法安全邊界)
    tackleQuakeAreaBonus: traitKey === "heavy_slam" ? 0.18 * t : (traitKey === "legendary_pressure" ? 0.25 : 0),
    tackleQuakeKbBonus: traitKey === "heavy_slam" ? 0.30 * t : 0,
    meleeDmgReduction: traitKey === "heavy_slam" ? Math.min(0.12, 0.08 * t) : 0,
    quickAttackCdMult: traitKey === "quick_attack" ? (1 - 0.10 * t) : (traitKey === "legendary_pressure" ? 0.88 : 1.0),
    quickAttackLungeBonus: traitKey === "quick_attack" ? 0.25 : 0,
    ironFistCritBonus: traitKey === "iron_fist" ? 0.08 * t : 0,
    ironFistAreaBonus: traitKey === "iron_fist" ? 0.12 * t : 0,
    ironFistExtraStrike: (traitKey === "iron_fist" && t >= 1.45) ? 1 : 0,
    megaLauncherSizeBonus: traitKey === "mega_launcher" ? 0.18 * t : 0,
    megaLauncherKbBonus: traitKey === "mega_launcher" ? 0.25 * t : 0,
    overgrowAreaBonus: traitKey === "overgrow_thorn" ? 0.15 * t : 0,
    overgrowHealMult: traitKey === "overgrow_thorn" ? (1 + 0.30 * t) : 1.0,
    dragonMawAreaBonus: traitKey === "dragon_maw" ? 0.15 * t : 0,
    dragonMawBurnAmp: traitKey === "dragon_maw" ? 0.15 * t : 0,
    psychicExtraPierce: traitKey === "psychic_surge" ? (t >= 1.45 ? 2 : 1) : 0,
    psychicHazardDurMult: traitKey === "psychic_surge" ? (1 + 0.15 * t) : 1.0,
    psychicStatusCritBonus: traitKey === "psychic_surge" ? 0.12 : 0,
    legendaryAreaBonus: traitKey === "legendary_pressure" ? 0.20 : 0
  };
}


// 開局戰術特訓補給多選庫 (STEP 3 可同時勾選多項)
const TACTICAL_LOADOUTS = [
  {
    id: "combat_pack",
    name: "戰鬥強化補給包",
    cost: 150,
    badge: "150 金",
    sprite: ITEM_SPRITES.protein,
    desc: "開局自帶 45 秒【力量強化(全傷+35%)】＆【速度強化(移速+30%)】與 +25% 額外最大護盾 HP！"
  },
  {
    id: "held_box",
    name: "本命超武攜帶物盲盒",
    cost: 220,
    badge: "220 金",
    sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/exp-share.png",
    desc: "開局直接獲贈 1 件對應出戰精靈主招式的【超武核心攜帶物】（全傷+12% 且滿級直通超武）！"
  },
  {
    id: "skill_manual",
    name: "初始招式特訓手冊",
    cost: 180,
    badge: "180 金",
    sprite: ITEM_SPRITES.rareCandy,
    desc: "開局初始主招式直接升至 Lv.3（若已滿三星金冠則直升 Lv.4 提前解鎖彈幕連發）！"
  },
  {
    id: "extra_partner",
    name: "雙打夥伴召喚球",
    cost: 250,
    badge: "250 金",
    sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/heal-ball.png",
    desc: "開局額外多召喚 1 隻雙打夥伴並肩作戰（可與莎莉娜或研究所天賦疊加至雙夥伴滿編）！"
  },
  {
    id: "magnet_badge",
    name: "黃金聚寶磁力徽章",
    cost: 160,
    badge: "160 金",
    sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/magnet.png",
    desc: "整局經驗拾取範圍永久 +40%，且每 25 秒自動釋放一次全場水晶牽引脈衝！"
  },
  {
    id: "shiny_charm_pass",
    name: "閃光幸運護符",
    cost: 300,
    badge: "300 金",
    sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/shiny-charm.png",
    desc: "本局野生閃光寶可夢遭遇率提升 3 倍，且最終結算代幣總額額外 +25%！"
  }
];

// 15. 前期弱勢一階幼體・大器晚成經驗加速判定 (僅首次進化前生效，不疊加額外減傷)
function getUnderdogExpBonus(pokeData) {
  if (!pokeData || !pokeData.evo_to) return 0;
  const hasParent = POKEMON_DB.some(parent => parent.evo_to === pokeData.id || ([134, 135, 136].includes(pokeData.id) && parent.id === 133));
  if (hasParent) return 0;
  const statSum = (pokeData.hp || 0) + (pokeData.atk || 0);
  if (statSum <= 110) return 0.40;
  if (statSum <= 145) return 0.25;
  return 0;
}

// 16. 石英大會 1vs1 鬥技場神獸挑戰名單 (v7.2.0 Phase 1)
const ARENA_BOSSES = [
  { id: 144, name: "急凍鳥", title: "極寒雙翼", hp: 9200,  atk: 32, speed: 94,  reward: 140, firstBonus: 200, color: "#38BDF8", desc: "扇形五叉冰錐 ＋ 暴風雪環，考驗貼身安全眼走位！" },
  { id: 145, name: "閃電鳥", title: "雷霆霸主", hp: 9400,  atk: 34, speed: 102, reward: 140, firstBonus: 200, color: "#FACC15", desc: "高速雷羽 ＋ 追蹤電磁球，善用四角石柱拉扯視線！" },
  { id: 146, name: "火焰鳥", title: "烈焰鳳凰", hp: 9600,  atk: 36, speed: 98,  reward: 150, firstBonus: 200, color: "#EF4444", desc: "爆裂大字炎彈 ＋ 烈焰衝鋒，注意預警跑道與火星分裂！" },
  { id: 150, name: "超夢",   title: "基因王者", hp: 14500, atk: 42, speed: 108, reward: 220, firstBonus: 300, color: "#A855F7", desc: "引力黑核 ＋ 次元穿刺，關都最強超能宿敵試煉！" },
  { id: 151, name: "始祖夢幻", title: "幻影起源", hp: 12200, atk: 38, speed: 112, reward: 240, firstBonus: 350, color: "#F472B6", desc: "旋轉彩虹星花環 ＋ 起源光陣，高頻全向彈幕極限對決！" }
];

const ARENA_DIFFICULTIES = [
  {
    id: "standard",
    name: "標準試煉",
    badge: "標準 1.0x",
    hpMult: 2.2,
    atkMult: 1.15,
    bulletPct: 0.06,
    telegraphPct: 0.16,
    contactPct: 0.09,
    healEff: 0.85,
    cdMult: 0.85,
    armor: 0.0,
    dpsCapPct: 0.12,
    coinMult: 1.0,
    desc: "血量 2.2x ‧ 紅圈重擊 ~16% 血 ‧ 回復 85%，體驗動作對決"
  },
  {
    id: "master",
    name: "大師宿敵",
    badge: "進階 1.6x",
    hpMult: 3.6,
    atkMult: 1.40,
    bulletPct: 0.09,
    telegraphPct: 0.23,
    contactPct: 0.13,
    healEff: 0.60,
    cdMult: 0.75,
    armor: 0.12,
    dpsCapPct: 0.10,
    coinMult: 1.6,
    desc: "血量 3.6x ‧ 紅圈 ~23% 血 ‧ 回復壓至 60%，善用石柱與閃避"
  },
  {
    id: "champion",
    name: "冠軍極限",
    badge: "極限 2.5x",
    hpMult: 5.2,
    atkMult: 1.70,
    bulletPct: 0.125,
    telegraphPct: 0.31,
    contactPct: 0.17,
    healEff: 0.35,
    cdMult: 0.68,
    armor: 0.20,
    dpsCapPct: 0.08,
    coinMult: 2.5,
    desc: "血量 5.2x ‧ 紅圈 ~31% 血 ‧ 回復壓至 35% ‧ 搶奪場地道具求生！"
  }
];
