// FanX pricing / waitlist. No payment in MVP. Waitlist stores email into
// fanx_users + writes a row into the existing waitlist table with plan key.

import { renderPage, escapeHtml } from './base';

interface Tier {
  name: string;
  hint: string;
  bullets: string[];
  cta: string;
  plan_key: string;
  featured?: boolean;
}

const TIERS: Tier[] = [
  {
    name: 'Free',
    hint: 'يبدأ تجريبًا',
    bullets: [
      'رادار يومي واحد',
      'مدينة/فريق واحد',
      'تنبيهات بالبريد فقط',
    ],
    cta: 'ابدأ مجانًا',
    plan_key: 'fanx_free',
  },
  {
    name: 'FanX Live Pass',
    hint: 'للجمهور الجاد',
    bullets: [
      'رادار يومي كامل',
      'فرص أكثر يوميًا',
      'تنبيهات أسرع',
      'سكن/مواصلات/حول الملعب',
    ],
    cta: 'احجز مقعد Live Pass',
    plan_key: 'fanx_live_pass',
    featured: true,
  },
  {
    name: 'FanX Pro',
    hint: 'للمسافر المنظم',
    bullets: [
      'فرق ومدن متعددة',
      'رادار قابل للمشاركة',
      'أولوية واتساب لاحقًا',
      'بدائل أذكى',
    ],
    cta: 'احجز مقعد Pro',
    plan_key: 'fanx_pro',
  },
  {
    name: 'Concierge Radar',
    hint: 'مخصص',
    bullets: [
      'رادار مخصص بالكامل',
      'فرص مختارة يدويًا',
      'دعم متخصص',
      'تغطية البطولة كاملة',
    ],
    cta: 'احجز مقعد Concierge',
    plan_key: 'fanx_concierge',
  },
];

export function renderPricing(): string {
  const tiers = TIERS.map(t => `
<article class="fx-tier${t.featured ? ' is-featured' : ''}">
  <h3>${escapeHtml(t.name)}</h3>
  <div class="price">${escapeHtml(t.hint)}</div>
  <ul>${t.bullets.map(b => `<li>${escapeHtml(b)}</li>`).join('')}</ul>
  <button type="button" class="fx-cta" data-tier="${escapeHtml(t.plan_key)}">${escapeHtml(t.cta)}</button>
</article>`).join('');

  const body = `
<h1 class="fx-dash-title">أسعار FanX</h1>
<div class="fx-card-meta" style="margin-bottom:14px">قائمة الانتظار فقط الآن — بدون دفع. SeatX لا يضمن التذاكر.</div>
<div class="fx-tiers">${tiers}</div>

<div id="fxWait" class="fx-modal-backdrop" hidden>
  <div class="fx-modal">
    <h2>احجز مقعدك</h2>
    <div class="sub" id="fxWaitTier">FanX Pro</div>
    <div class="fx-field">
      <label class="fx-label" for="fxWaitEmail">البريد</label>
      <input class="fx-input" type="email" id="fxWaitEmail" placeholder="you@example.com" autocomplete="email">
    </div>
    <button type="button" class="fx-cta" id="fxWaitSubmit" style="width:100%">احجز</button>
    <div class="fx-card-meta" style="margin-top:12px;text-align:center">سنخبرك أولًا عند فتح الباب.</div>
  </div>
</div>

<script>
(function(){
  var modal=document.getElementById('fxWait'),plan=null,sub=document.getElementById('fxWaitTier');
  document.querySelectorAll('[data-tier]').forEach(function(btn){
    btn.addEventListener('click',function(){ plan=btn.getAttribute('data-tier'); sub.textContent=btn.textContent.trim(); modal.hidden=false; window.scrollTo(0,0); });
  });
  document.getElementById('fxWaitSubmit').addEventListener('click',function(){
    var email=(document.getElementById('fxWaitEmail')||{}).value||'';
    if(!email||!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)){ alert('بريد غير صحيح'); return; }
    fetch('/fanx/api/waitlist',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email,plan:plan})})
      .then(function(r){return r.json();})
      .then(function(){ modal.hidden=true; alert('تم. سنتواصل بالبريد.'); })
      .catch(function(){ alert('تعذّر الحفظ. حاول لاحقًا.'); });
  });
})();
</script>

<style>.fx-dash-title{margin:0 0 6px;font-size:22px;font-weight:800}</style>
`;
  return renderPage({ title: 'الأسعار', active_tab: 'pricing' }, body);
}
