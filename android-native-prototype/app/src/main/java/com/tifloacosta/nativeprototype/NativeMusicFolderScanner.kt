package com.tifloacosta.nativeprototype

import android.content.Context
import android.net.Uri
import android.provider.DocumentsContract

internal class NativeMusicFolderScanner(private val context: Context) {
    fun scan(treeUri: Uri): List<Pair<String, String>> {
        val rootId = DocumentsContract.getTreeDocumentId(treeUri)
        val pending = ArrayDeque<Pair<String, Int>>()
        val visited = mutableSetOf<String>()
        val found = mutableListOf<Pair<String, String>>()
        pending.add(rootId to 0)
        while (pending.isNotEmpty() && visited.size < 10_000 && found.size < 5_000) {
            val (parentId, depth) = pending.removeFirst()
            if (!visited.add(parentId)) continue
            val children = DocumentsContract.buildChildDocumentsUriUsingTree(treeUri, parentId)
            val columns = arrayOf(
                DocumentsContract.Document.COLUMN_DOCUMENT_ID,
                DocumentsContract.Document.COLUMN_DISPLAY_NAME,
                DocumentsContract.Document.COLUMN_MIME_TYPE,
            )
            context.contentResolver.query(children, columns, null, null, null)?.use { cursor ->
                val idColumn = cursor.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_DOCUMENT_ID)
                val titleColumn = cursor.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_DISPLAY_NAME)
                val typeColumn = cursor.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_MIME_TYPE)
                while (cursor.moveToNext()) {
                    val id = cursor.getString(idColumn) ?: continue
                    val title = cursor.getString(titleColumn) ?: continue
                    val type = cursor.getString(typeColumn) ?: ""
                    if (type == DocumentsContract.Document.MIME_TYPE_DIR) {
                        if (depth < 8) pending.add(id to depth + 1)
                    } else if (type.startsWith("audio/") || title.substringAfterLast('.', "").lowercase() in setOf("mp3", "m4a", "aac", "wav", "flac", "ogg")) {
                        val uri = DocumentsContract.buildDocumentUriUsingTree(treeUri, id)
                        found.add(uri.toString() to title)
                    }
                    if (found.size >= 5_000) break
                }
            }
        }
        return found
    }
}
