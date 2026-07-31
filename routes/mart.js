const express = require('express');
const router = express.Router();

// أقسام زادنا مارت
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

// كتالوج زادنا مارت — 439 منتج فريد (كل منتج قد يحتوي عدة أحجام)
const defaultMartProducts = [
 {
  "id": "dairy_1",
  "categoryId": "dairy",
  "nameAr": "حليب الجنيدي كامل الدسم",
  "brand": "الجنيدي",
  "emoji": "🥛",
  "unitAr": "1 لتر",
  "price": 7.5,
  "marketPrice": 7.5,
  "sizes": [
   {
    "unitAr": "½ لتر",
    "price": 4.1
   },
   {
    "unitAr": "1 لتر",
    "price": 7.5
   },
   {
    "unitAr": "2 لتر",
    "price": 14.2
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "dairy_2",
  "categoryId": "dairy",
  "nameAr": "حليب الجنيدي قليل الدسم",
  "brand": "الجنيدي",
  "emoji": "🥛",
  "unitAr": "1 لتر",
  "price": 7.0,
  "marketPrice": 7.0,
  "sizes": [
   {
    "unitAr": "½ لتر",
    "price": 3.9
   },
   {
    "unitAr": "1 لتر",
    "price": 7.0
   },
   {
    "unitAr": "2 لتر",
    "price": 13.3
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "dairy_3",
  "categoryId": "dairy",
  "nameAr": "حليب الجنيدي خالي الدسم",
  "brand": "الجنيدي",
  "emoji": "🥛",
  "unitAr": "1 لتر",
  "price": 7.0,
  "marketPrice": 7.0,
  "sizes": [
   {
    "unitAr": "½ لتر",
    "price": 3.9
   },
   {
    "unitAr": "1 لتر",
    "price": 7.0
   },
   {
    "unitAr": "2 لتر",
    "price": 13.3
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "dairy_4",
  "categoryId": "dairy",
  "nameAr": "حليب الريان كامل الدسم",
  "brand": "الريان",
  "emoji": "🥛",
  "unitAr": "1 لتر",
  "price": 7.5,
  "marketPrice": 7.5,
  "sizes": [
   {
    "unitAr": "½ لتر",
    "price": 4.1
   },
   {
    "unitAr": "1 لتر",
    "price": 7.5
   },
   {
    "unitAr": "2 لتر",
    "price": 14.2
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "dairy_5",
  "categoryId": "dairy",
  "nameAr": "حليب الريان قليل الدسم",
  "brand": "الريان",
  "emoji": "🥛",
  "unitAr": "1 لتر",
  "price": 7.0,
  "marketPrice": 7.0,
  "sizes": [
   {
    "unitAr": "½ لتر",
    "price": 3.9
   },
   {
    "unitAr": "1 لتر",
    "price": 7.0
   },
   {
    "unitAr": "2 لتر",
    "price": 13.3
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "dairy_6",
  "categoryId": "dairy",
  "nameAr": "حليب الريان خالي الدسم",
  "brand": "الريان",
  "emoji": "🥛",
  "unitAr": "1 لتر",
  "price": 7.0,
  "marketPrice": 7.0,
  "sizes": [
   {
    "unitAr": "½ لتر",
    "price": 3.9
   },
   {
    "unitAr": "1 لتر",
    "price": 7.0
   },
   {
    "unitAr": "2 لتر",
    "price": 13.3
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "dairy_7",
  "categoryId": "dairy",
  "nameAr": "حليب طنوس كامل الدسم",
  "brand": "طنوس",
  "emoji": "🥛",
  "unitAr": "1 لتر",
  "price": 8.0,
  "marketPrice": 8.0,
  "sizes": [
   {
    "unitAr": "½ لتر",
    "price": 4.4
   },
   {
    "unitAr": "1 لتر",
    "price": 8.0
   },
   {
    "unitAr": "2 لتر",
    "price": 15.2
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "dairy_8",
  "categoryId": "dairy",
  "nameAr": "حليب طنوس قليل الدسم",
  "brand": "طنوس",
  "emoji": "🥛",
  "unitAr": "1 لتر",
  "price": 7.5,
  "marketPrice": 7.5,
  "sizes": [
   {
    "unitAr": "½ لتر",
    "price": 4.1
   },
   {
    "unitAr": "1 لتر",
    "price": 7.5
   },
   {
    "unitAr": "2 لتر",
    "price": 14.2
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "dairy_9",
  "categoryId": "dairy",
  "nameAr": "حليب طنوس خالي الدسم",
  "brand": "طنوس",
  "emoji": "🥛",
  "unitAr": "1 لتر",
  "price": 7.5,
  "marketPrice": 7.5,
  "sizes": [
   {
    "unitAr": "½ لتر",
    "price": 4.1
   },
   {
    "unitAr": "1 لتر",
    "price": 7.5
   },
   {
    "unitAr": "2 لتر",
    "price": 14.2
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "dairy_10",
  "categoryId": "dairy",
  "nameAr": "حليب تنوفا كامل الدسم",
  "brand": "تنوفا",
  "emoji": "🥛",
  "unitAr": "1 لتر",
  "price": 9.0,
  "marketPrice": 9.0,
  "sizes": [
   {
    "unitAr": "½ لتر",
    "price": 5.0
   },
   {
    "unitAr": "1 لتر",
    "price": 9.0
   },
   {
    "unitAr": "2 لتر",
    "price": 17.1
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "dairy_11",
  "categoryId": "dairy",
  "nameAr": "حليب تنوفا قليل الدسم",
  "brand": "تنوفا",
  "emoji": "🥛",
  "unitAr": "1 لتر",
  "price": 8.5,
  "marketPrice": 8.5,
  "sizes": [
   {
    "unitAr": "½ لتر",
    "price": 4.7
   },
   {
    "unitAr": "1 لتر",
    "price": 8.5
   },
   {
    "unitAr": "2 لتر",
    "price": 16.1
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "dairy_12",
  "categoryId": "dairy",
  "nameAr": "حليب تنوفا خالي الدسم",
  "brand": "تنوفا",
  "emoji": "🥛",
  "unitAr": "1 لتر",
  "price": 8.5,
  "marketPrice": 8.5,
  "sizes": [
   {
    "unitAr": "½ لتر",
    "price": 4.7
   },
   {
    "unitAr": "1 لتر",
    "price": 8.5
   },
   {
    "unitAr": "2 لتر",
    "price": 16.1
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "dairy_13",
  "categoryId": "dairy",
  "nameAr": "حليب المراعي كامل الدسم",
  "brand": "المراعي",
  "emoji": "🥛",
  "unitAr": "1 لتر",
  "price": 9.5,
  "marketPrice": 9.5,
  "sizes": [
   {
    "unitAr": "½ لتر",
    "price": 5.2
   },
   {
    "unitAr": "1 لتر",
    "price": 9.5
   },
   {
    "unitAr": "2 لتر",
    "price": 18.1
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "dairy_14",
  "categoryId": "dairy",
  "nameAr": "حليب المراعي قليل الدسم",
  "brand": "المراعي",
  "emoji": "🥛",
  "unitAr": "1 لتر",
  "price": 9.0,
  "marketPrice": 9.0,
  "sizes": [
   {
    "unitAr": "½ لتر",
    "price": 5.0
   },
   {
    "unitAr": "1 لتر",
    "price": 9.0
   },
   {
    "unitAr": "2 لتر",
    "price": 17.1
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "dairy_15",
  "categoryId": "dairy",
  "nameAr": "حليب المراعي خالي الدسم",
  "brand": "المراعي",
  "emoji": "🥛",
  "unitAr": "1 لتر",
  "price": 9.0,
  "marketPrice": 9.0,
  "sizes": [
   {
    "unitAr": "½ لتر",
    "price": 5.0
   },
   {
    "unitAr": "1 لتر",
    "price": 9.0
   },
   {
    "unitAr": "2 لتر",
    "price": 17.1
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "dairy_16",
  "categoryId": "dairy",
  "nameAr": "لبن رائب الجنيدي",
  "brand": "الجنيدي",
  "emoji": "🥣",
  "unitAr": "1 كغم",
  "price": 8.5,
  "marketPrice": 8.5,
  "sizes": [
   {
    "unitAr": "½ كغم",
    "price": 5.0
   },
   {
    "unitAr": "1 كغم",
    "price": 8.5
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "dairy_17",
  "categoryId": "dairy",
  "nameAr": "لبنة الجنيدي",
  "brand": "الجنيدي",
  "emoji": "🥣",
  "unitAr": "250 غرام",
  "price": 6.5,
  "marketPrice": 6.5,
  "sizes": [
   {
    "unitAr": "250 غرام",
    "price": 6.5
   },
   {
    "unitAr": "500 غرام",
    "price": 11.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "dairy_18",
  "categoryId": "dairy",
  "nameAr": "لبنة بلدي الجنيدي",
  "brand": "الجنيدي",
  "emoji": "🥣",
  "unitAr": "1 كغم",
  "price": 22.0,
  "marketPrice": 22.0,
  "sizes": [
   {
    "unitAr": "1 كغم",
    "price": 22.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "dairy_19",
  "categoryId": "dairy",
  "nameAr": "قشطة الجنيدي",
  "brand": "الجنيدي",
  "emoji": "🥣",
  "unitAr": "250 غرام",
  "price": 9.5,
  "marketPrice": 9.5,
  "sizes": [
   {
    "unitAr": "250 غرام",
    "price": 9.5
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "dairy_20",
  "categoryId": "dairy",
  "nameAr": "جبنة بيضاء الجنيدي",
  "brand": "الجنيدي",
  "emoji": "🧀",
  "unitAr": "500 غرام",
  "price": 16.0,
  "marketPrice": 16.0,
  "sizes": [
   {
    "unitAr": "500 غرام",
    "price": 16.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "dairy_21",
  "categoryId": "dairy",
  "nameAr": "جبنة نابلسية الجنيدي",
  "brand": "الجنيدي",
  "emoji": "🧀",
  "unitAr": "1 كغم",
  "price": 35.0,
  "marketPrice": 35.0,
  "sizes": [
   {
    "unitAr": "1 كغم",
    "price": 35.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "dairy_22",
  "categoryId": "dairy",
  "nameAr": "جبنة عكاوي الجنيدي",
  "brand": "الجنيدي",
  "emoji": "🧀",
  "unitAr": "500 غرام",
  "price": 18.0,
  "marketPrice": 18.0,
  "sizes": [
   {
    "unitAr": "500 غرام",
    "price": 18.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "dairy_23",
  "categoryId": "dairy",
  "nameAr": "شنينة الجنيدي",
  "brand": "الجنيدي",
  "emoji": "🥛",
  "unitAr": "1 لتر",
  "price": 6.0,
  "marketPrice": 6.0,
  "sizes": [
   {
    "unitAr": "1 لتر",
    "price": 6.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "dairy_24",
  "categoryId": "dairy",
  "nameAr": "أيران الجنيدي",
  "brand": "الجنيدي",
  "emoji": "🥛",
  "unitAr": "250 مل",
  "price": 2.5,
  "marketPrice": 2.5,
  "sizes": [
   {
    "unitAr": "250 مل",
    "price": 2.5
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "dairy_25",
  "categoryId": "dairy",
  "nameAr": "لبن رائب حمودة",
  "brand": "حمودة",
  "emoji": "🥣",
  "unitAr": "1 كغم",
  "price": 8.5,
  "marketPrice": 8.5,
  "sizes": [
   {
    "unitAr": "½ كغم",
    "price": 5.0
   },
   {
    "unitAr": "1 كغم",
    "price": 8.5
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "dairy_26",
  "categoryId": "dairy",
  "nameAr": "لبنة حمودة",
  "brand": "حمودة",
  "emoji": "🥣",
  "unitAr": "250 غرام",
  "price": 6.5,
  "marketPrice": 6.5,
  "sizes": [
   {
    "unitAr": "250 غرام",
    "price": 6.5
   },
   {
    "unitAr": "500 غرام",
    "price": 11.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "dairy_27",
  "categoryId": "dairy",
  "nameAr": "لبنة بلدي حمودة",
  "brand": "حمودة",
  "emoji": "🥣",
  "unitAr": "1 كغم",
  "price": 22.0,
  "marketPrice": 22.0,
  "sizes": [
   {
    "unitAr": "1 كغم",
    "price": 22.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "dairy_28",
  "categoryId": "dairy",
  "nameAr": "قشطة حمودة",
  "brand": "حمودة",
  "emoji": "🥣",
  "unitAr": "250 غرام",
  "price": 9.5,
  "marketPrice": 9.5,
  "sizes": [
   {
    "unitAr": "250 غرام",
    "price": 9.5
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "dairy_29",
  "categoryId": "dairy",
  "nameAr": "جبنة بيضاء حمودة",
  "brand": "حمودة",
  "emoji": "🧀",
  "unitAr": "500 غرام",
  "price": 16.0,
  "marketPrice": 16.0,
  "sizes": [
   {
    "unitAr": "500 غرام",
    "price": 16.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "dairy_30",
  "categoryId": "dairy",
  "nameAr": "جبنة نابلسية حمودة",
  "brand": "حمودة",
  "emoji": "🧀",
  "unitAr": "1 كغم",
  "price": 35.0,
  "marketPrice": 35.0,
  "sizes": [
   {
    "unitAr": "1 كغم",
    "price": 35.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "dairy_31",
  "categoryId": "dairy",
  "nameAr": "جبنة عكاوي حمودة",
  "brand": "حمودة",
  "emoji": "🧀",
  "unitAr": "500 غرام",
  "price": 18.0,
  "marketPrice": 18.0,
  "sizes": [
   {
    "unitAr": "500 غرام",
    "price": 18.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "dairy_32",
  "categoryId": "dairy",
  "nameAr": "شنينة حمودة",
  "brand": "حمودة",
  "emoji": "🥛",
  "unitAr": "1 لتر",
  "price": 6.0,
  "marketPrice": 6.0,
  "sizes": [
   {
    "unitAr": "1 لتر",
    "price": 6.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "dairy_33",
  "categoryId": "dairy",
  "nameAr": "أيران حمودة",
  "brand": "حمودة",
  "emoji": "🥛",
  "unitAr": "250 مل",
  "price": 2.5,
  "marketPrice": 2.5,
  "sizes": [
   {
    "unitAr": "250 مل",
    "price": 2.5
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "dairy_34",
  "categoryId": "dairy",
  "nameAr": "لبن رائب الريان",
  "brand": "الريان",
  "emoji": "🥣",
  "unitAr": "1 كغم",
  "price": 8.5,
  "marketPrice": 8.5,
  "sizes": [
   {
    "unitAr": "½ كغم",
    "price": 5.0
   },
   {
    "unitAr": "1 كغم",
    "price": 8.5
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "dairy_35",
  "categoryId": "dairy",
  "nameAr": "لبنة الريان",
  "brand": "الريان",
  "emoji": "🥣",
  "unitAr": "250 غرام",
  "price": 6.5,
  "marketPrice": 6.5,
  "sizes": [
   {
    "unitAr": "250 غرام",
    "price": 6.5
   },
   {
    "unitAr": "500 غرام",
    "price": 11.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "dairy_36",
  "categoryId": "dairy",
  "nameAr": "لبنة بلدي الريان",
  "brand": "الريان",
  "emoji": "🥣",
  "unitAr": "1 كغم",
  "price": 22.0,
  "marketPrice": 22.0,
  "sizes": [
   {
    "unitAr": "1 كغم",
    "price": 22.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "dairy_37",
  "categoryId": "dairy",
  "nameAr": "قشطة الريان",
  "brand": "الريان",
  "emoji": "🥣",
  "unitAr": "250 غرام",
  "price": 9.5,
  "marketPrice": 9.5,
  "sizes": [
   {
    "unitAr": "250 غرام",
    "price": 9.5
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "dairy_38",
  "categoryId": "dairy",
  "nameAr": "جبنة بيضاء الريان",
  "brand": "الريان",
  "emoji": "🧀",
  "unitAr": "500 غرام",
  "price": 16.0,
  "marketPrice": 16.0,
  "sizes": [
   {
    "unitAr": "500 غرام",
    "price": 16.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "dairy_39",
  "categoryId": "dairy",
  "nameAr": "جبنة نابلسية الريان",
  "brand": "الريان",
  "emoji": "🧀",
  "unitAr": "1 كغم",
  "price": 35.0,
  "marketPrice": 35.0,
  "sizes": [
   {
    "unitAr": "1 كغم",
    "price": 35.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "dairy_40",
  "categoryId": "dairy",
  "nameAr": "جبنة عكاوي الريان",
  "brand": "الريان",
  "emoji": "🧀",
  "unitAr": "500 غرام",
  "price": 18.0,
  "marketPrice": 18.0,
  "sizes": [
   {
    "unitAr": "500 غرام",
    "price": 18.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "dairy_41",
  "categoryId": "dairy",
  "nameAr": "شنينة الريان",
  "brand": "الريان",
  "emoji": "🥛",
  "unitAr": "1 لتر",
  "price": 6.0,
  "marketPrice": 6.0,
  "sizes": [
   {
    "unitAr": "1 لتر",
    "price": 6.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "dairy_42",
  "categoryId": "dairy",
  "nameAr": "أيران الريان",
  "brand": "الريان",
  "emoji": "🥛",
  "unitAr": "250 مل",
  "price": 2.5,
  "marketPrice": 2.5,
  "sizes": [
   {
    "unitAr": "250 مل",
    "price": 2.5
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "dairy_43",
  "categoryId": "dairy",
  "nameAr": "لبن رائب طنوس",
  "brand": "طنوس",
  "emoji": "🥣",
  "unitAr": "1 كغم",
  "price": 8.5,
  "marketPrice": 8.5,
  "sizes": [
   {
    "unitAr": "½ كغم",
    "price": 5.0
   },
   {
    "unitAr": "1 كغم",
    "price": 8.5
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "dairy_44",
  "categoryId": "dairy",
  "nameAr": "لبنة طنوس",
  "brand": "طنوس",
  "emoji": "🥣",
  "unitAr": "250 غرام",
  "price": 6.5,
  "marketPrice": 6.5,
  "sizes": [
   {
    "unitAr": "250 غرام",
    "price": 6.5
   },
   {
    "unitAr": "500 غرام",
    "price": 11.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "dairy_45",
  "categoryId": "dairy",
  "nameAr": "لبنة بلدي طنوس",
  "brand": "طنوس",
  "emoji": "🥣",
  "unitAr": "1 كغم",
  "price": 22.0,
  "marketPrice": 22.0,
  "sizes": [
   {
    "unitAr": "1 كغم",
    "price": 22.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "dairy_46",
  "categoryId": "dairy",
  "nameAr": "قشطة طنوس",
  "brand": "طنوس",
  "emoji": "🥣",
  "unitAr": "250 غرام",
  "price": 9.5,
  "marketPrice": 9.5,
  "sizes": [
   {
    "unitAr": "250 غرام",
    "price": 9.5
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "dairy_47",
  "categoryId": "dairy",
  "nameAr": "جبنة بيضاء طنوس",
  "brand": "طنوس",
  "emoji": "🧀",
  "unitAr": "500 غرام",
  "price": 16.0,
  "marketPrice": 16.0,
  "sizes": [
   {
    "unitAr": "500 غرام",
    "price": 16.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "dairy_48",
  "categoryId": "dairy",
  "nameAr": "جبنة نابلسية طنوس",
  "brand": "طنوس",
  "emoji": "🧀",
  "unitAr": "1 كغم",
  "price": 35.0,
  "marketPrice": 35.0,
  "sizes": [
   {
    "unitAr": "1 كغم",
    "price": 35.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "dairy_49",
  "categoryId": "dairy",
  "nameAr": "جبنة عكاوي طنوس",
  "brand": "طنوس",
  "emoji": "🧀",
  "unitAr": "500 غرام",
  "price": 18.0,
  "marketPrice": 18.0,
  "sizes": [
   {
    "unitAr": "500 غرام",
    "price": 18.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "dairy_50",
  "categoryId": "dairy",
  "nameAr": "شنينة طنوس",
  "brand": "طنوس",
  "emoji": "🥛",
  "unitAr": "1 لتر",
  "price": 6.0,
  "marketPrice": 6.0,
  "sizes": [
   {
    "unitAr": "1 لتر",
    "price": 6.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "dairy_51",
  "categoryId": "dairy",
  "nameAr": "أيران طنوس",
  "brand": "طنوس",
  "emoji": "🥛",
  "unitAr": "250 مل",
  "price": 2.5,
  "marketPrice": 2.5,
  "sizes": [
   {
    "unitAr": "250 مل",
    "price": 2.5
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "dairy_52",
  "categoryId": "dairy",
  "nameAr": "جبنة كشكوان طوبا",
  "brand": "",
  "emoji": "🧀",
  "unitAr": "500 غرام",
  "price": 24.0,
  "marketPrice": 24.0,
  "sizes": [
   {
    "unitAr": "500 غرام",
    "price": 24.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "dairy_53",
  "categoryId": "dairy",
  "nameAr": "جبنة حلوم",
  "brand": "",
  "emoji": "🧀",
  "unitAr": "250 غرام",
  "price": 14.0,
  "marketPrice": 14.0,
  "sizes": [
   {
    "unitAr": "250 غرام",
    "price": 14.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "dairy_54",
  "categoryId": "dairy",
  "nameAr": "جبنة موزاريلا مبشورة",
  "brand": "",
  "emoji": "🧀",
  "unitAr": "400 غرام",
  "price": 18.0,
  "marketPrice": 18.0,
  "sizes": [
   {
    "unitAr": "400 غرام",
    "price": 18.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "dairy_55",
  "categoryId": "dairy",
  "nameAr": "جبنة شيدر شرائح",
  "brand": "",
  "emoji": "🧀",
  "unitAr": "200 غرام",
  "price": 13.0,
  "marketPrice": 13.0,
  "sizes": [
   {
    "unitAr": "200 غرام",
    "price": 13.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "dairy_56",
  "categoryId": "dairy",
  "nameAr": "جبنة كريمة",
  "brand": "",
  "emoji": "🧀",
  "unitAr": "200 غرام",
  "price": 11.0,
  "marketPrice": 11.0,
  "sizes": [
   {
    "unitAr": "200 غرام",
    "price": 11.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "dairy_57",
  "categoryId": "dairy",
  "nameAr": "جبنة مثلثات",
  "brand": "",
  "emoji": "🧀",
  "unitAr": "8 قطع",
  "price": 7.0,
  "marketPrice": 7.0,
  "sizes": [
   {
    "unitAr": "8 قطع",
    "price": 7.0
   },
   {
    "unitAr": "24 قطعة",
    "price": 16.5
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "dairy_58",
  "categoryId": "dairy",
  "nameAr": "جبنة كاسات كرافت",
  "brand": "",
  "emoji": "🧀",
  "unitAr": "480 غرام",
  "price": 19.0,
  "marketPrice": 19.0,
  "sizes": [
   {
    "unitAr": "480 غرام",
    "price": 19.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "dairy_59",
  "categoryId": "dairy",
  "nameAr": "زبدة",
  "brand": "",
  "emoji": "🧈",
  "unitAr": "200 غرام",
  "price": 12.5,
  "marketPrice": 12.5,
  "sizes": [
   {
    "unitAr": "200 غرام",
    "price": 12.5
   },
   {
    "unitAr": "500 غرام",
    "price": 28.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "dairy_60",
  "categoryId": "dairy",
  "nameAr": "سمنة بلدية",
  "brand": "",
  "emoji": "🧈",
  "unitAr": "1 كغم",
  "price": 45.0,
  "marketPrice": 45.0,
  "sizes": [
   {
    "unitAr": "1 كغم",
    "price": 45.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "dairy_61",
  "categoryId": "dairy",
  "nameAr": "كريمة طبخ",
  "brand": "",
  "emoji": "🥛",
  "unitAr": "500 مل",
  "price": 14.5,
  "marketPrice": 14.5,
  "sizes": [
   {
    "unitAr": "500 مل",
    "price": 14.5
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "dairy_62",
  "categoryId": "dairy",
  "nameAr": "كريمة خفق",
  "brand": "",
  "emoji": "🥛",
  "unitAr": "250 مل",
  "price": 9.0,
  "marketPrice": 9.0,
  "sizes": [
   {
    "unitAr": "250 مل",
    "price": 9.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "dairy_63",
  "categoryId": "dairy",
  "nameAr": "بيض بلدي",
  "brand": "",
  "emoji": "🥚",
  "unitAr": "30 حبة",
  "price": 28.0,
  "marketPrice": 28.0,
  "sizes": [
   {
    "unitAr": "30 حبة",
    "price": 28.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "dairy_64",
  "categoryId": "dairy",
  "nameAr": "بيض",
  "brand": "",
  "emoji": "🥚",
  "unitAr": "6 حبات",
  "price": 7.0,
  "marketPrice": 7.0,
  "sizes": [
   {
    "unitAr": "6 حبات",
    "price": 7.0
   },
   {
    "unitAr": "12 حبة",
    "price": 13.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "dairy_65",
  "categoryId": "dairy",
  "nameAr": "زبادي بالفواكه",
  "brand": "",
  "emoji": "🥣",
  "unitAr": "4 عبوات",
  "price": 10.0,
  "marketPrice": 10.0,
  "sizes": [
   {
    "unitAr": "4 عبوات",
    "price": 10.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "dairy_66",
  "categoryId": "dairy",
  "nameAr": "زبادي يوناني",
  "brand": "",
  "emoji": "🥣",
  "unitAr": "500 غرام",
  "price": 13.0,
  "marketPrice": 13.0,
  "sizes": [
   {
    "unitAr": "500 غرام",
    "price": 13.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "dairy_67",
  "categoryId": "dairy",
  "nameAr": "لبنة مخلوطة بالزيت",
  "brand": "",
  "emoji": "🥣",
  "unitAr": "800 غرام",
  "price": 26.0,
  "marketPrice": 26.0,
  "sizes": [
   {
    "unitAr": "800 غرام",
    "price": 26.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "dairy_68",
  "categoryId": "dairy",
  "nameAr": "جبنة نابلسية مقلية",
  "brand": "",
  "emoji": "🧀",
  "unitAr": "500 غرام",
  "price": 22.0,
  "marketPrice": 22.0,
  "sizes": [
   {
    "unitAr": "500 غرام",
    "price": 22.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "bakery_1",
  "categoryId": "bakery",
  "nameAr": "خبز عربي كبير",
  "brand": "",
  "emoji": "🫓",
  "unitAr": "6 أرغفة",
  "price": 4.0,
  "marketPrice": 4.0,
  "sizes": [
   {
    "unitAr": "6 أرغفة",
    "price": 4.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "bakery_2",
  "categoryId": "bakery",
  "nameAr": "خبز عربي صغير",
  "brand": "",
  "emoji": "🫓",
  "unitAr": "10 أرغفة",
  "price": 4.0,
  "marketPrice": 4.0,
  "sizes": [
   {
    "unitAr": "10 أرغفة",
    "price": 4.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "bakery_3",
  "categoryId": "bakery",
  "nameAr": "خبز صاج",
  "brand": "",
  "emoji": "🫓",
  "unitAr": "5 أرغفة",
  "price": 6.0,
  "marketPrice": 6.0,
  "sizes": [
   {
    "unitAr": "5 أرغفة",
    "price": 6.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "bakery_4",
  "categoryId": "bakery",
  "nameAr": "خبز طابون",
  "brand": "",
  "emoji": "🫓",
  "unitAr": "4 أرغفة",
  "price": 7.0,
  "marketPrice": 7.0,
  "sizes": [
   {
    "unitAr": "4 أرغفة",
    "price": 7.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "bakery_5",
  "categoryId": "bakery",
  "nameAr": "خبز توست أبيض",
  "brand": "",
  "emoji": "🍞",
  "unitAr": "700 غرام",
  "price": 8.0,
  "marketPrice": 8.0,
  "sizes": [
   {
    "unitAr": "700 غرام",
    "price": 8.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "bakery_6",
  "categoryId": "bakery",
  "nameAr": "خبز توست أسمر",
  "brand": "",
  "emoji": "🍞",
  "unitAr": "700 غرام",
  "price": 9.0,
  "marketPrice": 9.0,
  "sizes": [
   {
    "unitAr": "700 غرام",
    "price": 9.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "bakery_7",
  "categoryId": "bakery",
  "nameAr": "خبز برجر",
  "brand": "",
  "emoji": "🍔",
  "unitAr": "6 حبات",
  "price": 8.0,
  "marketPrice": 8.0,
  "sizes": [
   {
    "unitAr": "6 حبات",
    "price": 8.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "bakery_8",
  "categoryId": "bakery",
  "nameAr": "خبز هوت دوغ",
  "brand": "",
  "emoji": "🌭",
  "unitAr": "6 حبات",
  "price": 8.0,
  "marketPrice": 8.0,
  "sizes": [
   {
    "unitAr": "6 حبات",
    "price": 8.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "bakery_9",
  "categoryId": "bakery",
  "nameAr": "كعك بسمسم",
  "brand": "",
  "emoji": "🥯",
  "unitAr": "5 حبات",
  "price": 10.0,
  "marketPrice": 10.0,
  "sizes": [
   {
    "unitAr": "5 حبات",
    "price": 10.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "bakery_10",
  "categoryId": "bakery",
  "nameAr": "كرواسون سادة",
  "brand": "",
  "emoji": "🥐",
  "unitAr": "4 حبات",
  "price": 12.0,
  "marketPrice": 12.0,
  "sizes": [
   {
    "unitAr": "4 حبات",
    "price": 12.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "bakery_11",
  "categoryId": "bakery",
  "nameAr": "كرواسون شوكولاتة",
  "brand": "",
  "emoji": "🥐",
  "unitAr": "4 حبات",
  "price": 14.0,
  "marketPrice": 14.0,
  "sizes": [
   {
    "unitAr": "4 حبات",
    "price": 14.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "bakery_12",
  "categoryId": "bakery",
  "nameAr": "كرواسون جبنة",
  "brand": "",
  "emoji": "🥐",
  "unitAr": "4 حبات",
  "price": 14.0,
  "marketPrice": 14.0,
  "sizes": [
   {
    "unitAr": "4 حبات",
    "price": 14.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "bakery_13",
  "categoryId": "bakery",
  "nameAr": "فطائر زعتر",
  "brand": "",
  "emoji": "🥧",
  "unitAr": "6 حبات",
  "price": 12.0,
  "marketPrice": 12.0,
  "sizes": [
   {
    "unitAr": "6 حبات",
    "price": 12.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "bakery_14",
  "categoryId": "bakery",
  "nameAr": "فطائر جبنة",
  "brand": "",
  "emoji": "🥧",
  "unitAr": "6 حبات",
  "price": 15.0,
  "marketPrice": 15.0,
  "sizes": [
   {
    "unitAr": "6 حبات",
    "price": 15.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "bakery_15",
  "categoryId": "bakery",
  "nameAr": "فطائر سبانخ",
  "brand": "",
  "emoji": "🥧",
  "unitAr": "6 حبات",
  "price": 14.0,
  "marketPrice": 14.0,
  "sizes": [
   {
    "unitAr": "6 حبات",
    "price": 14.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "bakery_16",
  "categoryId": "bakery",
  "nameAr": "صفيحة لحمة",
  "brand": "",
  "emoji": "🥧",
  "unitAr": "6 حبات",
  "price": 20.0,
  "marketPrice": 20.0,
  "sizes": [
   {
    "unitAr": "6 حبات",
    "price": 20.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "bakery_17",
  "categoryId": "bakery",
  "nameAr": "مناقيش زعتر",
  "brand": "",
  "emoji": "🥧",
  "unitAr": "1 حبة",
  "price": 3.0,
  "marketPrice": 3.0,
  "sizes": [
   {
    "unitAr": "1 حبة",
    "price": 3.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "bakery_18",
  "categoryId": "bakery",
  "nameAr": "بيتزا صغيرة",
  "brand": "",
  "emoji": "🍕",
  "unitAr": "1 حبة",
  "price": 8.0,
  "marketPrice": 8.0,
  "sizes": [
   {
    "unitAr": "1 حبة",
    "price": 8.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "bakery_19",
  "categoryId": "bakery",
  "nameAr": "كيك اسفنجي",
  "brand": "",
  "emoji": "🍰",
  "unitAr": "500 غرام",
  "price": 18.0,
  "marketPrice": 18.0,
  "sizes": [
   {
    "unitAr": "500 غرام",
    "price": 18.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "bakery_20",
  "categoryId": "bakery",
  "nameAr": "كيك بالشوكولاتة",
  "brand": "",
  "emoji": "🍰",
  "unitAr": "500 غرام",
  "price": 22.0,
  "marketPrice": 22.0,
  "sizes": [
   {
    "unitAr": "500 غرام",
    "price": 22.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "bakery_21",
  "categoryId": "bakery",
  "nameAr": "دونات محشي",
  "brand": "",
  "emoji": "🍩",
  "unitAr": "6 حبات",
  "price": 16.0,
  "marketPrice": 16.0,
  "sizes": [
   {
    "unitAr": "6 حبات",
    "price": 16.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "bakery_22",
  "categoryId": "bakery",
  "nameAr": "بقسماط",
  "brand": "",
  "emoji": "🍞",
  "unitAr": "400 غرام",
  "price": 7.0,
  "marketPrice": 7.0,
  "sizes": [
   {
    "unitAr": "400 غرام",
    "price": 7.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "bakery_23",
  "categoryId": "bakery",
  "nameAr": "خبز بيتا أسمر",
  "brand": "",
  "emoji": "🫓",
  "unitAr": "6 أرغفة",
  "price": 5.0,
  "marketPrice": 5.0,
  "sizes": [
   {
    "unitAr": "6 أرغفة",
    "price": 5.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "bakery_24",
  "categoryId": "bakery",
  "nameAr": "معمول بالتمر",
  "brand": "",
  "emoji": "🍪",
  "unitAr": "500 غرام",
  "price": 25.0,
  "marketPrice": 25.0,
  "sizes": [
   {
    "unitAr": "500 غرام",
    "price": 25.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "bakery_25",
  "categoryId": "bakery",
  "nameAr": "معمول بالجوز",
  "brand": "",
  "emoji": "🍪",
  "unitAr": "500 غرام",
  "price": 35.0,
  "marketPrice": 35.0,
  "sizes": [
   {
    "unitAr": "500 غرام",
    "price": 35.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "bakery_26",
  "categoryId": "bakery",
  "nameAr": "بقلاوة بالجوز",
  "brand": "",
  "emoji": "🍯",
  "unitAr": "½ كغم",
  "price": 30.0,
  "marketPrice": 30.0,
  "sizes": [
   {
    "unitAr": "½ كغم",
    "price": 30.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "bakery_27",
  "categoryId": "bakery",
  "nameAr": "بقلاوة بالفستق",
  "brand": "",
  "emoji": "🍯",
  "unitAr": "½ كغم",
  "price": 50.0,
  "marketPrice": 50.0,
  "sizes": [
   {
    "unitAr": "½ كغم",
    "price": 50.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "bakery_28",
  "categoryId": "bakery",
  "nameAr": "كنافة نابلسية ناعمة",
  "brand": "",
  "emoji": "🍮",
  "unitAr": "1 كغم",
  "price": 40.0,
  "marketPrice": 40.0,
  "sizes": [
   {
    "unitAr": "1 كغم",
    "price": 40.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "bakery_29",
  "categoryId": "bakery",
  "nameAr": "كنافة خشنة",
  "brand": "",
  "emoji": "🍮",
  "unitAr": "1 كغم",
  "price": 38.0,
  "marketPrice": 38.0,
  "sizes": [
   {
    "unitAr": "1 كغم",
    "price": 38.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "bakery_30",
  "categoryId": "bakery",
  "nameAr": "بسبوسة",
  "brand": "",
  "emoji": "🍰",
  "unitAr": "500 غرام",
  "price": 18.0,
  "marketPrice": 18.0,
  "sizes": [
   {
    "unitAr": "500 غرام",
    "price": 18.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "produce_1",
  "categoryId": "produce",
  "nameAr": "بندورة",
  "brand": "",
  "emoji": "🍅",
  "unitAr": "1 كغم",
  "price": 4.0,
  "marketPrice": 4.0,
  "sizes": [
   {
    "unitAr": "½ كغم",
    "price": 2.2
   },
   {
    "unitAr": "1 كغم",
    "price": 4.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "produce_2",
  "categoryId": "produce",
  "nameAr": "خيار",
  "brand": "",
  "emoji": "🥒",
  "unitAr": "1 كغم",
  "price": 4.0,
  "marketPrice": 4.0,
  "sizes": [
   {
    "unitAr": "½ كغم",
    "price": 2.2
   },
   {
    "unitAr": "1 كغم",
    "price": 4.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "produce_3",
  "categoryId": "produce",
  "nameAr": "بطاطا",
  "brand": "",
  "emoji": "🥔",
  "unitAr": "1 كغم",
  "price": 3.5,
  "marketPrice": 3.5,
  "sizes": [
   {
    "unitAr": "½ كغم",
    "price": 1.9
   },
   {
    "unitAr": "1 كغم",
    "price": 3.5
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "produce_4",
  "categoryId": "produce",
  "nameAr": "بصل",
  "brand": "",
  "emoji": "🧅",
  "unitAr": "1 كغم",
  "price": 3.0,
  "marketPrice": 3.0,
  "sizes": [
   {
    "unitAr": "½ كغم",
    "price": 1.7
   },
   {
    "unitAr": "1 كغم",
    "price": 3.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "produce_5",
  "categoryId": "produce",
  "nameAr": "بصل أخضر",
  "brand": "",
  "emoji": "🧅",
  "unitAr": "1 كغم",
  "price": 5.0,
  "marketPrice": 5.0,
  "sizes": [
   {
    "unitAr": "½ كغم",
    "price": 2.8
   },
   {
    "unitAr": "1 كغم",
    "price": 5.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "produce_6",
  "categoryId": "produce",
  "nameAr": "ثوم",
  "brand": "",
  "emoji": "🧄",
  "unitAr": "1 كغم",
  "price": 14.0,
  "marketPrice": 14.0,
  "sizes": [
   {
    "unitAr": "½ كغم",
    "price": 7.7
   },
   {
    "unitAr": "1 كغم",
    "price": 14.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "produce_7",
  "categoryId": "produce",
  "nameAr": "جزر",
  "brand": "",
  "emoji": "🥕",
  "unitAr": "1 كغم",
  "price": 4.0,
  "marketPrice": 4.0,
  "sizes": [
   {
    "unitAr": "½ كغم",
    "price": 2.2
   },
   {
    "unitAr": "1 كغم",
    "price": 4.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "produce_8",
  "categoryId": "produce",
  "nameAr": "كوسا",
  "brand": "",
  "emoji": "🥒",
  "unitAr": "1 كغم",
  "price": 5.0,
  "marketPrice": 5.0,
  "sizes": [
   {
    "unitAr": "½ كغم",
    "price": 2.8
   },
   {
    "unitAr": "1 كغم",
    "price": 5.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "produce_9",
  "categoryId": "produce",
  "nameAr": "باذنجان",
  "brand": "",
  "emoji": "🍆",
  "unitAr": "1 كغم",
  "price": 4.5,
  "marketPrice": 4.5,
  "sizes": [
   {
    "unitAr": "½ كغم",
    "price": 2.5
   },
   {
    "unitAr": "1 كغم",
    "price": 4.5
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "produce_10",
  "categoryId": "produce",
  "nameAr": "فلفل أخضر",
  "brand": "",
  "emoji": "🫑",
  "unitAr": "1 كغم",
  "price": 6.0,
  "marketPrice": 6.0,
  "sizes": [
   {
    "unitAr": "½ كغم",
    "price": 3.3
   },
   {
    "unitAr": "1 كغم",
    "price": 6.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "produce_11",
  "categoryId": "produce",
  "nameAr": "فلفل ملون",
  "brand": "",
  "emoji": "🫑",
  "unitAr": "1 كغم",
  "price": 9.0,
  "marketPrice": 9.0,
  "sizes": [
   {
    "unitAr": "½ كغم",
    "price": 5.0
   },
   {
    "unitAr": "1 كغم",
    "price": 9.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "produce_12",
  "categoryId": "produce",
  "nameAr": "فلفل حار",
  "brand": "",
  "emoji": "🌶️",
  "unitAr": "1 كغم",
  "price": 8.0,
  "marketPrice": 8.0,
  "sizes": [
   {
    "unitAr": "½ كغم",
    "price": 4.4
   },
   {
    "unitAr": "1 كغم",
    "price": 8.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "produce_13",
  "categoryId": "produce",
  "nameAr": "ملفوف",
  "brand": "",
  "emoji": "🥬",
  "unitAr": "1 كغم",
  "price": 4.0,
  "marketPrice": 4.0,
  "sizes": [
   {
    "unitAr": "½ كغم",
    "price": 2.2
   },
   {
    "unitAr": "1 كغم",
    "price": 4.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "produce_14",
  "categoryId": "produce",
  "nameAr": "زهرة",
  "brand": "",
  "emoji": "🥦",
  "unitAr": "1 كغم",
  "price": 5.0,
  "marketPrice": 5.0,
  "sizes": [
   {
    "unitAr": "½ كغم",
    "price": 2.8
   },
   {
    "unitAr": "1 كغم",
    "price": 5.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "produce_15",
  "categoryId": "produce",
  "nameAr": "بروكلي",
  "brand": "",
  "emoji": "🥦",
  "unitAr": "1 كغم",
  "price": 9.0,
  "marketPrice": 9.0,
  "sizes": [
   {
    "unitAr": "½ كغم",
    "price": 5.0
   },
   {
    "unitAr": "1 كغم",
    "price": 9.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "produce_16",
  "categoryId": "produce",
  "nameAr": "خس",
  "brand": "",
  "emoji": "🥬",
  "unitAr": "1 كغم",
  "price": 4.0,
  "marketPrice": 4.0,
  "sizes": [
   {
    "unitAr": "½ كغم",
    "price": 2.2
   },
   {
    "unitAr": "1 كغم",
    "price": 4.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "produce_17",
  "categoryId": "produce",
  "nameAr": "سبانخ",
  "brand": "",
  "emoji": "🥬",
  "unitAr": "1 كغم",
  "price": 6.0,
  "marketPrice": 6.0,
  "sizes": [
   {
    "unitAr": "½ كغم",
    "price": 3.3
   },
   {
    "unitAr": "1 كغم",
    "price": 6.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "produce_18",
  "categoryId": "produce",
  "nameAr": "ملوخية",
  "brand": "",
  "emoji": "🥬",
  "unitAr": "1 كغم",
  "price": 7.0,
  "marketPrice": 7.0,
  "sizes": [
   {
    "unitAr": "½ كغم",
    "price": 3.9
   },
   {
    "unitAr": "1 كغم",
    "price": 7.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "produce_19",
  "categoryId": "produce",
  "nameAr": "بقدونس",
  "brand": "",
  "emoji": "🌿",
  "unitAr": "1 كغم",
  "price": 2.0,
  "marketPrice": 2.0,
  "sizes": [
   {
    "unitAr": "½ كغم",
    "price": 1.1
   },
   {
    "unitAr": "1 كغم",
    "price": 2.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "produce_20",
  "categoryId": "produce",
  "nameAr": "نعناع",
  "brand": "",
  "emoji": "🌿",
  "unitAr": "1 كغم",
  "price": 2.0,
  "marketPrice": 2.0,
  "sizes": [
   {
    "unitAr": "½ كغم",
    "price": 1.1
   },
   {
    "unitAr": "1 كغم",
    "price": 2.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "produce_21",
  "categoryId": "produce",
  "nameAr": "كزبرة",
  "brand": "",
  "emoji": "🌿",
  "unitAr": "1 كغم",
  "price": 2.0,
  "marketPrice": 2.0,
  "sizes": [
   {
    "unitAr": "½ كغم",
    "price": 1.1
   },
   {
    "unitAr": "1 كغم",
    "price": 2.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "produce_22",
  "categoryId": "produce",
  "nameAr": "جرجير",
  "brand": "",
  "emoji": "🌿",
  "unitAr": "1 كغم",
  "price": 3.0,
  "marketPrice": 3.0,
  "sizes": [
   {
    "unitAr": "½ كغم",
    "price": 1.7
   },
   {
    "unitAr": "1 كغم",
    "price": 3.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "produce_23",
  "categoryId": "produce",
  "nameAr": "شمندر",
  "brand": "",
  "emoji": "🥬",
  "unitAr": "1 كغم",
  "price": 5.0,
  "marketPrice": 5.0,
  "sizes": [
   {
    "unitAr": "½ كغم",
    "price": 2.8
   },
   {
    "unitAr": "1 كغم",
    "price": 5.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "produce_24",
  "categoryId": "produce",
  "nameAr": "لفت",
  "brand": "",
  "emoji": "🥬",
  "unitAr": "1 كغم",
  "price": 4.0,
  "marketPrice": 4.0,
  "sizes": [
   {
    "unitAr": "½ كغم",
    "price": 2.2
   },
   {
    "unitAr": "1 كغم",
    "price": 4.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "produce_25",
  "categoryId": "produce",
  "nameAr": "فاصولياء خضراء",
  "brand": "",
  "emoji": "🫘",
  "unitAr": "1 كغم",
  "price": 10.0,
  "marketPrice": 10.0,
  "sizes": [
   {
    "unitAr": "½ كغم",
    "price": 5.5
   },
   {
    "unitAr": "1 كغم",
    "price": 10.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "produce_26",
  "categoryId": "produce",
  "nameAr": "بامية",
  "brand": "",
  "emoji": "🥬",
  "unitAr": "1 كغم",
  "price": 14.0,
  "marketPrice": 14.0,
  "sizes": [
   {
    "unitAr": "½ كغم",
    "price": 7.7
   },
   {
    "unitAr": "1 كغم",
    "price": 14.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "produce_27",
  "categoryId": "produce",
  "nameAr": "فقوس",
  "brand": "",
  "emoji": "🥒",
  "unitAr": "1 كغم",
  "price": 5.0,
  "marketPrice": 5.0,
  "sizes": [
   {
    "unitAr": "½ كغم",
    "price": 2.8
   },
   {
    "unitAr": "1 كغم",
    "price": 5.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "produce_28",
  "categoryId": "produce",
  "nameAr": "قرع",
  "brand": "",
  "emoji": "🎃",
  "unitAr": "1 كغم",
  "price": 4.0,
  "marketPrice": 4.0,
  "sizes": [
   {
    "unitAr": "½ كغم",
    "price": 2.2
   },
   {
    "unitAr": "1 كغم",
    "price": 4.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "produce_29",
  "categoryId": "produce",
  "nameAr": "ذرة",
  "brand": "",
  "emoji": "🌽",
  "unitAr": "1 كغم",
  "price": 6.0,
  "marketPrice": 6.0,
  "sizes": [
   {
    "unitAr": "½ كغم",
    "price": 3.3
   },
   {
    "unitAr": "1 كغم",
    "price": 6.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "produce_30",
  "categoryId": "produce",
  "nameAr": "فطر",
  "brand": "",
  "emoji": "🍄",
  "unitAr": "1 كغم",
  "price": 14.0,
  "marketPrice": 14.0,
  "sizes": [
   {
    "unitAr": "½ كغم",
    "price": 7.7
   },
   {
    "unitAr": "1 كغم",
    "price": 14.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "produce_31",
  "categoryId": "produce",
  "nameAr": "زنجبيل طازج",
  "brand": "",
  "emoji": "🫚",
  "unitAr": "1 كغم",
  "price": 18.0,
  "marketPrice": 18.0,
  "sizes": [
   {
    "unitAr": "½ كغم",
    "price": 9.9
   },
   {
    "unitAr": "1 كغم",
    "price": 18.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "produce_32",
  "categoryId": "produce",
  "nameAr": "تفاح أحمر",
  "brand": "",
  "emoji": "🍎",
  "unitAr": "1 كغم",
  "price": 8.0,
  "marketPrice": 8.0,
  "sizes": [
   {
    "unitAr": "½ كغم",
    "price": 4.4
   },
   {
    "unitAr": "1 كغم",
    "price": 8.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "produce_33",
  "categoryId": "produce",
  "nameAr": "تفاح أخضر",
  "brand": "",
  "emoji": "🍏",
  "unitAr": "1 كغم",
  "price": 9.0,
  "marketPrice": 9.0,
  "sizes": [
   {
    "unitAr": "½ كغم",
    "price": 5.0
   },
   {
    "unitAr": "1 كغم",
    "price": 9.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "produce_34",
  "categoryId": "produce",
  "nameAr": "موز",
  "brand": "",
  "emoji": "🍌",
  "unitAr": "1 كغم",
  "price": 8.0,
  "marketPrice": 8.0,
  "sizes": [
   {
    "unitAr": "½ كغم",
    "price": 4.4
   },
   {
    "unitAr": "1 كغم",
    "price": 8.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "produce_35",
  "categoryId": "produce",
  "nameAr": "برتقال",
  "brand": "",
  "emoji": "🍊",
  "unitAr": "1 كغم",
  "price": 5.0,
  "marketPrice": 5.0,
  "sizes": [
   {
    "unitAr": "½ كغم",
    "price": 2.8
   },
   {
    "unitAr": "1 كغم",
    "price": 5.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "produce_36",
  "categoryId": "produce",
  "nameAr": "ليمون",
  "brand": "",
  "emoji": "🍋",
  "unitAr": "1 كغم",
  "price": 7.0,
  "marketPrice": 7.0,
  "sizes": [
   {
    "unitAr": "½ كغم",
    "price": 3.9
   },
   {
    "unitAr": "1 كغم",
    "price": 7.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "produce_37",
  "categoryId": "produce",
  "nameAr": "كلمنتينا",
  "brand": "",
  "emoji": "🍊",
  "unitAr": "1 كغم",
  "price": 6.0,
  "marketPrice": 6.0,
  "sizes": [
   {
    "unitAr": "½ كغم",
    "price": 3.3
   },
   {
    "unitAr": "1 كغم",
    "price": 6.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "produce_38",
  "categoryId": "produce",
  "nameAr": "عنب",
  "brand": "",
  "emoji": "🍇",
  "unitAr": "1 كغم",
  "price": 10.0,
  "marketPrice": 10.0,
  "sizes": [
   {
    "unitAr": "½ كغم",
    "price": 5.5
   },
   {
    "unitAr": "1 كغم",
    "price": 10.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "produce_39",
  "categoryId": "produce",
  "nameAr": "بطيخ",
  "brand": "",
  "emoji": "🍉",
  "unitAr": "1 كغم",
  "price": 3.0,
  "marketPrice": 3.0,
  "sizes": [
   {
    "unitAr": "½ كغم",
    "price": 1.7
   },
   {
    "unitAr": "1 كغم",
    "price": 3.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "produce_40",
  "categoryId": "produce",
  "nameAr": "شمام",
  "brand": "",
  "emoji": "🍈",
  "unitAr": "1 كغم",
  "price": 5.0,
  "marketPrice": 5.0,
  "sizes": [
   {
    "unitAr": "½ كغم",
    "price": 2.8
   },
   {
    "unitAr": "1 كغم",
    "price": 5.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "produce_41",
  "categoryId": "produce",
  "nameAr": "خوخ",
  "brand": "",
  "emoji": "🍑",
  "unitAr": "1 كغم",
  "price": 10.0,
  "marketPrice": 10.0,
  "sizes": [
   {
    "unitAr": "½ كغم",
    "price": 5.5
   },
   {
    "unitAr": "1 كغم",
    "price": 10.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "produce_42",
  "categoryId": "produce",
  "nameAr": "مشمش",
  "brand": "",
  "emoji": "🍑",
  "unitAr": "1 كغم",
  "price": 12.0,
  "marketPrice": 12.0,
  "sizes": [
   {
    "unitAr": "½ كغم",
    "price": 6.6
   },
   {
    "unitAr": "1 كغم",
    "price": 12.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "produce_43",
  "categoryId": "produce",
  "nameAr": "تين",
  "brand": "",
  "emoji": "🫐",
  "unitAr": "1 كغم",
  "price": 15.0,
  "marketPrice": 15.0,
  "sizes": [
   {
    "unitAr": "½ كغم",
    "price": 8.2
   },
   {
    "unitAr": "1 كغم",
    "price": 15.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "produce_44",
  "categoryId": "produce",
  "nameAr": "رمان",
  "brand": "",
  "emoji": "🍎",
  "unitAr": "1 كغم",
  "price": 9.0,
  "marketPrice": 9.0,
  "sizes": [
   {
    "unitAr": "½ كغم",
    "price": 5.0
   },
   {
    "unitAr": "1 كغم",
    "price": 9.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "produce_45",
  "categoryId": "produce",
  "nameAr": "كمثرى",
  "brand": "",
  "emoji": "🍐",
  "unitAr": "1 كغم",
  "price": 10.0,
  "marketPrice": 10.0,
  "sizes": [
   {
    "unitAr": "½ كغم",
    "price": 5.5
   },
   {
    "unitAr": "1 كغم",
    "price": 10.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "produce_46",
  "categoryId": "produce",
  "nameAr": "فراولة",
  "brand": "",
  "emoji": "🍓",
  "unitAr": "1 كغم",
  "price": 14.0,
  "marketPrice": 14.0,
  "sizes": [
   {
    "unitAr": "½ كغم",
    "price": 7.7
   },
   {
    "unitAr": "1 كغم",
    "price": 14.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "produce_47",
  "categoryId": "produce",
  "nameAr": "كيوي",
  "brand": "",
  "emoji": "🥝",
  "unitAr": "1 كغم",
  "price": 14.0,
  "marketPrice": 14.0,
  "sizes": [
   {
    "unitAr": "½ كغم",
    "price": 7.7
   },
   {
    "unitAr": "1 كغم",
    "price": 14.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "produce_48",
  "categoryId": "produce",
  "nameAr": "أناناس",
  "brand": "",
  "emoji": "🍍",
  "unitAr": "1 كغم",
  "price": 12.0,
  "marketPrice": 12.0,
  "sizes": [
   {
    "unitAr": "½ كغم",
    "price": 6.6
   },
   {
    "unitAr": "1 كغم",
    "price": 12.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "produce_49",
  "categoryId": "produce",
  "nameAr": "مانجا",
  "brand": "",
  "emoji": "🥭",
  "unitAr": "1 كغم",
  "price": 16.0,
  "marketPrice": 16.0,
  "sizes": [
   {
    "unitAr": "½ كغم",
    "price": 8.8
   },
   {
    "unitAr": "1 كغم",
    "price": 16.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "produce_50",
  "categoryId": "produce",
  "nameAr": "أفوكادو",
  "brand": "",
  "emoji": "🥑",
  "unitAr": "1 كغم",
  "price": 18.0,
  "marketPrice": 18.0,
  "sizes": [
   {
    "unitAr": "½ كغم",
    "price": 9.9
   },
   {
    "unitAr": "1 كغم",
    "price": 18.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "produce_51",
  "categoryId": "produce",
  "nameAr": "تمر مجهول",
  "brand": "",
  "emoji": "🌴",
  "unitAr": "1 كغم",
  "price": 45.0,
  "marketPrice": 45.0,
  "sizes": [
   {
    "unitAr": "½ كغم",
    "price": 24.8
   },
   {
    "unitAr": "1 كغم",
    "price": 45.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "produce_52",
  "categoryId": "produce",
  "nameAr": "جوافة",
  "brand": "",
  "emoji": "🍐",
  "unitAr": "1 كغم",
  "price": 10.0,
  "marketPrice": 10.0,
  "sizes": [
   {
    "unitAr": "½ كغم",
    "price": 5.5
   },
   {
    "unitAr": "1 كغم",
    "price": 10.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "produce_53",
  "categoryId": "produce",
  "nameAr": "سفرجل",
  "brand": "",
  "emoji": "🍏",
  "unitAr": "1 كغم",
  "price": 12.0,
  "marketPrice": 12.0,
  "sizes": [
   {
    "unitAr": "½ كغم",
    "price": 6.6
   },
   {
    "unitAr": "1 كغم",
    "price": 12.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "produce_54",
  "categoryId": "produce",
  "nameAr": "كرز",
  "brand": "",
  "emoji": "🍒",
  "unitAr": "1 كغم",
  "price": 30.0,
  "marketPrice": 30.0,
  "sizes": [
   {
    "unitAr": "½ كغم",
    "price": 16.5
   },
   {
    "unitAr": "1 كغم",
    "price": 30.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "produce_55",
  "categoryId": "produce",
  "nameAr": "توت",
  "brand": "",
  "emoji": "🫐",
  "unitAr": "1 كغم",
  "price": 20.0,
  "marketPrice": 20.0,
  "sizes": [
   {
    "unitAr": "½ كغم",
    "price": 11.0
   },
   {
    "unitAr": "1 كغم",
    "price": 20.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "meat_1",
  "categoryId": "meat",
  "nameAr": "دجاج كامل طازج",
  "brand": "",
  "emoji": "🍗",
  "unitAr": "1 كغم",
  "price": 16.0,
  "marketPrice": 16.0,
  "sizes": [
   {
    "unitAr": "1 كغم",
    "price": 16.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "meat_2",
  "categoryId": "meat",
  "nameAr": "صدور دجاج",
  "brand": "",
  "emoji": "🍗",
  "unitAr": "1 كغم",
  "price": 32.0,
  "marketPrice": 32.0,
  "sizes": [
   {
    "unitAr": "1 كغم",
    "price": 32.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "meat_3",
  "categoryId": "meat",
  "nameAr": "أفخاذ دجاج",
  "brand": "",
  "emoji": "🍗",
  "unitAr": "1 كغم",
  "price": 22.0,
  "marketPrice": 22.0,
  "sizes": [
   {
    "unitAr": "1 كغم",
    "price": 22.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "meat_4",
  "categoryId": "meat",
  "nameAr": "أجنحة دجاج",
  "brand": "",
  "emoji": "🍗",
  "unitAr": "1 كغم",
  "price": 18.0,
  "marketPrice": 18.0,
  "sizes": [
   {
    "unitAr": "1 كغم",
    "price": 18.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "meat_5",
  "categoryId": "meat",
  "nameAr": "شاورما دجاج متبلة",
  "brand": "",
  "emoji": "🍗",
  "unitAr": "1 كغم",
  "price": 38.0,
  "marketPrice": 38.0,
  "sizes": [
   {
    "unitAr": "1 كغم",
    "price": 38.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "meat_6",
  "categoryId": "meat",
  "nameAr": "لحمة بقر مفرومة",
  "brand": "",
  "emoji": "🥩",
  "unitAr": "1 كغم",
  "price": 55.0,
  "marketPrice": 55.0,
  "sizes": [
   {
    "unitAr": "1 كغم",
    "price": 55.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "meat_7",
  "categoryId": "meat",
  "nameAr": "لحمة بقر ستيك",
  "brand": "",
  "emoji": "🥩",
  "unitAr": "1 كغم",
  "price": 75.0,
  "marketPrice": 75.0,
  "sizes": [
   {
    "unitAr": "1 كغم",
    "price": 75.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "meat_8",
  "categoryId": "meat",
  "nameAr": "لحمة غنم",
  "brand": "",
  "emoji": "🥩",
  "unitAr": "1 كغم",
  "price": 90.0,
  "marketPrice": 90.0,
  "sizes": [
   {
    "unitAr": "1 كغم",
    "price": 90.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "meat_9",
  "categoryId": "meat",
  "nameAr": "كباب مشكل",
  "brand": "",
  "emoji": "🍢",
  "unitAr": "1 كغم",
  "price": 60.0,
  "marketPrice": 60.0,
  "sizes": [
   {
    "unitAr": "1 كغم",
    "price": 60.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "meat_10",
  "categoryId": "meat",
  "nameAr": "شقف لحمة",
  "brand": "",
  "emoji": "🥩",
  "unitAr": "1 كغم",
  "price": 70.0,
  "marketPrice": 70.0,
  "sizes": [
   {
    "unitAr": "1 كغم",
    "price": 70.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "meat_11",
  "categoryId": "meat",
  "nameAr": "ريش غنم",
  "brand": "",
  "emoji": "🍖",
  "unitAr": "1 كغم",
  "price": 95.0,
  "marketPrice": 95.0,
  "sizes": [
   {
    "unitAr": "1 كغم",
    "price": 95.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "meat_12",
  "categoryId": "meat",
  "nameAr": "كبدة دجاج",
  "brand": "",
  "emoji": "🍖",
  "unitAr": "½ كغم",
  "price": 12.0,
  "marketPrice": 12.0,
  "sizes": [
   {
    "unitAr": "½ كغم",
    "price": 12.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "meat_13",
  "categoryId": "meat",
  "nameAr": "سمك بلطي",
  "brand": "",
  "emoji": "🐟",
  "unitAr": "1 كغم",
  "price": 35.0,
  "marketPrice": 35.0,
  "sizes": [
   {
    "unitAr": "1 كغم",
    "price": 35.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "meat_14",
  "categoryId": "meat",
  "nameAr": "سمك سلمون",
  "brand": "",
  "emoji": "🐟",
  "unitAr": "1 كغم",
  "price": 120.0,
  "marketPrice": 120.0,
  "sizes": [
   {
    "unitAr": "1 كغم",
    "price": 120.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "meat_15",
  "categoryId": "meat",
  "nameAr": "جمبري",
  "brand": "",
  "emoji": "🦐",
  "unitAr": "½ كغم",
  "price": 45.0,
  "marketPrice": 45.0,
  "sizes": [
   {
    "unitAr": "½ كغم",
    "price": 45.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "meat_16",
  "categoryId": "meat",
  "nameAr": "مرتديلا دجاج",
  "brand": "",
  "emoji": "🥓",
  "unitAr": "250 غرام",
  "price": 12.0,
  "marketPrice": 12.0,
  "sizes": [
   {
    "unitAr": "250 غرام",
    "price": 12.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "meat_17",
  "categoryId": "meat",
  "nameAr": "مرتديلا لحمة",
  "brand": "",
  "emoji": "🥓",
  "unitAr": "250 غرام",
  "price": 15.0,
  "marketPrice": 15.0,
  "sizes": [
   {
    "unitAr": "250 غرام",
    "price": 15.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "meat_18",
  "categoryId": "meat",
  "nameAr": "سجق",
  "brand": "",
  "emoji": "🌭",
  "unitAr": "500 غرام",
  "price": 28.0,
  "marketPrice": 28.0,
  "sizes": [
   {
    "unitAr": "500 غرام",
    "price": 28.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "meat_19",
  "categoryId": "meat",
  "nameAr": "نقانق دجاج",
  "brand": "",
  "emoji": "🌭",
  "unitAr": "400 غرام",
  "price": 18.0,
  "marketPrice": 18.0,
  "sizes": [
   {
    "unitAr": "400 غرام",
    "price": 18.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "meat_20",
  "categoryId": "meat",
  "nameAr": "بسطرمة",
  "brand": "",
  "emoji": "🥓",
  "unitAr": "200 غرام",
  "price": 22.0,
  "marketPrice": 22.0,
  "sizes": [
   {
    "unitAr": "200 غرام",
    "price": 22.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "frozen_1",
  "categoryId": "frozen",
  "nameAr": "بازيلاء مجمدة",
  "brand": "",
  "emoji": "🫛",
  "unitAr": "400 غرام",
  "price": 7.0,
  "marketPrice": 7.0,
  "sizes": [
   {
    "unitAr": "400 غرام",
    "price": 7.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "frozen_2",
  "categoryId": "frozen",
  "nameAr": "خضار مشكلة مجمدة",
  "brand": "",
  "emoji": "🥬",
  "unitAr": "400 غرام",
  "price": 8.0,
  "marketPrice": 8.0,
  "sizes": [
   {
    "unitAr": "400 غرام",
    "price": 8.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "frozen_3",
  "categoryId": "frozen",
  "nameAr": "ذرة مجمدة",
  "brand": "",
  "emoji": "🌽",
  "unitAr": "400 غرام",
  "price": 7.0,
  "marketPrice": 7.0,
  "sizes": [
   {
    "unitAr": "400 غرام",
    "price": 7.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "frozen_4",
  "categoryId": "frozen",
  "nameAr": "سبانخ مجمدة",
  "brand": "",
  "emoji": "🥬",
  "unitAr": "400 غرام",
  "price": 7.0,
  "marketPrice": 7.0,
  "sizes": [
   {
    "unitAr": "400 غرام",
    "price": 7.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "frozen_5",
  "categoryId": "frozen",
  "nameAr": "بامية مجمدة",
  "brand": "",
  "emoji": "🥬",
  "unitAr": "400 غرام",
  "price": 9.0,
  "marketPrice": 9.0,
  "sizes": [
   {
    "unitAr": "400 غرام",
    "price": 9.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "frozen_6",
  "categoryId": "frozen",
  "nameAr": "فاصولياء مجمدة",
  "brand": "",
  "emoji": "🫘",
  "unitAr": "400 غرام",
  "price": 8.0,
  "marketPrice": 8.0,
  "sizes": [
   {
    "unitAr": "400 غرام",
    "price": 8.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "frozen_7",
  "categoryId": "frozen",
  "nameAr": "بطاطا مقلية مجمدة",
  "brand": "",
  "emoji": "🍟",
  "unitAr": "1 كغم",
  "price": 13.0,
  "marketPrice": 13.0,
  "sizes": [
   {
    "unitAr": "1 كغم",
    "price": 13.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "frozen_8",
  "categoryId": "frozen",
  "nameAr": "بطاطا ودجز",
  "brand": "",
  "emoji": "🍟",
  "unitAr": "750 غرام",
  "price": 14.0,
  "marketPrice": 14.0,
  "sizes": [
   {
    "unitAr": "750 غرام",
    "price": 14.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "frozen_9",
  "categoryId": "frozen",
  "nameAr": "شنيتسل دجاج",
  "brand": "",
  "emoji": "🍗",
  "unitAr": "1 كغم",
  "price": 32.0,
  "marketPrice": 32.0,
  "sizes": [
   {
    "unitAr": "1 كغم",
    "price": 32.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "frozen_10",
  "categoryId": "frozen",
  "nameAr": "ناجتس دجاج",
  "brand": "",
  "emoji": "🍗",
  "unitAr": "750 غرام",
  "price": 26.0,
  "marketPrice": 26.0,
  "sizes": [
   {
    "unitAr": "750 غرام",
    "price": 26.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "frozen_11",
  "categoryId": "frozen",
  "nameAr": "برجر لحمة",
  "brand": "",
  "emoji": "🍔",
  "unitAr": "4 قطع",
  "price": 22.0,
  "marketPrice": 22.0,
  "sizes": [
   {
    "unitAr": "4 قطع",
    "price": 22.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "frozen_12",
  "categoryId": "frozen",
  "nameAr": "برجر دجاج",
  "brand": "",
  "emoji": "🍔",
  "unitAr": "4 قطع",
  "price": 18.0,
  "marketPrice": 18.0,
  "sizes": [
   {
    "unitAr": "4 قطع",
    "price": 18.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "frozen_13",
  "categoryId": "frozen",
  "nameAr": "سمبوسك جبنة",
  "brand": "",
  "emoji": "🥟",
  "unitAr": "500 غرام",
  "price": 18.0,
  "marketPrice": 18.0,
  "sizes": [
   {
    "unitAr": "500 غرام",
    "price": 18.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "frozen_14",
  "categoryId": "frozen",
  "nameAr": "سمبوسك لحمة",
  "brand": "",
  "emoji": "🥟",
  "unitAr": "500 غرام",
  "price": 22.0,
  "marketPrice": 22.0,
  "sizes": [
   {
    "unitAr": "500 غرام",
    "price": 22.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "frozen_15",
  "categoryId": "frozen",
  "nameAr": "عجينة سبرينغ رول",
  "brand": "",
  "emoji": "🥟",
  "unitAr": "400 غرام",
  "price": 12.0,
  "marketPrice": 12.0,
  "sizes": [
   {
    "unitAr": "400 غرام",
    "price": 12.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "frozen_16",
  "categoryId": "frozen",
  "nameAr": "بوظة فانيلا",
  "brand": "",
  "emoji": "🍨",
  "unitAr": "1 لتر",
  "price": 16.0,
  "marketPrice": 16.0,
  "sizes": [
   {
    "unitAr": "1 لتر",
    "price": 16.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "frozen_17",
  "categoryId": "frozen",
  "nameAr": "بوظة شوكولاتة",
  "brand": "",
  "emoji": "🍨",
  "unitAr": "1 لتر",
  "price": 16.0,
  "marketPrice": 16.0,
  "sizes": [
   {
    "unitAr": "1 لتر",
    "price": 16.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "frozen_18",
  "categoryId": "frozen",
  "nameAr": "بوظة مشكلة",
  "brand": "",
  "emoji": "🍨",
  "unitAr": "2 لتر",
  "price": 28.0,
  "marketPrice": 28.0,
  "sizes": [
   {
    "unitAr": "2 لتر",
    "price": 28.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "frozen_19",
  "categoryId": "frozen",
  "nameAr": "مثلجات كورنيتو",
  "brand": "",
  "emoji": "🍦",
  "unitAr": "4 حبات",
  "price": 14.0,
  "marketPrice": 14.0,
  "sizes": [
   {
    "unitAr": "4 حبات",
    "price": 14.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "frozen_20",
  "categoryId": "frozen",
  "nameAr": "عجينة بف باستري",
  "brand": "",
  "emoji": "🥐",
  "unitAr": "400 غرام",
  "price": 13.0,
  "marketPrice": 13.0,
  "sizes": [
   {
    "unitAr": "400 غرام",
    "price": 13.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "pantry_1",
  "categoryId": "pantry",
  "nameAr": "أرز بسمتي",
  "brand": "",
  "emoji": "🍚",
  "unitAr": "1 كغم",
  "price": 13.0,
  "marketPrice": 13.0,
  "sizes": [
   {
    "unitAr": "1 كغم",
    "price": 13.0
   },
   {
    "unitAr": "5 كغم",
    "price": 58.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "pantry_2",
  "categoryId": "pantry",
  "nameAr": "أرز مصري",
  "brand": "",
  "emoji": "🍚",
  "unitAr": "1 كغم",
  "price": 8.0,
  "marketPrice": 8.0,
  "sizes": [
   {
    "unitAr": "1 كغم",
    "price": 8.0
   },
   {
    "unitAr": "5 كغم",
    "price": 36.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "pantry_3",
  "categoryId": "pantry",
  "nameAr": "أرز حبة قصيرة",
  "brand": "",
  "emoji": "🍚",
  "unitAr": "1 كغم",
  "price": 9.0,
  "marketPrice": 9.0,
  "sizes": [
   {
    "unitAr": "1 كغم",
    "price": 9.0
   },
   {
    "unitAr": "5 كغم",
    "price": 40.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "pantry_4",
  "categoryId": "pantry",
  "nameAr": "طحين أبيض",
  "brand": "",
  "emoji": "🌾",
  "unitAr": "1 كغم",
  "price": 4.0,
  "marketPrice": 4.0,
  "sizes": [
   {
    "unitAr": "1 كغم",
    "price": 4.0
   },
   {
    "unitAr": "5 كغم",
    "price": 18.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "pantry_5",
  "categoryId": "pantry",
  "nameAr": "طحين أسمر",
  "brand": "",
  "emoji": "🌾",
  "unitAr": "1 كغم",
  "price": 5.0,
  "marketPrice": 5.0,
  "sizes": [
   {
    "unitAr": "1 كغم",
    "price": 5.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "pantry_6",
  "categoryId": "pantry",
  "nameAr": "سكر أبيض",
  "brand": "",
  "emoji": "🍬",
  "unitAr": "1 كغم",
  "price": 5.0,
  "marketPrice": 5.0,
  "sizes": [
   {
    "unitAr": "1 كغم",
    "price": 5.0
   },
   {
    "unitAr": "5 كغم",
    "price": 23.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "pantry_7",
  "categoryId": "pantry",
  "nameAr": "سكر بني",
  "brand": "",
  "emoji": "🍬",
  "unitAr": "1 كغم",
  "price": 9.0,
  "marketPrice": 9.0,
  "sizes": [
   {
    "unitAr": "1 كغم",
    "price": 9.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "pantry_8",
  "categoryId": "pantry",
  "nameAr": "ملح طعام",
  "brand": "",
  "emoji": "🧂",
  "unitAr": "1 كغم",
  "price": 2.0,
  "marketPrice": 2.0,
  "sizes": [
   {
    "unitAr": "1 كغم",
    "price": 2.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "pantry_9",
  "categoryId": "pantry",
  "nameAr": "زيت زيتون بلدي",
  "brand": "",
  "emoji": "🫒",
  "unitAr": "1 لتر",
  "price": 45.0,
  "marketPrice": 45.0,
  "sizes": [
   {
    "unitAr": "1 لتر",
    "price": 45.0
   },
   {
    "unitAr": "3 لتر",
    "price": 130.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "pantry_10",
  "categoryId": "pantry",
  "nameAr": "زيت ذرة",
  "brand": "",
  "emoji": "🫗",
  "unitAr": "1.5 لتر",
  "price": 18.0,
  "marketPrice": 18.0,
  "sizes": [
   {
    "unitAr": "1.5 لتر",
    "price": 18.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "pantry_11",
  "categoryId": "pantry",
  "nameAr": "زيت دوار الشمس",
  "brand": "",
  "emoji": "🫗",
  "unitAr": "1.5 لتر",
  "price": 17.0,
  "marketPrice": 17.0,
  "sizes": [
   {
    "unitAr": "1.5 لتر",
    "price": 17.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "pantry_12",
  "categoryId": "pantry",
  "nameAr": "خل أبيض",
  "brand": "",
  "emoji": "🫗",
  "unitAr": "1 لتر",
  "price": 5.0,
  "marketPrice": 5.0,
  "sizes": [
   {
    "unitAr": "1 لتر",
    "price": 5.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "pantry_13",
  "categoryId": "pantry",
  "nameAr": "خل تفاح",
  "brand": "",
  "emoji": "🫗",
  "unitAr": "500 مل",
  "price": 8.0,
  "marketPrice": 8.0,
  "sizes": [
   {
    "unitAr": "500 مل",
    "price": 8.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "pantry_14",
  "categoryId": "pantry",
  "nameAr": "معكرونة سباغيتي",
  "brand": "",
  "emoji": "🍝",
  "unitAr": "500 غرام",
  "price": 5.0,
  "marketPrice": 5.0,
  "sizes": [
   {
    "unitAr": "500 غرام",
    "price": 5.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "pantry_15",
  "categoryId": "pantry",
  "nameAr": "معكرونة بيني",
  "brand": "",
  "emoji": "🍝",
  "unitAr": "500 غرام",
  "price": 5.0,
  "marketPrice": 5.0,
  "sizes": [
   {
    "unitAr": "500 غرام",
    "price": 5.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "pantry_16",
  "categoryId": "pantry",
  "nameAr": "معكرونة أصابع",
  "brand": "",
  "emoji": "🍝",
  "unitAr": "500 غرام",
  "price": 5.0,
  "marketPrice": 5.0,
  "sizes": [
   {
    "unitAr": "500 غرام",
    "price": 5.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "pantry_17",
  "categoryId": "pantry",
  "nameAr": "شعيرية",
  "brand": "",
  "emoji": "🍝",
  "unitAr": "400 غرام",
  "price": 5.0,
  "marketPrice": 5.0,
  "sizes": [
   {
    "unitAr": "400 غرام",
    "price": 5.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "pantry_18",
  "categoryId": "pantry",
  "nameAr": "نودلز سريع",
  "brand": "",
  "emoji": "🍜",
  "unitAr": "5 عبوات",
  "price": 10.0,
  "marketPrice": 10.0,
  "sizes": [
   {
    "unitAr": "5 عبوات",
    "price": 10.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "pantry_19",
  "categoryId": "pantry",
  "nameAr": "برغل ناعم",
  "brand": "",
  "emoji": "🌾",
  "unitAr": "1 كغم",
  "price": 8.0,
  "marketPrice": 8.0,
  "sizes": [
   {
    "unitAr": "1 كغم",
    "price": 8.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "pantry_20",
  "categoryId": "pantry",
  "nameAr": "برغل خشن",
  "brand": "",
  "emoji": "🌾",
  "unitAr": "1 كغم",
  "price": 8.0,
  "marketPrice": 8.0,
  "sizes": [
   {
    "unitAr": "1 كغم",
    "price": 8.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "pantry_21",
  "categoryId": "pantry",
  "nameAr": "فريكة",
  "brand": "",
  "emoji": "🌾",
  "unitAr": "1 كغم",
  "price": 14.0,
  "marketPrice": 14.0,
  "sizes": [
   {
    "unitAr": "1 كغم",
    "price": 14.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "pantry_22",
  "categoryId": "pantry",
  "nameAr": "مفتول",
  "brand": "",
  "emoji": "🌾",
  "unitAr": "1 كغم",
  "price": 16.0,
  "marketPrice": 16.0,
  "sizes": [
   {
    "unitAr": "1 كغم",
    "price": 16.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "pantry_23",
  "categoryId": "pantry",
  "nameAr": "سميد",
  "brand": "",
  "emoji": "🌾",
  "unitAr": "1 كغم",
  "price": 7.0,
  "marketPrice": 7.0,
  "sizes": [
   {
    "unitAr": "1 كغم",
    "price": 7.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "pantry_24",
  "categoryId": "pantry",
  "nameAr": "نشا الذرة",
  "brand": "",
  "emoji": "🌾",
  "unitAr": "400 غرام",
  "price": 6.0,
  "marketPrice": 6.0,
  "sizes": [
   {
    "unitAr": "400 غرام",
    "price": 6.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "pantry_25",
  "categoryId": "pantry",
  "nameAr": "بيكنغ باودر",
  "brand": "",
  "emoji": "🧁",
  "unitAr": "100 غرام",
  "price": 4.0,
  "marketPrice": 4.0,
  "sizes": [
   {
    "unitAr": "100 غرام",
    "price": 4.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "pantry_26",
  "categoryId": "pantry",
  "nameAr": "خميرة فورية",
  "brand": "",
  "emoji": "🧁",
  "unitAr": "500 غرام",
  "price": 12.0,
  "marketPrice": 12.0,
  "sizes": [
   {
    "unitAr": "500 غرام",
    "price": 12.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "pantry_27",
  "categoryId": "pantry",
  "nameAr": "عدس أحمر",
  "brand": "",
  "emoji": "🫘",
  "unitAr": "1 كغم",
  "price": 12.0,
  "marketPrice": 12.0,
  "sizes": [
   {
    "unitAr": "1 كغم",
    "price": 12.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "pantry_28",
  "categoryId": "pantry",
  "nameAr": "عدس بني",
  "brand": "",
  "emoji": "🫘",
  "unitAr": "1 كغم",
  "price": 11.0,
  "marketPrice": 11.0,
  "sizes": [
   {
    "unitAr": "1 كغم",
    "price": 11.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "pantry_29",
  "categoryId": "pantry",
  "nameAr": "حمص حب",
  "brand": "",
  "emoji": "🫘",
  "unitAr": "1 كغم",
  "price": 10.0,
  "marketPrice": 10.0,
  "sizes": [
   {
    "unitAr": "1 كغم",
    "price": 10.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "pantry_30",
  "categoryId": "pantry",
  "nameAr": "فول مدمس حب",
  "brand": "",
  "emoji": "🫘",
  "unitAr": "1 كغم",
  "price": 9.0,
  "marketPrice": 9.0,
  "sizes": [
   {
    "unitAr": "1 كغم",
    "price": 9.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "pantry_31",
  "categoryId": "pantry",
  "nameAr": "فاصولياء بيضاء",
  "brand": "",
  "emoji": "🫘",
  "unitAr": "1 كغم",
  "price": 13.0,
  "marketPrice": 13.0,
  "sizes": [
   {
    "unitAr": "1 كغم",
    "price": 13.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "pantry_32",
  "categoryId": "pantry",
  "nameAr": "لوبيا",
  "brand": "",
  "emoji": "🫘",
  "unitAr": "1 كغم",
  "price": 14.0,
  "marketPrice": 14.0,
  "sizes": [
   {
    "unitAr": "1 كغم",
    "price": 14.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "pantry_33",
  "categoryId": "pantry",
  "nameAr": "بازيلاء يابسة",
  "brand": "",
  "emoji": "🫘",
  "unitAr": "1 كغم",
  "price": 11.0,
  "marketPrice": 11.0,
  "sizes": [
   {
    "unitAr": "1 كغم",
    "price": 11.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "canned_1",
  "categoryId": "canned",
  "nameAr": "طحينة",
  "brand": "",
  "emoji": "🥣",
  "unitAr": "500 غرام",
  "price": 18.0,
  "marketPrice": 18.0,
  "sizes": [
   {
    "unitAr": "500 غرام",
    "price": 18.0
   },
   {
    "unitAr": "900 غرام",
    "price": 30.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "canned_2",
  "categoryId": "canned",
  "nameAr": "حلاوة سادة",
  "brand": "",
  "emoji": "🍯",
  "unitAr": "500 غرام",
  "price": 20.0,
  "marketPrice": 20.0,
  "sizes": [
   {
    "unitAr": "500 غرام",
    "price": 20.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "canned_3",
  "categoryId": "canned",
  "nameAr": "حلاوة بالفستق",
  "brand": "",
  "emoji": "🍯",
  "unitAr": "500 غرام",
  "price": 28.0,
  "marketPrice": 28.0,
  "sizes": [
   {
    "unitAr": "500 غرام",
    "price": 28.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "canned_4",
  "categoryId": "canned",
  "nameAr": "عسل طبيعي",
  "brand": "",
  "emoji": "🍯",
  "unitAr": "1 كغم",
  "price": 85.0,
  "marketPrice": 85.0,
  "sizes": [
   {
    "unitAr": "500 غرام",
    "price": 45.0
   },
   {
    "unitAr": "1 كغم",
    "price": 85.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "canned_5",
  "categoryId": "canned",
  "nameAr": "دبس رمان",
  "brand": "",
  "emoji": "🫗",
  "unitAr": "500 مل",
  "price": 15.0,
  "marketPrice": 15.0,
  "sizes": [
   {
    "unitAr": "500 مل",
    "price": 15.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "canned_6",
  "categoryId": "canned",
  "nameAr": "دبس عنب",
  "brand": "",
  "emoji": "🫗",
  "unitAr": "500 مل",
  "price": 18.0,
  "marketPrice": 18.0,
  "sizes": [
   {
    "unitAr": "500 مل",
    "price": 18.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "canned_7",
  "categoryId": "canned",
  "nameAr": "مربى مشمش",
  "brand": "",
  "emoji": "🍑",
  "unitAr": "400 غرام",
  "price": 9.0,
  "marketPrice": 9.0,
  "sizes": [
   {
    "unitAr": "400 غرام",
    "price": 9.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "canned_8",
  "categoryId": "canned",
  "nameAr": "مربى فراولة",
  "brand": "",
  "emoji": "🍓",
  "unitAr": "400 غرام",
  "price": 9.0,
  "marketPrice": 9.0,
  "sizes": [
   {
    "unitAr": "400 غرام",
    "price": 9.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "canned_9",
  "categoryId": "canned",
  "nameAr": "مربى تين",
  "brand": "",
  "emoji": "🫐",
  "unitAr": "400 غرام",
  "price": 10.0,
  "marketPrice": 10.0,
  "sizes": [
   {
    "unitAr": "400 غرام",
    "price": 10.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "canned_10",
  "categoryId": "canned",
  "nameAr": "شوكولاتة سبريد",
  "brand": "",
  "emoji": "🍫",
  "unitAr": "400 غرام",
  "price": 18.0,
  "marketPrice": 18.0,
  "sizes": [
   {
    "unitAr": "400 غرام",
    "price": 18.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "canned_11",
  "categoryId": "canned",
  "nameAr": "زبدة فول سوداني",
  "brand": "",
  "emoji": "🥜",
  "unitAr": "350 غرام",
  "price": 16.0,
  "marketPrice": 16.0,
  "sizes": [
   {
    "unitAr": "350 غرام",
    "price": 16.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "canned_12",
  "categoryId": "canned",
  "nameAr": "فول مدمس معلب",
  "brand": "",
  "emoji": "🫘",
  "unitAr": "400 غرام",
  "price": 5.0,
  "marketPrice": 5.0,
  "sizes": [
   {
    "unitAr": "400 غرام",
    "price": 5.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "canned_13",
  "categoryId": "canned",
  "nameAr": "حمص معلب",
  "brand": "",
  "emoji": "🫘",
  "unitAr": "400 غرام",
  "price": 5.0,
  "marketPrice": 5.0,
  "sizes": [
   {
    "unitAr": "400 غرام",
    "price": 5.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "canned_14",
  "categoryId": "canned",
  "nameAr": "ذرة معلبة",
  "brand": "",
  "emoji": "🌽",
  "unitAr": "340 غرام",
  "price": 6.0,
  "marketPrice": 6.0,
  "sizes": [
   {
    "unitAr": "340 غرام",
    "price": 6.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "canned_15",
  "categoryId": "canned",
  "nameAr": "بازيلاء معلبة",
  "brand": "",
  "emoji": "🫛",
  "unitAr": "400 غرام",
  "price": 6.0,
  "marketPrice": 6.0,
  "sizes": [
   {
    "unitAr": "400 غرام",
    "price": 6.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "canned_16",
  "categoryId": "canned",
  "nameAr": "فطر معلب",
  "brand": "",
  "emoji": "🍄",
  "unitAr": "400 غرام",
  "price": 8.0,
  "marketPrice": 8.0,
  "sizes": [
   {
    "unitAr": "400 غرام",
    "price": 8.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "canned_17",
  "categoryId": "canned",
  "nameAr": "تونا بالزيت",
  "brand": "",
  "emoji": "🐟",
  "unitAr": "160 غرام",
  "price": 8.0,
  "marketPrice": 8.0,
  "sizes": [
   {
    "unitAr": "160 غرام",
    "price": 8.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "canned_18",
  "categoryId": "canned",
  "nameAr": "تونا بالماء",
  "brand": "",
  "emoji": "🐟",
  "unitAr": "160 غرام",
  "price": 8.0,
  "marketPrice": 8.0,
  "sizes": [
   {
    "unitAr": "160 غرام",
    "price": 8.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "canned_19",
  "categoryId": "canned",
  "nameAr": "سردين",
  "brand": "",
  "emoji": "🐟",
  "unitAr": "125 غرام",
  "price": 7.0,
  "marketPrice": 7.0,
  "sizes": [
   {
    "unitAr": "125 غرام",
    "price": 7.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "canned_20",
  "categoryId": "canned",
  "nameAr": "معجون بندورة",
  "brand": "",
  "emoji": "🥫",
  "unitAr": "400 غرام",
  "price": 5.0,
  "marketPrice": 5.0,
  "sizes": [
   {
    "unitAr": "400 غرام",
    "price": 5.0
   },
   {
    "unitAr": "800 غرام",
    "price": 9.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "canned_21",
  "categoryId": "canned",
  "nameAr": "صلصة بندورة",
  "brand": "",
  "emoji": "🥫",
  "unitAr": "700 غرام",
  "price": 8.0,
  "marketPrice": 8.0,
  "sizes": [
   {
    "unitAr": "700 غرام",
    "price": 8.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "canned_22",
  "categoryId": "canned",
  "nameAr": "كاتشب",
  "brand": "",
  "emoji": "🍅",
  "unitAr": "500 غرام",
  "price": 9.0,
  "marketPrice": 9.0,
  "sizes": [
   {
    "unitAr": "500 غرام",
    "price": 9.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "canned_23",
  "categoryId": "canned",
  "nameAr": "مايونيز",
  "brand": "",
  "emoji": "🥚",
  "unitAr": "500 غرام",
  "price": 12.0,
  "marketPrice": 12.0,
  "sizes": [
   {
    "unitAr": "500 غرام",
    "price": 12.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "canned_24",
  "categoryId": "canned",
  "nameAr": "خردل",
  "brand": "",
  "emoji": "🌭",
  "unitAr": "250 غرام",
  "price": 8.0,
  "marketPrice": 8.0,
  "sizes": [
   {
    "unitAr": "250 غرام",
    "price": 8.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "canned_25",
  "categoryId": "canned",
  "nameAr": "مخلل مشكل",
  "brand": "",
  "emoji": "🥒",
  "unitAr": "1 كغم",
  "price": 14.0,
  "marketPrice": 14.0,
  "sizes": [
   {
    "unitAr": "1 كغم",
    "price": 14.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "canned_26",
  "categoryId": "canned",
  "nameAr": "مخلل خيار",
  "brand": "",
  "emoji": "🥒",
  "unitAr": "700 غرام",
  "price": 10.0,
  "marketPrice": 10.0,
  "sizes": [
   {
    "unitAr": "700 غرام",
    "price": 10.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "canned_27",
  "categoryId": "canned",
  "nameAr": "زيتون أخضر",
  "brand": "",
  "emoji": "🫒",
  "unitAr": "1 كغم",
  "price": 22.0,
  "marketPrice": 22.0,
  "sizes": [
   {
    "unitAr": "1 كغم",
    "price": 22.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "canned_28",
  "categoryId": "canned",
  "nameAr": "زيتون أسود",
  "brand": "",
  "emoji": "🫒",
  "unitAr": "500 غرام",
  "price": 16.0,
  "marketPrice": 16.0,
  "sizes": [
   {
    "unitAr": "500 غرام",
    "price": 16.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "canned_29",
  "categoryId": "canned",
  "nameAr": "مكدوس",
  "brand": "",
  "emoji": "🍆",
  "unitAr": "500 غرام",
  "price": 25.0,
  "marketPrice": 25.0,
  "sizes": [
   {
    "unitAr": "500 غرام",
    "price": 25.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "canned_30",
  "categoryId": "canned",
  "nameAr": "ورق عنب معلب",
  "brand": "",
  "emoji": "🍇",
  "unitAr": "500 غرام",
  "price": 14.0,
  "marketPrice": 14.0,
  "sizes": [
   {
    "unitAr": "500 غرام",
    "price": 14.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "snacks_1",
  "categoryId": "snacks",
  "nameAr": "شيبس ليز ملح",
  "brand": "",
  "emoji": "🍿",
  "unitAr": "عبوة صغيرة",
  "price": 4.0,
  "marketPrice": 4.0,
  "sizes": [
   {
    "unitAr": "عبوة صغيرة",
    "price": 4.0
   },
   {
    "unitAr": "عبوة كبيرة",
    "price": 8.8
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "snacks_2",
  "categoryId": "snacks",
  "nameAr": "شيبس ليز بابريكا",
  "brand": "",
  "emoji": "🍿",
  "unitAr": "عبوة صغيرة",
  "price": 4.0,
  "marketPrice": 4.0,
  "sizes": [
   {
    "unitAr": "عبوة صغيرة",
    "price": 4.0
   },
   {
    "unitAr": "عبوة كبيرة",
    "price": 8.8
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "snacks_3",
  "categoryId": "snacks",
  "nameAr": "شيبس ليز جبنة",
  "brand": "",
  "emoji": "🍿",
  "unitAr": "عبوة صغيرة",
  "price": 4.0,
  "marketPrice": 4.0,
  "sizes": [
   {
    "unitAr": "عبوة صغيرة",
    "price": 4.0
   },
   {
    "unitAr": "عبوة كبيرة",
    "price": 8.8
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "snacks_4",
  "categoryId": "snacks",
  "nameAr": "شيبس تابيتا",
  "brand": "",
  "emoji": "🍿",
  "unitAr": "عبوة صغيرة",
  "price": 3.0,
  "marketPrice": 3.0,
  "sizes": [
   {
    "unitAr": "عبوة صغيرة",
    "price": 3.0
   },
   {
    "unitAr": "عبوة كبيرة",
    "price": 6.6
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "snacks_5",
  "categoryId": "snacks",
  "nameAr": "شيبس دوريتوس",
  "brand": "",
  "emoji": "🍿",
  "unitAr": "عبوة صغيرة",
  "price": 6.0,
  "marketPrice": 6.0,
  "sizes": [
   {
    "unitAr": "عبوة صغيرة",
    "price": 6.0
   },
   {
    "unitAr": "عبوة كبيرة",
    "price": 13.2
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "snacks_6",
  "categoryId": "snacks",
  "nameAr": "شيبس برينجلز",
  "brand": "",
  "emoji": "🍿",
  "unitAr": "عبوة صغيرة",
  "price": 12.0,
  "marketPrice": 12.0,
  "sizes": [
   {
    "unitAr": "عبوة صغيرة",
    "price": 12.0
   },
   {
    "unitAr": "عبوة كبيرة",
    "price": 26.4
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "snacks_7",
  "categoryId": "snacks",
  "nameAr": "ذرة مقرمشة",
  "brand": "",
  "emoji": "🍿",
  "unitAr": "عبوة صغيرة",
  "price": 4.0,
  "marketPrice": 4.0,
  "sizes": [
   {
    "unitAr": "عبوة صغيرة",
    "price": 4.0
   },
   {
    "unitAr": "عبوة كبيرة",
    "price": 8.8
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "snacks_8",
  "categoryId": "snacks",
  "nameAr": "بوشار جاهز",
  "brand": "",
  "emoji": "🍿",
  "unitAr": "عبوة صغيرة",
  "price": 6.0,
  "marketPrice": 6.0,
  "sizes": [
   {
    "unitAr": "عبوة صغيرة",
    "price": 6.0
   },
   {
    "unitAr": "عبوة كبيرة",
    "price": 13.2
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "snacks_9",
  "categoryId": "snacks",
  "nameAr": "بسكويت شاي",
  "brand": "",
  "emoji": "🍪",
  "unitAr": "400 غرام",
  "price": 7.0,
  "marketPrice": 7.0,
  "sizes": [
   {
    "unitAr": "400 غرام",
    "price": 7.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "snacks_10",
  "categoryId": "snacks",
  "nameAr": "بسكويت أوريو",
  "brand": "",
  "emoji": "🍪",
  "unitAr": "12 قطعة",
  "price": 10.0,
  "marketPrice": 10.0,
  "sizes": [
   {
    "unitAr": "12 قطعة",
    "price": 10.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "snacks_11",
  "categoryId": "snacks",
  "nameAr": "بسكويت بالشوكولاتة",
  "brand": "",
  "emoji": "🍪",
  "unitAr": "300 غرام",
  "price": 9.0,
  "marketPrice": 9.0,
  "sizes": [
   {
    "unitAr": "300 غرام",
    "price": 9.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "snacks_12",
  "categoryId": "snacks",
  "nameAr": "ويفر شوكولاتة",
  "brand": "",
  "emoji": "🍫",
  "unitAr": "6 قطع",
  "price": 8.0,
  "marketPrice": 8.0,
  "sizes": [
   {
    "unitAr": "6 قطع",
    "price": 8.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "snacks_13",
  "categoryId": "snacks",
  "nameAr": "كيك مغلف",
  "brand": "",
  "emoji": "🧁",
  "unitAr": "6 قطع",
  "price": 10.0,
  "marketPrice": 10.0,
  "sizes": [
   {
    "unitAr": "6 قطع",
    "price": 10.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "snacks_14",
  "categoryId": "snacks",
  "nameAr": "كرواسون مغلف",
  "brand": "",
  "emoji": "🥐",
  "unitAr": "6 قطع",
  "price": 12.0,
  "marketPrice": 12.0,
  "sizes": [
   {
    "unitAr": "6 قطع",
    "price": 12.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "snacks_15",
  "categoryId": "snacks",
  "nameAr": "مكسرات مملحة",
  "brand": "",
  "emoji": "🥜",
  "unitAr": "200 غرام",
  "price": 12.0,
  "marketPrice": 12.0,
  "sizes": [
   {
    "unitAr": "200 غرام",
    "price": 12.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "snacks_16",
  "categoryId": "snacks",
  "nameAr": "فستق سوداني",
  "brand": "",
  "emoji": "🥜",
  "unitAr": "250 غرام",
  "price": 10.0,
  "marketPrice": 10.0,
  "sizes": [
   {
    "unitAr": "250 غرام",
    "price": 10.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "snacks_17",
  "categoryId": "snacks",
  "nameAr": "ترمس",
  "brand": "",
  "emoji": "🫘",
  "unitAr": "500 غرام",
  "price": 12.0,
  "marketPrice": 12.0,
  "sizes": [
   {
    "unitAr": "500 غرام",
    "price": 12.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "snacks_18",
  "categoryId": "snacks",
  "nameAr": "بذر شمسية",
  "brand": "",
  "emoji": "🌻",
  "unitAr": "250 غرام",
  "price": 8.0,
  "marketPrice": 8.0,
  "sizes": [
   {
    "unitAr": "250 غرام",
    "price": 8.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "snacks_19",
  "categoryId": "snacks",
  "nameAr": "بذر قرع",
  "brand": "",
  "emoji": "🎃",
  "unitAr": "250 غرام",
  "price": 14.0,
  "marketPrice": 14.0,
  "sizes": [
   {
    "unitAr": "250 غرام",
    "price": 14.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "sweets_1",
  "categoryId": "sweets",
  "nameAr": "شوكولاتة جالكسي",
  "brand": "",
  "emoji": "🍫",
  "unitAr": "قطعة",
  "price": 6.0,
  "marketPrice": 6.0,
  "sizes": [
   {
    "unitAr": "قطعة",
    "price": 6.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "sweets_2",
  "categoryId": "sweets",
  "nameAr": "شوكولاتة كادبوري",
  "brand": "",
  "emoji": "🍫",
  "unitAr": "قطعة",
  "price": 7.0,
  "marketPrice": 7.0,
  "sizes": [
   {
    "unitAr": "قطعة",
    "price": 7.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "sweets_3",
  "categoryId": "sweets",
  "nameAr": "شوكولاتة نستله",
  "brand": "",
  "emoji": "🍫",
  "unitAr": "قطعة",
  "price": 6.0,
  "marketPrice": 6.0,
  "sizes": [
   {
    "unitAr": "قطعة",
    "price": 6.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "sweets_4",
  "categoryId": "sweets",
  "nameAr": "شوكولاتة سنيكرز",
  "brand": "",
  "emoji": "🍫",
  "unitAr": "قطعة",
  "price": 4.0,
  "marketPrice": 4.0,
  "sizes": [
   {
    "unitAr": "قطعة",
    "price": 4.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "sweets_5",
  "categoryId": "sweets",
  "nameAr": "شوكولاتة مارس",
  "brand": "",
  "emoji": "🍫",
  "unitAr": "قطعة",
  "price": 4.0,
  "marketPrice": 4.0,
  "sizes": [
   {
    "unitAr": "قطعة",
    "price": 4.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "sweets_6",
  "categoryId": "sweets",
  "nameAr": "شوكولاتة كيت كات",
  "brand": "",
  "emoji": "🍫",
  "unitAr": "قطعة",
  "price": 4.0,
  "marketPrice": 4.0,
  "sizes": [
   {
    "unitAr": "قطعة",
    "price": 4.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "sweets_7",
  "categoryId": "sweets",
  "nameAr": "شوكولاتة بونتي",
  "brand": "",
  "emoji": "🍫",
  "unitAr": "قطعة",
  "price": 4.0,
  "marketPrice": 4.0,
  "sizes": [
   {
    "unitAr": "قطعة",
    "price": 4.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "sweets_8",
  "categoryId": "sweets",
  "nameAr": "شوكولاتة تويكس",
  "brand": "",
  "emoji": "🍫",
  "unitAr": "قطعة",
  "price": 4.0,
  "marketPrice": 4.0,
  "sizes": [
   {
    "unitAr": "قطعة",
    "price": 4.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "sweets_9",
  "categoryId": "sweets",
  "nameAr": "شوكولاتة فيريرو روشيه",
  "brand": "",
  "emoji": "🍫",
  "unitAr": "قطعة",
  "price": 22.0,
  "marketPrice": 22.0,
  "sizes": [
   {
    "unitAr": "قطعة",
    "price": 22.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "sweets_10",
  "categoryId": "sweets",
  "nameAr": "شوكولاتة ميلكا",
  "brand": "",
  "emoji": "🍫",
  "unitAr": "قطعة",
  "price": 8.0,
  "marketPrice": 8.0,
  "sizes": [
   {
    "unitAr": "قطعة",
    "price": 8.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "sweets_11",
  "categoryId": "sweets",
  "nameAr": "شوكولاتة لندت",
  "brand": "",
  "emoji": "🍫",
  "unitAr": "قطعة",
  "price": 18.0,
  "marketPrice": 18.0,
  "sizes": [
   {
    "unitAr": "قطعة",
    "price": 18.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "sweets_12",
  "categoryId": "sweets",
  "nameAr": "علبة شوكولاتة مشكلة",
  "brand": "",
  "emoji": "🍫",
  "unitAr": "500 غرام",
  "price": 45.0,
  "marketPrice": 45.0,
  "sizes": [
   {
    "unitAr": "500 غرام",
    "price": 45.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "sweets_13",
  "categoryId": "sweets",
  "nameAr": "علكة",
  "brand": "",
  "emoji": "🍬",
  "unitAr": "عبوة",
  "price": 3.0,
  "marketPrice": 3.0,
  "sizes": [
   {
    "unitAr": "عبوة",
    "price": 3.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "sweets_14",
  "categoryId": "sweets",
  "nameAr": "سكاكر مشكلة",
  "brand": "",
  "emoji": "🍬",
  "unitAr": "500 غرام",
  "price": 15.0,
  "marketPrice": 15.0,
  "sizes": [
   {
    "unitAr": "500 غرام",
    "price": 15.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "sweets_15",
  "categoryId": "sweets",
  "nameAr": "ملبس لوز",
  "brand": "",
  "emoji": "🍬",
  "unitAr": "500 غرام",
  "price": 35.0,
  "marketPrice": 35.0,
  "sizes": [
   {
    "unitAr": "500 غرام",
    "price": 35.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "sweets_16",
  "categoryId": "sweets",
  "nameAr": "راحة (حلقوم)",
  "brand": "",
  "emoji": "🍬",
  "unitAr": "500 غرام",
  "price": 25.0,
  "marketPrice": 25.0,
  "sizes": [
   {
    "unitAr": "500 غرام",
    "price": 25.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "sweets_17",
  "categoryId": "sweets",
  "nameAr": "مصاص أطفال",
  "brand": "",
  "emoji": "🍭",
  "unitAr": "10 حبات",
  "price": 5.0,
  "marketPrice": 5.0,
  "sizes": [
   {
    "unitAr": "10 حبات",
    "price": 5.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "sweets_18",
  "categoryId": "sweets",
  "nameAr": "جيلي",
  "brand": "",
  "emoji": "🍬",
  "unitAr": "200 غرام",
  "price": 6.0,
  "marketPrice": 6.0,
  "sizes": [
   {
    "unitAr": "200 غرام",
    "price": 6.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "sweets_19",
  "categoryId": "sweets",
  "nameAr": "مارشميلو",
  "brand": "",
  "emoji": "🍬",
  "unitAr": "200 غرام",
  "price": 8.0,
  "marketPrice": 8.0,
  "sizes": [
   {
    "unitAr": "200 غرام",
    "price": 8.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "drinks_1",
  "categoryId": "drinks",
  "nameAr": "كوكا كولا",
  "brand": "",
  "emoji": "🥤",
  "unitAr": "1 لتر",
  "price": 6.0,
  "marketPrice": 6.0,
  "sizes": [
   {
    "unitAr": "330 مل",
    "price": 3.0
   },
   {
    "unitAr": "500 مل",
    "price": 4.0
   },
   {
    "unitAr": "1 لتر",
    "price": 6.0
   },
   {
    "unitAr": "1.5 لتر",
    "price": 7.0
   },
   {
    "unitAr": "2 لتر",
    "price": 9.0
   },
   {
    "unitAr": "6 عبوات 330 مل",
    "price": 16.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "drinks_2",
  "categoryId": "drinks",
  "nameAr": "بيبسي",
  "brand": "",
  "emoji": "🥤",
  "unitAr": "1 لتر",
  "price": 6.0,
  "marketPrice": 6.0,
  "sizes": [
   {
    "unitAr": "330 مل",
    "price": 3.0
   },
   {
    "unitAr": "500 مل",
    "price": 4.0
   },
   {
    "unitAr": "1 لتر",
    "price": 6.0
   },
   {
    "unitAr": "1.5 لتر",
    "price": 7.0
   },
   {
    "unitAr": "2 لتر",
    "price": 9.0
   },
   {
    "unitAr": "6 عبوات 330 مل",
    "price": 16.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "drinks_3",
  "categoryId": "drinks",
  "nameAr": "سفن أب",
  "brand": "",
  "emoji": "🥤",
  "unitAr": "1 لتر",
  "price": 6.0,
  "marketPrice": 6.0,
  "sizes": [
   {
    "unitAr": "330 مل",
    "price": 3.0
   },
   {
    "unitAr": "500 مل",
    "price": 4.0
   },
   {
    "unitAr": "1 لتر",
    "price": 6.0
   },
   {
    "unitAr": "1.5 لتر",
    "price": 7.0
   },
   {
    "unitAr": "2 لتر",
    "price": 9.0
   },
   {
    "unitAr": "6 عبوات 330 مل",
    "price": 16.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "drinks_4",
  "categoryId": "drinks",
  "nameAr": "ميرندا برتقال",
  "brand": "",
  "emoji": "🥤",
  "unitAr": "1 لتر",
  "price": 6.0,
  "marketPrice": 6.0,
  "sizes": [
   {
    "unitAr": "330 مل",
    "price": 3.0
   },
   {
    "unitAr": "500 مل",
    "price": 4.0
   },
   {
    "unitAr": "1 لتر",
    "price": 6.0
   },
   {
    "unitAr": "1.5 لتر",
    "price": 7.0
   },
   {
    "unitAr": "2 لتر",
    "price": 9.0
   },
   {
    "unitAr": "6 عبوات 330 مل",
    "price": 16.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "drinks_5",
  "categoryId": "drinks",
  "nameAr": "فانتا",
  "brand": "",
  "emoji": "🥤",
  "unitAr": "1 لتر",
  "price": 6.0,
  "marketPrice": 6.0,
  "sizes": [
   {
    "unitAr": "330 مل",
    "price": 3.0
   },
   {
    "unitAr": "500 مل",
    "price": 4.0
   },
   {
    "unitAr": "1 لتر",
    "price": 6.0
   },
   {
    "unitAr": "1.5 لتر",
    "price": 7.0
   },
   {
    "unitAr": "2 لتر",
    "price": 9.0
   },
   {
    "unitAr": "6 عبوات 330 مل",
    "price": 16.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "drinks_6",
  "categoryId": "drinks",
  "nameAr": "سبرايت",
  "brand": "",
  "emoji": "🥤",
  "unitAr": "1 لتر",
  "price": 6.0,
  "marketPrice": 6.0,
  "sizes": [
   {
    "unitAr": "330 مل",
    "price": 3.0
   },
   {
    "unitAr": "500 مل",
    "price": 4.0
   },
   {
    "unitAr": "1 لتر",
    "price": 6.0
   },
   {
    "unitAr": "1.5 لتر",
    "price": 7.0
   },
   {
    "unitAr": "2 لتر",
    "price": 9.0
   },
   {
    "unitAr": "6 عبوات 330 مل",
    "price": 16.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "drinks_7",
  "categoryId": "drinks",
  "nameAr": "شويبس",
  "brand": "",
  "emoji": "🥤",
  "unitAr": "1 لتر",
  "price": 6.0,
  "marketPrice": 6.0,
  "sizes": [
   {
    "unitAr": "330 مل",
    "price": 3.0
   },
   {
    "unitAr": "500 مل",
    "price": 4.0
   },
   {
    "unitAr": "1 لتر",
    "price": 6.0
   },
   {
    "unitAr": "1.5 لتر",
    "price": 7.0
   },
   {
    "unitAr": "2 لتر",
    "price": 9.0
   },
   {
    "unitAr": "6 عبوات 330 مل",
    "price": 16.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "drinks_8",
  "categoryId": "drinks",
  "nameAr": "XL طاقة",
  "brand": "",
  "emoji": "🥤",
  "unitAr": "1 لتر",
  "price": 6.0,
  "marketPrice": 6.0,
  "sizes": [
   {
    "unitAr": "330 مل",
    "price": 3.0
   },
   {
    "unitAr": "500 مل",
    "price": 4.0
   },
   {
    "unitAr": "1 لتر",
    "price": 6.0
   },
   {
    "unitAr": "1.5 لتر",
    "price": 7.0
   },
   {
    "unitAr": "2 لتر",
    "price": 9.0
   },
   {
    "unitAr": "6 عبوات 330 مل",
    "price": 16.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "drinks_9",
  "categoryId": "drinks",
  "nameAr": "عصير برتقال",
  "brand": "",
  "emoji": "🧃",
  "unitAr": "1 لتر",
  "price": 8.0,
  "marketPrice": 8.0,
  "sizes": [
   {
    "unitAr": "250 مل",
    "price": 3.0
   },
   {
    "unitAr": "1 لتر",
    "price": 8.0
   },
   {
    "unitAr": "1.5 لتر",
    "price": 11.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "drinks_10",
  "categoryId": "drinks",
  "nameAr": "عصير تفاح",
  "brand": "",
  "emoji": "🧃",
  "unitAr": "1 لتر",
  "price": 8.0,
  "marketPrice": 8.0,
  "sizes": [
   {
    "unitAr": "250 مل",
    "price": 3.0
   },
   {
    "unitAr": "1 لتر",
    "price": 8.0
   },
   {
    "unitAr": "1.5 لتر",
    "price": 11.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "drinks_11",
  "categoryId": "drinks",
  "nameAr": "عصير مانجا",
  "brand": "",
  "emoji": "🧃",
  "unitAr": "1 لتر",
  "price": 8.0,
  "marketPrice": 8.0,
  "sizes": [
   {
    "unitAr": "250 مل",
    "price": 3.0
   },
   {
    "unitAr": "1 لتر",
    "price": 8.0
   },
   {
    "unitAr": "1.5 لتر",
    "price": 11.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "drinks_12",
  "categoryId": "drinks",
  "nameAr": "عصير جوافة",
  "brand": "",
  "emoji": "🧃",
  "unitAr": "1 لتر",
  "price": 8.0,
  "marketPrice": 8.0,
  "sizes": [
   {
    "unitAr": "250 مل",
    "price": 3.0
   },
   {
    "unitAr": "1 لتر",
    "price": 8.0
   },
   {
    "unitAr": "1.5 لتر",
    "price": 11.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "drinks_13",
  "categoryId": "drinks",
  "nameAr": "عصير عنب",
  "brand": "",
  "emoji": "🧃",
  "unitAr": "1 لتر",
  "price": 8.0,
  "marketPrice": 8.0,
  "sizes": [
   {
    "unitAr": "250 مل",
    "price": 3.0
   },
   {
    "unitAr": "1 لتر",
    "price": 8.0
   },
   {
    "unitAr": "1.5 لتر",
    "price": 11.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "drinks_14",
  "categoryId": "drinks",
  "nameAr": "عصير مشكل",
  "brand": "",
  "emoji": "🧃",
  "unitAr": "1 لتر",
  "price": 8.0,
  "marketPrice": 8.0,
  "sizes": [
   {
    "unitAr": "250 مل",
    "price": 3.0
   },
   {
    "unitAr": "1 لتر",
    "price": 8.0
   },
   {
    "unitAr": "1.5 لتر",
    "price": 11.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "drinks_15",
  "categoryId": "drinks",
  "nameAr": "عصير ليمون بالنعناع",
  "brand": "",
  "emoji": "🧃",
  "unitAr": "1 لتر",
  "price": 8.0,
  "marketPrice": 8.0,
  "sizes": [
   {
    "unitAr": "250 مل",
    "price": 3.0
   },
   {
    "unitAr": "1 لتر",
    "price": 8.0
   },
   {
    "unitAr": "1.5 لتر",
    "price": 11.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "drinks_16",
  "categoryId": "drinks",
  "nameAr": "مياه معدنية",
  "brand": "",
  "emoji": "💧",
  "unitAr": "500 مل",
  "price": 1.5,
  "marketPrice": 1.5,
  "sizes": [
   {
    "unitAr": "500 مل",
    "price": 1.5
   },
   {
    "unitAr": "1.5 لتر",
    "price": 2.5
   },
   {
    "unitAr": "6 عبوات",
    "price": 12.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "drinks_17",
  "categoryId": "drinks",
  "nameAr": "مياه غازية",
  "brand": "",
  "emoji": "💧",
  "unitAr": "1 لتر",
  "price": 4.0,
  "marketPrice": 4.0,
  "sizes": [
   {
    "unitAr": "1 لتر",
    "price": 4.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "drinks_18",
  "categoryId": "drinks",
  "nameAr": "مشروب شعير",
  "brand": "",
  "emoji": "🍺",
  "unitAr": "330 مل",
  "price": 5.0,
  "marketPrice": 5.0,
  "sizes": [
   {
    "unitAr": "330 مل",
    "price": 5.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "drinks_19",
  "categoryId": "drinks",
  "nameAr": "مشروب طاقة ريد بول",
  "brand": "",
  "emoji": "⚡",
  "unitAr": "250 مل",
  "price": 10.0,
  "marketPrice": 10.0,
  "sizes": [
   {
    "unitAr": "250 مل",
    "price": 10.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "drinks_20",
  "categoryId": "drinks",
  "nameAr": "عيران",
  "brand": "",
  "emoji": "🥛",
  "unitAr": "250 مل",
  "price": 3.0,
  "marketPrice": 3.0,
  "sizes": [
   {
    "unitAr": "250 مل",
    "price": 3.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "drinks_21",
  "categoryId": "drinks",
  "nameAr": "مشروب شوكولاتة بالحليب",
  "brand": "",
  "emoji": "🥛",
  "unitAr": "250 مل",
  "price": 4.0,
  "marketPrice": 4.0,
  "sizes": [
   {
    "unitAr": "250 مل",
    "price": 4.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "hotdrinks_1",
  "categoryId": "hotdrinks",
  "nameAr": "قهوة عربية مطحونة",
  "brand": "",
  "emoji": "☕",
  "unitAr": "500 غرام",
  "price": 28.0,
  "marketPrice": 28.0,
  "sizes": [
   {
    "unitAr": "500 غرام",
    "price": 28.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "hotdrinks_2",
  "categoryId": "hotdrinks",
  "nameAr": "قهوة عربية بالهيل",
  "brand": "",
  "emoji": "☕",
  "unitAr": "500 غرام",
  "price": 35.0,
  "marketPrice": 35.0,
  "sizes": [
   {
    "unitAr": "500 غرام",
    "price": 35.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "hotdrinks_3",
  "categoryId": "hotdrinks",
  "nameAr": "قهوة تركية",
  "brand": "",
  "emoji": "☕",
  "unitAr": "250 غرام",
  "price": 18.0,
  "marketPrice": 18.0,
  "sizes": [
   {
    "unitAr": "250 غرام",
    "price": 18.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "hotdrinks_4",
  "categoryId": "hotdrinks",
  "nameAr": "قهوة نسكافيه كلاسيك",
  "brand": "",
  "emoji": "☕",
  "unitAr": "200 غرام",
  "price": 32.0,
  "marketPrice": 32.0,
  "sizes": [
   {
    "unitAr": "200 غرام",
    "price": 32.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "hotdrinks_5",
  "categoryId": "hotdrinks",
  "nameAr": "نسكافيه 3×1",
  "brand": "",
  "emoji": "☕",
  "unitAr": "20 كيس",
  "price": 22.0,
  "marketPrice": 22.0,
  "sizes": [
   {
    "unitAr": "20 كيس",
    "price": 22.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "hotdrinks_6",
  "categoryId": "hotdrinks",
  "nameAr": "قهوة إسبريسو حبوب",
  "brand": "",
  "emoji": "☕",
  "unitAr": "1 كغم",
  "price": 65.0,
  "marketPrice": 65.0,
  "sizes": [
   {
    "unitAr": "1 كغم",
    "price": 65.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "hotdrinks_7",
  "categoryId": "hotdrinks",
  "nameAr": "كبسولات قهوة",
  "brand": "",
  "emoji": "☕",
  "unitAr": "10 كبسولات",
  "price": 25.0,
  "marketPrice": 25.0,
  "sizes": [
   {
    "unitAr": "10 كبسولات",
    "price": 25.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "hotdrinks_8",
  "categoryId": "hotdrinks",
  "nameAr": "شاي أحمر",
  "brand": "",
  "emoji": "🍵",
  "unitAr": "100 كيس",
  "price": 14.0,
  "marketPrice": 14.0,
  "sizes": [
   {
    "unitAr": "100 كيس",
    "price": 14.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "hotdrinks_9",
  "categoryId": "hotdrinks",
  "nameAr": "شاي أخضر",
  "brand": "",
  "emoji": "🍵",
  "unitAr": "50 كيس",
  "price": 12.0,
  "marketPrice": 12.0,
  "sizes": [
   {
    "unitAr": "50 كيس",
    "price": 12.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "hotdrinks_10",
  "categoryId": "hotdrinks",
  "nameAr": "شاي بالنعناع",
  "brand": "",
  "emoji": "🍵",
  "unitAr": "50 كيس",
  "price": 13.0,
  "marketPrice": 13.0,
  "sizes": [
   {
    "unitAr": "50 كيس",
    "price": 13.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "hotdrinks_11",
  "categoryId": "hotdrinks",
  "nameAr": "شاي ليبتون",
  "brand": "",
  "emoji": "🍵",
  "unitAr": "100 كيس",
  "price": 18.0,
  "marketPrice": 18.0,
  "sizes": [
   {
    "unitAr": "100 كيس",
    "price": 18.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "hotdrinks_12",
  "categoryId": "hotdrinks",
  "nameAr": "زهورات",
  "brand": "",
  "emoji": "🌼",
  "unitAr": "100 غرام",
  "price": 12.0,
  "marketPrice": 12.0,
  "sizes": [
   {
    "unitAr": "100 غرام",
    "price": 12.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "hotdrinks_13",
  "categoryId": "hotdrinks",
  "nameAr": "بابونج",
  "brand": "",
  "emoji": "🌼",
  "unitAr": "100 غرام",
  "price": 14.0,
  "marketPrice": 14.0,
  "sizes": [
   {
    "unitAr": "100 غرام",
    "price": 14.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "hotdrinks_14",
  "categoryId": "hotdrinks",
  "nameAr": "مرمرية",
  "brand": "",
  "emoji": "🌿",
  "unitAr": "100 غرام",
  "price": 12.0,
  "marketPrice": 12.0,
  "sizes": [
   {
    "unitAr": "100 غرام",
    "price": 12.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "hotdrinks_15",
  "categoryId": "hotdrinks",
  "nameAr": "يانسون",
  "brand": "",
  "emoji": "🌿",
  "unitAr": "100 غرام",
  "price": 10.0,
  "marketPrice": 10.0,
  "sizes": [
   {
    "unitAr": "100 غرام",
    "price": 10.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "hotdrinks_16",
  "categoryId": "hotdrinks",
  "nameAr": "كاكاو خام",
  "brand": "",
  "emoji": "🍫",
  "unitAr": "250 غرام",
  "price": 18.0,
  "marketPrice": 18.0,
  "sizes": [
   {
    "unitAr": "250 غرام",
    "price": 18.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "hotdrinks_17",
  "categoryId": "hotdrinks",
  "nameAr": "كريمر قهوة",
  "brand": "",
  "emoji": "🥛",
  "unitAr": "400 غرام",
  "price": 14.0,
  "marketPrice": 14.0,
  "sizes": [
   {
    "unitAr": "400 غرام",
    "price": 14.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "nuts_1",
  "categoryId": "nuts",
  "nameAr": "لوز",
  "brand": "",
  "emoji": "🥜",
  "unitAr": "1 كغم",
  "price": 55.0,
  "marketPrice": 55.0,
  "sizes": [
   {
    "unitAr": "250 غرام",
    "price": 16.5
   },
   {
    "unitAr": "½ كغم",
    "price": 30.3
   },
   {
    "unitAr": "1 كغم",
    "price": 55.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "nuts_2",
  "categoryId": "nuts",
  "nameAr": "جوز",
  "brand": "",
  "emoji": "🥜",
  "unitAr": "1 كغم",
  "price": 65.0,
  "marketPrice": 65.0,
  "sizes": [
   {
    "unitAr": "250 غرام",
    "price": 19.5
   },
   {
    "unitAr": "½ كغم",
    "price": 35.8
   },
   {
    "unitAr": "1 كغم",
    "price": 65.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "nuts_3",
  "categoryId": "nuts",
  "nameAr": "كاجو",
  "brand": "",
  "emoji": "🥜",
  "unitAr": "1 كغم",
  "price": 75.0,
  "marketPrice": 75.0,
  "sizes": [
   {
    "unitAr": "250 غرام",
    "price": 22.5
   },
   {
    "unitAr": "½ كغم",
    "price": 41.2
   },
   {
    "unitAr": "1 كغم",
    "price": 75.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "nuts_4",
  "categoryId": "nuts",
  "nameAr": "فستق حلبي",
  "brand": "",
  "emoji": "🥜",
  "unitAr": "1 كغم",
  "price": 95.0,
  "marketPrice": 95.0,
  "sizes": [
   {
    "unitAr": "250 غرام",
    "price": 28.5
   },
   {
    "unitAr": "½ كغم",
    "price": 52.3
   },
   {
    "unitAr": "1 كغم",
    "price": 95.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "nuts_5",
  "categoryId": "nuts",
  "nameAr": "بندق",
  "brand": "",
  "emoji": "🥜",
  "unitAr": "1 كغم",
  "price": 70.0,
  "marketPrice": 70.0,
  "sizes": [
   {
    "unitAr": "250 غرام",
    "price": 21.0
   },
   {
    "unitAr": "½ كغم",
    "price": 38.5
   },
   {
    "unitAr": "1 كغم",
    "price": 70.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "nuts_6",
  "categoryId": "nuts",
  "nameAr": "فول سوداني محمص",
  "brand": "",
  "emoji": "🥜",
  "unitAr": "1 كغم",
  "price": 22.0,
  "marketPrice": 22.0,
  "sizes": [
   {
    "unitAr": "250 غرام",
    "price": 6.6
   },
   {
    "unitAr": "½ كغم",
    "price": 12.1
   },
   {
    "unitAr": "1 كغم",
    "price": 22.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "nuts_7",
  "categoryId": "nuts",
  "nameAr": "صنوبر",
  "brand": "",
  "emoji": "🥜",
  "unitAr": "1 كغم",
  "price": 180.0,
  "marketPrice": 180.0,
  "sizes": [
   {
    "unitAr": "250 غرام",
    "price": 54.0
   },
   {
    "unitAr": "½ كغم",
    "price": 99.0
   },
   {
    "unitAr": "1 كغم",
    "price": 180.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "nuts_8",
  "categoryId": "nuts",
  "nameAr": "بذر شمسية محمص",
  "brand": "",
  "emoji": "🥜",
  "unitAr": "1 كغم",
  "price": 25.0,
  "marketPrice": 25.0,
  "sizes": [
   {
    "unitAr": "250 غرام",
    "price": 7.5
   },
   {
    "unitAr": "½ كغم",
    "price": 13.8
   },
   {
    "unitAr": "1 كغم",
    "price": 25.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "nuts_9",
  "categoryId": "nuts",
  "nameAr": "مكسرات مشكلة",
  "brand": "",
  "emoji": "🥜",
  "unitAr": "1 كغم",
  "price": 60.0,
  "marketPrice": 60.0,
  "sizes": [
   {
    "unitAr": "250 غرام",
    "price": 18.0
   },
   {
    "unitAr": "½ كغم",
    "price": 33.0
   },
   {
    "unitAr": "1 كغم",
    "price": 60.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "nuts_10",
  "categoryId": "nuts",
  "nameAr": "تين مجفف",
  "brand": "",
  "emoji": "🥜",
  "unitAr": "1 كغم",
  "price": 35.0,
  "marketPrice": 35.0,
  "sizes": [
   {
    "unitAr": "250 غرام",
    "price": 10.5
   },
   {
    "unitAr": "½ كغم",
    "price": 19.2
   },
   {
    "unitAr": "1 كغم",
    "price": 35.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "nuts_11",
  "categoryId": "nuts",
  "nameAr": "مشمش مجفف",
  "brand": "",
  "emoji": "🥜",
  "unitAr": "1 كغم",
  "price": 40.0,
  "marketPrice": 40.0,
  "sizes": [
   {
    "unitAr": "250 غرام",
    "price": 12.0
   },
   {
    "unitAr": "½ كغم",
    "price": 22.0
   },
   {
    "unitAr": "1 كغم",
    "price": 40.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "nuts_12",
  "categoryId": "nuts",
  "nameAr": "زبيب",
  "brand": "",
  "emoji": "🥜",
  "unitAr": "1 كغم",
  "price": 25.0,
  "marketPrice": 25.0,
  "sizes": [
   {
    "unitAr": "250 غرام",
    "price": 7.5
   },
   {
    "unitAr": "½ كغم",
    "price": 13.8
   },
   {
    "unitAr": "1 كغم",
    "price": 25.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "nuts_13",
  "categoryId": "nuts",
  "nameAr": "قراصيا",
  "brand": "",
  "emoji": "🥜",
  "unitAr": "1 كغم",
  "price": 45.0,
  "marketPrice": 45.0,
  "sizes": [
   {
    "unitAr": "250 غرام",
    "price": 13.5
   },
   {
    "unitAr": "½ كغم",
    "price": 24.8
   },
   {
    "unitAr": "1 كغم",
    "price": 45.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "nuts_14",
  "categoryId": "nuts",
  "nameAr": "تمر عجوة",
  "brand": "",
  "emoji": "🥜",
  "unitAr": "1 كغم",
  "price": 50.0,
  "marketPrice": 50.0,
  "sizes": [
   {
    "unitAr": "250 غرام",
    "price": 15.0
   },
   {
    "unitAr": "½ كغم",
    "price": 27.5
   },
   {
    "unitAr": "1 كغم",
    "price": 50.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "nuts_15",
  "categoryId": "nuts",
  "nameAr": "تمر مجهول فاخر",
  "brand": "",
  "emoji": "🥜",
  "unitAr": "1 كغم",
  "price": 70.0,
  "marketPrice": 70.0,
  "sizes": [
   {
    "unitAr": "250 غرام",
    "price": 21.0
   },
   {
    "unitAr": "½ كغم",
    "price": 38.5
   },
   {
    "unitAr": "1 كغم",
    "price": 70.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "spices_1",
  "categoryId": "spices",
  "nameAr": "كمون",
  "brand": "",
  "emoji": "🧂",
  "unitAr": "100 غرام",
  "price": 4.0,
  "marketPrice": 4.0,
  "sizes": [
   {
    "unitAr": "100 غرام",
    "price": 4.0
   },
   {
    "unitAr": "250 غرام",
    "price": 8.8
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "spices_2",
  "categoryId": "spices",
  "nameAr": "كركم",
  "brand": "",
  "emoji": "🧂",
  "unitAr": "100 غرام",
  "price": 4.0,
  "marketPrice": 4.0,
  "sizes": [
   {
    "unitAr": "100 غرام",
    "price": 4.0
   },
   {
    "unitAr": "250 غرام",
    "price": 8.8
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "spices_3",
  "categoryId": "spices",
  "nameAr": "فلفل أسود",
  "brand": "",
  "emoji": "🧂",
  "unitAr": "100 غرام",
  "price": 6.0,
  "marketPrice": 6.0,
  "sizes": [
   {
    "unitAr": "100 غرام",
    "price": 6.0
   },
   {
    "unitAr": "250 غرام",
    "price": 13.2
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "spices_4",
  "categoryId": "spices",
  "nameAr": "فلفل أحمر",
  "brand": "",
  "emoji": "🧂",
  "unitAr": "100 غرام",
  "price": 5.0,
  "marketPrice": 5.0,
  "sizes": [
   {
    "unitAr": "100 غرام",
    "price": 5.0
   },
   {
    "unitAr": "250 غرام",
    "price": 11.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "spices_5",
  "categoryId": "spices",
  "nameAr": "بهارات مشكلة",
  "brand": "",
  "emoji": "🧂",
  "unitAr": "100 غرام",
  "price": 5.0,
  "marketPrice": 5.0,
  "sizes": [
   {
    "unitAr": "100 غرام",
    "price": 5.0
   },
   {
    "unitAr": "250 غرام",
    "price": 11.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "spices_6",
  "categoryId": "spices",
  "nameAr": "قرفة",
  "brand": "",
  "emoji": "🧂",
  "unitAr": "100 غرام",
  "price": 5.0,
  "marketPrice": 5.0,
  "sizes": [
   {
    "unitAr": "100 غرام",
    "price": 5.0
   },
   {
    "unitAr": "250 غرام",
    "price": 11.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "spices_7",
  "categoryId": "spices",
  "nameAr": "هيل",
  "brand": "",
  "emoji": "🧂",
  "unitAr": "100 غرام",
  "price": 25.0,
  "marketPrice": 25.0,
  "sizes": [
   {
    "unitAr": "100 غرام",
    "price": 25.0
   },
   {
    "unitAr": "250 غرام",
    "price": 55.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "spices_8",
  "categoryId": "spices",
  "nameAr": "قرنفل",
  "brand": "",
  "emoji": "🧂",
  "unitAr": "100 غرام",
  "price": 8.0,
  "marketPrice": 8.0,
  "sizes": [
   {
    "unitAr": "100 غرام",
    "price": 8.0
   },
   {
    "unitAr": "250 غرام",
    "price": 17.6
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "spices_9",
  "categoryId": "spices",
  "nameAr": "جوزة الطيب",
  "brand": "",
  "emoji": "🧂",
  "unitAr": "100 غرام",
  "price": 10.0,
  "marketPrice": 10.0,
  "sizes": [
   {
    "unitAr": "100 غرام",
    "price": 10.0
   },
   {
    "unitAr": "250 غرام",
    "price": 22.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "spices_10",
  "categoryId": "spices",
  "nameAr": "سبع بهارات",
  "brand": "",
  "emoji": "🧂",
  "unitAr": "100 غرام",
  "price": 6.0,
  "marketPrice": 6.0,
  "sizes": [
   {
    "unitAr": "100 غرام",
    "price": 6.0
   },
   {
    "unitAr": "250 غرام",
    "price": 13.2
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "spices_11",
  "categoryId": "spices",
  "nameAr": "زعتر بلدي",
  "brand": "",
  "emoji": "🧂",
  "unitAr": "100 غرام",
  "price": 8.0,
  "marketPrice": 8.0,
  "sizes": [
   {
    "unitAr": "100 غرام",
    "price": 8.0
   },
   {
    "unitAr": "250 غرام",
    "price": 17.6
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "spices_12",
  "categoryId": "spices",
  "nameAr": "سماق",
  "brand": "",
  "emoji": "🧂",
  "unitAr": "100 غرام",
  "price": 7.0,
  "marketPrice": 7.0,
  "sizes": [
   {
    "unitAr": "100 غرام",
    "price": 7.0
   },
   {
    "unitAr": "250 غرام",
    "price": 15.4
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "spices_13",
  "categoryId": "spices",
  "nameAr": "ورق غار",
  "brand": "",
  "emoji": "🧂",
  "unitAr": "100 غرام",
  "price": 4.0,
  "marketPrice": 4.0,
  "sizes": [
   {
    "unitAr": "100 غرام",
    "price": 4.0
   },
   {
    "unitAr": "250 غرام",
    "price": 8.8
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "spices_14",
  "categoryId": "spices",
  "nameAr": "زعفران",
  "brand": "",
  "emoji": "🧂",
  "unitAr": "100 غرام",
  "price": 30.0,
  "marketPrice": 30.0,
  "sizes": [
   {
    "unitAr": "100 غرام",
    "price": 30.0
   },
   {
    "unitAr": "250 غرام",
    "price": 66.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "spices_15",
  "categoryId": "spices",
  "nameAr": "بابريكا",
  "brand": "",
  "emoji": "🧂",
  "unitAr": "100 غرام",
  "price": 5.0,
  "marketPrice": 5.0,
  "sizes": [
   {
    "unitAr": "100 غرام",
    "price": 5.0
   },
   {
    "unitAr": "250 غرام",
    "price": 11.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "spices_16",
  "categoryId": "spices",
  "nameAr": "ثوم بودرة",
  "brand": "",
  "emoji": "🧂",
  "unitAr": "100 غرام",
  "price": 6.0,
  "marketPrice": 6.0,
  "sizes": [
   {
    "unitAr": "100 غرام",
    "price": 6.0
   },
   {
    "unitAr": "250 غرام",
    "price": 13.2
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "spices_17",
  "categoryId": "spices",
  "nameAr": "بصل بودرة",
  "brand": "",
  "emoji": "🧂",
  "unitAr": "100 غرام",
  "price": 6.0,
  "marketPrice": 6.0,
  "sizes": [
   {
    "unitAr": "100 غرام",
    "price": 6.0
   },
   {
    "unitAr": "250 غرام",
    "price": 13.2
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "spices_18",
  "categoryId": "spices",
  "nameAr": "مكعبات مرقة",
  "brand": "",
  "emoji": "🧂",
  "unitAr": "100 غرام",
  "price": 5.0,
  "marketPrice": 5.0,
  "sizes": [
   {
    "unitAr": "100 غرام",
    "price": 5.0
   },
   {
    "unitAr": "250 غرام",
    "price": 11.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "cleaning_1",
  "categoryId": "cleaning",
  "nameAr": "مسحوق غسيل أوتوماتيك",
  "brand": "",
  "emoji": "🧼",
  "unitAr": "3 كغم",
  "price": 35.0,
  "marketPrice": 35.0,
  "sizes": [
   {
    "unitAr": "3 كغم",
    "price": 35.0
   },
   {
    "unitAr": "5 كغم",
    "price": 55.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "cleaning_2",
  "categoryId": "cleaning",
  "nameAr": "سائل غسيل",
  "brand": "",
  "emoji": "🧴",
  "unitAr": "2 لتر",
  "price": 28.0,
  "marketPrice": 28.0,
  "sizes": [
   {
    "unitAr": "2 لتر",
    "price": 28.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "cleaning_3",
  "categoryId": "cleaning",
  "nameAr": "منعم ملابس",
  "brand": "",
  "emoji": "🧴",
  "unitAr": "2 لتر",
  "price": 18.0,
  "marketPrice": 18.0,
  "sizes": [
   {
    "unitAr": "2 لتر",
    "price": 18.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "cleaning_4",
  "categoryId": "cleaning",
  "nameAr": "مبيض كلوركس",
  "brand": "",
  "emoji": "🧴",
  "unitAr": "1 لتر",
  "price": 7.0,
  "marketPrice": 7.0,
  "sizes": [
   {
    "unitAr": "1 لتر",
    "price": 7.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "cleaning_5",
  "categoryId": "cleaning",
  "nameAr": "سائل جلي",
  "brand": "",
  "emoji": "🧽",
  "unitAr": "1 لتر",
  "price": 9.0,
  "marketPrice": 9.0,
  "sizes": [
   {
    "unitAr": "1 لتر",
    "price": 9.0
   },
   {
    "unitAr": "4 لتر",
    "price": 30.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "cleaning_6",
  "categoryId": "cleaning",
  "nameAr": "منظف أرضيات",
  "brand": "",
  "emoji": "🧴",
  "unitAr": "2 لتر",
  "price": 14.0,
  "marketPrice": 14.0,
  "sizes": [
   {
    "unitAr": "2 لتر",
    "price": 14.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "cleaning_7",
  "categoryId": "cleaning",
  "nameAr": "منظف زجاج",
  "brand": "",
  "emoji": "🪟",
  "unitAr": "750 مل",
  "price": 9.0,
  "marketPrice": 9.0,
  "sizes": [
   {
    "unitAr": "750 مل",
    "price": 9.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "cleaning_8",
  "categoryId": "cleaning",
  "nameAr": "منظف حمامات",
  "brand": "",
  "emoji": "🚿",
  "unitAr": "750 مل",
  "price": 11.0,
  "marketPrice": 11.0,
  "sizes": [
   {
    "unitAr": "750 مل",
    "price": 11.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "cleaning_9",
  "categoryId": "cleaning",
  "nameAr": "منظف مطابخ",
  "brand": "",
  "emoji": "🍽️",
  "unitAr": "750 مل",
  "price": 11.0,
  "marketPrice": 11.0,
  "sizes": [
   {
    "unitAr": "750 مل",
    "price": 11.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "cleaning_10",
  "categoryId": "cleaning",
  "nameAr": "معطر جو",
  "brand": "",
  "emoji": "🌸",
  "unitAr": "300 مل",
  "price": 12.0,
  "marketPrice": 12.0,
  "sizes": [
   {
    "unitAr": "300 مل",
    "price": 12.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "cleaning_11",
  "categoryId": "cleaning",
  "nameAr": "مبيد حشرات",
  "brand": "",
  "emoji": "🦟",
  "unitAr": "400 مل",
  "price": 16.0,
  "marketPrice": 16.0,
  "sizes": [
   {
    "unitAr": "400 مل",
    "price": 16.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "cleaning_12",
  "categoryId": "cleaning",
  "nameAr": "أكياس قمامة كبيرة",
  "brand": "",
  "emoji": "🗑️",
  "unitAr": "50 كيس",
  "price": 14.0,
  "marketPrice": 14.0,
  "sizes": [
   {
    "unitAr": "50 كيس",
    "price": 14.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "cleaning_13",
  "categoryId": "cleaning",
  "nameAr": "أكياس قمامة صغيرة",
  "brand": "",
  "emoji": "🗑️",
  "unitAr": "50 كيس",
  "price": 9.0,
  "marketPrice": 9.0,
  "sizes": [
   {
    "unitAr": "50 كيس",
    "price": 9.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "cleaning_14",
  "categoryId": "cleaning",
  "nameAr": "قفازات تنظيف",
  "brand": "",
  "emoji": "🧤",
  "unitAr": "زوج",
  "price": 6.0,
  "marketPrice": 6.0,
  "sizes": [
   {
    "unitAr": "زوج",
    "price": 6.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "cleaning_15",
  "categoryId": "cleaning",
  "nameAr": "إسفنج جلي",
  "brand": "",
  "emoji": "🧽",
  "unitAr": "6 حبات",
  "price": 7.0,
  "marketPrice": 7.0,
  "sizes": [
   {
    "unitAr": "6 حبات",
    "price": 7.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "cleaning_16",
  "categoryId": "cleaning",
  "nameAr": "ليفة تنظيف",
  "brand": "",
  "emoji": "🧽",
  "unitAr": "3 حبات",
  "price": 5.0,
  "marketPrice": 5.0,
  "sizes": [
   {
    "unitAr": "3 حبات",
    "price": 5.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "cleaning_17",
  "categoryId": "cleaning",
  "nameAr": "ورق مطبخ",
  "brand": "",
  "emoji": "🧻",
  "unitAr": "4 لفات",
  "price": 14.0,
  "marketPrice": 14.0,
  "sizes": [
   {
    "unitAr": "4 لفات",
    "price": 14.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "cleaning_18",
  "categoryId": "cleaning",
  "nameAr": "مناديل ورقية",
  "brand": "",
  "emoji": "🧻",
  "unitAr": "5 علب",
  "price": 15.0,
  "marketPrice": 15.0,
  "sizes": [
   {
    "unitAr": "5 علب",
    "price": 15.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "cleaning_19",
  "categoryId": "cleaning",
  "nameAr": "مناديل حمام",
  "brand": "",
  "emoji": "🧻",
  "unitAr": "12 لفة",
  "price": 28.0,
  "marketPrice": 28.0,
  "sizes": [
   {
    "unitAr": "12 لفة",
    "price": 28.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "cleaning_20",
  "categoryId": "cleaning",
  "nameAr": "ورق ألمنيوم",
  "brand": "",
  "emoji": "📦",
  "unitAr": "30 متر",
  "price": 12.0,
  "marketPrice": 12.0,
  "sizes": [
   {
    "unitAr": "30 متر",
    "price": 12.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "cleaning_21",
  "categoryId": "cleaning",
  "nameAr": "ورق زبدة",
  "brand": "",
  "emoji": "📦",
  "unitAr": "20 متر",
  "price": 10.0,
  "marketPrice": 10.0,
  "sizes": [
   {
    "unitAr": "20 متر",
    "price": 10.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "cleaning_22",
  "categoryId": "cleaning",
  "nameAr": "أكياس حفظ طعام",
  "brand": "",
  "emoji": "📦",
  "unitAr": "50 كيس",
  "price": 8.0,
  "marketPrice": 8.0,
  "sizes": [
   {
    "unitAr": "50 كيس",
    "price": 8.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "care_1",
  "categoryId": "care",
  "nameAr": "شامبو",
  "brand": "",
  "emoji": "🧴",
  "unitAr": "400 مل",
  "price": 18.0,
  "marketPrice": 18.0,
  "sizes": [
   {
    "unitAr": "400 مل",
    "price": 18.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "care_2",
  "categoryId": "care",
  "nameAr": "بلسم شعر",
  "brand": "",
  "emoji": "🧴",
  "unitAr": "400 مل",
  "price": 18.0,
  "marketPrice": 18.0,
  "sizes": [
   {
    "unitAr": "400 مل",
    "price": 18.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "care_3",
  "categoryId": "care",
  "nameAr": "صابون استحمام",
  "brand": "",
  "emoji": "🧼",
  "unitAr": "4 قطع",
  "price": 12.0,
  "marketPrice": 12.0,
  "sizes": [
   {
    "unitAr": "4 قطع",
    "price": 12.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "care_4",
  "categoryId": "care",
  "nameAr": "جل استحمام",
  "brand": "",
  "emoji": "🧴",
  "unitAr": "500 مل",
  "price": 16.0,
  "marketPrice": 16.0,
  "sizes": [
   {
    "unitAr": "500 مل",
    "price": 16.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "care_5",
  "categoryId": "care",
  "nameAr": "صابون سائل لليدين",
  "brand": "",
  "emoji": "🧼",
  "unitAr": "500 مل",
  "price": 10.0,
  "marketPrice": 10.0,
  "sizes": [
   {
    "unitAr": "500 مل",
    "price": 10.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "care_6",
  "categoryId": "care",
  "nameAr": "معجون أسنان",
  "brand": "",
  "emoji": "🪥",
  "unitAr": "100 مل",
  "price": 9.0,
  "marketPrice": 9.0,
  "sizes": [
   {
    "unitAr": "100 مل",
    "price": 9.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "care_7",
  "categoryId": "care",
  "nameAr": "فرشاة أسنان",
  "brand": "",
  "emoji": "🪥",
  "unitAr": "حبة",
  "price": 7.0,
  "marketPrice": 7.0,
  "sizes": [
   {
    "unitAr": "حبة",
    "price": 7.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "care_8",
  "categoryId": "care",
  "nameAr": "غسول فم",
  "brand": "",
  "emoji": "🪥",
  "unitAr": "500 مل",
  "price": 16.0,
  "marketPrice": 16.0,
  "sizes": [
   {
    "unitAr": "500 مل",
    "price": 16.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "care_9",
  "categoryId": "care",
  "nameAr": "مزيل عرق",
  "brand": "",
  "emoji": "🧴",
  "unitAr": "150 مل",
  "price": 12.0,
  "marketPrice": 12.0,
  "sizes": [
   {
    "unitAr": "150 مل",
    "price": 12.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "care_10",
  "categoryId": "care",
  "nameAr": "كريم مرطب",
  "brand": "",
  "emoji": "🧴",
  "unitAr": "200 مل",
  "price": 14.0,
  "marketPrice": 14.0,
  "sizes": [
   {
    "unitAr": "200 مل",
    "price": 14.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "care_11",
  "categoryId": "care",
  "nameAr": "كريم حلاقة",
  "brand": "",
  "emoji": "🪒",
  "unitAr": "200 مل",
  "price": 14.0,
  "marketPrice": 14.0,
  "sizes": [
   {
    "unitAr": "200 مل",
    "price": 14.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "care_12",
  "categoryId": "care",
  "nameAr": "شفرات حلاقة",
  "brand": "",
  "emoji": "🪒",
  "unitAr": "5 حبات",
  "price": 16.0,
  "marketPrice": 16.0,
  "sizes": [
   {
    "unitAr": "5 حبات",
    "price": 16.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "care_13",
  "categoryId": "care",
  "nameAr": "مناشف ورقية مبللة",
  "brand": "",
  "emoji": "🧻",
  "unitAr": "72 منديل",
  "price": 9.0,
  "marketPrice": 9.0,
  "sizes": [
   {
    "unitAr": "72 منديل",
    "price": 9.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "care_14",
  "categoryId": "care",
  "nameAr": "فوط نسائية",
  "brand": "",
  "emoji": "🌸",
  "unitAr": "10 قطع",
  "price": 10.0,
  "marketPrice": 10.0,
  "sizes": [
   {
    "unitAr": "10 قطع",
    "price": 10.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "care_15",
  "categoryId": "care",
  "nameAr": "قطن طبي",
  "brand": "",
  "emoji": "☁️",
  "unitAr": "100 غرام",
  "price": 6.0,
  "marketPrice": 6.0,
  "sizes": [
   {
    "unitAr": "100 غرام",
    "price": 6.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "care_16",
  "categoryId": "care",
  "nameAr": "عيدان تنظيف أذن",
  "brand": "",
  "emoji": "👂",
  "unitAr": "100 عود",
  "price": 5.0,
  "marketPrice": 5.0,
  "sizes": [
   {
    "unitAr": "100 عود",
    "price": 5.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "care_17",
  "categoryId": "care",
  "nameAr": "مقص أظافر",
  "brand": "",
  "emoji": "✂️",
  "unitAr": "حبة",
  "price": 8.0,
  "marketPrice": 8.0,
  "sizes": [
   {
    "unitAr": "حبة",
    "price": 8.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "care_18",
  "categoryId": "care",
  "nameAr": "مشط شعر",
  "brand": "",
  "emoji": "💇",
  "unitAr": "حبة",
  "price": 6.0,
  "marketPrice": 6.0,
  "sizes": [
   {
    "unitAr": "حبة",
    "price": 6.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "care_19",
  "categoryId": "care",
  "nameAr": "جل شعر",
  "brand": "",
  "emoji": "💇",
  "unitAr": "250 مل",
  "price": 14.0,
  "marketPrice": 14.0,
  "sizes": [
   {
    "unitAr": "250 مل",
    "price": 14.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "care_20",
  "categoryId": "care",
  "nameAr": "عطر جسم",
  "brand": "",
  "emoji": "🌸",
  "unitAr": "200 مل",
  "price": 22.0,
  "marketPrice": 22.0,
  "sizes": [
   {
    "unitAr": "200 مل",
    "price": 22.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "baby_1",
  "categoryId": "baby",
  "nameAr": "حفاضات مقاس 1",
  "brand": "",
  "emoji": "🍼",
  "unitAr": "عبوة",
  "price": 45.0,
  "marketPrice": 45.0,
  "sizes": [
   {
    "unitAr": "عبوة",
    "price": 45.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "baby_2",
  "categoryId": "baby",
  "nameAr": "حفاضات مقاس 2",
  "brand": "",
  "emoji": "🍼",
  "unitAr": "عبوة",
  "price": 45.0,
  "marketPrice": 45.0,
  "sizes": [
   {
    "unitAr": "عبوة",
    "price": 45.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "baby_3",
  "categoryId": "baby",
  "nameAr": "حفاضات مقاس 3",
  "brand": "",
  "emoji": "🍼",
  "unitAr": "عبوة",
  "price": 48.0,
  "marketPrice": 48.0,
  "sizes": [
   {
    "unitAr": "عبوة",
    "price": 48.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "baby_4",
  "categoryId": "baby",
  "nameAr": "حفاضات مقاس 4",
  "brand": "",
  "emoji": "🍼",
  "unitAr": "عبوة",
  "price": 50.0,
  "marketPrice": 50.0,
  "sizes": [
   {
    "unitAr": "عبوة",
    "price": 50.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "baby_5",
  "categoryId": "baby",
  "nameAr": "حفاضات مقاس 5",
  "brand": "",
  "emoji": "🍼",
  "unitAr": "عبوة",
  "price": 52.0,
  "marketPrice": 52.0,
  "sizes": [
   {
    "unitAr": "عبوة",
    "price": 52.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "baby_6",
  "categoryId": "baby",
  "nameAr": "مناديل أطفال مبللة",
  "brand": "",
  "emoji": "🧻",
  "unitAr": "72 منديل",
  "price": 9.0,
  "marketPrice": 9.0,
  "sizes": [
   {
    "unitAr": "72 منديل",
    "price": 9.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "baby_7",
  "categoryId": "baby",
  "nameAr": "حليب أطفال مرحلة 1",
  "brand": "",
  "emoji": "🍼",
  "unitAr": "400 غرام",
  "price": 55.0,
  "marketPrice": 55.0,
  "sizes": [
   {
    "unitAr": "400 غرام",
    "price": 55.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "baby_8",
  "categoryId": "baby",
  "nameAr": "حليب أطفال مرحلة 2",
  "brand": "",
  "emoji": "🍼",
  "unitAr": "400 غرام",
  "price": 55.0,
  "marketPrice": 55.0,
  "sizes": [
   {
    "unitAr": "400 غرام",
    "price": 55.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "baby_9",
  "categoryId": "baby",
  "nameAr": "حليب أطفال مرحلة 3",
  "brand": "",
  "emoji": "🍼",
  "unitAr": "400 غرام",
  "price": 52.0,
  "marketPrice": 52.0,
  "sizes": [
   {
    "unitAr": "400 غرام",
    "price": 52.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "baby_10",
  "categoryId": "baby",
  "nameAr": "سيريلاك أرز",
  "brand": "",
  "emoji": "🥣",
  "unitAr": "400 غرام",
  "price": 28.0,
  "marketPrice": 28.0,
  "sizes": [
   {
    "unitAr": "400 غرام",
    "price": 28.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "baby_11",
  "categoryId": "baby",
  "nameAr": "سيريلاك قمح",
  "brand": "",
  "emoji": "🥣",
  "unitAr": "400 غرام",
  "price": 28.0,
  "marketPrice": 28.0,
  "sizes": [
   {
    "unitAr": "400 غرام",
    "price": 28.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "baby_12",
  "categoryId": "baby",
  "nameAr": "بيوريه فواكه للأطفال",
  "brand": "",
  "emoji": "🍎",
  "unitAr": "حبة",
  "price": 6.0,
  "marketPrice": 6.0,
  "sizes": [
   {
    "unitAr": "حبة",
    "price": 6.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "baby_13",
  "categoryId": "baby",
  "nameAr": "شامبو أطفال",
  "brand": "",
  "emoji": "🧴",
  "unitAr": "400 مل",
  "price": 18.0,
  "marketPrice": 18.0,
  "sizes": [
   {
    "unitAr": "400 مل",
    "price": 18.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "baby_14",
  "categoryId": "baby",
  "nameAr": "كريم تسلخات",
  "brand": "",
  "emoji": "🧴",
  "unitAr": "100 مل",
  "price": 16.0,
  "marketPrice": 16.0,
  "sizes": [
   {
    "unitAr": "100 مل",
    "price": 16.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "baby_15",
  "categoryId": "baby",
  "nameAr": "زجاجة رضاعة",
  "brand": "",
  "emoji": "🍼",
  "unitAr": "حبة",
  "price": 22.0,
  "marketPrice": 22.0,
  "sizes": [
   {
    "unitAr": "حبة",
    "price": 22.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "baby_16",
  "categoryId": "baby",
  "nameAr": "مصاصة أطفال",
  "brand": "",
  "emoji": "🍼",
  "unitAr": "حبة",
  "price": 10.0,
  "marketPrice": 10.0,
  "sizes": [
   {
    "unitAr": "حبة",
    "price": 10.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "baby_17",
  "categoryId": "baby",
  "nameAr": "بسكويت أطفال",
  "brand": "",
  "emoji": "🍪",
  "unitAr": "180 غرام",
  "price": 9.0,
  "marketPrice": 9.0,
  "sizes": [
   {
    "unitAr": "180 غرام",
    "price": 9.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "household_1",
  "categoryId": "household",
  "nameAr": "أطباق ورقية",
  "brand": "",
  "emoji": "🍽️",
  "unitAr": "25 حبة",
  "price": 10.0,
  "marketPrice": 10.0,
  "sizes": [
   {
    "unitAr": "25 حبة",
    "price": 10.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "household_2",
  "categoryId": "household",
  "nameAr": "أكواب ورقية",
  "brand": "",
  "emoji": "🥤",
  "unitAr": "50 حبة",
  "price": 12.0,
  "marketPrice": 12.0,
  "sizes": [
   {
    "unitAr": "50 حبة",
    "price": 12.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "household_3",
  "categoryId": "household",
  "nameAr": "ملاعق بلاستيك",
  "brand": "",
  "emoji": "🥄",
  "unitAr": "50 حبة",
  "price": 7.0,
  "marketPrice": 7.0,
  "sizes": [
   {
    "unitAr": "50 حبة",
    "price": 7.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "household_4",
  "categoryId": "household",
  "nameAr": "شوك بلاستيك",
  "brand": "",
  "emoji": "🍴",
  "unitAr": "50 حبة",
  "price": 7.0,
  "marketPrice": 7.0,
  "sizes": [
   {
    "unitAr": "50 حبة",
    "price": 7.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "household_5",
  "categoryId": "household",
  "nameAr": "سكاكين بلاستيك",
  "brand": "",
  "emoji": "🔪",
  "unitAr": "50 حبة",
  "price": 7.0,
  "marketPrice": 7.0,
  "sizes": [
   {
    "unitAr": "50 حبة",
    "price": 7.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "household_6",
  "categoryId": "household",
  "nameAr": "مفارش طاولة",
  "brand": "",
  "emoji": "🍽️",
  "unitAr": "10 حبات",
  "price": 12.0,
  "marketPrice": 12.0,
  "sizes": [
   {
    "unitAr": "10 حبات",
    "price": 12.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "household_7",
  "categoryId": "household",
  "nameAr": "شموع",
  "brand": "",
  "emoji": "🕯️",
  "unitAr": "6 حبات",
  "price": 8.0,
  "marketPrice": 8.0,
  "sizes": [
   {
    "unitAr": "6 حبات",
    "price": 8.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "household_8",
  "categoryId": "household",
  "nameAr": "ولاعة",
  "brand": "",
  "emoji": "🔥",
  "unitAr": "حبة",
  "price": 3.0,
  "marketPrice": 3.0,
  "sizes": [
   {
    "unitAr": "حبة",
    "price": 3.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "household_9",
  "categoryId": "household",
  "nameAr": "فحم شواء",
  "brand": "",
  "emoji": "🔥",
  "unitAr": "3 كغم",
  "price": 18.0,
  "marketPrice": 18.0,
  "sizes": [
   {
    "unitAr": "3 كغم",
    "price": 18.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "household_10",
  "categoryId": "household",
  "nameAr": "أعواد أسنان",
  "brand": "",
  "emoji": "🦷",
  "unitAr": "علبة",
  "price": 3.0,
  "marketPrice": 3.0,
  "sizes": [
   {
    "unitAr": "علبة",
    "price": 3.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "household_11",
  "categoryId": "household",
  "nameAr": "بطاريات AA",
  "brand": "",
  "emoji": "🔋",
  "unitAr": "4 حبات",
  "price": 10.0,
  "marketPrice": 10.0,
  "sizes": [
   {
    "unitAr": "4 حبات",
    "price": 10.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "household_12",
  "categoryId": "household",
  "nameAr": "بطاريات AAA",
  "brand": "",
  "emoji": "🔋",
  "unitAr": "4 حبات",
  "price": 10.0,
  "marketPrice": 10.0,
  "sizes": [
   {
    "unitAr": "4 حبات",
    "price": 10.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "household_13",
  "categoryId": "household",
  "nameAr": "لمبة LED",
  "brand": "",
  "emoji": "💡",
  "unitAr": "حبة",
  "price": 12.0,
  "marketPrice": 12.0,
  "sizes": [
   {
    "unitAr": "حبة",
    "price": 12.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "household_14",
  "categoryId": "household",
  "nameAr": "حبل غسيل",
  "brand": "",
  "emoji": "🧵",
  "unitAr": "10 متر",
  "price": 10.0,
  "marketPrice": 10.0,
  "sizes": [
   {
    "unitAr": "10 متر",
    "price": 10.0
   }
  ],
  "available": true,
  "imageUrl": ""
 },
 {
  "id": "household_15",
  "categoryId": "household",
  "nameAr": "ملاقط غسيل",
  "brand": "",
  "emoji": "📎",
  "unitAr": "24 حبة",
  "price": 8.0,
  "marketPrice": 8.0,
  "sizes": [
   {
    "unitAr": "24 حبة",
    "price": 8.0
   }
  ],
  "available": true,
  "imageUrl": ""
 }
];

const getDb = (req) => req.app.get('db');

// GET /api/mart_categories — الأقسام
router.get('/mart_categories', (req, res) => res.json(MART_CATEGORIES));

// GET /api/mart_products — الكتالوج (مع أي تعديلات محفوظة بقاعدة البيانات)
router.get('/', async (req, res) => {
  try {
    const db = getDb(req);
    if (!db) return res.json(defaultMartProducts);
    let overrides = {};
    try {
      const snap = await db.collection('mart_products').get();
      snap.forEach(doc => { overrides[doc.id] = doc.data(); });
    } catch (e) {
      return res.json(defaultMartProducts); // حصة منتهية أو خطأ → الكتالوج الأساسي
    }
    // دمج: الأساسي + أي تعديل سعر/توفر + منتجات أضافها المدير
    const baseIds = new Set(defaultMartProducts.map(p => String(p.id)));
    const merged = defaultMartProducts.map(p => {
      const o = overrides[String(p.id)];
      return o ? { ...p, ...o, id: p.id } : p;
    }).filter(p => p.available !== false);
    Object.keys(overrides).forEach(id => {
      if (!baseIds.has(String(id)) && overrides[id].available !== false) {
        merged.push({ ...overrides[id], id });
      }
    });
    res.json(merged);
  } catch (error) {
    res.json(defaultMartProducts);
  }
});

// POST /api/mart_products — إضافة/تحديث منتج
router.post('/', async (req, res) => {
  try {
    const db = getDb(req);
    if (!db) return res.status(503).json({ success: false, error: 'Database not connected' });
    const p = req.body || {};
    const id = p.id || ('prod_' + Date.now());
    await db.collection('mart_products').doc(String(id)).set({ ...p, id }, { merge: true });
    res.status(201).json({ success: true, id });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /api/mart_products/:id — تعديل سعر أو توفر
router.patch('/:id', async (req, res) => {
  try {
    const db = getDb(req);
    if (!db) return res.status(503).json({ success: false, error: 'Database not connected' });
    const id = String(req.params.id);
    const base = defaultMartProducts.find(x => String(x.id) === id);
    await db.collection('mart_products').doc(id).set({ ...(base || {}), ...req.body, id }, { merge: true });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /api/mart_products/bulk/category — تعديل أسعار قسم كامل بنسبة مئوية
router.patch('/bulk/category', async (req, res) => {
  try {
    const db = getDb(req);
    if (!db) return res.status(503).json({ success: false, error: 'Database not connected' });
    const { categoryId, percent } = req.body || {};
    const pct = Number(percent);
    if (!categoryId || isNaN(pct)) return res.status(400).json({ success: false, error: 'categoryId و percent مطلوبان' });
    const items = defaultMartProducts.filter(p => p.categoryId === categoryId);
    const batch = db.batch();
    items.forEach(p => {
      const np = Math.round(p.price * (1 + pct / 100) * 100) / 100;
      batch.set(db.collection('mart_products').doc(String(p.id)), { ...p, price: np, marketPrice: np }, { merge: true });
    });
    await batch.commit();
    res.json({ success: true, updated: items.length, percent: pct });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/mart_products/:id
router.delete('/:id', async (req, res) => {
  try {
    const db = getDb(req);
    if (!db) return res.status(503).json({ success: false, error: 'Database not connected' });
    await db.collection('mart_products').doc(String(req.params.id)).set({ available: false }, { merge: true });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
