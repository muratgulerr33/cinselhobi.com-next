---
name: Plan Şablonu
overview: Bu plan şablonu kullanıcı tarafından doldurulacaktır.
todos:
  - id: todo-1
    content: "[İlk görev açıklaması]"
    status: pending
  - id: todo-2
    content: "[İkinci görev açıklaması]"
    status: pending
    dependencies:
      - todo-1
  - id: todo-3
    content: "[Üçüncü görev açıklaması]"
    status: pending
---

Goal

Light Mode görünümünde "Destructive" (Yıkıcı) renk token'ını, markanın Primary rengi (#ff2357) ile daha uyumlu, göze batmayan, modern bir tona revize et ve Cart (Sepet) sayfasındaki "Sepeti Boşalt" butonunda doğrula.

Context (docs refs)

04.design-system.md (Section 2.1: Colors & Section 3.1: Base Components)

07.component-inventory.md (Section 5.2: Cart Components - CartView)

00.gemini-master-pack.md (Source of Truth)

Teşhis

Mevcut globals.css içinde Light Mode (:root) için tanımlı --destructive rengi, Primary rengimiz (#ff2357) ile uyumsuz, çok çiğ bir kırmızı tonunda.

Kullanıcı, Dark Mode'daki uyumu Light Mode'da da görmek istiyor.

"Sepeti Boşalt" butonu src/components/cart/cart-view.tsx (veya cart-drawer) içinde muhtemelen variant="destructive" veya variant="ghost" + text-destructive kullanıyor.

Plan (steps)

src/app/globals.css dosyasını oku.

:root (Light Mode) içindeki --destructive ve --destructive-foreground değerlerini güncelle.

Hedef: Primary rengimiz #ff2357'nin OKLCH karşılığına yakın ama hafifçe daha koyu/uyarıcı bir ton (Pink-Red hybrid).

Öneri Değer (Primary-Aligned Red): oklch(0.6 0.23 15) (Hue açısını Primary'e yaklaştır, Saturation'ı koru).

src/components/cart/cart-view.tsx (ve varsa cart-drawer ilgili component) dosyasını kontrol et. "Sepeti Boşalt" butonunun variant="destructive" veya uygun ghost varyantında olduğundan emin ol.

Eğer buton ghost ise, hover durumunda arka planın (bg-destructive/10) da yeni renkle uyumlu görüneceğini teyit et (CSS variable değişeceği için otomatik düzelmeli).

Files to touch

src/app/globals.css (Renk token revizyonu)

src/components/cart/cart-view.tsx (Buton varyant kontrolü - gerekirse edit)

Implementation Notes

Sakın hardcode renk (#ff...) kullanma. CSS variable'ları (--destructive) güncelle ki tüm sitede düzelsin.

--destructive-foreground renginin (üzerindeki yazı) okunabilirliğini (contrast ratio) koruduğundan emin ol (Genellikle oklch(0.985 0 0) yani beyaz kalmalı).

DoD

[ ] npm run lint hatasız geçmeli.

[ ] npm run build başarılı olmalı.

[ ] Manuel Smoke Test: Cart sayfasına git, Light Mode'a al, "Sepeti Boşalt" butonunun renginin Primary renkle uyumlu ama ayırt edici bir tonda olduğunu onayla.

Risk & Rollback

Risk: Düşük. Sadece renk tonu değişiyor.

Rollback: globals.css dosyasındaki değişikliği geri al.