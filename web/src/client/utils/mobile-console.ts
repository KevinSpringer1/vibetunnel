/**
 * Mobile Console Logger
 *
 * A simple in-page console display for debugging on mobile devices
 * where developer tools are not easily accessible
 */

export class MobileConsole {
  private container: HTMLDivElement;
  private logContainer: HTMLDivElement;
  private isMinimized = false;
  private logs: string[] = [];
  private maxLogs = 100;

  constructor() {
    this.container = this.createContainer();
    this.logContainer = this.createLogContainer();
    this.container.appendChild(this.createHeader());
    this.container.appendChild(this.logContainer);
    document.body.appendChild(this.container);

    // Intercept console methods
    this.interceptConsole();
  }

  private createContainer(): HTMLDivElement {
    const container = document.createElement('div');
    container.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 90%;
      max-width: 400px;
      max-height: 300px;
      background: rgba(0, 0, 0, 0.9);
      border: 1px solid #666;
      border-radius: 8px;
      z-index: 999999;
      font-family: monospace;
      font-size: 11px;
      color: #fff;
      display: flex;
      flex-direction: column;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    `;
    return container;
  }

  private createHeader(): HTMLDivElement {
    const header = document.createElement('div');
    header.style.cssText = `
      padding: 8px;
      background: rgba(30, 30, 30, 0.9);
      border-bottom: 1px solid #444;
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: move;
      user-select: none;
    `;

    const title = document.createElement('span');
    title.textContent = '📱 Console';
    title.style.fontWeight = 'bold';

    const buttons = document.createElement('div');
    buttons.style.cssText = 'display: flex; gap: 8px;';

    // Clear button
    const clearBtn = document.createElement('button');
    clearBtn.textContent = 'Clear';
    clearBtn.style.cssText = `
      padding: 2px 8px;
      background: #444;
      border: 1px solid #666;
      color: #fff;
      border-radius: 4px;
      cursor: pointer;
      font-size: 10px;
    `;
    clearBtn.onclick = () => this.clear();

    // Minimize button
    const minBtn = document.createElement('button');
    minBtn.textContent = '−';
    minBtn.style.cssText = clearBtn.style.cssText;
    minBtn.onclick = () => this.toggleMinimize();

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.cssText = clearBtn.style.cssText;
    closeBtn.onclick = () => this.close();

    buttons.appendChild(clearBtn);
    buttons.appendChild(minBtn);
    buttons.appendChild(closeBtn);

    header.appendChild(title);
    header.appendChild(buttons);

    // Make draggable
    this.makeDraggable(header);

    return header;
  }

  private createLogContainer(): HTMLDivElement {
    const logContainer = document.createElement('div');
    logContainer.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 8px;
      max-height: 250px;
    `;
    return logContainer;
  }

  private makeDraggable(handle: HTMLElement): void {
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let currentX = 0;
    let currentY = 0;

    handle.addEventListener('mousedown', (e) => {
      isDragging = true;
      startX = e.clientX - currentX;
      startY = e.clientY - currentY;
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      e.preventDefault();
      currentX = e.clientX - startX;
      currentY = e.clientY - startY;
      this.container.style.transform = `translate(${currentX}px, ${currentY}px)`;
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
    });

    // Touch events for mobile
    handle.addEventListener('touchstart', (e) => {
      isDragging = true;
      const touch = e.touches[0];
      startX = touch.clientX - currentX;
      startY = touch.clientY - currentY;
    });

    document.addEventListener('touchmove', (e) => {
      if (!isDragging) return;
      const touch = e.touches[0];
      currentX = touch.clientX - startX;
      currentY = touch.clientY - startY;
      this.container.style.transform = `translate(${currentX}px, ${currentY}px)`;
    });

    document.addEventListener('touchend', () => {
      isDragging = false;
    });
  }

  private interceptConsole(): void {
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    console.log = (...args) => {
      this.addLog('log', args);
      originalLog.apply(console, args);
    };

    console.warn = (...args) => {
      this.addLog('warn', args);
      originalWarn.apply(console, args);
    };

    console.error = (...args) => {
      this.addLog('error', args);
      originalError.apply(console, args);
    };
  }

  private addLog(type: string, args: any[]): void {
    const timestamp = new Date().toTimeString().split(' ')[0];
    const message = args
      .map((arg) => {
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg, null, 2);
          } catch {
            return String(arg);
          }
        }
        return String(arg);
      })
      .join(' ');

    const logEntry = `[${timestamp}] ${message}`;
    this.logs.push(logEntry);

    // Limit number of logs
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Create log element
    const logElement = document.createElement('div');
    logElement.style.cssText = `
      padding: 2px 0;
      border-bottom: 1px solid #222;
      word-break: break-all;
      ${type === 'warn' ? 'color: #ffaa00;' : ''}
      ${type === 'error' ? 'color: #ff4444;' : ''}
    `;

    // Add emoji for specific log types
    const emoji =
      message.includes('📱') ||
      message.includes('🎯') ||
      message.includes('✅') ||
      message.includes('📤') ||
      message.includes('🔄') ||
      message.includes('📦') ||
      message.includes('🔴') ||
      message.includes('🟡') ||
      message.includes('🟢');

    if (emoji) {
      logElement.style.fontWeight = 'bold';
    }

    logElement.textContent = logEntry;
    this.logContainer.appendChild(logElement);

    // Auto-scroll to bottom
    this.logContainer.scrollTop = this.logContainer.scrollHeight;
  }

  private clear(): void {
    this.logs = [];
    this.logContainer.innerHTML = '';
  }

  private toggleMinimize(): void {
    this.isMinimized = !this.isMinimized;
    this.logContainer.style.display = this.isMinimized ? 'none' : 'block';
    this.container.style.maxHeight = this.isMinimized ? 'auto' : '300px';
  }

  private close(): void {
    this.container.remove();
  }

  static init(): void {
    // Only initialize on mobile devices or if debug flag is set
    const isMobileDevice = /iPad|iPhone|iPod|Android/i.test(navigator.userAgent);
    const debugMode = localStorage.getItem('mobileConsole') === 'true';

    if (isMobileDevice || debugMode) {
      new MobileConsole();
      console.log('📱 Mobile console initialized');
    }
  }
}

// Auto-initialize if on mobile
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    MobileConsole.init();
  });
}
