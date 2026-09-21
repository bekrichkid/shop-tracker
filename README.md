# Tovar Do'koni — Xarid, Sotish va Moliyaviy Kuzatuv

Real tovarlar katalogidan (FakeStoreAPI) xarid qilish, sotish va shu bilan bog'liq daromad/xarajatlarni avtomatik hisoblab boradigan ilova.

## Texnologiyalar

- **Frontend:** React + Vite, Recharts (grafiklar)
- **Backend:** Node.js + Express, Netlify Function sifatida (`serverless-http` bilan o'ralgan)
- **Ma'lumotlar bazasi:** Postgres (Neon)
- **Tovarlar:** [FakeStoreAPI](https://fakestoreapi.com) orqali real mahsulot ma'lumotlari (nom, rasm, narx, reyting)

## Imkoniyatlar

- **Hisoblar**: email + parol, har bir foydalanuvchining ma'lumotlari alohida; ilova ichida hisobni o'chirish
- **Do'kon**: tovarlarni qidirish/saralash/filtrlash, **savat** va buyurtma. To'lov (Payme) tasdiqlangach tovar **omborga** tushadi va **xarajat** sifatida yoziladi
- **Buyurtmalarim**: holatlar (kutilmoqda / to'langan / bekor), qayta to'lash, bekor qilish
- **Omborim**: hozir qo'lingizdagi (sotilmagan) tovarlar ro'yxati, har birini "Sotish" — bu avtomatik **daromad** sifatida yoziladi va foyda/zarar hisoblanadi
- To'liq daromad/xarajat kuzatuvi: balans, davr bo'yicha kartalar (bugun/7 kun/shu oy/barchasi), qo'lda yozuv qo'shish
- Ombordagi tovarlar umumiy qiymati
- Oylik foyda maqsadi va progress-bar
- Kategoriya bo'yicha doira diagramma, oxirgi 14 kunlik grafik
- Filtr va CSV eksport
- Kunduzgi/tungi rejim

## To'lov (Payme)

Callback manzil (Payme kabinetida ro'yxatdan o'tkaziladi): `https://<sayt>/api/payme`.
Netlify muhit o'zgaruvchilari: `PAYME_MERCHANT_ID`, `PAYME_KEY`, `APP_URL`, ixtiyoriy `PAYME_TEST=on`, `USD_TO_UZS`.
Kalitlar qo'yilmaguncha **Demo** to'lov ishlaydi (haqiqiy pul yechilmaydi); kalitlar qo'yilgach u avtomatik o'chadi.
Merchant API to'liq qo'llab-quvvatlanadi: CheckPerform/Create/Perform/Cancel/CheckTransaction/GetStatement.

## Katalog

Tovarlar Postgres'dagi `products` jadvalida (birinchi ishga tushishda `server/catalog.json`'dan to'ldiriladi, rasmlar `client/public/products/`). `GET /api/products` ochiq. Buyurtmada narx va nom **faqat serverdagi katalogdan** olinadi, mijoz yuborgan narxga ishonilmaydi.
`ADMIN_EMAILS` (Netlify env) ichidagi emaillar `GET/POST /api/admin/products`, `PUT /api/admin/products/:id` orqali tovar qo'shishi, narxini o'zgartirishi yoki `{"active":false}` bilan sotuvdan olishi mumkin.

## Kompaniya tomoni (Boshqaruv paneli)

`ADMIN_EMAILS` ichidagi hisob Profil → **Boshqaruv paneli**ni ko'radi:
- **Buyurtmalar**: yangi → tayyorlanmoqda → yo'lda → yetkazildi; mijoz telefoni (bosib qo'ng'iroq), manzil, izoh (mijozga ko'rinadi)
- **Tovarlar**: qo'shish, narx, zaxira (bo'sh = cheksiz), rasm, yashirish
- **Statistika**: bugun/7/30 kun tushum, bajarilishi kerak buyurtmalar, eng ko'p sotilganlar, zaxira tugayotganlar
- Yangi to'langan buyurtma haqida **Telegram** xabari (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`)
- Mijoz Profilida: Buyurtmalarim (holat chizig'i, qayta buyurtma), qo'ng'iroq/Telegram aloqa (`SUPPORT_*`)

## Mahalliy ishga tushirish

### 1. Postgres

```bash
docker run -d --name shop-tracker-pg -e POSTGRES_PASSWORD=devpass -e POSTGRES_DB=shop_tracker -p 5434:5432 postgres:16-alpine
```

Yoki [neon.tech](https://neon.tech) da bepul loyiha yarating.

### 2. `.env`

```bash
cp .env.example .env
```

`DATABASE_URL`ni o'zgartiring.

### 3. Ishga tushirish

```bash
npm install
npm run dev:server
```

Boshqa terminalda:

```bash
cd client
npm install
npm run dev
```

**http://localhost:5273** ni oching.

## Netlify'ga deploy qilish

1. Kodni GitHub'ga yuklang.
2. [neon.tech](https://neon.tech) da Postgres loyihasi yarating, connection string'ni oling.
3. [app.netlify.com](https://app.netlify.com) → **Add new site → Import an existing project** → repo'ni tanlang. `netlify.toml` avtomatik o'qiladi.
4. **Site configuration → Environment variables** → `DATABASE_URL` qo'shing (Neon'dan olingan qiymat bilan).
5. Qayta deploy qiling (**Trigger deploy**).

Frontend ham, `/api/*` backend ham bitta domenda ishlaydi — alohida sozlash kerak emas.
