export type LogbookErrorCode = 'INVALID_DATA' | 'SHARD_MISMATCH' | 'DUPLICATE_SHARD' | 'RUN_NOT_FOUND' | 'TEST_NOT_FOUND' | 'NO_DATA' | 'INCOMPLETE' | 'RUN_CONFLICT' | 'SHARD_CONFLICT' | 'STORE_BUSY';

/** Error with a stable machine-readable code. */
export class LogbookError extends Error {
  readonly code: LogbookErrorCode;

  constructor(code: LogbookErrorCode, message: string) {
    super(message);
    this.name = 'LogbookError';
    this.code = code;
  }
}
