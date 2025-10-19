import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import videoService from '../services/videoService';
import { FiUpload, FiTrash2, FiPlay, FiImage } from 'react-icons/fi';
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
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    loadVideos();
  }, []);

  const loadVideos = async () => {
    try {
      setLoading(true);
      const data = await videoService.getAllVideos();
      // Sort by ID in descending order (newest first)
      const sortedData = [...data].sort((a, b) => b.id - a.id);
      setVideos(sortedData);
      setError('');
    } catch (err) {
      console.error('Failed to load videos:', err);
      setError('');
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
      setTimeout(() => setError(''), 3000);
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
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleUploadClick = () => {
    navigate('/videos/upload');
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${month}/${day} ${hours}:${minutes}`;
  };

  // Pagination logic
  const totalPages = Math.ceil(videos.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentVideos = videos.slice(indexOfFirstItem, indexOfLastItem);

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  // Reset to page 1 when videos change
  useEffect(() => {
    setCurrentPage(1);
  }, [videos.length]);

  if (loading) {
    return <div className="loading">비디오 목록을 불러오는 중...</div>;
  }

  return (
    <div className="store-management">
      <div className="store-header">
        <h1>비디오 관리</h1>
        <div className="header-actions">
          <button onClick={handleUploadClick} className="btn-add">
            + 비디오 업로드
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="store-table-container">
        <table className="store-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>파일명</th>
              <th>제목</th>
              <th>설명</th>
              <th>크기</th>
              <th>업로드 일시</th>
              <th>업로더</th>
              <th>작업</th>
            </tr>
          </thead>
          <tbody>
            {currentVideos.length === 0 ? (
              <tr>
                <td colSpan="8" className="no-data">업로드된 비디오가 없습니다</td>
              </tr>
            ) : (
              currentVideos.map((video) => (
                <tr key={video.id}>
                  <td style={{textAlign: 'center', fontWeight: '600'}}>
                    {video.id}
                  </td>
                  <td>
                    <div className="filename-wrapper">
                      {video.thumbnailUrl ? (
                        <img
                          src={video.thumbnailUrl}
                          alt="thumbnail"
                          className="video-thumbnail"
                          onClick={() => handlePlay(video)}
                        />
                      ) : (
                        <div className="video-thumbnail-placeholder" onClick={() => handlePlay(video)}>
                          <FiImage />
                        </div>
                      )}
                      <div className="filename-info">
                        <span className="filename-text">{video.originalFilename}</span>
                        <FiPlay
                          className="play-icon-inline"
                          onClick={() => handlePlay(video)}
                        />
                      </div>
                    </div>
                  </td>
                  <td style={{maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                    {video.title || '-'}
                  </td>
                  <td style={{maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                    {video.description || '-'}
                  </td>
                  <td>{videoService.formatFileSize(video.fileSize)}</td>
                  <td>{formatDate(video.uploadedAt)}</td>
                  <td>{video.uploadedBy}</td>
                  <td>
                    <div className="action-buttons">
                      <button
                        onClick={() => handlePlay(video)}
                        className="btn-edit"
                        title="재생"
                      >
                        <FiPlay />
                      </button>
                      <button
                        onClick={() => handleDelete(video.id)}
                        className="btn-deactivate"
                        title="삭제"
                      >
                        <FiTrash2 />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {videos.length > 0 && totalPages > 1 && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          margin: '20px 0',
          gap: '10px'
        }}>
          <button
            onClick={handlePreviousPage}
            disabled={currentPage === 1}
            style={{
              padding: '8px 16px',
              border: '1px solid #cbd5e0',
              borderRadius: '4px',
              background: currentPage === 1 ? '#f7fafc' : '#fff',
              color: currentPage === 1 ? '#a0aec0' : '#2d3748',
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            이전
          </button>

          <div style={{display: 'flex', gap: '5px'}}>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
              <button
                key={pageNum}
                onClick={() => handlePageChange(pageNum)}
                style={{
                  padding: '8px 12px',
                  border: pageNum === currentPage ? '2px solid #667eea' : '1px solid #cbd5e0',
                  borderRadius: '4px',
                  background: pageNum === currentPage ? '#667eea' : '#fff',
                  color: pageNum === currentPage ? '#fff' : '#2d3748',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: pageNum === currentPage ? '600' : '500',
                  minWidth: '36px'
                }}
              >
                {pageNum}
              </button>
            ))}
          </div>

          <button
            onClick={handleNextPage}
            disabled={currentPage === totalPages}
            style={{
              padding: '8px 16px',
              border: '1px solid #cbd5e0',
              borderRadius: '4px',
              background: currentPage === totalPages ? '#f7fafc' : '#fff',
              color: currentPage === totalPages ? '#a0aec0' : '#2d3748',
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            다음
          </button>
        </div>
      )}

      <div style={{
        textAlign: 'center',
        color: '#718096',
        fontSize: '14px',
        margin: '10px 0 20px'
      }}>
        전체 {videos.length}개 비디오 {videos.length > 0 && `(${currentPage} / ${totalPages} 페이지)`}
      </div>

      {/* Video Player Modal */}
      {playingVideo && videoUrl && (
        <div className="video-modal" onClick={handleClosePlayer}>
          <div className="video-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={handleClosePlayer}>×</button>
            <h3>{playingVideo.title || playingVideo.originalFilename}</h3>
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
