/** All colors arrive in linear RGB; the shared post pass owns tone mapping. */
const gardenVertex = /* glsl */ `
  attribute vec4 aFlower;
  attribute vec4 aHead;
  attribute float aProtection;
  attribute float aProjectIndex;
  uniform float uTime;
  uniform float uGrowth;
  uniform float uPointer;
  uniform float uAspect;
  uniform float uHighlight[4];
  uniform float uLanding[4];
  varying vec4 vGardenClip;
  varying float vLanding;

  float breeze() {
    return sin(uTime * 0.72 + aHead.y) * 0.06
      + sin(uTime * 0.27 + aHead.y * 1.7) * 0.03 + uPointer * 0.02;
  }
  float projectHighlight() {
    float light = 0.0;
    for (int i = 0; i < 4; i++) {
      light += uHighlight[i] * (1.0 - step(0.5, abs(aProjectIndex - float(i))));
    }
    return light;
  }
  float projectLanding() {
    float landing = 0.0;
    for (int i = 0; i < 4; i++) {
      landing += uLanding[i] * (1.0 - step(0.5, abs(aProjectIndex - float(i))));
    }
    return landing;
  }
  float plantGrowth() {
    float delay = 0.04 + 0.14 * (0.5 + 0.5 * sin(aHead.y));
    return mix(uGrowth, smoothstep(delay, 1.0, uGrowth), 1.0 - step(-0.5, aProjectIndex));
  }
  vec3 rootPosition() {
    return vec3(aFlower.x * uAspect, aFlower.y, aFlower.z);
  }
  vec3 stalkOffset(float height) {
    float h = height * plantGrowth();
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

/** Shared with the RGB coverage material; screen guards cannot diverge by DPR. */
export const gardenVisibilityFragment = /* glsl */ `
  uniform float uNarrow;
  varying vec4 vGardenClip;
  float gardenVisibility() {
    vec2 screen = vGardenClip.xy / vGardenClip.w * 0.5 + 0.5;
    float lowStems = 1.0 - smoothstep(0.17, 0.20, screen.y);
    float desktop = mix(lowStems, 1.0, smoothstep(0.53, 0.56, screen.x));
    float mobile = 1.0 - smoothstep(0.255, 0.28, screen.y);
    return mix(desktop, mobile, uNarrow);
  }
`;

const fireflyLighting = /* glsl */ `
  uniform vec3 uFireflyLights[6];
  uniform float uFireflyGlow[6];
  float fireflyLight(vec3 p, vec3 n) {
    float light = 0.0;
    for (int i = 0; i < 6; i++) {
      vec3 ray = uFireflyLights[i] - p;
      float distanceSquared = max(dot(ray, ray), 0.02);
      float incidence = 0.35 + 0.65 * max(dot(n, ray * inversesqrt(distanceSquared)), 0.0);
      light += uFireflyGlow[i] * incidence / (1.0 + distanceSquared * 2.4);
    }
    return light;
  }
`;

export const flowerVertex = /* glsl */ `
  ${gardenVertex}
  attribute vec4 aPetal;
  attribute vec3 aColor;
  uniform float uNarrow;
  varying vec2 vUv;
  varying vec3 vColor;
  varying vec3 vViewPosition;
  varying float vProtection;
  varying float vHighlight;
  varying float vDepth;
  varying float vFringe;

  void main() {
    float t = uv.y;
    float outline = 0.045 + 0.955 * pow(max(sin(t * 3.14159265), 0.0), 0.62);
    vec3 p = vec3(position.x * outline * aPetal.z,
      0.09 + t * aPetal.y, position.z + aPetal.w * t * t);
    // The tips flutter; the cupped throat stays attached to the stem.
    p.z += sin(uTime * 1.15 + aHead.y + aPetal.x * 2.0) * t * t * 0.028;
    p.xy = mat2(cos(aPetal.x), sin(aPetal.x), -sin(aPetal.x), cos(aPetal.x)) * p.xy;
    p = turnHead(p * aHead.x * plantGrowth() * (1.0 - aProtection * 0.22));
    p += rootPosition() + stalkOffset(aFlower.w);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    vGardenClip = gl_Position;
    vLanding = projectLanding();
    vUv = uv;
    vColor = aColor;
    vViewPosition = mv.xyz;
    vProtection = aProtection;
    vHighlight = projectHighlight();
    vDepth = smoothstep(8.0, 24.0, -mv.z);
    vFringe = (1.0 - step(-0.5, aProjectIndex))
      * (1.0 - smoothstep(-0.3, 0.2, aFlower.x)) * (1.0 - uNarrow);
  }
`;

export const flowerFragment = /* glsl */ `
  ${gardenVisibilityFragment}
  ${fireflyLighting}
  uniform float uFade;
  uniform float uSpecies;
  uniform vec3 uThroat;
  uniform vec3 uTip;
  uniform vec3 uBeard;
  varying vec2 vUv;
  varying vec3 vColor;
  varying vec3 vViewPosition;
  varying float vProtection;
  varying float vHighlight;
  varying float vDepth;
  varying float vFringe;

  void main() {
    vec3 n = normalize(cross(dFdx(vViewPosition), dFdy(vViewPosition)));
    vec3 eye = normalize(-vViewPosition);
    if (dot(n, eye) < 0.0) n = -n;
    float moon = max(dot(n, normalize(vec3(0.45, 0.78, -0.55))), 0.0);
    float fringeMoon = max(dot(n, normalize(vec3(-0.45, 0.62, 0.64))), 0.0);
    float warm = fireflyLight(vViewPosition, n);
    float edge = smoothstep(0.68, 1.0, abs(vUv.x * 2.0 - 1.0));
    float fresnel = pow(1.0 - abs(dot(n, eye)), 2.0);
    float vein = pow(0.5 + 0.5 * cos((vUv.x - 0.5) * (30.0 - vUv.y * 12.0)
      + sin(vUv.y * 5.0) * 0.45), 10.0);
    vec3 color = mix(uThroat, vColor, smoothstep(0.0, 0.48, vUv.y));
    color = mix(color, uTip, smoothstep(0.46, 1.0, vUv.y) * 0.25);
    color *= (0.24 + moon * 0.18 + warm * 0.72
      + vFringe * (0.10 + fringeMoon * 0.16)) * (1.0 - vein * 0.17);
    // Violet flowers have an amber beard, not a generic glowing polygon.
    float beard = (1.0 - smoothstep(0.14, 0.42, vUv.y))
      * (1.0 - smoothstep(0.05, 0.19, abs(vUv.x - 0.5)))
      * (1.0 - step(0.5, uSpecies));
    color = mix(color, uBeard * (0.72 + warm * 0.45), beard * 0.62);
    // Cool moon transmission reveals the cup; amber comes from real flies.
    color += vec3(0.36, 0.42, 0.76) * (edge * 0.085 + fresnel * 0.22) * (0.5 + moon);
    // Only the low left petals catch this faint night fill; stems stay dark.
    color += vFringe * (vColor * 0.045 * smoothstep(0.1, 0.8, vUv.y)
      + vec3(0.36, 0.42, 0.76) * (edge * 0.035 + fresnel * 0.07));
    color += uBeard * warm * (edge * 0.12 + fresnel * 0.24);
    color += mix(vColor, uBeard, 0.35) * vHighlight * (0.38 + fresnel * 0.85 + edge * 0.35);
    color *= (1.0 - vDepth * 0.34) * (1.0 - vProtection * 0.72);
    float softness = smoothstep(0.96, 1.0, abs(vUv.x * 2.0 - 1.0));
    float alpha = uFade * (0.94 - softness * 0.18) * (1.0 - vProtection * 0.5) * gardenVisibility();
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
  varying float vHighlight;
  varying vec3 vViewPosition;

  void main() {
    vec3 p;
    if (uLeaves > 0.5) {
      float t = uv.y;
      float outline = pow(max(sin(t * 3.14159265), 0.0), 0.8);
      p = vec3(position.x * outline * aPetal.z, t * aPetal.y, position.z * 0.7);
      p.xy = mat2(cos(aPetal.x), sin(aPetal.x), -sin(aPetal.x), cos(aPetal.x)) * p.xy;
      p *= plantGrowth();
      p += stalkOffset(aFlower.w * aPetal.w);
    } else {
      p = vec3(position.x, 0.0, position.z);
      p += stalkOffset(aFlower.w * position.y);
    }
    p += rootPosition();
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    vGardenClip = gl_Position;
    vLanding = projectLanding();
    vUv = uv;
    vProtection = aProtection;
    vHighlight = projectHighlight();
    vViewPosition = mv.xyz;
  }
`;

export const foliageFragment = /* glsl */ `
  ${gardenVisibilityFragment}
  ${fireflyLighting}
  uniform float uFade;
  uniform float uLeaves;
  uniform vec3 uDark;
  uniform vec3 uLight;
  varying vec2 vUv;
  varying float vProtection;
  varying float vHighlight;
  varying vec3 vViewPosition;

  void main() {
    float vein = 1.0 - smoothstep(0.012, 0.045, abs(vUv.x - 0.5));
    float edge = smoothstep(0.25, 0.5, abs(vUv.x - 0.5));
    vec3 n = normalize(cross(dFdx(vViewPosition), dFdy(vViewPosition)));
    if (dot(n, -vViewPosition) < 0.0) n = -n;
    float warm = fireflyLight(vViewPosition, n);
    float detail = uLeaves > 0.5 ? 0.14 + vein * 0.26 + edge * 0.15 : 0.18;
    vec3 color = mix(uDark, uLight, detail) * (0.48 + warm * 0.6);
    color += vec3(0.09, 0.15, 0.22) * edge * 0.32;
    color += vec3(0.48, 0.21, 0.04) * (warm * 0.12 + vHighlight * 0.16) * (0.3 + vein);
    color *= 1.0 - vProtection * 0.78;
    float alpha = uFade * 0.88 * (1.0 - vProtection * 0.5) * gardenVisibility();
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(color, alpha);
  }
`;

export const flowerCoreVertex = /* glsl */ `
  ${gardenVertex}
  varying vec2 vUv;
  varying vec3 vNormal;
  varying float vProtection;
  varying float vHighlight;

  void main() {
    vec3 p = position * vec3(0.17, 0.17, 0.085);
    p.z += 0.085;
    p = turnHead(p * aHead.x * plantGrowth() * (1.0 - aProtection * 0.22));
    p += rootPosition() + stalkOffset(aFlower.w);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    vGardenClip = gl_Position;
    vLanding = projectLanding();
    vUv = uv;
    vNormal = normalize(normalMatrix * turnHead(normal));
    vProtection = aProtection;
    vHighlight = projectHighlight();
  }
`;

export const flowerCoreFragment = /* glsl */ `
  ${gardenVisibilityFragment}
  uniform float uFade;
  uniform vec3 uDark;
  uniform vec3 uLight;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying float vProtection;
  varying float vHighlight;

  void main() {
    float light = 0.5 + 0.5 * abs(dot(normalize(vNormal), normalize(vec3(-0.3, 0.7, 1.0))));
    float pollen = pow(0.5 + 0.5 * sin(vUv.x * 157.0) * sin(vUv.y * 83.0), 5.0);
    vec3 color = mix(uDark, uLight, light * 0.8 + pollen * 0.2);
    color *= (1.25 + pollen * 0.38 + vHighlight * 1.65) * (1.0 - vProtection * 0.7);
    float alpha = uFade * gardenVisibility();
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(color, alpha);
  }
`;
