#ifndef TIFLO_PDF_POSTPROCESS_H
#define TIFLO_PDF_POSTPROCESS_H
#include <stddef.h>
int tiflo_pdf_postprocess(const char *input, const char *output, const char *language,
                          const char *const *labels, size_t label_count);
#endif
