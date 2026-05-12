// 飞书日历 API 类型定义

/** 飞书日程时间 */
export interface FeishuTimeInfo {
  date?: string;       // 全天日程时的日期 (YYYY-MM-DD)
  timestamp?: string;  // 非全天日程时的 Unix 秒级时间戳
  timezone?: string;   // 时区，如 "Asia/Shanghai"
}

/** 飞书日程 */
export interface FeishuEvent {
  event_id: string;
  summary: string;
  description?: string;
  start_time: FeishuTimeInfo;
  end_time: FeishuTimeInfo;
  status?: string;
  is_exception?: boolean;
  event_organizer_calendar_id?: string;
}

/** 列出日程的响应 */
export interface ListEventsResponse {
  code: number;
  msg: string;
  data?: {
    items: FeishuEvent[];
    has_more: boolean;
    page_token?: string;
  };
}

/** 创建日程的请求体 */
export interface CreateEventBody {
  summary: string;
  description?: string;
  start_time: FeishuTimeInfo;
  end_time: FeishuTimeInfo;
}

/** 创建日程的响应 */
export interface CreateEventResponse {
  code: number;
  msg: string;
  data?: {
    event: FeishuEvent;
  };
}
