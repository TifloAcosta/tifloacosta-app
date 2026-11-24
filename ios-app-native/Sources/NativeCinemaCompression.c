#include "NativeCinemaCompression.h"
#include <bzlib.h>
#include <zlib.h>
#include <limits.h>
int tiflo_cinema_bz2(const uint8_t *input, size_t length, uint8_t *output, size_t *capacity) {
    if (!input || !output || !capacity || !length || length > UINT_MAX || *capacity > UINT_MAX) return -1;
    bz_stream s = {0};
    if (BZ2_bzDecompressInit(&s, 0, 0) != BZ_OK) return -1;
    s.next_in = (char *)input; s.avail_in = (unsigned int)length;
    s.next_out = (char *)output; s.avail_out = (unsigned int)*capacity;
    int r;
    do {
        unsigned int before_in = s.avail_in, before_out = s.avail_out;
        r = BZ2_bzDecompress(&s);
        if (r == BZ_OK && before_in == s.avail_in && before_out == s.avail_out) { r = BZ_DATA_ERROR; break; }
    } while (r == BZ_OK && s.avail_out && s.avail_in);
    size_t used = *capacity - s.avail_out;
    int result = r == BZ_STREAM_END && s.avail_in == 0 ? 0 : (r == BZ_OK && !s.avail_out ? 1 : -1);
    BZ2_bzDecompressEnd(&s);
    *capacity = used;
    return result;
}
int tiflo_cinema_gzip(const uint8_t *input, size_t length, uint8_t *output, size_t *capacity) {
    if (!input || !output || !capacity || !length || length > UINT_MAX || *capacity > UINT_MAX) return -1;
    z_stream s = {0};
    if (inflateInit2(&s, 16 + MAX_WBITS) != Z_OK) return -1;
    s.next_in = (Bytef *)input; s.avail_in = (uInt)length;
    s.next_out = output; s.avail_out = (uInt)*capacity;
    int r = inflate(&s, Z_FINISH);
    size_t used = *capacity - s.avail_out;
    int result = r == Z_STREAM_END && s.avail_in == 0 ? 0 : ((r == Z_BUF_ERROR || r == Z_OK) && !s.avail_out ? 1 : -1);
    inflateEnd(&s);
    *capacity = used;
    return result;
}
