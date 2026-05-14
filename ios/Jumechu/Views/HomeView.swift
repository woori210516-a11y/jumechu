import SwiftUI
import SwiftData

struct HomeView: View {
    @Query var watchedItems: [WatchedItem]
    @Environment(\.modelContext) private var modelContext

    private let webURL = URL(string: "https://jumechu.vercel.app")!

    var body: some View {
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
            }
        )
        .ignoresSafeArea(edges: .top)
    }
}
