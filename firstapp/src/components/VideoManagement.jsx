import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import videoService from '../services/videoService';
import { FiUpload, FiTrash2, FiPlay, FiImage, FiEdit } from 'react-icons/fi';
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
  const [editingVideo, setEditingVideo] = useState(null);
  const [editForm, setEditForm] = useState({ title: '', description: '' });
  const [regeneratingThumbnail, setRegeneratingThumbnail] = useState(false);
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

  const handleEdit = (video) => {
    setEditingVideo(video);
    setEditForm({
      title: video.title || '',
      description: video.description || ''
    });
  };

  const handleEditSave = async () => {
    if (!editingVideo) return;

    try {
      setError('');
      await videoService.updateVideo(
        editingVideo.id,
        editForm.title,
        editForm.description
      );
      setSuccess('비디오 정보가 성공적으로 수정되었습니다.');
      await loadVideos();
      setEditingVideo(null);
      setEditForm({ title: '', description: '' });
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleEditCancel = () => {
    setEditingVideo(null);
    setEditForm({ title: '', description: '' });
    setRegeneratingThumbnail(false);
  };

  const handleRegenerateThumbnail = async () => {
    if (!editingVideo) return;

    try {
      setRegeneratingThumbnail(true);
      setError('');
      const response = await videoService.regenerateThumbnail(editingVideo.id);
      setSuccess('썸네일이 성공적으로 재생성되었습니다.');

      // Update the editing video with the response from API
      if (response.video) {
        setEditingVideo(response.video);
      }

      // Reload videos list to update the main view
      await loadVideos();

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
      setTimeout(() => setError(''), 3000);
    } finally {
      setRegeneratingThumbnail(false);
    }
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

  const getUploaderName = (video) => {
    // 1순위: uploadedByName이 있으면 사용
    if (video.uploadedByName) {
      return video.uploadedByName;
    }
    // 2순위: uploadedBy(이메일)의 @ 앞부분 사용
    if (video.uploadedBy) {
      const atIndex = video.uploadedBy.indexOf('@');
      if (atIndex > 0) {
        return video.uploadedBy.substring(0, atIndex);
      }
      return video.uploadedBy;
    }
    // 3순위: 정보 없음
    return 'N/A';
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
        <h1>영상 관리</h1>
        <div className="header-actions">
          <button onClick={handleUploadClick} className="btn-add">
            + 영상등록
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
              <th>제목</th>
              <th>설명</th>
              <th>크기</th>
              <th>등록일</th>
              <th>등록자</th>
              <th>작업</th>
            </tr>
          </thead>
          <tbody>
            {currentVideos.length === 0 ? (
              <tr>
                <td colSpan="7" className="no-data">업로드된 비디오가 없습니다</td>
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
                        <span className="filename-text">{video.title || '-'}</span>
                        <FiPlay
                          className="play-icon-inline"
                          onClick={() => handlePlay(video)}
                        />
                      </div>
                    </div>
                  </td>
                  <td style={{maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                    {video.description || '-'}
                  </td>
                  <td>{videoService.formatFileSize(video.fileSize)}</td>
                  <td>{formatDate(video.uploadedAt)}</td>
                  <td>{getUploaderName(video)}</td>
                  <td>
                    <div className="action-buttons">
                      <button
                        onClick={() => handleEdit(video)}
                        className="btn-edit"
                        title="수정"
                      >
                        <FiEdit />
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

      {/* Edit Video Modal */}
      {editingVideo && (
        <div className="video-modal" onClick={handleEditCancel}>
          <div className="video-modal-content" onClick={(e) => e.stopPropagation()} style={{maxWidth: '600px'}}>
            <button className="modal-close" onClick={handleEditCancel}>×</button>
            <h3>영상 정보 수정</h3>
            <div style={{padding: '20px 0'}}>
              {/* Thumbnail Section */}
              <div style={{marginBottom: '20px'}}>
                <label style={{display: 'block', marginBottom: '8px', fontWeight: '600', color: '#2d3748'}}>
                  썸네일
                </label>
                <div style={{display: 'flex', alignItems: 'center', gap: '15px'}}>
                  {editingVideo.thumbnailUrl ? (
                    <img
                      src={editingVideo.thumbnailUrl}
                      alt="썸네일"
                      style={{
                        width: '160px',
                        height: 'auto',
                        borderRadius: '4px',
                        border: '1px solid #e0e0e0'
                      }}
                    />
                  ) : (
                    <div style={{
                      width: '160px',
                      height: '90px',
                      borderRadius: '4px',
                      border: '1px solid #e0e0e0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: '#f5f5f5',
                      color: '#999'
                    }}>
                      썸네일 없음
                    </div>
                  )}
                  <button
                    onClick={handleRegenerateThumbnail}
                    disabled={regeneratingThumbnail}
                    style={{
                      padding: '8px 16px',
                      border: '1px solid #667eea',
                      borderRadius: '4px',
                      background: regeneratingThumbnail ? '#f0f0f0' : '#fff',
                      color: regeneratingThumbnail ? '#999' : '#667eea',
                      cursor: regeneratingThumbnail ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      fontWeight: '500'
                    }}
                  >
                    {regeneratingThumbnail ? '재생성 중...' : '썸네일 재생성'}
                  </button>
                </div>
              </div>

              <div style={{marginBottom: '20px'}}>
                <label style={{display: 'block', marginBottom: '8px', fontWeight: '600', color: '#2d3748'}}>
                  제목
                </label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm({...editForm, title: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #cbd5e0',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                  placeholder="영상 제목을 입력하세요"
                />
              </div>
              <div style={{marginBottom: '20px'}}>
                <label style={{display: 'block', marginBottom: '8px', fontWeight: '600', color: '#2d3748'}}>
                  설명
                </label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #cbd5e0',
                    borderRadius: '4px',
                    fontSize: '14px',
                    resize: 'vertical'
                  }}
                  placeholder="영상 설명을 입력하세요"
                />
              </div>
              <div style={{display: 'flex', gap: '10px', justifyContent: 'flex-end'}}>
                <button
                  onClick={handleEditCancel}
                  style={{
                    padding: '10px 20px',
                    border: '1px solid #cbd5e0',
                    borderRadius: '4px',
                    background: '#fff',
                    color: '#2d3748',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  취소
                </button>
                <button
                  onClick={handleEditSave}
                  style={{
                    padding: '10px 20px',
                    border: 'none',
                    borderRadius: '4px',
                    background: '#667eea',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  저장
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default VideoManagement;
