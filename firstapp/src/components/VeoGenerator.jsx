import { useState, useEffect } from 'react';
import {
  generateVideoFromPrompt,
  generateVideoWithFirstFrame,
  generateVideoWithInterpolation,
  downloadVideo,
  saveGeneratedVideoToBackend
} from '../services/veoService';
import './VideoGenerator.css';

function VeoGenerator() {
  // Generation mode: 'prompt', 'first-frame', 'interpolation'
  const [mode, setMode] = useState('first-frame');

  // Image state
  const [firstFrame, setFirstFrame] = useState({ file: null, preview: null });
  const [lastFrame, setLastFrame] = useState({ file: null, preview: null });

  // Form state
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatedVideo, setGeneratedVideo] = useState(null);
  const [videoBlobUrl, setVideoBlobUrl] = useState(null);
  const [error, setError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Video settings
  const [duration, setDuration] = useState('4');
  const [resolution, setResolution] = useState('720p');
  const [aspectRatio, setAspectRatio] = useState('16:9');

  // Video metadata for saving
  const [videoTitle, setVideoTitle] = useState('');
  const [videoDescription, setVideoDescription] = useState('');

  const handleImageUpload = (e, imageSlot) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('이미지 파일만 업로드 가능합니다.');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('이미지 크기는 10MB 이하여야 합니다.');
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      const imageData = {
        file: file,
        preview: reader.result
      };

      if (imageSlot === 'first') {
        setFirstFrame(imageData);
      } else {
        setLastFrame(imageData);
      }
      setError('');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = (imageSlot) => {
    const emptyImage = { file: null, preview: null };
    if (imageSlot === 'first') {
      setFirstFrame(emptyImage);
    } else {
      setLastFrame(emptyImage);
    }
  };

  const handleGenerateVideo = async () => {
    // Check if interpolation mode is selected
    if (mode === 'interpolation') {
      alert('이미지 보간(Interpolation) 기능은 Google Veo API에서 지원하지 않아 추후 지원 예정입니다.\n\n현재 사용 가능한 기능:\n- 텍스트만 (프롬프트)\n- 시작 이미지 + 프롬프트');
      return;
    }

    // Validation based on mode
    if (!prompt.trim()) {
      setError('프롬프트를 입력해주세요.');
      return;
    }

    if (mode === 'first-frame' && !firstFrame.file) {
      setError('시작 이미지를 업로드해주세요.');
      return;
    }

    if (mode === 'interpolation' && (!firstFrame.file || !lastFrame.file)) {
      setError('시작 이미지와 종료 이미지를 모두 업로드해주세요.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setGeneratedVideo(null);

      let result;

      if (mode === 'prompt') {
        result = await generateVideoFromPrompt(prompt, duration, resolution, aspectRatio);
      } else if (mode === 'first-frame') {
        result = await generateVideoWithFirstFrame(prompt, firstFrame.file, duration, resolution, aspectRatio);
      } else {
        result = await generateVideoWithInterpolation(prompt, firstFrame.file, lastFrame.file, duration, resolution, aspectRatio);
      }

      if (result.success) {
        setGeneratedVideo({
          url: result.videoUrl,
          taskId: result.taskId,
          status: 'completed',
          metadata: result.metadata
        });
        setSaveSuccess(false);
        // Set default title and description
        setVideoTitle(`Google Veo 생성 영상 - ${new Date().toLocaleString('ko-KR')}`);
        setVideoDescription(prompt);
        console.log('Video generated successfully:', result);

        // Use backend proxy URL for playback (handles authentication)
        const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';
        const proxyUrl = `${API_BASE_URL}/veo/proxy-video?url=${encodeURIComponent(result.videoUrl)}`;
        setVideoBlobUrl(proxyUrl);
        console.log('Using proxy URL for playback:', proxyUrl);

        // Success notification
        alert('✅ 비디오 생성 완료!\n\n생성된 비디오를 확인하고 S3에 저장할 수 있습니다.');
      } else {
        throw new Error(result.message || '❌ 비디오 생성에 실패했습니다.');
      }

    } catch (err) {
      console.error('Video generation error:', err);
      const errorMessage = err.message || '동영상 생성 중 오류가 발생했습니다.';
      alert(errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToBackend = async () => {
    if (!generatedVideo) return;

    if (!videoTitle.trim()) {
      setError('제목을 입력해주세요.');
      return;
    }

    if (!videoDescription.trim()) {
      setError('설명을 입력해주세요.');
      return;
    }

    try {
      setSaving(true);
      setError('');

      await saveGeneratedVideoToBackend(
        generatedVideo.url,
        videoTitle,
        videoDescription,
        generatedVideo.taskId,
        prompt
      );

      setSaveSuccess(true);
      alert('비디오가 성공적으로 저장되었습니다!');

    } catch (err) {
      console.error('Save video error:', err);
      setError(err.message || '비디오 저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleModeChange = (newMode) => {
    setMode(newMode);
    setError('');
  };

  // No cleanup needed for proxy URLs (unlike blob URLs)

  return (
    <div className="video-generator-container">
      <div className="video-generator-card">
        <h1>Google Veo 3.1 동영상 생성기</h1>
        <p className="subtitle">Google Veo 3.1을 사용하여 텍스트 또는 이미지로 동영상 생성</p>

        {error && <div className="error-message">{error}</div>}

        {/* Mode Selection */}
        <div className="video-settings-section">
          <h2>생성 모드</h2>
          <div className="settings-row">
            <div className="setting-item" style={{ flex: 1 }}>
              <select
                value={mode}
                onChange={(e) => handleModeChange(e.target.value)}
                disabled={loading}
                className="setting-select"
              >
                <option value="prompt">텍스트만 (프롬프트)</option>
                <option value="first-frame">시작 이미지 + 프롬프트</option>
                <option value="interpolation">시작/종료 이미지 보간</option>
              </select>
              <p style={{ fontSize: '13px', color: '#666', marginTop: '8px' }}>
                {mode === 'prompt' && '텍스트 프롬프트만으로 동영상 생성'}
                {mode === 'first-frame' && '시작 이미지를 기반으로 동영상 생성'}
                {mode === 'interpolation' && '시작/종료 이미지 사이를 자연스럽게 보간하여 동영상 생성'}
              </p>
            </div>
          </div>
        </div>

        {/* Video Settings */}
        <div className="video-settings-section">
          <h2>영상 설정</h2>
          <div className="settings-row">
            <div className="setting-item" style={{ flex: 1 }}>
              <label>영상 시간</label>
              <select
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                disabled={loading}
                className="setting-select"
              >
                <option value="4">4초</option>
                <option value="6">6초</option>
                <option value="8">8초</option>
              </select>
            </div>
            <div className="setting-item" style={{ flex: 1 }}>
              <label>해상도</label>
              <select
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                disabled={loading}
                className="setting-select"
              >
                <option value="720p">720p (HD)</option>
                <option value="1080p">1080p (Full HD)</option>
              </select>
            </div>
            <div className="setting-item" style={{ flex: 1 }}>
              <label>화면 비율</label>
              <select
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value)}
                disabled={loading}
                className="setting-select"
              >
                <option value="16:9">16:9 (가로)</option>
                <option value="9:16">9:16 (세로)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Image Upload Section (conditional based on mode) */}
        {mode !== 'prompt' && (
          <div className="upload-section">
            <h2>이미지 업로드</h2>
            <div className="image-uploads">
              {/* First Frame */}
              <div className="image-upload-box">
                <h3>시작 이미지</h3>
                {!firstFrame.preview ? (
                  <label className="upload-label">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e, 'first')}
                      style={{ display: 'none' }}
                    />
                    <div className="upload-placeholder">
                      <span className="upload-icon">📁</span>
                      <span>클릭하여 이미지 선택</span>
                      <span className="upload-hint">JPG, PNG (최대 10MB)</span>
                    </div>
                  </label>
                ) : (
                  <div className="image-preview">
                    <img src={firstFrame.preview} alt="First frame preview" />
                    <button
                      className="remove-btn"
                      onClick={() => handleRemoveImage('first')}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              {/* Last Frame (only for interpolation mode) */}
              {mode === 'interpolation' && (
                <div className="image-upload-box">
                  <h3>종료 이미지</h3>
                  {!lastFrame.preview ? (
                    <label className="upload-label">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageUpload(e, 'last')}
                        style={{ display: 'none' }}
                      />
                      <div className="upload-placeholder">
                        <span className="upload-icon">📁</span>
                        <span>클릭하여 이미지 선택</span>
                        <span className="upload-hint">JPG, PNG (최대 10MB)</span>
                      </div>
                    </label>
                  ) : (
                    <div className="image-preview">
                      <img src={lastFrame.preview} alt="Last frame preview" />
                      <button
                        className="remove-btn"
                        onClick={() => handleRemoveImage('last')}
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Prompt Section */}
        <div className="prompt-section">
          <h2>프롬프트</h2>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="동영상에 대한 설명을 입력하세요. 예: 고양이가 풀밭에서 뛰어노는 모습..."
            rows="4"
            disabled={loading}
          />
        </div>

        {/* Generate Button */}
        <button
          className="generate-btn"
          onClick={handleGenerateVideo}
          disabled={loading || !prompt.trim() ||
            (mode === 'first-frame' && !firstFrame.file) ||
            (mode === 'interpolation' && (!firstFrame.file || !lastFrame.file))}
        >
          {loading ? '동영상 생성 중...' : '동영상 생성'}
        </button>

        {/* Generated Video Section */}
        {generatedVideo && (
          <div className="generated-video-section">
            <h2>생성된 동영상</h2>
            <div className="video-preview">
              <video
                controls
                src={videoBlobUrl || generatedVideo.url}
                autoPlay
                style={{ maxHeight: '600px' }}
              >
                브라우저가 비디오 재생을 지원하지 않습니다.
              </video>

              {saveSuccess && (
                <div className="success-message">
                  ✓ 비디오가 S3에 저장되었습니다!
                </div>
              )}

              {/* Save to S3 Section */}
              {!saveSuccess && (
                <div className="save-section">
                  <h3>S3에 저장</h3>
                  <div className="form-group">
                    <label>제목</label>
                    <input
                      type="text"
                      value={videoTitle}
                      onChange={(e) => setVideoTitle(e.target.value)}
                      placeholder="영상 제목을 입력하세요"
                      disabled={saving}
                    />
                  </div>
                  <div className="form-group">
                    <label>설명</label>
                    <textarea
                      value={videoDescription}
                      onChange={(e) => setVideoDescription(e.target.value)}
                      placeholder="영상 설명을 입력하세요"
                      rows="3"
                      disabled={saving}
                    />
                  </div>
                </div>
              )}

              <div className="video-actions">
                <a
                  href={videoBlobUrl}
                  download="veo-generated-video.mp4"
                  className="download-btn"
                >
                  다운로드
                </a>
                {!saveSuccess && (
                  <button
                    className="save-btn"
                    onClick={handleSaveToBackend}
                    disabled={saving}
                  >
                    {saving ? 'S3에 저장 중...' : 'S3에 저장'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Loading Indicator */}
        {loading && (
          <div className="loading-overlay">
            <div className="loading-spinner"></div>
            <p>Google Veo가 동영상을 생성하는 중입니다...</p>
            <p className="loading-hint">이 작업은 몇 분 정도 걸릴 수 있습니다.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default VeoGenerator;
