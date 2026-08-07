/**
 * 时间值解析（纯函数）。
 *
 * 解析规则（保持一致，禁止抛异常）：
 * - Date 实例：直接使用（先校验有效性）；
 * - 字符串按顺序匹配：
 *   1. ISO 8601 带时区（如 `2026-08-06T20:30:00Z`、`2026-08-06T20:30:00+08:00`）→ 保留时区语义；
 *   2. 本地时间写法 `YYYY-M-D`、`YYYY-M-D[T ]H:mm[:ss]`（分隔符支持 `-` 与 `/`）→
 *      一律按本地时区解释，并校验日历合法性（拦截 `2026-13-45`、`2026-02-30` 等非法日期）；
 * - 其余类型 / 无法解析的值 → 返回 null。
 */

/** ISO 8601 带时区：`T` 分隔 + Z 或 ±HH:mm（含 ±HHmm）。 */
const ISO_WITH_TZ =
	/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/;

/** 本地时间写法：年-月-日[ 时:分[:秒]]，分隔符支持 `-` 或 `/`，时间分隔支持空格或 `T`。 */
const LOCAL_DATE_TIME =
	/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;

/** 判断 Date 是否有效（无效时返回 null）。 */
function validDate(date: Date): Date | null {
	return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * 将字符串按本地时间构造 Date，并校验日历合法性；
 * `2026-13-45`、`2026-02-30`、`25:00` 等非法值返回 null。
 */
function parseLocalDateTime(text: string): Date | null {
	const m = LOCAL_DATE_TIME.exec(text);
	if (m === null) {
		return null;
	}
	const year = Number(m[1]);
	const month = Number(m[2]);
	const day = Number(m[3]);
	const hour = Number(m[4] ?? 0);
	const minute = Number(m[5] ?? 0);
	const second = Number(m[6] ?? 0);
	const date = new Date(year, month - 1, day, hour, minute, second);
	// 校验：Date 会自动进位，若结果与输入不一致则说明输入非法。
	if (
		date.getFullYear() === year &&
		date.getMonth() === month - 1 &&
		date.getDate() === day &&
		date.getHours() === hour &&
		date.getMinutes() === minute &&
		date.getSeconds() === second
	) {
		return date;
	}
	return null;
}

/**
 * 解析 frontmatter 常见的时间值。
 * @param value 待解析值（Date / 字符串；其余类型视为无效）。
 * @returns 解析成功的 Date，无效则返回 null。
 */
export function parseDateValue(value: unknown): Date | null {
	if (value instanceof Date) {
		return validDate(value);
	}
	if (typeof value !== 'string') {
		return null;
	}
	const text = value.trim();
	if (text === '') {
		return null;
	}
	if (ISO_WITH_TZ.test(text)) {
		return validDate(new Date(text));
	}
	return parseLocalDateTime(text);
}
