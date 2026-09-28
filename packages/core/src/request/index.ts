import axios, {
  AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
} from 'axios';
import { SUCCESS_CODE, type R } from '@pivotos/types';
import { getToken, handleUnauthorized } from '../auth/holder';
import { RepeatSubmitError, ServiceError } from './error';

/**
 * 模块增强：把 PivotOS 自定义请求配置项挂到 axios 原生类型上，
 * 这样业务侧 request.get(url, { silent: true }) 不再报 TS2353。
 */
declare module 'axios' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
  interface AxiosRequestConfig<D = any> {
    /** 跳过 R 包装解析、直接返回 AxiosResponse（如下载流），默认 false */
    raw?: boolean;
    /** 允许重复提交（不拦截在途相同请求），默认 false */
    allowRepeat?: boolean;
    /** 业务/网络失败时静默（不触发全局提示），默认 false */
    silent?: boolean;
  }
}

export type { AxiosRequestConfig as RequestConfig } from 'axios';

export interface CreateRequestOptions {
  baseURL: string;
  timeout?: number;
  /** 业务/网络错误全局提示回调（宿主接 ElMessage） */
  onError?: (msg: string) => void;
  /**
   * 接口加解密拦截器（对接 web Starter）。
   * 预留开关，默认关闭；联调策略：链路通后再开启（见《04》第五节）。
   */
  enableCrypto?: boolean;
}

/** 在途请求指纹表（重复提交拦截） */
const pending = new Map<string, true>();

function fingerprint(config: AxiosRequestConfig): string {
  const { method, url, params, data } = config;
  // 口径（S103 K6）：请求拦截器里 config.data 是序列化前的对象，响应侧 config.data
  // 已被 transformRequest 序列化成字符串——两侧必须统一归一为字符串再比对，
  // 否则在途指纹永远删不掉，相同载荷的二次提交被误拦「请勿重复提交」。
  const dataStr = typeof data === 'string' ? data : JSON.stringify(data ?? {});
  return [method, url, JSON.stringify(params ?? {}), dataStr].join('&');
}

export function createRequest(options: CreateRequestOptions): AxiosInstance {
  const { baseURL, timeout = 10_000, onError } = options;

  const instance = axios.create({ baseURL, timeout });

  // —— 请求拦截：Token + 重复提交拦截（加密拦截器预留）——
  instance.interceptors.request.use((config) => {
    const token = getToken();
    if (token) {
      // 后端 token-name = Authorization，未配置 token-prefix，发裸值
      config.headers.set('Authorization', token);
    }

    const mutating = ['post', 'put', 'delete'].includes((config.method ?? '').toLowerCase());
    if (mutating && !config.allowRepeat) {
      const key = fingerprint(config);
      if (pending.has(key)) {
        return Promise.reject(new RepeatSubmitError());
      }
      pending.set(key, true);
    }

    // TODO(接口加密): enableCrypto 开启时在此接入加解密拦截器（对接 starter-web）

    return config;
  });

  // —— 响应成功处理：R 解包 + 错误码统一处理 ——
  // 注意：这里故意把 R.data 载荷直接返回（业务侧 await 拿到的就是 T），
  // 返回值不再是 AxiosResponse,axios 类型层面不允许，注册时用断言收窄。
  const onFulfilled = (response: AxiosResponse): unknown => {
    pending.delete(fingerprint(response.config));

    // raw: 返回完整 AxiosResponse（如 useDownload 需读取 headers）
    if (response.config.raw) {
      return response;
    }
    // blob 响应：返回 Blob 本体（saveBlob / URL.createObjectURL 操作）
    if (response.config.responseType === 'blob') {
      return response.data;
    }

    const body = response.data as R;
    if (body.code === SUCCESS_CODE) {
      return body.data;
    }

    // 401 / 1002（GlobalErrorCode.UNAUTHORIZED）：登录失效
    if (body.code === 401 || body.code === 1002) {
      handleUnauthorized();
    }
    if (!response.config.silent) onError?.(body.msg || '请求失败');
    return Promise.reject(new ServiceError(body.code, body.msg, body.traceId));
  };

  const onRejected = (error: AxiosError<R>): Promise<never> => {
    if (error.config) pending.delete(fingerprint(error.config));

    if (error instanceof RepeatSubmitError) {
      return Promise.reject(error); // 重复提交：静默，不提示
    }

    let msg: string;
    if (error.response) {
      // HTTP 层错误：后端全局异常处理器也返回 R 体，优先取其中 msg
      msg = error.response.data?.msg || `请求错误(${error.response.status})`;
      if (error.response.status === 401) handleUnauthorized();
    } else if (error.code === 'ECONNABORTED') {
      msg = '请求超时，请稍后重试';
    } else {
      msg = '网络异常，请检查网络连接';
    }
    if (!error.config?.silent) onError?.(msg);
    return Promise.reject(new ServiceError(error.response?.status ?? -1, msg));
  };

  instance.interceptors.response.use(
    // 类型断言说明：onFulfilled 实际返回 data 载荷（unknown）而非 AxiosResponse,
    // 这是封装的核心行为；配套地，业务侧用 request.get<unknown, T>() 声明真实返回类型。
    onFulfilled as (value: AxiosResponse) => AxiosResponse,
    onRejected,
  );

  return instance;
}
