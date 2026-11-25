#ifndef NATIVE_CINEMA_COMPRESSION_H
#define NATIVE_CINEMA_COMPRESSION_H
#include <stdint.h>
#include <stddef.h>
// Return 0 for a complete stream, 1 for output limit, -1 for invalid data.
int tiflo_cinema_bz2(const uint8_t *input, size_t length, uint8_t *output, size_t *capacity);
int tiflo_cinema_gzip(const uint8_t *input, size_t length, uint8_t *output, size_t *capacity);
#include "../PDFEngine/TifloPDFPostprocess.h"
#include <chromaprint.h>
static inline ChromaprintContext *tiflo_chromaprint_new(void) {
    return chromaprint_new(CHROMAPRINT_ALGORITHM_DEFAULT);
}
#endif
