import nodemailer from "nodemailer";

/**
 * SMTP transport oluşturur
 * TLS sertifika uyumu için SMTP_HOST olarak smile1.ixirdns.com kullanılmalı
 */
export function createTransport() {
  const host = process.env.SMTP_HOST || "smile1.ixirdns.com";
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const secure = process.env.SMTP_SECURE === "true";
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    throw new Error("SMTP_USER ve SMTP_PASS environment variable'ları gerekli");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure, // true for 465, false for other ports
    auth: {
      user,
      pass,
    },
    // TLS ayarları - hostname uyumu için
    tls: {
      // Sertifika doğrulaması açık (default)
      rejectUnauthorized: true,
      // Hostname kontrolü için servername ayarı
      servername: host,
    },
  });
}

