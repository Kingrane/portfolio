import { bayerGLSL } from "./bayer";
import { readingZonesGLSL } from "./reading-zones";
import { gardenMaskGLSL } from "./garden-mask";

/** Applied AFTER tone mapping, before EffectPass's one final sRGB conversion. */
export const outputFragment = /* glsl */ `
  uniform float uDither;
  uniform float uDebugFull;
  uniform vec4 uWorld;
  uniform vec4 uHole;
  uniform vec2 uResolution;
  ${gardenMaskGLSL}
  uniform sampler2D uHoleMask;
  uniform sampler2D uCleanStars;
  uniform sampler2D uFieldStars;
  ${readingZonesGLSL}
  ${bayerGLSL}
  float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
  vec3 toSrgb(vec3 v) {
    return mix(v * 12.92, 1.055 * pow(max(v, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), v));
  }
  vec3 toLinear(vec3 v) {
    return mix(v / 12.92, pow((v + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), v));
  }
  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    // Calibrated to 1 display level, not an additive grey fog. Pure shadows
    // have no grain; low frequency gradients get subpixel dithering.
    vec3 color = toSrgb(max(inputColor.rgb, vec3(0.0)));
    vec2 css = vec2(uv.x, 1.0 - uv.y) * uResolution;
    float distanceToHole = length(css - uHole.xy);
    float halo = smoothstep(uHole.z * 1.35, uHole.z * 1.9, distanceToHole)
      * (1.0 - smoothstep(uHole.w * 0.85, uHole.w, distanceToHole));
    float area = max(uWorld.x * halo * 0.8 * texture2D(uHoleMask, uv).a,
      uWorld.z * 0.18 * gardenCoverage(uv));
    area = max(area, uWorld.w);
    float amount = area * uDither * (1.0 - readingMask(uv)) * (1.0 - uDebugFull);
    float starEnergy = dot(texture2D(uCleanStars, uv).rgb * uWorld.x + texture2D(uFieldStars, uv).rgb, vec3(1.0));
    amount *= 1.0 - step(0.00001, starEnergy) * (1.0 - uWorld.w);
    // Visible Bayer at illuminated edges; 5-level posterization during a dive.
    // Hue is retained by quantizing intensity rather than separate RGB channels.
    float peak = max(color.r, max(color.g, color.b));
    float levels = mix(16.0, 5.0, uWorld.w);
    float quantized = floor(peak * levels + bayer8(css)) / levels;
    vec3 posterized = color * (quantized / max(peak, 0.00001));
    color = mix(color, posterized, amount * smoothstep(0.04, 0.14, peak));
    float energy = smoothstep(0.015, 0.12, max(color.r, max(color.g, color.b)));
    float grain = (ign(gl_FragCoord.xy) - 0.5) * energy / 255.0;
    float vignette = 1.0 - smoothstep(0.25, 0.78, distance(uv, vec2(0.5))) * 0.16;
    color = max(vec3(5.0, 5.0, 7.0) / 255.0, color * vignette + grain);
    outputColor = vec4(toLinear(clamp(color, 0.0, 1.0)), 1.0);
  }
`;
