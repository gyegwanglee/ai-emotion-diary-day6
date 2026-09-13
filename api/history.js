const { createClient } = require('redis');
const { supabase, getUserFromRequest } = require('./supabase');

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
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed. GET 요청만 지원합니다.' });
  }

  // 1. 헤더의 토큰으로 사용자 검증
  const user = await getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: '인증이 필요합니다. 다시 로그인해 주세요.' });
  }

  // 2. Supabase가 설정된 경우 히스토리 조회
  if (supabase) {
    try {
      let { data, error } = await supabase
        .from('diaries')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      // user_id 컬럼이 DB에 없는 기존 구조인 경우 전체 조회 폴백
      if (error && error.message && error.message.includes('user_id')) {
        console.warn('[Supabase Warning] user_id 컬럼이 없어 전체 일기를 조회합니다.');
        const fallback = await supabase
          .from('diaries')
          .select('*')
          .order('created_at', { ascending: false });
        data = fallback.data;
        error = fallback.error;
      }

      if (!error && data && data.length > 0) {
        const history = data.map(item => ({
          id: item.id,
          originalText: item.original_text || item.originalText,
          aiResponse: item.ai_response || item.aiResponse,
          timestamp: item.created_at || item.timestamp
        }));
        return res.status(200).json(history);
      } else if (error) {
        console.warn('[Supabase History 조회 실패, Redis로 폴백 시도]', error.message);
      }
    } catch (err) {
      console.warn('[Supabase 예외 발생, Redis로 폴백 시도]', err.message);
    }
  }

  // 3. REDIS_URL이 없으면 빈 배열 반환
  if (!process.env.REDIS_URL) {
    return res.status(200).json([]);
  }

  // 4. Redis에서 사용자 키 패턴('user:[사용자 ID]:diary-*') 조회 후, 없으면 기존 레거시 키('diary-*') 조회
  try {
    const client = await getRedisClient();
    let keys = await client.keys(`user:${user.id}:diary-*`);
    
    // 사용자 지정 키가 없는 경우 레거시 키 조회 폴백
    if (!keys || keys.length === 0) {
      keys = await client.keys('diary-*');
    }

    if (!keys || keys.length === 0) {
      return res.status(200).json([]);
    }

    // 최신순 정렬
    keys.sort().reverse();
    
    const values = await client.mGet(keys);
    
    const history = values.map((val, idx) => {
      if (val) {
        try {
          const parsed = JSON.parse(val);
          return { id: keys[idx], ...parsed };
        } catch (e) {
          return null;
        }
      }
      return null;
    }).filter(item => item !== null);

    return res.status(200).json(history);
  } catch (error) {
    console.error('History API Error:', error.message);
    return res.status(200).json([]);
  }
};
