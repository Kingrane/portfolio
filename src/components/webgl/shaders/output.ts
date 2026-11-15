/** Applied AFTER tone mapping, before EffectPass's one final sRGB conversion. */
export const outputFragment = /* glsl */ `
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
    float energy = smoothstep(0.015, 0.12, max(color.r, max(color.g, color.b)));
    float grain = (ign(gl_FragCoord.xy) - 0.5) * energy / 255.0;
    float vignette = 1.0 - smoothstep(0.25, 0.78, distance(uv, vec2(0.5))) * 0.16;
    color = max(vec3(5.0, 5.0, 7.0) / 255.0, color * vignette + grain);
    outputColor = vec4(toLinear(clamp(color, 0.0, 1.0)), 1.0);
  }
`;
