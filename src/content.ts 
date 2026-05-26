import { ChatGPT } from '@/providers/chatgpt';
import { Claude } from '@/providers/claude';
import { detectSecrets, sanitize } from '@/engine/patterns';

class PrivacyGateway {
  private provider: any = null;
  private originalTextarea: HTMLTextAreaElement | null = null;
  private detectionWorker: Worker | null = null;
  
  constructor() {
    this.detectProvider();
    this.setupWorker();
    this.injectOverlay();
    this.interceptSend();
  }
  
  detectProvider() {
    const providers = [new ChatGPT(), new Claude()];
    for (const p of providers) {
      if (p.detect()) {
        this.provider = p;
        console.log(`✅ Detected: ${p.name}`);
        return;
      }
    }
    console.log('⚠️ No AI site detected');
  }
  
  setupWorker() {
    // Simple web worker
    const code = `
      self.onmessage = (e) => {
        const { detectSecrets, sanitize } = require('/engine/patterns');
        self.postMessage({
          detections: detectSecrets(e.data.text),
          sanitized: sanitize(e.data.text, 'mask')
        });
      };
    `;
    const blob = new Blob([code], { type: 'application/javascript' });
    this.detectionWorker = new Worker(URL.createObjectURL(blob));
  }
  
  injectOverlay() {
    if (!this.provider) return;
    
    this.originalTextarea = this.provider.getTextarea();
    if (!this.originalTextarea) return;
    
    // Inject overlay
    const overlay = document.createElement('div');
    overlay.id = 'privacy-firewall';
    overlay.innerHTML = `
      <textarea id="secure-input" style="
        width: 100%;
        height: 100%;
        padding: 12px;
        border: 2px solid #ef4444;
        border-radius: 8px;
        font-family: inherit;
        font-size: inherit;
        resize: none;
      " placeholder="🔒 Private Input (Threats: 0)"></textarea>
    `;
    
    this.originalTextarea.style.display = 'none';
    this.originalTextarea.parentElement?.insertBefore(overlay, this.originalTextarea);
    
    // Wire up input
    const secureInput = document.getElementById('secure-input') as HTMLTextAreaElement;
    secureInput.addEventListener('input', (e) => this.handleInput(e));
  }
  
  handleInput(e: Event) {
    const textarea = e.target as HTMLTextAreaElement;
    const text = textarea.value;
    
    const detections = detectSecrets(text);
    const count = detections.length;
    
    textarea.placeholder = `🔒 Private Input (Threats: ${count})`;
    textarea.style.borderColor = count > 0 ? '#ef4444' : '#10b981';
    
    // Update original textarea
    if (this.originalTextarea) {
      this.originalTextarea.value = text;
    }
  }
  
  interceptSend() {
    if (!this.provider) return;
    
    const sendBtn = this.provider.getSendButton();
    if (!sendBtn) return;
    
    sendBtn.addEventListener('click', (e) => {
      const secureInput = document.getElementById('secure-input') as HTMLTextAreaElement;
      const text = secureInput.value;
      
      const sanitized = sanitize(text, 'mask');
      
      if (this.originalTextarea) {
        this.originalTextarea.value = sanitized;
        this.originalTextarea.style.display = 'block';
        document.getElementById('privacy-firewall')?.remove();
      }
    });
  }
}

// Auto-initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new PrivacyGateway());
} else {
  new PrivacyGateway();
}