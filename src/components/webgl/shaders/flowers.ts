/** All colors arrive in linear RGB; the shared post pass owns tone mapping. */
const gardenVertex = /* glsl */ `
  attribute vec4 aFlower;
  attribute vec4 aHead;
  attribute float aProtection;
  uniform float uTime;
  uniform float uGrowth;
  uniform float uPointer;
  uniform float uAspect;

  float breeze() {
    return sin(uTime * 0.72 + aHead.y) * 0.12
      + sin(uTime * 0.27 + aHead.y * 1.7) * 0.065 + uPointer * 0.045;
  }
  vec3 rootPosition() {
    return vec3(aFlower.x * uAspect, aFlower.y, aFlower.z);
  }
  vec3 stalkOffset(float height) {
    float h = height * uGrowth;
    float fraction = height / max(aFlower.w, 0.01);
    return vec3(breeze() * h * fraction, h, sin(uTime * 0.43 + aHead.y) * h * fraction * 0.035);
  }
  vec3 turnHead(vec3 p) {
    float spin = aHead.y;
    p.xy = mat2(cos(spin), sin(spin), -sin(spin), cos(spin)) * p.xy;
    float tilt = aHead.z + breeze() * 0.45;
    p.yz = mat2(cos(tilt), sin(tilt), -sin(tilt), cos(tilt)) * p.yz;
    p.xz = mat2(cos(aHead.w), sin(aHead.w), -sin(aHead.w), cos(aHead.w)) * p.xz;
    return p;
  }
`;

export const flowerVertex = /* glsl */ `
  ${gardenVertex}
  attribute vec4 aPetal;
  attribute vec3 aColor;
  varying vec2 vUv;
  varying vec3 vColor;
  varying vec3 vViewPosition;
  varying float vProtection;

  void main() {
    float t = uv.y;
    float outline = 0.045 + 0.955 * pow(max(sin(t * 3.14159265), 0.0), 0.62);
    vec3 p = vec3(position.x * outline * aPetal.z,
      0.09 + t * aPetal.y, position.z + aPetal.w * t * t);
    // The tips flutter; the cupped throat stays attached to the stem.
    p.z += sin(uTime * 1.15 + aHead.y + aPetal.x * 2.0) * t * t * 0.028;
    p.xy = mat2(cos(aPetal.x), sin(aPetal.x), -sin(aPetal.x), cos(aPetal.x)) * p.xy;
    p = turnHead(p * aHead.x * uGrowth * (1.0 - aProtection * 0.22));
    p += rootPosition() + stalkOffset(aFlower.w);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    vUv = uv;
    vColor = aColor;
    vViewPosition = mv.xyz;
    vProtection = aProtection;
  }
`;

export const flowerFragment = /* glsl */ `
  uniform float uFade;
  uniform float uSpecies;
  uniform vec3 uThroat;
  uniform vec3 uTip;
  uniform vec3 uBeard;
  varying vec2 vUv;
  varying vec3 vColor;
  varying vec3 vViewPosition;
  varying float vProtection;

  void main() {
    vec3 n = normalize(cross(dFdx(vViewPosition), dFdy(vViewPosition)));
    vec3 eye = normalize(-vViewPosition);
    if (dot(n, eye) < 0.0) n = -n;
    float light = 0.48 + 0.52 * max(dot(n, normalize(vec3(-0.35, 0.6, 1.0))), 0.0);
    float edge = smoothstep(0.68, 1.0, abs(vUv.x * 2.0 - 1.0));
    float fresnel = pow(1.0 - abs(dot(n, eye)), 2.0);
    float vein = pow(0.5 + 0.5 * cos((vUv.x - 0.5) * (30.0 - vUv.y * 12.0)
      + sin(vUv.y * 5.0) * 0.45), 10.0);
    vec3 color = mix(uThroat, vColor, smoothstep(0.0, 0.48, vUv.y));
    color = mix(color, uTip, smoothstep(0.46, 1.0, vUv.y) * 0.43);
    color *= light * (1.0 - vein * 0.13);
    // Violet flowers have an amber beard, not a generic glowing polygon.
    float beard = (1.0 - smoothstep(0.14, 0.42, vUv.y))
      * (1.0 - smoothstep(0.05, 0.19, abs(vUv.x - 0.5)))
      * (1.0 - step(0.5, uSpecies));
    color = mix(color, uBeard * 1.15, beard * 0.7);
    color += uTip * (edge * 0.075 + fresnel * 0.13);
    color *= 1.08 * (1.0 - vProtection * 0.32);
    float alpha = uFade * (0.95 - vProtection * 0.15);
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(color, alpha);
  }
`;

export const foliageVertex = /* glsl */ `
  ${gardenVertex}
  attribute vec4 aPetal;
  uniform float uLeaves;
  varying vec2 vUv;
  varying float vProtection;

  void main() {
    vec3 p;
    if (uLeaves > 0.5) {
      float t = uv.y;
      float outline = pow(max(sin(t * 3.14159265), 0.0), 0.8);
      p = vec3(position.x * outline * aPetal.z, t * aPetal.y, position.z * 0.7);
      p.xy = mat2(cos(aPetal.x), sin(aPetal.x), -sin(aPetal.x), cos(aPetal.x)) * p.xy;
      p *= uGrowth;
      p += stalkOffset(aFlower.w * aPetal.w);
    } else {
      p = vec3(position.x, 0.0, position.z);
      p += stalkOffset(aFlower.w * position.y);
    }
    p += rootPosition();
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    vUv = uv;
    vProtection = aProtection;
  }
`;

export const foliageFragment = /* glsl */ `
  uniform float uFade;
  uniform float uLeaves;
  uniform vec3 uDark;
  uniform vec3 uLight;
  varying vec2 vUv;
  varying float vProtection;

  void main() {
    float vein = 1.0 - smoothstep(0.012, 0.045, abs(vUv.x - 0.5));
    float edge = smoothstep(0.25, 0.5, abs(vUv.x - 0.5));
    float detail = uLeaves > 0.5 ? 0.22 + vein * 0.42 + edge * 0.12 : 0.35;
    vec3 color = mix(uDark, uLight, detail) * (1.0 - vProtection * 0.28);
    float alpha = uFade * 0.88;
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(color, alpha);
  }
`;

export const flowerCoreVertex = /* glsl */ `
  ${gardenVertex}
  varying vec2 vUv;
  varying vec3 vNormal;
  varying float vProtection;

  void main() {
    vec3 p = position * vec3(0.17, 0.17, 0.085);
    p.z += 0.085;
    p = turnHead(p * aHead.x * uGrowth * (1.0 - aProtection * 0.22));
    p += rootPosition() + stalkOffset(aFlower.w);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    vUv = uv;
    vNormal = normalize(normalMatrix * turnHead(normal));
    vProtection = aProtection;
  }
`;

export const flowerCoreFragment = /* glsl */ `
  uniform float uFade;
  uniform vec3 uDark;
  uniform vec3 uLight;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying float vProtection;

  void main() {
    float light = 0.5 + 0.5 * abs(dot(normalize(vNormal), normalize(vec3(-0.3, 0.7, 1.0))));
    float pollen = pow(0.5 + 0.5 * sin(vUv.x * 157.0) * sin(vUv.y * 83.0), 5.0);
    vec3 color = mix(uDark, uLight, light * 0.8 + pollen * 0.2);
    color *= (1.0 + pollen * 0.25) * (1.0 - vProtection * 0.32);
    if (uFade < 0.004) discard;
    gl_FragColor = vec4(color, uFade);
  }
`;
