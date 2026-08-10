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
  default: () => EnglishReadingLabPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var DASHBOARD_VIEW_TYPE = "english-lab-dashboard";
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
  showCaptures: true
};
var EnglishReadingLabSettingTab = class extends import_obsidian.PluginSettingTab {
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
  }
};
var EnglishReadingLabPlugin = class extends import_obsidian.Plugin {
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
    this.addSettingTab(new EnglishReadingLabSettingTab(this.app, this));
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
};
function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
