export interface TreeNode {
  id: string;
  parentId?: string;
  children?: TreeNode[];
  [key: string]: unknown;
}

/** 扁平列表 → 树（parentId 指向 id;rootPid 为根节点的 parentId，默认 "0"） */
export function listToTree<T extends TreeNode>(list: T[], rootPid = '0'): T[] {
  const map = new Map<string, T & { children: T[] }>();
  const roots: T[] = [];

  list.forEach((item) => map.set(item.id, { ...item, children: [] }));
  map.forEach((node) => {
    if (node.parentId && node.parentId !== rootPid && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node as unknown as T);
    } else {
      roots.push(node as unknown as T);
    }
  });
  return roots;
}
