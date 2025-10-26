import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import videoService from '../services/videoService';

function VideoMerger() {
  const navigate = useNavigate();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [selectedVideo1, setSelectedVideo1] = useState(null);
  const [selectedVideo2, setSelectedVideo2] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [transitionType, setTransitionType] = useState('concat');
  const [transitionDuration, setTransitionDuration] = useState(1);
  const [outputQuality, setOutputQuality] = useState('medium');

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
      setError(err.message || '비디오 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleMerge = async (e) => {
    e.preventDefault();

    if (!selectedVideo1 || !selectedVideo2) {
      setError('두 개의 비디오를 선택해주세요.');
      return;
    }

    if (selectedVideo1.id === selectedVideo2.id) {
      setError('서로 다른 비디오를 선택해주세요.');
      return;
    }

    if (!title.trim() || !description.trim()) {
      setError('제목과 설명을 입력해주세요.');
      return;
    }

    try {
      setProcessing(true);
      setError('');
      setSuccess('');

      const response = await videoService.mergeVideos(
        selectedVideo1.id,
        selectedVideo2.id,
        title,
        description,
        transitionType,
        transitionDuration,
        outputQuality
      );

      setSuccess('비디오 병합이 완료되었습니다!');

      // Reset form
      setSelectedVideo1(null);
      setSelectedVideo2(null);
      setTitle('');
      setDescription('');
      setTransitionType('concat');
      setTransitionDuration(1);
      setOutputQuality('medium');

      // Reload videos to show the merged one
      setTimeout(() => {
        loadVideos();
        setSuccess('');
      }, 2000);
    } catch (err) {
      setError(err.message || '비디오 병합에 실패했습니다.');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="container" style={{ marginTop: '80px', textAlign: 'center' }}>
        <h2>비디오 로딩 중...</h2>
      </div>
    );
  }

  return (
    <div className="container" style={{ marginTop: '80px', padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>비디오 병합</h2>
        <button
          onClick={() => navigate('/videos')}
          style={{
            padding: '10px 20px',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          비디오 목록으로
        </button>
      </div>

      {error && (
        <div
          style={{
            padding: '15px',
            marginBottom: '20px',
            backgroundColor: '#f8d7da',
            color: '#721c24',
            borderRadius: '4px',
            border: '1px solid #f5c6cb',
          }}
        >
          {error}
        </div>
      )}

      {success && (
        <div
          style={{
            padding: '15px',
            marginBottom: '20px',
            backgroundColor: '#d4edda',
            color: '#155724',
            borderRadius: '4px',
            border: '1px solid #c3e6cb',
          }}
        >
          {success}
        </div>
      )}

      <form onSubmit={handleMerge}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
          {/* Video 1 Selection */}
          <div>
            <h3>첫 번째 비디오</h3>
            <select
              value={selectedVideo1?.id || ''}
              onChange={(e) => {
                const video = videos.find(v => v.id === Number(e.target.value));
                setSelectedVideo1(video);
              }}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '4px',
                border: '1px solid #ddd',
                marginBottom: '10px',
              }}
              disabled={processing}
            >
              <option value="">비디오를 선택하세요</option>
              {videos.map((video) => (
                <option key={video.id} value={video.id}>
                  {video.title || video.originalFilename}
                </option>
              ))}
            </select>
            {selectedVideo1 && (
              <div
                style={{
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  backgroundColor: '#f8f9fa',
                }}
              >
                <p><strong>제목:</strong> {selectedVideo1.title}</p>
                <p><strong>파일명:</strong> {selectedVideo1.originalFilename}</p>
                <p><strong>크기:</strong> {videoService.formatFileSize(selectedVideo1.fileSize)}</p>
              </div>
            )}
          </div>

          {/* Video 2 Selection */}
          <div>
            <h3>두 번째 비디오</h3>
            <select
              value={selectedVideo2?.id || ''}
              onChange={(e) => {
                const video = videos.find(v => v.id === Number(e.target.value));
                setSelectedVideo2(video);
              }}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '4px',
                border: '1px solid #ddd',
                marginBottom: '10px',
              }}
              disabled={processing}
            >
              <option value="">비디오를 선택하세요</option>
              {videos.map((video) => (
                <option key={video.id} value={video.id}>
                  {video.title || video.originalFilename}
                </option>
              ))}
            </select>
            {selectedVideo2 && (
              <div
                style={{
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  backgroundColor: '#f8f9fa',
                }}
              >
                <p><strong>제목:</strong> {selectedVideo2.title}</p>
                <p><strong>파일명:</strong> {selectedVideo2.originalFilename}</p>
                <p><strong>크기:</strong> {videoService.formatFileSize(selectedVideo2.fileSize)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Merge Settings */}
        <div style={{ marginBottom: '20px', padding: '20px', border: '1px solid #ddd', borderRadius: '4px' }}>
          <h3>병합 설정</h3>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              제목
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="병합된 비디오의 제목을 입력하세요"
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '4px',
                border: '1px solid #ddd',
              }}
              disabled={processing}
              required
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              설명
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="병합된 비디오의 설명을 입력하세요"
              rows={3}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '4px',
                border: '1px solid #ddd',
                resize: 'vertical',
              }}
              disabled={processing}
              required
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              전환 효과
            </label>
            <select
              value={transitionType}
              onChange={(e) => setTransitionType(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '4px',
                border: '1px solid #ddd',
              }}
              disabled={processing}
            >
              <option value="concat">단순 연결 (전환 효과 없음)</option>
              <option value="fade">페이드 (Fade Out/In)</option>
              <option value="xfade">크로스페이드 (Crossfade)</option>
            </select>
          </div>

          {(transitionType === 'fade' || transitionType === 'xfade') && (
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                전환 시간 (초)
              </label>
              <input
                type="number"
                value={transitionDuration}
                onChange={(e) => setTransitionDuration(Number(e.target.value))}
                min="0.5"
                max="5"
                step="0.5"
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '4px',
                  border: '1px solid #ddd',
                }}
                disabled={processing}
              />
            </div>
          )}

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              출력 품질
            </label>
            <select
              value={outputQuality}
              onChange={(e) => setOutputQuality(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '4px',
                border: '1px solid #ddd',
              }}
              disabled={processing}
            >
              <option value="low">낮음 (1 Mbps)</option>
              <option value="medium">중간 (4 Mbps)</option>
              <option value="high">높음 (8 Mbps)</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={processing || !selectedVideo1 || !selectedVideo2}
          style={{
            padding: '15px 30px',
            backgroundColor: processing ? '#6c757d' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: processing ? 'not-allowed' : 'pointer',
            fontSize: '16px',
            fontWeight: 'bold',
            width: '100%',
          }}
        >
          {processing ? '병합 중... (서버에서 처리 중입니다)' : '비디오 병합'}
        </button>
      </form>

      {processing && (
        <div
          style={{
            marginTop: '20px',
            padding: '20px',
            backgroundColor: '#e7f3ff',
            borderRadius: '4px',
            textAlign: 'center',
          }}
        >
          <p style={{ margin: 0, fontSize: '14px', color: '#004085' }}>
            서버에서 비디오를 병합하고 있습니다. 비디오 크기에 따라 시간이 걸릴 수 있습니다.
          </p>
        </div>
      )}
    </div>
  );
}

export default VideoMerger;
