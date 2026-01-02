import { Phone, Mail, MapPin, Clock } from "lucide-react";
import Link from "next/link";

export default function SupportPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-6">
        <h1 className="text-2xl font-semibold mb-6">İletişim & Destek</h1>

        {/* Bize Ulaşın */}
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold mb-4">Bize Ulaşın</h2>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-primary" />
                <div>
                  <span className="text-sm text-muted-foreground">Telefon: </span>
                  <a
                    href="tel:+905458651215"
                    className="text-primary font-medium hover:underline"
                  >
                    0545 865 1215
                  </a>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-primary" />
                <div>
                  <span className="text-sm text-muted-foreground">Whatsapp: </span>
                  <a
                    href="https://wa.me/905458651215"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary font-medium hover:underline"
                  >
                    05458651215
                  </a>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-primary" />
                <div>
                  <span className="text-sm text-muted-foreground">Eposta: </span>
                  <a
                    href="mailto:destek@cinselhobi.com"
                    className="text-primary font-medium hover:underline"
                  >
                    destek@cinselhobi.com
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Adres */}
          <div>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Adres
            </h2>
            <div className="space-y-2 text-sm">
              <p className="text-foreground">
                Hamidiye Cengiz Topel Cad. Refah Apt. Altı No:11/B
              </p>
              <p className="text-foreground">33010 Akdeniz/Mersin</p>
              <p className="text-foreground font-medium">EROSHOP TARIK BENER</p>
              <p className="text-muted-foreground">URAY VERGİ DAİRESİ</p>
              <p className="text-muted-foreground">
                VERGİ KİMLİK: 1630283520
              </p>
            </div>
          </div>

          {/* Çalışma Saatleri */}
          <div>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Çalışma Saatleri
            </h2>
            <p className="text-sm text-foreground">11:00 – 22:00</p>
          </div>
        </div>
      </div>

      {/* Google Maps */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold mb-4">Konum</h2>
        <div className="w-full overflow-hidden rounded-lg">
          <iframe
            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3206.1234567890123!2d34.6389!3d36.8121!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMzYsNDg0My42OCJOIDM0LDM4JzIwLjAiRQ!5e0!3m2!1str!2str!4v1234567890123!5m2!1str!2str"
            width="100%"
            height="450"
            style={{ border: 0 }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="w-full"
            title="CinselHobi Mağaza Konumu"
          />
        </div>
        <div className="mt-4 text-sm text-muted-foreground">
          <Link
            href="https://www.google.com/maps/search/?api=1&query=Hamidiye+Cengiz+Topel+Cad.+Refah+Apt.+Altı+No:11/B+Akdeniz+Mersin"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Daha büyük haritayı görüntüle
          </Link>
          {" · "}
          <Link
            href="https://www.google.com/maps/dir/?api=1&destination=Hamidiye+Cengiz+Topel+Cad.+Refah+Apt.+Altı+No:11/B+Akdeniz+Mersin"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Yol Tarifi
          </Link>
        </div>
      </div>
    </div>
  );
}
