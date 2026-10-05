# رادار الجودة — لوحة تحليل ملاحظات الجودة في المشاريع

لوحة تحليل تفاعلية لملاحظات الجودة عبر المشاريع الإنشائية: تحليل ملفات PowerPoint وExcel تلقائيًا داخل المتصفح، حفظ التحليلات في Firebase (قسم الملاحظات)، متابعة شاملة لكل المشاريع، حالة معالجة لكل ملاحظة، ومشاركة كل تحليل برابط/QR.

هذا مشروع **ثابت (Static Site)** — لا يحتاج أي خطوة بناء (build step)، فقط HTML/CSS/JS عادي + Firebase للتخزين.

## هيكل المشروع

```
quality-radar/
├── index.html                    ملف الصفحة الرئيسي
├── css/
│   └── style.css                 كل التنسيقات
├── js/
│   ├── data.js                   البيانات الافتراضية التجريبية (من الملف المرفق أصلًا)
│   ├── firebase-config.js        إعدادات مشروعك في Firebase (عدّله بمعلوماتك)
│   ├── firebase-config.example.js  نسخة فارغة كمرجع
│   ├── firebase-db.js            طبقة وصل بسيطة بين التطبيق و Firestore
│   └── app.js                    منطق التطبيق كاملًا (تحليل، رسوم بيانية، فلاتر...)
├── firestore.rules               قواعد أمان قاعدة البيانات
├── firebase.json                 إعدادات Firebase Hosting
├── .firebaserc                   اسم مشروعك في Firebase
├── package.json                  أوامر مختصرة للتشغيل والنشر
└── .gitignore
```

## 1) التشغيل محليًا (بدون Firebase)

المشروع يعمل مباشرة حتى بدون إعداد Firebase — فقط لن يُحفظ شيء بين الجلسات (لا "قسم ملاحظات"، لا مشاركة روابط). كل التحليل والرسوم البيانية والتصفية تعمل محليًا.

```bash
cd quality-radar
npx serve .
# أو أي سيرفر ثابت آخر، أو افتح index.html مباشرة في المتصفح
```

> ملاحظة: لأن الملفات مقسّمة لوحدات JS (`type="module"`)، بعض المتصفحات تمنع فتح `index.html` مباشرة بـ `file://‎`. الأسهل تشغيل سيرفر محلي بسيط كما بالأعلى.

## 2) ربط المشروع بـ Firebase (لتفعيل الحفظ والمشاركة)

### أ. أنشئ مشروع Firebase
1. اذهب إلى [console.firebase.google.com](https://console.firebase.google.com) وأنشئ مشروعًا جديدًا.
2. من القائمة الجانبية: **Build → Firestore Database → Create database**، واختر وضع **Production mode** (سنضبط الصلاحيات بأنفسنا عبر `firestore.rules`).
3. من **Project settings → General → Your apps**، اضغط **Add app → Web (</>)** وسجّل تطبيقًا جديدًا. سيعطيك Firebase كائن إعدادات (`firebaseConfig`) يحتوي `apiKey`, `projectId`, إلخ.

> ✅ `js/firebase-config.js` و `.firebaserc` في هذه النسخة مُعبّآن مسبقًا بمشروع **dwe-radar**. إن كان هذا مشروعك، تخطَّ الخطوة (ب) بالأسفل وتأكد فقط من إنشاء قاعدة Firestore له في الكونسول (الخطوة 2 أعلاه) قبل النشر. إن كنت تستخدم مشروعًا آخر، عدّل الملفين بمعلوماتك كما في الخطوة (ب).

### ب. عدّل ملفات الإعداد في المشروع
1. افتح `js/firebase-config.js` وألصق قيمك الحقيقية بدلًا من `YOUR_API_KEY` وما شابه.
2. افتح `.firebaserc` وضع معرّف مشروعك (Project ID) بدلًا من `YOUR_FIREBASE_PROJECT_ID`.

### ج. انشر قواعد الأمان
```bash
npm install -g firebase-tools    # إن لم تكن مثبّتة
firebase login
firebase deploy --only firestore:rules
```

**تنبيه أمني:** القواعد الافتراضية في `firestore.rules` تسمح بالقراءة والكتابة لأي شخص يملك رابط الموقع (`allow read, write: if true;`) — هذا مناسب لتجربة سريعة أو فريق صغير موثوق، لكن **قبل نشر الرابط علنًا** يُفضّل تفعيل [Firebase Authentication](https://firebase.google.com/docs/auth) وتغيير القاعدة إلى `if request.auth != null;` على الأقل.

## 3) النشر (Hosting)

يمكنك نشر الموقع على Firebase Hosting مباشرة:
```bash
firebase deploy --only hosting
```
سيعطيك رابطًا جاهزًا من نوع `https://YOUR_PROJECT_ID.web.app`.

بدلًا من ذلك يمكنك استضافته على **GitHub Pages** (الملفات ثابتة بالكامل، لا فرق):
1. ادفع المشروع إلى مستودع GitHub (راجع القسم التالي).
2. من إعدادات المستودع: **Settings → Pages → Deploy from a branch** واختر الفرع الرئيسي.
3. سيتصل الموقع المستضاف بنفس مشروع Firebase (البيانات والحفظ يبقيان يعملان لأن الاتصال بـ Firestore يتم من المتصفح مباشرة، بغض النظر عن مكان استضافة ملفات HTML/CSS/JS).

## 4) رفع المشروع على GitHub

```bash
cd quality-radar
git init
git add .
git commit -m "رادار الجودة: النسخة الأولى"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/quality-radar.git
git push -u origin main
```

`js/firebase-config.js` مضمّن بالدفعة افتراضيًا (القيم آمنة للنشر العلني لأنها لا تمثل مفتاح سر، والحماية الفعلية تأتي من `firestore.rules`). إن كنت تفضّل عدم رفعه أصلًا، فعّل السطر الخاص به في `.gitignore` وأضف بدلاً منه تعليمات لزملائك لنسخ `firebase-config.example.js`.

## المكتبات المستخدمة (عبر CDN، بدون تثبيت)
- [Chart.js](https://www.chartjs.org/) — الرسوم البيانية
- [JSZip](https://stuk.github.io/jszip/) — قراءة ملفات PowerPoint (.pptx) داخل المتصفح
- [SheetJS (xlsx)](https://sheetjs.com/) — قراءة ملفات Excel
- [qrcode](https://github.com/soldair/node-qrcode) — إنشاء رموز QR للمشاركة
- [Firebase](https://firebase.google.com/) — قاعدة بيانات Firestore للحفظ والمشاركة المباشرة (Realtime)، وGoogle Analytics for Firebase (اختياري، يُفعَّل تلقائيًا إن وُجد `measurementId` في الإعدادات)

## أفكار للتوسعة لاحقًا
- تفعيل Firebase Authentication لتقييد من يمكنه الحفظ/الحذف.
- ربط تصنيف الفئة/الخطورة بنموذج ذكاء اصطناعي بدل الكلمات المفتاحية الحالية.
- إشعارات بريد إلكتروني عند اقتراب موعد استحقاق ملاحظة مفتوحة.
