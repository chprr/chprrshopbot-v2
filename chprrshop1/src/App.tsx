import React, { useState, useEffect, useRef } from "react";
import { 
  Star, 
  CheckCircle, 
  Copy, 
  X, 
  ArrowLeft, 
  UploadCloud, 
  User, 
  CreditCard, 
  Globe, 
  ExternalLink, 
  Sparkles, 
  Check,
  ShieldCheck,
  FileSpreadsheet,
  Sun,
  Moon
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// Types
type Language = "ru" | "uk";

interface AppConfig {
  cardNumber: string;
  starPrice: number;
  channelUsername: string;
  reviewsChannel: string;
  conditionsUrl: string;
  supportUsername: string;
  webappUrl: string;
}

interface OrderInfo {
  type: "stars" | "premium" | "";
  value: number | string;
  price: number;
  label: string;
  recipient: string;
}

// Telegram WebApp bridge
const tg = (window as any).Telegram?.WebApp;

export default function App() {
  // Config state
  const [config, setConfig] = useState<AppConfig>({
    cardNumber: "4874 0700 5861 6069",
    starPrice: 0.80,
    channelUsername: "@chprrshop",
    reviewsChannel: "@otzivichprr",
    conditionsUrl: "https://t.me/ysloviyapokupki",
    supportUsername: "@chprr",
    webappUrl: ""
  });

  // State management
  const [lang, setLang] = useState<Language>("ru");
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") return saved;
    if (tg?.colorScheme === "light" || tg?.colorScheme === "dark") {
      return tg.colorScheme;
    }
    return "dark";
  });
  const [currentScreen, setCurrentScreen] = useState<"catalog" | "custom-stars" | "username" | "payment" | "success">("catalog");
  const [selectedProduct, setSelectedProduct] = useState<OrderInfo>({
    type: "",
    value: 0,
    price: 0,
    label: "",
    recipient: ""
  });

  // Theme synchronization
  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Form states
  const [customStarsAmount, setCustomStarsAmount] = useState<string>("");
  const [recipientUsername, setRecipientUsername] = useState<string>("");
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);

  // UI feedback
  const [isCopiedCard, setIsCopiedCard] = useState<boolean>(false);
  const [isCopiedPrice, setIsCopiedPrice] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize and load configuration
  useEffect(() => {
    // Fetch system configs
    fetch("/api/config")
      .then((res) => res.json())
      .then((data) => {
        setConfig(data);
      })
      .catch((err) => console.error("Error loading shop configurations:", err));

    // Handle Telegram-specific context
    if (tg) {
      tg.expand();
      tg.ready();
      
      // Parse query parameters
      const urlParams = new URLSearchParams(window.location.search);
      const queryLang = urlParams.get("lang");
      if (queryLang === "uk" || queryLang === "ru") {
        setLang(queryLang as Language);
      }
    }
  }, []);

  const t = {
    ru: {
      appName: "chprrshop",
      tagline: "Быстрая покупка Stars и Premium",
      btnChannel: "📢 Наш Телеграм канал",
      btnReviews: "💬 Отзывы покупателей",
      btnTerms: "📋 Условия покупки",
      starsHeader: "⭐️ Telegram Stars",
      premiumHeader: "💎 Telegram Premium",
      buy: "Купить",
      choose: "Выбрать",
      customStarsTitle: "Ввести свое количество",
      customStarsFrom: "От 50 звезд (курс 0.8)",
      customPlaceholder: "Например: 150",
      customLimitErr: "Минимальное количество — 50 звезд.",
      next: "Далее",
      back: "🔙 Назад",
      cancel: "🔙 Отмена",
      recipientTitle: "👤 Получатель",
      recipientDesc: "Введите <b>Telegram Username</b> на который нужно отправить товар.",
      usernamePlaceholder: "Например: durov",
      usernameErr: "Некорректный юзернейм! Только латиница, цифры и символ подчеркивания.",
      toPayment: "К оплате",
      paymentTitle: "💳 Оплата",
      payItem: "Товар:",
      payUser: "Получатель:",
      payDesc: "Переведите ровно <b>{price} грн</b> на эту карту:",
      cardLabel: "Номер карты",
      alertCommission: "⚠️ Внимание: комиссию за перевод оплачивает покупатель.",
      payHint: "Оплатите в своем банке, а затем загрузите чек или скриншот оплаты прямо здесь:",
      btnPaid: "✅ Подтвердить и отправить чек",
      btnChange: "🔙 Изменить данные",
      uploadPrompt: "Перетащите чек сюда или кликните для выбора",
      uploadFormat: "Поддерживаются PNG, JPG, JPEG",
      removeReceipt: "Удалить",
      orderSuccess: "🎉 Заказ отправлен!",
      successDesc: "Ваш чек успешно загружен и отправлен администратору для верификации.",
      successNext: "Менеджер проверит платеж и выдаст товар в ближайшее время. Вы получите уведомление в боте.",
      successClose: "Вернуться в бот",
      fallbackUserPrompt: "Для связи с вами (если вы не из бота):",
      contactPlaceholder: "Ваш юзернейм или телефон",
      starsItem: "{amount} Звёзд",
      premiumItem: "Telegram Premium {label}",
      months: "3 Месяца",
      months6: "6 Месяцев",
      year: "1 Год",
    },
    uk: {
      appName: "chprrshop",
      tagline: "Швидка покупка Stars та Premium",
      btnChannel: "📢 Наш Телеграм канал",
      btnReviews: "💬 Відгуки покупців",
      btnTerms: "📋 Умови замовлення",
      starsHeader: "⭐️ Telegram Stars",
      premiumHeader: "💎 Telegram Premium",
      buy: "Купити",
      choose: "Обрати",
      customStarsTitle: "Ввести свою кількість",
      customStarsFrom: "Від 50 зірок (курс 0.8)",
      customPlaceholder: "Наприклад: 150",
      customLimitErr: "Мінімальна кількість — 50 зірок.",
      next: "Далі",
      back: "🔙 Назад",
      cancel: "🔙 Скасувати",
      recipientTitle: "👤 Отримувач",
      recipientDesc: "Введіть <b>Telegram Username</b> на який потрібно надіслати товар.",
      usernamePlaceholder: "Наприклад: durov",
      usernameErr: "Некоректний юзернейм! Лише латиниця, цифри та символ підкреслення.",
      toPayment: "До оплати",
      paymentTitle: "💳 Оплата",
      payItem: "Товар:",
      payUser: "Отримувач:",
      payDesc: "Перекажіть рівно <b>{price} грн</b> на цю картку:",
      cardLabel: "Номер картки",
      alertCommission: "⚠️ Увага: комісію за переказ сплачує покупець.",
      payHint: "Оплатіть у своєму банку, а потім завантажте чек або скріншот оплати прямо тут:",
      btnPaid: "✅ Підтвердити та надіслати чек",
      btnChange: "🔙 Змінити дані",
      uploadPrompt: "Перетягніть чек сюди або клікніть для вибору",
      uploadFormat: "Підтримуються PNG, JPG, JPEG",
      removeReceipt: "Видалити",
      orderSuccess: "🎉 Замовлення надіслано!",
      successDesc: "Ваш чек успішно завантажено та надіслано адміністратору для верифікації.",
      successNext: "Менеджер перевірить платіж та видасть товар найближчим часом. Ви отримаєте сповіщення у боті.",
      successClose: "Повернутися в бот",
      fallbackUserPrompt: "Для зв'язку з вами (якщо ви не з бота):",
      contactPlaceholder: "Ваш юзернейм або телефон",
      starsItem: "{amount} Зірок",
      premiumItem: "Telegram Premium {label}",
      months: "3 Місяці",
      months6: "6 Місяців",
      year: "1 Рік",
    }
  };

  const currentT = t[lang];

  const calcStarsPrice = (amount: number) => {
    return Math.round(amount * config.starPrice * 100) / 100;
  };

  // Stars products
  const starsProducts = [
    { amount: 50, price: calcStarsPrice(50) },
    { amount: 100, price: calcStarsPrice(100) },
    { amount: 200, price: calcStarsPrice(200) },
    { amount: 250, price: calcStarsPrice(250) },
    { amount: 500, price: calcStarsPrice(500) },
    { amount: 1000, price: calcStarsPrice(1000) }
  ];

  // Premium products
  const premiumProducts = [
    { key: "3", label: currentT.months, price: 550 },
    { key: "6", label: currentT.months6, price: 740 },
    { key: "12", label: currentT.year, price: 1290 }
  ];

  // Handle standard product selection
  const handleSelectProduct = (type: "stars" | "premium", value: number | string, price: number, label: string) => {
    setSelectedProduct({
      type,
      value,
      price,
      label,
      recipient: ""
    });
    setRecipientUsername("");
    setErrorMessage(null);
    setCurrentScreen("username");
  };

  // Process custom stars input
  const handleCustomStarsNext = () => {
    const amount = parseInt(customStarsAmount);
    if (isNaN(amount) || amount < 50) {
      setErrorMessage(currentT.customLimitErr);
      return;
    }
    setErrorMessage(null);
    const price = Math.round(amount * config.starPrice * 100) / 100;
    setSelectedProduct({
      type: "stars",
      value: amount,
      price,
      label: currentT.starsItem.replace("{amount}", String(amount)),
      recipient: ""
    });
    setRecipientUsername("");
    setCurrentScreen("username");
  };

  // Process Username validation & transition to Payment screen
  const handleUsernameNext = () => {
    const cleanUsername = recipientUsername.trim().replace("@", "");
    const regex = /^[a-zA-Z0-9_]+$/;
    
    if (!regex.test(cleanUsername) || cleanUsername.length === 0) {
      setErrorMessage(currentT.usernameErr);
      return;
    }

    setErrorMessage(null);
    setSelectedProduct(prev => ({
      ...prev,
      recipient: cleanUsername
    }));
    setCurrentScreen("payment");
  };

  // Clipboard copy handlers
  const copyToClipboard = (text: string, type: "card" | "price") => {
    const cleanText = text.replace(/\s/g, "");
    navigator.clipboard.writeText(cleanText).then(() => {
      if (type === "card") {
        setIsCopiedCard(true);
        setTimeout(() => setIsCopiedCard(false), 2000);
      } else {
        setIsCopiedPrice(true);
        setTimeout(() => setIsCopiedPrice(false), 2000);
      }
    });
  };

  // Drag and drop receipt actions
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processReceiptFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processReceiptFile(e.target.files[0]);
    }
  };

  const processReceiptFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("Пожалуйста, загрузите изображение.");
      return;
    }
    setReceiptFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setReceiptImage(e.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  // Submit order & Receipt image to Express API
  const handleSubmitOrder = async () => {
    if (!receiptImage) {
      alert(lang === "ru" ? "Пожалуйста, загрузите чек об оплате." : "Будь ласка, завантажте чек про оплату.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    // Read user context from Telegram WebApp
    const userContext = tg?.initDataUnsafe?.user;
    const buyerId = userContext?.id || "";
    const buyerUsername = userContext?.username || "";

    const payload = {
      userId: buyerId,
      username: buyerUsername,
      recipient: selectedProduct.recipient,
      item: selectedProduct.label,
      price: selectedProduct.price,
      receipt: receiptImage
    };

    try {
      const response = await fetch("/api/order/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const resData = await response.json();

      if (response.ok && resData.success) {
        // Successful checkout!
        setCurrentScreen("success");
        // Trigger Telegram sendData as fallback if available
        if (tg) {
          tg.sendData(JSON.stringify({
            action: selectedProduct.type,
            value: selectedProduct.value,
            price: selectedProduct.price,
            label: selectedProduct.label,
            username: selectedProduct.recipient
          }));
        }
      } else {
        setErrorMessage(resData.error || "Failed to submit order receipt.");
      }
    } catch (err: any) {
      console.error("Submission error:", err);
      setErrorMessage(lang === "ru" ? "Ошибка подключения к серверу." : "Помилка підключення до сервера.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (tg) {
      tg.close();
    } else {
      // Regular browser fallback
      setCurrentScreen("catalog");
      setSelectedProduct({
        type: "",
        value: 0,
        price: 0,
        label: "",
        recipient: ""
      });
      setReceiptImage(null);
      setReceiptFile(null);
      setCustomStarsAmount("");
      setRecipientUsername("");
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex justify-center py-4 px-4 sm:px-6 transition-colors duration-300">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl shadow-xl border border-zinc-200/60 dark:border-zinc-800/80 overflow-hidden flex flex-col relative">
        
        {/* Language & Header panel */}
        <div className="px-6 pt-6 pb-2 flex justify-between items-center z-10">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-xs font-mono text-zinc-500 tracking-wider">CHPRRSHOP ONLINE</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Theme Toggle */}
            <button
              id="theme-toggle-btn"
              onClick={() => setTheme(t => t === "light" ? "dark" : "light")}
              className="flex items-center justify-center p-2 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer text-zinc-500 dark:text-zinc-400"
              title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
            >
              {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>
            <button 
              id="lang-toggle-btn"
              onClick={() => setLang(l => l === "ru" ? "uk" : "ru")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors text-xs font-bold font-sans cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5 text-zinc-500" />
              <span>{lang.toUpperCase()}</span>
            </button>
          </div>
        </div>

        {/* Dynamic Screen Content with animations */}
        <div className="flex-1 px-6 pb-6 overflow-y-auto max-h-[85vh]">
          <AnimatePresence mode="wait">
            
            {/* SCREEN 1: CATALOG */}
            {currentScreen === "catalog" && (
              <motion.div
                key="catalog"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
                className="space-y-6"
                id="catalog-screen"
              >
                {/* Branding */}
                <div className="text-center mt-2 space-y-1">
                  <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent flex items-center justify-center gap-2">
                    🏪 {currentT.appName}
                  </h1>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">
                    {currentT.tagline}
                  </p>
                </div>

                {/* Shortcuts Grid */}
                <div className="grid grid-cols-1 gap-2.5">
                  <a 
                    href="https://t.me/chprrshop"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-800/40 dark:hover:bg-zinc-800/80 border border-zinc-100 dark:border-zinc-800 transition-all text-xs font-semibold"
                    id="shortcut-channel"
                  >
                    <span>{currentT.btnChannel}</span>
                    <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
                  </a>
                  <a 
                    href="https://t.me/otzivichprr"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-800/40 dark:hover:bg-zinc-800/80 border border-zinc-100 dark:border-zinc-800 transition-all text-xs font-semibold"
                    id="shortcut-reviews"
                  >
                    <span>{currentT.btnReviews}</span>
                    <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
                  </a>
                  <a 
                    href={config.conditionsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-800/40 dark:hover:bg-zinc-800/80 border border-zinc-100 dark:border-zinc-800 transition-all text-xs font-semibold"
                    id="shortcut-terms"
                  >
                    <span>{currentT.btnTerms}</span>
                    <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
                  </a>
                </div>

                {/* Stars Section */}
                <div className="space-y-3" id="stars-section">
                  <div className="flex items-center gap-1.5 text-md font-bold text-zinc-800 dark:text-zinc-200 pb-1">
                    <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                    <h2>{currentT.starsHeader}</h2>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5">
                    {starsProducts.map((p, idx) => (
                      <div 
                        key={idx} 
                        className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/30 border border-zinc-100 dark:border-zinc-800/80 rounded-2xl"
                      >
                        <div className="flex flex-col">
                          <span className="font-bold text-sm tracking-tight">{p.amount} Stars</span>
                          <span className="text-xs text-zinc-500 font-mono font-medium">{p.price} грн</span>
                        </div>
                        <button 
                          onClick={() => handleSelectProduct("stars", p.amount, p.price, `${p.amount} Stars`)}
                          className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold tracking-tight shadow-md shadow-blue-500/10 cursor-pointer transition-all active:scale-95"
                        >
                          {currentT.buy}
                        </button>
                      </div>
                    ))}

                    {/* Custom Stars Product */}
                    <div className="flex items-center justify-between p-4 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 dark:border-amber-500/10 rounded-2xl">
                      <div className="flex flex-col">
                        <span className="font-bold text-sm text-amber-700 dark:text-amber-400">{currentT.customStarsTitle}</span>
                        <span className="text-xs text-amber-600 dark:text-amber-500 font-medium">{currentT.customStarsFrom}</span>
                      </div>
                      <button 
                        onClick={() => setCurrentScreen("custom-stars")}
                        className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold tracking-tight shadow-md shadow-amber-500/10 cursor-pointer transition-all active:scale-95"
                      >
                        {currentT.choose}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Premium Section */}
                <div className="space-y-3 pt-2" id="premium-section">
                  <div className="flex items-center gap-1.5 text-md font-bold text-zinc-800 dark:text-zinc-200 pb-1">
                    <Sparkles className="w-5 h-5 text-indigo-500" />
                    <h2>{currentT.premiumHeader}</h2>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5">
                    {premiumProducts.map((p, idx) => (
                      <div 
                        key={idx} 
                        className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/30 border border-zinc-100 dark:border-zinc-800/80 rounded-2xl"
                      >
                        <div className="flex flex-col">
                          <span className="font-bold text-sm tracking-tight">{p.label}</span>
                          <span className="text-xs text-zinc-500 font-mono font-medium">{p.price} грн</span>
                        </div>
                        <button 
                          onClick={() => handleSelectProduct("premium", p.key, p.price, `Premium ${p.label}`)}
                          className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold tracking-tight shadow-md shadow-indigo-500/10 cursor-pointer transition-all active:scale-95"
                        >
                          {currentT.buy}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* SCREEN 2: CUSTOM STARS AMOUNT */}
            {currentScreen === "custom-stars" && (
              <motion.div
                key="custom-stars"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6 pt-4"
                id="custom-stars-screen"
              >
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => { setCurrentScreen("catalog"); setErrorMessage(null); }}
                    className="p-2 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <h1 className="text-xl font-bold tracking-tight">{currentT.customStarsTitle}</h1>
                </div>

                <div className="space-y-4">
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {lang === "ru" 
                      ? "Введите желаемое количество звезд (минимум 50). Стоимость рассчитается автоматически по курсу 0.8 грн за звезду."
                      : "Введіть бажану кількість зірок (мінімум 50). Вартість розрахується автоматично за курсом 0.8 грн за зірку."
                    }
                  </p>

                  <div className="relative">
                    <input 
                      type="number"
                      value={customStarsAmount}
                      onChange={(e) => setCustomStarsAmount(e.target.value)}
                      placeholder={currentT.customPlaceholder}
                      className="w-full px-4 py-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 focus:outline-none focus:ring-2 focus:ring-amber-500 font-sans text-md font-medium tracking-wide transition-all"
                      id="custom-amount-input"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-zinc-400 font-bold">
                      <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                      <span>STARS</span>
                    </div>
                  </div>

                  {errorMessage && (
                    <motion.p 
                      initial={{ opacity: 0 }} 
                      animate={{ opacity: 1 }} 
                      className="text-xs font-semibold text-rose-500"
                    >
                      {errorMessage}
                    </motion.p>
                  )}

                  {customStarsAmount && parseInt(customStarsAmount) >= 50 && (
                    <motion.div 
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl flex justify-between items-center text-sm font-sans"
                    >
                      <span className="text-zinc-500 dark:text-zinc-400 font-medium">
                        {lang === "ru" ? "Итоговая стоимость:" : "Підсумкова вартість:"}
                      </span>
                      <span className="font-extrabold text-amber-600 dark:text-amber-400">
                        {calcStarsPrice(parseInt(customStarsAmount))} грн
                      </span>
                    </motion.div>
                  )}

                  <div className="pt-4 space-y-2">
                    <button 
                      onClick={handleCustomStarsNext}
                      className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-bold tracking-tight shadow-md cursor-pointer transition-all active:scale-95"
                      id="custom-stars-next-btn"
                    >
                      {currentT.next}
                    </button>
                    <button 
                      onClick={() => { setCurrentScreen("catalog"); setErrorMessage(null); }}
                      className="w-full py-3 bg-transparent text-zinc-500 dark:text-zinc-400 text-xs font-bold hover:underline cursor-pointer"
                    >
                      {currentT.cancel}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* SCREEN 3: RECIPIENT USERNAME */}
            {currentScreen === "username" && (
              <motion.div
                key="username"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6 pt-4"
                id="username-screen"
              >
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => { 
                      setCurrentScreen(selectedProduct.value && customStarsAmount ? "custom-stars" : "catalog"); 
                      setErrorMessage(null); 
                    }}
                    className="p-2 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <h1 className="text-xl font-bold tracking-tight">{currentT.recipientTitle}</h1>
                </div>

                <div className="space-y-4">
                  <p 
                    className="text-sm text-zinc-500 dark:text-zinc-400"
                    dangerouslySetInnerHTML={{ __html: currentT.recipientDesc }}
                  />

                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 font-bold text-md">@</span>
                    <input 
                      type="text"
                      value={recipientUsername}
                      onChange={(e) => setRecipientUsername(e.target.value)}
                      placeholder={currentT.usernamePlaceholder}
                      className="w-full pl-8 pr-4 py-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 focus:outline-none focus:ring-2 focus:ring-blue-500 font-sans text-md font-medium transition-all"
                      id="username-input"
                    />
                  </div>

                  {errorMessage && (
                    <motion.p 
                      initial={{ opacity: 0 }} 
                      animate={{ opacity: 1 }} 
                      className="text-xs font-semibold text-rose-500 leading-relaxed"
                    >
                      {errorMessage}
                    </motion.p>
                  )}

                  <div className="pt-4 space-y-2">
                    <button 
                      onClick={handleUsernameNext}
                      className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold tracking-tight shadow-md cursor-pointer transition-all active:scale-95"
                      id="username-submit-btn"
                    >
                      {currentT.toPayment}
                    </button>
                    <button 
                      onClick={() => { setCurrentScreen("catalog"); setErrorMessage(null); }}
                      className="w-full py-3 bg-transparent text-zinc-500 dark:text-zinc-400 text-xs font-bold hover:underline cursor-pointer"
                    >
                      {currentT.cancel}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* SCREEN 4: PAYMENT & RECEIPT UPLOADER */}
            {currentScreen === "payment" && (
              <motion.div
                key="payment"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-5 pt-2"
                id="payment-screen"
              >
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => { setCurrentScreen("username"); setErrorMessage(null); }}
                    className="p-2 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <h1 className="text-xl font-bold tracking-tight">{currentT.paymentTitle}</h1>
                </div>

                {/* Summary Box */}
                <div className="p-4 bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800 rounded-2xl text-xs space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500 font-medium">{currentT.payItem}</span>
                    <span className="font-bold text-zinc-800 dark:text-zinc-100">{selectedProduct.label}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500 font-medium">{currentT.payUser}</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400">@{selectedProduct.recipient}</span>
                  </div>
                  <div className="border-t border-zinc-100 dark:border-zinc-800/60 my-1 pt-1.5 flex justify-between items-center font-bold text-sm">
                    <span className="text-zinc-700 dark:text-zinc-300">
                      {lang === "ru" ? "Сумма к оплате:" : "Сума до оплати:"}
                    </span>
                    <span className="text-emerald-600 dark:text-emerald-400">{selectedProduct.price} грн</span>
                  </div>
                </div>

                <p 
                  className="text-xs text-center text-zinc-600 dark:text-zinc-400"
                  dangerouslySetInnerHTML={{ __html: currentT.payDesc.replace("{price}", `<b>${selectedProduct.price}</b>`) }}
                />

                {/* Beautiful dynamic credit card */}
                <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-600 to-indigo-700 text-white rounded-2xl p-5 shadow-lg shadow-blue-600/10 space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-1.5">
                      <CreditCard className="w-5 h-5 text-blue-200" />
                      <span className="text-xs font-mono font-bold tracking-widest text-blue-100">CARD CHPRR</span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/20 uppercase tracking-wider">Monobank</span>
                  </div>

                  <div className="flex items-center justify-between py-2">
                    <div className="text-md sm:text-lg font-mono font-bold letter-spacing-2 text-zinc-100" id="card-display-value">
                      {config.cardNumber}
                    </div>
                    <button 
                      onClick={() => copyToClipboard(config.cardNumber, "card")}
                      className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer active:scale-95 transition-all"
                      id="copy-card-btn"
                    >
                      {isCopiedCard ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>

                  <div className="flex justify-between items-end text-xs text-blue-100 font-medium">
                    <div>
                      <div className="text-[9px] opacity-75 uppercase">Cardholder</div>
                      <div className="font-semibold">chprrshop</div>
                    </div>
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  </div>
                </div>

                <div className="bg-rose-500/10 border border-rose-500/10 rounded-xl p-3 text-[11px] font-semibold text-rose-600 dark:text-rose-400 text-center">
                  {currentT.alertCommission}
                </div>

                {/* Receipt Upload area */}
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 text-center">
                    {currentT.payHint}
                  </p>

                  <div 
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${
                      dragActive 
                        ? "border-blue-500 bg-blue-500/5" 
                        : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/20"
                    }`}
                    id="receipt-dropzone"
                  >
                    <input 
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="image/*"
                      className="hidden"
                    />

                    {receiptImage ? (
                      <div className="w-full space-y-3 relative" onClick={(e) => e.stopPropagation()}>
                        <div className="relative mx-auto w-28 h-28 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden bg-zinc-100">
                          <img 
                            src={receiptImage} 
                            alt="Receipt Preview" 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <button 
                            onClick={() => { setReceiptImage(null); setReceiptFile(null); }}
                            className="absolute top-1 right-1 p-1 bg-rose-500 hover:bg-rose-600 text-white rounded-full shadow-lg"
                            title={currentT.removeReceipt}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center gap-1.5">
                          <CheckCircle className="w-4 h-4" />
                          <span>{receiptFile?.name || "receipt.jpg"}</span>
                        </div>
                      </div>
                    ) : (
                      <>
                        <UploadCloud className="w-8 h-8 text-zinc-400 animate-bounce" />
                        <div>
                          <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{currentT.uploadPrompt}</p>
                          <p className="text-[10px] text-zinc-400 mt-0.5">{currentT.uploadFormat}</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {errorMessage && (
                  <p className="text-xs font-semibold text-rose-500 text-center">{errorMessage}</p>
                )}

                {/* Confirm Checkout Button */}
                <div className="pt-2 space-y-2">
                  <button 
                    disabled={!receiptImage || isSubmitting}
                    onClick={handleSubmitOrder}
                    className={`w-full py-3.5 rounded-xl text-sm font-bold tracking-tight shadow-md cursor-pointer transition-all active:scale-95 flex items-center justify-center gap-2 ${
                      receiptImage && !isSubmitting
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white" 
                        : "bg-zinc-200 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed"
                    }`}
                    id="submit-order-btn"
                  >
                    {isSubmitting ? (
                      <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      currentT.btnPaid
                    )}
                  </button>
                  <button 
                    onClick={() => { setCurrentScreen("username"); setErrorMessage(null); }}
                    className="w-full py-2 bg-transparent text-zinc-500 dark:text-zinc-400 text-xs font-bold hover:underline cursor-pointer"
                  >
                    {currentT.btnChange}
                  </button>
                </div>
              </motion.div>
            )}

            {/* SCREEN 5: SUCCESS CONFIRMATION */}
            {currentScreen === "success" && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-6 pt-8 text-center"
                id="success-screen"
              >
                <div className="mx-auto w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-10 h-10 text-emerald-500" />
                </div>

                <div className="space-y-2">
                  <h1 className="text-2xl font-black text-zinc-800 dark:text-zinc-100">{currentT.orderSuccess}</h1>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto leading-relaxed">
                    {currentT.successDesc}
                  </p>
                </div>

                <div className="p-4 bg-zinc-50 dark:bg-zinc-800/30 border border-zinc-100 dark:border-zinc-800/60 rounded-2xl max-w-sm mx-auto text-xs space-y-2 text-left">
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500">{currentT.payItem}</span>
                    <span className="font-bold">{selectedProduct.label}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500">{currentT.payUser}</span>
                    <span className="font-bold text-blue-600">@{selectedProduct.recipient}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500">{lang === "ru" ? "Сумма:" : "Сума:"}</span>
                    <span className="font-bold text-emerald-600">{selectedProduct.price} грн</span>
                  </div>
                </div>

                <p className="text-xs text-zinc-400 max-w-xs mx-auto leading-relaxed">
                  {currentT.successNext}
                </p>

                <div className="pt-6">
                  <button 
                    onClick={handleClose}
                    className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold tracking-tight shadow-md cursor-pointer transition-all active:scale-95"
                    id="success-close-btn"
                  >
                    {currentT.successClose}
                  </button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

      </div>
    </div>
  );
}
