import "./styles.css";
import { StoryEngine, type ChoiceRecord, type StoryBeat, type StoryChoice } from "./story";

const genres = ["幻想譚", "SF", "ミステリー", "冒険", "日常の異変"];

const engine = new StoryEngine();
const history: ChoiceRecord[] = [];

let currentBeat: StoryBeat | null = null;
let isGenerating = false;

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <main class="app-shell" aria-live="polite">
    <header>
      <h1>tales</h1>
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
      <p id="sceneText"></p>
      <div class="choices" id="choices"></div>
    </section>

    <p class="status" id="status"></p>
  </main>
`;

const setupPanel = document.querySelector<HTMLDivElement>("#setupPanel")!;
const scenePanel = document.querySelector<HTMLDivElement>("#scenePanel")!;
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
    history.length = 0;
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

  history.push({ scene: currentBeat.stateSummary || currentBeat.scene, choice });

  await generate(async () => {
    currentBeat = await engine.continue(history, setStatus);
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
  choices.innerHTML = "";

  for (const choice of currentBeat.choices) {
    const button = document.createElement("button");
    button.className = "choice-button";
    button.type = "button";
    button.innerHTML = `
      <span>${choice.id}</span>
      <strong>${choice.label}</strong>
    `;
    button.addEventListener("click", () => {
      void choose(choice);
    });
    choices.append(button);
  }

  renderHistory();
  renderDisabledState();
}

function renderHistory() {
  document.title = history.length ? `tales (${history.length})` : "tales";
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

  history.length = 0;
  currentBeat = null;
  engine.destroy();
  sceneText.textContent = "";
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
