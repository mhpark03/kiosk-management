import { useState } from 'react';
import { generateVideo, downloadVideo } from '../services/runwayService';
import './VideoGenerator.css';

function VideoGenerator() {
  const [image1, setImage1] = useState(null);
  const [image2, setImage2] = useState(null);
  const [image1Preview, setImage1Preview] = useState(null);
  const [image2Preview, setImage2Preview] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState('gen3a_turbo');
  const [duration, setDuration] = useState(5);
  const [resolution, setResolution] = useState('1280:768');
  const [loading, setLoading] = useState(false);
  const [generatedVideo, setGeneratedVideo] = useState(null);
  const [error, setError] = useState('');

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

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      if (imageNumber === 1) {
        setImage1(file);
        setImage1Preview(reader.result);
      } else {
        setImage2(file);
        setImage2Preview(reader.result);
      }
      setError('');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = (imageNumber) => {
    if (imageNumber === 1) {
      setImage1(null);
      setImage1Preview(null);
    } else {
      setImage2(null);
      setImage2Preview(null);
    }
  };

  const handleGenerateVideo = async () => {
    // Validation
    if (!image1 || !image2) {
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

      // Call Runway ML API
      const result = await generateVideo(image1, image2, prompt, duration, model, resolution);

      if (result.success) {
        setGeneratedVideo({
          url: result.videoUrl,
          status: 'completed',
          metadata: result.metadata
        });
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
              {!image1Preview ? (
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
                <div className="image-preview">
                  <img src={image1Preview} alt="Image 1 preview" />
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
              {!image2Preview ? (
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
                <div className="image-preview">
                  <img src={image2Preview} alt="Image 2 preview" />
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

        {/* Model Selection Section */}
        <div className="model-section">
          <h2>AI 모델</h2>
          <div className="model-control">
            <select
              value={model}
              onChange={(e) => handleModelChange(e.target.value)}
              disabled={loading}
              className="model-select"
            >
              {Object.keys(modelConfig).map(modelKey => (
                <option key={modelKey} value={modelKey}>
                  {modelConfig[modelKey].name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Duration Section */}
        <div className="duration-section">
          <h2>동영상 길이</h2>
          <div className="duration-control">
            <select
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value))}
              disabled={loading}
              className="duration-select"
            >
              {modelConfig[model].durations.map(d => (
                <option key={d} value={d}>{d}초</option>
              ))}
            </select>
          </div>
        </div>

        {/* Resolution Section */}
        <div className="resolution-section">
          <h2>해상도</h2>
          <div className="resolution-control">
            <select
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              disabled={loading}
              className="resolution-select"
            >
              {modelConfig[model].resolutions.map(res => (
                <option key={res} value={res}>
                  {res.replace(':', ' x ')}
                </option>
              ))}
            </select>
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
              <div className="video-actions">
                <a
                  href={generatedVideo.url}
                  download="generated-video.mp4"
                  className="download-btn"
                >
                  다운로드
                </a>
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
    </div>
  );
}

export default VideoGenerator;
