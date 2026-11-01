// =========================================================================
// NOURII STORE - GOOGLE APPS SCRIPT BACKEND ENGINE (قاعدة بيانات GOOGLE DRIVE)
// =========================================================================
// هذا السكربت يعمل كـ Backend رئيسي وقاعدة بيانات حية في Google Drive / Google Sheets
// يحتوي تلقائياً على كافة بيانات الموقع (الـ 27 منتج والـ 10 أقسام والمستخدمين والأوردرات)
// =========================================================================

const INITIAL_CATEGORIES_SEED = [
  [
    "concrete",
    "كونكريت للتلوين",
    "Concrete for Coloring",
    "fa-palette",
    "assets/images/concrete-coloring.jpg",
    "مجسمات وأشكال كونكريت وجبس مجهزة للتلوين للأطفال والكبار مع ألوان وفرش لإطلاق العنان للإبداع.",
    "Handcrafted concrete figurines and letters ready for painting with included colors and brushes."
  ],
  [
    "coloring_books",
    "كتب تلوين",
    "Coloring Books",
    "fa-book-open",
    "assets/images/coloring-books.jpg",
    "كتب ودفاتر تلوين ورقية برسومات مانديلا وزخارف هندسية وحيوانات مع ألوان خشبية.",
    "Mindful Mandala, geometric patterns, and African safari coloring books with color pencils."
  ],
  [
    "magnets_brooches",
    "صور مغناطيس و بروش",
    "Magnets & Brooches",
    "fa-certificate",
    "assets/images/magnets-brooches.jpg",
    "مغناطيس ثلاجة عائلي مخصص وبروشات خشبية ومعدنية لطيفة لكافة المهن والشخصيات.",
    "Custom family photo fridge magnets, wooden pins, and cute career badges."
  ],
  [
    "event_favors",
    "توزيعات مناسبات",
    "Event Favors & Giveaways",
    "fa-gift",
    "assets/images/event-favors.jpg",
    "توزيعات فاخرة للسبوع، المواليد، الخطوبة، عقد القران، وحنة العروس مطبوعة بالأسماء.",
    "Luxury personalized favors for newborn baby showers, engagements, weddings, and henna."
  ],
  [
    "notebooks",
    "نوت بوك",
    "Notebooks & Planners",
    "fa-book-bookmark",
    "assets/images/notebooks.jpg",
    "دفاتر ومفكرات يومية بأغلفة مخملية منقوشة بالذهب، قوائم مهام، وأقلام راقية.",
    "Custom velvet & faux-leather planners embossed in gold foil with to-do lists and luxury pens."
  ],
  [
    "islamic_prints",
    "مطبوعات دينية",
    "Islamic Prints",
    "fa-mosque",
    "assets/images/islamic-prints.jpg",
    "مصاحف سورة البقرة مخملية فاخرة، كروت أذكار الصباح والمساء، وباقات صدقة جارية.",
    "Royal velvet Quran covers, laminated Azkar morning/evening cards, and Sadaqah Jariyah favor packs."
  ],
  [
    "educational_kids",
    "ادوات تعليمية للاطفال",
    "Educational Kids Tools",
    "fa-shapes",
    "assets/images/educational-kids.jpg",
    "بطاقات الحروف الهجائية، كتاب أبجد هوز، وسائل تفاعلية، وأرقام ومكعبات خشبية مبتكرة.",
    "Arabic alphabet flashcards, interactive learning workbooks, wooden blocks, and educational kits."
  ],
  [
    "luxury_prints",
    "مطبوعات",
    "Luxury Prints & Stationery",
    "fa-envelope-open-text",
    "assets/images/luxury-prints.jpg",
    "كروت إهداء مع أختام شمع راقية، فواصل كتب باقتباسات ملهمة، وأكياس هدايا فخمة.",
    "Wax-sealed luxury envelopes, quote bookmarks, gift tags, and embossed celebration gift bags."
  ],
  [
    "stickers",
    "استيكرز",
    "Stickers & Washi Tapes",
    "fa-note-sticky",
    "assets/images/stickers.jpg",
    "استيكرز فينيل ضد الماء (الفنان الصغير)، عبارات تحفيزية، وشرائط واشي تيب مبهجة.",
    "Waterproof vinyl sticker packs, motivational artist decals, and colorful decorative washi tapes."
  ],
  [
    "others",
    "اخرى",
    "Others & Home Accents",
    "fa-gem",
    "assets/images/others.jpg",
    "قواعد أكواب ريزن بالورد الطبيعي، ميداليات جلدية منقوشة، فواحات عطرية خزفية وبراويز ميني.",
    "Real dried-flower resin coasters, genuine leather keychains, ceramic reed diffusers, and 3D frames."
  ]
];

const INITIAL_PRODUCTS_SEED = [
  [
    "prod-conc-1",
    "concrete",
    "بوكس الفنان الصغير لتلوين الكونكريت",
    "Little Artist Concrete Painting Kit",
    195,
    240,
    "assets/images/concrete-coloring.jpg",
    "الأكثر طلباً ⭐",
    "Best Seller",
    4.9,
    38,
    true,
    "الاسم أو الشكل المفضل (بومة / فيل / مئذنة)",
    "Preferred Figurine (Owl / Elephant / Minaret)",
    "مجموعة فنية متكاملة تحتوي على مجسمات كونكريت ناعمة الملمس وجاهزة للتلوين، 6 ألوان أكريليك زاهية آمنة للأطفال، فرش رسم، وباليت لتفريغ الألوان.",
    "Complete artistic DIY kit featuring smooth handcrafted concrete figurines, 6 vibrant non-toxic paints, brushes, and a palette.",
    "2026-10-09T18:00:16.164Z"
  ],
  [
    "prod-conc-2",
    "concrete",
    "مجسم مئذنة ومسجد كونكريت للتلوين",
    "Concrete Mosque & Minaret Painting Craft",
    120,
    150,
    "assets/images/concrete-coloring.jpg",
    "مميز للمناسبات 🌙",
    "Special Edition",
    5,
    24,
    true,
    "الاسم المراد نقشه على القاعدة (اختياري)",
    "Name to engrave on base (optional)",
    "مجسم هندسي أنيق لمسجد ومئذنة مصنوع من الكونكريت المصقول، نشاط روحاني وإبداعي رائع للأطفال في شهر رمضان والأعياد.",
    "Handcrafted architectural concrete mosque and minaret figurine ready to paint with included warm tones.",
    "2026-10-09T18:00:16.165Z"
  ],
  [
    "prod-conc-3",
    "concrete",
    "طقم حروف كونكريت مخصصة باسمك مع ألوان",
    "Personalized Concrete Name Letters with Paints",
    160,
    190,
    "assets/images/concrete-coloring.jpg",
    "تخصيص كامل ✏️",
    "Fully Custom",
    4.8,
    19,
    true,
    "اكتب الحروف أو الاسم المطلوب بالإنجليزية أو العربية",
    "Type name letters (e.g., NOUR)",
    "حروف كونكريت ثلاثية الأبعاد باسم طفلك أو من تحب، تأتي مع علبة ألوان وفرشاة لتلوينها والاحتفاظ بها كقطعة ديكور فريدة.",
    "3D concrete alphabet letters customized with your chosen name, ready for custom painting and keepsake display.",
    "2026-10-09T18:00:16.165Z"
  ],
  [
    "prod-cb-1",
    "coloring_books",
    "كتاب تلوين المانديلا والزخارف الهندسية الفاخر",
    "Mandala & Geometric Designs Premium Coloring Book",
    95,
    120,
    "assets/images/coloring-books.jpg",
    "للاسترخاء 🌸",
    "Relaxing Art",
    4.9,
    42,
    false,
    "",
    "",
    "كتاب تلوين فاخر يحتوي على أكثر من 40 تصميماً من زخارف المانديلا الدقيقة والأشكال الهندسية، مطبوع على ورق سميك عالي الجودة يمنع تسرب الألوان.",
    "Premium coloring book with 40+ intricate mandala and geometric patterns on heavyweight bleed-proof paper.",
    "2026-10-09T18:00:16.165Z"
  ],
  [
    "prod-cb-2",
    "coloring_books",
    "كتيب تلوين حيوانات السفاري الأفريقية مع علبة ألوان",
    "African Safari Creatures Coloring Booklet + Pencils",
    85,
    105,
    "assets/images/coloring-books.jpg",
    "محبوب الأطفال 🦁",
    "Kids Favorite",
    4.9,
    31,
    false,
    "",
    "",
    "كتيب رسومات كرتونية ظريفة لحيوانات الغابة الأفريقية مصمم لتقوية التركيز والتناسق البصري الحركي لدى الأطفال، يشمل علبة 12 قلم تلوين خشبي ناعم.",
    "Charming safari animal coloring booklet for young artists, bundled with a 12-pack of colored pencils.",
    "2026-10-09T18:00:16.165Z"
  ],
  [
    "prod-mb-1",
    "magnets_brooches",
    "مغناطيس ثلاجة عائلي مخصص بشكل قلب",
    "Custom Family Heart Fridge Magnet",
    65,
    85,
    "assets/images/magnets-brooches.jpg",
    "هدية دافئة ❤️",
    "Warm Gift",
    5,
    56,
    true,
    "أفراد العائلة أو الرسمة المطلوبة (أب، أم، أطفال)",
    "Family members to feature (Dad, Mom, Kids)",
    "مغناطيس ثلاجة بقاعدة خشبية بشكل قلب مع رسم كرتوني يمثل عائلتك، مغلف بطبقة حماية لامعة مقاومة للماء والخدوش.",
    "Heart-shaped wooden fridge magnet customized with your family cartoon illustration and waterproof gloss finish.",
    "2026-10-09T18:00:16.165Z"
  ],
  [
    "prod-mb-2",
    "magnets_brooches",
    "مجموعة بروشات ودبابيس المهن اللطيفة",
    "Cute Career Badge Pins & Brooches Set",
    80,
    100,
    "assets/images/magnets-brooches.jpg",
    "أشكال متنوعة 👩‍⚕️",
    "Multi-Style",
    4.8,
    27,
    true,
    "اختر المهنة (طبيب / مهندس / معلم / فنان / شيف)",
    "Select profession (Doctor / Engineer / Teacher / Artist)",
    "دبابيس وبروشات معدنية وخشبية برسومات مميزة لشخصيات المهن، مثالية كهدية تخرج أو للتزيين على الحقائب والملابس.",
    "Delightful profession pins (Doctor, Engineer, Chef, Artist) with secure metal clasp backing.",
    "2026-10-09T18:00:16.165Z"
  ],
  [
    "prod-ef-1",
    "event_favors",
    "توزيعات المواليد والسبوع الملكية (باك 12 قطعة)",
    "Royal Newborn Baby Shower Favors (Pack of 12)",
    280,
    340,
    "assets/images/event-favors.jpg",
    "مواليد جدد 🍼",
    "Baby Shower",
    5,
    64,
    true,
    "اسم المولود وتاريخ المناسبة",
    "Baby Name & Date of Event",
    "علب توزيعات أنيقة برسمة فيل لطيف أو دب كرتوني، تشمل حبات شوكولاتة فاخرة، كيس قماشي مع سبحة ميني، وكارت إهداء مطبوع باسم المولود.",
    "Exquisite baby shower favor boxes with customized baby name tag, luxury chocolate, mini tasbeeh, and pouch.",
    "2026-10-09T18:00:16.165Z"
  ],
  [
    "prod-ef-2",
    "event_favors",
    "طقم توزيعات عقد القران والزفاف الفاخر",
    "Luxury Katb Ktab & Wedding Favor Set",
    450,
    520,
    "assets/images/event-favors.jpg",
    "عقد قران مبارك 💍",
    "Wedding Edition",
    4.9,
    48,
    true,
    "اسمي العروسين وتاريخ عقد القران",
    "Couples Names & Event Date",
    "توزيعات عقد القران الفاخرة تتضمن مصحفاً ميني مخملياً، سبحة كريستالية بلون عنبري، وثيقة عقد قران مصغرة، ومروحة ورقية كلاسيكية.",
    "Luxury Islamic wedding favors with mini velvet Quran, amber-tone tasbeeh, wedding scroll, and silk fan.",
    "2026-10-09T18:00:16.165Z"
  ],
  [
    "prod-ef-3",
    "event_favors",
    "مجموعة توزيعات حنة العروس التراثية",
    "Bridal Henna Night Favors Collection",
    390,
    460,
    "assets/images/event-favors.jpg",
    "حنة العروس 🌺",
    "Henna Night",
    4.9,
    22,
    true,
    "اسم العروس للطباعة على الظرف والمرآة",
    "Bride Name for Envelope and Mirror",
    "باقة حنة راقية تشمل مرآة يدوية بزخارف شرقية ملونة، بوكس فانوس مخرم، حبات بخور أو مسك عطري، وظرف إهداء مطبوع بعبارة حنة العروس.",
    "Authentic bridal henna favors featuring oriental hand mirror, die-cut lantern box, and perfumed musk.",
    "2026-10-09T18:00:16.165Z"
  ],
  [
    "prod-nb-1",
    "notebooks",
    "نوت بوك ملكي جلد وردي منقوش بالذهب باسمك",
    "Rose Gold Foil Personalized Leather Journal",
    175,
    220,
    "assets/images/notebooks.jpg",
    "تطريز ذهبي ✨",
    "Gold Foil Name",
    5,
    52,
    true,
    "الاسم المراد نقشه بالذهب (مثال: نور / سارة)",
    "Name to engrave in gold (e.g., Noor)",
    "نوت بوك جلدي فاخر بلون وردي ناعم، منقوش عليه اسمك بخط عربي ديواني باللون الذهبي البارز، مع أوراق عاجية مسطرة 100 جرام وشريط إشارة حريري.",
    "Sophisticated dusty rose faux-leather journal with your name stamped in gold Arabic calligraphy on 100gsm cream paper.",
    "2026-10-09T18:00:16.165Z"
  ],
  [
    "prod-nb-2",
    "notebooks",
    "طقم التدوين المتكامل (نوت بوك + To Do List + قلم ذهبي)",
    "Executive Stationery Gift Set (Journal + Notepad + Gold Pen)",
    260,
    310,
    "assets/images/notebooks.jpg",
    "طقم هدايا راقي 🎁",
    "Full Gift Set",
    4.9,
    39,
    true,
    "الاسم المطلوب على النوت بوك والقلم",
    "Name for Journal and Pen engraving",
    "طقم هدية متكامل يشمل دفتر يوميات، مفكرة مهام يومية (To Do List)، نوتباد صغير، قلم ذهبي منقوش بالاسم، ومشبك ذهبي أنيق مع شريط واشي تيب.",
    "Complete desk gift set including journal, tear-off daily task pad, pocket notepad, custom engraved gold pen, and clips.",
    "2026-10-09T18:00:16.165Z"
  ],
  [
    "prod-ip-1",
    "islamic_prints",
    "مصحف سورة البقرة مخمل ملكي أخضر مع قلم مذهب",
    "Royal Green Velvet Surah Al-Baqarah Quran + Gold Pen",
    220,
    270,
    "assets/images/islamic-prints.jpg",
    "مخمل ملكي 🌿",
    "Royal Velvet",
    5,
    59,
    true,
    "اسم الإهداء أو الصدقة الجارية (اختياري)",
    "Dedication or Name (optional)",
    "مصحف سورة البقرة كاملة بغلاف مخملي أخضر زمردي بنقوش عربية ذهبية بارزة، مع قلم أنيق وحافظة مخملية وكرت أذكار الصباح والمساء.",
    "Exquisite emerald-green velvet cover Surah Al-Baqarah edition with gilded ornaments, gold pen, and Azkar card.",
    "2026-10-09T18:00:16.165Z"
  ],
  [
    "prod-ip-2",
    "islamic_prints",
    "كروت أذكار الصباح والمساء وأذكار بعد الصلاة (مصفحة)",
    "Laminated Morning & Evening Azkar Card Set",
    75,
    95,
    "assets/images/islamic-prints.jpg",
    "حجم مناسب للجيب 📿",
    "Pocket Size",
    4.9,
    44,
    false,
    "",
    "",
    "كروت أنيقة مطبوعة بخط واضح ومصفحة بطبقة حماية ضد التلف والماء، تضم أذكار الصباح والمساء كاملة وأذكار ما بعد الصلوات المكتوبة.",
    "Crystal-clear laminated Azkar cards for daily remembrance, pocket-sized and protected against water and wear.",
    "2026-10-09T18:00:16.165Z"
  ],
  [
    "prod-ip-3",
    "islamic_prints",
    "باقات صدقة جارية مخصصة (باك 20 كارت وميني مصحف)",
    "Custom Sadaqah Jariyah Remembrance Pack (20 Units)",
    350,
    420,
    "assets/images/islamic-prints.jpg",
    "صدقة جارية 🤲",
    "Sadaqah Jariyah",
    5,
    36,
    true,
    "اسم المتوفى أو صاحب الصدقة للدعاء",
    "Name for Dedication and Prayers",
    "باقات توزيعات راقية مع ربطة فيونكة ستان خضراء وذهبية، تشمل مصاحف ميني وكروت دعاء مطبوعة باسم من تحبون كصدقة جارية.",
    "Elegantly wrapped memorial gift favors with ribbon bows, mini Qurans, and personalized dua cards.",
    "2026-10-09T18:00:16.165Z"
  ],
  [
    "prod-ek-1",
    "educational_kids",
    "كتاب تفاعلي أبجد هوز لتعليم القراءة والكتابة",
    "Interactive Abjad Hawaz Arabic Alphabet Activity Book",
    145,
    180,
    "assets/images/educational-kids.jpg",
    "تفاعلي وممتع 🧩",
    "Interactive Fun",
    4.9,
    47,
    true,
    "اسم الطفل للطباعة على غلاف الكتاب",
    "Child's name for cover customization",
    "كتاب ألعاب تعليمية ملون يدمج بين المرح والتعلم، يحتوي على أنشطة تتبع الحروف، تلوين الكلمات، وتوصيل الحروف بالأشياء اليومية.",
    "Engaging hardcover educational book teaching Arabic alphabet and phonetics through playful exercises.",
    "2026-10-09T18:00:16.165Z"
  ],
  [
    "prod-ek-2",
    "educational_kids",
    "فلاش كاردز الحروف والحيوانات التفاعلية للأطفال",
    "Arabic Alphabet & Animals Flashcards Set",
    95,
    120,
    "assets/images/educational-kids.jpg",
    "كرتون متين 🍎",
    "Durable Cards",
    4.8,
    29,
    false,
    "",
    "",
    "28 بطاقة تعليمية سميكة بحواف دائرية آمنة، مطبوعة برسومات ملونة وأسماء واضحة (أ - تفاحة، د - دب، س - سيارة) لتوسيع المفردات اللغوية للطفل.",
    "28 thick rounded-edge flashcards showcasing Arabic letters and illustrated vocabulary words.",
    "2026-10-09T18:00:16.165Z"
  ],
  [
    "prod-ek-3",
    "educational_kids",
    "حقيبة التوزيعات التعليمية الذكية (مكعبات + عدسة + بوصلة)",
    "Little Explorer Educational Favor Kit (Blocks + Lens)",
    185,
    225,
    "assets/images/educational-kids.jpg",
    "المستكشف الصغير 🔍",
    "Young Explorer",
    4.9,
    21,
    true,
    "اسم المناسبة أو أسماء الأطفال",
    "Event or Children's Names",
    "حقيبة هدايا تعليمية في أظرف قماشية ملونة، تحتوي على عدسة مكبرة للاستكشاف، بوصلة صغيرة، ومكعبات بناء ملونة مع قلم ممتع.",
    "Fabric pouch favor kit packed with a magnifying glass, beginner compass, building blocks, and an activity pen.",
    "2026-10-09T18:00:16.165Z"
  ],
  [
    "prod-lp-1",
    "luxury_prints",
    "أظرف كلاسيكية فاخرة بختم شمع حقيقي وكروت تهنئة",
    "Real Wax-Sealed Classic Gift Envelopes & Cards",
    110,
    135,
    "assets/images/luxury-prints.jpg",
    "ختم شمع ملكي ✉️",
    "Wax Sealed",
    5,
    38,
    true,
    "العبارة المطبوعة (تهانينا / مبروك / لك)",
    "Printed Text (Congratulations / For You / Mabrouk)",
    "أظرف راقية بلون أخضر ملكي وعاجي مغلقة بأختام شمع ذهبية مع كروت تهنئة سميكة بحروف محفورة بالذهب لمناسباتكم الخاصة.",
    "Luxury textured stationery envelopes with authentic gold wax seals and gold foil letterpress cards.",
    "2026-10-09T18:00:16.165Z"
  ],
  [
    "prod-lp-2",
    "luxury_prints",
    "طقم فواصل كتب فاخرة باقتباسات ملهمة (3 قطع)",
    "Inspiring Quotes Luxury Bookmark Set (Pack of 3)",
    60,
    75,
    "assets/images/luxury-prints.jpg",
    "لعشاق القراءة 📖",
    "Book Lovers",
    4.8,
    26,
    false,
    "",
    "",
    "ثلاثة فواصل كتب مطبوعة على ورق قطني سميك برسومات فنية وتطريز أشرطة قماشية فاخرة، مع عبارات اقتباس اليوم وشكراً.",
    "Set of 3 artistic cotton-paper bookmarks featuring warm botanical illustrations, quote typography, and ribbon ties.",
    "2026-10-09T18:00:16.165Z"
  ],
  [
    "prod-lp-3",
    "luxury_prints",
    "أكياس هدايا راقية بنقش ذهبي بارز لمناسباتكم الخاصة",
    "Embossed Luxury Gift Bags with Fabric Handles",
    85,
    110,
    "assets/images/luxury-prints.jpg",
    "تقديم فاخر 🛍️",
    "Luxury Bag",
    4.9,
    19,
    true,
    "اختر العبارة (مناسبة خاصة / أطيب التمنيات)",
    "Choose Text (Special Occasion / Best Wishes)",
    "حقائب هدايا كرتونية فاخرة متوفرة بالأزرق الكحلي والأبيض العاجي، بنقوش إسلامية بارزة وطباعة ذهبية وحزام يد قماشي متين.",
    "High-density embossed paper gift bags with opulent arabesque patterns and sturdy woven handles.",
    "2026-10-09T18:00:16.165Z"
  ],
  [
    "prod-st-1",
    "stickers",
    "باك استيكرز الفنان الصغير ضد الماء والتمزق",
    "Little Artist Waterproof Vinyl Sticker Pack",
    55,
    70,
    "assets/images/stickers.jpg",
    "مقاوم للماء 🎨",
    "Waterproof Vinyl",
    4.9,
    45,
    false,
    "",
    "",
    "مجموعة ملصقات فينيل عالية الجودة بتصاميم كرتونية مرحة لأدوات الرسم والفرش والألوان وشخصيات الفنان الصغير، مثالية لتزيين الدفاتر واللابتوب.",
    "Vibrant vinyl die-cut stickers depicting art supplies, mini easels, and cute artist characters; fully waterproof.",
    "2026-10-09T18:00:16.165Z"
  ],
  [
    "prod-st-2",
    "stickers",
    "شيت استيكرز عبارات تحفيزية ونجوم ذهبية",
    "Motivational Stars & Quotes Sticker Sheet",
    45,
    60,
    "assets/images/stickers.jpg",
    "تشجيع للأطفال ⭐",
    "Motivational",
    4.8,
    33,
    false,
    "",
    "",
    "شيت ملصقات مميز بعبارات تحفيزية مشجعة مثل (الفن حياة، أنا فنان، أرسم مستقبلي) مع نجوم ذهبية لامعة لتكريم ومكافأة الأطفال.",
    "Inspiring reward stickers with gold metallic stars and positive affirmation quotes in Arabic calligraphy.",
    "2026-10-09T18:00:16.165Z"
  ],
  [
    "prod-st-3",
    "stickers",
    "طقم شرائط واشي تيب مبهجة للتزيين (3 رولات)",
    "Artistic Decorative Washi Tape Rolls (Set of 3)",
    75,
    95,
    "assets/images/stickers.jpg",
    "تزيين الدفاتر ✂️",
    "Washi Tape Set",
    4.9,
    22,
    false,
    "",
    "",
    "ثلاثة رولات واشي تيب ورقية يابانية سهلة اللصق والنزع بنقوش أدوات رسم وألوان مائية، لتزيين اليوميات والبطاقات والعلب.",
    "Trio of premium Japanese washi tape rolls featuring colorful palette and paintbrush motifs; peel-and-stick.",
    "2026-10-09T18:00:16.165Z"
  ],
  [
    "prod-ot-1",
    "others",
    "قواعد أكواب ريزن بالورد الطبيعي المجفف والذهب",
    "Real Pressed Flower & Gold Leaf Resin Coaster Set",
    160,
    200,
    "assets/images/others.jpg",
    "صناعة يدوية فريدة 🌸",
    "Handmade Resin",
    5,
    37,
    true,
    "ألوان الزهور المفضلة (وردي / أبيض / لافندر)",
    "Flower color preference (Pink / White / Lavender)",
    "قواعد أكواب فاخرة مصنوعة يدوياً من الريزن الشفاف عالي النقاوة، مدمجة بزهور طبيعية مجففة بعناية ورقائق ذهب عيار 24.",
    "Hand-poured crystal clear resin coasters with real preserved botanical flowers and subtle gold flakes.",
    "2026-10-09T18:00:16.165Z"
  ],
  [
    "prod-ot-2",
    "others",
    "ميداليات مفاتيح جلدية طبيعية مع دلاية معدنية",
    "Handcrafted Leather Keychain with Bronze Charm",
    90,
    115,
    "assets/images/others.jpg",
    "جلد طبيعي 🔑",
    "Genuine Leather",
    4.8,
    28,
    true,
    "الحرف أو الاسم المراد نقشه على الجلد",
    "Initial or Name to stamp on leather",
    "ميدالية مفاتيح مصنوعة من الجلد الطبيعي الفاخر مع حلقة نحاسية عتيقة ودلاية شجرة الحياة البرونزية، متوفرة بألوان كلاسيكية أنيقة.",
    "Artisan genuine leather strap keychain with antique brass hardware and tree-of-life medallion.",
    "2026-10-09T18:00:16.165Z"
  ],
  [
    "prod-ot-3",
    "others",
    "فواحة عطرية خزفية شرقية مع أعواد خشبية وزيت عطري",
    "Moroccan Ceramic Reed Diffuser + Fragrance Oil",
    180,
    220,
    "assets/images/others.jpg",
    "رائحة زكية 🌿",
    "Aromatherapy",
    4.9,
    31,
    true,
    "اختر الرائحة (لافندر / مسك أبيض / فانيليا)",
    "Choose Scent (Lavender / White Musk / Vanilla)",
    "فواحة سيراميك مزخرفة بنقوش أندلسية زرقاء دافئة، تأتي مع أعواد قصب خشبية وزجاجة زيت عطري مركز تدوم رائحته لأسابيع.",
    "Artisanal glazed ceramic reed diffuser with Moroccan motifs, accompanied by natural rattan reeds and pure aroma oil.",
    "2026-10-09T18:00:16.165Z"
  ]
];

// دالة التهيئة الأولية وتعبئة كامل بيانات الموقع تلقائياً
function setupDatabase() {
  return seedAllWebsiteData();
}

// دالة تعبئة أو تحديث بيانات الموقع في Google Sheet
function seedAllWebsiteData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. ورقة المنتجات Products (قاعدة بيانات المتجر الرئيسية)
  let prodSheet = ss.getSheetByName("Products");
  if (!prodSheet) {
    prodSheet = ss.insertSheet("Products");
  }
  
  const existingProds = prodSheet.getDataRange().getValues();
  if (existingProds.length <= 1) {
    prodSheet.clear();
    prodSheet.appendRow(PRODUCT_HEADERS);
    prodSheet.setFrozenRows(1);
    
    // إضافة كافة منتجات المتجر الـ 27 تلقائياً
    if (INITIAL_PRODUCTS_SEED && INITIAL_PRODUCTS_SEED.length > 0) {
      prodSheet.getRange(2, 1, INITIAL_PRODUCTS_SEED.length, INITIAL_PRODUCTS_SEED[0].length).setValues(INITIAL_PRODUCTS_SEED);
    }
  }

  // 2. ورقة الأقسام Categories
  let catSheet = ss.getSheetByName("Categories");
  if (!catSheet) {
    catSheet = ss.insertSheet("Categories");
  }
  const existingCats = catSheet.getDataRange().getValues();
  if (existingCats.length <= 1) {
    catSheet.clear();
    catSheet.appendRow(CATEGORY_HEADERS);
    catSheet.setFrozenRows(1);
    if (INITIAL_CATEGORIES_SEED && INITIAL_CATEGORIES_SEED.length > 0) {
      catSheet.getRange(2, 1, INITIAL_CATEGORIES_SEED.length, INITIAL_CATEGORIES_SEED[0].length).setValues(INITIAL_CATEGORIES_SEED);
    }
  }

  // 3. ورقة المستخدمين Users
  let usersSheet = ss.getSheetByName("Users");
  let adminTempPassword = "";
  if (!usersSheet) {
    usersSheet = ss.insertSheet("Users");
    usersSheet.appendRow([
      "username", "password", "fullName", "role", "createdAt", "isActive", "mustChangePassword"
    ]);
    // حساب المشرف الافتراضي بكلمة مرور مؤقتة عشوائية (يُطلب تغييرها عند أول دخول)
    adminTempPassword = generateTempPassword_();
    usersSheet.appendRow([
      "admin", hashPassword_(adminTempPassword), "مدير النظام (Admin)", "admin", new Date().toISOString(), true, true
    ]);
    usersSheet.setFrozenRows(1);
  }

  // 4. ورقة أرشيف الطلبات Orders
  let ordersSheet = ss.getSheetByName("Orders");
  if (!ordersSheet) {
    ordersSheet = ss.insertSheet("Orders");
    ordersSheet.appendRow([
      "orderId", "customerName", "phone", "city", "address",
      "total", "items", "notes", "createdAt"
    ]);
    ordersSheet.setFrozenRows(1);
  }

  // 5. ورقة إعدادات واجهة المتجر Settings (صورة / فيديو الصفحة الرئيسية)
  let settingsSheet = ss.getSheetByName("Settings");
  if (!settingsSheet) {
    settingsSheet = ss.insertSheet("Settings");
    settingsSheet.appendRow(["key", "value"]);
    settingsSheet.setFrozenRows(1);
  }

  clearProductsCache_();
  return "تم تهيئة وتعبئة قاعدة بيانات المتجر بنجاح! تم إدراج " + INITIAL_PRODUCTS_SEED.length + " منتج و " + INITIAL_CATEGORIES_SEED.length + " أقسام." +
    (adminTempPassword ? " كلمة المرور المؤقتة لحساب admin: " + adminTempPassword : "");
}

// =========================================================================
// أداة استرجاع: شغّلها يدوياً من محرر Apps Script إذا نسيت كلمة مرور admin
// تطبع كلمة مرور مؤقتة جديدة في السجل (Execution log) ويُطلب تغييرها عند الدخول
// =========================================================================
function resetAdminPassword() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Users");
  const data = sheet.getDataRange().getValues();
  const temp = generateTempPassword_();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim().toLowerCase() === "admin") {
      sheet.getRange(i + 1, 2).setValue(hashPassword_(temp));
      sheet.getRange(i + 1, 6).setValue(true);
      sheet.getRange(i + 1, 7).setValue(true);
      CacheService.getScriptCache().remove("login_fail_admin");
      Logger.log("كلمة المرور المؤقتة الجديدة لحساب admin: " + temp);
      return temp;
    }
  }
  sheet.appendRow(["admin", hashPassword_(temp), "مدير النظام (Admin)", "admin", new Date().toISOString(), true, true]);
  Logger.log("تم إنشاء حساب admin بكلمة مرور مؤقتة: " + temp);
  return temp;
}

// =========================================================================
// الأمان: كلمات مرور مشفرة (hash) + جلسات موقعة (token) + صلاحيات
// =========================================================================
const SESSION_HOURS = 12;
const PASSWORD_MIN_LENGTH = 8;
const HASH_ROUNDS = 300;
const MAX_LOGIN_FAILURES = 5;
const LOGIN_LOCK_SECONDS = 15 * 60;

// code "unauthorized": no valid session (the admin page logs out)
// code "forbidden": valid session, but the role may not do this
function AuthError_(message, code) {
  this.message = message;
  this.code = code || "unauthorized";
}

function getAuthSecret_() {
  const props = PropertiesService.getScriptProperties();
  let secret = props.getProperty("AUTH_SECRET");
  if (!secret) {
    secret = Utilities.getUuid() + Utilities.getUuid();
    props.setProperty("AUTH_SECRET", secret);
  }
  return secret;
}

function bytesToHex_(bytes) {
  return bytes.map(function (b) { return ("0" + (b & 0xff).toString(16)).slice(-2); }).join("");
}

function generateTempPassword_() {
  return Utilities.getUuid().replace(/-/g, "").slice(0, 10);
}

// Stored format: sha256$<salt>$<hex digest>
function hashPassword_(password, salt) {
  salt = salt || Utilities.getUuid().replace(/-/g, "");
  let digest = salt + ":" + password;
  for (let i = 0; i < HASH_ROUNDS; i++) {
    digest = bytesToHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, digest, Utilities.Charset.UTF_8));
  }
  return "sha256$" + salt + "$" + digest;
}

function safeEquals_(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Passwords typed straight into the sheet (plain text) still work once, and are hashed on that login
function checkPassword_(stored, password) {
  stored = String(stored || "");
  if (stored.indexOf("sha256$") === 0) {
    const salt = stored.split("$")[1];
    return { ok: safeEquals_(hashPassword_(password, salt), stored), legacy: false };
  }
  return { ok: stored !== "" && safeEquals_(stored.trim(), password), legacy: true };
}

function findUserRow_(sheet, username) {
  const data = sheet.getDataRange().getValues();
  const wanted = String(username || "").trim().toLowerCase();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim().toLowerCase() === wanted && wanted) {
      return { rowNumber: i + 1, row: data[i] };
    }
  }
  return null;
}

function isTrue_(value) {
  return value === true || String(value).toUpperCase() === "TRUE";
}

// A short fingerprint of the stored password: changing the password ends older sessions
function passwordVersion_(storedPassword) {
  return bytesToHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(storedPassword), Utilities.Charset.UTF_8)).slice(0, 12);
}

function createToken_(username, storedPassword) {
  const payload = Utilities.base64EncodeWebSafe(JSON.stringify({
    u: String(username).toLowerCase(),
    exp: Date.now() + SESSION_HOURS * 3600 * 1000,
    pv: passwordVersion_(storedPassword)
  }), Utilities.Charset.UTF_8);
  const sig = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(payload, getAuthSecret_()));
  return payload + "." + sig;
}

// Checks the token and re-reads the user from the sheet, so deleted / disabled users
// and changed roles take effect immediately. Throws AuthError_ when not allowed.
function requireAuth_(ss, body, allowedRoles, options) {
  options = options || {};
  const token = String(body.token || "");
  const parts = token.split(".");
  if (parts.length !== 2) throw new AuthError_("يجب تسجيل الدخول أولاً");

  const expectedSig = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(parts[0], getAuthSecret_()));
  if (!safeEquals_(expectedSig, parts[1])) throw new AuthError_("جلسة غير صالحة، يرجى تسجيل الدخول مجدداً");

  let payload;
  try {
    payload = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString());
  } catch (err) {
    throw new AuthError_("جلسة غير صالحة، يرجى تسجيل الدخول مجدداً");
  }
  if (!payload.exp || Date.now() > payload.exp) throw new AuthError_("انتهت الجلسة، يرجى تسجيل الدخول مجدداً");

  const found = findUserRow_(ss.getSheetByName("Users"), payload.u);
  if (!found) throw new AuthError_("هذا الحساب لم يعد موجوداً");
  const row = found.row;
  if (!isTrue_(row[5])) throw new AuthError_("هذا الحساب معطل حالياً من قِبل الإدارة");
  if (payload.pv !== passwordVersion_(row[1])) throw new AuthError_("تم تغيير كلمة المرور، يرجى تسجيل الدخول مجدداً");

  const user = {
    username: String(row[0]),
    fullName: String(row[2] || ""),
    role: String(row[3] || "editor"),
    mustChangePassword: isTrue_(row[6])
  };
  // Until a temporary password is replaced, the session can only be used to change it
  if (user.mustChangePassword && !options.allowPasswordChangeOnly) {
    throw new AuthError_("يجب تعيين كلمة مرور جديدة أولاً");
  }
  if (allowedRoles && allowedRoles.indexOf(user.role) === -1) {
    throw new AuthError_("ليس لديك صلاحية لتنفيذ هذا الإجراء", "forbidden");
  }
  return { user: user, rowNumber: found.rowNumber };
}

function publicUser_(row) {
  return {
    username: row[0],
    fullName: row[2],
    role: row[3],
    createdAt: row[4],
    isActive: isTrue_(row[5]),
    mustChangePassword: isTrue_(row[6])
  };
}

// =========================================================================
// كاش المنتجات: يقلل وقت الاستجابة والضغط على Google عند زيادة الزوار
// =========================================================================
const PRODUCTS_CACHE_KEY = "products_json_v1";
const STORE_CACHE_KEY = "store_json_v1";
const PRODUCTS_CACHE_SECONDS = 300;

function clearProductsCache_() {
  const cache = CacheService.getScriptCache();
  cache.remove(PRODUCTS_CACHE_KEY);
  cache.remove(STORE_CACHE_KEY);
}

// Simple trigger: editing the sheet by hand refreshes the store within seconds
function onEdit(e) {
  clearProductsCache_();
}

function readProducts_(ss) {
  const sheet = ss.getSheetByName("Products");
  if (!sheet) return null;
  const data = sheet.getDataRange().getValues();
  const products = [];
  if (data.length <= 1) return products;

  const headers = data[0];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0]) continue; // تخطي الفارغ
    const item = {};
    for (let j = 0; j < headers.length; j++) {
      item[headers[j]] = row[j];
    }
    item.price = Number(item.price) || 0;
    item.originalPrice = Number(item.originalPrice) || 0;
    item.rating = Number(item.rating) || 5.0;
    item.reviewsCount = Number(item.reviewsCount) || 1;
    item.isCustomizable = isTrue_(item.isCustomizable);
    products.push(item);
  }
  return products;
}

// =========================================================================
// معالجة طلبات GET (بيانات عامة للمتجر فقط: المنتجات والأقسام)
// =========================================================================
function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "getProducts";

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // فحص الاتصال Ping
    if (action === "ping") {
      return createResponse({
        status: "success",
        message: "Nourii Google Drive Backend is Active and Live!",
        timestamp: new Date().toISOString()
      });
    }

    // جلب المنتجات لصفحة المتجر الرئيسية (Main Source) — من الكاش إن وُجد
    if (action === "getProducts") {
      const cache = CacheService.getScriptCache();
      const cached = cache.get(PRODUCTS_CACHE_KEY);
      if (cached) {
        return ContentService.createTextOutput(cached).setMimeType(ContentService.MimeType.JSON);
      }

      const products = readProducts_(ss);
      if (products === null) return createResponse({ status: "error", message: "Products sheet not found" });

      const json = JSON.stringify({ status: "success", count: products.length, data: products, source: "Google Drive Live" });
      if (json.length < 95000) cache.put(PRODUCTS_CACHE_KEY, json, PRODUCTS_CACHE_SECONDS);
      return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
    }

    // كل ما تحتاجه واجهة المتجر في طلب واحد: الأقسام الظاهرة ومنتجاتها وإعدادات الصفحة الرئيسية
    if (action === "getStore") {
      const cache = CacheService.getScriptCache();
      const cached = cache.get(STORE_CACHE_KEY);
      if (cached) {
        return ContentService.createTextOutput(cached).setMimeType(ContentService.MimeType.JSON);
      }

      const allCategories = readCategories_(ss, true) || [];
      const hidden = {};
      allCategories.forEach(function (c) { if (!c.isActive) hidden[c.id] = true; });
      const products = (readProducts_(ss) || []).filter(function (p) { return !hidden[p.categoryId]; });

      const json = JSON.stringify({
        status: "success",
        categories: allCategories.filter(function (c) { return c.isActive; }),
        products: products,
        settings: readSettings_(ss),
        source: "Google Drive Live"
      });
      if (json.length < 95000) cache.put(STORE_CACHE_KEY, json, PRODUCTS_CACHE_SECONDS);
      return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
    }

    // جلب كل الأقسام بما فيها المخفية (للوحة التحكم)
    if (action === "getCategories") {
      const categories = readCategories_(ss, true);
      if (categories === null) return createResponse({ status: "error", message: "Categories sheet not found" });
      return createResponse({ status: "success", count: categories.length, data: categories });
    }

    // قائمة المستخدمين لم تعد عامة: تُطلب عبر POST مع جلسة مشرف
    if (action === "getUsers") {
      return createResponse({ status: "error", code: "unauthorized", message: "يجب تسجيل الدخول كمشرف" });
    }

    return createResponse({ status: "error", message: "Unknown action" });

  } catch (error) {
    return createResponse({ status: "error", message: error.toString() });
  }
}

// =========================================================================
// معالجة طلبات POST (تسجيل الدخول + كل التعديلات، وكلها تتطلب جلسة صالحة)
// =========================================================================
function doPost(e) {
  try {
    let body = {};
    if (e && e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    }
    const action = body.action || "";
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const usersSheet = ss.getSheetByName("Users");
    if (!usersSheet) return createResponse({ status: "error", message: "Users sheet not found" });

    // 1. تسجيل الدخول (مع إيقاف مؤقت بعد محاولات خاطئة متكررة)
    if (action === "login") {
      const username = String(body.username || "").trim().toLowerCase();
      const password = String(body.password || "").trim();
      const cache = CacheService.getScriptCache();
      const failKey = "login_fail_" + username;
      const failures = Number(cache.get(failKey)) || 0;
      if (failures >= MAX_LOGIN_FAILURES) {
        return createResponse({ status: "error", message: "تم إيقاف الدخول لهذا الحساب مؤقتاً بسبب محاولات خاطئة متكررة. حاول بعد 15 دقيقة." });
      }

      const found = findUserRow_(usersSheet, username);
      const check = found ? checkPassword_(found.row[1], password) : { ok: false };
      if (!found || !check.ok) {
        cache.put(failKey, String(failures + 1), LOGIN_LOCK_SECONDS);
        return createResponse({ status: "error", message: "اسم المستخدم أو كلمة المرور غير صحيحة" });
      }
      cache.remove(failKey);

      const row = found.row;
      if (!isTrue_(row[5])) {
        return createResponse({ status: "error", message: "هذا الحساب معطل حالياً من قِبل الإدارة" });
      }

      // ترقية كلمات المرور القديمة المكتوبة كنص عادي إلى صيغة مشفرة
      let stored = row[1];
      if (check.legacy) {
        stored = hashPassword_(password);
        usersSheet.getRange(found.rowNumber, 2).setValue(stored);
      }

      return createResponse({
        status: "success",
        token: createToken_(row[0], stored),
        expiresInHours: SESSION_HOURS,
        user: {
          username: row[0],
          fullName: row[2],
          role: row[3],
          mustChangePassword: isTrue_(row[6])
        }
      });
    }

    // 2. التحقق من الجلسة الحالية (يُستخدم عند فتح لوحة التحكم)
    if (action === "getSession") {
      const auth = requireAuth_(ss, body, null, { allowPasswordChangeOnly: true });
      return createResponse({ status: "success", user: auth.user });
    }

    // 3. تغيير كلمة المرور الشخصية (يتطلب كلمة المرور الحالية)
    if (action === "changePassword") {
      const auth = requireAuth_(ss, body, null, { allowPasswordChangeOnly: true });
      const currentPassword = String(body.currentPassword || "").trim();
      const newPassword = String(body.newPassword || "").trim();

      if (newPassword.length < PASSWORD_MIN_LENGTH) {
        return createResponse({ status: "error", message: "كلمة المرور يجب أن لا تقل عن " + PASSWORD_MIN_LENGTH + " خانات" });
      }
      const found = findUserRow_(usersSheet, auth.user.username);
      if (!checkPassword_(found.row[1], currentPassword).ok) {
        return createResponse({ status: "error", message: "كلمة المرور الحالية غير صحيحة" });
      }

      const stored = hashPassword_(newPassword);
      usersSheet.getRange(found.rowNumber, 2).setValue(stored);
      usersSheet.getRange(found.rowNumber, 7).setValue(false);
      return createResponse({
        status: "success",
        message: "تم تحديث كلمة المرور بنجاح!",
        token: createToken_(found.row[0], stored)
      });
    }

    // 4. قائمة المستخدمين (للمشرف فقط)
    if (action === "getUsers") {
      requireAuth_(ss, body, ["admin"]);
      const data = usersSheet.getDataRange().getValues();
      const users = [];
      for (let i = 1; i < data.length; i++) {
        if (data[i][0]) users.push(publicUser_(data[i]));
      }
      return createResponse({ status: "success", count: users.length, data: users });
    }

    // 5. حفظ / تعديل مستخدم (للمشرف فقط)
    if (action === "saveUser") {
      const auth = requireAuth_(ss, body, ["admin"]);
      const user = body.user;
      const username = String((user && user.username) || "").trim().toLowerCase();
      if (!username || !/^[a-z0-9._-]{3,30}$/.test(username)) {
        return createResponse({ status: "error", message: "اسم المستخدم يجب أن يكون 3-30 حرفاً إنجليزياً أو أرقام" });
      }
      const role = user.role === "admin" ? "admin" : "editor";
      const newPassword = String(user.password || "").trim();
      if (newPassword && newPassword.length < PASSWORD_MIN_LENGTH) {
        return createResponse({ status: "error", message: "كلمة المرور يجب أن لا تقل عن " + PASSWORD_MIN_LENGTH + " خانات" });
      }

      const lock = LockService.getScriptLock();
      lock.waitLock(10000);
      try {
        const found = findUserRow_(usersSheet, username);
        const isMainAdmin = username === "admin";
        const isSelf = username === auth.user.username.toLowerCase();
        let tempPassword = "";

        if (found) {
          // لا يمكن تعطيل أو تخفيض صلاحية حساب admin الرئيسي أو حسابك الحالي (لتجنب فقدان الدخول)
          const keepAdmin = isMainAdmin || isSelf;
          const mustChange = newPassword ? user.mustChangePassword !== false : isTrue_(found.row[6]) && user.mustChangePassword !== false;
          usersSheet.getRange(found.rowNumber, 1, 1, 7).setValues([[
            found.row[0],
            newPassword ? hashPassword_(newPassword) : found.row[1],
            String(user.fullName || found.row[2] || ""),
            keepAdmin ? "admin" : role,
            found.row[4],
            keepAdmin ? true : user.isActive !== false,
            mustChange
          ]]);
        } else {
          tempPassword = newPassword ? "" : generateTempPassword_();
          usersSheet.appendRow([
            username,
            hashPassword_(newPassword || tempPassword),
            String(user.fullName || username),
            role,
            new Date().toISOString(),
            true,
            user.mustChangePassword !== false
          ]);
        }

        return createResponse({
          status: "success",
          message: "تم حفظ المستخدم بنجاح",
          tempPassword: tempPassword || undefined
        });
      } finally {
        lock.releaseLock();
      }
    }

    // 6. حذف مستخدم (للمشرف فقط)
    if (action === "deleteUser") {
      const auth = requireAuth_(ss, body, ["admin"]);
      const username = String(body.username || "").trim().toLowerCase();
      if (username === "admin") {
        return createResponse({ status: "error", message: "لا يمكن حذف حساب المشرف الرئيسي" });
      }
      if (username === auth.user.username.toLowerCase()) {
        return createResponse({ status: "error", message: "لا يمكنك حذف حسابك الحالي" });
      }

      const found = findUserRow_(usersSheet, username);
      if (!found) return createResponse({ status: "error", message: "المستخدم غير موجود" });
      usersSheet.deleteRow(found.rowNumber);
      return createResponse({ status: "success", message: "تم حذف المستخدم بنجاح" });
    }

    // 7. استيراد منتجات بالجملة (يمسح الورقة ويعيد كتابتها — للمشرف فقط)
    if (action === "bulkImportProducts") {
      requireAuth_(ss, body, ["admin"]);
      const sheet = ss.getSheetByName("Products");
      if (!sheet) return createResponse({ status: "error", message: "Products sheet not found" });

      const products = body.products || [];
      if (!Array.isArray(products) || products.length === 0) {
        return createResponse({ status: "error", message: "No products provided" });
      }

      const lock = LockService.getScriptLock();
      lock.waitLock(20000);
      try {
        const rows = products.filter(function (prod) { return prod && prod.id; }).map(function (prod) {
          return rowFromObject_(PRODUCT_HEADERS, productValues_(prod), null);
        });
        sheet.clear();
        sheet.appendRow(PRODUCT_HEADERS);
        sheet.setFrozenRows(1);
        if (rows.length) sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
        clearProductsCache_();

        return createResponse({
          status: "success",
          message: "تم تحديث واستيراد " + rows.length + " منتج بنجاح إلى Google Sheets!",
          count: rows.length
        });
      } finally {
        lock.releaseLock();
      }
    }

    // 8. حفظ / تعديل منتج فردي (مشرف أو محرر)
    if (action === "saveProduct") {
      requireAuth_(ss, body, ["admin", "editor"]);
      const sheet = ss.getSheetByName("Products");
      const prod = body.product;
      if (!prod || !prod.id) return createResponse({ status: "error", message: "Missing product data" });

      const lock = LockService.getScriptLock();
      lock.waitLock(10000);
      try {
        const table = sheetTable_(sheet, PRODUCT_HEADERS);
        let rowIndex = -1;
        for (let i = 0; i < table.rows.length; i++) {
          if (String(table.rows[i][0]) === String(prod.id)) {
            rowIndex = i;
            break;
          }
        }

        const existing = rowIndex >= 0 ? table.rows[rowIndex] : null;
        const rowValues = rowFromObject_(table.headers, productValues_(prod), existing);
        if (existing) {
          sheet.getRange(rowIndex + 2, 1, 1, rowValues.length).setValues([rowValues]);
        } else {
          sheet.appendRow(rowValues);
        }
        clearProductsCache_();
        return createResponse({ status: "success", message: "تم حفظ المنتج في Google Drive بنجاح", product: prod });
      } finally {
        lock.releaseLock();
      }
    }

    // 9. حذف منتج (مشرف أو محرر)
    if (action === "deleteProduct") {
      requireAuth_(ss, body, ["admin", "editor"]);
      const sheet = ss.getSheetByName("Products");
      const prodId = body.id;

      const lock = LockService.getScriptLock();
      lock.waitLock(10000);
      try {
        const data = sheet.getDataRange().getValues();
        for (let i = 1; i < data.length; i++) {
          if (String(data[i][0]) === String(prodId)) {
            sheet.deleteRow(i + 1);
            clearProductsCache_();
            return createResponse({ status: "success", message: "تم حذف المنتج بنجاح من Google Drive" });
          }
        }
        return createResponse({ status: "error", message: "المنتج غير موجود" });
      } finally {
        lock.releaseLock();
      }
    }

    // 10. رفع صورة أو فيديو قصير إلى مجلد Google Drive (مشرف أو محرر)
    if (action === "uploadImage" || action === "uploadMedia") {
      requireAuth_(ss, body, ["admin", "editor"]);
      const base64Data = String(body.base64Data || "");
      const mimeType = String(body.mimeType || "image/jpeg");
      const isVideo = /^video\/(mp4|webm|quicktime)$/.test(mimeType);
      const isImage = /^image\/(jpeg|png|webp|gif)$/.test(mimeType);
      const filename = String(body.filename || ("nourii-" + Date.now() + (isVideo ? ".mp4" : ".jpg"))).replace(/[^\w.\-]+/g, "_").slice(0, 80);

      if (!base64Data) return createResponse({ status: "error", message: "بيانات الملف مفقودة" });
      if (!isImage && !isVideo) {
        return createResponse({ status: "error", message: "يُسمح برفع الصور (JPG / PNG / WEBP / GIF) أو الفيديو (MP4 / WEBM / MOV) فقط" });
      }
      if (base64Data.length > (isVideo ? MAX_VIDEO_BASE64 : MAX_IMAGE_BASE64)) {
        return createResponse({ status: "error", message: isVideo
          ? "حجم الفيديو كبير جداً (الحد الأقصى 25 ميجا). للفيديوهات الأطول ارفعها على يوتيوب أو انستجرام والصق الرابط."
          : "حجم الصورة كبير جداً (الحد الأقصى 5 ميجا)" });
      }

      let folders = DriveApp.getFoldersByName("Nourii Media");
      let folder;
      if (folders.hasNext()) {
        folder = folders.next();
      } else {
        folder = DriveApp.createFolder("Nourii Media");
      }

      const decoded = Utilities.base64Decode(base64Data.split(",")[1] || base64Data);
      const blob = Utilities.newBlob(decoded, mimeType, filename);
      const file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

      // Photos load straight from Google's image server; videos play in Drive's player
      const publicUrl = isVideo
        ? "https://drive.google.com/file/d/" + file.getId() + "/view"
        : "https://lh3.googleusercontent.com/d/" + file.getId();

      return createResponse({
        status: "success",
        kind: isVideo ? "video" : "image",
        url: publicUrl,
        imageUrl: publicUrl,
        fileId: file.getId()
      });
    }

    // 11. حفظ / إضافة قسم (للمشرف فقط) — يظهر في قائمة المتجر تلقائياً
    if (action === "saveCategory") {
      requireAuth_(ss, body, ["admin"]);
      const cat = body.category || {};
      const id = String(cat.id || "").trim().toLowerCase();
      const nameAr = String(cat.nameAr || "").trim();
      if (!/^[a-z0-9_-]{2,40}$/.test(id)) {
        return createResponse({ status: "error", message: "رابط القسم يجب أن يكون 2-40 حرفاً إنجليزياً صغيراً أو أرقام أو - بدون مسافات" });
      }
      if (!nameAr) return createResponse({ status: "error", message: "اسم القسم بالعربية مطلوب" });

      const lock = LockService.getScriptLock();
      lock.waitLock(10000);
      try {
        const sheet = getOrCreateSheet_(ss, "Categories", CATEGORY_HEADERS);
        const table = sheetTable_(sheet, CATEGORY_HEADERS);
        const idCol = table.headers.indexOf("id");
        const orderCol = table.headers.indexOf("sortOrder");
        let rowIndex = -1;
        let maxOrder = 0;
        for (let i = 0; i < table.rows.length; i++) {
          if (String(table.rows[i][idCol]).toLowerCase() === id) rowIndex = i;
          maxOrder = Math.max(maxOrder, Number(table.rows[i][orderCol]) || i + 1);
        }
        if (rowIndex >= 0 && cat.isNew) {
          return createResponse({ status: "error", message: "يوجد قسم بنفس الرابط بالفعل، اختر رابطاً آخر" });
        }

        const existing = rowIndex >= 0 ? table.rows[rowIndex] : null;
        const values = {
          id: id,
          nameAr: nameAr,
          nameEn: String(cat.nameEn || "").trim(),
          icon: String(cat.icon || (existing ? existing[table.headers.indexOf("icon")] : "") || "fa-tag"),
          image: cleanMediaUrl_(cat.image),
          descriptionAr: String(cat.descriptionAr || "").trim(),
          descriptionEn: String(cat.descriptionEn || "").trim(),
          video: cleanMediaUrl_(cat.video),
          isActive: cat.isActive !== false
        };
        if (!existing) values.sortOrder = maxOrder + 1;

        const rowValues = rowFromObject_(table.headers, values, existing);
        if (existing) {
          sheet.getRange(rowIndex + 2, 1, 1, rowValues.length).setValues([rowValues]);
        } else {
          sheet.appendRow(rowValues);
        }
        clearProductsCache_();
        return createResponse({ status: "success", message: "تم حفظ القسم بنجاح", category: values });
      } finally {
        lock.releaseLock();
      }
    }

    // 12. حذف قسم فارغ (للمشرف فقط)
    if (action === "deleteCategory") {
      requireAuth_(ss, body, ["admin"]);
      const id = String(body.id || "").trim().toLowerCase();
      const products = readProducts_(ss) || [];
      const inUse = products.filter(function (p) { return String(p.categoryId).toLowerCase() === id; }).length;
      if (inUse > 0) {
        return createResponse({ status: "error", message: "لا يمكن حذف قسم فيه " + inUse + " منتج. انقل المنتجات لقسم آخر أولاً، أو أخفِ القسم بدلاً من حذفه." });
      }

      const lock = LockService.getScriptLock();
      lock.waitLock(10000);
      try {
        const sheet = ss.getSheetByName("Categories");
        const data = sheet ? sheet.getDataRange().getValues() : [];
        for (let i = 1; i < data.length; i++) {
          if (String(data[i][0]).toLowerCase() === id) {
            sheet.deleteRow(i + 1);
            clearProductsCache_();
            return createResponse({ status: "success", message: "تم حذف القسم" });
          }
        }
        return createResponse({ status: "error", message: "القسم غير موجود" });
      } finally {
        lock.releaseLock();
      }
    }

    // 13. ترتيب الأقسام في قائمة المتجر (للمشرف فقط)
    if (action === "reorderCategories") {
      requireAuth_(ss, body, ["admin"]);
      const ids = (Array.isArray(body.ids) ? body.ids : []).map(function (x) { return String(x).toLowerCase(); });

      const lock = LockService.getScriptLock();
      lock.waitLock(10000);
      try {
        const sheet = getOrCreateSheet_(ss, "Categories", CATEGORY_HEADERS);
        const table = sheetTable_(sheet, CATEGORY_HEADERS);
        const idCol = table.headers.indexOf("id");
        const orderCol = table.headers.indexOf("sortOrder");
        for (let i = 0; i < table.rows.length; i++) {
          const pos = ids.indexOf(String(table.rows[i][idCol]).toLowerCase());
          // Categories missing from the list keep their place after the listed ones
          sheet.getRange(i + 2, orderCol + 1).setValue(pos >= 0 ? pos + 1 : ids.length + i + 1);
        }
        clearProductsCache_();
        return createResponse({ status: "success", message: "تم حفظ ترتيب الأقسام" });
      } finally {
        lock.releaseLock();
      }
    }

    // 14. إعدادات واجهة المتجر: صورة / فيديو الصفحة الرئيسية (للمشرف فقط)
    if (action === "saveSettings") {
      requireAuth_(ss, body, ["admin"]);
      const incoming = body.settings || {};

      const lock = LockService.getScriptLock();
      lock.waitLock(10000);
      try {
        const sheet = getOrCreateSheet_(ss, "Settings", ["key", "value"]);
        const data = sheet.getDataRange().getValues();
        SETTING_KEYS.forEach(function (key) {
          if (!(key in incoming)) return;
          const value = cleanMediaUrl_(incoming[key]);
          for (let i = 1; i < data.length; i++) {
            if (String(data[i][0]) === key) {
              sheet.getRange(i + 1, 2).setValue(value);
              return;
            }
          }
          sheet.appendRow([key, value]);
        });
        clearProductsCache_();
        return createResponse({ status: "success", message: "تم حفظ إعدادات الواجهة", settings: readSettings_(ss) });
      } finally {
        lock.releaseLock();
      }
    }

    return createResponse({ status: "error", message: "Unknown action" });

  } catch (err) {
    if (err instanceof AuthError_) {
      return createResponse({ status: "error", code: err.code, message: err.message });
    }
    return createResponse({ status: "error", message: err.toString() });
  }
}

const PRODUCT_HEADERS = [
  "id", "categoryId", "nameAr", "nameEn", "price", "originalPrice",
  "image", "badgeAr", "badgeEn", "rating", "reviewsCount",
  "isCustomizable", "customFieldLabelAr", "customFieldLabelEn",
  "descriptionAr", "descriptionEn", "updatedAt", "images", "videos"
];

const CATEGORY_HEADERS = [
  "id", "nameAr", "nameEn", "icon", "image", "descriptionAr", "descriptionEn",
  "video", "sortOrder", "isActive"
];

// Home page banner: a photo, or a video that replaces it
const SETTING_KEYS = ["heroImage", "heroVideo"];

const MAX_IMAGE_BASE64 = 7 * 1024 * 1024;   // about a 5 MB photo
const MAX_VIDEO_BASE64 = 34 * 1024 * 1024;  // about a 25 MB video

// Only web links and the store's own files, so nothing else ends up in a page
function cleanMediaUrl_(value) {
  const url = String(value || "").trim();
  return /^(https?:\/\/|assets\/)/i.test(url) ? url : "";
}

// Several photos / videos are kept in one cell, one link per line
function mediaList_(value) {
  const list = Array.isArray(value) ? value : String(value || "").split(/[\n,]+/);
  return list.map(cleanMediaUrl_).filter(String).slice(0, 20).join("\n");
}

function productValues_(prod) {
  const values = {
    id: String(prod.id),
    categoryId: prod.categoryId || "others",
    nameAr: prod.nameAr || "",
    nameEn: prod.nameEn || "",
    price: Number(prod.price) || 0,
    originalPrice: Number(prod.originalPrice) || 0,
    image: prod.image || "",
    badgeAr: prod.badgeAr || "",
    badgeEn: prod.badgeEn || "",
    rating: Number(prod.rating) || 5.0,
    reviewsCount: Number(prod.reviewsCount) || 1,
    isCustomizable: Boolean(prod.isCustomizable),
    customFieldLabelAr: prod.customFieldLabelAr || "",
    customFieldLabelEn: prod.customFieldLabelEn || "",
    descriptionAr: prod.descriptionAr || "",
    descriptionEn: prod.descriptionEn || "",
    updatedAt: new Date().toISOString()
  };
  // Older admin pages don't send these: leave what the sheet already has
  if (prod.images !== undefined) values.images = mediaList_(prod.images);
  if (prod.videos !== undefined) values.videos = mediaList_(prod.videos);
  return values;
}

function getOrCreateSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// Reads a sheet and adds any of `wanted` missing from its header row (sheets made
// before a column existed). Returns the header row and the data rows.
function sheetTable_(sheet, wanted) {
  const values = sheet.getDataRange().getValues();
  let headers = values.length && values[0].some(function (h) { return String(h) !== ""; }) ? values[0].map(String) : [];
  const missing = wanted.filter(function (h) { return headers.indexOf(h) === -1; });
  if (missing.length) {
    sheet.getRange(1, headers.length + 1, 1, missing.length).setValues([missing]);
    headers = headers.concat(missing);
  }
  return { headers: headers, rows: values.length > 1 ? values.slice(1) : [] };
}

// Lays out `obj` in the sheet's column order; columns it doesn't mention keep `existing` values
function rowFromObject_(headers, obj, existing) {
  return headers.map(function (h, i) {
    if (Object.prototype.hasOwnProperty.call(obj, h)) return obj[h];
    return existing && existing[i] !== undefined ? existing[i] : "";
  });
}

function readCategories_(ss, includeHidden) {
  const sheet = ss.getSheetByName("Categories");
  if (!sheet) return null;
  const data = sheet.getDataRange().getValues();
  const headers = data[0] || [];
  const list = [];
  for (let i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    const item = {};
    headers.forEach(function (h, j) { if (h) item[h] = data[i][j]; });
    item.id = String(item.id);
    item.isActive = item.isActive === undefined || item.isActive === "" ? true : isTrue_(item.isActive);
    item.sortOrder = Number(item.sortOrder) || i;
    if (includeHidden || item.isActive) list.push(item);
  }
  list.sort(function (a, b) { return a.sortOrder - b.sortOrder; });
  return list;
}

function readSettings_(ss) {
  const settings = {};
  SETTING_KEYS.forEach(function (key) { settings[key] = ""; });
  const sheet = ss.getSheetByName("Settings");
  if (!sheet) return settings;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const key = String(data[i][0]);
    if (SETTING_KEYS.indexOf(key) !== -1) settings[key] = String(data[i][1] || "");
  }
  return settings;
}

function createResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
