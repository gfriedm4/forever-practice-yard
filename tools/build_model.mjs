// Builds public/models/human.glb: the Universal Animation Library 1 mannequin
// by Quaternius (CC0) with only the animations the practice yard uses, plus a
// few clips from UAL2 (same skeleton, same bone names).
//
// Usage: node tools/build_model.mjs [folder with the Quaternius downloads]
// (or set QUATERNIUS_DIR; the default is ./downloads).
import { NodeIO } from '@gltf-transform/core';
import { prune, resample, dedup } from '@gltf-transform/functions';
import { YARD_CLIPS, compress, disposeAnimation, withMeshopt } from './model_optimize.mjs';
import path from 'node:path';
import fs from 'node:fs';

const downloads = process.argv[2] ?? process.env.QUATERNIUS_DIR ?? 'downloads';
const ual1 = path.join(downloads, 'Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb');
const ual2 = path.join(downloads, 'Universal Animation Library 2 [Standard]/Unreal-Godot/UAL2_Standard.glb');
const output = path.resolve('public/models/human.glb');

// Which library each clip comes from. What actually ships is these names
// filtered through YARD_CLIPS, so a clip listed here but not played by the yard
// stays out of the model until character.ts asks for it.
const FROM_UAL1 = [
  'Idle_Loop', 'Walk_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop',
  'Jump_Start', 'Jump_Loop', 'Jump_Land', 'Roll',
  'Crouch_Idle_Loop', 'Crouch_Fwd_Loop',
  'Sword_Attack', 'Sword_Idle', 'Punch_Jab', 'Punch_Cross',
  'Death01', 'Hit_Chest', 'Spell_Simple_Shoot', 'Spell_Simple_Enter', 'Spell_Simple_Idle_Loop', 'Interact',
  // Hunters aim and fire their bow, gun or crossbow with the pistol clips (no bow clips in the library).
  'Pistol_Aim_Neutral', 'Pistol_Shoot',
];
const FROM_UAL2 = [
  'Sword_Regular_A', 'Sword_Regular_B', 'Sword_Regular_C', 'Sword_Regular_A_Rec',
  'Melee_Hook', 'Consume', 'OverhandThrow', 'Sword_Block', 'Hit_Knockback',
  'NinjaJump_Start',
];

const io = await withMeshopt(new NodeIO());
const doc = await io.read(ual1);
const other = await io.read(ual2);
const root = doc.getRoot();

// Drop the UAL1 animations the yard does not play.
for (const anim of root.listAnimations()) {
  const name = anim.getName();
  if (!FROM_UAL1.includes(name) || !YARD_CLIPS.includes(name)) disposeAnimation(anim);
}

// Copy the UAL2 clips onto the nodes with the same name.
const nodeByName = new Map(root.listNodes().map((n) => [n.getName(), n]));
const buffer = root.listBuffers()[0];
const copyAccessor = (a) => doc.createAccessor(a.getName())
  .setType(a.getType())
  .setArray(a.getArray().slice())
  .setNormalized(a.getNormalized())
  .setBuffer(buffer);

for (const anim of other.getRoot().listAnimations()) {
  const name = anim.getName();
  if (!FROM_UAL2.includes(name) || !YARD_CLIPS.includes(name)) continue;
  const copy = doc.createAnimation(anim.getName());
  for (const channel of anim.listChannels()) {
    const target = nodeByName.get(channel.getTargetNode()?.getName());
    if (!target) continue;
    const s = channel.getSampler();
    const sampler = doc.createAnimationSampler()
      .setInput(copyAccessor(s.getInput()))
      .setOutput(copyAccessor(s.getOutput()))
      .setInterpolation(s.getInterpolation());
    copy.addSampler(sampler).addChannel(
      doc.createAnimationChannel()
        .setTargetNode(target)
        .setTargetPath(channel.getTargetPath())
        .setSampler(sampler),
    );
  }
}

// Tracks that never move away from the bone's rest value add size and
// nothing else: most scale and translation tracks.
let dropped = 0;
for (const anim of root.listAnimations()) {
  for (const ch of anim.listChannels()) {
    const path = ch.getTargetPath();
    const node = ch.getTargetNode();
    if (path === 'rotation' || !node) continue;
    const rest = path === 'scale' ? node.getScale() : node.getTranslation();
    const values = ch.getSampler().getOutput().getArray();
    let still = true;
    for (let i = 0; i < values.length && still; i++) {
      if (Math.abs(values[i] - rest[i % 3]) > 1e-4) still = false;
    }
    if (still) {
      ch.getSampler().dispose();
      ch.dispose();
      dropped++;
    }
  }
}
console.log(`dropped ${dropped} constant tracks`);

await doc.transform(resample(), dedup(), prune());
// Most of the file is animation keyframes; Meshopt packs those as well as the
// geometry, and the yard decodes it (src/scene/gltf.ts).
await compress(doc);
fs.mkdirSync(path.dirname(output), { recursive: true });
await io.write(output, doc);

const names = root.listAnimations().map((a) => a.getName()).sort();
console.log(`${output}: ${(fs.statSync(output).size / 1e6).toFixed(2)} MB, ${names.length} animations`);
console.log(names.join(', '));
