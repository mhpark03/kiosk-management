import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import videoService from '../services/videoService';
import { FiArrowLeft, FiSave, FiCheck } from 'react-icons/fi';
import './VideoManagement.css';

function KioskVideoManagement() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const kiosk = location.state?.kiosk;

  const [videos, setVideos] = useState([]);
  const [selectedVideos, setSelectedVideos] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    if (!kiosk) {
      navigate('/kiosks');
      return;
    }
    loadVideos();
    loadKioskVideos();
  }, [kiosk]);

  const loadVideos = async () => {
    try {
      setLoading(true);
      const data = await videoService.getAllVideos();
      const sortedData = [...data].sort((a, b) => b.id - a.id);
      setVideos(sortedData);
      setError('');
    } catch (err) {
      console.error('Failed to load videos:', err);
      setError('영상 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const loadKioskVideos = async () => {
    // TODO: 키오스크에 할당된 영상 목록을 불러오는 API 구현 필요
    // 임시로 빈 Set으로 초기화
    setSelectedVideos(new Set());
  };

  const handleToggleVideo = (videoId) => {
    const newSelected = new Set(selectedVideos);
    if (newSelected.has(videoId)) {
      newSelected.delete(videoId);
    } else {
      newSelected.add(videoId);
    }
    setSelectedVideos(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedVideos.size === videos.length) {
      setSelectedVideos(new Set());
    } else {
      setSelectedVideos(new Set(videos.map(v => v.id)));
    }
  };

  const handleSave = async () => {
    try {
      // TODO: 선택된 영상 목록을 키오스크에 저장하는 API 구현 필요
      setSuccess('영상 목록이 저장되었습니다.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('영상 목록 저장에 실패했습니다: ' + err.message);
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleBack = () => {
    navigate('/kiosks');
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
    if (video.uploadedByName) {
      return video.uploadedByName;
    }
    if (video.uploadedBy) {
      const atIndex = video.uploadedBy.indexOf('@');
      if (atIndex > 0) {
        return video.uploadedBy.substring(0, atIndex);
      }
      return video.uploadedBy;
    }
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

  useEffect(() => {
    setCurrentPage(1);
  }, [videos.length]);

  if (!kiosk) {
    return null;
  }

  if (loading) {
    return <div className="loading">영상 목록을 불러오는 중...</div>;
  }

  return (
    <div className="store-management">
      <div className="store-header">
        <div>
          <button onClick={handleBack} className="btn btn-back">
            <FiArrowLeft className="icon" /> 목록으로
          </button>
          <h1>키오스크 영상 관리</h1>
          <p className="store-filter-info">
            키오스크 ID: {kiosk.kioskid} | 매장: {kiosk.posname || kiosk.posid}
          </p>
        </div>
        <div className="header-actions">
          <button onClick={handleSave} className="btn-add" disabled={selectedVideos.size === 0}>
            <FiSave /> 저장 ({selectedVideos.size}개 선택)
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="store-table-container">
        <table className="store-table">
          <thead>
            <tr>
              <th style={{width: '50px'}}>
                <input
                  type="checkbox"
                  checked={selectedVideos.size === videos.length && videos.length > 0}
                  onChange={handleSelectAll}
                  style={{cursor: 'pointer'}}
                />
              </th>
              <th>ID</th>
              <th>제목</th>
              <th>설명</th>
              <th>크기</th>
              <th>등록일</th>
              <th>등록자</th>
            </tr>
          </thead>
          <tbody>
            {currentVideos.length === 0 ? (
              <tr>
                <td colSpan="7" className="no-data">업로드된 비디오가 없습니다</td>
              </tr>
            ) : (
              currentVideos.map((video) => (
                <tr
                  key={video.id}
                  style={{
                    backgroundColor: selectedVideos.has(video.id) ? '#f0f7ff' : 'transparent',
                    cursor: 'pointer'
                  }}
                  onClick={() => handleToggleVideo(video.id)}
                >
                  <td style={{textAlign: 'center'}} onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedVideos.has(video.id)}
                      onChange={() => handleToggleVideo(video.id)}
                      style={{cursor: 'pointer'}}
                    />
                  </td>
                  <td style={{textAlign: 'center', fontWeight: '600'}}>
                    {video.id}
                  </td>
                  <td>
                    <div className="filename-wrapper">
                      {video.thumbnailUrl && (
                        <img
                          src={video.thumbnailUrl}
                          alt="thumbnail"
                          className="video-thumbnail"
                        />
                      )}
                      <span className="filename-text">{video.title || '-'}</span>
                      {selectedVideos.has(video.id) && (
                        <FiCheck style={{color: '#3182ce', fontSize: '18px'}} />
                      )}
                    </div>
                  </td>
                  <td style={{maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                    {video.description || '-'}
                  </td>
                  <td>{videoService.formatFileSize(video.fileSize)}</td>
                  <td>{formatDate(video.uploadedAt)}</td>
                  <td>{getUploaderName(video)}</td>
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
        전체 {videos.length}개 비디오 중 {selectedVideos.size}개 선택됨
        {videos.length > 0 && ` (${currentPage} / ${totalPages} 페이지)`}
      </div>
    </div>
  );
}

export default KioskVideoManagement;
