# Hoja 5e

Hoja de personaje personal para D&D 5e. PWA instalable, mobile-first, 100% offline. Pensada para teléfono Android y Galaxy Tab S9.

El código no incluye contenido propietario. Las únicas tablas incluidas son mecánicas genéricas (proficiency bonus, spell slots, Pact Magic, cantrips y spells por nivel). Clases, spells, feats, Eldritch Invocations y rasgos se importan como packs JSON desde la app.

## Etapa 1 (esta versión)

- Ability scores, modifiers, proficiency bonus, saves y skills (proficient y expertise) con cálculo automático.
- HP actual, máximo y temporales. Daño que consume primero los temp HP.
- AC por modo (sin armadura, Mage Armor, light, medium, heavy o manual), shield y bonus. Initiative y speed.
- Multiclass: spell slots (tabla de Multiclass Spellcaster) y Pact slots por separado.
- Spell attack y spell save DC por clase.
- Hit Dice por tipo de dado.
- Short Rest: gasta Hit Dice con tu tirada (o maximizados), recupera Pact slots y recursos de Short Rest, y aplica Arcane Recovery si tienes niveles de Wizard.
- Long Rest: HP completo, todos los slots y recursos. Hit Dice: la mitad en 2014, todos en 2024.
- Recursos genéricos con usos (feats, Bladesong, Channel Divinity, items...).
- Layout adaptativo: una columna con pestañas en teléfono; dos o tres columnas en la tablet. También funciona en pantalla dividida o ventana de DeX, porque depende del ancho real de la ventana.
- Autoguardado en IndexedDB y almacenamiento persistente.
- Exportar, compartir e importar el personaje en JSON (validado con Zod).

## Constructor de personaje (Etapa 3)

- Raza o species y background elegidos de los packs. Aplican speed, tamaño, darkvision, incrementos de ability, skills y proficiencies.
- Ability scores con point buy (27 puntos), standard array o manual. Los incrementos de raza, background, ASI y feats se suman solos.
- Cada nivel de ASI: subir abilities (+2 o +1/+1) o tomar un feat, con su +1 si es half-feat. En 2024, el nivel 19 es Epic Boon.
- Origin feats de raza o background y feats adicionales.
- Eldritch Invocations con el límite por nivel de Warlock y filtro por nivel y Pact Boon.
- Skills a elegir según clase, raza y background; armor, weapon, tool y language proficiencies calculadas.
- Pestaña Equipo: inventario, monedas, peso y attunement. La armor y el shield equipados calculan el AC, y las weapons equipadas generan ataques con to-hit y daño.
- Efectos automáticos de speed, initiative, AC y passives desde features, feats y razas (ej. Alert +5 initiative, Mobile +10 speed, Observant +5 passive Perception e Investigation).
- Feats que otorgan skills (Skilled, Skill Expert, Observant y Keen Mind 2024, Prodigy) muestran su selección en Proficiencies. Las skills fijas repetidas de raza o background se pueden cambiar por otra.

## Spells

- Pestaña Spells (aparece si alguna clase lanza spells): ataque y DC por clase, cantrips y spells preparadas o conocidas contra el límite de la clase (tablas 2014 y 2024), y los slots.
- Agregar desde la lista de tu clase (filtrada hasta el nivel máximo que puedes aprender), desde todas las listas (para feats o subclasses) o a mano.
- Cada spell muestra casting time, range, components, duration, school, resumen y mejora con slot mayor. Marca de preparada, "siempre preparada" y notas.
- Spells de subclass (Domain, Oath, Circle, Patron, Artificer specialists, rangers y sorcerers que las tengan): aparecen solas con ★ al llegar al nivel, siempre preparadas y sin contar para el límite. Circle of the Land pide el terreno. El Expanded Spell List de Warlock 2014 se suma a la lista de Agregar.
- Spells de feats (Fey Touched, Shadow Touched, Magic Initiate, Telepathic, Telekinetic, Artificer Initiate, Spell Sniper y feats raciales): las fijas aparecen solas y las de elección se eligen en una tarjeta en Spells. Se lanzan con la ability del feat, no cuentan para el límite y tienen su uso gratis por Long o Short Rest, que se recupera solo al descansar. En los packs: `| spells Misty Step long; pick 1 L1 divination,enchantment long | castwith asi`.
- Pact Boons e Eldritch Invocations con spells (Pact of the Chain da Find Familiar, Armor of Shadows da Mage Armor a voluntad, Pact of the Tome pide sus cantrips) se agregan igual que las de feats.
- No deja agregar más cantrips ni spells conocidas que las que permite la clase, ni preparar de más.
- Las spells de daño que puedes lanzar aparecen en la tarjeta de Ataques de Combate con to-hit o DC y daño. Los cantrips escalan solos en los niveles 5, 11 y 17, y Eldritch Blast suma CHA si tienes Agonizing Blast.
- Lanzar: eliges el slot (o Pact slot, o ritual) y se descuenta. Las spells con concentration quedan marcadas en Combate y Spells hasta que las terminas o haces Long Rest.

## Varios personajes

La app guarda todos los personajes que quieras en el dispositivo. Toca el nombre arriba (o ve a Datos > Personajes) para cambiar de personaje, crear uno nuevo, duplicarlo o borrarlo. Importar un respaldo lo agrega como personaje nuevo, o reemplaza al que tenga el mismo nombre.

## Idioma

En Datos > Idioma se cambia entre Español e English. Los términos de D&D quedan en inglés en ambos. Los textos de la app pasan por `t()` (`src/lib/i18n.svelte.ts`): la clave es el texto en español y la traducción vive en `src/lib/i18n/en.ts`. Un test revisa que todo texto nuevo tenga su traducción.

## Stack

Svelte 5 (runes) + TypeScript, Vite, vite-plugin-pwa (Workbox), Dexie (IndexedDB), Zod y Vitest.

## Uso local

Requiere Node 20 o superior.

```bash
npm install
npm run dev        # servidor de desarrollo
npm test           # tests del motor de reglas
npm run check      # chequeo de tipos
npm run build      # build de producción en dist/
npm run preview    # sirve dist/ en http://localhost:4173
```

Los packs de la wiki (`public/packs/wiki-2014.json` y `wiki-2024.json`) vienen con la app: al abrirla con conexión se importan solos si faltan o si hay una versión más nueva. Datos > Contenido también tiene el botón **Actualizar packs de la wiki**.

Para probar desde el teléfono en tu red: `npm run dev -- --host` y abre la IP que muestra. Ojo: por HTTP en la red local la app funciona, pero no se puede instalar ni usa service worker. Para instalarla hace falta HTTPS.

## App publicada

https://cuts01.github.io/DnDSheet/ (se actualiza sola en cada push a `main`).

## Publicar en GitHub Pages

1. Crea un repositorio en GitHub (puede ser privado si tu plan lo permite para Pages; si no, público: solo contiene código).
2. Sube el proyecto a la rama `main`.
3. En el repo: Settings > Pages > Build and deployment > Source: **GitHub Actions**.
4. El workflow `.github/workflows/deploy.yml` corre los tests, hace el build y publica. La URL queda como `https://TU-USUARIO.github.io/NOMBRE-DEL-REPO/`.

La config usa `base: './'`, así que funciona en cualquier subruta sin cambios.

## Instalar en Android y en la Tab S9

1. Abre la URL en **Chrome**.
2. Menú de tres puntos > **Instalar app** (o "Agregar a pantalla principal").
3. Ábrela una vez con internet para que el service worker guarde todo. Desde ahí funciona sin conexión.

Cada dispositivo (y cada navegador) tiene sus propios datos. Usa siempre el mismo navegador e instálala desde Chrome en ambos equipos.

## Pasar el personaje entre teléfono y tablet

Datos > **Compartir...** abre el menú nativo de Android (Quick Share, Drive, etc.). En el otro equipo: Datos > **Importar JSON**. También puedes usar **Exportar JSON**, que descarga el archivo.

Exporta un respaldo antes de borrar datos del navegador o desinstalar la app.

## Estructura

```
src/
  lib/model/character.ts   esquema Zod del personaje, presets de clases y personaje inicial
  lib/rules/tables.ts      skills y tablas de slots (SRD)
  lib/rules/derive.ts      cálculos derivados (funciones puras)
  lib/rules/rests.ts       daño, curación, Short Rest y Long Rest (funciones puras)
  lib/rules/rules.test.ts  tests
  lib/db.ts                IndexedDB con Dexie
  lib/store.svelte.ts      estado reactivo y autoguardado
  lib/io.ts                exportar, compartir e importar
  components/              vistas: Combate, Hoja, Editar, Datos y el diálogo de Short Rest
```

El personaje guarda solo lo que eliges y lo que gastaste. Todo lo demás (mods, PB, slots máximos, DC) se calcula, así que cambiar un nivel o un stat actualiza la hoja completa.

## Packs de contenido (clases, subclasses y class features)

La app no trae contenido incluido en el código: se carga desde packs JSON que importas en **Datos > Contenido**. Puedes importar varios (2014, 2024, homebrew). Un pack con el mismo `pack.id` reemplaza al anterior.

- `public/packs/ejemplo-homebrew.json`: plantilla con una clase y dos subclasses inventadas.
- `public/packs/pack.schema.json`: JSON Schema. Si tu pack tiene `"$schema": "./pack.schema.json"` y el schema está en la misma carpeta, VS Code te autocompleta y marca errores mientras lo escribes. Se regenera con `npm run schema`.

Formato resumido:

```json
{
  "$schema": "./pack.schema.json",
  "format": "cuts5e-pack",
  "version": 1,
  "pack": { "id": "mi-pack-2014", "name": "Mi pack 2014", "ruleset": "2014", "homebrew": false },
  "classes": [
    {
      "name": "Wizard", "hitDie": 6, "caster": "full", "spellAbility": "int", "saves": ["int", "wis"],
      "subclassLevel": 2, "subclassLabel": "Arcane Tradition",
      "features": [{ "level": 1, "name": "...", "text": "..." }]
    }
  ],
  "subclasses": [
    {
      "class": "Wizard", "name": "...",
      "features": [
        { "level": 2, "name": "...", "text": "...", "effects": [{ "target": "speed", "value": 10, "conditional": true }] }
      ]
    }
  ]
}
```

- `subclasses[].class` se compara con el nombre de la clase sin importar mayúsculas, así un pack homebrew puede agregar subclasses a clases de otro pack o de los presets.
- `effects` admite `speed`, `initiative`, `ac`, `passive-perception`, `passive-investigation` y `passive-insight`. `conditional: true` crea un botón en Combate para activarlo (por ejemplo, Bladesong); sin eso aplica siempre que tengas el feature.
- No pongas efectos para Unarmored Movement (Monk) ni Fast Movement (Barbarian): la app ya los calcula.
- `text` admite párrafos separados por una línea en blanco (`\n\n`).

## Packs de la wiki (content/)

`content/` tiene los packs armados a partir de dnd5e.wikidot.com (2014) y dnd2024.wikidot.com (2024), sin homebrew ni Unearthed Arcana. Las descripciones son resúmenes propios, no el texto de los libros. Se publican con la app.

- `public/packs/wiki-2014.json` y `public/packs/wiki-2024.json`: los genera `build_pack.py` y la app los carga sola.
- `content/2014/*.txt` y `content/2024/*.txt`: fuentes editables, una clase por archivo. Formato de clases: `nivel | nombre | resumen`. Razas, backgrounds, feats, invocations e items van en los archivos que empiezan con `_` (`@species`, `@background`, `@feat`, `@invocation`, `@weapon`, `@armor`, `@gear`, `@tool`). Efectos: `{speed +10 cond}`, `{init +5}`, `{ac +1}`, `{pperc +5}`, `{pinv +5}`, `{pins +5}`. Feats con skills: `| skills 1 either insight, perception` (modos `prof`, `expertise`, `either`; varias separadas por `;`).
- Spells: `content/<ruleset>/spells/*.txt`, una por línea `Nombre | school | casting time | range | components | duration | clases | fuente`, seguida del resumen y opcionalmente `+ mejora con slot mayor`. `or R` en casting time marca ritual, `C,` en duration marca concentration y `M(C)` / `M(C*)` material con costo o que se consume. En 2014 las clases se toman de `content/2014/spell-lists/` (listas de la wiki) cuando la línea dice `-`. Los items se regeneran con `python3 content/gen_items.py`.
- Regenerar: `python3 content/build_pack.py 2014` (o `2024`).

Si pegas el texto completo de un feature desde la wiki, reemplaza el resumen en el `.txt` y vuelve a generar el pack.

## Límites de reglas

- Nivel total máximo 20 (suma de todas las clases). Un respaldo con más niveles se recorta al importarlo, desde la última clase.

## Próximas etapas

- Spells de dominio, oath y patron agregadas solas según la subclass.
- Ataques de spells (Eldritch Blast, Fire Bolt) en la tarjeta de Ataques.
- Siguiente: editor de homebrew en la app y varios personajes.
