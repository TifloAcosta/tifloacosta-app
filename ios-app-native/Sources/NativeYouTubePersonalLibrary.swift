import Foundation
import SwiftUI

/// Bookmarks and playback positions are local; no Google account is required.
/// Only public video metadata and an approximate playback position are stored.
struct NativeSavedYouTubeVideo: Codable, Identifiable {
    let id: String
    var title: String
    var channelTitle: String
    var description: String
    var publishedAt: String?
    var durationSeconds: Int
    var watchLater: Bool
    var resumeSeconds: Double
    var lastWatchedAt: Date?
}

struct NativeSavedYouTubeChannel: Codable, Identifiable {
    let id: String
    var title: String
    var description: String
}

@MainActor
final class NativeYouTubePersonalLibrary: ObservableObject {
    static let shared = NativeYouTubePersonalLibrary()
    @Published private(set) var videos: [NativeSavedYouTubeVideo] = []
    @Published private(set) var followedChannels: [NativeSavedYouTubeChannel] = []
    private let key = "native-youtube-personal-library-v1"
    private let followedKey = "native-youtube-followed-channels-v1"

    private init() {
        if let data = UserDefaults.standard.data(forKey: key),
           let stored = try? JSONDecoder().decode([NativeSavedYouTubeVideo].self, from: data) {
            videos = stored.filter { NativeYouTubeVideo.validID($0.id) }
        }
        if let data = UserDefaults.standard.data(forKey: followedKey),
           let stored = try? JSONDecoder().decode([NativeSavedYouTubeChannel].self, from: data) {
            followedChannels = stored.filter {
                $0.id.hasPrefix("UC") && $0.id.count == 24
            }.sorted { $0.title.localizedStandardCompare($1.title) == .orderedAscending }
        }
    }

    var watchLater: [NativeSavedYouTubeVideo] {
        videos.filter(\.watchLater).sorted {
            ($0.lastWatchedAt ?? .distantPast) > ($1.lastWatchedAt ?? .distantPast)
        }
    }

    var continueWatching: [NativeSavedYouTubeVideo] {
        videos.filter { $0.resumeSeconds > 0 && !$0.resumeSeconds.isNaN }
            .sorted { ($0.lastWatchedAt ?? .distantPast) > ($1.lastWatchedAt ?? .distantPast) }
    }

    func isWatchLater(_ id: String) -> Bool {
        videos.first(where: { $0.id == id })?.watchLater ?? false
    }

    func resumeSeconds(_ id: String) -> Double {
        videos.first(where: { $0.id == id })?.resumeSeconds ?? 0
    }

    private func record(_ video: NativeYouTubeVideo) -> NativeSavedYouTubeVideo {
        NativeSavedYouTubeVideo(
            id: video.id, title: video.title, channelTitle: video.channelTitle,
            description: video.description, publishedAt: video.publishedAt,
            durationSeconds: video.durationSeconds, watchLater: false,
            resumeSeconds: 0, lastWatchedAt: nil
        )
    }

    private func save() {
        guard let data = try? JSONEncoder().encode(videos) else { return }
        UserDefaults.standard.set(data, forKey: key)
    }

    func toggleWatchLater(_ video: NativeYouTubeVideo) {
        guard NativeYouTubeVideo.validID(video.id) else { return }
        if let index = videos.firstIndex(where: { $0.id == video.id }) {
            videos[index].watchLater.toggle()
            if !videos[index].watchLater && videos[index].resumeSeconds == 0 {
                videos.remove(at: index)
            }
        } else {
            var entry = record(video)
            entry.watchLater = true
            videos.append(entry)
        }
        save()
    }

    func rememberPlayback(_ video: NativeYouTubeVideo, seconds: Double, duration: Double) {
        guard NativeYouTubeVideo.validID(video.id),
              seconds.isFinite, duration.isFinite, duration > 0 else { return }
        let value = seconds >= duration - 10 ? 0 : min(duration, max(0, seconds))
        if let index = videos.firstIndex(where: { $0.id == video.id }) {
            videos[index].resumeSeconds = value
            videos[index].lastWatchedAt = Date()
            if value == 0 && !videos[index].watchLater { videos.remove(at: index) }
        } else if value >= 5 {
            var entry = record(video)
            entry.resumeSeconds = value
            entry.lastWatchedAt = Date()
            videos.append(entry)
        }
        save()
    }

    func isFollowing(_ id: String) -> Bool {
        followedChannels.contains(where: { $0.id == id })
    }

    func toggleFollowed(_ channel: NativeYouTubeChannel) {
        guard channel.id.hasPrefix("UC"), channel.id.count == 24 else { return }
        if isFollowing(channel.id) {
            followedChannels.removeAll { $0.id == channel.id }
        } else {
            followedChannels.append(NativeSavedYouTubeChannel(
                id: channel.id, title: channel.title, description: channel.description
            ))
            followedChannels.sort { $0.title.localizedStandardCompare($1.title) == .orderedAscending }
        }
        if let data = try? JSONEncoder().encode(followedChannels) {
            UserDefaults.standard.set(data, forKey: followedKey)
        }
    }

    func clearProgress(_ id: String) {
        guard let index = videos.firstIndex(where: { $0.id == id }) else { return }
        videos[index].resumeSeconds = 0
        if !videos[index].watchLater { videos.remove(at: index) }
        save()
    }
}
