// Every glTF the yard loads goes through here, so they all decode the same
// things. The character model is compressed with Meshopt (tools/model_optimize.mjs),
// which needs its decoder; a player's own model may well be compressed too,
// since that is what the usual exporters do.
import type { LoadingManager } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

export function gltfLoader(manager?: LoadingManager): GLTFLoader {
  return new GLTFLoader(manager).setMeshoptDecoder(MeshoptDecoder);
}
