/**
 * Telegram Bot Service — Handles sending photos via official Telegram Bot API sendPhoto method
 */

class TelegramService {
  constructor(options = {}) {
    this.customFetch = options.fetch || null;
  }

  /**
   * Returns sanitized bot credentials from environment variables.
   * Strips accidental whitespace, surrounding quotes, and URL/bot prefixes.
   */
  getCredentials() {
    const rawToken = process.env.TELEGRAM_BOT_TOKEN || '';
    const rawChatId = process.env.TELEGRAM_CHAT_ID || '';

    // Strip whitespace and surrounding single or double quotes
    let botToken = String(rawToken).trim().replace(/^["']|["']$/g, '');
    const chatId = String(rawChatId).trim().replace(/^["']|["']$/g, '');

    // Normalize: remove accidental "bot" prefix or full Telegram URL if user pasted the entire webhook/API URL
    botToken = botToken
      .replace(/^https?:\/\/api\.telegram\.org\/bot/i, '')
      .replace(/^bot/i, '');

    return { botToken, chatId };
  }

  /**
   * Validates Telegram credentials and returns detailed diagnostic information
   * without exposing secrets.
   */
  validateConfiguration() {
    const { botToken, chatId } = this.getCredentials();
    const missing = [];

    if (!botToken) missing.push('TELEGRAM_BOT_TOKEN');
    if (!chatId) missing.push('TELEGRAM_CHAT_ID');

    if (missing.length > 0) {
      return {
        configured: false,
        reason: `Missing required environment variable(s): ${missing.join(', ')}`
      };
    }

    const isPlaceholder = (
      botToken.includes('example') ||
      botToken.includes('Placeholder') ||
      botToken === 'replace_with_your_telegram_bot_token'
    );

    if (isPlaceholder) {
      return {
        configured: false,
        reason: 'TELEGRAM_BOT_TOKEN is set to a placeholder value'
      };
    }

    // Standard Telegram Bot token pattern: <bot_id>:<alphanumeric_auth_token>
    if (!/^\d+:[A-Za-z0-9_-]+$/.test(botToken)) {
      return {
        configured: false,
        reason: 'TELEGRAM_BOT_TOKEN format is invalid (must be in format: 123456789:ABCdefGHI...)'
      };
    }

    return {
      configured: true,
      botToken,
      chatId
    };
  }

  /**
   * Verifies if Telegram configuration is present and valid
   */
  isConfigured() {
    return this.validateConfiguration().configured;
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
    const check = this.validateConfiguration();

    if (!check.configured) {
      const err = new Error(`Telegram Bot is not configured: ${check.reason}. Please set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in the backend environment variables.`);
      err.code = 'TELEGRAM_NOT_CONFIGURED';
      err.statusCode = 503;
      throw err;
    }

    const { botToken, chatId } = check;
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

  /**
   * Sends a non-sensitive text notification to the configured Telegram chat.
   * Used exclusively for awareness simulation telemetry (e.g. demo button clicked, simulation completed).
   *
   * @param {Object} params
   * @param {string} params.text - Formatted HTML message text
   * @returns {Promise<{ ok: boolean, messageId?: number }>}
   */
  async sendMessage({ text }) {
    const check = this.validateConfiguration();

    if (!check.configured) {
      const err = new Error(`Telegram Bot is not configured: ${check.reason}.`);
      err.code = 'TELEGRAM_NOT_CONFIGURED';
      err.statusCode = 503;
      throw err;
    }

    const { botToken, chatId } = check;
    const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const fetchFn = this.customFetch || globalThis.fetch;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetchFn(telegramUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: text,
          parse_mode: 'HTML',
          disable_web_page_preview: true
        }),
        signal: controller.signal
      });

      clearTimeout(timeout);
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.ok) {
        const errorDesc = data.description || `HTTP ${response.status} from Telegram`;
        console.error('[TelegramService] Telegram sendMessage error:', errorDesc);
        const error = new Error(`Telegram delivery failed: ${errorDesc}`);
        error.statusCode = response.status === 429 ? 429 : 502;
        throw error;
      }

      return {
        ok: true,
        messageId: data.result ? data.result.message_id : null
      };
    } catch (err) {
      clearTimeout(timeout);
      if (err.name === 'AbortError') {
        const timeoutErr = new Error('Telegram API request timed out after 10 seconds.');
        timeoutErr.statusCode = 504;
        throw timeoutErr;
      }
      if (err.statusCode) throw err;
      const networkErr = new Error('Could not connect to Telegram Bot API service.');
      networkErr.statusCode = 502;
      throw networkErr;
    }
  }
}

module.exports = new TelegramService();
module.exports.TelegramService = TelegramService;

