/**
 * TTS (Text-to-Speech) Module
 * Handles Google TTS audio generation and S3 upload
 */

// Preview state management
let previewAudioElement = null;
let lastPreviewState = null; // Track last preview parameters and file path

/**
 * Update TTS character count display
 */
export function updateTtsCharCount() {
  const text = document.getElementById('tts-text')?.value || '';
  const charCount = document.getElementById('tts-char-count');
  if (charCount) {
    charCount.textContent = `${text.length} / 5000 자`;
  }
}

/**
 * Update TTS voice options based on selected language
 */
export function updateTtsVoiceOptions() {
  const language = document.getElementById('tts-language')?.value;
  const voiceSelect = document.getElementById('tts-voice');

  if (!voiceSelect) return;

  const voiceOptions = {
    'ko-KR': [
      { value: 'ko-KR-Neural2-A', label: 'Korean Female A (Neural2)' },
      { value: 'ko-KR-Neural2-B', label: 'Korean Female B (Neural2)' },
      { value: 'ko-KR-Neural2-C', label: 'Korean Male C (Neural2)' },
      { value: 'ko-KR-Standard-A', label: 'Korean Female A (Standard)' },
      { value: 'ko-KR-Standard-B', label: 'Korean Female B (Standard)' },
      { value: 'ko-KR-Standard-C', label: 'Korean Male C (Standard)' },
      { value: 'ko-KR-Standard-D', label: 'Korean Male D (Standard)' }
    ],
    'en-US': [
      { value: 'en-US-Neural2-A', label: 'English Female A (Neural2)' },
      { value: 'en-US-Neural2-C', label: 'English Female C (Neural2)' },
      { value: 'en-US-Neural2-D', label: 'English Male D (Neural2)' },
      { value: 'en-US-Standard-A', label: 'English Female A (Standard)' },
      { value: 'en-US-Standard-B', label: 'English Male B (Standard)' }
    ],
    'ja-JP': [
      { value: 'ja-JP-Neural2-B', label: 'Japanese Female B (Neural2)' },
      { value: 'ja-JP-Neural2-C', label: 'Japanese Male C (Neural2)' },
      { value: 'ja-JP-Standard-A', label: 'Japanese Female A (Standard)' },
      { value: 'ja-JP-Standard-B', label: 'Japanese Female B (Standard)' }
    ],
    'zh-CN': [
      { value: 'cmn-CN-Standard-A', label: 'Chinese Female A (Standard)' },
      { value: 'cmn-CN-Standard-B', label: 'Chinese Male B (Standard)' },
      { value: 'cmn-CN-Standard-C', label: 'Chinese Male C (Standard)' }
    ]
  };

  const options = voiceOptions[language] || voiceOptions['ko-KR'];
  voiceSelect.innerHTML = options.map(opt =>
    `<option value="${opt.value}">${opt.label}</option>`
  ).join('');
}

/**
 * Update TTS speed display
 */
export function updateTtsSpeedDisplay() {
  const speed = document.getElementById('tts-speed')?.value;
  const speedValue = document.getElementById('tts-speed-value');
  if (speedValue && speed) {
    speedValue.textContent = parseFloat(speed).toFixed(1);
  }
}

/**
 * Update TTS pitch display
 */
export function updateTtsPitchDisplay() {
  const pitch = document.getElementById('tts-pitch')?.value;
  const pitchValue = document.getElementById('tts-pitch-value');
  if (pitchValue && pitch) {
    const pitchNum = parseInt(pitch);
    pitchValue.textContent = pitchNum > 0 ? `+${pitchNum}` : pitchNum;
  }
}

/**
 * Determine gender from voice name
 * @param {string} voiceName - The voice name (e.g., 'ko-KR-Neural2-A')
 * @returns {string} - 'MALE' or 'FEMALE'
 */
function determineGender(voiceName) {
  const femaleSuffixes = ['-A', '-B', '-D'];
  const maleSuffixes = ['-C'];

  if (maleSuffixes.some(suffix => voiceName.endsWith(suffix))) {
    return 'MALE';
  } else if (femaleSuffixes.some(suffix => voiceName.endsWith(suffix))) {
    return 'FEMALE';
  }
  return 'FEMALE'; // default
}

/**
 * Execute TTS generation and save to local file
 */
export async function executeGenerateTTS() {
  // Get input values
  const text = document.getElementById('tts-text')?.value;
  const title = document.getElementById('tts-title')?.value;
  const description = document.getElementById('tts-description')?.value || '';
  const languageCode = document.getElementById('tts-language')?.value;
  const voiceName = document.getElementById('tts-voice')?.value;
  const speakingRate = parseFloat(document.getElementById('tts-speed')?.value || 1.0);
  const pitch = parseFloat(document.getElementById('tts-pitch')?.value || 0);

  // Validate inputs
  if (!text || !title) {
    alert('텍스트와 제목을 입력해주세요.');
    return;
  }

  if (text.length > 5000) {
    alert('텍스트는 최대 5000자까지 입력 가능합니다.');
    return;
  }

  try {
    // Ask user where to save the audio file
    const sanitizedTitle = title.replace(/[^a-zA-Z0-9가-힣]/g, '_');
    const defaultFilename = `${sanitizedTitle}.mp3`;

    const savePath = await window.electronAPI.selectOutput(defaultFilename);

    if (!savePath) {
      console.log('[TTS] User canceled save dialog');
      return;
    }

    if (typeof window.showProgress === 'function') window.showProgress();
    if (typeof window.updateProgress === 'function') {
      window.updateProgress(10, 'Google TTS API 호출 준비 중...');
    }
    if (typeof window.updateStatus === 'function') {
      window.updateStatus('TTS 음성 생성 중...');
    }

    console.log('[TTS] Starting direct Google TTS API call...');

    const gender = determineGender(voiceName);

    if (typeof window.updateProgress === 'function') {
      window.updateProgress(30, 'Google TTS API 호출 중...');
    }

    // Direct Google API call with save path (no backend dependency)
    const directResult = await window.electronAPI.generateTtsDirect({
      text,
      title,
      languageCode,
      voiceName,
      gender,
      speakingRate,
      pitch,
      savePath  // User-selected save path
    });

    if (!directResult.success) {
      throw new Error('Google TTS API call failed: ' + (directResult.error || 'Unknown error'));
    }

    if (typeof window.updateProgress === 'function') {
      window.updateProgress(80, '음성 생성 완료, 파일 저장 중...');
    }

    const audioResult = {
      title,
      voiceName,
      languageCode,
      speakingRate,
      pitch,
      audioPath: directResult.audioPath,
      filename: directResult.filename,
      fileSize: directResult.fileSize
    };

    console.log('[TTS] Direct API success:', audioResult);

    if (typeof window.updateProgress === 'function') {
      window.updateProgress(100, 'TTS 음성 생성 완료!');
    }

    // Show success message with audio details
    alert(
      `TTS 음성이 성공적으로 생성되었습니다!\n\n` +
      `제목: ${audioResult.title}\n` +
      `음성: ${audioResult.voiceName}\n` +
      `언어: ${audioResult.languageCode}\n` +
      `속도: ${audioResult.speakingRate}x\n` +
      `피치: ${audioResult.pitch}\n\n` +
      `저장 위치: ${audioResult.audioPath}\n` +
      `파일명: ${audioResult.filename}\n` +
      `파일 크기: ${(audioResult.fileSize / 1024).toFixed(2)} KB`
    );

    // Clear form
    const textField = document.getElementById('tts-text');
    const titleField = document.getElementById('tts-title');

    if (textField) textField.value = '';
    if (titleField) titleField.value = '';
    updateTtsCharCount();

    if (typeof window.updateStatus === 'function') {
      window.updateStatus('TTS 음성 생성 완료');
    }
    if (typeof window.hideProgress === 'function') window.hideProgress();
  } catch (error) {
    console.error('TTS 생성 실패:', error);
    if (typeof window.handleError === 'function') {
      window.handleError('TTS 음성 생성', error, 'TTS 음성 생성에 실패했습니다.');
    } else {
      alert('TTS 음성 생성에 실패했습니다.\n\n' + error.message);
    }
    if (typeof window.hideProgress === 'function') window.hideProgress();
  }
}

/**
 * Generate TTS and upload to S3 via backend
 * Requires authentication and backend connection
 */
export async function executeGenerateTTSAndUpload() {
  // Get input values
  const text = document.getElementById('tts-text')?.value;
  const title = document.getElementById('tts-title')?.value;
  const description = document.getElementById('tts-description')?.value || '';
  const languageCode = 'ko-KR'; // Always Korean as per requirement
  const voiceName = document.getElementById('tts-voice')?.value;
  const speakingRate = parseFloat(document.getElementById('tts-speed')?.value || 1.0);
  const pitch = parseFloat(document.getElementById('tts-pitch')?.value || 0);

  // Validate inputs
  if (!text || !title) {
    alert('텍스트와 제목을 입력해주세요.');
    return;
  }

  if (!description) {
    alert('설명을 입력해주세요.');
    return;
  }

  if (text.length > 5000) {
    alert('텍스트는 최대 5000자까지 입력 가능합니다.');
    return;
  }

  // Check authentication (requires auth module)
  const authToken = window.getAuthToken ? window.getAuthToken() : null;
  const currentUser = window.getCurrentUser ? window.getCurrentUser() : null;
  const backendBaseUrl = window.getBackendUrl ? window.getBackendUrl() : 'http://localhost:8080';

  if (!authToken || !currentUser) {
    alert('로그인이 필요합니다.\n먼저 로그인해주세요.');
    return;
  }

  try {
    if (typeof window.showProgress === 'function') window.showProgress();
    if (typeof window.updateStatus === 'function') {
      window.updateStatus('TTS 음성 업로드 준비 중...');
    }

    console.log('[TTS Upload] Starting Google TTS generation and S3 upload...');

    // Check if we can reuse preview file (same parameters)
    let audioPath, filename;
    let reusingPreview = false;

    if (lastPreviewState &&
        lastPreviewState.text === text &&
        lastPreviewState.languageCode === languageCode &&
        lastPreviewState.voiceName === voiceName &&
        lastPreviewState.speakingRate === speakingRate &&
        lastPreviewState.pitch === pitch) {

      // Reuse preview file
      console.log('[TTS Upload] Reusing preview file (parameters unchanged)');
      audioPath = lastPreviewState.audioPath;
      filename = lastPreviewState.filename;
      reusingPreview = true;
      if (typeof window.updateProgress === 'function') {
        window.updateProgress(60, '미리듣기 파일 재사용 중...');
      }

    } else {
      // Generate new TTS audio
      if (typeof window.updateProgress === 'function') {
        window.updateProgress(10, 'Google TTS API 호출 준비 중...');
      }
      console.log('[TTS Upload] Generating new TTS audio (parameters changed or no preview)');

      const gender = determineGender(voiceName);

      if (typeof window.updateProgress === 'function') {
        window.updateProgress(30, 'Google TTS API 호출 중...');
      }

      // Generate TTS audio to temporary file (no save path = temp file)
      const directResult = await window.electronAPI.generateTtsDirect({
        text,
        title,
        languageCode,
        voiceName,
        gender,
        speakingRate,
        pitch,
        savePath: null  // No save path = create temp file
      });

      if (!directResult.success) {
        throw new Error('Google TTS API call failed: ' + (directResult.error || 'Unknown error'));
      }

      console.log('[TTS Upload] TTS generation successful:', directResult);
      audioPath = directResult.audioPath;
      filename = directResult.filename;
      if (typeof window.updateProgress === 'function') {
        window.updateProgress(60, 'S3 업로드 준비 중...');
      }
    }

    // Read the generated file using fetch API (works with file:// protocol)
    const fileUrl = `file:///${audioPath.replace(/\\/g, '/')}`;
    const fileResponse = await fetch(fileUrl);
    const audioBlob = await fileResponse.blob();

    // Create FormData for multipart upload
    const formData = new FormData();
    formData.append('file', audioBlob, filename);
    formData.append('title', title);
    formData.append('description', description);
    formData.append('mediaType', 'AUDIO');  // Explicitly set media type

    if (typeof window.updateProgress === 'function') {
      window.updateProgress(70, 'S3에 업로드 중...');
    }

    // Upload to backend (AI-generated content endpoint)
    const uploadResponse = await fetch(`${backendBaseUrl}/api/ai/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`
      },
      body: formData
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`Upload failed: ${uploadResponse.status} ${errorText}`);
    }

    const uploadResult = await uploadResponse.json();
    console.log('[TTS Upload] Upload successful:', uploadResult);

    if (typeof window.updateProgress === 'function') {
      window.updateProgress(100, 'TTS 음성 생성 및 S3 저장 완료!');
    }

    // Show success message
    const successMessage = reusingPreview
      ? `TTS 음성이 성공적으로 S3에 저장되었습니다!\n(미리듣기 파일 재사용)\n\n`
      : `TTS 음성이 성공적으로 생성되고 S3에 저장되었습니다!\n\n`;

    alert(
      successMessage +
      `제목: ${title}\n` +
      `음성: ${voiceName}\n` +
      `설명: ${description || '(없음)'}\n` +
      `속도: ${speakingRate}x\n` +
      `피치: ${pitch}`
    );

    // Clear form
    const textField = document.getElementById('tts-text');
    const titleField = document.getElementById('tts-title');
    const descField = document.getElementById('tts-description');

    if (textField) textField.value = '';
    if (titleField) titleField.value = '';
    if (descField) descField.value = '';
    updateTtsCharCount();

    // Clear preview state after upload
    lastPreviewState = null;

    // Clean up temp file
    try {
      await window.electronAPI.deleteTempFile(audioPath);
      console.log('[TTS Upload] Temp file cleaned up');
    } catch (cleanupError) {
      console.warn('[TTS Upload] Failed to clean up temp file:', cleanupError);
    }

    if (typeof window.updateStatus === 'function') {
      window.updateStatus('TTS 음성 생성 및 S3 저장 완료');
    }
    if (typeof window.hideProgress === 'function') window.hideProgress();
  } catch (error) {
    console.error('[TTS Upload] Failed:', error);
    if (typeof window.handleError === 'function') {
      window.handleError('TTS 음성 생성 및 S3 업로드', error, 'TTS 음성 생성 및 S3 업로드에 실패했습니다.');
    } else {
      alert('TTS 음성 생성 및 S3 업로드에 실패했습니다.\n\n' + error.message);
    }
    if (typeof window.hideProgress === 'function') window.hideProgress();
  }
}

/**
 * Preview TTS audio before saving or uploading
 */
export async function previewTTS() {
  const text = document.getElementById('tts-text')?.value;
  const languageCode = document.getElementById('tts-language')?.value;
  const voiceName = document.getElementById('tts-voice')?.value;
  const speakingRate = parseFloat(document.getElementById('tts-speed')?.value || 1.0);
  const pitch = parseFloat(document.getElementById('tts-pitch')?.value || 0);

  // Validate inputs
  if (!text || text.trim().length === 0) {
    alert('텍스트를 입력해주세요.');
    return;
  }

  // Limit preview text length
  const previewText = text.length > 500 ? text.substring(0, 500) + '...' : text;

  if (text.length > 500) {
    console.log('[TTS Preview] Text truncated to 500 characters for preview');
  }

  try {
    console.log('[TTS Preview] Starting preview generation...');

    const gender = determineGender(voiceName);

    // Generate preview audio
    const result = await window.electronAPI.generateTtsDirect({
      text: previewText,
      title: 'preview',
      languageCode,
      voiceName,
      gender,
      speakingRate,
      pitch
    });

    if (!result.success) {
      throw new Error('Preview generation failed: ' + (result.error || 'Unknown error'));
    }

    console.log('[TTS Preview] Preview generated:', result.audioPath);

    // Store preview state for reuse
    lastPreviewState = {
      text,
      languageCode,
      voiceName,
      speakingRate,
      pitch,
      audioPath: result.audioPath,
      filename: result.filename
    };

    // Stop any existing preview
    if (previewAudioElement) {
      previewAudioElement.pause();
      previewAudioElement.src = '';
    }

    // Create and play audio element with file:// protocol
    const audioUrl = `file:///${result.audioPath.replace(/\\/g, '/')}`;
    console.log('[TTS Preview] Audio URL:', audioUrl);
    previewAudioElement = new Audio(audioUrl);

    previewAudioElement.onended = () => {
      console.log('[TTS Preview] Playback ended');
    };

    previewAudioElement.onerror = (error) => {
      console.error('[TTS Preview] Playback error:', error);
      alert('미리듣기 재생 중 오류가 발생했습니다.');
    };

    await previewAudioElement.play();
    console.log('[TTS Preview] Playing preview audio');

    alert('미리듣기 재생 중입니다.');

  } catch (error) {
    console.error('[TTS Preview] Preview failed:', error);
    alert('미리듣기 생성에 실패했습니다.\n\n' + error.message);
  }
}
