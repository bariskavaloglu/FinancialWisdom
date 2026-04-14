"""
Email service — mail doğrulama için.

EMAILS_ENABLED=False (varsayılan): mail göndermez, token'ı log'a yazar.
EMAILS_ENABLED=True: gerçek SMTP üzerinden mail gönderir.

.env'de ayarlanacaklar:
  SMTP_HOST=smtp.gmail.com
  SMTP_PORT=587
  SMTP_USER=senin@gmail.com
  SMTP_PASSWORD=xxxx xxxx xxxx xxxx   # Gmail App Password
  EMAILS_ENABLED=true
  FRONTEND_URL=http://localhost:5173
"""
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import settings

logger = logging.getLogger(__name__)


def send_verification_email(to_email: str, full_name: str, token: str) -> None:
    """
    Kullanıcıya doğrulama maili gönderir.
    EMAILS_ENABLED=False ise sadece log'a yazar (geliştirme ortamı).
    """
    verify_url = f"{settings.FRONTEND_URL}/verify-email?token={token}"

    if not settings.EMAILS_ENABLED:
        logger.info(
            "📧 [DEV MODE] Mail gönderilmedi. Doğrulama URL'i:\n  %s\n"
            "  (Gerçek mail için .env dosyasında EMAILS_ENABLED=true yapın)",
            verify_url,
        )
        return

    subject = "Financial Wisdom — E-posta Adresinizi Doğrulayın"

    html_body = f"""
<!DOCTYPE html>
<html lang="tr">
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; background:#f5f5f4; margin:0; padding:32px;">
  <div style="max-width:520px; margin:0 auto; background:#fff; border-radius:12px;
              border:1px solid #e7e5e4; overflow:hidden;">

    <div style="background:#1c1917; padding:28px 32px;">
      <h1 style="color:#fff; margin:0; font-size:20px; font-weight:600;">
        Financial Wisdom
      </h1>
    </div>

    <div style="padding:32px;">
      <h2 style="color:#1c1917; font-size:18px; margin:0 0 12px;">
        Merhaba {full_name} 👋
      </h2>
      <p style="color:#57534e; font-size:14px; line-height:1.6; margin:0 0 24px;">
        Hesabınızı oluşturduğunuz için teşekkürler. Kullanmaya başlamak için
        aşağıdaki butona tıklayarak e-posta adresinizi doğrulayın.
      </p>

      <a href="{verify_url}"
         style="display:inline-block; background:#1c1917; color:#fff;
                text-decoration:none; padding:12px 28px; border-radius:8px;
                font-size:14px; font-weight:600;">
        E-postamı Doğrula →
      </a>

      <p style="color:#a8a29e; font-size:12px; margin:24px 0 0; line-height:1.5;">
        Bu bağlantı <strong>24 saat</strong> geçerlidir.<br>
        Bu hesabı siz oluşturmadıysanız bu maili dikkate almayın.
      </p>
    </div>

    <div style="background:#f5f5f4; padding:16px 32px; border-top:1px solid #e7e5e4;">
      <p style="color:#a8a29e; font-size:11px; margin:0;">
        ⚠ Bu platform yalnızca eğitim amaçlıdır. Finansal tavsiye değildir.
      </p>
    </div>
  </div>
</body>
</html>
"""

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"Financial Wisdom <{settings.SMTP_USER}>"
    msg["To"] = to_email
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_USER, to_email, msg.as_string())
        logger.info("✅ Doğrulama maili gönderildi: %s", to_email)
    except Exception as exc:
        logger.error("❌ Mail gönderilemedi (%s): %s", to_email, exc)
        raise
