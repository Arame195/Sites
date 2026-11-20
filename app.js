let THREE = null;
try {
  THREE = await import("https://cdn.jsdelivr.net/npm/three@0.186.1/build/three.module.js");
} catch (error) {
  console.info("Three.js is unavailable; the 2D constellation remains active.", error);
}

let Lenis = null;
try {
  const lenisModule = await import("https://cdn.jsdelivr.net/npm/lenis@1.3.27/+esm");
  Lenis = lenisModule.default ?? lenisModule.Lenis ?? null;
} catch (error) {
  console.info("Lenis is unavailable; native scene scrolling remains enabled.", error);
}

const CONFIG = {
  draftStorageKey: "mezhdu-nami-reply-draft-v1",
  sceneLabels: ["ТИХОЕ ПИСЬМО", "НАШИ ВОСПОМИНАНИЯ", "СОБИРАЕМ НЕБО", "БЕЗ ОПРАВДАНИЙ", "МОЖНО НЕ СПЕШИТЬ", "С ТЕПЛОМ", "РАЗГОВОР"],
  memories: [
    "Помнишь, как мы впервые долго разговаривали?",
    "Наши глупые шутки.",
    "Моменты, когда даже обычный вечер становился особенным.",
    "То, что хочется сохранить в памяти.",
    "И просто ты."
  ],
  memoryAside: "Некоторые моменты остаются с нами тихо.",
  constellationQuote: "Красивые вещи не всегда складываются идеально. Но это не делает их менее ценными.",
  constellationInstruction: "Сначала — верхняя звезда",
  letterHeading: "Я хочу кое-что\nпризнать",
  letter: [
    "Я понимаю, что между нами в последнее время было много неприятных моментов.",
    "Я тоже совершал ошибки. Иногда позволял эмоциям говорить за меня вместо того, чтобы спокойно объяснить, что чувствую.",
    "Я не хочу оправдываться или перекладывать ответственность.",
    "Мне просто важно, чтобы ты знала: наши отношения для меня действительно много значат."
  ],
  freedomHeading: "Тебе не нужно\nничего решать сейчас",
  freedom: [
    "Я не создавал это, чтобы заставить тебя передумать.",
    "Не хочу, чтобы ты чувствовала себя обязанной ответить взаимностью, простить меня или принять какое-то решение.",
    "Я просто хотел подарить тебе что-то особенное и дать возможность увидеть мои мысли без ссоры и лишних слов."
  ],
  finalMessage: "Что бы ни произошло дальше, я благодарен за моменты, которые у нас были.",
  conversationHeading: ["Давай теперь", "поговорим и закроем", "этот вопрос"],
  conversationEmphasis: "закроем",
  prompts: [
    { label: "«Давай поговорим»", text: "Давай поговорим, когда обоим будет удобно." },
    { label: "«Мне нужно время»", text: "Мне нужно немного времени, чтобы всё обдумать." },
    { label: "«Я напишу сама»", text: "Я хочу сначала сказать, что думаю, своими словами." }
  ]
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const shell = $("#site-shell");
const scenes = $$(".scene");
const gsap = window.gsap ?? null;
const ScrollTrigger = window.ScrollTrigger ?? null;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const duration = (value) => reducedMotion ? 0.01 : value;

if (gsap && ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

function setText(selector, value, root = document) {
  const element = $(selector, root);
  if (element && value != null) element.textContent = value;
}

function renderHeadingLines(element, lines, emphasisLine = -1, emphasisWord = "") {
  if (!element) return;
  element.replaceChildren();
  lines.forEach((line, index) => {
    if (index > 0) element.append(document.createElement("br"));
    if (index === emphasisLine && !emphasisWord) {
      const emphasis = document.createElement("em");
      emphasis.textContent = line;
      element.append(emphasis);
      return;
    }
    const wordIndex = index === emphasisLine ? line.indexOf(emphasisWord) : -1;
    if (wordIndex < 0) {
      element.append(document.createTextNode(line));
    } else {
      element.append(document.createTextNode(line.slice(0, wordIndex)));
      const emphasis = document.createElement("em");
      emphasis.textContent = emphasisWord;
      element.append(emphasis, document.createTextNode(line.slice(wordIndex + emphasisWord.length)));
    }
  });
}

function prepareCopy() {
  setText("#constellation-quote", CONFIG.constellationQuote);
  setText("#constellation-instruction", CONFIG.constellationInstruction);
  setText("#memory-dialog-title", CONFIG.memories[0]);
  setText("#final-title", CONFIG.finalMessage);
  const letterLines = CONFIG.letterHeading.split("\n");
  renderHeadingLines($("#letter-title"), letterLines, letterLines.length - 1);
  const freedomLines = CONFIG.freedomHeading.split("\n");
  renderHeadingLines($("#sunset-title"), freedomLines, freedomLines.length - 1);
  const conversationTitle = $("#conversation-title");
  renderHeadingLines(conversationTitle, CONFIG.conversationHeading, 1, CONFIG.conversationEmphasis);
  if (conversationTitle) {
    const heart = document.createElement("span");
    heart.className = "heart-mark";
    heart.textContent = "♥";
    conversationTitle.append(heart);
  }
  const letterBody = $("#letter-body");
  if (letterBody) letterBody.innerHTML = CONFIG.letter.map((paragraph) => `<p>${paragraph}</p>`).join("");
  const freedomBody = $(".sunset-text");
  if (freedomBody) freedomBody.innerHTML = CONFIG.freedom.map((paragraph) => `<p>${paragraph}</p>`).join("");
  $$(".memory-node").forEach((node, index) => { node.setAttribute("aria-label", `Открыть воспоминание ${index + 1}: ${CONFIG.memories[index]}`); });
  $$(".prompt-chip").forEach((chip, index) => {
    const prompt = CONFIG.prompts[index];
    if (!prompt) return;
    chip.textContent = prompt.label;
    chip.dataset.prompt = prompt.text;
  });
}

prepareCopy();

class WorldScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.starField = null;
    this.modeGroup = null;
    this.mode = "intro";
    this.frame = 0;
    this.startedAt = 0;
    this.memoryNodes = [];
    this.constellationNodes = [];
    this.ready = this.create();
  }

  create() {
    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        alpha: true,
        antialias: false,
        powerPreference: "low-power"
      });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      this.renderer.setSize(window.innerWidth, window.innerHeight, false);
      this.renderer.setClearColor(0x000000, 0);
      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 220);
      this.camera.position.z = 38;
      const starCount = window.innerWidth < 700 ? 520 : 950;
      const positions = new Float32Array(starCount * 3);
      const brightness = new Float32Array(starCount);
      for (let i = 0; i < starCount; i += 1) {
        positions[i * 3] = (Math.random() - 0.5) * 98;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 58;
        positions[i * 3 + 2] = -Math.random() * 145 - 9;
        brightness[i] = Math.random();
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute("aBrightness", new THREE.BufferAttribute(brightness, 1));
      this.starField = new THREE.Points(geometry, new THREE.PointsMaterial({
        color: 0xcac2b4,
        size: 0.105,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.63,
        depthWrite: false
      }));
      this.scene.add(this.starField);
      this.modeGroup = new THREE.Group();
      this.scene.add(this.modeGroup);
      this.resize = this.resize.bind(this);
      window.addEventListener("resize", this.resize, { passive: true });
      document.addEventListener("visibilitychange", this.onVisibilityChange.bind(this));
      this.render = this.render.bind(this);
      if (!reducedMotion) this.frame = requestAnimationFrame(this.render);
      this.renderOnce();
      return true;
    } catch (error) {
      console.warn("Three.js could not start; the 2D scene fallback remains active.", error);
      this.canvas.hidden = true;
      return false;
    }
  }

  onVisibilityChange() {
    if (!this.renderer || reducedMotion) return;
    if (document.hidden) cancelAnimationFrame(this.frame);
    else this.frame = requestAnimationFrame(this.render);
  }

  resize() {
    if (!this.renderer || !this.camera) return;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    if (this.mode === "intro") this.makeIntroObject();
    if (this.mode === "memories") this.makeMemoryObjects();
    if (this.mode === "constellation") this.makeConstellationObjects(this.constellationNodes);
    if (this.mode === "final") this.makeFinalObjects();
    this.renderOnce();
  }

  clearGroup() {
    if (!this.modeGroup) return;
    while (this.modeGroup.children.length) {
      const object = this.modeGroup.children[0];
      this.modeGroup.remove(object);
      object.traverse?.((child) => {
        child.geometry?.dispose?.();
        if (Array.isArray(child.material)) child.material.forEach((material) => { material.map?.dispose?.(); material.dispose?.(); });
        else { child.material?.map?.dispose?.(); child.material?.dispose?.(); }
      });
      if (!object.traverse) {
        object.geometry?.dispose?.();
        object.material?.map?.dispose?.();
        object.material?.dispose?.();
      }
    }
  }

  worldAt(clientX, clientY, depth = 0) {
    const distance = this.camera.position.z - depth;
    const height = 2 * distance * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const width = height * this.camera.aspect;
    return new THREE.Vector3((clientX / window.innerWidth - 0.5) * width, (0.5 - clientY / window.innerHeight) * height, depth);
  }

  glowSprite(color = 0xf0d7a9, opacity = 0.72, scale = 3) {
    const size = 96;
    const glow = document.createElement("canvas");
    glow.width = glow.height = size;
    const context = glow.getContext("2d");
    const gradient = context.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, "rgba(255,250,231,1)");
    gradient.addColorStop(0.12, "rgba(247,218,172,.72)");
    gradient.addColorStop(0.34, "rgba(239,195,132,.24)");
    gradient.addColorStop(1, "rgba(239,195,132,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
    const texture = new THREE.CanvasTexture(glow);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true }));
    sprite.scale.setScalar(scale);
    return sprite;
  }

  makeIntroObject() {
    this.clearGroup();
    const orbit = $(".intro-orbit");
    if (!orbit || !this.modeGroup) return;
    const rect = orbit.getBoundingClientRect();
    const center = this.worldAt(rect.left + rect.width / 2, rect.top + rect.height / 48);
    const halo = this.glowSprite(0xf0d7a9, 0.9, 14);
    halo.position.copy(center);
    this.modeGroup.add(halo);
    const sphere = new THREE.Mesh(
      new THREE.IcosahedronGeometry(3.2, 1),
      new THREE.MeshBasicMaterial({ color: 0xe7c897, wireframe: true, transparent: true, opacity: 0.21 })
    );
    sphere.position.copy(center);
    sphere.material.depthWrite = false;
    this.modeGroup.add(sphere);
    const inner = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.65, 2),
      new THREE.MeshBasicMaterial({ color: 0xd9c39e, wireframe: true, transparent: true, opacity: 0.32 })
    );
    inner.position.copy(center);
    this.modeGroup.add(inner);
    this.modeGroup.userData.sphere = sphere;
    this.modeGroup.userData.inner = inner;
    this.modeGroup.userData.halo = halo;
  }

  makeMemoryObjects() {
    if (!this.renderer) return;
    this.clearGroup();
    this.memoryNodes = [];
    $$(".memory-node").forEach((node) => {
      const rect = node.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const point = this.worldAt(rect.left + rect.width / 2, rect.top + rect.height / 2, 0);
      const glow = this.glowSprite(0xf1d6a3, 0.63, 2.9);
      glow.position.copy(point);
      this.modeGroup.add(glow);
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), new THREE.MeshBasicMaterial({ color: 0xf2d8a4, transparent: true, opacity: 0.84 }));
      sphere.position.copy(point);
      this.modeGroup.add(sphere);
      this.memoryNodes.push({ node, point, glow, sphere });
    });
  }

  makeConstellationObjects(nodes = []) {
    if (!this.renderer) return;
    this.clearGroup();
    this.constellationNodes = [...nodes];
    const positions = nodes.map((node) => {
      const rect = node.getBoundingClientRect();
      return this.worldAt(rect.left + rect.width / 2, rect.top + rect.height / 2, 0);
    });
    if (positions.length > 1) {
      const linePoints = [...positions];
      if (nodes.length === $$(".constellation-star").length) linePoints.push(positions[0]);
      const geometry = new THREE.BufferGeometry().setFromPoints(linePoints);
      const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0xe8c994, transparent: true, opacity: 0.58 }));
      this.modeGroup.add(line);
    }
    positions.forEach((point) => {
      const glow = this.glowSprite(0xf0d7a9, 0.74, 2.4);
      glow.position.copy(point);
      this.modeGroup.add(glow);
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffe8bd }));
      sphere.position.copy(point);
      this.modeGroup.add(sphere);
    });
  }

  makeFinalObjects() {
    if (!this.renderer) return;
    this.clearGroup();
    const nodes = $$(".final-constellation span");
    const positions = nodes.map((node) => {
      const rect = node.getBoundingClientRect();
      return this.worldAt(rect.left + rect.width / 2, rect.top + rect.height / 2, 0);
    });
    if (positions.length > 1) {
      const geometry = new THREE.BufferGeometry().setFromPoints([...positions, positions[0]]);
      this.modeGroup.add(new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0xe8c994, transparent: true, opacity: 0.37 })));
    }
    positions.forEach((point) => {
      const glow = this.glowSprite(0xf0d7a9, 0.68, 2.1);
      glow.position.copy(point);
      this.modeGroup.add(glow);
    });
  }

  setMode(mode) {
    this.mode = mode;
    this.canvas.style.opacity = mode === "sunset" ? "0.08" : mode === "letter" ? "0.27" : "0.92";
    if (!this.renderer) return;
    if (mode === "intro") this.makeIntroObject();
    else if (mode === "memories") this.makeMemoryObjects();
    else if (mode === "constellation") this.makeConstellationObjects([]);
    else if (mode === "final") this.makeFinalObjects();
    else this.clearGroup();
    this.renderOnce();
  }

  updateConstellation(nodes) {
    if (this.mode !== "constellation" || !this.renderer) return;
    this.makeConstellationObjects(nodes);
    this.renderOnce();
  }

  pulse() {
    if (!gsap || !this.modeGroup?.userData.halo) return;
    gsap.to(this.modeGroup.userData.halo.material, { opacity: 1, duration: duration(0.25), yoyo: true, repeat: reducedMotion ? 0 : 2, ease: "sine.inOut" });
    gsap.to(this.modeGroup.userData.sphere.scale, { x: 1.17, y: 1.17, z: 1.17, duration: duration(0.55), yoyo: true, repeat: 1, ease: "power2.inOut" });
  }

  renderOnce() {
    if (this.renderer && this.scene && this.camera) this.renderer.render(this.scene, this.camera);
  }

  render(time) {
    if (!this.renderer) return;
    if (document.hidden) return;
    const seconds = time * 0.001;
    if (this.starField) this.starField.rotation.z = Math.sin(seconds * 0.025) * 0.018;
    const { sphere, inner, halo } = this.modeGroup?.userData ?? {};
    if (sphere) sphere.rotation.y = seconds * 0.08;
    if (inner) inner.rotation.x = -seconds * 0.06;
    if (halo) halo.scale.setScalar(14 + Math.sin(seconds * 0.75) * 0.45);
    this.renderer.render(this.scene, this.camera);
    this.frame = requestAnimationFrame(this.render);
  }
}

const world = new WorldScene($("#world-canvas"));

function animateSceneIn(index) {
  const scene = scenes[index];
  const inner = $(".scene__inner", scene);
  if (!gsap || !inner) return;
  gsap.set($$("*", inner), { clearProps: "opacity,transform,clipPath" });
  gsap.set(inner, { clearProps: "opacity,transform" });
  const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
  if (index === 0) {
    tl.fromTo($(".intro-copy .eyebrow", scene), { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: duration(.75) })
      .fromTo($(".display-title", scene), { opacity: 0, y: 30, clipPath: "inset(10% 0 20% 0)" }, { opacity: 1, y: 0, clipPath: "inset(0% 0 0% 0)", duration: duration(1.25), ease: "power4.out" }, "-=.32")
      .fromTo($(".intro-lead", scene), { opacity: 0, y: 13 }, { opacity: 1, y: 0, duration: duration(.75) }, "-=.65")
      .fromTo($("#begin-button", scene), { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: duration(.6) }, "-=.4")
      .fromTo($(".intro-orbit", scene), { opacity: 0, scale: .94 }, { opacity: 1, scale: 1, duration: duration(1.4), ease: "power2.out" }, "-=1.15");
  } else if (index === 1) {
    tl.fromTo($(".memories-heading", scene), { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: duration(.8) })
      .fromTo($$(".memory-node", scene), { opacity: 0, scale: .75 }, { opacity: 1, scale: 1, duration: duration(.55), stagger: reducedMotion ? 0 : .09, ease: "back.out(1.8)" }, "-=.25")
      .fromTo($(".memory-footer", scene), { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: duration(.6) }, "-=.18");
  } else if (index === 2) {
    tl.fromTo($(".constellation-heading", scene), { opacity: 0, x: -16 }, { opacity: 1, x: 0, duration: duration(.8) })
      .fromTo($$(".constellation-star", scene), { opacity: 0, scale: .5 }, { opacity: 1, scale: 1, duration: duration(.48), stagger: reducedMotion ? 0 : .05, ease: "back.out(1.7)" }, "-=.25")
      .fromTo($(".constellation-bottom", scene), { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: duration(.65) }, "-=.1");
  } else if (index === 3) {
    tl.fromTo($(".letter-aside .eyebrow", scene), { opacity: 0, x: -10 }, { opacity: 1, x: 0, duration: duration(.65) })
      .fromTo($(".letter-paper", scene), { opacity: 0, y: 24, rotate: -.5 }, { opacity: 1, y: 0, rotate: 0, duration: duration(1), ease: "power3.out" }, "-=.25")
      .fromTo($$(".letter-body p", scene), { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: duration(.6), stagger: reducedMotion ? 0 : .16 }, "-=.45")
      .fromTo($(".letter-actions", scene), { opacity: 0 }, { opacity: 1, duration: duration(.55) }, "-=.2");
  } else if (index === 4) {
    tl.fromTo($(".sunset-copy .eyebrow", scene), { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: duration(.75) })
      .fromTo($(".sunset-copy .section-title", scene), { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: duration(.9) }, "-=.28")
      .fromTo($$(".sunset-text p", scene), { opacity: 0, y: 13 }, { opacity: 1, y: 0, duration: duration(.7), stagger: reducedMotion ? 0 : .17 }, "-=.42")
      .fromTo($(".sunset-next", scene), { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: duration(.6) }, "-=.18");
  } else if (index === 5) {
    tl.fromTo($(".final-constellation", scene), { opacity: 0, scale: .96 }, { opacity: .68, scale: 1, duration: duration(1.3), ease: "power2.out" })
      .fromTo($(".final-copy .eyebrow", scene), { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: duration(.6) }, "-=.62")
      .fromTo($(".final-title", scene), { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: duration(1) }, "-=.25")
      .fromTo($(".final-signoff", scene), { opacity: 0 }, { opacity: 1, duration: duration(.6) }, "-=.35")
      .fromTo($("#to-conversation", scene), { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: duration(.55) }, "-=.2");
  } else {
    tl.fromTo($(".conversation-main .eyebrow", scene), { opacity: 0, y: 9 }, { opacity: 1, y: 0, duration: duration(.65) })
      .fromTo($(".conversation-title", scene), { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: duration(.9) }, "-=.25")
      .fromTo($(".conversation-lead", scene), { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: duration(.65) }, "-=.3")
      .fromTo($(".conversation-prompts", scene), { opacity: 0 }, { opacity: 1, duration: duration(.55) }, "-=.16")
      .fromTo($(".reply-card", scene), { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: duration(.9), ease: "power3.out" }, "-=.46");
  }
  return tl;
}

function animateSceneOut(index, onComplete) {
  const scene = scenes[index];
  const inner = $(".scene__inner", scene);
  if (!gsap || !inner) { onComplete(); return null; }
  const uniqueExit = [
    [$(".intro-copy", scene), { y: -8 }], [$(".intro-orbit", scene), { scale: .965 }],
    [$(".memories-heading", scene), { y: -7 }], [$(".memory-map", scene), { scale: .985 }],
    [$(".constellation-heading", scene), { x: -9 }], [$(".constellation-board", scene), { scale: .985 }],
    [$(".letter-paper", scene), { y: 8, rotate: .28 }], [$(".sunset-copy", scene), { y: 8 }],
    [$(".final-constellation", scene), { scale: .965 }], [$(".final-copy", scene), { y: 8 }],
    [$(".conversation-main", scene), { x: -8 }], [$(".reply-card", scene), { y: 8 }]
  ];
  const targets = uniqueExit.slice(index * 2, index * 2 + 2).filter(([element]) => element);
  const timeline = gsap.timeline({ onComplete });
  targets.forEach(([element, motion]) => timeline.to(element, { ...motion, opacity: 0, duration: .34, ease: "power2.in" }, 0));
  timeline.to(inner, { opacity: 0, y: -7, duration: .38, ease: "power2.inOut" }, 0);
  return timeline;
}

function updateChrome(index) {
  const count = String(index + 1).padStart(2, "0");
  setText("#scene-count", `${count} / 07`);
  setText("#scene-label", CONFIG.sceneLabels[index]);
  $("#progress-fill").style.width = `${((index + 1) / scenes.length) * 100}%`;
  $("#back-button").hidden = index === 0;
  shell.dataset.scene = String(index);
  scenes.forEach((scene, sceneIndex) => {
    const active = sceneIndex === index;
    scene.classList.toggle("is-active", active);
    scene.inert = !active;
    scene.setAttribute("aria-hidden", String(!active));
    if (active) scene.scrollTop = 0;
  });
}

class SceneRegistry {
  constructor(sceneElements) {
    this.elements = sceneElements;
    this.current = 0;
    this.locked = false;
    this.hooks = new Map();
    this.timelines = new Map();
    this.scrollSessions = new Map();
  }

  register(index, hooks = {}) { this.hooks.set(index, hooks); }

  enter(index, shouldFocus = false) {
    this.current = index;
    updateChrome(index);
    this.hooks.get(index)?.onEnter?.();
    const timeline = animateSceneIn(index);
    if (timeline) this.timelines.set(index, timeline);
    if (shouldFocus) {
      const heading = $("h1, h2", this.elements[index]);
      if (heading) {
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
      }
    }
    requestAnimationFrame(() => this.attachScroll(index));
  }

  attachScroll(index) {
    if (this.current !== index) return;
    const scene = this.elements[index];
    if (!scene || scene.scrollHeight <= scene.clientHeight + 5) return;
    if (this.scrollSessions.has(index)) return;
    let lenis = null;
    let ticker = null;
    const triggers = [];
    if (Lenis) {
      try {
        lenis = new Lenis({ wrapper: scene, content: $(".scene__inner", scene), autoRaf: false, duration: 1.05, smoothWheel: true, syncTouch: false });
        lenis.on("scroll", () => ScrollTrigger?.update());
        if (gsap) {
          ticker = (time) => lenis.raf(time * 1000);
          gsap.ticker.add(ticker);
        }
      } catch (error) {
        console.info("Lenis could not enhance this scene; native scrolling remains enabled.", error);
      }
    }
    if (ScrollTrigger) {
      const progressTrigger = ScrollTrigger.create({
        trigger: $(".scene__inner", scene),
        scroller: scene,
        start: "top top",
        end: "bottom bottom",
        onUpdate: (self) => scene.style.setProperty("--story-scroll", self.progress.toFixed(3))
      });
      triggers.push(progressTrigger);
      const heading = $(".section-heading, .letter-paper, .sunset-copy, .conversation-main", scene);
      if (heading && gsap) {
        const parallax = gsap.to(heading, { y: -12, ease: "none", scrollTrigger: { trigger: $(".scene__inner", scene), scroller: scene, start: "top top", end: "bottom bottom", scrub: .6 } });
        if (parallax.scrollTrigger) triggers.push(parallax.scrollTrigger);
      }
      ScrollTrigger.refresh();
    }
    this.scrollSessions.set(index, { lenis, ticker, triggers });
  }

  detachScroll(index) {
    const session = this.scrollSessions.get(index);
    if (!session) return;
    session.triggers.forEach((trigger) => trigger.kill());
    if (session.ticker && gsap) gsap.ticker.remove(session.ticker);
    session.lenis?.destroy();
    this.scrollSessions.delete(index);
  }

  go(index) {
    if (this.locked || index < 0 || index >= this.elements.length || index === this.current) return;
    this.locked = true;
    const previousIndex = this.current;
    const previous = this.elements[previousIndex];
    const next = this.elements[index];
    this.hooks.get(previousIndex)?.onExit?.();
    this.detachScroll(previousIndex);
    const runningTimeline = this.timelines.get(previousIndex);
    if (runningTimeline) runningTimeline.kill();
    this.timelines.delete(previousIndex);
    const previousInner = $(".scene__inner", previous);
    const reveal = () => {
      previous.classList.remove("is-active");
      previous.inert = true;
      previous.setAttribute("aria-hidden", "true");
      if (gsap && previousInner) gsap.set(previousInner, { clearProps: "opacity,transform" });
      next.classList.add("is-active");
      next.inert = false;
      next.setAttribute("aria-hidden", "false");
      this.current = index;
      this.locked = false;
      this.enter(index, true);
      if (gsap) {
        gsap.set($(".scene__inner", next), { opacity: 0, y: 12 });
        const inner = $(".scene__inner", next);
        gsap.to(inner, { opacity: 1, y: 0, duration: duration(.46), ease: "power2.out", onComplete: () => gsap.set(inner, { clearProps: "opacity,transform" }) });
      }
    };
    if (gsap && previousInner && !reducedMotion) animateSceneOut(previousIndex, reveal);
    else reveal();
  }
}

const registry = new SceneRegistry(scenes);

registry.register(0, { onEnter: () => world.setMode("intro") });
registry.register(1, {
  onEnter: () => {
    world.setMode("memories");
    updateMemoryProgress();
    requestAnimationFrame(() => world.makeMemoryObjects());
  },
  onExit: () => { if (gsap) gsap.killTweensOf(".memory-node"); }
});
registry.register(2, { onEnter: () => { world.setMode("constellation"); requestAnimationFrame(() => world.updateConstellation(constellationState.nodes)); } });
registry.register(3, { onEnter: () => world.setMode("letter") });
registry.register(4, { onEnter: () => world.setMode("sunset") });
registry.register(5, { onEnter: () => world.setMode("final") });
registry.register(6, { onEnter: () => world.setMode("conversation") });

const openedMemories = new Set();
const memoryDialog = $("#memory-dialog");
const memoryCard = $(".memory-card", memoryDialog);
let pendingMemory = 0;

function updateMemoryProgress() {
  setText("#memory-progress", `Открыто ${openedMemories.size} из ${CONFIG.memories.length}`);
  $("#memories-next").disabled = openedMemories.size !== CONFIG.memories.length;
  $$(".memory-node").forEach((node, index) => node.classList.toggle("is-opened", openedMemories.has(index)));
}

function openMemory(index) {
  pendingMemory = index;
  openedMemories.add(index);
  updateMemoryProgress();
  setText("#memory-number", String(index + 1).padStart(2, "0"));
  setText("#memory-dialog-title", CONFIG.memories[index]);
  if (!memoryDialog.open) memoryDialog.showModal();
  if (gsap) {
    gsap.fromTo(memoryCard, { opacity: 0, y: 21, scale: .985 }, { opacity: 1, y: 0, scale: 1, duration: duration(.48), ease: "power3.out" });
    gsap.fromTo($(".memory-card__spark", memoryCard), { scale: .6, rotation: -18 }, { scale: 1, rotation: 0, duration: duration(.55), ease: "back.out(1.8)" });
  }
  const node = $(`.memory-node[data-memory="${index}"]`);
  if (gsap) gsap.fromTo(node, { scale: 1 }, { scale: 1.18, duration: duration(.2), yoyo: true, repeat: 1, ease: "power2.inOut" });
}

$$ (".memory-node").forEach((node) => node.addEventListener("click", () => openMemory(Number(node.dataset.memory))));
memoryDialog.addEventListener("click", (event) => {
  if (event.target === memoryDialog) closeMemory();
});
memoryDialog.addEventListener("submit", (event) => {
  event.preventDefault();
  closeMemory();
});
memoryDialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  closeMemory();
});

function closeMemory() {
  if (!memoryDialog.open) return;
  const closeNow = () => memoryDialog.close();
  if (gsap && !reducedMotion) gsap.to(memoryCard, { opacity: 0, y: 10, duration: .2, ease: "power2.in", onComplete: closeNow });
  else closeNow();
}

const constellationState = { nodes: [], complete: false };
const constellationPath = $("#constellation-path");

function constellationPoint(node) {
  const index = Number(node.dataset.star);
  const match = node.getAttribute("style").match(/--x:(\d+(?:\.\d+)?)%;--y:(\d+(?:\.\d+)?)%/);
  if (match) return `${Math.round(Number(match[1]) * 10)},${Math.round(Number(match[2]) * 5.6)}`;
  const points = ["500,112", "290,50", "120,129", "130,263", "260,370", "500,459", "740,370", "870,263", "880,129", "710,50"];
  return points[index];
}

function renderConstellationPath() {
  let points = constellationState.nodes.map(constellationPoint);
  if (constellationState.complete && points.length) points = [...points, points[0]];
  constellationPath.setAttribute("points", points.join(" "));
  world.updateConstellation(constellationState.nodes);
  if (constellationState.complete && points.length) {
    const length = constellationPath.getTotalLength?.() ?? 0;
    if (gsap && length) {
      gsap.set(constellationPath, { strokeDasharray: length, strokeDashoffset: length });
      gsap.to(constellationPath, { strokeDashoffset: 0, duration: duration(1.1), ease: "power2.out" });
      gsap.fromTo($(".constellation-board"), { scale: .985 }, { scale: 1, duration: duration(.8), yoyo: true, repeat: 1, ease: "power2.inOut" });
    }
  } else if (gsap && points.length > 1) {
    const length = constellationPath.getTotalLength?.() ?? 0;
    if (length) {
      gsap.set(constellationPath, { strokeDasharray: length, strokeDashoffset: length });
      gsap.to(constellationPath, { strokeDashoffset: 0, duration: duration(.42), ease: "power2.out" });
    }
  }
}

function resetConstellation() {
  constellationState.nodes = [];
  constellationState.complete = false;
  $$(".constellation-star").forEach((star) => star.classList.remove("is-lit"));
  $("#constellation-next").disabled = true;
  $("#constellation-quote").classList.remove("is-complete");
  setText("#constellation-instruction", CONFIG.constellationInstruction);
  renderConstellationPath();
}

function connectStar(star) {
  if (constellationState.complete) return;
  const expected = constellationState.nodes.length;
  const index = Number(star.dataset.star);
  if (index !== expected) {
    setText("#constellation-instruction", `Теперь коснись звезды ${expected + 1}`);
    if (gsap) gsap.fromTo(star, { x: 0 }, { x: 4, duration: duration(.07), repeat: 3, yoyo: true, clearProps: "x" });
    return;
  }
  constellationState.nodes.push(star);
  star.classList.add("is-lit");
  if (gsap) gsap.fromTo(star, { scale: .7 }, { scale: 1.24, duration: duration(.2), yoyo: true, repeat: 1, ease: "power2.out" });
  const finished = constellationState.nodes.length === $$(".constellation-star").length;
  if (finished) {
    constellationState.complete = true;
    setText("#constellation-instruction", "Вот так и складываются важные вещи");
    $("#constellation-next").disabled = false;
    $("#constellation-quote").classList.add("is-complete");
    if (gsap) gsap.fromTo($("#constellation-quote"), { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: duration(.8), delay: duration(.65), ease: "power2.out" });
  } else {
    setText("#constellation-instruction", `Дальше — звезда ${expected + 2}`);
  }
  renderConstellationPath();
}

$$ (".constellation-star").forEach((star) => star.addEventListener("click", () => connectStar(star)));

let beginInProgress = false;
$("#begin-button").addEventListener("click", () => {
  if (beginInProgress) return;
  beginInProgress = true;
  world.pulse();
  if (gsap) {
    gsap.to($$(".intro-orbit__ring"), { rotation: "+=18", opacity: .6, duration: duration(.75), ease: "power2.out" });
  }
  window.setTimeout(() => { beginInProgress = false; registry.go(1); }, reducedMotion ? 20 : 700);
});

$("#memories-next").addEventListener("click", () => {
  if (openedMemories.size === CONFIG.memories.length) registry.go(2);
});
$("#constellation-next").addEventListener("click", () => { if (constellationState.complete) registry.go(3); });
$("#constellation-replay").addEventListener("click", resetConstellation);
$("#show-letter").addEventListener("click", () => {
  if (gsap) gsap.to($$(".letter-body p"), { opacity: 1, y: 0, duration: duration(.4), stagger: reducedMotion ? 0 : .06, ease: "power2.out" });
  $("#show-letter").textContent = "Письмо целиком";
  $("#show-letter").disabled = true;
});
$("#letter-next").addEventListener("click", () => registry.go(4));
$("#sunset-next").addEventListener("click", () => registry.go(5));
$("#to-conversation").addEventListener("click", () => registry.go(6));
$("#back-button").addEventListener("click", () => registry.go(registry.current - 1));
$("#restart-story").addEventListener("click", () => registry.go(0));
$(".wordmark").addEventListener("click", (event) => { event.preventDefault(); registry.go(0); });

const draft = $("#reply-draft");
const draftStatus = $("#draft-status");
const characterCount = $("#character-count");
const copyFeedback = $("#copy-feedback");
let saveTimer = 0;
let storageAvailable = true;

function pluralizeCharacters(count) {
  const form = new Intl.PluralRules("ru").select(count);
  const noun = form === "one" ? "символ" : form === "few" ? "символа" : "символов";
  return `${count} ${noun}`;
}

function updateDraftMeta() { characterCount.textContent = pluralizeCharacters(draft.value.length); }

function saveDraft() {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    if (storageAvailable) {
      try {
        localStorage.setItem(CONFIG.draftStorageKey, draft.value);
        draftStatus.textContent = "Черновик сохранён на этом устройстве";
      } catch (error) {
        storageAvailable = false;
        draftStatus.textContent = "Автосохранение недоступно в этом браузере";
      }
    }
    updateDraftMeta();
  }, 180);
}

try {
  draft.value = localStorage.getItem(CONFIG.draftStorageKey) ?? "";
} catch (error) {
  storageAvailable = false;
  draftStatus.textContent = "Хранилище браузера недоступно — скопируй текст перед выходом";
}
updateDraftMeta();
draft.addEventListener("input", saveDraft);

$$ (".prompt-chip").forEach((chip) => chip.addEventListener("click", () => {
  const prompt = chip.dataset.prompt ?? "";
  const start = draft.selectionStart ?? draft.value.length;
  const end = draft.selectionEnd ?? draft.value.length;
  const prefix = draft.value && start === draft.value.length && !draft.value.endsWith("\n") ? "\n" : "";
  draft.setRangeText(`${prefix}${prompt}`, start, end, "end");
  draft.focus();
  saveDraft();
  copyFeedback.textContent = "Фраза добавлена в поле — её можно изменить или удалить.";
  if (gsap) gsap.fromTo(copyFeedback, { opacity: 0, y: 4 }, { opacity: 1, y: 0, duration: duration(.35) });
}));

async function copyDraftText() {
  const text = draft.value.trim();
  if (!text) {
    copyFeedback.textContent = "Пока нечего копировать — сначала можно написать пару слов.";
    return;
  }
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
    else throw new Error("Clipboard API unavailable");
    copyFeedback.textContent = "Текст скопирован. Отправки с сайта нет — выбери удобный способ сама.";
  } catch (error) {
    try {
      draft.focus();
      draft.select();
      const copied = document.execCommand("copy");
      draft.setSelectionRange(text.length, text.length);
      copyFeedback.textContent = copied ? "Текст скопирован. Отправки с сайта нет — выбери удобный способ сама." : "Не удалось скопировать автоматически — выдели и скопируй текст вручную.";
    } catch (fallbackError) {
      copyFeedback.textContent = "Не удалось скопировать автоматически — выдели и скопируй текст вручную.";
    }
  }
}

$("#copy-draft").addEventListener("click", copyDraftText);
$("#reply-form").addEventListener("submit", (event) => event.preventDefault());
$("#clear-draft").addEventListener("click", () => {
  if (!draft.value) return;
  draft.value = "";
  saveDraft();
  copyFeedback.textContent = "Черновик очищен.";
});

registry.enter(0);
