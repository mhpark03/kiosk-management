import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import videoService from '../services/videoService';
import { FiUpload, FiTrash2, FiPlay } from 'react-icons/fi';
import './VideoManagement.css';

function VideoManagement() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [playingVideo, setPlayingVideo] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);

  useEffect(() => {
    loadVideos();
  }, []);

  const loadVideos = async () => {
    try {
      setLoading(true);
      const data = await videoService.getAllVideos();
      setVideos(data);
      setError('');
    } catch (err) {
      console.error('Failed to load videos:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePlay = async (video) => {
    try {
      setError('');
      const urlData = await videoService.getPresignedUrl(video.id, 60);
      setVideoUrl(urlData.url);
      setPlayingVideo(video);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleClosePlayer = () => {
    setPlayingVideo(null);
    setVideoUrl(null);
  };

  const handleDelete = async (videoId) => {
    if (!window.confirm('정말로 이 비디오를 삭제하시겠습니까?')) {
      return;
    }

    try {
      setError('');
      await videoService.deleteVideo(videoId);
      setSuccess('비디오가 성공적으로 삭제되었습니다.');
      await loadVideos();

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUploadClick = () => {
    navigate('/videos/upload');
  };

  if (loading) {
    return <div className="video-loading">비디오 목록을 불러오는 중...</div>;
  }

  return (
    <div className="video-management">
      <div className="video-header">
        <div>
          <h1>비디오 관리</h1>
          <p className="video-subtitle">업로드된 비디오 목록을 관리합니다</p>
        </div>
        <button onClick={handleUploadClick} className="btn btn-primary">
          <FiUpload className="icon" /> 비디오 업로드
        </button>
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
          <button onClick={() => setSuccess('')} className="alert-close">×</button>
        </div>
      )}

      {/* Video List Section */}
      <div className="video-list-section">
        <h2>업로드된 비디오 ({videos.length})</h2>

        {videos.length === 0 ? (
          <div className="no-videos">
            <p>업로드된 비디오가 없습니다.</p>
          </div>
        ) : (
          <div className="video-table-wrapper">
            <table className="video-table">
              <thead>
                <tr>
                  <th>파일명</th>
                  <th>설명</th>
                  <th>크기</th>
                  <th>업로드 일시</th>
                  <th>업로더</th>
                  <th>작업</th>
                </tr>
              </thead>
              <tbody>
                {videos.map((video) => (
                  <tr key={video.id} className="video-row">
                    <td className="video-filename" data-label="파일명">
                      <div className="filename-wrapper">
                        <FiPlay className="play-icon-small" onClick={() => handlePlay(video)} />
                        <span>{video.originalFilename}</span>
                      </div>
                    </td>
                    <td className="video-description-cell" data-label="설명">
                      {video.description || '-'}
                    </td>
                    <td className="video-size" data-label="크기">
                      {videoService.formatFileSize(video.fileSize)}
                    </td>
                    <td className="video-date" data-label="업로드 일시">
                      {videoService.formatDate(video.uploadedAt)}
                    </td>
                    <td className="video-uploader" data-label="업로더">
                      {video.uploadedBy}
                    </td>
                    <td className="video-actions-cell" data-label="작업">
                      <div className="video-actions">
                        <button
                          onClick={() => handlePlay(video)}
                          className="btn btn-secondary btn-sm"
                          title="재생"
                        >
                          <FiPlay className="icon" />
                        </button>
                        <button
                          onClick={() => handleDelete(video.id)}
                          className="btn btn-danger btn-sm"
                          title="삭제"
                        >
                          <FiTrash2 className="icon" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Video Player Modal */}
      {playingVideo && videoUrl && (
        <div className="video-modal" onClick={handleClosePlayer}>
          <div className="video-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={handleClosePlayer}>×</button>
            <h3>{playingVideo.originalFilename}</h3>
            <video controls autoPlay className="video-player">
              <source src={videoUrl} type={playingVideo.contentType} />
              Your browser does not support the video tag.
            </video>
            {playingVideo.description && (
              <p className="modal-description">{playingVideo.description}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default VideoManagement;
