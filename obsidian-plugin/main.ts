import { Plugin, ItemView, WorkspaceLeaf, Notice, PluginSettingTab, Setting, TFile, TFolder, Modal, TextComponent } from "obsidian";
import { App } from "obsidian";

// ============================================================
// Dashboard View
// ============================================================
const DASHBOARD_VIEW_TYPE = "english-study-club-dashboard";

interface DashboardStats {
	totalArticles: number;
	totalVocabWords: number;
	totalCaptures: number;
	recentActivity: { date: string; count: number }[];
	recentCaptures: { name: string; path: string }[];
}

class DashboardView extends ItemView {
	plugin: EnglishStudyClubPlugin;

	constructor(leaf: WorkspaceLeaf, plugin: EnglishStudyClubPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return DASHBOARD_VIEW_TYPE;
	}

	getDisplayText(): string {
		return "英研社仪表盘";
	}

	getIcon(): string {
		return "book-open";
	}

	async onOpen(): Promise<void> {
		await this.refresh();
	}

	async refresh(): Promise<void> {
		const container = this.containerEl.children[1];
		container.empty();
		container.addClass("erl-dashboard");

		const stats = await this.plugin.collectDashboardStats();

		// Header
		const header = container.createEl("div", { cls: "erl-dashboard-header" });
		header.createEl("h2", { text: "英研社" });

		// Check if any data exists
		if (stats.totalArticles === 0 && stats.totalCaptures === 0) {
			const emptyState = container.createEl("div", { cls: "erl-empty-state" });
			emptyState.createEl("p", { text: "暂无学习数据\n请先在英研社中分析文章" });
			return;
		}

		// Stats cards row
		const statsRow = container.createEl("div", { cls: "erl-stats-row" });

		if (this.plugin.settings.showArticles) {
			const card1 = statsRow.createEl("div", { cls: "erl-stat-card" });
			card1.createEl("div", { cls: "erl-stat-value", text: String(stats.totalArticles) });
			card1.createEl("div", { cls: "erl-stat-label", text: "已分析文章" });
		}

		if (this.plugin.settings.showVocabulary) {
			const card2 = statsRow.createEl("div", { cls: "erl-stat-card" });
			card2.createEl("div", { cls: "erl-stat-value", text: String(stats.totalVocabWords) });
			card2.createEl("div", { cls: "erl-stat-label", text: "生词数量" });
		}

		if (this.plugin.settings.showCaptures) {
			const card3 = statsRow.createEl("div", { cls: "erl-stat-card" });
			card3.createEl("div", { cls: "erl-stat-value", text: String(stats.totalCaptures) });
			card3.createEl("div", { cls: "erl-stat-label", text: "采集内容" });
		}

		// Recent 7-day activity
		if (stats.recentActivity.length > 0) {
			const activitySection = container.createEl("div", { cls: "erl-section" });
			activitySection.createEl("h3", { text: "最近 7 天活动" });
			const activityList = activitySection.createEl("div", { cls: "erl-activity-list" });
			for (const item of stats.recentActivity) {
				const row = activityList.createEl("div", { cls: "erl-activity-item" });
				row.createEl("span", { cls: "erl-activity-date", text: item.date });
				row.createEl("span", { cls: "erl-activity-count", text: String(item.count) + " 个文件" });
			}
		}

		// Recent captures
		if (stats.recentCaptures.length > 0) {
			const capturesSection = container.createEl("div", { cls: "erl-section" });
			capturesSection.createEl("h3", { text: "最近采集" });
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
}

// ============================================================
// Settings
// ============================================================
interface EnglishStudyClubSettings {
	reviewIntervalDays: number;
	showArticles: boolean;
	showVocabulary: boolean;
	showCaptures: boolean;
}

const DEFAULT_SETTINGS: EnglishStudyClubSettings = {
	reviewIntervalDays: 7,
	showArticles: true,
	showVocabulary: true,
	showCaptures: true,
};

class EnglishStudyClubSettingTab extends PluginSettingTab {
	plugin: EnglishStudyClubPlugin;

	constructor(app: App, plugin: EnglishStudyClubPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "英研社设置" });

		new Setting(containerEl)
			.setName("复习间隔（天）")
			.setDesc("超过该天数未修改的文章将出现在复习计划中")
			.addText((text) =>
				text
					.setValue(String(this.plugin.settings.reviewIntervalDays))
					.onChange(async (value) => {
						const num = parseInt(value, 10);
						if (!isNaN(num) && num > 0) {
							this.plugin.settings.reviewIntervalDays = num;
							await this.plugin.saveSettings();
						}
					})
			);

		containerEl.createEl("h3", { text: "仪表盘显示选项" });

		new Setting(containerEl)
			.setName("显示文章数")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showArticles)
					.onChange(async (value) => {
						this.plugin.settings.showArticles = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("显示生词数")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showVocabulary)
					.onChange(async (value) => {
						this.plugin.settings.showVocabulary = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("显示采集数")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showCaptures)
					.onChange(async (value) => {
						this.plugin.settings.showCaptures = value;
						await this.plugin.saveSettings();
					})
			);
	}
}

// ============================================================
// Main Plugin
// ============================================================
export default class EnglishStudyClubPlugin extends Plugin {
	settings: EnglishStudyClubSettings;

	async onload(): Promise<void> {
		await this.loadSettings();

		// Register dashboard view
		this.registerView(
			DASHBOARD_VIEW_TYPE,
			(leaf: WorkspaceLeaf) => new DashboardView(leaf, this)
		);

		// Ribbon icon
		this.addRibbonIcon("book-open", "英研社仪表盘", () => {
			this.activateDashboard();
		});

		// Command: open dashboard
		this.addCommand({
			id: "open-dashboard",
			name: "打开学习仪表盘",
			callback: () => this.activateDashboard(),
		});

		// Command: generate review plan
		this.addCommand({
			id: "generate-review-plan",
			name: "生成复习计划",
			callback: () => this.generateReviewPlan(),
		});

		// Command: bidirectional linking
		this.addCommand({
			id: "create-bidirectional-links",
			name: "建立双向链接",
			callback: () => this.createBidirectionalLinks(),
		});

		// Command: 导入 English Study Club 统一 JSON（来自浏览器插件导出）
		this.addCommand({
			id: "import-esc-json",
			name: "导入 English Study Club JSON",
			callback: () => {
				new ImportEscModal(this.app, this).open();
			},
		});

		// Command: 导出当前 vault 学习数据为统一 JSON
		this.addCommand({
			id: "export-esc-json",
			name: "导出 English Study Club JSON",
			callback: async () => {
				try {
					const json = await this.exportEscJson();
					const path = "english-study-club-export.json";
					await this.app.vault.adapter.write(path, json);
					new Notice("已导出到 vault 根目录：" + path);
					try {
						await navigator.clipboard.writeText(json);
						new Notice("JSON 已同时复制到剪贴板");
					} catch (e) { /* 剪贴板不可用忽略 */ }
				} catch (e) {
					new Notice("导出失败: " + e.message);
				}
			},
		});

		// Command: 新建网页采集（支持 note 标注）
		this.addCommand({
			id: "new-capture",
			name: "新建网页采集（可加 note 标注）",
			callback: () => {
				new NewCaptureModal(this.app, this).open();
			},
		});

		// Command: 复习今日卡片（FSRS-lite，含 {{c1::}} 填空卡抽取）
		this.addCommand({
			id: "review-today-cards",
			name: "复习今日卡片",
			callback: () => this.reviewTodayCards(),
		});

		// Settings tab
		this.addSettingTab(new EnglishStudyClubSettingTab(this.app, this));

		// If workspace layout is ready, register the view
		if (this.app.workspace.layoutReady) {
			this.initDashboard();
		} else {
			this.registerEvent(
				this.app.workspace.on("layout-change", () => this.initDashboard())
			);
		}
	}

	async initDashboard(): Promise<void> {
		// We don't auto-open the dashboard; user opens via ribbon or command
	}

	async activateDashboard(): Promise<void> {
		const { workspace } = this.app;

		// Check if view already exists
		const existing = workspace.getLeavesOfType(DASHBOARD_VIEW_TYPE);
		if (existing.length > 0) {
			workspace.revealLeaf(existing[0]);
			return;
		}

		// Create new leaf in right sidebar
		const leaf = workspace.getRightLeaf(false);
		if (leaf) {
			await leaf.setViewState({ type: DASHBOARD_VIEW_TYPE, active: true });
			workspace.revealLeaf(leaf);
		}
	}

	async onunload(): Promise<void> {
		// Cleanup when plugin is disabled
		this.app.workspace.detachLeavesOfType(DASHBOARD_VIEW_TYPE);
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		// Refresh dashboard if open
		const leaves = this.app.workspace.getLeavesOfType(DASHBOARD_VIEW_TYPE);
		for (const leaf of leaves) {
			const view = leaf.view as DashboardView;
			if (view) {
				view.refresh();
			}
		}
	}

	// ============================================================
	// Dashboard Data Collection
	// ============================================================
	async collectDashboardStats(): Promise<DashboardStats> {
		const stats: DashboardStats = {
			totalArticles: 0,
			totalVocabWords: 0,
			totalCaptures: 0,
			recentActivity: [],
			recentCaptures: [],
		};

		try {
			const adapter = this.app.vault.adapter;

			// Count articles in history/
			if (await adapter.exists("history")) {
				const historyFiles = await adapter.list("history");
				stats.totalArticles = historyFiles.files.filter(
					(f: string) => f.endsWith(".md")
				).length;
			}

			// Count vocabulary words in vocab/
			if (await adapter.exists("vocab")) {
				const vocabFiles = await adapter.list("vocab");
				const vocabMdFiles = vocabFiles.files.filter(
					(f: string) => f.endsWith(".md")
				);
				for (const filePath of vocabMdFiles) {
					try {
						const content = await adapter.read(filePath);
						// Count table rows: lines starting with | that are not header/separator
						const lines = content.split("\n");
						let wordCount = 0;
						for (const line of lines) {
							const trimmed = line.trim();
							if (
								trimmed.startsWith("|") &&
								trimmed.endsWith("|") &&
								!trimmed.includes("---") &&
								!trimmed.includes("Word") &&
								!trimmed.includes("单词") &&
								trimmed.split("|").length >= 3
							) {
								wordCount++;
							}
						}
						stats.totalVocabWords += wordCount;
					} catch (_e) {
						// Skip files that can't be read
					}
				}
			}

			// Count captures in browser-captures/
			if (await adapter.exists("browser-captures")) {
				const captureFiles = await adapter.list("browser-captures");
				const captureMdFiles = captureFiles.files.filter(
					(f: string) => f.endsWith(".md")
				);
				stats.totalCaptures = captureMdFiles.length;

				// Recent captures (last 5, sorted by mtime)
				const captureWithTimes: { name: string; path: string; mtime: number }[] = [];
				for (const filePath of captureMdFiles) {
					try {
						const stat = await adapter.stat(filePath);
						if (stat) {
							captureWithTimes.push({
								name: filePath.replace("browser-captures/", "").replace(".md", ""),
								path: filePath,
								mtime: stat.mtime,
							});
						}
					} catch (_e) {
						// Skip
					}
				}
				captureWithTimes.sort((a, b) => b.mtime - a.mtime);
				stats.recentCaptures = captureWithTimes.slice(0, 5);
			}

			// Recent 7-day activity
			const now = Date.now();
			const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
			const activityMap = new Map<string, number>();

			const allDirs = ["history", "vocab", "browser-captures"];
			for (const dir of allDirs) {
				if (await adapter.exists(dir)) {
					const dirFiles = await adapter.list(dir);
					const mdFiles = dirFiles.files.filter((f: string) => f.endsWith(".md"));
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
							// Skip
						}
					}
				}
			}

			stats.recentActivity = Array.from(activityMap.entries())
				.map(([date, count]) => ({ date, count }))
				.sort((a, b) => a.date.localeCompare(b.date));

		} catch (error) {
			console.error("English Study Club: Error collecting dashboard stats", error);
		}

		return stats;
	}

	// ============================================================
	// Review Plan Generation
	// ============================================================
	async generateReviewPlan(): Promise<void> {
		try {
			const adapter = this.app.vault.adapter;
			const intervalMs = this.settings.reviewIntervalDays * 24 * 60 * 60 * 1000;
			const now = Date.now();
			const threshold = now - intervalMs;

			const historyItems: { name: string; path: string }[] = [];
			const vocabItems: { name: string; path: string }[] = [];

			// Scan history/ for old files
			if (await adapter.exists("history")) {
				const historyFiles = await adapter.list("history");
				const mdFiles = historyFiles.files.filter((f: string) => f.endsWith(".md"));
				for (const filePath of mdFiles) {
					try {
						const stat = await adapter.stat(filePath);
						if (stat && stat.mtime && stat.mtime < threshold) {
							historyItems.push({
								name: filePath.replace("history/", "").replace(".md", ""),
								path: filePath,
							});
						}
					} catch (_e) {
						// Skip
					}
				}
			}

			// Scan vocab/ for all files
			if (await adapter.exists("vocab")) {
				const vocabFiles = await adapter.list("vocab");
				const mdFiles = vocabFiles.files.filter((f: string) => f.endsWith(".md"));
				for (const filePath of mdFiles) {
					vocabItems.push({
						name: filePath.replace("vocab/", "").replace(".md", ""),
						path: filePath,
					});
				}
			}

			// Parse existing plan for completion rate
			let completionRate = 0;
			let totalItems = 0;
			let completedItems = 0;
			let existingContent = "";

			if (await adapter.exists("学习计划.md")) {
				try {
					existingContent = await adapter.read("学习计划.md");
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
						completionRate = Math.round((completedItems / totalItems) * 100);
					}
				} catch (_e) {
					// Skip parsing errors
				}
			}

			// Build the plan content
			const today = new Date().toISOString().split("T")[0];
			let planContent = "# 学习计划\n\n";
			planContent += `生成时间: ${today}\n\n`;

			if (totalItems > 0) {
				planContent += `完成率: ${completionRate}%（${completedItems}/${totalItems}）\n\n`;
			}

			// History articles section
			planContent += "## 待复习文章\n\n";
			if (historyItems.length > 0) {
				for (const item of historyItems) {
					planContent += `- [ ] [[${item.path}|${item.name}]]\n`;
				}
			} else {
				planContent += "暂无需要复习的文章。\n";
			}
			planContent += "\n";

			// Vocabulary section
			planContent += "## 待复习单词\n\n";
			if (vocabItems.length > 0) {
				for (const item of vocabItems) {
					planContent += `- [ ] [[${item.path}|${item.name}]]\n`;
				}
			} else {
				planContent += "未找到生词文件。\n";
			}

			// Write the plan
			await adapter.write("学习计划.md", planContent);

			new Notice(
				`复习计划已生成：${historyItems.length} 篇文章，${vocabItems.length} 个生词本文件`
			);

		} catch (error) {
			console.error("English Study Club: Error generating review plan", error);
			new Notice("生成复习计划失败，请查看控制台获取详细信息。");
		}
	}

	// ============================================================
	// Bidirectional Linking
	// ============================================================
	async createBidirectionalLinks(): Promise<void> {
		try {
			const activeFile = this.app.workspace.getActiveFile();
			if (!activeFile) {
				new Notice("未打开文件，请先打开文章文件");
				return;
			}

			const filePath = activeFile.path;

			// Check if the file is in history/ or browser-captures/
			if (!filePath.startsWith("history/") && !filePath.startsWith("browser-captures/")) {
				new Notice(
					"双向链接仅适用于 history/ 或 browser-captures/ 目录下的文件"
				);
				return;
			}

			const adapter = this.app.vault.adapter;
			const articleContent = await adapter.read(filePath);

			// Extract English words from the article content
			// Match words with 2+ letters (avoid single letters, punctuation)
			const wordRegex = /\b[a-zA-Z]{2,}\b/g;
			const words = articleContent.match(wordRegex) || [];
			const uniqueWords = [...new Set(words.map((w) => w.toLowerCase()))];

			// Scan all vocab files for matching words
			const vocabMatches = new Map<string, { vocabPath: string; words: string[] }>();

			if (await adapter.exists("vocab")) {
				const vocabFiles = await adapter.list("vocab");
				const vocabMdFiles = vocabFiles.files.filter((f: string) => f.endsWith(".md"));

				for (const vocabPath of vocabMdFiles) {
					try {
						const vocabContent = await adapter.read(vocabPath);
						const lowerVocab = vocabContent.toLowerCase();
						const matchedWords: string[] = [];

						for (const word of uniqueWords) {
							// Check if the word appears in the vocab file's table
							// Look for the word in table cells (between | |)
							if (lowerVocab.includes(word)) {
								matchedWords.push(word);
							}
						}

						if (matchedWords.length > 0) {
							vocabMatches.set(vocabPath, {
								vocabPath,
								words: matchedWords,
							});
						}
					} catch (_e) {
						// Skip
					}
				}
			}

			if (vocabMatches.size === 0) {
				new Notice("文章中未找到匹配的生词");
				return;
			}

			// Insert links in the article
			let modifiedContent = articleContent;
			let totalLinksCreated = 0;

			// For each matched word, find its first occurrence (case-insensitive)
			// and insert a wiki link after it
			for (const [, match] of vocabMatches) {
				for (const word of match.words) {
					const vocabName = match.vocabPath.replace("vocab/", "").replace(".md", "");
					const linkText = `[[${match.vocabPath}#${word}|${word}]]`;

					// Find the first occurrence of the word (as a whole word, case-insensitive)
					const wordPattern = new RegExp(`\\b(${escapeRegExp(word)})\\b`, "i");
					const execResult = wordPattern.exec(modifiedContent);

					if (execResult) {
						// Only insert link if word is not already inside a wiki link
						const beforeMatch = modifiedContent.substring(0, execResult.index);
						const afterMatch = modifiedContent.substring(execResult.index + execResult[0].length);

						// Check if word is already inside [[...]]
						const lastOpenBracket = beforeMatch.lastIndexOf("[[");
						const lastCloseBracket = beforeMatch.lastIndexOf("]]");

						if (lastOpenBracket <= lastCloseBracket) {
							// Not inside a wiki link, safe to insert
							modifiedContent = beforeMatch + execResult[0] + " " + linkText + afterMatch;
							// Adjust for the inserted text in subsequent regex searches
							wordPattern.lastIndex = execResult.index + execResult[0].length + linkText.length + 1;
							totalLinksCreated++;
						}
					}
				}
			}

			// Write the modified article content
			if (modifiedContent !== articleContent) {
				await adapter.write(filePath, modifiedContent);
			}

			// Add reverse links in vocab files
			let reverseLinksCreated = 0;
			const articleLink = `[[${filePath}]]`;
			const articleName = filePath.replace(/^(history|browser-captures)\//, "").replace(".md", "");

			for (const [vocabPath] of vocabMatches) {
				try {
					const vocabContent = await adapter.read(vocabPath);

					// Check if the reverse link already exists
					const sectionHeader = "## 相关文章";
					if (vocabContent.includes(articleLink)) {
						continue; // Link already exists
					}

					let updatedVocab = vocabContent;

					if (vocabContent.includes(sectionHeader)) {
						// Append to existing section
						updatedVocab = vocabContent.replace(
							new RegExp(`(${escapeRegExp(sectionHeader)}[\\s\\S]*?)(\\n## |$)`, "m"),
							(_match: string, section: string, next: string) => {
								return section.trimEnd() + `\n- ${articleLink}\n` + next;
							}
						);
					} else {
						// Add new section at the end
						updatedVocab = vocabContent.trimEnd() + `\n\n${sectionHeader}\n- ${articleLink}\n`;
					}

					await adapter.write(vocabPath, updatedVocab);
					reverseLinksCreated++;
				} catch (_e) {
					// Skip
				}
			}

			new Notice(
				`已在文章中创建 ${totalLinksCreated} 个正向链接，在生词本中创建 ${reverseLinksCreated} 个反向链接`
			);

		} catch (error) {
			console.error("English Study Club: Error creating bidirectional links", error);
			new Notice("建立双向链接失败，请查看控制台获取详细信息。");
		}
	}

	// ============================================================
	// 数据对齐：按统一 Schema 导入 / 导出
	// （Schema 见仓库 plugins/DATA_SCHEMA.md）
	// ============================================================

	// 安全文件名
	private safeName(s: string): string {
		return (s || "untitled")
			.replace(/[\\/:*?"<>|#^[\]]/g, "_")
			.replace(/\s+/g, "_")
			.slice(0, 80);
	}

	// 导入统一 JSON，写入 vault 的 history/ vocab/ browser-captures/
	async importEscJson(text: string): Promise<number> {
		const parsed = JSON.parse(text);
		if (!parsed || typeof parsed !== "object") {
			throw new Error("JSON 格式不正确");
		}
		const adapter = this.app.vault.adapter;
		let added = 0;

		// --- captures -> browser-captures/<id>.md ---
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
					"tags: [" + (Array.isArray(c.tags) ? c.tags.join(", ") : (c.tags || "")) + "]",
					"author: " + (c.author || ""),
					c.note ? "note: " + String(c.note).replace(/\n+/g, " ") : "note: \"\"",
					"---",
					"",
					"# " + (c.title || "网页采集"),
					"",
					"> " + String(c.text || "").replace(/\n+/g, "\n> "),
				].filter((l) => l !== "").join("\n");
				await adapter.write(path, fm);
				added++;
			}
		}

		// --- articles -> history/<id>.md ---
		if (Array.isArray(parsed.articles)) {
			for (const a of parsed.articles) {
				if (!a || !a.id) continue;
				const fname = this.safeName(a.id);
				const path = "history/" + fname + ".md";
				if (await adapter.exists(path)) continue;
				const fm = [
					"---",
					"title: " + (a.title || "未命名文章"),
					"source: " + (a.source || "web"),
					a.lang ? "lang: " + a.lang : "",
					"createdAt: " + (a.createdAt || ""),
					"tags: [" + (Array.isArray(a.tags) ? a.tags.join(", ") : (a.tags || "")) + "]",
					"author: " + (a.author || ""),
					"---",
					"",
					String(a.content || ""),
				].filter((l) => l !== "").join("\n");
				await adapter.write(path, fm);
				added++;
			}
		}

		// --- vocab -> vocab/<notebook>.md （表格，追加去重）---
		if (Array.isArray(parsed.vocab)) {
			const byNotebook: { [nb: string]: any[] } = {};
			for (const v of parsed.vocab) {
				if (!v || !v.word) continue;
				const nb = this.safeName(v.notebook || "default");
				(byNotebook[nb] = byNotebook[nb] || []).push(v);
			}
			for (const nb of Object.keys(byNotebook)) {
				const path = "vocab/" + nb + ".md";
				let existing: string[] = [];
				let header = "# " + nb + "\n\n| Word | Phonetic | Definition | Example |\n| --- | --- | --- | --- |";
				if (await adapter.exists(path)) {
					const content = await adapter.read(path);
					existing = content.split("\n")
						.filter((l) => l.trim().startsWith("|"))
						.map((l) => l.split("|")[1]?.trim().toLowerCase())
						.filter(Boolean);
					header = content.trim();
				}
				const rows: string[] = [];
				for (const v of byNotebook[nb]) {
					const w = String(v.word).toLowerCase();
					if (existing.includes(w)) continue;
					existing.push(w);
					rows.push(
						"| " + [v.word, v.phonetic || "", v.definition || "", v.example || ""]
							.map((x) => String(x).replace(/\|/g, "\\|").replace(/\n/g, " "))
							.join(" | ") + " |"
					);
					added++;
				}
				if (rows.length > 0) {
					await adapter.write(path, header + "\n" + rows.join("\n") + "\n");
				}
			}
		}

		// 刷新仪表盘
		const leaves = this.app.workspace.getLeavesOfType(DASHBOARD_VIEW_TYPE);
		for (const leaf of leaves) {
			const view = leaf.view as DashboardView;
			if (view) view.refresh();
		}
		return added;
	}

	// 导出 vault 的 history/ vocab/ browser-captures/ 为统一 JSON
	async exportEscJson(): Promise<string> {
		const adapter = this.app.vault.adapter;
		const store: any = {
			schemaVersion: 1,
			exportedAt: new Date().toISOString(),
			articles: [],
			vocab: [],
			captures: [],
		};

		// captures
		if (await adapter.exists("browser-captures")) {
			const files = await adapter.list("browser-captures");
			for (const fp of files.files.filter((f) => f.endsWith(".md"))) {
				const c = await adapter.read(fp);
				const m = c.match(/^---\n([\s\S]*?)\n---/);
				const fm: any = {};
				if (m) {
					m[1].split("\n").forEach((line) => {
						const idx = line.indexOf(":");
						if (idx > 0) fm[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
					});
				}
				const body = c.replace(/^---\n[\s\S]*?\n---\n/, "").replace(/^> /gm, "").trim();
				store.captures.push({
					id: fp.replace("browser-captures/", "").replace(".md", ""),
					title: (c.match(/^#\s+(.+)$/m) || [])[1] || "网页采集",
					text: body,
					url: fm.url || "",
					source: fm.source || "selection",
					createdAt: fm.createdAt || "",
					note: fm.note || "",
					tags: parseFrontmatterList(fm.tags),
					author: fm.author || "",
				});
			}
		}

		// articles
		if (await adapter.exists("history")) {
			const files = await adapter.list("history");
			for (const fp of files.files.filter((f) => f.endsWith(".md"))) {
				const c = await adapter.read(fp);
				const m = c.match(/^---\n([\s\S]*?)\n---/);
				const fm: any = {};
				if (m) {
					m[1].split("\n").forEach((line) => {
						const idx = line.indexOf(":");
						if (idx > 0) fm[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
					});
				}
				store.articles.push({
					id: fp.replace("history/", "").replace(".md", ""),
					title: fm.title || (c.match(/^#\s+(.+)$/m) || [])[1] || "未命名文章",
					source: fm.source || "web",
					content: c.replace(/^---\n[\s\S]*?\n---\n/, "").trim(),
					lang: fm.lang || "",
					createdAt: fm.createdAt || "",
					tags: parseFrontmatterList(fm.tags),
					author: fm.author || "",
				});
			}
		}

		// vocab
		if (await adapter.exists("vocab")) {
			const files = await adapter.list("vocab");
			for (const fp of files.files.filter((f) => f.endsWith(".md"))) {
				const c = await adapter.read(fp);
				const nb = fp.replace("vocab/", "").replace(".md", "");
				c.split("\n").forEach((line) => {
					const t = line.trim();
					if (t.startsWith("|") && !t.includes("---") && !t.includes("Word") && !t.includes("单词")) {
						const cells = t.split("|").slice(1, -1).map((x) => x.trim());
						if (cells.length >= 1 && cells[0]) {
							store.vocab.push({
								word: cells[0],
								phonetic: cells[1] || "",
								definition: cells[2] || "",
								example: cells[3] || "",
								notebook: nb,
								createdAt: "",
							});
						}
					}
				});
			}
		}

		return JSON.stringify(store, null, 2);
	}

	// 新建一条网页采集（capture），带 note / tags / author 规范化 frontmatter
	async newCapture(data: {
		title?: string;
		text: string;
		url?: string;
		note?: string;
		tags?: string[];
		author?: string;
	}): Promise<string> {
		const adapter = this.app.vault.adapter;
		const ts = new Date();
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
			"# " + (data.title || "网页采集"),
			"",
			"> " + String(data.text || "").replace(/\n+/g, "\n> "),
		].filter((l) => l !== "").join("\n");
		await adapter.write(path, fm);
		const leaves = this.app.workspace.getLeavesOfType(DASHBOARD_VIEW_TYPE);
		for (const leaf of leaves) {
			const view = leaf.view as DashboardView;
			if (view) view.refresh();
		}
		return path;
	}

	// 复习今日卡片（FSRS-lite）：扫描今日 capture / article / {{c1::}} 填空卡，
	// 生成一张复习页，打开并定位。
	async reviewTodayCards(): Promise<void> {
		const adapter = this.app.vault.adapter;
		const today = todayStr();
		const cards: { type: string; q: string; a: string; hint: string; src: string }[] = [];

		// 1) 今日 capture：以 note（若有）或文本首句作为正面，整体作为背面
		if (await adapter.exists("browser-captures")) {
			const files = await adapter.list("browser-captures");
			for (const fp of files.files.filter((f) => f.endsWith(".md"))) {
				const c = await adapter.read(fp);
				const m = c.match(/^---\n([\s\S]*?)\n---/);
				const fm: any = {};
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
					type: "采集",
					q: (note || body.split("\n")[0] || "网页采集").slice(0, 80),
					a: body,
					hint: note ? "note: " + note : "",
					src: fp,
				});
			}
		}

		// 2) 今日文章：抽取 {{c1::}} 填空卡
		if (await adapter.exists("history")) {
			const files = await adapter.list("history");
			for (const fp of files.files.filter((f) => f.endsWith(".md"))) {
				const c = await adapter.read(fp);
				const m = c.match(/^---\n([\s\S]*?)\n---/);
				const fm: any = {};
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
					// 去掉填空标记，生成"挖空"题干（答案处用 ___ 占位）
					const qText = content
						.replace(/\{\{c\d+::([\s\S]*?)(?:::([\s\S]*?))?\}\}/g, "___")
						.split("\n")
						.filter((l) => l.includes("___"))
						.join("\n")
						.trim()
						.slice(0, 200);
					cards.push({
						type: "填空",
						q: qText || cz.hint || "填空练习",
						a: cz.answer,
						hint: cz.hint,
						src: fp,
					});
				}
			}
		}

		if (cards.length === 0) {
			new Notice("今天还没有新卡片（采集/文章/填空）。");
			return;
		}

		// 生成复习页（FSRS-lite 状态写入 frontmatter）
		const lines: string[] = [
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
			"# 复习 · " + today,
			"",
			"> 共 " + cards.length + " 张卡片。展开答案后自评：Again / Good / Easy。",
			"",
		];
		cards.forEach((card, i) => {
			lines.push("## " + (i + 1) + ". [" + card.type + "] " + (card.hint || card.q).slice(0, 60));
			lines.push("**来源**: " + card.src);
			lines.push("");
			lines.push("> [!question]" + (card.q ? " " + card.q : ""));
			lines.push("");
			lines.push("> [!answer]");
			lines.push("> " + card.a.replace(/\n/g, "\n> "));
			lines.push("");
		});

		const reviewPath = "复习-" + today + ".md";
		await adapter.write(reviewPath, lines.join("\n"));
		const file = this.app.vault.getAbstractFileByPath(reviewPath);
		if (file) await this.app.workspace.getLeaf(false).openFile(file as any);
		new Notice("已生成今日复习卡 " + cards.length + " 张：" + reviewPath);
	}
}

// Helper: escape regex special characters
function escapeRegExp(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Helper: parse Obsidian frontmatter list value like "[a, b]" or "a, b" -> string[]
function parseFrontmatterList(raw: string | undefined): string[] {
	if (!raw) return [];
	let s = String(raw).trim();
	if (s.startsWith("[") && s.endsWith("]")) s = s.slice(1, -1);
	if (!s.trim()) return [];
	return s.split(",").map((x) => x.trim()).filter(Boolean);
}

// Helper: today as YYYY-MM-DD (local)
function todayStr(d: Date = new Date()): string {
	const p = (n: number) => (n < 10 ? "0" + n : "" + n);
	return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
}

// Helper: parse {{c1::answer::hint}} / {{c1::answer}} cloze syntax
interface ClozeCard {
	answer: string;
	hint: string;
}
function parseCloze(text: string): ClozeCard[] {
	const cards: ClozeCard[] = [];
	const re = /\{\{c\d+::([\s\S]*?)(?:::([\s\S]*?))?\}\}/g;
	let m: RegExpExecArray | null;
	while ((m = re.exec(text)) !== null) {
		cards.push({ answer: m[1].trim(), hint: (m[2] || "").trim() });
	}
	return cards;
}

// Helper: lightweight FSRS (FSRS-lite) scheduling state
// Stored in card frontmatter: due, reps, ease, lapses
interface FsrsState {
	due: string; // YYYY-MM-DD
	reps: number;
	ease: number;
	lapses: number;
}
const FSRS_DEFAULT_EASE = 2.5;
const FSRS_INTERVALS = [0, 1, 3, 7, 16, 35, 0]; // index by reps (days); last 0 -> +inf-ish

function fsrsInitState(): FsrsState {
	return { due: todayStr(), reps: 0, ease: FSRS_DEFAULT_EASE, lapses: 0 };
}

// grade: 'again'(1) | 'good'(3) | 'easy'(4)
function fsrsReview(state: FsrsState, grade: number): FsrsState {
	let { reps, ease, lapses } = state;
	if (grade <= 1) {
		// forgot -> reset reps, lower ease
		reps = 0;
		lapses = lapses + 1;
		ease = Math.max(1.3, ease - 0.2);
	} else {
		reps = reps + 1;
		if (grade >= 4) ease = ease + 0.15;
		else ease = Math.max(1.3, ease - 0.02);
	}
	const idx = Math.min(reps, FSRS_INTERVALS.length - 2);
	const days = FSRS_INTERVALS[idx + 1] || 35;
	const due = new Date();
	due.setDate(due.getDate() + (grade <= 1 ? 0 : days));
	return { due: todayStr(due), reps, ease: Math.round(ease * 100) / 100, lapses };
}

// ============================================================
// 导入 Modal：粘贴浏览器插件导出的统一 JSON
// ============================================================
class ImportEscModal extends Modal {
	plugin: EnglishStudyClubPlugin;
	textarea!: HTMLTextAreaElement;
	statusEl!: HTMLElement;

	constructor(app: App, plugin: EnglishStudyClubPlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.style.width = "var(--modal-width, 600px)";

		contentEl.createEl("h3", { text: "导入 English Study Club JSON" });
		contentEl.createEl("p", {
			text: "将浏览器插件「导出 JSON」得到的文件内容粘贴到下方，点击导入后会写入本 vault 的 history/、vocab/、browser-captures/ 目录。",
			cls: "setting-item-description",
		});

		this.textarea = contentEl.createEl("textarea");
		this.textarea.placeholder = "在此粘贴 JSON…";
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

		const cancelBtn = btnRow.createEl("button", { text: "取消" });
		cancelBtn.addEventListener("click", () => this.close());

		const importBtn = btnRow.createEl("button", { text: "导入" });
		importBtn.addClass("mod-cta");
		importBtn.addEventListener("click", async () => {
			const text = this.textarea.value.trim();
			if (!text) {
				this.statusEl.textContent = "请先粘贴 JSON 内容";
				return;
			}
			importBtn.setAttribute("disabled", "true");
			try {
				const added = await this.plugin.importEscJson(text);
				this.statusEl.textContent = "导入成功，新增 " + added + " 条。";
				new Notice("导入成功，新增 " + added + " 条");
				setTimeout(() => this.close(), 800);
			} catch (e: any) {
				this.statusEl.textContent = "导入失败: " + (e.message || e);
				new Notice("导入失败: " + (e.message || e));
				importBtn.removeAttribute("disabled");
			}
		});
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}

// ============================================================
// 新建网页采集 Modal：支持 note / tags / author 标注
// ============================================================
class NewCaptureModal extends Modal {
	plugin: EnglishStudyClubPlugin;
	titleEl!: HTMLInputElement;
	textEl!: HTMLTextAreaElement;
	noteEl!: HTMLTextAreaElement;
	tagsEl!: HTMLInputElement;
	authorEl!: HTMLInputElement;
	urlEl!: HTMLInputElement;
	statusEl!: HTMLElement;

	constructor(app: App, plugin: EnglishStudyClubPlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.style.width = "var(--modal-width, 600px)";

		contentEl.createEl("h3", { text: "新建网页采集" });
		contentEl.createEl("p", {
			text: "保存一段文本到 browser-captures/，可附加 note 标注、标签与作者。",
			cls: "setting-item-description",
		});

		const field = (label: string, el: HTMLElement) => {
			const wrap = contentEl.createDiv();
			wrap.style.marginTop = "10px";
			wrap.createEl("label", { text: label, cls: "setting-item-name" }).style.display = "block";
			wrap.appendChild(el);
			return wrap;
		};

		this.titleEl = contentEl.createEl("input");
		this.titleEl.placeholder = "标题（可选）";
		this.titleEl.style.width = "100%";
		field("标题", this.titleEl);

		this.urlEl = contentEl.createEl("input");
		this.urlEl.placeholder = "来源网址（可选）";
		this.urlEl.style.width = "100%";
		field("来源 URL", this.urlEl);

		this.textEl = contentEl.createEl("textarea");
		this.textEl.placeholder = "粘贴要保存的文本…";
		this.textEl.style.width = "100%";
		this.textEl.style.height = "140px";
		this.textEl.style.fontSize = "13px";
		field("文本（必填）", this.textEl);

		this.noteEl = contentEl.createEl("textarea");
		this.noteEl.placeholder = "笔记 / 标注（可选，例如：这句话的语法点、个人理解）";
		this.noteEl.style.width = "100%";
		this.noteEl.style.height = "70px";
		this.noteEl.style.fontSize = "13px";
		field("note 标注", this.noteEl);

		this.tagsEl = contentEl.createEl("input");
		this.tagsEl.placeholder = "标签，逗号分隔，如：语法, 雅思";
		this.tagsEl.style.width = "100%";
		field("tags", this.tagsEl);

		this.authorEl = contentEl.createEl("input");
		this.authorEl.placeholder = "作者（可选）";
		this.authorEl.style.width = "100%";
		field("author", this.authorEl);

		this.statusEl = contentEl.createEl("p", { cls: "setting-item-description" });
		this.statusEl.style.marginTop = "8px";

		const btnRow = contentEl.createDiv();
		btnRow.style.display = "flex";
		btnRow.style.gap = "8px";
		btnRow.style.marginTop = "14px";
		btnRow.style.justifyContent = "flex-end";

		const cancelBtn = btnRow.createEl("button", { text: "取消" });
		cancelBtn.addEventListener("click", () => this.close());

		const saveBtn = btnRow.createEl("button", { text: "保存采集" });
		saveBtn.addClass("mod-cta");
		saveBtn.addEventListener("click", async () => {
			const text = this.textEl.value.trim();
			if (!text) {
				this.statusEl.textContent = "请先填写文本";
				return;
			}
			saveBtn.setAttribute("disabled", "true");
			try {
				const tags = this.tagsEl.value.split(",").map((t) => t.trim()).filter(Boolean);
				const path = await this.plugin.newCapture({
					title: this.titleEl.value.trim() || undefined,
					text,
					url: this.urlEl.value.trim() || undefined,
					note: this.noteEl.value.trim() || undefined,
					tags,
					author: this.authorEl.value.trim() || undefined,
				});
				new Notice("已保存采集：" + path);
				this.close();
			} catch (e: any) {
				this.statusEl.textContent = "保存失败: " + (e.message || e);
				saveBtn.removeAttribute("disabled");
			}
		});
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
