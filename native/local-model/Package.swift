// swift-tools-version: 5.9
// 本机模型插件。Capacitor（npx cap sync）会把这个包加进 iOS 工程；包名必须是 npm 包名转换后的 ShuxingLocalModel。
import PackageDescription

let package = Package(
    name: "ShuxingLocalModel",
    platforms: [.iOS(.v15)],
    products: [
        .library(name: "ShuxingLocalModel", targets: ["LocalModelPlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.0.0")
    ],
    targets: [
        // llama.cpp 官方 iOS 框架（b12110 / v0.9.0），另外加了一份模拟器用的副本，见 native/README.md
        .binaryTarget(name: "llama", path: "ios/Frameworks/llama.xcframework"),
        .target(
            name: "LocalModelPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                "llama"
            ],
            path: "ios/Sources/LocalModelPlugin"
        )
    ]
)
