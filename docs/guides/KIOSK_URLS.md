# 🔗 Kiosk 시스템 URL 정리

## 📱 애플리케이션 접속

### Frontend (사용자 접속)
```
http://kiosk-frontend-20251018.s3-website.ap-northeast-2.amazonaws.com
```

**간단 링크**: 브라우저 북마크에 "Kiosk 관리" 이름으로 저장하세요

---

## 🔧 개발자용 URL

### Backend API 베이스 URL
```
http://Kiosk-backend-env.eba-32jx2nbm.ap-northeast-2.elasticbeanstalk.com/api
```

### Health Check
```
http://Kiosk-backend-env.eba-32jx2nbm.ap-northeast-2.elasticbeanstalk.com/api/actuator/health
```

---

## 🌐 AWS 관리 콘솔

### S3 (Frontend)
```
https://s3.console.aws.amazon.com/s3/buckets/kiosk-frontend-20251018?region=ap-northeast-2
```

### Elastic Beanstalk (Backend)
```
https://ap-northeast-2.console.aws.amazon.com/elasticbeanstalk/home?region=ap-northeast-2#/environment/dashboard?environmentId=e-pzcysqmfxy
```

---

## 📋 빠른 접속 방법

### Windows에서 빠른 접속
아래 배치 파일을 더블클릭하면 브라우저에서 자동으로 열립니다:
```
C:\claudtest\open-kiosk.bat
```

### 모바일에서 접속
위의 Frontend URL을 모바일 브라우저 홈 화면에 추가하세요.
