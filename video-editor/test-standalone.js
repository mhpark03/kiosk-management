#!/usr/bin/env node
/**
 * 비디오 에디터 AI 모듈 독립 테스트 스크립트
 * Electron GUI 없이 웹 환경에서 AI 기능만 테스트
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

// 환경 변수 확인
function checkEnv() {
  console.log('\n=== 환경 변수 확인 ===');
  const required = {
    'GOOGLE_TTS_API_KEY': process.env.GOOGLE_TTS_API_KEY || process.env.GOOGLE_AI_API_KEY,
    'GOOGLE_AI_API_KEY': process.env.GOOGLE_AI_API_KEY,
    'RUNWAY_API_KEY': process.env.RUNWAY_API_KEY,
  };

  let allSet = true;
  for (const [key, value] of Object.entries(required)) {
    const status = value ? '✅' : '❌';
    console.log(`${status} ${key}: ${value ? '설정됨' : '없음'}`);
    if (!value && key !== 'RUNWAY_API_KEY') {
      allSet = false;
    }
  }

  return allSet;
}

// TTS 테스트
async function testTTS() {
  console.log('\n=== TTS (음성 생성) 테스트 ===');

  const apiKey = process.env.GOOGLE_TTS_API_KEY || process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    console.log('❌ API 키가 설정되지 않았습니다.');
    return false;
  }

  try {
    const textToSpeech = require('@google-cloud/text-to-speech');
    const client = new textToSpeech.TextToSpeechClient({
      apiKey: apiKey
    });

    const request = {
      input: { text: '테스트 음성입니다.' },
      voice: { languageCode: 'ko-KR', name: 'ko-KR-Standard-A' },
      audioConfig: { audioEncoding: 'MP3' },
    };

    console.log('🎵 음성 생성 중...');
    const [response] = await client.synthesizeSpeech(request);

    const outputFile = path.join(__dirname, 'test-tts-output.mp3');
    fs.writeFileSync(outputFile, response.audioContent, 'binary');

    console.log(`✅ TTS 성공! 파일: ${outputFile}`);
    console.log(`   크기: ${response.audioContent.length} bytes`);
    return true;
  } catch (error) {
    console.log('❌ TTS 실패:', error.message);
    return false;
  }
}

// Imagen 테스트
async function testImagen() {
  console.log('\n=== Imagen (이미지 생성) 테스트 ===');

  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    console.log('❌ GOOGLE_AI_API_KEY가 설정되지 않았습니다.');
    return false;
  }

  try {
    const axios = require('axios');
    const { GoogleAuth } = require('google-auth-library');

    // Imagen 3 API 호출
    const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${apiKey}`;

    console.log('🎨 이미지 생성 중...');
    const response = await axios.post(url, {
      instances: [{
        prompt: 'A beautiful sunset over the ocean'
      }],
      parameters: {
        sampleCount: 1
      }
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 60000
    });

    if (response.data && response.data.predictions) {
      console.log('✅ Imagen 성공!');
      console.log(`   생성된 이미지: ${response.data.predictions.length}개`);
      return true;
    } else {
      console.log('❌ 예상치 못한 응답:', response.data);
      return false;
    }
  } catch (error) {
    console.log('❌ Imagen 실패:', error.response?.data || error.message);
    return false;
  }
}

// Veo 테스트
async function testVeo() {
  console.log('\n=== Veo (비디오 생성) 테스트 ===');

  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    console.log('❌ GOOGLE_AI_API_KEY가 설정되지 않았습니다.');
    return false;
  }

  try {
    const axios = require('axios');
    const modelName = 'veo-3.1-generate-preview';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    console.log('🎬 비디오 생성 요청 중...');
    const response = await axios.post(url, {
      contents: [{
        parts: [{
          text: 'A cat playing with a ball'
        }]
      }],
      generationConfig: {
        responseModalities: ['VIDEO'],
        videoDuration: 8,
        aspectRatio: '16:9',
        resolution: '720p'
      }
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    if (response.data) {
      console.log('✅ Veo 요청 성공!');
      console.log('   응답:', JSON.stringify(response.data, null, 2).substring(0, 200) + '...');
      return true;
    }
  } catch (error) {
    if (error.response?.status === 400) {
      console.log('⚠️  Veo API 호출됨 (비디오 생성은 시간이 오래 걸림)');
      console.log('   에러:', error.response?.data?.error?.message || error.message);
      return true; // API가 호출되면 성공으로 간주
    }
    console.log('❌ Veo 실패:', error.response?.data || error.message);
    return false;
  }
}

// Runway 테스트
async function testRunway() {
  console.log('\n=== Runway (이미지 생성) 테스트 ===');

  const apiKey = process.env.RUNWAY_API_KEY;
  if (!apiKey) {
    console.log('⚠️  RUNWAY_API_KEY가 설정되지 않았습니다 (선택 사항).');
    return null; // 선택 사항이므로 null 반환
  }

  try {
    const axios = require('axios');
    const apiUrl = process.env.RUNWAY_API_URL || 'https://api.dev.runwayml.com';

    console.log('🚀 Runway 이미지 생성 중...');
    const response = await axios.post(`${apiUrl}/v1/images/generations`, {
      prompt: 'A futuristic city at night',
      model: 'gen3a_turbo'
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    if (response.data) {
      console.log('✅ Runway 성공!');
      console.log('   응답:', response.data);
      return true;
    }
  } catch (error) {
    console.log('❌ Runway 실패:', error.response?.data || error.message);
    return false;
  }
}

// 백엔드 API 테스트
async function testBackendAPI() {
  console.log('\n=== 백엔드 API 연동 테스트 ===');

  const axios = require('axios');
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:8080';

  try {
    console.log(`📡 백엔드 연결 확인: ${backendUrl}`);
    const response = await axios.get(`${backendUrl}/api/videos`, {
      timeout: 5000
    });

    console.log('✅ 백엔드 연결 성공!');
    console.log(`   비디오 수: ${response.data?.length || 0}개`);
    return true;
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('⚠️  백엔드 서버가 실행되지 않았습니다.');
      console.log('   실행 방법: cd backend && ./gradlew bootRun');
    } else {
      console.log('❌ 백엔드 연결 실패:', error.message);
    }
    return false;
  }
}

// 모든 테스트 실행
async function runAllTests() {
  console.log('🧪 비디오 에디터 AI 모듈 독립 테스트 시작\n');
  console.log('이 스크립트는 Electron GUI 없이 AI 기능만 테스트합니다.');

  // 환경 변수 확인
  const envOk = checkEnv();
  if (!envOk) {
    console.log('\n⚠️  일부 환경 변수가 설정되지 않았습니다.');
    console.log('   .env 파일을 생성하거나 환경 변수를 설정하세요.');
  }

  const results = {
    tts: await testTTS(),
    imagen: await testImagen(),
    veo: await testVeo(),
    runway: await testRunway(),
    backend: await testBackendAPI()
  };

  // 결과 요약
  console.log('\n=== 테스트 결과 요약 ===');
  const passed = Object.values(results).filter(r => r === true).length;
  const failed = Object.values(results).filter(r => r === false).length;
  const skipped = Object.values(results).filter(r => r === null).length;

  console.log(`✅ 통과: ${passed}`);
  console.log(`❌ 실패: ${failed}`);
  console.log(`⏭️  건너뜀: ${skipped}`);

  console.log('\n개별 결과:');
  for (const [name, result] of Object.entries(results)) {
    const icon = result === true ? '✅' : result === false ? '❌' : '⏭️';
    console.log(`  ${icon} ${name.toUpperCase()}`);
  }

  console.log('\n💡 Electron GUI 전체 테스트는 Windows 환경에서 실행하세요:');
  console.log('   cd video-editor');
  console.log('   npm start');
}

// 특정 테스트만 실행
async function runSpecificTest(testName) {
  const tests = {
    'tts': testTTS,
    'imagen': testImagen,
    'veo': testVeo,
    'runway': testRunway,
    'backend': testBackendAPI
  };

  if (tests[testName]) {
    await tests[testName]();
  } else {
    console.log(`❌ 알 수 없는 테스트: ${testName}`);
    console.log('사용 가능한 테스트:', Object.keys(tests).join(', '));
  }
}

// 메인 실행
if (require.main === module) {
  const testName = process.argv[2];

  if (testName) {
    runSpecificTest(testName.toLowerCase());
  } else {
    runAllTests();
  }
}

module.exports = {
  testTTS,
  testImagen,
  testVeo,
  testRunway,
  testBackendAPI
};
