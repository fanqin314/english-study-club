var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => EnglishStudyClubPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var DASHBOARD_VIEW_TYPE = "english-study-club-dashboard";
var DashboardView = class extends import_obsidian.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  getViewType() {
    return DASHBOARD_VIEW_TYPE;
  }
  getDisplayText() {
    return "\u82F1\u7814\u793E\u4EEA\u8868\u76D8";
  }
  getIcon() {
    return "book-open";
  }
  async onOpen() {
    await this.refresh();
  }
  async refresh() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("erl-dashboard");
    const stats = await this.plugin.collectDashboardStats();
    const header = container.createEl("div", { cls: "erl-dashboard-header" });
    header.createEl("h2", { text: "\u82F1\u7814\u793E" });
    if (stats.totalArticles === 0 && stats.totalCaptures === 0) {
      const emptyState = container.createEl("div", { cls: "erl-empty-state" });
      emptyState.createEl("p", { text: "\u6682\u65E0\u5B66\u4E60\u6570\u636E\n\u8BF7\u5148\u5728\u82F1\u7814\u793E\u4E2D\u5206\u6790\u6587\u7AE0" });
      return;
    }
    const statsRow = container.createEl("div", { cls: "erl-stats-row" });
    if (this.plugin.settings.showArticles) {
      const card1 = statsRow.createEl("div", { cls: "erl-stat-card" });
      card1.createEl("div", { cls: "erl-stat-value", text: String(stats.totalArticles) });
      card1.createEl("div", { cls: "erl-stat-label", text: "\u5DF2\u5206\u6790\u6587\u7AE0" });
    }
    if (this.plugin.settings.showVocabulary) {
      const card2 = statsRow.createEl("div", { cls: "erl-stat-card" });
      card2.createEl("div", { cls: "erl-stat-value", text: String(stats.totalVocabWords) });
      card2.createEl("div", { cls: "erl-stat-label", text: "\u751F\u8BCD\u6570\u91CF" });
    }
    if (this.plugin.settings.showCaptures) {
      const card3 = statsRow.createEl("div", { cls: "erl-stat-card" });
      card3.createEl("div", { cls: "erl-stat-value", text: String(stats.totalCaptures) });
      card3.createEl("div", { cls: "erl-stat-label", text: "\u91C7\u96C6\u5185\u5BB9" });
    }
    if (stats.recentActivity.length > 0) {
      const activitySection = container.createEl("div", { cls: "erl-section" });
      activitySection.createEl("h3", { text: "\u6700\u8FD1 7 \u5929\u6D3B\u52A8" });
      const activityList = activitySection.createEl("div", { cls: "erl-activity-list" });
      for (const item of stats.recentActivity) {
        const row = activityList.createEl("div", { cls: "erl-activity-item" });
        row.createEl("span", { cls: "erl-activity-date", text: item.date });
        row.createEl("span", { cls: "erl-activity-count", text: String(item.count) + " \u4E2A\u6587\u4EF6" });
      }
    }
    if (stats.recentCaptures.length > 0) {
      const capturesSection = container.createEl("div", { cls: "erl-section" });
      capturesSection.createEl("h3", { text: "\u6700\u8FD1\u91C7\u96C6" });
      const capturesList = capturesSection.createEl("div", { cls: "erl-captures-list" });
      for (const item of stats.recentCaptures) {
        const row = capturesList.createEl("div", { cls: "erl-capture-item" });
        const link = row.createEl("a", {
          cls: "internal-link",
          text: item.name,
          href: item.path
        });
        link.addEventListener("click", (e) => {
          e.preventDefault();
          this.app.workspace.openLinkText(item.path, "", false);
        });
      }
    }
  }
};
var DEFAULT_SETTINGS = {
  reviewIntervalDays: 7,
  showArticles: true,
  showVocabulary: true,
  showCaptures: true,
  syncFolder: ""
};
var EnglishStudyClubSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "\u82F1\u7814\u793E\u8BBE\u7F6E" });
    new import_obsidian.Setting(containerEl).setName("\u590D\u4E60\u95F4\u9694\uFF08\u5929\uFF09").setDesc("\u8D85\u8FC7\u8BE5\u5929\u6570\u672A\u4FEE\u6539\u7684\u6587\u7AE0\u5C06\u51FA\u73B0\u5728\u590D\u4E60\u8BA1\u5212\u4E2D").addText(
      (text) => text.setValue(String(this.plugin.settings.reviewIntervalDays)).onChange(async (value) => {
        const num = parseInt(value, 10);
        if (!isNaN(num) && num > 0) {
          this.plugin.settings.reviewIntervalDays = num;
          await this.plugin.saveSettings();
        }
      })
    );
    containerEl.createEl("h3", { text: "\u4EEA\u8868\u76D8\u663E\u793A\u9009\u9879" });
    new import_obsidian.Setting(containerEl).setName("\u663E\u793A\u6587\u7AE0\u6570").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.showArticles).onChange(async (value) => {
        this.plugin.settings.showArticles = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("\u663E\u793A\u751F\u8BCD\u6570").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.showVocabulary).onChange(async (value) => {
        this.plugin.settings.showVocabulary = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("\u663E\u793A\u91C7\u96C6\u6570").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.showCaptures).onChange(async (value) => {
        this.plugin.settings.showCaptures = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("\u672C\u5730\u6587\u4EF6\u5939\u540C\u6B65\u8DEF\u5F84").setDesc(
      "\u6D4F\u89C8\u5668\u63D2\u4EF6\u6216\u7F51\u9875\u7AEF\u9009\u5B9A\u300C\u672C\u5730\u6587\u4EF6\u5939\u300D\u540E\uFF0C\u4F1A\u5199\u51FA articles.json / vocab.json / captures.json\u3002\u82E5\u4F60\u628A\u8FD9\u4E2A\u6587\u4EF6\u5939\u653E\u5728 vault \u5185\uFF0C\u5728\u6B64\u586B\u5199\u5176\u76F8\u5BF9\u8DEF\u5F84\uFF08\u5982 english-study-club\uFF09\uFF0C\u5373\u53EF\u7528\u300C\u4ECE\u6587\u4EF6\u5939\u540C\u6B65\u300D\u547D\u4EE4\u4E00\u952E\u5BFC\u5165\u3002\u7559\u7A7A\u5219\u7981\u7528\u540C\u6B65\u3002"
    ).addText(
      (text) => text.setPlaceholder("english-study-club").setValue(this.plugin.settings.syncFolder).onChange(async (value) => {
        this.plugin.settings.syncFolder = value.trim();
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("\u7ACB\u5373\u540C\u6B65").setDesc("\u8BFB\u53D6\u4E0A\u65B9\u6587\u4EF6\u5939\u4E2D\u7684 articles.json / vocab.json / captures.json \u5E76\u5BFC\u5165 vault\uFF08\u8986\u76D6\u517C\u5BB9 browser-extension/ \u5B50\u76EE\u5F55\uFF09\u3002").addButton(
      (btn) => btn.setButtonText("\u4ECE\u6587\u4EF6\u5939\u540C\u6B65").setCta().onClick(async () => {
        try {
          const added = await this.plugin.syncFromFolder();
          if (added > 0) {
            const leaves = this.plugin.app.workspace.getLeavesOfType(DASHBOARD_VIEW_TYPE);
            for (const leaf of leaves) {
              const view = leaf.view;
              if (view) view.refresh();
            }
          }
        } catch (e) {
          new import_obsidian.Notice("\u540C\u6B65\u5931\u8D25: " + (e && e.message ? e.message : e));
        }
      })
    );
  }
};
var EnglishStudyClubPlugin = class extends import_obsidian.Plugin {
  async onload() {
    await this.loadSettings();
    this.registerView(
      DASHBOARD_VIEW_TYPE,
      (leaf) => new DashboardView(leaf, this)
    );
    this.addRibbonIcon("book-open", "\u82F1\u7814\u793E\u4EEA\u8868\u76D8", () => {
      this.activateDashboard();
    });
    this.addCommand({
      id: "open-dashboard",
      name: "\u6253\u5F00\u5B66\u4E60\u4EEA\u8868\u76D8",
      callback: () => this.activateDashboard()
    });
    this.addCommand({
      id: "generate-review-plan",
      name: "\u751F\u6210\u590D\u4E60\u8BA1\u5212",
      callback: () => this.generateReviewPlan()
    });
    this.addCommand({
      id: "create-bidirectional-links",
      name: "\u5EFA\u7ACB\u53CC\u5411\u94FE\u63A5",
      callback: () => this.createBidirectionalLinks()
    });
    this.addCommand({
      id: "import-esc-json",
      name: "\u5BFC\u5165 English Study Club JSON",
      callback: () => {
        new ImportEscModal(this.app, this).open();
      }
    });
    this.addCommand({
      id: "sync-from-folder",
      name: "\u4ECE\u672C\u5730\u6587\u4EF6\u5939\u540C\u6B65",
      callback: async () => {
        try {
          const added = await this.syncFromFolder();
          if (added > 0) {
            const leaves = this.app.workspace.getLeavesOfType(DASHBOARD_VIEW_TYPE);
            for (const leaf of leaves) {
              const view = leaf.view;
              if (view) view.refresh();
            }
          }
        } catch (e) {
          new import_obsidian.Notice("\u540C\u6B65\u5931\u8D25: " + (e && e.message ? e.message : e));
        }
      }
    });
    this.addCommand({
      id: "export-esc-json",
      name: "\u5BFC\u51FA English Study Club JSON",
      callback: async () => {
        try {
          const json = await this.exportEscJson();
          const path = "english-study-club-export.json";
          await this.app.vault.adapter.write(path, json);
          new import_obsidian.Notice("\u5DF2\u5BFC\u51FA\u5230 vault \u6839\u76EE\u5F55\uFF1A" + path);
          try {
            await navigator.clipboard.writeText(json);
            new import_obsidian.Notice("JSON \u5DF2\u540C\u65F6\u590D\u5236\u5230\u526A\u8D34\u677F");
          } catch (e) {
          }
        } catch (e) {
          new import_obsidian.Notice("\u5BFC\u51FA\u5931\u8D25: " + e.message);
        }
      }
    });
    this.addCommand({
      id: "new-capture",
      name: "\u65B0\u5EFA\u7F51\u9875\u91C7\u96C6\uFF08\u53EF\u52A0 note \u6807\u6CE8\uFF09",
      callback: () => {
        new NewCaptureModal(this.app, this).open();
      }
    });
    this.addCommand({
      id: "review-today-cards",
      name: "\u590D\u4E60\u4ECA\u65E5\u5361\u7247",
      callback: () => this.reviewTodayCards()
    });
    this.addSettingTab(new EnglishStudyClubSettingTab(this.app, this));
    if (this.app.workspace.layoutReady) {
      this.initDashboard();
    } else {
      this.registerEvent(
        this.app.workspace.on("layout-change", () => this.initDashboard())
      );
    }
  }
  async initDashboard() {
  }
  async activateDashboard() {
    const { workspace } = this.app;
    const existing = workspace.getLeavesOfType(DASHBOARD_VIEW_TYPE);
    if (existing.length > 0) {
      workspace.revealLeaf(existing[0]);
      return;
    }
    const leaf = workspace.getRightLeaf(false);
    if (leaf) {
      await leaf.setViewState({ type: DASHBOARD_VIEW_TYPE, active: true });
      workspace.revealLeaf(leaf);
    }
  }
  async onunload() {
    this.app.workspace.detachLeavesOfType(DASHBOARD_VIEW_TYPE);
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
    const leaves = this.app.workspace.getLeavesOfType(DASHBOARD_VIEW_TYPE);
    for (const leaf of leaves) {
      const view = leaf.view;
      if (view) {
        view.refresh();
      }
    }
  }
  // ============================================================
  // Dashboard Data Collection
  // ============================================================
  async collectDashboardStats() {
    const stats = {
      totalArticles: 0,
      totalVocabWords: 0,
      totalCaptures: 0,
      recentActivity: [],
      recentCaptures: []
    };
    try {
      const adapter = this.app.vault.adapter;
      if (await adapter.exists("history")) {
        const historyFiles = await adapter.list("history");
        stats.totalArticles = historyFiles.files.filter(
          (f) => f.endsWith(".md")
        ).length;
      }
      if (await adapter.exists("vocab")) {
        const vocabFiles = await adapter.list("vocab");
        const vocabMdFiles = vocabFiles.files.filter(
          (f) => f.endsWith(".md")
        );
        for (const filePath of vocabMdFiles) {
          try {
            const content = await adapter.read(filePath);
            const lines = content.split("\n");
            let wordCount = 0;
            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed.startsWith("|") && trimmed.endsWith("|") && !trimmed.includes("---") && !trimmed.includes("Word") && !trimmed.includes("\u5355\u8BCD") && trimmed.split("|").length >= 3) {
                wordCount++;
              }
            }
            stats.totalVocabWords += wordCount;
          } catch (_e) {
          }
        }
      }
      if (await adapter.exists("browser-captures")) {
        const captureFiles = await adapter.list("browser-captures");
        const captureMdFiles = captureFiles.files.filter(
          (f) => f.endsWith(".md")
        );
        stats.totalCaptures = captureMdFiles.length;
        const captureWithTimes = [];
        for (const filePath of captureMdFiles) {
          try {
            const stat = await adapter.stat(filePath);
            if (stat) {
              captureWithTimes.push({
                name: filePath.replace("browser-captures/", "").replace(".md", ""),
                path: filePath,
                mtime: stat.mtime
              });
            }
          } catch (_e) {
          }
        }
        captureWithTimes.sort((a, b) => b.mtime - a.mtime);
        stats.recentCaptures = captureWithTimes.slice(0, 5);
      }
      const now = Date.now();
      const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1e3;
      const activityMap = /* @__PURE__ */ new Map();
      const allDirs = ["history", "vocab", "browser-captures"];
      for (const dir of allDirs) {
        if (await adapter.exists(dir)) {
          const dirFiles = await adapter.list(dir);
          const mdFiles = dirFiles.files.filter((f) => f.endsWith(".md"));
          for (const filePath of mdFiles) {
            try {
              const stat = await adapter.stat(filePath);
              if (stat && stat.mtime && stat.mtime >= sevenDaysAgo) {
                const dateStr = new Date(stat.mtime).toISOString().split("T")[0];
                activityMap.set(
                  dateStr,
                  (activityMap.get(dateStr) || 0) + 1
                );
              }
            } catch (_e) {
            }
          }
        }
      }
      stats.recentActivity = Array.from(activityMap.entries()).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date));
    } catch (error) {
      console.error("English Study Club: Error collecting dashboard stats", error);
    }
    return stats;
  }
  // ============================================================
  // Review Plan Generation
  // ============================================================
  async generateReviewPlan() {
    try {
      const adapter = this.app.vault.adapter;
      const intervalMs = this.settings.reviewIntervalDays * 24 * 60 * 60 * 1e3;
      const now = Date.now();
      const threshold = now - intervalMs;
      const historyItems = [];
      const vocabItems = [];
      if (await adapter.exists("history")) {
        const historyFiles = await adapter.list("history");
        const mdFiles = historyFiles.files.filter((f) => f.endsWith(".md"));
        for (const filePath of mdFiles) {
          try {
            const stat = await adapter.stat(filePath);
            if (stat && stat.mtime && stat.mtime < threshold) {
              historyItems.push({
                name: filePath.replace("history/", "").replace(".md", ""),
                path: filePath
              });
            }
          } catch (_e) {
          }
        }
      }
      if (await adapter.exists("vocab")) {
        const vocabFiles = await adapter.list("vocab");
        const mdFiles = vocabFiles.files.filter((f) => f.endsWith(".md"));
        for (const filePath of mdFiles) {
          vocabItems.push({
            name: filePath.replace("vocab/", "").replace(".md", ""),
            path: filePath
          });
        }
      }
      let completionRate = 0;
      let totalItems = 0;
      let completedItems = 0;
      let existingContent = "";
      if (await adapter.exists("\u5B66\u4E60\u8BA1\u5212.md")) {
        try {
          existingContent = await adapter.read("\u5B66\u4E60\u8BA1\u5212.md");
          const lines = existingContent.split("\n");
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("- [x]") || trimmed.startsWith("- [X]")) {
              completedItems++;
              totalItems++;
            } else if (trimmed.startsWith("- [ ]")) {
              totalItems++;
            }
          }
          if (totalItems > 0) {
            completionRate = Math.round(completedItems / totalItems * 100);
          }
        } catch (_e) {
        }
      }
      const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      let planContent = "# \u5B66\u4E60\u8BA1\u5212\n\n";
      planContent += `\u751F\u6210\u65F6\u95F4: ${today}

`;
      if (totalItems > 0) {
        planContent += `\u5B8C\u6210\u7387: ${completionRate}%\uFF08${completedItems}/${totalItems}\uFF09

`;
      }
      planContent += "## \u5F85\u590D\u4E60\u6587\u7AE0\n\n";
      if (historyItems.length > 0) {
        for (const item of historyItems) {
          planContent += `- [ ] [[${item.path}|${item.name}]]
`;
        }
      } else {
        planContent += "\u6682\u65E0\u9700\u8981\u590D\u4E60\u7684\u6587\u7AE0\u3002\n";
      }
      planContent += "\n";
      planContent += "## \u5F85\u590D\u4E60\u5355\u8BCD\n\n";
      if (vocabItems.length > 0) {
        for (const item of vocabItems) {
          planContent += `- [ ] [[${item.path}|${item.name}]]
`;
        }
      } else {
        planContent += "\u672A\u627E\u5230\u751F\u8BCD\u6587\u4EF6\u3002\n";
      }
      await adapter.write("\u5B66\u4E60\u8BA1\u5212.md", planContent);
      new import_obsidian.Notice(
        `\u590D\u4E60\u8BA1\u5212\u5DF2\u751F\u6210\uFF1A${historyItems.length} \u7BC7\u6587\u7AE0\uFF0C${vocabItems.length} \u4E2A\u751F\u8BCD\u672C\u6587\u4EF6`
      );
    } catch (error) {
      console.error("English Study Club: Error generating review plan", error);
      new import_obsidian.Notice("\u751F\u6210\u590D\u4E60\u8BA1\u5212\u5931\u8D25\uFF0C\u8BF7\u67E5\u770B\u63A7\u5236\u53F0\u83B7\u53D6\u8BE6\u7EC6\u4FE1\u606F\u3002");
    }
  }
  // ============================================================
  // Bidirectional Linking
  // ============================================================
  async createBidirectionalLinks() {
    try {
      const activeFile = this.app.workspace.getActiveFile();
      if (!activeFile) {
        new import_obsidian.Notice("\u672A\u6253\u5F00\u6587\u4EF6\uFF0C\u8BF7\u5148\u6253\u5F00\u6587\u7AE0\u6587\u4EF6");
        return;
      }
      const filePath = activeFile.path;
      if (!filePath.startsWith("history/") && !filePath.startsWith("browser-captures/")) {
        new import_obsidian.Notice(
          "\u53CC\u5411\u94FE\u63A5\u4EC5\u9002\u7528\u4E8E history/ \u6216 browser-captures/ \u76EE\u5F55\u4E0B\u7684\u6587\u4EF6"
        );
        return;
      }
      const adapter = this.app.vault.adapter;
      const articleContent = await adapter.read(filePath);
      const wordRegex = /\b[a-zA-Z]{2,}\b/g;
      const words = articleContent.match(wordRegex) || [];
      const uniqueWords = [...new Set(words.map((w) => w.toLowerCase()))];
      const vocabMatches = /* @__PURE__ */ new Map();
      if (await adapter.exists("vocab")) {
        const vocabFiles = await adapter.list("vocab");
        const vocabMdFiles = vocabFiles.files.filter((f) => f.endsWith(".md"));
        for (const vocabPath of vocabMdFiles) {
          try {
            const vocabContent = await adapter.read(vocabPath);
            const lowerVocab = vocabContent.toLowerCase();
            const matchedWords = [];
            for (const word of uniqueWords) {
              if (lowerVocab.includes(word)) {
                matchedWords.push(word);
              }
            }
            if (matchedWords.length > 0) {
              vocabMatches.set(vocabPath, {
                vocabPath,
                words: matchedWords
              });
            }
          } catch (_e) {
          }
        }
      }
      if (vocabMatches.size === 0) {
        new import_obsidian.Notice("\u6587\u7AE0\u4E2D\u672A\u627E\u5230\u5339\u914D\u7684\u751F\u8BCD");
        return;
      }
      let modifiedContent = articleContent;
      let totalLinksCreated = 0;
      for (const [, match] of vocabMatches) {
        for (const word of match.words) {
          const vocabName = match.vocabPath.replace("vocab/", "").replace(".md", "");
          const linkText = `[[${match.vocabPath}#${word}|${word}]]`;
          const wordPattern = new RegExp(`\\b(${escapeRegExp(word)})\\b`, "i");
          const execResult = wordPattern.exec(modifiedContent);
          if (execResult) {
            const beforeMatch = modifiedContent.substring(0, execResult.index);
            const afterMatch = modifiedContent.substring(execResult.index + execResult[0].length);
            const lastOpenBracket = beforeMatch.lastIndexOf("[[");
            const lastCloseBracket = beforeMatch.lastIndexOf("]]");
            if (lastOpenBracket <= lastCloseBracket) {
              modifiedContent = beforeMatch + execResult[0] + " " + linkText + afterMatch;
              wordPattern.lastIndex = execResult.index + execResult[0].length + linkText.length + 1;
              totalLinksCreated++;
            }
          }
        }
      }
      if (modifiedContent !== articleContent) {
        await adapter.write(filePath, modifiedContent);
      }
      let reverseLinksCreated = 0;
      const articleLink = `[[${filePath}]]`;
      const articleName = filePath.replace(/^(history|browser-captures)\//, "").replace(".md", "");
      for (const [vocabPath] of vocabMatches) {
        try {
          const vocabContent = await adapter.read(vocabPath);
          const sectionHeader = "## \u76F8\u5173\u6587\u7AE0";
          if (vocabContent.includes(articleLink)) {
            continue;
          }
          let updatedVocab = vocabContent;
          if (vocabContent.includes(sectionHeader)) {
            updatedVocab = vocabContent.replace(
              new RegExp(`(${escapeRegExp(sectionHeader)}[\\s\\S]*?)(\\n## |$)`, "m"),
              (_match, section, next) => {
                return section.trimEnd() + `
- ${articleLink}
` + next;
              }
            );
          } else {
            updatedVocab = vocabContent.trimEnd() + `

${sectionHeader}
- ${articleLink}
`;
          }
          await adapter.write(vocabPath, updatedVocab);
          reverseLinksCreated++;
        } catch (_e) {
        }
      }
      new import_obsidian.Notice(
        `\u5DF2\u5728\u6587\u7AE0\u4E2D\u521B\u5EFA ${totalLinksCreated} \u4E2A\u6B63\u5411\u94FE\u63A5\uFF0C\u5728\u751F\u8BCD\u672C\u4E2D\u521B\u5EFA ${reverseLinksCreated} \u4E2A\u53CD\u5411\u94FE\u63A5`
      );
    } catch (error) {
      console.error("English Study Club: Error creating bidirectional links", error);
      new import_obsidian.Notice("\u5EFA\u7ACB\u53CC\u5411\u94FE\u63A5\u5931\u8D25\uFF0C\u8BF7\u67E5\u770B\u63A7\u5236\u53F0\u83B7\u53D6\u8BE6\u7EC6\u4FE1\u606F\u3002");
    }
  }
  // ============================================================
  // 数据对齐：按统一 Schema 导入 / 导出
  // （Schema 见仓库 plugins/DATA_SCHEMA.md）
  // ============================================================
  // 安全文件名
  safeName(s) {
    return (s || "untitled").replace(/[\\/:*?"<>|#^[\]]/g, "_").replace(/\s+/g, "_").slice(0, 80);
  }
  // 导入统一 JSON，写入 vault 的 history/ vocab/ browser-captures/
  async importEscJson(text) {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object") {
      throw new Error("JSON \u683C\u5F0F\u4E0D\u6B63\u786E");
    }
    const adapter = this.app.vault.adapter;
    let added = 0;
    if (Array.isArray(parsed.captures)) {
      for (const c of parsed.captures) {
        if (!c || !c.id) continue;
        const fname = "cap_" + this.safeName(c.id);
        const path = "browser-captures/" + fname + ".md";
        if (await adapter.exists(path)) continue;
        const fm = [
          "---",
          "source: " + (c.source || "selection"),
          c.url ? "url: " + c.url : "",
          "createdAt: " + (c.createdAt || ""),
          "tags: [" + (Array.isArray(c.tags) ? c.tags.join(", ") : c.tags || "") + "]",
          "author: " + (c.author || ""),
          c.note ? "note: " + String(c.note).replace(/\n+/g, " ") : 'note: ""',
          "---",
          "",
          "# " + (c.title || "\u7F51\u9875\u91C7\u96C6"),
          "",
          "> " + String(c.text || "").replace(/\n+/g, "\n> ")
        ].filter((l) => l !== "").join("\n");
        await adapter.write(path, fm);
        added++;
      }
    }
    if (Array.isArray(parsed.articles)) {
      for (const a of parsed.articles) {
        if (!a || !a.id) continue;
        const fname = this.safeName(a.id);
        const path = "history/" + fname + ".md";
        if (await adapter.exists(path)) continue;
        const fm = [
          "---",
          "title: " + (a.title || "\u672A\u547D\u540D\u6587\u7AE0"),
          "source: " + (a.source || "web"),
          a.lang ? "lang: " + a.lang : "",
          "createdAt: " + (a.createdAt || ""),
          "tags: [" + (Array.isArray(a.tags) ? a.tags.join(", ") : a.tags || "") + "]",
          "author: " + (a.author || ""),
          "---",
          "",
          String(a.content || "")
        ].filter((l) => l !== "").join("\n");
        await adapter.write(path, fm);
        added++;
      }
    }
    if (Array.isArray(parsed.vocab)) {
      const byNotebook = {};
      for (const v of parsed.vocab) {
        if (!v || !v.word) continue;
        const nb = this.safeName(v.notebook || "default");
        (byNotebook[nb] = byNotebook[nb] || []).push(v);
      }
      for (const nb of Object.keys(byNotebook)) {
        const path = "vocab/" + nb + ".md";
        let existing = [];
        let header = "# " + nb + "\n\n| Word | Phonetic | Definition | Example |\n| --- | --- | --- | --- |";
        if (await adapter.exists(path)) {
          const content = await adapter.read(path);
          existing = content.split("\n").filter((l) => l.trim().startsWith("|")).map((l) => l.split("|")[1]?.trim().toLowerCase()).filter(Boolean);
          header = content.trim();
        }
        const rows = [];
        for (const v of byNotebook[nb]) {
          const w = String(v.word).toLowerCase();
          if (existing.includes(w)) continue;
          existing.push(w);
          rows.push(
            "| " + [v.word, v.phonetic || "", v.definition || "", v.example || ""].map((x) => String(x).replace(/\|/g, "\\|").replace(/\n/g, " ")).join(" | ") + " |"
          );
          added++;
        }
        if (rows.length > 0) {
          await adapter.write(path, header + "\n" + rows.join("\n") + "\n");
        }
      }
    }
    const leaves = this.app.workspace.getLeavesOfType(DASHBOARD_VIEW_TYPE);
    for (const leaf of leaves) {
      const view = leaf.view;
      if (view) view.refresh();
    }
    return added;
  }
  // 从「本地文件夹」同步：浏览器插件 / 网页端选定文件夹后写出的
  // articles.json / vocab.json / captures.json（兼容 browser-extension/ 子目录与根目录）。
  // 与 importEscJson 共用同一套导入逻辑（writeFolder 写出的顶层结构即 {articles,vocab,captures}）。
  async syncFromFolder() {
    const rel = this.settings.syncFolder.trim();
    if (!rel) {
      new import_obsidian.Notice(
        "\u672A\u8BBE\u7F6E\u300C\u672C\u5730\u6587\u4EF6\u5939\u540C\u6B65\u8DEF\u5F84\u300D\u3002\u8BF7\u5148\u5728\u8BBE\u7F6E\u4E2D\u586B\u5199\u6D4F\u89C8\u5668\u63D2\u4EF6 / \u7F51\u9875\u7AEF\u6240\u9009\u6587\u4EF6\u5939\u5728 vault \u5185\u7684\u76F8\u5BF9\u8DEF\u5F84\u3002"
      );
      return 0;
    }
    const adapter = this.app.vault.adapter;
    const candidates = [rel, rel.replace(/\/+$/, "") + "/browser-extension"];
    let baseDir = "";
    for (const c of candidates) {
      if (await adapter.exists(c) && (await adapter.list(c)).files.some((f) => f.endsWith(".json"))) {
        baseDir = c;
        break;
      }
    }
    if (!baseDir) {
      new import_obsidian.Notice(
        `\u5728 vault \u5185\u672A\u627E\u5230\u6587\u4EF6\u5939\u300C${rel}\u300D\u6216\u5176 browser-extension/ \u5B50\u76EE\u5F55\u4E0B\u7684 JSON \u6587\u4EF6\u3002\u8BF7\u786E\u8BA4\u6D4F\u89C8\u5668\u63D2\u4EF6 / \u7F51\u9875\u7AEF\u7684\u672C\u5730\u6587\u4EF6\u5939\u5C31\u5728\u8BE5\u8DEF\u5F84\u5185\u3002`
      );
      return 0;
    }
    const store = { schemaVersion: 1, exportedAt: (/* @__PURE__ */ new Date()).toISOString(), articles: [], vocab: [], captures: [] };
    const keyOf = (name) => name.startsWith("article") ? "articles" : name.startsWith("vocab") ? "vocab" : name.startsWith("capture") ? "captures" : null;
    const readJson = async (name) => {
      const key = keyOf(name);
      if (!key) return null;
      const dirs = [baseDir, baseDir.replace(/\/?browser-extension$/, "")].filter(Boolean);
      for (const dir of dirs) {
        const p = (dir.replace(/\/+$/, "") + "/" + name).replace(/^\/+/, "");
        try {
          if (await adapter.exists(p)) {
            const obj = JSON.parse(await adapter.read(p));
            if (Array.isArray(obj)) return obj;
            if (obj && Array.isArray(obj[key])) return obj[key];
          }
        } catch (e) {
        }
      }
      return null;
    };
    const arts = await readJson("articles.json");
    const vocs = await readJson("vocab.json");
    const caps = await readJson("captures.json");
    if (arts) store.articles = arts;
    if (vocs) store.vocab = vocs;
    if (caps) store.captures = caps;
    if (!store.articles.length && !store.vocab.length && !store.captures.length) {
      new import_obsidian.Notice(`\u300C${baseDir}\u300D\u4E2D\u672A\u8BFB\u53D6\u5230\u6709\u6548\u7684 articles/vocab/captures \u6570\u636E\u3002`);
      return 0;
    }
    const added = await this.importEscJson(JSON.stringify(store));
    new import_obsidian.Notice(`\u5DF2\u4ECE\u300C${baseDir}\u300D\u540C\u6B65\u5BFC\u5165 ${added} \u6761\u65B0\u6570\u636E\u5230 vault\u3002`);
    return added;
  }
  // 导出 vault 的 history/ vocab/ browser-captures/ 为统一 JSON
  async exportEscJson() {
    const adapter = this.app.vault.adapter;
    const store = {
      schemaVersion: 1,
      exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
      articles: [],
      vocab: [],
      captures: []
    };
    if (await adapter.exists("browser-captures")) {
      const files = await adapter.list("browser-captures");
      for (const fp of files.files.filter((f) => f.endsWith(".md"))) {
        const c = await adapter.read(fp);
        const m = c.match(/^---\n([\s\S]*?)\n---/);
        const fm = {};
        if (m) {
          m[1].split("\n").forEach((line) => {
            const idx = line.indexOf(":");
            if (idx > 0) fm[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
          });
        }
        const body = c.replace(/^---\n[\s\S]*?\n---\n/, "").replace(/^> /gm, "").trim();
        store.captures.push({
          id: fp.replace("browser-captures/", "").replace(".md", ""),
          title: (c.match(/^#\s+(.+)$/m) || [])[1] || "\u7F51\u9875\u91C7\u96C6",
          text: body,
          url: fm.url || "",
          source: fm.source || "selection",
          createdAt: fm.createdAt || "",
          note: fm.note || "",
          tags: parseFrontmatterList(fm.tags),
          author: fm.author || ""
        });
      }
    }
    if (await adapter.exists("history")) {
      const files = await adapter.list("history");
      for (const fp of files.files.filter((f) => f.endsWith(".md"))) {
        const c = await adapter.read(fp);
        const m = c.match(/^---\n([\s\S]*?)\n---/);
        const fm = {};
        if (m) {
          m[1].split("\n").forEach((line) => {
            const idx = line.indexOf(":");
            if (idx > 0) fm[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
          });
        }
        store.articles.push({
          id: fp.replace("history/", "").replace(".md", ""),
          title: fm.title || (c.match(/^#\s+(.+)$/m) || [])[1] || "\u672A\u547D\u540D\u6587\u7AE0",
          source: fm.source || "web",
          content: c.replace(/^---\n[\s\S]*?\n---\n/, "").trim(),
          lang: fm.lang || "",
          createdAt: fm.createdAt || "",
          tags: parseFrontmatterList(fm.tags),
          author: fm.author || ""
        });
      }
    }
    if (await adapter.exists("vocab")) {
      const files = await adapter.list("vocab");
      for (const fp of files.files.filter((f) => f.endsWith(".md"))) {
        const c = await adapter.read(fp);
        const nb = fp.replace("vocab/", "").replace(".md", "");
        c.split("\n").forEach((line) => {
          const t = line.trim();
          if (t.startsWith("|") && !t.includes("---") && !t.includes("Word") && !t.includes("\u5355\u8BCD")) {
            const cells = t.split("|").slice(1, -1).map((x) => x.trim());
            if (cells.length >= 1 && cells[0]) {
              store.vocab.push({
                word: cells[0],
                phonetic: cells[1] || "",
                definition: cells[2] || "",
                example: cells[3] || "",
                notebook: nb,
                createdAt: ""
              });
            }
          }
        });
      }
    }
    return JSON.stringify(store, null, 2);
  }
  // 新建一条网页采集（capture），带 note / tags / author 规范化 frontmatter
  async newCapture(data) {
    const adapter = this.app.vault.adapter;
    const ts = /* @__PURE__ */ new Date();
    const id = "cap_" + ts.getTime();
    const path = "browser-captures/" + id + ".md";
    const fm = [
      "---",
      "source: capture",
      data.url ? "url: " + data.url : "",
      "createdAt: " + ts.toISOString(),
      "tags: [" + (data.tags || []).join(", ") + "]",
      "author: " + (data.author || ""),
      "note: " + JSON.stringify(data.note || ""),
      "---",
      "",
      "# " + (data.title || "\u7F51\u9875\u91C7\u96C6"),
      "",
      "> " + String(data.text || "").replace(/\n+/g, "\n> ")
    ].filter((l) => l !== "").join("\n");
    await adapter.write(path, fm);
    const leaves = this.app.workspace.getLeavesOfType(DASHBOARD_VIEW_TYPE);
    for (const leaf of leaves) {
      const view = leaf.view;
      if (view) view.refresh();
    }
    return path;
  }
  // 复习今日卡片（FSRS-lite）：扫描今日 capture / article / {{c1::}} 填空卡，
  // 生成一张复习页，打开并定位。
  async reviewTodayCards() {
    const adapter = this.app.vault.adapter;
    const today = todayStr();
    const cards = [];
    if (await adapter.exists("browser-captures")) {
      const files = await adapter.list("browser-captures");
      for (const fp of files.files.filter((f) => f.endsWith(".md"))) {
        const c = await adapter.read(fp);
        const m = c.match(/^---\n([\s\S]*?)\n---/);
        const fm = {};
        if (m) {
          m[1].split("\n").forEach((line) => {
            const idx = line.indexOf(":");
            if (idx > 0) fm[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
          });
        }
        if (!fm.createdAt || !fm.createdAt.startsWith(today)) continue;
        const body = c.replace(/^---\n[\s\S]*?\n---\n/, "").replace(/^> /gm, "").trim();
        if (!body) continue;
        const note = fm.note ? String(fm.note).replace(/^"|"$/g, "") : "";
        cards.push({
          type: "\u91C7\u96C6",
          q: (note || body.split("\n")[0] || "\u7F51\u9875\u91C7\u96C6").slice(0, 80),
          a: body,
          hint: note ? "note: " + note : "",
          src: fp
        });
      }
    }
    if (await adapter.exists("history")) {
      const files = await adapter.list("history");
      for (const fp of files.files.filter((f) => f.endsWith(".md"))) {
        const c = await adapter.read(fp);
        const m = c.match(/^---\n([\s\S]*?)\n---/);
        const fm = {};
        if (m) {
          m[1].split("\n").forEach((line) => {
            const idx = line.indexOf(":");
            if (idx > 0) fm[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
          });
        }
        if (!fm.createdAt || !fm.createdAt.startsWith(today)) continue;
        const content = c.replace(/^---\n[\s\S]*?\n---\n/, "");
        const clozes = parseCloze(content);
        for (const cz of clozes) {
          const qText = content.replace(/\{\{c\d+::([\s\S]*?)(?:::([\s\S]*?))?\}\}/g, "___").split("\n").filter((l) => l.includes("___")).join("\n").trim().slice(0, 200);
          cards.push({
            type: "\u586B\u7A7A",
            q: qText || cz.hint || "\u586B\u7A7A\u7EC3\u4E60",
            a: cz.answer,
            hint: cz.hint,
            src: fp
          });
        }
      }
    }
    if (cards.length === 0) {
      new import_obsidian.Notice("\u4ECA\u5929\u8FD8\u6CA1\u6709\u65B0\u5361\u7247\uFF08\u91C7\u96C6/\u6587\u7AE0/\u586B\u7A7A\uFF09\u3002");
      return;
    }
    const lines = [
      "---",
      "date: " + today,
      "type: fsrs-lite-review",
      "due: " + today,
      "reps: 0",
      "ease: " + FSRS_DEFAULT_EASE,
      "lapses: 0",
      "count: " + cards.length,
      "---",
      "",
      "# \u590D\u4E60 \xB7 " + today,
      "",
      "> \u5171 " + cards.length + " \u5F20\u5361\u7247\u3002\u5C55\u5F00\u7B54\u6848\u540E\u81EA\u8BC4\uFF1AAgain / Good / Easy\u3002",
      ""
    ];
    cards.forEach((card, i) => {
      lines.push("## " + (i + 1) + ". [" + card.type + "] " + (card.hint || card.q).slice(0, 60));
      lines.push("**\u6765\u6E90**: " + card.src);
      lines.push("");
      lines.push("> [!question]" + (card.q ? " " + card.q : ""));
      lines.push("");
      lines.push("> [!answer]");
      lines.push("> " + card.a.replace(/\n/g, "\n> "));
      lines.push("");
    });
    const reviewPath = "\u590D\u4E60-" + today + ".md";
    await adapter.write(reviewPath, lines.join("\n"));
    const file = this.app.vault.getAbstractFileByPath(reviewPath);
    if (file) await this.app.workspace.getLeaf(false).openFile(file);
    new import_obsidian.Notice("\u5DF2\u751F\u6210\u4ECA\u65E5\u590D\u4E60\u5361 " + cards.length + " \u5F20\uFF1A" + reviewPath);
  }
};
function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function parseFrontmatterList(raw) {
  if (!raw) return [];
  let s = String(raw).trim();
  if (s.startsWith("[") && s.endsWith("]")) s = s.slice(1, -1);
  if (!s.trim()) return [];
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}
function todayStr(d = /* @__PURE__ */ new Date()) {
  const p = (n) => n < 10 ? "0" + n : "" + n;
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
}
function parseCloze(text) {
  const cards = [];
  const re = /\{\{c\d+::([\s\S]*?)(?:::([\s\S]*?))?\}\}/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    cards.push({ answer: m[1].trim(), hint: (m[2] || "").trim() });
  }
  return cards;
}
var FSRS_DEFAULT_EASE = 2.5;
var ImportEscModal = class extends import_obsidian.Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.style.width = "var(--modal-width, 600px)";
    contentEl.createEl("h3", { text: "\u5BFC\u5165 English Study Club JSON" });
    contentEl.createEl("p", {
      text: "\u5C06\u6D4F\u89C8\u5668\u63D2\u4EF6\u300C\u5BFC\u51FA JSON\u300D\u5F97\u5230\u7684\u6587\u4EF6\u5185\u5BB9\u7C98\u8D34\u5230\u4E0B\u65B9\uFF0C\u70B9\u51FB\u5BFC\u5165\u540E\u4F1A\u5199\u5165\u672C vault \u7684 history/\u3001vocab/\u3001browser-captures/ \u76EE\u5F55\u3002",
      cls: "setting-item-description"
    });
    this.textarea = contentEl.createEl("textarea");
    this.textarea.placeholder = "\u5728\u6B64\u7C98\u8D34 JSON\u2026";
    this.textarea.style.width = "100%";
    this.textarea.style.height = "260px";
    this.textarea.style.fontFamily = "monospace";
    this.textarea.style.fontSize = "12px";
    this.textarea.style.marginTop = "12px";
    this.statusEl = contentEl.createEl("p", { cls: "setting-item-description" });
    this.statusEl.style.marginTop = "8px";
    const btnRow = contentEl.createDiv();
    btnRow.style.display = "flex";
    btnRow.style.gap = "8px";
    btnRow.style.marginTop = "12px";
    btnRow.style.justifyContent = "flex-end";
    const cancelBtn = btnRow.createEl("button", { text: "\u53D6\u6D88" });
    cancelBtn.addEventListener("click", () => this.close());
    const importBtn = btnRow.createEl("button", { text: "\u5BFC\u5165" });
    importBtn.addClass("mod-cta");
    importBtn.addEventListener("click", async () => {
      const text = this.textarea.value.trim();
      if (!text) {
        this.statusEl.textContent = "\u8BF7\u5148\u7C98\u8D34 JSON \u5185\u5BB9";
        return;
      }
      importBtn.setAttribute("disabled", "true");
      try {
        const added = await this.plugin.importEscJson(text);
        this.statusEl.textContent = "\u5BFC\u5165\u6210\u529F\uFF0C\u65B0\u589E " + added + " \u6761\u3002";
        new import_obsidian.Notice("\u5BFC\u5165\u6210\u529F\uFF0C\u65B0\u589E " + added + " \u6761");
        setTimeout(() => this.close(), 800);
      } catch (e) {
        this.statusEl.textContent = "\u5BFC\u5165\u5931\u8D25: " + (e.message || e);
        new import_obsidian.Notice("\u5BFC\u5165\u5931\u8D25: " + (e.message || e));
        importBtn.removeAttribute("disabled");
      }
    });
  }
  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
};
var NewCaptureModal = class extends import_obsidian.Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.style.width = "var(--modal-width, 600px)";
    contentEl.createEl("h3", { text: "\u65B0\u5EFA\u7F51\u9875\u91C7\u96C6" });
    contentEl.createEl("p", {
      text: "\u4FDD\u5B58\u4E00\u6BB5\u6587\u672C\u5230 browser-captures/\uFF0C\u53EF\u9644\u52A0 note \u6807\u6CE8\u3001\u6807\u7B7E\u4E0E\u4F5C\u8005\u3002",
      cls: "setting-item-description"
    });
    const field = (label, el) => {
      const wrap = contentEl.createDiv();
      wrap.style.marginTop = "10px";
      wrap.createEl("label", { text: label, cls: "setting-item-name" }).style.display = "block";
      wrap.appendChild(el);
      return wrap;
    };
    this.titleEl = contentEl.createEl("input");
    this.titleEl.placeholder = "\u6807\u9898\uFF08\u53EF\u9009\uFF09";
    this.titleEl.style.width = "100%";
    field("\u6807\u9898", this.titleEl);
    this.urlEl = contentEl.createEl("input");
    this.urlEl.placeholder = "\u6765\u6E90\u7F51\u5740\uFF08\u53EF\u9009\uFF09";
    this.urlEl.style.width = "100%";
    field("\u6765\u6E90 URL", this.urlEl);
    this.textEl = contentEl.createEl("textarea");
    this.textEl.placeholder = "\u7C98\u8D34\u8981\u4FDD\u5B58\u7684\u6587\u672C\u2026";
    this.textEl.style.width = "100%";
    this.textEl.style.height = "140px";
    this.textEl.style.fontSize = "13px";
    field("\u6587\u672C\uFF08\u5FC5\u586B\uFF09", this.textEl);
    this.noteEl = contentEl.createEl("textarea");
    this.noteEl.placeholder = "\u7B14\u8BB0 / \u6807\u6CE8\uFF08\u53EF\u9009\uFF0C\u4F8B\u5982\uFF1A\u8FD9\u53E5\u8BDD\u7684\u8BED\u6CD5\u70B9\u3001\u4E2A\u4EBA\u7406\u89E3\uFF09";
    this.noteEl.style.width = "100%";
    this.noteEl.style.height = "70px";
    this.noteEl.style.fontSize = "13px";
    field("note \u6807\u6CE8", this.noteEl);
    this.tagsEl = contentEl.createEl("input");
    this.tagsEl.placeholder = "\u6807\u7B7E\uFF0C\u9017\u53F7\u5206\u9694\uFF0C\u5982\uFF1A\u8BED\u6CD5, \u96C5\u601D";
    this.tagsEl.style.width = "100%";
    field("tags", this.tagsEl);
    this.authorEl = contentEl.createEl("input");
    this.authorEl.placeholder = "\u4F5C\u8005\uFF08\u53EF\u9009\uFF09";
    this.authorEl.style.width = "100%";
    field("author", this.authorEl);
    this.statusEl = contentEl.createEl("p", { cls: "setting-item-description" });
    this.statusEl.style.marginTop = "8px";
    const btnRow = contentEl.createDiv();
    btnRow.style.display = "flex";
    btnRow.style.gap = "8px";
    btnRow.style.marginTop = "14px";
    btnRow.style.justifyContent = "flex-end";
    const cancelBtn = btnRow.createEl("button", { text: "\u53D6\u6D88" });
    cancelBtn.addEventListener("click", () => this.close());
    const saveBtn = btnRow.createEl("button", { text: "\u4FDD\u5B58\u91C7\u96C6" });
    saveBtn.addClass("mod-cta");
    saveBtn.addEventListener("click", async () => {
      const text = this.textEl.value.trim();
      if (!text) {
        this.statusEl.textContent = "\u8BF7\u5148\u586B\u5199\u6587\u672C";
        return;
      }
      saveBtn.setAttribute("disabled", "true");
      try {
        const tags = this.tagsEl.value.split(",").map((t) => t.trim()).filter(Boolean);
        const path = await this.plugin.newCapture({
          title: this.titleEl.value.trim() || void 0,
          text,
          url: this.urlEl.value.trim() || void 0,
          note: this.noteEl.value.trim() || void 0,
          tags,
          author: this.authorEl.value.trim() || void 0
        });
        new import_obsidian.Notice("\u5DF2\u4FDD\u5B58\u91C7\u96C6\uFF1A" + path);
        this.close();
      } catch (e) {
        this.statusEl.textContent = "\u4FDD\u5B58\u5931\u8D25: " + (e.message || e);
        saveBtn.removeAttribute("disabled");
      }
    });
  }
  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
};
