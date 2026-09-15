import * as THREE from 'three';

const portrait = new THREE.TextureLoader().load(new URL('./krishna-paint-reference.png', import.meta.url));
portrait.colorSpace = THREE.SRGBColorSpace;

// Paint in bind-pose coordinates so expressions cannot slide beneath the color.
// Feather the reference into opaque side materials; never clip geometry by color.
export function referencePaint(material, hair = false) {
  material.onBeforeCompile = shader => {
    shader.uniforms.paintReference = { value: portrait };
    shader.vertexShader = 'varying vec3 paintPoint;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\npaintPoint = position;');
    shader.fragmentShader = 'uniform sampler2D paintReference;\nvarying vec3 paintPoint;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
      #include <color_fragment>
      vec2 lipDistance = vec2((paintPoint.y + .11) / .035, paintPoint.x / .065);
      float lipOffset = exp(-dot(lipDistance, lipDistance));
      vec2 paintUV = vec2((676.0 + paintPoint.x * 1950.0) / 1327.0,
        1.0 - (650.0 - paintPoint.y * 2000.0 - 20.0 * lipOffset) / 1186.0);
      vec3 paint = texture2D(paintReference, paintUV).rgb;
      float facing = smoothstep(${hair ? '.015, .13' : '.10, .19'}, paintPoint.z);
      ${hair ? `
        // Warm strand pixels only: neutral/blue portrait background never paints hair.
        float strand = smoothstep(.02, .12, (paint.r - paint.b) / max(paint.r, .002));
        diffuseColor.rgb = mix(diffuseColor.rgb, paint, facing * strand * .85);
      ` : `
        float edge = 1.0 - smoothstep(.105, .151, abs(paintPoint.x));
        // Blue and pink skin both have more blue than green. Reject hair/background
        // samples at the jaw, but keep dark brows and the red lip region intact.
        float skin = smoothstep(.003, .025, paint.b - paint.g);
        float brow = exp(-pow(abs((abs(paintPoint.x) - .073) / .047), 6.0)
          -pow(abs((paintPoint.y - .060) / .022), 6.0));
        float mouth = exp(-pow(abs(paintPoint.x / .047), 6.0)
          -pow(abs((paintPoint.y + .112) / .025), 6.0));
        float painted = facing * edge * max(skin, max(brow, mouth));
        diffuseColor.rgb = mix(diffuseColor.rgb, paint, painted);
      `}
    `);
  };
  material.userData.referencePaint = hair ? 'hair' : 'skin';
  return material;
}
