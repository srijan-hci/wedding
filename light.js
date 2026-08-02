/* ============================================================
   THE LIGHT

   A port of the hero effect on microsoft.ai, read from their
   BlockGL-Dh1-xzDN.js and rebuilt pass for pass. Their bokeh and
   voronoi shaders carry the credit "Adapted from unicorn.studio";
   that credit is kept below where each one appears.

   It replaces the 2.6 MB shadow video and downloads nothing.

   ------------------------------------------------------------
   HOW IT WORKS

   Four passes, each drawing into a buffer the next one reads.

     1 VIGNETTE  a soft ellipse centred on your cursor. Inside it,
                 transparent. Outside, a deep plum. This is the only
                 pass the cursor touches, and it is the whole of the
                 light. There is no noise anywhere in this effect.

     2 SINE      bends the picture with two sine waves, so the edge
                 of that ellipse stops being a circle and undulates.

     3 SHATTER   a voronoi cell pattern. Every cell shifts its own
                 slice of the image, which tears the soft ellipse
                 into separate finger-shaped streaks. The cells are
                 rotated 44 degrees and squashed, which is why the
                 fingers run diagonally.

     4 BOKEH     fifty taps around a golden-angle spiral, weighted so
                 bright pixels smear into soft discs and dim ones
                 barely move. This is what makes it read as light
                 that is out of focus rather than as a blur.

   Then it composites as a 26% multiply. It is not additive light.
   The area near your cursor keeps a warm cream tone and everything
   else is gently darkened by the plum.

   ------------------------------------------------------------
   ONE DEPARTURE FROM THEIRS

   Their final shader builds a background by overlaying a 1.4 MB
   photograph onto a flat pink, then multiplies the light over it:

       base * mix(vec3(1.0), blend, 0.26)

   Our background is the terracotta wall that is already on the page,
   so this canvas outputs only the second half of that expression and
   the CSS layer multiplies it over the wall. Same arithmetic, no
   photograph to download, and the wall keeps its own colour wherever
   no light is falling.

   ------------------------------------------------------------
   IF YOU WANT TO CHANGE HOW IT LOOKS, EDIT CONFIG BELOW.
   Every value carries the number microsoft.ai ships with, so you can
   always find your way back.
   ------------------------------------------------------------
   ============================================================ */
(function () {
  "use strict";

  var CONFIG = {
    /* ---------- Colour ----------
       warm    the tone left behind where the light pools, which is
               wherever your cursor is.
       shadow  the tone everything else is tinted toward. microsoft.ai
               uses a deep plum, #4a0035, which suits their pink
               background. Measured against our terracotta wall that
               plum pulls the hue 4 degrees toward magenta and leaves
               it dusty. This warm brown is the same darkness with
               zero hue shift, so the wall stays terracotta.
       clear   the colour inside the ellipse before blurring. Almost
               invisible in the result; it only shows at the very soft
               edge. */
    warm: "#FFD198",
    shadow: "#4a1c0c",
    clear: "#FFAAA5",

    /* How much of the effect reaches the wall. Their number is 0.26.
       0 leaves the wall completely alone, 1 applies it at full force
       and will darken the page a great deal. */
    strength: 0.26,

    /* ---------- 1. The ellipse ----------
       radius   how large the pool of light is.
       falloff  how gradually its edge fades. microsoft.ai ships 1.0.
                Raised to 1.5 at your request, which widens the band the
                light fades across by half again and takes roughly a
                quarter of the hardness out of every edge.
       skew     shape of the ellipse. 0.5 is round.
       angle    rotates it. 0 to 1 is a full turn. */
    vignetteRadius: 0.354,
    vignetteFalloff: 1.5,
    vignetteSkew: 0.54,
    vignetteAngle: 0.0,

    /* ---------- 2. The waves ----------
       frequency  how many undulations across the screen.
       amplitude  how far they push the picture around. */
    sineFrequency: 0.35,
    sineAmplitude: 1.18,

    /* ---------- 3. The voronoi cells ----------
       scale   how many cells fit across the screen. Higher means
               smaller, more numerous fingers.
       spread  how far each cell shifts its slice of the picture.
               This is what separates the fingers from each other.
       angle   direction the fingers run, in degrees.
       skew    how stretched each cell is. Their 0.84 is what makes
               the fingers long and thin rather than blobby. */
    shatterScale: 0.534,
    shatterSpread: 1.0,
    shatterAngle: 44,
    shatterSkew: 0.84,

    /* ---------- 4. The blur ----------
       radius      how far the light smears. microsoft.ai effectively
                   uses 0.003. Nudged up to 0.0035, which softens the
                   edges without costing anything: the sample count is
                   what sets the price, not how far apart they sit.
       highlights  how much harder bright pixels smear than dim ones.
                   This is the number that decides whether it looks
                   like light or like ordinary blur. Lower it and the
                   whole thing goes flat. Baked into the shader at
                   load, so changing it needs a reload.
       samples     quality of the smear. Fifty is theirs. Reduced on
                   phones automatically. Also needs a reload. */
    bokehRadius: 0.0035,
    bokehHighlights: 9.0,
    bokehSamples: 50,
    mobileBokehSamples: 24,

    /* ---------- Movement ----------
       ease   how lazily the light catches up with your cursor.
              Small is slow and heavy, large is snappy.
       speed  how fast the waves and cells drift when you are not
              moving the cursor at all. */
    ease: 0.1,
    speed: 2.0,

    /* ---------- Quality ----------
       renderScale  fraction of screen size actually drawn, then
                    stretched up. Everything is soft enough that half
                    size is invisible and costs a quarter as much.
                    This is exactly what microsoft.ai does. */
    renderScale: 0.5,
    mobileRenderScale: 0.4,
    maxPixels: 620000
  };

  /* ============================================================
     From here down is plumbing.
     ============================================================ */

  var canvas = document.querySelector(".light-canvas");
  if (!canvas) return;

  var layer = canvas.closest(".light-layer") || canvas.parentElement;

  function giveUp() {
    /* No WebGL, or a buffer would not allocate. Hide the layer and
       let the plain terracotta wall show through. The page is
       designed to look right without this. */
    if (layer) layer.style.display = "none";
  }

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var gl = null;
  try {
    var attrs = {
      alpha: true,
      depth: false,
      stencil: false,
      antialias: false,
      premultipliedAlpha: false,
      /* Reduced motion draws exactly one frame and never again, so the
         buffer has to survive compositing. Everything else redraws every
         frame, where keeping the buffer costs memory bandwidth for nothing. */
      preserveDrawingBuffer: reduced,
      powerPreference: "low-power"
    };
    gl =
      canvas.getContext("webgl2", attrs) ||
      canvas.getContext("webgl", attrs) ||
      canvas.getContext("experimental-webgl", attrs);
  } catch (e) {
    gl = null;
  }

  if (!gl) {
    giveUp();
    return;
  }

  var small = window.matchMedia("(max-width: 760px)").matches;

  var samples = small ? CONFIG.mobileBokehSamples : CONFIG.bokehSamples;
  var renderScale = small ? CONFIG.mobileRenderScale : CONFIG.renderScale;

  function hexToRgb(hex) {
    var s = hex.replace("#", "");
    if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
    var n = parseInt(s, 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }

  /* ============================================================
     SHADERS

     Written in GLSL ES 1.00. A WebGL2 context accepts it, so one set
     covers both and there is no second copy to keep in step.
     ============================================================ */

  var VERT = [
    "attribute vec2 aPos;",
    "varying vec2 vUv;",
    "void main() {",
    "  vUv = aPos * 0.5 + 0.5;",
    "  gl_Position = vec4(aPos, 0.0, 1.0);",
    "}"
  ].join("\n");

  /* ---------- 1. VIGNETTE ----------
     The light itself. Everything after this only distorts and blurs
     whatever shape comes out of here. */
  var VIGNETTE_FRAG = [
    "precision highp float;",
    "#define TWO_PI 6.28318530718",
    "varying vec2 vUv;",
    "uniform float uRadius;",
    "uniform float uFalloff;",
    "uniform float uSkew;",
    "uniform float uAngle;",
    "uniform vec3  uVignetteColor;",
    "uniform vec3  uClearColor;",
    "uniform vec2  uPos;",
    "uniform vec2  uResolution;",
    "",
    "mat2 rot(float a) {",
    "  return mat2(cos(a), -sin(a), sin(a), cos(a));",
    "}",
    "",
    "void main() {",
    "  vec2 uv = vUv;",
    "  vec2 aspectRatio = vec2(uResolution.x / uResolution.y, 1.0);",
    "  vec2 skew = vec2(uSkew, 1.0 - uSkew);",
    "  float halfRadius = uRadius * 0.5;",
    "  float innerEdge = halfRadius - uFalloff * halfRadius * 0.5;",
    "  float outerEdge = halfRadius + uFalloff * halfRadius * 0.5;",
    "  vec2 scaledUV  = uv    * aspectRatio * rot(uAngle * TWO_PI) * skew;",
    "  vec2 scaledPos = uPos  * aspectRatio * rot(uAngle * TWO_PI) * skew;",
    "  float radius = distance(scaledUV, scaledPos);",
    "  float falloff = smoothstep(innerEdge, outerEdge, radius);",
    /* Transparent in the middle, solid plum outside. The alpha is
       what the final composite reads to decide warm versus shadow. */
    "  gl_FragColor = mix(vec4(uClearColor, 0.0), vec4(uVignetteColor, 1.0), falloff);",
    "}"
  ].join("\n");

  /* ---------- 2. SINE ----------
     Two sine waves pushing the picture sideways, so the ellipse edge
     stops reading as a circle. */
  var SINE_FRAG = [
    "precision mediump float;",
    "#define PI3 1.04709283144",
    "varying vec2 vUv;",
    "uniform sampler2D tInput;",
    "uniform vec2  uPos;",
    "uniform float uFrequency;",
    "uniform float uAmplitude;",
    "uniform float uTime;",
    "",
    "void main() {",
    "  vec2 waveCoord = vUv * 2.0 - 1.0;",
    "  float time = uTime * 0.25;",
    "  float frequency = 20.0 * uFrequency;",
    "  float amp = uAmplitude * 0.2;",
    "  float waveX = sin((waveCoord.y + uPos.y) * frequency + (time * PI3)) * amp;",
    /* Their rotation setting is 0, which selects the horizontal wave
       and drops the vertical one entirely. */
    "  waveCoord.x += waveX;",
    "  vec2 finalUV = waveCoord * 0.5 + 0.5;",
    "  gl_FragColor = texture2D(tInput, finalUV);",
    "}"
  ].join("\n");

  /* ---------- 3. SHATTER ----------
     Adapted from https://www.unicorn.studio/edit/g3lEVXT6g6U6duHP3YRy
     via microsoft.ai, which carries the same credit.

     A voronoi pattern. Each cell offsets its own slice of the image,
     which is what breaks the soft ellipse into separate fingers. */
  var SHATTER_FRAG = [
    "precision mediump float;",
    "#define PI 3.14159265359",
    "varying vec2 vUv;",
    "uniform sampler2D tInput;",
    "uniform float uAmount;",
    "uniform float uSpread;",
    "uniform float uAngle;",
    "uniform float uSkew;",
    "uniform float uTime;",
    "uniform vec2  uPos;",
    "uniform vec2  uResolution;",
    "",
    "vec2 random2(vec2 p) {",
    "  return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453);",
    "}",
    "",
    "mat2 rot(float a) {",
    "  return mat2(cos(a), -sin(a), sin(a), cos(a));",
    "}",
    "",
    "void main() {",
    "  vec2 uv = vUv;",
    "  float aspectRatio = uResolution.x / uResolution.y;",
    "  vec2 skew = mix(vec2(1.0), vec2(1.0, 0.0), uSkew);",
    "  vec2 st = (uv - uPos) * vec2(aspectRatio, 1.0) * 50.0 * uAmount;",
    "  st = st * rot(uAngle * 2.0 * PI) * skew;",
    "  vec2 i_st = floor(st);",
    "  vec2 f_st = fract(st);",
    "  float m_dist = 15.0;",
    "  vec2 m_point = vec2(0.0);",
    /* Nine cells: the one we are in plus its eight neighbours. The
       nearest seed point wins, and its position becomes the offset. */
    "  for (int j = -1; j <= 1; j++) {",
    "    for (int i = -1; i <= 1; i++) {",
    "      vec2 neighbor = vec2(float(i), float(j));",
    "      vec2 point = random2(i_st + neighbor);",
    /* The seed drifts on a slow circle, which is what makes the
       fingers move when nothing else is happening. */
    "      point = 0.5 + 0.5 * sin(5.0 + uTime * 0.2 + 6.2831 * point);",
    "      vec2 diff = neighbor + point - f_st;",
    "      float dist = length(diff);",
    "      if (dist < m_dist) {",
    "        m_dist = dist;",
    "        m_point = point;",
    "      }",
    "    }",
    "  }",
    "  vec2 offset = (m_point * 0.2 * uSpread * 2.0) - (uSpread * 0.2);",
    "  gl_FragColor = texture2D(tInput, uv + offset);",
    "}"
  ].join("\n");

  /* ---------- 4. BOKEH ----------
     Adapted from https://www.unicorn.studio/edit/g3lEVXT6g6U6duHP3YRy
     via microsoft.ai, which carries the same credit.

     Note: their version computes a blurRadius from a tilt setting and
     then never passes it to the sampling loop, so the radius is in
     practice fixed. This reproduces the behaviour rather than the
     dead code, and exposes the fixed radius as bokehRadius. */
  var BOKEH_FRAG = [
    "precision highp float;",
    "#define PI2 6.28318530718",
    "#define ITERATIONS " + samples + ".0",
    "#define HIGHLIGHTS " + CONFIG.bokehHighlights.toFixed(1),
    "#define GOLDEN_ANGLE 2.39996323",
    "varying vec2 vUv;",
    "uniform sampler2D tInput;",
    "uniform sampler2D tBlueNoise;",
    "uniform vec2  uBlueNoiseResolution;",
    "uniform vec2  uResolution;",
    "uniform float uAmount;",
    "",
    /* Each step pushes the radius out by 1/r, which spaces the taps
       evenly over a disc with no repeating pattern. This is why fifty
       taps look like hundreds. */
    "vec2 Sample(in float theta, inout float r) {",
    "  r += 1.0 / r;",
    "  return (r - 1.0) * vec2(cos(theta), sin(theta));",
    "}",
    "",
    "float getBlueNoiseOffset(vec2 st) {",
    "  vec2 texSize = uBlueNoiseResolution;",
    "  vec2 coord = fract(st * uResolution / texSize * vec2(texSize.x / texSize.y, 1.0));",
    "  float n = texture2D(tBlueNoise, coord).r;",
    "  return mod((n - 0.5) * PI2, PI2);",
    "}",
    "",
    "void main() {",
    "  vec2 uv = vUv;",
    "  float aspectRatio = uResolution.x / uResolution.y;",
    "  vec2 pixelSize = vec2(1.0 / aspectRatio, 1.0) * uAmount;",
    "",
    "  vec3 accumulatedColor = vec3(0.0);",
    "  vec3 accumulatedWeights = vec3(0.0);",
    "  float accumulatedAlpha = 0.0;",
    "  float r = 1.0;",
    "",
    "  float noiseOffset = (getBlueNoiseOffset(uv) - 0.5) * 0.01;",
    "  float noiseAngle = noiseOffset * PI2;",
    "  mat2 rotationMatrix = mat2(",
    "    cos(noiseAngle), -sin(noiseAngle),",
    "    sin(noiseAngle),  cos(noiseAngle)",
    "  );",
    "",
    "  for (float j = 0.0; j < GOLDEN_ANGLE * ITERATIONS; j += GOLDEN_ANGLE) {",
    "    vec2 offset = Sample(j, r) * pixelSize;",
    "    float jitterAmount = 0.05 * (sin(j * 0.1) * 0.5 + 0.5);",
    "    offset *= 1.0 + jitterAmount * sin(j * 0.7 + noiseOffset);",
    "    vec2 sampleOffset = rotationMatrix * offset;",
    "    vec4 colorSample = texture2D(tInput, uv + sampleOffset);",
    /* Bright taps count for vastly more than dim ones. Without this
       the whole thing is an ordinary blur; with it, highlights bloom
       into discs and it reads as light out of focus.

       HIGHLIGHTS is baked in as a literal rather than passed as a
       uniform, which matters far more than it looks. With a constant
       exponent the compiler turns pow() into a handful of multiplies;
       with a uniform it has to emit a real exp2/log2 pair, 150 times
       per pixel. Measured: 30fps as a uniform, 120fps as a literal. */
    "    vec3 bokehWeight = vec3(5.0) + pow(colorSample.rgb, vec3(HIGHLIGHTS)) * 150.0;",
    "    accumulatedAlpha += colorSample.a;",
    "    accumulatedColor += colorSample.rgb * bokehWeight;",
    "    accumulatedWeights += bokehWeight;",
    "  }",
    "",
    "  gl_FragColor = vec4(accumulatedColor / accumulatedWeights, accumulatedAlpha / ITERATIONS);",
    "}"
  ].join("\n");

  /* ---------- 5. OUTPUT ----------
     Their shader is:

       blend = mix(uOutputColor, tInput.rgb, tInput.a)
       final = base * mix(vec3(1.0), blend, 0.26)

     `base` is their background. Ours is the terracotta wall already
     on the page, so this emits only the second factor and the CSS
     layer multiplies it over the wall. */
  var OUTPUT_FRAG = [
    "precision highp float;",
    "varying vec2 vUv;",
    "uniform sampler2D tInput;",
    "uniform vec3  uWarmColor;",
    "uniform float uStrength;",
    "",
    "void main() {",
    "  vec4 light = texture2D(tInput, vUv);",
    /* Where alpha is 0, the cursor's pool, this is the warm cream.
       Where alpha is 1 it is the plum. */
    "  vec3 blend = mix(uWarmColor, light.rgb, light.a);",
    "  vec3 result = mix(vec3(1.0), blend, uStrength);",
    "  gl_FragColor = vec4(result, 1.0);",
    "}"
  ].join("\n");

  /* ============================================================
     COMPILING
     ============================================================ */

  function compile(type, source) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, source);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      if (window.console && console.warn) {
        console.warn("light.js shader failed:", gl.getShaderInfoLog(sh));
      }
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  function program(fragSource) {
    var vs = compile(gl.VERTEX_SHADER, VERT);
    var fs = compile(gl.FRAGMENT_SHADER, fragSource);
    if (!vs || !fs) return null;
    var prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.bindAttribLocation(prog, 0, "aPos");
    gl.linkProgram(prog);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      if (window.console && console.warn) {
        console.warn("light.js link failed:", gl.getProgramInfoLog(prog));
      }
      return null;
    }
    /* Cache every uniform location up front, so the render loop is
       just setUniform calls. */
    var u = {};
    var count = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
    for (var i = 0; i < count; i++) {
      var name = gl.getActiveUniform(prog, i).name.replace(/\[0\]$/, "");
      u[name] = gl.getUniformLocation(prog, name);
    }
    prog.u = u;
    return prog;
  }

  var progVignette = program(VIGNETTE_FRAG);
  var progSine = program(SINE_FRAG);
  var progShatter = program(SHATTER_FRAG);
  var progBokeh = program(BOKEH_FRAG);
  var progOutput = program(OUTPUT_FRAG);

  if (!progVignette || !progSine || !progShatter || !progBokeh || !progOutput) {
    giveUp();
    return;
  }

  /* ---------- Geometry ----------
     One triangle large enough to cover the screen. Cheaper than two,
     and no seam down the diagonal. */
  var buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  /* ---------- Blue noise ----------
     microsoft.ai downloads a 130 KB noise image for this. It is only
     used to rotate each pixel's sample spiral by a fraction of a
     turn, so the taps never line up into visible rings. Generating it
     here costs nothing and avoids re-hosting someone else's file.

     Void-and-cluster proper is overkill for a rotation offset, so
     this is white noise smoothed against its neighbours, which gets
     most of the way to blue by suppressing low frequencies. */
  function makeBlueNoise(size) {
    var n = size * size;
    var a = new Float32Array(n);
    var i;
    for (i = 0; i < n; i++) a[i] = Math.random();

    for (var pass = 0; pass < 3; pass++) {
      var b = new Float32Array(n);
      for (var y = 0; y < size; y++) {
        for (var x = 0; x < size; x++) {
          var sum = 0;
          for (var dy = -1; dy <= 1; dy++) {
            for (var dx = -1; dx <= 1; dx++) {
              sum += a[((y + dy + size) % size) * size + ((x + dx + size) % size)];
            }
          }
          /* Subtract the local average: what is left is the part of
             the signal that varies fastest. */
          b[y * size + x] = a[y * size + x] - sum / 9;
        }
      }
      var min = Infinity;
      var max = -Infinity;
      for (i = 0; i < n; i++) {
        if (b[i] < min) min = b[i];
        if (b[i] > max) max = b[i];
      }
      var range = max - min || 1;
      for (i = 0; i < n; i++) a[i] = (b[i] - min) / range;
    }

    var px = new Uint8Array(n * 4);
    for (i = 0; i < n; i++) {
      var v = Math.round(a[i] * 255);
      px[i * 4] = v;
      px[i * 4 + 1] = v;
      px[i * 4 + 2] = v;
      px[i * 4 + 3] = 255;
    }
    return px;
  }

  var NOISE_SIZE = 256;
  var noiseTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, noiseTex);
  gl.texImage2D(
    gl.TEXTURE_2D, 0, gl.RGBA, NOISE_SIZE, NOISE_SIZE, 0,
    gl.RGBA, gl.UNSIGNED_BYTE, makeBlueNoise(NOISE_SIZE)
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);

  /* ---------- Ping-pong buffers ----------
     Two are enough: each pass reads one and writes the other, then
     they swap. */
  function makeTarget() {
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    var fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { tex: tex, fb: fb };
  }

  var bufferA = makeTarget();
  var bufferB = makeTarget();

  function swap() {
    var t = bufferA;
    bufferA = bufferB;
    bufferB = t;
  }

  var width = 0;
  var height = 0;

  function resize() {
    /* Only ever called when the viewport has actually changed. Reading
       geometry costs a forced layout, and doing that inside the frame
       loop while main.js is writing transforms made the animation stutter.
       See "Traps" in AGENTS.md. */
    var rect = layer ? layer.getBoundingClientRect() : canvas.getBoundingClientRect();
    var cssW = Math.max(1, Math.round(rect.width || window.innerWidth));
    var cssH = Math.max(1, Math.round(rect.height || window.innerHeight));

    /* Device pixel ratio is deliberately ignored, exactly as
       microsoft.ai does. The image is soft enough that drawing at
       half size and letting the browser stretch it is invisible and
       costs a quarter as much. */
    var w = Math.max(2, Math.round(cssW * renderScale));
    var h = Math.max(2, Math.round(cssH * renderScale));

    var total = w * h;
    if (total > CONFIG.maxPixels) {
      var shrink = Math.sqrt(CONFIG.maxPixels / total);
      w = Math.max(2, Math.round(w * shrink));
      h = Math.max(2, Math.round(h * shrink));
    }

    if (w === width && h === height) return false;

    width = w;
    height = h;
    canvas.width = w;
    canvas.height = h;

    [bufferA, bufferB].forEach(function (b) {
      gl.bindTexture(gl.TEXTURE_2D, b.tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    });
    return true;
  }

  resize();

  /* Check the chain can actually run before committing to it. */
  gl.bindFramebuffer(gl.FRAMEBUFFER, bufferA.fb);
  var complete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  if (!complete) {
    giveUp();
    return;
  }

  /* ---------- Colours ---------- */
  var warm = hexToRgb(CONFIG.warm);
  var shadow = hexToRgb(CONFIG.shadow);
  var clear = hexToRgb(CONFIG.clear);

  /* ---------- The cursor ----------
     This is the whole of the pointer effect, and it is the only place
     the pointer appears. The vignette centre eases toward it a
     fraction each frame; every other pass stays pinned to the middle.

     The pointer spans the full 0 to 1 of the canvas, so the pool of
     light travels the entire width of the screen rather than a
     fraction of it. */
  var pointerX = 0.5;
  var pointerY = 0.5;
  var currX = 0.5;
  var currY = 0.5;

  window.addEventListener(
    "pointermove",
    function (e) {
      var r = canvas.getBoundingClientRect();
      if (!r.width || !r.height) return;
      pointerX = (e.clientX - r.left) / r.width;
      /* Screen coordinates run down, texture coordinates run up. */
      pointerY = 1 - (e.clientY - r.top) / r.height;
    },
    { passive: true }
  );

  /* ============================================================
     DRAWING
     ============================================================ */

  function bindTarget(target) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fb : null);
    gl.viewport(0, 0, width, height);
  }

  function setTexture(prog, name, tex, unit) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(prog.u[name], unit);
  }

  function draw(elapsed) {
    var u;

    /* 1. VIGNETTE, the only pass that follows the cursor. */
    bindTarget(bufferB);
    gl.useProgram(progVignette);
    u = progVignette.u;
    gl.uniform1f(u.uRadius, CONFIG.vignetteRadius);
    gl.uniform1f(u.uFalloff, CONFIG.vignetteFalloff);
    gl.uniform1f(u.uSkew, CONFIG.vignetteSkew);
    gl.uniform1f(u.uAngle, CONFIG.vignetteAngle);
    gl.uniform3f(u.uVignetteColor, shadow[0], shadow[1], shadow[2]);
    gl.uniform3f(u.uClearColor, clear[0], clear[1], clear[2]);
    gl.uniform2f(u.uPos, currX, currY);
    gl.uniform2f(u.uResolution, width, height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    swap();

    /* 2. SINE. Centred, like theirs. */
    bindTarget(bufferB);
    gl.useProgram(progSine);
    u = progSine.u;
    setTexture(progSine, "tInput", bufferA.tex, 0);
    gl.uniform2f(u.uPos, 0.5, 0.5);
    gl.uniform1f(u.uFrequency, CONFIG.sineFrequency);
    gl.uniform1f(u.uAmplitude, CONFIG.sineAmplitude);
    gl.uniform1f(u.uTime, elapsed);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    swap();

    /* 3. SHATTER. Centred, like theirs. */
    bindTarget(bufferB);
    gl.useProgram(progShatter);
    u = progShatter.u;
    setTexture(progShatter, "tInput", bufferA.tex, 0);
    gl.uniform1f(u.uAmount, CONFIG.shatterScale);
    gl.uniform1f(u.uSpread, CONFIG.shatterSpread);
    gl.uniform1f(u.uAngle, CONFIG.shatterAngle / 360);
    gl.uniform1f(u.uSkew, CONFIG.shatterSkew);
    gl.uniform1f(u.uTime, elapsed);
    gl.uniform2f(u.uPos, 0.5, 0.5);
    gl.uniform2f(u.uResolution, width, height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    swap();

    /* 4. BOKEH. Centred, like theirs. */
    bindTarget(bufferB);
    gl.useProgram(progBokeh);
    u = progBokeh.u;
    setTexture(progBokeh, "tInput", bufferA.tex, 0);
    setTexture(progBokeh, "tBlueNoise", noiseTex, 1);
    gl.uniform2f(u.uBlueNoiseResolution, NOISE_SIZE, NOISE_SIZE);
    gl.uniform2f(u.uResolution, width, height);
    gl.uniform1f(u.uAmount, CONFIG.bokehRadius);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    swap();

    /* 5. OUTPUT, straight to the screen. */
    bindTarget(null);
    gl.useProgram(progOutput);
    u = progOutput.u;
    setTexture(progOutput, "tInput", bufferA.tex, 0);
    gl.uniform3f(u.uWarmColor, warm[0], warm[1], warm[2]);
    gl.uniform1f(u.uStrength, CONFIG.strength);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.BLEND);

  /* ============================================================
     THE LOOP
     ============================================================ */

  /* Reduced motion: the light sits in the middle and is drawn once.
     microsoft.ai keeps animating in this case and offers a manual
     toggle instead; we honour the system setting. */
  if (reduced) {
    currX = 0.5;
    currY = 0.5;
    draw(0);
    window.addEventListener(
      "resize",
      function () {
        if (resize()) draw(0);
      },
      { passive: true }
    );
    canvas.setAttribute("data-mode", "static");
    return;
  }

  var running = false;
  var frame = 0;
  var last = 0;
  var elapsed = 0;
  var smoothDt = 0;
  var needsResize = false;
  var isScrolling = false;
  var scrollIdle = null;

  /* The layer is position: fixed and sized in vw/vh, so the only things
     that can change its size are a viewport change or the --chrome-inset
     main.js sets on mobile. Both fire one of these. */
  function markResize() {
    needsResize = true;
  }
  window.addEventListener("resize", markResize, { passive: true });
  window.addEventListener("orientationchange", markResize, { passive: true });
  window.addEventListener("load", markResize, { passive: true });

  function tick(now) {
    if (!running) return;

    if (isScrolling) {
      /* Rebase the clock, so resuming does not jump the animation
         forward by however long the scroll lasted. This is what
         microsoft.ai's pause-on-scroll does. */
      last = now;
      frame = window.requestAnimationFrame(tick);
      return;
    }

    if (!last) last = now;
    var raw = now - last;
    last = now;

    /* requestAnimationFrame hands out uneven gaps even at a steady 60fps:
       an 8 ms frame followed by a 25 ms one is normal. Fast motion hides
       that, but this drift is slow enough that feeding the raw gap
       straight into the clock reads as a stutter. So the gap is clamped
       to something sane and then smoothed, which keeps the drift moving
       at a constant rate no matter how the frames actually land. */
    var dt = raw < 4 ? 4 : raw > 50 ? 50 : raw;
    smoothDt = smoothDt ? smoothDt + (dt - smoothDt) * 0.1 : dt;
    elapsed += (smoothDt / 1000) * CONFIG.speed;

    currX += (pointerX - currX) * CONFIG.ease;
    currY += (pointerY - currY) * CONFIG.ease;

    if (needsResize) {
      needsResize = false;
      resize();
    }
    draw(elapsed);
    frame = window.requestAnimationFrame(tick);
  }

  function start() {
    if (running) return;
    running = true;
    last = 0;
    frame = window.requestAnimationFrame(tick);
  }

  function stop() {
    running = false;
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
    /* The last frame drawn stays on screen, so stopping is invisible. */
  }

  function onScreen() {
    /* Below this the light is dialled right down anyway, so there is
       nothing worth spending a phone battery on. */
    return window.scrollY < window.innerHeight * 1.6;
  }

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stop();
    else if (onScreen()) start();
  });

  window.addEventListener(
    "scroll",
    function () {
      isScrolling = true;
      if (scrollIdle) clearTimeout(scrollIdle);
      scrollIdle = setTimeout(function () {
        isScrolling = false;
        scrollIdle = null;
      }, 150);

      if (document.hidden) return;
      if (onScreen()) start();
      else stop();
    },
    { passive: true }
  );

  start();

  /* Exposed so the values at the top can be tried out live in the
     browser console without editing the file:

       LIGHT.strength = 0.4
       LIGHT.vignetteRadius = 0.5
       LIGHT.warm = '#FFE0B0'     (needs LIGHT.refresh() after)

     Colours need refresh() because they are parsed once. Everything
     else takes effect on the next frame. bokehSamples is baked into
     the shader and needs a reload. */
  window.LIGHT = CONFIG;
  window.LIGHT.refresh = function () {
    warm = hexToRgb(CONFIG.warm);
    shadow = hexToRgb(CONFIG.shadow);
    clear = hexToRgb(CONFIG.clear);
  };
})();
