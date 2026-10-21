/* Genera public/packs/pack.schema.json desde el esquema Zod. Uso: npm run schema */
import { writeFileSync } from 'node:fs';
import { z } from 'zod';
import { PackSchema } from '../src/lib/model/pack';

const schema = z.toJSONSchema(PackSchema, { io: 'input', unrepresentable: 'any' });
const out = { title: 'Hoja 5e content pack', ...schema };
writeFileSync('public/packs/pack.schema.json', JSON.stringify(out, null, 2) + '\n');
console.log('public/packs/pack.schema.json generado');
