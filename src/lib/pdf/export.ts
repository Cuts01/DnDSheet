import type { Character } from '../model/character';
import type { Pack } from '../model/pack';
import { sheetData } from './sheetData';
import { campaigns } from '../campaigns.svelte';

/* Arma el PDF (pdf-lib se descarga recién aquí) y lo baja como archivo. */
export async function exportSheetPdf(c: Character, packs: Pack[]): Promise<string> {
  const { renderSheetPdf } = await import('./render');
  const camp = campaigns.get(c.campaignId);
  const bytes = await renderSheetPdf(sheetData(c, packs, { campaign: camp?.name, dayNames: camp?.calendar.dayNames }));
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
  const base = (c.name || 'personaje').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '') || 'personaje';
  const file = `${base}-hoja.pdf`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return file;
}
