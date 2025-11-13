import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllKiosks } from '../services/kioskService';
import { getAllStores } from '../services/storeService';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList
} from 'recharts';
import './Dashboard.css';

function Dashboard() {
  const navigate = useNavigate();
  const [installationData, setInstallationData] = useState([]);
  const [activeKioskData, setActiveKioskData] = useState([]);
  const [regionData, setRegionData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadDashboardData();
  }, []);

  const [kioskStatusStats, setKioskStatusStats] = useState({
    total: 0,
    online: 0,
    offline: 0,
    error: 0,
    unknown: 0,
    preparing: 0,
    active: 0,
    maintenance: 0,
    loggedIn: 0,
    menuNotSet: 0,
    downloadIncomplete: 0,
    deleted: 0
  });

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const kiosks = await getAllKiosks(true); // Include all kiosks
      const stores = await getAllStores(true); // Include all stores

      // Get date 6 months ago
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      // Process data for last 6 months
      const monthlyInstallations = processMonthlyInstallations(kiosks, sixMonthsAgo);
      const weeklyActiveKiosks = processWeeklyActiveKiosks(kiosks, sixMonthsAgo);
      const regionalStats = processRegionalData(kiosks, stores);
      const statusStats = processKioskStatusStats(kiosks);

      setInstallationData(monthlyInstallations);
      setActiveKioskData(weeklyActiveKiosks);
      setRegionData(regionalStats);
      setKioskStatusStats(statusStats);
      setError('');
    } catch (err) {
      setError('데이터를 불러오는데 실패했습니다: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const processKioskStatusStats = (kiosks) => {
    const stats = {
      total: 0,
      online: 0,
      offline: 0,
      error: 0,
      unknown: 0,
      preparing: 0,
      active: 0,
      maintenance: 0,
      loggedIn: 0,
      menuNotSet: 0,
      downloadIncomplete: 0,
      deleted: 0
    };

    const now = new Date();
    const fiveMinutesAgo = new Date(now - 5 * 60 * 1000);

    kiosks.forEach(kiosk => {
      // Count deleted kiosks separately
      if (kiosk.state === 'deleted') {
        stats.deleted++;
        return;
      }

      stats.total++;

      // Count by operational state
      if (kiosk.state === 'preparing') stats.preparing++;
      else if (kiosk.state === 'active') stats.active++;
      else if (kiosk.state === 'maintenance') stats.maintenance++;

      // Count by connection status
      const lastHeartbeat = kiosk.lastHeartbeat ? new Date(kiosk.lastHeartbeat) : null;
      const isOnline = lastHeartbeat && lastHeartbeat > fiveMinutesAgo;

      if (!lastHeartbeat) {
        stats.unknown++;
      } else if (isOnline) {
        if (kiosk.connectionStatus === 'ERROR') {
          stats.error++;
        } else {
          stats.online++;
        }
      } else {
        stats.offline++;
      }

      // Count logged in kiosks
      if (kiosk.isLoggedIn && isOnline) {
        stats.loggedIn++;
      }

      // Count kiosks without menu set
      if (!kiosk.menuId) {
        stats.menuNotSet++;
      }

      // Count kiosks with incomplete downloads
      // A kiosk has incomplete downloads if:
      // 1. It has videos assigned (totalVideoCount > 0) but not all are downloaded
      // 2. OR it has menu assigned (menuId) but menu download is not COMPLETED
      const hasIncompleteVideos =
        kiosk.totalVideoCount > 0 &&
        kiosk.downloadedVideoCount < kiosk.totalVideoCount;
      const hasIncompleteMenu =
        kiosk.menuId &&
        kiosk.menuDownloadStatus?.toUpperCase() !== 'COMPLETED';

      if (hasIncompleteVideos || hasIncompleteMenu) {
        stats.downloadIncomplete++;
      }
    });

    return stats;
  };

  const processMonthlyInstallations = (kiosks, startDate) => {
    // Initialize last 6 months
    const monthsData = {};
    const currentDate = new Date();

    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(currentDate.getMonth() - i);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
      monthsData[monthKey] = { month: monthLabel, count: 0 };
    }

    // Count kiosks by installation month (exclude inactive and deleted)
    kiosks.forEach(kiosk => {
      // Skip inactive and deleted kiosks
      if (kiosk.state === 'inactive' || kiosk.state === 'deleted') return;

      if (kiosk.regdate) {
        const regDate = kiosk.regdate.toDate ? kiosk.regdate.toDate() : new Date(kiosk.regdate);
        if (regDate >= startDate) {
          const monthKey = `${regDate.getFullYear()}-${String(regDate.getMonth() + 1).padStart(2, '0')}`;
          if (monthsData[monthKey]) {
            monthsData[monthKey].count++;
          }
        }
      }
    });

    return Object.values(monthsData);
  };

  const processWeeklyActiveKiosks = (kiosks, startDate) => {
    // Initialize weekly data for last 6 months
    const weeksData = {};
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    // Set startDate to beginning of week (Sunday)
    const weekStartDate = new Date(startDate);
    const dayOfWeek = weekStartDate.getDay();
    weekStartDate.setDate(weekStartDate.getDate() - dayOfWeek);
    weekStartDate.setHours(0, 0, 0, 0);

    // Calculate number of weeks from startDate to today
    const millisecondsPerWeek = 7 * 24 * 60 * 60 * 1000;
    const weeksDiff = Math.ceil((currentDate - weekStartDate) / millisecondsPerWeek);

    // Initialize all weeks
    for (let i = 0; i <= weeksDiff; i++) {
      const weekStart = new Date(weekStartDate);
      weekStart.setDate(weekStart.getDate() + (i * 7));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      const weekKey = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;
      const weekLabel = `${weekStart.getMonth() + 1}/${weekStart.getDate()}`;
      weeksData[weekKey] = {
        week: weekLabel,
        weekEnd: weekEnd,
        preparing: 0,
        active: 0,
        maintenance: 0
      };
    }

    // For each week, count kiosks by state using different date criteria
    // preparing: regdate, active: setdate, maintenance: deldate
    Object.keys(weeksData).forEach(weekKey => {
      const weekEnd = weeksData[weekKey].weekEnd;

      kiosks.forEach(kiosk => {
        // Skip deleted kiosks
        if (kiosk.state === 'deleted') return;

        // Count preparing state based on regdate
        if (kiosk.state === 'preparing' && kiosk.regdate) {
          const regDate = kiosk.regdate.toDate ? kiosk.regdate.toDate() : new Date(kiosk.regdate);
          if (regDate <= weekEnd) {
            weeksData[weekKey].preparing++;
          }
        }

        // Count active state based on setdate
        else if (kiosk.state === 'active' && kiosk.setdate) {
          const setDate = kiosk.setdate.toDate ? kiosk.setdate.toDate() : new Date(kiosk.setdate);
          if (setDate <= weekEnd) {
            weeksData[weekKey].active++;
          }
        }

        // Count maintenance state based on deldate
        else if (kiosk.state === 'maintenance' && kiosk.deldate) {
          const delDate = kiosk.deldate.toDate ? kiosk.deldate.toDate() : new Date(kiosk.deldate);
          if (delDate <= weekEnd) {
            weeksData[weekKey].maintenance++;
          }
        }
      });
    });

    return Object.values(weeksData);
  };

  const processRegionalData = (kiosks, stores) => {
    // Extract region from address
    const extractRegion = (address) => {
      if (!address) return '주소 미상';

      // Korean metropolitan cities/provinces
      const regions = [
        '서울특별시', '서울시', '서울',
        '부산광역시', '부산시', '부산',
        '대구광역시', '대구시', '대구',
        '인천광역시', '인천시', '인천',
        '광주광역시', '광주시', '광주',
        '대전광역시', '대전시', '대전',
        '울산광역시', '울산시', '울산',
        '세종특별자치시', '세종시', '세종',
        '경기도', '경기',
        '강원특별자치도', '강원도', '강원',
        '충청북도', '충북',
        '충청남도', '충남',
        '전북특별자치도', '전라북도', '전북',
        '전라남도', '전남',
        '경상북도', '경북',
        '경상남도', '경남',
        '제주특별자치도', '제주도', '제주'
      ];

      // Normalize region names
      const normalizeRegion = (region) => {
        if (region.includes('서울')) return '서울특별시';
        if (region.includes('부산')) return '부산광역시';
        if (region.includes('대구')) return '대구광역시';
        if (region.includes('인천')) return '인천광역시';
        if (region.includes('광주')) return '광주광역시';
        if (region.includes('대전')) return '대전광역시';
        if (region.includes('울산')) return '울산광역시';
        if (region.includes('세종')) return '세종특별자치시';
        if (region.includes('경기')) return '경기도';
        if (region.includes('강원')) return '강원특별자치도';
        if (region.includes('충청북') || region.includes('충북')) return '충청북도';
        if (region.includes('충청남') || region.includes('충남')) return '충청남도';
        if (region.includes('전북') || region.includes('전라북')) return '전북특별자치도';
        if (region.includes('전남') || region.includes('전라남')) return '전라남도';
        if (region.includes('경상북') || region.includes('경북')) return '경상북도';
        if (region.includes('경상남') || region.includes('경남')) return '경상남도';
        if (region.includes('제주')) return '제주특별자치도';
        return region;
      };

      for (const region of regions) {
        if (address.startsWith(region)) {
          return normalizeRegion(region);
        }
      }

      return '기타';
    };

    // Initialize all regions with zero counts
    const sortOrder = [
      '서울특별시', '부산광역시', '대구광역시', '인천광역시',
      '광주광역시', '대전광역시', '울산광역시', '세종특별자치시',
      '경기도', '강원특별자치도', '충청북도', '충청남도',
      '전북특별자치도', '전라남도', '경상북도', '경상남도',
      '제주특별자치도', '기타', '주소 미상'
    ];

    const regionStats = {};
    sortOrder.forEach(region => {
      regionStats[region] = {
        region: region,
        stores: 0,
        preparing: 0,
        active: 0,
        maintenance: 0,
        total: 0
      };
    });

    // Count stores by region
    stores.forEach(store => {
      // Skip deleted stores
      if (store.enddate) return;

      const region = extractRegion(store.baseaddress);
      if (regionStats[region]) {
        regionStats[region].stores++;
      }
    });

    // Create a map of posid -> store address
    const storeMap = {};
    stores.forEach(store => {
      storeMap[store.posid] = store.baseaddress || '';
    });

    // Count kiosks by region
    kiosks.forEach(kiosk => {
      // Skip deleted kiosks (state === 'deleted')
      if (kiosk.state === 'deleted') return;

      const storeAddress = storeMap[kiosk.posid];
      const region = extractRegion(storeAddress);

      if (regionStats[region]) {
        // Count kiosks by state
        if (kiosk.state === 'preparing') {
          regionStats[region].preparing++;
        } else if (kiosk.state === 'active') {
          regionStats[region].active++;
        } else if (kiosk.state === 'maintenance') {
          regionStats[region].maintenance++;
        }
      }
    });

    // Calculate total kiosks for each region (excluding deleted)
    sortOrder.forEach(region => {
      regionStats[region].total = regionStats[region].preparing + regionStats[region].active + regionStats[region].maintenance;
    });

    // Convert to array and filter regions with stores or kiosks
    return sortOrder
      .map(region => regionStats[region])
      .filter(region => region.stores > 0 || region.total > 0);
  };

  const handleStoreClick = (region, count) => {
    if (count === 0) return;
    navigate('/stores', { state: { filterRegion: region } });
  };

  const handleTotalClick = (region, count) => {
    if (count === 0) return;
    navigate('/kiosks', { state: { filterRegion: region } });
  };

  const handlePreparingClick = (region, count) => {
    if (count === 0) return;
    navigate('/kiosks', { state: { filterRegion: region, filterState: 'preparing' } });
  };

  const handleActiveClick = (region, count) => {
    if (count === 0) return;
    navigate('/kiosks', { state: { filterRegion: region, filterState: 'active' } });
  };

  const handleMaintenanceClick = (region, count) => {
    if (count === 0) return;
    navigate('/kiosks', { state: { filterRegion: region, filterState: 'maintenance' } });
  };

  const handleInstallationBarClick = (data) => {
    if (!data || !data.month) return;
    const month = data.month;
    const count = data.count;
    if (count === 0) return;
    navigate('/kiosks', { state: { filterInstallMonth: month } });
  };

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="loading">데이터 로딩 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-container">
        <div className="alert alert-error">{error}</div>
      </div>
    );
  }

  const handleStatusCardClick = (filterType, filterValue) => {
    if (filterType === 'connectionStatus') {
      navigate('/kiosks', { state: { filterConnectionStatus: filterValue } });
    } else if (filterType === 'operationalState') {
      navigate('/kiosks', { state: { filterState: filterValue } });
    } else if (filterType === 'menuNotSet') {
      navigate('/kiosks', { state: { filterMenuNotSet: true } });
    } else if (filterType === 'downloadIncomplete') {
      navigate('/kiosks', { state: { filterDownloadIncomplete: true } });
    } else if (filterType === 'total') {
      navigate('/kiosks');
    }
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1>대시보드</h1>
        <p>최근 6개월 키오스크 통계</p>
      </div>

      {/* Kiosk Status Statistics Cards */}
      <div className="status-cards-container">
        <div className="status-cards-section">
          <h3 className="status-section-title">전체 현황</h3>
          <div className="status-cards">
            <div
              className="status-card total-card"
              onClick={() => handleStatusCardClick('total')}
            >
              <div className="status-card-icon">📊</div>
              <div className="status-card-content">
                <div className="status-card-label">전체 키오스크</div>
                <div className="status-card-value">{kioskStatusStats.total}</div>
              </div>
            </div>

            <div
              className="status-card logged-in-card"
              onClick={() => handleStatusCardClick('connectionStatus', 'loggedIn')}
            >
              <div className="status-card-icon">👤</div>
              <div className="status-card-content">
                <div className="status-card-label">관리자 로그인</div>
                <div className="status-card-value">{kioskStatusStats.loggedIn}</div>
              </div>
            </div>

            <div
              className="status-card menu-not-set-card"
              onClick={() => handleStatusCardClick('menuNotSet')}
            >
              <div className="status-card-icon">📋</div>
              <div className="status-card-content">
                <div className="status-card-label">메뉴 미설정</div>
                <div className="status-card-value">{kioskStatusStats.menuNotSet}</div>
              </div>
            </div>

            <div
              className="status-card download-incomplete-card"
              onClick={() => handleStatusCardClick('downloadIncomplete')}
            >
              <div className="status-card-icon">⬇️</div>
              <div className="status-card-content">
                <div className="status-card-label">다운로드 미완료</div>
                <div className="status-card-value">{kioskStatusStats.downloadIncomplete}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="status-cards-section">
          <h3 className="status-section-title">연결 상태</h3>
          <div className="status-cards">
            <div
              className="status-card online-card"
              onClick={() => handleStatusCardClick('connectionStatus', 'online')}
            >
              <div className="status-card-icon">🟢</div>
              <div className="status-card-content">
                <div className="status-card-label">정상</div>
                <div className="status-card-value">{kioskStatusStats.online}</div>
              </div>
            </div>

            <div
              className="status-card error-card"
              onClick={() => handleStatusCardClick('connectionStatus', 'error')}
            >
              <div className="status-card-icon">🔴</div>
              <div className="status-card-content">
                <div className="status-card-label">오류</div>
                <div className="status-card-value">{kioskStatusStats.error}</div>
              </div>
            </div>

            <div
              className="status-card offline-card"
              onClick={() => handleStatusCardClick('connectionStatus', 'offline')}
            >
              <div className="status-card-icon">🟠</div>
              <div className="status-card-content">
                <div className="status-card-label">오프라인</div>
                <div className="status-card-value">{kioskStatusStats.offline}</div>
              </div>
            </div>

            <div
              className="status-card unknown-card"
              onClick={() => handleStatusCardClick('connectionStatus', 'unknown')}
            >
              <div className="status-card-icon">⚪</div>
              <div className="status-card-content">
                <div className="status-card-label">미연결</div>
                <div className="status-card-value">{kioskStatusStats.unknown}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="status-cards-section">
          <h3 className="status-section-title">가동 상태</h3>
          <div className="status-cards">
            <div
              className="status-card preparing-card"
              onClick={() => handleStatusCardClick('operationalState', 'preparing')}
            >
              <div className="status-card-icon">🔧</div>
              <div className="status-card-content">
                <div className="status-card-label">준비중</div>
                <div className="status-card-value">{kioskStatusStats.preparing}</div>
              </div>
            </div>

            <div
              className="status-card active-card"
              onClick={() => handleStatusCardClick('operationalState', 'active')}
            >
              <div className="status-card-icon">✅</div>
              <div className="status-card-content">
                <div className="status-card-label">운영중</div>
                <div className="status-card-value">{kioskStatusStats.active}</div>
              </div>
            </div>

            <div
              className="status-card maintenance-card"
              onClick={() => handleStatusCardClick('operationalState', 'maintenance')}
            >
              <div className="status-card-icon">🔨</div>
              <div className="status-card-content">
                <div className="status-card-label">정비중</div>
                <div className="status-card-value">{kioskStatusStats.maintenance}</div>
              </div>
            </div>

            <div
              className="status-card deleted-card"
              onClick={() => handleStatusCardClick('operationalState', 'deleted')}
            >
              <div className="status-card-icon">🗑️</div>
              <div className="status-card-content">
                <div className="status-card-label">삭제됨</div>
                <div className="status-card-value">{kioskStatusStats.deleted}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="charts-container">
        {/* Monthly Installation Chart */}
        <div className="chart-card">
          <h2>월별 키오스크 설치 수 (총: {installationData.reduce((sum, item) => sum + item.count, 0)}개)</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={installationData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" angle={-45} textAnchor="end" height={80} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar
                dataKey="count"
                fill="#667eea"
                name="설치 수"
                cursor="pointer"
                onClick={handleInstallationBarClick}
              >
                <LabelList dataKey="count" position="top" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Active Kiosks Chart */}
        <div className="chart-card">
          <h2>주간 키오스크 상태 추이</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={activeKioskData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week" angle={-45} textAnchor="end" height={80} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="preparing" stroke="#f6ad55" strokeWidth={2} name="준비중" dot={false} />
              <Line type="monotone" dataKey="active" stroke="#48bb78" strokeWidth={2} name="운영중" dot={false} />
              <Line type="monotone" dataKey="maintenance" stroke="#fc8181" strokeWidth={2} name="정비중" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Regional Statistics Table */}
      <div className="table-container">
        <div className="table-card">
          <h2>광역 지역별 키오스크 통계</h2>
          <div className="table-wrapper">
            <table className="region-table">
              <thead>
                <tr>
                  <th rowSpan="2">광역 지역</th>
                  <th rowSpan="2">매장</th>
                  <th colSpan="4">키오스크</th>
                </tr>
                <tr>
                  <th>전체</th>
                  <th>준비중</th>
                  <th>운영중</th>
                  <th>정비중</th>
                </tr>
              </thead>
              <tbody>
                {regionData.map(region => (
                  <tr key={region.region}>
                    <td>{region.region}</td>
                    <td
                      className={region.stores > 0 ? 'clickable-cell' : ''}
                      onClick={() => handleStoreClick(region.region, region.stores)}
                    >
                      {region.stores}
                    </td>
                    <td
                      className={region.total > 0 ? 'clickable-cell' : ''}
                      onClick={() => handleTotalClick(region.region, region.total)}
                    >
                      {region.total}
                    </td>
                    <td
                      className={region.preparing > 0 ? 'clickable-cell' : ''}
                      onClick={() => handlePreparingClick(region.region, region.preparing)}
                    >
                      {region.preparing}
                    </td>
                    <td
                      className={region.active > 0 ? 'clickable-cell' : ''}
                      onClick={() => handleActiveClick(region.region, region.active)}
                    >
                      {region.active}
                    </td>
                    <td
                      className={region.maintenance > 0 ? 'clickable-cell' : ''}
                      onClick={() => handleMaintenanceClick(region.region, region.maintenance)}
                    >
                      {region.maintenance}
                    </td>
                  </tr>
                ))}
                {/* Total Row */}
                <tr className="total-row">
                  <td>전체</td>
                  <td>{regionData.reduce((sum, region) => sum + region.stores, 0)}</td>
                  <td>{regionData.reduce((sum, region) => sum + region.total, 0)}</td>
                  <td>{regionData.reduce((sum, region) => sum + region.preparing, 0)}</td>
                  <td>{regionData.reduce((sum, region) => sum + region.active, 0)}</td>
                  <td>{regionData.reduce((sum, region) => sum + region.maintenance, 0)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
