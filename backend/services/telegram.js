/**
 * Telegram Bot Service — Handles sending photos via official Telegram Bot API sendPhoto method
 */

class TelegramService {
  constructor(options = {}) {
    this.customFetch = options.fetch || null;
  }

  /**
   * Returns current active bot credentials from environment
   */
  getCredentials() {
    return {
      botToken: process.env.TELEGRAM_BOT_TOKEN,
      chatId: process.env.TELEGRAM_CHAT_ID
    };
  }

  /**
   * Verifies if Telegram configuration is present and valid
   */
  isConfigured() {
    const { botToken, chatId } = this.getCredentials();
    return Boolean(
      botToken &&
      chatId &&
      botToken !== 'replace_with_your_telegram_bot_token' &&
      !botToken.includes('example')
    );
  }

  /**
   * Sends a photo buffer to the configured Telegram chat.
   * 
   * @param {Object} params
   * @param {Buffer} params.photoBuffer - Buffer containing image bytes
   * @param {string} params.filename - Suggested filename (e.g. session-123.jpg)
   * @param {string} params.mimeType - MIME type of the image
   * @param {string} params.sessionId - Session ID reference
   * @param {string} [params.label] - Optional user label
   * @param {string} [params.timestamp] - Submission timestamp
   * @returns {Promise<{ ok: boolean, messageId?: number }>}
   */
  async sendPhoto({ photoBuffer, filename = 'photo.jpg', mimeType = 'image/jpeg', sessionId, label, timestamp }) {
    const { botToken, chatId } = this.getCredentials();

    if (!this.isConfigured()) {
      const err = new Error('Telegram Bot is not configured. Please set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in backend .env');
      err.code = 'TELEGRAM_NOT_CONFIGURED';
      err.statusCode = 503;
      throw err;
    }

    const captionTimestamp = timestamp || new Date().toISOString();
    const formattedCaption = [
      '🛡️ Camera Security Demonstration',
      `Session Ref: ${sessionId ? sessionId.substring(0, 16) : 'Unknown'}`,
      `Label: ${label || 'None'}`,
      `Timestamp: ${captionTimestamp}`,
      '',
      '✅ Consent: Explicitly captured and submitted by visitor.'
    ].join('\n');

    // Prepare multipart FormData
    const formData = new FormData();
    formData.append('chat_id', chatId);
    formData.append('caption', formattedCaption);

    // Create a Blob from buffer for native fetch
    const fileBlob = new Blob([photoBuffer], { type: mimeType });
    formData.append('photo', fileBlob, filename);

    const telegramUrl = `https://api.telegram.org/bot${botToken}/sendPhoto`;
    const fetchFn = this.customFetch || globalThis.fetch;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15 second timeout

    try {
      const response = await fetchFn(telegramUrl, {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });

      clearTimeout(timeout);

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.ok) {
        const errorDesc = data.description || `HTTP ${response.status} from Telegram`;
        console.error('[TelegramService] Telegram API error:', errorDesc);

        const error = new Error(`Telegram delivery failed: ${errorDesc}`);
        error.statusCode = response.status === 429 ? 429 : 502;
        error.telegramDescription = errorDesc;
        throw error;
      }

      return {
        ok: true,
        messageId: data.result ? data.result.message_id : null
      };

    } catch (err) {
      clearTimeout(timeout);

      if (err.name === 'AbortError') {
        const timeoutErr = new Error('Telegram API request timed out after 15 seconds.');
        timeoutErr.statusCode = 504;
        throw timeoutErr;
      }

      // Re-throw if already formatted
      if (err.statusCode) {
        throw err;
      }

      console.error('[TelegramService] Unexpected delivery failure:', err.message);
      const networkErr = new Error('Could not connect to Telegram Bot API service.');
      networkErr.statusCode = 502;
      throw networkErr;
    }
  }
}

module.exports = new TelegramService();
module.exports.TelegramService = TelegramService;
