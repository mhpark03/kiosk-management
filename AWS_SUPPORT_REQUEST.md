# AWS Support 계정 검증 요청 가이드

## 1. AWS Support 센터 접속

https://console.aws.amazon.com/support/home

## 2. "Create case" 클릭

## 3. Case 정보 입력

### Service limit increase
- **Limit type**: CloudFront Distributions
- **Region**: Global

### Request 1
- **Limit**: Number of distributions
- **New limit value**: 10 (기본값보다 높게 요청하지 않아도 됨)

### Use case description (한글 또는 영문)

**한글:**
```
안녕하세요,

CloudFront distribution을 생성하려고 하는데 다음과 같은 오류가 발생합니다:

"Your account must be verified before you can add new CloudFront resources."

Kiosk 관리 웹 애플리케이션을 AWS에 배포하고 있으며,
HTTPS 적용을 위해 CloudFront가 필요합니다.

계정 검증을 요청드립니다.

감사합니다.
```

**영문:**
```
Hello,

I'm trying to create a CloudFront distribution but receiving the following error:

"Your account must be verified before you can add new CloudFront resources."

I'm deploying a Kiosk management web application on AWS and need CloudFront
to enable HTTPS for both frontend (S3) and backend (Elastic Beanstalk).

Please verify my account for CloudFront usage.

Thank you.
```

## 4. Contact options
- **Preferred contact language**: Korean (또는 English)
- **Contact method**: Web (이메일로 답변 받기)

## 5. Submit

보통 **몇 시간에서 1-2일** 내에 검증이 완료됩니다.

---

## 검증 완료 후

검증이 완료되면 제가 다시 CloudFront 설정을 도와드리겠습니다!
