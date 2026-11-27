// FanX landing — premium hero, modal-first onboarding, value cards, preview.
// SSR-only, mobile-first. The onboarding modal is shown on first visit
// (cookie-gated). Skip → user lands on the preview dashboard instead.

import { renderPage, escapeHtml } from './base';
import { renderOnboardingModal } from './components/onboarding';
import { listCities } from '../seed';

export function renderLanding(): string {
  const body = `
<section class="fx-hero">
  <div class="fx-hero-eyebrow">FanX by SeatX · رادار كأس العالم 2026</div>
  <h1 class="fx-hero-h1">وش أفضل فرصة تلحقها في كأس العالم الآن؟</h1>
  <p class="fx-hero-sub">اختر مدينتك وفريقك وميزانيتك. FanX by SeatX يطلع لك فرص التذاكر، السكن الذكي، المواصلات، والتجمعات حول الملعب.</p>
  <div class="fx-hero-cta">
    <button type="button" class="fx-cta" id="fxStart">ابدأ الرادار</button>
    <a class="fx-cta-ghost" href="/fanx/radar?demo=1">شوف مثال</a>
  </div>
  <div class="fx-hero-meta">SeatX يدير المراقبة · لا نبيع تذاكر · لا نضمن توفر.</div>
</section>

<section class="fx-section">
  <div class="fx-section-title">ما يقدمه FanX</div>
  <div class="fx-grid">
    ${valueCard('أفضل حركة اليوم','قرار واحد واضح: تذكرة، سكن، نقل، أو بديل أذكى.')}
    ${valueCard('رادار التذاكر','مدعوم بمحرك SeatX. ننبهك على الفرص المحتملة من المصادر الرسمية.')}
    ${valueCard('سكن قريب من الملعب','مناطق مختارة حسب القرب، السعر، والمواصلات — مو حجز فندق.')}
    ${valueCard('مواصلات يوم المباراة','تنبيهات احتقان بعد المباراة، أفضل وقت للخروج.')}
    ${valueCard('حول الملعب','فان زون، مطاعم، تجمعات عائلية — مصادر رسمية لما تتوفر.')}
    ${valueCard('بدائل أذكى','إذا المباراة غالية، نقترح بديل بنفس المدينة بقيمة أفضل.')}
  </div>
</section>

<section class="fx-section">
  <div class="fx-section-title">معاينة الرادار</div>
  <div class="fx-card">
    <h3>أفضل حركة اليوم</h3>
    <div class="fx-card-sub">معاينة · تحديث تجريبي</div>
    <div class="fx-card-body">اختر مدينتك وفريقك عشان نطلع لك أفضل حركة. SeatX لا يضمن التذاكر.</div>
    <div class="fx-cta-row">
      <button type="button" class="fx-cta" id="fxStart2">ابدأ الآن</button>
    </div>
  </div>
</section>

${renderOnboardingModal({ cities: listCities() })}

<script>
(function(){
  function open(){
    var b=document.getElementById('fxModalBackdrop'); if(b){ b.hidden=false; window.scrollTo(0,0); }
  }
  var s=document.getElementById('fxStart'); if(s) s.addEventListener('click',open);
  var s2=document.getElementById('fxStart2'); if(s2) s2.addEventListener('click',open);
})();
</script>

<style>
.fx-hero{padding:36px 0 24px;text-align:center}
.fx-hero-eyebrow{font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700;
  color:#a3e635;letter-spacing:.14em;text-transform:uppercase;margin-bottom:16px}
.fx-hero-h1{margin:0 0 14px;font-size:32px;line-height:1.25;font-weight:800;color:#f4f4f5}
.fx-hero-sub{max-width:640px;margin:0 auto 20px;font-size:15px;line-height:1.7;color:#a1a1aa}
.fx-hero-cta{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-bottom:14px}
.fx-hero-meta{font-family:'IBM Plex Mono',monospace;font-size:11px;color:#71717a;letter-spacing:.08em}
.fx-section{margin-top:30px}
@media(min-width:720px){ .fx-hero-h1{font-size:40px} }
</style>
`;
  return renderPage({ title: 'FanX', active_tab: 'landing' }, body);
}

function valueCard(title: string, body: string): string {
  return `<article class="fx-card"><h3>${escapeHtml(title)}</h3><div class="fx-card-body">${escapeHtml(body)}</div></article>`;
}
