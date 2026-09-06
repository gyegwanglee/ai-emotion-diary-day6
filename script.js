const voiceBtn = document.getElementById('voiceBtn');
const analyzeBtn = document.getElementById('analyzeBtn');
const textInput = document.getElementById('textInput');
const aiResponse = document.getElementById('aiResponse');

// 페이지 로드 시 로컬 스토리지 데이터 불러오기
window.addEventListener('DOMContentLoaded', () => {
    const savedText = localStorage.getItem('diaryText');
    const savedResponse = localStorage.getItem('aiResponseHTML');
    
    if (savedText) {
        textInput.value = savedText;
    }
    if (savedResponse) {
        aiResponse.innerHTML = savedResponse;
    }
});

// Web Speech API의 SpeechRecognition 객체 가져오기 (크로스 브라우징 지원)
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (!SpeechRecognition) {
    alert("현재 브라우저는 음성 인식을 지원하지 않습니다. Chrome 브라우저를 사용해주세요.");
} else {
    const recognition = new SpeechRecognition();
    
    // 한국어 설정
    recognition.lang = 'ko-KR';
    // 중간 결과 반환 비활성화 (최종 결과만 받음)
    recognition.interimResults = false;
    // 연속 인식 비활성화 (한 번 말하고 끝나면 종료)
    recognition.continuous = false;

    // 음성 인식 시작 이벤트
    recognition.onstart = () => {
        voiceBtn.textContent = '음성 인식중...';
        voiceBtn.classList.add('recording');
    };

    // 음성 인식 결과 이벤트
    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        // 기존 텍스트 뒤에 띄어쓰기하고 추가
        const currentText = textInput.value;
        if (currentText) {
            textInput.value = currentText + ' ' + transcript;
        } else {
            textInput.value = transcript;
        }
    };

    // 음성 인식 종료 이벤트 (성공 또는 에러 등 모두 포함)
    recognition.onend = () => {
        voiceBtn.textContent = '음성으로 입력하기';
        voiceBtn.classList.remove('recording');
    };

    // 에러 발생 시 처리
    recognition.onerror = (event) => {
        console.error("음성 인식 에러:", event.error);
        voiceBtn.textContent = '음성으로 입력하기';
        voiceBtn.classList.remove('recording');
    };

    // 버튼 클릭 이벤트 리스너
    voiceBtn.addEventListener('click', () => {
        // 이미 인식 중이라면 중지
        if (voiceBtn.classList.contains('recording')) {
            recognition.stop();
        } else {
            recognition.start();
        }
    });
}

// 분석 요청하기 버튼 클릭 이벤트
analyzeBtn.addEventListener('click', async () => {
    const text = textInput.value.trim();
    if (!text) {
        alert('먼저 일기 내용을 입력해주세요.');
        return;
    }

    // 버튼 비활성화 및 로딩 상태 표시
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = '분석 중...';
    aiResponse.textContent = 'AI가 감정을 분석하고 답변을 작성 중입니다. 잠시만 기다려주세요...';

    try {
        const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text })
        });

        const data = await response.json();

        if (response.ok) {
            // 응답 텍스트를 줄바꿈 처리해서 보여주기 위해 innerHTML 사용 또는 텍스트 교체
            const formattedResponse = data.response.replace(/\n/g, '<br>');
            aiResponse.innerHTML = formattedResponse;
            
            // 로컬 스토리지에 결과 저장
            localStorage.setItem('diaryText', text);
            localStorage.setItem('aiResponseHTML', formattedResponse);
        } else {
            aiResponse.textContent = '에러: ' + (data.error || '알 수 없는 에러가 발생했습니다.');
        }
    } catch (error) {
        console.error('분석 요청 에러:', error);
        aiResponse.textContent = '네트워크 통신 중 에러가 발생했습니다. 서버가 켜져 있는지 확인해주세요.';
    } finally {
        // 버튼 다시 활성화
        analyzeBtn.disabled = false;
        analyzeBtn.textContent = '분석 요청하기';
    }
});

