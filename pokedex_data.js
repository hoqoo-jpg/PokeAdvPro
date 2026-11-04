/**
 * ============================================================================
 * pokedex_data.js
 * 關都 151 隻寶可夢資料庫、招式目錄、屬性剋制表、狀態免疫與資源快取
 * ============================================================================
 */

// 道具與圖示資源表
const ITEM_SPRITES = {
  pokeBall:     "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png",
  healBall:     "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/heal-ball.png",
  masterBall:   "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/master-ball.png",
  potion:       "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/super-potion.png",
  rareCandy:    "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/rare-candy.png",
  protein:      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/protein.png",
  hpUp:         "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/hp-up.png",
  carbos:       "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/carbos.png",
  wideLens:     "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/wide-lens.png",
  chest:        "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/relic-gold.png",
  charcoal:     "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/charcoal.png",
  mysticWater:  "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/mystic-water.png",
  miracleSeed:  "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/miracle-seed.png",
  magnet:       "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/magnet.png",
  spellTag:     "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/spell-tag.png",
  twistedSpoon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/twisted-spoon.png",
  coin:         "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/amulet-coin.png",
  starPiece:    "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/star-piece.png"
};

// 屬性幾何徽章與異常狀態設定
const TYPE_META = {
  Grass:    { zh: "草",   color: "#78C850", status: "Poison",    statusRate: 0.30, svg: `<path d="M12 3C7 3 4 7 4 12c0 3 2 6 5 7l-1-4c2 1 4 0 5-2 1-2 0-5-2-6 3 1 5 4 5 7 2-2 3-5 2-8-1-2-3-3-6-3z" fill="currentColor"/>` },
  Fire:     { zh: "火",   color: "#F08030", status: "Burn",      statusRate: 0.34, svg: `<path d="M12 2c1 4-2 6-2 10 0 3 2 5 4 5-1-2 0-4 2-5 2 2 3 5 2 8-1 2-4 3-7 3-4 0-7-3-7-7 0-5 4-9 8-14z" fill="currentColor"/>` },
  Water:    { zh: "水",   color: "#6890F0", status: null,        statusRate: 0,    svg: `<path d="M12 2.5S6 10 6 14.5C6 18.1 8.7 21 12 21s6-2.9 6-6.5C18 10 12 2.5 12 2.5z" fill="currentColor"/>` },
  Electric: { zh: "電",   color: "#F8D030", status: "Paralysis", statusRate: 0.35, svg: `<polygon points="13 2 4 14 11 14 10 22 20 10 13 10" fill="currentColor"/>` },
  Psychic:  { zh: "超能", color: "#F85888", status: "Confusion", statusRate: 0.32, svg: `<circle cx="12" cy="12" r="4" fill="currentColor"/><path d="M12 4a8 8 0 1 0 8 8" stroke="currentColor" stroke-width="2.5" fill="none"/>` },
  Ghost:    { zh: "幽靈", color: "#705898", status: "Confusion", statusRate: 0.32, svg: `<path d="M12 3a8 8 0 0 0-8 8v9l3-2 2.5 2 2.5-2 2.5 2 2.5-2 3 2v-9a8 8 0 0 0-8-8z" fill="currentColor"/>` },
  Ice:      { zh: "冰",   color: "#98D8D8", status: "Freeze",    statusRate: 0.42, svg: `<polygon points="12 2 15 9 22 12 15 15 12 22 9 15 2 12 9 9" fill="currentColor"/>` },
  Poison:   { zh: "毒",   color: "#A040A0", status: "Poison",    statusRate: 0.42, svg: `<circle cx="12" cy="10" r="6" fill="currentColor"/><circle cx="8" cy="18" r="2.5" fill="currentColor"/><circle cx="16" cy="18" r="2.5" fill="currentColor"/>` },
  Flying:   { zh: "飛行", color: "#A890F0", status: null,        statusRate: 0,    svg: `<path d="M3 16c6-1 11-5 17-12-1 6-5 11-11 13l6 2c-5 2-9 1-12-3z" fill="currentColor"/>` },
  Bug:      { zh: "蟲",   color: "#A8B820", status: "Poison",    statusRate: 0.25, svg: `<ellipse cx="12" cy="13" rx="5" ry="7" fill="currentColor"/>` },
  Normal:   { zh: "一般", color: "#A8A878", status: null,        statusRate: 0,    svg: `<circle cx="12" cy="12" r="6" fill="currentColor"/>` },
  Fairy:    { zh: "妖精", color: "#EE99AC", status: "Confusion", statusRate: 0.30, svg: `<polygon points="12 2 14.5 9.5 22 12 14.5 14.5 12 22 9.5 14.5 2 12 9.5 9.5" fill="currentColor"/>` },
  Fighting: { zh: "格鬥", color: "#C03028", status: null,        statusRate: 0,    svg: `<circle cx="12" cy="12" r="7" fill="currentColor"/>` },
  Ground:   { zh: "地面", color: "#E0C068", status: null,        statusRate: 0,    svg: `<polygon points="3 18 9 8 15 18" fill="currentColor"/>` },
  Rock:     { zh: "岩石", color: "#B8A038", status: null,        statusRate: 0,    svg: `<polygon points="12 3 20 9 17 19 7 19 4 9" fill="currentColor"/>` },
  Steel:    { zh: "鋼",   color: "#B8B8D0", status: null,        statusRate: 0,    svg: `<polygon points="12 2 21 7 21 17 12 22 3 17 3 7" fill="currentColor"/>` },
  Dragon:   { zh: "龍",   color: "#7038F8", status: "Burn",      statusRate: 0.28, svg: `<path d="M12 2L5 9l4 2-3 9 13-9-4-2 4-7z" fill="currentColor"/>` }
};

// 正統 16 屬性剋制表
const TYPE_EFFECTIVENESS = {
  Grass:    { super: ["Water", "Ground", "Rock"],             weak: ["Fire", "Grass", "Poison", "Flying", "Bug", "Dragon"] },
  Fire:     { super: ["Grass", "Ice", "Bug", "Steel"],        weak: ["Fire", "Water", "Rock", "Dragon"] },
  Water:    { super: ["Fire", "Ground", "Rock"],              weak: ["Water", "Grass", "Dragon"] },
  Electric: { super: ["Water", "Flying"],                     weak: ["Electric", "Grass", "Ground", "Dragon"] },
  Ice:      { super: ["Grass", "Ground", "Flying", "Dragon"], weak: ["Fire", "Water", "Ice", "Steel"] },
  Poison:   { super: ["Grass", "Fairy"],                      weak: ["Poison", "Ground", "Rock", "Ghost"] },
  Flying:   { super: ["Grass", "Fighting", "Bug"],            weak: ["Electric", "Rock", "Steel"] },
  Psychic:  { super: ["Fighting", "Poison"],                  weak: ["Psychic", "Steel"] },
  Bug:      { super: ["Grass", "Psychic"],                    weak: ["Fire", "Fighting", "Poison", "Flying", "Ghost", "Fairy"] },
  Ghost:    { super: ["Psychic", "Ghost"],                    weak: ["Normal"] },
  Fairy:    { super: ["Fighting", "Dragon"],                  weak: ["Fire", "Poison", "Steel"] },
  Fighting: { super: ["Normal", "Ice", "Rock", "Steel"],      weak: ["Poison", "Flying", "Psychic", "Bug", "Fairy"] },
  Ground:   { super: ["Fire", "Electric", "Poison", "Rock", "Steel"], weak: ["Grass", "Bug", "Flying"] },
  Rock:     { super: ["Fire", "Ice", "Flying", "Bug"],        weak: ["Fighting", "Ground", "Steel"] },
  Dragon:   { super: ["Dragon"],                              weak: ["Steel", "Fairy"] },
  Normal:   { super: [],                                      weak: ["Rock", "Steel", "Ghost"] }
};

function renderTypeBadgeHTML(typeKey) {
  if (!typeKey || typeKey === "None" || !TYPE_META[typeKey]) return "";
  const t = TYPE_META[typeKey];
  return `<span style="background:${t.color};" class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-black text-white shadow-sm border border-white/60 whitespace-nowrap"><svg class="w-2.5 h-2.5" viewBox="0 0 24 24">${t.svg}</svg>${t.zh}</span>`;
}

function calcTypeMultiplier(moveType, defType1, defType2) {
  const chart = TYPE_EFFECTIVENESS[moveType];
  if (!chart) return 1.0;
  let mult = 1.0;
  [defType1, defType2].forEach(dt => {
    if (!dt || dt === "None") return;
    if (chart.super.includes(dt)) mult *= 1.35;
    else if (chart.weak.includes(dt)) mult *= 0.72;
  });
  return mult > 1.15 ? 1.5 : (mult < 0.85 ? 0.65 : 1.0);
}

function checkStatusImmunity(target, statusType) {
  const types = [target.data.type1, target.data.type2];
  if (statusType === "Burn" && types.includes("Fire")) return true;
  if (statusType === "Freeze" && types.includes("Ice")) return true;
  if (statusType === "Paralysis" && types.includes("Electric")) return true;
  if (statusType === "Poison" && (types.includes("Poison") || types.includes("Steel"))) return true;
  return false;
}

// 關都 151 隻寶可夢完整原始數值庫 [id, 名稱, 屬性1, 屬性2, HP, ATK, SPD, 初始招式, 進化等級]
const COMPACT_151 = [
  [1,"妙蛙種子","Grass","Poison",120,12,2.2,"Vine Whip",16],[2,"妙蛙草","Grass","Poison",220,22,2.5,"Vine Whip",32],[3,"妙蛙花","Grass","Poison",400,38,2.8,"Seed Bomb",0],
  [4,"小火龍","Fire","None",100,15,2.5,"Flamethrower",16],[5,"火恐龍","Fire","None",180,28,2.8,"Flamethrower",36],[6,"噴火龍","Fire","Flying",320,45,3.2,"Flamethrower",0],
  [7,"傑尼龜","Water","None",140,10,2.0,"Water Gun",16],[8,"卡咪龜","Water","None",250,20,2.3,"Water Gun",36],[9,"水箭龜","Water","None",450,35,2.6,"Hydro Pump",0],
  [10,"綠毛蟲","Bug","None",60,6,1.5,"Tackle",7],[11,"鐵甲蛹","Bug","None",100,4,1.0,"Tackle",10],[12,"巴大蝶","Bug","Flying",180,25,2.7,"Confusion",0],
  [13,"獨角蟲","Bug","Poison",55,7,1.6,"Poison Sting",7],[14,"鐵殼蛹","Bug","Poison",95,5,1.0,"Poison Sting",10],[15,"大針蜂","Bug","Poison",190,30,3.0,"Twineedle",0],
  [16,"波波","Normal","Flying",70,10,2.5,"Gust",18],[17,"比比鳥","Normal","Flying",150,22,3.0,"Gust",36],[18,"大比鳥","Normal","Flying",280,36,3.6,"Air Slash",0],
  [19,"小拉達","Normal","None",50,9,2.8,"Tackle",20],[20,"拉達","Normal","None",160,26,3.2,"Hyper Fang",0],[21,"烈雀","Normal","Flying",65,11,2.7,"Drill Peck",20],
  [22,"大嘴雀","Normal","Flying",210,32,3.5,"Drill Peck",0],[23,"阿柏蛇","Poison","None",65,10,2.1,"Poison Sting",22],[24,"阿柏怪","Poison","None",190,29,2.8,"Bite",0],
  [25,"皮卡丘","Electric","None",110,18,3.2,"Thunderbolt",30],[26,"雷丘","Electric","None",260,38,3.8,"Thunderbolt",0],[27,"穿山鼠","Ground","None",90,13,1.8,"Scratch",22],
  [28,"穿山王","Ground","None",240,33,2.6,"Earthquake",0],[29,"尼多蘭","Poison","None",85,9,1.8,"Poison Sting",16],[30,"尼多娜","Poison","None",170,19,2.2,"Bite",36],
  [31,"尼多后","Poison","Ground",340,36,2.8,"Earthquake",0],[32,"尼多朗","Poison","None",80,11,2.0,"Horn Attack",16],[33,"尼多力諾","Poison","None",165,23,2.4,"Horn Attack",36],
  [34,"尼多王","Poison","Ground",330,40,3.0,"Earthquake",0],[35,"皮皮","Fairy","None",140,12,1.6,"Moonblast",30],[36,"皮可西","Fairy","None",320,30,2.4,"Moonblast",0],
  [37,"六尾","Fire","None",80,12,2.4,"Flamethrower",30],[38,"九尾","Fire","None",270,32,3.4,"Flamethrower",0],[39,"胖丁","Normal","Fairy",180,10,1.2,"Moonblast",30],
  [40,"胖可丁","Normal","Fairy",420,26,2.0,"Moonblast",0],[41,"超音蝠","Poison","Flying",60,8,3.0,"Bite",22],[42,"大嘴蝠","Poison","Flying",180,25,3.5,"Bite",0],
  [43,"走路草","Grass","Poison",75,11,1.7,"Vine Whip",21],[44,"臭臭花","Grass","Poison",160,22,2.0,"Vine Whip",36],[45,"霸王花","Grass","Poison",300,36,2.4,"Seed Bomb",0],
  [46,"派拉斯","Bug","Grass",65,12,1.4,"Scratch",24],[47,"派拉斯特","Bug","Grass",190,31,1.6,"X-Scissor",0],[48,"毛球","Bug","Poison",85,11,2.0,"Confusion",31],
  [49,"摩魯蛾","Bug","Poison",220,29,3.2,"Confusion",0],[50,"地鼠","Ground","None",40,11,3.2,"Earthquake",26],[51,"三地鼠","Ground","None",130,32,4.1,"Earthquake",0],
  [52,"喵喵","Normal","None",75,10,3.2,"Scratch",28],[53,"貓老大","Normal","None",190,26,3.9,"Slash",0],[54,"可達鴨","Water","None",95,11,2.1,"Water Gun",33],
  [55,"哥達鴨","Water","None",260,32,3.1,"Hydro Pump",0],[56,"猴怪","Fighting","None",75,15,2.8,"Karate Chop",28],[57,"火暴猴","Fighting","None",200,37,3.4,"Cross Chop",0],
  [58,"卡蒂狗","Fire","None",100,15,2.3,"Flamethrower",30],[59,"風速狗","Fire","None",340,44,3.5,"Flamethrower",0],[60,"蚊香蝌蚪","Water","None",70,9,2.6,"Water Gun",25],
  [61,"蚊香君","Water","None",180,21,3.0,"Water Gun",36],[62,"蚊香泳士","Water","Fighting",330,36,2.7,"Hydro Pump",0],[63,"凱西","Psychic","None",45,16,3.2,"Confusion",16],
  [64,"勇基拉","Psychic","None",120,35,3.6,"Psystrike",36],[65,"胡地","Psychic","None",220,55,4.1,"Psystrike",0],[66,"腕力","Fighting","None",130,16,1.6,"Karate Chop",28],
  [67,"豪力","Fighting","None",250,32,2.1,"Karate Chop",40],[68,"怪力","Fighting","None",380,50,2.4,"Cross Chop",0],[69,"喇叭芽","Grass","Poison",80,13,1.9,"Vine Whip",21],
  [70,"口呆花","Grass","Poison",180,25,2.2,"Vine Whip",36],[71,"大食花","Grass","Poison",310,42,2.6,"Seed Bomb",0],[72,"瑪瑙水母","Water","Poison",80,9,2.6,"Poison Sting",30],
  [73,"毒刺水母","Water","Poison",290,28,3.4,"Hydro Pump",0],[74,"小拳石","Rock","Ground",90,13,1.1,"Earthquake",25],[75,"隆隆石","Rock","Ground",190,27,1.4,"Earthquake",40],
  [76,"隆隆岩","Rock","Ground",330,44,1.7,"Earthquake",0],[77,"小火馬","Fire","None",95,15,3.1,"Flamethrower",40],[78,"烈焰馬","Fire","None",240,36,3.7,"Flamethrower",0],
  [79,"呆呆獸","Water","Psychic",160,11,0.8,"Water Gun",37],[80,"呆殼獸","Water","Psychic",380,32,1.2,"Psystrike",0],[81,"小磁怪","Electric","Steel",55,16,1.7,"Thunderbolt",30],
  [82,"三合一磁怪","Electric","Steel",170,39,2.4,"Thunderbolt",0],[83,"大蔥鴨","Normal","Flying",150,25,2.3,"Slash",0],[84,"嘟嘟","Normal","Flying",75,15,2.9,"Drill Peck",31],
  [85,"嘟嘟利","Normal","Flying",210,39,3.7,"Drill Peck",0],[86,"小海獅","Water","None",125,9,1.6,"Ice Beam",34],[87,"白海獅","Water","Ice",300,26,2.4,"Ice Beam",0],
  [88,"臭泥","Poison","None",150,14,1.2,"Sludge Bomb",38],[89,"臭臭泥","Poison","None",360,38,1.7,"Sludge Bomb",0],[90,"大舌貝","Water","None",70,11,1.5,"Ice Beam",30],
  [91,"刺甲貝","Water","Ice",210,36,2.4,"Ice Beam",0],[92,"鬼斯","Ghost","Poison",80,18,2.4,"Shadow Ball",25],[93,"鬼斯通","Ghost","Poison",170,32,2.9,"Shadow Ball",40],
  [94,"耿鬼","Ghost","Poison",310,52,3.5,"Shadow Ball",0],[95,"大岩蛇","Rock","Ground",150,16,2.3,"Earthquake",0],[96,"催眠貘","Psychic","None",130,11,1.5,"Confusion",26],
  [97,"引夢貘人","Psychic","None",290,25,2.3,"Psystrike",0],[98,"大鉗蟹","Water","None",70,18,1.8,"Water Gun",28],[99,"巨鉗蟹","Water","None",210,44,2.5,"Hydro Pump",0],
  [100,"霹靂電球","Electric","None",80,11,3.3,"Thunderbolt",30],[101,"頑皮雷彈","Electric","None",210,25,4.5,"Thunderbolt",0],[102,"蛋蛋","Grass","Psychic",110,11,1.4,"Seed Bomb",30],
  [103,"椰蛋樹","Grass","Psychic",340,42,1.9,"Seed Bomb",0],[104,"卡拉卡拉","Ground","None",100,11,1.4,"Earthquake",28],[105,"嘎啦嘎啦","Ground","None",230,28,2.0,"Earthquake",0],
  [106,"飛腿郎","Fighting","None",200,44,2.9,"High Jump Kick",0],[107,"快拳郎","Fighting","None",200,39,2.7,"Karate Chop",0],[108,"大舌頭","Normal","None",320,19,1.2,"Body Slam",0],
  [109,"瓦斯彈","Poison","None",85,13,1.4,"Sludge Bomb",35],[110,"雙彈瓦斯","Poison","None",240,31,2.0,"Sludge Bomb",0],[111,"獨角犀牛","Ground","Rock",160,18,1.0,"Horn Attack",42],
  [112,"鑽角犀獸","Ground","Rock",380,46,1.4,"Earthquake",0],[113,"吉利蛋","Normal","None",800,10,1.8,"Body Slam",0],[114,"蔓藤怪","Grass","None",220,25,2.0,"Vine Whip",0],
  [115,"袋獸","Normal","None",380,35,3.0,"Body Slam",0],[116,"墨海馬","Water","None",65,11,2.0,"Water Gun",32],[117,"海刺龍","Water","None",190,31,2.8,"Hydro Pump",0],
  [118,"角金魚","Water","None",85,13,2.1,"Horn Attack",33],[119,"金魚王","Water","None",260,33,2.6,"Horn Attack",0],[120,"海星星","Water","None",65,12,2.8,"Water Gun",30],
  [121,"寶石海星","Water","Psychic",220,36,3.8,"Hydro Pump",0],[122,"魔牆人偶","Psychic","Fairy",170,30,3.0,"Psystrike",0],[123,"飛天螳螂","Bug","Flying",250,40,3.6,"X-Scissor",0],
  [124,"迷唇姐","Ice","Psychic",220,38,3.1,"Ice Beam",0],[125,"電擊獸","Electric","None",230,35,3.4,"Thunderbolt",0],[126,"鴨嘴火獸","Fire","None",230,38,3.1,"Flamethrower",0],
  [127,"凱羅斯","Bug","None",240,44,2.9,"X-Scissor",0],[128,"肯泰羅","Normal","None",260,36,3.7,"Horn Attack",0],[129,"鯉魚王","Water","None",40,2,2.5,"Tackle",20],
  [130,"暴鯉龍","Water","Flying",360,48,2.8,"Hydro Pump",0],[131,"拉普拉斯","Water","Ice",460,30,2.0,"Ice Beam",0],[132,"百變怪","Normal","None",150,18,1.8,"Metronome",0],
  [133,"伊布","Normal","None",120,15,2.4,"Quick Attack",25],[134,"水伊布","Water","None",450,36,2.2,"Hydro Pump",0],[135,"雷伊布","Electric","None",220,38,4.3,"Thunderbolt",0],
  [136,"火伊布","Fire","None",220,46,2.2,"Flamethrower",0],[137,"多邊獸","Normal","None",220,25,1.4,"Psystrike",0],[138,"菊石獸","Rock","Water",90,16,1.2,"Water Gun",40],
  [139,"多刺菊石獸","Rock","Water",250,38,1.8,"Hydro Pump",0],[140,"化石盔","Rock","Water",75,17,1.8,"Scratch",40],[141,"鐮刀盔","Rock","Water",220,42,2.7,"Slash",0],
  [142,"化石翼龍","Rock","Flying",280,38,4.2,"Air Slash",0],[143,"卡比獸","Normal","None",650,42,1.1,"Body Slam",0],[144,"急凍鳥","Ice","Flying",700,55,3.2,"Ice Beam",0],
  [145,"閃電鳥","Electric","Flying",720,58,3.5,"Thunderbolt",0],[146,"火焰鳥","Fire","Flying",710,60,3.4,"Flamethrower",0],[147,"迷你龍","Dragon","None",90,15,1.7,"Dragon Rush",30],
  [148,"哈克龍","Dragon","None",210,30,2.4,"Dragon Rush",55],[149,"快龍","Dragon","Flying",480,52,2.8,"Dragon Rush",0],[150,"超夢","Psychic","None",950,75,3.8,"Psystrike",0],
  [151,"夢幻","Psychic","None",850,70,4.0,"Metronome",0]
];

const POKEMON_DB = COMPACT_151.map(r => {
  const id = r[0];
  const evoLv = r[8] === 0 ? "None" : r[8];
  return {
    id,
    name_zh: r[1],
    type1: r[2],
    type2: r[3],
    hp: r[4],
    atk: r[5],
    speed: r[6],
    skill: r[7],
    evo_level: evoLv,
    evo_to: evoLv === "None" ? null : (id === 133 ? 134 : id + 1),
    forward_sprite: `https://raw.githubusercontent.com/NightCatSama/pokedex/main/images/sprite/forward/${id}.png`,
    back_sprite: `https://raw.githubusercontent.com/NightCatSama/pokedex/main/images/sprite/back/${id}.png`
  };
});

const POKEMON_MAP = new Map();
POKEMON_DB.forEach(p => POKEMON_MAP.set(p.id, p));

const EXCLUDED_WAVE_IDS = new Set([52, 113, 144, 145, 146, 150, 151]);
const REGULAR_MOB_POOL = POKEMON_DB.filter(p => !EXCLUDED_WAVE_IDS.has(p.id));

// 可解鎖出戰寶可夢清單
const PLAYABLE_ROSTER = [
  { id: 25,  cost: 0,    tag: "小智/赤紅羈絆" },
  { id: 1,   cost: 0,    tag: "小智/赤紅羈絆" },
  { id: 4,   cost: 0,    tag: "小智/赤紅羈絆" },
  { id: 7,   cost: 0,    tag: "小智/赤紅羈絆" },
  { id: 10,  cost: 0,    tag: "免費基礎" },
  { id: 16,  cost: 0,    tag: "小智羈絆" },
  { id: 133, cost: 300,  tag: "莎莉娜羈絆‧三系進化" },
  { id: 35,  cost: 300,  tag: "莎莉娜/莉莉艾羈絆" },
  { id: 37,  cost: 350,  tag: "小剛/莉莉艾羈絆" },
  { id: 39,  cost: 300,  tag: "莎莉娜羈絆" },
  { id: 54,  cost: 320,  tag: "小霞羈絆‧水炮" },
  { id: 56,  cost: 360,  tag: "十字劈格鬥" },
  { id: 58,  cost: 400,  tag: "風速狗進化" },
  { id: 63,  cost: 450,  tag: "超能胡地" },
  { id: 66,  cost: 380,  tag: "怪力格鬥" },
  { id: 74,  cost: 350,  tag: "小剛羈絆‧隆隆岩" },
  { id: 92,  cost: 450,  tag: "幽靈耿鬼" },
  { id: 106, cost: 520,  tag: "飛膝踢宗師" },
  { id: 123, cost: 600,  tag: "十字剪雙刀" },
  { id: 129, cost: 300,  tag: "小霞羈絆‧暴鯉龍" },
  { id: 131, cost: 650,  tag: "小霞/赤紅羈絆" },
  { id: 143, cost: 700,  tag: "赤紅羈絆‧卡比獸" },
  { id: 147, cost: 850,  tag: "莉莉艾羈絆‧快龍" },
  { id: 144, cost: 1500, tag: "莉莉艾羈絆‧三聖鳥" },
  { id: 145, cost: 1500, tag: "傳說三聖鳥" },
  { id: 146, cost: 1500, tag: "傳說三聖鳥" },
  { id: 150, cost: 2500, tag: "赤紅羈絆‧超夢" },
  { id: 151, cost: 3000, tag: "赤紅羈絆‧夢幻" }
];

const PARTNER_SUMMON_POOL = [1, 4, 7, 16, 25, 35, 37, 39, 54, 58, 63, 92, 133, 147];

// 6 位隨行訓練家
const TRAINERS = [
  {
    id: "ash",
    name: "小智 (Ash)",
    title: "真新鎮熱血主角 (預設)",
    cost: 0,
    sprite: "images/Ash_01.png",
    sprites: { down: "images/Ash_01.png", up: "images/Ash_02.png", left: "images/Ash_03.png", right: "images/Ash_04.png" },
    skillName: "就決定是你了！",
    skillCd: 25, // 8分鐘快節奏優化：由45s下調至25s
    skillDuration: 6.0,
    bondName: "真新鎮的奇蹟",
    bondColor: "#F59E0B",
    bondPokemonIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 16, 17, 18, 25, 26],
    bondPreviewIds: [25, 4, 1, 7],
    pixelColors: { hat: "#EF4444", hair: "#0F172A", top: "#2563EB", pants: "#1E293B" },
    quote: "「皮卡丘、大家，就決定是你了！全力上吧！」",
    desc: "【專屬羈絆】搭檔皮卡丘、關都御三家或比比鳥享傷害+25%、攻速+20%！戰術技(CD 25s)：恢復18% HP並6秒內攻速暴擊大爆發！",
    mods: { dmgMult: 1.15, critBonus: 0.10, cdMult: 0.95, expMult: 1.15, speedMult: 1.08, hpMult: 1.15, regen: 1.2, areaMult: 1.10, projBonus: 0 }
  },
  {
    id: "misty",
    name: "小霞 (Misty)",
    title: "華藍道館人魚館主 (免費)",
    cost: 0,
    sprite: "https://play.pokemonshowdown.com/sprites/trainers/misty.png",
    skillName: "華藍水幕推進",
    skillCd: 28, // 8分鐘快節奏優化：由50s下調至28s
    skillDuration: 4.5,
    bondName: "華藍人魚之歌",
    bondColor: "#38BDF8",
    bondPokemonIds: [54, 55, 116, 117, 118, 119, 120, 121, 129, 130, 131, 134],
    bondPreviewIds: [54, 121, 130, 131],
    pixelColors: { hat: "#F97316", hair: "#F97316", top: "#FEF08A", pants: "#0284C7" },
    quote: "「看我的華藍水幕！把敵人通通沖走吧！」",
    desc: "【專屬羈絆】搭檔可達鴨、暴鯉龍、拉普拉斯、水伊布等享傷害+25%、攻速+20%！戰術技(CD 28s)：釋放全場水環震退並冰凍減速敵群，恢復22% HP！",
    mods: { dmgMult: 1.12, critBonus: 0.08, cdMult: 0.94, expMult: 1.10, speedMult: 1.20, hpMult: 1.25, regen: 1.8, areaMult: 1.22, projBonus: 0 }
  },
  {
    id: "brock",
    name: "小剛 (Brock)",
    title: "尼比道館堅毅飼育家 (免費)",
    cost: 0,
    sprite: "https://play.pokemonshowdown.com/sprites/trainers/brock.png",
    skillName: "尼比岩石壁壘",
    skillCd: 30, // 8分鐘快節奏優化：由55s下調至30s
    skillDuration: 5.0,
    bondName: "尼比岩壁守護",
    bondColor: "#D97706",
    bondPokemonIds: [37, 38, 41, 42, 74, 75, 76, 95, 111, 112],
    bondPreviewIds: [74, 95, 37, 111],
    pixelColors: { hat: "#78350F", hair: "#451A03", top: "#15803D", pants: "#A16207" },
    quote: "「交給我吧！這是特製的元氣燉湯與岩石防禦！」",
    desc: "【專屬羈絆】搭檔小拳石線、大岩蛇、六尾線享傷害+25%、攻速+20%！戰術技(CD 30s)：恢復25% HP，並展開5秒【50%減傷岩石護盾】！",
    mods: { dmgMult: 1.10, critBonus: 0.06, cdMult: 0.95, expMult: 1.10, speedMult: 1.04, hpMult: 1.38, regen: 2.5, areaMult: 1.18, projBonus: 0 }
  },
  {
    id: "serena",
    name: "莎莉娜 (Serena)",
    title: "卡洛斯雙打偶像",
    cost: 500,
    sprite: "https://play.pokemonshowdown.com/sprites/trainers/serena.png",
    skillName: "雙打應援星舞",
    skillCd: 28,
    skillDuration: 5.0,
    bondName: "閃耀舞台羈絆",
    bondColor: "#F472B6",
    bondPokemonIds: [35, 36, 39, 40, 133, 134, 135, 136],
    bondPreviewIds: [133, 35, 39, 135],
    pixelColors: { hat: "#E11D48", hair: "#B45309", top: "#1E293B", pants: "#F43F5E" },
    quote: "「大家一起閃耀吧！雙打連攜全開！」",
    desc: "【專屬羈絆】搭檔伊布家族(#133~136)、皮皮或胖丁享傷害+25%！開局自帶1隻雙打夥伴！戰術技(CD 28s)：全體夥伴連發大招並恢復22% HP！",
    mods: { dmgMult: 1.18, critBonus: 0.10, cdMult: 0.94, expMult: 1.22, speedMult: 1.10, hpMult: 1.18, regen: 1.5, areaMult: 1.15, projBonus: 0, startPartner: true }
  },
  {
    id: "lillie",
    name: "莉莉艾 (Lillie)",
    title: "星光祈願守護者",
    cost: 600,
    sprite: "https://play.pokemonshowdown.com/sprites/trainers/lillie.png",
    skillName: "傷藥緊急噴霧",
    skillCd: 32,
    skillDuration: 2.0,
    bondName: "冰星祈願共鳴",
    bondColor: "#A78BFA",
    bondPokemonIds: [35, 36, 37, 38, 131, 144, 147, 148, 149],
    bondPreviewIds: [37, 35, 147, 144],
    pixelColors: { hat: "#FFFFFF", hair: "#FDE047", top: "#F8FAFC", pants: "#38BDF8" },
    quote: "「請撐下去！我馬上幫你噴上滿たん傷藥！」",
    desc: "【專屬羈絆】搭檔六尾、皮皮、快龍線或急凍鳥享傷害+25%！野生閃光率2倍！戰術技(CD 32s)：恢復38% HP、2秒無敵並淨化異常狀態！",
    mods: { dmgMult: 1.14, critBonus: 0.12, cdMult: 0.93, expMult: 1.18, speedMult: 1.12, hpMult: 1.28, regen: 3.0, areaMult: 1.15, projBonus: 0, shinyBoost: 2.0 }
  },
  {
    id: "red",
    name: "赤紅 (Red)",
    title: "白銀山傳奇冠軍 (隱藏解鎖)",
    cost: 0,
    isHiddenRed: true,
    sprite: "https://play.pokemonshowdown.com/sprites/trainers/red.png",
    skillName: "白銀山王牌號令",
    skillCd: 28,
    skillDuration: 6.5,
    bondName: "白銀山傳奇巔峰",
    bondColor: "#EF4444",
    bondPokemonIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 25, 26, 131, 133, 134, 135, 136, 143, 150, 151],
    bondPreviewIds: [6, 25, 143, 150],
    pixelColors: { hat: "#DC2626", hair: "#0F172A", top: "#DC2626", pants: "#1E3A8A" },
    quote: "「…………！（赤紅壓低帽沿，下達了王牌必殺指令！）」",
    desc: "【隱藏解鎖：擊敗7.5m超夢 #150】搭檔御三家、皮卡丘、卡比獸或超夢享全傷+35%、發射數+1！戰術技(CD 28s)：震退全場並6.5秒內全傷+45%！",
    mods: { dmgMult: 1.35, critBonus: 0.18, cdMult: 0.90, expMult: 1.20, speedMult: 1.15, hpMult: 1.30, regen: 2.0, areaMult: 1.20, projBonus: 1 }
  }
];

// 挑戰難度（8分鐘快局版）
const DIFFICULTIES = [
  { id: "easy",   name: "新手訓練家 (Easy)", badge: "輕鬆體驗",   hpMult: 1.00, atkMult: 0.90, spdMult: 0.90, spawnRateMult: 0.95, coinMult: 1.0, shinyBonus: 1.0, desc: "怪獸血量適中，適合熟悉走位拉扯與基礎圖鑑收集。" },
  { id: "normal", name: "道館挑戰級 (Normal)", badge: "推薦 ‧ 1.5x代幣", hpMult: 1.55, atkMult: 1.20, spdMult: 1.00, spawnRateMult: 1.15, coinMult: 1.5, shinyBonus: 1.0, desc: "標準硬核生存體驗！怪物數量扎實，考驗手動戰術技搭配。" },
  { id: "hard",   name: "四天王菁英 (Hard)",   badge: "菁英 ‧ 2.2x代幣", hpMult: 2.30, atkMult: 1.45, spdMult: 1.10, spawnRateMult: 1.35, coinMult: 2.2, shinyBonus: 1.5, desc: "怪潮壓迫感加劇！考驗屬性剋制與減速地形拉打，野生閃光精靈率提升 1.5x！" },
  { id: "master", name: "關都冠軍級 (Master)", badge: "極限 ‧ 3.5x代幣", hpMult: 3.40, atkMult: 1.80, spdMult: 1.18, spawnRateMult: 1.55, coinMult: 3.5, shinyBonus: 2.5, desc: "極限彈幕與生存試煉！怪群洶湧圍攻，代幣獎勵 3.5x，野生閃光率高達 2.5 倍！" }
];

// 攜帶道具配置（超武合成必備核心）
const HELD_ITEMS = {
  "Charcoal":     { id: "Charcoal",     name: "木炭",       sprite: ITEM_SPRITES.charcoal,     forSkill: "Flamethrower", desc: "火系威力 +20%，可讓 Lv.10【噴射火焰】突破為全屏【大字爆炎・爆炸烈焰】！" },
  "MysticWater":  { id: "MysticWater",  name: "神秘水滴",   sprite: ITEM_SPRITES.mysticWater,  forSkill: "Water Gun",    desc: "水系威力 +20%，可讓 Lv.10【水槍/水炮】突破為全屏【巨浪加農水炮】！" },
  "MiracleSeed":  { id: "MiracleSeed",  name: "奇蹟種子",   sprite: ITEM_SPRITES.miracleSeed,  forSkill: "Vine Whip",    desc: "草系威力 +20%，可讓 Lv.10【藤鞭/種子炸彈】突破為全屏【森羅瘋狂植物】！" },
  "Magnet":       { id: "Magnet",       name: "磁鐵",       sprite: ITEM_SPRITES.magnet,       forSkill: "Thunderbolt",  desc: "電系威力 +20%，可讓 Lv.10【十萬伏特】突破為 360 度全屏【萬雷伏特攻擊】！" },
  "SpellTag":     { id: "SpellTag",     name: "詛咒之符",   sprite: ITEM_SPRITES.spellTag,     forSkill: "Shadow Ball",  desc: "幽靈威力 +20%，可讓 Lv.10【暗影球】突破為全屏【冥界暗影潛襲】！" },
  "TwistedSpoon": { id: "TwistedSpoon", name: "彎曲的湯匙", sprite: ITEM_SPRITES.twistedSpoon, forSkill: "Psystrike",    desc: "超能威力 +20%，可讓 Lv.10【精神擊破/念力】突破為全屏【創世精神超新星】！" }
};

function getSkillNextLevelBonusDesc(nextLv) {
  const bonusMap = {
    2: "【Lv.2 強化】基礎傷害 +25% ＆ 攻擊速度提升",
    3: "【Lv.3 質變】發射/斬擊數量 +1 ＆ 範圍擴大 +15%",
    4: "【Lv.4 強化】招式冷卻縮短 -12% ＆ 傷害 +20%",
    5: "【Lv.5 質變】5大屬性狀態異常觸發率提升 +35%！",
    6: "【Lv.6 質變】發射/斬擊數量再 +1 ＆ 貫穿提升",
    7: "【Lv.7 強化】基礎傷害 +30% ＆ 暴擊率 +10%",
    8: "【Lv.8 質變】範圍擴大 +25% ＆ 擊退力強化",
    9: "【Lv.9 質變】發射/斬擊數量再 +1 ＆ 冷卻縮短 -15%",
    10: "【Lv.10 滿級大師】傷害 +50%！持有對應攜帶物即可突破【全屏究極超武】！"
  };
  return bonusMap[nextLv] || "全面提升招式威力與範圍";
}

// 完整招式目錄
const SKILLS_CATALOG = {
  "Flamethrower": { id: "Flamethrower", name: "噴射火焰", evolvedName: "大字爆炎・爆炸烈焰", type: "Fire", isMelee: false, vfx: "fire_stream", sprite: ITEM_SPRITES.charcoal, reqItem: "Charcoal", color: "#F08030", baseCd: 1.25, baseDmg: 26, desc: "噴射彗星烈焰流與濃密火苗煙霧粒子群，附加【灼傷】。", evoDesc: "【全屏究極超武】全屏熔岩炎殺陣！立體金紅「大」字砸地引爆 8 道旋轉火龍捲！" },
  "Water Gun":    { id: "Water Gun",    name: "水槍",     evolvedName: "巨浪加農水炮", type: "Water", isMelee: false, vfx: "water_beam", sprite: ITEM_SPRITES.mysticWater, reqItem: "MysticWater", color: "#38BDF8", baseCd: 1.15, baseDmg: 24, desc: "發射高壓螺旋激流與密集藍白泡沫粒子，附加【水流減速】。", evoDesc: "【全屏究極超武】全屏深藍漩渦巨浪！以自身為中心掀起雙重水龍捲轟炸全場！" },
  "Hydro Pump":   { id: "Hydro Pump",   name: "水炮",     evolvedName: "巨浪加農水炮", type: "Water", isMelee: false, vfx: "water_beam", sprite: ITEM_SPRITES.mysticWater, reqItem: "MysticWater", color: "#0284C7", baseCd: 1.38, baseDmg: 34, desc: "噴發粗大高壓水柱衝擊波，強力擊退敵群並附加【水流減速】。", evoDesc: "【全屏究極超武】全屏深藍漩渦巨浪！掀起雙重水龍捲與泡沫風暴轟炸全場！" },
  "Vine Whip":    { id: "Vine Whip",    name: "藤鞭",     evolvedName: "森羅瘋狂植物", type: "Grass", isMelee: true, meleeStyle: "vine_whip", sprite: ITEM_SPRITES.miracleSeed, reqItem: "MiracleSeed", color: "#22C55E", baseCd: 1.12, baseDmg: 23, desc: "甩出立體翠綠 S 藤鞭並散射飛葉，附加【中毒】。", evoDesc: "【全屏究極超武】全屏翠綠荊棘藤蔓與飛葉風暴震退敵群並吸血回復！" },
  "Seed Bomb":    { id: "Seed Bomb",    name: "種子炸彈", evolvedName: "森羅瘋狂植物", type: "Grass", isMelee: false, vfx: "seed_cluster", sprite: ITEM_SPRITES.miracleSeed, reqItem: "MiracleSeed", color: "#10B981", baseCd: 1.28, baseDmg: 30, desc: "高拋發光堅果種子，砸地爆開密集孢子霧，附加【中毒】。", evoDesc: "【全屏究極超武】全屏種子花瓣連環爆破並吸血回復！" },
  "Thunderbolt":  { id: "Thunderbolt",  name: "十萬伏特", evolvedName: "萬雷伏特攻擊", type: "Electric", isMelee: false, vfx: "lightning", sprite: ITEM_SPRITES.magnet, reqItem: "Magnet", color: "#F8D030", baseCd: 1.28, baseDmg: 29, desc: "中近程金白高頻電漿連環彈跳，高機率附加【麻痺】。", evoDesc: "【全屏究極超武】自身展開八卦電磁陣，天頂降下粗大熾白雷柱向 360 度放射 14 道分叉狂雷！" },
  "Shadow Ball":  { id: "Shadow Ball",  name: "暗影球",   evolvedName: "冥界暗影潛襲", type: "Ghost", isMelee: false, vfx: "shadow_orb", sprite: ITEM_SPRITES.spellTag, reqItem: "SpellTag", color: "#9333EA", baseCd: 1.26, baseDmg: 28, desc: "發射帶有引力吸積盤的微型黑洞球，附加【混亂】。", evoDesc: "【全屏究極超武】全場暗影次元法陣爆裂並發射巨型追蹤引力黑洞！" },
  "Psystrike":    { id: "Psystrike",    name: "精神擊破", evolvedName: "創世精神超新星", type: "Psychic", isMelee: false, vfx: "psychic_ring", sprite: ITEM_SPRITES.twistedSpoon, reqItem: "TwistedSpoon", color: "#F85888", baseCd: 1.35, baseDmg: 32, desc: "發射粉紫同心圓波紋環與星芒粒子，高機率【混亂】。", evoDesc: "【全屏究極超武】全屏超能力星雲波紋擴散震飛敵群！" },
  "Confusion":    { id: "Confusion",    name: "念力",     evolvedName: "創世精神超新星", type: "Psychic", isMelee: false, vfx: "psychic_ring", sprite: ITEM_SPRITES.twistedSpoon, reqItem: "TwistedSpoon", color: "#EC4899", baseCd: 1.20, baseDmg: 24, desc: "釋放同心圓超能光環與星塵尾跡，附加【混亂】。", evoDesc: "【全屏究極超武】全屏超能力星雲波紋風暴！" },
  "Ice Beam":     { id: "Ice Beam",     name: "急凍光線", evolvedName: "絕對零度暴風雪", type: "Ice", isMelee: false, vfx: "ice_crystal", sprite: ITEM_SPRITES.mysticWater, reqItem: null, color: "#38BDF8", baseCd: 1.35, baseDmg: 30, desc: "連發筆直六角射線冰柱束，高機率將敵人【冰凍】！", evoDesc: "雙排交錯立體冰棱矩陣極寒風暴！" },
  "Moonblast":    { id: "Moonblast",    name: "月亮之力", evolvedName: "月華星光交響曲", type: "Fairy", isMelee: false, vfx: "moon_orb", sprite: ITEM_SPRITES.starPiece, reqItem: null, color: "#EE99AC", baseCd: 1.28, baseDmg: 28, desc: "發射璀璨粉紅月光球與四角星芒簇，附加【混亂】。", evoDesc: "璀璨月光星雨轟炸全場！" },
  "Dragon Rush":  { id: "Dragon Rush",  name: "龍之俯衝", evolvedName: "逆鱗蒼龍破", type: "Dragon", isMelee: false, vfx: "dragon_flame", sprite: ITEM_SPRITES.charcoal, reqItem: null, color: "#7038F8", baseCd: 1.32, baseDmg: 34, desc: "釋放蒼藍紫龍焰衝擊彈與密集龍息粒子叢，貫穿敵群並【灼傷】。", evoDesc: "蒼龍逆鱗狂暴風暴！" },
  "Sludge Bomb":  { id: "Sludge Bomb",  name: "污泥炸彈", evolvedName: "劇毒紫晶狂潮", type: "Poison", isMelee: false, vfx: "sludge_cluster", sprite: ITEM_SPRITES.spellTag, reqItem: null, color: "#A855F7", baseCd: 1.28, baseDmg: 28, desc: "投擲冒泡紫毒球並噴散濃密毒霧粒子叢，附加強烈【中毒】！", evoDesc: "劇毒紫晶連環爆破！" },
  "Gust":         { id: "Gust",         name: "起風",     evolvedName: "暴風龍捲", type: "Flying", isMelee: false, vfx: "wind_crescent", sprite: ITEM_SPRITES.carbos, reqItem: null, color: "#A890F0", baseCd: 1.10, baseDmg: 22, desc: "揮出多層次新月旋風刃與白色氣流粒子叢擊退敵人。", evoDesc: "暴風龍捲撕裂！" },
  "Air Slash":    { id: "Air Slash",    name: "空氣斬",   evolvedName: "神鳥猛擊", type: "Flying", isMelee: false, vfx: "wind_crescent", sprite: ITEM_SPRITES.carbos, reqItem: null, color: "#38BDF8", baseCd: 1.05, baseDmg: 31, desc: "高速連發十字真空新月風刃撕裂敵群。", evoDesc: "神鳥天翔光翼！" },
  "Poison Sting": { id: "Poison Sting", name: "毒針",     evolvedName: "劇毒蜂群", type: "Poison", isMelee: false, vfx: "needle_dart", sprite: ITEM_SPRITES.spellTag, reqItem: null, color: "#C084FC", baseCd: 0.95, baseDmg: 20, desc: "高速連射銳利紫晶毒針與毒霧微粒，附加【中毒】。", evoDesc: "劇毒蜂針雨！" },
  "Twineedle":    { id: "Twineedle",    name: "雙針",     evolvedName: "極限雙針", type: "Bug", isMelee: false, vfx: "needle_dart", sprite: ITEM_SPRITES.miracleSeed, reqItem: null, color: "#84CC16", baseCd: 0.92, baseDmg: 28, desc: "雙向極速貫穿翠綠雙連光針與星芒，附加【中毒】。", evoDesc: "雙針連環風暴！" },

  // 近戰招式（享有無敵幀延長 + 命中微量吸血補償）
  "Earthquake":     { id: "Earthquake",     name: "地震",     evolvedName: "大地脈動裂破", type: "Ground",   isMelee: true, meleeStyle: "quake_wave",   sprite: ITEM_SPRITES.protein, reqItem: null, color: "#D97706", baseCd: 1.70, baseDmg: 36, desc: "【近身震波】立體雙層深坑裂隙，核心重擊飛石，外圈泥石減速！", evoDesc: "12道裂隙巨岩暴起地崩全屏！" },
  "Body Slam":      { id: "Body Slam",      name: "泰山壓頂", evolvedName: "極巨重壓震波", type: "Normal",   isMelee: true, meleeStyle: "slam_wave",    sprite: ITEM_SPRITES.protein, reqItem: null, color: "#F59E0B", baseCd: 1.60, baseDmg: 35, desc: "【近身重壓】爆發雙層黃金重壓波紋與星芒，震退敵人並【麻痺】！", evoDesc: "極巨泰山重壓！" },
  "Scratch":        { id: "Scratch",        name: "抓",       evolvedName: "暴走利爪連斬", type: "Normal",   isMelee: true, meleeStyle: "claw_slash",   sprite: ITEM_SPRITES.protein, reqItem: null, color: "#F8FAFC", baseCd: 0.98, baseDmg: 24, desc: "【三段階梯交錯】精準階梯三段撕裂爪光，尾端爆散星塵火花！", evoDesc: "暴走利爪狂暴風暴！" },
  "Slash":          { id: "Slash",          name: "劈開",     evolvedName: "居合劍氣連斬", type: "Normal",   isMelee: true, meleeStyle: "claw_slash",   sprite: ITEM_SPRITES.protein, reqItem: null, color: "#38BDF8", baseCd: 1.02, baseDmg: 32, desc: "【扇形居合】主刀光帶 2 道動態延遲殘影弧線，三層空間裂痕！", evoDesc: "160° 雙層居合劍氣！" },
  "X-Scissor":      { id: "X-Scissor",      name: "十字剪",   evolvedName: "疾風十字雙刃", type: "Bug",      isMelee: true, meleeStyle: "x_scissor",    sprite: ITEM_SPRITES.miracleSeed, reqItem: null, color: "#84CC16", baseCd: 1.08, baseDmg: 34, desc: "【扇形雙刃】由內向外交叉擴張 X 型翠綠扇形光刃，高暴擊！", evoDesc: "疾風十字雙刃連環！" },
  "Karate Chop":    { id: "Karate Chop",    name: "空手劈",   evolvedName: "武神百裂拳",   type: "Fighting", isMelee: true, meleeStyle: "martial_fist", sprite: ITEM_SPRITES.protein, reqItem: null, color: "#EF4444", baseCd: 1.10, baseDmg: 30, desc: "【螺旋飛拳】向外螺旋轟出金白氣勁巨拳印，震飛敵群！", evoDesc: "【武神百裂拳】環形氣爆波紋，螺旋轟出 18 枚格鬥神拳！" },
  "Cross Chop":     { id: "Cross Chop",     name: "十字劈",   evolvedName: "無雙十字烈破", type: "Fighting", isMelee: true, meleeStyle: "martial_fist", sprite: ITEM_SPRITES.protein, reqItem: null, color: "#DC2626", baseCd: 1.18, baseDmg: 38, desc: "【螺旋重拳】雙向交錯的巨型烈焰拳印，極高暴擊率！", evoDesc: "無雙十字烈破！" },
  "High Jump Kick": { id: "High Jump Kick", name: "飛膝踢",   evolvedName: "天翔流星飛踢", type: "Fighting", isMelee: true, meleeStyle: "martial_fist", sprite: ITEM_SPRITES.carbos,  reqItem: null, color: "#F97316", baseCd: 1.22, baseDmg: 40, desc: "【爆裂拳腿】向前連環轟出半透明赤橙氣勁印與密集火星！", evoDesc: "天翔流星飛踢！" },
  "Bite":           { id: "Bite",           name: "咬住",     evolvedName: "深淵惡之咬碎", type: "Poison",   isMelee: true, meleeStyle: "fang_bite",    sprite: ITEM_SPRITES.spellTag, reqItem: null, color: "#9333EA", baseCd: 1.08, baseDmg: 26, desc: "【近戰咬合】立體黑紫巨齒重重咬合並炸開紫光星芒！", evoDesc: "深淵惡之咬碎！" },
  "Hyper Fang":     { id: "Hyper Fang",     name: "必殺門牙", evolvedName: "黃金憤怒門牙", type: "Normal",   isMelee: true, meleeStyle: "fang_bite",    sprite: ITEM_SPRITES.protein, reqItem: null, color: "#F59E0B", baseCd: 1.12, baseDmg: 33, desc: "【近戰咬合】立體黃金巨顎利齒咬碎敵人，爆發十字閃光！", evoDesc: "黃金憤怒門牙！" },
  "Horn Attack":    { id: "Horn Attack",    name: "角撞",     evolvedName: "黃金獨角鑽擊", type: "Normal",   isMelee: true, meleeStyle: "drill_horn",   sprite: ITEM_SPRITES.protein, reqItem: null, color: "#D97706", baseCd: 1.08, baseDmg: 28, desc: "【近戰突刺】多環旋轉黃金螺旋鑽頭與破空粒子流貫穿敵人！", evoDesc: "黃金獨角鑽擊！" },
  "Drill Peck":     { id: "Drill Peck",     name: "啄鑽",     evolvedName: "蒼穹螺旋神鳥", type: "Flying",   isMelee: true, meleeStyle: "drill_horn",   sprite: ITEM_SPRITES.carbos,  reqItem: null, color: "#38BDF8", baseCd: 1.08, baseDmg: 32, desc: "【近戰突刺】高速旋轉蒼藍螺旋風錐與氣流粒子突刺敵群！", evoDesc: "蒼穹螺旋神鳥！" },
  "Quick Attack":   { id: "Quick Attack",   name: "電光一閃", evolvedName: "神速星光閃擊", type: "Normal",   isMelee: true, meleeStyle: "dash_strike",  sprite: ITEM_SPRITES.carbos,  reqItem: null, color: "#FEF08A", baseCd: 0.88, baseDmg: 25, desc: "【扇形疾閃】扇形揮出純白疾風刀光與密集尾端閃爍星芒！", evoDesc: "神速星光閃擊！" },
  "Tackle":         { id: "Tackle",         name: "撞擊",     evolvedName: "捨身星芒衝撞", type: "Normal",   isMelee: true, meleeStyle: "dash_strike",  sprite: ITEM_SPRITES.protein, reqItem: null, color: "#E2E8F0", baseCd: 0.98, baseDmg: 22, desc: "【扇形衝撞】扇形迸發元氣衝擊波與打擊星芒！", evoDesc: "捨身星芒衝撞！" },
  "Metronome":      { id: "Metronome",      name: "揮指",     evolvedName: "創世揮指交響曲", type: "Psychic", isMelee: false, vfx: "psychic_ring", sprite: ITEM_SPRITES.masterBall, reqItem: null, color: "#F472B6", baseCd: 1.30, baseDmg: 38, desc: "夢幻專屬！隨機連鎖施放全屬性華麗大招！", evoDesc: "全屬性大爆發！" }
};

const MAP_BOSS_LOOTS = {
  "magnet":       { id: "magnet",       name: "寶可夢磁鐵",   sprite: ITEM_SPRITES.magnet,    color: "#3B82F6", isRare: false },
  "partner_ball": { id: "partner_ball", name: "支援治癒球",   sprite: ITEM_SPRITES.healBall,  color: "#F85888", isRare: true },
  "rare_candy":   { id: "rare_candy",   name: "神奇糖果",     sprite: ITEM_SPRITES.rareCandy, color: "#3B82F6", isRare: true },
  "evo_chest":    { id: "evo_chest",    name: "金色進化寶箱", sprite: ITEM_SPRITES.chest,     color: "#EAB308", isRare: true }
};

const CENTER_POKEMON_UPGRADES = [
  { id: "atk",   name: "本系與屬性強化", sprite: ITEM_SPRITES.protein,   desc: "寶可夢全招式傷害與本系加成(STAB) +8% / 每級", baseCost: 100, maxLv: 10 },
  { id: "hp",    name: "幸福蛋體質特訓", sprite: ITEM_SPRITES.hpUp,      desc: "寶可夢最大 HP +12% 且每秒回血提升 / 每級", baseCost: 90,  maxLv: 10 },
  { id: "cd",    name: "敏捷招式連攜",   sprite: ITEM_SPRITES.carbos,    desc: "寶可夢招式冷卻縮減 -3.5% / 每級", baseCost: 120, maxLv: 8 },
  { id: "shiny", name: "閃耀護符研究",   sprite: ITEM_SPRITES.starPiece, desc: "野生閃光寶可夢與寶藏精靈(喵喵/吉利蛋)出現率提升", baseCost: 200, maxLv: 5 }
];

const CENTER_TRAINER_UPGRADES = [
  { id: "fourthSlot", name: "【核心突破】第 4 主動招式欄位", sprite: ITEM_SPRITES.masterBall, desc: "將戰鬥中可持有的主動攻擊招式上限從 3 招永久擴充至 4 招！", baseCost: 800, maxLv: 1, isSpecialSlot: true },
  { id: "trainerCd",  name: "訓練家戰術口令精修", sprite: ITEM_SPRITES.wideLens, desc: "縮短右下角【訓練家戰術技能】冷卻時間 -4% / 每級（上限縮短20%）", baseCost: 180, maxLv: 5 },
  { id: "partner",    name: "雙打夥伴指揮光環",   sprite: ITEM_SPRITES.healBall, desc: "副手夥伴傷害 +18%，Lv.1起開局自帶 1 隻雙打夥伴！", baseCost: 160, maxLv: 5 },
  { id: "greed",      name: "聚寶功賞金護符",     sprite: ITEM_SPRITES.coin,     desc: "金幣與經驗獲取率 +15% / 每級", baseCost: 110, maxLv: 10 }
];

const ACHIEVEMENTS = [
  { id: "first_blood",  name: "真新鎮初心訓練家",   desc: "累計擊退 50 隻野生寶可夢", reward: 200, check: (s) => s.totalKills >= 50 },
  { id: "first_evo",    name: "進化之光閃耀！",     desc: "在冒險中完成夥伴寶可夢進化", reward: 300, check: (s) => s.evolutions >= 1 },
  { id: "super_move",   name: "Lv.10 全屏究極超武", desc: "將任意招式升至 Lv.10 並突破為【究極超武】", reward: 450, check: (s) => s.superMoves >= 1 },
  { id: "kill_bird",    name: "三聖鳥的試煉 (5分)", desc: "擊退 5 分鐘傳說三聖鳥", reward: 600, check: (s) => s.birdsDefeated >= 1 },
  { id: "kill_mewtwo",  name: "王者超夢的認可 (解鎖赤紅!)", desc: "擊退 7.5 分鐘最終 Boss【超夢 #150】並永久解鎖赤紅", reward: 1000, check: (s) => s.mewtwoDefeated >= 1 },
  { id: "kill_mew",     name: "始祖夢幻的奇蹟 (8分)", desc: "通過隱藏終極 Boss【夢幻 #151】的極限考驗", reward: 2000, check: (s) => s.mewDefeated >= 1 }
];

// 圖檔與音效快取
const SpriteCache = {
  cache: new Map(),
  get(url) {
    if (!url) return null;
    if (this.cache.has(url)) return this.cache.get(url);
    const img = new Image();
    const record = { img, loaded: false, error: false };
    img.onload = () => { record.loaded = true; };
    img.onerror = () => { record.error = true; };
    img.src = url;
    this.cache.set(url, record);
    return record;
  }
};

const SoundFX = {
  ctx: null,
  bgmMuted: false,
  currentTrack: null,
  noteIndex: 0,
  bgmTimer: null,

  tracks: {
    lobby: [
      [523.25, 220, 261.63], [659.25, 220, 261.63], [783.99, 220, 329.63], [1046.50, 440, 392.00],
      [880.00, 220, 349.23], [783.99, 220, 349.23], [659.25, 220, 261.63], [587.33, 440, 293.66],
      [523.25, 220, 261.63], [659.25, 220, 261.63], [783.99, 220, 329.63], [880.00, 440, 349.23],
      [783.99, 220, 392.00], [659.25, 320, 329.63], [587.33, 220, 293.66], [523.25, 440, 261.63]
    ],
    battle: [
      [659.25, 160, 329.63], [783.99, 160, 329.63], [880.00, 160, 440.00], [1046.50, 320, 440.00],
      [987.77, 160, 392.00], [783.99, 160, 392.00], [880.00, 160, 349.23], [659.25, 320, 329.63],
      [587.33, 160, 293.66], [659.25, 160, 293.66], [783.99, 160, 392.00], [880.00, 320, 349.23],
      [783.99, 160, 392.00], [659.25, 160, 329.63], [587.33, 160, 293.66], [523.25, 320, 261.63]
    ],
    boss: [
      [440.00, 130, 220.00], [466.16, 130, 233.08], [493.88, 130, 246.94], [523.25, 260, 261.63],
      [523.25, 130, 261.63], [587.33, 130, 293.66], [659.25, 130, 329.63], [698.46, 260, 349.23],
      [783.99, 130, 392.00], [698.46, 130, 349.23], [659.25, 130, 329.63], [587.33, 260, 293.66],
      [659.25, 130, 329.63], [587.33, 130, 293.66], [523.25, 130, 261.63], [440.00, 260, 220.00]
    ]
  },

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
  },

  startBgm(trackName) {
    this.init();
    if (this.currentTrack === trackName && this.bgmTimer) return;
    this.currentTrack = trackName;
    this.noteIndex = 0;
    if (this.bgmTimer) clearTimeout(this.bgmTimer);
    this.stepBgm();
  },

  stepBgm() {
    if (!this.currentTrack) return;
    const seq = this.tracks[this.currentTrack] || this.tracks.lobby;
    const note = seq[this.noteIndex % seq.length];
    this.noteIndex += 1;
    const [leadFreq, durMs, bassFreq] = note;

    if (!this.bgmMuted && this.ctx && this.ctx.state === "running") {
      try {
        const now = this.ctx.currentTime;
        const durSec = (durMs * 0.85) / 1000;

        const osc1 = this.ctx.createOscillator();
        const gain1 = this.ctx.createGain();
        osc1.type = "square";
        osc1.frequency.setValueAtTime(leadFreq, now);
        gain1.gain.setValueAtTime(0.025, now);
        gain1.gain.exponentialRampToValueAtTime(0.003, now + durSec);
        osc1.connect(gain1);
        gain1.connect(this.ctx.destination);
        osc1.start(now);
        osc1.stop(now + durSec);

        if (bassFreq) {
          const osc2 = this.ctx.createOscillator();
          const gain2 = this.ctx.createGain();
          osc2.type = "triangle";
          osc2.frequency.setValueAtTime(bassFreq, now);
          gain2.gain.setValueAtTime(0.035, now);
          gain2.gain.exponentialRampToValueAtTime(0.004, now + durSec);
          osc2.connect(gain2);
          gain2.connect(this.ctx.destination);
          osc2.start(now);
          osc2.stop(now + durSec);
        }
      } catch (e) {}
    }

    this.bgmTimer = setTimeout(() => this.stepBgm(), durMs);
  },

  toggleMute() {
    this.init();
    this.bgmMuted = !this.bgmMuted;
    return this.bgmMuted;
  },

  play(type) {
    try {
      if (!this.ctx || this.bgmMuted) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);

      if (type === "hit") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(340, now);
        osc.frequency.exponentialRampToValueAtTime(140, now + 0.05);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.05);
        osc.start(now); osc.stop(now + 0.05);
      } else if (type === "super") {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(523, now);
        osc.frequency.setValueAtTime(659, now + 0.05);
        osc.frequency.setValueAtTime(784, now + 0.10);
        gain.gain.setValueAtTime(0.09, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.20);
        osc.start(now); osc.stop(now + 0.20);
      } else if (type === "levelup" || type === "shiny") {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.06);
        osc.frequency.setValueAtTime(783.99, now + 0.12);
        osc.frequency.setValueAtTime(1046.5, now + 0.18);
        gain.gain.setValueAtTime(0.11, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.36);
        osc.start(now); osc.stop(now + 0.36);
      } else if (type === "ultimate" || type === "boss") {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(65, now + 0.45);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.45);
        osc.start(now); osc.stop(now + 0.45);
      }
    } catch (e) {}
  }
};