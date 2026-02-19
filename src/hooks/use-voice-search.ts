"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message?: string;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

type SpeechRecognitionCtor = new () => unknown;
type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: SpeechRecognitionCtor;
  webkitSpeechRecognition?: SpeechRecognitionCtor;
};

interface UseVoiceSearchProps {
  onResult?: (transcript: string) => void; // Opsiyonel callback
}

export function useVoiceSearch({ onResult }: UseVoiceSearchProps = {}) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported] = useState(() => {
    if (typeof window === "undefined") return false;
    const w = window as SpeechRecognitionWindow;
    const ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    return Boolean(ctor);
  });
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const router = useRouter();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current.abort();
      }
    };
  }, []);

  const startListening = useCallback(() => {
    if (!isSupported) {
      toast.error("Tarayıcınız sesli aramayı desteklemiyor");
      return;
    }

    // Önceki oturumu temizle
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
        recognitionRef.current.abort();
      } catch {
        // Önceki oturum zaten kapalı olabilir, hata yok say
      }
    }

    try {
      const w = window as SpeechRecognitionWindow;
      const ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
      if (!ctor) {
        toast.error("Tarayıcınız sesli aramayı desteklemiyor");
        return;
      }

      const recognition = new ctor() as SpeechRecognition;
      
      // Konfigürasyon
      recognition.continuous = false; // Tek cümle modu (YouTube tarzı)
      recognition.interimResults = false; // Sadece bitmiş cümleyi al
      recognition.lang = "tr-TR";

      recognition.onstart = () => {
        console.log("🎤 Mikrofon açıldı, dinleniyor...");
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results[0]?.[0]?.transcript?.trim();
        console.log("✅ Algılanan Ses:", transcript);
        
        if (transcript) {
          setIsListening(false);
          // Önce dışarıya haber ver (kapatmak için)
          if (onResult) onResult(transcript);
          // Sonra yönlendir
          router.push(`/search?q=${encodeURIComponent(transcript)}`);
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        setIsListening(false);

        if (event.error === "no-speech") {
          console.log("ℹ️ Ses algılanamadı (no-speech)");
          toast.error("Ses algılanamadı, lütfen tekrar deneyin.");
        } else {
          console.error("❌ Ses hatası:", event.error);
          if (event.error === "not-allowed" || event.error === "permission-denied") {
            // HTTP/HTTPS kontrolü
            if (window.location.protocol !== "https:" && window.location.hostname !== "localhost") {
              toast.error("Mikrofon için HTTPS (Güvenli Bağlantı) gereklidir.");
            } else {
              toast.error("Mikrofon izni verilmedi. Lütfen tarayıcı ayarlarından izin verin.");
            }
          } else if (event.error === "service-not-allowed") {
            toast.error("Sesli arama servisi kullanılamıyor. Lütfen tarayıcı ayarlarını kontrol edin.");
          } else {
            toast.error("Sesli arama hatası. Lütfen tekrar deneyin.");
          }
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      
      // Başlat
      recognition.start();
      setIsListening(true);
    } catch (error) {
      console.error("Start error:", error);
      setIsListening(false);
      toast.error("Sesli arama başlatılamadı. Lütfen tekrar deneyin.");
    }
  }, [isSupported, router, onResult]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current.abort();
      setIsListening(false);
    }
  }, []);

  return {
    isListening,
    isSupported,
    startListening,
    stopListening,
  };
}
