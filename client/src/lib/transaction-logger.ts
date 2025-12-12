export interface TransactionLog {
  id: string;
  timestamp: string;
  step: string;
  type: 'request' | 'response' | 'error' | 'info';
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  payload?: any;
  response?: any;
  statusCode?: number;
  errorMessage?: string;
}

const MAX_LOGS = 100; // Keep last 100 logs

// Helper function to get Brasilia timestamp
function getBrasiliaTimestamp(): string {
  const now = new Date();
  
  // Format in Brasilia timezone (America/Sao_Paulo)
  const brasiliaTime = now.toLocaleString('sv-SE', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  // Add milliseconds
  const ms = now.getMilliseconds().toString().padStart(3, '0');
  
  // Format: YYYY-MM-DD HH:mm:ss.SSS (Brasília)
  return `${brasiliaTime.replace(' ', ' ')}.${ms} (Brasília)`;
}

class TransactionLogger {
  private storageKey = 'transaction_logs';

  log(logEntry: Omit<TransactionLog, 'id' | 'timestamp'>): void {
    const logs = this.getLogs();
    
    const newLog: TransactionLog = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: getBrasiliaTimestamp(),
      ...logEntry
    };

    logs.unshift(newLog);

    // Keep only the last MAX_LOGS entries
    if (logs.length > MAX_LOGS) {
      logs.splice(MAX_LOGS);
    }

    try {
      localStorage.setItem(this.storageKey, JSON.stringify(logs));
    } catch (error) {
      console.error('Failed to save transaction logs:', error);
    }
  }

  getLogs(): TransactionLog[] {
    try {
      const logsString = localStorage.getItem(this.storageKey);
      if (!logsString) return [];
      return JSON.parse(logsString);
    } catch (error) {
      console.error('Failed to load transaction logs:', error);
      return [];
    }
  }

  clearLogs(): void {
    localStorage.removeItem(this.storageKey);
  }

  exportLogs(): string {
    const logs = this.getLogs();
    return JSON.stringify(logs, null, 2);
  }

  exportLogsAsText(): string {
    const logs = this.getLogs();
    let text = '=== BEM LINDINHA - TRANSACTION LOGS ===\n\n';
    
    // Reverse logs to show chronological order (oldest first)
    const reversedLogs = [...logs].reverse();
    
    reversedLogs.forEach((log, index) => {
      text += `\n--- Log #${index + 1} ---\n`;
      text += `ID: ${log.id}\n`;
      text += `Timestamp: ${log.timestamp}\n`;
      text += `Step: ${log.step}\n`;
      text += `Type: ${log.type}\n`;
      
      if (log.url) text += `URL: ${log.url}\n`;
      if (log.method) text += `Method: ${log.method}\n`;
      if (log.statusCode) text += `Status Code: ${log.statusCode}\n`;
      
      if (log.headers) {
        text += `Headers:\n${JSON.stringify(log.headers, null, 2)}\n`;
      }
      
      if (log.payload) {
        text += `Payload:\n${JSON.stringify(log.payload, null, 2)}\n`;
      }
      
      if (log.response) {
        text += `Response:\n${JSON.stringify(log.response, null, 2)}\n`;
      }
      
      if (log.errorMessage) {
        text += `Error: ${log.errorMessage}\n`;
      }
      
      text += '\n';
    });
    
    return text;
  }
}

export const transactionLogger = new TransactionLogger();
