const { createClient } = require('redis');

let redisClient = null;

async function getRedisClient() {
  if (!redisClient) {
    redisClient = createClient({
      url: process.env.REDIS_URL,
      socket: {
        // tls: true 옵션이 필요한 경우 사용
      }
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

  // REDIS_URL이 없으면 빈 배열 반환
  if (!process.env.REDIS_URL) {
    return res.status(200).json([]);
  }

  try {
    const client = await getRedisClient();
    
    // Redis v4 모던 방식: scanIterator를 사용하여 keys를 안전하게 가져오기
    const keys = [];
    for await (const key of client.scanIterator({ MATCH: 'diary-*', COUNT: 100 })) {
      keys.push(key);
    }
    
    if (keys.length === 0) {
      return res.status(200).json([]);
    }

    // 키를 최신순(내림차순)으로 정렬 (diary-YYYYMMDDHHmmss 형식이므로 문자열 정렬 가능)
    keys.sort().reverse();
    
    // MGET을 사용해 모든 value를 한번에 가져오기
    const values = await client.mGet(keys);
    
    // JSON 파싱 및 데이터 정제
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
    console.error('History API Error:', error);
    return res.status(500).json({ error: '히스토리를 불러오는 중 서버 에러가 발생했습니다.' });
  }
};
