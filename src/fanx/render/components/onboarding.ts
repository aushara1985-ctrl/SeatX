// FanX onboarding modal — single HTML+inline-script block. Modal is the
// hero interaction on /fanx. 5 steps:
//   1. city
//   2. team / match (free text) — skippable
//   3. budget
//   4. priority
//   5. email / WhatsApp capture (both optional; at least email if alerts on)
//
// On submit, POSTs to /fanx/api/radar. On success, redirects to /fanx/radar
// with the new radar slug in the URL.

import { escapeAttr } from '../base';
import type { FanxCity } from '../../seed/cities';

interface OnboardingOptions {
  cities: FanxCity[];
}

export function renderOnboardingModal(opts: OnboardingOptions): string {
  const cityOptions = opts.cities.map(c =>
    `<option value="${escapeAttr(c.slug)}">${c.name_ar}</option>`
  ).join('');

  return `
<div id="fxModalBackdrop" class="fx-modal-backdrop" hidden>
  <div class="fx-modal" role="dialog" aria-modal="true" aria-labelledby="fxModalTitle">
    <h2 id="fxModalTitle">وش تبي تلحق؟</h2>
    <div class="sub">اختر اهتمامك الرئيسي، وFanX يبني لك رادار اليوم.</div>

    <div id="fxStep1">
      <div class="fx-pill-row" data-group="intent">
        <button type="button" class="fx-pill" data-val="follow_team">فريق</button>
        <button type="button" class="fx-pill" data-val="catch_match">مباراة</button>
        <button type="button" class="fx-pill" data-val="explore_city">مدينة</button>
        <button type="button" class="fx-pill" data-val="best_opportunity_today">أفضل فرصة اليوم</button>
      </div>
      <div class="fx-field">
        <label class="fx-label" for="fxCity">المدينة</label>
        <select id="fxCity" class="fx-select"><option value="">اختر المدينة</option>${cityOptions}</select>
      </div>
      <div class="fx-field">
        <label class="fx-label" for="fxTeam">الفريق / المباراة (اختياري)</label>
        <input id="fxTeam" class="fx-input" type="text" placeholder="مثال: البرازيل" maxlength="80">
      </div>
      <button type="button" class="fx-cta" data-step-next="2" style="width:100%">التالي</button>
    </div>

    <div id="fxStep2" hidden>
      <div class="fx-field">
        <label class="fx-label">الميزانية</label>
        <div class="fx-pill-row" data-group="budget">
          <button type="button" class="fx-pill" data-val="low">اقتصادي</button>
          <button type="button" class="fx-pill" data-val="medium">متوسط</button>
          <button type="button" class="fx-pill" data-val="high">مرتفع</button>
        </div>
      </div>
      <div class="fx-field">
        <label class="fx-label">الأولوية</label>
        <div class="fx-pill-row" data-group="priority">
          <button type="button" class="fx-pill" data-val="catch_ticket">ألحق تذكرة</button>
          <button type="button" class="fx-pill" data-val="stay_close">قريب من الملعب</button>
          <button type="button" class="fx-pill" data-val="save_money">أوفر</button>
          <button type="button" class="fx-pill" data-val="avoid_transport">أقل احتقان نقل</button>
          <button type="button" class="fx-pill" data-val="fan_atmosphere">أجواء جماهير</button>
          <button type="button" class="fx-pill" data-val="family">عائلي</button>
          <button type="button" class="fx-pill" data-val="alt_match">بديل أفضل</button>
        </div>
      </div>
      <button type="button" class="fx-cta" data-step-next="3" style="width:100%">التالي</button>
    </div>

    <div id="fxStep3" hidden>
      <div class="fx-field">
        <label class="fx-label" for="fxEmail">البريد (للتنبيهات)</label>
        <input id="fxEmail" class="fx-input" type="email" placeholder="you@example.com" autocomplete="email" inputmode="email">
      </div>
      <div class="fx-field">
        <label class="fx-label" for="fxWhats">واتساب (اختياري — التقاط فقط)</label>
        <input id="fxWhats" class="fx-input" type="tel" placeholder="+966..." autocomplete="tel" inputmode="tel">
      </div>
      <button type="button" class="fx-cta" id="fxSubmit" style="width:100%">ابدأ الرادار</button>
      <div class="fx-card-meta" style="margin-top:12px;text-align:center">SeatX لا يضمن التذاكر · لا نبيع تذاكر.</div>
    </div>

  </div>
</div>
<script>${ONBOARDING_JS}</script>`;
}

const ONBOARDING_JS = `
(function(){
  var b=document.getElementById('fxModalBackdrop'); if(!b)return;
  // Show modal on first visit (cookie 'fxOnb=1' suppresses).
  if(!/(?:^|;\\s*)fxOnb=1/.test(document.cookie)){ b.hidden=false; }
  // Pill group selection
  b.querySelectorAll('[data-group]').forEach(function(g){
    g.addEventListener('click',function(e){
      var t=e.target.closest('.fx-pill'); if(!t||!g.contains(t))return;
      g.querySelectorAll('.fx-pill').forEach(function(p){p.classList.remove('is-on');});
      t.classList.add('is-on');
      g.dataset.val=t.dataset.val;
    });
  });
  // Step navigation
  b.querySelectorAll('[data-step-next]').forEach(function(btn){
    btn.addEventListener('click',function(){
      var n=btn.getAttribute('data-step-next');
      ['fxStep1','fxStep2','fxStep3'].forEach(function(id){document.getElementById(id).hidden=true;});
      var el=document.getElementById('fxStep'+n); if(el)el.hidden=false;
    });
  });
  // Submit
  var submit=document.getElementById('fxSubmit');
  if(submit) submit.addEventListener('click',function(){
    var data={
      intent: q('[data-group="intent"]')||null,
      city: (document.getElementById('fxCity')||{}).value||null,
      team: (document.getElementById('fxTeam')||{}).value||null,
      budget_level: q('[data-group="budget"]')||null,
      priority: q('[data-group="priority"]')||null,
      email: (document.getElementById('fxEmail')||{}).value||null,
      whatsapp: (document.getElementById('fxWhats')||{}).value||null
    };
    submit.disabled=true; submit.textContent='جارٍ الإعداد...';
    fetch('/fanx/api/radar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)})
      .then(function(r){return r.json();})
      .then(function(res){
        if(res && res.slug){
          document.cookie='fxOnb=1; path=/; max-age=2592000';
          location.href='/fanx/radar?s='+encodeURIComponent(res.slug);
        }else{ submit.disabled=false; submit.textContent='ابدأ الرادار'; alert('تعذّر إنشاء الرادار. حاول مرة ثانية.'); }
      })
      .catch(function(){ submit.disabled=false; submit.textContent='ابدأ الرادار'; });
  });
  function q(sel){ var el=b.querySelector(sel); return el?el.dataset.val||null:null; }
})();
`;
