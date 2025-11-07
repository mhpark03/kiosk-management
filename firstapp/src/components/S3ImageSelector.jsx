import { useState, useEffect } from 'react';
import { videoService } from '../services/videoService';
import './S3ImageSelector.css';

function S3ImageSelector({ onSelect, onClose, purpose = null }) {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);

  useEffect(() => {
    loadImages();
  }, [purpose]);

  const loadImages = async () => {
    try {
      setLoading(true);
      setError('');
      // Pass purpose filter to API
      const data = await videoService.getAllImages(purpose);
      setImages(data);
    } catch (err) {
      console.error('Failed to load images:', err);
      setError('이미지를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = () => {
    if (selectedImage) {
      onSelect(selectedImage);
      onClose();
    }
  };

  return (
    <div className="s3-image-selector-overlay" onClick={onClose}>
      <div className="s3-image-selector-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>서버 이미지 선택</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {loading && <div className="loading">이미지 로딩 중...</div>}

          {error && <div className="error-message">{error}</div>}

          {!loading && !error && images.length === 0 && (
            <div className="empty-message">저장된 이미지가 없습니다.</div>
          )}

          {!loading && images.length > 0 && (
            <div className="image-grid">
              {images.map((image) => (
                <div
                  key={image.id}
                  className={`image-item ${selectedImage?.id === image.id ? 'selected' : ''}`}
                  onClick={() => setSelectedImage(image)}
                >
                  <img src={image.thumbnailUrl || image.s3Url} alt={image.title} />
                  <div className="image-info">
                    <div className="image-title">{image.title}</div>
                    <div className="image-meta">{image.videoType}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>취소</button>
          <button
            className="btn-select"
            onClick={handleSelect}
            disabled={!selectedImage}
          >
            선택
          </button>
        </div>
      </div>
    </div>
  );
}

export default S3ImageSelector;
