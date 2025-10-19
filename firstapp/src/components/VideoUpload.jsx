import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import videoService from '../services/videoService';
import { FiUpload, FiFile, FiArrowLeft } from 'react-icons/fi';
import './VideoManagement.css';

function VideoUpload() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      videoService.validateFile(file);
      setSelectedFile(file);
      setError('');
    } catch (err) {
      setError(err.message);
      setSelectedFile(null);
      e.target.value = '';
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('파일을 선택해주세요.');
      return;
    }

    try {
      setUploading(true);
      setError('');
      setSuccess('');
      setUploadProgress(0);

      // Simulate progress (since we don't have real progress from backend)
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const response = await videoService.uploadVideo(selectedFile, description);

      clearInterval(progressInterval);
      setUploadProgress(100);

      setSuccess('비디오가 성공적으로 업로드되었습니다.');

      // Redirect to video list after 2 seconds
      setTimeout(() => {
        navigate('/videos');
      }, 2000);
    } catch (err) {
      setError(err.message);
      setUploadProgress(0);
      setUploading(false);
    }
  };

  const handleCancel = () => {
    navigate('/videos');
  };

  return (
    <div className="video-management">
      <div className="video-header">
        <button onClick={handleCancel} className="btn btn-back">
          <FiArrowLeft className="icon" /> 목록으로
        </button>
        <h1>비디오 업로드</h1>
        <p className="video-subtitle">새로운 비디오 파일을 업로드합니다</p>
      </div>

      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
          <button onClick={() => setError('')} className="alert-close">×</button>
        </div>
      )}

      {success && (
        <div className="alert alert-success">
          <span>{success}</span>
        </div>
      )}

      {/* Upload Section */}
      <div className="upload-section">
        <div className="upload-form">
          <div className="file-input-wrapper">
            <input
              id="fileInput"
              type="file"
              accept="video/mp4,video/mpeg,video/quicktime,video/x-msvideo,video/x-ms-wmv,video/webm"
              onChange={handleFileSelect}
              disabled={uploading}
            />
            <label htmlFor="fileInput" className="file-input-label">
              <FiFile className="icon" />
              {selectedFile ? selectedFile.name : '파일 선택 (최대 100MB)'}
            </label>
          </div>

          {selectedFile && (
            <div className="file-info">
              <p><strong>파일명:</strong> {selectedFile.name}</p>
              <p><strong>크기:</strong> {videoService.formatFileSize(selectedFile.size)}</p>
              <p><strong>형식:</strong> {selectedFile.type}</p>
            </div>
          )}

          <div className="description-input">
            <label htmlFor="description">설명 (선택사항)</label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="비디오에 대한 설명을 입력하세요..."
              rows="3"
              disabled={uploading}
            />
          </div>

          {uploadProgress > 0 && (
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${uploadProgress}%` }}
              >
                {uploadProgress}%
              </div>
            </div>
          )}

          <div className="upload-actions">
            <button
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
              className="btn btn-primary"
            >
              <FiUpload className="icon" />
              {uploading ? '업로드 중...' : '업로드'}
            </button>
            <button
              onClick={handleCancel}
              disabled={uploading}
              className="btn btn-secondary"
            >
              취소
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default VideoUpload;
