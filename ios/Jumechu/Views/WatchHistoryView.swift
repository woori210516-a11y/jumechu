import SwiftUI
import SwiftData

struct WatchHistoryView: View {
    @Query(sort: \WatchedItem.watchedAt, order: .reverse) var allItems: [WatchedItem]
    @Environment(\.modelContext) private var modelContext
    @State private var displayedCount = 30

    private var displayedItems: [WatchedItem] {
        Array(allItems.prefix(displayedCount))
    }

    var body: some View {
        Group {
            if allItems.isEmpty {
                VStack(spacing: 12) {
                    Text("🎬")
                        .font(.system(size: 48))
                    Text("아직 본 콘텐츠가 없어요")
                        .font(.system(size: 15))
                        .foregroundColor(.gray)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Color(hex: "#141414"))
            } else {
                List {
                    ForEach(displayedItems) { item in
                        WatchedItemRow(item: item)
                            .listRowBackground(Color(hex: "#1f1f1f"))
                            .listRowSeparatorTint(Color(hex: "#2a2a2a"))
                            .onAppear {
                                if item.id == displayedItems.last?.id,
                                   displayedCount < allItems.count {
                                    displayedCount += 30
                                }
                            }
                    }
                    .onDelete(perform: deleteItems)
                }
                .scrollContentBackground(.hidden)
                .background(Color(hex: "#141414"))
            }
        }
        .navigationTitle("내가 본 콘텐츠")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func deleteItems(at offsets: IndexSet) {
        for index in offsets {
            modelContext.delete(displayedItems[index])
        }
    }
}
