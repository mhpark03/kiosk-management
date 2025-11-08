import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  updateKiosk,
  checkKioskDuplicate,
  getKioskConfig,
  updateKioskConfigFromWeb
} from '../services/kioskService';
import { logKioskUpdate } from '../services/kioskHistoryService';
import { getAllStores } from '../services/storeService';
import { Timestamp } from 'firebase/firestore';
import { FiEdit, FiVideo, FiSettings } from 'react-icons/fi';
import './KioskEdit.css';
import { formatKSTDate } from '../utils/dateUtils';
import KioskVideoManagement from './KioskVideoManagement';

function KioskEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [kiosk, setKiosk] = useState(null);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeView, setActiveView] = useState('edit'); // 'edit' | 'videos' | 'config'

  const [formData, setFormData] = useState({
    posid: '',
    kioskno: '',
    maker: '',
    serialno: '',
    state: 'preparing',
    regdate: '',
    setdate: '',
    deldate: '',
    storeRegdate: '',
    storeMinDate: ''
  });

  const [kioskConfig, setKioskConfig] = useState({
    downloadPath: '',
    apiUrl: '',
    autoSync: false,
    syncInterval: 12,
    lastSync: null
  });

  useEffect(() => {
    loadKioskData();
    loadStores();
  }, [id]);

  const loadKioskData = async () => {
    try {
      setLoading(true);
      // Get kiosk from location state
      const kioskData = window.history.state?.usr?.kiosk;
      if (!kioskData) {
        alert('키오스크 데이터를 찾을 수 없습니다.');
        navigate('/kiosks');
        return;
      }

      setKiosk(kioskData);

      // Set form data
      const storeRegdateStr = timestampToDateLocal(kioskData.storeRegdate);
      const storeMinDateStr = storeRegdateStr;

      setFormData({
        posid: kioskData.posid,
        kioskno: kioskData.kioskno || '',
        maker: kioskData.maker || '',
        serialno: kioskData.serialno || '',
        state: kioskData.state,
        regdate: timestampToDateLocal(kioskData.regdate),
        setdate: timestampToDateLocal(kioskData.setdate),
        deldate: timestampToDateLocal(kioskData.deldate),
        storeRegdate: storeRegdateStr,
        storeMinDate: storeMinDateStr
      });
    } catch (err) {
      setError('키오스크 데이터를 불러오는데 실패했습니다: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadStores = async () => {
    try {
      const data = await getAllStores();
      setStores(data);
    } catch (err) {
      console.error('Failed to load stores:', err);
    }
  };

  const timestampToDateLocal = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const dateLocalToTimestamp = (dateStr) => {
    if (!dateStr) return null;
    const date = new Date(dateStr + 'T00:00:00');
    return Timestamp.fromDate(date);
  };

  const formatPosId = (posid) => {
    if (!posid) return 'N/A';
    return posid.replace(/^0+/, '') || '0';
  };

  const getStoreName = (posid) => {
    const store = stores.find(s => s.posid === posid);
    return store ? `${store.posname} (${formatPosId(posid)})` : formatPosId(posid);
  };

  const formatKioskId = (kioskid) => {
    if (!kioskid) return 'N/A';
    return kioskid.replace(/^0+/, '') || '0';
  };

  const getStateColor = (state) => {
    switch (state) {
      case 'preparing':
        return 'state-preparing';
      case 'active':
        return 'state-active';
      case 'inactive':
        return 'state-inactive';
      case 'maintenance':
        return 'state-maintenance';
      case 'deleted':
        return 'state-deleted';
      default:
        return '';
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    if (name === 'state' && value === 'active' && !formData.setdate) {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const todayStr = `${year}-${month}-${day}`;

      setFormData(prev => ({
        ...prev,
        [name]: value,
        setdate: todayStr
      }));
    } else if (name === 'state' && (value === 'inactive' || value === 'maintenance') && !formData.deldate) {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const todayStr = `${year}-${month}-${day}`;

      setFormData(prev => ({
        ...prev,
        [name]: value,
        deldate: todayStr
      }));
    } else if (name === 'setdate' && value && formData.state === 'preparing') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const setDate = new Date(value + 'T00:00:00');

      if (setDate.getTime() <= today.getTime()) {
        setFormData(prev => ({
          ...prev,
          [name]: value,
          state: 'active'
        }));
      } else {
        setFormData(prev => ({
          ...prev,
          [name]: value
        }));
      }
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleEditKiosk = async (e) => {
    e.preventDefault();
    try {
      const kiosknoValue = parseInt(formData.kioskno, 10) || 1;

      const isDuplicate = await checkKioskDuplicate(formData.posid, kiosknoValue, kiosk.id);
      if (isDuplicate) {
        setError(`Kiosk number ${kiosknoValue} already exists for this store. Please use a different number.`);
        setTimeout(() => setError(''), 5000);
        return;
      }

      const updateData = {
        posid: formData.posid,
        kioskno: kiosknoValue,
        maker: formData.maker || '',
        serialno: formData.serialno || '',
        state: formData.state,
        regdate: dateLocalToTimestamp(formData.regdate),
        setdate: dateLocalToTimestamp(formData.setdate),
        deldate: dateLocalToTimestamp(formData.deldate)
      };

      const changes = {};
      if (kiosk.posid !== formData.posid) {
        changes.posid = { old: kiosk.posid, new: formData.posid };
      }
      if (kiosk.kioskno !== kiosknoValue) {
        changes.kioskno = { old: kiosk.kioskno, new: kiosknoValue };
      }
      if (kiosk.maker !== formData.maker) {
        changes.maker = { old: kiosk.maker || 'none', new: formData.maker || 'none' };
      }
      if (kiosk.serialno !== formData.serialno) {
        changes.serialno = { old: kiosk.serialno || 'none', new: formData.serialno || 'none' };
      }
      if (kiosk.state !== formData.state) {
        changes.state = { old: kiosk.state, new: formData.state };
      }
      const oldRegdate = timestampToDateLocal(kiosk.regdate);
      if (oldRegdate !== formData.regdate) {
        changes.regdate = { old: oldRegdate || 'none', new: formData.regdate || 'none' };
      }
      const oldSetdate = timestampToDateLocal(kiosk.setdate);
      if (oldSetdate !== formData.setdate) {
        changes.setdate = { old: oldSetdate || 'none', new: formData.setdate || 'none' };
      }
      const oldDeldate = timestampToDateLocal(kiosk.deldate);
      if (oldDeldate !== formData.deldate) {
        changes.deldate = { old: oldDeldate || 'none', new: formData.deldate || 'none' };
      }

      await updateKiosk(kiosk.id, updateData);

      if (user && Object.keys(changes).length > 0) {
        await logKioskUpdate(kiosk.kioskid, formData.posid, user.email, changes);
      }

      setSuccess('키오스크가 성공적으로 수정되었습니다.');
      setTimeout(() => {
        navigate('/kiosks');
      }, 1500);
    } catch (err) {
      setError('Failed to update kiosk: ' + err.message);
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleManageVideos = () => {
    setActiveView('videos');
  };

  const handleViewConfig = async () => {
    setActiveView('config');
    try {
      const config = await getKioskConfig(kiosk.kioskid);
      const hasConfig = config.downloadPath || config.apiUrl || config.autoSync || config.syncInterval || config.lastSync;

      if (!hasConfig) {
        alert(`키오스크 ${kiosk.kioskid}는 아직 연결되지 않았습니다.\n\n키오스크 앱에서 설정을 저장하면 여기에서 확인 및 수정할 수 있습니다.`);
        setActiveView('edit');
        return;
      }

      setKioskConfig({
        downloadPath: config.downloadPath || '',
        apiUrl: config.apiUrl || '',
        autoSync: config.autoSync || false,
        syncInterval: config.syncInterval || 12,
        lastSync: config.lastSync || null
      });
    } catch (err) {
      console.error('Failed to load kiosk config:', err);
      alert(`키오스크 ${kiosk.kioskid}는 아직 연결되지 않았습니다.\n\n키오스크 앱에서 설정을 저장하면 여기에서 확인 및 수정할 수 있습니다.`);
      setActiveView('edit');
    }
  };

  const handleConfigInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setKioskConfig(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : (name === 'syncInterval' ? parseInt(value) || 12 : value)
    }));
  };

  const handleUpdateConfig = async (e) => {
    e.preventDefault();
    try {
      await updateKioskConfigFromWeb(kiosk.id, kioskConfig);
      setSuccess('키오스크 설정이 업데이트되었습니다. 키오스크 앱에 알림이 전송되었습니다.');
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError('설정 업데이트 실패: ' + err.message);
      setTimeout(() => setError(''), 3000);
    }
  };

  if (loading || !kiosk) {
    return (
      <div className="kiosk-edit-container">
        <div className="loading">키오스크 데이터를 불러오는 중...</div>
      </div>
    );
  }

  return (
    <div className="kiosk-edit-container">
      <div className="kiosk-edit-header">
        <button className="btn-back" onClick={() => navigate('/kiosks')}>
          ← 목록으로
        </button>
        <h1>키오스크 관리 - {formatKioskId(kiosk.kioskid)}</h1>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="kiosk-edit-content">
        {/* Left Menu */}
        <div className="kiosk-edit-menu">
          <div className="kiosk-edit-info">
            <p><strong>매장:</strong> {getStoreName(kiosk.posid)}</p>
            <p><strong>제조사:</strong> {kiosk.maker || '-'}</p>
            <p><strong>상태:</strong> <span className={`state-badge ${getStateColor(kiosk.state)}`}>
              {kiosk.state === 'preparing' ? '준비중' :
               kiosk.state === 'active' ? '활성' :
               kiosk.state === 'inactive' ? '비활성' :
               kiosk.state === 'maintenance' ? '정비중' :
               kiosk.state === 'deleted' ? '삭제됨' : kiosk.state}
            </span></p>
          </div>
          <div className="kiosk-edit-actions">
            <button
              onClick={() => setActiveView('edit')}
              className={`menu-item ${activeView === 'edit' ? 'active' : ''}`}
            >
              <FiEdit /> 편집
            </button>
            <button
              onClick={handleManageVideos}
              className={`menu-item ${activeView === 'videos' ? 'active' : ''}`}
            >
              <FiVideo /> 영상 관리
            </button>
            <button
              onClick={handleViewConfig}
              className={`menu-item ${activeView === 'config' ? 'active' : ''}`}
            >
              <FiSettings /> 키오스크 설정
            </button>
          </div>
        </div>

        {/* Right Content */}
        <div className="kiosk-edit-main">
          {activeView === 'edit' && (
            <div className="kiosk-edit-form-container">
              <h2>키오스크 편집</h2>
              <form onSubmit={handleEditKiosk} className="kiosk-form">
                <div className="form-group">
                  <label htmlFor="edit-store">매장</label>
                  {stores.find(s => s.posid === formData.posid) ? (
                    <>
                      <input
                        type="text"
                        id="edit-storename"
                        value={formData.posid ? getStoreName(formData.posid) : ''}
                        readOnly
                        style={{background: '#f0f0f0', cursor: 'not-allowed', fontWeight: '600', color: '#333'}}
                      />
                      <small style={{color: '#666', fontSize: '12px', marginTop: '4px', display: 'block'}}>
                        매장은 변경할 수 없습니다 (POS ID: {formData.posid})
                      </small>
                    </>
                  ) : (
                    <>
                      <select
                        id="edit-store"
                        name="posid"
                        value={formData.posid}
                        onChange={handleInputChange}
                        required
                      >
                        <option value="">매장을 선택하세요...</option>
                        {stores
                          .filter(store => store.state === 'active' || store.state === 'maintenance')
                          .map((store) => (
                            <option key={store.id} value={store.posid}>
                              {store.posid} - {store.posname}
                            </option>
                          ))}
                      </select>
                      <small style={{color: '#999', fontSize: '12px', marginTop: '4px', display: 'block'}}>
                        ⚠️ 원래 매장 (POS ID: {formData.posid})을 찾을 수 없습니다. 새 매장을 선택하세요.
                      </small>
                    </>
                  )}
                </div>
                <div className="form-group">
                  <label htmlFor="edit-kioskno">키오스크 번호</label>
                  <input
                    type="number"
                    id="edit-kioskno"
                    name="kioskno"
                    value={formData.kioskno}
                    onChange={handleInputChange}
                    required
                    min="1"
                    placeholder="키오스크 번호를 입력하세요"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="edit-maker">제조사</label>
                  <input
                    type="text"
                    id="edit-maker"
                    name="maker"
                    value={formData.maker}
                    onChange={handleInputChange}
                    placeholder="제조사명을 입력하세요"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="edit-serialno">시리얼 번호</label>
                  <input
                    type="text"
                    id="edit-serialno"
                    name="serialno"
                    value={formData.serialno}
                    onChange={handleInputChange}
                    placeholder="시리얼 번호를 입력하세요"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="edit-state">상태</label>
                  <select
                    id="edit-state"
                    name="state"
                    value={formData.state}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="preparing">준비중</option>
                    <option value="active">활성</option>
                    <option value="inactive">비활성</option>
                    <option value="maintenance">정비중</option>
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="edit-regdate">등록일</label>
                  <input
                    type="date"
                    id="edit-regdate"
                    name="regdate"
                    value={formData.regdate}
                    onChange={handleInputChange}
                    min={formData.storeMinDate || undefined}
                  />
                  <small style={{color: '#666', fontSize: '12px', marginTop: '4px', display: 'block'}}>
                    {formData.storeRegdate
                      ? `매장 등록일(${formData.storeRegdate}) 이후(포함) 날짜만 선택 가능합니다`
                      : '키오스크가 시스템에 등록된 날짜'}
                  </small>
                </div>
                <div className="form-group">
                  <label htmlFor="edit-setdate">시작일</label>
                  <input
                    type="date"
                    id="edit-setdate"
                    name="setdate"
                    value={formData.setdate}
                    onChange={handleInputChange}
                    min={formData.regdate || undefined}
                  />
                  <small style={{color: '#666', fontSize: '12px', marginTop: '4px', display: 'block'}}>
                    {formData.regdate
                      ? `키오스크 등록일(${formData.regdate}) 이후(포함) 날짜만 선택 가능합니다`
                      : '아직 시작하지 않았다면 비워두세요'}
                  </small>
                </div>
                <div className="form-group">
                  <label htmlFor="edit-deldate">종료일</label>
                  <input
                    type="date"
                    id="edit-deldate"
                    name="deldate"
                    value={formData.deldate}
                    onChange={handleInputChange}
                    min={formData.setdate || undefined}
                    disabled={!formData.setdate}
                  />
                  <small style={{color: '#666', fontSize: '12px', marginTop: '4px', display: 'block'}}>
                    {formData.setdate
                      ? `시작일(${formData.setdate}) 이후(포함) 날짜만 선택 가능합니다`
                      : '시작일을 먼저 설정해야 합니다'}
                  </small>
                </div>
                <div className="form-actions">
                  <button type="button" onClick={() => navigate('/kiosks')} className="btn-cancel">
                    취소
                  </button>
                  <button type="submit" className="btn-submit">
                    저장
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeView === 'config' && (
            <div className="kiosk-config-container">
              <h2>키오스크 설정</h2>
              <form onSubmit={handleUpdateConfig} className="kiosk-form">
                <div className="form-group">
                  <label htmlFor="config-downloadPath" style={{fontSize: '15px', fontWeight: '700', color: '#333', marginBottom: '10px'}}>
                    📁 다운로드 경로
                  </label>
                  <input
                    type="text"
                    id="config-downloadPath"
                    name="downloadPath"
                    value={kioskConfig.downloadPath}
                    onChange={handleConfigInputChange}
                    placeholder="예: C:\Videos"
                  />
                  <small style={{color: '#888', fontSize: '11px', marginTop: '6px', display: 'block', fontStyle: 'italic'}}>
                    💡 키오스크 앱에서 영상을 다운로드할 경로
                  </small>
                </div>
                <div className="form-group">
                  <label htmlFor="config-apiUrl" style={{fontSize: '15px', fontWeight: '700', color: '#333', marginBottom: '10px'}}>
                    🌐 API URL
                  </label>
                  <input
                    type="text"
                    id="config-apiUrl"
                    name="apiUrl"
                    value={kioskConfig.apiUrl}
                    onChange={handleConfigInputChange}
                    placeholder="예: http://localhost:8080/api"
                  />
                  <small style={{color: '#888', fontSize: '11px', marginTop: '6px', display: 'block', fontStyle: 'italic'}}>
                    💡 백엔드 API 서버 주소
                  </small>
                </div>
                <div className="form-group">
                  <label style={{fontSize: '15px', fontWeight: '700', color: '#333', marginBottom: '10px'}}>
                    🔄 자동 동기화 설정
                  </label>
                  <div style={{display: 'flex', gap: '16px', alignItems: 'flex-start'}}>
                    <div style={{flex: 1}}>
                      <input
                        type="number"
                        id="config-syncInterval"
                        name="syncInterval"
                        value={kioskConfig.syncInterval}
                        onChange={handleConfigInputChange}
                        min="1"
                        max="24"
                        placeholder="12"
                        style={{width: '100%'}}
                      />
                      <small style={{color: '#888', fontSize: '11px', marginTop: '6px', display: 'block', fontStyle: 'italic'}}>
                        동기화 간격 (1-24시간)
                      </small>
                    </div>
                    <div style={{flex: 1, display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '12px'}}>
                      <input
                        type="checkbox"
                        id="config-autoSync"
                        name="autoSync"
                        checked={kioskConfig.autoSync}
                        onChange={handleConfigInputChange}
                        style={{width: '20px', height: '20px', margin: 0, cursor: 'pointer'}}
                      />
                      <label htmlFor="config-autoSync" style={{margin: 0, cursor: 'pointer', fontWeight: '600', fontSize: '14px', color: '#555'}}>
                        자동 동기화 활성화
                      </label>
                    </div>
                  </div>
                  <small style={{color: '#888', fontSize: '11px', marginTop: '6px', display: 'block', fontStyle: 'italic'}}>
                    💡 체크하면 설정된 간격마다 자동으로 영상을 동기화합니다
                  </small>
                </div>
                <div className="form-group">
                  <label style={{fontSize: '15px', fontWeight: '700', color: '#333', marginBottom: '10px'}}>
                    ⏰ 마지막 동기화 시간
                  </label>
                  <input
                    type="text"
                    value={kioskConfig.lastSync ? new Date(kioskConfig.lastSync).toLocaleString('ko-KR') : '없음'}
                    readOnly
                    style={{background: '#f7f7f7', cursor: 'not-allowed', color: '#666'}}
                  />
                  <small style={{color: '#888', fontSize: '11px', marginTop: '6px', display: 'block', fontStyle: 'italic'}}>
                    💡 키오스크 앱에서 마지막으로 동기화한 시간 (읽기 전용)
                  </small>
                </div>
                <div className="form-actions">
                  <button type="button" onClick={() => setActiveView('edit')} className="btn-cancel">
                    취소
                  </button>
                  <button type="submit" className="btn-submit">
                    설정 저장
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeView === 'videos' && (
            <KioskVideoManagement kioskProp={kiosk} embedded={true} />
          )}
        </div>
      </div>
    </div>
  );
}

export default KioskEdit;
