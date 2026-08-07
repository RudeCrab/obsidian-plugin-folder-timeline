/**
 * Timeline 视图（ItemView，步骤 3 骨架 + 步骤 4 时间轴核心渲染 + 增强）。
 *
 * 数据流：视图配置文件（frontmatter）→ parseTimelineConfig → collectMarkdownFiles →
 * buildTimelineItems（注入 vault frontmatter reader）→ 信息层 + GanttRenderer 时间轴。
 *
 * 增强能力：
 * - 视图内编辑配置：配置摘要区为可编辑表单（folder / recursive / startField /
 *   endField / showFileName / displayMode），保存后写回配置文件 frontmatter
 *   （保留未知键）并立即刷新；
 * - 视图 / 配置切换：工具栏可切换显示时间轴视图或配置文件原文；
 * - 时间轴：自绘横向时间轴（无限滚动 + 滚轮缩放），year / month / day 模式
 *   切换（覆盖 displayMode，随工作区状态持久化，不写回配置文件），
 *   点击 / 回车时间条在 Obsidian 中打开对应文件。
 */
import { ItemView, Notice, TFile, WorkspaceLeaf, type Plugin } from 'obsidian';
import { t } from '../i18n';
import { parseTimelineConfig, type ConfigError, type DisplayMode, type SortBy, type SortOrder, type TimelineConfig } from '../config';
import {
	buildTimelineItems,
	collectMarkdownFiles,
	createVaultFrontmatterReader,
	extractFrontmatterText,
	parseFrontmatterText,
	sortTimelineItems,
	type TimelineItem,
} from '../data';
import { GanttRenderer } from './gantt';

/** 视图稳定标识（注册与打开共用，不得改动）。 */
export const VIEW_TYPE_TIMELINE = 'timeline-view';

/** 可切换的显示模式（顺序即工具栏按钮顺序）。 */
const DISPLAY_MODES: readonly DisplayMode[] = ['year', 'month', 'day'];

/** 显示模式的可读标签（随当前语言渲染，运行时求值）。 */
function modeLabel(mode: DisplayMode): string {
	return mode === 'year' ? t('view.modeYear') : mode === 'month' ? t('view.modeMonth') : t('view.modeDay');
}

/** 视图展示模式：时间轴 / 配置文件原文。 */
export type ViewMode = 'timeline' | 'config';

/** 注册 Timeline 视图；由插件 onload 调用，经 registerView 自动清理。 */
export function registerTimelineView(plugin: Plugin): void {
	plugin.registerView(VIEW_TYPE_TIMELINE, (leaf) => new TimelineView(leaf));
}

/** 重新渲染所有已打开的 Timeline 视图（语言切换后调用）。 */
export function rerenderAllTimelineViews(plugin: Plugin): void {
	for (const leaf of plugin.app.workspace.getLeavesOfType(VIEW_TYPE_TIMELINE)) {
		const view = leaf.view;
		if (view instanceof TimelineView) {
			void view.rerender();
		}
	}
}

/** 极简 frontmatter 序列化（值仅 boolean / number / string；字符串带引号，YAML 兼容）。 */
function serializeFrontmatter(data: Record<string, unknown>): string {
	const lines: string[] = [];
	for (const [key, value] of Object.entries(data)) {
		if (value === null || value === undefined) continue;
		if (typeof value === 'string') {
			lines.push(`${key}: ${JSON.stringify(value)}`);
		} else if (typeof value === 'boolean' || typeof value === 'number') {
			lines.push(`${key}: ${value}`);
		} else {
			lines.push(`${key}: ${JSON.stringify(value)}`);
		}
	}
	return `${lines.join('\n')}\n`;
}

export class TimelineView extends ItemView {
	/** 当前关联的视图配置文件路径（来自视图 state）。 */
	private filePath: string | null = null;
	/** 视图内覆盖的显示模式（来自视图 state；null = 跟随配置文件 displayMode）。 */
	private overrideMode: DisplayMode | null = null;
	/** 当前展示模式（时间轴 / 配置文件原文）。 */
	private viewMode: ViewMode = 'timeline';
	/** 竞态守卫：只渲染最后一次 render 的结果。 */
	private renderToken = 0;
	/** 当前 Gantt 渲染器实例（render 重建前先销毁）。 */
	private gantt: GanttRenderer | null = null;

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_TIMELINE;
	}

	getDisplayText(): string {
		return t('view.name');
	}

	getIcon(): string {
		return 'timeline';
	}

	getState(): Record<string, unknown> {
		return {
			filePath: this.filePath ?? '',
			displayMode: this.overrideMode ?? undefined,
			viewMode: this.viewMode,
		};
	}

	/** setViewState 传入 state 时由 Obsidian 调用，同步配置并渲染。 */
	async setState(state: unknown): Promise<void> {
		const next = (state ?? {}) as {
			filePath?: string;
			displayMode?: DisplayMode;
			viewMode?: ViewMode;
		};
		const filePath = next.filePath ?? null;
		const mode = next.displayMode ?? null;
		const viewMode = next.viewMode === 'config' ? 'config' : 'timeline';
		if (filePath !== this.filePath || mode !== this.overrideMode || viewMode !== this.viewMode) {
			this.filePath = filePath;
			this.overrideMode = mode;
			this.viewMode = viewMode;
			await this.render();
		}
	}

	async onOpen(): Promise<void> {
		const state = this.getState() as {
			filePath?: string;
			displayMode?: DisplayMode;
			viewMode?: ViewMode;
		} | null;
		this.filePath = state?.filePath ?? null;
		this.overrideMode = state?.displayMode ?? null;
		this.viewMode = state?.viewMode === 'config' ? 'config' : 'timeline';
		this.contentEl.addClass('timeline-view');
		await this.render();
	}

	async onClose(): Promise<void> {
		this.destroyGantt();
		this.contentEl.empty();
	}

	/** 公开的重渲染入口（语言切换时由插件调用）。 */
	rerender(): Promise<void> {
		return this.render();
	}

	// ------------------------------------------------------------------ 渲染

	/** 主渲染流程：按展示模式分发（配置文件原文 / 时间轴完整流程）。 */
	async render(): Promise<void> {
		const token = ++this.renderToken;
		const container = this.contentEl;
		this.destroyGantt();
		container.empty();

		if (this.viewMode === 'config') {
			await this.renderConfigView(container, token);
			return;
		}

		if (this.filePath === null || this.filePath === '') {
			this.renderMessage(container, t('view.noConfigAssociated'));
			return;
		}

		const abstractFile = this.app.vault.getAbstractFileByPath(this.filePath);
		if (!(abstractFile instanceof TFile)) {
			this.renderErrors(container, [t('view.configNotFound', { path: this.filePath ?? '' })]);
			return;
		}

		const content = await this.app.vault.cachedRead(abstractFile);
		const fmText = extractFrontmatterText(content);
		if (fmText === null) {
			this.renderErrors(container, [t('view.noFrontmatter')]);
			return;
		}

		const fm = parseFrontmatterText(fmText);
		if (!fm.ok) {
			this.renderErrors(container, [t('view.frontmatterParseFailed', { error: fm.error ?? t('notice.unknownError') })]);
			return;
		}

		const parsed = parseTimelineConfig(fm.data ?? {});
		if (!parsed.ok) {
			this.renderConfigErrors(container, parsed.errors);
			return;
		}
		const cfg = parsed.config;

		this.renderConfigForm(container, cfg);

		const collected = collectMarkdownFiles(cfg.folder, this.app.vault, cfg.recursive);
		if (!collected.ok) {
			const folderLabel = cfg.folder === '' ? t('view.vaultRootParens') : cfg.folder;
			this.renderErrors(
				container,
				collected.error === 'folder-not-found'
					? [t('view.folderNotFound', { folder: folderLabel })]
					: [t('view.notADirectory', { folder: cfg.folder })],
			);
			return;
		}

		if (collected.files.length === 0) {
			this.renderEmpty(container, cfg.folder);
			return;
		}

		const items = await buildTimelineItems(
			collected.files,
			cfg,
			createVaultFrontmatterReader(this.app.vault),
		);
		if (token !== this.renderToken) {
			return; // 渲染期间发起了新渲染，丢弃本次结果
		}
		this.renderItems(container, items, cfg);
	}

	/** 配置编辑表单（替代只读摘要）：修改后保存写回配置文件。 */
	private renderConfigForm(container: HTMLElement, cfg: TimelineConfig): void {
		const section = container.createDiv({ cls: 'tl-section tl-config-form' });
		section.createEl('h3', { text: t('view.configTitle') });

		const rows: Array<[label: string, control: HTMLElement, controlId?: string]> = [];

		const folderInput = section.createEl('input', {
			cls: 'tl-form-input',
			attr: { type: 'text', value: cfg.folder, placeholder: t('view.folderPlaceholder') },
		});
		rows.push([t('view.folderLabel'), folderInput]);

		const startInput = section.createEl('input', {
			cls: 'tl-form-input',
			attr: { type: 'text', value: cfg.startField },
		});
		rows.push([t('view.startFieldLabel'), startInput]);

		const endInput = section.createEl('input', {
			cls: 'tl-form-input',
			attr: { type: 'text', value: cfg.endField },
		});
		rows.push([t('view.endFieldLabel'), endInput]);

		const recursiveInput = section.createEl('input', {
			cls: 'tl-form-check',
			attr: { type: 'checkbox', id: 'tl-cfg-recursive' },
		});
		recursiveInput.checked = cfg.recursive;
		rows.push([t('view.recursiveLabel'), recursiveInput, 'tl-cfg-recursive']);

		// showFileName：复选框（显示文件名）。
		const showFileNameInput = section.createEl('input', {
			cls: 'tl-form-check',
			attr: { type: 'checkbox', id: 'tl-cfg-show-file-name' },
		});
		showFileNameInput.checked = cfg.showFileName;
		rows.push([t('view.showFileNameLabel'), showFileNameInput, 'tl-cfg-show-file-name']);

		// displayMode：单选框组（样式与视图工具栏模式切换一致；
		// 选中态显示配置文件中的真实值，不随视图内模式切换联动）。放在最后一项。
		const modeGroup = section.createDiv({ cls: 'tl-toolbar-group' });
		const modeRadios: HTMLInputElement[] = [];
		for (const mode of DISPLAY_MODES) {
			const radio = modeGroup.createEl('input', {
				cls: 'tl-mode-radio',
				attr: {
					type: 'radio',
					name: 'tl-display-mode',
					value: mode,
					id: `tl-display-mode-${mode}`,
				},
			});
			radio.checked = mode === cfg.displayMode;
			modeRadios.push(radio);
			modeGroup.createEl('label', { cls: 'tl-mode-btn', text: modeLabel(mode), attr: { for: `tl-display-mode-${mode}` } });
		}
		rows.push([t('view.displayModeLabel'), modeGroup]);

		// sortOrder：单选框组（正序 / 倒序），样式复用 displayMode 工具栏按钮。
		const orderGroup = section.createDiv({ cls: 'tl-toolbar-group' });
		const orderRadios: HTMLInputElement[] = [];
		const orderOptions: Array<[SortOrder, string]> = [
			['asc', t('view.sortOrderAsc')],
			['desc', t('view.sortOrderDesc')],
		];
		for (const [value, label] of orderOptions) {
			const radio = orderGroup.createEl('input', {
				cls: 'tl-mode-radio',
				attr: { type: 'radio', name: 'tl-sort-order', value, id: `tl-sort-order-${value}` },
			});
			radio.checked = value === cfg.sortOrder;
			orderRadios.push(radio);
			orderGroup.createEl('label', {
				cls: 'tl-mode-btn',
				text: label,
				attr: { for: `tl-sort-order-${value}` },
			});
		}
		rows.push([t('view.sortOrderLabel'), orderGroup]);

		// sortBy：单选框组（文件创建 / 修改 / 开始 / 结束字段），样式复用 sortOrder 按钮组。
		const sortByGroup = section.createDiv({ cls: 'tl-toolbar-group' });
		const sortByRadios: HTMLInputElement[] = [];
		const sortByOptions: Array<[SortBy, string]> = [
			['created', t('view.sortByCreated')],
			['modified', t('view.sortByModified')],
			['start', t('view.sortByStart')],
			['end', t('view.sortByEnd')],
		];
		for (const [value, label] of sortByOptions) {
			const radio = sortByGroup.createEl('input', {
				cls: 'tl-mode-radio',
				attr: { type: 'radio', name: 'tl-sort-by', value, id: `tl-sort-by-${value}` },
			});
			radio.checked = value === cfg.sortBy;
			sortByRadios.push(radio);
			sortByGroup.createEl('label', {
				cls: 'tl-mode-btn',
				text: label,
				attr: { for: `tl-sort-by-${value}` },
			});
		}
		rows.push([t('view.sortByLabel'), sortByGroup]);

		for (const [label, control, controlId] of rows) {
			const row = section.createDiv({ cls: 'tl-form-row' });
			const labelEl = row.createEl('label', { text: label });
			if (controlId !== undefined) {
				// 关联复选框：点击文字也能切换。
				labelEl.setAttr('for', controlId);
			}
			row.append(control);
		}

		const actions = section.createDiv({ cls: 'tl-form-actions' });
		const saveBtn = actions.createEl('button', {
			cls: 'tl-save-btn',
			text: t('view.saveConfig'),
			attr: { type: 'button' },
		});
		saveBtn.addEventListener('click', () => {
			const folder = folderInput.value.trim();
			const startField = startInput.value.trim();
			const endField = endInput.value.trim();
			if (folder === '' || startField === '' || endField === '') {
				new Notice(t('view.fieldsRequired'));
				return;
			}
			const nextCfg: TimelineConfig = {
				timeline: true,
				folder,
				recursive: recursiveInput.checked,
				startField,
				endField,
				showFileName: showFileNameInput.checked,
				displayMode: (modeRadios.find((radio) => radio.checked)?.value ?? cfg.displayMode) as DisplayMode,
				sortBy: (sortByRadios.find((radio) => radio.checked)?.value ?? cfg.sortBy) as SortBy,
				sortOrder: (orderRadios.find((radio) => radio.checked)?.value ?? cfg.sortOrder) as SortOrder,
			};
			void this.saveConfig(nextCfg);
		});

		// 「显示原文」：切换到配置文件原文视图（位于保存按钮之后）。
		const toggleBtn = actions.createEl('button', {
			cls: 'tl-mode-btn tl-toggle-btn',
			text: t('view.showSource'),
			attr: { type: 'button' },
		});
		toggleBtn.addEventListener('click', () => {
			this.switchToConfigView();
		});
	}

	/** 保存配置到配置文件 frontmatter（保留未知键），随后刷新视图。 */
	private async saveConfig(nextCfg: TimelineConfig): Promise<void> {
		const abstractFile = this.app.vault.getAbstractFileByPath(this.filePath ?? '');
		if (!(abstractFile instanceof TFile)) {
			new Notice(t('view.configMissingSave'));
			return;
		}
		const content = await this.app.vault.cachedRead(abstractFile);
		const fmText = extractFrontmatterText(content);
		if (fmText === null) {
			new Notice(t('view.noFrontmatterSave'));
			return;
		}
		// 正文 = 闭合 `---` 之后的行（原样保留）。
		// 行结构：['---', ...fm 块内行, '---', ...正文]，
		// 闭合行索引 = 1 + 块内行数，正文从其后一行开始。
		const closeIdx = fmText.split('\n').length + 2;
		const body = content.split('\n').slice(closeIdx).join('\n');

		// 保留原 frontmatter 中的未知键（如 tags 等）。
		const parsed = parseFrontmatterText(fmText);
		const existing = parsed.ok && parsed.data ? { ...parsed.data } : {};
		const merged = { ...existing, ...nextCfg };

		const newContent = `---\n${serializeFrontmatter(merged)}---\n${body}`;
		await this.app.vault.process(abstractFile, () => newContent);
		new Notice(t('view.configSaved'));
		await this.render();
	}

	/** 配置文件原文视图（只读）+ 返回视图按钮。 */
	private async renderConfigView(container: HTMLElement, token: number): Promise<void> {
		const toolbar = container.createDiv({ cls: 'tl-toolbar' });
		const backBtn = toolbar.createEl('button', {
			cls: 'tl-mode-btn is-active',
			text: t('view.showView'),
			attr: { type: 'button' },
		});
		backBtn.addEventListener('click', () => {
			this.viewMode = 'timeline';
			this.app.workspace.requestSaveLayout();
			void this.render();
		});
		toolbar.createSpan({
			cls: 'tl-toolbar-hint',
			text: t('view.readonlyHint'),
		});

		const abstractFile = this.filePath ? this.app.vault.getAbstractFileByPath(this.filePath) : null;
		if (!(abstractFile instanceof TFile)) {
			this.renderErrors(container, [this.filePath ? t('view.configNotFound', { path: this.filePath }) : t('view.noConfig')]);
			return;
		}
		const content = await this.app.vault.cachedRead(abstractFile);
		if (token !== this.renderToken) {
			return;
		}
		container.createEl('pre', { cls: 'tl-config-view', text: content });
	}

	/** 配置解析失败：逐条列出问题字段。 */
	private renderConfigErrors(container: HTMLElement, errors: ConfigError[]): void {
		const section = container.createDiv({ cls: 'tl-section tl-error' });
		section.createEl('h3', { text: t('view.configInvalid') });
		for (const error of errors) {
			section.createDiv({ cls: 'tl-error-item', text: t('view.configErrorField', { field: error.field, message: error.message }) });
		}
	}

	/** 通用错误区（目录不存在 / 文件缺失 / frontmatter 损坏等）。 */
	private renderErrors(container: HTMLElement, messages: string[]): void {
		const section = container.createDiv({ cls: 'tl-section tl-error' });
		section.createEl('h3', { text: t('view.error') });
		for (const message of messages) {
			section.createDiv({ cls: 'tl-error-item', text: message });
		}
	}

	/** 空状态：目录下没有 Markdown 文件。 */
	private renderEmpty(container: HTMLElement, folder: string): void {
		this.renderMessage(
			container,
			t('view.emptyFolder', { folder: folder === '' ? t('view.vaultRoot') : folder }),
		);
	}

	/** 普通提示信息。 */
	private renderMessage(container: HTMLElement, text: string): void {
		container.createDiv({ cls: 'tl-empty', text });
	}

	/** 实际生效的显示模式：视图内覆盖优先，否则跟随配置文件。 */
	private effectiveMode(cfg: TimelineConfig): DisplayMode {
		return this.overrideMode ?? cfg.displayMode;
	}

	/** 文件统计 + 跳过清单 + 工具栏（模式切换 + 视图切换）+ 自绘时间轴。 */
	private renderItems(container: HTMLElement, items: TimelineItem[], cfg: TimelineConfig): void {
		const valid = sortTimelineItems(
			items.filter((item) => item.status === 'valid'),
			cfg.sortBy,
			cfg.sortOrder,
		);
		const skipped = items.filter((item) => item.status === 'skipped');

		const stats = container.createDiv({ cls: 'tl-section' });
		stats.createEl('h3', { text: t('view.fileStats') });
		stats.createDiv({
			text: t('view.statsFormat', { total: items.length, valid: valid.length, skipped: skipped.length }),
		});

		if (skipped.length > 0) {
			const skipSection = container.createDiv({ cls: 'tl-section' });
			const details = skipSection.createEl('details');
			details.createEl('summary', { text: t('view.skippedFiles', { count: skipped.length }) });
			const list = details.createEl('ul', { cls: 'tl-skipped-list' });
			for (const item of skipped) {
				list.createEl('li', { text: `${item.file.path} — ${item.reason ?? t('view.unknownReason')}` });
			}
		}

		if (valid.length === 0) {
			this.renderMessage(container, t('view.noValidItems'));
			return;
		}

		this.renderToolbar(container, this.effectiveMode(cfg));

		const ganttContainer = container.createDiv({ cls: 'tl-gantt' });
		this.gantt = new GanttRenderer(ganttContainer, {
			items: valid,
			mode: this.effectiveMode(cfg),
			showFileName: cfg.showFileName,
			startField: cfg.startField,
			endField: cfg.endField,
			onOpenFile: (item) => {
				void this.openItem(item);
			},
		});
	}

	/** 工具栏：显示模式切换（year / month / day）。 */
	private renderToolbar(container: HTMLElement, current: DisplayMode): void {
		const toolbar = container.createDiv({ cls: 'tl-toolbar' });
		const group = toolbar.createDiv({ cls: 'tl-toolbar-group' });
		for (const mode of DISPLAY_MODES) {
			const button = group.createEl('button', {
				cls: mode === current ? 'tl-mode-btn is-active' : 'tl-mode-btn',
				text: modeLabel(mode),
				attr: { type: 'button', 'aria-pressed': mode === current ? 'true' : 'false' },
			});
			button.addEventListener('click', () => {
				if (this.overrideMode === mode) return;
				this.overrideMode = mode;
				this.app.workspace.requestSaveLayout();
				void this.render();
			});
		}
	}

	/** 切换到配置文件原文视图（视图 / 配置原文切换，配置表单区按钮调用）。 */
	private switchToConfigView(): void {
		this.viewMode = 'config';
		this.app.workspace.requestSaveLayout();
		void this.render();
	}

	/** 点击 / 回车时间条：在新标签页打开对应文件。 */
	private async openItem(item: TimelineItem): Promise<void> {
		try {
			const leaf = this.app.workspace.getLeaf('tab');
			await leaf.openFile(item.file);
		} catch (e) {
			new Notice(t('view.cannotOpenFile', { error: e instanceof Error ? e.message : String(e) }));
		}
	}

	/** 销毁当前 Gantt 渲染器（render 重建 / 视图关闭时调用）。 */
	private destroyGantt(): void {
		if (this.gantt !== null) {
			this.gantt.destroy();
			this.gantt = null;
		}
	}
}
