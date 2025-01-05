type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  requestId?: string;
  method?: string;
  endpoint?: string;
  status?: number;
  duration_ms?: number;
  error?: any;
  data?: any;
  [key: string]: any;
}

export class Logger {
  private static readonly LOG_LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
  };

  private static readonly CURRENT_LOG_LEVEL: LogLevel = 'debug';

  private static shouldLog(level: LogLevel): boolean {
    return this.LOG_LEVELS[level] >= this.LOG_LEVELS[this.CURRENT_LOG_LEVEL];
  }

  private static formatError(error: any): any {
    if (error instanceof Error) {
      return {
        message: error.message,
        stack: error.stack,
        name: error.name
      };
    }
    return error;
  }

  private static formatContext(context: LogContext = {}): LogContext {
    const formattedContext = { ...context };
    
    if (formattedContext.error) {
      formattedContext.error = this.formatError(formattedContext.error);
    }

    return formattedContext;
  }

  static debug(message: string, context: LogContext = {}): void {
    if (this.shouldLog('debug')) {
      console.debug(JSON.stringify({
        level: 'debug',
        message,
        timestamp: new Date().toISOString(),
        ...this.formatContext(context)
      }));
    }
  }

  static info(message: string, context: LogContext = {}): void {
    if (this.shouldLog('info')) {
      console.info(JSON.stringify({
        level: 'info',
        message,
        timestamp: new Date().toISOString(),
        ...this.formatContext(context)
      }));
    }
  }

  static warn(message: string, context: LogContext = {}): void {
    if (this.shouldLog('warn')) {
      console.warn(JSON.stringify({
        level: 'warn',
        message,
        timestamp: new Date().toISOString(),
        ...this.formatContext(context)
      }));
    }
  }

  static error(message: string, context: LogContext = {}): void {
    if (this.shouldLog('error')) {
      console.error(JSON.stringify({
        level: 'error',
        message,
        timestamp: new Date().toISOString(),
        ...this.formatContext(context)
      }));
    }
  }

  public static request(context: LogContext = {}) {
    const { method = '', endpoint = '', status = 0, duration_ms = 0, ...rest } = context;
    this.info(`${method} ${endpoint} ${status} ${duration_ms}ms`, rest);
  }
}
