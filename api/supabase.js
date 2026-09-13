const { createClient } = require('@supabase/supabase-js');

// Vercel 마켓플레이스 연동 시 설정되는 다양한 Supabase 환경 변수 지원
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
// 관리자 / 인증 검증용 키 (SERVICE_ROLE_KEY 권장, 없으면 ANON_KEY 사용)
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let supabase = null;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
} else {
  console.warn('[Supabase Warning] SUPABASE_URL 또는 Key가 설정되지 않았습니다. .env.local 환경 변수를 확인해주세요.');
}

/**
 * HTTP 요청의 Authorization 헤더에서 Bearer 토큰을 추출하고
 * Supabase auth.getUser()를 호출하여 검증된 사용자를 반환하는 헬퍼 함수
 */
async function getUserFromRequest(req) {
  if (!supabase) return null;

  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.split(' ')[1];
  if (!token) return null;

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      console.warn('[Auth Error] 토큰 검증 실패:', error?.message);
      return null;
    }
    return user;
  } catch (err) {
    console.error('[Auth Error] 토큰 검증 예외:', err.message);
    return null;
  }
}

module.exports = { supabase, supabaseUrl, getUserFromRequest };
