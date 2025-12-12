import { Configuration, Product } from "@shared/schema";

export interface QueuedTransaction {
  id: string;
  clientID: string;
  config: Configuration;
  products: any[];
  transactionAmount?: string;
  timestamp: string;
  retryCount: number;
}

const QUEUE_KEY = "offline_transaction_queue";
const MAX_RETRIES = 3;

export class OfflineQueue {
  private queue: QueuedTransaction[] = [];
  private isOnline: boolean = navigator.onLine;
  private isProcessing: boolean = false;

  constructor() {
    this.loadQueue();
    this.setupOnlineListener();
  }

  private loadQueue() {
    try {
      const saved = localStorage.getItem(QUEUE_KEY);
      if (saved) {
        this.queue = JSON.parse(saved);
      }
    } catch (error) {
      console.error("Failed to load offline queue", error);
    }
  }

  private saveQueue() {
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(this.queue));
    } catch (error) {
      console.error("Failed to save offline queue", error);
    }
  }

  private setupOnlineListener() {
    window.addEventListener("online", () => {
      this.isOnline = true;
      this.processQueue();
    });

    window.addEventListener("offline", () => {
      this.isOnline = false;
    });
  }

  addTransaction(clientID: string, config: Configuration, products: any[], transactionAmount?: string): string {
    const transaction: QueuedTransaction = {
      id: Date.now().toString(),
      clientID,
      config,
      products,
      transactionAmount,
      timestamp: new Date().toISOString(),
      retryCount: 0,
    };

    this.queue.push(transaction);
    this.saveQueue();

    // Try to process immediately if online
    if (this.isOnline) {
      this.processQueue();
    }

    return transaction.id;
  }

  async processQueue(): Promise<void> {
    if (this.isProcessing || !this.isOnline || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.queue.length > 0 && this.isOnline) {
      const transaction = this.queue[0];

      try {
        const response = await fetch("/api/transaction", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            clientID: transaction.clientID,
            config: transaction.config,
            products: transaction.products,
            transactionAmount: transaction.transactionAmount,
          }),
          credentials: "include",
        });

        if (response.ok) {
          // Success - remove from queue
          this.queue.shift();
          this.saveQueue();
        } else {
          // Failed - increment retry count
          transaction.retryCount++;
          if (transaction.retryCount >= MAX_RETRIES) {
            // Max retries reached - remove from queue
            this.queue.shift();
          }
          this.saveQueue();
          break; // Stop processing on error
        }
      } catch (error) {
        // Network error - increment retry count
        transaction.retryCount++;
        if (transaction.retryCount >= MAX_RETRIES) {
          this.queue.shift();
        }
        this.saveQueue();
        break; // Stop processing on error
      }
    }

    this.isProcessing = false;
  }

  getQueueSize(): number {
    return this.queue.length;
  }

  getQueue(): QueuedTransaction[] {
    return [...this.queue];
  }

  clearQueue(): void {
    this.queue = [];
    this.saveQueue();
  }

  isOnlineStatus(): boolean {
    return this.isOnline;
  }
}

export const offlineQueue = new OfflineQueue();
