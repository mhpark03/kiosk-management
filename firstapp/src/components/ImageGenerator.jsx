import { useState } from 'react';
import { generateImage, downloadImage } from '../services/imageService';
import './ImageGenerator.css';

function ImageGenerator() {
  const [images, setImages] = useState([null, null, null, null, null]);
  const [imagePreviews, setImagePreviews] = useState([null, null, null, null, null]);
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('realistic');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [loading, setLoading] = useState(false);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [error, setError] = useState('');

  const MAX_IMAGES = 5;

  // Style options
  const styleOptions = [
    { value: 'realistic', label: '사실적' },
    { value: 'anime', label: '애니메이션' },
    { value: 'artistic', label: '예술적' },
    { value: 'photograph', label: '사진' },
    { value: 'illustration', label: '일러스트' }
  ];

  // Aspect ratio options
  const aspectRatioOptions = [
    { value: '1:1', label: '정사각형 (1:1)' },
    { value: '16:9', label: '가로 (16:9)' },
    { value: '9:16', label: '세로 (9:16)' },
    { value: '4:3', label: '가로 (4:3)' },
    { value: '3:4', label: '세로 (3:4)' }
  ];

  const handleImageUpload = (e, index) => {
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
      const newImages = [...images];
      const newPreviews = [...imagePreviews];
      newImages[index] = file;
      newPreviews[index] = reader.result;
      setImages(newImages);
      setImagePreviews(newPreviews);
      setError('');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = (index) => {
    const newImages = [...images];
    const newPreviews = [...imagePreviews];
    newImages[index] = null;
    newPreviews[index] = null;
    setImages(newImages);
    setImagePreviews(newPreviews);
  };

  const getUploadedImageCount = () => {
    return images.filter(img => img !== null).length;
  };

  const handleGenerateImage = async () => {
    // Validation
    const uploadedCount = getUploadedImageCount();
    if (uploadedCount === 0) {
      setError('최소 1개의 이미지를 업로드해주세요.');
      return;
    }

    if (!prompt.trim()) {
      setError('프롬프트를 입력해주세요.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setGeneratedImage(null);

      // Call AI image generation API
      const result = await generateImage(images, prompt, style, aspectRatio);

      if (result.success) {
        setGeneratedImage({
          url: result.imageUrl,
          status: 'completed',
          metadata: result.metadata
        });
        console.log('Image generated successfully:', result);
      } else {
        throw new Error('이미지 생성에 실패했습니다.');
      }

    } catch (err) {
      console.error('Image generation error:', err);
      setError(err.message || '이미지 생성 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="image-generator-container">
      <div className="image-generator-card">
        <h1>AI 이미지 생성기</h1>
        <p className="subtitle">최대 5개의 참조 이미지로 새로운 이미지 생성</p>

        {error && <div className="error-message">{error}</div>}

        {/* Image Upload Section */}
        <div className="upload-section">
          <h2>참조 이미지 업로드 ({getUploadedImageCount()}/{MAX_IMAGES})</h2>
          <div className="image-grid">
            {images.map((image, index) => (
              <div key={index} className="image-upload-slot">
                {!imagePreviews[index] ? (
                  <label className="upload-label">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e, index)}
                      style={{ display: 'none' }}
                    />
                    <div className="upload-placeholder">
                      <span className="upload-icon">📁</span>
                      <span className="upload-number">{index + 1}</span>
                      <span className="upload-hint">이미지 선택</span>
                    </div>
                  </label>
                ) : (
                  <div className="image-preview">
                    <img src={imagePreviews[index]} alt={`Preview ${index + 1}`} />
                    <button
                      className="remove-btn"
                      onClick={() => handleRemoveImage(index)}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Prompt Section */}
        <div className="prompt-section">
          <h2>프롬프트</h2>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="생성하고 싶은 이미지에 대해 자세히 설명하세요. 예: 해질녘 바다가 보이는 평화로운 풍경, 따뜻한 색감..."
            rows="4"
            disabled={loading}
          />
        </div>

        {/* Image Settings Section */}
        <div className="image-settings-section">
          <h2>이미지 설정</h2>
          <div className="settings-row">
            {/* Style Selection */}
            <div className="setting-item">
              <label>스타일</label>
              <select
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                disabled={loading}
                className="setting-select"
              >
                {styleOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Aspect Ratio Selection */}
            <div className="setting-item">
              <label>비율</label>
              <select
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value)}
                disabled={loading}
                className="setting-select"
              >
                {aspectRatioOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Generate Button */}
        <button
          className="generate-btn"
          onClick={handleGenerateImage}
          disabled={loading || getUploadedImageCount() === 0 || !prompt.trim()}
        >
          {loading ? '이미지 생성 중...' : '이미지 생성'}
        </button>

        {/* Generated Image Section */}
        {generatedImage && (
          <div className="generated-image-section">
            <h2>생성된 이미지</h2>
            <div className="image-result">
              <img src={generatedImage.url} alt="Generated" />
              <div className="image-actions">
                <a
                  href={generatedImage.url}
                  download="generated-image.png"
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
            <p>AI가 이미지를 생성하는 중입니다...</p>
            <p className="loading-hint">잠시만 기다려주세요.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ImageGenerator;
