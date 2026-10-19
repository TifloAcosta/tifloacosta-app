import Foundation
import SwiftUI
import UIKit

/// La interfaz es exclusivamente SwiftUI. La fuente y la fecha se toman del
/// catálogo de noticias existente; nunca se deducen de la fecha de descarga.
enum NativeNewsMetadata {
    static let categoryLabels: [String: String] = [
        "apple": "Apple",
        "android": "Android",
        "windows": "Windows",
        "jaws": "JAWS",
        "nvda": "NVDA",
        "apps-accesibles": "Apps accesibles",
        "programas-accesibles": "Programas accesibles",
        "gafas-inteligentes": "Gafas inteligentes",
        "productos-disponibles": "Productos disponibles",
        "proyectos-prototipos": "Proyectos y prototipos",
        "tecnologia-accesibilidad": "Tecnología y accesibilidad",
        "ia-accesibilidad": "Inteligencia artificial y accesibilidad",
        "braille": "Braille y comunicación accesible",
        "movilidad": "Movilidad, orientación y autonomía",
        "sordoceguera": "Tecnología para personas sordociegas",
        "tecnologia-general": "Tecnología general"
    ]

    static func category(_ key: String) -> String {
        categoryLabels[key] ?? key.replacingOccurrences(of: "-", with: " ").capitalized
    }

    static func source(_ item: NativeCatalogItem) -> String {
        let value = item.sourceName?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return value.isEmpty ? "Fuente no indicada" : value
    }

    static func publication(_ value: String?) -> String? {
        guard let value, !value.isEmpty else { return nil }
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let standard = ISO8601DateFormatter()
        guard let date = fractional.date(from: value) ?? standard.date(from: value) else { return nil }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "es_ES")
        formatter.timeZone = .current
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }

    static func originalURL(_ item: NativeCatalogItem) -> URL? {
        guard let url = item.articleURL,
              ["https", "http"].contains(url.scheme?.lowercased() ?? ""),
              url.host != nil else { return nil }
        return url
    }

    static func articleText(_ item: NativeCatalogItem) -> String {
        let text = item.body?.trimmingCharacters(in: .whitespacesAndNewlines)
            ?? item.summary?.trimmingCharacters(in: .whitespacesAndNewlines)
            ?? ""
        let metadata = [
            item.title,
            "Medio: \(source(item))",
            publication(item.publishedAt).map { "Publicado: \($0)" } ?? ""
        ].filter { !$0.isEmpty }
        return (metadata + [text]).joined(separator: "\n\n")
    }

    static func accessibilitySummary(_ item: NativeCatalogItem) -> String {
        var labels = [item.title, "Medio: \(source(item))"]
        if let date = publication(item.publishedAt) { labels.append("Publicado: \(date)") }
        return labels.joined(separator: ". ")
    }
}

struct NativeNewsScreen: View {
    @EnvironmentObject private var catalog: NativeCatalogStore
    @EnvironmentObject private var library: NativeReaderLibrary
    @Environment(\.openURL) private var openURL

    @State private var categoryIndex = 0
    @State private var query = ""
    @State private var visibleCount = 10
    @State private var selectedArticle: NativeCatalogItem?
    @State private var showingArticle = false
    @State private var status: String?

    private var spanishNews: [NativeCatalogItem] {
        catalog.news.filter { $0.lang == "es" }
    }

    private var categories: [String] {
        Array(Set(spanishNews.flatMap { $0.categories ?? [] }))
            .sorted {
                NativeNewsMetadata.category($0)
                    .localizedStandardCompare(NativeNewsMetadata.category($1)) == .orderedAscending
            }
    }

    private var categoryChoices: [String] {
        ["Selecciona una categoría", "Todas las categorías"]
            + categories.map(NativeNewsMetadata.category)
    }

    private var matchingNews: [NativeCatalogItem] {
        let terms = query.trimmingCharacters(in: .whitespacesAndNewlines)
            .folding(options: [.diacriticInsensitive, .caseInsensitive], locale: Locale(identifier: "es_ES"))
            .split(whereSeparator: { $0.isWhitespace }).map(String.init)
        guard categoryIndex > 0 || !terms.isEmpty else { return [] }
        let chosen = categories.indices.contains(categoryIndex - 2)
            ? categories[categoryIndex - 2] : nil

        return spanishNews.filter { item in
            if let chosen, !(item.categories ?? []).contains(chosen) { return false }
            let searchable = [
                item.title, item.sourceName ?? "", item.summary ?? "",
                item.body ?? ""
            ].joined(separator: " ")
                .folding(options: [.diacriticInsensitive, .caseInsensitive],
                         locale: Locale(identifier: "es_ES"))
            return terms.allSatisfy { searchable.contains($0) }
        }
        .sorted {
            let first = $0.publishedAt ?? ""
            let second = $1.publishedAt ?? ""
            if first != second { return first > second }
            return $0.title.localizedStandardCompare($1.title) == .orderedAscending
        }
    }

    private func announce(_ message: String) {
        status = message
        UIAccessibility.post(notification: .announcement, argument: message)
    }

    private func read(_ item: NativeCatalogItem) {
        selectedArticle = item
        showingArticle = true
    }

    private func save(_ item: NativeCatalogItem) {
        let contents = NativeNewsMetadata.articleText(item)
        guard !(item.body ?? item.summary ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            announce("Esta noticia no contiene texto para guardar.")
            return
        }
        if library.documents.contains(where: { $0.title == item.title && $0.body == contents }) {
            announce("La noticia ya está guardada en TifloLector.")
            return
        }
        do {
            try library.importSharedText(contents, title: item.title)
            announce("Noticia guardada en TifloLector.")
        } catch {
            announce("No se pudo guardar la noticia: \(error.localizedDescription)")
        }
    }

    private func share(_ item: NativeCatalogItem) {
        if let url = NativeNewsMetadata.originalURL(item) {
            NativeShare.present(url: url)
        } else {
            announce("Esta noticia no tiene un enlace original para compartir.")
        }
    }

    private func openOriginal(_ item: NativeCatalogItem) {
        if let url = NativeNewsMetadata.originalURL(item) { openURL(url) }
        else { announce("La fuente original no está disponible.") }
    }

    var body: some View {
        List {
            Section {
                NativeAdjustableChoice(
                    title: "Categoría",
                    choices: categoryChoices,
                    selectedIndex: $categoryIndex
                )
            }

            if categoryIndex == 0 && query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                Text("Selecciona una categoría o escribe una búsqueda para consultar noticias.")
                    .foregroundStyle(.secondary)
            } else {
                Section("Noticias") {
                    Text("\(matchingNews.count) noticias encontradas")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    if matchingNews.isEmpty {
                        Text("No hay noticias que coincidan con esta selección.")
                            .foregroundStyle(.secondary)
                    }
                    ForEach(Array(matchingNews.prefix(visibleCount))) { item in
                        NavigationLink {
                            NativeNewsArticleScreen(item: item)
                        } label: {
                            VStack(alignment: .leading, spacing: 5) {
                                Text(item.title).font(.headline)
                                Text("Medio: \(NativeNewsMetadata.source(item))")
                                    .font(.subheadline).foregroundStyle(.secondary)
                                if let published = NativeNewsMetadata.publication(item.publishedAt) {
                                    Text("Publicado: \(published)")
                                        .font(.subheadline).foregroundStyle(.secondary)
                                }
                                if let summary = item.summary, !summary.isEmpty {
                                    Text(summary)
                                        .font(.subheadline)
                                        .foregroundStyle(.secondary)
                                        .lineLimit(2)
                                        .accessibilityHidden(true)
                                }
                            }
                        }
                        .accessibilityElement(children: .ignore)
                        .accessibilityLabel(NativeNewsMetadata.accessibilitySummary(item))
                        .accessibilityHint("Doble toque para leer. Acciones: Leer, Guardar en TifloLector, Compartir y Abrir fuente original.")
                        .accessibilityAction(named: Text("Leer")) { read(item) }
                        .accessibilityAction(named: Text("Guardar en TifloLector")) { save(item) }
                        .accessibilityAction(named: Text("Compartir")) { share(item) }
                        .accessibilityAction(named: Text("Abrir fuente original")) { openOriginal(item) }
                    }
                    if visibleCount < matchingNews.count {
                        Button("Mostrar diez más") { visibleCount += 10 }
                    }
                }
            }

            if let status {
                Text(status).font(.footnote).foregroundStyle(.secondary)
            }
            if let error = catalog.error {
                Text(error).foregroundStyle(.secondary)
                Button("Actualizar noticias") {
                    Task { await catalog.refresh() }
                }
            }
        }
        .tifloScreenSurface()
        .navigationTitle("Actualidad")
        .searchable(text: $query, prompt: "Buscar noticias")
        .onChange(of: query) { _, _ in visibleCount = 10 }
        .onChange(of: categoryIndex) { _, _ in visibleCount = 10 }
        .navigationDestination(isPresented: $showingArticle) {
            if let selectedArticle {
                NativeNewsArticleScreen(item: selectedArticle)
            }
        }
    }
}

struct NativeNewsArticleScreen: View {
    let item: NativeCatalogItem

    @EnvironmentObject private var library: NativeReaderLibrary
    @Environment(\.openURL) private var openURL
    @State private var status: String?

    private var paragraphs: [String] {
        let text = item.body ?? item.summary ?? ""
        return text.components(separatedBy: "\n\n")
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
    }

    private func save() {
        let text = NativeNewsMetadata.articleText(item)
        guard !paragraphs.isEmpty else {
            announce("Esta noticia no tiene texto para guardar.")
            return
        }
        if library.documents.contains(where: { $0.title == item.title && $0.body == text }) {
            announce("La noticia ya está guardada en TifloLector.")
            return
        }
        do {
            try library.importSharedText(text, title: item.title)
            announce("Noticia guardada en TifloLector.")
        } catch {
            announce("No se pudo guardar: \(error.localizedDescription)")
        }
    }

    private func announce(_ message: String) {
        status = message
        UIAccessibility.post(notification: .announcement, argument: message)
    }

    private func share() {
        if let url = NativeNewsMetadata.originalURL(item) {
            NativeShare.present(url: url)
        } else {
            announce("No hay enlace original para compartir.")
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                Text(item.title)
                    .font(.title2.bold())
                    .accessibilityAddTraits(.isHeader)
                    .accessibilityAction(named: Text("Guardar en TifloLector")) { save() }
                    .accessibilityAction(named: Text("Compartir")) { share() }
                    .accessibilityAction(named: Text("Abrir fuente original")) {
                        if let url = NativeNewsMetadata.originalURL(item) { openURL(url) }
                    }

                Text("Medio: \(NativeNewsMetadata.source(item))")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)

                if let published = NativeNewsMetadata.publication(item.publishedAt) {
                    Text("Publicado: \(published)")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                if let categories = item.categories, !categories.isEmpty {
                    Text("Categorías: \(categories.map(NativeNewsMetadata.category).joined(separator: ", "))")
                        .font(.footnote).foregroundStyle(.secondary)
                }

                LazyVStack(alignment: .leading, spacing: 12) {
                    ForEach(paragraphs.indices, id: \.self) { index in
                        Text(paragraphs[index])
                            .font(.body)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .textSelection(.enabled)
                    }
                }
                if paragraphs.isEmpty {
                    Text("Esta noticia no incluye texto para leer en la aplicación.")
                        .foregroundStyle(.secondary)
                }

                Button("Guardar en TifloLector") { save() }
                Button("Compartir") { share() }
                if let url = NativeNewsMetadata.originalURL(item) {
                    Button("Abrir fuente original") { openURL(url) }
                }
                if let status {
                    Text(status).font(.footnote).foregroundStyle(.secondary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding()
        }
        .tifloScreenSurface()
        .navigationTitle("Noticia")
        .navigationBarTitleDisplayMode(.inline)
    }
}
