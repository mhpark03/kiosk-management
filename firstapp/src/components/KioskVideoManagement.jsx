import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import videoService from '../services/videoService';
import { getAllStores } from '../services/storeService';
import api from '../services/api';
import { FiArrowLeft, FiCheck, FiPlus, FiX, FiTrash2, FiSearch, FiDownload } from 'react-icons/fi';
import './VideoManagement.css';

function KioskVideoManagement() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const kiosk = location.state?.kiosk;

  const [videos, setVideos] = useState([]);
  const [stores, setStores] = useState([]);
  const [selectedVideos, setSelectedVideos] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [showModal, setShowModal] = useState(false);
  const [tempSelectedVideos, setTempSelectedVideos] = useState(new Set());
  const [mainCurrentPage, setMainCurrentPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [videoStatusMap, setVideoStatusMap] = useState({});

  useEffect(() => {
    console.log('KioskVideoManagement mounted');
    console.log('Kiosk data:', kiosk);

    if (!kiosk) {
      console.log('No kiosk data, redirecting to /kiosks');
      navigate('/kiosks');
      return;
    }
    loadStores();
    loadVideos();
    loadKioskVideos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadStores = async () => {
    try {
      const data = await getAllStores();
      setStores(data);
    } catch (err) {
      console.error('Failed to load stores:', err);
    }
  };

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
    try {
      const response = await api.get(`/kiosks/${kiosk.id}/videos-with-status`);
      const kioskVideos = response.data || [];
      const videoIds = kioskVideos.map(kv => kv.videoId);
      setSelectedVideos(new Set(videoIds));

      // Create a map of videoId -> downloadStatus
      const statusMap = {};
      kioskVideos.forEach(kv => {
        statusMap[kv.videoId] = kv.downloadStatus || 'PENDING';
      });
      setVideoStatusMap(statusMap);
    } catch (err) {
      console.error('Failed to load kiosk videos:', err);
      setSelectedVideos(new Set());
      setVideoStatusMap({});
    }
  };

  const handleToggleVideo = (videoId) => {
    const newSelected = new Set(tempSelectedVideos);
    if (newSelected.has(videoId)) {
      newSelected.delete(videoId);
    } else {
      newSelected.add(videoId);
    }
    setTempSelectedVideos(newSelected);
  };

  const handleSelectAll = (availableVideos) => {
    const availableIds = availableVideos.map(v => v.id);
    const allSelected = availableIds.every(id => tempSelectedVideos.has(id));

    if (allSelected) {
      // Deselect all available videos
      const newTempSelected = new Set(tempSelectedVideos);
      availableIds.forEach(id => newTempSelected.delete(id));
      setTempSelectedVideos(newTempSelected);
    } else {
      // Select all available videos
      const newTempSelected = new Set(tempSelectedVideos);
      availableIds.forEach(id => newTempSelected.add(id));
      setTempSelectedVideos(newTempSelected);
    }
  };

  const handleOpenModal = () => {
    setTempSelectedVideos(new Set(selectedVideos));
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setTempSelectedVideos(new Set());
  };

  const handleAddVideos = async () => {
    try {
      const videoIds = Array.from(tempSelectedVideos);
      await api.post(`/kiosks/${kiosk.id}/videos`, { videoIds });
      setShowModal(false);
      setTempSelectedVideos(new Set());
      setSuccess('영상이 저장되었습니다.');
      setTimeout(() => setSuccess(''), 3000);
      // Reload videos with status
      await loadKioskVideos();
    } catch (err) {
      console.error('Failed to save videos:', err);
      setError('영상 저장에 실패했습니다: ' + (err.response?.data?.error || err.message));
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleRemoveVideo = async (videoId) => {
    // Show confirmation dialog
    if (!window.confirm('이 영상을 키오스크에서 제거하시겠습니까?')) {
      return;
    }

    try {
      // Remove from backend
      await api.delete(`/kiosks/${kiosk.id}/videos/${videoId}`);

      // Update local state
      const newSelected = new Set(selectedVideos);
      newSelected.delete(videoId);
      setSelectedVideos(newSelected);

      setSuccess('영상이 제거되었습니다.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Failed to remove video:', err);
      setError('영상 제거에 실패했습니다: ' + (err.response?.data?.error || err.message));
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleBack = () => {
    navigate('/kiosks');
  };

  const handleSearch = () => {
    setSearchTerm(searchInput);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  };

  const handleStatusChange = async (videoId, newStatus) => {
    try {
      await api.patch(`/kiosks/${kiosk.id}/videos/${videoId}/status?status=${newStatus}`);

      // Update local state
      setVideoStatusMap(prev => ({
        ...prev,
        [videoId]: newStatus
      }));

      setSuccess('다운로드 상태가 변경되었습니다.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Failed to update status:', err);
      setError('상태 변경에 실패했습니다: ' + (err.response?.data?.error || err.message));
      setTimeout(() => setError(''), 3000);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      'PENDING': { label: '대기', color: '#718096', bg: '#f7fafc' },
      'DOWNLOADING': { label: '다운로드 중', color: '#3182ce', bg: '#ebf8ff' },
      'COMPLETED': { label: '완료', color: '#38a169', bg: '#f0fff4' },
      'FAILED': { label: '실패', color: '#e53e3e', bg: '#fff5f5' }
    };
    const config = statusConfig[status] || statusConfig['PENDING'];
    return (
      <span style={{
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: '12px',
        fontWeight: '500',
        color: config.color,
        background: config.bg,
        border: `1px solid ${config.color}40`
      }}>
        {config.label}
      </span>
    );
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

  const getStoreName = (posid) => {
    const store = stores.find(s => s.posid === posid);
    return store ? store.posname : posid;
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

  // Pagination logic for modal - exclude already assigned videos
  const availableVideos = videos.filter(v => !selectedVideos.has(v.id));
  const totalPagesModal = Math.ceil(availableVideos.length / itemsPerPage);
  const indexOfLastItemModal = currentPage * itemsPerPage;
  const indexOfFirstItemModal = indexOfLastItemModal - itemsPerPage;
  const currentVideos = availableVideos.slice(indexOfFirstItemModal, indexOfLastItemModal);

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPagesModal) {
      setCurrentPage(currentPage + 1);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [videos.length, selectedVideos.size]);

  // Reset to page 1 when search term changes
  useEffect(() => {
    setMainCurrentPage(1);
  }, [searchTerm]);

  if (!kiosk) {
    return null;
  }

  if (loading) {
    return <div className="loading">영상 목록을 불러오는 중...</div>;
  }

  const selectedVideosArray = videos.filter(v => selectedVideos.has(v.id));

  // Filter videos by search term
  const filteredVideos = selectedVideosArray.filter(video => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    const titleMatch = video.title?.toLowerCase().includes(searchLower);
    const descriptionMatch = video.description?.toLowerCase().includes(searchLower);
    return titleMatch || descriptionMatch;
  });

  // Pagination logic for main table
  const mainItemsPerPage = 10;
  const totalPagesMain = Math.ceil(filteredVideos.length / mainItemsPerPage);
  const indexOfLastItemMain = mainCurrentPage * mainItemsPerPage;
  const indexOfFirstItemMain = indexOfLastItemMain - mainItemsPerPage;
  const currentSelectedVideos = filteredVideos.slice(indexOfFirstItemMain, indexOfLastItemMain);

  return (
    <div className="store-management">
      <div className="store-header">
        <div>
          <button onClick={handleBack} className="btn btn-back">
            <FiArrowLeft className="icon" /> 목록으로
          </button>
          <h1>키오스크 영상 관리</h1>
          <p className="store-filter-info">
            키오스크: {getStoreName(kiosk.posid)} {kiosk.kioskno}
          </p>
        </div>
        <div>
          <button
            onClick={handleOpenModal}
            className="btn-add"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <FiPlus /> 영상 추가
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* 영상 목록 */}
      <div style={{ margin: '20px 0' }}>
        {selectedVideosArray.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="제목 또는 설명으로 검색..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyPress={handleKeyPress}
                style={{
                  flex: 1,
                  maxWidth: '400px',
                  padding: '10px 15px',
                  fontSize: '14px',
                  border: '1px solid #cbd5e0',
                  borderRadius: '6px',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => e.target.style.borderColor = '#cbd5e0'}
              />
              <button
                onClick={handleSearch}
                style={{
                  padding: '10px 20px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#fff',
                  background: '#667eea',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.background = '#5568d3'}
                onMouseLeave={(e) => e.target.style.background = '#667eea'}
              >
                <FiSearch /> 검색
              </button>
            </div>
            {searchTerm && (
              <div style={{
                marginTop: '8px',
                fontSize: '13px',
                color: '#718096'
              }}>
                검색 결과: {filteredVideos.length}개 영상
              </div>
            )}
          </div>
        )}

        {selectedVideosArray.length === 0 ? (
          <div style={{
            padding: '40px',
            textAlign: 'center',
            background: '#f7fafc',
            borderRadius: '8px',
            border: '2px dashed #cbd5e0',
            color: '#718096'
          }}>
            선택된 영상이 없습니다. "영상 추가" 버튼을 클릭하여 영상을 추가하세요.
          </div>
        ) : filteredVideos.length === 0 ? (
          <div style={{
            padding: '40px',
            textAlign: 'center',
            background: '#f7fafc',
            borderRadius: '8px',
            border: '2px dashed #cbd5e0',
            color: '#718096'
          }}>
            검색 결과가 없습니다. 다른 검색어를 입력해보세요.
          </div>
        ) : (
          <>
            <div className="store-table-container">
              <table className="store-table">
                <thead>
                  <tr>
                    <th style={{width: '60px'}}>ID</th>
                    <th>제목</th>
                    <th>설명</th>
                    <th style={{width: '100px'}}>크기</th>
                    <th style={{width: '120px'}}>등록일</th>
                    <th style={{width: '100px'}}>등록자</th>
                    <th style={{width: '140px'}}>다운로드 상태</th>
                    <th style={{width: '100px'}}>작업</th>
                  </tr>
                </thead>
                <tbody>
                  {currentSelectedVideos.map((video) => (
                    <tr key={video.id}>
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
                          <span className="filename-text">{video.title || '제목 없음'}</span>
                        </div>
                      </td>
                      <td style={{maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                        {video.description || '-'}
                      </td>
                      <td>{videoService.formatFileSize(video.fileSize)}</td>
                      <td>{formatDate(video.uploadedAt)}</td>
                      <td>{getUploaderName(video)}</td>
                      <td style={{textAlign: 'center'}}>
                        <select
                          value={videoStatusMap[video.id] || 'PENDING'}
                          onChange={(e) => handleStatusChange(video.id, e.target.value)}
                          style={{
                            width: '100%',
                            padding: '6px 8px',
                            fontSize: '12px',
                            border: '1px solid #cbd5e0',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            outline: 'none'
                          }}
                        >
                          <option value="PENDING">대기</option>
                          <option value="DOWNLOADING">다운로드 중</option>
                          <option value="COMPLETED">완료</option>
                          <option value="FAILED">실패</option>
                        </select>
                      </td>
                      <td style={{textAlign: 'center'}}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                          {videoStatusMap[video.id] === 'FAILED' && (
                            <button
                              onClick={() => handleStatusChange(video.id, 'PENDING')}
                              className="btn-icon"
                              title="다시 다운로드"
                              style={{
                                color: '#3182ce',
                                background: '#ebf8ff',
                                border: '1px solid #3182ce',
                                padding: '6px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              <FiDownload />
                            </button>
                          )}
                          <button
                            onClick={() => handleRemoveVideo(video.id)}
                            className="btn-icon btn-delete"
                            title="영상 제거"
                          >
                            <FiTrash2 />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination for main table */}
            <div style={{ marginTop: '20px' }}>
              {totalPagesMain > 1 && (
                <div className="pagination">
                  <button
                    onClick={() => setMainCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={mainCurrentPage === 1}
                    className="pagination-btn"
                  >
                    이전
                  </button>

                  {Array.from({ length: totalPagesMain }, (_, i) => i + 1).map(pageNum => (
                    <button
                      key={pageNum}
                      onClick={() => setMainCurrentPage(pageNum)}
                      className={`pagination-btn ${pageNum === mainCurrentPage ? 'active' : ''}`}
                    >
                      {pageNum}
                    </button>
                  ))}

                  <button
                    onClick={() => setMainCurrentPage(prev => Math.min(totalPagesMain, prev + 1))}
                    disabled={mainCurrentPage === totalPagesMain}
                    className="pagination-btn"
                  >
                    다음
                  </button>
                </div>
              )}
              <div style={{
                textAlign: 'center',
                color: '#718096',
                fontSize: '14px',
                marginTop: '10px'
              }}>
                {searchTerm ? `검색 결과 ${filteredVideos.length}개` : `전체 ${selectedVideosArray.length}개 영상`}
                {totalPagesMain > 1 && ` (${mainCurrentPage} / ${totalPagesMain} 페이지, 페이지당 10개 표시)`}
              </div>
            </div>
          </>
        )}
      </div>

      {/* 영상 선택 모달 */}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '12px',
            width: '90%',
            maxWidth: '1200px',
            maxHeight: '90vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* 모달 헤더 */}
            <div style={{
              padding: '20px 30px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#2d3748', margin: 0 }}>
                영상 선택
              </h2>
              <button
                onClick={handleCloseModal}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#718096',
                  padding: '0',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <FiX />
              </button>
            </div>

            {/* 모달 컨텐츠 */}
            <div style={{
              flex: 1,
              overflow: 'auto',
              padding: '20px 30px'
            }}>
              <div className="store-table-container">
                <table className="store-table">
                  <thead>
                    <tr>
                      <th style={{width: '50px'}}>
                        <input
                          type="checkbox"
                          checked={availableVideos.length > 0 && availableVideos.every(v => tempSelectedVideos.has(v.id))}
                          onChange={() => handleSelectAll(availableVideos)}
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
                        <td colSpan="7" className="no-data">
                          {availableVideos.length === 0 && videos.length > 0
                            ? '추가 가능한 영상이 없습니다. 모든 영상이 이미 할당되었습니다.'
                            : '업로드된 비디오가 없습니다'}
                        </td>
                      </tr>
                    ) : (
                      currentVideos.map((video) => (
                        <tr
                          key={video.id}
                          style={{
                            backgroundColor: tempSelectedVideos.has(video.id) ? '#f0f7ff' : 'transparent',
                            cursor: 'pointer'
                          }}
                          onClick={() => handleToggleVideo(video.id)}
                        >
                          <td style={{textAlign: 'center'}} onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={tempSelectedVideos.has(video.id)}
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
                              {tempSelectedVideos.has(video.id) && (
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
              {availableVideos.length > 0 && totalPagesModal > 1 && (
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
                    {Array.from({ length: totalPagesModal }, (_, i) => i + 1).map(pageNum => (
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
                    disabled={currentPage === totalPagesModal}
                    style={{
                      padding: '8px 16px',
                      border: '1px solid #cbd5e0',
                      borderRadius: '4px',
                      background: currentPage === totalPagesModal ? '#f7fafc' : '#fff',
                      color: currentPage === totalPagesModal ? '#a0aec0' : '#2d3748',
                      cursor: currentPage === totalPagesModal ? 'not-allowed' : 'pointer',
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
                margin: '10px 0'
              }}>
                {selectedVideos.size > 0 ?
                  `추가 가능한 ${availableVideos.length}개 비디오 중 ${tempSelectedVideos.size - selectedVideos.size}개 선택됨` :
                  `전체 ${availableVideos.length}개 비디오 중 ${tempSelectedVideos.size}개 선택됨`
                }
                {availableVideos.length > 0 && ` (${currentPage} / ${totalPagesModal} 페이지)`}
              </div>
            </div>

            {/* 모달 푸터 */}
            <div style={{
              padding: '20px 30px',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px'
            }}>
              <button
                onClick={handleCloseModal}
                style={{
                  padding: '10px 20px',
                  border: '1px solid #cbd5e0',
                  borderRadius: '6px',
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
                onClick={handleAddVideos}
                className="btn-add"
                style={{
                  padding: '10px 20px',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                선택 완료 ({tempSelectedVideos.size}개)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default KioskVideoManagement;
