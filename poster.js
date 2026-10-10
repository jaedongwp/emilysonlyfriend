const scene = document.querySelector(".scene");
const picture = scene.querySelector("img");
const canvas = scene.querySelector(".light");
const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false });
const isStill = matchMedia("(prefers-reduced-motion: reduce)").matches;

const region = { left: 0, top: 560, width: 1350, height: 920 };
const girlBox = { left: 745, top: 1110, width: 110, height: 195 };
const lightMapShrink = 6;
const bufferScale = Math.min(devicePixelRatio || 1, 2) * 0.6;

const vertexSource = `
attribute vec2 corner;
void main() { gl_Position = vec4(corner, 0.0, 1.0); }
`;

const fragmentSource = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 bufferSize;
uniform vec3 cover;
uniform float time;
uniform float level;
uniform sampler2D lightMap;
uniform sampler2D picture;
uniform sampler2D girl;
const vec4 region = vec4(${region.left}.0, ${region.top}.0, ${region.width}.0, ${region.height}.0);
const vec4 girlBox = vec4(${girlBox.left}.0, ${girlBox.top}.0, ${girlBox.width}.0, ${girlBox.height}.0);
const vec2 windowCentre = vec2(492.0, 818.0);
const vec2 windowHalf = vec2(70.0, 57.0);
const vec3 warm = vec3(1.0, 0.82, 0.6);
const vec3 cold = vec3(0.36, 0.42, 0.56);
const vec3 unlitWall = vec3(0.065, 0.062, 0.1);

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
  float sum = 0.0;
  float amplitude = 0.5;
  mat2 turn = mat2(1.6, 1.2, -1.2, 1.6);
  for (int octave = 0; octave < 5; octave++) {
    sum += amplitude * noise(p);
    p = turn * p;
    amplitude *= 0.5;
  }
  return sum;
}

float windowLightAt(vec2 p) {
  vec3 colour = texture2D(lightMap, (p - region.xy) / region.zw).rgb;
  float brightness = dot(colour, vec3(0.3333));
  return smoothstep(0.12, 0.5, brightness) * smoothstep(-0.01, 0.06, colour.r - colour.b);
}

float warmthAt(vec2 p) {
  vec3 colour = texture2D(picture, (p - region.xy) / region.zw).rgb;
  return smoothstep(-0.02, 0.05, colour.r - colour.b);
}

float girlAt(vec2 p) {
  vec2 inBox = (p - girlBox.xy) / girlBox.zw;
  if (any(lessThan(inBox, vec2(0.0))) || any(greaterThan(inBox, vec2(1.0)))) return 0.0;
  float brightness = dot(texture2D(girl, inBox).rgb, vec3(0.3333));
  return 1.0 - smoothstep(0.17, 0.205, brightness);
}

float fogAt(vec2 p) {
  vec2 q = p / 260.0 - vec2(time * 0.045, 0.0);
  vec2 warp = vec2(fbm(q + vec2(0.0, time * 0.03)), fbm(q + vec2(5.2, 1.3) - vec2(time * 0.02, 0.0)));
  float billow = fbm(q + 1.8 * warp + vec2(-time * 0.02, time * 0.015));
  float height = (1290.0 - p.y) / 260.0;
  float density = smoothstep(0.3 + height * 0.3, 0.74 + height * 0.15, billow);
  float ground = smoothstep(1305.0, 1255.0, p.y);
  float leftOfTheFence = smoothstep(1060.0, 880.0, p.x);
  return density * ground * leftOfTheFence;
}

float raysAt(vec2 p) {
  vec2 away = p - windowCentre;
  float angle = atan(away.x, away.y);
  float streak = noise(vec2(angle * 38.0, time * 0.25)) * noise(vec2(angle * 11.0 - time * 0.05, length(away) * 0.002 - time * 0.12));
  return smoothstep(0.15, 0.6, streak) * smoothstep(70.0, 200.0, length(away));
}

float motesAt(vec2 p) {
  const float cell = 64.0;
  vec2 grid = (p + vec2(time * 7.0, -time * 4.0)) / cell;
  vec2 home = floor(grid);
  float sum = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 id = home + vec2(float(x), float(y));
      float seed = hash(id);
      if (seed > 0.45) continue;
      float a = hash(id + 17.3);
      float b = hash(id + 31.7);
      vec2 mote = id + vec2(a, b) + 0.35 * vec2(sin(time * 0.4 + seed * 40.0), cos(time * 0.33 + a * 30.0));
      float distance = length(grid - mote) * cell;
      float size = 3.0 + 3.5 * b;
      float twinkle = 0.6 + 0.4 * sin(time * (1.0 + a * 2.0) + seed * 20.0);
      sum += smoothstep(size, size * 0.3, distance) * twinkle;
    }
  }
  return sum;
}

float glowAt(vec2 p) {
  vec2 outside = max(abs((p - windowCentre) / vec2(1.0, 1.15)) - windowHalf, 0.0);
  return exp(-length(outside) / 55.0);
}

vec4 over(vec4 top, vec4 under) {
  return top + under * (1.0 - top.a);
}

void main() {
  vec2 p = (vec2(gl_FragCoord.x, bufferSize.y - gl_FragCoord.y) - cover.xy) / cover.z;
  if (p.y < region.y || p.y > region.y + region.w) {
    gl_FragColor = vec4(0.0);
    return;
  }
  float lit = windowLightAt(p);
  float clear = 1.0 - girlAt(p);
  float shining = lit * level;

  float dimming = (1.0 - level) * warmthAt(p);
  vec4 dimmed = vec4(unlitWall * dimming, dimming);
  float fog = fogAt(p) * mix(0.4, 0.75, shining) * clear;
  vec4 colour = over(vec4(mix(cold, warm, shining) * fog, fog), dimmed);
  float light = clamp(glowAt(p) * 0.3 * level + raysAt(p) * 0.12 * shining + motesAt(p) * 0.8 * shining, 0.0, 1.0) * clear;
  gl_FragColor = over(vec4(warm * light, light), colour);
}
`;

function compile(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return shader;
}

function link() {
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexSource));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSource));
  gl.linkProgram(program);
  return gl.getProgramParameter(program, gl.LINK_STATUS) ? program : null;
}

function cropOfThePicture(box, shrink) {
  const crop = document.createElement("canvas");
  crop.width = Math.round(box.width / shrink);
  crop.height = Math.round(box.height / shrink);
  const scale = picture.naturalWidth / 1350;
  crop.getContext("2d").drawImage(picture, box.left * scale, box.top * scale, box.width * scale, box.height * scale, 0, 0, crop.width, crop.height);
  return crop;
}

function texture(unit, image) {
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
}

function breathingAt(seconds) {
  return 0.97 + 0.03 * Math.sin(seconds * 1.7) * Math.sin(seconds * 0.63);
}

function fitTheBuffer(cover) {
  canvas.width = Math.max(1, Math.round(canvas.clientWidth * bufferScale));
  canvas.height = Math.max(1, Math.round(canvas.clientHeight * bufferScale));
  gl.viewport(0, 0, canvas.width, canvas.height);
  const scale = Math.max(canvas.width / 1350, canvas.height / 2400);
  gl.uniform3f(cover, (canvas.width - 1350 * scale) * 0.5, (canvas.height - 2400 * scale) * 0.44, scale);
}

function start(program) {
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const corner = gl.getAttribLocation(program, "corner");
  gl.enableVertexAttribArray(corner);
  gl.vertexAttribPointer(corner, 2, gl.FLOAT, false, 0, 0);

  texture(0, cropOfThePicture(region, lightMapShrink));
  texture(1, cropOfThePicture(region, 2));
  texture(2, cropOfThePicture(girlBox, 1));
  gl.uniform1i(gl.getUniformLocation(program, "lightMap"), 0);
  gl.uniform1i(gl.getUniformLocation(program, "picture"), 1);
  gl.uniform1i(gl.getUniformLocation(program, "girl"), 2);
  const bufferSize = gl.getUniformLocation(program, "bufferSize");
  const time = gl.getUniformLocation(program, "time");
  const level = gl.getUniformLocation(program, "level");
  const cover = gl.getUniformLocation(program, "cover");

  const startedAt = performance.now();
  const draw = (now) => {
    const seconds = (now - startedAt) / 1000;
    gl.uniform2f(bufferSize, canvas.width, canvas.height);
    gl.uniform1f(time, seconds + 40);
    gl.uniform1f(level, isStill ? 1 : breathingAt(seconds));
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };
  const drawEveryFrame = (now) => {
    draw(now);
    requestAnimationFrame(drawEveryFrame);
  };

  fitTheBuffer(cover);
  new ResizeObserver(() => {
    fitTheBuffer(cover);
    if (isStill) draw(startedAt);
  }).observe(canvas);
  requestAnimationFrame(isStill ? draw : drawEveryFrame);
  canvas.classList.add("lit");
}

const program = gl && link();
if (program) picture.decode().then(() => start(program), () => {});
