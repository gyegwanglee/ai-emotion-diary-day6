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

    // 실시간 채팅 요소 참조
    const chatMessages = document.getElementById('chatMessages');
    const chatForm = document.getElementById('chatForm');
    const chatInput = document.getElementById('chatInput');
    const chatAttachBtn = document.getElementById('chatAttachBtn');
    const chatImageInput = document.getElementById('chatImageInput');

    // 프로필 섹션 요소 참조
    const profileAvatarContainer = document.getElementById('profileAvatarContainer');
    const profileAvatarImg = document.getElementById('profileAvatarImg');
    const defaultAvatarIcon = document.getElementById('defaultAvatarIcon');
    const changeProfileBtn = document.getElementById('changeProfileBtn');
    const profileFileInput = document.getElementById('profileFileInput');

    // 채팅 이미지 첨부 버튼 클릭 이벤트 및 파일 업로드 처리
    if (chatAttachBtn && chatImageInput) {
        chatAttachBtn.addEventListener('click', () => {
            chatImageInput.click();
        });

        chatImageInput.addEventListener('change', async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;

            const sb = getSupabase();
            if (!sb || !activeUser) {
                alert('로그인이 필요한 기능입니다.');
                chatImageInput.value = '';
                return;
            }

            try {
                // 1. 'chat-images' 버킷에 업로드 (사용자 ID별 고유 파일 경로 생성)
                const fileExt = file.name.split('.').pop() || 'png';
                const filePath = `${activeUser.id}/chat_${Date.now()}.${fileExt}`;

                const { data: uploadData, error: uploadError } = await sb.storage
                    .from('chat-images')
                    .upload(filePath, file, { upsert: true });

                if (uploadError) {
                    console.error('[Chat Image Upload Error]:', uploadError.message);
                    alert('이미지 업로드 실패: ' + uploadError.message);
                    return;
                }

                // 2. 업로드 성공 시 파일의 공개 URL 가져오기
                const { data: publicUrlData } = sb.storage
                    .from('chat-images')
                    .getPublicUrl(filePath);

                const publicUrl = publicUrlData?.publicUrl;

                if (publicUrl) {
                    // 3. 'messages' 테이블 등에 '![image](이미지_URL)' 특별한 형식으로 전송
                    const formattedMessage = `![image](${publicUrl})`;
                    await sendChatMessageContent(formattedMessage);
                }
            } catch (err) {
                console.error('[Chat Image Processing Exception]:', err);
                alert('채팅 이미지 처리 중 오류가 발생했습니다.');
            } finally {
                chatImageInput.value = '';
            }
        });
    }

    let activeUser = null;
    let chatChannel = null;

    // 프로필 아바타 표시 헬퍼
    function displayProfileAvatar(url) {
        if (url && profileAvatarImg) {
            profileAvatarImg.src = url;
            profileAvatarImg.style.display = 'block';
            if (defaultAvatarIcon) defaultAvatarIcon.style.display = 'none';
        } else {
            if (profileAvatarImg) {
                profileAvatarImg.src = '';
                profileAvatarImg.style.display = 'none';
            }
            if (defaultAvatarIcon) defaultAvatarIcon.style.display = 'block';
        }
    }

    if (profileAvatarImg) {
        profileAvatarImg.onerror = () => {
            displayProfileAvatar(null);
        };
    }

    // 프로필 이미지 / 사진 변경 버튼 클릭 시 파일 입력창 트리거
    if (profileAvatarContainer) {
        profileAvatarContainer.addEventListener('click', () => {
            if (profileFileInput) profileFileInput.click();
        });
    }
    if (changeProfileBtn) {
        changeProfileBtn.addEventListener('click', () => {
            if (profileFileInput) profileFileInput.click();
        });
    }

    // 이미지 파일 선택 시 Supabase Storage 업로드 및 메타데이터 저장, 프로필/채팅 즉시 반영
    if (profileFileInput) {
        profileFileInput.addEventListener('change', async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;

            const sb = getSupabase();
            if (!sb || !activeUser) {
                alert('로그인이 필요한 기능입니다.');
                return;
            }

            try {
                // 1) 고유 파일 경로 생성: [user_id]/avatar.png (또는 선택한 파일 확장자)
                const fileExt = file.name.split('.').pop() || 'png';
                const filePath = `${activeUser.id}/avatar.${fileExt}`;

                // Supabase 'avatars' 버킷에 업로드 (upsert: true 로 기존 파일 덮어쓰기)
                const { data: uploadData, error: uploadError } = await sb.storage
                    .from('avatars')
                    .upload(filePath, file, { upsert: true });

                if (uploadError) {
                    console.error('[Storage Upload Error]:', uploadError.message);
                    alert('사진 업로드 실패: ' + uploadError.message);
                    return;
                }

                // 2) 업로드한 파일의 공개 URL 가져오기
                const { data: publicUrlData } = sb.storage
                    .from('avatars')
                    .getPublicUrl(filePath);

                const publicUrl = publicUrlData?.publicUrl;

                if (publicUrl) {
                    // 3) Supabase Auth 사용자 메타데이터에 avatar_url 저장
                    const { data: updatedAuth, error: updateError } = await sb.auth.updateUser({
                        data: { avatar_url: publicUrl }
                    });

                    if (updateError) {
                        console.error('[Auth Update Error]:', updateError.message);
                    } else if (updatedAuth?.user) {
                        activeUser = updatedAuth.user;
                    }

                    // 4) 화면 상단의 프로필 이미지 즉시 새로운 사진으로 변경 (캐시 방지 타임스탬프)
                    const cacheBustedUrl = `${publicUrl}?t=${Date.now()}`;
                    displayProfileAvatar(cacheBustedUrl);

                    // 5) 채팅에서 내 이미지도 즉시 새로운 사진이 나타나게 연결
                    const myChatAvatars = document.querySelectorAll('.chat-item.mine .chat-sender-avatar-img');
                    myChatAvatars.forEach(img => {
                        img.src = cacheBustedUrl;
                        img.style.display = 'inline-block';
                    });
                    const myChatFallbacks = document.querySelectorAll('.chat-item.mine .chat-sender-avatar-fallback');
                    myChatFallbacks.forEach(fb => {
                        fb.style.display = 'none';
                    });

                    console.log('[Profile Avatar] 업로드, URL 획득, Auth 메타데이터 저장 및 프로필/채팅 즉시 반영 완료:', publicUrl);
                }
            } catch (err) {
                console.error('[Profile Avatar Processing Exception]:', err);
                alert('프로필 사진 처리 중 오류가 발생했습니다.');
            }
        });
    }

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
        activeUser = user;
        if (user) {
            console.log('[Auth] 로그인 상태:', user.email);
            if (authSection) authSection.style.display = 'none';
            if (mainAppSection) mainAppSection.style.display = 'flex';
            if (userEmailSpan) userEmailSpan.textContent = user.email || '사용자';
            
            // 프로필 아바타 설정
            const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture;
            displayProfileAvatar(avatarUrl);

            // 로컬 스토리지 데이터 복원
            const savedText = localStorage.getItem('diaryText');
            const savedResponse = localStorage.getItem('aiResponseHTML');
            if (savedText && textInput) textInput.value = savedText;
            if (savedResponse && aiResponse) aiResponse.innerHTML = savedResponse;

            // 히스토리 및 실시간 채팅 초기화
            loadHistory();
            initRealtimeChat(user);
        } else {
            console.log('[Auth] 비로그인 상태');
            if (authSection) authSection.style.display = 'flex';
            if (mainAppSection) mainAppSection.style.display = 'none';
            displayProfileAvatar(null);
            
            // 채널 구독 해제
            const sb = getSupabase();
            if (sb && chatChannel) {
                sb.removeChannel(chatChannel);
                chatChannel = null;
            }
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

        // 세션 변화 수신기
        client.auth.onAuthStateChange((event, session) => {
            console.log('[Auth] 상태 변경 이벤트:', event);
            updateAuthUI(session?.user || null);
        });
    } else {
        console.warn("[Auth] Supabase SDK 로드 대기 중...");
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

            // file:// 파일 직접 열기 모드 검사
            if (window.location.protocol === 'file:') {
                showMessage('⚠️ file:// 파일 모드에서는 구글 로그인이 불가능합니다. Live Server(http://127.0.0.1:5500)나 로컬 웹서버로 접속해주세요.');
                return;
            }

            try {
                googleLoginBtn.disabled = true;
                googleLoginBtn.style.opacity = '0.7';

                // 현재 리다이렉트 URL 생성 (쿼리스트링 및 해시 제외)
                const redirectUrl = window.location.origin + window.location.pathname;

                const { error } = await sb.auth.signInWithOAuth({
                    provider: 'google',
                    options: {
                        redirectTo: redirectUrl
                    }
                });

                if (error) {
                    let errText = error.message;
                    if (errText.includes('provider is not enabled') || errText.includes('Unsupported provider')) {
                        errText = 'Supabase 대시보드에서 Google Auth Provider 설정이 비활성화되어 있습니다. (Client ID/Secret 등록 필요)';
                    }
                    showMessage('Google 로그인 실패: ' + errText);
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

    // --- 6. 실시간 채팅(Realtime Chat) 로직 ---

    const renderedMsgKeys = new Set();

    function appendChatMessage(data) {
        if (!chatMessages) return;

        // 중복 렌더링 방지 고유 키 생성
        const timeKeyStr = data.timestamp ? new Date(data.timestamp).toISOString() : '';
        const key = data.msgId 
            ? `id-${data.msgId}` 
            : `${data.senderEmail}-${data.message}-${timeKeyStr.substring(0, 16)}`;

        if (renderedMsgKeys.has(key)) {
            return; // 이미 표시된 메시지면 통과
        }
        renderedMsgKeys.add(key);

        // 안내 문구 제거
        const placeholder = chatMessages.querySelector('.chat-placeholder');
        if (placeholder) placeholder.remove();

        const isMine = activeUser && (data.senderId === activeUser.id || data.senderEmail === activeUser.email);
        const timeStr = data.timestamp ? new Date(data.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '';

        const msgItem = document.createElement('div');
        msgItem.className = `chat-item ${isMine ? 'mine' : 'others'}`;

        // 각 메시지 상단/옆에 보낸 사람의 아바타와 이메일 표시
        const senderTag = document.createElement('div');
        senderTag.className = 'chat-sender-tag';

        const avatarImg = document.createElement('img');
        avatarImg.className = 'chat-sender-avatar-img';

        const avatarUrl = isMine 
            ? (activeUser?.user_metadata?.avatar_url || data.senderAvatarUrl)
            : (data.senderAvatarUrl || data.avatar_url);

        const fallbackSpan = document.createElement('span');
        fallbackSpan.className = 'chat-sender-avatar-fallback';
        fallbackSpan.textContent = '👤';

        if (avatarUrl) {
            avatarImg.src = avatarUrl;
            fallbackSpan.style.display = 'none';
        } else {
            avatarImg.style.display = 'none';
        }

        avatarImg.onerror = () => {
            avatarImg.style.display = 'none';
            fallbackSpan.style.display = 'inline-block';
        };

        const nameSpan = document.createElement('span');
        nameSpan.className = 'chat-sender-name';
        nameSpan.textContent = data.senderEmail || '익명';

        senderTag.appendChild(avatarImg);
        senderTag.appendChild(fallbackSpan);
        senderTag.appendChild(nameSpan);
        msgItem.appendChild(senderTag);

        const bubble = document.createElement('div');
        bubble.className = 'chat-bubble';

        // 4. '![image](이미지_URL)' 형식의 이미지 메시지인지 검사
        const imgMatch = data.message ? data.message.match(/^!\[image\]\((.*?)\)$/) : null;

        if (imgMatch && imgMatch[1]) {
            const imageUrl = imgMatch[1];
            bubble.classList.add('chat-bubble-image');

            const chatImg = document.createElement('img');
            chatImg.className = 'chat-attached-image';
            chatImg.src = imageUrl;
            chatImg.alt = '채팅 첨부 이미지';
            chatImg.title = '클릭하여 새 탭에서 이미지 열기';
            chatImg.addEventListener('click', () => {
                window.open(imageUrl, '_blank');
            });

            // 이미지가 모두 로드되면 스크롤 위치를 맨 아래로 유지
            chatImg.onload = () => {
                chatMessages.scrollTop = chatMessages.scrollHeight;
            };

            // 5. 이미지가 불러와지지 않는 경우 오류 안내 박스 표시
            const errorBox = document.createElement('div');
            errorBox.className = 'chat-image-error';
            errorBox.innerHTML = '⚠️ <span>이미지를 불러올 수 없습니다.</span>';
            errorBox.style.display = 'none';

            chatImg.onerror = () => {
                chatImg.style.display = 'none';
                errorBox.style.display = 'flex';
                chatMessages.scrollTop = chatMessages.scrollHeight;
            };

            bubble.appendChild(chatImg);
            bubble.appendChild(errorBox);
        } else {
            bubble.textContent = data.message;
        }

        msgItem.appendChild(bubble);

        const timeTag = document.createElement('div');
        timeTag.className = 'chat-timestamp';
        timeTag.textContent = timeStr;
        msgItem.appendChild(timeTag);

        chatMessages.appendChild(msgItem);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function initRealtimeChat(user) {
        const sb = getSupabase();
        if (!sb || !user) return;

        // 기존 채널 정리
        if (chatChannel) {
            sb.removeChannel(chatChannel);
        }

        // Supabase Realtime 채널 생성
        chatChannel = sb.channel('messages-realtime-channel');

        // 1) Broadcast 메시지 감지
        chatChannel.on('broadcast', { event: 'message' }, ({ payload }) => {
            console.log('[Realtime Broadcast] 메시지 수신:', payload);
            appendChatMessage(payload);
        });

        // 2) 'messages' 테이블의 INSERT 이벤트 실시간 구독 (postgres_changes)
        chatChannel.on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'messages' },
            (payload) => {
                console.log('[Realtime postgres_changes] messages INSERT:', payload.new);
                if (payload.new) {
                    appendChatMessage({
                        msgId: payload.new.id,
                        senderId: payload.new.user_id,
                        senderEmail: payload.new.user_email || payload.new.email,
                        senderAvatarUrl: payload.new.user_avatar || payload.new.avatar_url,
                        message: payload.new.content || payload.new.message,
                        timestamp: payload.new.created_at || payload.new.timestamp
                    });
                }
            }
        );

        // 3) 'message' 테이블의 INSERT 이벤트 실시간 구독 (단수형 호환)
        chatChannel.on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'message' },
            (payload) => {
                console.log('[Realtime postgres_changes] message INSERT:', payload.new);
                if (payload.new) {
                    appendChatMessage({
                        msgId: payload.new.id,
                        senderId: payload.new.user_id,
                        senderEmail: payload.new.user_email || payload.new.email,
                        senderAvatarUrl: payload.new.user_avatar || payload.new.avatar_url,
                        message: payload.new.content || payload.new.message,
                        timestamp: payload.new.created_at || payload.new.timestamp
                    });
                }
            }
        );

        chatChannel.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log('[Realtime Chat] 메시지 테이블 실시간 구독 활성화 완료');
            }
        });

        // 4) 페이지가 처음 열릴 때 기존 메시지들을 가져와 화면에 표시
        loadChatHistory(sb);
    }

    async function loadChatHistory(sb) {
        try {
            // 'messages' 테이블 우선 조회
            let { data, error } = await sb
                .from('messages')
                .select('*')
                .order('created_at', { ascending: true })
                .limit(100);

            // 'messages' 없을 경우 'message' 테이블 조회 시도
            if (error) {
                const retryMsg = await sb
                    .from('message')
                    .select('*')
                    .order('created_at', { ascending: true })
                    .limit(100);
                data = retryMsg.data;
                error = retryMsg.error;
            }

            // 'message'도 없을 경우 'chat_messages' 테이블 폴백
            if (error) {
                const retryChatMessages = await sb
                    .from('chat_messages')
                    .select('*')
                    .order('created_at', { ascending: true })
                    .limit(100);
                data = retryChatMessages.data;
                error = retryChatMessages.error;
            }

            if (!error && data && data.length > 0) {
                if (chatMessages) {
                    chatMessages.innerHTML = '';
                }
                data.forEach(item => {
                    appendChatMessage({
                        msgId: item.id,
                        senderId: item.user_id,
                        senderEmail: item.user_email || item.email,
                        senderAvatarUrl: item.user_avatar || item.avatar_url,
                        message: item.content || item.message,
                        timestamp: item.created_at || item.timestamp
                    });
                });
            }
        } catch (err) {
            console.warn('[Chat History Load Error]:', err.message);
        }
    }

    // 채팅 메시지(텍스트 또는 ![image](URL)) 전송 처리 함수
    async function sendChatMessageContent(messageText) {
        if (!messageText) return;

        const sb = getSupabase();
        if (!sb || !activeUser) return;

        const avatarUrl = activeUser?.user_metadata?.avatar_url || activeUser?.user_metadata?.picture || null;

        const payload = {
            senderId: activeUser.id,
            senderEmail: activeUser.email || '익명',
            senderAvatarUrl: avatarUrl,
            message: messageText,
            timestamp: new Date().toISOString()
        };

        // 1) Broadcast 메시지 전송
        if (chatChannel) {
            await chatChannel.send({
                type: 'broadcast',
                event: 'message',
                payload: payload
            });
        }

        // 2) 내 화면 즉시 표시
        appendChatMessage(payload);

        // 3) Supabase DB 저장 ('messages' / 'message' 테이블)
        try {
            const insertObj = {
                content: messageText,
                user_email: activeUser.email || '익명'
            };
            if (activeUser.id) {
                insertObj.user_id = activeUser.id;
            }

            let { error } = await sb
                .from('messages')
                .insert([insertObj]);

            if (error) {
                const retry = await sb
                    .from('message')
                    .insert([insertObj]);
                error = retry.error;
            }

            if (error) {
                await sb.from('chat_messages').insert([
                    {
                        user_id: activeUser.id,
                        user_email: activeUser.email || '익명',
                        message: messageText,
                        created_at: payload.timestamp
                    }
                ]);
            } else {
                console.log('[Supabase DB 메시지 저장 완료]');
            }
        } catch (err) {
            console.error('[Message DB 저장 예외]:', err.message);
        }
    }

    async function sendChatMessage() {
        if (!chatInput) return;
        const text = chatInput.value.trim();
        if (!text) return;

        chatInput.value = '';
        await sendChatMessageContent(text);
    }

    if (chatForm) {
        chatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            sendChatMessage();
        });
    }

    // --- 7. 음성 인식 처리 ---
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

    // 인증 헤더 생성 헬퍼
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

    // --- 8. 감정 분석 요청 API 처리 ---
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
                    
                    await loadHistory();
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

    // --- 9. 히스토리 불러오기 ---
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
