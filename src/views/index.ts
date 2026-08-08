/**
 * 视图模块统一出口：Timeline ItemView / Base 视图注册与打开入口。
 */
export {
	VIEW_TYPE_TIMELINE,
	TimelineView,
	registerTimelineView,
} from './timeline-view';
export { openTimelineView } from './open';
export {
	BASES_VIEW_TYPE,
	TimelineBasesView,
	timelineBaseViewOptions,
} from './timeline-base-view';
