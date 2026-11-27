// FanX pricing / waitlist. No payment in MVP. Waitlist stores email into
// fanx_users + writes a row into the existing waitlist table with plan key.
// Inline #fxWaitMsg for errors + window.fxToast for success — no alert().

import { renderPage, escapeHtml } from './base';

interface Tier {
  name: string;
  price: string;
  per: string;
  hint: string;
  bullets: string[];
  cta: string;
  plan_key: string;
  featured?: boolean;
  monthly?: number; // paid tiers: monthly USD; yearly = 10x (2 months free), shown first (Ali 2026-11-27)
}

const TIERS: Tier[] = [
  {
    name: 'Free Preview',
    price: '0',
    per: 'مجاني',
    hint: 'يبدأ تجريبًا',
    bullets: [
      'رادار يومي واحد',
      'مدينة أو فريق واحد',
      'تنبيهات بالبريد فقط',
      'بدون أولوية في الموجات',
    ],
    cta: 'احجز مقعدك',
    plan_key: 'fanx_free',
  },
  {
    name: 'FanX Live Pass',
    price: '$19',
    monthly: 19,
    per: 'شهري',
    hint: 'للجمهور الجاد',
    bullets: [
      'رادار يومي كامل',
      'فرص أكثر يوميًا',
      'تنبيهات أسرع',
      'سكن + مواصلات + حول الملعب',
    ],
    cta: 'احجز مقعدك',
    plan_key: 'fanx_live_pass',
    featured: true,
  },
  {
    name: 'FanX Pro',
    price: '$49',
    monthly: 49,
    per: 'شهري',
    hint: 'للمسافر المنظّم',
    bullets: [
      'فرق ومدن متعددة',
      'رادار قابل للمشاركة',
      'أولوية موجات التذاكر',
      'بدائل أذكى + تنبيهات نقل',
    ],
    cta: 'احجز مقعدك',
    plan_key: 'fanx_pro',
  },
  {
    name: 'Concierge Radar',
    price: 'Custom',
    per: 'حسب الطلب',
    hint: 'مخصص',
    bullets: [
      'رادار مخصص بالكامل',
      'فرص مختارة يدويًا',
      'دعم متخصص',
      'تغطية البطولة كاملة',
    ],
    cta: 'احجز مقعدك',
    plan_key: 'fanx_concierge',
  },
];

const yearlyEq = (m: number): string => '$' + (m * 10 / 12).toFixed(2);

export function renderPricing(): string {
  const tiers = TIERS.map(t => `
<article class="fx-tier${t.featured ? ' is-featured' : ''}">
  <h3>${escapeHtml(t.name)}</h3>
  <div class="price" dir="ltr"><bdi${t.monthly ? ` data-y="${yearlyEq(t.monthly)}" data-m="$${t.monthly}"` : ''}>${escapeHtml(t.monthly ? yearlyEq(t.monthly) : t.price)}</bdi><span class="per">${escapeHtml(t.per)}</span></div>
  ${t.monthly ? `<div class="hint" data-y="تُدفع $${t.monthly * 10} مرة وحدة بالسنة · توفر 17%" data-m="تُدفع شهريًا بالسعر الكامل">تُدفع $${t.monthly * 10} مرة وحدة بالسنة · توفر 17%</div>` : ''}
  <div class="hint">${escapeHtml(t.hint)}</div>
  <ul>${t.bullets.map(b => `<li>${escapeHtml(b)}</li>`).join('')}</ul>
  <button type="button" class="fx-cta" data-tier="${escapeHtml(t.monthly ? t.plan_key + '_yearly' : t.plan_key)}"${t.monthly ? ` data-key="${escapeHtml(t.plan_key)}"` : ''} data-name="${escapeHtml(t.name)}">${escapeHtml(t.cta)}</button>
</article>`).join('');

  const body = `
<section class="fx-pricing-hero">
  <div class="fx-pricing-hero-bg" aria-hidden="true"></div>
  <div class="fx-pricing-hero-inner">
    <div class="fx-city-eyebrow" dir="ltr"><bdi>FANX · PLANS</bdi></div>
    <h1 class="fx-pricing-title">اختر خطة FanX</h1>
    <p class="fx-pricing-sub">قائمة انتظار فقط الآن — بدون دفع. الأسعار للمعاينة وقابلة للتعديل عند الإطلاق. FanX لا يبيع ولا يضمن أي خدمة.</p>
    <div class="fx-pricing-summary">
      <span class="fx-featured-chip">4 خطط</span>
      <span class="fx-featured-chip is-accent">FanX Pro الأكثر طلبًا</span>
      <span class="fx-featured-chip">قائمة انتظار · بدون دفع</span>
    </div>
  </div>
</section>

<div class="fx-per" role="group" aria-label="مدة الاشتراك"><button type="button" class="on" data-per="y" aria-pressed="true">سنوي · وفّر 17%</button><button type="button" data-per="m" aria-pressed="false">شهري</button></div>
<div class="fx-tiers">${tiers}</div>

<div id="fxWait" class="fx-modal-backdrop" hidden>
  <div class="fx-modal">
    <h2>احجز مقعدك</h2>
    <div class="sub" id="fxWaitTier">FanX Pro</div>
    <div class="fx-field">
      <label class="fx-label" for="fxWaitEmail">البريد</label>
      <input class="fx-input" type="email" id="fxWaitEmail" placeholder="you@example.com" autocomplete="email" inputmode="email" dir="ltr">
    </div>
    <button type="button" class="fx-cta" id="fxWaitSubmit" style="width:100%">احجز</button>
    <div id="fxWaitMsg" class="fx-modal-msg" hidden></div>
    <button type="button" class="fx-cta-ghost" id="fxWaitClose" style="width:100%;margin-top:10px">إغلاق</button>
    <div class="fx-card-meta" style="margin-top:12px;text-align:center">سنخبرك أولًا عند فتح الباب.</div>
  </div>
</div>

<script>
(function(){
  var modal=document.getElementById('fxWait'),plan=null,sub=document.getElementById('fxWaitTier');
  var msg=document.getElementById('fxWaitMsg');
  document.querySelectorAll('.fx-per button').forEach(function(pb){
    pb.addEventListener('click',function(){
      var y=pb.getAttribute('data-per')==='y';
      document.querySelectorAll('.fx-per button').forEach(function(o){ var on=o===pb; o.classList.toggle('on',on); o.setAttribute('aria-pressed',on?'true':'false'); });
      document.querySelectorAll('[data-y]').forEach(function(n){ n.textContent=n.getAttribute(y?'data-y':'data-m'); });
      document.querySelectorAll('[data-key]').forEach(function(b){ var k=b.getAttribute('data-key'); b.setAttribute('data-tier',y?k+'_yearly':k); });
    });
  });
  var submitBtn=document.getElementById('fxWaitSubmit');
  function showMsg(text,variant){ msg.textContent=text; msg.className='fx-modal-msg'+(variant?(' is-'+variant):''); msg.hidden=false; }
  function hideMsg(){ msg.hidden=true; msg.textContent=''; }
  document.querySelectorAll('[data-tier]').forEach(function(btn){
    btn.addEventListener('click',function(){
      plan=btn.getAttribute('data-tier');
      sub.textContent=(btn.getAttribute('data-name')||btn.textContent).trim();
      hideMsg(); submitBtn.disabled=false; submitBtn.textContent='احجز';
      modal.hidden=false; window.scrollTo({top:0,behavior:'smooth'});
    });
  });
  document.getElementById('fxWaitClose').addEventListener('click',function(){ modal.hidden=true; });
  modal.addEventListener('click',function(e){ if(e.target===modal){ modal.hidden=true; } });
  submitBtn.addEventListener('click',function(){
    var email=(document.getElementById('fxWaitEmail')||{}).value||'';
    if(!email||!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)){ showMsg('بريد غير صحيح. تأكد من الصيغة.','warn'); return; }
    hideMsg(); submitBtn.disabled=true; submitBtn.textContent='جارٍ الحفظ...';
    fetch('/fanx/api/waitlist',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email,plan:plan})})
      .then(function(r){return r.json();})
      .then(function(){
        modal.hidden=true;
        if(window.fxToast) window.fxToast('تم. سنتواصل بالبريد عند فتح الباب.','ok');
      })
      .catch(function(){
        submitBtn.disabled=false; submitBtn.textContent='احجز';
        showMsg('تعذّر الحفظ. حاول لاحقًا.','warn');
      });
  });
})();
</script>

<style>
.fx-pricing-hero{position:relative;width:100vw;margin-inline:calc(50% - 50vw);margin-top:-18px;
  padding:54px 22px 44px;text-align:center;overflow:hidden;
  background:
    radial-gradient(60% 100% at 50% 0%, rgba(163,230,53,.14), transparent 60%),
    linear-gradient(180deg,#0a0d14 0%,#080a0e 100%);
  border-bottom:1px solid var(--border);margin-bottom:22px}
@media(min-width:720px){ .fx-pricing-hero{padding:72px 32px 60px;margin-top:-28px} }
.fx-pricing-hero-bg{position:absolute;inset:0;pointer-events:none;
  background:radial-gradient(closest-side, rgba(163,230,53,.16), transparent 70%) 50% 30% / 480px 280px no-repeat;filter:blur(4px)}
.fx-pricing-hero-inner{position:relative;z-index:1;max-width:760px;margin:0 auto}
.fx-pricing-title{margin:8px 0 12px;font-size:36px;font-weight:900;line-height:1.2;color:#f4f4f5;letter-spacing:-.01em}
@media(min-width:720px){ .fx-pricing-title{font-size:52px} }
.fx-pricing-sub{margin:0 0 18px;font-size:17px;line-height:1.85;color:#d4d4d8}
.fx-per{display:flex;justify-content:center;gap:4px;margin:0 auto 18px;padding:4px;width:max-content;max-width:100%;border:1px solid var(--border);border-radius:999px;background:#0d1018}
.fx-per button{font:inherit;font-size:13px;font-weight:800;padding:9px 18px;border:0;border-radius:999px;background:transparent;color:#a1a1aa;cursor:pointer;touch-action:manipulation}
.fx-per button.on{background:var(--lime,#a3e635);color:#080a0e}
.fx-pricing-summary{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}
</style>
`;
  return renderPage({ title: 'الأسعار', active_tab: 'pricing' }, body);
}
