# App Store — tayyorgarlik

Holat: iOS loyiha (`client/ios`, Capacitor 8 + Swift Package Manager) yaratilgan, ikonka va splash qo'yilgan.
**Xcode o'rnatilmagan va Apple Developer hisobi kerak** — quyidagi "Yig'ish" bosqichlari shundan keyin.

## Yig'ish (Xcode o'rnatilgach)

1. Mac App Store'dan **Xcode** o'rnating (~10 GB), birinchi ochilganda komponentlarni o'rnating.
2. `cd client && npm install && npm run build:ios` (web'ni jonli serverga ulab quradi va iOS'ga nusxalaydi).
3. `npx cap open ios` → Xcode ochiladi.
4. Target **App** → Signing & Capabilities → **Team** (Apple Developer hisobingiz) va **Bundle Identifier** (hozir `uz.tovardokoni.shop` — Apple'da o'zingizniki qilib o'zgartiring; shuni `client/capacitor.config.json` dagi `appId` bilan bir xil qiling).
5. Simulyatorda sinab ko'ring → Product → **Archive** → Distribute App → App Store Connect.
6. App Store Connect'da yangi ilova yarating, quyidagi ma'lumotlarni to'ldiring, build'ni tanlab **Review'ga yuboring**. Odatda ko'rib chiqish 1–3 kun.

## Ilova ma'lumotlari

- **Nom:** Tovar Do'koni (30 belgigacha) — do'kon nomingiz bo'lsa, shuni yozing
- **Kategoriya:** Shopping
- **Yosh reytingi:** 4+ (zo'ravonlik/qimor/18+ kontent yo'q; savdo bor, lekin tovar tavsifi umumiy)
- **Narx:** Bepul
- **Til:** O'zbek (asosiy) + Rus
- **Support URL:** do'kon sayti yoki Telegram sahifangiz (`https://bekrichkid-shop-tracker.netlify.app`)
- **Privacy Policy URL:** `https://bekrichkid-shop-tracker.netlify.app/privacy.html` (avval sariq [qavs] joylarni to'ldiring!)
- **Copyright:** © 2026 <kompaniya nomi>

## Matnlar

**Subtitle (30):** Qulay narx, tez yetkazish
**Promo (170):** Kundalik ehtiyoj va sovg'alar uchun sifatli tovarlar. Buyurtma bering, holatini kuzating va uyingizgacha yetkazib beramiz.

**Tavsif (UZ):**
Tovar Do'koni — qulay narxlarda sifatli tovarlarni tez buyurtma qilish ilovasi.

• Katalogdan tovarni qidiring, saralang, sevimlilarga qo'shing
• Savat va promokodlar, yetkazib berish narxi oldindan ko'rinadi
• Payme va Click orqali xavfsiz to'lov
• Buyurtma holatini real vaqtda kuzating: To'landi → Tayyorlanmoqda → Yo'lda → Yetkazildi
• Yetkazilgan tovarni baholang va fikr qoldiring
• O'zbek va rus tillari, qorong'i rejim

Savollar bo'lsa, ilova ichidagi Profil bo'limidan biz bilan bog'laning.

**Описание (RU):**
Tovar Do'koni — приложение для быстрого заказа качественных товаров по доступным ценам.

• Поиск, сортировка и избранное
• Корзина, промокоды, стоимость доставки видна заранее
• Безопасная оплата через Payme и Click
• Отслеживание заказа: Оплачен → Готовится → В пути → Доставлен
• Оценки и отзывы о полученных товарах
• Узбекский и русский языки, тёмная тема

**Keywords (100):** do'kon,tovar,xarid,buyurtma,yetkazib berish,chegirma,promokod,payme,click,магазин,товары,доставка

## App Privacy (so'rovnoma javoblari)

Ilova yig'adi (hammasi "Linked to user", **tracking yo'q**, reklama yo'q):
- **Contact Info:** Email; Name; Phone Number; Physical Address (buyurtma yetkazish uchun) — maqsad: App Functionality
- **User Content:** sharhlar (Customer Support / App Functionality)
- **Purchases:** buyurtmalar tarixi (App Functionality)
- **Identifiers:** yo'q (IDFA ishlatilmaydi)
- Karta ma'lumotlari yig'ilmaydi (Payme/Click o'zlari qayta ishlaydi).

**Encryption:** faqat standart HTTPS → Info.plist'da `ITSAppUsesNonExemptEncryption = false` qo'yilgan.

## Apple tekshiruvchisi uchun (App Review Information)

- **Demo hisob:** tekshiruvchi uchun alohida oddiy mijoz hisobi yarating (masalan `review@<domeningiz>`), parolni shu yerga yozing.
- **Izoh (Notes):** "Ilova jismoniy tovar sotadi (kiyim, aksessuar va h.k.), shuning uchun to'lov Payme/Click orqali tashqi to'lov tizimida amalga oshiriladi — Guideline 3.1.3(e) ga muvofiq (jismoniy tovar va xizmatlar). Ilovada raqamli kontent yoki obuna sotilmaydi. Hisobni o'chirish: Profil → Hisobni o'chirish."
- Sinov uchun to'lov: Payme/Click **test rejimida** ishlashini ta'minlang yoki tekshiruv vaqtida Demo to'lovni yoqib qo'ying (`PAYMENT_DEMO=on`), so'ng o'chiring. ⚠️ Demo yoqilgan paytda jonli sotuv bo'lmasligi kerak.

## Skrinshotlar (App Store Connect talabi)

Kamida 6.9" (iPhone 16/17 Pro Max: 1320×2868) yoki 6.5" (1284×2778) o'lchamida 3–10 ta:
1. Do'kon (katalog) 2. Tovar tafsiloti 3. Savat + promokod 4. Buyurtma holati chizig'i 5. Profil / rus tili.
Xcode simulyatorida `Cmd+S` yoki `xcrun simctl io booted screenshot` bilan olinadi.

## Tekshiruvdan o'tish uchun muhim (Apple guidelines)

- ✅ Hisobni ilova ichida o'chirish bor (5.1.1(v)).
- ✅ Maxfiylik siyosati URL (to'ldirilgan bo'lishi shart).
- ✅ Jismoniy tovar → tashqi to'lov ruxsat (3.1.3(e)).
- ✅ Ijtimoiy tarmoq orqali kirish yo'q → "Sign in with Apple" shart emas.
- ⚠️ "Web sayt o'rami" bo'lib ko'rinmasligi kerak (4.2): ilovada native to'lov oynasi, push yoki boshqa native imkoniyat qo'shish tavsiya (keyingi bosqich: push-bildirishnomalar / Face ID).
- ⚠️ Ilova ichida Demo to'lov tugmasi jonli versiyada ko'rinmasin (real provayder kalitlari qo'yilgach avtomatik yo'qoladi).
