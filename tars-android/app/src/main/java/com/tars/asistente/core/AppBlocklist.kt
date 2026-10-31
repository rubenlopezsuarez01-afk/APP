package com.tars.asistente.core

/**
 * Apps y webs en las que TARS nunca entra: bancos, pagos, inversión y tiendas online.
 * El bloqueo lo aplica el código (no depende de lo que decida el modelo) y no se puede desactivar;
 * el usuario solo puede añadir palabras extra.
 */
object AppBlocklist {

    /** Paquetes conocidos (o prefijos de paquete). */
    private val PACKAGES = listOf(
        // Compras
        "com.amazon.mshop", "com.amazon.windowshop", "in.amazon.mshop", "com.amazon.avod", "com.amazon.dee",
        "com.alibaba.aliexpresshd", "com.einnovation.temu", "com.zzkko", "com.ebay.", "com.wallapop", "fr.vinted",
        "de.zalando.", "com.miravia.", "com.etsy.", "com.inditex.", "es.elcorteingles", "com.carrefour",
        "com.mercadolibre", "com.joom", "com.shopify.", "com.lidl.", "com.klarna.",
        // Pagos, bancos e inversión
        "com.paypal.", "com.revolut.", "de.number26.", "com.bbva.", "es.bancosantander.", "es.lacaixa.",
        "com.imaginbank.", "es.bancosabadell.", "com.bankinter.", "es.unicajabanco.", "com.kutxabank.",
        "es.openbank.", "es.evobanco.", "com.abanca.", "es.ibercaja.", "es.cajamar.", "es.ingdirect.", "com.ing.",
        "com.google.android.apps.walletnfcrel", "com.google.android.apps.nbu.paisa", "com.samsung.android.spay",
        "com.samsung.android.samsungpay", "com.coinbase.", "com.binance.", "com.etoro.", "nl.degiro.",
        "com.trading212.", "com.bitpanda.", "com.myinvestor.", "com.wise.", "com.transferwise.",
    )

    /** Palabras que, contenidas en el nombre de la app, el paquete o la web, la bloquean. */
    private val KEYWORDS = listOf(
        "bank", "banco", "banca", "caixa", "bbva", "santander", "sabadell", "bankinter", "unicaja", "kutxa",
        "abanca", "ibercaja", "cajamar", "cajasur", "openbank", "revolut", "paypal", "bizum", "wallet",
        "cartera", "monedero", "finanz", "broker", "trading", "crypto", "cripto", "coinbase", "binance",
        "amazon", "aliexpress", "shein", "temu", "ebay", "wallapop", "vinted", "zalando", "miravia", "etsy",
        "klarna", "shop", "tienda", "compra", "carrito",
    )

    /** Palabras cortas que solo cuentan si son una palabra completa (para no bloquear "messaging" por "ing"). */
    private val WHOLE_WORDS = setOf("ing", "n26", "pay", "evo", "wise", "lidl")

    private fun normalize(s: String) = java.text.Normalizer.normalize(s.lowercase(), java.text.Normalizer.Form.NFD)
        .replace(Regex("\\p{M}"), "")

    private fun matches(text: String, extra: List<String>): Boolean {
        val t = normalize(text)
        if (t.isBlank()) return false
        if (KEYWORDS.any { t.contains(it) }) return true
        if (t.split(Regex("[^a-z0-9]+")).any { it in WHOLE_WORDS }) return true
        return extra.map { normalize(it.trim()) }.any { it.length >= 3 && t.contains(it) }
    }

    /** ¿Está bloqueada la app con este paquete y nombre visible? */
    fun isBlockedApp(packageName: String, label: String = "", extra: List<String> = emptyList()): Boolean {
        val pkg = packageName.lowercase()
        if (PACKAGES.any { pkg == it.trimEnd('.') || pkg.startsWith(it) }) return true
        return matches(pkg, extra) || matches(label, extra)
    }

    /** ¿Está bloqueada esta web? Se mira el dominio. */
    fun isBlockedUrl(url: String, extra: List<String> = emptyList()): Boolean {
        val host = url.substringAfter("://").substringBefore('/').substringBefore('?').substringBefore(':')
        return matches(host, extra)
    }

    const val REFUSAL =
        "BLOQUEADO: TARS no puede entrar en apps o webs de bancos, pagos, inversión ni compras. " +
            "Dile al usuario que eso tiene que hacerlo él mismo."
}
