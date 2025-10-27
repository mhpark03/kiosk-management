import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import videoService from '../services/videoService';
import ttsService from '../services/ttsService';
import './VideoGenerator.css';

export default function AudioGenerator() {
  const { token } = useAuth(); // Used for checking authentication

  // TTS Form State
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [languageCode, setLanguageCode] = useState('ko-KR');
  const [voiceName, setVoiceName] = useState('ko-KR-Standard-A');
  const [gender, setGender] = useState('FEMALE');
  const [speakingRate, setSpeakingRate] = useState(1.0);
  const [pitch, setPitch] = useState(0.0);

  // Audio List
  const [audios, setAudios] = useState([]);
  const [selectedAudio, setSelectedAudio] = useState(null);

  // Video Selection for Audio Addition
  const [videos, setVideos] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [replaceAudio, setReplaceAudio] = useState(true);

  // UI State
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('generate'); // 'generate' or 'addToVideo'

  useEffect(() => {
    if (token) {
      loadAudios();
      loadVideos();
    }
  }, [token]);

  const loadAudios = async () => {
    try {
      const data = await ttsService.getAllAudios();
      setAudios(data);
    } catch (err) {
      console.error('Failed to load audios:', err);
    }
  };

  const loadVideos = async () => {
    try {
      const allVideos = await videoService.getAllVideos();
      setVideos(allVideos);
    } catch (err) {
      console.error('Failed to load videos:', err);
    }
  };

  const handleGenerateAudio = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

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

      setMessage(`Audio generated successfully: ${data.audio.title}`);
      setSelectedAudio(data.audio);

      // Reset form
      setText('');
      setTitle('');
      setDescription('');

      // Reload audio list
      loadAudios();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAudioToVideo = async (e) => {
    e.preventDefault();
    if (!selectedAudio || !selectedVideo) {
      setError('Please select both audio and video');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const data = await ttsService.addAudioToVideo(
        selectedVideo.id,
        selectedAudio.id,
        `${selectedVideo.title} + ${selectedAudio.title}`,
        `Video with TTS audio: ${selectedAudio.title}`,
        replaceAudio
      );

      setMessage(`Audio added to video successfully: ${data.video.title}`);

      // Reset selections
      setSelectedVideo(null);

      // Reload videos
      loadVideos();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAudio = async (audioId) => {
    if (!confirm('Are you sure you want to delete this audio?')) return;

    try {
      await ttsService.deleteAudio(audioId);
      setMessage('Audio deleted successfully');
      loadAudios();
      if (selectedAudio?.id === audioId) {
        setSelectedAudio(null);
      }
    } catch (err) {
      setError(err.message || 'Failed to delete audio');
    }
  };

  const voiceOptions = [
    // Standard voices (무료: 월 1백만 자)
    { value: 'ko-KR-Standard-A', label: 'Korean Female A (Standard - 무료)', gender: 'FEMALE' },
    { value: 'ko-KR-Standard-B', label: 'Korean Female B (Standard - 무료)', gender: 'FEMALE' },
    { value: 'ko-KR-Standard-C', label: 'Korean Male C (Standard - 무료)', gender: 'MALE' },
    { value: 'ko-KR-Standard-D', label: 'Korean Male D (Standard - 무료)', gender: 'MALE' },
    { value: 'en-US-Standard-A', label: 'English Female A (Standard - 무료)', gender: 'FEMALE' },
    { value: 'en-US-Standard-B', label: 'English Male B (Standard - 무료)', gender: 'MALE' },
    { value: 'en-US-Standard-C', label: 'English Female C (Standard - 무료)', gender: 'FEMALE' },
    { value: 'en-US-Standard-D', label: 'English Male D (Standard - 무료)', gender: 'MALE' },
    // Neural2 voices (고품질, 무료: 월 4백만 자)
    { value: 'ko-KR-Neural2-A', label: 'Korean Female A (Neural2 - 고품질)', gender: 'FEMALE' },
    { value: 'ko-KR-Neural2-B', label: 'Korean Female B (Neural2 - 고품질)', gender: 'FEMALE' },
    { value: 'ko-KR-Neural2-C', label: 'Korean Male C (Neural2 - 고품질)', gender: 'MALE' },
    { value: 'en-US-Neural2-A', label: 'English Female A (Neural2 - 고품질)', gender: 'FEMALE' },
    { value: 'en-US-Neural2-C', label: 'English Female C (Neural2 - 고품질)', gender: 'FEMALE' },
    { value: 'en-US-Neural2-D', label: 'English Male D (Neural2 - 고품질)', gender: 'MALE' },
  ];

  return (
    <div className="generator-container">
      <h1>TTS Audio Generator</h1>

      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button
          className={activeTab === 'generate' ? 'active' : ''}
          onClick={() => setActiveTab('generate')}
        >
          Generate Audio
        </button>
        <button
          className={activeTab === 'addToVideo' ? 'active' : ''}
          onClick={() => setActiveTab('addToVideo')}
        >
          Add Audio to Video
        </button>
      </div>

      {/* Messages */}
      {message && <div className="message success">{message}</div>}
      {error && <div className="message error">{error}</div>}

      {/* Generate Audio Tab */}
      {activeTab === 'generate' && (
        <div className="tab-content">
          <form onSubmit={handleGenerateAudio} className="generator-form">
            <div className="form-group">
              <label>Text (max 5000 characters) *</label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Enter text to convert to speech..."
                maxLength={5000}
                rows={6}
                required
              />
              <small>{text.length} / 5000 characters</small>
            </div>

            <div className="form-group">
              <label>Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Audio title"
                required
              />
            </div>

            <div className="form-group">
              <label>Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Audio description (optional)"
                rows={3}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Language</label>
                <select
                  value={languageCode}
                  onChange={(e) => setLanguageCode(e.target.value)}
                >
                  <option value="ko-KR">Korean (ko-KR)</option>
                  <option value="en-US">English US (en-US)</option>
                  <option value="ja-JP">Japanese (ja-JP)</option>
                  <option value="zh-CN">Chinese (zh-CN)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Voice</label>
                <select
                  value={voiceName}
                  onChange={(e) => {
                    setVoiceName(e.target.value);
                    const selected = voiceOptions.find(v => v.value === e.target.value);
                    if (selected) setGender(selected.gender);
                  }}
                >
                  {voiceOptions.map(voice => (
                    <option key={voice.value} value={voice.value}>
                      {voice.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Speaking Rate: {speakingRate.toFixed(1)}x</label>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={speakingRate}
                  onChange={(e) => setSpeakingRate(parseFloat(e.target.value))}
                />
                <small>0.5x (slow) - 2.0x (fast)</small>
              </div>

              <div className="form-group">
                <label>Pitch: {pitch > 0 ? '+' : ''}{pitch.toFixed(1)}</label>
                <input
                  type="range"
                  min="-20"
                  max="20"
                  step="1"
                  value={pitch}
                  onChange={(e) => setPitch(parseFloat(e.target.value))}
                />
                <small>-20 (low) - +20 (high)</small>
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary"
              disabled={loading || !text || !title}
            >
              {loading ? 'Generating...' : 'Generate Audio'}
            </button>
          </form>

          {/* Audio Preview */}
          {selectedAudio && (
            <div className="preview-section">
              <h3>Generated Audio</h3>
              <div className="audio-preview">
                <p><strong>Title:</strong> {selectedAudio.title}</p>
                <p><strong>Voice:</strong> {selectedAudio.voiceName} ({selectedAudio.gender})</p>
                <p><strong>Language:</strong> {selectedAudio.languageCode}</p>
                <audio controls src={selectedAudio.s3Url} className="audio-player" />
                <div className="preview-actions">
                  <a
                    href={selectedAudio.s3Url}
                    download={selectedAudio.filename}
                    className="btn-secondary"
                  >
                    Download
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Audio List */}
          <div className="list-section">
            <h3>Generated Audios ({audios.length})</h3>
            <div className="audio-grid">
              {audios.map(audio => (
                <div key={audio.id} className="audio-card">
                  <h4>{audio.title}</h4>
                  <p className="audio-info">
                    <span>{audio.voiceName}</span>
                    <span>{audio.languageCode}</span>
                  </p>
                  <p className="audio-text">{audio.text?.substring(0, 100)}...</p>
                  <audio controls src={audio.s3Url} className="audio-player-small" />
                  <div className="card-actions">
                    <button
                      onClick={() => setSelectedAudio(audio)}
                      className="btn-secondary-small"
                    >
                      Select
                    </button>
                    <button
                      onClick={() => handleDeleteAudio(audio.id)}
                      className="btn-danger-small"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Add Audio to Video Tab */}
      {activeTab === 'addToVideo' && (
        <div className="tab-content">
          <form onSubmit={handleAddAudioToVideo} className="generator-form">
            <div className="form-group">
              <label>Select Audio *</label>
              <select
                value={selectedAudio?.id || ''}
                onChange={(e) => {
                  const audio = audios.find(a => a.id === parseInt(e.target.value));
                  setSelectedAudio(audio);
                }}
                required
              >
                <option value="">-- Choose Audio --</option>
                {audios.map(audio => (
                  <option key={audio.id} value={audio.id}>
                    {audio.title} ({audio.voiceName})
                  </option>
                ))}
              </select>
            </div>

            {selectedAudio && (
              <div className="audio-preview-inline">
                <audio controls src={selectedAudio.s3Url} className="audio-player" />
              </div>
            )}

            <div className="form-group">
              <label>Select Video *</label>
              <select
                value={selectedVideo?.id || ''}
                onChange={(e) => {
                  const video = videos.find(v => v.id === parseInt(e.target.value));
                  setSelectedVideo(video);
                }}
                required
              >
                <option value="">-- Choose Video --</option>
                {videos.map(video => (
                  <option key={video.id} value={video.id}>
                    {video.title || video.filename}
                  </option>
                ))}
              </select>
            </div>

            {selectedVideo && (
              <div className="video-preview-inline">
                <video
                  src={selectedVideo.s3Url}
                  controls
                  className="video-player-small"
                />
              </div>
            )}

            <div className="form-group">
              <label>Audio Mode</label>
              <div className="radio-group">
                <label>
                  <input
                    type="radio"
                    checked={replaceAudio}
                    onChange={() => setReplaceAudio(true)}
                  />
                  Replace existing audio
                </label>
                <label>
                  <input
                    type="radio"
                    checked={!replaceAudio}
                    onChange={() => setReplaceAudio(false)}
                  />
                  Mix with existing audio
                </label>
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary"
              disabled={loading || !selectedAudio || !selectedVideo}
            >
              {loading ? 'Processing...' : 'Add Audio to Video'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
