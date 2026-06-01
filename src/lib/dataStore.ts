import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

type ExamSet = { id: string; name: string };
type Section = { id: string; examSetId: string; name: string; position: number };
type Question = {
  id: string;
  sectionId: string;
  text: string;
  options: string[]; // e.g. ["A","B","C","D"]
  correctOption: string; // e.g. "A"
  marks?: number;
};

const dataDir = path.resolve(process.cwd(), 'src', 'data');

async function read<T>(file: string): Promise<T[]> {
  const fp = path.join(dataDir, file);
  const txt = await fs.readFile(fp, 'utf-8');
  return JSON.parse(txt) as T[];
}
async function write<T>(file: string, data: T[]): Promise<void> {
  const fp = path.join(dataDir, file);
  await fs.writeFile(fp, JSON.stringify(data, null, 2), 'utf-8');
}

export const examSetStore = {
  async all() { return read<ExamSet>('examSets.json'); },
  async get(id: string) {
    const all = await this.all();
    return all.find(s => s.id === id);
  },
  async create(name: string) {
    const all = await this.all();
    const newSet: ExamSet = { id: `set-${uuidv4().slice(0,8)}`, name };
    all.push(newSet);
    await write('examSets.json', all);
    // auto‑create three sections
    await sectionStore.bulkCreateForSet(newSet.id);
    return newSet;
  },
  async update(id: string, name: string) {
    const all = await this.all();
    const idx = all.findIndex(s => s.id === id);
    if (idx === -1) throw new Error('Set not found');
    all[idx].name = name;
    await write('examSets.json', all);
    return all[idx];
  },
  async remove(id: string) {
    // remove set
    const sets = await this.all();
    await write('examSets.json', sets.filter(s => s.id !== id));
    // cascade delete sections & questions
    await sectionStore.removeBySet(id);
  },
};

export const sectionStore = {
  async all() { return read<Section>('sections.json'); },
  async getBySet(setId: string) {
    const all = await this.all();
    return all.filter(s => s.examSetId === setId).sort((a, b) => a.position - b.position);
  },
  async bulkCreateForSet(setId: string) {
    const base = [
      { name: 'Numerical Reasoning', position: 1 },
      { name: 'Verbal Reasoning',    position: 2 },
      { name: 'Logical Reasoning',   position: 3 },
    ];
    const all = await this.all();
    base.forEach(b => {
      const sec: Section = {
        id: `${setId}-sec-${uuidv4().slice(0,4)}`,
        examSetId: setId,
        name: b.name,
        position: b.position,
      };
      all.push(sec);
    });
    await write('sections.json', all);
  },
  async removeBySet(setId: string) {
    const secs = await this.all();
    const toDelete = secs.filter(s => s.examSetId === setId).map(s => s.id);
    await write('sections.json', secs.filter(s => s.examSetId !== setId));
    await questionStore.removeBySectionIds(toDelete);
  },
};

export const questionStore = {
  async all() { return read<Question>('questions.json'); },
  async getBySection(sectionId: string) {
    const all = await this.all();
    return all.filter(q => q.sectionId === sectionId);
  },
  async create(sectionId: string, payload: Omit<Question, 'id' | 'sectionId'>) {
    const all = await this.all();
    const newQ: Question = { id: `q-${uuidv4().slice(0,8)}`, sectionId, ...payload };
    all.push(newQ);
    await write('questions.json', all);
    return newQ;
  },
  async update(id: string, payload: Partial<Omit<Question, 'id' | 'sectionId'>>) {
    const all = await this.all();
    const idx = all.findIndex(q => q.id === id);
    if (idx === -1) throw new Error('Question not found');
    all[idx] = { ...all[idx], ...payload };
    await write('questions.json', all);
    return all[idx];
  },
  async remove(id: string) {
    const all = await this.all();
    await write('questions.json', all.filter(q => q.id !== id));
  },
  async removeBySectionIds(sectionIds: string[]) {
    const all = await this.all();
    await write('questions.json', all.filter(q => !sectionIds.includes(q.sectionId)));
  },
};
