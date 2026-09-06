const { GoogleGenAI } = require('@google/genai');
const { createClient } = require('redis');

// Gemini API 클라이언트 초기화
const ai = new GoogleGenAI({});

// Redis 클라이언트 초기화 
// 서버리스 환경에서 연결을 재사용하기 위해 바깥쪽에 선언합니다.
let redisClient = null;

async function getRedisClient() {
  if (!redisClient) {
    redisClient = createClient({
      url: process.env.REDIS_URL,
      socket: {
        // Vercel Serverless Redis는 보통 보안 연결(TLS)을 요구할 수 있습니다.
        // 연결 오류가 발생한다면 tls: true 옵션을 추가해야 할 수 있습니다.
      }
    });
    
    redisClient.on('error', (err) => console.log('Redis Client Error', err));
    
    await redisClient.connect();
  }
  return redisClient;
}

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

    // 3. 기존 프롬프트 및 Gemini API 호출
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: `너는 심리 상담가야. 사용자가 작성한 일기 내용을 읽고, 사용자의 감정을 한 단어(예: 기쁨, 슬픔, 분노, 불안, 평온)로 요약해줘. 그리고 그 감정에 공감해주고, 따뜻한 응원의 메시지를 2~3문장으로 작성해줘. 답변 형식은 반드시 '감정: [요약된 감정]\n\n[응원 메시지]'와 같이 줄바꿈을 포함해서 보내줘.\n\n사용자 일기:\n${text}`
    });

    const aiResponseText = response.text;

    // 4. Redis 저장을 위한 고유 KEY 생성 (diary-YYYYMMDDHHmmss 포맷)
    const now = new Date();
    // UTC 대신 한국 시간(KST) 기준으로 저장하려면 조정이 필요하지만, 여기서는 단순 변환을 사용합니다.
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    const timeKey = `diary-${year}${month}${day}${hours}${minutes}${seconds}`;

    // 5. Redis에 저장할 묶음 데이터
    const dataToSave = {
      originalText: text,
      aiResponse: aiResponseText,
      timestamp: now.toISOString()
    };

    // 6. Redis에 연결하여 데이터 저장
    if (process.env.REDIS_URL) {
      const client = await getRedisClient();
      // 객체를 JSON 문자열로 변환하여 저장
      await client.set(timeKey, JSON.stringify(dataToSave));
      console.log(`[Redis 저장 성공] Key: ${timeKey}`);
    } else {
      console.warn('REDIS_URL 환경변수가 설정되지 않아 Redis에 저장하지 않았습니다.');
    }

    // 7. 프론트엔드에 최종 결과 반환
    return res.status(200).json({ response: aiResponseText });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: '서버 내부 에러가 발생했습니다.' });
  }
};
