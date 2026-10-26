# Telegram Bot Integration & Configuration Guide

This guide provides step-by-step instructions to create an official Telegram Bot using BotFather, securely obtain your Bot Token and Chat ID, and configure the Camera Security Demonstration platform.

---

## 1. Prerequisites

- A Telegram account on mobile or desktop.
- Access to the official Telegram BotFather.

---

## 2. Step 1: Create Your Bot with BotFather

1. Open Telegram and search for the verified account **`@BotFather`** (or navigate to [https://t.me/BotFather](https://t.me/BotFather)).
2. Start the conversation by clicking **Start** or sending:
   ```text
   /start
   ```
3. Send the command to register a new bot:
   ```text
   /newbot
   ```
4. Follow the prompts:
   - **Name**: Choose a friendly display name for your bot (e.g. `Security Camera Demo Bot`).
   - **Username**: Choose a unique username ending in `bot` (e.g. `MySecurityCameraDemo_bot`).
5. BotFather will reply with your **Telegram Bot Token**. It looks similar to:
   ```text
   7123456789:AAFlxyz-ExampleBotToken1234567890
   ```
   > [!IMPORTANT]
   > Keep this token secret! Anyone who possesses your bot token can control your bot. Never commit this token to Git or disclose it in public repositories.

---

## 3. Step 2: Start Your Bot (Critical)

Telegram strictly forbids bots from initiating unsolicited private chats with users to prevent spam.

1. Open your newly created bot in Telegram (search for `@YourBotUsername` or click the link provided by BotFather).
2. Click the **Start** button at the bottom of the chat, or send:
   ```text
   /start
   ```
> [!WARNING]
> If you do not send `/start` to your bot first, Telegram will reject all photo submissions with error:
> `403 Forbidden: bot can't initiate conversation with a user`.

---

## 4. Step 3: Find Your Telegram Chat ID

Your `TELEGRAM_CHAT_ID` is your unique numeric account identifier (or a channel/group ID).

### Option A: Using `@userinfobot` (Fastest)
1. In Telegram, search for **`@userinfobot`** (or open [https://t.me/userinfobot](https://t.me/userinfobot)).
2. Click **Start**.
3. The bot will immediately reply with your profile info:
   ```text
   Id: 987654321
   First: Alice
   Username: @alice
   ```
4. Copy the numeric `Id` (e.g. `987654321`). This is your `TELEGRAM_CHAT_ID`.

### Option B: Using Telegram API Directly
1. Send a random text message (e.g. `Hello`) to your new bot.
2. Open your browser and navigate to:
   ```text
   https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates
   ```
3. Look for the JSON response:
   ```json
   {
     "ok": true,
     "result": [
       {
         "message": {
           "chat": {
             "id": 987654321,
             "first_name": "Alice",
             "type": "private"
           }
         }
       }
     ]
   }
   ```
4. The value of `result[0].message.chat.id` is your `TELEGRAM_CHAT_ID`.

---

## 5. Step 4: Configure Backend Environment Variables

In your backend directory, copy `.env.example` to `.env` and populate the values:

```env
TELEGRAM_BOT_TOKEN=7123456789:AAFlxyz-ExampleBotToken1234567890
TELEGRAM_CHAT_ID=987654321
```

---

## 6. Verification and Health Check

1. Start your backend server:
   ```bash
   cd backend
   npm start
   ```
2. When a visitor captures and knowingly submits a demonstration photo, Telegram delivers a message with caption:
   ```text
   🛡️ Camera Security Demonstration
   Session Ref: a1b2c3d4e5f6...
   Label: iPhone Safari Test
   Timestamp: 2026-10-26T07:54:02.188Z

   ✅ Consent: Explicitly captured and submitted by visitor.
   ```
