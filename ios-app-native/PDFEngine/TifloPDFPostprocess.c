#include "TifloPDFPostprocess.h"
#include <qpdf/qpdf-c.h>

int tiflo_pdf_postprocess(const char *input, const char *output, const char *language,
                          const char *const *labels, size_t label_count) {
    qpdf_data pdf = qpdf_init();
    if (!pdf) return QPDF_ERRORS;
    qpdf_silence_errors(pdf);
    qpdf_set_suppress_warnings(pdf, 1);
    // Quartz may emit unused objects at offset zero. qpdf repairs these on output.
    int result = qpdf_read(pdf, input, 0) & QPDF_ERRORS;
    if (result != 0 || qpdf_has_error(pdf)) goto failed;

    qpdf_oh root = qpdf_get_root(pdf);
    qpdf_oh preferences = qpdf_oh_get_key(pdf, root, "/ViewerPreferences");
    if (!qpdf_oh_is_dictionary(pdf, preferences)) {
        preferences = qpdf_oh_new_dictionary(pdf);
        qpdf_oh_replace_key(pdf, root, "/ViewerPreferences", preferences);
    }
    qpdf_oh_replace_key(pdf, preferences, "/DisplayDocTitle", qpdf_oh_new_bool(pdf, 1));
    if (language && language[0]) {
        qpdf_oh_replace_key(pdf, root, "/Lang", qpdf_oh_new_unicode_string(pdf, language));
    }

    int pages = qpdf_get_num_pages(pdf);
    size_t total_links = 0;
    for (int i = 0; i < pages; ++i) {
        qpdf_oh page = qpdf_get_page_n(pdf, i);
        qpdf_oh annotations = qpdf_oh_get_key(pdf, page, "/Annots");
        if (!qpdf_oh_is_array(pdf, annotations)) continue;
        int count = qpdf_oh_get_array_n_items(pdf, annotations);
        for (int j = 0; j < count; ++j) {
            qpdf_oh annotation = qpdf_oh_get_array_item(pdf, annotations, j);
            qpdf_oh subtype = qpdf_oh_get_key(pdf, annotation, "/Subtype");
            if (qpdf_oh_is_name_and_equals(pdf, subtype, "/Link")) ++total_links;
        }
    }

    size_t label = 0;
    for (int i = 0; i < pages; ++i) {
        qpdf_oh page = qpdf_get_page_n(pdf, i);
        qpdf_oh annotations = qpdf_oh_get_key(pdf, page, "/Annots");
        if (!qpdf_oh_is_array(pdf, annotations)) continue;
        qpdf_oh_replace_key(pdf, page, "/Tabs", qpdf_oh_new_name(pdf, "/S"));
        if (total_links != label_count) continue;
        int count = qpdf_oh_get_array_n_items(pdf, annotations);
        for (int j = 0; j < count; ++j) {
            qpdf_oh annotation = qpdf_oh_get_array_item(pdf, annotations, j);
            qpdf_oh subtype = qpdf_oh_get_key(pdf, annotation, "/Subtype");
            if (!qpdf_oh_is_name_and_equals(pdf, subtype, "/Link")) continue;
            if (labels[label] && labels[label][0]) {
                qpdf_oh_replace_key(pdf, annotation, "/Contents", qpdf_oh_new_unicode_string(pdf, labels[label]));
            }
            ++label;
        }
    }

    if (qpdf_has_error(pdf)) goto failed;
    result = qpdf_init_write(pdf, output) & QPDF_ERRORS;
    if (result != 0 || qpdf_has_error(pdf)) goto failed;
    result = qpdf_write(pdf) & QPDF_ERRORS;
    if (result != 0 || qpdf_has_error(pdf)) goto failed;
    qpdf_cleanup(&pdf);
    return 0;
failed:
    result = QPDF_ERRORS;
    qpdf_cleanup(&pdf);
    return result;
}
