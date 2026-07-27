import type { AxiosInstance, AxiosRequestConfig } from 'axios';
import { getToken } from '../auth/holder';

/**
 * 下载 hook：携带 Token 走 blob，再从 Content-Disposition 解析文件名落盘。
 * （不能用 window.open 裸开 URL,Authorization 头带不上）
 */
export function createUseDownload(request: AxiosInstance) {
  return async function useDownload(
    url: string,
    config?: AxiosRequestConfig,
    fallbackName = 'download',
  ): Promise<void> {
    const response = await request.get(url, {
      ...config,
      raw: true,
      responseType: 'blob',
      headers: { Authorization: getToken(), ...config?.headers },
    });

    const disposition: string = response.headers?.['content-disposition'] ?? '';
    const match = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(disposition);
    const filename = match ? decodeURIComponent(match[1].replace(/"/g, '')) : fallbackName;

    const blobUrl = URL.createObjectURL(response.data as Blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(blobUrl);
  };
}
