export type StoryChoice = {
  id: string;
  label: string;
};

export type StoryBeat = {
  scene: string;
  choices: StoryChoice[];
  backgroundColor: string;
  stateSummary: string;
};

export type StoryRecord = {
  scene: string;
  choice: StoryChoice;
};

export type StorySeed = {
  genre: string;
};

export type ProgressHandler = (message: string) => void;

const systemPrompt = `
短い分岐型物語を書く。
求められた本文または選択肢だけを返す。
JSON、Markdown、箇条書き、説明は禁止。
`.trim();
const recentHistoryLimit = 3;

export class StoryEngine {
  private session: LanguageModel | null = null;
  private history: StoryRecord[] = [];

  public async prepare(onProgress?: ProgressHandler) {
    if (this.session) {
      return;
    }

    if (typeof LanguageModel === "undefined") {
      throw new Error("このブラウザでは Chrome の組み込み AI API が見つかりません。");
    }

    const availability = await LanguageModel.availability();

    if (availability === "unavailable") {
      throw new Error("この環境では組み込み AI モデルを利用できません。Chrome の Prompt API 対応環境で開いてください。");
    }

    if (availability === "downloadable") {
      onProgress?.("AI モデルをダウンロードしています。初回だけ時間がかかります。");
    }

    this.session = await LanguageModel.create({
      initialPrompts: [{ role: "system", content: systemPrompt }],
      temperature: 0.9,
      topK: 6,
      monitor: (monitor) => {
        monitor.addEventListener("downloadprogress", (event) => {
          if (event.total && event.loaded !== undefined) {
            onProgress?.(
              `AI モデルをダウンロードしています: ${Math.round((event.loaded / event.total) * 100)}%`,
            );
            return;
          }

          onProgress?.("AI モデルを準備しています。");
        });
      },
    });
  }

  public async start(seed: StorySeed, onProgress?: ProgressHandler) {
    await this.prepare(onProgress);
    this.history = [];
    const plot = await this.promptPlot(seed.genre);

    return this.generate(`
本文だけ。1-2文、180字以内。選択肢と問いかけは禁止。
ジャンル: ${seed.genre}
プロット: ${plot}
主語は「あなた」。
`);
  }

  public async continue(currentBeat: StoryBeat, choice: StoryChoice, onProgress?: ProgressHandler) {
    await this.prepare(onProgress);
    this.history.push({ scene: currentBeat.scene, choice });
    const recentHistory = this.recentHistory;
    const firstTurn = this.history.length - recentHistory.length + 1;

    return this.generate(`
本文だけ。1-2文、180字以内。直前の選択を反映。選択肢と問いかけは禁止。
${recentHistory
  .map((record, index) => `${firstTurn + index}. ${record.scene}\n選択: ${record.choice.label}`)
  .join("\n\n")}
`);
  }

  public get turnCount() {
    return this.history.length;
  }

  public get records(): readonly StoryRecord[] {
    return this.history;
  }

  private get recentHistory() {
    return this.history.slice(-recentHistoryLimit);
  }

  public destroy() {
    this.session?.destroy();
    this.session = null;
    this.history = [];
  }

  private async generate(prompt: string) {
    if (!this.session) {
      throw new Error("AI セッションが初期化されていません。");
    }

    const scene = (await this.session.prompt(prompt)).trim();
    const backgroundColor = await this.promptBackgroundColor(scene);
    const choiceA = await this.promptChoice("A", scene);
    const choiceB = await this.promptChoice("B", scene, choiceA);

    return {
      scene,
      choices: [
        { id: "A", label: choiceA },
        { id: "B", label: choiceB },
      ],
      backgroundColor,
      stateSummary: scene.replace(/\s+/g, " ").slice(0, 80),
    };
  }

  private async promptChoice(id: "A" | "B", scene: string, otherChoice?: string) {
    if (!this.session) {
      throw new Error("AI セッションが初期化されていません。");
    }

    return (
      await this.session.prompt(`
選択肢${id}を1つだけ。16字以内。ラベル、番号、句点は禁止。
${scene}
${otherChoice ? `「${otherChoice}」とは別方向。` : "能動的な行動。"}
`)
    ).trim();
  }

  private async promptBackgroundColor(scene: string) {
    if (!this.session) {
      throw new Error("AI セッションが初期化されていません。");
    }

    const color = (
      await this.session.prompt(`
本文の雰囲気に合う背景色を1つだけ。#RRGGBBだけを返す。
${scene}
`)
    ).trim();

    return /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#ffffff";
  }

  private async promptPlot(genre: string) {
    const session = await this.createSession({ temperature: 1, topK: 20 });

    try {
      return (
        await session.prompt(`${genre}の導入プロットを1行だけ。場所、時、異変、持ち物を含める。`)
      ).trim();
    } finally {
      session.destroy();
    }
  }

  private async createSession(options?: { temperature?: number; topK?: number }) {
    return LanguageModel.create({
      initialPrompts: [{ role: "system", content: systemPrompt }],
      temperature: options?.temperature ?? 0.9,
      topK: options?.topK ?? 6,
    });
  }
}
