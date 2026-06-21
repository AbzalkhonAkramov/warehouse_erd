/// Lightweight localization catalog (mirrors web/src/i18n/messages.ts).
/// Default language is Russian.
enum AppLang { ru, uz, en }

const Map<AppLang, String> langLabels = {
  AppLang.ru: 'Русский',
  AppLang.uz: "O‘zbekcha",
  AppLang.en: 'English',
};

const Map<String, String> _en = {
  'common.signOut': 'Sign out',
  'common.cancel': 'Cancel',
  'common.retry': 'Retry',
  'common.error': 'Something went wrong',

  'login.subtitle': 'Field agent sign in',
  'login.email': 'Email',
  'login.password': 'Password',
  'login.signIn': 'Sign in',
  'login.signingIn': 'Signing in…',

  'home.customers': 'My customers',
  'home.order': 'New order',
  'home.photos': 'Photo report',
  'tab.customers': 'Customers',
  'tab.order': 'Order',
  'tab.photos': 'Photos',

  'customers.empty': 'No customers assigned to you.',
  'customers.debt': 'Debt',
  'customers.limit': 'Limit',
  'customers.newShop': 'New shop',

  'createShop.title': 'New shop',
  'field.name': 'Name',
  'field.phone': 'Phone',
  'field.address': 'Address',
  'createShop.submit': 'Create shop',
  'createShop.success': 'Shop created',

  'order.customer': 'Customer',
  'order.total': 'Total',
  'order.submit': 'Submit order',
  'order.sent': 'Order #{id} sent for approval',
  'order.autoApproved': 'Order #{id} approved (in stock)',
  'product.stock': 'stock',

  'photo.customer': 'Customer (shop)',
  'photo.topic': 'Topic (theme)',
  'photo.topicHelp': 'Leave default to use your assigned topic',
  'photo.defaultTopic': 'Default topic',
  'photo.note': 'Note (optional)',
  'photo.send': 'Send before/after',
  'photo.sending': 'Sending…',
  'photo.sentOk': 'Photos sent to the Telegram topic ✓',
  'photo.sentFail': 'Saved, but Telegram failed: {error}',
  'photo.before': 'BEFORE',
  'photo.after': 'AFTER',
};

const Map<String, String> _ru = {
  'common.signOut': 'Выйти',
  'common.cancel': 'Отмена',
  'common.retry': 'Повторить',
  'common.error': 'Что-то пошло не так',

  'login.subtitle': 'Вход для агента',
  'login.email': 'Эл. почта',
  'login.password': 'Пароль',
  'login.signIn': 'Войти',
  'login.signingIn': 'Вход…',

  'home.customers': 'Мои клиенты',
  'home.order': 'Новый заказ',
  'home.photos': 'Фотоотчёт',
  'tab.customers': 'Клиенты',
  'tab.order': 'Заказ',
  'tab.photos': 'Фото',

  'customers.empty': 'У вас пока нет клиентов.',
  'customers.debt': 'Долг',
  'customers.limit': 'Лимит',
  'customers.newShop': 'Новый магазин',

  'createShop.title': 'Новый магазин',
  'field.name': 'Название',
  'field.phone': 'Телефон',
  'field.address': 'Адрес',
  'createShop.submit': 'Создать магазин',
  'createShop.success': 'Магазин создан',

  'order.customer': 'Клиент',
  'order.total': 'Итого',
  'order.submit': 'Отправить заказ',
  'order.sent': 'Заказ №{id} отправлен на подтверждение',
  'order.autoApproved': 'Заказ №{id} подтверждён (есть на складе)',
  'product.stock': 'остаток',

  'photo.customer': 'Клиент (магазин)',
  'photo.topic': 'Тема',
  'photo.topicHelp': 'Оставьте по умолчанию, чтобы использовать назначенную тему',
  'photo.defaultTopic': 'Тема по умолчанию',
  'photo.note': 'Примечание (необязательно)',
  'photo.send': 'Отправить до/после',
  'photo.sending': 'Отправка…',
  'photo.sentOk': 'Фото отправлены в тему Telegram ✓',
  'photo.sentFail': 'Сохранено, но Telegram не сработал: {error}',
  'photo.before': 'ДО',
  'photo.after': 'ПОСЛЕ',
};

const Map<String, String> _uz = {
  'common.signOut': 'Chiqish',
  'common.cancel': 'Bekor qilish',
  'common.retry': 'Qayta urinish',
  'common.error': 'Xatolik yuz berdi',

  'login.subtitle': 'Agent uchun kirish',
  'login.email': 'Email',
  'login.password': 'Parol',
  'login.signIn': 'Kirish',
  'login.signingIn': 'Kirilmoqda…',

  'home.customers': 'Mening mijozlarim',
  'home.order': 'Yangi buyurtma',
  'home.photos': 'Foto hisobot',
  'tab.customers': 'Mijozlar',
  'tab.order': 'Buyurtma',
  'tab.photos': 'Foto',

  'customers.empty': "Sizda hozircha mijozlar yo‘q.",
  'customers.debt': 'Qarz',
  'customers.limit': 'Limit',
  'customers.newShop': "Yangi do‘kon",

  'createShop.title': "Yangi do‘kon",
  'field.name': 'Nomi',
  'field.phone': 'Telefon',
  'field.address': 'Manzil',
  'createShop.submit': "Do‘kon yaratish",
  'createShop.success': "Do‘kon yaratildi",

  'order.customer': 'Mijoz',
  'order.total': 'Jami',
  'order.submit': 'Buyurtmani yuborish',
  'order.sent': 'Buyurtma №{id} tasdiqlashga yuborildi',
  'order.autoApproved': 'Buyurtma №{id} tasdiqlandi (omborda bor)',
  'product.stock': 'qoldiq',

  'photo.customer': "Mijoz (do‘kon)",
  'photo.topic': 'Mavzu',
  'photo.topicHelp': 'Tayinlangan mavzudan foydalanish uchun asosiyni qoldiring',
  'photo.defaultTopic': 'Asosiy mavzu',
  'photo.note': 'Izoh (ixtiyoriy)',
  'photo.send': 'Oldin/keyin yuborish',
  'photo.sending': 'Yuborilmoqda…',
  'photo.sentOk': 'Foto Telegram mavzusiga yuborildi ✓',
  'photo.sentFail': 'Saqlandi, lekin Telegram ishlamadi: {error}',
  'photo.before': 'OLDIN',
  'photo.after': 'KEYIN',
};

const Map<AppLang, Map<String, String>> messages = {
  AppLang.ru: _ru,
  AppLang.uz: _uz,
  AppLang.en: _en,
};
