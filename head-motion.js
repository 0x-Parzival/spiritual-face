import * as THREE from 'three';

// Bend through the neck, preserving the shoulder positions and facial morphs.
export function headMotion(face) {
  const rotation = new THREE.Euler();
  const turn = { value: new THREE.Matrix4() };
  face.updateMatrixWorld(true);
  const rootInverse = face.matrixWorld.clone().invert();
  face.traverse(mesh => {
    if (!mesh.isMesh) return;
    const frame = rootInverse.clone().multiply(mesh.matrixWorld);
    const previous = mesh.material.onBeforeCompile;
    mesh.material = mesh.material.clone();
    mesh.material.onBeforeCompile = shader => {
      previous.call(mesh.material, shader);
      shader.uniforms.headFrame = { value: frame };
      shader.uniforms.headFrameInverse = { value: frame.clone().invert() };
      shader.uniforms.headTurn = turn;
      shader.vertexShader = `uniform mat4 headFrame, headFrameInverse, headTurn;\n` + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `
        vec3 headPoint = (headFrame * vec4(transformed, 1.0)).xyz;
        float headWeight = smoothstep(-0.25, -0.14, headPoint.y);
        vec3 pivot = vec3(0.0, -0.19, 0.0);
        vec3 turned = (headTurn * vec4(headPoint - pivot, 0.0)).xyz + pivot;
        transformed = (headFrameInverse * vec4(mix(headPoint, turned, headWeight), 1.0)).xyz;
        #include <project_vertex>
      `);
    };
    mesh.material.customProgramCacheKey = () => 'krishna-neck-bend-' + mesh.material.name;
  });
  return { rotation, update: () => turn.value.makeRotationFromEuler(rotation) };
}
