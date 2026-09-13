const { GoogleGenAI } = require('@google/genai');
const { createClient } = require('redis');
const { supabase, getUserFromRequest } = require('./supabase');

// Gemini API 클라이언트 초기화
const ai = new GoogleGenAI({});

// Redis 클라이언트 초기화 (서버리스 연결 재사용)
let redisClient = null;

async function getRedisClient() {
  if (!redisClient) {
    redisClient = createClient({
      url: process.env.REDIS_URL,
      socket: {}
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

  // 2. 헤더의 토큰을 확인하여 사용자 ID 검증
  const user = await getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: '인증이 필요합니다. 다시 로그인해 주세요.' });
  }

  try {
    // 3. 프론트엔드에서 보낸 텍스트 데이터 추출
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: '텍스트가 제공되지 않았습니다.' });
    }

    // 4. Gemini API 호출하여 감정 분석
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: `너는 심리 상담가야. 사용자가 작성한 일기 내용을 읽고, 사용자의 감정을 한 단어(예: 기쁨, 슬픔, 분노, 불안, 평온)로 요약해줘. 그리고 그 감정에 공감해주고, 따뜻한 응원의 메시지를 2~3문장으로 작성해줘. 답변 형식은 반드시 '감정: [요약된 감정]\n\n[응원 메시지]'와 같이 줄바꿈을 포함해서 보내줘.\n\n사용자 일기:\n${text}`
    });

    const aiResponseText = response.text;

    // 5. 고유 TIMESTAMP 생성
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    const timestampStr = `${year}${month}${day}${hours}${minutes}${seconds}`;
    
    // 사용자 ID를 포함한 Redis 키 생성
    const userKey = `user:${user.id}:diary-${timestampStr}`;
    const legacyKey = `diary-${timestampStr}`;

    const dataToSave = {
      userId: user.id,
      originalText: text,
      aiResponse: aiResponseText,
      timestamp: now.toISOString()
    };

    // 6. Redis에 사용자 키 및 레거시 키로 데이터 저장
    if (process.env.REDIS_URL) {
      try {
        const client = await getRedisClient();
        await client.set(userKey, JSON.stringify(dataToSave));
        await client.set(legacyKey, JSON.stringify(dataToSave));
        console.log(`[Redis 저장 성공] Key: ${userKey}`);
      } catch (redisErr) {
        console.error('[Redis 저장 에러]', redisErr.message);
      }
    }

    // 7. Supabase 데이터베이스에 일기 저장 (user_id 컬럼 미생성 시 자동 폴백)
    if (supabase) {
      try {
        let { error } = await supabase
          .from('diaries')
          .insert([
            {
              user_id: user.id,
              original_text: text,
              ai_response: aiResponseText,
              created_at: now.toISOString()
            }
          ]);

        // DB에 user_id 컬럼이 아직 없는 경우 user_id 제외하고 저장 재시도
        if (error && error.message && error.message.includes('user_id')) {
          console.warn('[Supabase Warning] user_id 컬럼이 없어 user_id 제외 후 재시도합니다.');
          const retry = await supabase
            .from('diaries')
            .insert([
              {
                original_text: text,
                ai_response: aiResponseText,
                created_at: now.toISOString()
              }
            ]);
          error = retry.error;
        }

        if (error) {
          console.error('[Supabase 저장 에러]', error.message);
        } else {
          console.log(`[Supabase 저장 성공] User: ${user.id}`);
        }
      } catch (err) {
        console.error('[Supabase 예외 발생]', err.message);
      }
    }

    // 8. 프론트엔드에 최종 결과 반환
    return res.status(200).json({ response: aiResponseText });
  } catch (error) {
    console.error('Analyze API Error:', error);
    return res.status(500).json({ error: '서버 내부 에러가 발생했습니다.' });
  }
};
