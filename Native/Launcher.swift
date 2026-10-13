import AppKit

final class ExtensionDelegate: NSObject, NSApplicationDelegate {
    var process: Process?
    func fail(_ text: String) {
        NSApp.activate(ignoringOtherApps: true)
        let alert = NSAlert(); alert.messageText = "豆包动态启动"; alert.informativeText = text
        alert.addButton(withTitle: "知道了"); alert.runModal(); NSApp.terminate(nil)
    }
    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.accessory)
        guard let app = NSWorkspace.shared.urlForApplication(withBundleIdentifier: "com.bot.neotix.doubao") else { fail("没有找到豆包应用。"); return }
        let running = NSRunningApplication.runningApplications(withBundleIdentifier: "com.bot.neotix.doubao")
        if CommandLine.arguments.contains("--probe") {
            let result: [String: Any] = ["application": app.path, "running": running.map { Int($0.processIdentifier) }]
            print(String(data: try! JSONSerialization.data(withJSONObject: result), encoding: .utf8)!)
            NSApp.terminate(nil); return
        }
        // Validate the signed app before passing its path to the extension.
        let check = Process(); check.executableURL = URL(fileURLWithPath: "/usr/bin/codesign")
        check.arguments = ["--verify", "--deep", "--strict", app.path]
        do { try check.run(); check.waitUntilExit() } catch { fail("无法检查应用签名：\(error.localizedDescription)"); return }
        guard check.terminationStatus == 0 else { fail("应用签名检查未通过，未启动扩展。"); return }
        if let existing = running.first {
            guard existing.bundleURL?.standardizedFileURL == app.standardizedFileURL else { fail("正在运行的豆包路径与已安装应用不一致。"); return }
            NSApp.activate(ignoringOtherApps: true)
            let alert = NSAlert()
            alert.messageText = "豆包已在运行"
            alert.informativeText = "启动动画需要重新打开豆包。请先保存尚未发送的内容。"
            alert.addButton(withTitle: "退出并播放启动画面")
            alert.addButton(withTitle: "取消")
            if alert.runModal() != .alertFirstButtonReturn {
                existing.activate(options: [.activateAllWindows]); NSApp.terminate(nil); return
            }
            guard existing.terminate() else { fail("无法正常退出豆包，请手动按 ⌘Q 后重试。"); return }
            for _ in 0..<200 where !existing.isTerminated { Thread.sleep(forTimeInterval: 0.1) }
            guard existing.isTerminated else { fail("豆包尚未退出，请完成应用中的退出提示后重试。"); return }
        }
        let runner = Process(), output = Pipe()
        let nodes = ["\(NSHomeDirectory())/.local/bin/node", "/opt/homebrew/bin/node", "/usr/local/bin/node"]
        guard let node = nodes.first(where: { FileManager.default.isExecutableFile(atPath: $0) }) else { fail("没有找到 Node.js 20+。请先安装 Node.js 后重试。"); return }
        runner.executableURL = URL(fileURLWithPath: node)
        runner.arguments = [Bundle.main.resourceURL!.appendingPathComponent("web/extension/run.mjs").path, "--bundle", app.path]
        runner.standardOutput = output; runner.standardError = output
        runner.terminationHandler = { [weak self] task in
            let data = output.fileHandleForReading.readDataToEndOfFile()
            let message = String(data: data, encoding: .utf8) ?? "启动失败"
            DispatchQueue.main.async { if task.terminationStatus == 0 { NSApp.terminate(nil) } else { self?.fail(message) } }
        }
        process = runner
        do { try runner.run() } catch { fail("无法运行扩展：\(error.localizedDescription)") }
    }
}
let app = NSApplication.shared
let delegate = ExtensionDelegate()
app.delegate = delegate
app.run()
