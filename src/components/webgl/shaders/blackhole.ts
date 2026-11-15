import { glslNoise } from "./common";

/**
 * ЧЁРНАЯ ДЫРА (hero) — один fullscreen-квад, вся сцена в фрагментном шейдере.
 *
 * Почему не настоящий raymarching: он стоит десятки шагов на пиксель и убивает
 * мобилки. Здесь вместо физики — визуальная подделка, которая читается как
 * гравитационное линзирование:
 *
 *  1. Луч «искривляется» к центру: чем ближе к дыре, тем сильнее сдвигается
 *     точка сэмплирования фона (warped).
 *  2. Фон — три слоя звёзд с мерцанием и параллаксом.
 *  3. Аккреционный диск — наклонённое кольцо из fbm-шума, вращается.
 *  4. Фотонное кольцо + чёрная тень + ударная волна от клика.
 *
 * Стоимость: линейная, без циклов по сцене. На слабых устройствах uQuality
 * уменьшает число октав и слоёв звёзд.
 */
export const blackholeVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const blackholeFragment = /* glsl */ `
  precision highp float;

  varying vec2 vUv;
  uniform float uTime;
  uniform float uAspect;
  uniform vec2 uPointer;   // -1..1, сглаженный курсор
  uniform float uPulse;    // 0..1 — ударная волна после клика
  uniform float uIntro;    // 0..1 — появление сцены
  uniform float uQuality;  // 1.0 = десктоп, 0.0 = слабое устройство
  uniform float uOpacity;
  uniform float uCollapse; // 0..1 — пасхалка «сингулярность»
  uniform float uZoom;     // >1 — дыра меньше (нужно на узких экранах)
  uniform vec2 uCenter;    // смещение дыры в кадре (не по центру — по композиции)

  ${glslNoise}

  // Три слоя звёзд: разные масштабы дают глубину
  float starLayer(vec2 p, float scale, float threshold, float seed) {
    vec2 g = p * scale + seed;
    vec2 id = floor(g);
    vec2 f = fract(g) - 0.5;
    float h = hash21(id);
    // одиночная яркая точка в ячейке
    float bright = step(threshold, h);
    float core = smoothstep(0.16, 0.0, length(f));
    float twinkle = 0.45 + 0.55 * sin(uTime * 1.7 + h * 52.0);
    return bright * core * twinkle;
  }

  void main() {
    // «Плоские» координаты пикселя: x учитывает пропорции экрана
    vec2 sp = (vUv - 0.5) * vec2(uAspect, 1.0);

    // Параллакс: вся сцена едва заметно уезжает за курсором
    vec2 parallax = uPointer * 0.03;
    // uZoom отдаляет точку сэмплирования — объект кажется меньше
    vec2 p = (sp - uCenter - parallax) * uZoom;

    // Пасхалка: пространство стягивается к дыре, потом отпускает
    float collapse = uCollapse;
    p *= 1.0 - collapse * 0.42;

    float intro = smoothstep(0.0, 1.0, uIntro);

    float r = length(p);
    // Направление от центра; +1e-5 защищает от деления на ноль
    vec2 dir = p / (r + 1e-5);

    // --- 1. Линзирование ------------------------------------------------
    // Искривление сильнее у центра (1/(r+0.1)), звёзды рядом с дырой буквально
    // «затягивает» по окружности.
    float bend = (0.042 / (r + 0.09)) * (1.0 + collapse * 1.7);
    vec2 warped = p - dir * bend;
    // Тангенциальное закручивание: то, что делает кольцо Эйнштейна
    float swirlAngle = bend * 1.8;
    warped = rot(swirlAngle) * warped;

    // --- 2. Фон: звёзды ------------------------------------------------
    float stars = 0.0;
    stars += starLayer(warped, 42.0, 0.9905, 3.1) * 1.00;
    if (uQuality > 0.4) {
      stars += starLayer(warped, 78.0, 0.994, 11.7) * 0.7;
      stars += starLayer(warped, 128.0, 0.996, 27.3) * 0.5;
    }

    // Цвет далёких звёзд: холодный ирис с редкими янтарными вкраплениями
    vec3 starTint = mix(vec3(0.72, 0.66, 1.0), vec3(1.0, 0.82, 0.60), hash21(floor(warped * 20.0)));

    // Пыль: очень слабый fbm, чтобы пустота не была стерильной
    float dust = fbm(p * 2.4 + vec2(uTime * 0.01, 0.0), uQuality > 0.4 ? 4 : 2);
    vec3 col = vec3(0.010, 0.010, 0.018);
    col += vec3(0.035, 0.032, 0.075) * dust * 0.6;
    col += starTint * stars * 1.15;

    // --- 3. Аккреционный диск ------------------------------------------
    const float R = 0.168;          // радиус горизонта событий
    vec2 d = rot(-0.22) * p;
    // Приплюснутая полярная система: диск читается как лежащий в плоскости,
    // а не как круг перед камерой
    const float SQUASH = 0.30;
    vec2 de = vec2(d.x, d.y / SQUASH);
    float dr = length(de);
    float ang = atan(de.y, de.x);

    // Кольцо: от горизонта событий наружу, с мягкими краями
    float inner = smoothstep(R * 0.98, R * 1.34, dr);
    float outer = smoothstep(0.54, 0.26, dr);
    float band = inner * outer;

    // Завихрения: шум по углу и радиусу, медленно вращается вокруг дыры
    float streak = fbm(vec2(ang * 1.5 + dr * 2.6, dr * 9.0 - uTime * 0.45), uQuality > 0.4 ? 5 : 3);
    streak = pow(clamp(streak, 0.0, 1.0), 1.35);
    float disk = band * (0.22 + 1.5 * streak);

    // Раскалённый внутренний край у самого горизонта
    float rim = exp(-abs(dr - R * 1.14) * 24.0) * 0.8;

    vec3 hot = vec3(1.00, 0.80, 0.50);
    vec3 cool = vec3(0.52, 0.38, 1.0);
    vec3 diskCol = mix(hot, cool, smoothstep(R, 0.58, dr));
    diskCol += hot * rim;

    // Диск виден только снаружи тени, с мягким краем
    float shadowMask = smoothstep(R * 0.95, R * 1.10, dr);
    col += diskCol * disk * shadowMask * (0.95 + collapse * 1.2);

    // --- 4. Тень, фотонное кольцо, волна -------------------------------
    // Тень — просто гасим всё внутри радиуса
    float shadow = smoothstep(R * 1.06, R * 0.80, r);
    col *= (1.0 - shadow * 0.99);

    // Фотонное кольцо: тонкая яркая окружность на границе
    float ring = exp(-abs(r - R * 1.03) * 130.0);
    col += vec3(0.80, 0.76, 1.0) * ring * (0.75 + collapse * 2.1);

    // Вспышка сингулярности: короткое свечение вокруг горизонта
    col += vec3(0.62, 0.54, 1.0) * collapse * collapse * 0.16 * smoothstep(0.9, 0.0, r);
    // и приток звёзд к центру — ощущение всасывания
    col += starTint * stars * collapse * 0.9;

    // Ударная волна от клика: расходящееся кольцо с затуханием
    if (uPulse > 0.001) {
      float waveR = R + uPulse * 1.1;
      float wave = exp(-abs(r - waveR) * 70.0) * (1.0 - uPulse);
      col += vec3(0.55, 0.48, 1.0) * wave * 1.1;
      // лёгкое возмущение самого диска
      col += diskCol * disk * wave * 0.35;
    }

    // --- 5. Пост ---------------------------------------------------------
    // Виньетка по экранным координатам: края тонут в бездне
    float vig = smoothstep(1.05, 0.15, length(sp * vec2(0.82, 1.0)));
    col *= 0.30 + 0.70 * vig;

    // Тонкая коррекция: чуть больше контраста в тенях
    col = pow(max(col, 0.0), vec3(0.95));

    gl_FragColor = vec4(col * intro, uOpacity * intro);
  }
`;
