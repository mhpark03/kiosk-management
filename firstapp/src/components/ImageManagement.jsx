import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import videoService from '../services/videoService';
import { FiTrash2, FiDownload, FiImage, FiEdit } from 'react-icons/fi';
import { formatKSTDate } from '../utils/dateUtils';
import './VideoManagement.css';

export default function ImageManagement() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [imagePurposeFilter, setImagePurposeFilter] = useState('ALL');
  const [filteredImages, setFilteredImages] = useState([]);
  const itemsPerPage = 10;

  // Image Upload Modal State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadPreview, setUploadPreview] = useState(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadImages();
  }, [imagePurposeFilter]);

  // Apply search filter
  useEffect(() => {
    let filtered = images;

    // Apply search filter (제목 또는 설명)
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(image => {
        const titleMatch = image.title?.toLowerCase().includes(searchLower);
        const descriptionMatch = image.description?.toLowerCase().includes(searchLower);
        return titleMatch || descriptionMatch;
      });
    }

    setFilteredImages(filtered);
  }, [images, searchTerm]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filteredImages.length]);

  const loadImages = async () => {
    try {
      setLoading(true);
      // Pass imagePurpose filter to API (null if ALL)
      const purpose = imagePurposeFilter === 'ALL' ? null : imagePurposeFilter;
      const data = await videoService.getAllImages(purpose);
      // Sort by ID in descending order (newest first)
      const sortedData = [...data].sort((a, b) => b.id - a.id);
      setImages(sortedData);
      setError('');
    } catch (err) {
      console.error('Failed to load images:', err);
      setError('');
    } finally {
      setLoading(false);
    }
  };


  const handleDelete = async (imageId) => {
    if (!window.confirm('정말로 이 이미지를 삭제하시겠습니까?')) {
      return;
    }

    try {
      setError('');
      await videoService.deleteVideo(imageId);
      setSuccess('이미지가 성공적으로 삭제되었습니다.');
      await loadImages();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleDownload = (image) => {
    const link = document.createElement('a');
    link.href = image.s3Url;
    link.download = image.originalFilename || image.filename || 'image.png';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleEdit = (imageId) => {
    navigate(`/images/edit/${imageId}`);
  };

  const handleUploadClick = () => {
    setShowUploadModal(true);
    setUploadFile(null);
    setUploadPreview(null);
    setUploadTitle('');
    setUploadDescription('');
    setError('');
  };

  const handleUploadFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('이미지 파일만 업로드 가능합니다.');
      setTimeout(() => setError(''), 3000);
      return;
    }

    setUploadFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setUploadPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleUploadImage = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      setError('이미지 파일을 선택해주세요');
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
        setError(`같은 파일명의 이미지가 이미 존재합니다: ${uploadFile.name}`);
        setUploading(false);
        setTimeout(() => setError(''), 5000);
        return;
      }

      const data = await videoService.uploadImage(
        uploadFile,
        uploadTitle || uploadFile.name,
        uploadDescription
      );

      setSuccess(`이미지가 성공적으로 업로드되었습니다: ${data.video.title}`);

      // Reset form
      setUploadFile(null);
      setUploadPreview(null);
      setUploadTitle('');
      setUploadDescription('');

      // Reload image list and close modal
      await loadImages();
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

  const getUploaderName = (image) => {
    if (image.uploadedByName) {
      return image.uploadedByName;
    }
    return '';
  };

  // Pagination logic
  const totalPages = Math.ceil(filteredImages.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentImages = filteredImages.slice(indexOfFirstItem, indexOfLastItem);

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
    return <div className="loading">이미지 목록을 불러오는 중...</div>;
  }

  return (
    <div className="store-management">
      <div className="store-header">
        <h1>이미지 관리</h1>

        {/* 검색 및 필터 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          margin: '15px 0',
          flexWrap: 'wrap'
        }}>
          {/* 검색 입력창 */}
          <div style={{
            position: 'relative',
            flex: 1,
            minWidth: '250px'
          }}>
            <FiImage style={{
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

          {/* Purpose 필터 드롭다운 */}
          <select
            value={imagePurposeFilter}
            onChange={(e) => setImagePurposeFilter(e.target.value)}
            style={{
              padding: '10px 15px',
              fontSize: '14px',
              border: '1px solid #cbd5e0',
              borderRadius: '6px',
              outline: 'none',
              backgroundColor: 'white',
              cursor: 'pointer',
              minWidth: '150px'
            }}
          >
            <option value="ALL">전체 이미지</option>
            <option value="GENERAL">일반 이미지</option>
            <option value="REFERENCE">참조 이미지</option>
            <option value="MENU">메뉴 이미지</option>
          </select>

          {searchTerm && (
            <div style={{
              fontSize: '13px',
              color: '#718096',
              whiteSpace: 'nowrap'
            }}>
              {filteredImages.length}개 이미지
            </div>
          )}
        </div>

        <div className="header-actions">
          <button onClick={handleUploadClick} className="btn-add">
            + 이미지 업로드
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
            {currentImages.length === 0 ? (
              <tr>
                <td colSpan="7" className="no-data">생성된 이미지가 없습니다</td>
              </tr>
            ) : (
              currentImages.map((image) => (
                <tr key={image.id}>
                  <td style={{textAlign: 'center', fontWeight: '600'}}>
                    {image.id}
                  </td>
                  <td>
                    <div className="filename-wrapper">
                      {image.thumbnailUrl || image.s3Url ? (
                        <img
                          src={image.thumbnailUrl || image.s3Url}
                          alt="thumbnail"
                          className="video-thumbnail"
                        />
                      ) : (
                        <div className="video-thumbnail-placeholder">
                          <FiImage />
                        </div>
                      )}
                      <div className="filename-info">
                        <span className="filename-text">{image.title || '-'}</span>
                      </div>
                    </div>
                  </td>
                  <td style={{maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                    {image.description || '-'}
                  </td>
                  <td>{formatFileSize(image.fileSize)}</td>
                  <td>{formatKSTDate(image.uploadedAt)}</td>
                  <td>{getUploaderName(image)}</td>
                  <td>
                    <div className="action-buttons">
                      <button
                        onClick={() => handleEdit(image.id)}
                        className="btn-secondary"
                        title="편집"
                        style={{marginRight: '8px'}}
                      >
                        <FiEdit />
                      </button>
                      <button
                        onClick={() => handleDownload(image)}
                        className="btn-secondary"
                        title="다운로드"
                        style={{marginRight: '8px'}}
                      >
                        <FiDownload />
                      </button>
                      <button
                        onClick={() => handleDelete(image.id)}
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
      {filteredImages.length > 0 && totalPages > 1 && (
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
        전체 {filteredImages.length}개 이미지 {filteredImages.length > 0 && `(${currentPage} / ${totalPages} 페이지)`}
      </div>

      {/* Image Upload Modal */}
      {showUploadModal && (
        <div className="video-modal" onClick={() => !uploading && setShowUploadModal(false)}>
          <div className="video-modal-content" style={{maxWidth: '600px'}} onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => !uploading && setShowUploadModal(false)} disabled={uploading}>×</button>
            <h3>이미지 업로드</h3>

            <form onSubmit={handleUploadImage} style={{marginTop: '20px'}}>
              {/* File Input */}
              <div style={{marginBottom: '20px'}}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontWeight: '600',
                  color: '#2d3748',
                  fontSize: '15px'
                }}>
                  이미지 파일 *
                </label>
                <input
                  type="file"
                  accept="image/*"
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
                {uploadPreview && uploadFile && (
                  <div style={{
                    marginTop: '15px',
                    padding: '15px',
                    background: '#f7fafc',
                    borderRadius: '8px'
                  }}>
                    <div style={{
                      marginBottom: '10px',
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#2d3748'
                    }}>
                      미리보기
                    </div>
                    <img
                      src={uploadPreview}
                      alt="Preview"
                      style={{
                        width: '100%',
                        maxHeight: '300px',
                        objectFit: 'contain',
                        borderRadius: '6px',
                        border: '1px solid #e2e8f0'
                      }}
                    />
                    <div style={{
                      marginTop: '10px',
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
                  제목
                </label>
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="제목을 입력하세요 (선택사항, 미입력 시 파일명 사용)"
                  disabled={uploading}
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
                  설명
                </label>
                <textarea
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  placeholder="이미지에 대한 설명을 입력하세요 (선택사항)"
                  rows={4}
                  disabled={uploading}
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
    </div>
  );
}
