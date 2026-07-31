import type { FilePageQuery, FileRegisterRequest, PageResult, PresignResult, SysFileVO } from '@pivotos/types';
import { request } from './request';

/** 预签名直传地址（PUT） */
export function presign(filename: string): Promise<PresignResult> {
  return request.get<unknown, PresignResult>('/file/presign', { params: { filename } });
}

/**
 * 预签名下载地址（GET，私有桶回显）。
 * sys_user.avatar 落库为完整 fileUrl，MinIO 桶私有直连 403，
 * 展示前用本接口换取限时可访问 URL（与移动端 mine 页同策略）。
 * @param key 对象键，或历史落库的完整 fileUrl（后端统一归一化）
 */
export function presignDownload(key: string): Promise<string> {
  return request.get<unknown, string>('/file/presign-download', { params: { key } });
}

/** 直传完成回调登记（sys_file 元数据落库，S25） */
export function registerFile(body: FileRegisterRequest): Promise<string> {
  return request.post<unknown, string>('/file/register', body);
}

/** 文件元数据分页 */
export function pageFiles(params: FilePageQuery): Promise<PageResult<SysFileVO>> {
  return request.get<unknown, PageResult<SysFileVO>>('/file/page', { params });
}

/** 删除文件（存储对象 + 元数据同删） */
export function deleteFile(id: string): Promise<void> {
  return request.delete<unknown, void>(`/file/${id}`);
}

/**
 * 预签名直传执行器：presign → PUT 直传 → register 登记，返回可访问 fileUrl。
 * 供 FileUpload 组件 upload prop 或页面上传按钮直接使用。
 */
export async function uploadFile(file: File): Promise<string> {
  const sign = await presign(file.name);
  const resp = await fetch(sign.uploadUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
  });
  if (!resp.ok) {
    throw new Error(`上传失败(${resp.status})`);
  }
  await registerFile({
    objectKey: sign.objectKey,
    originalName: file.name,
    fileSize: file.size,
    contentType: file.type || undefined,
  });
  return sign.fileUrl;
}
