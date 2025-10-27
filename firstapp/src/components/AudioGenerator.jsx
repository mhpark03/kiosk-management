import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import videoService from '../services/videoService';
import ttsService from '../services/ttsService';
import { FiTrash2, FiPlay, FiPlusCircle, FiSearch, FiEdit } from 'react-icons/fi';
import './VideoManagement.css';

export default function AudioGenerator() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [audios, setAudios] = useState([]);
  const [filteredAudios, setFilteredAudios] = useState([]);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [playingAudio, setPlayingAudio] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showAddToVideoModal, setShowAddToVideoModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const itemsPerPage = 10;

  // TTS Form State
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [languageCode, setLanguageCode] = useState('ko-KR');
  const [voiceName, setVoiceName] = useState('ko-KR-Neural2-A');
  const [gender, setGender] = useState('FEMALE');
  const [speakingRate, setSpeakingRate] = useState(1.0);
  const [pitch, setPitch] = useState(0.0);
  const [generating, setGenerating] = useState(false);

  // Add to Video State
  const [selectedAudio, setSelectedAudio] = useState(null);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [replaceAudio, setReplaceAudio] = useState(true);
  const [addingToVideo, setAddingToVideo] = useState(false);

  useEffect(() => {
    loadAudios();
    loadVideos();
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

  const loadAudios = async () => {
    try {
      setLoading(true);
      const data = await ttsService.getAllAudios();
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

  const loadVideos = async () => {
    try {
      const data = await videoService.getAllVideos();
      setVideos(data);
    } catch (err) {
      console.error('Failed to load videos:', err);
    }
  };

  const handleGenerateAudio = async (e) => {
    e.preventDefault();
    setGenerating(true);
    setError('');
    setSuccess('');

    try {
      const data = await ttsService.generateAudio(
        text,
        title,
        description,
        languageCode,
        voiceName,
        gender,
        speakingRate,
        pitch
      );

      setSuccess(`음성이 성공적으로 생성되었습니다: ${data.audio.title}`);

      // Reset form
      setText('');
      setTitle('');
      setDescription('');
      setSpeakingRate(1.0);
      setPitch(0.0);

      // Reload audio list and close modal
      await loadAudios();
      setShowGenerateModal(false);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
      setTimeout(() => setError(''), 3000);
    } finally {
      setGenerating(false);
    }
  };

  const handleAddAudioToVideo = async (e) => {
    e.preventDefault();
    if (!selectedAudio || !selectedVideo) {
      setError('오디오와 비디오를 모두 선택해주세요');
      setTimeout(() => setError(''), 3000);
      return;
    }

    setAddingToVideo(true);
    setError('');
    setSuccess('');

    try {
      const data = await ttsService.addAudioToVideo(
        selectedVideo.id,
        selectedAudio.id,
        `${selectedVideo.title} + ${selectedAudio.title}`,
        `Video with TTS audio: ${selectedAudio.title}`,
        replaceAudio
      );

      setSuccess(`비디오에 음성이 성공적으로 추가되었습니다: ${data.video.title}`);

      // Reset selections and close modal
      setSelectedAudio(null);
      setSelectedVideo(null);
      setShowAddToVideoModal(false);

      // Reload videos
      await loadVideos();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
      setTimeout(() => setError(''), 3000);
    } finally {
      setAddingToVideo(false);
    }
  };

  const handleEdit = (audioId) => {
    navigate(`/audios/edit/${audioId}`);
  };

  const handleAddToVideo = (audio) => {
    setSelectedAudio(audio);
    setShowAddToVideoModal(true);
  };

  const handleDelete = async (audioId) => {
    if (!window.confirm('정말로 이 음성을 삭제하시겠습니까?')) {
      return;
    }

    try {
      setError('');
      await ttsService.deleteAudio(audioId);
      setSuccess('음성이 성공적으로 삭제되었습니다.');
      await loadAudios();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
      setTimeout(() => setError(''), 3000);
    }
  };

  const handlePlay = (audio) => {
    setPlayingAudio(audio);
  };

  const handleClosePlayer = () => {
    setPlayingAudio(null);
  };

  const handleCloseAddToVideoModal = () => {
    setShowAddToVideoModal(false);
    setSelectedAudio(null);
    setSelectedVideo(null);
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

  const getUploaderName = (audio) => {
    if (audio.uploadedByName) {
      return audio.uploadedByName;
    }
    if (audio.uploadedBy) {
      const atIndex = audio.uploadedBy.indexOf('@');
      if (atIndex > 0) {
        return audio.uploadedBy.substring(0, atIndex);
      }
      return audio.uploadedBy;
    }
    return 'N/A';
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'N/A';
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
  };

  const voiceOptions = [
    // Neural2 voices (고품질)
    { value: 'ko-KR-Neural2-A', label: 'Korean Female A (Neural2)', gender: 'FEMALE', lang: 'ko-KR' },
    { value: 'ko-KR-Neural2-B', label: 'Korean Female B (Neural2)', gender: 'FEMALE', lang: 'ko-KR' },
    { value: 'ko-KR-Neural2-C', label: 'Korean Male C (Neural2)', gender: 'MALE', lang: 'ko-KR' },
    { value: 'en-US-Neural2-A', label: 'English Female A (Neural2)', gender: 'FEMALE', lang: 'en-US' },
    { value: 'en-US-Neural2-C', label: 'English Female C (Neural2)', gender: 'FEMALE', lang: 'en-US' },
    { value: 'en-US-Neural2-D', label: 'English Male D (Neural2)', gender: 'MALE', lang: 'en-US' },
    // Standard voices (무료)
    { value: 'ko-KR-Standard-A', label: 'Korean Female A (Standard)', gender: 'FEMALE', lang: 'ko-KR' },
    { value: 'ko-KR-Standard-B', label: 'Korean Female B (Standard)', gender: 'FEMALE', lang: 'ko-KR' },
    { value: 'ko-KR-Standard-C', label: 'Korean Male C (Standard)', gender: 'MALE', lang: 'ko-KR' },
    { value: 'ko-KR-Standard-D', label: 'Korean Male D (Standard)', gender: 'MALE', lang: 'ko-KR' },
    { value: 'en-US-Standard-A', label: 'English Female A (Standard)', gender: 'FEMALE', lang: 'en-US' },
    { value: 'en-US-Standard-B', label: 'English Male B (Standard)', gender: 'MALE', lang: 'en-US' },
  ];

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

  useEffect(() => {
    setCurrentPage(1);
  }, [audios.length]);

  if (loading) {
    return <div className="loading">음성 목록을 불러오는 중...</div>;
  }

  return (
    <div className="store-management">
      <div className="store-header">
        <h1>TTS 음성 관리</h1>

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
            <FiSearch style={{
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
          <button onClick={() => setShowGenerateModal(true)} className="btn-add">
            + 음성생성
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
              <th>음성</th>
              <th>언어</th>
              <th>크기</th>
              <th>등록일</th>
              <th>등록자</th>
              <th>작업</th>
            </tr>
          </thead>
          <tbody>
            {currentAudios.length === 0 ? (
              <tr>
                <td colSpan="9" className="no-data">생성된 음성이 없습니다</td>
              </tr>
            ) : (
              currentAudios.map((audio) => (
                <tr key={audio.id}>
                  <td style={{textAlign: 'center', fontWeight: '600'}}>
                    {audio.id}
                  </td>
                  <td>
                    {audio.title || '-'}
                  </td>
                  <td style={{maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                    {audio.description || '-'}
                  </td>
                  <td>{audio.voiceName?.split('-').pop() || 'N/A'}</td>
                  <td>{audio.languageCode || 'N/A'}</td>
                  <td>{formatFileSize(audio.fileSize)}</td>
                  <td>{formatDate(audio.uploadedAt)}</td>
                  <td>{getUploaderName(audio)}</td>
                  <td>
                    <div className="action-buttons">
                      <button
                        onClick={() => handlePlay(audio)}
                        className="btn-play"
                        title="재생"
                        style={{marginRight: '8px'}}
                      >
                        <FiPlay />
                      </button>
                      <button
                        onClick={() => handleEdit(audio.id)}
                        className="btn-edit"
                        title="편집"
                        style={{marginRight: '8px'}}
                      >
                        <FiEdit />
                      </button>
                      <button
                        onClick={() => handleAddToVideo(audio)}
                        className="btn-secondary"
                        title="비디오에 추가"
                        style={{marginRight: '8px'}}
                      >
                        <FiPlusCircle />
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
        전체 {filteredAudios.length}개 음성 {filteredAudios.length > 0 && `(${currentPage} / ${totalPages} 페이지)`}
      </div>

      {/* Audio Player Modal */}
      {playingAudio && (
        <div className="video-modal" onClick={handleClosePlayer}>
          <div className="video-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={handleClosePlayer}>×</button>
            <h3>{playingAudio.title}</h3>
            <div style={{padding: '20px 0'}}>
              <p><strong>음성:</strong> {playingAudio.voiceName} ({playingAudio.gender})</p>
              <p><strong>언어:</strong> {playingAudio.languageCode}</p>
              <p><strong>속도:</strong> {playingAudio.speakingRate}x</p>
              <p><strong>피치:</strong> {playingAudio.pitch > 0 ? '+' : ''}{playingAudio.pitch}</p>
              <audio controls autoPlay src={playingAudio.s3Url} style={{width: '100%', marginTop: '15px'}} />
              {playingAudio.text && (
                <div style={{marginTop: '20px', padding: '15px', background: '#f7fafc', borderRadius: '4px'}}>
                  <p style={{margin: 0, color: '#2d3748', whiteSpace: 'pre-wrap'}}>{playingAudio.text}</p>
                </div>
              )}
              {playingAudio.description && (
                <p className="modal-description" style={{marginTop: '15px'}}>{playingAudio.description}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Generate Audio Modal */}
      {showGenerateModal && (
        <div className="video-modal" onClick={() => setShowGenerateModal(false)}>
          <div className="video-modal-content" onClick={(e) => e.stopPropagation()} style={{maxWidth: '700px', maxHeight: '90vh', overflow: 'auto'}}>
            <button className="modal-close" onClick={() => setShowGenerateModal(false)}>×</button>
            <h3>TTS 음성 생성</h3>
            <form onSubmit={handleGenerateAudio} style={{padding: '20px 0'}}>
              <div style={{marginBottom: '20px'}}>
                <label style={{display: 'block', marginBottom: '8px', fontWeight: '600', color: '#2d3748'}}>
                  텍스트 (최대 5000자) *
                </label>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  maxLength={5000}
                  rows={6}
                  required
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #cbd5e0',
                    borderRadius: '4px',
                    fontSize: '14px',
                    resize: 'vertical'
                  }}
                  placeholder="음성으로 변환할 텍스트를 입력하세요..."
                />
                <small style={{color: '#718096'}}>{text.length} / 5000 자</small>
              </div>

              <div style={{marginBottom: '20px'}}>
                <label style={{display: 'block', marginBottom: '8px', fontWeight: '600', color: '#2d3748'}}>
                  제목 *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #cbd5e0',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                  placeholder="음성 제목을 입력하세요"
                />
              </div>

              <div style={{marginBottom: '20px'}}>
                <label style={{display: 'block', marginBottom: '8px', fontWeight: '600', color: '#2d3748'}}>
                  설명
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #cbd5e0',
                    borderRadius: '4px',
                    fontSize: '14px',
                    resize: 'vertical'
                  }}
                  placeholder="음성 설명 (선택사항)"
                />
              </div>

              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px'}}>
                <div>
                  <label style={{display: 'block', marginBottom: '8px', fontWeight: '600', color: '#2d3748'}}>
                    언어
                  </label>
                  <select
                    value={languageCode}
                    onChange={(e) => setLanguageCode(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #cbd5e0',
                      borderRadius: '4px',
                      fontSize: '14px'
                    }}
                  >
                    <option value="ko-KR">한국어</option>
                    <option value="en-US">영어 (미국)</option>
                    <option value="ja-JP">일본어</option>
                    <option value="zh-CN">중국어</option>
                  </select>
                </div>

                <div>
                  <label style={{display: 'block', marginBottom: '8px', fontWeight: '600', color: '#2d3748'}}>
                    음성
                  </label>
                  <select
                    value={voiceName}
                    onChange={(e) => {
                      setVoiceName(e.target.value);
                      const selected = voiceOptions.find(v => v.value === e.target.value);
                      if (selected) {
                        setGender(selected.gender);
                        setLanguageCode(selected.lang);
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #cbd5e0',
                      borderRadius: '4px',
                      fontSize: '14px'
                    }}
                  >
                    {voiceOptions.filter(v => v.lang === languageCode).map(voice => (
                      <option key={voice.value} value={voice.value}>
                        {voice.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{marginBottom: '20px'}}>
                <label style={{display: 'block', marginBottom: '8px', fontWeight: '600', color: '#2d3748'}}>
                  속도: {speakingRate.toFixed(1)}x
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={speakingRate}
                  onChange={(e) => setSpeakingRate(parseFloat(e.target.value))}
                  style={{width: '100%'}}
                />
                <small style={{color: '#718096'}}>0.5x (느리게) - 2.0x (빠르게)</small>
              </div>

              <div style={{marginBottom: '20px'}}>
                <label style={{display: 'block', marginBottom: '8px', fontWeight: '600', color: '#2d3748'}}>
                  피치: {pitch > 0 ? '+' : ''}{pitch.toFixed(1)}
                </label>
                <input
                  type="range"
                  min="-20"
                  max="20"
                  step="1"
                  value={pitch}
                  onChange={(e) => setPitch(parseFloat(e.target.value))}
                  style={{width: '100%'}}
                />
                <small style={{color: '#718096'}}>-20 (낮음) - +20 (높음)</small>
              </div>

              <div style={{display: 'flex', gap: '10px', justifyContent: 'flex-end'}}>
                <button
                  type="button"
                  onClick={() => setShowGenerateModal(false)}
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
                  type="submit"
                  disabled={generating || !text || !title}
                  style={{
                    padding: '10px 20px',
                    border: 'none',
                    borderRadius: '4px',
                    background: generating || !text || !title ? '#cbd5e0' : '#667eea',
                    color: '#fff',
                    cursor: generating || !text || !title ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  {generating ? '생성 중...' : '음성 생성'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Audio to Video Modal */}
      {showAddToVideoModal && (
        <div className="video-modal" onClick={handleCloseAddToVideoModal}>
          <div className="video-modal-content" onClick={(e) => e.stopPropagation()} style={{maxWidth: '600px'}}>
            <button className="modal-close" onClick={handleCloseAddToVideoModal}>×</button>
            <h3>비디오에 음성 추가</h3>
            <form onSubmit={handleAddAudioToVideo} style={{padding: '20px 0'}}>
              {selectedAudio && (
                <div style={{marginBottom: '20px', padding: '15px', background: '#f7fafc', borderRadius: '4px'}}>
                  <label style={{display: 'block', marginBottom: '8px', fontWeight: '600', color: '#2d3748'}}>
                    선택된 음성
                  </label>
                  <div style={{marginBottom: '10px', fontSize: '14px', color: '#4a5568'}}>
                    <strong>{selectedAudio.title}</strong> ({selectedAudio.voiceName})
                  </div>
                  <audio controls src={selectedAudio.s3Url} style={{width: '100%'}} />
                </div>
              )}

              <div style={{marginBottom: '20px'}}>
                <label style={{display: 'block', marginBottom: '8px', fontWeight: '600', color: '#2d3748'}}>
                  비디오 선택 *
                </label>
                <select
                  value={selectedVideo?.id || ''}
                  onChange={(e) => {
                    const video = videos.find(v => v.id === parseInt(e.target.value));
                    setSelectedVideo(video);
                  }}
                  required
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #cbd5e0',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                >
                  <option value="">-- 비디오를 선택하세요 --</option>
                  {videos.map(video => (
                    <option key={video.id} value={video.id}>
                      {video.title || video.filename}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{marginBottom: '20px'}}>
                <label style={{display: 'block', marginBottom: '8px', fontWeight: '600', color: '#2d3748'}}>
                  오디오 모드
                </label>
                <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
                  <label style={{display: 'flex', alignItems: 'center', cursor: 'pointer'}}>
                    <input
                      type="radio"
                      checked={replaceAudio}
                      onChange={() => setReplaceAudio(true)}
                      style={{marginRight: '8px'}}
                    />
                    기존 오디오 교체
                  </label>
                  <label style={{display: 'flex', alignItems: 'center', cursor: 'pointer'}}>
                    <input
                      type="radio"
                      checked={!replaceAudio}
                      onChange={() => setReplaceAudio(false)}
                      style={{marginRight: '8px'}}
                    />
                    기존 오디오와 믹싱
                  </label>
                </div>
              </div>

              <div style={{display: 'flex', gap: '10px', justifyContent: 'flex-end'}}>
                <button
                  type="button"
                  onClick={() => setShowAddToVideoModal(false)}
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
                  type="submit"
                  disabled={addingToVideo || !selectedAudio || !selectedVideo}
                  style={{
                    padding: '10px 20px',
                    border: 'none',
                    borderRadius: '4px',
                    background: addingToVideo || !selectedAudio || !selectedVideo ? '#cbd5e0' : '#667eea',
                    color: '#fff',
                    cursor: addingToVideo || !selectedAudio || !selectedVideo ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  {addingToVideo ? '처리 중...' : '비디오에 추가'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
