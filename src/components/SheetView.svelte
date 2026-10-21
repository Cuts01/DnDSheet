<script lang="ts">
  import { t } from '../lib/i18n.svelte';
  import { store } from '../lib/store.svelte';
  import { ABILITIES } from '../lib/model/character';
  import { abilityMod, fmt, passive, saveBonus, score, skillBonus, skillLevel } from '../lib/rules/derive';
  import { ABILITY_LABEL, SKILLS } from '../lib/rules/tables';
  import { compendium } from '../lib/compendium.svelte';
  import { allGrantedEffects } from '../lib/rules/features';

  const c = $derived(store.c);
  const granted = $derived(allGrantedEffects(c, compendium.packs));
  const mark = { none: '', prof: '●', expertise: '◆' } as const;
</script>

<section class="sheet">
  <div class="card abil-card">
    <h2>{t('Abilities y saves')}</h2>
    <div class="abilities">
      {#each ABILITIES as a (a)}
        {@const prof = c.saves.includes(a)}
        <div class="ab">
          <span class="ab-name">{ABILITY_LABEL[a]}</span>
          <b class="ab-mod num">{fmt(abilityMod(c, a))}</b>
          <span class="ab-score num">{score(c, a)}</span>
          <span class="ab-save num" class:prof>
            <span class="dot" aria-hidden="true">{prof ? '●' : '○'}</span>
            Save {fmt(saveBonus(c, a))}
          </span>
        </div>
      {/each}
    </div>
    <div class="passives">
      <span>Passive Perception <b class="num">{passive(c, 'perception', granted)}</b></span>
      <span>Passive Insight <b class="num">{passive(c, 'insight', granted)}</b></span>
      <span>Passive Investigation <b class="num">{passive(c, 'investigation', granted)}</b></span>
    </div>
  </div>

  <div class="card skills-card">
    <h2>Skills</h2>
    <ul class="skills">
      {#each SKILLS as s (s.id)}
        {@const lvl = skillLevel(c, s)}
        <li class:active={lvl !== 'none'}>
          <span class="mark" aria-label={lvl}>{mark[lvl]}</span>
          <span class="sk-name">{s.name}</span>
          <span class="sk-ab muted">{ABILITY_LABEL[s.ability]}</span>
          <b class="num">{fmt(skillBonus(c, s))}</b>
        </li>
      {/each}
    </ul>
    <p class="muted small legend">● proficient · ◆ expertise</p>
  </div>
</section>

<style>
  .sheet {
    display: grid;
    gap: var(--gap);
  }
  @container (min-width: 620px) {
    .sheet {
      grid-template-columns: 1fr 1fr;
      align-items: start;
    }
  }

  .abilities {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
  .ab {
    background: var(--surface-2);
    border-radius: 12px;
    padding: 10px 6px 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }
  .ab-name {
    font-size: 0.75rem;
    letter-spacing: 0.08em;
    color: var(--muted);
    font-weight: 650;
  }
  .ab-mod {
    font-size: 1.8rem;
    line-height: 1.1;
  }
  .ab-score {
    font-size: 0.85rem;
    background: var(--bg);
    border-radius: 999px;
    padding: 1px 10px;
  }
  .ab-save {
    margin-top: 6px;
    font-size: 0.8rem;
    color: var(--muted);
  }
  .ab-save.prof {
    color: var(--accent);
    font-weight: 600;
  }
  .passives {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: 12px;
    font-size: 0.9rem;
  }
  .passives span {
    display: flex;
    justify-content: space-between;
  }

  .skills {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .skills li {
    display: grid;
    grid-template-columns: 22px 1fr auto 44px;
    align-items: center;
    gap: 8px;
    min-height: 40px;
    border-bottom: 1px solid var(--line);
  }
  .skills li:last-child {
    border-bottom: none;
  }
  .skills li.active .sk-name {
    color: var(--accent);
  }
  .mark {
    color: var(--accent);
    text-align: center;
  }
  .sk-ab {
    font-size: 0.75rem;
  }
  .skills b {
    text-align: right;
  }
  .legend {
    margin: 8px 0 0;
  }
</style>
