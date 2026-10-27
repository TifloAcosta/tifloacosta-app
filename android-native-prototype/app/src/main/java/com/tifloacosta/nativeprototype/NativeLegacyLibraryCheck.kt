package com.tifloacosta.nativeprototype

import android.content.Context
import android.database.sqlite.SQLiteDatabase

/** Read-only warning for users whose old TifloLector data has not been migrated. */
data class LegacyLibraryState(val bookCount: Int?, val databasePresent: Boolean)

object NativeLegacyLibraryCheck {
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
