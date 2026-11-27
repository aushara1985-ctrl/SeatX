// FanX landing — World Cup tournament identity with interactive demo.
// Explainer hero with pitch-line backdrop, interactive try-it-now (live
// pill row updates a Best Move preview), fixture rail with country flag
// pairs + group labels, knockout bracket teaser, compact pricing strip,
// modal-first onboarding. SSR-only, mobile-first. No browser alert().

import { renderPage, escapeHtml, escapeAttr, flagFor, iconFor, svgFlag } from './base';
import { renderOnboardingModal } from './components/onboarding';
import { listCities } from '../seed';

export function renderLanding(): string {
  const cities = listCities();
  const cityChips = cities.map(c => `
    <a class="fx-flag-chip" href="/fanx/city/${escapeAttr(c.slug)}" aria-label="${escapeAttr(c.name_ar)}">
      <span class="flag" aria-hidden="true">${flagFor(c.country)}</span>
      <span>${escapeHtml(c.name_ar)}</span>
      <span class="en" dir="ltr"><bdi>${escapeHtml(c.name_en)}</bdi></span>
    </a>`).join('');

  const body = `
<section class="fx-hero">
  <div class="fx-hero-bg" aria-hidden="true"></div>
  <div class="fx-pitch-bg" aria-hidden="true">${pitchSvg()}</div>
  <div class="fx-hero-inner">
    <div class="fx-wc-eyebrow" dir="ltr"><bdi>FANX · MATCH DAY RADAR · by SEATX</bdi></div>
    <h1 class="fx-hero-h1">رادار يوم المباراة</h1>
    <p class="fx-hero-sub">FanX يساعدك تفهم أفضل حركة اليوم: أين تذهب، أين تسكن، كيف تتحرك، وما الخيارات الأنسب حول المدينة.</p>
    <div class="fx-hero-cta">
      <a class="fx-cta" href="/fanx/radar?demo=1">شوف رادار تجريبي</a>
      <button type="button" class="fx-cta-ghost" id="fxStart">ابدأ الإعداد</button>
    </div>
    <div class="fx-hero-meta">قرار، مو قائمة · رادار، مو متجر · FanX لا يبيع ولا يضمن أي خدمة.</div>
  </div>
</section>
<div class="fx-ticker" aria-hidden="true">
  <div class="fx-ticker-track">
    ${tickerItems()}
    ${tickerItems()}
  </div>
</div>

<section class="fx-stats" aria-label="نظرة عامة على FanX">
  <div class="fx-stat">
    <div class="k">المدن المضيفة</div>
    <div class="v"><bdi>${cities.length}</bdi></div>
    <div class="h" dir="ltr"><bdi>USA · Canada · Mexico</bdi></div>
  </div>
  <div class="fx-stat">
    <div class="k">رادارات نشطة</div>
    <div class="v"><bdi>6</bdi></div>
    <div class="h">تذاكر · سكن · نقل · بدائل</div>
  </div>
  <div class="fx-stat">
    <div class="k">قرار اليوم</div>
    <div class="v">واحد</div>
    <div class="h">لا قوائم طويلة</div>
  </div>
  <div class="fx-stat">
    <div class="k">المصدر</div>
    <div class="v">SeatX</div>
    <div class="h">+ مصادر رسمية</div>
  </div>
</section>

<section class="fx-try">
  <div class="fx-section-title is-group">جرّب FanX الآن</div>
  <div class="fx-try-grid">
    <div>
      <div class="fx-try-card">
        <div class="lbl">المدينة</div>
        <div class="fx-try-row" data-try-row="city">
          ${tryPill('city','new-york','🇺🇸','نيويورك')}
          ${tryPill('city','los-angeles','🇺🇸','لوس أنجلوس')}
          ${tryPill('city','miami','🇺🇸','ميامي')}
          ${tryPill('city','dallas','🇺🇸','دالاس')}
          ${tryPill('city','toronto','🇨🇦','تورنتو')}
          ${tryPill('city','mexico-city','🇲🇽','مكسيكو')}
        </div>
      </div>
      <div class="fx-try-card">
        <div class="lbl">الفريق</div>
        <div class="fx-try-row" data-try-row="team">
          ${tryPill('team','البرازيل','🇧🇷','البرازيل')}
          ${tryPill('team','الأرجنتين','🇦🇷','الأرجنتين')}
          ${tryPill('team','فرنسا','🇫🇷','فرنسا')}
          ${tryPill('team','إسبانيا','🇪🇸','إسبانيا')}
          ${tryPill('team','البرتغال','🇵🇹','البرتغال')}
          ${tryPill('team','المكسيك','🇲🇽','المكسيك')}
        </div>
      </div>
      <div class="fx-try-card">
        <div class="lbl">الميزانية</div>
        <div class="fx-try-row" data-try-row="budget">
          ${tryPill('budget','low',null,'اقتصادي')}
          ${tryPill('budget','medium',null,'متوسط')}
          ${tryPill('budget','high',null,'مرتفع')}
        </div>
      </div>
    </div>

    <div class="fx-try-preview">
      <div class="fx-best">
        <span class="badge">معاينة حية</span>
        <div class="fx-best-head">
          <span class="label">أفضل حركة الآن</span>
          <span class="decision-tag" id="fxTryTag">تنبيه</span>
        </div>
        <h2 id="fxTryTitle">راقب مباراة البرازيل في نيويورك، لكن لا تحجز سكن بعيد فقط لأنه أرخص.</h2>
        <div class="body" id="fxTryBody">الميزانية متوسطة — فرصة جيدة في الفئة العادية، والمنطقة القريبة من النقل تقلل مخاطرة يوم المباراة.</div>
        <div class="fx-best-head" style="margin-bottom:0">
          <span class="fx-tag is-ok"><span class="dot"></span>ملعب <span id="fxTryStadium">ميت لايف</span></span>
          <span class="fx-tag">ثقة <bdi id="fxTryConf">78%</bdi></span>
        </div>
        <div class="fx-cta-row">
          <a class="fx-cta" href="/fanx/radar?demo=1">افتح الرادار الكامل</a>
          <button type="button" class="fx-cta-ghost" id="fxTryWhy">ليش هذا القرار؟</button>
        </div>
      </div>
    </div>
  </div>
</section>

<section>
  <div class="fx-section-title">ما يقدّمه FanX</div>
  <div class="fx-grid">
    ${valueCard('best_move',    'أفضل حركة اليوم',     'قرار واحد واضح: تذكرة، سكن، نقل، أو بديل أذكى — مو قائمة لا تنتهي.')}
    ${valueCard('ticket',       'رادار التذاكر',       'مدعوم بمحرك SeatX. ننبّهك على الفرص المحتملة من المصادر الرسمية، لكن ما نبيع ولا نضمن.')}
    ${valueCard('stay',         'سكن قريب من الملعب', 'مناطق مختارة حسب القرب، السعر، والمواصلات — مو حجز فندق.')}
    ${valueCard('move',         'تنبيهات مواصلات',     'احتقان قبل وبعد المباراة، أفضل وقت للخروج، تنبيهات نقل ذكية.')}
    ${valueCard('around',       'حول الملعب',          'فان زون، مطاعم، تجمعات عائلية — مصادر رسمية لما تتوفر.')}
    ${valueCard('alternatives', 'بدائل أذكى',          'إذا المباراة غالية، نقترح بديل بنفس المدينة بقيمة أفضل.')}
  </div>
</section>

<section>
  <div class="fx-section-title is-group">دور المجموعات — أبرز المباريات</div>
  <div class="fx-fixtures">
    ${fixtureCard('GROUP A', 'البرازيل', '🇧🇷', 'فرنسا', '🇫🇷', 'ميت لايف · نيويورك', 'تحديث تجريبي')}
    ${fixtureCard('GROUP B', 'الأرجنتين', '🇦🇷', 'البرتغال', '🇵🇹', 'إيه تي آند تي · دالاس', 'تحديث تجريبي')}
    ${fixtureCard('GROUP C', 'إسبانيا', '🇪🇸', 'المغرب', '🇲🇦', 'سوفاي · لوس أنجلوس', 'تحديث تجريبي')}
    ${fixtureCard('GROUP D', 'إنجلترا', '🇬🇧', 'كولومبيا', '🇨🇴', 'هارد روك · ميامي', 'تحديث تجريبي')}
    ${fixtureCard('GROUP E', 'ألمانيا', '🇩🇪', 'اليابان', '🇯🇵', 'لومن فيلد · سياتل', 'تحديث تجريبي')}
    ${fixtureCard('GROUP F', 'المكسيك', '🇲🇽', 'كرواتيا', '🇭🇷', 'إستاديو أزتيكا', 'الافتتاح · تجريبي')}
  </div>
</section>

<section>
  <div class="fx-section-title is-knockout">الدور الإقصائي</div>
  <div class="fx-bracket">
    ${bracketStep('R16',  'دور الـ16',   '48 → 16')}
    ${bracketStep('QF',   'ربع النهائي', '16 → 8')}
    ${bracketStep('SF',   'نصف النهائي', '8 → 4')}
    ${bracketStep('F',    'النهائي',     '2')}
  </div>
  <div class="fx-card-meta" style="margin-top:10px">جدول الإقصائيات يُضاف عند توفّر القرعة الرسمية. حاليًا تحديث تجريبي.</div>
</section>

<section>
  <div class="fx-section-title">المدن المضيفة 2026</div>
  <div class="fx-flag-row">${cityChips}</div>
</section>

<section>
  <div class="fx-section-title">معاينة الرادار</div>
  <div class="fx-preview">
    <div class="fx-preview-card">
      <div class="fx-best">
        <div class="fx-best-head">
          <span class="label">أفضل حركة الآن</span>
          <span class="decision-tag">معاينة</span>
        </div>
        <h2>راقب مباراة البرازيل في نيويورك، لكن لا تحجز سكن بعيد فقط لأنه أرخص.</h2>
        <div class="body">المنطقة القريبة من النقل تقلل مخاطرة يوم المباراة. SeatX يراقب الفرص الرسمية وينبّهك بأي تحديث.</div>
        <div class="fx-cta-row">
          <a class="fx-cta" href="/fanx/radar?demo=1">شوف رادار تجريبي</a>
          <button type="button" class="fx-cta-ghost" id="fxStart2">ابني راداري</button>
        </div>
        <div class="explain">المعاينة مبنية على بيانات Seed تجريبية. الرادار الفعلي يُحدّث عند كل دورة مراقبة من SeatX.</div>
      </div>
    </div>
    <div class="fx-preview-side">
      <div class="fx-mini-stadium" aria-hidden="true">
        <div class="fx-mini-stadium-label">ميت لايف ستاديوم · نيويورك</div>
        ${miniStadiumSvg()}
        <div class="fx-mini-stadium-foot">4 مناطق للسكن · فان زون قريب · حافلة المباراة الرسمية</div>
      </div>
    </div>
  </div>
</section>

<section>
  <div class="fx-section-title">الأسعار</div>
  <div class="fx-price-strip">
    ${priceCard('Free Preview',    '0',     'مجاني',     false)}
    ${priceCard('FanX Live Pass',  '$15.83', 'شهريًا · تُدفع $190 مرة وحدة بالسنة', true)}
    ${priceCard('FanX Pro',        '$40.83', 'شهريًا · تُدفع $490 مرة وحدة بالسنة', false)}
    ${priceCard('Concierge Radar', 'Custom','حسب الطلب', false)}
  </div>
  <div class="fx-cta-row" style="margin-top:16px">
    <a class="fx-cta" href="/fanx/pricing">احجز مقعدك</a>
    <a class="fx-cta-ghost" href="/fanx/pricing">شوف كل الخطط</a>
  </div>
  <div class="fx-card-meta" style="margin-top:10px">قائمة انتظار فقط حاليًا — بدون دفع. FanX لا يبيع ولا يضمن أي خدمة.</div>
</section>

${renderOnboardingModal({ cities })}

<script>
${TRY_JS}
(function(){
  function open(){
    if(typeof window.fxOpenOnboarding === 'function'){ window.fxOpenOnboarding(); return; }
    var b=document.getElementById('fxModalBackdrop'); if(b){ b.hidden=false; window.scrollTo({top:0,behavior:'smooth'}); }
  }
  var s=document.getElementById('fxStart'); if(s) s.addEventListener('click',open);
  var s2=document.getElementById('fxStart2'); if(s2) s2.addEventListener('click',open);
})();
</script>

<style>
.fx-hero{position:relative;width:100vw;margin-inline:calc(50% - 50vw);
  padding:72px 22px 60px;text-align:center;overflow:hidden;border:0;border-radius:0;
  background:
    radial-gradient(60% 100% at 50% 0%, rgba(163,230,53,.18), transparent 60%),
    radial-gradient(80% 60% at 100% 100%, rgba(163,230,53,.08), transparent 70%),
    radial-gradient(80% 60% at 0% 100%, rgba(96,165,250,.05), transparent 70%),
    linear-gradient(180deg,#0a0d14 0%,#080a0e 60%,#06090e 100%);
  margin-top:-18px;min-height:520px;display:flex;align-items:center;justify-content:center}
@media(min-width:720px){ .fx-hero{min-height:640px;margin-top:-28px} }
.fx-hero-bg{position:absolute;inset:0;pointer-events:none;
  background:
    radial-gradient(closest-side, rgba(163,230,53,.30), transparent 70%) 8% 18% / 440px 440px no-repeat,
    radial-gradient(closest-side, rgba(163,230,53,.18), transparent 70%) 92% 12% / 400px 400px no-repeat,
    radial-gradient(closest-side, rgba(96,165,250,.10), transparent 70%) 50% 95% / 600px 280px no-repeat;
  filter:blur(6px);opacity:.95}
.fx-hero > *{position:relative;z-index:1}
.fx-hero-inner{max-width:880px;margin:0 auto;padding:0 8px}
.fx-hero .fx-wc-eyebrow{margin-bottom:26px}
.fx-hero-h1{margin:0 auto 18px;max-width:780px;font-size:34px;line-height:1.2;font-weight:900;color:#f4f4f5;letter-spacing:-.01em}
.fx-hero-sub{max-width:680px;margin:0 auto 26px;font-size:16.5px;line-height:1.85;color:#d4d4d8}
.fx-hero-cta{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-bottom:20px}
.fx-hero-cta .fx-cta,.fx-hero-cta .fx-cta-ghost{min-width:200px;min-height:56px;font-size:16.5px}
.fx-hero-meta{font-family:'IBM Plex Mono',monospace;font-size:12.5px;color:#a1a1aa;letter-spacing:.06em;line-height:1.7}
@media(min-width:480px){ .fx-hero-h1{font-size:42px} }
@media(min-width:720px){ .fx-hero-h1{font-size:54px} .fx-hero-sub{font-size:18.5px} .fx-hero{padding:96px 32px 80px} }
@media(min-width:960px){ .fx-hero-h1{font-size:68px} }

.fx-preview{display:grid;gap:14px;grid-template-columns:1fr}
@media(min-width:960px){ .fx-preview{grid-template-columns:1fr 340px} }

.fx-mini-stadium{background:var(--bg-elev);border:1px solid var(--border);border-radius:14px;padding:18px;text-align:center}
.fx-mini-stadium-label{font-size:15px;font-weight:700;color:var(--text);margin-bottom:6px}
.fx-mini-stadium-foot{font-family:'IBM Plex Mono',monospace;font-size:11.5px;color:var(--text-3);letter-spacing:.06em;margin-top:10px;line-height:1.6}
.fx-mini-stadium svg{width:100%;height:auto}
</style>
`;
  return renderPage({ title: 'FanX', active_tab: 'landing' }, body);
}

function valueCard(kind: string, title: string, body: string): string {
  return `<article class="fx-card is-hover-lift">
    <h3>${iconFor(kind) ? `<span class="fx-card-ico">${iconFor(kind)}</span>` : ''}<span>${escapeHtml(title)}</span></h3>
    <div class="fx-card-body">${escapeHtml(body)}</div>
  </article>`;
}

function priceCard(name: string, amount: string, hint: string, featured: boolean): string {
  return `<a class="fx-price-card${featured ? ' is-featured' : ''}" href="/fanx/pricing">
    <span class="ttl">${escapeHtml(name)}</span>
    <span class="amt" dir="ltr"><bdi>${escapeHtml(amount)}</bdi></span>
    <span class="lbl">${escapeHtml(hint)}</span>
  </a>`;
}

function tickerItems(): string {
  // Original cinematic ticker — fixtures, cities, sample radar updates.
  // No real-time data: these are demo strings to set match-day feel.
  const items: Array<{c1?:string; team1?:string; c2?:string; team2?:string; loc?:string; meta?:string; type:'match'|'note'}> = [
    { type:'match', c1:'BR', team1:'البرازيل',   c2:'FR', team2:'فرنسا',    loc:'NEW YORK · MetLife',  meta:'مجموعة A' },
    { type:'note',  loc:'نيويورك',    meta:'18 فرصة اليوم' },
    { type:'match', c1:'AR', team1:'الأرجنتين', c2:'PT', team2:'البرتغال', loc:'DALLAS · AT&T',        meta:'مجموعة B' },
    { type:'note',  loc:'دالاس',      meta:'احتقان ما بعد المباراة' },
    { type:'match', c1:'ES', team1:'إسبانيا',   c2:'MA', team2:'المغرب',   loc:'LOS ANGELES · SoFi',   meta:'مجموعة C' },
    { type:'note',  loc:'تورنتو',     meta:'مشي للملعب من ليبرتي فيليج' },
    { type:'match', c1:'MX', team1:'المكسيك',   c2:'HR', team2:'كرواتيا', loc:'MEXICO CITY · Azteca', meta:'الافتتاح' },
    { type:'note',  loc:'ميامي',      meta:'فان زون باي فرنت' },
    { type:'match', c1:'GB', team1:'إنجلترا',   c2:'CO', team2:'كولومبيا', loc:'MIAMI · Hard Rock',   meta:'مجموعة D' },
    { type:'note',  loc:'سياتل',      meta:'مشي 10 دقائق للملعب' },
  ];
  return items.map(it => {
    if (it.type === 'match') {
      return `<span class="fx-ticker-item"><span class="pulse"></span>
        ${svgFlag(it.c1 || '', 20)}<span>${it.team1}</span>
        <span class="vs" dir="ltr">VS</span>
        ${svgFlag(it.c2 || '', 20)}<span>${it.team2}</span>
        <span class="loc" dir="ltr">· ${it.loc} · ${it.meta}</span></span>`;
    }
    return `<span class="fx-ticker-item"><span class="pulse"></span><span>${it.loc}</span><span class="loc" dir="ltr">· ${it.meta}</span></span>`;
  }).join('');
}

function tryPill(row: string, val: string, flag: string | null, label: string): string {
  const flagSpan = flag ? `<span class="flag" aria-hidden="true">${flag}</span>` : '';
  return `<button type="button" class="fx-try-pill" data-try-pill data-try-row="${escapeAttr(row)}" data-try-val="${escapeAttr(val)}">
    ${flagSpan}<span>${escapeHtml(label)}</span>
  </button>`;
}

function fixtureCard(group: string, a: string, fa: string, b: string, fb: string, venue: string, stage: string): string {
  return `<article class="fx-fix">
  <div class="fx-fix-head">
    <span class="fx-group-tag" dir="ltr"><bdi>${escapeHtml(group)}</bdi></span>
    <span class="fx-fix-stage" dir="ltr"><bdi>MATCH</bdi></span>
  </div>
  <div class="fx-fix-match">
    <span class="fx-fix-team"><span class="flag" aria-hidden="true">${fa}</span><span class="name">${escapeHtml(a)}</span></span>
    <span class="fx-fix-vs" dir="ltr"><bdi>VS</bdi></span>
    <span class="fx-fix-team"><span class="flag" aria-hidden="true">${fb}</span><span class="name">${escapeHtml(b)}</span></span>
  </div>
  <div class="fx-fix-foot">
    <span>${escapeHtml(venue)}</span>
    <span class="demo">${escapeHtml(stage)}</span>
  </div>
</article>`;
}

function bracketStep(stage: string, label: string, sub: string): string {
  return `<div class="fx-bracket-step">
  <div class="stage" dir="ltr"><bdi>${escapeHtml(stage)}</bdi></div>
  <div class="label">${escapeHtml(label)}</div>
  <div class="sub" dir="ltr"><bdi>${escapeHtml(sub)}</bdi></div>
</div>`;
}

function pitchSvg(): string {
  // Faint pitch markings overlay — gives the hero a real-stadium feel.
  // Stays in accent green only, semi-transparent.
  return `
<svg viewBox="0 0 1200 400" preserveAspectRatio="none">
  <defs>
    <linearGradient id="pf" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(163,230,53,0)"/>
      <stop offset="55%" stop-color="rgba(163,230,53,.08)"/>
      <stop offset="100%" stop-color="rgba(163,230,53,0)"/>
    </linearGradient>
  </defs>
  <rect x="0" y="80" width="1200" height="240" fill="url(#pf)"/>
  <rect x="60" y="80" width="1080" height="240" fill="none" stroke="rgba(163,230,53,.18)" stroke-width="1"/>
  <line x1="600" y1="80" x2="600" y2="320" stroke="rgba(163,230,53,.16)" stroke-width="1"/>
  <circle cx="600" cy="200" r="62" fill="none" stroke="rgba(163,230,53,.18)" stroke-width="1"/>
  <circle cx="600" cy="200" r="2.5" fill="rgba(163,230,53,.5)"/>
  <rect x="60" y="150" width="120" height="100" fill="none" stroke="rgba(163,230,53,.16)" stroke-width="1"/>
  <rect x="60" y="178" width="50" height="44" fill="none" stroke="rgba(163,230,53,.18)" stroke-width="1"/>
  <rect x="1020" y="150" width="120" height="100" fill="none" stroke="rgba(163,230,53,.16)" stroke-width="1"/>
  <rect x="1090" y="178" width="50" height="44" fill="none" stroke="rgba(163,230,53,.18)" stroke-width="1"/>
</svg>`;
}

function miniStadiumSvg(): string {
  return `
<svg viewBox="0 0 280 160" role="img">
  <defs>
    <radialGradient id="mfx" cx="50%" cy="50%" r="60%">
      <stop offset="0%" stop-color="#11151e"/>
      <stop offset="100%" stop-color="#080a0e"/>
    </radialGradient>
  </defs>
  <ellipse cx="140" cy="82" rx="128" ry="62" fill="url(#mfx)" stroke="#a3e635" stroke-opacity=".65" stroke-width="1.4"/>
  <ellipse cx="140" cy="82" rx="100" ry="46" fill="none" stroke="#a3e635" stroke-opacity=".35"/>
  <ellipse cx="140" cy="82" rx="74" ry="32" fill="none" stroke="#a3e635" stroke-opacity=".55"/>
  <rect x="100" y="64" width="80" height="36" rx="4" fill="rgba(163,230,53,.06)" stroke="#a3e635" stroke-opacity=".7"/>
  <line x1="140" y1="64" x2="140" y2="100" stroke="#a3e635" stroke-opacity=".55" stroke-width=".8"/>
  <circle cx="140" cy="82" r="5" fill="none" stroke="#a3e635" stroke-opacity=".55"/>
  <g>
    <circle cx="28"  cy="20" r="6" fill="rgba(163,230,53,.2)" stroke="#a3e635"/>
    <circle cx="252" cy="20" r="6" fill="rgba(163,230,53,.2)" stroke="#a3e635"/>
    <circle cx="28"  cy="144" r="6" fill="rgba(163,230,53,.2)" stroke="#a3e635"/>
    <circle cx="252" cy="144" r="6" fill="rgba(163,230,53,.2)" stroke="#a3e635"/>
  </g>
</svg>`;
}

// Client-side script for the interactive try-it-now demo. State machine
// is intentionally tiny (city/team/budget) and produces a curated Best
// Move sentence with stadium label and a confidence band per budget.
const TRY_JS = `
(function(){
  var cityNames = { 'new-york':'نيويورك','los-angeles':'لوس أنجلوس','miami':'ميامي','dallas':'دالاس','toronto':'تورنتو','mexico-city':'مكسيكو سيتي' };
  var stadiums  = { 'new-york':'ميت لايف','los-angeles':'سوفاي','miami':'هارد روك','dallas':'إيه تي آند تي','toronto':'بي إم أو','mexico-city':'إستاديو أزتيكا' };
  var groups    = { 'new-york':'GROUP A','los-angeles':'GROUP C','miami':'GROUP D','dallas':'GROUP B','toronto':'KNOCKOUT','mexico-city':'OPENER' };
  var state = { city:'new-york', team:'البرازيل', budget:'medium' };

  function whyLine(b){
    if(b==='low')    return 'الميزانية اقتصادية — راقب الفئة العادية وفكر بسكن أبعد قليلًا مع نقل عام موثوق.';
    if(b==='high')   return 'الميزانية مرتفعة — الفئة المميزة متاحة أكثر، اختر سكن قريب من الملعب.';
    return 'الميزانية متوسطة — فرصة جيدة في الفئة العادية، والمنطقة القريبة من النقل تقلل مخاطرة يوم المباراة.';
  }
  function confFor(b){ return b==='high' ? 84 : b==='low' ? 71 : 78; }
  function tagFor(team, city){
    if(team==='المكسيك' && city==='mexico-city') return 'افتتاح';
    if(city==='toronto') return 'إقصائي';
    return 'فرصة الآن';
  }

  function render(){
    var c = cityNames[state.city] || 'مدينتك';
    var s = stadiums[state.city]  || 'الملعب';
    document.getElementById('fxTryTitle').textContent =
      'راقب مباراة ' + state.team + ' في ' + c + '، لكن لا تحجز سكن بعيد فقط لأنه أرخص.';
    document.getElementById('fxTryBody').textContent  = whyLine(state.budget);
    document.getElementById('fxTryStadium').textContent = s;
    document.getElementById('fxTryConf').textContent  = confFor(state.budget) + '%';
    document.getElementById('fxTryTag').textContent   = tagFor(state.team, state.city);
  }

  function mark(){
    document.querySelectorAll('[data-try-pill]').forEach(function(p){
      var row = p.getAttribute('data-try-row');
      var val = p.getAttribute('data-try-val');
      if(state[row] === val) p.classList.add('is-on'); else p.classList.remove('is-on');
    });
  }

  document.querySelectorAll('[data-try-pill]').forEach(function(p){
    p.addEventListener('click', function(){
      var row = p.getAttribute('data-try-row');
      var val = p.getAttribute('data-try-val');
      state[row] = val;
      mark(); render();
    });
  });

  var whyBtn = document.getElementById('fxTryWhy');
  if(whyBtn) whyBtn.addEventListener('click', function(){
    if(window.fxToast) window.fxToast('السبب: ' + whyLine(state.budget), 'ok');
  });

  mark(); render();
})();
`;
