/** 部门树节点（对齐后端 DeptVO 树形结构，雪花 ID 为 string） */
export interface DeptTreeNode {
  id: string;
  /** 显示名 */
  name: string;
  /** 状态等业务字段可自由扩展 */
  [key: string]: unknown;
  children?: DeptTreeNode[];
}
