export interface ApiResponsePayload<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  meta?: Record<string, unknown>;
  errors?: unknown[];
}

export class ApiResponse<T = unknown> {
  public readonly success: boolean = true;
  public readonly message: string;
  public readonly data?: T;
  public readonly meta?: object;

  constructor(
    message: string = 'Success',
    data?: T,
    meta?: object,
  ) {
    this.message = message;
    this.data = data;
    this.meta = meta;
  }
}