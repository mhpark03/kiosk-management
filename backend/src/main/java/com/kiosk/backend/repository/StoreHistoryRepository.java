package com.kiosk.backend.repository;

import com.kiosk.backend.entity.StoreHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface StoreHistoryRepository extends JpaRepository<StoreHistory, Long> {

    // Find all history records for a specific store
    List<StoreHistory> findByStoreIdOrderByTimestampDesc(Long storeId);

    // Find all history records, ordered by timestamp (most recent first)
    List<StoreHistory> findAllByOrderByTimestampDesc();

    // Find history by user
    List<StoreHistory> findByUseridOrderByTimestampDesc(String userid);

    // Find history by action type
    List<StoreHistory> findByActionOrderByTimestampDesc(StoreHistory.ActionType action);
}
