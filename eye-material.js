import * as THREE from 'three';

// One surface shader across sclera/iris/pupil primitives avoids polygon-shaped
// pupils and color seams. Bind-pose coordinates keep the iris attached in blinks.
export function eyeMaterial(name, bindFrame = new THREE.Matrix4()) {
  const material = new THREE.MeshPhongMaterial({ name, color: '#ffffff', shininess: 42, specular: '#484540' });
  material.userData.anatomicalEye = true;
  material.onBeforeCompile = shader => {
    shader.uniforms.eyeBindFrame = { value: bindFrame };
    shader.vertexShader = 'uniform mat4 eyeBindFrame; varying vec3 eyePoint;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\neyePoint = (eyeBindFrame * vec4(position, 1.0)).xyz;');
    shader.fragmentShader = 'varying vec3 eyePoint;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
      #include <color_fragment>
      // The iris faces forward; the real eyelid supplies its upper overlap.
      vec2 center = eyePoint.x < 0.0 ? vec2(-.073, .0065) : vec2(.076, .0055);
      // Eye-squint morph compresses the surface vertically; compensate so the
      // visible iris stays round without painting a mask over its edge.
      // The raised left lid stretches that eye's surface; keep the iris round.
      vec2 irisPoint = (eyePoint.xy - center) / vec2(.016, eyePoint.x > 0.0 ? .014 : .016);
      float radius = length(irisPoint);
      float angle = atan(irisPoint.y, irisPoint.x);
      float edge = max(fwidth(radius) * 1.3, .005);
      float fibers = .5 + .23 * sin(angle * 89.0 + radius * 27.0)
        + .15 * sin(angle * 157.0 - radius * 39.0)
        + .12 * sin(angle * 43.0 + sin(radius * 21.0));
      vec3 iris = mix(vec3(.070, .027, .012), vec3(.28, .105, .035), fibers);
      iris *= 1.0 - .68 * smoothstep(.82, .98, radius);
      float innerRing = (radius - .48) * 8.0;
      iris += vec3(.075, .029, .004) * exp(-innerRing * innerRing);
      iris = mix(vec3(.0015), iris, smoothstep(.37 - edge, .37 + edge, radius));
      float glint = 1.0 - smoothstep(.15, .24, length(irisPoint - vec2(-.29, .39)));
      glint += .6 * (1.0 - smoothstep(.065, .11, length(irisPoint - vec2(.19, .57))));
      iris = mix(iris, vec3(1.0, .98, .93), min(glint * .95, .95));
      vec3 sclera = vec3(.73, .70, .65);
      diffuseColor.rgb = mix(iris, sclera, smoothstep(1.0 - edge, 1.0 + edge, radius));
    `);
  };
  return material;
}
