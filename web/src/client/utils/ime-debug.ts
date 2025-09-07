/**
 * IME Debug Utilities
 *
 * Helper functions for debugging IME input issues
 * These are exposed to window.imeDebug for console debugging
 */

export interface IMEDebugInfo {
  inputExists: boolean;
  inputElement: HTMLInputElement | null;
  isConnected: boolean;
  isFocused: boolean;
  value: string;
  isComposing: boolean;
  styles: {
    position: string;
    opacity: string;
    visibility: string;
    display: string;
    zIndex: string;
    left: string;
    bottom: string;
    width: string;
    height: string;
  } | null;
  attributes: Record<string, string>;
  parent: {
    id: string;
    className: string;
    tagName: string;
  } | null;
}

export function getIMEDebugInfo(): IMEDebugInfo {
  const input = document.getElementById('vibe-desktop-ime-input') as HTMLInputElement;

  if (!input) {
    return {
      inputExists: false,
      inputElement: null,
      isConnected: false,
      isFocused: false,
      value: '',
      isComposing: false,
      styles: null,
      attributes: {},
      parent: null,
    };
  }

  const styles = window.getComputedStyle(input);
  const attributes: Record<string, string> = {};

  // Collect all attributes
  for (const attr of input.attributes) {
    attributes[attr.name] = attr.value;
  }

  return {
    inputExists: true,
    inputElement: input,
    isConnected: input.isConnected,
    isFocused: document.activeElement === input,
    value: input.value,
    isComposing: document.body.getAttribute('data-ime-composing') === 'true',
    styles: {
      position: styles.position,
      opacity: styles.opacity,
      visibility: styles.visibility,
      display: styles.display,
      zIndex: styles.zIndex,
      left: styles.left,
      bottom: styles.bottom,
      width: styles.width,
      height: styles.height,
    },
    attributes,
    parent: input.parentElement
      ? {
          id: input.parentElement.id,
          className: input.parentElement.className,
          tagName: input.parentElement.tagName,
        }
      : null,
  };
}

export function focusIMEInput(): boolean {
  const input = document.getElementById('vibe-desktop-ime-input') as HTMLInputElement;
  if (input) {
    input.focus();
    console.log('✅ IME input focused');
    return true;
  }
  console.log('❌ IME input not found');
  return false;
}

export function testIMEComposition(): void {
  const input = document.getElementById('vibe-desktop-ime-input') as HTMLInputElement;
  if (!input) {
    console.log('❌ IME input not found');
    return;
  }

  console.log('🧪 Testing IME composition events...');

  // Create and dispatch composition events
  const compositionStart = new CompositionEvent('compositionstart', {
    bubbles: true,
    cancelable: true,
    data: '',
  });

  const compositionUpdate = new CompositionEvent('compositionupdate', {
    bubbles: true,
    cancelable: true,
    data: '你好',
  });

  const compositionEnd = new CompositionEvent('compositionend', {
    bubbles: true,
    cancelable: true,
    data: '你好',
  });

  input.dispatchEvent(compositionStart);
  console.log('📤 Dispatched compositionstart');

  setTimeout(() => {
    input.dispatchEvent(compositionUpdate);
    console.log('📤 Dispatched compositionupdate with "你好"');

    setTimeout(() => {
      input.dispatchEvent(compositionEnd);
      console.log('📤 Dispatched compositionend with "你好"');
    }, 100);
  }, 100);
}

// Expose to window for debugging
if (typeof window !== 'undefined') {
  (window as any).imeDebug = {
    getInfo: getIMEDebugInfo,
    focus: focusIMEInput,
    testComposition: testIMEComposition,
  };

  console.log(`
🔍 IME Debug Tools Available:
- imeDebug.getInfo() - Get current IME input state
- imeDebug.focus() - Focus the IME input
- imeDebug.testComposition() - Test IME composition events
  `);
}
