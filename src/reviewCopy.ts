import { l } from "./data";
export const reviewCopy = {
  eyebrow: l("L’AVIS DE NOS CLIENTS", "WHAT OUR GUESTS SAY", "آراء عملائنا"),
  // The title reads start + accent + end; the accent is highlighted.
  titleStart: l("Vos moments et ", "Your moments and ", "لحظاتكم "),
  titleAccent: l("vos avis", "your reviews", "وآراؤكم"),
  titleEnd: l(" comptent", " matter", " تهمنا"),
  intro: l(
    "Découvrez ce que nos clients racontent de leur passage chez nous : chaque avis nous aide à faire encore mieux.",
    "See what our guests say about their visit — every review helps us do even better.",
    "اكتشف ما يقوله عملاؤنا عن تجربتهم معنا، فكل رأي يساعدنا على تقديم تجربة أفضل دائماً.",
  ),
  write: l("Donner mon avis", "Write a review", "أضف رأيك"),
  summary: l("Note de nos clients", "Guest rating", "تقييم عملائنا"),
  outOf: l("sur 5", "out of 5", "من 5"),
  // {n} is the formatted number of reviews.
  countOne: l("{n} avis", "{n} review", "تقييم واحد"),
  countTwo: l("{n} avis", "{n} reviews", "تقييمان"),
  countFew: l("{n} avis", "{n} reviews", "{n} تقييمات"),
  countMany: l("{n} avis", "{n} reviews", "{n} تقييماً"),
  countOther: l("{n} avis", "{n} reviews", "{n} تقييم"),
  verdictExcellent: l(
    "Une note excellente",
    "An excellent rating",
    "تقييم ممتاز من عملائنا",
  ),
  verdictGreat: l(
    "Une très bonne note",
    "A great rating",
    "تقييم رائع من عملائنا",
  ),
  verdictGood: l("Une bonne note", "A good rating", "تقييم جيد من عملائنا"),
  verdictNeutral: l(
    "La note de nos clients",
    "Our guests’ rating",
    "تقييم عملائنا",
  ),
  verdictProud: l(
    "Votre confiance nous rend fiers et nous pousse à donner le meilleur, chaque jour.",
    "Your trust makes us proud and pushes us to give our best, every day.",
    "نفخر بثقتكم واختياركم الدائم، وهذا ما يدفعنا دائماً لتقديم الأفضل.",
  ),
  verdictListening: l(
    "Chaque avis nous aide à progresser. Merci de le partager avec nous.",
    "Every review helps us improve. Thank you for sharing yours.",
    "كل رأي يساعدنا على التحسّن. شكراً لمشاركتنا تجربتكم.",
  ),
  breakdown: l("Répartition des notes", "Rating breakdown", "توزيع التقييمات"),
  // {n} is a star count from 1 to 5.
  starsLabel: l("{n} étoiles", "{n} stars", "{n} نجوم"),
  starsTwo: l("{n} étoiles", "{n} stars", "نجمتان"),
  starLabel: l("{n} étoile", "{n} star", "نجمة واحدة"),
  sortLabel: l("Trier les avis", "Sort reviews", "ترتيب الآراء"),
  sortAll: l("Tous", "All", "الكل"),
  sortRecent: l("Les plus récents", "Newest", "الأحدث"),
  sortTop: l("Les mieux notés", "Top rated", "الأعلى تقييماً"),
  pages: l("Pages des avis", "Review pages", "صفحات الآراء"),
  previous: l("Précédent", "Previous", "السابق"),
  next: l("Suivant", "Next", "التالي"),
  // {page} and {pages} are formatted numbers.
  pageLabel: l("Page {page}", "Page {page}", "الصفحة {page}"),
  pageStatus: l(
    "Page {page} sur {pages}",
    "Page {page} of {pages}",
    "الصفحة {page} من {pages}",
  ),
  // {from}, {to} and {total} are formatted numbers.
  showing: l(
    "Avis {from}–{to} sur {total}",
    "Reviews {from}–{to} of {total}",
    "عرض {from}–{to} من {total}",
  ),
  empty: l(
    "Le premier avis sera peut-être le vôtre.",
    "The first review could be yours.",
    "قد يكون أول رأي هو رأيك.",
  ),
  emptySub: l(
    "Partagez votre moment préféré avec nous.",
    "Share your favourite moment with us.",
    "شاركنا لحظتك المفضلة.",
  ),
  loading: l("Chargement des avis…", "Loading reviews…", "جارٍ تحميل الآراء…"),
  loadError: l(
    "Les avis sont indisponibles pour le moment.",
    "Reviews are temporarily unavailable.",
    "الآراء غير متاحة حالياً.",
  ),
  retry: l("Réessayer", "Try again", "حاول مجدداً"),
  formTitle: l(
    "Partagez votre expérience",
    "Share your experience",
    "شارك تجربتك",
  ),
  moderation: l(
    "Votre avis et votre photo seront visibles après validation par notre équipe.",
    "Your review and photo will appear after our team approves them.",
    "سيظهر رأيك وصورتك بعد موافقة فريقنا.",
  ),
  rating: l("Votre note", "Your rating", "تقييمك"),
  star: l("étoile", "star", "نجمة"),
  stars: l("étoiles", "stars", "نجوم"),
  fieldTitle: l("Titre", "Title", "العنوان"),
  fieldDescription: l(
    "Votre avis (facultatif)",
    "Your review (optional)",
    "رأيك (اختياري)",
  ),
  titlePlaceholder: l(
    "Ce que vous avez aimé…",
    "What did you enjoy?",
    "ما الذي أعجبك؟",
  ),
  descriptionPlaceholder: l(
    "Le plat, l’accueil, votre moment…",
    "The food, the welcome, your moment…",
    "الطعام، الاستقبال، لحظتك…",
  ),
  photo: l("Photo (facultatif)", "Photo (optional)", "صورة (اختياري)"),
  photoHelp: l(
    "JPG, PNG ou WebP · 5 Mo maximum",
    "JPG, PNG or WebP · up to 5 MB",
    "JPG أو PNG أو WebP · حتى 5 ميغابايت",
  ),
  removePhoto: l("Retirer la photo", "Remove photo", "إزالة الصورة"),
  submit: l("Envoyer mon avis", "Submit review", "إرسال رأيي"),
  sending: l("Envoi en cours…", "Submitting…", "جارٍ الإرسال…"),
  captchaLoading: l(
    "Chargement de la vérification…",
    "Loading verification…",
    "جارٍ تحميل التحقق…",
  ),
  captchaRequired: l(
    "Veuillez terminer la vérification anti-robot.",
    "Please complete the bot verification.",
    "يرجى إكمال التحقق من أنك لست روبوتاً.",
  ),
  captchaUnavailable: l(
    "La vérification est indisponible. Réessayez.",
    "Verification is unavailable. Please retry.",
    "التحقق غير متاح. يرجى المحاولة مجدداً.",
  ),
  dailyHelp: l(
    "Deux avis par jour maximum par connexion Internet. Remise à zéro à minuit, heure de Casablanca.",
    "Up to two reviews per day per internet connection. Resets at midnight, Casablanca time.",
    "رأيان كحد أقصى يومياً لكل اتصال إنترنت. يتجدد الحد عند منتصف الليل بتوقيت الدار البيضاء.",
  ),
  dailyLimit: l(
    "La limite de deux avis pour aujourd’hui est atteinte sur cette connexion. Réessayez demain. Si un envoi a été interrompu, attendez 10 minutes.",
    "This connection has reached today's two-review limit. Try again tomorrow. If a submission was interrupted, wait 10 minutes.",
    "وصل هذا الاتصال إلى حد رأيين لليوم. حاول غداً. إذا انقطع إرسال سابق، انتظر 10 دقائق.",
  ),
  submissionExpired: l(
    "Votre session d’envoi a expiré. Vérifiez à nouveau et réessayez.",
    "Your submission session expired. Verify again and retry.",
    "انتهت مهلة الإرسال. أكمل التحقق وحاول مجدداً.",
  ),
  success: l(
    "Merci ! Votre avis sera publié après validation.",
    "Thank you! Your review will appear after approval.",
    "شكراً! سيُنشر رأيك بعد الموافقة.",
  ),
  done: l("C’est noté !", "All done!", "تمّ!"),
  formError: l(
    "Choisissez une note et ajoutez un titre.",
    "Choose a rating and add a title.",
    "اختر تقييماً وأضف عنواناً.",
  ),
  photoError: l(
    "Choisissez une image JPG, PNG ou WebP de 5 Mo maximum.",
    "Choose a JPG, PNG or WebP image up to 5 MB.",
    "اختر صورة JPG أو PNG أو WebP بحجم لا يتجاوز 5 ميغابايت.",
  ),
  sendError: l(
    "Votre avis n’a pas pu être envoyé. Vos informations sont conservées, réessayez.",
    "We couldn’t submit your review. Your details are still here; please try again.",
    "تعذّر إرسال رأيك. احتفظنا ببياناتك، حاول مجدداً.",
  ),
  unavailable: l(
    "L’envoi des avis est momentanément indisponible.",
    "Review submissions are temporarily unavailable.",
    "إرسال الآراء غير متاح مؤقتاً.",
  ),
};
