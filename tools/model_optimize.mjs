// The last step for the character model: Meshopt compression
// (EXT_meshopt_compression). Most of human.glb is animation keyframes, which
// this packs along with the geometry; the yard decodes it with three's
// MeshoptDecoder (src/scene/gltf.ts). Shared by build_model.mjs, which runs it
// as part of building the model, and compress_model.mjs, which runs it on a
// model already built.
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { meshopt } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

/** The glTF extension the compressed model uses, to test whether a file already has it. */
export const MESHOPT_EXTENSION = 'EXT_meshopt_compression';

/**
 * The clips the yard plays, which are src/scene/character.ts's LOCOMOTION and
 * ACTIONS tables; nothing else in the yard names an animation of human.glb.
 * The library the model is built from carries plenty more -- a death, a roll, a
 * jump take-off and landing -- and keyframes are most of what a visitor
 * downloads, so only these ship. A clip added to character.ts and not to this
 * list never plays, and the yard says which in the console.
 */
export const YARD_CLIPS = [
  'Idle_Loop', 'Sword_Idle', 'Walk_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop',
  'Crouch_Idle_Loop', 'Crouch_Fwd_Loop', 'Jump_Loop', 'Spell_Simple_Idle_Loop', 'Pistol_Aim_Neutral',
  'Sword_Regular_A', 'Sword_Regular_B', 'Sword_Regular_C', 'Sword_Attack', 'Melee_Hook',
  'Punch_Jab', 'Punch_Cross', 'Consume', 'OverhandThrow', 'Sword_Block',
  'Hit_Chest', 'Spell_Simple_Shoot', 'Pistol_Shoot',
];

/**
 * Takes an animation out of a document. Its samplers and channels go with it,
 * or prune keeps their accessors in the buffer; accessors can be shared between
 * clips, so which of those actually go is left to prune to work out.
 */
export function disposeAnimation(anim) {
  for (const s of anim.listSamplers()) s.dispose();
  for (const ch of anim.listChannels()) ch.dispose();
  anim.dispose();
}

/** Drops every animation the yard does not play; returns the names dropped. */
export function keepYardClips(doc) {
  const dropped = [];
  for (const anim of doc.getRoot().listAnimations()) {
    if (YARD_CLIPS.includes(anim.getName())) continue;
    dropped.push(anim.getName());
    disposeAnimation(anim);
  }
  return dropped;
}

/** The clips the yard wants that a document does not have. */
export const missingYardClips = (doc) => {
  const has = new Set(doc.getRoot().listAnimations().map((a) => a.getName()));
  return YARD_CLIPS.filter((c) => !has.has(c));
};

/**
 * Teaches a NodeIO to read and write compressed models. KHR_mesh_quantization
 * goes with it: compressing stores positions and normals as integers, and a
 * reader has to be told that before it can make sense of them.
 */
export async function withMeshopt(io) {
  await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
  return io
    .registerExtensions([EXTMeshoptCompression, KHRMeshQuantization])
    .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
}

/**
 * Compresses a document in place. Quantising is lossy, so this belongs at the
 * end of a pipeline and should not be run twice over the same model.
 *
 * 'high' filters the rotation tracks as well, which is where most of the saving
 * is: it takes human.glb from 682 kB to 213 kB over the wire, and moves the
 * character's bones by at most 0.14 mm (on a model 1.83 m tall).
 */
export async function compress(doc, level = 'high') {
  await MeshoptEncoder.ready;
  await doc.transform(meshopt({ encoder: MeshoptEncoder, level }));
}
