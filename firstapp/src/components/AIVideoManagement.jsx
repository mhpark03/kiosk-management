import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import videoService from '../services/videoService';
import { FiTrash2, FiPlay, FiImage, FiEdit, FiZap } from 'react-icons/fi';
import './VideoManagement.css';

function AIVideoManagement() {
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
  const [searchTerm, setSearchTerm] = useState('');
  const itemsPerPage = 10;

  useEffect(() => {
    loadAIVideos();
  }, []);

  const loadAIVideos = async () => {
    try {
      setLoading(true);
      const data = await videoService.getAIVideos();
      // Sort by ID in descending order (newest first)
      const sortedData = [...data].sort((a, b) => b.id - a.id);
      setVideos(sortedData);
      setError('');
    } catch (err) {
      console.error('Failed to load AI videos:', err);
      setError('AI 생성 영상을 불러오는데 실패했습니다.');
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
    if (!window.confirm('정말로 이 영상을 삭제하시겠습니까?')) {
      return;
    }

    try {
      setError('');
      await videoService.deleteVideo(videoId);
      setSuccess('영상이 성공적으로 삭제되었습니다.');
      await loadAIVideos();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
      setTimeout(() => setError(''), 3000);
    }
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
      setSuccess('영상 정보가 성공적으로 수정되었습니다.');
      await loadAIVideos();
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

  const getVideoTypeLabel = (videoType) => {
    const labels = {
      'RUNWAY_GENERATED': 'Runway ML',
      'VEO_GENERATED': 'Google Veo'
    };
    return labels[videoType] || videoType;
  };

  const getVideoTypeBadgeColor = (videoType) => {
    const colors = {
      'RUNWAY_GENERATED': '#667eea',
      'VEO_GENERATED': '#48bb78'
    };
    return colors[videoType] || '#718096';
  };

  // Filter videos by search term
  const filteredVideos = videos.filter(video => {
    if (!searchTerm) return true;
    const title = video.title || '';
    return title.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredVideos.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentVideos = filteredVideos.slice(indexOfFirstItem, indexOfLastItem);

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

  // Reset to page 1 when search term changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  if (loading) {
    return <div className="loading">AI 생성 영상 목록을 불러오는 중...</div>;
  }

  return (
    <div className="store-management">
      <div className="store-header">
        <h1><FiZap style={{marginRight: '8px', verticalAlign: 'middle'}} />편집영상 관리</h1>

        {/* Search Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flex: 1,
          maxWidth: '500px'
        }}>
          <input
            type="text"
            placeholder="제목으로 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              flex: 1,
              padding: '10px 15px',
              border: '1px solid #cbd5e0',
              borderRadius: '4px',
              fontSize: '14px',
              outline: 'none'
            }}
          />
          {searchTerm && (
            <div style={{
              color: '#718096',
              fontSize: '14px',
              whiteSpace: 'nowrap'
            }}>
              {filteredVideos.length}개
            </div>
          )}
        </div>

        <div className="header-actions">
          <div style={{display: 'flex', gap: '10px'}}>
            <button
              onClick={() => navigate('/videos/generate')}
              className="btn-secondary"
              style={{
                background: '#667eea',
                color: '#fff',
                border: 'none',
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              영상 만들기 (Runway)
            </button>
            <button
              onClick={() => navigate('/videos/generate-veo')}
              className="btn-secondary"
              style={{
                background: '#48bb78',
                color: '#fff',
                border: 'none',
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              Veo 영상 만들기
            </button>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="store-table-container">
        <table className="store-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>AI 모델</th>
              <th>제목</th>
              <th>프롬프트</th>
              <th>설정</th>
              <th>크기</th>
              <th>생성일</th>
              <th>작업</th>
            </tr>
          </thead>
          <tbody>
            {currentVideos.length === 0 ? (
              <tr>
                <td colSpan="8" className="no-data">
                  AI로 생성된 영상이 없습니다
                </td>
              </tr>
            ) : (
              currentVideos.map((video) => (
                <tr key={video.id}>
                  <td style={{textAlign: 'center', fontWeight: '600'}}>
                    {video.id}
                  </td>
                  <td>
                    <span style={{
                      display: 'inline-block',
                      padding: '4px 10px',
                      borderRadius: '12px',
                      background: getVideoTypeBadgeColor(video.videoType),
                      color: '#fff',
                      fontSize: '12px',
                      fontWeight: '600'
                    }}>
                      {getVideoTypeLabel(video.videoType)}
                    </span>
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
                  <td style={{maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                    {video.runwayPrompt || '-'}
                  </td>
                  <td style={{fontSize: '12px', color: '#718096'}}>
                    {video.runwayModel && <div>모델: {video.runwayModel}</div>}
                    {video.runwayResolution && <div>해상도: {video.runwayResolution}</div>}
                  </td>
                  <td>{videoService.formatFileSize(video.fileSize)}</td>
                  <td>{formatDate(video.uploadedAt)}</td>
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
      {filteredVideos.length > 0 && totalPages > 1 && (
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
        {searchTerm ? `검색 결과 ${filteredVideos.length}개` : `전체 ${videos.length}개 영상`}
        {filteredVideos.length > 0 && ` (${currentPage} / ${totalPages} 페이지)`}
      </div>

      {/* Video Player Modal */}
      {playingVideo && videoUrl && (
        <div className="video-modal" onClick={handleClosePlayer}>
          <div className="video-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={handleClosePlayer}>×</button>
            <div style={{marginBottom: '10px'}}>
              <span style={{
                display: 'inline-block',
                padding: '6px 12px',
                borderRadius: '12px',
                background: getVideoTypeBadgeColor(playingVideo.videoType),
                color: '#fff',
                fontSize: '14px',
                fontWeight: '600',
                marginRight: '10px'
              }}>
                {getVideoTypeLabel(playingVideo.videoType)}
              </span>
              <span style={{fontSize: '18px', fontWeight: '600'}}>
                {playingVideo.title || playingVideo.originalFilename}
              </span>
            </div>
            <video controls autoPlay className="video-player">
              <source src={videoUrl} type={playingVideo.contentType} />
              Your browser does not support the video tag.
            </video>
            {playingVideo.runwayPrompt && (
              <div style={{marginTop: '15px', padding: '10px', background: '#f7fafc', borderRadius: '4px'}}>
                <div style={{fontWeight: '600', marginBottom: '5px', color: '#2d3748'}}>생성 프롬프트:</div>
                <p style={{margin: 0, color: '#4a5568'}}>{playingVideo.runwayPrompt}</p>
              </div>
            )}
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
              <div style={{marginBottom: '20px'}}>
                <label style={{display: 'block', marginBottom: '8px', fontWeight: '600', color: '#2d3748'}}>
                  AI 모델
                </label>
                <span style={{
                  display: 'inline-block',
                  padding: '6px 12px',
                  borderRadius: '12px',
                  background: getVideoTypeBadgeColor(editingVideo.videoType),
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: '600'
                }}>
                  {getVideoTypeLabel(editingVideo.videoType)}
                </span>
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

export default AIVideoManagement;
