# Tovar Do'koni — Xarid, Sotish va Moliyaviy Kuzatuv

Real tovarlar katalogidan (FakeStoreAPI) xarid qilish, sotish va shu bilan bog'liq daromad/xarajatlarni avtomatik hisoblab boradigan ilova.

## Texnologiyalar

- **Frontend:** React + Vite, Recharts (grafiklar)
- **Backend:** Node.js + Express, Netlify Function sifatida (`serverless-http` bilan o'ralgan)
- **Ma'lumotlar bazasi:** Postgres (Neon)
- **Tovarlar:** [FakeStoreAPI](https://fakestoreapi.com) orqali real mahsulot ma'lumotlari (nom, rasm, narx, reyting)

## Imkoniyatlar

- **Do'kon**: real tovarlar katalogini ko'rish, kategoriya bo'yicha filtrlash, "Sotib olish" — bu avtomatik **xarajat** sifatida yoziladi va tovar **ombor**ga qo'shiladi
- **Omborim**: hozir qo'lingizdagi (sotilmagan) tovarlar ro'yxati, har birini "Sotish" — bu avtomatik **daromad** sifatida yoziladi va foyda/zarar hisoblanadi
- To'liq daromad/xarajat kuzatuvi: balans, davr bo'yicha kartalar (bugun/7 kun/shu oy/barchasi), qo'lda yozuv qo'shish
- Ombordagi tovarlar umumiy qiymati
- Oylik foyda maqsadi va progress-bar
- Kategoriya bo'yicha doira diagramma, oxirgi 14 kunlik grafik
- Filtr va CSV eksport
- Kunduzgi/tungi rejim

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
