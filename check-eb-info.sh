#!/bin/bash

echo "============================================"
echo "Elastic Beanstalk 정보 확인"
echo "============================================"
echo ""

echo "1. 애플리케이션 목록:"
echo "-------------------------------------------"
aws elasticbeanstalk describe-applications --region ap-northeast-2 --query 'Applications[*].[ApplicationName]' --output table

echo ""
echo "2. 환경 정보:"
echo "-------------------------------------------"
aws elasticbeanstalk describe-environments --region ap-northeast-2 --query 'Environments[*].[ApplicationName,EnvironmentName,CNAME,Status]' --output table

echo ""
echo "3. S3 버킷 (elasticbeanstalk로 시작):"
echo "-------------------------------------------"
aws s3 ls | grep elasticbeanstalk

echo ""
echo "============================================"
echo "GitHub Secrets 설정값 (복사해서 사용):"
echo "============================================"

# Application Name 추출
APP_NAME=$(aws elasticbeanstalk describe-applications --region ap-northeast-2 --query 'Applications[0].ApplicationName' --output text)
echo "EB_APPLICATION_NAME=$APP_NAME"

# Environment Name 추출
ENV_NAME=$(aws elasticbeanstalk describe-environments --region ap-northeast-2 --query 'Environments[0].EnvironmentName' --output text)
echo "EB_ENVIRONMENT_NAME=$ENV_NAME"

# Environment URL 추출
ENV_URL=$(aws elasticbeanstalk describe-environments --region ap-northeast-2 --query 'Environments[0].CNAME' --output text)
echo "EB_ENVIRONMENT_URL=$ENV_URL"

# S3 Bucket 추출
S3_BUCKET=$(aws s3 ls | grep elasticbeanstalk | grep ap-northeast-2 | awk '{print $3}')
echo "EB_S3_BUCKET=$S3_BUCKET"

echo ""
echo "============================================"
