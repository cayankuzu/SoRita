# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# Add any project specific keep options here:

# React Native touch dispatch calls EnumSet/enum values on UIManager enums at
# runtime. R8 can remove or rename those generated methods in release builds,
# causing NoSuchMethodException crashes on the first touch event.
-keepclassmembers enum com.facebook.react.uimanager.** {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}
-keep class com.facebook.react.uimanager.TouchTargetHelper { *; }
-keep class com.facebook.react.uimanager.TouchTargetHelper$* { *; }
-keep class com.facebook.react.uimanager.PointerEvents { *; }

# Hermes Intl and a few React Native internals also call enum values/valueOf
# through reflection. Keep these generated methods stable in release builds.
-keepclassmembers enum com.facebook.** {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}
-keep class com.facebook.hermes.intl.** { *; }

# Expo Modules converts JS ReadableMap arguments into Kotlin Record option
# objects at runtime. Release obfuscation can break that converter path and
# make modules like expo-secure-store reject valid options maps.
-keepattributes RuntimeVisibleAnnotations,RuntimeInvisibleAnnotations,Signature,InnerClasses,EnclosingMethod
-keep class kotlin.Metadata { *; }
-keep class expo.modules.kotlin.records.** { *; }
-keep class expo.modules.kotlin.types.** { *; }
-keep class expo.modules.kotlin.functions.** { *; }
-keep class expo.modules.securestore.** { *; }

# Optional CameraX vendor extension and Compose-only replay classes are not
# packaged in this app, but some transitive libraries reference them.
-dontwarn androidx.camera.extensions.impl.CaptureProcessorImpl
-dontwarn androidx.camera.extensions.impl.ExtensionVersionImpl
-dontwarn androidx.camera.extensions.impl.InitializerImpl$OnExtensionsDeinitializedCallback
-dontwarn androidx.camera.extensions.impl.InitializerImpl$OnExtensionsInitializedCallback
-dontwarn androidx.camera.extensions.impl.PreviewImageProcessorImpl
-dontwarn androidx.camera.extensions.impl.ProcessResultImpl
-dontwarn androidx.camera.extensions.impl.advanced.ImageProcessorImpl
-dontwarn androidx.camera.extensions.impl.advanced.ImageReferenceImpl
-dontwarn androidx.camera.extensions.impl.advanced.OutputSurfaceConfigurationImpl
-dontwarn androidx.camera.extensions.impl.advanced.OutputSurfaceImpl
-dontwarn androidx.camera.extensions.impl.advanced.RequestProcessorImpl$Callback
-dontwarn androidx.camera.extensions.impl.advanced.RequestProcessorImpl$Request
-dontwarn androidx.camera.extensions.impl.advanced.RequestProcessorImpl
-dontwarn androidx.camera.extensions.impl.advanced.SessionProcessorImpl$CaptureCallback
-dontwarn androidx.compose.runtime.internal.StabilityInferred
-dontwarn androidx.compose.ui.Modifier
-dontwarn androidx.compose.ui.geometry.Offset
-dontwarn androidx.compose.ui.geometry.OffsetKt
-dontwarn androidx.compose.ui.geometry.Rect
-dontwarn androidx.compose.ui.graphics.Color$Companion
-dontwarn androidx.compose.ui.graphics.Color
-dontwarn androidx.compose.ui.graphics.ColorKt
-dontwarn androidx.compose.ui.layout.LayoutCoordinates
-dontwarn androidx.compose.ui.layout.LayoutCoordinatesKt
-dontwarn androidx.compose.ui.layout.ModifierInfo
-dontwarn androidx.compose.ui.node.LayoutNode
-dontwarn androidx.compose.ui.node.NodeCoordinator
-dontwarn androidx.compose.ui.node.Owner
-dontwarn androidx.compose.ui.semantics.AccessibilityAction
-dontwarn androidx.compose.ui.semantics.SemanticsActions
-dontwarn androidx.compose.ui.semantics.SemanticsConfiguration
-dontwarn androidx.compose.ui.semantics.SemanticsConfigurationKt
-dontwarn androidx.compose.ui.semantics.SemanticsProperties
-dontwarn androidx.compose.ui.semantics.SemanticsPropertyKey
-dontwarn androidx.compose.ui.text.TextLayoutInput
-dontwarn androidx.compose.ui.text.TextLayoutResult
-dontwarn androidx.compose.ui.text.TextStyle
-dontwarn androidx.compose.ui.unit.IntSize
-dontwarn androidx.compose.ui.unit.TextUnit$Companion
-dontwarn androidx.compose.ui.unit.TextUnit
