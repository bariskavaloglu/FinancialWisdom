#!/usr/bin/env python3
"""
Admin hesabı oluşturma scripti.

Kullanım:
    python create_admin.py
    python create_admin.py --email admin@example.com --name "Ad Soyad" --password sifre123

Ortam değişkeni olarak DATABASE_URL tanımlı olmalı,
ya da backend/.env dosyasında mevcut olmalı.
"""
import argparse
import os
import sys

# .env dosyasını oku (python-dotenv varsa)
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
except ImportError:
    pass

database_url = os.environ.get("DATABASE_URL")
if not database_url:
    print("HATA: DATABASE_URL ortam değişkeni tanımlı değil.")
    print("  export DATABASE_URL=postgresql://user:pass@localhost:5432/financialwisdom")
    sys.exit(1)

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

engine  = create_engine(database_url)
Session = sessionmaker(bind=engine)

# App modellerini import et
sys.path.insert(0, os.path.dirname(__file__))
from app.models.user import User
from app.core.security import hash_password
import app.models  # noqa: F401 — tüm modeller yüklensin
from app.core.database import Base

# Tabloları oluştur (henüz yoksa)
Base.metadata.create_all(bind=engine)


def create_admin(email: str, full_name: str, password: str) -> None:
    db = Session()
    try:
        existing = db.query(User).filter(User.email == email).first()
        if existing:
            if existing.role == "admin":
                print(f"✓ {email} zaten admin hesabı.")
            else:
                existing.role = "admin"
                existing.is_email_verified = True
                db.commit()
                print(f"✓ {email} hesabı admin rolüne yükseltildi.")
            return

        user = User(
            email=email,
            full_name=full_name,
            hashed_password=hash_password(password),
            role="admin",
            is_active=True,
            is_email_verified=True,  # Admin e-posta doğrulaması beklemez
            email_verify_token=None,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        print(f"✓ Admin hesabı oluşturuldu:")
        print(f"  E-posta : {email}")
        print(f"  Ad      : {full_name}")
        print(f"  ID      : {user.id}")
        print(f"  Rol     : admin")
    finally:
        db.close()


def promote_to_admin(email: str) -> None:
    """Mevcut bir kullanıcıyı admin'e yükselt."""
    db = Session()
    try:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            print(f"HATA: {email} bulunamadı.")
            sys.exit(1)
        user.role = "admin"
        user.is_email_verified = True
        db.commit()
        print(f"✓ {email} admin rolüne yükseltildi.")
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="FinancialWisdom admin hesabı oluştur")
    parser.add_argument("--email",    default="admin@financialwisdom.me", help="Admin e-posta")
    parser.add_argument("--name",     default="Admin",                    help="Ad Soyad")
    parser.add_argument("--password", default=None,                       help="Şifre (girilmezse sorulur)")
    parser.add_argument("--promote",  metavar="EMAIL",                    help="Mevcut kullanıcıyı admin yap")
    args = parser.parse_args()

    if args.promote:
        promote_to_admin(args.promote)
        sys.exit(0)

    password = args.password
    if not password:
        import getpass
        password = getpass.getpass(f"Şifre ({args.email}): ")
        confirm  = getpass.getpass("Şifre tekrar: ")
        if password != confirm:
            print("HATA: Şifreler eşleşmiyor.")
            sys.exit(1)

    if len(password) < 8:
        print("HATA: Şifre en az 8 karakter olmalı.")
        sys.exit(1)

    create_admin(args.email, args.name, password)
