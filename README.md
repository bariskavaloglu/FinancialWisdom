# 💰 FinancialWisdom

Kişiselleştirilmiş portföy oluşturma ve yatırım karar destek platformu.

> Şile Işık Üniversitesi — Mezuniyet Projesi 2026

---

## 📌 Proje Hakkında

FinancialWisdom, kullanıcıların risk profillerini belirleyip buna uygun yatırım portföyü önerisi aldığı bir web uygulamasıdır. 15 soruluk anket ile kullanıcının finansal hedefleri, risk toleransı ve yatırım ufku analiz edilir. Sonuçlar BIST hisseleri, ETF'ler ve emtialar arasında dağıtılmış kişisel bir portföy olarak sunulur.

### Özellikler

- 📋 15 soruluk risk profili anketi (5 kategori)
- 📊 Kişiselleştirilmiş portföy önerisi
- 📈 Faktör skoru ve momentum analizi
- 🔄 Senaryo karşılaştırma
- 📧 E-posta doğrulama sistemi
- 👤 Kullanıcı kimlik doğrulama (JWT)

---

## 🛠️ Teknoloji Stack

| Katman | Teknoloji |
|--------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Backend | Python 3.11, FastAPI, SQLAlchemy |
| Veritabanı | PostgreSQL 15 |
| Cache | Redis 7 |
| Container | Docker, Docker Compose |

---

## ✅ Ön Gereksinimler

Kurulum öncesi bilgisayarında şunların kurulu olması gerekiyor:

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (v24+)
- [Node.js](https://nodejs.org/) (v18+)
- [Git](https://git-scm.com/)

---

## 🚀 Kurulum

### 1. Projeyi Klonla

```bash
git clone https://github.com/KULLANICI_ADIN/FinancialWisdom.git
cd FinancialWisdom
```

### 2. Backend `.env` Dosyasını Oluştur

```bash
cd backend
copy .env.example .env   # Windows
cp .env.example .env     # Mac/Linux
```

`.env` dosyasını aç ve `SECRET_KEY` alanını doldur:

```bash
# Terminalde güvenli key üret:
python -c "import secrets; print(secrets.token_hex(32))"
```

Üretilen değeri `.env` içine yapıştır:

```env
SECRET_KEY=buraya_üretilen_değeri_yapıştır
```

> Diğer alanlar (DATABASE_URL, REDIS_URL) varsayılan değerleriyle çalışır.

### 3. Docker ile Backend'i Başlat

```bash
# backend klasöründeyken:
docker compose up -d db redis backend
```

İlk çalıştırmada Docker imajları indirilir (~2-3 dakika).

Kontrol et:

```bash
docker compose ps
```

3 container da `healthy` / `running` görünmeli.

### 4. API'yi Doğrula

Tarayıcıda aç → **http://localhost:8000/docs**

Swagger sayfası açılıyorsa backend hazır ✅

### 5. Frontend'i Başlat

Yeni bir terminal aç:

```bash
cd frontend
npm install
npm run dev
```

Tarayıcıda aç → **http://localhost:5173**

---

## 📱 İlk Kullanım

1. **http://localhost:5173** adresine git
2. **Kayıt ol** — e-posta ve şifre gir
3. **E-posta doğrulama** — terminalde token'ı al:
   ```bash
   docker compose logs backend | findstr "token"     # Windows
   docker compose logs backend | grep "token"        # Mac/Linux
   ```
   Çıkan URL'yi tarayıcıya yapıştır
4. **Giriş yap** → Anketi doldur → Profili Hesapla → Dashboard

---

## 🌐 Servis Adresleri

| Servis | Adres |
|--------|-------|
| 🌐 Uygulama | http://localhost:5173 |
| ⚙️ API | http://localhost:8000 |
| 📄 Swagger Docs | http://localhost:8000/docs |

---

## 📁 Proje Yapısı

```
FinancialWisdom/
├── backend/
│   ├── app/
│   │   ├── core/          # Config, DB, Redis, Security, Email
│   │   ├── models/        # User, Portfolio, Assessment
│   │   ├── routers/       # auth, portfolios, assessments, instruments, admin
│   │   ├── schemas/       # Pydantic request/response şemaları
│   │   └── services/      # Portfolio engine, market data, factor scoring
│   ├── tests/
│   ├── docker-compose.yml
│   ├── Dockerfile
│   ├── requirements.txt
│   └── .env.example
│
└── frontend/
    └── src/
        ├── components/    # Layout, UI bileşenleri
        ├── context/       # AuthContext (JWT)
        ├── pages/         # Dashboard, Login, Questionnaire...
        ├── services/      # API istemcisi
        └── types/         # TypeScript tipleri
```

---

## 🔧 Sık Kullanılan Komutlar

```bash
# Backend servislerini başlat
docker compose up -d db redis backend

# Logları izle
docker compose logs backend -f

# Servisleri durdur
docker compose stop

# Tüm container ve verileri sil
docker compose down -v
```

---

## ❗ Sık Karşılaşılan Sorunlar

| Sorun | Çözüm |
|-------|-------|
| Docker başlamıyor | Docker Desktop'ı aç, yeşil olmasını bekle |
| `Port already in use` | `docker compose down` sonra tekrar `up` |
| Doğrulama maili gelmiyor | `EMAILS_ENABLED=false` ise token terminalde görünür |
| Faktör skorları %50 | Yahoo Finance rate limit — 1-2 dk bekle, tekrar dene |
| Frontend API'ye bağlanamıyor | `frontend/.env` → `VITE_API_URL=http://localhost:8000/api/v1` olduğunu kontrol et |

---

## 👥 Ekip

| İsim | Rol |
|------|-----|
| ... | Backend |
| ... | Frontend |
| ... | Veritabanı & Analiz |

---

## 📄 Lisans

Bu proje Şile Işık Üniversitesi mezuniyet projesi kapsamında geliştirilmiştir.
