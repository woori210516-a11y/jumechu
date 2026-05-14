import SwiftUI
import SwiftData

struct SettingsView: View {
    @Query var watchedItems: [WatchedItem]

    private var appVersion: String {
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
        let build   = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"
        return "\(version) (\(build))"
    }

    var body: some View {
        NavigationStack {
            List {
                // ── 내가 본 콘텐츠 ─────────────────────────────────
                Section {
                    NavigationLink {
                        WatchHistoryView()
                    } label: {
                        HStack {
                            Text("내가 본 콘텐츠")
                                .foregroundColor(.white)
                            Spacer()
                            if !watchedItems.isEmpty {
                                Text("\(watchedItems.count)")
                                    .foregroundColor(.gray)
                                    .font(.system(size: 14))
                            }
                        }
                    }
                    .listRowBackground(Color(hex: "#1f1f1f"))
                    .listRowSeparatorTint(Color(hex: "#2a2a2a"))
                } header: {
                    Text("콘텐츠")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(.gray)
                        .textCase(nil)
                }

                // ── 앱 정보 ───────────────────────────────────────
                Section {
                    HStack {
                        Text("버전")
                            .foregroundColor(.white)
                        Spacer()
                        Text(appVersion)
                            .foregroundColor(.gray)
                    }
                    .listRowBackground(Color(hex: "#1f1f1f"))
                    .listRowSeparatorTint(Color(hex: "#2a2a2a"))
                } header: {
                    Text("앱 정보")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(.gray)
                        .textCase(nil)
                }
            }
            .scrollContentBackground(.hidden)
            .background(Color(hex: "#141414"))
            .navigationTitle("설정")
        }
    }
}

// MARK: - WatchedItem Row

struct WatchedItemRow: View {
    let item: WatchedItem

    var body: some View {
        HStack(spacing: 12) {
            Group {
                if let urlStr = item.posterUrl, let url = URL(string: urlStr) {
                    AsyncImage(url: url) { phase in
                        switch phase {
                        case .success(let image):
                            image.resizable().aspectRatio(contentMode: .fill)
                        default:
                            posterPlaceholder
                        }
                    }
                } else {
                    posterPlaceholder
                }
            }
            .frame(width: 42, height: 60)
            .clipShape(RoundedRectangle(cornerRadius: 6))

            VStack(alignment: .leading, spacing: 4) {
                Text(item.title)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(.white)
                    .lineLimit(2)

                if let type = item.contentType {
                    Text(typeLabel(type))
                        .font(.system(size: 12))
                        .foregroundColor(.red)
                }
            }

            Spacer()
        }
        .padding(.vertical, 4)
    }

    private var posterPlaceholder: some View {
        RoundedRectangle(cornerRadius: 6)
            .fill(Color(hex: "#2a2a2a"))
            .overlay(Text("🎬").font(.callout))
    }

    private func typeLabel(_ type: String) -> String {
        switch type {
        case "movie":       return "영화"
        case "drama":       return "드라마"
        case "animation":   return "애니"
        case "documentary": return "다큐"
        case "variety":     return "예능"
        default:            return type
        }
    }
}

// MARK: - Color Hex Extension

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3:  (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6:  (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8:  (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default: (a, r, g, b) = (255, 255, 255, 255)
        }
        self.init(
            .sRGB,
            red:     Double(r) / 255,
            green:   Double(g) / 255,
            blue:    Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}
