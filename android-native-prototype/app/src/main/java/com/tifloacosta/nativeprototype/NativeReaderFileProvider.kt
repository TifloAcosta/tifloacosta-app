package com.tifloacosta.nativeprototype

import androidx.core.content.FileProvider

/** Separate component identity; avoids merging away the public application's FileProvider. */
class NativeReaderFileProvider : FileProvider()
