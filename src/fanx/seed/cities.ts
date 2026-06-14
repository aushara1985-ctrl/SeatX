// FanX seed — 2026 World Cup host cities + stadiums + curated zones.
// Strings are intentionally Arabic-first labels. No fake prices: labels only
// ("مرتفع" / "متوسط" / "اقتصادي" / time bands like "20-30 دقيقة"). All seeded
// content is marked "تحديث تجريبي" downstream in the UI.

export interface FanxCity {
  slug: string;            // url-safe id used in /fanx/city/:slug
  name_ar: string;
  name_en: string;
  country: string;         // 'US' | 'CA' | 'MX'
  timezone_label: string;
}

export interface FanxStadium {
  city_slug: string;
  name_ar: string;
  name_en: string;
}

export interface FanxZone {
  city_slug: string;
  stadium_en: string;
  zone_name: string;       // Arabic label
  distance_label: string;
  transport_label: string;
  price_level: 'اقتصادي' | 'متوسط' | 'مرتفع';
  family_friendly: boolean;
  risk_level: 'منخفض' | 'متوسط' | 'مرتفع';
  notes: string;
}

export const FANX_CITIES: FanxCity[] = [
  { slug: 'new-york',    name_ar: 'نيويورك / نيوجيرسي', name_en: 'New York / New Jersey', country: 'US', timezone_label: 'الساحل الشرقي' },
  { slug: 'dallas',      name_ar: 'دالاس',               name_en: 'Dallas',                country: 'US', timezone_label: 'وسط الولايات' },
  { slug: 'miami',       name_ar: 'ميامي',               name_en: 'Miami',                 country: 'US', timezone_label: 'الساحل الشرقي' },
  { slug: 'los-angeles', name_ar: 'لوس أنجلوس',          name_en: 'Los Angeles',           country: 'US', timezone_label: 'الساحل الغربي' },
  { slug: 'kansas-city', name_ar: 'كانساس سيتي',         name_en: 'Kansas City',           country: 'US', timezone_label: 'وسط الولايات' },
  { slug: 'seattle',     name_ar: 'سياتل',               name_en: 'Seattle',               country: 'US', timezone_label: 'الساحل الغربي' },
  { slug: 'toronto',     name_ar: 'تورنتو',              name_en: 'Toronto',               country: 'CA', timezone_label: 'الساحل الشرقي' },
  { slug: 'mexico-city', name_ar: 'مكسيكو سيتي',          name_en: 'Mexico City',           country: 'MX', timezone_label: 'وسط المكسيك' },
];

export const FANX_STADIUMS: FanxStadium[] = [
  { city_slug: 'new-york',    name_ar: 'ميت لايف ستاديوم',   name_en: 'MetLife Stadium' },
  { city_slug: 'dallas',      name_ar: 'إيه تي آند تي ستاديوم', name_en: 'AT&T Stadium' },
  { city_slug: 'miami',       name_ar: 'هارد روك ستاديوم',   name_en: 'Hard Rock Stadium' },
  { city_slug: 'los-angeles', name_ar: 'سوفاي ستاديوم',      name_en: 'SoFi Stadium' },
  { city_slug: 'kansas-city', name_ar: 'أروهيد ستاديوم',     name_en: 'Arrowhead Stadium' },
  { city_slug: 'seattle',     name_ar: 'لومن فيلد',           name_en: 'Lumen Field' },
  { city_slug: 'toronto',     name_ar: 'بي إم أو فيلد',       name_en: 'BMO Field' },
  { city_slug: 'mexico-city', name_ar: 'إستاديو أزتيكا',      name_en: 'Estadio Azteca' },
];

// Curated zones per stadium — illustrative seed, not live data.
export const FANX_ZONES: FanxZone[] = [
  // New York / MetLife
  { city_slug: 'new-york', stadium_en: 'MetLife Stadium', zone_name: 'إيست رذرفورد - قريب من الملعب', distance_label: '10-15 دقيقة', transport_label: 'حافلة المباراة', price_level: 'مرتفع', family_friendly: true, risk_level: 'منخفض', notes: 'أفضل قرب للملعب يوم المباراة' },
  { city_slug: 'new-york', stadium_en: 'MetLife Stadium', zone_name: 'سيكاوكس - توازن', distance_label: '20-25 دقيقة', transport_label: 'قطار NJ Transit', price_level: 'متوسط', family_friendly: true, risk_level: 'منخفض', notes: 'توازن جيد بين السعر والقرب' },
  { city_slug: 'new-york', stadium_en: 'MetLife Stadium', zone_name: 'مانهاتن وسط', distance_label: '40-60 دقيقة', transport_label: 'قطار + حافلة', price_level: 'مرتفع', family_friendly: true, risk_level: 'متوسط', notes: 'تجربة المدينة لكن قد يطول التنقل يوم المباراة' },
  { city_slug: 'new-york', stadium_en: 'MetLife Stadium', zone_name: 'نيوآرك - اقتصادي', distance_label: '30-40 دقيقة', transport_label: 'قطار', price_level: 'اقتصادي', family_friendly: false, risk_level: 'متوسط', notes: 'أوفر بالميزانية، تنقّل أطول' },

  // Dallas / AT&T
  { city_slug: 'dallas', stadium_en: 'AT&T Stadium', zone_name: 'أرلينغتون - قريب', distance_label: '5-10 دقيقة', transport_label: 'سيارة / Uber', price_level: 'متوسط', family_friendly: true, risk_level: 'منخفض', notes: 'الأقرب للملعب وتسهيلات عائلية' },
  { city_slug: 'dallas', stadium_en: 'AT&T Stadium', zone_name: 'وسط دالاس', distance_label: '25-35 دقيقة', transport_label: 'سيارة', price_level: 'مرتفع', family_friendly: true, risk_level: 'منخفض', notes: 'الفنادق الكبرى لكن أبعد عن الملعب' },
  { city_slug: 'dallas', stadium_en: 'AT&T Stadium', zone_name: 'فورت وورث', distance_label: '20-30 دقيقة', transport_label: 'سيارة', price_level: 'متوسط', family_friendly: true, risk_level: 'منخفض', notes: 'بديل هادئ بسعر معقول' },

  // Miami / Hard Rock
  { city_slug: 'miami', stadium_en: 'Hard Rock Stadium', zone_name: 'ميامي غاردنز', distance_label: '5-10 دقيقة', transport_label: 'سيارة / حافلة المباراة', price_level: 'متوسط', family_friendly: true, risk_level: 'منخفض', notes: 'الأقرب للملعب، خيارات محدودة' },
  { city_slug: 'miami', stadium_en: 'Hard Rock Stadium', zone_name: 'وسط ميامي', distance_label: '30-45 دقيقة', transport_label: 'سيارة', price_level: 'مرتفع', family_friendly: true, risk_level: 'متوسط', notes: 'تجربة المدينة، تنقّل أطول' },
  { city_slug: 'miami', stadium_en: 'Hard Rock Stadium', zone_name: 'هوليوود FL', distance_label: '20-30 دقيقة', transport_label: 'سيارة', price_level: 'متوسط', family_friendly: true, risk_level: 'منخفض', notes: 'توازن بين القرب والسعر' },

  // Los Angeles / SoFi
  { city_slug: 'los-angeles', stadium_en: 'SoFi Stadium', zone_name: 'إنغلوود', distance_label: '5-15 دقيقة', transport_label: 'سيارة / مترو', price_level: 'متوسط', family_friendly: true, risk_level: 'منخفض', notes: 'الأقرب للملعب' },
  { city_slug: 'los-angeles', stadium_en: 'SoFi Stadium', zone_name: 'وسط لوس أنجلوس', distance_label: '30-50 دقيقة', transport_label: 'سيارة / مترو', price_level: 'مرتفع', family_friendly: true, risk_level: 'متوسط', notes: 'تجربة المدينة، احتقان مروري بعد المباراة' },
  { city_slug: 'los-angeles', stadium_en: 'SoFi Stadium', zone_name: 'سانتا مونيكا', distance_label: '25-40 دقيقة', transport_label: 'سيارة', price_level: 'مرتفع', family_friendly: true, risk_level: 'متوسط', notes: 'شاطئ وتجربة، مواصلات أطول' },

  // Kansas City / Arrowhead
  { city_slug: 'kansas-city', stadium_en: 'Arrowhead Stadium', zone_name: 'وسط كانساس سيتي', distance_label: '15-20 دقيقة', transport_label: 'سيارة', price_level: 'متوسط', family_friendly: true, risk_level: 'منخفض', notes: 'الفنادق الرئيسية' },
  { city_slug: 'kansas-city', stadium_en: 'Arrowhead Stadium', zone_name: 'أوفرلاند بارك', distance_label: '20-30 دقيقة', transport_label: 'سيارة', price_level: 'اقتصادي', family_friendly: true, risk_level: 'منخفض', notes: 'هادئ ومناسب للعائلة' },

  // Seattle / Lumen Field
  { city_slug: 'seattle', stadium_en: 'Lumen Field', zone_name: 'وسط سياتل', distance_label: '5-10 دقيقة مشي', transport_label: 'مشي / Link Light Rail', price_level: 'مرتفع', family_friendly: true, risk_level: 'منخفض', notes: 'أفضل خيار - مشي للملعب' },
  { city_slug: 'seattle', stadium_en: 'Lumen Field', zone_name: 'كابيتول هيل', distance_label: '15-20 دقيقة', transport_label: 'Light Rail', price_level: 'متوسط', family_friendly: false, risk_level: 'منخفض', notes: 'جو شبابي، تنقل سهل' },
  { city_slug: 'seattle', stadium_en: 'Lumen Field', zone_name: 'بيلفيو', distance_label: '20-30 دقيقة', transport_label: 'سيارة', price_level: 'متوسط', family_friendly: true, risk_level: 'منخفض', notes: 'بديل عائلي هادئ' },

  // Toronto / BMO Field
  { city_slug: 'toronto', stadium_en: 'BMO Field', zone_name: 'ليبرتي فيليج', distance_label: '5-10 دقيقة مشي', transport_label: 'مشي / Streetcar', price_level: 'متوسط', family_friendly: true, risk_level: 'منخفض', notes: 'الأقرب وأفضل تجربة مشي' },
  { city_slug: 'toronto', stadium_en: 'BMO Field', zone_name: 'وسط تورنتو', distance_label: '15-20 دقيقة', transport_label: 'مترو / Streetcar', price_level: 'مرتفع', family_friendly: true, risk_level: 'منخفض', notes: 'تجربة المدينة مع تنقل ممتاز' },
  { city_slug: 'toronto', stadium_en: 'BMO Field', zone_name: 'ميسيساغا', distance_label: '30-40 دقيقة', transport_label: 'GO Transit', price_level: 'اقتصادي', family_friendly: true, risk_level: 'متوسط', notes: 'أوفر بالميزانية، تنقل أطول' },

  // Mexico City / Azteca
  { city_slug: 'mexico-city', stadium_en: 'Estadio Azteca', zone_name: 'كويوكان', distance_label: '20-30 دقيقة', transport_label: 'سيارة / Metrobús', price_level: 'متوسط', family_friendly: true, risk_level: 'متوسط', notes: 'حي ثقافي، توازن جيد' },
  { city_slug: 'mexico-city', stadium_en: 'Estadio Azteca', zone_name: 'بولانكو', distance_label: '40-55 دقيقة', transport_label: 'سيارة', price_level: 'مرتفع', family_friendly: true, risk_level: 'منخفض', notes: 'الفنادق الراقية، تنقّل أطول' },
  { city_slug: 'mexico-city', stadium_en: 'Estadio Azteca', zone_name: 'إكسوكويلكو', distance_label: '15-25 دقيقة', transport_label: 'سيارة', price_level: 'اقتصادي', family_friendly: false, risk_level: 'متوسط', notes: 'الأقرب اقتصاديًا، تحقق من الأمان ليلًا' },
];
