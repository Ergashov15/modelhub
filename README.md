# ModelHub (Qwen UI)

Lokal serverda (vLLM, Ollama, LM Studio, llama.cpp) yoki bulutda ishlayotgan LLM modellar (xususan Qwen, DeepSeek, Llama va boshqalar) bilan qulay muloqot qilish uchun yengil va tezkor web-interfeys.

Ko'pincha Open-WebUI yoki boshqa katta tizimlar juda og'ir, o'rnatish murakkab va ortiqcha sozlamalarga to'la bo'ladi. Ushbu loyihaning maqsadi — kompyuteringizda yoki lokal tarmog'ingizda bir necha daqiqada ishga tushadigan, API kalitlaringizni hech qayerga yubormaydigan va ChatGPT kabi silliq ishlaydigan minimalist chat interfeysini taqdim etish.

---

## Nimalar qila oladi?

- **Har qanday OpenAI-mos server bilan ulanadi**: vLLM, Ollama, LM Studio, Text Generation Inference (TGI) yoki rasmiy OpenAI API — barchasi bilan bir xil ishlaydi.
- **Haqiqiy vaqtda Web Search (DuckDuckGo)**: Savol berishda "Qidiruv" tugmasini yoqsangiz, model javob berishdan oldin internetdan eng yangi ma'lumotlarni topadi va o'sha manbalarga tayangan holda aniq javob qaytaradi. Hech qanday pullik qidiruv API kaliti shart emas.
- **Thinking bloklarini toza ko'rsatish**: Qwen 2.5/3, DeepSeek-R1 kabi fikrlovchi modellarning `<think>...</think>` qismini foydalanuvchiga xunuk qilib chiqarmaydi, balki model o'ylayotgan vaqtda chiroyli animatsiyali yuklanish holatini ko'rsatib, to'g'ridan-to'g'ri tayyor javobni chiqaradi.
- **100% Maxfiylik**: Kiritgan barcha Endpoint URL va API kalitlaringiz faqat brauzeringiz xotirasida (`localStorage`) saqlanadi. Backend shunchaki CORS va oqimli uzatish (SSE proxy) uchun xizmat qiladi, hech qanday kalit yoki yozishmalar server xotirasiga yozilmaydi.
- **Kodni ishlatib ko'rish va nusxalash**: Markdown ichidagi kodlar Prism orqali chiroyli ranglanadi, bir bosishda nusxa olish yoki chatga qayta kiritish mumkin. JavaScript kodlarini esa to'g'ridan-to'g'ri brauzerning o'zida "Ishga tushirish" tugmasi bilan tekshirib ko'rsa bo'ladi.
- **Bir nechta model profilini boshqarish**: Turli endpoint va modellarni bitta joyga saqlab qo'yish, "Test Connection" orqali serverdagi modellarni avtomatik ro'yxatdan tanlab olish mumkin.
- **Xavfsiz token boshqaruvi**: Katta kontekstli modellarda (256k+) 400 xatolik (context length exhaustion) chiqib qolmasligi uchun tokenlar avtomatik nazorat qilinadi.
- **Dizayn va mavzular**: Ko'zni charchatmaydigan iliq neytral va zumrad yashil ranglar palitrasi. Dark va Light rejimlari, O'zbek, Rus va Ingliz tillari mavjud.

---

## Qanday ishga tushiriladi?

### 1. Talablar
- Python 3.10 yoki undan yuqorisi.
- *(Ixtiyoriy)* Node.js 18+ — faqat frontend kodiga o'zgartirish kiritmoqchi bo'lsangiz kerak. Tayyor ko'rinishini ishlatish uchun faqat Python yetarli.

### 2. O'rnatish

Repozitoriyani yuklab olib, loyiha papkasiga kiring:
```bash
git clone https://github.com/your-username/UI_for_qwen3.8.git
cd UI_for_qwen3.8
```

Virtual muhit yaratib, kerakli kutubxonalarni o'rnating:
```bash
# Virtual muhit ochish
python -m venv .venv

# Muhitni faollashtirish:
# Windows (PowerShell):
.\.venv\Scripts\Activate.ps1
# Linux / macOS:
source .venv/bin/activate

# Paketlarni o'rnatish
pip install -r requirements.txt
```

### 3. Serverni yoqish

```bash
python run.py
```

Buyruq bajarilgach, brauzerda quyidagi manzilni oching:
**`http://127.0.0.1:8000`**

---

## Modellarni ulash (Misollar)

Interfeysning yuqori o'ng burchagidagi **Sozlamalar** yoki model tanlash menyusi orqali ulanishni kiritishingiz mumkin:

1. **Ollama**:
   - Endpoint: `http://localhost:11434/v1`
   - Model: `qwen2.5:7b` (yoki serveringizdagi istalgan model nomi)
   - API Key: Bo'sh qoldiring

2. **vLLM / LM Studio / Local server**:
   - Endpoint: `http://localhost:8000/v1` yoki `http://127.0.0.1:1234/v1`
   - Model: serverga yuklangan model nomi
   - API Key: agar parol qo'yilgan bo'lsa kiriting, aks holda bo'sh qoldiring

3. **Bulutli servislar (OpenAI, DeepSeek, OpenRouter)**:
   - Endpoint: masalan `https://api.deepseek.com/v1` yoki `https://openrouter.ai/api/v1`
   - API Key: shaxsiy `sk-...` kalitingiz
   - Model: kerakli model nomi

*"Ulanishni tekshirish"* tugmasini bossangiz, tizim server bilan aloqani tekshiradi va unda mavjud barcha modellarni avtomatik topib beradi.

---

## Dasturchilar uchun (Frontendni o'zgartirish)

Agar frontend interfeysini o'zingizga moslab o'zgartirmoqchi bo'lsangiz:

```bash
cd frontend
npm install
npm run dev
```

O'zgarishlar kiritilgach, yangi versiyani yig'ish:
```bash
npm run build
```
Yig'ilgan fayllar `frontend/dist` papkasiga tushadi va FastAPI serveri ularni avtomatik tarzda taqdim etadi.

---

## Loyiha tuzilishi

```text
UI_for_qwen3.8/
├── backend/
│   ├── app/
│   │   ├── main.py         # FastAPI asosiy ilovasi va statik fayllar
│   │   ├── client.py       # OpenAI/vLLM/Ollama ga ulanish va SSE oqim mijozi
│   │   ├── search.py       # DuckDuckGo bepul veb-qidiruv moduli
│   │   └── schemas.py      # Pydantic ma'lumotlar modellari
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/     # Chat, ModelSelector, Sidebar, CodeBlock va boshqalar
│   │   ├── hooks/          # useChat, useSettings, useTheme
│   │   ├── i18n/           # Uz, Ru, En tarjimalari
│   │   └── types/          # TypeScript turlari
│   └── package.json
├── run.py                  # Serverni bitta buyruq bilan ishga tushiruvchi skript
└── requirements.txt        # Asosiy Python kutubxonalari
```

---

## Taklif va muammolar

Agar foydalanish davomida biror xatolikka duch kelsangiz yoki yangi qulayliklar bo'yicha taklifingiz bo'lsa, bemalol Issue yoki Pull Request qoldirishingiz mumkin.
