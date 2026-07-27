/** 接收人候选用户（业务侧从 UserVO 等映射注入，本包不直接依赖 request） */
export interface UserPickerUser {
  id: string;
  username: string;
  nickname?: string;
}

/** 分页查询入参 */
export interface UserPickerQuery {
  pageNum: number;
  pageSize: number;
  keyword: string;
}

/** 分页结果 */
export interface UserPickerPage {
  list: UserPickerUser[];
  total: number;
}
