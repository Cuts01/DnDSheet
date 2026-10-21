#!/usr/bin/env python3
"""Genera content/2014/_items.txt y content/2024/_items.txt (weapons, armor, gear y tools del SRD)."""
from pathlib import Path

ROOT = Path(__file__).parent

# nombre, categoria, alcance, dado, tipo, props, versatile, rango, costo, peso, mastery 2024
WEAPONS = [
    ("Club", "simple", "melee", "1d4", "bludgeoning", "light", None, None, "1 sp", 2, "Slow"),
    ("Dagger", "simple", "melee", "1d4", "piercing", "finesse, light, thrown", None, "20/60", "2 gp", 1, "Nick"),
    ("Greatclub", "simple", "melee", "1d8", "bludgeoning", "two-handed", None, None, "2 sp", 10, "Push"),
    ("Handaxe", "simple", "melee", "1d6", "slashing", "light, thrown", None, "20/60", "5 gp", 2, "Vex"),
    ("Javelin", "simple", "melee", "1d6", "piercing", "thrown", None, "30/120", "5 sp", 2, "Slow"),
    ("Light Hammer", "simple", "melee", "1d4", "bludgeoning", "light, thrown", None, "20/60", "2 gp", 2, "Nick"),
    ("Mace", "simple", "melee", "1d6", "bludgeoning", "", None, None, "5 gp", 4, "Sap"),
    ("Quarterstaff", "simple", "melee", "1d6", "bludgeoning", "versatile", "1d8", None, "2 sp", 4, "Topple"),
    ("Sickle", "simple", "melee", "1d4", "slashing", "light", None, None, "1 gp", 2, "Nick"),
    ("Spear", "simple", "melee", "1d6", "piercing", "thrown, versatile", "1d8", "20/60", "1 gp", 3, "Sap"),
    ("Light Crossbow", "simple", "ranged", "1d8", "piercing", "ammunition, loading, two-handed", None, "80/320", "25 gp", 5, "Slow"),
    ("Dart", "simple", "ranged", "1d4", "piercing", "finesse, thrown", None, "20/60", "5 cp", 0.25, "Vex"),
    ("Shortbow", "simple", "ranged", "1d6", "piercing", "ammunition, two-handed", None, "80/320", "25 gp", 2, "Vex"),
    ("Sling", "simple", "ranged", "1d4", "bludgeoning", "ammunition", None, "30/120", "1 sp", 0, "Slow"),
    ("Battleaxe", "martial", "melee", "1d8", "slashing", "versatile", "1d10", None, "10 gp", 4, "Topple"),
    ("Flail", "martial", "melee", "1d8", "bludgeoning", "", None, None, "10 gp", 2, "Sap"),
    ("Glaive", "martial", "melee", "1d10", "slashing", "heavy, reach, two-handed", None, None, "20 gp", 6, "Graze"),
    ("Greataxe", "martial", "melee", "1d12", "slashing", "heavy, two-handed", None, None, "30 gp", 7, "Cleave"),
    ("Greatsword", "martial", "melee", "2d6", "slashing", "heavy, two-handed", None, None, "50 gp", 6, "Graze"),
    ("Halberd", "martial", "melee", "1d10", "slashing", "heavy, reach, two-handed", None, None, "20 gp", 6, "Cleave"),
    ("Lance", "martial", "melee", "1d12", "piercing", "reach, special", None, None, "10 gp", 6, "Topple"),
    ("Longsword", "martial", "melee", "1d8", "slashing", "versatile", "1d10", None, "15 gp", 3, "Sap"),
    ("Maul", "martial", "melee", "2d6", "bludgeoning", "heavy, two-handed", None, None, "10 gp", 10, "Topple"),
    ("Morningstar", "martial", "melee", "1d8", "piercing", "", None, None, "15 gp", 4, "Sap"),
    ("Pike", "martial", "melee", "1d10", "piercing", "heavy, reach, two-handed", None, None, "5 gp", 18, "Push"),
    ("Rapier", "martial", "melee", "1d8", "piercing", "finesse", None, None, "25 gp", 2, "Vex"),
    ("Scimitar", "martial", "melee", "1d6", "slashing", "finesse, light", None, None, "25 gp", 3, "Nick"),
    ("Shortsword", "martial", "melee", "1d6", "piercing", "finesse, light", None, None, "10 gp", 2, "Vex"),
    ("Trident", "martial", "melee", "1d6", "piercing", "thrown, versatile", "1d8", "20/60", "5 gp", 4, "Topple"),
    ("War Pick", "martial", "melee", "1d8", "piercing", "", None, None, "5 gp", 2, "Sap"),
    ("Warhammer", "martial", "melee", "1d8", "bludgeoning", "versatile", "1d10", None, "15 gp", 2, "Push"),
    ("Whip", "martial", "melee", "1d4", "slashing", "finesse, reach", None, None, "2 gp", 3, "Slow"),
    ("Blowgun", "martial", "ranged", "1", "piercing", "ammunition, loading", None, "25/100", "10 gp", 1, "Vex"),
    ("Hand Crossbow", "martial", "ranged", "1d6", "piercing", "ammunition, light, loading", None, "30/120", "75 gp", 3, "Vex"),
    ("Heavy Crossbow", "martial", "ranged", "1d10", "piercing", "ammunition, heavy, loading, two-handed", None, "100/400", "50 gp", 18, "Push"),
    ("Longbow", "martial", "ranged", "1d8", "piercing", "ammunition, heavy, two-handed", None, "150/600", "50 gp", 2, "Slow"),
    ("Musket", "martial", "ranged", "1d12", "piercing", "ammunition, loading, two-handed", None, "40/120", "500 gp", 10, "Slow"),
    ("Pistol", "martial", "ranged", "1d10", "piercing", "ammunition, loading", None, "30/90", "250 gp", 3, "Vex"),
]
# Cambios 2024 sobre la tabla base
WEAPONS_2024 = {
    "Trident": dict(dice="1d8", versatile="1d10"),
    "War Pick": dict(props="versatile", versatile="1d10"),
    "Lance": dict(props="heavy, reach, two-handed (unless mounted)"),
}

# nombre, categoria, ac, dexMax, str, stealth, costo, peso
ARMOR = [
    ("Padded Armor", "light", 11, None, None, True, "5 gp", 8),
    ("Leather Armor", "light", 11, None, None, False, "10 gp", 10),
    ("Studded Leather Armor", "light", 12, None, None, False, "45 gp", 13),
    ("Hide Armor", "medium", 12, 2, None, False, "10 gp", 12),
    ("Chain Shirt", "medium", 13, 2, None, False, "50 gp", 20),
    ("Scale Mail", "medium", 14, 2, None, True, "50 gp", 45),
    ("Breastplate", "medium", 14, 2, None, False, "400 gp", 20),
    ("Half Plate Armor", "medium", 15, 2, None, True, "750 gp", 40),
    ("Ring Mail", "heavy", 14, 0, None, True, "30 gp", 40),
    ("Chain Mail", "heavy", 16, 0, 13, True, "75 gp", 55),
    ("Splint Armor", "heavy", 17, 0, 15, True, "200 gp", 60),
    ("Plate Armor", "heavy", 18, 0, 15, True, "1,500 gp", 65),
    ("Shield", "shield", 2, None, None, False, "10 gp", 6),
]

# nombre, categoria, costo, peso, texto
GEAR = [
    ("Abacus", "Adventuring Gear", "2 gp", 2, ""),
    ("Acid (vial)", "Adventuring Gear", "25 gp", 1, "Throw it (ranged attack, 20 ft): 2d6 acid damage on a hit."),
    ("Alchemist's Fire (flask)", "Adventuring Gear", "50 gp", 1, "Throw it (20 ft): the target takes 1d4 fire damage at the start of each turn until it uses an action to put it out."),
    ("Antitoxin (vial)", "Adventuring Gear", "50 gp", 0, "Advantage on saves against poison for 1 hour."),
    ("Backpack", "Adventuring Gear", "2 gp", 5, "Holds 1 cubic foot or 30 lb of gear."),
    ("Ball Bearings (bag of 1,000)", "Adventuring Gear", "1 gp", 2, "Cover a 10-foot square; creatures moving through must succeed on a DC 10 Dexterity save or fall prone."),
    ("Barrel", "Adventuring Gear", "2 gp", 70, ""),
    ("Basket", "Adventuring Gear", "4 sp", 2, ""),
    ("Bedroll", "Adventuring Gear", "1 gp", 7, ""),
    ("Bell", "Adventuring Gear", "1 gp", 0, ""),
    ("Blanket", "Adventuring Gear", "5 sp", 3, ""),
    ("Block and Tackle", "Adventuring Gear", "1 gp", 5, "Lets you hoist up to four times the weight you can normally lift."),
    ("Book", "Adventuring Gear", "25 gp", 5, ""),
    ("Bottle, Glass", "Adventuring Gear", "2 gp", 2, ""),
    ("Bucket", "Adventuring Gear", "5 cp", 2, ""),
    ("Caltrops (bag of 20)", "Adventuring Gear", "1 gp", 2, "Cover a 5-foot square; creatures entering must succeed on a DC 15 Dexterity save or take 1 piercing damage and lose speed."),
    ("Candle", "Adventuring Gear", "1 cp", 0, "Bright light in 5 ft for 1 hour."),
    ("Case, Crossbow Bolt", "Adventuring Gear", "1 gp", 1, "Holds up to 20 bolts."),
    ("Case, Map or Scroll", "Adventuring Gear", "1 gp", 1, ""),
    ("Chain (10 feet)", "Adventuring Gear", "5 gp", 10, ""),
    ("Chalk (1 piece)", "Adventuring Gear", "1 cp", 0, ""),
    ("Chest", "Adventuring Gear", "5 gp", 25, ""),
    ("Climber's Kit", "Adventuring Gear", "25 gp", 12, "Anchor yourself: you can't fall more than 25 feet from the anchor point."),
    ("Clothes, Common", "Adventuring Gear", "5 sp", 3, ""),
    ("Clothes, Costume", "Adventuring Gear", "5 gp", 4, ""),
    ("Clothes, Fine", "Adventuring Gear", "15 gp", 6, ""),
    ("Clothes, Traveler's", "Adventuring Gear", "2 gp", 4, ""),
    ("Component Pouch", "Adventuring Gear", "25 gp", 2, "Holds the material components for your spells that have no cost."),
    ("Crowbar", "Adventuring Gear", "2 gp", 5, "Advantage on Strength checks where leverage helps."),
    ("Fishing Tackle", "Adventuring Gear", "1 gp", 4, ""),
    ("Flask or Tankard", "Adventuring Gear", "2 cp", 1, ""),
    ("Grappling Hook", "Adventuring Gear", "2 gp", 4, ""),
    ("Hammer", "Adventuring Gear", "1 gp", 3, ""),
    ("Healer's Kit", "Adventuring Gear", "5 gp", 3, "Ten uses. Stabilize a creature at 0 HP without a Medicine check."),
    ("Holy Water (flask)", "Adventuring Gear", "25 gp", 1, "Throw it (20 ft): 2d6 radiant damage to a fiend or undead on a hit."),
    ("Hourglass", "Adventuring Gear", "25 gp", 1, ""),
    ("Hunting Trap", "Adventuring Gear", "5 gp", 25, "A creature that steps in makes a DC 13 Dexterity save or takes 1d4 piercing damage and is stuck."),
    ("Ink (1 ounce bottle)", "Adventuring Gear", "10 gp", 0, ""),
    ("Ink Pen", "Adventuring Gear", "2 cp", 0, ""),
    ("Jug or Pitcher", "Adventuring Gear", "2 cp", 4, ""),
    ("Ladder (10-foot)", "Adventuring Gear", "1 sp", 25, ""),
    ("Lamp", "Adventuring Gear", "5 sp", 1, "Bright light 15 ft and dim light 30 ft for 6 hours per flask of oil."),
    ("Lantern, Bullseye", "Adventuring Gear", "10 gp", 2, "Bright light in a 60-foot cone and dim light 60 more feet."),
    ("Lantern, Hooded", "Adventuring Gear", "5 gp", 2, "Bright light 30 ft and dim light 30 more feet; can be lowered to dim light 5 ft."),
    ("Lock", "Adventuring Gear", "10 gp", 1, ""),
    ("Magnifying Glass", "Adventuring Gear", "100 gp", 0, ""),
    ("Manacles", "Adventuring Gear", "2 gp", 6, ""),
    ("Mirror, Steel", "Adventuring Gear", "5 gp", 0.5, ""),
    ("Oil (flask)", "Adventuring Gear", "1 sp", 1, "Can be thrown and set alight to burn for 5 fire damage."),
    ("Paper (one sheet)", "Adventuring Gear", "2 sp", 0, ""),
    ("Parchment (one sheet)", "Adventuring Gear", "1 sp", 0, ""),
    ("Perfume (vial)", "Adventuring Gear", "5 gp", 0, ""),
    ("Pick, Miner's", "Adventuring Gear", "2 gp", 10, ""),
    ("Piton", "Adventuring Gear", "5 cp", 0.25, ""),
    ("Poison, Basic (vial)", "Adventuring Gear", "100 gp", 0, "Coat a weapon or up to three pieces of ammunition: 1d4 poison damage on a hit (DC 10 Constitution save)."),
    ("Pole (10-foot)", "Adventuring Gear", "5 cp", 7, ""),
    ("Pot, Iron", "Adventuring Gear", "2 gp", 10, ""),
    ("Potion of Healing", "Adventuring Gear", "50 gp", 0.5, "Regain 2d4 + 2 hit points."),
    ("Pouch", "Adventuring Gear", "5 sp", 1, ""),
    ("Quiver", "Adventuring Gear", "1 gp", 1, "Holds up to 20 arrows."),
    ("Ram, Portable", "Adventuring Gear", "4 gp", 35, "+4 to Strength checks to break doors."),
    ("Rations (1 day)", "Adventuring Gear", "5 sp", 2, ""),
    ("Robes", "Adventuring Gear", "1 gp", 4, ""),
    ("Rope, Hempen (50 feet)", "Adventuring Gear", "1 gp", 10, ""),
    ("Rope, Silk (50 feet)", "Adventuring Gear", "10 gp", 5, ""),
    ("Sack", "Adventuring Gear", "1 cp", 0.5, ""),
    ("Scale, Merchant's", "Adventuring Gear", "5 gp", 3, ""),
    ("Sealing Wax", "Adventuring Gear", "5 sp", 0, ""),
    ("Shovel", "Adventuring Gear", "2 gp", 5, ""),
    ("Signal Whistle", "Adventuring Gear", "5 cp", 0, ""),
    ("Signet Ring", "Adventuring Gear", "5 gp", 0, ""),
    ("Soap", "Adventuring Gear", "2 cp", 0, ""),
    ("Spellbook", "Adventuring Gear", "50 gp", 3, ""),
    ("Spikes, Iron (10)", "Adventuring Gear", "1 gp", 5, ""),
    ("Spyglass", "Adventuring Gear", "1,000 gp", 1, ""),
    ("Tent, Two-Person", "Adventuring Gear", "2 gp", 20, ""),
    ("Tinderbox", "Adventuring Gear", "5 sp", 1, ""),
    ("Torch", "Adventuring Gear", "1 cp", 1, "Bright light 20 ft and dim light 20 more feet for 1 hour."),
    ("Vial", "Adventuring Gear", "1 gp", 0, ""),
    ("Waterskin", "Adventuring Gear", "2 sp", 5, ""),
    ("Whetstone", "Adventuring Gear", "1 cp", 1, ""),
    ("Net", "Adventuring Gear", "1 gp", 3, "Throw it at a Large or smaller creature (range 5/15): it is restrained until freed (DC 10 Strength check or 5 slashing damage to the net)."),
    ("Arrows (20)", "Ammunition", "1 gp", 1, ""),
    ("Blowgun Needles (50)", "Ammunition", "1 gp", 1, ""),
    ("Crossbow Bolts (20)", "Ammunition", "1 gp", 1.5, ""),
    ("Sling Bullets (20)", "Ammunition", "4 cp", 1.5, ""),
    ("Firearm Bullets (10)", "Ammunition", "3 gp", 2, "Ammunition for pistols and muskets."),
    ("Arcane Focus: Crystal", "Spellcasting Focus", "10 gp", 1, ""),
    ("Arcane Focus: Orb", "Spellcasting Focus", "20 gp", 3, ""),
    ("Arcane Focus: Rod", "Spellcasting Focus", "10 gp", 2, ""),
    ("Arcane Focus: Staff", "Spellcasting Focus", "5 gp", 4, ""),
    ("Arcane Focus: Wand", "Spellcasting Focus", "10 gp", 1, ""),
    ("Druidic Focus: Sprig of Mistletoe", "Spellcasting Focus", "1 gp", 0, ""),
    ("Druidic Focus: Wooden Staff", "Spellcasting Focus", "5 gp", 4, ""),
    ("Druidic Focus: Yew Wand", "Spellcasting Focus", "10 gp", 1, ""),
    ("Holy Symbol: Amulet", "Spellcasting Focus", "5 gp", 1, ""),
    ("Holy Symbol: Emblem", "Spellcasting Focus", "5 gp", 0, ""),
    ("Holy Symbol: Reliquary", "Spellcasting Focus", "5 gp", 2, ""),
    ("Burglar's Pack", "Equipment Pack", "16 gp", 44.5, "Backpack, ball bearings, string, bell, candles, crowbar, hammer, pitons, hooded lantern, oil, rations, tinderbox, waterskin and rope."),
    ("Diplomat's Pack", "Equipment Pack", "39 gp", 36, "Chest, map cases, fine clothes, ink, pen, lamp, oil, paper, perfume, sealing wax and soap."),
    ("Dungeoneer's Pack", "Equipment Pack", "12 gp", 61.5, "Backpack, crowbar, hammer, pitons, torches, tinderbox, rations, waterskin and rope."),
    ("Entertainer's Pack", "Equipment Pack", "40 gp", 38, "Backpack, bedroll, costumes, candles, rations, waterskin and a disguise kit."),
    ("Explorer's Pack", "Equipment Pack", "10 gp", 59, "Backpack, bedroll, mess kit, tinderbox, torches, rations, waterskin and rope."),
    ("Priest's Pack", "Equipment Pack", "19 gp", 24, "Backpack, blanket, candles, tinderbox, alms box, incense, censer, vestments, rations and waterskin."),
    ("Scholar's Pack", "Equipment Pack", "40 gp", 10, "Backpack, book of lore, ink, pen, parchment, sand and a small knife."),
]

TOOLS = [
    ("Alchemist's Supplies", "Artisan's Tools", "50 gp", 8),
    ("Brewer's Supplies", "Artisan's Tools", "20 gp", 9),
    ("Calligrapher's Supplies", "Artisan's Tools", "10 gp", 5),
    ("Carpenter's Tools", "Artisan's Tools", "8 gp", 6),
    ("Cartographer's Tools", "Artisan's Tools", "15 gp", 6),
    ("Cobbler's Tools", "Artisan's Tools", "5 gp", 5),
    ("Cook's Utensils", "Artisan's Tools", "1 gp", 8),
    ("Glassblower's Tools", "Artisan's Tools", "30 gp", 5),
    ("Jeweler's Tools", "Artisan's Tools", "25 gp", 2),
    ("Leatherworker's Tools", "Artisan's Tools", "5 gp", 5),
    ("Mason's Tools", "Artisan's Tools", "10 gp", 8),
    ("Painter's Supplies", "Artisan's Tools", "10 gp", 5),
    ("Potter's Tools", "Artisan's Tools", "10 gp", 3),
    ("Smith's Tools", "Artisan's Tools", "20 gp", 8),
    ("Tinker's Tools", "Artisan's Tools", "50 gp", 10),
    ("Weaver's Tools", "Artisan's Tools", "1 gp", 5),
    ("Woodcarver's Tools", "Artisan's Tools", "1 gp", 5),
    ("Disguise Kit", "Kits", "25 gp", 3),
    ("Forgery Kit", "Kits", "15 gp", 5),
    ("Herbalism Kit", "Kits", "5 gp", 3),
    ("Navigator's Tools", "Kits", "25 gp", 2),
    ("Poisoner's Kit", "Kits", "50 gp", 2),
    ("Thieves' Tools", "Kits", "25 gp", 1),
    ("Dice Set", "Gaming Set", "1 sp", 0),
    ("Dragonchess Set", "Gaming Set", "1 gp", 0.5),
    ("Playing Card Set", "Gaming Set", "5 sp", 0),
    ("Three-Dragon Ante Set", "Gaming Set", "1 gp", 0),
    ("Bagpipes", "Musical Instrument", "30 gp", 6),
    ("Drum", "Musical Instrument", "6 gp", 3),
    ("Dulcimer", "Musical Instrument", "25 gp", 10),
    ("Flute", "Musical Instrument", "2 gp", 1),
    ("Horn", "Musical Instrument", "3 gp", 2),
    ("Lute", "Musical Instrument", "35 gp", 2),
    ("Lyre", "Musical Instrument", "30 gp", 2),
    ("Pan Flute", "Musical Instrument", "12 gp", 2),
    ("Shawm", "Musical Instrument", "2 gp", 1),
    ("Viol", "Musical Instrument", "30 gp", 1),
]


def fmt_w(w):
    return str(int(w)) if float(w).is_integer() else str(w)


def write(ruleset: str):
    lines = [f"# Weapons, armor, gear y tools ({ruleset}). Generado por gen_items.py"]
    for name, cat, rng, dice, dtype, props, vers, rang, cost, weight, mastery in WEAPONS:
        if ruleset == "2024" and name in WEAPONS_2024:
            ch = WEAPONS_2024[name]
            dice = ch.get("dice", dice)
            vers = ch.get("versatile", vers)
            props = ch.get("props", props)
            if "versatile" in ch and "versatile" not in props:
                props = ", ".join(x for x in [props, "versatile"] if x)
        parts = [f"@weapon {name}", f"{cat} {rng}", f"{dice} {dtype}"]
        if vers:
            parts.append(f"versatile {vers}")
        if props:
            parts.append(f"props {props}")
        if rang:
            parts.append(f"range {rang}")
        if ruleset == "2024":
            parts.append(f"mastery {mastery}")
        parts += [f"cost {cost}", f"weight {fmt_w(weight)}"]
        lines.append(" | ".join(parts))
        if name in ("Musket", "Pistol") and ruleset == "2014":
            lines.append("Firearm from the Dungeon Master's Guide (Renaissance). Needs the DM's approval and firearm proficiency.")
        if name == "Lance" and ruleset == "2014":
            lines.append("Disadvantage when attacking a target within 5 feet; two hands needed unless mounted.")
    lines.append("")
    for name, cat, ac, dex, st, stealth, cost, weight in ARMOR:
        parts = [f"@armor {name}", cat, f"ac {ac}"]
        if dex is not None:
            parts.append(f"dex {dex}")
        if st:
            parts.append(f"str {st}")
        if stealth:
            parts.append("stealth")
        parts += [f"cost {cost}", f"weight {fmt_w(weight)}"]
        lines.append(" | ".join(parts))
    lines.append("")
    for name, cat, cost, weight, text in GEAR:
        if name == "Firearm Bullets (10)" and ruleset == "2014":
            text = "Ammunition for DMG firearms."
        lines.append(f"@gear {name} | cat {cat} | cost {cost} | weight {fmt_w(weight)}")
        if text:
            lines.append(text)
    lines.append("")
    for name, cat, cost, weight in TOOLS:
        lines.append(f"@tool {name} | cat {cat} | cost {cost} | weight {fmt_w(weight)}")
    (ROOT / ruleset / "_items.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")


for r in ("2014", "2024"):
    write(r)
print("ok")
