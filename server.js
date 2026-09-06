const express = require('express');
const dotenv = require('dotenv');
const { GoogleGenAI } = require('@google/genai');

// .env 파일에서 환경 변수 로드
dotenv.config();

const app = express();
const port = 3000;

// JSON 요청 바디 파싱 미들웨어
app.use(express.json());

// 정적 파일 제공 (index.html, style.css, script.js 등)
app.use(express.static(__dirname));

// Gemini API 클라이언트 초기화
// API 키는 process.env.GEMINI_API_KEY에서 자동으로 읽어옵니다.
const ai = new GoogleGenAI({});

app.post('/api/analyze', async (req, res) => {
    try {
        const { text } = req.body;
        
        if (!text) {
            return res.status(400).json({ error: '텍스트가 제공되지 않았습니다.' });
        }

        // Gemini API 호출
        const response = await ai.models.generateContent({
            model: 'gemini-3.6-flash',
            contents: `너는 심리 상담가야. 사용자가 작성한 일기 내용을 읽고, 사용자의 감정을 한 단어(예: 기쁨, 슬픔, 분노, 불안, 평온)로 요약해줘. 그리고 그 감정에 공감해주고, 따뜻한 응원의 메시지를 2~3문장으로 작성해줘. 답변 형식은 반드시 '감정: [요약된 감정]\n\n[응원 메시지]'와 같이 줄바꿈을 포함해서 보내줘.\n\n사용자 일기:\n${text}`
        });

        res.json({ response: response.text });
    } catch (error) {
        console.error('Gemini API 호출 중 에러:', error);
        res.status(500).json({ error: '서버 에러가 발생했습니다.' });
    }
});

app.listen(port, () => {
    console.log(`서버가 http://localhost:${port} 에서 실행 중입니다.`);
});
