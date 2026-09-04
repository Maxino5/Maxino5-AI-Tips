/**
 * Posts a message to a Telegram channel using Telegram's official, free Bot
 * API — genuinely automatable (unlike WhatsApp Channels, which have no
 * public API at all as of this writing). Needs two env vars:
 *
 *   TELEGRAM_BOT_TOKEN — from @BotFather in Telegram
 *   TELEGRAM_CHAT_ID   — the channel's @username (e.g. "@maxaitips") or
 *                        its numeric chat ID, once the bot is an admin of it
 */
export async function sendTelegramMessage(text: string): Promise<{ ok: boolean; error?: string }> {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  const chatId = process.env["TELEGRAM_CHAT_ID"];
  if (!token || !chatId) {
    return { ok: false, error: "TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set" };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: false,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `Telegram API ${res.status}: ${body.slice(0, 300)}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
