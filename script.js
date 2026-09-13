// Supabase 설정 상수
const SUPABASE_URL = "https://tmvwlosyqehrzomucpxe.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRtdndsb3N5cWVocnpvbXVjcHhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyNDUyNTgsImV4cCI6MjEwNDgyMTI1OH0.E2QvSaSSK-yup0yyoVIv3UFuCE2ZsAAFpOJcZPkXHhM";

let supabaseClient = null;

// Supabase 클라이언트 동적 획득 (CDN 로딩 지연 방지)
function getSupabase() {
    if (supabaseClient) return supabaseClient;
    if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        return supabaseClient;
    }
    return null;
}

// DOM 준비 완료 시 실행
document.addEventListener('DOMContentLoaded', () => {
    // DOM 요소 참조
    const authSection = document.getElementById('auth-section');
    const mainAppSection = document.getElementById('main-app-section');
    const emailInput = document.getElementById('emailInput');
    const passwordInput = document.getElementById('passwordInput');
    const loginBtn = document.getElementById('loginBtn');
    const signupBtn = document.getElementById('signupBtn');
    const googleLoginBtn = document.getElementById('googleLoginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const userEmailSpan = document.getElementById('userEmail');
    const authMessage = document.getElementById('authMessage');

    const voiceBtn = document.getElementById('voiceBtn');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const textInput = document.getElementById('textInput');
    const aiResponse = document.getElementById('aiResponse');

    // 메시지 표시 헬퍼
    function showMessage(text, isError = true) {
        if (!authMessage) return;
        authMessage.textContent = text;
        authMessage.className = `auth-message ${isError ? 'error' : 'success'}`;
    }

    function clearMessage() {
        if (!authMessage) return;
        authMessage.textContent = '';
        authMessage.className = 'auth-message';
    }

    // UI 전환 헬퍼 (로그인 상태 vs 비로그인 상태)
    function updateAuthUI(user) {
        if (user) {
            console.log('[Auth] 로그인 상태:', user.email);
            if (authSection) authSection.style.display = 'none';
            if (mainAppSection) mainAppSection.style.display = 'flex';
            if (userEmailSpan) userEmailSpan.textContent = user.email || '사용자';
            
            // 로컬 스토리지 데이터 복원
            const savedText = localStorage.getItem('diaryText');
            const savedResponse = localStorage.getItem('aiResponseHTML');
            if (savedText && textInput) textInput.value = savedText;
            if (savedResponse && aiResponse) aiResponse.innerHTML = savedResponse;

            // 히스토리 불러오기
            loadHistory();
        } else {
            console.log('[Auth] 비로그인 상태');
            if (authSection) authSection.style.display = 'flex';
            if (mainAppSection) mainAppSection.style.display = 'none';
        }
    }

    // --- 1. Supabase 인증 세션 파악 ---
    const client = getSupabase();
    if (client) {
        // 초기 세션 확인
        client.auth.getSession().then(({ data: { session } }) => {
            updateAuthUI(session?.user || null);
        }).catch(err => {
            console.error('[Auth] 세션 확인 에러:', err);
            updateAuthUI(null);
        });

        // 세션 변화 수신기 (로그인, 로그아웃, 회원가입 등)
        client.auth.onAuthStateChange((event, session) => {
            console.log('[Auth] 상태 변경 이벤트:', event);
            updateAuthUI(session?.user || null);
        });
    } else {
        console.warn("[Auth] Supabase SDK 로드 대기 중...");
        // 0.5초 후 재시도
        setTimeout(() => {
            const retryClient = getSupabase();
            if (retryClient) {
                retryClient.auth.getSession().then(({ data: { session } }) => {
                    updateAuthUI(session?.user || null);
                });
                retryClient.auth.onAuthStateChange((event, session) => {
                    updateAuthUI(session?.user || null);
                });
            }
        }, 500);
    }

    // --- 2. 로그인 처리 ---
    async function handleLogin() {
        clearMessage();
        const email = emailInput ? emailInput.value.trim() : '';
        const password = passwordInput ? passwordInput.value.trim() : '';

        if (!email || !password) {
            showMessage('이메일과 비밀번호를 모두 입력해 주세요.');
            return;
        }

        const sb = getSupabase();
        if (!sb) {
            showMessage('Supabase 클라이언트 초기화 실패. 페이지를 새로고침해 주세요.');
            return;
        }

        if (loginBtn) {
            loginBtn.disabled = true;
            loginBtn.textContent = '로그인 중...';
        }

        try {
            const { data, error } = await sb.auth.signInWithPassword({
                email,
                password
            });

            if (error) {
                let msg = error.message;
                if (msg.includes('Invalid login credentials')) {
                    msg = '이메일 또는 비밀번호가 올바르지 않습니다.';
                } else if (msg.includes('Email not confirmed')) {
                    msg = '이메일 인증이 완료되지 않았습니다. 메일함을 확인해 주세요.';
                }
                showMessage(msg);
            } else {
                clearMessage();
                if (data?.user) {
                    updateAuthUI(data.user);
                }
            }
        } catch (err) {
            console.error('로그인 예외:', err);
            showMessage('로그인 처리 중 오류가 발생했습니다.');
        } finally {
            if (loginBtn) {
                loginBtn.disabled = false;
                loginBtn.textContent = '로그인';
            }
        }
    }

    if (loginBtn) {
        loginBtn.addEventListener('click', handleLogin);
    }

    // --- 3. 회원가입 처리 ---
    async function handleSignup() {
        clearMessage();
        const email = emailInput ? emailInput.value.trim() : '';
        const password = passwordInput ? passwordInput.value.trim() : '';

        if (!email || !password) {
            showMessage('이메일과 비밀번호를 모두 입력해 주세요.');
            return;
        }

        if (password.length < 6) {
            showMessage('비밀번호는 최소 6자리 이상이어야 합니다.');
            return;
        }

        const sb = getSupabase();
        if (!sb) {
            showMessage('Supabase 클라이언트 초기화 실패. 페이지를 새로고침해 주세요.');
            return;
        }

        if (signupBtn) {
            signupBtn.disabled = true;
            signupBtn.textContent = '가입 중...';
        }

        try {
            const { data, error } = await sb.auth.signUp({
                email,
                password
            });

            if (error) {
                showMessage('회원가입 실패: ' + error.message);
            } else if (data?.user?.identities?.length === 0) {
                showMessage('이미 가입된 이메일 주소입니다. 로그인해 주세요.');
            } else {
                showMessage('가입 확인 이메일을 확인해주세요!', false);
            }
        } catch (err) {
            console.error('회원가입 예외:', err);
            showMessage('회원가입 처리 중 오류가 발생했습니다.');
        } finally {
            if (signupBtn) {
                signupBtn.disabled = false;
                signupBtn.textContent = '회원가입';
            }
        }
    }

    if (signupBtn) {
        signupBtn.addEventListener('click', handleSignup);
    }

    // --- 4. Google 소셜 로그인 처리 ---
    if (googleLoginBtn) {
        googleLoginBtn.addEventListener('click', async () => {
            clearMessage();
            const sb = getSupabase();
            if (!sb) {
                showMessage('Supabase 클라이언트 연결 실패. 페이지를 새로고침해 주세요.');
                return;
            }

            try {
                googleLoginBtn.disabled = true;
                googleLoginBtn.style.opacity = '0.7';

                const { data, error } = await sb.auth.signInWithOAuth({
                    provider: 'google',
                    options: {
                        redirectTo: window.location.origin
                    }
                });

                if (error) {
                    showMessage('Google 로그인 실패: ' + error.message);
                    googleLoginBtn.disabled = false;
                    googleLoginBtn.style.opacity = '1';
                }
            } catch (err) {
                console.error('Google OAuth 로그인 에러:', err);
                showMessage('Google 로그인 연동 중 오류가 발생했습니다.');
                googleLoginBtn.disabled = false;
                googleLoginBtn.style.opacity = '1';
            }
        });
    }

    // --- 5. 로그아웃 처리 ---
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            const sb = getSupabase();
            if (sb) {
                await sb.auth.signOut();
            }
            updateAuthUI(null);
        });
    }

    // --- 6. 음성 인식 처리 ---
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (voiceBtn) {
        if (!SpeechRecognition) {
            voiceBtn.addEventListener('click', () => {
                alert("현재 브라우저는 음성 인식을 지원하지 않습니다. Chrome 브라우저를 사용해주세요.");
            });
        } else {
            const recognition = new SpeechRecognition();
            recognition.lang = 'ko-KR';
            recognition.interimResults = false;
            recognition.continuous = false;

            recognition.onstart = () => {
                voiceBtn.textContent = '음성 인식중...';
                voiceBtn.classList.add('recording');
            };

            recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                const currentText = textInput.value;
                textInput.value = currentText ? currentText + ' ' + transcript : transcript;
            };

            recognition.onend = () => {
                voiceBtn.textContent = '음성으로 입력하기';
                voiceBtn.classList.remove('recording');
            };

            recognition.onerror = (event) => {
                console.error("음성 인식 에러:", event.error);
                voiceBtn.textContent = '음성으로 입력하기';
                voiceBtn.classList.remove('recording');
            };

            voiceBtn.addEventListener('click', () => {
                if (voiceBtn.classList.contains('recording')) {
                    recognition.stop();
                } else {
                    recognition.start();
                }
            });
        }
    }

    // 인증 헤더 생성 헬퍼 (Authorization: Bearer <access_token>)
    async function getAuthHeaders() {
        const sb = getSupabase();
        if (!sb) return {};
        try {
            const { data: { session } } = await sb.auth.getSession();
            if (session && session.access_token) {
                return { 'Authorization': `Bearer ${session.access_token}` };
            }
        } catch (err) {
            console.error('[Auth Header] 토큰 획득 에러:', err);
        }
        return {};
    }

    // --- 7. 감정 분석 요청 API 처리 ---
    if (analyzeBtn) {
        analyzeBtn.addEventListener('click', async () => {
            const text = textInput ? textInput.value.trim() : '';
            if (!text) {
                alert('먼저 일기 내용을 입력해주세요.');
                return;
            }

            analyzeBtn.disabled = true;
            analyzeBtn.textContent = '분석 중...';
            if (aiResponse) aiResponse.textContent = 'AI가 감정을 분석하고 답변을 작성 중입니다. 잠시만 기다려주세요...';

            try {
                const authHeaders = await getAuthHeaders();
                const response = await fetch('/api/analyze', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...authHeaders
                    },
                    body: JSON.stringify({ text })
                });

                const data = await response.json();

                if (response.ok) {
                    const formattedResponse = data.response.replace(/\n/g, '<br>');
                    if (aiResponse) aiResponse.innerHTML = formattedResponse;
                    
                    localStorage.setItem('diaryText', text);
                    localStorage.setItem('aiResponseHTML', formattedResponse);
                    
                    loadHistory();
                } else {
                    if (aiResponse) aiResponse.textContent = '에러: ' + (data.error || '알 수 없는 에러가 발생했습니다.');
                }
            } catch (error) {
                console.error('분석 요청 에러:', error);
                if (aiResponse) aiResponse.textContent = '네트워크 통신 중 에러가 발생했습니다. 서버가 켜져 있는지 확인해주세요.';
            } finally {
                analyzeBtn.disabled = false;
                analyzeBtn.textContent = '분석 요청하기';
            }
        });
    }

    // --- 8. 히스토리 불러오기 ---
    async function loadHistory() {
        const historyContainer = document.getElementById('history-container');
        if (!historyContainer) return;

        try {
            const authHeaders = await getAuthHeaders();
            const response = await fetch('/api/history', {
                method: 'GET',
                headers: {
                    ...authHeaders
                }
            });
            const data = await response.json();

            if (response.ok) {
                if (!Array.isArray(data) || data.length === 0) {
                    historyContainer.innerHTML = '<p style="color: #888; text-align: center; padding: 20px;">아직 저장된 일기가 없습니다. 첫 일기를 작성해보세요!</p>';
                } else {
                    historyContainer.innerHTML = data.map(item => {
                        const dateStr = item.timestamp 
                            ? new Date(item.timestamp).toLocaleString('ko-KR') 
                            : '시간 정보 없음';
                        
                        return `
                            <div class="history-card">
                                <div class="history-date">🕒 ${dateStr}</div>
                                <div class="history-original">" ${item.originalText} "</div>
                                <div class="history-ai">${(item.aiResponse || '').replace(/\n/g, '<br>')}</div>
                            </div>
                        `;
                    }).join('');
                }
            } else {
                historyContainer.innerHTML = '<p style="color: red; text-align: center;">히스토리를 불러오는데 실패했습니다.</p>';
            }
        } catch (error) {
            console.error('히스토리 로딩 에러:', error);
            historyContainer.innerHTML = '<p style="color: red; text-align: center;">서버와 통신할 수 없어 히스토리를 불러올 수 없습니다.</p>';
        }
    }
});
