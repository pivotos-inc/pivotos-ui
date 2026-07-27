/**
 * 认证信息持有器：core 不感知 Pinia/localStorage，
 * 由宿主应用在初始化时注册读取/清理函数。
 */

/** 读取当前 Token（无则返回空串） */
export type TokenGetter = () => string;
/** 401 时由 core 回调（宿主负责清登录态并跳登录页） */
export type UnauthorizedHandler = () => void;

let tokenGetter: TokenGetter = () => '';
let unauthorizedHandler: UnauthorizedHandler = () => {};

export function registerTokenGetter(getter: TokenGetter): void {
  tokenGetter = getter;
}

export function getToken(): string {
  return tokenGetter();
}

export function registerUnauthorizedHandler(handler: UnauthorizedHandler): void {
  unauthorizedHandler = handler;
}

export function handleUnauthorized(): void {
  unauthorizedHandler();
}
