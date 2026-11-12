// ==========================================
// 🔬 محرك المعمل العلمي (كيمياء + فيزياء + أحياء)
// ==========================================
// منطق فقط، بدون أي رسم، عشان يتفهم ويتعدّل بسهولة.

export const REAGENTS = {
  hcl:    { n: "حمض الهيدروكلوريك",   f: "HCl",       t: "حمض",   c: 0xcfe3ff },
  naoh:   { n: "هيدروكسيد الصوديوم", f: "NaOH",      t: "قاعدة", c: 0xcfe3ff },
  phph:   { n: "كاشف الفينولفثالين", f: "Ph",        t: "كاشف",  c: 0xcfe3ff },
  na2co3: { n: "كربونات الصوديوم",   f: "Na₂CO₃",    t: "ملح",   c: 0xcfe3ff },
  cuso4:  { n: "كبريتات النحاس",     f: "CuSO₄",     t: "ملح",   c: 0x2f7dff },
  agno3:  { n: "نترات الفضة",        f: "AgNO₃",     t: "ملح",   c: 0xcfe3ff },
  nacl:   { n: "كلوريد الصوديوم",    f: "NaCl",      t: "ملح",   c: 0xcfe3ff },
  ki:     { n: "يوديد البوتاسيوم",   f: "KI",        t: "ملح",   c: 0xcfe3ff },
  pbno3:  { n: "نترات الرصاص",       f: "Pb(NO₃)₂",  t: "ملح",   c: 0xcfe3ff }
};

const CLEAR = 0xcfe3ff;
export const lerpHex = (a, b, t) => {
  const k = Math.max(0, Math.min(1, t)), p = (x, s) => (x >> s) & 255;
  return (Math.round(p(a, 16) + (p(b, 16) - p(a, 16)) * k) << 16) | (Math.round(p(a, 8) + (p(b, 8) - p(a, 8)) * k) << 8) | Math.round(p(a, 0) + (p(b, 0) - p(a, 0)) * k);
};
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// ---- تحديد التفاعل من محتويات الكأس ----
function detect(m) {
  const n = (id) => m[id] || 0, both = (a, b) => n(a) > 0 && n(b) > 0;
  const base = n("naoh") - n("hcl");

  if (both("hcl", "naoh") || (n("phph") && n("naoh"))) {
    const neut = Math.min(n("hcl"), n("naoh"));
    const pink = n("phph") > 0 && base > 0;
    return { id: "neut", name: neut ? "تعادل حمض وقاعدة" : "كشف القاعدة بالفينولفثالين", eq: neut ? "HCl + NaOH → NaCl + H₂O" : "NaOH + Ph → لون وردي",
      heat: 12 * Math.max(neut, 0.5), gas: 0, color: pink ? 0xff2d8a : CLEAR, precip: null, obs: neut ? ["heat", "color"] : ["color"],
      why: "الحمض والقاعدة يتفاعلوا ويكوّنوا ملح وماء، والتفاعل طارد للحرارة فبترتفع الحرارة. الفينولفثالين عديم اللون في الحمض ووردي في القاعدة، فاللون الوردي معناه إن القاعدة لسه زيادة، ولما يختفي يبقى التعادل حصل." };
  }
  if (both("hcl", "na2co3"))
    return { id: "carb", name: "حمض + كربونات", eq: "2HCl + Na₂CO₃ → 2NaCl + H₂O + CO₂↑", heat: -4, gas: 1, color: CLEAR, precip: null, obs: ["gas"],
      why: "الحمض يهاجم أيون الكربونات فيتكوّن غاز ثاني أكسيد الكربون (الفقاعات). الغاز بيخرج من المحلول فالتفاعل بيكتمل، والحرارة بتنزل شوية لأن التفاعل ماص للحرارة." };
  if (both("cuso4", "naoh"))
    return { id: "cuoh", name: "تكوين راسب أزرق", eq: "CuSO₄ + 2NaOH → Cu(OH)₂↓ + Na₂SO₄", heat: 3, gas: 0, color: 0xb9d6ff, precip: 0x3d8bff, obs: ["precip", "color"],
      why: "أيونات النحاس مع أيونات الهيدروكسيد تكوّن هيدروكسيد النحاس، وهو مادة لا تذوب في الماء فبيترسب على شكل راسب أزرق." };
  if (both("agno3", "nacl"))
    return { id: "agcl", name: "تكوين راسب أبيض (كلوريد الفضة)", eq: "AgNO₃ + NaCl → AgCl↓ + NaNO₃", heat: 1, gas: 0, color: 0xe6eeff, precip: 0xf4f4f4, photo: true, obs: ["precip", "light"],
      why: "الفضة والكلوريد يكوّنوا كلوريد الفضة الأبيض وهو لا يذوب. لو تعرّض للضوء يسوّد تدريجيًا لأن الضوء يحلل المركب ويفصل الفضة (تفاعل ضوئي). كل ما كان الضوء أقرب للرأسي كان تأثيره أكبر، لأن الإضاءة بتتناسب مع جيب تمام زاوية السقوط." };
  if (both("ki", "pbno3"))
    return { id: "pbi2", name: "المطر الذهبي", eq: "Pb(NO₃)₂ + 2KI → PbI₂↓ + 2KNO₃", heat: 1, gas: 0, color: 0xfff3b0, precip: 0xffc400, obs: ["precip", "color"], solubleAbove: 70,
      why: "يوديد الرصاص راسب أصفر ذهبي. ذوبانه بيزيد مع الحرارة، فلو سخّنت فوق 70° الراسب بيذوب، ولما يبرد بيرجع يتبلور على هيئة بلورات لامعة." };
  if (both("cuso4", "na2co3"))
    return { id: "cuco3", name: "راسب أخضر مزرق", eq: "CuSO₄ + Na₂CO₃ → CuCO₃↓ + Na₂SO₄", heat: 2, gas: 0, color: 0xa9e0d6, precip: 0x35b59a, obs: ["precip", "color"],
      why: "أيونات النحاس مع الكربونات تكوّن كربونات النحاس، وهي لا تذوب فبتترسب بلون أخضر مزرق." };
  const kinds = Object.keys(m).filter((k) => m[k] > 0);
  return kinds.length > 1 ? { id: "none", name: "لا يحدث تفاعل ظاهر", eq: "—", heat: 0, gas: 0, color: CLEAR, precip: null, obs: [],
      why: "المواد دي لما اتخلطت ما كوّنتش راسب ولا غاز ولا تغيّر في اللون، يعني مفيش تفاعل كيميائي واضح. جرّب مواد تانية." } : null;
}

// ---- الحالة والخطوات ----
export const newState = () => ({ mix: {}, doses: 0, p: 0, T: 25, Tcell: 25, dark: 0, damage: 0, rx: null, dissolved: false });

export function add(s, id) {
  if (!REAGENTS[id] || s.doses >= 6) return false;
  s.mix[id] = (s.mix[id] || 0) + 1; s.doses++;
  const prev = s.rx && s.rx.id, rx = detect(s.mix);
  s.rx = rx;
  if (rx && rx.id !== prev) s.p = 0; else if (rx) s.p = Math.min(s.p, 0.5);   // جرعة إضافية = التفاعل يكمل من جديد
  return true;
}
export function reset(s) { Object.assign(s, newState(), { T: s.T, Tcell: s.Tcell, damage: s.damage }); }

// سرعة التفاعل: تتضاعف تقريبًا كل 10°م (بحد أقصى عشان نقدر نشوفها)
export const rateFactor = (T) => Math.min(8, Math.pow(2, (T - 25) / 10));
// نشاط الإنزيمات في الخلية: أعلى ما يمكن عند 37°م وينعدم بعد 50°م
export const enzymeActivity = (T) => (T > 50 ? 0 : Math.exp(-Math.pow((T - 37) / 9, 2)));

// heat: 0..1 قوة الموقد | lightDeg: زاوية الضوء عن الرأسي (0 = من فوق مباشرة)
export function tick(s, dt, { heat = 0, lightDeg = 0 } = {}) {
  dt = Math.min(dt, 0.1);
  const rx = s.rx;
  let dp = 0;
  if (rx && s.p < 1) { dp = Math.min(1 - s.p, 0.17 * rateFactor(s.T) * dt); s.p += dp; }
  const target = 25 + heat * 75, k = target > s.T ? 0.25 : 0.1;   // التسخين أسرع من التبريد
  s.T = clamp(s.T + (target - s.T) * Math.min(1, k * dt) + (rx ? rx.heat * dp : 0), 15, 100);
  s.Tcell += (25 + (s.T - 25) * 0.6 - s.Tcell) * Math.min(1, 0.25 * dt);
  if (rx && rx.photo && s.p > 0.25) s.dark = Math.min(1, s.dark + 0.1 * Math.max(0, Math.cos((lightDeg * Math.PI) / 180)) * dt);
  s.dissolved = !!(rx && rx.solubleAbove && s.T > rx.solubleAbove);
  if (s.Tcell > 45) s.damage = Math.min(1, s.damage + ((s.Tcell - 45) / 10) * 0.25 * dt);   // تلف دائم للإنزيمات
}

// ---- مدخلات الرسم ----
export function view(s) {
  const rx = s.rx, p = s.p;
  const base = (s.mix.cuso4 ? REAGENTS.cuso4.c : CLEAR);
  const color = rx && rx.color != null ? lerpHex(base, rx.color, p) : base;
  return {
    level: Math.min(0.88, s.doses ? 0.14 + 0.16 * s.doses : 0),
    color, alpha: 0.55,
    precipAmt: rx && rx.precip && !s.dissolved ? p : 0,
    precipColor: rx && rx.precip ? lerpHex(rx.precip, 0x2e2e2e, s.dark) : 0xffffff,
    gas: clamp((rx ? rx.gas * Math.max(0, 1 - p) : 0) + (s.T > 96 ? 0.5 : 0), 0, 1),
    vapor: clamp((s.T - 55) / 45, 0, 1),
    cell: enzymeActivity(s.Tcell) * (1 - s.damage)
  };
}
