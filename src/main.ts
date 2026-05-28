import "./styles.css";
import { StoryEngine, type StoryBeat, type StoryChoice } from "./story";

const genres = ["幻想譚", "SF", "ミステリー", "冒険", "日常の異変"];

const engine = new StoryEngine();

let currentBeat: StoryBeat | null = null;
let isGenerating = false;

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <main class="app-shell" aria-live="polite">
    <header>
      <h1></h1>
      <button class="hidden" id="resetButton" type="button">最初から</button>
    </header>

    <section class="setup" id="setupPanel">
      <label>
        ジャンル
        <select id="genreSelect">
          ${genres.map((genre) => `<option value="${genre}">${genre}</option>`).join("")}
        </select>
      </label>

      <button id="startButton" type="button">始める</button>
    </section>

    <section class="scene hidden" id="scenePanel">
      <div class="story-log" id="storyLog"></div>
      <p id="sceneText"></p>
      <div class="choices" id="choices"></div>
    </section>

    <p class="status" id="status"></p>
  </main>
`;

const setupPanel = document.querySelector<HTMLDivElement>("#setupPanel")!;
const scenePanel = document.querySelector<HTMLDivElement>("#scenePanel")!;
const storyLog = document.querySelector<HTMLDivElement>("#storyLog")!;
const sceneText = document.querySelector<HTMLDivElement>("#sceneText")!;
const choices = document.querySelector<HTMLDivElement>("#choices")!;
const statusText = document.querySelector<HTMLParagraphElement>("#status")!;
const genreSelect = document.querySelector<HTMLSelectElement>("#genreSelect")!;
const startButton = document.querySelector<HTMLButtonElement>("#startButton")!;
const resetButton = document.querySelector<HTMLButtonElement>("#resetButton")!;

startButton.addEventListener("click", () => {
  void runStart();
});

resetButton.addEventListener("click", resetStory);

async function runStart() {
  if (isGenerating) {
    return;
  }

  await generate(async () => {
    currentBeat = await engine.start({ genre: genreSelect.value }, setStatus);
    setupPanel.classList.add("hidden");
    scenePanel.classList.remove("hidden");
    resetButton.classList.remove("hidden");
    render();
  });
}

async function choose(choice: StoryChoice) {
  if (!currentBeat || isGenerating) {
    return;
  }

  const beat = currentBeat;

  await generate(async () => {
    currentBeat = await engine.continue(beat, choice, setStatus);
    render();
  });
}

async function generate(action: () => Promise<void>) {
  try {
    isGenerating = true;
    setStatus("AI が物語を書いています。");
    renderDisabledState();
    await action();
    setStatus("");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "生成中にエラーが発生しました。");
  } finally {
    isGenerating = false;
    renderDisabledState();
  }
}

function render() {
  if (!currentBeat) {
    return;
  }

  sceneText.textContent = currentBeat.scene;
  setTheme(currentBeat.backgroundColor);
  renderStoryLog();
  choices.innerHTML = "";

  for (const choice of currentBeat.choices) {
    const button = document.createElement("button");
    const id = document.createElement("span");
    const label = document.createElement("strong");

    button.className = "choice-button";
    button.type = "button";
    id.textContent = choice.id;
    label.textContent = choice.label;
    button.append(id, label);
    button.addEventListener("click", () => {
      void choose(choice);
    });
    choices.append(button);
  }

  renderHistory();
  renderDisabledState();
  scrollToCurrentScene();
}

function renderHistory() {
  document.title = engine.turnCount ? `tales (${engine.turnCount})` : "tales";
}

function renderStoryLog() {
  storyLog.innerHTML = "";

  for (const record of engine.records) {
    const item = document.createElement("section");
    const scene = document.createElement("p");
    const choice = document.createElement("p");

    item.className = "story-log-item";
    scene.textContent = record.scene;
    choice.className = "story-log-choice";
    choice.textContent = `${record.choice.id}. ${record.choice.label}`;
    item.append(scene, choice);
    storyLog.append(item);
  }
}

function renderDisabledState() {
  startButton.disabled = isGenerating;
  resetButton.disabled = isGenerating;

  for (const button of choices.querySelectorAll("button")) {
    button.disabled = isGenerating;
  }
}

function resetStory() {
  if (isGenerating) {
    return;
  }

  currentBeat = null;
  engine.destroy();
  clearTheme();
  sceneText.textContent = "";
  storyLog.innerHTML = "";
  choices.innerHTML = "";
  renderHistory();
  statusText.textContent = "";
  setupPanel.classList.remove("hidden");
  scenePanel.classList.add("hidden");
  resetButton.classList.add("hidden");
}

function setStatus(message: string) {
  statusText.textContent = message;
}

function setTheme(backgroundColor: string) {
  document.body.style.setProperty("--background-color", backgroundColor);
  document.body.style.setProperty("--text-color", isDark(backgroundColor) ? "#fff" : "#222");
  document.body.style.setProperty("--border-color", isDark(backgroundColor) ? "#ffffff80" : "#00000055");
  document.body.style.setProperty("--control-color", isDark(backgroundColor) ? "#111" : "#fff");
}

function clearTheme() {
  document.body.style.removeProperty("--background-color");
  document.body.style.removeProperty("--text-color");
  document.body.style.removeProperty("--border-color");
  document.body.style.removeProperty("--control-color");
}

function isDark(color: string) {
  const red = Number.parseInt(color.slice(1, 3), 16);
  const green = Number.parseInt(color.slice(3, 5), 16);
  const blue = Number.parseInt(color.slice(5, 7), 16);

  return (red * 299 + green * 587 + blue * 114) / 1000 < 140;
}

function scrollToCurrentScene() {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      smoothScrollTo(Math.max(sceneText.offsetTop - 96, 0), 1100);
    });
  });
}

function smoothScrollTo(target: number, duration: number) {
  const start = window.scrollY;
  const distance = target - start;
  const startedAt = performance.now();

  function step(now: number) {
    const progress = Math.min((now - startedAt) / duration, 1);
    window.scrollTo({ top: start + distance * easeInOutCubic(progress) });

    if (progress < 1) {
      requestAnimationFrame(step);
    }
  }

  requestAnimationFrame(step);
}

function easeInOutCubic(value: number) {
  return value < 0.5 ? 4 * value ** 3 : 1 - (-2 * value + 2) ** 3 / 2;
}
