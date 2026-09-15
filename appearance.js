import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// All styling uses the unrotated head's display coordinates, including morphs.
export function styleFace(face) {
  face.updateMatrixWorld(true);
  const frame = new THREE.Matrix4().makeScale(face.scale.x, face.scale.y, face.scale.z)
    .multiply(face.matrixWorld.clone().invert());
  const head = face.getObjectByName('mesh_2');
  const matrix = frame.clone().multiply(head.matrixWorld);
  const inverse = matrix.clone().invert();
  const base = head.geometry.attributes.position;
  const point = new THREE.Vector3();
  const sculpt = p => {
    const x = p.x, y = p.y;
    const front = THREE.MathUtils.smoothstep(p.z, .05, .42);
    // Use the reference's soft oval: full upper cheeks, continuously tapered jaw.
    const jaw = Math.exp(-1 * ((y + .59) / .24) ** 4);
    p.x *= 1 - .12 * jaw;
    const cheek = Math.exp(-1 * ((y + .015) / .22) ** 2)
      * THREE.MathUtils.smoothstep(Math.abs(x), .22, .48) * front;
    p.z += .04 * cheek;
    p.x *= 1 + .045 * cheek;
    const eyeX = Math.abs(x) - .31, eyeY = y - .25;
    const eyelid = Math.exp(-1 * (eyeX / .23) ** 4 - (eyeY / .15) ** 4) * front;
    p.x += Math.sign(x) * eyeX * .18 * eyelid;
    p.y += (eyeY * .24 + eyeX * .11 - .015) * eyelid;
    // Flatten the heavy brow/glabella and soften the lower-lid transition.
    p.z -= .035 * Math.exp(-1 * ((y - .43) / .11) ** 2) * front;
    const nose = Math.exp(-1 * (x / .2) ** 4 - ((y + .02) / .23) ** 4) * front;
    p.x *= 1 - .28 * nose;
    p.z -= .055 * nose;
    p.y -= .065 * nose * Math.exp(-1 * ((y + .04) / .15) ** 2);
    const mouth = Math.exp(-1 * (x / .32) ** 4 - ((y + .38) / .18) ** 4) * front;
    p.x *= 1 - .08 * mouth;
    p.y -= .045 * mouth;
    const lips = Math.exp(-1 * (x / .26) ** 4 - ((y + .38) / .09) ** 4) * front;
    p.z += .035 * lips;
    p.y += (y + .38) * .2 * lips;
    // A small closed-mouth smile, with no permanent teeth exposure.
    p.y += .015 * Math.exp(-1 * ((Math.abs(x) - .25) / .075) ** 2 - ((y + .39) / .07) ** 2) * front;
    return p;
  };
  const reference = new Float32Array(base.count * 3);
  for (let i = 0; i < base.count; i++) point.fromBufferAttribute(base, i).applyMatrix4(matrix).toArray(reference, i * 3);
  head.geometry.setAttribute('referencePosition', new THREE.Float32BufferAttribute(reference, 3));
  const positions = new Float32Array(base.count * 3);
  for (let i = 0; i < base.count; i++) {
    sculpt(point.fromBufferAttribute(base, i).applyMatrix4(matrix)).applyMatrix4(inverse).toArray(positions, i * 3);
  }
  head.geometry.morphAttributes.position = head.geometry.morphAttributes.position.map(target => {
    const values = new Float32Array(base.count * 3);
    for (let i = 0; i < base.count; i++) {
      point.fromBufferAttribute(target, i);
      if (head.geometry.morphTargetsRelative) point.add(new THREE.Vector3().fromBufferAttribute(base, i));
      sculpt(point.applyMatrix4(matrix)).applyMatrix4(inverse);
      if (head.geometry.morphTargetsRelative) point.sub(new THREE.Vector3().fromArray(positions, i * 3));
      point.toArray(values, i * 3);
    }
    return new THREE.Float32BufferAttribute(values, 3);
  });
  head.geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const scalpIndex = head.geometry.index.clone();
  smoothHead(head.geometry);
  head.geometry.computeBoundingBox();
  head.geometry.computeBoundingSphere();

  head.material = head.material.clone();
  head.material.map = null;
  head.material.envMapIntensity = .45;
  head.material.roughness = .8;
  head.material.emissiveIntensity = .045;
  head.material.onBeforeCompile = shader => {
    shader.uniforms.headFrame = { value: matrix };
    shader.vertexShader = 'attribute vec3 referencePosition; varying vec3 facePoint;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nfacePoint = referencePosition;');
    shader.fragmentShader = 'varying vec3 facePoint;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      float browT = clamp((abs(facePoint.x) - .105) / .45, 0.0, 1.0);
      float browY = .405 + .063 * sin(browT * 3.14159) - .035 * browT;
      float thickness = mix(.032, .005, browT);
      float strand = .65 + .35 * sin(facePoint.x * 460.0 - facePoint.y * 170.0);
      float brow = (1.0 - smoothstep(thickness * .3, thickness * (1.0 + .15 * strand), abs(facePoint.y - browY)))
        * smoothstep(.095, .15, abs(facePoint.x)) * (1.0 - smoothstep(.48, .56, abs(facePoint.x)))
        * smoothstep(.2, .4, facePoint.z);
      float fiber = .8 + .2 * sin(browT * 230.0 + facePoint.y * 370.0);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.019, .01, .006) * fiber, brow * (.8 + .18 * strand));
      float mouthX = abs(facePoint.x + .008) / .275;
      float lipSeam = -.39 + .025 * pow(mouthX, 2.0);
      float lipTop = -.322 - .035 * pow(mouthX, 1.5)
        + .018 * exp(-pow((mouthX - .32) / .2, 2.0));
      float lipBottom = lipSeam - .079 * sqrt(max(0.0, 1.0 - mouthX * mouthX));
      float lip = smoothstep(lipBottom - .006, lipBottom + .008, facePoint.y)
        * (1.0 - smoothstep(lipTop - .006, lipTop + .008, facePoint.y))
        * (1.0 - smoothstep(.9, 1.0, mouthX)) * smoothstep(.43, .54, facePoint.z);
      float seam = 1.0 - smoothstep(.003, .009, abs(facePoint.y - lipSeam));
      vec3 lipColor = mix(vec3(.42, .105, .13), vec3(.13, .023, .032), seam * .55);
      diffuseColor.rgb = mix(diffuseColor.rgb, lipColor, lip);
      // A feathered root tint on the actual scalp, with no extra scalp mesh.
      float hairline = .83 - .27 * pow(abs(facePoint.x) / .65, 2.0);
      float babyHair = .002 * sin(facePoint.x * 497.0) + .003 * sin(facePoint.x * 331.0);
      float roots = smoothstep(hairline + babyHair + .025, hairline + babyHair + .08, facePoint.y);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.014, .005, .002), roots);
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, .34, lip);');
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= 1.0 - roots;');
  };

  for (const name of ['mesh_0', 'mesh_1']) {
    const eye = face.getObjectByName(name);
    const eyeMatrix = frame.clone().multiply(eye.matrixWorld);
    const box = new THREE.Box3();
    for (let i = 0; i < eye.geometry.attributes.position.count; i++) {
      box.expandByPoint(point.fromBufferAttribute(eye.geometry.attributes.position, i).applyMatrix4(eyeMatrix));
    }
    const center = box.getCenter(new THREE.Vector3());
    eye.material = eye.material.clone();
    eye.material.map = null;
    eye.material.color.set('#dedbd5');
    eye.material.emissive.set('#000000');
    eye.material.roughness = .1;
    eye.material.envMapIntensity = .8;
    eye.material.onBeforeCompile = shader => {
      shader.uniforms.eyeMatrix = { value: eyeMatrix };
      shader.uniforms.eyeCenter = { value: center };
      shader.vertexShader = 'uniform mat4 eyeMatrix; varying vec3 eyePoint;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\neyePoint = (eyeMatrix * vec4(position, 1.0)).xyz;');
      shader.fragmentShader = 'uniform vec3 eyeCenter; varying vec3 eyePoint;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        vec2 iris = (eyePoint.xy - eyeCenter.xy) / .09;
        float radius = length(iris);
        float angle = atan(iris.y, iris.x);
        vec3 tint = mix(vec3(.012, .004, .002), vec3(.045, .016, .006), clamp(.5 + iris.x * .2 - iris.y * .35, 0.0, 1.0));
        tint *= .72 + .28 * pow(sin(angle * 43.0 + radius * 17.0), 2.0);
        tint = mix(vec3(.0008), tint, smoothstep(.34, .43, radius));
        tint = mix(tint, vec3(.001), smoothstep(.7, 1.0, radius));
        float irisMask = (1.0 - smoothstep(.96, 1.04, radius)) * step(eyeCenter.z, eyePoint.z);
        diffuseColor.rgb = mix(diffuseColor.rgb, tint, irisMask);
      `);
    };
  }

  const hair = new THREE.Group();
  hair.name = 'reference-hair';
  hair.scale.setScalar(1 / face.scale.x);
  face.add(hair);
  const scalpGeometry = new THREE.BufferGeometry();
  scalpGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  scalpGeometry.setIndex(scalpIndex);
  scalpGeometry.applyMatrix4(matrix);
  const scalpMaterial = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const scalp = new THREE.Mesh(scalpGeometry, scalpMaterial);
  const ray = new THREE.Raycaster();
  const roots = [];
  const rootAt = (x, z) => {
    ray.set(new THREE.Vector3(x, 2, z), new THREE.Vector3(0, -1, 0));
    const hit = ray.intersectObject(scalp)[0];
    if (!hit) throw new Error('Hair root missed the scalp');
    roots.push(hit.point.toArray());
    return hit.point;
  };
  let randomSeed = 27;
  const random = () => ((randomSeed = (Math.imul(randomSeed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const locks = [], fibers = [];
  const hairMaterial = new THREE.MeshPhysicalMaterial({ color: '#100d0d', roughness: .32,
    anisotropy: .85, anisotropyRotation: Math.PI / 2, specularIntensity: .3, envMapIntensity: .55 });
  hairMaterial.onBeforeCompile = shader => {
    shader.vertexShader = 'varying vec2 strandUv;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nstrandUv = uv;');
    shader.fragmentShader = 'varying vec2 strandUv;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      float filament = .5 + .5 * sin(strandUv.x * 540.0 + sin(strandUv.y * 18.0) * .8);
      diffuseColor.rgb *= .65 + .7 * filament;
    `);
  };
  const fiberMaterial = new THREE.MeshStandardMaterial({ color: '#392b26', roughness: .38, envMapIntensity: .5 });
  // A layered curve groom: rounded locks carry fine surface strands, never flat ribbons.
  const lock = (guide, width, seed, strandCount = 16) => {
    const curve = new THREE.CatmullRomCurve3(guide.map(p => p.isVector3 ? p : new THREE.Vector3(...p)));
    const segments = 64, radial = 10;
    const frames = curve.computeFrenetFrames(segments, false);
    const centers = curve.getSpacedPoints(segments);
    const positions = [], normals = [], uv = [], indices = [];
    const surface = (i, angle, lift = 1) => {
      const t = i / segments;
      const taper = (.35 + .65 * Math.sin(Math.PI * Math.min(1, t * 1.12)) ** .35)
        * (1 - .95 * THREE.MathUtils.smoothstep(t, .78, 1));
      return centers[i].clone().addScaledVector(frames.normals[i], Math.cos(angle) * width * taper * lift)
        .addScaledVector(frames.binormals[i], Math.sin(angle) * width * .55 * taper * lift);
    };
    for (let i = 0; i <= segments; i++) {
      for (let j = 0; j <= radial; j++) {
        const angle = j / radial * Math.PI * 2;
        positions.push(...surface(i, angle).toArray());
        normals.push(...frames.normals[i].clone().multiplyScalar(Math.cos(angle))
          .addScaledVector(frames.binormals[i], Math.sin(angle) / .55).normalize().toArray());
        uv.push(j / radial, i / segments);
        if (i < segments && j < radial) {
          const a = i * (radial + 1) + j, b = a + radial + 1;
          indices.push(a, b, a + 1, b, b + 1, a + 1);
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geometry.setIndex(indices);
    geometry.computeTangents();
    locks.push(geometry);
    for (let strand = 0; strand < strandCount; strand++) {
      const angle = strand / strandCount * Math.PI * 2 + seed * .37;
      const points = centers.map((_, i) => surface(i, angle + .035 * Math.sin(i * .13 + seed), 1.025));
      const strandCurve = new THREE.CatmullRomCurve3(points);
      fibers.push(new THREE.TubeGeometry(strandCurve, 48, .0007 + random() * .0006, 3, false));
    }
  };
  // The crown parts down the middle, rises, and sweeps backward into broad waves.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 22; i++) {
      const z = -.96 + i / 21 * 1.4;
      const root = rootAt(side * (.018 + random() * .035), z);
      const lift = .12 + .035 * Math.sin(i * 1.7);
      lock([root,
        [side * .23, root.y + lift, z + .015],
        [side * .47, Math.max(root.y + .12, 1.22), z - .04],
        [side * .7, 1.08 + .055 * Math.sin(i), z - .02],
        [side * .84, .85, z + .075],
        [side * .78, .7, z + .15],
        [side * .65, .73, z + .2]], .055 + random() * .025, i + side * 100);
    }
    // Staggered S curls frame the temples and ears, finishing at jaw height.
    for (let row = 0; row < 5; row++) {
      for (let layer = 0; layer < 9; layer++) {
        const z = -.87 + layer * .145;
        const y = .94 - row * .29 + .035 * Math.sin(layer * 2 + row);
        const x = .7 + .015 * row + .03 * Math.sin(layer * 1.4);
        lock([[side * (x - .045), y + .08, z - .06],
          [side * (x + .15), y + .06, z + .02],
          [side * (x + .27), y - .09, z + .09],
          [side * (x + .24), y - .25, z + .12],
          [side * (x + .07), y - .3, z + .18],
          [side * (x + .01), y - .2, z + .2],
          [side * (x + .09), y - .16, z + .19]], .052 + random() * .03, row * 30 + layer + side * 200);
      }
    }
    // Fine temple locks soften the hairline while leaving the eyes and ears clear.
    for (let i = 0; i < 8; i++) {
      const z = .35 + i * .016;
      lock([[side * (.13 + i * .04), .9 - i * .018, z],
        [side * (.32 + i * .04), 1.03 - i * .04, z + .04],
        [side * (.51 + i * .024), .85 - i * .03, z + .09],
        [side * (.58 + i * .018), .61 - i * .025, z + .08],
        [side * (.56 + i * .022), .47 - i * .022, z + .05]], .025, i + side * 300, 10);
    }
    for (let i = 0; i < 3; i++) {
      const shift = i * .013;
      lock([[side * (.22 + shift), .9, .48],
        [side * (.32 + shift), .85, .54],
        [side * (.36 + shift), .72, .59],
        [side * (.31 + shift), .63, .61],
        [side * (.27 + shift), .68, .62],
        [side * (.29 + shift), .71, .62]], .012, i + 400, 8);
    }
  }
  const body = new THREE.Mesh(mergeGeometries(locks), hairMaterial);
  body.name = 'hair-locks';
  const strands = new THREE.Mesh(mergeGeometries(fibers), fiberMaterial);
  strands.name = 'hair-strands';
  hair.add(body, strands);
  locks.concat(fibers).forEach(geometry => geometry.dispose());
  hair.userData.roots = roots;
  scalpGeometry.dispose();
  scalpMaterial.dispose();
}

// Two Loop-subdivision steps, applying identical weights to all 52 expressions.
// Weld the texture seam first so smoothing cannot split the face along that seam.
function smoothHead(geometry) {
  const source = geometry.attributes.position;
  const weld = new Map(), unique = [], remap = [];
  for (let i = 0; i < source.count; i++) {
    const key = [source.getX(i), source.getY(i), source.getZ(i)].map(v => Math.round(v * 1e4)).join(',');
    if (!weld.has(key)) { weld.set(key, unique.length); unique.push(i); }
    remap.push(weld.get(key));
  }
  let indices = Array.from(geometry.index.array, i => remap[i]);
  const attributes = [source, geometry.attributes.referencePosition, ...geometry.morphAttributes.position];
  let arrays = attributes.map(attribute => Float32Array.from(unique.flatMap(i => [attribute.getX(i), attribute.getY(i), attribute.getZ(i)])));
  for (let iteration = 0; iteration < 2; iteration++) {
    const count = arrays[0].length / 3;
    const neighbors = Array.from({ length: count }, () => new Set());
    const boundary = Array.from({ length: count }, () => []);
    const edges = new Map();
    const edgeKey = (a, b) => a < b ? `${a},${b}` : `${b},${a}`;
    for (let i = 0; i < indices.length; i += 3) {
      const triangle = indices.slice(i, i + 3);
      for (let j = 0; j < 3; j++) {
        const a = triangle[j], b = triangle[(j + 1) % 3], c = triangle[(j + 2) % 3];
        neighbors[a].add(b); neighbors[b].add(a);
        const key = edgeKey(a, b);
        if (!edges.has(key)) edges.set(key, { a, b, opposite: [], index: count + edges.size });
        edges.get(key).opposite.push(c);
      }
    }
    for (const { a, b, opposite } of edges.values()) {
      if (opposite.length === 1) { boundary[a].push(b); boundary[b].push(a); }
    }
    const weights = neighbors.map((adjacent, i) => {
      if (boundary[i].length === 2) return [[i, .75], ...boundary[i].map(j => [j, .125])];
      if (!adjacent.size) return [[i, 1]];
      const beta = adjacent.size === 3 ? 3 / 16 : 3 / (8 * adjacent.size);
      return [[i, 1 - adjacent.size * beta], ...Array.from(adjacent, j => [j, beta])];
    });
    for (const { a, b, opposite } of edges.values()) {
      weights.push(opposite.length === 2 ? [[a, .375], [b, .375], ...opposite.map(i => [i, .125])] : [[a, .5], [b, .5]]);
    }
    arrays = arrays.map(array => {
      const next = new Float32Array(weights.length * 3);
      weights.forEach((entries, i) => {
        for (const [j, weight] of entries) for (let axis = 0; axis < 3; axis++) next[i * 3 + axis] += array[j * 3 + axis] * weight;
      });
      return next;
    });
    const next = [];
    for (let i = 0; i < indices.length; i += 3) {
      const [a, b, c] = indices.slice(i, i + 3);
      const ab = edges.get(edgeKey(a, b)).index, bc = edges.get(edgeKey(b, c)).index, ca = edges.get(edgeKey(c, a)).index;
      next.push(a, ab, ca, b, bc, ab, c, ca, bc, ab, bc, ca);
    }
    indices = next;
  }
  for (const name of Object.keys(geometry.attributes)) geometry.deleteAttribute(name);
  geometry.setIndex(indices);
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(arrays[0], 3));
  geometry.setAttribute('referencePosition', new THREE.Float32BufferAttribute(arrays[1], 3));
  geometry.computeVertexNormals();
  geometry.morphAttributes.position = arrays.slice(2).map(array => new THREE.Float32BufferAttribute(array, 3));
  const scratch = new THREE.BufferGeometry();
  scratch.setIndex(geometry.index);
  geometry.morphAttributes.normal = arrays.slice(2).map(array => {
    const absolute = Float32Array.from(array, (v, i) => geometry.morphTargetsRelative ? v + arrays[0][i] : v);
    scratch.setAttribute('position', new THREE.Float32BufferAttribute(absolute, 3));
    scratch.computeVertexNormals();
    return new THREE.Float32BufferAttribute(Float32Array.from(scratch.attributes.normal.array,
      (v, i) => geometry.morphTargetsRelative ? v - geometry.attributes.normal.array[i] : v), 3);
  });
  scratch.dispose();
}
