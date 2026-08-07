/**
 * 时间轴刻度计算（纯函数，不依赖 Obsidian 运行时）。
 *
 * 职责：
 * - computeRange：由全部条目计算初始时间范围（min~max + 边距，单点扩展）；
 * - selectTickStep：按「每屏时间跨度 × 像素密度」从全粒度档位池（分钟~200 年）
 *   选择合适刻度档位 —— 视图滚轮缩放到任意级别都能得到合理刻度；
 * - alignTickDown / nextTick：刻度对齐与推进（年/月/日/时/分，正确处理跨年跨月）；
 * - tickLabel / enumerateTicks：按档位粒度自适应的标签与枚举。
 *
 * 月份 / 年份长短不一，档位仅用近似毫秒估算刻度数量；
 * 日历级推进（年/月/日）用 Date 构造器，时钟级（时/分）用毫秒加法（避免 DST 漂移）。
 */
import type { DisplayMode } from '../config/types';

/** 近似毫秒常量（估算刻度数量用）。 */
export const MS_MINUTE = 60_000;
export const MS_HOUR = 3_600_000;
export const MS_DAY = 86_400_000;
export const MS_MONTH = 2_629_800_000; // 30.4375 天
export const MS_YEAR = 31_557_600_000; // 365.25 天

/** 单个刻度档位：按步长单位推进（与 approxMs 二选一语义，见各函数）。 */
export interface TickStep {
	years?: number;
	months?: number;
	days?: number;
	hours?: number;
	minutes?: number;
	/** 该档位的近似毫秒数（估算刻度数量与像素密度用，非精确日历运算）。 */
	approxMs: number;
}

/** 全粒度档位池（分钟 → 200 年），按从小到大排列。
 * 刻意避免近似重复档位（如 days:30≈months:1、months:12≈years:1），
 * 让月 / 年语义主导大跨度，日 / 时钟语义主导小跨度。 */
const TICK_STEPS: readonly TickStep[] = [
	{ minutes: 1, approxMs: MS_MINUTE },
	{ minutes: 5, approxMs: 5 * MS_MINUTE },
	{ minutes: 10, approxMs: 10 * MS_MINUTE },
	{ minutes: 15, approxMs: 15 * MS_MINUTE },
	{ minutes: 30, approxMs: 30 * MS_MINUTE },
	{ hours: 1, approxMs: MS_HOUR },
	{ hours: 2, approxMs: 2 * MS_HOUR },
	{ hours: 3, approxMs: 3 * MS_HOUR },
	{ hours: 6, approxMs: 6 * MS_HOUR },
	{ hours: 12, approxMs: 12 * MS_HOUR },
	{ days: 1, approxMs: MS_DAY },
	{ days: 2, approxMs: 2 * MS_DAY },
	{ days: 5, approxMs: 5 * MS_DAY },
	{ days: 10, approxMs: 10 * MS_DAY },
	{ days: 15, approxMs: 15 * MS_DAY },
	{ months: 1, approxMs: MS_MONTH },
	{ months: 2, approxMs: 2 * MS_MONTH },
	{ months: 3, approxMs: 3 * MS_MONTH },
	{ months: 6, approxMs: 6 * MS_MONTH },
	{ years: 1, approxMs: MS_YEAR },
	{ years: 2, approxMs: 2 * MS_YEAR },
	{ years: 5, approxMs: 5 * MS_YEAR },
	{ years: 10, approxMs: 10 * MS_YEAR },
	{ years: 20, approxMs: 20 * MS_YEAR },
	{ years: 50, approxMs: 50 * MS_YEAR },
	{ years: 100, approxMs: 100 * MS_YEAR },
	{ years: 200, approxMs: 200 * MS_YEAR },
];

/** 刻度数量上限（超过则加大档位）。 */
export const MAX_TICKS = 14;

/** day 模式专用上限：最粗只允许到「每天」(days:1)，更粗的 days:2/5/months/years 不入选，
 * 保证 day 模式默认按每一天显示刻度，缩放变小跨度时仍可在小时 / 分钟粒度细化。 */
export const DAY_STEP: TickStep = { days: 1, approxMs: MS_DAY };

/** 各粒度档位标签的最小像素间距（避免文字重叠；时/分标签较长需更宽）。 */
function minTickPx(step: TickStep): number {
	if (step.years !== undefined) return 40;
	if (step.months !== undefined) return 56;
	if (step.days !== undefined) return 66; // 标签形如 "2026-08-06"（含年份）
	return 84; // 时 / 分：标签形如 "08-06 14:00"
}

/**
 * 选择合适的刻度档位：使可见刻度数不超过 MAX_TICKS，且像素间距不小于该档位最小宽度；
 * 档位不够用（范围极大或像素不足）时返回候选池中最粗档位（maxStep 或全局最大）。
 * @param spanMs 当前视口的时间跨度（毫秒）。
 * @param pxPerMs 像素 / 毫秒（视口宽度除以跨度得到）。
 * @param maxStep 可选「最粗允许」上限（按 approxMs 比较）。传入后仅从
 *   approxMs <= maxStep.approxMs 的档位中选择，用于 day 模式锁定日粒度下限。
 */
export function selectTickStep(spanMs: number, pxPerMs: number, maxStep?: TickStep): TickStep {
	const steps = maxStep ? TICK_STEPS.filter((s) => s.approxMs <= maxStep.approxMs) : TICK_STEPS;
	for (const step of steps) {
		if (spanMs / step.approxMs <= MAX_TICKS && step.approxMs * pxPerMs >= minTickPx(step)) {
			return step;
		}
	}
	return steps[steps.length - 1] ?? { days: 1, approxMs: MS_DAY };
}

/**
 * 计算时间范围：覆盖全部条目的最小~最大时间，两侧各留 `paddingRatio` 边距。
 * 全部条目为单点（零宽）时扩展为至少 1 天；无有效时间时兜底为当前月前后一个月。
 */
export function computeRange(
	items: ReadonlyArray<{ start?: Date | null; end?: Date | null }>,
	paddingRatio = 0.05,
): { start: number; end: number } {
	let min = Infinity;
	let max = -Infinity;
	for (const item of items) {
		const start = item.start?.getTime();
		const end = item.end?.getTime();
		if (typeof start === 'number' && Number.isFinite(start)) min = Math.min(min, start);
		if (typeof end === 'number' && Number.isFinite(end)) max = Math.max(max, end);
	}
	if (!Number.isFinite(min) || !Number.isFinite(max)) {
		const now = Date.now();
		return { start: now - MS_MONTH, end: now + MS_MONTH };
	}
	let span = max - min;
	if (span <= 0) span = MS_DAY; // 全部单点 / 零宽
	// 边距：窄范围（含单点）扩展为至少 1 天整（保证 day 模式有刻度）；
	// 宽范围按比例留 5%，且不少于 1 小时（防止比例过小时刻度贴边）。
	const pad = span <= MS_DAY ? MS_DAY / 2 : Math.max(span * paddingRatio, MS_HOUR);
	return { start: min - pad, end: max + pad };
}

/** 将时间对齐到所在刻度区间的起点（向下取整）。 */
export function alignTickDown(step: TickStep, ms: number): number {
	const d = new Date(ms);
	if (step.years !== undefined) {
		const y = Math.floor(d.getFullYear() / step.years) * step.years;
		return new Date(y, 0, 1).getTime();
	}
	if (step.months !== undefined) {
		const total = d.getFullYear() * 12 + d.getMonth();
		const aligned = Math.floor(total / step.months) * step.months;
		return new Date(Math.floor(aligned / 12), aligned % 12, 1).getTime();
	}
	if (step.days !== undefined) {
		// 从每月 1 日起按 step.days 对齐（跨月自动衔接）。
		const day = Math.floor((d.getDate() - 1) / step.days) * step.days + 1;
		return new Date(d.getFullYear(), d.getMonth(), day).getTime();
	}
	if (step.hours !== undefined) {
		return new Date(
			d.getFullYear(),
			d.getMonth(),
			d.getDate(),
			Math.floor(d.getHours() / step.hours) * step.hours,
		).getTime();
	}
	if (step.minutes !== undefined) {
		return new Date(
			d.getFullYear(),
			d.getMonth(),
			d.getDate(),
			d.getHours(),
			Math.floor(d.getMinutes() / step.minutes) * step.minutes,
		).getTime();
	}
	return ms;
}

/** 从当前刻度推进到下一个刻度。 */
export function nextTick(step: TickStep, ms: number): number {
	const d = new Date(ms);
	if (step.years !== undefined) {
		d.setFullYear(d.getFullYear() + step.years);
		return d.getTime();
	}
	if (step.months !== undefined) {
		d.setMonth(d.getMonth() + step.months);
		return d.getTime();
	}
	if (step.days !== undefined) {
		d.setDate(d.getDate() + step.days);
		return d.getTime();
	}
	// 时钟级：毫秒加法，避免 DST 夏令时漂移。
	if (step.hours !== undefined) return ms + step.hours * MS_HOUR;
	if (step.minutes !== undefined) return ms + step.minutes * MS_MINUTE;
	return ms;
}

/** 刻度标签，按档位粒度自适应：
 * - 年 → "2026"；月 → "2026-08"；日 → "08-06"（元旦带年份）；
 * - 时 → "08-06 14:00"；分 → "08-06 14:30"。 */
export function tickLabel(step: TickStep, ms: number): string {
	const d = new Date(ms);
	const pad = (n: number): string => String(n).padStart(2, '0');
	if (step.years !== undefined) {
		return String(d.getFullYear());
	}
	if (step.months !== undefined) {
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
	}
	if (step.days !== undefined) {
		// 始终带年份：跨年浏览时用户能明确日期属于哪一年。
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
	}
	const date = `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
	if (step.hours !== undefined) {
		return `${date} ${pad(d.getHours())}:00`;
	}
	return `${date} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 枚举区间 [startMs, endMs] 内全部刻度（起点向下对齐），供渲染与测试。 */
export interface Tick {
	ms: number;
	label: string;
}

export function enumerateTicks(step: TickStep, startMs: number, endMs: number): Tick[] {
	const ticks: Tick[] = [];
	for (let t = alignTickDown(step, startMs); t <= endMs; t = nextTick(step, t)) {
		ticks.push({ ms: t, label: tickLabel(step, t) });
	}
	return ticks;
}

/** 各显示模式的默认「每屏时间跨度」（缩放基准，zoom=1 时）。 */
export function baseSpanForMode(mode: DisplayMode): number {
	if (mode === 'year') return 10 * MS_YEAR;
	if (mode === 'month') return 12 * MS_MONTH;
	return 31 * MS_DAY;
}
