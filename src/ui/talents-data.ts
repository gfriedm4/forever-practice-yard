// Talent trees as data: every class's three trees in the order the talent
// strings use (gunba's trees, via tools/talent_layout.mjs), and helpers to
// read a build's talent string against them. One class at a time: a talent
// screen draws one, and all nine together are about 128 kB.
import { classKey } from './class-key';

export { classKey };

export interface LayoutTalent {
  key: string;
  name: string;
  row: number;
  col: number;
  max: number;
  icon: string | null;
  /** The talent it needs maxed first: [row, column] in the same tree. */
  req: [number, number] | null;
  /** Description with {0}-style holes, filled from the rank's values. */
  text: string;
  ranks: number[][];
}
export interface LayoutTree { name: string; icon: string; bg: string | null; talents: LayoutTalent[] }

/**
  * A loader per class, so each class's trees are a chunk of their own: a talent
  * screen fetches the 14 kB of the class it draws instead of the 128 kB of all
  * nine. Written out rather than found by a glob, so that the node checks in
  * tools/, which are bundled without Vite, can follow the imports too.
  */
const LAYOUTS: Record<string, () => Promise<{ default: unknown }>> = {
  warrior: () => import('./talent-layout/warrior.json'),
  paladin: () => import('./talent-layout/paladin.json'),
  hunter: () => import('./talent-layout/hunter.json'),
  rogue: () => import('./talent-layout/rogue.json'),
  priest: () => import('./talent-layout/priest.json'),
  shaman: () => import('./talent-layout/shaman.json'),
  mage: () => import('./talent-layout/mage.json'),
  warlock: () => import('./talent-layout/warlock.json'),
  druid: () => import('./talent-layout/druid.json'),
};

const layout: Record<string, LayoutTree[]> = {};

/** Whether a class has talent trees at all, without fetching any of them. */
export const hasLayout = (cls: string): boolean => cls in LAYOUTS;

/**
 * Reads in a class's talent trees; with no class, every class's, which only the
 * checks in tools/ want. Just the talent screens need this, so the yard does
 * not carry it: the picker loads it with a class, Settings when it opens, the
 * planner on its way in. Everything below needs it, so call this first.
 */
export async function loadLayout(cls?: string): Promise<void> {
  const want = cls === undefined ? Object.keys(LAYOUTS) : [cls];
  await Promise.all(want.map(async (c) => {
    if (layout[c] || !LAYOUTS[c]) return;
    layout[c] = (await LAYOUTS[c]()).default as LayoutTree[];
  }));
}

export const treesOf = (cls: string): LayoutTree[] => {
  const trees = layout[cls];
  // Loudly, rather than drawing empty trees: a caller that forgot to load this
  // class would otherwise read every build of it as having no talents at all.
  // A class that has no trees to begin with is simply empty.
  if (!trees && hasLayout(cls)) throw new Error(`the talent trees for ${cls} are not in yet: await loadLayout('${cls}') first`);
  return trees ?? [];
};

/** Points in each talent: trees split by '-', one digit per talent in the tree's order, trailing zeros left out. */
export function decode(cls: string, talentString: string): number[][] {
  const parts = talentString.split('-');
  return treesOf(cls).map((tree, i) => tree.talents.map((_, j) => Number(parts[i]?.[j] ?? 0) || 0));
}

export const pointsPerTree = (cls: string, talentString: string) => decode(cls, talentString).map((p) => p.reduce((a, b) => a + b, 0));

/** The tree with the most points: the build's specialisation. */
export function mainTree(cls: string, talentString: string): LayoutTree | null {
  const pts = pointsPerTree(cls, talentString);
  const trees = treesOf(cls);
  if (!trees.length) return null;
  return trees[pts.indexOf(Math.max(...pts))];
}

/** A talent's text at a rank (rank 1 for an untaken talent). */
export function describe(t: LayoutTalent, rank: number): string {
  const values = t.ranks[Math.max(0, Math.min(t.ranks.length, rank) - 1)] ?? [];
  return t.text.replace(/\{(\d+)\}/g, (_, i) => String(values[Number(i)] ?? '?'));
}
