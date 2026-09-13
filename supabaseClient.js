/**
 * Supabase Client Helper for Frontend / Client-side
 * 
 * Vercel에 설정된 환경변수:
 * - SUPABASE_URL (또는 NEXT_PUBLIC_SUPABASE_URL)
 * - SUPABASE_ANON_KEY (또는 NEXT_PUBLIC_SUPABASE_ANON_KEY)
 * 
 * 백엔드(Node.js 서버리스 API)에서는 api/supabase.js 를 사용합니다.
 */

// 브라우저 환경에서 CDN으로 불러왔을 경우 window.supabase 객체 활용 예시
function getSupabaseClient(url, anonKey) {
  if (typeof supabase !== 'undefined' && supabase.createClient) {
    return supabase.createClient(url, anonKey);
  }
  console.warn('Supabase SDK가 로드되지 않았습니다. index.html에 CDN 스크립트를 추가해주세요.');
  return null;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getSupabaseClient };
}
