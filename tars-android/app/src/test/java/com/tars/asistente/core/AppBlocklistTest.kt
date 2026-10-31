package com.tars.asistente.core

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AppBlocklistTest {

    @Test
    fun blocksBanksPaymentsAndShops() {
        assertTrue(AppBlocklist.isBlockedApp("com.amazon.mShop.android.shopping", "Amazon Shopping"))
        assertTrue(AppBlocklist.isBlockedApp("com.bbva.bbvacontigo", "BBVA España"))
        assertTrue(AppBlocklist.isBlockedApp("es.lacaixa.mobile.android.newwapicon", "CaixaBank"))
        assertTrue(AppBlocklist.isBlockedApp("com.example.unknown", "Mi Banco Online"))
        assertTrue(AppBlocklist.isBlockedApp("com.google.android.apps.walletnfcrel", "Google Wallet"))
        assertTrue(AppBlocklist.isBlockedApp("com.whatever", "Google Pay"))
        assertTrue(AppBlocklist.isBlockedApp("es.ingdirect.ingapp", "ING"))
        assertTrue(AppBlocklist.isBlockedApp("com.zzkko", "SHEIN"))
        assertTrue(AppBlocklist.isBlockedApp("com.einnovation.temu", "Temu"))
    }

    @Test
    fun allowsNormalApps() {
        assertFalse(AppBlocklist.isBlockedApp("com.whatsapp", "WhatsApp"))
        assertFalse(AppBlocklist.isBlockedApp("com.google.android.apps.messaging", "Mensajes"))
        assertFalse(AppBlocklist.isBlockedApp("com.spotify.music", "Spotify"))
        assertFalse(AppBlocklist.isBlockedApp("com.google.android.apps.maps", "Maps"))
        assertFalse(AppBlocklist.isBlockedApp("com.google.android.gm", "Gmail"))
        assertFalse(AppBlocklist.isBlockedApp("com.booking", "Booking.com"))
    }

    @Test
    fun blocksUrlsAndUserWords() {
        assertTrue(AppBlocklist.isBlockedUrl("https://www.amazon.es/dp/B000"))
        assertTrue(AppBlocklist.isBlockedUrl("https://www.paypal.com/signin"))
        assertTrue(AppBlocklist.isBlockedUrl("https://www.bancosantander.es"))
        assertFalse(AppBlocklist.isBlockedUrl("https://www.google.com/search?q=amazon"))
        assertFalse(AppBlocklist.isBlockedApp("com.mediamarkt.app", "MediaMarkt"))
        assertTrue(AppBlocklist.isBlockedApp("com.mediamarkt.app", "MediaMarkt", extra = listOf("mediamarkt")))
    }
}
