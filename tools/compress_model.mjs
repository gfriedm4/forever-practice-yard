// Readies a model that is already built for the yard, for when the Quaternius
// sources build_model.mjs needs are not at hand: it keeps the clips the yard
// plays and compresses what is left, the steps build_model.mjs ends with.
//
// Usage: node tools/compress_model.mjs [in.glb] [out.glb] [medium|high]
import { NodeIO } from '@gltf-transform/core';
import { prune } from '@gltf-transform/functions';
import fs from 'node:fs';
import { MESHOPT_EXTENSION, compress, keepYardClips, missingYardClips, withMeshopt } from './model_optimize.mjs';

const input = process.argv[2] ?? 'public/models/human.glb';
const output = process.argv[3] ?? input;
const level = process.argv[4] ?? 'high';

const io = await withMeshopt(new NodeIO());
const doc = await io.read(input);

// Quantising twice would compound the error, so stop if it ran already.
if (doc.getRoot().listExtensionsUsed().some((e) => e.extensionName === MESHOPT_EXTENSION)) {
  console.error(`${input} is already compressed; rebuild it with "npm run model" first.`);
  process.exit(1);
}

// Only the clips the yard plays: the model is built from a library of many
// more, and their keyframes are most of what a visitor would download.
const dropped = keepYardClips(doc);
await doc.transform(prune());
const missing = missingYardClips(doc);
if (missing.length) {
  console.error(`${input} has no ${missing.join(', ')}; rebuild it with "npm run model".`);
  process.exit(1);
}
if (dropped.length) console.log(`dropped ${dropped.length} clips the yard does not play: ${dropped.join(', ')}`);

const before = fs.statSync(input).size;
await compress(doc, level);
await io.write(output, doc);
const after = fs.statSync(output).size;
console.log(`${output}: ${(before / 1e6).toFixed(2)} MB -> ${(after / 1e6).toFixed(2)} MB (${Math.round((1 - after / before) * 100)}% smaller, level ${level})`);
