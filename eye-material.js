import * as THREE from 'three';

// One surface shader across sclera/iris/pupil primitives avoids polygon-shaped
// pupils and color seams. Bind-pose coordinates keep the iris attached in blinks.
export function eyeMaterial(name) {
  const material = new THREE.MeshPhysicalMaterial({ name, color: '#ffffff',
    roughness: .28, clearcoat: .35, clearcoatRoughness: .12, specularIntensity: .65, metalness: 0 });
  material.userData.anatomicalEye = true;
  material.onBeforeCompile = shader => {
    shader.vertexShader = 'varying vec3 eyePoint;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\neyePoint = position;');
    shader.fragmentShader = 'varying vec3 eyePoint;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
      #include <color_fragment>
      vec2 center = eyePoint.x < 0.0 ? vec2(-.071, .009) : vec2(.075, .008);
      vec2 irisPoint = (eyePoint.xy - center) / vec2(.0165);
      float radius = length(irisPoint);
      float angle = atan(irisPoint.y, irisPoint.x);
      float edge = max(fwidth(radius) * 1.3, .005);
      float fibers = .5 + .23 * sin(angle * 89.0 + radius * 27.0)
        + .15 * sin(angle * 157.0 - radius * 39.0)
        + .12 * sin(angle * 43.0 + sin(radius * 21.0));
      vec3 iris = mix(vec3(.085, .018, .005), vec3(.37, .095, .021), fibers);
      iris *= 1.0 - .68 * smoothstep(.82, .98, radius);
      float innerRing = (radius - .48) * 8.0;
      iris += vec3(.075, .029, .004) * exp(-innerRing * innerRing);
      iris = mix(vec3(.0015), iris, smoothstep(.33 - edge, .33 + edge, radius));
      vec3 sclera = mix(vec3(.87, .85, .82), vec3(.72, .57, .56),
        smoothstep(1.65, 2.7, abs(irisPoint.x)) * .22);
      diffuseColor.rgb = mix(iris, sclera, smoothstep(1.0 - edge, 1.0 + edge, radius));
    `);
  };
  return material;
}
