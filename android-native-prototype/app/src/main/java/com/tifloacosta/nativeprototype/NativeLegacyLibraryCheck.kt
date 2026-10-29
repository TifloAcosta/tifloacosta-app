package com.tifloacosta.nativeprototype

import android.content.Context
import android.database.sqlite.SQLiteDatabase

/** Read-only warning for users whose old TifloLector data has not been migrated. */
data class LegacyLibraryState(val bookCount: Int?, val databasePresent: Boolean)

/** Existing books remain in SQLite. This read-only view is never a migration. */
data class LegacyLibraryBook(val id: String, val title: String, val format: String)

object NativeLegacyLibraryCheck {
    /**
     * Read the published library directly, without SQLiteOpenHelper or writes.
     * Titles are paged, so a large library never blocks the native home.
     * The original book IDs are passed back to the published reader intact.
     */
    fun listBooks(context: Context, offset: Int = 0, limit: Int = 20): List<LegacyLibraryBook> {
        val oldDatabase = context.getDatabasePath("tiflo_reading.db")
        if (!oldDatabase.exists()) return emptyList()
        if (!oldDatabase.isFile) throw java.io.IOException("La biblioteca anterior no está disponible.")
        return SQLiteDatabase.openDatabase(
            oldDatabase.absolutePath, null, SQLiteDatabase.OPEN_READONLY
        ).use { database ->
            val result = mutableListOf<LegacyLibraryBook>()
            database.rawQuery(
                "SELECT id, title, format FROM books ORDER BY title COLLATE NOCASE ASC, id ASC LIMIT ? OFFSET ?",
                arrayOf(limit.coerceIn(1, 50).toString(), offset.coerceAtLeast(0).toString())
            ).use { cursor ->
                while (cursor.moveToNext()) {
                    result.add(LegacyLibraryBook(
                        cursor.getString(0),
                        cursor.getString(1) ?: "Documento",
                        cursor.getString(2) ?: ""
                    ))
                }
            }
            result
        }
    }

    fun inspect(context: Context): LegacyLibraryState {
        val oldDatabase = context.getDatabasePath("tiflo_reading.db")
        if (!oldDatabase.exists()) return LegacyLibraryState(0, false)
        if (!oldDatabase.isFile) return LegacyLibraryState(null, true)

        // Never use ReadingLibraryDatabase here: opening that helper can
        // migrate/write its schema. Preserve legacy files and marks exactly.
        return try {
            SQLiteDatabase.openDatabase(
                oldDatabase.absolutePath, null, SQLiteDatabase.OPEN_READONLY
            ).use { database ->
                database.rawQuery("SELECT COUNT(*) FROM books", null).use { cursor ->
                    if (cursor.moveToFirst()) {
                        LegacyLibraryState(cursor.getInt(0), true)
                    } else {
                        LegacyLibraryState(null, true)
                    }
                }
            }
        } catch (_: Exception) {
            // An unreadable database must never be presented as an empty library.
            LegacyLibraryState(null, true)
        }
    }
}
