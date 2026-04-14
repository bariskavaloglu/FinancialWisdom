# Financial Wisdom — Full Stack

```
FinancialWisdom_Full/
├── frontend/   → React + TypeScript + Vite
└── backend/    → FastAPI + PostgreSQL + Redis
```

## Başlatma

### 1. Backend (Docker ile)
```bash
cd backend
docker-compose up --build
# → http://localhost:8000/docs
```

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

## .env Dosyaları
- `backend/.env` → SECRET_KEY değerini değiştir
- `frontend/.env` → VITE_API_URL zaten ayarlı (localhost:8000)
