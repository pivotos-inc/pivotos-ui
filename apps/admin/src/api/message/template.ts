import type { PageResult, TemplateQuery, TemplateSaveRequest, TemplateVO } from '@pivotos/types';
import { request } from '../request';

/** 模板详情 */
export function getTemplate(id: string): Promise<TemplateVO> {
  return request.get<unknown, TemplateVO>(`/message/template/${id}`);
}

/** 新增模板 */
export function createTemplate(body: TemplateSaveRequest): Promise<string> {
  return request.post<unknown, string>('/message/template', body);
}

/** 修改模板 */
export function updateTemplate(body: TemplateSaveRequest): Promise<void> {
  return request.put<unknown, void>('/message/template', body);
}

/** 删除模板 */
export function deleteTemplate(id: string): Promise<void> {
  return request.delete<unknown, void>(`/message/template/${id}`);
}

/** 模板全量（发送消息时下拉选择用，取正常状态前 100 条） */
export function listTemplates(): Promise<PageResult<TemplateVO>> {
  return request.get<unknown, PageResult<TemplateVO>>('/message/template/page', {
    params: { pageNum: 1, pageSize: 100, status: 0 } satisfies TemplateQuery,
  });
}
