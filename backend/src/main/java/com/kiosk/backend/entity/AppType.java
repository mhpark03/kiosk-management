package com.kiosk.backend.entity;

/**
 * Application type enum for managing separate token versions per app
 */
public enum AppType {
    WEB,      // React web dashboard (firstapp)
    EDITOR,   // Electron video editor app
    KIOSK     // Electron kiosk downloader app
}
