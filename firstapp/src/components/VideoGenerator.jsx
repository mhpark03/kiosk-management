import { useState } from 'react';
import { generateVideo, downloadVideo, saveGeneratedVideoToBackend } from '../services/runwayService';
import S3ImageSelector from './S3ImageSelector';
import './VideoGenerator.css';

function VideoGenerator() {
  // Image data structure: {source: 'local'|'s3', file: File|null, url: string|null, preview: string|null}
  const [image1, setImage1] = useState({source: 'local', file: null, url: null, preview: null});
  const [image2, setImage2] = useState({source: 'local', file: null, url: null, preview: null});
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState('veo3.1_fast');
  const [duration, setDuration] = useState(4);
  const [resolution, setResolution] = useState('1280:720');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatedVideo, setGeneratedVideo] = useState(null);
  const [error, setError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [s3SelectorOpen, setS3SelectorOpen] = useState(false);
  const [currentSlot, setCurrentSlot] = useState(null);

  // Video metadata for saving
  const [videoTitle, setVideoTitle] = useState('');
  const [videoDescription, setVideoDescription] = useState('');

  // Model configurations
  const modelConfig = {
    'gen3a_turbo': {
      name: 'Gen-3 Alpha Turbo',
      durations: [5, 10],
      resolutions: ['1280:768', '768:1280']
    },
    'gen4_turbo': {
      name: 'Gen-4 Turbo',
      durations: [2, 3, 4, 5, 6, 7, 8, 9, 10],
      resolutions: ['1280:720', '720:1280', '1104:832', '832:1104', '960:960', '1584:672']
    },
    'veo3': {
      name: 'Veo 3',
      durations: [8],
      resolutions: ['1280:720', '720:1280', '1080:1920', '1920:1080']
    },
    'veo3.1': {
      name: 'Veo 3.1',
      durations: [4, 6, 8],
      resolutions: ['1280:720', '720:1280', '1080:1920', '1920:1080']
    },
    'veo3.1_fast': {
      name: 'Veo 3.1 Fast',
      durations: [4, 6, 8],
      resolutions: ['1280:720', '720:1280', '1080:1920', '1920:1080']
    }
  };

  // Update duration and resolution when model changes
  const handleModelChange = (newModel) => {
    setModel(newModel);
    const config = modelConfig[newModel];
    setDuration(config.durations[0]);
    setResolution(config.resolutions[0]);
  };

  const adjustImageAspectRatio = (imgSrc) => {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        const aspectRatio = image.width / image.height;

        // Runway ML API requires aspect ratio between 0.5 and 2.0
        if (aspectRatio >= 0.5 && aspectRatio <= 2.0) {
          // Already within acceptable range
          resolve(imgSrc);
          return;
        }

        // Need to add padding to fit within acceptable range
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        let canvasWidth, canvasHeight, drawX, drawY, drawWidth, drawHeight;

        if (aspectRatio < 0.5) {
          // Too tall (narrow) - add padding on left and right to achieve ratio of 0.7
          const targetRatio = 0.7;
          canvasHeight = image.height;
          canvasWidth = canvasHeight * targetRatio;

          // Center the original image horizontally
          drawWidth = image.width;
          drawHeight = image.height;
          drawX = (canvasWidth - drawWidth) / 2;
          drawY = 0;
        } else {
          // Too wide - add padding on top and bottom to achieve ratio of 1.5
          const targetRatio = 1.5;
          canvasWidth = image.width;
          canvasHeight = canvasWidth / targetRatio;

          // Center the original image vertically
          drawWidth = image.width;
          drawHeight = image.height;
          drawX = 0;
          drawY = (canvasHeight - drawHeight) / 2;
        }

        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        // Fill background with black color
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        // Draw original image centered
        ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);

        // Convert canvas to data URL
        const adjustedImageUrl = canvas.toDataURL('image/png');

        console.log(`이미지 비율 자동 조정 (여백 추가): ${aspectRatio.toFixed(2)} → ${(canvasWidth / canvasHeight).toFixed(2)}`);
        resolve(adjustedImageUrl);
      };
      image.onerror = () => reject(new Error('이미지를 로드할 수 없습니다.'));
      image.src = imgSrc;
    });
  };

  const handleImageUpload = (e, imageNumber) => {
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

    // Create preview and auto-adjust aspect ratio if needed
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        // Auto-adjust aspect ratio to fit within 0.5~2.0 range
        const adjustedImageUrl = await adjustImageAspectRatio(reader.result);

        // Convert adjusted image back to File object
        const response = await fetch(adjustedImageUrl);
        const blob = await response.blob();
        const adjustedFile = new File([blob], file.name, { type: 'image/png' });

        const imageData = {
          source: 'local',
          file: adjustedFile,
          url: null,
          preview: adjustedImageUrl
        };

        if (imageNumber === 1) {
          setImage1(imageData);
        } else {
          setImage2(imageData);
        }
        setError('');
      } catch (err) {
        setError(err.message);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = (imageNumber) => {
    const emptyImage = {source: 'local', file: null, url: null, preview: null};
    if (imageNumber === 1) {
      setImage1(emptyImage);
    } else {
      setImage2(emptyImage);
    }
  };

  const handleSourceChange = (imageNumber, source) => {
    const emptyImage = {source: source, file: null, url: null, preview: null};
    if (imageNumber === 1) {
      setImage1(emptyImage);
    } else {
      setImage2(emptyImage);
    }
  };

  const handleOpenS3Selector = (imageNumber) => {
    setCurrentSlot(imageNumber);
    setS3SelectorOpen(true);
  };

  const handleS3ImageSelect = async (s3Image) => {
    if (currentSlot !== null) {
      try {
        // Auto-adjust aspect ratio of S3 image if needed
        const imageUrl = s3Image.thumbnailUrl || s3Image.s3Url;
        const adjustedImageUrl = await adjustImageAspectRatio(imageUrl);

        const imageData = {
          source: 's3',
          file: null,
          url: s3Image.s3Url,
          preview: adjustedImageUrl
        };

        if (currentSlot === 1) {
          setImage1(imageData);
        } else {
          setImage2(imageData);
        }
        setError('');
      } catch (err) {
        setError(err.message);
      }
    }
  };

  const handleGenerateVideo = async () => {
    // Validation
    if ((!image1.file && !image1.url) || (!image2.file && !image2.url)) {
      setError('2개의 이미지를 모두 업로드해주세요.');
      return;
    }

    if (!prompt.trim()) {
      setError('프롬프트를 입력해주세요.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setGeneratedVideo(null);

      // Prepare image data - convert to format expected by generateVideo
      const image1Data = image1.source === 'local' ? image1.file : image1.url;
      const image2Data = image2.source === 'local' ? image2.file : image2.url;

      // Call Runway ML API
      const result = await generateVideo(image1Data, image2Data, prompt, duration, model, resolution);

      if (result.success) {
        setGeneratedVideo({
          url: result.videoUrl,
          taskId: result.taskId,
          status: 'completed',
          metadata: result.metadata
        });
        setSaveSuccess(false);
        // Set default title and description
        setVideoTitle(`Runway 생성 영상 - ${new Date().toLocaleString('ko-KR')}`);
        setVideoDescription(prompt);
        console.log('Video generated successfully:', result);
      } else {
        throw new Error('비디오 생성에 실패했습니다.');
      }

    } catch (err) {
      console.error('Video generation error:', err);
      setError(err.message || '동영상 생성 중 오류가 발생했습니다.');
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
        model,
        resolution,
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

  return (
    <div className="video-generator-container">
      <div className="video-generator-card">
        <h1>AI 동영상 생성기</h1>
        <p className="subtitle">Runway ML Gen-3를 사용하여 이미지로 동영상 생성</p>

        {error && <div className="error-message">{error}</div>}

        {/* Image Upload Section */}
        <div className="upload-section">
          <h2>이미지 업로드</h2>
          <div className="image-uploads">
            {/* Image 1 */}
            <div className="image-upload-box">
              <h3>시작 이미지</h3>
              {!image1.preview ? (
                <>
                  {/* Source selection buttons */}
                  <div className="source-selector">
                    <button
                      className={`source-btn ${image1.source === 'local' ? 'active' : ''}`}
                      onClick={() => handleSourceChange(1, 'local')}
                      disabled={loading}
                    >
                      PC
                    </button>
                    <button
                      className={`source-btn ${image1.source === 's3' ? 'active' : ''}`}
                      onClick={() => handleSourceChange(1, 's3')}
                      disabled={loading}
                    >
                      서버
                    </button>
                  </div>

                  {/* Upload interface based on selected source */}
                  {image1.source === 'local' ? (
                    <label className="upload-label">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageUpload(e, 1)}
                        style={{ display: 'none' }}
                      />
                      <div className="upload-placeholder">
                        <span className="upload-icon">📁</span>
                        <span>클릭하여 이미지 선택</span>
                        <span className="upload-hint">JPG, PNG (최대 10MB)</span>
                      </div>
                    </label>
                  ) : (
                    <button
                      className="s3-select-btn"
                      onClick={() => handleOpenS3Selector(1)}
                      disabled={loading}
                    >
                      <span className="upload-icon">🖼️</span>
                      <span>서버에서 이미지 선택</span>
                      <span className="upload-hint">저장된 이미지 선택</span>
                    </button>
                  )}
                </>
              ) : (
                <div className="image-preview">
                  <img src={image1.preview} alt="Image 1 preview" />
                  <div className="image-source-badge">{image1.source === 's3' ? '서버' : 'PC'}</div>
                  <button
                    className="remove-btn"
                    onClick={() => handleRemoveImage(1)}
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>

            {/* Image 2 */}
            <div className="image-upload-box">
              <h3>종료 이미지</h3>
              {!image2.preview ? (
                <>
                  {/* Source selection buttons */}
                  <div className="source-selector">
                    <button
                      className={`source-btn ${image2.source === 'local' ? 'active' : ''}`}
                      onClick={() => handleSourceChange(2, 'local')}
                      disabled={loading}
                    >
                      PC
                    </button>
                    <button
                      className={`source-btn ${image2.source === 's3' ? 'active' : ''}`}
                      onClick={() => handleSourceChange(2, 's3')}
                      disabled={loading}
                    >
                      서버
                    </button>
                  </div>

                  {/* Upload interface based on selected source */}
                  {image2.source === 'local' ? (
                    <label className="upload-label">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageUpload(e, 2)}
                        style={{ display: 'none' }}
                      />
                      <div className="upload-placeholder">
                        <span className="upload-icon">📁</span>
                        <span>클릭하여 이미지 선택</span>
                        <span className="upload-hint">JPG, PNG (최대 10MB)</span>
                      </div>
                    </label>
                  ) : (
                    <button
                      className="s3-select-btn"
                      onClick={() => handleOpenS3Selector(2)}
                      disabled={loading}
                    >
                      <span className="upload-icon">🖼️</span>
                      <span>서버에서 이미지 선택</span>
                      <span className="upload-hint">저장된 이미지 선택</span>
                    </button>
                  )}
                </>
              ) : (
                <div className="image-preview">
                  <img src={image2.preview} alt="Image 2 preview" />
                  <div className="image-source-badge">{image2.source === 's3' ? '서버' : 'PC'}</div>
                  <button
                    className="remove-btn"
                    onClick={() => handleRemoveImage(2)}
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Prompt Section */}
        <div className="prompt-section">
          <h2>프롬프트</h2>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="동영상에 대한 설명을 입력하세요. 예: 이미지 사이의 부드러운 전환, 카메라가 천천히 줌인..."
            rows="4"
            disabled={loading}
          />
        </div>

        {/* Video Settings Section */}
        <div className="video-settings-section">
          <h2>동영상 설정</h2>
          <div className="settings-row">
            {/* Model Selection */}
            <div className="setting-item">
              <label>AI 모델</label>
              <select
                value={model}
                onChange={(e) => handleModelChange(e.target.value)}
                disabled={loading}
                className="setting-select"
              >
                {Object.keys(modelConfig).map(modelKey => (
                  <option key={modelKey} value={modelKey}>
                    {modelConfig[modelKey].name}
                  </option>
                ))}
              </select>
            </div>

            {/* Duration Selection */}
            <div className="setting-item">
              <label>길이</label>
              <select
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value))}
                disabled={loading}
                className="setting-select"
              >
                {modelConfig[model].durations.map(d => (
                  <option key={d} value={d}>{d}초</option>
                ))}
              </select>
            </div>

            {/* Resolution Selection */}
            <div className="setting-item">
              <label>해상도</label>
              <select
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                disabled={loading}
                className="setting-select"
              >
                {modelConfig[model].resolutions.map(res => (
                  <option key={res} value={res}>
                    {res.replace(':', ' x ')}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Generate Button */}
        <button
          className="generate-btn"
          onClick={handleGenerateVideo}
          disabled={loading || !image1 || !image2 || !prompt.trim()}
        >
          {loading ? '동영상 생성 중...' : '동영상 생성'}
        </button>

        {/* Generated Video Section */}
        {generatedVideo && (
          <div className="generated-video-section">
            <h2>생성된 동영상</h2>
            <div className="video-preview">
              <video controls src={generatedVideo.url} />

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
                  href={generatedVideo.url}
                  download="generated-video.mp4"
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
            <p>AI가 동영상을 생성하는 중입니다...</p>
            <p className="loading-hint">이 작업은 몇 분 정도 걸릴 수 있습니다.</p>
          </div>
        )}
      </div>

      {/* S3 Image Selector Modal */}
      {s3SelectorOpen && (
        <S3ImageSelector
          onSelect={handleS3ImageSelect}
          onClose={() => setS3SelectorOpen(false)}
        />
      )}
    </div>
  );
}

export default VideoGenerator;
