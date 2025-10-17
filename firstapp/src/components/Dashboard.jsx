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
  ResponsiveContainer
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
      const monthlyActiveKiosks = processMonthlyActiveKiosks(kiosks, sixMonthsAgo);
      const regionalStats = processRegionalData(kiosks, stores);

      setInstallationData(monthlyInstallations);
      setActiveKioskData(monthlyActiveKiosks);
      setRegionData(regionalStats);
      setError('');
    } catch (err) {
      setError('데이터를 불러오는데 실패했습니다: ' + err.message);
    } finally {
      setLoading(false);
    }
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

    // Count kiosks by installation month
    kiosks.forEach(kiosk => {
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

  const processMonthlyActiveKiosks = (kiosks, startDate) => {
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

    // For each month, count active kiosks that were registered before or during that month
    Object.keys(monthsData).forEach(monthKey => {
      const [year, month] = monthKey.split('-');
      const monthEndDate = new Date(parseInt(year), parseInt(month), 0); // Last day of month

      const activeCount = kiosks.filter(kiosk => {
        if (!kiosk.regdate) return false;

        const regDate = kiosk.regdate.toDate ? kiosk.regdate.toDate() : new Date(kiosk.regdate);

        // Kiosk must be registered before or during this month
        if (regDate > monthEndDate) return false;

        // Kiosk must be active and not deleted
        return kiosk.state === 'active' && kiosk.deleted !== true;
      }).length;

      monthsData[monthKey].count = activeCount;
    });

    return Object.values(monthsData);
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
        maintenance: 0,
        operational: 0,
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
      // Skip deleted kiosks
      if (kiosk.deldate) return;

      const storeAddress = storeMap[kiosk.posid];
      const region = extractRegion(storeAddress);

      if (regionStats[region]) {
        // Count operational kiosks (active)
        if (kiosk.state === 'active') {
          regionStats[region].operational++;
        }

        // Count maintenance kiosks
        if (kiosk.state === 'maintenance') {
          regionStats[region].maintenance++;
        }
      }
    });

    // Calculate total kiosks for each region
    sortOrder.forEach(region => {
      regionStats[region].total = regionStats[region].maintenance + regionStats[region].operational;
    });

    // Convert to array and filter regions with stores or kiosks
    return sortOrder
      .map(region => regionStats[region])
      .filter(region => region.stores > 0 || region.maintenance > 0 || region.operational > 0);
  };

  const handleStoreClick = (region, count) => {
    if (count === 0) return;
    navigate('/stores', { state: { filterRegion: region } });
  };

  const handleMaintenanceClick = (region, count) => {
    if (count === 0) return;
    navigate('/kiosks', { state: { filterRegion: region, filterState: 'maintenance' } });
  };

  const handleOperationalClick = (region, count) => {
    if (count === 0) return;
    navigate('/kiosks', { state: { filterRegion: region, filterState: 'active' } });
  };

  const handleTotalClick = (region, count) => {
    if (count === 0) return;
    navigate('/kiosks', { state: { filterRegion: region } });
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

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1>대시보드</h1>
        <p>최근 6개월 키오스크 통계</p>
      </div>

      <div className="charts-container">
        {/* Monthly Installation Chart */}
        <div className="chart-card">
          <h2>월별 키오스크 설치 수</h2>
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
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Active Kiosks Chart */}
        <div className="chart-card">
          <h2>월별 활성화된 키오스크 수</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={activeKioskData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" angle={-45} textAnchor="end" height={80} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="count" stroke="#48bb78" strokeWidth={2} name="활성 키오스크 수" />
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
                  <th>광역 지역</th>
                  <th>매장</th>
                  <th>전체</th>
                  <th>정비중</th>
                  <th>운영중</th>
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
                      className={region.maintenance > 0 ? 'clickable-cell' : ''}
                      onClick={() => handleMaintenanceClick(region.region, region.maintenance)}
                    >
                      {region.maintenance}
                    </td>
                    <td
                      className={region.operational > 0 ? 'clickable-cell' : ''}
                      onClick={() => handleOperationalClick(region.region, region.operational)}
                    >
                      {region.operational}
                    </td>
                  </tr>
                ))}
                {/* Total Row */}
                <tr className="total-row">
                  <td>전체</td>
                  <td>{regionData.reduce((sum, region) => sum + region.stores, 0)}</td>
                  <td>{regionData.reduce((sum, region) => sum + region.total, 0)}</td>
                  <td>{regionData.reduce((sum, region) => sum + region.maintenance, 0)}</td>
                  <td>{regionData.reduce((sum, region) => sum + region.operational, 0)}</td>
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
