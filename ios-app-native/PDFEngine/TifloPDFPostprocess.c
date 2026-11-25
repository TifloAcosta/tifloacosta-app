#include "TifloPDFPostprocess.h"
#include <qpdf/qpdf-c.h>

// Quartz emits a flat number tree for its page marked-content references.
static int attach_link(qpdf_data pdf, qpdf_oh tree, qpdf_oh numbers,
                       qpdf_oh page, qpdf_oh annotation, long long key) {
    if (!qpdf_oh_is_indirect(pdf, tree) || !qpdf_oh_is_indirect(pdf, page) ||
        !qpdf_oh_is_indirect(pdf, annotation)) return 0;
    qpdf_oh kids = qpdf_oh_get_key(pdf, tree, "/K");
    if (!qpdf_oh_is_array(pdf, kids)) {
        qpdf_oh earlier = kids;
        kids = qpdf_oh_new_array(pdf);
        if (!qpdf_oh_is_null(pdf, earlier)) qpdf_oh_append_item(pdf, kids, earlier);
        qpdf_oh_replace_key(pdf, tree, "/K", kids);
    }
    qpdf_oh reference = qpdf_oh_new_dictionary(pdf);
    qpdf_oh_replace_key(pdf, reference, "/Type", qpdf_oh_new_name(pdf, "/OBJR"));
    qpdf_oh_replace_key(pdf, reference, "/Obj", annotation);
    qpdf_oh_replace_key(pdf, reference, "/Pg", page);
    qpdf_oh node = qpdf_make_indirect_object(pdf, qpdf_oh_new_dictionary(pdf));
    qpdf_oh_replace_key(pdf, node, "/Type", qpdf_oh_new_name(pdf, "/StructElem"));
    qpdf_oh_replace_key(pdf, node, "/S", qpdf_oh_new_name(pdf, "/Link"));
    qpdf_oh_replace_key(pdf, node, "/P", tree);
    qpdf_oh_replace_key(pdf, node, "/Pg", page);
    qpdf_oh_replace_key(pdf, node, "/K", reference);
    qpdf_oh description = qpdf_oh_get_key(pdf, annotation, "/Contents");
    if (qpdf_oh_is_string(pdf, description)) qpdf_oh_replace_key(pdf, node, "/Alt", description);
    qpdf_oh_replace_key(pdf, annotation, "/StructParent", qpdf_oh_new_integer(pdf, key));
    qpdf_oh_append_item(pdf, numbers, qpdf_oh_new_integer(pdf, key));
    qpdf_oh_append_item(pdf, numbers, node);
    qpdf_oh_append_item(pdf, kids, node);
    return 1;
}

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

    qpdf_oh tree = qpdf_oh_get_key(pdf, root, "/StructTreeRoot");
    qpdf_oh numbers = 0;
    long long next_key = 0;
    if (qpdf_oh_is_dictionary(pdf, tree)) {
        qpdf_oh parent_tree = qpdf_oh_get_key(pdf, tree, "/ParentTree");
        if (qpdf_oh_is_dictionary(pdf, parent_tree) &&
            qpdf_oh_is_null(pdf, qpdf_oh_get_key(pdf, parent_tree, "/Kids")) &&
            qpdf_oh_is_null(pdf, qpdf_oh_get_key(pdf, parent_tree, "/Limits"))) {
            qpdf_oh entries = qpdf_oh_get_key(pdf, parent_tree, "/Nums");
            if (qpdf_oh_is_array(pdf, entries)) {
                int count = qpdf_oh_get_array_n_items(pdf, entries);
                if (count % 2 == 0) numbers = entries;
                for (int i = 0; numbers && i < count; i += 2) {
                    qpdf_oh entry = qpdf_oh_get_array_item(pdf, entries, i);
                    if (!qpdf_oh_is_integer(pdf, entry)) { numbers = 0; break; }
                    long long key = qpdf_oh_get_int_value(pdf, entry);
                    if (key < 0 || key > 1000000000) { numbers = 0; break; }
                    if (key >= next_key) next_key = key + 1;
                }
            }
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
            if (numbers && qpdf_oh_is_null(pdf, qpdf_oh_get_key(pdf, annotation, "/StructParent")) &&
                attach_link(pdf, tree, numbers, page, annotation, next_key)) ++next_key;
            ++label;
        }
    }

    if (numbers && next_key > 0)
        qpdf_oh_replace_key(pdf, tree, "/ParentTreeNextKey", qpdf_oh_new_integer(pdf, next_key));
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
