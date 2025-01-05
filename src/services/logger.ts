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

class Logger {
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

    // Safely handle circular references and large objects
    try {
      JSON.stringify(formattedContext);
    } catch (error) {
      // If JSON.stringify fails, create a new object with safe properties
      const safeContext: LogContext = {
        requestId: formattedContext.requestId,
        method: formattedContext.method,
        endpoint: formattedContext.endpoint,
        status: formattedContext.status,
        duration_ms: formattedContext.duration_ms
      };

      if (formattedContext.error) {
        safeContext.error = this.formatError(formattedContext.error);
      }

      if (formattedContext.data) {
        try {
          safeContext.data = JSON.parse(JSON.stringify(formattedContext.data));
        } catch {
          safeContext.data = '[Complex data structure]';
        }
      }

      return safeContext;
    }

    return formattedContext;
  }

  private static log(level: LogLevel, message: string, context: LogContext = {}) {
    if (!this.shouldLog(level)) {
      return;
    }

    const timestamp = new Date().toISOString();
    const formattedContext = this.formatContext(context);

    try {
      console.log(JSON.stringify({
        timestamp,
        level,
        message,
        ...formattedContext
      }));
    } catch (error) {
      // Fallback logging if JSON.stringify fails
      console.log(JSON.stringify({
        timestamp,
        level,
        message,
        error: 'Failed to stringify log context',
        requestId: context.requestId
      }));
    }
  }

  public static debug(message: string, context: LogContext = {}) {
    this.log('debug', message, context);
  }

  public static info(message: string, context: LogContext = {}) {
    this.log('info', message, context);
  }

  public static warn(message: string, context: LogContext = {}) {
    this.log('warn', message, context);
  }

  public static error(message: string, context: LogContext = {}) {
    this.log('error', message, context);
  }

  public static request(context: LogContext = {}) {
    const { method = '', endpoint = '', status = 0, duration_ms = 0, ...rest } = context;
    this.info(`${method} ${endpoint} ${status} ${duration_ms}ms`, rest);
  }
}

export default Logger;
