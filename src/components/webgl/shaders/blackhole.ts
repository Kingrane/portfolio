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
  uniform int uSteps;      // 64..96 desktop, 32..40 mobile; 0 uses a fallback.
  uniform vec2 uResolution; // Actual HDR target size in pixels, independent of DPR.
  uniform float uOpacity;
  uniform float uDive;     // 0..1: eased approach to r=1.04, with gradual redshift.
  uniform float uZoom;     // Image-plane multiplier; larger makes the hole smaller.
  uniform vec2 uCenter;    // (uv - .5) * vec2(aspect, 1), not normalized UV.

  ${glslNoise}

  // The brief's sRGB palette decoded once to linear HDR. ACES must receive
  // linear light, not the undecoded hex components.
  const vec3 DISK_LAVENDER = vec3(0.887923, 0.830770, 1.0); // #F2EBFF
  const vec3 DISK_VIOLET = vec3(0.274677, 0.147027, 1.0);   // #8F6BFF
  const vec3 DISK_INDIGO = vec3(0.043735, 0.023153, 0.332452); // #3B2A9C
  const vec3 DISK_AMBER = vec3(1.0, 0.450786, 0.063010);    // #FFB347

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
    float edgeAA = max(0.018, beamWidth * 1.1);
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
    vec3 tint = mix(DISK_LAVENDER, DISK_VIOLET, smoothstep(2.75, 4.8, radius));
    tint = mix(tint, DISK_INDIGO, smoothstep(4.8, 8.4, radius));
    // Orbital motion approaches the observer on screen-right. Amber lives in
    // that narrow hot sector, not in a screen-space painted crescent. The same
    // emitting volume supplies the bent back face and higher-order images.
    float hotSector = smoothstep(0.5, 0.86, towardObserver)
      * smoothstep(2.9, 3.5, radius) * (1.0 - smoothstep(6.1, 7.3, radius));
    float innerRim = 1.0 - smoothstep(2.76, 3.04, radius);
    tint = mix(tint, DISK_AMBER, clamp(hotSector * 0.82 + innerRim * 0.13, 0.0, 0.85));
    float receding = (1.0 - smoothstep(-0.45, 0.25, towardObserver))
      * smoothstep(3.2, 5.8, radius);
    tint = mix(tint, DISK_INDIGO, receding * 0.18);
    // Keep a wide indigo outskirts, but let their light die before r=9 rather
    // than turning the whole viewport into a luminous orange fog.
    float outerFalloff = 1.0 - smoothstep(6.4, 9.0, radius);
    vec3 emission = tint * (6.2 * pow(2.6 / radius, 1.8)) * structure * outerFalloff
      * doppler * gravitationalShift * gravitationalShift * gravitationalShift;

    float opticalDepth = min(3.0, column * edges * (0.16 + 0.15 * structure));
    float alpha = 1.0 - exp(-opticalDepth);
    radiance += transmission * alpha * emission;
    transmission *= 1.0 - alpha;
  }

  vec3 sphericalStarCell(
    vec2 id, vec2 offset, float scale, float seed, float cosLatitude, vec3 covariance
  ) {
    // Canonical longitude IDs make the hash field periodic at +/- pi.
    id.x = mod(id.x, scale);
    if (id.y < 0.0 || id.y >= scale * 0.5) return vec3(0.0);
    vec2 key = id + vec2(seed, seed * 1.73);
    float exists = step(scale < 900.0 ? 0.84 : 0.91, hash21(key + vec2(5.19, 12.71)));
    if (exists < 0.5) return vec3(0.0);
    vec2 center = 0.2 + 0.6 * hash22(key + vec2(23.1, 8.7));
    offset -= center;
    offset.x *= cosLatitude;

    float size = mix(0.03, 0.08, pow(hash21(key + vec2(41.3, 79.7)), 2.0));
    float size2 = size * size;
    float varianceX = size2 + covariance.x;
    float varianceY = size2 + covariance.z;
    float determinant = max(0.000000001, varianceX * varianceY - covariance.y * covariance.y);
    float distance2 = (varianceY * offset.x * offset.x
      - 2.0 * covariance.y * offset.x * offset.y + varianceX * offset.y * offset.y) / determinant;
    if (distance2 > 16.0) return vec3(0.0);
    float core = exp(-distance2) * size2 * inversesqrt(determinant);
    core *= 1.0 - smoothstep(9.0, 16.0, distance2);

    // Independent luminosity, spectrum, phase and frequency: mostly tiny cool
    // points, scattered warm stars and a few brighter reference stars.
    float brightness = mix(0.35, 3.8, pow(hash21(key + vec2(61.7, 3.9)), 4.0));
    float amplitude = 0.08 + 0.14 * hash21(key + vec2(91.1, 17.3));
    float phase = TAU * hash21(key + vec2(7.7, 137.9));
    float frequency = 0.33 + 1.63 * hash21(key + vec2(173.3, 47.1));
    float twinkle = 1.0 - amplitude + amplitude * sin(uTime * frequency + phase);
    float spectrum = hash21(key + vec2(113.7, 53.9));
    vec3 tint = mix(vec3(0.56, 0.72, 1.0), vec3(1.0, 0.96, 0.91),
      smoothstep(0.08, 0.72, spectrum));
    tint = mix(tint, vec3(1.0, 0.67, 0.38), smoothstep(0.78, 0.98, spectrum));
    return tint * core * brightness * twinkle;
  }

  vec3 sphericalStarLayer(vec3 direction, float angularPixel, float scale, float seed) {
    vec2 spherical = vec2(
      atan(direction.z, direction.x) / TAU + 0.5,
      asin(clamp(direction.y, -1.0, 1.0)) / PI + 0.5
    );
    vec2 grid = spherical * vec2(scale, scale * 0.5);
    vec2 id = floor(grid);
    float cosLatitude = max(0.12, length(direction.xz));
    vec3 longitude = normalize(vec3(-direction.z, 0.0, direction.x) + vec3(0.000001, 0.0, 0.0));
    vec3 latitude = normalize(cross(longitude, direction));
    vec3 dx = dFdx(direction);
    vec3 dy = dFdy(direction);
    vec2 gx = vec2(dot(dx, longitude), dot(dx, latitude)) * (scale / TAU);
    vec2 gy = vec2(dot(dy, longitude), dot(dy, latitude)) * (scale / TAU);
    float beam = max(0.006, angularPixel * scale / TAU * 0.35);
    // Full covariance, not max(dFdx,dFdy) as an isotropic blur. A source stays
    // sharp along its stretched image instead of fading away near the lens.
    vec3 covariance = vec3(gx.x * gx.x + gy.x * gy.x,
      gx.x * gx.y + gy.x * gy.y, gx.y * gx.y + gy.y * gy.y) * 0.35;
    covariance.xz += vec2(beam * beam);
    vec2 offset = fract(grid);
    vec3 stars = sphericalStarCell(id, offset, scale, seed, cosLatitude, covariance);
    // Only highly deflected pixels need neighbouring source cells. This keeps
    // the far field cheap and avoids grid-clipped arcs at the Einstein images.
    if (max(covariance.x, covariance.z) > 0.02) {
      for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
          if (x == 0 && y == 0) continue;
          vec2 neighbour = vec2(float(x), float(y));
          stars += sphericalStarCell(id + neighbour, offset - neighbour,
            scale, seed, cosLatitude, covariance);
        }
      }
    }
    return stars;
  }

  void main() {
    if (uOpacity < 0.0001 || uIntro <= 0.0) {
      gl_FragColor = vec4(0.0);
      cleanStars = vec4(0.0);
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
    // Standard derivatives are available to the GLSL3 MRT material on WebGL2.
    // The fallback also supports the previous uniform contract.
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
    float angularPixel = rayCone;
    vec3 stars = sphericalStarLayer(skyDirection, angularPixel, 620.0, 3.1);
    if (uQuality > 0.4) {
      stars += 0.72 * sphericalStarLayer(skyDirection, angularPixel, 1080.0, 47.7);
    }
    // Coverage is disk emission only. The post pass must never infer it from
    // the combined sky color: a lensed star is still a clean star, not a petal.
    // A blue-violet emitter has low photopic luminance. Coverage follows its
    // strongest emitting channel so its outskirts do not lose their ASCII mask.
    float diskCoverage = smoothstep(0.0004, 0.012, max(max(radiance.r, radiance.g), radiance.b));
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
