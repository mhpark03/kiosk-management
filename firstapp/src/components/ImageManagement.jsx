import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import videoService from '../services/videoService';
import { generateImage, saveGeneratedImageToBackend } from '../services/imageService';
import { FiTrash2, FiDownload, FiImage, FiEdit } from 'react-icons/fi';
import S3ImageSelector from './S3ImageSelector';
import './VideoManagement.css';
import './ImageGenerator.css';

export default function ImageManagement() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredImages, setFilteredImages] = useState([]);
  const itemsPerPage = 10;

  // Image Generation Modal State
  const [showGenerateModal, setShowGenerateModal] = useState(false);

  // Image Upload Modal State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadPreview, setUploadPreview] = useState(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [referenceImages, setReferenceImages] = useState([
    {source: 's3', file: null, url: null, preview: null},
    {source: 's3', file: null, url: null, preview: null},
    {source: 's3', file: null, url: null, preview: null},
    {source: 's3', file: null, url: null, preview: null},
    {source: 's3', file: null, url: null, preview: null}
  ]);
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('anime');
  const [aspectRatio, setAspectRatio] = useState('1920:1080');
  const [generating, setGenerating] = useState(false);
  const [s3SelectorOpen, setS3SelectorOpen] = useState(false);
  const [currentSlot, setCurrentSlot] = useState(null);

  const MAX_IMAGES = 5;

  // Style options
  const styleOptions = [
    { value: 'realistic', label: '사실적' },
    { value: 'anime', label: '애니메이션' },
    { value: 'artistic', label: '예술적' },
    { value: 'photograph', label: '사진' },
    { value: 'illustration', label: '일러스트' }
  ];

  // Aspect ratio options
  const aspectRatioOptions = [
    { value: '1024:1024', label: '정사각형 (1:1)' },
    { value: '1920:1080', label: '가로 (16:9)' },
    { value: '1080:1920', label: '세로 (9:16)' },
    { value: '1440:1080', label: '가로 (4:3)' },
    { value: '1080:1440', label: '세로 (3:4)' }
  ];

  useEffect(() => {
    loadImages();
  }, []);

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
      const data = await videoService.getAllImages();
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

  const handleGenerateClick = () => {
    setShowGenerateModal(true);
    // Reset form
    setReferenceImages([
      {source: 's3', file: null, url: null, preview: null},
      {source: 's3', file: null, url: null, preview: null},
      {source: 's3', file: null, url: null, preview: null},
      {source: 's3', file: null, url: null, preview: null},
      {source: 's3', file: null, url: null, preview: null}
    ]);
    setPrompt('');
    setStyle('anime');
    setAspectRatio('1920:1080');
    setError('');
  };

  const adjustImageAspectRatio = (imgSrc) => {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        const aspectRatio = image.width / image.height;

        if (aspectRatio >= 0.5 && aspectRatio <= 2.0) {
          resolve(imgSrc);
          return;
        }

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        let canvasWidth, canvasHeight, drawX, drawY, drawWidth, drawHeight;

        if (aspectRatio < 0.5) {
          const targetRatio = 0.7;
          canvasHeight = image.height;
          canvasWidth = canvasHeight * targetRatio;
          drawWidth = image.width;
          drawHeight = image.height;
          drawX = (canvasWidth - drawWidth) / 2;
          drawY = 0;
        } else {
          const targetRatio = 1.5;
          canvasWidth = image.width;
          canvasHeight = canvasWidth / targetRatio;
          drawWidth = image.width;
          drawHeight = image.height;
          drawX = 0;
          drawY = (canvasHeight - drawHeight) / 2;
        }

        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);

        const adjustedImageUrl = canvas.toDataURL('image/png');
        console.log(`이미지 비율 자동 조정: ${aspectRatio.toFixed(2)} → ${(canvasWidth / canvasHeight).toFixed(2)}`);
        resolve(adjustedImageUrl);
      };
      image.onerror = () => reject(new Error('이미지를 로드할 수 없습니다.'));
      image.src = imgSrc;
    });
  };

  const handleRemoveImage = (index) => {
    const newImages = [...referenceImages];
    newImages[index] = {source: 's3', file: null, url: null, preview: null};
    setReferenceImages(newImages);
  };

  const handleOpenS3Selector = (index) => {
    setCurrentSlot(index);
    setS3SelectorOpen(true);
  };

  const handleS3ImageSelect = async (s3Image) => {
    if (currentSlot !== null) {
      try {
        const imageUrl = s3Image.thumbnailUrl || s3Image.s3Url;
        const adjustedImageUrl = await adjustImageAspectRatio(imageUrl);

        const newImages = [...referenceImages];
        newImages[currentSlot] = {
          source: 's3',
          file: null,
          url: s3Image.s3Url,
          preview: adjustedImageUrl
        };
        setReferenceImages(newImages);
        setError('');
      } catch (err) {
        setError(err.message);
        setTimeout(() => setError(''), 3000);
      }
    }
  };

  const getUploadedImageCount = () => {
    return referenceImages.filter(img => img.file !== null || img.url !== null).length;
  };

  const handleGenerateImage = async (e) => {
    e.preventDefault();

    const uploadedCount = getUploadedImageCount();
    if (uploadedCount === 0) {
      setError('최소 1개의 이미지를 업로드해주세요.');
      setTimeout(() => setError(''), 3000);
      return;
    }

    if (!prompt.trim()) {
      setError('프롬프트를 입력해주세요.');
      setTimeout(() => setError(''), 3000);
      return;
    }

    try {
      setGenerating(true);
      setError('');

      const imageData = referenceImages.map(img => {
        if (img.source === 'local' && img.file) {
          return img.file;
        } else if (img.source === 's3' && img.url) {
          return img.url;
        }
        return null;
      });

      const result = await generateImage(imageData, prompt, style, aspectRatio);

      if (result.success) {
        // Auto-save to S3 and database
        const title = `AI 생성 이미지 - ${new Date().toLocaleString('ko-KR')}`;
        const description = result.metadata.prompt || '편집이 필요합니다';

        await saveGeneratedImageToBackend(
          result.imageUrl,
          title,
          description,
          result.taskId,
          result.metadata.aspectRatio,
          result.metadata.prompt,
          result.metadata.style
        );

        setSuccess('이미지가 성공적으로 생성되어 저장되었습니다!');

        // Reload images and close modal
        await loadImages();
        setTimeout(() => {
          setShowGenerateModal(false);
          setSuccess('');
        }, 1500);
      } else {
        throw new Error('이미지 생성에 실패했습니다.');
      }

    } catch (err) {
      console.error('Image generation error:', err);
      setError(err.message || '이미지 생성 중 오류가 발생했습니다.');
      setTimeout(() => setError(''), 5000);
    } finally {
      setGenerating(false);
    }
  };


  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${month}/${day} ${hours}:${minutes}`;
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
          <button onClick={handleUploadClick} className="btn-secondary" style={{marginRight: '10px'}}>
            + 이미지 업로드
          </button>
          <button onClick={handleGenerateClick} className="btn-add">
            + 이미지 생성
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
                  <td>{formatDate(image.uploadedAt)}</td>
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

      {/* Image Generation Modal */}
      {showGenerateModal && (
        <div className="video-modal" onClick={() => !generating && setShowGenerateModal(false)}>
          <div className="video-modal-content" style={{maxWidth: '900px', maxHeight: '90vh', overflow: 'auto'}} onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => !generating && setShowGenerateModal(false)} disabled={generating}>×</button>
            <h3>AI 이미지 생성</h3>

            <form onSubmit={handleGenerateImage}>
              {/* Image Upload Section */}
              <div className="upload-section" style={{marginTop: '20px'}}>
                <h4>참조 이미지 선택 ({getUploadedImageCount()}/{MAX_IMAGES})</h4>
                <div style={{fontSize: '13px', color: '#718096', marginBottom: '10px'}}>
                  서버에 업로드된 이미지 중에서 선택하세요
                </div>
                <div className="image-grid" style={{display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', marginTop: '15px'}}>
                  {referenceImages.map((image, index) => (
                    <div key={index} className="image-upload-slot" style={{border: '2px dashed #cbd5e0', borderRadius: '8px', padding: '8px', aspectRatio: '1/1'}}>
                      {!image.preview ? (
                        <button
                          type="button"
                          onClick={() => handleOpenS3Selector(index)}
                          disabled={generating}
                          style={{
                            width: '100%',
                            height: '100%',
                            border: 'none',
                            background: 'transparent',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '14px'
                          }}
                        >
                          <div style={{fontSize: '32px'}}>🖼️</div>
                          <div style={{fontWeight: 'bold', marginTop: '5px', fontSize: '16px'}}>{index + 1}</div>
                          <div style={{fontSize: '11px', color: '#718096', marginTop: '5px'}}>서버에서 선택</div>
                        </button>
                      ) : (
                        <div style={{position: 'relative', width: '100%', height: '100%'}}>
                          <img src={image.preview} alt={`Preview ${index + 1}`} style={{width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px'}} />
                          <button
                            type="button"
                            onClick={() => handleRemoveImage(index)}
                            style={{
                              position: 'absolute',
                              top: '5px',
                              right: '5px',
                              width: '24px',
                              height: '24px',
                              borderRadius: '50%',
                              border: 'none',
                              background: 'rgba(220, 38, 38, 0.9)',
                              color: '#fff',
                              cursor: 'pointer',
                              fontSize: '16px',
                              lineHeight: '1',
                              padding: 0
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Prompt Section */}
              <div style={{marginTop: '20px'}}>
                <label style={{display: 'block', fontWeight: '600', marginBottom: '8px'}}>프롬프트</label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="생성하고 싶은 이미지에 대해 자세히 설명하세요..."
                  rows="4"
                  disabled={generating}
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

              {/* Settings */}
              <div style={{marginTop: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px'}}>
                <div>
                  <label style={{display: 'block', fontWeight: '600', marginBottom: '8px'}}>스타일</label>
                  <select
                    value={style}
                    onChange={(e) => setStyle(e.target.value)}
                    disabled={generating}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #cbd5e0',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  >
                    {styleOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{display: 'block', fontWeight: '600', marginBottom: '8px'}}>비율</label>
                  <select
                    value={aspectRatio}
                    onChange={(e) => setAspectRatio(e.target.value)}
                    disabled={generating}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #cbd5e0',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  >
                    {aspectRatioOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{marginTop: '20px', display: 'flex', gap: '10px'}}>
                <button
                  type="submit"
                  disabled={generating || getUploadedImageCount() === 0 || !prompt.trim()}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: generating ? '#a0aec0' : '#667eea',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: generating ? 'not-allowed' : 'pointer'
                  }}
                >
                  {generating ? '이미지 생성 중...' : '이미지 생성'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowGenerateModal(false)}
                  disabled={generating}
                  style={{
                    padding: '12px 24px',
                    background: '#fff',
                    color: '#2d3748',
                    border: '1px solid #cbd5e0',
                    borderRadius: '6px',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: generating ? 'not-allowed' : 'pointer'
                  }}
                >
                  닫기
                </button>
              </div>
            </form>

            {/* Loading Indicator */}
            {generating && (
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(255, 255, 255, 0.95)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '8px',
                zIndex: 10
              }}>
                <div className="loading-spinner"></div>
                <p style={{marginTop: '20px', fontSize: '16px', fontWeight: '600'}}>AI가 이미지를 생성하는 중입니다...</p>
                <p style={{color: '#718096', fontSize: '14px'}}>잠시만 기다려주세요.</p>
              </div>
            )}
          </div>
        </div>
      )}

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

      {/* S3 Image Selector Modal */}
      {s3SelectorOpen && (
        <S3ImageSelector
          onSelect={handleS3ImageSelect}
          onClose={() => setS3SelectorOpen(false)}
        />
      )}
    </div>
  );
}
