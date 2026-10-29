// Entry point. Without ?class= the first screen picks a class and a build;
// with it, the practice yard loads (./yard.ts); ?planner= opens the talent
// planner (./ui/planner.ts). Each part is its own chunk.
import './style.css';

const app = document.getElementById('app')!;
const params = new URLSearchParams(location.search);
if (params.has('class')) {
  // The spec's chunk travels alongside the yard's rather than behind it: the
  // yard's is a quarter of a megabyte and asking for the spec is the first
  // thing it does, so it used to be asked for only once that had arrived and
  // run -- a whole round trip in front of everything. Asked for twice, the
  // browser fetches it once.
  void import('./specs/manifest.gen')
    .then(({ SPEC_LOADERS }) => SPEC_LOADERS[params.get('class')!]?.())
    .catch(() => { /* the yard asks again, and reports it if it fails there */ });
  void import('./yard');
} else if (params.has('planner')) {
  void import('./ui/planner').then((m) => m.showPlanner(app));
} else {
  void import('./ui/picker').then((m) => m.showPicker(app));
}
