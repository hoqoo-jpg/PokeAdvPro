updateTitleUI() {
    // 安全防護：若 saveData 尚未初始化，自動補上預設物件
    if (!this.saveData) {
      this.saveData = {
        coins: 800,
        unlockedPokemon: { 1: true, 4: true, 7: true, 10: true, 16: true, 25: true },
        unlockedTrainers: { ash: true, misty: true, brock: true },
        upgrades: { atk: 0, cd: 0, hp: 0, shiny: 0, fourthSlot: 0, trainerCd: 0, partner: 0, greed: 0 },
        stats: { totalKills: 0, evolutions: 0, superMoves: 0, birdsDefeated: 0, mewtwoDefeated: 0, mewDefeated: 0 },
        pokedexSeen: { 1: true, 4: true, 7: true, 10: true, 16: true, 25: true, 133: true },
        pokedexCaught: { 1: true, 4: true, 7: true, 10: true, 16: true, 25: true },
        pokedexRewardClaimed: {},
        shinyUnlocked: { 25: true },
        claimedAch: {}
      };
    }

    const coinsVal = (this.saveData.coins || 0).toLocaleString();
    const c1 = document.getElementById("titleCoinDisplay");
    const c2 = document.getElementById("shopCoinDisplay");
    const c3 = document.getElementById("wizardCoinDisplay");
    if (c1) c1.textContent = coinsVal;
    if (c2) c2.textContent = coinsVal;
    if (c3) c3.textContent = coinsVal;

    const sCount = document.getElementById("titleShinyCount");
    if (sCount) sCount.textContent = Object.keys(this.saveData.shinyUnlocked || {}).length;

    const p = (typeof POKEMON_MAP !== "undefined" && POKEMON_MAP.get(this.selectedStarterId)) || (typeof POKEMON_MAP !== "undefined" && POKEMON_MAP.get(25)) || { id: 25, name_zh: "皮卡丘", forward_sprite: "" };
    const t = this.selectedTrainer || (typeof TRAINERS !== "undefined" ? TRAINERS[0] : { name: "小智", sprite: "" });
    const useShiny = !!(this.saveData.shinyUnlocked && this.saveData.shinyUnlocked[p.id]) && !!(this.useShinyStarter && this.useShinyStarter[p.id]);

    const lTrImg = document.getElementById("lobbyTrainerPreview");
    const lPkImg = document.getElementById("lobbyPokemonPreview");
    if (lTrImg && t) {
      lTrImg.src = t.sprite;
      const tNameEl = document.getElementById("lobbyTrainerName");
      if (tNameEl) tNameEl.textContent = t.name;
    }
    if (lPkImg && p) {
      lPkImg.src = p.forward_sprite;
      lPkImg.className = `w-12 h-12 sm:w-14 sm:h-14 pixel-sprite object-contain ${useShiny ? 'shiny-sprite-filter' : ''}`;
      const pNameEl = document.getElementById("lobbyPokemonName");
      if (pNameEl) pNameEl.textContent = `${p.name_zh} (#${String(p.id).padStart(3,'0')})`;
    }

    const hasAch = typeof ACHIEVEMENTS !== "undefined" && ACHIEVEMENTS.some(a => a.check(this.saveData.stats, this.saveData) && !this.saveData.claimedAch[a.id]);
    const achBadge = document.getElementById("achClaimBadge");
    if (achBadge) achBadge.classList.toggle("hidden", !hasAch);

    const hasDexReward = typeof POKEMON_DB !== "undefined" && POKEMON_DB.some(pk => this.saveData.pokedexCaught[pk.id] && !this.saveData.pokedexRewardClaimed[pk.id]);
    const dexBadge = document.getElementById("pokedexRewardBadge");
    if (dexBadge) dexBadge.classList.toggle("hidden", !hasDexReward);
  },