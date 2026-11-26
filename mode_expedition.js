/**
 * ============================================================================
 * mode_expedition.js (v7.2.8 關都大遠征 2.0：可擴充章節架構 ＋ 殲滅進度制 ＋ 火車站捲動長卷)
 * 設計重點：
 * 1. 全資料驅動 EXPEDITION_CHAPTERS（零寫死波數與章節數），支援 ModeExpedition.registerChapter()
 *    隨時追加第四章（如紅蓮火山）、第五章（如月見山／野生原野區）而無須改動引擎與 UI 程式碼。
 * 2. 常規波次採【波次殲滅進度制 (Kill Quota)】＋ 剩餘 ≤3 隻紅箭頭指引 ＋ AREA CLEAR 吸晶儀式。
 * 3. 非鬥技場波次套用中大型固定生態戰場 (1160×880) 並於波中刷新限時增益道具。
 * 4. 火車站式局部捲動 GBA 長卷路線圖（約顯示 3.5 站）＋ 訓練家與主角向右一步一步漫步動畫（非阻塞）。
 * 5. 跨區 GBA 左上路牌 ＋ 寶可夢中心 5 連音營地回復 ＋ Boss VS 對峙橫幅 ＋ 殿堂登錄紀念卡。
 * ============================================================================
 */

window.EXPEDITION_CHAPTERS = [
  {
    id: "act1_pallet",
    name: "真新鎮・常磐密林",
    shortName: "常磐密林",
    stageId: "pallet",
    isArena: false,
    signStyle: "wood",
    bounds: { halfW: 580, halfH: 440 },
    theme: { bg: "#3E6B38", accent: "#2E5229", text: "#BBF7D0", badgeBg: "#15803D", badgeLabel: "密林徽章" },
    waves: [
      {
        title: "常磐密林・外圍探索",
        subtitle: "淨空野生蟲系與草系精靈，快速升級成型主招。",
        enemyTypes: ["Grass", "Bug", "Normal"],
        enemyPool: [10, 13, 16, 19, 43, 69],
        elitePool: [12, 15],
        previewIds: [10, 16, 43],
        killQuota: 22,
        clearBonus: 70,
        weather: "CLEAR"
      },
      {
        title: "密林中繼・隨機精英領主",
        subtitle: "擊破鎮守密林中段的區域小王，奪取經驗晶群與神奇糖果！",
        isBossWave: true,
        isMiniBoss: true,
        miniBossPool: [
          { bossIds: [15], title: "小王・劇毒大針蜂領主", enemyTypes: ["Bug", "Poison"] },
          { bossIds: [18], title: "小王・蒼穹大比鳥領主", enemyTypes: ["Normal", "Flying"] },
          { bossIds: [45], title: "小王・毒粉霸王花領主", enemyTypes: ["Grass", "Poison"] }
        ],
        enemyTypes: ["Bug", "Poison", "Flying"],
        enemyPool: [12, 15, 17, 41, 44],
        bossIds: [15],
        previewIds: [15, 18, 45],
        clearBonus: 110,
        weather: "CLEAR"
      },
      {
        title: "密林異變・隨機事件波",
        subtitle: "遭遇密林突發事件！淨空敵潮並把握機會收割資源！",
        eventPool: [
          {
            id: "meowth_convoy",
            title: "事件・聚寶喵喵車隊",
            subtitle: "擊破護衛並攔截雙倍聚寶喵喵，大賺整備代幣！",
            enemyTypes: ["Normal", "Poison"],
            enemyPool: [19, 20, 23, 52, 109],
            elitePool: [24, 53],
            previewIds: [52, 20, 23],
            killQuota: 28,
            spawnTreasure: "meowth",
            weather: "CLEAR"
          },
          {
            id: "forest_migration",
            title: "事件・常磐生態遷徙潮",
            subtitle: "大批草系與飛行系精靈成群遷徙，快速收割升級！",
            enemyTypes: ["Grass", "Flying", "Bug"],
            enemyPool: [12, 17, 44, 46, 70, 123],
            elitePool: [18, 47, 123],
            previewIds: [12, 70, 123],
            killQuota: 32,
            weather: "RAIN"
          }
        ],
        enemyTypes: ["Normal", "Grass", "Bug"],
        enemyPool: [19, 20, 44, 70],
        elitePool: [18, 24],
        previewIds: [52, 12, 123],
        killQuota: 30,
        clearBonus: 95,
        weather: "CLEAR"
      },
      {
        title: "關底・火箭隊突襲雙王",
        subtitle: "擊破阿柏怪與雙彈瓦斯雙首領即可突圍前往華藍海岬！",
        isBossWave: true,
        enemyTypes: ["Poison"],
        enemyPool: [23, 41, 109],
        bossIds: [24, 110],
        previewIds: [24, 110],
        clearBonus: 165,
        weather: "CLEAR",
        unlockRegionBadge: "常磐制霸"
      }
    ]
  },
  {
    id: "act2_cerulean",
    name: "華藍海岬・木棧道",
    shortName: "華藍海岬",
    stageId: "cerulean_bay",
    isArena: false,
    signStyle: "harbor",
    bounds: { halfW: 600, halfH: 460 },
    theme: { bg: "#0369A1", accent: "#0284C7", text: "#BAE6FD", badgeBg: "#0284C7", badgeLabel: "海岬徽章" },
    waves: [
      {
        title: "華藍海岬・潮汐木棧道",
        subtitle: "淨空海岸精靈！善用木棧道避免涉水減速。",
        enemyTypes: ["Water", "Poison"],
        enemyPool: [54, 60, 72, 90, 98, 116, 120],
        elitePool: [55, 61, 73],
        previewIds: [54, 72, 120],
        killQuota: 28,
        clearBonus: 105,
        weather: "RAIN"
      },
      {
        title: "海峽中繼・深海霸主小王",
        subtitle: "討伐鎮守海峽的深海精英領主，衝刺三階進化！",
        isBossWave: true,
        isMiniBoss: true,
        miniBossPool: [
          { bossIds: [130], title: "小王・狂暴暴鯉龍", enemyTypes: ["Water", "Flying"] },
          { bossIds: [73],  title: "小王・劇毒刺水母", enemyTypes: ["Water", "Poison"] },
          { bossIds: [91],  title: "小王・極寒刺甲貝", enemyTypes: ["Water", "Ice"] },
          { bossIds: [121], title: "小王・閃耀寶石海星", enemyTypes: ["Water", "Psychic"] }
        ],
        enemyTypes: ["Water", "Ice"],
        enemyPool: [61, 73, 87, 91, 117],
        bossIds: [130],
        previewIds: [130, 91, 121],
        clearBonus: 145,
        weather: "RAIN"
      },
      {
        title: "海峽異變・隨機事件波",
        subtitle: "海象突變！把握事件機會取得大量經驗或夥伴支援！",
        eventPool: [
          {
            id: "storm_surge",
            title: "事件・狂暴雷暴水潮",
            subtitle: "雷暴降臨！電系與水系精靈湧入，電系彈射 +1 爽快清場！",
            enemyTypes: ["Electric", "Water"],
            enemyPool: [81, 82, 100, 101, 117, 121],
            elitePool: [82, 101, 130],
            previewIds: [82, 101, 130],
            killQuota: 34,
            weather: "THUNDER"
          },
          {
            id: "chansey_escort",
            title: "事件・幸福吉利蛋護送潮",
            subtitle: "擊破海岬守衛並攔截幸福吉利蛋，必掉神奇糖果與治癒球！",
            enemyTypes: ["Water", "Normal", "Ice"],
            enemyPool: [55, 86, 87, 113, 120, 131],
            elitePool: [87, 121, 131],
            previewIds: [113, 131, 87],
            killQuota: 32,
            spawnTreasure: "chansey",
            weather: "CLEAR"
          }
        ],
        enemyTypes: ["Water", "Ice", "Electric"],
        enemyPool: [82, 87, 117, 121],
        elitePool: [130, 131],
        previewIds: [113, 82, 131],
        killQuota: 34,
        clearBonus: 130,
        weather: "RAIN"
      },
      {
        title: "關底・極寒神鳥【急凍鳥】",
        subtitle: "討伐雙子島冰海神獸【急凍鳥】，奪取進軍無人發電廠的通行權！",
        isBossWave: true,
        isLegendaryBoss: true,
        enemyTypes: ["Ice", "Flying"],
        enemyPool: [87, 91, 131],
        bossIds: [144],
        previewIds: [144],
        clearBonus: 220,
        weather: "BLIZZARD",
        unlockRegionBadge: "海岬制霸"
      }
    ]
  },
  {
    id: "act3_power_plant",
    name: "無人發電廠・高壓磁場區",
    shortName: "無人發電廠",
    stageId: "power_plant",
    isArena: false,
    signStyle: "harbor",
    bounds: { halfW: 600, halfH: 460 },
    theme: { bg: "#1E293B", accent: "#0284C7", text: "#7DD3FC", badgeBg: "#0369A1", badgeLabel: "電廠徽章" },
    waves: [
      {
        title: "無人發電廠・磁場巡檢",
        subtitle: "踩上磁能加速帶（+22%速／-10%CD），順手觸發蓄電塔麻痺敵群！",
        enemyTypes: ["Electric", "Steel", "Poison"],
        enemyPool: [81, 82, 100, 101, 88, 109],
        elitePool: [82, 101, 125],
        previewIds: [82, 101, 125],
        killQuota: 34,
        clearBonus: 125,
        weather: "THUNDER"
      },
      {
        title: "發電廠中繼・高壓雙雄小王",
        subtitle: "討伐鎮守渦輪室的雷電精銳領主，收割高壓核心賞金！",
        isBossWave: true,
        isMiniBoss: true,
        miniBossPool: [
          { bossIds: [125], title: "小王・狂雷電擊獸領主", enemyTypes: ["Electric"] },
          { bossIds: [135], title: "小王・疾速雷伊布領主", enemyTypes: ["Electric"] },
          { bossIds: [89],  title: "小王・劇毒臭臭泥領主", enemyTypes: ["Poison"] }
        ],
        enemyTypes: ["Electric", "Poison"],
        enemyPool: [82, 101, 89, 110],
        bossIds: [125],
        previewIds: [125, 135, 89],
        clearBonus: 165,
        weather: "THUNDER"
      },
      {
        title: "高壓室異變・超載雷暴狂潮",
        subtitle: "發電廠磁場過載！善用磁能加速軌道風箏大批雷毒精銳！",
        enemyTypes: ["Electric", "Poison", "Steel"],
        enemyPool: [26, 82, 89, 101, 110, 125],
        elitePool: [26, 125, 135],
        previewIds: [26, 125, 135],
        killQuota: 38,
        clearBonus: 145,
        weather: "THUNDER"
      },
      {
        title: "關底・雷鳴神鳥【閃電鳥】",
        subtitle: "討伐盤踞發電廠核心的傳說神獸【閃電鳥】，進軍紅蓮火山！",
        isBossWave: true,
        isLegendaryBoss: true,
        enemyTypes: ["Electric", "Flying"],
        enemyPool: [82, 101, 125],
        bossIds: [145],
        previewIds: [145],
        clearBonus: 260,
        weather: "THUNDER",
        unlockRegionBadge: "電廠制霸"
      }
    ]
  },
  {
    id: "act4_volcano",
    name: "紅蓮島・火山熔岩洞窟",
    shortName: "紅蓮火山",
    stageId: "cinnabar_volcano",
    isArena: false,
    signStyle: "temple",
    bounds: { halfW: 600, halfH: 460 },
    theme: { bg: "#451A03", accent: "#EA580C", text: "#FDBA74", badgeBg: "#C2410C", badgeLabel: "火山徽章" },
    waves: [
      {
        title: "紅蓮火山・熔岩洞窟突進",
        subtitle: "留意 12 秒週期地熱蒸氣噴口，誘怪踩入熔岩與蒸氣區灼傷清場！",
        enemyTypes: ["Fire", "Rock", "Ground"],
        enemyPool: [37, 58, 74, 75, 77, 104, 111],
        elitePool: [59, 76, 78, 126],
        previewIds: [58, 75, 111],
        killQuota: 38,
        clearBonus: 140,
        weather: "HEATWAVE"
      },
      {
        title: "火山中繼・炎岩霸主小王",
        subtitle: "擊破盤踞火山口的炎岩精英領主，衝刺雙超武覺醒！",
        isBossWave: true,
        isMiniBoss: true,
        miniBossPool: [
          { bossIds: [126], title: "小王・熔岩鴨嘴火獸", enemyTypes: ["Fire"] },
          { bossIds: [112], title: "小王・重甲鑽角犀獸", enemyTypes: ["Ground", "Rock"] },
          { bossIds: [59],  title: "小王・烈焰風速狗", enemyTypes: ["Fire"] }
        ],
        enemyTypes: ["Fire", "Ground", "Rock"],
        enemyPool: [75, 78, 105, 112],
        bossIds: [126],
        previewIds: [126, 112, 59],
        clearBonus: 185,
        weather: "HEATWAVE"
      },
      {
        title: "地核震動・熾熱遠古狂潮",
        subtitle: "火山深處沸騰！遠古化石與火岩精銳傾巢而出！",
        enemyTypes: ["Fire", "Rock", "Ground"],
        enemyPool: [59, 76, 78, 112, 126, 139, 141],
        elitePool: [76, 112, 142],
        previewIds: [76, 126, 142],
        killQuota: 42,
        clearBonus: 165,
        weather: "HEATWAVE"
      },
      {
        title: "關底・烈焰神鳥【火焰鳥】",
        subtitle: "討伐紅蓮火山守護神獸【火焰鳥】，踏上最終石英高原！",
        isBossWave: true,
        isLegendaryBoss: true,
        enemyTypes: ["Fire", "Flying"],
        enemyPool: [59, 78, 126],
        bossIds: [146],
        previewIds: [146],
        clearBonus: 290,
        weather: "HEATWAVE",
        unlockRegionBadge: "火山制霸"
      }
    ]
  },
  {
    id: "act5_sky_pillar",
    name: "石英高原・古神殿",
    shortName: "石英高原",
    stageId: "sky_pillar",
    isArena: false,
    signStyle: "temple",
    bounds: { halfW: 620, halfH: 480 },
    theme: { bg: "#3B1D5A", accent: "#9333EA", text: "#E9D5FF", badgeBg: "#7E22CE", badgeLabel: "高原徽章" },
    waves: [
      {
        title: "石英高原・古神殿柱廊",
        subtitle: "淨空超能與幽靈守衛，善用大理石大道加速與冷卻縮減！",
        enemyTypes: ["Psychic", "Ghost"],
        enemyPool: [64, 92, 93, 96, 97, 122, 124],
        elitePool: [65, 94, 97],
        previewIds: [64, 93, 97],
        killQuota: 40,
        clearBonus: 155,
        weather: "PSYCHIC"
      },
      {
        title: "神殿中繼・雙雄小王阻擊",
        subtitle: "一近一遠雙小王並立阻截！擊破雙雄領取豐厚升級糖果！",
        isBossWave: true,
        isMiniBoss: true,
        miniBossPool: [
          { bossIds: [106, 107], title: "雙小王・格鬥雙雄（飛腿郎＆快拳郎）", enemyTypes: ["Fighting"] },
          { bossIds: [34, 31],   title: "雙小王・王者夫婦（尼多王＆尼多后）", enemyTypes: ["Poison", "Ground"] },
          { bossIds: [65, 94],   title: "雙小王・念影雙絕（胡地＆耿鬼）", enemyTypes: ["Psychic", "Ghost"] }
        ],
        enemyTypes: ["Fighting", "Psychic", "Ghost"],
        enemyPool: [65, 68, 94, 106, 107],
        bossIds: [106, 107],
        previewIds: [65, 94, 106],
        clearBonus: 210,
        weather: "PSYCHIC"
      },
      {
        title: "冠軍之路・MEGA 無雙狂潮",
        subtitle: "高階龍系與神殿精銳集結！解放 💎 MEGA 與雙超武痛快無雙收割！",
        enemyTypes: ["Dragon", "Psychic", "Fighting"],
        enemyPool: [65, 68, 94, 128, 130, 142, 148, 149],
        elitePool: [68, 143, 149],
        previewIds: [149, 143, 68],
        killQuota: 46,
        clearBonus: 195,
        weather: "PSYCHIC"
      },
      {
        title: "關底・冠軍殿堂守門雙霸",
        subtitle: "討伐【快龍＆卡比獸】最終守衛（困難以上追加傳說試煉），踏入石英鬥技場！",
        isBossWave: true,
        isLegendaryBoss: true,
        enemyTypes: ["Dragon", "Normal"],
        enemyPool: [65, 68, 148],
        bossIds: [149, 143],
        previewIds: [149, 143],
        clearBonus: 320,
        weather: "PSYCHIC",
        unlockRegionBadge: "高原制霸"
      }
    ]
  },
  {
    id: "final_arena",
    name: "石英大會鬥技場",
    shortName: "鬥技場",
    stageId: "sky_pillar",
    isArena: true,
    isFinalChapter: true,
    signStyle: "arena",
    bounds: null,
    theme: { bg: "#334155", accent: "#B91C1C", text: "#FDE047", badgeBg: "#D97706", badgeLabel: "冠軍徽章" },
    waves: [
      {
        title: "石英大會・終極決戰",
        subtitle: "封閉石柱競技場（[SHIFT] 閃避可用）！討伐王者【超夢】加冕遠征冠軍！",
        isBossWave: true,
        isLegendaryBoss: true,
        isFinalArena: true,
        enemyTypes: ["Psychic"],
        enemyPool: [],
        bossIds: [150],
        previewIds: [150],
        clearBonus: 520,
        weather: "PSYCHIC"
      }
    ]
  }
];

window.EXPEDITION_PACING = {
  startNextExp: 90,        // 大遠征 Lv.1 起始升級經驗（避免 W1/W2 連彈 5 次升級視窗，每波穩定 1~2 級）
  expGrowthMult: 1.14,     // 大遠征每級經驗成長倍率（平滑對齊 21 關節奏）
  expGrowthFlat: 28,       // 大遠征每級經驗固定增量
  earlyExpMult: 0.95,      // Lv.1~11 大遠征經驗倍率
  lateExpMult: 0.85,       // Lv.12+ 大遠征經驗倍率（不影響 8 分鐘標準／無盡模式）
  miniBossRareCandy: false,// 中繼小王改掉經驗晶＋賞金，僅區域關底神獸必掉直升神奇糖果
  ppUpEvenWavesOnly: true, // 整備站 PP 提升劑／極限糖果僅於偶數波（擊破小王／大王後）上架
  ppUpMaxPerRun: 4         // 單局遠征最多購買 4 次 PP 提升劑／極限糖果
};

window.ModeExpedition = {
  id: "expedition",
  _walkAnimRaf: null,
  _vsSkipCallback: null,
  _regionSignTimer: null,

  // 未來追加第四章、第五章地圖的標準掛載介面（自動插入在最終鬥技場之前，全 UI 與進度自動適配）
  registerChapter(chapterObj, insertBeforeFinal = true) {
    if (!chapterObj || !Array.isArray(chapterObj.waves) || chapterObj.waves.length === 0) return;
    const list = window.EXPEDITION_CHAPTERS;
    if (list.some(c => c.id === chapterObj.id)) return;
    if (insertBeforeFinal) {
      const finalIdx = list.findIndex(c => c.isFinalChapter);
      if (finalIdx !== -1) {
        list.splice(finalIdx, 0, chapterObj);
        return;
      }
    }
    list.push(chapterObj);
  },

  getChapterSummary() {
    const chs = window.EXPEDITION_CHAPTERS || [];
    const totalWaves = chs.reduce((s, c) => s + (c.waves ? c.waves.length : 0), 0);
    return { chapterCount: chs.length, totalWaves, chapters: chs };
  },

  buildWavePlan(act2BirdId = 144, seedRolls = null, diffId = "normal") {
    const chapters = window.EXPEDITION_CHAPTERS || [];
    const plan = [];
    const rolls = seedRolls || {};
    let waveIdx = 0;

    chapters.forEach((ch, chIdx) => {
      const actNum = chIdx + 1;
      (ch.waves || []).forEach((wDef, localIdx) => {
        waveIdx += 1;
        const entry = {
          ...wDef,
          wave: waveIdx,
          act: actNum,
          chapterIndex: chIdx,
          chapterId: ch.id,
          chapterName: ch.name,
          chapterShortName: ch.shortName,
          chapterTheme: ch.theme,
          signStyle: ch.signStyle || "wood",
          stageId: wDef.stageId || ch.stageId,
          isArena: wDef.isArena !== undefined ? wDef.isArena : !!ch.isArena,
          bounds: wDef.bounds !== undefined ? wDef.bounds : (ch.bounds || null),
          isFirstWaveOfChapter: (localIdx === 0),
          isLastWaveOfChapter: (localIdx === ch.waves.length - 1),
          isFinalChapter: !!ch.isFinalChapter
        };

        // 隨機小王池抽取（存入 rolls 供斷點續關還原）
        if (Array.isArray(wDef.miniBossPool) && wDef.miniBossPool.length > 0) {
          const rKey = `mb_${waveIdx}`;
          if (rolls[rKey] === undefined) {
            rolls[rKey] = Math.floor(Math.random() * wDef.miniBossPool.length);
          }
          const picked = wDef.miniBossPool[rolls[rKey] % wDef.miniBossPool.length];
          if (picked) {
            entry.title = picked.title;
            entry.bossIds = [...picked.bossIds];
            entry.previewIds = [...picked.bossIds];
            if (picked.enemyTypes) entry.enemyTypes = [...picked.enemyTypes];
          }
        }

        // 隨機事件波抽取
        if (Array.isArray(wDef.eventPool) && wDef.eventPool.length > 0) {
          const rKey = `ev_${waveIdx}`;
          if (rolls[rKey] === undefined) {
            rolls[rKey] = Math.floor(Math.random() * wDef.eventPool.length);
          }
          const ev = wDef.eventPool[rolls[rKey] % wDef.eventPool.length];
          if (ev) {
            entry.title = ev.title;
            entry.subtitle = ev.subtitle;
            entry.enemyTypes = [...ev.enemyTypes];
            entry.enemyPool = [...ev.enemyPool];
            entry.elitePool = [...(ev.elitePool || [])];
            entry.previewIds = [...ev.previewIds];
            entry.killQuota = ev.killQuota;
            entry.spawnTreasure = ev.spawnTreasure || null;
            entry.weather = ev.weather || "CLEAR";
          }
        }

        if (entry.isDynamicAct2Bird) {
          const isZapdos = act2BirdId === 145;
          const bName = isZapdos ? "閃電鳥" : "急凍鳥";
          entry.title = `關底・傳說【${bName}】降臨`;
          entry.subtitle = `擊敗海峽守護神獸【${bName}】，奪取進軍下一區域的通行權！`;
          entry.enemyTypes = isZapdos ? ["Electric", "Flying"] : ["Ice", "Flying"];
          entry.bossIds = [act2BirdId];
          entry.previewIds = [act2BirdId];
          entry.weather = isZapdos ? "THUNDER" : "BLIZZARD";
        }

        // W15 困難／地獄難度升級為「三聖鳥接力車輪戰」（急凍鳥 ➔ 閃電鳥 ➔ 火焰鳥，同場始終只有 1 隻神鳥保持清晰彈幕）
        if (entry.isAct3RelayBoss && (diffId === "hard" || diffId === "hell")) {
          entry.title = "關底・三聖鳥接力車輪戰";
          entry.subtitle = "急凍鳥 ➔ 閃電鳥 ➔ 火焰鳥依序帶天候接力降臨！討伐三神踏入石英鬥技場！";
          entry.enemyTypes = ["Ice", "Electric", "Fire", "Flying"];
          entry.bossIds = [144];
          entry.relayQueue = [145, 146];
          entry.previewIds = [144, 145, 146];
          entry.weather = "BLIZZARD";
        }

        plan.push(entry);
      });
    });

    return { plan, rolls };
  },

  onStart(app) {
    app.isExpeditionMode = true;
    app.isEndlessMode = false;
    app.isArenaMode = false;
    app._pendingExpeditionIntermission = false;
    app.lastExpeditionResult = null;
    app.areaClearStampTimer = 0;

    const resumeCp = app._resumeExpeditionCheckpoint || null;
    app._resumeExpeditionCheckpoint = null;

    const act2BirdId = resumeCp
      ? (resumeCp.act2BirdId || 144)
      : (Math.random() < 0.5 ? 144 : 145);
    const diffId = (app.selectedDifficulty && app.selectedDifficulty.id) || "normal";
    const built = this.buildWavePlan(act2BirdId, resumeCp ? (resumeCp.seedRolls || null) : null, diffId);
    const plan = built.plan;
    const seedRolls = built.rolls;
    const totalWaves = plan.length;
    const startWaveNum = resumeCp
      ? Math.max(1, Math.min(totalWaves, resumeCp.nextWave || 1))
      : 1;

    app.expeditionState = {
      currentWave: startWaveNum,
      totalWaves,
      act2BirdId,
      seedRolls,
      plan,
      spawnedCount: 0,
      killsInWave: 0,
      killQuota: 0,
      spawnCd: 0.5,
      eliteSpawnedCount: 0,
      treasureSpawned: false,
      powerupSpawned: false,
      waveCleared: false,
      clearDelayTimer: 0,
      activeRelayQueue: [],
      inExMewBattle: false,
      exMewCleared: false,
      shopShelf: [],
      shopRerollCost: 30,
      shopBoughtCounts: (resumeCp && resumeCp.shopBoughtCounts) ? { ...resumeCp.shopBoughtCounts } : { candy: 0, heal: 0 },
      pendingForgetTm: null
    };

    if (resumeCp) {
      this.applyCheckpointToRun(app, resumeCp);
    }

    this.launchWaveWithCeremony(app, startWaveNum);
  },

  applyCheckpointToRun(app, cp) {
    const p = app.player;
    if (!p || !cp || !cp.player) return;
    const sp = cp.player;
    const pData = POKEMON_MAP.get(sp.id);
    if (pData) {
      p.id = pData.id;
      p.data = pData;
    }
    p.level = sp.level || 1;
    p.exp = sp.exp || 0;
    p.nextExp = sp.nextExp || 18;
    p.maxHp = sp.maxHp || p.maxHp;
    p.hp = Math.min(p.maxHp, sp.hp || p.maxHp);
    p.baseAtk = sp.baseAtk || p.baseAtk;
    p.baseSpeed = sp.baseSpeed || p.baseSpeed;
    p.dmgMult = sp.dmgMult || p.dmgMult;
    p.cdMult = sp.cdMult || p.cdMult;
    p.speedMult = sp.speedMult || p.speedMult;
    p.areaMult = sp.areaMult || p.areaMult;
    p.critRate = sp.critRate || p.critRate;
    p.magnetRadius = sp.magnetRadius || p.magnetRadius;
    p.finalEvoArmor = sp.finalEvoArmor || 0;
    p.megaEvolved = !!sp.megaEvolved;
    p.singleStageAwakened = !!sp.singleStageAwakened;
    p.legendaryAwaken12 = !!sp.legendaryAwaken12;
    p.legendaryAwaken24 = !!sp.legendaryAwaken24;
    p.underdogExpBonus = sp.underdogExpBonus || 0;
    p.heldItems = { ...(sp.heldItems || {}) };
    if (sp.loadoutMagnetPulseTimer !== undefined) p.loadoutMagnetPulseTimer = sp.loadoutMagnetPulseTimer;
    if (sp.loadoutShinyMult) p.loadoutShinyMult = sp.loadoutShinyMult;
    if (sp.loadoutCoinMult) p.loadoutCoinMult = sp.loadoutCoinMult;
    app.activeLoadoutBuffs = { ...(cp.activeLoadoutBuffs || {}) };

    p.skills = {};
    Object.entries(sp.skills || {}).forEach(([k, sk]) => {
      p.skills[k] = {
        id: sk.id,
        level: sk.level || 1,
        evolved: !!sk.evolved,
        timer: 0.25,
        ultTimer: sk.evolved ? 2.0 : undefined,
        ultMaxCd: sk.evolved ? 10.0 : undefined
      };
    });
    if (Array.isArray(sp.naturalSkills)) p.naturalSkills = [...sp.naturalSkills];
    if (typeof getPokemonInnateTrait === "function") {
      p.innateTrait = getPokemonInnateTrait(p.data, p.level);
    }
    app.partners = [];
    (cp.partners || []).forEach(pt => {
      const ptData = POKEMON_MAP.get(pt.id);
      if (ptData) {
        app.partners.push({
          id: ptData.id, data: ptData, level: pt.level || 1,
          x: p.x, y: p.y, facingX: -1, facingY: 1, cdTimer: 0.6
        });
      }
    });
    app.kills = cp.kills || 0;
    app.runCoins = cp.runCoins || 0;
    app.runTime = cp.runTime || 0;
  },

  saveCheckpoint(app, nextWave) {
    if (!app || !app.saveData || !app.player || !app.expeditionState) return;
    const p = app.player;
    const st = app.expeditionState;
    const skillsSnap = {};
    Object.entries(p.skills || {}).forEach(([k, sk]) => {
      skillsSnap[k] = { id: sk.id, level: sk.level, evolved: !!sk.evolved };
    });
    app.saveData.expeditionCheckpoint = {
      nextWave,
      totalWaves: st.totalWaves || st.plan.length,
      act2BirdId: st.act2BirdId || 144,
      seedRolls: { ...(st.seedRolls || {}) },
      shopBoughtCounts: { ...(st.shopBoughtCounts || { candy: 0, heal: 0 }) },
      trainerId: (app.selectedTrainer && app.selectedTrainer.id) || "ash",
      starterId: app.selectedStarterId || 25,
      difficultyId: (app.selectedDifficulty && app.selectedDifficulty.id) || "normal",
      activeLoadoutBuffs: { ...(app.activeLoadoutBuffs || {}) },
      kills: app.kills || 0,
      runCoins: app.runCoins || 0,
      runTime: app.runTime || 0,
      partners: (app.partners || []).map(pt => ({ id: pt.id, level: pt.level })),
      player: {
        id: p.id, level: p.level, exp: p.exp, nextExp: p.nextExp,
        hp: Math.ceil(p.hp), maxHp: p.maxHp, baseAtk: p.baseAtk, baseSpeed: p.baseSpeed,
        dmgMult: p.dmgMult, cdMult: p.cdMult, speedMult: p.speedMult, areaMult: p.areaMult,
        critRate: p.critRate, magnetRadius: p.magnetRadius || 92,
        finalEvoArmor: p.finalEvoArmor || 0,
        megaEvolved: !!p.megaEvolved,
        singleStageAwakened: !!p.singleStageAwakened,
        legendaryAwaken12: !!p.legendaryAwaken12,
        legendaryAwaken24: !!p.legendaryAwaken24,
        underdogExpBonus: p.underdogExpBonus || 0,
        loadoutMagnetPulseTimer: p.loadoutMagnetPulseTimer,
        loadoutShinyMult: p.loadoutShinyMult || 1.0,
        loadoutCoinMult: p.loadoutCoinMult || 1.0,
        heldItems: { ...(p.heldItems || {}) },
        skills: skillsSnap,
        naturalSkills: [...(p.naturalSkills || [])]
      }
    };
    if (app.saveToStorage) app.saveToStorage();
  },

  clearCheckpoint(app) {
    if (app && app.saveData && app.saveData.expeditionCheckpoint) {
      app.saveData.expeditionCheckpoint = null;
      if (app.saveToStorage) app.saveToStorage();
    }
  },

  // 啟動波次前的儀式路由：Boss 關卡先播放 1.15s 斜切 VS 對峙橫幅（點擊可跳過）
  launchWaveWithCeremony(app, waveNum) {
    const st = app.expeditionState;
    if (!st) return;
    const cfg = st.plan[waveNum - 1];
    if (!cfg) return;

    if (cfg.isBossWave && Array.isArray(cfg.bossIds) && cfg.bossIds.length > 0) {
      this.showBossVsOverlay(app, cfg, () => this.startWave(app, waveNum));
    } else {
      this.startWave(app, waveNum);
    }
  },

  // 共用原比例鎖定像素繪製器（徹底杜絕人物與精靈被拉長或壓扁變形）
  drawSpriteFitHeight(ctx, img, cx, bottomY, targetH, flipX = false, srcRect = null) {
    if (!img) return;
    const sw = srcRect ? srcRect.w : (img.naturalWidth || img.width || 0);
    const sh = srcRect ? srcRect.h : (img.naturalHeight || img.height || 0);
    if (sw <= 0 || sh <= 0) return;
    const aspect = sw / sh;
    const dh = Math.round(targetH);
    const dw = Math.max(1, Math.round(targetH * aspect));
    const dx = Math.round(cx - dw * 0.5);
    const dy = Math.round(bottomY - dh);

    ctx.save();
    if (flipX) {
      ctx.translate(Math.round(cx), 0);
      ctx.scale(-1, 1);
      if (srcRect) {
        ctx.drawImage(img, srcRect.x, srcRect.y, sw, sh, Math.round(-dw * 0.5), dy, dw, dh);
      } else {
        ctx.drawImage(img, Math.round(-dw * 0.5), dy, dw, dh);
      }
    } else {
      if (srcRect) {
        ctx.drawImage(img, srcRect.x, srcRect.y, sw, sh, dx, dy, dw, dh);
      } else {
        ctx.drawImage(img, dx, dy, dw, dh);
      }
    }
    ctx.restore();
  },

  showBossVsOverlay(app, cfg, onDone) {
    const ov = document.getElementById("bossVsOverlay");
    const can = document.getElementById("bossEncounterCanvas");
    if (!ov || !can) {
      if (typeof onDone === "function") onDone();
      return;
    }
    app.state = "PAUSED";
    const tr = app.selectedTrainer || TRAINERS[0];
    const trCos = (typeof getResolvedTrainerCostume === "function") ? getResolvedTrainerCostume(tr, app.saveData) : tr;
    const p = app.player;
    const pData = (p && p.data) || POKEMON_MAP.get(25);
    const bossIds = (cfg.bossIds && cfg.bossIds.length > 0) ? cfg.bossIds : [150];
    const bossList = bossIds.map(id => POKEMON_MAP.get(id) || POKEMON_MAP.get(150));

    // 預熱像素圖與剪影快取（主角背影、訓練家背影、Boss 正面）
    const pBackUrl = (p && p.isShiny && pData.shiny_back_sprite) ? pData.shiny_back_sprite : (pData.back_sprite || pData.forward_sprite);
    SpriteCache.get(pBackUrl);
    if (trCos.walkSheet) SpriteCache.get(trCos.walkSheet);
    if (trCos.sprites && trCos.sprites.up) SpriteCache.get(trCos.sprites.up);
    if (trCos.sprite) SpriteCache.get(trCos.sprite);
    bossList.forEach(b => { if (b && b.forward_sprite) SpriteCache.get(b.forward_sprite); });

    const bossNames = bossList.map(b => b.name_zh).join(" ＆ ");
    const fullDialog = cfg.isLegendaryBoss
      ? `傳說神獸【${bossNames}】降臨戰場！全力迎戰！`
      : `關底首領【${bossNames}】擋住了去路！準備決戰！`;
    const subTagEl = document.getElementById("vsSubTag");
    if (subTagEl) {
      subTagEl.textContent = `ACT ${cfg.act} · WAVE ${cfg.wave}/${app.expeditionState.totalWaves} · ${cfg.chapterShortName}`;
    }
    const speakerEl = document.getElementById("bossEncounterSpeakerTag");
    if (speakerEl) {
      speakerEl.textContent = cfg.isLegendaryBoss ? "LEGENDARY ALERT" : "BOSS WARNING";
    }
    const dlgEl = document.getElementById("bossEncounterDialogText");
    if (dlgEl) dlgEl.textContent = "";

    ov.classList.remove("hidden");
    ov.style.display = "flex";
    if (typeof SoundFX !== "undefined") {
      SoundFX.play("boss_encounter");
    }

    let finished = false;
    let revealSfxPlayed = false;
    let rafId = null;
    const startTs = performance.now();
    const totalMs = 2500; // 完整 2.5 秒四拍電影級遇敵儀式

    const finish = () => {
      if (finished) return;
      finished = true;
      if (rafId) cancelAnimationFrame(rafId);
      clearTimeout(this._vsTimer);
      this._vsSkipCallback = null;
      ov.classList.add("hidden");
      ov.style.display = "none";
      if (typeof onDone === "function") onDone();
    };
    this._vsSkipCallback = finish;

    const renderEncounterFrame = (nowTs) => {
      if (finished) return;
      const elapsed = nowTs - startTs;
      const t = Math.min(1, elapsed / totalMs);

      if (!revealSfxPlayed && elapsed >= 940) {
        revealSfxPlayed = true;
        if (typeof SoundFX !== "undefined") SoundFX.play("super");
      }

      this.drawGbaBossEncounterScene(can, app, cfg, tr, trCos, p, pData, pBackUrl, bossList, elapsed, totalMs);

      if (dlgEl) {
        if (elapsed < 950) {
          dlgEl.textContent = "……偵測到高能頭目反應！";
        } else {
          const dlgProgress = Math.min(1, (elapsed - 950) / 1050);
          const charCount = Math.min(fullDialog.length, Math.floor(dlgProgress * fullDialog.length));
          dlgEl.textContent = fullDialog.slice(0, charCount);
        }
      }

      if (t < 1) {
        rafId = requestAnimationFrame(renderEncounterFrame);
      } else {
        this._vsTimer = setTimeout(finish, 80);
      }
    };
    rafId = requestAnimationFrame(renderEncounterFrame);
  },

  // 現代 HD-2D 像素 2/3 屏四拍 Boss 遇敵對峙演出 (480x420，完整 2.5 秒)
  drawGbaBossEncounterScene(canvas, app, cfg, tr, trCos, p, pData, pBackUrl, bossList, elapsed, totalMs) {
    const w = canvas.width = 480;
    const h = canvas.height = 420;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;

    const stId = cfg.isArena ? "arena" : (cfg.stageId || "pallet");
    const primaryBoss = bossList[0] || POKEMON_MAP.get(150);
    const bossTypeCol = (typeof TYPE_COLORS !== "undefined" && TYPE_COLORS[primaryBoss.type1]) || "#F43F5E";

    // 四拍時間軸 (0.00-0.38s 警報百葉窗 | 0.38-0.94s 剪影滑入 | 0.94-1.48s 破影爆發+精靈球放出 | 1.48-2.50s 戰術定格)
    const blindsT = Math.min(1, Math.max(0, (elapsed - 160) / 240));
    const slideRaw = Math.min(1, Math.max(0, (elapsed - 340) / 560));
    const slideEase = 1 - Math.pow(1 - slideRaw, 3);
    const isRevealed = elapsed >= 940;
    const revealElapsed = Math.max(0, elapsed - 940);
    const revealT = Math.min(1, revealElapsed / 420);
    const plaqueT = Math.min(1, Math.max(0, (elapsed - 1220) / 280));

    // 破影瞬間輕微鏡頭震動
    let shakeX = 0, shakeY = 0;
    if (elapsed >= 940 && elapsed < 1200) {
      const mag = (1 - (elapsed - 940) / 260) * 6.5;
      shakeX = Math.round((Math.random() - 0.5) * mag * 2);
      shakeY = Math.round((Math.random() - 0.5) * mag * 2);
    }

    ctx.save();
    ctx.translate(shakeX, shakeY);

    // 1. 現代 HD-2D 深邃生態戰場背景（與遊戲本體黑金像素風格 100% 統一）
    const themes = {
      pallet:       { top: "#061A14", mid: "#0F3D2E", bot: "#0A261C", glow: "#22C55E", rim: "#4ADE80", platTop: "#14532D", platIn: "#166534", particle: "#86EFAC" },
      cerulean_bay: { top: "#041628", mid: "#0C4A6E", bot: "#082F49", glow: "#38BDF8", rim: "#7DD3FC", platTop: "#0369A1", platIn: "#0284C7", particle: "#BAE6FD" },
      sky_pillar:   { top: "#0F0724", mid: "#3B0764", bot: "#1E1B4B", glow: "#A855F7", rim: "#E9D5FF", platTop: "#4C1D95", platIn: "#5B21B6", particle: "#D8B4FE" },
      arena:        { top: "#090D16", mid: "#1E293B", bot: "#0F172A", glow: "#F59E0B", rim: "#FDE047", platTop: "#334155", platIn: "#475569", particle: "#FDE047" }
    };
    const th = themes[stId] || themes.pallet;

    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, th.top);
    bgGrad.addColorStop(0.52, th.mid);
    bgGrad.addColorStop(1, th.bot);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(-10, -10, w + 20, h + 20);

    // 地平線氛圍發光帶 + 遠景剪影
    const hGlow = ctx.createRadialGradient(w * 0.55, h * 0.44, 10, w * 0.55, h * 0.44, 240);
    hGlow.addColorStop(0, isRevealed ? `${bossTypeCol}48` : `${th.glow}30`);
    hGlow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = hGlow;
    ctx.fillRect(0, 0, w, h);

    if (stId === "pallet") {
      ctx.fillStyle = "rgba(4, 20, 14, 0.72)";
      for (let x = -20; x < w + 40; x += 48) {
        ctx.beginPath(); ctx.arc(x, 198, 34, Math.PI, 0); ctx.fill();
      }
    } else if (stId === "cerulean_bay") {
      ctx.fillStyle = "rgba(125, 211, 252, 0.16)";
      for (let row = 0; row < 6; row++) {
        const wy = 212 + row * 28;
        const drift = Math.round((elapsed * 0.04 + row * 23) % 80);
        for (let wx = -40; wx < w + 40; wx += 84) {
          ctx.fillRect(wx + drift, wy, 32, 2);
        }
      }
    } else if (stId === "sky_pillar") {
      ctx.fillStyle = "rgba(15, 7, 36, 0.65)";
      for (let px = 22; px < w; px += 92) {
        ctx.fillRect(px, 60, 18, 160);
        ctx.fillRect(px - 6, 54, 30, 8);
      }
    } else if (stId === "arena") {
      ctx.fillStyle = "rgba(250, 204, 21, 0.11)";
      const sway = Math.sin(elapsed * 0.004) * 28;
      ctx.beginPath(); ctx.moveTo(w * 0.2, 0); ctx.lineTo(w * 0.05 + sway, h); ctx.lineTo(w * 0.35 + sway, h); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(w * 0.8, 0); ctx.lineTo(w * 0.65 - sway, h); ctx.lineTo(w * 0.95 - sway, h); ctx.closePath(); ctx.fill();
    }

    // 動態速度光線（破影瞬間加密加速）
    const speedLineSpeed = isRevealed ? 0.55 : 0.28;
    ctx.fillStyle = isRevealed ? "rgba(255, 255, 255, 0.15)" : "rgba(255, 255, 255, 0.07)";
    for (let i = 0; i < 14; i++) {
      const ly = 24 + i * 28;
      const lx = ((i * 97 + elapsed * speedLineSpeed) % (w + 160)) - 120;
      ctx.fillRect(lx, ly, 76 + (i % 3) * 26, 2);
    }

    // 生態氛圍微粒（飄葉／雨絲／神殿符文光點／競技場火星）
    ctx.fillStyle = th.particle;
    for (let m = 0; m < 18; m++) {
      const px = (m * 73 + elapsed * (stId === "cerulean_bay" ? -0.14 : 0.05)) % w;
      const py = (m * 59 + elapsed * (stId === "cerulean_bay" ? 0.34 : -0.06)) % h;
      const drawX = px < 0 ? px + w : px;
      const drawY = py < 0 ? py + h : py;
      ctx.globalAlpha = 0.42;
      if (stId === "cerulean_bay") {
        ctx.fillRect(drawX, drawY, 2, 10);
      } else {
        ctx.fillRect(drawX, drawY, 3, 3);
      }
    }
    ctx.globalAlpha = 1.0;

    // 立體 HD-2D 發光對戰台座繪製器
    const drawModernPedestal = (cx, cy, rx, ry, accentCol) => {
      ctx.save();
      const auraGrad = ctx.createRadialGradient(cx, cy, rx * 0.4, cx, cy, rx * 1.25);
      auraGrad.addColorStop(0, `${accentCol}55`);
      auraGrad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = auraGrad;
      ctx.beginPath(); ctx.ellipse(cx, cy, rx * 1.25, ry * 1.45, 0, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = "rgba(2, 6, 23, 0.72)";
      ctx.beginPath(); ctx.ellipse(cx, cy + 10, rx + 5, ry + 3, 0, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = accentCol;
      ctx.beginPath(); ctx.ellipse(cx, cy + 3, rx + 3, ry + 2, 0, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = th.platTop;
      ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = th.platIn;
      ctx.beginPath(); ctx.ellipse(cx, cy - 2, rx * 0.80, ry * 0.72, 0, 0, Math.PI * 2); ctx.fill();

      ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(cx, cy - 1, rx * 0.90, ry * 0.84, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    };

    // 2. 右上角：敵方 Boss 台座（從左向右高速滑入至右上）
    const enemyBaseX = -150 + (w * 0.70 + 150) * slideEase;
    const enemyBaseY = 204;
    drawModernPedestal(enemyBaseX, enemyBaseY, 108, 32, isRevealed ? bossTypeCol : "#64748B");

    // 破影爆發的屬性光環衝擊波
    if (isRevealed && revealT < 1) {
      ctx.save();
      ctx.globalAlpha = (1 - revealT) * 0.85;
      ctx.strokeStyle = bossTypeCol;
      ctx.lineWidth = 6 * (1 - revealT) + 1.5;
      ctx.beginPath();
      ctx.arc(enemyBaseX, enemyBaseY - 58, 28 + revealT * 120, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 2.5 * (1 - revealT) + 1;
      ctx.beginPath();
      ctx.arc(enemyBaseX, enemyBaseY - 58, 16 + revealT * 88, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 繪製 Boss（Beat 2 壓迫感黑影 ➔ Beat 3 閃白破影 ➔ 高清放大原比例立繪）
    const idleBob = isRevealed ? Math.sin(revealElapsed * 0.008) * 4 : 0;
    const drawBossSprite = (bData, cx, bottomY, targetH) => {
      if (!bData || !bData.forward_sprite) return;
      const rec = SpriteCache.get(bData.forward_sprite);
      if (!rec || !rec.loaded) return;

      ctx.fillStyle = "rgba(2, 6, 23, 0.55)";
      ctx.beginPath(); ctx.ellipse(cx, bottomY - 2, targetH * 0.32, targetH * 0.09, 0, 0, Math.PI * 2); ctx.fill();

      if (!isRevealed) {
        const sil = SpriteCache.getSilhouette(bData.forward_sprite, "#020617");
        this.drawSpriteFitHeight(ctx, sil || rec.img, cx, bottomY, targetH, false);
      } else if (revealElapsed < 110) {
        const wSil = SpriteCache.getSilhouette(bData.forward_sprite, "#FFFFFF");
        this.drawSpriteFitHeight(ctx, wSil || rec.img, cx, bottomY + idleBob, targetH, false);
      } else {
        this.drawSpriteFitHeight(ctx, rec.img, cx, bottomY + idleBob, targetH, false);
      }
    };

    if (bossList.length >= 2) {
      drawBossSprite(bossList[1], enemyBaseX + 42, enemyBaseY - 4, 122);
      drawBossSprite(bossList[0], enemyBaseX - 36, enemyBaseY + 10, 132);
    } else {
      drawBossSprite(bossList[0], enemyBaseX, enemyBaseY + 8, 148);
    }

    // 3. 左下角：我方台座（從右向左高速滑入至左下）
    const playerBaseX = w + 150 - (w + 150 - w * 0.30) * slideEase;
    const playerBaseY = 368;
    drawModernPedestal(playerBaseX, playerBaseY, 126, 36, "#38BDF8");

    // 訓練家背影（嚴格鎖定單格原始寬高比，徹底告別變瘦！）
    const sheetUrl = trCos.walkSheet || tr.walkSheet;
    const sheetRec = sheetUrl ? SpriteCache.get(sheetUrl) : null;
    if (sheetRec && sheetRec.loaded && sheetRec.img.naturalWidth > 0) {
      const fw = Math.floor(sheetRec.img.naturalWidth / 3);
      const fh = Math.floor(sheetRec.img.naturalHeight / 4);
      this.drawSpriteFitHeight(ctx, sheetRec.img, playerBaseX - 66, playerBaseY + 12, 114, false, { x: fw, y: 3 * fh, w: fw, h: fh });
    } else if (trCos.sprites && trCos.sprites.up) {
      const upRec = SpriteCache.get(trCos.sprites.up);
      if (upRec && upRec.loaded) this.drawSpriteFitHeight(ctx, upRec.img, playerBaseX - 66, playerBaseY + 12, 112, false);
    } else if (trCos.sprite) {
      const trRec = SpriteCache.get(trCos.sprite);
      if (trRec && trRec.loaded) this.drawSpriteFitHeight(ctx, trRec.img, playerBaseX - 66, playerBaseY + 12, 112, false);
    }

    // 主角精靈背影（Beat 3 從紅白精靈球光束中彈出就位，原比例鎖定 134px！）
    const pBackRec = SpriteCache.get(pBackUrl);
    if (pBackRec && pBackRec.loaded) {
      if (elapsed >= 760 && elapsed < 960) {
        const ballT = (elapsed - 760) / 200;
        const bx = (playerBaseX - 50) + (82) * ballT;
        const by = (playerBaseY - 62) - Math.sin(ballT * Math.PI) * 58 + ballT * 28;
        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(ballT * Math.PI * 3);
        ctx.fillStyle = "#EF4444"; ctx.beginPath(); ctx.arc(0, 0, 10, Math.PI, 0); ctx.fill();
        ctx.fillStyle = "#FFFFFF"; ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI); ctx.fill();
        ctx.strokeStyle = "#0F172A"; ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(10, 0); ctx.stroke();
        ctx.fillStyle = "#FFFFFF"; ctx.beginPath(); ctx.arc(0, 0, 3.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.restore();
      } else if (isRevealed) {
        const popScale = Math.min(1, revealElapsed / 220);
        const popEase = 1 - Math.pow(1 - popScale, 3);
        if (revealT < 0.85) {
          ctx.save();
          ctx.globalAlpha = (1 - revealT / 0.85) * 0.78;
          ctx.fillStyle = "#38BDF8";
          ctx.fillRect(playerBaseX + 18, playerBaseY - 140, 28, 140);
          ctx.strokeStyle = "#FACC15";
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.ellipse(playerBaseX + 32, playerBaseY + 2, 20 + revealT * 60, 8 + revealT * 20, 0, 0, Math.PI * 2); ctx.stroke();
          ctx.restore();
        }
        const pkH = Math.max(16, 134 * popEase);
        const pkImg = revealElapsed < 110 ? (SpriteCache.getSilhouette(pBackUrl, "#FFFFFF") || pBackRec.img) : pBackRec.img;
        this.drawSpriteFitHeight(ctx, pkImg, playerBaseX + 32, playerBaseY + 12 - idleBob * 0.6, pkH, false);
      }
    }

    // 4. 統一現代黑金像素雙邊戰術銘牌（與遊戲 8 分鐘 HUD 風格一致）
    if (plaqueT > 0) {
      ctx.save();
      ctx.globalAlpha = plaqueT;
      const slideIn = (1 - plaqueT) * 28;

      const bx = 14 - slideIn, by = 18;
      ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
      ctx.strokeStyle = "#EF4444";
      ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.roundRect(bx, by, 212, 54, 10); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#DC2626";
      ctx.fillRect(bx + 6, by + 8, 5, 38);
      ctx.fillStyle = "#FEF08A";
      ctx.font = "900 13px 'Noto Sans TC', sans-serif";
      ctx.textAlign = "left";
      const bossTitle = bossList.length > 1 ? `${bossList[0].name_zh} ＆ ${bossList[1].name_zh}` : bossList[0].name_zh;
      ctx.fillText(bossTitle, bx + 18, by + 25);
      ctx.fillStyle = "#FDA4AF";
      ctx.font = "bold 9px monospace";
      ctx.fillText("BOSS HP", bx + 18, by + 44);
      ctx.fillStyle = "#020617";
      ctx.fillRect(bx + 70, by + 35, 128, 10);
      ctx.fillStyle = "#EF4444";
      ctx.fillRect(bx + 72, by + 37, 124, 6);

      const px = w - 210 + slideIn, py = h - 72;
      ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
      ctx.strokeStyle = "#F59E0B";
      ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.roundRect(px, py, 196, 54, 10); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#38BDF8";
      ctx.fillRect(px + 6, py + 8, 5, 38);
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "900 13px 'Noto Sans TC', sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`${pData.name_zh}`, px + 18, py + 25);
      ctx.fillStyle = "#FACC15";
      ctx.font = "bold 11px monospace";
      ctx.textAlign = "right";
      ctx.fillText(`Lv.${p ? p.level : 1}`, px + 184, py + 25);
      ctx.fillStyle = "#020617";
      ctx.fillRect(px + 18, py + 35, 166, 10);
      const hpPct = p ? Math.max(0.05, Math.min(1, p.hp / (p.maxHp || 100))) : 1;
      ctx.fillStyle = "#22C55E";
      ctx.fillRect(px + 20, py + 37, Math.round(162 * hpPct), 6);

      ctx.restore();
    }

    // 柔和暗角（Vignette）提升電影質感
    const vig = ctx.createRadialGradient(w * 0.5, h * 0.5, w * 0.30, w * 0.5, h * 0.5, w * 0.72);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(2,6,23,0.55)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);

    ctx.restore();

    // 5. 頂層轉場特效：Beat 1 警報閃屏 + 經典水平百葉窗撕裂展開 + Beat 3 破影閃白
    if (elapsed < 160) {
      const flashOn = (Math.floor(elapsed / 42) % 2) === 0;
      ctx.fillStyle = flashOn ? "rgba(255, 255, 255, 0.88)" : "rgba(185, 28, 28, 0.55)";
      ctx.fillRect(0, 0, w, h);
    } else if (blindsT < 1) {
      const strips = 12;
      const sh = Math.ceil(h / strips);
      ctx.fillStyle = "#020617";
      for (let s = 0; s < strips; s++) {
        const dir = s % 2 === 0 ? -1 : 1;
        const offsetX = dir * w * blindsT;
        ctx.fillRect(offsetX, s * sh, w, sh + 1);
      }
    } else if (elapsed >= 940 && elapsed < 1070) {
      const fAlpha = (1 - (elapsed - 940) / 130) * 0.78;
      ctx.fillStyle = `rgba(255, 255, 255, ${fAlpha.toFixed(2)})`;
      ctx.fillRect(0, 0, w, h);
    }
  },

  skipBossVsOverlay() {
    if (typeof this._vsSkipCallback === "function") {
      this._vsSkipCallback();
    }
  },

  showRegionSign(cfg) {
    const sign = document.getElementById("gbaRegionSign");
    if (!sign) return;
    const titleEl = document.getElementById("gbaRegionSignTitle");
    const subEl   = document.getElementById("gbaRegionSignSub");
    const styleClsMap = {
      wood:   "bg-amber-950/95 border-amber-500 text-amber-100",
      ocean:  "bg-sky-950/95 border-sky-400 text-sky-100",
      temple: "bg-purple-950/95 border-purple-400 text-purple-100",
      arena:  "bg-rose-950/95 border-amber-400 text-amber-200"
    };
    const cls = styleClsMap[cfg.signStyle] || styleClsMap.wood;
    sign.className = `absolute top-[86px] left-2 z-30 px-3 py-1.5 rounded-r-xl border-l-4 border-2 shadow-2xl cursor-pointer transition-all duration-300 pointer-events-auto ${cls}`;
    if (titleEl) titleEl.textContent = `ACT ${cfg.act} · ${cfg.chapterName}`;
    if (subEl) subEl.textContent = cfg.title;
    sign.classList.remove("hidden");

    clearTimeout(this._regionSignTimer);
    this._regionSignTimer = setTimeout(() => {
      sign.classList.add("hidden");
    }, 2200);
  },

  dismissRegionSign() {
    const sign = document.getElementById("gbaRegionSign");
    if (sign) sign.classList.add("hidden");
    clearTimeout(this._regionSignTimer);
  },

  startWave(app, waveNum) {
    const st = app.expeditionState;
    if (!st) return;
    const cfg = st.plan[waveNum - 1];
    if (!cfg) return;

    st.currentWave = waveNum;
    st.spawnedCount = 0;
    st.killsInWave = 0;
    const dIdQ = (app.selectedDifficulty && app.selectedDifficulty.id) || 'normal';
    const qMult = dIdQ === 'hell' ? 1.35 : (dIdQ === 'hard' ? 1.25 : (dIdQ === 'normal' ? 1.15 : 1.0));
    st.killQuota = cfg.isBossWave ? 0 : Math.round((cfg.killQuota || 25) * qMult);
    st.spawnCd = 0.45;
    st.eliteSpawnedCount = 0;
    st.treasureSpawned = false;
    st.powerupSpawned = false;
    st.waveCleared = false;
    st.clearDelayTimer = 0;
    st.activeRelayQueue = Array.isArray(cfg.relayQueue) ? [...cfg.relayQueue] : [];
    st.inExMewBattle = false;
    app.areaClearStampTimer = 0;

    // 1. 切換地圖、固定邊界與天候
    const isFinalArena = !!cfg.isArena;
    app.isArenaMode = isFinalArena;
    if (typeof MapEngine !== "undefined") {
      if (MapEngine.setArenaMode) MapEngine.setArenaMode(isFinalArena);
      if (!isFinalArena) {
        if (MapEngine.setStage) MapEngine.setStage(cfg.stageId);
        if (MapEngine.setBoundedMap) {
          const b = cfg.bounds || { halfW: 580, halfH: 440 };
          MapEngine.setBoundedMap(true, b.halfW, b.halfH);
        }
      } else if (MapEngine.setBoundedMap) {
        MapEngine.setBoundedMap(false);
      }
      MapEngine.setWeather(cfg.weather || "CLEAR");
    }
    if (app.updateWeatherUI) app.updateWeatherUI(cfg.weather || "CLEAR");
    if (typeof SoundFX !== "undefined") {
      if (cfg.isBossWave) SoundFX.startBgm("boss");
      else SoundFX.playBgm(cfg.stageId || "pallet", true);
    }

    // 2. 重置戰場殘留物與起跑定位
    app.enemies = [];
    app.enemyProjectiles = [];
    app.telegraphs = [];
    app.enemyExplosions = [];
    app.enemyDashes = [];
    app.gems = [];
    app.mapItems = [];
    app.lavaFootprints = [];
    app.arenaPowerups = [];
    app.fieldPowerups = [];
    app.activeBoss = null;
    SkillsEngine.reset();

    const p = app.player;
    if (p) {
      p.x = isFinalArena ? -120 : 0;
      p.y = 0;
      p.vx = 0;
      p.vy = 0;
      p.invulnTimer = 1.2;
      p.trail = [{ x: p.x, y: p.y }];
      if (isFinalArena) {
        p.arenaDashCd = 0;
        p.arenaDashMaxCd = 3.2;
        p.arenaDashInvulnTimer = 0;
        p.arenaPerfectCounterTimer = 0;
      }
      if (app.trainerCompanion) {
        app.trainerCompanion.x = p.x - 28;
        app.trainerCompanion.y = p.y + 10;
      }
      (app.partners || []).forEach(pt => {
        pt.x = p.x;
        pt.y = p.y;
      });
    }

    // 3. Boss／小王波次召喚目標首領
    if (cfg.isBossWave && Array.isArray(cfg.bossIds)) {
      cfg.bossIds.forEach((bId, idx) => {
        this.spawnExpeditionBossEntity(app, cfg, bId, idx, isFinalArena);
      });
      const bossHud = document.getElementById("bossHudContainer");
      if (bossHud) bossHud.classList.remove("hidden");
    } else {
      const bossHud = document.getElementById("bossHudContainer");
      if (bossHud) bossHud.classList.add("hidden");
    }

    // 4. 新章節第一關滑入 GBA 左上角地名木牌／石牌（不再同時彈置中橫幅，徹底根除重疊）
    if (cfg.isFirstWaveOfChapter) {
      this.showRegionSign(cfg);
    } else {
      this.dismissRegionSign();
    }

    // 完整 3 ➔ 2 ➔ 1 ➔ BATTLE START! 四拍倒數（正上方同步顯示 WAVE ?/10 徽章）
    app.battleCountdownTimer = 1.52;
    app._lastCountdownBeat = 4;
    app.state = "PLAYING";
    app.refreshHUD();
  },

  onEnemyKilled(app, enemy) {
    if (!app.isExpeditionMode || !app.expeditionState) return;
    const st = app.expeditionState;
    const cfg = st.plan[st.currentWave - 1];
    if (!cfg || cfg.isBossWave) return;
    if (enemy && enemy.isQuotaMob) {
      st.killsInWave = Math.min(st.killQuota, (st.killsInWave || 0) + 1);
    }
  },

  update(app, dt) {
    const st = app.expeditionState;
    const p = app.player;
    if (!st || !p) return;
    const cfg = st.plan[st.currentWave - 1];
    if (!cfg) return;

    if (cfg.isArena) {
      app.camera.x = p.x * 0.42;
      app.camera.y = p.y * 0.42;
    }

    if (app.areaClearStampTimer > 0) {
      app.areaClearStampTimer = Math.max(0, app.areaClearStampTimer - dt);
    }

    // 波次淨空後的 1.40s AREA CLEAR 印章 ＋ 全場水晶與戰利品（糖果／夥伴球／寶箱）磁力回收緩衝
    if (st.waveCleared) {
      st.clearDelayTimer -= dt;
      if (st.clearDelayTimer <= 0) {
        // 補算尚未吸完的殘留水晶
        if (app.gems.length > 0) {
          let remExp = 0;
          app.gems.forEach(g => { remExp += (g.val || 15); });
          app.gems = [];
          if (remExp > 0) app.gainExp(remExp);
        }
        // 方案A 保底回收所有尚未飛抵的地上神奇糖果、雙打夥伴球與黃金進化寶箱，絕對 0 漏撿！
        if (app.mapItems && app.mapItems.length > 0) {
          const leftovers = app.mapItems.filter(it => it.id !== "poke_mart");
          app.mapItems = app.mapItems.filter(it => it.id === "poke_mart");
          leftovers.forEach(it => {
            if (it.id === "rare_candy" && app.player) {
              app.gainExp(app.player.nextExp - app.player.exp);
            } else if (it.id === "partner_ball") {
              app.summonOrUpgradePartner();
            } else if (it.id === "evo_chest") {
              app.openGoldenEvoChest();
            }
          });
        }
        app._deferLevelUpDuringClear = false;
        if ((app._deferredLevelUps || 0) > 0) {
          app._deferredLevelUps -= 1;
          app._pendingExpeditionIntermission = true;
          app.openLevelUpModal();
        } else if (app.state === "PAUSED" || app.state === "EVOLVING") {
          app._pendingExpeditionIntermission = true;
        } else {
          this.openIntermissionModal(app);
        }
      }
      return;
    }

    // 1. 檢查通關條件
    if (cfg.isBossWave || st.inExMewBattle) {
      const aliveBosses = app.enemies.filter(e => e.isExpeditionBoss && e.hp > 0);
      if (aliveBosses.length === 0) {
        this.onBossDefeated(app, null);
        return;
      }
    } else {
      // 常規波次：波次殲滅進度制（全數刷完且場上配額怪全滅才通關！）
      const aliveQuotaMobs = app.enemies.filter(e => e.isQuotaMob && e.hp > 0).length;
      if (st.spawnedCount >= st.killQuota && aliveQuotaMobs === 0) {
        this.completeWave(app, cfg);
        return;
      }
    }

    // 2. 波中限時增益道具搶點（進度達 ~45% 時於戰場內刷出 1 顆限時增益）
    if (!cfg.isArena && !st.powerupSpawned) {
      const triggerPowerup = cfg.isBossWave
        ? (app.activeBoss && (app.activeBoss.hp / app.activeBoss.maxHp) < 0.72)
        : (st.killsInWave >= Math.floor(st.killQuota * 0.42));
      if (triggerPowerup && typeof app.spawnFieldPowerup === "function") {
        st.powerupSpawned = true;
        const b = cfg.bounds || { halfW: 580, halfH: 440 };
        const ang = Math.random() * Math.PI * 2;
        const dist = 170 + Math.random() * 110;
        const px = Math.max(-b.halfW + 70, Math.min(b.halfW - 70, p.x + Math.cos(ang) * dist));
        const py = Math.max(-b.halfH + 70, Math.min(b.halfH - 70, p.y + Math.sin(ang) * dist));
        app.spawnFieldPowerup(px, py);
      }
    }

    // 3. 刷怪排程
    if (!app.debugStopSpawn && cfg.enemyPool && cfg.enemyPool.length > 0) {
      st.spawnCd -= dt;
      const cap = cfg.isBossWave ? 14 : Math.min(36, 18 + st.currentWave * 2);
      const canSpawnMore = cfg.isBossWave || (st.spawnedCount < st.killQuota);
      if (canSpawnMore && st.spawnCd <= 0 && app.enemies.length < cap) {
        const remainToSpawn = cfg.isBossWave ? 2 : (st.killQuota - st.spawnedCount);
        const batch = cfg.isBossWave
          ? 2
          : Math.min(remainToSpawn, Math.min(5, 3 + Math.floor(st.currentWave / 3)));
        st.spawnCd = cfg.isBossWave ? 2.4 : Math.max(0.68, 1.22 - st.currentWave * 0.06);

        for (let i = 0; i < batch; i++) {
          const maxElites = 1;
          const needElite = !cfg.isBossWave && cfg.elitePool && cfg.elitePool.length > 0 &&
            st.eliteSpawnedCount < maxElites &&
            st.spawnedCount >= Math.floor(st.killQuota * 0.55) && i === 0;
          if (needElite) st.eliteSpawnedCount += 1;
          this.spawnWaveMob(app, cfg, needElite);
          if (!cfg.isBossWave) st.spawnedCount += 1;
        }
      }

      if (cfg.spawnTreasure && !st.treasureSpawned && st.killsInWave >= Math.floor(st.killQuota * 0.50)) {
        st.treasureSpawned = true;
        if (app.spawnTreasureMonster) app.spawnTreasureMonster(cfg.spawnTreasure);
      }
    }
  },

  spawnWaveMob(app, cfg, isElite = false) {
    const p = app.player;
    const pool = (isElite && cfg.elitePool && cfg.elitePool.length > 0) ? cfg.elitePool : cfg.enemyPool;
    const pickId = pool[Math.floor(Math.random() * pool.length)];
    const pData = POKEMON_MAP.get(pickId) || POKEMON_MAP.get(19);
    const diff = app.selectedDifficulty || { hpMult: 1.0, atkMult: 1.0 };
    const w = cfg.wave;
    const hpScale = (1 + (w - 1) * 0.34) * (diff.hpMult || 1.0);
    const baseHp = Math.round((pData.hp * 0.55 + 20) * hpScale * (isElite ? 3.0 : 1.0));
    const atkVal = Math.round((8 + w * 1.55) * (diff.atkMult || 1.0) * (isElite ? 1.4 : 1.0));
    const spdVal = Math.min(115, (54 + pData.speed * 0.30) * (isElite ? 1.08 : 1.0));

    // 在固定生態邊界內、玩家外圍 250~380px 處刷新，確保不刷到牆外也不貼臉
    const b = cfg.bounds || { halfW: 580, halfH: 440 };
    let ex = 0, ey = 0;
    for (let tries = 0; tries < 6; tries++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = 240 + Math.random() * 140;
      const cx = Math.max(-b.halfW + 32, Math.min(b.halfW - 32, p.x + Math.cos(ang) * dist));
      const cy = Math.max(-b.halfH + 32, Math.min(b.halfH - 32, p.y + Math.sin(ang) * dist));
      ex = cx; ey = cy;
      if (Math.hypot(ex - p.x, ey - p.y) >= 165) break;
    }

    app.saveData.pokedexSeen[pData.id] = true;
    app.enemies.push({
      id: pData.id,
      data: pData,
      x: ex,
      y: ey,
      hp: baseHp,
      maxHp: baseHp,
      atk: atkVal,
      speed: spdVal,
      radius: isElite ? 26 : 18,
      isElite,
      isBoss: false,
      isQuotaMob: !cfg.isBossWave,
      isShiny: Math.random() < (0.008 * (p.loadoutShinyMult || 1.0)),
      facingX: -1,
      facingY: 1,
      status: null,
      statusTimer: 0,
      statusTick: 0,
      ccImmunityTimer: 0,
      rangedCd: 1.6 + Math.random() * 1.4,
      whiteFlashTimer: 0,
      weightTier: isElite ? "heavy" : (pData.hp >= 140 ? "medium" : "light"),
      kbResist: isElite ? 0.65 : 0.0
    });
  },

  spawnExpeditionBossEntity(app, cfg, bId, idx = 0, isFinalArena = false) {
    const p = app.player;
    const st = app.expeditionState;
    const waveNum = cfg.wave || (st ? st.currentWave : 1);
    const diff = app.selectedDifficulty || { hpMult: 1.0, atkMult: 1.0 };
    const bData = POKEMON_MAP.get(bId) || POKEMON_MAP.get(150);
    app.saveData.pokedexSeen[bId] = true;

    const isLeg = !!cfg.isLegendaryBoss || [144, 145, 146, 150, 151].includes(bId);
    const isMini = !!cfg.isMiniBoss;
    const isRelay = !!(cfg.relayQueue && cfg.relayQueue.length > 0);
    const waveScale = 1 + (waveNum - 1) * 0.16;

    let baseHp = 2150;
    if (bId === 151) baseHp = 19500; // EX 真王始祖夢幻
    else if (bId === 150) baseHp = 22500; // W16 王者超夢
    else if (isLeg) {
      if (isRelay) baseHp = 7200; // 三聖鳥接力單隻血量
      else baseHp = waveNum >= 14 ? 15500 : 11000;
    } else if (isMini) {
      baseHp = waveNum >= 12 ? 2900 : (waveNum >= 7 ? 2400 : 1650);
    }

    const scaledHp = Math.round(baseHp * (diff.hpMult || 1.0) * (isLeg ? 1.0 : waveScale));
    const baseAtk = bId === 151 ? 35 : (bId === 150 ? 33 : (isLeg ? (waveNum >= 14 ? 30 : 27) : (isMini ? 17 : 20)));
    const scaledAtk = Math.round(baseAtk * (diff.atkMult || 1.0) * (1 + (waveNum - 1) * 0.035));
    const bx = isFinalArena ? 130 : (p.x + (idx === 0 ? 220 : -220));
    const by = isFinalArena ? 0 : (p.y + (idx % 2 === 0 ? -70 : 70));

    const bossObj = {
      id: bId,
      data: bData,
      x: bx,
      y: by,
      hp: scaledHp,
      maxHp: scaledHp,
      atk: scaledAtk,
      speed: bId === 151 ? 108 : (isLeg ? 96 : (isMini ? 86 : 82)),
      radius: isLeg ? 44 : 30,
      isElite: true,
      isBoss: true,
      isMiniBoss: isMini,
      isLegendaryBoss: isLeg,
      bossArchetype: (!isLeg && typeof getBossArchetypeKey === "function") ? getBossArchetypeKey(bId, bData) : null,
      isExpeditionBoss: true,
      noEliteDrop: true,
      isFinalMewtwo: bId === 150,
      isShiny: false,
      treasureType: null,
      facingX: -1,
      facingY: 0,
      status: null,
      statusTimer: 0,
      statusTick: 0,
      ccImmunityTimer: 0,
      rangedCd: 1.05 + idx * 0.85,
      whiteFlashTimer: 0,
      weightTier: isLeg ? "boss" : "heavy",
      kbResist: isLeg ? 1.0 : 0.80,
      arenaDpsCapPct: bId === 150 || bId === 151 ? 0.095 : (isLeg ? 0.12 : 0.15),
      bossAttackIdx: 0
    };
    app.enemies.push(bossObj);
    if (!app.activeBoss) app.activeBoss = bossObj;
    return bossObj;
  },

  dropExpeditionBossLoot(app, boss, isMiniBoss = false) {
    if (!boss) return;
    const pacing = window.EXPEDITION_PACING || {};
    const gemCount = isMiniBoss ? 4 : 8;
    for (let g = 0; g < gemCount; g++) {
      const gAng = (g * Math.PI * 2) / gemCount + Math.random() * 0.3;
      const gDist = 18 + Math.random() * 26;
      app.gems.push({
        x: boss.x + Math.cos(gAng) * gDist,
        y: boss.y + Math.sin(gAng) * gDist,
        val: isMiniBoss ? 70 : 120, tier: 4, size: 11.5,
        color: "#EC4899", innerColor: "#FBCFE8",
        magnetized: true
      });
    }
    if (!isMiniBoss || pacing.miniBossRareCandy) {
      app.spawnMapLoot("rare_candy", boss.x + 20, boss.y);
    } else {
      // 中繼小王改贈額外賞金，將直升神奇糖果保留給每區關底神獸／雙王
      const miniBonus = 65;
      app.runCoins = (app.runCoins || 0) + miniBonus;
      if (app.saveData) app.saveData.coins = (app.saveData.coins || 0) + miniBonus;
      if (app.spawnFloatingText) app.spawnFloatingText(boss.x, boss.y - 26, `小王賞金 +${miniBonus} 金`, "#FACC15", 13);
    }
    if (!isMiniBoss) {
      app.spawnMapLoot("evo_chest", boss.x - 20, boss.y);
    }
  },

  onBossDefeated(app, boss) {
    if (!app.isExpeditionMode || !app.expeditionState) return false;
    const st = app.expeditionState;
    const cfg = st.plan[st.currentWave - 1];
    if (!cfg) return false;

    // 1. 若處於 W16 後的 EX 裏關（始祖夢夢 #151）決戰並擊破，直接頒發真結局冠軍！
    if (st.inExMewBattle) {
      st.exMewCleared = true;
      this.handleExpeditionVictory(app, true);
      return true;
    }

    // 2. 若尚有同場雙王存活，先等雙王皆擊破
    const remainBosses = app.enemies.filter(e => e.isExpeditionBoss && e.hp > 0);
    if (remainBosses.length > 0) return true;

    // 3. W15 三聖鳥接力車輪戰（困難／地獄難度）：依序切換天候召喚下一隻傳說神鳥
    if (Array.isArray(st.activeRelayQueue) && st.activeRelayQueue.length > 0) {
      const nextBirdId = st.activeRelayQueue.shift();
      const nextBirdData = POKEMON_MAP.get(nextBirdId) || POKEMON_MAP.get(146);
      const nextW = nextBirdId === 145 ? "THUNDER" : (nextBirdId === 146 ? "HEATWAVE" : "BLIZZARD");
      if (typeof MapEngine !== "undefined") MapEngine.setWeather(nextW);
      if (app.updateWeatherUI) app.updateWeatherUI(nextW);

      // 接力中場小回復 +15% HP 並召喚下一隻神鳥
      if (app.player) {
        const relayHeal = Math.round(app.player.maxHp * 0.15);
        app.player.hp = Math.min(app.player.maxHp, app.player.hp + relayHeal);
        app.spawnFloatingText(app.player.x, app.player.y - 34, `神鳥接力！回復 +${relayHeal} HP`, "#34D399", 14);
      }
      this.spawnExpeditionBossEntity(app, cfg, nextBirdId, 0, false);
      const bossHud = document.getElementById("bossHudContainer");
      if (bossHud) bossHud.classList.remove("hidden");
      SoundFX.play("boss");
      app.showCutsceneBanner(
        `【⚡ 三聖鳥接力：${nextBirdData.name_zh} 降臨！】`,
        `天候切換為【${nextW === "THUNDER" ? "狂暴雷暴" : "烈日熱浪"}】！迎戰下一位守護神鳥！`,
        2400
      );
      return true;
    }

    // 4. W16 王者超夢擊破：開啟「見好就收登錄殿堂 vs. 迎接 EX 始祖夢夢連戰」抉擇視窗！
    if (st.currentWave >= st.totalWaves) {
      this.openExMewChoiceModal(app);
      return true;
    }

    // 5. W3/W5/W8/W10/W13/W15 擊破正確掉落粉紅經驗晶群 ＋ 神奇糖果（大王加掉黃金進化寶箱），並由方案 A 自動磁吸全收！
    this.dropExpeditionBossLoot(app, boss, !!cfg.isMiniBoss);
    this.completeWave(app, cfg);
    return true;
  },

  openExMewChoiceModal(app) {
    const p = app.player;
    app.state = "PAUSED";
    if (app.touchJoy) {
      app.touchJoy.active = false;
      app.touchJoy.dx = 0;
      app.touchJoy.dy = 0;
    }
    const joyBase = document.getElementById("touchJoyBase");
    const joyStick = document.getElementById("touchJoyStick");
    if (joyBase) joyBase.style.display = "none";
    if (joyStick) joyStick.style.display = "none";

    // 擊破超夢立即回復 50% HP 並重置訓練家大招冷卻，為連戰做好準備
    if (p) {
      const healAmt = Math.round(p.maxHp * 0.50);
      p.hp = Math.min(p.maxHp, p.hp + healAmt);
      p.status = null;
      p.statusTimer = 0;
      p.trainerSkillCd = 0;
    }
    SoundFX.play("levelup");
    const hpLbl = document.getElementById("exChoiceHpStatus");
    if (hpLbl && p) hpLbl.textContent = `已回復 50% HP（目前 ${Math.ceil(p.hp)}/${p.maxHp}）＆ 訓練家大招冷卻歸零！`;
    const modal = document.getElementById("expExChoiceModal");
    if (modal) {
      modal.classList.remove("hidden");
      modal.style.display = "flex";
    }
  },

  acceptVictoryWithoutEx() {
    const modal = document.getElementById("expExChoiceModal");
    if (modal) {
      modal.classList.add("hidden");
      modal.style.display = "none";
    }
    this.handleExpeditionVictory(GameApp, false);
  },

  startExMewBattle() {
    const app = GameApp;
    const st = app.expeditionState;
    const modal = document.getElementById("expExChoiceModal");
    if (modal) {
      modal.classList.add("hidden");
      modal.style.display = "none";
    }
    if (!st) return;

    const exCfg = {
      wave: st.totalWaves,
      act: 4,
      chapterShortName: "EX 隱藏真結局",
      stageId: "sky_pillar",
      isArena: true,
      isBossWave: true,
      isLegendaryBoss: true,
      bossIds: [151],
      weather: "PSYCHIC"
    };

    this.showBossVsOverlay(app, exCfg, () => {
      st.inExMewBattle = true;
      app.enemies = [];
      app.enemyProjectiles = [];
      app.telegraphs = [];
      app.activeBoss = null;
      if (app.player) {
        app.player.x = -120;
        app.player.y = 0;
        app.player.invulnTimer = 1.2;
      }
      if (typeof MapEngine !== "undefined") {
        MapEngine.setArenaMode(true);
        MapEngine.setWeather("PSYCHIC");
      }
      if (app.updateWeatherUI) app.updateWeatherUI("PSYCHIC");
      if (typeof SoundFX !== "undefined") SoundFX.startBgm("boss");

      this.spawnExpeditionBossEntity(app, exCfg, 151, 0, true);
      const bossHud = document.getElementById("bossHudContainer");
      if (bossHud) bossHud.classList.remove("hidden");
      app.battleCountdownTimer = 1.52;
      app._lastCountdownBeat = 4;
      app.state = "PLAYING";
      app.refreshHUD();
    });
  },

  completeWave(app, cfg) {
    const st = app.expeditionState;
    if (!st || st.waveCleared) return;
    st.waveCleared = true;
    st.clearDelayTimer = 1.40;
    app._deferLevelUpDuringClear = true;
    app._deferredLevelUps = 0;

    // 尾刀爽感閉環：0.22s 微慢動作 ＋ 1.40s AREA CLEAR 印章 ＋ 全場水晶與糖果／寶箱磁力高速吸入
    app.killSlowmoTimer = Math.max(app.killSlowmoTimer || 0, 0.22);
    app.areaClearStampTimer = 1.40;
    app.enemies.forEach(en => {
      app.spawnParticleCluster(en.x, en.y, "#FACC15", "#FFFFFF", 5, "star", 0.9);
    });
    app.enemies = [];
    app.enemyProjectiles = [];
    app.telegraphs = [];
    app.fieldPowerups = [];
    app.activeBoss = null;
    const bossHud = document.getElementById("bossHudContainer");
    if (bossHud) bossHud.classList.add("hidden");

    const diffMult = (app.selectedDifficulty && app.selectedDifficulty.coinMult) || 1.0;
    const coinMod = (app.player && app.player.loadoutCoinMult) ? app.player.loadoutCoinMult : 1.0;
    const bonusCoins = Math.round((cfg.clearBonus || 80) * diffMult * coinMod);
    app.runCoins += bonusCoins;
    app.saveData.coins += bonusCoins;

    const p = app.player;
    if (p) {
      const healPct = cfg.actClearHeal || 0.10;
      const healAmt = Math.round(p.maxHp * healPct);
      p.hp = Math.min(p.maxHp, p.hp + healAmt);
      p.status = null;
      p.statusTimer = 0;
      app.spawnFloatingText(p.x, p.y - 34, `WAVE ${cfg.wave} 淨空！+${bonusCoins} 金 ‧ +${healAmt} HP`, "#34D399", 15);
    }

    // 方案A：讓所有地上水晶 ＋ 神奇糖果／夥伴球／黃金寶箱同步磁力高速飛向主角，0 漏撿！
    app.gems.forEach(g => { g.magnetized = true; });
    if (app.mapItems && app.mapItems.length > 0) {
      app.mapItems.forEach(it => {
        if (it.id !== "poke_mart") {
          it.magnetized = true;
          app.spawnParticleCluster(it.x, it.y, "#38BDF8", "#FACC15", 8, "star", 0.85);
        }
      });
    }

    SoundFX.play("area_clear");
    this.saveCheckpoint(app, st.currentWave + 1);
  },

  handleExpeditionVictory(app, isExTrueClear = false) {
    this.clearCheckpoint(app);
    const st = app.expeditionState;
    const diffMult = (app.selectedDifficulty && app.selectedDifficulty.coinMult) || 1.0;
    const baseReward = isExTrueClear ? 830 : 480;
    const clearCoins = Math.round(baseReward * diffMult);
    app.runCoins += clearCoins;
    app.saveData.coins += clearCoins;
    if (!app.saveData.stats.expeditionClears) app.saveData.stats.expeditionClears = 0;
    app.saveData.stats.expeditionClears += 1;
    if (isExTrueClear) {
      app.saveData.stats.mewDefeated = (app.saveData.stats.mewDefeated || 0) + 1;
    }
    app.lastExpeditionResult = {
      clearedWaves: st ? st.totalWaves : 16,
      totalGain: clearCoins,
      isExTrueClear: !!isExTrueClear,
      clearTimeSec: Math.round(app.runTime || 0),
      chaptersCleared: (window.EXPEDITION_CHAPTERS || []).map(c => ({
        id: c.id,
        name: c.shortName || c.name,
        badgeLabel: (c.theme && c.theme.badgeLabel) || c.shortName,
        badgeBg: (c.theme && c.theme.badgeBg) || "#D97706"
      }))
    };
    if (app.saveToStorage) app.saveToStorage();
    app.showCutsceneBanner(
      isExTrueClear
        ? `★ TRUE CHAMPION！關都大遠征 20+1 EX 夢夢制霸！`
        : `關都大遠征 ${st ? st.totalWaves : 16}/${st ? st.totalWaves : 16} 制霸！CHAMPION!`,
      isExTrueClear
        ? `連斬王者超夢與始祖夢幻！獲得真結局遠征賞金 +${clearCoins} 代幣！`
        : `貫穿全區域並討伐王者超夢！獲得遠征冠軍賞金 +${clearCoins} 代幣！`,
      2500
    );
    app.startVictoryCeremony();
  },

  // ==========================================================================
  // 波間整備商店與「火車站式局部捲動 GBA 長卷 ＋ 雙人向右漫步動畫」
  // ==========================================================================
  openIntermissionModal(app) {
    const st = app.expeditionState;
    if (!st) return;
    app.state = "PAUSED";
    if (app.touchJoy) {
      app.touchJoy.active = false;
      app.touchJoy.dx = 0;
      app.touchJoy.dy = 0;
    }
    const joyBase = document.getElementById("touchJoyBase");
    const joyStick = document.getElementById("touchJoyStick");
    if (joyBase) joyBase.style.display = "none";
    if (joyStick) joyStick.style.display = "none";

    st.shopRerollCost = 30;
    st.pendingForgetTm = null;
    this.rollIntermissionShop(app);
    this.renderIntermissionModal(app, true);

    const modal = document.getElementById("expeditionModal");
    if (modal) {
      modal.classList.remove("hidden");
      modal.style.display = "flex";
    }
  },

  stopRouteWalkAnim() {
    if (this._walkAnimRaf) {
      cancelAnimationFrame(this._walkAnimRaf);
      this._walkAnimRaf = null;
    }
  },

  rollIntermissionShop(app) {
    const st = app.expeditionState;
    const p = app.player;
    const nextCfg = st.plan[st.currentWave] || st.plan[st.plan.length - 1];
    const nextEnemyTypes = nextCfg.enemyTypes || [];
    const tmList = typeof TM_CATALOG !== "undefined" ? Object.values(TM_CATALOG) : [];
    const specItems = typeof MART_SPECIAL_ITEMS !== "undefined" ? MART_SPECIAL_ITEMS : {};

    const findOwned = (sId) => {
      const clean = sId.replace(/\s+/g, "");
      const key = Object.keys(p.skills).find(k => k.replace(/\s+/g, "") === clean);
      return key ? p.skills[key] : null;
    };

    const shelf = [];

    const eligibleTMs = tmList.filter(tm => {
      const ex = findOwned(tm.id);
      return !ex || ex.level < 10;
    });
    const counterTMs = eligibleTMs.filter(tm =>
      nextEnemyTypes.some(et => typeof calcTypeMultiplier === "function" && calcTypeMultiplier(tm.type, et, "None") > 1.1)
    );
    const tmPickPool = counterTMs.length > 0 ? counterTMs : eligibleTMs;
    const counts = st.shopBoughtCounts || (st.shopBoughtCounts = { candy: 0, heal: 0 });
    const ownedHeldCount = Object.keys(p.heldItems || {}).filter(k => p.heldItems[k]).length;

    if (tmPickPool.length > 0) {
      const pickedTm = tmPickPool[Math.floor(Math.random() * tmPickPool.length)];
      const actNum = nextCfg.act || 1;
      const expTmCost = actNum >= 3 ? 220 : (actNum === 2 ? 180 : 140);
      shelf.push({ ...pickedTm, cost: expTmCost, kind: "tm", isCounterRec: counterTMs.includes(pickedTm), bought: false });
    }

    const pacing = window.EXPEDITION_PACING || { ppUpEvenWavesOnly: true, ppUpMaxPerRun: 4 };
    const maxCandyBuys = pacing.ppUpMaxPerRun || 4;
    const candyBought = counts.candy || 0;
    const allowCandyWave = !pacing.ppUpEvenWavesOnly || (st.currentWave % 2 === 0);
    const isMasterCandy = (st.currentWave >= 12 && specItems.master_candy);
    const candyPick = isMasterCandy ? specItems.master_candy : specItems.pp_up;
    if (candyPick && allowCandyWave && candyBought < maxCandyBuys) {
      const candyCost = (isMasterCandy ? 260 : 150) + candyBought * 65;
      const leftQuota = maxCandyBuys - candyBought;
      shelf.push({
        ...candyPick,
        desc: `${candyPick.desc}（本局剩餘限購 ${leftQuota}/${maxCandyBuys}）`,
        cost: candyCost,
        kind: "consumable",
        bought: false
      });
    } else {
      // 奇數波或 PP 提升劑已達單局 4 次上限時，補上戰術強化道具維持 2×2 貨架完整
      const tactBoost = (st.currentWave % 3 === 1 && specItems.x_speed) ? specItems.x_speed : specItems.x_attack;
      if (tactBoost) {
        shelf.push({ ...tactBoost, cost: 90, kind: "consumable", bought: false });
      }
    }

    const allHeld = typeof HELD_ITEMS !== "undefined" ? Object.values(HELD_ITEMS) : [];
    const unownedHeld = allHeld.filter(hi => !p.heldItems[hi.id]);
    let pickedHeld = null;
    if (ownedHeldCount < 4) {
      if (nextCfg.stageId === "cerulean_bay" && !p.heldItems["sharp_beak"] && HELD_ITEMS["sharp_beak"]) {
        pickedHeld = HELD_ITEMS["sharp_beak"];
      } else if (unownedHeld.length > 0) {
        const learnedTypes = new Set(Object.values(p.skills).map(s => SKILLS_CATALOG[s.id]?.type));
        const matched = unownedHeld.filter(hi => learnedTypes.has(SKILLS_CATALOG[hi.skillReq]?.type));
        const hPool = matched.length > 0 ? matched : unownedHeld;
        pickedHeld = hPool[Math.floor(Math.random() * hPool.length)];
      }
    }
    if (pickedHeld && ownedHeldCount < 4) {
      const heldPriceTable = [120, 190, 280, 390];
      const heldCost = heldPriceTable[Math.min(3, ownedHeldCount)] || 390;
      shelf.push({
        id: pickedHeld.id,
        name: pickedHeld.name,
        desc: pickedHeld.desc,
        sprite: pickedHeld.sprite,
        cost: heldCost,
        kind: "held",
        isStageRec: (nextCfg.stageId === "cerulean_bay" && pickedHeld.id === "sharp_beak"),
        bought: false
      });
    } else if (specItems.x_attack) {
      shelf.push({ ...specItems.x_attack, cost: 90, kind: "consumable", bought: false });
    }

    if (specItems.full_restore) {
      const healCost = 60 + (counts.heal || 0) * 15;
      shelf.push({ ...specItems.full_restore, cost: healCost, kind: "consumable", bought: false });
    }

    st.shopShelf = shelf;
  },

  renderIntermissionModal(app, playWalkAnim = false) {
    const st = app.expeditionState;
    const p = app.player;
    if (!st || !p) return;
    const clearedWave = st.currentWave;
    const nextWave = Math.min(st.totalWaves, clearedWave + 1);
    const clearedCfg = st.plan[clearedWave - 1];
    const nextCfg = st.plan[nextWave - 1];
    const isCrossingAct = !!(clearedCfg && nextCfg && clearedCfg.act !== nextCfg.act);

    const titleEl = document.getElementById("expModalTitle");
    if (titleEl) titleEl.textContent = `W${clearedWave}/${st.totalWaves} CLEAR`;

    const coinEl = document.getElementById("expCoinsDisplay");
    if (coinEl) coinEl.textContent = app.runCoins.toLocaleString();

    const hpEl = document.getElementById("expHpDisplay");
    if (hpEl) hpEl.textContent = `HP ${Math.ceil(p.hp)}/${p.maxHp}`;

    const rerollCostEl = document.getElementById("expRerollCostText");
    if (rerollCostEl) rerollCostEl.textContent = st.shopRerollCost || 30;

    const nextBtnEl = document.getElementById("btnExpStartNextWave");
    if (nextBtnEl) {
      nextBtnEl.textContent = nextCfg.isFinalChapter
        ? `踏入${nextCfg.chapterShortName} · 最終決戰 →`
        : `出發！WAVE ${nextWave}/${st.totalWaves}（${nextCfg.title}） →`;
    }

    // 1. 啟動或靜態繪製「火車站式局部捲動 GBA 路線長卷 ＋ 訓練家與主角向右漫步」
    const routeCan = document.getElementById("expeditionRouteCanvas");
    if (routeCan) {
      if (playWalkAnim) {
        this.startRouteWalkAnimation(routeCan, app, clearedWave, nextWave, isCrossingAct);
      } else {
        this.drawScrollingRouteMap(routeCan, app, clearedWave, nextWave, 1.0, isCrossingAct);
      }
    }

    // 2. 單行精簡下一站情報條（全像素徽章＋精靈頭像，零 Emoji）
    const intelBox = document.getElementById("expNextWaveIntelBox");
    if (intelBox) {
      const typeBadges = (nextCfg.enemyTypes || []).map(t => renderTypeBadgeHTML(t)).join("");
      const enemySprites = (nextCfg.previewIds || []).map(pid => {
        const pd = POKEMON_MAP.get(pid);
        return pd
          ? `<div class="w-8 h-8 rounded-lg bg-slate-950 border ${nextCfg.isBossWave ? 'border-rose-500' : 'border-slate-600'} flex items-center justify-center shrink-0" title="${pd.name_zh}">
               <img src="${SpriteCache.resolveUrl(pd.forward_sprite)}" class="w-7 h-7 pixel-sprite object-contain" alt="${pd.name_zh}"/>
             </div>`
          : "";
      }).join("");
      const goalTag = nextCfg.isBossWave
        ? (nextCfg.isMiniBoss
            ? '<span class="px-1.5 py-0.5 rounded bg-amber-800 border border-amber-400 text-amber-200 font-pixel text-[8px]">小王戰</span>'
            : '<span class="px-1.5 py-0.5 rounded bg-rose-900 border border-rose-400 text-rose-200 font-pixel text-[8px]">區域大王</span>')
        : (nextCfg.isEventWave
            ? `<span class="px-1.5 py-0.5 rounded bg-purple-800 border border-purple-400 text-purple-200 font-pixel text-[8px]">事件 ${nextCfg.killQuota || 30}隻</span>`
            : `<span class="px-1.5 py-0.5 rounded bg-emerald-900 border border-emerald-400 text-emerald-200 font-pixel text-[8px]">殲滅 ${nextCfg.killQuota || 25}隻</span>`);

      intelBox.innerHTML = `
        <div class="flex items-center justify-between gap-2">
          <div class="min-w-0 flex-1 space-y-1">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="px-1.5 py-0.5 rounded bg-red-600 text-white font-pixel text-[8px] font-black">NEXT W${nextWave}</span>
              ${goalTag}
              <span class="font-black text-[11px] text-amber-300 truncate">${nextCfg.chapterShortName} · ${nextCfg.title}</span>
            </div>
            <div class="flex items-center gap-1 flex-wrap">
              <span class="text-[10px] font-bold text-slate-400">敵軍屬性：</span>
              ${typeBadges}
              ${isCrossingAct ? '<span class="px-1.5 py-0.2 rounded bg-emerald-700 text-white text-[9px] font-black ml-1">跨區營地回復</span>' : ''}
            </div>
          </div>
          <div class="flex items-center gap-1 shrink-0">${enemySprites}</div>
        </div>
      `;
    }

    // 3. 渲染 2×2 免捲動像素商品卡片網格（含滿槽自選遺忘）
    const shopBox = document.getElementById("expShopContainer");
    if (!shopBox) return;

    if (st.pendingForgetTm) {
      const pend = st.pendingForgetTm;
      const newMeta = SKILLS_CATALOG[pend.item.id];
      shopBox.className = "space-y-1.5";
      shopBox.innerHTML = `
        <div class="bg-amber-950/75 border border-amber-400 rounded-xl p-2.5 space-y-2">
          <div class="text-[11px] font-black text-amber-300">招式槽已滿！選擇要遺忘的招式以學習【${newMeta ? newMeta.name : pend.item.name}】：</div>
          <div class="space-y-1.5">
            ${Object.entries(p.skills).map(([key, sk]) => {
              const meta = SKILLS_CATALOG[sk.id];
              return `
                <div class="flex items-center justify-between bg-slate-900/95 px-2.5 py-1.5 rounded-lg border border-slate-700">
                  <div class="flex items-center gap-2 min-w-0">
                    ${meta ? renderSkillIconHTML(meta, "w-6 h-6") : ""}
                    <span class="font-black text-xs text-white truncate">${meta ? (sk.evolved ? meta.evolvedName : meta.name) : sk.id}</span>
                    <span class="font-pixel text-[9px] text-amber-300">Lv.${sk.level}</span>
                  </div>
                  <button onclick="ModeExpedition.confirmForgetAndBuy('${key}')" class="poke-btn-red px-2.5 py-1 text-[10px] font-black shrink-0">遺忘替換</button>
                </div>
              `;
            }).join("")}
          </div>
          <button onclick="ModeExpedition.cancelForget()" class="poke-btn-white w-full py-1.5 text-xs font-black">返回整備商店</button>
        </div>
      `;
      return;
    }

    const curCount = Object.keys(p.skills).length;
    const maxSlots = p.maxSkillSlots || 3;
    const findOwned = (sId) => {
      const clean = sId.replace(/\s+/g, "");
      const key = Object.keys(p.skills).find(k => k.replace(/\s+/g, "") === clean);
      return key ? p.skills[key] : null;
    };

    shopBox.className = "grid grid-cols-2 gap-1.5";
    shopBox.innerHTML = (st.shopShelf || []).map((it, idx) => {
      let badgeHtml = "";
      if (it.kind === "tm") {
        const owned = findOwned(it.id);
        if (owned) {
          badgeHtml = `<span class="px-1 py-0.2 rounded bg-emerald-900 text-emerald-300 text-[8px] font-black">Lv.${owned.level}➔${Math.min(10, owned.level + 1)}</span>`;
        } else if (curCount >= maxSlots) {
          badgeHtml = `<span class="px-1 py-0.2 rounded bg-amber-900 text-amber-300 text-[8px] font-black">替換</span>`;
        }
        if (it.isCounterRec) {
          badgeHtml += `<span class="px-1 py-0.2 rounded bg-sky-700 text-white text-[8px] font-black">克制</span>`;
        }
      } else if (it.kind === "held") {
        badgeHtml = `<span class="px-1 py-0.2 rounded bg-purple-800 text-purple-100 text-[8px] font-black">${it.isStageRec ? '海域推薦' : '攜帶物'}</span>`;
      }

      const iconHtml = (it.kind === "tm" && typeof renderSkillIconHTML === "function")
        ? renderSkillIconHTML(it.id, "w-7 h-7")
        : `<img src="${SpriteCache.resolveUrl(it.sprite)}" class="w-7 h-7 pixel-sprite object-contain" alt="${it.name}"/>`;

      return `
        <div class="bg-slate-800/95 p-2 rounded-xl border ${it.bought ? 'border-slate-700 opacity-50' : 'border-slate-600'} flex flex-col justify-between gap-1.5">
          <div class="flex items-start gap-2 min-w-0">
            <div class="w-8 h-8 bg-slate-950 rounded-lg border border-slate-700 flex items-center justify-center shrink-0">${iconHtml}</div>
            <div class="min-w-0 flex-1">
              <div class="font-black text-[11px] text-white truncate leading-tight">${it.kind === "tm" ? `${it.tmNo || 'TM'} ${it.name}` : it.name}</div>
              <div class="flex items-center gap-1 flex-wrap mt-0.5">${badgeHtml}</div>
            </div>
          </div>
          <div class="text-[9px] text-slate-300 leading-tight line-clamp-2 min-h-[22px]">${it.desc}</div>
          ${it.bought
            ? `<div class="w-full py-1 rounded-lg bg-slate-900 border border-slate-700 font-pixel text-[8px] text-emerald-400 text-center">SOLD</div>`
            : `<button onclick="ModeExpedition.buyShopItem(${idx})" class="poke-btn-yellow w-full py-1 text-[11px] font-black flex items-center justify-center gap-1">
                 <img src="${ITEM_SPRITES.coin}" class="w-3.5 h-3.5 pixel-sprite"/>
                 <span>${it.cost}</span>
               </button>`
          }
        </div>
      `;
    }).join("");
  },

  revealPrepPanel(canvas, app, clearedWave, nextWave, isCrossingAct) {
    const walkHint = document.getElementById("expWalkingStatusRow");
    const prepCard = document.getElementById("expPrepPanelCard");
    if (walkHint) walkHint.classList.add("hidden");
    if (canvas && app) {
      // 階段二：平滑收斂為緊湊高度 (128px)，保留圖3免捲動黃金比例
      this.drawScrollingRouteMap(canvas, app, clearedWave, nextWave, 1.0, isCrossingAct, false);
    }
    if (prepCard) {
      prepCard.classList.remove("hidden");
      prepCard.classList.add("lobby-pop-in");
    }
  },

  skipRouteWalkAnim() {
    if (!this._walkAnimState) return;
    const ws = this._walkAnimState;
    this._walkAnimState = null;
    this.stopRouteWalkAnim();
    if (ws.isCrossingAct && !ws.healChimePlayed && typeof SoundFX !== "undefined") {
      SoundFX.play("pokecenter_heal");
    }
    this.revealPrepPanel(ws.canvas, ws.app, ws.clearedWave, ws.nextWave, ws.isCrossingAct);
  },

  startRouteWalkAnimation(canvas, app, clearedWave, nextWave, isCrossingAct) {
    this.stopRouteWalkAnim();
    const walkHint = document.getElementById("expWalkingStatusRow");
    const prepCard = document.getElementById("expPrepPanelCard");
    if (prepCard) {
      prepCard.classList.add("hidden");
      prepCard.classList.remove("lobby-pop-in");
    }
    if (walkHint) {
      walkHint.classList.remove("hidden");
      const nextCfg = app.expeditionState && app.expeditionState.plan[nextWave - 1];
      walkHint.textContent = isCrossingAct
        ? `正在跨越區域前往【${nextCfg ? nextCfg.chapterShortName : '下一關'}】……（點擊加速）`
        : `正在前往 WAVE ${nextWave}【${nextCfg ? nextCfg.title : ''}】……（點擊加速）`;
    }

    const startTs = performance.now();
    const durationMs = isCrossingAct ? 2800 : 1800;
    const ws = { canvas, app, clearedWave, nextWave, isCrossingAct, healChimePlayed: false };
    this._walkAnimState = ws;

    const tick = (nowTs) => {
      if (this._walkAnimState !== ws) return;
      const elapsed = nowTs - startTs;
      const t = Math.min(1, elapsed / durationMs);
      if (isCrossingAct && !ws.healChimePlayed && t >= 0.48) {
        ws.healChimePlayed = true;
        if (typeof SoundFX !== "undefined") SoundFX.play("pokecenter_heal");
      }
      // 階段一：放大至約 1/3 螢幕高度 (expanded = true) 清楚展示高細節 GBA 長卷與雙人漫步
      this.drawScrollingRouteMap(canvas, app, clearedWave, nextWave, t, isCrossingAct, true);
      if (t < 1) {
        this._walkAnimRaf = requestAnimationFrame(tick);
      } else {
        this._walkAnimRaf = null;
        this._walkAnimState = null;
        this.revealPrepPanel(canvas, app, clearedWave, nextWave, isCrossingAct);
      }
    };
    this._walkAnimRaf = requestAnimationFrame(tick);
  },

  // 原生生態 GBA 橫向冒險路線長卷（高清 640x300 佔 1/3 屏高 ➔ 整備期收斂 640x176，原生地圖道路與地形質感）
  drawScrollingRouteMap(canvas, app, clearedWave, nextWave, walkT = 1.0, isCrossingAct = false, expanded = false) {
    const st = app.expeditionState;
    if (!st || !st.plan) return;
    const plan = st.plan;
    const total = plan.length;
    const vpW = canvas.width = 640;
    const vpH = canvas.height = expanded ? 300 : 176;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;

    const spacing = expanded ? 204 : 182;
    const padLeft = 108;
    const worldW = padLeft * 2 + (total - 1) * spacing;
    const horizonY = expanded ? 92 : 46;
    const roadY = expanded ? 214 : 116;

    const nodeX = (idx) => padLeft + idx * spacing;
    const nodeY = () => roadY;

    // v7.6.4 改為等速前進（消除起步 2.1x 暴衝感），還原遊戲內真實平穩移動速度
    const ease = Math.min(1, Math.max(0, walkT));
    const fromIdx = Math.max(0, clearedWave - 1);
    const toIdx = Math.min(total - 1, nextWave - 1);
    const duoX = nodeX(fromIdx) + (nodeX(toIdx) - nodeX(fromIdx)) * ease;
    const duoY = nodeY(fromIdx);

    const desiredCamX = duoX - vpW * 0.42;
    const camX = Math.max(0, Math.min(Math.max(0, worldW - vpW), desiredCamX));
    const props = (typeof MapEngine !== "undefined" && MapEngine.spritePropCache) ? MapEngine.spritePropCache : null;

    const detHash = (n) => {
      const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
      return x - Math.floor(x);
    };

    ctx.save();
    ctx.translate(-Math.round(camX), 0);

    // 1. 分章節繪製：天空遠景 ＋ 原生紋理地面（棋盤草皮／海波／神殿方磚／競技場石板）＋ 原生道路（土路／跨海木橋／神殿大理石道／紅金地毯）
    const chapters = window.EXPEDITION_CHAPTERS || [];
    let cursorWave = 0;
    chapters.forEach((ch, chIdx) => {
      const len = (ch.waves && ch.waves.length) || 0;
      if (len === 0) return;
      const startX = cursorWave === 0 ? 0 : (nodeX(cursorWave - 1) + nodeX(cursorWave)) * 0.5;
      const endX = (cursorWave + len >= total) ? worldW : (nodeX(cursorWave + len - 1) + nodeX(cursorWave + len)) * 0.5;
      const segW = endX - startX;
      const th = ch.theme || { bg: "#3E6B38", accent: "#2E5229", text: "#BBF7D0" };

      // 1A. 漸層天空帶與浮雲
      const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
      if (ch.stageId === "pallet") {
        skyGrad.addColorStop(0, "#0284C7"); skyGrad.addColorStop(1, "#BAE6FD");
      } else if (ch.stageId === "cerulean_bay") {
        skyGrad.addColorStop(0, "#0369A1"); skyGrad.addColorStop(1, "#7DD3FC");
      } else if (ch.stageId === "power_plant") {
        skyGrad.addColorStop(0, "#0F172A"); skyGrad.addColorStop(1, "#1E3A5F");
      } else if (ch.stageId === "cinnabar_volcano") {
        skyGrad.addColorStop(0, "#2B0E0E"); skyGrad.addColorStop(1, "#7C2D12");
      } else if (ch.isArena) {
        skyGrad.addColorStop(0, "#0F172A"); skyGrad.addColorStop(1, "#334155");
      } else {
        skyGrad.addColorStop(0, "#1E1B4B"); skyGrad.addColorStop(1, "#6D28D9");
      }
      ctx.fillStyle = skyGrad;
      ctx.fillRect(startX, 0, segW, horizonY);

      if (!ch.isArena) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.72)";
        const cloudDrift = Math.round((walkT * 24) % 90);
        for (let ci = 0; ci < 6; ci++) {
          const cx = startX + 35 + ci * 128 + detHash(chIdx * 31 + ci) * 40 - cloudDrift * 0.4;
          if (cx > endX - 30) continue;
          const cy = expanded ? (20 + detHash(ci * 13 + chIdx) * 32) : 10;
          ctx.fillRect(Math.round(cx), Math.round(cy), 34, 8);
          ctx.fillRect(Math.round(cx + 8), Math.round(cy - 5), 18, 5);
        }
      }

      // 1B. 生態地平線與原生紋理地面（告別單調純色塊！）
      if (ch.stageId === "pallet") {
        // 遠山樹海剪影
        ctx.fillStyle = "#166534";
        for (let mx = startX - 16; mx < endX + 24; mx += 60) {
          const mr = 26 + detHash(mx) * 14;
          ctx.beginPath(); ctx.arc(mx + 28, horizonY + 4, mr, Math.PI, 0); ctx.fill();
        }
        // 雙色 GBA 棋盤格草皮地面
        const tileSz = expanded ? 24 : 18;
        for (let gy = horizonY; gy < vpH; gy += tileSz) {
          const rowI = Math.floor((gy - horizonY) / tileSz);
          for (let gx = Math.floor(startX / tileSz) * tileSz; gx < endX; gx += tileSz) {
            const colI = Math.floor(gx / tileSz);
            const drawX = Math.max(startX, gx);
            const drawW = Math.min(endX, gx + tileSz) - drawX;
            if (drawW <= 0) continue;
            ctx.fillStyle = ((rowI + colI) % 2 === 0) ? "#4E8245" : "#44743C";
            ctx.fillRect(drawX, gy, drawW, tileSz + 1);
          }
        }
        // 零星深綠草叢簇紋理（還原戰場草叢手感）
        ctx.fillStyle = "#26532B";
        for (let k = 0; k < 24; k++) {
          const tx = startX + 14 + detHash(k * 17 + 3) * (segW - 28);
          const ty = horizonY + 12 + detHash(k * 29 + 7) * (vpH - horizonY - 22);
          if (Math.abs(ty - roadY) < 22) continue;
          ctx.fillRect(Math.round(tx), Math.round(ty), 3, 7);
          ctx.fillRect(Math.round(tx + 5), Math.round(ty - 2), 3, 9);
          ctx.fillRect(Math.round(tx + 10), Math.round(ty), 3, 7);
        }

        // ACT 1 原生道路：真新鎮暖黃碎石土路（與背景戰場土路 100% 一致）
        ctx.fillStyle = "#8C6B32";
        ctx.fillRect(startX, roadY - 17, segW, 34);
        ctx.fillStyle = "#E5C687";
        ctx.fillRect(startX, roadY - 14, segW, 28);
        ctx.fillStyle = "#D4B06A";
        ctx.fillRect(startX, roadY - 14, segW, 4);
        ctx.fillRect(startX, roadY + 10, segW, 4);
        // 土路碎石顆粒
        for (let px = startX + 10; px < endX - 10; px += 22) {
          const pyOff = (detHash(px * 3) - 0.5) * 16;
          ctx.fillStyle = (Math.floor(px) % 44 === 0) ? "#B89352" : "#F3DFB6";
          ctx.fillRect(Math.round(px), Math.round(roadY + pyOff), 4, 3);
        }
      } else if (ch.stageId === "cerulean_bay") {
        // 碧海漸層 + 像素波光紋 + 遠方帆影
        const seaGrad = ctx.createLinearGradient(0, horizonY, 0, vpH);
        seaGrad.addColorStop(0, "#0284C7");
        seaGrad.addColorStop(0.50, "#0369A1");
        seaGrad.addColorStop(1, "#0C4A6E");
        ctx.fillStyle = seaGrad;
        ctx.fillRect(startX, horizonY, segW, vpH - horizonY);
        ctx.fillStyle = "rgba(224, 242, 254, 0.55)";
        ctx.fillRect(startX, horizonY, segW, 3);
        // 動態水波紋
        const waveDrift = Math.round((walkT * 36) % 48);
        ctx.fillStyle = "rgba(186, 230, 253, 0.42)";
        for (let wy = horizonY + 14; wy < vpH - 10; wy += 24) {
          for (let wx = startX + 8; wx < endX - 24; wx += 58) {
            const ox = wx + ((wy % 48 === 0) ? waveDrift * 0.5 : -waveDrift * 0.3);
            if (ox >= startX && ox + 20 <= endX) {
              ctx.fillRect(Math.round(ox), wy, 20, 2);
            }
          }
        }
        // 遠方白帆
        if (expanded) {
          for (let si = 0; si < 3; si++) {
            const sx = startX + 68 + si * 185 + detHash(si * 19) * 35;
            if (sx > endX - 30) continue;
            ctx.fillStyle = "#F8FAFC";
            ctx.beginPath(); ctx.moveTo(sx, horizonY - 2); ctx.lineTo(sx + 10, horizonY - 2); ctx.lineTo(sx + 2, horizonY - 18); ctx.closePath(); ctx.fill();
            ctx.fillStyle = "#78350F";
            ctx.fillRect(sx - 3, horizonY - 2, 16, 4);
          }
        }

        // ACT 2 原生道路：華藍海岬跨海木棧道長橋（帶木板接縫、護欄、橋柱與水波倒影）
        // 橋下木樁柱與水面反光
        for (let bx = startX + 22; bx < endX - 10; bx += 44) {
          ctx.fillStyle = "#451A03";
          ctx.fillRect(Math.round(bx), roadY + 15, 8, expanded ? 24 : 14);
          ctx.fillStyle = "rgba(186, 230, 253, 0.55)";
          ctx.fillRect(Math.round(bx - 5), roadY + (expanded ? 37 : 27), 18, 2);
        }
        // 橋身護欄與木板面
        ctx.fillStyle = "#451A03";
        ctx.fillRect(startX, roadY - 17, segW, 34);
        ctx.fillStyle = "#B45309";
        ctx.fillRect(startX, roadY - 13, segW, 26);
        ctx.fillStyle = "#D97706";
        ctx.fillRect(startX, roadY - 11, segW, 22);
        // 縱向木板接縫與鉚釘
        ctx.fillStyle = "#78350F";
        for (let px = startX + 4; px < endX; px += 14) {
          ctx.fillRect(Math.round(px), roadY - 13, 2, 26);
        }
        // 橋面上下木護欄高光
        ctx.fillStyle = "#F59E0B";
        ctx.fillRect(startX, roadY - 16, segW, 3);
        ctx.fillRect(startX, roadY + 13, segW, 3);
      } else if (ch.stageId === "power_plant") {
        // ACT 3 無人發電廠：高壓蓄電塔遠景剪影 ＋ 工業霧灰鋼板 ＋ 發光青藍磁能加速軌道
        ctx.fillStyle = "#0F172A";
        for (let px = startX + 26; px < endX - 24; px += 72) {
          const ph = 22 + detHash(px) * 14;
          ctx.fillRect(px, horizonY - ph, 12, ph + 2);
          ctx.fillStyle = "#38BDF8";
          ctx.fillRect(px + 3, horizonY - ph + 4, 6, 4);
          ctx.fillStyle = "#FEF08A";
          ctx.fillRect(px + 4, horizonY - ph - 3, 4, 3);
          ctx.fillStyle = "#0F172A";
        }
        const tileSz = expanded ? 26 : 20;
        for (let gy = horizonY; gy < vpH; gy += tileSz) {
          const rowI = Math.floor((gy - horizonY) / tileSz);
          for (let gx = Math.floor(startX / tileSz) * tileSz; gx < endX; gx += tileSz) {
            const colI = Math.floor(gx / tileSz);
            const drawX = Math.max(startX, gx);
            const drawW = Math.min(endX, gx + tileSz) - drawX;
            if (drawW <= 0) continue;
            ctx.fillStyle = ((rowI + colI) % 2 === 0) ? "#334155" : "#2D3B4E";
            ctx.fillRect(drawX, gy, drawW, tileSz + 1);
          }
        }
        ctx.fillStyle = "#0F172A";
        ctx.fillRect(startX, roadY - 17, segW, 34);
        ctx.fillStyle = "#1E293B";
        ctx.fillRect(startX, roadY - 13, segW, 26);
        ctx.fillStyle = "rgba(56, 189, 248, 0.28)";
        ctx.fillRect(startX, roadY - 10, segW, 20);
        ctx.strokeStyle = "#7DD3FC";
        ctx.lineWidth = 2;
        const chevOff = Math.floor((walkT * 90) % 32);
        for (let ax = startX + chevOff; ax < endX - 10; ax += 32) {
          ctx.beginPath();
          ctx.moveTo(ax, roadY - 6); ctx.lineTo(ax + 8, roadY); ctx.lineTo(ax, roadY + 6);
          ctx.stroke();
        }
        ctx.fillStyle = "#38BDF8";
        ctx.fillRect(startX, roadY - 15, segW, 2);
        ctx.fillRect(startX, roadY + 13, segW, 2);
      } else if (ch.stageId === "cinnabar_volcano") {
        // ACT 4 紅蓮火山：火山尖峰剪影 ＋ 低飽和黑曜玄武岩地板 ＋ 碎石步道與亮橘熔岩裂隙
        ctx.fillStyle = "#1C1917";
        for (let mx = startX - 10; mx < endX + 20; mx += 64) {
          const mh = 22 + detHash(mx * 0.3) * 16;
          ctx.beginPath();
          ctx.moveTo(mx, horizonY + 2);
          ctx.lineTo(mx + 32, horizonY - mh);
          ctx.lineTo(mx + 64, horizonY + 2);
          ctx.closePath();
          ctx.fill();
        }
        const tileSz = expanded ? 26 : 20;
        for (let gy = horizonY; gy < vpH; gy += tileSz) {
          const rowI = Math.floor((gy - horizonY) / tileSz);
          for (let gx = Math.floor(startX / tileSz) * tileSz; gx < endX; gx += tileSz) {
            const colI = Math.floor(gx / tileSz);
            const drawX = Math.max(startX, gx);
            const drawW = Math.min(endX, gx + tileSz) - drawX;
            if (drawW <= 0) continue;
            ctx.fillStyle = ((rowI + colI) % 2 === 0) ? "#2A242D" : "#252028";
            ctx.fillRect(drawX, gy, drawW, tileSz + 1);
          }
        }
        ctx.fillStyle = "#1C1917";
        ctx.fillRect(startX, roadY - 17, segW, 34);
        ctx.fillStyle = "#3A313D";
        ctx.fillRect(startX, roadY - 13, segW, 26);
        ctx.fillStyle = "#524656";
        for (let rx = startX + 10; rx < endX - 10; rx += 26) {
          ctx.fillRect(Math.round(rx), roadY - 7, 7, 3);
          ctx.fillRect(Math.round(rx + 12), roadY + 4, 6, 3);
        }
        ctx.fillStyle = "#EA580C";
        ctx.fillRect(startX, roadY - 15, segW, 2);
        ctx.fillRect(startX, roadY + 13, segW, 2);
      } else if (ch.isArena) {
        // FINAL 鬥技場：深灰石板格紋 ＋ 聚光燈 ＋ 紅金冠軍地毯
        const tileSz = expanded ? 28 : 20;
        for (let gy = horizonY; gy < vpH; gy += tileSz) {
          const rowI = Math.floor((gy - horizonY) / tileSz);
          for (let gx = Math.floor(startX / tileSz) * tileSz; gx < endX; gx += tileSz) {
            const colI = Math.floor(gx / tileSz);
            const drawX = Math.max(startX, gx);
            const drawW = Math.min(endX, gx + tileSz) - drawX;
            if (drawW <= 0) continue;
            ctx.fillStyle = ((rowI + colI) % 2 === 0) ? "#1E293B" : "#172033";
            ctx.fillRect(drawX, gy, drawW, tileSz + 1);
          }
        }
        // 聚光燈光束
        ctx.fillStyle = "rgba(250, 204, 21, 0.12)";
        ctx.beginPath();
        ctx.moveTo(startX + segW * 0.5, 0);
        ctx.lineTo(startX + segW * 0.2, vpH);
        ctx.lineTo(startX + segW * 0.8, vpH);
        ctx.closePath();
        ctx.fill();
        // 紅金冠軍地毯大道
        ctx.fillStyle = "#7F1D1D";
        ctx.fillRect(startX, roadY - 19, segW, 38);
        ctx.fillStyle = "#B91C1C";
        ctx.fillRect(startX, roadY - 15, segW, 30);
        ctx.fillStyle = "#FACC15";
        ctx.fillRect(startX, roadY - 16, segW, 3);
        ctx.fillRect(startX, roadY + 13, segW, 3);
      } else {
        // ACT 3 石英高原：古神殿遠柱剪影 ＋ 紫灰方磚地板 ＋ 大理石鑲金大道
        ctx.fillStyle = "#3B0764";
        for (let px = startX + 24; px < endX - 24; px += 76) {
          const ph = 24 + detHash(px) * 14;
          ctx.fillRect(px, horizonY - ph, 14, ph + 2);
          ctx.fillRect(px - 4, horizonY - ph - 4, 22, 5);
        }
        const tileSz = expanded ? 26 : 20;
        for (let gy = horizonY; gy < vpH; gy += tileSz) {
          const rowI = Math.floor((gy - horizonY) / tileSz);
          for (let gx = Math.floor(startX / tileSz) * tileSz; gx < endX; gx += tileSz) {
            const colI = Math.floor(gx / tileSz);
            const drawX = Math.max(startX, gx);
            const drawW = Math.min(endX, gx + tileSz) - drawX;
            if (drawW <= 0) continue;
            ctx.fillStyle = ((rowI + colI) % 2 === 0) ? "#2E2447" : "#251C3B";
            ctx.fillRect(drawX, gy, drawW, tileSz + 1);
          }
        }
        // 大理石鑲金大道
        ctx.fillStyle = "#475569";
        ctx.fillRect(startX, roadY - 17, segW, 34);
        ctx.fillStyle = "#CBD5E1";
        ctx.fillRect(startX, roadY - 13, segW, 26);
        ctx.fillStyle = "#94A3B8";
        for (let sx = startX + 8; sx < endX; sx += 28) {
          ctx.fillRect(Math.round(sx), roadY - 13, 2, 26);
        }
        ctx.fillStyle = "#F59E0B";
        ctx.fillRect(startX, roadY - 15, segW, 2.5);
        ctx.fillRect(startX, roadY + 12.5, segW, 2.5);
      }

      // 1C. 錯落有致的預烘焙微縮 GBA 物件佈景（嚴格鎖定原比例）
      if (props) {
        const treeImg  = props.get("oak_tree_full");
        const houseImg = props.get("house_full");
        const fRed     = props.get("flower_red");
        const fWhite   = props.get("flower_white");
        const reefImg  = props.get("reef_pixel");
        const starImg  = props.get("starfish_pixel");
        const statImg  = props.get("statue_full");
        const pilImg   = props.get("broken_pillar_pixel");

        if (ch.stageId === "pallet") {
          for (let k = 0; k < 9; k++) {
            const px = startX + 28 + k * 74 + (detHash(k * 7 + 1) - 0.5) * 26;
            if (px > endX - 28) continue;
            const py = horizonY + (expanded ? (38 + detHash(k * 11) * 26) : 26);
            if (expanded && houseImg && k % 4 === 1) {
              this.drawSpriteFitHeight(ctx, houseImg, px, py + 4, 52, false);
            } else if (treeImg) {
              const tH = expanded ? (44 + Math.round(detHash(k * 5) * 14)) : 32;
              this.drawSpriteFitHeight(ctx, treeImg, px, py, tH, false);
            }
            if (expanded && (fRed || fWhite) && k % 2 === 0) {
              const fl = k % 4 === 0 ? fRed : fWhite;
              if (fl) this.drawSpriteFitHeight(ctx, fl, px + 18, vpH - 10 - detHash(k * 9) * 14, 16, false);
            }
          }
        } else if (ch.stageId === "cerulean_bay") {
          for (let k = 0; k < 5; k++) {
            const px = startX + 46 + k * 124 + (detHash(k * 17) - 0.5) * 44;
            if (px > endX - 36) continue;
            const depthOff = detHash(k * 23);
            if (reefImg && k % 2 === 0) {
              const rH = expanded ? (30 + Math.round(depthOff * 16)) : 24;
              this.drawSpriteFitHeight(ctx, reefImg, px, horizonY + (expanded ? (36 + depthOff * 30) : 26), rH, false);
            }
            if (expanded && starImg && k % 2 === 1) {
              this.drawSpriteFitHeight(ctx, starImg, px + 16, vpH - 12 - depthOff * 14, 16, false);
            }
          }
        } else if (ch.stageId === "power_plant") {
          const grateImg = props.get("floor_grate_pixel");
          const jboxImg  = props.get("junction_box_pixel");
          const cabImg   = props.get("cable_h_pixel");
          for (let k = 0; k < 6; k++) {
            const px = startX + 40 + k * 102 + (detHash(k * 19) - 0.5) * 28;
            if (px > endX - 28) continue;
            const py = horizonY + (expanded ? (36 + detHash(k * 7) * 24) : 24);
            const pImg = (k % 3 === 0) ? jboxImg : (k % 3 === 1 ? grateImg : cabImg);
            if (pImg) this.drawSpriteFitHeight(ctx, pImg, px, py, expanded ? 24 : 16, false);
          }
        } else if (ch.stageId === "cinnabar_volcano") {
          const lavaImg = props.get("lava_pool_pixel_0");
          const obsImg  = props.get("obsidian_cluster_pixel");
          const crysImg = props.get("lava_crystal_pixel");
          for (let k = 0; k < 6; k++) {
            const px = startX + 44 + k * 104 + (detHash(k * 29) - 0.5) * 26;
            if (px > endX - 30) continue;
            const py = horizonY + (expanded ? (36 + detHash(k * 11) * 24) : 24);
            if (lavaImg && k % 3 === 0) {
              this.drawSpriteFitHeight(ctx, lavaImg, px, py + 6, expanded ? 34 : 22, false);
            } else {
              const vImg = (k % 2 === 0) ? obsImg : crysImg;
              if (vImg) this.drawSpriteFitHeight(ctx, vImg, px, py, expanded ? 26 : 18, false);
            }
          }
        } else if (!ch.isArena) {
          for (let k = 0; k < 6; k++) {
            const px = startX + 42 + k * 102 + (detHash(k * 13) - 0.5) * 30;
            if (px > endX - 30) continue;
            const pImg = k % 2 === 0 ? statImg : pilImg;
            if (pImg) {
              const sH = expanded ? (46 + Math.round(detHash(k * 3) * 10)) : 32;
              this.drawSpriteFitHeight(ctx, pImg, px, horizonY + (expanded ? 42 : 28), sH, false);
            }
          }
        }
      }

      // 區域交界柔和分隔線
      if (cursorWave > 0) {
        ctx.strokeStyle = "rgba(15, 23, 42, 0.72)";
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(startX, 0); ctx.lineTo(startX, vpH); ctx.stroke();
      }

      // 區域頂部黑金標題牌
      const visL = Math.max(startX + 8, camX + 10);
      const visR = Math.min(endX - 8, camX + vpW - 10);
      if (visR - visL > 100) {
        const labelCx = (visL + visR) * 0.5;
        ctx.fillStyle = "rgba(15, 23, 42, 0.88)";
        ctx.strokeStyle = "rgba(250, 204, 21, 0.85)";
        ctx.lineWidth = 1.8;
        ctx.fillRect(labelCx - 74, 8, 148, 22);
        ctx.strokeRect(labelCx - 74, 8, 148, 22);
        ctx.fillStyle = th.text || "#FFFFFF";
        ctx.font = "900 12px 'Noto Sans TC', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`ACT ${chIdx + 1} · ${ch.shortName || ch.name}`, labelCx, 24);
      }

      cursorWave += len;
    });

    // 2. 道路中央已走過的發光行軍進度線（點綴於原生道路中央，自然融入不搶景）
    const pathStartX = nodeX(0);
    if (duoX > pathStartX) {
      ctx.save();
      ctx.strokeStyle = "rgba(250, 204, 21, 0.85)";
      ctx.lineWidth = 4;
      ctx.setLineDash([10, 6]);
      ctx.beginPath();
      ctx.moveTo(pathStartX, roadY);
      ctx.lineTo(duoX, roadY);
      ctx.stroke();
      ctx.restore();
    }

    // 3. 繪製簡潔 RPG 關卡節點圓章、WAVE 標籤與 Boss 頭像（完全去除火車站月台屋簷）
    plan.forEach((cfg, idx) => {
      const sx = nodeX(idx), sy = nodeY(idx);
      if (sx < camX - 90 || sx > camX + vpW + 90) return;
      const wNum = idx + 1;
      const isBoss = !!cfg.isBossWave;
      const isCleared = wNum <= clearedWave;
      const isNext = wNum === nextWave;

      const r = isBoss ? 16 : 13;
      ctx.fillStyle = "#0F172A";
      ctx.beginPath(); ctx.arc(sx, sy, r + 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = isCleared ? "#22C55E" : (isNext ? "#EF4444" : (isBoss ? "#991B1B" : "#334155"));
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "900 12px monospace";
      ctx.textAlign = "center";
      ctx.fillText(isCleared ? "OK" : String(wNum), sx, sy + 4);

      if (isNext) {
        ctx.strokeStyle = "#FEF08A";
        ctx.lineWidth = 3;
        ctx.strokeRect(sx - 22, sy - 22, 44, 44);
      }

      // 未通關 Boss 節點上方顯示原比例 Boss 頭像
      if (isBoss && !isCleared && cfg.previewIds && cfg.previewIds[0]) {
        const bData = POKEMON_MAP.get(cfg.previewIds[0]);
        if (bData && bData.forward_sprite) {
          const rec = SpriteCache.get(bData.forward_sprite);
          if (rec && rec.loaded) {
            this.drawSpriteFitHeight(ctx, rec.img, sx, sy - (expanded ? 22 : 16), expanded ? 60 : 44, false);
          }
        }
      }

      // 下方關卡標籤（統一使用 WAVE 1 / WAVE 2 / W3 BOSS）
      const signY = sy + (expanded ? 26 : 20);
      ctx.fillStyle = "rgba(15, 23, 42, 0.90)";
      ctx.strokeStyle = isNext ? "#FACC15" : "#64748B";
      ctx.lineWidth = 2;
      ctx.fillRect(sx - 50, signY, 100, 23);
      ctx.strokeRect(sx - 50, signY, 100, 23);
      ctx.fillStyle = isNext ? "#FEF08A" : (isCleared ? "#86EFAC" : "#CBD5E1");
      ctx.font = "900 11px 'Press Start 2P', 'Noto Sans TC', monospace";
      const lblTxt = isBoss ? (cfg.isMiniBoss ? `W${wNum} MINI` : `W${wNum} BOSS`) : (cfg.isEventWave ? `W${wNum} EVENT` : `WAVE ${wNum}`);
      ctx.fillText(lblTxt, sx, signY + 16);
    });

    // 4. 高清原比例鎖定「訓練家 ＋ 主角寶可夢」（同步戰鬥內 walkBob += dt * 12 的步頻與上下擺幅）
    const walkSec = walkT * (isCrossingAct ? 2.8 : 1.8);
    const walkBobSim = walkSec * 12.0;
    const isMoving = walkT < 0.99;
    const bobPoke = isMoving ? Math.abs(Math.sin(walkBobSim)) * (expanded ? 4.5 : 3.5) : 0;
    const bobTrainer = isMoving ? Math.abs(Math.sin(walkBobSim + 1.1)) * (expanded ? 3.5 : 2.8) : 0;
    const trTargetH = expanded ? 68 : 50;
    const pkTargetH = expanded ? 72 : 54;
    // v7.6.6 腳底貼齊路面中央（修正先前 -14/-10 加上精靈圖底部留白造成浮在半空的視覺落差）
    const feetBaseY = duoY + (expanded ? 2 : 3);
    const pokePadSink = expanded ? 9 : 7;
    const trPadSink = expanded ? 2 : 2;

    ctx.fillStyle = "rgba(2, 6, 23, 0.45)";
    ctx.beginPath(); ctx.ellipse(duoX - 16, feetBaseY, 15, 4.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(duoX + 14, feetBaseY, 18, 5.0, 0, 0, Math.PI * 2); ctx.fill();

    if (isMoving) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.72)";
      const d1 = (walkT * 52) % 20;
      ctx.beginPath();
      ctx.arc(duoX - 28 - d1, feetBaseY - 1, expanded ? 4.0 : 2.8, 0, Math.PI * 2);
      ctx.arc(duoX - 8 - d1 * 0.7, feetBaseY + 1, expanded ? 3.0 : 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    const tr = app.selectedTrainer || TRAINERS[0];
    const trCos = (typeof getResolvedTrainerCostume === "function") ? getResolvedTrainerCostume(tr, app.saveData) : tr;
    const sheetUrl = trCos.walkSheet || tr.walkSheet;
    const sheetRec = sheetUrl ? SpriteCache.get(sheetUrl) : null;
    if (sheetRec && sheetRec.loaded && sheetRec.img.naturalWidth > 0) {
      const fw = Math.floor(sheetRec.img.naturalWidth / 3);
      const fh = Math.floor(sheetRec.img.naturalHeight / 4);
      const col = isMoving ? [0, 1, 2, 1][Math.floor(walkBobSim * 0.78) % 4] : 1;
      this.drawSpriteFitHeight(ctx, sheetRec.img, duoX - 16, feetBaseY + trPadSink - bobTrainer, trTargetH, false, { x: col * fw, y: 2 * fh, w: fw, h: fh });
    } else if (trCos.sprite) {
      const trRec = SpriteCache.get(trCos.sprite);
      if (trRec && trRec.loaded) {
        this.drawSpriteFitHeight(ctx, trRec.img, duoX - 16, feetBaseY + trPadSink - bobTrainer, trTargetH, false);
      }
    }

    const pData = app.player && app.player.data;
    if (pData && pData.forward_sprite) {
      const pUrl = (app.player.isShiny && pData.shiny_forward_sprite) ? pData.shiny_forward_sprite : pData.forward_sprite;
      const pRec = SpriteCache.get(pUrl);
      if (pRec && pRec.loaded) {
        this.drawSpriteFitHeight(ctx, pRec.img, duoX + 14, feetBaseY + pokePadSink - bobPoke, pkTargetH, true);
      }
    }

    if (isCrossingAct && walkT > 0.36 && walkT < 0.88) {
      const spAlpha = Math.sin(((walkT - 0.36) / 0.52) * Math.PI);
      ctx.save();
      ctx.globalAlpha = spAlpha;
      ctx.fillStyle = "#4ADE80";
      for (let k = 0; k < 6; k++) {
        const sxp = duoX - 32 + k * 14;
        const syp = feetBaseY - (expanded ? 76 : 56) - ((walkT * 48 + k * 8) % 24);
        ctx.fillRect(sxp - 2, syp - 6, 4, 12);
        ctx.fillRect(sxp - 6, syp - 2, 12, 4);
      }
      ctx.restore();
    }

    ctx.restore();

    const nextCfg = plan[Math.min(total - 1, nextWave - 1)];
    const nw = nextCfg && nextCfg.weather;
    if (nw && nw !== "CLEAR") {
      ctx.save();
      if (nw === "RAIN" || nw === "THUNDER") {
        ctx.strokeStyle = "rgba(186, 230, 253, 0.45)";
        ctx.lineWidth = 1.6;
        for (let r = 0; r < 20; r++) {
          const rx = ((r * 49 + walkT * 240) % vpW);
          const ry = ((r * 37 + walkT * 340) % vpH);
          ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx - 6, ry + 14); ctx.stroke();
        }
      } else if (nw === "BLIZZARD") {
        ctx.fillStyle = "rgba(224, 242, 254, 0.78)";
        for (let s = 0; s < 22; s++) {
          const sx = ((s * 53 + walkT * 110) % vpW);
          const sy = ((s * 41 + walkT * 170) % vpH);
          ctx.fillRect(sx, sy, 3.5, 3.5);
        }
      } else if (nw === "PSYCHIC") {
        ctx.fillStyle = "rgba(232, 121, 249, 0.65)";
        for (let a = 0; a < 16; a++) {
          const ax = ((a * 67 + walkT * 75) % vpW);
          const ay = ((a * 43 + Math.sin(walkT * 6 + a) * 24) % vpH);
          ctx.fillRect(ax, ay, 4, 4);
        }
      } else if (nw === "HEATWAVE") {
        ctx.fillStyle = "rgba(251, 146, 60, 0.70)";
        for (let f = 0; f < 16; f++) {
          const fx = ((f * 59) % vpW);
          const fy = vpH - ((f * 29 + walkT * 140) % vpH);
          ctx.fillRect(fx, fy, 3.5, 3.5);
        }
      }
      ctx.restore();
    }

    ctx.strokeStyle = "#F59E0B";
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, vpW - 4, vpH - 4);
  },

  buyShopItem(idx) {
    const app = GameApp;
    const st = app.expeditionState;
    const p = app.player;
    if (!st || !p) return;
    const it = st.shopShelf && st.shopShelf[idx];
    if (!it || it.bought) return;

    if (app.runCoins < it.cost) {
      if (app.pixelToast) app.pixelToast(`代幣不足！需 ${it.cost} 金（目前 ${app.runCoins} 金）`, "warn");
      return;
    }

    if (it.kind === "tm") {
      const cleanId = it.id.replace(/\s+/g, "");
      const existKey = Object.keys(p.skills).find(k => k.replace(/\s+/g, "") === cleanId);
      if (!existKey && Object.keys(p.skills).length >= (p.maxSkillSlots || 3)) {
        st.pendingForgetTm = { idx, item: it };
        this.renderIntermissionModal(app, false);
        return;
      }
      app.runCoins -= it.cost;
      app.saveData.coins = Math.max(0, app.saveData.coins - it.cost);
      it.bought = true;
      if (existKey) {
        p.skills[existKey].level = Math.min(10, p.skills[existKey].level + 1);
      } else {
        p.skills[it.id] = { id: it.id, level: 1, evolved: false, timer: 0.25 };
      }
    } else if (it.kind === "held") {
      const ownedHeldCount = Object.keys(p.heldItems || {}).filter(k => p.heldItems[k]).length;
      if (ownedHeldCount >= 4) {
        if (app.pixelToast) app.pixelToast("攜帶物已達上限 (4/4)！", "warn");
        return;
      }
      app.runCoins -= it.cost;
      app.saveData.coins = Math.max(0, app.saveData.coins - it.cost);
      it.bought = true;
      p.heldItems[it.id] = true;
      p.dmgMult += 0.06;
    } else if (it.id === "pp_up") {
      app.runCoins -= it.cost;
      app.saveData.coins = Math.max(0, app.saveData.coins - it.cost);
      it.bought = true;
      st.shopBoughtCounts = st.shopBoughtCounts || { candy: 0, heal: 0 };
      st.shopBoughtCounts.candy = (st.shopBoughtCounts.candy || 0) + 1;
      const upgList = Object.values(p.skills).filter(s => s.level < 10);
      if (upgList.length > 0) {
        const pick = upgList[Math.floor(Math.random() * upgList.length)];
        pick.level = Math.min(10, pick.level + 1);
      }
    } else if (it.id === "master_candy") {
      app.runCoins -= it.cost;
      app.saveData.coins = Math.max(0, app.saveData.coins - it.cost);
      it.bought = true;
      st.shopBoughtCounts = st.shopBoughtCounts || { candy: 0, heal: 0 };
      st.shopBoughtCounts.candy = (st.shopBoughtCounts.candy || 0) + 1;
      p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * 0.30 * (p.badgeHealMult || 1.0)));
      const upgList = Object.values(p.skills).filter(s => s.level < 10);
      if (upgList.length > 0) {
        const pick = upgList[Math.floor(Math.random() * upgList.length)];
        pick.level = Math.min(10, pick.level + 2);
      }
    } else if (it.id === "full_restore") {
      app.runCoins -= it.cost;
      app.saveData.coins = Math.max(0, app.saveData.coins - it.cost);
      it.bought = true;
      st.shopBoughtCounts = st.shopBoughtCounts || { candy: 0, heal: 0 };
      st.shopBoughtCounts.heal = (st.shopBoughtCounts.heal || 0) + 1;
      p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * 0.45 * (p.badgeHealMult || 1.0)));
      p.status = null;
      p.statusTimer = 0;
    } else if (it.id === "x_attack") {
      app.runCoins -= it.cost;
      app.saveData.coins = Math.max(0, app.saveData.coins - it.cost);
      it.bought = true;
      p.xAttackTimer = 35.0;
    } else if (it.id === "x_speed") {
      app.runCoins -= it.cost;
      app.saveData.coins = Math.max(0, app.saveData.coins - it.cost);
      it.bought = true;
      p.xSpeedTimer = 35.0;
    }

    SoundFX.play("levelup");
    this.saveCheckpoint(app, st.currentWave + 1);
    app.refreshHUD();
    this.renderIntermissionModal(app, false);
  },

  confirmForgetAndBuy(oldKey) {
    const app = GameApp;
    const st = app.expeditionState;
    const p = app.player;
    if (!st || !st.pendingForgetTm || !p) return;
    const { item } = st.pendingForgetTm;
    if (app.runCoins < item.cost) {
      st.pendingForgetTm = null;
      this.renderIntermissionModal(app, false);
      return;
    }
    app.runCoins -= item.cost;
    app.saveData.coins = Math.max(0, app.saveData.coins - item.cost);
    delete p.skills[oldKey];
    p.skills[item.id] = { id: item.id, level: 1, evolved: false, timer: 0.25 };
    item.bought = true;
    st.pendingForgetTm = null;
    SoundFX.play("levelup");
    this.saveCheckpoint(app, st.currentWave + 1);
    app.refreshHUD();
    this.renderIntermissionModal(app, false);
  },

  cancelForget() {
    if (GameApp.expeditionState) GameApp.expeditionState.pendingForgetTm = null;
    this.renderIntermissionModal(GameApp, false);
  },

  rerollShop() {
    const app = GameApp;
    const st = app.expeditionState;
    if (!st) return;
    const cost = st.shopRerollCost || 30;
    if (app.runCoins < cost) {
      if (app.pixelToast) app.pixelToast(`代幣不足！刷新需 ${cost} 金`, "warn");
      return;
    }
    app.runCoins -= cost;
    app.saveData.coins = Math.max(0, app.saveData.coins - cost);
    st.shopRerollCost = cost + 25;
    SoundFX.play("hit");
    this.rollIntermissionShop(app);
    this.renderIntermissionModal(app, false);
  },

  proceedToNextWave() {
    this.stopRouteWalkAnim();
    const app = GameApp;
    const st = app.expeditionState;
    if (!st) return;
    const modal = document.getElementById("expeditionModal");
    if (modal) {
      modal.classList.add("hidden");
      modal.style.display = "none";
    }
    this.launchWaveWithCeremony(app, Math.min(st.totalWaves, st.currentWave + 1));
  },

  renderHallOfFameHtml(app) {
    const res = app.lastExpeditionResult;
    const p = app.player;
    const tr = app.selectedTrainer || TRAINERS[0];
    if (!res || !p) return "";
    const trCos = (typeof getResolvedTrainerCostume === "function") ? getResolvedTrainerCostume(tr, app.saveData) : tr;
    const pSpr = (p.isShiny && p.data.shiny_forward_sprite) ? p.data.shiny_forward_sprite : p.data.forward_sprite;
    const partnerImgs = (app.partners || []).map(pt =>
      `<img src="${SpriteCache.resolveUrl(pt.data.forward_sprite)}" class="w-10 h-10 pixel-sprite object-contain" alt="${pt.data.name_zh}"/>`
    ).join("");
    const badgesHtml = (res.chaptersCleared || []).map(ch =>
      `<span style="background:${ch.badgeBg};" class="px-2 py-0.5 rounded-full text-[9px] font-black text-white border border-white/50 shadow">${ch.badgeLabel}</span>`
    ).join("");
    const m = String(Math.floor((res.clearTimeSec || 0) / 60)).padStart(2, "0");
    const s = String((res.clearTimeSec || 0) % 60).padStart(2, "0");

    return `
      <div class="mb-3 rounded-2xl bg-gradient-to-b from-slate-950 via-indigo-950 to-slate-950 border-2 border-amber-400 p-3 text-center shadow-xl">
        <div class="font-pixel text-[9px] text-amber-300 tracking-widest mb-2">${res.isExTrueClear ? "★ TRUE HALL OF FAME · EX 始祖夢夢制霸 ★" : "HALL OF FAME · 關都殿堂登錄"}</div>
        <div class="flex items-end justify-center gap-2 py-1.5 bg-slate-900/75 rounded-xl border border-amber-500/40 mb-2">
          <img src="${SpriteCache.resolveUrl(trCos.sprite || tr.sprite)}" class="w-12 h-12 pixel-sprite object-contain" alt="${tr.name}"/>
          <img src="${SpriteCache.resolveUrl(pSpr)}" class="w-16 h-16 pixel-sprite object-contain drop-shadow-[0_0_8px_rgba(250,204,21,0.75)]" alt="${p.data.name_zh}"/>
          ${partnerImgs}
        </div>
        <div class="flex items-center justify-center gap-1 flex-wrap mb-1.5">${badgesHtml}</div>
        <div class="text-[10px] font-bold text-slate-300">總通關耗時 <span class="font-pixel text-amber-300">${m}:${s}</span> · 遠征賞金 <span class="text-emerald-300">+${res.totalGain} 金</span></div>
      </div>
    `;
  }
};
