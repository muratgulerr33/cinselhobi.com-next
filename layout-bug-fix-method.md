## Bug: Slider varken tüm sayfa viewport dışına taşıyor (UI sağdan kesiliyor)

### Belirti
- Slider açılınca sayfadaki bir sürü bileşen sağdan kesiliyor / viewport dışına taşıyor gibi görünüyor.
- Slider kaldırınca her şey normale dönüyor.

### Tetikleyici
- İçinde `overflow-x-auto` / `snap-x` / yatay scroll üreten slider veya carousel.

### Kök Sebep
- Page shell `CSS Grid`/`Flex` kullanıyor ve child container’larda varsayılan `min-width:auto` var.
- Yatay scroll alanı (büyük scrollWidth) grid/flex item’ın “ben de büyüyeyim” demesine neden oluyor.
- Böylece tüm sayfa genişliyor. Dışta `overflow-x-clip/hidden` varsa taşma kesiliyor ve UI kırpılmış gibi görünüyor.

### Kalıcı Fix
- Grid/Flex shell ve grid item seviyelerine `min-w-0` (gerekirse `max-w-full`) ekle:
  - outer wrapper: `w-full min-w-0 max-w-full`
  - grid wrapper: `grid w-full min-w-0 max-w-full`
  - grid item (motion.div): `w-full min-w-0 max-w-full`
  - ScreenShell container: `w-full min-w-0 ...`

- Slider scroller div’ine de gerekirse: `min-w-0 max-w-full` ekle.

### Geçici Hack (önerilmez)
- `max-w-[90vw]` gibi clamp’ler semptomu maskeler, kök sebep kalır.

### Debug Kuralı
- Eğer slider/scroll ekleyince UI bozuluyorsa önce şuna bak:
  - Shell grid/flex item’larda `min-w-0` var mı?
