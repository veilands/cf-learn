type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogMessage {
  level: LogLevel;
  message: string;
  timestamp: string;
  data?: any;
  error?: Error;
}

class Logger {
  private static formatError(error: Error): any {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: error.cause
    };
  }

  private static log(level: LogLevel, message: string, data?: any, error?: Error) {
    const logMessage: LogMessage = {
      level,
      message,
      timestamp: new Date().toISOString(),
      data: data,
      ...(error && { error: this.formatError(error) })
    };

    // In development, pretty print the log message
    if (process.env.NODE_ENV === 'development') {
      console.log(JSON.stringify(logMessage, null, 2));
    } else {
      // In production, single line for better log aggregation
      console.log(JSON.stringify(logMessage));
    }
  }

  static debug(message: string, data?: any) {
    this.log('debug', message, data);
  }

  static info(message: string, data?: any) {
    this.log('info', message, data);
  }

  static warn(message: string, data?: any, error?: Error) {
    this.log('warn', message, data, error);
  }

  static error(message: string, error?: Error, data?: any) {
    this.log('error', message, data, error);
  }

  static request(method: string, url: string, status: number, duration: number, data?: any) {
    this.info('API Request', {
      method,
      url,
      status,
      duration_ms: duration,
      ...data
    });
  }
}

export default Logger;
