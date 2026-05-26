import { detectSecrets, sanitize } from '../engine/patterns';

self.onmessage = async (event: MessageEvent) => {
  const { text, id, action } = event.data;
  
  try {
    const result = action === 'detect' 
      ? detectSecrets(text)
      : sanitize(text, 'mask');
    
    self.postMessage({ id, result, success: true });
  } catch (error) {
    self.postMessage({ id, error: error.message, success: false });
  }
};