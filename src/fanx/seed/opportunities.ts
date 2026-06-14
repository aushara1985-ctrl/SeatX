// FanX seed — sample opportunities across all 7 types. These are
// illustrative seed rows. Every row is labelled "تحديث تجريبي" in the UI.
// No fake prices: price_label is a string range. No fake countdowns:
// urgency is a label ("اليوم"/"الأسبوع") not a timer.

export interface FanxSeedOpportunity {
  type: 'ticket' | 'stay' | 'transport' | 'fan_zone' | 'alternative_match' | 'warning' | 'city_tip';
  city: string;            // city slug
  stadium?: string;        // stadium name_en
  match_id?: string;
  team?: string;
  title: string;
  description: string;
  price_label?: string;
  distance_label?: string;
  source_url?: string;
  source_label?: string;
  urgency: 'اليوم' | 'الأسبوع' | 'وقت لاحق';
  risk_level: 'منخفض' | 'متوسط' | 'مرتفع';
  confidence: number;      // 0..1
}

export const FANX_OPPORTUNITIES: FanxSeedOpportunity[] = [
  // --- Ticket opportunities (no live prices — labels only) ---
  {
    type: 'ticket',
    city: 'new-york',
    stadium: 'MetLife Stadium',
    match_id: 'GROUP_A_NY_1',
    team: 'البرازيل',
    title: 'فرصة محتملة: تذكرة مجموعة البرازيل',
    description: 'ظهرت فرصة محتملة في المصدر الرسمي. SeatX يراقب ويُنبّه عند أي تحديث.',
    price_label: 'متوسط',
    source_label: 'FIFA Official',
    urgency: 'اليوم',
    risk_level: 'متوسط',
    confidence: 0.72,
  },
  {
    type: 'ticket',
    city: 'dallas',
    stadium: 'AT&T Stadium',
    match_id: 'GROUP_B_DALLAS_1',
    team: 'الأرجنتين',
    title: 'فرصة محتملة: تذكرة مجموعة الأرجنتين',
    description: 'تذكرة محتملة من المصدر الرسمي. تحقق بنفسك قبل أي قرار.',
    price_label: 'مرتفع',
    source_label: 'FIFA Official',
    urgency: 'اليوم',
    risk_level: 'متوسط',
    confidence: 0.7,
  },
  {
    type: 'ticket',
    city: 'los-angeles',
    stadium: 'SoFi Stadium',
    match_id: 'GROUP_C_LA_1',
    team: 'إسبانيا',
    title: 'فرصة محتملة: تذكرة مجموعة إسبانيا',
    description: 'تذكرة في المصدر الرسمي. SeatX يُنبّه عند أي تحديث في التوفر.',
    price_label: 'متوسط',
    source_label: 'FIFA Official',
    urgency: 'الأسبوع',
    risk_level: 'منخفض',
    confidence: 0.74,
  },

  // --- Stay opportunities (zone recommendations, not hotel listings) ---
  {
    type: 'stay',
    city: 'new-york',
    stadium: 'MetLife Stadium',
    title: 'منطقة سيكاوكس — توازن جيد',
    description: 'قطار NJ Transit يوصلك للملعب خلال 20-25 دقيقة، أوفر من مانهاتن.',
    price_label: 'متوسط',
    distance_label: '20-25 دقيقة',
    urgency: 'الأسبوع',
    risk_level: 'منخفض',
    confidence: 0.78,
  },
  {
    type: 'stay',
    city: 'seattle',
    stadium: 'Lumen Field',
    title: 'منطقة وسط سياتل — مشي للملعب',
    description: 'تقدر تمشي للملعب يوم المباراة، أفضل خيار لتجنب احتقان النقل.',
    price_label: 'مرتفع',
    distance_label: '5-10 دقيقة مشي',
    urgency: 'الأسبوع',
    risk_level: 'منخفض',
    confidence: 0.82,
  },
  {
    type: 'stay',
    city: 'toronto',
    stadium: 'BMO Field',
    title: 'منطقة ليبرتي فيليج — مشي وقرب',
    description: 'مسافة قصيرة مشيًا للملعب، تجربة محلية ممتازة.',
    price_label: 'متوسط',
    distance_label: '5-10 دقيقة مشي',
    urgency: 'الأسبوع',
    risk_level: 'منخفض',
    confidence: 0.8,
  },

  // --- Transport (intelligence, no fake routes) ---
  {
    type: 'transport',
    city: 'los-angeles',
    stadium: 'SoFi Stadium',
    title: 'احذر احتقان ما بعد المباراة',
    description: 'لا تعتمد على Uber/Lyft فورًا بعد المباراة. خذ مترو K Line من Hollywood Park وامشِ.',
    urgency: 'اليوم',
    risk_level: 'مرتفع',
    confidence: 0.85,
  },
  {
    type: 'transport',
    city: 'new-york',
    stadium: 'MetLife Stadium',
    title: 'حافلة المباراة الرسمية أفضل من القطار',
    description: 'يوم المباراة قطار MetLife Sports Complex يمتلئ مبكرًا. الحافلة الرسمية أوثق.',
    urgency: 'اليوم',
    risk_level: 'متوسط',
    confidence: 0.78,
  },

  // --- Fan zones (curated) ---
  {
    type: 'fan_zone',
    city: 'new-york',
    title: 'FIFA Fan Festival - Liberty State Park',
    description: 'مهرجان رسمي للجماهير، شاشة عملاقة، عائلي.',
    urgency: 'الأسبوع',
    risk_level: 'منخفض',
    confidence: 0.85,
    source_label: 'FIFA Official',
  },
  {
    type: 'fan_zone',
    city: 'miami',
    title: 'فان زون باي فرنت بارك',
    description: 'تجمع جماهيري على الواجهة البحرية، أنشطة عائلية وعروض.',
    urgency: 'الأسبوع',
    risk_level: 'منخفض',
    confidence: 0.8,
    source_label: 'FIFA Official',
  },

  // --- Alternative matches (smarter choice when target is expensive/sold out) ---
  {
    type: 'alternative_match',
    city: 'dallas',
    match_id: 'ALT_DALLAS_1',
    title: 'مباراة بديلة أذكى: مجموعة H في AT&T',
    description: 'نفس الملعب، تذاكر أوفر، تنقّل أسهل، أجواء قوية.',
    price_label: 'متوسط',
    urgency: 'الأسبوع',
    risk_level: 'منخفض',
    confidence: 0.7,
  },
  {
    type: 'alternative_match',
    city: 'new-york',
    match_id: 'ALT_NY_1',
    title: 'بديل: دور المجموعات في MetLife',
    description: 'إذا كانت مباراة البرازيل غالية، فيه مباراة بنفس المدينة بسعر أقل ومواصلات أبسط.',
    price_label: 'متوسط',
    urgency: 'الأسبوع',
    risk_level: 'منخفض',
    confidence: 0.7,
  },

  // --- Warnings (transport / safety hints) ---
  {
    type: 'warning',
    city: 'mexico-city',
    title: 'تنبيه: تجنب التنقل ليلًا في إكسوكويلكو',
    description: 'منطقة اقتصادية لكن يفضل العودة قبل المساء.',
    urgency: 'اليوم',
    risk_level: 'متوسط',
    confidence: 0.7,
  },

  // --- City tips (general guidance) ---
  {
    type: 'city_tip',
    city: 'kansas-city',
    title: 'كانساس سيتي: استأجر سيارة',
    description: 'المواصلات العامة محدودة. سيارة استئجار أو Uber هما الأفضل.',
    urgency: 'وقت لاحق',
    risk_level: 'منخفض',
    confidence: 0.85,
  },
  {
    type: 'city_tip',
    city: 'toronto',
    title: 'تورنتو: مترو + Streetcar كافي',
    description: 'لا تحتاج سيارة. شبكة TTC تغطي معظم الوجهات بسهولة.',
    urgency: 'وقت لاحق',
    risk_level: 'منخفض',
    confidence: 0.85,
  },
];
