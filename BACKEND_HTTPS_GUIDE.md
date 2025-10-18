# Elastic Beanstalk Backend HTTPS 설정 가이드

## 📌 중요 사항

이 방법은 **백엔드만 HTTPS**로 변경합니다:
- ✅ Backend API: HTTPS
- ⚠️ Frontend: 여전히 HTTP (S3는 HTTPS 직접 지원 안함)

완전한 HTTPS는 CloudFront 검증 후 가능합니다.

---

## 1. Elastic Beanstalk Console 접속

https://ap-northeast-2.console.aws.amazon.com/elasticbeanstalk/home?region=ap-northeast-2

## 2. Environment 선택

"Kiosk-backend-env" 클릭

## 3. Configuration 클릭

왼쪽 메뉴에서 "Configuration" 선택

## 4. Load balancer 설정 수정

"Load balancer" 섹션에서 "Edit" 클릭

## 5. Listener 추가

### 현재 Listener (HTTP)
- Port: 80
- Protocol: HTTP
- 이것은 그대로 유지

### 새 Listener 추가 (HTTPS)

"Add listener" 클릭:

- **Port**: 443
- **Protocol**: HTTPS
- **SSL certificate**:
  - **자체 서명 인증서 사용** (테스트용)
    - 또는 ACM(AWS Certificate Manager)에서 인증서 발급 가능

#### 자체 서명 인증서가 없는 경우:

먼저 자체 서명 인증서를 생성해야 합니다.

**Windows PowerShell에서 실행:**

```powershell
# OpenSSL이 설치되어 있어야 합니다
# Git Bash의 OpenSSL 사용 가능

cd C:\claudtest

# 개인키 생성
openssl genrsa -out backend-key.pem 2048

# CSR 생성 (Certificate Signing Request)
openssl req -new -key backend-key.pem -out backend-csr.pem

# 자체 서명 인증서 생성 (1년 유효)
openssl x509 -req -days 365 -in backend-csr.pem -signkey backend-key.pem -out backend-cert.pem
```

입력 정보:
- Country Name: KR
- State: Seoul
- Locality: Seoul
- Organization Name: Your Company
- Common Name: **Kiosk-backend-env.eba-32jx2nbm.ap-northeast-2.elasticbeanstalk.com**
- Email: your-email@example.com

#### ACM 인증서 사용 (권장 - 무료)

ACM에서 무료 SSL 인증서 발급:

1. ACM Console: https://console.aws.amazon.com/acm/home?region=ap-northeast-2
2. "Request certificate" 클릭
3. "Request a public certificate" 선택
4. Domain name: `*.ap-northeast-2.elasticbeanstalk.com`
   - 또는 정확한 도메인: `kiosk-backend-env.eba-32jx2nbm.ap-northeast-2.elasticbeanstalk.com`
5. Validation method: DNS validation
6. Request 클릭
7. DNS 레코드 추가하여 도메인 소유권 검증

**문제점**: Elastic Beanstalk 도메인은 AWS 소유이므로 ACM 검증이 불가능합니다!

#### 해결책: 자체 도메인이 없으면 자체 서명 인증서 사용

자체 서명 인증서를 사용하면:
- ⚠️ 브라우저에서 "안전하지 않음" 경고 표시
- ✅ HTTPS는 작동함 (암호화됨)
- 테스트 및 개발용으로 적합

## 6. 자체 서명 인증서 업로드

### IAM Console에서 인증서 업로드

```bash
# AWS CLI로 인증서 업로드
aws iam upload-server-certificate \
  --server-certificate-name kiosk-backend-cert \
  --certificate-body file://C:/claudtest/backend-cert.pem \
  --private-key file://C:/claudtest/backend-key.pem \
  --region us-east-1
```

### Elastic Beanstalk에서 선택

Load balancer 설정에서:
- SSL certificate: "kiosk-backend-cert" 선택

## 7. Apply 클릭

설정 적용 (5-10분 소요)

---

## 8. Frontend 코드 업데이트

Backend URL을 HTTPS로 변경:

**변경 전:**
```javascript
http://Kiosk-backend-env.eba-32jx2nbm.ap-northeast-2.elasticbeanstalk.com/api
```

**변경 후:**
```javascript
https://Kiosk-backend-env.eba-32jx2nbm.ap-northeast-2.elasticbeanstalk.com/api
```

모든 서비스 파일 업데이트:
- api.js
- authService.js
- userService.js
- storeHistoryService.js
- historyService.js

## 9. 재배포

Frontend 빌드 & S3 업로드

---

## ⚠️ 제한사항

1. **자체 서명 인증서 경고**
   - 브라우저에서 "이 연결은 비공개 연결이 아닙니다" 경고
   - "고급" → "안전하지 않음(계속)" 클릭 필요

2. **Frontend는 여전히 HTTP**
   - 완전한 HTTPS는 CloudFront 검증 후 가능

---

## 완전한 HTTPS 솔루션

CloudFront 계정 검증 후:
1. Frontend CloudFront: HTTPS
2. Backend CloudFront: HTTPS
3. 자체 서명 인증서 불필요 (CloudFront가 제공)
4. 경고 메시지 없음
