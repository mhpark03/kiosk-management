import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import videoService from '../services/videoService';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { FiArrowLeft, FiPlay, FiDownload, FiLoader } from 'react-icons/fi';
import './VideoManagement.css';

function VideoMerger() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const ffmpegRef = useRef(new FFmpeg());
  const [loaded, setLoaded] = useState(false);
  const [videos, setVideos] = useState([]);
  const [selectedVideo1, setSelectedVideo1] = useState(null);
  const [selectedVideo2, setSelectedVideo2] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [transitionType, setTransitionType] = useState('concat'); // concat, fade, xfade
  const [transitionDuration, setTransitionDuration] = useState(1); // seconds
  const [outputQuality, setOutputQuality] = useState('medium'); // low, medium, high
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [mergedVideoUrl, setMergedVideoUrl] = useState(null);
  const [mergedVideoBlob, setMergedVideoBlob] = useState(null);

  useEffect(() => {
    loadFFmpeg();
    loadVideos();
  }, []);

  const loadFFmpeg = async () => {
    try {
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
      const ffmpeg = ffmpegRef.current;

      ffmpeg.on('log', ({ message }) => {
        console.log('FFmpeg:', message);
      });

      ffmpeg.on('progress', ({ progress: prog, time }) => {
        const percent = Math.round(prog * 100);
        setProgress(percent);
        setProgressMessage(`처리 중... ${percent}%`);
      });

      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });

      setLoaded(true);
      console.log('FFmpeg loaded successfully');
    } catch (err) {
      console.error('Failed to load FFmpeg:', err);
      setError('FFmpeg 로딩 실패. 페이지를 새로고침해주세요.');
    }
  };

  const loadVideos = async () => {
    try {
      const response = await videoService.getAllVideos();
      // Filter only VIDEO type media
      const videoList = response.filter(v => v.mediaType === 'VIDEO');
      setVideos(videoList);
    } catch (err) {
      console.error('Failed to load videos:', err);
      setError('비디오 목록을 불러오지 못했습니다.');
    }
  };

  const getQualitySettings = () => {
    switch (outputQuality) {
      case 'low':
        return { bitrate: '1M', crf: '28' };
      case 'high':
        return { bitrate: '8M', crf: '18' };
      default: // medium
        return { bitrate: '4M', crf: '23' };
    }
  };

  const downloadVideo = async (videoId, videoUrl) => {
    try {
      setProgressMessage(`비디오 ${videoId} 다운로드 중...`);
      // Get download URL from backend
      const downloadUrl = await videoService.getDownloadUrl(videoId);

      // Fetch video file
      const response = await fetch(downloadUrl);
      if (!response.ok) {
        throw new Error('비디오 다운로드 실패');
      }

      return await response.blob();
    } catch (err) {
      console.error('Failed to download video:', err);
      throw new Error(`비디오 다운로드 실패: ${err.message}`);
    }
  };

  const mergeVideos = async () => {
    if (!loaded) {
      setError('FFmpeg가 아직 로드되지 않았습니다. 잠시만 기다려주세요.');
      return;
    }

    if (!selectedVideo1 || !selectedVideo2) {
      setError('병합할 두 개의 비디오를 선택해주세요.');
      return;
    }

    if (!title || title.trim() === '') {
      setError('제목을 입력해주세요.');
      return;
    }

    if (!description || description.trim() === '') {
      setError('설명을 입력해주세요.');
      return;
    }

    try {
      setProcessing(true);
      setError('');
      setSuccess('');
      setProgress(0);
      setProgressMessage('비디오 병합 준비 중...');

      const ffmpeg = ffmpegRef.current;

      // Download videos
      setProgress(10);
      const video1Blob = await downloadVideo(selectedVideo1.videoId, selectedVideo1.videoUrl);

      setProgress(20);
      const video2Blob = await downloadVideo(selectedVideo2.videoId, selectedVideo2.videoUrl);

      // Write videos to FFmpeg file system
      setProgress(30);
      setProgressMessage('비디오 파일 준비 중...');
      await ffmpeg.writeFile('video1.mp4', await fetchFile(video1Blob));
      await ffmpeg.writeFile('video2.mp4', await fetchFile(video2Blob));

      setProgress(40);
      setProgressMessage('비디오 병합 중...');

      const quality = getQualitySettings();
      let ffmpegArgs = [];

      if (transitionType === 'concat') {
        // Simple concatenation (no transition)
        await ffmpeg.writeFile('concat_list.txt', 'file video1.mp4\nfile video2.mp4');
        ffmpegArgs = [
          '-f', 'concat',
          '-safe', '0',
          '-i', 'concat_list.txt',
          '-c:v', 'libx264',
          '-b:v', quality.bitrate,
          '-c:a', 'aac',
          '-b:a', '192k',
          '-y',
          'output.mp4'
        ];
      } else if (transitionType === 'fade') {
        // Fade transition
        const duration = transitionDuration;
        ffmpegArgs = [
          '-i', 'video1.mp4',
          '-i', 'video2.mp4',
          '-filter_complex',
          `[0:v]fade=t=out:st=0:d=${duration}[v0];[1:v]fade=t=in:st=0:d=${duration}[v1];[v0][0:a][v1][1:a]concat=n=2:v=1:a=1[outv][outa]`,
          '-map', '[outv]',
          '-map', '[outa]',
          '-c:v', 'libx264',
          '-b:v', quality.bitrate,
          '-c:a', 'aac',
          '-b:a', '192k',
          '-y',
          'output.mp4'
        ];
      } else if (transitionType === 'xfade') {
        // Crossfade transition
        const duration = transitionDuration;
        ffmpegArgs = [
          '-i', 'video1.mp4',
          '-i', 'video2.mp4',
          '-filter_complex',
          `[0:v][1:v]xfade=transition=fade:duration=${duration}:offset=0[outv];[0:a][1:a]acrossfade=d=${duration}[outa]`,
          '-map', '[outv]',
          '-map', '[outa]',
          '-c:v', 'libx264',
          '-b:v', quality.bitrate,
          '-c:a', 'aac',
          '-b:a', '192k',
          '-y',
          'output.mp4'
        ];
      }

      console.log('FFmpeg command:', ffmpegArgs.join(' '));
      await ffmpeg.exec(ffmpegArgs);

      setProgress(90);
      setProgressMessage('결과 파일 준비 중...');

      // Read the output file
      const data = await ffmpeg.readFile('output.mp4');
      const blob = new Blob([data.buffer], { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);

      setMergedVideoUrl(url);
      setMergedVideoBlob(blob);
      setProgress(100);
      setProgressMessage('병합 완료!');
      setSuccess('비디오 병합이 완료되었습니다. 미리보기 후 저장할 수 있습니다.');

      // Clean up FFmpeg file system
      await ffmpeg.deleteFile('video1.mp4');
      await ffmpeg.deleteFile('video2.mp4');
      await ffmpeg.deleteFile('output.mp4');
      if (transitionType === 'concat') {
        await ffmpeg.deleteFile('concat_list.txt');
      }

      setProcessing(false);
    } catch (err) {
      console.error('Merge error:', err);
      setError(`병합 실패: ${err.message}`);
      setProcessing(false);
      setProgress(0);
      setProgressMessage('');
    }
  };

  const uploadMergedVideo = async () => {
    if (!mergedVideoBlob) {
      setError('업로드할 병합된 비디오가 없습니다.');
      return;
    }

    try {
      setProcessing(true);
      setError('');
      setSuccess('');
      setProgressMessage('서버에 업로드 중...');

      // Create File object from Blob
      const file = new File([mergedVideoBlob], 'merged_video.mp4', { type: 'video/mp4' });

      // Upload using videoService
      await videoService.uploadVideo(file, title, description);

      setSuccess('병합된 비디오가 성공적으로 업로드되었습니다.');

      // Redirect to video list after 2 seconds
      setTimeout(() => {
        navigate('/videos');
      }, 2000);
    } catch (err) {
      console.error('Upload error:', err);
      setError(`업로드 실패: ${err.message}`);
      setProcessing(false);
    }
  };

  const handleCancel = () => {
    if (mergedVideoUrl) {
      URL.revokeObjectURL(mergedVideoUrl);
    }
    navigate('/videos');
  };

  const downloadMergedVideo = () => {
    if (!mergedVideoUrl) return;

    const a = document.createElement('a');
    a.href = mergedVideoUrl;
    a.download = `${title || 'merged_video'}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="video-management">
      <div className="video-header">
        <button onClick={handleCancel} className="btn btn-back">
          <FiArrowLeft className="icon" /> 목록으로
        </button>
        <h1>비디오 병합</h1>
        <p className="video-subtitle">두 개의 비디오를 하나로 합칩니다</p>
      </div>

      {!loaded && (
        <div className="alert alert-info">
          <FiLoader className="icon-spin" /> FFmpeg 로딩 중... 잠시만 기다려주세요.
        </div>
      )}

      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      {success && (
        <div className="alert alert-success">
          {success}
        </div>
      )}

      <div className="video-content">
        <div className="video-form-card">
          <h2>비디오 선택</h2>

          <div className="form-group">
            <label>첫 번째 비디오</label>
            <select
              value={selectedVideo1?.videoId || ''}
              onChange={(e) => {
                const video = videos.find(v => v.videoId === parseInt(e.target.value));
                setSelectedVideo1(video);
              }}
              disabled={processing}
              className="form-control"
            >
              <option value="">비디오를 선택하세요</option>
              {videos.map(video => (
                <option key={video.videoId} value={video.videoId}>
                  {video.title} ({video.videoType === 'RUNWAY_GENERATED' ? 'AI 생성' : '업로드'})
                </option>
              ))}
            </select>
          </div>

          {selectedVideo1 && (
            <div className="video-preview">
              <video
                src={selectedVideo1.videoUrl}
                controls
                style={{ width: '100%', maxHeight: '300px' }}
              />
            </div>
          )}

          <div className="form-group">
            <label>두 번째 비디오</label>
            <select
              value={selectedVideo2?.videoId || ''}
              onChange={(e) => {
                const video = videos.find(v => v.videoId === parseInt(e.target.value));
                setSelectedVideo2(video);
              }}
              disabled={processing}
              className="form-control"
            >
              <option value="">비디오를 선택하세요</option>
              {videos.map(video => (
                <option key={video.videoId} value={video.videoId}>
                  {video.title} ({video.videoType === 'RUNWAY_GENERATED' ? 'AI 생성' : '업로드'})
                </option>
              ))}
            </select>
          </div>

          {selectedVideo2 && (
            <div className="video-preview">
              <video
                src={selectedVideo2.videoUrl}
                controls
                style={{ width: '100%', maxHeight: '300px' }}
              />
            </div>
          )}
        </div>

        <div className="video-form-card">
          <h2>병합 옵션</h2>

          <div className="form-group">
            <label>전환 효과</label>
            <select
              value={transitionType}
              onChange={(e) => setTransitionType(e.target.value)}
              disabled={processing}
              className="form-control"
            >
              <option value="concat">없음 (단순 연결)</option>
              <option value="fade">페이드 (Fade)</option>
              <option value="xfade">크로스페이드 (Crossfade)</option>
            </select>
            <small className="form-text">
              {transitionType === 'concat' && '두 비디오를 바로 이어붙입니다.'}
              {transitionType === 'fade' && '첫 번째 비디오가 페이드 아웃되고 두 번째 비디오가 페이드 인됩니다.'}
              {transitionType === 'xfade' && '두 비디오가 자연스럽게 크로스페이드됩니다.'}
            </small>
          </div>

          {transitionType !== 'concat' && (
            <div className="form-group">
              <label>전환 시간 (초)</label>
              <input
                type="number"
                min="0.5"
                max="5"
                step="0.5"
                value={transitionDuration}
                onChange={(e) => setTransitionDuration(parseFloat(e.target.value))}
                disabled={processing}
                className="form-control"
              />
              <small className="form-text">전환 효과의 지속 시간 (0.5초 ~ 5초)</small>
            </div>
          )}

          <div className="form-group">
            <label>출력 품질</label>
            <select
              value={outputQuality}
              onChange={(e) => setOutputQuality(e.target.value)}
              disabled={processing}
              className="form-control"
            >
              <option value="low">낮음 (빠름, 작은 파일)</option>
              <option value="medium">중간 (권장)</option>
              <option value="high">높음 (느림, 큰 파일)</option>
            </select>
            <small className="form-text">
              {outputQuality === 'low' && '비트레이트: 1Mbps - 빠른 처리, 작은 파일 크기'}
              {outputQuality === 'medium' && '비트레이트: 4Mbps - 균형잡힌 품질과 크기'}
              {outputQuality === 'high' && '비트레이트: 8Mbps - 최고 품질, 큰 파일 크기'}
            </small>
          </div>
        </div>

        <div className="video-form-card">
          <h2>병합 결과 정보</h2>

          <div className="form-group">
            <label>제목 *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="병합된 비디오의 제목"
              disabled={processing}
              className="form-control"
            />
          </div>

          <div className="form-group">
            <label>설명 *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="병합된 비디오에 대한 설명"
              disabled={processing}
              className="form-control"
              rows="3"
            />
          </div>
        </div>

        {processing && (
          <div className="video-form-card">
            <h2>진행 상황</h2>
            <div className="progress-container">
              <div className="progress-bar" style={{ width: `${progress}%` }}>
                {progress}%
              </div>
            </div>
            <p className="progress-message">{progressMessage}</p>
          </div>
        )}

        {mergedVideoUrl && (
          <div className="video-form-card">
            <h2>병합 결과 미리보기</h2>
            <div className="video-preview">
              <video
                src={mergedVideoUrl}
                controls
                style={{ width: '100%', maxHeight: '500px' }}
              />
            </div>
            <div className="form-actions" style={{ marginTop: '1rem' }}>
              <button
                onClick={downloadMergedVideo}
                className="btn btn-secondary"
              >
                <FiDownload className="icon" /> 다운로드
              </button>
              <button
                onClick={uploadMergedVideo}
                className="btn btn-primary"
                disabled={processing}
              >
                <FiPlay className="icon" /> 서버에 저장
              </button>
            </div>
          </div>
        )}

        {!mergedVideoUrl && (
          <div className="form-actions">
            <button
              onClick={handleCancel}
              className="btn btn-secondary"
              disabled={processing}
            >
              취소
            </button>
            <button
              onClick={mergeVideos}
              className="btn btn-primary"
              disabled={processing || !loaded}
            >
              {processing ? (
                <>
                  <FiLoader className="icon-spin" /> 처리 중...
                </>
              ) : (
                '비디오 병합'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default VideoMerger;
