export type Locale = "fr" | "en" | "ar";
export type Localized = Record<Locale, string>;
export const l = (fr: string, en: string, ar: string): Localized => ({
  fr,
  en,
  ar,
});
export const categories = [
  {
    id: "all",
    name: l("Tout le menu", "Full menu", "القائمة كاملة"),
    icon: "✦",
  },
  { id: "shawarma", name: l("Shawarmas", "Shawarmas", "شاورما"), icon: "◒" },
  {
    id: "super",
    name: l("Super shawarmas", "Super shawarmas", "سوبر شاورما"),
    icon: "♛",
  },
  { id: "mezze", name: l("Mezzés", "Mezze", "مقبلات"), icon: "◉" },
  { id: "plates", name: l("Plats", "Platters", "أطباق"), icon: "◌" },
  { id: "rolls", name: l("Rolls", "Rolls", "رولز"), icon: "▤" },
  {
    id: "family",
    name: l("Family Box", "Family Box", "بوكس العائلة"),
    icon: "▧",
  },
  { id: "extras", name: l("À côté", "Sides", "إضافات"), icon: "♧" },
  {
    id: "desserts",
    name: l("Douceurs & boissons", "Desserts & drinks", "حلويات ومشروبات"),
    icon: "♡",
  },
];
export type FoodImage =
  | "classic"
  | "cheddar"
  | "jalapeno"
  | "mexican"
  | "mezze"
  | "baba"
  | "moutabal"
  | "muhammara"
  | "spicy"
  | "houmousShawarma"
  | "beetroot"
  | "plate"
  | "rolls"
  | "family"
  | "fries"
  | "lemonade"
  | "drink"
  | "dessert"
  | "kunafa";
export type Item = {
  id: string;
  name: Localized;
  category: string;
  price: number;
  menuPrice?: number;
  image: FoodImage | (string & {});
  description: Localized;
  tag?: "signature" | "spicy" | "sharing";
  variants?: { name: Localized; price: number }[];
};
const shawarmaDesc = l(
  "Pain, poulet shawarma et toute la gourmandise Lma3louma.",
  "Bread, chicken shawarma and the full Lma3louma experience.",
  "خبز وشاورما الدجاج، بكل لذة المعلومة.",
);
const variants = (a: number, b: number, c: number, d: number) => [
  { name: l("Classique", "Classic", "كلاسيك"), price: a },
  { name: l("Cheddar", "Cheddar", "شيدر"), price: b },
  { name: l("Jalapeños", "Jalapeños", "هالابينو"), price: c },
  {
    name: l("Cheddar & Jalapeños", "Cheddar & Jalapeños", "شيدر وهالابينو"),
    price: d,
  },
];
export const items: Item[] = [
  {
    id: "classic",
    name: l("Lma3louma", "Lma3louma", "المعلومة"),
    category: "shawarma",
    price: 29,
    menuPrice: 46,
    image: "classic",
    description: shawarmaDesc,
    tag: "signature",
  },
  {
    id: "cheddar",
    name: l("Lma3louma Cheddar", "Lma3louma Cheddar", "المعلومة شيدر"),
    category: "shawarma",
    price: 34,
    menuPrice: 51,
    image: "cheddar",
    description: l(
      "La signature Lma3louma, avec une touche de cheddar.",
      "Our signature shawarma with a touch of cheddar.",
      "شاورما المعلومة مع إضافة جبن الشيدر.",
    ),
  },
  {
    id: "jalapeno",
    name: l("Lma3louma Jalapeños", "Lma3louma Jalapeños", "المعلومة هالابينو"),
    category: "shawarma",
    price: 34,
    menuPrice: 51,
    image: "jalapeno",
    description: l(
      "Une touche de jalapeños pour réveiller les papilles.",
      "A kick of jalapeños to wake up your taste buds.",
      "لمسة هالابينو لمحبي المذاق الحار.",
    ),
    tag: "spicy",
  },
  {
    id: "both",
    name: l("Cheddar & Jalapeños", "Cheddar & Jalapeños", "شيدر وهالابينو"),
    category: "shawarma",
    price: 39,
    menuPrice: 56,
    image: "cheddar",
    description: l(
      "Le fondant du cheddar rencontre le piquant des jalapeños.",
      "Melty cheddar meets the kick of jalapeños.",
      "جبن الشيدر يلتقي بنكهة الهالابينو الحارة.",
    ),
    tag: "spicy",
  },
  {
    id: "mexican",
    name: l("Lma3louma Mexicaine", "Lma3louma Mexican", "المعلومة مكسيكية"),
    category: "shawarma",
    price: 39,
    menuPrice: 56,
    image: "mexican",
    description: l(
      "La version mexicaine de votre shawarma Lma3louma.",
      "The Mexican edition of your Lma3louma shawarma.",
      "النسخة المكسيكية من شاورما المعلومة.",
    ),
  },
  {
    id: "super",
    name: l("Lma3louma Super", "Lma3louma Super", "المعلومة سوبر"),
    category: "super",
    price: 39,
    image: "classic",
    description: l(
      "Une grande envie ? Passez au format Super.",
      "A bigger appetite? Make it Super.",
      "جوعان بزاف؟ جرّب حجم سوبر.",
    ),
    variants: [
      { name: l("Classique", "Classic", "كلاسيك"), price: 39 },
      { name: l("Cheddar", "Cheddar", "شيدر"), price: 44 },
      {
        name: l("Cheddar & Jalapeños", "Cheddar & Jalapeños", "شيدر وهالابينو"),
        price: 44,
      },
      { name: l("Mexicaine", "Mexican", "مكسيكية"), price: 49 },
      { name: l("Royale", "Royale", "رويال"), price: 49 },
    ],
  },
  ...[
    ["houmous", "Houmous", "Hummus", "حمص", 20, "mezze"],
    ["baba", "Baba Ghanoush", "Baba Ghanoush", "بابا غنوج", 20, "baba"],
    ["moutabal", "Moutabal", "Moutabal", "متبل", 20, "moutabal"],
    ["muhammara", "Muhammara", "Muhammara", "محمرة", 20, "muhammara"],
    [
      "beetroot",
      "Houmous Betterave",
      "Beetroot Hummus",
      "حمص بالشمندر",
      20,
      "beetroot",
    ],
    ["spicy-houmous", "Spicy Houmous", "Spicy Hummus", "حمص حار", 20, "spicy"],
    [
      "houmous-shawarma",
      "Houmous Shawarma",
      "Shawarma Hummus",
      "حمص بالشاورما",
      30,
      "houmousShawarma",
    ],
    [
      "spicy-shawarma",
      "Spicy Houmous Shawarma",
      "Spicy Shawarma Hummus",
      "حمص بالشاورما حار",
      30,
      "houmousShawarma",
    ],
    ["trio", "Trio Mezzés", "Mezze Trio", "ثلاثي المقبلات", 40, "mezze"],
  ].map(([id, fr, en, ar, price, image]) => ({
    id: String(id),
    name: l(String(fr), String(en), String(ar)),
    category: "mezze",
    price: Number(price),
    image: image as FoodImage,
    description: l(
      "À savourer en entrée ou à partager autour de la table.",
      "Start your meal or share a little something at the table.",
      "مقبلات لذيذة لبدء الوجبة أو المشاركة.",
    ),
  })),
  {
    id: "plate",
    name: l("Plat Shawarma", "Shawarma Platter", "طبق شاورما"),
    category: "plates",
    price: 60,
    image: "plate",
    description: l(
      "Le plaisir shawarma en assiette, avec frites et accompagnements.",
      "Shawarma served with fries and sides.",
      "شاورما مع بطاطس مقلية ومقبلات.",
    ),
    variants: variants(60, 65, 65, 70),
  },
  {
    id: "rolls",
    name: l("Shawarma Rolls", "Shawarma Rolls", "شاورما رولز"),
    category: "rolls",
    price: 69,
    image: "rolls",
    description: l(
      "Des bouchées de shawarma, des frites et une boisson.",
      "Shawarma bites, fries and a drink.",
      "لقيمات شاورما مع بطاطس ومشروب.",
    ),
    variants: variants(69, 74, 74, 79),
  },
  {
    id: "family",
    name: l("Family Box", "Family Box", "بوكس العائلة"),
    category: "family",
    price: 239,
    image: "family",
    description: l(
      "Des rolls, des frites, des sauces et une grande boisson à partager.",
      "Rolls, fries, dips and a large drink to share.",
      "رولز وبطاطس وصلصات ومشروب كبير للمشاركة.",
    ),
    tag: "sharing",
    variants: variants(239, 259, 259, 289),
  },
  {
    id: "fries",
    name: l("Frites", "Fries", "بطاطس مقلية"),
    category: "extras",
    price: 10,
    image: "fries",
    description: l(
      "Le petit plus de votre pause gourmande.",
      "A little extra for your meal.",
      "إضافة لذيذة لوجبتك.",
    ),
    variants: [
      { name: l("Classiques", "Classic", "كلاسيك"), price: 10 },
      { name: l("Cheddar", "Cheddar", "شيدر"), price: 23 },
      {
        name: l("Cheddar & Jalapeños", "Cheddar & Jalapeños", "شيدر وهالابينو"),
        price: 28,
      },
    ],
  },
  {
    id: "combo",
    name: l("Frites & boisson", "Fries & drink", "بطاطس ومشروب"),
    category: "extras",
    price: 17,
    image: "fries",
    description: l(
      "Complétez votre shawarma avec une formule.",
      "Complete your shawarma with a meal deal.",
      "كمّل الشاورما بوجبة متكاملة.",
    ),
    variants: [
      { name: l("Boisson", "Soft drink", "مشروب"), price: 17 },
      { name: l("Citronnade", "Lemonade", "ليموناضة"), price: 22 },
    ],
  },
  {
    id: "drink",
    name: l("Boisson", "Soft drink", "مشروب"),
    category: "desserts",
    price: 10,
    image: "drink",
    description: l(
      "Choix des boissons disponibles sur Glovo ou en restaurant.",
      "Check available drinks on Glovo or in the restaurant.",
      "شوف المشروبات المتوفرة على غلوفو أو فالمطعم.",
    ),
  },
  {
    id: "lemonade",
    name: l("Citronnade", "Lemonade", "ليموناضة"),
    category: "desserts",
    price: 13,
    image: "lemonade",
    description: l(
      "La pause citronnée qui accompagne toutes vos envies.",
      "A refreshing citrus break to go with your meal.",
      "انتعاش الليمون مع وجبتك المفضلة.",
    ),
  },
  {
    id: "mahalabia",
    name: l("Mahalabia", "Mahalabia", "مهلبية"),
    category: "desserts",
    price: 15,
    image: "dessert",
    description: l(
      "Une touche de douceur pour finir en beauté.",
      "A sweet finish to a delicious meal.",
      "لمسة حلاوة لنهاية الوجبة.",
    ),
  },
  {
    id: "kunafa",
    name: l(
      "Mahalabia Kunafa Pistache",
      "Pistachio Kunafa Mahalabia",
      "مهلبية كنافة بالفستق",
    ),
    category: "desserts",
    price: 23,
    image: "kunafa",
    description: l(
      "Mahalabia, kunafa et pistache : le trio gourmand.",
      "Mahalabia, kunafa and pistachio: a delicious trio.",
      "مهلبية وكنافة وفستق: ثلاثي لذيذ.",
    ),
  },
];
export const locations = [
  {
    id: "maarif",
    name: l("Maârif", "Maârif", "المعاريف"),
    area: l(
      "Au cœur de Casablanca",
      "In the heart of Casablanca",
      "في قلب الدار البيضاء",
    ),
    address: l(
      "Quartier Maârif, Casablanca",
      "Maârif district, Casablanca",
      "حي المعاريف، الدار البيضاء",
    ),
    image: "/assets/maarif.png",
    map: "https://www.google.com/maps/place/Shawarma+Lma3louma+-+Ma%C3%A2rif/@33.5837923,-7.6390882,17z/data=!3m1!4b1!4m6!3m5!1s0xda7d382b44fcc7b:0xb7a378071b9d03f6!8m2!3d33.5837923!4d-7.6390882!16s%2Fg%2F11wc27szhm",
  },
  {
    id: "californie",
    name: l("Jnane Californie", "Jnane Californie", "جنان كاليفورنيا"),
    area: l(
      "Votre pause côté Californie",
      "Your Californie food stop",
      "استراحتك في كاليفورنيا",
    ),
    address: l(
      "Jnane Californie, Boulevard Haïfa, Casablanca",
      "Jnane Californie, Boulevard Haifa, Casablanca",
      "جنان كاليفورنيا، شارع حيفا، الدار البيضاء",
    ),
    image: "/assets/californie.png",
    map: "https://www.google.com/maps?q=Shawarma+Lma3louma+-+Jnane+Californie,+Jnane+Californie,+Bd+Haifa,+Casablanca&ftid=0xda633e7f846aded:0xf98da2a273f17b5f",
  },
];
export const glovoUrl = (locale: Locale) =>
  `https://glovoapp.com/${locale}/ma/casablanca/stores/shawarma-lma3louma-cas`;
