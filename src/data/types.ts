/**
 * Timeline 数据层类型定义。
 *
 * 数据层为纯函数模块，不渲染任何 UI；对 Obsidian 的依赖全部为 type-only
 * import（编译后无运行时引用），因此可在 Node 环境中独立测试。
 */
import type { TFile } from 'obsidian';

/**
 * 单个文件在时间轴上的渲染条目。
 * `file` 携带完整定位信息（供 UI 点击跳转、展示路径），`reason` 说明被跳过原因。
 */
export interface TimelineItem {
	/** 来源文件对象。 */
	file: TFile;
	/** 显示用标题（文件 basename，不含扩展名）。 */
	title: string;
	/** 开始时间；status 为 valid 时必有。 */
	start?: Date;
	/** 结束时间；status 为 valid 时必有（单点事件时与 start 相同）。 */
	end?: Date;
	/** valid = 参与渲染；skipped = 被跳过（见 reason）。 */
	status: 'valid' | 'skipped';
	/** 被跳过的原因（缺失字段 / 解析失败 / 时间倒置 / frontmatter 损坏等）。 */
	reason?: string;
}

/** collectMarkdownFiles 目录收集的错误码。 */
export type CollectErrorCode = 'folder-not-found' | 'folder-not-directory';

/** collectMarkdownFiles 的返回值：目录不存在等错误时返回错误码而非抛异常。 */
export interface CollectMarkdownResult {
	/** 是否成功收集到文件列表。 */
	ok: boolean;
	/** ok 为 false 时的错误码。 */
	error?: CollectErrorCode;
	/** 目录下（递归）收集到的全部 Markdown 文件；错误或目录为空时为 []。 */
	files: TFile[];
}

/**
 * 单个文件 frontmatter 的读取结果。
 * - ok=false：frontmatter YAML 解析失败（error 说明原因）；
 * - ok=true 且 data=null：文件没有 frontmatter；
 * - ok=true 且 data 为对象：解析成功（日期值已规范化为本地时间字符串，见 frontmatter.ts）。
 */
export interface FrontmatterRead {
	ok: boolean;
	data?: Record<string, unknown> | null;
	error?: string;
}

/** 读取并解析单个文件 frontmatter 的函数签名（由调用方注入实现）。 */
export type FrontmatterReader = (file: TFile) => Promise<FrontmatterRead>;
