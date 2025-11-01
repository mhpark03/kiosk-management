import './UserGuide.css';

function UserGuide() {
  return (
    <div className="user-guide">
      <div className="guide-container">
        <h1>키오스크 관리 플랫폼 사용설명서</h1>

        <section className="guide-section">
          <h2>📋 시작하기 전에</h2>
          <div className="workflow-box">
            <h3>전체 작업 순서</h3>
            <ol className="workflow-steps">
              <li>회원가입</li>
              <li>관리자 승인 대기</li>
              <li>로그인</li>
              <li>매장 등록</li>
              <li>키오스크 등록</li>
              <li>영상 등록</li>
              <li>키오스크에 영상 할당</li>
              <li>다운로드 앱에서 영상 다운로드</li>
            </ol>
            <p className="note">이 순서대로 진행하면 키오스크에서 영상을 재생할 수 있습니다.</p>
          </div>
        </section>

        <section className="guide-section">
          <h2>🚀 단계별 시작 가이드</h2>

          <div className="step-card">
            <h3>1단계: 회원가입</h3>
            <p>처음 사용하는 경우 계정을 만들어야 합니다.</p>
            <ol>
              <li>로그인 화면에서 <strong>회원가입</strong> 링크 클릭</li>
              <li>필수 정보 입력:
                <ul>
                  <li><strong>이름</strong>: 사용자 이름</li>
                  <li><strong>이메일</strong>: 로그인에 사용할 이메일</li>
                  <li><strong>비밀번호</strong>: 8자 이상 (영문, 숫자 조합 권장)</li>
                  <li><strong>비밀번호 확인</strong>: 위와 동일하게 입력</li>
                </ul>
              </li>
              <li><strong>회원가입</strong> 버튼 클릭</li>
              <li>가입 완료 메시지 확인</li>
            </ol>
            <div className="alert alert-info">
              ⚠️ <strong>중요</strong>: 회원가입 후 바로 로그인할 수 없습니다. 관리자의 승인이 필요합니다.
            </div>
          </div>

          <div className="step-card">
            <h3>2단계: 관리자 승인 대기</h3>
            <p>가입한 계정은 관리자가 승인해야 사용할 수 있습니다.</p>
            <ul>
              <li>관리자가 사용자 관리 화면에서 계정을 확인합니다</li>
              <li>관리자가 역할(ADMIN/USER)을 부여하고 승인합니다</li>
              <li>승인이 완료되면 로그인할 수 있습니다</li>
            </ul>
            <div className="alert alert-warning">
              📧 승인이 지연되는 경우 관리자에게 직접 연락하세요.
            </div>
          </div>

          <div className="step-card">
            <h3>3단계: 로그인</h3>
            <p>관리자 승인 후 계정으로 시스템에 접속합니다.</p>
            <ol>
              <li>로그인 화면에서 이메일과 비밀번호 입력</li>
              <li><strong>로그인</strong> 버튼 클릭</li>
              <li>대시보드 화면으로 이동</li>
            </ol>
            <div className="alert alert-success">
              ✅ <strong>완료</strong>: 시스템에 로그인되었습니다. 이제 키오스크 관리를 시작할 수 있습니다.
            </div>
          </div>

          <div className="step-card">
            <h3>4단계: 매장 등록</h3>
            <p>키오스크를 설치할 매장 정보를 먼저 등록합니다.</p>
            <ol>
              <li>상단 메뉴에서 <strong>매장</strong> 클릭</li>
              <li><strong>매장 추가</strong> 버튼 클릭</li>
              <li>매장 정보 입력:
                <ul>
                  <li><strong>매장명</strong>: 예) 강남점, 홍대점</li>
                  <li><strong>주소</strong>: 매장 주소</li>
                  <li><strong>전화번호</strong>: 매장 연락처</li>
                </ul>
              </li>
              <li><strong>추가</strong> 버튼 클릭</li>
            </ol>
            <div className="info-box">
              <strong>참고</strong>: POS ID는 자동으로 생성됩니다 (8자리: 예 <code>00000001</code>)
              <br />등록된 매장은 목록에서 "강남점 (1)" 형식으로 표시됩니다 (앞의 0 제거)
            </div>
            <div className="example-box">
              <strong>예시</strong>:
              <ul>
                <li>매장명: 강남점</li>
                <li>주소: 서울시 강남구 강남대로 123</li>
                <li>전화번호: 02-1234-5678</li>
                <li>→ POS ID: <code>00000001</code> (자동 생성, 화면에는 "1"로 표시)</li>
              </ul>
            </div>
          </div>

          <div className="step-card">
            <h3>5단계: 키오스크 등록</h3>
            <p>매장에 설치할 키오스크 장치를 등록합니다.</p>
            <ol>
              <li>상단 메뉴에서 <strong>키오스크</strong> 클릭</li>
              <li><strong>키오스크 추가</strong> 버튼 클릭</li>
              <li>키오스크 정보 입력:
                <ul>
                  <li><strong>매장 선택</strong>: 4단계에서 등록한 매장 선택 (예: "강남점 (1)")</li>
                  <li><strong>키오스크 번호</strong>: 매장 내 순번 (예: 1번, 2번, 3번)</li>
                  <li><strong>제조사</strong>: 키오스크 제조사명 (예: Samsung, LG)</li>
                  <li><strong>시리얼 번호</strong>: 키오스크 장치의 고유 시리얼 번호</li>
                  <li><strong>상태</strong>: 초기 상태 선택 (보통 "준비중" 또는 "활성")</li>
                </ul>
              </li>
              <li><strong>추가</strong> 버튼 클릭</li>
            </ol>
            <div className="info-box">
              <strong>참고</strong>:
              <ul>
                <li>키오스크 ID는 자동으로 생성됩니다 (12자리: 예 <code>000000000001</code>)</li>
                <li>한 매장에 여러 대의 키오스크를 등록할 수 있습니다</li>
                <li>키오스크 번호는 매장마다 1부터 시작합니다</li>
              </ul>
            </div>
          </div>

          <div className="step-card">
            <h3>6단계: 영상 등록</h3>
            <p>키오스크에서 재생할 영상을 업로드하거나 AI로 생성합니다.</p>

            <h4>방법 A: 영상 파일 업로드</h4>
            <ol>
              <li>상단 메뉴에서 <strong>영상</strong> &gt; <strong>키오스크 영상 관리</strong> 클릭</li>
              <li><strong>영상 업로드</strong> 버튼 클릭</li>
              <li>영상 정보 입력:
                <ul>
                  <li><strong>제목</strong>: 영상 제목 (예: 신제품 광고)</li>
                  <li><strong>설명</strong>: 영상 설명</li>
                  <li><strong>파일 선택</strong>: 컴퓨터에서 영상 파일 선택 (MP4, AVI, MOV 등)</li>
                </ul>
              </li>
              <li><strong>업로드</strong> 버튼 클릭</li>
              <li>업로드 완료까지 대기</li>
            </ol>

            <h4>방법 B: AI로 영상 생성 (선택사항)</h4>
            <p><strong>Runway ML 사용</strong>:</p>
            <ol>
              <li><strong>영상</strong> &gt; <strong>편집영상관리</strong> 클릭</li>
              <li><strong>영상 만들기 (Runway)</strong> 버튼 클릭</li>
              <li>참조 이미지 2개 업로드</li>
              <li>프롬프트 입력 (예: "햄버거가 회전하는 장면")</li>
              <li>모델 및 설정 선택</li>
              <li><strong>영상 생성</strong> 버튼 클릭</li>
              <li>1~2분 대기</li>
              <li>생성된 영상 확인 후 <strong>저장</strong> 클릭</li>
            </ol>
          </div>

          <div className="step-card">
            <h3>7단계: 키오스크에 영상 할당</h3>
            <p>등록된 영상을 키오스크에 할당합니다.</p>
            <ol>
              <li>상단 메뉴에서 <strong>키오스크</strong> 클릭</li>
              <li>영상을 할당할 키오스크의 <strong>영상 관리</strong> 버튼 클릭</li>
              <li>할당 가능한 영상 목록에서 영상 선택</li>
              <li><strong>할당</strong> 버튼 클릭</li>
              <li>할당 완료 메시지 확인</li>
            </ol>
            <div className="info-box">
              <strong>참고</strong>:
              <ul>
                <li>한 키오스크에 여러 개의 영상을 할당할 수 있습니다</li>
                <li>할당된 영상은 "할당된 영상" 섹션에 표시됩니다</li>
                <li>할당 해제도 가능합니다 (할당된 영상 옆 <strong>해제</strong> 버튼)</li>
              </ul>
            </div>
          </div>

          <div className="step-card">
            <h3>8단계: 다운로드 앱에서 영상 다운로드</h3>
            <p>키오스크 현장에서 Flutter 다운로더 앱을 사용하여 영상을 받습니다.</p>

            <h4>다운로더 앱 설치</h4>
            <ol>
              <li><a href="https://github.com/mhpark03/kiosk-management/releases/latest" target="_blank" rel="noopener noreferrer">GitHub 릴리즈 페이지</a>에서 플랫폼별 설치 파일 다운로드:
                <ul>
                  <li><strong>Windows</strong>: <code>flutter_downloader_v2.0.0_windows.zip</code> (12MB)</li>
                  <li><strong>Android</strong>: <code>flutter_downloader_v2.0.0.apk</code> (50MB)</li>
                </ul>
              </li>
              <li><strong>Windows</strong>: ZIP 파일 압축 해제 후 <code>flutter_downloader.exe</code> 실행</li>
              <li><strong>Android</strong>: APK 파일 탭하여 설치 (알 수 없는 출처 허용 필요)</li>
            </ol>

            <h4>다운로더 앱 설정</h4>
            <ol>
              <li>앱 실행 시 초기 설정 화면 표시</li>
              <li><strong>서버 선택</strong>: 기본값 AWS 개발 서버 (자동 선택됨)
                <ul>
                  <li>Android 에뮬레이터: <code>http://10.0.2.2:8080/api</code> 사용</li>
                </ul>
              </li>
              <li><strong>키오스크 ID 입력</strong>: 5단계에서 생성된 키오스크 ID 입력 (예: <code>000000000001</code>)</li>
              <li><strong>POS ID 입력</strong>: 매장 ID 입력 (예: <code>00000001</code>)</li>
              <li><strong>다운로드 경로 설정</strong>: 영상을 저장할 폴더 선택
                <ul>
                  <li>Windows: <code>C:\Videos\Kiosk</code></li>
                  <li>Android: <code>/storage/emulated/0/Download/KioskVideos</code></li>
                </ul>
              </li>
              <li><strong>자동 동기화 설정</strong> (선택사항): 주기적 자동 다운로드 (WorkManager 백그라운드 작업)</li>
              <li><strong>설정 저장</strong> 버튼 클릭</li>
            </ol>

            <h4>영상 다운로드</h4>
            <ol>
              <li><strong>동기화</strong> 버튼 클릭</li>
              <li>서버에서 할당된 영상 목록 가져오기</li>
              <li>각 영상별로 다운로드 진행 (진행률 표시)</li>
              <li>모든 영상 다운로드 완료 확인</li>
            </ol>
            <div className="alert alert-info">
              💡 <strong>참고</strong>: 자세한 사용법은 <a href="/#/downloader-guide">다운로더 앱 사용설명서</a>를 참조하세요.
            </div>
            <div className="alert alert-success">
              ✅ <strong>완료</strong>: 키오스크에서 영상이 재생되고 있습니다!
            </div>
          </div>
        </section>

        <section className="guide-section">
          <h2>🔄 영상 업데이트 프로세스</h2>
          <p>키오스크 영상을 변경하고 싶을 때:</p>
          <ol className="update-steps">
            <li><strong>웹 대시보드</strong>에서 새로운 영상 등록 (6단계)</li>
            <li><strong>웹 대시보드</strong>에서 키오스크에 새 영상 할당 (7단계)</li>
            <li><strong>다운로더 앱</strong>에서 <strong>동기화</strong> 버튼 클릭</li>
            <li>새로운 영상 자동 다운로드</li>
            <li>키오스크에서 새 영상 재생</li>
          </ol>
          <div className="tip-box">
            💡 <strong>팁</strong>: 자동 동기화를 설정하면 수동으로 동기화 버튼을 누르지 않아도 됩니다.
          </div>
        </section>

        <section className="guide-section">
          <h2>🔧 문제 해결</h2>

          <div className="troubleshooting">
            <h3>로그인 문제</h3>
            <p><strong>증상</strong>: 로그인할 수 없음</p>
            <p><strong>해결</strong>:</p>
            <ol>
              <li>이메일과 비밀번호 재확인</li>
              <li>관리자 승인이 완료되었는지 확인</li>
              <li>비밀번호 찾기 기능 사용</li>
              <li>관리자에게 계정 상태 문의</li>
            </ol>
          </div>

          <div className="troubleshooting">
            <h3>영상 업로드 실패</h3>
            <p><strong>증상</strong>: 업로드가 중단되거나 실패</p>
            <p><strong>해결</strong>:</p>
            <ol>
              <li>파일 형식 확인 (MP4 권장)</li>
              <li>파일 크기 확인 (너무 큰 파일)</li>
              <li>네트워크 연결 확인</li>
              <li>브라우저 새로고침 후 재시도</li>
            </ol>
          </div>

          <div className="troubleshooting">
            <h3>다운로더 앱 연결 안 됨</h3>
            <p><strong>증상</strong>: 서버에 연결할 수 없음</p>
            <p><strong>해결</strong>:</p>
            <ol>
              <li>서버 URL 확인 (AWS 개발 서버 선택 확인)</li>
              <li>키오스크 ID 정확히 입력했는지 확인</li>
              <li>네트워크 방화벽 설정 확인</li>
              <li>앱 재시작</li>
            </ol>
          </div>
        </section>

        <section className="guide-section">
          <h2>📞 지원</h2>
          <div className="support-box">
            <h3>기술 지원</h3>
            <p>문제가 해결되지 않을 경우:</p>
            <ul>
              <li>관리자에게 직접 문의</li>
              <li>GitHub Issues: 버그 리포트</li>
            </ul>
          </div>
        </section>

        <section className="guide-section">
          <h2>📝 빠른 시작 체크리스트</h2>
          <div className="checklist">
            <label>
              <input type="checkbox" />
              <span>1단계: 회원가입 완료</span>
            </label>
            <label>
              <input type="checkbox" />
              <span>2단계: 관리자 승인 완료</span>
            </label>
            <label>
              <input type="checkbox" />
              <span>3단계: 로그인 성공</span>
            </label>
            <label>
              <input type="checkbox" />
              <span>4단계: 매장 최소 1개 등록</span>
            </label>
            <label>
              <input type="checkbox" />
              <span>5단계: 키오스크 등록 (매장 선택)</span>
            </label>
            <label>
              <input type="checkbox" />
              <span>6단계: 영상 최소 1개 등록</span>
            </label>
            <label>
              <input type="checkbox" />
              <span>7단계: 키오스크에 영상 할당</span>
            </label>
            <label>
              <input type="checkbox" />
              <span>8단계: 다운로더 앱 설치 및 설정</span>
            </label>
            <label>
              <input type="checkbox" />
              <span>8단계: 다운로더 앱에서 영상 다운로드</span>
            </label>
            <label>
              <input type="checkbox" />
              <span>8단계: 키오스크에서 영상 재생 확인</span>
            </label>
          </div>
        </section>
      </div>
    </div>
  );
}

export default UserGuide;
