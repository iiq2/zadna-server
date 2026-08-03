/* ============================================================
   مكتبة اقتراحات زادنا مارت — ٤٣٩ صنفاً معروفاً في السوق الفلسطيني.

   **لا أسعار هنا، ولا سعر واحد.** وهذا مقصود.

   كانت الأسعار مكتوبة في هذه الشيفرة تُشحن مع كل نشر. ومعناها أن
   السعر الذي يراه الزبون كتبَه مبرمج قبل شهور، لا صاحب المحلّ اليوم.
   فترتفع الأسعار في السوق ويبقى الرقم على الشاشة، فيطلب الزبون بخمسة
   ويجد المندوب سبعة — ولا أحد يعرف من يدفع الفرق.

   الآن: هذه أسماء ووحدات بيع مقترحة فقط. صاحب السوبرماركت يختار ما
   يحمله، ويُسمّيه كما يشاء، ويضع سعره هو لكل وحدة. كل رقم يراه الزبون
   كتبه صاحب المحلّ بيده — فلا سعر بائت، ولا عهدة على أحد.

   وليست قيداً: من أراد صنفاً خارج القائمة أضافه من عنده.
   ============================================================ */

const MART_CATEGORIES = [
 {
  "id": "dairy",
  "nameAr": "ألبان وأجبان",
  "emoji": "🥛"
 },
 {
  "id": "bakery",
  "nameAr": "مخبوزات ومعجنات",
  "emoji": "🥐"
 },
 {
  "id": "produce",
  "nameAr": "خضار وفواكه",
  "emoji": "🍅"
 },
 {
  "id": "meat",
  "nameAr": "لحوم ودواجن",
  "emoji": "🍗"
 },
 {
  "id": "frozen",
  "nameAr": "مجمدات",
  "emoji": "🧊"
 },
 {
  "id": "pantry",
  "nameAr": "مؤن وبقالة",
  "emoji": "🌾"
 },
 {
  "id": "canned",
  "nameAr": "معلبات ومربيات",
  "emoji": "🥫"
 },
 {
  "id": "snacks",
  "nameAr": "سناكات وشيبس",
  "emoji": "🍿"
 },
 {
  "id": "sweets",
  "nameAr": "حلويات وشوكولاتة",
  "emoji": "🍫"
 },
 {
  "id": "drinks",
  "nameAr": "مشروبات وعصائر",
  "emoji": "🥤"
 },
 {
  "id": "hotdrinks",
  "nameAr": "قهوة وشاي",
  "emoji": "☕"
 },
 {
  "id": "nuts",
  "nameAr": "مكسرات وياميش",
  "emoji": "🥜"
 },
 {
  "id": "spices",
  "nameAr": "بهارات وأعشاب",
  "emoji": "🧂"
 },
 {
  "id": "cleaning",
  "nameAr": "منظفات",
  "emoji": "🧽"
 },
 {
  "id": "care",
  "nameAr": "عناية شخصية",
  "emoji": "🧴"
 },
 {
  "id": "baby",
  "nameAr": "منتجات أطفال",
  "emoji": "🍼"
 },
 {
  "id": "household",
  "nameAr": "مستلزمات منزل",
  "emoji": "🏠"
 }
];

const MART_SUGGESTIONS = [
 {
  "id": "dairy_1",
  "categoryId": "dairy",
  "nameAr": "حليب الجنيدي كامل الدسم",
  "brand": "الجنيدي",
  "emoji": "🥛",
  "units": [
   "½ لتر",
   "1 لتر",
   "2 لتر"
  ]
 },
 {
  "id": "dairy_2",
  "categoryId": "dairy",
  "nameAr": "حليب الجنيدي قليل الدسم",
  "brand": "الجنيدي",
  "emoji": "🥛",
  "units": [
   "½ لتر",
   "1 لتر",
   "2 لتر"
  ]
 },
 {
  "id": "dairy_3",
  "categoryId": "dairy",
  "nameAr": "حليب الجنيدي خالي الدسم",
  "brand": "الجنيدي",
  "emoji": "🥛",
  "units": [
   "½ لتر",
   "1 لتر",
   "2 لتر"
  ]
 },
 {
  "id": "dairy_4",
  "categoryId": "dairy",
  "nameAr": "حليب الريان كامل الدسم",
  "brand": "الريان",
  "emoji": "🥛",
  "units": [
   "½ لتر",
   "1 لتر",
   "2 لتر"
  ]
 },
 {
  "id": "dairy_5",
  "categoryId": "dairy",
  "nameAr": "حليب الريان قليل الدسم",
  "brand": "الريان",
  "emoji": "🥛",
  "units": [
   "½ لتر",
   "1 لتر",
   "2 لتر"
  ]
 },
 {
  "id": "dairy_6",
  "categoryId": "dairy",
  "nameAr": "حليب الريان خالي الدسم",
  "brand": "الريان",
  "emoji": "🥛",
  "units": [
   "½ لتر",
   "1 لتر",
   "2 لتر"
  ]
 },
 {
  "id": "dairy_7",
  "categoryId": "dairy",
  "nameAr": "حليب طنوس كامل الدسم",
  "brand": "طنوس",
  "emoji": "🥛",
  "units": [
   "½ لتر",
   "1 لتر",
   "2 لتر"
  ]
 },
 {
  "id": "dairy_8",
  "categoryId": "dairy",
  "nameAr": "حليب طنوس قليل الدسم",
  "brand": "طنوس",
  "emoji": "🥛",
  "units": [
   "½ لتر",
   "1 لتر",
   "2 لتر"
  ]
 },
 {
  "id": "dairy_9",
  "categoryId": "dairy",
  "nameAr": "حليب طنوس خالي الدسم",
  "brand": "طنوس",
  "emoji": "🥛",
  "units": [
   "½ لتر",
   "1 لتر",
   "2 لتر"
  ]
 },
 {
  "id": "dairy_10",
  "categoryId": "dairy",
  "nameAr": "حليب تنوفا كامل الدسم",
  "brand": "تنوفا",
  "emoji": "🥛",
  "units": [
   "½ لتر",
   "1 لتر",
   "2 لتر"
  ]
 },
 {
  "id": "dairy_11",
  "categoryId": "dairy",
  "nameAr": "حليب تنوفا قليل الدسم",
  "brand": "تنوفا",
  "emoji": "🥛",
  "units": [
   "½ لتر",
   "1 لتر",
   "2 لتر"
  ]
 },
 {
  "id": "dairy_12",
  "categoryId": "dairy",
  "nameAr": "حليب تنوفا خالي الدسم",
  "brand": "تنوفا",
  "emoji": "🥛",
  "units": [
   "½ لتر",
   "1 لتر",
   "2 لتر"
  ]
 },
 {
  "id": "dairy_13",
  "categoryId": "dairy",
  "nameAr": "حليب المراعي كامل الدسم",
  "brand": "المراعي",
  "emoji": "🥛",
  "units": [
   "½ لتر",
   "1 لتر",
   "2 لتر"
  ]
 },
 {
  "id": "dairy_14",
  "categoryId": "dairy",
  "nameAr": "حليب المراعي قليل الدسم",
  "brand": "المراعي",
  "emoji": "🥛",
  "units": [
   "½ لتر",
   "1 لتر",
   "2 لتر"
  ]
 },
 {
  "id": "dairy_15",
  "categoryId": "dairy",
  "nameAr": "حليب المراعي خالي الدسم",
  "brand": "المراعي",
  "emoji": "🥛",
  "units": [
   "½ لتر",
   "1 لتر",
   "2 لتر"
  ]
 },
 {
  "id": "dairy_16",
  "categoryId": "dairy",
  "nameAr": "لبن رائب الجنيدي",
  "brand": "الجنيدي",
  "emoji": "🥣",
  "units": [
   "½ كغم",
   "1 كغم"
  ]
 },
 {
  "id": "dairy_17",
  "categoryId": "dairy",
  "nameAr": "لبنة الجنيدي",
  "brand": "الجنيدي",
  "emoji": "🥣",
  "units": [
   "250 غرام",
   "500 غرام"
  ]
 },
 {
  "id": "dairy_18",
  "categoryId": "dairy",
  "nameAr": "لبنة بلدي الجنيدي",
  "brand": "الجنيدي",
  "emoji": "🥣",
  "units": [
   "1 كغم"
  ]
 },
 {
  "id": "dairy_19",
  "categoryId": "dairy",
  "nameAr": "قشطة الجنيدي",
  "brand": "الجنيدي",
  "emoji": "🥣",
  "units": [
   "250 غرام"
  ]
 },
 {
  "id": "dairy_20",
  "categoryId": "dairy",
  "nameAr": "جبنة بيضاء الجنيدي",
  "brand": "الجنيدي",
  "emoji": "🧀",
  "units": [
   "500 غرام"
  ]
 },
 {
  "id": "dairy_21",
  "categoryId": "dairy",
  "nameAr": "جبنة نابلسية الجنيدي",
  "brand": "الجنيدي",
  "emoji": "🧀",
  "units": [
   "1 كغم"
  ]
 },
 {
  "id": "dairy_22",
  "categoryId": "dairy",
  "nameAr": "جبنة عكاوي الجنيدي",
  "brand": "الجنيدي",
  "emoji": "🧀",
  "units": [
   "500 غرام"
  ]
 },
 {
  "id": "dairy_23",
  "categoryId": "dairy",
  "nameAr": "شنينة الجنيدي",
  "brand": "الجنيدي",
  "emoji": "🥛",
  "units": [
   "1 لتر"
  ]
 },
 {
  "id": "dairy_24",
  "categoryId": "dairy",
  "nameAr": "أيران الجنيدي",
  "brand": "الجنيدي",
  "emoji": "🥛",
  "units": [
   "250 مل"
  ]
 },
 {
  "id": "dairy_25",
  "categoryId": "dairy",
  "nameAr": "لبن رائب حمودة",
  "brand": "حمودة",
  "emoji": "🥣",
  "units": [
   "½ كغم",
   "1 كغم"
  ]
 },
 {
  "id": "dairy_26",
  "categoryId": "dairy",
  "nameAr": "لبنة حمودة",
  "brand": "حمودة",
  "emoji": "🥣",
  "units": [
   "250 غرام",
   "500 غرام"
  ]
 },
 {
  "id": "dairy_27",
  "categoryId": "dairy",
  "nameAr": "لبنة بلدي حمودة",
  "brand": "حمودة",
  "emoji": "🥣",
  "units": [
   "1 كغم"
  ]
 },
 {
  "id": "dairy_28",
  "categoryId": "dairy",
  "nameAr": "قشطة حمودة",
  "brand": "حمودة",
  "emoji": "🥣",
  "units": [
   "250 غرام"
  ]
 },
 {
  "id": "dairy_29",
  "categoryId": "dairy",
  "nameAr": "جبنة بيضاء حمودة",
  "brand": "حمودة",
  "emoji": "🧀",
  "units": [
   "500 غرام"
  ]
 },
 {
  "id": "dairy_30",
  "categoryId": "dairy",
  "nameAr": "جبنة نابلسية حمودة",
  "brand": "حمودة",
  "emoji": "🧀",
  "units": [
   "1 كغم"
  ]
 },
 {
  "id": "dairy_31",
  "categoryId": "dairy",
  "nameAr": "جبنة عكاوي حمودة",
  "brand": "حمودة",
  "emoji": "🧀",
  "units": [
   "500 غرام"
  ]
 },
 {
  "id": "dairy_32",
  "categoryId": "dairy",
  "nameAr": "شنينة حمودة",
  "brand": "حمودة",
  "emoji": "🥛",
  "units": [
   "1 لتر"
  ]
 },
 {
  "id": "dairy_33",
  "categoryId": "dairy",
  "nameAr": "أيران حمودة",
  "brand": "حمودة",
  "emoji": "🥛",
  "units": [
   "250 مل"
  ]
 },
 {
  "id": "dairy_34",
  "categoryId": "dairy",
  "nameAr": "لبن رائب الريان",
  "brand": "الريان",
  "emoji": "🥣",
  "units": [
   "½ كغم",
   "1 كغم"
  ]
 },
 {
  "id": "dairy_35",
  "categoryId": "dairy",
  "nameAr": "لبنة الريان",
  "brand": "الريان",
  "emoji": "🥣",
  "units": [
   "250 غرام",
   "500 غرام"
  ]
 },
 {
  "id": "dairy_36",
  "categoryId": "dairy",
  "nameAr": "لبنة بلدي الريان",
  "brand": "الريان",
  "emoji": "🥣",
  "units": [
   "1 كغم"
  ]
 },
 {
  "id": "dairy_37",
  "categoryId": "dairy",
  "nameAr": "قشطة الريان",
  "brand": "الريان",
  "emoji": "🥣",
  "units": [
   "250 غرام"
  ]
 },
 {
  "id": "dairy_38",
  "categoryId": "dairy",
  "nameAr": "جبنة بيضاء الريان",
  "brand": "الريان",
  "emoji": "🧀",
  "units": [
   "500 غرام"
  ]
 },
 {
  "id": "dairy_39",
  "categoryId": "dairy",
  "nameAr": "جبنة نابلسية الريان",
  "brand": "الريان",
  "emoji": "🧀",
  "units": [
   "1 كغم"
  ]
 },
 {
  "id": "dairy_40",
  "categoryId": "dairy",
  "nameAr": "جبنة عكاوي الريان",
  "brand": "الريان",
  "emoji": "🧀",
  "units": [
   "500 غرام"
  ]
 },
 {
  "id": "dairy_41",
  "categoryId": "dairy",
  "nameAr": "شنينة الريان",
  "brand": "الريان",
  "emoji": "🥛",
  "units": [
   "1 لتر"
  ]
 },
 {
  "id": "dairy_42",
  "categoryId": "dairy",
  "nameAr": "أيران الريان",
  "brand": "الريان",
  "emoji": "🥛",
  "units": [
   "250 مل"
  ]
 },
 {
  "id": "dairy_43",
  "categoryId": "dairy",
  "nameAr": "لبن رائب طنوس",
  "brand": "طنوس",
  "emoji": "🥣",
  "units": [
   "½ كغم",
   "1 كغم"
  ]
 },
 {
  "id": "dairy_44",
  "categoryId": "dairy",
  "nameAr": "لبنة طنوس",
  "brand": "طنوس",
  "emoji": "🥣",
  "units": [
   "250 غرام",
   "500 غرام"
  ]
 },
 {
  "id": "dairy_45",
  "categoryId": "dairy",
  "nameAr": "لبنة بلدي طنوس",
  "brand": "طنوس",
  "emoji": "🥣",
  "units": [
   "1 كغم"
  ]
 },
 {
  "id": "dairy_46",
  "categoryId": "dairy",
  "nameAr": "قشطة طنوس",
  "brand": "طنوس",
  "emoji": "🥣",
  "units": [
   "250 غرام"
  ]
 },
 {
  "id": "dairy_47",
  "categoryId": "dairy",
  "nameAr": "جبنة بيضاء طنوس",
  "brand": "طنوس",
  "emoji": "🧀",
  "units": [
   "500 غرام"
  ]
 },
 {
  "id": "dairy_48",
  "categoryId": "dairy",
  "nameAr": "جبنة نابلسية طنوس",
  "brand": "طنوس",
  "emoji": "🧀",
  "units": [
   "1 كغم"
  ]
 },
 {
  "id": "dairy_49",
  "categoryId": "dairy",
  "nameAr": "جبنة عكاوي طنوس",
  "brand": "طنوس",
  "emoji": "🧀",
  "units": [
   "500 غرام"
  ]
 },
 {
  "id": "dairy_50",
  "categoryId": "dairy",
  "nameAr": "شنينة طنوس",
  "brand": "طنوس",
  "emoji": "🥛",
  "units": [
   "1 لتر"
  ]
 },
 {
  "id": "dairy_51",
  "categoryId": "dairy",
  "nameAr": "أيران طنوس",
  "brand": "طنوس",
  "emoji": "🥛",
  "units": [
   "250 مل"
  ]
 },
 {
  "id": "dairy_52",
  "categoryId": "dairy",
  "nameAr": "جبنة كشكوان طوبا",
  "brand": "",
  "emoji": "🧀",
  "units": [
   "500 غرام"
  ]
 },
 {
  "id": "dairy_53",
  "categoryId": "dairy",
  "nameAr": "جبنة حلوم",
  "brand": "",
  "emoji": "🧀",
  "units": [
   "250 غرام"
  ]
 },
 {
  "id": "dairy_54",
  "categoryId": "dairy",
  "nameAr": "جبنة موزاريلا مبشورة",
  "brand": "",
  "emoji": "🧀",
  "units": [
   "400 غرام"
  ]
 },
 {
  "id": "dairy_55",
  "categoryId": "dairy",
  "nameAr": "جبنة شيدر شرائح",
  "brand": "",
  "emoji": "🧀",
  "units": [
   "200 غرام"
  ]
 },
 {
  "id": "dairy_56",
  "categoryId": "dairy",
  "nameAr": "جبنة كريمة",
  "brand": "",
  "emoji": "🧀",
  "units": [
   "200 غرام"
  ]
 },
 {
  "id": "dairy_57",
  "categoryId": "dairy",
  "nameAr": "جبنة مثلثات",
  "brand": "",
  "emoji": "🧀",
  "units": [
   "8 قطع",
   "24 قطعة"
  ]
 },
 {
  "id": "dairy_58",
  "categoryId": "dairy",
  "nameAr": "جبنة كاسات كرافت",
  "brand": "",
  "emoji": "🧀",
  "units": [
   "480 غرام"
  ]
 },
 {
  "id": "dairy_59",
  "categoryId": "dairy",
  "nameAr": "زبدة",
  "brand": "",
  "emoji": "🧈",
  "units": [
   "200 غرام",
   "500 غرام"
  ]
 },
 {
  "id": "dairy_60",
  "categoryId": "dairy",
  "nameAr": "سمنة بلدية",
  "brand": "",
  "emoji": "🧈",
  "units": [
   "1 كغم"
  ]
 },
 {
  "id": "dairy_61",
  "categoryId": "dairy",
  "nameAr": "كريمة طبخ",
  "brand": "",
  "emoji": "🥛",
  "units": [
   "500 مل"
  ]
 },
 {
  "id": "dairy_62",
  "categoryId": "dairy",
  "nameAr": "كريمة خفق",
  "brand": "",
  "emoji": "🥛",
  "units": [
   "250 مل"
  ]
 },
 {
  "id": "dairy_63",
  "categoryId": "dairy",
  "nameAr": "بيض بلدي",
  "brand": "",
  "emoji": "🥚",
  "units": [
   "30 حبة"
  ]
 },
 {
  "id": "dairy_64",
  "categoryId": "dairy",
  "nameAr": "بيض",
  "brand": "",
  "emoji": "🥚",
  "units": [
   "6 حبات",
   "12 حبة"
  ]
 },
 {
  "id": "dairy_65",
  "categoryId": "dairy",
  "nameAr": "زبادي بالفواكه",
  "brand": "",
  "emoji": "🥣",
  "units": [
   "4 عبوات"
  ]
 },
 {
  "id": "dairy_66",
  "categoryId": "dairy",
  "nameAr": "زبادي يوناني",
  "brand": "",
  "emoji": "🥣",
  "units": [
   "500 غرام"
  ]
 },
 {
  "id": "dairy_67",
  "categoryId": "dairy",
  "nameAr": "لبنة مخلوطة بالزيت",
  "brand": "",
  "emoji": "🥣",
  "units": [
   "800 غرام"
  ]
 },
 {
  "id": "dairy_68",
  "categoryId": "dairy",
  "nameAr": "جبنة نابلسية مقلية",
  "brand": "",
  "emoji": "🧀",
  "units": [
   "500 غرام"
  ]
 },
 {
  "id": "bakery_1",
  "categoryId": "bakery",
  "nameAr": "خبز عربي كبير",
  "brand": "",
  "emoji": "🫓",
  "units": [
   "6 أرغفة"
  ]
 },
 {
  "id": "bakery_2",
  "categoryId": "bakery",
  "nameAr": "خبز عربي صغير",
  "brand": "",
  "emoji": "🫓",
  "units": [
   "10 أرغفة"
  ]
 },
 {
  "id": "bakery_3",
  "categoryId": "bakery",
  "nameAr": "خبز صاج",
  "brand": "",
  "emoji": "🫓",
  "units": [
   "5 أرغفة"
  ]
 },
 {
  "id": "bakery_4",
  "categoryId": "bakery",
  "nameAr": "خبز طابون",
  "brand": "",
  "emoji": "🫓",
  "units": [
   "4 أرغفة"
  ]
 },
 {
  "id": "bakery_5",
  "categoryId": "bakery",
  "nameAr": "خبز توست أبيض",
  "brand": "",
  "emoji": "🍞",
  "units": [
   "700 غرام"
  ]
 },
 {
  "id": "bakery_6",
  "categoryId": "bakery",
  "nameAr": "خبز توست أسمر",
  "brand": "",
  "emoji": "🍞",
  "units": [
   "700 غرام"
  ]
 },
 {
  "id": "bakery_7",
  "categoryId": "bakery",
  "nameAr": "خبز برجر",
  "brand": "",
  "emoji": "🍔",
  "units": [
   "6 حبات"
  ]
 },
 {
  "id": "bakery_8",
  "categoryId": "bakery",
  "nameAr": "خبز هوت دوغ",
  "brand": "",
  "emoji": "🌭",
  "units": [
   "6 حبات"
  ]
 },
 {
  "id": "bakery_9",
  "categoryId": "bakery",
  "nameAr": "كعك بسمسم",
  "brand": "",
  "emoji": "🥯",
  "units": [
   "5 حبات"
  ]
 },
 {
  "id": "bakery_10",
  "categoryId": "bakery",
  "nameAr": "كرواسون سادة",
  "brand": "",
  "emoji": "🥐",
  "units": [
   "4 حبات"
  ]
 },
 {
  "id": "bakery_11",
  "categoryId": "bakery",
  "nameAr": "كرواسون شوكولاتة",
  "brand": "",
  "emoji": "🥐",
  "units": [
   "4 حبات"
  ]
 },
 {
  "id": "bakery_12",
  "categoryId": "bakery",
  "nameAr": "كرواسون جبنة",
  "brand": "",
  "emoji": "🥐",
  "units": [
   "4 حبات"
  ]
 },
 {
  "id": "bakery_13",
  "categoryId": "bakery",
  "nameAr": "فطائر زعتر",
  "brand": "",
  "emoji": "🥧",
  "units": [
   "6 حبات"
  ]
 },
 {
  "id": "bakery_14",
  "categoryId": "bakery",
  "nameAr": "فطائر جبنة",
  "brand": "",
  "emoji": "🥧",
  "units": [
   "6 حبات"
  ]
 },
 {
  "id": "bakery_15",
  "categoryId": "bakery",
  "nameAr": "فطائر سبانخ",
  "brand": "",
  "emoji": "🥧",
  "units": [
   "6 حبات"
  ]
 },
 {
  "id": "bakery_16",
  "categoryId": "bakery",
  "nameAr": "صفيحة لحمة",
  "brand": "",
  "emoji": "🥧",
  "units": [
   "6 حبات"
  ]
 },
 {
  "id": "bakery_17",
  "categoryId": "bakery",
  "nameAr": "مناقيش زعتر",
  "brand": "",
  "emoji": "🥧",
  "units": [
   "1 حبة"
  ]
 },
 {
  "id": "bakery_18",
  "categoryId": "bakery",
  "nameAr": "بيتزا صغيرة",
  "brand": "",
  "emoji": "🍕",
  "units": [
   "1 حبة"
  ]
 },
 {
  "id": "bakery_19",
  "categoryId": "bakery",
  "nameAr": "كيك اسفنجي",
  "brand": "",
  "emoji": "🍰",
  "units": [
   "500 غرام"
  ]
 },
 {
  "id": "bakery_20",
  "categoryId": "bakery",
  "nameAr": "كيك بالشوكولاتة",
  "brand": "",
  "emoji": "🍰",
  "units": [
   "500 غرام"
  ]
 },
 {
  "id": "bakery_21",
  "categoryId": "bakery",
  "nameAr": "دونات محشي",
  "brand": "",
  "emoji": "🍩",
  "units": [
   "6 حبات"
  ]
 },
 {
  "id": "bakery_22",
  "categoryId": "bakery",
  "nameAr": "بقسماط",
  "brand": "",
  "emoji": "🍞",
  "units": [
   "400 غرام"
  ]
 },
 {
  "id": "bakery_23",
  "categoryId": "bakery",
  "nameAr": "خبز بيتا أسمر",
  "brand": "",
  "emoji": "🫓",
  "units": [
   "6 أرغفة"
  ]
 },
 {
  "id": "bakery_24",
  "categoryId": "bakery",
  "nameAr": "معمول بالتمر",
  "brand": "",
  "emoji": "🍪",
  "units": [
   "500 غرام"
  ]
 },
 {
  "id": "bakery_25",
  "categoryId": "bakery",
  "nameAr": "معمول بالجوز",
  "brand": "",
  "emoji": "🍪",
  "units": [
   "500 غرام"
  ]
 },
 {
  "id": "bakery_26",
  "categoryId": "bakery",
  "nameAr": "بقلاوة بالجوز",
  "brand": "",
  "emoji": "🍯",
  "units": [
   "½ كغم"
  ]
 },
 {
  "id": "bakery_27",
  "categoryId": "bakery",
  "nameAr": "بقلاوة بالفستق",
  "brand": "",
  "emoji": "🍯",
  "units": [
   "½ كغم"
  ]
 },
 {
  "id": "bakery_28",
  "categoryId": "bakery",
  "nameAr": "كنافة نابلسية ناعمة",
  "brand": "",
  "emoji": "🍮",
  "units": [
   "1 كغم"
  ]
 },
 {
  "id": "bakery_29",
  "categoryId": "bakery",
  "nameAr": "كنافة خشنة",
  "brand": "",
  "emoji": "🍮",
  "units": [
   "1 كغم"
  ]
 },
 {
  "id": "bakery_30",
  "categoryId": "bakery",
  "nameAr": "بسبوسة",
  "brand": "",
  "emoji": "🍰",
  "units": [
   "500 غرام"
  ]
 },
 {
  "id": "produce_1",
  "categoryId": "produce",
  "nameAr": "بندورة",
  "brand": "",
  "emoji": "🍅",
  "units": [
   "½ كغم",
   "1 كغم"
  ]
 },
 {
  "id": "produce_2",
  "categoryId": "produce",
  "nameAr": "خيار",
  "brand": "",
  "emoji": "🥒",
  "units": [
   "½ كغم",
   "1 كغم"
  ]
 },
 {
  "id": "produce_3",
  "categoryId": "produce",
  "nameAr": "بطاطا",
  "brand": "",
  "emoji": "🥔",
  "units": [
   "½ كغم",
   "1 كغم"
  ]
 },
 {
  "id": "produce_4",
  "categoryId": "produce",
  "nameAr": "بصل",
  "brand": "",
  "emoji": "🧅",
  "units": [
   "½ كغم",
   "1 كغم"
  ]
 },
 {
  "id": "produce_5",
  "categoryId": "produce",
  "nameAr": "بصل أخضر",
  "brand": "",
  "emoji": "🧅",
  "units": [
   "½ كغم",
   "1 كغم"
  ]
 },
 {
  "id": "produce_6",
  "categoryId": "produce",
  "nameAr": "ثوم",
  "brand": "",
  "emoji": "🧄",
  "units": [
   "½ كغم",
   "1 كغم"
  ]
 },
 {
  "id": "produce_7",
  "categoryId": "produce",
  "nameAr": "جزر",
  "brand": "",
  "emoji": "🥕",
  "units": [
   "½ كغم",
   "1 كغم"
  ]
 },
 {
  "id": "produce_8",
  "categoryId": "produce",
  "nameAr": "كوسا",
  "brand": "",
  "emoji": "🥒",
  "units": [
   "½ كغم",
   "1 كغم"
  ]
 },
 {
  "id": "produce_9",
  "categoryId": "produce",
  "nameAr": "باذنجان",
  "brand": "",
  "emoji": "🍆",
  "units": [
   "½ كغم",
   "1 كغم"
  ]
 },
 {
  "id": "produce_10",
  "categoryId": "produce",
  "nameAr": "فلفل أخضر",
  "brand": "",
  "emoji": "🫑",
  "units": [
   "½ كغم",
   "1 كغم"
  ]
 },
 {
  "id": "produce_11",
  "categoryId": "produce",
  "nameAr": "فلفل ملون",
  "brand": "",
  "emoji": "🫑",
  "units": [
   "½ كغم",
   "1 كغم"
  ]
 },
 {
  "id": "produce_12",
  "categoryId": "produce",
  "nameAr": "فلفل حار",
  "brand": "",
  "emoji": "🌶️",
  "units": [
   "½ كغم",
   "1 كغم"
  ]
 },
 {
  "id": "produce_13",
  "categoryId": "produce",
  "nameAr": "ملفوف",
  "brand": "",
  "emoji": "🥬",
  "units": [
   "½ كغم",
   "1 كغم"
  ]
 },
 {
  "id": "produce_14",
  "categoryId": "produce",
  "nameAr": "زهرة",
  "brand": "",
  "emoji": "🥦",
  "units": [
   "½ كغم",
   "1 كغم"
  ]
 },
 {
  "id": "produce_15",
  "categoryId": "produce",
  "nameAr": "بروكلي",
  "brand": "",
  "emoji": "🥦",
  "units": [
   "½ كغم",
   "1 كغم"
  ]
 },
 {
  "id": "produce_16",
  "categoryId": "produce",
  "nameAr": "خس",
  "brand": "",
  "emoji": "🥬",
  "units": [
   "½ كغم",
   "1 كغم"
  ]
 },
 {
  "id": "produce_17",
  "categoryId": "produce",
  "nameAr": "سبانخ",
  "brand": "",
  "emoji": "🥬",
  "units": [
   "½ كغم",
   "1 كغم"
  ]
 },
 {
  "id": "produce_18",
  "categoryId": "produce",
  "nameAr": "ملوخية",
  "brand": "",
  "emoji": "🥬",
  "units": [
   "½ كغم",
   "1 كغم"
  ]
 },
 {
  "id": "produce_19",
  "categoryId": "produce",
  "nameAr": "بقدونس",
  "brand": "",
  "emoji": "🌿",
  "units": [
   "½ كغم",
   "1 كغم"
  ]
 },
 {
  "id": "produce_20",
  "categoryId": "produce",
  "nameAr": "نعناع",
  "brand": "",
  "emoji": "🌿",
  "units": [
   "½ كغم",
   "1 كغم"
  ]
 },
 {
  "id": "produce_21",
  "categoryId": "produce",
  "nameAr": "كزبرة",
  "brand": "",
  "emoji": "🌿",
  "units": [
   "½ كغم",
   "1 كغم"
  ]
 },
 {
  "id": "produce_22",
  "categoryId": "produce",
  "nameAr": "جرجير",
  "brand": "",
  "emoji": "🌿",
  "units": [
   "½ كغم",
   "1 كغم"
  ]
 },
 {
  "id": "produce_23",
  "categoryId": "produce",
  "nameAr": "شمندر",
  "brand": "",
  "emoji": "🥬",
  "units": [
   "½ كغم",
   "1 كغم"
  ]
 },
 {
  "id": "produce_24",
  "categoryId": "produce",
  "nameAr": "لفت",
  "brand": "",
  "emoji": "🥬",
  "units": [
   "½ كغم",
   "1 كغم"
  ]
 },
 {
  "id": "produce_25",
  "categoryId": "produce",
  "nameAr": "فاصولياء خضراء",
  "brand": "",
  "emoji": "🫘",
  "units": [
   "½ كغم",
   "1 كغم"
  ]
 },
 {
  "id": "produce_26",
  "categoryId": "produce",
  "nameAr": "بامية",
  "brand": "",
  "emoji": "🥬",
  "units": [
   "½ كغم",
   "1 كغم"
  ]
 },
 {
  "id": "produce_27",
  "categoryId": "produce",
  "nameAr": "فقوس",
  "brand": "",
  "emoji": "🥒",
  "units": [
   "½ كغم",
   "1 كغم"
  ]
 },
 {
  "id": "produce_28",
  "categoryId": "produce",
  "nameAr": "قرع",
  "brand": "",
  "emoji": "🎃",
  "units": [
   "½ كغم",
   "1 كغم"
  ]
 },
 {
  "id": "produce_29",
  "categoryId": "produce",
  "nameAr": "ذرة",
  "brand": "",
  "emoji": "🌽",
  "units": [
   "½ كغم",
   "1 كغم"
  ]
 },
 {
  "id": "produce_30",
  "categoryId": "produce",
  "nameAr": "فطر",
  "brand": "",
  "emoji": "🍄",
  "units": [
   "½ كغم",
   "1 كغم"
  ]
 },
 {
  "id": "produce_31",
  "categoryId": "produce",
  "nameAr": "زنجبيل طازج",
  "brand": "",
  "emoji": "🫚",
  "units": [
   "½ كغم",
   "1 كغم"
  ]
 },
 {
  "id": "produce_32",
  "categoryId": "produce",
  "nameAr": "تفاح أحمر",
  "brand": "",
  "emoji": "🍎",
  "units": [
   "½ كغم",
   "1 كغم"
  ]
 },
 {
  "id": "produce_33",
  "categoryId": "produce",
  "nameAr": "تفاح أخضر",
  "brand": "",
  "emoji": "🍏",
  "units": [
   "½ كغم",
   "1 كغم"
  ]
 },
 {
  "id": "produce_34",
  "categoryId": "produce",
  "nameAr": "موز",
  "brand": "",
  "emoji": "🍌",
  "units": [
   "½ كغم",
   "1 كغم"
  ]
 },
 {
  "id": "produce_35",
  "categoryId": "produce",
  "nameAr": "برتقال",
  "brand": "",
  "emoji": "🍊",
  "units": [
   "½ كغم",
   "1 كغم"
  ]
 },
 {
  "id": "produce_36",
  "categoryId": "produce",
  "nameAr": "ليمون",
  "brand": "",
  "emoji": "🍋",
  "units": [
   "½ كغم",
   "1 كغم"
  ]
 },
 {
  "id": "produce_37",
  "categoryId": "produce",
  "nameAr": "كلمنتينا",
  "brand": "",
  "emoji": "🍊",
  "units": [
   "½ كغم",
   "1 كغم"
  ]
 },
 {
  "id": "produce_38",
  "categoryId": "produce",
  "nameAr": "عنب",
  "brand": "",
  "emoji": "🍇",
  "units": [
   "½ كغم",
   "1 كغم"
  ]
 },
 {
  "id": "produce_39",
  "categoryId": "produce",
  "nameAr": "بطيخ",
  "brand": "",
  "emoji": "🍉",
  "units": [
   "½ كغم",
   "1 كغم"
  ]
 },
 {
  "id": "produce_40",
  "categoryId": "produce",
  "nameAr": "شمام",
  "brand": "",
  "emoji": "🍈",
  "units": [
   "½ كغم",
   "1 كغم"
  ]
 },
 {
  "id": "produce_41",
  "categoryId": "produce",
  "nameAr": "خوخ",
  "brand": "",
  "emoji": "🍑",
  "units": [
   "½ كغم",
   "1 كغم"
  ]
 },
 {
  "id": "produce_42",
  "categoryId": "produce",
  "nameAr": "مشمش",
  "brand": "",
  "emoji": "🍑",
  "units": [
   "½ كغم",
   "1 كغم"
  ]
 },
 {
  "id": "produce_43",
  "categoryId": "produce",
  "nameAr": "تين",
  "brand": "",
  "emoji": "🫐",
  "units": [
   "½ كغم",
   "1 كغم"
  ]
 },
 {
  "id": "produce_44",
  "categoryId": "produce",
  "nameAr": "رمان",
  "brand": "",
  "emoji": "🍎",
  "units": [
   "½ كغم",
   "1 كغم"
  ]
 },
 {
  "id": "produce_45",
  "categoryId": "produce",
  "nameAr": "كمثرى",
  "brand": "",
  "emoji": "🍐",
  "units": [
   "½ كغم",
   "1 كغم"
  ]
 },
 {
  "id": "produce_46",
  "categoryId": "produce",
  "nameAr": "فراولة",
  "brand": "",
  "emoji": "🍓",
  "units": [
   "½ كغم",
   "1 كغم"
  ]
 },
 {
  "id": "produce_47",
  "categoryId": "produce",
  "nameAr": "كيوي",
  "brand": "",
  "emoji": "🥝",
  "units": [
   "½ كغم",
   "1 كغم"
  ]
 },
 {
  "id": "produce_48",
  "categoryId": "produce",
  "nameAr": "أناناس",
  "brand": "",
  "emoji": "🍍",
  "units": [
   "½ كغم",
   "1 كغم"
  ]
 },
 {
  "id": "produce_49",
  "categoryId": "produce",
  "nameAr": "مانجا",
  "brand": "",
  "emoji": "🥭",
  "units": [
   "½ كغم",
   "1 كغم"
  ]
 },
 {
  "id": "produce_50",
  "categoryId": "produce",
  "nameAr": "أفوكادو",
  "brand": "",
  "emoji": "🥑",
  "units": [
   "½ كغم",
   "1 كغم"
  ]
 },
 {
  "id": "produce_51",
  "categoryId": "produce",
  "nameAr": "تمر مجهول",
  "brand": "",
  "emoji": "🌴",
  "units": [
   "½ كغم",
   "1 كغم"
  ]
 },
 {
  "id": "produce_52",
  "categoryId": "produce",
  "nameAr": "جوافة",
  "brand": "",
  "emoji": "🍐",
  "units": [
   "½ كغم",
   "1 كغم"
  ]
 },
 {
  "id": "produce_53",
  "categoryId": "produce",
  "nameAr": "سفرجل",
  "brand": "",
  "emoji": "🍏",
  "units": [
   "½ كغم",
   "1 كغم"
  ]
 },
 {
  "id": "produce_54",
  "categoryId": "produce",
  "nameAr": "كرز",
  "brand": "",
  "emoji": "🍒",
  "units": [
   "½ كغم",
   "1 كغم"
  ]
 },
 {
  "id": "produce_55",
  "categoryId": "produce",
  "nameAr": "توت",
  "brand": "",
  "emoji": "🫐",
  "units": [
   "½ كغم",
   "1 كغم"
  ]
 },
 {
  "id": "meat_1",
  "categoryId": "meat",
  "nameAr": "دجاج كامل طازج",
  "brand": "",
  "emoji": "🍗",
  "units": [
   "1 كغم"
  ]
 },
 {
  "id": "meat_2",
  "categoryId": "meat",
  "nameAr": "صدور دجاج",
  "brand": "",
  "emoji": "🍗",
  "units": [
   "1 كغم"
  ]
 },
 {
  "id": "meat_3",
  "categoryId": "meat",
  "nameAr": "أفخاذ دجاج",
  "brand": "",
  "emoji": "🍗",
  "units": [
   "1 كغم"
  ]
 },
 {
  "id": "meat_4",
  "categoryId": "meat",
  "nameAr": "أجنحة دجاج",
  "brand": "",
  "emoji": "🍗",
  "units": [
   "1 كغم"
  ]
 },
 {
  "id": "meat_5",
  "categoryId": "meat",
  "nameAr": "شاورما دجاج متبلة",
  "brand": "",
  "emoji": "🍗",
  "units": [
   "1 كغم"
  ]
 },
 {
  "id": "meat_6",
  "categoryId": "meat",
  "nameAr": "لحمة بقر مفرومة",
  "brand": "",
  "emoji": "🥩",
  "units": [
   "1 كغم"
  ]
 },
 {
  "id": "meat_7",
  "categoryId": "meat",
  "nameAr": "لحمة بقر ستيك",
  "brand": "",
  "emoji": "🥩",
  "units": [
   "1 كغم"
  ]
 },
 {
  "id": "meat_8",
  "categoryId": "meat",
  "nameAr": "لحمة غنم",
  "brand": "",
  "emoji": "🥩",
  "units": [
   "1 كغم"
  ]
 },
 {
  "id": "meat_9",
  "categoryId": "meat",
  "nameAr": "كباب مشكل",
  "brand": "",
  "emoji": "🍢",
  "units": [
   "1 كغم"
  ]
 },
 {
  "id": "meat_10",
  "categoryId": "meat",
  "nameAr": "شقف لحمة",
  "brand": "",
  "emoji": "🥩",
  "units": [
   "1 كغم"
  ]
 },
 {
  "id": "meat_11",
  "categoryId": "meat",
  "nameAr": "ريش غنم",
  "brand": "",
  "emoji": "🍖",
  "units": [
   "1 كغم"
  ]
 },
 {
  "id": "meat_12",
  "categoryId": "meat",
  "nameAr": "كبدة دجاج",
  "brand": "",
  "emoji": "🍖",
  "units": [
   "½ كغم"
  ]
 },
 {
  "id": "meat_13",
  "categoryId": "meat",
  "nameAr": "سمك بلطي",
  "brand": "",
  "emoji": "🐟",
  "units": [
   "1 كغم"
  ]
 },
 {
  "id": "meat_14",
  "categoryId": "meat",
  "nameAr": "سمك سلمون",
  "brand": "",
  "emoji": "🐟",
  "units": [
   "1 كغم"
  ]
 },
 {
  "id": "meat_15",
  "categoryId": "meat",
  "nameAr": "جمبري",
  "brand": "",
  "emoji": "🦐",
  "units": [
   "½ كغم"
  ]
 },
 {
  "id": "meat_16",
  "categoryId": "meat",
  "nameAr": "مرتديلا دجاج",
  "brand": "",
  "emoji": "🥓",
  "units": [
   "250 غرام"
  ]
 },
 {
  "id": "meat_17",
  "categoryId": "meat",
  "nameAr": "مرتديلا لحمة",
  "brand": "",
  "emoji": "🥓",
  "units": [
   "250 غرام"
  ]
 },
 {
  "id": "meat_18",
  "categoryId": "meat",
  "nameAr": "سجق",
  "brand": "",
  "emoji": "🌭",
  "units": [
   "500 غرام"
  ]
 },
 {
  "id": "meat_19",
  "categoryId": "meat",
  "nameAr": "نقانق دجاج",
  "brand": "",
  "emoji": "🌭",
  "units": [
   "400 غرام"
  ]
 },
 {
  "id": "meat_20",
  "categoryId": "meat",
  "nameAr": "بسطرمة",
  "brand": "",
  "emoji": "🥓",
  "units": [
   "200 غرام"
  ]
 },
 {
  "id": "frozen_1",
  "categoryId": "frozen",
  "nameAr": "بازيلاء مجمدة",
  "brand": "",
  "emoji": "🫛",
  "units": [
   "400 غرام"
  ]
 },
 {
  "id": "frozen_2",
  "categoryId": "frozen",
  "nameAr": "خضار مشكلة مجمدة",
  "brand": "",
  "emoji": "🥬",
  "units": [
   "400 غرام"
  ]
 },
 {
  "id": "frozen_3",
  "categoryId": "frozen",
  "nameAr": "ذرة مجمدة",
  "brand": "",
  "emoji": "🌽",
  "units": [
   "400 غرام"
  ]
 },
 {
  "id": "frozen_4",
  "categoryId": "frozen",
  "nameAr": "سبانخ مجمدة",
  "brand": "",
  "emoji": "🥬",
  "units": [
   "400 غرام"
  ]
 },
 {
  "id": "frozen_5",
  "categoryId": "frozen",
  "nameAr": "بامية مجمدة",
  "brand": "",
  "emoji": "🥬",
  "units": [
   "400 غرام"
  ]
 },
 {
  "id": "frozen_6",
  "categoryId": "frozen",
  "nameAr": "فاصولياء مجمدة",
  "brand": "",
  "emoji": "🫘",
  "units": [
   "400 غرام"
  ]
 },
 {
  "id": "frozen_7",
  "categoryId": "frozen",
  "nameAr": "بطاطا مقلية مجمدة",
  "brand": "",
  "emoji": "🍟",
  "units": [
   "1 كغم"
  ]
 },
 {
  "id": "frozen_8",
  "categoryId": "frozen",
  "nameAr": "بطاطا ودجز",
  "brand": "",
  "emoji": "🍟",
  "units": [
   "750 غرام"
  ]
 },
 {
  "id": "frozen_9",
  "categoryId": "frozen",
  "nameAr": "شنيتسل دجاج",
  "brand": "",
  "emoji": "🍗",
  "units": [
   "1 كغم"
  ]
 },
 {
  "id": "frozen_10",
  "categoryId": "frozen",
  "nameAr": "ناجتس دجاج",
  "brand": "",
  "emoji": "🍗",
  "units": [
   "750 غرام"
  ]
 },
 {
  "id": "frozen_11",
  "categoryId": "frozen",
  "nameAr": "برجر لحمة",
  "brand": "",
  "emoji": "🍔",
  "units": [
   "4 قطع"
  ]
 },
 {
  "id": "frozen_12",
  "categoryId": "frozen",
  "nameAr": "برجر دجاج",
  "brand": "",
  "emoji": "🍔",
  "units": [
   "4 قطع"
  ]
 },
 {
  "id": "frozen_13",
  "categoryId": "frozen",
  "nameAr": "سمبوسك جبنة",
  "brand": "",
  "emoji": "🥟",
  "units": [
   "500 غرام"
  ]
 },
 {
  "id": "frozen_14",
  "categoryId": "frozen",
  "nameAr": "سمبوسك لحمة",
  "brand": "",
  "emoji": "🥟",
  "units": [
   "500 غرام"
  ]
 },
 {
  "id": "frozen_15",
  "categoryId": "frozen",
  "nameAr": "عجينة سبرينغ رول",
  "brand": "",
  "emoji": "🥟",
  "units": [
   "400 غرام"
  ]
 },
 {
  "id": "frozen_16",
  "categoryId": "frozen",
  "nameAr": "بوظة فانيلا",
  "brand": "",
  "emoji": "🍨",
  "units": [
   "1 لتر"
  ]
 },
 {
  "id": "frozen_17",
  "categoryId": "frozen",
  "nameAr": "بوظة شوكولاتة",
  "brand": "",
  "emoji": "🍨",
  "units": [
   "1 لتر"
  ]
 },
 {
  "id": "frozen_18",
  "categoryId": "frozen",
  "nameAr": "بوظة مشكلة",
  "brand": "",
  "emoji": "🍨",
  "units": [
   "2 لتر"
  ]
 },
 {
  "id": "frozen_19",
  "categoryId": "frozen",
  "nameAr": "مثلجات كورنيتو",
  "brand": "",
  "emoji": "🍦",
  "units": [
   "4 حبات"
  ]
 },
 {
  "id": "frozen_20",
  "categoryId": "frozen",
  "nameAr": "عجينة بف باستري",
  "brand": "",
  "emoji": "🥐",
  "units": [
   "400 غرام"
  ]
 },
 {
  "id": "pantry_1",
  "categoryId": "pantry",
  "nameAr": "أرز بسمتي",
  "brand": "",
  "emoji": "🍚",
  "units": [
   "1 كغم",
   "5 كغم"
  ]
 },
 {
  "id": "pantry_2",
  "categoryId": "pantry",
  "nameAr": "أرز مصري",
  "brand": "",
  "emoji": "🍚",
  "units": [
   "1 كغم",
   "5 كغم"
  ]
 },
 {
  "id": "pantry_3",
  "categoryId": "pantry",
  "nameAr": "أرز حبة قصيرة",
  "brand": "",
  "emoji": "🍚",
  "units": [
   "1 كغم",
   "5 كغم"
  ]
 },
 {
  "id": "pantry_4",
  "categoryId": "pantry",
  "nameAr": "طحين أبيض",
  "brand": "",
  "emoji": "🌾",
  "units": [
   "1 كغم",
   "5 كغم"
  ]
 },
 {
  "id": "pantry_5",
  "categoryId": "pantry",
  "nameAr": "طحين أسمر",
  "brand": "",
  "emoji": "🌾",
  "units": [
   "1 كغم"
  ]
 },
 {
  "id": "pantry_6",
  "categoryId": "pantry",
  "nameAr": "سكر أبيض",
  "brand": "",
  "emoji": "🍬",
  "units": [
   "1 كغم",
   "5 كغم"
  ]
 },
 {
  "id": "pantry_7",
  "categoryId": "pantry",
  "nameAr": "سكر بني",
  "brand": "",
  "emoji": "🍬",
  "units": [
   "1 كغم"
  ]
 },
 {
  "id": "pantry_8",
  "categoryId": "pantry",
  "nameAr": "ملح طعام",
  "brand": "",
  "emoji": "🧂",
  "units": [
   "1 كغم"
  ]
 },
 {
  "id": "pantry_9",
  "categoryId": "pantry",
  "nameAr": "زيت زيتون بلدي",
  "brand": "",
  "emoji": "🫒",
  "units": [
   "1 لتر",
   "3 لتر"
  ]
 },
 {
  "id": "pantry_10",
  "categoryId": "pantry",
  "nameAr": "زيت ذرة",
  "brand": "",
  "emoji": "🫗",
  "units": [
   "1.5 لتر"
  ]
 },
 {
  "id": "pantry_11",
  "categoryId": "pantry",
  "nameAr": "زيت دوار الشمس",
  "brand": "",
  "emoji": "🫗",
  "units": [
   "1.5 لتر"
  ]
 },
 {
  "id": "pantry_12",
  "categoryId": "pantry",
  "nameAr": "خل أبيض",
  "brand": "",
  "emoji": "🫗",
  "units": [
   "1 لتر"
  ]
 },
 {
  "id": "pantry_13",
  "categoryId": "pantry",
  "nameAr": "خل تفاح",
  "brand": "",
  "emoji": "🫗",
  "units": [
   "500 مل"
  ]
 },
 {
  "id": "pantry_14",
  "categoryId": "pantry",
  "nameAr": "معكرونة سباغيتي",
  "brand": "",
  "emoji": "🍝",
  "units": [
   "500 غرام"
  ]
 },
 {
  "id": "pantry_15",
  "categoryId": "pantry",
  "nameAr": "معكرونة بيني",
  "brand": "",
  "emoji": "🍝",
  "units": [
   "500 غرام"
  ]
 },
 {
  "id": "pantry_16",
  "categoryId": "pantry",
  "nameAr": "معكرونة أصابع",
  "brand": "",
  "emoji": "🍝",
  "units": [
   "500 غرام"
  ]
 },
 {
  "id": "pantry_17",
  "categoryId": "pantry",
  "nameAr": "شعيرية",
  "brand": "",
  "emoji": "🍝",
  "units": [
   "400 غرام"
  ]
 },
 {
  "id": "pantry_18",
  "categoryId": "pantry",
  "nameAr": "نودلز سريع",
  "brand": "",
  "emoji": "🍜",
  "units": [
   "5 عبوات"
  ]
 },
 {
  "id": "pantry_19",
  "categoryId": "pantry",
  "nameAr": "برغل ناعم",
  "brand": "",
  "emoji": "🌾",
  "units": [
   "1 كغم"
  ]
 },
 {
  "id": "pantry_20",
  "categoryId": "pantry",
  "nameAr": "برغل خشن",
  "brand": "",
  "emoji": "🌾",
  "units": [
   "1 كغم"
  ]
 },
 {
  "id": "pantry_21",
  "categoryId": "pantry",
  "nameAr": "فريكة",
  "brand": "",
  "emoji": "🌾",
  "units": [
   "1 كغم"
  ]
 },
 {
  "id": "pantry_22",
  "categoryId": "pantry",
  "nameAr": "مفتول",
  "brand": "",
  "emoji": "🌾",
  "units": [
   "1 كغم"
  ]
 },
 {
  "id": "pantry_23",
  "categoryId": "pantry",
  "nameAr": "سميد",
  "brand": "",
  "emoji": "🌾",
  "units": [
   "1 كغم"
  ]
 },
 {
  "id": "pantry_24",
  "categoryId": "pantry",
  "nameAr": "نشا الذرة",
  "brand": "",
  "emoji": "🌾",
  "units": [
   "400 غرام"
  ]
 },
 {
  "id": "pantry_25",
  "categoryId": "pantry",
  "nameAr": "بيكنغ باودر",
  "brand": "",
  "emoji": "🧁",
  "units": [
   "100 غرام"
  ]
 },
 {
  "id": "pantry_26",
  "categoryId": "pantry",
  "nameAr": "خميرة فورية",
  "brand": "",
  "emoji": "🧁",
  "units": [
   "500 غرام"
  ]
 },
 {
  "id": "pantry_27",
  "categoryId": "pantry",
  "nameAr": "عدس أحمر",
  "brand": "",
  "emoji": "🫘",
  "units": [
   "1 كغم"
  ]
 },
 {
  "id": "pantry_28",
  "categoryId": "pantry",
  "nameAr": "عدس بني",
  "brand": "",
  "emoji": "🫘",
  "units": [
   "1 كغم"
  ]
 },
 {
  "id": "pantry_29",
  "categoryId": "pantry",
  "nameAr": "حمص حب",
  "brand": "",
  "emoji": "🫘",
  "units": [
   "1 كغم"
  ]
 },
 {
  "id": "pantry_30",
  "categoryId": "pantry",
  "nameAr": "فول مدمس حب",
  "brand": "",
  "emoji": "🫘",
  "units": [
   "1 كغم"
  ]
 },
 {
  "id": "pantry_31",
  "categoryId": "pantry",
  "nameAr": "فاصولياء بيضاء",
  "brand": "",
  "emoji": "🫘",
  "units": [
   "1 كغم"
  ]
 },
 {
  "id": "pantry_32",
  "categoryId": "pantry",
  "nameAr": "لوبيا",
  "brand": "",
  "emoji": "🫘",
  "units": [
   "1 كغم"
  ]
 },
 {
  "id": "pantry_33",
  "categoryId": "pantry",
  "nameAr": "بازيلاء يابسة",
  "brand": "",
  "emoji": "🫘",
  "units": [
   "1 كغم"
  ]
 },
 {
  "id": "canned_1",
  "categoryId": "canned",
  "nameAr": "طحينة",
  "brand": "",
  "emoji": "🥣",
  "units": [
   "500 غرام",
   "900 غرام"
  ]
 },
 {
  "id": "canned_2",
  "categoryId": "canned",
  "nameAr": "حلاوة سادة",
  "brand": "",
  "emoji": "🍯",
  "units": [
   "500 غرام"
  ]
 },
 {
  "id": "canned_3",
  "categoryId": "canned",
  "nameAr": "حلاوة بالفستق",
  "brand": "",
  "emoji": "🍯",
  "units": [
   "500 غرام"
  ]
 },
 {
  "id": "canned_4",
  "categoryId": "canned",
  "nameAr": "عسل طبيعي",
  "brand": "",
  "emoji": "🍯",
  "units": [
   "500 غرام",
   "1 كغم"
  ]
 },
 {
  "id": "canned_5",
  "categoryId": "canned",
  "nameAr": "دبس رمان",
  "brand": "",
  "emoji": "🫗",
  "units": [
   "500 مل"
  ]
 },
 {
  "id": "canned_6",
  "categoryId": "canned",
  "nameAr": "دبس عنب",
  "brand": "",
  "emoji": "🫗",
  "units": [
   "500 مل"
  ]
 },
 {
  "id": "canned_7",
  "categoryId": "canned",
  "nameAr": "مربى مشمش",
  "brand": "",
  "emoji": "🍑",
  "units": [
   "400 غرام"
  ]
 },
 {
  "id": "canned_8",
  "categoryId": "canned",
  "nameAr": "مربى فراولة",
  "brand": "",
  "emoji": "🍓",
  "units": [
   "400 غرام"
  ]
 },
 {
  "id": "canned_9",
  "categoryId": "canned",
  "nameAr": "مربى تين",
  "brand": "",
  "emoji": "🫐",
  "units": [
   "400 غرام"
  ]
 },
 {
  "id": "canned_10",
  "categoryId": "canned",
  "nameAr": "شوكولاتة سبريد",
  "brand": "",
  "emoji": "🍫",
  "units": [
   "400 غرام"
  ]
 },
 {
  "id": "canned_11",
  "categoryId": "canned",
  "nameAr": "زبدة فول سوداني",
  "brand": "",
  "emoji": "🥜",
  "units": [
   "350 غرام"
  ]
 },
 {
  "id": "canned_12",
  "categoryId": "canned",
  "nameAr": "فول مدمس معلب",
  "brand": "",
  "emoji": "🫘",
  "units": [
   "400 غرام"
  ]
 },
 {
  "id": "canned_13",
  "categoryId": "canned",
  "nameAr": "حمص معلب",
  "brand": "",
  "emoji": "🫘",
  "units": [
   "400 غرام"
  ]
 },
 {
  "id": "canned_14",
  "categoryId": "canned",
  "nameAr": "ذرة معلبة",
  "brand": "",
  "emoji": "🌽",
  "units": [
   "340 غرام"
  ]
 },
 {
  "id": "canned_15",
  "categoryId": "canned",
  "nameAr": "بازيلاء معلبة",
  "brand": "",
  "emoji": "🫛",
  "units": [
   "400 غرام"
  ]
 },
 {
  "id": "canned_16",
  "categoryId": "canned",
  "nameAr": "فطر معلب",
  "brand": "",
  "emoji": "🍄",
  "units": [
   "400 غرام"
  ]
 },
 {
  "id": "canned_17",
  "categoryId": "canned",
  "nameAr": "تونا بالزيت",
  "brand": "",
  "emoji": "🐟",
  "units": [
   "160 غرام"
  ]
 },
 {
  "id": "canned_18",
  "categoryId": "canned",
  "nameAr": "تونا بالماء",
  "brand": "",
  "emoji": "🐟",
  "units": [
   "160 غرام"
  ]
 },
 {
  "id": "canned_19",
  "categoryId": "canned",
  "nameAr": "سردين",
  "brand": "",
  "emoji": "🐟",
  "units": [
   "125 غرام"
  ]
 },
 {
  "id": "canned_20",
  "categoryId": "canned",
  "nameAr": "معجون بندورة",
  "brand": "",
  "emoji": "🥫",
  "units": [
   "400 غرام",
   "800 غرام"
  ]
 },
 {
  "id": "canned_21",
  "categoryId": "canned",
  "nameAr": "صلصة بندورة",
  "brand": "",
  "emoji": "🥫",
  "units": [
   "700 غرام"
  ]
 },
 {
  "id": "canned_22",
  "categoryId": "canned",
  "nameAr": "كاتشب",
  "brand": "",
  "emoji": "🍅",
  "units": [
   "500 غرام"
  ]
 },
 {
  "id": "canned_23",
  "categoryId": "canned",
  "nameAr": "مايونيز",
  "brand": "",
  "emoji": "🥚",
  "units": [
   "500 غرام"
  ]
 },
 {
  "id": "canned_24",
  "categoryId": "canned",
  "nameAr": "خردل",
  "brand": "",
  "emoji": "🌭",
  "units": [
   "250 غرام"
  ]
 },
 {
  "id": "canned_25",
  "categoryId": "canned",
  "nameAr": "مخلل مشكل",
  "brand": "",
  "emoji": "🥒",
  "units": [
   "1 كغم"
  ]
 },
 {
  "id": "canned_26",
  "categoryId": "canned",
  "nameAr": "مخلل خيار",
  "brand": "",
  "emoji": "🥒",
  "units": [
   "700 غرام"
  ]
 },
 {
  "id": "canned_27",
  "categoryId": "canned",
  "nameAr": "زيتون أخضر",
  "brand": "",
  "emoji": "🫒",
  "units": [
   "1 كغم"
  ]
 },
 {
  "id": "canned_28",
  "categoryId": "canned",
  "nameAr": "زيتون أسود",
  "brand": "",
  "emoji": "🫒",
  "units": [
   "500 غرام"
  ]
 },
 {
  "id": "canned_29",
  "categoryId": "canned",
  "nameAr": "مكدوس",
  "brand": "",
  "emoji": "🍆",
  "units": [
   "500 غرام"
  ]
 },
 {
  "id": "canned_30",
  "categoryId": "canned",
  "nameAr": "ورق عنب معلب",
  "brand": "",
  "emoji": "🍇",
  "units": [
   "500 غرام"
  ]
 },
 {
  "id": "snacks_1",
  "categoryId": "snacks",
  "nameAr": "شيبس ليز ملح",
  "brand": "",
  "emoji": "🍿",
  "units": [
   "عبوة صغيرة",
   "عبوة كبيرة"
  ]
 },
 {
  "id": "snacks_2",
  "categoryId": "snacks",
  "nameAr": "شيبس ليز بابريكا",
  "brand": "",
  "emoji": "🍿",
  "units": [
   "عبوة صغيرة",
   "عبوة كبيرة"
  ]
 },
 {
  "id": "snacks_3",
  "categoryId": "snacks",
  "nameAr": "شيبس ليز جبنة",
  "brand": "",
  "emoji": "🍿",
  "units": [
   "عبوة صغيرة",
   "عبوة كبيرة"
  ]
 },
 {
  "id": "snacks_4",
  "categoryId": "snacks",
  "nameAr": "شيبس تابيتا",
  "brand": "",
  "emoji": "🍿",
  "units": [
   "عبوة صغيرة",
   "عبوة كبيرة"
  ]
 },
 {
  "id": "snacks_5",
  "categoryId": "snacks",
  "nameAr": "شيبس دوريتوس",
  "brand": "",
  "emoji": "🍿",
  "units": [
   "عبوة صغيرة",
   "عبوة كبيرة"
  ]
 },
 {
  "id": "snacks_6",
  "categoryId": "snacks",
  "nameAr": "شيبس برينجلز",
  "brand": "",
  "emoji": "🍿",
  "units": [
   "عبوة صغيرة",
   "عبوة كبيرة"
  ]
 },
 {
  "id": "snacks_7",
  "categoryId": "snacks",
  "nameAr": "ذرة مقرمشة",
  "brand": "",
  "emoji": "🍿",
  "units": [
   "عبوة صغيرة",
   "عبوة كبيرة"
  ]
 },
 {
  "id": "snacks_8",
  "categoryId": "snacks",
  "nameAr": "بوشار جاهز",
  "brand": "",
  "emoji": "🍿",
  "units": [
   "عبوة صغيرة",
   "عبوة كبيرة"
  ]
 },
 {
  "id": "snacks_9",
  "categoryId": "snacks",
  "nameAr": "بسكويت شاي",
  "brand": "",
  "emoji": "🍪",
  "units": [
   "400 غرام"
  ]
 },
 {
  "id": "snacks_10",
  "categoryId": "snacks",
  "nameAr": "بسكويت أوريو",
  "brand": "",
  "emoji": "🍪",
  "units": [
   "12 قطعة"
  ]
 },
 {
  "id": "snacks_11",
  "categoryId": "snacks",
  "nameAr": "بسكويت بالشوكولاتة",
  "brand": "",
  "emoji": "🍪",
  "units": [
   "300 غرام"
  ]
 },
 {
  "id": "snacks_12",
  "categoryId": "snacks",
  "nameAr": "ويفر شوكولاتة",
  "brand": "",
  "emoji": "🍫",
  "units": [
   "6 قطع"
  ]
 },
 {
  "id": "snacks_13",
  "categoryId": "snacks",
  "nameAr": "كيك مغلف",
  "brand": "",
  "emoji": "🧁",
  "units": [
   "6 قطع"
  ]
 },
 {
  "id": "snacks_14",
  "categoryId": "snacks",
  "nameAr": "كرواسون مغلف",
  "brand": "",
  "emoji": "🥐",
  "units": [
   "6 قطع"
  ]
 },
 {
  "id": "snacks_15",
  "categoryId": "snacks",
  "nameAr": "مكسرات مملحة",
  "brand": "",
  "emoji": "🥜",
  "units": [
   "200 غرام"
  ]
 },
 {
  "id": "snacks_16",
  "categoryId": "snacks",
  "nameAr": "فستق سوداني",
  "brand": "",
  "emoji": "🥜",
  "units": [
   "250 غرام"
  ]
 },
 {
  "id": "snacks_17",
  "categoryId": "snacks",
  "nameAr": "ترمس",
  "brand": "",
  "emoji": "🫘",
  "units": [
   "500 غرام"
  ]
 },
 {
  "id": "snacks_18",
  "categoryId": "snacks",
  "nameAr": "بذر شمسية",
  "brand": "",
  "emoji": "🌻",
  "units": [
   "250 غرام"
  ]
 },
 {
  "id": "snacks_19",
  "categoryId": "snacks",
  "nameAr": "بذر قرع",
  "brand": "",
  "emoji": "🎃",
  "units": [
   "250 غرام"
  ]
 },
 {
  "id": "sweets_1",
  "categoryId": "sweets",
  "nameAr": "شوكولاتة جالكسي",
  "brand": "",
  "emoji": "🍫",
  "units": [
   "قطعة"
  ]
 },
 {
  "id": "sweets_2",
  "categoryId": "sweets",
  "nameAr": "شوكولاتة كادبوري",
  "brand": "",
  "emoji": "🍫",
  "units": [
   "قطعة"
  ]
 },
 {
  "id": "sweets_3",
  "categoryId": "sweets",
  "nameAr": "شوكولاتة نستله",
  "brand": "",
  "emoji": "🍫",
  "units": [
   "قطعة"
  ]
 },
 {
  "id": "sweets_4",
  "categoryId": "sweets",
  "nameAr": "شوكولاتة سنيكرز",
  "brand": "",
  "emoji": "🍫",
  "units": [
   "قطعة"
  ]
 },
 {
  "id": "sweets_5",
  "categoryId": "sweets",
  "nameAr": "شوكولاتة مارس",
  "brand": "",
  "emoji": "🍫",
  "units": [
   "قطعة"
  ]
 },
 {
  "id": "sweets_6",
  "categoryId": "sweets",
  "nameAr": "شوكولاتة كيت كات",
  "brand": "",
  "emoji": "🍫",
  "units": [
   "قطعة"
  ]
 },
 {
  "id": "sweets_7",
  "categoryId": "sweets",
  "nameAr": "شوكولاتة بونتي",
  "brand": "",
  "emoji": "🍫",
  "units": [
   "قطعة"
  ]
 },
 {
  "id": "sweets_8",
  "categoryId": "sweets",
  "nameAr": "شوكولاتة تويكس",
  "brand": "",
  "emoji": "🍫",
  "units": [
   "قطعة"
  ]
 },
 {
  "id": "sweets_9",
  "categoryId": "sweets",
  "nameAr": "شوكولاتة فيريرو روشيه",
  "brand": "",
  "emoji": "🍫",
  "units": [
   "قطعة"
  ]
 },
 {
  "id": "sweets_10",
  "categoryId": "sweets",
  "nameAr": "شوكولاتة ميلكا",
  "brand": "",
  "emoji": "🍫",
  "units": [
   "قطعة"
  ]
 },
 {
  "id": "sweets_11",
  "categoryId": "sweets",
  "nameAr": "شوكولاتة لندت",
  "brand": "",
  "emoji": "🍫",
  "units": [
   "قطعة"
  ]
 },
 {
  "id": "sweets_12",
  "categoryId": "sweets",
  "nameAr": "علبة شوكولاتة مشكلة",
  "brand": "",
  "emoji": "🍫",
  "units": [
   "500 غرام"
  ]
 },
 {
  "id": "sweets_13",
  "categoryId": "sweets",
  "nameAr": "علكة",
  "brand": "",
  "emoji": "🍬",
  "units": [
   "عبوة"
  ]
 },
 {
  "id": "sweets_14",
  "categoryId": "sweets",
  "nameAr": "سكاكر مشكلة",
  "brand": "",
  "emoji": "🍬",
  "units": [
   "500 غرام"
  ]
 },
 {
  "id": "sweets_15",
  "categoryId": "sweets",
  "nameAr": "ملبس لوز",
  "brand": "",
  "emoji": "🍬",
  "units": [
   "500 غرام"
  ]
 },
 {
  "id": "sweets_16",
  "categoryId": "sweets",
  "nameAr": "راحة (حلقوم)",
  "brand": "",
  "emoji": "🍬",
  "units": [
   "500 غرام"
  ]
 },
 {
  "id": "sweets_17",
  "categoryId": "sweets",
  "nameAr": "مصاص أطفال",
  "brand": "",
  "emoji": "🍭",
  "units": [
   "10 حبات"
  ]
 },
 {
  "id": "sweets_18",
  "categoryId": "sweets",
  "nameAr": "جيلي",
  "brand": "",
  "emoji": "🍬",
  "units": [
   "200 غرام"
  ]
 },
 {
  "id": "sweets_19",
  "categoryId": "sweets",
  "nameAr": "مارشميلو",
  "brand": "",
  "emoji": "🍬",
  "units": [
   "200 غرام"
  ]
 },
 {
  "id": "drinks_1",
  "categoryId": "drinks",
  "nameAr": "كوكا كولا",
  "brand": "",
  "emoji": "🥤",
  "units": [
   "330 مل",
   "500 مل",
   "1 لتر",
   "1.5 لتر",
   "2 لتر",
   "6 عبوات 330 مل"
  ]
 },
 {
  "id": "drinks_2",
  "categoryId": "drinks",
  "nameAr": "بيبسي",
  "brand": "",
  "emoji": "🥤",
  "units": [
   "330 مل",
   "500 مل",
   "1 لتر",
   "1.5 لتر",
   "2 لتر",
   "6 عبوات 330 مل"
  ]
 },
 {
  "id": "drinks_3",
  "categoryId": "drinks",
  "nameAr": "سفن أب",
  "brand": "",
  "emoji": "🥤",
  "units": [
   "330 مل",
   "500 مل",
   "1 لتر",
   "1.5 لتر",
   "2 لتر",
   "6 عبوات 330 مل"
  ]
 },
 {
  "id": "drinks_4",
  "categoryId": "drinks",
  "nameAr": "ميرندا برتقال",
  "brand": "",
  "emoji": "🥤",
  "units": [
   "330 مل",
   "500 مل",
   "1 لتر",
   "1.5 لتر",
   "2 لتر",
   "6 عبوات 330 مل"
  ]
 },
 {
  "id": "drinks_5",
  "categoryId": "drinks",
  "nameAr": "فانتا",
  "brand": "",
  "emoji": "🥤",
  "units": [
   "330 مل",
   "500 مل",
   "1 لتر",
   "1.5 لتر",
   "2 لتر",
   "6 عبوات 330 مل"
  ]
 },
 {
  "id": "drinks_6",
  "categoryId": "drinks",
  "nameAr": "سبرايت",
  "brand": "",
  "emoji": "🥤",
  "units": [
   "330 مل",
   "500 مل",
   "1 لتر",
   "1.5 لتر",
   "2 لتر",
   "6 عبوات 330 مل"
  ]
 },
 {
  "id": "drinks_7",
  "categoryId": "drinks",
  "nameAr": "شويبس",
  "brand": "",
  "emoji": "🥤",
  "units": [
   "330 مل",
   "500 مل",
   "1 لتر",
   "1.5 لتر",
   "2 لتر",
   "6 عبوات 330 مل"
  ]
 },
 {
  "id": "drinks_8",
  "categoryId": "drinks",
  "nameAr": "XL طاقة",
  "brand": "",
  "emoji": "🥤",
  "units": [
   "330 مل",
   "500 مل",
   "1 لتر",
   "1.5 لتر",
   "2 لتر",
   "6 عبوات 330 مل"
  ]
 },
 {
  "id": "drinks_9",
  "categoryId": "drinks",
  "nameAr": "عصير برتقال",
  "brand": "",
  "emoji": "🧃",
  "units": [
   "250 مل",
   "1 لتر",
   "1.5 لتر"
  ]
 },
 {
  "id": "drinks_10",
  "categoryId": "drinks",
  "nameAr": "عصير تفاح",
  "brand": "",
  "emoji": "🧃",
  "units": [
   "250 مل",
   "1 لتر",
   "1.5 لتر"
  ]
 },
 {
  "id": "drinks_11",
  "categoryId": "drinks",
  "nameAr": "عصير مانجا",
  "brand": "",
  "emoji": "🧃",
  "units": [
   "250 مل",
   "1 لتر",
   "1.5 لتر"
  ]
 },
 {
  "id": "drinks_12",
  "categoryId": "drinks",
  "nameAr": "عصير جوافة",
  "brand": "",
  "emoji": "🧃",
  "units": [
   "250 مل",
   "1 لتر",
   "1.5 لتر"
  ]
 },
 {
  "id": "drinks_13",
  "categoryId": "drinks",
  "nameAr": "عصير عنب",
  "brand": "",
  "emoji": "🧃",
  "units": [
   "250 مل",
   "1 لتر",
   "1.5 لتر"
  ]
 },
 {
  "id": "drinks_14",
  "categoryId": "drinks",
  "nameAr": "عصير مشكل",
  "brand": "",
  "emoji": "🧃",
  "units": [
   "250 مل",
   "1 لتر",
   "1.5 لتر"
  ]
 },
 {
  "id": "drinks_15",
  "categoryId": "drinks",
  "nameAr": "عصير ليمون بالنعناع",
  "brand": "",
  "emoji": "🧃",
  "units": [
   "250 مل",
   "1 لتر",
   "1.5 لتر"
  ]
 },
 {
  "id": "drinks_16",
  "categoryId": "drinks",
  "nameAr": "مياه معدنية",
  "brand": "",
  "emoji": "💧",
  "units": [
   "500 مل",
   "1.5 لتر",
   "6 عبوات"
  ]
 },
 {
  "id": "drinks_17",
  "categoryId": "drinks",
  "nameAr": "مياه غازية",
  "brand": "",
  "emoji": "💧",
  "units": [
   "1 لتر"
  ]
 },
 {
  "id": "drinks_18",
  "categoryId": "drinks",
  "nameAr": "مشروب شعير",
  "brand": "",
  "emoji": "🍺",
  "units": [
   "330 مل"
  ]
 },
 {
  "id": "drinks_19",
  "categoryId": "drinks",
  "nameAr": "مشروب طاقة ريد بول",
  "brand": "",
  "emoji": "⚡",
  "units": [
   "250 مل"
  ]
 },
 {
  "id": "drinks_20",
  "categoryId": "drinks",
  "nameAr": "عيران",
  "brand": "",
  "emoji": "🥛",
  "units": [
   "250 مل"
  ]
 },
 {
  "id": "drinks_21",
  "categoryId": "drinks",
  "nameAr": "مشروب شوكولاتة بالحليب",
  "brand": "",
  "emoji": "🥛",
  "units": [
   "250 مل"
  ]
 },
 {
  "id": "hotdrinks_1",
  "categoryId": "hotdrinks",
  "nameAr": "قهوة عربية مطحونة",
  "brand": "",
  "emoji": "☕",
  "units": [
   "500 غرام"
  ]
 },
 {
  "id": "hotdrinks_2",
  "categoryId": "hotdrinks",
  "nameAr": "قهوة عربية بالهيل",
  "brand": "",
  "emoji": "☕",
  "units": [
   "500 غرام"
  ]
 },
 {
  "id": "hotdrinks_3",
  "categoryId": "hotdrinks",
  "nameAr": "قهوة تركية",
  "brand": "",
  "emoji": "☕",
  "units": [
   "250 غرام"
  ]
 },
 {
  "id": "hotdrinks_4",
  "categoryId": "hotdrinks",
  "nameAr": "قهوة نسكافيه كلاسيك",
  "brand": "",
  "emoji": "☕",
  "units": [
   "200 غرام"
  ]
 },
 {
  "id": "hotdrinks_5",
  "categoryId": "hotdrinks",
  "nameAr": "نسكافيه 3×1",
  "brand": "",
  "emoji": "☕",
  "units": [
   "20 كيس"
  ]
 },
 {
  "id": "hotdrinks_6",
  "categoryId": "hotdrinks",
  "nameAr": "قهوة إسبريسو حبوب",
  "brand": "",
  "emoji": "☕",
  "units": [
   "1 كغم"
  ]
 },
 {
  "id": "hotdrinks_7",
  "categoryId": "hotdrinks",
  "nameAr": "كبسولات قهوة",
  "brand": "",
  "emoji": "☕",
  "units": [
   "10 كبسولات"
  ]
 },
 {
  "id": "hotdrinks_8",
  "categoryId": "hotdrinks",
  "nameAr": "شاي أحمر",
  "brand": "",
  "emoji": "🍵",
  "units": [
   "100 كيس"
  ]
 },
 {
  "id": "hotdrinks_9",
  "categoryId": "hotdrinks",
  "nameAr": "شاي أخضر",
  "brand": "",
  "emoji": "🍵",
  "units": [
   "50 كيس"
  ]
 },
 {
  "id": "hotdrinks_10",
  "categoryId": "hotdrinks",
  "nameAr": "شاي بالنعناع",
  "brand": "",
  "emoji": "🍵",
  "units": [
   "50 كيس"
  ]
 },
 {
  "id": "hotdrinks_11",
  "categoryId": "hotdrinks",
  "nameAr": "شاي ليبتون",
  "brand": "",
  "emoji": "🍵",
  "units": [
   "100 كيس"
  ]
 },
 {
  "id": "hotdrinks_12",
  "categoryId": "hotdrinks",
  "nameAr": "زهورات",
  "brand": "",
  "emoji": "🌼",
  "units": [
   "100 غرام"
  ]
 },
 {
  "id": "hotdrinks_13",
  "categoryId": "hotdrinks",
  "nameAr": "بابونج",
  "brand": "",
  "emoji": "🌼",
  "units": [
   "100 غرام"
  ]
 },
 {
  "id": "hotdrinks_14",
  "categoryId": "hotdrinks",
  "nameAr": "مرمرية",
  "brand": "",
  "emoji": "🌿",
  "units": [
   "100 غرام"
  ]
 },
 {
  "id": "hotdrinks_15",
  "categoryId": "hotdrinks",
  "nameAr": "يانسون",
  "brand": "",
  "emoji": "🌿",
  "units": [
   "100 غرام"
  ]
 },
 {
  "id": "hotdrinks_16",
  "categoryId": "hotdrinks",
  "nameAr": "كاكاو خام",
  "brand": "",
  "emoji": "🍫",
  "units": [
   "250 غرام"
  ]
 },
 {
  "id": "hotdrinks_17",
  "categoryId": "hotdrinks",
  "nameAr": "كريمر قهوة",
  "brand": "",
  "emoji": "🥛",
  "units": [
   "400 غرام"
  ]
 },
 {
  "id": "nuts_1",
  "categoryId": "nuts",
  "nameAr": "لوز",
  "brand": "",
  "emoji": "🥜",
  "units": [
   "250 غرام",
   "½ كغم",
   "1 كغم"
  ]
 },
 {
  "id": "nuts_2",
  "categoryId": "nuts",
  "nameAr": "جوز",
  "brand": "",
  "emoji": "🥜",
  "units": [
   "250 غرام",
   "½ كغم",
   "1 كغم"
  ]
 },
 {
  "id": "nuts_3",
  "categoryId": "nuts",
  "nameAr": "كاجو",
  "brand": "",
  "emoji": "🥜",
  "units": [
   "250 غرام",
   "½ كغم",
   "1 كغم"
  ]
 },
 {
  "id": "nuts_4",
  "categoryId": "nuts",
  "nameAr": "فستق حلبي",
  "brand": "",
  "emoji": "🥜",
  "units": [
   "250 غرام",
   "½ كغم",
   "1 كغم"
  ]
 },
 {
  "id": "nuts_5",
  "categoryId": "nuts",
  "nameAr": "بندق",
  "brand": "",
  "emoji": "🥜",
  "units": [
   "250 غرام",
   "½ كغم",
   "1 كغم"
  ]
 },
 {
  "id": "nuts_6",
  "categoryId": "nuts",
  "nameAr": "فول سوداني محمص",
  "brand": "",
  "emoji": "🥜",
  "units": [
   "250 غرام",
   "½ كغم",
   "1 كغم"
  ]
 },
 {
  "id": "nuts_7",
  "categoryId": "nuts",
  "nameAr": "صنوبر",
  "brand": "",
  "emoji": "🥜",
  "units": [
   "250 غرام",
   "½ كغم",
   "1 كغم"
  ]
 },
 {
  "id": "nuts_8",
  "categoryId": "nuts",
  "nameAr": "بذر شمسية محمص",
  "brand": "",
  "emoji": "🥜",
  "units": [
   "250 غرام",
   "½ كغم",
   "1 كغم"
  ]
 },
 {
  "id": "nuts_9",
  "categoryId": "nuts",
  "nameAr": "مكسرات مشكلة",
  "brand": "",
  "emoji": "🥜",
  "units": [
   "250 غرام",
   "½ كغم",
   "1 كغم"
  ]
 },
 {
  "id": "nuts_10",
  "categoryId": "nuts",
  "nameAr": "تين مجفف",
  "brand": "",
  "emoji": "🥜",
  "units": [
   "250 غرام",
   "½ كغم",
   "1 كغم"
  ]
 },
 {
  "id": "nuts_11",
  "categoryId": "nuts",
  "nameAr": "مشمش مجفف",
  "brand": "",
  "emoji": "🥜",
  "units": [
   "250 غرام",
   "½ كغم",
   "1 كغم"
  ]
 },
 {
  "id": "nuts_12",
  "categoryId": "nuts",
  "nameAr": "زبيب",
  "brand": "",
  "emoji": "🥜",
  "units": [
   "250 غرام",
   "½ كغم",
   "1 كغم"
  ]
 },
 {
  "id": "nuts_13",
  "categoryId": "nuts",
  "nameAr": "قراصيا",
  "brand": "",
  "emoji": "🥜",
  "units": [
   "250 غرام",
   "½ كغم",
   "1 كغم"
  ]
 },
 {
  "id": "nuts_14",
  "categoryId": "nuts",
  "nameAr": "تمر عجوة",
  "brand": "",
  "emoji": "🥜",
  "units": [
   "250 غرام",
   "½ كغم",
   "1 كغم"
  ]
 },
 {
  "id": "nuts_15",
  "categoryId": "nuts",
  "nameAr": "تمر مجهول فاخر",
  "brand": "",
  "emoji": "🥜",
  "units": [
   "250 غرام",
   "½ كغم",
   "1 كغم"
  ]
 },
 {
  "id": "spices_1",
  "categoryId": "spices",
  "nameAr": "كمون",
  "brand": "",
  "emoji": "🧂",
  "units": [
   "100 غرام",
   "250 غرام"
  ]
 },
 {
  "id": "spices_2",
  "categoryId": "spices",
  "nameAr": "كركم",
  "brand": "",
  "emoji": "🧂",
  "units": [
   "100 غرام",
   "250 غرام"
  ]
 },
 {
  "id": "spices_3",
  "categoryId": "spices",
  "nameAr": "فلفل أسود",
  "brand": "",
  "emoji": "🧂",
  "units": [
   "100 غرام",
   "250 غرام"
  ]
 },
 {
  "id": "spices_4",
  "categoryId": "spices",
  "nameAr": "فلفل أحمر",
  "brand": "",
  "emoji": "🧂",
  "units": [
   "100 غرام",
   "250 غرام"
  ]
 },
 {
  "id": "spices_5",
  "categoryId": "spices",
  "nameAr": "بهارات مشكلة",
  "brand": "",
  "emoji": "🧂",
  "units": [
   "100 غرام",
   "250 غرام"
  ]
 },
 {
  "id": "spices_6",
  "categoryId": "spices",
  "nameAr": "قرفة",
  "brand": "",
  "emoji": "🧂",
  "units": [
   "100 غرام",
   "250 غرام"
  ]
 },
 {
  "id": "spices_7",
  "categoryId": "spices",
  "nameAr": "هيل",
  "brand": "",
  "emoji": "🧂",
  "units": [
   "100 غرام",
   "250 غرام"
  ]
 },
 {
  "id": "spices_8",
  "categoryId": "spices",
  "nameAr": "قرنفل",
  "brand": "",
  "emoji": "🧂",
  "units": [
   "100 غرام",
   "250 غرام"
  ]
 },
 {
  "id": "spices_9",
  "categoryId": "spices",
  "nameAr": "جوزة الطيب",
  "brand": "",
  "emoji": "🧂",
  "units": [
   "100 غرام",
   "250 غرام"
  ]
 },
 {
  "id": "spices_10",
  "categoryId": "spices",
  "nameAr": "سبع بهارات",
  "brand": "",
  "emoji": "🧂",
  "units": [
   "100 غرام",
   "250 غرام"
  ]
 },
 {
  "id": "spices_11",
  "categoryId": "spices",
  "nameAr": "زعتر بلدي",
  "brand": "",
  "emoji": "🧂",
  "units": [
   "100 غرام",
   "250 غرام"
  ]
 },
 {
  "id": "spices_12",
  "categoryId": "spices",
  "nameAr": "سماق",
  "brand": "",
  "emoji": "🧂",
  "units": [
   "100 غرام",
   "250 غرام"
  ]
 },
 {
  "id": "spices_13",
  "categoryId": "spices",
  "nameAr": "ورق غار",
  "brand": "",
  "emoji": "🧂",
  "units": [
   "100 غرام",
   "250 غرام"
  ]
 },
 {
  "id": "spices_14",
  "categoryId": "spices",
  "nameAr": "زعفران",
  "brand": "",
  "emoji": "🧂",
  "units": [
   "100 غرام",
   "250 غرام"
  ]
 },
 {
  "id": "spices_15",
  "categoryId": "spices",
  "nameAr": "بابريكا",
  "brand": "",
  "emoji": "🧂",
  "units": [
   "100 غرام",
   "250 غرام"
  ]
 },
 {
  "id": "spices_16",
  "categoryId": "spices",
  "nameAr": "ثوم بودرة",
  "brand": "",
  "emoji": "🧂",
  "units": [
   "100 غرام",
   "250 غرام"
  ]
 },
 {
  "id": "spices_17",
  "categoryId": "spices",
  "nameAr": "بصل بودرة",
  "brand": "",
  "emoji": "🧂",
  "units": [
   "100 غرام",
   "250 غرام"
  ]
 },
 {
  "id": "spices_18",
  "categoryId": "spices",
  "nameAr": "مكعبات مرقة",
  "brand": "",
  "emoji": "🧂",
  "units": [
   "100 غرام",
   "250 غرام"
  ]
 },
 {
  "id": "cleaning_1",
  "categoryId": "cleaning",
  "nameAr": "مسحوق غسيل أوتوماتيك",
  "brand": "",
  "emoji": "🧼",
  "units": [
   "3 كغم",
   "5 كغم"
  ]
 },
 {
  "id": "cleaning_2",
  "categoryId": "cleaning",
  "nameAr": "سائل غسيل",
  "brand": "",
  "emoji": "🧴",
  "units": [
   "2 لتر"
  ]
 },
 {
  "id": "cleaning_3",
  "categoryId": "cleaning",
  "nameAr": "منعم ملابس",
  "brand": "",
  "emoji": "🧴",
  "units": [
   "2 لتر"
  ]
 },
 {
  "id": "cleaning_4",
  "categoryId": "cleaning",
  "nameAr": "مبيض كلوركس",
  "brand": "",
  "emoji": "🧴",
  "units": [
   "1 لتر"
  ]
 },
 {
  "id": "cleaning_5",
  "categoryId": "cleaning",
  "nameAr": "سائل جلي",
  "brand": "",
  "emoji": "🧽",
  "units": [
   "1 لتر",
   "4 لتر"
  ]
 },
 {
  "id": "cleaning_6",
  "categoryId": "cleaning",
  "nameAr": "منظف أرضيات",
  "brand": "",
  "emoji": "🧴",
  "units": [
   "2 لتر"
  ]
 },
 {
  "id": "cleaning_7",
  "categoryId": "cleaning",
  "nameAr": "منظف زجاج",
  "brand": "",
  "emoji": "🪟",
  "units": [
   "750 مل"
  ]
 },
 {
  "id": "cleaning_8",
  "categoryId": "cleaning",
  "nameAr": "منظف حمامات",
  "brand": "",
  "emoji": "🚿",
  "units": [
   "750 مل"
  ]
 },
 {
  "id": "cleaning_9",
  "categoryId": "cleaning",
  "nameAr": "منظف مطابخ",
  "brand": "",
  "emoji": "🍽️",
  "units": [
   "750 مل"
  ]
 },
 {
  "id": "cleaning_10",
  "categoryId": "cleaning",
  "nameAr": "معطر جو",
  "brand": "",
  "emoji": "🌸",
  "units": [
   "300 مل"
  ]
 },
 {
  "id": "cleaning_11",
  "categoryId": "cleaning",
  "nameAr": "مبيد حشرات",
  "brand": "",
  "emoji": "🦟",
  "units": [
   "400 مل"
  ]
 },
 {
  "id": "cleaning_12",
  "categoryId": "cleaning",
  "nameAr": "أكياس قمامة كبيرة",
  "brand": "",
  "emoji": "🗑️",
  "units": [
   "50 كيس"
  ]
 },
 {
  "id": "cleaning_13",
  "categoryId": "cleaning",
  "nameAr": "أكياس قمامة صغيرة",
  "brand": "",
  "emoji": "🗑️",
  "units": [
   "50 كيس"
  ]
 },
 {
  "id": "cleaning_14",
  "categoryId": "cleaning",
  "nameAr": "قفازات تنظيف",
  "brand": "",
  "emoji": "🧤",
  "units": [
   "زوج"
  ]
 },
 {
  "id": "cleaning_15",
  "categoryId": "cleaning",
  "nameAr": "إسفنج جلي",
  "brand": "",
  "emoji": "🧽",
  "units": [
   "6 حبات"
  ]
 },
 {
  "id": "cleaning_16",
  "categoryId": "cleaning",
  "nameAr": "ليفة تنظيف",
  "brand": "",
  "emoji": "🧽",
  "units": [
   "3 حبات"
  ]
 },
 {
  "id": "cleaning_17",
  "categoryId": "cleaning",
  "nameAr": "ورق مطبخ",
  "brand": "",
  "emoji": "🧻",
  "units": [
   "4 لفات"
  ]
 },
 {
  "id": "cleaning_18",
  "categoryId": "cleaning",
  "nameAr": "مناديل ورقية",
  "brand": "",
  "emoji": "🧻",
  "units": [
   "5 علب"
  ]
 },
 {
  "id": "cleaning_19",
  "categoryId": "cleaning",
  "nameAr": "مناديل حمام",
  "brand": "",
  "emoji": "🧻",
  "units": [
   "12 لفة"
  ]
 },
 {
  "id": "cleaning_20",
  "categoryId": "cleaning",
  "nameAr": "ورق ألمنيوم",
  "brand": "",
  "emoji": "📦",
  "units": [
   "30 متر"
  ]
 },
 {
  "id": "cleaning_21",
  "categoryId": "cleaning",
  "nameAr": "ورق زبدة",
  "brand": "",
  "emoji": "📦",
  "units": [
   "20 متر"
  ]
 },
 {
  "id": "cleaning_22",
  "categoryId": "cleaning",
  "nameAr": "أكياس حفظ طعام",
  "brand": "",
  "emoji": "📦",
  "units": [
   "50 كيس"
  ]
 },
 {
  "id": "care_1",
  "categoryId": "care",
  "nameAr": "شامبو",
  "brand": "",
  "emoji": "🧴",
  "units": [
   "400 مل"
  ]
 },
 {
  "id": "care_2",
  "categoryId": "care",
  "nameAr": "بلسم شعر",
  "brand": "",
  "emoji": "🧴",
  "units": [
   "400 مل"
  ]
 },
 {
  "id": "care_3",
  "categoryId": "care",
  "nameAr": "صابون استحمام",
  "brand": "",
  "emoji": "🧼",
  "units": [
   "4 قطع"
  ]
 },
 {
  "id": "care_4",
  "categoryId": "care",
  "nameAr": "جل استحمام",
  "brand": "",
  "emoji": "🧴",
  "units": [
   "500 مل"
  ]
 },
 {
  "id": "care_5",
  "categoryId": "care",
  "nameAr": "صابون سائل لليدين",
  "brand": "",
  "emoji": "🧼",
  "units": [
   "500 مل"
  ]
 },
 {
  "id": "care_6",
  "categoryId": "care",
  "nameAr": "معجون أسنان",
  "brand": "",
  "emoji": "🪥",
  "units": [
   "100 مل"
  ]
 },
 {
  "id": "care_7",
  "categoryId": "care",
  "nameAr": "فرشاة أسنان",
  "brand": "",
  "emoji": "🪥",
  "units": [
   "حبة"
  ]
 },
 {
  "id": "care_8",
  "categoryId": "care",
  "nameAr": "غسول فم",
  "brand": "",
  "emoji": "🪥",
  "units": [
   "500 مل"
  ]
 },
 {
  "id": "care_9",
  "categoryId": "care",
  "nameAr": "مزيل عرق",
  "brand": "",
  "emoji": "🧴",
  "units": [
   "150 مل"
  ]
 },
 {
  "id": "care_10",
  "categoryId": "care",
  "nameAr": "كريم مرطب",
  "brand": "",
  "emoji": "🧴",
  "units": [
   "200 مل"
  ]
 },
 {
  "id": "care_11",
  "categoryId": "care",
  "nameAr": "كريم حلاقة",
  "brand": "",
  "emoji": "🪒",
  "units": [
   "200 مل"
  ]
 },
 {
  "id": "care_12",
  "categoryId": "care",
  "nameAr": "شفرات حلاقة",
  "brand": "",
  "emoji": "🪒",
  "units": [
   "5 حبات"
  ]
 },
 {
  "id": "care_13",
  "categoryId": "care",
  "nameAr": "مناشف ورقية مبللة",
  "brand": "",
  "emoji": "🧻",
  "units": [
   "72 منديل"
  ]
 },
 {
  "id": "care_14",
  "categoryId": "care",
  "nameAr": "فوط نسائية",
  "brand": "",
  "emoji": "🌸",
  "units": [
   "10 قطع"
  ]
 },
 {
  "id": "care_15",
  "categoryId": "care",
  "nameAr": "قطن طبي",
  "brand": "",
  "emoji": "☁️",
  "units": [
   "100 غرام"
  ]
 },
 {
  "id": "care_16",
  "categoryId": "care",
  "nameAr": "عيدان تنظيف أذن",
  "brand": "",
  "emoji": "👂",
  "units": [
   "100 عود"
  ]
 },
 {
  "id": "care_17",
  "categoryId": "care",
  "nameAr": "مقص أظافر",
  "brand": "",
  "emoji": "✂️",
  "units": [
   "حبة"
  ]
 },
 {
  "id": "care_18",
  "categoryId": "care",
  "nameAr": "مشط شعر",
  "brand": "",
  "emoji": "💇",
  "units": [
   "حبة"
  ]
 },
 {
  "id": "care_19",
  "categoryId": "care",
  "nameAr": "جل شعر",
  "brand": "",
  "emoji": "💇",
  "units": [
   "250 مل"
  ]
 },
 {
  "id": "care_20",
  "categoryId": "care",
  "nameAr": "عطر جسم",
  "brand": "",
  "emoji": "🌸",
  "units": [
   "200 مل"
  ]
 },
 {
  "id": "baby_1",
  "categoryId": "baby",
  "nameAr": "حفاضات مقاس 1",
  "brand": "",
  "emoji": "🍼",
  "units": [
   "عبوة"
  ]
 },
 {
  "id": "baby_2",
  "categoryId": "baby",
  "nameAr": "حفاضات مقاس 2",
  "brand": "",
  "emoji": "🍼",
  "units": [
   "عبوة"
  ]
 },
 {
  "id": "baby_3",
  "categoryId": "baby",
  "nameAr": "حفاضات مقاس 3",
  "brand": "",
  "emoji": "🍼",
  "units": [
   "عبوة"
  ]
 },
 {
  "id": "baby_4",
  "categoryId": "baby",
  "nameAr": "حفاضات مقاس 4",
  "brand": "",
  "emoji": "🍼",
  "units": [
   "عبوة"
  ]
 },
 {
  "id": "baby_5",
  "categoryId": "baby",
  "nameAr": "حفاضات مقاس 5",
  "brand": "",
  "emoji": "🍼",
  "units": [
   "عبوة"
  ]
 },
 {
  "id": "baby_6",
  "categoryId": "baby",
  "nameAr": "مناديل أطفال مبللة",
  "brand": "",
  "emoji": "🧻",
  "units": [
   "72 منديل"
  ]
 },
 {
  "id": "baby_7",
  "categoryId": "baby",
  "nameAr": "حليب أطفال مرحلة 1",
  "brand": "",
  "emoji": "🍼",
  "units": [
   "400 غرام"
  ]
 },
 {
  "id": "baby_8",
  "categoryId": "baby",
  "nameAr": "حليب أطفال مرحلة 2",
  "brand": "",
  "emoji": "🍼",
  "units": [
   "400 غرام"
  ]
 },
 {
  "id": "baby_9",
  "categoryId": "baby",
  "nameAr": "حليب أطفال مرحلة 3",
  "brand": "",
  "emoji": "🍼",
  "units": [
   "400 غرام"
  ]
 },
 {
  "id": "baby_10",
  "categoryId": "baby",
  "nameAr": "سيريلاك أرز",
  "brand": "",
  "emoji": "🥣",
  "units": [
   "400 غرام"
  ]
 },
 {
  "id": "baby_11",
  "categoryId": "baby",
  "nameAr": "سيريلاك قمح",
  "brand": "",
  "emoji": "🥣",
  "units": [
   "400 غرام"
  ]
 },
 {
  "id": "baby_12",
  "categoryId": "baby",
  "nameAr": "بيوريه فواكه للأطفال",
  "brand": "",
  "emoji": "🍎",
  "units": [
   "حبة"
  ]
 },
 {
  "id": "baby_13",
  "categoryId": "baby",
  "nameAr": "شامبو أطفال",
  "brand": "",
  "emoji": "🧴",
  "units": [
   "400 مل"
  ]
 },
 {
  "id": "baby_14",
  "categoryId": "baby",
  "nameAr": "كريم تسلخات",
  "brand": "",
  "emoji": "🧴",
  "units": [
   "100 مل"
  ]
 },
 {
  "id": "baby_15",
  "categoryId": "baby",
  "nameAr": "زجاجة رضاعة",
  "brand": "",
  "emoji": "🍼",
  "units": [
   "حبة"
  ]
 },
 {
  "id": "baby_16",
  "categoryId": "baby",
  "nameAr": "مصاصة أطفال",
  "brand": "",
  "emoji": "🍼",
  "units": [
   "حبة"
  ]
 },
 {
  "id": "baby_17",
  "categoryId": "baby",
  "nameAr": "بسكويت أطفال",
  "brand": "",
  "emoji": "🍪",
  "units": [
   "180 غرام"
  ]
 },
 {
  "id": "household_1",
  "categoryId": "household",
  "nameAr": "أطباق ورقية",
  "brand": "",
  "emoji": "🍽️",
  "units": [
   "25 حبة"
  ]
 },
 {
  "id": "household_2",
  "categoryId": "household",
  "nameAr": "أكواب ورقية",
  "brand": "",
  "emoji": "🥤",
  "units": [
   "50 حبة"
  ]
 },
 {
  "id": "household_3",
  "categoryId": "household",
  "nameAr": "ملاعق بلاستيك",
  "brand": "",
  "emoji": "🥄",
  "units": [
   "50 حبة"
  ]
 },
 {
  "id": "household_4",
  "categoryId": "household",
  "nameAr": "شوك بلاستيك",
  "brand": "",
  "emoji": "🍴",
  "units": [
   "50 حبة"
  ]
 },
 {
  "id": "household_5",
  "categoryId": "household",
  "nameAr": "سكاكين بلاستيك",
  "brand": "",
  "emoji": "🔪",
  "units": [
   "50 حبة"
  ]
 },
 {
  "id": "household_6",
  "categoryId": "household",
  "nameAr": "مفارش طاولة",
  "brand": "",
  "emoji": "🍽️",
  "units": [
   "10 حبات"
  ]
 },
 {
  "id": "household_7",
  "categoryId": "household",
  "nameAr": "شموع",
  "brand": "",
  "emoji": "🕯️",
  "units": [
   "6 حبات"
  ]
 },
 {
  "id": "household_8",
  "categoryId": "household",
  "nameAr": "ولاعة",
  "brand": "",
  "emoji": "🔥",
  "units": [
   "حبة"
  ]
 },
 {
  "id": "household_9",
  "categoryId": "household",
  "nameAr": "فحم شواء",
  "brand": "",
  "emoji": "🔥",
  "units": [
   "3 كغم"
  ]
 },
 {
  "id": "household_10",
  "categoryId": "household",
  "nameAr": "أعواد أسنان",
  "brand": "",
  "emoji": "🦷",
  "units": [
   "علبة"
  ]
 },
 {
  "id": "household_11",
  "categoryId": "household",
  "nameAr": "بطاريات AA",
  "brand": "",
  "emoji": "🔋",
  "units": [
   "4 حبات"
  ]
 },
 {
  "id": "household_12",
  "categoryId": "household",
  "nameAr": "بطاريات AAA",
  "brand": "",
  "emoji": "🔋",
  "units": [
   "4 حبات"
  ]
 },
 {
  "id": "household_13",
  "categoryId": "household",
  "nameAr": "لمبة LED",
  "brand": "",
  "emoji": "💡",
  "units": [
   "حبة"
  ]
 },
 {
  "id": "household_14",
  "categoryId": "household",
  "nameAr": "حبل غسيل",
  "brand": "",
  "emoji": "🧵",
  "units": [
   "10 متر"
  ]
 },
 {
  "id": "household_15",
  "categoryId": "household",
  "nameAr": "ملاقط غسيل",
  "brand": "",
  "emoji": "📎",
  "units": [
   "24 حبة"
  ]
 }
];

module.exports = { MART_CATEGORIES, MART_SUGGESTIONS };
