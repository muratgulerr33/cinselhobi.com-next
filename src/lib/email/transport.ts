import nodemailer from "nodemailer";

/**
 * SMTP transport oluşturur
 * Not: SMTP_HOST env zorunludur; fallback host kullanılmaz.
 */
export function createTransport() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const secure = process.env.SMTP_SECURE === "true";
  const tlsServername = process.env.SMTP_TLS_SERVERNAME || host;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error(
      "SMTP_HOST, SMTP_USER ve SMTP_PASS environment variable'ları gerekli"
    );
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
      // Bazı sağlayıcılarda SMTP host ile cert CN/SAN farklı olabilir
      servername: tlsServername,
    },
  });
}
