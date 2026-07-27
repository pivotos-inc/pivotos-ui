/** UserSelect 选项（用户 ID 为雪花 string） */
export interface UserSelectOption {
  /** 用户 ID */
  value: string;
  /** 显示名（如 张三 / zhangsan） */
  label: string;
  disabled?: boolean;
}
