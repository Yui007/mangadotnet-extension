export class ApiHttpError extends Error {
  readonly status: number;
  readonly retryable: boolean;
  readonly url: string;

  constructor(url: string, status: number, message = `MangaDotNet API request failed with HTTP ${status}`) {
    super(message);
    this.name = 'ApiHttpError';
    this.url = url;
    this.status = status;
    this.retryable = status === 403 || status === 429 || status >= 500;
  }
}

export class ParseError extends Error {
  readonly retryable = false;

  constructor(message: string) {
    super(message);
    this.name = 'ParseError';
  }
}
