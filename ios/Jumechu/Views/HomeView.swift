import SwiftUI
import SwiftData

struct HomeView: View {
    @Query var watchedItems: [WatchedItem]
    @Environment(\.modelContext) private var modelContext
    @State private var webStore = WebViewStore()
    @State private var screenState: WebScreenState = .home
    @State private var showSettings = false

    private let webURL = URL(string: "https://jumechu.vercel.app")!

    var body: some View {
        ZStack(alignment: .top) {
            WebView(
                url: webURL,
                watchedIds: watchedItems.map { $0.id },
                onWatch: { id, title, posterUrl, contentType in
                    guard !watchedItems.contains(where: { $0.id == id }) else { return }
                    let item = WatchedItem(
                        id: id,
                        title: title,
                        posterUrl: posterUrl,
                        contentType: contentType
                    )
                    modelContext.insert(item)
                },
                store: webStore,
                onScreenState: { state in
                    screenState = state
                }
            )
            .ignoresSafeArea(edges: .top)

            // 우측 상단 버튼: 홈=설정, 설문/결과=X
            HStack {
                Spacer()
                switch screenState {
                case .home:
                    Button(action: { showSettings = true }) {
                        Image(systemName: "gearshape.fill")
                            .font(.system(size: 17))
                            .foregroundColor(.white)
                            .frame(width: 44, height: 44)
                            .contentShape(Rectangle())
                    }
                case .survey, .result:
                    Button(action: { webStore.load(webURL) }) {
                        Image(systemName: "xmark")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundColor(.white)
                            .frame(width: 44, height: 44)
                            .contentShape(Rectangle())
                    }
                case .netflixResult:
                    EmptyView() // 하단 '홈으로 가기' 버튼과 중복되므로 X 숨김
                }
            }
            .padding(.trailing, 16)
            .padding(.top, 8)
        }
        // 결과화면 하단 '홈으로 가기' 버튼
        .overlay(alignment: .bottom) {
            if screenState == .result || screenState == .netflixResult {
                Button(action: { webStore.load(webURL) }) {
                    Text("홈으로 가기")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                        .background(Color.red)
                        .cornerRadius(14)
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 36)
            }
        }
        .sheet(isPresented: $showSettings) {
            SettingsView()
        }
    }
}
