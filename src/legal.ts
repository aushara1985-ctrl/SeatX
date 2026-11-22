// Legal pages (Terms / Privacy / Refund / Contact). Static, self-contained.
// Operator: inventive gaze, LLC. Prices mirror the pricing section on the home page.
import type { Express, Request, Response } from 'express';

const EMAIL = 'hala@inab.app';
const UPDATED = '22 نوفمبر 2026';

function shell(title: string, desc: string, path: string, siteUrl: string, body: string): string {
  return `<!doctype html><html lang="ar" dir="rtl"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title} — SeatX</title>
<meta name="description" content="${desc}"/>
<link rel="canonical" href="${siteUrl}${path}"/>
<meta name="robots" content="index,follow"/>
<link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap" rel="stylesheet"/>
<style>
:root{--bg:#0a0e14;--surf:#111722;--border:#1e2836;--lime:#a3e635;--txt:#e6e9ef;--txt2:#9aa4b2}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--txt);font-family:'Tajawal',system-ui,sans-serif;line-height:1.8}
a{color:var(--lime)}.wrap{max-width:760px;margin:0 auto;padding:24px 18px 56px}
.brand{font-weight:800;font-size:17px;letter-spacing:.5px;margin-bottom:22px;display:inline-block;color:var(--txt);text-decoration:none}
.brand .x{background:var(--lime);color:#0a0e14;border-radius:6px;padding:0 6px}
h1{font-size:28px;margin:0 0 6px}h2{font-size:18px;margin:0 0 8px;color:var(--lime)}
.card{background:var(--surf);border:1px solid var(--border);border-radius:16px;padding:18px 20px;margin-bottom:12px}
.card p,.card li{color:var(--txt);font-size:15px;margin:6px 0}.card ul{margin:6px 0;padding-inline-start:20px}
.muted{color:var(--txt2);font-size:13px}.nav{margin-top:22px;font-size:13px;color:var(--txt2);display:flex;gap:14px;flex-wrap:wrap}
</style></head><body><div class="wrap">
<a class="brand" href="/">SEAT<span class="x">X</span></a>
<h1>${title}</h1><p class="muted">آخر تحديث: ${UPDATED}</p>
${body}
<p class="muted">يُشغّل هذا المنتج من قبل inventive gaze, LLC — الدعم: <a href="mailto:${EMAIL}">${EMAIL}</a></p>
<div class="nav"><a href="/terms">الشروط</a><a href="/privacy">الخصوصية</a><a href="/terms#refund">الاسترداد والإلغاء</a><a href="/terms#contact">تواصل معنا</a><a href="/">الرئيسية</a></div>
</div></body></html>`;
}

const sec = (id: string, h: string, inner: string) => `<div class="card"${id ? ` id="${id}"` : ''}><h2>${h}</h2>${inner}</div>`;

const TERMS = [
  sec('', '1. قبول الشروط', '<p>باستخدامك لـ SeatX توافق على هذه الشروط. إذا ما توافق عليها، لا تستخدم الخدمة.</p>'),
  sec('', '2. وش هو SeatX', '<p>SeatX خدمة تنبيهات: تراقب صفحات بيع تذاكر المباريات والفعاليات في السعودية وتنبّهك لما ترجع مقاعد متاحة. SeatX ما يبيع التذاكر ولا يحجزها عنك، والشراء يتم دائماً من موقع الجهة البائعة، وما نضمن توفر مقعد أو سعر معيّن.</p>'),
  sec('', '3. الحساب', '<p>تستخدم بريدك الإلكتروني لاستقبال التنبيهات. أنت مسؤول عن صحة بريدك وعن أي نشاط يتم من خلاله.</p>'),
  sec('', '4. الباقات والدفع', '<ul><li>التنبيهات الأساسية مجانية.</li><li>باقة «الأولوية» 9$ شهرياً (سعر المؤسسين للأوائل، بدل 19$)، وباقة «وصول مدى الحياة» 199$ دفعة واحدة. الأسعار بالدولار الأمريكي.</li><li>الدفع الحين لم يُفتح بعد: التسجيل في قائمة الانتظار مجاني ولا ينسحب منك أي مبلغ. لما يفتح الدفع، يتم إلكترونياً ببطاقة عن طريق Stripe بموجب هذه الشروط، ولا نحفظ بيانات بطاقتك عندنا.</li><li>الاشتراك الشهري يتجدد تلقائياً كل شهر بنفس السعر لين تلغيه، وباقة مدى الحياة بدون تجديد.</li></ul>'),
  sec('', '5. التجربة المجانية', '<p>الخطة المجانية متاحة بدون بطاقة. ما ينسحب منك أي مبلغ إلا إذا اخترت باقة مدفوعة ودفعت بنفسك.</p>'),
  sec('', '6. الإلغاء', '<ul><li>تقدر تلغي اشتراكك الشهري متى ما بغيت بإيميل لـ ' + EMAIL + '.</li><li>بعد الإلغاء يظل حسابك شغال لين نهاية الفترة المدفوعة، وما يتجدد بعدها.</li></ul>'),
  sec('refund', '7. سياسة الاسترداد', '<ul><li>الاشتراك الشهري: استرداد كامل لأول دفعة إذا طلبته خلال 7 أيام من الدفع. بعدها ما فيه استرداد للفترة الجارية، ويوقف التجديد الجاي.</li><li>باقة مدى الحياة: استرداد كامل إذا طلبته خلال 14 يوم من الشراء.</li><li>الاسترداد يرجع لنفس البطاقة خلال 5–10 أيام عمل حسب البنك.</li><li>لطلب الاسترداد: إيميل لـ ' + EMAIL + ' فيه بريد حسابك.</li></ul>'),
  sec('', '8. الاستخدام المقبول', '<p>لا تستخدم SeatX لإساءة استخدام مواقع الجهات البائعة أو الالتفاف على أنظمة الطوابير أو إعادة بيع التذاكر بشكل مخالف للأنظمة، ولا لأي نشاط مخالف للقانون. يحق لنا إيقاف أي حساب يخالف هذا.</p>'),
  sec('', '9. البيانات والخصوصية', '<p>نستخدم بياناتك فقط لتشغيل الخدمة ولا نبيعها. التفاصيل في <a href="/privacy">سياسة الخصوصية</a>.</p>'),
  sec('', '10. حدود المسؤولية', '<p>نقدم الخدمة كما هي ونسعى أن تكون متاحة دائماً، لكن التنبيهات قد تتأخر أو تفوت، وما نضمن الحصول على تذكرة. مسؤوليتنا في أي حال لا تتجاوز المبلغ اللي دفعته لنا خلال آخر 3 أشهر.</p>'),
  sec('contact', '11. التواصل', '<p>يُشغّل هذا المنتج من قبل inventive gaze, LLC (ديلاوير، الولايات المتحدة).</p><p>الإيميل: <a href="mailto:' + EMAIL + '">' + EMAIL + '</a> — نرد خلال يوم عمل.</p>'),
].join('');

const PRIVACY = [
  sec('', '1. المقدمة', '<p>SeatX يُشغّله inventive gaze, LLC. توضح هذه السياسة وش نجمع من بياناتك وكيف نستخدمها.</p>'),
  sec('', '2. وش نجمع', '<ul><li>بريدك الإلكتروني والفعاليات اللي تتابعها لإرسال التنبيهات.</li><li>رمز الإشعارات في المتصفح إذا فعّلتها.</li><li>بيانات استخدام عامة (صفحات مفتوحة) لتحسين الخدمة.</li><li>الدفع (عند فتحه) يتم عن طريق Stripe، ولا نحفظ بيانات بطاقتك.</li></ul>'),
  sec('', '3. كيف نستخدمها', '<p>نستخدم بياناتك فقط لتشغيل الخدمة وإرسال التنبيهات اللي طلبتها. ما نبيع بياناتك ولا نشاركها مع أحد إلا مزودي الخدمة اللازمين للتشغيل (استضافة، بريد إلكتروني، إشعارات، دفع).</p>'),
  sec('', '4. حقوقك', '<p>لك الحق في الوصول إلى بياناتك وتصحيحها وحذفها، وإلغاء الاشتراك في أي تنبيه من الرابط داخل الرسالة. لأي طلب راسلنا على ' + EMAIL + '.</p>'),
  sec('', '5. الاتصال بنا', '<p><a href="mailto:' + EMAIL + '">' + EMAIL + '</a></p>'),
].join('');

export function registerLegal(app: Express, siteUrl: string): void {
  const send = (res: Response, html: string) => res.type('html').send(html);
  app.get('/terms', (_q: Request, res: Response) => send(res, shell('شروط الخدمة', 'شروط استخدام SeatX، تنبيهات رجوع تذاكر المباريات والفعاليات في السعودية.', '/terms', siteUrl, TERMS)));
  app.get('/privacy', (_q: Request, res: Response) => send(res, shell('سياسة الخصوصية', 'كيف يتعامل SeatX مع بياناتك، وحقك في الوصول والتصحيح والحذف.', '/privacy', siteUrl, PRIVACY)));
  app.get('/refund', (_q: Request, res: Response) => res.redirect(301, '/terms#refund'));
  app.get('/contact', (_q: Request, res: Response) => res.redirect(301, '/terms#contact'));
}
