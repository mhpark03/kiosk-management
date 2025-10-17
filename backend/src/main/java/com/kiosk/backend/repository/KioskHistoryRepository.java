package com.kiosk.backend.repository;

import com.kiosk.backend.entity.KioskHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface KioskHistoryRepository extends JpaRepository<KioskHistory, Long> {

    // Get history for specific kiosk
    List<KioskHistory> findByKioskidOrderByUpdatetimeDesc(String kioskid);

    // Get history for specific store
    List<KioskHistory> findByPosidOrderByUpdatetimeDesc(String posid);
}
