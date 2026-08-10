import { Plugin, ItemView, WorkspaceLeaf, Notice, PluginSettingTab, Setting, TFile, TFolder } from "obsidian";
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
}

// Helper: escape regex special characters
function escapeRegExp(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
