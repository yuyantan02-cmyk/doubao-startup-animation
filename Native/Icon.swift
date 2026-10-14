import AppKit

enum LauncherIcon {
    static func render(_ source: URL, to output: URL) throws {
        guard let image = NSImage(contentsOf: source), image.isValid,
              image.size.width > 0, image.size.height > 0 else {
            throw NSError(domain: "LauncherIcon", code: 1, userInfo: [NSLocalizedDescriptionKey: "无法读取图片：\(source.path)"])
        }
        guard let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: 1024, pixelsHigh: 1024,
                                            bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true,
                                            isPlanar: false, colorSpaceName: .deviceRGB,
                                            bytesPerRow: 0, bitsPerPixel: 0),
              let context = NSGraphicsContext(bitmapImageRep: bitmap) else {
            throw NSError(domain: "LauncherIcon", code: 2, userInfo: [NSLocalizedDescriptionKey: "无法生成图标画布。"])
        }
        NSGraphicsContext.saveGraphicsState()
        NSGraphicsContext.current = context
        NSColor.clear.setFill()
        NSRect(x: 0, y: 0, width: 1024, height: 1024).fill()
        let square = NSRect(x: 52, y: 52, width: 920, height: 920)
        NSBezierPath(roundedRect: square, xRadius: 210, yRadius: 210).addClip()
        let scale = max(square.width / image.size.width, square.height / image.size.height)
        image.draw(in: NSRect(x: 512 - image.size.width * scale / 2,
                              y: 512 - image.size.height * scale / 2,
                              width: image.size.width * scale, height: image.size.height * scale),
                   from: .zero, operation: .sourceOver, fraction: 1)
        context.flushGraphics()
        NSGraphicsContext.restoreGraphicsState()
        guard let png = bitmap.representation(using: .png, properties: [:]) else {
            throw NSError(domain: "LauncherIcon", code: 2, userInfo: [NSLocalizedDescriptionKey: "无法生成圆角图标。"])
        }
        try png.write(to: output, options: .atomic)
    }

    static func command(_ path: String, _ arguments: [String]) throws {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: path)
        process.arguments = arguments
        process.standardOutput = Pipe()
        process.standardError = Pipe()
        try process.run()
        process.waitUntilExit()
        guard process.terminationStatus == 0 else {
            throw NSError(domain: "LauncherIcon", code: 3, userInfo: [NSLocalizedDescriptionKey: "更新图标失败：\(path)"])
        }
    }

    static func makeICNS(from png: URL, to output: URL) throws {
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + ".iconset")
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: false)
        defer { try? FileManager.default.removeItem(at: folder) }
        for (name, pixels) in [("16x16", 16), ("16x16@2x", 32), ("32x32", 32),
                               ("32x32@2x", 64), ("128x128", 128), ("128x128@2x", 256),
                               ("256x256", 256), ("256x256@2x", 512),
                               ("512x512", 512), ("512x512@2x", 1024)] {
            try command("/usr/bin/sips", ["-z", String(pixels), String(pixels), png.path,
                                           "--out", folder.appendingPathComponent("icon_\(name).png").path])
        }
        try command("/usr/bin/iconutil", ["-c", "icns", "-o", output.path, folder.path])
    }

    static func install(_ source: URL?, in bundle: URL) throws {
        let resources = bundle.appendingPathComponent("Contents/Resources")
        let icon = resources.appendingPathComponent("DoubaoStartup.icns")
        let original = resources.appendingPathComponent("OriginalIcon.icns")
        let backup = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + ".icns")
        let png = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + ".png")
        defer { try? FileManager.default.removeItem(at: backup); try? FileManager.default.removeItem(at: png) }
        try FileManager.default.copyItem(at: icon, to: backup)
        do {
            if let source {
                try render(source, to: png)
                try makeICNS(from: png, to: icon)
            } else {
                try FileManager.default.removeItem(at: icon)
                try FileManager.default.copyItem(at: original, to: icon)
            }
            try command("/usr/bin/codesign", ["--force", "--sign", "-", bundle.path])
            try command("/usr/bin/codesign", ["--verify", "--deep", "--strict", bundle.path])
        } catch {
            try? FileManager.default.removeItem(at: icon)
            try? FileManager.default.copyItem(at: backup, to: icon)
            try? command("/usr/bin/codesign", ["--force", "--sign", "-", bundle.path])
            throw error
        }
        refreshDock(bundle)
    }

    static func refreshDock(_ bundle: URL) {
        guard let defaults = UserDefaults(suiteName: "com.apple.dock"),
              var tiles = defaults.array(forKey: "persistent-apps") as? [[String: Any]],
              let index = tiles.firstIndex(where: { tile in
                  let data = tile["tile-data"] as? [String: Any]
                  let file = data?["file-data"] as? [String: Any]
                  let path = (file?["_CFURLString"] as? String).flatMap(URL.init(string:))?.path
                  return data?["bundle-identifier"] as? String == "local.doubao.startup" && path == bundle.path
              }),
              let data = tiles[index]["tile-data"] as? [String: Any],
              let file = data["file-data"] else { return }
        tiles[index] = ["tile-type": "file-tile", "tile-data": [
            "bundle-identifier": "local.doubao.startup",
            "file-data": file,
            "file-label": data["file-label"] ?? "豆包动态启动"
        ]]
        defaults.set(tiles, forKey: "persistent-apps")
        defaults.synchronize()
        try? command("/usr/bin/killall", ["Dock"])
    }
}

#if ICON_RENDER_MAIN
@main struct IconTool {
    static func main() throws {
        let arguments = CommandLine.arguments
        if arguments.count == 3, arguments[1] == "reset" {
            try LauncherIcon.install(nil, in: URL(fileURLWithPath: arguments[2]))
        } else if arguments.count == 3 {
            let png = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + ".png")
            defer { try? FileManager.default.removeItem(at: png) }
            try LauncherIcon.render(URL(fileURLWithPath: arguments[1]), to: png)
            try LauncherIcon.makeICNS(from: png, to: URL(fileURLWithPath: arguments[2]))
        } else if arguments.count == 4, arguments[1] == "apply" {
            try LauncherIcon.install(URL(fileURLWithPath: arguments[2]), in: URL(fileURLWithPath: arguments[3]))
        } else {
            throw NSError(domain: "LauncherIcon", code: 4, userInfo: [NSLocalizedDescriptionKey: "图标参数不正确。"])
        }
    }
}
#endif
