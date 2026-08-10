import type { PostQuery, PostSaveRequest, PostVO } from '@pivotos/types';
import { request } from '../request';

const BASE = '/system/post';

/** 岗位列表 */
export function listPosts(query?: PostQuery): Promise<PostVO[]> {
  return request.get<unknown, PostVO[]>(`${BASE}/list`, {
    params: Object.fromEntries(
      Object.entries(query ?? {}).filter(([, v]) => v !== '' && v !== undefined && v !== null),
    ),
  });
}

/** 岗位详情 */
export function getPost(id: string): Promise<PostVO> {
  return request.get<unknown, PostVO>(`${BASE}/${id}`);
}

/** 新增岗位 */
export function createPost(body: PostSaveRequest): Promise<string> {
  return request.post<unknown, string>(BASE, body);
}

/** 修改岗位 */
export function updatePost(body: PostSaveRequest): Promise<void> {
  return request.put<unknown, void>(BASE, body);
}

/** 删除岗位 */
export function deletePost(id: string): Promise<void> {
  return request.delete<unknown, void>(`${BASE}/${id}`);
}
