/**
 * Desktop IME Input Component
 *
 * A reusable component for handling Input Method Editor (IME) composition
 * on desktop browsers, particularly for CJK (Chinese, Japanese, Korean) text input.
 *
 * This component creates a hidden input element that captures IME composition
 * events and forwards the completed text to a callback function. It's designed
 * specifically for desktop environments where native IME handling is needed.
 */

import { Z_INDEX } from '../utils/constants.js';
import { createLogger } from '../utils/logger.js';
import { TERMINAL_FONT_FAMILY } from '../utils/terminal-constants.js';

const logger = createLogger('ime-input');

export interface DesktopIMEInputOptions {
  /** Container element to append the input to */
  container: HTMLElement;
  /** Callback when text is ready to be sent (after composition ends or regular input) */
  onTextInput: (text: string) => void;
  /** Callback when special keys are pressed (Enter, Backspace, etc.) */
  onSpecialKey?: (key: string) => void;
  /** Optional callback to get cursor position for positioning the input */
  getCursorInfo?: () => { x: number; y: number } | null;
  /** Optional callback to get font size from terminal */
  getFontSize?: () => number;
  /** Whether to auto-focus the input on creation */
  autoFocus?: boolean;
  /** Additional class name for the input element */
  className?: string;
  /** Z-index for the input element */
  zIndex?: number;
}

export class DesktopIMEInput {
  private input: HTMLInputElement;
  private isComposing = false;
  private options: DesktopIMEInputOptions;
  private documentClickHandler: ((e: Event) => void) | null = null;
  private globalPasteHandler: ((e: Event) => void) | null = null;
  private focusRetentionInterval: number | null = null;

  constructor(options: DesktopIMEInputOptions) {
    this.options = options;
    this.input = this.createInput();
    this.setupEventListeners();

    if (options.autoFocus) {
      this.focus();
    }
  }

  private createInput(): HTMLInputElement {
    const input = document.createElement('input');
    input.type = 'text';
    // Position input for proper IME candidate window display
    input.style.position = 'fixed';
    input.style.bottom = '20px'; // Position at bottom of screen for consistent IME display
    input.style.left = '50%';
    input.style.transform = 'translateX(-50%)';
    input.style.width = '300px'; // Wider for better IME compatibility
    input.style.height = '30px';
    // Use terminal font size if available, otherwise default to 16px (prevents zoom on iOS)
    const fontSize = Math.max(this.options.getFontSize?.() || 16, 16);
    input.style.fontSize = `${fontSize}px`;
    input.style.padding = '4px 8px';
    input.style.border = '1px solid rgba(255, 255, 255, 0.1)';
    input.style.borderRadius = '4px';
    input.style.backgroundColor = 'rgba(30, 30, 40, 0.9)';
    input.style.color = '#e2e8f0';
    input.style.zIndex = String(this.options.zIndex || Z_INDEX.IME_INPUT);
    input.style.opacity = '0.01'; // Nearly invisible but still functional
    input.style.visibility = 'visible';
    input.style.pointerEvents = 'auto';
    input.style.fontFamily = TERMINAL_FONT_FAMILY;
    input.style.outline = 'none';
    input.style.caretColor = '#e2e8f0'; // Show cursor for better IME feedback

    logger.log('🎯 IME input created with styles:', {
      position: input.style.position,
      bottom: input.style.bottom,
      opacity: input.style.opacity,
      visibility: input.style.visibility,
      zIndex: input.style.zIndex,
      width: input.style.width,
      height: input.style.height,
    });
    input.autocapitalize = 'off';
    input.setAttribute('autocorrect', 'off');
    input.autocomplete = 'off';
    input.spellcheck = false;

    // Add a unique ID for debugging
    input.id = 'vibe-desktop-ime-input';
    input.setAttribute('data-ime-input', 'true');

    if (this.options.className) {
      input.className = this.options.className;
    }

    this.options.container.appendChild(input);

    // Verify input is in DOM
    setTimeout(() => {
      const foundInput = document.getElementById('vibe-desktop-ime-input');
      logger.log('🔍 IME input DOM check:', {
        found: !!foundInput,
        parent: foundInput?.parentElement?.id || 'no-parent',
        isConnected: foundInput?.isConnected,
        computedStyles: foundInput
          ? {
              display: window.getComputedStyle(foundInput).display,
              visibility: window.getComputedStyle(foundInput).visibility,
              opacity: window.getComputedStyle(foundInput).opacity,
              position: window.getComputedStyle(foundInput).position,
              zIndex: window.getComputedStyle(foundInput).zIndex,
            }
          : null,
      });
    }, 100);

    return input;
  }

  private setupEventListeners(): void {
    // IME composition events
    this.input.addEventListener('compositionstart', this.handleCompositionStart);
    this.input.addEventListener('compositionupdate', this.handleCompositionUpdate);
    this.input.addEventListener('compositionend', this.handleCompositionEnd);
    this.input.addEventListener('input', this.handleInput);
    this.input.addEventListener('keydown', this.handleKeydown);
    this.input.addEventListener('paste', this.handlePaste);

    // Focus tracking
    this.input.addEventListener('focus', this.handleFocus);
    this.input.addEventListener('blur', this.handleBlur);

    // Document click handler for auto-focus
    this.documentClickHandler = (e: Event) => {
      const target = e.target as HTMLElement;
      if (this.options.container.contains(target) || target === this.options.container) {
        this.focus();
      }
    };
    document.addEventListener('click', this.documentClickHandler);

    // Global paste handler for when IME input doesn't have focus
    this.globalPasteHandler = (e: Event) => {
      const pasteEvent = e as ClipboardEvent;
      const target = e.target as HTMLElement;

      // Skip if paste is already handled by the IME input
      if (target === this.input) {
        return;
      }

      // Only handle paste if we're in the session area
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true' ||
        target.closest?.('.monaco-editor') ||
        target.closest?.('[data-keybinding-context]')
      ) {
        return;
      }

      const pastedText = pasteEvent.clipboardData?.getData('text');
      if (pastedText) {
        this.options.onTextInput(pastedText);
        pasteEvent.preventDefault();
      }
    };
    document.addEventListener('paste', this.globalPasteHandler);
  }

  private handleCompositionStart = () => {
    this.isComposing = true;
    document.body.setAttribute('data-ime-composing', 'true');
    // Keep input visible during composition
    this.showInput();
    this.updatePosition();
    logger.log('🔴 IME composition started - isComposing:', this.isComposing);
    logger.log('🔴 Input element state:', {
      value: this.input.value,
      focused: document.activeElement === this.input,
      opacity: this.input.style.opacity,
      position: `${this.input.style.left}, ${this.input.style.bottom}`,
    });
  };

  private handleCompositionUpdate = (e: CompositionEvent) => {
    logger.log('🟡 IME composition update:', {
      data: e.data,
      inputValue: this.input.value,
      isComposing: this.isComposing,
    });
    // Update position during composition as well
    this.updatePosition();
  };

  private handleCompositionEnd = (e: CompositionEvent) => {
    this.isComposing = false;
    document.body.removeAttribute('data-ime-composing');

    const finalText = e.data;
    logger.log('🟢 IME composition ended:', {
      finalText,
      eventData: e.data,
      inputValue: this.input.value,
      willSendText: !!finalText,
    });

    if (finalText) {
      logger.log('🚀 Sending IME text to terminal:', finalText);
      this.options.onTextInput(finalText);
    } else {
      logger.warn('⚠️ IME composition ended with no text');
    }

    this.input.value = '';
    logger.log('🧹 Input cleared after composition');

    // Hide input after composition if not focused
    setTimeout(() => {
      if (document.activeElement !== this.input) {
        this.hideInput();
      }
      this.updatePosition();
    }, 100);
  };

  private handleInput = (e: Event) => {
    const input = e.target as HTMLInputElement;
    const text = input.value;

    logger.log('📝 Input event:', {
      text,
      isComposing: this.isComposing,
      inputType: (e as InputEvent).inputType,
      data: (e as InputEvent).data,
    });

    // Skip if composition is active
    if (this.isComposing) {
      logger.log('⏭️ Skipping input during composition');
      return;
    }

    // Handle regular typing (non-IME)
    if (text) {
      logger.log('📤 Sending regular text to terminal:', text);
      this.options.onTextInput(text);
      input.value = '';
      // Hide input after sending text if not focused
      setTimeout(() => {
        if (document.activeElement !== this.input) {
          this.hideInput();
        }
      }, 100);
    }
  };

  private handleKeydown = (e: KeyboardEvent) => {
    // Handle Cmd+V / Ctrl+V - let browser handle paste naturally
    if ((e.metaKey || e.ctrlKey) && e.key === 'v') {
      return;
    }

    // During IME composition, let the browser handle ALL keys including Enter
    if (this.isComposing) {
      return;
    }

    // Handle special keys when not composing
    if (this.options.onSpecialKey) {
      switch (e.key) {
        case 'Enter':
          if (this.input.value.trim()) {
            // Send the text content and clear input
            e.preventDefault();
            this.options.onTextInput(this.input.value);
            this.input.value = '';
          } else {
            // Send Enter key to terminal only if input is empty
            e.preventDefault();
            this.options.onSpecialKey('enter');
          }
          break;
        case 'Backspace':
          if (!this.input.value) {
            e.preventDefault();
            this.options.onSpecialKey('backspace');
          }
          break;
        case 'Tab':
          e.preventDefault();
          this.options.onSpecialKey(e.shiftKey ? 'shift_tab' : 'tab');
          break;
        case 'Escape':
          e.preventDefault();
          this.options.onSpecialKey('escape');
          break;
        case 'ArrowUp':
          e.preventDefault();
          this.options.onSpecialKey('arrow_up');
          break;
        case 'ArrowDown':
          e.preventDefault();
          this.options.onSpecialKey('arrow_down');
          break;
        case 'ArrowLeft':
          if (!this.input.value) {
            e.preventDefault();
            this.options.onSpecialKey('arrow_left');
          }
          break;
        case 'ArrowRight':
          if (!this.input.value) {
            e.preventDefault();
            this.options.onSpecialKey('arrow_right');
          }
          break;
        case 'Delete':
          e.preventDefault();
          e.stopPropagation();
          this.options.onSpecialKey('delete');
          break;
      }
    }
  };

  private handlePaste = (e: ClipboardEvent) => {
    const pastedText = e.clipboardData?.getData('text');
    if (pastedText) {
      this.options.onTextInput(pastedText);
      this.input.value = '';
      e.preventDefault();
    }
  };

  private handleFocus = () => {
    document.body.setAttribute('data-ime-input-focused', 'true');
    logger.log('IME input focused');

    // Show the input when focused
    this.showInput();

    // Start focus retention to prevent losing focus
    this.startFocusRetention();
  };

  private handleBlur = () => {
    logger.log('IME input blurred');

    // Don't immediately remove focus state - let focus retention handle it
    // This prevents rapid focus/blur cycles from breaking the state
    setTimeout(() => {
      if (document.activeElement !== this.input) {
        document.body.removeAttribute('data-ime-input-focused');
        this.stopFocusRetention();
        // Hide the input when not focused and not composing
        if (!this.isComposing) {
          this.hideInput();
        }
      }
    }, 50);
  };

  private showInput(): void {
    // Make input visible for IME
    this.input.style.opacity = '0.8';
    this.updatePosition();
    logger.log('IME input shown');
  }

  private hideInput(): void {
    // Make input nearly invisible but keep in position for quick access
    this.input.style.opacity = '0.01';
    logger.log('IME input hidden');
  }

  private updatePosition(): void {
    // For desktop IME, we keep the input at bottom center for consistent candidate window positioning
    // This ensures the IME candidate window always appears in a predictable location
    // and doesn't interfere with terminal content

    if (this.options.getCursorInfo) {
      const cursorInfo = this.options.getCursorInfo();
      if (cursorInfo) {
        // Optional: We could position near cursor in the future, but for now
        // bottom center provides the most consistent IME experience
        logger.log(`Cursor info available at x=${cursorInfo.x}, y=${cursorInfo.y}`);
      }
    }

    // Keep at bottom center for consistent IME display
    this.input.style.position = 'fixed';
    this.input.style.bottom = '20px';
    this.input.style.left = '50%';
    this.input.style.transform = 'translateX(-50%)';
    logger.log('IME input positioned at bottom center');
  }

  focus(): void {
    logger.log('🎯 Focus requested on IME input');

    // Ensure input is properly positioned and visible
    this.updatePosition();
    this.showInput();

    // Make input more visible when explicitly focused
    this.input.style.opacity = '0.8';

    // Use immediate focus
    this.input.focus();

    logger.log('🔍 After focus attempt:', {
      activeElement: document.activeElement?.tagName,
      isOurInput: document.activeElement === this.input,
      inputId: this.input.id || 'no-id',
      opacity: this.input.style.opacity,
    });

    // Verify focus worked
    requestAnimationFrame(() => {
      if (document.activeElement !== this.input) {
        logger.warn('⚠️ Focus lost, retrying...');
        requestAnimationFrame(() => {
          if (document.activeElement !== this.input) {
            this.input.focus();
            logger.log('🔄 Retry focus result:', document.activeElement === this.input);
          }
        });
      }
    });
  }

  /**
   * Update the IME input position based on cursor location
   * Can be called externally when cursor moves
   */
  refreshPosition(): void {
    this.updatePosition();
  }

  /**
   * Update the font size of the IME input
   * Should be called when terminal font size changes
   */
  updateFontSize(): void {
    const fontSize = this.options.getFontSize?.() || 14;
    this.input.style.fontSize = `${fontSize}px`;
    logger.log(`Updated IME input font size to ${fontSize}px`);
  }

  blur(): void {
    this.input.blur();
  }

  isFocused(): boolean {
    return document.activeElement === this.input;
  }

  isComposingText(): boolean {
    return this.isComposing;
  }

  private startFocusRetention(): void {
    // Skip focus retention in test environment to avoid infinite loops with fake timers
    if (
      (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') ||
      // Additional check for test environment (vitest/jest globals)
      typeof (globalThis as Record<string, unknown>).beforeEach !== 'undefined'
    ) {
      return;
    }

    // Don't use aggressive focus retention - it interferes with IME
    // Just ensure focus stays during composition
    if (this.focusRetentionInterval) {
      clearInterval(this.focusRetentionInterval);
    }
  }

  private stopFocusRetention(): void {
    if (this.focusRetentionInterval) {
      clearInterval(this.focusRetentionInterval);
      this.focusRetentionInterval = null;
    }
  }

  stopFocusRetentionForTesting(): void {
    this.stopFocusRetention();
  }

  cleanup(): void {
    // Stop focus retention
    this.stopFocusRetention();

    // Remove event listeners
    this.input.removeEventListener('compositionstart', this.handleCompositionStart);
    this.input.removeEventListener('compositionupdate', this.handleCompositionUpdate);
    this.input.removeEventListener('compositionend', this.handleCompositionEnd);
    this.input.removeEventListener('input', this.handleInput);
    this.input.removeEventListener('keydown', this.handleKeydown);
    this.input.removeEventListener('paste', this.handlePaste);
    this.input.removeEventListener('focus', this.handleFocus);
    this.input.removeEventListener('blur', this.handleBlur);

    if (this.documentClickHandler) {
      document.removeEventListener('click', this.documentClickHandler);
      this.documentClickHandler = null;
    }

    if (this.globalPasteHandler) {
      document.removeEventListener('paste', this.globalPasteHandler);
      this.globalPasteHandler = null;
    }

    // Clean up attributes
    document.body.removeAttribute('data-ime-input-focused');
    document.body.removeAttribute('data-ime-composing');

    // Remove input element
    this.input.remove();

    logger.log('IME input cleaned up');
  }
}
