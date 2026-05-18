import Observation
import SwiftUI
import WebKit

@Observable
final class WebViewStore {
    var webView: WKWebView?

    func load(_ url: URL) {
        webView?.load(URLRequest(url: url))
    }
}

// 웹에서 직접 신호를 보낼 수 있는 화면 상태
enum WebScreenState {
    case home, survey, result, netflixResult
}

struct WebView: UIViewRepresentable {
    let url: URL
    let watchedIds: [String]
    let onWatch: (String, String, String?, String?) -> Void
    let store: WebViewStore
    var onScreenState: ((WebScreenState) -> Void)?

    func makeCoordinator() -> Coordinator {
        Coordinator(onWatch: onWatch, store: store, onScreenState: onScreenState)
    }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        let contentController = WKUserContentController()

        // history.pushState / replaceState 가로채기 (Next.js SPA 라우팅 감지)
        let historyScript = WKUserScript(
            source: """
            (function() {
                function _notifyState() {
                    var path = window.location.pathname;
                    var search = window.location.search;
                    var state = 'home';
                    if (path !== '/') {
                        state = (path.indexOf('result') !== -1 || search.indexOf('result') !== -1)
                            ? 'result' : 'survey';
                    }
                    window.webkit.messageHandlers.screenState.postMessage(state);
                }
                ['pushState','replaceState'].forEach(function(m) {
                    var orig = history[m];
                    history[m] = function() {
                        var r = orig.apply(this, arguments);
                        setTimeout(_notifyState, 60);
                        return r;
                    };
                });
                window.addEventListener('popstate', function() { setTimeout(_notifyState, 60); });
                // 웹에서 직접 호출 가능: window.__nativeUIState('result')
                window.__nativeUIState = function(s) {
                    window.webkit.messageHandlers.screenState.postMessage(s);
                };
            })();
            """,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        )
        contentController.addUserScript(historyScript)

        let handler = WeakMessageHandler(delegate: context.coordinator)
        contentController.add(handler, name: "watched")
        contentController.add(handler, name: "screenState")
        config.userContentController = contentController

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.scrollView.contentInsetAdjustmentBehavior = .automatic
        context.coordinator.webView = webView
        store.webView = webView

        webView.load(URLRequest(url: url))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        context.coordinator.injectWatchedIds(watchedIds)
    }

    // MARK: - Coordinator

    class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler, WKUIDelegate {
        let onWatch: (String, String, String?, String?) -> Void
        let store: WebViewStore
        let onScreenState: ((WebScreenState) -> Void)?
        weak var webView: WKWebView?
        private var isPageLoaded = false
        private var pendingIds: [String] = []

        init(
            onWatch: @escaping (String, String, String?, String?) -> Void,
            store: WebViewStore,
            onScreenState: ((WebScreenState) -> Void)?
        ) {
            self.onWatch = onWatch
            self.store = store
            self.onScreenState = onScreenState
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            isPageLoaded = true
            inject(ids: pendingIds, into: webView)
            pendingIds = []
            notifyStateFromURL(webView.url)
        }

        // target="_blank" 링크 → Safari로 열기
        func webView(_ webView: WKWebView,
                     createWebViewWith configuration: WKWebViewConfiguration,
                     for navigationAction: WKNavigationAction,
                     windowFeatures: WKWindowFeatures) -> WKWebView? {
            if let url = navigationAction.request.url {
                UIApplication.shared.open(url)
            }
            return nil
        }

        // 외부 도메인 링크는 Safari로 열기 (내 도메인은 웹뷰 내부 유지)
        func webView(_ webView: WKWebView,
                     decidePolicyFor navigationAction: WKNavigationAction,
                     decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.allow)
                return
            }

            // 커스텀 스킴(netflix://, mailto: 등)은 즉시 외부로
            if let scheme = url.scheme?.lowercased(), scheme != "http" && scheme != "https" && scheme != "about" {
                if UIApplication.shared.canOpenURL(url) {
                    UIApplication.shared.open(url)
                }
                decisionHandler(.cancel)
                return
            }

            // 사용자가 직접 탭한 링크인지 + 외부 도메인 검사
            if navigationAction.navigationType == .linkActivated,
               let host = url.host?.lowercased(),
               !host.contains("jumechu.vercel.app") && !host.contains("localhost") {
                UIApplication.shared.open(url)
                decisionHandler(.cancel)
                return
            }

            decisionHandler(.allow)
        }

        private func notifyStateFromURL(_ url: URL?) {
            let path = url?.path ?? "/"
            let query = url?.query ?? ""
            let isOtt = path.hasPrefix("/ott")
            let state: WebScreenState
            if path == "/" {
                state = .home
            } else if path.contains("result") || query.contains("result") {
                state = isOtt ? .netflixResult : .result
            } else {
                state = .survey
            }
            DispatchQueue.main.async { self.onScreenState?(state) }
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
            if message.name == "screenState" {
                let raw = message.body as? String ?? "home"
                let path = webView?.url?.path ?? ""
                let isOtt = path.hasPrefix("/ott")
                let state: WebScreenState
                switch raw {
                case "result":  state = isOtt ? .netflixResult : .result
                case "survey":  state = .survey
                default:        state = .home
                }
                DispatchQueue.main.async { self.onScreenState?(state) }
                return
            }

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
