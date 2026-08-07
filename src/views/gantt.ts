/**
 * GanttRenderer — 自绘横向时间轴（步骤 4 核心 + 增强）。
 *
 * 特性：
 * - 模式基准视野：每屏时间跨度由 displayMode 决定（year=10 年 / month=12 月 /
 *   day=31 天），三种模式视野差异显著；条目范围超过基准跨度时内容自动加宽，
 *   通过横向滚动浏览全部条目；想看更早 / 更晚的日期通过手动操作（滚轮缩放 /
 *   模式切换）；
 * - 滚轮缩放：Ctrl / Cmd + 滚轮以鼠标为锚点放大（1x ~ 300x），鼠标下的时间点
 *   不漂移；放大后可横向滚动查看细节；缩小最多回到基准视野（zoom=1）；
 * - 刻度按每屏跨度自适应细化（刻度档位池覆盖分钟~200 年，标签按粒度自适应）；
 * - 每个有效条目渲染为横向时间条：x / 宽度由 start / end 与统一比例尺决定，
 *   跨年 / 跨月自然跨越（连续时间轴，不做分段截断）；
 * - showFileName：宽条（≥60px）文件名显示在条内（省略号截断）；窄条 / 单点
 *   文件名显示在条的右侧浮层（bar 与文件名视为整体可点），悬停还有原生 title；
 * - 交互：hover 高亮；点击 / 键盘 Enter、Space 打开对应文件；
 * - 性能：刻度、网格线与时间条行均按可视区域虚拟渲染，行高固定
 *   （GANTT_ROW_HEIGHT），上千条目滚动流畅；ResizeObserver 自适应宽度；
 *   内容宽度显式设置（inner = contentWidth + padding），滚动范围与内容右缘精确对齐。
 *
 * 本类只负责绘制与交互，不持有 Obsidian 视图生命周期；
 * 打开文件的回调由调用方注入（onOpenFile）。
 */
import type { DisplayMode } from '../config/types';
import type { TimelineItem } from '../data';
import {
	alignTickDown,
	baseSpanForMode,
	computeRange,
	DAY_STEP,
	MS_DAY,
	nextTick,
	selectTickStep,
	tickLabel,
	type TickStep,
} from './scale';

/** 固定行高（虚拟滚动按行定位）。 */
export const GANTT_ROW_HEIGHT = 30;
/** 刻度区高度。 */
export const GANTT_AXIS_HEIGHT = 26;
/** day 模式额外的月份分组带高度（叠在刻度区顶部，day 模式总高 = 轴高 + 此值）。 */
const MONTH_BAND_HEIGHT = 18;
/** 内容区左右内边距。 */
const PAD_X = 12;
/** 单点 / 极窄时间条的最小可交互宽度。 */
const MIN_BAR_WIDTH = 6;
/** 文件名显示在条内的最小宽度（更窄则显示在条右侧浮层）。 */
const MIN_LABEL_WIDTH = 60;
/** 可视区上下外扩行数（缓冲，避免快速滚动露白）。 */
const OVERSCAN_ROWS = 6;
/** 刻度可视区左右外扩像素。 */
const OVERSCAN_PX = 100;
/** 缩放范围：1 = fit 全部条目，300 = 最大放大。 */
const MIN_ZOOM = 1;
const MAX_ZOOM = 300;
/** 滚轮缩放灵敏度（指数系数）。 */
const ZOOM_SENSITIVITY = 0.002;

export interface GanttRenderOptions {
	/** 有效条目（status 为 valid，且均携带 start / end）。 */
	items: TimelineItem[];
	/** 刻度模式（决定 fit 基准跨度：year=10 年 / month=12 月 / day=31 天）。 */
	mode: DisplayMode;
	/** 是否在时间条上显示文件名。 */
	showFileName: boolean;
	/** 开始时间字段名（tooltip 详情展示用）。 */
	startField: string;
	/** 结束时间字段名（tooltip 详情展示用）。 */
	endField: string;
	/** 点击 / 回车打开文件时回调。 */
	onOpenFile: (item: TimelineItem) => void;
}

/** 布局快照：模式基准视野 + 缩放产生的几何参数。 */
interface GanttLayout {
	/** 当前每屏时间跨度（毫秒）= fitScreenMs / zoom。 */
	spanMs: number;
	/** 时间轴起点（fit 范围左边缘时间，= 条目范围起点）。 */
	originMs: number;
	/** 当前缩放（≥1；1 = 每屏显示模式基准跨度）。 */
	zoom: number;
	/** 像素 / 毫秒 = viewportWidth / spanMs。 */
	pxPerMs: number;
	/** 当前刻度档位（按每屏时间跨度 spanMs 选择）。 */
	step: TickStep;
	/** 视口像素宽度。 */
	viewportWidth: number;
	/** 内容总宽度（像素）= max(viewportWidth × zoom, fitSpanMs × pxPerMs)：
	 *  至少一屏；条目范围超过基准跨度时自动加宽以便横向滚动浏览。 */
	contentWidth: number;
}

/** 将 Date 格式化为 YYYY-MM-DD HH:mm（tooltip / aria 展示用）。 */
function formatDateTime(date: Date): string {
	const pad = (n: number): string => String(n).padStart(2, '0');
	return (
		`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
		`${pad(date.getHours())}:${pad(date.getMinutes())}`
	);
}

/** 悬停详情：标题 + 带字段名的起止时间（多行，原生 title 支持换行）。 */
function formatTooltip(item: TimelineItem, startField: string, endField: string): string {
	if (!item.start || !item.end) return item.title;
	return `${item.title}\n${startField}: ${formatDateTime(item.start)}\n${endField}: ${formatDateTime(item.end)}`;
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

/** 返回给定时间所在月份的下个月 1 日 00:00（毫秒），用于 day 模式月份分组带跨月计算。 */
function nextMonthStart(ms: number): number {
	const d = new Date(ms);
	return new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
}

export class GanttRenderer {
	private readonly options: GanttRenderOptions;
	private readonly container: HTMLElement;
	private readonly scrollEl: HTMLElement;
	private readonly innerEl: HTMLElement;
	private readonly axisEl: HTMLElement;
	private readonly bodyEl: HTMLElement;
	private readonly gridEl: HTMLElement;
	private readonly rowsEl: HTMLElement;
	private readonly resizeObserver: ResizeObserver | null = null;

	private layout: GanttLayout | null = null;
	/** 模式基准跨度（year=10 年 / month=12 月 / day=31 天；每屏视野上限）。 */
	private baseSpanMs = 0;
	/** 覆盖全部条目的 fit 跨度（= 条目范围，含两侧对称 padding；用于内容宽度下限）。 */
	private fitSpanMs = 0;
	/** zoom=1 时每屏时间跨度 = min(基准跨度, 条目范围)：
	 *  数据跨度小于基准时屏幕恰好包住全部条目（右侧不留整屏空白）；
	 *  数据跨度超过基准时回到基准跨度，内容加宽、可横向滚动。 */
	private fitScreenMs = 0;
	/** 时间轴起点（条目范围左边缘，构造时确定）。 */
	private originMs = 0;
	/** 当前缩放（1 = 每屏显示模式基准跨度；仅放大）。 */
	private zoom = 1;
	private rafId = 0;
	private disposed = false;

	/** 滚动监听（rAF 节流，保证 60fps）。 */
	private readonly handleScroll = (): void => {
		if (this.disposed) return;
		window.cancelAnimationFrame(this.rafId);
		this.rafId = window.requestAnimationFrame(() => this.updateViewport());
	};

	/** Ctrl / Cmd + 滚轮缩放（以鼠标为锚点）。 */
	private readonly handleWheel = (event: WheelEvent): void => {
		if (this.disposed) return;
		if (!event.ctrlKey && !event.metaKey) return;
		event.preventDefault();
		const layout = this.layout;
		if (layout === null) return;
		const mouseX = event.offsetX;
		// 鼠标当前位置对应的时间（px → 时间需除以 pxPerMs）。
		const tAtMouse = layout.originMs + (this.scrollEl.scrollLeft + mouseX) / layout.pxPerMs;
		this.zoom = clamp(this.zoom * Math.exp(-event.deltaY * ZOOM_SENSITIVITY), MIN_ZOOM, MAX_ZOOM);
		this.recomputeLayout();
		const next = this.layout;
		if (next === null) return;
		// 锚点：缩放后让鼠标下的时间点仍停留在鼠标 x 处。
		const nextScrollLeft = (tAtMouse - next.originMs) * next.pxPerMs - mouseX;
		this.scrollEl.scrollLeft = clamp(nextScrollLeft, 0, Math.max(0, next.contentWidth - next.viewportWidth));
		this.updateViewport();
	};

	/** 行容器事件委托：点击 / 键盘打开文件。 */
	private readonly handleRowAction = (event: Event): void => {
		if (this.disposed) return;
		const target = event.target as HTMLElement | null;
		const bar = target?.closest<HTMLElement>('.tl-gantt-bar');
		if (bar === null || bar === undefined) return;
		const index = Number(bar.dataset.index);
		const item = this.options.items[index];
		if (item !== undefined && (event.type === 'click' || (event as KeyboardEvent).key === 'Enter' || (event as KeyboardEvent).key === ' ')) {
			if (event.type === 'keydown') {
				event.preventDefault();
			}
			this.options.onOpenFile(item);
		}
	};

	constructor(container: HTMLElement, options: GanttRenderOptions) {
		this.container = container;
		this.options = options;

		this.scrollEl = container.createDiv({ cls: 'tl-gantt-scroll' });
		this.innerEl = this.scrollEl.createDiv({ cls: 'tl-gantt-inner' });
		this.axisEl = this.innerEl.createDiv({ cls: 'tl-gantt-axis' });
		this.bodyEl = this.innerEl.createDiv({ cls: 'tl-gantt-body' });
		this.gridEl = this.bodyEl.createDiv({ cls: 'tl-gantt-grid' });
		this.rowsEl = this.bodyEl.createDiv({ cls: 'tl-gantt-rows' });

		this.scrollEl.addEventListener('scroll', this.handleScroll, { passive: true });
		this.scrollEl.addEventListener('wheel', this.handleWheel, { passive: false });
		this.rowsEl.addEventListener('click', this.handleRowAction);
		this.rowsEl.addEventListener('keydown', this.handleRowAction);

		// 默认视野：每屏 = min(模式基准跨度, 条目范围)；数据跨度小于基准时屏幕
		// 恰好包住全部条目（右侧不留整屏空白），超过基准时内容加宽可横向滚动。
		this.recomputeFit();

		if (typeof ResizeObserver === 'function') {
			this.resizeObserver = new ResizeObserver(() => {
				if (!this.disposed) this.relayout();
			});
			this.resizeObserver.observe(this.scrollEl);
		}

		this.relayout();
	}

	/** 更新渲染选项并重绘（模式切换 / showFileName 变化时由调用方调用）。 */
	setOptions(patch: Partial<GanttRenderOptions>): void {
		Object.assign(this.options, patch);
		if (patch.mode !== undefined) {
			// 模式变化：切换到该模式的基准视野（zoom=1），回到内容起点。
			this.recomputeFit();
			this.scrollEl.scrollLeft = 0;
		}
		this.relayout();
		this.updateViewport();
	}

	/** 由当前模式与条目重新计算 fit 几何：基准跨度 / fit 跨度（紧密贴合条目范围）/
	 *  屏幕视野（min(基准, 条目范围)）/ 起点，并将缩放复位到 1。 */
	private recomputeFit(): void {
		this.baseSpanMs = baseSpanForMode(this.options.mode);
		const range = computeRange(this.options.items);
		const dataSpan = range.end - range.start;
		// 紧密贴合数据范围（含 computeRange 的对称 padding）；屏幕视野取基准与数据范围的较小值，
		// 使小范围数据不再被强制撑满整屏基准视野（消除右侧整屏空白）。
		this.fitSpanMs = dataSpan;
		this.fitScreenMs = Math.min(this.baseSpanMs, dataSpan);
		this.originMs = range.start;
		this.zoom = 1;
	}

	/** 释放全部监听与 DOM；卸载安全。 */
	destroy(): void {
		this.disposed = true;
		window.cancelAnimationFrame(this.rafId);
		this.resizeObserver?.disconnect();
		this.scrollEl.removeEventListener('scroll', this.handleScroll);
		this.scrollEl.removeEventListener('wheel', this.handleWheel);
		this.rowsEl.removeEventListener('click', this.handleRowAction);
		this.rowsEl.removeEventListener('keydown', this.handleRowAction);
		this.container.empty();
	}

	// -------------------------------------------------------------- 布局与绘制

	/** 由视口宽度构建布局快照（屏幕视野固定为 fitScreenMs，缩放改变每屏跨度与像素密度）。 */
	private buildLayout(viewportWidth: number): GanttLayout {
		const spanMs = this.fitScreenMs / this.zoom;
		const pxPerMs = viewportWidth / spanMs;
		// day 模式锁定日粒度下限：刻度最粗为每天一条，缩放变小跨度时自动细化到小时 / 分钟。
		const maxStep = this.options.mode === 'day' ? DAY_STEP : undefined;
		return {
			spanMs,
			originMs: this.originMs,
			zoom: this.zoom,
			pxPerMs,
			step: selectTickStep(spanMs, pxPerMs, maxStep),
			viewportWidth,
			contentWidth: Math.max(viewportWidth * this.zoom, this.fitSpanMs * pxPerMs),
		};
	}

	/** 重新计算几何参数（宽度变化 / 选项变化 / 缩放时调用）。 */
	private relayout(): void {
		if (this.disposed) return;
		const viewportWidth = Math.max(this.scrollEl.clientWidth - 2 * PAD_X, 1);
		this.layout = this.buildLayout(viewportWidth);
		// 显式设置内容宽度：滚动区域（scrollWidth）与内容右缘精确对齐，
		// 否则放大后 bar / 刻度溢出默认宽度（视口宽），滚动条拖不到尾部。
		this.innerEl.style.setProperty('width', `${this.layout.contentWidth + 2 * PAD_X}px`);
		this.bodyEl.style.setProperty('height', `${this.options.items.length * GANTT_ROW_HEIGHT}px`);
		this.updateViewport();
	}

	/** 缩放后重建布局（基准跨度、fit 范围与原点不变）。 */
	private recomputeLayout(): void {
		const layout = this.layout;
		if (layout === null) return;
		this.layout = this.buildLayout(layout.viewportWidth);
		this.innerEl.style.setProperty('width', `${this.layout.contentWidth + 2 * PAD_X}px`);
	}

	/** 重绘可视区：刻度（axis + 网格线）+ 时间条行。 */
	private updateViewport(): void {
		if (this.disposed || this.layout === null) return;
		const layout = this.layout;
		const scrollLeft = this.scrollEl.scrollLeft;
		const leftPx = scrollLeft - OVERSCAN_PX;
		const rightPx = scrollLeft + layout.viewportWidth + OVERSCAN_PX;
		this.renderTicks(leftPx, rightPx);
		this.renderRows();
	}

	/** 绘制可视区内的刻度：顶部标签 + 贯穿主体的网格竖线（与刻度严格对齐）。 */
	private renderTicks(leftPx: number, rightPx: number): void {
		const layout = this.layout;
		if (layout === null) return;
		this.axisEl.empty();
		this.gridEl.empty();
		// 清除内联高度（day 模式会覆盖为高两层；非 day 模式回退 CSS 默认 26px）。
		this.axisEl.style.removeProperty('height');

		// 裁剪到内容范围 [0, contentWidth]：内容区外的刻度 / 网格线会把滚动区域
		// 撑大，导致横向滚动条拖不到能让尾部内容完整显示的位置。
		const boundedLeftPx = clamp(leftPx, 0, layout.contentWidth);
		const boundedRightPx = clamp(rightPx, 0, layout.contentWidth);
		const leftMs = layout.originMs + boundedLeftPx / layout.pxPerMs;
		const rightMs = layout.originMs + boundedRightPx / layout.pxPerMs;

		// day 粒度（day 模式默认）：月份分组带 + 每日仅显示日数字，避免年月重复拥挤。
		if (layout.step.days !== undefined) {
			this.renderDayGroupedTicks(layout, leftMs, rightMs);
			return;
		}

		for (let t = alignTickDown(layout.step, leftMs); t <= rightMs; t = nextTick(layout.step, t)) {
			const x = (t - layout.originMs) * layout.pxPerMs;
			const tick = this.axisEl.createDiv({ cls: 'tl-gantt-tick' });
			tick.style.setProperty('left', `${x}px`);
			tick.createSpan({ cls: 'tl-gantt-tick-label', text: tickLabel(layout.step, t) });

			const line = this.gridEl.createDiv({ cls: 'tl-gantt-gridline' });
			line.style.setProperty('left', `${x}px`);
		}
	}

	/** day 模式分组渲染：顶部月份分组带（纯数字「YYYY-M」标签，每月都带年份，国际化无本地化依赖）+
	 *  每日刻度仅显示日数字（落在分组带下方，不再重复年月）。 */
	private renderDayGroupedTicks(layout: GanttLayout, leftMs: number, rightMs: number): void {
		this.axisEl.style.setProperty('height', `${GANTT_AXIS_HEIGHT + MONTH_BAND_HEIGHT}px`);
		const dayStep: TickStep = { days: 1, approxMs: MS_DAY };

		// 1) 月份分组带：从包含 leftMs 的月 1 日起，逐月直到包含 rightMs 的月。
		//    标签统一为「年-月」（如 1927-7），每月均显示年份，纯数字无语言依赖。
		const leftD = new Date(leftMs);
		const firstMonthStart = new Date(leftD.getFullYear(), leftD.getMonth(), 1).getTime();
		for (let m = firstMonthStart; m <= rightMs; m = nextMonthStart(m)) {
			const md = new Date(m);
			const nextMs = nextMonthStart(m);
			const bandLeft = Math.max((m - layout.originMs) * layout.pxPerMs, 0);
			const bandRightMs = Math.min(nextMs, rightMs);
			const bandRightX = (bandRightMs - layout.originMs) * layout.pxPerMs;
			const bandW = Math.max(bandRightX - bandLeft, 1);
			const label = `${md.getFullYear()}-${md.getMonth() + 1}`;
			const band = this.axisEl.createDiv({ cls: 'tl-gantt-month-band' });
			band.style.setProperty('left', `${bandLeft}px`);
			band.style.setProperty('width', `${bandW}px`);
			band.createSpan({ cls: 'tl-gantt-month-label', text: label });
		}

		// 2) 每日刻度：竖线（贯穿整条轴）+ 日数字（落在月份带下方的轴底区域）。
		for (let t = alignTickDown(dayStep, leftMs); t <= rightMs; t = nextTick(dayStep, t)) {
			const x = (t - layout.originMs) * layout.pxPerMs;
			const d = new Date(t);
			const tick = this.axisEl.createDiv({ cls: 'tl-gantt-tick tl-gantt-tick-day' });
			tick.style.setProperty('left', `${x}px`);
			tick.createSpan({ cls: 'tl-gantt-tick-label tl-gantt-day-num', text: String(d.getDate()) });

			const line = this.gridEl.createDiv({ cls: 'tl-gantt-gridline' });
			line.style.setProperty('left', `${x}px`);
		}
	}

	/** 虚拟滚动渲染可见行（固定行高定位，仅创建可视区 + 缓冲行）。 */
	private renderRows(): void {
		const layout = this.layout;
		if (layout === null) return;
		const { items, showFileName, startField, endField } = this.options;

		this.rowsEl.empty();

		const scrollTop = this.scrollEl.scrollTop;
		const viewportHeight = this.scrollEl.clientHeight;
		const first = Math.max(0, Math.floor(scrollTop / GANTT_ROW_HEIGHT) - OVERSCAN_ROWS);
		const last = Math.min(items.length, Math.ceil((scrollTop + viewportHeight) / GANTT_ROW_HEIGHT) + OVERSCAN_ROWS);

		for (let i = first; i < last; i++) {
			const item = items[i];
			if (item === undefined || item.start === undefined || item.end === undefined) continue;
			const x = (item.start.getTime() - layout.originMs) * layout.pxPerMs;
			let width = (item.end.getTime() - item.start.getTime()) * layout.pxPerMs;
			const isPoint = width < MIN_BAR_WIDTH;
			if (isPoint) width = MIN_BAR_WIDTH;
			const barLeft = isPoint ? x - MIN_BAR_WIDTH / 2 : x;
			const barRight = barLeft + width;

			const row = this.rowsEl.createDiv({ cls: 'tl-gantt-row' });
			row.style.setProperty('top', `${i * GANTT_ROW_HEIGHT}px`);

			const bar = row.createDiv({
				cls: isPoint ? 'tl-gantt-bar tl-gantt-bar-point' : 'tl-gantt-bar',
				attr: {
					tabindex: '0',
					role: 'link',
					'data-index': String(i),
				},
			});
			bar.title = formatTooltip(item, startField, endField);
			bar.style.setProperty('left', `${barLeft}px`);
			bar.style.setProperty('width', `${width}px`);
			if (showFileName) {
				if (width >= MIN_LABEL_WIDTH) {
					// 宽条：文件名在条内省略号截断
					bar.createSpan({ cls: 'tl-gantt-bar-label', text: item.title });
				} else {
					// 窄条 / 单点：文件名浮层。优先放在条右侧；右侧空间不足（贴近内容右缘，
					// 如最后一个 bar）时翻转到左侧，确保文件名始终可见（悬停 title 兜底）。
					const rightRoom = layout.contentWidth - barRight;
					const leftRoom = barLeft;
					const placeLeft = rightRoom < 40 && leftRoom >= 40;
					const room = placeLeft ? leftRoom : rightRoom;
					if (room >= 40) {
						const label = bar.createSpan({
							cls: placeLeft
								? 'tl-gantt-bar-label tl-gantt-bar-label-out tl-gantt-bar-label-out-left'
								: 'tl-gantt-bar-label tl-gantt-bar-label-out',
							text: item.title,
						});
						label.style.setProperty('max-width', `${Math.min(240, room - 6)}px`);
					}
				}
			}
		}
	}
}
