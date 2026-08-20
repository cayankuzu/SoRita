package com.cayan.sorita.socialmap.baselineprofile

import android.content.Intent
import android.net.Uri
import androidx.benchmark.macro.MacrobenchmarkScope
import androidx.test.uiautomator.By
import androidx.test.uiautomator.Until

internal const val TARGET_PACKAGE = "com.cayan.sorita.socialmap"

internal fun MacrobenchmarkScope.startSoRita() {
    startActivityAndWait(
        Intent(Intent.ACTION_VIEW, Uri.parse("sorita://")).apply {
            setPackage(TARGET_PACKAGE)
        },
    )
    device.wait(Until.hasObject(By.pkg(TARGET_PACKAGE).depth(0)), 8_000)
}

/**
 * Exercises authenticated tabs when the benchmark device contains a fixture session;
 * otherwise it still covers anonymous startup, auth navigation, and scroll rendering.
 */
internal fun MacrobenchmarkScope.exerciseCriticalJourneys() {
    val tabLabels = listOf("Ana Sayfa", "Ke\u015Ffet", "Harita", "Profil")
    var visitedAuthenticatedTab = false

    tabLabels.forEach { label ->
        device.findObject(By.desc(label))?.let { tab ->
            tab.click()
            device.waitForIdle()
            visitedAuthenticatedTab = true
            device.swipe(
                device.displayWidth / 2,
                device.displayHeight * 3 / 4,
                device.displayWidth / 2,
                device.displayHeight / 4,
                12,
            )
            device.waitForIdle()
        }
    }

    if (!visitedAuthenticatedTab) {
        device.findObject(By.text("Giri\u015F Yap"))?.click()
        device.waitForIdle()
        device.swipe(
            device.displayWidth / 2,
            device.displayHeight * 3 / 4,
            device.displayWidth / 2,
            device.displayHeight / 3,
            10,
        )
        device.waitForIdle()
    }
}
