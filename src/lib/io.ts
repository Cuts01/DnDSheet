import { CharacterSchema, type Character } from './model/character';

function fileName(c: Character) {
  const slug = c.name.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'personaje';
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
  return `${slug}-${stamp}.json`;
}

function toFile(c: Character): File {
  const json = JSON.stringify({ ...c, updatedAt: new Date().toISOString() }, null, 2);
  return new File([json], fileName(c), { type: 'application/json' });
}

export function downloadCharacter(c: Character) {
  const file = toFile(c);
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function canShareFiles(): boolean {
  try {
    const probe = new File(['{}'], 'x.json', { type: 'application/json' });
    return !!navigator.canShare?.({ files: [probe] });
  } catch {
    return false;
  }
}

/* Comparte el respaldo con el menu nativo de Android (Drive, Quick Share hacia la tablet, etc.). */
export async function shareCharacter(c: Character) {
  const file = toFile(c);
  await navigator.share({ files: [file], title: file.name });
}

export type ImportResult = { ok: true; character: Character } | { ok: false; errors: string[] };

export async function readCharacterFile(file: File): Promise<ImportResult> {
  let raw: unknown;
  try {
    raw = JSON.parse(await file.text());
  } catch {
    return { ok: false, errors: ['El archivo no es JSON válido.'] };
  }
  const parsed = CharacterSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.slice(0, 8).map((i) => `${i.path.join('.') || '(raiz)'}: ${i.message}`)
    };
  }
  return { ok: true, character: parsed.data };
}
