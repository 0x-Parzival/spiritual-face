import * as THREE from 'three';

// Styling stays in bind coordinates so the paint follows speech and blinks.
// Geometry, including the fixed upper lids, is never reshaped.
export function portraitFinish(mesh, bindFrame) {
  const material = mesh.material, name = material.name;
  let color;
  if (name === 'Blue skin') color = `
    diffuseColor.rgb = min(diffuseColor.rgb * vec3(1.65, 1.52, 1.22), vec3(1.0));
    // Soft lid and lower socket shading belongs to the skin, never the eyeball.
    vec2 socket = vec2((abs(finishPoint.x) - .075) / .039, finishPoint.y);
    float across = exp(-socket.x * socket.x * 2.0);
    float upper = across * exp(-pow((socket.y - .025) / .011, 2.0));
    float lower = across * exp(-pow((socket.y + .018) / .011, 2.0));
    float waterline = across * exp(-pow((socket.y + .0145) / .0035, 2.0));
    float front = smoothstep(.15, .19, finishPoint.z);
    diffuseColor.rgb *= 1.0 - front * (.18 * upper + .04 * lower);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.77, .49, .59), front * (lower * .06 + waterline * .26));
    float noseSide = exp(-pow((abs(finishPoint.x) - .017) / .009, 2.0))
      * exp(-pow((finishPoint.y + .055) / .032, 2.0));
    diffuseColor.rgb *= 1.0 - front * noseSide * .075;
    // Extend the existing brows toward the bridge with a short, tapered tint.
    float browTip = smoothstep(.043, .059, abs(finishPoint.x))
      * (1.0 - smoothstep(.065, .072, abs(finishPoint.x)))
      * exp(-pow((finishPoint.y - .055) / .004, 2.0));
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.035, .028, .027), front * browTip * .35);`;
  else if (name === 'Pink lips') color = `
    diffuseColor.rgb = vec3(.76, .24, .36);
    float lipGloss = exp(-pow(finishPoint.x / .15, 2.0)
      - pow((finishPoint.y + .355) / .022, 2.0));
    diffuseColor.rgb += vec3(.18, .13, .14) * lipGloss;`;
  else if (name === 'Black eyebrows and eyelashes') color = `
    vec3 charcoal = mix(diffuseColor.rgb, vec3(.016, .012, .010), .65);
    // The broad dark eye patches are not the real lash line (a separate mesh).
    float brow = smoothstep(.038, .045, finishPoint.y)
      * (.58 + .42 * smoothstep(.052, .075, abs(finishPoint.x)))
      * (1.0 - .5 * smoothstep(.11, .135, abs(finishPoint.x)));
    float tear = (1.0 - smoothstep(.046, .052, abs(finishPoint.x)))
      * (1.0 - smoothstep(.002, .006, abs(finishPoint.y - .002)));
    vec3 skin = mix(vec3(.62, .71, .88), vec3(.75, .47, .45), tear * .24);
    skin *= 1.0 - .08 * exp(-pow((finishPoint.y - .019) / .012, 2.0));
    diffuseColor.rgb = mix(skin, charcoal, brow);`;
  else if (name === 'Black eyelashes') {
    const geometry = mesh.geometry, position = geometry.attributes.position;
    const trim = new Float32Array(position.count);
    if (/eyelashes/i.test(mesh.parent?.name || '')) {
      // Existing disconnected lash strands: keep alternating small strands and
      // shade only their lower 72%, without touching positions or morph targets.
      const parents = Array.from({ length: position.count }, (_, i) => i), seen = new Map();
      const find = i => parents[i] === i ? i : (parents[i] = find(parents[i]));
      const join = (a, b) => { parents[find(a)] = find(b); };
      for (let i = 0; i < position.count; i++) {
        const key = [position.getX(i), position.getY(i), position.getZ(i)].join(',');
        if (seen.has(key)) join(i, seen.get(key)); else seen.set(key, i);
      }
      const index = geometry.index.array;
      for (let i = 0; i < index.length; i += 3) { join(index[i], index[i + 1]); join(index[i], index[i + 2]); }
      const groups = new Map(), point = new THREE.Vector3();
      for (let i = 0; i < position.count; i++) {
        const root = find(i);
        if (!groups.has(root)) groups.set(root, { ids: [], low: Infinity, high: -Infinity, x: 0 });
        const group = groups.get(root);
        point.fromBufferAttribute(position, i).applyMatrix4(bindFrame);
        group.ids.push(i); group.low = Math.min(group.low, point.y); group.high = Math.max(group.high, point.y); group.x += point.x;
      }
      [...groups.values()].sort((a, b) => a.x / a.ids.length - b.x / b.ids.length).forEach((group, order) => {
        for (const i of group.ids) {
          point.fromBufferAttribute(position, i).applyMatrix4(bindFrame);
          trim[i] = group.ids.length < 500 && order % 2 ? 2 : (point.y - group.low) / Math.max(.0001, group.high - group.low);
        }
      });
    }
    geometry.setAttribute('lashTrim', new THREE.BufferAttribute(trim, 1));
    color = `
      float corner = smoothstep(.023, .031, abs(abs(finishPoint.x) - .074));
      if (finishLashTrim > .72 || corner > .98) discard;
      diffuseColor.rgb = mix(vec3(.026, .019, .015), vec3(.62, .71, .88), corner);`;
  } else return;

  material.onBeforeCompile = shader => {
    shader.uniforms.finishBindFrame = { value: bindFrame };
    shader.vertexShader = 'uniform mat4 finishBindFrame; varying vec3 finishPoint;\n'
      + (name === 'Black eyelashes' ? 'attribute float lashTrim; varying float finishLashTrim;\n' : '') + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nfinishPoint = (finishBindFrame * vec4(position, 1.0)).xyz;'
      + (name === 'Black eyelashes' ? '\nfinishLashTrim = lashTrim;' : ''));
    shader.fragmentShader = 'varying vec3 finishPoint;\n'
      + (name === 'Black eyelashes' ? 'varying float finishLashTrim;\n' : '') + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n' + color);
  };
}
