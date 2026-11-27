#ifndef TIFLO_PDF_POSTPROCESS_H
#define TIFLO_PDF_POSTPROCESS_H
#include <stddef.h>
int tiflo_pdf_postprocess(const char *input, const char *output, const char *language,
                          const char *const *labels, const int *owners, size_t label_count, size_t owner_count, const char *const *paths, size_t path_count, int (*cancelled)(void));
// Normalize ordinary UTF-8 HTML into XML for the existing semantic allowlist.
int tiflo_html_normalize(const unsigned char *input, size_t length,
                         unsigned char **output, size_t *output_length);
void tiflo_html_normalize_free(unsigned char *output);
#endif
