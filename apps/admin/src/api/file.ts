import { request } from './request';

/**
 * 预签名下载地址（GET，私有桶回显）。
 * sys_user.avatar 落库为完整 fileUrl，MinIO 桶私有直连 403，
 * 展示前用本接口换取限时可访问 URL（与移动端 mine 页同策略）。
 * @param key 对象键，或历史落库的完整 fileUrl（后端统一归一化）
 */
export function presignDownload(key: string): Promise<string> {
  return request.get<unknown, string>('/file/presign-download', { params: { key } });
}
