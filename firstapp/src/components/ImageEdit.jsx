import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import videoService from '../services/videoService';
import { FiArrowLeft, FiSave } from 'react-icons/fi';
import './VideoManagement.css';

export default function ImageEdit() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();

  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    loadImage();
  }, [id]);

  const loadImage = async () => {
    try {
      setLoading(true);
      const data = await videoService.getVideoById(id);
      setImage(data);
      setTitle(data.title || '');
      setDescription(data.description || '');
      setError('');
    } catch (err) {
      console.error('Failed to load image:', err);
      setError('이미지를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!title || title.trim().length === 0) {
      setError('제목을 입력해주세요.');
      setTimeout(() => setError(''), 3000);
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await videoService.updateImage(id, title, description);
      setSuccess('이미지 정보가 성공적으로 수정되었습니다.');
      setTimeout(() => {
        navigate('/images');
      }, 1500);
    } catch (err) {
      setError(err.message);
      setTimeout(() => setError(''), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    navigate('/images');
  };

  if (loading) {
    return <div className="loading">이미지 로딩 중...</div>;
  }

  if (!image) {
    return (
      <div className="store-management">
        <div className="alert alert-error">이미지를 찾을 수 없습니다.</div>
        <button onClick={handleCancel} className="btn-secondary">
          <FiArrowLeft style={{marginRight: '5px'}} />
          목록으로 돌아가기
        </button>
      </div>
    );
  }

  return (
    <div className="store-management">
      <div className="store-header">
        <h1>이미지 편집</h1>
        <div className="header-actions">
          <button onClick={handleCancel} className="btn-secondary">
            <FiArrowLeft style={{marginRight: '5px'}} />
            목록으로
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="store-table-container">
        <form onSubmit={handleSubmit} style={{padding: '30px', maxWidth: '800px', margin: '0 auto'}}>
          {/* Image Preview */}
          <div style={{marginBottom: '30px', padding: '20px', background: '#f7fafc', borderRadius: '8px'}}>
            <h3 style={{marginBottom: '15px', color: '#2d3748'}}>이미지 미리보기</h3>
            <img
              src={image.thumbnailUrl || image.s3Url}
              alt={image.title}
              style={{
                width: '100%',
                maxHeight: '400px',
                objectFit: 'contain',
                borderRadius: '8px',
                marginBottom: '15px'
              }}
            />
            <div style={{marginTop: '15px', fontSize: '14px', color: '#4a5568'}}>
              <p><strong>원본 파일명:</strong> {image.originalFilename || image.filename}</p>
              <p><strong>파일 크기:</strong> {(image.fileSize / 1024 / 1024).toFixed(2)} MB</p>
              {image.runwayPrompt && (
                <p><strong>생성 프롬프트:</strong> {image.runwayPrompt}</p>
              )}
              {image.imageStyle && (
                <p><strong>스타일:</strong> {image.imageStyle}</p>
              )}
            </div>
          </div>

          {/* Title */}
          <div style={{marginBottom: '25px'}}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontWeight: '600',
              color: '#2d3748',
              fontSize: '15px'
            }}>
              제목 *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={255}
              placeholder="이미지 제목을 입력하세요"
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #cbd5e0',
                borderRadius: '6px',
                fontSize: '14px',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#667eea'}
              onBlur={(e) => e.target.style.borderColor = '#cbd5e0'}
            />
            <div style={{marginTop: '5px', fontSize: '12px', color: '#718096'}}>
              {title.length} / 255
            </div>
          </div>

          {/* Description */}
          <div style={{marginBottom: '30px'}}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontWeight: '600',
              color: '#2d3748',
              fontSize: '15px'
            }}>
              설명
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="이미지에 대한 설명을 입력하세요 (선택사항)"
              rows={6}
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #cbd5e0',
                borderRadius: '6px',
                fontSize: '14px',
                resize: 'vertical',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#667eea'}
              onBlur={(e) => e.target.style.borderColor = '#cbd5e0'}
            />
          </div>

          {/* Action Buttons */}
          <div style={{display: 'flex', gap: '15px', justifyContent: 'flex-end'}}>
            <button
              type="button"
              onClick={handleCancel}
              className="btn-cancel"
              style={{
                padding: '12px 24px',
                border: '1px solid #cbd5e0',
                borderRadius: '6px',
                background: '#fff',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              취소
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-add"
              style={{
                padding: '12px 24px',
                opacity: saving ? 0.5 : 1,
                cursor: saving ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <FiSave />
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
