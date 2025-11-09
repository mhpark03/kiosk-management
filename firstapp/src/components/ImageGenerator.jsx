import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateImage, downloadImage, saveGeneratedImageToBackend } from '../services/imageService';
import S3ImageSelector from './S3ImageSelector';
import './ImageGenerator.css';

function ImageGenerator() {
  const navigate = useNavigate();
  // Image data structure: {source: 'local'|'s3', file: File|null, url: string|null, preview: string|null}
  const [images, setImages] = useState([
    {source: 'local', file: null, url: null, preview: null},
    {source: 'local', file: null, url: null, preview: null},
    {source: 'local', file: null, url: null, preview: null},
    {source: 'local', file: null, url: null, preview: null},
    {source: 'local', file: null, url: null, preview: null}
  ]);
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('anime');
  const [aspectRatio, setAspectRatio] = useState('1920:1080');
  const [imagePurpose, setImagePurpose] = useState('GENERAL');
  const [loading, setLoading] = useState(false);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [error, setError] = useState('');
  const [s3SelectorOpen, setS3SelectorOpen] = useState(false);
  const [currentSlot, setCurrentSlot] = useState(null);

  const MAX_IMAGES = 5;

  // Style options
  const styleOptions = [
    { value: 'realistic', label: '사실적' },
    { value: 'anime', label: '애니메이션' },
    { value: 'artistic', label: '예술적' },
    { value: 'photograph', label: '사진' },
    { value: 'illustration', label: '일러스트' }
  ];

  // Aspect ratio options (Runway ML API supported resolutions)
  const aspectRatioOptions = [
    { value: '1024:1024', label: '정사각형 (1:1)' },
    { value: '1920:1080', label: '가로 (16:9)' },
    { value: '1080:1920', label: '세로 (9:16)' },
    { value: '1440:1080', label: '가로 (4:3)' },
    { value: '1080:1440', label: '세로 (3:4)' }
  ];

  // Image purpose options
  const imagePurposeOptions = [
    { value: 'GENERAL', label: '일반 이미지' },
    { value: 'REFERENCE', label: '참조 이미지' },
    { value: 'MENU', label: '메뉴 이미지' }
  ];

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

        const newImages = [...images];
        newImages[index] = {
          source: 'local',
          file: adjustedFile,
          url: null,
          preview: adjustedImageUrl
        };
        setImages(newImages);
        setError('');
      } catch (err) {
        setError(err.message);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = (index) => {
    const newImages = [...images];
    newImages[index] = {source: 'local', file: null, url: null, preview: null};
    setImages(newImages);
  };

  const handleSourceChange = (index, source) => {
    const newImages = [...images];
    newImages[index] = {source: source, file: null, url: null, preview: null};
    setImages(newImages);
  };

  const handleOpenS3Selector = (index) => {
    setCurrentSlot(index);
    setS3SelectorOpen(true);
  };

  const handleS3ImageSelect = async (s3Image) => {
    if (currentSlot !== null) {
      try {
        // Auto-adjust aspect ratio of S3 image if needed
        const imageUrl = s3Image.thumbnailUrl || s3Image.s3Url;
        const adjustedImageUrl = await adjustImageAspectRatio(imageUrl);

        const newImages = [...images];
        newImages[currentSlot] = {
          source: 's3',
          file: null,
          url: s3Image.s3Url,
          preview: adjustedImageUrl
        };
        setImages(newImages);
        setError('');
      } catch (err) {
        setError(err.message);
      }
    }
  };

  const getUploadedImageCount = () => {
    return images.filter(img => img.file !== null || img.url !== null).length;
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

      // Prepare image data - convert to format expected by generateImage
      // For local files: pass File objects
      // For S3 URLs: pass URL strings
      const imageData = images.map(img => {
        if (img.source === 'local' && img.file) {
          return img.file;
        } else if (img.source === 's3' && img.url) {
          return img.url;
        }
        return null;
      });

      // Call AI image generation API
      const result = await generateImage(imageData, prompt, style, aspectRatio);

      if (result.success) {
        setGeneratedImage({
          url: result.imageUrl,
          taskId: result.taskId,
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

  const handleSaveImage = async () => {
    if (!generatedImage) return;

    try {
      setLoading(true);
      setError('');

      // Default title and description
      const title = `AI 생성 이미지 - ${new Date().toLocaleString('ko-KR')}`;
      const description = generatedImage.metadata.prompt || '편집이 필요합니다';

      await saveGeneratedImageToBackend(
        generatedImage.url,
        title,
        description,
        generatedImage.taskId,
        generatedImage.metadata.aspectRatio,
        generatedImage.metadata.prompt,
        generatedImage.metadata.style,
        imagePurpose
      );

      alert('이미지가 성공적으로 저장되었습니다!');
    } catch (err) {
      console.error('Save image error:', err);
      setError(err.message || '이미지 저장 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="image-generator-container">
      <div className="image-generator-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
          <button
            onClick={() => navigate('/images')}
            style={{
              padding: '8px 16px',
              fontSize: '14px',
              border: '1px solid #cbd5e0',
              borderRadius: '6px',
              background: '#fff',
              color: '#2d3748',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              fontWeight: '500',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = '#f7fafc';
              e.currentTarget.style.borderColor = '#667eea';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = '#fff';
              e.currentTarget.style.borderColor = '#cbd5e0';
            }}
          >
            ← 목록으로
          </button>
          <div>
            <h1 style={{ margin: 0 }}>AI 이미지 생성기</h1>
            <p className="subtitle" style={{ margin: '5px 0 0 0' }}>최대 5개의 참조 이미지로 새로운 이미지 생성</p>
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}

        {/* Image Upload Section */}
        <div className="upload-section">
          <h2>참조 이미지 업로드 ({getUploadedImageCount()}/{MAX_IMAGES})</h2>
          <div className="image-grid">
            {images.map((image, index) => (
              <div key={index} className="image-upload-slot">
                {!image.preview ? (
                  <>
                    {/* Source selection buttons */}
                    <div className="source-selector">
                      <button
                        className={`source-btn ${image.source === 'local' ? 'active' : ''}`}
                        onClick={() => handleSourceChange(index, 'local')}
                        disabled={loading}
                      >
                        PC
                      </button>
                      <button
                        className={`source-btn ${image.source === 's3' ? 'active' : ''}`}
                        onClick={() => handleSourceChange(index, 's3')}
                        disabled={loading}
                      >
                        서버
                      </button>
                    </div>

                    {/* Upload interface based on selected source */}
                    {image.source === 'local' ? (
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
                      <button
                        className="s3-select-btn"
                        onClick={() => handleOpenS3Selector(index)}
                        disabled={loading}
                      >
                        <span className="upload-icon">🖼️</span>
                        <span className="upload-number">{index + 1}</span>
                        <span className="upload-hint">서버에서 선택</span>
                      </button>
                    )}
                  </>
                ) : (
                  <div className="image-preview">
                    <img src={image.preview} alt={`Preview ${index + 1}`} />
                    <div className="image-source-badge">{image.source === 's3' ? '서버' : 'PC'}</div>
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

            {/* Image Purpose Selection */}
            <div className="setting-item">
              <label>이미지 종류</label>
              <select
                value={imagePurpose}
                onChange={(e) => setImagePurpose(e.target.value)}
                disabled={loading}
                className="setting-select"
              >
                {imagePurposeOptions.map(option => (
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
                <button
                  onClick={handleSaveImage}
                  className="save-btn"
                  disabled={loading}
                >
                  S3에 저장
                </button>
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

      {/* S3 Image Selector Modal */}
      {s3SelectorOpen && (
        <S3ImageSelector
          onSelect={handleS3ImageSelect}
          onClose={() => setS3SelectorOpen(false)}
          purpose="REFERENCE"
        />
      )}
    </div>
  );
}

export default ImageGenerator;
