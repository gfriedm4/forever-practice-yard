// The first screen: pick a class (WoW's class icons), then one of its builds,
// grouped by spec, with the build's talent trees drawn. Playing opens the yard
// at ?class=<spec>&build=<build>.
import { SPEC_META, type BuildMeta, type SpecMeta } from '../specs/manifest.gen';
import { DISCLAIMER_HTML, INSPIRATION_HTML, SUPPORT_HTML } from './disclaimer';
import { iconHtml } from './icon';
import { load } from './storage';
import { classKey } from './class-key';

/** WoW's class order and colours. */
export const CLASSES: { name: string; color: string }[] = [
  { name: 'Warrior', color: '#c79c6e' }, { name: 'Paladin', color: '#f58cba' }, { name: 'Hunter', color: '#abd473' },
  { name: 'Rogue', color: '#fff569' }, { name: 'Priest', color: '#ffffff' }, { name: 'Shaman', color: '#2a8cff' },
  { name: 'Mage', color: '#69ccf0' }, { name: 'Warlock', color: '#9482c9' }, { name: 'Druid', color: '#ff7d0a' },
];

const h = (tag: string, cls = '', html = '') => {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (html) el.innerHTML = html;
  return el;
};
const wowIcon = (name: string) => `<img class="wow-icon" src="${import.meta.env.BASE_URL}icons/${name}.jpg" alt="" draggable="false">`;
const split = (s: string) => s.split('-').map((t) => [...t].reduce((a, d) => a + Number(d), 0));

interface Group { title: string; icon: string | null; entries: { spec: SpecMeta; build: BuildMeta }[] }

/** A class's builds by spec; a class with one spec (rogue, warrior) is split by the tree each build puts most points in. */
async function groupsOf(className: string): Promise<Group[]> {
  // Only a chosen class needs its talent trees, so they load here and not on
  // the first screen, and only that class's (src/ui/talents-data.ts).
  const { loadLayout, mainTree } = await import('./talents-data');
  const specs = SPEC_META.filter((s) => s.className === className);
  const cls = classKey(className);
  await loadLayout(cls);
  const groups = new Map<string, Group>();
  for (const spec of specs) {
    for (const build of spec.builds) {
      const tree = build.talentString ? mainTree(cls, build.talentString) : null;
      const title = specs.length > 1 ? spec.specName : tree?.name ?? spec.specName;
      let g = groups.get(title);
      if (!g) groups.set(title, (g = { title, icon: tree?.icon ?? null, entries: [] }));
      g.entries.push({ spec, build });
    }
  }
  return [...groups.values()];
}

export function showPicker(app: HTMLElement): void {
  app.querySelector('.loading')?.remove();
  document.title = 'Forever Practice Yard · WoW Forever';
  const root = h('div', 'picker');
  app.append(root);
  const last = load<string>('fpy.class');
  const lastSpec = SPEC_META.find((s) => s.id === last);

  const showClasses = () => {
    root.innerHTML = '';
    root.append(h('h1', 'picker-title', 'Forever Practice Yard'),
      h('p', 'picker-sub', 'Practise your WoW Forever rotation against a training dummy. Choose your class.'),
      h('div', 'disclaimer-box', DISCLAIMER_HTML));
    const grid = h('div', 'class-grid');
    for (const c of CLASSES) {
      const count = SPEC_META.filter((s) => s.className === c.name).reduce((n, s) => n + s.builds.length, 0);
      if (!count) continue;
      const btn = h('button', 'class-card', `${iconHtml(`class_${classKey(c.name)}`)}<b style="color:${c.color}">${c.name}</b><small>${count} builds</small>`);
      btn.addEventListener('click', () => { void showBuilds(c.name, c.color); });
      grid.append(btn);
    }
    root.append(grid);
    if (lastSpec) {
      const spec = ['WoW Forever', lastSpec.className].includes(lastSpec.specName) ? '' : ` · ${lastSpec.specName}`;
      const again = h('a', 'hud-btn picker-last', `Continue: ${lastSpec.className}${spec}`) as HTMLAnchorElement;
      again.href = `?class=${lastSpec.id}`;
      root.append(again);
    }
    const planner = h('a', 'hud-btn picker-last', 'Talent planner') as HTMLAnchorElement;
    planner.href = `?planner=${load<string>('fpy.planner') ?? classKey(lastSpec?.className ?? 'warrior')}`;
    planner.title = "Any class's talent trees, with the level each point comes at and what WoW Forever changed";
    root.append(planner);
    root.append(h('p', 'picker-note', INSPIRATION_HTML));
    root.append(h('p', 'picker-note', `${SUPPORT_HTML}<br>Not affiliated with or endorsed by Blizzard Entertainment.`));
  };

  const showBuilds = async (className: string, color: string) => {
    const groups = await groupsOf(className);
    root.innerHTML = '';
    const back = h('button', 'hud-btn picker-back', '‹ Classes');
    back.addEventListener('click', showClasses);
    root.append(back, h('h1', 'picker-title', `${iconHtml(`class_${classKey(className)}`)}<span style="color:${color}">${className}</span>`),
      h('p', 'picker-sub', 'Choose a build. Each one brings its talents, gear, action bar and the sims\' priority list for the glow.'));
    for (const g of groups) {
      const sec = h('section', 'build-group');
      sec.append(h('h2', '', `${g.icon ? wowIcon(g.icon) : ''}${g.title}`));
      for (const { spec, build } of g.entries) {
        const card = h('div', 'build-card');
        const pts = build.talentString ? split(build.talentString).join('/') : '';
        const info = h('div', 'build-info', `<b>${build.name ?? build.label}</b><span>${pts}</span><small>${build.source ?? ''}</small>`);
        const talents = h('button', 'hud-btn small', 'Talents');
        const plan = h('a', 'hud-btn small', 'Planner') as HTMLAnchorElement;
        plan.href = `?planner=${classKey(className)}&spec=${spec.id}&build=${encodeURIComponent(build.id)}`;
        plan.title = 'Open these talents in the talent planner';
        const play = h('a', 'hud-btn small play', 'Play') as HTMLAnchorElement;
        play.href = `?class=${spec.id}&build=${encodeURIComponent(build.id)}`;
        const actions = h('div', 'build-actions');
        actions.append(talents, plan, play);
        const trees = h('div', 'build-trees hidden');
        talents.addEventListener('click', async () => {
          if (!trees.innerHTML && build.talentString) {
            const { talentTreesHtml } = await import('./talent-tree');
            trees.innerHTML = talentTreesHtml(classKey(className), build.talentString);
          }
          trees.classList.toggle('hidden');
          talents.classList.toggle('active', !trees.classList.contains('hidden'));
        });
        card.append(info, actions, trees);
        sec.append(card);
      }
      root.append(sec);
    }
    window.scrollTo(0, 0);
  };

  showClasses();
}
