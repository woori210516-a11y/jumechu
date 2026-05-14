import SwiftData
import Foundation

@Model
class WatchedItem {
    @Attribute(.unique) var id: String
    var title: String
    var posterUrl: String?
    var contentType: String?
    var watchedAt: Date

    init(id: String, title: String, posterUrl: String? = nil, contentType: String? = nil) {
        self.id = id
        self.title = title
        self.posterUrl = posterUrl
        self.contentType = contentType
        self.watchedAt = Date()
    }
}
