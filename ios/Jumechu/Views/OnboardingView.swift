import SwiftUI

struct OnboardingView: View {
    @AppStorage("hasSeenOnboarding") private var hasSeenOnboarding = false
    @State private var currentPage = 0

    struct Page {
        let emoji: String
        let title: String
        let subtitle: String
    }

    let pages: [Page] = [
        Page(
            emoji: "🍜",
            title: "오늘 뭐 먹지?",
            subtitle: "메뉴 고르기가 귀찮을 때\n주메추가 대신 골라줄게"
        ),
        Page(
            emoji: "🎬",
            title: "오늘 뭐 보지?",
            subtitle: "넷플릭스에서 뭘 볼지 모를 때\n취향에 맞는 콘텐츠 추천해줄게"
        ),
    ]

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            VStack(spacing: 0) {
                // 페이지들
                TabView(selection: $currentPage) {
                    ForEach(Array(pages.enumerated()), id: \.offset) { index, page in
                        VStack(spacing: 32) {
                            Spacer()

                            Text(page.emoji)
                                .font(.system(size: 88))

                            VStack(spacing: 14) {
                                Text(page.title)
                                    .font(.system(size: 30, weight: .bold))
                                    .foregroundColor(.white)

                                Text(page.subtitle)
                                    .font(.system(size: 16))
                                    .foregroundColor(Color(white: 0.5))
                                    .multilineTextAlignment(.center)
                                    .lineSpacing(5)
                            }

                            Spacer()
                        }
                        .padding(.horizontal, 36)
                        .tag(index)
                    }
                }
                .tabViewStyle(.page(indexDisplayMode: .never))
                .frame(maxHeight: .infinity)

                // 인디케이터
                HStack(spacing: 8) {
                    ForEach(0..<pages.count, id: \.self) { i in
                        Capsule()
                            .fill(i == currentPage ? Color.red : Color(white: 0.3))
                            .frame(width: i == currentPage ? 22 : 6, height: 6)
                            .animation(.spring(response: 0.3, dampingFraction: 0.7), value: currentPage)
                    }
                }
                .padding(.bottom, 28)

                // 버튼
                Button {
                    if currentPage < pages.count - 1 {
                        withAnimation(.easeInOut(duration: 0.25)) {
                            currentPage += 1
                        }
                    } else {
                        hasSeenOnboarding = true
                    }
                } label: {
                    Text(currentPage < pages.count - 1 ? "다음" : "시작하기")
                        .font(.system(size: 17, weight: .bold))
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 18)
                        .background(Color.red)
                        .cornerRadius(18)
                }
                .padding(.horizontal, 24)
                .padding(.bottom, 52)
            }
        }
    }
}
