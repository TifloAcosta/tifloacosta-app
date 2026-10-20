import SwiftUI
import AVFoundation
import UIKit

struct NativeReaderSystemDictionary: UIViewControllerRepresentable {
    let term: String
    func makeUIViewController(context: Context) -> UIReferenceLibraryViewController {
        UIReferenceLibraryViewController(term: term)
    }
    func updateUIViewController(_ controller: UIReferenceLibraryViewController, context: Context) {}
}

/// Consulta a demanda; ni el texto ni la palabra se envían a un diccionario externo.
struct NativeReaderWordToolsScreen: View {
    let voiceIdentifier: String
    let pitch: Float
    @Environment(\.dismiss) private var dismiss
    @StateObject private var pronunciation = NativeReadingSpeech()
    @State private var word = ""
    @State private var dictionaryTerm = ""
    @State private var showDictionary = false
    private var enteredWord: String {
        word.trimmingCharacters(in: .whitespacesAndNewlines)
    }
    var body: some View {
        NavigationStack {
            List {
                Section("Palabra o expresión") {
                    TextField("Escribir o pegar la palabra", text: $word)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    Button("Escuchar pronunciación") {
                        pronunciation.play(enteredWord, pitch: pitch,
                            language: AVSpeechSynthesisVoice(identifier: voiceIdentifier)?.language ?? "es-ES",
                            voiceIdentifier: voiceIdentifier)
                    }
                    .disabled(enteredWord.isEmpty)
                    Button("Consultar diccionario del iPhone") {
                        dictionaryTerm = enteredWord
                        showDictionary = true
                    }
                    .disabled(enteredWord.isEmpty)
                }
                Section {
                    Text("El diccionario depende de los idiomas instalados en iOS. La pronunciación utiliza la voz elegida para esta obra.")
                }
            }
            .tifloScreenSurface()
            .navigationTitle("Diccionario y pronunciación")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { Button("Cerrar") { dismiss() } }
            .sheet(isPresented: $showDictionary) {
                NavigationStack {
                    NativeReaderSystemDictionary(term: dictionaryTerm)
                        .navigationTitle("Definición")
                        .navigationBarTitleDisplayMode(.inline)
                        .toolbar { Button("Cerrar") { showDictionary = false } }
                }
            }
            .onDisappear { pronunciation.stop() }
        }
    }
}

/// El reconocimiento se realiza en el propio iPhone, sin servicio remoto.
struct NativeReaderOCRSettingsScreen: View {
    @AppStorage("native-reader-ocr-language-index") private var languageIndex = 0
    @AppStorage("native-reader-ocr-accuracy-index") private var accuracyIndex = 0
    var body: some View {
        List {
            Section("Reconocimiento de texto") {
                NativeAdjustableChoice(
                    title: "Idioma del OCR",
                    choices: ["Detectar automáticamente", "Español", "Inglés", "Español e inglés"],
                    selectedIndex: $languageIndex
                )
                NativeAdjustableChoice(
                    title: "Precisión del OCR",
                    choices: ["Mayor precisión", "Más rápido"],
                    selectedIndex: $accuracyIndex
                )
            }
            Section {
                Text("Se aplica a las imágenes y a las páginas escaneadas de PDF que se importen desde ahora. Las páginas que ya contienen texto lo conservan. Los ajustes son permanentes hasta que se cambien.")
            }
        }
        .tifloScreenSurface()
        .navigationTitle("OCR y reconocimiento")
        .navigationBarTitleDisplayMode(.inline)
    }
}
