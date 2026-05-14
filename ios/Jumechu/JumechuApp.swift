import SwiftUI
import SwiftData

@main
struct JumechuApp: App {
    @AppStorage("hasSeenOnboarding") private var hasSeenOnboarding = false

    var body: some Scene {
        WindowGroup {
            Group {
                if hasSeenOnboarding {
                    ContentView()
                } else {
                    OnboardingView()
                }
            }
            .preferredColorScheme(.dark)
        }
        .modelContainer(for: WatchedItem.self)
    }
}
