package com.kiosk.backend.repository;

import com.kiosk.backend.entity.KioskHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * @deprecated Use {@link com.kiosk.backend.repository.KioskEventRepository} instead.
 * This repository is kept for backward compatibility but will be removed in a future version.
 */
@Deprecated(since = "1.1.0", forRemoval = true)
@Repository
public interface KioskHistoryRepository extends JpaRepository<KioskHistory, Long> {

    /**
     * Find all history for a specific kiosk
     */
    List<KioskHistory> findByKioskidOrderByTimestampDesc(String kioskid);

    /**
     * Find all history for a specific kiosk by action type
     */
    List<KioskHistory> findByKioskidAndActionOrderByTimestampDesc(String kioskid, KioskHistory.ActionType action);
}
