import SwiftUI
import WebKit

struct WebView: UIViewRepresentable {
    let url: URL
    let watchedIds: [String]
    let onWatch: (String, String, String?, String?) -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(onWatch: onWatch)
    }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        let contentController = WKUserContentController()

        // 메모리 누수 방지를 위한 weak 래퍼 사용
        let handler = WeakMessageHandler(delegate: context.coordinator)
        contentController.add(handler, name: "watched")
        config.userContentController = contentController

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.scrollView.contentInsetAdjustmentBehavior = .automatic
        context.coordinator.webView = webView

        webView.load(URLRequest(url: url))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        // watchedIds가 바뀔 때마다 웹에 주입
        context.coordinator.injectWatchedIds(watchedIds)
    }

    // MARK: - Coordinator

    class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
        let onWatch: (String, String, String?, String?) -> Void
        weak var webView: WKWebView?
        private var isPageLoaded = false
        private var pendingIds: [String] = []

        init(onWatch: @escaping (String, String, String?, String?) -> Void) {
            self.onWatch = onWatch
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            isPageLoaded = true
            inject(ids: pendingIds, into: webView)
            pendingIds = []
        }

        func injectWatchedIds(_ ids: [String]) {
            if isPageLoaded, let webView = webView {
                inject(ids: ids, into: webView)
            } else {
                pendingIds = ids
            }
        }

        private func inject(ids: [String], into webView: WKWebView) {
            guard let jsonData = try? JSONSerialization.data(withJSONObject: ids),
                  let jsonString = String(data: jsonData, encoding: .utf8) else { return }
            let script = "if(typeof window.__setWatchedIds==='function'){window.__setWatchedIds(\(jsonString));}"
            webView.evaluateJavaScript(script, completionHandler: nil)
        }

        func userContentController(
            _ userContentController: WKUserContentController,
            didReceive message: WKScriptMessage
        ) {
            guard message.name == "watched",
                  let body = message.body as? [String: Any] else { return }

            let id = body["id"] as? String ?? ""
            let title = body["title"] as? String ?? ""
            let posterUrl = body["posterUrl"] as? String
            let contentType = body["contentType"] as? String
            guard !id.isEmpty else { return }

            DispatchQueue.main.async {
                self.onWatch(id, title, posterUrl, contentType)
            }
        }
    }
}

// MARK: - 메모리 누수 방지 래퍼

private class WeakMessageHandler: NSObject, WKScriptMessageHandler {
    weak var delegate: WKScriptMessageHandler?

    init(delegate: WKScriptMessageHandler) {
        self.delegate = delegate
    }

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        delegate?.userContentController(userContentController, didReceive: message)
    }
}
