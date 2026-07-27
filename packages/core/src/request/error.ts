/** 业务异常（R.code !== 0 时抛出） */
export class ServiceError extends Error {
  readonly code: number;
  readonly traceId?: string;

  constructor(code: number, msg: string, traceId?: string) {
    super(msg);
    this.name = 'ServiceError';
    this.code = code;
    this.traceId = traceId;
  }
}

/** 请求被取消（重复提交拦截） */
export class RepeatSubmitError extends Error {
  constructor() {
    super('请勿重复提交');
    this.name = 'RepeatSubmitError';
  }
}
