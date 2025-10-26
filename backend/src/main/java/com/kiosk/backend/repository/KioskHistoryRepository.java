package com.kiosk.backend.repository;

import com.kiosk.backend.entity.KioskHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

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
