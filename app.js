(async function bootStory() {
if (document.readyState === "loading") {
  await new Promise((resolve) => document.addEventListener("DOMContentLoaded", resolve, { once: true }));
}

let THREE = null;
let Lenis = null;
const threeReady = import("https://cdn.jsdelivr.net/npm/three@0.186.1/build/three.module.js")
  .then((module) => { THREE = module; return module; })
  .catch((error) => { console.info("Three.js is unavailable; the 2D constellation remains active.", error); return null; });
const lenisReady = import("https://cdn.jsdelivr.net/npm/lenis@1.3.27/+esm")
  .then((module) => module.default ?? module.Lenis ?? null)
  .catch((error) => { console.info("Lenis is unavailable; native scene scrolling remains enabled.", error); return null; });

const CONFIG = {
  draftStorageKey: "mezhdu-nami-reply-draft-v1",
  sceneLabels: ["ТИХОЕ ПИСЬМО", "НАШИ ВОСПОМИНАНИЯ", "СОБИРАЕМ НЕБО", "ПРОВОДИМ СВЕТ", "ЧЕТЫРЕ ОПОРЫ", "РАЗГОВОР"],
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
  mirrorStart: ["/", "\\", "/", "/"],
  mirrorSolution: ["/", "/", "\\", "\\"],
  promiseItems: [
    { title: "Слушать", note: "не перебивая" },
    { title: "Понять", note: "даже в несогласии" },
    { title: "Говорить честно", note: "и бережно" },
    { title: "Беречь границы", note: "не торопить ответ" }
  ],
  conversationHeading: ["Давай теперь", "поговорим и закроем", "этот вопрос"],
  conversationEmphasis: "закроем",
  conversationLead: "Мне правда важно услышать тебя. Можно ответить сейчас, позже или совсем не отвечать — решать только тебе.",
  conversationBetween: "Можно выбрать готовую фразу, изменить её или написать всё своими словами.",
  conversationOptions: [
    { label: "Я готова поговорить", response: "Хорошо. Я готов спокойно поговорить и выслушать тебя." },
    { label: "Мне нужно время", response: "Понимаю. Возьми столько времени, сколько тебе нужно." },
    { label: "Мне есть что сказать", response: "Я буду слушать — без перебиваний и спешки." },
    { label: "Пока не знаю", response: "Это нормально. Тебе не нужно знать ответ прямо сейчас." }
  ]
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const shell = $("#site-shell");
const scenes = $$(".scene");
let gsap = window.gsap ?? null;
let ScrollTrigger = window.ScrollTrigger ?? null;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const duration = (value) => reducedMotion ? 0.01 : value;

function loadRemoteScript(url, ready) {
  if (ready()) return Promise.resolve(true);
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = url;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.append(script);
  });
}

const motionReady = loadRemoteScript(
  "https://cdn.jsdelivr.net/npm/gsap@3.15.1/dist/gsap.min.js",
  () => Boolean(window.gsap)
).then(() => loadRemoteScript(
  "https://cdn.jsdelivr.net/npm/gsap@3.15.1/dist/ScrollTrigger.min.js",
  () => Boolean(window.ScrollTrigger)
)).then(() => {
  gsap = window.gsap ?? null;
  ScrollTrigger = window.ScrollTrigger ?? null;
  if (gsap && ScrollTrigger) gsap.registerPlugin(ScrollTrigger);
  if (gsap && registry && !registry.locked && !registry.timelines.has(registry.current)) {
    const timeline = animateSceneIn(registry.current);
    if (timeline) registry.timelines.set(registry.current, timeline);
  }
}).catch((error) => {
  console.info("GSAP is unavailable; built-in scene transitions remain active.", error);
});

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
  setText(".conversation-lead", CONFIG.conversationLead);
  setText(".conversation-between", CONFIG.conversationBetween);
  CONFIG.promiseItems.forEach((item, index) => {
    setText(`#promise-node-title-${index}`, item.title);
    setText(`#promise-node-note-${index}`, item.note);
  });
  const conversationTitle = $("#conversation-title");
  renderHeadingLines(conversationTitle, CONFIG.conversationHeading, 1, CONFIG.conversationEmphasis);
  if (conversationTitle) {
    const heart = document.createElement("span");
    heart.className = "heart-mark";
    heart.textContent = "♥";
    conversationTitle.append(heart);
  }
  $$(".memory-node").forEach((node, index) => { node.setAttribute("aria-label", `Открыть воспоминание ${index + 1}: ${CONFIG.memories[index]}`); });
  $$(".conversation-option").forEach((button, index) => {
    const option = CONFIG.conversationOptions[index];
    if (!option) return;
    button.textContent = option.label;
    button.dataset.reaction = option.response;
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
    if (!THREE || !this.canvas) {
      if (this.canvas) this.canvas.hidden = true;
      return false;
    }
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
      const opened = node.classList.contains("is-opened");
      const glow = this.glowSprite(opened ? 0xf1d6a3 : 0xa5adb5, opened ? 0.72 : 0.1, opened ? 3.2 : 1.45);
      glow.position.copy(point);
      this.modeGroup.add(glow);
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(opened ? 0.3 : 0.21, 12, 8), new THREE.MeshBasicMaterial({ color: opened ? 0xf2d8a4 : 0x8d969f, transparent: true, opacity: opened ? 0.84 : 0.28 }));
      sphere.position.copy(point);
      this.modeGroup.add(sphere);
      this.memoryNodes.push({ node, point, glow, sphere });
    });
  }

  updateMemoryNodes(openedIndices) {
    if (this.mode !== "memories" || !this.renderer) return;
    this.memoryNodes.forEach(({ node, glow, sphere }) => {
      const opened = openedIndices.has(Number(node.dataset.memory));
      glow.material.color.setHex(opened ? 0xf1d6a3 : 0xa5adb5);
      glow.material.opacity = opened ? 0.72 : 0.1;
      glow.scale.setScalar(opened ? 3.2 : 1.45);
      sphere.material.color.setHex(opened ? 0xf2d8a4 : 0x8d969f);
      sphere.material.opacity = opened ? 0.84 : 0.28;
      sphere.scale.setScalar(opened ? 1 : 0.72);
    });
    this.renderOnce();
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
    this.canvas.style.opacity = mode === "puzzle" ? "0.68" : mode === "promise" ? "0.82" : "0.92";
    if (!this.renderer) return;
    if (mode === "intro") this.makeIntroObject();
    else if (mode === "memories") this.makeMemoryObjects();
    else if (mode === "constellation") this.makeConstellationObjects([]);
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
threeReady.then((module) => {
  if (!module || world.renderer) return;
  world.canvas.hidden = false;
  world.ready = world.create();
  if (world.ready) world.setMode(world.mode);
});

function animateSceneIn(index) {
  const scene = scenes[index];
  const inner = $(".scene__inner", scene);
  if (!gsap || !inner) return;
  // Clear prior entrance opacity without removing CSS centering transforms.
  gsap.set($$("*", inner), { clearProps: "opacity,clipPath" });
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
    tl.fromTo($(".puzzle-heading", scene), { opacity: 0, y: 24, clipPath: "inset(0 0 22% 0)" }, { opacity: 1, y: 0, clipPath: "inset(0 0 0 0)", duration: duration(.9), ease: "power4.out" })
      .fromTo($(".puzzle-board", scene), { opacity: 0, scale: .88, rotate: -4, filter: "blur(8px)" }, { opacity: 1, scale: 1, rotate: 0, filter: "blur(0px)", duration: duration(1.1), ease: "back.out(1.35)" }, "-=.35")
      .fromTo($$(".puzzle-mirror", scene), { opacity: 0, scale: .65 }, { opacity: 1, scale: 1, duration: duration(.55), stagger: reducedMotion ? 0 : .08, ease: "back.out(1.8)" }, "-=.55")
      .fromTo($(".puzzle-footer", scene), { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: duration(.55) }, "-=.2");
  } else if (index === 4) {
    tl.fromTo($(".promise-heading", scene), { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: duration(.72), ease: "power3.out" })
      .fromTo($$(".promise-node", scene), { opacity: 0, scale: .72, y: 30, rotation: -8 }, { opacity: 1, scale: 1, y: 0, rotation: 0, duration: duration(.85), stagger: reducedMotion ? 0 : .16, ease: "back.out(1.65)" }, "-=.2")
      .fromTo($(".promise-bottom", scene), { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: duration(.6) }, "-=.25");
  } else {
    tl.fromTo($(".conversation-main .eyebrow", scene), { opacity: 0, y: 9 }, { opacity: 1, y: 0, duration: duration(.65) })
      .fromTo($(".conversation-title", scene), { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: duration(.9) }, "-=.25")
      .fromTo($(".conversation-lead", scene), { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: duration(.65) }, "-=.3")
      .fromTo($(".conversation-choices--first", scene), { opacity: 0, y: 14, scale: .96 }, { opacity: 1, y: 0, scale: 1, duration: duration(.6) }, "-=.12")
      .fromTo($(".conversation-between", scene), { opacity: 0 }, { opacity: 1, duration: duration(.55) }, "-=.18")
      .fromTo($(".conversation-choices--second", scene), { opacity: 0, y: 12, scale: .96 }, { opacity: 1, y: 0, scale: 1, duration: duration(.6) }, "-=.12")
      .fromTo($(".reply-card", scene), { opacity: 0, y: 18, rotateX: 5 }, { opacity: 1, y: 0, rotateX: 0, duration: duration(.9), ease: "power3.out" }, "-=.25");
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
    [$(".puzzle-heading", scene), { y: -8 }], [$(".puzzle-board", scene), { scale: .98, rotate: 2 }],
    [$(".promise-heading", scene), { y: -8 }], [$(".promise-galaxy", scene), { scale: .98 }],
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
  setText("#scene-count", `${count} / ${String(scenes.length).padStart(2, "0")}`);
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
        // Some WebViews scroll focus containers even when preventScroll is requested.
        this.elements[index].scrollTop = 0;
        shell.scrollTop = 0;
      }
    }
    requestAnimationFrame(() => {
      if (this.current !== index) return;
      this.elements[index].scrollTop = 0;
      shell.scrollTop = 0;
      this.attachScroll(index);
    });
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
      const heading = $(".section-heading, .conversation-main", scene);
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
lenisReady.then((LenisClass) => {
  if (!LenisClass) return;
  Lenis = LenisClass;
  if (registry.scrollSessions.has(registry.current)) {
    registry.detachScroll(registry.current);
    registry.attachScroll(registry.current);
  }
});

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
registry.register(3, { onEnter: () => { world.setMode("puzzle"); refreshPuzzle(); } });
registry.register(4, { onEnter: () => { world.setMode("promise"); updatePromiseWeave(); } });
registry.register(5, { onEnter: () => world.setMode("conversation") });

const mirrorPositions = [
  { x: 150, y: 250 }, { x: 150, y: 150 },
  { x: 250, y: 150 }, { x: 250, y: 250 }
];
const mirrorButtons = $$(".puzzle-mirror");
const mirrorDirections = {
  "/": { E: "N", N: "E", W: "S", S: "W" },
  "\\": { E: "S", S: "E", W: "N", N: "W" }
};
let mirrorState = [...CONFIG.mirrorStart];
let puzzleComplete = false;

function distanceAhead(from, to, direction) {
  if (direction === "E" && to.y === from.y && to.x > from.x) return to.x - from.x;
  if (direction === "W" && to.y === from.y && to.x < from.x) return from.x - to.x;
  if (direction === "S" && to.x === from.x && to.y > from.y) return to.y - from.y;
  if (direction === "N" && to.x === from.x && to.y < from.y) return from.y - to.y;
  return Infinity;
}

function edgePoint(from, direction) {
  if (direction === "E") return { x: 400, y: from.y };
  if (direction === "W") return { x: 0, y: from.y };
  if (direction === "S") return { x: from.x, y: 400 };
  return { x: from.x, y: 0 };
}

function tracePuzzleBeam() {
  const points = [{ x: 0, y: 250 }];
  const touched = new Set();
  const visited = new Set();
  let position = points[0];
  let direction = "E";
  let solved = false;

  for (let step = 0; step < 16; step += 1) {
    let nextMirror = -1;
    let mirrorDistance = Infinity;
    mirrorPositions.forEach((mirror, index) => {
      const distance = distanceAhead(position, mirror, direction);
      if (distance < mirrorDistance) {
        nextMirror = index;
        mirrorDistance = distance;
      }
    });

    const goal = { x: 400, y: 250 };
    const goalDistance = distanceAhead(position, goal, direction);
    if (goalDistance < mirrorDistance) {
      points.push(goal);
      solved = true;
      break;
    }
    if (nextMirror < 0) {
      points.push(edgePoint(position, direction));
      break;
    }

    const mirror = mirrorPositions[nextMirror];
    points.push(mirror);
    touched.add(nextMirror);
    const stateKey = `${nextMirror}:${direction}`;
    if (visited.has(stateKey)) break;
    visited.add(stateKey);
    direction = mirrorDirections[mirrorState[nextMirror]][direction];
    position = mirror;
  }

  return { points, touched, solved };
}

function refreshPuzzle() {
  const board = $("#puzzle-board");
  const beacon = $("#puzzle-beacon");
  const beam = $("#puzzle-beam");
  const result = tracePuzzleBeam();
  beam.setAttribute("points", result.points.map(({ x, y }) => `${x},${y}`).join(" "));
  mirrorButtons.forEach((button, index) => {
    const orientation = mirrorState[index];
    button.dataset.orientation = orientation;
    button.classList.toggle("is-backslash", orientation === "\\");
    button.classList.toggle("is-aimed", result.touched.has(index));
    button.classList.remove("is-hinted");
    button.setAttribute("aria-pressed", String(orientation === "\\"));
    button.setAttribute("aria-label", `Повернуть зеркало ${index + 1}. Сейчас наклон ${orientation === "/" ? "вверх направо" : "вниз направо"}`);
  });
  puzzleComplete = result.solved;
  board.classList.toggle("is-complete", puzzleComplete);
  beacon.classList.toggle("is-lit", puzzleComplete);
  $("#puzzle-next").disabled = !puzzleComplete;
  setText("#puzzle-status", puzzleComplete
    ? "Маяк загорелся. Иногда путь находится шаг за шагом."
    : "Маяк ждёт луча. Поверни зеркала и найди путь.");
}

function turnMirror(index) {
  mirrorState[index] = mirrorState[index] === "/" ? "\\" : "/";
  refreshPuzzle();
  if (gsap) gsap.fromTo($(".puzzle-mirror__frame", mirrorButtons[index]), { scale: .88, rotate: -12 }, { scale: 1, rotate: 0, duration: duration(.42), ease: "back.out(2)" });
  if (puzzleComplete && gsap) {
    gsap.fromTo("#puzzle-beacon", { scale: .55, filter: "brightness(.7)" }, { scale: 1.3, filter: "brightness(1.8)", duration: duration(.48), yoyo: true, repeat: 1, ease: "power2.out" });
  }
}

function resetPuzzle() {
  mirrorState = [...CONFIG.mirrorStart];
  refreshPuzzle();
}

mirrorButtons.forEach((button) => button.addEventListener("click", () => turnMirror(Number(button.dataset.mirror))));
$("#puzzle-reset").addEventListener("click", resetPuzzle);
$("#puzzle-hint").addEventListener("click", () => {
  const index = mirrorState.findIndex((orientation, mirrorIndex) => orientation !== CONFIG.mirrorSolution[mirrorIndex]);
  if (index < 0) return;
  const button = mirrorButtons[index];
  button.classList.add("is-hinted");
  setText("#puzzle-status", `Попробуй повернуть зеркало ${index + 1}: наклон ${CONFIG.mirrorSolution[index] === "/" ? "вверх направо" : "вниз направо"}.`);
  if (gsap) gsap.fromTo($(".puzzle-mirror__frame", button), { scale: 1 }, { scale: 1.18, duration: duration(.32), yoyo: true, repeat: 3, ease: "sine.inOut" });
});
$("#puzzle-next").addEventListener("click", () => { if (puzzleComplete) registry.go(4); });

const selectedPromises = [];
const promisePath = $("#promise-path");

function updatePromiseWeave() {
  const nodes = $$(".promise-node");
  nodes.forEach((node, index) => {
    const selected = selectedPromises.includes(index);
    node.classList.toggle("is-selected", selected);
    node.setAttribute("aria-pressed", String(selected));
  });
  const points = selectedPromises.map((index) => nodes[index]?.dataset.point).filter(Boolean);
  if (selectedPromises.length === nodes.length && points.length) points.push(points[0]);
  promisePath.setAttribute("points", points.join(" "));
  if (points.length > 1 && gsap) {
    const length = promisePath.getTotalLength?.() ?? 0;
    if (length) {
      gsap.set(promisePath, { strokeDasharray: length, strokeDashoffset: length });
      gsap.to(promisePath, { strokeDashoffset: 0, duration: duration(.85), ease: "power2.out" });
    }
  }
  const count = selectedPromises.length;
  const message = count === nodes.length
    ? "Четыре опоры соединились. Дальше — только если тебе этого хочется."
    : count > 0
      ? `Соединено ${count} из ${nodes.length}. Можно добавить ещё или идти дальше.`
      : "Коснись одной точки, чтобы начать.";
  setText("#promise-message", message);
}

$$ (".promise-node").forEach((node) => node.addEventListener("click", () => {
  const index = Number(node.dataset.promise);
  const existing = selectedPromises.indexOf(index);
  if (existing >= 0) selectedPromises.splice(existing, 1);
  else selectedPromises.push(index);
  updatePromiseWeave();
  if (gsap) gsap.fromTo(node, { scale: .88 }, { scale: 1.08, duration: duration(.3), yoyo: true, repeat: 1, ease: "power2.out" });
}));

const openedMemories = new Set();
const memoryDialog = $("#memory-dialog");
const memoryCard = $(".memory-card", memoryDialog);
let pendingMemory = 0;

function updateMemoryProgress() {
  setText("#memory-progress", `Открыто ${openedMemories.size} из ${CONFIG.memories.length}`);
  $("#memories-next").disabled = openedMemories.size !== CONFIG.memories.length;
  $$(".memory-node").forEach((node, index) => node.classList.toggle("is-opened", openedMemories.has(index)));
  world.updateMemoryNodes(openedMemories);
}

function openMemory(index) {
  pendingMemory = index;
  openedMemories.add(index);
  updateMemoryProgress();
  setText("#memory-number", String(index + 1).padStart(2, "0"));
  setText("#memory-dialog-title", CONFIG.memories[index]);
  if (gsap) gsap.killTweensOf([memoryDialog, memoryCard]);
  memoryDialog.classList.remove("is-closing");
  if (!memoryDialog.open) memoryDialog.showModal();
  if (gsap && !reducedMotion) {
    const spark = $(".memory-card__spark", memoryCard);
    const title = $("#memory-dialog-title");
    gsap.set(memoryDialog, { opacity: 0, scale: .965, filter: "blur(8px)" });
    gsap.set(memoryCard, { opacity: 0, y: 34, scale: .88, rotateX: -12, transformPerspective: 900, clipPath: "inset(0 0 18% 0 round 24px)" });
    gsap.set([spark, title, $(".memory-card__foot", memoryCard), $(".memory-card__done", memoryCard), $(".memory-card__close", memoryCard)], { opacity: 0, y: 13 });
    gsap.timeline({ defaults: { ease: "power3.out" } })
      .to(memoryDialog, { opacity: 1, scale: 1, filter: "blur(0px)", duration: .32 }, 0)
      .to(memoryCard, { opacity: 1, y: 0, scale: 1, rotateX: 0, clipPath: "inset(0 0 0 0 round 18px)", duration: .72, ease: "power4.out" }, .02)
      .to(spark, { opacity: 1, y: 0, scale: 1.35, rotation: 45, duration: .5, ease: "back.out(2.4)" }, .2)
      .to(title, { opacity: 1, y: 0, duration: .48, ease: "power3.out" }, .28)
      .to([$(".memory-card__foot", memoryCard), $(".memory-card__done", memoryCard), $(".memory-card__close", memoryCard)], { opacity: 1, y: 0, duration: .38, stagger: .07 }, .38)
      .to(spark, { scale: 1, rotation: 0, duration: .45, ease: "elastic.out(1,.55)" }, .48);
  } else if (gsap) {
    gsap.set([memoryDialog, memoryCard, $(".memory-card__spark", memoryCard), $("#memory-dialog-title"), $(".memory-card__foot", memoryCard), $(".memory-card__done", memoryCard), $(".memory-card__close", memoryCard)], { clearProps: "all" });
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
  const closeNow = () => {
    memoryDialog.close();
    memoryDialog.classList.remove("is-closing");
    if (gsap) gsap.set([memoryDialog, memoryCard, $(".memory-card__spark", memoryCard), $("#memory-dialog-title"), $(".memory-card__foot", memoryCard), $(".memory-card__done", memoryCard), $(".memory-card__close", memoryCard)], { clearProps: "all" });
  };
  if (gsap && !reducedMotion) {
    memoryDialog.classList.add("is-closing");
    gsap.timeline({ onComplete: closeNow })
      .to([$(".memory-card__done", memoryCard), $(".memory-card__foot", memoryCard), $("#memory-dialog-title"), $(".memory-card__spark", memoryCard)], { opacity: 0, y: -7, duration: .16, stagger: .025, ease: "power2.in" }, 0)
      .to(memoryCard, { opacity: 0, y: 24, scale: .9, rotateX: 8, clipPath: "inset(18% 0 0 0 round 24px)", duration: .34, ease: "power3.in" }, .04)
      .to(memoryDialog, { opacity: 0, scale: .97, filter: "blur(8px)", duration: .3, ease: "power2.in" }, 0);
  } else closeNow();
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
$("#promise-next").addEventListener("click", () => registry.go(5));
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

const choiceFeedback = $("#conversation-choice-feedback");
$$ (".conversation-option").forEach((button) => button.addEventListener("click", () => {
  const response = button.dataset.reaction ?? "";
  $$(".conversation-option").forEach((option) => option.classList.toggle("is-selected", option === button));
  choiceFeedback.textContent = response;
  choiceFeedback.classList.add("is-visible");
  if (gsap) {
    gsap.killTweensOf([button, choiceFeedback]);
    gsap.timeline()
      .fromTo(button, { scale: .93, rotationX: -10, filter: "brightness(.72)", boxShadow: "0 0 0 rgba(216,184,130,0)" }, { scale: 1.035, rotationX: 0, filter: "brightness(1.2)", boxShadow: "0 0 38px rgba(216,184,130,.24)", duration: duration(.42), ease: "back.out(2.5)" })
      .to(button, { scale: 1, filter: "brightness(1)", boxShadow: "0 0 20px rgba(216,184,130,.11)", duration: duration(.6), ease: "power2.out" })
      .fromTo(choiceFeedback, { opacity: 0, y: 15, filter: "blur(8px)", clipPath: "inset(0 50% 0 50%)" }, { opacity: 1, y: 0, filter: "blur(0px)", clipPath: "inset(0 0% 0 0%)", duration: duration(.65), ease: "power3.out" }, "-=.45");
    gsap.fromTo(button, { borderColor: "rgba(240,215,169,.85)" }, { borderColor: "rgba(240,215,169,.35)", duration: duration(.8), repeat: 1, yoyo: true, ease: "sine.inOut" });
  }
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
})().catch((error) => {
  console.error("The story could not initialize.", error);
  const notice = document.createElement("div");
  notice.setAttribute("role", "alert");
  notice.textContent = "Не удалось запустить интерактивность. Обнови страницу и попробуй ещё раз.";
  notice.style.cssText = "position:fixed;z-index:100;left:16px;right:16px;bottom:18px;padding:14px 16px;border:1px solid rgba(240,215,169,.45);border-radius:14px;color:#f5efe4;background:#111a23;font:14px/1.45 system-ui,sans-serif;text-align:center";
  document.body.append(notice);
});
