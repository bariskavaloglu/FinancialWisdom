# FinancialWisdom

Kişiselleştirilmiş portföy öneri sistemi — FastAPI + React + PostgreSQL + Redis.

---

## Hızlı Başlangıç
Alp
### 1. Ortam değişkenleri

```bash
cp backend/.env.example backend/.env
# backend/.env dosyasını düzenleyin
```

### 2. Docker Compose ile çalıştır

```bash
cd backend
docker-compose up --build
```

Frontend için:

```bash
cd frontend
npm install
npm run dev
```

---

## Admin Hesabı Oluşturma

Admin paneline erişmek için bir admin hesabı gerekir.  
**Üç farklı yöntem vardır:**

### Yöntem 1 — Script ile (Önerilen)

Backend klasöründen çalıştırın:

```bash
cd backend

# Varsayılan: admin@financialwisdom.me
python create_admin.py

# Özel e-posta ve isimle:
python create_admin.py --email sizin@email.com --name "Ad Soyad"

# Mevcut bir kullanıcıyı admin'e yükselt:
python create_admin.py --promote kullanici@email.com
```

Script, `DATABASE_URL` ortam değişkenini okur ya da `backend/.env` dosyasından yükler.

### Yöntem 2 — Docker içinden

```bash
docker exec -it financialwisdom-backend python create_admin.py \
  --email admin@sirket.com \
  --name "Admin Ad" \
  --password gizli_sifre
```

### Yöntem 3 — PostgreSQL ile doğrudan

```sql
-- Şifre hash'i için bcrypt gerekir; yöntem 1 veya 2 tercih edin.
UPDATE users
SET role = 'admin', is_email_verified = TRUE
WHERE email = 'kullanici@email.com';
```

### Admin girişi

Admin hesabı oluşturduktan sonra normal giriş sayfasından (`/login`) giriş yapın.  
Navbar'da **"Yönetici"** menüsü görünür olur.

---

## Admin Paneli

`/admin` sayfasında üç bölüm bulunur:

### 👥 Kullanıcı Kısıtları

Belirli kullanıcıların portföyüne **varlık sınıfı bazında min/max sınır** koyabilirsiniz.

- Örnek: Yeni kullanıcıya kripto maksimum %5 ile sınırla
- Örnek: Muhafazakâr profil için nakit minimum %20 zorunlu kıl
- Her kısıt için **sebep açıklaması** zorunludur (audit kaydı)
- Kısıtlar portföy algoritmasını değiştirmez; sadece sonucu sınırlandırır

**Teknik detay:** Kısıtlar Algorithm D'nin `GUARDRAILS` sistemine dinamik olarak eklenir.  
Portföy üretim motoru (`portfolio_engine.py`) ve questionnaire mantığı hiç değişmez.

### ⚙️ Sistem Konfigürasyonu

- Factor scoring ağırlıklarını (momentum, value, quality, volatility) düzenleyin
- yfinance önbellek TTL süresini ayarlayın
- Redis ve fallback ayarlarını yönetin

### 🗄️ Önbellek

- Redis önbellek durumunu görüntüleyin
- Önbelleği manuel olarak temizleyin (piyasa verisi güncellemek için)

---

## Değişiklikler (Bu Güncelleme)

### 1. pandas-ta Teknik Analiz Entegrasyonu

`backend/requirements.txt`'e `pandas-ta==0.3.14b` eklendi.  
`factor_scoring.py` yeni teknik indikatörlerle güçlendirildi:

| İndikatör | Kullanım | Faktör Etkisi |
|-----------|---------|---------------|
| RSI(14)   | Aşırı satım/alım | Momentum +%40 |
| MACD      | Trend yönü | Momentum +%40 |
| ATR(14)   | Gerçek aralık | Volatility +%50 |
| Bollinger Band | Band genişliği + %B | Volatility + Value |
| ADX(14)   | Trend gücü + yön | Quality +%50 |

**Harmanlama:** Orijinal faktörler korunur, TA skorları ile blend edilir.  
pandas-ta kurulu değilse sadece orijinal faktörler kullanılır (graceful fallback).

### 2. Koyu Tema Düzeltmeleri

Aşağıdaki sayfalarda eksik `dark:` class'ları tamamlandı:
- `AdminPage`, `LoginPage`, `VerifyEmailPage`, `NotFoundPage`
- `ProfileResultPage`, `AssetDetailPage`, `MarketPoolPage`, `QuestionnairePage`

### 3. Sistem Diline/Temasına Göre Otomatik Başlangıç

`ThemeLanguageContext.tsx` güncellendi:

- **İlk ziyarette:** `window.matchMedia('prefers-color-scheme: dark')` ile tema, `navigator.language` ile dil otomatik seçilir
- **Sonraki ziyaretlerde:** localStorage'daki kullanıcı tercihi önceliklidir
- **Canlı takip:** OS teması değişince uygulama güncellenir (kullanıcı manuel seçmemişse)

### 4. Admin Override Sistemi

**Yeni dosyalar:**
- `backend/app/models/admin_override.py` — `AdminOverride` veritabanı modeli
- `backend/alembic/versions/001_add_admin_overrides.py` — Migration
- `backend/create_admin.py` — Admin hesabı oluşturma scripti

**Güncellenen dosyalar:**
- `backend/app/routers/admin.py` — Override CRUD endpoint'leri
- `backend/app/routers/assessments.py` — Anket submitinde override'ları yükle
- `backend/app/services/portfolio_engine.py` — `extra_guardrails` parametresi
- `backend/app/models/user.py` — `admin_overrides` ilişkisi
- `backend/app/models/__init__.py` — `AdminOverride` import
- `backend/app/schemas/admin.py` — Override şemaları
- `frontend/src/pages/AdminPage.tsx` — Tam yeniden yazıldı
- `frontend/src/services/index.ts` — Override API çağrıları
- `frontend/src/types/index.ts` — `AdminOverride`, `UserWithOverrides` tipleri

---

## Veritabanı Migrasyonu

Mevcut bir veritabanı varsa migration çalıştırın:

```bash
cd backend
alembic upgrade head
```

Yeni kurulumda `Base.metadata.create_all()` startup'ta otomatik çalışır — migration gerekmez.

---

## API Dokümantasyonu

Sunucu çalışırken: [http://localhost:8000/docs](http://localhost:8000/docs)

### Yeni Admin Endpoint'leri

| Yöntem | URL | Açıklama |
|--------|-----|---------|
| `GET` | `/api/v1/admin/overrides` | Tüm aktif override'lar |
| `GET` | `/api/v1/admin/overrides/user/{user_id}` | Kullanıcı override'ları |
| `POST` | `/api/v1/admin/overrides` | Yeni override oluştur |
| `PUT` | `/api/v1/admin/overrides/{id}` | Override güncelle |
| `DELETE` | `/api/v1/admin/overrides/{id}` | Override deaktif et |

---

## Mimari

```
frontend/          React 18 + TypeScript + Vite + Tailwind
backend/
  app/
    models/        SQLAlchemy ORM (User, RiskAssessment, Portfolio, AdminOverride)
    routers/       FastAPI router'ları (auth, assessments, portfolios, admin, pool)
    services/
      portfolio_engine.py  Algorithm D — questionnaire → ağırlıklar
      factor_scoring.py    Layer 2 — pandas-ta destekli instrument seçimi
      market_data.py       yfinance + Redis önbellek
    schemas/       Pydantic şemaları
    core/          Config, DB, Redis, Security, Email
  alembic/         Veritabanı migrasyonları
  create_admin.py  Admin hesabı oluşturma scripti
```

---

## Teknoloji Yığını

| Katman | Teknoloji |
|--------|-----------|
| Backend | FastAPI 0.111, Python 3.11 |
| ORM | SQLAlchemy 2.0 + Alembic |
| Veritabanı | PostgreSQL 15 |
| Önbellek | Redis 7 |
| Piyasa Verisi | yfinance + pandas-ta |
| Frontend | React 18 + TypeScript + Vite |
| Stil | Tailwind CSS v3 (dark mode) |
| Container | Docker Compose |

---

> ⚠️ Bu uygulama yalnızca eğitim amaçlıdır. Finansal tavsiye niteliği taşımaz.
