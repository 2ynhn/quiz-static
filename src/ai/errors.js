// AI 호출 공통 에러. type: invalid_key | insufficient_quota | rate_limit | network | parse
export class AiError extends Error {
  constructor(type, message) {
    super(message);
    this.name = 'AiError';
    this.type = type;
  }
}
