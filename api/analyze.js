const { GoogleGenAI } = require('@google/genai');

// Gemini API 클라이언트 초기화
// API 키는 process.env.GEMINI_API_KEY에서 자동으로 읽어옵니다.
// 서버리스 환경(Vercel)에서만 실행되므로, 프론트엔드(브라우저)에는 절대 키가 노출되지 않습니다.
const ai = new GoogleGenAI({});

module.exports = async function handler(req, res) {
  // 1. POST 요청만 허용
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. POST 요청만 지원합니다.' });
  }

  try {
    // 2. 프론트엔드에서 보낸 텍스트 데이터 추출
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: '텍스트가 제공되지 않았습니다.' });
    }

    // 3. 기존 server.js에 있던 프롬프트 및 API 호출 로직 적용
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: `너는 심리 상담가야. 사용자가 작성한 일기 내용을 읽고, 사용자의 감정을 한 단어(예: 기쁨, 슬픔, 분노, 불안, 평온)로 요약해줘. 그리고 그 감정에 공감해주고, 따뜻한 응원의 메시지를 2~3문장으로 작성해줘. 답변 형식은 반드시 '감정: [요약된 감정]\n\n[응원 메시지]'와 같이 줄바꿈을 포함해서 보내줘.\n\n사용자 일기:\n${text}`
    });

    // 4. 프론트엔드가 기대하는 { response: ... } 형태로 결과 반환
    return res.status(200).json({ response: response.text });
  } catch (error) {
    console.error('Gemini API 호출 중 에러:', error);
    return res.status(500).json({ error: '서버 내부 에러가 발생했습니다.' });
  }
};
