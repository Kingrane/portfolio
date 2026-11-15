import { glslNoise } from "./common";

/**
 * Schwarzschild-inspired null-ray integration, in units of r_s = 1.
 * The disk is a thin emitting volume, not a projected ring. Its higher-order
 * images, the photon ring and the captured shadow follow from the same rays.
 * Output is linear HDR; the scene's final pass owns tone mapping/dithering.
 */
export const blackholeVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    // Screen-space coverage is independent of camera translation/rotation.
    gl_Position = vec4(position.xy, 0.999, 1.0);
  }
`;

export const blackholeFragment = /* glsl */ `
  precision highp float;
  precision highp int;

  varying vec2 vUv;
  uniform float uTime;
  uniform float uAspect;
  uniform vec2 uPointer;   // Smoothed -1..1 coordinates.
  uniform float uPulse;    // 0 = inactive; otherwise shockwave progress 0..1.
  uniform float uIntro;
  uniform float uQuality;  // Controls disk detail and the second star layer.
  uniform int uSteps;      // 80..96 desktop, 32..40 mobile; 0 uses a fallback.
  uniform vec2 uResolution; // Actual HDR target size in pixels, independent of DPR.
  uniform float uOpacity;
  uniform float uDive;     // 0..1: eased approach to r=1.04, with gradual redshift.
  uniform float uZoom;     // Image-plane multiplier; larger makes the hole smaller.
  uniform vec2 uCenter;    // (uv - .5) * vec2(aspect, 1), not normalized UV.

  ${glslNoise}

  vec3 acceleration(vec3 position, float angularMomentum2) {
    float inverseR = inversesqrt(max(dot(position, position), 0.25));
    float inverseR2 = inverseR * inverseR;
    return -1.5 * angularMomentum2 * position
      * inverseR2 * inverseR2 * inverseR;
  }

  // Analytic tail of the central-force integral along a straight outgoing ray.
  // This also supplies the weak-field shortcut beyond the entire disk.
  vec3 asymptoticDirection(vec3 position, vec3 velocity, bool weakField) {
    vec3 direction = normalize(velocity);
    float along = dot(position, direction);
    vec3 impact = position - direction * along;
    float impact2 = max(dot(impact, impact), 0.0001);
    float t = clamp(along / length(position), -1.0, 1.0);
    float tail = (1.0 - t) * (1.0 - t) * (2.0 + t);
    float correction = weakField ? 1.0 + 15.0 * PI / (32.0 * sqrt(impact2)) : 1.0;
    return normalize(direction - impact * (0.5 * tail * correction / impact2));
  }

  // Primitive of exp(-abs(y) / height). Integrating a complete ray segment
  // avoids missing a disk much thinner than an adaptive geodesic step.
  float verticalPrimitive(float y, float height) {
    return sign(y) * height * (1.0 - exp(-abs(y) / height));
  }

  void integrateDisk(
    vec3 start, vec3 end, vec3 velocity, float beamWidth,
    inout vec3 radiance, inout float transmission
  ) {
    vec3 segment = end - start;
    float dy = segment.y;
    float planeT = abs(dy) > 0.0001 ? clamp(-start.y / dy, 0.0, 1.0) : 0.5;
    vec3 hit = mix(start, end, planeT);
    float radius = length(hit.xz);
    float edgeAA = max(0.015, beamWidth);
    if (radius < 2.6 - edgeAA || radius > 9.0 + edgeAA) return;

    float height = 0.028 + 0.007 * radius;
    float filteredHeight = sqrt(height * height + beamWidth * beamWidth * 0.35);
    float minY = start.y * end.y <= 0.0 ? 0.0 : min(abs(start.y), abs(end.y));
    if (minY > filteredHeight * 7.0) return;

    float segmentLength = length(segment);
    float column = abs(dy) > 0.0001
      ? (verticalPrimitive(end.y, filteredHeight) - verticalPrimitive(start.y, filteredHeight))
        * segmentLength / dy
      : exp(-abs(hit.y) / filteredHeight) * segmentLength;
    column = max(0.0, column) / (2.0 * filteredHeight);

    float edges = smoothstep(2.6 - edgeAA, 2.88 + edgeAA, radius)
      * (1.0 - smoothstep(8.5 - edgeAA, 9.0 + edgeAA, radius));
    if (column * edges < 0.0001) return;

    // Angular noise is sampled on a circle, including every octave. There is
    // no atan branch-cut seam, even after differential rotation shears it.
    float angle = atan(hit.z, hit.x);
    float omega = 1.35 / (radius * sqrt(radius));
    float phase = angle - uTime * omega;
    vec2 flow = vec2(cos(phase), sin(phase));
    float turbulence = 0.64 * noise(flow * 3.8 + radius * vec2(0.79, -1.17))
      + 0.28 * noise(flow * 8.1 + radius * vec2(1.61, 2.03));
    if (uQuality > 0.4) {
      turbulence += 0.08 * noise(flow * 17.3 + radius * vec2(3.37, -4.21));
    }

    // Average unresolved radial striations, especially for grazing segments.
    float radialSpan = abs(dot(segment.xz, hit.xz / radius))
      * min(1.0, 2.0 * filteredHeight / max(abs(dy), 0.0001));
    float footprint = max(beamWidth, radialSpan * 0.5);
    float stripeContrast = 1.0 / (1.0 + 72.0 * footprint * footprint);
    float stripes = 0.5 + 0.5 * stripeContrast
      * sin(radius * 19.0 + turbulence * 7.5 + 1.6 * sin(phase * 6.0 + radius * 2.0));
    float structure = (0.55 + 1.1 * turbulence) * (0.48 + 0.94 * stripes);

    vec3 orbitalDirection = vec3(-hit.z, 0.0, hit.x) / radius;
    float orbitalSpeed = sqrt(0.5 / (radius - 1.0));
    float towardObserver = dot(orbitalDirection, -normalize(velocity));
    float doppler = pow(max(0.24, 1.0 + orbitalSpeed * towardObserver), 3.0);
    float gravitationalShift = sqrt(1.0 - 1.0 / radius);
    vec3 tint = mix(vec3(1.0, 0.86, 0.67), vec3(1.0, 0.37, 0.075),
      smoothstep(2.8, 6.2, radius));
    tint = mix(tint, vec3(1.0, 0.23, 0.025), smoothstep(6.0, 9.0, radius));
    vec3 emission = tint * (6.0 * pow(2.6 / radius, 1.8)) * structure
      * doppler * gravitationalShift * gravitationalShift * gravitationalShift;

    float opticalDepth = min(3.0, column * edges * (0.16 + 0.15 * structure));
    float alpha = 1.0 - exp(-opticalDepth);
    radiance += transmission * alpha * emission;
    transmission *= 1.0 - alpha;
  }

  vec3 sphericalStarLayer(vec3 direction, float angularPixel, float scale, float seed) {
    vec2 spherical = vec2(
      atan(direction.z, direction.x) / TAU + 0.5,
      asin(clamp(direction.y, -1.0, 1.0)) / PI + 0.5
    );
    vec2 grid = spherical * vec2(scale, scale * 0.5);
    vec2 id = floor(grid);
    // Canonical longitude IDs make the hash field periodic at +/- pi.
    id.x = mod(id.x, scale);
    id.y = clamp(id.y, 0.0, scale * 0.5 - 1.0);
    vec2 key = id + vec2(seed, seed * 1.73);
    float exists = step(0.94, hash21(key + vec2(5.19, 12.71)));
    vec2 center = 0.2 + 0.6 * hash22(key + vec2(23.1, 8.7));
    vec2 offset = fract(grid) - center;
    offset.x *= max(0.12, cos((spherical.y - 0.5) * PI));

    float size = mix(0.03, 0.065, hash21(key + vec2(41.3, 79.7)));
    float aa = max(0.008, angularPixel * scale / TAU);
    float variance = size * size + aa * aa * 0.5;
    float core = exp(-dot(offset, offset) / variance) * size * size / variance;
    core *= 1.0 - smoothstep(3.0 * sqrt(variance), 4.0 * sqrt(variance), length(offset));

    // Four different seeds: brightness, oscillation amplitude, phase and
    // frequency are independent. Even the deepest twinkle stays >= 0.56.
    float brightness = mix(0.8, 2.1, pow(hash21(key + vec2(61.7, 3.9)), 3.0));
    float amplitude = 0.1 + 0.12 * hash21(key + vec2(91.1, 17.3));
    float phase = TAU * hash21(key + vec2(7.7, 137.9));
    float frequency = 0.33 + 1.63 * hash21(key + vec2(173.3, 47.1));
    float twinkle = 1.0 - amplitude + amplitude * sin(uTime * frequency + phase);
    vec3 tint = mix(vec3(0.94, 0.92, 0.88), vec3(1.0, 0.69, 0.32),
      pow(hash21(key + vec2(113.7, 53.9)), 6.0));
    return tint * exists * core * brightness * twinkle;
  }

  void main() {
    if (uOpacity < 0.0001 || uIntro <= 0.0) {
      gl_FragColor = vec4(0.0);
      return;
    }

    float dive = clamp(uDive, 0.0, 1.0);
    vec2 sp = (vUv - 0.5) * vec2(uAspect, 1.0);
    // Aim into the shadow as it grows, instead of passing below a top-aligned
    // mobile disk and losing its entire bright surface in one scroll step.
    vec2 center = uCenter * (1.0 - smoothstep(0.0, 0.8, dive));
    vec2 p = (sp - center - uPointer * 0.007) * max(0.15, uZoom);
    if (uPulse > 0.0 && uPulse < 1.0) {
      float distanceToWave = length(p) - (0.26 + uPulse * 1.1);
      float wave = exp(-distanceToWave * distanceToWave / 0.0012)
        * sin(distanceToWave * 90.0) * sin(PI * uPulse) * (1.0 - uPulse);
      // Refraction only: no painted luminous circle over the physical image.
      p += p / max(length(p), 0.001) * wave * 0.009;
    }
    // Standard derivatives are available to Three's GLSL1 ShaderMaterial on
    // WebGL2. The fallback also supports the previous uniform contract.
    vec2 pixelSpan = vec2(uAspect, 1.0) * max(0.15, uZoom) / max(uResolution, vec2(1.0));
    float rayCone = uResolution.y > 1.0
      ? 0.6 * max(pixelSpan.x, pixelSpan.y)
      : 0.6 * max(length(dFdx(p)), length(dFdy(p)));

    float cameraRadius = mix(18.0, 1.04, dive * dive);
    float yaw = 0.028 * sin(uTime * 0.075) + uPointer.x * 0.045;
    float elevation = 0.11 + 0.012 * sin(uTime * 0.11) + uPointer.y * 0.025 + dive * 0.14;
    vec3 cameraDirection = vec3(sin(yaw) * cos(elevation), sin(elevation), cos(yaw) * cos(elevation));
    vec3 position = cameraDirection * cameraRadius;
    vec3 forward = -cameraDirection;
    vec3 right = normalize(cross(forward, vec3(0.0, 1.0, 0.0)));
    vec3 up = cross(right, forward);
    float roll = -0.065 + 0.012 * sin(uTime * 0.061) + uPointer.x * 0.018 + dive * 0.13;
    vec2 image = vec2(cos(roll) * p.x - sin(roll) * p.y, sin(roll) * p.x + cos(roll) * p.y);
    // uZoom=1: vertical FOV=33.4 deg, shadow radius ~0.244 screen-heights.
    vec3 velocity = normalize(forward + 0.6 * (right * image.x + up * image.y));
    vec3 angularMomentum = cross(position, velocity);
    float angularMomentum2 = dot(angularMomentum, angularMomentum);
    vec3 radiance = vec3(0.0);
    float transmission = 1.0;
    float traveled = 0.0;
    bool escaped = false;
    vec3 skyDirection = velocity;
    vec3 weakSkyDirection = velocity;
    if (angularMomentum2 > 90.25 && cameraRadius > 12.0) {
      weakSkyDirection = asymptoticDirection(position, velocity, true);
    }

    int steps = uSteps;
    if (steps <= 0) steps = uQuality > 0.4 ? 88 : 36;
    if (steps < 32) steps = 32;
    if (steps > 96) steps = 96;
    float stepFraction = 13.5 / float(steps);

    // At b > 10.5 the turning radius exceeds 9.9: no part of the r<=9
    // disk can be hit. Restrict the shortcut to observers outside it too.
    if (angularMomentum2 > 110.25 && cameraRadius > 12.0) {
      skyDirection = weakSkyDirection;
      escaped = true;
    } else {
      for (int i = 0; i < 96; i++) {
        if (i >= steps) break;
        float radius2 = dot(position, position);
        if (radius2 <= 1.0) break;
        if (radius2 > 576.0 && dot(position, velocity) > 0.0) {
          skyDirection = asymptoticDirection(position, velocity, false);
          escaped = true;
          break;
        }

        float radius = sqrt(radius2);
        float dt = min(2.8, stepFraction * radius / max(length(velocity), 0.5));
        float dt2 = dt * dt;
        // Fourth-order Runge-Kutta-Nystrom for x''=a(x), three force samples.
        // Do NOT normalize velocity: that destroys the null-ray effective
        // potential and the unstable photon orbit at r=1.5.
        vec3 a0 = acceleration(position, angularMomentum2);
        vec3 am = acceleration(position + velocity * (0.5 * dt) + a0 * (0.125 * dt2), angularMomentum2);
        vec3 ae = acceleration(position + velocity * dt + am * (0.5 * dt2), angularMomentum2);
        vec3 nextPosition = position + velocity * dt + (a0 + 2.0 * am) * (dt2 / 6.0);
        vec3 nextVelocity = velocity + (a0 + 4.0 * am + ae) * (dt / 6.0);

        float beamWidth = max(0.006, rayCone * traveled * 0.65);
        integrateDisk(position, nextPosition, velocity + nextVelocity, beamWidth, radiance, transmission);
        traveled += length(nextPosition - position);
        position = nextPosition;
        velocity = nextVelocity;
        skyDirection = normalize(velocity);
        if (transmission < 0.008) break;
      }
      // A final outward step can cross the escape boundary at the budget.
      if (dot(position, position) > 576.0 && dot(position, velocity) > 0.0) {
        skyDirection = asymptoticDirection(position, velocity, false);
        escaped = true;
      }
    }
    // Blend only the far sky before entering the shortcut. Disk radiance is
    // untouched; the approximate/exact boundary cannot create a moving seam.
    if (escaped && angularMomentum2 > 90.25 && cameraRadius > 12.0) {
      skyDirection = normalize(mix(skyDirection, weakSkyDirection,
        smoothstep(9.5, 10.5, sqrt(angularMomentum2))));
    }

    // Evaluate sky derivatives after all lanes leave the adaptive loop.
    // Directions, not longitude UVs, keep AA continuous at the spherical seam.
    float angularPixel = max(rayCone,
      max(length(dFdx(skyDirection)), length(dFdy(skyDirection))));
    vec3 stars = sphericalStarLayer(skyDirection, angularPixel, 180.0, 3.1);
    if (uQuality > 0.4) {
      stars += 0.65 * sphericalStarLayer(skyDirection, angularPixel, 310.0, 47.7);
    }
    // Coverage is disk emission only. The post pass must never infer it from
    // the combined sky color: a lensed star is still a clean star, not a petal.
    float diskCoverage = smoothstep(0.001, 0.025, dot(radiance, vec3(0.2126, 0.7152, 0.0722)));
    vec3 skyRadiance = escaped ? transmission * stars : vec3(0.0);
    radiance += skyRadiance;

    // Begin losing exposure before the observer crosses the emitting disk.
    // Previously the disk filled the portrait viewport at full exposure, then
    // vanished geometrically before the late fade could hide the discontinuity.
    float exposure = exp(-6.0 * dive * dive) * (1.0 - smoothstep(0.6, 0.98, dive));
    cleanStars = vec4(skyRadiance * smoothstep(0.0, 1.0, uIntro) * exposure, 0.0);
    gl_FragColor = vec4(max(radiance, vec3(0.0))
      * smoothstep(0.0, 1.0, uIntro) * exposure, diskCoverage);
  }
`;
