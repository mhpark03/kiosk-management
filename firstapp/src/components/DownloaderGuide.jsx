import './DownloaderGuide.css';

function DownloaderGuide() {
  return (
    <div className="downloader-guide">
      <div className="guide-container">
        <h1>키오스크 다운로더 앱 사용설명서</h1>
        <p className="subtitle">Kiosk Video Downloader v1.1.0</p>

        <section className="guide-section">
          <h2>📱 앱 소개</h2>
          <p>키오스크 다운로더는 웹 대시보드에서 할당한 영상을 키오스크 장치로 다운로드하는 데스크톱 애플리케이션입니다.</p>

          <div className="feature-grid">
            <div className="feature-card">
              <div className="feature-icon">🔄</div>
              <h3>자동 동기화</h3>
              <p>설정한 주기마다 자동으로 새 영상 확인</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📥</div>
              <h3>스마트 다운로드</h3>
              <p>이미 다운로드한 영상은 건너뛰기</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📊</div>
              <h3>진행상황 표시</h3>
              <p>각 영상별 다운로드 진행률 표시</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">⚙️</div>
              <h3>간편한 설정</h3>
              <p>서버 선택, 경로 지정 등 쉬운 설정</p>
            </div>
          </div>
        </section>

        <section className="guide-section">
          <h2>🚀 시작하기</h2>

          <div className="step-card">
            <h3>1단계: 앱 다운로드</h3>
            <p>GitHub 릴리즈 페이지에서 최신 버전을 다운로드합니다.</p>

            <div className="download-box">
              <div className="download-item">
                <strong>📦 파일명</strong>
                <code>Kiosk Video Downloader Setup 1.1.0.exe</code>
              </div>
              <div className="download-item">
                <strong>📏 파일 크기</strong>
                <span>약 74MB</span>
              </div>
              <div className="download-item">
                <strong>🔗 다운로드 링크</strong>
                <a href="https://github.com/mhpark03/kiosk-management/releases" target="_blank" rel="noopener noreferrer">
                  GitHub Releases 페이지 →
                </a>
              </div>
            </div>
          </div>

          <div className="step-card">
            <h3>2단계: 앱 설치</h3>
            <ol>
              <li>다운로드한 <code>.exe</code> 파일 더블클릭</li>
              <li>Windows Defender 경고가 나타나면:
                <ul>
                  <li>"추가 정보" 클릭</li>
                  <li>"실행" 버튼 클릭</li>
                </ul>
              </li>
              <li>설치 마법사 시작</li>
              <li>설치 위치 선택 (기본값 권장): <code>C:\Program Files\Kiosk Video Downloader</code></li>
              <li>"Next" 클릭하여 설치 진행</li>
              <li>설치 완료 후 "Finish" 클릭</li>
            </ol>
            <div className="alert alert-info">
              💡 <strong>팁</strong>: "바탕화면 바로가기 만들기" 옵션을 선택하면 편리합니다.
            </div>
          </div>

          <div className="step-card">
            <h3>3단계: 앱 실행</h3>
            <ul>
              <li>바탕화면 바로가기 더블클릭 또는</li>
              <li>시작 메뉴에서 "Kiosk Video Downloader" 검색 후 실행</li>
            </ul>
          </div>
        </section>

        <section className="guide-section">
          <h2>⚙️ 초기 설정</h2>

          <div className="alert alert-warning" style={{marginBottom: '20px'}}>
            🔐 <strong>중요</strong>: 모든 설정 작업은 <strong>로그인 상태</strong>에서만 가능합니다.
            먼저 웹 대시보드에서 승인받은 계정으로 로그인해주세요.
          </div>

          <div className="step-card">
            <h3>로그인</h3>
            <p>앱 실행 후 가장 먼저 로그인을 진행합니다.</p>

            <ol>
              <li>앱 상단의 "로그인" 버튼 클릭</li>
              <li>웹 대시보드와 동일한 이메일/비밀번호 입력</li>
              <li>로그인 성공 시 사용자 이름 표시</li>
            </ol>

            <div className="alert alert-info">
              💡 <strong>참고</strong>: 웹 대시보드에서 관리자 승인을 받은 계정만 로그인할 수 있습니다.
            </div>
          </div>

          <div className="step-card">
            <h3>서버 선택</h3>
            <p>앱 상단의 서버 선택 라디오 버튼에서 서버를 선택합니다.</p>

            <div className="server-options">
              <div className="server-option">
                <input type="radio" checked readOnly />
                <div>
                  <strong>AWS 개발 서버 (기본값)</strong>
                  <p>자동으로 선택되어 있습니다. 대부분의 경우 이 옵션을 사용합니다.</p>
                  <code>http://kiosk-backend-env.eba-32jx2nbm.ap-northeast-2.elasticbeanstalk.com/api</code>
                </div>
              </div>
              <div className="server-option">
                <input type="radio" readOnly />
                <div>
                  <strong>로컬 서버</strong>
                  <p>개발 테스트용 로컬 서버 (localhost:8080)</p>
                </div>
              </div>
              <div className="server-option">
                <input type="radio" readOnly />
                <div>
                  <strong>직접 입력</strong>
                  <p>사용자 지정 서버 URL 입력</p>
                </div>
              </div>
            </div>
          </div>

          <div className="step-card">
            <h3>키오스크 ID 입력</h3>
            <p>웹 대시보드에서 확인한 12자리 키오스크 ID를 입력합니다.</p>

            <div className="input-example">
              <label>키오스크 ID</label>
              <input type="text" value="000000000001" readOnly />
              <p className="help-text">예: 000000000001</p>
            </div>

            <div className="alert alert-warning">
              ⚠️ <strong>중요</strong>: 키오스크 ID는 웹 대시보드의 "키오스크 관리" 메뉴에서 확인할 수 있습니다.
            </div>
          </div>

          <div className="step-card">
            <h3>매장 ID 입력</h3>
            <p>키오스크가 속한 매장의 8자리 POS ID를 입력합니다.</p>

            <div className="input-example">
              <label>매장 ID (POS ID)</label>
              <input type="text" value="00000001" readOnly />
              <p className="help-text">예: 00000001</p>
            </div>

            <div className="alert alert-warning">
              ⚠️ <strong>중요</strong>: 매장 ID는 키오스크 등록 시 설정한 매장과 일치해야 합니다. 일치하지 않으면 정상적으로 등록되지 않습니다.
            </div>

            <div className="info-box">
              <strong>매장 ID 확인 방법</strong>:
              <ul>
                <li>웹 대시보드 로그인</li>
                <li>"키오스크" 메뉴 클릭</li>
                <li>해당 키오스크의 "매장" 열에서 매장명 확인</li>
                <li>매장명 옆 괄호 안의 숫자가 매장 ID입니다 (예: 강남점 (1) → POS ID: 00000001)</li>
              </ul>
            </div>
          </div>

          <div className="step-card">
            <h3>다운로드 경로 설정</h3>
            <p>영상 파일을 저장할 폴더를 선택합니다.</p>

            <div className="path-selector">
              <input type="text" value="C:\Videos\Kiosk" readOnly />
              <button className="btn-browse">📁 찾아보기</button>
            </div>

            <div className="info-box">
              <strong>권장 설정</strong>:
              <ul>
                <li>충분한 여유 공간이 있는 드라이브 선택</li>
                <li>키오스크 재생 앱과 같은 폴더 또는 연결된 폴더</li>
                <li>예: <code>C:\Videos\Kiosk</code> 또는 <code>D:\Kiosk\Videos</code></li>
              </ul>
            </div>
          </div>

          <div className="step-card">
            <h3>자동 동기화 설정</h3>
            <p>주기적으로 자동으로 새 영상을 확인하고 다운로드합니다.</p>

            <div className="sync-settings">
              <label className="checkbox-label">
                <input type="checkbox" defaultChecked />
                <span>자동 동기화 활성화</span>
              </label>

              <div className="sync-interval">
                <label>동기화 간격</label>
                <select defaultValue="12">
                  <option value="1">1시간</option>
                  <option value="3">3시간</option>
                  <option value="6">6시간</option>
                  <option value="12">12시간 (권장)</option>
                  <option value="24">24시간</option>
                </select>
              </div>
            </div>

            <div className="tip-box">
              💡 <strong>팁</strong>: 자동 동기화를 활성화하면 항상 최신 영상을 유지할 수 있습니다.
            </div>
          </div>

          <div className="step-card">
            <h3>설정 저장</h3>
            <p>모든 설정을 입력한 후 <strong>"설정 저장"</strong> 버튼을 클릭합니다.</p>

            <div className="alert alert-success">
              ✅ 설정이 저장되면 "설정이 저장되었습니다" 메시지가 표시됩니다.
            </div>

            <div className="info-box">
              <strong>💡 참고: 웹에서도 설정 가능</strong>
              <p>다운로더 앱에서 설정한 키오스크 정보(매장 ID, 다운로드 경로, 자동 동기화 간격 등)는
              웹 대시보드의 <strong>"키오스크 관리"</strong> 화면에서도 확인 및 수정할 수 있습니다.
              웹에서 수정한 설정은 다음 동기화 시 자동으로 앱에 반영됩니다.</p>
            </div>
          </div>

          <div className="step-card">
            <h3>로그아웃 (보안 권장)</h3>
            <p>설정 작업이 완료되면 보안을 위해 <strong>반드시 로그아웃</strong>하는 것을 권장합니다.</p>

            <ol>
              <li>앱 상단의 <strong>"로그아웃"</strong> 버튼 클릭</li>
              <li>로그아웃 확인</li>
            </ol>

            <div className="alert alert-warning">
              🔒 <strong>보안 중요</strong>: 키오스크 장치는 무인으로 운영되므로, 설정 완료 후 로그아웃하여
              타인이 설정을 임의로 변경하지 못하도록 해야 합니다.
            </div>

            <div className="alert alert-success">
              ✅ <strong>안심하세요</strong>: 로그아웃 후에도 <strong>자동 동기화는 정상적으로 계속 동작</strong>합니다.
              저장된 설정(키오스크 ID, 매장 ID, 다운로드 경로, 자동 동기화 간격)은 유지되며,
              예약된 시간에 자동으로 영상을 다운로드합니다.
            </div>
          </div>
        </section>

        <section className="guide-section">
          <h2>📥 영상 다운로드</h2>

          <div className="step-card">
            <h3>수동 동기화</h3>
            <ol>
              <li>앱 화면에서 <strong>"동기화"</strong> 버튼 클릭</li>
              <li>서버에서 할당된 영상 목록 가져오기</li>
              <li>영상 목록이 화면에 표시됨</li>
              <li>각 영상별로 다운로드 자동 시작</li>
              <li>진행률 바로 다운로드 상태 확인</li>
              <li>완료된 영상은 ✅ 체크 표시</li>
            </ol>
          </div>

          <div className="step-card">
            <h3>다운로드 상태 확인</h3>

            <div className="status-indicators">
              <div className="status-item">
                <span className="status-badge pending">대기중</span>
                <p>다운로드 대기 중인 영상</p>
              </div>
              <div className="status-item">
                <span className="status-badge downloading">다운로드중</span>
                <p>현재 다운로드 진행 중 (진행률 표시)</p>
              </div>
              <div className="status-item">
                <span className="status-badge completed">완료</span>
                <p>다운로드 완료된 영상</p>
              </div>
              <div className="status-item">
                <span className="status-badge error">실패</span>
                <p>다운로드 실패 (재시도 가능)</p>
              </div>
            </div>
          </div>

          <div className="step-card">
            <h3>다운로드 로그</h3>
            <p>앱 하단의 로그 영역에서 상세한 다운로드 정보를 확인할 수 있습니다.</p>

            <div className="log-example">
              <div className="log-entry">[2025-10-30 14:23:45] 서버 연결 성공</div>
              <div className="log-entry">[2025-10-30 14:23:46] 영상 3개 발견</div>
              <div className="log-entry">[2025-10-30 14:23:47] 다운로드 시작: 신제품광고.mp4</div>
              <div className="log-entry success">[2025-10-30 14:24:12] 다운로드 완료: 신제품광고.mp4</div>
            </div>
          </div>
        </section>

        <section className="guide-section">
          <h2>🔄 영상 업데이트</h2>

          <div className="update-process">
            <h3>웹 대시보드에서 새 영상 할당</h3>
            <ol>
              <li>웹 대시보드에서 새 영상 등록</li>
              <li>키오스크에 영상 할당</li>
              <li>할당 완료</li>
            </ol>

            <div className="arrow-down">⬇</div>

            <h3>다운로더 앱에서 동기화</h3>
            <ol>
              <li>다운로더 앱에서 <strong>"동기화"</strong> 버튼 클릭</li>
              <li>또는 자동 동기화 시간 도달 시 자동 실행</li>
              <li>새로운 영상 자동 다운로드</li>
            </ol>

            <div className="arrow-down">⬇</div>

            <h3>키오스크에서 재생</h3>
            <p>키오스크 재생 앱이 새 영상을 자동으로 인식하여 재생합니다.</p>
          </div>
        </section>

        <section className="guide-section">
          <h2>🔧 문제 해결</h2>

          <div className="troubleshooting">
            <h3>로그인 실패</h3>
            <p><strong>증상</strong>: "로그인에 실패했습니다" 오류</p>
            <p><strong>해결방법</strong>:</p>
            <ol>
              <li>이메일과 비밀번호가 정확한지 확인</li>
              <li>웹 대시보드에서 로그인 가능한지 확인</li>
              <li>관리자의 승인을 받았는지 확인 (PENDING_APPROVAL 상태가 아닌지)</li>
              <li>서버 연결 상태 확인</li>
              <li>앱 재시작 후 다시 시도</li>
            </ol>
          </div>

          <div className="troubleshooting">
            <h3>설정 저장 불가</h3>
            <p><strong>증상</strong>: 설정 저장 시 오류 발생</p>
            <p><strong>해결방법</strong>:</p>
            <ol>
              <li><strong>로그인 상태 확인</strong> (로그인하지 않으면 설정 불가)</li>
              <li>앱 상단에 사용자 이름이 표시되어 있는지 확인</li>
              <li>로그아웃 상태라면 다시 로그인</li>
              <li>모든 필수 항목이 입력되었는지 확인</li>
            </ol>
          </div>

          <div className="troubleshooting">
            <h3>서버 연결 실패</h3>
            <p><strong>증상</strong>: "서버에 연결할 수 없습니다" 오류</p>
            <p><strong>해결방법</strong>:</p>
            <ol>
              <li>인터넷 연결 확인</li>
              <li>서버 선택 확인 (AWS 개발 서버 선택되어 있는지)</li>
              <li>방화벽 설정 확인 (앱 허용 필요)</li>
              <li>앱 재시작</li>
            </ol>
          </div>

          <div className="troubleshooting">
            <h3>키오스크 ID 오류</h3>
            <p><strong>증상</strong>: "키오스크를 찾을 수 없습니다" 오류</p>
            <p><strong>해결방법</strong>:</p>
            <ol>
              <li>키오스크 ID가 정확한지 확인 (12자리)</li>
              <li>웹 대시보드에서 키오스크 ID 재확인</li>
              <li>앞뒤 공백이 없는지 확인</li>
              <li>대문자/소문자 확인 (숫자만 입력)</li>
            </ol>
          </div>

          <div className="troubleshooting">
            <h3>매장 ID 불일치 오류</h3>
            <p><strong>증상</strong>: 설정은 저장되지만 동기화 시 오류 발생</p>
            <p><strong>해결방법</strong>:</p>
            <ol>
              <li>웹 대시보드 → 키오스크 관리에서 해당 키오스크의 매장 확인</li>
              <li>매장명 옆 괄호 안의 숫자 확인 (예: 강남점 (1))</li>
              <li>괄호 안 숫자에 0을 앞에 붙여 8자리로 만들기 (1 → 00000001)</li>
              <li>다운로더 앱의 매장 ID를 정확히 일치하도록 수정</li>
              <li>설정 저장 후 앱 재시작</li>
            </ol>
          </div>

          <div className="troubleshooting">
            <h3>다운로드 실패</h3>
            <p><strong>증상</strong>: 특정 영상 다운로드가 실패함</p>
            <p><strong>해결방법</strong>:</p>
            <ol>
              <li>저장 공간 확인 (충분한 여유 공간 필요)</li>
              <li>다운로드 경로 폴더가 존재하는지 확인</li>
              <li>폴더에 쓰기 권한이 있는지 확인</li>
              <li>"동기화" 버튼 다시 클릭하여 재시도</li>
              <li>앱 재시작 후 다시 시도</li>
            </ol>
          </div>

          <div className="troubleshooting">
            <h3>자동 동기화가 작동하지 않음</h3>
            <p><strong>증상</strong>: 설정한 시간이 지나도 자동 동기화 안 됨</p>
            <p><strong>해결방법</strong>:</p>
            <ol>
              <li>자동 동기화 체크박스가 선택되어 있는지 확인</li>
              <li>설정 저장 버튼을 눌렀는지 확인</li>
              <li>앱이 백그라운드에서 실행 중인지 확인</li>
              <li>앱을 완전히 종료하지 않고 최소화만 해야 함</li>
            </ol>
          </div>
        </section>

        <section className="guide-section">
          <h2>📋 주요 기능</h2>

          <div className="feature-list">
            <div className="feature-detail">
              <h3>🔄 스마트 동기화</h3>
              <ul>
                <li>이미 다운로드된 영상은 건너뜀</li>
                <li>파일 크기와 해시 비교로 중복 방지</li>
                <li>변경된 영상만 다시 다운로드</li>
              </ul>
            </div>

            <div className="feature-detail">
              <h3>📊 실시간 모니터링</h3>
              <ul>
                <li>각 영상별 다운로드 진행률 표시</li>
                <li>다운로드 속도 표시</li>
                <li>남은 시간 예측</li>
                <li>전체 진행 상황 요약</li>
              </ul>
            </div>

            <div className="feature-detail">
              <h3>💾 로컬 데이터 관리</h3>
              <ul>
                <li>다운로드 이력 저장</li>
                <li>마지막 동기화 시간 기록</li>
                <li>설정 자동 저장</li>
              </ul>
            </div>

            <div className="feature-detail">
              <h3>🔔 이벤트 로깅</h3>
              <ul>
                <li>모든 작업 로그 기록</li>
                <li>오류 발생 시 상세 정보 표시</li>
                <li>서버와의 통신 내역</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="guide-section">
          <h2>⚙️ 고급 설정</h2>

          <div className="advanced-settings">
            <h3>설정 파일 위치</h3>
            <p>앱 설정은 다음 파일에 저장됩니다:</p>
            <code className="file-path">C:\Users\[사용자명]\AppData\Roaming\kiosk-downloader\config.json</code>

            <div className="alert alert-warning">
              ⚠️ <strong>주의</strong>: 설정 파일을 직접 수정하지 마세요. 앱 내에서 설정을 변경하세요.
            </div>
          </div>

          <div className="advanced-settings">
            <h3>로그 파일 위치</h3>
            <p>다운로드 로그는 다음 폴더에 저장됩니다:</p>
            <code className="file-path">C:\Users\[사용자명]\AppData\Roaming\kiosk-downloader\logs\</code>
            <p className="help-text">문제 발생 시 로그 파일을 관리자에게 전달하면 도움이 됩니다.</p>
          </div>
        </section>

        <section className="guide-section">
          <h2>💡 사용 팁</h2>

          <div className="tips-grid">
            <div className="tip-card">
              <div className="tip-icon">🔒</div>
              <h3>보안 유지</h3>
              <p>설정 완료 후 반드시 로그아웃하세요. 로그아웃 후에도 자동 동기화는 정상 작동합니다.</p>
            </div>

            <div className="tip-card">
              <div className="tip-icon">⚡</div>
              <h3>빠른 동기화</h3>
              <p>동기화 버튼 단축키: <kbd>Ctrl</kbd> + <kbd>S</kbd></p>
            </div>

            <div className="tip-card">
              <div className="tip-icon">🌐</div>
              <h3>웹에서 관리</h3>
              <p>키오스크 설정은 웹 대시보드에서도 수정 가능하며, 다음 동기화 시 자동 반영됩니다.</p>
            </div>

            <div className="tip-card">
              <div className="tip-icon">🌙</div>
              <h3>야간 동기화</h3>
              <p>자동 동기화를 새벽 시간대로 설정하면 영업 시간에 방해받지 않습니다.</p>
            </div>

            <div className="tip-card">
              <div className="tip-icon">💾</div>
              <h3>저장 공간 확인</h3>
              <p>정기적으로 저장 공간을 확인하고 불필요한 파일을 삭제하세요.</p>
            </div>

            <div className="tip-card">
              <div className="tip-icon">🔄</div>
              <h3>주기적인 재시작</h3>
              <p>일주일에 한 번 정도 앱을 재시작하면 안정적으로 작동합니다.</p>
            </div>
          </div>
        </section>

        <section className="guide-section">
          <h2>📞 지원</h2>

          <div className="support-box">
            <h3>기술 지원</h3>
            <p>문제가 해결되지 않을 경우:</p>
            <ul>
              <li>로그 파일을 확인하세요</li>
              <li>스크린샷을 찍어 관리자에게 전달하세요</li>
              <li>관리자 이메일로 문의하세요</li>
            </ul>
          </div>

          <div className="version-info">
            <h3>버전 정보</h3>
            <p><strong>현재 버전</strong>: 1.1.0</p>
            <p><strong>최신 업데이트</strong>: 2025-10-30</p>
            <p><strong>주요 변경사항</strong>:</p>
            <ul>
              <li>AWS 개발 서버를 기본 서버로 설정</li>
              <li>UI 및 기능 개선</li>
            </ul>
          </div>
        </section>

        <section className="guide-section">
          <h2>📝 체크리스트</h2>

          <div className="checklist">
            <label>
              <input type="checkbox" />
              <span>앱 다운로드 및 설치 완료</span>
            </label>
            <label>
              <input type="checkbox" />
              <span>로그인 완료 (승인받은 계정으로)</span>
            </label>
            <label>
              <input type="checkbox" />
              <span>서버 선택 (AWS 개발 서버)</span>
            </label>
            <label>
              <input type="checkbox" />
              <span>키오스크 ID 입력 (12자리)</span>
            </label>
            <label>
              <input type="checkbox" />
              <span>매장 ID 입력 (8자리, 키오스크 매장과 일치 필수)</span>
            </label>
            <label>
              <input type="checkbox" />
              <span>다운로드 경로 설정</span>
            </label>
            <label>
              <input type="checkbox" />
              <span>자동 동기화 설정 (선택)</span>
            </label>
            <label>
              <input type="checkbox" />
              <span>설정 저장 완료</span>
            </label>
            <label>
              <input type="checkbox" />
              <span>로그아웃 (보안을 위해 필수)</span>
            </label>
            <label>
              <input type="checkbox" />
              <span>첫 동기화 실행</span>
            </label>
            <label>
              <input type="checkbox" />
              <span>영상 다운로드 확인</span>
            </label>
          </div>
        </section>
      </div>
    </div>
  );
}

export default DownloaderGuide;
