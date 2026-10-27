#!/usr/bin/env python3
"""
Convierte las fuentes de texto de content/<ruleset>/*.txt en un pack JSON para la app.

Formato de cada archivo:
  @class <Nombre> | hitDie <n> | caster <none|full|half|third|artificer|pact> | spell <ability|none> | saves <a> <b> | sublevel <n> | sublabel <texto>
  <nivel> | <feature> | <resumen> [{speed +N} o {speed +N cond}]
  @sub <Nombre> | <fuente>
  <nivel> | <feature> | <resumen>

Uso: python3 content/build_pack.py 2014   ->  public/packs/wiki-2014.json (la app lo carga sola)
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).parent
# {speed +10} {hp +2 level} {init +1 pb} {ac +1 cond}. level = nivel total (o de la clase en class features); pb = proficiency bonus.
# Abilities: {str +4 max24} sube el score sobre el límite normal de 20 (Primal Champion, Body and Mind).
EFFECT = re.compile(r"\{(speed|init|ac|pperc|pinv|pins|hp|acarmor|atkranged|dmgduel|dmgthrown|unarmed|gwf|twf|str|dex|con|int|wis|cha)\s*([+-]\d+)(\s+(?:level|pb))?(\s+max\d+)?(\s+cond)?\}")
TARGET = {"speed": "speed", "init": "initiative", "ac": "ac", "pperc": "passive-perception", "pinv": "passive-investigation", "pins": "passive-insight",
          "hp": "hp", "acarmor": "ac-armor", "atkranged": "attack-ranged", "dmgduel": "damage-dueling", "dmgthrown": "damage-thrown",
          "unarmed": "unarmed-die", "gwf": "great-weapon-fighting", "twf": "two-weapon-fighting",
          **{a: f"score-{a}" for a in ("str", "dex", "con", "int", "wis", "cha")}}


def effects_of(text: str) -> list:
    out = []
    for m in EFFECT.finditer(text):
        e = {"target": TARGET[m.group(1)], "value": int(m.group(2)), "conditional": bool(m.group(5))}
        if m.group(3):
            e["scale"] = m.group(3).strip()
        if m.group(4):
            e["max"] = int(m.group(4).strip()[3:])
        out.append(e)
    return out


def parse_header(line: str) -> dict:
    parts = [p.strip() for p in line.split("|")]
    head = {"name": parts[0]}
    for p in parts[1:]:
        key, _, val = p.partition(" ")
        head[key] = val.strip()
    return head


GRANT = re.compile(r"\{(skill|expertise|skillpick|armor|weapons|tools|lang|toolpick|langpick|save|savepick|res|pick|resist)\s+([^}]*)\}")
# Spells de rasgos de raza: {spells Light; Faerie Fire long @3; Darkness long @5} {castwith cha}
SPELLTOK = re.compile(r"\{spells\s+([^}]*)\}")
CASTWITH = re.compile(r"\{castwith\s+(\w+)\}")
ABBR = ["str", "dex", "con", "int", "wis", "cha"]


def grant_tokens(text: str, where: str):
    """Tokens de un feature (ver README de content):
    {skill A, B} {expertise A, B} {skillpick 2 expertise [A, B]} {armor heavy} {weapons martial} {tools Smith's Tools}
    {lang Giant} {toolpick 1 artisan} {langpick 1} {save wis} {save all} {savepick 1 wis, int, cha}
    {res short 4@3,5@7,6@15 die:d8@3,d10@10 Superiority Dice}  {pick maneuvers 3@3,5@7 Maneuvers}"""
    grants, resources, choose = {}, [], None
    for m in GRANT.finditer(text):
        kind, arg = m.group(1), m.group(2).strip()
        if kind in ("skill", "expertise", "armor", "weapons", "tools"):
            key = {"skill": "skills"}.get(kind, kind)
            grants.setdefault(key, []).extend(csv(arg))
        elif kind == "lang":
            grants.setdefault("languages", []).extend(csv(arg))
        elif kind == "resist":
            grants.setdefault("resistances", []).extend(x.lower() for x in csv(arg))
        elif kind == "skillpick":
            bits = arg.split(None, 2)
            if bits[1] not in ("prof", "expertise", "either", "upgrade"):
                raise SystemExit(f"{where}: skillpick sin modo: {arg!r}")
            count = int(bits[0]) if bits[0].isdigit() else bits[0]
            # Entradas con + son tools que también se pueden elegir: {skillpick 2 upgrade +Thieves' Tools}
            items = csv(bits[2]) if len(bits) > 2 else []
            grants.setdefault("skillChoices", []).append(
                {"count": count, "mode": bits[1], "from": [x for x in items if not x.startswith("+")], "tools": [x[1:].strip() for x in items if x.startswith("+")]}
            )
        elif kind == "toolpick":
            bits = arg.split(None, 1)
            grants.setdefault("toolChoices", []).append({"count": int(bits[0]), "from": csv(bits[1]) if len(bits) > 1 else []})
        elif kind == "langpick":
            grants["languageChoices"] = int(arg)
        elif kind == "save":
            grants.setdefault("saves", []).extend(ABBR if arg == "all" else csv(arg))
        elif kind == "savepick":
            bits = arg.split(None, 1)
            grants.setdefault("saveChoices", []).append({"count": int(bits[0]), "from": csv(bits[1]) if len(bits) > 1 else ABBR})
        elif kind == "res":
            bits = arg.split()
            rest, uses, rest_bits = bits[0], bits[1], bits[2:]
            die = ""
            if rest_bits and rest_bits[0].startswith("die:"):
                die = rest_bits.pop(0)[4:]
            if not rest_bits:
                raise SystemExit(f"{where}: res sin nombre: {arg!r}")
            resources.append({"name": " ".join(rest_bits), "uses": uses, "recharge": rest, "die": die})
        elif kind == "pick":
            bits = arg.split(None, 2)
            choose = {"list": bits[0], "count": bits[1], "label": bits[2] if len(bits) > 2 else ""}
    for k in ("saves",):
        if k in grants:
            bad = [x for x in grants[k] if x not in ABBR]
            if bad:
                raise SystemExit(f"{where}: save desconocido {bad}")
    return grants or None, resources, choose, GRANT.sub("", text)


def feature(line: str, where: str) -> dict:
    parts = [p.strip() for p in line.split("|", 2)]
    if len(parts) != 3:
        raise SystemExit(f"{where}: linea invalida: {line!r}")
    level = int(re.sub(r"\D", "", parts[0]))
    text = parts[2]
    effects = effects_of(text)
    text = EFFECT.sub("", text)
    grants, resources, choose, text = grant_tokens(text, where)
    resource = resources[0] if resources else None
    text = re.sub(r"\s{2,}", " ", text).strip()
    f = {"level": level, "name": parts[1], "text": text}
    if effects:
        f["effects"] = effects
    if grants:
        f["grants"] = grants
    if resource:
        f["resource"] = resource
    if choose:
        f["choose"] = choose
    return f


LEVEL_MARK = re.compile(r"(?:\b(\d+)(?:st|nd|rd|th)|\bLevel (\d+)):\s*")
LAND = re.compile(r"\b([A-Z][a-z]+): ([^.:]+?/[^.:]+?)(?=\.\s+[A-Z][a-z]+:|\s*\(|\.?$|\.\s*$)")


def spell_names(chunk: str) -> list:
    chunk = re.split(r"\.\s", chunk + " ", maxsplit=1)[0]
    out = []
    for n in chunk.split(","):
        n = re.sub(r"\(.*?\)", "", n).strip().rstrip(".").strip()
        if n:
            out.append(n)
    return out


def subclass_spells(features: list) -> list:
    """Listas de spells de subclass escritas en el texto del feature.
    'Always prepared. 1st: A, B. 3rd: C' o 'Level 3: A, B' = nivel de clase (always).
    'Expanded Spell List' de Warlock 2014 = nivel de spell (expanded).
    Circle of the Land: variantes 'Arctic: a, b / c, d / ...' para niveles 3, 5, 7 y 9."""
    out = []
    for f in features:
        name, text = f["name"], f["text"]
        if not re.search(r"(spells|magic|spell list)$", name, re.I):
            continue
        expanded = "expanded" in name.lower()
        if "choose a land" in text.lower():
            for m in LAND.finditer(text):
                for lvl, chunk in zip((3, 5, 7, 9), m.group(2).split("/")):
                    out.append({"level": lvl, "spells": spell_names(chunk), "mode": "always", "variant": m.group(1)})
            continue
        marks = list(LEVEL_MARK.finditer(text))
        for i, m in enumerate(marks):
            end = marks[i + 1].start() if i + 1 < len(marks) else len(text)
            names = spell_names(text[m.end():end])
            if names:
                out.append({"level": int(m.group(1) or m.group(2)), "spells": names, "mode": "expanded" if expanded else "always"})
    return out


def dedupe(features: list) -> list:
    """Quita repeticiones (features opcionales listados en cada nivel de ASI), salvo los ASI."""
    seen, out = set(), []
    for f in sorted(features, key=lambda x: x["level"]):
        key = f["name"].lower()
        if key in seen and not key.startswith(("ability score improvement", "additional discipline")):
            continue
        seen.add(key)
        out.append(f)
    return out


ABILITIES = ["str", "dex", "con", "int", "wis", "cha"]


def csv(v: str) -> list:
    return [x.strip() for x in v.split(",") if x.strip()]


def skill_choice(v: str):
    # "2 from Athletics, Acrobatics" o "1 from any"
    count, _, rest = v.partition(" from ")
    rest = rest.strip()
    return {"count": int(count), "from": [] if rest in ("", "any") else csv(rest)}


def parse_profs(v: str) -> dict:
    out = {"armor": [], "weapons": [], "tools": [], "skills": None}
    for part in [x.strip() for x in v.split("|")]:
        key, _, val = part.partition(" ")
        if key in ("armor", "weapons", "tools"):
            out[key] = csv(val)
        elif key == "skills":
            out["skills"] = skill_choice(val)
    return out


def head_fields(line: str):
    parts = [p.strip() for p in line.split(" | ")]
    fields = {}
    for p in parts[1:]:
        key, _, val = p.partition(" ")
        fields[key] = val.strip()
    return parts[0], parts, fields


def entry_body(entry: dict, line: str, where: str):
    if line.startswith("- "):
        name, _, text = line[2:].partition(" | ")
        effects = effects_of(text)
        text = EFFECT.sub("", text)
        grants, resources, _, text = grant_tokens(text, where)
        trait = {"name": name.strip(), "effects": effects}
        m = SPELLTOK.search(text)
        if m:
            trait["spells"] = [feat_spell(x.strip()) for x in m.group(1).split(";") if x.strip()]
            text = SPELLTOK.sub("", text)
        m = CASTWITH.search(text)
        if m:
            trait["spellAbility"] = m.group(1)
            text = CASTWITH.sub("", text)
        if grants:
            trait["grants"] = grants
        if resources:
            trait["resources"] = resources
        trait["text"] = re.sub(r"\s{2,}", " ", text).strip()
        entry.setdefault("traits", []).append(trait)
    else:
        effects = effects_of(line)
        if effects:
            entry.setdefault("effects", []).extend(effects)
        text = EFFECT.sub("", line).strip()
        entry["text"] = (entry.get("text", "") + ("\n\n" if entry.get("text") else "") + text).strip()


def species_entry(name, parts, f):
    e = {"name": name, "size": f.get("size", "Medium"), "speed": int(f.get("speed", 30)), "darkvision": int(f.get("darkvision", 0) or 0)}
    asi = {"fixed": {}, "choose": []}
    for tok in f.get("asi", "").split():
        ab, amt = tok[:3], tok[3:]
        asi["fixed"][ab] = int(amt)
    if "choose" in f:
        for spec in f["choose"].split(";"):
            spec = spec.strip()
            ca, _, frm = spec.partition(" from ")
            count, amount = ca.split("x")
            asi["choose"].append({"count": int(count), "amount": int(amount), "from": ABILITIES if frm.strip() in ("", "any") else csv(frm)})
    e["asi"] = asi
    if "skills" in f:
        e["skills"] = csv(f["skills"])
    if "skillchoice" in f:
        e["skillChoices"] = skill_choice(f["skillchoice"])
    profs = {k: csv(f[k]) for k in ("armor", "weapons", "tools") if k in f}
    if profs:
        e["proficiencies"] = {"armor": [], "weapons": [], "tools": [], "skills": None, **profs}
    if "lang" in f:
        e["languages"] = csv(f["lang"])
    if "feat" in parts:
        e["originFeat"] = True
    if "source" in f:
        e["source"] = f["source"]
    return e


def background_entry(name, parts, f):
    e = {"name": name}
    if "skills" in f:
        e["skills"] = csv(f["skills"])
    if "skillchoice" in f:
        e["skillChoices"] = skill_choice(f["skillchoice"])
    if "tools" in f:
        e["tools"] = csv(f["tools"])
    if "lang" in f:
        e["languages"] = csv(f["lang"])
    if "asi" in f:
        e["asi"] = csv(f["asi"])
    if "feat" in f:
        e["feat"] = f["feat"]
    if "equipment" in f:
        e["equipment"] = f["equipment"]
    if "source" in f:
        e["source"] = f["source"]
    return e


def feat_entry(name, parts, f):
    e = {"name": name, "category": f.get("cat", "general")}
    if "prereq" in f:
        e["prerequisite"] = f["prereq"]
    if "level" in f:
        e["minLevel"] = int(f["level"])
    if "asi" in f:
        e["asi"] = {"amount": 1, "from": ABILITIES if f["asi"] == "any" else csv(f["asi"])}
    if "repeatable" in parts:
        e["repeatable"] = True
    if "saveasi" in parts:
        e["saveFromAsi"] = True
    # skills <n> <prof|expertise|either> [skill, skill...]; varias separadas por ;
    if "skills" in f:
        e["skills"] = []
        for g in f["skills"].split(";"):
            bits = g.strip().split(None, 2)
            e["skills"].append({"count": int(bits[0]), "mode": bits[1], "from": csv(bits[2]) if len(bits) > 2 else []})
    # spells <item>; <item>   item: "Misty Step long" | "pick 1 L1 divination,enchantment long" | "pick 2 L0 list:Bard,Wizard" | "pick 1 L0 attack list:..."
    if "spells" in f:
        e["spells"] = [feat_spell(x.strip()) for x in f["spells"].split(";") if x.strip()]
    if "castwith" in f:
        e["spellAbility"] = f["castwith"]
    if "source" in f:
        e["source"] = f["source"]
    return e


def feat_spell(item: str) -> dict:
    min_level = 1
    m = re.search(r"\s+@(\d+)$", item)
    if m:
        min_level = int(m.group(1))
        item = item[: m.start()]
    out = _feat_spell(item)
    if min_level > 1:
        out["minLevel"] = min_level
    return out


def _feat_spell(item: str) -> dict:
    uses = "none"
    m = re.search(r"\s+(long|short|will)$", item)
    if m:
        uses = m.group(1)
        item = item[: m.start()]
    if not item.startswith("pick "):
        return {"spell": item.strip(), "uses": uses}
    bits = item.split()
    out = {"count": int(bits[1]), "level": int(bits[2][1:]), "uses": uses, "schools": [], "lists": [], "attackOnly": False, "ritualOnly": False}
    for b in bits[3:]:
        if b == "attack":
            out["attackOnly"] = True
        elif b == "ritual":
            out["ritualOnly"] = True
        elif b.startswith("list:"):
            out["lists"] = [x for x in b[5:].split(",") if x]
        else:
            out["schools"] = [x.strip().title() for x in b.split(",") if x.strip()]
    return out


def invocation_entry(name, parts, f):
    e = {"name": name}
    if "prereq" in f:
        e["prerequisite"] = f["prereq"]
    if "level" in f:
        e["minLevel"] = int(f["level"])
    if "pact" in f:
        e["pact"] = f["pact"]
    if "repeatable" in parts:
        e["repeatable"] = True
    if "spells" in f:
        e["spells"] = [feat_spell(x.strip()) for x in f["spells"].split(";") if x.strip()]
        e["spellAbility"] = f.get("castwith", "cha")
    if "source" in f:
        e["source"] = f["source"]
    return e


def weapon_entry(name, parts, f):
    # @weapon Longsword | martial melee | 1d8 slashing | versatile 1d10 | props versatile | mastery Sap | range 20/60 | cost 15 gp | weight 3
    cat, rng = parts[1].split()
    dice, dtype = parts[2].split(" ", 1)
    w = {"category": cat, "range": rng, "damage": dice, "damageType": dtype, "properties": csv(f.get("props", ""))}
    if "versatile" in f:
        w["versatile"] = f["versatile"]
    if "mastery" in f:
        w["mastery"] = f["mastery"]
    if "range" in f:
        n, l = f["range"].split("/")
        w["normalRange"], w["longRange"] = int(n), int(l)
    return {"name": name, "kind": "weapon", "category": f"{cat.title()} {'Melee' if rng == 'melee' else 'Ranged'} Weapons", "cost": f.get("cost", ""), "weight": float(f.get("weight", 0) or 0), "weapon": w}


def armor_entry(name, parts, f):
    cat = parts[1]
    a = {"category": cat, "ac": int(f["ac"]), "dexMax": None, "strength": None, "stealthDisadvantage": "stealth" in parts}
    if "dex" in f:
        a["dexMax"] = int(f["dex"])
    if "str" in f:
        a["strength"] = int(f["str"])
    label = "Shield" if cat == "shield" else f"{cat.title()} Armor"
    return {"name": name, "kind": "armor", "category": label, "cost": f.get("cost", ""), "weight": float(f.get("weight", 0) or 0), "armor": a}


def option_entry(lst, parts, f):
    # @option maneuvers | Ambush | listname Maneuvers | prereq ... | level 3
    if len(parts) < 2:
        raise SystemExit("option sin nombre")
    e = {"list": lst, "name": parts[1]}
    if "listname" in f:
        e["listName"] = f["listname"]
    if "prereq" in f:
        e["prerequisite"] = f["prereq"]
    if "level" in f:
        e["minLevel"] = int(f["level"])
    return e


def simple_item(kind):
    def make(name, parts, f):
        return {"name": name, "kind": kind, "category": f.get("cat", ""), "cost": f.get("cost", ""), "weight": float(f.get("weight", 0) or 0)}
    return make


GENERIC = {
    "@species ": ("species", species_entry),
    "@background ": ("backgrounds", background_entry),
    "@feat ": ("feats", feat_entry),
    "@invocation ": ("invocations", invocation_entry),
    "@weapon ": ("items", weapon_entry),
    "@armor ": ("items", armor_entry),
    "@gear ": ("items", simple_item("gear")),
    "@tool ": ("items", simple_item("tool")),
    "@option ": ("options", option_entry),
}


def build_generic(ruleset: str) -> dict:
    out = {k: [] for k in ("species", "backgrounds", "feats", "invocations", "items", "options")}
    for path in sorted((ROOT / ruleset).glob("_*.txt")):
        current = None
        for n, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            where = f"{path.name}:{n}"
            for prefix, (bucket, fn) in GENERIC.items():
                if line.startswith(prefix):
                    name, parts, fields = head_fields(line[len(prefix):])
                    try:
                        current = fn(name, parts, fields)
                    except Exception as ex:  # noqa: BLE001
                        raise SystemExit(f"{where}: {ex}: {line!r}")
                    out[bucket].append(current)
                    break
            else:
                if current is None:
                    raise SystemExit(f"{where}: texto fuera de una entrada")
                entry_body(current, line, where)
    # Las opciones pueden dar proficiencies con los mismos tokens que los features.
    for o in out["options"]:
        grants, _, _, text = grant_tokens(o.get("text", ""), f"opción {o['name']}")
        o["text"] = re.sub(r"\s{2,}", " ", text).strip()
        if grants:
            o["grants"] = grants
    # Los feats también: Heavily Armored da heavy armor, Chef da Cook's Utensils...
    for f in out["feats"]:
        grants, resources, choose, text = grant_tokens(f.get("text", ""), f"feat {f['name']}")
        f["text"] = re.sub(r"\s{2,}", " ", text).strip()
        if grants:
            f["grants"] = grants
        if resources:
            f["resources"] = resources
        if choose:
            f["choose"] = choose
    return out


SCHOOLS = {k[:3].lower(): k for k in ("Abjuration", "Conjuration", "Divination", "Enchantment", "Evocation", "Illusion", "Necromancy", "Transmutation")}
CLASSES = {"art": "Artificer", "brd": "Bard", "clr": "Cleric", "drd": "Druid", "pal": "Paladin", "rgr": "Ranger", "sor": "Sorcerer", "wlk": "Warlock", "wiz": "Wizard"}


def spell_line(level: int, line: str, where: str) -> dict:
    """Name | school | casting time | range | components | duration | clases | fuente"""
    parts = [p.strip() for p in line.split("|")]
    if len(parts) != 8:
        raise SystemExit(f"{where}: se esperaban 8 campos: {line!r}")
    name, school, time, rng, comp, dur, classes, source = parts
    sch = SCHOOLS.get(school[:3].lower())
    if not sch:
        raise SystemExit(f"{where}: school desconocida {school!r}")
    ritual = bool(re.search(r"\bor R$|^R$|\(R\)", time))
    time = re.sub(r"\s*(or R|\(R\))$", "", time).replace("(*)", "").strip()
    material = ""
    m = re.search(r"M\s*\((C\*?)\)", comp)
    if m:
        material = "Con costo, se consume" if m.group(1) == "C*" else "Con costo"
        comp = re.sub(r"M\s*\(C\*?\)", "M", comp)
    conc = bool(re.match(r"^C\b[, ]", dur))
    if conc:
        dur = "Concentration, " + re.sub(r"^C,?\s*", "", dur)
    cls = []
    for c in ([] if classes.strip() == "-" else csv(classes)):
        k = CLASSES.get(c[:3].lower())
        if not k:
            raise SystemExit(f"{where}: clase desconocida {c!r}")
        cls.append(k)
    return {
        "name": name, "level": level, "school": sch, "classes": cls, "castingTime": time, "range": rng,
        "components": comp, "material": material, "duration": dur, "concentration": conc, "ritual": ritual,
        "text": "", "higher": "", "source": source,
    } if classes.strip() != "-" else {
        "name": name, "level": level, "school": sch, "classes": ["-"], "castingTime": time, "range": rng,
        "components": comp, "material": material, "duration": dur, "concentration": conc, "ritual": ritual,
        "text": "", "higher": "", "source": source,
    }


ABIL = {"strength": "str", "dexterity": "dex", "constitution": "con", "intelligence": "int", "wisdom": "wis", "charisma": "cha"}
DMG = re.compile(r"(\d+d\d+(?:\s*\+\s*(?:\d+|your spellcasting (?:ability )?modifier))?)\s+(?:damage\s+of\s+a\s+type[^.,;]*|([A-Za-z]+)(?:\s+or\s+[A-Za-z]+)?\s+damage)", re.I)


def combat_info(sp: dict):
    """Ataque, save y daño base para la tarjeta de Ataques (solo si el resumen los trae)."""
    t = sp["text"]
    atk = re.search(r"\b(melee|ranged) spell attack|hits? automatically", t, re.I)
    sv = re.search(r"\b(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) sav(?:e|ing throw)", t)
    dm = DMG.search(t)
    if not dm or not (atk or sv):
        return
    dice = re.sub(r"\s+", " ", dm.group(1)).replace("your spellcasting ability modifier", "mod").replace("your spellcasting modifier", "mod")
    kind = (dm.group(2) or "").lower()
    if kind in ("extra", "the", "that", "same", "normal", "more", "half", "any", "weapon"):
        kind = ""
    if not kind and "type you choose" in dm.group(0).lower():
        kind = "a elección"
    sp["attack"] = (atk.group(1) or "auto").lower() if atk else None
    sp["save"] = ABIL[sv.group(1).lower()] if sv and not atk else (ABIL[sv.group(1).lower()] if sv and sv.start() < atk.start() else None)
    sp["damage"] = f"{dice} {kind}".strip()
    if sp["level"] == 0:
        h = sp["higher"].lower()
        sp["scaling"] = "beams" if "beam" in h else ("dice" if re.search(r"\b2d\d+|two dice|dice rise", h) else "none")


def spell_lists(ruleset: str) -> dict:
    """content/<ruleset>/spell-lists/<clase>.txt con líneas 'L<n>: a; b; c'. Devuelve nombre -> clases."""
    out = {}
    d = ROOT / ruleset / "spell-lists"
    for path in sorted(d.glob("*.txt")) if d.exists() else []:
        cls = {v.lower(): v for v in CLASSES.values()}[path.stem.lower()]
        for raw in path.read_text(encoding="utf-8").splitlines():
            if ":" not in raw:
                continue
            for name in raw.split(":", 1)[1].split(";"):
                name = name.strip()
                if name:
                    out.setdefault(norm(name), []).append(cls)
    return out


def norm(name: str) -> str:
    return re.sub(r"[^a-z0-9]", "", name.lower().replace("power word:", "power word"))


def build_spells(ruleset: str) -> list:
    lists = spell_lists(ruleset)
    out, level, current = [], None, None
    for path in sorted((ROOT / ruleset / "spells").glob("*.txt")):
        for n, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            where = f"spells/{path.name}:{n}"
            if line.startswith("@level "):
                level = int(line[7:])
            elif line.startswith("+ "):
                if current is None:
                    raise SystemExit(f"{where}: + fuera de una spell")
                current["higher"] = line[2:].strip()
            elif "|" in line and line.count("|") == 7:
                if level is None:
                    raise SystemExit(f"{where}: falta @level")
                current = spell_line(level, line, where)
                out.append(current)
            else:
                if current is None:
                    raise SystemExit(f"{where}: texto fuera de una spell")
                current["text"] = (current["text"] + "\n\n" + line).strip()
    # Clases desde las listas de la wiki cuando la línea trae "-".
    if lists:
        for sp in out:
            if sp["classes"] == ["-"]:
                sp["classes"] = sorted(set(lists.get(norm(sp["name"]), [])))
        known = {norm(sp["name"]) for sp in out}
        missing = sorted(k for k in lists if k not in known)
        if missing:
            print(f"AVISO {ruleset}: en las listas pero sin spell: {missing}")
        empty = [sp["name"] for sp in out if not sp["classes"]]
        if empty:
            print(f"AVISO {ruleset}: spells sin clase: {empty}")
    for sp in out:
        combat_info(sp)
    names = [s["name"].lower() for s in out]
    dup = {x for x in names if names.count(x) > 1}
    if dup:
        raise SystemExit(f"spells repetidas en {ruleset}: {sorted(dup)}")
    return sorted(out, key=lambda s: (s["level"], s["name"]))


def build(ruleset: str) -> dict:
    classes, subclasses = [], []
    files = sorted(f for f in (ROOT / ruleset).glob("*.txt") if not f.name.startswith("_"))
    if not files:
        raise SystemExit(f"No hay archivos en content/{ruleset}/")
    for path in files:
        current = None
        cls = None
        for n, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            where = f"{path.name}:{n}"
            if line.startswith("@class "):
                h = parse_header(line[7:])
                saves = h.get("saves", "").split()
                spell = h.get("spell", "none")
                cls = {
                    "name": h["name"],
                    "hitDie": int(h["hitDie"]),
                    "caster": h["caster"],
                    "spellAbility": None if spell == "none" else spell,
                    "saves": saves,
                    "subclassLevel": int(h["sublevel"]),
                    "subclassLabel": h["sublabel"],
                    "features": [],
                }
                classes.append(cls)
                current = cls
            elif line.startswith("@prof ") or line.startswith("@mc "):
                if cls is None:
                    raise SystemExit(f"{where}: @prof antes de @class")
                key = "proficiencies" if line.startswith("@prof ") else "multiclass"
                cls[key] = parse_profs(line.split(" ", 1)[1])
            elif line.startswith("@sub "):
                if cls is None:
                    raise SystemExit(f"{where}: @sub antes de @class")
                h = parse_header(line[5:])
                sub = {"class": cls["name"], "name": h["name"], "features": []}
                if "caster" in h:
                    kind, _, ability = h["caster"].partition(" ")
                    sub["caster"] = kind
                    sub["spellAbility"] = ability or None
                subclasses.append(sub)
                current = sub
            else:
                if current is None:
                    raise SystemExit(f"{where}: feature fuera de una clase")
                current["features"].append(feature(line, where))
        if cls:
            label = cls["subclassLabel"].lower()
            cls["features"] = [f for f in cls["features"] if f["name"].lower() != label]
            cls["features"].append(
                {
                    "level": cls["subclassLevel"],
                    "name": cls["subclassLabel"],
                    "text": f"Choose your {cls['subclassLabel']}. Its features appear grouped under the subclass.",
                }
            )
    for c in classes:
        c["features"] = dedupe(c["features"])
    for s in subclasses:
        s["features"] = sorted(s["features"], key=lambda x: x["level"])
        sp = subclass_spells(s["features"])
        if sp:
            s["spells"] = sp
    return {
        "$schema": "./pack.schema.json",
        "format": "cuts5e-pack",
        "version": 1,
        "pack": {
            "id": f"wiki-{ruleset}",
            "name": f"Wiki 5e {ruleset} (resumen)",
            "ruleset": ruleset,
            "homebrew": False,
            "built": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        },
        "classes": classes,
        "subclasses": subclasses,
        **build_generic(ruleset),
        "spells": build_spells(ruleset),
    }


if __name__ == "__main__":
    ruleset = sys.argv[1] if len(sys.argv) > 1 else "2014"
    pack = build(ruleset)
    out = ROOT.parent / "public" / "packs" / f"wiki-{ruleset}.json"
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps(pack, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    nf = sum(len(c["features"]) for c in pack["classes"]) + sum(len(s["features"]) for s in pack["subclasses"])
    extra = ", ".join(f"{len(pack[k])} {k}" for k in ("species", "backgrounds", "feats", "invocations", "items", "spells", "options"))
    print(f"{out}: {len(pack['classes'])} clases, {len(pack['subclasses'])} subclasses, {nf} features, {extra}")
