import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { Bot, InputFile, InlineKeyboard, Keyboard } from "grammy";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const PORT = Number(process.env.PORT) || 3000;
const app = express();

// Enable parsing of JSON bodies with a limit suitable for base64 image receipts
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ limit: "15mb", extended: true }));

// --- CONFIGURATION & PERSISTENCE ---
const SETTINGS_FILE = path.join(process.cwd(), "settings.json");

interface AppSettings {
  cardNumber: string;
  starPrice: number;
  webappUrl: string;
  channelUsername: string;
  reviewsChannel: string;
  conditionsUrl: string;
  supportUsername: string;
  requireBotOrderApproval: boolean;
}

const defaultSettings: AppSettings = {
  cardNumber: "4874 0700 5861 6069",
  starPrice: 0.80,
  webappUrl: process.env.APP_URL || "",
  channelUsername: "@chprrshop",
  reviewsChannel: "@otzivichprr",
  conditionsUrl: "https://t.me/ysloviyapokupki",
  supportUsername: "@chprr",
  requireBotOrderApproval: true,
};

function getSettings(): AppSettings {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = fs.readFileSync(SETTINGS_FILE, "utf-8");
      return { ...defaultSettings, ...JSON.parse(data) };
    }
  } catch (error) {
    console.error("Error reading settings file:", error);
  }
  return defaultSettings;
}

function saveSettings(settings: AppSettings) {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), "utf-8");
  } catch (error) {
    console.error("Error writing settings file:", error);
  }
}

// Global active settings
let settings = getSettings();
// Ensure webappUrl points to this app's URL if empty
if (!settings.webappUrl && process.env.APP_URL) {
  settings.webappUrl = process.env.APP_URL;
  saveSettings(settings);
}

// --- USER SESSIONS ---
interface UserState {
  lang: "ru" | "uk";
  step: "none" | "waiting_custom_stars" | "waiting_username_stars" | "waiting_username_premium" | "waiting_receipt" | "waiting_review" | "waiting_bot_approval";
  orderType?: "stars" | "premium";
  starsAmount?: number;
  premiumKey?: string;
  orderUsername?: string;
  lastMessageId?: number;
  adminAction?: "waiting_card" | "waiting_price" | "waiting_webapp";
}

const userStates = new Map<number, UserState>();

function getOrCreateUser(userId: number): UserState {
  if (!userStates.has(userId)) {
    userStates.set(userId, {
      lang: "ru",
      step: "none",
    });
  }
  return userStates.get(userId)!;
}

// --- BOT INITIALIZATION ---
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID ? Number(process.env.ADMIN_ID) : null;

let bot: Bot | null = null;

if (BOT_TOKEN) {
  bot = new Bot(BOT_TOKEN);
  console.log("🤖 Telegram Bot initialized with Grammy");
} else {
  console.warn("⚠️ BOT_TOKEN is missing in environment. Telegram Bot is disabled.");
}

// Texts dictionary
const TEXTS: Record<string, Record<string, string>> = {
  ru: {
    main_menu: "🏪 <b>chprrshop — главное меню</b>\n\nВыберите нужный раздел:",
    sub_required: "👋 <b>Добро пожаловать в chprrshop!</b>\n\nДля использования бота необходимо подписаться на наш канал.\nТам вы найдёте актуальные предложения, акции и новинки.\n\n⬇️ Нажмите <b>«Подписаться»</b>, а затем <b>«Я подписался»</b>.",
    btn_stars: "⭐️ Звёзды (Обычное меню)",
    btn_premium: "💎 Premium (Обычное меню)",
    btn_reviews: "💬 Отзывы",
    btn_conditions: "📋 Условия покупки",
    btn_channel: "📢 Телеграм канал",
    btn_lang: "🌍 Язык / Мова",
    btn_sub: "📢 Подписаться на канал",
    btn_is_subbed: "✅ Я подписался",
    sub_confirmed: "✅ Подписка подтверждена!",
    sub_not_yet: "❌ Вы ещё не подписаны. Подпишитесь и попробуйте снова.",
    stars_title: "⭐️ <b>Покупка Telegram Stars</b>\n\nВыберите количество звёзд или введите своё:",
    stars_selected: "⭐️ Выбрано: <b>{amount} звёзд — {price} грн</b>\n\nВведите username получателя:",
    stars_custom_prompt: "✏️ Введите желаемое количество звёзд (минимально: 50):\n\n💡 Цена рассчитывается автоматически.",
    stars_min_error: "❗️ Минимальное количество звёзд для заказа — <b>50</b>. Введите корректное число:",
    stars_custom_qty: "⭐️ Количество: <b>{amount} звёзд</b>\n💰 Стоимость: <b>{price} грн</b>\n\nВведите username получателя:",
    username_error: "❗️ <b>Ошибка: Имя должно быть только на английском языке!</b>\n\n⭐️ Выбрано: <b>{amount} звёзд — {price} грн</b>\n\nВведите корректный username получателя:",
    verify_title: "📋 <b>Проверка данных заказа</b>\n\n⭐️ Товар: <b>{item}</b>\n💰 Сумма к оплате: <b>{price} грн</b>\n📩 Получатель: <code>{recipient}</code>\n\nПроверьте правильность данных и нажмите кнопку подтверждения:",
    btn_verify_confirm: "✅ Все верно, заказать",
    btn_verify_change: "🔙 Изменить юзернейм",
    premium_title: "💎 <b>Telegram Premium</b>\n\nВыберите срок подписки:",
    premium_selected: "💎 Выбрано: <b>Telegram Premium {label} — {price} грн</b>\n\nВведите username получателя:",
    premium_username_error: "❗️ <b>Ошибка: Имя должно быть только на английском языке!</b>\n\n💎 Выбрано: <b>Telegram Premium {label} — {price} грн</b>\n\nВведите корректный username получателя:",
    admin_confirmed: "✅ <b>Ваш заказ оформлен!</b>\n\n💳 Для получения товара переведите ровно <b>{price} грн</b> на карту:\n<code>{CARD_NUMBER}</code>\n\n⚠️ <i>Обратите внимание: комиссию за перевод оплачивает покупатель.</i>\n\nПосле оплаты нажмите <b>«Я оплатил»</b> и отправьте скриншот/чек.",
    btn_i_paid: "✅ Я оплатил — отправить чек",
    admin_declined: "❌ <b>Ваш заказ отклонен менеджером</b>\n\n📝 Причина: <code>{reason}</code>\n\n📞 Обратная связь: {SUPPORT_USERNAME}",
    admin_completed: "🎉 <b>Ваш заказ успешно выполнен!</b>\n\nСпасибо, что выбрали нас. Пожалуйста, оставьте отзыв о нашей работе, нажав на кнопку ниже:",
    btn_leave_review: "💬 Оставить отзыв",
    ask_receipt: "📎 <b>Отправьте чек или скриншот оплаты</b>\n\nПрикрепите фото или документ с подтверждением оплаты:",
    receipt_received: "🎉 <b>Чек получен!</b>\n\nМенеджер проверит платёж и доставит товар в ближайшее время.",
    review_prompt: "📝 Напишите ваш отзыв в одном сообщении, и он автоматически опубликуется в нашем канале отзывов:",
    review_thanks: "❤️ <b>Спасибо за ваш отзыв!</b> Он успешно опубликован в канале отзывов.",
    review_error: "❌ Не удалось отправить отзыв в канал. Связывайтесь с администрацией.",
    back: "🔙 Назад",
    bot_order_pending: "⏳ <b>Ваш заказ отправлен на подтверждение администратору.</b>\n\nКак только администратор подтвердит заказ, мы отправим вам реквизиты для оплаты!",
    stars_item: "{amount} Звёзд",
    premium_item: "Telegram Premium {label}",
  },
  uk: {
    main_menu: "🏪 <b>chprrshop — головне меню</b>\n\nОберіть потрібний розділ:",
    sub_required: "👋 <b>Ласкаво просимо до chprrshop!</b>\n\nДля використання бота необхідно підписатися на наш канал.\nТам ви знайдете актуальні пропозиції, акції та новинки.\n\n⬇️ Натисніть <b>«Підписатися»</b>, а потім <b>«Я підписався»</b>.",
    btn_stars: "⭐️ Зірки (Звичайне меню)",
    btn_premium: "💎 Premium (Звичайне меню)",
    btn_reviews: "💬 Відгуки",
    btn_conditions: "📋 Умови замовлення",
    btn_channel: "📢 Телеграм канал",
    btn_lang: "🌍 Мова / Язык",
    btn_sub: "📢 Підписатися на канал",
    btn_is_subbed: "✅ Я підписався",
    sub_confirmed: "✅ Підписку підтверджено!",
    sub_not_yet: "❌ Ви ще не підписані. Підпишіться та спробуйте знову.",
    stars_title: "⭐️ <b>Купівля Telegram Stars</b>\n\nОберіть кількість зірок або введіть свою кількість:",
    stars_selected: "⭐️ Обрано: <b>{amount} зірок — {price} грн</b>\n\nВведіть username отримувача:",
    stars_custom_prompt: "✏️ Введіть бажану кількість зірок (мінімально: 50):\n\n💡 Ціна розраховується автоматично.",
    stars_min_error: "❗️ Мінімальна кількість зірок для замовлення — <b>50</b>. Введіть коректне число:",
    stars_custom_qty: "⭐️ Кількість: <b>{amount} зірок</b>\n💰 Вартість: <b>{price} грн</b>\n\nВведіть username отримувача:",
    username_error: "❗️ <b>Помилка: Ім'я має бути тільки англійською мовою!</b>\n\n⭐️ Обрано: <b>{amount} зірок — {price} грн</b>\n\nВведіть конкретний username отримувача:",
    verify_title: "📋 <b>Перевірка даних замовлення</b>\n\n⭐️ Товар: <b>{item}</b>\n💰 Сума до оплати: <b>{price} грн</b>\n📩 Отримувач: <code>{recipient}</code>\n\nПеревірте правильність даних та натисніть кнопку підтвердження:",
    btn_verify_confirm: "✅ Все правильно, замовити",
    btn_verify_change: "🔙 Змінити юзернейм",
    premium_title: "💎 <b>Telegram Premium</b>\n\nОберіть термін підписки:",
    premium_selected: "💎 Обрано: <b>Telegram Premium {label} — {price} грн</b>\n\nВведіть username отримувача:",
    premium_username_error: "❗️ <b>Помилка: Ім'я має бути тільки англійською мовою!</b>\n\n💎 Обрано: <b>Telegram Premium {label} — {price} грн</b>\n\nВведіть коректний username отримувача:",
    admin_confirmed: "✅ <b>Ваше замовлення оформлено!</b>\n\n💳 Для отримання товару перекажіть рівно <b>{price} грн</b> на картку:\n<code>{CARD_NUMBER}</code>\n\n⚠️ <i>Зверніть увагу: комісію за переказ сплачує покупець.</i>\n\nПісля оплати натисніть <b>«Я оплатив»</b> та надішліть скріншот/чек.",
    btn_i_paid: "✅ Я оплатив — надіслати чек",
    admin_declined: "❌ <b>Ваше замовлення відхилено менеджером</b>\n\n📝 Причина: <code>{reason}</code>\n\n📞 Зворотний зв'язок: {SUPPORT_USERNAME}",
    admin_completed: "🎉 <b>Ваше замовлення успішно виконано!</b>\n\nДякуємо, що обрали нас. Будь ласка, залиште відгук про нашу роботу, натиснувши на кнопку нижче:",
    btn_leave_review: "💬 Залишити відгук",
    ask_receipt: "📎 <b>Надішліть чек або скріншот оплати</b>\n\nПрикріпіть фото або документ з підтвердженням оплати:",
    receipt_received: "🎉 <b>Чек отримано!</b>\n\nМенеджер перевірить платіж та доставить товар найближчим часом.",
    review_prompt: "📝 Напишіть ваш відгук в одному повідомленні, і він автоматично опублікується в нашому каналі відгуків:",
    review_thanks: "❤️ <b>Дякуємо за ваш відгук!</b> Його успішно опубліковано в каналі відгуків.",
    review_error: "❌ Не вдалося відправити відгук в канал. Зв'яжіться з адміністрацією.",
    back: "🔙 Назад",
    bot_order_pending: "⏳ <b>Ваше замовлення надіслано на підтвердження адміністратору.</b>\n\nЯк тільки адміністратор підтвердить замовлення, ми надішлемо вам реквізити для оплати!",
    stars_item: "{amount} Зірок",
    premium_item: "Telegram Premium {label}",
  }
};

const PREMIUM_PRICES: Record<string, { duration_ru: string; duration_uk: string; price: number }> = {
  "3": { duration_ru: "3 месяца", duration_uk: "3 місяці", price: 550 },
  "6": { duration_ru: "6 месяцев", duration_uk: "6 місяців", price: 740 },
  "12": { duration_ru: "1 год", duration_uk: "1 рік", price: 1290 },
};

function calcStarsPrice(amount: number): number {
  return Math.round(amount * settings.starPrice * 100) / 100;
}

// Help check subscription status (mock for testing/easy deployment, real checks channel membership if bot has rights)
async function checkSubscription(userId: number): Promise<boolean> {
  if (userId === ADMIN_ID) return true;
  if (!bot) return true;
  try {
    const member = await bot.api.getChatMember(settings.channelUsername, userId);
    return ["member", "administrator", "creator"].includes(member.status);
  } catch (err) {
    // If bot is not in the channel, let the user pass to avoid blocking them
    console.warn("Could not check subscription to " + settings.channelUsername, err);
    return true;
  }
}

// Generate the beautiful inline keyboard for Main Menu
function getMainMarkup(lang: "ru" | "uk") {
  const shopUrl = settings.webappUrl
    ? `${settings.webappUrl}?card=${encodeURIComponent(settings.cardNumber.replace(/\s/g, ""))}&lang=${lang}`
    : "";

  const keyboard = new InlineKeyboard()
    .text(TEXTS[lang].btn_stars, "menu_stars")
    .text(TEXTS[lang].btn_premium, "menu_premium")
    .row();

  // Add the stunning WebApp button inside the inline menu if URL is available
  if (shopUrl) {
    keyboard.webApp("📱 " + (lang === "ru" ? "Открыть WebApp Магазин" : "Відкрити WebApp Магазин"), shopUrl).row();
  }

  keyboard
    .url(TEXTS[lang].btn_reviews, "https://t.me/" + settings.reviewsChannel.replace("@", ""))
    .url(TEXTS[lang].btn_conditions, settings.conditionsUrl)
    .row()
    .url(TEXTS[lang].btn_channel, "https://t.me/" + settings.channelUsername.replace("@", ""))
    .row()
    .text(TEXTS[lang].btn_lang, "change_lang");

  return keyboard;
}

// Reply keyboard for WebApp opening from bottom keyboard (essential for tg.sendData)
function getWebappReplyKeyboard(lang: "ru" | "uk") {
  if (!settings.webappUrl) return { remove_keyboard: true as const };

  const shopUrl = `${settings.webappUrl}?card=${encodeURIComponent(settings.cardNumber.replace(/\s/g, ""))}&lang=${lang}`;
  const btnText = lang === "ru" ? "📱 Открыть магазин" : "📱 Відкрити магазин";
  const placeholder = lang === "ru" ? "Удобный магазин тут 👇" : "Зручний магазин тут 👇";

  return Keyboard.from([
    [Keyboard.webApp(btnText, shopUrl)]
  ]).resized().placeholder(placeholder);
}

// Standard helper to safely update or send messages with FSM tracking
async function sendMainScreen(chatId: number, userId: number, user: UserState) {
  if (!bot) return;

  user.step = "none";
  user.orderType = undefined;
  user.starsAmount = undefined;
  user.premiumKey = undefined;

  const subscribed = await checkSubscription(userId);
  if (subscribed) {
    const text = TEXTS[user.lang].main_menu;
    const markup = getMainMarkup(user.lang);
    const replyMarkup = getWebappReplyKeyboard(user.lang);

    // Send reply keyboard bottom
    await bot.api.sendMessage(chatId, "🏪 chprrshop", {
      reply_markup: replyMarkup
    });

    const sent = await bot.api.sendMessage(chatId, text, {
      parse_mode: "HTML",
      reply_markup: markup,
    });
    user.lastMessageId = sent.message_id;
  } else {
    const text = TEXTS[user.lang].sub_required;
    const markup = new InlineKeyboard()
      .url(TEXTS[user.lang].btn_sub, "https://t.me/" + settings.channelUsername.replace("@", ""))
      .row()
      .text(TEXTS[user.lang].btn_is_subbed, "check_sub");

    const sent = await bot.api.sendMessage(chatId, text, {
      parse_mode: "HTML",
      reply_markup: markup,
    });
    user.lastMessageId = sent.message_id;
  }
}

// Setup bot handlers
if (bot) {
  // Start Command
  bot.command("start", async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const user = getOrCreateUser(userId);
    user.step = "none";

    // Show language selection inline
    const markup = new InlineKeyboard()
      .text("🇷🇺 Русский", "set_lang_ru")
      .text("🇺🇦 Українська", "set_lang_uk");

    const sent = await ctx.reply("🌍 <b>Выберите язык / Оберіть мову</b>", {
      parse_mode: "HTML",
      reply_markup: markup,
    });
    user.lastMessageId = sent.message_id;
  });

  function getAdminMarkup(): InlineKeyboard {
    return new InlineKeyboard()
      .text("📊 Статистика", "admin_stats")
      .row()
      .text("💳 Изменить карту", "admin_edit_card")
      .text("💰 Изменить курс", "admin_edit_price")
      .row()
      .text("🌐 Изменить WebApp URL", "admin_edit_webapp")
      .row()
      .text(
        `⚙️ Подтверждение: ${settings.requireBotOrderApproval ? "ВКЛ (карта после админа)" : "ВЫКЛ (карта сразу)"}`,
        "admin_toggle_approval"
      );
  }

  // Admin Command
  bot.command("admin", async (ctx) => {
    const userId = ctx.from?.id;
    if (userId !== ADMIN_ID) return;

    const markup = getAdminMarkup();

    await ctx.reply("🛠 <b>Панель администратора chprrshop</b>\n\nВыберите действие:", {
      parse_mode: "HTML",
      reply_markup: markup,
    });
  });

  // Callback queries handlers
  bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;
    const userId = ctx.from?.id;
    if (!userId) return;

    const user = getOrCreateUser(userId);

    if (data.startsWith("set_lang_")) {
      const selectedLang = data.split("_")[2] as "ru" | "uk";
      user.lang = selectedLang;
      await ctx.answerCallbackQuery();
      await sendMainScreen(ctx.chat.id, userId, user);
    } else if (data === "check_sub") {
      const subscribed = await checkSubscription(userId);
      if (subscribed) {
        await ctx.answerCallbackQuery({ text: TEXTS[user.lang].sub_confirmed });
        await sendMainScreen(ctx.chat.id, userId, user);
      } else {
        await ctx.answerCallbackQuery({ text: TEXTS[user.lang].sub_not_yet, show_alert: true });
      }
    } else if (data === "back_main") {
      await ctx.answerCallbackQuery();
      await sendMainScreen(ctx.chat.id, userId, user);
    } else if (data === "change_lang") {
      await ctx.answerCallbackQuery();
      const markup = new InlineKeyboard()
        .text("🇷🇺 Русский", "set_lang_ru")
        .text("🇺🇦 Українська", "set_lang_uk");
      await ctx.reply("🌍 <b>Выберите язык / Оберіть мову</b>", {
        parse_mode: "HTML",
        reply_markup: markup,
      });
    } else if (data === "menu_stars") {
      await ctx.answerCallbackQuery();
      const markup = new InlineKeyboard();
      const amounts = [50, 100, 200, 250, 500, 1000];
      
      // Dynamic grid
      for (let i = 0; i < amounts.length; i += 2) {
        const a1 = amounts[i];
        const a2 = amounts[i + 1];
        markup.text(`⭐️ ${a1} — ${calcStarsPrice(a1)} грн`, `stars_${a1}`);
        if (a2) {
          markup.text(`⭐️ ${a2} — ${calcStarsPrice(a2)} грн`, `stars_${a2}`);
        }
        markup.row();
      }
      
      markup.text("✏️ Своё количество / Своя кількість", "stars_custom").row();
      markup.text(TEXTS[user.lang].back, "back_main");

      await ctx.editMessageText(TEXTS[user.lang].stars_title, {
        parse_mode: "HTML",
        reply_markup: markup,
      });
    } else if (data === "stars_custom") {
      await ctx.answerCallbackQuery();
      user.step = "waiting_custom_stars";
      const backMarkup = new InlineKeyboard().text(TEXTS[user.lang].back, "menu_stars");
      await ctx.editMessageText(TEXTS[user.lang].stars_custom_prompt, {
        parse_mode: "HTML",
        reply_markup: backMarkup,
      });
    } else if (data.startsWith("stars_")) {
      await ctx.answerCallbackQuery();
      const amount = Number(data.split("_")[1]);
      user.starsAmount = amount;
      user.orderType = "stars";
      user.step = "waiting_username_stars";

      const backMarkup = new InlineKeyboard().text(TEXTS[user.lang].back, "menu_stars");
      const price = calcStarsPrice(amount);

      await ctx.editMessageText(
        TEXTS[user.lang].stars_selected.replace("{amount}", String(amount)).replace("{price}", String(price)),
        { parse_mode: "HTML", reply_markup: backMarkup }
      );
    } else if (data === "menu_premium") {
      await ctx.answerCallbackQuery();
      const markup = new InlineKeyboard();
      
      for (const [key, item] of Object.entries(PREMIUM_PRICES)) {
        const label = user.lang === "ru" ? item.duration_ru : item.duration_uk;
        markup.text(`💎 ${label} — ${item.price} грн`, `premium_${key}`).row();
      }
      markup.text(TEXTS[user.lang].back, "back_main");

      await ctx.editMessageText(TEXTS[user.lang].premium_title, {
        parse_mode: "HTML",
        reply_markup: markup,
      });
    } else if (data.startsWith("premium_")) {
      await ctx.answerCallbackQuery();
      const key = data.split("_")[1];
      user.premiumKey = key;
      user.orderType = "premium";
      user.step = "waiting_username_premium";

      const backMarkup = new InlineKeyboard().text(TEXTS[user.lang].back, "menu_premium");
      const price = PREMIUM_PRICES[key].price;
      const label = user.lang === "ru" ? PREMIUM_PRICES[key].duration_ru : PREMIUM_PRICES[key].duration_uk;

      await ctx.editMessageText(
        TEXTS[user.lang].premium_selected.replace("{label}", label).replace("{price}", String(price)),
        { parse_mode: "HTML", reply_markup: backMarkup }
      );
    } else if (data === "confirm_order") {
      await ctx.answerCallbackQuery();
      const price = user.orderType === "stars" 
        ? calcStarsPrice(user.starsAmount!) 
        : PREMIUM_PRICES[user.premiumKey!].price;

      const itemText = user.orderType === "stars"
        ? `⭐️ Зірки: ${user.starsAmount}`
        : `💎 Premium: ${PREMIUM_PRICES[user.premiumKey!].duration_ru}`;

      if (settings.requireBotOrderApproval) {
        user.step = "waiting_bot_approval";

        // Notify Admin for approval
        if (ADMIN_ID) {
          const adminApprovalMarkup = new InlineKeyboard()
            .text("✅ Підтвердити", `admin_approve_order_${userId}`)
            .text("❌ Відхилити", `admin_reject_order_${userId}`);

          await bot.api.sendMessage(
            ADMIN_ID,
            `⚡️ <b>НОВИЙ ЗАПИТ НА ЗАМОВЛЕННЯ (Потребує підтвердження)</b>\n\n👤 Клієнт: @${ctx.from?.username || "ID " + userId}\n📦 Товар: <b>${itemText}</b>\n💰 Сума: <b>${price} грн</b>\n📩 Отримувач: <code>${user.orderUsername}</code>`,
            { parse_mode: "HTML", reply_markup: adminApprovalMarkup }
          );
        }

        await ctx.reply(
          TEXTS[user.lang].bot_order_pending,
          { parse_mode: "HTML" }
        );
      } else {
        user.step = "waiting_receipt";

        const markup = new InlineKeyboard().text(TEXTS[user.lang].btn_i_paid, "send_receipt");

        // Notify Admin about the checkout creation
        if (ADMIN_ID) {
          await bot.api.sendMessage(
            ADMIN_ID,
            `⚡️ <b>НОВА ЗАЯВКА НА ОПЛАТУ (Через бота)</b>\n\n👤 Клієнт: @${ctx.from?.username || "ID " + userId}\n📦 Товар: <b>${itemText}</b>\n💰 Сума: <b>${price} грн</b>\n📩 Отримувач: <code>${user.orderUsername}</code>`,
            { parse_mode: "HTML" }
          );
        }

        await ctx.reply(
          TEXTS[user.lang].admin_confirmed
            .replace("{price}", String(price))
            .replace("{CARD_NUMBER}", settings.cardNumber),
          { parse_mode: "HTML", reply_markup: markup }
        );
      }
    } else if (data.startsWith("admin_approve_order_")) {
      await ctx.answerCallbackQuery();
      if (ctx.from.id !== ADMIN_ID) return;

      const clientUserId = Number(data.split("_")[3]);
      const clientUser = userStates.get(clientUserId);
      
      if (!clientUser) {
        await ctx.reply("❌ Не удалось найти сессию пользователя (возможно, бот перезагружался).");
        return;
      }

      const price = clientUser.orderType === "stars"
        ? calcStarsPrice(clientUser.starsAmount!)
        : PREMIUM_PRICES[clientUser.premiumKey!].price;

      clientUser.step = "waiting_receipt";
      const userLang = clientUser.lang || "ru";

      // Send card details to client
      const markup = new InlineKeyboard().text(TEXTS[userLang].btn_i_paid, "send_receipt");
      await bot.api.sendMessage(
        clientUserId,
        TEXTS[userLang].admin_confirmed
          .replace("{price}", String(price))
          .replace("{CARD_NUMBER}", settings.cardNumber),
        { parse_mode: "HTML", reply_markup: markup }
      );

      // Update admin message
      await ctx.editMessageText(
        ctx.message?.text + `\n\n✅ <b>Заявку підтверджено! Клієнту надіслано карту для оплати.</b>`,
        { parse_mode: "HTML", reply_markup: undefined }
      );
    } else if (data.startsWith("admin_reject_order_")) {
      await ctx.answerCallbackQuery();
      if (ctx.from.id !== ADMIN_ID) return;

      const clientUserId = Number(data.split("_")[3]);
      const clientUser = userStates.get(clientUserId);
      
      const userLang = clientUser?.lang || "ru";
      const reason = userLang === "ru" ? "Отклонено администратором" : "Відхилено адміністратором";

      if (clientUser) {
        clientUser.step = "none";
      }

      // Notify user
      await bot.api.sendMessage(
        clientUserId,
        TEXTS[userLang].admin_declined
          .replace("{reason}", reason)
          .replace("{SUPPORT_USERNAME}", settings.supportUsername),
        { parse_mode: "HTML" }
      );

      // Update admin message
      await ctx.editMessageText(
        ctx.message?.text + `\n\n❌ <b>Заявку відхилено. Клієнта сповіщено.</b>`,
        { parse_mode: "HTML", reply_markup: undefined }
      );
    } else if (data === "send_receipt") {
      await ctx.answerCallbackQuery();
      user.step = "waiting_receipt";
      await ctx.reply(TEXTS[user.lang].ask_receipt, {
        parse_mode: "HTML",
        reply_markup: new InlineKeyboard().text(TEXTS[user.lang].back, "back_main"),
      });
    } else if (data === "user_leave_review") {
      await ctx.answerCallbackQuery();
      user.step = "waiting_review";
      await ctx.reply(TEXTS[user.lang].review_prompt, { parse_mode: "HTML" });
    } else if (data.startsWith("admin_complete_")) {
      await ctx.answerCallbackQuery();
      if (ctx.from.id !== ADMIN_ID) return;

      const clientUserId = Number(data.split("_")[2]);
      const clientUser = userStates.get(clientUserId);
      const clientLang = clientUser?.lang || "ru";

      // Notify the buyer in Telegram
      await bot.api.sendMessage(
        clientUserId,
        TEXTS[clientLang].admin_completed,
        {
          parse_mode: "HTML",
          reply_markup: new InlineKeyboard().text(TEXTS[clientLang].btn_leave_review, "user_leave_review")
        }
      );

      await ctx.editMessageText(
        ctx.message?.text + `\n\n🚀 <b>Замовлення успішно виконано! Клієнт отримав сповіщення.</b>`,
        { parse_mode: "HTML", reply_markup: undefined }
      );
    }

    // Admin commands callback actions
    if (ctx.from.id === ADMIN_ID) {
      if (data === "admin_stats") {
        await ctx.answerCallbackQuery();
        const activeSessions = userStates.size;
        const statsMsg = `📊 <b>Статистика chprrshop:</b>\n\n👥 Количество активных сессий в боте: <b>${activeSessions}</b>\n💳 Номер карты: <code>${settings.cardNumber}</code>\n💰 Курс за 1 звезду: <b>${settings.starPrice} грн</b>\n🌐 WebApp URL: <code>${settings.webappUrl}</code>\n⚙️ Подтверждение в боте: <b>${settings.requireBotOrderApproval ? "ВКЛЮЧЕНО" : "ВЫКЛЮЧЕНО (карта сразу)"}</b>`;
        await ctx.reply(statsMsg, { parse_mode: "HTML" });
      } else if (data === "admin_edit_card") {
        await ctx.answerCallbackQuery();
        user.adminAction = "waiting_card";
        await ctx.reply("💳 Введите <b>новый номер карты</b> для оплаты:");
      } else if (data === "admin_edit_price") {
        await ctx.answerCallbackQuery();
        user.adminAction = "waiting_price";
        await ctx.reply(`💰 Введите <b>новый курс одной звезды</b> (текущий: ${settings.starPrice}):`);
      } else if (data === "admin_edit_webapp") {
        await ctx.answerCallbackQuery();
        user.adminAction = "waiting_webapp";
        await ctx.reply(`🌐 Введите <b>новый URL WebApp</b> (текущий: ${settings.webappUrl}):`);
      } else if (data === "admin_toggle_approval") {
        await ctx.answerCallbackQuery();
        settings.requireBotOrderApproval = !settings.requireBotOrderApproval;
        saveSettings(settings);
        
        const markup = getAdminMarkup();
        await ctx.editMessageText("🛠 <b>Панель администратора chprrshop</b>\n\nВыберите действие:", {
          parse_mode: "HTML",
          reply_markup: markup,
        });
      }
    }
  });

  // Handle incoming texts for states / Wizard flow
  bot.on("message:text", async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const user = getOrCreateUser(userId);

    // Admin settings updates
    if (userId === ADMIN_ID && user.adminAction) {
      const txt = ctx.message.text.trim();
      if (user.adminAction === "waiting_card") {
        settings.cardNumber = txt;
        saveSettings(settings);
        user.adminAction = undefined;
        await ctx.reply(`✅ Номер карты успешно обновлен: <code>${settings.cardNumber}</code>`, { parse_mode: "HTML" });
      } else if (user.adminAction === "waiting_price") {
        const val = parseFloat(txt);
        if (!isNaN(val)) {
          settings.starPrice = val;
          saveSettings(settings);
          user.adminAction = undefined;
          await ctx.reply(`✅ Курс звезды успешно обновлен: <b>${settings.starPrice} грн</b>`, { parse_mode: "HTML" });
        } else {
          await ctx.reply("❌ Ошибка: Введите корректное число.");
        }
      } else if (user.adminAction === "waiting_webapp") {
        settings.webappUrl = txt;
        saveSettings(settings);
        user.adminAction = undefined;
        await ctx.reply(`✅ WebApp URL успешно обновлен: <code>${settings.webappUrl}</code>`, { parse_mode: "HTML" });
      }
      return;
    }

    if (user.step === "waiting_custom_stars") {
      const amount = Number(ctx.message.text.trim());
      if (isNaN(amount) || amount < 50) {
        await ctx.reply(TEXTS[user.lang].stars_min_error, { parse_mode: "HTML" });
        return;
      }
      user.starsAmount = amount;
      user.orderType = "stars";
      user.step = "waiting_username_stars";

      const backMarkup = new InlineKeyboard().text(TEXTS[user.lang].back, "menu_stars");
      const price = calcStarsPrice(amount);

      await ctx.reply(
        TEXTS[user.lang].stars_custom_qty.replace("{amount}", String(amount)).replace("{price}", String(price)),
        { parse_mode: "HTML", reply_markup: backMarkup }
      );
      return;
    }

    if (user.step === "waiting_username_stars" || user.step === "waiting_username_premium") {
      const username = ctx.message.text.trim().replace("@", "");
      const usernameRegex = /^[a-zA-Z0-9_]+$/;

      if (!usernameRegex.test(username)) {
        const backMarkup = new InlineKeyboard().text(TEXTS[user.lang].back, "back_main");
        if (user.step === "waiting_username_stars") {
          const price = calcStarsPrice(user.starsAmount!);
          await ctx.reply(
            TEXTS[user.lang].username_error.replace("{amount}", String(user.starsAmount)).replace("{price}", String(price)),
            { parse_mode: "HTML", reply_markup: backMarkup }
          );
        } else {
          const label = user.lang === "ru" ? PREMIUM_PRICES[user.premiumKey!].duration_ru : PREMIUM_PRICES[user.premiumKey!].duration_uk;
          await ctx.reply(
            TEXTS[user.lang].premium_username_error.replace("{label}", label).replace("{price}", String(PREMIUM_PRICES[user.premiumKey!].price)),
            { parse_mode: "HTML", reply_markup: backMarkup }
          );
        }
        return;
      }

      user.orderUsername = `@${username}`;

      const price = user.orderType === "stars"
        ? calcStarsPrice(user.starsAmount!)
        : PREMIUM_PRICES[user.premiumKey!].price;

      const itemText = user.orderType === "stars"
        ? TEXTS[user.lang].stars_item.replace("{amount}", String(user.starsAmount))
        : TEXTS[user.lang].premium_item.replace("{label}", user.lang === "ru" ? PREMIUM_PRICES[user.premiumKey!].duration_ru : PREMIUM_PRICES[user.premiumKey!].duration_uk);

      const confirmMarkup = new InlineKeyboard()
        .text(TEXTS[user.lang].btn_verify_confirm, "confirm_order")
        .row()
        .text(TEXTS[user.lang].btn_verify_change, user.orderType === "stars" ? "menu_stars" : "menu_premium");

      await ctx.reply(
        TEXTS[user.lang].verify_title
          .replace("{item}", itemText)
          .replace("{price}", String(price))
          .replace("{recipient}", user.orderUsername),
        { parse_mode: "HTML", reply_markup: confirmMarkup }
      );
      return;
    }

    if (user.step === "waiting_review") {
      const reviewText = ctx.message.text.trim();
      const clientName = ctx.from?.username ? `@${ctx.from.username}` : "Клиент";

      if (ADMIN_ID) {
        try {
          // Send review directly to reviews channel if bot is in it, or forward to admin
          await bot.api.sendMessage(
            ADMIN_ID,
            `📝 <b>Новий відгук від ${clientName}:</b>\n\n«${reviewText}»\n\n🏪 @chprrshop`
          );
          await ctx.reply(TEXTS[user.lang].review_thanks, { parse_mode: "HTML" });
        } catch (err) {
          await ctx.reply(TEXTS[user.lang].review_error, { parse_mode: "HTML" });
        }
      }
      user.step = "none";
      await sendMainScreen(ctx.chat.id, userId, user);
      return;
    }
  });

  // Handle incoming photo receipts
  bot.on([":photo", ":document"], async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const user = getOrCreateUser(userId);
    if (user.step !== "waiting_receipt") return;

    user.step = "none";

    const price = user.orderType === "stars"
      ? calcStarsPrice(user.starsAmount!)
      : PREMIUM_PRICES[user.premiumKey!].price;

    const itemText = user.orderType === "stars"
      ? `⭐️ Зірки: ${user.starsAmount}`
      : `💎 Premium: ${PREMIUM_PRICES[user.premiumKey!].duration_ru}`;

    if (ADMIN_ID) {
      const caption = `💰 <b>Чек оплати отримано!</b>\n\n👤 Покупець: @${ctx.from?.username || "ID " + userId}\n📩 Отримувач: <code>${user.orderUsername || "—"}</code>\n📦 Товар: <b>${itemText}</b>\n💰 Сума: <b>${price} грн</b>`;
      const markup = new InlineKeyboard().text("✅ Замовлення виконано", `admin_complete_${userId}`);

      try {
        if (ctx.message.photo) {
          const photoId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
          await bot.api.sendPhoto(ADMIN_ID, photoId, { caption, reply_markup: markup, parse_mode: "HTML" });
        } else if (ctx.message.document) {
          await bot.api.sendDocument(ADMIN_ID, ctx.message.document.file_id, { caption, reply_markup: markup, parse_mode: "HTML" });
        }
      } catch (err) {
        console.error("Error forwarding receipt to admin:", err);
      }
    }

    await ctx.reply(TEXTS[user.lang].receipt_received, {
      parse_mode: "HTML",
      reply_markup: getMainMarkup(user.lang),
    });
  });

  // Global error handler for handling updates gracefully without crashing the bot
  bot.catch((err) => {
    const ctx = err.ctx;
    console.error(`Error while handling update ${ctx.update.update_id}:`, err.error);
  });

  // Start polling with retry mechanism on conflict (409) and clean webhook deletion
  async function startBot() {
    try {
      console.log("🧹 Attempting to delete webhook...");
      await bot!.api.deleteWebhook({ drop_pending_updates: true }).catch(() => {});
      
      console.log("🚀 Starting bot polling...");
      await bot!.start({
        drop_pending_updates: true,
        allowed_updates: ["message", "callback_query"],
      });
      console.log("✅ Bot polling started successfully");
    } catch (err: any) {
      const errMsg = err.message || "";
      const errDesc = err.description || "";
      if (errDesc.includes("Conflict") || errMsg.includes("Conflict") || errDesc.includes("409") || errMsg.includes("409")) {
        console.warn("⚠️ Bot polling conflict detected (409). Another instance is likely running. Retrying in 4 seconds...");
        setTimeout(startBot, 4000);
      } else {
        console.error("❌ Error running Telegram Bot Polling:", err);
        console.log("🔄 Retrying bot start in 10 seconds...");
        setTimeout(startBot, 10000);
      }
    }
  }

  startBot();

  // Graceful shutdown on process termination
  const shutdown = async (signal: string) => {
    console.log(`Received ${signal}. Stopping bot polling...`);
    try {
      if (bot) {
        await bot.stop();
        console.log("Bot polling stopped gracefully.");
      }
    } catch (e) {
      console.error("Error stopping bot:", e);
    }
    process.exit(0);
  };

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
}

// --- API ENDPOINTS ---

// Get active configuration (card, price, channel details)
app.get("/api/config", (req, res) => {
  res.json({
    cardNumber: settings.cardNumber,
    starPrice: settings.starPrice,
    channelUsername: settings.channelUsername,
    reviewsChannel: settings.reviewsChannel,
    conditionsUrl: settings.conditionsUrl,
    supportUsername: settings.supportUsername,
    webappUrl: settings.webappUrl,
  });
});

// Create/Submit checkout & screenshot receipt from WebApp directly
app.post("/api/order/submit", async (req, res) => {
  const { userId, username, recipient, item, price, receipt } = req.body;

  if (!receipt) {
    return res.status(400).json({ error: "Receipt image is required." });
  }

  if (!bot || !ADMIN_ID) {
    return res.status(500).json({ error: "Telegram bot integration or Admin ID is not configured." });
  }

  try {
    // Process base64 file data
    const base64Data = receipt.replace(/^data:image\/\w+;base64,/, "");
    const imageBuffer = Buffer.from(base64Data, "base64");

    const caption = `🧾 <b>НОВЕ ЗАМОВЛЕННЯ ЧЕРЕЗ WEBAPP!</b>\n\n👤 Покупець: @${username || "—"} (ID: <code>${userId || "невідомий"}</code>)\n📩 Отримувач: <code>@${recipient || "—"}</code>\n📦 Товар: <b>${item || "—"}</b>\n💰 Сума: <b>${price || "—"} грн</b>`;
    
    const adminMarkup = new InlineKeyboard().text("✅ Замовлення виконано", `admin_complete_${userId || 0}`);

    // Send photo directly to Telegram Admin
    await bot.api.sendPhoto(ADMIN_ID, new InputFile(imageBuffer, "receipt.jpg"), {
      caption: caption,
      reply_markup: adminMarkup,
      parse_mode: "HTML",
    });

    // Notify user in Telegram chat if valid ID
    if (userId && !isNaN(Number(userId))) {
      const targetUser = Number(userId);
      const userLang = userStates.get(targetUser)?.lang || "ru";

      const userText = userLang === "ru"
        ? `🎉 <b>Чек оплаты получен через WebApp!</b>\n\n📦 Товар: <b>${item}</b>\n💰 Сумма: <b>${price} грн</b>\n📩 Получатель: <code>@${recipient}</code>\n\nМенеджер проверит платёж и доставит товар в ближайшее время.`
        : `🎉 <b>Чек оплати отримано через WebApp!</b>\n\n📦 Товар: <b>${item}</b>\n💰 Сума: <b>${price} грн</b>\n📩 Отримувач: <code>@${recipient}</code>\n\nМенеджер перевірить платіж та доставить товар найближчим часом.`;

      await bot.api.sendMessage(targetUser, userText, { parse_mode: "HTML" }).catch(() => {
        console.warn(`Could not send purchase receipt confirmation directly to user ${userId}`);
      });
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error("Error submitting WebApp order:", err);
    res.status(500).json({ error: "Failed to process order submission.", details: err.message });
  }
});

// Serve Vite frontend in development and built static files in production
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
}

startServer();
