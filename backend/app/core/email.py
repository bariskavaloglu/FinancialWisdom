"""
Email service — for email verification.
EMAILS_ENABLED=False (default): does not send email, writes token to log.
EMAILS_ENABLED=True: sends real email via Resend API.
Configure in .env / Railway Variables:
  RESEND_API_KEY=re_xxxx
  EMAILS_ENABLED=true
  FRONTEND_URL=https://financialwisdom.me
"""
import logging
import os
import urllib.request
import urllib.error
import json

from app.core.config import settings

logger = logging.getLogger(__name__)


def send_verification_email(to_email: str, full_name: str, token: str) -> None:
    verify_url = f"{settings.FRONTEND_URL}/verify-email?token={token}"

    if not settings.EMAILS_ENABLED:
        logger.info(
            "🔗 [DEV MODE] Email not sent. Verification URL:\n  %s\n"
            "  (Set EMAILS_ENABLED=true to send real emails)",
            verify_url,
        )
        return

    resend_api_key = os.environ.get("RESEND_API_KEY", "")
    if not resend_api_key:
        logger.error("RESEND_API_KEY not set — cannot send email")
        return

    html_body = f"""\
<!DOCTYPE html>
<html lang="en">
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
        Hi {full_name} 👋
      </h2>
      <p style="color:#57534e; font-size:14px; line-height:1.6; margin:0 0 24px;">
        Thanks for creating an account. Click the button below to verify
        your email address and get started.
      </p>
      <a href="{verify_url}"
         style="display:inline-block; background:#1c1917; color:#fff;
                text-decoration:none; padding:12px 28px; border-radius:8px;
                font-size:14px; font-weight:600;">
        Verify My Email →
      </a>
      <p style="color:#a8a29e; font-size:12px; margin:24px 0 0; line-height:1.5;">
        This link is valid for <strong>24 hours</strong>.<br>
        If you did not create this account, you can safely ignore this email.
      </p>
    </div>
    <div style="background:#f5f5f4; padding:16px 32px; border-top:1px solid #e7e5e4;">
      <p style="color:#a8a29e; font-size:11px; margin:0;">
        ⚠ This platform is for educational purposes only. Not financial advice.
      </p>
    </div>
  </div>
</body>
</html>
"""

    payload = json.dumps({
        "from": "Financial Wisdom <noreply@financialwisdom.me>",
        "to": [to_email],
        "subject": "Financial Wisdom — Verify Your Email Address",
        "html": html_body,
    }).encode("utf-8")

    req = urllib.request.Request(
        "https://api.resend.com/emails",
        data=payload,
        headers={
            "Authorization": f"Bearer {resend_api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req) as resp:
            result = json.loads(resp.read())
            logger.info("✅ Verification email sent via Resend: %s (id=%s)", to_email, result.get("id"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode()
        logger.error("❌ Resend error (%s): %s", exc.code, body)
        raise
    except Exception as exc:
        logger.error("❌ Failed to send email (%s): %s", to_email, exc)
        raise