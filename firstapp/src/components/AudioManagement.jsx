import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import videoService from '../services/videoService';
import { FiTrash2, FiDownload, FiMusic, FiEdit, FiPlay, FiPause } from 'react-icons/fi';
import './VideoManagement.css';
import { formatKSTDate } from '../utils/dateUtils';

export default function AudioManagement() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [audios, setAudios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredAudios, setFilteredAudios] = useState([]);
  const [playingAudio, setPlayingAudio] = useState(null);
  const [audioElement, setAudioElement] = useState(null);
  const itemsPerPage = 10;

  // Audio Upload Modal State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploading, setUploading] = useState(false);

  // Edit Modal State
  const [editingAudio, setEditingAudio] = useState(null);
  const [editForm, setEditForm] = useState({ title: '', description: '' });

  useEffect(() => {
    loadAudios();
  }, []);

  // Apply search filter
  useEffect(() => {
    let filtered = audios;

    // Apply search filter (제목 또는 설명)
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(audio => {
        const titleMatch = audio.title?.toLowerCase().includes(searchLower);
        const descriptionMatch = audio.description?.toLowerCase().includes(searchLower);
        return titleMatch || descriptionMatch;
      });
    }

    setFilteredAudios(filtered);
  }, [audios, searchTerm]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filteredAudios.length]);

  // Cleanup audio element on unmount
  useEffect(() => {
    return () => {
      if (audioElement) {
        audioElement.pause();
        audioElement.src = '';
      }
    };
  }, [audioElement]);

  const loadAudios = async () => {
    try {
      setLoading(true);
      const data = await videoService.getAllAudios();
      // Sort by ID in descending order (newest first)
      const sortedData = [...data].sort((a, b) => b.id - a.id);
      setAudios(sortedData);
      setError('');
    } catch (err) {
      console.error('Failed to load audios:', err);
      setError('');
    } finally {
      setLoading(false);
    }
  };

  const handlePlay = async (audio) => {
    try {
      // Stop currently playing audio if any
      if (audioElement) {
        audioElement.pause();
        audioElement.src = '';
      }

      if (playingAudio?.id === audio.id) {
        setPlayingAudio(null);
        setAudioElement(null);
        return;
      }

      setError('');
      const urlData = await videoService.getPresignedUrl(audio.id, 60);

      const newAudioElement = new Audio(urlData.url);
      newAudioElement.addEventListener('ended', () => {
        setPlayingAudio(null);
        setAudioElement(null);
      });

      newAudioElement.play();
      setAudioElement(newAudioElement);
      setPlayingAudio(audio);
    } catch (err) {
      setError(err.message);
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleDelete = async (audioId) => {
    if (!window.confirm('정말로 이 음성 파일을 삭제하시겠습니까?')) {
      return;
    }

    try {
      setError('');
      await videoService.deleteVideo(audioId);
      setSuccess('음성 파일이 성공적으로 삭제되었습니다.');
      await loadAudios();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleDownload = async (audio) => {
    try {
      const urlData = await videoService.getDownloadUrl(audio.id);
      const link = document.createElement('a');
      link.href = urlData.url;
      link.download = audio.originalFilename || audio.filename || 'audio.mp3';
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      setError(err.message);
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleEdit = (audio) => {
    setEditingAudio(audio);
    setEditForm({
      title: audio.title || '',
      description: audio.description || ''
    });
  };

  const handleEditSave = async () => {
    if (!editingAudio) return;

    try {
      setError('');
      await videoService.updateVideo(
        editingAudio.id,
        editForm.title,
        editForm.description
      );
      setSuccess('음성 파일 정보가 성공적으로 수정되었습니다.');
      await loadAudios();
      setEditingAudio(null);
      setEditForm({ title: '', description: '' });
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleEditCancel = () => {
    setEditingAudio(null);
    setEditForm({ title: '', description: '' });
  };

  const handleUploadClick = () => {
    setShowUploadModal(true);
    setUploadFile(null);
    setUploadTitle('');
    setUploadDescription('');
    setError('');
  };

  const handleUploadFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('audio/') && !file.type === 'application/octet-stream') {
      setError('음성 파일만 업로드 가능합니다.');
      setTimeout(() => setError(''), 3000);
      return;
    }

    setUploadFile(file);
  };

  const handleUploadAudio = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      setError('음성 파일을 선택해주세요');
      setTimeout(() => setError(''), 3000);
      return;
    }

    if (!uploadTitle.trim()) {
      setError('제목을 입력해주세요');
      setTimeout(() => setError(''), 3000);
      return;
    }

    if (!uploadDescription.trim()) {
      setError('설명을 입력해주세요');
      setTimeout(() => setError(''), 3000);
      return;
    }

    setUploading(true);
    setError('');
    setSuccess('');

    try {
      // Check for duplicate filename before upload
      const isDuplicate = await videoService.checkDuplicateFilename(uploadFile.name);
      if (isDuplicate) {
        setError(`같은 파일명의 음성 파일이 이미 존재합니다: ${uploadFile.name}`);
        setUploading(false);
        setTimeout(() => setError(''), 5000);
        return;
      }

      const data = await videoService.uploadAudio(
        uploadFile,
        uploadTitle,
        uploadDescription
      );

      setSuccess(`음성 파일이 성공적으로 업로드되었습니다: ${data.video.title}`);

      // Reset form
      setUploadFile(null);
      setUploadTitle('');
      setUploadDescription('');

      // Reload audio list and close modal
      await loadAudios();
      setShowUploadModal(false);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
      setTimeout(() => setError(''), 3000);
    } finally {
      setUploading(false);
    }
  };


  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
  };

  const getUploaderName = (audio) => {
    if (audio.uploadedByName) {
      return audio.uploadedByName;
    }
    return '';
  };

  // Pagination logic
  const totalPages = Math.ceil(filteredAudios.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentAudios = filteredAudios.slice(indexOfFirstItem, indexOfLastItem);

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

  if (loading) {
    return <div className="loading">음성 파일 목록을 불러오는 중...</div>;
  }

  return (
    <div className="store-management">
      <div className="store-header">
        <h1>음성 관리</h1>

        {/* 검색 입력창 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          margin: '15px 0',
          maxWidth: '500px'
        }}>
          <div style={{
            position: 'relative',
            flex: 1
          }}>
            <FiMusic style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#718096',
              fontSize: '16px'
            }} />
            <input
              type="text"
              placeholder="제목 또는 설명으로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 15px 10px 40px',
                fontSize: '14px',
                border: '1px solid #cbd5e0',
                borderRadius: '6px',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#667eea'}
              onBlur={(e) => e.target.style.borderColor = '#cbd5e0'}
            />
          </div>
          {searchTerm && (
            <div style={{
              fontSize: '13px',
              color: '#718096',
              whiteSpace: 'nowrap'
            }}>
              {filteredAudios.length}개 음성
            </div>
          )}
        </div>

        <div className="header-actions">
          <button onClick={handleUploadClick} className="btn-add">
            + 음성 업로드
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
            {currentAudios.length === 0 ? (
              <tr>
                <td colSpan="7" className="no-data">등록된 음성 파일이 없습니다</td>
              </tr>
            ) : (
              currentAudios.map((audio) => (
                <tr key={audio.id}>
                  <td style={{textAlign: 'center', fontWeight: '600'}}>
                    {audio.id}
                  </td>
                  <td>
                    <div className="filename-wrapper">
                      <div className="video-thumbnail-placeholder">
                        <FiMusic />
                      </div>
                      <div className="filename-info">
                        <span className="filename-text">{audio.title || '-'}</span>
                      </div>
                    </div>
                  </td>
                  <td style={{maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                    {audio.description || '-'}
                  </td>
                  <td>{formatFileSize(audio.fileSize)}</td>
                  <td>{formatKSTDate(audio.uploadedAt)}</td>
                  <td>{getUploaderName(audio)}</td>
                  <td>
                    <div className="action-buttons">
                      <button
                        onClick={() => handlePlay(audio)}
                        className="btn-secondary"
                        title={playingAudio?.id === audio.id ? "일시정지" : "재생"}
                        style={{marginRight: '8px'}}
                      >
                        {playingAudio?.id === audio.id ? <FiPause /> : <FiPlay />}
                      </button>
                      <button
                        onClick={() => handleEdit(audio)}
                        className="btn-secondary"
                        title="편집"
                        style={{marginRight: '8px'}}
                      >
                        <FiEdit />
                      </button>
                      <button
                        onClick={() => handleDownload(audio)}
                        className="btn-secondary"
                        title="다운로드"
                        style={{marginRight: '8px'}}
                      >
                        <FiDownload />
                      </button>
                      <button
                        onClick={() => handleDelete(audio.id)}
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
      {filteredAudios.length > 0 && totalPages > 1 && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '10px',
          margin: '20px 0'
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

          {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
            <button
              key={pageNum}
              onClick={() => handlePageChange(pageNum)}
              style={{
                padding: '8px 12px',
                border: '1px solid #cbd5e0',
                borderRadius: '4px',
                background: currentPage === pageNum ? '#667eea' : '#fff',
                color: currentPage === pageNum ? '#fff' : '#2d3748',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: currentPage === pageNum ? '600' : '500'
              }}
            >
              {pageNum}
            </button>
          ))}

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
        전체 {filteredAudios.length}개 음성 파일 {filteredAudios.length > 0 && `(${currentPage} / ${totalPages} 페이지)`}
      </div>

      {/* Audio Upload Modal */}
      {showUploadModal && (
        <div className="video-modal" onClick={() => !uploading && setShowUploadModal(false)}>
          <div className="video-modal-content" style={{maxWidth: '600px'}} onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => !uploading && setShowUploadModal(false)} disabled={uploading}>×</button>
            <h3>음성 업로드</h3>

            <form onSubmit={handleUploadAudio} style={{marginTop: '20px'}}>
              {/* File Input */}
              <div style={{marginBottom: '20px'}}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontWeight: '600',
                  color: '#2d3748',
                  fontSize: '15px'
                }}>
                  음성 파일 *
                </label>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleUploadFileChange}
                  disabled={uploading}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #cbd5e0',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
                {uploadFile && (
                  <div style={{
                    marginTop: '15px',
                    padding: '15px',
                    background: '#f7fafc',
                    borderRadius: '8px'
                  }}>
                    <div style={{
                      fontSize: '13px',
                      color: '#4a5568'
                    }}>
                      파일명: {uploadFile.name}<br/>
                      크기: {(uploadFile.size / 1024 / 1024).toFixed(2)} MB
                    </div>
                  </div>
                )}
              </div>

              {/* Title Input */}
              <div style={{marginBottom: '20px'}}>
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
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="제목을 입력하세요"
                  disabled={uploading}
                  required
                  maxLength={255}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #cbd5e0',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
              </div>

              {/* Description Input */}
              <div style={{marginBottom: '20px'}}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontWeight: '600',
                  color: '#2d3748',
                  fontSize: '15px'
                }}>
                  설명 *
                </label>
                <textarea
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  placeholder="음성 파일에 대한 설명을 입력하세요"
                  rows={4}
                  disabled={uploading}
                  required
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #cbd5e0',
                    borderRadius: '6px',
                    fontSize: '14px',
                    resize: 'vertical'
                  }}
                />
              </div>

              {/* Action Buttons */}
              <div style={{display: 'flex', gap: '10px', justifyContent: 'flex-end'}}>
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  disabled={uploading}
                  style={{
                    padding: '10px 20px',
                    background: '#fff',
                    color: '#2d3748',
                    border: '1px solid #cbd5e0',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: uploading ? 'not-allowed' : 'pointer'
                  }}
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={uploading || !uploadFile}
                  style={{
                    padding: '10px 20px',
                    background: uploading || !uploadFile ? '#a0aec0' : '#667eea',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: uploading || !uploadFile ? 'not-allowed' : 'pointer'
                  }}
                >
                  {uploading ? '업로드 중...' : '업로드'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingAudio && (
        <div className="video-modal" onClick={handleEditCancel}>
          <div className="video-modal-content" style={{maxWidth: '600px'}} onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={handleEditCancel}>×</button>
            <h3>음성 파일 편집</h3>

            <div style={{marginTop: '20px'}}>
              <div style={{marginBottom: '20px'}}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontWeight: '600',
                  color: '#2d3748',
                  fontSize: '15px'
                }}>
                  제목
                </label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm({...editForm, title: e.target.value})}
                  placeholder="제목을 입력하세요"
                  maxLength={255}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #cbd5e0',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div style={{marginBottom: '20px'}}>
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
                  value={editForm.description}
                  onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                  placeholder="음성 파일에 대한 설명을 입력하세요"
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #cbd5e0',
                    borderRadius: '6px',
                    fontSize: '14px',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div style={{display: 'flex', gap: '10px', justifyContent: 'flex-end'}}>
                <button
                  type="button"
                  onClick={handleEditCancel}
                  style={{
                    padding: '10px 20px',
                    background: '#fff',
                    color: '#2d3748',
                    border: '1px solid #cbd5e0',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleEditSave}
                  style={{
                    padding: '10px 20px',
                    background: '#667eea',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer'
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
