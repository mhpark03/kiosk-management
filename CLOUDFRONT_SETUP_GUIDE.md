# CloudFront HTTPS 설정 가이드

## Frontend CloudFront 설정

### 1. AWS Console에 로그인
https://console.aws.amazon.com/cloudfront/

### 2. Create Distribution 클릭

### 3. Origin 설정
- **Origin domain**: `kiosk-frontend-20251018.s3-website.ap-northeast-2.amazonaws.com` (직접 입력)
- **Protocol**: HTTP only
- **Name**: 자동 생성됨 (그대로 사용)

### 4. Default cache behavior
- **Viewer protocol policy**: Redirect HTTP to HTTPS
- **Allowed HTTP methods**: GET, HEAD
- **Cache policy**: CachingDisabled (드롭다운에서 선택)

### 5. Settings
- **Price class**: Use all edge locations (best performance)
- **Alternate domain name (CNAME)**: 비워두기 (없으면 CloudFront 기본 도메인 사용)
- **Custom SSL certificate**: 선택 안함 (기본 CloudFront 인증서 사용)

### 6. Default root object
- **Default root object**: `index.html`

### 7. Create Distribution 클릭

### 8. Error Pages 설정 (SPA를 위한 중요 설정!)

Distribution이 생성되는 동안 (Status가 "Deploying"일 때도 가능):

1. Distribution 선택
2. **Error pages** 탭 클릭
3. **Create custom error response** 클릭

**첫 번째 에러 페이지:**
- HTTP error code: 403 (Forbidden)
- Customize error response: Yes
- Response page path: `/index.html`
- HTTP response code: 200 (OK)
- Error caching minimum TTL: 0

**두 번째 에러 페이지:**
- HTTP error code: 404 (Not Found)
- Customize error response: Yes
- Response page path: `/index.html`
- HTTP response code: 200 (OK)
- Error caching minimum TTL: 0

### 9. 배포 완료 대기 (15-20분 소요)

Status가 "Deployed"로 변경될 때까지 기다립니다.

### 10. CloudFront URL 확인

- Distribution details에서 **Distribution domain name** 복사
- 예: `d111111abcdef8.cloudfront.net`
- HTTPS URL: `https://d111111abcdef8.cloudfront.net`

---

## Backend CloudFront 설정 (Mixed Content 방지)

Frontend가 HTTPS면 Backend API도 HTTPS여야 합니다!

### 1. Create Distribution 다시 클릭

### 2. Origin 설정
- **Origin domain**: `Kiosk-backend-env.eba-32jx2nbm.ap-northeast-2.elasticbeanstalk.com` (직접 입력)
- **Protocol**: HTTP only
- **Name**: 자동 생성됨

### 3. Default cache behavior (중요!)
- **Viewer protocol policy**: Redirect HTTP to HTTPS
- **Allowed HTTP methods**: GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE (모두 선택)
- **Cache policy**: CachingDisabled (API는 캐싱하지 않음!)
- **Origin request policy**: AllViewer

### 4. Settings
- **Price class**: Use all edge locations
- **Alternate domain name (CNAME)**: 비워두기
- **Custom SSL certificate**: 선택 안함

### 5. Default root object
- 비워두기 (API에는 필요없음)

### 6. Create Distribution 클릭

### 7. 배포 완료 대기 (15-20분 소요)

### 8. Backend CloudFront URL 확인
- 예: `d222222abcdef8.cloudfront.net`
- HTTPS API URL: `https://d222222abcdef8.cloudfront.net/api`

---

## 다음 단계

CloudFront 배포가 완료되면:

1. **Frontend 코드 업데이트**
   - 모든 서비스 파일에서 Backend URL을 CloudFront HTTPS URL로 변경

2. **Backend CORS 설정 업데이트**
   - Frontend CloudFront URL을 CORS 허용 목록에 추가

3. **재배포**
   - Frontend 빌드 & S3 업로드

4. **테스트**
   - `https://[frontend-cloudfront-url]` 접속
   - HTTPS로 정상 작동 확인

---

## 문제 해결

### "Your account must be verified" 에러가 Console에서도 발생하는 경우:

1. AWS Support에 연락: https://console.aws.amazon.com/support/home
2. "Service limit increase" 요청
3. Service: CloudFront
4. 계정 검증 요청

보통 몇 시간 내에 처리됩니다.
