# Financial Wisdom — Frontend

React + TypeScript + Tailwind CSS + Recharts

## Kurulum

```bash
npm install
```

## Geliştirme

```bash
npm run dev
# http://localhost:5173
```

Backend `http://localhost:8000` üzerinde çalışıyor olmalı.  
`.env` dosyası oluşturulacaksa:

```
VITE_API_URL=http://localhost:8000/api/v1
```

## Build

```bash
npm run build
```

## Sayfalar

| Route | Açıklama |
|---|---|
| `/` | Landing Page |
| `/register` | Kayıt (UC-01) |
| `/login` | Giriş (UC-02) |
| `/questionnaire` | Risk Anketi — 15 soru (UC-03) |
| `/profile/result` | Profil Sonucu (UC-03) |
| `/dashboard` | Portföy Dashboard (UC-05) |
| `/assets/:ticker` | Varlık Detay (UC-07) |
| `/compare` | Senaryo Karşılaştırma (UC-06) |
| `/admin` | Admin Paneli — sadece admin (UC-09) |
