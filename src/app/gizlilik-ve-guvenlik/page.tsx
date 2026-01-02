import { StaticPage } from "@/components/content/static-page";

export default function GizlilikVeGuvenlikPage() {
  const title = "Gizlilik ve Güvenlik";
  const body = `Online Mağazamızda verilen tüm servisler, HAMİDİYE MAHALLESİ CENGİZ TOPEL CADDESİ REFAH APARTMANI ALTI NO:11/B AKDENİZ/MERSİN adresinde kayıtlı TARIK BENER EROSHOP  firmamıza aittir ve firmamız tarafından işletilir.

 

Firmamız, çeşitli amaçlarla kişisel veriler toplayabilir. Aşağıda, toplanan kişisel verilerin nasıl ve ne şekilde toplandığı, bu verilerin nasıl ve ne şekilde korunduğu belirtilmiştir.

 

Üyelik veya Mağazamız üzerindeki çeşitli form ve anketlerin doldurulması suretiyle üyelerin kendileriyle ilgili bir takım kişisel bilgileri (isim-soy isim, firma bilgileri, telefon, adres veya e-posta adresleri gibi) Mağazamız tarafından işin doğası gereği toplanmaktadır.

 

Firmamız bazı dönemlerde müşterilerine ve üyelerine kampanya bilgileri, yeni ürünler hakkında bilgiler, promosyon teklifleri gönderebilir. Üyelerimiz bu gibi bilgileri alıp almama konusunda her türlü seçimi üye olurken yapabilir, sonrasında üye girişi yaptıktan sonra hesap bilgileri bölümünden bu seçimi değiştirilebilir ya da kendisine gelen bilgilendirme iletisindeki linkle bildirim yapabilir.`;

  return <StaticPage title={title} body={body} />;
}

