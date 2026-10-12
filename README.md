# Qwen 3.8 Universal Web UI

🚀 **Qwen 3.8 Universal Web UI** — serverda joylashtirilgan yoki bulutdagi Qwen va boshqa OpenAI-mos modellardan samarali, xavfsiz va qulay foydalanish uchun mo‘ljallangan zamonaviy veb-interfeys.

Loyiha open-source bo‘lib, uni har qanday foydalanuvchi klonlab olib, o‘z serveri yoki API kaliti bilan darhol ishlatishi mumkin.

---

## 🌟 Asosiy Xususiyatlar

- **🔐 100% Maxfiylik va Xavfsizlik**:
  - Foydalanuvchining shaxsiy `Endpoint URL` va `API Key` ma'lumotlari faqat brauzerning o‘zida (`localStorage`) saqlanadi.
  - Server vositachi yoki kalitlarni saqlovchi emas, balki shunchaki shaffof proxy sifatida ishlaydi.
  - Kod GitHub'ga yuklanganda hech qanday maxfiy kalitlar ochiq qolib ketmaydi.
- **⚡ Moslashuvchan Endpoint**:
  - vLLM, Ollama, LM Studio, TGI, FastChat yoki OpenAI standartidagi har qanday shaxsiy serverga ulanish imkoniyati.
- **🔍 Ulanishni tekshirish (Test Connection)**:
  - Bitta tugma orqali server holati, ulanish tezligi va serverda mavjud modellarni avtomatik aniqlash.
- **🌊 Haqiqiy vaqt rejimida oqimli javob (SSE Streaming)**:
  - Model javobini kutmasdan, yozilish jarayonini jonli kuzatish va istalgan vaqtda to‘xtatish.
- **🎨 Zamonaviy va qulay dizayn**:
  - Qorong‘u (dark) zamonaviy mavzu, suhbatlar tarixi, tezkor buyruq kartalari va nusxa olish (copy) funksiyasi.
- **⚙️ Moslashuvchan sozlamalar**:
  - Temperature, Top-P, Maksimal tokenlar va Tizim ko‘rsatmasi (System Prompt) ni to‘g‘ridan-to‘g‘ri interfeysdan boshqarish.

---

## 🛠 O‘rnatish va Ishga Tushirish

### 1. Talablar
- Python 3.10+
- Node.js 18+ *(faqat frontend kodini o‘zgartirib qayta yig‘ish uchun, tayyor holda shart emas)*

### 2. O‘rnatish
```bash
# Repozitoriyani klon qiling
git clone https://github.com/your-username/UI_for_qwen3.8.git
cd UI_for_qwen3.8

# Virtual muhitni faollashtiring va paketlarni o'rnating
python -m venv .venv
source .venv/bin/activate  # Linux/Mac
# yoki Windows: .\.venv\Scripts\activate

pip install -r backend/requirements.txt
```

### 3. Serverni ishga tushirish
```bash
python run.py
```
Brauzerda oching: **`http://127.0.0.1:8000`**

### 4. Dasturchilar uchun (Frontend Hot-Reload):
```bash
cd frontend
npm install
npm run dev
```

---

## 🔒 Xavfsizlik Eslatmasi
Siz kiritgan API kalitlari hech qachon server xotirasiga yoki fayllar tizimiga yozilmaydi. `.gitignore` fayli barcha muhit fayllari (`.env`) va ma'lumotlar chiqib ketishining oldini oladi.
